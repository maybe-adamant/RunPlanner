//! WebView settings the planner's pages need beyond Tauri's defaults.

/// Turns off WebView2's form autofill ("Saved info") and password saving: nothing a plan field
/// holds is personal data to remember or suggest.
#[cfg(windows)]
pub(crate) fn disable_autofill(window: &tauri::WebviewWindow) {
    let _ = window.with_webview(|webview| {
        use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings4;
        use windows_core::Interface;
        // SAFETY: the controller is the window's live WebView2 controller, used on its thread.
        unsafe {
            let Ok(core) = webview.controller().CoreWebView2() else {
                return;
            };
            let Ok(settings) = core.Settings() else {
                return;
            };
            if let Ok(settings) = settings.cast::<ICoreWebView2Settings4>() {
                let _ = settings.SetIsGeneralAutofillEnabled(false);
                let _ = settings.SetIsPasswordAutosaveEnabled(false);
            }
        }
    });
}

/// Other platforms' webviews keep autofill off for fields marked `autocomplete="off"`.
#[cfg(not(windows))]
pub(crate) fn disable_autofill(_window: &tauri::WebviewWindow) {}
