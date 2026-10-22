//! The plan catalog: a signed index of template plans published on the catalog repository's
//! `catalog` release, each plan a file beside it that is downloaded only when added.

use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;
use std::collections::BTreeSet;

use crate::community_event::{valid_sha256, valid_slug, valid_text};
use crate::signed_feed::{sha256_hex, FeedState, SignedFeed, Verified};

// The repository whose `catalog` release publishes the index; renaming it is this one edit.
macro_rules! catalog_repository {
    () => {
        "maybe-adamant/RunPlanner-Catalog"
    };
}
pub const CATALOG_REPOSITORY: &str = catalog_repository!();
pub const CATALOG_FEED_URL: &str = concat!(
    "https://github.com/",
    catalog_repository!(),
    "/releases/download/catalog/catalog.json"
);
pub const CATALOG_FEED_SIGNATURE_URL: &str = concat!(
    "https://github.com/",
    catalog_repository!(),
    "/releases/download/catalog/catalog.json.sig"
);
/// Every entry's plan is published beside the index as `<id>.runplanner.json`.
pub const CATALOG_PLAN_URL_PREFIX: &str = concat!(
    "https://github.com/",
    catalog_repository!(),
    "/releases/download/catalog/"
);
/// Stands in the checked-in catalog public key until the owner installs the real one; an index
/// is never verified against it.
pub const CATALOG_PUBLIC_KEY_PLACEHOLDER: &str =
    "PLACEHOLDER: replace with the catalog feed public key";
pub const CATALOG_FEED_FILE_NAME: &str = "catalog.json";
pub const CATALOG_FEED_FORMAT: &str = "run-planner-catalog-feed";
pub const CATALOG_FEED_FORMAT_VERSION: u8 = 1;
pub const MAX_CATALOG_BYTES: usize = 16 * 1_048_576;
pub const MAX_CATALOG_ENTRIES: usize = 2000;
pub const MAX_CATALOG_CATEGORIES: usize = 16;
pub const MAX_CATALOG_PLAN_BYTES: usize = 1_048_576;
pub const MAX_ENTRY_ID_CHARS: usize = 64;
pub const MAX_ENTRY_TITLE_CHARS: usize = 80;
pub const MAX_ENTRY_DESCRIPTION_CHARS: usize = 200;
pub const MAX_ENTRY_AUTHOR_CHARS: usize = 64;
pub const MAX_ENTRY_TAGS: usize = 8;
pub const MAX_TAG_CHARS: usize = 24;
pub const MAX_CATEGORY_LABEL_CHARS: usize = 40;
const MAX_ROUTE_KEY_CHARS: usize = 64;
const MAX_BIOME_COUNT: u32 = 64;

/// The catalog index, signed with the catalog key.
pub const CATALOG_FEED: SignedFeed = SignedFeed {
    label: "catalog",
    file_name: CATALOG_FEED_FILE_NAME,
    url: CATALOG_FEED_URL,
    signature_url: CATALOG_FEED_SIGNATURE_URL,
    max_bytes: MAX_CATALOG_BYTES,
    cache_directory: "catalog-feed",
    cache_file: "catalog.cache",
};

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct CatalogDocument<'a> {
    format: String,
    format_version: u8,
    categories: Vec<CatalogCategory>,
    #[serde(borrow)]
    entries: Vec<&'a RawValue>,
}

/// One of the catalog's fixed categories, in the order the index lists them.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct CatalogCategory {
    pub id: String,
    pub label: String,
}

/// One template plan's metadata, with its plan file's URL, hash and schema.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct CatalogEntry {
    pub id: String,
    pub title: String,
    pub description: String,
    pub category: String,
    pub tags: Vec<String>,
    pub author: String,
    pub route_key: String,
    pub biome_count: u32,
    pub plan_schema_version: u32,
    // Absent means 0; the builder emits it only when not 0.
    #[serde(default)]
    pub plan_schema_revision: u32,
    pub plan_url: String,
    /// Lower-case hex SHA-256 of the plan file at `plan_url`.
    pub plan_sha256: String,
}

