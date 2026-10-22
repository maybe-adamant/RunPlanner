use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{Manager, State};

use run_planner_game_host::library_session::{self, LibrarySession, PreviousFile};
use run_planner_game_host::project_library::{self, LibraryEntry, LibraryListing, NativeRecycler};

use crate::game_module_commands::config_dir;

/// Serializes library file changes, so a rename never races a write of the same plan.
#[derive(Default)]
pub struct ProjectLibraryLock(Mutex<()>);

fn library_folder(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .document_dir()
        .map(|documents| documents.join("RunPlanner").join("Projects"))
        .map_err(|error| format!("Could not resolve the documents folder: {error}"))
}

fn locked<T>(
    lock: &State<'_, ProjectLibraryLock>,
    operation: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    let _guard = lock
        .0
        .lock()
        .map_err(|_| "The library is unavailable.".to_owned())?;
    operation()
}

#[tauri::command(async)]
pub(crate) fn project_library_list(
    app: tauri::AppHandle,
    lock: State<'_, ProjectLibraryLock>,
) -> Result<LibraryListing, String> {
    let folder = library_folder(&app)?;
    locked(&lock, || project_library::scan(&folder))
}

#[tauri::command(async)]
pub(crate) fn project_library_read(app: tauri::AppHandle, key: String) -> Result<String, String> {
    project_library::read(&library_folder(&app)?, &key)
}

#[tauri::command(async)]
pub(crate) fn project_library_read_bytes(
    app: tauri::AppHandle,
    key: String,
) -> Result<Vec<u8>, String> {
    project_library::read_bytes(&library_folder(&app)?, &key)
}

/// Puts a deleted file back at its key, byte for byte.
#[tauri::command(async)]
pub(crate) fn project_library_restore(
    app: tauri::AppHandle,
    lock: State<'_, ProjectLibraryLock>,
    key: String,
    bytes: Vec<u8>,
) -> Result<LibraryEntry, String> {
    let root = library_folder(&app)?;
    locked(&lock, || project_library::restore(&root, &key, &bytes))
}

#[tauri::command(async)]
pub(crate) fn project_library_create(
    app: tauri::AppHandle,
    lock: State<'_, ProjectLibraryLock>,
    json: String,
    folder: String,
) -> Result<LibraryEntry, String> {
    let root = library_folder(&app)?;
    locked(&lock, || project_library::create(&root, &json, &folder))
}

#[tauri::command(async)]
pub(crate) fn project_library_move(
    app: tauri::AppHandle,
    lock: State<'_, ProjectLibraryLock>,
    key: String,
    folder: String,
) -> Result<LibraryEntry, String> {
    let root = library_folder(&app)?;
    locked(&lock, || project_library::move_plan(&root, &key, &folder))
}

#[tauri::command(async)]
pub(crate) fn project_library_folder_create(
    app: tauri::AppHandle,
    lock: State<'_, ProjectLibraryLock>,
    folder: String,
) -> Result<(), String> {
    let root = library_folder(&app)?;
    locked(&lock, || project_library::create_folder(&root, &folder))
}

#[tauri::command(async)]
pub(crate) fn project_library_folder_move(
    app: tauri::AppHandle,
    lock: State<'_, ProjectLibraryLock>,
    from: String,
    to: String,
) -> Result<(), String> {
    let root = library_folder(&app)?;
    locked(&lock, || project_library::move_folder(&root, &from, &to))
}

#[tauri::command(async)]
pub(crate) fn project_library_folder_delete(
    app: tauri::AppHandle,
    lock: State<'_, ProjectLibraryLock>,
    folder: String,
) -> Result<(), String> {
    let root = library_folder(&app)?;
    locked(&lock, || {
        project_library::delete_folder(&root, &folder, &mut NativeRecycler)
    })
}

#[tauri::command(async)]
pub(crate) fn project_library_write(
    app: tauri::AppHandle,
    lock: State<'_, ProjectLibraryLock>,
    key: String,
    json: String,
) -> Result<LibraryEntry, String> {
    let folder = library_folder(&app)?;
    locked(&lock, || project_library::write(&folder, &key, &json))
}

#[tauri::command(async)]
pub(crate) fn project_library_delete(
    app: tauri::AppHandle,
    lock: State<'_, ProjectLibraryLock>,
    key: String,
) -> Result<(), String> {
    let folder = library_folder(&app)?;
    locked(&lock, || {
        project_library::delete(&folder, &key, &mut NativeRecycler)
    })
}

/// Recycles a copy of a plan as it is now, before the planner first rewrites an older schema.
#[tauri::command(async)]
pub(crate) fn project_library_preserve_original(
    app: tauri::AppHandle,
    lock: State<'_, ProjectLibraryLock>,
    key: String,
) -> Result<(), String> {
    let folder = library_folder(&app)?;
    locked(&lock, || {
        project_library::preserve_original(&folder, &key, &mut NativeRecycler)
    })
}

/// Shows the library folder in the system file manager.
#[tauri::command]
pub(crate) fn project_library_reveal(app: tauri::AppHandle) -> Result<(), String> {
    let folder = library_folder(&app)?;
    project_library::ensure_folder(&folder)?;
    reveal_folder(&folder)
}

#[tauri::command]
pub(crate) fn project_library_session_read(
    app: tauri::AppHandle,
) -> Result<LibrarySession, String> {
    Ok(library_session::read(&config_dir(&app)?))
}

#[tauri::command]
pub(crate) fn project_library_session_write(
    app: tauri::AppHandle,
    session: LibrarySession,
) -> Result<(), String> {
    library_session::write(&config_dir(&app)?, &session)
}

/// The file the planner last had open before the library.
#[tauri::command(async)]
pub(crate) fn project_library_previous_active(
    app: tauri::AppHandle,
) -> Result<Option<PreviousFile>, String> {
    library_session::previous_active_file(&config_dir(&app)?)
}

#[cfg(target_os = "windows")]
fn reveal_folder(folder: &std::path::Path) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(folder)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not open the folder: {error}"))
}

#[cfg(not(target_os = "windows"))]
fn reveal_folder(folder: &std::path::Path) -> Result<(), String> {
    run_planner_game_host::system_opener::open(folder.as_os_str())
        .map_err(|error| format!("Could not open the folder: {error}"))
}
