use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::atomic_file;

pub const RETURN_OF_MODDING_DIRECTORY: &str = "ReturnOfModding";
pub const PLUGINS_DIRECTORY: &str = "plugins";
pub const CONFIG_DIRECTORY: &str = "config";
const GAME_ID: &str = "HadesII";
const R2MODMAN_DIRECTORY: &str = "r2modmanPlus-local";
const PROFILE_DIRECTORY: &str = "profiles";
const TARGET_FILE: &str = "game-target.json";
const MAX_TARGET_RECORD_BYTES: u64 = 16_384;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TargetKind {
    Discovered,
    Manual,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct TargetRecord {
    pub path: PathBuf,
    pub kind: TargetKind,
}

/// A validated game target: the folder holding `ReturnOfModding` and that
/// folder itself, both canonical and free of links.
#[derive(Clone, Debug)]
pub struct ResolvedTarget {
    pub root: PathBuf,
    pub rom: PathBuf,
    pub kind: TargetKind,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameTargetFacts {
    pub path: String,
    pub location: String,
    pub label: String,
    pub kind: TargetKind,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredProfile {
    pub path: String,
    pub location: String,
    pub label: String,
    pub module: ProfileModule,
}

/// Which Run Planner copy, if any, a discovered profile already holds.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ProfileModule {
    None,
    PlannerInstalled,
    /// A planner install record whose r2modman mod list could not be read.
    ModListUnreadable,
    Thunderstore,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameTargetDiscovery {
    pub supported: bool,
    pub profiles: Vec<DiscoveredProfile>,
}

/// The r2modman Hades II profiles folder for this platform, when known.
pub fn r2modman_profiles_root() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var_os("APPDATA").map(|appdata| profiles_root_from_appdata(Path::new(&appdata)))
    }
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

pub fn profiles_root_from_appdata(appdata: &Path) -> PathBuf {
    appdata
        .join(R2MODMAN_DIRECTORY)
        .join(GAME_ID)
        .join(PROFILE_DIRECTORY)
}

/// Resolves `path` as a real directory whose canonical location stays inside
/// `containment_root`.
pub fn existing_directory(path: &Path, containment_root: &Path) -> Result<PathBuf, String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("could not inspect {}: {error}", path.display()))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(format!("{} is not a regular directory", path.display()));
    }
    let canonical = fs::canonicalize(path)
        .map_err(|error| format!("could not resolve {}: {error}", path.display()))?;
    if !canonical.starts_with(containment_root) {
        return Err(format!("{} resolves outside its target", path.display()));
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

/// Accepts a folder that is, or directly contains, `ReturnOfModding`.
pub fn resolve_target(path: &Path, kind: TargetKind) -> Result<ResolvedTarget, String> {
    if !path.is_absolute() {
        return Err("Choose an absolute folder that contains a ReturnOfModding folder.".to_owned());
    }
    let path = if path
        .file_name()
        .is_some_and(|name| name == RETURN_OF_MODDING_DIRECTORY)
    {
        path.parent()
            .ok_or("ReturnOfModding must belong to a parent folder.")?
    } else {
        path
    };
    let root = fs::canonicalize(path)
        .map_err(|_| "That folder is unavailable. Choose an existing folder.".to_owned())?;
    existing_directory(path, &root)
        .map_err(|_| "Choose a regular folder, not a file or folder shortcut.".to_owned())?;
    let rom = existing_directory(&root.join(RETURN_OF_MODDING_DIRECTORY), &root).map_err(|_| {
        "No ReturnOfModding folder found. Choose a named profile or the folder that contains ReturnOfModding."
            .to_owned()
    })?;
    Ok(ResolvedTarget { root, rom, kind })
}

fn path_text(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn label(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path_text(path))
}

pub fn target_facts(path: &Path, kind: TargetKind) -> GameTargetFacts {
    let text = path_text(path);
    GameTargetFacts {
        location: display_path(&text),
        label: label(path),
        path: text,
        kind,
    }
}

pub fn discover_profiles(profiles_root: &Path) -> Result<Vec<DiscoveredProfile>, String> {
    let containment =
        fs::canonicalize(profiles_root).unwrap_or_else(|_| profiles_root.to_path_buf());
    let mut discovered = Vec::new();
    for profile in direct_profiles(&containment)? {
        if existing_directory(&profile, &containment).is_err() {
            continue;
        }
        if let Ok(target) = resolve_target(&profile, TargetKind::Discovered) {
            let facts = target_facts(&target.root, TargetKind::Discovered);
            discovered.push(DiscoveredProfile {
                path: facts.path,
                location: facts.location,
                label: facts.label,
                module: ProfileModule::None,
            });
        }
    }
    Ok(discovered)
}

/// Accepts only a profile that discovery reports under `profiles_root`.
pub fn resolve_discovered(profiles_root: &Path, path: &Path) -> Result<ResolvedTarget, String> {
    let target = resolve_target(path, TargetKind::Discovered)?;
    let listed = discover_profiles(profiles_root)?
        .into_iter()
        .any(|profile| Path::new(&profile.path) == target.root);
    if !listed {
        return Err("That profile is not an r2modman Hades II profile.".to_owned());
    }
    Ok(target)
}

/// Resolves a candidate target by the same rules as setting it, without saving.
pub fn validate_target(
    profiles_root: Option<&Path>,
    path: &Path,
    kind: TargetKind,
) -> Result<GameTargetFacts, String> {
    let target = match kind {
        TargetKind::Manual => resolve_target(path, kind)?,
        TargetKind::Discovered => resolve_discovered(
            profiles_root.ok_or("r2modman profile discovery is unavailable on this platform.")?,
            path,
        )?,
    };
    Ok(target_facts(&target.root, target.kind))
}

pub fn remember_target(config_dir: &Path, target: &ResolvedTarget) -> Result<(), String> {
    fs::create_dir_all(config_dir)
        .map_err(|error| format!("Could not save the game target: {error}"))?;
    let json = serde_json::to_vec(&TargetRecord {
        path: target.root.clone(),
        kind: target.kind,
    })
    .map_err(|error| error.to_string())?;
    atomic_file::write(&config_dir.join(TARGET_FILE), &json, "game target")
}

/// Clears the saved target; files at the target are never touched.
pub fn forget_target(config_dir: &Path) -> Result<(), String> {
    match fs::remove_file(config_dir.join(TARGET_FILE)) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Could not forget the game target: {error}")),
    }
}

