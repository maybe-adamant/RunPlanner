//! Release and community event publishing support, run by CI against a planner checkout:
//!
//! - `check <feed>`: decodes a feed as the app does and fails if any event is refused.
//! - `verify <feed> <signature> <public-key>`: verifies a signed feed and prints its signing time.

use std::fs;
use std::process::ExitCode;

use run_planner_game_host::event_feed;

fn run(arguments: &[String]) -> Result<String, String> {
    let read =
        |path: &String| fs::read(path).map_err(|error| format!("could not read {path}: {error}"));
    match arguments {
        [command, feed] if command == "check" => {
            let decoded = event_feed::decode_feed(&read(feed)?)?;
            if !decoded.refused.is_empty() {
                return Err(format!("refused events:\n{}", decoded.refused.join("\n")));
            }
            Ok(decoded
                .events
                .iter()
                .map(|event| event.id.as_str())
                .collect::<Vec<_>>()
                .join("\n"))
        }
        [command, feed, signature, public_key] if command == "verify" => event_feed::EVENT_FEED
            .verify_signature(&read(feed)?, &read(signature)?, public_key.trim())
            .map(|signed_at| signed_at.to_string()),
        _ => {
            Err("usage: events_ci check <feed> | verify <feed> <signature> <public-key>".to_owned())
        }
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
