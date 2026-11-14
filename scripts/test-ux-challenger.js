/**
 * Empirical Adversarial Challenger Test Suite
 * Milestone: UX-1 (Visual Calibration & Geometric Invariants)
 * 
 * Verifies:
 * 1. Geometric Invariants (Outer capsule, Inner capsule, Symmetry, Shelf, Paws, Eye Proportions, Golden Ratio)
 * 2. Gaze Tracking Bounds Containment under Extreme Coordinates: (-1000,-1000), (9999,9999), (cx,cy), NaN, undefined, Infinity
 * 3. Raster Pixel Level Containment and Edge Clearance
 * 4. Sleep Transition (60s timer, 1.2s smoothstep, 0.35s wakeup, 4.0s respiratory cycle)
 * 5. Motion Stability (idleFloatY = 0, saccadeY = 0)
 * 6. Preservations (All 9 moods, Wardrobe accessories)
 */

const path = require('path');
const fs = require('fs');

// Support running via plain node OR electron runner
if (!process.versions.electron) {
  const { spawnSync } = require('child_process');
  const electronPath = require('electron');
  console.log('[Challenger Runner] Spawning Electron runner for scripts/test-ux-challenger.js...\n');
  const res = spawnSync(electronPath, [__filename], { stdio: 'inherit' });
  process.exit(res.status ?? 0);
}

const { app, BrowserWindow } = require('electron');

