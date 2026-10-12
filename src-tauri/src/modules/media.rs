use serde::{Deserialize, Serialize};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use windows::Foundation::TypedEventHandler;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession,
    GlobalSystemMediaTransportControlsSessionManager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus,
};
use windows::Storage::Streams::{DataReader, InputStreamOptions};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MediaSnapshot {
    pub has_session: bool,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub source_app: Option<String>,
    pub is_playing: bool,
    pub playback_rate: f64,
    pub position_ms: u64,
    pub duration_ms: u64,
    pub can_play_pause: bool,
    pub can_next: bool,
    pub can_previous: bool,
    pub thumbnail_version: u64,
}

impl Default for MediaSnapshot {
    fn default() -> Self {
        Self {
            has_session: false,
            title: String::new(),
            artist: String::new(),
            album: String::new(),
            source_app: None,
            is_playing: false,
            playback_rate: 1.0,
            position_ms: 0,
            duration_ms: 0,
            can_play_pause: false,
            can_next: false,
            can_previous: false,
            thumbnail_version: 0,
        }
    }
}

pub struct MediaState {
    pub snapshot: Arc<Mutex<MediaSnapshot>>,
    pub thumbnail: Arc<Mutex<Option<Vec<u8>>>>,
    pub active_session: Arc<Mutex<Option<GlobalSystemMediaTransportControlsSession>>>,
    pub worker_sender: Mutex<Option<Sender<WorkerMessage>>>,
    pub worker_thread: Mutex<Option<JoinHandle<()>>>,
}

