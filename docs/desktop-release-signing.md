# Desktop Release And Signing

This project can build a macOS `.dmg` for SBS 4 Any Agent.

## Build Command

```bash
npm run desktop:release
```

Output:

```text
dist/SBS-4-Any-Agent-0.1.0.dmg
```

The release app bundles:

- the Swift/AppKit WKWebView desktop shell;
- a Node binary;
- the local web app;
- the local server;
- schemas;
- SBS skills;
- starter adapter registry data;
- the Prism app icon.

On first launch, the app copies the bundled runtime to:

```text
~/Library/Application Support/SBS 4 Any Agent/runtime
```

Runtime data is stored there instead of being written into the signed `.app` bundle.

## Signing Modes

### Local Test Mode

If no `Developer ID Application` certificate is installed, the script uses ad-hoc signing.

This is enough for local development and internal smoke testing on the same machine.

It is not enough for clean GitHub distribution. Users downloading an ad-hoc signed DMG from the internet may still see Gatekeeper warnings.

### Public Distribution Mode

For a GitHub release where users can install with normal macOS expectations, build with:

- Apple Developer Program membership;
- a `Developer ID Application` certificate in Keychain;
- a `notarytool` keychain profile.

Recommended command:

```bash
SBS_SIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)" \
SBS_NOTARY_PROFILE="sbs-notary-profile" \
npm run desktop:release
```

The script will:

1. sign bundled Node;
2. sign the desktop executable;
3. sign the `.app`;
4. create the `.dmg`;
5. sign the `.dmg`;
6. submit to Apple notarization when `SBS_NOTARY_PROFILE` is set;
7. staple the notarization ticket.

## Why This Matters

macOS Gatekeeper treats unsigned or ad-hoc signed apps downloaded from GitHub as untrusted. To let users double-click the app with at most a normal confirmation flow, the release must be Developer ID signed and notarized.

The project should not ask normal users to run terminal commands such as `xattr -dr com.apple.quarantine ...`.
