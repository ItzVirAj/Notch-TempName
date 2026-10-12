use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread::{self, JoinHandle};
use tauri::{AppHandle, Emitter, Manager};
use windows::core::HSTRING;
use windows::Devices::Bluetooth::{BluetoothConnectionStatus, BluetoothDevice};
use windows::Devices::Enumeration::DeviceInformation;
use windows::Foundation::TypedEventHandler;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BluetoothPayload {
    pub name: String,
    pub connected: bool,
    pub device_type: Option<String>,
}

pub struct BluetoothEventsState {
    is_running: std::sync::Arc<AtomicBool>,
    thread_handle: Mutex<Option<JoinHandle<()>>>,
}

impl BluetoothEventsState {
    pub fn new() -> Self {
        Self {
            is_running: std::sync::Arc::new(AtomicBool::new(false)),
            thread_handle: Mutex::new(None),
        }
    }
}

fn classify_device_type(name: &str) -> String {
    let lower = name.to_lowercase();
    if lower.contains("headphone")
        || lower.contains("earbud")
        || lower.contains("airpod")
        || lower.contains("buds")
        || lower.contains("wh-")
        || lower.contains("wf-")
    {
        "headphones".to_string()
    } else if lower.contains("speaker") || lower.contains("soundbar") || lower.contains("audio") {
        "speaker".to_string()
    } else if lower.contains("keyboard") || lower.contains("keychron") {
        "keyboard".to_string()
    } else if lower.contains("mouse") || lower.contains("trackpad") {
        "mouse".to_string()
    } else if lower.contains("phone") || lower.contains("iphone") || lower.contains("galaxy") || lower.contains("pixel") {
        "phone".to_string()
    } else {
        "generic".to_string()
    }
}

pub fn start_bluetooth_monitor(app: &AppHandle) {
    let state = app.state::<BluetoothEventsState>();
    let mut thread_guard = state.thread_handle.lock().unwrap();
    if state.is_running.load(Ordering::SeqCst) || thread_guard.is_some() {
        return;
    }

    state.is_running.store(true, Ordering::SeqCst);
    let is_running = state.is_running.clone();
    let app_handle = app.clone();

    let handle = thread::spawn(move || {
        let selector = match BluetoothDevice::GetDeviceSelectorFromConnectionStatus(
            BluetoothConnectionStatus::Connected,
        ) {
            Ok(s) => s,
            Err(_) => match HSTRING::try_from("System.Devices.Aqs = \"System.Devices.InterfaceClassGuid:=\"{e0cbf06c-cd8b-4647-bb8a-263b43f0f974}\"\"") {
                Ok(s) => s,
                Err(_) => return,
            },
        };

        let watcher = match DeviceInformation::CreateWatcherAqsFilter(&selector) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("[bluetooth_events] Failed to create DeviceWatcher: {e}");
                return;
            }
        };

        let app_added = app_handle.clone();
        let running_added = is_running.clone();
        let _added_token = watcher.Added(&TypedEventHandler::new(
            move |_watcher: windows::core::Ref<'_, _>, info: windows::core::Ref<'_, DeviceInformation>| {
                if !running_added.load(Ordering::SeqCst) {
                    return Ok(());
                }
                if let Some(dev) = info.as_ref() {
                    if let Ok(hname) = dev.Name() {
                        let name = hname.to_string();
                        if !name.is_empty() {
                            let dev_type = classify_device_type(&name);
                            let payload = BluetoothPayload {
                                name,
                                connected: true,
                                device_type: Some(dev_type),
                            };
                            let _ = app_added.emit("bluetooth://state", &payload);
                        }
                    }
                }
                Ok(())
            },
        ));

        let app_removed = app_handle.clone();
        let running_removed = is_running.clone();
        let _removed_token = watcher.Removed(&TypedEventHandler::new(
            move |_watcher: windows::core::Ref<'_, _>, info: windows::core::Ref<'_, windows::Devices::Enumeration::DeviceInformationUpdate>| {
                if !running_removed.load(Ordering::SeqCst) {
                    return Ok(());
                }
                if let Some(dev) = info.as_ref() {
                    if let Ok(hid) = dev.Id() {
                        let id = hid.to_string();
                        let payload = BluetoothPayload {
                            name: id,
                            connected: false,
                            device_type: Some("generic".to_string()),
                        };
                        let _ = app_removed.emit("bluetooth://state", &payload);
                    }
                }
                Ok(())
            },
        ));

        let _ = watcher.Start();

        while is_running.load(Ordering::SeqCst) {
            thread::sleep(std::time::Duration::from_millis(500));
        }

        let _ = watcher.Stop();
    });

    *thread_guard = Some(handle);
}

pub fn stop_bluetooth_monitor(app: &AppHandle) {
    let state = app.state::<BluetoothEventsState>();
    state.is_running.store(false, Ordering::SeqCst);
    let mut thread_guard = state.thread_handle.lock().unwrap();
    if let Some(handle) = thread_guard.take() {
        let _ = handle.join();
    }
}
