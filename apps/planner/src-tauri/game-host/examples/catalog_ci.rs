//! Plan catalog publishing support, run by the catalog repository's CI against a planner
//! checkout:
//!
//! - `check <catalog.json>`: decodes an index as the app does and fails if any entry is refused.
//! - `verify <catalog.json> <signature> <public-key>`: verifies a signed index and prints its
//!   signing time.

use std::fs;
use std::process::ExitCode;

use run_planner_game_host::catalog_feed;

fn run(arguments: &[String]) -> Result<String, String> {
    let read =
        |path: &String| fs::read(path).map_err(|error| format!("could not read {path}: {error}"));
    match arguments {
        [command, feed] if command == "check" => {
            let index = catalog_feed::decode_catalog(&read(feed)?)?;
            if !index.refused.is_empty() {
                return Err(format!("refused entries:\n{}", index.refused.join("\n")));
            }
            Ok(index
                .entries
                .iter()
                .map(|entry| entry.id.as_str())
                .collect::<Vec<_>>()
                .join("\n"))
        }
        [command, feed, signature, public_key] if command == "verify" => {
            catalog_feed::CATALOG_FEED
                .verify_signature(&read(feed)?, &read(signature)?, public_key.trim())
                .map(|signed_at| signed_at.to_string())
        }
        _ => Err(
            "usage: catalog_ci check <catalog.json> | verify <catalog.json> <signature> <public-key>"
                .to_owned(),
        ),
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
