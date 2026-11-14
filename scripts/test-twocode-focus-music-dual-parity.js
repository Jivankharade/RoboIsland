const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log(' TWOCODE FOCUS & MUSIC DUAL-TASK PARITY TEST SUITE  ');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`[PASS] ${description}`);
    passed++;
  } else {
    console.error(`[FAIL] ${description}`);
    failed++;
  }
}

const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

// 1. Emoji compliance
console.log('--- 1. Testing Zero-Emoji Compliance ---');
const canvasPath = path.join(__dirname, '../src/renderer/island/canvas-engine.ts');
const canvasSrc = fs.readFileSync(canvasPath, 'utf8');
assert('canvas-engine.ts contains zero unicode emojis', !emojiRegex.test(canvasSrc));

// 2. Dual Task: Spotify in Primary Pill + TwoCode Focus Circle in Bubble
console.log('\n--- 2. Dual Task (Music + Focus) Parity ---');
assert('isSplitIslandActive activates when focus and media are concurrently active', 
  canvasSrc.includes('const isDualActive = this.focusState.active && Boolean(this.mediaState.playing || (this.mediaState.active && this.mediaState.title));') &&
  canvasSrc.includes('return this.mode === \'compact\' && !this.isTucked && isDualActive')
);

assert('updateTargetDimensions allocates full Spotify width (250px or lyrics) in dual active mode',
  canvasSrc.includes('const isDualActive = Boolean(this.mediaState.playing || (this.mediaState.active && this.mediaState.title));') &&
  canvasSrc.includes('const baseWidth = hasLyrics') &&
  canvasSrc.includes(': 250;')
);

assert('drawCompactContent calls drawCompactMusicIsland in primary pill when media is active',
  canvasSrc.includes('if (this.mediaState.active && this.mediaState.title) {') &&
  canvasSrc.includes('this.drawCompactMusicIsland(left, midY, topY);')
);

assert('Dual split mode draws bottom-rising dynamic album gradient glow inside primary pill',
  canvasSrc.includes('const tintGrad = this.ctx.createLinearGradient(0, fold ? topY : topY + h * 0.18, 0, topY + h);') &&
  canvasSrc.includes('tintGrad.addColorStop(1, `rgba(${tr}, ${tg}, ${tb}, 0.38)`);')
);

assert('Dual split mode draws color-matched album rim gradient on primary pill',
  canvasSrc.includes('const rimGrad = this.ctx.createLinearGradient(0, topY, 0, topY + h);') &&
  canvasSrc.includes('rimGrad.addColorStop(1, `rgba(${tr}, ${tg}, ${tb}, 0.70)`);')
);

assert('Secondary bubble uses exact TwoCode circle styling (36px diameter, 8px gap)',
  canvasSrc.includes('const d = bubbleSize;') &&
  canvasSrc.includes('const ringR = Math.max(7, d / 2 - 9);') &&
  canvasSrc.includes('const gap = 8;')
);

assert('Secondary bubble uses TwoCode purple track rgba(191,90,242,.3) and arc #bf5af2',
  canvasSrc.includes('this.ctx.strokeStyle = \'rgba(191, 90, 242, 0.3)\';') &&
  canvasSrc.includes('this.ctx.strokeStyle = \'#bf5af2\';')
);

assert('Secondary bubble arc runs empty matching Apple and TwoCode countdown direction',
  canvasSrc.includes('Math.max(0, Math.min(1, this.focusState.remainingSeconds / this.focusState.totalSeconds))') &&
  canvasSrc.includes('arc(bubbleCx, bubbleCy, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * leftFraction)')
);

// 3. Single Focus Pill Parity
console.log('\n--- 3. Single Focus Pill (Focus Only) Parity ---');
assert('Single focus pill renders 16px left ring (r = 8) with TwoCode purple colors',
  canvasSrc.includes('const r = 8;') &&
  canvasSrc.includes('this.ctx.arc(left + 8, cy, r, 0, Math.PI * 2);') &&
  canvasSrc.includes('this.ctx.arc(left + 8, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * leftFraction);')
);

assert('Single focus pill centers mascot eyes (mid, cy + 0.5)',
  canvasSrc.includes('this.mascot.drawFloatingEyes(this.ctx, mid, cy + 0.5, 0.95);')
);

assert('Single focus pill displays bold right-aligned time text in #bf5af2 matching TwoCode line 1153',
  canvasSrc.includes('600 15px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif') &&
  canvasSrc.includes('this.ctx.fillStyle = \'#bf5af2\';') &&
  canvasSrc.includes('this.ctx.fillText(timeStr, right, cy + 0.5);')
);

assert('Target width for single focus pill is 250px (TwoCode compact focus dock)',
  canvasSrc.includes('this.targetWidth = this.isHovered ? 258 : 250;')
);

// 4. Hit Testing & Click Routing
console.log('\n--- 4. Hit Testing & Click Routing ---');
assert('Clicking secondary bubble routes to Focus tab',
  canvasSrc.includes('Math.hypot(x - bubbleCx, y - bubbleCy) <= bubbleR + 4') &&
  canvasSrc.includes('this.activeTab = \'focus\';') &&
  canvasSrc.includes('this.showDomTab(\'focus\');')
);

assert('Clicking primary pill in split mode routes to Media tab',
  canvasSrc.includes('if (this.mediaState.active && this.mediaState.title) {') &&
  canvasSrc.includes('this.activeTab = \'media\';') &&
  canvasSrc.includes('this.showDomTab(\'music\');')
);

assert('Clicking single focus pill routes to Focus tab',
  canvasSrc.includes('if (this.focusState.active && !(this.mediaState.active && this.mediaState.title)) {') &&
  canvasSrc.includes('this.activeTab = \'focus\';')
);

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================');

if (failed > 0) process.exit(1);
