use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::fs;
use std::io::{Cursor, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::atomic_file;
use crate::external_url::ISSUE_PAGE_URL;
use crate::game_module_install::{self, GameModuleStatus};
use crate::game_module_package::ModulePackage;
use crate::game_target::{existing_directory, ResolvedTarget};
use crate::plan_slots::{module_config_dir, slot_file_name, MAX_PLAN_BYTES, PLAN_SLOT_COUNT};

pub const REPORT_FORMAT: &str = "run-planner-bug-report";
pub const LOG_OUTPUT_TAIL_BYTES: u64 = 2 * 1024 * 1024;
pub const LOVELY_TAIL_BYTES: u64 = 1024 * 1024;
const LOG_OUTPUT_FILE: &str = "LogOutput.log";
const LOVELY_FILE: &str = "lovely.log";
const BACKUP_DIRECTORY: &str = "backup";
const BACKUP_SUFFIX: &str = "_LogOutput.log";
const PROFILE_PLACEHOLDER: &[u8] = b"%USERPROFILE%";
const USERNAME_PLACEHOLDER: &[u8] = b"%USERNAME%";

/// What the application asks to include; app facts are opaque to the host.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BugReportRequest {
    pub app_facts: Map<String, Value>,
    pub open_plan: Option<String>,
    pub include_plan_slots: bool,
    pub include_logs: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BugReportWritten {
    pub file_name: String,
    pub entries: Vec<String>,
    pub issue_page_url: &'static str,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FileState {
    Included,
    Missing,
    Unreadable,
}

/// One source file considered for the report, named relative to its folder.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileRecord {
    pub source: String,
    pub state: FileState,
    pub entry: Option<String>,
    pub size_bytes: Option<u64>,
    pub included_bytes: Option<u64>,
    pub truncated: bool,
    pub problem: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SectionRecord {
    pub requested: bool,
    pub problem: Option<String>,
    pub files: Vec<FileRecord>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HostFacts<'a> {
    os: &'static str,
    arch: &'static str,
    game_module: &'a GameModuleStatus,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReportDocument<'a> {
    format: &'static str,
    created_at_ms: u64,
    app: &'a Map<String, Value>,
    host: HostFacts<'a>,
    open_plan: SectionRecord,
    plan_slots: SectionRecord,
    logs: SectionRecord,
}

pub struct ReportEntry {
    pub name: String,
    pub bytes: Vec<u8>,
}

/// Replaces the user's profile folder with `%USERPROFILE%` in any separator form.
/// URL-encoded, `\u`-escaped and non-UTF-8 spellings of the path are not recognized.
pub struct Redaction {
    components: Vec<Vec<u8>>,
    rooted: bool,
    // The 8.3 short-name prefix Windows derives from the user name, as in `JANEDO~1`.
    short_prefix: Vec<u8>,
}

fn is_separator(byte: u8) -> bool {
    byte == b'/' || byte == b'\\'
}

fn is_name_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-' | b'.') || byte >= 0x80
}

// A trailing `.` ends a path when no name byte follows it, as at a sentence end.
fn ends_at(text: &[u8], position: usize) -> bool {
    position == text.len()
        || !is_name_byte(text[position])
        || (text[position] == b'.'
            && (position + 1 == text.len() || !is_name_byte(text[position + 1])))
}

fn separators(text: &[u8], mut position: usize) -> Option<usize> {
    let start = position;
    while position < text.len() && is_separator(text[position]) {
        position += 1;
    }
    (position > start).then_some(position)
}

fn component_at(text: &[u8], position: usize, component: &[u8]) -> Option<usize> {
    let end = position.checked_add(component.len())?;
    (end <= text.len() && text[position..end].eq_ignore_ascii_case(component)).then_some(end)
}

impl Redaction {
    /// The profile folder from USERPROFILE on Windows and HOME elsewhere.
    pub fn from_environment() -> Self {
        let variable = if cfg!(target_os = "windows") {
            "USERPROFILE"
        } else {
            "HOME"
        };
        Self::for_profile(
            &std::env::var_os(variable)
                .map(|value| value.to_string_lossy().into_owned())
                .unwrap_or_default(),
        )
    }

    pub fn for_profile(profile: &str) -> Self {
        let components: Vec<Vec<u8>> = profile
            .split(['/', '\\'])
            .filter(|component| !component.is_empty())
            .map(|component| component.as_bytes().to_vec())
            .collect();
        let short_prefix = components
            .last()
            .map(|name| {
                name.iter()
                    .copied()
                    .filter(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
                    .take(6)
                    .collect()
            })
            .unwrap_or_default();
        Self {
            // A drive or filesystem root alone is never redacted.
            components: if components.len() >= 2 {
                components
            } else {
                Vec::new()
            },
            rooted: profile.starts_with(['/', '\\']),
            short_prefix,
        }
    }

    // The user name in full or as its `<prefix>~<digits>` short form.
    fn username_at(&self, text: &[u8], position: usize, username: &[u8]) -> Option<usize> {
        if let Some(end) = component_at(text, position, username) {
            return Some(end);
        }
        if self.short_prefix.is_empty() {
            return None;
        }
        let tilde = component_at(text, position, &self.short_prefix)?;
        if text.get(tilde) != Some(&b'~') {
            return None;
        }
        let digits = text[tilde + 1..]
            .iter()
            .take_while(|byte| byte.is_ascii_digit())
            .count();
        (digits > 0).then_some(tilde + 1 + digits)
    }

    fn profile_end(&self, text: &[u8], start: usize) -> Option<usize> {
        if start > 0 && is_name_byte(text[start - 1]) {
            return None;
        }
        let mut position = if self.rooted {
            separators(text, start)?
        } else {
            start
        };
        let last = self.components.len() - 1;
        for (index, component) in self.components.iter().enumerate() {
            if index > 0 {
                position = separators(text, position)?;
            }
            position = if index == last {
                self.username_at(text, position, component)?
            } else {
                component_at(text, position, component)?
            };
        }
        ends_at(text, position).then_some(position)
    }

    // `<parent><separators><username>` under another root, e.g. /mnt/c/Users/<name>.
    fn username_end(&self, text: &[u8], start: usize) -> Option<(usize, usize)> {
        let [.., parent, username] = self.components.as_slice() else {
            return None;
        };
        if start > 0 && is_name_byte(text[start - 1]) {
            return None;
        }
        let after_parent = component_at(text, start, parent)?;
        let name_start = separators(text, after_parent)?;
        let end = self.username_at(text, name_start, username)?;
        ends_at(text, end).then_some((name_start, end))
    }

    pub fn apply(&self, text: &[u8]) -> Vec<u8> {
        if self.components.is_empty() {
            return text.to_vec();
        }
        let mut profile = Vec::with_capacity(text.len());
        let mut position = 0;
        while position < text.len() {
            match self.profile_end(text, position) {
                Some(end) => {
                    profile.extend_from_slice(PROFILE_PLACEHOLDER);
                    position = end;
                }
                None => {
                    profile.push(text[position]);
                    position += 1;
                }
            }
        }
        let mut redacted = Vec::with_capacity(profile.len());
        let mut position = 0;
        while position < profile.len() {
            match self.username_end(&profile, position) {
                Some((name_start, end)) => {
                    redacted.extend_from_slice(&profile[position..name_start]);
                    redacted.extend_from_slice(USERNAME_PLACEHOLDER);
                    position = end;
                }
                None => {
                    redacted.push(profile[position]);
                    position += 1;
                }
            }
        }
        redacted
    }
}

fn record(source: String, state: FileState, problem: Option<String>) -> FileRecord {
    FileRecord {
        source,
        state,
        entry: None,
        size_bytes: None,
        included_bytes: None,
        truncated: false,
        problem,
    }
}

/// The last `cap` bytes of a file, cut forward to the next line start.
pub fn read_tail(path: &Path, cap: u64) -> Result<(Vec<u8>, u64, bool), String> {
    let mut file = fs::File::open(path).map_err(|error| format!("could not open: {error}"))?;
    let size = file
        .metadata()
        .map_err(|error| format!("could not inspect: {error}"))?
        .len();
    let offset = size.saturating_sub(cap);
    // One byte earlier, so a line starting exactly at the cut is kept whole.
    let start = offset.saturating_sub(1);
    file.seek(SeekFrom::Start(start))
        .map_err(|error| format!("could not seek: {error}"))?;
    let mut bytes = Vec::new();
    file.take(size - start)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("could not read: {error}"))?;
    if offset > 0 {
        let cut = bytes
            .iter()
            .position(|byte| *byte == b'\n')
            .map_or(1, |newline| newline + 1);
        bytes.drain(..cut);
    }
    Ok((bytes, size, offset > 0))
}

// A regular file (not a link); `Ok(false)` when absent.
fn regular_file(path: &Path) -> Result<bool, String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.is_file() && !metadata.file_type().is_symlink() => Ok(true),
        Ok(_) => Err("not a regular file".to_owned()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(format!("could not inspect: {error}")),
    }
}

