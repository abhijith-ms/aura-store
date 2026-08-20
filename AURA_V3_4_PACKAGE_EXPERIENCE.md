# Aura Store — v3.4 Package Experience & Repository Awareness

## Purpose

Aura's search system has reached a stable and well-tested state.

Current capabilities include:

- 500ms debounced search
- Stale-request protection
- Candidate caching
- Deterministic relevance ranking
- Application identity resolution
- Alias handling
- Package-family classification
- Variant awareness
- Real-world search regression corpus
- Command palette
- Stable result presentation
- 130/130 current automated assertions passing

The next milestone should **not** redesign search again.

The goal of v3.4 is to improve the experience after the user finds a package:

> **Search → Understand → Decide → Install**

The package detail experience should become the place where a user can confidently understand what they are about to install, where it comes from, what it requires, and what Aura is going to do.

---

# 1. Scope

This milestone focuses on:

1. Package identity presentation
2. Package detail UX
3. Source/repository awareness
4. Package metadata hierarchy
5. Dependency presentation
6. Build transparency
7. Installation entry point
8. Installed-state consistency
9. Reusing the existing operation engine
10. Preparing the architecture for future official Arch repository support

This milestone does **not** require a full official Arch repository integration.

The implementation should be architecture-ready for it, but the immediate product remains AUR-focused unless the existing backend already supports repository data.

---

# 2. Core Product Flow

The intended flow is:

```text
Discover
   ↓
Search
   ↓
Package
   ↓
Understand
   ↓
Review
   ↓
Install
   ↓
OperationEngine
```

The package detail page is the bridge between search and system mutation.

The page should not feel like:

> "Here is a lot of AUR metadata."

It should feel like:

> **"Here is the software you found, here is what it is, and here is what will happen if you install it."**

---

# 3. Do Not Redesign Search

The v3.3 / v3.3.1 search architecture is considered stable.

Do not modify unless a concrete package-detail requirement requires it.

Preserve:

- Query normalization
- Identity resolver
- Package classifier
- Ranking engine
- Candidate cache
- 500ms debounce
- AbortController
- Monotonic request IDs
- Command palette
- Search regression tests

The package detail page consumes the output of search.

It does not own ranking logic.

---

# 4. Package Detail Information Hierarchy

The page should progressively reveal information.

## Above the fold

Show only the information required to identify and act:

```text
[Application Icon]

Visual Studio Code
visual-studio-code-bin

Code editor for modern development

AUR

★ 1.7k votes
Popularity 25.2

[ Install ]
```

Depending on state:

```text
[ Install ]
[ Update ]
[ Remove ]
[ Open ]
```

Do not put every technical field above the fold.

---

# 5. Package Identity

The package detail page must clearly distinguish:

### Application identity

```text
Visual Studio Code
```

### AUR package identity

```text
visual-studio-code-bin
```

### Package type

Examples:

```text
Canonical package
Official variant
Related package
```

Where useful, display a subtle badge such as:

```text
Canonical
Variant
```

Do not overload the page with badges.

The package classification should come from the existing deterministic package classifier where possible.

---

# 6. Repository / Source Awareness

Introduce a normalized repository/source concept in the data model.

Conceptually:

```js
{
  source: {
    type: "aur",
    label: "AUR"
  }
}
```

Future-compatible values could include:

```text
aur
official
local
unknown
```

Do not implement unsupported repository types simply for completeness.

For this milestone:

```text
AUR
```

is the primary source.

The goal is to avoid hardcoding the assumption:

> Every future Aura package must be an AUR package.

---

# 7. Repository Presentation

The user should be able to see where the package comes from without technical clutter.

Example:

```text
Source

AUR
Arch User Repository
```

Potential future architecture:

```text
Source
Official Repository
```

or:

```text
Source
AUR
```

The visual treatment should be consistent across package detail, search result metadata, and installed package information if shown.

---

# 8. Package Metadata

Create a clear technical metadata section.

Suggested fields:

```text
Version
Package Base
Maintainer
Architecture
License
First Submitted
Last Modified
Source / Repository
```

Only render fields that actually exist.

Do not show:

```text
Unknown
N/A
—
```

for every missing field unless that information is genuinely useful.

Prefer omitting unavailable fields.

---

# 9. Upstream Information

Where available, provide:

```text
Upstream website
Project URL
Source URL
AUR page
```

Use clear actions:

```text
[ Open upstream ]
[ Open AUR page ]
```

External links should not look like primary application actions.

