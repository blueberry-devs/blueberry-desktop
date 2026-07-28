use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn store_dir(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir")
        .join("store");
    if !dir.exists() {
        fs::create_dir_all(&dir).ok();
    }
    dir
}

fn store_path(app: &AppHandle, key: &str) -> PathBuf {
    store_dir(app).join(format!("{key}.json"))
}

#[tauri::command]
pub async fn store_get(app: AppHandle, key: String) -> Option<String> {
    let path = store_path(&app, &key);
    fs::read_to_string(path).ok()
}

#[tauri::command]
pub async fn store_set(app: AppHandle, key: String, data: String) -> Result<(), String> {
    let path = store_path(&app, &key);
    fs::write(path, data).map_err(|e| e.to_string())
}
