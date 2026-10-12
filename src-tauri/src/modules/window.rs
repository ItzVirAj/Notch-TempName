use tauri::{
    AppHandle, LogicalPosition, LogicalSize, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

pub const WINDOW_WIDTH: f64 = 640.0;
pub const WINDOW_HEIGHT: f64 = 240.0;

pub const ADDITIONAL_BROWSER_ARGS: &str =
    "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,MediaRouter,Translate,OptimizationHints --in-process-gpu --disable-background-networking";

/// Constructs the main overlay window in code, applies positioning, initial hit region,
/// and reveals the window. Reusable for both initial launch and on/off re-enablement.
pub fn create_main_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
        .title("testnotch")
        .inner_size(WINDOW_WIDTH, WINDOW_HEIGHT)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .focused(false)
        .focusable(false);

    #[cfg(windows)]
    let builder = builder.additional_browser_args(ADDITIONAL_BROWSER_ARGS);

    let window = builder.build()?;

    // 1. Position top-center
    position_top_center(&window)?;

    // 2. Set initial hit region to match the idle notch before revealing the window.
    // This prevents a momentary frame where the full 640x240 window blocks clicks.
    if let Err(e) = super::hit_region::apply_hit_region(
        &window,
        super::hit_region::INITIAL_IDLE_WIDTH,
        super::hit_region::INITIAL_IDLE_HEIGHT,
    ) {
        eprintln!("Failed to apply initial hit region: {e}");
    }

    // 3. Reveal window
    window.show()?;

    Ok(window)
}

/// Positions the window at the horizontal center of the primary monitor,
/// flush with the top edge (y = 0), accounting for DPI scale factor.
/// Uses logical units so positioning is consistent across any display scale.
pub fn position_top_center(window: &WebviewWindow) -> tauri::Result<()> {
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

    Ok(())
}
