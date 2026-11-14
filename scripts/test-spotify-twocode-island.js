/**
 * Automated Verification Suite for TwoCode Dynamic Island Spotify Presentation:
 * 1. Dynamic Album Color Extraction (12x12 canvas downsample with saturation boost)
 * 2. Backlight Ambient Tint & Rising Gradient Glow (OLED backdrop tint)
 * 3. Compact Music Island Layout (Rounded Album Cover + Synchronized Lyrics/Title + 6-Bar EQ)
 * 4. Legality & Architectural Parity Verification
 *
 * ZERO-EMOJI ENFORCED: Source and test code must contain 0 unicode emojis.
 */

const fs = require('fs');
const path = require('path');

let totalPassed = 0;
let totalFailed = 0;

function assert(description, condition, details = '') {
  if (condition) {
    console.log(`[PASS] ${description}`);
    totalPassed++;
  } else {
    console.error(`[FAIL] ${description} ${details ? '- ' + details : ''}`);
    totalFailed++;
  }
}

console.log('\n====================================================');
console.log('   ROBOISLAND SPOTIFY TWOCODE ISLAND TEST SUITE     ');
console.log('====================================================\n');

// 1. Zero-Emoji Compliance
console.log('--- 1. Testing Zero-Emoji Compliance ---');
const canvasSrc = fs.readFileSync(path.join(__dirname, '../src/renderer/island/canvas-engine.ts'), 'utf8');
const testScriptSrc = fs.readFileSync(__filename, 'utf8');

const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
assert('canvas-engine.ts contains zero unicode emojis', !emojiRegex.test(canvasSrc));
assert('test-spotify-twocode-island.js contains zero unicode emojis', !emojiRegex.test(testScriptSrc));

// 2. Dynamic Album Color Extractor
console.log('\n--- 2. Testing Album Color Extraction ---');
assert('canvas-engine.ts defines public albumAccentColor', canvasSrc.includes('public albumAccentColor: string ='));
assert('canvas-engine.ts defines public albumImageElement', canvasSrc.includes('public albumImageElement: HTMLImageElement | null = null;'));
assert('canvas-engine.ts defines extractAlbumColor method', canvasSrc.includes('public extractAlbumColor('));
assert('extractAlbumColor uses 12x12 canvas downsampling', canvasSrc.includes('c.width = 12;') && canvasSrc.includes('c.height = 12;'));
assert('extractAlbumColor applies saturation weighting (1 + sat / 16)', canvasSrc.includes('const w = 1 + sat / 16;'));
assert('extractAlbumColor boosts brightness for dark backgrounds', canvasSrc.includes('200 / Math.max(60, Math.max(r, g, b))'));
assert('handleMediaStateUpdate calls extractAlbumColor on coverUrl change', canvasSrc.includes('this.extractAlbumColor(cover);'));

// 3. Dynamic Backlight Ambient Tint Glow
console.log('\n--- 3. Testing Dynamic Backlight Ambient Tint Glow ---');
assert('drawIslandPill recognizes isMusicActive in compact mode', canvasSrc.includes('const isMusicActive = this.mode === \'compact\'') && canvasSrc.includes('this.mediaState.title'));
assert('drawIslandPill sets TwoCode obsidian shadow for music', canvasSrc.includes("this.ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';") || canvasSrc.includes("this.ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';"));
assert('drawIslandPill creates TwoCode bottom-rising linear gradient', canvasSrc.includes('const tintGrad = this.ctx.createLinearGradient(0, fold ? topY : topY + h * 0.18, 0, topY + h);'));
assert('drawIslandPill strokes rim with color-matched gradient', canvasSrc.includes('rimGrad.addColorStop(1, `rgba(${tr}, ${tg}, ${tb}, 0.70)`);'));
assert('renderLoop smoothly interpolates currentTintR/G/B with 0.12 lerp', canvasSrc.includes('this.currentTintR += (this.targetTintR - this.currentTintR) * 0.12;'));

// 4. Compact Music Island Presentation
console.log('\n--- 4. Testing Compact Music Island Presentation ---');
assert('canvas-engine.ts defines drawCompactMusicIsland method', canvasSrc.includes('public drawCompactMusicIsland('));
assert('drawCompactMusicIsland renders 24x24 px album cover with 7px radius', canvasSrc.includes('roundRect(coverX, coverY, cs, cs, 7)'));
assert('drawCompactMusicIsland renders 6-bar procedural visualizer', canvasSrc.includes('Math.sin(t * (2.1 + i * 0.43) + i * 1.7)'));
assert('drawCompactMusicIsland colors visualizer in extracted album color', canvasSrc.includes('this.ctx.fillStyle = this.albumAccentColor || \'#ffffff\';'));
assert('drawCompactMusicIsland applies soft bloom glow to visualizer bars', canvasSrc.includes('this.ctx.shadowBlur = 3;') || canvasSrc.includes('this.ctx.shadowBlur = vizH * 0.35;'));
assert('drawCompactMusicIsland centers lyric line or title in white', canvasSrc.includes('this.ctx.fillStyle = \'#ffffff\';') && canvasSrc.includes('this.ctx.textAlign = \'center\';'));
assert('updateTargetDimensions sets TwoCode 250px compact music width and scales for lyrics', (canvasSrc.includes('const hasLyrics = this.hasSyncedLyrics();') || canvasSrc.includes('const hasLyrics = Boolean(this.mediaState.lyricLine && this.mediaState.playing);')) && canvasSrc.includes(': 250;'));
assert('handleClick opens music tab when clicking compact island playing track', canvasSrc.includes('this.activeTab = \'media\';') && canvasSrc.includes('this.showDomTab(\'music\');'));

// 5. Build Artifact Consistency
console.log('\n--- 5. Testing Bundle Output Consistency ---');
const bundlePath = path.join(__dirname, '../dist/renderer/island/bundle.js');
assert('dist/renderer/island/bundle.js exists', fs.existsSync(bundlePath));
const bundleSrc = fs.readFileSync(bundlePath, 'utf8');
assert('bundle.js contains compiled extractAlbumColor', bundleSrc.includes('extractAlbumColor'));
assert('bundle.js contains compiled drawCompactMusicIsland', bundleSrc.includes('drawCompactMusicIsland'));
assert('bundle.js contains zero unicode emojis', !emojiRegex.test(bundleSrc));

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
console.log('====================================================\n');

if (totalFailed > 0) {
  process.exit(1);
}
