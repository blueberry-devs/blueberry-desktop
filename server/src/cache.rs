use std::sync::Arc;
use std::time::Duration;

use moka::future::Cache;

use crate::soundcloud;
use crate::spotify::SpotifyClient;
use crate::types::{ResolvedStream, SyncedLyrics, TrackResult};

pub struct AppState {
    pub http: reqwest::Client,
    pub sc_search_cache: Cache<String, Vec<TrackResult>>,
    pub sc_resolve_cache: Cache<String, ResolvedStream>,
    pub lyrics_cache: Cache<String, SyncedLyrics>,
    pub stream_cache: Cache<String, ResolvedStream>,
    pub clip_cache: Cache<String, Option<String>>,
    pub photo_cache: Cache<String, Option<String>>,
    pub pl_tracks_cache: Cache<String, Vec<TrackResult>>,
    pub video_stream_cache: Cache<String, String>,
    pub soundcloud_client_id: String,
    pub yandex_token: String,
    pub yandex_proxy_url: Option<String>,
    pub deezer_http: reqwest::Client,
    pub spotify: SpotifyClient,
    pub sidecar_port: u16,
}

#[derive(Clone)]
pub struct SharedState(pub Arc<AppState>);

pub async fn new_state() -> SharedState {
    let http_client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .unwrap();

    let deezer_http = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .unwrap();

    let mut soundcloud_client_id = std::env::var("SOUNDCLOUD_CLIENT_ID").unwrap_or_default();
    if soundcloud_client_id.is_empty() {
        if let Some(id) = soundcloud::extract_client_id(&http_client).await {
            soundcloud_client_id = id;
        }
    }
    let yandex_token = std::env::var("YANDEX_TOKEN").unwrap_or_default();
    let yandex_proxy_url = std::env::var("YANDEX_PROXY_URL").ok();
    let spotify_client_id = std::env::var("SPOTIFY_CLIENT_ID").unwrap_or_default();
    let spotify_client_secret = std::env::var("SPOTIFY_CLIENT_SECRET").unwrap_or_default();
    let sidecar_port = std::env::var("SIDECAR_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8787);

    SharedState(Arc::new(AppState {
        http: http_client,
        sc_search_cache: Cache::builder()
            .max_capacity(1000)
            .time_to_live(Duration::from_secs(3600))
            .build(),
        sc_resolve_cache: Cache::builder()
            .max_capacity(1000)
            .time_to_live(Duration::from_secs(3600))
            .build(),
        lyrics_cache: Cache::builder()
            .max_capacity(2000)
            .time_to_live(Duration::from_secs(6 * 3600))
            .build(),
        stream_cache: Cache::builder()
            .max_capacity(1000)
            .time_to_live(Duration::from_secs(1800))
            .build(),
        clip_cache: Cache::builder()
            .max_capacity(1000)
            .time_to_live(Duration::from_secs(6 * 3600))
            .build(),
        photo_cache: Cache::builder()
            .max_capacity(500)
            .time_to_live(Duration::from_secs(86400))
            .build(),
        pl_tracks_cache: Cache::builder()
            .max_capacity(500)
            .time_to_live(Duration::from_secs(600))
            .build(),
        video_stream_cache: Cache::builder()
            .max_capacity(200)
            .time_to_live(Duration::from_secs(3600))
            .build(),
        soundcloud_client_id,
        yandex_token,
        yandex_proxy_url,
        deezer_http,
        spotify: SpotifyClient::new(spotify_client_id, spotify_client_secret),
        sidecar_port,
    }))
}
