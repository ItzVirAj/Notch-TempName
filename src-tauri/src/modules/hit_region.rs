use tauri::WebviewWindow;
use windows::Win32::Graphics::Gdi::{CreateRectRgn, DeleteObject, SetWindowRgn, HGDIOBJ};
use super::window::{WINDOW_HEIGHT, WINDOW_WIDTH};

pub const INITIAL_IDLE_WIDTH: f64 = 264.0;
pub const INITIAL_IDLE_HEIGHT: f64 = 52.0;

/// Sets the native Win32 window region to a rectangle bounding the interactive notch,
/// centered horizontally at the top edge of the window.
///
/// Converts logical coordinates to physical pixels using the window's scale factor.
/// The system owns the region handle on success; on error, it is cleaned up via DeleteObject.
pub fn apply_hit_region(window: &WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    let scale_factor = window.scale_factor().map_err(|e| e.to_string())?;
    let hwnd = window.hwnd().map_err(|e| e.to_string())?;

    let x_left_logical = ((WINDOW_WIDTH - width) / 2.0).max(0.0);
    let x_right_logical = ((WINDOW_WIDTH + width) / 2.0).min(WINDOW_WIDTH);
    let y_top_logical = 0.0;
    let y_bottom_logical = height.min(WINDOW_HEIGHT);

    let x1 = (x_left_logical * scale_factor).round() as i32;
    let y1 = (y_top_logical * scale_factor).round() as i32;
    let x2 = (x_right_logical * scale_factor).round() as i32;
    let y2 = (y_bottom_logical * scale_factor).round() as i32;

    if cfg!(debug_assertions) {
        eprintln!(
            "[hit_region] HWND: {:?}, Scale: {}, Logical: ({}x{}), Physical: [{}, {}, {}, {}]",
            hwnd, scale_factor, width, height, x1, y1, x2, y2
        );
    }

    unsafe {
        let hrgn = CreateRectRgn(x1, y1, x2, y2);
        if hrgn.is_invalid() {
            return Err("CreateRectRgn returned invalid handle".into());
        }
        let ret = SetWindowRgn(hwnd, Some(hrgn), true);
        if ret == 0 {
            let _ = DeleteObject(HGDIOBJ::from(hrgn));
            return Err("SetWindowRgn failed".into());
        }
    }

    Ok(())
}

#[tauri::command]
pub fn set_hit_region(window: WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    apply_hit_region(&window, width, height)
}
