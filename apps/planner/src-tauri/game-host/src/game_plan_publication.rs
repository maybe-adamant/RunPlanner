use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::atomic_file;
use crate::game_module_install::{
    installed_compatibility, status, InstalledModule, PublicationBlocker, TargetInspection,
};
use crate::game_module_package::{ModulePackage, PackageSource};
use crate::game_target::{existing_directory, ResolvedTarget, CONFIG_DIRECTORY};
use crate::plan_slots::{
    encode_active_slot, encode_slot, inspect_slots, read_slot, slot_file_name, PlanSlotState,
    ACTIVE_SLOT_FILE, MAX_PLAN_BYTES, MODULE_CONFIG_DIRECTORY,
};
use crate::slot_overview::{self, SlotSummary, SLOT_OVERVIEW_FILE};

// The plan fields the installed module's compatibility file must match.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlanHeader {
    format: String,
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
    /// The slot number is outside 1 through 12.
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

/// The module build a slot must name: this app's package or, in a development build
/// with a checkout install, the checkout as it is now.
fn reference_build_id(package: &ModulePackage, module: &InstalledModule) -> Result<String, String> {
    #[cfg(debug_assertions)]
    if module.source == Some(PackageSource::Checkout) {
        return crate::game_module_package::checkout_package().map(|checkout| checkout.build_id);
    }
    let _ = module;
    Ok(package.build_id.clone())
}

/// Writes one plan slot of an already-established target whose module accepts the
/// plan's header and is the reference build, as an envelope naming that build, together
/// with the slot overview that records its summary.
fn write_plan(
    target: &ResolvedTarget,
    module: &InstalledModule,
    reference_build_id: &str,
    slot_number: u8,
    plan_json: &str,
    summary: SlotSummary,
) -> Result<(), String> {
    slot_file_name(slot_number)?;
    let header: PlanHeader = serde_json::from_str(plan_json)
        .map_err(|error| format!("Invalid execution plan header: {error}"))?;
    let Some(installed) = installed_compatibility(target) else {
        return Err(
            "The installed game module has no build identity. Install it again from the Game panel."
                .to_owned(),
        );
    };
    if installed.format != header.format || installed.catalog_version != header.catalog_version {
        return Err(
            "Run Planner versions are incompatible. Update the app and game module together."
                .to_owned(),
        );
    }
    if installed.build_id != reference_build_id {
        return Err(if module.source == Some(PackageSource::Checkout) {
            "The installed game module is older than the checkout. Install from checkout again."
                .to_owned()
        } else {
            "The installed game module is not this app's build. Install it again from the Game panel."
                .to_owned()
        });
    }
    let envelope = encode_slot(&installed.build_id, plan_json);
    if envelope.len() > MAX_PLAN_BYTES {
        return Err(format!(
            "Game plan exceeds the {MAX_PLAN_BYTES}-byte limit."
        ));
    }
    let staged = stage_slot_and_overview(
        target,
        &installed.build_id,
        slot_number,
        envelope.as_bytes(),
        summary,
    )?;
    commit_slot_and_overview(staged)
}

/// A slot write and the overview regenerated with it, both staged in full, with a copy of
/// the slot's previous file to restore if the overview cannot follow.
struct StagedSend {
    slot: atomic_file::StagedFile,
    overview: atomic_file::StagedFile,
    /// `None` when the slot had no file.
    previous_slot: Option<atomic_file::StagedFile>,
    slot_destination: PathBuf,
}

