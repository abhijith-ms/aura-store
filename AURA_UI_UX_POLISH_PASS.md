# Aura Store — UI/UX Polish Pass

## Purpose

The major UI refactor is now in a good direction.

The current Aura Store interface has successfully moved away from the original SaaS/dashboard aesthetic toward a clean, lightweight desktop application.

**Do not redesign the application again.**

This phase is a **polish and identity pass**, not another structural redesign.

The goal is to make the current interface feel:

- Modern
- Native to Linux
- Distinctive
- Calm
- Lightweight
- Polished
- Simple
- More recognizably "Aura"

The current light-mode category and Updates screens should be treated as the visual foundation.

---

# 1. Current Design Assessment

The current UI already does several things well:

- Clean sidebar hierarchy
- Clear navigation
- Good package-card structure
- Human-readable package names above AUR package names
- Restrained purple accent
- Simple update workflow
- Minimal borders
- Good whitespace
- Light theme is readable
- UI no longer feels like a generic SaaS dashboard

Do not throw this away.

The remaining problem is primarily:

> **The UI is clean, but slightly generic and flat.**

Aura needs more personality and depth without becoming visually noisy.

---

# 2. Core Rule for This Phase

## Polish, don't redesign.

Do NOT:

- Replace the navigation architecture
- Replace the current card system
- Add unnecessary homepage sections
- Add excessive glassmorphism
- Add large gradients
- Add decorative animations
- Add unnecessary dashboard widgets
- Increase the number of visible metadata fields
- Make every element rounded
- Add features simply to fill empty space

Do:

- Improve visual depth
- Improve spacing
- Improve typography
- Improve search prominence
- Improve icon consistency
- Add subtle Aura branding
- Improve theme quality
- Improve hover/focus states
- Improve responsive grid behavior
- Improve empty/loading/error states

---

# 3. Light Theme Refinement

The current light theme is clean but slightly too flat.

Use three subtle visual layers:

```text
Background
#F5F5F7

Surface
#FFFFFF

Elevated / Hover
#FAFAFC
```

The exact values may be adjusted, but maintain clear visual separation.

## Background

Add a very subtle violet ambient wash near the upper content area.

The effect should be:

- Very low opacity
- Large and soft
- Barely noticeable
- Non-distracting

It should create atmosphere rather than look like a visible gradient.

Avoid:

```text
Large purple gradient
Neon glow
Strong radial gradient
Multiple colorful gradients
```

---

# 4. Dark Theme Refinement

Dark mode should retain the same visual language.

Recommended hierarchy:

```text
Background
#09090B

Surface
#121214

Surface Hover
#18181B

Border
#252529
```

Use subtle violet ambient lighting in the background.

The dark theme should feel:

- Deep
- Calm
- Slightly atmospheric
- High contrast
- Premium

Do not use pure black everywhere.

Do not make every surface purple.

---

# 5. Aura Purple Identity

The current purple usage is appropriately restrained.

Keep purple in these primary locations:

1. Aura logo
2. Active navigation
3. Primary action buttons
4. Focus states
5. Subtle ambient background lighting

Purple should communicate interaction and identity.

Do not use purple for:

- Every heading
- Every icon
- Every card
- Every metadata field
- Decorative borders

The goal is:

> **Purple should feel special because it is used selectively.**

---

# 6. Glassmorphism

The current level of glass should NOT be increased significantly.

Use glass only where it has a functional visual purpose.

Good candidates:

- Sidebar
- Top navigation
- Search/command palette
- Modals
- Floating overlays

Package cards should remain mostly solid/subtle surfaces.

Avoid stacking:

```text
glass card
    ↓
glass card
    ↓
glass card
```

Avoid excessive:

```css
backdrop-filter: blur(40px)
```

Glass should create depth, not become the visual identity of the entire application.

---

# 7. Sidebar

The current sidebar structure is good.

Keep:

```text
AURA STORE

DISCOVER
  Explore
  Installed
  Updates

CATEGORIES
  Development
  Browsers
  Media & Audio
  Gaming
  System Tools
```

