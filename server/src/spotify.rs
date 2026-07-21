use std::time::{Duration, Instant};

use tokio::sync::Mutex;

use crate::types::{PlaylistResult, TrackResult};

struct SpotifyAuth {
    token: Option<String>,
    expires_at: Instant,
}

pub struct SpotifyClient {
    http: reqwest::Client,
    client_id: String,
    client_secret: String,
    auth: Mutex<SpotifyAuth>,
}

impl SpotifyClient {
    pub fn new(client_id: String, client_secret: String) -> Self {
        Self {
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .unwrap(),
            client_id,
            client_secret,
            auth: Mutex::new(SpotifyAuth {
                token: None,
                expires_at: Instant::now(),
            }),
        }
    }

    async fn ensure_token(&self) -> Option<String> {
        let mut auth = self.auth.lock().await;
        if let Some(ref token) = auth.token {
            if auth.expires_at > Instant::now() {
                return Some(token.clone());
            }
        }

        let resp: serde_json::Value = self
            .http
            .post("https://accounts.spotify.com/api/token")
            .basic_auth(&self.client_id, Some(&self.client_secret))
            .form(&[("grant_type", "client_credentials")])
            .send()
            .await
            .ok()?
            .json()
            .await
            .ok()?;

        let token = resp["access_token"].as_str()?.to_string();
        let expires_in = resp["expires_in"].as_i64().unwrap_or(3600);

        auth.expires_at = Instant::now() + Duration::from_secs(expires_in as u64 - 60);
        auth.token = Some(token.clone());
        Some(token)
    }

    async fn get(&self, path: &str, params: &[(&str, &str)]) -> Option<serde_json::Value> {
        let token = self.ensure_token().await?;
        let url = format!("https://api.spotify.com/v1{path}");
        self.http
            .get(&url)
            .header("Authorization", format!("Bearer {token}"))
            .query(params)
            .send()
            .await
            .ok()?
            .json()
            .await
            .ok()
    }

    pub async fn search_tracks(&self, query: &str, limit: usize) -> Vec<TrackResult> {
        let data = self
            .get(
                "/search",
                &[
                    ("q", query),
                    ("type", "track"),
                    ("limit", &limit.to_string()),
                ],
            )
            .await;

        match data {
            Some(val) => val["tracks"]["items"]
                .as_array()
                .cloned()
                .unwrap_or_default()
                .into_iter()
                .map(|t| {
                    let artists: Vec<String> = t["artists"]
                        .as_array()
                        .map(|a| {
                            a.iter()
                                .filter_map(|a| a["name"].as_str().map(|s| s.to_string()))
                                .collect()
                        })
                        .unwrap_or_default();
                    TrackResult {
                        id: format!("spotify:{}", t["id"].as_str().unwrap_or("")),
                        source: "spotify".to_string(),
                        title: t["name"].as_str().unwrap_or("Unknown").to_string(),
                        artists,
                        cover: t["album"]["images"]
                            .as_array()
                            .and_then(|imgs| imgs.first())
                            .and_then(|img| img["url"].as_str())
                            .map(|s| s.to_string()),
                        artist_cover: None,
                        duration: t["duration_ms"].as_i64().map(|d| d / 1000),
                        explicit: t["explicit"].as_bool().filter(|e| *e),
                    }
                })
                .collect(),
            _ => vec![],
        }
    }

    pub async fn search_playlists(&self, query: &str, limit: usize) -> Vec<PlaylistResult> {
        let data = self
            .get(
                "/search",
                &[
                    ("q", query),
                    ("type", "playlist"),
                    ("limit", &limit.to_string()),
                ],
            )
            .await;

        match data {
            Some(val) => val["playlists"]["items"]
                .as_array()
                .cloned()
                .unwrap_or_default()
                .into_iter()
                .map(|pl| PlaylistResult {
                    id: format!("spotify:{}", pl["id"].as_str().unwrap_or("")),
                    source: "spotify".to_string(),
                    title: pl["name"].as_str().unwrap_or("Unknown").to_string(),
                    owner: pl["owner"]["display_name"]
                        .as_str()
                        .unwrap_or("Spotify")
                        .to_string(),
                    cover: pl["images"]
                        .as_array()
                        .and_then(|imgs| imgs.first())
                        .and_then(|img| img["url"].as_str())
                        .map(|s| s.to_string()),
                    track_count: pl["tracks"]["total"].as_i64().unwrap_or(0),
                    description: pl["description"].as_str().map(|s| s.to_string()),
                })
                .collect(),
            _ => vec![],
        }
    }

    pub async fn playlist_tracks(
        &self,
        playlist_id: &str,
        offset: usize,
        limit: usize,
    ) -> Option<(Vec<TrackResult>, usize)> {
        let path = format!("/playlists/{playlist_id}/tracks");
        let data = self
            .get(
                &path,
                &[
                    ("offset", &offset.to_string()),
                    ("limit", &limit.to_string()),
                ],
            )
            .await?;

        let total = data["total"].as_i64().unwrap_or(0) as usize;
        let tracks = data["items"]
            .as_array()
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|item| {
                let t = item.get("track")?;
                if t.is_null() {
                    return None;
                }
                let artists: Vec<String> = t["artists"]
                    .as_array()
                    .map(|a| {
                        a.iter()
                            .filter_map(|a| a["name"].as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default();
                Some(TrackResult {
                    id: format!("spotify:{}", t["id"].as_str().unwrap_or("")),
                    source: "spotify".to_string(),
                    title: t["name"].as_str()?.to_string(),
                    artists,
                    cover: t["album"]["images"]
                        .as_array()
                        .and_then(|imgs| imgs.first())
                        .and_then(|img| img["url"].as_str())
                        .map(|s| s.to_string()),
                    artist_cover: None,
                    duration: t["duration_ms"].as_i64().map(|d| d / 1000),
                    explicit: t["explicit"].as_bool().filter(|e| *e),
                })
            })
            .collect();

        Some((tracks, total))
    }

    pub async fn track_info(&self, track_id: &str) -> Option<TrackResult> {
        let path = format!("/tracks/{track_id}");
        let data = self.get(&path, &[]).await?;

        let artists: Vec<String> = data["artists"]
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|a| a["name"].as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        Some(TrackResult {
            id: format!("spotify:{track_id}"),
            source: "spotify".to_string(),
            title: data["name"].as_str()?.to_string(),
            artists,
            cover: data["album"]["images"]
                .as_array()
                .and_then(|imgs| imgs.first())
                .and_then(|img| img["url"].as_str())
                .map(|s| s.to_string()),
            artist_cover: None,
            duration: data["duration_ms"].as_i64().map(|d| d / 1000),
            explicit: data["explicit"].as_bool().filter(|e| *e),
        })
    }
}
