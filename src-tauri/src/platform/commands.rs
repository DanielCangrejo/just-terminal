use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use super::shells;
use crate::session::persistence::ShellProfile;
use crate::state::AppState;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlatformInfo {
    /// "windows", "linux" or "macos" (std::env::consts::OS)
    pub os: String,
    pub home_dir: String,
    /// Available shells; the first one is the default.
    pub shells: Vec<ShellProfile>,
}

#[tauri::command]
pub async fn get_platform_info(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<PlatformInfo, String> {
    let home_dir = app
        .path()
        .home_dir()
        .map_err(|e| format!("Failed to resolve home directory: {e}"))?;
    Ok(PlatformInfo {
        os: std::env::consts::OS.to_string(),
        home_dir: home_dir.to_string_lossy().to_string(),
        shells: shells::detect(&state.shell_integration_dir),
    })
}
