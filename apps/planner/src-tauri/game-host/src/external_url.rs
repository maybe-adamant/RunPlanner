/// ModpackLib's Thunderstore store page, the one non-release page the planner opens.
pub const MODPACKLIB_PAGE_URL: &str = "https://thunderstore.io/c/hades-ii/p/adamant/ModpackLib/";

/// Accepts only official release downloads and the ModpackLib store page.
pub fn validate_external_url(value: &str) -> Result<(), String> {
    if value == MODPACKLIB_PAGE_URL {
        return Ok(());
    }
    let url = url::Url::parse(value).map_err(|_| "Link URL is invalid.".to_owned())?;
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
        return Err("Link URL is outside the planner's allowed pages.".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_official_https_release_downloads() {
        assert!(validate_external_url(
            "https://github.com/maybe-adamant/RunPlanner/releases/download/v1.2.3/RunPlanner-1.2.3-windows-x64-portable.zip"
        )
        .is_ok());
        for url in [
            "http://github.com/maybe-adamant/RunPlanner/releases/download/v1.2.3/archive.zip",
            "https://example.com/maybe-adamant/RunPlanner/releases/download/v1.2.3/archive.zip",
            "https://github.com/maybe-adamant/RunPlanner/releases/tag/v1.2.3",
            "https://github.com/maybe-adamant/RunPlanner/releases/download/v1.2.3/archive.zip?redirect=true",
        ] {
            assert!(validate_external_url(url).is_err(), "{url}");
        }
    }

    #[test]
    fn accepts_exactly_the_modpacklib_store_page() {
        assert!(validate_external_url(MODPACKLIB_PAGE_URL).is_ok());
        for url in [
            "https://thunderstore.io/c/hades-ii/p/adamant/ModpackLib",
            "https://thunderstore.io/c/hades-ii/p/adamant/ModpackLib/?ref=1",
            "https://thunderstore.io/c/hades-ii/p/adamant/Other/",
            "http://thunderstore.io/c/hades-ii/p/adamant/ModpackLib/",
            "ror2mm://v1/install/thunderstore.io/adamant/ModpackLib/4.1.0/",
        ] {
            assert!(validate_external_url(url).is_err(), "{url}");
        }
    }
}
