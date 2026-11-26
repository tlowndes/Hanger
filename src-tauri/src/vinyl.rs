//! Talks to the Vinyl Pi over the home network. The page can't call the Pi itself (the Pi sends no CORS headers and
//! the app's page policy blocks other hosts), so these commands do the fetching. Plain http to one host only.
use std::io::Read;
use std::time::Duration;

use base64::Engine;

const STATE_LIMIT: u64 = 512 * 1024;
const COVER_LIMIT: u64 = 4 * 1024 * 1024;

/// `vinyl.local`, `192.168.1.20:80` or `http://vinyl.local/` become `http://vinyl.local`. Only plain http to a host
/// (and optional port) is accepted: no paths, logins or other schemes.
pub fn base_url(address: &str) -> Option<String> {
    let a = address.trim().trim_end_matches('/');
    let rest = match a.strip_prefix("http://") {
        Some(r) => r,
        None if a.contains("://") => return None,
        None => a,
    };
    if rest.is_empty() || rest.contains(['/', '\\', ' ', '?', '#', '@']) {
        return None;
    }
    Some(format!("http://{rest}"))
}

pub fn get(url: &str, limit: u64) -> Result<(Vec<u8>, String), String> {
    let agent = ureq::AgentBuilder::new().timeout(Duration::from_secs(4)).build();
    let resp = agent.get(url).call().map_err(|_| "Couldn't reach the Vinyl Pi. Is it on, and is the address right?".to_string())?;
    let kind = resp.content_type().to_string();
    let mut bytes = Vec::new();
    resp.into_reader().take(limit).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    Ok((bytes, kind))
}

/// What's on the platter, as the Pi's own JSON.
#[tauri::command]
pub async fn vinyl_state(address: String) -> Result<String, String> {
    let base = base_url(&address).ok_or("That isn't a Vinyl Pi address.")?;
    tauri::async_runtime::spawn_blocking(move || {
        let (bytes, _) = get(&format!("{base}/api/state"), STATE_LIMIT)?;
        String::from_utf8(bytes).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// A cover from the Pi, as a data URL so the page needs no network permission.
#[tauri::command]
pub async fn vinyl_cover(address: String, path: String) -> Result<String, String> {
    let base = base_url(&address).ok_or("That isn't a Vinyl Pi address.")?;
    if !path.starts_with("/covers/") || path.contains("..") || path.contains(['\\', '?', '#']) {
        return Err("Not a cover.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let (bytes, kind) = get(&format!("{base}{path}"), COVER_LIMIT)?;
        let kind = if kind.starts_with("image/") { kind } else { "image/jpeg".into() };
        Ok(format!("data:{kind};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Opens a home-network page (the Pi's player, Homepage) in the default browser.
#[tauri::command]
pub fn open_link(address: String) -> Result<(), String> {
    let base = base_url(&address).ok_or("That isn't a valid address.")?;
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        std::process::Command::new("explorer.exe")
            .arg(&base)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Couldn't open the browser: {e}"))
    }
    #[cfg(not(windows))]
    {
        let _ = base;
        Err("Opening the player works in the Windows app.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tidies_addresses() {
        assert_eq!(base_url("vinyl.local").as_deref(), Some("http://vinyl.local"));
        assert_eq!(base_url(" http://vinyl.local/ ").as_deref(), Some("http://vinyl.local"));
        assert_eq!(base_url("192.168.1.20:8880").as_deref(), Some("http://192.168.1.20:8880"));
    }

    #[test]
    fn refuses_the_rest() {
        assert_eq!(base_url(""), None);
        assert_eq!(base_url("https://vinyl.local"), None);
        assert_eq!(base_url("file:///c:/x"), None);
        assert_eq!(base_url("vinyl.local/api"), None);
        assert_eq!(base_url("me@vinyl.local"), None);
    }
}
