use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, State};

use run_planner_game_host::catalog_feed::{
    self, decode_catalog, CatalogCategory, CatalogEntry, CatalogIndex, CatalogSession,
    CATALOG_FEED, MAX_CATALOG_PLAN_BYTES,
};
use run_planner_game_host::signed_feed::{FeedSession, FeedSource};

use crate::feed_fetch::{self, FeedEndpoint};

/// The verified plan catalog of this session.
#[derive(Default)]
pub struct PlanCatalog(Mutex<CatalogSession>);

/// The catalog index with its own public key, checked in beside the app.
const CATALOG_ENDPOINT: FeedEndpoint<CatalogIndex> = FeedEndpoint {
    feed: CATALOG_FEED,
    public_key: include_str!("../catalog-feed.pub"),
    decode: decode_catalog,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogSnapshot {
    categories: Vec<CatalogCategory>,
    entries: Vec<CatalogEntry>,
    source: FeedSource,
    /// Why the last fetch failed, when it did.
    problem: Option<String>,
}

/// Fetches the index unless it was read within the refresh interval, or at once after a failed
/// fetch when `retry_failed`; offline, the last verified index stands.
#[tauri::command]
pub async fn catalog_feed_refresh(
    app: AppHandle,
    catalog: State<'_, PlanCatalog>,
    retry_failed: bool,
) -> Result<CatalogSnapshot, String> {
    let problem = feed_fetch::refresh(&app, &CATALOG_ENDPOINT, &catalog.0, retry_failed).await?;
    let session = feed_fetch::lock(&catalog.0, CATALOG_FEED.label)?;
    let state = session.feed_state();
    let index = state.feed().cloned().unwrap_or_default();
    for refused in &index.refused {
        eprintln!("[RunPlanner] catalog entry refused: {refused}");
    }
    Ok(CatalogSnapshot {
        categories: index.categories,
        entries: index.entries,
        source: state.source(),
        problem,
    })
}

/// A verified entry's plan file, checked against the signed hash, as text.
#[tauri::command]
pub async fn catalog_plan_download(
    catalog: State<'_, PlanCatalog>,
    entry_id: String,
) -> Result<String, String> {
    let entry = {
        let session = feed_fetch::lock(&catalog.0, CATALOG_FEED.label)?;
        catalog_feed::entry_named(&session, &entry_id)
            .ok_or_else(|| format!("{entry_id} is not a verified catalog entry."))?
            .clone()
    };
    let bytes = feed_fetch::download(
        &feed_fetch::client()?,
        &entry.plan_url,
        MAX_CATALOG_PLAN_BYTES,
    )
    .await?;
    catalog_feed::verify_plan(&entry, bytes)
}
