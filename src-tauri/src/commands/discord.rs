use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use serde::Deserialize;
use std::sync::Mutex;
use tauri::State;

const CLIENT_ID: &str = "1527376861485858957";

pub struct DiscordState(pub Mutex<Option<DiscordIpcClient>>);

impl Default for DiscordState {
    fn default() -> Self {
        Self(Mutex::new(None))
    }
}

fn ensure_connected(state: &Mutex<Option<DiscordIpcClient>>) -> bool {
    let mut guard = state.lock().unwrap();
    if guard.is_some() {
        return true;
    }

    let mut client = match DiscordIpcClient::new(CLIENT_ID) {
        Ok(c) => c,
        Err(_) => return false,
    };

    if client.connect().is_err() {
        return false;
    }

    // Set idle activity on connect
    let _ = client.set_activity(
        activity::Activity::new()
            .activity_type(activity::ActivityType::Listening)
            .details("Idle")
            .state("No music playing")
            .assets(
                activity::Assets::new().large_image("logo"),
            ),
    );

    *guard = Some(client);
    true
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceData {
    pub track_name: String,
    pub artist: String,
    pub current_time: f64,
    pub duration: f64,
    pub artwork_url: String,
    pub is_playing: bool,
}

#[tauri::command]
pub async fn discord_update_presence(
    discord: State<'_, DiscordState>,
    data: PresenceData,
) -> Result<(), String> {
    if data.track_name.is_empty()
        || !data.current_time.is_finite()
        || !data.duration.is_finite()
        || data.duration <= 0.0
    {
        return Ok(());
    }

    if !ensure_connected(&discord.0) {
        return Ok(());
    }

    let mut guard = discord.0.lock().unwrap();
    let client = match guard.as_mut() {
        Some(c) => c,
        None => return Ok(()),
    };

    let large_image = if data.artwork_url.is_empty() {
        "logo"
    } else {
        &data.artwork_url
    };
    let large_text = format!("{} — {}", data.track_name, data.artist);

    let result = if data.is_playing {
        let current_time = data.current_time.max(0.0).min(data.duration);
        let duration = data.duration.max(1.0);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let start = now - current_time as i64;
        let end = start + duration as i64;

        client.set_activity(
            activity::Activity::new()
                .activity_type(activity::ActivityType::Listening)
                .details(&data.track_name)
                .state(&data.artist)
                .timestamps(activity::Timestamps::new().start(start).end(end))
                .assets(
                    activity::Assets::new()
                        .large_image(large_image)
                        .large_text(&large_text)
                        .small_image("play")
                        .small_text("Playing"),
                ),
        )
    } else {
        let state = format!("⏸ Paused — {}", data.artist);
        client.set_activity(
            activity::Activity::new()
                .activity_type(activity::ActivityType::Listening)
                .details(&data.track_name)
                .state(&state)
                .assets(
                    activity::Assets::new()
                        .large_image(large_image)
                        .large_text(&large_text)
                        .small_image("pause")
                        .small_text("Paused"),
                ),
        )
    };

    if result.is_err() {
        // Connection lost — drop client so it reconnects next time
        *guard = None;
    }

    Ok(())
}

#[tauri::command]
pub async fn discord_clear_presence(discord: State<'_, DiscordState>) -> Result<(), String> {
    if !ensure_connected(&discord.0) {
        return Ok(());
    }

    let mut guard = discord.0.lock().unwrap();
    if let Some(client) = guard.as_mut() {
        let result = client.set_activity(
            activity::Activity::new()
                .activity_type(activity::ActivityType::Listening)
                .details("Idle")
                .state("No music playing")
                .assets(activity::Assets::new().large_image("logo")),
        );
        if result.is_err() {
            *guard = None;
        }
    }

    Ok(())
}

pub fn clear_on_startup() {
    std::thread::spawn(|| {
        if let Ok(mut client) = DiscordIpcClient::new(CLIENT_ID) {
            if client.connect().is_ok() {
                let _ = client.set_activity(
                    activity::Activity::new()
                        .activity_type(activity::ActivityType::Listening)
                        .details("Idle")
                        .state("No music playing")
                        .assets(activity::Assets::new().large_image("logo")),
                );
            }
        }
    });
}
