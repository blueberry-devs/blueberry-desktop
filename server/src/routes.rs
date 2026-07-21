use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, HeaderName, HeaderValue, StatusCode};
use axum::response::{Json, Response};
use axum::routing::get;
use axum::Router;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::cache::SharedState;
use crate::lyrics;
use crate::soundcloud;
use crate::types::*;
use crate::yandex;
use crate::youtube;

fn clean_title(title: &str) -> String {
    let t = title.trim();
    for sep in &[" — ", " – ", " - "] {
        if let Some(idx) = t.find(sep) {
            let after = t[idx + sep.len()..].trim();
            if after.chars().any(|c| c.is_ascii_alphabetic()) && after.split_whitespace().count() > 1 {
                if t[..idx].split_whitespace().count() <= 4 {
                    return t[..idx].trim().to_string();
                }
            }
        }
    }
    t.split('(').next().unwrap_or(t).trim().to_string()
}

// ---------------------------------------------------------------------------
// /api/status
// ---------------------------------------------------------------------------

async fn status() -> Json<serde_json::Value> {
    Json(serde_json::json!({"ok": true}))
}

// ---------------------------------------------------------------------------
// /api/search (Yandex)
// ---------------------------------------------------------------------------

async fn handle_search(
    State(state): State<SharedState>,
    Query(q): Query<SearchQuery>,
) -> Json<Vec<TrackResult>> {
    let ym = yandex::http_client(state.0.yandex_proxy_url.as_deref(), &state.0.yandex_token);
    Json(yandex::search(&ym, &state.0.yandex_token, &q.text).await)
}

// ---------------------------------------------------------------------------
// /api/trends
// ---------------------------------------------------------------------------

async fn handle_trends(
    State(state): State<SharedState>,
) -> Json<Vec<TrackResult>> {
    let ym = yandex::http_client(state.0.yandex_proxy_url.as_deref(), &state.0.yandex_token);
    Json(yandex::chart(&ym, &state.0.yandex_token).await)
}

// ---------------------------------------------------------------------------
// /api/search/youtube
// ---------------------------------------------------------------------------

async fn handle_search_youtube(
    Query(q): Query<SearchQuery>,
) -> Json<Vec<TrackResult>> {
    Json(youtube::search(&q.text, 20).await)
}

// ---------------------------------------------------------------------------
// /api/search/spotify
// ---------------------------------------------------------------------------

async fn handle_search_spotify(
    State(state): State<SharedState>,
    Query(q): Query<SearchQuery>,
) -> Json<Vec<TrackResult>> {
    Json(state.0.spotify.search_tracks(&q.text, 30).await)
}

// ---------------------------------------------------------------------------
// /api/search/soundcloud
// ---------------------------------------------------------------------------

async fn handle_search_soundcloud(
    State(state): State<SharedState>,
    Query(q): Query<SearchQuery>,
) -> Json<Vec<TrackResult>> {
    let cache_key = q.text.to_lowercase();
    if let Some(cached) = state.0.sc_search_cache.get(&cache_key).await {
        return Json(cached);
    }
    let results = soundcloud::search_tracks(&state, &q.text).await;
    state.0.sc_search_cache.insert(cache_key, results.clone()).await;
    Json(results)
}

// ---------------------------------------------------------------------------
// /api/search/playlists
// ---------------------------------------------------------------------------

async fn handle_search_playlists(
    State(state): State<SharedState>,
    Query(q): Query<SearchQuery>,
) -> Json<Vec<PlaylistResult>> {
    let mut results: Vec<PlaylistResult> = vec![];
    let ym = yandex::http_client(state.0.yandex_proxy_url.as_deref(), &state.0.yandex_token);
    results.extend(yandex::search_playlists(&ym, &state.0.yandex_token, &q.text).await);
    results.extend(soundcloud::search_playlists(&state, &q.text).await);
    results.extend(state.0.spotify.search_playlists(&q.text, 10).await);
    Json(results)
}

// ---------------------------------------------------------------------------
// /api/playlist/tracks
// ---------------------------------------------------------------------------

