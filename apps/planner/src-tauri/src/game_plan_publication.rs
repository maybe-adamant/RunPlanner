use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

use crate::atomic_file;

const GAME_ID: &str = "HadesII";
const R2MODMAN_DIRECTORY: &str = "r2modmanPlus-local";
const PROFILE_DIRECTORY: &str = "profiles";
const RETURN_OF_MODDING_DIRECTORY: &str = "ReturnOfModding";
const PLUGINS_DIRECTORY: &str = "plugins";
const CONFIG_DIRECTORY: &str = "config";
const EXECUTOR_DIRECTORY: &str = "adamantRunPlanner-Run_Planner";
const EXECUTOR_NAMESPACE: &str = "adamantRunPlanner";
const EXECUTOR_NAME: &str = "Run_Planner";
const MAX_PLAN_BYTES: usize = 1_048_576;
const MAX_MANIFEST_BYTES: u64 = 16_384;
const REMEMBERED_PROFILE_FILE: &str = "game-publication-profile.json";

const PLAN_SLOT_FILES: [&str; 6] = [
    "slot-1.runplanner.json",
    "slot-2.runplanner.json",
    "slot-3.runplanner.json",
    "slot-4.runplanner.json",
    "slot-5.runplanner.json",
    "slot-6.runplanner.json",
];