fn tail_entry(
    path: &Path,
    source: String,
    entry: String,
    cap: u64,
    entries: &mut Vec<ReportEntry>,
) -> FileRecord {
    match regular_file(path) {
        Ok(false) => return record(source, FileState::Missing, None),
        Err(problem) => return record(source, FileState::Unreadable, Some(problem)),
        Ok(true) => {}
    }
    match read_tail(path, cap) {
        Ok((bytes, size, truncated)) => {
            let included = bytes.len() as u64;
            entries.push(ReportEntry {
                name: entry.clone(),
                bytes,
            });
            FileRecord {
                source,
                state: FileState::Included,
                entry: Some(entry),
                size_bytes: Some(size),
                included_bytes: Some(included),
                truncated,
                problem: None,
            }
        }
        Err(problem) => record(source, FileState::Unreadable, Some(problem)),
    }
}

// `MM-DD-YYYY-HH-MM-SS` as a sortable YYYYMMDDHHMMSS number.
fn backup_stamp(name: &str) -> Option<u64> {
    let stamp = name.strip_suffix(BACKUP_SUFFIX)?;
    let parts: Vec<u64> = stamp
        .split('-')
        .map(|part| part.parse::<u64>().ok())
        .collect::<Option<_>>()?;
    let [month, day, year, hour, minute, second] = parts.as_slice() else {
        return None;
    };
    Some(((((year * 100 + month) * 100 + day) * 100 + hour) * 100 + minute) * 100 + second)
}

