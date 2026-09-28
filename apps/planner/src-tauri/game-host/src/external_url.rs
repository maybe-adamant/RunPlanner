/// ModpackLib's Thunderstore store page.
pub const MODPACKLIB_PAGE_URL: &str = "https://thunderstore.io/c/hades-ii/p/adamant/ModpackLib/";
/// The planner repository's new-issue page, where a bug report can be attached.
pub const ISSUE_PAGE_URL: &str = "https://github.com/maybe-adamant/RunPlanner/issues/new";

/// Accepts only the ModpackLib store page and the new-issue page.
pub fn validate_external_url(value: &str) -> Result<(), String> {
    if value == MODPACKLIB_PAGE_URL || value == ISSUE_PAGE_URL {
        return Ok(());
    }
    Err("Link URL is outside the planner's allowed pages.".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_exactly_the_allowlisted_pages() {
        assert!(validate_external_url(MODPACKLIB_PAGE_URL).is_ok());
        assert!(validate_external_url(ISSUE_PAGE_URL).is_ok());
        for url in [
            "https://thunderstore.io/c/hades-ii/p/adamant/ModpackLib",
            "https://thunderstore.io/c/hades-ii/p/adamant/ModpackLib/?ref=1",
            "https://thunderstore.io/c/hades-ii/p/adamant/Other/",
            "http://thunderstore.io/c/hades-ii/p/adamant/ModpackLib/",
            "ror2mm://v1/install/thunderstore.io/adamant/ModpackLib/4.1.0/",
            "https://github.com/maybe-adamant/RunPlanner/releases/download/v1.2.3/archive.zip",
            "https://github.com/maybe-adamant/RunPlanner/issues/new?title=x",
            "https://github.com/maybe-adamant/RunPlanner/issues/new/",
            "https://github.com/maybe-adamant/RunPlanner/issues",
            "https://github.com/other/RunPlanner/issues/new",
        ] {
            assert!(validate_external_url(url).is_err(), "{url}");
        }
    }
}
