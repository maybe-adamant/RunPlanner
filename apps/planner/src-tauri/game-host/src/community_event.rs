use serde::de::{Deserializer, MapAccess, Visitor};
use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;
use std::collections::BTreeMap;
use std::fmt;
use std::fs;
use std::io::Read;
use std::path::Path;

/// One community event with its compiled plans keyed by module build; the event feed lists
/// these objects and a local event file holds one.
pub const EVENT_FORMAT: &str = "run-planner-event";
pub const EVENT_FORMAT_VERSION: u8 = 1;
pub const MAX_EVENT_BYTES: usize = 4 * 1_048_576;
pub const MAX_EVENT_ID_CHARS: usize = 64;
pub const MAX_EVENT_TITLE_CHARS: usize = 80;
pub const MAX_EVENT_TEXT_CHARS: usize = 2000;
pub const MAX_EVENT_URL_CHARS: usize = 2048;
pub const MAX_EVENT_PLANS: usize = 16;
const MAX_BUILD_ID_CHARS: usize = 128;

/// Why an event document yields no plan: the document is invalid, or it is valid but lists no
/// plan for this module build (a feed skips such an event rather than refusing the feed).
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EventDecodeError {
    Invalid(String),
    NoPlanForBuild,
}

impl fmt::Display for EventDecodeError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Invalid(message) => formatter.write_str(message),
            Self::NoPlanForBuild => {
                formatter.write_str("This event has no plan for this app's game module build.")
            }
        }
    }
}

fn invalid(message: impl Into<String>) -> EventDecodeError {
    EventDecodeError::Invalid(message.into())
}

/// Plans keyed by build id; a repeated key is refused rather than silently replaced.
struct Plans<'a>(BTreeMap<String, &'a RawValue>);

impl<'de: 'a, 'a> Deserialize<'de> for Plans<'a> {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct PlansVisitor<'a>(std::marker::PhantomData<&'a ()>);
        impl<'de: 'a, 'a> Visitor<'de> for PlansVisitor<'a> {
            type Value = Plans<'a>;
            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("an object of plans keyed by build id")
            }
            fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<Plans<'a>, M::Error> {
                let mut plans = BTreeMap::new();
                while let Some((key, plan)) = map.next_entry::<String, &'de RawValue>()? {
                    if plans.insert(key.clone(), plan).is_some() {
                        return Err(serde::de::Error::custom(format!(
                            "duplicate plan for build {key}"
                        )));
                    }
                }
                Ok(Plans(plans))
            }
        }
        deserializer.deserialize_map(PlansVisitor(std::marker::PhantomData))
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct EventDocument<'a> {
    format: String,
    format_version: u8,
    id: String,
    title: String,
    description: String,
    #[serde(default)]
    rules: Option<String>,
    starts_at: String,
    ends_at: String,
    #[serde(default)]
    project_url: Option<String>,
    #[serde(borrow)]
    plans: Plans<'a>,
}

/// An event's metadata, as validated from its document.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityEvent {
    pub id: String,
    pub title: String,
    pub description: String,
    pub rules: Option<String>,
    pub starts_at: String,
    pub ends_at: String,
    pub project_url: Option<String>,
}

/// An event and its plan for one module build, with the plan bytes as published.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventPlan {
    pub event: CommunityEvent,
    pub plan_json: String,
}

/// Lower-case letters, digits and single inner hyphens, such as "2026-w42-staff".
pub fn valid_event_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= MAX_EVENT_ID_CHARS
        && id
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        && !id.starts_with('-')
        && !id.ends_with('-')
        && !id.contains("--")
}

// Unicode format characters (category Cf): bidirectional controls, zero-width characters and
// other invisible marks that could disguise text.
fn is_format_char(c: char) -> bool {
    matches!(
        u32::from(c),
        0x00AD
            | 0x0600..=0x0605
            | 0x061C
            | 0x06DD
            | 0x070F
            | 0x0890..=0x0891
            | 0x08E2
            | 0x180E
            | 0x200B..=0x200F
            | 0x202A..=0x202E
            | 0x2060..=0x2064
            | 0x2066..=0x206F
            | 0xFEFF
            | 0xFFF9..=0xFFFB
            | 0x110BD
            | 0x110CD
            | 0x13430..=0x1343F
            | 0x1BCA0..=0x1BCA3
            | 0x1D173..=0x1D17A
            | 0xE0001
            | 0xE0020..=0xE007F
    )
}

