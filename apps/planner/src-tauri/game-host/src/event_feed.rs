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
use crate::community_event::{decode_event, EventDecodeError, EventPlan, Instant};

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
pub const EVENT_FEED_FORMAT_VERSION: u8 = 1;
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

/// The events a verified feed offers this module build, and why any listed event was refused.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct DecodedFeed {
    pub events: Vec<EventPlan>,
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

/// Decodes a verified feed for `build_id`. A malformed feed is refused whole; within it, an
/// invalid event, one without its own project file and hash, or a repeated id is refused
/// alone, and a valid event without a plan for this build is skipped.
pub fn decode_feed(bytes: &[u8], build_id: &str) -> Result<DecodedFeed, String> {
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
        match decode_event(raw.get().as_bytes(), build_id) {
            Ok(plan) => {
                let id = plan.event.id.clone();
                if project_url(&plan).is_err() || plan.event.project_sha256.is_none() {
                    decoded.refused.push(format!(
                        "{id}: the project must be published beside the feed with its hash."
                    ));
                } else if !ids.insert(id.clone()) {
                    decoded
                        .refused
                        .push(format!("{id}: listed more than once."));
                } else {
                    decoded.events.push(plan);
                }
            }
            Err(EventDecodeError::NoPlanForBuild) => {}
            Err(EventDecodeError::Invalid(message)) => decoded.refused.push(message),
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
    build_id: &str,
    not_before: Option<u64>,
) -> Result<VerifiedFeed, String> {
    let signed_at = verify_signature(feed, signature, public_key)?;
    if not_before.is_some_and(|earliest| signed_at < earliest) {
        return Err("The event feed is older than the one already verified.".to_owned());
    }
    Ok(VerifiedFeed {
        feed: decode_feed(feed, build_id)?,
        signed_at,
    })
}

fn window(plan: &EventPlan) -> Option<(Instant, Instant)> {
    use crate::community_event::parse_instant;
    Some((
        parse_instant(&plan.event.starts_at)?,
        parse_instant(&plan.event.ends_at)?,
    ))
}

/// The one active event: its window contains `now`; of several, the latest start wins, then
/// the greatest id.
pub fn select_active(events: &[EventPlan], now: Instant) -> Option<&EventPlan> {
    events
        .iter()
        .filter_map(|plan| {
            let (starts, ends) = window(plan)?;
            (starts <= now && now < ends).then_some((starts, plan))
        })
        .max_by(|(a, left), (b, right)| a.cmp(b).then(left.event.id.cmp(&right.event.id)))
        .map(|(_, plan)| plan)
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

/// The cached feed, verified again, since application data is not trusted more than the network.
pub fn read_cached_feed(
    directory: &Path,
    public_key: &str,
    build_id: &str,
) -> Result<VerifiedFeed, String> {
    let bytes = read_bounded(
        &directory.join(CACHED_FEED_FILE),
        MAX_FEED_SIGNATURE_BYTES + 1 + MAX_FEED_BYTES,
    )
    .ok_or_else(|| "No cached event feed.".to_owned())?;
    let split = bytes
        .iter()
        .position(|&byte| byte == b'\n')
        .ok_or_else(|| "The cached event feed is malformed.".to_owned())?;
    verify_feed(
        &bytes[split + 1..],
        &bytes[..split],
        public_key,
        build_id,
        None,
    )
}

/// Checks a downloaded project file against its event's signed hash.
pub fn verify_project(plan: &EventPlan, bytes: &[u8]) -> Result<(), String> {
    let expected = plan
        .event
        .project_sha256
        .as_deref()
        .ok_or_else(|| "This event's project has no hash.".to_owned())?;
    let actual: String = Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    (actual == expected)
        .then_some(())
        .ok_or_else(|| "The downloaded project does not match the event.".to_owned())
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

/// The host's verified events for this session. Only an event this session holds can be
/// written to the event slot: callers name it by id and never supply its plan or metadata.
#[derive(Debug)]
pub struct EventSession {
    feed: Option<DecodedFeed>,
    signed_at: Option<u64>,
    source: FeedSource,
    checked_at: Option<std::time::Instant>,
    last_failed: bool,
    /// A development event file, which takes the place of the feed's event.
    local: Option<EventPlan>,
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

    pub fn set_local(&mut self, plan: EventPlan) {
        self.local = Some(plan);
    }

    pub fn clear_local(&mut self) {
        self.local = None;
    }

    /// The development event when one is loaded, else the feed's active event at `now`.
    pub fn active(&self, now: Instant) -> Option<&EventPlan> {
        self.local.as_ref().or_else(|| {
            self.feed
                .as_ref()
                .and_then(|feed| select_active(&feed.events, now))
        })
    }

    /// The active event, only when it is the one named, with the plan named by fingerprint.
    pub fn active_named(
        &self,
        id: &str,
        plan_fingerprint: &str,
        now: Instant,
    ) -> Result<&EventPlan, String> {
        let plan = self
            .active(now)
            .filter(|plan| plan.event.id == id)
            .ok_or_else(|| format!("{id} is not the active event."))?;
        (plan_fingerprint_of(&plan.plan_json).as_deref() == Some(plan_fingerprint))
            .then_some(plan)
            .ok_or_else(|| format!("{id} has another plan now."))
    }

    /// Any verified event by id, for downloading its project.
    pub fn named(&self, id: &str) -> Option<&EventPlan> {
        self.local
            .iter()
            .chain(self.feed.iter().flat_map(|feed| feed.events.iter()))
            .find(|plan| plan.event.id == id)
    }
}

/// The `planFingerprint` a plan's JSON names.
pub fn plan_fingerprint_of(plan_json: &str) -> Option<String> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Identity {
        plan_fingerprint: String,
    }
    serde_json::from_str::<Identity>(plan_json)
        .ok()
        .map(|identity| identity.plan_fingerprint)
}

/// The project URL of an event, only when it is exactly the event's own file beside the feed.
pub fn project_url(plan: &EventPlan) -> Result<&str, String> {
    plan.event
        .project_url
        .as_deref()
        .filter(|url| *url == project_url_for(&plan.event.id))
        .ok_or_else(|| "This event has no project published beside the feed.".to_owned())
}

#[cfg(test)]
pub mod test_support {
    pub const TEST_PUBLIC_KEY: &str = include_str!("../tests/fixtures/event-feed/test-key.pub");
    pub const SIGNED_FEED: &[u8] = include_bytes!("../tests/fixtures/event-feed/events.json");
    pub const FEED_SIGNATURE: &[u8] =
        include_bytes!("../tests/fixtures/event-feed/events.json.sig");
    /// A signature of the same bytes whose trusted comment names `other.json`.
    pub const OTHER_FILE_SIGNATURE: &[u8] =
        include_bytes!("../tests/fixtures/event-feed/events.json.other-name.sig");
    pub const FEED_SIGNED_AT: u64 = 1_791_832_588;
    pub const FEED_BUILD: &str = "test-build";
    /// The project file whose hash the signed fixture names.
    pub const PROJECT_BYTES: &[u8] = b"event project bytes";
}

#[cfg(test)]
mod tests {
    use super::test_support::*;
    use super::*;
    use crate::community_event::parse_instant;
    use crate::community_event::test_support::EVENT_PLAN;
    use crate::game_target::test_support::TemporaryDirectory;

    // A real minisign key (the app updater's) that did not sign the test fixture.
    const OTHER_PUBLIC_KEY: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEVEOTZDOEExM0I5OUYyN0UKUldSKzhwazdvY2lXN2MzMVNGR1pQQWFGOTV2V1l5dEg5Yis1dzRYTDk2VWFldFdweER3Z3huRjcK";
    const HASH: &str = "5650824531e382c27c755760f7bc6db4c5b690a5df74dc9438e26995bf2f7fbf";

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
        let verified = verify_feed(
            SIGNED_FEED,
            FEED_SIGNATURE,
            TEST_PUBLIC_KEY,
            FEED_BUILD,
            None,
        )
        .unwrap();
        assert_eq!(verified.signed_at, FEED_SIGNED_AT);
        assert_eq!(verified.feed.events[0].event.id, "2026-w42-staff");
        // A feed signed before the one already verified is a replay.
        assert_eq!(
            verify_feed(
                SIGNED_FEED,
                FEED_SIGNATURE,
                TEST_PUBLIC_KEY,
                FEED_BUILD,
                Some(FEED_SIGNED_AT + 1)
            ),
            Err("The event feed is older than the one already verified.".to_owned())
        );
        assert!(verify_feed(
            SIGNED_FEED,
            FEED_SIGNATURE,
            TEST_PUBLIC_KEY,
            FEED_BUILD,
            Some(FEED_SIGNED_AT)
        )
        .is_ok());
    }

    fn event(id: &str, starts: &str, ends: &str, build: &str, url: &str) -> String {
        format!(
            r#"{{"format":"run-planner-event","formatVersion":1,"id":"{id}","title":"Title {id}","description":"d","startsAt":"{starts}","endsAt":"{ends}","projectUrl":"{url}","projectSha256":"{HASH}","plans":{{"{build}":{EVENT_PLAN}}}}}"#
        )
    }

    fn feed(events: &[String]) -> String {
        format!(
            r#"{{"format":"run-planner-event-feed","formatVersion":1,"events":[{}]}}"#,
            events.join(",")
        )
    }

    #[test]
    fn invalid_events_are_refused_alone_and_events_for_other_builds_skipped() {
        let week = |id: &str, build: &str, url: &str| {
            event(
                id,
                "2026-10-12T00:00:00Z",
                "2026-10-19T00:00:00Z",
                build,
                url,
            )
        };
        let prefix = EVENT_PROJECT_URL_PREFIX;
        let decoded = decode_feed(
            feed(&[
                week("kept", "b1", &project_url_for("kept")),
                week("other-build", "b0", &project_url_for("other-build")),
                week("Bad Id", "b1", &project_url_for("bad")),
                week("elsewhere", "b1", "https://example.org/e.runplanner.json"),
                week("nested", "b1", &format!("{prefix}a/nested.runplanner.json")),
                week("borrowed", "b1", &project_url_for("kept")),
                week(
                    "dotted",
                    "b1",
                    &format!("{prefix}%2e%2e%2Fdotted.runplanner.json"),
                ),
                week(
                    "slashed",
                    "b1",
                    &format!("{prefix}..\\\\slashed.runplanner.json"),
                ),
                week(
                    "queried",
                    "b1",
                    &format!("{}?x=1", project_url_for("queried")),
                ),
                week("kept", "b1", &project_url_for("kept")),
                week("no-url", "b1", "").replace(r#","projectUrl":"""#, ""),
                week("no-hash", "b1", &project_url_for("no-hash"))
                    .replace(&format!(r#","projectSha256":"{HASH}""#), ""),
            ])
            .as_bytes(),
            "b1",
        )
        .unwrap();
        assert_eq!(
            decoded
                .events
                .iter()
                .map(|plan| plan.event.id.as_str())
                .collect::<Vec<_>>(),
            ["kept"]
        );
        assert_eq!(decoded.refused.len(), 10, "{:?}", decoded.refused);
        assert!(decoded
            .refused
            .contains(&"kept: listed more than once.".to_owned()));
        for invalid in [
            "not json".to_owned(),
            feed(&[]).replace("run-planner-event-feed", "run-planner-event"),
            feed(&[]).replace(r#""formatVersion":1"#, r#""formatVersion":2"#),
            feed(&[]).replace(r#""events""#, r#""extra":1,"events""#),
            feed(&vec![
                week("x", "b1", &project_url_for("x"));
                MAX_FEED_EVENTS + 1
            ]),
        ] {
            assert!(
                decode_feed(invalid.as_bytes(), "b1").is_err(),
                "{invalid:.80}"
            );
        }
        assert_eq!(
            decode_feed(feed(&[]).as_bytes(), "b1"),
            Ok(DecodedFeed::default())
        );
    }

    #[test]
    fn the_active_event_is_the_latest_started_whose_window_holds_now() {
        let at_url = |id: &str| project_url_for(id);
        let events = decode_feed(
            feed(&[
                event(
                    "past",
                    "2026-10-01T00:00:00Z",
                    "2026-10-08T00:00:00Z",
                    "b",
                    &at_url("past"),
                ),
                event(
                    "early",
                    "2026-10-10T00:00:00Z",
                    "2026-10-20T00:00:00Z",
                    "b",
                    &at_url("early"),
                ),
                event(
                    "late",
                    "2026-10-12T00:00:00Z",
                    "2026-10-19T00:00:00Z",
                    "b",
                    &at_url("late"),
                ),
                event(
                    "same-a",
                    "2026-10-26T00:00:00Z",
                    "2026-11-02T00:00:00Z",
                    "b",
                    &at_url("same-a"),
                ),
                event(
                    "same-b",
                    "2026-10-26T00:00:00Z",
                    "2026-11-02T00:00:00Z",
                    "b",
                    &at_url("same-b"),
                ),
                event(
                    "next",
                    "2026-10-19T00:00:00Z",
                    "2026-10-26T00:00:00Z",
                    "b",
                    &at_url("next"),
                ),
            ])
            .as_bytes(),
            "b",
        )
        .unwrap()
        .events;
        let at = |text: &str| parse_instant(text).unwrap();
        let active = |now: &str| select_active(&events, at(now)).map(|plan| plan.event.id.as_str());
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
        assert!(read_cached_feed(&directory, TEST_PUBLIC_KEY, FEED_BUILD).is_err());
        cache_feed(&directory, SIGNED_FEED, FEED_SIGNATURE).unwrap();
        let cached = read_cached_feed(&directory, TEST_PUBLIC_KEY, FEED_BUILD).unwrap();
        assert_eq!(cached.signed_at, FEED_SIGNED_AT);
        assert_eq!(cached.feed.events.len(), 1);
        let path = directory.join(CACHED_FEED_FILE);
        let mut tampered = fs::read(&path).unwrap();
        let last = tampered.len() - 2;
        tampered[last] ^= 1;
        fs::write(&path, tampered).unwrap();
        assert!(read_cached_feed(&directory, TEST_PUBLIC_KEY, FEED_BUILD).is_err());
        // A signature that does not belong to the cached feed reads as no cache.
        let mut mismatched = OTHER_FILE_SIGNATURE.to_vec();
        mismatched.push(b'\n');
        mismatched.extend_from_slice(SIGNED_FEED);
        fs::write(&path, mismatched).unwrap();
        assert!(read_cached_feed(&directory, TEST_PUBLIC_KEY, FEED_BUILD).is_err());
        fs::write(&path, SIGNED_FEED).unwrap();
        assert!(read_cached_feed(&directory, TEST_PUBLIC_KEY, FEED_BUILD).is_err());
    }

    #[test]
    fn a_downloaded_project_must_match_its_signed_hash() {
        let verified = verify_feed(
            SIGNED_FEED,
            FEED_SIGNATURE,
            TEST_PUBLIC_KEY,
            FEED_BUILD,
            None,
        )
        .unwrap();
        let plan = &verified.feed.events[0];
        assert_eq!(
            project_url(plan),
            Ok("https://github.com/maybe-adamant/RunPlanner-Events/releases/download/events/2026-w42-staff.runplanner.json")
        );
        assert_eq!(verify_project(plan, PROJECT_BYTES), Ok(()));
        assert_eq!(
            verify_project(plan, b"other bytes"),
            Err("The downloaded project does not match the event.".to_owned())
        );
        let mut unhashed = plan.clone();
        unhashed.event.project_sha256 = None;
        assert!(verify_project(&unhashed, PROJECT_BYTES).is_err());
    }

    fn session_with_feed(now: std::time::Instant) -> EventSession {
        let mut session = EventSession::default();
        session.accept_fetched(
            verify_feed(
                SIGNED_FEED,
                FEED_SIGNATURE,
                TEST_PUBLIC_KEY,
                FEED_BUILD,
                None,
            )
            .unwrap(),
            now,
        );
        session
    }

    #[test]
    fn only_the_active_verified_event_and_its_plan_can_be_named_for_the_event_slot() {
        let now = std::time::Instant::now();
        let during = parse_instant("2026-10-14T00:00:00Z").unwrap();
        let after = parse_instant("2026-10-20T00:00:00Z").unwrap();
        let empty = EventSession::default();
        assert!(empty.needs_fetch(now, false));
        assert!(!empty.has_verified_feed());
        assert!(empty
            .active_named("2026-w42-staff", "event-print", during)
            .is_err());
        let mut session = session_with_feed(now);
        assert_eq!(session.source(), FeedSource::Network);
        assert_eq!(session.signed_at(), Some(FEED_SIGNED_AT));
        assert!(session.has_verified_feed());
        assert!(!session.needs_fetch(now, true));
        assert!(session.needs_fetch(now + FEED_REFRESH_INTERVAL, false));
        assert!(session
            .active_named("2026-w42-staff", "event-print", during)
            .is_ok());
        assert_eq!(
            session.active_named("2026-w42-staff", "other-print", during),
            Err("2026-w42-staff has another plan now.".to_owned())
        );
        assert!(session
            .active_named("other", "event-print", during)
            .is_err());
        assert_eq!(
            session.active_named("2026-w42-staff", "event-print", after),
            Err("2026-w42-staff is not the active event.".to_owned())
        );
        assert!(session.named("2026-w42-staff").is_some());

        // A development event takes the feed's place until cleared.
        let mut local = session.named("2026-w42-staff").unwrap().clone();
        local.event.id = "local-test".to_owned();
        session.set_local(local);
        assert_eq!(session.active(after).unwrap().event.id, "local-test");
        session.clear_local();
        assert!(session.active(after).is_none());
    }

    #[test]
    fn a_failed_fetch_keeps_the_held_feed_or_reads_the_cache_and_retries_on_request() {
        let now = std::time::Instant::now();
        let mut session = EventSession::default();
        session.fetch_failed(
            || {
                verify_feed(
                    SIGNED_FEED,
                    FEED_SIGNATURE,
                    TEST_PUBLIC_KEY,
                    FEED_BUILD,
                    None,
                )
                .ok()
            },
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
