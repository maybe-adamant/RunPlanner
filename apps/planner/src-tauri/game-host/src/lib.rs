//! Tauri-free desktop host capabilities over explicit paths: the embedded game
//! module package, the game target, module install, plan-slot publication,
//! bug reports and the macOS/Linux system opener.

pub mod atomic_file;
pub mod bug_report;
pub mod external_url;
pub mod game_module_assembly;
pub mod game_module_install;
pub mod game_module_package;
pub mod game_plan_publication;
pub mod game_target;
pub mod plan_slots;
pub mod system_opener;
