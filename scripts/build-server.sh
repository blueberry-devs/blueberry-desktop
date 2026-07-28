#!/usr/bin/env bash
set -euo pipefail

SERVER_DIR="$(cd "$(dirname "$0")/../server" && pwd)"
BIN_DIR="$(cd "$(dirname "$0")/.." && pwd)/src-tauri/binaries"

echo "Building server sidecar..."

if ! command -v cargo &>/dev/null; then
  echo "cargo not found — install Rust via https://rustup.rs"
  exit 1
fi

TARGET_TRIPLE=$(rustc -vV | grep '^host:' | cut -d' ' -f2)
echo "Target: ${TARGET_TRIPLE}"

pushd "$SERVER_DIR" >/dev/null
cargo build --release
popd >/dev/null

mkdir -p "$BIN_DIR"

# Platform-specific binary name
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
  cp "$SERVER_DIR/target/release/music-server.exe" "$BIN_DIR/music-server-${TARGET_TRIPLE}.exe"
else
  cp "$SERVER_DIR/target/release/music-server" "$BIN_DIR/music-server-${TARGET_TRIPLE}"
fi

echo "Sidecar ready: music-server-${TARGET_TRIPLE}"
