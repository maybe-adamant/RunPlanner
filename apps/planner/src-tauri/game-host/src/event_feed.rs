use base64::Engine;
use minisign_verify::{PublicKey, Signature};
use serde::Deserialize;
use serde_json::value::RawValue;
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use std::fs;
use std::io::Read;
use std::path::Path;

use crate::atomic_file;
use crate::community_event::{
    decode_event, valid_event_id, CommunityEvent, Instant, MAX_EVENT_BYTES,
};

// The repository whose `events` release publishes the feed; renaming it is this one edit.
macro_rules! events_repository {
    () => {
        "maybe-adamant/RunPlanner-Events"
    };
}
pub const EVENTS_REPOSITORY: &str = events_repository!();
/// The signed community event feed, replaced in place on the events repository's `events` release.
pub const EVENT_FEED_URL: &str = concat!(
    "https://github.com/",
    events_repository!(),
    "/releases/download/events/events.json"
);
pub const EVENT_FEED_SIGNATURE_URL: &str = concat!(
    "https://github.com/",
    events_repository!(),
    "/releases/download/events/events.json.sig"
);
/// Every event's project file is published beside the feed as `<id>.runplanner.json`.
pub const EVENT_PROJECT_URL_PREFIX: &str = concat!(
    "https://github.com/",
    events_repository!(),
    "/releases/download/events/"
);
/// Stands in the checked-in event public key until the owner installs the real one; a feed is
/// never verified against it.
pub const EVENT_PUBLIC_KEY_PLACEHOLDER: &str =
    "PLACEHOLDER: replace with the event feed public key";
/// The signed file name the signature's trusted comment must name.
pub const EVENT_FEED_FILE_NAME: &str = "events.json";
pub const EVENT_FEED_FORMAT: &str = "run-planner-event-feed";
pub const EVENT_FEED_FORMAT_VERSION: u8 = 2;
pub const MAX_FEED_BYTES: usize = 16 * 1_048_576;
pub const MAX_FEED_SIGNATURE_BYTES: usize = 4096;
pub const MAX_FEED_EVENTS: usize = 32;
pub const MAX_EVENT_PROJECT_BYTES: usize = 8 * 1_048_576;
/// The last verified feed with its signature, kept in application data for offline starts:
/// the signature file's line, a line break, then the feed bytes, written as one file.
pub const CACHED_FEED_FILE: &str = "events.cache";

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct FeedDocument<'a> {
    format: String,
    format_version: u8,
    #[serde(borrow)]
    events: Vec<&'a RawValue>,
}

/// The events a verified feed lists, and why any listed event was refused.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct DecodedFeed {
    pub events: Vec<CommunityEvent>,
    pub refused: Vec<String>,
}

/// A decoded feed with the time its signature's trusted comment records.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct VerifiedFeed {
    pub feed: DecodedFeed,
    /// Seconds since the Unix epoch.
    pub signed_at: u64,
}

fn base64_text(encoded: &[u8], artifact: &str) -> Result<String, String> {
    let trimmed = std::str::from_utf8(encoded)
        .map_err(|_| format!("The {artifact} is not text."))?
        .trim();
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(trimmed)
        .map_err(|_| format!("The {artifact} is not base64."))?;
    String::from_utf8(decoded).map_err(|_| format!("The {artifact} is not text."))
}

/// The event feed public key as checked in, refused while it is still the placeholder.
pub fn event_public_key(checked_in: &str) -> Result<&str, String> {
    let key = checked_in.trim();
    if key.is_empty() || key.starts_with("PLACEHOLDER") {
        return Err(
            "No event feed public key is installed, so community events are off.".to_owned(),
        );
    }
    Ok(key)
}

/// Verifies `data` against a signature file as `tauri signer sign` writes it (base64 of a
/// prehashed minisign signature), with the event public key in the same base64 form.
/// The trusted comment, covered by the signature, must name `events.json`; its timestamp is
/// returned.
pub fn verify_signature(
    data: &[u8],
    signature_file: &[u8],
    public_key: &str,
) -> Result<u64, String> {
    if signature_file.len() > MAX_FEED_SIGNATURE_BYTES {
        return Err("The event feed signature is too large.".to_owned());
    }
    let key = PublicKey::decode(&base64_text(public_key.as_bytes(), "public key")?)
        .map_err(|_| "The event feed public key is invalid.".to_owned())?;
    let signature = Signature::decode(&base64_text(signature_file, "event feed signature")?)
        .map_err(|_| "The event feed signature is invalid.".to_owned())?;
    key.verify(data, &signature, false)
        .map_err(|_| "The event feed signature does not match.".to_owned())?;
    let comment = signature.trusted_comment();
    let field = |name: &str| {
        comment
            .split('\t')
            .find_map(|part| part.strip_prefix(name).map(str::to_owned))
    };
    if field("file:").as_deref() != Some(EVENT_FEED_FILE_NAME) {
        return Err("The event feed signature is for another file.".to_owned());
    }
    field("timestamp:")
        .and_then(|seconds| seconds.parse().ok())
        .ok_or_else(|| "The event feed signature has no timestamp.".to_owned())
}

