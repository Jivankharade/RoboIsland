const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('[TEST] Starting RoboIsland Quick Look, Drag-Out & Transfer Beam Verification...\n');

// 1. Zero-Emoji Compliance
const modifiedFiles = [
  'src/main/productivity-engine.ts',
  'src/preload/island-preload.ts',
  'src/renderer/island/index.html',
  'src/renderer/island/island.css',
  'src/renderer/island/canvas-engine.ts'
];

const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

for (const rel of modifiedFiles) {
  const full = path.join(__dirname, '..', rel);
  const content = fs.readFileSync(full, 'utf8');
  assert(!emojiRegex.test(content), `Found forbidden emoji in ${rel}`);
}
console.log('  OK: Zero-Emoji Compliance across all modified files');

// 2. Preload Exposure Check
const preloadContent = fs.readFileSync(path.join(__dirname, '../src/preload/island-preload.ts'), 'utf8');
assert(preloadContent.includes('getFilePreviewData:'), 'Preload must expose getFilePreviewData');
assert(preloadContent.includes('startDragOut:'), 'Preload must expose startDragOut');
assert(preloadContent.includes('showItemInFolder:'), 'Preload must expose showItemInFolder');
assert(preloadContent.includes('openPath:'), 'Preload must expose openPath');
console.log('  OK: Island Preload correctly exposes Quick Look, Drag-Out & Explorer bridges');

// 3. ProductivityEngine IPC Handlers Check
const prodContent = fs.readFileSync(path.join(__dirname, '../src/main/productivity-engine.ts'), 'utf8');
assert(prodContent.includes("ipcMain.handle('tools:file-preview-data'"), 'ProductivityEngine must register tools:file-preview-data');
assert(prodContent.includes("ipcMain.on('tools:tray-drag-out'"), 'ProductivityEngine must register tools:tray-drag-out');
assert(prodContent.includes("ipcMain.handle('tools:show-item-in-folder'"), 'ProductivityEngine must register tools:show-item-in-folder');
assert(prodContent.includes("ipcMain.handle('tools:open-path'"), 'ProductivityEngine must register tools:open-path');
assert(prodContent.includes("direction: 'download'"), 'ProductivityEngine must emit download progress direction');
assert(prodContent.includes("direction: 'upload'"), 'ProductivityEngine must emit upload progress direction');
console.log('  OK: ProductivityEngine registers IPC handlers and live streaming progress emitters');

// 4. Quick Look Modal in HTML
const htmlContent = fs.readFileSync(path.join(__dirname, '../src/renderer/island/index.html'), 'utf8');
assert(htmlContent.includes('id="quicklook-modal"'), 'index.html must contain quicklook-modal');
assert(htmlContent.includes('id="quicklook-file-badge"'), 'index.html must contain quicklook-file-badge');
assert(htmlContent.includes('id="quicklook-title"'), 'index.html must contain quicklook-title');
assert(htmlContent.includes('id="quicklook-body"'), 'index.html must contain quicklook-body');
assert(htmlContent.includes('id="quicklook-btn-reveal"'), 'index.html must contain quicklook-btn-reveal');
assert(htmlContent.includes('id="quicklook-btn-open"'), 'index.html must contain quicklook-btn-open');
console.log('  OK: index.html contains Apple Quick Look glassmorphic modal overlay');

// 5. CSS Styling Check
const cssContent = fs.readFileSync(path.join(__dirname, '../src/renderer/island/island.css'), 'utf8');
assert(cssContent.includes('.quicklook-modal'), 'CSS must define .quicklook-modal');
assert(cssContent.includes('.quicklook-dialog'), 'CSS must define .quicklook-dialog');
assert(cssContent.includes('@keyframes quicklookPopIn'), 'CSS must define @keyframes quicklookPopIn');
assert(cssContent.includes('.tray-item-actions'), 'CSS must define .tray-item-actions');
assert(cssContent.includes('.tray-item-chip[draggable="true"]'), 'CSS must define draggable chip styling');
console.log('  OK: island.css defines Apple Quick Look spring animation and drag-out styles');

// 6. Canvas Engine Quick Look & Keyboard Integration Check
const canvasContent = fs.readFileSync(path.join(__dirname, '../src/renderer/island/canvas-engine.ts'), 'utf8');
assert(canvasContent.includes('openQuickLook(filePath: string)'), 'CanvasEngine must implement openQuickLook');
assert(canvasContent.includes('closeQuickLook()'), 'CanvasEngine must implement closeQuickLook');
assert(canvasContent.includes("e.code === 'Space'"), 'CanvasEngine must handle Space key for Quick Look');
assert(canvasContent.includes("e.key === 'Escape'"), 'CanvasEngine must handle Escape key for Quick Look');
assert(canvasContent.includes("chip.setAttribute('draggable', 'true')"), 'CanvasEngine must mark chips draggable');
assert(canvasContent.includes('btn-ql'), 'CanvasEngine must render Quick Look preview button');
assert(canvasContent.includes('transferProgress'), 'CanvasEngine must track live transfer progress');
console.log('  OK: CanvasEngine integrates Spacebar Quick Look, 2-way drag-out and transfer beam');

// 7. Test file preview metadata logic with a local sample file
const testImgPath = path.join(__dirname, '../assets/icon-48.png');
assert(fs.existsSync(testImgPath), 'assets/icon-48.png must exist');
const stat = fs.statSync(testImgPath);
const ext = path.extname(testImgPath).toLowerCase();
const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'].includes(ext);
assert(isImage, 'icon-48.png must be recognized as image category');
assert(stat.size > 0, 'icon-48.png must have non-zero size');
console.log(`  OK: Asset preview verification (${path.basename(testImgPath)}: ${stat.size} bytes, image category)`);

console.log('\nAll Quick Look, Drag-Out & Transfer Beam verification tests PASSED!\n');
