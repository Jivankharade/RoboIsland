# Comprehensive Parity Feature Specification: TwoCode vs RoboIsland 2.0
**Document Version**: 2.0.0  
**Author**: Parity Spec Miner (Explorer 2)  
**Target Matrix Destination**: `docs/TWOCODE_ROBOISLAND_PARITY_MATRIX.md`  
**Date**: 2026-11-04  

---

## 1. Executive Summary & Specification Scope

This document provides the authoritative, ground-truth behavioral and interface specification mined from the reference implementation (**TwoCode**, located at `C:\Users\hp218\Downloads\TwoCode\resources\app`), architectural comparison reports, and user requirements. Proprietary source code was inspected solely for observable behaviors, contracts, geometry, physics, and interface schemas without copying core proprietary logic.

The 8 target domains investigated and specified below are:
1. **Rest Mode**: 32×18 px capsule appearance, dynamic item sizing, spring physics, and persistent configuration.
2. **Full AI Chat**: Streaming responses, markdown/code rendering, copy button, conversation history, voice I/O, and secure credentials via `safeStorage` (DPAPI) for OpenAI, Anthropic Claude, and custom endpoints.
3. **AI Monitor**: Real-time task feeds, tool-call logs, file edit logs, diff viewers, and stop/pause controls connected via port 47823 webhook.
4. **Spotify & Media Integration**: OAuth PKCE, playback controls, album art, progress bar, lyrics sync, and seamless Windows SMTC fallback.
5. **Mascot Moods & Canvas Animations**: 9 distinct expressions (Happy, Sleepy, Focused, Curious, Excited, Thinking, Surprised, Relaxed, Neutral), gaze tracking, speech bubbles, and jump/bounce physics.
6. **Dynamic Island Widgets**: Real weather metrics (Open-Meteo), system metrics (CPU/RAM), 12/24-hour clock, opacity slider (see-through island), Game Mode auto-hide, and multi-display routing.
7. **Focus Guard & Project Mode**: Website/app blocklists, Pomodoro timers, workspace indexing, search, syntax-highlighted file viewing, and Git status.
8. **UI/UX Design System**: Unified frosted-glass aesthetic, Lucide/SVG vector icons (strict zero-emoji policy), and robust window interaction rules (outside click, popover exclusivity, context menu, tray, hotkeys).

---