/// The only project URL an event may name: its own file beside the feed.
pub fn project_url_for(id: &str) -> String {
    format!("{EVENT_PROJECT_URL_PREFIX}{id}.runplanner.json")
}

/// Decodes a verified feed. A malformed feed is refused whole; within it, an invalid event, one
/// whose project is not its own file beside the feed, or a repeated id is refused alone.
pub fn decode_feed(bytes: &[u8]) -> Result<DecodedFeed, String> {
    if bytes.len() > MAX_FEED_BYTES {
        return Err(format!(
            "The event feed exceeds the {MAX_FEED_BYTES}-byte limit."
        ));
    }
    let document: FeedDocument =
        serde_json::from_slice(bytes).map_err(|error| format!("Invalid event feed: {error}"))?;
    if document.format != EVENT_FEED_FORMAT || document.format_version != EVENT_FEED_FORMAT_VERSION
    {
        return Err(format!(
            "The event feed must be {EVENT_FEED_FORMAT} version {EVENT_FEED_FORMAT_VERSION}."
        ));
    }
    if document.events.len() > MAX_FEED_EVENTS {
        return Err(format!(
            "The event feed lists more than {MAX_FEED_EVENTS} events."
        ));
    }
    let mut decoded = DecodedFeed::default();
    let mut ids = BTreeSet::new();
    for raw in document.events {
        match decode_event(raw.get().as_bytes()) {
            Ok(event) => {
                let id = event.id.clone();
                if project_url(&event).is_err() {
                    decoded.refused.push(format!(
                        "{id}: the project must be published beside the feed."
                    ));
                } else if !ids.insert(id.clone()) {
                    decoded
                        .refused
                        .push(format!("{id}: listed more than once."));
                } else {
                    decoded.events.push(event);
                }
            }
            Err(message) => decoded.refused.push(message),
        }
    }
    Ok(decoded)
}

/// Verifies then decodes a feed, refusing one signed before `not_before` (a replay of an older
/// feed than the one already verified).
pub fn verify_feed(
    feed: &[u8],
    signature: &[u8],
    public_key: &str,
    not_before: Option<u64>,
) -> Result<VerifiedFeed, String> {
    let signed_at = verify_signature(feed, signature, public_key)?;
    if not_before.is_some_and(|earliest| signed_at < earliest) {
        return Err("The event feed is older than the one already verified.".to_owned());
    }
    Ok(VerifiedFeed {
        feed: decode_feed(feed)?,
        signed_at,
    })
}

fn window(event: &CommunityEvent) -> Option<(Instant, Instant)> {
    use crate::community_event::parse_instant;
    Some((
        parse_instant(&event.starts_at)?,
        parse_instant(&event.ends_at)?,
    ))
}

/// The one active event: its window contains `now`; of several, the latest start wins, then
/// the greatest id.
pub fn select_active(events: &[CommunityEvent], now: Instant) -> Option<&CommunityEvent> {
    events
        .iter()
        .filter_map(|event| {
            let (starts, ends) = window(event)?;
            (starts <= now && now < ends).then_some((starts, event))
        })
        .max_by(|(a, left), (b, right)| a.cmp(b).then(left.id.cmp(&right.id)))
        .map(|(_, event)| event)
}

/// The authored project schemas this planner loads, inclusive; the planner supplies them.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct ProjectSchemaRange {
    pub oldest: u32,
    pub newest: u32,
}

impl ProjectSchemaRange {
    /// Whether this planner can load an event's project; an event outside the range is not
    /// downloaded.
    pub fn admits(&self, event: &CommunityEvent) -> bool {
        (self.oldest..=self.newest).contains(&event.project_schema_version)
    }
}

/// Keeps a verified feed and its signature together, in one atomically replaced file.
pub fn cache_feed(directory: &Path, feed: &[u8], signature: &[u8]) -> Result<(), String> {
    let line = std::str::from_utf8(signature)
        .ok()
        .map(str::trim)
        .filter(|line| !line.contains('\n'))
        .ok_or_else(|| "The event feed signature is not one line.".to_owned())?;
    fs::create_dir_all(directory)
        .map_err(|error| format!("could not create the event feed cache: {error}"))?;
    let mut bytes = Vec::with_capacity(line.len() + 1 + feed.len());
    bytes.extend_from_slice(line.as_bytes());
    bytes.push(b'\n');
    bytes.extend_from_slice(feed);
    atomic_file::write(
        &directory.join(CACHED_FEED_FILE),
        &bytes,
        "event feed cache",
    )
}

fn read_bounded(path: &Path, limit: usize) -> Option<Vec<u8>> {
    let metadata = fs::symlink_metadata(path).ok()?;
    if metadata.file_type().is_symlink() || !metadata.is_file() || metadata.len() > limit as u64 {
        return None;
    }
    let mut bytes = Vec::new();
    fs::File::open(path)
        .and_then(|file| file.take(limit as u64 + 1).read_to_end(&mut bytes))
        .ok()?;
    (bytes.len() <= limit).then_some(bytes)
}

