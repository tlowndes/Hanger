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
