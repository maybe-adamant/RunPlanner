//! Downloads a signed feed over HTTPS, verifies it before decoding and keeps it in application
//! data for offline starts; shared by the community events and the plan catalog.

use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};
use std::time::Duration;

use tauri::{AppHandle, Manager};

use run_planner_game_host::signed_feed::{FeedSession, SignedFeed, Verified};

const FETCH_TIMEOUT: Duration = Duration::from_secs(20);

/// One feed as this app reads it: where it is published, its checked-in public key and its
/// decoder.
pub struct FeedEndpoint<T> {
    pub feed: SignedFeed,
    pub public_key: &'static str,
    pub decode: fn(&[u8]) -> Result<T, String>,
}

pub fn lock<'a, S>(session: &'a Mutex<S>, label: &str) -> Result<MutexGuard<'a, S>, String> {
    session
        .lock()
        .map_err(|_| format!("The {label} state is unavailable."))
}

fn cache_directory(app: &AppHandle, feed: &SignedFeed) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(feed.cache_directory))
        .map_err(|error| format!("could not resolve application data directory: {error}"))
}

pub fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .https_only(true)
        .timeout(FETCH_TIMEOUT)
        .build()
        .map_err(|error| format!("Could not prepare the download: {error}"))
}

pub async fn download(
    client: &reqwest::Client,
    url: &str,
    limit: usize,
) -> Result<Vec<u8>, String> {
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
async fn fetch<T>(
    app: &AppHandle,
    endpoint: &FeedEndpoint<T>,
    key: &str,
    not_before: Option<u64>,
) -> Result<Verified<T>, String> {
    let feed = &endpoint.feed;
    let client = client()?;
    let bytes = download(&client, feed.url, feed.max_bytes).await?;
    let signature = download(
        &client,
        feed.signature_url,
        run_planner_game_host::signed_feed::MAX_FEED_SIGNATURE_BYTES,
    )
    .await?;
    let verified = feed.verify(&bytes, &signature, key, not_before, endpoint.decode)?;
    // A feed that cannot be cached is still used for this session.
    if let Ok(directory) = cache_directory(app, feed) {
        let _ = feed.cache(&directory, &bytes, &signature);
    }
    Ok(verified)
}

/// Fetches the feed unless it was read within the refresh interval, or at once after a failed
/// fetch when `retry_failed`; offline, the feed already held or the cached one stands. Without
/// an installed public key the session is disabled. Returns why the fetch failed, when it did.
pub async fn refresh<T, S: FeedSession<T>>(
    app: &AppHandle,
    endpoint: &FeedEndpoint<T>,
    session: &Mutex<S>,
    retry_failed: bool,
) -> Result<Option<String>, String> {
    let feed = &endpoint.feed;
    let started = std::time::Instant::now();
    let (fetch_now, held) = {
        let session = lock(session, feed.label)?;
        let state = session.feed_state();
        (state.needs_fetch(started, retry_failed), state.signed_at())
    };
    if !fetch_now {
        return Ok(None);
    }
    let key = match feed.public_key(endpoint.public_key) {
        Ok(key) => key,
        Err(problem) => {
            eprintln!("[RunPlanner] {}: {problem}", feed.label);
            lock(session, feed.label)?.disable();
            return Ok(None);
        }
    };
    // A cached feed that verifies sets the floor even when it no longer decodes.
    let not_before = held.or_else(|| {
        cache_directory(app, feed)
            .ok()
            .and_then(|directory| feed.cached_signed_at(&directory, key))
    });
    match fetch(app, endpoint, key, not_before).await {
        Ok(verified) => {
            lock(session, feed.label)?
                .feed_state_mut()
                .accept_fetched(verified, started);
            Ok(None)
        }
        Err(message) => {
            let cached = cache_directory(app, feed)
                .ok()
                .and_then(|directory| feed.read_cached(&directory, key, endpoint.decode).ok());
            lock(session, feed.label)?
                .feed_state_mut()
                .fetch_failed(|| cached, started);
            Ok(Some(message))
        }
    }
}