## 2. Master Features Discovered Table

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Rest Mode | 32×18 px Capsule State | Ultra-compact resting pill when idle | Idle timer / user action | 32×18 px pill (or dynamic width) | Falls back to 116×32 px default | `rest-ui.js`, `mascot.html:980` |
| 2 | Rest Mode | Dynamic Metric Layout | Side-by-side rendering of time, battery, CPU, RAM, Wi-Fi, Bluetooth | User prefs (`restLeft`, `restRight`) | Canvas drawing with adaptive width | Invalid item ignored, centered eyes | `rest-ui.js:12-72` |
| 3 | Rest Mode | Tuck-Away Bar | Collapses island into a 56×4 px line at top edge of screen | Right-click or `Ctrl+Alt+H` | Thin 4px glow line (orange/green/white) | Auto-restores on hover or AI event | `tuck-ui.js:8-71` |
| 4 | Rest Mode | Spring Transitions | Apple-style spring physics with velocity continuation | `setMode(targetMode)` | Smooth width/height/radius interpolation | Velocity clamped, prevents jitter | `mascot.html:1030-1138` |
| 5 | AI Chat | Markdown Code Renderer | Renders bold, code blocks, lists, and inline keys | Raw AI text response | Formatted HTML with copy buttons | Plaintext fallback on parser error | `chat-ui.js:181-204` |
| 6 | AI Chat | Multi-Provider Routing | Routes prompts to Claude Code (webhook/CLI), OpenAI (API), or Codex | Selection / API configuration | Assistant responses & action plans | Returns error toast + fix button | `chat-ui.js:209-253`, `buddy-main.cjs:313` |
| 7 | AI Chat | Speech-to-Text (Voice In) | Activates Windows Voice Typing (`Win + H`) into chat input | Mic button click / `Ctrl+Alt+Space` | Typed transcript in chat field | Shows help toast if Speech disabled | `chat-ui.js:415-438`, `media-session.ps1:174` |
| 8 | AI Chat | TTS (Robo Voice Out) | Speaks response aloud via Windows SpeechSynthesizer | AI response completion | AudioContext playback + eye hop | Silently skips if no language voice | `chat-ui.js:442-460`, `media-session.ps1:152` |
| 9 | AI Chat | Secure Credential Storage | Encrypts API keys on disk using Windows DPAPI | User enters API key in Settings | Base64 encrypted string on disk | Error thrown if DPAPI unavailable | `project-mode-main.js:220-256` |
| 10 | AI Monitor | Webhook Hook Receiver | Listens on `127.0.0.1:47823` for CLI hook events | HTTP POST JSON payload | Broadcasts state to UI & status line | Port conflict fallback / error log | `claude-code-hooks.cjs:12-30` |
| 11 | AI Monitor | Real-Time Task Activity | Displays current tool, status lamp, and elapsed timer | Hook event (`PreToolUse`, `PostToolUse`) | Animated activity line & timer | Retains last state on disconnect | `ai-monitor-ui.js:650-683` |
| 12 | AI Monitor | Live Diff & Code Viewer | Color-coded syntax-highlighted code diff for file changes | Line deletions/additions payload | Line numbers, red `-`, green `+` rows | Plain text if syntax unknown | `ai-monitor-ui.js:697-718` |
| 13 | AI Monitor | Terminal Jump Control | Brings terminal/editor running AI process to foreground | Jump button click | Win32 `SetForegroundWindow` + Alt tap | Retries via minimize/restore | `ai-monitor-main.cjs:70-101` |
| 14 | AI Monitor | Stop / Pause Controls | Cancels pending AI task or denies permission request | User clicks Stop/Deny in island | Webhook reply `{ behavior: "deny" }` | Logs warning if session expired | `ai-monitor-ui.js:634` |
| 15 | Media | Spotify OAuth PKCE | Authenticates user Spotify account securely | Browser OAuth flow | Access/Refresh tokens in storage | 403 fallback to Windows SMTC | `main.js`, `media-main.cjs:83` |
| 16 | Media | Windows SMTC Fallback | Reads media info from Windows System Media Controls | Background `media-session.ps1` | Track title, artist, album art, position | Returns `{ active: false }` if quiet | `media-session.ps1:28-80` |
| 17 | Media | Vector Playback Controls | Prev, Play/Pause, Next vector icons with hover feedback | User click / touchpad swipe | Sends IPC control action | Ignores invalid actions | `spotify-ui.js:14-22`, `141-150` |
| 18 | Media | Visualizer & Tint | 6-bar sound-reactive visualizer and album backdrop gradient | Audio levels / sine simulation | Glowing canvas equalizer bars | Flat 10% bars when paused | `spotify-ui.js:26-61` |
| 19 | Mascot | 9 Distinct Moods | Expressions: Happy, Sleepy, Focused, Curious, Excited, Thinking, Surprised, Relaxed, Neutral | Mascot state event or timer | Canvas vector eyes & curves | Defaults to neutral capsule | `mascot.html:1874-2110` |
| 20 | Mascot | Eye Gaze Tracking | Eyes gaze towards mouse cursor smoothly | Pointer coordinates `(clientX, clientY)` | Translated pupil offsets | Clamped to bounds, centered on leave | `mascot.html:1852-1854` |
| 21 | Mascot | Jump & Jelly Wobble | Mascot jumps and island jelly-wobbles on task events | `__twocodeCelebrate` / `__twocodeKick` | Damped sine spring deformation | Clamped to prevent distortion | `twocode-fun.js:282-371` |
| 22 | Widgets | Live Weather Metric | Real-time temperature, condition icon, humidity, forecast | Open-Meteo geocoding + forecast API | Status bar / rest mode widget | Cached for 15 min; error toast | `extras-main.cjs:89-100` |
| 23 | Widgets | CPU & RAM Metric | Real-time core usage and memory consumption | Node `os.cpus()` & `os.freemem()` | Percentage strings (`CPU 14%`) | Non-blocking 2s polling interval | `system-main.cjs:8-16` |
| 24 | Widgets | 12/24-Hour Clock | Configurable digital clock display in bar and rest mode | System clock + preference format | Formatted time string (`14:25` or `2:25 PM`) | Locale default fallback | `rest-ui.js:32` |
| 25 | Widgets | Island Opacity Control | Configurable frosted-glass see-through alpha slider | User slider input (0.2 to 1.0) | Adjusted double-pass canvas fill | Clamped between 0.1 and 1.0 | `mascot.html:2140-2146` |
| 26 | Widgets | Game Mode Fullscreen Detection | Automatically hides island during fullscreen gaming/video | Win32 `SHQueryUserNotificationState` | Island hides (0 fps), restores on exit | Bypassed if user explicitly opens | `game-mode-main.cjs:12-38` |
| 27 | Widgets | Multi-Display Positioning | Selects which monitor hosts the island | Display ID or `main` | Re-anchors island to chosen screen | Reverts to primary if monitor unplugged | `display-main.cjs:8-39` |
| 28 | Focus Guard | Website & App Blocklist | Intercepts distracting websites and desktop applications | Active window change event | Blocks foreground window with modal | Passes if temporary allowance active | `focus-guard-main.cjs:40-88` |
| 29 | Focus Guard | Breathing Delay & Choices | Enforces 3, 5, or 10s breathing delay before decision | Countdown timer completion | "Go back" (minimize) vs "Open anyway" | Window minimized via Win32 API | `focus-guard-main.cjs:72-78` |
| 30 | Project Mode | Workspace Directory Indexing | Indexes files up to 500 entries, ignoring secret/build dirs | Project folder selection | File tree index with technology icons | Silently ignores ignored dirs | `project-mode-main.js:69-100` |
| 31 | Project Mode | Full-Text & Fuzzy Search | Quick search across filenames and contents | Search query string | Filtered file match list with line jump | Capped search results | `project-mode-main.js:32-41` |
| 32 | Design System | Lucide SVG Vector Icons | Clean monochrome SVG vector icons on 24×24 grid | Icon renderer call | Vector paths (zero emojis) | Generic fallback path | `icons-ui.js:7-42` |
| 33 | Design System | Window Interaction Rules | Island collapses on outside click; exclusivity for popovers | Pointer click outside bounds | Closes popovers & collapses island | Typing in text field suppresses collapse | `chat-ui.js:368`, `mascot.html` |
| 34 | Design System | Tray & Global Hotkeys | System tray menu & `Ctrl+Alt+T` / `Ctrl+Alt+H` hotkeys | Keyboard shortcuts / tray clicks | Show, hide, collapse, or settings | Windows global shortcut conflict alert | `shortcuts-main.cjs`, `tray-main.cjs` |

