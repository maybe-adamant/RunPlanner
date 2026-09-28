use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use crate::game_target::{existing_directory, ResolvedTarget, CONFIG_DIRECTORY};

/// Plan slots live under the module's own config folder name.
pub const MODULE_CONFIG_DIRECTORY: &str = crate::game_module_install::MODULE_DIRECTORY;
pub const MAX_PLAN_BYTES: usize = 1_048_576;
pub const PLAN_SLOT_COUNT: u8 = 6;

const PLAN_SLOT_FILES: [&str; 6] = [
    "slot-1.runplanner.json",
    "slot-2.runplanner.json",
    "slot-3.runplanner.json",
    "slot-4.runplanner.json",
    "slot-5.runplanner.json",
    "slot-6.runplanner.json",
];

pub fn slot_file_name(slot_number: u8) -> Result<&'static str, String> {
    match slot_number {
        1..=6 => Ok(PLAN_SLOT_FILES[usize::from(slot_number - 1)]),
        slot => Err(format!("plan slot must be between 1 and 6 (got {slot})")),
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PlanSlotState {
    Empty,
    Present,
    Unreadable,
}

/// One plan slot as found on disk, identified only by execution-plan wire fields.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanSlotFacts {
    pub slot: u8,
    pub state: PlanSlotState,
    pub modified_at_ms: Option<u64>,
    pub route_key: Option<String>,
    pub biome_keys: Vec<String>,
    pub plan_fingerprint: Option<String>,
    pub project_id: Option<String>,
    /// The saved file's name at send time; absent in plans sent before it existed.
    pub display_name: Option<String>,
    pub weapon_key: Option<String>,
    pub aspect_key: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlanLoadout {
    weapon_key: String,
    aspect_key: String,
}

#[derive(Deserialize)]
struct PlanExtent {
    #[serde(rename = "biomeKeys")]
    biome_keys: Vec<String>,
}

// The subset of the execution-plan wire read for a slot summary.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlanIdentity {
    format: String,
    project_id: String,
    plan_fingerprint: String,
    route_key: String,
    extent: PlanExtent,
    #[serde(default)]
    starting_loadout: Option<PlanLoadout>,
    #[serde(default)]
    display_name: Option<String>,
}

const PLAN_FORMAT: &str = "run-planner-execution";

fn slot_facts(slot: u8, state: PlanSlotState, modified_at_ms: Option<u64>) -> PlanSlotFacts {
    PlanSlotFacts {
        slot,
        state,
        modified_at_ms,
        route_key: None,
        biome_keys: Vec::new(),
        plan_fingerprint: None,
        project_id: None,
        display_name: None,
        weapon_key: None,
        aspect_key: None,
    }
}

/// The module's config folder when present and safe; `Ok(None)` when absent.
pub fn module_config_dir(target: &ResolvedTarget) -> Result<Option<PathBuf>, String> {
    let config = target.rom.join(CONFIG_DIRECTORY);
    if !present(&config)? {
        return Ok(None);
    }
    existing_directory(&config, &target.rom)?;
    let module_config = config.join(MODULE_CONFIG_DIRECTORY);
    if !present(&module_config)? {
        return Ok(None);
    }
    existing_directory(&module_config, &target.rom).map(Some)
}

// Only a missing entry means absent; any other inspection failure is unreadable.
fn present(path: &Path) -> Result<bool, String> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(format!("could not inspect {}: {error}", path.display())),
    }
}

fn read_slot(slot: u8, path: &Path) -> PlanSlotFacts {
    let metadata = match fs::symlink_metadata(path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return slot_facts(slot, PlanSlotState::Empty, None)
        }
        Err(_) => return slot_facts(slot, PlanSlotState::Unreadable, None),
        Ok(metadata) => metadata,
    };
    let modified_at_ms = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .and_then(|elapsed| u64::try_from(elapsed.as_millis()).ok());
    let unreadable = slot_facts(slot, PlanSlotState::Unreadable, modified_at_ms);
    if metadata.file_type().is_symlink()
        || !metadata.is_file()
        || metadata.len() > MAX_PLAN_BYTES as u64
    {
        return unreadable;
    }
    let mut bytes = Vec::new();
    let read = fs::File::open(path)
        .and_then(|file| file.take(MAX_PLAN_BYTES as u64 + 1).read_to_end(&mut bytes));
    if read.is_err() || bytes.len() > MAX_PLAN_BYTES {
        return unreadable;
    }
    match serde_json::from_slice::<PlanIdentity>(&bytes) {
        Ok(identity) if identity.format == PLAN_FORMAT => PlanSlotFacts {
            slot,
            state: PlanSlotState::Present,
            modified_at_ms,
            route_key: Some(identity.route_key),
            biome_keys: identity.extent.biome_keys,
            plan_fingerprint: Some(identity.plan_fingerprint),
            project_id: Some(identity.project_id),
            display_name: identity.display_name,
            weapon_key: identity
                .starting_loadout
                .as_ref()
                .map(|loadout| loadout.weapon_key.clone()),
            aspect_key: identity.starting_loadout.map(|loadout| loadout.aspect_key),
        },
        _ => unreadable,
    }
}

