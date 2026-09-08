use serde::{Deserialize, Serialize};
use std::env;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

const GAME_ID: &str = "HadesII";
const R2MODMAN_DIRECTORY: &str = "r2modmanPlus-local";
const PROFILE_DIRECTORY: &str = "profiles";
const RETURN_OF_MODDING_DIRECTORY: &str = "ReturnOfModding";
const PLUGINS_DIRECTORY: &str = "plugins";
const CONFIG_DIRECTORY: &str = "config";
const EXECUTOR_DIRECTORY: &str = "adamantRunPlanner-Plan_Executor";
const EXECUTOR_NAMESPACE: &str = "adamantRunPlanner";
const EXECUTOR_NAME: &str = "Plan_Executor";
const EXECUTOR_VERSION: &str = "0.0.1";
const MAX_PLAN_BYTES: usize = 1_048_576;
const MAX_MANIFEST_BYTES: u64 = 16_384;
static TEMP_FILE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

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

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GamePlanTarget {
    id: String,
    label: String,
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

fn compatible_manifest(path: &Path) -> Option<ExecutorManifest> {
    let metadata = fs::symlink_metadata(path).ok()?;
    if metadata.file_type().is_symlink()
        || !metadata.is_file()
        || metadata.len() > MAX_MANIFEST_BYTES
    {
        return None;
    }
    let manifest: ExecutorManifest = serde_json::from_str(&fs::read_to_string(path).ok()?).ok()?;
    (manifest.namespace == EXECUTOR_NAMESPACE
        && manifest.name == EXECUTOR_NAME
        && manifest.full_name == EXECUTOR_DIRECTORY
        && manifest.version_number == EXECUTOR_VERSION)
        .then_some(manifest)
}

fn compatible_profiles(root: &Path) -> Result<Vec<CompatibleProfile>, String> {
    let root = fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    let mut matches = Vec::new();
    for profile in direct_profiles(&root)? {
        let canonical_profile = match existing_directory(&profile, &root) {
            Ok(path) => path,
            Err(_) => continue,
        };
        let rom = canonical_profile.join(RETURN_OF_MODDING_DIRECTORY);
        let canonical_rom = match existing_directory(&rom, &canonical_profile) {
            Ok(path) => path,
            Err(_) => continue,
        };
        let plugins = canonical_rom.join(PLUGINS_DIRECTORY);
        if existing_directory(&plugins, &canonical_rom).is_err() {
            continue;
        }
        let module_dir = plugins.join(EXECUTOR_DIRECTORY);
        if existing_directory(&module_dir, &canonical_rom).is_err() {
            continue;
        }
        if compatible_manifest(&module_dir.join("manifest.json")).is_none() {
            continue;
        }
        let Some(id) = canonical_profile.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        matches.push(CompatibleProfile {
            id: id.to_owned(),
            root: canonical_profile,
        });
    }
    Ok(matches)
}

fn discover_at(root: &Path) -> Result<GamePlanDiscovery, String> {
    if direct_profiles(root)?.is_empty() {
        return Ok(GamePlanDiscovery {
            status: "noProfiles".to_owned(),
            targets: Vec::new(),
            message: "No r2modman Hades II profiles were found.".to_owned(),
        });
    }
    let profiles = compatible_profiles(root)?;
    if profiles.is_empty() {
        return Ok(GamePlanDiscovery {
            status: "incompatibleModule".to_owned(),
            targets: Vec::new(),
            message: format!(
                "No profile has compatible {EXECUTOR_DIRECTORY} {EXECUTOR_VERSION} installed."
            ),
        });
    }
    Ok(GamePlanDiscovery {
        status: "available".to_owned(),
        targets: profiles
            .into_iter()
            .map(|profile| GamePlanTarget {
                id: profile.id.clone(),
                label: profile.id,
                module_version: EXECUTOR_VERSION.to_owned(),
            })
            .collect(),
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

fn temporary_path(destination: &Path) -> Result<PathBuf, String> {
    let parent = destination
        .parent()
        .ok_or_else(|| "plan slot has no parent directory".to_owned())?;
    let sequence = TEMP_FILE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    Ok(parent.join(format!(
        ".{}.{}.{}.tmp",
        destination
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| "plan slot has no file name".to_owned())?,
        std::process::id(),
        sequence
    )))
}

fn atomic_write(profile: &CompatibleProfile, slot_number: u8, bytes: &[u8]) -> Result<(), String> {
    let destination = safe_destination(profile, slot_number)?;
    let temporary = temporary_path(&destination)?;
    let result = (|| -> Result<(), String> {
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary)
            .map_err(|error| format!("could not create temporary plan: {error}"))?;
        file.write_all(bytes)
            .map_err(|error| format!("could not write temporary plan: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("could not flush temporary plan: {error}"))?;
        replace_file(&temporary, &destination)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
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

#[cfg(target_os = "windows")]
fn replace_file(temporary: &Path, destination: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };
    let source: Vec<u16> = temporary.as_os_str().encode_wide().chain(Some(0)).collect();
    let target: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    let moved = unsafe {
        MoveFileExW(
            source.as_ptr(),
            target.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if moved == 0 {
        return Err(format!(
            "could not replace plan slot: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn replace_file(temporary: &Path, destination: &Path) -> Result<(), String> {
    fs::rename(temporary, destination)
        .map_err(|error| format!("could not replace plan slot: {error}"))
}

#[tauri::command]
pub(crate) fn game_plan_discover_profiles() -> Result<GamePlanDiscovery, String> {
    #[cfg(target_os = "windows")]
    {
        let appdata =
            env::var_os("APPDATA").ok_or_else(|| "Windows APPDATA is unavailable.".to_owned())?;
        return discover_at(&profile_root(Path::new(&appdata)));
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(GamePlanDiscovery {
            status: "unavailable".to_owned(),
            targets: Vec::new(),
            message: "Publish to Game is available only in the Windows desktop application."
                .to_owned(),
        })
    }
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
    #[cfg(target_os = "windows")]
    {
        let appdata =
            env::var_os("APPDATA").ok_or_else(|| "Windows APPDATA is unavailable.".to_owned())?;
        let profiles = compatible_profiles(&profile_root(Path::new(&appdata)))?;
        let Some(profile) = profiles.into_iter().find(|profile| profile.id == target_id) else {
            return Ok(GamePlanPublication {
                status: "nativeWrite".to_owned(),
                message: "The selected game profile is no longer compatible. Refresh profiles and try again.".to_owned(),
            });
        };
        return Ok(
            match bounded_atomic_write(&profile, slot_number, plan_json.as_bytes()) {
                Ok(()) => GamePlanPublication {
                    status: "published".to_owned(),
                    message: format!("Published to game profile {target_id}."),
                },
                Err(message) => GamePlanPublication {
                    status: "nativeWrite".to_owned(),
                    message,
                },
            },
        );
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (target_id, slot_number);
        Ok(GamePlanPublication {
            status: "unavailable".to_owned(),
            message: "Publish to Game is available only in the Windows desktop application."
                .to_owned(),
        })
    }
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
                r#"{{"namespace":"{EXECUTOR_NAMESPACE}","name":"{EXECUTOR_NAME}","version_number":"{EXECUTOR_VERSION}","FullName":"{EXECUTOR_DIRECTORY}"}}"#
            ),
        )
        .expect("write manifest");
        CompatibleProfile {
            id: id.to_owned(),
            root: profile,
        }
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
    fn failed_replacement_preserves_previous_slot_bytes() {
        let temporary = TemporaryDirectory::new();
        let profile = install_profile(&temporary.0, "profile-a");
        let original = br#"{"format":"run-planner-execution","version":1}"#;
        bounded_atomic_write(&profile, 5, original).expect("write original plan");
        let destination = safe_destination(&profile, 5).expect("destination");
        let temporary_directory = destination.with_file_name(".failed-replacement.tmp");
        fs::create_dir(&temporary_directory).expect("create failed replacement source");

        assert!(replace_file(&temporary_directory, &destination).is_err());
        assert_eq!(
            fs::read(&destination).expect("read preserved plan"),
            original
        );
        fs::remove_dir(&temporary_directory).expect("remove failed replacement source");
    }
}