fn stage_slot_and_overview(
    target: &ResolvedTarget,
    build_id: &str,
    slot_number: u8,
    envelope: &[u8],
    summary: SlotSummary,
) -> Result<StagedSend, String> {
    let slot_destination = safe_destination(target, slot_number)?;
    let overview_destination =
        shared_file_destination(target, SLOT_OVERVIEW_FILE, "slot overview")?;
    let slot = atomic_file::stage(&slot_destination, envelope, "plan slot")?;
    let mut slots = inspect_slots(target, Some(build_id));
    slots[usize::from(slot_number - 1)] = read_slot(slot_number, slot.path(), Some(build_id));
    let overview = slot_overview::regenerate(
        slot_overview::read_overview(&overview_destination),
        &slots,
        Some((slot_number, summary)),
    );
    let overview = atomic_file::stage(
        &overview_destination,
        slot_overview::encode_overview(&overview)?.as_bytes(),
        "slot overview",
    )?;
    let previous_slot = match fs::symlink_metadata(&slot_destination) {
        Ok(_) => Some(atomic_file::stage_copy(&slot_destination, "plan slot")?),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(format!("could not inspect plan slot: {error}")),
    };
    Ok(StagedSend {
        slot,
        overview,
        previous_slot,
        slot_destination,
    })
}

/// Commits the slot, then the overview; when the overview fails, the slot is restored
/// to its previous file, or removed when it had none, and the send fails.
fn commit_slot_and_overview(staged: StagedSend) -> Result<(), String> {
    let StagedSend {
        slot,
        overview,
        previous_slot,
        slot_destination,
    } = staged;
    slot.commit()?;
    let Err(problem) = overview.commit() else {
        return Ok(());
    };
    let restored = match previous_slot {
        Some(previous) => previous.commit(),
        None => fs::remove_file(&slot_destination)
            .map_err(|error| format!("could not remove plan slot: {error}")),
    };
    Err(match restored {
        Ok(()) => format!("{problem}; the plan slot was left as it was."),
        Err(restore) => format!("{problem}; restoring the plan slot also failed: {restore}"),
    })
}

fn write_active_slot(target: &ResolvedTarget, slot_number: u8) -> Result<(), String> {
    let content = encode_active_slot(slot_number)?;
    let destination = shared_file_destination(target, ACTIVE_SLOT_FILE, "active slot file")?;
    atomic_file::write(&destination, content.as_bytes(), "active slot file")
}

