# Aura Store — UI/UX Design Direction

## Purpose

This document defines the visual and UX direction for Aura Store.

Aura is an app store for Arch Linux using the AUR as its backend. The MVP already provides the core functionality. The goal of this phase is **not to add unnecessary features**, but to make the existing product feel polished, modern, distinctive, simple, and native to the Linux desktop.

The target feeling is:

> **A beautiful native Linux app store with the simplicity of macOS, the discovery experience of Steam, the keyboard-first feel of Raycast, and the power of the AUR underneath.**

Do **not** copy macOS App Store literally. Aura should have its own identity.

---

# 1. Core Design Philosophy

### 1.1 Native, not SaaS

Aura must feel like a desktop application, not a web dashboard.

Avoid:
- Dashboard-like layouts
- Excessive cards
- Dense analytics widgets
- Generic SaaS gradients
- Huge metric panels
- Overly rounded "AI SaaS" components
- Excessive badges

Prefer:
- Open layouts
- Strong typography hierarchy
- Content-focused navigation
- Subtle surfaces
- Native-feeling controls
- Keyboard accessibility
- System theme integration

---

### 1.2 Simple first, powerful underneath

The primary UI should only show the information necessary to discover and install software.

Technical AUR information should remain accessible, but should not dominate the default experience.

**Surface layer:**
- Application name
- Package name
- Icon
- Description
- Votes
- Popularity
- Installation state
- Primary action

**Power-user layer:**
- Version
- Maintainer
- Last updated
- Dependencies
- Build dependencies
- Architecture
- License
- Source
- PKGBUILD/build information
- Other AUR metadata

The user should not feel overwhelmed by AUR complexity.

---

### 1.3 Search is a primary feature

Searching for software is one of the most important interactions in Aura.

The search experience should be excellent.

Support:
- Prominent search field
- Keyboard shortcut: `Ctrl/Cmd + K`
- Fast results
- Recent searches/packages
- Keyboard navigation
- Enter to open
- Escape to close
- Clear focus states

Search should feel like a first-class application launcher, not just a form field.

---

### 1.4 The core product loop

Design everything around:

**Discover → Search → Inspect → Install → Update**

Avoid adding features that do not improve this loop.

---

# 2. Visual Identity

## 2.1 Brand

The existing Aura purple identity should be retained.

Aura should feel:
- Dark
- Elegant
- Slightly futuristic
- Calm
- Technical without being intimidating

Purple is the brand accent, not the dominant color of every component.

Use purple primarily for:
- Active navigation
- Primary buttons
- Focus states
- Selected elements
- Important interactive states
- Very subtle ambient lighting

Do not make the entire UI purple.

---

# 3. Color System

These values are starting points, not strict requirements. Preserve the overall relationships even if the implementation uses equivalent tokens.

## Dark Theme

```text
Background:       #09090B
Surface:          #121214
Surface Hover:    #18181B
Border:           #252529
Text Primary:     #F4F4F5
Text Secondary:   #A1A1AA
Text Muted:       #71717A
Accent:           #8B5CF6
Accent Hover:     #9B6DFF
Success:          #22C55E
```

## Light Theme

```text
Background:       #F6F6F8
Surface:          #FFFFFF
Surface Soft:     #F1F1F4
Border:           rgba(0, 0, 0, 0.07)
Text Primary:     #18181B
Text Secondary:   #52525B
Text Muted:       #71717A
Accent:           #7C3AED
Accent Hover:     #6D28D9
Success:          #16A34A
```

The exact colors can be adjusted during implementation, but maintain:
- High readability
- Low visual noise
- Subtle contrast
- Purple as the identity color

---

# 4. Dark and Light Mode

Aura **must support both dark and light themes**.

Also support:

**System**

The default appearance should follow the operating system preference.

Available options:

```text
System
Light
Dark
```

Do not make light mode a simple inverted version of dark mode. Both themes should be deliberately designed.

### Theme priorities

1. System
2. Dark
3. Light

Dark mode should receive the most visual attention during initial implementation because it fits Aura's current identity, but light mode must remain polished.

---

# 5. Glassmorphism

Glassmorphism can be used, but **restrained glass**, not "everything is glass".

## Good uses

