# Aura Store — v3.3.1 Application Identity & Intent Ranking

## Purpose

The v3.3 search engine successfully provides:

- 500ms debounce
- Stale-request protection
- Candidate caching
- Deterministic relevance ranking
- Query-aware variant handling
- Installed-state context
- Command palette search
- Stable search-result presentation

However, real-world search testing exposed a limitation:

> **The ranking engine is matching package text correctly, but it does not always understand what application the user means.**

Examples:

```text
chrome
```

currently risks returning:

```text
chrome-devtools-...
chrome-manifest-...
chrome-remote-desktop
```

before the actual:

```text
google-chrome
```

Similarly:

```text
vscode
```

can return:

```text
vscode-langservers-extracted
vscode-node-debug...
```

before:

```text
visual-studio-code-bin
```

This is not primarily a scoring-weight problem.

It is an **application identity problem**.

---

# 1. Core Goal

Upgrade search from:

```text
Query
  ↓
Text relevance
  ↓
Rank packages
```

to:

```text
User query
  ↓
Query normalization
  ↓
Application identity / intent resolution
  ↓
Package family classification
  ↓
Deterministic relevance ranking
  ↓
AUR results
```

The goal is:

> **When a user searches for an application, Aura should recognize the application they most likely mean and place the canonical package first.**

Do not turn this into an AI search engine.

Do not add embeddings or an LLM to the critical search path.

The first implementation should remain:

- Deterministic
- Fast
- Explainable
- Testable
- Predictable

---

# 2. Important Product Principle

### Specific query → strong identity resolution

Examples:

```text
visual studio code
vscode
vs code

→ Visual Studio Code
```

```text
google chrome
chrome browser
chrome

→ Google Chrome
```

```text
firefox
firefox browser

→ Firefox
```

### Ambiguous query → broader results

Example:

```text
code
```

should not automatically assume:

> Visual Studio Code

because "code" can refer to:

- Code editors
- Development tools
- Source-code utilities
- Programming libraries
- CLI tools
- VS Code-related packages

The rule is:

> **Only apply strong canonical identity when the query contains enough evidence to identify an application.**

---

# 3. Preserve the Existing Search Architecture

Do not replace v3.3.

Keep:

```text
500ms debounce
AbortController
monotonic request ID
candidate cache
lexicographical ranking
installed context
command palette
```

Add an identity/intent layer between candidate retrieval and ranking.

New flow:

```text
User input
    ↓
500ms debounce
    ↓
Normalize query
    ↓
Cache candidate packages
    ↓
AUR candidate retrieval
    ↓
Application identity resolution
    ↓
Package-family classification
    ↓
Deterministic ranking
    ↓
Render
```

Search remains read-only.

Do not modify the operation engine.

---

# 4. Query Representation

Do not reduce the query to only one normalized string.

Maintain:

```js
{
  rawQuery,
  normalizedQuery,
  tokens,
  identityTerms,
  variantTerms,
  contextTerms
}
```

Example:

```text
rawQuery:
"Firefox Nightly"

normalizedQuery:
"firefox nightly"

tokens:
["firefox", "nightly"]

identityTerms:
["firefox"]

variantTerms:
["nightly"]

contextTerms:
[]
```

This allows the ranking system to distinguish:

```text
firefox
```

from:

```text
firefox nightly
```

without losing the original query.

---

# 5. Query Normalization

Continue to normalize:

```text
lowercase
trim whitespace
collapse whitespace
hyphen → space
underscore → space
```

Preserve the raw query separately.

Examples:

```text
Visual Studio Code
visual-studio-code
visual_studio_code
```

should normalize consistently for comparison.

Do not alter package names shown to the user.

---

# 6. Generic Context Terms

Some words describe the type of application rather than its identity.

Examples:

```text
browser
app
application
client
desktop
launcher
editor
player
terminal
manager
```

These can be detected as contextual terms.

Example:

```text
chrome browser
```

should become conceptually:

```text
identity:
chrome

context:
browser
```

Do not simply delete context words.

Use them as supporting evidence.

Example:

```text
chrome + browser
```

should strongly support:

```text
Google Chrome
```

over:

```text
chrome-devtools-...
```

---

# 7. Explicit Alias Layer

Introduce a small explicit alias registry for common applications.

Example:

```js
{
  "vscode": "visual-studio-code",
  "vs code": "visual-studio-code",
  "visual studio code": "visual-studio-code",

  "chrome": "google-chrome",
  "google chrome": "google-chrome",
  "chrome browser": "google-chrome",

  "firefox browser": "firefox",

  "discord client": "discord"
}
```

