use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    App, Emitter, Manager,
};

pub fn create_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let play_pause = MenuItem::with_id(app, "play-pause", "Play", true, None::<&str>)?;
    let next = MenuItem::with_id(app, "next", "Next", true, None::<&str>)?;
    let prev = MenuItem::with_id(app, "prev", "Previous", true, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
    let check_updates =
        MenuItem::with_id(app, "check-updates", "Check for Updates", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let sep3 = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(
        app,
        &[
            &play_pause,
            &sep1,
            &next,
            &prev,
            &sep2,
            &show,
            &sep3,
            &check_updates,
            &quit,
        ],
    )?;

    TrayIconBuilder::with_id("main")
        .tooltip("Blueberry Desktop")
        .menu(&menu)
        .on_menu_event(move |app, event| {
            let id = event.id().as_ref();
            match id {
                "play-pause" => {
                    let _ = app.emit("tray-command", "togglePlay");
                }
                "next" => {
                    let _ = app.emit("tray-command", "next");
                }
                "prev" => {
                    let _ = app.emit("tray-command", "prev");
                }
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "check-updates" => {
                    let handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        crate::commands::app::auto_check_update(handle).await;
                    });
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
