mod game_module_commands;
mod profile_file_session;
mod release_updates;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            game_module_commands::game_target_discover,
            game_module_commands::game_target_use_discovered,
            game_module_commands::game_target_choose,
            game_module_commands::game_target_clear,
            game_module_commands::game_target_validate,
            game_module_commands::game_module_status,
            game_module_commands::game_module_install,
            game_module_commands::game_module_install_from_checkout,
            game_module_commands::game_module_remove,
            game_module_commands::game_plan_publish,
            profile_file_session::profile_file_restore_active,
            profile_file_session::profile_file_activate,
            profile_file_session::profile_file_clear_active,
            profile_file_session::profile_file_write_active,
            release_updates::release_check_latest,
            release_updates::external_open_url
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("failed to run Run Planner");
}
