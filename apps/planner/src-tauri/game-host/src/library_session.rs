//! What the planner remembers about the library between launches, in the configuration folder:
//! whether the pre-library file was offered for import. It also
//! reads the file the planner kept open before it had a library.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::atomic_file;

const SESSION_FILE: &str = "library-session.json";
/// The file the planner kept open before plans lived in the library.
const PREVIOUS_ACTIVE_FILE: &str = "active-profile.json";

#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySession {
    /// The pre-library file was offered once, and imported or declined.
    #[serde(default)]
    pub previous_file_offered: bool,
}

/// The remembered session; a missing or unreadable record is an empty one.
pub fn read(config_dir: &Path) -> LibrarySession {
    fs::read_to_string(config_dir.join(SESSION_FILE))
        .ok()
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default()
}

pub fn write(config_dir: &Path, session: &LibrarySession) -> Result<(), String> {
    fs::create_dir_all(config_dir)
        .map_err(|error| format!("Could not create the configuration folder: {error}"))?;
    let json = serde_json::to_string(session)
        .map_err(|error| format!("Could not encode the library session: {error}"))?;
    atomic_file::write(
        &config_dir.join(SESSION_FILE),
        json.as_bytes(),
        "library session",
    )
}

#[derive(Debug, Deserialize)]
struct PreviousActive {
    path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviousFile {
    pub file_name: String,
    pub json: String,
}

/// The file the planner last had open before the library, when it is still there.
pub fn previous_active_file(config_dir: &Path) -> Result<Option<PreviousFile>, String> {
    let Ok(record) = fs::read_to_string(config_dir.join(PREVIOUS_ACTIVE_FILE)) else {
        return Ok(None);
    };
    let Ok(PreviousActive { path }) = serde_json::from_str(&record) else {
        return Ok(None);
    };
    let Some(file_name) = path
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.trim().is_empty())
        .map(str::to_owned)
    else {
        return Ok(None);
    };
    if !path.is_absolute() {
        return Ok(None);
    }
    match fs::read_to_string(&path) {
        Ok(json) => Ok(Some(PreviousFile { file_name, json })),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!(
            "Could not read the previously open plan {}: {error}",
            path.display()
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static DIRECTORY_SEQUENCE: AtomicU64 = AtomicU64::new(0);

    struct TestFolder(PathBuf);

    impl TestFolder {
        fn new() -> Self {
            Self(std::env::temp_dir().join(format!(
                "run-planner-library-session-{}-{}",
                std::process::id(),
                DIRECTORY_SEQUENCE.fetch_add(1, Ordering::Relaxed)
            )))
        }
    }

    impl Drop for TestFolder {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn remembers_the_session_and_reads_a_damaged_one_as_empty() {
        let folder = TestFolder::new();
        assert_eq!(read(&folder.0), LibrarySession::default());
        let session = LibrarySession {
            previous_file_offered: true,
        };
        write(&folder.0, &session).unwrap();
        assert_eq!(read(&folder.0), session);
        fs::write(folder.0.join(SESSION_FILE), "{ broken").unwrap();
        assert_eq!(read(&folder.0), LibrarySession::default());
    }

    #[test]
    fn reads_the_previously_open_file_while_it_exists() {
        let folder = TestFolder::new();
        assert_eq!(previous_active_file(&folder.0).unwrap(), None);
        fs::create_dir_all(&folder.0).unwrap();
        let plan = folder.0.join("Surface.runplanner.json");
        let record = serde_json::json!({ "path": plan }).to_string();
        fs::write(folder.0.join(PREVIOUS_ACTIVE_FILE), record).unwrap();
        assert_eq!(previous_active_file(&folder.0).unwrap(), None);

        fs::write(&plan, "{\"route\":\"Surface\"}").unwrap();
        assert_eq!(
            previous_active_file(&folder.0).unwrap(),
            Some(PreviousFile {
                file_name: "Surface.runplanner.json".to_owned(),
                json: "{\"route\":\"Surface\"}".to_owned(),
            })
        );
        fs::write(
            folder.0.join(PREVIOUS_ACTIVE_FILE),
            "{\"path\":\"relative.json\"}",
        )
        .unwrap();
        assert_eq!(previous_active_file(&folder.0).unwrap(), None);
    }
}
