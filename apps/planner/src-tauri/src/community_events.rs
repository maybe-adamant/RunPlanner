use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use run_planner_game_host::community_event::{instant_from_unix, EventPlan, Instant};
use run_planner_game_host::event_feed::{
    self, project_url, EventSession, FeedSource, VerifiedFeed, EVENT_FEED_SIGNATURE_URL,
    EVENT_FEED_URL, MAX_EVENT_PROJECT_BYTES, MAX_FEED_BYTES, MAX_FEED_SIGNATURE_BYTES,
};
use run_planner_game_host::game_module_package::ModulePackage;
use run_planner_game_host::game_plan_publication::{self, EventSlotClearing, GamePlanPublication};
use run_planner_game_host::slot_overview::{SlotEvent, SlotSummary};

use crate::game_module_commands::config_dir;

const CACHE_DIRECTORY: &str = "event-feed";
const FETCH_TIMEOUT: Duration = Duration::from_secs(20);

/// The verified community events of this session.
#[derive(Default)]
pub struct CommunityEvents(Mutex<EventSession>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventFeedSnapshot {
    /// The active event with its plan for this app's module build.
    active: Option<EventPlan>,
    source: FeedSource,
    /// Why the last fetch failed, when it did.
    problem: Option<String>,
}

fn now() -> Instant {
    let elapsed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    instant_from_unix(elapsed.as_secs(), elapsed.subsec_nanos())
}

fn session<'a>(
    events: &'a State<'_, CommunityEvents>,
) -> Result<std::sync::MutexGuard<'a, EventSession>, String> {
    events
        .0
        .lock()
        .map_err(|_| "Community event state is unavailable.".to_owned())
}

/// The event feed's own public key, checked in beside the app; not the updater's.
const EVENT_PUBLIC_KEY: &str = include_str!("../event-feed.pub");

fn public_key() -> Result<&'static str, String> {
    event_feed::event_public_key(EVENT_PUBLIC_KEY).inspect_err(|problem| {
        eprintln!("[RunPlanner] community events: {problem}");
    })
}

fn cache_directory(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(CACHE_DIRECTORY))
        .map_err(|error| format!("could not resolve application data directory: {error}"))
}

fn cached_feed(app: &AppHandle, key: &str, build_id: &str) -> Option<VerifiedFeed> {
    cache_directory(app)
        .ok()
        .and_then(|directory| event_feed::read_cached_feed(&directory, key, build_id).ok())
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .https_only(true)
        .timeout(FETCH_TIMEOUT)
        .build()
        .map_err(|error| format!("Could not prepare the event feed download: {error}"))
}

async fn download(client: &reqwest::Client, url: &str, limit: usize) -> Result<Vec<u8>, String> {
    let mut response = client
        .get(url)
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|error| format!("Could not download {url}: {error}"))?;
    if response
        .content_length()
        .is_some_and(|length| length > limit as u64)
    {
        return Err(format!("{url} exceeds the {limit}-byte limit."));
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("Could not download {url}: {error}"))?
    {
        bytes.extend_from_slice(&chunk);
        if bytes.len() > limit {
            return Err(format!("{url} exceeds the {limit}-byte limit."));
        }
    }
    Ok(bytes)
}

/// Fetches, verifies and decodes the feed, refusing one signed before the newest feed already
/// verified, then keeps it for offline starts.
async fn fetch_feed(
    app: &AppHandle,
    key: &str,
    build_id: &str,
    not_before: Option<u64>,
) -> Result<VerifiedFeed, String> {
    let client = client()?;
    let feed = download(&client, EVENT_FEED_URL, MAX_FEED_BYTES).await?;
    let signature = download(&client, EVENT_FEED_SIGNATURE_URL, MAX_FEED_SIGNATURE_BYTES).await?;
    let verified = event_feed::verify_feed(&feed, &signature, key, build_id, not_before)?;
    // A feed that cannot be cached is still used for this session.
    if let Ok(directory) = cache_directory(app) {
        let _ = event_feed::cache_feed(&directory, &feed, &signature);
    }
    Ok(verified)
}