Use glass/translucency for:
- Sidebar
- Top navigation/search surface
- Floating dialogs
- Command/search palette
- Modals
- Contextual overlays
- Package detail hero surfaces where appropriate

## Avoid

Do not make:
- Every package card glass
- Every section translucent
- Text sit over heavily blurred backgrounds
- Multiple layers of translucent cards
- Excessive backdrop blur

The goal is:

> **Soft glass surfaces over a calm background.**

Not:

> **A pile of transparent cards.**

---

# 6. Background

Avoid a completely flat black/white background.

Use very subtle ambient lighting.

For dark mode:
- Dark neutral base
- Very subtle violet/blue radial gradients
- Optional extremely subtle grain/noise

The ambient glow should be something users feel rather than consciously notice.

Never use a large obvious purple gradient behind the entire application.

---

# 7. Layout

The application should use a desktop-app style layout.

Recommended structure:

```text
┌─────────────────────────────────────────────────────────────┐
│ Aura Store        Search                         Refresh     │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│ DISCOVER     │ Discover                                     │
│              │ Find software for your Arch system           │
│ Explore      │                                              │
│              │ Search packages...                           │
│ LIBRARY      │                                              │
│ Installed    │ Popular on AUR                               │
│ Updates      │                                              │
│              │ Package rail                                 │
│ CATEGORIES   │                                              │
│ Development  │ Recently Updated                             │
│ Browsers     │                                              │
│ Gaming       │ Package rail                                 │
│ Media        │                                              │
│ System Tools │                                              │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

The exact implementation may differ, but the important principles are:

- Persistent navigation
- Clear content hierarchy
- Large usable content area
- No huge unused areas
- No dashboard-style widget grid

---

# 8. Sidebar

The sidebar should be simple.

Suggested structure:

```text
AURA

DISCOVER

✦ Explore

LIBRARY

✓ Installed
↑ Updates

CATEGORIES

Development
Browsers
Media & Audio
Gaming
System Tools

------------------

Settings
About
```

Do not make every possible feature a sidebar item.

The sidebar represents destinations, not every section of the homepage.

Avoid making "Top Charts" a primary navigation destination. It should be a content section on Explore.

---

# 9. Homepage / Explore

The Explore page should prioritize discovery and search.

## Recommended hierarchy

```text
Discover

Software for your Arch system

[ Search AUR packages... ]

Popular on AUR                         View all →

[ Package ] [ Package ] [ Package ] [ Package ]

Recently Updated                      View all →

[ Package ] [ Package ] [ Package ] [ Package ]
```

Potential future sections:

- Popular on AUR
- Recently Updated
- Trending
- New & Noteworthy
- Categories

Do not show duplicate packages in multiple sections unless there is a clear reason.

---

# 10. Search as the Hero

The homepage should not depend on a giant featured banner.

The primary visual focus should be search.

Example:

```text
Discover

Find software from the Arch User Repository

┌────────────────────────────────────────────────────┐
│  Search packages, applications, developers...  ⌘K │
└────────────────────────────────────────────────────┘
```

A giant "Featured Package" banner should not consume most of the viewport.

---

# 11. Package Cards

Package cards should be information-dense without feeling cluttered.

The hierarchy should be:

1. Application icon
2. Human-readable application name
3. AUR package name
4. Short description
5. Votes / popularity
6. Installation state
7. Primary action

Example:

```text
┌──────────────────────────────────────┐
│                                      │
│  [ICON]                              │
│                                      │
│  Visual Studio Code                 │
│  visual-studio-code-bin             │
│                                      │
│  Code editor for modern development │
│                                      │
│  ★ 1.7k       Popularity 25.2       │
│                                      │
│                         [ Install ]  │
└──────────────────────────────────────┘
```

However, avoid excessive borders.

Cards may use:
- Subtle background contrast
- Minimal borders
- Soft hover states

Not every piece of content needs to be enclosed in a visible rectangle.

---

# 12. Application Name vs Package Name

Always prioritize the human-readable application name.

Prefer:

```text
Visual Studio Code
visual-studio-code-bin
```

instead of:

```text
visual-studio-code-bin
Visual Studio Code
```

The AUR package name is important, but it is secondary in the visual hierarchy.

---

# 13. Installation States

Buttons must communicate state clearly.

Possible states:

```text
Install
Installed
Update
Installing...
Queued
Failed
```

Examples:

```text
[ Install ]
[ ✓ Installed ]
[ ↑ Update ]
[ Installing... ]
```

The primary action should be visually clear without becoming oversized.

---

# 14. Package Details

The package detail page is one of Aura's most important screens.

Suggested structure:

```text
← Back

