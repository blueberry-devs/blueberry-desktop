@echo off
setlocal

set SERVER_DIR=%~dp0..\server
set BIN_DIR=%~dp0..\src-tauri\binaries

echo Building server sidecar...

pushd "%SERVER_DIR%"

where cargo >nul 2>nul
if errorlevel 1 (
  echo cargo not found — install Rust via https://rustup.rs
  popd
  exit /b 1
)

:: Detect Rust host target triple
for /f "tokens=2 delims= " %%t in ('rustc -vV ^| findstr "host:"') do set "TARGET_TRIPLE=%%t"
if "%TARGET_TRIPLE%"=="" set "TARGET_TRIPLE=x86_64-pc-windows-msvc"

echo Target: %TARGET_TRIPLE%

cargo build --release
if errorlevel 1 (
  echo Rust build failed
  popd
  exit /b 1
)

if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"
copy /y "target\release\music-server.exe" "%BIN_DIR%\music-server-%TARGET_TRIPLE%.exe" >nul
popd

echo Sidecar ready: %BIN_DIR%\music-server-%TARGET_TRIPLE%.exe
