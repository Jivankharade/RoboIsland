# RoboIsland

> The Intelligent Dynamic Island & AI Companion for Windows 10 & 11

RoboIsland brings the fluid, responsive Dynamic Island experience to Windows, supercharged with an offline-first AI mascot, real-time developer terminal monitoring, Apple-grade hardware HUDs, media controls with live synced lyrics, and local peer-to-peer file transfer.

---

## Key Capabilities

### 1. Apple-Grade Dynamic Island & Reactive Mascot
- **Dual Display Modes**:
  - **Notch Mode**: Anchored flush to the top edge of your monitor (`y = 0`).
  - **Floating Mode**: Centered pill floating with smooth spring elevation.
- **Robo Mascot**: Procedural vector eyes rendered with HTML5 Canvas, featuring 7 reactive emotional states (`neutral`, `happy`, `focused`, `dizzy`, `sleep`, `excited`, `blink`).
- **Tuck & Rest Modes**: Minimizes into a tiny obsidian pebble (32x18px) or tucks cleanly into the monitor bezel when you need pure focus.

### 2. Apple Hardware & Telemetry HUDs
- **Speedometer Performance HUD (`Ctrl+Alt+S`)**:
  - Triple 240-degree speedometer dials for RAM, Primary SSD/HDD Storage, and CPU utilization.
  - Adaptive performance color rings:
    - Calm Green (< 60%)
    - Warm Amber (60% - 84%)
    - Dynamic Red (>= 85%)
- **Hardware Volume Pop**:
  - Live scrubbing volume slider with smooth spring jelly physics and mute toggling.
- **Battery Charger Surge**:
  - Animated charging bolt and percentage surge upon AC connection.

### 3. Apple AirDrop & LAN File Transfer
- **File Tray & Staging**: Drag files from Windows Explorer onto the island to stage them instantly.
- **Phone Drop (No Cloud Required)**:
  - Scannable high-contrast ISO/IEC 18004 SVG QR code.
  - Instant direct peer-to-peer Wi-Fi transfer over your local network (`port 48912`).
- **Apple Quick Look (`Spacebar`)**:
  - Select or hover over any staged file and press `Spacebar` (or click the Eye icon) to open a frosted-glass preview sheet.
  - Full image viewer, syntax/code viewer with line counts, and metadata inspection.
- **Two-Way Drag-Out**: Grab any staged file chip and drag it directly out of the island onto your Desktop, Windows File Explorer, or apps.
- **Live Transfer Beam & Chime**: Real-time laser beam animation and ascending AirDrop chime upon completion.

### 4. Real-Time AI Agent Monitoring (Claude Code & Codex)
- Embedded webhook receiver listening on `http://127.0.0.1:47823`.
- Ingests tool calls, terminal commands, and file edits in real time.
- **Unified Diff Viewer**: Inline color-coded file mutation viewer with additions and deletions.
- **Interactive Permissions HUD**: Approve or deny CLI bash commands and file writes directly from the island.

### 5. Multi-Provider AI Companion Chat
- Instant switching between:
  - **Claude 3.5 Sonnet** (Anthropic)
  - **GPT-4o** (OpenAI)
  - **100% Free Offline Local AI** (Ollama: Llama 3, DeepSeek, Qwen)
- Voice typing support via Windows Speech (`Win + H`) and Text-to-Speech playback.
- All credentials encrypted at rest using Windows Data Protection API (DPAPI).

### 6. Media Player & Live Synced Lyrics
- Zero-latency Windows System Media Transport Controls (SMTC) for Spotify, YouTube, Apple Music, and Chrome.
- Real-time synchronized lyrics parser powered by LRCLIB.
- Dynamic album art reflection with live audio visualizer frequencies.

### 7. Focus Timer & Distraction Guard
- Dual-wheel infinite scroll picker for hours and minutes.
- Quick preset duration chips (`5m`, `15m`, `25m`, `50m`).
- Focus Guard: Non-invasive distraction deterrence to keep you locked on your tasks.

---

## Keyboard Shortcuts Cheatsheet

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + Alt + S` | Toggle Apple Speedometer HUD (RAM, Storage, CPU) |
| `Spacebar` | Toggle Apple Quick Look on active staged file |
| `Escape` | Dismiss Quick Look / Close expanded island / Close popovers |
| `Win + H` | Windows Voice Typing inside Robo Chat |
| `Click Mascot Eyes` | Cycle emotions / Wake up Robo |
| `Double Click Island` | Toggle compact / expanded view |

---

## Installation & Running

### Option A: Install via Setup Installer (Recommended)
1. Download `RoboIsland-Setup-1.0.0.exe` from the latest release.
2. Run the installer. Choose your preferred destination or accept defaults.
3. Launch **RoboIsland** from your Start Menu or Desktop shortcut.

### Option B: Portable Mode
1. Download `RoboIsland-Portable-1.0.0.exe`.
2. Double-click to run anywhere without installation.

### Option C: Run from Source (PowerShell)
Requirements: Node.js 18+ and npm.

```powershell
# Clone the repository
git clone https://github.com/your-username/roboisland.git
cd roboisland

# Install dependencies
npm install

# Build and compile TypeScript & renderers
npm run compile

# Launch the application
npm start
```

---

## Building & Packaging

To compile release packages:

```powershell
# Compile all source files
npm run compile

# Build standard NSIS installer and portable executable
npm run dist

# Build standalone unpacked directory for immediate testing
npm run dist:dir

# Build native AppX / MSIX package for Microsoft Store
npm run dist:appx
```

Release binaries are output to the `release/` directory:
- `release/RoboIsland-Setup-1.0.0.exe` (Direct Win32 Microsoft Store Submission)
- `release/RoboIsland-Portable-1.0.0.exe`
- `release/win-unpacked/RoboIsland.exe`

---

## Microsoft Store Submission

RoboIsland is fully compatible with Microsoft Partner Center submission:
1. Register at [partner.microsoft.com/dashboard](https://partner.microsoft.com/dashboard).
2. Reserve the name **RoboIsland**.
3. Choose **Win32 application** package type.
4. Upload `release/RoboIsland-Setup-1.0.0.exe`.
   - Silent install argument: `/S`
   - Silent uninstall argument: `/S`
5. Provide the Privacy Policy link (`PRIVACY.md`).

---

## License

MIT License. Designed with zero unicode emojis, pure SVG vector rendering, and offline-first local security.
