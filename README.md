# Graphics Board (Desktop)

Desktop whiteboard built for graphics tablets, packaged with Electron for Linux (**AppImage** and **Debian .deb**), macOS (**universal DMG** for Apple Silicon + Intel), and Windows (**installer** and **portable exe**).

Pressure-sensitive pen, highlighter, shapes, graph paper backgrounds, laser pointer, infinite pan/zoom canvas, screen recording with microphone voice-over, and PNG export.

## Download / Install

Latest release:

- Linux: [graphics-board-amd64.deb](https://github.com/sakilanwar12/graphics-board-desktop/releases/latest/download/graphics-board-amd64.deb) · [graphics-board-x86_64.AppImage](https://github.com/sakilanwar12/graphics-board-desktop/releases/latest/download/graphics-board-x86_64.AppImage)
- macOS: [graphics-board-mac-universal.dmg](https://github.com/sakilanwar12/graphics-board-desktop/releases/latest/download/graphics-board-mac-universal.dmg)
- Windows: [graphics-board-win-x64-setup.exe](https://github.com/sakilanwar12/graphics-board-desktop/releases/latest/download/graphics-board-win-x64-setup.exe) · [graphics-board-win-x64-portable.exe](https://github.com/sakilanwar12/graphics-board-desktop/releases/latest/download/graphics-board-win-x64-portable.exe)

```bash
# Debian/Ubuntu — recommended: handles sandbox & AppArmor setup automatically
sudo apt install ./graphics-board-amd64.deb

# AppImage — portable, no install
chmod +x ./graphics-board-x86_64.AppImage
./graphics-board-x86_64.AppImage
```

macOS: open the `.dmg` and drag **Graphics Board** into Applications. The build is
not notarized (no Apple Developer certificate), so macOS Gatekeeper will warn on
first launch — right-click the app and choose **Open**, or run
`xattr -cr "/Applications/Graphics Board.app"`. The first screen recording asks
for Screen Recording and Microphone permission in System Settings.

Windows: run `graphics-board-win-x64-setup.exe` to install (per-user, no admin
needed; you can pick the install folder and get desktop/Start Menu shortcuts),
or run `graphics-board-win-x64-portable.exe` directly without installing. The
build is unsigned (no code-signing certificate), so Windows SmartScreen may show
"Windows protected your PC" on first run — click **More info** → **Run anyway**,
and the microphone prompt appears on first screen recording.

Notes:

- On Ubuntu 24.04+ the AppImage may be blocked by AppArmor's unprivileged
  user-namespace restriction. Run it with `--no-sandbox` if it refuses to start,
  or use the `.deb` (its post-install script installs an AppArmor profile and
  configures the sandbox for you).
- Screen recording uses a native source picker (entire screen / window) and
  records in MP4 when the platform supports it, falling back to WebM.
- `--enable-features=WebRTCPipeWireCapturer` is applied automatically for
  Wayland screen capture (Linux only).

## Development

```bash
npm install
npm run dev        # Next.js dev server in the browser (http://localhost:3000)
npm start          # build first, then run the Electron app against out/
```

The renderer is a Next.js static export: `npm run build` emits `out/`, and the
Electron main process loads `out/index.html` from disk.

## Building packages

```bash
npm run dist       # Linux: next build + electron-builder --linux (AppImage + deb)
npm run dist:mac   # macOS: next build + electron-builder --mac (dmg + zip)
npm run dist:win   # Windows: next build + electron-builder --win (installer + portable)
```

Artifacts land in `release/`.

- Linux: `graphics-board-<version>-amd64.deb` and
  `graphics-board-<version>-x86_64.AppImage`.
- macOS: `graphics-board-<version>-mac-<arch>.dmg` and `.zip`
  (`arch` is `universal`, `arm64`, or `x64`).
- Windows: `graphics-board-<version>-win-setup-x64.exe` and
  `graphics-board-<version>-win-portable-x64.exe`.

Linux build requirements:

- Building the `.deb` requires `ar` from binutils: `sudo apt install binutils`
  if the build fails with `Need executable 'ar' to convert dir to deb`.
- AppImage packing has no extra system requirements.
- Building the Windows installer on Linux requires wine (used to extract the
  unsigned uninstaller). Install both loaders:
  `sudo dpkg --add-architecture i386 && sudo apt update && sudo apt install wine wine32:i386`

macOS build requirements:

- DMG creation uses `hdiutil`, so `npm run dist:mac` must run on macOS (or the
  `Build macOS` GitHub Actions workflow).
- For a release build, also pass `--universal` for a single Apple Silicon +
  Intel DMG: `npx electron-builder --mac --universal`.
- On a Mac without an Apple Developer certificate, add `-c.mac.identity=-` to
  ad-hoc sign the app (required for the arm64 slice to launch).
- For quick testing, an unsigned x64 `.zip` can be cross-built on Linux with
  `npx electron-builder --mac zip --x64` (no DMG, no signing).

Windows build requirements:

- Building natively on Windows needs no extra tools. Building on Linux also
  works with wine installed (see above); the result is identical.

## Releasing

One-time setup: install and authenticate the GitHub CLI (`gh auth login`).

```bash
npm run release    # Linux + Windows: dist + create/update the v<version> release
```

The release publishes the Linux assets under stable names
(`graphics-board-amd64.deb`, `graphics-board-x86_64.AppImage`) and the Windows
assets as `graphics-board-win-x64-setup.exe` and
`graphics-board-win-x64-portable.exe`, so the
`releases/latest/download/...` links on the website never change.

macOS assets are built by the `Build macOS` workflow
(`.github/workflows/build-mac.yml`), which runs on `macos-latest` for tags
`v*` (and manually via *workflow_dispatch*). It uploads a universal, ad-hoc
signed DMG and attaches them to the same GitHub release as
`graphics-board-mac-universal.dmg`. Pushing a tag builds and publishes all
platforms: the Linux release script and the macOS workflow both create the
release if it does not exist yet.

## Project layout

```
app/                  Next.js app (board at /)
components/board/     Board UI, tools, recorder
lib/                  Geometry, drawing, zoom helpers
electron/main.js      Main process: window, display-media picker, permissions
electron/picker.html  Screen/window picker window UI
electron/picker-preload.js
build/icon.png        Packaging icon (converted to .icns for macOS)
build/entitlements.mac.plist  macOS hardened-runtime entitlements
.github/workflows/build-mac.yml  macOS DMG/zip build & release
public/               Web icons
out/                  Static export (generated)
release/              Packaged artifacts (generated)
```

## Tech

Next.js 16 (static export) · React 19 · Tailwind CSS 4 · Electron 44 ·
electron-builder 26
