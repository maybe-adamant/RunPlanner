//! The player's game module options in `settings.json` beside the plan slots, which the
//! planner and the module both write, one option at a time.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::io::Read;
use std::path::Path;

use crate::atomic_file;
use crate::game_module_install::{status, PublicationBlocker};
use crate::game_module_package::ModulePackage;
use crate::game_plan_publication::shared_file_destination;
use crate::game_target::{existing_directory, ResolvedTarget, CONFIG_DIRECTORY};
use crate::plan_slots::{module_config_dir, MODULE_CONFIG_DIRECTORY};

pub const SETTINGS_FILE: &str = "settings.json";
pub const MAX_SETTINGS_BYTES: usize = 1024;
const SETTINGS_FORMAT: &str = "run-planner-settings";
/// The module reads at most this much of its ModpackLib `.cfg`.
const MAX_LEGACY_CONFIG_BYTES: u64 = 64 * 1024;

/// Each option is off when the file is missing or invalid.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameSettings {
    pub show_room_guide: bool,
    pub highlight_planned_choices: bool,
    pub snap_mode: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GameSettingOption {
    ShowRoomGuide,
    HighlightPlannedChoices,
    SnapMode,
}

impl GameSettings {
    fn with(mut self, option: GameSettingOption, enabled: bool) -> Self {
        match option {
            GameSettingOption::ShowRoomGuide => self.show_room_guide = enabled,
            GameSettingOption::HighlightPlannedChoices => self.highlight_planned_choices = enabled,
            GameSettingOption::SnapMode => self.snap_mode = enabled,
        }
        self
    }
}

/// `settings.json` as found on disk, or while it is missing the earlier ModpackLib ticks the
/// module will seed it from; a missing or invalid file holds no options.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum GameSettingsFacts {
    Present { settings: GameSettings },
    Missing,
    Invalid,
}

impl GameSettingsFacts {
    /// The options the module uses: the file's, or every option off.
    pub fn effective(self) -> GameSettings {
        match self {
            GameSettingsFacts::Present { settings } => settings,
            GameSettingsFacts::Missing | GameSettingsFacts::Invalid => GameSettings::default(),
        }
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct SettingsFile {
    format: String,
    format_version: u8,
    show_room_guide: bool,
    highlight_planned_choices: bool,
    snap_mode: bool,
}

/// Decodes `settings.json` exactly as the game module does: an object with the format, a
/// literal `formatVersion` integer token of 1 and the three booleans, and nothing else.
pub fn decode_settings(bytes: &[u8]) -> Option<GameSettings> {
    if bytes.len() > MAX_SETTINGS_BYTES {
        return None;
    }
    // The derived visitor also accepts an array, which the module does not.
    let Ok(Value::Object(_)) = serde_json::from_slice::<Value>(bytes) else {
        return None;
    };
    let file = serde_json::from_slice::<SettingsFile>(bytes).ok()?;
    // The module reads the version from its literal key token.
    let literal_version = std::str::from_utf8(bytes)
        .ok()?
        .contains("\"formatVersion\"");
    (literal_version && file.format == SETTINGS_FORMAT && file.format_version == 1).then_some(
        GameSettings {
            show_room_guide: file.show_room_guide,
            highlight_planned_choices: file.highlight_planned_choices,
            snap_mode: file.snap_mode,
        },
    )
}

/// The compact form both sides write, options in file order.
pub fn encode_settings(settings: GameSettings) -> String {
    format!(
        r#"{{"format":"{SETTINGS_FORMAT}","formatVersion":1,"showRoomGuide":{},"highlightPlannedChoices":{},"snapMode":{}}}"#,
        settings.show_room_guide, settings.highlight_planned_choices, settings.snap_mode
    )
}

fn read_settings(path: &Path) -> GameSettingsFacts {
    let metadata = match fs::symlink_metadata(path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return GameSettingsFacts::Missing
        }
        Err(_) => return GameSettingsFacts::Invalid,
        Ok(metadata) => metadata,
    };
    if metadata.file_type().is_symlink()
        || !metadata.is_file()
        || metadata.len() > MAX_SETTINGS_BYTES as u64
    {
        return GameSettingsFacts::Invalid;
    }
    let mut bytes = Vec::new();
    let read = fs::File::open(path).and_then(|file| {
        file.take(MAX_SETTINGS_BYTES as u64 + 1)
            .read_to_end(&mut bytes)
    });
    match read.ok().and_then(|_| decode_settings(&bytes)) {
        Some(settings) => GameSettingsFacts::Present { settings },
        None => GameSettingsFacts::Invalid,
    }
}

/// The options' earlier ModpackLib ticks, read as the module reads them to seed
/// `settings.json`: `true`/`false` lines under `[config]` (or before any section header),
/// or none when the file holds none of them.
pub fn decode_legacy_config(bytes: &[u8]) -> Option<GameSettings> {
    let text = String::from_utf8_lossy(bytes);
    let mut settings = GameSettings::default();
    let mut found = false;
    let mut in_config = true;
    for line in text.split(['\r', '\n']).filter(|line| !line.is_empty()) {
        let trimmed = line.trim();
        if let Some(name) = trimmed
            .strip_prefix('[')
            .and_then(|rest| rest.strip_suffix(']'))
            .filter(|name| !name.is_empty() && !name.contains(']'))
        {
            in_config = name == "config";
            continue;
        }
        if !in_config {
            continue;
        }
        let Some((key, value)) = trimmed.split_once('=') else {
            continue;
        };
        let (key, value) = (key.trim_end(), value.trim_start());
        if key.is_empty() || !key.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_') {
            continue;
        }
        let enabled = match value {
            "true" => true,
            "false" => false,
            _ => continue,
        };
        let option = match key {
            "ShowRoomGuide" => GameSettingOption::ShowRoomGuide,
            "HighlightPlannedChoices" => GameSettingOption::HighlightPlannedChoices,
            "SnapMode" => GameSettingOption::SnapMode,
            _ => continue,
        };
        settings = settings.with(option, enabled);
        found = true;
    }
    found.then_some(settings)
}