Do not add unnecessary navigation items.

## Theme control

The current bottom "Light Mode" control should be refined into an appearance setting.

Prefer:

```text
Appearance    System
```

or:

```text
☼ Appearance    System
```

Clicking it should expose:

```text
Appearance

○ System
○ Light
○ Dark
```

The default should be **System**.

Persist the selection.

---

# 8. Header Search

The current search field is functional but too small to communicate its importance.

Increase its width on large screens.

Target approximately:

```text
450–550px
```

depending on available space.

Example:

```text
┌────────────────────────────────────────────────────┐
│  ⌕  Search AUR packages, apps, developers... Ctrl K│
└────────────────────────────────────────────────────┘
```

Use:

**Ctrl+K**

as the primary Linux shortcut.

Do not display `⌘K` as the primary shortcut.

The search should remain visually lightweight, not become a giant toolbar element.

---

# 9. Contextual Header Controls

Do not show every control on every page.

For example:

### Search results

Show:

```text
Sort: Relevance
Refresh
```

### Category

Sort may be useful.

### Updates

Do not show an unnecessary "Relevance" selector.

### Installed

Only show controls that are useful for installed packages.

The header should adapt to the current view.

---

# 10. Package Grid

The current cards are good, but five cards per row can make them unnecessarily narrow on large screens.

Prefer responsive CSS rather than a hardcoded column count.

Example:

```css
grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
```

The exact minimum width should be tuned to the actual application.

Goals:

- Cards should have enough width for descriptions
- Text should not wrap excessively
- Buttons should remain comfortable
- Cards should breathe
- Grid should adapt naturally to window size

Do not artificially force four or five columns.

Let the available width determine the layout.

---

# 11. Package Card Hierarchy

Keep the current hierarchy:

```text
[Icon]

Human-readable application name
AUR package name

Short description

★ Votes     Popularity

[ Install / Installed / Update ]
```

Example:

```text
Zen Browser
zen-browser-bin

Official package for Zen, a privacy-focused,
feature packed Firefox-based web browser

★ 338     24.7

                         ✓ Installed
```

The human-readable name is primary.

The AUR package name is secondary.

Metadata should remain visually muted.

---

# 12. Package Icon Consistency

Package icons should follow this priority:

```text
Official application icon
        ↓
Known brand icon
        ↓
Category icon
        ↓
Aura generic package icon
```

Do not fabricate application branding.

If an official icon is unavailable, use a deliberately designed generic fallback.

The fallback should look intentional rather than like a missing image.

Generic fallback icons should maintain the same visual language as real package icons.

---

# 13. Category Header

The current category header is good but can have slightly stronger visual hierarchy.

Current concept:

```text
🌐 Web Browsers

Privacy-focused, lightweight, and modern
browsing engines for Arch Linux
```

Keep the layout simple.

Give the category icon slightly more presence.

A subtle category-colored ambient glow can be used, but keep it extremely restrained.

Do not turn category headers into hero banners.

---

# 14. Empty Space

Large empty areas are not automatically a problem.

Do NOT fill empty space with unnecessary widgets.

For a category containing six packages, it is acceptable to have empty space.

The goal is:

> Intentional whitespace, not artificial content density.

If an empty state is needed, use a meaningful contextual message.

Example:

```text
Can't find what you're looking for?

Search the AUR for more packages.

[ Search AUR ]
```

Only use this when it actually helps the user.

---

# 15. Updates Page

The current Updates page is already strong.

Preserve its simple structure:

```text
Available Updates
2 updates available

                 [ Deselect All ] [ Update Selected (2) ]

☑  litellm
   1.96.2-1 → 1.97.0-1                     [Update]

☑  packettracer
   9.0.0-1 → 9.0.1-1                       [Update]
```

Keep it as a quiet utility page.

Do not convert updates into large decorative cards.

## Version hierarchy

Old version:

- Muted
- Secondary

New version:

- Green
- Semibold

Example:

```text
1.96.2-1 → 1.97.0-1
```

---

# 16. Update Selection

The Update page should support:

