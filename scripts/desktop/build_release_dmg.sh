#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERSION="${SBS_VERSION:-1.0.0}"
BUILD_ID="${SBS_BUILD_ID:-$(date -u '+%Y%m%d%H%M%S')}"
APP_NAME="SBS 4 Any Agent"
RELEASE_DIR="$ROOT_DIR/.build/release"
APP_DIR="$RELEASE_DIR/$APP_NAME.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
RUNTIME_DIR="$RESOURCES_DIR/app"
NODE_DIR="$RESOURCES_DIR/node/bin"
DIST_DIR="$ROOT_DIR/dist"
DMG_PATH="$DIST_DIR/SBS-4-Any-Agent-${VERSION}.dmg"
STAGING_DIR="$RELEASE_DIR/dmg-staging"

rm -rf "$APP_DIR" "$STAGING_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR" "$RUNTIME_DIR" "$NODE_DIR" "$DIST_DIR"

BINARY="$(bash "$ROOT_DIR/scripts/desktop/build_dev.sh")"
cp "$BINARY" "$MACOS_DIR/SBSDesktop"
chmod +x "$MACOS_DIR/SBSDesktop"

NODE_BIN="${SBS_NODE_BIN:-$(command -v node)}"
if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  echo "Unable to find an executable node binary. Set SBS_NODE_BIN=/path/to/node." >&2
  exit 1
fi
cp -L "$NODE_BIN" "$NODE_DIR/node"
chmod +x "$NODE_DIR/node"

copy_dir() {
  local src="$1"
  local dst="$2"
  if [ -d "$ROOT_DIR/$src" ]; then
    mkdir -p "$(dirname "$dst")"
    rsync -a --delete --exclude ".DS_Store" --exclude "__MACOSX" "$ROOT_DIR/$src/" "$dst/"
  fi
}

copy_file() {
  local src="$1"
  local dst="$2"
  if [ -f "$ROOT_DIR/$src" ]; then
    mkdir -p "$(dirname "$dst")"
    cp "$ROOT_DIR/$src" "$dst"
  fi
}

copy_dir "web" "$RUNTIME_DIR/web"
copy_dir "server" "$RUNTIME_DIR/server"
copy_dir "schemas" "$RUNTIME_DIR/schemas"
copy_dir "skills" "$RUNTIME_DIR/skills"
mkdir -p "$RUNTIME_DIR/scripts"
copy_dir "scripts/capture" "$RUNTIME_DIR/scripts/capture"
copy_file "package.json" "$RUNTIME_DIR/package.json"
copy_file "PROJECT_BRIEF.md" "$RUNTIME_DIR/PROJECT_BRIEF.md"
copy_file "AGENTS.md" "$RUNTIME_DIR/AGENTS.md"

# Ship only safe starter data. Runtime user data lives in Application Support
# after first launch, not inside the signed app bundle.
mkdir -p "$RUNTIME_DIR/data/adapters" "$RUNTIME_DIR/data/tasks" "$RUNTIME_DIR/data/packages" "$RUNTIME_DIR/data/runs" "$RUNTIME_DIR/data/reports" "$RUNTIME_DIR/data/curation"
copy_file "data/adapters/index.json" "$RUNTIME_DIR/data/adapters/index.json"
if [ -d "$ROOT_DIR/seed-data/featured-demo/tasks" ]; then
  copy_dir "seed-data/featured-demo/tasks" "$RUNTIME_DIR/data/tasks"
else
  printf '{"items":[],"updatedAt":null}\n' > "$RUNTIME_DIR/data/tasks/index.json"
fi

printf "%s\n" "$VERSION-$BUILD_ID" > "$RESOURCES_DIR/app-runtime-version.txt"
if [ -f "$ROOT_DIR/web/assets/generated/SBSPrism.icns" ]; then
  cp "$ROOT_DIR/web/assets/generated/SBSPrism.icns" "$RESOURCES_DIR/SBSPrism.icns"
fi

cat > "$CONTENTS_DIR/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>SBSDesktop</string>
  <key>CFBundleIdentifier</key>
  <string>local.sbs4anyagent.workbench</string>
  <key>CFBundleName</key>
  <string>$APP_NAME</string>
  <key>CFBundleDisplayName</key>
  <string>$APP_NAME</string>
  <key>CFBundleIconFile</key>
  <string>SBSPrism</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>$VERSION</string>
  <key>CFBundleVersion</key>
  <string>$BUILD_ID</string>
  <key>LSApplicationCategoryType</key>
  <string>public.app-category.developer-tools</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

resolve_sign_identity() {
  if [ -n "${SBS_SIGN_IDENTITY:-}" ]; then
    printf "%s" "$SBS_SIGN_IDENTITY"
    return
  fi
  security find-identity -v -p codesigning 2>/dev/null \
    | awk -F '"' '/Developer ID Application/ { print $2; exit }'
}

SIGN_IDENTITY="$(resolve_sign_identity)"
SIGN_MODE="ad-hoc"
if [ -n "$SIGN_IDENTITY" ]; then
  SIGN_MODE="developer-id"
else
  SIGN_IDENTITY="-"
fi

sign_item() {
  local item="$1"
  if [ "$SIGN_MODE" = "developer-id" ]; then
    codesign --force --options runtime --timestamp --sign "$SIGN_IDENTITY" "$item"
  else
    codesign --force --sign "$SIGN_IDENTITY" "$item"
  fi
}

sign_item "$NODE_DIR/node"
sign_item "$MACOS_DIR/SBSDesktop"
sign_item "$APP_DIR"
codesign --verify --deep --strict "$APP_DIR"

mkdir -p "$STAGING_DIR"
cp -R "$APP_DIR" "$STAGING_DIR/$APP_NAME.app"
ln -s /Applications "$STAGING_DIR/Applications"

rm -f "$DMG_PATH"
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$STAGING_DIR" \
  -ov \
  -format UDZO \
  "$DMG_PATH" >/dev/null

if [ "$SIGN_MODE" = "developer-id" ]; then
  sign_item "$DMG_PATH"
  if [ -n "${SBS_NOTARY_PROFILE:-}" ]; then
    xcrun notarytool submit "$DMG_PATH" --keychain-profile "$SBS_NOTARY_PROFILE" --wait
    xcrun stapler staple "$DMG_PATH"
  else
    echo "Developer ID signing complete. Set SBS_NOTARY_PROFILE to notarize and staple the DMG." >&2
  fi
else
  cat >&2 <<'NOTE'
Built with ad-hoc signing because no Developer ID Application identity was found.
This DMG is suitable for local testing. For GitHub distribution that opens cleanly
after a normal double-click, build with a Developer ID certificate and notarize:

  SBS_SIGN_IDENTITY="Developer ID Application: ..." \
  SBS_NOTARY_PROFILE="your-notarytool-profile" \
  npm run desktop:release
NOTE
fi

echo "$DMG_PATH"
