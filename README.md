# Aura Store ✦

> **A modern, intelligent, Linux-native software center for Arch Linux and the Arch User Repository (AUR).**

Aura bridges the gap between raw package managers (`pacman`, `paru`, `yay`) and modern desktop app store UX. It replaces text-dump terminal helpers and generic web wrappers with an authoritative, process-backed runtime, deterministic application identity search, repository-aware package inspection, and deep native desktop integration.

---

## 🎯 Project Vision & Core Aim

1. **The Backend / Process is the Single Source of Truth:**
   * Aura never simulates or fakes package states. Progress bars and status badges strictly reflect real-time sub-process output and system state (`pacman -Q`).
2. **Deterministic Intent Resolution (No Black-Box AI in the Critical Path):**
   * Search understands what application you mean (e.g. `chrome` $\rightarrow$ `google-chrome`, `vscode` $\rightarrow$ `visual-studio-code-bin`), prioritizing exact canonical identity over popularity while keeping natural categories broad.
3. **Repository Awareness & Pure Package Normalization:**
   * Clean separation between Application Display Identity, Package Name, and Source Repositories (`AUR`, extensible to official Arch repos).
4. **Robust System Safety & Lifecycle Integrity:**
   * Process-tree signal group handling (`SIGTERM`/`SIGKILL`), mutual exclusion on system-mutating operations, safe stale lock detection, and seamless SSE reconnection across renderer crashes or browser refreshes.
5. **Linux-Native Application Feel:**
   * Direct inspection of system XDG `.desktop` entries to distinguish launchable GUI applications from CLI utilities and libraries, showing `[ Open ]` or `[ Open ▾ ]` only when valid executables exist.

---

## 📈 Current Progress & Version Milestones

```text
v1.0  ── MVP (Basic AUR search, PKGBUILD preview, and terminal-style installs)
  ↓
v2.0  ── Linux-Native Visual System (Curated Explore rails, dark mode, responsive grids)
  ↓
v2.4  ── Lifecycle Completion & Honest Progress (Indeterminate makepkg build states, real metrics)
  ↓
v3.0  ── Native Desktop Integration (XDG .desktop inspection, launch detection via gtk-launch)
  ↓
v3.2  ── Authoritative Operation Engine (Mutex concurrency guard, SSE reconnect, lock recovery)
  ↓
v3.3  ── Intelligent Search & Command Palette (Lexicographical ranking, 500ms debounce, LRU cache)
  ↓
v3.3.1 ── Application Identity & Package Classification (Alias registry, extension demotion)
  ↓
v3.3.2 ── Real-World Search Benchmark (100% accuracy on live AUR regression matrix)
  ↓
v3.4  ── Package Experience & Repository Awareness (Pure view model, source badges, dependency stack)
  ↓
v3.5  ── Installation UX & In-App Sudo Authentication (Askpass bridge, themed AuthModal, error hardening)
  ↓
v3.6  ── Deep Native Desktop & Multi-Entry Integration (Ownership-verified launch, Desktop Actions, grid Open button)
  ↓
v3.6.1 ── Icon Theme Resolution (Icon= field extraction, XDG hicolor lookup & streaming icon API)
  ↓
v3.7  ── Settings & Storage Maintenance (Cache cleaner, orphan packages, user preferences & auto-cleanup)
  ↓
v4.0  ── Native App Packaging & Arch PKGBUILD (Single-process runtime, XDG .desktop, launcher & PKGBUILD) [CURRENT]
```

---

## 🏗️ Architecture Overview

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          AURA FRONTEND (React)                         │
│  • Command Palette (Ctrl+K)   • Explore / Curated Rails                │
│  • Package Experience (v3.4)  • Category Browsers & Updates            │
│  • Installed Library          • Structured Verification Badges         │
│  • Real-time SSE Stream Logs  • Dependency Navigation Stack            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / EventSource (SSE)
┌───────────────────────────────────▼────────────────────────────────────┐
│                    OPERATION ENGINE & SERVER (Node.js)                 │
│  • Mutex Concurrency Guard        • Ring-buffered memory limits        │
│  • Process Tree Killer (-pid)     • Persistent Activity History        │
│  • Lock Safety (pgrep pacman)     • Native XDG Desktop Entry Scanner   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Spawns isolated process groups
┌───────────────────────────────────▼────────────────────────────────────┐
│                      ARCH LINUX SYSTEM BACKEND                         │
│  • pacman  • paru / yay  • makepkg  • pkexec  • gtk-launch / XDG       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Package Experience & View Model Architecture (v3.4)

Aura employs a pure, immutable normalization layer (`packageViewModel.js`) that transforms raw AUR/system data into an authoritative contract:

