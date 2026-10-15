use serde::{Deserialize, Serialize};

/// One community event as the feed lists it: its metadata and the authored project it plays,
/// published beside the feed.
pub const MAX_EVENT_BYTES: usize = 4 * 1_048_576;
pub const MAX_EVENT_ID_CHARS: usize = 64;
pub const MAX_EVENT_TITLE_CHARS: usize = 80;
pub const MAX_EVENT_TEXT_CHARS: usize = 2000;
pub const MAX_EVENT_URL_CHARS: usize = 2048;

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct EventEntry {
    id: String,
    title: String,
    description: String,
    #[serde(default)]
    rules: Option<String>,
    starts_at: String,
    ends_at: String,
    project_url: String,
    project_sha256: String,
    project_schema_version: u32,
}

/// An event's metadata, as validated from its feed entry.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityEvent {
    pub id: String,
    pub title: String,
    pub description: String,
    pub rules: Option<String>,
    pub starts_at: String,
    pub ends_at: String,
    pub project_url: String,
    /// Lower-case hex SHA-256 of the project file at `project_url`.
    pub project_sha256: String,
    /// The authored project schema the project file is saved in.
    pub project_schema_version: u32,
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

/// A UTC instant as comparable parts: year, month, day, hour, minute, second, nanoseconds.
pub type Instant = (u32, u32, u32, u32, u32, u32, u64);

/// A UTC instant written `YYYY-MM-DDTHH:MM:SS` with optional fractional seconds and `Z`,
/// as its comparable parts.
pub fn parse_instant(text: &str) -> Option<Instant> {
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
    pub fn validate(&self) -> Result<(), String> {
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
        if !self.project_url.starts_with("https://")
            || !valid_text(&self.project_url, MAX_EVENT_URL_CHARS, false)
            || self.project_url.contains(char::is_whitespace)
        {
            return Err("Invalid event project URL.".to_owned());
        }
        if !valid_sha256(&self.project_sha256) {
            return Err("Invalid event project hash.".to_owned());
        }
        Ok(())
    }
}