---

## 3. Edge Cases Matrix

| # | Feature | Input / Condition | Observed Reference Behavior |
|---|---------|-------------------|-----------------------------|
| 1 | Rest Mode | Mouse hovers near rest capsule (`pointer.y < 90`) | Spring smoothly expands island to compact mode (`300×36 px`) with 330ms peek delay; collapsing if mouse leaves within 220ms. |
| 2 | Rest Mode | Multiple rest widgets configured (`time` + `cpu` + `battery`) | Symmetrically scales width: left widget on far left, right widget on far right, mascot eyes centered. If only one side selected, eyes shift to opposite side to maintain optical balance. |
| 3 | Rest Mode | User right-clicks island while in rest mode | Triggers `tuck-away` mode, collapsing the island into a subtle 56×4 px line at the screen bezel. |
| 4 | AI Chat | User submits question while AI is still generating | Submit button disabled (`disabled="true"`), enter key ignored; prevents concurrent queue collision. |
| 5 | AI Chat | User types while outside-click occurs | Typing focus suppresses auto-collapse (`projectInputFocused = true`), keeping the chat open and active. |
| 6 | AI Chat | Markdown with Windows key combinations (e.g. `` `Win + H` ``) | Automatically converts text into stylized `<kbd>` tags with rendered Windows vector icon. |
| 7 | AI Chat | Claude Code output exceeds token quota (HTTP 402 / credit limit) | Catches error string, displays friendly localized error message, and provides "Open /login" action button. |
| 8 | AI Chat | Windows Voice Typing called without Speech service enabled | Gracefully catches failure, waits 9 seconds, and appends assistive bubble explaining how to enable voice typing in Windows Settings. |
| 9 | AI Monitor | Webhook receives permission request from Claude Code | Island expands automatically; displays file modification plan with diff and prominent "✓ Allow" / "✕ Deny" buttons. |
| 10 | AI Monitor | Hook port `47823` already occupied by another instance | Server logs warning, tries incremental backoff, but maintains file-based fallback state tracking. |
| 11 | AI Monitor | AI edits file with large diff (>100 lines) | Clamps visible diff panel to top 6 modified lines with `+` and `−` markers, providing an expandable indicator. |
| 12 | AI Monitor | AI task crashes or throws error | Status traffic light switches to red lamp (`#ff453a`); displays error details and logs to history. |
| 13 | Spotify | Spotify Web API returns 403 Forbidden (Non-developer account) | Automatically switches to `windows` SMTC fallback without crashing or showing blank screen; sets 10-minute cooldown on API retries. |
| 14 | Spotify | Music playback paused | Equalizer visualizer bars flatten to 10% height; timeline position stops advancing; play icon replaces pause icon. |
| 15 | Spotify | User drags touchpad horizontally across compact island | Swipes left/right trigger Next / Previous track actions with a temporary toast overlay (`⏭ Volgend nummer`). |
| 16 | Spotify | Track changes in external app (e.g. Chrome / YouTube) | Windows SMTC detects new title/album key, re-reads base64 thumbnail, and pushes `music:changed` IPC event immediately. |
| 17 | Mascot | Idle timeout reached with no user input or media playback | Enters `sleep` mood; mascot eyes close smoothly (`Math.PI * 0.15` arc); wake event restores neutral mood on mouse move. |
| 18 | Mascot | User receives AI chat response or finishes Pomodoro task | Mascot triggers jump animation (`jump()`), fires celebratory confetti particles, and triggers `heart` or `happy` mood. |
| 19 | Game Mode | Fullscreen game opens on secondary monitor, island is on primary | `islandScreen(at)` checks coordinates; island remains visible because fullscreen app is on another monitor. |
| 20 | Game Mode | User presses `Ctrl+Alt+T` while game is running full screen | Overrides game mode temporary hide; forces island to display until collapsed or idle timeout expires. |
| 21 | Multi-Display | User unplugs the secondary monitor hosting the island | Electron `display-removed` fires; coordinates fall back gracefully to primary monitor (`screen.getPrimaryDisplay()`). |
| 22 | Focus Guard | User opens blocked app in incognito browser window | Browser title regex matches against base domain (e.g. `youtube`), intercepting and triggering the calm screen regardless of browser mode. |
| 23 | Focus Guard | User selects "Open anyway" on calm screen | Grants temporary allowance (5, 15, or 30 min); timer map prevents re-triggering modal until expiry. |
| 24 | Wi-Fi / BT | User clicks Wi-Fi popover while Bluetooth popover is open | State machine closes Bluetooth popover immediately before opening Wi-Fi popover (strict mutual exclusivity). |
| 25 | UI System | System DPI scaling changes (e.g. 100% to 150%) | Canvas rendering engine recalculates device pixel ratio (`devicePixelRatio`), scaling coordinate metrics crisply. |