This registry should initially contain only high-value/common applications.

Do not build a massive manual database.

The purpose is to solve common, unambiguous user phrasing.

---

# 8. Identity Registry Data Model

Use a representation similar to:

```js
{
  id: "google-chrome",
  canonicalName: "Google Chrome",

  aliases: [
    "chrome",
    "google chrome",
    "chrome browser"
  ],

  canonicalPackages: [
    "google-chrome"
  ],

  variants: [
    "google-chrome-beta",
    "google-chrome-dev"
  ],

  relatedTerms: [
    "chromium",
    "chromedriver",
    "chrome extensions"
  ]
}
```

Another example:

```js
{
  id: "visual-studio-code",
  canonicalName: "Visual Studio Code",

  aliases: [
    "vscode",
    "vs code",
    "visual studio code"
  ],

  canonicalPackages: [
    "visual-studio-code-bin"
  ],

  variants: [
    "visual-studio-code-insiders-bin",
    "visual-studio-code-electron-bin"
  ],

  relatedTerms: [
    "vscode extension",
    "vscode language server"
  ]
}
```

The identity registry is not the complete AUR database.

It is a lightweight intent-resolution layer.

---

# 9. Do Not Hardcode Every Package

The system must not become:

```js
packageName → applicationName
```

for thousands of packages.

Use a hierarchy:

```text
Explicit common alias
        ↓
Reliable application metadata
        ↓
XDG desktop-entry information where available
        ↓
AUR metadata
        ↓
Raw package name
```

Only use an explicit alias when confidence is high.

---

# 10. Desktop Entry Integration

Aura already supports XDG desktop entry inspection.

Use that information as an identity signal when available.

Conceptually:

```text
Package
  ↓
Desktop entry
  ↓
Name=Google Chrome
Exec=google-chrome
  ↓
Application identity
```

A desktop entry's human-readable `Name` should be treated as a much stronger identity signal than a random description match.

Do not require a package to have a desktop entry to be searchable.

Desktop metadata is a strong signal, not the sole source of truth.

---

# 11. Package Families

Search should distinguish between:

### Canonical package

The main package representing the application.

### Official variant

Examples:

```text
-beta
-dev
-nightly
-insiders
-esr
```

### Related package

Examples:

```text
extension
plugin
language-server
driver
theme
```

### Unrelated package with textual overlap

Example:

```text
chrome-manifest-v2-policy
```

when the user means Google Chrome.

This classification is important.

---

# 12. Example — Chrome

For query:

```text
chrome
```

the intended order should resemble:

```text
Google Chrome
google-chrome

Google Chrome Beta
google-chrome-beta

Google Chrome Dev
google-chrome-dev

Chromium
chromium

Chrome Driver
chromedriver

Chrome extensions/tools
...
```

Packages such as:

```text
chrome-devtools-axi
chrome-manifest-v2-policy
chromecast-wallpapers
```

should not outrank the canonical browser package merely because their names contain `chrome`.

---

# 13. Example — Google Chrome

For:

```text
google chrome
```

the expected top result is:

```text
Google Chrome
google-chrome
```

This should be an extremely high-confidence identity match.

Description-only matches must not appear above it.

---

# 14. Example — Chrome Browser

For:

```text
chrome browser
```

the identity resolver should detect:

```text
identity = chrome
context = browser
```

and strongly favor:

```text
google-chrome
```

The contextual term reinforces the application identity.

---

# 15. Example — VS Code

For:

```text
vscode
```

and:

```text
vs code
```

the top result should be:

```text
Visual Studio Code
visual-studio-code-bin
```

Packages such as:

```text
vscode-langservers-extracted
vscode-node-debug
vscode-bookmark
```

must not outrank the canonical application.

Those should be treated as related tools/extensions.

---

# 16. Example — Visual Studio Code

For:

```text
visual studio code
```

the expected ranking is approximately:

```text
Visual Studio Code
visual-studio-code-bin

Visual Studio Code CLI / Server variant

Visual Studio Code Electron variant

Visual Studio Code Insiders
```

The canonical application should remain first.

---

# 17. Example — Firefox

For:

```text
firefox
```

the canonical Firefox package should rank above:

```text
firefox-extensions
firefox-themes
firefox-autoconfig
firefox-debugadapter
firefox-language-packs
```

Official variants should follow.

Related packages should follow after the canonical family.

---

# 18. Example — Discord

For:

```text
discord
```

