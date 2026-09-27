#[allow(dead_code)]
#[path = "src/game_module_assembly.rs"]
mod game_module_assembly;

use std::env;
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};

fn main() {
    embed_game_module();
}

// Official builds supply the release version; local builds use the planner
// package version that Tauri also reads.
fn planner_version(manifest_dir: &Path) -> String {
    println!("cargo:rerun-if-env-changed=RUN_PLANNER_RELEASE_VERSION");
    if let Some(version) = env::var("RUN_PLANNER_RELEASE_VERSION")
        .ok()
        .filter(|version| !version.is_empty())
    {
        return version;
    }
    let package = manifest_dir.join("../../package.json");
    println!("cargo:rerun-if-changed={}", package.display());
    let json: serde_json::Value = serde_json::from_slice(
        &fs::read(&package)
            .unwrap_or_else(|error| panic!("could not read planner package.json: {error}")),
    )
    .unwrap_or_else(|error| panic!("planner package.json is malformed: {error}"));
    json["version"]
        .as_str()
        .expect("planner package.json has no version")
        .to_owned()
}

fn embed_game_module() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR"));
    let module_dir = manifest_dir.join("../../../../game-module");
    for input in [
        "src",
        "manifest.template.json",
        "icon.png",
        "LICENSE",
        "README.md",
    ] {
        println!(
            "cargo:rerun-if-changed={}",
            module_dir.join(input).display()
        );
    }
    let version = planner_version(&manifest_dir);
    let files = game_module_assembly::assemble(&module_dir, &version)
        .unwrap_or_else(|error| panic!("could not assemble the game module package: {error}"));

    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR"));
    let payload_dir = out_dir.join("game-module-package");
    if payload_dir.exists() {
        fs::remove_dir_all(&payload_dir).expect("clear generated game module payload");
    }
    fs::create_dir_all(&payload_dir).expect("create generated game module payload");
    let mut source = format!(
        "pub(crate) const BUNDLED_VERSION: &str = {version:?};\n\
         pub(crate) static BUNDLED_FILES: &[BundledFile] = &[\n"
    );
    for (index, file) in files.iter().enumerate() {
        let blob = payload_dir.join(format!("{index:04}.bin"));
        fs::write(&blob, &file.bytes).expect("write generated game module file");
        let blob = blob.to_str().expect("OUT_DIR must be UTF-8").to_owned();
        writeln!(
            source,
            "    BundledFile {{ path: {:?}, sha256: {:?}, bytes: include_bytes!({blob:?}) }},",
            file.path, file.sha256
        )
        .expect("format generated game module table");
    }
    source.push_str("];\n");
    fs::write(out_dir.join("game_module_package.rs"), source)
        .expect("write generated game module table");
}