// The cached signature line and feed bytes, unverified.
fn read_cached_parts(directory: &Path) -> Result<(Vec<u8>, usize), String> {
    let bytes = read_bounded(
        &directory.join(CACHED_FEED_FILE),
        MAX_FEED_SIGNATURE_BYTES + 1 + MAX_FEED_BYTES,
    )
    .ok_or_else(|| "No cached event feed.".to_owned())?;
    let split = bytes
        .iter()
        .position(|&byte| byte == b'\n')
        .ok_or_else(|| "The cached event feed is malformed.".to_owned())?;
    Ok((bytes, split))
}

/// The cached feed, verified again, since application data is not trusted more than the network.
pub fn read_cached_feed(directory: &Path, public_key: &str) -> Result<VerifiedFeed, String> {
    let (bytes, split) = read_cached_parts(directory)?;
    verify_feed(&bytes[split + 1..], &bytes[..split], public_key, None)
}

/// When the cached feed was signed, once its signature verifies, even when it no longer
/// decodes (an older format): a fetched feed must not predate it.
pub fn cached_signed_at(directory: &Path, public_key: &str) -> Option<u64> {
    let (bytes, split) = read_cached_parts(directory).ok()?;
    verify_signature(&bytes[split + 1..], &bytes[..split], public_key).ok()
}

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Checks a downloaded project file against its event's signed hash, as text.
pub fn verify_project(event: &CommunityEvent, bytes: Vec<u8>) -> Result<String, String> {
    if sha256_hex(&bytes) != event.project_sha256 {
        return Err("The downloaded project does not match the event.".to_owned());
    }
    String::from_utf8(bytes).map_err(|_| "The event project is not text.".to_owned())
}

/// The `projectId` a project file or an execution plan names at its top level.
pub fn project_id_of(json: &str) -> Option<String> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Identity {
        project_id: String,
    }
    serde_json::from_str::<Identity>(json)
        .ok()
        .map(|identity| identity.project_id)
}

/// How long a successful feed read stands before the next background fetch.
pub const FEED_REFRESH_INTERVAL: std::time::Duration = std::time::Duration::from_secs(10 * 60);

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FeedSource {
    /// No verified feed has been read.
    None,
    Network,
    /// The last verified feed kept in application data.
    Cache,
    /// No event public key is installed, so there are no events.
    Disabled,
}

/// A project file verified against its event's hash, held for the session.
#[derive(Clone, Debug, PartialEq, Eq)]
struct HeldProject {
    event_id: String,
    sha256: String,
    json: String,
}

/// The host's verified events for this session. The event slot is written only for the active
/// event whose project this session verified, with the host's own event metadata.
#[derive(Debug)]
pub struct EventSession {
    feed: Option<DecodedFeed>,
    signed_at: Option<u64>,
    source: FeedSource,
    checked_at: Option<std::time::Instant>,
    last_failed: bool,
    /// A development event, which takes the place of the feed's event.
    local: Option<CommunityEvent>,
    project: Option<HeldProject>,
}

impl Default for EventSession {
    fn default() -> Self {
        Self {
            feed: None,
            signed_at: None,
            source: FeedSource::None,
            checked_at: None,
            last_failed: false,
            local: None,
            project: None,
        }
    }
}

impl EventSession {
    /// Background reads wait out the interval; `retry_failed` retries at once after a failure.
    pub fn needs_fetch(&self, now: std::time::Instant, retry_failed: bool) -> bool {
        (retry_failed && self.last_failed)
            || self
                .checked_at
                .map_or(true, |at| now.duration_since(at) >= FEED_REFRESH_INTERVAL)
    }

    /// The signing time a newly fetched feed must not predate.
    pub fn signed_at(&self) -> Option<u64> {
        self.signed_at
    }

    pub fn accept_fetched(&mut self, verified: VerifiedFeed, at: std::time::Instant) {
        self.feed = Some(verified.feed);
        self.signed_at = Some(verified.signed_at);
        self.source = FeedSource::Network;
        self.checked_at = Some(at);
        self.last_failed = false;
    }

    /// A failed fetch keeps the feed already held, else falls back to the cached one.
    pub fn fetch_failed(
        &mut self,
        cached: impl FnOnce() -> Option<VerifiedFeed>,
        at: std::time::Instant,
    ) {
        if self.feed.is_none() {
            if let Some(verified) = cached() {
                self.feed = Some(verified.feed);
                self.signed_at = Some(verified.signed_at);
                self.source = FeedSource::Cache;
            }
        }
        self.checked_at = Some(at);
        self.last_failed = true;
    }

    /// Without an installed event key there are no events: the session holds an empty feed,
    /// so the event slot is cleared rather than kept.
    pub fn disable(&mut self) {
        self.feed = Some(DecodedFeed::default());
        self.signed_at = None;
        self.source = FeedSource::Disabled;
        self.local = None;
        self.project = None;
    }

    pub fn source(&self) -> FeedSource {
        self.source
    }

    /// Whether the session holds verified event data, so a missing event is known to be absent.
    pub fn has_verified_feed(&self) -> bool {
        self.feed.is_some() || self.local.is_some()
    }

    pub fn refused(&self) -> &[String] {
        self.feed
            .as_ref()
            .map_or(&[], |feed| feed.refused.as_slice())
    }

