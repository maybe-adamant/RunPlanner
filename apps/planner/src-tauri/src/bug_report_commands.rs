use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::State;
use tauri_plugin_dialog::DialogExt;

use run_planner_game_host::bug_report::{self, BugReportRequest, BugReportWritten, Redaction};
use run_planner_game_host::game_module_package::ModulePackage;

use crate::game_module_commands::config_dir;

/// The report this session last wrote, the only path the reveal command opens.
#[derive(Default)]
pub struct LastBugReport(Mutex<Option<PathBuf>>);

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub(crate) enum BugReportCreation {
    Cancelled,
    Saved(BugReportWritten),
}

/// Asks where to save the report, then writes it there.
#[tauri::command(async)]
pub(crate) fn bug_report_create(
    app: tauri::AppHandle,
    last: State<'_, LastBugReport>,
    default_file_name: String,
    request: BugReportRequest,
) -> Result<BugReportCreation, String> {
    // Runs off the main thread, so the blocking save dialog is safe here.
    let Some(chosen) = app
        .dialog()
        .file()
        .set_title("Save Bug Report")
        .set_file_name(default_file_name)
        .add_filter("Bug report", &["zip"])
        .blocking_save_file()
    else {
        return Ok(BugReportCreation::Cancelled);
    };
    let destination = chosen
        .into_path()
        .map_err(|error| format!("The chosen location is not a file path: {error}"))?;
    let written = bug_report::create(
        &config_dir(&app)?,
        ModulePackage::bundled(),
        &destination,
        &request,
        &Redaction::from_environment(),
    )?;
    *last.0.lock().map_err(|_| "Report state is unavailable.")? = Some(destination);
    Ok(BugReportCreation::Saved(written))
}

/// Shows the last written report in the system file manager.
#[tauri::command]
pub(crate) fn bug_report_reveal(last: State<'_, LastBugReport>) -> Result<(), String> {
    let path = last
        .0
        .lock()
        .map_err(|_| "Report state is unavailable.")?
        .clone()
        .ok_or("No report has been saved yet.")?;
    if !path.is_file() {
        return Err("The saved report is no longer there.".to_owned());
    }
    reveal(&path)
}

#[cfg(target_os = "windows")]
fn reveal(path: &Path) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    // Explorer parses its own command line and needs the quoted path after the comma.
    std::process::Command::new("explorer")
        .raw_arg(format!("/select,\"{}\"", path.display()))
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not open the folder: {error}"))
}

#[cfg(not(target_os = "windows"))]
fn reveal(path: &Path) -> Result<(), String> {
    let folder = path.parent().ok_or("The report has no folder.")?;
    let opener = if cfg!(target_os = "macos") {
        "open"
    } else {
        "xdg-open"
    };
    std::process::Command::new(opener)
        .arg(folder)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not open the folder: {error}"))
}
