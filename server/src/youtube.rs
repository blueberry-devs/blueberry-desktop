use reqwest::header::{HeaderMap, HeaderValue};
use serde_json::{json, Value};

use crate::types::{ResolvedStream, TrackResult};

const YT_BASE: &str = "https://www.youtube.com/youtubei/v1";

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap()
}

struct YtClient {
    name: &'static str,
    version: &'static str,
    api_key: &'static str,
    user_agent: &'static str,
    needs_visitor: bool,
    extras: fn() -> Value,
}

fn android_vr_extras() -> Value {
    json!({
        "androidSdkVersion": 32,
        "deviceMake": "Oculus",
        "deviceModel": "Quest 3",
        "osName": "Android",
        "osVersion": "12L",
        "platform": "MOBILE",
        "utcOffsetMinutes": 0
    })
}

fn android_extras() -> Value {
    json!({
        "androidSdkVersion": 30,
        "osName": "Android",
        "osVersion": "14",
        "deviceMake": "Google",
        "deviceModel": "Pixel 7"
    })
}

fn ios_extras() -> Value {
    json!({
        "osName": "iPhone",
        "osVersion": "18.3.2.22D82",
        "deviceMake": "Apple",
        "deviceModel": "iPhone16,2"
    })
}

fn android_tv_extras() -> Value {
    json!({
        "androidSdkVersion": 30,
        "osName": "Android",
        "osVersion": "14",
        "deviceMake": "Google",
        "deviceModel": "Chromecast"
    })
}

fn empty_extras() -> Value {
    json!({})
}

static CLIENTS: &[YtClient] = &[
    YtClient {
        name: "ANDROID_VR",
        version: "1.60.19",
        api_key: "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w",
        user_agent: "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; Quest 3 Build/SQ3A.220605.009.A1) gzip",
        needs_visitor: true,
        extras: android_vr_extras,
    },
    YtClient {
        name: "ANDROID_TV",
        version: "2.19.1.303051424",
        api_key: "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w",
        user_agent: "com.google.android.youtube.tv/2.19.1.303051424 (Linux; U; Android 14; Google Chromecast) gzip",
        needs_visitor: true,
        extras: android_tv_extras,
    },
    YtClient {
        name: "ANDROID",
        version: "20.10.38",
        api_key: "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w",
        user_agent: "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip",
        needs_visitor: false,
        extras: android_extras,
    },
    YtClient {
        name: "IOS",
        version: "20.10.4",
        api_key: "AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc",
        user_agent: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
        needs_visitor: false,
        extras: ios_extras,
    },
    YtClient {
        name: "WEB",
        version: "2.20260114.08.00",
        api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
        user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        needs_visitor: false,
        extras: empty_extras,
    },
    YtClient {
        name: "TVHTML5_SIMPLY",
        version: "7.20260114.12.00",
        api_key: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
        user_agent: "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/25.lts.30.1034943-gold (unlike Gecko), Unknown_TV_Unknown_0/Unknown (Unknown, Unknown)",
        needs_visitor: false,
        extras: empty_extras,
    },
    YtClient {
        name: "WEB_REMIX",
        version: "1.20250101.00.00",
        api_key: "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEJFD7iMY",
        user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        needs_visitor: false,
        extras: empty_extras,
    },
];

async fn fetch_visitor_data() -> Option<String> {
    let body = json!({
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20250101.00.00",
                "hl": "en"
            }
        }
    });

    let resp = client()
        .post(format!("{}/visitor_id?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8", YT_BASE))
        .header("Content-Type", "application/json")
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .json(&body)
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() {
        return None;
    }

    let data: Value = resp.json().await.ok()?;
    let vd = data
        .get("responseContext")?
        .get("visitorData")?
        .as_str()?
        .to_string();
    tracing::info!("Got visitorData: {}", &vd[..20]);
    Some(vd)
}

