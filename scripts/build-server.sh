#!/usr/bin/env bash
set -euo pipefail

SERVER_DIR="$(cd "$(dirname "$0")/../server" && pwd)"
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/build/packed-server"

echo "Building server sidecar with PyInstaller..."

rm -rf "$OUT_DIR"

pyinstaller --noconfirm --onefile \
  --name music-server \
  --distpath "$OUT_DIR" \
  --workpath /tmp/pyinstaller-music \
  --collect-data certifi \
  --collect-all yandex_music \
  --collect-all yt_dlp \
  --collect-all pytubefix \
  "${SERVER_DIR}/main.py"

echo "Server build complete: ${OUT_DIR}/music-server"
