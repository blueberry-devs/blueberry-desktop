#!/usr/bin/env bash
set -euo pipefail

SERVER_DIR="$(cd "$(dirname "$0")/../server" && pwd)"
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/build/packed-server"

echo "Building server sidecar with cargo..."

rm -rf "$OUT_DIR"

if ! command -v cargo &>/dev/null; then
  echo "cargo not found — install Rust via https://rustup.rs"
  exit 1
fi

pushd "$SERVER_DIR" >/dev/null
cargo build --release
popd >/dev/null

mkdir -p "$OUT_DIR"
cp "$SERVER_DIR/target/release/music-server" "$OUT_DIR/music-server"

echo "Server build complete: ${OUT_DIR}/music-server"
