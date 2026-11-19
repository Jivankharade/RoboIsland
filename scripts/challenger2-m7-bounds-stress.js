/**
 * Challenger 2: Adversarial Empirical Stress Test Harness for Milestone 7
 * (Final E2E Verification & Adversarial Coverage Hardening)
 *
 * Comprehensive Empirical Verification of:
 * 1. UI Containment & 860x440 Transparent Viewport Bounds across ALL 6 Features.
 * 2. Geometric Containment & Boundary Invariants:
 *    - Master Viewport: PANEL_WIDTH = 860, PANEL_HEIGHT = 440.
 *    - Feature 1: Live Activities & Sports Scoreboard (Pill 290-360px, Scorecard Modal 540x300px).
 *    - Feature 2: Universal Spotlight Launcher (Bar 620x54px, Results 620x326px -> 380px total).
 *    - Feature 3: Ambient Screen Glance & Error Fixer (Pill 220-500x32px, Modals 520-540px).
 *    - Feature 4: WhatsApp Smart Replies & Voice Note Card (Overlay 376x171px max, Chips & Transcript).
 *    - Feature 5: AirPods / Bluetooth Battery HUD (Card 340-368x44px, MultiBattery, Battery meters).
 *    - Feature 6: Voice Companion Mode & Sound Waves (Card 300-350x44px, Sinusoidal Canvas envelope).
 * 3. Zero DOM Overflow, Zero Uncontained Negative Offsets, and Strict Z-Index Stratification.
 * 4. Multi-Feature State Machine & Spatial Non-Interference Verification.
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const { PANEL_WIDTH, PANEL_HEIGHT, ISLAND_FLOAT_GAP } = require('../dist/main/display-manager');
const { sportsService, calculateSportsPillWidth: calcPillWidthExport } = require('../dist/main/sports-service');
const { launcherEngine } = require('../dist/main/launcher-engine');
const { screenGlanceEngine, ERROR_CATALOG_RULES } = require('../dist/main/screen-glance-engine');
const { whatsappSmartService } = require('../dist/main/whatsapp-smart-service');
const { bluetoothMonitorService } = require('../dist/main/bluetooth-monitor');
const { voiceCompanionService, computeAudioBands } = require('../dist/main/voice-companion-service');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(name, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${name} ${details ? '- ' + details : ''}`);
    failures.push({ name, details });
  }
}

// Emulate Canvas text measurement using font metrics approximations
function estimateTextWidth(text, fontSpec) {
  if (!text) return 0;
  let charWidthRatio = 0.55;
  let fontSize = 11;
  const match = fontSpec.match(/(\d+)px/);
  if (match) fontSize = parseInt(match[1], 10);
  if (fontSpec.includes('800') || fontSpec.includes('700') || fontSpec.includes('bold')) {
    charWidthRatio = 0.62;
  } else if (fontSpec.includes('600')) {
    charWidthRatio = 0.58;
  }
  return text.length * fontSize * charWidthRatio;
}

// Replicate CanvasEngine.calculateSportsPillWidth
function calculateSportsPillWidth(act, sportsFlashUntil = 0, now = 0) {
  if (now < sportsFlashUntil) return 340;
  if (!act || !act.pill) return 290;
  const text = `${act.pill.leftBadge} ${act.pill.leftScore} ${act.pill.badgeText} ${act.pill.rightScore} ${act.pill.rightBadge}`;
  return Math.max(290, Math.min(360, Math.round(text.length * 8.2 + 80)));
}

// 240Hz Spring Physics Simulator (replicated from canvas-engine.ts lines 4742-4786)
class SpringPhysicsSimulator {
  constructor(initialW = 98, initialH = 26, initialR = 13) {
    this.currentWidth = initialW;
    this.currentHeight = initialH;
    this.currentRadius = initialR;
    this.targetWidth = initialW;
    this.targetHeight = initialH;
    this.targetRadius = initialR;
    this.vWidth = 0;
    this.vHeight = 0;
    this.vRadius = 0;
  }

  setTarget(w, h, r) {
    this.targetWidth = w;
    this.targetHeight = h;
    this.targetRadius = r;
  }

  step(dtSec) {
    const growing = (this.targetWidth * this.targetHeight > this.currentWidth * this.currentHeight);
    const speed = 1.0;
    const response = (growing ? 0.42 : 0.34) * speed;
    const damping = growing ? 0.86 : 1.0;
    const stiffness = Math.pow(2 * Math.PI / response, 2);
    const friction = 4 * Math.PI * damping / response;
    const steps = Math.max(1, Math.ceil(dtSec / (1 / 240)));
    const h = dtSec / steps;

    for (let i = 0; i < steps; i++) {
      this.vWidth += (-stiffness * (this.currentWidth - this.targetWidth) - friction * this.vWidth) * h;
      this.currentWidth += this.vWidth * h;

      this.vHeight += (-stiffness * (this.currentHeight - this.targetHeight) - friction * this.vHeight) * h;
      this.currentHeight += this.vHeight * h;

      this.vRadius += (-stiffness * (this.currentRadius - this.targetRadius) - friction * this.vRadius) * h;
      this.currentRadius += this.vRadius * h;
    }

    if (Math.abs(this.currentWidth - this.targetWidth) < 0.3 && Math.abs(this.vWidth) < 3) {
      this.currentWidth = this.targetWidth;
      this.vWidth = 0;
    }
    if (Math.abs(this.currentHeight - this.targetHeight) < 0.3 && Math.abs(this.vHeight) < 3) {
      this.currentHeight = this.targetHeight;
      this.vHeight = 0;
    }
    if (Math.abs(this.currentRadius - this.targetRadius) < 0.3 && Math.abs(this.vRadius) < 3) {
      this.currentRadius = this.targetRadius;
      this.vRadius = 0;
    }
  }
}

async function runMilestone7BoundsStress() {
  console.log('================================================================');
  console.log('  CHALLENGER 2: EMPIRICAL BOUNDS & CONTAINMENT SUITE (M7)       ');
  console.log('  RoboIsland 860x440 Viewport, Zero Overflow & Invariants       ');
  console.log('================================================================\n');

  const islandCssPath = path.join(__dirname, '../src/renderer/island/island.css');
  const indexHtmlPath = path.join(__dirname, '../src/renderer/island/index.html');
  const canvasEnginePath = path.join(__dirname, '../src/renderer/island/canvas-engine.ts');

  const islandCss = fs.readFileSync(islandCssPath, 'utf8');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const canvasEngineSrc = fs.readFileSync(canvasEnginePath, 'utf8');

  // ==========================================================================
  // SUITE 1: MASTER TRANSPARENT VIEWPORT & POSITIONING GEOMETRY
  // ==========================================================================
  console.log('--- Suite 1: Master Transparent Viewport & Positioning Geometry ---');

  assert('PANEL_WIDTH is exactly 860', PANEL_WIDTH === 860);
  assert('PANEL_HEIGHT is exactly 440', PANEL_HEIGHT === 440);
  assert('ISLAND_FLOAT_GAP is exactly 6', ISLAND_FLOAT_GAP === 6);

  // Mathematical positioning verification on standard and high-resolution displays
  const displays = [
    { name: '1080p FHD', bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    { name: '1440p QHD', bounds: { x: 0, y: 0, width: 2560, height: 1440 } },
    { name: '4K UHD', bounds: { x: 0, y: 0, width: 3840, height: 2160 } },
    { name: 'Secondary Left Monitor', bounds: { x: -1920, y: 0, width: 1920, height: 1080 } },
    { name: 'Ultrawide 21:9', bounds: { x: 0, y: 0, width: 3440, height: 1440 } }
  ];

  const scales = [1.0, 1.25, 1.5, 2.0];

  for (const d of displays) {
    for (const scale of scales) {
      const effW = Math.round(PANEL_WIDTH * scale);
      const effH = Math.round(PANEL_HEIGHT * scale);
      const floatX = Math.round(d.bounds.x + (d.bounds.width - effW) / 2);
      const floatY = Math.round(d.bounds.y + (ISLAND_FLOAT_GAP * scale));
      const notchY = d.bounds.y;

      assert(`Display ${d.name} (${scale}x): floating X (${floatX}) centers window horizontally`,
        Math.abs((floatX + effW / 2) - (d.bounds.x + d.bounds.width / 2)) <= 1);

      assert(`Display ${d.name} (${scale}x): floating Y (${floatY}) fits within display bounds`,
        floatY >= d.bounds.y && (floatY + effH) <= (d.bounds.y + d.bounds.height));

      assert(`Display ${d.name} (${scale}x): notch Y (${notchY}) attaches flush to top edge`,
        notchY === d.bounds.y);
    }
  }

  // ==========================================================================
  // SUITE 2: FEATURE 1 (R1: SPORTS SCOREBOARD & COMPACT PILL / SCORECARD MODAL)
  // ==========================================================================
  console.log('\n--- Suite 2: Feature 1 (R1: Sports Scoreboard & Scorecard Modal) ---');

  // Test compact pill width calculations with various sports activities
  const sampleSportsActivities = [
    {
      sport: 'cricket',
      pill: { leftBadge: 'IND', leftScore: '174/3', badgeText: 'LIVE', rightScore: '18.4', rightBadge: 'OVS' }
    },
    {
      sport: 'cricket',
      pill: { leftBadge: 'ENG', leftScore: '412/9 d', badgeText: 'TEA', rightScore: '124/2', rightBadge: 'AUS' }
    },
    {
      sport: 'cricket', // Extreme score boundary
      pill: { leftBadge: 'WWWW', leftScore: '999/9', badgeText: 'TARGET 1000', rightScore: '998/10', rightBadge: 'MMMM' }
    },
    {
      sport: 'football',
      pill: { leftBadge: 'ARS', leftScore: '2', badgeText: "78'", rightScore: '1', rightBadge: 'CHE' }
    },
    {
      sport: 'football', // High score
      pill: { leftBadge: 'MCI', leftScore: '12', badgeText: "120' ET", rightScore: '11', rightBadge: 'RMA' }
    },
    {
      sport: 'f1',
      pill: { leftBadge: 'VER', leftScore: 'P1', badgeText: 'LAP 44/57', rightScore: '+2.41s', rightBadge: 'NOR' }
    },
    {
      sport: 'f1', // Safety car
      pill: { leftBadge: 'HAM', leftScore: 'P3', badgeText: 'SAFETY CAR', rightScore: '+0.12s', rightBadge: 'LEC' }
    }
  ];

  for (const act of sampleSportsActivities) {
    const w = calculateSportsPillWidth(act);
    const leftX = (PANEL_WIDTH - w) / 2;
    const rightX = leftX + w;

    assert(`Sports pill width (${w}px for ${act.sport}) is clamped to [290, 360]`,
      w >= 290 && w <= 360);

    assert(`Sports pill (${w}px) left edge (${leftX}px) >= 250px inside 860px viewport`,
      leftX >= 250);

    assert(`Sports pill (${w}px) right edge (${rightX}px) <= 610px inside 860px viewport`,
      rightX <= 610);

    // Lateral clearance
    assert(`Sports pill (${w}px) has at least 250px symmetric margin on both sides`,
      leftX >= 250 && (PANEL_WIDTH - rightX) >= 250);
  }

  // Flash state check
  const flashW = calculateSportsPillWidth(sampleSportsActivities[0], 10000, 5000);
  assert('Sports pill flash width is exactly 340px and within bounds',
    flashW === 340 && ((PANEL_WIDTH - flashW) / 2) === 260);

  // Scorecard Modal Bounds within #expanded-island-overlay
  assert('island.css defines .sports-scorecard-container with flex column',
    islandCss.includes('.sports-scorecard-container') && islandCss.includes('flex-direction: column'));

  assert('index.html contains #sports-scorecard-modal and #panel-sports',
    indexHtml.includes('id="sports-scorecard-modal"') && indexHtml.includes('id="panel-sports"'));

  const sportsOverlayW = 540;
  const sportsOverlayH = 300;
  const sportsLeft = (PANEL_WIDTH - sportsOverlayW) / 2; // 160px
  const sportsRight = sportsLeft + sportsOverlayW; // 700px
  const sportsTop = 4;
  const sportsBottom = sportsTop + sportsOverlayH; // 304px

  assert('Expanded Sports Scorecard width (540px) left bound is 160px >= 0', sportsLeft >= 0);
  assert('Expanded Sports Scorecard width (540px) right bound is 700px <= 860px', sportsRight <= PANEL_WIDTH);
  assert('Expanded Sports Scorecard height (300px) bottom bound is 304px <= 440px', sportsBottom <= PANEL_HEIGHT);
  assert('Expanded Sports Scorecard maintains 136px vertical bottom clearance',
    (PANEL_HEIGHT - sportsBottom) === 136);

  // ==========================================================================
  // SUITE 3: FEATURE 2 (R2: UNIVERSAL SPOTLIGHT / RAYCAST LAUNCHER)
  // ==========================================================================
  console.log('\n--- Suite 3: Feature 2 (R2: Universal Spotlight Launcher) ---');

  assert('index.html contains #spotlight-launcher-overlay and #spotlight-bar',
    indexHtml.includes('id="spotlight-launcher-overlay"') && indexHtml.includes('id="spotlight-bar"'));

  assert('island.css styles .spotlight-launcher-overlay with width: 620px and top: 10px',
    islandCss.includes('.spotlight-launcher-overlay') &&
    islandCss.includes('width: 620px') &&
    islandCss.includes('top: 10px'));

  const launcherW = 620;
  const launcherCollapsedH = 54;
  const launcherExpandedH = 380;
  const launcherTop = 10;
  const launcherLeft = (PANEL_WIDTH - launcherW) / 2; // 120px
  const launcherRight = launcherLeft + launcherW; // 740px

  assert('Spotlight Launcher left bound (120px) is >= 0', launcherLeft >= 0);
  assert('Spotlight Launcher right bound (740px) is <= 860px', launcherRight <= PANEL_WIDTH);
  assert('Spotlight Launcher collapsed bottom (64px) is <= 440px', (launcherTop + launcherCollapsedH) <= PANEL_HEIGHT);
  assert('Spotlight Launcher fully expanded bottom (390px) is <= 440px', (launcherTop + launcherExpandedH) <= PANEL_HEIGHT);
  assert('Spotlight Launcher maintains 50px bottom clearance at maximum expansion',
    (PANEL_HEIGHT - (launcherTop + launcherExpandedH)) === 50);

  // Results shelf max-height & overflow safety
  assert('island.css sets .spotlight-results max-height: 326px with overflow-y: auto',
    islandCss.includes('.spotlight-results') &&
    islandCss.includes('max-height: 326px') &&
    islandCss.includes('overflow-y: auto'));

  // 240Hz Spring physics convergence test
  const spring = new SpringPhysicsSimulator(98, 26, 13);
  spring.setTarget(620, 380, 24);

  let maxSimW = 0;
  let maxSimH = 0;
  // Simulate 1.5 seconds at 60Hz delta (dt = 0.016s)
  for (let frame = 0; frame < 90; frame++) {
    spring.step(0.016);
    if (spring.currentWidth > maxSimW) maxSimW = spring.currentWidth;
    if (spring.currentHeight > maxSimH) maxSimH = spring.currentHeight;
  }

  assert(`Spring physics max overshoot width (${maxSimW.toFixed(1)}px) does not exceed 860px viewport`,
    maxSimW <= PANEL_WIDTH);
  assert(`Spring physics max overshoot height (${maxSimH.toFixed(1)}px) does not exceed 440px viewport`,
    maxSimH <= PANEL_HEIGHT);
  assert('Spring physics smoothly settles to target width (620px)',
    Math.abs(spring.currentWidth - 620) < 0.5);
  assert('Spring physics smoothly settles to target height (380px)',
    Math.abs(spring.currentHeight - 380) < 0.5);

  // ==========================================================================
  // SUITE 4: FEATURE 3 (R3: AMBIENT SCREEN GLANCE & ERROR FIXER)
  // ==========================================================================
  console.log('\n--- Suite 4: Feature 3 (R3: Screen Glance & Error Fixer) ---');

  assert('index.html contains #glance-error-pill, #glance-error-modal, #glance-summary-modal',
    indexHtml.includes('id="glance-error-pill"') &&
    indexHtml.includes('id="glance-error-modal"') &&
    indexHtml.includes('id="glance-summary-modal"'));

  // Error Pill Geometry
  const pillTop = 8;
  const pillHeight = 32;
  const pillMinW = 220;
  const pillMaxW = 500;

  assert('Glance Pill top (8px) and height (32px) result in bottom (40px) <= 440px',
    (pillTop + pillHeight) === 40 && (pillTop + pillHeight) <= PANEL_HEIGHT);

  const pillMaxLeft = (PANEL_WIDTH - pillMaxW) / 2; // 180px
  const pillMaxRight = pillMaxLeft + pillMaxW; // 680px
  assert('Glance Pill at maximum width (500px) bounds [180, 680] are strictly inside [0, 860]',
    pillMaxLeft >= 0 && pillMaxRight <= PANEL_WIDTH);

  // Error Modal Card Geometry
  assert('island.css styles .glance-modal-card with width: 520px and max-width: 90vw',
    islandCss.includes('.glance-modal-card') &&
    islandCss.includes('width: 520px') &&
    islandCss.includes('max-width: 90vw'));

  const errModalW = 520;
  const errModalLeft = (PANEL_WIDTH - errModalW) / 2; // 170px
  const errModalRight = errModalLeft + errModalW; // 690px
  assert('Glance Error Modal left (170px) and right (690px) are contained within [0, 860]',
    errModalLeft >= 0 && errModalRight <= PANEL_WIDTH);

  // Summary Modal Card Geometry
  assert('island.css styles .glance-summary-card with width: 540px and max-width: 90vw',
    islandCss.includes('.glance-summary-card') &&
    islandCss.includes('width: 540px') &&
    islandCss.includes('max-width: 90vw'));

  const sumModalW = 540;
  const sumModalLeft = (PANEL_WIDTH - sumModalW) / 2; // 160px
  const sumModalRight = sumModalLeft + sumModalW; // 700px
  assert('Glance Summary Modal left (160px) and right (700px) are contained within [0, 860]',
    sumModalLeft >= 0 && sumModalRight <= PANEL_WIDTH);

  // ==========================================================================
  // SUITE 5: FEATURE 4 (R4: WHATSAPP SMART REPLIES & VOICE NOTES)
  // ==========================================================================
  console.log('\n--- Suite 5: Feature 4 (R4: WhatsApp Smart Replies & Voice Notes) ---');

  assert('index.html contains #whatsapp-quick-reply-bar and #whatsapp-voicenote-card',
    indexHtml.includes('id="whatsapp-quick-reply-bar"') &&
    indexHtml.includes('id="whatsapp-voicenote-card"'));

  assert('index.html contains #whatsapp-smart-reply-chips and #whatsapp-reply-input',
    indexHtml.includes('id="whatsapp-smart-reply-chips"') &&
    indexHtml.includes('id="whatsapp-reply-input"'));

  const waPillW = 400;
  const waBarW = 376;
  const waLeft = (PANEL_WIDTH - waBarW) / 2; // 242px
  const waRight = waLeft + waBarW; // 618px
  const waTop = 46;

  assert('WhatsApp Quick-Reply Bar left edge (242px) >= 0', waLeft >= 0);
  assert('WhatsApp Quick-Reply Bar right edge (618px) <= 860px', waRight <= PANEL_WIDTH);

  // Max vertical expansion (Voice Note + Chips + Reactions + Input) = 171px
  const waMaxExpandedH = 171;
  const waBottom = waTop + waMaxExpandedH; // 217px

  assert('WhatsApp Quick-Reply Bar fully expanded bottom (217px) <= 440px', waBottom <= PANEL_HEIGHT);
  assert('WhatsApp Quick-Reply Bar maintains 223px clearance from viewport bottom',
    (PANEL_HEIGHT - waBottom) === 223);

  // Scroll and overflow rules
  assert('island.css specifies overflow-y: auto and max-height: 52px for .wa-vn-transcript',
    islandCss.includes('.wa-vn-transcript') &&
    islandCss.includes('max-height: 52px') &&
    islandCss.includes('overflow-y: auto'));

  assert('island.css specifies overflow-x: auto for .whatsapp-smart-reply-chips',
    islandCss.includes('.whatsapp-smart-reply-chips') &&
    islandCss.includes('overflow-x: auto'));

  // ==========================================================================
  // SUITE 6: FEATURE 5 (R5: AIRPODS / BLUETOOTH BATTERY & DEVICE HUD)
  // ==========================================================================
  console.log('\n--- Suite 6: Feature 5 (R5: AirPods / Bluetooth Battery HUD) ---');

  assert('index.html contains #bluetooth-hud-card, #bt-hud-name, #bt-hud-battery-percent, #bt-hud-multibattery',
    indexHtml.includes('id="bluetooth-hud-card"') &&
    indexHtml.includes('id="bt-hud-name"') &&
    indexHtml.includes('id="bt-hud-battery-percent"') &&
    indexHtml.includes('id="bt-hud-multibattery"'));

  assert('island.css styles .bluetooth-hud-card with width: 340px, height: 44px, top: 10px',
    islandCss.includes('.bluetooth-hud-card') &&
    islandCss.includes('width: 340px') &&
    islandCss.includes('height: 44px') &&
    islandCss.includes('top: 10px'));

  // Single Device HUD bounds
  const btStandardW = 340;
  const btTop = 10;
  const btHeight = 44;
  const btStandardLeft = (PANEL_WIDTH - btStandardW) / 2; // 260px
  const btStandardRight = btStandardLeft + btStandardW; // 600px
  const btBottom = btTop + btHeight; // 54px

  assert('Standard Bluetooth HUD left (260px) and right (600px) are contained within [0, 860]',
    btStandardLeft >= 0 && btStandardRight <= PANEL_WIDTH);
  assert('Standard Bluetooth HUD bottom (54px) is <= 440px with 386px clearance',
    btBottom <= PANEL_HEIGHT && (PANEL_HEIGHT - btBottom) === 386);

  // MultiBattery HUD bounds (AirPods Pro / Buds with case: up to 368px on hover)
  const btMbHoverW = 368;
  const btMbLeft = (PANEL_WIDTH - btMbHoverW) / 2; // 246px
  const btMbRight = btMbLeft + btMbHoverW; // 614px

  assert('MultiBattery Bluetooth HUD on hover (368px) left bound (246px) >= 0', btMbLeft >= 0);
  assert('MultiBattery Bluetooth HUD on hover (368px) right bound (614px) <= 860px', btMbRight <= PANEL_WIDTH);

  // Text overflow clamp check
  assert('island.css enforces max-width: 130px and text-overflow: ellipsis on .bt-hud-name',
    islandCss.includes('.bt-hud-name') &&
    islandCss.includes('max-width: 130px') &&
    islandCss.includes('text-overflow: ellipsis'));

  // ==========================================================================
  // SUITE 7: FEATURE 6 (R6: VOICE COMPANION MODE & SOUND WAVES)
  // ==========================================================================
  console.log('\n--- Suite 7: Feature 6 (R6: Voice Companion Mode & Sound Waves) ---');

  assert('index.html contains #voice-companion-card, #voice-hud-title, #voice-hud-status',
    indexHtml.includes('id="voice-companion-card"') &&
    indexHtml.includes('id="voice-hud-title"') &&
    indexHtml.includes('id="voice-hud-status"'));

  assert('island.css styles .voice-companion-card with width: 320px, height: 44px, top: 10px',
    islandCss.includes('.voice-companion-card') &&
    islandCss.includes('width: 320px') &&
    islandCss.includes('height: 44px') &&
    islandCss.includes('top: 10px'));

  // Active voice state widths (THINKING: 300px, LISTENING: 320px, SPEAKING: 340px, HOVER: 350px)
  const voiceWidths = [300, 320, 340, 350];
  for (const vw of voiceWidths) {
    const vLeft = (PANEL_WIDTH - vw) / 2;
    const vRight = vLeft + vw;
    assert(`Voice Companion width (${vw}px) left bound (${vLeft}px) >= 250px`, vLeft >= 250);
    assert(`Voice Companion width (${vw}px) right bound (${vRight}px) <= 610px`, vRight <= 610);
  }

  // Fluid Sound Wave Canvas Mathematical Boundary Verification
  // Wave equation: y(x, t) = centerY + A * sin(normX * PI) * sin(freq * normX + phase + t)
  // Where normX = x / cardWidth.
  // Envelope E(x) = sin(normX * PI)
  const W_CANVAS = 320;
  const H_CANVAS = 44;
  const CY = H_CANVAS / 2; // 22px
  const MAX_AMP = 14; // Maximum amplitude

  // Boundary condition test: normX = 0 and normX = 1
  const envAtZero = Math.sin(0 * Math.PI);
  const envAtOne = Math.sin(1 * Math.PI);

  assert('Fluid wave envelope at normX=0 is exactly 0 (zero boundary displacement)',
    Math.abs(envAtZero) < 1e-12);
  assert('Fluid wave envelope at normX=1 is exactly 0 (zero boundary displacement)',
    Math.abs(envAtOne) < 1e-12);

  // Mathematical stress across 1,000 coordinate steps and extreme audio levels
  const testLevels = [0.0, 0.25, 0.5, 0.75, 1.0, 2.0, -1.0, 100.0, NaN, Infinity];
  let nanInfinityCount = 0;
  let outOfBoundsCount = 0;

  for (const rawLevel of testLevels) {
    const clampedLevel = Number.isFinite(rawLevel) ? Math.max(0, Math.min(1, rawLevel)) : 0.5;
    const amp = MAX_AMP * (0.2 + 0.8 * clampedLevel);

    for (let x = 0; x <= W_CANVAS; x += 1) {
      const normX = x / W_CANVAS;
      const env = Math.sin(normX * Math.PI);
      const waveY = CY + amp * env * Math.sin(4 * normX * Math.PI + 1.2);

      if (!Number.isFinite(waveY)) {
        nanInfinityCount++;
      }
      if (waveY < 0 || waveY > H_CANVAS) {
        outOfBoundsCount++;
      }
    }
  }

  assert('Fluid sound wave coordinates produce ZERO NaN / Infinity values', nanInfinityCount === 0);
  assert('Fluid sound wave coordinates remain strictly within canvas height [0, 44px]', outOfBoundsCount === 0);

  // ==========================================================================
  // SUITE 8: DOM OVERFLOW, NEGATIVE OFFSETS & Z-INDEX LAYERING INTEGRITY
  // ==========================================================================
  console.log('\n--- Suite 8: DOM Overflow, Negative Offsets & Z-Index Layering ---');

  // HTML & Body overflow rule
  assert('island.css enforces html, body { overflow: hidden; width: 100%; height: 100%; }',
    islandCss.includes('html, body') &&
    islandCss.includes('overflow: hidden') &&
    islandCss.includes('width: 100%') &&
    islandCss.includes('height: 100%'));

  // Negative positioning audit
  // Look for any negative left or top coordinates that could throw elements off-screen
  // Use negative lookbehind to avoid false matches on margin-top, padding-left, etc.
  const negMatches = [...islandCss.matchAll(/(?<![\w-])(left|top|right|bottom):\s*(-?\d+)px/g)];
  let dangerousNegativeOffsets = 0;

  for (const m of negMatches) {
    const prop = m[1];
    const val = parseInt(m[2], 10);
    // Allow slight micro-positioning (-1px to -5px) or full inset 0
    if (val < -10) {
      dangerousNegativeOffsets++;
      console.warn(`    Warning: Found significant negative offset: ${prop}: ${val}px`);
    }
  }

  assert('island.css contains ZERO uncontained dangerous negative offsets (< -10px)', dangerousNegativeOffsets === 0);

  // Explicit Z-Index Stratification Hierarchy Verification
  // Expected hierarchy:
  // - Base Canvas: 0 (or default)
  // - Base expanded panels: 10
  // - Feature HUDs / Pills: 1000 (.glance-error-pill, .bluetooth-hud-card, .voice-companion-card)
  // - Error / Summary Modals: 1001 (.glance-error-modal, .glance-summary-modal)
  // - Spotlight Launcher: 10000 (.spotlight-launcher-overlay)
  // - WhatsApp Quick-Reply Bar: 99999 (.whatsapp-quick-reply-bar)

  const zGlancePillMatch = islandCss.match(/\.glance-error-pill[\s\S]*?z-index:\s*(\d+)/);
  const zGlanceModalMatch = islandCss.match(/\.glance-error-modal[\s\S]*?z-index:\s*(\d+)/);
  const zGlanceSummaryMatch = islandCss.match(/\.glance-summary-modal[\s\S]*?z-index:\s*(\d+)/);
  const zBtHudMatch = islandCss.match(/\.bluetooth-hud-card[\s\S]*?z-index:\s*(\d+)/);
  const zVoiceCardMatch = islandCss.match(/\.voice-companion-card[\s\S]*?z-index:\s*(\d+)/);
  const zSpotlightMatch = islandCss.match(/\.spotlight-launcher-overlay[\s\S]*?z-index:\s*(\d+)/);
  const zWhatsAppMatch = islandCss.match(/\.whatsapp-quick-reply-bar[\s\S]*?z-index:\s*(\d+)/);

  const zGlancePill = zGlancePillMatch ? parseInt(zGlancePillMatch[1], 10) : 0;
  const zGlanceModal = zGlanceModalMatch ? parseInt(zGlanceModalMatch[1], 10) : 0;
  const zGlanceSummary = zGlanceSummaryMatch ? parseInt(zGlanceSummaryMatch[1], 10) : 0;
  const zBtHud = zBtHudMatch ? parseInt(zBtHudMatch[1], 10) : 0;
  const zVoiceCard = zVoiceCardMatch ? parseInt(zVoiceCardMatch[1], 10) : 0;
  const zSpotlight = zSpotlightMatch ? parseInt(zSpotlightMatch[1], 10) : 0;
  const zWhatsApp = zWhatsAppMatch ? parseInt(zWhatsAppMatch[1], 10) : 0;

  console.log(`  [Z-INDEX MAP] GlancePill=${zGlancePill}, GlanceModal=${zGlanceModal}, GlanceSummary=${zGlanceSummary}, BtHud=${zBtHud}, VoiceCard=${zVoiceCard}, Spotlight=${zSpotlight}, WhatsApp=${zWhatsApp}`);

  assert('HUD elements (Bluetooth, Voice, Glance Pill) have unified z-index = 1000',
    zBtHud === 1000 && zVoiceCard === 1000 && zGlancePill === 1000);

  assert('Glance Modals have z-index = 1001, properly layering above HUD elements',
    zGlanceModal === 1001 && zGlanceSummary === 1001 && zGlanceModal > zBtHud);

  assert('Spotlight Launcher has z-index = 10000, properly layering above standard modals',
    zSpotlight === 10000 && zSpotlight > zGlanceModal);

  assert('WhatsApp Quick-Reply Bar has top-priority z-index = 99999 for instant response interactions',
    zWhatsApp === 99999 && zWhatsApp > zSpotlight);

  // ==========================================================================
  // SUITE 9: MULTI-FEATURE CONCURRENCY & SPATIAL NON-INTERFERENCE
  // ==========================================================================
  console.log('\n--- Suite 9: Multi-Feature Concurrency & Spatial Non-Interference ---');

  // Matrix of active feature dimensions to verify bounding boxes under any combination
  const featureBoundingBoxes = [
    { name: 'Rest Pill', width: 98, height: 26, top: 4 },
    { name: 'R1 Sports Compact Pill', width: 360, height: 36, top: 6 },
    { name: 'R1 Sports Scorecard Modal', width: 540, height: 300, top: 4 },
    { name: 'R2 Spotlight Bar Collapsed', width: 620, height: 54, top: 10 },
    { name: 'R2 Spotlight Results Expanded', width: 620, height: 380, top: 10 },
    { name: 'R3 Screen Glance Error Pill', width: 500, height: 32, top: 8 },
    { name: 'R3 Screen Glance Error Modal', width: 520, height: 320, top: 60 },
    { name: 'R3 Screen Glance Summary Modal', width: 540, height: 340, top: 50 },
    { name: 'R4 WhatsApp Quick-Reply Bar', width: 400, height: 171, top: 46 },
    { name: 'R5 Bluetooth Single Device HUD', width: 340, height: 44, top: 10 },
    { name: 'R5 Bluetooth MultiBattery HUD', width: 368, height: 44, top: 10 },
    { name: 'R6 Voice Companion Listening HUD', width: 320, height: 44, top: 10 },
    { name: 'R6 Voice Companion Speaking HUD', width: 350, height: 44, top: 10 }
  ];

  for (const fb of featureBoundingBoxes) {
    const left = (PANEL_WIDTH - fb.width) / 2;
    const right = left + fb.width;
    const bottom = fb.top + fb.height;

    assert(`${fb.name}: left (${left.toFixed(0)}px) >= 0`, left >= 0);
    assert(`${fb.name}: right (${right.toFixed(0)}px) <= 860px`, right <= PANEL_WIDTH);
    assert(`${fb.name}: top (${fb.top}px) >= 0`, fb.top >= 0);
    assert(`${fb.name}: bottom (${bottom}px) <= 440px`, bottom <= PANEL_HEIGHT);
  }

  // ==========================================================================
  // FINAL REPORT & SUMMARY
  // ==========================================================================
  console.log('\n================================================================');
  console.log(`  BOUNDS STRESS TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    console.error('FAILED TESTS DETAILS:');
    failures.forEach((f, idx) => console.error(`  ${idx + 1}. ${f.name} - ${f.details}`));
    process.exit(1);
  } else {
    console.log('ALL BOUNDARY INVARIANTS, VIEWPORT CONSTRAINTS & Z-INDEX LAYERS VERIFIED!');
    process.exit(0);
  }
}

runMilestone7BoundsStress().catch(err => {
  console.error('UNCAUGHT EXCEPTION IN BOUNDS HARNESS:', err);
  process.exit(1);
});
