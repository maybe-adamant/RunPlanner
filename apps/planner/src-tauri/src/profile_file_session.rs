use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;
use tauri_plugin_fs::FsExt;

use crate::atomic_file;

const ACTIVE_PROFILE_FILE: &str = "active-profile.json";

#[derive(Debug, Deserialize, Serialize)]
struct ActiveProfile {
    path: PathBuf,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RestoredProfileFile {
    file_name: String,
    json: String,
}

fn session_file(config_dir: &Path) -> PathBuf {
    config_dir.join(ACTIVE_PROFILE_FILE)
}

fn profile_file_name(path: &Path) -> Result<String, String> {
    path.file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.trim().is_empty())
        .map(str::to_owned)
        .ok_or_else(|| "active profile path must identify a UTF-8 file name".to_owned())
}

fn validate_profile_path(path: PathBuf) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err("active profile path must be absolute".to_owned());
    }
    profile_file_name(&path)?;
    Ok(path)
}

fn read_active_path(config_dir: &Path) -> Result<Option<PathBuf>, String> {
    let file = session_file(config_dir);
    let json = match fs::read_to_string(&file) {
        Ok(json) => json,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(format!(
                "could not read active profile metadata {}: {error}",
                file.display()
            ));
        }
    };
    let stored: ActiveProfile = serde_json::from_str(&json).map_err(|error| {
        format!(
            "active profile metadata {} is malformed: {error}",
            file.display()
        )
    })?;
    validate_profile_path(stored.path).map(Some)
}

fn write_active_path(config_dir: &Path, path: PathBuf) -> Result<(), String> {
    let path = validate_profile_path(path)?;
    fs::create_dir_all(config_dir).map_err(|error| {
        format!(
            "could not create profile-session directory {}: {error}",
            config_dir.display()
        )
    })?;
    let file = session_file(config_dir);
    let json = serde_json::to_string(&ActiveProfile { path })
        .map_err(|error| format!("could not encode active profile metadata: {error}"))?;
    atomic_file::write(&file, json.as_bytes(), "active profile metadata")
}

fn clear_active_path(config_dir: &Path) -> Result<(), String> {
    let file = session_file(config_dir);
    match fs::remove_file(&file) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "could not clear active profile metadata {}: {error}",
            file.display()
        )),
    }
}

fn restore_active(config_dir: &Path) -> Result<Option<RestoredProfileFile>, String> {
    let path = match read_active_path(config_dir) {
        Ok(path) => path,
        Err(error) => {
            let _ = clear_active_path(config_dir);
            return Err(error);
        }
    };
    let Some(path) = path else {
        return Ok(None);
    };
    let file_name = profile_file_name(&path)?;
    match fs::read_to_string(&path) {
        Ok(json) => Ok(Some(RestoredProfileFile { file_name, json })),
        Err(error) => {
            clear_active_path(config_dir)?;
            Err(format!(
                "could not reopen active profile {}: {error}",
                path.display()
            ))
        }
    }
}

fn write_active_profile(config_dir: &Path, json: &str) -> Result<(), String> {
    let path = read_active_path(config_dir)?
        .ok_or_else(|| "no active profile file is remembered".to_owned())?;
    atomic_file::write(&path, json.as_bytes(), "active profile")
}

fn app_config_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|error| format!("could not resolve application config directory: {error}"))
}

#[tauri::command]
pub(crate) fn profile_file_restore_active(
    app: tauri::AppHandle,
) -> Result<Option<RestoredProfileFile>, String> {
    restore_active(&app_config_dir(&app)?)
}

#[tauri::command]
pub(crate) fn profile_file_activate(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let path = validate_profile_path(PathBuf::from(path))?;
    if !app.fs_scope().is_allowed(&path) {
        return Err("active profile path was not selected through a native file dialog".to_owned());
    }
    write_active_path(&app_config_dir(&app)?, path)
}

#[tauri::command]
pub(crate) fn profile_file_clear_active(app: tauri::AppHandle) -> Result<(), String> {
    clear_active_path(&app_config_dir(&app)?)
}

#[tauri::command]
pub(crate) fn profile_file_write_active(app: tauri::AppHandle, json: String) -> Result<(), String> {
    write_active_profile(&app_config_dir(&app)?, &json)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static DIRECTORY_SEQUENCE: AtomicU64 = AtomicU64::new(0);

    fn test_directory() -> PathBuf {
        std::env::temp_dir().join(format!(
            "run-planner-profile-session-{}-{}",
            std::process::id(),
            DIRECTORY_SEQUENCE.fetch_add(1, Ordering::Relaxed)
        ))
    }

    #[test]
    fn activates_restores_writes_and_clears_one_profile() {
        let root = test_directory();
        let config = root.join("config");
        let profile = root.join("surface.runplanner.json");
        fs::create_dir_all(&root).expect("create test directory");
        fs::write(&profile, "{\"route\":\"Surface\"}").expect("write profile");

        write_active_path(&config, profile.clone()).expect("activate profile");
        let restored = restore_active(&config)
            .expect("restore profile")
            .expect("active profile");
        assert_eq!(restored.file_name, "surface.runplanner.json");
        assert_eq!(restored.json, "{\"route\":\"Surface\"}");

        write_active_profile(&config, "{\"route\":\"updated\"}").expect("write active profile");
        assert_eq!(
            fs::read_to_string(&profile).expect("read updated profile"),
            "{\"route\":\"updated\"}"
        );

        clear_active_path(&config).expect("clear profile");
        assert!(restore_active(&config)
            .expect("restore cleared profile")
            .is_none());
        fs::remove_dir_all(&root).expect("remove test directory");
    }

    #[test]
    fn missing_profile_clears_the_stale_association() {
        let root = test_directory();
        let config = root.join("config");
        let missing = root.join("missing.runplanner.json");
        write_active_path(&config, missing).expect("activate missing profile");

        assert!(restore_active(&config)
            .expect_err("missing profile must fail")
            .contains("could not reopen active profile"));
        assert!(read_active_path(&config)
            .expect("read cleared association")
            .is_none());
        fs::remove_dir_all(&root).expect("remove test directory");
    }
}
