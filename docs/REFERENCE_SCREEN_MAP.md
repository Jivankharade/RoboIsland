# RoboIsland — Reference Screenshot Map

All 8 screenshots inspected successfully. This document maps each to a RoboIsland component, describes what it shows, and identifies implementation gaps.

---

## Screenshot 01 — Island Dashboard (Expanded Home)

![01_island_dashboard](reference_screenshots/01_island_dashboard.jpeg)

### What It Shows
The **expanded Dynamic Island** at the top of the screen, showing the **Home** tab content:
- **Top status strip**: Wi-Fi icon (left), Bluetooth icon, two green Robo eyes (center), date/time `Tue 3 Nov 2026 10:56 PM`, battery pill `-10% · 23:58:30` (red, draining), three-dot menu (right)
- **Three content cards** in a horizontal row:
  1. **Claude Code** — dark card with gear icon, `Connect` text, `in Settings` subtitle
  2. **Music** — gradient purple card with music note icon, `Quiet` / `Nothing playing`
  3. **Focus** — gradient purple card with play button, `25:00` / `Ready to start`
- **Bottom navigation bar**: 10 icons — Home (selected, with label), Robo/sparkle, Music note, Chat bubble, Clock/Focus, File Tray, Clipboard, Notes, System/Speaker. Selected state has a subtle highlight and label below

### RoboIsland Component
- `canvas-engine.ts` → expanded hub (520×240 state)
- Currently renders 5 tab content areas with canvas drawing

### Key Gaps
- **Bottom nav bar with 10 icons** is missing — current island draws only 5 text labels (Music, System, AI, Tools, Focus)
- **Cards layout** — current expanded view doesn't render card-style panels with gradients
- **Status strip** — current pill shows basic info but not the full Wi-Fi/BT/battery/time strip
- **Three-dot menu** — not implemented
- **Overall this is an HTML/CSS UI, not canvas-drawn** — TwoCode uses DOM elements in `mascot.html`, not pure canvas

---

## Screenshot 02 — Focus Indicator (Compact Island)

![02_focus_indicator](reference_screenshots/02_focus_indicator.jpeg)

### What It Shows
The **compact/resting island** while a Focus session is active:
- **Left**: Circular progress ring (purple/violet) showing partial completion
- **Center**: Two small glowing green capsule eyes
- **Right**: Focus timer `24:43` in green text
- The pill width is wider than the resting state (~280px) to fit the timer

### RoboIsland Component
- `canvas-engine.ts` → compact content with `focusState.active === true`
- `drawCompactContent()` method

### Key Gaps
- **Circular progress ring** on the left is not drawn — currently no arc/ring indicator
- **Timer text on the right** — currently the compact view only shows media info or resting eyes, not focus timer
- **The compact state should show focus info alongside eyes** when a session is active

---

## Screenshot 03 — File Tray Panel

![03_file_tray](reference_screenshots/03_file_tray.jpeg)

### What It Shows
The expanded island in the **File Tray** tab:
- **Top strip**: Title `File Tray` (left, cyan), two green eyes (center), date/time, `Phone` button with phone icon (right), three-dot menu
- **Main content**: Large yellow tray icon, `Drop files here` heading, `They wait here until you drag them out · click to open` subtitle
- **Yellow button**: `Or get them from your phone` with phone icon
- **Bottom nav**: Same 10-icon navigation bar with `Tray` selected (highlighted with label)
- Dark background

### RoboIsland Component
- `canvas-engine.ts` → expanded hub, currently the "Tools" tab
- `productivity-engine.ts` for file tray data
- `island-preload.ts` for IPC

### Key Gaps
- **No dedicated File Tray tab in the island** — currently lumped under "Tools"
- **No drag-and-drop zone visual** in the expanded island
- **"Phone" button** for LAN Drop not in the island UI
- **Yellow tray icon and styling** completely missing — canvas-only rendering can't easily do this

---