fn serialize(video_id: &str, title: &str, channel: &str, thumbnail: Option<String>, duration_secs: Option<i64>) -> TrackResult {
    TrackResult {
        id: format!("youtube:{video_id}"),
        source: "youtube".to_string(),
        title: title.to_string(),
        artists: vec![channel.to_string()],
        cover: thumbnail,
        artist_cover: None,
        duration: duration_secs,
        explicit: None,
    }
}

fn extract_thumbnail(video_renderer: &Value) -> Option<String> {
    video_renderer["thumbnail"]["thumbnails"]
        .as_array()
        .and_then(|t| t.last())
        .and_then(|t| t["url"].as_str())
        .map(|s| s.to_string())
}

fn parse_video_renderer(v: &Value) -> Option<TrackResult> {
    let video_id = v["videoId"].as_str()?;
    let title = v["title"]["runs"]
        .as_array()
        .and_then(|r| r.first())
        .and_then(|r| r["text"].as_str())
        .or_else(|| v["title"]["simpleText"].as_str())?;
    let channel = v["longBylineText"]["runs"]
        .as_array()
        .and_then(|r| r.first())
        .and_then(|r| r["text"].as_str())
        .or_else(|| v["ownerText"]["runs"]
            .as_array()
            .and_then(|r| r.first())
            .and_then(|r| r["text"].as_str()))
        .unwrap_or("YouTube");
    let duration = v["lengthText"]["simpleText"]
        .as_str()
        .and_then(parse_duration);
    let thumbnail = extract_thumbnail(v);
    Some(serialize(video_id, title, channel, thumbnail, duration))
}

fn parse_duration(text: &str) -> Option<i64> {
    let parts: Vec<&str> = text.split(':').collect();
    match parts.len() {
        3 => {
            let h = parts[0].parse::<i64>().ok()?;
            let m = parts[1].parse::<i64>().ok()?;
            let s = parts[2].parse::<i64>().ok()?;
            Some(h * 3600 + m * 60 + s)
        }
        2 => {
            let m = parts[0].parse::<i64>().ok()?;
            let s = parts[1].parse::<i64>().ok()?;
            Some(m * 60 + s)
        }
        _ => None,
    }
}

