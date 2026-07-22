@echo off
cd /d "%~dp0..\server"

:: In dev mode the Electron main process (src/main/index.ts) spawns the
:: sidecar binary automatically via startSidecar(), which searches several
:: target paths including:
::   server\target\x86_64-pc-windows-gnu\release\music-server.exe
::
:: This script just keeps the concurrently "server" process alive so the
:: dev command doesn't exit prematurely.  The actual sidecar lifecycle is
:: managed by Electron's main process.
::
:: To rebuild the server after changing Rust code, use WSL:
::   cd server && cargo build --release --target x86_64-pc-windows-gnu
::
:: To test the server standalone:
::   server\target\x86_64-pc-windows-gnu\release\music-server.exe

echo [dev-watch] Sidecar is managed by Electron (startSidecar). Holding...
echo [dev-watch] Rebuild with: cd server ^&^& cargo build --release --target x86_64-pc-windows-gnu

:: Stay alive so concurrently doesn't restart or exit
:: Use ping instead of timeout because timeout.exe requires a console stdin
:: and fails when spawned by Node.js/concurrently with piped stdin
:loop
ping -n 11 127.0.0.1 >nul
goto loop
