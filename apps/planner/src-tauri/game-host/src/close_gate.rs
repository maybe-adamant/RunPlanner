//! Holds a window close while the planner writes pending edits. A close request is held only
//! while the planner waits for one; a held close ends when the planner is ready, when it keeps
//! the window open (to ask the user), or after a timeout if it never answers.

use std::sync::Mutex;

/// Tells the waiting planner that the user asked to close; false when nobody received it.
pub type CloseNotice = Box<dyn FnOnce() -> bool + Send>;

#[derive(Default)]
struct GateState {
    waiter: Option<CloseNotice>,
    /// The close being held, numbered so a stale timeout cannot end a later one.
    held: Option<u64>,
    sequence: u64,
}

#[derive(Default)]
pub struct CloseGate(Mutex<GateState>);

impl CloseGate {
    /// Registers the planner as waiting for the next close request.
    pub fn wait(&self, notice: CloseNotice) {
        if let Ok(mut state) = self.0.lock() {
            state.waiter = Some(notice);
        }
    }

    /// Decides a close request: the number of the held close to time out, or None to let the
    /// window close now.
    pub fn intercept(&self) -> Option<u64> {
        let mut state = self.0.lock().ok()?;
        if state.held.is_some() {
            return None;
        }
        let waiter = state.waiter.take()?;
        if !waiter() {
            return None;
        }
        state.sequence += 1;
        state.held = Some(state.sequence);
        state.held
    }

    /// The planner keeps the window open; a later close request is held afresh.
    pub fn keep_open(&self) {
        if let Ok(mut state) = self.0.lock() {
            state.held = None;
        }
    }

    /// Whether the held close `held` is still unanswered when its timeout ends.
    pub fn timed_out(&self, held: u64) -> bool {
        self.0.lock().is_ok_and(|state| state.held == Some(held))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    fn notice(count: &Arc<AtomicUsize>, delivered: bool) -> CloseNotice {
        let count = Arc::clone(count);
        Box::new(move || {
            count.fetch_add(1, Ordering::SeqCst);
            delivered
        })
    }

    #[test]
    fn holds_a_close_only_while_the_planner_waits_for_one() {
        let gate = CloseGate::default();
        assert_eq!(gate.intercept(), None);
        let count = Arc::new(AtomicUsize::new(0));
        gate.wait(notice(&count, false));
        assert_eq!(gate.intercept(), None);
        gate.wait(notice(&count, true));
        let held = gate.intercept().expect("held close");
        assert_eq!(count.load(Ordering::SeqCst), 2);
        // A second request while one is held closes at once.
        assert_eq!(gate.intercept(), None);
        assert!(gate.timed_out(held));
    }

    #[test]
    fn keeping_the_window_open_disarms_the_timeout_and_rearms_the_gate() {
        let gate = CloseGate::default();
        let count = Arc::new(AtomicUsize::new(0));
        gate.wait(notice(&count, true));
        let first = gate.intercept().expect("held close");
        gate.keep_open();
        assert!(!gate.timed_out(first));
        gate.wait(notice(&count, true));
        let second = gate.intercept().expect("held again");
        assert_ne!(first, second);
        assert!(!gate.timed_out(first));
        assert!(gate.timed_out(second));
    }
}