async fn handle_playlist_tracks(
    State(state): State<SharedState>,
    Query(q): Query<PlaylistTracksQuery>,
) -> Result<Json<PaginatedTracks>, (StatusCode, String)> {
    let offset = q.offset.unwrap_or(0);
    let limit = q.limit.unwrap_or(50);

    if q.playlist_id.starts_with("yandex:") {
        let parts: Vec<&str> = q.playlist_id.splitn(3, ':').collect();
        if parts.len() < 3 {
            return Err((StatusCode::BAD_REQUEST, "Invalid playlist ID, expected yandex:{uid}:{kind}".to_string()));
        }
        let uid: u64 = parts[1].parse().map_err(|_| (StatusCode::BAD_REQUEST, "Invalid uid".to_string()))?;
        let kind: u64 = parts[2].parse().map_err(|_| (StatusCode::BAD_REQUEST, "Invalid kind".to_string()))?;

        let all_tracks = match state.0.pl_tracks_cache.get(&q.playlist_id).await {
            Some(t) => t,
            None => {
                let ym = yandex::http_client(state.0.yandex_proxy_url.as_deref(), &state.0.yandex_token);
                let tracks = yandex::playlist_tracks(&ym, &state.0.yandex_token, uid, kind).await.unwrap_or_default();
                state.0.pl_tracks_cache.insert(q.playlist_id.clone(), tracks.clone()).await;
                tracks
            }
        };

        let total = all_tracks.len();
        let page: Vec<TrackResult> = all_tracks.into_iter().skip(offset).take(limit).collect();

        return Ok(Json(PaginatedTracks {
            tracks: page,
            total,
            offset,
            has_more: (offset + limit) < total,
        }));
    }

    if q.playlist_id.starts_with("spotify:") {
        let spotify_id = q.playlist_id.strip_prefix("spotify:").unwrap_or("");
        if spotify_id.is_empty() {
            return Err((StatusCode::BAD_REQUEST, "Invalid Spotify playlist ID".to_string()));
        }

        let (tracks, total) = state.0.spotify.playlist_tracks(spotify_id, offset, limit).await
            .unwrap_or_default();

        return Ok(Json(PaginatedTracks {
            tracks,
            total,
            offset,
            has_more: (offset + limit) < total,
        }));
    }

    Err((StatusCode::BAD_REQUEST, "Unsupported playlist source. Use yandex: or spotify: prefix.".to_string()))
}

// ---------------------------------------------------------------------------
// /api/sc/resolve
// ---------------------------------------------------------------------------

async fn handle_sc_resolve(
    State(state): State<SharedState>,
    Query(q): Query<ScResolveQuery>,
) -> Result<Json<ResolvedStream>, (StatusCode, String)> {
    let cache_key = format!("{}|{}", q.artist.to_lowercase(), q.title.to_lowercase());
    if let Some(cached) = state.0.sc_resolve_cache.get(&cache_key).await {
        return Ok(Json(cached));
    }
    let result = soundcloud::resolve_by_query(&state, &q.title, &q.artist)
        .await
        .ok_or_else(|| (StatusCode::NOT_FOUND, "No playable SoundCloud stream found".to_string()))?;
    state.0.sc_resolve_cache.insert(cache_key, result.clone()).await;
    Ok(Json(result))
}

// ---------------------------------------------------------------------------
// /api/stream/resolve (cascading resolver)
// ---------------------------------------------------------------------------

