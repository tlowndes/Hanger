//! Hanger desktop shell. The note logic lives in TypeScript; this side owns what only native code can do:
//! the settings file and reading and writing notes inside the vault's `99 - Meta` folder.
mod settings;
mod sorting;
mod vault;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub struct AppState {
    pub settings: Mutex<settings::Settings>,
    /// True when Ctrl Shift Space was free to claim as the system-wide Quick capture key.
    pub hotkey: AtomicBool,
    /// True when Ctrl Shift 4 was free to claim for the snipping overlay.
    pub snip_hotkey: AtomicBool,
}

/// Ctrl Shift Space, from any app.
fn quick_capture_key() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space)
}

/// Ctrl Shift 4, from any app.
fn snip_key() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Digit4)
}

#[tauri::command]
fn snip_hotkey_ready(state: State<'_, AppState>) -> bool {
    state.snip_hotkey.load(Ordering::Relaxed)
}

#[tauri::command]
fn hotkey_ready(state: State<'_, AppState>) -> bool {
    state.hotkey.load(Ordering::Relaxed)
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
        // Quick capture: bring Hanger forward and tell the page to open the add box.
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if shortcut == &quick_capture_key() && event.state() == ShortcutState::Pressed {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.unminimize();
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                        let _ = app.emit("quick-capture", ());
                    } else if shortcut == &snip_key() && event.state() == ShortcutState::Pressed {
                        let _ = sorting::open_snip();
                    }
                })
                .build(),
        )
        .setup(|app| {
            let s = settings::load(app.handle());
            // Another app may already own the key. Hanger still runs; Settings says so.
            let claimed = app.global_shortcut().register(quick_capture_key()).is_ok();
            let snip_claimed = app.global_shortcut().register(snip_key()).is_ok();
            app.manage(AppState { settings: Mutex::new(s), hotkey: AtomicBool::new(claimed), snip_hotkey: AtomicBool::new(snip_claimed) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            set_settings,
            hotkey_ready,
            snip_hotkey_ready,
            sorting::snip,
            sorting::sort_defaults,
            sorting::sort_list,
            sorting::sort_ocr,
            sorting::sort_thumb,
            sorting::sort_move,
            vault::vault_list,
            vault::vault_read,
            vault::vault_write,
            vault::vault_remove,
            vault::vault_exists,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hanger");
}