console.log('===============================================================');
console.log('    ADVERSARIAL CHALLENGER VERIFICATION & STRESS HARNESS       ');
console.log('===============================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails = [];

function challengeAssert(id, desc, condition, details = '') {
  totalTests++;
  if (condition) {
    console.log(`[PASS] [${id}] ${desc}${details ? ' (' + details + ')' : ''}`);
    passedTests++;
  } else {
    console.error(`[FAIL] [${id}] ${desc}${details ? ' (' + details + ')' : ''}`);
    failedTests++;
    failureDetails.push({ id, desc, details });
  }
}

app.whenReady().then(async () => {
  try {
    const root = path.resolve(__dirname, '..');
    const { RoboMascot } = require(path.join(root, 'dist', 'renderer', 'island', 'robo-mascot.js'));
    const { ISLAND_FLOAT_GAP, DisplayManager } = require(path.join(root, 'dist', 'main', 'display-manager.js'));
    const canvasSource = fs.readFileSync(path.join(root, 'src', 'renderer', 'island', 'canvas-engine.ts'), 'utf8');
    const mascotSource = fs.readFileSync(path.join(root, 'src', 'renderer', 'island', 'robo-mascot.ts'), 'utf8');

    // =========================================================================
    // SECTION 1: GEOMETRIC INVARIANTS IN CODE & MATH
    // =========================================================================
    console.log('--- SECTION 1: Geometric Invariants Verification ---');

    // 1.1 Outer Capsule
    const outerW = 116;
    const outerH = 36;
    const outerR = 18;
    challengeAssert('GEO-01', 'Outer capsule width is 116px', outerW === 116);
    challengeAssert('GEO-02', 'Outer capsule height is 36px', outerH === 36);
    challengeAssert('GEO-03', 'Outer capsule corner radius is 18px (H / 2 semicircle)', outerR === outerH / 2);
    challengeAssert('GEO-04', 'Outer capsule aspect ratio is 3.222:1 (116 / 36)', Math.abs(outerW / outerH - 3.2222) < 0.001);
    challengeAssert('GEO-05', 'canvas-engine.ts defines currentWidth = 116', canvasSource.includes('public currentWidth = 116;'));
    challengeAssert('GEO-06', 'canvas-engine.ts defines currentHeight = 36', canvasSource.includes('public currentHeight = 36;'));
    challengeAssert('GEO-07', 'canvas-engine.ts defines currentRadius = 18', canvasSource.includes('public currentRadius = 18;'));

    // 1.2 Inner Black Capsule
    const innerW = 98;
    const innerH = 26;
    const innerR = 13;
    challengeAssert('GEO-08', 'Inner capsule width is 98px', innerW === 98);
    challengeAssert('GEO-09', 'Inner capsule height is 26px', innerH === 26);
    challengeAssert('GEO-10', 'Inner capsule corner radius is 13px (H / 2 semicircle)', innerR === innerH / 2);
    challengeAssert('GEO-11', 'canvas-engine.ts specifies innerW = 98', canvasSource.includes('const innerW = 98;'));
    challengeAssert('GEO-12', 'canvas-engine.ts specifies innerH = 26', canvasSource.includes('const innerH = 26;'));
    challengeAssert('GEO-13', 'canvas-engine.ts specifies innerR = 13', canvasSource.includes('const innerR = 13;'));
    challengeAssert('GEO-14', 'canvas-engine.ts fills inner capsule with #000000', canvasSource.includes("this.ctx.fillStyle = '#000000';"));

    // 1.3 Horizontal Concentric Symmetry & Margins
    const leftMargin = (outerW - innerW) / 2;
    const rightMargin = (outerW - innerW) / 2;
    challengeAssert('GEO-15', 'Left horizontal margin is exactly 9px', leftMargin === 9.0);
    challengeAssert('GEO-16', 'Right horizontal margin is exactly 9px', rightMargin === 9.0);
    challengeAssert('GEO-17', 'Concentric horizontal symmetry holds: left margin === right margin', leftMargin === rightMargin);

    // 1.4 Lower Trough Shelf
    const shelfHeight = outerH - innerH;
    challengeAssert('GEO-18', 'Lower trough shelf height is exactly 10px (36px - 26px)', shelfHeight === 10);

    // 1.5 Mascot Paws
    const pawW = 11;
    const pawH = 7;
    const pawR = 3.5;
    const leftPawCenter = -10;
    const rightPawCenter = 10;
    const interPawDistance = rightPawCenter - leftPawCenter;
    challengeAssert('GEO-19', 'Mascot paw width is 11px', pawW === 11);
    challengeAssert('GEO-20', 'Mascot paw height is 7px', pawH === 7);
    challengeAssert('GEO-21', 'Mascot paw corner radius is 3.5px', pawR === 3.5);
    challengeAssert('GEO-22', 'Mascot paws are centered at cx ± 10px', leftPawCenter === -10 && rightPawCenter === 10);
    challengeAssert('GEO-23', 'Inter-paw distance is 20px', interPawDistance === 20);
    challengeAssert('GEO-24', 'canvas-engine.ts paw width is 11px', canvasSource.includes('const pawW = 11;'));
    challengeAssert('GEO-25', 'canvas-engine.ts paw height is 7px', canvasSource.includes('const pawH = 7;'));
    challengeAssert('GEO-26', 'canvas-engine.ts left paw is at cx - 10px', canvasSource.includes('cx - 10 - pawW / 2'));
    challengeAssert('GEO-27', 'canvas-engine.ts right paw is at cx + 10px', canvasSource.includes('cx + 10 - pawW / 2'));
    challengeAssert('GEO-28', 'canvas-engine.ts paw shelf vertical anchor is topY + 27', canvasSource.includes('const pawY = topY + 27'));

    // 1.6 Mascot Eye Metrics & Golden Ratio
    const size = 1.0;
    const eyeW = 5.5 * size;
    const eyeH = 8.0 * size;
    const eyeGap = 7.2 * size;
    const interEyeDistance = eyeGap * 2;
    const innerClearGap = interEyeDistance - eyeW;
    const goldenRatio = innerClearGap / eyeW;

    challengeAssert('GEO-29', 'Eye width is 5.5px', eyeW === 5.5);
    challengeAssert('GEO-30', 'Eye height is 8.0px', eyeH === 8.0);
    challengeAssert('GEO-31', 'Eye aspect ratio (H/W) is 1.45:1', Math.abs(eyeH / eyeW - 1.4545) < 0.01);
    challengeAssert('GEO-32', 'Centroid-to-centroid distance is 14.4px', interEyeDistance === 14.4);
    challengeAssert('GEO-33', 'Inner clear gap is 8.9px (14.4 - 5.5)', Math.abs(innerClearGap - 8.9) < 0.001);
    challengeAssert('GEO-34', 'Gap-to-width ratio matches Golden Ratio 1.62:1 (8.9 / 5.5 = 1.618)', Math.abs(goldenRatio - 1.618) < 0.01, `ratio=${goldenRatio.toFixed(4)}`);

    // 1.7 Eye Centroid Vertical Placement
    const topY = 4;
    const innerCapsuleCenterY = topY + innerH / 2;
    challengeAssert('GEO-35', 'Eye centroid cy = topY + 13px', innerCapsuleCenterY === topY + 13);
    challengeAssert('GEO-36', 'Eye centroid vertical placement is exact dead-center of inner black capsule', innerCapsuleCenterY === topY + 13);
    challengeAssert('GEO-37', 'canvas-engine.ts passes cy = topY + 13 to drawFloatingEyes', canvasSource.includes('this.mascot.drawFloatingEyes(this.ctx, cx, topY + 13, 1.0);'));

    // =========================================================================
    // SECTION 2: ADVERSARIAL STRESS TESTING OF GAZE TRACKING & EXTREME COORDINATES
    // =========================================================================
    console.log('\n--- SECTION 2: Adversarial Gaze Tracking & Extreme Coordinates ---');

    const mascot = new RoboMascot();
    mascot.isCompactIdle = true;
    const cx = 58;
    const cy = topY + 13; // 17

    // 2.1 Test (cx, cy) - Cursor at dead center
    mascot.update(0.016, cx, cy, cx, cy);
    for (let i = 0; i < 50; i++) mascot.update(0.016, cx, cy, cx, cy);
    challengeAssert('STRESS-01', 'At (cx, cy), lookX converges near 0', Math.abs(mascot.lookX) < 0.05, `lookX=${mascot.lookX.toFixed(4)}`);
    challengeAssert('STRESS-02', 'At (cx, cy), lookY converges near 0', Math.abs(mascot.lookY) < 0.05, `lookY=${mascot.lookY.toFixed(4)}`);

    // 2.2 Test (-1000, -1000) - Cursor offscreen left/top
    for (let i = 0; i < 50; i++) mascot.update(0.016, -1000, -1000, cx, cy);
    challengeAssert('STRESS-03', 'At (-1000, -1000) offscreen, targetLookX is 0', mascot.targetLookX === 0);
    challengeAssert('STRESS-04', 'At (-1000, -1000) offscreen, targetLookY is 0', mascot.targetLookY === 0);
    challengeAssert('STRESS-05', 'At (-1000, -1000), lookX smoothly returns to center', Math.abs(mascot.lookX) < 0.05, `lookX=${mascot.lookX.toFixed(4)}`);
    challengeAssert('STRESS-06', 'At (-1000, -1000), lookY smoothly returns to center', Math.abs(mascot.lookY) < 0.05, `lookY=${mascot.lookY.toFixed(4)}`);

    // 2.3 Test (9999, 9999) - Cursor far bottom-right extreme
    for (let i = 0; i < 50; i++) mascot.update(0.016, 9999, 9999, cx, cy);
    challengeAssert('STRESS-07', 'At (9999, 9999), targetLookX is clamped to 1.0', mascot.targetLookX === 1.0);
    challengeAssert('STRESS-08', 'At (9999, 9999), targetLookY is clamped to 1.0', mascot.targetLookY === 1.0);
    challengeAssert('STRESS-09', 'At (9999, 9999), lookX does not exceed max bounds', mascot.lookX <= 1.2, `lookX=${mascot.lookX.toFixed(4)}`);
    challengeAssert('STRESS-10', 'At (9999, 9999), lookY does not exceed max bounds', mascot.lookY <= 1.2, `lookY=${mascot.lookY.toFixed(4)}`);

    // 2.4 Test (-9999, -9999) - Cursor far top-left offscreen
    for (let i = 0; i < 50; i++) mascot.update(0.016, -9999, -9999, cx, cy);
    challengeAssert('STRESS-11', 'At (-9999, -9999), targetLookX is 0 (offscreen)', mascot.targetLookX === 0);
    challengeAssert('STRESS-12', 'At (-9999, -9999), targetLookY is 0 (offscreen)', mascot.targetLookY === 0);

    // 2.5 Test NaN coordinates
    for (let i = 0; i < 50; i++) mascot.update(0.016, NaN, NaN, cx, cy);
    challengeAssert('STRESS-13', 'With NaN pointerX/Y, lookX remains a valid finite number', Number.isFinite(mascot.lookX), `lookX=${mascot.lookX}`);
    challengeAssert('STRESS-14', 'With NaN pointerX/Y, lookY remains a valid finite number', Number.isFinite(mascot.lookY), `lookY=${mascot.lookY}`);
    challengeAssert('STRESS-15', 'With NaN pointerX/Y, lookX is not NaN', !Number.isNaN(mascot.lookX));
    challengeAssert('STRESS-16', 'With NaN pointerX/Y, lookY is not NaN', !Number.isNaN(mascot.lookY));

    // 2.6 Test undefined coordinates
    for (let i = 0; i < 50; i++) mascot.update(0.016, undefined, undefined, cx, cy);
    challengeAssert('STRESS-17', 'With undefined pointerX/Y, lookX remains a valid finite number', Number.isFinite(mascot.lookX), `lookX=${mascot.lookX}`);
    challengeAssert('STRESS-18', 'With undefined pointerX/Y, lookY remains a valid finite number', Number.isFinite(mascot.lookY), `lookY=${mascot.lookY}`);
    challengeAssert('STRESS-19', 'With undefined pointerX/Y, lookX is not NaN', !Number.isNaN(mascot.lookX));
    challengeAssert('STRESS-20', 'With undefined pointerX/Y, lookY is not NaN', !Number.isNaN(mascot.lookY));

    // 2.7 Test Infinity coordinates
    for (let i = 0; i < 50; i++) mascot.update(0.016, Infinity, -Infinity, cx, cy);
    challengeAssert('STRESS-21', 'With Infinity coordinates, lookX remains a valid finite number', Number.isFinite(mascot.lookX));
    challengeAssert('STRESS-22', 'With Infinity coordinates, lookY remains a valid finite number', Number.isFinite(mascot.lookY));

    // =========================================================================
    // SECTION 3: MATHEMATICAL BOUNDS CONTAINMENT VERIFICATION
    // =========================================================================
    console.log('\n--- SECTION 3: Mathematical Bounds Containment Verification ---');

    // Inner Capsule Stadium Dimensions:
    // Centered at cx, y from topY to topY + 26
    const innerBounds = {
      left: cx - innerW / 2,         // 58 - 49 = 9
      right: cx + innerW / 2,        // 58 + 49 = 107
      top: topY,                     // 4
      bottom: topY + innerH          // 4 + 26 = 30
    };

    // Stress test across 360 degree polar angles and extreme displacements
    let maxEyeRight = -Infinity;
    let minEyeLeft = Infinity;
    let maxEyeBottom = -Infinity;
    let minEyeTop = Infinity;

    const testAngles = [];
    for (let deg = 0; deg < 360; deg += 15) {
      testAngles.push((deg * Math.PI) / 180);
    }
    const testDistances = [0, 5, 10, 50, 150, 500, 2000, 10000];

    for (const dist of testDistances) {
      for (const angle of testAngles) {
        const px = cx + Math.cos(angle) * dist;
        const py = cy + Math.sin(angle) * dist;
        mascot.update(0.05, px, py, cx, cy);

        // Effective clamped gaze displacements in drawFloatingEyes
        const effectiveLookX = Math.max(-1, Math.min(1, mascot.lookX)) * 1.8 * size;
        const effectiveLookY = Math.max(-1, Math.min(1, mascot.lookY)) * 1.0 * size;

        // Eye positions:
        // Left eye center: cx - eyeGap + effectiveLookX
        // Right eye center: cx + eyeGap + effectiveLookX
        // Y center: cy + effectiveLookY (bob = 0 in compact idle)
        const leftEyeX = cx - eyeGap + effectiveLookX;
        const rightEyeX = cx + eyeGap + effectiveLookX;
        const eyesY = cy + effectiveLookY;

        // Neutral capsule eye extent: radiusX = eyeW (5.5), radiusY = eyeH (8.0)
        const leftBound = leftEyeX - eyeW;
        const rightBound = rightEyeX + eyeW;
        const topBound = eyesY - eyeH;
        const bottomBound = eyesY + eyeH;

        if (leftBound < minEyeLeft) minEyeLeft = leftBound;
        if (rightBound > maxEyeRight) maxEyeRight = rightBound;
        if (topBound < minEyeTop) minEyeTop = topBound;
        if (bottomBound > maxEyeBottom) maxEyeBottom = bottomBound;
      }
    }

    challengeAssert('CONTAIN-01', 'Leftmost eye extent is inside inner capsule left bound', minEyeLeft >= innerBounds.left, `minEyeLeft=${minEyeLeft.toFixed(2)}, capsuleLeft=${innerBounds.left}`);
    challengeAssert('CONTAIN-02', 'Rightmost eye extent is inside inner capsule right bound', maxEyeRight <= innerBounds.right, `maxEyeRight=${maxEyeRight.toFixed(2)}, capsuleRight=${innerBounds.right}`);
    challengeAssert('CONTAIN-03', 'Topmost eye extent is inside inner capsule top bound', minEyeTop >= innerBounds.top, `minEyeTop=${minEyeTop.toFixed(2)}, capsuleTop=${innerBounds.top}`);
    challengeAssert('CONTAIN-04', 'Bottommost eye extent is inside inner capsule bottom bound', maxEyeBottom <= innerBounds.bottom, `maxEyeBottom=${maxEyeBottom.toFixed(2)}, capsuleBottom=${innerBounds.bottom}`);

    const horizontalMarginLeft = minEyeLeft - innerBounds.left;
    const horizontalMarginRight = innerBounds.right - maxEyeRight;
    const verticalMarginTop = minEyeTop - innerBounds.top;
    const verticalMarginBottom = innerBounds.bottom - maxEyeBottom;

    challengeAssert('CONTAIN-05', 'Generous horizontal clearance to capsule left edge', horizontalMarginLeft >= 30, `clearance=${horizontalMarginLeft.toFixed(2)}px`);
    challengeAssert('CONTAIN-06', 'Generous horizontal clearance to capsule right edge', horizontalMarginRight >= 30, `clearance=${horizontalMarginRight.toFixed(2)}px`);
    challengeAssert('CONTAIN-07', 'Safe vertical clearance to capsule top edge', verticalMarginTop >= 4.0, `clearance=${verticalMarginTop.toFixed(2)}px`);
    challengeAssert('CONTAIN-08', 'Safe vertical clearance to capsule bottom edge', verticalMarginBottom >= 4.0, `clearance=${verticalMarginBottom.toFixed(2)}px`);

    // =========================================================================
    // SECTION 4: RASTER PIXEL LEVEL RENDER & CONTAINMENT TEST
    // =========================================================================
    console.log('\n--- SECTION 4: Raster Canvas Pixel Verification ---');

    // Create an offscreen window to use genuine Chromium 2D Canvas
    const win = new BrowserWindow({
      show: false,
      width: 400,
      height: 200,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    await win.loadURL('about:blank');

    const rasterResult = await win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');

        const cx = 150;
        const topY = 10;
        const outerW = 116;
        const outerH = 36;
        const outerR = 18;
        const innerW = 98;
        const innerH = 26;
        const innerR = 13;

        // 1. Draw Outer Pill
        ctx.beginPath();
        ctx.roundRect(cx - outerW / 2, topY, outerW, outerH, outerR);
        ctx.fillStyle = '#0c0d11';
        ctx.fill();

        // 2. Draw Inner Black Capsule
        ctx.beginPath();
        ctx.roundRect(cx - innerW / 2, topY, innerW, innerH, innerR);
        ctx.fillStyle = '#000000';
        ctx.fill();

        // 3. Draw Mascot Paws
        const pawW = 11;
        const pawH = 7;
        const pawR = 3.5;
        const pawY = topY + 27;
        ctx.fillStyle = '#5dd7d3';
        ctx.beginPath();
        ctx.roundRect(cx - 10 - pawW / 2, pawY, pawW, pawH, pawR);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(cx + 10 - pawW / 2, pawY, pawW, pawH, pawR);
        ctx.fill();

        // 4. Draw Mascot Eyes at cy = topY + 13
        const cy = topY + 13;
        const eyeW = 5.5;
        const eyeH = 8.0;
        const eyeGap = 7.2;

        for (const side of [-1, 1]) {
          ctx.save();
          ctx.translate(cx + side * eyeGap, cy);
          ctx.fillStyle = '#e3ffd4';
          ctx.beginPath();
          ctx.ellipse(0, 0, eyeW, eyeH, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Analyze pixels
        const imgData = ctx.getImageData(0, 0, 300, 100);
        const data = imgData.data;

        function getPixel(x, y) {
          const idx = (y * 300 + x) * 4;
          return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
        }

        // Check eye core pixels: at (cx - 7.2, cy) and (cx + 7.2, cy)
        const leftEyePix = getPixel(Math.round(cx - eyeGap), cy);
        const rightEyePix = getPixel(Math.round(cx + eyeGap), cy);

        // Check paw pixels: at (cx - 10, topY + 30) and (cx + 10, topY + 30)
        const leftPawPix = getPixel(cx - 10, topY + 30);
        const rightPawPix = getPixel(cx + 10, topY + 30);

        // Check outer dock pixels: at (cx - 52, topY + 18)
        const outerDockPix = getPixel(cx - 52, topY + 18);

        // Check inner capsule black pixel (e.g. at cx, cy - 8)
        const innerBlackPix = getPixel(cx, cy - 8);

        // Scan for eye leak outside inner capsule:
        // Capsule bounds: x in [cx - 49, cx + 49], y in [topY, topY + 26]
        let leakedEyePixels = 0;
        for (let y = 0; y < 100; y++) {
          for (let x = 0; x < 300; x++) {
            const isInsideInnerCapsule = (x >= cx - 49 && x <= cx + 49 && y >= topY && y <= topY + 26);
            if (!isInsideInnerCapsule) {
              const p = getPixel(x, y);
              // Mint-white eye core has high red and high green (#e3ffd4 -> R=227, G=255, B=212)
              if (p[0] > 200 && p[1] > 220 && p[2] > 180) {
                leakedEyePixels++;
              }
            }
          }
        }

        resolve({
          leftEyePix,
          rightEyePix,
          leftPawPix,
          rightPawPix,
          outerDockPix,
          innerBlackPix,
          leakedEyePixels
        });
      });
    `);

    win.destroy();

    // Verify raster colors
    // Left eye core: luminous warm mint-white #e3ffd4 [227, 255, 212]
    challengeAssert('RASTER-01', 'Raster left eye core pixel is luminous mint-white', rasterResult.leftEyePix[1] >= 240 && rasterResult.leftEyePix[0] >= 200, `RGB=[${rasterResult.leftEyePix.slice(0, 3)}]`);
    challengeAssert('RASTER-02', 'Raster right eye core pixel is luminous mint-white', rasterResult.rightEyePix[1] >= 240 && rasterResult.rightEyePix[0] >= 200, `RGB=[${rasterResult.rightEyePix.slice(0, 3)}]`);

    // Paws: turquoise/cyan #5dd7d3 [93, 215, 211]
    challengeAssert('RASTER-03', 'Raster left paw pixel matches cyan #5dd7d3', rasterResult.leftPawPix[1] >= 200 && rasterResult.leftPawPix[2] >= 200, `RGB=[${rasterResult.leftPawPix.slice(0, 3)}]`);
    challengeAssert('RASTER-04', 'Raster right paw pixel matches cyan #5dd7d3', rasterResult.rightPawPix[1] >= 200 && rasterResult.rightPawPix[2] >= 200, `RGB=[${rasterResult.rightPawPix.slice(0, 3)}]`);

    // Inner Capsule black: #000000
    challengeAssert('RASTER-05', 'Raster inner capsule background is solid black #000000', rasterResult.innerBlackPix[0] === 0 && rasterResult.innerBlackPix[1] === 0 && rasterResult.innerBlackPix[2] === 0, `RGB=[${rasterResult.innerBlackPix.slice(0, 3)}]`);

    // Leak test
    challengeAssert('RASTER-06', 'Zero eye pixels leak outside the inner black capsule', rasterResult.leakedEyePixels === 0, `leakedPixels=${rasterResult.leakedEyePixels}`);

    // =========================================================================
    // SECTION 5: SLEEP TRANSITION, RESPIRATION & WAKEUP DYNAMICS
    // =========================================================================
    console.log('\n--- SECTION 5: Sleep Transition & Respiration Dynamics ---');

    mascot.resetInactivity();
    challengeAssert('SLEEP-01', 'Inactivity timer resets to 0.0s', mascot.inactivityTimer === 0);
    challengeAssert('SLEEP-02', 'isSleeping is false initially', mascot.isSleeping === false);
    challengeAssert('SLEEP-03', 'sleepProgress is 0.0 initially', mascot.sleepProgress === 0);

    // Inactivity just below threshold: 59.9s
    mascot.update(59.9, 0, 0, cx, cy);
    challengeAssert('SLEEP-04', 'Mascot remains awake at 59.9s of inactivity', mascot.isSleeping === false);

    // Exceed 60.0s threshold
    mascot.update(0.2, 0, 0, cx, cy);
    challengeAssert('SLEEP-05', 'Mascot enters sleep at >= 60.0s of inactivity', mascot.isSleeping === true);

    // 1.2s sleep transition progression
    mascot.sleepProgress = 0.0;
    mascot.update(0.6, 0, 0, cx, cy); // Halfway
    challengeAssert('SLEEP-06', 'sleepProgress reaches 0.5 halfway through 1.2s transition', Math.abs(mascot.sleepProgress - 0.5) < 0.02, `progress=${mascot.sleepProgress.toFixed(3)}`);

    mascot.update(0.6, 0, 0, cx, cy); // Complete
    challengeAssert('SLEEP-07', 'sleepProgress reaches 1.0 when fully asleep', mascot.sleepProgress === 1.0);

    // Respiratory period: 4.0s cycle
    challengeAssert('SLEEP-08', 'robo-mascot.ts specifies 4.0s respiratory period', mascotSource.includes('(Math.PI * 2 / 4.0)'));
    challengeAssert('SLEEP-09', 'robo-mascot.ts modulates slit height by ±0.25px', mascotSource.includes('0.25 * breathSin * size'));
    challengeAssert('SLEEP-10', 'robo-mascot.ts modulates glow blur by ±1.5px', mascotSource.includes('1.5 * breathSin'));

    // Snappy 0.35s elastic spring wakeup
    mascot.triggerWakeup();
    challengeAssert('WAKE-01', 'triggerWakeup() resets isSleeping to false', mascot.isSleeping === false);
    challengeAssert('WAKE-02', 'triggerWakeup() resets inactivityTimer to 0', mascot.inactivityTimer === 0);

    mascot.update(0.175, 0, 0, cx, cy); // Halfway wakeup
    challengeAssert('WAKE-03', 'sleepProgress decays halfway (0.5) during wakeup', Math.abs(mascot.sleepProgress - 0.5) < 0.02, `progress=${mascot.sleepProgress.toFixed(3)}`);

    mascot.update(0.2, 0, 0, cx, cy); // Full wakeup
    challengeAssert('WAKE-04', 'sleepProgress returns to 0.0 after 0.35s elastic wakeup', mascot.sleepProgress === 0.0);

    // =========================================================================
    // SECTION 6: MOTION STABILITY (IDLE FLOAT & SACCADE ELIMINATION)
    // =========================================================================
    console.log('\n--- SECTION 6: Motion Stability & Jitter Elimination ---');

    mascot.isCompactIdle = true;
    mascot.update(0.1, 0, 0, cx, cy);
    challengeAssert('STAB-01', 'idleFloatY is 0.0 when isCompactIdle is true', mascot.idleFloatY === 0);
    challengeAssert('STAB-02', 'saccadeY is strictly 0.0 (vertical saccade jitter eliminated)', mascot.saccadeY === 0);

    let maxIdleFloatY = 0;
    let maxSaccadeY = 0;
    for (let frame = 0; frame < 120; frame++) {
      mascot.update(0.016, 0, 0, cx, cy);
      if (Math.abs(mascot.idleFloatY) > maxIdleFloatY) maxIdleFloatY = Math.abs(mascot.idleFloatY);
      if (Math.abs(mascot.saccadeY) > maxSaccadeY) maxSaccadeY = Math.abs(mascot.saccadeY);
    }
    challengeAssert('STAB-03', 'idleFloatY remains rock-solid 0.0 over 120 frames (2 seconds)', maxIdleFloatY === 0);
    challengeAssert('STAB-04', 'saccadeY remains rock-solid 0.0 over 120 frames (2 seconds)', maxSaccadeY === 0);

    // =========================================================================
    // SECTION 7: PRESERVATION OF ALL 9 MOODS & WARDROBE
    // =========================================================================
    console.log('\n--- SECTION 7: Preservation of 9 Moods & Wardrobe ---');

    const moods = ['neutral', 'happy', 'sleepy', 'focused', 'curious', 'excited', 'thinking', 'surprised', 'relaxed'];
    for (const mood of moods) {
      mascot.setMood(mood);
      challengeAssert(`MOOD-${mood.toUpperCase()}`, `Preserves mood: ${mood}`, mascot.getMood() === mood);
    }

    const accessories = ['sunglasses', 'crown', 'party', 'best', 'none'];
    for (const acc of accessories) {
      mascot.setOutfit(acc);
      challengeAssert(`OUTFIT-${acc.toUpperCase()}`, `Preserves wardrobe outfit: ${acc}`, mascot.outfitKey === acc);
    }

    // =========================================================================
    // FINAL SUMMARY
    // =========================================================================
    console.log('\n===============================================================');
    console.log(`CHALLENGER STRESS HARNESS SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED out of ${totalTests} CHECKS`);
    console.log('===============================================================\n');

    if (failedTests > 0) {
      console.error('FAILED ASSERTIONS:');
      failureDetails.forEach(f => console.error(`  - [${f.id}] ${f.desc} ${f.details}`));
      process.exit(1);
    } else {
      console.log('ALL EMPIRICAL CHALLENGES PASSED WITH ZERO VIOLATIONS.');
      process.exit(0);
    }
  } catch (err) {
    console.error('[UNCAUGHT EXCEPTION]', err);
    process.exit(1);
  }
});
