use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use tauri::{AppHandle, Emitter, Manager};
use windows::Devices::Power::Battery;
use windows::Foundation::TypedEventHandler;
use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerPayload {
    pub on_ac: bool,
    pub percent: u8,
    pub charging: bool,
}

pub struct PowerEventsState {
    is_running: Arc<AtomicBool>,
    last_on_ac: Arc<Mutex<Option<bool>>>,
    last_percent: Arc<Mutex<Option<u8>>>,
    thread_handle: Mutex<Option<JoinHandle<()>>>,
}

impl PowerEventsState {
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            last_on_ac: Arc::new(Mutex::new(None)),
            last_percent: Arc::new(Mutex::new(None)),
            thread_handle: Mutex::new(None),
        }
    }
}

pub fn start_power_monitor(app: &AppHandle) {
    let state = app.state::<PowerEventsState>();
    let mut thread_guard = state.thread_handle.lock().unwrap();
    if state.is_running.load(Ordering::SeqCst) || thread_guard.is_some() {
        return;
    }

    state.is_running.store(true, Ordering::SeqCst);
    let is_running = state.is_running.clone();
    let last_on_ac = state.last_on_ac.clone();
    let last_percent = state.last_percent.clone();
    let app_handle = app.clone();

    let handle = thread::spawn(move || {
        // Initialize current state baseline
        let mut initial_status = SYSTEM_POWER_STATUS::default();
        unsafe {
            if GetSystemPowerStatus(&mut initial_status).is_ok() {
                let on_ac = initial_status.ACLineStatus == 1;
                let pct = if initial_status.BatteryLifePercent <= 100 {
                    initial_status.BatteryLifePercent
                } else {
                    100
                };
                *last_on_ac.lock().unwrap() = Some(on_ac);
                *last_percent.lock().unwrap() = Some(pct);
            }
        }

        let battery = match Battery::AggregateBattery() {
            Ok(b) => b,
            Err(e) => {
                eprintln!("[power_events] Failed to get AggregateBattery: {e}");
                return;
            }
        };

        let app_cb = app_handle.clone();
        let running_cb = is_running.clone();
        let last_ac_cb = last_on_ac.clone();
        let last_pct_cb = last_percent.clone();

        let token = match battery.ReportUpdated(&TypedEventHandler::new(
            move |_sender, _args| {
                if !running_cb.load(Ordering::SeqCst) {
                    return Ok(());
                }

                let mut cur_status = SYSTEM_POWER_STATUS::default();
                unsafe {
                    if GetSystemPowerStatus(&mut cur_status).is_err() {
                        return Ok(());
                    }
                }

                let cur_on_ac = cur_status.ACLineStatus == 1;
                let cur_pct = if cur_status.BatteryLifePercent <= 100 {
                    cur_status.BatteryLifePercent
                } else {
                    100
                };
                let cur_charging = cur_on_ac && cur_pct < 100;

                let mut emit_event = false;

                // 1. Check ACLineStatus changes (plugged in / unplugged)
                let mut ac_guard = last_ac_cb.lock().unwrap();
                if let Some(prev_ac) = *ac_guard {
                    if prev_ac != cur_on_ac {
                        emit_event = true;
                    }
                }
                *ac_guard = Some(cur_on_ac);

                // 2. Check percent threshold crossings (20% & 10% discharging, or 100% full)
                let mut pct_guard = last_pct_cb.lock().unwrap();
                if let Some(prev_pct) = *pct_guard {
                    if !cur_on_ac {
                        // Discharging: crossed 20% or 10%
                        if (prev_pct > 20 && cur_pct <= 20) || (prev_pct > 10 && cur_pct <= 10) {
                            emit_event = true;
                        }
                    } else if prev_pct < 100 && cur_pct >= 100 {
                        // Charging reached 100%
                        emit_event = true;
                    }
                }
                *pct_guard = Some(cur_pct);

                if emit_event {
                    let payload = PowerPayload {
                        on_ac: cur_on_ac,
                        percent: cur_pct,
                        charging: cur_charging,
                    };
                    let _ = app_cb.emit("power://state", &payload);
                }

                Ok(())
            },
        )) {
            Ok(tok) => tok,
            Err(e) => {
                eprintln!("[power_events] Failed to register ReportUpdated: {e}");
                return;
            }
        };

        // Keep thread alive until unsubscribed/stopped
        while is_running.load(Ordering::SeqCst) {
            thread::sleep(std::time::Duration::from_millis(500));
        }

        let _ = battery.RemoveReportUpdated(token);
    });

    *thread_guard = Some(handle);
}

pub fn stop_power_monitor(app: &AppHandle) {
    let state = app.state::<PowerEventsState>();
    state.is_running.store(false, Ordering::SeqCst);
    let mut thread_guard = state.thread_handle.lock().unwrap();
    if let Some(handle) = thread_guard.take() {
        let _ = handle.join();
    }
}