/// The newest `backup/*_LogOutput.log` by its name's timestamp, then modified time.
pub fn newest_backup(rom: &Path) -> Result<Option<PathBuf>, String> {
    let directory = rom.join(BACKUP_DIRECTORY);
    match fs::symlink_metadata(&directory) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("could not inspect backup: {error}")),
        Ok(_) => {}
    }
    let directory = existing_directory(&directory, rom)?;
    let mut newest: Option<((Option<u64>, SystemTime), PathBuf)> = None;
    for entry in
        fs::read_dir(&directory).map_err(|error| format!("could not read backup: {error}"))?
    {
        let Ok(entry) = entry else { continue };
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.ends_with(BACKUP_SUFFIX) {
            continue;
        }
        let Ok(metadata) = fs::symlink_metadata(entry.path()) else {
            continue;
        };
        if !metadata.is_file() {
            continue;
        }
        let key = (
            backup_stamp(&name),
            metadata.modified().unwrap_or(UNIX_EPOCH),
        );
        if newest.as_ref().map_or(true, |(best, _)| key > *best) {
            newest = Some((key, entry.path()));
        }
    }
    Ok(newest.map(|(_, path)| path))
}

fn collect_logs(rom: &Path, entries: &mut Vec<ReportEntry>) -> Vec<FileRecord> {
    let mut files = vec![tail_entry(
        &rom.join(LOG_OUTPUT_FILE),
        LOG_OUTPUT_FILE.to_owned(),
        format!("logs/{LOG_OUTPUT_FILE}"),
        LOG_OUTPUT_TAIL_BYTES,
        entries,
    )];
    let backup_source = format!("{BACKUP_DIRECTORY}/*{BACKUP_SUFFIX}");
    files.push(match newest_backup(rom) {
        Ok(Some(path)) => {
            let name = path
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or_default();
            tail_entry(
                &path,
                format!("{BACKUP_DIRECTORY}/{name}"),
                format!("logs/{BACKUP_DIRECTORY}/{name}"),
                LOG_OUTPUT_TAIL_BYTES,
                entries,
            )
        }
        Ok(None) => record(backup_source, FileState::Missing, None),
        Err(problem) => record(backup_source, FileState::Unreadable, Some(problem)),
    });
    files.push(tail_entry(
        &rom.join(LOVELY_FILE),
        LOVELY_FILE.to_owned(),
        format!("logs/{LOVELY_FILE}"),
        LOVELY_TAIL_BYTES,
        entries,
    ));
    files
}

