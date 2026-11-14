# RoboIsland 2.0 — End-to-End Test Infrastructure Specification (TEST_INFRA)

## 1. Executive Summary & Testing Philosophy

This document defines the complete End-to-End (E2E) testing architecture and infrastructure for **RoboIsland 2.0**.
RoboIsland 2.0 is a production-quality Windows desktop companion featuring a dynamic island, mascot animation engine, AI chat, webhook-based AI monitoring, Spotify and SMTC media playback, Focus Guard, and Project Mode workspace integration.

### Core Testing Principles
1. **Opaque-Box (Black-Box) Verification**: Tests interact strictly through observable interfaces: public APIs, IPC channels, HTTP webhooks, configuration files, DOM/CSS structures, and observable state machines. Internal private implementations are not monkey-patched.
2. **Deterministic & Genuine Assertions**: No facade tests, dummy pass mocks, or hardcoded successes. Every test executes real logic, asserts actual return values, validates mathematical invariants, and checks system contracts.
3. **Four-Tiered Coverage Hierarchy**:
   - **Tier 1: Feature Coverage**: Comprehensive verification of primary behavior and happy paths across all 32 inventoried features (minimum 5 test cases per feature = 160 test cases).
   - **Tier 2: Boundary & Corner Cases**: Rigorous stress-testing of extreme values, empty inputs, network disconnects, corrupt JSON, rate limits, and rapid state toggles (minimum 5 test cases per feature = 160 test cases).
   - **Tier 3: Cross-Feature Combinations**: Pairwise interaction tests verifying concurrent features (e.g., AI streaming while collapsed in Rest Mode, Spotify playback during Focus Guard).
   - **Tier 4: Real-World Application Scenarios**: Multi-step workflows simulating realistic daily developer and companion use cases.
4. **Standalone Portability**: The test runner executes directly via Node.js (`node tests/e2e/runner.js`) while supporting targeted execution flags (`--tier 1`, `--tier 2`, `--tier 3`, `--tier 4`, `--all`).

---

## 2. Master 32-Feature Inventory & Tier Mapping

Below is the complete mapping of the 32 inventoried features defined in `PROJECT.md` against Tier 1 and Tier 2 specifications.

