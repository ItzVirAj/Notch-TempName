use std::str::FromStr;
use tauri::AppHandle;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub const DEFAULT_HOTKEY: &str = "Ctrl+Alt+N";

/// Registers the global shortcut to toggle the notch overlay on/off.
/// Captures key press events only (ignoring release).
/// If registration fails (e.g. shortcut claimed by another app), logs a warning
/// without panicking, allowing the app to continue running via the tray.
pub fn setup_hotkey(app: &AppHandle) {
    let shortcut = match Shortcut::from_str(DEFAULT_HOTKEY) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Warning: Failed to parse hotkey '{DEFAULT_HOTKEY}': {e}");
            return;
        }
    };

    if let Err(e) = app.global_shortcut().on_shortcut(shortcut, |app, _shortcut, event| {
        if event.state() == ShortcutState::Pressed {
            super::app_state::toggle(app);
        }
    }) {
        eprintln!(
            "Warning: Failed to register global shortcut '{DEFAULT_HOTKEY}' (hotkey may be in use by another app): {e}"
        );
    }
}