The primary action remains:

```text
Install
```

---

# 10. About Section

The About section should use the package/application description.

Prefer concise readable content.

If the upstream/AUR description is very long:

- show a truncated preview
- provide "Read more" where useful

Do not dump huge descriptions into the initial page.

Normalize awkward formatting where safely possible, but do not rewrite technical content.

---

# 11. Dependencies

Dependencies should be visually organized.

Recommended:

```text
Dependencies

Runtime
  gtk3
  nss
  libx11

Optional
  pipewire
  pulseaudio

Build
  git
  npm
```

The exact categories depend on available package metadata.

Do not invent dependency types.

If the backend only provides one category, display the available information cleanly rather than pretending there are separate groups.

---

# 12. Dependency Interaction

Dependencies can be clickable where the existing application architecture supports it.

Expected behavior:

```text
Click dependency
      ↓
Open dependency package detail
```

However:

- Do not start installation just by clicking.
- Do not automatically navigate away without a clear back path.
- Preserve the user's previous package context.

The user's package detail navigation should remain understandable.

---

# 13. Dependency State

Where known, show useful local state:

```text
✓ Installed
```

or:

```text
Not installed
```

Do not confuse cached search state with actual installed state.

Installed state must come from the authoritative installed-package backend.

Never display:

```text
✓ Installed
```

based solely on search cache.

---

# 14. Build Transparency

For AUR packages, users should be able to understand that the package may be built locally.

Include a lightweight section:

```text
Build

This package is built locally from its AUR recipe.

[ View PKGBUILD ]
```

This should not be a giant warning box.

The goal is awareness, not fear.

---

# 15. PKGBUILD Viewer

The existing PKGBUILD functionality should be refined rather than rewritten.

Recommended:

```text
PKGBUILD

[ Show PKGBUILD ]
```

When expanded:

```text
┌─────────────────────────────────────────────┐
│ pkgname=...                                 │
│ pkgver=...                                  │
│ ...                                         │
└─────────────────────────────────────────────┘

[ Copy ]
```

Requirements:

- Syntax-friendly readable presentation
- Collapsible
- Copy button
- No horizontal layout breakage
- No automatic execution
- Read-only

Do not make the PKGBUILD visually dominate the page.

---

# 16. AUR Build Context

If appropriate, provide a compact context block:

```text
AUR package

Maintainer: ...
Last modified: ...
Votes: 1.7k
Popularity: 25.2

[ Open AUR page ]
```

Avoid duplicating the same information in three different sections.

The page should have a clear information hierarchy.

---

# 17. Installation CTA

The primary action should always be obvious.

Examples:

```text
[ Install ]
```

or:

```text
[ Update ]
```

or:

```text
[ Remove ]
```

for the relevant package state.

For a launchable installed application:

```text
[ Open ]
[ Details / Remove ]
```

Do not show every possible action at equal visual weight.

---

# 18. Install State Logic

The package detail page should consume authoritative package state.

Conceptually:

```text
not installed
    ↓
Install

installed + update available
    ↓
Update

installed + no update
    ↓
Open / Remove

operation active
    ↓
Operation UI
```

Do not duplicate or reinvent the OperationEngine state machine.

---

# 19. OperationEngine Integration

The package detail page should remain a consumer of the existing operation system.

Flow:

```text
User clicks Install
        ↓
Create operation
        ↓
OperationEngine
        ↓
SSE state updates
        ↓
PackageDetail renders operation state
```

The UI must not simulate progress.

Continue following the existing rule:

> **Backend/process state is the source of truth. The UI reflects process state; it does not simulate it.**

---

# 20. Installation Review

Before an AUR installation begins, show a lightweight review step where useful.

Example:

```text
Install Visual Studio Code

Package
visual-studio-code-bin

Source
AUR

Version
1.133.0-1

Dependencies
...

This package will be built locally.

[ Cancel ]     [ Install ]
```

Do not make this confirmation unnecessarily verbose for every package.

Keep advanced technical information collapsible.

---

# 21. Verification

After installation:

```text
Installing
    ↓
Process exits successfully
    ↓
System verification
    ↓
Verified
```

Use the existing structured verification model.

Example:

```js
verification: {
  status: "verified",
  method: "pacman-query",
  verifiedAt: "...",
  installedVersion: "..."
}
```

Do not replace this with local UI assumptions.

---

# 22. Removal

Removal should use the same operation architecture.

Conceptually:

