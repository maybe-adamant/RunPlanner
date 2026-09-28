use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::atomic_file;
use crate::game_module_install::{status, PublicationBlocker, MODULE_DIRECTORY};
use crate::game_module_package::ModulePackage;
use crate::game_target::{existing_directory, ResolvedTarget, CONFIG_DIRECTORY, PLUGINS_DIRECTORY};
use crate::plan_slots::{
    encode_active_slot, inspect_slots, slot_file_name, PlanSlotState, ACTIVE_SLOT_FILE,
    MAX_PLAN_BYTES, MODULE_CONFIG_DIRECTORY,
};

const MAX_COMPATIBILITY_BYTES: u64 = 16_384;

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ExecutionCompatibility {
    format: String,
    protocol_version: u32,
    catalog_version: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PublicationStatus {
    Published,
    Blocked,
    NativeWrite,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GamePlanPublication {
    pub status: PublicationStatus,
    pub message: String,
    pub blockers: Vec<PublicationBlocker>,
    /// Why a published plan's slot was not made active; the plan stays written.
    pub activation_problem: Option<String>,
}

fn native_write(message: String) -> GamePlanPublication {
    GamePlanPublication {
        status: PublicationStatus::NativeWrite,
        message,
        blockers: Vec::new(),
        activation_problem: None,
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ActivationStatus {
    Activated,
    /// The slot number is outside 1 through 6.
    InvalidSlot,
    Blocked,
    /// The slot holds no readable plan, so it cannot be made active.
    NotPresent,
    NativeWrite,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveSlotSetting {
    pub status: ActivationStatus,
    pub message: String,
    pub blockers: Vec<PublicationBlocker>,
}

fn activation(status: ActivationStatus, message: String) -> ActiveSlotSetting {
    ActiveSlotSetting {
        status,
        message,
        blockers: Vec::new(),
    }
}

fn installed_compatibility(target: &ResolvedTarget) -> Option<ExecutionCompatibility> {
    let path = target
        .rom
        .join(PLUGINS_DIRECTORY)
        .join(MODULE_DIRECTORY)
        .join("execution-compatibility.json");
    let metadata = fs::symlink_metadata(&path).ok()?;
    if !metadata.is_file() || metadata.len() > MAX_COMPATIBILITY_BYTES {
        return None;
    }
    serde_json::from_slice(&fs::read(path).ok()?).ok()
}

fn safe_destination(target: &ResolvedTarget, slot_number: u8) -> Result<PathBuf, String> {
    shared_file_destination(target, slot_file_name(slot_number)?, "plan slot")
}

// A regular file or absent entry directly inside the module's config folder.
fn shared_file_destination(
    target: &ResolvedTarget,
    file_name: &str,
    artifact: &str,
) -> Result<PathBuf, String> {
    let rom = &target.rom;
    let config = rom.join(CONFIG_DIRECTORY);
    if !config.exists() {
        fs::create_dir(&config)
            .map_err(|error| format!("could not create config directory: {error}"))?;
    }
    existing_directory(&config, rom)?;
    let module_config = config.join(MODULE_CONFIG_DIRECTORY);
    if !module_config.exists() {
        fs::create_dir(&module_config)
            .map_err(|error| format!("could not create module config directory: {error}"))?;
    }
    let module_config = existing_directory(&module_config, rom)?;
    let destination = module_config.join(file_name);
    match fs::symlink_metadata(&destination) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() || !metadata.is_file() {
                return Err(format!("{artifact} must be a regular file"));
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => {
            return Err(format!("could not inspect {artifact}: {error}"));
        }
    }
    Ok(destination)
}

fn bounded_atomic_write(
    target: &ResolvedTarget,
    slot_number: u8,
    bytes: &[u8],
) -> Result<(), String> {
    if bytes.len() > MAX_PLAN_BYTES {
        return Err(format!(
            "Game plan exceeds the {MAX_PLAN_BYTES}-byte limit."
        ));
    }
    let destination = safe_destination(target, slot_number)?;
    atomic_file::write(&destination, bytes, "plan slot")
}

/// Writes one plan slot of an already-established target whose module
/// accepts the plan's execution header.
fn write_plan(target: &ResolvedTarget, slot_number: u8, plan_json: &str) -> Result<(), String> {
    slot_file_name(slot_number)?;
    if plan_json.len() > MAX_PLAN_BYTES {
        return Err(format!(
            "Game plan exceeds the {MAX_PLAN_BYTES}-byte limit."
        ));
    }
    let header: ExecutionCompatibility = serde_json::from_str(plan_json)
        .map_err(|error| format!("Invalid execution plan header: {error}"))?;
    if installed_compatibility(target).as_ref() != Some(&header) {
        return Err(
            "Run Planner versions are incompatible. Update the app and game module together."
                .to_owned(),
        );
    }
    bounded_atomic_write(target, slot_number, plan_json.as_bytes())
}

fn write_active_slot(target: &ResolvedTarget, slot_number: u8) -> Result<(), String> {
    let content = encode_active_slot(slot_number)?;
    let destination = shared_file_destination(target, ACTIVE_SLOT_FILE, "active slot file")?;
    atomic_file::write(&destination, content.as_bytes(), "active slot file")
}

fn ready_target(
    config_dir: &Path,
    package: &ModulePackage,
) -> Result<ResolvedTarget, Vec<PublicationBlocker>> {
    let (status, target) = status(config_dir, package);
    match target {
        Some(target) if status.publication_blockers.is_empty() => Ok(target),
        _ => Err(status.publication_blockers),
    }
}

/// Makes a slot that holds a readable plan active, under the same target checks as publishing.
pub fn set_active_slot(
    config_dir: &Path,
    package: &ModulePackage,
    slot_number: u8,
) -> ActiveSlotSetting {
    if let Err(message) = slot_file_name(slot_number) {
        return activation(ActivationStatus::InvalidSlot, message);
    }
    let target = match ready_target(config_dir, package) {
        Ok(target) => target,
        Err(blockers) => {
            return ActiveSlotSetting {
                status: ActivationStatus::Blocked,
                message: "The game target is not ready.".to_owned(),
                blockers,
            }
        }
    };
    let slot = &inspect_slots(&target)[usize::from(slot_number - 1)];
    if slot.state != PlanSlotState::Present {
        return activation(
            ActivationStatus::NotPresent,
            format!("Slot {slot_number} has no plan to make active."),
        );
    }
    match write_active_slot(&target, slot_number) {
        Ok(()) => activation(
            ActivationStatus::Activated,
            format!("Slot {slot_number} is active."),
        ),
        Err(message) => activation(ActivationStatus::NativeWrite, message),
    }
}

/// Publishes to the remembered target only when its status has no blockers, then
/// makes that slot active.
pub fn publish(
    config_dir: &Path,
    package: &ModulePackage,
    slot_number: u8,
    plan_json: &str,
) -> GamePlanPublication {
    if let Err(message) = slot_file_name(slot_number) {
        return native_write(message);
    }
    if plan_json.len() > MAX_PLAN_BYTES {
        return native_write(format!(
            "Game plan exceeds the {MAX_PLAN_BYTES}-byte limit."
        ));
    }
    let target = match ready_target(config_dir, package) {
        Ok(target) => target,
        Err(blockers) => {
            return GamePlanPublication {
                status: PublicationStatus::Blocked,
                message: "The game target is not ready for publication.".to_owned(),
                blockers,
                activation_problem: None,
            }
        }
    };
    if let Err(message) = write_plan(&target, slot_number, plan_json) {
        return native_write(message);
    }
    let activation_problem = write_active_slot(&target, slot_number).err();
    GamePlanPublication {
        status: PublicationStatus::Published,
        message: match activation_problem {
            None => format!("Published to Slot {slot_number}; it is now active."),
            Some(_) => format!("Published to Slot {slot_number}, but it was not made active."),
        },
        blockers: Vec::new(),
        activation_problem,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_module_install::test_support::{modpack_lib, package, target};
    use crate::game_module_install::{install, BlockerCode, NativeSwap};
    use crate::game_target::test_support::TemporaryDirectory;
    use crate::game_target::{remember_target, TargetKind};
    use crate::plan_slots::{inspect_active_slot, ActiveSlotFacts};

    const PLAN: &str = r#"{"format":"run-planner-execution","protocolVersion":42,"catalogVersion":"test-catalog"}"#;

    fn ready_target(root: &Path, kind: TargetKind) -> (ResolvedTarget, ModulePackage) {
        let target = target(root, kind);
        modpack_lib(root, "4.1.0");
        let package = package("1.2.0", "return 1");
        install(
            &target,
            &package,
            &root.join("backup"),
            false,
            &mut NativeSwap,
        )
        .unwrap();
        (target, package)
    }

    #[test]
    fn publication_writes_only_to_a_ready_established_target() {
        for kind in [TargetKind::Discovered, TargetKind::Manual] {
            let temporary = TemporaryDirectory::new("publish");
            let config = temporary.0.join("app-config");
            let (target, package) = ready_target(&temporary.0.join("target"), kind);
            let blocked = publish(&config, &package, 1, PLAN);
            assert_eq!(blocked.status, PublicationStatus::Blocked);
            assert_eq!(blocked.blockers[0].code, BlockerCode::NoTarget);
            remember_target(&config, &target).unwrap();
            let published = publish(&config, &package, 6, PLAN);
            assert_eq!(
                published.status,
                PublicationStatus::Published,
                "{}",
                published.message
            );
            assert_eq!(
                fs::read_to_string(safe_destination(&target, 6).unwrap()).unwrap(),
                PLAN
            );
            assert_eq!(published.activation_problem, None);
            assert_eq!(
                inspect_active_slot(&target),
                ActiveSlotFacts::Present { slot: 6 }
            );
        }
    }

    fn active_slot_path(target: &ResolvedTarget) -> PathBuf {
        safe_destination(target, 1)
            .unwrap()
            .with_file_name(ACTIVE_SLOT_FILE)
    }

    const PRESENT_PLAN: &str = r#"{"format":"run-planner-execution","protocolVersion":42,"catalogVersion":"test-catalog","projectId":"p","planFingerprint":"f","routeKey":"Underworld","extent":{"biomeKeys":["F"]}}"#;

    #[test]
    fn active_slot_is_set_only_on_a_ready_target_for_a_present_slot() {
        let temporary = TemporaryDirectory::new("active-set");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        fs::write(safe_destination(&target, 2).unwrap(), PRESENT_PLAN).unwrap();
        let unset = set_active_slot(&config, &package, 2);
        assert_eq!(unset.status, ActivationStatus::Blocked);
        assert_eq!(unset.blockers[0].code, BlockerCode::NoTarget);
        remember_target(&config, &target).unwrap();
        let newer = crate::game_module_install::test_support::package("1.3.0", "return 2");
        let mismatch = set_active_slot(&config, &newer, 2);
        assert_eq!(mismatch.status, ActivationStatus::Blocked);
        assert_eq!(mismatch.blockers[0].code, BlockerCode::ModuleMismatch);
        fs::write(safe_destination(&target, 3).unwrap(), "not a plan").unwrap();
        for slot in [1, 3] {
            let refused = set_active_slot(&config, &package, slot);
            assert_eq!(refused.status, ActivationStatus::NotPresent);
            assert_eq!(
                refused.message,
                format!("Slot {slot} has no plan to make active.")
            );
        }
        for slot in [0, 7] {
            assert_eq!(
                set_active_slot(&config, &package, slot).status,
                ActivationStatus::InvalidSlot
            );
        }
        assert!(!active_slot_path(&target).exists());
        fs::write(active_slot_path(&target), "stale").unwrap();
        let set = set_active_slot(&config, &package, 2);
        assert_eq!(set.status, ActivationStatus::Activated, "{}", set.message);
        assert_eq!(
            fs::read_to_string(active_slot_path(&target)).unwrap(),
            r#"{"format":"run-planner-active-slot","formatVersion":1,"slot":2}"#
        );
        let names: Vec<String> = fs::read_dir(active_slot_path(&target).parent().unwrap())
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert!(
            names.iter().all(|name| !name.ends_with(".tmp")),
            "{names:?}"
        );
    }

    #[test]
    fn a_failed_activation_after_publishing_keeps_the_plan_and_says_so() {
        let temporary = TemporaryDirectory::new("publish-activation");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        fs::create_dir_all(active_slot_path(&target)).unwrap();
        let published = publish(&config, &package, 3, PLAN);
        assert_eq!(published.status, PublicationStatus::Published);
        assert_eq!(
            published.activation_problem.as_deref(),
            Some("active slot file must be a regular file")
        );
        assert_eq!(
            fs::read_to_string(safe_destination(&target, 3).unwrap()).unwrap(),
            PLAN
        );
        fs::write(safe_destination(&target, 3).unwrap(), PRESENT_PLAN).unwrap();
        assert_eq!(
            set_active_slot(&config, &package, 3).status,
            ActivationStatus::NativeWrite
        );
    }

    #[test]
    fn publication_is_blocked_by_a_mismatched_module_or_incompatible_modpack_lib() {
        let temporary = TemporaryDirectory::new("publish-blocked");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Discovered);
        remember_target(&config, &target).unwrap();
        publish(&config, &package, 2, PLAN);
        let newer = crate::game_module_install::test_support::package("1.3.0", "return 2");
        let mismatch = publish(&config, &newer, 2, r#"{"other":true}"#);
        assert_eq!(mismatch.status, PublicationStatus::Blocked);
        assert_eq!(mismatch.blockers[0].code, BlockerCode::ModuleMismatch);
        assert_eq!(mismatch.blockers[0].found.as_deref(), Some("1.2.0"));
        assert_eq!(mismatch.blockers[0].required.as_deref(), Some("1.3.0"));
        modpack_lib(&target.root, "4.0.1");
        let older = publish(&config, &package, 2, r#"{"other":true}"#);
        assert_eq!(older.blockers[0].code, BlockerCode::ModpackLibOlder);
        assert_eq!(older.blockers[0].found.as_deref(), Some("4.0.1"));
        assert_eq!(older.blockers[0].required.as_deref(), Some("4.1.0"));
        assert_eq!(
            fs::read_to_string(safe_destination(&target, 2).unwrap()).unwrap(),
            PLAN
        );
    }

    #[test]
    fn publication_keeps_the_protocol_guard_and_size_bound() {
        let temporary = TemporaryDirectory::new("publish-guard");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        publish(&config, &package, 4, PLAN);
        for plan in [
            r#"{"format":"run-planner-execution","protocolVersion":43,"catalogVersion":"test-catalog"}"#,
            r#"{"format":"run-planner-execution","protocolVersion":42,"catalogVersion":"other"}"#,
            "{}",
        ] {
            assert_eq!(
                publish(&config, &package, 4, plan).status,
                PublicationStatus::NativeWrite
            );
        }
        let oversized = format!("{}{}", &PLAN[..PLAN.len() - 1], " ".repeat(MAX_PLAN_BYTES));
        assert_eq!(
            publish(&config, &package, 4, &oversized).status,
            PublicationStatus::NativeWrite
        );
        for slot in [0, 7, u8::MAX] {
            assert_eq!(
                publish(&config, &package, slot, PLAN).message,
                format!("plan slot must be between 1 and 6 (got {slot})")
            );
        }
        assert_eq!(
            fs::read_to_string(safe_destination(&target, 4).unwrap()).unwrap(),
            PLAN
        );
    }

    #[test]
    fn slot_numbers_map_to_the_six_closed_filenames_and_replace_only_that_slot() {
        let temporary = TemporaryDirectory::new("slots");
        let (target, _) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        for slot_number in 1_u8..=6 {
            let expected = format!("slot-{slot_number}.runplanner.json");
            let destination = safe_destination(&target, slot_number).unwrap();
            assert_eq!(
                destination.file_name().and_then(|name| name.to_str()),
                Some(expected.as_str())
            );
        }
        bounded_atomic_write(&target, 1, b"one").unwrap();
        bounded_atomic_write(&target, 2, b"two").unwrap();
        bounded_atomic_write(&target, 1, b"uno").unwrap();
        assert_eq!(
            fs::read(safe_destination(&target, 1).unwrap()).unwrap(),
            b"uno"
        );
        assert_eq!(
            fs::read(safe_destination(&target, 2).unwrap()).unwrap(),
            b"two"
        );
    }

    #[cfg(unix)]
    #[test]
    fn publication_rejects_symlink_escape_without_writing() {
        use std::os::unix::fs::symlink;
        let temporary = TemporaryDirectory::new("publish-link");
        let (target, _) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        let outside = temporary.0.join("outside");
        fs::create_dir(&outside).unwrap();
        symlink(&outside, target.rom.join(CONFIG_DIRECTORY)).unwrap();
        assert!(safe_destination(&target, 1).is_err());
        assert_eq!(fs::read_dir(outside).unwrap().count(), 0);
    }
}