/// Lower-case hex of a SHA-256 digest.
pub fn valid_sha256(hash: &str) -> bool {
    hash.len() == 64
        && hash
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

/// The UTC instant `seconds` after the Unix epoch.
pub fn instant_from_unix(seconds: u64, nanos: u32) -> Instant {
    let days = (seconds / 86_400) as i64;
    let rest = seconds % 86_400;
    // Civil date from days since 1970-01-01 (Howard Hinnant's algorithm).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let day_of_era = z - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_index = (5 * day_of_year + 2) / 153;
    let day = (day_of_year - (153 * month_index + 2) / 5 + 1) as u32;
    let month = if month_index < 10 {
        month_index + 3
    } else {
        month_index - 9
    } as u32;
    let year = (year_of_era + era * 400 + i64::from(month <= 2)) as u32;
    (
        year,
        month,
        day,
        (rest / 3600) as u32,
        (rest % 3600 / 60) as u32,
        (rest % 60) as u32,
        u64::from(nanos),
    )
}

/// Decodes and validates one feed entry.
pub fn decode_event(bytes: &[u8]) -> Result<CommunityEvent, String> {
    if bytes.len() > MAX_EVENT_BYTES {
        return Err(format!(
            "An event entry exceeds the {MAX_EVENT_BYTES}-byte limit."
        ));
    }
    let entry: EventEntry =
        serde_json::from_slice(bytes).map_err(|error| format!("Invalid event: {error}"))?;
    let event = CommunityEvent {
        id: entry.id,
        title: entry.title,
        description: entry.description,
        rules: entry.rules,
        starts_at: entry.starts_at,
        ends_at: entry.ends_at,
        project_url: entry.project_url,
        project_sha256: entry.project_sha256,
        project_schema_version: entry.project_schema_version,
    };
    event.validate()?;
    Ok(event)
}

#[cfg(test)]
pub mod test_support {
    pub const PROJECT_HASH: &str =
        "5650824531e382c27c755760f7bc6db4c5b690a5df74dc9438e26995bf2f7fbf";

    pub fn event_entry() -> String {
        format!(
            r#"{{"id":"2026-w42-staff","title":"Week 42: Staff sprint","description":"Clear the Surface.\nNo Arcana.","startsAt":"2026-10-12T00:00:00Z","endsAt":"2026-10-19T00:00:00.000Z","projectUrl":"https://example.org/e.runplanner.json","projectSha256":"{PROJECT_HASH}","projectSchemaVersion":96}}"#
        )
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::{event_entry, PROJECT_HASH};
    use super::*;

    #[test]
    fn an_event_entry_yields_its_metadata_and_project_reference() {
        assert_eq!(
            decode_event(event_entry().as_bytes()),
            Ok(CommunityEvent {
                id: "2026-w42-staff".to_owned(),
                title: "Week 42: Staff sprint".to_owned(),
                description: "Clear the Surface.\nNo Arcana.".to_owned(),
                rules: None,
                starts_at: "2026-10-12T00:00:00Z".to_owned(),
                ends_at: "2026-10-19T00:00:00.000Z".to_owned(),
                project_url: "https://example.org/e.runplanner.json".to_owned(),
                project_sha256: PROJECT_HASH.to_owned(),
                project_schema_version: 96,
            })
        );
        let with_rules = event_entry().replace(r#""startsAt""#, r#""rules":"Fear 8","startsAt""#);
        assert_eq!(
            decode_event(with_rules.as_bytes())
                .unwrap()
                .rules
                .as_deref(),
            Some("Fear 8")
        );
    }

    #[test]
    fn invalid_event_entries_are_refused() {
        let base = event_entry();
        let hash = format!(r#""projectSha256":"{PROJECT_HASH}""#);
        for (from, to) in [
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
            (r#""startsAt""#, r#""extra":1,"startsAt""#),
            (r#""startsAt""#, r#""plans":{},"startsAt""#),
            (
                r#""startsAt""#,
                r#""format":"run-planner-event","startsAt""#,
            ),
            ("https://example.org", "http://example.org"),
            (&hash, r#""projectSha256":"ABC""#),
            (
                &hash,
                &hash
                    .to_uppercase()
                    .replace("PROJECTSHA256", "projectSha256"),
            ),
            (r#","projectSchemaVersion":96"#, ""),
            (
                r#""projectSchemaVersion":96"#,
                r#""projectSchemaVersion":-1"#,
            ),
            (
                r#""projectSchemaVersion":96"#,
                r#""projectSchemaVersion":"96""#,
            ),
        ] {
            let changed = base.replace(from, to);
            assert_ne!(changed, base, "{from}");
            assert!(decode_event(changed.as_bytes()).is_err(), "{to}");
        }
        for (from, to) in [
            (
                r#","projectUrl":"https://example.org/e.runplanner.json""#,
                "",
            ),
            (&*format!(",{hash}"), ""),
        ] {
            assert!(
                decode_event(base.replace(from, to).as_bytes()).is_err(),
                "{from}"
            );
        }
        let oversized = format!("{base}{}", " ".repeat(MAX_EVENT_BYTES));
        assert!(decode_event(oversized.as_bytes()).is_err());
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
    fn unix_time_converts_to_the_same_instant_as_its_iso_form() {
        assert_eq!(instant_from_unix(0, 0), (1970, 1, 1, 0, 0, 0, 0));
        assert_eq!(
            Some(instant_from_unix(1_791_829_464, 500_000_000)),
            parse_instant("2026-10-12T18:24:24.5Z")
        );
        assert_eq!(
            Some(instant_from_unix(1_835_481_599, 0)),
            parse_instant("2028-02-29T23:59:59Z")
        );
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
}
