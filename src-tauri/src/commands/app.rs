use tauri::{AppHandle, Emitter};

#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
pub async fn check_russian_ip(app: AppHandle) -> Result<(), String> {
    do_check_russian_ip(app).await;
    Ok(())
}

pub async fn do_check_russian_ip(app: AppHandle) {
    let Ok(resp) = reqwest::get("https://ip-api.com/json/").await else {
        return;
    };
    let Ok(geo) = resp.json::<serde_json::Value>().await else {
        return;
    };
    if geo.get("countryCode").and_then(|v| v.as_str()) == Some("RU") {
        let _ = app.emit("notification:show", serde_json::json!({
            "type": "vpn",
            "title": "vpn",
            "message": ""
        }));
    }
}

#[tauri::command]
pub fn restart_app(app: AppHandle) {
    app.restart();
}

pub async fn auto_check_update(app: AppHandle) {
    // In packaged mode, use tauri-plugin-updater
    #[cfg(not(debug_assertions))]
    {
        use tauri_plugin_updater::UpdaterExt;
        let updater = match app.updater() {
            Ok(u) => u,
            Err(e) => {
                tracing::warn!("[updater] Failed to get updater: {e}");
                return;
            }
        };
        match updater.check().await {
            Ok(Some(update)) => {
                let version = update.version.clone();
                tracing::info!("[updater] Update available: {version}");

                if let Err(e) = update.download_and_install(|_, _| {}, || {}).await {
                    tracing::error!("[updater] Install failed: {e}");
                    return;
                }

                let _ = app.emit("notification:show", serde_json::json!({
                    "type": "update",
                    "title": "update",
                    "message": version
                }));
            }
            Ok(None) => {
                tracing::info!("[updater] Up to date");
            }
            Err(e) => {
                tracing::warn!("[updater] Check failed: {e}");
            }
        }
    }

    // In dev mode, check GitHub releases manually
    #[cfg(debug_assertions)]
    {
        let current_version = app.package_info().version.to_string();
        tracing::info!("[updater] dev check, current version: {current_version}");

        let client = reqwest::Client::builder()
            .user_agent("blueberry-desktop")
            .build()
            .unwrap();
        let resp = client
            .get("https://api.github.com/repos/blueberry-devs/blueberry-desktop/releases/latest")
            .send()
            .await;

        if let Ok(resp) = resp {
            if let Ok(release) = resp.json::<serde_json::Value>().await {
                let latest = release
                    .get("tag_name")
                    .or_else(|| release.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                if compare_versions(&current_version, latest) < 0 {
                    tracing::info!("[updater] Update available: {latest}");
                    let _ = app.emit("notification:show", serde_json::json!({
                        "type": "update",
                        "title": "update",
                        "message": latest
                    }));
                } else {
                    tracing::info!("[updater] up to date");
                }
            }
        }
    }
}

fn compare_versions(a: &str, b: &str) -> i32 {
    let pa: Vec<u64> = a.trim_start_matches('v').split('.').filter_map(|s| s.parse().ok()).collect();
    let pb: Vec<u64> = b.trim_start_matches('v').split('.').filter_map(|s| s.parse().ok()).collect();
    let len = pa.len().max(pb.len());
    for i in 0..len {
        let na = pa.get(i).copied().unwrap_or(0);
        let nb = pb.get(i).copied().unwrap_or(0);
        if na > nb { return 1; }
        if na < nb { return -1; }
    }
    0
}