async fn handle_stream_resolve(
    State(state): State<SharedState>,
    Query(q): Query<StreamResolveQuery>,
) -> Result<Json<ResolvedStream>, (StatusCode, String)> {
    let cache_key = format!(
        "{}|{}|{}|{}|{}",
        q.source,
        q.native_id.as_deref().unwrap_or(""),
        q.title.as_deref().unwrap_or(""),
        q.artist.as_deref().unwrap_or(""),
        q.prefer.as_deref().unwrap_or(""),
    )
    .to_lowercase();

    if let Some(cached) = state.0.stream_cache.get(&cache_key).await {
        return Ok(Json(cached));
    }

    let title = q.title.as_deref().unwrap_or("");
    let artist = q.artist.as_deref().unwrap_or("");
    let native_id = q.native_id.as_deref().unwrap_or("");

    enum Attempt {
        YandexById(String),
        SoundCloudById(u64),
        SoundCloudByQuery(String, String),
        YouTubeById(String),
        YouTubeByQuery(String, String),
    }

    let mut attempts: Vec<(&str, Attempt)> = vec![];

    match q.prefer.as_deref() {
        Some("soundcloud") => attempts.push(("soundcloud", Attempt::SoundCloudByQuery(title.to_string(), artist.to_string()))),
        Some("youtube") => attempts.push(("youtube", Attempt::YouTubeByQuery(title.to_string(), artist.to_string()))),
        _ => {}
    }

    if q.source == "yandex" && !native_id.is_empty() {
        attempts.push(("yandex", Attempt::YandexById(native_id.to_string())));
    }
    if q.source == "soundcloud" && !native_id.is_empty() {
        if let Ok(id) = native_id.parse::<u64>() {
            attempts.push(("soundcloud", Attempt::SoundCloudById(id)));
        }
    }
    if q.source == "youtube" && !native_id.is_empty() {
        attempts.push(("youtube", Attempt::YouTubeById(native_id.to_string())));
    }

    attempts.push(("soundcloud", Attempt::SoundCloudByQuery(title.to_string(), artist.to_string())));
    attempts.push(("youtube", Attempt::YouTubeByQuery(title.to_string(), artist.to_string())));

    for (_, attempt) in &attempts {
        let result = match attempt {
            Attempt::YandexById(id) => {
                let url = yandex::resolve_stream(&state.0.http, &state.0.yandex_token, id).await;
                url.map(|url| ResolvedStream { source: "yandex".to_string(), kind: "progressive".to_string(), url })
            }
            Attempt::SoundCloudById(id) => soundcloud::resolve_by_id(&state, *id).await,
            Attempt::SoundCloudByQuery(t, a) => soundcloud::resolve_by_query(&state, t, a).await,
            Attempt::YouTubeById(id) => {
                let port = state.0.sidecar_port;
                youtube::resolve_stream(id).await.map(move |url| ResolvedStream {
                    source: "youtube".to_string(),
                    kind: "progressive".to_string(),
                    url: proxy_youtube_url(&url, port),
                })
            }
            Attempt::YouTubeByQuery(t, a) => {
                let port = state.0.sidecar_port;
                youtube::resolve_by_query(t, a).await.map(move |r| ResolvedStream {
                    source: r.source,
                    kind: r.kind,
                    url: proxy_youtube_url(&r.url, port),
                })
            },
        };
        if let Some(r) = result {
            if !r.url.is_empty() {
                state.0.stream_cache.insert(cache_key, r.clone()).await;
                return Ok(Json(r));
            }
        }
    }

    Err((StatusCode::NOT_FOUND, "Track not playable on any service (Yandex/YouTube/SoundCloud)".to_string()))
}

fn proxy_youtube_url(url: &str, port: u16) -> String {
    format!("http://localhost:{}/api/stream/proxy?url={}", port, urlencoding::encode(url))
}

// ---------------------------------------------------------------------------
// /api/stream/proxy — proxy YouTube CDN streams with proper headers
// ---------------------------------------------------------------------------

async fn handle_stream_proxy(
    Query(q): Query<StreamProxyQuery>,
    headers: HeaderMap,
) -> Result<Response, (StatusCode, String)> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Client error: {e}")))?;

    let mut proxy_headers = HeaderMap::new();
    proxy_headers.insert("User-Agent", HeaderValue::from_static("com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; Quest 3 Build/SQ3A.220605.009.A1) gzip"));
    if let Some(range) = headers.get("range") {
        proxy_headers.insert("Range", range.clone());
    }

    let resp = client
        .get(&q.url)
        .headers(proxy_headers)
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Proxy request failed: {e}")))?;

    let status = resp.status();
    let mut resp_headers = HeaderMap::new();
    for key in &["content-type", "content-length", "content-range", "accept-ranges"] {
        if let Some(val) = resp.headers().get(*key) {
            resp_headers.insert(key.parse::<HeaderName>().unwrap(), val.clone());
        }
    }

    let body = Body::from_stream(resp.bytes_stream());
    let mut response = Response::new(body);
    *response.status_mut() = status;
    *response.headers_mut() = resp_headers;
    Ok(response)
}

// ---------------------------------------------------------------------------
// /api/video/clip
// ---------------------------------------------------------------------------