fn search_videos(data: &Value) -> Vec<TrackResult> {
    let paths = [
        "/contents/twoColumnSearchResultsRenderer/primaryContents/sectionListRenderer/contents",
        "/contents/twoColumnSearchResultsRenderer/primaryContents/richGridRenderer/contents",
        "/contents/sectionListRenderer/contents",
    ];

    let contents = paths
        .iter()
        .find_map(|p| data.pointer(p).and_then(|c| c.as_array()))
        .cloned()
        .unwrap_or_default();

    let mut results = Vec::new();
    for section in &contents {
        let items = section["itemSectionRenderer"]["contents"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        if items.is_empty() {
            // richItemRenderer wraps videoRenderer on some clients
            if let Some(rich) = section["richItemRenderer"]["content"]["videoRenderer"].as_object() {
                let vr = serde_json::Value::Object(rich.clone());
                if let Some(track) = parse_video_renderer(&vr) {
                    results.push(track);
                }
                continue;
            }
        }
        for item in &items {
            if let Some(vr) = item.get("videoRenderer") {
                if let Some(track) = parse_video_renderer(vr) {
                    results.push(track);
                }
            }
        }
    }
    results
}

fn extract_url(f: &Value) -> Option<String> {
    if let Some(url) = f["url"].as_str() {
        return Some(url.to_string());
    }
    if let Some(cipher) = f["signatureCipher"].as_str() {
        let mut url = None;
        let mut sp = None;
        let mut s = None;
        for part in cipher.split('&') {
            if let Some(val) = part.strip_prefix("url=") {
                url = Some(urlencoding::decode(val).ok()?.into_owned());
            } else if let Some(val) = part.strip_prefix("sp=") {
                sp = Some(val.to_string());
            } else if let Some(val) = part.strip_prefix("s=") {
                s = Some(val.to_string());
            }
        }
        if let (Some(u), Some(sp), Some(s)) = (url, sp, s) {
            let sep = if u.contains('?') { '&' } else { '?' };
            return Some(format!("{u}{sep}{sp}={s}"));
        }
    }
    if let Some(cipher) = f["cipher"].as_str() {
        for part in cipher.split('&') {
            if let Some(val) = part.strip_prefix("url=") {
                return Some(urlencoding::decode(val).ok()?.into_owned());
            }
        }
    }
    None
}

fn select_best_audio(data: &Value) -> Option<String> {
    let formats = data["streamingData"]["adaptiveFormats"].as_array()?;
    formats
        .iter()
        .filter(|f| f["mimeType"].as_str().map(|s| s.starts_with("audio/mp4")).unwrap_or(false))
        .max_by_key(|f| f["bitrate"].as_i64().unwrap_or(0))
        .or_else(|| formats.iter().filter(|f| f["mimeType"].as_str().map(|s| s.starts_with("audio/")).unwrap_or(false)).max_by_key(|f| f["bitrate"].as_i64().unwrap_or(0)))
        .and_then(extract_url)
        .or_else(|| formats.first().and_then(extract_url))
}

fn select_format(data: &Value, format_spec: &str) -> Option<String> {
    let formats = data["streamingData"]["formats"]
        .as_array().cloned().unwrap_or_default().into_iter()
        .chain(data["streamingData"]["adaptiveFormats"].as_array().cloned().unwrap_or_default())
        .collect::<Vec<_>>();

    if format_spec.contains("acodec=none") {
        formats.iter()
            .filter(|f| f["mimeType"].as_str().map(|s| s.starts_with("video/")).unwrap_or(false))
            .max_by_key(|f| { let w = f["width"].as_i64().unwrap_or(0); let h = f["height"].as_i64().unwrap_or(0); w * h })
            .and_then(extract_url)
    } else {
        formats.first().and_then(extract_url)
    }
}

fn build_headers(c: &YtClient, _video_id: &str) -> HeaderMap {
    let mut h = HeaderMap::new();
    h.insert("Content-Type", HeaderValue::from_static("application/json"));
    h.insert("User-Agent", HeaderValue::from_static(c.user_agent));
    h
}

fn build_body(video_id: &str, c: &YtClient, visitor_data: Option<&str>) -> Value {
    let mut client_ctx = json!({
        "clientName": c.name,
        "clientVersion": c.version,
        "hl": "en",
        "gl": "US"
    });
    let extras = (c.extras)();
    if let Some(obj) = extras.as_object() {
        for (k, v) in obj {
            client_ctx[k] = v.clone();
        }
    }
    if let Some(vd) = visitor_data {
        client_ctx["visitorData"] = json!(vd);
    }
    json!({
        "videoId": video_id,
        "context": {
            "client": client_ctx
        },
        "contentCheckOk": true,
        "racyCheckOk": true
    })
}

async fn player_request(video_id: &str, c: &YtClient, visitor_data: Option<&str>) -> Option<Value> {
    let body = build_body(video_id, c, visitor_data);

    let resp = client()
        .post(format!("{}/player?key={}", YT_BASE, c.api_key))
        .headers(build_headers(c, video_id))
        .json(&body)
        .send()
        .await
        .ok()?;

    let status = resp.status();
    if !status.is_success() {
        return None;
    }

    let data: Value = resp.json().await.ok()?;

    if let Some(playability) = data.get("playabilityStatus") {
        let s = playability["status"].as_str().unwrap_or("");
        if s != "OK" && s != "LIVE_STREAM_OFFLINE" {
            return None;
        }
    }

    if data.get("streamingData").is_none() {
        return None;
    }

    Some(data)
}

fn find_client(name: &str) -> Option<&'static YtClient> {
    CLIENTS.iter().find(|c| c.name == name)
}

