use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrackResult {
    pub id: String,
    pub source: String,
    pub title: String,
    pub artists: Vec<String>,
    pub cover: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artist_cover: Option<String>,
    pub duration: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explicit: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistResult {
    pub id: String,
    pub source: String,
    pub title: String,
    pub owner: String,
    pub cover: Option<String>,
    #[serde(rename = "trackCount")]
    pub track_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedStream {
    pub source: String,
    pub kind: String,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedTracks {
    pub tracks: Vec<TrackResult>,
    pub total: usize,
    pub offset: usize,
    pub has_more: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SyncedLyrics {
    pub synced: Option<String>,
    pub plain: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub text: String,
}

#[derive(Debug, Deserialize)]
pub struct PlaylistTracksQuery {
    pub playlist_id: String,
    #[serde(default)]
    pub offset: Option<usize>,
    #[serde(default)]
    pub limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
pub struct StreamResolveQuery {
    pub source: String,
    #[serde(default)]
    pub native_id: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub artist: Option<String>,
    #[serde(default)]
    pub prefer: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ScResolveQuery {
    pub title: String,
    pub artist: String,
}

#[derive(Debug, Deserialize)]
pub struct LyricsQuery {
    pub title: String,
    pub artist: String,
    #[serde(default)]
    pub duration: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct VideoClipQuery {
    pub title: String,
    #[serde(default)]
    pub artist: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ArtistPhotoQuery {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct StreamProxyQuery {
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LrcLibEntry {
    #[serde(default)]
    pub synced_lyrics: Option<String>,
    #[serde(default)]
    pub plain_lyrics: Option<String>,
    #[serde(default)]
    pub duration: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeezerArtist {
    pub picture_xl: Option<String>,
    pub picture_big: Option<String>,
    pub picture_medium: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeezerSearch {
    pub data: Vec<DeezerArtist>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SoundCloudStreamUrl {
    pub url: String,
}