    /// A development event with its project, in place of the feed's event.
    pub fn set_local(&mut self, local: LocalEvent) {
        self.keep_project(&local.event, local.project_json);
        self.local = Some(local.event);
    }

    pub fn clear_local(&mut self) {
        self.local = None;
    }

    /// The development event when one is loaded, else the feed's active event at `now`.
    pub fn active(&self, now: Instant) -> Option<&CommunityEvent> {
        self.local.as_ref().or_else(|| {
            self.feed
                .as_ref()
                .and_then(|feed| select_active(&feed.events, now))
        })
    }

    /// Any verified event by id, for opening its project.
    pub fn named(&self, id: &str) -> Option<&CommunityEvent> {
        self.local
            .iter()
            .chain(self.feed.iter().flat_map(|feed| feed.events.iter()))
            .find(|event| event.id == id)
    }

    /// Keeps a project already verified against `event`'s hash, only while `event` is the
    /// active event, so opening another event's project never replaces it.
    pub fn hold_project(&mut self, event: &CommunityEvent, json: String, now: Instant) {
        if self.active(now) == Some(event) {
            self.keep_project(event, json);
        }
    }

    fn keep_project(&mut self, event: &CommunityEvent, json: String) {
        self.project = Some(HeldProject {
            event_id: event.id.clone(),
            sha256: event.project_sha256.clone(),
            json,
        });
    }

    /// The project held for `event`, when this session verified it.
    pub fn held_project(&self, event: &CommunityEvent) -> Option<&str> {
        self.project
            .as_ref()
            .filter(|held| held.event_id == event.id && held.sha256 == event.project_sha256)
            .map(|held| held.json.as_str())
    }

    /// The event a plan may be written to the event slot for: the active event named, whose
    /// project this session verified. The plan is trusted as a send's is; its `projectId` must
    /// match that project's, a consistency check against a plan compiled from something else,
    /// not an authentication. The module decodes the whole plan.
    pub fn publishable(
        &self,
        id: &str,
        plan_json: &str,
        now: Instant,
    ) -> Result<&CommunityEvent, String> {
        let event = self
            .active(now)
            .filter(|event| event.id == id)
            .ok_or_else(|| format!("{id} is not the active event."))?;
        let project = self
            .held_project(event)
            .ok_or_else(|| format!("{id} has no verified project."))?;
        let plan_project =
            project_id_of(plan_json).ok_or_else(|| "The event plan is invalid.".to_owned())?;
        (project_id_of(project).as_deref() == Some(plan_project.as_str()))
            .then_some(event)
            .ok_or_else(|| format!("The plan is not compiled from {id}'s project."))
    }
}

/// The project URL of an event, only when it is exactly the event's own file beside the feed.
pub fn project_url(event: &CommunityEvent) -> Result<&str, String> {
    Some(event.project_url.as_str())
        .filter(|url| *url == project_url_for(&event.id))
        .ok_or_else(|| "This event has no project published beside the feed.".to_owned())
}

/// A development event: a local folder's `event.json` and `project.runplanner.json`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LocalEvent {
    pub event: CommunityEvent,
    pub project_json: String,
}

pub const LOCAL_EVENT_FILE: &str = "event.json";
pub const LOCAL_PROJECT_FILE: &str = "project.runplanner.json";

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct AuthoredEvent {
    id: String,
    title: String,
    description: String,
    #[serde(default)]
    rules: Option<String>,
    starts_at: String,
    ends_at: String,
}

/// Reads an authored event folder as the feed would list it: the project URL is its own file
/// beside the feed, and the hash and schema are the project file's.
pub fn read_local_event(folder: &Path) -> Result<LocalEvent, String> {
    let read = |name: &str, limit: usize| {
        read_bounded(&folder.join(name), limit)
            .ok_or_else(|| format!("Could not read {name} within {limit} bytes as a regular file."))
    };
    let authored: AuthoredEvent = serde_json::from_slice(&read(LOCAL_EVENT_FILE, MAX_EVENT_BYTES)?)
        .map_err(|error| format!("Invalid {LOCAL_EVENT_FILE}: {error}"))?;
    if !valid_event_id(&authored.id)
        || folder.file_name().and_then(|name| name.to_str()) != Some(authored.id.as_str())
    {
        return Err("An event's id must be valid and equal its folder name.".to_owned());
    }
    let project = read(LOCAL_PROJECT_FILE, MAX_EVENT_PROJECT_BYTES)?;
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Schema {
        schema_version: u32,
    }
    let schema: Schema = serde_json::from_slice(&project)
        .map_err(|_| format!("{LOCAL_PROJECT_FILE} names no schemaVersion."))?;
    let event = CommunityEvent {
        project_url: project_url_for(&authored.id),
        id: authored.id,
        title: authored.title,
        description: authored.description,
        rules: authored.rules,
        starts_at: authored.starts_at,
        ends_at: authored.ends_at,
        project_sha256: sha256_hex(&project),
        project_schema_version: schema.schema_version,
    };
    event.validate()?;
    let project_json =
        String::from_utf8(project).map_err(|_| format!("{LOCAL_PROJECT_FILE} is not text."))?;
    Ok(LocalEvent {
        event,
        project_json,
    })
}