prefer the strongest canonical Discord package available.

Then rank:

```text
discord-canary
discord-development
discord-...
```

followed by:

```text
discord plugins
discord tools
discord SDK packages
```

Do not assume every `discord-*` package is the Discord application itself.

---

# 19. Ambiguous Query Handling

Do not force identity resolution when confidence is low.

For:

```text
code
```

Aura can provide:

```text
Best Matches

codecs64
codelite
code-features
...
```

or, if strong application signals exist:

```text
Visual Studio Code
```

may appear among the strong results, but it should not automatically dominate simply because it is popular.

This is intentional.

The search engine should know when **not** to pretend it knows what the user meant.

---

# 20. Variant Query Handling

Preserve the existing v3.3 variant logic.

Examples:

```text
firefox nightly
```

should favor:

```text
firefox-nightly
```

```text
firefox beta
```

should favor:

```text
firefox-beta
```

```text
paru git
```

should favor:

```text
paru-git
```

Variant tokens must override generic variant penalties.

---

# 21. Ranking Pipeline

The ranking system should now operate in stages:

```text
1. Query identity detection
        ↓
2. Candidate identity classification
        ↓
3. Primary relevance
        ↓
4. Package-family relevance
        ↓
5. Installed-context boost
        ↓
6. Popularity tie-break
        ↓
7. Votes tie-break
```

The most important principle remains:

> **Popularity and votes must never override a clear identity match.**

---

# 22. Suggested Primary Ranking Signals

Keep the existing v3.3 scoring model, but add identity signals above it.

Example:

| Signal | Suggested Priority |
|---|---:|
| Exact canonical application identity | Highest |
| Exact canonical package | Very high |
| Explicit alias → canonical package | Very high |
| Desktop-entry application identity | Very high |
| Canonical package family match | High |
| Official variant match | High |
| Exact package name | High |
| Name prefix | Medium |
| Name token match | Medium |
| Description match | Low |
| Installed context | Tie-break |
| Popularity | Tie-break |
| Votes | Tie-break |

The exact implementation can continue using a numeric primary score, but canonical identity should have enough precedence that weak signals cannot override it.

---

# 23. Match Reasons

Continue returning:

```js
{
  package,
  score,
  matchReason
}
```

Expand the possible reasons:

```text
exact_canonical_identity
explicit_alias
desktop_entry_identity
canonical_package
official_variant
related_package
exact_package_name
prefix_match
token_match
description_match
```

This is important for:

- Unit tests
- Debugging
- Future search tuning
- Development diagnostics

Do not expose technical match reasons to normal users unless useful later.

---

# 24. Search UI Does Not Need to Change Much

Do not redesign the current search UI.

The current:

```text
Best Matches
Other Results
```

structure is good.

The UI should benefit from better ranking without needing additional visual complexity.

Keep:

- Unified AppCard structure
- Subtle accent border on the top result
- `Best match` label only in the command palette
- `★` strictly for AUR votes

---

# 25. Search Cache

Keep the v3.3 improvement:

> **Cache AUR candidates, not context-dependent ranked results.**

Pipeline:

```text
Cache candidate packages
       ↓
Apply current installed context
       ↓
Resolve identity
       ↓
Rank
```

This ensures that an application becoming installed does not leave stale ranking context.

Keep the existing:

```text
TTL: 3 minutes
Max entries: 100
LRU eviction
```

unless testing reveals a better configuration.

---

# 26. Suggested New Modules

Potential additions:

```text
src/services/search/
├── normalizeQuery.js
├── rankPackages.js
├── searchCache.js
├── applicationIdentity.js
├── applicationAliases.js
└── classifyPackage.js
```

Possible responsibilities:

### `applicationIdentity.js`

Resolve query → likely application identity.

### `applicationAliases.js`

Small explicit high-confidence alias registry.

### `classifyPackage.js`

Classify candidate as:

```text
canonical
variant
related
unrelated
```

Follow the existing architecture if equivalent abstractions already exist.

Do not reorganize the project unnecessarily.

---

# 27. Test Suite

Add a dedicated real-world identity test suite.

Suggested:

```text
tests/search.identity.test.js
```

At minimum:

## Chrome

```text
[ ] "chrome" → google-chrome first
[ ] "google chrome" → google-chrome first
[ ] "chrome browser" → google-chrome first
[ ] chrome-devtools-* cannot outrank google-chrome
[ ] chrome-manifest-* cannot outrank google-chrome
```

## VS Code

