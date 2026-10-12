fn main() {
    // Development-only commands are compiled into debug builds and into release builds made
    // with VITE_INTERNAL_FEATURES=1, as the planner's internal features are.
    println!("cargo:rustc-check-cfg=cfg(internal_features)");
    println!("cargo:rerun-if-env-changed=VITE_INTERNAL_FEATURES");
    if std::env::var("VITE_INTERNAL_FEATURES").is_ok_and(|value| value == "1") {
        println!("cargo:rustc-cfg=internal_features");
    }
    tauri_build::build()
}
