const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

console.log('[RoboIsland Build] Running TypeScript compiler...');
execSync('npx tsc', { cwd: root, stdio: 'inherit' });

console.log('[RoboIsland Build] Bundling renderers with esbuild...');
const entryPoints = [
  { src: 'src/renderer/island/canvas-engine.ts', out: 'dist/renderer/island/bundle.js' },
  { src: 'src/renderer/island/chat-ui.ts', out: 'dist/renderer/island/chat-ui.bundle.js', format: 'iife' },
  { src: 'src/renderer/island/ai-monitor-ui.ts', out: 'dist/renderer/island/ai-monitor-ui.js', format: 'iife' },
  { src: 'src/renderer/island/media-ui.ts', out: 'dist/renderer/island/media-ui.js', format: 'iife' },
  { src: 'src/renderer/island/focus-ui.ts', out: 'dist/renderer/island/focus-ui.bundle.js', format: 'iife' },
  { src: 'src/renderer/island/i18n.ts', out: 'dist/renderer/island/i18n.bundle.js', format: 'iife' },
  { src: 'src/renderer/buddy/buddy-ui.ts', out: 'dist/renderer/buddy/buddy-ui.js' },
  { src: 'src/renderer/settings/settings-ui.ts', out: 'dist/renderer/settings/settings-ui.js' }
];
for (const entry of entryPoints) {
  if (fs.existsSync(path.join(root, entry.src))) {
    const fmt = entry.format ? ` --format=${entry.format}` : '';
    execSync(`npx esbuild ${entry.src} --bundle${fmt} --outfile=${entry.out}`, { cwd: root, stdio: 'inherit' });
  } else {
    console.log(`[RoboIsland Build] Skipping ${entry.src} (pending creation by peer agent)`);
  }
}

console.log('[RoboIsland Build] Copying assets & HTML templates...');
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    if (fs.statSync(s).isDirectory()) {
      copyDir(s, d);
    } else if (/\.(html|css|ps1|png|ico|json|js|woff2|cs)$/i.test(item)) {
      fs.copyFileSync(s, d);
    }
  }
}

copyDir(path.join(root, 'src', 'renderer', 'island'), path.join(root, 'dist', 'renderer', 'island'));
copyDir(path.join(root, 'src', 'renderer', 'buddy'), path.join(root, 'dist', 'renderer', 'buddy'));
copyDir(path.join(root, 'src', 'renderer', 'settings'), path.join(root, 'dist', 'renderer', 'settings'));
copyDir(path.join(root, 'src', 'renderer', 'settings-app'), path.join(root, 'dist', 'renderer', 'settings-app'));
copyDir(path.join(root, 'src', 'renderer', 'guard'), path.join(root, 'dist', 'renderer', 'guard'));
copyDir(path.join(root, 'src', 'renderer', 'locales'), path.join(root, 'dist', 'renderer', 'locales'));
copyDir(path.join(root, 'src', 'native'), path.join(root, 'dist', 'native'));
copyDir(path.join(root, 'assets'), path.join(root, 'dist', 'assets'));

// Explicitly copy plain-JS helper modules from src/main/ (not compiled by tsc)
const mainJsFiles = ['qr.js'];
const mainSrc = path.join(root, 'src', 'main');
const mainDest = path.join(root, 'dist', 'main');
if (!fs.existsSync(mainDest)) fs.mkdirSync(mainDest, { recursive: true });
for (const f of mainJsFiles) {
  const s = path.join(mainSrc, f);
  const d = path.join(mainDest, f);
  if (fs.existsSync(s)) {
    fs.copyFileSync(s, d);
    console.log(`[RoboIsland Build] Copied ${f} -> dist/main/`);
  } else {
    console.warn(`[RoboIsland Build] WARNING: ${f} not found in src/main/`);
  }
}

console.log('[RoboIsland Build] Build complete!');
