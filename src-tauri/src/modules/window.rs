use tauri::{LogicalPosition, LogicalSize, WebviewWindow};

pub const WINDOW_WIDTH: f64 = 640.0;
pub const WINDOW_HEIGHT: f64 = 240.0;

/// Positions the window at the horizontal center of the primary monitor,
/// flush with the top edge (y = 0), accounting for DPI scale factor.
/// Uses logical units so positioning is consistent across any display scale.
pub fn position_top_center(window: &WebviewWindow) -> tauri::Result<()> {
    // Ensure fixed logical size
    window.set_size(LogicalSize::new(WINDOW_WIDTH, WINDOW_HEIGHT))?;

    if let Some(monitor) = window.primary_monitor()? {
        let scale_factor = monitor.scale_factor();
        let monitor_size = monitor.size().to_logical::<f64>(scale_factor);
        let monitor_pos = monitor.position().to_logical::<f64>(scale_factor);

        // Center horizontally on the primary monitor, flush at the top edge (y = 0)
        let x = monitor_pos.x + (monitor_size.width - WINDOW_WIDTH) / 2.0;
        let y = monitor_pos.y;

        window.set_position(LogicalPosition::new(x, y))?;
    }

    // Window was initially hidden to prevent flash of unpositioned content;
    // reveal it now that size and position are established.
    window.show()?;

    Ok(())
}