/// A verified index's categories and entries, and why any listed entry was refused.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogIndex {
    pub categories: Vec<CatalogCategory>,
    pub entries: Vec<CatalogEntry>,
    pub refused: Vec<String>,
}

pub type VerifiedCatalog = Verified<CatalogIndex>;

/// The verified catalog of this session.
pub type CatalogSession = FeedState<CatalogIndex>;

/// The only plan URL an entry may name: its own file beside the index.
pub fn plan_url_for(id: &str) -> String {
    format!("{CATALOG_PLAN_URL_PREFIX}{id}.runplanner.json")
}

/// A category label as a tag would spell it, such as "fresh-file" for "Fresh File".
fn label_tag(label: &str) -> String {
    label
        .split_whitespace()
        .collect::<Vec<_>>()
        .join("-")
        .to_lowercase()
}

fn valid_route_key(key: &str) -> bool {
    !key.is_empty()
        && key.len() <= MAX_ROUTE_KEY_CHARS
        && key
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
}

fn validate_categories(categories: &[CatalogCategory]) -> Result<(), String> {
    if categories.is_empty() || categories.len() > MAX_CATALOG_CATEGORIES {
        return Err(format!(
            "The catalog must list 1 to {MAX_CATALOG_CATEGORIES} categories."
        ));
    }
    let mut ids = BTreeSet::new();
    for category in categories {
        if !valid_slug(&category.id, MAX_TAG_CHARS)
            || !valid_text(&category.label, MAX_CATEGORY_LABEL_CHARS, false)
        {
            return Err(format!("Invalid catalog category {}.", category.id));
        }
        if !ids.insert(category.id.as_str()) {
            return Err(format!(
                "The catalog lists category {} more than once.",
                category.id
            ));
        }
    }
    Ok(())
}

impl CatalogEntry {
    pub fn validate(&self, categories: &[CatalogCategory]) -> Result<(), String> {
        if !valid_slug(&self.id, MAX_ENTRY_ID_CHARS) {
            return Err("Invalid entry id.".to_owned());
        }
        if !valid_text(&self.title, MAX_ENTRY_TITLE_CHARS, false) {
            return Err("Invalid entry title.".to_owned());
        }
        if !valid_text(&self.description, MAX_ENTRY_DESCRIPTION_CHARS, false) {
            return Err("Invalid entry description.".to_owned());
        }
        if !valid_text(&self.author, MAX_ENTRY_AUTHOR_CHARS, false) {
            return Err("Invalid entry author.".to_owned());
        }
        let category = categories
            .iter()
            .find(|category| category.id == self.category)
            .ok_or_else(|| format!("Unknown category {}.", self.category))?;
        let category_tag = label_tag(&category.label);
        let mut tags = BTreeSet::new();
        if self.tags.len() > MAX_ENTRY_TAGS
            || !self.tags.iter().all(|tag| {
                valid_slug(tag, MAX_TAG_CHARS)
                    && *tag != category.id
                    && *tag != category_tag
                    && tags.insert(tag.as_str())
            })
        {
            return Err(
                "Tags are at most 8 distinct slugs of at most 24 characters, never the category."
                    .to_owned(),
            );
        }
        if !valid_route_key(&self.route_key)
            || self.biome_count == 0
            || self.biome_count > MAX_BIOME_COUNT
            || self.plan_schema_version == 0
        {
            return Err("Invalid entry route, biome count or schema.".to_owned());
        }
        if self.plan_url != plan_url_for(&self.id) {
            return Err("The plan must be published beside the catalog.".to_owned());
        }
        if !valid_sha256(&self.plan_sha256) {
            return Err("Invalid entry plan hash.".to_owned());
        }
        Ok(())
    }
}

