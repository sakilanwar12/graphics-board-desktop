# Graphics Board (Desktop)

Desktop whiteboard built for graphics tablets, packaged for Linux as **AppImage** and **Debian (.deb)** with Electron.

Pressure-sensitive pen, highlighter, shapes, graph paper backgrounds, laser pointer, infinite pan/zoom canvas, screen recording with microphone voice-over, and PNG export.

## Download / Install (Ubuntu)

Download the latest release:

- [graphics-board-amd64.deb](https://github.com/sakilanwar12/graphics-board-desktop/releases/latest/download/graphics-board-amd64.deb)
- [graphics-board-x86_64.AppImage](https://github.com/sakilanwar12/graphics-board-desktop/releases/latest/download/graphics-board-x86_64.AppImage)

```bash
# Debian/Ubuntu — recommended: handles sandbox & AppArmor setup automatically
sudo apt install ./graphics-board-amd64.deb

# AppImage — portable, no install
chmod +x ./graphics-board-x86_64.AppImage
./graphics-board-x86_64.AppImage
```

Notes:

- On Ubuntu 24.04+ the AppImage may be blocked by AppArmor's unprivileged
  user-namespace restriction. Run it with `--no-sandbox` if it refuses to start,
  or use the `.deb` (its post-install script installs an AppArmor profile and
  configures the sandbox for you).
- Screen recording uses a native source picker (entire screen / window) and
  records in MP4 when the platform supports it, falling back to WebM.
- `--enable-features=WebRTCPipeWireCapturer` is applied automatically for
  Wayland screen capture.

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
npm run dist       # next build + electron-builder --linux (AppImage + deb)
```

Artifacts land in `release/` as `graphics-board-<version>-amd64.deb` and
`graphics-board-<version>-x86_64.AppImage`.

- Building the `.deb` requires `ar` from binutils: `sudo apt install binutils`
  if the build fails with `Need executable 'ar' to convert dir to deb`.
- AppImage packing has no extra system requirements.

## Releasing

One-time setup: install and authenticate the GitHub CLI (`gh auth login`).

```bash
npm run release    # dist + create/update the v<version> GitHub release
```

The release publishes the two assets under stable names
(`graphics-board-amd64.deb`, `graphics-board-x86_64.AppImage`) so the
`releases/latest/download/...` links on the website never change.

## Project layout

```
app/                  Next.js app (board at /)
components/board/     Board UI, tools, recorder
lib/                  Geometry, drawing, zoom helpers
electron/main.js      Main process: window, display-media picker, permissions
electron/picker.html  Screen/window picker window UI
electron/picker-preload.js
build/icon.png        Packaging icon
public/               Web icons
out/                  Static export (generated)
release/              Packaged artifacts (generated)
```

## Tech

Next.js 16 (static export) · React 19 · Tailwind CSS 4 · Electron 44 ·
electron-builder 26
