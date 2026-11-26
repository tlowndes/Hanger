//! Settings kept in the app's own config folder (not the vault, as they differ per PC).
use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// Vault root, the folder holding `.obsidian`. Empty until chosen.
    pub vault: String,
    /// Screenshot sorting. Folders are per PC, so they live here and not in the vault.
    pub sorting: Sorting,
    /// The Vinyl Pi on the home network.
    pub vinyl: Vinyl,
    /// The Homepage dashboard on the home network.
    pub lab: Lab,
    /// Where the weather is for. Found once from a town name in Settings.
    pub weather: Weather,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Vinyl {
    /// Where the Pi answers, usually `http://vinyl.local`.
    pub address: String,
    /// True when the Vinyl tile opens the Pi's own page in the browser instead of Hanger's built-in one.
    pub separate: bool,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Weather {
    /// What was typed, like "Manchester".
    pub place: String,
    /// What the geocoder found, like "Manchester, United Kingdom". Empty until a town is found.
    pub name: String,
    pub lat: f64,
    pub lon: f64,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Lab {
    /// Where Homepage answers, like `http://192.168.1.20:3000`. Empty until set.
    pub address: String,
    /// True when the Lab tile opens Homepage in the browser instead of Hanger's built-in page.
    pub separate: bool,
}

impl Default for Vinyl {
    fn default() -> Self {
        Vinyl { address: "http://vinyl.local".into(), separate: false }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Sorting {
    /// Where Windows saves screenshots. Empty until chosen.
    pub screenshots: String,
    /// Where sorted screenshots go, in a folder per category. Empty until chosen.
    pub sorted: String,
    /// Off until switched on, so nothing moves without a go-ahead.
    pub on: bool,
    /// "careful", "normal" or "relaxed": how sure Hanger must be before it files one without asking.
    pub sureness: String,
    /// Seconds since 1970 when sorting was switched on. Older screenshots are only filed after a look.
    pub since: i64,
}

impl Default for Sorting {
    fn default() -> Self {
        Sorting { screenshots: String::new(), sorted: String::new(), on: false, sureness: "normal".into(), since: 0 }
    }
}

fn file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("settings.json"))
}

pub fn load(app: &AppHandle) -> Settings {
    file(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn store(app: &AppHandle, s: &Settings) -> Result<(), String> {
    let p = file(app).ok_or("Couldn't find the settings folder.")?;
    let text = serde_json::to_string_pretty(s).map_err(|e| e.to_string())?;
    crate::vault::write_atomic(&p, &text)
}
