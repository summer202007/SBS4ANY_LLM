#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SDK_PATH="$(xcrun --sdk macosx --show-sdk-path)"
ARCH="$(uname -m)"

mkdir -p "$ROOT_DIR/.build/desktop-dev" "$ROOT_DIR/.build/module-cache"

CLANG_MODULE_CACHE_PATH="$ROOT_DIR/.build/module-cache" \
swiftc \
  -target "${ARCH}-apple-macosx13.0" \
  -sdk "$SDK_PATH" \
  -framework AppKit \
  -framework WebKit \
  "$ROOT_DIR/desktop/Sources/SBSDesktop/main.swift" \
  -o "$ROOT_DIR/.build/desktop-dev/SBSDesktop"

echo "$ROOT_DIR/.build/desktop-dev/SBSDesktop"