---

## 4. Deep-Dive Domain Technical Specifications

### Domain 1: Rest Mode & Island State Machine
- **Geometry & Target Dimensions**:
  - `rest`: Minimum **32×18 px** capsule (standard base 116×32 px with metrics; compact pill radius 16 px).
  - `compact`: **300×36 px**, corner radius 18 px (`UI.COMPACT_H / 2`).
  - `expanded`: **520 px** width, variable height by active tab:
    - `home`: 150 px
    - `spotify`: 196 px
    - `chat`: 270 px (or stage fill)
    - `monitor`: 270 px
    - `project`: 270 px
    - `settings`: 196 px / 300 px
    - Corner radius: 32 px (`UI.EXPANDED_RADIUS`).
- **Spring Physics Parameters**:
  - Duration: 380 ms base
  - Response: `0.42 * speed` (growing) vs `0.34 * speed` (shrinking)
  - Damping: `0.86` (growing) vs `1.0` (shrinking, no overshoot)
  - Stiffness: `(2 * Math.PI / response)^2`
  - Friction: `4 * Math.PI * damping / response`
- **Tuck Mode (Thin-Line Sleep)**:
  - Line size: 56 px wide × 4 px high (border radius 2 px)
  - Hit zone: 160 px wide × 10 px high
  - Restores on 450 ms hover (`BACK_AFTER = 450`) or urgent AI notification.