- Select all
- Deselect all
- Individual selection
- Update selected

"Update All" can be implemented as selecting all packages and running the existing update workflow.

Do not redesign the underlying package-management process.

---

# 17. Explore Page

The Explore page remains the most important page for Aura's identity.

It should communicate:

> This is the beautiful way to discover AUR software.

Recommended hierarchy:

```text
Discover

Software for your Arch system

┌───────────────────────────────────────────────────────┐
│  ⌕ Search AUR packages, apps, developers...      Ctrl K│
└───────────────────────────────────────────────────────┘


Popular on AUR                              View all →

[ Package ] [ Package ] [ Package ] [ Package ]


Recently Updated                           View all →

[ Package ] [ Package ] [ Package ] [ Package ]
```

Do not bring back the oversized Featured banner.

Search should be the hero.

---

# 18. Search Experience

Aura's search should become one of its signature interactions.

Keyboard shortcut:

```text
Ctrl+K
```

Command palette behavior:

```text
Search
  ↓
Recent packages
  ↓
Search results
  ↓
Arrow navigation
  ↓
Enter to open
  ↓
Esc to close
```

The search interface should feel fast and lightweight.

Support:

- Arrow key navigation
- Enter
- Escape
- Visible keyboard focus
- Recent searches
- Local persistence where appropriate

Do not make the command palette visually excessive.

---

# 19. Package Detail

The package detail experience should follow progressive disclosure.

Above the fold:

```text
[Icon]

Visual Studio Code
visual-studio-code-bin

Code editor for modern development

★ Votes
Popularity

[ Install ]
```

Below:

```text
About
Package Information
Dependencies
Build Information
AUR Information
```

Advanced information should not overwhelm the initial view.

---

# 20. Ambient Package Branding

This is an optional signature detail.

When opening a package, a subtle glow may use the package's known brand color.

Examples:

```text
Spotify → subtle green
Firefox → subtle orange
VS Code → subtle blue
```

If no known brand color exists:

```text
Use Aura purple
```

The glow must remain subtle.

It must never reduce text readability.

It must never become an RGB/gaming aesthetic.

---

# 21. Package Detail Navigation

Do not force the complete package experience into a large modal.

Preferred architecture:

```text
Package card
    ↓
Quick preview/detail
    ↓
View full details
    ↓
Dedicated package detail view
```

A modal can be used for quick inspection.

A dedicated detail page/view should be used for deep technical information such as:

- Dependencies
- PKGBUILD
- Build information
- AUR metadata
- Logs
- Installation state

---

# 22. Installation UX

AUR installation should feel different from downloading a normal application binary.

The flow should communicate the build process:

```text
Install
   ↓
Review
   ↓
Resolve dependencies
   ↓
Retrieve sources
   ↓
Build
   ↓
Install
   ↓
Done
```

Example:

```text
Installing Visual Studio Code

✓ Resolving dependencies
✓ Retrieving sources
● Building package
○ Installing package
○ Done

[ Show details ]
```

Raw terminal/build output should be available behind:

**Show details**

Do not hide useful failure information.

---

# 23. AUR Installation Confirmation

Because AUR packages are user-produced, Aura should not make the process look exactly like installing a trusted binary from an official application store.

Before installation, provide lightweight context:

```text
visual-studio-code-bin
Version 1.133.0-1

Source: AUR

Dependencies
...

This package will be built locally.

[ Cancel ]        [ Install ]
```

Do not create a frightening warning wall for every package.

The goal is informed simplicity.

---

# 24. Loading States

Every important page needs intentional loading states.

Use lightweight skeletons.

Example:

```text
Popular on AUR

[ skeleton ] [ skeleton ] [ skeleton ] [ skeleton ]
```

Avoid full-screen spinners when partial content can render.

---

# 25. Empty States

Examples:

### No installed packages

```text
No installed packages

Packages you install will appear here.
```

### No search results

```text
No packages found

Try a different search term.
```

### No updates

```text
You're up to date

No package updates are currently available.
```

Keep empty states short.

---

# 26. Error States

Important errors should be understandable.

Example:

