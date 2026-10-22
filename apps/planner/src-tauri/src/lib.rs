use tauri::Manager;

mod bug_report_commands;
mod close_gate;
mod community_events;
mod game_module_commands;
mod project_library_commands;
mod release_updates;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Registered first: a second launch hands over to the running window and exits,
        // so one process writes the project library.
        .plugin(tauri_plugin_single_instance::init(
            |app, _arguments, _directory| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            },
        ))
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
            game_module_commands::game_plan_rebuild,
            game_module_commands::game_slot_source_read,
            game_module_commands::game_active_slot_set,
            community_events::event_feed_refresh,
            community_events::event_project_download,
            community_events::game_event_publish,
            community_events::game_event_clear,
            #[cfg(any(debug_assertions, internal_features))]
            community_events::game_event_folder_load,
            #[cfg(any(debug_assertions, internal_features))]
            community_events::game_event_local_clear,
            bug_report_commands::bug_report_create,
            bug_report_commands::bug_report_reveal,
            project_library_commands::project_library_list,
            project_library_commands::project_library_read,
            project_library_commands::project_library_create,
            project_library_commands::project_library_write,
            project_library_commands::project_library_delete,
            project_library_commands::project_library_preserve_original,
            project_library_commands::project_library_reveal,
            project_library_commands::project_library_previous_active,
            project_library_commands::project_library_session_read,
            project_library_commands::project_library_session_write,
            close_gate::app_close_requested,
            close_gate::app_close_ready,
            close_gate::app_close_kept,
            release_updates::release_update_check,
            release_updates::release_update_install,
            release_updates::external_open_url
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(release_updates::PendingUpdate::default())
        .manage(bug_report_commands::LastBugReport::default())
        .manage(community_events::CommunityEvents::default())
        .manage(project_library_commands::ProjectLibraryLock::default())
        .manage(run_planner_game_host::close_gate::CloseGate::default())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                close_gate::intercept(window, api);
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to run Run Planner");
}