### Domain 2: Full AI Chat
- **Interface Structure**:
  - Top bar: Context pill (`app` + favicon / screenshot zoom preview), provider switcher, new chat button.
  - Message bubble stream: User messages aligned right (`#2c2c2e`), assistant messages left (`#fff`), font 15-17px Inter.
  - Action cards: Proposal diffs with file name, line number, find/replace blocks, "✓ Yes, fix it" and "No" decision buttons.
  - Chat input bar: 36-44px rounded container, microphone button (speech typing), send button (`↑`).
- **Providers & Credential Contracts**:
  - Supported providers: Claude Code (`claudecode`), OpenAI (`openai`), Anthropic direct (`claude`), custom OpenAI-compatible endpoint.
  - Storage: Encrypted via `safeStorage.encryptString(apiKey).toString('base64')` in `twocode-ai-settings.json`.
- **Speech Capabilities**:
  - Input: Simulated `Win + H` keystrokes via Windows user32 `keybd_event` after clearing modifier keys.
  - Output: Windows `SpeechSynthesizer` generating temporary WAV audio streamed to Web Audio API, extracting audio frequency levels to modulate mascot pupil bounce.

### Domain 3: AI Monitor Panel
- **Webhook Interface**:
  - Port: `47823` on localhost
  - Endpoint: `/twocode-hook?v=4`
  - Inbound Events: `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, `Notification`, `Stop`, `SessionEnd`.
- **UI States & Visualization**:
  - Traffic light lamps:
    - Running: `#ff9a1f` (yellow/orange pulsing lamp)
    - Done: `#22e05a` (green solid lamp)
    - Error: `#ff453a` (red lamp)
    - Question / Plan: `#a07bff` (purple lamp)
    - Ready / Idle: `rgba(255,255,255,0.18)`
  - Real-time tool categories: `read`, `edit`, `run`, `search`, `web`, `agent`, `other` with matching Lucide icons.
  - Live timer: `mm:ss` counter updated every 1000 ms.
  - Diffs: Line-numbered diffs with `-` (red deletion) and `+` (green addition) blocks.

### Domain 4: Spotify & Media Integration
- **Dual-Engine Architecture**:
  1. Spotify Web API (via OAuth PKCE token exchange) for remote device control, playlists, volume, and seek.
  2. Windows SMTC (`media-session.ps1` via `GlobalSystemMediaTransportControlsSessionManager`) as primary or fallback engine.
- **Contract Schema**:
  ```json
  {
    "ok": true,
    "connected": true,
    "active": true,
    "source": "windows",
    "is_playing": true,
    "progress_ms": 124000,
    "duration_ms": 218000,
    "track": {
      "id": "track_key",
      "name": "Song Title",
      "artist": "Artist Name",
      "image_url": "data:image/jpeg;base64,..."
    },
    "device": { "id": "this-pc", "name": "Spotify", "type": "Computer" }
  }
  ```
- **UI Components**:
  - 60×60 px rounded album cover
  - Interactive scrub bar expanding from 3 px to 6 px on hover
  - Previous, Play/Pause, Next vector controls
  - 6-bar audio visualizer reacting to audio levels
  - Dynamic gradient tint radiating from bottom of island in album accent color

### Domain 5: Mascot Moods & Animations
- **9 Expressions**:
  1. **Happy**: Upward smiling arcs (`arc(0, 3, 5, Math.PI * 1.15, Math.PI * 1.85)`).
  2. **Sleepy**: Downward closed arcs (`arc(0, -2, 5, Math.PI * 0.15, Math.PI * 0.85)`).
  3. **Focused**: Squinted horizontal ellipses (`ellipse(0, 1, 5.5, 4, 0, 0, Math.PI * 2)`).
  4. **Curious**: Tall vertical ellipses (`ellipse(0, 0, 6, 9.5, 0, 0, Math.PI * 2)`).
  5. **Excited**: Bouncing heart eyes (`#ff5c8a`) or energetic spring hop.
  6. **Thinking**: Slanted gaze with gentle head tilt.
  7. **Surprised**: Wide circular eyes (`arc(0, 0, 7, 0, Math.PI * 2)`).
  8. **Relaxed**: Horizontal wink line on one eye, calm arc on the other.
  9. **Neutral**: Standard rounded capsule ellipses (`ellipse(0, 0, 5, 8, 0, 0, Math.PI * 2)`).
- **Physical Dynamics**:
  - Gaze tracking: Follows cursor with dampened 320 px horizontal and 200 px vertical easing.
  - Voice talk sync: Squeezes eyes vertically (`1 - talk * 0.38`) while speech is active.
  - Celebrate: Triggers spring jump (`jump()`) and bursts 40-70 canvas confetti rectangles.

