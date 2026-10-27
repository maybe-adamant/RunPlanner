use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use tauri::ipc::{Channel, Response};
#[cfg(any(debug_assertions, internal_features))]
use tauri::ipc::{InvokeBody, Request};
use tauri::{Manager, State};

use run_planner_game_host::run_recording::{self, SaveFolderWatch};

const POLL_INTERVAL: Duration = Duration::from_millis(250);
const RECENT_RUNS_DIRECTORY: &str = "recent-runs";
#[cfg(any(debug_assertions, internal_features))]
const RAW_SAVES_DIRECTORY: &str = "raw";

/// The save folder being watched and the flag that stops its poller.
#[derive(Default)]
pub struct SaveWatch(Mutex<Option<ActiveWatch>>);

struct ActiveWatch {
    folder: PathBuf,
    stop: Arc<AtomicBool>,
    poller: thread::JoinHandle<()>,
}

impl ActiveWatch {
    /// Stops the poller and waits for it, so no save of this watch is sent afterwards.
    fn halt(self) {
        self.stop.store(true, Ordering::Relaxed);
        let _ = self.poller.join();
    }
}

fn watch_folder(watch: &State<'_, SaveWatch>) -> Result<PathBuf, String> {
    watch
        .0
        .lock()
        .map_err(|_| "The save watch is unavailable.".to_owned())?
        .as_ref()
        .map(|active| active.folder.clone())
        .ok_or_else(|| "Recording is off.".to_owned())
}

fn recent_runs_folder(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(RECENT_RUNS_DIRECTORY))
        .map_err(|error| format!("could not resolve application data directory: {error}"))
}

/// Each changed save is read as soon as its change is seen and sent as one raw framed message.
fn poll(folder: &Path, stop: &AtomicBool, channel: &Channel<Response>) {
    let mut watch = SaveFolderWatch::default();
    while !stop.load(Ordering::Relaxed) {
        // An unreadable folder is retried on the next poll; the game may be recreating it.
        for (file_name, bytes) in watch.read_changes(folder).unwrap_or_default() {
            if stop.load(Ordering::Relaxed) {
                return;
            }
            let message = run_recording::frame_save(&file_name, &bytes);
            if channel.send(Response::new(message)).is_err() {
                return;
            }
        }
        thread::sleep(POLL_INTERVAL);
    }
}

/// The Hades II save folder found on this computer, if any.
#[tauri::command(async)]
pub(crate) fn record_save_folder_discover() -> Option<String> {
    run_recording::discover_save_folder(&run_recording::save_folder_candidates())
        .map(|folder| folder.to_string_lossy().into_owned())
}

/// Watches `folder`, or the discovered save folder, and sends each changed profile save,
/// starting with the saves already there. Replaces an earlier watch.
#[tauri::command(async)]
pub(crate) fn record_watch_start(
    watch: State<'_, SaveWatch>,
    folder: Option<String>,
    on_save: Channel<Response>,
) -> Result<String, String> {
    let folder = match folder {
        Some(folder) => run_recording::resolve_save_folder(Path::new(&folder))?,
        None => run_recording::discover_save_folder(&run_recording::save_folder_candidates())
            .ok_or_else(|| "No Hades II save folder was found. Choose it instead.".to_owned())?,
    };
    let mut active = watch
        .0
        .lock()
        .map_err(|_| "The save watch is unavailable.".to_owned())?;
    if let Some(previous) = active.take() {
        previous.halt();
    }
    let stop = Arc::new(AtomicBool::new(false));
    let polled = folder.clone();
    let flag = stop.clone();
    let poller = thread::Builder::new()
        .name("save-watch".to_owned())
        .spawn(move || poll(&polled, &flag, &on_save))
        .map_err(|error| format!("Could not start watching the save folder: {error}"))?;
    *active = Some(ActiveWatch {
        folder: folder.clone(),
        stop,
        poller,
    });
    Ok(folder.to_string_lossy().into_owned())
}