## Screenshot 04 — System Popover (Wi-Fi/Bluetooth)

![04_system_popover](reference_screenshots/04_system_popover.jpeg)

### What It Shows
The expanded island with a **system popover** overlaying the left side:
- **Popover panel** (dark, rounded): Two toggle cards — `Wi-Fi` (active/blue, showing SSID "Airawathostel") and `Bluetooth` (off). Below: `Wi-Fi networks →` and `Bluetooth devices →` expandable rows
- **Right side**: Focus card still visible showing `23:47` / `24 min left` with gradient background
- **Top strip**: Full status bar with Wi-Fi/BT icons, eyes, time, battery

### RoboIsland Component
- `canvas-engine.ts` → expanded hub "home" tab
- System controls from `media-engine.ts` (network/volume queries)

### Key Gaps
- **Popover/overlay panel** for system controls doesn't exist — current system info is just text drawn on canvas
- **Wi-Fi and Bluetooth toggle cards** — not implemented as interactive elements
- **Network list and device list** expandable rows — missing entirely
- This is a layered popover UI that requires HTML elements, not just canvas

---

## Screenshot 05 — Robo Settings Page

![05_robo_settings](reference_screenshots/05_robo_settings.jpeg)

### What It Shows
The **Settings window** → **Robo** page:
- **Left sidebar**: Navigation with sections — TwoCode (Home, Connections, AI & Chat, Apps), Robo (Robo [selected], Wardrobe), Settings (Account, General, Island, Focus guard, News, Support TwoCode). Bottom: user/mascot avatar with "0 tasks done" and gear icon
- **Main content**:
  - Large Robo mascot preview card with crown accessory, name, task count, badge progress bar
  - **Name** section: "What's his name?" input with Save button
  - **Look** section: "Traffic-light eyes" — 3 presets (Classic, Soft, Colour-blind) with colour picker rows for Working/Done/Error states (6 color swatches each)

### RoboIsland Component
- `settings.html`, `settings.css`, `settings-ui.ts` → Robo tab
- Existing implementation has a basic eye preview and skin selector

### Key Gaps
- **Mascot preview card** with animated mascot wearing accessories — currently a static CSS animation
- **Traffic-light eye color system** — RoboIsland uses 5 skin themes instead; should add per-state color pickers
- **Badge progress bar** — not implemented
- **Save button for name** — exists but simpler styling
- Overall the layout matches reasonably but details differ

---

## Screenshot 06 — Wardrobe Page

![06_wardrobe](reference_screenshots/06_wardrobe.jpeg)

### What It Shows
The **Settings window** → **Wardrobe** page:
- **Left sidebar**: Same navigation, Wardrobe selected
- **Main content**:
  - Large Robo mascot preview (left) wearing crown + "Best" outfit, name below
  - **Outfit** section (right): Grid of outfit cards — "Best" (selected, green check), "None", "Party hat (Earned at 5 tasks)", "Sunglasses (Earned at 15 tasks)", "Crown (Earned at 30 tasks)"
  - **Body** section: 9 color circles — Cloud, Mint, Sky, Rose, Classic, Night, Blue, Purple, Pink, Gold
  - **Eyes** section: 6 color circles — Mint (selected), White, Blue, Pink, Purple, Yellow
  - Below: "Seasonal outfits" section (partially visible)

### RoboIsland Component
- `settings.html` / `settings-ui.ts` → Wardrobe tab
- `robo-mascot.ts` → `SKINS` palette, `setSkin()`, `setHat()`

### Key Gaps
- **Live mascot preview** showing the full body character (not just eyes) — current Wardrobe tab only has clickable skin thumbnails
- **Outfit cards** with lock/earn mechanic — currently 5 simple hat options without progression
- **Body color circles** — current implementation uses named skin themes instead of individual body/eye color pickers
- **Eyes color circles** — should allow independent eye color selection separate from body
- **Seasonal outfits** section — not implemented

---

## Screenshot 07 — Clipboard Panel