```text
Remove
  ↓
Review
  ↓
OperationEngine
  ↓
pacman removal
  ↓
Verify package is absent
  ↓
Verified removal
```

The page must not switch to "Removed" simply because the process started or because a button was clicked.

---

# 23. Open Application

Reuse the existing XDG desktop-entry detection.

For packages with:

```text
isLaunchable = true
```

show:

```text
[ Open ]
```

For non-launchable packages:

```text
[ Remove ]
```

or:

```text
[ Details ]
```

depending on context.

Do not create a second launchability detection system.

---

# 24. Multiple Desktop Entries

If the package has:

```js
desktopEntries: []
```

with multiple launchable applications, use:

```text
[ Open ▾ ]
```

Only implement this UI if a real package requires it.

For one desktop entry, retain a simple:

```text
[ Open ]
```

Do not add dropdown complexity preemptively.

---

# 25. Installed State Refresh

After a successful mutation:

```text
install
update
remove
```

refresh the authoritative installed package state.

Expected sequence:

```text
Operation completes
      ↓
Verification
      ↓
Refresh installed state
      ↓
Refresh package detail
      ↓
Refresh library
      ↓
Refresh update information
```

Do not rely solely on local React state mutation.

---

# 26. Activity Integration

Every completed operation should continue to appear in Activity.

Examples:

```text
✓ Visual Studio Code installed
✓ Firefox updated
✕ Packet Tracer build failed
✓ Spotify removed
```

Clicking an Activity entry should provide a way to inspect the relevant operation/package where already supported.

Do not build a separate package-detail history system.

---

# 27. Navigation

Package detail navigation should be predictable.

Recommended:

```text
← Back
```

Use the existing navigation stack/history behavior.

If the user came from:

```text
Search
```

Back should return to search results.

If the user came from:

```text
Explore
```

Back should return to Explore.

Do not always send the user to the homepage.

---

# 28. Search → Package Detail Continuity

When navigating from Search:

- preserve the search query
- preserve result position where practical
- preserve search results when possible

Example:

```text
Search: vscode
      ↓
Visual Studio Code
      ↓
Back
      ↓
Search: vscode
```

The user should not have to repeat the search.

---

# 29. Package Detail Visual Direction

Do not introduce another visual redesign.

Reuse the existing Aura visual system:

- Current typography
- Current spacing
- Current purple identity
- Current light/dark themes
- Current restrained glass usage
- Current card language
- Current motion system

Package Detail should feel like another Aura screen, not a different application.

---

# 30. Ambient Package Branding

Retain the existing subtle ambient glow.

Use:

```text
known application brand color
```

when available.

Fallback:

```text
Aura purple
```

The glow should remain subtle.

It should never interfere with text readability or interaction.

---

# 31. Repository Awareness Architecture

Prepare the package model for future repository support.

Conceptually:

```js
{
  name: "firefox",
  source: {
    type: "aur",
    label: "AUR"
  }
}
```

Future:

```js
{
  source: {
    type: "official",
    label: "Arch Linux"
  }
}
```

Do not implement official repository retrieval merely because this model exists.

This milestone is about designing the boundary cleanly.

---

# 32. Official Repository Investigation

Do a technical investigation before any official repository implementation.

Answer:

1. What Arch package sources should Aura support?
2. Should official repositories and AUR share one search result model?
3. How should source priority work?
4. How should duplicate applications be represented?
5. How should package installation differ?
6. How should update detection work?
7. How should repository labels appear in search?
8. How should official packages vs AUR packages be ranked?

Document findings.

Do not implement the integration unless the investigation concludes it is worthwhile and the architecture is ready.

---

# 33. Search / Repository Future Model

The long-term search architecture could become:

```text
User query
    ↓
Identity resolver
    ↓
Candidate sources
    ├── Official repositories
    └── AUR
          ↓
Unified package model
          ↓
Source-aware ranking
          ↓
Results
```

For duplicates, a future ranking could favor:

```text
Official repository
        ↓
AUR canonical
        ↓
AUR variants
        ↓
Related packages
```

However, do not assume this is the final policy until the repository investigation is complete.

---

# 34. Do Not Touch the Operation Engine

This milestone must preserve:

- OperationEngine
- operationId
- operation ownership
- concurrency mutex
- SSE state updates
- cancellation
- process-group cleanup
- verification
- recovery
- Activity history

Modify only integration points when necessary.

---

# 35. Do Not Rebuild Search

Preserve all current search functionality.

Required regression suites:

