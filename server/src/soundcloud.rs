use reqwest::header::{HeaderMap, HeaderValue};

use crate::cache::SharedState;
use crate::types::{PlaylistResult, ResolvedStream, SoundCloudStreamUrl, TrackResult};

pub async fn extract_client_id(http: &reqwest::Client) -> Option<String> {
    let html = http.get("https://soundcloud.com")
        .headers(headers())
        .send()
        .await
        .ok()?
        .text()
        .await
        .ok()?;

    // Look for client_id in script tags: "client_id":"<id>" or client_id:"<id>"
    let patterns = [
        "\"client_id\":\"",
        "\"clientId\":\"",
        "client_id:\"",
    ];
    for pat in &patterns {
        if let Some(start) = html.find(pat) {
            let value_start = start + pat.len();
            if let Some(end) = html[value_start..].find('"') {
                let id = &html[value_start..value_start + end];
                if !id.is_empty() && id.len() < 100 {
                    return Some(id.to_string());
                }
            }
        }
    }
    None
}

fn headers() -> HeaderMap {
    let mut h = HeaderMap::new();
    h.insert("User-Agent", HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"));
    h
}

fn upsize(url: Option<&str>) -> Option<String> {
    url.map(|u| u.replace("-large.jpg", "-t500x500.jpg"))
}

async fn get_json(
    http: &reqwest::Client,
    url: &str,
    params: &[(&str, &str)],
    client_id: &str,
) -> Result<serde_json::Value, reqwest::Error> {
    let mut p: Vec<(&str, &str)> = params.to_vec();
    p.push(("client_id", client_id));
    http.get(url).headers(headers()).query(&p).send().await?.json().await
}

pub async fn search_tracks(
    state: &SharedState,
    text: &str,
) -> Vec<TrackResult> {
    let data = get_json(
        &state.0.http,
        "https://api-v2.soundcloud.com/search/tracks",
        &[("q", text), ("limit", "30")],
        &state.0.soundcloud_client_id,
    )
    .await
    .ok();

    match data {
        Some(val) => {
            let collection = val["collection"].as_array().cloned().unwrap_or_default();
            collection
                .into_iter()
                .filter(|t| t["kind"].as_str() == Some("track") && t["policy"].as_str() != Some("BLOCK"))
                .map(|t| {
                    let user = t["user"].as_object().cloned().unwrap_or_default();
                    TrackResult {
                        id: format!("soundcloud:{}", t["id"].as_i64().unwrap_or(0)),
                        source: "soundcloud".to_string(),
                        title: t["title"].as_str().unwrap_or("Unknown").to_string(),
                        artists: vec![user
                            .get("username")
                            .and_then(|v| v.as_str())
                            .unwrap_or("SoundCloud")
                            .to_string()],
                        cover: upsize(t["artwork_url"].as_str()),
                        artist_cover: upsize(user.get("avatar_url").and_then(|v| v.as_str())),
                        duration: t["duration"].as_i64().map(|d| d / 1000),
                        explicit: t["publisher_metadata"]
                            .as_object()
                            .and_then(|m| m.get("explicit"))
                            .and_then(|e| e.as_bool())
                            .filter(|e| *e),
                    }
                })
                .collect()
        }
        _ => vec![],
    }
}

pub async fn search_playlists(state: &SharedState, text: &str) -> Vec<PlaylistResult> {
    let data = get_json(
        &state.0.http,
        "https://api-v2.soundcloud.com/search/playlists",
        &[("q", text), ("limit", "10")],
        &state.0.soundcloud_client_id,
    )
    .await
    .ok();

    match data {
        Some(val) => {
            let collection = val["collection"].as_array().cloned().unwrap_or_default();
            collection
                .into_iter()
                .filter(|pl| pl["kind"].as_str() == Some("playlist") && pl["policy"].as_str() != Some("BLOCK"))
                .map(|pl| {
                    let user = pl["user"].as_object().cloned().unwrap_or_default();
                    PlaylistResult {
                        id: format!("soundcloud:{}", pl["id"].as_i64().unwrap_or(0)),
                        source: "soundcloud".to_string(),
                        title: pl["title"].as_str().unwrap_or("Unknown").to_string(),
                        owner: user
                            .get("username")
                            .and_then(|v| v.as_str())
                            .unwrap_or("SoundCloud")
                            .to_string(),
                        cover: upsize(pl["artwork_url"].as_str()),
                        track_count: pl["track_count"].as_i64().unwrap_or(0),
                        description: pl["description"].as_str().map(|s| s.to_string()),
                    }
                })
                .collect()
        }
        _ => vec![],
    }
}

pub async fn resolve_by_query(state: &SharedState, title: &str, artist: &str) -> Option<ResolvedStream> {
    let queries = [
        format!("{artist} {title}").trim().to_string(),
        title.to_string(),
    ];

    for query in queries.iter() {
        if query.is_empty() {
            continue;
        }
        let data = get_json(
            &state.0.http,
            "https://api-v2.soundcloud.com/search/tracks",
            &[("q", query), ("limit", "10")],
            &state.0.soundcloud_client_id,
        )
        .await
        .ok()?;

        let collection = data["collection"].as_array()?;
        for t in collection {
            if t["kind"].as_str() != Some("track") || t["policy"].as_str() == Some("BLOCK") {
                continue;
            }
            let transcodings = t["media"]["transcodings"].as_array()?;
            let chosen = transcodings
                .iter()
                .find(|tr| tr["format"]["protocol"].as_str() == Some("progressive"))
                .or_else(|| transcodings.iter().find(|tr| tr["format"]["protocol"].as_str() == Some("hls")))?;
            let stream_url = chosen["url"].as_str()?;
            if let Ok(resp) = state
                .0
                .http
                .get(stream_url)
                .query(&[("client_id", &state.0.soundcloud_client_id)])
                .headers(headers())
                .send()
                .await
            {
                if let Ok(meta) = resp.json::<SoundCloudStreamUrl>().await {
                    let kind = if chosen["format"]["protocol"].as_str() == Some("progressive") { "progressive" } else { "hls" };
                    return Some(ResolvedStream {
                        source: "soundcloud".to_string(),
                        kind: kind.to_string(),
                        url: meta.url,
                    });
                }
            }
        }
    }
    None
}

pub async fn resolve_by_id(state: &SharedState, sc_id: u64) -> Option<ResolvedStream> {
    let track_url = format!("https://api-v2.soundcloud.com/tracks/{sc_id}");
    let data: serde_json::Value = get_json(
        &state.0.http,
        &track_url,
        &[],
        &state.0.soundcloud_client_id,
    )
    .await
    .ok()?;

    if data["policy"].as_str() == Some("BLOCK") {
        return None;
    }
    let transcodings = data["media"]["transcodings"].as_array()?;
    let chosen = transcodings
        .iter()
        .find(|t| t["format"]["protocol"].as_str() == Some("progressive"))
        .or_else(|| transcodings.iter().find(|t| t["format"]["protocol"].as_str() == Some("hls")))?;
    let stream_url = chosen["url"].as_str()?;
    let meta: SoundCloudStreamUrl = state
        .0
        .http
        .get(stream_url)
        .query(&[("client_id", &state.0.soundcloud_client_id)])
        .headers(headers())
        .send()
        .await
        .ok()?
        .json()
        .await
        .ok()?;
    let kind = if chosen["format"]["protocol"].as_str() == Some("progressive") { "progressive" } else { "hls" };
    Some(ResolvedStream {
        source: "soundcloud".to_string(),
        kind: kind.to_string(),
        url: meta.url,
    })
}
