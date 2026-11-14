# RoboIsland — Hybrid Architecture Implementation Plan

## Architectural Principles
1. **Canvas Engine Intact**: The existing Canvas mascot and 116×32 resting island with animated blinking capsule eyes remain the primary rendering surface for resting, compact, physics animations, and mascot expressions.
2. **Hybrid HTML/CSS Layer**: An HTML/CSS overlay (`#expanded-island-overlay`) is introduced for the expanded Dynamic Island interface (cards, 10-icon bottom nav, File Tray shelf, Clipboard list, and System popovers).
3. **Seamless Synchronization**: Canvas tracks geometry and spring physics; HTML overlay syncs its bounding box, active view, and events directly with `canvas-engine.ts`.
4. **Zero Duplication**: Existing IPC handlers (`media-engine`, `productivity-engine`, `ai-monitor-hub`, `config-store`) remain the single source of truth.

---

## Files to be Modified and Rationale

| File | Proposed Change | Reason / Reference Screenshot |
|---|---|---|
| `src/renderer/island/index.html` | Add `#expanded-island-overlay` with semantic markup for status bar, content views (Home cards, Tray, Clipboard, System popover), and 10-icon bottom nav. | Screenshots 01, 03, 04, 07, 08 |
| `src/renderer/island/island.css` | Add styling for cards, gradients, bottom nav pill, drag-drop dashed border, and system popover. | Screenshots 01, 03, 04, 07, 08 |
| `src/renderer/island/canvas-engine.ts` | 1. Implement Screenshot 02 in `drawCompactContent()` (circular progress ring + capsule eyes + timer).<br>2. Keep resting & compact canvas untouched.<br>3. Toggle `#expanded-island-overlay` when switching between compact and expanded modes.<br>4. Wire event handlers for HTML tab switching and actions. | Screenshots 01, 02, 03, 04, 07, 08 |
| `src/preload/island-preload.ts` | Expose drag-drop file receipt and clipboard paste triggers to renderer. | Screenshots 03, 07, 08 |
| `src/main/island-window.ts` | Support file drag-enter/leave/drop IPC and geometry sync. | Screenshot 08 |
| `src/renderer/settings/settings.html` | Add traffic-light eyes color pickers to Robo page; add body & eye color palettes and outfit cards to Wardrobe. | Screenshots 05, 06 |
| `src/renderer/settings/settings.css` | Style color swatches, outfit cards, and traffic light eye pickers. | Screenshots 05, 06 |
| `src/renderer/settings/settings-ui.ts` | Wire persistence for traffic-light eye colors, body colors, and outfit selection. | Screenshots 05, 06 |

---

## Implementation Steps
1. **Step 1 — Compact Focus Indicator (Screenshot 02)**: Add circular progress arc + timer to `canvas-engine.ts`'s `drawCompactContent()`.
2. **Step 2 — Hybrid HTML/CSS Expanded Island (Screenshots 01, 03, 04, 07)**:
   - Construct overlay markup in `index.html`.
   - Implement styles in `island.css`.
   - Wire view switching (Home, AI, Music, Chat, Focus, Tray, Clipboard, Notes, System) in `canvas-engine.ts`.
3. **Step 3 — System Popover (Screenshot 04)**: Add click handler on status-bar Wi-Fi/BT icon to toggle interactive Wi-Fi/Bluetooth popover.
4. **Step 4 — Windows File Drag-and-Drop (Screenshot 08)**: Add dragover/dragleave/drop handlers with the golden dashed border feedback state and automatic File Tray insertion.
5. **Step 5 — Settings Dashboard Refinements (Screenshots 05 & 06)**: Update Robo and Wardrobe tabs with traffic-light eye controls, body colors, and outfits.
6. **Step 6 — Verify & Test**: Compile, test with real file drop and media playback, capture screenshots, and package.
