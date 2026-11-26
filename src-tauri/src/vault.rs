//! Reading and writing notes, only inside `<vault>/99 - Meta`.
//!
//! Writes go to a temp file beside the note, are swapped in, then read back, so Obsidian Sync never picks up
//! half a note (the same rule as Flight Deck). Paths from the UI are relative to the vault root, with `/`.
use std::fs;
use std::path::{Component, Path, PathBuf};

use tauri::State;

use crate::AppState;

/// The only folder inside the vault that Hanger may touch.
pub const META: &str = "99 - Meta";

/// Turns a vault-relative path from the UI into a real path, or says why it isn't allowed.
/// Allowed: relative, no `..`, no drive or root, and inside `99 - Meta`.
pub fn resolve(vault: &str, rel: &str) -> Result<PathBuf, String> {
    if vault.trim().is_empty() {
        return Err("Pick your Obsidian vault in Settings first.".into());
    }
    let rel_path = Path::new(rel);
    let clean = rel_path.components().all(|c| matches!(c, Component::Normal(_)));
    if rel.is_empty() || !clean {
        return Err(format!("Hanger can't use the path '{rel}'."));
    }
    let first = rel_path.components().next().map(|c| c.as_os_str().to_string_lossy().to_lowercase());
    if first.as_deref() != Some(&META.to_lowercase()) {
        return Err(format!("Hanger only reads and writes inside {META}."));
    }
    Ok(Path::new(vault).join(rel_path))
}

pub fn write_atomic(path: &Path, text: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let name = path.file_name().ok_or("No file name.")?.to_string_lossy().into_owned();
    let tmp = path.with_file_name(format!(".{name}.tmp"));
    fs::write(&tmp, text).map_err(|e| format!("Couldn't write the note: {e}"))?;
    // On Windows this replaces an existing file in one step (MoveFileEx with REPLACE_EXISTING).
    if let Err(e) = fs::rename(&tmp, path) {
        let _ = fs::remove_file(&tmp);
        return Err(format!("Couldn't save the note: {e}"));
    }
    match fs::read_to_string(path) {
        Ok(back) if back == text => Ok(()),
        Ok(_) => Err("The note changed while saving (a sync may have landed). Try again.".into()),
        Err(e) => Err(format!("Saved, but couldn't read the note back: {e}")),
    }
}

fn vault_root(state: &State<'_, AppState>) -> Result<String, String> {
    state.settings.lock().map(|s| s.vault.clone()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn vault_list(state: State<'_, AppState>, path: String) -> Result<Vec<String>, String> {
    let p = resolve(&vault_root(&state)?, &path)?;
    if !p.exists() {
        return Ok(vec![]);
    }
    let mut names: Vec<String> = fs::read_dir(p)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false))
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|n| !n.starts_with('.'))
        .collect();
    names.sort();
    Ok(names)
}

#[tauri::command]
pub fn vault_read(state: State<'_, AppState>, path: String) -> Result<String, String> {
    fs::read_to_string(resolve(&vault_root(&state)?, &path)?).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn vault_write(state: State<'_, AppState>, path: String, text: String) -> Result<(), String> {
    write_atomic(&resolve(&vault_root(&state)?, &path)?, &text)
}

#[tauri::command]
pub fn vault_remove(state: State<'_, AppState>, path: String) -> Result<(), String> {
    match fs::remove_file(resolve(&vault_root(&state)?, &path)?) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn vault_exists(state: State<'_, AppState>, path: String) -> Result<bool, String> {
    Ok(resolve(&vault_root(&state)?, &path)?.exists())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_notes_inside_meta() {
        let p = resolve("D:/Vault", "99 - Meta/Kits/Packing.md").unwrap();
        assert!(p.to_string_lossy().replace('\\', "/").ends_with("Vault/99 - Meta/Kits/Packing.md"));
    }

    #[test]
    fn meta_is_matched_ignoring_case() {
        assert!(resolve("D:/Vault", "99 - meta/Kits").is_ok());
    }

    #[test]
    fn refuses_other_folders() {
        assert!(resolve("D:/Vault", "01 - Inbox/Quick Task.md").is_err());
        assert!(resolve("D:/Vault", "99 - Meta Extra/x.md").is_err());
    }

    #[test]
    fn refuses_escapes_and_absolute_paths() {
        assert!(resolve("D:/Vault", "99 - Meta/../secret.md").is_err());
        assert!(resolve("D:/Vault", "../99 - Meta/x.md").is_err());
        assert!(resolve("D:/Vault", "/etc/passwd").is_err());
        assert!(resolve("D:/Vault", "").is_err());
    }

    #[test]
    fn needs_a_vault() {
        assert!(resolve("", "99 - Meta/x.md").is_err());
        assert!(resolve("  ", "99 - Meta/x.md").is_err());
    }

    #[test]
    fn writes_atomically_and_replaces() {
        let dir = std::env::temp_dir().join(format!("hanger-test-{}", std::process::id()));
        let file = dir.join("99 - Meta").join("Kits").join("A.md");
        write_atomic(&file, "one").unwrap();
        write_atomic(&file, "two").unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "two");
        assert!(!file.with_file_name(".A.md.tmp").exists());
        let _ = fs::remove_dir_all(dir);
    }
}