```text
[ ] "vscode" → visual-studio-code-bin first
[ ] "vs code" → visual-studio-code-bin first
[ ] "visual studio code" → visual-studio-code-bin first
[ ] vscode-language-server packages cannot outrank canonical package
```

## Firefox

```text
[ ] "firefox" → canonical Firefox package first
[ ] "firefox browser" → canonical Firefox package first
[ ] "firefox nightly" → firefox-nightly favored
[ ] Firefox extensions cannot outrank the canonical package
```

## Discord

```text
[ ] "discord" → primary Discord package first
[ ] Discord variants follow
[ ] Discord tools/extensions do not outrank the main package
```

## Ambiguous

```text
[ ] "code" does not blindly force Visual Studio Code
[ ] "browser" remains broad
[ ] "music player" remains broad
```

---

# 28. Regression Protection

All existing v3.3 tests must continue passing.

Required:

```text
Search unit suite
+
Identity suite
+
Adversarial runtime suite
+
Production build
```

Do not merge if the identity improvement breaks:

- Operation Engine
- SSE
- Installation
- Cancellation
- Verification
- Activity
- Package detail

---

# 29. Manual Verification Matrix

Test these exact searches in the running UI:

```text
chrome
google chrome
chrome browser

vscode
vs code
visual studio code

firefox
firefox browser
firefox nightly

discord

spotify
paru
yay

code
browser
music player
video editor
terminal
```

For each query record:

```text
Query
Top package
Top display name
Match reason
Expected?
```

Example:

```text
Query: vscode
Top: visual-studio-code-bin
Reason: explicit_alias
Expected: YES
```

This should become a permanent regression checklist.

---

# 30. Do Not Add AI / Embeddings Yet

Do not implement:

- LLM query interpretation
- Vector search
- Embedding-based package ranking
- Remote AI calls
- Semantic search in the critical path

The current failures are primarily explainable by missing identity/alias/family handling.

Fix the deterministic model first.

Only consider semantic search later if real-world tests show deterministic identity and ranking are insufficient.

---

# 31. Do Not Overfit to the Initial Examples

The explicit examples:

```text
chrome
vscode
firefox
discord
```

should be tests, not the entire system.

The implementation should generalize.

Do not create special-case code such as:

```js
if (query === "chrome") ...
if (query === "vscode") ...
```

Instead use:

```text
alias registry
identity resolver
desktop metadata
package-family classification
```

The examples validate the architecture.

---

# 32. Performance Requirements

Identity resolution must remain fast.

Target:

```text
500ms debounce
+
AUR/candidate retrieval
+
identity resolution
+
ranking
```

The additional identity stage should not noticeably slow search.

Keep explicit aliases and deterministic rules cheap.

Do not introduce a database, embeddings service, or large inference process for v3.3.1.

---

# 33. Acceptance Criteria

v3.3.1 is successful when:

1. `chrome` returns the canonical Google Chrome package first.
2. `google chrome` returns the canonical Google Chrome package first.
3. `chrome browser` returns the canonical Google Chrome package first.
4. `vscode` returns Visual Studio Code first.
5. `vs code` returns Visual Studio Code first.
6. `visual studio code` returns Visual Studio Code first.
7. `firefox` returns the canonical Firefox package before Firefox extensions/tools.
8. Explicit variant queries continue to favor the requested variant.
9. `discord` returns the strongest canonical Discord package first.
10. `code` remains broad rather than blindly becoming Visual Studio Code.
11. Description-only packages cannot beat clear canonical application identity.
12. Popularity and votes never override strong identity matches.
13. Existing v3.3 ranking tests remain green.
14. Existing 61+ adversarial runtime tests remain green.
15. `npm run build` remains clean.
16. Search remains entirely read-only.
17. The operation engine remains untouched.

---

# 34. Final Target

The final search architecture should be:

```text
                  USER QUERY
                      ↓
               500ms debounce
                      ↓
               Query normalization
                      ↓
             Identity / intent resolver
                      ↓
               AUR candidate cache
                      ↓
            Candidate classification
                      ↓
            Deterministic ranking
                      ↓
        ┌─────────────┴─────────────┐
        ↓                           ↓
 Command Palette              Full Results
        ↓                           ↓
Package Detail                Package Detail
        ↓
OperationEngine
```

The user experience should be:

> **"I typed the name or shorthand I naturally use, and Aura understood which application I meant."**

The system should remain:

> **Deterministic, fast, explainable, and maintainable.**

Do not replace the successful v3.3 search architecture.

**Add application identity and package-family intelligence on top of it.**
