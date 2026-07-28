use std::collections::HashMap;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::ShellExt;
use tokio::time::{sleep, Duration};

const SIDECAR_PORT: u16 = 8787;
const MAX_RESTART_ATTEMPTS: u32 = 10;

/// Parse a .env file into key-value pairs.
/// Skips blank lines, comments (#), and empty values.
fn parse_dotenv(path: &PathBuf) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!("[sidecar] could not read {}: {e}", path.display());
            return map;
        }
    };
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim();
            let value = value.trim();
            if !key.is_empty() && !value.is_empty() {
                map.insert(key.to_string(), value.to_string());
            }
        }
    }
    map
}

/// Find the .env file — check several locations in order.
fn find_dotenv(app: &AppHandle) -> Option<PathBuf> {
    // 1. Dev: CWD → server/.env
    let dev_path = PathBuf::from("server/.env");
    if dev_path.exists() {
        tracing::info!("[sidecar] using env from {}", dev_path.display());
        return Some(dev_path);
    }

    // 2. Production: Tauri resource dir (preserves directory structure from bundle config)
    if let Ok(resource_dir) = app.path().resource_dir() {
        tracing::debug!("[sidecar] resource dir: {}", resource_dir.display());
        // Tauri bundles "resources/.env" → {resource_dir}/resources/.env
        for candidate in &["resources/.env", ".env"] {
            let path = resource_dir.join(candidate);
            if path.exists() {
                tracing::info!("[sidecar] using env from {}", path.display());
                return Some(path);
            }
        }
    }

    // 3. Fallback: next to the executable
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            for candidate in &["resources/.env", ".env"] {
                let path = dir.join(candidate);
                if path.exists() {
                    tracing::info!("[sidecar] using env from {}", path.display());
                    return Some(path);
                }
            }
        }
    }

    tracing::warn!("[sidecar] no .env file found — sidecar will run without API keys");
    None
}

pub async fn start_sidecar(app: AppHandle) {
    let mut restart_count: u32 = 0;

    // Load .env once — reused across restarts
    let env_vars = find_dotenv(&app)
        .map(|p| parse_dotenv(&p))
        .unwrap_or_default();

    if !env_vars.is_empty() {
        tracing::info!(
            "[sidecar] loaded env keys: {}",
            env_vars.keys().cloned().collect::<Vec<_>>().join(", ")
        );
    }

    loop {
        restart_count += 1;
        if restart_count > MAX_RESTART_ATTEMPTS {
            tracing::error!("[sidecar] max restart attempts reached, giving up");
            return;
        }

        tracing::info!(
            "[sidecar] starting (attempt {}/{})",
            restart_count,
            MAX_RESTART_ATTEMPTS
        );

        let shell = app.shell();
        let mut command = shell
            .sidecar("music-server")
            .expect("failed to create sidecar command")
            .env("SIDECAR_PORT", SIDECAR_PORT.to_string())
            .env("RUST_LOG", "info,tower_http=info");

        // Forward all .env variables to sidecar
        for (key, value) in &env_vars {
            command = command.env(key, value);
        }

        let (mut rx, _child) = match command.spawn() {
            Ok(result) => result,
            Err(e) => {
                tracing::error!("[sidecar] spawn failed: {e}");
                let delay = Duration::from_millis((1000 * restart_count).min(10_000) as u64);
                sleep(delay).await;
                continue;
            }
        };

        // Poll for readiness
        let app_clone = app.clone();
        tauri::async_runtime::spawn(async move {
            poll_server(SIDECAR_PORT, 30_000, app_clone).await;
        });

        // Read sidecar output
        use tauri_plugin_shell::process::CommandEvent;
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line);
                    for l in text.trim().split('\n') {
                        tracing::info!("[server] {l}");
                    }
                }
                CommandEvent::Stderr(line) => {
                    let text = String::from_utf8_lossy(&line);
                    for l in text.trim().split('\n') {
                        tracing::info!("[server] {l}");
                        if l.contains("sidecar starting on http") {
                            restart_count = 0;
                            let _ = app.emit("sidecar:ready", ());
                            tracing::info!("[sidecar] ready");
                        }
                    }
                }
                CommandEvent::Terminated(payload) => {
                    tracing::info!(
                        "[sidecar] exited code={:?} signal={:?}",
                        payload.code,
                        payload.signal
                    );
                    break;
                }
                CommandEvent::Error(err) => {
                    tracing::error!("[sidecar] error: {err}");
                    break;
                }
                _ => {}
            }
        }

        // Sidecar exited — restart with backoff
        let delay = Duration::from_millis((1000 * restart_count).min(10_000) as u64);
        tracing::info!(
            "[sidecar] restarting in {}ms (attempt {}/{})",
            delay.as_millis(),
            restart_count,
            MAX_RESTART_ATTEMPTS
        );
        sleep(delay).await;
    }
}

async fn poll_server(port: u16, timeout_ms: u64, app: AppHandle) {
    let deadline = tokio::time::Instant::now() + Duration::from_millis(timeout_ms);
    let url = format!("http://127.0.0.1:{port}/api/status");

    loop {
        if tokio::time::Instant::now() > deadline {
            tracing::warn!("[sidecar] server not ready after {timeout_ms}ms");
            return;
        }

        match reqwest::get(&url).await {
            Ok(resp) if resp.status().is_success() => {
                let _ = app.emit("sidecar:ready", ());
                tracing::info!("[sidecar] ready (poll)");
                return;
            }
            _ => {
                sleep(Duration::from_millis(200)).await;
            }
        }
    }
}
