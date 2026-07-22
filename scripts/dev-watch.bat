@echo off
cd /d "%~dp0..\server"
cargo watch -w src -s "cargo build --release && powershell -Command \"Get-NetTCPConnection -LocalPort 8787 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }\""
