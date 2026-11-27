//! Reading and writing notes, only inside `<vault>/99 - Meta`, the one Quick Task note Tasks works on, and the few
//! folders Tom allowed for the People, Projects, Jobs and Meals tools (see `allowed`).
//!
//! Writes go to a temp file beside the note, are swapped in, then read back, so Obsidian Sync never picks up
//! half a note (the same rule as Flight Deck). Paths from the UI are relative to the vault root, with `/`.
use std::fs;
use std::path::{Component, Path, PathBuf};

use tauri::State;

use crate::AppState;

/// The folder inside the vault that Hanger may touch.
pub const META: &str = "99 - Meta";
/// The one note outside it that Hanger may touch: Flight Deck's Quick Task list.
pub const QUICK_TASK: &str = "01 - Inbox/⚡ Quick Task.md";

/// Folders outside `99 - Meta` that Hanger may use, matched from the top of the vault, ignoring case:
/// `People` and `Recipes` (at the top or one folder down, as Flight Deck finds them), any numbered `NN - Projects`,
/// and the job applications folder.
const JOBS: [&str; 4] = ["02 - area", "work", "job hunt", "applications"];

fn numbered_projects(s: &str) -> bool {
    match s.split_once('-') {
        Some((n, rest)) => !n.trim().is_empty() && n.trim().chars().all(|c| c.is_ascii_digit()) && rest.trim() == "projects",
        None => false,
    }
}

/// Whether the lower-cased path components are somewhere Hanger may touch.
fn allowed(parts: &[String]) -> bool {
    let Some(first) = parts.first() else { return false };
    if first.starts_with('.') {
        return false;
    }
    let named = |n: &str| first == n || parts.get(1).map(|s| s == n).unwrap_or(false);
    first == &META.to_lowercase()
        || named("people")
        || named("recipes")
        || numbered_projects(first)
        || (parts.len() >= JOBS.len() && parts.iter().zip(JOBS.iter()).all(|(a, b)| a == b))
}