fn collect_slots(target: &ResolvedTarget, entries: &mut Vec<ReportEntry>) -> SectionRecord {
    let directory = match module_config_dir(target) {
        Ok(Some(directory)) => directory,
        Ok(None) => {
            return SectionRecord {
                requested: true,
                problem: Some("No plan slot folder.".to_owned()),
                files: Vec::new(),
            }
        }
        Err(problem) => {
            return SectionRecord {
                requested: true,
                problem: Some(problem),
                files: Vec::new(),
            }
        }
    };
    let files = (1..=PLAN_SLOT_COUNT)
        .filter_map(|slot| slot_file_name(slot).ok())
        .map(|name| {
            let path = directory.join(name);
            match regular_file(&path) {
                Ok(false) => return record(name.to_owned(), FileState::Missing, None),
                Err(problem) => {
                    return record(name.to_owned(), FileState::Unreadable, Some(problem))
                }
                Ok(true) => {}
            }
            let mut bytes = Vec::new();
            let read = fs::File::open(&path)
                .and_then(|file| file.take(MAX_PLAN_BYTES as u64 + 1).read_to_end(&mut bytes));
            match read {
                Ok(_) if bytes.len() <= MAX_PLAN_BYTES => {
                    let entry = format!("plans-in-game/{name}");
                    let size = bytes.len() as u64;
                    entries.push(ReportEntry {
                        name: entry.clone(),
                        bytes,
                    });
                    FileRecord {
                        source: name.to_owned(),
                        state: FileState::Included,
                        entry: Some(entry),
                        size_bytes: Some(size),
                        included_bytes: Some(size),
                        truncated: false,
                        problem: None,
                    }
                }
                Ok(_) => record(
                    name.to_owned(),
                    FileState::Unreadable,
                    Some("larger than a plan slot allows".to_owned()),
                ),
                Err(error) => record(
                    name.to_owned(),
                    FileState::Unreadable,
                    Some(format!("could not read: {error}")),
                ),
            }
        })
        .collect();
    SectionRecord {
        requested: true,
        problem: None,
        files,
    }
}

fn not_requested() -> SectionRecord {
    SectionRecord {
        requested: false,
        problem: None,
        files: Vec::new(),
    }
}

fn no_target(status: &GameModuleStatus) -> SectionRecord {
    SectionRecord {
        requested: true,
        problem: Some(
            status
                .target_problem
                .clone()
                .unwrap_or_else(|| "No game location is set.".to_owned()),
        ),
        files: Vec::new(),
    }
}

