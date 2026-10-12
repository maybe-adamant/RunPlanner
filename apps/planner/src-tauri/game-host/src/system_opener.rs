//! Hands a URL or folder to the desktop's default handler on macOS and Linux.

use std::ffi::{OsStr, OsString};

/// Prefixes of the toolkit variables an AppImage runtime points into its own
/// bundle; a system browser or file manager must not inherit them.
const APPIMAGE_VARIABLE_PREFIXES: [&str; 4] = ["GTK_", "GDK_", "GIO_", "GST_"];
const APPIMAGE_VARIABLES: [&str; 1] = ["GSETTINGS_SCHEMA_DIR"];

/// The variables to clear for a child process, given this process's environment.
pub fn appimage_variables_to_clear(
    environment: impl IntoIterator<Item = (OsString, OsString)>,
) -> Vec<OsString> {
    let mut names = Vec::new();
    let mut in_appimage = false;
    for (name, _) in environment {
        let text = name.to_string_lossy();
        if text == "APPIMAGE" {
            in_appimage = true;
        } else if APPIMAGE_VARIABLE_PREFIXES
            .iter()
            .any(|prefix| text.starts_with(prefix))
            || APPIMAGE_VARIABLES.contains(&text.as_ref())
        {
            names.push(name);
        }
    }
    if in_appimage {
        names
    } else {
        Vec::new()
    }
}

/// Starts the platform opener (`open` on macOS, `xdg-open` elsewhere) and reaps
/// it in the background.
pub fn open(target: &OsStr) -> std::io::Result<()> {
    let opener = if cfg!(target_os = "macos") {
        "open"
    } else {
        "xdg-open"
    };
    let mut command = std::process::Command::new(opener);
    command.arg(target);
    for name in appimage_variables_to_clear(std::env::vars_os()) {
        command.env_remove(name);
    }
    let mut child = command.spawn()?;
    std::thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn environment(names: &[&str]) -> Vec<(OsString, OsString)> {
        names
            .iter()
            .map(|name| (OsString::from(name), OsString::from("value")))
            .collect()
    }

    #[test]
    fn clears_bundle_toolkit_variables_only_inside_an_appimage() {
        let variables = [
            "GTK_PATH",
            "GDK_PIXBUF_MODULE_FILE",
            "GIO_MODULE_DIR",
            "GST_PLUGIN_SYSTEM_PATH_1_0",
            "GSETTINGS_SCHEMA_DIR",
            "HOME",
            "PATH",
            "XDG_CONFIG_HOME",
        ];
        assert!(appimage_variables_to_clear(environment(&variables)).is_empty());
        let mut inside = variables.to_vec();
        inside.push("APPIMAGE");
        assert_eq!(
            appimage_variables_to_clear(environment(&inside)),
            environment(&variables[..5])
                .into_iter()
                .map(|(name, _)| name)
                .collect::<Vec<_>>()
        );
    }
}
