use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::external_url::MODPACKLIB_PAGE_URL;
use crate::game_module_assembly::{parse_version, sha256_hex, INSTALL_RECORD_FILE, MANIFEST_FILE};
use crate::game_module_package::{ModulePackage, PackageSource};
use crate::game_target::{
    discover_profiles, existing_directory, remembered_target, resolve_target, target_facts,
    DiscoveredProfile, GameTargetFacts, ProfileModule, ResolvedTarget, TargetKind,
    PLUGINS_DIRECTORY,
};
use crate::plan_slots::{inspect_active_slot, inspect_slots, ActiveSlotFacts, PlanSlotFacts};

pub const MODULE_DIRECTORY: &str = "adamantRunPlanner-Run_Planner";
const MODULE_NAMESPACE: &str = "adamantRunPlanner";
const MODULE_NAME: &str = "Run_Planner";
const MODPACKLIB_DIRECTORY: &str = "adamant-ModpackLib";
const COORDINATOR_DIRECTORY: &str = "adamantRunPlanner-RunPlanner_Modpack";
// Hell2Modding is the loader itself: r2modman and manual installs place its
// d3d12.dll beside ReturnOfModding rather than in a plugin folder.
const LOADER_PACKAGE: &str = "Hell2Modding-Hell2Modding";
const LOADER_FILE: &str = "d3d12.dll";
const MODS_YML_FILE: &str = "mods.yml";
const INSTALL_RECORD_FORMAT: &str = "run-planner-game-module-install";
const MAX_METADATA_BYTES: u64 = 65_536;
const MAX_MODS_YML_BYTES: u64 = 8 * 1_048_576;
const MAX_MODULE_FILES: usize = 10_000;