[Icon]

Visual Studio Code
visual-studio-code-bin

Code editor for modern development

★ 1.7k votes
Popularity 25.2
AUR

[ Install ]

────────────────────────────────

About

Description...

────────────────────────────────

Package Information

Version
Maintainer
Last updated
Architecture
License

────────────────────────────────

Dependencies

...

────────────────────────────────

Build Information

...

────────────────────────────────

AUR Information

...
```

The page should be simple initially, with technical information available below.

Do not put every AUR field above the fold.

---

# 15. Installation UX

AUR installation is different from installing a normal binary package.

The UI should acknowledge the build process.

Example:

```text
Installing Visual Studio Code

✓ Resolving dependencies
✓ Retrieving package sources
● Building package
○ Installing package
○ Cleaning up

[ Show details ]
```

The detailed terminal/build output can be hidden behind:

**Show details**

This gives beginners a simple experience while allowing advanced users to inspect the process.

---

# 16. Installed Page

Installed should be useful, not just a list.

Suggested structure:

```text
Installed

20 applications

[ Search installed packages... ]

Updates available · 2

Visual Studio Code
1.133
[ Open ]

Spotify
1.2.96
[ Open ]

Firefox
142
[ Open ]
```

The UI should prioritize:
- Installed packages
- Version
- Update availability
- Primary action

---

# 17. Updates Page

The Updates page should make updating obvious.

Example:

```text
Updates

2 updates available

Zen Browser
1.21.13 → 1.21.14
[ Update ]

Spotify
1.2.95 → 1.2.96
[ Update ]

[ Update all ]
```

Avoid turning this into a system monitoring dashboard.

---

# 18. Categories

Categories should remain lightweight.

Examples:

- Development
- Browsers
- Media & Audio
- Gaming
- System Tools

Icons can be used, but don't turn every category into a giant colorful tile.

The goal is navigation, not decoration.

---

# 19. Typography

Typography should create hierarchy without requiring lots of cards.

Suggested hierarchy:

```text
Page title       28–32px / semibold
Section title    18–20px / semibold
App name         15–17px / semibold
Package name     12–13px / muted
Description      13–14px / secondary
Metadata         12–13px / muted
```

Avoid excessive font weights.

Use:
- Semibold for important titles
- Regular for descriptions
- Muted text for metadata

---

# 20. Rounded Corners

Avoid the common AI-generated "everything is a pill" aesthetic.

Recommended starting points:

```text
Window / major surface: 14–18px
Large cards:             12–14px
Buttons:                 8–10px
Search:                  10–12px
Small tags:              pill
```

Use rounded corners consistently, but don't exaggerate them.

---

# 21. Motion

Motion should communicate interaction and state.

Recommended principles:

- Fast hover transitions
- Subtle elevation changes
- Small opacity/translation transitions
- Smooth search result appearance
- Clear installation progress
- Respect `prefers-reduced-motion`

Avoid:
- Large page animations
- Excessive parallax
- Long transitions
- Decorative animations everywhere

Suggested durations:

```text
Hover:          150–200ms
Small UI:       150–200ms
Page transitions: 200–250ms
```

---

# 22. Package Presence / Ambient Branding

A subtle enhancement can make Aura distinctive.

When viewing a package, the package icon can influence a very subtle ambient glow.

Example:

```text
Spotify
→ subtle green ambient glow

Firefox
→ subtle orange ambient glow

