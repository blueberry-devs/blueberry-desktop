use std::time::Duration;

use reqwest::header::HeaderMap;

use crate::types::{PlaylistResult, TrackResult};

fn api_url(path: &str) -> String {
    format!("https://api.music.yandex.net:443{}", path)
}

fn headers(token: &str) -> HeaderMap {
    let mut h = HeaderMap::new();
    h.insert("User-Agent", "YandexMusicAndroid/24023621".parse().unwrap());
    h.insert("X-Yandex-Music-Client", "YandexMusicAndroid/24023621".parse().unwrap());
    if !token.is_empty() {
        let auth = format!("OAuth {token}");
        h.insert("Authorization", auth.parse().unwrap());
    }
    h
}

pub fn http_client(proxy: Option<&str>, token: &str) -> reqwest::Client {
    let mut builder = reqwest::Client::builder()
        .default_headers(headers(token))
        .timeout(Duration::from_secs(15));
    if let Some(proxy_url) = proxy {
        if let Ok(p) = reqwest::Proxy::all(proxy_url) {
            builder = builder.proxy(p);
        }
    }
    builder.build().unwrap_or_else(|_| reqwest::Client::new())
}

fn cover_url(uri: Option<&str>) -> Option<String> {
    uri.map(|u| format!("https://{}", u.replace("%%", "400x400")))
}

fn track_id(id: u64, album_id: Option<u64>) -> String {
    match album_id {
        Some(aid) => format!("yandex:{id}:{aid}"),
        None => format!("yandex:{id}"),
    }
}

fn parse_track(t: &serde_json::Value) -> Option<TrackResult> {
    let id = t["id"].as_i64()?;
    let title = t["title"].as_str()?.to_string();
    let artists: Vec<String> = t["artists"]
        .as_array()
        .map(|a| a.iter().filter_map(|a| a["name"].as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();
    let cover_uri = t["coverUri"].as_str().or(t["cover_uri"].as_str());
    let album_id = t["albums"].as_array().and_then(|a| a.first()).and_then(|a| a["id"].as_i64());
    let duration_ms = t["durationMs"].as_i64().or_else(|| t["duration_ms"].as_i64());
    Some(TrackResult {
        id: track_id(id as u64, album_id.map(|a| a as u64)),
        source: "yandex".to_string(),
        title,
        artists,
        cover: cover_url(cover_uri),
        artist_cover: None,
        duration: duration_ms.map(|d| d / 1000),
        explicit: t["explicit"].as_bool().filter(|e| *e),
    })
}

async fn fetch_json(http: &reqwest::Client, url: &str, params: &[(&str, &str)], token: &str) -> serde_json::Value {
    match http.get(url).headers(headers(token)).query(params).send().await {
        Ok(resp) => resp.json::<serde_json::Value>().await.unwrap_or_default(),
        _ => serde_json::Value::Null,
    }
}

pub async fn search(http: &reqwest::Client, token: &str, text: &str) -> Vec<TrackResult> {
    let data = fetch_json(http, &api_url("/search"), &[("text", text), ("type", "track"), ("page", "0")], token).await;
    data.pointer("/result/tracks/results")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(parse_track).take(30).collect())
        .unwrap_or_default()
}

pub async fn chart(http: &reqwest::Client, token: &str) -> Vec<TrackResult> {
    let data = fetch_json(http, &api_url("/landing/chart"), &[("blocks", "chart")], token).await;
    data.pointer("/result/chart/tracks")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|ct| parse_track(&ct["track"])).take(30).collect())
        .unwrap_or_default()
}

pub async fn playlist_tracks(
    http: &reqwest::Client,
    token: &str,
    uid: u64,
    kind: u64,
) -> Result<Vec<TrackResult>, String> {
    let url = api_url(&format!("/users/{}/playlists/{}", uid, kind));
    let resp = http.get(&url).headers(headers(token)).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let tracks: Vec<TrackResult> = data
        .pointer("/result/tracks")
        .and_then(|v| v.as_array())
        .ok_or("no tracks")?
        .iter()
        .filter_map(|st| {
            let t = st.get("track").filter(|t| !t.is_null())?;
            parse_track(t)
        })
        .collect();
    Ok(tracks)
}

pub async fn resolve_stream(http: &reqwest::Client, token: &str, native_id: &str) -> Option<String> {
    let track_id = native_id.split(':').next()?;
    let dl_url = format!("https://api.music.yandex.net/tracks/{track_id}/download-info");
    let resp = http.get(&dl_url).headers(headers(token)).send().await.ok()?;
    let data: serde_json::Value = resp.json().await.ok()?;
    let entries = data.pointer("/result")?.as_array()?;

    let entry = entries
        .iter()
        .filter(|e| e["codec"].as_str() == Some("mp3"))
        .max_by_key(|e| e["bitrateInKbps"].as_i64().unwrap_or(0))
        .or_else(|| entries.first())?;

    let info_url = entry["downloadInfoUrl"].as_str()?;
    let info_text = http.get(info_url).headers(headers(token)).send().await.ok()?.text().await.ok()?;

    let host = extract_xml(&info_text, "host")?;
    let path = extract_xml(&info_text, "path")?;
    let s = extract_xml(&info_text, "s")?;
    let ts = extract_xml(&info_text, "ts")?;

    let cdn_url = format!("https://{host}/get-mp3/{s}/{ts}{path}");
    let retpath = format!("https://music.yandex.ru/track/{track_id}");

    let direct = http
        .get(&cdn_url)
        .header("X-Retpath-Y", &retpath)
        .send()
        .await
        .ok()?;

    let final_url = direct.url().to_string();
    if final_url.is_empty() { None } else { Some(final_url) }
}

fn extract_xml(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let start = xml.find(&open)?;
    let end = xml.find(&close)?;
    Some(xml[start + open.len()..end].to_string())
}

pub async fn search_playlists(http: &reqwest::Client, token: &str, text: &str) -> Vec<PlaylistResult> {
    let data = fetch_json(http, &api_url("/search"), &[("text", text), ("type", "playlist"), ("page", "0")], token).await;
    data.pointer("/result/playlists/results")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|pl| {
                    let kind = pl["kind"].as_i64()?;
                    let title = pl["title"].as_str()?.to_string();
                    let uid = pl["owner"]["uid"].as_i64();
                    let owner_name = pl["owner"]["name"].as_str().unwrap_or("Яндекс").to_string();
                    let cover_uri = pl["cover"]["uri"]
                        .as_str()
                        .or(pl["coverUri"].as_str())
                        .or(pl["cover_uri"].as_str());
                    let track_count = pl["trackCount"].as_i64().unwrap_or(0);
                    let pid = match uid {
                        Some(u) => format!("{}:{u}", kind),
                        None => kind.to_string(),
                    };
                    Some(PlaylistResult {
                        id: format!("yandex:{pid}"),
                        source: "yandex".to_string(),
                        title,
                        owner: owner_name,
                        cover: cover_url(cover_uri),
                        track_count,
                        description: None,
                    })
                })
                .take(10)
                .collect()
        })
        .unwrap_or_default()
}
