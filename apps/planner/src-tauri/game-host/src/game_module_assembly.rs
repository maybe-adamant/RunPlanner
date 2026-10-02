// Shared by build.rs (embedded package) and the development checkout install.
// It must not reference other crate modules.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

pub const MANIFEST_FILE: &str = "manifest.json";
pub const INSTALL_RECORD_FILE: &str = "run-planner-install.json";
pub const COMPATIBILITY_FILE: &str = "execution-compatibility.json";
const MANIFEST_TEMPLATE_FILE: &str = "manifest.template.json";
const PAYLOAD_DIRECTORY: &str = "src";
// r2modman flattens a Thunderstore package's root files and its `plugins/`
// payload into one `ReturnOfModding/plugins/<FullName>/` folder.
const PACKAGE_ROOT_FILES: [&str; 3] = ["icon.png", "LICENSE", "README.md"];

pub struct AssembledFile {
    pub path: String,
    pub bytes: Vec<u8>,
    pub sha256: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ManifestTemplate {
    namespace: String,
    name: String,
    description: String,
    dependencies: Vec<String>,
    website_url: String,
    #[serde(rename = "FullName")]
    full_name: String,
}

#[derive(Serialize)]
struct StampedManifest<'a> {
    namespace: &'a str,
    name: &'a str,
    version_number: &'a str,
    description: &'a str,
    dependencies: &'a [String],
    website_url: &'a str,
    #[serde(rename = "FullName")]
    full_name: &'a str,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct CheckedInCompatibility {
    format: String,
    catalog_version: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StampedCompatibility<'a> {
    format: &'a str,
    catalog_version: &'a str,
    build_id: &'a str,
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

pub fn parse_version(version: &str) -> Option<(u64, u64, u64)> {
    let mut parts = version.split('.');
    let mut next = || -> Option<u64> {
        let part = parts.next()?;
        if part.is_empty()
            || !part.bytes().all(|byte| byte.is_ascii_digit())
            || (part.len() > 1 && part.starts_with('0'))
        {
            return None;
        }
        part.parse().ok()
    };
    let version = (next()?, next()?, next()?);
    parts.next().is_none().then_some(version)
}

fn read(path: &Path) -> Result<Vec<u8>, String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("could not inspect {}: {error}", path.display()))?;
    if !metadata.is_file() {
        return Err(format!("{} is not a regular file", path.display()));
    }
    fs::read(path).map_err(|error| format!("could not read {}: {error}", path.display()))
}

fn stamped_manifest(module_dir: &Path, version: &str) -> Result<Vec<u8>, String> {
    let template: ManifestTemplate =
        serde_json::from_slice(&read(&module_dir.join(MANIFEST_TEMPLATE_FILE))?)
            .map_err(|error| format!("{MANIFEST_TEMPLATE_FILE} is malformed: {error}"))?;
    if template.full_name != format!("{}-{}", template.namespace, template.name) {
        return Err(format!(
            "{MANIFEST_TEMPLATE_FILE} FullName must be namespace-name"
        ));
    }
    let mut manifest = serde_json::to_vec_pretty(&StampedManifest {
        namespace: &template.namespace,
        name: &template.name,
        version_number: version,
        description: &template.description,
        dependencies: &template.dependencies,
        website_url: &template.website_url,
        full_name: &template.full_name,
    })
    .map_err(|error| format!("could not encode the module manifest: {error}"))?;
    manifest.push(b'\n');
    Ok(manifest)
}

/// The module build identity: SHA-256 over the sorted `path NUL sha256 LF` lines of the
/// checked-in `src/` payload.
fn payload_build_id(payload: &BTreeMap<String, Vec<u8>>) -> String {
    let mut lines = Vec::new();
    for (path, bytes) in payload {
        lines.extend_from_slice(path.as_bytes());
        lines.push(0);
        lines.extend_from_slice(sha256_hex(bytes).as_bytes());
        lines.push(b'\n');
    }
    sha256_hex(&lines)
}

fn stamped_compatibility(checked_in: &[u8], build_id: &str) -> Result<Vec<u8>, String> {
    let value: serde_json::Value = serde_json::from_slice(checked_in)
        .map_err(|error| format!("{COMPATIBILITY_FILE} is malformed: {error}"))?;
    if value.get("buildId").is_some() {
        return Err(format!(
            "{COMPATIBILITY_FILE} must not carry a buildId; assembly stamps it"
        ));
    }
    let compatibility: CheckedInCompatibility = serde_json::from_value(value)
        .map_err(|error| format!("{COMPATIBILITY_FILE} is malformed: {error}"))?;
    let mut stamped = serde_json::to_vec_pretty(&StampedCompatibility {
        format: &compatibility.format,
        catalog_version: &compatibility.catalog_version,
        build_id,
    })
    .map_err(|error| format!("could not encode {COMPATIBILITY_FILE}: {error}"))?;
    stamped.push(b'\n');
    Ok(stamped)
}

fn collect_payload(
    directory: &Path,
    prefix: &str,
    files: &mut BTreeMap<String, Vec<u8>>,
) -> Result<(), String> {
    let mut entries = fs::read_dir(directory)
        .map_err(|error| format!("could not read {}: {error}", directory.display()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("could not read {}: {error}", directory.display()))?;
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        let name = entry
            .file_name()
            .into_string()
            .map_err(|name| format!("payload file {name:?} is not UTF-8"))?;
        if name.starts_with('.') {
            continue;
        }
        let path = format!("{prefix}{name}");
        let file_type = entry
            .file_type()
            .map_err(|error| format!("could not inspect payload {path}: {error}"))?;
        if file_type.is_symlink() {
            return Err(format!("payload {path} is a link"));
        }
        if file_type.is_dir() {
            collect_payload(&entry.path(), &format!("{path}/"), files)?;
            continue;
        }
        if path == INSTALL_RECORD_FILE {
            return Err(format!("payload {path} collides with a package file"));
        }
        files.insert(path, read(&entry.path())?);
    }
    Ok(())
}

/// Builds the flattened plugin folder contents in stable path order.
pub fn assemble(module_dir: &Path, version: &str) -> Result<Vec<AssembledFile>, String> {
    if parse_version(version).is_none() {
        return Err(format!(
            "planner version {version:?} is not a stable x.y.z version"
        ));
    }
    let mut files = BTreeMap::new();
    files.insert(
        MANIFEST_FILE.to_owned(),
        stamped_manifest(module_dir, version)?,
    );
    for name in PACKAGE_ROOT_FILES {
        files.insert(name.to_owned(), read(&module_dir.join(name))?);
    }
    let mut payload = BTreeMap::new();
    collect_payload(&module_dir.join(PAYLOAD_DIRECTORY), "", &mut payload)?;
    if !payload.contains_key("main.lua") {
        return Err("the game module payload has no main.lua".to_owned());
    }
    let build_id = payload_build_id(&payload);
    let compatibility = payload.get_mut(COMPATIBILITY_FILE).ok_or(format!(
        "the game module payload has no {COMPATIBILITY_FILE}"
    ))?;
    *compatibility = stamped_compatibility(compatibility, &build_id)?;
    for (path, bytes) in payload {
        if files.insert(path.clone(), bytes).is_some() {
            return Err(format!("payload {path} collides with a package file"));
        }
    }
    Ok(files
        .into_iter()
        .map(|(path, bytes)| AssembledFile {
            sha256: sha256_hex(&bytes),
            path,
            bytes,
        })
        .collect())
}
