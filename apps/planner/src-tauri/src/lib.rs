mod atomic_file;
mod game_plan_publication;
mod profile_file_session;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            game_plan_publication::game_plan_discover_profiles,
            game_plan_publication::game_plan_publish,
            profile_file_session::profile_file_restore_active,
            profile_file_session::profile_file_activate,
            profile_file_session::profile_file_clear_active,
            profile_file_session::profile_file_write_active
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("failed to run Run Planner");
}
