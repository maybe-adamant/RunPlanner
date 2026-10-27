use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use tauri::ipc::{Channel, Response};
use tauri::{Manager, State};

use run_planner_game_host::run_recording::{self, SaveFolderWatch};

const POLL_INTERVAL: Duration = Duration::from_millis(250);
const RECENT_RUNS_DIRECTORY: &str = "recent-runs";

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
