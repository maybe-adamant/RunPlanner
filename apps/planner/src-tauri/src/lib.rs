mod atomic_file;
mod game_plan_publication;
mod profile_file_session;
mod release_updates;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            game_plan_publication::game_plan_discover_profiles,
            game_plan_publication::game_plan_choose_profile,
            game_plan_publication::game_plan_publish,
            profile_file_session::profile_file_restore_active,
            profile_file_session::profile_file_activate,
            profile_file_session::profile_file_clear_active,
            profile_file_session::profile_file_write_active,
            release_updates::release_check_latest,
            release_updates::release_open_download
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("failed to run Run Planner");
}
