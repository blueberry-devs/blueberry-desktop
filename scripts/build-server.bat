@echo off
setlocal

set SERVER_DIR=%~dp0..\server
set OUT_DIR=%~dp0..\build\packed-server

echo Building server sidecar with cargo...

if exist "%OUT_DIR%" rmdir /s /q "%OUT_DIR%" 2>nul

pushd "%SERVER_DIR%"

where cargo >nul 2>nul
if errorlevel 1 (
  echo cargo not found — install Rust via https://rustup.rs
  popd
  exit /b 1
)

cargo build --release
if errorlevel 1 (
  echo Rust build failed
  popd
  exit /b 1
)

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"
copy /y "target\release\music-server.exe" "%OUT_DIR%\music-server.exe" >nul
popd

echo Server build complete: %OUT_DIR%\music-server.exe