#[tauri::command(async)]
pub(crate) fn record_watch_stop(watch: State<'_, SaveWatch>) -> Result<(), String> {
    let previous = watch
        .0
        .lock()
        .map_err(|_| "The save watch is unavailable.".to_owned())?
        .take();
    if let Some(previous) = previous {
        previous.halt();
    }
    Ok(())
}

/// Reads a profile save of the watched folder again, as raw bytes.
#[tauri::command(async)]
pub(crate) fn record_save_read(
    watch: State<'_, SaveWatch>,
    file_name: String,
) -> Result<Response, String> {
    let folder = watch_folder(&watch)?;
    run_recording::read_save(&folder, &file_name).map(Response::new)
}

#[tauri::command(async)]
pub(crate) fn recent_runs_list(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    run_recording::list_recent_runs(&recent_runs_folder(&app)?)
}

#[tauri::command(async)]
pub(crate) fn recent_runs_read(app: tauri::AppHandle, id: String) -> Result<String, String> {
    run_recording::read_recent_run(&recent_runs_folder(&app)?, &id)
}

#[tauri::command(async)]
pub(crate) fn recent_runs_write(
    app: tauri::AppHandle,
    id: String,
    json: String,
) -> Result<(), String> {
    run_recording::write_recent_run(&recent_runs_folder(&app)?, &id, &json)
}

#[tauri::command(async)]
pub(crate) fn recent_runs_delete(app: tauri::AppHandle, id: String) -> Result<(), String> {
    run_recording::delete_recent_run(&recent_runs_folder(&app)?, &id)
}

// Raw saves kept beside each recorded run; development builds only.

#[cfg(any(debug_assertions, internal_features))]
fn raw_saves_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(recent_runs_folder(app)?.join(RAW_SAVES_DIRECTORY))
}

#[cfg(any(debug_assertions, internal_features))]
#[tauri::command(async)]
pub(crate) fn raw_saves_folders(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    run_recording::list_raw_save_folders(&raw_saves_root(&app)?)
}

#[cfg(any(debug_assertions, internal_features))]
#[tauri::command(async)]
pub(crate) fn raw_saves_list(app: tauri::AppHandle, folder: String) -> Result<Vec<String>, String> {
    run_recording::list_raw_saves(&raw_saves_root(&app)?, &folder)
}

#[cfg(any(debug_assertions, internal_features))]
#[tauri::command(async)]
pub(crate) fn raw_saves_read(
    app: tauri::AppHandle,
    folder: String,
    name: String,
) -> Result<Response, String> {
    run_recording::read_raw_save(&raw_saves_root(&app)?, &folder, &name).map(Response::new)
}

/// Writes the raw request body to `folder`/`name`, both given as request headers.
#[cfg(any(debug_assertions, internal_features))]
#[tauri::command(async)]
pub(crate) fn raw_saves_write(app: tauri::AppHandle, request: Request<'_>) -> Result<(), String> {
    let header = |key: &str| {
        request
            .headers()
            .get(key)
            .and_then(|value| value.to_str().ok())
            .map(str::to_owned)
            .ok_or_else(|| format!("The raw save has no {key}."))
    };
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("The raw save is not binary.".to_owned());
    };
    run_recording::write_raw_save(
        &raw_saves_root(&app)?,
        &header("x-raw-folder")?,
        &header("x-raw-name")?,
        bytes,
    )
}

#[cfg(any(debug_assertions, internal_features))]
#[tauri::command(async)]
pub(crate) fn raw_saves_move(
    app: tauri::AppHandle,
    from: String,
    to: String,
) -> Result<(), String> {
    run_recording::move_raw_save_folder(&raw_saves_root(&app)?, &from, &to)
}

#[cfg(any(debug_assertions, internal_features))]
#[tauri::command(async)]
pub(crate) fn raw_saves_delete(app: tauri::AppHandle, folder: String) -> Result<(), String> {
    run_recording::delete_raw_save_folder(&raw_saves_root(&app)?, &folder)
}
