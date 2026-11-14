# RoboIsland Known Limitations & Windows Notes

## 1. Windows Transparency & Mouse Hover
- **Behavior**: On Windows, transparent frameless windows configured with `win.setIgnoreMouseEvents(true, { forward: true })` pass clicks directly to the underlying application (Desktop, browser, IDE). However, the Windows OS stops delivering standard DOM `mousemove` events to the webview while forward mode is active.
- **Solution Implemented**: RoboIsland employs a 50Hz cursor polling loop via `screen.getCursorScreenPoint()` in the main process, calculating the cursor distance to the Island's bounding rectangle. When within range, mouse events are instantly enabled (`win.setIgnoreMouseEvents(false)`) and cursor position is relayed to the canvas mascot via IPC (`companion:pointer`), ensuring responsive gaze tracking across the entire screen.

## 2. Windows Explorer File Drag and Drop
- **Behavior**: When dragging files from Windows Explorer onto a transparent Electron window, the OS may attempt to drop onto the window underneath if the drop zone does not have an active DOM surface.
- **Solution Implemented**: When the Island is in expanded mode or when a file drag is detected, `#drag-drop-overlay` activates with a solid transparent background (`rgba(10, 11, 14, 0.96)`) and explicit `dragover` / `drop` event handlers that prevent default navigation and route file paths directly to `window.roboIsland.trayAddFiles()`.

## 3. Media Session (SMTC) Support
- **Behavior**: Windows System Media Transport Controls (SMTC) provides real-time track titles and playback status for Spotify, YouTube (Edge/Chrome), iTunes, and Windows Media Player. If no application is actively playing media, Card 2 displays "Quiet - Nothing playing".
- **Solution Implemented**: Graceful fallback states ensure the music card and compact pill remain visually polished even when media is inactive.

## 4. Rollback to Legacy Canvas Expanded View
- **Mechanism**: If you ever want to revert from the HTML/CSS DOM interface to the original canvas expanded UI, edit `%APPDATA%\RoboIsland\roboisland-config.json` and change `"expandedUiMode": "dom"` to `"expandedUiMode": "canvas"`. The application will immediately switch to the original `drawExpandedContent()` canvas rendering pipeline without needing code modification or reinstallation.