/// Non-blank text within `max_chars`, without control or format characters; only multiline
/// text may hold line breaks, and never the Unicode line and paragraph separators.
pub fn valid_text(text: &str, max_chars: usize, multiline: bool) -> bool {
    !text.trim().is_empty()
        && text.chars().count() <= max_chars
        && text.chars().all(|c| {
            !is_format_char(c)
                && c != '\u{2028}'
                && c != '\u{2029}'
                && (!c.is_control() || (multiline && (c == '\n' || c == '\r')))
        })
}

/// A UTC instant written `YYYY-MM-DDTHH:MM:SS` with optional fractional seconds and `Z`,
/// as its comparable parts.
pub fn parse_instant(text: &str) -> Option<(u32, u32, u32, u32, u32, u32, u64)> {
    let bytes = text.as_bytes();
    if bytes.len() < 20 || bytes.len() > 30 || !text.is_ascii() || !text.ends_with('Z') {
        return None;
    }
    let number = |range: std::ops::Range<usize>| -> Option<u32> {
        let part = &text[range];
        part.bytes()
            .all(|byte| byte.is_ascii_digit())
            .then(|| part.parse().ok())
            .flatten()
    };
    let separators = [(4, b'-'), (7, b'-'), (10, b'T'), (13, b':'), (16, b':')];
    if separators.iter().any(|&(at, byte)| bytes[at] != byte) {
        return None;
    }
    let (year, month, day) = (number(0..4)?, number(5..7)?, number(8..10)?);
    let (hour, minute, second) = (number(11..13)?, number(14..16)?, number(17..19)?);
    let fraction = match &text[19..text.len() - 1] {
        "" => 0,
        tail => {
            let digits = tail.strip_prefix('.')?;
            if digits.is_empty() || digits.len() > 9 || !digits.bytes().all(|b| b.is_ascii_digit())
            {
                return None;
            }
            format!("{digits:0<9}").parse().ok()?
        }
    };
    let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
    let days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => return None,
    };
    (year >= 2000 && (1..=days).contains(&day) && hour < 24 && minute < 60 && second < 60)
        .then_some((year, month, day, hour, minute, second, fraction))
}

impl CommunityEvent {
    fn validate(&self) -> Result<(), String> {
        if !valid_event_id(&self.id) {
            return Err("Invalid event id.".to_owned());
        }
        if !valid_text(&self.title, MAX_EVENT_TITLE_CHARS, false) {
            return Err("Invalid event title.".to_owned());
        }
        let long_texts = [Some(&self.description), self.rules.as_ref()];
        if !long_texts
            .into_iter()
            .flatten()
            .all(|text| valid_text(text, MAX_EVENT_TEXT_CHARS, true))
        {
            return Err("Invalid event description or rules.".to_owned());
        }
        let (Some(starts), Some(ends)) =
            (parse_instant(&self.starts_at), parse_instant(&self.ends_at))
        else {
            return Err("Event times must be UTC ISO 8601 instants.".to_owned());
        };
        if ends <= starts {
            return Err("An event must end after it starts.".to_owned());
        }
        if let Some(url) = &self.project_url {
            if !url.starts_with("https://")
                || !valid_text(url, MAX_EVENT_URL_CHARS, false)
                || url.contains(char::is_whitespace)
            {
                return Err("Invalid event project URL.".to_owned());
            }
        }
        Ok(())
    }
}

