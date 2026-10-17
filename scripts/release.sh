#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"
DEB="release/graphics-board-$VERSION-amd64.deb"
APPIMAGE="release/graphics-board-$VERSION-x86_64.AppImage"

npm run dist

mkdir -p release/upload
cp "$DEB" release/upload/graphics-board-amd64.deb
cp "$APPIMAGE" release/upload/graphics-board-x86_64.AppImage

if gh release view "$TAG" >/dev/null 2>&1; then
  gh release upload "$TAG" \
    release/upload/graphics-board-amd64.deb \
    release/upload/graphics-board-x86_64.AppImage \
    --clobber
else
  gh release create "$TAG" \
    --title "Graphics Board $TAG" \
    --generate-notes \
    release/upload/graphics-board-amd64.deb \
    release/upload/graphics-board-x86_64.AppImage
fi

echo "Published $TAG (stable asset URLs:"
echo "  .../releases/latest/download/graphics-board-amd64.deb"
echo "  .../releases/latest/download/graphics-board-x86_64.AppImage )"
