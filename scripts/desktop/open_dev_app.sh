#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BINARY="$(bash "$ROOT_DIR/scripts/desktop/build_dev.sh")"
APP_DIR="$ROOT_DIR/.build/desktop-dev/SBS 4 Any Agent.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

cp "$BINARY" "$MACOS_DIR/SBSDesktop"
chmod +x "$MACOS_DIR/SBSDesktop"
printf "%s\n" "$ROOT_DIR" > "$RESOURCES_DIR/repo-root.txt"
command -v node > "$RESOURCES_DIR/node-path.txt"
if [ -f "$ROOT_DIR/web/assets/generated/SBSPrism.icns" ]; then
  cp "$ROOT_DIR/web/assets/generated/SBSPrism.icns" "$RESOURCES_DIR/SBSPrism.icns"
fi

cat > "$CONTENTS_DIR/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>SBSDesktop</string>
  <key>CFBundleIdentifier</key>
  <string>local.sbs4anyagent.workbench.dev</string>
  <key>CFBundleName</key>
  <string>SBS 4 Any Agent</string>
  <key>CFBundleDisplayName</key>
  <string>SBS 4 Any Agent</string>
  <key>CFBundleIconFile</key>
  <string>SBSPrism</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0-dev</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

codesign --force --deep --sign - "$APP_DIR" >/dev/null
open -n "$APP_DIR"
echo "$APP_DIR"