/// Decodes one event document and selects its plan for `build_id`.
pub fn decode_event(bytes: &[u8], build_id: &str) -> Result<EventPlan, EventDecodeError> {
    if bytes.len() > MAX_EVENT_BYTES {
        return Err(invalid(format!(
            "The event file exceeds the {MAX_EVENT_BYTES}-byte limit."
        )));
    }
    let document: EventDocument = serde_json::from_slice(bytes)
        .map_err(|error| invalid(format!("Invalid event file: {error}")))?;
    if document.format != EVENT_FORMAT || document.format_version != EVENT_FORMAT_VERSION {
        return Err(invalid(format!(
            "The event file must be {EVENT_FORMAT} version {EVENT_FORMAT_VERSION}."
        )));
    }
    let plans = document.plans.0;
    let event = CommunityEvent {
        id: document.id,
        title: document.title,
        description: document.description,
        rules: document.rules,
        starts_at: document.starts_at,
        ends_at: document.ends_at,
        project_url: document.project_url,
    };
    event.validate().map_err(invalid)?;
    if plans.is_empty()
        || plans.len() > MAX_EVENT_PLANS
        || plans
            .keys()
            .any(|key| !valid_text(key, MAX_BUILD_ID_CHARS, false))
    {
        return Err(invalid(format!(
            "An event lists between 1 and {MAX_EVENT_PLANS} plans keyed by module build."
        )));
    }
    if plans.values().any(|plan| !plan.get().starts_with('{')) {
        return Err(invalid("An event plan must be a JSON object."));
    }
    let plan = plans
        .get(build_id)
        .ok_or(EventDecodeError::NoPlanForBuild)?;
    Ok(EventPlan {
        event,
        plan_json: plan.get().to_owned(),
    })
}

/// Reads a local event file within the event bound, without following a link.
pub fn read_event_file(path: &Path, build_id: &str) -> Result<EventPlan, EventDecodeError> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| invalid(format!("could not read event file: {error}")))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(invalid("The event file must be a regular file."));
    }
    let mut bytes = Vec::new();
    fs::File::open(path)
        .and_then(|file| {
            file.take(MAX_EVENT_BYTES as u64 + 1)
                .read_to_end(&mut bytes)
        })
        .map_err(|error| invalid(format!("could not read event file: {error}")))?;
    decode_event(&bytes, build_id)
}

#[cfg(test)]
pub mod test_support {
    pub const EVENT_PLAN: &str = r#"{"format":"run-planner-execution","catalogVersion":"test-catalog","projectId":"event-project","planFingerprint":"event-print","routeKey":"Surface","extent":{"biomeKeys":["N","O"]}}"#;