/// Every report entry, `report.json` first, each text redacted.
pub fn assemble(
    request: &BugReportRequest,
    status: &GameModuleStatus,
    target: Option<&ResolvedTarget>,
    redaction: &Redaction,
    created_at_ms: u64,
) -> Result<Vec<ReportEntry>, String> {
    let mut entries = Vec::new();
    let open_plan = match &request.open_plan {
        Some(json) => {
            let entry = "open-plan.runplanner.json".to_owned();
            entries.push(ReportEntry {
                name: entry.clone(),
                bytes: json.as_bytes().to_vec(),
            });
            SectionRecord {
                requested: true,
                problem: None,
                files: vec![FileRecord {
                    source: "open plan".to_owned(),
                    state: FileState::Included,
                    entry: Some(entry),
                    size_bytes: Some(json.len() as u64),
                    included_bytes: Some(json.len() as u64),
                    truncated: false,
                    problem: None,
                }],
            }
        }
        None => not_requested(),
    };
    let plan_slots = match (request.include_plan_slots, target) {
        (false, _) => not_requested(),
        (true, None) => no_target(status),
        (true, Some(target)) => collect_slots(target, &mut entries),
    };
    let logs = match (request.include_logs, target) {
        (false, _) => not_requested(),
        (true, None) => no_target(status),
        (true, Some(target)) => SectionRecord {
            requested: true,
            problem: None,
            files: collect_logs(&target.rom, &mut entries),
        },
    };
    let report = ReportDocument {
        format: REPORT_FORMAT,
        created_at_ms,
        app: &request.app_facts,
        host: HostFacts {
            os: std::env::consts::OS,
            arch: std::env::consts::ARCH,
            game_module: status,
        },
        open_plan,
        plan_slots,
        logs,
    };
    let mut json = serde_json::to_vec_pretty(&report)
        .map_err(|error| format!("could not encode the report: {error}"))?;
    json.push(b'\n');
    entries.insert(
        0,
        ReportEntry {
            name: "report.json".to_owned(),
            bytes: json,
        },
    );
    for entry in &mut entries {
        entry.bytes = redaction.apply(&entry.bytes);
    }
    Ok(entries)
}

pub fn encode_zip(entries: &[ReportEntry]) -> Result<Vec<u8>, String> {
    let mut writer = zip::ZipWriter::new(Cursor::new(Vec::new()));
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    for entry in entries {
        writer
            .start_file(entry.name.as_str(), options)
            .and_then(|()| writer.write_all(&entry.bytes).map_err(Into::into))
            .map_err(|error| format!("could not add {} to the report: {error}", entry.name))?;
    }
    writer
        .finish()
        .map(Cursor::into_inner)
        .map_err(|error| format!("could not finish the report: {error}"))
}