#[derive(Clone, Debug, Deserialize)]
struct ExecutorManifest {
    namespace: String,
    name: String,
    version_number: String,
    #[serde(rename = "FullName")]
    full_name: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExecutionCompatibility {
    format: String,
    protocol_version: u32,
    catalog_version: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GamePlanTarget {
    id: String,
    label: String,
    location: String,
    module_version: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GamePlanDiscovery {
    status: String,
    targets: Vec<GamePlanTarget>,
    message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GamePlanPublication {
    status: String,
    message: String,
}

#[derive(Clone, Debug)]
struct CompatibleProfile {
    id: String,
    root: PathBuf,
    module_version: String,
}

fn profile_root(appdata: &Path) -> PathBuf {
    appdata
        .join(R2MODMAN_DIRECTORY)
        .join(GAME_ID)
        .join(PROFILE_DIRECTORY)
}

fn path_is_contained(root: &Path, child: &Path) -> bool {
    child.starts_with(root)
}

fn existing_directory(path: &Path, containment_root: &Path) -> Result<PathBuf, String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("could not inspect {}: {error}", path.display()))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(format!("{} is not a regular directory", path.display()));
    }
    let canonical = fs::canonicalize(path)
        .map_err(|error| format!("could not resolve {}: {error}", path.display()))?;
    if !path_is_contained(containment_root, &canonical) {
        return Err(format!("{} resolves outside its profile", path.display()));
    }
    Ok(canonical)
}

fn direct_profiles(root: &Path) -> Result<Vec<PathBuf>, String> {
    if !root.is_dir() {
        return Ok(Vec::new());
    }
    let mut profiles = Vec::new();
    for entry in fs::read_dir(root).map_err(|error| format!("could not read profiles: {error}"))? {
        let entry = entry.map_err(|error| format!("could not read profile entry: {error}"))?;
        if entry
            .file_type()
            .map_err(|error| format!("could not inspect profile entry: {error}"))?
            .is_dir()
        {
            profiles.push(entry.path());
        }
    }
    profiles.sort();
    Ok(profiles)
}

#[cfg(test)]
fn manifest_path(profile: &Path) -> PathBuf {
    profile
        .join(RETURN_OF_MODDING_DIRECTORY)
        .join(PLUGINS_DIRECTORY)
        .join(EXECUTOR_DIRECTORY)
        .join("manifest.json")
}

fn read_metadata<T: serde::de::DeserializeOwned>(path: &Path) -> Option<T> {
    let metadata = fs::symlink_metadata(path).ok()?;
    if metadata.file_type().is_symlink()
        || !metadata.is_file()
        || metadata.len() > MAX_MANIFEST_BYTES
    {
        return None;
    }
    serde_json::from_str(&fs::read_to_string(path).ok()?).ok()
}

fn compatible_manifest(path: &Path) -> Option<ExecutorManifest> {
    let manifest: ExecutorManifest = read_metadata(path)?;
    (manifest.namespace == EXECUTOR_NAMESPACE
        && manifest.name == EXECUTOR_NAME
        && manifest.full_name == EXECUTOR_DIRECTORY)
        .then_some(manifest)
}

fn compatible_profiles(
    root: &Path,
    compatibility: &ExecutionCompatibility,
) -> Result<Vec<CompatibleProfile>, String> {
    let root = fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    let mut matches = Vec::new();
    for profile in direct_profiles(&root)? {
        let canonical_profile = match existing_directory(&profile, &root) {
            Ok(path) => path,
            Err(_) => continue,
        };
        if let Ok(profile) = validate_profile(&canonical_profile, compatibility) {
            matches.push(profile);
        }
    }
    Ok(matches)
}

fn validate_profile(
    path: &Path,
    compatibility: &ExecutionCompatibility,
) -> Result<CompatibleProfile, String> {
    if !path.is_absolute() {
        return Err("Choose an absolute profile folder or its ReturnOfModding folder.".to_owned());
    }
    let path = if path
        .file_name()
        .is_some_and(|name| name == RETURN_OF_MODDING_DIRECTORY)
    {
        path.parent()
            .ok_or("ReturnOfModding must belong to a profile folder.")?
    } else {
        path
    };
    let root = fs::canonicalize(path)
        .map_err(|_| "That folder is unavailable. Choose an existing profile folder.".to_owned())?;
    existing_directory(path, &root).map_err(|_| {
        "Choose a regular profile folder, not a file or folder shortcut.".to_owned()
    })?;
    let rom = existing_directory(&root.join(RETURN_OF_MODDING_DIRECTORY), &root).map_err(|_| {
        "No ReturnOfModding folder found. Choose a named profile, not the profiles folder."
            .to_owned()
    })?;
    let plugins = existing_directory(&rom.join(PLUGINS_DIRECTORY), &rom).map_err(|_| {
        "No plugins folder found. Launch this profile once through your mod manager.".to_owned()
    })?;
    let module_dir = existing_directory(&plugins.join(EXECUTOR_DIRECTORY), &rom)
        .map_err(|_| "Run Planner is not installed in this profile.".to_owned())?;
    let manifest = compatible_manifest(&module_dir.join("manifest.json"))
        .ok_or("Run Planner's installation is incomplete. Reinstall the game module.")?;
    if read_metadata::<ExecutionCompatibility>(&module_dir.join("execution-compatibility.json"))
        .as_ref()
        != Some(compatibility)
    {
        return Err(
            "Run Planner versions are incompatible. Update the app and game module together."
                .to_owned(),
        );
    }
    let id = root
        .to_str()
        .ok_or("Profile folder must have a UTF-8 path.")?
        .to_owned();
    Ok(CompatibleProfile {
        id,
        root,
        module_version: manifest.version_number,
    })
}

fn target(profile: CompatibleProfile) -> GamePlanTarget {
    let label = profile
        .root
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(&profile.id);
    GamePlanTarget {
        label: label.to_owned(),
        location: display_path(&profile.id),
        id: profile.id,
        module_version: profile.module_version,
    }
}

fn display_path(path: &str) -> String {
    if let Some(unc) = path.strip_prefix(r"\\?\UNC\") {
        return format!(r"\\{unc}");
    }
    path.strip_prefix(r"\\?\").unwrap_or(path).to_owned()
}

fn remember_profile(config_dir: &Path, profile: &CompatibleProfile) -> Result<(), String> {
    fs::create_dir_all(config_dir)
        .map_err(|error| format!("Could not save profile location: {error}"))?;
    let json = serde_json::to_vec(&profile.root).map_err(|error| error.to_string())?;
    atomic_file::write(
        &config_dir.join(REMEMBERED_PROFILE_FILE),
        &json,
        "game profile location",
    )
}

fn include_remembered(
    discovery: &mut GamePlanDiscovery,
    config_dir: &Path,
    compatibility: &ExecutionCompatibility,
) {
    let file = config_dir.join(REMEMBERED_PROFILE_FILE);
    if !file.exists() {
        return;
    }
    let result = read_metadata::<PathBuf>(&file)
        .ok_or_else(|| "The remembered profile location could not be read.".to_owned())
        .and_then(|path| validate_profile(&path, compatibility));
    match result {
        Ok(profile) => {
            if !discovery
                .targets
                .iter()
                .any(|candidate| candidate.id == profile.id)
            {
                discovery.targets.push(target(profile));
            }
            discovery.status = "available".to_owned();
            discovery.message = "Choose a profile and slot.".to_owned();
        }
        Err(error) => {
            discovery.message = format!(
                "Remembered profile unavailable: {error} Choose its current folder to try again."
            )
        }
    }
}

#[tauri::command]
pub(crate) fn game_plan_choose_profile(
    app: tauri::AppHandle,
    path: String,
    compatibility: ExecutionCompatibility,
) -> Result<GamePlanTarget, String> {
    let profile = validate_profile(Path::new(&path), &compatibility)?;
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    remember_profile(&config_dir, &profile)?;
    Ok(target(profile))
}

fn discover_at(
    root: &Path,
    compatibility: &ExecutionCompatibility,
) -> Result<GamePlanDiscovery, String> {
    if direct_profiles(root)?.is_empty() {
        return Ok(GamePlanDiscovery {
            status: "noProfiles".to_owned(),
            targets: Vec::new(),
            message: "No r2modman Hades II profiles were found.".to_owned(),
        });
    }
    let profiles = compatible_profiles(root, compatibility)?;
    if profiles.is_empty() {
        return Ok(GamePlanDiscovery {
            status: "incompatibleModule".to_owned(),
            targets: Vec::new(),
            message:
                "No compatible profiles found. Choose a profile or update its Run Planner module."
                    .to_owned(),
        });
    }
    Ok(GamePlanDiscovery {
        status: "available".to_owned(),
        targets: profiles.into_iter().map(target).collect(),
        message: "Choose a compatible r2modman Hades II profile for publication.".to_owned(),
    })
}

fn slot_file_name(slot_number: u8) -> Result<&'static str, String> {
    match slot_number {
        1 => Ok(PLAN_SLOT_FILES[0]),
        2 => Ok(PLAN_SLOT_FILES[1]),
        3 => Ok(PLAN_SLOT_FILES[2]),
        4 => Ok(PLAN_SLOT_FILES[3]),
        5 => Ok(PLAN_SLOT_FILES[4]),
        6 => Ok(PLAN_SLOT_FILES[5]),
        slot => Err(format!("plan slot must be between 1 and 6 (got {slot})")),
    }
}

fn safe_destination(profile: &CompatibleProfile, slot_number: u8) -> Result<PathBuf, String> {
    let slot_file = slot_file_name(slot_number)?;
    let rom = existing_directory(
        &profile.root.join(RETURN_OF_MODDING_DIRECTORY),
        &profile.root,
    )?;
    let config = rom.join(CONFIG_DIRECTORY);
    if !config.exists() {
        fs::create_dir(&config)
            .map_err(|error| format!("could not create config directory: {error}"))?;
    }
    existing_directory(&config, &rom)?;
    let module_config = config.join(EXECUTOR_DIRECTORY);
    if !module_config.exists() {
        fs::create_dir(&module_config)
            .map_err(|error| format!("could not create module config directory: {error}"))?;
    }
    let module_config = existing_directory(&module_config, &rom)?;
    let destination = module_config.join(slot_file);
    match fs::symlink_metadata(&destination) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() || !metadata.is_file() {
                return Err("plan slot must be a regular file".to_owned());
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => {
            return Err(format!("could not inspect plan slot: {error}"));
        }
    }
    Ok(destination)
}

fn atomic_write(profile: &CompatibleProfile, slot_number: u8, bytes: &[u8]) -> Result<(), String> {
    let destination = safe_destination(profile, slot_number)?;
    atomic_file::write(&destination, bytes, "plan slot")
}

fn bounded_atomic_write(
    profile: &CompatibleProfile,
    slot_number: u8,
    bytes: &[u8],
) -> Result<(), String> {
    if bytes.len() > MAX_PLAN_BYTES {
        return Err(format!("game plan exceeds the {MAX_PLAN_BYTES}-byte limit"));
    }
    atomic_write(profile, slot_number, bytes)
}

#[tauri::command]
pub(crate) fn game_plan_discover_profiles(
    app: tauri::AppHandle,
    compatibility: ExecutionCompatibility,
) -> Result<GamePlanDiscovery, String> {
    let mut discovery = GamePlanDiscovery {
        status: "noProfiles".to_owned(),
        targets: Vec::new(),
        message: "No profiles detected. Choose your profile folder to publish.".to_owned(),
    };
    if cfg!(target_os = "windows") {
        if let Some(appdata) = env::var_os("APPDATA") {
            match discover_at(&profile_root(Path::new(&appdata)), &compatibility) {
                Ok(found) => discovery = found,
                Err(error) => {
                    discovery.message =
                        format!("Automatic detection failed: {error}. Choose your profile folder.")
                }
            }
        }
    }
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    include_remembered(&mut discovery, &config_dir, &compatibility);
    Ok(discovery)
}

#[tauri::command]
pub(crate) fn game_plan_publish(
    target_id: String,
    slot_number: u8,
    plan_json: String,
) -> Result<GamePlanPublication, String> {
    if let Err(message) = slot_file_name(slot_number) {
        return Ok(GamePlanPublication {
            status: "nativeWrite".to_owned(),
            message,
        });
    }
    if plan_json.as_bytes().len() > MAX_PLAN_BYTES {
        return Ok(GamePlanPublication {
            status: "nativeWrite".to_owned(),
            message: format!("Game plan exceeds the {MAX_PLAN_BYTES}-byte limit."),
        });
    }
    Ok(match publish_at(&target_id, slot_number, &plan_json) {
        Ok(()) => GamePlanPublication {
            status: "published".to_owned(),
            message: format!("Published to game profile {target_id}."),
        },
        Err(message) => GamePlanPublication {
            status: "nativeWrite".to_owned(),
            message,
        },
    })
}

fn publish_at(target_id: &str, slot_number: u8, plan_json: &str) -> Result<(), String> {
    slot_file_name(slot_number)?;
    if plan_json.len() > MAX_PLAN_BYTES {
        return Err(format!(
            "Game plan exceeds the {MAX_PLAN_BYTES}-byte limit."
        ));
    }
    let compatibility: ExecutionCompatibility = serde_json::from_str(plan_json)
        .map_err(|error| format!("Invalid execution plan header: {error}"))?;
    let profile = validate_profile(Path::new(target_id), &compatibility)?;
    bounded_atomic_write(&profile, slot_number, plan_json.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TemporaryDirectory(PathBuf);

    impl TemporaryDirectory {
        fn new() -> Self {
            let nonce = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock before epoch")
                .as_nanos();
            let path = env::temp_dir().join(format!("run-planner-game-plan-{nonce}"));
            fs::create_dir_all(&path).expect("create temporary root");
            Self(path)
        }
    }

    impl Drop for TemporaryDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn install_profile(root: &Path, id: &str) -> CompatibleProfile {
        let profile = root.join(id);
        let manifest = manifest_path(&profile);
        fs::create_dir_all(manifest.parent().expect("manifest parent")).expect("create profile");
        fs::write(
            manifest,
            format!(
                r#"{{"namespace":"{EXECUTOR_NAMESPACE}","name":"{EXECUTOR_NAME}","version_number":"0.7.1","FullName":"{EXECUTOR_DIRECTORY}"}}"#
            ),
        )
        .expect("write manifest");
        CompatibleProfile {
            id: id.to_owned(),
            root: profile,
            module_version: "0.7.1".to_owned(),
        }
    }

    fn compatibility() -> ExecutionCompatibility {
        ExecutionCompatibility {
            format: "run-planner-execution".to_owned(),
            protocol_version: 42,
            catalog_version: "test-catalog".to_owned(),
        }
    }

    fn install_supported_profile(root: &Path, id: &str) -> CompatibleProfile {
        let profile = install_profile(root, id);
        fs::write(manifest_path(&profile.root).with_file_name("execution-compatibility.json"),
            r#"{"format":"run-planner-execution","protocolVersion":42,"catalogVersion":"test-catalog"}"#).unwrap();
        validate_profile(&profile.root, &compatibility()).unwrap()
    }

    #[test]
    fn manual_profile_normalizes_remembers_and_deduplicates_both_folder_forms() {
        let temporary = TemporaryDirectory::new();
        let root = temporary.0.join("nonstandard-location");
        let profile = install_supported_profile(&root, "My Profile");
        let rom = validate_profile(
            &profile.root.join(RETURN_OF_MODDING_DIRECTORY),
            &compatibility(),
        )
        .unwrap();
        assert_eq!(profile.id, rom.id);
        let config = temporary.0.join("application-config");
        remember_profile(&config, &rom).unwrap();
        let mut discovery = discover_at(&root, &compatibility()).unwrap();
        include_remembered(&mut discovery, &config, &compatibility());
        assert_eq!(discovery.targets.len(), 1);
        assert_eq!(discovery.targets[0].id, profile.id);
        assert_eq!(discovery.targets[0].label, "My Profile");
        assert_eq!(discovery.targets[0].location, display_path(&profile.id));
        let mut restored = discover_at(&temporary.0.join("empty"), &compatibility()).unwrap();
        include_remembered(&mut restored, &config, &compatibility());
        assert_eq!(restored.status, "available");
        assert_eq!(restored.targets[0].id, profile.id);
        let plan = r#"{"format":"run-planner-execution","protocolVersion":42,"catalogVersion":"test-catalog"}"#;
        publish_at(&rom.id, 6, plan).unwrap();
        assert_eq!(
            fs::read_to_string(safe_destination(&profile, 6).unwrap()).unwrap(),
            plan
        );
        fs::remove_file(
            manifest_path(&profile.root).with_file_name("execution-compatibility.json"),
        )
        .unwrap();
        let mut stale = discover_at(&temporary.0.join("empty"), &compatibility()).unwrap();
        include_remembered(&mut stale, &config, &compatibility());
        assert!(stale.targets.is_empty());
        assert!(stale.message.contains("Remembered profile unavailable"));
        assert!(publish_at(&rom.id, 6, plan).is_err());
        assert_eq!(
            fs::read_to_string(safe_destination(&profile, 6).unwrap()).unwrap(),
            plan
        );
    }

    #[test]
    fn manual_profile_rejects_missing_module_incompatible_headers_and_relative_paths() {
        let temporary = TemporaryDirectory::new();
        assert!(validate_profile(Path::new("relative"), &compatibility()).is_err());
        assert_eq!(
            validate_profile(&temporary.0, &compatibility()).unwrap_err(),
            "No ReturnOfModding folder found. Choose a named profile, not the profiles folder."
        );
        let profile = install_supported_profile(&temporary.0, "profile");
        let mut expected = compatibility();
        expected.protocol_version += 1;
        assert!(validate_profile(&profile.root, &expected).is_err());
        expected = compatibility();
        expected.catalog_version = "other".to_owned();
        assert!(validate_profile(&profile.root, &expected).is_err());
        fs::remove_file(manifest_path(&profile.root)).unwrap();
        assert!(validate_profile(&profile.root, &compatibility()).is_err());
    }

    #[test]
    fn display_paths_hide_windows_internal_prefixes_without_changing_target_ids() {
        assert_eq!(display_path(r"\\?\C:\profiles\test"), r"C:\profiles\test");
        assert_eq!(
            display_path(r"\\?\UNC\server\profiles\test"),
            r"\\server\profiles\test"
        );
        assert_eq!(display_path("/profiles/test"), "/profiles/test");
    }

    #[cfg(unix)]
    #[test]
    fn manual_publication_rejects_symlink_escape_without_writing() {
        use std::os::unix::fs::symlink;
        let temporary = TemporaryDirectory::new();
        let profile = install_supported_profile(&temporary.0, "profile");
        let outside = temporary.0.join("outside");
        fs::create_dir(&outside).unwrap();
        symlink(
            &outside,
            profile
                .root
                .join(RETURN_OF_MODDING_DIRECTORY)
                .join(CONFIG_DIRECTORY),
        )
        .unwrap();
        assert!(safe_destination(&profile, 1).is_err());
        assert_eq!(fs::read_dir(outside).unwrap().count(), 0);
    }

    #[test]
    fn discovery_matches_execution_support_not_release_version() {
        let temporary = TemporaryDirectory::new();
        let profile = install_profile(&temporary.0, "h2-dev");
        let path = manifest_path(&profile.root).with_file_name("execution-compatibility.json");
        assert!(discover_at(&temporary.0, &compatibility())
            .unwrap()
            .targets
            .is_empty());
        fs::write(&path, r#"{"format":"run-planner-execution","protocolVersion":42,"catalogVersion":"test-catalog"}"#).unwrap();
        let discovery = discover_at(&temporary.0, &compatibility()).unwrap();
        assert_eq!(discovery.targets.len(), 1);
        assert_eq!(discovery.targets[0].module_version, "0.7.1");
        for field in ["format", "protocol", "catalog"] {
            let mut requested = compatibility();
            match field {
                "format" => requested.format = "authored-project".to_owned(),
                "protocol" => requested.protocol_version += 1,
                _ => requested.catalog_version = "another-catalog".to_owned(),
            }
            assert!(compatible_profiles(&temporary.0, &requested)
                .unwrap()
                .is_empty());
        }
        fs::write(&path, "{}").unwrap();
        assert!(compatible_profiles(&temporary.0, &compatibility())
            .unwrap()
            .is_empty());
    }

    #[test]
    fn slot_numbers_map_to_the_six_closed_filenames() {
        let temporary = TemporaryDirectory::new();
        let profile = install_profile(&temporary.0, "profile-a");
        let expected = [
            "slot-1.runplanner.json",
            "slot-2.runplanner.json",
            "slot-3.runplanner.json",
            "slot-4.runplanner.json",
            "slot-5.runplanner.json",
            "slot-6.runplanner.json",
        ];

        for (slot_number, expected_file) in (1_u8..=6).zip(expected) {
            assert_eq!(
                slot_file_name(slot_number).expect("legal slot"),
                expected_file
            );
            let destination = safe_destination(&profile, slot_number).expect("destination");
            assert_eq!(
                destination.file_name().and_then(|name| name.to_str()),
                Some(expected_file)
            );
        }
    }

    #[test]
    fn invalid_slot_numbers_are_rejected_before_filesystem_resolution() {
        let profile = CompatibleProfile {
            id: "profile-a".to_owned(),
            root: PathBuf::from("path-that-does-not-exist"),
            module_version: "0.7.1".to_owned(),
        };

        for slot_number in [0, 7, u8::MAX] {
            let error = safe_destination(&profile, slot_number).expect_err("invalid slot");
            assert_eq!(
                error,
                format!("plan slot must be between 1 and 6 (got {slot_number})")
            );
        }
    }

    #[test]
    fn publication_replaces_only_the_requested_slot() {
        let temporary = TemporaryDirectory::new();
        let profile = install_profile(&temporary.0, "profile-a");
        let first = br#"{"slot":1}"#;
        let second = br#"{"slot":2}"#;
        atomic_write(&profile, 1, first).expect("write first slot");
        atomic_write(&profile, 2, second).expect("write second slot");

        let replacement = br#"{"slot":1,"revision":2}"#;
        atomic_write(&profile, 1, replacement).expect("replace first slot");

        assert_eq!(
            fs::read(safe_destination(&profile, 1).expect("first destination"))
                .expect("read first"),
            replacement
        );
        assert_eq!(
            fs::read(safe_destination(&profile, 2).expect("second destination"))
                .expect("read second"),
            second
        );
    }

    #[test]
    fn oversized_publication_is_rejected_without_touching_the_existing_slot() {
        let temporary = TemporaryDirectory::new();
        let profile = install_profile(&temporary.0, "profile-a");
        let original = br#"{"format":"run-planner-execution","version":1}"#;
        bounded_atomic_write(&profile, 4, original).expect("write original plan");
        let oversized = vec![b'x'; MAX_PLAN_BYTES + 1];
        assert!(bounded_atomic_write(&profile, 4, &oversized).is_err());
        let destination = safe_destination(&profile, 4).expect("destination");
        assert_eq!(fs::read(destination).expect("read plan"), original);
    }

    #[test]
    fn publication_rechecks_support_and_preserves_slot_on_incompatibility() {
        let temporary = TemporaryDirectory::new();
        let profile = install_profile(&temporary.0, "profile-a");
        let original = r#"{"format":"run-planner-execution","protocolVersion":42,"catalogVersion":"test-catalog"}"#;
        let support = manifest_path(&profile.root).with_file_name("execution-compatibility.json");
        fs::write(&support, original).unwrap();
        assert_eq!(
            discover_at(&temporary.0, &compatibility())
                .unwrap()
                .targets
                .len(),
            1
        );
        publish_at(profile.root.to_str().unwrap(), 5, original).unwrap();
        let destination = safe_destination(&profile, 5).expect("destination");
        fs::remove_file(support).unwrap();
        assert!(publish_at(profile.root.to_str().unwrap(), 5, original).is_err());
        assert!(publish_at(profile.root.to_str().unwrap(), 5, "{}").is_err());
        assert_eq!(
            fs::read(&destination).expect("read preserved plan"),
            original.as_bytes()
        );
    }
}