/// Decodes a verified index. A malformed index or category list is refused whole; within it, an
/// invalid entry, one whose plan is not its own file beside the index, or a repeated id is
/// refused alone.
pub fn decode_catalog(bytes: &[u8]) -> Result<CatalogIndex, String> {
    if bytes.len() > MAX_CATALOG_BYTES {
        return Err(format!(
            "The catalog exceeds the {MAX_CATALOG_BYTES}-byte limit."
        ));
    }
    let document: CatalogDocument =
        serde_json::from_slice(bytes).map_err(|error| format!("Invalid catalog: {error}"))?;
    if document.format != CATALOG_FEED_FORMAT
        || document.format_version != CATALOG_FEED_FORMAT_VERSION
    {
        return Err(format!(
            "The catalog must be {CATALOG_FEED_FORMAT} version {CATALOG_FEED_FORMAT_VERSION}."
        ));
    }
    validate_categories(&document.categories)?;
    if document.entries.len() > MAX_CATALOG_ENTRIES {
        return Err(format!(
            "The catalog lists more than {MAX_CATALOG_ENTRIES} entries."
        ));
    }
    let mut index = CatalogIndex {
        categories: document.categories,
        ..CatalogIndex::default()
    };
    let mut ids = BTreeSet::new();
    for raw in document.entries {
        let entry = match serde_json::from_str::<CatalogEntry>(raw.get()) {
            Ok(entry) => entry,
            Err(error) => {
                index
                    .refused
                    .push(format!("Invalid catalog entry: {error}"));
                continue;
            }
        };
        if let Err(problem) = entry.validate(&index.categories) {
            index.refused.push(format!("{}: {problem}", entry.id));
        } else if !ids.insert(entry.id.clone()) {
            index
                .refused
                .push(format!("{}: listed more than once.", entry.id));
        } else {
            index.entries.push(entry);
        }
    }
    Ok(index)
}

/// Verifies then decodes an index, refusing one signed before `not_before`.
pub fn verify_catalog(
    feed: &[u8],
    signature: &[u8],
    public_key: &str,
    not_before: Option<u64>,
) -> Result<VerifiedCatalog, String> {
    CATALOG_FEED.verify(feed, signature, public_key, not_before, decode_catalog)
}

/// Checks a downloaded plan file against its entry's signed hash, as text.
pub fn verify_plan(entry: &CatalogEntry, bytes: Vec<u8>) -> Result<String, String> {
    if sha256_hex(&bytes) != entry.plan_sha256 {
        return Err("The downloaded plan does not match the catalog.".to_owned());
    }
    String::from_utf8(bytes).map_err(|_| "The catalog plan is not text.".to_owned())
}

