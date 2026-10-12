use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread::{self, JoinHandle};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{
    eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumePayload {
    pub volume: f32, // 0.0 - 1.0
    pub muted: bool,
}

pub struct AudioEventsState {
    is_running: std::sync::Arc<AtomicBool>,
    thread_handle: Mutex<Option<JoinHandle<()>>>,
}

impl AudioEventsState {
    pub fn new() -> Self {
        Self {
            is_running: std::sync::Arc::new(AtomicBool::new(false)),
            thread_handle: Mutex::new(None),
        }
    }
}

pub fn start_audio_monitor(app: &AppHandle) {
    let state = app.state::<AudioEventsState>();
    let mut thread_guard = state.thread_handle.lock().unwrap();
    if state.is_running.load(Ordering::SeqCst) || thread_guard.is_some() {
        return;
    }

    state.is_running.store(true, Ordering::SeqCst);
    let is_running = state.is_running.clone();
    let app_handle = app.clone();

    let handle = thread::spawn(move || {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }

        let enumerator: Result<IMMDeviceEnumerator, _> = unsafe {
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
        };

        let enumerator = match enumerator {
            Ok(e) => e,
            Err(err) => {
                eprintln!("[audio_events] CoCreateInstance MMDeviceEnumerator failed: {err}");
                return;
            }
        };

        let device = match unsafe { enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia) } {
            Ok(d) => d,
            Err(err) => {
                eprintln!("[audio_events] GetDefaultAudioEndpoint failed: {err}");
                return;
            }
        };

        let endpoint_vol: Result<IAudioEndpointVolume, _> = unsafe {
            device.Activate(CLSCTX_ALL, None)
        };

        let endpoint_vol = match endpoint_vol {
            Ok(ev) => ev,
            Err(err) => {
                eprintln!("[audio_events] Activate IAudioEndpointVolume failed: {err}");
                return;
            }
        };

        let mut last_vol: Option<i32> = None;
        let mut last_muted: Option<bool> = None;

        // Initialize baseline
        unsafe {
            if let Ok(v) = endpoint_vol.GetMasterVolumeLevelScalar() {
                last_vol = Some((v * 100.0).round() as i32);
            }
            if let Ok(m) = endpoint_vol.GetMute() {
                last_muted = Some(m.as_bool());
            }
        }

        while is_running.load(Ordering::SeqCst) {
            unsafe {
                if let Ok(v) = endpoint_vol.GetMasterVolumeLevelScalar() {
                    let m = endpoint_vol.GetMute().map(|val| val.as_bool()).unwrap_or(false);
                    let rounded = (v * 100.0).round() as i32;

                    if last_vol.is_some() && (last_vol != Some(rounded) || last_muted != Some(m)) {
                        let _ = app_handle.emit(
                            "volume://change",
                            VolumePayload {
                                volume: v,
                                muted: m,
                            },
                        );
                    }

                    last_vol = Some(rounded);
                    last_muted = Some(m);
                }
            }
            thread::sleep(Duration::from_millis(60));
        }

        unsafe { CoUninitialize() };
    });

    *thread_guard = Some(handle);
}

pub fn stop_audio_monitor(app: &AppHandle) {
    let state = app.state::<AudioEventsState>();
    state.is_running.store(false, Ordering::SeqCst);
    let mut thread_guard = state.thread_handle.lock().unwrap();
    if let Some(handle) = thread_guard.take() {
        let _ = handle.join();
    }
}