/// Writes the report for the remembered game target to `destination`.
pub fn create(
    config_dir: &Path,
    package: &ModulePackage,
    destination: &Path,
    request: &BugReportRequest,
    redaction: &Redaction,
) -> Result<BugReportWritten, String> {
    let file_name = destination
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.trim().is_empty())
        .ok_or("The report destination needs a file name.")?
        .to_owned();
    if !destination.is_absolute() {
        return Err("The report destination must be an absolute path.".to_owned());
    }
    let (status, target) = game_module_install::status(config_dir, package);
    let created_at_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or(0);
    let entries = assemble(request, &status, target.as_ref(), redaction, created_at_ms)?;
    let bytes = encode_zip(&entries)?;
    atomic_file::write(destination, &bytes, "bug report")?;
    Ok(BugReportWritten {
        file_name,
        entries: entries.into_iter().map(|entry| entry.name).collect(),
        issue_page_url: ISSUE_PAGE_URL,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_module_install::test_support::{package, target, write};
    use crate::game_target::test_support::TemporaryDirectory;
    use crate::game_target::{remember_target, TargetKind, CONFIG_DIRECTORY};
    use crate::plan_slots::MODULE_CONFIG_DIRECTORY;

    fn request(open_plan: Option<&str>, slots: bool, logs: bool) -> BugReportRequest {
        let mut app_facts = Map::new();
        app_facts.insert("plannerVersion".to_owned(), Value::from("1.2.3"));
        BugReportRequest {
            app_facts,
            open_plan: open_plan.map(str::to_owned),
            include_plan_slots: slots,
            include_logs: logs,
        }
    }

    fn report_json(entries: &[ReportEntry]) -> Value {
        assert_eq!(entries[0].name, "report.json");
        serde_json::from_slice(&entries[0].bytes).unwrap()
    }

    #[test]
    fn tail_is_cut_forward_to_the_next_line_start() {
        let temporary = TemporaryDirectory::new("report-tail");
        let path = temporary.0.join("log.txt");
        fs::write(&path, "first line\nsecond line\nthird\n").unwrap();
        let (bytes, size, truncated) = read_tail(&path, 14).unwrap();
        assert_eq!(size, 29);
        assert!(truncated);
        assert_eq!(bytes, b"third\n");
        let (aligned, _, _) = read_tail(&path, 18).unwrap();
        assert_eq!(aligned, b"second line\nthird\n");
        let (whole, _, truncated) = read_tail(&path, 1024).unwrap();
        assert!(!truncated);
        assert_eq!(whole, b"first line\nsecond line\nthird\n");
    }

    #[test]
    fn tail_honors_the_cap_on_a_large_sparse_file() {
        let temporary = TemporaryDirectory::new("report-sparse");
        let path = temporary.0.join("big.log");
        let file = fs::File::create(&path).unwrap();
        file.set_len(64 * 1024 * 1024).unwrap();
        drop(file);
        let mut file = fs::OpenOptions::new().append(true).open(&path).unwrap();
        file.write_all(b"\nlast session line\n").unwrap();
        let (bytes, size, truncated) = read_tail(&path, LOG_OUTPUT_TAIL_BYTES).unwrap();
        assert!(truncated);
        assert_eq!(size, 64 * 1024 * 1024 + 19);
        assert_eq!(bytes, b"last session line\n");
    }

    #[test]
    fn newest_backup_orders_by_its_timestamp_across_years() {
        let temporary = TemporaryDirectory::new("report-backup");
        let rom = temporary.0.join("ReturnOfModding");
        assert_eq!(newest_backup(&rom).unwrap(), None);
        for name in [
            "12-31-2025-23-59-59_LogOutput.log",
            "01-02-2026-08-00-00_LogOutput.log",
            "01-01-2026-09-00-00_LogOutput.log",
            "zz-not-a-log.txt",
        ] {
            write(&rom.join("backup").join(name), "x\n");
        }
        assert_eq!(
            newest_backup(&rom).unwrap().unwrap().file_name().unwrap(),
            "01-02-2026-08-00-00_LogOutput.log"
        );
    }

    #[test]
    fn redaction_replaces_every_separator_form_without_over_redacting() {
        let redaction = Redaction::for_profile(r"C:\Users\Jane Doe");
        let cases = [
            (
                r"at C:\Users\Jane Doe\AppData\x",
                r"at %USERPROFILE%\AppData\x",
            ),
            (r"c:/users/jane doe/AppData", r"%USERPROFILE%/AppData"),
            (
                r#""C:\\Users\\Jane Doe\\AppData""#,
                r#""%USERPROFILE%\\AppData""#,
            ),
            (
                "/mnt/c/Users/Jane Doe/AppData",
                "/mnt/c/Users/%USERNAME%/AppData",
            ),
            (r"D:\Users\Jane Doe", r"D:\Users\%USERNAME%"),
            (r"C:\Users\Jane Doe2\x", r"C:\Users\Jane Doe2\x"),
            ("Jane Doe said hello", "Jane Doe said hello"),
            (r"C:\Users\JANEDO~1\AppData", r"%USERPROFILE%\AppData"),
            ("/mnt/c/Users/janedo~2/x", "/mnt/c/Users/%USERNAME%/x"),
            (r"C:\Users\JANEDO~1x", r"C:\Users\JANEDO~1x"),
            (r"see C:\Users\Jane Doe.", r"see %USERPROFILE%."),
            (r"C:\Users\Jane Doe.txt", r"C:\Users\Jane Doe.txt"),
        ];
        for (input, expected) in cases {
            assert_eq!(
                String::from_utf8(redaction.apply(input.as_bytes())).unwrap(),
                expected,
                "{input}"
            );
        }
        let short = Redaction::for_profile(r"C:\Users\JANEDO~1");
        assert_eq!(short.apply(br"C:\Users\JANEDO~1\x"), br"%USERPROFILE%\x");
        let home = Redaction::for_profile("/home/player");
        assert_eq!(
            home.apply(b"/home/player/.config and /tmp/home/player"),
            b"%USERPROFILE%/.config and /tmp/home/%USERNAME%"
        );
        assert_eq!(Redaction::for_profile("/").apply(b"/x"), b"/x");
    }

    #[test]
    fn missing_sources_are_recorded_rather_than_failing() {
        let temporary = TemporaryDirectory::new("report-missing");
        let config = temporary.0.join("config");
        let target = target(&temporary.0.join("profile"), TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        let (status, resolved) = game_module_install::status(&config, &package("0.1.0", "x"));
        let entries = assemble(
            &request(None, true, true),
            &status,
            resolved.as_ref(),
            &Redaction::for_profile(""),
            1,
        )
        .unwrap();
        assert_eq!(entries.len(), 1);
        let report = report_json(&entries);
        assert_eq!(report["planSlots"]["problem"], "No plan slot folder.");
        let states: Vec<&str> = report["logs"]["files"]
            .as_array()
            .unwrap()
            .iter()
            .map(|file| file["state"].as_str().unwrap())
            .collect();
        assert_eq!(states, ["missing", "missing", "missing"]);
        assert_eq!(report["openPlan"]["requested"], false);
        assert_eq!(report["app"]["plannerVersion"], "1.2.3");

        let without_target = assemble(
            &request(None, true, true),
            &status,
            None,
            &Redaction::for_profile(""),
            1,
        )
        .unwrap();
        assert_eq!(
            report_json(&without_target)["logs"]["problem"],
            "No game location is set."
        );
    }

    #[test]
    fn written_zip_lists_every_included_entry_redacted() {
        let temporary = TemporaryDirectory::new("report-zip");
        let config = temporary.0.join("config");
        let profile = temporary.0.join("profile");
        let target = target(&profile, TargetKind::Manual);
        remember_target(&config, &target).unwrap();
        let rom = &target.rom;
        let profile_text = profile.to_string_lossy().into_owned();
        write(
            &rom.join("LogOutput.log"),
            &format!("loaded {profile_text}/plugins\n"),
        );
        write(
            &rom.join("backup").join("09-27-2026-12-22-27_LogOutput.log"),
            "previous\n",
        );
        write(&rom.join("lovely.log"), "lovely\n");
        write(
            &rom.join(CONFIG_DIRECTORY)
                .join(MODULE_CONFIG_DIRECTORY)
                .join("slot-2.runplanner.json"),
            "{}",
        );
        let destination = temporary.0.join("out").join("report.zip");
        fs::create_dir_all(destination.parent().unwrap()).unwrap();
        let written = create(
            &config,
            &package("0.1.0", "x"),
            &destination,
            &request(Some(&format!(r#"{{"note":"{profile_text}"}}"#)), true, true),
            &Redaction::for_profile(&profile_text),
        )
        .unwrap();
        let expected = [
            "report.json",
            "open-plan.runplanner.json",
            "plans-in-game/slot-2.runplanner.json",
            "logs/LogOutput.log",
            "logs/backup/09-27-2026-12-22-27_LogOutput.log",
            "logs/lovely.log",
        ];
        assert_eq!(written.entries, expected);
        assert_eq!(written.file_name, "report.zip");
        assert_eq!(written.issue_page_url, ISSUE_PAGE_URL);

        let mut archive = zip::ZipArchive::new(fs::File::open(&destination).unwrap()).unwrap();
        let names: Vec<String> = archive.file_names().map(str::to_owned).collect();
        assert_eq!(names, expected);
        for name in &names {
            let mut text = String::new();
            archive
                .by_name(name)
                .unwrap()
                .read_to_string(&mut text)
                .unwrap();
            assert!(!text.contains(&profile_text), "{name}");
        }
        let stamped = archive.by_name("report.json").unwrap().last_modified();
        assert!(stamped.unwrap().year() > 1980);
        let mut log = String::new();
        archive
            .by_name("logs/LogOutput.log")
            .unwrap()
            .read_to_string(&mut log)
            .unwrap();
        assert_eq!(log, "loaded %USERPROFILE%/plugins\n");
    }
}