fn ready_target(
    config_dir: &Path,
    package: &ModulePackage,
) -> Result<(ResolvedTarget, TargetInspection), Vec<PublicationBlocker>> {
    let (status, target) = status(config_dir, package);
    match (target, status.inspection) {
        (Some(target), Some(inspection)) if status.publication_blockers.is_empty() => {
            Ok((target, inspection))
        }
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
    let (target, inspection) = match ready_target(config_dir, package) {
        Ok(ready) => ready,
        Err(blockers) => {
            return ActiveSlotSetting {
                status: ActivationStatus::Blocked,
                message: "The game target is not ready.".to_owned(),
                blockers,
            }
        }
    };
    let slot = &inspection.plan_slots[usize::from(slot_number - 1)];
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

/// Publishes to the remembered target only when its status has no blockers, writing the
/// slot and the overview that records its summary together, then makes that slot active.
pub fn publish(
    config_dir: &Path,
    package: &ModulePackage,
    slot_number: u8,
    plan_json: &str,
    summary: SlotSummary,
) -> GamePlanPublication {
    if let Err(message) = slot_file_name(slot_number).and(summary.validate()) {
        return native_write(message);
    }
    if plan_json.len() > MAX_PLAN_BYTES {
        return native_write(format!(
            "Game plan exceeds the {MAX_PLAN_BYTES}-byte limit."
        ));
    }
    let (target, inspection) = match ready_target(config_dir, package) {
        Ok(ready) => ready,
        Err(blockers) => {
            return GamePlanPublication {
                status: PublicationStatus::Blocked,
                message: "The game target is not ready for publication.".to_owned(),
                blockers,
                activation_problem: None,
            }
        }
    };
    let written = reference_build_id(package, &inspection.module).and_then(|reference| {
        write_plan(
            &target,
            &inspection.module,
            &reference,
            slot_number,
            plan_json,
            summary,
        )
    });
    if let Err(message) = written {
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
    use crate::game_module_install::test_support::package_from;
    use crate::game_module_install::test_support::{modpack_lib, package, target};
    use crate::game_module_install::{inspect, install, BlockerCode, NativeSwap};
    use crate::game_target::test_support::TemporaryDirectory;
    use crate::game_target::{remember_target, TargetKind};
    use crate::plan_slots::{inspect_active_slot, ActiveSlotFacts};
    use crate::slot_overview::test_support::summary;

    const PLAN: &str = r#"{"format":"run-planner-execution","catalogVersion":"test-catalog"}"#;

    fn ready_target(root: &Path, kind: TargetKind) -> (ResolvedTarget, ModulePackage) {
        let target = target(root, kind);
        modpack_lib(root, "4.2.0");
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
            let blocked = publish(&config, &package, 1, PLAN, summary("Circe - Surface"));
            assert_eq!(blocked.status, PublicationStatus::Blocked);
            assert_eq!(blocked.blockers[0].code, BlockerCode::NoTarget);
            remember_target(&config, &target).unwrap();
            let published = publish(&config, &package, 12, PLAN, summary("Circe - Surface"));
            assert_eq!(
                published.status,
                PublicationStatus::Published,
                "{}",
                published.message
            );
            assert_eq!(
                fs::read_to_string(safe_destination(&target, 12).unwrap()).unwrap(),
                encode_slot(&package.build_id, PLAN)
            );
            assert_eq!(published.activation_problem, None);
            assert_eq!(
                inspect_active_slot(&target),
                ActiveSlotFacts::Present { slot: 12 }
            );
        }
    }

    fn active_slot_path(target: &ResolvedTarget) -> PathBuf {
        safe_destination(target, 1)
            .unwrap()
            .with_file_name(ACTIVE_SLOT_FILE)
    }

    const PRESENT_PLAN: &str = r#"{"format":"run-planner-execution","catalogVersion":"test-catalog","projectId":"p","planFingerprint":"f","routeKey":"Underworld","extent":{"biomeKeys":["F"]}}"#;

    #[test]
    fn active_slot_is_set_only_on_a_ready_target_for_a_present_slot() {
        let temporary = TemporaryDirectory::new("active-set");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        fs::write(
            safe_destination(&target, 2).unwrap(),
            encode_slot(&package.build_id, PRESENT_PLAN),
        )
        .unwrap();
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
        for slot in [0, 13] {
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

    fn overview(target: &ResolvedTarget) -> serde_json::Value {
        let path = safe_destination(target, 1)
            .unwrap()
            .with_file_name(SLOT_OVERVIEW_FILE);
        serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap()
    }

    #[test]
    fn each_publication_regenerates_the_slot_overview_from_the_slots() {
        let temporary = TemporaryDirectory::new("publish-overview");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        let second = PRESENT_PLAN.replace(r#""f""#, r#""g""#);
        for (slot, plan, label) in [
            (1, PRESENT_PLAN, "Circe - Surface"),
            (12, second.as_str(), "Momus - Underworld"),
            (5, PRESENT_PLAN, "Anubis - Surface"),
        ] {
            let published = publish(&config, &package, slot, plan, summary(label));
            assert_eq!(
                published.status,
                PublicationStatus::Published,
                "{}",
                published.message
            );
        }
        let written = overview(&target);
        assert_eq!(written["format"], "run-planner-slot-overview");
        assert_eq!(written["formatVersion"], 1);
        assert_eq!(written["slots"]["12"]["label"], "Momus - Underworld");
        assert_eq!(written["slots"]["12"]["fingerprint"], "g");
        assert_eq!(written["slots"]["12"]["buildId"], package.build_id.as_str());
        assert_eq!(written["slots"]["1"]["startingFear"], 12);
        // A slot replaced or cleared outside the planner loses its entry at the next send.
        fs::write(
            safe_destination(&target, 1).unwrap(),
            encode_slot(&package.build_id, &second),
        )
        .unwrap();
        fs::remove_file(safe_destination(&target, 5).unwrap()).unwrap();
        // A plan without a readable identity is written but has no entry.
        publish(&config, &package, 3, PLAN, summary("Unread"));
        let regenerated = overview(&target);
        let slots = regenerated["slots"].as_object().unwrap();
        assert_eq!(slots.keys().collect::<Vec<_>>(), ["12"]);
        let names: Vec<String> = fs::read_dir(active_slot_path(&target).parent().unwrap())
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert!(
            names.iter().all(|name| !name.ends_with(".tmp")),
            "{names:?}"
        );
    }

    fn config_files(target: &ResolvedTarget) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(active_slot_path(target).parent().unwrap())
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        names
    }

    #[test]
    fn a_send_whose_summary_or_overview_cannot_be_written_writes_nothing() {
        let temporary = TemporaryDirectory::new("publish-overview-fail");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        let refused = publish(&config, &package, 2, PRESENT_PLAN, summary(""));
        assert_eq!(refused.status, PublicationStatus::NativeWrite);
        assert_eq!(refused.message, "Invalid plan slot summary.");
        assert!(!safe_destination(&target, 2).unwrap().exists());
        fs::create_dir_all(
            safe_destination(&target, 1)
                .unwrap()
                .with_file_name(SLOT_OVERVIEW_FILE),
        )
        .unwrap();
        let blocked = publish(
            &config,
            &package,
            2,
            PRESENT_PLAN,
            summary("Circe - Surface"),
        );
        assert_eq!(blocked.status, PublicationStatus::NativeWrite);
        assert_eq!(blocked.message, "slot overview must be a regular file");
        assert!(!safe_destination(&target, 2).unwrap().exists());
        assert!(!active_slot_path(&target).exists());
        assert_eq!(config_files(&target), [SLOT_OVERVIEW_FILE]);
    }

    #[test]
    fn an_overview_that_cannot_be_committed_rolls_the_slot_back() {
        let temporary = TemporaryDirectory::new("publish-rollback");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        publish(
            &config,
            &package,
            1,
            PRESENT_PLAN,
            summary("Circe - Surface"),
        );
        let previous_slot = fs::read(safe_destination(&target, 1).unwrap()).unwrap();
        let previous_overview = overview(&target);
        let overview_path = safe_destination(&target, 1)
            .unwrap()
            .with_file_name(SLOT_OVERVIEW_FILE);
        let second = PRESENT_PLAN.replace(r#""f""#, r#""g""#);
        for (slot, existed) in [(1, true), (4, false)] {
            let envelope = encode_slot(&package.build_id, &second);
            let staged = stage_slot_and_overview(
                &target,
                &package.build_id,
                slot,
                envelope.as_bytes(),
                summary("Momus - Underworld"),
            )
            .unwrap();
            // The overview's destination stops accepting a file after staging.
            fs::remove_file(&overview_path).unwrap();
            fs::create_dir(&overview_path).unwrap();
            fs::write(overview_path.join("held"), "x").unwrap();
            let failed = commit_slot_and_overview(staged).unwrap_err();
            assert!(
                failed.ends_with("; the plan slot was left as it was."),
                "{failed}"
            );
            assert_eq!(safe_destination(&target, slot).unwrap().exists(), existed);
            fs::remove_dir_all(&overview_path).unwrap();
            fs::write(&overview_path, previous_overview.to_string()).unwrap();
        }
        assert_eq!(
            fs::read(safe_destination(&target, 1).unwrap()).unwrap(),
            previous_slot
        );
        assert_eq!(
            inspect_active_slot(&target),
            ActiveSlotFacts::Present { slot: 1 }
        );
        assert_eq!(
            config_files(&target),
            [
                ACTIVE_SLOT_FILE,
                "slot-1.runplanner.json",
                SLOT_OVERVIEW_FILE
            ]
        );
    }

    #[test]
    fn a_failed_activation_after_publishing_keeps_the_plan_and_says_so() {
        let temporary = TemporaryDirectory::new("publish-activation");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        fs::create_dir_all(active_slot_path(&target)).unwrap();
        let published = publish(&config, &package, 3, PLAN, summary("Circe - Surface"));
        assert_eq!(published.status, PublicationStatus::Published);
        assert_eq!(
            published.activation_problem.as_deref(),
            Some("active slot file must be a regular file")
        );
        assert_eq!(
            fs::read_to_string(safe_destination(&target, 3).unwrap()).unwrap(),
            encode_slot(&package.build_id, PLAN)
        );
        fs::write(
            safe_destination(&target, 3).unwrap(),
            encode_slot(&package.build_id, PRESENT_PLAN),
        )
        .unwrap();
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
        publish(&config, &package, 2, PLAN, summary("Circe - Surface"));
        let newer = crate::game_module_install::test_support::package("1.3.0", "return 2");
        let mismatch = publish(
            &config,
            &newer,
            2,
            r#"{"other":true}"#,
            summary("Circe - Surface"),
        );
        assert_eq!(mismatch.status, PublicationStatus::Blocked);
        assert_eq!(mismatch.blockers[0].code, BlockerCode::ModuleMismatch);
        assert_eq!(mismatch.blockers[0].found.as_deref(), Some("1.2.0"));
        assert_eq!(mismatch.blockers[0].required.as_deref(), Some("1.3.0"));
        modpack_lib(&target.root, "4.0.1");
        let older = publish(
            &config,
            &package,
            2,
            r#"{"other":true}"#,
            summary("Circe - Surface"),
        );
        assert_eq!(older.blockers[0].code, BlockerCode::ModpackLibOlder);
        assert_eq!(older.blockers[0].found.as_deref(), Some("4.0.1"));
        assert_eq!(older.blockers[0].required.as_deref(), Some("4.2.0"));
        assert_eq!(
            fs::read_to_string(safe_destination(&target, 2).unwrap()).unwrap(),
            encode_slot(&package.build_id, PLAN)
        );
    }

    #[test]
    fn publication_keeps_the_compatibility_guard_and_size_bound() {
        let temporary = TemporaryDirectory::new("publish-guard");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        publish(&config, &package, 4, PLAN, summary("Circe - Surface"));
        for plan in [
            r#"{"format":"run-planner-execution","catalogVersion":"other"}"#,
            "{}",
        ] {
            assert_eq!(
                publish(&config, &package, 4, plan, summary("Circe - Surface")).status,
                PublicationStatus::NativeWrite
            );
        }
        let oversized = format!("{}{}", &PLAN[..PLAN.len() - 1], " ".repeat(MAX_PLAN_BYTES));
        // The bound covers the written envelope, not only the plan.
        let envelope_overhead = encode_slot(&package.build_id, "").len();
        let fills_the_envelope = format!(
            "{}{}}}",
            &PLAN[..PLAN.len() - 1],
            " ".repeat(MAX_PLAN_BYTES - PLAN.len() - envelope_overhead + 1)
        );
        for plan in [oversized, fills_the_envelope] {
            assert_eq!(
                publish(&config, &package, 4, &plan, summary("Circe - Surface")).status,
                PublicationStatus::NativeWrite
            );
        }
        for slot in [0, 13, u8::MAX] {
            assert_eq!(
                publish(&config, &package, slot, PLAN, summary("Circe - Surface")).message,
                format!("plan slot must be between 1 and 12 (got {slot})")
            );
        }
        assert_eq!(
            fs::read_to_string(safe_destination(&target, 4).unwrap()).unwrap(),
            encode_slot(&package.build_id, PLAN)
        );
    }

    #[test]
    fn the_slot_envelope_names_the_installed_build_and_keeps_the_plan_bytes() {
        let temporary = TemporaryDirectory::new("publish-envelope");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        let plan = "{ \"catalogVersion\" : \"test-catalog\",\n  \"format\":\"run-planner-execution\",\"note\":\"é\\u00e9\" }";
        assert_eq!(
            publish(&config, &package, 1, plan, summary("Circe - Surface")).status,
            PublicationStatus::Published
        );
        let written = fs::read_to_string(safe_destination(&target, 1).unwrap()).unwrap();
        let prefix = format!(
            r#"{{"format":"run-planner-slot","buildId":"{}","plan":"#,
            package.build_id
        );
        assert_eq!(written, format!("{prefix}{plan}}}"));
        let envelope: serde_json::Value = serde_json::from_str(&written).unwrap();
        assert_eq!(
            envelope["plan"],
            serde_json::from_str::<serde_json::Value>(plan).unwrap()
        );
    }

    #[test]
    fn publication_refuses_a_module_that_is_not_the_reference_build() {
        let temporary = TemporaryDirectory::new("publish-build");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        let module = inspect(&target, &package).unwrap().module;
        assert_eq!(module.build_id.as_deref(), Some(package.build_id.as_str()));
        assert_eq!(
            write_plan(&target, &module, "another-build", 1, PLAN, summary("Circe - Surface")),
            Err("The installed game module is not this app's build. Install it again from the Game panel.".to_owned())
        );
        let compatibility = crate::game_module_install::test_support::module_path(&target)
            .join("execution-compatibility.json");
        fs::write(
            &compatibility,
            r#"{"format":"run-planner-execution","catalogVersion":"test-catalog"}"#,
        )
        .unwrap();
        assert_eq!(
            write_plan(&target, &module, &package.build_id, 1, PLAN, summary("Circe - Surface")),
            Err("The installed game module has no build identity. Install it again from the Game panel.".to_owned())
        );
        assert!(!safe_destination(&target, 1).unwrap().exists());
    }

    #[cfg(debug_assertions)]
    #[test]
    fn a_checkout_install_must_match_the_checkout_as_it_is_now() {
        let temporary = TemporaryDirectory::new("publish-checkout");
        let config = temporary.0.join("app-config");
        let root = temporary.0.join("target");
        let target = target(&root, TargetKind::Manual);
        modpack_lib(&root, "4.2.0");
        let bundled = package("1.2.0", "return 1");
        let installed = package_from("1.2.0", "return 0", PackageSource::Checkout);
        install(
            &target,
            &installed,
            &root.join("backup"),
            false,
            &mut NativeSwap,
        )
        .unwrap();
        remember_target(&config, &target).unwrap();
        let refused = publish(&config, &bundled, 1, PLAN, summary("Circe - Surface"));
        assert_eq!(refused.status, PublicationStatus::NativeWrite);
        assert_eq!(
            refused.message,
            "The installed game module is older than the checkout. Install from checkout again."
        );
        assert!(!safe_destination(&target, 1).unwrap().exists());
    }

    #[test]
    fn slot_numbers_map_to_the_twelve_closed_filenames_and_replace_only_that_slot() {
        let temporary = TemporaryDirectory::new("slots");
        let (target, _) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        for slot_number in 1_u8..=12 {
            let expected = format!("slot-{slot_number}.runplanner.json");
            let destination = safe_destination(&target, slot_number).unwrap();
            assert_eq!(
                destination.file_name().and_then(|name| name.to_str()),
                Some(expected.as_str())
            );
        }
        let write = |slot, bytes: &[u8]| {
            atomic_file::write(
                &safe_destination(&target, slot).unwrap(),
                bytes,
                "plan slot",
            )
            .unwrap()
        };
        write(1, b"one");
        write(2, b"two");
        write(1, b"uno");
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
