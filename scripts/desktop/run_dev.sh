#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BINARY="$(bash "$ROOT_DIR/scripts/desktop/build_dev.sh")"

SBS_ROOT="$ROOT_DIR" SBS_NODE_PATH="$(command -v node)" "$BINARY"
