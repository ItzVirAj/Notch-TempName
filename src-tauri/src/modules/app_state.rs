use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{menu::MenuItem, AppHandle, Manager, Wry};

pub struct AppState {
    pub enabled: Mutex<bool>,
    pub transitioning: Mutex<bool>,
    pub toggle_item: Mutex<Option<MenuItem<Wry>>>,
    pub is_quitting: AtomicBool,
}

impl AppState {
    pub fn new(initial_enabled: bool) -> Self {
        Self {
            enabled: Mutex::new(initial_enabled),
            transitioning: Mutex::new(false),
            toggle_item: Mutex::new(None),
            is_quitting: AtomicBool::new(false),
        }
    }

    pub fn is_enabled(&self) -> bool {
        *self.enabled.lock().unwrap()
    }

    pub fn is_quitting(&self) -> bool {
        self.is_quitting.load(Ordering::SeqCst)
    }

    pub fn set_quitting(&self, quitting: bool) {
        self.is_quitting.store(quitting, Ordering::SeqCst);
    }
}

/// Enables the notch overlay: creates the window if it does not exist,
/// updates state, updates tray label, and persists configuration.
/// Safe and idempotent to call repeatedly.
pub fn enable(app: &AppHandle) {
    let state = app.state::<AppState>();
    let mut transitioning = state.transitioning.lock().unwrap();
    if *transitioning {
        return;
    }
    *transitioning = true;

    let mut enabled_guard = state.enabled.lock().unwrap();
    if app.get_webview_window("main").is_none() {
        if let Err(e) = super::window::create_main_window(app) {
            eprintln!("Failed to create main window on enable: {e}");
        }
    }
    if !*enabled_guard {
        *enabled_guard = true;
        super::persistence::save_state(app, true);
        if let Some(item) = state.toggle_item.lock().unwrap().as_ref() {
            let _ = item.set_text("Disable notch");
        }
    }

    super::media::start_media_worker(app);

    *transitioning = false;
}

/// Disables the notch overlay: completely destroys the main window so all WebView2
/// processes terminate, updates state, updates tray label, and persists configuration.
/// Safe and idempotent to call repeatedly.
pub fn disable(app: &AppHandle) {
    let state = app.state::<AppState>();
    let mut transitioning = state.transitioning.lock().unwrap();
    if *transitioning {
        return;
    }
    *transitioning = true;

    super::media::stop_media_worker(app);

    let mut enabled_guard = state.enabled.lock().unwrap();
    if *enabled_guard {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.destroy();
        }
        *enabled_guard = false;
        super::persistence::save_state(app, false);
        if let Some(item) = state.toggle_item.lock().unwrap().as_ref() {
            let _ = item.set_text("Enable notch");
        }
    }

    *transitioning = false;
}

/// Toggles between enabled and disabled states.
pub fn toggle(app: &AppHandle) {
    let state = app.state::<AppState>();
    let current = {
        let guard = state.enabled.lock().unwrap();
        *guard
    };
    if current {
        disable(app);
    } else {
        enable(app);
    }
}

/// Performs a clean exit: marks quitting state, releases window and WebView2 processes,
/// hides tray icon, and terminates process.
pub fn quit(app: &AppHandle) {
    let state = app.state::<AppState>();
    state.set_quitting(true);

    disable(app);

    if let Some(tray) = app.tray_by_id(super::tray::TRAY_ID) {
        let _ = tray.set_visible(false);
    }

    app.exit(0);
}