VS Code
→ subtle blue ambient glow
```

This should be extremely subtle.

It must never reduce readability or make the application look like a gaming RGB interface.

---

# 23. Keyboard-first UX

Aura should feel particularly good for Linux power users.

Important shortcuts:

```text
Ctrl/Cmd + K    Open search
Esc             Close search/modal
↑ / ↓           Navigate results
Enter           Open selected result
```

Additional shortcuts can be introduced later.

Keyboard focus must always be visible.

---

# 24. Accessibility

Do not sacrifice accessibility for visual style.

Ensure:
- Strong text contrast
- Visible focus states
- Keyboard navigation
- Reduced motion support
- Proper button labels
- Tooltips for icon-only controls
- Avoid color-only status indicators

Glass effects must never reduce readability.

---

# 25. What NOT to do

Avoid these patterns:

- Generic SaaS dashboard
- Giant hero cards
- Excessive purple gradients
- Excessive glass
- Glass on every card
- Excessive borders
- Every element inside a rounded rectangle
- Excessive pills
- Huge empty areas
- Duplicate package sections
- Too much metadata on the homepage
- Giant icons with tiny text
- Decorative animation without purpose
- Overly colorful category cards
- Copying the macOS App Store pixel-for-pixel

---

# 26. Design Inspiration

Aura should take inspiration from multiple products without copying any one of them.

### macOS App Store
Take:
- Simplicity
- Editorial discovery
- Clear application presentation
- Strong visual hierarchy

Do not copy:
- Exact layout
- Exact navigation
- Exact visual styling

### Steam
Take:
- Discovery
- Package/application presentation
- Content rails
- Strong installed/update states

### Raycast
Take:
- Search
- Keyboard-first interaction
- Command palette behavior
- Speed

### GNOME/KDE
Take:
- Native desktop feeling
- System integration
- Accessibility
- Restraint

### Modern Linux app stores
Use them as references for:
- Package discovery
- Software metadata
- Installation/update flows

Aura should combine these principles into its own identity.

---

# 27. Implementation Priority

Do not redesign everything simultaneously.

Implement in this order:

## Phase 1 — Visual foundation

- [ ] Design tokens
- [ ] Typography
- [ ] Dark theme
- [ ] Light theme
- [ ] System theme detection
- [ ] Background/ambient lighting
- [ ] Sidebar
- [ ] Top navigation
- [ ] Glass surfaces

## Phase 2 — Explore

- [ ] Redesign homepage
- [ ] Remove oversized featured banner
- [ ] Make search the primary hero
- [ ] Package rails
- [ ] Recently updated
- [ ] Popular packages
- [ ] Remove duplicate content

## Phase 3 — Package experience

- [ ] Package card redesign
- [ ] Package detail page
- [ ] Installation states
- [ ] AUR metadata hierarchy
- [ ] Installation progress UI

## Phase 4 — Search

- [ ] Command/search palette
- [ ] Keyboard navigation
- [ ] Recent searches
- [ ] Search result hierarchy
- [ ] Fast transitions

## Phase 5 — Library

- [ ] Installed page
- [ ] Updates page
- [ ] Update all
- [ ] Installed search

## Phase 6 — Polish

- [ ] Hover states
- [ ] Focus states
- [ ] Motion
- [ ] Loading states
- [ ] Empty states
- [ ] Error states
- [ ] Accessibility
- [ ] Reduced motion
- [ ] Final responsive behavior

---

# 28. Agent Instructions

When modifying the existing Aura Store UI:

### Preserve

- Existing functionality
- Existing AUR backend integration
- Existing installation logic
- Existing package data
- Existing working routes
- Existing business logic

### Change

- Visual hierarchy
- Layout
- Typography
- Spacing
- Component styling
- Navigation presentation
- Search experience
- Package presentation
- Theme system
- Animation/micro-interactions

### Important

Do not rewrite working backend functionality merely to implement the visual redesign.

Do not introduce unnecessary dependencies unless they solve a real UI problem.

Before creating new components, inspect the existing component structure and reuse existing primitives where appropriate.

Do not add features simply because they would fill empty space.

Every UI element should support one of these goals:

**Discover → Search → Inspect → Install → Update**

---

# 29. Final Design Target

The finished Aura Store should feel:

**Modern**
without looking like an AI-generated SaaS dashboard.

**Simple**
without hiding useful AUR information.

**Beautiful**
without relying on excessive gradients, glass, or animation.

**Native**
without copying macOS, GNOME, or KDE.

**Powerful**
without overwhelming beginners.

**Distinctive**
through Aura's purple identity, subtle ambient lighting, excellent search, and polished AUR installation experience.

The final mental model should be:

> **"This feels like the app store Arch Linux should have."**

Not:

> "This is a website that happens to browse the AUR."
