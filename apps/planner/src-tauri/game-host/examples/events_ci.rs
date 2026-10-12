//! Release and community event publishing support, run by CI against a planner checkout:
//!
//! - `build-id`: the module build this checkout embeds, as the app selects plans by.
//! - `module-build`: `{"version","buildId"}` of that module, published with each release.
//! - `check <feed> <build-id>`: decodes a feed as the app does and fails if any event is refused.
//! - `verify <feed> <signature> <public-key>`: verifies a signed feed and prints its signing time.

use std::fs;
use std::process::ExitCode;

use run_planner_game_host::event_feed;
use run_planner_game_host::game_module_package::ModulePackage;

fn run(arguments: &[String]) -> Result<String, String> {
    let read =
        |path: &String| fs::read(path).map_err(|error| format!("could not read {path}: {error}"));
    match arguments {
        [command] if command == "build-id" => Ok(ModulePackage::bundled().build_id.clone()),
        [command] if command == "module-build" => {
            let package = ModulePackage::bundled();
            Ok(serde_json::json!({ "version": package.version, "buildId": package.build_id })
                .to_string())
        }
        [command, feed, build_id] if command == "check" => {
            let decoded = event_feed::decode_feed(&read(feed)?, build_id)?;
            if !decoded.refused.is_empty() {
                return Err(format!("refused events:\n{}", decoded.refused.join("\n")));
            }
            Ok(decoded
                .events
                .iter()
                .map(|plan| plan.event.id.as_str())
                .collect::<Vec<_>>()
                .join("\n"))
        }
        [command, feed, signature, public_key] if command == "verify" => {
            event_feed::verify_signature(&read(feed)?, &read(signature)?, public_key.trim())
                .map(|signed_at| signed_at.to_string())
        }
        _ => Err("usage: events_ci build-id | module-build | check <feed> <build-id> | verify <feed> <signature> <public-key>".to_owned()),
    }
}

fn main() -> ExitCode {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    match run(&arguments) {
        Ok(output) => {
            println!("{output}");
            ExitCode::SUCCESS
        }
        Err(message) => {
            eprintln!("{message}");
            ExitCode::FAILURE
        }
    }
}
