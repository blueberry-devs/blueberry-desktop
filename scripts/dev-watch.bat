@echo off
cd /d "%~dp0..\server"
cargo watch -w src -s "cargo build --release && powershell -ExecutionPolicy Bypass -File kill-sidecar.ps1"
