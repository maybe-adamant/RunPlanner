use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, State};

use run_planner_game_host::community_event::{instant_from_unix, CommunityEvent, Instant};
use run_planner_game_host::event_feed::{
    self, decode_feed, project_url, DecodedFeed, EventSession, ProjectSchemaRange, EVENT_FEED,
    MAX_EVENT_PROJECT_BYTES,
};
use run_planner_game_host::game_module_package::ModulePackage;
use run_planner_game_host::game_plan_publication::{
    self, EventSlotClearing, EventSlotKeep, GamePlanPublication,
};
use run_planner_game_host::signed_feed::FeedSource;
use run_planner_game_host::slot_overview::{SlotEvent, SlotSummary};

use crate::feed_fetch::{self, FeedEndpoint};
use crate::game_module_commands::config_dir;

/// The verified community events of this session.
#[derive(Default)]
pub struct CommunityEvents(Mutex<EventSession>);

/// The active event's project as this session holds it.
#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ActiveEventProject {
    /// Verified against the event's signed hash.
    Verified { json: String },
    /// Saved in a project schema this planner cannot load, so it was not downloaded.
    UnsupportedSchema,
    /// The download or its verification failed.
    Unavailable { problem: String },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveEvent {
    event: CommunityEvent,
    project: ActiveEventProject,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventFeedSnapshot {
    active: Option<ActiveEvent>,
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
    feed_fetch::lock(&events.0, "community event")
}

/// The event feed with its own public key, checked in beside the app; not the updater's.
const EVENT_ENDPOINT: FeedEndpoint<DecodedFeed> = FeedEndpoint {
    feed: EVENT_FEED,
    public_key: include_str!("../event-feed.pub"),
    decode: decode_feed,
};

/// Downloads an event's project from beside the feed, verifies it against the signed hash and
/// holds it for the session.
async fn verified_project(
    events: &State<'_, CommunityEvents>,
    event: &CommunityEvent,
) -> Result<String, String> {
    if let Some(held) = session(events)?.held_project(event) {
        return Ok(held.to_owned());
    }
    let url = project_url(event)?.to_owned();
    let bytes = feed_fetch::download(&feed_fetch::client()?, &url, MAX_EVENT_PROJECT_BYTES).await?;
    let json = event_feed::verify_project(event, bytes)?;
    session(events)?.hold_project(event, json.clone(), now());
    Ok(json)
}

/// Fetches the feed unless it was read within the refresh interval, or at once after a failed
/// fetch when `retry_failed`; offline, the last verified feed stands. Returns the active event
/// with its verified project, which is downloaded only when `project_schemas` admits it.
#[tauri::command]
pub async fn event_feed_refresh(
    app: AppHandle,
    events: State<'_, CommunityEvents>,
    retry_failed: bool,
    project_schemas: ProjectSchemaRange,
) -> Result<EventFeedSnapshot, String> {
    let problem = feed_fetch::refresh(&app, &EVENT_ENDPOINT, &events.0, retry_failed).await?;
    let (active, source) = {
        let session = session(&events)?;
        for refused in session.refused() {
            eprintln!("[RunPlanner] community event refused: {refused}");
        }
        (session.active(now()).cloned(), session.source())
    };
    let active = match active {
        None => None,
        Some(event) => {
            let project = if !project_schemas.admits(&event) {
                ActiveEventProject::UnsupportedSchema
            } else {
                match verified_project(&events, &event).await {
                    Ok(json) => ActiveEventProject::Verified { json },
                    Err(problem) => ActiveEventProject::Unavailable { problem },
                }
            };
            Some(ActiveEvent { event, project })
        }
    };
    Ok(EventFeedSnapshot {
        active,
        source,
        problem,
    })
}

/// Writes a plan to the event slot, only for the active event whose project this session
/// verified, with the host's own event metadata. The plan is trusted as a send's is; its
/// `projectId` must match that project's.
#[tauri::command]
pub fn game_event_publish(
    app: AppHandle,
    events: State<'_, CommunityEvents>,
    event_id: String,
    plan_json: String,
    summary: SlotSummary,
) -> Result<GamePlanPublication, String> {
    let event = session(&events)?
        .publishable(&event_id, &plan_json, now())?
        .clone();
    Ok(game_plan_publication::publish_event(
        &config_dir(&app)?,
        ModulePackage::bundled(),
        &plan_json,
        summary,
        SlotEvent {
            id: event.id,
            title: event.title,
            ends_at: event.ends_at,
        },
    ))
}

/// Clears the event slot, keeping it only while it holds the active event's plan. Without
/// verified event data, as an offline start may have, only an event slot whose own event ended
/// is cleared.
#[tauri::command]
pub fn game_event_clear(
    app: AppHandle,
    events: State<'_, CommunityEvents>,
) -> Result<EventSlotClearing, String> {
    let now = now();
    let session = session(&events)?;
    let active = session.active(now).map(|event| event.id.clone());
    let keep = match (&active, session.has_verified_feed()) {
        (_, false) => EventSlotKeep::UntilEnded(now),
        (Some(id), true) => EventSlotKeep::Event(id),
        (None, true) => EventSlotKeep::Nothing,
    };
    drop(session);
    Ok(game_plan_publication::clear_event(
        &config_dir(&app)?,
        ModulePackage::bundled(),
        keep,
    ))
}

/// A verified event's project, checked against the signed hash, as text for the planner to
/// open.
#[tauri::command]
pub async fn event_project_download(
    events: State<'_, CommunityEvents>,
    event_id: String,
) -> Result<String, String> {
    let event = session(&events)?
        .named(&event_id)
        .ok_or_else(|| format!("{event_id} is not a verified event."))?
        .clone();
    verified_project(&events, &event).await
}

/// Development builds: loads a local event folder in place of the feed's event.
#[cfg(any(debug_assertions, internal_features))]
#[tauri::command]
pub fn game_event_folder_load(
    events: State<'_, CommunityEvents>,
    path: String,
) -> Result<CommunityEvent, String> {
    let local = event_feed::read_local_event(std::path::Path::new(&path))?;
    let event = local.event.clone();
    session(&events)?.set_local(local);
    Ok(event)
}

/// Development builds: returns to the feed's event.
#[cfg(any(debug_assertions, internal_features))]
#[tauri::command]
pub fn game_event_local_clear(events: State<'_, CommunityEvents>) -> Result<(), String> {
    session(&events)?.clear_local();
    Ok(())
}