```text
Couldn't reach the AUR

Check your connection and try again.

[ Retry ]
```

Installation failure:

```text
Installation failed

The package could not be built.

[ Show logs ]
[ Retry ]
```

Do not expose raw stack traces as the primary error UI.

Allow advanced users to inspect technical details.

---

# 27. Hover and Interaction Polish

Use subtle interaction feedback.

Package cards:

```text
Normal
    ↓
Slight surface increase
Slight elevation
Small icon scale
```

Buttons:

```text
Normal
    ↓
Slight brightness change
```

Navigation:

```text
Normal
    ↓
Subtle surface highlight
```

Avoid exaggerated scaling.

No element should jump or shift significantly when hovered.

---

# 28. Motion

Use motion only to communicate state.

Recommended durations:

```text
Hover:             150–200ms
Small UI changes:  150–200ms
Page transitions:  200–250ms
```

Respect:

```text
prefers-reduced-motion
```

Avoid:
- Large page transitions
- Parallax
- Decorative floating elements
- Long animations
- Excessive spring effects

---

# 29. Responsive Behavior

Aura is a desktop Linux application.

Desktop is the primary target.

Recommended behavior:

### Large desktop

Full sidebar + responsive package grid.

### Medium window

Reduce grid columns naturally.

### Narrow window

Collapse/reduce sidebar where appropriate.

Do not optimize the application around phone-sized breakpoints.

Use the available window intelligently.

---

# 30. Accessibility

Preserve:

- Strong contrast
- Keyboard navigation
- Visible focus
- Tooltips for icon-only actions
- Proper button labels
- Reduced motion support
- Color-independent status communication

Glass effects must never compromise readability.

---

# 31. Do Not Modify Working Backend Logic

This is a UI/UX polish pass.

Before modifying any service:

1. Inspect the existing implementation.
2. Understand the data flow.
3. Preserve existing behavior.
4. Only change service/data code when required by a UI requirement.

Do not rewrite:

- AUR RPC integration
- SSE streaming
- PKGBUILD fetching
- pacman integration
- paru integration
- Installation process
- Existing process management

unless there is a concrete requirement.

---

# 32. Repository Audit Before Changes

Before implementing this polish pass:

```text
[ ] Inspect project structure
[ ] Inspect current routes/views
[ ] Inspect AUR API service
[ ] Inspect installation/SSE flow
[ ] Inspect package state management
[ ] Inspect current theme implementation
[ ] Inspect current search implementation
[ ] Inspect reusable UI components
[ ] Identify duplicate/dead components
[ ] Identify existing CSS tokens
```

Do not immediately rewrite components.

First understand how the current application works.

---

# 33. Design Acceptance Criteria

The polish pass is successful when:

1. The application no longer feels like a SaaS dashboard.
2. The current navigation architecture remains understandable.
3. Search is clearly one of Aura's primary interactions.
4. Package cards are readable without excessive metadata.
5. Human application names are visually prioritized.
6. AUR package names remain visible but secondary.
7. Light mode feels intentionally designed rather than simply "white mode."
8. Dark mode has depth without excessive gradients.
9. Glass effects remain subtle.
10. Purple remains recognizable as Aura's identity.
11. Package icons feel visually consistent.
12. Category pages remain clean even with small package counts.
13. Updates remain a simple utility workflow.
14. Loading, empty, and error states feel designed.
15. Installation progress clearly communicates build/install state.
16. Keyboard navigation works properly.
17. Existing backend and installation functionality remains intact.
18. The application feels like a Linux desktop application rather than a website.
19. The UI has personality without becoming visually noisy.
20. No new feature was added merely to fill empty space.

---

# 34. Final Target

The desired final feeling is:

> **Clean enough to feel native.**
>
> **Distinctive enough to feel like Aura.**
>
> **Simple enough for beginners.**
>
> **Powerful enough for Arch users.**

Aura should not try to be:

> "The Linux version of the macOS App Store."

It should feel like:

> **"The app store Arch Linux should have."**

The current UI is the foundation. This phase should refine it rather than replace it.
