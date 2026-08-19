# Aura Store — v3.3 Intelligent Search & Best-Match Discovery

## Purpose

Aura's visual system and runtime architecture are now stable.

The next milestone is to make **search one of Aura's strongest differentiators**.

The goal is not to create a generic fuzzy search engine or reproduce the raw AUR search UI.

The goal is:

> **When a user searches for an application, Aura should make the most likely intended application appear first.**

Aura should feel faster, cleaner, and more intentional than the existing AUR search experience.

---

# 1. Core Search Philosophy

## Search is retrieval, not discovery

Explore and Search have different jobs.

### Explore

Explore can prioritize:
- Popularity
- Votes
- Recent updates
- Curated packages
- Discovery

### Search

Search should prioritize:
- Exact application identity
- Exact package-name matches
- Strong name matches
- User intent
- Installed status
- Relevant variants
- Popularity/votes only as secondary signals

Do **not** make popularity the primary search ranking factor.

Example:

If the user searches:

```text
visual studio code
```

Aura should strongly prefer:

```text
visual-studio-code-bin
```

over a random package that happens to contain "code" in its description.

---

# 2. Target Search Experience

The ideal behavior is:

```text
User types query
       ↓
500ms debounce
       ↓
Normalize query
       ↓
Check short-lived cache
       ↓
Query AUR candidates
       ↓
Aura relevance ranking
       ↓
Render ranked results
```

The UI should never display raw AUR results first and then reorder them.

Results should be ranked **before rendering**.

This avoids visual jumping and makes search feel stable.

---

# 3. 500ms Debounce

Use a **500ms debounce** before triggering an API request.

Example:

```text
v
vs
vs c
vs co
vs code
       ↓
500ms pause
       ↓
one search request
```

Do not search on every keystroke.

## Minimum query length

Recommended:

```text
query.length < 2
    ↓
Do not call AUR
```

For empty or one-character queries, show:
- Recent searches
- Recent packages
- Popular suggestions if appropriate

Do not waste AUR RPC calls on single-character queries.

---

# 4. Cancel / Ignore Stale Searches

Search requests can return out of order.

Example:

```text
Request A → "fire"
Request B → "firefox"
```

If Request A returns after Request B, it must not overwrite the newer results.

Use:
- `AbortController`, where supported
- A monotonically increasing request ID
- Or both

The rule is:

> **Only the latest active search request may update the visible results.**

---

# 5. Query Normalization

Search should normalize input without destroying the original query.

Normalize for ranking:

```text
lowercase
trim whitespace
hyphen → space
underscore → space
collapse repeated whitespace
```

Examples:

```text
Visual Studio Code
visual-studio-code
visual_studio_code
```

should be treated as closely related queries.

Do not modify the package name displayed to the user.

---

# 6. Do Not Implement Fuzzy Search Yet

Do not add:
- Levenshtein distance
- aggressive typo correction
- fuzzy matching across every field
- word-by-word API requests
- embedding search
- LLM search
- semantic search

for the initial v3.3 implementation.

The objective is **high-confidence deterministic ranking** first.

The first version should be:
- Fast
- Predictable
- Explainable
- Cheap
- Easy to debug

Fuzzy or semantic search can be evaluated later with real user behavior.

---

# 7. AUR as Candidate Source

Aura should continue using the existing AUR integration.

The architecture should be:

```text
AUR RPC
   ↓
Candidate packages
   ↓
Aura ranking layer
   ↓
Search results
```

Do not replace the existing AUR backend.

Do not invent unsupported AUR RPC parameters.

Inspect the current `aurApi.js` implementation before changing it.

Use the AUR API capabilities that are actually supported.

---

# 8. Relevance Ranking

Aura's main search advantage should be its ranking layer.

A starting scoring model:

| Signal | Suggested Weight |
|---|---:|
| Exact application/display name | +120 |
| Exact package name | +100 |
| Name starts with query | +80 |
| Exact token match in package name | +60 |
| Name contains query | +45 |
| Strong description match | +25 |
| Description contains query | +10 |
| Installed | +10 |
| Popularity | +0–15 |
| Votes | +0–15 |
| Weak/description-only match | Penalty |
| `-git`, `-debug`, unusual variant | Small penalty unless query explicitly indicates it |

These are starting values.

Keep scoring rules easy to tune and test. The numbers are not assumed to be optimal.

---

# 9. Ranking Priority

The ranking hierarchy should generally be:

```text
Exact application identity
        ↓
Exact package identity
        ↓
Strong package-name match
        ↓
Prefix/token match
        ↓
Description relevance
        ↓
Installed status
        ↓
Popularity / votes
```

Popularity and votes should primarily act as **tie-breakers**, not intent overrides.

---

# 10. Application Name vs Package Name

Aura should prefer a reliable human-readable name when available.

Example:

```text
Visual Studio Code
visual-studio-code-bin
```

The application name is the primary search identity.

The AUR package name remains secondary.

## Do not fabricate application names

Do not blindly transform:

```text
foo-git
something-desktop-bin
random-package
```