async fn handle_video_clip(
    State(state): State<SharedState>,
    Query(q): Query<VideoClipQuery>,
) -> Json<serde_json::Value> {
    let cache_key = format!("{}|{}", q.artist.as_deref().unwrap_or("").to_lowercase(), q.title.to_lowercase());
    if let Some(cached) = state.0.clip_cache.get(&cache_key).await {
        if cached.is_some() {
            tracing::info!("[ 100% ] Streaming video...");
        }
        return Json(serde_json::json!({ "url": cached }));
    }

    let artist_part = q.artist.as_deref().unwrap_or("");
    let title = clean_title(&q.title);
    let t0 = std::time::Instant::now();

    tracing::info!("[  0% ] Downloading video... {} — {}", title, artist_part);

    let queries = {
        let q = format!("{artist_part} {title}").trim().to_string();
        let mut qs = vec![];
        if !artist_part.is_empty() {
            qs.push(format!("{q} official clip"));
            qs.push(format!("{q} official music video"));
            qs.push(format!("{q} official video"));
        }
        qs.push(q);
        if !artist_part.is_empty() {
            qs.push(format!("{artist_part} {title} music video"));
        }
        qs.push(title.clone());
        qs
    };

    let mut video_id: Option<String> = None;
    for (i, query) in queries.iter().enumerate() {
        let results = youtube::search(query, 10).await;
        let elapsed = t0.elapsed().as_secs_f64();
        let pct = ((elapsed / 15.0).min(0.9) * 100.0) as u32;
        tracing::info!("[ {:>3}% ] Searching YouTube... \"{}\" ({}/{})", pct, query, i + 1, queries.len());
        if let Some(track) = results.first() {
            if let Some(vid) = track.id.split(':').nth(1) {
                video_id = Some(vid.to_string());
                break;
            }
        }
    }

    let port = state.0.sidecar_port;
    let result = match video_id {
        Some(ref id) => {
            tracing::info!("[  90% ] Resolving stream for video {}", id);
            let proxy_url = format!("http://localhost:{port}/api/video/stream/{id}");
            state.0.clip_cache.insert(cache_key, Some(proxy_url.clone())).await;
            tracing::info!("[ 100% ] Streaming video... {} — {} ({})", title, artist_part, id);
            serde_json::json!({ "url": proxy_url })
        }
        None => {
            state.0.clip_cache.insert(cache_key, None).await;
            tracing::info!("[ 100% ] Streaming video... {} — {} (not found)", title, artist_part);
            serde_json::json!({ "url": null })
        }
    };

    Json(result)
}

// ---------------------------------------------------------------------------
// /api/video/stream/{video_id}
// ---------------------------------------------------------------------------

async fn handle_video_stream(
    State(state): State<SharedState>,
    Path(video_id): Path<String>,
    headers: HeaderMap,
) -> Result<Response, (StatusCode, String)> {
    let t0 = std::time::Instant::now();

    tracing::info!("[  50% ] Loading video {}...", video_id);

    let stream_url = if let Some(cached) = state.0.video_stream_cache.get(&video_id).await {
        tracing::info!("[  60% ] Stream URL cached for {}", video_id);
        cached
    } else {
        let url = format!("https://www.youtube.com/watch?v={video_id}");
        let format_spec = "best[height<=720][acodec=none]/best[height<=720][ext=mp4]/best[height<=720]/best";
        let extracted = youtube::extract(&url, format_spec)
            .await
            .map_err(|e| {
                tracing::error!("[  FAIL] Failed to extract stream for {}: {}", video_id, e);
                (StatusCode::BAD_GATEWAY, e)
            })?;
        state.0.video_stream_cache.insert(video_id.clone(), extracted.clone()).await;
        extracted
    };

    tracing::info!("[  75% ] Proxying stream for {} ({:.1}s)", video_id, t0.elapsed().as_secs_f64());

    let mut proxy_headers = HeaderMap::new();
    proxy_headers.insert("User-Agent", HeaderValue::from_static("com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; Quest 3 Build/SQ3A.220605.009.A1) gzip"));
    if let Some(range) = headers.get("range") {
        proxy_headers.insert("Range", range.clone());
    }

    let client = reqwest::Client::new();
    let resp = client
        .get(&stream_url)
        .headers(proxy_headers)
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Stream proxy failed: {e}")))?;

    let status = resp.status();
    let mut resp_headers = HeaderMap::new();
    for key in &["content-type", "content-length", "content-range", "accept-ranges"] {
        if let Some(val) = resp.headers().get(*key) {
            resp_headers.insert(key.parse::<reqwest::header::HeaderName>().unwrap(), val.clone());
        }
    }

    let body = Body::from_stream(resp.bytes_stream());
    let mut response = Response::new(body);
    *response.status_mut() = status;
    *response.headers_mut() = resp_headers;
    Ok(response)
}

