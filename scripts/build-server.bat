@echo off
setlocal

set SERVER_DIR=%~dp0..\server
set OUT_DIR=%~dp0..\build\packed-server

echo Building server sidecar with PyInstaller...

if exist "%OUT_DIR%" rmdir /s /q "%OUT_DIR%" 2>nul

python -m PyInstaller --noconfirm --onefile ^
  --name music-server ^
  --distpath "%OUT_DIR%" ^
  --workpath "%TEMP%\pyinstaller-music" ^
  --collect-data certifi ^
  --collect-all yandex_music ^
  --collect-all yt_dlp ^
  --collect-all pytubefix ^
  "server\main.py"

if errorlevel 1 (
  echo PyInstaller build failed
  exit /b 1
)

echo Server build complete: %OUT_DIR%\music-server.exe
