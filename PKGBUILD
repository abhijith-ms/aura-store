# Maintainer: Aura Store Contributors <https://github.com/aura-store/aura-store>
pkgname=aura-store-git
_pkgname=aura-store
pkgver=4.0.0
pkgrel=1
pkgdesc="Modern, intelligent Linux software center for Arch Linux and the AUR"
arch=('x86_64' 'aarch64')
url="https://github.com/aura-store/aura-store"
license=('MIT')
depends=('nodejs>=18' 'pacman')
optdepends=(
  'paru: feature-rich AUR helper with PKGBUILD review (recommended)'
  'yay: fast Golang AUR helper'
  'electron: native desktop window (recommended over the browser fallback)'
  'chromium: standalone frameless desktop window (fallback if electron is absent)'
  'brave-bin: standalone frameless desktop window (fallback if electron is absent)'
  'google-chrome: standalone frameless desktop window (fallback if electron is absent)'
)
provides=('aura-store')
conflicts=('aura-store')
source=()
md5sums=()

build() {
  cd "${srcdir}/.." 2>/dev/null || true
  if [ -f "package.json" ]; then
    npm run build
  fi
}

package() {
  local root_dir="${srcdir}/.."
  [ -f "${root_dir}/package.json" ] || root_dir="${pkgdir}"

  # 1. Install app assets to /usr/lib/aura-store
  install -d "${pkgdir}/usr/lib/aura-store"
  install -d "${pkgdir}/usr/lib/aura-store/server"
  install -d "${pkgdir}/usr/lib/aura-store/electron"
  install -d "${pkgdir}/usr/lib/aura-store/assets"
  install -d "${pkgdir}/usr/lib/aura-store/dist"
  install -d "${pkgdir}/usr/bin"
  install -d "${pkgdir}/usr/share/applications"
  install -d "${pkgdir}/usr/share/icons/hicolor/512x512/apps"
  install -d "${pkgdir}/usr/share/icons/hicolor/256x256/apps"
  install -d "${pkgdir}/usr/share/icons/hicolor/128x128/apps"

  # Copy server, electron shell, assets, and dist bundle
  cp -r server/* "${pkgdir}/usr/lib/aura-store/server/" 2>/dev/null || true
  cp -r electron/* "${pkgdir}/usr/lib/aura-store/electron/" 2>/dev/null || true
  cp assets/aura-store.png "${pkgdir}/usr/lib/aura-store/assets/" 2>/dev/null || true
  cp -r dist/* "${pkgdir}/usr/lib/aura-store/dist/" 2>/dev/null || true
  cp package.json "${pkgdir}/usr/lib/aura-store/" 2>/dev/null || true
  chmod +x "${pkgdir}/usr/lib/aura-store/server/askpass.sh" 2>/dev/null || true

  # 2. Binary symlink in /usr/bin
  install -m755 bin/aura-store "${pkgdir}/usr/bin/aura-store"

  # 3. Desktop Entry and Icon (raster only — no vector source, so hicolor gets
  # PNG tiers at the common launcher/taskbar/dock sizes instead of scalable/apps)
  install -m644 aura-store.desktop "${pkgdir}/usr/share/applications/aura-store.desktop"
  install -m644 assets/aura-store.png "${pkgdir}/usr/share/icons/hicolor/512x512/apps/aura-store.png"
  install -m644 assets/aura-store-256.png "${pkgdir}/usr/share/icons/hicolor/256x256/apps/aura-store.png"
  install -m644 assets/aura-store-128.png "${pkgdir}/usr/share/icons/hicolor/128x128/apps/aura-store.png"
}
