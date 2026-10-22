//! The window close gate: Tauri glue over the host's `CloseGate`.

use std::time::Duration;

use tauri::async_runtime::channel;
use tauri::{CloseRequestApi, Manager, State, Window};

use run_planner_game_host::close_gate::CloseGate;

/// A planner that never answers cannot keep the window open longer than this.
const CLOSE_TIMEOUT: Duration = Duration::from_secs(5);

/// Holds a close request while the planner waits for one; otherwise lets it through.
pub(crate) fn intercept(window: &Window, api: &CloseRequestApi) {
    let gate = window.state::<CloseGate>();
    let Some(held) = gate.intercept() else {
        return;
    };
    api.prevent_close();
    let window = window.clone();
    std::thread::spawn(move || {
        std::thread::sleep(CLOSE_TIMEOUT);
        if window.state::<CloseGate>().timed_out(held) {
            let _ = window.destroy();
        }
    });
}

/// Resolves when the user asks to close the window.
#[tauri::command]
pub(crate) async fn app_close_requested(gate: State<'_, CloseGate>) -> Result<(), String> {
    let (sender, mut receiver) = channel(1);
    gate.wait(Box::new(move || sender.try_send(()).is_ok()));
    receiver.recv().await;
    Ok(())
}

/// Closes the window once the planner has written what it had pending.
#[tauri::command]
pub(crate) fn app_close_ready(window: Window) -> Result<(), String> {
    window
        .destroy()
        .map_err(|error| format!("Could not close the window: {error}"))
}

/// The planner keeps the window open while it asks the user; the held close ends.
#[tauri::command]
pub(crate) fn app_close_kept(gate: State<'_, CloseGate>) {
    gate.keep_open();
}
