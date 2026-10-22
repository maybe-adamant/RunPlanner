use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::atomic_file;
use crate::community_event::{parse_instant, Instant};
use crate::game_module_install::{
    installed_compatibility, status, PublicationBlocker, TargetInspection,
};
use crate::game_module_package::{ExecutionCompatibility, ModulePackage};
use crate::game_target::{existing_directory, ResolvedTarget, CONFIG_DIRECTORY};
use crate::plan_slots::{
    any_slot_file_name, empty_slot, encode_active_slot, inspect_active_slot, inspect_all_slots,
    read_slot, read_slot_plan, read_slot_source, slot_file_name, slot_source_file_name,
    valid_slot_source, ActiveSlotFacts, PlanSlotState, ACTIVE_SLOT_FILE, EVENT_SLOT,
    MAX_PLAN_BYTES, MAX_SLOT_SOURCE_BYTES, MODULE_CONFIG_DIRECTORY,
};
use crate::slot_overview::{self, SentEntry, SlotEvent, SlotSummary, SLOT_OVERVIEW_FILE};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlanIdentity {
    plan_fingerprint: String,
}

// The plan fields the installed module's compatibility file must match.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlanHeader {
    format: String,
    catalog_version: String,
    schema_version: u32,
    schema_revision: u32,
}