/// A verified entry by id, for adding its plan.
pub fn entry_named<'a>(session: &'a CatalogSession, id: &str) -> Option<&'a CatalogEntry> {
    session
        .feed()
        .and_then(|index| index.entries.iter().find(|entry| entry.id == id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_target::test_support::TemporaryDirectory;
    use crate::signed_feed::{FeedSession, FeedSource};

    // Signed by `tauri signer sign` with a throwaway key made for these fixtures; its private
    // half is not kept.
    const TEST_PUBLIC_KEY: &str = include_str!("../tests/fixtures/catalog-feed/test-key.pub");
    const SIGNED_CATALOG: &[u8] = include_bytes!("../tests/fixtures/catalog-feed/catalog.json");
    const CATALOG_SIGNATURE: &[u8] =
        include_bytes!("../tests/fixtures/catalog-feed/catalog.json.sig");
    /// A signature of the same bytes whose trusted comment names `other.json`.
    const OTHER_FILE_SIGNATURE: &[u8] =
        include_bytes!("../tests/fixtures/catalog-feed/catalog.json.other-name.sig");
    const CATALOG_SIGNED_AT: u64 = 1_792_648_259;
    /// The plan file whose hash the signed fixture names.
    const PLAN_BYTES: &[u8] = br#"{"schemaVersion":96,"projectId":"catalog-plan"}"#;
    // The event feed's test key, which did not sign the catalog fixture.
    const OTHER_PUBLIC_KEY: &str = include_str!("../tests/fixtures/event-feed/test-key.pub");

    #[test]
    fn the_placeholder_public_key_is_never_used() {
        assert!(CATALOG_FEED
            .public_key(CATALOG_PUBLIC_KEY_PLACEHOLDER)
            .is_err());
        let shipped = include_str!("../../catalog-feed.pub");
        assert!(
            shipped.trim() == CATALOG_PUBLIC_KEY_PLACEHOLDER
                || CATALOG_FEED.public_key(shipped).is_ok(),
            "catalog-feed.pub holds the placeholder or a key"
        );
        assert_eq!(
            CATALOG_FEED_URL,
            "https://github.com/maybe-adamant/RunPlanner-Catalog/releases/download/catalog/catalog.json"
        );
        assert_eq!(
            plan_url_for("sub-2m"),
            "https://github.com/maybe-adamant/RunPlanner-Catalog/releases/download/catalog/sub-2m.runplanner.json"
        );
    }

    #[test]
    fn an_index_signed_by_the_key_for_catalog_json_verifies_and_anything_else_is_refused() {
        let verified =
            verify_catalog(SIGNED_CATALOG, CATALOG_SIGNATURE, TEST_PUBLIC_KEY, None).unwrap();
        assert_eq!(verified.signed_at, CATALOG_SIGNED_AT);
        assert_eq!(verified.feed.categories.len(), 2);
        assert_eq!(verified.feed.entries[0].id, "sub-2m-underworld");
        assert_eq!(verified.feed.entries[0].plan_schema_revision, 0);
        let mut tampered = SIGNED_CATALOG.to_vec();
        tampered[10] ^= 1;
        assert!(verify_catalog(&tampered, CATALOG_SIGNATURE, TEST_PUBLIC_KEY, None).is_err());
        assert_eq!(
            verify_catalog(SIGNED_CATALOG, CATALOG_SIGNATURE, OTHER_PUBLIC_KEY, None).err(),
            Some("The catalog signature does not match.".to_owned())
        );
        assert_eq!(
            verify_catalog(SIGNED_CATALOG, OTHER_FILE_SIGNATURE, TEST_PUBLIC_KEY, None).err(),
            Some("The catalog signature is for another file.".to_owned())
        );
        assert_eq!(
            verify_catalog(
                SIGNED_CATALOG,
                CATALOG_SIGNATURE,
                TEST_PUBLIC_KEY,
                Some(CATALOG_SIGNED_AT + 1)
            )
            .err(),
            Some("The catalog is older than the one already verified.".to_owned())
        );
    }

    fn entry(id: &str, fields: &str) -> String {
        let hash = "a".repeat(64);
        let url = plan_url_for(id);
        format!(
            r#"{{"id":"{id}","title":"Title {id}","description":"One line.","category":"speedrun","tags":["skull"],"author":"Hippo","routeKey":"Underworld","biomeCount":4,"planSchemaVersion":96,"planUrl":"{url}","planSha256":"{hash}"{fields}}}"#
        )
    }

    fn index(entries: &[String]) -> String {
        format!(
            r#"{{"format":"run-planner-catalog-feed","formatVersion":1,"categories":[{{"id":"speedrun","label":"Speedrun"}},{{"id":"fresh-file","label":"Fresh File"}}],"entries":[{}]}}"#,
            entries.join(",")
        )
    }

    #[test]
    fn invalid_entries_are_refused_alone_and_a_malformed_index_whole() {
        let kept = entry("kept", "");
        let decoded = decode_catalog(
            index(&[
                kept.clone(),
                entry("revised", r#","planSchemaRevision":2"#),
                kept.replace(r#""id":"kept""#, r#""id":"Bad Id""#),
                entry("elsewhere", "").replace(
                    &plan_url_for("elsewhere"),
                    "https://example.org/elsewhere.runplanner.json",
                ),
                entry("borrowed", "").replace(&plan_url_for("borrowed"), &plan_url_for("kept")),
                entry("uncategorized", "")
                    .replace(r#""category":"speedrun""#, r#""category":"other""#),
                entry("tag-is-category", "").replace(r#"["skull"]"#, r#"["speedrun"]"#),
                entry("tag-is-label", "")
                    .replace(r#""category":"speedrun""#, r#""category":"fresh-file""#)
                    .replace(r#"["skull"]"#, r#"["fresh-file"]"#),
                entry("repeated-tags", "").replace(r#"["skull"]"#, r#"["skull","skull"]"#),
                entry("many-tags", "")
                    .replace(r#"["skull"]"#, r#"["a","b","c","d","e","f","g","h","i"]"#),
                entry("long-tag", "").replace("skull", &"t".repeat(25)),
                entry("two-lines", "").replace("One line.", "One\\nline."),
                entry("long-description", "").replace("One line.", &"d".repeat(201)),
                entry("no-biomes", "").replace(r#""biomeCount":4"#, r#""biomeCount":0"#),
                entry("bad-hash", "").replace(&"a".repeat(64), &"A".repeat(64)),
                entry("extra", r#","plan":{}"#),
                entry("no-author", "").replace(r#","author":"Hippo""#, ""),
                kept,
            ])
            .as_bytes(),
        )
        .unwrap();
        assert_eq!(
            decoded
                .entries
                .iter()
                .map(|entry| entry.id.as_str())
                .collect::<Vec<_>>(),
            ["kept", "revised"]
        );
        assert_eq!(decoded.entries[1].plan_schema_revision, 2);
        assert_eq!(decoded.refused.len(), 16, "{:?}", decoded.refused);
        assert!(decoded
            .refused
            .contains(&"kept: listed more than once.".to_owned()));
        let categories = |list: &str| {
            index(&[]).replace(
                r#"[{"id":"speedrun","label":"Speedrun"},{"id":"fresh-file","label":"Fresh File"}]"#,
                list,
            )
        };
        for invalid in [
            "not json".to_owned(),
            index(&[]).replace("run-planner-catalog-feed", "run-planner-event-feed"),
            index(&[]).replace(r#""formatVersion":1"#, r#""formatVersion":2"#),
            index(&[]).replace(r#""entries""#, r#""extra":1,"entries""#),
            categories("[]"),
            categories(r#"[{"id":"a","label":"A"},{"id":"a","label":"B"}]"#),
            categories(r#"[{"id":"Bad","label":"A"}]"#),
            categories(r#"[{"id":"a","label":"A","extra":1}]"#),
            index(&vec![entry("x", ""); MAX_CATALOG_ENTRIES + 1]),
        ] {
            assert!(
                decode_catalog(invalid.as_bytes()).is_err(),
                "{invalid:.120}"
            );
        }
    }

    #[test]
    fn a_downloaded_plan_must_match_its_signed_hash() {
        let verified =
            verify_catalog(SIGNED_CATALOG, CATALOG_SIGNATURE, TEST_PUBLIC_KEY, None).unwrap();
        let entry = &verified.feed.entries[0];
        assert_eq!(
            verify_plan(entry, PLAN_BYTES.to_vec()).as_deref(),
            Ok(std::str::from_utf8(PLAN_BYTES).unwrap())
        );
        assert_eq!(
            verify_plan(entry, b"other bytes".to_vec()),
            Err("The downloaded plan does not match the catalog.".to_owned())
        );
    }

    #[test]
    fn the_cached_index_is_verified_again_and_stands_in_for_a_failed_fetch() {
        let temporary = TemporaryDirectory::new("catalog-feed-cache");
        let directory = temporary.0.join(CATALOG_FEED.cache_directory);
        let read = || CATALOG_FEED.read_cached(&directory, TEST_PUBLIC_KEY, decode_catalog);
        assert!(read().is_err());
        CATALOG_FEED
            .cache(&directory, SIGNED_CATALOG, CATALOG_SIGNATURE)
            .unwrap();
        assert_eq!(read().unwrap().signed_at, CATALOG_SIGNED_AT);
        assert_eq!(
            CATALOG_FEED.cached_signed_at(&directory, TEST_PUBLIC_KEY),
            Some(CATALOG_SIGNED_AT)
        );

        let now = std::time::Instant::now();
        let mut session = CatalogSession::default();
        assert!(entry_named(&session, "sub-2m-underworld").is_none());
        session.fetch_failed(|| read().ok(), now);
        assert_eq!(session.source(), FeedSource::Cache);
        assert!(entry_named(&session, "sub-2m-underworld").is_some());
        assert!(!session.needs_fetch(now, false));
        assert!(session.needs_fetch(now, true));

        // Without an installed key the catalog holds nothing.
        FeedSession::disable(&mut session);
        assert_eq!(session.source(), FeedSource::Disabled);
        assert!(entry_named(&session, "sub-2m-underworld").is_none());
    }
}
