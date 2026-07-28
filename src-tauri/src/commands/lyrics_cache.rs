use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const CACHE_FILE: &str = "lyrics-cache.json";
const MAX_CACHE_SIZE: usize = 2_000_000; // ~2MB

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    pub s: Option<String>,
    pub p: Option<String>,
    pub t: u64,
}

fn cache_dir(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir")
        .join(".cache");
    if !dir.exists() {
        fs::create_dir_all(&dir).ok();
    }
    dir
}

fn cache_path(app: &AppHandle) -> PathBuf {
    cache_dir(app).join(CACHE_FILE)
}

fn read_cache(app: &AppHandle) -> HashMap<String, CacheEntry> {
    let path = cache_path(app);
    match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
        Err(_) => HashMap::new(),
    }
}

fn write_cache(app: &AppHandle, mut data: HashMap<String, CacheEntry>) {
    let json = serde_json::to_string(&data).unwrap_or_default();
    if json.len() > MAX_CACHE_SIZE {
        // Evict oldest 30% of entries
        let mut entries: Vec<(String, CacheEntry)> = data.into_iter().collect();
        entries.sort_by_key(|(_, e)| e.t);
        let evict = (entries.len() as f64 * 0.3).ceil() as usize;
        entries.drain(..evict);
        data = entries.into_iter().collect();
    }
    let json = serde_json::to_string(&data).unwrap_or_default();
    let path = cache_path(app);
    fs::write(path, json).ok();
}

#[tauri::command]
pub async fn cache_get_lyrics(app: AppHandle, track_id: String) -> Option<CacheEntry> {
    let cache = read_cache(&app);
    cache.get(&track_id).cloned()
}

#[tauri::command]
pub async fn cache_set_lyrics(
    app: AppHandle,
    track_id: String,
    entry: CacheEntry,
) -> Result<(), String> {
    let mut cache = read_cache(&app);
    cache.insert(track_id, entry);
    write_cache(&app, cache);
    Ok(())
}