| # | Feature Name | Milestone | Tier 1 (Feature Coverage) Focus | Tier 2 (Boundary & Corner Cases) Focus |
|---|--------------|-----------|----------------------------------|----------------------------------------|
| 1 | Baseline Repository Audit | M0 | Repo structure, git tree, audit docs, tests present, package integrity | Missing files, detached HEAD, corrupt audit json, unexpected test failures, dirty workspace |
| 2 | Parity Matrix & Docs | M0 | Parity matrix doc existence, section completeness, 8 target domains, 34 features table, edge case table | Empty sections, malformed markdown tables, unknown feature IDs, broken file paths, version mismatches |
| 3 | Feature Branch Creation | M0 | Current branch detection, branch naming convention, uncommitted state preservation, git history | Detached commit, branch checkout errors, dirty stash restoration, non-standard git config, merge conflicts |
| 4 | Rest Mode Capsule | M1 | 32×18 px capsule dimensions, spring physics transition, hover peek expansion, auto-collapse timing, aspect ratio | Zero/negative hover coordinates, extreme resize velocity, rapid enter/leave jitter, min/max dimension clamping, NaN physics coordinates |
| 5 | Tuck-away & Edge Dock | M1 | 56×4 px screen edge bar, right-click/hotkey trigger, hover expansion, edge docking coordinates, glow status color | Multiple screen edges, negative bezel offsets, rapid hotkey spamming, cursor out of bounds, secondary screen tuck |
| 6 | Persistent Capsule Config | M1 | Rest mode toggle, capsule dimension storage, hotkey binding persistence, config load/save roundtrip, default fallback | Missing APPDATA directory, corrupted JSON payload, unexpected extra keys, read-only filesystem, empty config file |
| 7 | AI Streaming Engine | M2 | SSE stream connection, incremental chunk delivery, multi-provider routing (OpenAI/Claude/Custom), completion event, buffer assembly | Broken SSE chunks, malformed JSON stream, HTTP 429 rate limit, network timeout, zero-byte chunks |
| 8 | SafeStorage DPAPI | M2 | DPAPI encryption/decryption roundtrip, base64 ciphertext storage, credential status reporting, provider separation, overwrite protection | Plaintext empty key, tampered ciphertext, non-UTF8 binary data, DPAPI unavailable fallback, concurrent key write |
| 9 | Markdown & Code Renderer | M2 | Bold/italic markdown rendering, code block syntax highlighting, copy-to-clipboard markup, list parsing, inline key combinations | Unclosed code blocks, deeply nested markdown, XSS script injection, massive markdown payload (>100KB), empty input |
| 10 | Chat History & Voice I/O | M2 | History message serialization, speaker role tagging, timestamp ordering, voice typing activation (Win+H), TTS speech contract | Max history truncation (>500 msgs), voice typing disabled in OS, special characters in speech, empty prompt, rapid send spam |
| 11 | AI Monitor Task Feed | M3 | Webhook listener on port 47823, event ingestion (`PreToolUse`/`PostToolUse`), status lamp updates, task feed item append, active timer | Port conflict handling, invalid HTTP methods (GET/PUT), non-JSON payload, rapid hook burst, oversized payload |
| 12 | File Mutation Logger | M3 | Modified/added/deleted file tracking, session ID association, relative path resolution, duplicate file deduplication, file count | Windows vs POSIX path separators, non-existent file paths, root path modification, massive file list (>1000 files), empty file list |
| 13 | Live Unified Diff Viewer | M3 | Unified diff parsing, line additions (`+`), line deletions (`-`), line number alignment, syntax tokenization | Empty diff string, massive diff (>10,000 lines) clamping to top 6 lines, binary file diff, whitespace-only changes, malformed git diff headers |
| 14 | Agent Process Controls | M3 | Allow/Deny permission resolution, Stop task signal, HTTP webhook response `{ behavior: "allow" }`, pending promise resolution, timeout | Expired session ID, repeated button clicks, allow after stop, deny after timeout, client disconnect before reply |
| 15 | Spotify OAuth PKCE | M4 | RFC 7636 code verifier generation, SHA-256 base64url code challenge, redirect URI interception, state parameter verification, token exchange schema | Code verifier < 43 chars, invalid base64url characters, state mismatch / CSRF attack, HTTP 403 Forbidden fallback, expired refresh token |
| 16 | Spotify Playback Controls | M4 | Play/pause toggle, next track, previous track, seek scrub bar math, album artwork URL resolution | Negative seek position, seek beyond duration, scrub while paused, missing album art fallback, rapid play/pause spam |
| 17 | Windows SMTC Fallback | M4 | Background `media-session.ps1` contract, active track title/artist extraction, playback state detection, SMTC fallback trigger when Spotify 403, thumbnail parsing | No media playing (`active: false`), non-English UTF-8 song titles, missing artist string, PowerShell worker restart, zero duration track |
| 18 | Mascot 9 Moods | M5 | 9 moods enum verification (Happy, Sleepy, Focused, Curious, Excited, Thinking, Surprised, Relaxed, Neutral), palette lookup, eye coordinate layout, transition duration, mood reset | Unknown mood string fallback, rapid mood switching (100 times in 10ms), sleepy mood during active input, mood lock override, empty mood string |
| 19 | Mascot Animations | M5 | Jump animation physics, jelly bounce spring math, speech bubble layout, eye gaze coordinate tracking, boundary clamping | Eye gaze pointer outside window ([-9999, 9999]), jump height exceeding island bounds, zero-gravity spring oscillation, oversized speech bubble text, multiple concurrent animations |
| 20 | Live Weather Widget | M6 | Open-Meteo API query construction, temperature/condition parsing, humidity extraction, forecast daily array, 30-minute caching | API network failure, invalid city coordinates, temperature below absolute zero or >60C, cache expiration boundary, null response payload |
| 21 | Non-blocking CPU & RAM | M6 | Differential `os.cpus()` calculation, freemem/totalmem percentage, polling interval throttling (<0.1% CPU), metric schema validation, single-cycle delta | Division by zero on single core, total memory = 0 edge case, CPU spikes at 100%, negative percentage protection, rapid polling flood |
| 22 | 12/24 Clock & Opacity | M6 | 12-hour AM/PM format, 24-hour military format, opacity slider [0.1 - 1.0], CSS/Canvas alpha application, clock update tick | Opacity < 0.0 or > 1.0 clamping, midnight (00:00 vs 12:00 AM), noon (12:00 vs 12:00 PM), system timezone changes, non-numeric opacity |
| 23 | Game Mode Fullscreen Hide | M6 | Fullscreen state detection (`SHQueryUserNotificationState`), island auto-hide, 0 FPS throttle, window restore on game exit, hotkey override | Fullscreen on secondary monitor, borderless windowed apps, rapid focus switches between game and desktop, hotkey override during game, monitor disconnect during game |
| 24 | Focus Guard Blocking | M7 | Blocklist domain matching, foreground window regex matching, calm breathing modal display, countdown timer (3/5/10s), temporary allowance bypass | Subdomain matching (e.g. `m.youtube.com`), incognito browser titles, empty blocklist, case-insensitive process names, emergency disable toggle |
| 25 | Pomodoro & Productivity | M7 | Work timer (25 min), short break (5 min), long break (15 min), audio bell synth contract, scratchpad note save/get | Zero-duration timer, timer paused during session, negative elapsed time, scratchpad massive payload (>1MB), multiple simultaneous timers |
| 26 | Project Mode Indexing | M7 | Directory tree walk, ignore patterns (`node_modules`, `.git`), 500-file cap enforcement, file metadata extraction, fuzzy search ranking | Symlink loops, empty directories, permission-denied subfolders, search query with regex characters, non-ASCII filenames |
| 27 | Project Mode Git Status | M7 | Branch name parsing, dirty file count, staged vs unstaged summary, ahead/behind tracking, clean repository state | Non-git workspace directory, detached HEAD, massive dirty file count (>1000), corrupt `.git/HEAD`, git command not in PATH |
| 28 | Multi-Monitor Display Routing| M8 | Display enumeration, primary/secondary coordinate calculation, workArea clamping, display-change event routing, fallback to primary | Disconnected monitor while island hosted, display with negative origin coordinates, virtual/headless displays, high-DPI mixed scaling (100% vs 200%), single-display environment |
| 29 | UI/UX Frosted Glass & Icons | M8 | Zero-emoji policy across all HTML/CSS, Lucide SVG vector rendering, frosted-glass backdrop-filter CSS, outside-click auto-collapse, typing protection | High-contrast accessibility mode, missing SVG viewBox, clicking draggable titlebar vs content, rapid outside clicks, focus loss during modal |
| 30 | Popover Exclusivity & Tray | M8 | Mutual exclusivity (Wi-Fi closes BT and vice versa), Escape key closes popover, system tray menu items, Ctrl+Alt+T hotkey restoration, collapse on reopen | Both popovers requested simultaneously, Escape when no popover open, tray menu click while island minimized, duplicate hotkey registration, outside click boundary |
| 31 | Localization (EN/HI) | M8 | English string catalog (`en.json`), Hindi string catalog (`hi.json`), 100% translation key parity, runtime language switch, placeholder interpolation | Missing key fallback to English, RTL / complex Devanagari Unicode rendering, empty string translations, unknown locale code fallback, malformed formatting variables |
| 32 | Build & Packaging Verification | M8 | TypeScript compilation (0 errors), esbuild bundle outputs, package.json scripts integrity, NSIS configuration, portable builder target | Missing build dependencies, read-only output directory, invalid asarUnpack glob, bundle size budget checks, uncompiled native helpers |