#[cfg(test)]
pub mod test_support {
    // Signed by `tauri signer sign` with a throwaway key made for these fixtures; its private
    // half is not kept.
    pub const TEST_PUBLIC_KEY: &str = include_str!("../tests/fixtures/event-feed/test-key.pub");
    pub const SIGNED_FEED: &[u8] = include_bytes!("../tests/fixtures/event-feed/events.json");
    pub const FEED_SIGNATURE: &[u8] =
        include_bytes!("../tests/fixtures/event-feed/events.json.sig");
    /// A signature of the same bytes whose trusted comment names `other.json`.
    pub const OTHER_FILE_SIGNATURE: &[u8] =
        include_bytes!("../tests/fixtures/event-feed/events.json.other-name.sig");
    pub const FEED_SIGNED_AT: u64 = 1_792_091_486;
    /// A version 1 feed, which carried compiled plans, signed by the same key.
    pub const V1_FEED: &[u8] = include_bytes!("../tests/fixtures/event-feed/events-v1.json");
    pub const V1_FEED_SIGNATURE: &[u8] =
        include_bytes!("../tests/fixtures/event-feed/events-v1.json.sig");
    pub const V1_FEED_SIGNED_AT: u64 = 1_792_093_061;
    /// The project file whose hash the signed fixture names.
    pub const PROJECT_BYTES: &[u8] = br#"{"schemaVersion":96,"projectId":"event-project"}"#;
    pub const PROJECT_HASH: &str =
        "cb81f8d0a1b589a99debe12a363d0e482d3349b96e10526b7ed6e9a5dc0dd7a4";
}

#[cfg(test)]
mod tests {
    use super::test_support::*;
    use super::*;
    use crate::community_event::parse_instant;
    use crate::game_target::test_support::TemporaryDirectory;

    // A real minisign key (the app updater's) that did not sign the test fixture.
    const OTHER_PUBLIC_KEY: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEVEOTZDOEExM0I5OUYyN0UKUldSKzhwazdvY2lXN2MzMVNGR1pQQWFGOTV2V1l5dEg5Yis1dzRYTDk2VWFldFdweER3Z3huRjcK";
    const PLAN: &str = r#"{"format":"run-planner-execution","projectId":"event-project","planFingerprint":"event-print"}"#;

    #[test]
    fn the_placeholder_public_key_is_never_used() {
        assert!(event_public_key(EVENT_PUBLIC_KEY_PLACEHOLDER).is_err());
        assert!(event_public_key("  ").is_err());
        assert_eq!(
            event_public_key(TEST_PUBLIC_KEY),
            Ok(TEST_PUBLIC_KEY.trim())
        );
        let shipped = include_str!("../../event-feed.pub");
        assert!(
            shipped.trim() == EVENT_PUBLIC_KEY_PLACEHOLDER || event_public_key(shipped).is_ok(),
            "event-feed.pub holds the placeholder or a key"
        );
        assert_eq!(
            EVENT_FEED_URL,
            "https://github.com/maybe-adamant/RunPlanner-Events/releases/download/events/events.json"
        );
    }

    #[test]
    fn a_feed_signed_by_the_key_for_events_json_verifies_and_anything_else_is_refused() {
        assert_eq!(
            verify_signature(SIGNED_FEED, FEED_SIGNATURE, TEST_PUBLIC_KEY),
            Ok(FEED_SIGNED_AT)
        );
        let mut tampered = SIGNED_FEED.to_vec();
        tampered[10] ^= 1;
        assert!(verify_signature(&tampered, FEED_SIGNATURE, TEST_PUBLIC_KEY).is_err());
        assert_eq!(
            verify_signature(SIGNED_FEED, FEED_SIGNATURE, OTHER_PUBLIC_KEY),
            Err("The event feed signature does not match.".to_owned())
        );
        assert_eq!(
            verify_signature(SIGNED_FEED, OTHER_FILE_SIGNATURE, TEST_PUBLIC_KEY),
            Err("The event feed signature is for another file.".to_owned())
        );
        for signature in [
            &b"not base64"[..],
            b"",
            &[b'A'; MAX_FEED_SIGNATURE_BYTES + 1],
        ] {
            assert!(verify_signature(SIGNED_FEED, signature, TEST_PUBLIC_KEY).is_err());
        }
        let verified = verify_feed(SIGNED_FEED, FEED_SIGNATURE, TEST_PUBLIC_KEY, None).unwrap();
        assert_eq!(verified.signed_at, FEED_SIGNED_AT);
        let event = &verified.feed.events[0];
        assert_eq!(event.id, "2026-w42-staff");
        assert_eq!(event.project_sha256, PROJECT_HASH);
        assert_eq!(event.project_schema_version, 96);
        // A feed signed before the one already verified is a replay.
        assert_eq!(
            verify_feed(
                SIGNED_FEED,
                FEED_SIGNATURE,
                TEST_PUBLIC_KEY,
                Some(FEED_SIGNED_AT + 1)
            ),
            Err("The event feed is older than the one already verified.".to_owned())
        );
        assert!(verify_feed(
            SIGNED_FEED,
            FEED_SIGNATURE,
            TEST_PUBLIC_KEY,
            Some(FEED_SIGNED_AT)
        )
        .is_ok());
    }