### Domain 6: Dynamic Island Widgets
- **Weather Widget**:
  - Provider: Open-Meteo REST API (no API key required).
  - Geocoding: `https://geocoding-api.open-meteo.com/v1/search?count=1&name={city}`.
  - Cache: 15 minutes TTL.
  - Displays: Temperature (°C/°F), condition icon, humidity, city name.
- **System Metrics**:
  - Polling: 2000 ms interval.
  - CPU: Delta of `os.cpus()` busy vs idle times.
  - RAM: `(1 - freemem/totalmem) * 100`.
- **Clock**:
  - Supports `12h` (AM/PM) and `24h` formats with user configuration.
- **Opacity Slider**:
  - Supports 0.1 to 1.0 alpha. Double-pass background drawing preserves crisp drop shadow while delivering transparent glass pill.
- **Game Mode**:
  - Uses Win32 `SHQueryUserNotificationState` (states 2, 3, 4, 7).
  - Auto-hides island to avoid fps overhead during fullscreen games.
- **Multi-Display**:
  - Detects all monitors via `screen.getAllDisplays()`.
  - Persists selected monitor ID in `userData/island-display.json`.

### Domain 7: Focus Guard & Project Mode
- **Focus Guard**:
  - Pre-configured sites: YouTube, TikTok, Instagram, X (Twitter), Reddit, Facebook, Netflix, Twitch, Discord.
  - Foreground monitoring: Win32 `GetForegroundWindow` / `GetWindowText` / `GetProcessName`.
  - Fullscreen breathing barrier (`guard.html`) set to `screen-saver` window tier.
  - Configurable countdown (3, 5, 10s) and allowance periods (5, 15, 30 min).
- **Project Mode**:
  - Workspace indexing: Scans files up to 500 items, ignoring `node_modules`, `.git`, `.twocode-backups`, secret directories.
  - Fuzzy and full-text search: Indexed file lookups with syntax highlighting and line jumps.
  - Git status: Detects modified, added, and deleted files.

### Domain 8: UI/UX Frosted Glass & Design System
- **Strict Visual Rules**:
  - **Zero Emoji**: Absolutely no emoji icons or plain unicode character icons in navigation, buttons, or status pills.
  - **Vector Icons**: 24×24 pixel grid vector SVG / Lucide icons (stroke width 1.7-2.0, rounded line caps).
  - **Palette**: Frosted translucent black (`#000000` with alpha), cards `#1c1c1e` and `#2c2c2e`, border strokes `rgba(255,255,255,0.08)`.
  - **Window Collapse**: Clicks outside the island bounds collapse it to compact/rest mode immediately, unless an input field has focus.
  - **Popover Exclusivity**: Opening Wi-Fi popover automatically closes Bluetooth popover and vice versa.
  - **Global Hotkeys**:
    - `Ctrl+Alt+T`: Toggle island visibility.
    - `Ctrl+Alt+H`: Tuck away into thin line.
    - `Ctrl+Alt+Space`: Voice chat assistant.

---

## 5. Summary Recommendations for Implementation

1. **Phase 1 Implementation (Island Core & Mascot)**:
   - Incorporate the 32×18 px rest state and dynamic item calculations into `canvas-engine.ts`.
   - Implement the full 9 mascot expressions in `robo-mascot.ts`.
   - Add the Open-Meteo weather fetch and CPU/RAM polling.
2. **Phase 2 Implementation (Full AI Chat)**:
   - Integrate `safeStorage` encryption for OpenAI, Anthropic, and custom endpoints.
   - Implement streaming markdown bubble renderer with Cascadia Code blocks and copy buttons.
   - Connect Windows Voice Typing (`Win + H`) and SpeechSynthesizer voice output.
3. **Phase 3 Implementation (AI Monitor)**:
   - Bind HTTP webhook on port 47823 with full hook events.
   - Render live task feed, file diffs, and terminal jump controls.
4. **Phase 4 Implementation (Spotify & Media)**:
   - Wire media session with automatic fallback from Spotify Web API to Windows SMTC.
   - Add interactive seek bar and audio equalizer visualizer.
5. **Phase 5 Implementation (Focus Guard & Project Mode)**:
   - Build foreground window watcher and calm breathing screen.
   - Implement project folder indexing and fuzzy search.
