//! Screenshot sorting, native side: list screenshots, read the text in one with the OCR built into Windows,
//! make a small preview, and move files. The rules for what a screenshot is and what to call it are in
//! TypeScript (src/core/sorting.ts). Nothing is ever deleted or overwritten here.
//!
//! Files are only touched inside the two folders chosen in Settings: the screenshots folder and the
//! sorted folder (so Undo can put a file back).
use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::Serialize;
use tauri::State;

use crate::AppState;

const MAX_PREVIEW_BYTES: u64 = 4_000_000;
const IMAGE_EXTENSIONS: [&str; 6] = ["png", "jpg", "jpeg", "webp", "gif", "bmp"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShotFile {
    pub path: String,
    pub name: String,
    pub mtime: i64,
}

/// True if `path` is `root` or inside it, with no `..` tricks. Case-insensitive, as Windows paths are.
pub fn within(root: &str, path: &str) -> bool {
    if root.trim().is_empty() {
        return false;
    }
    let clean = |p: &str| -> Option<Vec<String>> {
        let mut parts = Vec::new();
        for c in Path::new(p).components() {
            match c {
                Component::Normal(s) => parts.push(s.to_string_lossy().to_lowercase()),
                Component::Prefix(s) => parts.push(s.as_os_str().to_string_lossy().to_lowercase()),
                Component::RootDir | Component::CurDir => {}
                Component::ParentDir => return None,
            }
        }
        Some(parts)
    };
    match (clean(root), clean(path)) {
        (Some(r), Some(p)) => !r.is_empty() && p.len() >= r.len() && p[..r.len()] == r[..],
        _ => false,
    }
}

/// A path in `dir` for `file_name` that doesn't exist yet: "a.png", then "a (2).png", "a (3).png"…
pub fn unique_path(dir: &Path, file_name: &str) -> PathBuf {
    let first = dir.join(file_name);
    if !first.exists() {
        return first;
    }
    let (stem, ext) = match file_name.rfind('.') {
        Some(i) if i > 0 => (&file_name[..i], &file_name[i..]),
        _ => (file_name, ""),
    };
    (2..)
        .map(|n| dir.join(format!("{stem} ({n}){ext}")))
        .find(|p| !p.exists())
        .expect("an unused name")
}

/// Only plain file names: no folders, no `..`.
pub fn plain_name(name: &str) -> bool {
    !name.is_empty() && !name.contains(['/', '\\']) && name != "." && name != ".."
}

fn allowed_roots(state: &State<'_, AppState>) -> Result<(String, String), String> {
    let s = state.settings.lock().map_err(|e| e.to_string())?;
    Ok((s.sorting.screenshots.clone(), s.sorting.sorted.clone()))
}

fn check_in_roots(state: &State<'_, AppState>, path: &str) -> Result<(), String> {
    let (shots, sorted) = allowed_roots(state)?;
    if within(&shots, path) || within(&sorted, path) {
        Ok(())
    } else {
        Err("Hanger only moves files in your screenshots and sorted folders.".into())
    }
}

/// Opens the Windows snipping overlay (the same as Win+Shift+S). On Windows 11 the Snipping Tool saves each snip to
/// Pictures\Screenshots, which is where Sorting looks.
pub fn open_snip() -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        std::process::Command::new("explorer.exe")
            .arg("ms-screenclip:")
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Couldn't open the Snipping Tool: {e}"))
    }
    #[cfg(not(windows))]
    {
        Err("Snipping is a Windows feature.".into())
    }
}

#[tauri::command]
pub fn snip() -> Result<(), String> {
    open_snip()
}

/// The folders Windows normally uses, as a starting point for Settings.
#[tauri::command]
pub fn sort_defaults() -> (String, String) {
    let home = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")).unwrap_or_default();
    if home.is_empty() {
        return (String::new(), String::new());
    }
    let pics = Path::new(&home).join("Pictures");
    (
        pics.join("Screenshots").to_string_lossy().into_owned(),
        pics.join("Sorted Screenshots").to_string_lossy().into_owned(),
    )
}

#[tauri::command]
pub fn sort_list(state: State<'_, AppState>, folder: String) -> Result<Vec<ShotFile>, String> {
    let (shots, _) = allowed_roots(&state)?;
    if !within(&shots, &folder) {
        return Err("That isn't your screenshots folder.".into());
    }
    let dir = Path::new(&folder);
    if !dir.is_dir() {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    for e in fs::read_dir(dir).map_err(|e| e.to_string())?.flatten() {
        let meta = match e.metadata() {
            Ok(m) if m.is_file() => m,
            _ => continue,
        };
        let name = e.file_name().to_string_lossy().into_owned();
        let ext = Path::new(&name).extension().and_then(|x| x.to_str()).unwrap_or("").to_ascii_lowercase();
        if name.starts_with('.') || !IMAGE_EXTENSIONS.contains(&ext.as_str()) {
            continue;
        }
        let mtime = meta
            .modified()
            .ok()
            .and_then(|m| m.duration_since(std::time::UNIX_EPOCH).ok())
            .map_or(0, |d| d.as_secs() as i64);
        out.push(ShotFile { path: e.path().to_string_lossy().into_owned(), name, mtime });
    }
    Ok(out)
}

/// The lines of text in an image, top to bottom, read on this PC. Windows only; elsewhere finds no text.
#[tauri::command]
pub async fn sort_ocr(state: State<'_, AppState>, path: String) -> Result<Vec<String>, String> {
    check_in_roots(&state, &path)?;
    tauri::async_runtime::spawn_blocking(move || read_text(Path::new(&path)))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(windows)]
fn read_text(image: &Path) -> Result<Vec<String>, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    const SCRIPT: &str = include_str!("../assets/ocr.ps1");
    let script = std::env::temp_dir().join("hanger-ocr-v1.ps1");
    if fs::read_to_string(&script).ok().as_deref() != Some(SCRIPT) {
        fs::write(&script, SCRIPT).map_err(|e| format!("OCR couldn't start: {e}"))?;
    }
    let out = std::process::Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File"])
        .arg(&script)
        .arg("-Path")
        .arg(image)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("OCR couldn't start: {e}"))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(format!("OCR failed: {}", err.lines().find(|l| !l.trim().is_empty()).unwrap_or("unknown error").trim()));
    }
    parse_output(&String::from_utf8_lossy(&out.stdout))
}