static WORK_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ModuleState {
    Absent,
    PlannerInstalled,
    Unrecognized,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledModule {
    pub state: ModuleState,
    pub version: Option<String>,
    pub source: Option<PackageSource>,
    pub matches_bundled: bool,
    pub modified: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum R2modmanState {
    NotApplicable,
    Unmanaged,
    Managed,
    Unreadable,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct R2modmanFacts {
    pub state: R2modmanState,
    pub module_enabled: Option<bool>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ModpackLibState {
    Missing,
    Unreadable,
    Older,
    Compatible,
    IncompatibleMajor,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModpackLibFacts {
    pub state: ModpackLibState,
    pub found: Option<String>,
    pub required: String,
    /// Where users get ModpackLib: its Thunderstore store page.
    pub page_url: &'static str,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyFacts {
    pub name: String,
    pub version: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoordinatorFacts {
    pub present: bool,
    pub managed: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum InstallAction {
    Install,
    Update,
    Current,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallFacts {
    pub action: InstallAction,
    pub consent_required: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum BlockerCode {
    NoTarget,
    TargetUnavailable,
    ModuleMissing,
    ModuleMismatch,
    ModpackLibMissing,
    ModpackLibUnreadable,
    ModpackLibOlder,
    ModpackLibIncompatibleMajor,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicationBlocker {
    pub code: BlockerCode,
    pub found: Option<String>,
    pub required: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetInspection {
    pub module: InstalledModule,
    pub r2modman: R2modmanFacts,
    pub modpack_lib: ModpackLibFacts,
    pub missing_dependencies: Vec<DependencyFacts>,
    pub coordinator: CoordinatorFacts,
    pub install: InstallFacts,
    pub removable: bool,
    /// A previous install left beside `plugins/` after a failed restore.
    pub stranded_install: Option<String>,
    pub plan_slots: Vec<PlanSlotFacts>,
    pub active_slot: ActiveSlotFacts,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameModuleStatus {
    pub bundled_version: String,
    pub development_install_available: bool,
    pub target: Option<GameTargetFacts>,
    pub target_problem: Option<String>,
    pub inspection: Option<TargetInspection>,
    pub publication_blockers: Vec<PublicationBlocker>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum InstallOutcome {
    Installed,
    Unchanged,
    ConsentRequired,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum RemoveOutcome {
    Removed,
    Absent,
    NotPlannerInstalled,
    ManagedByR2modman,
    R2modmanUnreadable,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallRecord {
    format: String,
    version: String,
    source: PackageSource,
    files: BTreeMap<String, String>,
}

#[derive(Deserialize)]
struct PackageManifestFile {
    #[serde(default)]
    namespace: String,
    #[serde(default)]
    name: String,
    version_number: String,
    #[serde(default)]
    dependencies: Vec<String>,
}

/// The renames that swap an install into place; tests inject failures.
pub trait SwapFileSystem {
    fn rename(&mut self, from: &Path, to: &Path) -> io::Result<()>;
}

pub struct NativeSwap;

impl SwapFileSystem for NativeSwap {
    fn rename(&mut self, from: &Path, to: &Path) -> io::Result<()> {
        fs::rename(from, to)
    }
}

fn read_bounded(path: &Path, limit: u64) -> Option<Vec<u8>> {
    let metadata = fs::symlink_metadata(path).ok()?;
    if !metadata.is_file() || metadata.len() > limit {
        return None;
    }
    fs::read(path).ok()
}

fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Option<T> {
    serde_json::from_slice(&read_bounded(path, MAX_METADATA_BYTES)?).ok()
}

/// Splits a Thunderstore dependency string into its package name and version.
fn dependency_parts(dependency: &str) -> Option<(&str, &str)> {
    let (name, version) = dependency.rsplit_once('-')?;
    parse_version(version)?;
    Some((name, version))
}

fn plugins_dir(target: &ResolvedTarget) -> Result<Option<PathBuf>, String> {
    let plugins = target.rom.join(PLUGINS_DIRECTORY);
    match fs::symlink_metadata(&plugins) {
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("could not inspect the plugins folder: {error}")),
        Ok(_) => existing_directory(&plugins, &target.rom)
            .map(Some)
            .map_err(|_| {
                "The plugins folder is not a regular folder inside ReturnOfModding.".to_owned()
            }),
    }
}

/// The module folder when present; links and files are rejected.
fn module_dir(plugins: &Path, rom: &Path) -> Result<Option<PathBuf>, String> {
    let module = plugins.join(MODULE_DIRECTORY);
    match fs::symlink_metadata(&module) {
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!(
            "could not inspect the Run Planner plugin folder: {error}"
        )),
        Ok(_) => existing_directory(&module, rom).map(Some).map_err(|_| {
            "The Run Planner plugin folder is a link or file. Remove it before installing."
                .to_owned()
        }),
    }
}

fn collect_hashes(
    directory: &Path,
    prefix: &str,
    hashes: &mut BTreeMap<String, String>,
) -> Option<()> {
    for entry in fs::read_dir(directory).ok()? {
        let entry = entry.ok()?;
        let name = entry.file_name().into_string().ok()?;
        let path = format!("{prefix}{name}");
        let file_type = entry.file_type().ok()?;
        if file_type.is_symlink() || hashes.len() >= MAX_MODULE_FILES {
            return None;
        }
        if file_type.is_dir() {
            collect_hashes(&entry.path(), &format!("{path}/"), hashes)?;
        } else if path != INSTALL_RECORD_FILE {
            hashes.insert(path, sha256_hex(&fs::read(entry.path()).ok()?));
        }
    }
    Some(())
}

fn installed_hashes(module: &Path) -> Option<BTreeMap<String, String>> {
    let mut hashes = BTreeMap::new();
    collect_hashes(module, "", &mut hashes)?;
    Some(hashes)
}

fn read_record(module: &Path) -> Option<InstallRecord> {
    read_json::<InstallRecord>(&module.join(INSTALL_RECORD_FILE))
        .filter(|record| record.format == INSTALL_RECORD_FORMAT)
}

fn inspect_module(module: Option<&Path>, package: &ModulePackage) -> InstalledModule {
    let Some(module) = module else {
        return InstalledModule {
            state: ModuleState::Absent,
            version: None,
            source: None,
            matches_bundled: false,
            modified: false,
        };
    };
    let hashes = installed_hashes(module);
    let matches_bundled = hashes.as_ref() == Some(&package.hashes());
    match read_record(module) {
        Some(record) => InstalledModule {
            state: ModuleState::PlannerInstalled,
            modified: hashes.as_ref() != Some(&record.files),
            version: Some(record.version),
            source: Some(record.source),
            matches_bundled,
        },
        None => InstalledModule {
            state: ModuleState::Unrecognized,
            version: read_json::<PackageManifestFile>(&module.join(MANIFEST_FILE))
                .filter(|manifest| {
                    manifest.namespace == MODULE_NAMESPACE && manifest.name == MODULE_NAME
                })
                .map(|manifest| manifest.version_number),
            source: None,
            matches_bundled,
            modified: false,
        },
    }
}

struct ModsYmlEntry {
    name: String,
    enabled: Option<bool>,
}

// r2modman writes mods.yml as a top-level list of two-space-indented maps.
fn parse_mods_yml(text: &str) -> Vec<ModsYmlEntry> {
    let mut entries: Vec<ModsYmlEntry> = Vec::new();
    for line in text.lines() {
        let field = if let Some(rest) = line.strip_prefix("- ") {
            entries.push(ModsYmlEntry {
                name: String::new(),
                enabled: None,
            });
            rest
        } else if let Some(rest) = line.strip_prefix("  ") {
            if rest.starts_with(' ') || rest.starts_with('-') {
                continue;
            }
            rest
        } else {
            continue;
        };
        let (Some(entry), Some((key, value))) = (entries.last_mut(), field.split_once(':')) else {
            continue;
        };
        let value = value.trim().trim_matches(|c| c == '\'' || c == '"');
        match key.trim() {
            "name" => entry.name = value.to_owned(),
            "enabled" => entry.enabled = value.parse().ok(),
            _ => {}
        }
    }
    entries
}

fn read_mods_yml(root: &Path) -> Result<Option<Vec<ModsYmlEntry>>, ()> {
    let path = root.join(MODS_YML_FILE);
    match fs::symlink_metadata(&path) {
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err(()),
        Ok(_) => {
            let bytes = read_bounded(&path, MAX_MODS_YML_BYTES).ok_or(())?;
            let text = String::from_utf8(bytes).map_err(|_| ())?;
            Ok(Some(parse_mods_yml(&text)))
        }
    }
}

fn r2modman_facts(mods: &Result<Option<Vec<ModsYmlEntry>>, ()>) -> R2modmanFacts {
    match mods {
        Err(()) => R2modmanFacts {
            state: R2modmanState::Unreadable,
            module_enabled: None,
        },
        Ok(None) => R2modmanFacts {
            state: R2modmanState::NotApplicable,
            module_enabled: None,
        },
        Ok(Some(entries)) => match entries.iter().find(|entry| entry.name == MODULE_DIRECTORY) {
            Some(entry) => R2modmanFacts {
                state: R2modmanState::Managed,
                module_enabled: entry.enabled,
            },
            None => R2modmanFacts {
                state: R2modmanState::Unmanaged,
                module_enabled: None,
            },
        },
    }
}

fn modpack_lib_requirement(package: &ModulePackage) -> String {
    package
        .dependencies
        .iter()
        .filter_map(|dependency| dependency_parts(dependency))
        .find(|(name, _)| *name == MODPACKLIB_DIRECTORY)
        .map(|(_, version)| version.to_owned())
        .expect("the game module manifest declares its ModpackLib requirement")
}

fn modpack_lib_facts(plugins: Option<&Path>, required: String) -> (ModpackLibFacts, Vec<String>) {
    let folder = plugins.map(|plugins| plugins.join(MODPACKLIB_DIRECTORY));
    if !folder.as_ref().is_some_and(|folder| folder.is_dir()) {
        return (
            ModpackLibFacts {
                state: ModpackLibState::Missing,
                found: None,
                required,
                page_url: MODPACKLIB_PAGE_URL,
            },
            Vec::new(),
        );
    }
    let manifest = read_json::<PackageManifestFile>(&folder.unwrap().join(MANIFEST_FILE));
    let Some(manifest) = manifest else {
        return (
            ModpackLibFacts {
                state: ModpackLibState::Unreadable,
                found: None,
                required,
                page_url: MODPACKLIB_PAGE_URL,
            },
            Vec::new(),
        );
    };
    let required_version = parse_version(&required).expect("ModpackLib requirement is x.y.z");
    let state = match parse_version(&manifest.version_number) {
        None => ModpackLibState::Unreadable,
        Some(found) if found.0 != required_version.0 => ModpackLibState::IncompatibleMajor,
        Some(found) if found < required_version => ModpackLibState::Older,
        Some(_) => ModpackLibState::Compatible,
    };
    (
        ModpackLibFacts {
            state,
            found: Some(manifest.version_number),
            required,
            page_url: MODPACKLIB_PAGE_URL,
        },
        manifest.dependencies,
    )
}

fn dependency_present(target: &ResolvedTarget, plugins: Option<&Path>, name: &str) -> bool {
    if name == LOADER_PACKAGE && target.root.join(LOADER_FILE).is_file() {
        return true;
    }
    plugins.is_some_and(|plugins| plugins.join(name).join(MANIFEST_FILE).is_file())
}

fn missing_dependencies(
    target: &ResolvedTarget,
    plugins: Option<&Path>,
    declared: impl IntoIterator<Item = String>,
) -> Vec<DependencyFacts> {
    let mut missing: Vec<DependencyFacts> = Vec::new();
    for dependency in declared {
        let Some((name, version)) = dependency_parts(&dependency) else {
            continue;
        };
        if name == MODPACKLIB_DIRECTORY
            || missing.iter().any(|entry| entry.name == name)
            || dependency_present(target, plugins, name)
        {
            continue;
        }
        missing.push(DependencyFacts {
            name: name.to_owned(),
            version: version.to_owned(),
        });
    }
    missing
}

/// The planner owns a copy it installed that r2modman does not (or may not) manage.
fn planner_owns(state: ModuleState, r2modman: R2modmanState) -> bool {
    state == ModuleState::PlannerInstalled
        && matches!(
            r2modman,
            R2modmanState::NotApplicable | R2modmanState::Unmanaged
        )
}

fn consent_required(module: &InstalledModule, r2modman: &R2modmanFacts) -> bool {
    module.state != ModuleState::Absent && !planner_owns(module.state, r2modman.state)
}

fn is_current(module: &InstalledModule, package: &ModulePackage) -> bool {
    module.state == ModuleState::PlannerInstalled
        && module.matches_bundled
        && !module.modified
        && module.source == Some(package.source)
}

fn profile_module(profile: &Path) -> ProfileModule {
    let Ok(target) = resolve_target(profile, TargetKind::Discovered) else {
        return ProfileModule::None;
    };
    let module = match plugins_dir(&target) {
        Ok(Some(plugins)) => module_dir(&plugins, &target.rom).ok().flatten(),
        _ => None,
    };
    let Some(module) = module else {
        return ProfileModule::None;
    };
    let state = if read_record(&module).is_some() {
        ModuleState::PlannerInstalled
    } else {
        ModuleState::Unrecognized
    };
    let r2modman = r2modman_facts(&read_mods_yml(&target.root)).state;
    if planner_owns(state, r2modman) {
        ProfileModule::PlannerInstalled
    } else if state == ModuleState::PlannerInstalled && r2modman == R2modmanState::Unreadable {
        ProfileModule::ModListUnreadable
    } else {
        ProfileModule::Thunderstore
    }
}

/// Discovered r2modman profiles with the Run Planner copy each one holds.
pub fn discover(profiles_root: &Path) -> Result<Vec<DiscoveredProfile>, String> {
    Ok(discover_profiles(profiles_root)?
        .into_iter()
        .map(|profile| DiscoveredProfile {
            module: profile_module(Path::new(&profile.path)),
            ..profile
        })
        .collect())
}

pub fn inspect(
    target: &ResolvedTarget,
    package: &ModulePackage,
) -> Result<TargetInspection, String> {
    let plugins = plugins_dir(target)?;
    let module_path = match &plugins {
        Some(plugins) => module_dir(plugins, &target.rom)?,
        None => None,
    };
    let module = inspect_module(module_path.as_deref(), package);
    let mods = read_mods_yml(&target.root);
    let r2modman = r2modman_facts(&mods);
    let (modpack_lib, modpack_lib_dependencies) =
        modpack_lib_facts(plugins.as_deref(), modpack_lib_requirement(package));
    let missing = missing_dependencies(
        target,
        plugins.as_deref(),
        package
            .dependencies
            .iter()
            .cloned()
            .chain(modpack_lib_dependencies),
    );
    let coordinator = CoordinatorFacts {
        present: plugins
            .as_ref()
            .is_some_and(|plugins| plugins.join(COORDINATOR_DIRECTORY).is_dir()),
        managed: mods.as_ref().is_ok_and(|entries| {
            entries.as_ref().is_some_and(|entries| {
                entries
                    .iter()
                    .any(|entry| entry.name == COORDINATOR_DIRECTORY)
            })
        }),
    };
    let install = InstallFacts {
        action: if module.state == ModuleState::Absent {
            InstallAction::Install
        } else if is_current(&module, package) {
            InstallAction::Current
        } else {
            InstallAction::Update
        },
        consent_required: consent_required(&module, &r2modman),
    };
    let removable = planner_owns(module.state, r2modman.state);
    Ok(TargetInspection {
        module,
        r2modman,
        modpack_lib,
        missing_dependencies: missing,
        coordinator,
        install,
        removable,
        stranded_install: work_folders(&target.rom, REPLACED_PURPOSE)
            .last()
            .and_then(|folder| folder.file_name())
            .map(|name| name.to_string_lossy().into_owned()),
        plan_slots: inspect_slots(target),
        active_slot: inspect_active_slot(target),
    })
}

fn module_publishable(module: &InstalledModule) -> bool {
    module.matches_bundled
        || (cfg!(debug_assertions)
            && module.state == ModuleState::PlannerInstalled
            && module.source == Some(PackageSource::Checkout)
            && !module.modified)
}

fn inspection_blockers(
    inspection: &TargetInspection,
    bundled_version: &str,
) -> Vec<PublicationBlocker> {
    let mut blockers = Vec::new();
    let module = &inspection.module;
    if module.state == ModuleState::Absent {
        blockers.push(PublicationBlocker {
            code: BlockerCode::ModuleMissing,
            found: None,
            required: Some(bundled_version.to_owned()),
        });
    } else if !module_publishable(module) {
        blockers.push(PublicationBlocker {
            code: BlockerCode::ModuleMismatch,
            found: module.version.clone(),
            required: Some(bundled_version.to_owned()),
        });
    }
    let library = &inspection.modpack_lib;
    let code = match library.state {
        ModpackLibState::Compatible => None,
        ModpackLibState::Missing => Some(BlockerCode::ModpackLibMissing),
        ModpackLibState::Unreadable => Some(BlockerCode::ModpackLibUnreadable),
        ModpackLibState::Older => Some(BlockerCode::ModpackLibOlder),
        ModpackLibState::IncompatibleMajor => Some(BlockerCode::ModpackLibIncompatibleMajor),
    };
    if let Some(code) = code {
        blockers.push(PublicationBlocker {
            code,
            found: library.found.clone(),
            required: Some(library.required.clone()),
        });
    }
    blockers
}

/// Status of the remembered target, with the resolved target when usable.
pub fn status(
    config_dir: &Path,
    package: &ModulePackage,
) -> (GameModuleStatus, Option<ResolvedTarget>) {
    let mut status = GameModuleStatus {
        bundled_version: package.version.clone(),
        development_install_available: cfg!(debug_assertions),
        target: None,
        target_problem: None,
        inspection: None,
        publication_blockers: Vec::new(),
    };
    let unavailable = |status: &mut GameModuleStatus, problem: String| {
        status.target_problem = Some(problem);
        status.publication_blockers.push(PublicationBlocker {
            code: BlockerCode::TargetUnavailable,
            found: None,
            required: None,
        });
    };
    let record = match remembered_target(config_dir) {
        Ok(Some(record)) => record,
        Ok(None) => {
            status.publication_blockers.push(PublicationBlocker {
                code: BlockerCode::NoTarget,
                found: None,
                required: None,
            });
            return (status, None);
        }
        Err(problem) => {
            unavailable(&mut status, problem);
            return (status, None);
        }
    };
    status.target = Some(target_facts(&record.path, record.kind));
    let resolved = resolve_target(&record.path, record.kind)
        .and_then(|target| inspect(&target, package).map(|inspection| (target, inspection)));
    match resolved {
        Ok((target, inspection)) => {
            status.publication_blockers = inspection_blockers(&inspection, &package.version);
            status.inspection = Some(inspection);
            (status, Some(target))
        }
        Err(problem) => {
            unavailable(&mut status, problem);
            (status, None)
        }
    }
}

const STAGING_PURPOSE: &str = "staging";
const REPLACED_PURPOSE: &str = "replaced";
const REMOVED_PURPOSE: &str = "removed";

fn work_prefix(purpose: &str) -> String {
    format!(".run-planner-{purpose}-")
}

// The zero-padded time nonce leads, so name order is creation order.
fn work_path(rom: &Path, purpose: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_nanos());
    rom.join(format!(
        "{}{nonce:020}-{}-{}",
        work_prefix(purpose),
        std::process::id(),
        WORK_SEQUENCE.fetch_add(1, Ordering::Relaxed)
    ))
}

/// Real work folders of one purpose in `rom`, oldest first.
fn work_folders(rom: &Path, purpose: &str) -> Vec<PathBuf> {
    let prefix = work_prefix(purpose);
    let Ok(entries) = fs::read_dir(rom) else {
        return Vec::new();
    };
    let mut folders: Vec<PathBuf> = entries
        .filter_map(Result::ok)
        .filter(|entry| entry.file_name().to_string_lossy().starts_with(&prefix))
        .filter(|entry| {
            entry
                .file_type()
                .is_ok_and(|file_type| file_type.is_dir() && !file_type.is_symlink())
        })
        .map(|entry| entry.path())
        .collect();
    folders.sort();
    folders
}

fn sweep(folders: &[PathBuf]) {
    for folder in folders {
        let _ = fs::remove_dir_all(folder);
    }
}

fn write_staged(staging: &Path, package: &ModulePackage) -> Result<(), String> {
    fs::create_dir(staging)
        .map_err(|error| format!("could not create the staging folder: {error}"))?;
    let record = serde_json::to_vec_pretty(&InstallRecord {
        format: INSTALL_RECORD_FORMAT.to_owned(),
        version: package.version.clone(),
        source: package.source,
        files: package.hashes(),
    })
    .map_err(|error| format!("could not encode the install record: {error}"))?;
    for file in &package.files {
        let destination = staging.join(&file.path);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("could not stage {}: {error}", file.path))?;
        }
        fs::write(&destination, &file.bytes)
            .map_err(|error| format!("could not stage {}: {error}", file.path))?;
    }
    fs::write(staging.join(INSTALL_RECORD_FILE), record)
        .map_err(|error| format!("could not stage the install record: {error}"))?;
    let staged = installed_hashes(staging).ok_or("could not verify the staged module")?;
    let expected = package.hashes();
    if staged != expected
        || package
            .files
            .iter()
            .any(|file| sha256_hex(&file.bytes) != file.sha256)
    {
        return Err("The staged module did not match its package hashes.".to_owned());
    }
    Ok(())
}

fn copy_tree(from: &Path, to: &Path) -> io::Result<()> {
    fs::create_dir(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let destination = to.join(entry.file_name());
        if file_type.is_symlink() {
            return Err(io::Error::other("the module folder contains a link"));
        } else if file_type.is_dir() {
            copy_tree(&entry.path(), &destination)?;
        } else {
            fs::copy(entry.path(), destination)?;
        }
    }
    Ok(())
}

/// Keeps only the latest replaced module, outside every plugins folder.
fn back_up(module: &Path, backup_root: &Path) -> Result<(), String> {
    let failure = |error: io::Error| format!("could not back up the existing module: {error}");
    fs::create_dir_all(backup_root).map_err(failure)?;
    let partial = backup_root.join(format!(".{MODULE_DIRECTORY}.partial"));
    let latest = backup_root.join(MODULE_DIRECTORY);
    if partial.exists() {
        fs::remove_dir_all(&partial).map_err(failure)?;
    }
    copy_tree(module, &partial).map_err(|error| {
        let _ = fs::remove_dir_all(&partial);
        failure(error)
    })?;
    if latest.exists() {
        fs::remove_dir_all(&latest).map_err(failure)?;
    }
    fs::rename(&partial, &latest).map_err(failure)
}

pub fn install(
    target: &ResolvedTarget,
    package: &ModulePackage,
    backup_root: &Path,
    overwrite_consent: bool,
    swap: &mut dyn SwapFileSystem,
) -> Result<InstallOutcome, String> {
    let inspection = inspect(target, package)?;
    if inspection.install.action == InstallAction::Current {
        return Ok(InstallOutcome::Unchanged);
    }
    if inspection.install.consent_required && !overwrite_consent {
        return Ok(InstallOutcome::ConsentRequired);
    }
    let plugins = match plugins_dir(target)? {
        Some(plugins) => plugins,
        None => {
            fs::create_dir(target.rom.join(PLUGINS_DIRECTORY))
                .map_err(|error| format!("could not create the plugins folder: {error}"))?;
            plugins_dir(target)?.ok_or("could not create the plugins folder")?
        }
    };
    sweep(&work_folders(&target.rom, STAGING_PURPOSE));
    sweep(&work_folders(&target.rom, REMOVED_PURPOSE));
    let stranded = work_folders(&target.rom, REPLACED_PURPOSE);
    let existing = module_dir(&plugins, &target.rom)?;
    let destination = plugins.join(MODULE_DIRECTORY);
    let staging = work_path(&target.rom, STAGING_PURPOSE);
    if let Err(error) = write_staged(&staging, package) {
        let _ = fs::remove_dir_all(&staging);
        return Err(error);
    }
    let Some(existing) = existing else {
        swap.rename(&staging, &destination).map_err(|error| {
            let _ = fs::remove_dir_all(&staging);
            format!("could not install the module: {error}")
        })?;
        // A stranded previous install is kept until the latest one is backed up.
        if stranded
            .last()
            .map_or(true, |latest| back_up(latest, backup_root).is_ok())
        {
            sweep(&stranded);
        }
        return Ok(InstallOutcome::Installed);
    };
    if let Err(error) = back_up(&existing, backup_root) {
        let _ = fs::remove_dir_all(&staging);
        return Err(error);
    }
    let replaced = work_path(&target.rom, REPLACED_PURPOSE);
    if let Err(error) = swap.rename(&existing, &replaced) {
        let _ = fs::remove_dir_all(&staging);
        return Err(format!("could not move the existing module aside: {error}"));
    }
    if let Err(error) = swap.rename(&staging, &destination) {
        let restored = swap.rename(&replaced, &destination);
        let _ = fs::remove_dir_all(&staging);
        return Err(match restored {
            Ok(()) => format!("could not install the module; the previous install was kept: {error}"),
            Err(restore) => format!(
                "could not install the module ({error}) or restore the previous install ({restore}); it is at {}",
                replaced.display()
            ),
        });
    }
    let _ = fs::remove_dir_all(&replaced);
    // Older stranded installs predate the install just replaced and backed up.
    sweep(&stranded);
    Ok(InstallOutcome::Installed)
}

pub fn remove(target: &ResolvedTarget, package: &ModulePackage) -> Result<RemoveOutcome, String> {
    let inspection = inspect(target, package)?;
    if inspection.module.state == ModuleState::Absent {
        return Ok(RemoveOutcome::Absent);
    }
    if inspection.module.state != ModuleState::PlannerInstalled {
        return Ok(RemoveOutcome::NotPlannerInstalled);
    }
    match inspection.r2modman.state {
        R2modmanState::Managed => return Ok(RemoveOutcome::ManagedByR2modman),
        R2modmanState::Unreadable => return Ok(RemoveOutcome::R2modmanUnreadable),
        R2modmanState::NotApplicable | R2modmanState::Unmanaged => {}
    }
    let plugins = plugins_dir(target)?.ok_or("The plugins folder is unavailable.")?;
    let module = module_dir(&plugins, &target.rom)?.ok_or("The module folder is unavailable.")?;
    let removed = work_path(&target.rom, REMOVED_PURPOSE);
    fs::rename(&module, &removed)
        .map_err(|error| format!("could not remove the module: {error}"))?;
    fs::remove_dir_all(&removed).map_err(|error| {
        format!(
            "The module was removed from plugins, but {} could not be deleted: {error}",
            removed.display()
        )
    })?;
    Ok(RemoveOutcome::Removed)
}

#[cfg(test)]
pub mod test_support {
    use super::*;
    use crate::game_module_assembly::AssembledFile;
    use crate::game_target::{TargetKind, RETURN_OF_MODDING_DIRECTORY};

    pub fn package(version: &str, main: &str) -> ModulePackage {
        let manifest = format!(
            r#"{{"namespace":"adamantRunPlanner","name":"Run_Planner","version_number":"{version}","dependencies":["Hell2Modding-Hell2Modding-1.0.78","SGG_Modding-ModUtil-4.0.1","adamant-ModpackLib-4.1.0"],"FullName":"adamantRunPlanner-Run_Planner"}}"#
        );
        let files = [
            (
                "execution-compatibility.json",
                r#"{"format":"run-planner-execution","catalogVersion":"test-catalog"}"#.to_owned(),
            ),
            ("main.lua", main.to_owned()),
            ("manifest.json", manifest),
            ("mods/runtime.lua", "return {}".to_owned()),
        ]
        .into_iter()
        .map(|(path, text)| AssembledFile {
            path: path.to_owned(),
            sha256: sha256_hex(text.as_bytes()),
            bytes: text.into_bytes(),
        })
        .collect();
        ModulePackage::from_assembly(version, PackageSource::Bundled, files).unwrap()
    }

    pub fn write(path: &Path, text: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, text).unwrap();
    }

    pub fn plugin(root: &Path, folder: &str, manifest: &str) {
        write(
            &root
                .join(RETURN_OF_MODDING_DIRECTORY)
                .join(PLUGINS_DIRECTORY)
                .join(folder)
                .join(MANIFEST_FILE),
            manifest,
        );
    }

    pub fn modpack_lib(root: &Path, version: &str) {
        plugin(
            root,
            MODPACKLIB_DIRECTORY,
            &format!(
                r#"{{"namespace":"adamant","name":"ModpackLib","version_number":"{version}","dependencies":["Hell2Modding-Hell2Modding-1.0.78","LuaENVY-ENVY-1.2.0"]}}"#
            ),
        );
    }

    pub fn target(root: &Path, kind: TargetKind) -> ResolvedTarget {
        fs::create_dir_all(root.join(RETURN_OF_MODDING_DIRECTORY)).unwrap();
        resolve_target(root, kind).unwrap()
    }

    pub fn module_path(target: &ResolvedTarget) -> PathBuf {
        target.rom.join(PLUGINS_DIRECTORY).join(MODULE_DIRECTORY)
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::*;
    use super::*;
    use crate::game_target::test_support::TemporaryDirectory;
    use crate::game_target::{
        remember_target, TargetKind, CONFIG_DIRECTORY, RETURN_OF_MODDING_DIRECTORY,
    };

    fn snapshot(directory: &Path) -> BTreeMap<String, String> {
        installed_hashes(directory).unwrap_or_default()
    }

    struct FailingSwap {
        calls: usize,
        fail_on: &'static [usize],
    }

    impl SwapFileSystem for FailingSwap {
        fn rename(&mut self, from: &Path, to: &Path) -> io::Result<()> {
            self.calls += 1;
            if self.fail_on.contains(&self.calls) {
                return Err(io::Error::other("injected swap failure"));
            }
            fs::rename(from, to)
        }
    }

    #[test]
    fn modpack_lib_versions_are_reported_against_the_manifest_requirement_and_never_modified() {
        let package = package("1.2.0", "return 1");
        let cases = [
            (None, ModpackLibState::Missing),
            (Some("4.0.1"), ModpackLibState::Older),
            (Some("4.1.0"), ModpackLibState::Compatible),
            (Some("4.7.2"), ModpackLibState::Compatible),
            (Some("5.0.0"), ModpackLibState::IncompatibleMajor),
            (Some("3.9.9"), ModpackLibState::IncompatibleMajor),
            (Some("four"), ModpackLibState::Unreadable),
        ];
        for (found, expected) in cases {
            let temporary = TemporaryDirectory::new("modpacklib");
            let target = target(&temporary.0, TargetKind::Manual);
            if let Some(version) = found {
                modpack_lib(&temporary.0, version);
            }
            let library = target
                .rom
                .join(PLUGINS_DIRECTORY)
                .join(MODPACKLIB_DIRECTORY);
            let before = snapshot(&library);
            let inspection = inspect(&target, &package).unwrap();
            assert_eq!(inspection.modpack_lib.state, expected, "{found:?}");
            assert_eq!(inspection.modpack_lib.required, "4.1.0");
            assert_eq!(inspection.modpack_lib.found.as_deref(), found);
            let blockers = inspection_blockers(&inspection, &package.version);
            assert_eq!(
                blockers
                    .iter()
                    .any(|blocker| blocker.code != BlockerCode::ModuleMissing),
                expected != ModpackLibState::Compatible
            );
            install(
                &target,
                &package,
                &temporary.0.join("backup"),
                false,
                &mut NativeSwap,
            )
            .unwrap();
            assert_eq!(snapshot(&library), before);
            assert_eq!(library.exists(), found.is_some());
        }
    }

    #[test]
    fn missing_dependencies_come_from_both_manifests_and_the_loader_is_its_dll() {
        let temporary = TemporaryDirectory::new("dependencies");
        let target = target(&temporary.0, TargetKind::Manual);
        let package = package("1.2.0", "return 1");
        let names = |inspection: &TargetInspection| -> Vec<String> {
            inspection
                .missing_dependencies
                .iter()
                .map(|dependency| dependency.name.clone())
                .collect()
        };
        assert_eq!(
            names(&inspect(&target, &package).unwrap()),
            ["Hell2Modding-Hell2Modding", "SGG_Modding-ModUtil"]
        );
        modpack_lib(&temporary.0, "4.1.0");
        assert_eq!(
            names(&inspect(&target, &package).unwrap()),
            [
                "Hell2Modding-Hell2Modding",
                "SGG_Modding-ModUtil",
                "LuaENVY-ENVY"
            ]
        );
        write(&temporary.0.join(LOADER_FILE), "");
        plugin(&temporary.0, "LuaENVY-ENVY", "{}");
        fs::create_dir_all(
            target
                .rom
                .join(PLUGINS_DIRECTORY)
                .join("SGG_Modding-ModUtil"),
        )
        .unwrap();
        let inspection = inspect(&target, &package).unwrap();
        assert_eq!(names(&inspection), ["SGG_Modding-ModUtil"]);
        assert_eq!(inspection.missing_dependencies[0].version, "4.0.1");
    }

    #[test]
    fn existing_copies_require_consent_and_declining_leaves_them_untouched() {
        let package = package("1.2.0", "return 1");
        for managed in [false, true] {
            let temporary = TemporaryDirectory::new("consent");
            let target = target(&temporary.0, TargetKind::Discovered);
            plugin(
                &temporary.0,
                MODULE_DIRECTORY,
                r#"{"namespace":"adamantRunPlanner","name":"Run_Planner","version_number":"0.10.0"}"#,
            );
            write(&module_path(&target).join("main.lua"), "thunderstore");
            if managed {
                write(
                    &temporary.0.join(MODS_YML_FILE),
                    "- manifestVersion: 1\n  name: adamantRunPlanner-Run_Planner\n  dependencies:\n    - adamant-ModpackLib-4.1.0\n  enabled: false\n- manifestVersion: 1\n  name: adamantRunPlanner-RunPlanner_Modpack\n  enabled: true\n",
                );
                plugin(&temporary.0, COORDINATOR_DIRECTORY, "{}");
            } else {
                write(
                    &temporary.0.join(MODS_YML_FILE),
                    "- manifestVersion: 1\n  name: adamant-ModpackLib\n  enabled: true\n",
                );
            }
            let inspection = inspect(&target, &package).unwrap();
            assert_eq!(inspection.module.state, ModuleState::Unrecognized);
            assert_eq!(inspection.module.version.as_deref(), Some("0.10.0"));
            assert!(inspection.install.consent_required);
            assert!(!inspection.removable);
            assert_eq!(
                inspection.r2modman.state,
                if managed {
                    R2modmanState::Managed
                } else {
                    R2modmanState::Unmanaged
                }
            );
            assert_eq!(inspection.r2modman.module_enabled, managed.then_some(false));
            assert_eq!(inspection.coordinator.present, managed);
            assert_eq!(inspection.coordinator.managed, managed);
            let before = snapshot(&temporary.0);
            assert_eq!(
                install(
                    &target,
                    &package,
                    &temporary.0.join("backup"),
                    false,
                    &mut NativeSwap
                )
                .unwrap(),
                InstallOutcome::ConsentRequired
            );
            assert_eq!(
                remove(&target, &package).unwrap(),
                RemoveOutcome::NotPlannerInstalled
            );
            assert_eq!(snapshot(&temporary.0), before);
            assert!(!temporary.0.join("backup").exists());
        }
    }

    #[test]
    fn consented_overwrite_backs_up_outside_plugins_and_writes_the_record() {
        let temporary = TemporaryDirectory::new("overwrite");
        let target = target(&temporary.0, TargetKind::Discovered);
        write(&module_path(&target).join("main.lua"), "thunderstore");
        write(
            &temporary
                .0
                .join(RETURN_OF_MODDING_DIRECTORY)
                .join(CONFIG_DIRECTORY)
                .join(MODULE_DIRECTORY)
                .join("slot-1.runplanner.json"),
            "plan",
        );
        let config_before = snapshot(&target.rom.join(CONFIG_DIRECTORY));
        let backup = temporary.0.join("app-data").join("game-module-backup");
        let package = package("1.2.0", "return 1");
        assert_eq!(
            install(&target, &package, &backup, true, &mut NativeSwap).unwrap(),
            InstallOutcome::Installed
        );
        assert_eq!(
            fs::read_to_string(backup.join(MODULE_DIRECTORY).join("main.lua")).unwrap(),
            "thunderstore"
        );
        assert!(!backup.starts_with(target.rom.join(PLUGINS_DIRECTORY)));
        let inspection = inspect(&target, &package).unwrap();
        assert_eq!(inspection.module.state, ModuleState::PlannerInstalled);
        assert_eq!(inspection.module.version.as_deref(), Some("1.2.0"));
        assert!(inspection.module.matches_bundled);
        assert_eq!(inspection.install.action, InstallAction::Current);
        assert!(!inspection.install.consent_required);
        assert_eq!(snapshot(&target.rom.join(CONFIG_DIRECTORY)), config_before);
        let leftovers: Vec<_> = fs::read_dir(&target.rom)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().into_string().unwrap())
            .filter(|name| name.starts_with(".run-planner-"))
            .collect();
        assert!(leftovers.is_empty(), "{leftovers:?}");

        // A planner-installed update needs no consent and keeps only the latest backup.
        let update = package_version_update();
        assert_eq!(
            inspect(&target, &update).unwrap().install.action,
            InstallAction::Update
        );
        assert_eq!(
            install(&target, &update, &backup, false, &mut NativeSwap).unwrap(),
            InstallOutcome::Installed
        );
        assert_eq!(
            fs::read_to_string(backup.join(MODULE_DIRECTORY).join("main.lua")).unwrap(),
            "return 1"
        );
        assert_eq!(fs::read_dir(&backup).unwrap().count(), 1);
    }

    fn package_version_update() -> ModulePackage {
        package("1.3.0", "return 2")
    }

    #[test]
    fn identical_install_is_a_no_op() {
        let temporary = TemporaryDirectory::new("no-op");
        let target = target(&temporary.0, TargetKind::Manual);
        let package = package("1.2.0", "return 1");
        let backup = temporary.0.join("backup");
        install(&target, &package, &backup, false, &mut NativeSwap).unwrap();
        let before = snapshot(&temporary.0);
        let mut swap = FailingSwap {
            calls: 0,
            fail_on: &[1],
        };
        assert_eq!(
            install(&target, &package, &backup, false, &mut swap).unwrap(),
            InstallOutcome::Unchanged
        );
        assert_eq!(swap.calls, 0);
        assert_eq!(snapshot(&temporary.0), before);
        assert!(!backup.exists());
    }

    #[test]
    fn interrupted_swap_keeps_the_prior_install() {
        let temporary = TemporaryDirectory::new("interrupted");
        let target = target(&temporary.0, TargetKind::Manual);
        let backup = temporary.0.join("backup");
        install(
            &target,
            &package("1.2.0", "return 1"),
            &backup,
            false,
            &mut NativeSwap,
        )
        .unwrap();
        let before = snapshot(&module_path(&target));
        let mut swap = FailingSwap {
            calls: 0,
            fail_on: &[2],
        };
        assert!(install(
            &target,
            &package_version_update(),
            &backup,
            false,
            &mut swap
        )
        .is_err());
        assert_eq!(snapshot(&module_path(&target)), before);
        let leftovers = fs::read_dir(&target.rom)
            .unwrap()
            .filter(|entry| {
                entry
                    .as_ref()
                    .unwrap()
                    .file_name()
                    .to_string_lossy()
                    .starts_with(".run-planner-")
            })
            .count();
        assert_eq!(leftovers, 0);
        let mut first = FailingSwap {
            calls: 0,
            fail_on: &[1],
        };
        assert!(install(
            &target,
            &package_version_update(),
            &backup,
            false,
            &mut first
        )
        .is_err());
        assert_eq!(snapshot(&module_path(&target)), before);
    }

    #[test]
    fn remove_deletes_only_a_planner_install_and_leaves_config_and_modpack_lib() {
        let temporary = TemporaryDirectory::new("remove");
        let target = target(&temporary.0, TargetKind::Manual);
        let package = package("1.2.0", "return 1");
        assert_eq!(remove(&target, &package).unwrap(), RemoveOutcome::Absent);
        modpack_lib(&temporary.0, "4.1.0");
        write(
            &target
                .rom
                .join(CONFIG_DIRECTORY)
                .join(MODULE_DIRECTORY)
                .join("slot-2.runplanner.json"),
            "plan",
        );
        install(
            &target,
            &package,
            &temporary.0.join("backup"),
            false,
            &mut NativeSwap,
        )
        .unwrap();
        let config = snapshot(&target.rom.join(CONFIG_DIRECTORY));
        let library = snapshot(
            &target
                .rom
                .join(PLUGINS_DIRECTORY)
                .join(MODPACKLIB_DIRECTORY),
        );
        assert_eq!(remove(&target, &package).unwrap(), RemoveOutcome::Removed);
        assert!(!module_path(&target).exists());
        assert_eq!(snapshot(&target.rom.join(CONFIG_DIRECTORY)), config);
        assert_eq!(
            snapshot(
                &target
                    .rom
                    .join(PLUGINS_DIRECTORY)
                    .join(MODPACKLIB_DIRECTORY)
            ),
            library
        );
    }

    #[test]
    fn manual_target_without_mods_yml_reports_not_applicable_and_installs() {
        let temporary = TemporaryDirectory::new("manual");
        let target = target(
            &temporary.0.join("Hades II").join("Ship"),
            TargetKind::Manual,
        );
        modpack_lib(&target.root, "4.2.0");
        let package = package("1.2.0", "return 1");
        let inspection = inspect(&target, &package).unwrap();
        assert_eq!(inspection.r2modman.state, R2modmanState::NotApplicable);
        assert_eq!(inspection.install.action, InstallAction::Install);
        assert!(!inspection.install.consent_required);
        assert_eq!(
            install(
                &target,
                &package,
                &temporary.0.join("backup"),
                false,
                &mut NativeSwap
            )
            .unwrap(),
            InstallOutcome::Installed
        );
        let config = temporary.0.join("app-config");
        remember_target(&config, &target).unwrap();
        let (status, resolved) = status(&config, &package);
        assert!(resolved.is_some());
        assert_eq!(status.target.unwrap().kind, TargetKind::Manual);
        assert!(status.publication_blockers.is_empty());
        assert!(status.inspection.unwrap().removable);
    }

    #[test]
    fn status_reports_missing_and_unavailable_targets_as_publication_blockers() {
        let temporary = TemporaryDirectory::new("status");
        let package = package("1.2.0", "return 1");
        let config = temporary.0.join("config");
        let (none, _) = status(&config, &package);
        assert_eq!(none.publication_blockers[0].code, BlockerCode::NoTarget);
        let target = target(&temporary.0.join("profile"), TargetKind::Discovered);
        remember_target(&config, &target).unwrap();
        let (absent, _) = status(&config, &package);
        let codes: Vec<_> = absent
            .publication_blockers
            .iter()
            .map(|blocker| blocker.code)
            .collect();
        assert_eq!(
            codes,
            [BlockerCode::ModuleMissing, BlockerCode::ModpackLibMissing]
        );
        fs::remove_dir_all(&target.rom).unwrap();
        let (gone, resolved) = status(&config, &package);
        assert!(resolved.is_none());
        assert!(gone.target_problem.is_some());
        assert_eq!(
            gone.publication_blockers[0].code,
            BlockerCode::TargetUnavailable
        );
    }

    #[cfg(unix)]
    #[test]
    fn linked_plugin_folders_are_rejected_without_writing() {
        use std::os::unix::fs::symlink;
        let temporary = TemporaryDirectory::new("module-links");
        let target = target(&temporary.0.join("profile"), TargetKind::Manual);
        let outside = temporary.0.join("outside");
        fs::create_dir_all(&outside).unwrap();
        fs::create_dir_all(target.rom.join(PLUGINS_DIRECTORY)).unwrap();
        symlink(&outside, module_path(&target)).unwrap();
        let package = package("1.2.0", "return 1");
        assert!(inspect(&target, &package).is_err());
        assert!(install(
            &target,
            &package,
            &temporary.0.join("backup"),
            true,
            &mut NativeSwap
        )
        .is_err());
        assert_eq!(fs::read_dir(&outside).unwrap().count(), 0);
        fs::remove_file(module_path(&target)).unwrap();
        fs::remove_dir(target.rom.join(PLUGINS_DIRECTORY)).unwrap();
        symlink(&outside, target.rom.join(PLUGINS_DIRECTORY)).unwrap();
        assert!(install(
            &target,
            &package,
            &temporary.0.join("backup"),
            true,
            &mut NativeSwap
        )
        .is_err());
        assert_eq!(fs::read_dir(&outside).unwrap().count(), 0);
    }

    fn work_folder_names(target: &ResolvedTarget) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(&target.rom)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().into_string().unwrap())
            .filter(|name| name.starts_with(".run-planner-"))
            .collect();
        names.sort();
        names
    }

    #[test]
    fn install_sweeps_stale_staging_and_removed_folders_only() {
        let temporary = TemporaryDirectory::new("sweep");
        let target = target(&temporary.0, TargetKind::Manual);
        for name in [
            ".run-planner-staging-00000000000000000001-1-0",
            ".run-planner-removed-00000000000000000001-1-1",
            "unrelated",
        ] {
            write(&target.rom.join(name).join("main.lua"), "stale");
        }
        let package = package("1.2.0", "return 1");
        install(
            &target,
            &package,
            &temporary.0.join("backup"),
            false,
            &mut NativeSwap,
        )
        .unwrap();
        assert!(work_folder_names(&target).is_empty());
        assert!(target.rom.join("unrelated").join("main.lua").is_file());
        let first = work_path(&target.rom, STAGING_PURPOSE);
        let second = work_path(&target.rom, STAGING_PURPOSE);
        assert_ne!(first, second);
        assert!(first < second);
    }

    #[test]
    fn failed_restore_reports_the_stranded_install_until_a_later_install_backs_it_up() {
        let temporary = TemporaryDirectory::new("stranded");
        let target = target(&temporary.0, TargetKind::Manual);
        let backup = temporary.0.join("backup");
        install(
            &target,
            &package("1.2.0", "return 1"),
            &backup,
            false,
            &mut NativeSwap,
        )
        .unwrap();
        let mut swap = FailingSwap {
            calls: 0,
            fail_on: &[2, 3],
        };
        let error = install(
            &target,
            &package_version_update(),
            &backup,
            false,
            &mut swap,
        )
        .unwrap_err();
        assert!(error.contains("or restore the previous install"), "{error}");
        assert!(!module_path(&target).exists());
        let inspection = inspect(&target, &package_version_update()).unwrap();
        let stranded = inspection
            .stranded_install
            .expect("stranded install is reported");
        assert!(stranded.starts_with(".run-planner-replaced-"));
        assert_eq!(
            fs::read_to_string(target.rom.join(&stranded).join("main.lua")).unwrap(),
            "return 1"
        );
        assert_eq!(inspection.install.action, InstallAction::Install);
        assert!(!inspection.install.consent_required);

        fs::remove_dir_all(&backup).unwrap();
        install(
            &target,
            &package_version_update(),
            &backup,
            false,
            &mut NativeSwap,
        )
        .unwrap();
        assert!(work_folder_names(&target).is_empty());
        assert_eq!(
            fs::read_to_string(backup.join(MODULE_DIRECTORY).join("main.lua")).unwrap(),
            "return 1"
        );
        assert!(inspect(&target, &package_version_update())
            .unwrap()
            .stranded_install
            .is_none());
    }

    #[test]
    fn failed_backup_aborts_before_touching_the_existing_copy() {
        let temporary = TemporaryDirectory::new("backup-failure");
        let target = target(&temporary.0, TargetKind::Manual);
        write(&module_path(&target).join("main.lua"), "thunderstore");
        let before = snapshot(&module_path(&target));
        let blocked_backup = temporary.0.join("backup-is-a-file");
        write(&blocked_backup, "not a folder");
        let error = install(
            &target,
            &package("1.2.0", "return 1"),
            &blocked_backup,
            true,
            &mut NativeSwap,
        )
        .unwrap_err();
        assert!(error.contains("could not back up"), "{error}");
        assert_eq!(snapshot(&module_path(&target)), before);
        assert!(work_folder_names(&target).is_empty());
    }

    #[test]
    fn planner_installs_that_r2modman_manages_or_may_manage_need_consent_and_are_not_removed() {
        let package = package("1.2.0", "return 1");
        for (mods_yml, expected_state, expected_remove) in [
            (
                b"- manifestVersion: 1\n  name: adamantRunPlanner-Run_Planner\n  enabled: true\n"
                    .to_vec(),
                R2modmanState::Managed,
                RemoveOutcome::ManagedByR2modman,
            ),
            (
                vec![0xff, 0xfe, 0x00],
                R2modmanState::Unreadable,
                RemoveOutcome::R2modmanUnreadable,
            ),
        ] {
            let temporary = TemporaryDirectory::new("planner-managed");
            let target = target(&temporary.0, TargetKind::Discovered);
            let backup = temporary.0.join("backup");
            install(&target, &package, &backup, false, &mut NativeSwap).unwrap();
            fs::write(temporary.0.join(MODS_YML_FILE), &mods_yml).unwrap();
            let update = package_version_update();
            let inspection = inspect(&target, &update).unwrap();
            assert_eq!(inspection.module.state, ModuleState::PlannerInstalled);
            assert_eq!(inspection.r2modman.state, expected_state);
            assert!(inspection.install.consent_required);
            assert!(!inspection.removable);
            let before = snapshot(&module_path(&target));
            assert_eq!(
                install(&target, &update, &backup, false, &mut NativeSwap).unwrap(),
                InstallOutcome::ConsentRequired
            );
            assert_eq!(remove(&target, &update).unwrap(), expected_remove);
            assert_eq!(snapshot(&module_path(&target)), before);
        }
    }

    #[test]
    fn discovery_hints_name_the_run_planner_copy_each_profile_holds() {
        let temporary = TemporaryDirectory::new("discovery-hints");
        let profiles = temporary.0.join("profiles");
        let package = package("1.2.0", "return 1");
        let backup = temporary.0.join("backup");
        target(&profiles.join("empty"), TargetKind::Discovered);
        let planner = target(&profiles.join("planner"), TargetKind::Discovered);
        install(&planner, &package, &backup, false, &mut NativeSwap).unwrap();
        let thunderstore = target(&profiles.join("thunderstore"), TargetKind::Discovered);
        write(&module_path(&thunderstore).join("main.lua"), "thunderstore");
        let managed = target(&profiles.join("managed"), TargetKind::Discovered);
        install(&managed, &package, &backup, false, &mut NativeSwap).unwrap();
        write(
            &managed.root.join(MODS_YML_FILE),
            "- manifestVersion: 1\n  name: adamantRunPlanner-Run_Planner\n",
        );
        let unreadable = target(&profiles.join("unreadable"), TargetKind::Discovered);
        install(&unreadable, &package, &backup, false, &mut NativeSwap).unwrap();
        fs::write(unreadable.root.join(MODS_YML_FILE), [0xff, 0xfe]).unwrap();
        let hints: Vec<(String, ProfileModule)> = discover(&profiles)
            .unwrap()
            .into_iter()
            .map(|profile| (profile.label, profile.module))
            .collect();
        assert_eq!(
            hints,
            [
                ("empty".to_owned(), ProfileModule::None),
                ("managed".to_owned(), ProfileModule::Thunderstore),
                ("planner".to_owned(), ProfileModule::PlannerInstalled),
                ("thunderstore".to_owned(), ProfileModule::Thunderstore),
                ("unreadable".to_owned(), ProfileModule::ModListUnreadable),
            ]
        );
    }

    #[test]
    fn forgetting_the_target_clears_only_the_saved_setting() {
        let temporary = TemporaryDirectory::new("forget");
        let target = target(&temporary.0.join("profile"), TargetKind::Discovered);
        let package = package("1.2.0", "return 1");
        install(
            &target,
            &package,
            &temporary.0.join("backup"),
            false,
            &mut NativeSwap,
        )
        .unwrap();
        write(
            &target
                .rom
                .join(CONFIG_DIRECTORY)
                .join(MODULE_DIRECTORY)
                .join("slot-1.runplanner.json"),
            "plan",
        );
        let config = temporary.0.join("app-config");
        remember_target(&config, &target).unwrap();
        let before = snapshot(&target.root);
        crate::game_target::forget_target(&config).unwrap();
        crate::game_target::forget_target(&config).unwrap();
        assert_eq!(snapshot(&target.root), before);
        let (status, resolved) = status(&config, &package);
        assert!(resolved.is_none());
        assert!(status.target.is_none());
        assert_eq!(status.publication_blockers[0].code, BlockerCode::NoTarget);
    }

    #[test]
    fn mods_yml_entries_are_read_by_top_level_name() {
        let entries = parse_mods_yml(
            "- manifestVersion: 1\n  name: A-B\n  dependencies:\n    - name: nested\n  enabled: true\n- name: 'C-D'\n  enabled: false\n",
        );
        let names: Vec<_> = entries
            .iter()
            .map(|entry| (entry.name.as_str(), entry.enabled))
            .collect();
        assert_eq!(names, [("A-B", Some(true)), ("C-D", Some(false))]);
    }
}