    fn event(id: &str, starts: &str, ends: &str, url: &str) -> String {
        format!(
            r#"{{"id":"{id}","title":"Title {id}","description":"d","startsAt":"{starts}","endsAt":"{ends}","projectUrl":"{url}","projectSha256":"{PROJECT_HASH}","projectSchemaVersion":96}}"#
        )
    }

    fn feed(events: &[String]) -> String {
        format!(
            r#"{{"format":"run-planner-event-feed","formatVersion":2,"events":[{}]}}"#,
            events.join(",")
        )
    }

    #[test]
    fn invalid_events_are_refused_alone_and_a_malformed_feed_whole() {
        let week =
            |id: &str, url: &str| event(id, "2026-10-12T00:00:00Z", "2026-10-19T00:00:00Z", url);
        let prefix = EVENT_PROJECT_URL_PREFIX;
        let decoded = decode_feed(
            feed(&[
                week("kept", &project_url_for("kept")),
                week("Bad Id", &project_url_for("bad")),
                week("elsewhere", "https://example.org/e.runplanner.json"),
                week("nested", &format!("{prefix}a/nested.runplanner.json")),
                week("borrowed", &project_url_for("kept")),
                week(
                    "dotted",
                    &format!("{prefix}%2e%2e%2Fdotted.runplanner.json"),
                ),
                week("slashed", &format!("{prefix}..\\\\slashed.runplanner.json")),
                week("queried", &format!("{}?x=1", project_url_for("queried"))),
                week("kept", &project_url_for("kept")),
                week("no-url", "").replace(r#","projectUrl":"""#, ""),
                week("no-hash", &project_url_for("no-hash"))
                    .replace(&format!(r#","projectSha256":"{PROJECT_HASH}""#), ""),
                week("no-schema", &project_url_for("no-schema"))
                    .replace(r#","projectSchemaVersion":96"#, ""),
                week("with-plans", &project_url_for("with-plans")).replace(
                    r#""projectSchemaVersion""#,
                    r#""plans":{},"projectSchemaVersion""#,
                ),
            ])
            .as_bytes(),
        )
        .unwrap();
        assert_eq!(
            decoded
                .events
                .iter()
                .map(|event| event.id.as_str())
                .collect::<Vec<_>>(),
            ["kept"]
        );
        assert_eq!(decoded.refused.len(), 12, "{:?}", decoded.refused);
        assert!(decoded
            .refused
            .contains(&"kept: listed more than once.".to_owned()));
        for invalid in [
            "not json".to_owned(),
            feed(&[]).replace("run-planner-event-feed", "run-planner-event"),
            // A version 1 feed, which carried compiled plans, is refused.
            feed(&[]).replace(r#""formatVersion":2"#, r#""formatVersion":1"#),
            feed(&[]).replace(r#""formatVersion":2"#, r#""formatVersion":3"#),
            feed(&[]).replace(r#""events""#, r#""extra":1,"events""#),
            feed(&vec![week("x", &project_url_for("x")); MAX_FEED_EVENTS + 1]),
        ] {
            assert!(decode_feed(invalid.as_bytes()).is_err(), "{invalid:.80}");
        }
        assert_eq!(
            decode_feed(feed(&[]).as_bytes()),
            Ok(DecodedFeed::default())
        );
    }

    #[test]
    fn an_event_outside_the_planners_project_schemas_is_not_playable() {
        let range = ProjectSchemaRange {
            oldest: 86,
            newest: 96,
        };
        let mut event = decode_feed(SIGNED_FEED).unwrap().events.remove(0);
        for (version, admitted) in [(85, false), (86, true), (96, true), (97, false)] {
            event.project_schema_version = version;
            assert_eq!(range.admits(&event), admitted, "{version}");
        }
    }

    #[test]
    fn the_active_event_is_the_latest_started_whose_window_holds_now() {
        let entry =
            |id: &str, starts: &str, ends: &str| event(id, starts, ends, &project_url_for(id));
        let events = decode_feed(
            feed(&[
                entry("past", "2026-10-01T00:00:00Z", "2026-10-08T00:00:00Z"),
                entry("early", "2026-10-10T00:00:00Z", "2026-10-20T00:00:00Z"),
                entry("late", "2026-10-12T00:00:00Z", "2026-10-19T00:00:00Z"),
                entry("same-a", "2026-10-26T00:00:00Z", "2026-11-02T00:00:00Z"),
                entry("same-b", "2026-10-26T00:00:00Z", "2026-11-02T00:00:00Z"),
                entry("next", "2026-10-19T00:00:00Z", "2026-10-26T00:00:00Z"),
            ])
            .as_bytes(),
        )
        .unwrap()
        .events;
        let at = |text: &str| parse_instant(text).unwrap();
        let active = |now: &str| select_active(&events, at(now)).map(|event| event.id.as_str());
        assert_eq!(active("2026-10-09T00:00:00Z"), None);
        assert_eq!(active("2026-10-11T00:00:00Z"), Some("early"));
        assert_eq!(active("2026-10-12T00:00:00Z"), Some("late"));
        // The end is exclusive; the next event starts at that instant.
        assert_eq!(active("2026-10-19T00:00:00Z"), Some("next"));
        // Equal starts fall to the greater id.
        assert_eq!(active("2026-10-27T00:00:00Z"), Some("same-b"));
        assert_eq!(active("2026-11-02T00:00:00Z"), None);
    }

    #[test]
    fn the_cached_feed_is_one_file_verified_again_when_read() {
        let temporary = TemporaryDirectory::new("event-feed-cache");
        let directory = temporary.0.join("event-feed");
        assert!(read_cached_feed(&directory, TEST_PUBLIC_KEY).is_err());
        cache_feed(&directory, SIGNED_FEED, FEED_SIGNATURE).unwrap();
        let cached = read_cached_feed(&directory, TEST_PUBLIC_KEY).unwrap();
        assert_eq!(cached.signed_at, FEED_SIGNED_AT);
        assert_eq!(cached.feed.events.len(), 1);
        let path = directory.join(CACHED_FEED_FILE);
        let mut tampered = fs::read(&path).unwrap();
        let last = tampered.len() - 2;
        tampered[last] ^= 1;
        fs::write(&path, tampered).unwrap();
        assert!(read_cached_feed(&directory, TEST_PUBLIC_KEY).is_err());
        // A signature that does not belong to the cached feed reads as no cache.
        let mut mismatched = OTHER_FILE_SIGNATURE.to_vec();
        mismatched.push(b'\n');
        mismatched.extend_from_slice(SIGNED_FEED);
        fs::write(&path, mismatched).unwrap();
        assert!(read_cached_feed(&directory, TEST_PUBLIC_KEY).is_err());
        fs::write(&path, SIGNED_FEED).unwrap();
        assert!(read_cached_feed(&directory, TEST_PUBLIC_KEY).is_err());
        assert_eq!(cached_signed_at(&directory, TEST_PUBLIC_KEY), None);
    }

    #[test]
    fn a_cached_feed_of_an_older_format_still_sets_the_replay_floor() {
        let temporary = TemporaryDirectory::new("event-feed-cache-v1");
        let directory = temporary.0.join("event-feed");
        assert_eq!(cached_signed_at(&directory, TEST_PUBLIC_KEY), None);
        cache_feed(&directory, V1_FEED, V1_FEED_SIGNATURE).unwrap();
        assert!(read_cached_feed(&directory, TEST_PUBLIC_KEY).is_err());
        assert_eq!(
            cached_signed_at(&directory, TEST_PUBLIC_KEY),
            Some(V1_FEED_SIGNED_AT)
        );
        assert_eq!(cached_signed_at(&directory, OTHER_PUBLIC_KEY), None);
        // The current fixture was signed before that cached feed, so it reads as a replay.
        assert!(verify_feed(
            SIGNED_FEED,
            FEED_SIGNATURE,
            TEST_PUBLIC_KEY,
            cached_signed_at(&directory, TEST_PUBLIC_KEY)
        )
        .is_err());
    }

    #[test]
    fn a_downloaded_project_must_match_its_signed_hash() {
        let verified = verify_feed(SIGNED_FEED, FEED_SIGNATURE, TEST_PUBLIC_KEY, None).unwrap();
        let event = &verified.feed.events[0];
        assert_eq!(
            project_url(event),
            Ok("https://github.com/maybe-adamant/RunPlanner-Events/releases/download/events/2026-w42-staff.runplanner.json")
        );
        assert_eq!(
            verify_project(event, PROJECT_BYTES.to_vec()).as_deref(),
            Ok(std::str::from_utf8(PROJECT_BYTES).unwrap())
        );
        assert_eq!(
            verify_project(event, b"other bytes".to_vec()),
            Err("The downloaded project does not match the event.".to_owned())
        );
    }

    fn session_with_feed(now: std::time::Instant) -> EventSession {
        let mut session = EventSession::default();
        session.accept_fetched(
            verify_feed(SIGNED_FEED, FEED_SIGNATURE, TEST_PUBLIC_KEY, None).unwrap(),
            now,
        );
        session
    }

    #[test]
    fn only_a_plan_of_the_active_events_verified_project_can_be_written() {
        let now = std::time::Instant::now();
        let during = parse_instant("2026-10-14T00:00:00Z").unwrap();
        let after = parse_instant("2026-10-20T00:00:00Z").unwrap();
        let id = "2026-w42-staff";
        let empty = EventSession::default();
        assert!(empty.needs_fetch(now, false));
        assert!(!empty.has_verified_feed());
        assert!(empty.publishable(id, PLAN, during).is_err());
        let mut session = session_with_feed(now);
        assert_eq!(session.source(), FeedSource::Network);
        assert_eq!(session.signed_at(), Some(FEED_SIGNED_AT));
        assert!(session.has_verified_feed());
        assert!(!session.needs_fetch(now, true));
        assert!(session.needs_fetch(now + FEED_REFRESH_INTERVAL, false));
        assert_eq!(
            session.publishable(id, PLAN, during).err(),
            Some(format!("{id} has no verified project."))
        );
        let event = session.active(during).unwrap().clone();
        assert_eq!(session.held_project(&event), None);
        let project = verify_project(&event, PROJECT_BYTES.to_vec()).unwrap();
        // Only the active event's project is held.
        session.hold_project(&event, project.clone(), after);
        assert_eq!(session.held_project(&event), None);
        session.hold_project(&event, project, during);
        assert!(session.held_project(&event).is_some());
        assert_eq!(session.publishable(id, PLAN, during), Ok(&event));
        assert_eq!(
            session.publishable(id, PLAN, after).err(),
            Some(format!("{id} is not the active event."))
        );
        assert!(session.publishable("other", PLAN, during).is_err());
        for undecodable in ["not json", "[]", r#"{"projectId":7}"#, "{}"] {
            assert_eq!(
                session.publishable(id, undecodable, during).err(),
                Some("The event plan is invalid.".to_owned()),
                "{undecodable}"
            );
        }
        assert_eq!(
            session
                .publishable(id, &PLAN.replace("event-project", "other-project"), during)
                .err(),
            Some(format!("The plan is not compiled from {id}'s project."))
        );
        // A project held for another hash of the event is not its verified project.
        let mut republished = event.clone();
        republished.project_sha256 = "0".repeat(64);
        assert_eq!(session.held_project(&republished), None);
        assert!(session.named(id).is_some());
    }

    #[test]
    fn a_development_event_takes_the_feeds_place_with_its_project_until_cleared() {
        let temporary = TemporaryDirectory::new("local-event");
        let folder = temporary.0.join("local-test");
        fs::create_dir_all(&folder).unwrap();
        fs::write(
            folder.join(LOCAL_EVENT_FILE),
            r#"{"id":"local-test","title":"Local","description":"d","rules":"r","startsAt":"2026-10-12T00:00:00Z","endsAt":"2026-10-19T00:00:00Z"}"#,
        )
        .unwrap();
        fs::write(folder.join(LOCAL_PROJECT_FILE), PROJECT_BYTES).unwrap();
        let local = read_local_event(&folder).unwrap();
        assert_eq!(local.event.project_url, project_url_for("local-test"));
        assert_eq!(local.event.project_sha256, PROJECT_HASH);
        assert_eq!(local.event.project_schema_version, 96);
        assert_eq!(local.event.rules.as_deref(), Some("r"));

        let after = parse_instant("2026-10-20T00:00:00Z").unwrap();
        let mut session = session_with_feed(std::time::Instant::now());
        session.set_local(local.clone());
        assert_eq!(session.active(after), Some(&local.event));
        assert!(session.publishable("local-test", PLAN, after).is_ok());
        session.clear_local();
        assert!(session.active(after).is_none());

        let renamed = temporary.0.join("renamed");
        fs::rename(&folder, &renamed).unwrap();
        assert!(read_local_event(&renamed).is_err());
        fs::rename(&renamed, &folder).unwrap();
        for (file, contents) in [
            (LOCAL_PROJECT_FILE, r#"{"projectId":"event-project"}"#),
            (
                LOCAL_EVENT_FILE,
                r#"{"id":"local-test","title":"Local","description":"d","startsAt":"2026-10-12T00:00:00Z","endsAt":"2026-10-19T00:00:00Z","projectSha256":"x"}"#,
            ),
        ] {
            let original = fs::read(folder.join(file)).unwrap();
            fs::write(folder.join(file), contents).unwrap();
            assert!(read_local_event(&folder).is_err(), "{file}");
            fs::write(folder.join(file), original).unwrap();
        }
        #[cfg(unix)]
        {
            let project = folder.join(LOCAL_PROJECT_FILE);
            let elsewhere = temporary.0.join("project.json");
            fs::rename(&project, &elsewhere).unwrap();
            std::os::unix::fs::symlink(&elsewhere, &project).unwrap();
            assert!(read_local_event(&folder).is_err());
        }
    }

    #[test]
    fn a_failed_fetch_keeps_the_held_feed_or_reads_the_cache_and_retries_on_request() {
        let now = std::time::Instant::now();
        let mut session = EventSession::default();
        session.fetch_failed(
            || verify_feed(SIGNED_FEED, FEED_SIGNATURE, TEST_PUBLIC_KEY, None).ok(),
            now,
        );
        assert_eq!(session.source(), FeedSource::Cache);
        assert_eq!(session.signed_at(), Some(FEED_SIGNED_AT));
        // Background reads wait; a panel opening retries a failed fetch at once.
        assert!(!session.needs_fetch(now, false));
        assert!(session.needs_fetch(now, true));
        let mut held = session_with_feed(now);
        held.fetch_failed(|| panic!("the held feed is kept"), now);
        assert_eq!(held.source(), FeedSource::Network);
        let mut none = EventSession::default();
        none.fetch_failed(|| None, now);
        assert_eq!(none.source(), FeedSource::None);
        assert!(!none.has_verified_feed());
    }

    #[test]
    fn a_session_without_an_event_key_holds_no_events_and_clears_the_slot() {
        let mut session = session_with_feed(std::time::Instant::now());
        session.disable();
        assert_eq!(session.source(), FeedSource::Disabled);
        assert!(session.has_verified_feed());
        assert!(session
            .active(parse_instant("2026-10-14T00:00:00Z").unwrap())
            .is_none());
    }
}
