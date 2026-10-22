//! The project library: a visible folder of plain `.runplanner.json` files, one per plan.
//!
//! Files are addressed by their name inside the folder. The host reads only the head of a
//! document (identity, name, route summary); it never edits project content, so identity
//! changes arrive as complete documents from the planner.

use serde::de::IgnoredAny;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use crate::atomic_file;

pub const PROJECT_FILE_SUFFIX: &str = ".runplanner.json";
/// Longest plan-name part of a file name, in characters.
const FILE_NAME_STEM_MAX: usize = 60;
const FALLBACK_STEM: &str = "Plan";

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoadoutHead {
    #[serde(default)]
    weapon_key: Option<String>,
    #[serde(default)]
    aspect_key: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RouteHead {
    #[serde(default)]
    route_key: Option<String>,
    #[serde(default)]
    loadout: Option<LoadoutHead>,
    #[serde(default)]
    biomes: Option<Vec<IgnoredAny>>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DocumentHead {
    #[serde(default)]
    schema_version: Option<u64>,
    #[serde(default)]
    schema_revision: Option<u64>,
    #[serde(default)]
    project_id: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    route: Option<RouteHead>,
}

/// What the library shows for one file without opening it as a project.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub schema_version: Option<u64>,
    pub schema_revision: Option<u64>,
    pub project_id: Option<String>,
    pub name: Option<String>,
    pub route_key: Option<String>,
    pub weapon_key: Option<String>,
    pub aspect_key: Option<String>,
    pub biome_count: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum EntryContent {
    /// The file is a JSON object; whether the planner can open it is its own decision.
    Summarized { summary: ProjectSummary },
    /// The file could not be read or is not a JSON document.
    Unreadable { message: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryEntry {
    /// The file name inside the library folder; it changes when the plan is renamed.
    pub key: String,
    pub modified_ms: u64,
    pub content: EntryContent,
}

/// Moves files to the platform's recycle bin.
pub trait Recycler {
    fn recycle(&mut self, path: &Path) -> Result<(), String>;
}

pub struct NativeRecycler;

impl Recycler for NativeRecycler {
    fn recycle(&mut self, path: &Path) -> Result<(), String> {
        trash::delete(path)
            .map_err(|error| format!("Could not move the plan to the trash: {error}"))
    }
}

fn read_head(json: &str) -> Result<ProjectSummary, String> {
    if !json.trim_start().starts_with('{') {
        return Err("Not a plan file: the content is not a JSON object.".to_owned());
    }
    let head: DocumentHead =
        serde_json::from_str(json).map_err(|error| format!("Not a plan file: {error}"))?;
    let route = head.route.unwrap_or_default();
    let loadout = route.loadout.unwrap_or_default();
    Ok(ProjectSummary {
        schema_version: head.schema_version,
        schema_revision: head.schema_revision,
        project_id: head.project_id,
        name: head.name,
        route_key: route.route_key,
        weapon_key: loadout.weapon_key,
        aspect_key: loadout.aspect_key,
        biome_count: route.biomes.map(|biomes| biomes.len() as u64),
    })
}

/// The identity and name a written document must carry to be filed.
fn filed_identity(json: &str) -> Result<(String, String), String> {
    let summary = read_head(json)?;
    let project_id = summary
        .project_id
        .filter(|id| !id.trim().is_empty())
        .ok_or("The plan has no project identity.")?;
    let name = summary
        .name
        .filter(|name| !name.trim().is_empty())
        .ok_or("The plan has no name.")?;
    Ok((project_id, name))
}

fn is_reserved_windows_name(stem: &str) -> bool {
    let upper = stem.to_ascii_uppercase();
    let base = upper.split('.').next().unwrap_or("");
    matches!(base, "CON" | "PRN" | "AUX" | "NUL")
        || (base.len() == 4
            && (base.starts_with("COM") || base.starts_with("LPT"))
            && base.as_bytes()[3].is_ascii_digit())
}

/// A plan name made safe as a file-name part on every desktop platform.
fn file_stem(name: &str) -> String {
    let replaced: String = name
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => ' ',
            character if character.is_control() => ' ',
            character => character,
        })
        .collect();
    let collapsed = replaced.split_whitespace().collect::<Vec<_>>().join(" ");
    let bounded: String = collapsed.chars().take(FILE_NAME_STEM_MAX).collect();
    let trimmed = bounded.trim_matches(|c: char| c == '.' || c.is_whitespace());
    if trimmed.is_empty() {
        FALLBACK_STEM.to_owned()
    } else if is_reserved_windows_name(trimmed) {
        format!("_{trimmed}")
    } else {
        trimmed.to_owned()
    }
}

/// Eight hex digits that tell apart plans of the same name; independent of the id's format.
fn short_id(project_id: &str) -> String {
    Sha256::digest(project_id.as_bytes())[..4]
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// The file name a plan of this name and identity is filed under.
pub fn file_name_for(name: &str, project_id: &str) -> String {
    format!(
        "{} ({}){PROJECT_FILE_SUFFIX}",
        file_stem(name),
        short_id(project_id)
    )
}

fn is_library_file_name(name: &str) -> bool {
    name.len() > PROJECT_FILE_SUFFIX.len()
        && name.to_ascii_lowercase().ends_with(PROJECT_FILE_SUFFIX)
        && !name.starts_with('.')
}

/// The path of a library file, refusing anything but a plain file name in the folder.
fn entry_path(folder: &Path, key: &str) -> Result<PathBuf, String> {
    let plain = Path::new(key)
        .file_name()
        .is_some_and(|name| name == std::ffi::OsStr::new(key));
    if !plain || key.contains(['/', '\\']) || !is_library_file_name(key) {
        return Err(format!("{key} is not a plan in the library."));
    }
    Ok(folder.join(key))
}

fn modified_ms(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |duration| duration.as_millis() as u64)
}

fn entry(folder: &Path, key: String) -> LibraryEntry {
    let path = folder.join(&key);
    let content = match fs::read_to_string(&path) {
        Ok(json) => match read_head(&json) {
            Ok(summary) => EntryContent::Summarized { summary },
            Err(message) => EntryContent::Unreadable { message },
        },
        Err(error) => EntryContent::Unreadable {
            message: format!("Could not read the file: {error}"),
        },
    };
    LibraryEntry {
        modified_ms: modified_ms(&path),
        key,
        content,
    }
}

pub fn ensure_folder(folder: &Path) -> Result<(), String> {
    fs::create_dir_all(folder).map_err(|error| {
        format!(
            "Could not create the library folder {}: {error}",
            folder.display()
        )
    })
}

/// Every plan file in the folder, unreadable ones included, ordered by file name.
pub fn list(folder: &Path) -> Result<Vec<LibraryEntry>, String> {
    ensure_folder(folder)?;
    let mut keys = Vec::new();
    for item in fs::read_dir(folder)
        .map_err(|error| format!("Could not read the library folder: {error}"))?
    {
        let item = item.map_err(|error| format!("Could not read the library folder: {error}"))?;
        let Ok(name) = item.file_name().into_string() else {
            continue;
        };
        if is_library_file_name(&name) && item.file_type().is_ok_and(|kind| kind.is_file()) {
            keys.push(name);
        }
    }
    keys.sort();
    Ok(keys.into_iter().map(|key| entry(folder, key)).collect())
}

pub fn read(folder: &Path, key: &str) -> Result<String, String> {
    let path = entry_path(folder, key)?;
    fs::read_to_string(&path).map_err(|error| format!("Could not read {key}: {error}"))
}

/// Files a new plan under the name its document carries; never replaces another file.
pub fn create(folder: &Path, json: &str) -> Result<LibraryEntry, String> {
    let (project_id, name) = filed_identity(json)?;
    ensure_folder(folder)?;
    let key = file_name_for(&name, &project_id);
    let path = folder.join(&key);
    if path.exists() {
        return Err(format!("{key} is already in the library."));
    }
    atomic_file::write(&path, json.as_bytes(), "plan")?;
    Ok(entry(folder, key))
}

/// Replaces a plan's file atomically; a changed name or identity also renames the file.
pub fn write(folder: &Path, key: &str, json: &str) -> Result<LibraryEntry, String> {
    let path = entry_path(folder, key)?;
    let (project_id, name) = filed_identity(json)?;
    let previous = fs::read_to_string(&path)
        .ok()
        .and_then(|previous| filed_identity(&previous).ok());
    ensure_folder(folder)?;
    atomic_file::write(&path, json.as_bytes(), "plan")?;
    let renamed = file_name_for(&name, &project_id);
    let refiled = previous.is_some_and(|(previous_id, previous_name)| {
        file_name_for(&previous_name, &previous_id) != renamed
    });
    if refiled && renamed != key && !folder.join(&renamed).exists() {
        fs::rename(&path, folder.join(&renamed))
            .map_err(|error| format!("Could not rename {key}: {error}"))?;
        return Ok(entry(folder, renamed));
    }
    Ok(entry(folder, key.to_owned()))
}

pub fn delete(folder: &Path, key: &str, recycler: &mut impl Recycler) -> Result<(), String> {
    let path = entry_path(folder, key)?;
    if !path.is_file() {
        return Err(format!("{key} is not in the library."));
    }
    recycler.recycle(&path)
}

/// Sends a copy of a plan file, as it is now, to the recycle bin beside its original name,
/// so a plan from an older schema can be recovered after the planner rewrites it.
pub fn preserve_original(
    folder: &Path,
    key: &str,
    recycler: &mut impl Recycler,
) -> Result<(), String> {
    let path = entry_path(folder, key)?;
    let json =
        fs::read_to_string(&path).map_err(|error| format!("Could not read {key}: {error}"))?;
    let schema = read_head(&json)
        .ok()
        .and_then(|summary| summary.schema_version)
        .map_or_else(
            || "older schema".to_owned(),
            |version| format!("schema {version}"),
        );
    let stem = &key[..key.len() - PROJECT_FILE_SUFFIX.len()];
    let copy = (1..)
        .map(|attempt| {
            let suffix = if attempt == 1 {
                String::new()
            } else {
                format!(" {attempt}")
            };
            folder.join(format!(
                "{stem} ({schema} original{suffix}){PROJECT_FILE_SUFFIX}"
            ))
        })
        .find(|candidate| !candidate.exists())
        .ok_or("Could not name the original copy.")?;
    fs::copy(&path, &copy).map_err(|error| format!("Could not copy {key}: {error}"))?;
    let recycled = recycler.recycle(&copy);
    if recycled.is_err() {
        let _ = fs::remove_file(&copy);
    }
    recycled
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::atomic::{AtomicU64, Ordering};

    static DIRECTORY_SEQUENCE: AtomicU64 = AtomicU64::new(0);

    struct TestFolder(PathBuf);

    impl TestFolder {
        fn new() -> Self {
            Self(std::env::temp_dir().join(format!(
                "run-planner-library-{}-{}",
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

    /// Keeps recycled files in memory, as the platform bin keeps them out of the folder.
    #[derive(Default)]
    struct MemoryRecycler(HashMap<PathBuf, Vec<u8>>);

    impl Recycler for MemoryRecycler {
        fn recycle(&mut self, path: &Path) -> Result<(), String> {
            let bytes = fs::read(path).map_err(|error| error.to_string())?;
            fs::remove_file(path).map_err(|error| error.to_string())?;
            self.0.insert(path.to_owned(), bytes);
            Ok(())
        }
    }

    fn plan(id: &str, name: &str) -> String {
        format!(
            r#"{{"schemaVersion":98,"projectId":"{id}","name":"{name}","catalogVersion":"c","route":{{"routeKey":"Surface","loadout":{{"weaponKey":"WeaponStaffSwing","aspectKey":"BaseStaffAspect"}},"biomes":[{{"biomeKey":"N"}},{{"biomeKey":"O"}}]}}}}"#
        )
    }

    fn summary(entry: &LibraryEntry) -> &ProjectSummary {
        match &entry.content {
            EntryContent::Summarized { summary } => summary,
            EntryContent::Unreadable { message } => panic!("unreadable: {message}"),
        }
    }

    #[test]
    fn files_a_plan_under_its_name_and_a_short_identity() {
        let folder = TestFolder::new();
        let created = create(&folder.0, &plan("run-plan-a", "Surface run")).unwrap();
        assert_eq!(created.key, file_name_for("Surface run", "run-plan-a"));
        assert!(created.key.starts_with("Surface run ("));
        assert!(created.key.ends_with(").runplanner.json"));
        assert_eq!(
            summary(&created),
            &ProjectSummary {
                schema_version: Some(98),
                schema_revision: None,
                project_id: Some("run-plan-a".to_owned()),
                name: Some("Surface run".to_owned()),
                route_key: Some("Surface".to_owned()),
                weapon_key: Some("WeaponStaffSwing".to_owned()),
                aspect_key: Some("BaseStaffAspect".to_owned()),
                biome_count: Some(2),
            }
        );
        assert_eq!(
            read(&folder.0, &created.key).unwrap(),
            plan("run-plan-a", "Surface run")
        );
        assert!(create(&folder.0, &plan("run-plan-a", "Surface run"))
            .unwrap_err()
            .contains("already in the library"));
        assert_ne!(
            file_name_for("Surface run", "run-plan-a"),
            file_name_for("Surface run", "run-plan-b")
        );
    }

    #[test]
    fn makes_any_name_a_portable_file_name() {
        assert_eq!(
            file_stem("  a/b\\c:d*e?f\"g<h>i|j  "),
            "a b c d e f g h i j"
        );
        assert_eq!(file_stem("tab\there\nline"), "tab here line");
        assert_eq!(file_stem("..."), FALLBACK_STEM);
        assert_eq!(file_stem("Trailing dots..."), "Trailing dots");
        assert_eq!(file_stem("con"), "_con");
        assert_eq!(file_stem("COM1.plan"), "_COM1.plan");
        assert_eq!(file_stem("Compass"), "Compass");
        assert_eq!(
            file_stem(&"é".repeat(100)).chars().count(),
            FILE_NAME_STEM_MAX
        );
        assert_eq!(file_stem("Nyx's Night ✦"), "Nyx's Night ✦");
    }

    #[test]
    fn writes_in_place_and_renames_only_when_the_name_changes() {
        let folder = TestFolder::new();
        let created = create(&folder.0, &plan("run-plan-a", "First")).unwrap();
        let edited = plan("run-plan-a", "First").replace("Surface", "Underworld");
        let kept = write(&folder.0, &created.key, &edited).unwrap();
        assert_eq!(kept.key, created.key);
        assert_eq!(summary(&kept).route_key.as_deref(), Some("Underworld"));

        let renamed = write(&folder.0, &created.key, &plan("run-plan-a", "Second")).unwrap();
        assert_eq!(renamed.key, file_name_for("Second", "run-plan-a"));
        assert!(!folder.0.join(&created.key).exists());
        assert_eq!(list(&folder.0).unwrap(), vec![renamed.clone()]);

        // A file the user renamed keeps its name until the plan itself is renamed.
        fs::rename(
            folder.0.join(&renamed.key),
            folder.0.join("mine.runplanner.json"),
        )
        .unwrap();
        let untouched = write(
            &folder.0,
            "mine.runplanner.json",
            &plan("run-plan-a", "Second"),
        )
        .unwrap();
        assert_eq!(untouched.key, "mine.runplanner.json");

        let reidentified = write(
            &folder.0,
            "mine.runplanner.json",
            &plan("run-plan-b", "Second"),
        )
        .unwrap();
        assert_eq!(reidentified.key, file_name_for("Second", "run-plan-b"));
    }

    #[test]
    fn a_rename_never_replaces_another_file() {
        let folder = TestFolder::new();
        let first = create(&folder.0, &plan("run-plan-a", "First")).unwrap();
        let occupied = file_name_for("Taken", "run-plan-a");
        fs::write(folder.0.join(&occupied), "{}").unwrap();
        let written = write(&folder.0, &first.key, &plan("run-plan-a", "Taken")).unwrap();
        assert_eq!(written.key, first.key);
        assert_eq!(fs::read_to_string(folder.0.join(&occupied)).unwrap(), "{}");
    }

    #[test]
    fn refuses_documents_without_identity_or_name_and_keys_outside_the_folder() {
        let folder = TestFolder::new();
        assert!(create(&folder.0, r#"{"name":"x"}"#)
            .unwrap_err()
            .contains("project identity"));
        assert!(create(&folder.0, r#"{"projectId":"a","name":" "}"#)
            .unwrap_err()
            .contains("no name"));
        for key in [
            "../escape.runplanner.json",
            "sub/plan.runplanner.json",
            "a\\b.runplanner.json",
            ".hidden.runplanner.json",
            "plan.json",
            ".runplanner.json",
        ] {
            assert!(read(&folder.0, key).is_err(), "{key} must be refused");
            assert!(
                write(&folder.0, key, &plan("a", "x")).is_err(),
                "{key} must be refused"
            );
        }
    }

    #[test]
    fn lists_unreadable_files_and_ignores_everything_else() {
        let folder = TestFolder::new();
        let good = create(&folder.0, &plan("run-plan-a", "Good")).unwrap();
        fs::write(folder.0.join("broken.runplanner.json"), "{ not json").unwrap();
        fs::write(folder.0.join("array.runplanner.json"), "[1]").unwrap();
        fs::write(
            folder.0.join("future.runplanner.json"),
            r#"{"schemaVersion":120,"projectId":"f","name":"Future","route":{"shape":"new"}}"#,
        )
        .unwrap();
        fs::write(folder.0.join("notes.txt"), "x").unwrap();
        fs::write(folder.0.join(".plan.runplanner.json.1.0.tmp"), "x").unwrap();
        fs::create_dir(folder.0.join("folder.runplanner.json")).unwrap();

        let entries = list(&folder.0).unwrap();
        let keys: Vec<_> = entries.iter().map(|entry| entry.key.as_str()).collect();
        assert_eq!(
            keys,
            vec![
                good.key.as_str(),
                "array.runplanner.json",
                "broken.runplanner.json",
                "future.runplanner.json"
            ]
        );
        assert!(matches!(
            entries[1].content,
            EntryContent::Unreadable { .. }
        ));
        assert!(matches!(
            entries[2].content,
            EntryContent::Unreadable { .. }
        ));
        let future = summary(&entries[3]);
        assert_eq!(future.schema_version, Some(120));
        assert_eq!(future.project_id.as_deref(), Some("f"));
        assert_eq!(future.biome_count, None);
        assert!(entries.iter().all(|entry| entry.modified_ms > 0));
    }

    #[test]
    fn lists_an_absent_folder_as_empty_after_creating_it() {
        let folder = TestFolder::new();
        let nested = folder.0.join("RunPlanner").join("Projects");
        assert!(list(&nested).unwrap().is_empty());
        assert!(nested.is_dir());
    }

    #[test]
    fn deletes_to_the_recycle_bin() {
        let folder = TestFolder::new();
        let mut bin = MemoryRecycler::default();
        let created = create(&folder.0, &plan("run-plan-a", "Kept")).unwrap();
        delete(&folder.0, &created.key, &mut bin).unwrap();
        assert!(list(&folder.0).unwrap().is_empty());
        assert_eq!(
            bin.0.get(&folder.0.join(&created.key)).map(Vec::as_slice),
            Some(plan("run-plan-a", "Kept").as_bytes())
        );
        assert!(delete(&folder.0, &created.key, &mut bin)
            .unwrap_err()
            .contains("not in the library"));
    }

    #[test]
    fn recycles_a_copy_of_the_original_before_it_is_rewritten() {
        let folder = TestFolder::new();
        let mut bin = MemoryRecycler::default();
        ensure_folder(&folder.0).unwrap();
        let old = r#"{"schemaVersion":97,"projectId":"a"}"#;
        fs::write(folder.0.join("Old.runplanner.json"), old).unwrap();
        // A copy already in the folder under that name is not replaced.
        fs::write(
            folder.0.join("Old (schema 97 original).runplanner.json"),
            "{}",
        )
        .unwrap();
        preserve_original(&folder.0, "Old.runplanner.json", &mut bin).unwrap();

        assert_eq!(
            fs::read_to_string(folder.0.join("Old.runplanner.json")).unwrap(),
            old
        );
        let recycled: Vec<_> = bin
            .0
            .iter()
            .map(|(path, bytes)| {
                (
                    path.file_name().unwrap().to_string_lossy().into_owned(),
                    bytes.clone(),
                )
            })
            .collect();
        assert_eq!(
            recycled,
            vec![(
                "Old (schema 97 original 2).runplanner.json".to_owned(),
                old.as_bytes().to_vec()
            )]
        );
        assert_eq!(list(&folder.0).unwrap().len(), 2);
    }
}