impl MediaState {
    pub fn new() -> Self {
        Self {
            snapshot: Arc::new(Mutex::new(MediaSnapshot::default())),
            thumbnail: Arc::new(Mutex::new(None)),
            active_session: Arc::new(Mutex::new(None)),
            worker_sender: Mutex::new(None),
            worker_thread: Mutex::new(None),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum WorkerMessage {
    Update,
    TimelineOnly,
    Stop,
}

/// Extrapolates current track playback position using Windows timeline properties
fn calculate_extrapolated_position(
    position_duration_hn: i64,
    end_duration_hn: i64,
    last_updated_filetime_hn: i64,
    is_playing: bool,
    playback_rate: f64,
) -> (u64, u64) {
    let raw_pos_ms = (position_duration_hn.max(0) / 10_000) as u64;
    let duration_ms = (end_duration_hn.max(0) / 10_000) as u64;

    if !is_playing || playback_rate <= 0.0 || last_updated_filetime_hn <= 0 {
        return (raw_pos_ms.min(duration_ms), duration_ms);
    }

    // Convert filetime (100-ns since 1601-01-01) to unix ms
    let updated_unix_ms = (last_updated_filetime_hn - 116_444_736_000_000_000) / 10_000;
    let now_unix_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(updated_unix_ms);

    let elapsed_ms = (now_unix_ms - updated_unix_ms).max(0) as u64;
    let extra_ms = (elapsed_ms as f64 * playback_rate) as u64;

    let extrapolated = (raw_pos_ms + extra_ms).min(duration_ms);
    (extrapolated, duration_ms)
}

/// Starts the background media worker thread if not already running.
/// Idempotent.
pub fn start_media_worker(app: &AppHandle) {
    let state = app.state::<MediaState>();
    let mut sender_guard = state.worker_sender.lock().unwrap();
    if sender_guard.is_some() {
        return;
    }

    let (tx, rx) = channel::<WorkerMessage>();
    *sender_guard = Some(tx.clone());

    let app_handle = app.clone();
    let snapshot_arc = state.snapshot.clone();
    let thumbnail_arc = state.thumbnail.clone();
    let session_arc = state.active_session.clone();

    let thread_handle = thread::spawn(move || {
        let manager = match GlobalSystemMediaTransportControlsSessionManager::RequestAsync() {
            Ok(op) => match op.join() {
                Ok(m) => m,
                Err(e) => {
                    eprintln!("[media] Failed to get session manager: {e}");
                    return;
                }
            },
            Err(e) => {
                eprintln!("[media] Failed to request session manager: {e}");
                return;
            }
        };

        let tx_session = tx.clone();
        let manager_token = match manager.CurrentSessionChanged(&TypedEventHandler::new(
            move |_sender, _args| {
                let _ = tx_session.send(WorkerMessage::Update);
                Ok(())
            },
        )) {
            Ok(token) => Some(token),
            Err(e) => {
                eprintln!("[media] Failed to register CurrentSessionChanged: {e}");
                None
            }
        };

        struct ActiveSessionSub {
            session: GlobalSystemMediaTransportControlsSession,
            media_token: Option<i64>,
            playback_token: Option<i64>,
            timeline_token: Option<i64>,
        }

        impl ActiveSessionSub {
            fn unsubscribe(&mut self) {
                if let Some(t) = self.media_token.take() {
                    let _ = self.session.RemoveMediaPropertiesChanged(t);
                }
                if let Some(t) = self.playback_token.take() {
                    let _ = self.session.RemovePlaybackInfoChanged(t);
                }
                if let Some(t) = self.timeline_token.take() {
                    let _ = self.session.RemoveTimelinePropertiesChanged(t);
                }
            }
        }

        impl Drop for ActiveSessionSub {
            fn drop(&mut self) {
                self.unsubscribe();
            }
        }

        let mut current_sub: Option<ActiveSessionSub> = None;
        let mut last_track_key = String::new();
        let mut current_thumb_ver = 0u64;

        // Perform initial poll to populate state immediately
        let _ = tx.send(WorkerMessage::Update);

        while let Ok(msg) = rx.recv() {
            if msg == WorkerMessage::Stop {
                break;
            }

            // Coalesce rapid burst updates within 80ms
            let mut should_stop = false;
            let mut is_timeline_only = msg == WorkerMessage::TimelineOnly;

            while let Ok(next_msg) = rx.recv_timeout(Duration::from_millis(80)) {
                if next_msg == WorkerMessage::Stop {
                    should_stop = true;
                    break;
                }
                if next_msg != WorkerMessage::TimelineOnly {
                    is_timeline_only = false;
                }
            }

            if should_stop {
                break;
            }

            // Query current session
            let active_sess_res = manager.GetCurrentSession();
            let has_session = active_sess_res.is_ok();

            if let Ok(ref session) = active_sess_res {
                // If the active session instance changed, re-subscribe tokens
                let need_resub = match current_sub.as_ref() {
                    Some(sub) => sub.session != *session,
                    None => true,
                };

                if need_resub {
                    if let Some(mut old_sub) = current_sub.take() {
                        old_sub.unsubscribe();
                    }

                    let tx_m = tx.clone();
                    let m_token = session
                        .MediaPropertiesChanged(&TypedEventHandler::new(move |_sender, _args| {
                            let _ = tx_m.send(WorkerMessage::Update);
                            Ok(())
                        }))
                        .ok();

                    let tx_p = tx.clone();
                    let p_token = session
                        .PlaybackInfoChanged(&TypedEventHandler::new(move |_sender, _args| {
                            let _ = tx_p.send(WorkerMessage::Update);
                            Ok(())
                        }))
                        .ok();

                    let tx_t = tx.clone();
                    let t_token = session
                        .TimelinePropertiesChanged(&TypedEventHandler::new(move |_sender, _args| {
                            let _ = tx_t.send(WorkerMessage::TimelineOnly);
                            Ok(())
                        }))
                        .ok();

                    current_sub = Some(ActiveSessionSub {
                        session: session.clone(),
                        media_token: m_token,
                        playback_token: p_token,
                        timeline_token: t_token,
                    });
                }
            } else if let Some(mut old_sub) = current_sub.take() {
                old_sub.unsubscribe();
            }

            // Store active session reference for commands
            {
                let mut sess_guard = session_arc.lock().unwrap();
                *sess_guard = active_sess_res.as_ref().ok().cloned();
            }

            if !has_session {
                // No session active: clear state & thumbnail
                let mut snap_guard = snapshot_arc.lock().unwrap();
                if snap_guard.has_session {
                    let new_snap = MediaSnapshot::default();
                    *snap_guard = new_snap.clone();
                    *thumbnail_arc.lock().unwrap() = None;
                    let _ = app_handle.emit("media://state", &new_snap);
                }
                last_track_key.clear();
                continue;
            }

            let session = active_sess_res.unwrap();

            // Extract App UserModelId / Source
            let source_app = session
                .SourceAppUserModelId()
                .ok()
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty());

            // Extract Media Properties (Title, Artist, Album, Thumbnail)
            let (title, artist, album, track_key, new_thumb_bytes) =
                if let Ok(props_op) = session.TryGetMediaPropertiesAsync() {
                    if let Ok(props) = props_op.join() {
                        let t = props.Title().map(|s| s.to_string()).unwrap_or_default();
                        let a = props.Artist().map(|s| s.to_string()).unwrap_or_default();
                        let al = props.AlbumTitle().map(|s| s.to_string()).unwrap_or_default();
                        let key = format!("{t}|{a}|{al}");

                        let thumb = if key != last_track_key {
                            // Track changed: attempt to read thumbnail up to 2 MB
                            if let Ok(thumb_ref) = props.Thumbnail() {
                                if let Ok(stream_op) = thumb_ref.OpenReadAsync() {
                                    if let Ok(stream) = stream_op.join() {
                                        if let Ok(size) = stream.Size() {
                                            if size > 0 && size <= 2 * 1024 * 1024 {
                                                if let Ok(reader) = DataReader::CreateDataReader(&stream) {
                                                    let _ = reader.SetInputStreamOptions(InputStreamOptions::None);
                                                    if let Ok(load_op) = reader.LoadAsync(size as u32) {
                                                        if load_op.join().is_ok() {
                                                            let mut buf = vec![0u8; size as usize];
                                                            if reader.ReadBytes(&mut buf).is_ok() {
                                                                Some(buf)
                                                            } else {
                                                                None
                                                            }
                                                        } else {
                                                            None
                                                        }
                                                    } else {
                                                        None
                                                    }
                                                } else {
                                                    None
                                                }
                                            } else {
                                                None
                                            }
                                        } else {
                                            None
                                        }
                                    } else {
                                        None
                                    }
                                } else {
                                    None
                                }
                            } else {
                                None
                            }
                        } else {
                            None
                        };

                        (t, a, al, key, thumb)
                    } else {
                        (String::new(), String::new(), String::new(), String::new(), None)
                    }
                } else {
                    (String::new(), String::new(), String::new(), String::new(), None)
                };

            // Extract Playback Info
            let (is_playing, playback_rate, can_play_pause, can_next, can_previous) =
                if let Ok(info) = session.GetPlaybackInfo() {
                    let status = info
                        .PlaybackStatus()
                        .unwrap_or(GlobalSystemMediaTransportControlsSessionPlaybackStatus::Closed);
                    let playing = status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;
                    let rate = info
                        .PlaybackRate()
                        .map(|r| r.Value())
                        .unwrap_or(Ok(1.0))
                        .unwrap_or(1.0);

                    let (cpp, cn, cp) = if let Ok(ctrls) = info.Controls() {
                        (
                            ctrls.IsPlayPauseToggleEnabled().unwrap_or(false)
                                || ctrls.IsPlayEnabled().unwrap_or(false)
                                || ctrls.IsPauseEnabled().unwrap_or(false),
                            ctrls.IsNextEnabled().unwrap_or(false),
                            ctrls.IsPreviousEnabled().unwrap_or(false),
                        )
                    } else {
                        (true, true, true)
                    };

                    (playing, rate, cpp, cn, cp)
                } else {
                    (false, 1.0, false, false, false)
                };

            // Extract Timeline Properties
            let (pos_hn, end_hn, updated_hn) = if let Ok(timeline) = session.GetTimelineProperties() {
                (
                    timeline.Position().map(|ts| ts.Duration).unwrap_or(0),
                    timeline.EndTime().map(|ts| ts.Duration).unwrap_or(0),
                    timeline.LastUpdatedTime().map(|dt| dt.UniversalTime).unwrap_or(0),
                )
            } else {
                (0, 0, 0)
            };

            let (extrapolated_pos, duration_ms) = calculate_extrapolated_position(
                pos_hn,
                end_hn,
                updated_hn,
                is_playing,
                playback_rate,
            );

            // Handle track change & thumbnail updates
            if track_key != last_track_key {
                last_track_key = track_key.clone();
                current_thumb_ver = current_thumb_ver.wrapping_add(1);
                *thumbnail_arc.lock().unwrap() = new_thumb_bytes;
            }

            // Check if this is an ignorable TimelineOnly burst
            if is_timeline_only {
                let snap = snapshot_arc.lock().unwrap();
                if snap.has_session
                    && snap.is_playing == is_playing
                    && snap.title == title
                    && snap.artist == artist
                {
                    let diff = (extrapolated_pos as i64 - snap.position_ms as i64).abs();
                    if diff <= 2000 {
                        // Position within 2 seconds of extrapolated normal playback progress: skip update
                        continue;
                    }
                }
            }

            let new_snapshot = MediaSnapshot {
                has_session: true,
                title,
                artist,
                album,
                source_app,
                is_playing,
                playback_rate,
                position_ms: extrapolated_pos,
                duration_ms,
                can_play_pause,
                can_next,
                can_previous,
                thumbnail_version: current_thumb_ver,
            };

            // Emit event if snapshot changed
            let mut snap_guard = snapshot_arc.lock().unwrap();
            if *snap_guard != new_snapshot {
                *snap_guard = new_snapshot.clone();
                let _ = app_handle.emit("media://state", &new_snapshot);
            }
        }

        // Cleanup manager registration on exit
        if let Some(token) = manager_token {
            let _ = manager.RemoveCurrentSessionChanged(token);
        }
        if let Some(mut sub) = current_sub.take() {
            sub.unsubscribe();
        }
    });

    let mut thread_guard = state.worker_thread.lock().unwrap();
    *thread_guard = Some(thread_handle);
}

/// Fully stops the media worker thread, unsubscribes handlers, and joins thread.
/// Idempotent.
pub fn stop_media_worker(app: &AppHandle) {
    let state = app.state::<MediaState>();

    let sender = {
        let mut sender_guard = state.worker_sender.lock().unwrap();
        sender_guard.take()
    };

    if let Some(tx) = sender {
        let _ = tx.send(WorkerMessage::Stop);
    }

    let thread = {
        let mut thread_guard = state.worker_thread.lock().unwrap();
        thread_guard.take()
    };

    if let Some(handle) = thread {
        let _ = handle.join();
    }

    // Clear active session and cached thumbnail
    *state.active_session.lock().unwrap() = None;
    *state.thumbnail.lock().unwrap() = None;
}

// ----------------------------------------------------------------------------
// Tauri Commands
// ----------------------------------------------------------------------------

#[tauri::command]
pub fn media_get_state(state: tauri::State<MediaState>) -> MediaSnapshot {
    state.snapshot.lock().unwrap().clone()
}

#[tauri::command]
pub fn media_get_thumbnail(state: tauri::State<MediaState>) -> tauri::ipc::Response {
    let bytes = state
        .thumbnail
        .lock()
        .unwrap()
        .clone()
        .unwrap_or_default();
    tauri::ipc::Response::new(bytes)
}

#[tauri::command]
pub fn media_play_pause(state: tauri::State<MediaState>) {
    if let Some(session) = state.active_session.lock().unwrap().as_ref() {
        let _ = session.TryTogglePlayPauseAsync();
    }
}

#[tauri::command]
pub fn media_next(state: tauri::State<MediaState>) {
    if let Some(session) = state.active_session.lock().unwrap().as_ref() {
        let _ = session.TrySkipNextAsync();
    }
}

#[tauri::command]
pub fn media_previous(state: tauri::State<MediaState>) {
    if let Some(session) = state.active_session.lock().unwrap().as_ref() {
        let _ = session.TrySkipPreviousAsync();
    }
}

fn get_master_endpoint_volume() -> Result<windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume, String> {
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("Failed to create MMDeviceEnumerator: {e}"))?;
        let device = enumerator
            .GetDefaultAudioEndpoint(eRender, eMultimedia)
            .map_err(|e| format!("Failed to get default audio endpoint: {e}"))?;
        let endpoint_volume: IAudioEndpointVolume = device
            .Activate(CLSCTX_ALL, None)
            .map_err(|e| format!("Failed to activate IAudioEndpointVolume: {e}"))?;
        Ok(endpoint_volume)
    }
}

#[tauri::command]
pub fn media_get_volume() -> Result<f32, String> {
    let endpoint = get_master_endpoint_volume()?;
    unsafe {
        endpoint
            .GetMasterVolumeLevelScalar()
            .map_err(|e| format!("Failed to get master volume: {e}"))
    }
}

#[tauri::command]
pub fn media_set_volume(volume: f32) -> Result<(), String> {
    let clamped = volume.clamp(0.0, 1.0);
    let endpoint = get_master_endpoint_volume()?;
    unsafe {
        endpoint
            .SetMasterVolumeLevelScalar(clamped, std::ptr::null())
            .map_err(|e| format!("Failed to set master volume: {e}"))?;
        if clamped > 0.0 {
            if let Ok(is_muted) = endpoint.GetMute() {
                if is_muted.as_bool() {
                    let _ = endpoint.SetMute(false, std::ptr::null());
                }
            }
        }
        Ok(())
    }
}