---

## 3. Tier 3: Pairwise Cross-Feature Interactions

Tier 3 validates how features interact with each other in concurrent, asynchronous environments:
1. **AI Streaming + Rest Mode**: Receiving AI SSE streaming tokens while the island is collapsed into 32×18 px Rest Mode (island expands or shows animated eye pulse without crashing).
2. **Spotify Playback + Focus Guard**: Media playing while Focus Guard triggers a calm breathing screen (audio ducking or persistence, UI layout stability).
3. **AI Monitor Webhook + System Popover**: Incoming hook event on port 47823 while Wi-Fi or Bluetooth popover is actively open (popover closes gracefully or shifts without DOM overlap).
4. **Game Mode Auto-Hide + Live Weather Update**: Periodic 30-min weather cache refresh occurs while island is hidden in Game Mode (no GPU wake-up, background fetch only).
5. **Project Mode Indexing + File Mutation Logger**: AI agent modifies files inside an indexed project workspace (file tree reflects new files immediately).
6. **Voice Typing (Win+H) + Markdown Code Renderer**: User dictates prompt containing code blocks and special keys (syntax highlighter renders dictated blocks).
7. **Pomodoro Timer + Mascot Mood Engine**: Pomodoro interval finishes (25 min), triggering celebratory sound and mascot transition to 'happy' mood.
8. **Multi-Monitor Display Change + Rest Mode Capsule**: Screen resolution or monitor layout changes while in 32×18 px Rest Mode (capsule repositioned to top center of designated screen).
9. **Tuck-Away Edge Dock + Outside Click**: Right-click tuck-away bar activated; outside click does not reopen or corrupt state.
10. **Localization Switch + System Metrics**: Language switched to Hindi (`hi`) while CPU and RAM metrics are actively updating (metric labels localized, numbers formatted properly).

