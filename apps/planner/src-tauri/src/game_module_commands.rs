use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::Manager;

use run_planner_game_host::game_module_install::{
    self, GameModuleStatus, InstallOutcome, NativeSwap, RemoveOutcome,
};
use run_planner_game_host::game_module_package::ModulePackage;
use run_planner_game_host::game_plan_publication::{self, GamePlanPublication};
use run_planner_game_host::game_target::{self, GameTargetDiscovery, ResolvedTarget, TargetKind};

const BACKUP_DIRECTORY: &str = "game-module-backup";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GameModuleInstallResult {
    outcome: InstallOutcome,
    status: GameModuleStatus,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GameModuleRemoveResult {
    outcome: RemoveOutcome,
    status: GameModuleStatus,
}

fn config_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|error| format!("could not resolve application config directory: {error}"))
}

fn backup_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(BACKUP_DIRECTORY))
        .map_err(|error| format!("could not resolve application data directory: {error}"))
}

fn established_target(config_dir: &Path) -> Result<ResolvedTarget, String> {
    let (status, target) = game_module_install::status(config_dir, ModulePackage::bundled());
    target.ok_or_else(|| {
        status
            .target_problem
            .unwrap_or_else(|| "Locate the game module target in Settings first.".to_owned())
    })
}

fn current_status(config_dir: &Path) -> GameModuleStatus {
    game_module_install::status(config_dir, ModulePackage::bundled()).0
}

fn establish(app: &tauri::AppHandle, target: ResolvedTarget) -> Result<GameModuleStatus, String> {
    let config_dir = config_dir(app)?;
    game_target::remember_target(&config_dir, &target)?;
    Ok(current_status(&config_dir))
}

fn install_package(
    app: &tauri::AppHandle,
    package: &ModulePackage,
    overwrite_consent: bool,
) -> Result<GameModuleInstallResult, String> {
    let config_dir = config_dir(app)?;
    let target = established_target(&config_dir)?;
    let outcome = game_module_install::install(
        &target,
        package,
        &backup_root(app)?,
        overwrite_consent,
        &mut NativeSwap,
    )?;
    Ok(GameModuleInstallResult {
        outcome,
        status: current_status(&config_dir),
    })
}

#[tauri::command]
pub(crate) fn game_target_discover() -> Result<GameTargetDiscovery, String> {
    Ok(match game_target::r2modman_profiles_root() {
        Some(root) => GameTargetDiscovery {
            supported: true,
            profiles: game_target::discover_profiles(&root)?,
        },
        None => GameTargetDiscovery {
            supported: false,
            profiles: Vec::new(),
        },
    })
}

#[tauri::command]
pub(crate) fn game_target_use_discovered(
    app: tauri::AppHandle,
    path: String,
) -> Result<GameModuleStatus, String> {
    let root = game_target::r2modman_profiles_root()
        .ok_or("r2modman profile discovery is unavailable on this platform.")?;
    establish(
        &app,
        game_target::resolve_discovered(&root, Path::new(&path))?,
    )
}

#[tauri::command]
pub(crate) fn game_target_choose(
    app: tauri::AppHandle,
    path: String,
) -> Result<GameModuleStatus, String> {
    establish(
        &app,
        game_target::resolve_target(Path::new(&path), TargetKind::Manual)?,
    )
}

#[tauri::command]
pub(crate) fn game_module_status(app: tauri::AppHandle) -> Result<GameModuleStatus, String> {
    Ok(current_status(&config_dir(&app)?))
}

#[tauri::command(async)]
pub(crate) fn game_module_install(
    app: tauri::AppHandle,
    overwrite_consent: bool,
) -> Result<GameModuleInstallResult, String> {
    install_package(&app, ModulePackage::bundled(), overwrite_consent)
}

#[tauri::command(async)]
pub(crate) fn game_module_install_from_checkout(
    app: tauri::AppHandle,
    overwrite_consent: bool,
) -> Result<GameModuleInstallResult, String> {
    #[cfg(debug_assertions)]
    {
        let package = run_planner_game_host::game_module_package::checkout_package()?;
        install_package(&app, &package, overwrite_consent)
    }
    #[cfg(not(debug_assertions))]
    {
        let _ = (app, overwrite_consent);
        Err("Installing from the checkout is available only in development builds.".to_owned())
    }
}

#[tauri::command(async)]
pub(crate) fn game_module_remove(app: tauri::AppHandle) -> Result<GameModuleRemoveResult, String> {
    let config_dir = config_dir(&app)?;
    let target = established_target(&config_dir)?;
    let outcome = game_module_install::remove(&target, ModulePackage::bundled())?;
    Ok(GameModuleRemoveResult {
        outcome,
        status: current_status(&config_dir),
    })
}

#[tauri::command]
pub(crate) fn game_plan_publish(
    app: tauri::AppHandle,
    slot_number: u8,
    plan_json: String,
) -> Result<GamePlanPublication, String> {
    Ok(game_plan_publication::publish(
        &config_dir(&app)?,
        ModulePackage::bundled(),
        slot_number,
        &plan_json,
    ))
}