// ---------------------------------------------------------------------------
// /api/artist-image/{name}
// ---------------------------------------------------------------------------

async fn handle_artist_image(
    Path(name): Path<String>,
) -> Result<Response, StatusCode> {
    let safe_name = name.to_lowercase().replace(' ', "-");
    let cwd = std::env::current_dir().ok().unwrap_or_default();
    let candidates = [
        cwd.join("..").join("artists").join(format!("{safe_name}.png")),
        cwd.join("..").join("resources").join("artists").join(format!("{safe_name}.png")),
        cwd.join("artists").join(format!("{safe_name}.png")),
    ];

    for path in &candidates {
        if path.exists() {
            let data = tokio::fs::read(path).await.map_err(|_| StatusCode::NOT_FOUND)?;
            return Ok(Response::builder()
                .header("Content-Type", "image/png")
                .body(Body::from(data))
                .unwrap());
        }
    }
    Err(StatusCode::NOT_FOUND)
}

// ---------------------------------------------------------------------------
// /api/artist-photo
// ---------------------------------------------------------------------------

async fn handle_artist_photo(
    State(state): State<SharedState>,
    Query(q): Query<ArtistPhotoQuery>,
) -> Json<serde_json::Value> {
    let cache_key = q.name.to_lowercase();
    if let Some(cached) = state.0.photo_cache.get(&cache_key).await {
        return Json(serde_json::json!({ "url": cached }));
    }

    let url = format!("https://api.deezer.com/search/artist?q={}&limit=1&index=0", urlencode(&q.name));
    let result = match state.0.deezer_http.get(&url).send().await {
        Ok(resp) => match resp.json::<DeezerSearch>().await {
            Ok(search) => search.data.first().and_then(|a| {
                a.picture_xl.clone().or_else(|| a.picture_big.clone()).or_else(|| a.picture_medium.clone())
            }),
            _ => None,
        },
        _ => None,
    };

    state.0.photo_cache.insert(cache_key, result.clone()).await;
    Json(serde_json::json!({ "url": result }))
}

// ---------------------------------------------------------------------------
// /api/lyrics/synced
// ---------------------------------------------------------------------------

async fn handle_lyrics_synced(
    State(state): State<SharedState>,
    Query(q): Query<LyricsQuery>,
) -> Result<Json<SyncedLyrics>, (StatusCode, String)> {
    let cache_key = format!("{}|{}", q.artist.to_lowercase(), q.title.to_lowercase());
    if let Some(cached) = state.0.lyrics_cache.get(&cache_key).await {
        return Ok(Json(cached));
    }

    let mut results = lyrics::search(&state.0.http, &[("track_name", &q.title), ("artist_name", &q.artist)]).await;
    if results.is_empty() {
        let combined = format!("{} {}", q.artist, q.title).trim().to_string();
        results = lyrics::search(&state.0.http, &[("q", &combined)]).await;
    }

    let best = lyrics::pick_best(results, q.duration)
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Lyrics not found".to_string()))?;

    let payload = SyncedLyrics { synced: best.synced_lyrics, plain: best.plain_lyrics };
    state.0.lyrics_cache.insert(cache_key, payload.clone()).await;
    Ok(Json(payload))
}

// ---------------------------------------------------------------------------
// URL encode helper (minimal)
// ---------------------------------------------------------------------------

fn urlencode(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            ' ' => "+".to_string(),
            _ => format!("%{:02X}", c as u8),
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn router(state: SharedState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/api/status", get(status))
        .route("/api/search", get(handle_search))
        .route("/api/trends", get(handle_trends))
        .route("/api/search/youtube", get(handle_search_youtube))
        .route("/api/search/soundcloud", get(handle_search_soundcloud))
        .route("/api/search/spotify", get(handle_search_spotify))
        .route("/api/search/playlists", get(handle_search_playlists))
        .route("/api/playlist/tracks", get(handle_playlist_tracks))
        .route("/api/sc/resolve", get(handle_sc_resolve))
        .route("/api/stream/resolve", get(handle_stream_resolve))
        .route("/api/stream/proxy", get(handle_stream_proxy))
        .route("/api/video/clip", get(handle_video_clip))
        .route("/api/video/stream/{video_id}", get(handle_video_stream))
        .route("/api/artist-image/{name}", get(handle_artist_image))
        .route("/api/artist-photo", get(handle_artist_photo))
        .route("/api/lyrics/synced", get(handle_lyrics_synced))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
