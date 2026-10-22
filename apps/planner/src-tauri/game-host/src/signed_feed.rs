//! A signed JSON feed replaced in place on a GitHub release, as the community events and the
//! plan catalog are published: its minisign signature, the copy kept for offline starts and the
//! session's verified feed. Each feed names its own file, key and decoder.

use base64::Engine;
use minisign_verify::{PublicKey, Signature};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Read;
use std::path::Path;

use crate::atomic_file;

pub const MAX_FEED_SIGNATURE_BYTES: usize = 4096;
/// How long a successful feed read stands before the next background fetch.
pub const FEED_REFRESH_INTERVAL: std::time::Duration = std::time::Duration::from_secs(10 * 60);

/// One signed feed: where it is published and how it is named, checked and kept.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SignedFeed {
    /// Names the feed in messages, such as "event feed".
    pub label: &'static str,
    /// The signed file name the signature's trusted comment must name.
    pub file_name: &'static str,
    pub url: &'static str,
    pub signature_url: &'static str,
    pub max_bytes: usize,
    /// The folder in application data holding the cached copy.
    pub cache_directory: &'static str,
    /// The last verified feed with its signature: the signature file's line, a line break, then
    /// the feed bytes, written as one file.
    pub cache_file: &'static str,
}

/// A decoded feed with the time its signature's trusted comment records.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Verified<T> {
    pub feed: T,
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

impl SignedFeed {
    /// The feed's public key as checked in, refused while it is still a placeholder.
    pub fn public_key<'a>(&self, checked_in: &'a str) -> Result<&'a str, String> {
        let key = checked_in.trim();
        if key.is_empty() || key.starts_with("PLACEHOLDER") {
            return Err(format!(
                "No {} public key is installed, so it is off.",
                self.label
            ));
        }
        Ok(key)
    }

    /// Verifies `data` against a signature file as `tauri signer sign` writes it (base64 of a
    /// prehashed minisign signature), with the public key in the same base64 form. The trusted
    /// comment, covered by the signature, must name this feed's file; its timestamp is returned.
    pub fn verify_signature(
        &self,
        data: &[u8],
        signature_file: &[u8],
        public_key: &str,
    ) -> Result<u64, String> {
        let label = self.label;
        if signature_file.len() > MAX_FEED_SIGNATURE_BYTES {
            return Err(format!("The {label} signature is too large."));
        }
        let key = PublicKey::decode(&base64_text(public_key.as_bytes(), "public key")?)
            .map_err(|_| format!("The {label} public key is invalid."))?;
        let signature =
            Signature::decode(&base64_text(signature_file, &format!("{label} signature"))?)
                .map_err(|_| format!("The {label} signature is invalid."))?;
        key.verify(data, &signature, false)
            .map_err(|_| format!("The {label} signature does not match."))?;
        let comment = signature.trusted_comment();
        let field = |name: &str| {
            comment
                .split('\t')
                .find_map(|part| part.strip_prefix(name).map(str::to_owned))
        };
        if field("file:").as_deref() != Some(self.file_name) {
            return Err(format!("The {label} signature is for another file."));
        }
        field("timestamp:")
            .and_then(|seconds| seconds.parse().ok())
            .ok_or_else(|| format!("The {label} signature has no timestamp."))
    }

    /// Verifies then decodes a feed, refusing one signed before `not_before` (a replay of an
    /// older feed than the one already verified).
    pub fn verify<T>(
        &self,
        feed: &[u8],
        signature: &[u8],
        public_key: &str,
        not_before: Option<u64>,
        decode: impl FnOnce(&[u8]) -> Result<T, String>,
    ) -> Result<Verified<T>, String> {
        let signed_at = self.verify_signature(feed, signature, public_key)?;
        if not_before.is_some_and(|earliest| signed_at < earliest) {
            return Err(format!(
                "The {} is older than the one already verified.",
                self.label
            ));
        }
        Ok(Verified {
            feed: decode(feed)?,
            signed_at,
        })
    }

    /// Keeps a verified feed and its signature together, in one atomically replaced file.
    pub fn cache(&self, directory: &Path, feed: &[u8], signature: &[u8]) -> Result<(), String> {
        let label = self.label;
        let line = std::str::from_utf8(signature)
            .ok()
            .map(str::trim)
            .filter(|line| !line.contains('\n'))
            .ok_or_else(|| format!("The {label} signature is not one line."))?;
        fs::create_dir_all(directory)
            .map_err(|error| format!("could not create the {label} cache: {error}"))?;
        let mut bytes = Vec::with_capacity(line.len() + 1 + feed.len());
        bytes.extend_from_slice(line.as_bytes());
        bytes.push(b'\n');
        bytes.extend_from_slice(feed);
        atomic_file::write(
            &directory.join(self.cache_file),
            &bytes,
            &format!("{label} cache"),
        )
    }

    // The cached signature line and feed bytes, unverified.
    fn read_cached_parts(&self, directory: &Path) -> Result<(Vec<u8>, usize), String> {
        let label = self.label;
        let bytes = read_bounded(
            &directory.join(self.cache_file),
            MAX_FEED_SIGNATURE_BYTES + 1 + self.max_bytes,
        )
        .ok_or_else(|| format!("No cached {label}."))?;
        let split = bytes
            .iter()
            .position(|&byte| byte == b'\n')
            .ok_or_else(|| format!("The cached {label} is malformed."))?;
        Ok((bytes, split))
    }

    /// The cached feed, verified again, since application data is not trusted more than the
    /// network.
    pub fn read_cached<T>(
        &self,
        directory: &Path,
        public_key: &str,
        decode: impl FnOnce(&[u8]) -> Result<T, String>,
    ) -> Result<Verified<T>, String> {
        let (bytes, split) = self.read_cached_parts(directory)?;
        self.verify(
            &bytes[split + 1..],
            &bytes[..split],
            public_key,
            None,
            decode,
        )
    }

    /// When the cached feed was signed, once its signature verifies, even when it no longer
    /// decodes (an older format): a fetched feed must not predate it.
    pub fn cached_signed_at(&self, directory: &Path, public_key: &str) -> Option<u64> {
        let (bytes, split) = self.read_cached_parts(directory).ok()?;
        self.verify_signature(&bytes[split + 1..], &bytes[..split], public_key)
            .ok()
    }
}

