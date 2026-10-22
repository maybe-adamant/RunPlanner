//! The project library: a visible folder of plain `.runplanner.json` files, one per plan, in
//! subfolders of any depth.
//!
//! Files are addressed by their path inside the library, `/`-separated; folders likewise. The host reads only the head of a
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
    /// The file's path inside the library; it changes when the plan is renamed or moved.
    pub key: String,
    /// The folder holding it, `""` for the top level.
    pub folder: String,
    pub modified_ms: u64,
    pub content: EntryContent,
}

/// Every plan and every folder in the library.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryListing {
    pub folders: Vec<String>,
    pub entries: Vec<LibraryEntry>,
}

/// Moves files to the platform's recycle bin.
pub trait Recycler {
    fn recycle(&mut self, path: &Path) -> Result<(), String>;
}

pub struct NativeRecycler;

impl Recycler for NativeRecycler {
    fn recycle(&mut self, path: &Path) -> Result<(), String> {
        trash::delete(path).map_err(|error| format!("Could not move it to the trash: {error}"))
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

/// Whether a folder name is plain and portable: no separators, no leading dot, not reserved.
pub fn is_folder_name(name: &str) -> bool {
    !name.is_empty()
        && name.trim() == name
        && name.chars().count() <= FILE_NAME_STEM_MAX
        && !name.starts_with('.')
        && !name.ends_with('.')
        && !name.chars().any(|c| {
            matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') || c.is_control()
        })
        && !is_reserved_windows_name(name)
}

/// A folder's path on disk, refusing anything but plain names below the library.
fn folder_path(root: &Path, folder: &str) -> Result<PathBuf, String> {
    if folder.is_empty() {
        return Ok(root.to_owned());
    }
    let mut path = root.to_owned();
    for part in folder.split('/') {
        if !is_folder_name(part) {
            return Err(format!("{folder} is not a folder in the library."));
        }
        path.push(part);
    }
    Ok(path)
}

/// The folder part of a key, `""` at the top level.
fn folder_of(key: &str) -> &str {
    key.rsplit_once('/').map_or("", |(folder, _)| folder)
}

fn key_in(folder: &str, file_name: &str) -> String {
    if folder.is_empty() {
        file_name.to_owned()
    } else {
        format!("{folder}/{file_name}")
    }
}

/// The path of a library file, refusing anything but a plan file in a library folder.
fn entry_path(root: &Path, key: &str) -> Result<PathBuf, String> {
    let (folder, file_name) = key.rsplit_once('/').unwrap_or(("", key));
    if file_name.contains('\\') || !is_library_file_name(file_name) {
        return Err(format!("{key} is not a plan in the library."));
    }
    let directory =
        folder_path(root, folder).map_err(|_| format!("{key} is not a plan in the library."))?;
    Ok(directory.join(file_name))
}

fn modified_ms(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |duration| duration.as_millis() as u64)
}

fn entry(root: &Path, key: String) -> LibraryEntry {
    let path = entry_path(root, &key).unwrap_or_else(|_| root.join(&key));
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
        folder: folder_of(&key).to_owned(),
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

fn walk(
    root: &Path,
    folder: &str,
    folders: &mut Vec<String>,
    keys: &mut Vec<String>,
) -> Result<(), String> {
    let directory = folder_path(root, folder)?;
    for item in fs::read_dir(&directory)
        .map_err(|error| format!("Could not read the library folder: {error}"))?
    {
        let item = item.map_err(|error| format!("Could not read the library folder: {error}"))?;
        let Ok(name) = item.file_name().into_string() else {
            continue;
        };
        let Ok(kind) = item.file_type() else {
            continue;
        };
        if kind.is_dir() && is_folder_name(&name) && !is_library_file_name(&name) {
            let child = key_in(folder, &name);
            folders.push(child.clone());
            walk(root, &child, folders, keys)?;
        } else if kind.is_file() && is_library_file_name(&name) {
            keys.push(key_in(folder, &name));
        }
    }
    Ok(())
}

/// Every plan file and folder below the library, unreadable plans included, ordered by path.
pub fn scan(root: &Path) -> Result<LibraryListing, String> {
    ensure_folder(root)?;
    let mut folders = Vec::new();
    let mut keys = Vec::new();
    walk(root, "", &mut folders, &mut keys)?;
    folders.sort();
    keys.sort();
    Ok(LibraryListing {
        folders,
        entries: keys.into_iter().map(|key| entry(root, key)).collect(),
    })
}

/// Every plan file below the library, ordered by path.
pub fn list(root: &Path) -> Result<Vec<LibraryEntry>, String> {
    Ok(scan(root)?.entries)
}

pub fn read(folder: &Path, key: &str) -> Result<String, String> {
    let path = entry_path(folder, key)?;
    fs::read_to_string(&path).map_err(|error| format!("Could not read {key}: {error}"))
}

/// Files a new plan in `folder` under the name its document carries; never replaces a file.
pub fn create(root: &Path, json: &str, folder: &str) -> Result<LibraryEntry, String> {
    let (project_id, name) = filed_identity(json)?;
    let directory = folder_path(root, folder)?;
    ensure_folder(&directory)?;
    let key = key_in(folder, &file_name_for(&name, &project_id));
    let path = entry_path(root, &key)?;
    if path.exists() {
        return Err(format!("{key} is already in the library."));
    }
    atomic_file::write(&path, json.as_bytes(), "plan")?;
    Ok(entry(root, key))
}

/// Moves a plan into another folder under the same file name; never replaces a file.
pub fn move_plan(root: &Path, key: &str, folder: &str) -> Result<LibraryEntry, String> {
    let from = entry_path(root, key)?;
    if !from.is_file() {
        return Err(format!("{key} is not in the library."));
    }
    let file_name = key.rsplit_once('/').map_or(key, |(_, name)| name);
    let target = key_in(folder, file_name);
    let to = entry_path(root, &target)?;
    if to.exists() {
        return Err(format!("{target} is already in the library."));
    }
    ensure_folder(&folder_path(root, folder)?)?;
    fs::rename(&from, &to).map_err(|error| format!("Could not move {key}: {error}"))?;
    Ok(entry(root, target))
}

/// Creates a folder, with any missing parents; an existing folder is left as it is.
pub fn create_folder(root: &Path, folder: &str) -> Result<(), String> {
    if folder.is_empty() {
        return Err("The library itself is not a folder to create.".to_owned());
    }
    ensure_folder(&folder_path(root, folder)?)
}

/// Renames or moves a folder with everything in it; never replaces another folder.
pub fn move_folder(root: &Path, from: &str, to: &str) -> Result<(), String> {
    if from.is_empty() || to.is_empty() {
        return Err("The library itself cannot be moved.".to_owned());
    }
    if to == from || to.starts_with(&format!("{from}/")) {
        return Err(format!("{from} cannot be moved into itself."));
    }
    let source = folder_path(root, from)?;
    let target = folder_path(root, to)?;
    if !source.is_dir() {
        return Err(format!("{from} is not in the library."));
    }
    if target.exists() {
        return Err(format!("{to} is already in the library."));
    }
    if let Some(parent) = target.parent() {
        ensure_folder(parent)?;
    }
    fs::rename(&source, &target).map_err(|error| format!("Could not move {from}: {error}"))
}

/// Moves a folder, with everything in it, to the recycle bin.
pub fn delete_folder(
    root: &Path,
    folder: &str,
    recycler: &mut impl Recycler,
) -> Result<(), String> {
    if folder.is_empty() {
        return Err("The library itself cannot be deleted.".to_owned());
    }
    let path = folder_path(root, folder)?;
    if !path.is_dir() {
        return Err(format!("{folder} is not in the library."));
    }
    recycler.recycle(&path)
}

/// Replaces a plan's file atomically; a changed name or identity also renames the file.
pub fn write(root: &Path, key: &str, json: &str) -> Result<LibraryEntry, String> {
    let path = entry_path(root, key)?;
    let (project_id, name) = filed_identity(json)?;
    let previous = fs::read_to_string(&path)
        .ok()
        .and_then(|previous| filed_identity(&previous).ok());
    atomic_file::write(&path, json.as_bytes(), "plan")?;
    let renamed = key_in(folder_of(key), &file_name_for(&name, &project_id));
    let refiled = previous.is_some_and(|(previous_id, previous_name)| {
        file_name_for(&previous_name, &previous_id) != renamed
    });
    let renamed_path = entry_path(root, &renamed)?;
    if refiled && renamed != key && !renamed_path.exists() {
        fs::rename(&path, &renamed_path)
            .map_err(|error| format!("Could not rename {key}: {error}"))?;
        return Ok(entry(root, renamed));
    }
    Ok(entry(root, key.to_owned()))
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
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or("Could not name the original copy.")?;
    let stem = &file_name[..file_name.len() - PROJECT_FILE_SUFFIX.len()];
    let copy = (1..)
        .map(|attempt| {
            let suffix = if attempt == 1 {
                String::new()
            } else {
                format!(" {attempt}")
            };
            path.with_file_name(format!(
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
            if path.is_dir() {
                fs::remove_dir_all(path).map_err(|error| error.to_string())?;
                self.0.insert(path.to_owned(), Vec::new());
                return Ok(());
            }
            let bytes = fs::read(path).map_err(|error| error.to_string())?;
            fs::remove_file(path).map_err(|error| error.to_string())?;
            self.0.insert(path.to_owned(), bytes);
            Ok(())
        }
    }

    fn create_top(root: &Path, json: &str) -> Result<LibraryEntry, String> {
        create(root, json, "")
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
        let created = create_top(&folder.0, &plan("run-plan-a", "Surface run")).unwrap();
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
        assert!(create_top(&folder.0, &plan("run-plan-a", "Surface run"))
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
        let created = create_top(&folder.0, &plan("run-plan-a", "First")).unwrap();
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
        let first = create_top(&folder.0, &plan("run-plan-a", "First")).unwrap();
        let occupied = file_name_for("Taken", "run-plan-a");
        fs::write(folder.0.join(&occupied), "{}").unwrap();
        let written = write(&folder.0, &first.key, &plan("run-plan-a", "Taken")).unwrap();
        assert_eq!(written.key, first.key);
        assert_eq!(fs::read_to_string(folder.0.join(&occupied)).unwrap(), "{}");
    }

    #[test]
    fn refuses_documents_without_identity_or_name_and_keys_outside_the_folder() {
        let folder = TestFolder::new();
        assert!(create_top(&folder.0, r#"{"name":"x"}"#)
            .unwrap_err()
            .contains("project identity"));
        assert!(create_top(&folder.0, r#"{"projectId":"a","name":" "}"#)
            .unwrap_err()
            .contains("no name"));
        for key in [
            "../escape.runplanner.json",
            "sub/../plan.runplanner.json",
            ".git/plan.runplanner.json",
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
        let good = create_top(&folder.0, &plan("run-plan-a", "Good")).unwrap();
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
        let created = create_top(&folder.0, &plan("run-plan-a", "Kept")).unwrap();
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

    #[test]
    fn scans_plans_and_folders_at_any_depth() {
        let folder = TestFolder::new();
        create_folder(&folder.0, "Practice/Bosses").unwrap();
        create_folder(&folder.0, "Empty").unwrap();
        let top = create(&folder.0, &plan("run-plan-a", "Top"), "").unwrap();
        let boss = create(&folder.0, &plan("run-plan-a", "Boss"), "Practice/Bosses").unwrap();
        fs::create_dir(folder.0.join(".hidden")).unwrap();
        fs::write(
            folder.0.join(".hidden").join("x.runplanner.json"),
            plan("h", "Hidden"),
        )
        .unwrap();

        assert_eq!(boss.folder, "Practice/Bosses");
        assert!(boss.key.starts_with("Practice/Bosses/Boss ("));
        let listing = scan(&folder.0).unwrap();
        assert_eq!(
            listing.folders,
            vec!["Empty", "Practice", "Practice/Bosses"]
        );
        // Both copies are listed with their identity; the planner re-identifies the newer one.
        assert_eq!(listing.entries, vec![boss.clone(), top.clone()]);
        assert_eq!(
            summary(&listing.entries[0]).project_id,
            summary(&listing.entries[1]).project_id
        );
        assert_eq!(
            read(&folder.0, &boss.key).unwrap(),
            plan("run-plan-a", "Boss")
        );
    }

    #[test]
    fn renames_a_plan_within_its_folder_and_moves_it_between_folders() {
        let folder = TestFolder::new();
        let created = create(&folder.0, &plan("run-plan-a", "First"), "Practice").unwrap();
        let renamed = write(&folder.0, &created.key, &plan("run-plan-a", "Second")).unwrap();
        assert_eq!(
            renamed.key,
            format!("Practice/{}", file_name_for("Second", "run-plan-a"))
        );

        let moved = move_plan(&folder.0, &renamed.key, "Speedrun/Any").unwrap();
        assert_eq!(moved.folder, "Speedrun/Any");
        assert_eq!(
            moved.key,
            format!("Speedrun/Any/{}", file_name_for("Second", "run-plan-a"))
        );
        assert!(read(&folder.0, &renamed.key).is_err());
        let top = move_plan(&folder.0, &moved.key, "").unwrap();
        assert_eq!(top.key, file_name_for("Second", "run-plan-a"));

        create(&folder.0, &plan("run-plan-a", "Second"), "Speedrun").unwrap();
        assert!(move_plan(&folder.0, &top.key, "Speedrun")
            .unwrap_err()
            .contains("already in the library"));
        assert!(move_plan(&folder.0, &top.key, "../Outside").is_err());
    }

    #[test]
    fn renames_moves_and_recycles_folders_with_everything_in_them() {
        let folder = TestFolder::new();
        let mut bin = MemoryRecycler::default();
        create(&folder.0, &plan("run-plan-a", "Boss"), "Practice/Bosses").unwrap();
        create_folder(&folder.0, "Speedrun").unwrap();

        move_folder(&folder.0, "Practice", "Drills").unwrap();
        move_folder(&folder.0, "Drills/Bosses", "Speedrun/Bosses").unwrap();
        let listing = scan(&folder.0).unwrap();
        assert_eq!(
            listing.folders,
            vec!["Drills", "Speedrun", "Speedrun/Bosses"]
        );
        assert_eq!(listing.entries[0].folder, "Speedrun/Bosses");
        assert!(move_folder(&folder.0, "Speedrun", "Speedrun/Bosses/Inner")
            .unwrap_err()
            .contains("into itself"));
        assert!(move_folder(&folder.0, "Drills", "Speedrun")
            .unwrap_err()
            .contains("already in the library"));
        assert!(move_folder(&folder.0, "Missing", "Other")
            .unwrap_err()
            .contains("not in the library"));

        delete_folder(&folder.0, "Speedrun", &mut bin).unwrap();
        assert_eq!(scan(&folder.0).unwrap().folders, vec!["Drills"]);
        assert!(bin.0.contains_key(&folder.0.join("Speedrun")));
        assert!(delete_folder(&folder.0, "", &mut bin).is_err());

        // The planner restores a deleted folder from its own copy.
        create_folder(&folder.0, "Speedrun/Bosses").unwrap();
        let restored = create(&folder.0, &plan("run-plan-a", "Boss"), "Speedrun/Bosses").unwrap();
        assert_eq!(scan(&folder.0).unwrap().entries, vec![restored]);
    }

    #[test]
    fn refuses_folder_names_that_are_not_plain_and_portable() {
        let folder = TestFolder::new();
        for name in [
            "",
            ".hidden",
            "a/../b",
            "trailing.",
            "con",
            "a:b",
            " padded",
        ] {
            assert!(
                create_folder(&folder.0, name).is_err(),
                "{name:?} must be refused"
            );
        }
        assert!(is_folder_name("Boss fights ✦"));
    }
}
