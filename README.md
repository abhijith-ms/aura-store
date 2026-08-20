# Aura Store ✦

> **A modern, intelligent, Linux-native software center for Arch Linux and the Arch User Repository (AUR).**

Aura bridges the gap between raw package managers (`pacman`, `paru`, `yay`) and modern desktop app store UX. It replaces text-dump terminal helpers and generic web wrappers with an authoritative, process-backed runtime, deterministic application identity search, and deep native desktop integration.

---

## 🎯 Project Vision & Core Aim

1. **The Backend / Process is the Single Source of Truth:**
   * Aura never simulates or fakes package states. Progress bars and status badges strictly reflect real-time sub-process output and system state (`pacman -Q`).
2. **Deterministic Intent Resolution (No Black-Box AI in the Critical Path):**
   * Search understands what application you mean (e.g. `chrome` $\rightarrow$ `google-chrome`, `vscode` $\rightarrow$ `visual-studio-code-bin`), prioritizing exact canonical identity over popularity while keeping natural categories broad.
3. **Robust System Safety & Lifecycle Integrity:**
   * Process-tree signal group handling (`SIGTERM`/`SIGKILL`), mutual exclusion on system-mutating operations, safe stale lock detection, and seamless SSE reconnection across renderer crashes or browser refreshes.
4. **Linux-Native Application Feel:**
   * Direct inspection of system XDG `.desktop` entries to distinguish launchable GUI applications from CLI utilities and libraries, showing `[ Open ]` only when valid executables exist.

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
v3.3.2 ── Real-World Search Benchmark (100% accuracy on live AUR regression matrix) [CURRENT]
```

---

## 🏗️ Architecture Overview

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          AURA FRONTEND (React)                         │
│  • Command Palette (Ctrl+K)   • Explore / Curated Rails                │
│  • Installed Library          • Category Browsers & Updates            │
│  • Real-time SSE Stream Logs  • Structured Verification Badges         │
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

## 🔍 Search & Ranking Pipeline (v3.3.2)

```text
User Query
   ↓
500ms debounce (AbortController + monotonic request ID)
   ↓
Query Normalization & Term Separation (identityTerms, contextTerms, variantTerms)
   ↓
Smart Candidate Retrieval (fetchSearchCandidates.js)
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

Aura maintains a comprehensive multi-tier test suite (**130 / 130 passing assertions**):

| Suite | File | Tests | Purpose |
|---|---|---|---|
| **Live Search Benchmark** | `tests/search.benchmark.js` | **18 / 18 PASS (100%)** | Real queries against live AUR candidates (`chrome`, `vscode`, `firefox`, `discord`, `code`, `music player`) |
| **Identity & Intent Unit** | `tests/search.identity.test.js` | **22 / 22 PASS** | Alias resolution, variant queries, extension demotion, and ambiguity protection |
| **Search Core Unit** | `tests/search.test.js` | **27 / 27 PASS** | Normalization, primary/secondary sorting, LRU cache eviction and TTL |
| **Adversarial Runtime** | `tests/adversarial.test.js` | **63 / 63 PASS** | Concurrency conflict (HTTP 409), process cancellation, lock safety, memory bounds, verification invariants |

To run all validation suites:
```bash
node tests/search.test.js
node tests/search.identity.test.js
node tests/search.benchmark.js
node tests/adversarial.test.js
npm run build
```

---

## 🚀 Running Locally

### Prerequisites
* Arch Linux / Arch-based distribution
* Node.js (v18+) & `npm`
* `pacman` and an AUR helper (`paru` or `yay`)

### Start Aura Store
```bash
# 1. Install dependencies
npm install

# 2. Start the backend Operation Engine (Port 3001)
node server/index.js &

# 3. Start the frontend interface (Port 5173)
npm run dev
```

Visit **[http://localhost:5173](http://localhost:5173)** to use Aura Store.

---

## 🗺️ Product Roadmap

* [x] **v3.2** — Authoritative Operation Engine & SSE Reconnection
* [x] **v3.3** — Intelligent Deterministic Search & Command Palette
* [x] **v3.3.1** — Application Identity & Intent Resolution
* [x] **v3.3.2** — Live Real-World Search Benchmark & Regression Corpus
* [ ] **v3.4** — Package Detail UX & Inspection Overhaul
* [ ] **v3.5** — Installation UX & Error Recovery Hardening
* [ ] **v3.6** — Deep Native Desktop & Multi-Entry Integration
* [ ] **v3.7** — Minimal Preferences & Settings
* [ ] **v4.0** — Native App Packaging (Standalone binary, `.desktop` entry, icon distribution)
* [ ] **v4.1** — Real Arch User Testing & Feedback Loop
* [ ] **v4.2** — Public Release