/// Turns a vault-relative path from the UI into a real path, or says why it isn't allowed.
/// Allowed: relative, no `..`, no drive or root, and either the Quick Task note exactly or inside an allowed folder.
pub fn resolve(vault: &str, rel: &str) -> Result<PathBuf, String> {
    if vault.trim().is_empty() {
        return Err("Pick your Obsidian vault in Settings first.".into());
    }
    let rel_path = Path::new(rel);
    let clean = rel_path.components().all(|c| matches!(c, Component::Normal(_)));
    if rel.is_empty() || !clean {
        return Err(format!("Hanger can't use the path '{rel}'."));
    }
    let parts: Vec<String> = rel_path.components().map(|c| c.as_os_str().to_string_lossy().to_lowercase()).collect();
    let is_quick = rel.replace('\\', "/").to_lowercase() == QUICK_TASK.to_lowercase();
    if !allowed(&parts) && !is_quick {
        return Err(format!("Hanger only reads and writes inside {META}, the Quick Task note, and the People, Projects, Jobs and Recipes folders."));
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

/// Folder names directly inside an allowed folder, so a tool can walk `03 - Projects/<one folder per project>`.
#[tauri::command]
pub fn vault_dirs(state: State<'_, AppState>, path: String) -> Result<Vec<String>, String> {
    let p = resolve(&vault_root(&state)?, &path)?;
    if !p.exists() {
        return Ok(vec![]);
    }
    let mut names: Vec<String> = fs::read_dir(p)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|n| !n.starts_with('.'))
        .collect();
    names.sort();
    Ok(names)
}

/// Where a named folder (`People`, `Recipes`) is: at the top of the vault, else one folder down. Null if nowhere.
/// Only those two names are looked for, so this can't be used to browse the vault.
#[tauri::command]
pub fn vault_find(state: State<'_, AppState>, name: String) -> Result<Option<String>, String> {
    let root = vault_root(&state)?;
    find_folder(&root, &name)
}

pub fn find_folder(root: &str, name: &str) -> Result<Option<String>, String> {
    let lower = name.to_lowercase();
    if lower != "people" && lower != "recipes" {
        return Err(format!("Hanger can't look for '{name}'."));
    }
    if root.trim().is_empty() {
        return Err("Pick your Obsidian vault in Settings first.".into());
    }
    let mut dirs: Vec<String> = match fs::read_dir(root) {
        Ok(rd) => rd.filter_map(|e| e.ok()).filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false)).map(|e| e.file_name().to_string_lossy().into_owned()).filter(|n| !n.starts_with('.')).collect(),
        Err(e) => return Err(e.to_string()),
    };
    dirs.sort();
    if let Some(d) = dirs.iter().find(|d| d.to_lowercase() == lower) {
        return Ok(Some(d.clone()));
    }
    for d in &dirs {
        let Ok(rd) = fs::read_dir(Path::new(root).join(d)) else { continue };
        for e in rd.filter_map(|e| e.ok()) {
            if e.file_type().map(|t| t.is_dir()).unwrap_or(false) && e.file_name().to_string_lossy().to_lowercase() == lower {
                return Ok(Some(format!("{d}/{}", e.file_name().to_string_lossy())));
            }
        }
    }
    Ok(None)
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
    fn allows_the_quick_task_note_outside_meta() {
        let p = resolve("D:/Vault", "01 - Inbox/⚡ Quick Task.md").unwrap();
        assert!(p.to_string_lossy().replace('\\', "/").ends_with("Vault/01 - Inbox/⚡ Quick Task.md"));
        assert!(resolve("D:/Vault", "01 - inbox/⚡ quick task.md").is_ok());
    }

    #[test]
    fn refuses_other_folders() {
        assert!(resolve("D:/Vault", "01 - Inbox/Quick Task.md").is_err());
        assert!(resolve("D:/Vault", "01 - Inbox/⚡ Quick Task.md.bak").is_err());
        assert!(resolve("D:/Vault", "01 - Inbox/other.md").is_err());
        assert!(resolve("D:/Vault", "01 - Inbox/../99 - Meta/x.md").is_err());
        assert!(resolve("D:/Vault", "99 - Meta Extra/x.md").is_err());
    }

    #[test]
    fn allows_the_people_projects_jobs_and_recipes_folders() {
        for ok in ["People/Mum.md", "people/Mum.md", "02 - Area/People/Mum.md", "Recipes/Week 47.md", "04 - Resources/Recipes/Pasta.md", "03 - Projects/Flight Deck/Flight Deck.md", "3-projects/x.md", "02 - Area/Work/Job Hunt/Applications/Monzo.md", "02 - Area/Work/Job Hunt/Applications"] {
            assert!(resolve("D:/Vault", ok).is_ok(), "{ok}");
        }
    }

    #[test]
    fn still_refuses_the_rest_of_the_vault() {
        for bad in ["01 - Inbox/Shopping.md", "02 - Area/Work/Notes.md", "02 - Area/Work/Job Hunt/CV.md", "02 - Area/Work/Job Hunt/Applications Old/x.md", "Journal/People.md", "Journal/Daily/People/x.md", "People", ".obsidian/People/x.md", "03 - Projects Old/x.md", "Projects/x.md", "- Projects/x.md"] {
            if bad == "People" { assert!(resolve("D:/Vault", bad).is_ok()); continue; }
            assert!(resolve("D:/Vault", bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn finds_only_people_and_recipes() {
        let root = std::env::temp_dir().join(format!("hanger-find-{}", std::process::id()));
        fs::create_dir_all(root.join("02 - Area").join("People")).unwrap();
        fs::create_dir_all(root.join("Recipes")).unwrap();
        let r = root.to_string_lossy().into_owned();
        assert_eq!(find_folder(&r, "People").unwrap(), Some("02 - Area/People".to_string()));
        assert_eq!(find_folder(&r, "recipes").unwrap(), Some("Recipes".to_string()));
        assert!(find_folder(&r, "Journal").is_err());
        let _ = fs::remove_dir_all(root);
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
