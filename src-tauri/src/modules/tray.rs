use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Wry,
};

pub const TRAY_ID: &str = "testnotch-tray";

/// Sets up the system tray icon, tooltip, right-click menu, and left-click event listener.
/// Returns the toggle MenuItem handle so its label can be updated dynamically on state changes.
pub fn setup_tray(app: &AppHandle, initial_enabled: bool) -> tauri::Result<MenuItem<Wry>> {
    let toggle_label = if initial_enabled {
        "Disable notch"
    } else {
        "Enable notch"
    };

    let toggle_item = MenuItem::with_id(app, "toggle", toggle_label, true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&toggle_item, &quit_item])?;

    let icon = app.default_window_icon().cloned().expect("App icon missing");

    let _tray = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("testnotch")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle" => {
                super::app_state::toggle(app);
            }
            "quit" => {
                super::app_state::quit(app);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                super::app_state::toggle(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(toggle_item)
}
