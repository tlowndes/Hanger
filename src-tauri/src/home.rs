//! Weather and calendar feeds for Launch Pad. Read-only, https only. The calendar links are the ICS links Flight
//! Deck keeps in the vault, so this fetches whatever the vault names but never anything that isn't plain https.
use std::io::Read;
use std::time::Duration;

const FORECAST_LIMIT: u64 = 512 * 1024;
const CALENDAR_LIMIT: u64 = 8 * 1024 * 1024;

fn fetch(url: &str, limit: u64) -> Result<String, String> {
    let agent = ureq::AgentBuilder::new().timeout(Duration::from_secs(15)).build();
    let resp = agent.get(url).call().map_err(|e| match e {
        ureq::Error::Status(code, _) => format!("The server said {code}."),
        _ => "Couldn't reach it. Is the internet on?".to_string(),
    })?;
    let mut bytes = Vec::new();
    resp.into_reader().take(limit).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    String::from_utf8(bytes).map_err(|_| "That wasn't text.".to_string())
}

/// Proton shares links as webcal://; fetch them over https. Anything but https (after that) is refused, as are
/// addresses with a login in them or a local host.
pub fn calendar_url(raw: &str) -> Option<String> {
    let t = raw.trim();
    let lower = t.to_ascii_lowercase();
    let rest = if lower.starts_with("webcals://") {
        &t[10..]
    } else if lower.starts_with("webcal://") {
        &t[9..]
    } else if lower.starts_with("https://") {
        &t[8..]
    } else {
        return None;
    };
    let host = rest.split(['/', '?', '#']).next().unwrap_or("");
    let bare = host.split(':').next().unwrap_or("").to_ascii_lowercase();
    if host.is_empty() || host.contains('@') || t.contains(char::is_whitespace) {
        return None;
    }
    if bare == "localhost" || bare.ends_with(".local") || !bare.contains('.') || bare.parse::<std::net::Ipv4Addr>().is_ok() || bare.starts_with('[') {
        return None;
    }
    Some(format!("https://{rest}"))
}

fn encode(s: &str) -> String {
    s.bytes()
        .map(|b| if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') { (b as char).to_string() } else { format!("%{b:02X}") })
        .collect()
}

/// Finds a town with Open-Meteo's geocoder. Returns its JSON.
#[tauri::command]
pub async fn weather_find(place: String) -> Result<String, String> {
    let p = place.trim().to_string();
    if p.is_empty() || p.len() > 80 {
        return Err("Type a town.".into());
    }
    let url = format!("https://geocoding-api.open-meteo.com/v1/search?name={}&count=1&language=en&format=json", encode(&p));
    tauri::async_runtime::spawn_blocking(move || fetch(&url, FORECAST_LIMIT)).await.map_err(|e| e.to_string())?
}

/// A week of hourly rain chance and temperature, plus daily lows, from Open-Meteo (free, no key). Returns its JSON.
#[tauri::command]
pub async fn weather_forecast(lat: f64, lon: f64) -> Result<String, String> {
    if !(-90.0..=90.0).contains(&lat) || !(-180.0..=180.0).contains(&lon) {
        return Err("That isn't a place on Earth.".into());
    }
    let url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={lat:.3}&longitude={lon:.3}&hourly=temperature_2m,precipitation_probability&daily=temperature_2m_min&timezone=auto&forecast_days=3"
    );
    tauri::async_runtime::spawn_blocking(move || fetch(&url, FORECAST_LIMIT)).await.map_err(|e| e.to_string())?
}

/// One calendar's ICS text.
#[tauri::command]
pub async fn calendar_fetch(url: String) -> Result<String, String> {
    let u = calendar_url(&url).ok_or("That isn't a calendar link Hanger can read.")?;
    let text = tauri::async_runtime::spawn_blocking(move || fetch(&u, CALENDAR_LIMIT)).await.map_err(|e| e.to_string())??;
    if text.contains("BEGIN:VCALENDAR") {
        Ok(text)
    } else {
        Err("That link isn't a calendar.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calendar_links_are_https_only() {
        assert_eq!(calendar_url("webcal://calendar.proton.me/api/x?y=1").as_deref(), Some("https://calendar.proton.me/api/x?y=1"));
        assert_eq!(calendar_url(" https://calendar.proton.me/a ").as_deref(), Some("https://calendar.proton.me/a"));
        assert_eq!(calendar_url("http://calendar.proton.me/a"), None);
        assert_eq!(calendar_url("file:///c:/x"), None);
        assert_eq!(calendar_url("https://user:pw@calendar.proton.me/a"), None);
    }

    #[test]
    fn calendar_links_never_point_at_this_network() {
        assert_eq!(calendar_url("https://localhost/a"), None);
        assert_eq!(calendar_url("https://192.168.1.5/a"), None);
        assert_eq!(calendar_url("https://vinyl.local/a"), None);
        assert_eq!(calendar_url("https://router/a"), None);
    }

    #[test]
    fn encodes_towns() {
        assert_eq!(encode("St Helens"), "St%20Helens");
    }
}