into human-readable names.

Use this hierarchy:

```text
Reliable metadata / known application name
        ↓
Small explicit brand mapping where appropriate
        ↓
Raw package name
```

If no trustworthy display name exists, use the package name.

---

# 11. Package Variants

AUR commonly contains variants of the same application.

For:

```text
firefox
```

the expected ranking is approximately:

```text
firefox
firefox-beta-bin
firefox-developer-edition
firefox-nightly
firefox-esr
...
```

The canonical exact package should normally rank first.

Variants should follow.

Apply small penalties to suffixes such as:

```text
-git
-bin
-debug
-nightly
-beta
-devel
```

only when they are variants rather than the user's explicit intent.

For example:

```text
firefox nightly
```

should strongly favor:

```text
firefox-nightly
```

The search system must not blindly penalize a variant when the query explicitly asks for it.

---

# 12. Installed Package Boost

If the user searches for an installed package, give it a small relevance boost.

Example:

```text
spotify
```

and Spotify is installed:

```text
Spotify
spotify

✓ Installed
```

should rank above unrelated Spotify-related packages.

Installed status is a useful contextual signal, not the primary search signal.

Do not let an installed but weakly matching package beat an exact identity match.

---

# 13. Search Command Palette

`Ctrl+K` is the primary Linux shortcut.

The command palette should display only the strongest results initially.

Recommended:

```text
Search AUR packages...

BEST MATCHES

▣ Visual Studio Code
  visual-studio-code-bin
  Microsoft's code editor

▣ Visual Studio Code Insiders
  visual-studio-code-insiders-bin
  ...

▣ VSCodium
  vscodium-bin
  ...
```

Limit the initial command palette result count to roughly:

```text
5–8 results
```

Do not overload the palette.

Provide:

```text
View all results →
```

to open the complete search-results view.

---

# 14. Search Result Labels

Do not expose a complicated numeric relevance score.

Use simple contextual labels where helpful:

```text
Best match
Installed
Popular
```

Do not add labels to every result.

Labels should communicate something meaningful.

---

# 15. Full Search Results

The full search page can show more information than the command palette.

Recommended structure:

```text
Search results for "spotify"

Best matches

[ Package ]
[ Package ]
[ Package ]

Other results

[ Package ]
[ Package ]
[ Package ]
```

The most important result should remain visually obvious.

---

# 16. Search Cache

Add a short-lived query-result cache.

Example:

```text
query → ranked results
```

Suggested cache lifetime:

```text
1–5 minutes
```

This is purely a performance optimization.

Do not use cached search data as the source of truth for:
- Installed state
- Package installation status
- Update status
- Actual system state

Those values must continue to come from authoritative backend sources.

---

# 17. Search Cache Rules

Normalize cache keys using the normalized query.

Limit cache size to avoid unbounded memory growth.

Use oldest-first eviction or a bounded LRU.

---

# 18. Search UI States

Every state should be intentional.

## Empty

```text
Search AUR packages, apps, developers...

Recent

Visual Studio Code
Spotify
Firefox
```

## Searching

Use a subtle inline loading state.

Do not use a giant full-screen spinner.

Example:

```text
⌕  Searching AUR...
```

## Results

```text
Best matches
...
```

## No Results

```text
No packages found for "xyzabc"

Try:
- a shorter package name
- the application's name
- a related keyword
```

Keep the message short.

---

# 19. Search Error

If AUR cannot be reached:

```text
Couldn't search the AUR

Check your connection and try again.

[ Retry ]
```

Do not display raw HTTP errors as the main interface.

Technical details may be available through existing diagnostics where appropriate.

---

# 20. Search Result Stability

Do not animate results in a way that makes them move around excessively.

The sequence should be:

```text
request
  ↓
receive candidates
  ↓
rank
  ↓
render
```

Avoid rendering raw candidates and then resorting them.

Small fade/slide transitions are acceptable, but search should feel fast.

---

# 21. Search Performance

The target experience should feel approximately:

```text
Typing
   ↓
500ms debounce
   ↓
Request
   ↓
Rank
   ↓
Results
```

Do not introduce expensive processing that blocks the UI.

Keep ranking deterministic and efficient.

Do not add an LLM to the critical search path.

---

# 22. Search Security / Reliability

Search must remain read-only.

Searching must never:
- install packages
- update packages
- execute PKGBUILD
- execute arbitrary shell commands
- alter the system
- modify operation state

Search should remain separate from the system-mutating operation mutex.

---

# 23. Interaction Between Search and Operation Engine

The operation engine remains authoritative for system mutation.

Search only produces candidates.

```text
Search
  ↓
Package detail
  ↓
User explicitly chooses Install
  ↓
OperationEngine
```

Never initiate installation simply because a package is selected in search.

---

# 24. No Backend Rewrite

This feature is a search improvement, not a package-management rewrite.

Preserve:
- Existing AUR integration
- Existing operation engine
- Existing SSE architecture
- Existing cancellation logic
- Existing verification
- Existing desktop-entry detection
- Existing activity history
- Existing theme/UI system

