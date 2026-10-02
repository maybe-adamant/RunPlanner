use serde::{Deserialize, Serialize};
use serde_json::Value;
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

/// The plan slot the game module plays next, written by both the planner and the module.
pub const ACTIVE_SLOT_FILE: &str = "active-slot.json";
pub const MAX_ACTIVE_SLOT_BYTES: usize = 1024;
const ACTIVE_SLOT_FORMAT: &str = "run-planner-active-slot";

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
    /// A readable plan written for another module build, or before slots named one.
    Stale,
    Unreadable,
}

/// One plan slot as found on disk, identified by its envelope and execution-plan wire fields.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanSlotFacts {
    pub slot: u8,
    pub state: PlanSlotState,
    pub modified_at_ms: Option<u64>,
    /// The module build the slot was written for; absent for a bare pre-envelope plan.
    pub build_id: Option<String>,
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
    /// Omitted when the run starts with no aspect.
    #[serde(default)]
    aspect_key: Option<String>,
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
pub const SLOT_FORMAT: &str = "run-planner-slot";

#[derive(Deserialize)]
struct SlotFormat {
    format: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct SlotEnvelope {
    format: String,
    build_id: String,
    plan: PlanIdentity,
}

/// The slot file the host writes: the module build it targets, then the plan bytes unchanged.
pub fn encode_slot(build_id: &str, plan_json: &str) -> String {
    format!(
        r#"{{"format":"{SLOT_FORMAT}","buildId":{},"plan":{plan_json}}}"#,
        json_string(build_id)
    )
}

fn json_string(value: &str) -> String {
    serde_json::Value::String(value.to_owned()).to_string()
}

// A bare plan predates the envelope; it names no build.
fn decode_slot(bytes: &[u8]) -> Option<(Option<String>, PlanIdentity)> {
    match serde_json::from_slice::<SlotFormat>(bytes)
        .ok()?
        .format
        .as_str()
    {
        SLOT_FORMAT => {
            let envelope = serde_json::from_slice::<SlotEnvelope>(bytes).ok()?;
            (envelope.format == SLOT_FORMAT && envelope.plan.format == PLAN_FORMAT)
                .then_some((Some(envelope.build_id), envelope.plan))
        }
        PLAN_FORMAT => Some((None, serde_json::from_slice::<PlanIdentity>(bytes).ok()?)),
        _ => None,
    }
}

fn slot_facts(slot: u8, state: PlanSlotState, modified_at_ms: Option<u64>) -> PlanSlotFacts {
    PlanSlotFacts {
        slot,
        state,
        modified_at_ms,
        build_id: None,
        route_key: None,
        biome_keys: Vec::new(),
        plan_fingerprint: None,
        project_id: None,
        display_name: None,
        weapon_key: None,
        aspect_key: None,
    }
}

/// The active slot as found on disk; a missing or invalid file names no slot.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum ActiveSlotFacts {
    Present { slot: u8 },
    Missing,
    Invalid,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct ActiveSlotFile {
    format: String,
    format_version: u8,
    slot: u8,
}

/// Decodes `active-slot.json` exactly as the game module does: an object with the three
/// literal keys once each, and integer tokens only, so `3.0` and `3e0` are refused.
pub fn decode_active_slot(bytes: &[u8]) -> Option<u8> {
    if bytes.len() > MAX_ACTIVE_SLOT_BYTES {
        return None;
    }
    // The derived visitor also accepts an array, which the module does not.
    let Ok(Value::Object(_)) = serde_json::from_slice::<Value>(bytes) else {
        return None;
    };
    let file = serde_json::from_slice::<ActiveSlotFile>(bytes).ok()?;
    // The module matches key tokens as written, so escaped key spellings are refused.
    let text = std::str::from_utf8(bytes).ok()?;
    let literal_keys = ["\"format\"", "\"formatVersion\"", "\"slot\""]
        .iter()
        .all(|key| text.contains(key));
    (literal_keys
        && file.format == ACTIVE_SLOT_FORMAT
        && file.format_version == 1
        && (1..=PLAN_SLOT_COUNT).contains(&file.slot))
    .then_some(file.slot)
}

pub fn encode_active_slot(slot_number: u8) -> Result<String, String> {
    slot_file_name(slot_number)?;
    Ok(format!(
        r#"{{"format":"{ACTIVE_SLOT_FORMAT}","formatVersion":1,"slot":{slot_number}}}"#
    ))
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

fn read_slot(slot: u8, path: &Path, installed_build_id: Option<&str>) -> PlanSlotFacts {
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
    match decode_slot(&bytes) {
        Some((build_id, identity)) => PlanSlotFacts {
            slot,
            state: if build_id.is_some() && build_id.as_deref() == installed_build_id {
                PlanSlotState::Present
            } else {
                PlanSlotState::Stale
            },
            modified_at_ms,
            build_id,
            route_key: Some(identity.route_key),
            biome_keys: identity.extent.biome_keys,
            plan_fingerprint: Some(identity.plan_fingerprint),
            project_id: Some(identity.project_id),
            display_name: identity.display_name,
            weapon_key: identity
                .starting_loadout
                .as_ref()
                .map(|loadout| loadout.weapon_key.clone()),
            aspect_key: identity
                .starting_loadout
                .and_then(|loadout| loadout.aspect_key),
        },
        None => unreadable,
    }
}

fn read_active_slot(path: &Path) -> ActiveSlotFacts {
    let metadata = match fs::symlink_metadata(path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return ActiveSlotFacts::Missing
        }
        Err(_) => return ActiveSlotFacts::Invalid,
        Ok(metadata) => metadata,
    };
    if metadata.file_type().is_symlink()
        || !metadata.is_file()
        || metadata.len() > MAX_ACTIVE_SLOT_BYTES as u64
    {
        return ActiveSlotFacts::Invalid;
    }
    let mut bytes = Vec::new();
    let read = fs::File::open(path).and_then(|file| {
        file.take(MAX_ACTIVE_SLOT_BYTES as u64 + 1)
            .read_to_end(&mut bytes)
    });
    match read.ok().and_then(|_| decode_active_slot(&bytes)) {
        Some(slot) => ActiveSlotFacts::Present { slot },
        None => ActiveSlotFacts::Invalid,
    }
}

/// Reads `active-slot.json` under the same link and containment rules as the slots.
pub fn inspect_active_slot(target: &ResolvedTarget) -> ActiveSlotFacts {
    match module_config_dir(target) {
        Ok(None) => ActiveSlotFacts::Missing,
        Err(_) => ActiveSlotFacts::Invalid,
        Ok(Some(directory)) => read_active_slot(&directory.join(ACTIVE_SLOT_FILE)),
    }
}

/// Reads all six plan slots against the installed module build; an unsafe config folder
/// makes every slot unreadable.
pub fn inspect_slots(
    target: &ResolvedTarget,
    installed_build_id: Option<&str>,
) -> Vec<PlanSlotFacts> {
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
                    installed_build_id,
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

    const BUILD: &str = "build-1";

    const PLAN: &str = r#"{"format":"run-planner-execution","catalogVersion":"c","projectId":"p","planFingerprint":"abc123","displayName":"Surface Phial run","routeKey":"Underworld","startingLoadout":{"weaponKey":"WeaponStaffSwing","aspectKey":"BaseStaffAspect","arcana":[],"fear":{}},"extent":{"kind":"configuredPrefix","biomeKeys":["F","G"],"terminalBiomeKey":"G"}}"#;

    #[test]
    fn slots_report_empty_present_and_unreadable_without_failing_the_rest() {
        let temporary = TemporaryDirectory::new("slots");
        let target = make_target(&temporary.0);
        assert!(inspect_slots(&target, Some(BUILD))
            .iter()
            .all(|slot| slot.state == PlanSlotState::Empty));
        fs::create_dir_all(slot_path(&target, 1).parent().unwrap()).unwrap();
        fs::write(slot_path(&target, 1), encode_slot(BUILD, PLAN)).unwrap();
        fs::write(slot_path(&target, 2), "not json").unwrap();
        fs::write(
            slot_path(&target, 3),
            encode_slot(
                BUILD,
                &PLAN.replace("run-planner-execution", "authored-project"),
            ),
        )
        .unwrap();
        fs::write(slot_path(&target, 4), vec![b' '; MAX_PLAN_BYTES + 1]).unwrap();
        let slots = inspect_slots(&target, Some(BUILD));
        assert_eq!(slots.len(), 6);
        assert_eq!(
            slots[0],
            PlanSlotFacts {
                slot: 1,
                state: PlanSlotState::Present,
                modified_at_ms: slots[0].modified_at_ms,
                build_id: Some(BUILD.to_owned()),
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
            encode_slot(
                BUILD,
                &PLAN.replace(r#""displayName":"Surface Phial run","#, ""),
            ),
        )
        .unwrap();
        let legacy = &inspect_slots(&target, Some(BUILD))[4];
        assert_eq!(legacy.state, PlanSlotState::Present);
        assert_eq!(legacy.display_name, None);
        assert_eq!(legacy.aspect_key.as_deref(), Some("BaseStaffAspect"));
        let without_loadout = PLAN.replace(
            r#""startingLoadout":{"weaponKey":"WeaponStaffSwing","aspectKey":"BaseStaffAspect","arcana":[],"fear":{}},"#,
            "",
        );
        assert!(!without_loadout.contains("startingLoadout"));
        fs::write(
            slot_path(&target, 5),
            encode_slot(
                BUILD,
                &PLAN.replace(r#""aspectKey":"BaseStaffAspect","#, ""),
            ),
        )
        .unwrap();
        let without_aspect = &inspect_slots(&target, Some(BUILD))[4];
        assert_eq!(without_aspect.state, PlanSlotState::Present);
        assert_eq!(without_aspect.aspect_key, None);
        assert_eq!(
            without_aspect.weapon_key.as_deref(),
            Some("WeaponStaffSwing")
        );
        fs::write(slot_path(&target, 5), encode_slot(BUILD, &without_loadout)).unwrap();
        let unknown = &inspect_slots(&target, Some(BUILD))[4];
        assert_eq!(unknown.state, PlanSlotState::Present);
        assert_eq!(unknown.aspect_key, None);
        assert_eq!(unknown.weapon_key, None);
        fs::remove_file(slot_path(&target, 5)).unwrap();
        assert_eq!(slots[4].state, PlanSlotState::Empty);
        assert_eq!(slots[5].state, PlanSlotState::Empty);
    }

    #[test]
    fn slots_for_another_build_or_without_an_envelope_are_stale() {
        let temporary = TemporaryDirectory::new("stale-slots");
        let target = make_target(&temporary.0);
        fs::create_dir_all(slot_path(&target, 1).parent().unwrap()).unwrap();
        fs::write(slot_path(&target, 1), encode_slot(BUILD, PLAN)).unwrap();
        fs::write(slot_path(&target, 2), encode_slot("build-0", PLAN)).unwrap();
        fs::write(slot_path(&target, 3), PLAN).unwrap();
        let extra = encode_slot(BUILD, PLAN).replacen('{', r#"{"extra":1,"#, 1);
        fs::write(slot_path(&target, 4), extra).unwrap();
        let slots = inspect_slots(&target, Some(BUILD));
        assert_eq!(slots[0].state, PlanSlotState::Present);
        assert_eq!(slots[1].state, PlanSlotState::Stale);
        assert_eq!(slots[1].build_id.as_deref(), Some("build-0"));
        assert_eq!(slots[1].plan_fingerprint.as_deref(), Some("abc123"));
        assert_eq!(slots[2].state, PlanSlotState::Stale);
        assert_eq!(slots[2].build_id, None);
        assert_eq!(slots[3].state, PlanSlotState::Unreadable);
        assert!(inspect_slots(&target, None)[..3]
            .iter()
            .all(|slot| slot.state == PlanSlotState::Stale));
        assert_eq!(
            encode_slot(BUILD, "{}"),
            r#"{"format":"run-planner-slot","buildId":"build-1","plan":{}}"#
        );
    }

    #[test]
    fn active_slot_decodes_only_the_exact_integer_form() {
        for slot in 1..=6 {
            let encoded = encode_active_slot(slot).unwrap();
            assert_eq!(decode_active_slot(encoded.as_bytes()), Some(slot));
        }
        assert_eq!(
            encode_active_slot(3).unwrap(),
            r#"{"format":"run-planner-active-slot","formatVersion":1,"slot":3}"#
        );
        assert!(encode_active_slot(0).is_err());
        assert!(encode_active_slot(7).is_err());
        assert_eq!(
            decode_active_slot(
                br#" { "slot" : 2, "formatVersion" : 1, "format" : "run-planner-active-slot" } "#
            ),
            Some(2)
        );
        let padded = format!(
            r#"{{"format":"run-planner-active-slot","formatVersion":1,"slot":4}}{}"#,
            " ".repeat(MAX_ACTIVE_SLOT_BYTES)
        );
        for rejected in [
            r#"{"format":"run-planner-active-slot","formatVersion":1,"slot":3.0}"#,
            r#"{"format":"run-planner-active-slot","formatVersion":1,"slot":3e0}"#,
            r#"{"format":"run-planner-active-slot","formatVersion":1,"slot":"3"}"#,
            r#"{"format":"run-planner-active-slot","formatVersion":1,"slot":0}"#,
            r#"{"format":"run-planner-active-slot","formatVersion":1,"slot":7}"#,
            r#"{"format":"run-planner-active-slot","formatVersion":1,"slot":-1}"#,
            r#"{"format":"run-planner-active-slot","formatVersion":1.0,"slot":3}"#,
            r#"{"format":"run-planner-active-slot","formatVersion":2,"slot":3}"#,
            r#"{"format":"run-planner-active-slot","formatVersion":1}"#,
            r#"{"format":"run-planner-active-slot","formatVersion":1,"slot":3,"extra":1}"#,
            r#"{"format":"run-planner-execution","formatVersion":1,"slot":3}"#,
            r#"{"formatVersion":1,"slot":3}"#,
            r#"["run-planner-active-slot",1,3]"#,
            r#"{"format":"run-planner-active-slot","formatVersion":1,"slot":3,"slot":3}"#,
            r#"{"format":"run-planner-active-slot","format":"run-planner-active-slot","formatVersion":1,"slot":3}"#,
            r#"{"format":"run-planner-active-slot","formatVersion":1,"\u0073lot":3}"#,
            r#"{"\u0066ormat":"run-planner-active-slot","formatVersion":1,"slot":3}"#,
            "3",
            "",
            "{",
            padded.as_str(),
        ] {
            assert_eq!(decode_active_slot(rejected.as_bytes()), None, "{rejected}");
        }
    }

    #[test]
    fn active_slot_reads_present_missing_and_invalid_files() {
        let temporary = TemporaryDirectory::new("active-slot");
        let target = make_target(&temporary.0);
        assert_eq!(inspect_active_slot(&target), ActiveSlotFacts::Missing);
        let directory = slot_path(&target, 1).parent().unwrap().to_owned();
        fs::create_dir_all(&directory).unwrap();
        let path = directory.join(ACTIVE_SLOT_FILE);
        assert_eq!(inspect_active_slot(&target), ActiveSlotFacts::Missing);
        fs::write(&path, encode_active_slot(5).unwrap()).unwrap();
        assert_eq!(
            inspect_active_slot(&target),
            ActiveSlotFacts::Present { slot: 5 }
        );
        assert_eq!(
            serde_json::to_value(inspect_active_slot(&target)).unwrap(),
            serde_json::json!({ "state": "present", "slot": 5 })
        );
        fs::write(&path, "slot 5").unwrap();
        assert_eq!(inspect_active_slot(&target), ActiveSlotFacts::Invalid);
        assert_eq!(
            serde_json::to_value(ActiveSlotFacts::Invalid).unwrap(),
            serde_json::json!({ "state": "invalid" })
        );
        fs::remove_file(&path).unwrap();
        fs::create_dir(&path).unwrap();
        assert_eq!(inspect_active_slot(&target), ActiveSlotFacts::Invalid);
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
        assert_eq!(
            inspect_slots(&target, Some(BUILD))[0].state,
            PlanSlotState::Unreadable
        );
        let outside_active = temporary.0.join("outside-active.json");
        fs::write(&outside_active, encode_active_slot(2).unwrap()).unwrap();
        symlink(
            &outside_active,
            slot_path(&target, 1).with_file_name(ACTIVE_SLOT_FILE),
        )
        .unwrap();
        assert_eq!(inspect_active_slot(&target), ActiveSlotFacts::Invalid);

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
        assert!(inspect_slots(&other, Some(BUILD))
            .iter()
            .all(|slot| slot.state == PlanSlotState::Unreadable));
        assert_eq!(inspect_active_slot(&other), ActiveSlotFacts::Invalid);
    }
}