/// Reads all six plan slots; an unsafe config folder makes every slot unreadable.
pub fn inspect_slots(target: &ResolvedTarget) -> Vec<PlanSlotFacts> {
    let slots = 1..=PLAN_SLOT_COUNT;
    match module_config_dir(target) {
        Ok(None) => slots
            .map(|slot| slot_facts(slot, PlanSlotState::Empty, None))
            .collect(),
        Err(_) => slots
            .map(|slot| slot_facts(slot, PlanSlotState::Unreadable, None))
            .collect(),
        Ok(Some(directory)) => slots
            .map(|slot| {
                read_slot(
                    slot,
                    &directory.join(PLAN_SLOT_FILES[usize::from(slot - 1)]),
                )
            })
            .collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_target::test_support::TemporaryDirectory;
    use crate::game_target::{resolve_target, TargetKind, RETURN_OF_MODDING_DIRECTORY};

    fn make_target(root: &Path) -> ResolvedTarget {
        fs::create_dir_all(root.join(RETURN_OF_MODDING_DIRECTORY)).unwrap();
        resolve_target(root, TargetKind::Manual).unwrap()
    }

    fn slot_path(target: &ResolvedTarget, slot: u8) -> PathBuf {
        target
            .rom
            .join(CONFIG_DIRECTORY)
            .join(MODULE_CONFIG_DIRECTORY)
            .join(slot_file_name(slot).unwrap())
    }

    const PLAN: &str = r#"{"format":"run-planner-execution","protocolVersion":42,"catalogVersion":"c","projectId":"p","planFingerprint":"abc123","displayName":"Surface Phial run","routeKey":"Underworld","startingLoadout":{"weaponKey":"WeaponStaffSwing","aspectKey":"BaseStaffAspect","arcana":[],"fear":{}},"extent":{"kind":"configuredPrefix","biomeKeys":["F","G"],"terminalBiomeKey":"G"}}"#;

    #[test]
    fn slots_report_empty_present_and_unreadable_without_failing_the_rest() {
        let temporary = TemporaryDirectory::new("slots");
        let target = make_target(&temporary.0);
        assert!(inspect_slots(&target)
            .iter()
            .all(|slot| slot.state == PlanSlotState::Empty));
        fs::create_dir_all(slot_path(&target, 1).parent().unwrap()).unwrap();
        fs::write(slot_path(&target, 1), PLAN).unwrap();
        fs::write(slot_path(&target, 2), "not json").unwrap();
        fs::write(
            slot_path(&target, 3),
            PLAN.replace("run-planner-execution", "authored-project"),
        )
        .unwrap();
        fs::write(slot_path(&target, 4), vec![b' '; MAX_PLAN_BYTES + 1]).unwrap();
        let slots = inspect_slots(&target);
        assert_eq!(slots.len(), 6);
        assert_eq!(
            slots[0],
            PlanSlotFacts {
                slot: 1,
                state: PlanSlotState::Present,
                modified_at_ms: slots[0].modified_at_ms,
                route_key: Some("Underworld".to_owned()),
                biome_keys: vec!["F".to_owned(), "G".to_owned()],
                plan_fingerprint: Some("abc123".to_owned()),
                project_id: Some("p".to_owned()),
                display_name: Some("Surface Phial run".to_owned()),
                weapon_key: Some("WeaponStaffSwing".to_owned()),
                aspect_key: Some("BaseStaffAspect".to_owned()),
            }
        );
        assert!(slots[0].modified_at_ms.is_some());
        for index in [1, 2, 3] {
            assert_eq!(
                slots[index].state,
                PlanSlotState::Unreadable,
                "slot {}",
                index + 1
            );
            assert!(slots[index].plan_fingerprint.is_none());
        }
        fs::write(
            slot_path(&target, 5),
            PLAN.replace(r#""displayName":"Surface Phial run","#, ""),
        )
        .unwrap();
        let legacy = &inspect_slots(&target)[4];
        assert_eq!(legacy.state, PlanSlotState::Present);
        assert_eq!(legacy.display_name, None);
        assert_eq!(legacy.aspect_key.as_deref(), Some("BaseStaffAspect"));
        let without_loadout = PLAN.replace(
            r#""startingLoadout":{"weaponKey":"WeaponStaffSwing","aspectKey":"BaseStaffAspect","arcana":[],"fear":{}},"#,
            "",
        );
        assert!(!without_loadout.contains("startingLoadout"));
        fs::write(slot_path(&target, 5), without_loadout).unwrap();
        let unknown = &inspect_slots(&target)[4];
        assert_eq!(unknown.state, PlanSlotState::Present);
        assert_eq!(unknown.aspect_key, None);
        assert_eq!(unknown.weapon_key, None);
        fs::remove_file(slot_path(&target, 5)).unwrap();
        assert_eq!(slots[4].state, PlanSlotState::Empty);
        assert_eq!(slots[5].state, PlanSlotState::Empty);
    }

    #[cfg(unix)]
    #[test]
    fn linked_slots_and_linked_config_folders_are_unreadable() {
        use std::os::unix::fs::symlink;
        let temporary = TemporaryDirectory::new("slot-links");
        let target = make_target(&temporary.0.join("profile"));
        let outside = temporary.0.join("outside.json");
        fs::write(&outside, PLAN).unwrap();
        fs::create_dir_all(slot_path(&target, 1).parent().unwrap()).unwrap();
        symlink(&outside, slot_path(&target, 1)).unwrap();
        assert_eq!(inspect_slots(&target)[0].state, PlanSlotState::Unreadable);

        let other = make_target(&temporary.0.join("other"));
        let outside_config = temporary.0.join("outside-config");
        fs::create_dir_all(outside_config.join(MODULE_CONFIG_DIRECTORY)).unwrap();
        fs::write(
            outside_config
                .join(MODULE_CONFIG_DIRECTORY)
                .join(slot_file_name(1).unwrap()),
            PLAN,
        )
        .unwrap();
        symlink(&outside_config, other.rom.join(CONFIG_DIRECTORY)).unwrap();
        assert!(inspect_slots(&other)
            .iter()
            .all(|slot| slot.state == PlanSlotState::Unreadable));
    }
}
