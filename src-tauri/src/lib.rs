//! Hanger desktop shell. The note logic lives in TypeScript; this side owns what only native code can do:
//! the settings file and reading and writing notes inside the vault's `99 - Meta` folder.
mod capture;
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
    /// True when Ctrl Shift 3 and 4 were both free to claim for screenshots.
    pub capture_hotkeys: AtomicBool,
}

/// Ctrl Shift Space, from any app.
fn quick_capture_key() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space)
}

fn full_key() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Digit3)
}

fn region_key() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Digit4)
}

#[tauri::command]
fn capture_hotkeys_ready(state: State<'_, AppState>) -> bool {
    state.capture_hotkeys.load(Ordering::Relaxed)
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
                    } else if shortcut == &full_key() && event.state() == ShortcutState::Pressed {
                        let app = app.clone();
                        std::thread::spawn(move || {
                            let _ = capture::capture_screen_now(&app);
                        });
                    } else if shortcut == &region_key() && event.state() == ShortcutState::Pressed {
                        let app = app.clone();
                        std::thread::spawn(move || {
                            let _ = capture::start_region_now(&app);
                        });
                    }
                })
                .build(),
        )
        .setup(|app| {
            let s = settings::load(app.handle());
            // Another app may already own the key. Hanger still runs; Settings says so.
            let claimed = app.global_shortcut().register(quick_capture_key()).is_ok();
            let full_ok = app.global_shortcut().register(full_key()).is_ok();
            let region_ok = app.global_shortcut().register(region_key()).is_ok();
            app.manage(capture::CaptureState::default());
            app.manage(AppState { settings: Mutex::new(s), hotkey: AtomicBool::new(claimed), capture_hotkeys: AtomicBool::new(full_ok && region_ok) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            set_settings,
            hotkey_ready,
            capture_hotkeys_ready,
            capture::capture_screen,
            capture::capture_region_start,
            capture::capture_picker_image,
            capture::capture_region,
            capture::capture_cancel,
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
