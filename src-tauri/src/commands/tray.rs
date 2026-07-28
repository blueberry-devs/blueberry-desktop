use serde::Deserialize;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayUpdateData {
    pub is_playing: bool,
    pub track: String,
    pub artist: String,
}

#[tauri::command]
pub async fn tray_update(app: AppHandle, data: TrayUpdateData) -> Result<(), String> {
    // Update tray tooltip
    if let Some(tray) = app.tray_by_id("main") {
        let tooltip = if data.track.is_empty() {
            "Blueberry Desktop".to_string()
        } else {
            format!("{} — {}", data.artist, data.track)
        };
        let _ = tray.set_tooltip(Some(&tooltip));
    }

    // Forward to frontend for tray menu state (play/pause label)
    let _ = app.emit("tray-state-update", serde_json::json!({
        "isPlaying": data.is_playing,
        "track": data.track,
        "artist": data.artist
    }));

    Ok(())
}