![07_clipboard](reference_screenshots/07_clipboard.jpeg)

### What It Shows
The expanded island in the **Clipboard** tab:
- **Top strip**: Title `Clipboard` (left, cyan), eyes (center), time, battery (right), three-dot menu
- **Main content**: Empty state — `Nothing copied yet` heading, `Copy something (Ctrl + Q) and it shows up here.` subtitle
- **Bottom nav**: 10 icons, `Clipboard` selected (highlighted with label)
- Below the island: Focus Guard "Apps and sites" section visible with YouTube/TikTok/Instagram tags

### RoboIsland Component
- `canvas-engine.ts` → expanded hub, currently no dedicated Clipboard tab
- `productivity-engine.ts` → clipboard history functionality exists in backend

### Key Gaps
- **No dedicated Clipboard tab** in the island's bottom nav
- **Empty state UI** with instructional text not rendered
- **Ctrl+Q global shortcut** for clipboard capture not implemented
- The clipboard history feature exists in the backend (`tools:clipboard-get`) but has no island UI

---

## Screenshot 08 — Drag-and-Drop Target

![08_drag_and_drop](reference_screenshots/08_drag_and_drop.jpeg)

### What It Shows
The **drag-and-drop interaction** when a file is being dragged from Windows Desktop onto the island:
- The island has **expanded into a large drop zone** (~500px wide)
- **Dashed golden/yellow border** around the entire drop zone
- **Yellow tray icon** at the top center
- **Text**: `Let go, I'll catch it!` heading, `The file goes into your tray` subtitle
- **Small Robo mascot** illustration at the bottom holding a basket, with a `+ Copy` drag cursor
- Dark background, the island is positioned at the top of the screen
- Desktop icons visible behind/around it

### RoboIsland Component
- `island-window.ts` → needs to handle drag events
- `canvas-engine.ts` → needs a drop zone visual state
- `productivity-engine.ts` → file tray data management

### Key Gaps
- **This entire feature is not implemented** — no drag-and-drop detection from Windows Explorer
- Click-through windows cannot receive drag events by default in Electron — needs `setIgnoreMouseEvents(false)` or a dedicated transparent drop window
- **Drop zone visual** with dashed border and feedback text — not in the canvas engine
- **Robo mascot basket illustration** — needs to be drawn or a separate asset
- This is a critical missing feature identified in the master prompt

---

## Summary: Component-to-Screenshot Mapping

| Screenshot | RoboIsland Component | Status |
|---|---|---|
| 01 — Dashboard | Island expanded hub → canvas-engine.ts | **Partial** — no card layout, no 10-icon nav bar |
| 02 — Focus Indicator | Island compact → canvas-engine.ts | **Missing** — no circular progress ring in compact |
| 03 — File Tray | Island expanded → productivity-engine.ts | **Missing** — no File Tray tab in island |
| 04 — System Popover | Island expanded → media-engine.ts | **Missing** — no popover overlay for Wi-Fi/BT |
| 05 — Robo Settings | Settings window → settings-ui.ts | **Partial** — layout exists, details differ |
| 06 — Wardrobe | Settings window → settings-ui.ts | **Partial** — basic skin picker exists, no full body/eye color system |
| 07 — Clipboard | Island expanded → productivity-engine.ts | **Missing** — no Clipboard tab in island |
| 08 — Drag-and-Drop | island-window.ts + canvas-engine.ts | **Not Implemented** — no Windows file drag-drop |

---

> [!IMPORTANT]
> The biggest architectural insight from these screenshots is that **TwoCode's expanded island UI is HTML/CSS-based** (`mascot.html` with DOM elements, flexbox cards, SVG icons, CSS gradients), while RoboIsland's current island is **pure Canvas 2D drawing**. Reproducing these screenshots faithfully with canvas alone is extremely difficult. The implementation plan should convert the expanded island content to HTML/CSS overlaid on or replacing the canvas for the expanded state.
