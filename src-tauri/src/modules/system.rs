use serde::{Deserialize, Serialize};
use windows::Devices::Radios::{Radio, RadioKind, RadioState};
use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemControlsState {
    pub wifi_enabled: bool,
    pub wifi_name: Option<String>,
    pub bluetooth_enabled: bool,
    pub energy_saver_enabled: bool,
    pub battery_level: f32,
    pub is_charging: bool,
}

impl Default for SystemControlsState {
    fn default() -> Self {
        Self {
            wifi_enabled: true,
            wifi_name: Some("Wi-Fi".to_string()),
            bluetooth_enabled: false,
            energy_saver_enabled: false,
            battery_level: 1.0,
            is_charging: true,
        }
    }
}

fn get_wifi_ssid_from_netsh() -> Option<String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let output = Command::new("netsh")
        .args(["wlan", "show", "interfaces"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let text = String::from_utf8_lossy(&output.stdout);
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("SSID") && !trimmed.starts_with("BSSID") && trimmed.contains(':') {
            let parts: Vec<&str> = trimmed.splitn(2, ':').collect();
            if parts.len() == 2 {
                let ssid = parts[1].trim();
                if !ssid.is_empty() {
                    return Some(ssid.to_string());
                }
            }
        }
    }
    None
}

#[tauri::command]
pub fn system_get_controls() -> SystemControlsState {
    let mut state = SystemControlsState::default();

    // 1. Battery & Power Status via GetSystemPowerStatus
    let mut power_status = SYSTEM_POWER_STATUS::default();
    unsafe {
        if GetSystemPowerStatus(&mut power_status).is_ok() {
            if power_status.BatteryLifePercent != 255 {
                state.battery_level = (power_status.BatteryLifePercent as f32) / 100.0;
            } else {
                state.battery_level = 1.0;
            }
            state.is_charging = power_status.ACLineStatus == 1;
            state.energy_saver_enabled = power_status.SystemStatusFlag == 1;
        }
    }

    // 2. Wi-Fi and Bluetooth via WinRT Radios
    if let Ok(op) = Radio::GetRadiosAsync() {
        if let Ok(radios) = op.join() {
            let count = radios.Size().unwrap_or(0);
            for i in 0..count {
                if let Ok(radio) = radios.GetAt(i) {
                    if let Ok(kind) = radio.Kind() {
                        let is_on = radio.State().map(|s| s == RadioState::On).unwrap_or(false);
                        match kind {
                            RadioKind::WiFi => {
                                state.wifi_enabled = is_on;
                            }
                            RadioKind::Bluetooth => {
                                state.bluetooth_enabled = is_on;
                            }
                            _ => {}
                        }
                    }
                }
            }
        }
    }

    // 3. Fetch connected Wi-Fi SSID if Wi-Fi is on
    if state.wifi_enabled {
        if let Some(ssid) = get_wifi_ssid_from_netsh() {
            state.wifi_name = Some(ssid);
        } else {
            state.wifi_name = Some("Connected".to_string());
        }
    } else {
        state.wifi_name = None;
    }

    state
}

#[tauri::command]
pub fn system_toggle_wifi(enable: Option<bool>) -> Result<bool, String> {
    if let Ok(op) = Radio::GetRadiosAsync() {
        if let Ok(radios) = op.join() {
            let count = radios.Size().unwrap_or(0);
            for i in 0..count {
                if let Ok(radio) = radios.GetAt(i) {
                    if let Ok(kind) = radio.Kind() {
                        if kind == RadioKind::WiFi {
                            let cur_state = radio.State().map(|s| s == RadioState::On).unwrap_or(false);
                            let target = enable.unwrap_or(!cur_state);
                            let target_state = if target { RadioState::On } else { RadioState::Off };
                            if let Ok(set_op) = radio.SetStateAsync(target_state) {
                                let _ = set_op.join();
                                return Ok(target);
                            }
                        }
                    }
                }
            }
        }
    }

    // Fallback: Open Windows Wi-Fi settings if direct toggle is restricted
    let _ = std::process::Command::new("cmd")
        .args(["/c", "start", "ms-settings:network-wifi"])
        .spawn();

    Ok(false)
}

#[tauri::command]
pub fn system_toggle_bluetooth(enable: Option<bool>) -> Result<bool, String> {
    if let Ok(op) = Radio::GetRadiosAsync() {
        if let Ok(radios) = op.join() {
            let count = radios.Size().unwrap_or(0);
            for i in 0..count {
                if let Ok(radio) = radios.GetAt(i) {
                    if let Ok(kind) = radio.Kind() {
                        if kind == RadioKind::Bluetooth {
                            let cur_state = radio.State().map(|s| s == RadioState::On).unwrap_or(false);
                            let target = enable.unwrap_or(!cur_state);
                            let target_state = if target { RadioState::On } else { RadioState::Off };
                            if let Ok(set_op) = radio.SetStateAsync(target_state) {
                                let _ = set_op.join();
                                return Ok(target);
                            }
                        }
                    }
                }
            }
        }
    }

    // Fallback: Open Bluetooth settings if direct toggle is restricted
    let _ = std::process::Command::new("cmd")
        .args(["/c", "start", "ms-settings:bluetooth"])
        .spawn();

    Ok(false)
}

#[tauri::command]
pub fn system_toggle_energy_saver() -> Result<bool, String> {
    // Open Windows Battery / Power settings
    let _ = std::process::Command::new("cmd")
        .args(["/c", "start", "ms-settings:batterysaver"])
        .spawn();

    Ok(true)
}
