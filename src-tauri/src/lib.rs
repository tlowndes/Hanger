//! Hanger desktop shell. The note logic lives in TypeScript; this side owns what only native code can do:
//! the settings file and reading and writing notes inside the vault's `99 - Meta` folder.
mod settings;
mod vault;

use std::sync::Mutex;

use tauri::{AppHandle, Manager, State};

pub struct AppState {
    pub settings: Mutex<settings::Settings>,
}

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Result<settings::Settings, String> {
    state.settings.lock().map(|s| s.clone()).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_settings(app: AppHandle, state: State<'_, AppState>, next: settings::Settings) -> Result<(), String> {
    if !next.vault.is_empty() && !std::path::Path::new(&next.vault).is_dir() {
        return Err("That vault folder doesn't exist.".into());
    }
    settings::store(&app, &next)?;
    *state.settings.lock().map_err(|e| e.to_string())? = next;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // A second launch brings the running window forward instead of opening a second copy.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let s = settings::load(app.handle());
            app.manage(AppState { settings: Mutex::new(s) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            set_settings,
            vault::vault_list,
            vault::vault_read,
            vault::vault_write,
            vault::vault_remove,
            vault::vault_exists,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hanger");
}
