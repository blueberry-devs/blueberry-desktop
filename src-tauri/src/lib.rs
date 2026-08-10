#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Android builds the Tauri application as a library. Keep the runtime entry
// point shared with the desktop binary to avoid platform-specific drift.
include!("main.rs");