/// A regular file's bytes within `limit`; a symbolic link or a larger file reads as none.
pub fn read_bounded(path: &Path, limit: usize) -> Option<Vec<u8>> {
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

/// Lower-case hex SHA-256, as feeds record the files published beside them.
pub fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FeedSource {
    /// No verified feed has been read.
    None,
    Network,
    /// The last verified feed kept in application data.
    Cache,
    /// No public key is installed for the feed, so it is off.
    Disabled,
}

impl<T: Default> FeedSession<T> for FeedState<T> {
    fn feed_state(&self) -> &FeedState<T> {
        self
    }

    fn feed_state_mut(&mut self) -> &mut FeedState<T> {
        self
    }

    fn disable(&mut self) {
        FeedState::disable(self, T::default());
    }
}

/// The verified feed a session holds and when it was last fetched.
#[derive(Debug)]
pub struct FeedState<T> {
    feed: Option<T>,
    signed_at: Option<u64>,
    source: FeedSource,
    checked_at: Option<std::time::Instant>,
    last_failed: bool,
}

impl<T> Default for FeedState<T> {
    fn default() -> Self {
        Self {
            feed: None,
            signed_at: None,
            source: FeedSource::None,
            checked_at: None,
            last_failed: false,
        }
    }
}

impl<T> FeedState<T> {
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

    pub fn accept_fetched(&mut self, verified: Verified<T>, at: std::time::Instant) {
        self.feed = Some(verified.feed);
        self.signed_at = Some(verified.signed_at);
        self.source = FeedSource::Network;
        self.checked_at = Some(at);
        self.last_failed = false;
    }

    /// A failed fetch keeps the feed already held, else falls back to the cached one.
    pub fn fetch_failed(
        &mut self,
        cached: impl FnOnce() -> Option<Verified<T>>,
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

    /// Without an installed key the session holds `empty` as its verified feed.
    pub fn disable(&mut self, empty: T) {
        self.feed = Some(empty);
        self.signed_at = None;
        self.source = FeedSource::Disabled;
    }

    pub fn source(&self) -> FeedSource {
        self.source
    }

    pub fn feed(&self) -> Option<&T> {
        self.feed.as_ref()
    }
}

/// A session holding one feed's state, which a refresh updates.
pub trait FeedSession<T> {
    fn feed_state(&self) -> &FeedState<T>;
    fn feed_state_mut(&mut self) -> &mut FeedState<T>;
    /// Called when no public key is installed for the feed.
    fn disable(&mut self);
}