pub async fn search(query: &str, limit: usize) -> Vec<TrackResult> {
    let search_clients = [
        find_client("WEB").unwrap_or(&CLIENTS[0]),
        find_client("ANDROID").unwrap_or(&CLIENTS[0]),
        find_client("IOS").unwrap_or(&CLIENTS[0]),
    ];

    for c in search_clients {
        let vd = fetch_visitor_data().await;
        let mut body = json!({
            "query": query,
            "context": {
                "client": {
                    "clientName": c.name,
                    "clientVersion": c.version,
                    "hl": "en",
                    "gl": "US"
                }
            }
        });
        if let Some(ref v) = vd {
            body["context"]["client"]["visitorData"] = json!(v);
        }

        let resp = match client()
            .post(format!("{}/search?key={}", YT_BASE, c.api_key))
            .headers(build_headers(c, ""))
            .json(&body)
            .send()
            .await
        {
            Ok(r) => r,
            _ => continue,
        };

        let text = match resp.text().await {
            Ok(t) => t,
            _ => continue,
        };

        // Strip JSONP prefix if present
        let json_str = text.strip_prefix(")]}'").unwrap_or(&text);

        let data: Value = match serde_json::from_str(json_str) {
            Ok(d) => d,
            Err(e) => {
                tracing::warn!("YouTube search JSON parse error ({}): {} — {}", c.name, e, &json_str[..json_str.len().min(200)]);
                continue;
            }
        };

        if data.get("error").is_some() {
            tracing::warn!("YouTube search error ({}): {:?}", c.name, data["error"]["message"]);
            continue;
        }

        if data.get("contents").is_none() {
            tracing::warn!("YouTube search no contents ({}): {}...", c.name, &json_str[..json_str.len().min(300)]);
            continue;
        }

        let results = search_videos(&data);
        if !results.is_empty() {
            let mut r = results;
            r.truncate(limit);
            return r;
        }

        tracing::warn!("YouTube search parsed 0 videos ({}), trying next client...", c.name);
    }

    vec![]
}

pub async fn resolve_stream(video_id: &str) -> Option<String> {
    let visitor_data = fetch_visitor_data().await;

    for c in CLIENTS {
        let vd = if c.needs_visitor { visitor_data.as_deref() } else { None };
        let data = match player_request(video_id, c, vd).await {
            Some(d) => d,
            None => continue,
        };

        if let Some(url) = select_best_audio(&data) {
            tracing::info!("YouTube {} resolved via {} client", video_id, c.name);
            return Some(url);
        }
    }

    tracing::error!("YouTube {}: failed with all client contexts", video_id);
    None
}

pub async fn resolve_by_query(title: &str, artist: &str) -> Option<ResolvedStream> {
    let query = format!("{artist} {title}").trim().to_string();
    if query.is_empty() {
        return None;
    }
    let candidates = search(&query, 3).await;
    for c in &candidates {
        if let Some(vid) = c.id.split(':').nth(1) {
            if let Some(url) = resolve_stream(vid).await {
                return Some(ResolvedStream {
                    source: "youtube".to_string(),
                    kind: "progressive".to_string(),
                    url,
                });
            }
        }
    }
    None
}

pub async fn extract(url: &str, format_spec: &str) -> Result<String, String> {
    let video_id = url
        .split("v=")
        .nth(1)
        .or_else(|| url.rsplit('/').next())
        .and_then(|s| s.split('&').next())
        .ok_or_else(|| "Invalid URL".to_string())?;

    let visitor_data = fetch_visitor_data().await;

    for c in CLIENTS {
        let vd = if c.needs_visitor { visitor_data.as_deref() } else { None };
        let data = match player_request(&video_id, c, vd).await {
            Some(d) => d,
            None => continue,
        };

        if let Some(url) = select_format(&data, format_spec) {
            return Ok(url);
        }
    }
    Err("No stream available with any client context".to_string())
}
