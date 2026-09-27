use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::atomic_file;
use crate::game_module_install::{status, PublicationBlocker, MODULE_DIRECTORY};
use crate::game_module_package::ModulePackage;
use crate::game_target::{existing_directory, ResolvedTarget, CONFIG_DIRECTORY, PLUGINS_DIRECTORY};

const MAX_PLAN_BYTES: usize = 1_048_576;
const MAX_COMPATIBILITY_BYTES: u64 = 16_384;

const PLAN_SLOT_FILES: [&str; 6] = [
    "slot-1.runplanner.json",
    "slot-2.runplanner.json",
    "slot-3.runplanner.json",
    "slot-4.runplanner.json",
    "slot-5.runplanner.json",
    "slot-6.runplanner.json",
];

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
}

fn native_write(message: String) -> GamePlanPublication {
    GamePlanPublication {
        status: PublicationStatus::NativeWrite,
        message,
        blockers: Vec::new(),
    }
}

fn slot_file_name(slot_number: u8) -> Result<&'static str, String> {
    match slot_number {
        1..=6 => Ok(PLAN_SLOT_FILES[usize::from(slot_number - 1)]),
        slot => Err(format!("plan slot must be between 1 and 6 (got {slot})")),
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
    let slot_file = slot_file_name(slot_number)?;
    let rom = &target.rom;
    let config = rom.join(CONFIG_DIRECTORY);
    if !config.exists() {
        fs::create_dir(&config)
            .map_err(|error| format!("could not create config directory: {error}"))?;
    }
    existing_directory(&config, rom)?;
    let module_config = config.join(MODULE_DIRECTORY);
    if !module_config.exists() {
        fs::create_dir(&module_config)
            .map_err(|error| format!("could not create module config directory: {error}"))?;
    }
    let module_config = existing_directory(&module_config, rom)?;
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

/// Publishes to the remembered target only when its status has no blockers.
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
    let (status, target) = status(config_dir, package);
    let target = match target {
        Some(target) if status.publication_blockers.is_empty() => target,
        _ => {
            return GamePlanPublication {
                status: PublicationStatus::Blocked,
                message: "The game target is not ready for publication.".to_owned(),
                blockers: status.publication_blockers,
            }
        }
    };
    match write_plan(&target, slot_number, plan_json) {
        Ok(()) => GamePlanPublication {
            status: PublicationStatus::Published,
            message: format!("Published to Slot {slot_number}."),
            blockers: Vec::new(),
        },
        Err(message) => native_write(message),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_module_install::test_support::{modpack_lib, package, target};
    use crate::game_module_install::{install, BlockerCode, NativeSwap};
    use crate::game_target::test_support::TemporaryDirectory;
    use crate::game_target::{remember_target, TargetKind};

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
        }
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
        for (slot_number, expected) in (1_u8..=6).zip(PLAN_SLOT_FILES) {
            let destination = safe_destination(&target, slot_number).unwrap();
            assert_eq!(
                destination.file_name().and_then(|name| name.to_str()),
                Some(expected)
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
