#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod sidecar;
mod tray;

use commands::discord::DiscordState;

fn main() {
    // Initialize tracing so sidecar/backend logs are visible in terminal
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,blueberry_desktop=debug".parse().unwrap()),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(DiscordState::default())
        .invoke_handler(tauri::generate_handler![
            commands::store::store_get,
            commands::store::store_set,
            commands::lyrics_cache::cache_get_lyrics,
            commands::lyrics_cache::cache_set_lyrics,
            commands::downloads::download_track,
            commands::downloads::remove_download,
            commands::discord::discord_update_presence,
            commands::discord::discord_clear_presence,
            commands::app::get_app_version,
            commands::app::check_russian_ip,
            commands::app::restart_app,
            commands::tray::tray_update,
        ])
        .setup(|app| {
            // Setup system tray
            tray::create_tray(app)?;

            // Start sidecar
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                sidecar::start_sidecar(handle).await;
            });

            // Check for updates after a short delay
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                commands::app::auto_check_update(handle).await;
            });

            // VPN check (non-dev only)
            #[cfg(not(debug_assertions))]
            {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_secs(8)).await;
                    commands::app::do_check_russian_ip(handle).await;
                });
            }

            // Discord: clear presence on startup
            #[cfg(not(debug_assertions))]
            {
                commands::discord::clear_on_startup();
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide instead of close (app stays in tray)
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Blueberry Desktop");
}
