use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;
use tokio::time::{sleep, Duration};

const SIDECAR_PORT: u16 = 8787;
const MAX_RESTART_ATTEMPTS: u32 = 10;

/// Holds the running sidecar process so it can be killed on app exit.
pub struct SidecarChild(pub Mutex<Option<CommandChild>>);

impl Default for SidecarChild {
    fn default() -> Self {
        Self(Mutex::new(None))
    }
}

/// Kill the stored sidecar process (called on app exit).
pub fn kill_stored_sidecar(app: &AppHandle) {
    if let Some(state) = app.try_state::<SidecarChild>() {
        if let Ok(mut guard) = state.0.lock() {
            if let Some(child) = guard.take() {
                tracing::info!("[sidecar] killing child process on exit");
                let _ = child.kill();
            }
        }
    }
}

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
    // 1. Dev: CWD → resources/.env or server/.env
    for candidate in &["resources/.env", "server/.env"] {
        let dev_path = PathBuf::from(candidate);
        if dev_path.exists() {
            tracing::info!("[sidecar] using env from {}", dev_path.display());
            return Some(dev_path);
        }
    }

    // 2. Production: Tauri resource dir (preserves directory structure from bundle config)
    if let Ok(resource_dir) = app.path().resource_dir() {
        tracing::debug!("[sidecar] resource dir: {}", resource_dir.display());
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

/// Kill any leftover music-server processes from a previous run.
fn kill_old_sidecar() {
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "music-server.exe"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::process::Command::new("pkill")
            .args(["-f", "music-server"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
    }
}

/// Wait until the port is free (no process is listening on it).
async fn wait_for_port_free(port: u16, timeout_ms: u64) -> bool {
    let deadline = tokio::time::Instant::now() + Duration::from_millis(timeout_ms);
    loop {
        if tokio::time::Instant::now() > deadline {
            tracing::warn!("[sidecar] port {port} still occupied after {timeout_ms}ms");
            return false;
        }
        match tokio::net::TcpStream::connect(format!("127.0.0.1:{port}")).await {
            Ok(_) => {
                // Port is still in use — wait
                sleep(Duration::from_millis(200)).await;
            }
            Err(_) => {
                // Port is free
                return true;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Log formatting
// ---------------------------------------------------------------------------

const RESET: &str = "\x1b[0m";
const DIM: &str = "\x1b[2m";
const BOLD: &str = "\x1b[1m";
const RED: &str = "\x1b[31m";
const GREEN: &str = "\x1b[32m";
const YELLOW: &str = "\x1b[33m";
const BLUE: &str = "\x1b[34m";
const MAGENTA: &str = "\x1b[35m";

/// Remove ANSI escape sequences. The sidecar is configured with `with_ansi(false)`,
/// but a dependency may still colour its own output — strip defensively so we
/// never print literal `\x1b[2m` garbage.
fn strip_ansi(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            if chars.peek() == Some(&'[') {
                chars.next();
                // Consume until the final byte of the CSI sequence (@ to ~)
                while let Some(&next) = chars.peek() {
                    chars.next();
                    if ('@'..='~').contains(&next) {
                        break;
                    }
                }
            }
            continue;
        }
        out.push(c);
    }
    out
}

/// Split a plain `LEVEL message` line into its level and body.
fn split_level(line: &str) -> (Option<&str>, &str) {
    let trimmed = line.trim_start();
    for level in ["TRACE", "DEBUG", "INFO", "WARN", "ERROR"] {
        if let Some(rest) = trimmed.strip_prefix(level) {
            return (Some(level), rest.trim_start());
        }
    }
    (None, trimmed)
}

fn level_colour(level: &str) -> &'static str {
    match level {
        "ERROR" => RED,
        "WARN" => YELLOW,
        "INFO" => GREEN,
        "DEBUG" => BLUE,
        _ => DIM,
    }
}

/// Print one sidecar output line in a compact, readable, coloured form:
///
/// ```text
/// server │ INFO  sidecar starting on http://127.0.0.1:8787
/// ```
fn print_server_line(raw: &str) {
    let clean = strip_ansi(raw);
    let clean = clean.trim_end();
    if clean.trim().is_empty() {
        return;
    }

    let (level, message) = split_level(clean);
    let level = level.unwrap_or("INFO");
    let colour = level_colour(level);

    println!(
        "{MAGENTA}server{RESET} {DIM}│{RESET} {colour}{BOLD}{:<5}{RESET} {message}",
        level
    );
}

pub async fn start_sidecar(app: AppHandle) {
    let mut restart_count: u32 = 0;

    // Kill leftover processes from a previous run, then wait for port to free up
    kill_old_sidecar();
    if !wait_for_port_free(SIDECAR_PORT, 5000).await {
        tracing::error!("[sidecar] could not free port {SIDECAR_PORT}, trying anyway");
    }

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
            // Keep provider-level lyrics diagnostics visible in the Tauri log.
            .env("RUST_LOG", "info,music_server::lyrics=debug,tower_http=info");

        // Forward all .env variables to sidecar
        for (key, value) in &env_vars {
            command = command.env(key, value);
        }

        let (mut rx, child) = match command.spawn() {
            Ok(result) => result,
            Err(e) => {
                tracing::error!("[sidecar] spawn failed: {e}");
                let delay = Duration::from_millis((1000 * restart_count).min(10_000) as u64);
                sleep(delay).await;
                continue;
            }
        };

        // Store the child handle so it can be killed on app exit
        if let Some(state) = app.try_state::<SidecarChild>() {
            if let Ok(mut guard) = state.0.lock() {
                *guard = Some(child);
            }
        }

        // Track whether this sidecar instance actually bound successfully.
        // "sidecar starting on http" is printed BEFORE bind — so we poll
        // the port AFTER seeing that message to confirm it's actually up.
        let ready_flag = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));

        // Read sidecar output
        use tauri_plugin_shell::process::CommandEvent;
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line);
                    for l in text.split('\n') {
                        print_server_line(l);
                    }
                }
                CommandEvent::Stderr(line) => {
                    let text = String::from_utf8_lossy(&line);
                    for l in text.split('\n') {
                        print_server_line(l);
                        // Only confirm ready after verifying the port is actually reachable
                        if l.contains("sidecar starting on http")
                            && !ready_flag.load(std::sync::atomic::Ordering::Relaxed)
                        {
                            let app_clone = app.clone();
                            let flag = ready_flag.clone();
                            tauri::async_runtime::spawn(async move {
                                // Give bind a moment to complete, then verify
                                sleep(Duration::from_millis(300)).await;
                                match tokio::net::TcpStream::connect(format!(
                                    "127.0.0.1:{SIDECAR_PORT}"
                                ))
                                .await
                                {
                                    Ok(_) => {
                                        flag.store(true, std::sync::atomic::Ordering::Relaxed);
                                        let _ = app_clone.emit("sidecar:ready", ());
                                        tracing::info!("[sidecar] ready on port {SIDECAR_PORT}");
                                    }
                                    Err(_) => {
                                        tracing::warn!(
                                            "[sidecar] announced start but port {SIDECAR_PORT} is not reachable"
                                        );
                                    }
                                }
                            });
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

        // Sidecar exited — wait for port to free before retrying
        wait_for_port_free(SIDECAR_PORT, 3000).await;

        let delay = Duration::from_millis((500 * restart_count).min(5_000) as u64);
        tracing::info!(
            "[sidecar] restarting in {}ms (attempt {}/{})",
            delay.as_millis(),
            restart_count,
            MAX_RESTART_ATTEMPTS
        );
        sleep(delay).await;
    }
}
