//! The window close gate: Tauri glue over the host's `CloseGate`.

use std::time::Duration;

use tauri::async_runtime::channel;
use tauri::{CloseRequestApi, Manager, State, Window};

use run_planner_game_host::close_gate::{CloseDecision, CloseGate};

/// A planner that never takes up a close request cannot keep the window open longer than this.
const ANSWER_TIMEOUT: Duration = Duration::from_secs(5);
/// Once the planner writes, it has this long; keeping an older original and recycling it can
/// take seconds on a slow disk or recycle bin.
const WRITE_TIMEOUT: Duration = Duration::from_secs(60);

fn close_after(window: Window, held: u64, timeout: Duration) {
    std::thread::spawn(move || {
        std::thread::sleep(timeout);
        if window.state::<CloseGate>().timed_out(held) {
            let _ = window.destroy();
        }
    });
}

/// Holds a close request while the planner waits for one; otherwise lets it through.
pub(crate) fn intercept(window: &Window, api: &CloseRequestApi) {
    match window.state::<CloseGate>().intercept() {
        CloseDecision::Close => {}
        CloseDecision::AlreadyHeld => api.prevent_close(),
        CloseDecision::Hold { held } => {
            api.prevent_close();
            close_after(window.clone(), held, ANSWER_TIMEOUT);
        }
    }
}

/// Resolves when the user asks to close the window.
#[tauri::command]
pub(crate) async fn app_close_requested(gate: State<'_, CloseGate>) -> Result<(), String> {
    let (sender, mut receiver) = channel(1);
    gate.wait(Box::new(move || sender.try_send(()).is_ok()));
    receiver.recv().await;
    Ok(())
}

/// The planner took up the held close and is writing its pending edits.
#[tauri::command]
pub(crate) fn app_close_acknowledged(window: Window, gate: State<'_, CloseGate>) {
    if let Some(held) = gate.acknowledge() {
        close_after(window, held, WRITE_TIMEOUT);
    }
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