// The module's ModpackLib `.cfg`, a regular file directly in the contained config folder.
fn read_legacy_config(target: &ResolvedTarget) -> Option<GameSettings> {
    let config = existing_directory(&target.rom.join(CONFIG_DIRECTORY), &target.rom).ok()?;
    let path = config.join(format!("{MODULE_CONFIG_DIRECTORY}.cfg"));
    let metadata = fs::symlink_metadata(&path).ok()?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return None;
    }
    let mut bytes = Vec::new();
    fs::File::open(&path)
        .and_then(|file| file.take(MAX_LEGACY_CONFIG_BYTES).read_to_end(&mut bytes))
        .ok()?;
    decode_legacy_config(&bytes)
}

/// Reads `settings.json` under the same link and containment rules as the plan slots. While
/// it is missing, the options' earlier ModpackLib ticks stand in for it, as the module seeds
/// them once when it loads; once the file exists the `.cfg` is never read.
pub fn inspect_settings(target: &ResolvedTarget) -> GameSettingsFacts {
    let found = match module_config_dir(target) {
        Ok(None) => GameSettingsFacts::Missing,
        Err(_) => GameSettingsFacts::Invalid,
        Ok(Some(directory)) => read_settings(&directory.join(SETTINGS_FILE)),
    };
    match found {
        GameSettingsFacts::Missing => read_legacy_config(target)
            .map_or(GameSettingsFacts::Missing, |settings| {
                GameSettingsFacts::Present { settings }
            }),
        found => found,
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SettingChangeStatus {
    Saved,
    Blocked,
    NativeWrite,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameSettingChange {
    pub status: SettingChangeStatus,
    pub message: String,
    pub blockers: Vec<PublicationBlocker>,
}

/// Changes one option over the file as it is now, so the others keep what the game last
/// wrote, on any established target whose module folder can be used, even while the module or
/// ModpackLib needs an update.
pub fn set_game_setting(
    config_dir: &Path,
    package: &ModulePackage,
    option: GameSettingOption,
    enabled: bool,
) -> GameSettingChange {
    let (status, target) = status(config_dir, package);
    let Some(target) = target else {
        return GameSettingChange {
            status: SettingChangeStatus::Blocked,
            message: "The game target is not available.".to_owned(),
            blockers: status.publication_blockers,
        };
    };
    let settings = inspect_settings(&target).effective().with(option, enabled);
    let written =
        shared_file_destination(&target, SETTINGS_FILE, "settings file").and_then(|destination| {
            atomic_file::write(
                &destination,
                encode_settings(settings).as_bytes(),
                "settings file",
            )
        });
    match written {
        Ok(()) => GameSettingChange {
            status: SettingChangeStatus::Saved,
            message: "Saved.".to_owned(),
            blockers: Vec::new(),
        },
        Err(message) => GameSettingChange {
            status: SettingChangeStatus::NativeWrite,
            message,
            blockers: Vec::new(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_module_install::test_support::{modpack_lib, package, target};
    use crate::game_module_install::BlockerCode;
    use crate::game_target::test_support::TemporaryDirectory;
    use crate::game_target::{remember_target, TargetKind, CONFIG_DIRECTORY};
    use crate::plan_slots::MODULE_CONFIG_DIRECTORY;
    use std::path::PathBuf;

    const ALL_OFF: GameSettings = GameSettings {
        show_room_guide: false,
        highlight_planned_choices: false,
        snap_mode: false,
    };

    fn settings_file(target: &ResolvedTarget) -> PathBuf {
        target
            .rom
            .join(CONFIG_DIRECTORY)
            .join(MODULE_CONFIG_DIRECTORY)
            .join(SETTINGS_FILE)
    }

    #[test]
    fn decoding_accepts_only_the_exact_contract_the_module_reads() {
        let settings = GameSettings {
            show_room_guide: true,
            highlight_planned_choices: false,
            snap_mode: true,
        };
        let encoded = encode_settings(settings);
        assert_eq!(
            encoded,
            r#"{"format":"run-planner-settings","formatVersion":1,"showRoomGuide":true,"highlightPlannedChoices":false,"snapMode":true}"#
        );
        assert_eq!(decode_settings(encoded.as_bytes()), Some(settings));
        assert_eq!(
            decode_settings(
                br#" { "snapMode": false, "highlightPlannedChoices": false, "showRoomGuide": false, "formatVersion": 1, "format": "run-planner-settings" }"#
            ),
            Some(ALL_OFF)
        );
        for refused in [
            "",
            "[]",
            r#"{"format":"run-planner-settings","formatVersion":1,"showRoomGuide":true,"highlightPlannedChoices":false}"#,
            r#"{"format":"run-planner-settings","formatVersion":1,"showRoomGuide":1,"highlightPlannedChoices":false,"snapMode":false}"#,
            r#"{"format":"run-planner-settings","formatVersion":1.0,"showRoomGuide":true,"highlightPlannedChoices":false,"snapMode":false}"#,
            r#"{"format":"run-planner-settings","formatVersion":2,"showRoomGuide":true,"highlightPlannedChoices":false,"snapMode":false}"#,
            r#"{"format":"other","formatVersion":1,"showRoomGuide":true,"highlightPlannedChoices":false,"snapMode":false}"#,
            r#"{"format":"run-planner-settings","formatVersion":1,"showRoomGuide":true,"highlightPlannedChoices":false,"snapMode":false,"extra":true}"#,
            r#"{"format":"run-planner-settings","format\u0056ersion":1,"showRoomGuide":true,"highlightPlannedChoices":false,"snapMode":false}"#,
        ] {
            assert_eq!(decode_settings(refused.as_bytes()), None, "{refused}");
        }
        assert_eq!(
            decode_settings(" ".repeat(MAX_SETTINGS_BYTES + 1).as_bytes()),
            None
        );
    }

    #[test]
    fn inspection_reports_missing_present_and_invalid_files() {
        let temporary = TemporaryDirectory::new("settings-inspect");
        let target = target(&temporary.0, TargetKind::Manual);
        assert_eq!(inspect_settings(&target), GameSettingsFacts::Missing);
        let path = settings_file(&target);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, "{broken").unwrap();
        assert_eq!(inspect_settings(&target), GameSettingsFacts::Invalid);
        assert_eq!(inspect_settings(&target).effective(), ALL_OFF);
        let on = ALL_OFF.with(GameSettingOption::SnapMode, true);
        fs::write(&path, encode_settings(on)).unwrap();
        assert_eq!(
            inspect_settings(&target),
            GameSettingsFacts::Present { settings: on }
        );
    }

    #[test]
    fn a_change_writes_one_option_over_the_file_on_an_established_target() {
        let temporary = TemporaryDirectory::new("settings-set");
        let config = temporary.0.join("app-config");
        let root = temporary.0.join("target");
        let target = target(&root, TargetKind::Manual);
        modpack_lib(&root, "4.2.0");
        let package = package("1.2.0", "return 1");
        let unset = set_game_setting(&config, &package, GameSettingOption::SnapMode, true);
        assert_eq!(unset.status, SettingChangeStatus::Blocked);
        assert_eq!(unset.blockers[0].code, BlockerCode::NoTarget);
        remember_target(&config, &target).unwrap();
        // The module is not installed yet; the option is still kept for it.
        let saved = set_game_setting(&config, &package, GameSettingOption::SnapMode, true);
        assert_eq!(
            saved.status,
            SettingChangeStatus::Saved,
            "{}",
            saved.message
        );
        // A change the game made to another option is kept.
        let path = settings_file(&target);
        fs::write(
            &path,
            encode_settings(ALL_OFF.with(GameSettingOption::ShowRoomGuide, true)),
        )
        .unwrap();
        set_game_setting(
            &config,
            &package,
            GameSettingOption::HighlightPlannedChoices,
            true,
        );
        assert_eq!(
            fs::read_to_string(&path).unwrap(),
            r#"{"format":"run-planner-settings","formatVersion":1,"showRoomGuide":true,"highlightPlannedChoices":true,"snapMode":false}"#
        );
        let names: Vec<String> = fs::read_dir(path.parent().unwrap())
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert!(
            names.iter().all(|name| !name.ends_with(".tmp")),
            "{names:?}"
        );
        // An invalid file counts as every option off.
        fs::write(&path, "stale").unwrap();
        set_game_setting(&config, &package, GameSettingOption::SnapMode, true);
        assert_eq!(
            inspect_settings(&target),
            GameSettingsFacts::Present {
                settings: ALL_OFF.with(GameSettingOption::SnapMode, true)
            }
        );
    }

    fn legacy_config(target: &ResolvedTarget) -> PathBuf {
        target
            .rom
            .join(CONFIG_DIRECTORY)
            .join(format!("{MODULE_CONFIG_DIRECTORY}.cfg"))
    }

    #[test]
    fn legacy_ticks_are_read_only_from_the_config_section() {
        assert_eq!(decode_legacy_config(b""), None);
        assert_eq!(decode_legacy_config(b"[config]\nEnabled = true\n"), None);
        assert_eq!(
            decode_legacy_config(
                b"## Settings file\r\n\r\n[config]\r\nEnabled = true\r\n  SnapMode=true  \r\nShowRoomGuide = yes\r\nHighlightPlannedChoices = false\r\n\r\n[other]\r\nShowRoomGuide = true\r\n"
            ),
            Some(ALL_OFF.with(GameSettingOption::SnapMode, true))
        );
        assert_eq!(
            decode_legacy_config(b"ShowRoomGuide = true\n"),
            Some(ALL_OFF.with(GameSettingOption::ShowRoomGuide, true))
        );
    }

    #[test]
    fn a_missing_file_shows_and_keeps_the_earlier_modpacklib_ticks() {
        let temporary = TemporaryDirectory::new("settings-legacy");
        let config = temporary.0.join("app-config");
        let root = temporary.0.join("target");
        let target = target(&root, TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        let legacy = legacy_config(&target);
        fs::create_dir_all(legacy.parent().unwrap()).unwrap();
        fs::write(
            &legacy,
            "[config]\nEnabled = true\nShowRoomGuide = true\nHighlightPlannedChoices = true\nSnapMode = false\n",
        )
        .unwrap();
        let ticked = GameSettings {
            show_room_guide: true,
            highlight_planned_choices: true,
            snap_mode: false,
        };
        assert_eq!(
            inspect_settings(&target),
            GameSettingsFacts::Present { settings: ticked }
        );
        let saved = set_game_setting(
            &config,
            &package("1.2.0", "return 1"),
            GameSettingOption::SnapMode,
            true,
        );
        assert_eq!(
            saved.status,
            SettingChangeStatus::Saved,
            "{}",
            saved.message
        );
        let written = ticked.with(GameSettingOption::SnapMode, true);
        assert_eq!(
            fs::read_to_string(settings_file(&target)).unwrap(),
            encode_settings(written)
        );
        // Once settings.json exists, the .cfg is never read again.
        fs::write(settings_file(&target), encode_settings(ALL_OFF)).unwrap();
        assert_eq!(
            inspect_settings(&target),
            GameSettingsFacts::Present { settings: ALL_OFF }
        );
        fs::write(settings_file(&target), "stale").unwrap();
        assert_eq!(inspect_settings(&target), GameSettingsFacts::Invalid);
    }

    #[cfg(unix)]
    #[test]
    fn a_linked_legacy_config_is_not_read() {
        let temporary = TemporaryDirectory::new("settings-legacy-link");
        let target = target(&temporary.0, TargetKind::Manual);
        let legacy = legacy_config(&target);
        fs::create_dir_all(legacy.parent().unwrap()).unwrap();
        let elsewhere = temporary.0.join("elsewhere.cfg");
        fs::write(&elsewhere, "[config]\nSnapMode = true\n").unwrap();
        std::os::unix::fs::symlink(&elsewhere, &legacy).unwrap();
        assert_eq!(inspect_settings(&target), GameSettingsFacts::Missing);
    }

    #[cfg(unix)]
    #[test]
    fn a_linked_settings_file_is_neither_read_nor_replaced() {
        let temporary = TemporaryDirectory::new("settings-link");
        let config = temporary.0.join("app-config");
        let root = temporary.0.join("target");
        let target = target(&root, TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        let path = settings_file(&target);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        let elsewhere = temporary.0.join("elsewhere.json");
        fs::write(&elsewhere, encode_settings(ALL_OFF)).unwrap();
        std::os::unix::fs::symlink(&elsewhere, &path).unwrap();
        assert_eq!(inspect_settings(&target), GameSettingsFacts::Invalid);
        let refused = set_game_setting(
            &config,
            &package("1.2.0", "return 1"),
            GameSettingOption::SnapMode,
            true,
        );
        assert_eq!(refused.status, SettingChangeStatus::NativeWrite);
        assert_eq!(
            fs::read_to_string(&elsewhere).unwrap(),
            encode_settings(ALL_OFF)
        );
    }
}
