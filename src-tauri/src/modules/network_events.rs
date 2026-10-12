use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use tauri::{AppHandle, Emitter, Manager};
use windows::Networking::Connectivity::{NetworkInformation, NetworkStatusChangedEventHandler};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WifiPayload {
    pub connected: bool,
    pub ssid: Option<String>,
}

pub struct NetworkEventsState {
    is_running: Arc<AtomicBool>,
    last_connected: Arc<Mutex<Option<bool>>>,
    last_ssid: Arc<Mutex<Option<String>>>,
    thread_handle: Mutex<Option<JoinHandle<()>>>,
}

impl NetworkEventsState {
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            last_connected: Arc::new(Mutex::new(None)),
            last_ssid: Arc::new(Mutex::new(None)),
            thread_handle: Mutex::new(None),
        }
    }
}

fn query_wifi_state() -> (bool, Option<String>) {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let output = match Command::new("netsh")
        .args(["wlan", "show", "interfaces"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    {
        Ok(o) => o,
        Err(_) => return (false, None),
    };

    if !output.status.success() {
        return (false, None);
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut is_connected = false;
    let mut ssid_name: Option<String> = None;

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("State") && trimmed.contains("connected") {
            is_connected = true;
        }
        if trimmed.starts_with("SSID") && !trimmed.starts_with("BSSID") && trimmed.contains(':') {
            let parts: Vec<&str> = trimmed.splitn(2, ':').collect();
            if parts.len() == 2 {
                let name = parts[1].trim();
                if !name.is_empty() {
                    ssid_name = Some(name.to_string());
                }
            }
        }
    }

    (is_connected, ssid_name)
}

pub fn start_network_monitor(app: &AppHandle) {
    let state = app.state::<NetworkEventsState>();
    let mut thread_guard = state.thread_handle.lock().unwrap();
    if state.is_running.load(Ordering::SeqCst) || thread_guard.is_some() {
        return;
    }

    state.is_running.store(true, Ordering::SeqCst);
    let is_running = state.is_running.clone();
    let last_connected = state.last_connected.clone();
    let last_ssid = state.last_ssid.clone();
    let app_handle = app.clone();

    let handle = thread::spawn(move || {
        // Record baseline
        let (initial_connected, initial_ssid) = query_wifi_state();
        *last_connected.lock().unwrap() = Some(initial_connected);
        *last_ssid.lock().unwrap() = initial_ssid;

        let app_cb = app_handle.clone();
        let running_cb = is_running.clone();
        let last_conn_cb = last_connected.clone();
        let last_ssid_cb = last_ssid.clone();

        let token = match NetworkInformation::NetworkStatusChanged(&NetworkStatusChangedEventHandler::new(
            move |_sender| {
                if !running_cb.load(Ordering::SeqCst) {
                    return Ok(());
                }

                let (cur_connected, cur_ssid) = query_wifi_state();

                let mut emit_event = false;
                let mut conn_guard = last_conn_cb.lock().unwrap();
                let mut ssid_guard = last_ssid_cb.lock().unwrap();

                if let Some(prev_conn) = *conn_guard {
                    if prev_conn != cur_connected || *ssid_guard != cur_ssid {
                        emit_event = true;
                    }
                }

                *conn_guard = Some(cur_connected);
                *ssid_guard = cur_ssid.clone();

                if emit_event {
                    let payload = WifiPayload {
                        connected: cur_connected,
                        ssid: cur_ssid,
                    };
                    let _ = app_cb.emit("wifi://state", &payload);
                }

                Ok(())
            },
        )) {
            Ok(tok) => tok,
            Err(e) => {
                eprintln!("[network_events] Failed to register NetworkStatusChanged: {e}");
                return;
            }
        };

        while is_running.load(Ordering::SeqCst) {
            thread::sleep(std::time::Duration::from_millis(500));
        }

        let _ = NetworkInformation::RemoveNetworkStatusChanged(token);
    });

    *thread_guard = Some(handle);
}

pub fn stop_network_monitor(app: &AppHandle) {
    let state = app.state::<NetworkEventsState>();
    state.is_running.store(false, Ordering::SeqCst);
    let mut thread_guard = state.thread_handle.lock().unwrap();
    if let Some(handle) = thread_guard.take() {
        let _ = handle.join();
    }
}
