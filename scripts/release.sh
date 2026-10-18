#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"
DEB="release/graphics-board-$VERSION-amd64.deb"
APPIMAGE="release/graphics-board-$VERSION-x86_64.AppImage"
WIN_SETUP="release/graphics-board-$VERSION-win-setup-x64.exe"
WIN_PORTABLE="release/graphics-board-$VERSION-win-portable-x64.exe"

npm run dist
npx electron-builder --win

mkdir -p release/upload
cp "$DEB" release/upload/graphics-board-amd64.deb
cp "$APPIMAGE" release/upload/graphics-board-x86_64.AppImage
cp "$WIN_SETUP" release/upload/graphics-board-win-x64-setup.exe
cp "$WIN_PORTABLE" release/upload/graphics-board-win-x64-portable.exe

if gh release view "$TAG" >/dev/null 2>&1; then
  gh release upload "$TAG" release/upload/* --clobber
else
  gh release create "$TAG" \
    --title "Graphics Board $TAG" \
    --generate-notes \
    release/upload/*
fi

echo "Published $TAG (stable asset URLs:"
echo "  .../releases/latest/download/graphics-board-amd64.deb"
echo "  .../releases/latest/download/graphics-board-x86_64.AppImage"
echo "  .../releases/latest/download/graphics-board-win-x64-setup.exe"
echo "  .../releases/latest/download/graphics-board-win-x64-portable.exe )"
