use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};

/// The update found by the last check, held until the user confirms installing it.
#[derive(Default)]
pub struct PendingUpdate(Mutex<Option<Update>>);

#[derive(Serialize)]
pub struct AvailableUpdate {
    pub version: String,
}

/// Checks the signed updater manifest; `None` means this build is current.
#[tauri::command]
pub async fn release_update_check(
    app: AppHandle,
    pending: State<'_, PendingUpdate>,
) -> Result<Option<AvailableUpdate>, String> {
    let update = app
        .updater()
        .map_err(|error| format!("Could not prepare the updater: {error}"))?
        .check()
        .await
        .map_err(|error| format!("Could not check for updates: {error}"))?;
    let available = update.as_ref().map(|update| AvailableUpdate {
        version: update.version.clone(),
    });
    *pending
        .0
        .lock()
        .map_err(|_| "Update state is unavailable.")? = update;
    Ok(available)
}

/// Downloads, verifies and installs the confirmed update, then restarts; on
/// Windows the installer closes the planner and reopens it when done. Returns
/// only when the confirmed version is no longer the pending one, naming the
/// update pending now.
#[tauri::command]
pub async fn release_update_install(
    app: AppHandle,
    pending: State<'_, PendingUpdate>,
    version: String,
) -> Result<Option<AvailableUpdate>, String> {
    let update = {
        let pending = pending
            .0
            .lock()
            .map_err(|_| "Update state is unavailable.")?;
        match pending.as_ref() {
            Some(update) if update.version == version => update.clone(),
            other => {
                return Ok(other.map(|update| AvailableUpdate {
                    version: update.version.clone(),
                }))
            }
        }
    };
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|error| format!("Could not install the update: {error}"))?;
    app.restart()
}

/// Opens an allowlisted page (ModpackLib's store page) in the browser.
#[tauri::command]
pub fn external_open_url(url: String) -> Result<(), String> {
    run_planner_game_host::external_url::validate_external_url(&url)?;
    open_in_browser(&url)
}

#[cfg(target_os = "windows")]
fn open_in_browser(url: &str) -> Result<(), String> {
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    let operation = wide("open");
    let target = wide(url);
    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            operation.as_ptr(),
            target.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            SW_SHOWNORMAL,
        )
    };
    if (result as isize) <= 32 {
        return Err("Could not open the link in the default browser.".into());
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn open_in_browser(_url: &str) -> Result<(), String> {
    Err("Opening links is available only in the Windows desktop application.".into())
}

#[cfg(target_os = "windows")]
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}