/// Fetches the feed unless it was read within the refresh interval, or at once after a failed
/// fetch when `retry_failed`; offline, the last verified feed stands. Returns the active event
/// for this app's module build.
#[tauri::command]
pub async fn event_feed_refresh(
    app: AppHandle,
    events: State<'_, CommunityEvents>,
    retry_failed: bool,
) -> Result<EventFeedSnapshot, String> {
    let started = std::time::Instant::now();
    let build_id = ModulePackage::bundled().build_id.clone();
    let mut problem = None;
    let (fetch, held) = {
        let session = session(&events)?;
        (
            session.needs_fetch(started, retry_failed),
            session.signed_at(),
        )
    };
    if fetch {
        let Ok(key) = public_key() else {
            session(&events)?.disable();
            return Ok(EventFeedSnapshot {
                active: None,
                source: FeedSource::Disabled,
                problem: None,
            });
        };
        let not_before =
            held.or_else(|| cached_feed(&app, key, &build_id).map(|cached| cached.signed_at));
        match fetch_feed(&app, key, &build_id, not_before).await {
            Ok(verified) => session(&events)?.accept_fetched(verified, started),
            Err(message) => {
                let cached = cached_feed(&app, key, &build_id);
                session(&events)?.fetch_failed(|| cached, started);
                problem = Some(message);
            }
        }
    }
    let session = session(&events)?;
    for refused in session.refused() {
        eprintln!("[RunPlanner] community event refused: {refused}");
    }
    Ok(EventFeedSnapshot {
        active: session.active(now()).cloned(),
        source: session.source(),
        problem,
    })
}

/// Writes the active verified event to the event slot. The caller names the event and the plan
/// its summary describes, and supplies only that display summary; the plan and the event
/// metadata written are the host's own.
#[tauri::command]
pub fn game_event_publish(
    app: AppHandle,
    events: State<'_, CommunityEvents>,
    event_id: String,
    plan_fingerprint: String,
    summary: SlotSummary,
) -> Result<GamePlanPublication, String> {
    let plan = session(&events)?
        .active_named(&event_id, &plan_fingerprint, now())?
        .clone();
    Ok(game_plan_publication::publish_event(
        &config_dir(&app)?,
        ModulePackage::bundled(),
        &plan.plan_json,
        summary,
        SlotEvent {
            id: plan.event.id,
            title: plan.event.title,
            ends_at: plan.event.ends_at,
        },
    ))
}

/// Clears the event slot. Without verified event data, as an offline start may have, only an
/// event slot whose own event ended is cleared.
#[tauri::command]
pub fn game_event_clear(
    app: AppHandle,
    events: State<'_, CommunityEvents>,
) -> Result<EventSlotClearing, String> {
    let ended_only_at = (!session(&events)?.has_verified_feed()).then(now);
    Ok(game_plan_publication::clear_event(
        &config_dir(&app)?,
        ModulePackage::bundled(),
        ended_only_at,
    ))
}

/// Downloads a verified event's project from beside the feed and checks it against the signed
/// hash, as text for the planner to open.
#[tauri::command]
pub async fn event_project_download(
    events: State<'_, CommunityEvents>,
    event_id: String,
) -> Result<String, String> {
    let (plan, url) = {
        let session = session(&events)?;
        let plan = session
            .named(&event_id)
            .ok_or_else(|| format!("{event_id} is not a verified event."))?
            .clone();
        let url = project_url(&plan)?.to_owned();
        (plan, url)
    };
    let bytes = download(&client()?, &url, MAX_EVENT_PROJECT_BYTES).await?;
    event_feed::verify_project(&plan, &bytes)?;
    String::from_utf8(bytes).map_err(|_| "The event project is not text.".to_owned())
}

/// Development builds: loads a local event file in place of the feed's event.
#[cfg(any(debug_assertions, internal_features))]
#[tauri::command]
pub fn game_event_file_load(
    events: State<'_, CommunityEvents>,
    path: String,
) -> Result<EventPlan, String> {
    let plan = run_planner_game_host::community_event::read_event_file(
        std::path::Path::new(&path),
        &ModulePackage::bundled().build_id,
    )
    .map_err(|error| error.to_string())?;
    session(&events)?.set_local(plan.clone());
    Ok(plan)
}

/// Development builds: returns to the feed's event.
#[cfg(any(debug_assertions, internal_features))]
#[tauri::command]
pub fn game_event_local_clear(events: State<'_, CommunityEvents>) -> Result<(), String> {
    session(&events)?.clear_local();
    Ok(())
}