impl PlanHeader {
    fn compatibility(self) -> ExecutionCompatibility {
        ExecutionCompatibility {
            format: self.format,
            catalog_version: self.catalog_version,
            schema_version: self.schema_version,
            schema_revision: self.schema_revision,
        }
    }
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

fn blocked(message: &str, blockers: Vec<PublicationBlocker>) -> GamePlanPublication {
    GamePlanPublication {
        status: PublicationStatus::Blocked,
        message: message.to_owned(),
        blockers,
        activation_problem: None,
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ActivationStatus {
    Activated,
    /// The slot number is outside 0 through 12.
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

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum EventClearStatus {
    Cleared,
    /// The event slot had no file and the overview no entry for it.
    AlreadyEmpty,
    /// Without verified event data, the event slot is cleared only once its own event ended.
    Kept,
    Blocked,
    NativeWrite,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventSlotClearing {
    pub status: EventClearStatus,
    pub message: String,
    pub blockers: Vec<PublicationBlocker>,
    /// The event the cleared slot held, as its overview entry named it.
    pub cleared_event: Option<SlotEvent>,
    /// The event slot was active, so slot 1 was made active instead.
    pub active_slot_moved: bool,
    /// Why the event slot stayed active although it is now empty.
    pub activation_problem: Option<String>,
    /// Whether slot 1, which takes over from an active event slot, holds a plan.
    pub fallback_slot_has_plan: bool,
}

fn safe_destination(target: &ResolvedTarget, slot_number: u8) -> Result<PathBuf, String> {
    shared_file_destination(target, any_slot_file_name(slot_number)?, "plan slot")
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

/// Writes one slot of an already-established target whose module admits the plan's
/// format, catalog and schema pair, together with its source, when it has one, and the slot
/// overview that records its entry.
fn write_plan(
    target: &ResolvedTarget,
    plan_json: &str,
    source: Option<&str>,
    entry: SentEntry,
) -> Result<(), String> {
    any_slot_file_name(entry.slot)?;
    let header = serde_json::from_str::<PlanHeader>(plan_json)
        .map_err(|error| format!("Invalid execution plan header: {error}"))?
        .compatibility();
    if installed_compatibility(target).as_ref() != Some(&header) {
        return Err(
            "The game module was made for another Run Planner version. Update it from the Game panel."
                .to_owned(),
        );
    }
    let staged = stage_slot_and_overview(
        target,
        Some(&header),
        entry.slot,
        SlotChange::Write {
            plan: plan_json.as_bytes(),
            source: source.map(str::as_bytes),
            entry: Some(Box::new(entry)),
        },
    )?;
    commit_slot_and_overview(staged)
}

/// What a staged send does to its slot. A write without a source removes any source left
/// beside the slot, so a source always describes the plan it sits beside; one without an entry
/// leaves the slot without a summary.
enum SlotChange<'a> {
    Write {
        plan: &'a [u8],
        source: Option<&'a [u8]>,
        entry: Option<Box<SentEntry>>,
    },
    Remove,
}

/// One file of a staged change: its new content (`None` removes it) and a copy of its previous
/// file (`None` when it had none) to restore if a later file cannot follow.
struct StagedReplacement {
    destination: PathBuf,
    next: Option<atomic_file::StagedFile>,
    previous: Option<atomic_file::StagedFile>,
}

impl StagedReplacement {
    fn new(
        destination: PathBuf,
        next: Option<atomic_file::StagedFile>,
        artifact: &str,
    ) -> Result<Self, String> {
        let previous = match fs::symlink_metadata(&destination) {
            Ok(_) => Some(atomic_file::stage_copy(&destination, artifact)?),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
            Err(error) => return Err(format!("could not inspect {artifact}: {error}")),
        };
        Ok(Self {
            destination,
            next,
            previous,
        })
    }

    /// Commits the change and returns the copy that restores the previous file.
    fn commit(self) -> Result<Restore, String> {
        match self.next {
            Some(next) => next.commit()?,
            None => remove_file(&self.destination)?,
        }
        Ok(Restore {
            destination: self.destination,
            previous: self.previous,
        })
    }
}

struct Restore {
    destination: PathBuf,
    previous: Option<atomic_file::StagedFile>,
}

impl Restore {
    fn apply(self) -> Result<(), String> {
        match self.previous {
            Some(previous) => previous.commit(),
            None => remove_file(&self.destination),
        }
    }
}

/// A slot change, the slot's source change and the overview regenerated with them, all staged
/// in full.
struct StagedSend {
    slot: StagedReplacement,
    /// Absent for the event slot, which has no source.
    source: Option<StagedReplacement>,
    overview: atomic_file::StagedFile,
}

fn stage_slot_and_overview(
    target: &ResolvedTarget,
    installed: Option<&ExecutionCompatibility>,
    slot_number: u8,
    change: SlotChange,
) -> Result<StagedSend, String> {
    let slot_destination = safe_destination(target, slot_number)?;
    let source_destination = match slot_source_file_name(slot_number) {
        Ok(name) => Some(shared_file_destination(target, &name, "slot source")?),
        Err(_) => None,
    };
    let overview_destination =
        shared_file_destination(target, SLOT_OVERVIEW_FILE, "slot overview")?;
    let mut slots = inspect_all_slots(target, installed);
    let (slot, source, sent) = match change {
        SlotChange::Write {
            plan,
            source,
            entry,
        } => {
            let slot = atomic_file::stage(&slot_destination, plan, "plan slot")?;
            slots[usize::from(slot_number)] = read_slot(slot_number, slot.path(), installed);
            let source = match (&source_destination, source) {
                (Some(destination), Some(bytes)) => {
                    if !valid_slot_source(bytes) {
                        return Err("Invalid slot source.".to_owned());
                    }
                    Some(atomic_file::stage(destination, bytes, "slot source")?)
                }
                (None, Some(_)) => return Err("The event slot keeps no source.".to_owned()),
                (_, None) => None,
            };
            (Some(slot), source, entry.map(|entry| *entry))
        }
        SlotChange::Remove => {
            slots[usize::from(slot_number)] = empty_slot(slot_number);
            (None, None, None)
        }
    };
    let overview = slot_overview::regenerate(
        slot_overview::read_overview(&overview_destination),
        &slots,
        sent,
    );
    let overview = atomic_file::stage(
        &overview_destination,
        slot_overview::encode_overview(&overview)?.as_bytes(),
        "slot overview",
    )?;
    Ok(StagedSend {
        slot: StagedReplacement::new(slot_destination, slot, "plan slot")?,
        source: source_destination
            .map(|destination| StagedReplacement::new(destination, source, "slot source"))
            .transpose()?,
        overview,
    })
}

fn remove_file(destination: &Path) -> Result<(), String> {
    match fs::remove_file(destination) {
        Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(format!(
            "could not remove {}: {error}",
            destination.display()
        )),
        _ => Ok(()),
    }
}

/// Commits the slot change, then its source, then the overview; when a later file fails, the
/// earlier ones are restored to their previous files, or removed when they had none.
fn commit_slot_and_overview(staged: StagedSend) -> Result<(), String> {
    let StagedSend {
        slot,
        source,
        overview,
    } = staged;
    let mut committed = vec![slot.commit()?];
    let problem = match source.map(StagedReplacement::commit).transpose() {
        Err(problem) => Some(problem),
        Ok(restore) => {
            committed.extend(restore);
            overview.commit().err()
        }
    };
    let Some(problem) = problem else {
        return Ok(());
    };
    // Every restore is attempted, so one failure never leaves a later file unrestored.
    let failures: Vec<String> = committed
        .into_iter()
        .rev()
        .filter_map(|restore| restore.apply().err())
        .collect();
    Err(if failures.is_empty() {
        format!("{problem}; the plan slot was left as it was.")
    } else {
        format!(
            "{problem}; restoring the plan slot also failed: {}",
            failures.join("; ")
        )
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

fn slot_name(slot_number: u8) -> String {
    if slot_number == EVENT_SLOT {
        "The event slot".to_owned()
    } else {
        format!("Slot {slot_number}")
    }
}

/// Makes a slot that holds a plan the installed module admits active, the event slot
/// included, on any established target whose slots can be read, even while the module or
/// ModpackLib needs an update.
pub fn set_active_slot(
    config_dir: &Path,
    package: &ModulePackage,
    slot_number: u8,
) -> ActiveSlotSetting {
    if let Err(message) = any_slot_file_name(slot_number) {
        return activation(ActivationStatus::InvalidSlot, message);
    }
    let (status, target) = status(config_dir, package);
    let (Some(target), Some(inspection)) = (target, status.inspection) else {
        return ActiveSlotSetting {
            status: ActivationStatus::Blocked,
            message: "The game target is not available.".to_owned(),
            blockers: status.publication_blockers,
        };
    };
    let slot = if slot_number == EVENT_SLOT {
        &inspection.event_slot.facts
    } else {
        &inspection.plan_slots[usize::from(slot_number - 1)]
    };
    if slot.state != PlanSlotState::Present {
        return activation(
            ActivationStatus::NotPresent,
            format!("{} has no plan to make active.", slot_name(slot_number)),
        );
    }
    match write_active_slot(&target, slot_number) {
        Ok(()) => activation(
            ActivationStatus::Activated,
            format!("{} is active.", slot_name(slot_number)),
        ),
        Err(message) => activation(ActivationStatus::NativeWrite, message),
    }
}

/// Publishes to the remembered target only when its status has no blockers, writing the
/// slot, its source and the overview that records its summary together, then makes that slot
/// active. The event slot is never a destination.
pub fn publish(
    config_dir: &Path,
    package: &ModulePackage,
    slot_number: u8,
    plan_json: &str,
    source_json: &str,
    summary: SlotSummary,
) -> GamePlanPublication {
    let target = match write_sendable_slot(
        config_dir,
        package,
        slot_number,
        plan_json,
        source_json,
        summary,
        false,
    ) {
        Ok(target) => target,
        Err(failed) => return failed,
    };
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

/// Rewrites a slot from its rebuilt plan and source under the same checks as publishing,
/// leaving the active slot as it is. A slot no longer outdated, such as one sent again since,
/// is left untouched.
pub fn rebuild(
    config_dir: &Path,
    package: &ModulePackage,
    slot_number: u8,
    plan_json: &str,
    source_json: &str,
    summary: SlotSummary,
) -> GamePlanPublication {
    match write_sendable_slot(
        config_dir,
        package,
        slot_number,
        plan_json,
        source_json,
        summary,
        true,
    ) {
        Ok(_) => GamePlanPublication {
            status: PublicationStatus::Published,
            message: format!("Rebuilt Slot {slot_number}."),
            blockers: Vec::new(),
            activation_problem: None,
        },
        Err(failed) => failed,
    }
}

/// The stored source of a sendable slot on the established target, `None` when it has none.
pub fn slot_source(
    config_dir: &Path,
    package: &ModulePackage,
    slot_number: u8,
) -> Result<Option<String>, String> {
    let (_, target) = status(config_dir, package);
    read_slot_source(
        &target.ok_or("The game target is not available.")?,
        slot_number,
    )
}

fn write_sendable_slot(
    config_dir: &Path,
    package: &ModulePackage,
    slot_number: u8,
    plan_json: &str,
    source_json: &str,
    summary: SlotSummary,
    only_if_outdated: bool,
) -> Result<ResolvedTarget, GamePlanPublication> {
    if let Err(message) = slot_file_name(slot_number).and(summary.validate()) {
        return Err(native_write(message));
    }
    if plan_json.len() > MAX_PLAN_BYTES {
        return Err(native_write(format!(
            "Game plan exceeds the {MAX_PLAN_BYTES}-byte limit."
        )));
    }
    if !valid_slot_source(source_json.as_bytes()) {
        return Err(native_write(format!(
            "The slot source must be a valid source within {MAX_SLOT_SOURCE_BYTES} bytes."
        )));
    }
    let target = match ready_target(config_dir, package) {
        Ok((target, inspection)) => {
            let outdated =
                inspection.plan_slots[usize::from(slot_number - 1)].state == PlanSlotState::Stale;
            if only_if_outdated && !outdated {
                return Err(native_write(format!(
                    "Slot {slot_number} is no longer outdated, so it was not rebuilt."
                )));
            }
            target
        }
        Err(blockers) => {
            return Err(blocked(
                "The game target is not ready for publication.",
                blockers,
            ))
        }
    };
    write_plan(
        &target,
        plan_json,
        Some(source_json),
        SentEntry {
            slot: slot_number,
            summary,
            event: None,
        },
    )
    .map_err(native_write)?;
    Ok(target)
}

/// Writes a community event's plan to the event slot with its overview entry, under the same
/// target and compatibility checks as publishing. The active slot is left as it is.
pub fn publish_event(
    config_dir: &Path,
    package: &ModulePackage,
    plan_json: &str,
    summary: SlotSummary,
    event: SlotEvent,
) -> GamePlanPublication {
    if let Err(message) = summary.validate().and(event.validate()) {
        return native_write(message);
    }
    if plan_json.len() > MAX_PLAN_BYTES {
        return native_write(format!(
            "Game plan exceeds the {MAX_PLAN_BYTES}-byte limit."
        ));
    }
    let (target, inspection) = match ready_target(config_dir, package) {
        Ok(ready) => ready,
        Err(blockers) => return blocked("The game target is not ready for publication.", blockers),
    };
    // An event slot already holding this plan and event is left as it is.
    let fingerprint = serde_json::from_str::<PlanIdentity>(plan_json)
        .ok()
        .map(|plan| plan.plan_fingerprint);
    let current = &inspection.event_slot;
    if current.facts.state == PlanSlotState::Present
        && fingerprint.is_some()
        && current.facts.plan_fingerprint == fingerprint
        && current.event.as_ref() == Some(&event)
    {
        return GamePlanPublication {
            status: PublicationStatus::Published,
            message: format!("The event slot already holds {}.", event.title),
            blockers: Vec::new(),
            activation_problem: None,
        };
    }
    let title = event.title.clone();
    let written = write_plan(
        &target,
        plan_json,
        None,
        SentEntry {
            slot: EVENT_SLOT,
            summary,
            event: Some(event),
        },
    );
    match written {
        Ok(()) => GamePlanPublication {
            status: PublicationStatus::Published,
            message: format!("The event slot now holds {title}."),
            blockers: Vec::new(),
            activation_problem: None,
        },
        Err(message) => native_write(message),
    }
}

/// What clearing a plan slot removed, as stored, so it can be written back.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearedSlot {
    pub slot: u8,
    pub plan: String,
    pub source: Option<String>,
    pub summary: Option<SlotSummary>,
    /// The cleared slot was the one the module plays next.
    pub was_active: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SlotClearStatus {
    Cleared,
    /// The slot had no file and the overview no entry for it.
    AlreadyEmpty,
    /// The slot number is outside 1 through 12; the event slot is never cleared here.
    InvalidSlot,
    Blocked,
    NativeWrite,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlotClearing {
    pub status: SlotClearStatus,
    pub message: String,
    pub blockers: Vec<PublicationBlocker>,
    /// Absent when nothing was cleared, or the plan file was not text the planner can restore.
    pub cleared: Option<ClearedSlot>,
    /// The cleared slot was active, so slot 1 is active now.
    pub active_slot_moved: bool,
    /// Why the cleared slot stayed active although it is now empty.
    pub activation_problem: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SlotRestoreStatus {
    Restored,
    InvalidSlot,
    /// The slot holds a plan again, written since it was cleared; it is left as it is.
    Occupied,
    Blocked,
    NativeWrite,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlotRestoration {
    pub status: SlotRestoreStatus,
    pub message: String,
    pub blockers: Vec<PublicationBlocker>,
    /// Why a restored slot that was active was not made active again; the plan stays written.
    pub activation_problem: Option<String>,
}

/// Removes a plan slot's file, its source and its overview entry together on any established
/// target whose slots can be read, returning what it held. When the slot was active, slot 1 is
/// made active, as the module does when no active slot is named.
pub fn clear_slot(config_dir: &Path, package: &ModulePackage, slot_number: u8) -> SlotClearing {
    let clearing = |status, message: String| SlotClearing {
        status,
        message,
        blockers: Vec::new(),
        cleared: None,
        active_slot_moved: false,
        activation_problem: None,
    };
    if let Err(message) = slot_file_name(slot_number) {
        return clearing(SlotClearStatus::InvalidSlot, message);
    }
    let (status, target) = status(config_dir, package);
    let (Some(target), Some(inspection)) = (target, status.inspection) else {
        return SlotClearing {
            blockers: status.publication_blockers,
            ..clearing(
                SlotClearStatus::Blocked,
                "The game target is not available.".to_owned(),
            )
        };
    };
    let facts = &inspection.plan_slots[usize::from(slot_number - 1)];
    if facts.state == PlanSlotState::Empty && !slot_overview::has_entry(&target, slot_number) {
        return clearing(
            SlotClearStatus::AlreadyEmpty,
            format!("Slot {slot_number} is empty."),
        );
    }
    let was_active =
        inspect_active_slot(&target) == (ActiveSlotFacts::Present { slot: slot_number });
    let cleared = read_slot_plan(&target, slot_number).map(|plan| ClearedSlot {
        slot: slot_number,
        plan,
        source: read_slot_source(&target, slot_number).ok().flatten(),
        summary: slot_overview::slot_summary(&target, facts),
        was_active,
    });
    let removed = stage_slot_and_overview(
        &target,
        inspection.module.compatibility.as_ref(),
        slot_number,
        SlotChange::Remove,
    )
    .and_then(commit_slot_and_overview);
    if let Err(message) = removed {
        return clearing(SlotClearStatus::NativeWrite, message);
    }
    let mut result = SlotClearing {
        cleared,
        ..clearing(
            SlotClearStatus::Cleared,
            format!("Cleared slot {slot_number}."),
        )
    };
    match hand_over_active_slot(&target, slot_number) {
        Ok(moved) => result.active_slot_moved = moved,
        Err(problem) => result.activation_problem = Some(problem),
    }
    result
}

/// Writes a cleared slot back as it was, its source and summary included, while the slot is
/// still empty. A slot that was active is made active again while slot 1, which took over,
/// still is.
pub fn restore_slot(
    config_dir: &Path,
    package: &ModulePackage,
    cleared: &ClearedSlot,
) -> SlotRestoration {
    let restoration = |status, message: String| SlotRestoration {
        status,
        message,
        blockers: Vec::new(),
        activation_problem: None,
    };
    let slot_number = cleared.slot;
    if let Err(message) = slot_file_name(slot_number) {
        return restoration(SlotRestoreStatus::InvalidSlot, message);
    }
    let checked = (cleared.plan.len() <= MAX_PLAN_BYTES)
        .then_some(())
        .ok_or_else(|| format!("Game plan exceeds the {MAX_PLAN_BYTES}-byte limit."))
        .and_then(|()| match &cleared.summary {
            Some(summary) => summary.validate(),
            None => Ok(()),
        });
    if let Err(message) = checked {
        return restoration(SlotRestoreStatus::NativeWrite, message);
    }
    let (status, target) = status(config_dir, package);
    let (Some(target), Some(inspection)) = (target, status.inspection) else {
        return SlotRestoration {
            blockers: status.publication_blockers,
            ..restoration(
                SlotRestoreStatus::Blocked,
                "The game target is not available.".to_owned(),
            )
        };
    };
    if inspection.plan_slots[usize::from(slot_number - 1)].state != PlanSlotState::Empty {
        return restoration(
            SlotRestoreStatus::Occupied,
            format!("Slot {slot_number} holds a plan again, so it was not restored."),
        );
    }
    let written = stage_slot_and_overview(
        &target,
        inspection.module.compatibility.as_ref(),
        slot_number,
        SlotChange::Write {
            plan: cleared.plan.as_bytes(),
            source: cleared.source.as_deref().map(str::as_bytes),
            entry: cleared.summary.clone().map(|summary| {
                Box::new(SentEntry {
                    slot: slot_number,
                    summary,
                    event: None,
                })
            }),
        },
    )
    .and_then(commit_slot_and_overview);
    if let Err(message) = written {
        return restoration(SlotRestoreStatus::NativeWrite, message);
    }
    let reactivate = cleared.was_active
        && matches!(
            inspect_active_slot(&target),
            ActiveSlotFacts::Present { slot } if slot == 1 || slot == slot_number
        );
    SlotRestoration {
        activation_problem: reactivate
            .then(|| write_active_slot(&target, slot_number).err())
            .flatten(),
        ..restoration(
            SlotRestoreStatus::Restored,
            format!("Restored slot {slot_number}."),
        )
    }
}

/// Which event slot a clear keeps.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EventSlotKeep<'a> {
    /// No event is active: the event slot is cleared.
    Nothing,
    /// An event is active whose plan was not written: a slot holding that event's plan stays,
    /// and any other event's plan is cleared.
    Event(&'a str),
    /// No verified event data is held: only a slot whose own event ended by then is cleared.
    UntilEnded(Instant),
}

/// Removes the event slot's file and its overview entry together on the established target,
/// unless `keep` keeps it. When the event slot is the active slot, slot 1 is made active, since
/// the slot played before the event may no longer hold its plan.
pub fn clear_event(
    config_dir: &Path,
    package: &ModulePackage,
    keep: EventSlotKeep<'_>,
) -> EventSlotClearing {
    let clearing = |status, message: String| EventSlotClearing {
        status,
        message,
        blockers: Vec::new(),
        cleared_event: None,
        active_slot_moved: false,
        activation_problem: None,
        fallback_slot_has_plan: false,
    };
    let (status, target) = status(config_dir, package);
    let (Some(target), Some(inspection)) = (target, status.inspection) else {
        return EventSlotClearing {
            blockers: status.publication_blockers,
            ..clearing(
                EventClearStatus::Blocked,
                "The game target is not ready.".to_owned(),
            )
        };
    };
    let fallback_slot_has_plan = inspection
        .plan_slots
        .first()
        .is_some_and(|slot| slot.state == PlanSlotState::Present);
    if let EventSlotKeep::Event(id) = keep {
        let holds_event = inspection.event_slot.facts.state != PlanSlotState::Empty
            && inspection
                .event_slot
                .event
                .as_ref()
                .map(|event| event.id.as_str())
                == Some(id);
        if holds_event {
            return clearing(
                EventClearStatus::Kept,
                "The event slot holds the active event.".to_owned(),
            );
        }
    }
    if let EventSlotKeep::UntilEnded(now) = keep {
        let ended = inspection
            .event_slot
            .event
            .as_ref()
            .and_then(|event| parse_instant(&event.ends_at))
            .is_some_and(|ends| ends <= now);
        let holds_something = inspection.event_slot.facts.state != PlanSlotState::Empty
            || slot_overview::has_entry(&target, EVENT_SLOT);
        if holds_something && !ended {
            return clearing(
                EventClearStatus::Kept,
                "The event slot is kept until its event ends.".to_owned(),
            );
        }
    }
    // An entry left behind by a slot file removed outside the planner is repaired too.
    let mut result = if inspection.event_slot.facts.state == PlanSlotState::Empty
        && !slot_overview::has_entry(&target, EVENT_SLOT)
    {
        clearing(
            EventClearStatus::AlreadyEmpty,
            "The event slot is empty.".to_owned(),
        )
    } else {
        let cleared = stage_slot_and_overview(
            &target,
            inspection.module.compatibility.as_ref(),
            EVENT_SLOT,
            SlotChange::Remove,
        )
        .and_then(commit_slot_and_overview);
        match cleared {
            Ok(()) => EventSlotClearing {
                cleared_event: inspection.event_slot.event.clone(),
                ..clearing(
                    EventClearStatus::Cleared,
                    "The event slot was cleared.".to_owned(),
                )
            },
            Err(message) => return clearing(EventClearStatus::NativeWrite, message),
        }
    };
    result.fallback_slot_has_plan = fallback_slot_has_plan;
    match hand_over_active_slot(&target, EVENT_SLOT) {
        Ok(moved) => result.active_slot_moved = moved,
        Err(problem) => result.activation_problem = Some(problem),
    }
    result
}

/// Makes slot 1 active only while the active slot file, read just before the write, still
/// names the cleared slot, so a slot the player picked meanwhile stands. Slot 1 itself stays.
fn hand_over_active_slot(target: &ResolvedTarget, cleared: u8) -> Result<bool, String> {
    if cleared == 1 || inspect_active_slot(target) != (ActiveSlotFacts::Present { slot: cleared }) {
        return Ok(false);
    }
    write_active_slot(target, 1).map(|()| true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_module_install::test_support::package_admitting;
    use crate::game_module_install::test_support::{modpack_lib, package, target};
    use crate::game_module_install::{inspect, install, BlockerCode, NativeSwap};
    use crate::game_module_package::PackageSource;
    use crate::game_target::test_support::TemporaryDirectory;
    use crate::game_target::{remember_target, TargetKind};
    use crate::plan_slots::{inspect_active_slot, ActiveSlotFacts};
    use crate::slot_overview::test_support::{event, summary};

    fn sent(slot: u8) -> SentEntry {
        SentEntry {
            slot,
            summary: summary("Circe - Surface"),
            event: None,
        }
    }

    const SOURCE: &str = r#"{"format":"run-planner-slot-source","formatVersion":1,"internalRunModifiers":false,"project":{"projectId":"p"}}"#;

    const PLAN: &str = r#"{"format":"run-planner-execution","catalogVersion":"test-catalog","schemaVersion":96,"schemaRevision":0}"#;

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
            let blocked = publish(
                &config,
                &package,
                1,
                PLAN,
                SOURCE,
                summary("Circe - Surface"),
            );
            assert_eq!(blocked.status, PublicationStatus::Blocked);
            assert_eq!(blocked.blockers[0].code, BlockerCode::NoTarget);
            remember_target(&config, &target).unwrap();
            let published = publish(
                &config,
                &package,
                12,
                PLAN,
                SOURCE,
                summary("Circe - Surface"),
            );
            assert_eq!(
                published.status,
                PublicationStatus::Published,
                "{}",
                published.message
            );
            assert_eq!(
                fs::read_to_string(safe_destination(&target, 12).unwrap()).unwrap(),
                PLAN
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

    const PRESENT_PLAN: &str = r#"{"format":"run-planner-execution","catalogVersion":"test-catalog","schemaVersion":96,"schemaRevision":0,"projectId":"p","planFingerprint":"f","routeKey":"Underworld","extent":{"biomeKeys":["F"]}}"#;

    #[test]
    fn active_slot_is_set_only_on_an_established_target_for_a_present_slot() {
        let temporary = TemporaryDirectory::new("active-set");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        fs::write(safe_destination(&target, 2).unwrap(), PRESENT_PLAN).unwrap();
        let unset = set_active_slot(&config, &package, 2);
        assert_eq!(unset.status, ActivationStatus::Blocked);
        assert_eq!(unset.blockers[0].code, BlockerCode::NoTarget);
        remember_target(&config, &target).unwrap();
        // A pending module update does not stop choosing among the plans the installed module admits.
        let newer = crate::game_module_install::test_support::package("1.3.0", "return 2");
        let mismatch = set_active_slot(&config, &newer, 2);
        assert_eq!(
            mismatch.status,
            ActivationStatus::Activated,
            "{}",
            mismatch.message
        );
        fs::remove_file(active_slot_path(&target)).unwrap();
        fs::write(safe_destination(&target, 3).unwrap(), "not a plan").unwrap();
        for slot in [1, 3] {
            let refused = set_active_slot(&config, &package, slot);
            assert_eq!(refused.status, ActivationStatus::NotPresent);
            assert_eq!(
                refused.message,
                format!("Slot {slot} has no plan to make active.")
            );
        }
        for slot in [13, u8::MAX] {
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
        // Under the relaxed target gate the slot must still hold a plan the installed module admits.
        fs::write(
            safe_destination(&target, 4).unwrap(),
            PRESENT_PLAN.replace(r#""schemaRevision":0"#, r#""schemaRevision":1"#),
        )
        .unwrap();
        assert_eq!(
            set_active_slot(&config, &package, 4).status,
            ActivationStatus::NotPresent
        );
        crate::game_module_install::remove(&target, &package).unwrap();
        let absent = set_active_slot(&config, &package, 2);
        assert_eq!(
            absent.status,
            ActivationStatus::NotPresent,
            "{}",
            absent.message
        );
        assert_eq!(
            inspect_active_slot(&target),
            ActiveSlotFacts::Present { slot: 2 }
        );
    }

    #[test]
    fn the_event_slot_hands_over_only_while_the_file_still_names_it() {
        let temporary = TemporaryDirectory::new("hand-over");
        let (target, _) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        assert_eq!(hand_over_active_slot(&target, EVENT_SLOT), Ok(false));
        assert!(!active_slot_path(&target).exists());
        // A slot picked after the event slot was read active stands.
        fs::write(active_slot_path(&target), encode_active_slot(4).unwrap()).unwrap();
        assert_eq!(hand_over_active_slot(&target, EVENT_SLOT), Ok(false));
        assert_eq!(
            inspect_active_slot(&target),
            ActiveSlotFacts::Present { slot: 4 }
        );
        fs::write(
            active_slot_path(&target),
            encode_active_slot(EVENT_SLOT).unwrap(),
        )
        .unwrap();
        assert_eq!(hand_over_active_slot(&target, EVENT_SLOT), Ok(true));
        assert_eq!(
            inspect_active_slot(&target),
            ActiveSlotFacts::Present { slot: 1 }
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
            let published = publish(&config, &package, slot, plan, SOURCE, summary(label));
            assert_eq!(
                published.status,
                PublicationStatus::Published,
                "{}",
                published.message
            );
        }
        let written = overview(&target);
        assert_eq!(written["format"], "run-planner-slot-overview");
        assert_eq!(written["formatVersion"], 2);
        assert_eq!(written["slots"]["12"]["label"], "Momus - Underworld");
        assert_eq!(written["slots"]["12"]["fingerprint"], "g");
        assert_eq!(written["slots"]["12"]["catalogVersion"], "test-catalog");
        assert_eq!(written["slots"]["12"]["schemaVersion"], 96);
        assert_eq!(written["slots"]["12"]["schemaRevision"], 0);
        assert_eq!(written["slots"]["1"]["startingFear"], 12);
        // A slot replaced or cleared outside the planner loses its entry at the next send.
        fs::write(safe_destination(&target, 1).unwrap(), &second).unwrap();
        fs::remove_file(safe_destination(&target, 5).unwrap()).unwrap();
        // A plan without a readable identity is written but has no entry.
        publish(&config, &package, 3, PLAN, SOURCE, summary("Unread"));
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

    #[test]
    fn clearing_a_plan_slot_removes_it_with_its_source_and_entry_and_undo_writes_it_back() {
        let temporary = TemporaryDirectory::new("clear-slot");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        let unset = clear_slot(&config, &package, 3);
        assert_eq!(unset.status, SlotClearStatus::Blocked);
        assert_eq!(unset.blockers[0].code, BlockerCode::NoTarget);
        remember_target(&config, &target).unwrap();
        let second = PRESENT_PLAN.replace(r#""f""#, r#""g""#);
        publish(&config, &package, 1, PRESENT_PLAN, SOURCE, summary("A"));
        publish(&config, &package, 3, &second, SOURCE, summary("B"));
        let before = overview(&target);
        for slot in [EVENT_SLOT, 13] {
            assert_eq!(
                clear_slot(&config, &package, slot).status,
                SlotClearStatus::InvalidSlot
            );
        }
        assert_eq!(
            clear_slot(&config, &package, 7).status,
            SlotClearStatus::AlreadyEmpty
        );

        let cleared = clear_slot(&config, &package, 3);
        assert_eq!(
            cleared.status,
            SlotClearStatus::Cleared,
            "{}",
            cleared.message
        );
        assert!(cleared.active_slot_moved);
        assert_eq!(cleared.activation_problem, None);
        assert_eq!(
            inspect_active_slot(&target),
            ActiveSlotFacts::Present { slot: 1 }
        );
        let held = cleared.cleared.unwrap();
        assert_eq!(
            held,
            ClearedSlot {
                slot: 3,
                plan: second.clone(),
                source: Some(SOURCE.to_owned()),
                summary: Some(summary("B")),
                was_active: true,
            }
        );
        assert!(!safe_destination(&target, 3).unwrap().exists());
        assert_eq!(slot_source(&config, &package, 3).unwrap(), None);
        let slots = overview(&target)["slots"].as_object().unwrap().clone();
        assert_eq!(slots.keys().collect::<Vec<_>>(), ["1"]);

        let restored = restore_slot(&config, &package, &held);
        assert_eq!(
            restored.status,
            SlotRestoreStatus::Restored,
            "{}",
            restored.message
        );
        assert_eq!(
            fs::read_to_string(safe_destination(&target, 3).unwrap()).unwrap(),
            second
        );
        assert_eq!(
            slot_source(&config, &package, 3).unwrap().as_deref(),
            Some(SOURCE)
        );
        assert_eq!(overview(&target), before);
        assert_eq!(
            inspect_active_slot(&target),
            ActiveSlotFacts::Present { slot: 3 }
        );
        // A slot filled again since it was cleared is left as it is.
        let occupied = restore_slot(&config, &package, &held);
        assert_eq!(occupied.status, SlotRestoreStatus::Occupied);

        // Clearing an inactive slot, or slot 1 while active, leaves the active slot as it is.
        let inactive = clear_slot(&config, &package, 1);
        assert!(!inactive.active_slot_moved);
        assert!(!inactive.cleared.unwrap().was_active);
        set_active_slot(&config, &package, 3);
        fs::rename(
            safe_destination(&target, 3).unwrap(),
            safe_destination(&target, 1).unwrap(),
        )
        .unwrap();
        set_active_slot(&config, &package, 1);
        let first = clear_slot(&config, &package, 1);
        assert!(first.cleared.unwrap().was_active);
        assert!(!first.active_slot_moved);
        assert_eq!(
            inspect_active_slot(&target),
            ActiveSlotFacts::Present { slot: 1 }
        );
    }

    #[test]
    fn clearing_a_slot_that_is_not_text_offers_nothing_to_restore() {
        let temporary = TemporaryDirectory::new("clear-unreadable");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        fs::write(safe_destination(&target, 2).unwrap(), [0xff, 0xfe]).unwrap();
        let cleared = clear_slot(&config, &package, 2);
        assert_eq!(cleared.status, SlotClearStatus::Cleared);
        assert_eq!(cleared.cleared, None);
        assert!(!safe_destination(&target, 2).unwrap().exists());
        // An unreadable plan the planner does keep as text is restored without a summary.
        fs::write(safe_destination(&target, 2).unwrap(), "not a plan").unwrap();
        let held = clear_slot(&config, &package, 2).cleared.unwrap();
        assert_eq!(
            (held.source.as_deref(), held.summary.as_ref()),
            (None, None)
        );
        let restored = restore_slot(&config, &package, &held);
        assert_eq!(
            restored.status,
            SlotRestoreStatus::Restored,
            "{}",
            restored.message
        );
        assert_eq!(
            fs::read_to_string(safe_destination(&target, 2).unwrap()).unwrap(),
            "not a plan"
        );
        let invalid = restore_slot(
            &config,
            &package,
            &ClearedSlot {
                slot: EVENT_SLOT,
                ..held
            },
        );
        assert_eq!(invalid.status, SlotRestoreStatus::InvalidSlot);
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
        let refused = publish(&config, &package, 2, PRESENT_PLAN, SOURCE, summary(""));
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
            SOURCE,
            summary("Circe - Surface"),
        );
        assert_eq!(blocked.status, PublicationStatus::NativeWrite);
        assert_eq!(blocked.message, "slot overview must be a regular file");
        assert!(!safe_destination(&target, 2).unwrap().exists());
        assert!(!active_slot_path(&target).exists());
        assert_eq!(config_files(&target), [SLOT_OVERVIEW_FILE]);
    }

    #[test]
    fn a_send_writes_its_source_beside_the_slot_and_a_rebuild_keeps_the_active_slot() {
        let temporary = TemporaryDirectory::new("publish-source");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        for invalid in [
            "{}",
            r#"{"format":"run-planner-slot-source","formatVersion":1}"#,
        ] {
            let refused = publish(&config, &package, 3, PRESENT_PLAN, invalid, summary("A"));
            assert_eq!(refused.status, PublicationStatus::NativeWrite);
            assert!(!safe_destination(&target, 3).unwrap().exists());
        }
        publish(&config, &package, 3, PRESENT_PLAN, SOURCE, summary("A"));
        publish(&config, &package, 5, PRESENT_PLAN, SOURCE, summary("B"));
        assert_eq!(
            slot_source(&config, &package, 3).unwrap().as_deref(),
            Some(SOURCE)
        );
        assert_eq!(slot_source(&config, &package, 4).unwrap(), None);
        assert!(slot_source(&config, &package, EVENT_SLOT).is_err());
        let inspection = crate::game_module_install::inspect(&target, &package).unwrap();
        assert!(inspection.plan_slots[2].has_source);
        assert!(!inspection.plan_slots[3].has_source);
        assert!(!inspection.event_slot.facts.has_source);
        let revised = SOURCE.replace(r#""p""#, r#""rebuilt""#);
        // A slot the installed module admits, such as one sent again, is never rebuilt.
        let current = rebuild(&config, &package, 3, PRESENT_PLAN, &revised, summary("A"));
        assert_eq!(current.status, PublicationStatus::NativeWrite);
        assert_eq!(
            current.message,
            "Slot 3 is no longer outdated, so it was not rebuilt."
        );
        assert_eq!(
            slot_source(&config, &package, 3).unwrap().as_deref(),
            Some(SOURCE)
        );
        fs::write(
            safe_destination(&target, 3).unwrap(),
            PRESENT_PLAN.replace(r#""schemaRevision":0"#, r#""schemaRevision":1"#),
        )
        .unwrap();
        let rebuilt = rebuild(&config, &package, 3, PRESENT_PLAN, &revised, summary("A"));
        assert_eq!(
            rebuilt.status,
            PublicationStatus::Published,
            "{}",
            rebuilt.message
        );
        assert_eq!(slot_source(&config, &package, 3).unwrap(), Some(revised));
        assert_eq!(
            inspect_active_slot(&target),
            ActiveSlotFacts::Present { slot: 5 }
        );
        fs::write(
            safe_destination(&target, 3)
                .unwrap()
                .with_file_name("slot-3.source.runplanner.json"),
            "{}",
        )
        .unwrap();
        assert!(slot_source(&config, &package, 3).is_err());
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
            SOURCE,
            summary("Circe - Surface"),
        );
        let previous_slot = fs::read(safe_destination(&target, 1).unwrap()).unwrap();
        let previous_overview = overview(&target);
        let overview_path = safe_destination(&target, 1)
            .unwrap()
            .with_file_name(SLOT_OVERVIEW_FILE);
        let second = PRESENT_PLAN.replace(r#""f""#, r#""g""#);
        let second_source = SOURCE.replace(r#""p""#, r#""q""#);
        for (slot, existed) in [(1, true), (4, false)] {
            let staged = stage_slot_and_overview(
                &target,
                Some(&package.compatibility),
                slot,
                SlotChange::Write {
                    plan: second.as_bytes(),
                    source: Some(second_source.as_bytes()),
                    entry: Some(Box::new(SentEntry {
                        slot,
                        summary: summary("Momus - Underworld"),
                        event: None,
                    })),
                },
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
            read_slot_source(&target, 1).unwrap().as_deref(),
            Some(SOURCE)
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
                "slot-1.source.runplanner.json",
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
        let published = publish(
            &config,
            &package,
            3,
            PLAN,
            SOURCE,
            summary("Circe - Surface"),
        );
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
        publish(
            &config,
            &package,
            2,
            PLAN,
            SOURCE,
            summary("Circe - Surface"),
        );
        // A newer planner whose plans the installed module still admits may send to it, and
        // offers its module as an update by manifest version.
        let newer = crate::game_module_install::test_support::package("1.3.0", "return 2");
        assert_eq!(
            publish(&config, &newer, 2, PLAN, SOURCE, summary("Circe - Surface")).status,
            PublicationStatus::Published
        );
        assert!(inspect(&target, &newer).unwrap().install.update_available);
        assert!(!inspect(&target, &package).unwrap().install.update_available);
        let revised = package_admitting(
            "1.3.0",
            "return 2",
            PackageSource::Bundled,
            r#"{"format":"run-planner-execution","catalogVersion":"test-catalog","schemaVersion":96,"schemaRevision":1}"#,
        );
        let mismatch = publish(
            &config,
            &revised,
            2,
            r#"{"other":true}"#,
            SOURCE,
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
            SOURCE,
            summary("Circe - Surface"),
        );
        assert_eq!(older.blockers[0].code, BlockerCode::ModpackLibOlder);
        assert_eq!(older.blockers[0].found.as_deref(), Some("4.0.1"));
        assert_eq!(older.blockers[0].required.as_deref(), Some("4.2.0"));
        assert_eq!(
            fs::read_to_string(safe_destination(&target, 2).unwrap()).unwrap(),
            PLAN
        );
    }

    #[test]
    fn publication_keeps_the_compatibility_guard_and_size_bound() {
        let temporary = TemporaryDirectory::new("publish-guard");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        publish(
            &config,
            &package,
            4,
            PLAN,
            SOURCE,
            summary("Circe - Surface"),
        );
        for plan in [
            PLAN.replace("test-catalog", "other"),
            PLAN.replace(r#""schemaRevision":0"#, r#""schemaRevision":1"#),
            PLAN.replace(r#","schemaVersion":96,"schemaRevision":0"#, ""),
            "{}".to_owned(),
        ] {
            assert_eq!(
                publish(
                    &config,
                    &package,
                    4,
                    &plan,
                    SOURCE,
                    summary("Circe - Surface")
                )
                .status,
                PublicationStatus::NativeWrite
            );
        }
        let oversized = format!(
            "{}{}}}",
            &PLAN[..PLAN.len() - 1],
            " ".repeat(MAX_PLAN_BYTES - PLAN.len() + 1)
        );
        assert_eq!(oversized.len(), MAX_PLAN_BYTES + 1);
        assert_eq!(
            publish(
                &config,
                &package,
                4,
                &oversized,
                SOURCE,
                summary("Circe - Surface")
            )
            .status,
            PublicationStatus::NativeWrite
        );
        for slot in [0, 13, u8::MAX] {
            assert_eq!(
                publish(
                    &config,
                    &package,
                    slot,
                    PLAN,
                    SOURCE,
                    summary("Circe - Surface")
                )
                .message,
                format!("plan slot must be between 1 and 12 (got {slot})")
            );
        }
        assert_eq!(
            fs::read_to_string(safe_destination(&target, 4).unwrap()).unwrap(),
            PLAN
        );
    }

    #[test]
    fn the_slot_keeps_the_plan_bytes_as_sent() {
        let temporary = TemporaryDirectory::new("publish-bytes");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        let plan = "{ \"catalogVersion\" : \"test-catalog\",\n  \"format\":\"run-planner-execution\",\"schemaVersion\":96,\"schemaRevision\":0,\"note\":\"é\\u00e9\" }";
        assert_eq!(
            publish(
                &config,
                &package,
                1,
                plan,
                SOURCE,
                summary("Circe - Surface")
            )
            .status,
            PublicationStatus::Published
        );
        assert_eq!(
            fs::read_to_string(safe_destination(&target, 1).unwrap()).unwrap(),
            plan
        );
    }

    #[test]
    fn publication_refuses_a_module_that_admits_another_plan_header() {
        let temporary = TemporaryDirectory::new("publish-header");
        let (target, _) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        let outdated = "The game module was made for another Run Planner version. Update it from the Game panel.".to_owned();
        let compatibility = crate::game_module_install::test_support::module_path(&target)
            .join("execution-compatibility.json");
        for installed in [
            r#"{"format":"run-planner-execution","catalogVersion":"test-catalog","schemaVersion":96,"schemaRevision":1}"#,
            r#"{"format":"run-planner-execution","catalogVersion":"test-catalog","buildId":"b"}"#,
        ] {
            fs::write(&compatibility, installed).unwrap();
            assert_eq!(
                write_plan(&target, PLAN, Some(SOURCE), sent(1)),
                Err(outdated.clone())
            );
        }
        fs::remove_file(&compatibility).unwrap();
        assert_eq!(
            write_plan(&target, PLAN, Some(SOURCE), sent(1)),
            Err(outdated)
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

    const EVENT_PLAN: &str = r#"{"format":"run-planner-execution","catalogVersion":"test-catalog","schemaVersion":96,"schemaRevision":0,"projectId":"e","planFingerprint":"event-print","routeKey":"Surface","extent":{"biomeKeys":["N"]}}"#;

    fn event_slot_path(target: &ResolvedTarget) -> PathBuf {
        safe_destination(target, EVENT_SLOT).unwrap()
    }

    #[test]
    fn the_event_write_fills_slot_zero_with_its_event_entry_and_leaves_the_active_slot() {
        let temporary = TemporaryDirectory::new("publish-event");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        let unset = publish_event(
            &config,
            &package,
            EVENT_PLAN,
            summary("Circe - Surface"),
            event(),
        );
        assert_eq!(unset.status, PublicationStatus::Blocked);
        remember_target(&config, &target).unwrap();
        publish(
            &config,
            &package,
            3,
            PRESENT_PLAN,
            SOURCE,
            summary("Circe - Surface"),
        );
        let written = publish_event(
            &config,
            &package,
            EVENT_PLAN,
            summary("Circe - Surface"),
            event(),
        );
        assert_eq!(
            written.status,
            PublicationStatus::Published,
            "{}",
            written.message
        );
        assert_eq!(
            written.message,
            "The event slot now holds Week 42: Staff sprint."
        );
        assert_eq!(
            event_slot_path(&target)
                .file_name()
                .and_then(|name| name.to_str()),
            Some("slot-0.runplanner.json")
        );
        assert_eq!(
            fs::read_to_string(event_slot_path(&target)).unwrap(),
            EVENT_PLAN
        );
        let written = overview(&target);
        assert_eq!(
            written["slots"]["0"]["event"],
            serde_json::json!({
                "id": "2026-w42-staff",
                "title": "Week 42: Staff sprint",
                "endsAt": "2026-10-19T00:00:00Z"
            })
        );
        assert_eq!(written["slots"]["0"]["fingerprint"], "event-print");
        assert_eq!(written["slots"]["3"]["label"], "Circe - Surface");
        assert_eq!(
            inspect_active_slot(&target),
            ActiveSlotFacts::Present { slot: 3 }
        );
        let inspection = inspect(&target, &package).unwrap();
        assert_eq!(inspection.event_slot.facts.state, PlanSlotState::Present);
        assert_eq!(inspection.event_slot.event, Some(event()));
        assert_eq!(inspection.plan_slots.len(), 12);
        // The same event and plan again writes nothing.
        let before = fs::metadata(event_slot_path(&target))
            .unwrap()
            .modified()
            .unwrap();
        let again = publish_event(
            &config,
            &package,
            EVENT_PLAN,
            summary("Other label"),
            event(),
        );
        assert_eq!(
            again.message,
            "The event slot already holds Week 42: Staff sprint."
        );
        assert_eq!(overview(&target)["slots"]["0"]["label"], "Circe - Surface");
        assert_eq!(
            fs::metadata(event_slot_path(&target))
                .unwrap()
                .modified()
                .unwrap(),
            before
        );
        // A later send to another slot keeps the event entry.
        publish(
            &config,
            &package,
            4,
            PRESENT_PLAN,
            SOURCE,
            summary("Momus - Underworld"),
        );
        assert_eq!(
            overview(&target)["slots"]["0"]["event"]["id"],
            "2026-w42-staff"
        );
    }

    #[test]
    fn the_event_slot_is_never_a_send_destination_but_may_be_made_active() {
        let temporary = TemporaryDirectory::new("publish-event-readonly");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        let refused = publish(
            &config,
            &package,
            EVENT_SLOT,
            PRESENT_PLAN,
            SOURCE,
            summary("Circe - Surface"),
        );
        assert_eq!(refused.status, PublicationStatus::NativeWrite);
        assert_eq!(
            refused.message,
            "plan slot must be between 1 and 12 (got 0)"
        );
        assert!(!event_slot_path(&target).exists());
        let empty = set_active_slot(&config, &package, EVENT_SLOT);
        assert_eq!(empty.status, ActivationStatus::NotPresent);
        assert_eq!(empty.message, "The event slot has no plan to make active.");
        publish_event(
            &config,
            &package,
            EVENT_PLAN,
            summary("Circe - Surface"),
            event(),
        );
        let set = set_active_slot(&config, &package, EVENT_SLOT);
        assert_eq!(set.status, ActivationStatus::Activated, "{}", set.message);
        assert_eq!(
            fs::read_to_string(active_slot_path(&target)).unwrap(),
            r#"{"format":"run-planner-active-slot","formatVersion":1,"slot":0}"#
        );
        assert_eq!(
            inspect_active_slot(&target),
            ActiveSlotFacts::Present { slot: 0 }
        );
    }

    #[test]
    fn invalid_event_metadata_writes_nothing() {
        let temporary = TemporaryDirectory::new("publish-event-invalid");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        let mut late = event();
        late.ends_at = "2026-10-19".to_owned();
        let refused = publish_event(
            &config,
            &package,
            EVENT_PLAN,
            summary("Circe - Surface"),
            late,
        );
        assert_eq!(refused.message, "Invalid event summary.");
        assert!(!event_slot_path(&target).exists());
        assert!(!event_slot_path(&target)
            .with_file_name(SLOT_OVERVIEW_FILE)
            .exists());
    }

    #[test]
    fn clearing_the_event_slot_removes_its_file_and_entry_only() {
        let temporary = TemporaryDirectory::new("clear-event");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        assert_eq!(
            clear_event(&config, &package, EventSlotKeep::Nothing).status,
            EventClearStatus::Blocked
        );
        remember_target(&config, &target).unwrap();
        assert_eq!(
            clear_event(&config, &package, EventSlotKeep::Nothing).status,
            EventClearStatus::AlreadyEmpty
        );
        publish(
            &config,
            &package,
            2,
            PRESENT_PLAN,
            SOURCE,
            summary("Circe - Surface"),
        );
        publish_event(
            &config,
            &package,
            EVENT_PLAN,
            summary("Circe - Surface"),
            event(),
        );
        set_active_slot(&config, &package, EVENT_SLOT);
        let cleared = clear_event(&config, &package, EventSlotKeep::Nothing);
        assert_eq!(
            cleared.status,
            EventClearStatus::Cleared,
            "{}",
            cleared.message
        );
        assert!(!event_slot_path(&target).exists());
        assert_eq!(cleared.cleared_event, Some(event()));
        let slots = overview(&target)["slots"].as_object().unwrap().clone();
        assert_eq!(slots.keys().collect::<Vec<_>>(), ["2"]);
        // The cleared event slot was active, so slot 1 now is.
        assert!(cleared.active_slot_moved);
        assert_eq!(cleared.activation_problem, None);
        assert_eq!(
            inspect_active_slot(&target),
            ActiveSlotFacts::Present { slot: 1 }
        );
        let again = clear_event(&config, &package, EventSlotKeep::Nothing);
        assert_eq!(again.status, EventClearStatus::AlreadyEmpty);
        assert!(!again.active_slot_moved);
        // An empty event slot left active is moved too.
        fs::write(
            active_slot_path(&target),
            encode_active_slot(EVENT_SLOT).unwrap(),
        )
        .unwrap();
        let empty_active = clear_event(&config, &package, EventSlotKeep::Nothing);
        assert_eq!(empty_active.status, EventClearStatus::AlreadyEmpty);
        assert!(empty_active.active_slot_moved);
        // A slot other than the event slot stays active.
        set_active_slot(&config, &package, 2);
        publish_event(
            &config,
            &package,
            EVENT_PLAN,
            summary("Circe - Surface"),
            event(),
        );
        assert!(!clear_event(&config, &package, EventSlotKeep::Nothing).active_slot_moved);
        assert_eq!(
            inspect_active_slot(&target),
            ActiveSlotFacts::Present { slot: 2 }
        );
        assert_eq!(
            config_files(&target),
            [
                ACTIVE_SLOT_FILE,
                "slot-2.runplanner.json",
                "slot-2.source.runplanner.json",
                SLOT_OVERVIEW_FILE
            ]
        );
        // Slot 0 deleted by hand leaves its entry; clearing repairs the overview.
        publish_event(
            &config,
            &package,
            EVENT_PLAN,
            summary("Circe - Surface"),
            event(),
        );
        fs::remove_file(event_slot_path(&target)).unwrap();
        assert!(overview(&target)["slots"]["0"].is_object());
        assert_eq!(inspect(&target, &package).unwrap().event_slot.event, None);
        let repaired = clear_event(&config, &package, EventSlotKeep::Nothing);
        assert_eq!(
            repaired.status,
            EventClearStatus::Cleared,
            "{}",
            repaired.message
        );
        assert!(overview(&target)["slots"].get("0").is_none());
        assert_eq!(overview(&target)["slots"]["2"]["label"], "Circe - Surface");
    }

    #[test]
    fn an_event_write_or_clear_whose_overview_cannot_be_committed_rolls_slot_zero_back() {
        let temporary = TemporaryDirectory::new("event-rollback");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        let overview_path = event_slot_path(&target).with_file_name(SLOT_OVERVIEW_FILE);
        let block_overview = || {
            fs::remove_file(&overview_path).unwrap();
            fs::create_dir(&overview_path).unwrap();
            fs::write(overview_path.join("held"), "x").unwrap();
        };
        // A first event write that fails leaves no slot 0 behind.
        publish(
            &config,
            &package,
            1,
            PRESENT_PLAN,
            SOURCE,
            summary("Circe - Surface"),
        );
        let previous_overview = fs::read(&overview_path).unwrap();
        let event_entry = || SentEntry {
            slot: EVENT_SLOT,
            summary: summary("Circe - Surface"),
            event: Some(event()),
        };
        let staged = stage_slot_and_overview(
            &target,
            Some(&package.compatibility),
            EVENT_SLOT,
            SlotChange::Write {
                plan: EVENT_PLAN.as_bytes(),
                source: None,
                entry: Some(Box::new(event_entry())),
            },
        )
        .unwrap();
        block_overview();
        let failed = commit_slot_and_overview(staged).unwrap_err();
        assert!(
            failed.ends_with("; the plan slot was left as it was."),
            "{failed}"
        );
        assert!(!event_slot_path(&target).exists());
        fs::remove_dir_all(&overview_path).unwrap();
        fs::write(&overview_path, &previous_overview).unwrap();
        // A clear that fails restores the event plan.
        publish_event(
            &config,
            &package,
            EVENT_PLAN,
            summary("Circe - Surface"),
            event(),
        );
        let previous_slot = fs::read(event_slot_path(&target)).unwrap();
        let staged = stage_slot_and_overview(
            &target,
            Some(&package.compatibility),
            EVENT_SLOT,
            SlotChange::Remove,
        )
        .unwrap();
        block_overview();
        assert!(commit_slot_and_overview(staged).is_err());
        assert_eq!(fs::read(event_slot_path(&target)).unwrap(), previous_slot);
        fs::remove_dir_all(&overview_path).unwrap();
        assert_eq!(
            config_files(&target),
            [
                ACTIVE_SLOT_FILE,
                "slot-0.runplanner.json",
                "slot-1.runplanner.json",
                "slot-1.source.runplanner.json"
            ]
        );
    }

    #[test]
    fn without_verified_events_the_event_slot_is_cleared_only_after_its_own_end() {
        let temporary = TemporaryDirectory::new("clear-event-ended-only");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        let during = EventSlotKeep::UntilEnded(parse_instant("2026-10-14T00:00:00Z").unwrap());
        let after = EventSlotKeep::UntilEnded(parse_instant("2026-10-19T00:00:00Z").unwrap());
        assert_eq!(
            clear_event(&config, &package, during).status,
            EventClearStatus::AlreadyEmpty
        );
        publish_event(
            &config,
            &package,
            EVENT_PLAN,
            summary("Circe - Surface"),
            event(),
        );
        set_active_slot(&config, &package, EVENT_SLOT);
        let kept = clear_event(&config, &package, during);
        assert_eq!(kept.status, EventClearStatus::Kept);
        assert!(!kept.active_slot_moved);
        assert!(event_slot_path(&target).exists());
        assert_eq!(
            inspect_active_slot(&target),
            ActiveSlotFacts::Present { slot: 0 }
        );
        let ended = clear_event(&config, &package, after);
        assert_eq!(ended.status, EventClearStatus::Cleared);
        assert!(ended.active_slot_moved);
        // Slot 1, which took over, holds no plan.
        assert!(!ended.fallback_slot_has_plan);
        assert!(!event_slot_path(&target).exists());
    }

    #[test]
    fn an_active_event_keeps_only_its_own_plan_in_the_event_slot() {
        let temporary = TemporaryDirectory::new("clear-event-keep");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        publish_event(
            &config,
            &package,
            EVENT_PLAN,
            summary("Circe - Surface"),
            event(),
        );
        set_active_slot(&config, &package, EVENT_SLOT);
        let kept = clear_event(&config, &package, EventSlotKeep::Event("2026-w42-staff"));
        assert_eq!(kept.status, EventClearStatus::Kept);
        assert!(event_slot_path(&target).exists());
        // The next event is active but unplayable: the previous event's plan goes.
        let replaced = clear_event(&config, &package, EventSlotKeep::Event("2026-w43-next"));
        assert_eq!(replaced.status, EventClearStatus::Cleared);
        assert_eq!(
            replaced.cleared_event.map(|event| event.id),
            Some("2026-w42-staff".to_owned())
        );
        assert!(replaced.active_slot_moved);
        assert!(!event_slot_path(&target).exists());
        assert_eq!(
            inspect_active_slot(&target),
            ActiveSlotFacts::Present { slot: 1 }
        );
    }

    #[test]
    fn a_cleared_active_event_slot_says_whether_slot_1_holds_a_plan() {
        let temporary = TemporaryDirectory::new("clear-event-fallback");
        let config = temporary.0.join("app-config");
        let (target, package) = ready_target(&temporary.0.join("target"), TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        publish(
            &config,
            &package,
            1,
            PRESENT_PLAN,
            SOURCE,
            summary("Circe - Surface"),
        );
        publish_event(
            &config,
            &package,
            EVENT_PLAN,
            summary("Circe - Surface"),
            event(),
        );
        set_active_slot(&config, &package, EVENT_SLOT);
        let cleared = clear_event(&config, &package, EventSlotKeep::Nothing);
        assert!(cleared.active_slot_moved);
        assert!(cleared.fallback_slot_has_plan);
    }
}