#[cfg(not(windows))]
fn read_text(_image: &Path) -> Result<Vec<String>, String> {
    Ok(Vec::new())
}

/// Reads the script's `{"lines":[...]}` output. PowerShell prints a single line as a bare string.
pub fn parse_output(stdout: &str) -> Result<Vec<String>, String> {
    let s = stdout.trim().trim_start_matches('\u{feff}');
    if s.is_empty() {
        return Ok(Vec::new());
    }
    let v: serde_json::Value = serde_json::from_str(s).map_err(|_| "OCR returned something unreadable".to_string())?;
    Ok(match &v["lines"] {
        serde_json::Value::Array(a) => a.iter().filter_map(|l| l.as_str().map(String::from)).collect(),
        serde_json::Value::String(one) => vec![one.clone()],
        _ => Vec::new(),
    })
}

/// The image as a data URL for the review card, or none if it's too big.
#[tauri::command]
pub fn sort_thumb(state: State<'_, AppState>, path: String) -> Result<Option<String>, String> {
    check_in_roots(&state, &path)?;
    let p = Path::new(&path);
    let meta = fs::metadata(p).map_err(|e| e.to_string())?;
    if meta.len() > MAX_PREVIEW_BYTES {
        return Ok(None);
    }
    let ext = p.extension().and_then(|x| x.to_str()).unwrap_or("png").to_ascii_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "image/png",
    };
    use base64::Engine;
    let bytes = fs::read(p).map_err(|e| e.to_string())?;
    Ok(Some(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes))))
}

/// Moves a file into `dest_dir` under `file_name`, never overwriting: a taken name gets " (2)". Returns the new path.
#[tauri::command]
pub fn sort_move(state: State<'_, AppState>, from: String, dest_dir: String, file_name: String) -> Result<String, String> {
    check_in_roots(&state, &from)?;
    check_in_roots(&state, &dest_dir)?;
    if !plain_name(&file_name) {
        return Err("That isn't a usable file name.".into());
    }
    let src = Path::new(&from);
    if !src.is_file() {
        return Err("That screenshot isn't there any more.".into());
    }
    let dir = Path::new(&dest_dir);
    fs::create_dir_all(dir).map_err(|e| format!("Couldn't make the folder: {e}"))?;
    let to = unique_path(dir, &file_name);
    if fs::rename(src, &to).is_err() {
        // Another drive: copy, check the size, then remove the original.
        fs::copy(src, &to).map_err(|e| format!("Couldn't copy the screenshot: {e}"))?;
        let same = fs::metadata(src).map(|m| m.len()).ok() == fs::metadata(&to).map(|m| m.len()).ok();
        if !same {
            let _ = fs::remove_file(&to);
            return Err("The copy didn't match, so the original was left alone.".into());
        }
        fs::remove_file(src).map_err(|e| format!("Copied, but couldn't remove the original: {e}"))?;
    }
    Ok(to.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn within_matches_the_folder_and_what_is_below_it() {
        assert!(within("C:/Pics", "C:/Pics/a.png"));
        assert!(within("C:/Pics", "c:/pics/Sub/a.png"));
        assert!(within("C:/Pics", "C:/Pics"));
        assert!(!within("C:/Pics", "C:/Pics2/a.png"));
        assert!(!within("C:/Pics", "C:/Other/a.png"));
    }

    #[test]
    fn within_refuses_escapes_and_empty_roots() {
        assert!(!within("C:/Pics", "C:/Pics/../Secret/a.png"));
        assert!(!within("", "C:/Pics/a.png"));
        assert!(!within("   ", "C:/Pics/a.png"));
    }

    #[test]
    fn plain_names_only() {
        assert!(plain_name("2026-10-31 Figma – Onboarding.png"));
        assert!(!plain_name("../a.png"));
        assert!(!plain_name("sub/a.png"));
        assert!(!plain_name("sub\\a.png"));
        assert!(!plain_name(""));
        assert!(!plain_name(".."));
    }

    #[test]
    fn unique_path_never_reuses_a_name() {
        let dir = std::env::temp_dir().join(format!("hanger-sort-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("a.png"), "1").unwrap();
        assert_eq!(unique_path(&dir, "a.png"), dir.join("a (2).png"));
        fs::write(dir.join("a (2).png"), "2").unwrap();
        assert_eq!(unique_path(&dir, "a.png"), dir.join("a (3).png"));
        assert_eq!(unique_path(&dir, "b.png"), dir.join("b.png"));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn parses_script_output() {
        assert_eq!(parse_output("{\"lines\":[\"Figma\",\"Layers\"]}\r\n").unwrap(), vec!["Figma", "Layers"]);
        assert_eq!(parse_output("{\"lines\":\"Only one\"}").unwrap(), vec!["Only one"]);
        assert!(parse_output("").unwrap().is_empty());
        assert!(parse_output("oops").is_err());
    }
}