pub fn remembered_target(config_dir: &Path) -> Result<Option<TargetRecord>, String> {
    let file = config_dir.join(TARGET_FILE);
    let metadata = match fs::symlink_metadata(&file) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("The saved game target could not be read: {error}")),
    };
    if !metadata.is_file() || metadata.len() > MAX_TARGET_RECORD_BYTES {
        return Err("The saved game target could not be read.".to_owned());
    }
    let json = fs::read(&file)
        .map_err(|error| format!("The saved game target could not be read: {error}"))?;
    // Unknown keys, such as an earlier build's `lastSlot`, are ignored.
    serde_json::from_slice::<TargetRecord>(&json)
        .map(Some)
        .map_err(|_| "The saved game target could not be read.".to_owned())
}

pub fn display_path(path: &str) -> String {
    display_path_with_user_profile(path, std::env::var("USERPROFILE").ok().as_deref())
}

fn readable_path(path: &str) -> String {
    if let Some(unc) = path.strip_prefix(r"\\?\UNC\") {
        return format!(r"\\{unc}");
    }
    path.strip_prefix(r"\\?\").unwrap_or(path).to_owned()
}

fn display_path_with_user_profile(path: &str, user_profile: Option<&str>) -> String {
    let path = readable_path(path);
    if let Some(user_profile) = user_profile {
        let home = readable_path(user_profile).replace('/', "\\");
        let home = home.trim_end_matches('\\');
        let normalized = path.replace('/', "\\");
        if !home.is_empty()
            && normalized
                .get(..home.len())
                .is_some_and(|prefix| prefix.eq_ignore_ascii_case(home))
        {
            let suffix = &path[home.len()..];
            if suffix.is_empty() || suffix.starts_with(['\\', '/']) {
                return format!("%USERPROFILE%{suffix}");
            }
        }
    }
    path
}

#[cfg(test)]
pub mod test_support {
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};

    static SEQUENCE: AtomicU64 = AtomicU64::new(0);

    pub struct TemporaryDirectory(pub PathBuf);

    impl TemporaryDirectory {
        pub fn new(label: &str) -> Self {
            let path = std::env::temp_dir().join(format!(
                "run-planner-{label}-{}-{}",
                std::process::id(),
                SEQUENCE.fetch_add(1, Ordering::Relaxed)
            ));
            let _ = std::fs::remove_dir_all(&path);
            std::fs::create_dir_all(&path).expect("create temporary root");
            Self(std::fs::canonicalize(path).expect("canonical temporary root"))
        }
    }

    impl Drop for TemporaryDirectory {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::TemporaryDirectory;
    use super::*;

    fn profile(root: &Path, name: &str) -> PathBuf {
        let profile = root.join(name);
        fs::create_dir_all(profile.join(RETURN_OF_MODDING_DIRECTORY)).unwrap();
        profile
    }

    #[test]
    fn manual_targets_accept_either_folder_form_and_reject_other_folders() {
        let temporary = TemporaryDirectory::new("target");
        let game = profile(&temporary.0, "Ship");
        let direct = resolve_target(&game, TargetKind::Manual).unwrap();
        let rom =
            resolve_target(&game.join(RETURN_OF_MODDING_DIRECTORY), TargetKind::Manual).unwrap();
        assert_eq!(direct.root, rom.root);
        assert_eq!(direct.rom, game.join(RETURN_OF_MODDING_DIRECTORY));
        assert!(resolve_target(Path::new("relative"), TargetKind::Manual).is_err());
        assert!(resolve_target(&temporary.0, TargetKind::Manual)
            .unwrap_err()
            .starts_with("No ReturnOfModding folder found"));
        assert!(resolve_target(&temporary.0.join("missing"), TargetKind::Manual).is_err());
    }

    #[test]
    fn discovery_lists_profiles_with_return_of_modding_and_remembers_the_kind() {
        let temporary = TemporaryDirectory::new("discovery");
        let profiles = temporary.0.join("profiles");
        let dev = profile(&profiles, "h2-dev");
        fs::create_dir_all(profiles.join("empty")).unwrap();
        let discovered = discover_profiles(&profiles).unwrap();
        assert_eq!(discovered.len(), 1);
        assert_eq!(discovered[0].label, "h2-dev");
        assert!(discover_profiles(&temporary.0.join("absent"))
            .unwrap()
            .is_empty());

        let target = resolve_discovered(&profiles, &dev).unwrap();
        assert_eq!(target.kind, TargetKind::Discovered);
        let elsewhere = profile(&temporary.0, "elsewhere");
        assert!(resolve_discovered(&profiles, &elsewhere).is_err());

        let config = temporary.0.join("config");
        assert!(remembered_target(&config).unwrap().is_none());
        remember_target(&config, &target).unwrap();
        let record = remembered_target(&config).unwrap().unwrap();
        assert_eq!(record.path, target.root);
        assert_eq!(record.kind, TargetKind::Discovered);
        fs::write(
            config.join(TARGET_FILE),
            serde_json::to_vec(&serde_json::json!({
                "path": target.root, "kind": "discovered", "lastSlot": 2
            }))
            .unwrap(),
        )
        .unwrap();
        let earlier = remembered_target(&config).unwrap().unwrap();
        assert_eq!(earlier.path, target.root);
        assert_eq!(earlier.kind, TargetKind::Discovered);
        let manual = resolve_target(&elsewhere, TargetKind::Manual).unwrap();
        remember_target(&config, &manual).unwrap();
        assert_eq!(
            remembered_target(&config).unwrap().unwrap().kind,
            TargetKind::Manual
        );
        fs::write(config.join(TARGET_FILE), "not json").unwrap();
        assert!(remembered_target(&config).is_err());
    }

    #[test]
    fn validation_resolves_candidates_without_saving_the_setting() {
        let temporary = TemporaryDirectory::new("validate");
        let profiles = temporary.0.join("profiles");
        let dev = profile(&profiles, "h2-dev");
        let game = profile(&temporary.0, "Ship");
        let facts = validate_target(
            None,
            &game.join(RETURN_OF_MODDING_DIRECTORY),
            TargetKind::Manual,
        )
        .unwrap();
        assert_eq!(Path::new(&facts.path), game);
        assert_eq!(facts.kind, TargetKind::Manual);
        assert_eq!(
            validate_target(Some(&profiles), &dev, TargetKind::Discovered)
                .unwrap()
                .label,
            "h2-dev"
        );
        assert!(validate_target(Some(&profiles), &game, TargetKind::Discovered).is_err());
        assert!(validate_target(None, &dev, TargetKind::Discovered).is_err());
        assert!(validate_target(None, Path::new("relative"), TargetKind::Manual).is_err());
        assert!(validate_target(None, &temporary.0.join("missing"), TargetKind::Manual).is_err());
        assert!(validate_target(None, &temporary.0, TargetKind::Manual)
            .unwrap_err()
            .starts_with("No ReturnOfModding folder found"));
        #[cfg(unix)]
        {
            let link = temporary.0.join("link");
            std::os::unix::fs::symlink(&game, &link).unwrap();
            assert!(validate_target(None, &link, TargetKind::Manual).is_err());
        }
        let names: Vec<_> = fs::read_dir(&temporary.0)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().into_string().unwrap())
            .collect();
        assert!(
            !names.iter().any(|name| name.ends_with(".json")),
            "{names:?}"
        );
    }

    #[test]
    fn profiles_root_is_the_r2modman_hades_ii_profiles_folder() {
        assert_eq!(
            profiles_root_from_appdata(Path::new("/appdata")),
            Path::new("/appdata/r2modmanPlus-local/HadesII/profiles")
        );
    }

    #[cfg(unix)]
    #[test]
    fn linked_targets_and_linked_return_of_modding_are_rejected() {
        use std::os::unix::fs::symlink;
        let temporary = TemporaryDirectory::new("target-links");
        let real = profile(&temporary.0, "real");
        let link = temporary.0.join("link");
        symlink(&real, &link).unwrap();
        assert!(resolve_target(&link, TargetKind::Manual).is_err());
        let outside = temporary.0.join("outside-rom");
        fs::create_dir_all(&outside).unwrap();
        let escaping = temporary.0.join("escaping");
        fs::create_dir_all(&escaping).unwrap();
        symlink(&outside, escaping.join(RETURN_OF_MODDING_DIRECTORY)).unwrap();
        assert!(resolve_target(&escaping, TargetKind::Manual).is_err());
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

    #[test]
    fn display_paths_hide_only_the_matching_user_profile_directory() {
        let home = Some(r"C:\Users\Private Name\");
        assert_eq!(
            display_path_with_user_profile(
                r"\\?\c:\users\Private Name\AppData\profiles\test",
                home
            ),
            r"%USERPROFILE%\AppData\profiles\test"
        );
        assert_eq!(
            display_path_with_user_profile(r"C:\Users\Private Name", home),
            "%USERPROFILE%"
        );
        for path in [r"C:\Users\Private Name Other\profiles", r"D:\profiles\test"] {
            assert_eq!(display_path_with_user_profile(path, home), path);
        }
        assert_eq!(
            display_path_with_user_profile(r"C:\Users\Private Name\profiles", None),
            r"C:\Users\Private Name\profiles"
        );
    }
}
