pub mod modules;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Second launch exits; first instance restores/enables the notch if disabled
            if args.iter().any(|arg| arg == "--toggle") {
                modules::app_state::toggle(app);
            } else if args.iter().any(|arg| arg == "--disable") {
                modules::app_state::disable(app);
            } else if args.iter().any(|arg| arg == "--quit") {
                modules::app_state::quit(app);
            } else {
                modules::app_state::enable(app);
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            modules::hit_region::set_hit_region,
            modules::media::media_get_state,
            modules::media::media_get_thumbnail,
            modules::media::media_play_pause,
            modules::media::media_next,
            modules::media::media_previous,
            modules::media::media_get_volume,
            modules::media::media_set_volume,
        ])
        .setup(|app| {
            let app_handle = app.handle();
            let mut initial_enabled = modules::persistence::load_state(app_handle);
            if std::env::args().any(|arg| arg == "--disable") {
                initial_enabled = false;
            }
            let state = modules::app_state::AppState::new(initial_enabled);

            let toggle_item = modules::tray::setup_tray(app_handle, initial_enabled)?;
            *state.toggle_item.lock().unwrap() = Some(toggle_item);

            modules::hotkeys::setup_hotkey(app_handle);

            app.manage(state);
            app.manage(modules::media::MediaState::new());

            if initial_enabled {
                if let Err(e) = modules::window::create_main_window(app_handle) {
                    eprintln!("Failed to create main window at launch: {e}");
                    // If creating webview failed (e.g. another instance is using the profile), exit cleanly
                    std::process::exit(0);
                }
                modules::media::start_media_worker(app_handle);
            }

            Ok(())
        });

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::ExitRequested { code, api, .. } = event {
            let state = app_handle.state::<modules::app_state::AppState>();
            // If code is None (automatic exit because all windows closed) and we are intentionally disabled,
            // prevent exit so the tray stays alive.
            if code.is_none() && !state.is_quitting() && !state.is_enabled() {
                api.prevent_exit();
            }
        }
    });
}
