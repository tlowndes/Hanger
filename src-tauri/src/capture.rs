//! Screenshot capture. Ctrl Shift 3 takes the whole screen under the pointer; Ctrl Shift 4 freezes that screen,
//! lets you drag a region over it, and takes just that. Either way the picture is saved as a PNG in the
//! screenshots folder (so Sorting finds it) and copied to the clipboard. Windows only; elsewhere it says so.
use std::io::Cursor;
use std::path::PathBuf;
use std::sync::Mutex;

use image::RgbaImage;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

use crate::AppState;

const PICKER: &str = "picker";

/// The frozen screen a region is being chosen from.
pub struct Pending {
    img: RgbaImage,
}

#[derive(Default)]
pub struct CaptureState {
    pending: Mutex<Option<Pending>>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Saved {
    pub path: String,
    /// False when the picture was saved but the clipboard refused it.
    pub copied: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickerImage {
    pub data_url: String,
    pub width: u32,
    pub height: u32,
}

/// Turns a rectangle drawn in the picker (in the window's own units) into pixels of the captured image.
/// Returns (x, y, width, height), clamped to the image, or None if there's nothing to take.
pub fn crop_rect(x: f64, y: f64, w: f64, h: f64, view_w: f64, view_h: f64, img_w: u32, img_h: u32) -> Option<(u32, u32, u32, u32)> {
    if !(view_w > 0.0 && view_h > 0.0) || [x, y, w, h].iter().any(|v| !v.is_finite()) {
        return None;
    }
    let (sx, sy) = (img_w as f64 / view_w, img_h as f64 / view_h);
    let left = (x.min(x + w) * sx).round().clamp(0.0, img_w as f64);
    let top = (y.min(y + h) * sy).round().clamp(0.0, img_h as f64);
    let right = (x.max(x + w) * sx).round().clamp(0.0, img_w as f64);
    let bottom = (y.max(y + h) * sy).round().clamp(0.0, img_h as f64);
    let (cw, ch) = (right - left, bottom - top);
    if cw < 1.0 || ch < 1.0 {
        return None;
    }
    Some((left as u32, top as u32, cw as u32, ch as u32))
}

fn screenshots_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let state = app.state::<AppState>();
    let chosen = state.settings.lock().map_err(|e| e.to_string())?.sorting.screenshots.clone();
    if !chosen.trim().is_empty() {
        return Ok(PathBuf::from(chosen));
    }
    crate::sorting::default_screenshots_dir().ok_or_else(|| "Couldn't find your Pictures folder.".to_string())
}

/// Saves the picture as "Screenshot 2026-11-26 181530.png" (a name Sorting reads the date from) and copies it.
fn save_and_copy(app: &AppHandle, img: &RgbaImage) -> Result<Saved, String> {
    let dir = screenshots_dir(app)?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Couldn't make the screenshots folder: {e}"))?;
    let name = format!("Screenshot {}.png", chrono::Local::now().format("%Y-%m-%d %H%M%S"));
    let path = crate::sorting::unique_path(&dir, &name);
    img.save_with_format(&path, image::ImageFormat::Png).map_err(|e| format!("Couldn't save the screenshot: {e}"))?;
    let copied = copy_to_clipboard(img);
    let saved = Saved { path: path.to_string_lossy().into_owned(), copied };
    let _ = app.emit("capture-saved", saved.clone());
    Ok(saved)
}

#[cfg(windows)]
fn copy_to_clipboard(img: &RgbaImage) -> bool {
    arboard::Clipboard::new()
        .and_then(|mut c| {
            c.set_image(arboard::ImageData { width: img.width() as usize, height: img.height() as usize, bytes: std::borrow::Cow::Borrowed(img.as_raw()) })
        })
        .is_ok()
}

#[cfg(not(windows))]
fn copy_to_clipboard(_img: &RgbaImage) -> bool {
    false
}

/// The screen under the pointer, as a picture.
#[cfg(windows)]
fn grab_screen(app: &AppHandle) -> Result<RgbaImage, String> {
    let (x, y) = app.cursor_position().map(|p| (p.x as i32, p.y as i32)).unwrap_or((0, 0));
    let monitor = xcap::Monitor::from_point(x, y).map_err(|e| format!("Couldn't find the screen: {e}"))?;
    monitor.capture_image().map_err(|e| format!("Couldn't capture the screen: {e}"))
}

#[cfg(not(windows))]
fn grab_screen(_app: &AppHandle) -> Result<RgbaImage, String> {
    Err("Screenshots are a Windows feature.".into())
}

/// Where the screen under the pointer sits on the desktop, in physical pixels: x, y, width, height.
#[cfg(windows)]
fn screen_bounds(app: &AppHandle) -> Result<(i32, i32, u32, u32), String> {
    let (x, y) = app.cursor_position().map(|p| (p.x as i32, p.y as i32)).unwrap_or((0, 0));
    let m = xcap::Monitor::from_point(x, y).map_err(|e| format!("Couldn't find the screen: {e}"))?;
    let g = |r: xcap::XCapResult<i32>| r.map_err(|e| e.to_string());
    Ok((g(m.x())?, g(m.y())?, m.width().map_err(|e| e.to_string())?, m.height().map_err(|e| e.to_string())?))
}

#[cfg(not(windows))]
fn screen_bounds(_app: &AppHandle) -> Result<(i32, i32, u32, u32), String> {
    Err("Screenshots are a Windows feature.".into())
}

/// The whole screen under the pointer, saved and copied. Blocking: call off the main thread.
pub fn capture_screen_now(app: &AppHandle) -> Result<Saved, String> {
    let img = grab_screen(app)?;
    save_and_copy(app, &img)
}

fn close_picker(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(PICKER) {
        let _ = w.close();
    }
}

/// Freezes the screen under the pointer and opens the region picker over it. Blocking: call off the main thread.
pub fn start_region_now(app: &AppHandle) -> Result<(), String> {
    close_picker(app);
    let (x, y, w, h) = screen_bounds(app)?;
    let img = grab_screen(app)?;
    *app.state::<CaptureState>().pending.lock().map_err(|e| e.to_string())? = Some(Pending { img });
    let win = WebviewWindowBuilder::new(app, PICKER, WebviewUrl::App("index.html?picker=1".into()))
        .title("Hanger capture")
        .decorations(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(false)
        .visible(false)
        .build()
        .map_err(|e| format!("Couldn't open the picker: {e}"))?;
    // Physical pixels, so it covers the screen exactly whatever the display scaling.
    let _ = win.set_position(tauri::PhysicalPosition::new(x, y));
    let _ = win.set_size(tauri::PhysicalSize::new(w, h));
    let _ = win.show();
    let _ = win.set_focus();
    Ok(())
}

#[tauri::command]
pub async fn capture_screen(app: AppHandle) -> Result<Saved, String> {
    tauri::async_runtime::spawn_blocking(move || capture_screen_now(&app)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn capture_region_start(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || start_region_now(&app)).await.map_err(|e| e.to_string())?
}

/// The frozen screen for the picker to show, as a JPEG data URL (it's only for looking at).
#[tauri::command]
pub fn capture_picker_image(state: State<'_, CaptureState>) -> Result<Option<PickerImage>, String> {
    let guard = state.pending.lock().map_err(|e| e.to_string())?;
    let Some(p) = guard.as_ref() else { return Ok(None) };
    let rgb = image::DynamicImage::ImageRgba8(p.img.clone()).to_rgb8();
    let mut bytes = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut Cursor::new(&mut bytes), 88)
        .encode_image(&rgb)
        .map_err(|e| e.to_string())?;
    use base64::Engine;
    Ok(Some(PickerImage {
        data_url: format!("data:image/jpeg;base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)),
        width: p.img.width(),
        height: p.img.height(),
    }))
}

/// Takes the dragged region (in the picker's own units, with the picker's size so it can be scaled to pixels).
/// The picker stays open so it can show "Copied"; it closes itself with `capture_cancel`.
#[tauri::command]
pub fn capture_region(app: AppHandle, state: State<'_, CaptureState>, x: f64, y: f64, w: f64, h: f64, view_w: f64, view_h: f64) -> Result<Saved, String> {
    let img = {
        let guard = state.pending.lock().map_err(|e| e.to_string())?;
        let p = guard.as_ref().ok_or("The frozen screen is gone. Try again.")?;
        let (cx, cy, cw, ch) = crop_rect(x, y, w, h, view_w, view_h, p.img.width(), p.img.height()).ok_or("Nothing was selected.")?;
        image::imageops::crop_imm(&p.img, cx, cy, cw, ch).to_image()
    };
    save_and_copy(&app, &img)
}

/// Closes the picker and forgets the frozen screen.
#[tauri::command]
pub fn capture_cancel(app: AppHandle, state: State<'_, CaptureState>) {
    if let Ok(mut g) = state.pending.lock() {
        *g = None;
    }
    close_picker(&app);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scales_a_drag_to_pixels() {
        // A 3840x2160 screen shown in a 1920x1080 window: everything doubles.
        assert_eq!(crop_rect(100.0, 50.0, 200.0, 100.0, 1920.0, 1080.0, 3840, 2160), Some((200, 100, 400, 200)));
    }

    #[test]
    fn a_drag_up_and_left_still_works() {
        assert_eq!(crop_rect(300.0, 150.0, -200.0, -100.0, 1920.0, 1080.0, 1920, 1080), Some((100, 50, 200, 100)));
    }

    #[test]
    fn clamps_to_the_picture() {
        assert_eq!(crop_rect(-50.0, -50.0, 2100.0, 1200.0, 1920.0, 1080.0, 1920, 1080), Some((0, 0, 1920, 1080)));
    }

    #[test]
    fn nothing_selected_is_none() {
        assert_eq!(crop_rect(10.0, 10.0, 0.4, 30.0, 1920.0, 1080.0, 1920, 1080), None);
        assert_eq!(crop_rect(10.0, 10.0, 30.0, 30.0, 0.0, 1080.0, 1920, 1080), None);
        assert_eq!(crop_rect(f64::NAN, 10.0, 30.0, 30.0, 1920.0, 1080.0, 1920, 1080), None);
    }
}