Only modify the backend where necessary to support search candidates, ranking, caching, and search metadata.

---

# 25. Suggested Architecture

A clean implementation could look like:

```text
src/
├── services/
│   ├── aurApi.js
│   └── search/
│       ├── normalizeQuery.js
│       ├── rankPackages.js
│       └── searchCache.js
│
├── components/
│   └── search/
│       ├── SearchBar.jsx
│       ├── CommandPalette.jsx
│       ├── SearchResult.jsx
│       └── SearchEmptyState.jsx
```

Follow the existing project architecture if it already has appropriate abstractions.

Do not reorganize the entire project just for this feature.

---

# 26. Suggested Ranking API

Keep ranking logic pure and testable.

Conceptually:

```js
rankPackages(packages, query, context)
```

Where `context` can include:

```js
{
  installedPackages: Set,
  knownApplicationNames: Map
}
```

The function should return:

```js
[
  {
    package,
    score,
    matchReason
  }
]
```

`matchReason` is useful for debugging and testing.

For example:

```js
{
  package: "visual-studio-code-bin",
  score: 142,
  matchReason: "exact_application_name"
}
```

Do not expose the numeric score directly to normal users.

---

# 27. Testing Requirements

Create unit tests for the ranking algorithm.

At minimum, test:

```text
[ ] Exact package name ranks first
[ ] Exact application name ranks first
[ ] Prefix beats description-only match
[ ] Name match beats description-only match
[ ] Installed boost works
[ ] Popularity cannot override exact identity
[ ] -git variant is penalized when query is generic
[ ] Explicit -git query favors -git package
[ ] Explicit beta/nightly query favors requested variant
[ ] Hyphen/underscore normalization works
[ ] Case normalization works
[ ] Empty query returns no AUR request
[ ] One-character query returns no AUR request
[ ] Stale search response cannot overwrite newer results
```

Also test cache behavior and eviction if a cache is implemented.

---

# 28. Example Expected Behavior

## Query

```text
visual studio code
```

Expected top result:

```text
Visual Studio Code
visual-studio-code-bin
```

## Query

```text
vscode
```

Expected top result:

```text
Visual Studio Code
visual-studio-code-bin
```

## Query

```text
discord
```

Expected top results should primarily be Discord packages, not unrelated packages whose descriptions contain "discord".

## Query

```text
firefox nightly
```

Expected:

```text
firefox-nightly
```

near the top.

## Query

```text
paru
```

Expected:

```text
paru
```

immediately.

## Query

```text
music player
```

A broader set of relevant applications is acceptable.

Do not pretend there is one mathematically correct result when the query is inherently broad.

---

# 29. Future Consideration — Local Metadata Index

Do not implement this in the first v3.3 pass unless there is a clear performance need.

A future enhancement could use AUR package metadata archives to maintain a local search index:

```text
AUR metadata archive
        ↓
Local metadata index
        ↓
Instant search
        ↓
Aura relevance ranking
```

Only introduce this after proving that:

```text
RPC + 500ms debounce + cache + ranking
```

is insufficient.

Keep v3.3 simple first.

---

# 30. Future Consideration — Semantic Search

Do not add LLM/embedding search to the critical path in v3.3.

A deterministic relevance system is preferable initially because it is:
- Faster
- Predictable
- Easier to test
- Easier to debug
- Easier to explain

Semantic search can be evaluated later for broad queries such as:

```text
music player
video editor
password manager
3d modeling
```

Only introduce it if real usage demonstrates deterministic ranking is insufficient.

---

# 31. Acceptance Criteria

The v3.3 search feature is successful when:

1. Search waits approximately 500ms after typing stops before requesting results.
2. Typing does not trigger one API request per character.
3. Search results never display stale responses over newer queries.
4. Exact application/package matches strongly outrank unrelated description matches.
5. Popularity and votes do not override clear user intent.
6. Package variants are ordered sensibly.
7. Installed packages receive a modest contextual boost.
8. Search remains read-only and never conflicts with package operations.
9. The command palette shows only the strongest results.
10. Full search results remain comprehensive without losing relevance.
11. Search feels fast and stable.
12. Loading, empty, and error states are polished.
13. Ranking logic is unit-tested.
14. Existing operation-engine behavior remains untouched.
15. No fuzzy or semantic-search complexity is introduced without evidence that it is needed.

---

# 32. Final Product Goal

Aura's search should make the user feel:

> **"I typed what I was looking for, and Aura knew which package I meant."**

Not:

> "Aura searched the AUR and gave me a list."

The existing AUR search infrastructure is the candidate source.

**Aura's value is the relevance layer on top.**

The target architecture is:

```text
User intent
    ↓
500ms debounce
    ↓
Query normalization
    ↓
Short-lived cache
    ↓
AUR candidate retrieval
    ↓
Aura relevance ranking
    ↓
Stable search results
    ↓
Package detail
    ↓
Explicit user action
    ↓
OperationEngine
```

Keep the implementation deterministic and measurable first.

Do not over-engineer v3.3.
