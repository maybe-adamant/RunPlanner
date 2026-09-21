use std::time::Duration;

use serde::{Deserialize, Serialize};

const LATEST_RELEASE_URL: &str =
    "https://api.github.com/repos/maybe-adamant/RunPlanner/releases/latest";
const MAX_RELEASE_RESPONSE_BYTES: usize = 128 * 1024;

#[derive(Deserialize, Serialize)]
pub struct ReleaseAsset {
    #[serde(rename(serialize = "browserDownloadUrl", deserialize = "browser_download_url"))]
    pub browser_download_url: String,
    pub name: String,
}

#[derive(Deserialize, Serialize)]
pub struct ReleaseMetadata {
    pub assets: Vec<ReleaseAsset>,
    pub draft: bool,
    #[serde(rename(serialize = "htmlUrl", deserialize = "html_url"))]
    pub html_url: String,
    pub prerelease: bool,
    #[serde(rename(serialize = "tagName", deserialize = "tag_name"))]
    pub tag_name: String,
}

#[tauri::command]
pub async fn release_check_latest() -> Result<ReleaseMetadata, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .user_agent("Run-Planner-release-check")
        .build()
        .map_err(|error| format!("Could not create release client: {error}"))?;
    let mut response = client
        .get(LATEST_RELEASE_URL)
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .send()
        .await
        .map_err(|error| format!("Could not check releases: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Release check failed: {error}"))?;
    if response
        .content_length()
        .is_some_and(|length| length > MAX_RELEASE_RESPONSE_BYTES as u64)
    {
        return Err("Release response is too large.".into());
    }
    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("Could not read release response: {error}"))?
    {
        if body.len() + chunk.len() > MAX_RELEASE_RESPONSE_BYTES {
            return Err("Release response is too large.".into());
        }
        body.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&body)
        .map_err(|error| format!("Release response was malformed: {error}"))
}

#[tauri::command]
pub fn release_open_download(url: String) -> Result<(), String> {
    validate_release_url(&url)?;
    open_in_browser(&url)
}

fn validate_release_url(value: &str) -> Result<(), String> {
    let url = url::Url::parse(value).map_err(|_| "Release URL is invalid.".to_owned())?;
    if url.scheme() != "https"
        || url.host_str() != Some("github.com")
        || url.port().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || !url
            .path()
            .starts_with("/maybe-adamant/RunPlanner/releases/download/v")
    {
        return Err("Release URL is outside the official download location.".into());
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn open_in_browser(url: &str) -> Result<(), String> {
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    let operation = wide("open");
    let target = wide(url);
    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            operation.as_ptr(),
            target.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            SW_SHOWNORMAL,
        )
    };
    if (result as isize) <= 32 {
        return Err("Could not open the release download in the default browser.".into());
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn open_in_browser(_url: &str) -> Result<(), String> {
    Err("Release downloads are available only in the Windows desktop application.".into())
}

#[cfg(target_os = "windows")]
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(test)]
mod tests {
    use super::{validate_release_url, ReleaseMetadata};

    #[test]
    fn accepts_only_official_https_release_downloads() {
        assert!(validate_release_url(
            "https://github.com/maybe-adamant/RunPlanner/releases/download/v1.2.3/RunPlanner-1.2.3-windows-x64-portable.zip"
        )
        .is_ok());
        for url in [
            "http://github.com/maybe-adamant/RunPlanner/releases/download/v1.2.3/archive.zip",
            "https://example.com/maybe-adamant/RunPlanner/releases/download/v1.2.3/archive.zip",
            "https://github.com/maybe-adamant/RunPlanner/releases/tag/v1.2.3",
            "https://github.com/maybe-adamant/RunPlanner/releases/download/v1.2.3/archive.zip?redirect=true",
        ] {
            assert!(validate_release_url(url).is_err(), "{url}");
        }
    }

    #[test]
    fn decodes_github_release_field_names_and_serializes_frontend_field_names() {
        let release: ReleaseMetadata = serde_json::from_str(
            r#"{"assets":[{"browser_download_url":"https://github.com/maybe-adamant/RunPlanner/releases/download/v1.2.3/archive.zip","name":"archive.zip"}],"draft":false,"html_url":"https://github.com/maybe-adamant/RunPlanner/releases/tag/v1.2.3","prerelease":false,"tag_name":"v1.2.3"}"#,
        )
        .unwrap();
        let frontend = serde_json::to_value(release).unwrap();
        assert_eq!(frontend["tagName"], "v1.2.3");
        assert_eq!(
            frontend["htmlUrl"],
            "https://github.com/maybe-adamant/RunPlanner/releases/tag/v1.2.3"
        );
        assert_eq!(
            frontend["assets"][0]["browserDownloadUrl"],
            "https://github.com/maybe-adamant/RunPlanner/releases/download/v1.2.3/archive.zip"
        );
    }
}
