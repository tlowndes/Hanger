//! Reads the Homepage dashboard (gethomepage) on the home network: its services, and whether each one is up.
//! Plain http to one host, same as the Vinyl Pi, and read-only.
use crate::vinyl::{base_url, get};

const LIMIT: u64 = 1024 * 1024;

/// A path segment or query value from the page: no slashes, quotes or control characters.
fn plain(s: &str) -> bool {
    !s.is_empty() && s.len() <= 120 && !s.chars().any(|c| c.is_control() || matches!(c, '/' | '\\' | '?' | '#' | '&' | '='))
}

fn encode(s: &str) -> String {
    s.bytes()
        .map(|b| if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') { (b as char).to_string() } else { format!("%{b:02X}") })
        .collect()
}

/// The dashboard's groups and services, as Homepage's own JSON.
#[tauri::command]
pub async fn lab_services(address: String) -> Result<String, String> {
    let base = base_url(&address).ok_or("That isn't a Homepage address.")?;
    tauri::async_runtime::spawn_blocking(move || {
        let (bytes, _) = get(&format!("{base}/api/services"), LIMIT)?;
        String::from_utf8(bytes).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Homepage's own up/down check for one service (its Site Monitor), as JSON.
#[tauri::command]
pub async fn lab_status(address: String, group: String, service: String) -> Result<String, String> {
    let base = base_url(&address).ok_or("That isn't a Homepage address.")?;
    if !plain(&group) || !plain(&service) {
        return Err("Not a service.".into());
    }
    let url = format!("{base}/api/siteMonitor?groupName={}&serviceName={}", encode(&group), encode(&service));
    tauri::async_runtime::spawn_blocking(move || {
        let (bytes, _) = get(&url, 16 * 1024)?;
        String::from_utf8(bytes).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_names_only() {
        assert!(plain("Pi-hole"));
        assert!(plain("Home Assistant"));
        assert!(!plain(""));
        assert!(!plain("a/b"));
        assert!(!plain("a&b=c"));
        assert!(!plain("x\ny"));
    }

    #[test]
    fn encodes_spaces_and_symbols() {
        assert_eq!(encode("Home Assistant"), "Home%20Assistant");
        assert_eq!(encode("Pi-hole"), "Pi-hole");
        assert_eq!(encode("Café"), "Caf%C3%A9");
    }
}