---

## 4. Tier 4: Real-World Application Scenarios

Tier 4 exercises full end-to-end user workflows spanning multiple modules:
- **Scenario 1: Daily Developer Focus & Coding Flow**
  - User starts a 25-minute Pomodoro session.
  - Opens workspace project with 400 files in Project Mode.
  - Launches Claude Code CLI; Webhook hub receives `UserPromptSubmit` and `PreToolUse`.
  - Mascot transitions to 'thinking' mood; status lamp glows blue.
  - File changes logged, diff viewer renders 6-line diff.
  - Pomodoro finishes: bell chimes, mascot transitions to 'happy' mood.
- **Scenario 2: Deep Media & Ambient Listening Journey**
  - User launches Spotify with OAuth PKCE; token exchanged.
  - Track changes: album artwork, title, and artist update in DOM and Canvas.
  - User clicks play/pause and seeks track.
  - Internet drops: Spotify API 403 fallback seamlessly switches to Windows SMTC.
  - Song continues displaying through `media-session.ps1`.
- **Scenario 3: Distraction Guard & Emergency Override Flow**
  - Focus Guard enabled with `youtube.com` and `reddit.com` in blocklist.
  - Foreground window poll detects `youtube.com` in browser title.
  - Calm breathing modal opens, blocking distractions; 5-second countdown timer initiates.
  - User selects "Emergency 5-minute Override"; temporary allowance granted.
  - Timer expires after 5 minutes, re-engaging distraction protection.
- **Scenario 4: Full Multi-Modal AI Assistant Conversation**
  - User inputs prompt via Chat panel with voice typing.
  - Multi-provider router selects OpenAI `gpt-4o-mini`.
  - SSE stream returns incremental chunks with markdown and code blocks.
  - Markdown parsed with syntax highlighting and copy buttons.
  - User clicks copy button: code snippet copied to clipboard; clipboard history updates.
- **Scenario 5: Multi-Display Workstation Setup & Rest Transition**
  - Workstation with primary (1920×1080) and secondary (2560×1440) monitors.
  - User switches island display from primary to secondary.
  - Coordinates recalculate and center island on secondary monitor.
  - Idle timer reaches 180s: island smoothly transitions to 32×18 px Rest Mode capsule.
  - Fullscreen video starts on secondary monitor: Game Mode hides capsule.
  - Fullscreen video closes: capsule smoothly restores.

---

## 5. Test Runner Architecture (`tests/e2e/runner.js`)

The test harness is implemented as a standalone Node.js CLI runner located at `tests/e2e/runner.js`:

```bash
# Run all tiers (Tiers 1-4)
node tests/e2e/runner.js --all

# Run individual tiers
node tests/e2e/runner.js --tier 1
node tests/e2e/runner.js --tier 2
node tests/e2e/runner.js --tier 3
node tests/e2e/runner.js --tier 4
```

### Exit Codes:
- `0`: All executed test suites passed.
- `1`: One or more test suites failed.

### Reporting Format:
Each test outputs standard format:
`[PASS] TIER <tier_number> - F<feature_id>: <test_description>`
`[FAIL] TIER <tier_number> - F<feature_id>: <test_description> - <error_message>`

Followed by a tier-level and cumulative summary of tests passed, failed, and execution duration.