```text
Raw AUR Metadata + System State (pacman -Q, desktopEntriesMap, operations)
                                  ↓
                  createPackageViewModel(pkg, context)
                                  ↓
┌────────────────────────────────────────────────────────────────────────┐
│                        NORMALIZED VIEW MODEL                           │
│  • identity:       Application Name vs Technical Package Name          │
│  • source:         { type: 'aur', label: 'AUR', fullName: '...' }      │
│  • classification: 'Main package' | 'Variant' | 'Related package'      │
│  • upstream:       { homepage, source (PKGBUILD), aur }                │
│  • dependencies:   runtime (Depends), make, optional, check (accurate) │
│  • launch:         isLaunchable, desktopEntries[]                      │
│  • state:          installed, updateAvailable, launchable, operation   │
└────────────────────────────────────────────────────────────────────────┘
                                  ↓
┌────────────────────────────────────────────────────────────────────────┐
│                      PACKAGE DETAIL SCREEN (React)                     │
│  • Above-the-fold Hero + Ambient Accent Glow                           │
│  • Clear Source & Classification Pills                                 │
│  • Structured Dependencies with Installed Indicators (✓)               │
│  • Deep Navigation Stack (Package A → Dependency B → Back → Package A) │
│  • Lightweight Install Review Dialog (Expandable Details)              │
│  • Build Transparency Notice & Collapsible PKGBUILD Viewer             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🖥️ Native Desktop Integration & Multi-Entry Launch (v3.6)

Aura's launch layer is grounded in real package ownership rather than filename guessing:

```text
pacman -Qlq <package>  (authoritative file list, not a filename heuristic)
                                  ↓
     Filter for */applications/*.desktop paths owned by the package
                                  ↓
              parseDesktopFile() — Name, Exec, isGui, Actions[]
                                  ↓
┌────────────────────────────────────────────────────────────────────────┐
│  One package → every .desktop file it genuinely owns, grouped as-is    │
│  (e.g. a multi-app suite's Writer/Calc/Impress entries group natively) │
│  Each entry also carries its parsed [Desktop Action ...] sub-entries   │
│  (e.g. Chrome "New Window" / "New Private Window")                    │
└────────────────────────────────────────────────────────────────────────┘
                                  ↓
        Open ▾ dropdown (Package Detail Screen AND grid AppCard)
                                  ↓
   gtk-launch (entries) / gio launch (actions), each with a direct-exec
              fallback if the GLib CLI tooling is unavailable
```

Flatpak-installed apps (which pacman doesn't own files for) fall back to a directory scan of `/var/lib/flatpak/exports/share/applications`, keyed by filename — the only place filename-based matching still applies.

---

## 🔍 Search & Ranking Pipeline (v3.3.2)

```text
User Query
   ↓
500ms debounce (AbortController + monotonic request ID)
   ↓
Query Normalization & Term Separation (identityTerms, contextTerms, variantTerms)
   ↓
Smart Candidate Retrieval (fetchSearchCandidates.js — merges AUR + Official Arch Repos + Flathub)
   ↓
LRU Candidate Cache (3-minute TTL, 100 entries max)
   ↓
Package-Family Classification (canonical, official_variant, related, general)
   ↓
Lexicographical Sorting: [primaryScore DESC, popularity DESC, votes DESC]
   ↓
Command Palette (Top 6)  /  Full Grid View (Best Matches + Other Results)
```

---

## 🧪 Automated Test & Verification Suite

Aura maintains a comprehensive multi-tier test suite (**~308 passing assertions** — the adversarial and maintenance suites query live system/package state, so their exact counts can shift slightly run to run):

| Suite | File | Assertions | Purpose |
|---|---|---|---|
| **Packaging & Desktop Integration** | `tests/packaging.test.js` | **30 / 30 PASS** | `.desktop` parsing, SVG vector validity, launcher permissions, PKGBUILD correctness, and the Electron native shell (main process, window icon, IPC wiring) |
| **Official Arch Repo Search** | `tests/official-repo.test.js` | **34 / 34 PASS** | `pacman -Ss`/`-Si` output parsing (fixtures) and live `/api/search/official`, `/api/info/official` endpoint checks |
| **Flathub Search & Install** | `tests/flathub.test.js` | **22 / 22 PASS** | Install command-builder (pure, no flatpak/pkexec invoked), live install-scope detection, and live `/api/search/flathub`, `/api/info/flathub` endpoint checks |
| **Storage & Maintenance** | `tests/maintenance.test.js` | **~22 / 22 PASS** | Cache size calculations, settings persistence, storage API schema, and orphan parsing |
| **In-App Sudo Auth Bridge** | `tests/auth.test.js` | **7 / 7 PASS** | Askpass script integrity, backend response queuing, user cancellation & validation |
| **Icon Theme Resolution** | `tests/icon.test.js` | **14 / 14 PASS** | XDG icon hierarchy, size prioritization, raster/scalable precedence, and MIME types |
| **Desktop Entry Parsing** | `tests/desktop.test.js` | **23 / 23 PASS** | `.desktop` Name/Exec/Icon extraction, GUI/Terminal/NoDisplay detection, Desktop Actions, field-code stripping |
| **Package View Model & Experience** | `tests/package.test.js` | **38 / 38 PASS** | Source awareness (AUR/Official/Flathub/Chaotic-AUR), pure transformations, dependency parsing, and state resolution |
| **Search Core Unit** | `tests/search.test.js` | **27 / 27 PASS** | Normalization, primary/secondary sorting, LRU cache eviction and TTL |
| **Identity & Intent Unit** | `tests/search.identity.test.js` | **22 / 22 PASS** | Alias resolution, variant queries, extension demotion, and ambiguity protection |
| **Live Search Benchmark** | `tests/search.benchmark.js` | **18 / 18 PASS (100%)** | Real queries against live AUR candidates (`chrome`, `vscode`, `firefox`, `discord`, `code`, `music player`) |
| **Adversarial Runtime** | `tests/adversarial.test.js` | **~67 / 67 PASS** | Concurrency conflict (HTTP 409), process cancellation, lock safety, memory bounds, verification invariants |

To run all validation suites:
```bash
node tests/packaging.test.js
node tests/official-repo.test.js
node tests/flathub.test.js
node tests/maintenance.test.js
node tests/auth.test.js
node tests/icon.test.js
node tests/desktop.test.js
node tests/package.test.js
node tests/search.test.js
node tests/search.identity.test.js
node tests/search.benchmark.js
node tests/adversarial.test.js
npm run build
```

---

## 🚀 Running Locally & Desktop Launch

### Prerequisites
* Arch Linux / Arch-based distribution
* Node.js (v18+) & `npm`
* `pacman` and an AUR helper (`paru` or `yay`)

### 1. One-Click Desktop Application Mode
```bash
./bin/aura-store
```
*Automatically builds the production bundle, starts the unified backend on port 3001, and opens the app in a real native window via Electron (frameless, with a custom minimize/maximize/close title bar) — or falls back to an installed browser's isolated `--app` window if Electron isn't available.*

### 2. Development Mode
```bash
# Start backend (Port 3001)
node server/index.js &

# Start Vite dev server (Port 5173)
npm run dev
```

### 3. Arch Linux System Installation via PKGBUILD
```bash
makepkg -si
```

---

## 🗺️ Product Roadmap

* [x] **v3.2** — Authoritative Operation Engine & SSE Reconnection
* [x] **v3.3** — Intelligent Deterministic Search & Command Palette
* [x] **v3.3.1** — Application Identity & Intent Resolution
* [x] **v3.3.2** — Live Real-World Search Benchmark & Regression Corpus
* [x] **v3.4** — Package Detail UX & Inspection Overhaul
* [x] **v3.5** — Installation UX & In-App Sudo Authentication (Askpass bridge, themed AuthModal, error hardening)
* [x] **v3.6** — Deep Native Desktop & Multi-Entry Integration (ownership-verified via `pacman -Qlq`, Desktop Actions, grid Open button)
* [x] **v3.6.1** — Icon Theme Resolution (`Icon=` field + XDG hicolor lookup & backend streaming API)
* [x] **v3.7** — Settings & Storage Maintenance (Cache cleaner, orphan packages, user preferences & auto-cleanup)
* [x] **v4.0** — Native App Packaging (Standalone binary, `.desktop` entry, icon distribution, PKGBUILD, native Electron shell with custom title bar, browser-mode fallback)
* [ ] **v4.1** — Real Arch User Testing & Feedback Loop
* [ ] **v4.2** — Public Release
* [~] **v5.0** — Universal Multi-Source Ecosystem
  * [x] Official Arch Repositories (core/extra/multilib & distro-added repos via `pacman -Ss`/`-Si`, merged into search ranking, source badges in UI)
  * [x] Flathub (search/browse/install/uninstall via Flathub's v2 API + `flatpak`, scope-aware install, verified badges, sandboxed apps distinct from AUR/official)
  * [ ] AppImageHub
  * [x] Chaotic-AUR (distinct orange "Chaotic-AUR" badge + accurate "community-built, not Arch-signed" copy, instead of blending into the generic Official badge)
  * [ ] GitHub Releases