    pub fn event_document(build_id: &str) -> String {
        format!(
            r#"{{"format":"run-planner-event","formatVersion":1,"id":"2026-w42-staff","title":"Week 42: Staff sprint","description":"Clear the Surface.\nNo Arcana.","startsAt":"2026-10-12T00:00:00Z","endsAt":"2026-10-19T00:00:00.000Z","plans":{{"older-build":{{}},"{build_id}":{EVENT_PLAN}}}}}"#
        )
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::{event_document, EVENT_PLAN};
    use super::*;
    use crate::game_target::test_support::TemporaryDirectory;

    #[test]
    fn an_event_document_yields_its_plan_for_the_build_with_the_bytes_kept() {
        let decoded = decode_event(event_document("b1").as_bytes(), "b1").unwrap();
        assert_eq!(decoded.plan_json, EVENT_PLAN);
        assert_eq!(
            decoded.event,
            CommunityEvent {
                id: "2026-w42-staff".to_owned(),
                title: "Week 42: Staff sprint".to_owned(),
                description: "Clear the Surface.\nNo Arcana.".to_owned(),
                rules: None,
                starts_at: "2026-10-12T00:00:00Z".to_owned(),
                ends_at: "2026-10-19T00:00:00.000Z".to_owned(),
                project_url: None,
            }
        );
        assert_eq!(
            decode_event(event_document("b1").as_bytes(), "b2"),
            Err(EventDecodeError::NoPlanForBuild)
        );
        let with_extras = event_document("b1").replace(
            r#""plans""#,
            r#""rules":"Fear 8","projectUrl":"https://example.org/e.runplanner.json","plans""#,
        );
        let decoded = decode_event(with_extras.as_bytes(), "b1").unwrap();
        assert_eq!(decoded.event.rules.as_deref(), Some("Fear 8"));
        assert!(decoded.event.project_url.is_some());
    }

    #[test]
    fn invalid_event_documents_are_refused() {
        let base = event_document("b1");
        for (from, to) in [
            (r#""formatVersion":1"#, r#""formatVersion":2"#),
            (r#""run-planner-event""#, r#""run-planner-slot""#),
            (r#""2026-w42-staff""#, r#""Week 42""#),
            (r#""2026-w42-staff""#, r#""-w42""#),
            (r#""2026-w42-staff""#, r#""""#),
            (r#""Week 42: Staff sprint""#, r#""  ""#),
            (r#""Week 42: Staff sprint""#, r#""Line\nbreak""#),
            (r#""2026-10-19T00:00:00.000Z""#, r#""2026-10-11T00:00:00Z""#),
            (r#""2026-10-19T00:00:00.000Z""#, r#""2026-10-19""#),
            (
                r#""2026-10-19T00:00:00.000Z""#,
                r#""2026-10-19T00:00:00+02:00""#,
            ),
            (r#""2026-10-12T00:00:00Z""#, r#""2026-02-30T00:00:00Z""#),
            (r#""2026-10-12T00:00:00Z""#, r#""2026-10-12T24:00:00Z""#),
            (r#""plans""#, r#""extra":1,"plans""#),
            (r#""plans""#, r#""projectUrl":"http://example.org","plans""#),
        ] {
            let changed = base.replace(from, to);
            assert_ne!(changed, base, "{from}");
            assert!(decode_event(changed.as_bytes(), "b1").is_err(), "{to}");
        }
        let no_plans = base.replace(
            &format!(r#"{{"older-build":{{}},"b1":{EVENT_PLAN}}}"#),
            "{}",
        );
        assert!(decode_event(no_plans.as_bytes(), "b1").is_err());
        let array_plan = base.replace(EVENT_PLAN, "[]");
        assert!(decode_event(array_plan.as_bytes(), "b1").is_err());
        let oversized = format!("{base}{}", " ".repeat(MAX_EVENT_BYTES));
        assert!(decode_event(oversized.as_bytes(), "b1").is_err());
        let duplicate = base.replace(r#""older-build":{}"#, &format!(r#""b1":{EVENT_PLAN}"#));
        assert!(matches!(
            decode_event(duplicate.as_bytes(), "b1"),
            Err(EventDecodeError::Invalid(message)) if message.contains("duplicate plan for build b1")
        ));
        // An invalid document is refused even for a build it has no plan for.
        let invalid_title = base.replace("Week 42: Staff sprint", " ");
        assert!(matches!(
            decode_event(invalid_title.as_bytes(), "b2"),
            Err(EventDecodeError::Invalid(_))
        ));
    }

    #[test]
    fn text_refuses_invisible_format_characters_and_unicode_separators() {
        assert!(valid_text("Week 42: Mélinoë", 80, false));
        assert!(valid_text("line\nbreak", 80, true));
        for text in [
            "Week\u{202E}42",
            "Week\u{200B}42",
            "Week\u{2066}42",
            "Week\u{FEFF}",
            "Week\u{E0041}",
            "Line\u{2028}break",
            "Para\u{2029}graph",
        ] {
            assert!(!valid_text(text, 80, false), "{text:?}");
            assert!(!valid_text(text, 80, true), "{text:?}");
        }
        assert!(!valid_text("line\nbreak", 80, false));
    }

    #[test]
    fn instants_are_utc_iso_8601_with_optional_fractions() {
        assert!(parse_instant("2028-02-29T23:59:59Z").is_some());
        assert!(parse_instant("2026-10-19T00:00:00.5Z") > parse_instant("2026-10-19T00:00:00Z"));
        for invalid in [
            "2027-02-29T00:00:00Z",
            "2026-13-01T00:00:00Z",
            "2026-10-12 00:00:00Z",
            "2026-10-12T00:00:00.Z",
            "2026-10-12T00:00:60Z",
            "2026-10-12T00:00:00z",
            "+2026-10-12T00:00:00Z",
        ] {
            assert_eq!(parse_instant(invalid), None, "{invalid}");
        }
    }

    #[test]
    fn a_local_event_file_is_read_without_following_links() {
        let temporary = TemporaryDirectory::new("event-file");
        let path = temporary.0.join("event.json");
        fs::write(&path, event_document("b1")).unwrap();
        assert_eq!(read_event_file(&path, "b1").unwrap().plan_json, EVENT_PLAN);
        assert!(read_event_file(&temporary.0.join("missing.json"), "b1").is_err());
        #[cfg(unix)]
        {
            let link = temporary.0.join("link.json");
            std::os::unix::fs::symlink(&path, &link).unwrap();
            assert_eq!(
                read_event_file(&link, "b1"),
                Err(EventDecodeError::Invalid(
                    "The event file must be a regular file.".to_owned()
                ))
            );
        }
    }
}