```text
tests/search.test.js
tests/search.identity.test.js
tests/search.benchmark.js
tests/adversarial.test.js
```

All existing tests must continue passing.

---

# 36. Suggested Components

Follow the existing project architecture.

Possible components:

```text
components/package/
├── PackageHeader
├── PackageSourceBadge
├── PackageMetadata
├── PackageDependencies
├── PackageBuildInfo
├── PackageLinks
├── PackageInstallReview
└── PackageActions
```

Do not create all of these if existing components already cover the same responsibilities.

The goal is separation of concerns, not component proliferation.

---

# 37. Package Model

Avoid spreading package-detail-specific assumptions throughout React components.

Prefer a normalized package view model.

Conceptually:

```js
{
  name,
  displayName,
  version,
  description,

  source: {
    type,
    label
  },

  classification: {
    type,
    canonicalName
  },

  popularity,
  votes,

  maintainer,
  packageBase,
  architecture,
  license,

  dependencies: {
    runtime,
    optional,
    build
  },

  upstream: {
    homepage,
    source,
    aur
  },

  launch: {
    isLaunchable,
    desktopEntries
  }
}
```

Only populate fields that are actually known.

---

# 38. Loading States

Package detail must handle partial/slow data.

Use:

```text
Header skeleton
Metadata skeleton
Dependency skeleton
```

rather than a full-screen spinner.

The page should progressively render information when possible.

---

# 39. Error States

Examples:

### Package unavailable

```text
Package information is no longer available.

[ Back to Search ]
```

### Metadata fetch failure

```text
Couldn't load package details.

[ Retry ]
```

### PKGBUILD unavailable

```text
PKGBUILD is currently unavailable.

[ Retry ]
```

Do not turn all errors into a generic:

```text
Something went wrong.
```

---

# 40. Acceptance Criteria

v3.4 is successful when:

1. Search results open into a coherent dedicated package detail experience.
2. Application identity and AUR package identity are clearly separated.
3. Source/repository is clearly communicated.
4. Package metadata is progressively disclosed.
5. Dependencies are readable and organized.
6. PKGBUILD remains available without dominating the page.
7. Upstream/AUR links are accessible.
8. Install/Update/Remove actions are obvious.
9. Installation review is concise and informative.
10. OperationEngine remains the source of operation state.
11. Verification state is derived from the existing authoritative verification model.
12. Launch availability comes from existing XDG desktop-entry detection.
13. Multiple desktop entries remain supported.
14. Installed state refreshes after verified mutations.
15. Activity history continues to reflect operations.
16. Search state is preserved when navigating back.
17. Existing visual design remains intact.
18. Existing search tests remain green.
19. Existing adversarial runtime tests remain green.
20. `npm run build` succeeds cleanly.

---

# 41. Definition of Done

Before merging v3.4:

```text
[ ] Package detail visual pass complete
[ ] Package detail loading state tested
[ ] Package detail error state tested
[ ] Install review tested
[ ] Install → verify → refresh tested
[ ] Update → verify → refresh tested
[ ] Remove → verify → refresh tested
[ ] Open desktop application tested
[ ] Non-launchable package tested
[ ] Dependency navigation tested
[ ] PKGBUILD viewer tested
[ ] Back navigation tested from Search
[ ] Back navigation tested from Explore
[ ] Dark theme tested
[ ] Light theme tested
[ ] System theme tested
[ ] search.test.js passing
[ ] search.identity.test.js passing
[ ] search.benchmark.js passing
[ ] adversarial.test.js passing
[ ] npm run build passing
```

---

# 42. Final Product Goal

After v3.4, the core experience should feel like:

```text
Search
  ↓
"This is the software I meant."
  ↓
Package Detail
  ↓
"This is what I'm installing."
  ↓
Review
  ↓
"This is what Aura will do."
  ↓
Install
  ↓
Verified
  ↓
Open / Use
```

The product should feel:

**Simple for new users.**

**Transparent for Arch users.**

**Powerful without being technical by default.**

**Native without copying another operating system's app store.**

---

# 43. Strategic Direction

Aura's long-term opportunity is not merely:

> "A nicer AUR browser."

The stronger product direction is:

> **A native software center for Arch Linux that makes both package discovery and package installation understandable.**

v3.4 should strengthen that experience without prematurely expanding the project.

**Do not add official repository integration until the technical investigation is complete.**

**Do not redesign search.**

**Do not redesign the visual system.**

Improve the package experience and make the architecture ready for a broader package ecosystem.
