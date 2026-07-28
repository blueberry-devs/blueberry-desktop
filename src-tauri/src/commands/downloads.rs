use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const DOWNLOADS_DIR: &str = "downloads";

fn downloads_dir(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir")
        .join(DOWNLOADS_DIR);
    if !dir.exists() {
        fs::create_dir_all(&dir).ok();
    }
    dir
}

fn sanitize_track_id(id: &str) -> String {
    id.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

#[tauri::command]
pub async fn download_track(
    app: AppHandle,
    track_id: String,
    url: String,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Download failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Download failed: HTTP {}", resp.status()));
    }

    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let ext = if content_type.contains("mp4") || content_type.contains("m4a") {
        "m4a"
    } else {
        "mp3"
    };

    let file_path = downloads_dir(&app).join(format!("{}.{ext}", sanitize_track_id(&track_id)));
    let bytes = resp.bytes().await.map_err(|e| format!("Read failed: {e}"))?;

    let mut file = fs::File::create(&file_path).map_err(|e| format!("File create failed: {e}"))?;
    file.write_all(&bytes)
        .map_err(|e| format!("Write failed: {e}"))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn remove_download(file_path: String) -> Result<(), String> {
    fs::remove_file(&file_path).ok(); // Silently ignore if already gone
    Ok(())
}
