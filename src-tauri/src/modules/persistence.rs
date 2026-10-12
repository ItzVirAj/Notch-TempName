use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize)]
pub struct AppConfig {
    pub enabled: bool,
}

fn get_config_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("state.json"))
}

/// Restores the persisted enabled/disabled state from the app config directory.
/// Defaults to true (enabled) on first run, missing file, or corrupt JSON.
pub fn load_state(app: &AppHandle) -> bool {
    if let Some(path) = get_config_path(app) {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
                return config.enabled;
            }
        }
    }
    true
}

/// Persists the enabled/disabled state to state.json in the app config directory.
pub fn save_state(app: &AppHandle, enabled: bool) {
    if let Some(path) = get_config_path(app) {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let config = AppConfig { enabled };
        if let Ok(json) = serde_json::to_string_pretty(&config) {
            let _ = fs::write(&path, json);
        }
    }
}
