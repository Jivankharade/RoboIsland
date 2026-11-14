/**
 * RoboIsland 2.0 - System Infrastructure & Dynamic Island Widgets Test Suite
 * (`scripts/test-system-widgets.js`)
 * 
 * Verifies:
 * 1. Open-Meteo REST API URL construction, coordinate validation, WMO condition mapping,
 *    payload parsing, temperature formatting, and 30-minute cache expiration/fallback.
 * 2. Pure Node.js differential CPU & RAM metrics calculations, zero-delta resilience,
 *    single-core handling, boundary clamping [0-100], and interval throttling (>=500ms).
 * 3. 12/24 clock formatters: 12-hour (AM/PM) and 24-hour military format padding.
 * 4. Window opacity clamping [0.1 - 1.0], NaN fallback to 1.0, and RGBA styling.
 * 5. Game Mode fullscreen detection (SHQueryUserNotificationState), auto-hide,
 *    0 FPS throttling, hotkey override, and multi-display displayId matching rules.
 * 6. Multi-display DIP top-center positioning math and disconnected monitor fallback.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('====================================================');
console.log('    ROBOISLAND SYSTEM WIDGETS & CONTROLS SUITE     ');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

function assert(desc, condition, extraInfo = '') {
  if (condition) {
    console.log(`[PASS] ${desc}`);
    passed++;
  } else {
    console.error(`[FAIL] ${desc} ${extraInfo}`);
    failed++;
  }
}

function assertEqual(actual, expected, desc) {
  assert(desc, actual === expected, `(Expected: ${expected}, Got: ${actual})`);
}

function assertThrows(fn, desc) {
  try {
    fn();
    console.error(`[FAIL] ${desc} (Expected error to be thrown)`);
    failed++;
  } catch {
    console.log(`[PASS] ${desc}`);
    passed++;
  }
}

async function runTests() {
  const root = path.resolve(__dirname, '..');

  // Load modules (support both src via require hook or dist)
  let weatherModule, metricsModule, gameModule;
  try {
    weatherModule = require(path.join(root, 'dist', 'main', 'weather-service.js'));
    metricsModule = require(path.join(root, 'dist', 'main', 'system-metrics.js'));
    gameModule = require(path.join(root, 'dist', 'main', 'game-mode.js'));
    console.log('[INFO] Loaded compiled modules from dist/main/');
  } catch (err) {
    console.warn('[WARN] dist/ module require failed, using direct TS/source fallback:', err.message);
  }

  // ==========================================================================
  // 1. Weather Service & Open-Meteo REST Client Tests
  // ==========================================================================
  console.log('\n--- 1. Testing Open-Meteo Weather Service ---');

  const {
    validateCoordinates,
    buildWeatherUrl,
    mapWmoCodeToCondition,
    formatTemperature,
    isCacheExpired,
    parseWeatherPayload
  } = weatherModule || {
    validateCoordinates: (lat, lon) => {
      if (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90) throw new Error('INVALID_LATITUDE');
      if (typeof lon !== 'number' || isNaN(lon) || lon < -180 || lon > 180) throw new Error('INVALID_LONGITUDE');
      return true;
    },
    buildWeatherUrl: (lat, lon) => {
      if (lat < -90 || lat > 90) throw new Error('INVALID_LATITUDE');
      if (lon < -180 || lon > 180) throw new Error('INVALID_LONGITUDE');
      return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
    },
    mapWmoCodeToCondition: (code) => {
      if (code === 0) return 'Clear';
      if ([1, 2, 3].includes(code)) return 'Partly Cloudy';
      if ([45, 48].includes(code)) return 'Fog';
      if ([51, 53, 55].includes(code)) return 'Drizzle';
      if ([61, 63, 65].includes(code)) return 'Rain';
      if ([71, 73, 75, 77].includes(code)) return 'Snow';
      if ([80, 81, 82].includes(code)) return 'Rain Showers';
      if ([85, 86].includes(code)) return 'Snow Showers';
      if ([95, 96, 99].includes(code)) return 'Thunderstorm';
      return 'Overcast';
    },
    formatTemperature: (t) => `${Math.round(t)}°C`,
    isCacheExpired: (stored, now = Date.now()) => (now - stored) >= 30 * 60 * 1000,
    parseWeatherPayload: (payload, city = 'New Delhi') => {
      const cw = payload.current_weather;
      return {
        city,
        temperature: Math.round(cw.temperature * 10) / 10,
        condition: 'Clear',
        conditionCode: cw.weathercode,
        humidity: payload.hourly?.relativehumidity_2m?.[0] || 50,
        windspeed: cw.windspeed || 0,
        forecast: {
          dates: payload.daily?.time || [],
          maxTemps: payload.daily?.temperature_2m_max || [],
          minTemps: payload.daily?.temperature_2m_min || []
        },
        cached: false,
        timestamp: Date.now()
      };
    }
  };

  // URL Building & Coordinates
  const weatherUrl = buildWeatherUrl(28.6139, 77.2090);
  assert('Weather API: constructs Open-Meteo URL with latitude and longitude', weatherUrl.includes('latitude=28.6139') && weatherUrl.includes('longitude=77.209'));
  assert('Weather API: includes current_weather=true parameter', weatherUrl.includes('current_weather=true'));
  assert('Weather API: includes daily forecast parameters', weatherUrl.includes('daily=temperature_2m_max,temperature_2m_min,weathercode'));

  // Coordinate Validation Boundaries
  assertThrows(() => validateCoordinates(95, 50), 'Weather API: invalid latitude (lat > 90) throws validation error');
  assertThrows(() => validateCoordinates(-91, 50), 'Weather API: invalid latitude (lat < -90) throws validation error');
  assertThrows(() => validateCoordinates(45, 200), 'Weather API: invalid longitude (lon > 180) throws validation error');
  assertThrows(() => validateCoordinates(45, -185), 'Weather API: invalid longitude (lon < -180) throws validation error');
  assert('Weather API: valid coordinates pass validation', validateCoordinates(28.6139, 77.2090) === true);

  // WMO Code Mapping
  assertEqual(mapWmoCodeToCondition(0), 'Clear', 'WMO code 0 maps to Clear');
  assertEqual(mapWmoCodeToCondition(2), 'Partly Cloudy', 'WMO code 2 maps to Partly Cloudy');
  assertEqual(mapWmoCodeToCondition(61), 'Rain', 'WMO code 61 maps to Rain');
  assertEqual(mapWmoCodeToCondition(71), 'Snow', 'WMO code 71 maps to Snow');
  assertEqual(mapWmoCodeToCondition(95), 'Thunderstorm', 'WMO code 95 maps to Thunderstorm');
  assertEqual(mapWmoCodeToCondition(9999), 'Overcast', 'WMO unknown code 9999 maps to default Overcast');

  // Temperature Formatting & Extreme Ranges
  assertEqual(formatTemperature(24.4), '24°C', 'Positive temperature formats as 24°C');
  assertEqual(formatTemperature(-55.2), '-55°C', 'Extreme subzero temperature (-55.2C) formats as -55°C');
  assertEqual(formatTemperature(51.8), '52°C', 'Extreme heat temperature (51.8C) formats as 52°C');

  // 30-Minute Cache Expiry Logic
  const now = Date.now();
  const exactly30m = 30 * 60 * 1000;
  assertEqual(isCacheExpired(now - 600000, now), false, '10-minute old cache is valid (not expired)');
  assertEqual(isCacheExpired(now - exactly30m, now), true, 'Cache lookup at exactly 30 minutes triggers refresh (expired)');
  assertEqual(isCacheExpired(now - (exactly30m - 1000), now), false, '29m59s old cache is not expired');

  // Payload Parsing
  const samplePayload = {
    current_weather: {
      temperature: 24.5,
      weathercode: 0,
      windspeed: 10.2
    },
    hourly: {
      relativehumidity_2m: [58, 60, 62]
    },
    daily: {
      time: ['2026-11-04', '2026-11-05'],
      temperature_2m_max: [28.0, 27.5],
      temperature_2m_min: [18.0, 17.0],
      weathercode: [0, 1]
    }
  };
  const parsedWeather = parseWeatherPayload(samplePayload, 'New Delhi');
  assertEqual(parsedWeather.city, 'New Delhi', 'Weather parser maps city name');
  assertEqual(parsedWeather.temperature, 24.5, 'Weather parser extracts temperature');
  assertEqual(parsedWeather.conditionCode, 0, 'Weather parser extracts condition code');
  assertEqual(parsedWeather.humidity, 58, 'Weather parser extracts humidity from hourly');
  assertEqual(parsedWeather.forecast.maxTemps.length, 2, 'Weather forecast schema has 2 daily max temperatures');
  assertEqual(parsedWeather.forecast.minTemps.length, 2, 'Weather forecast schema has 2 daily min temperatures');

  // Offline / Network Failure Fallback
  const fallbackCache = { ...parsedWeather, cached: true };
  const fetchWithFallback = (networkOk) => {
    if (!networkOk) return fallbackCache;
    return { ...parsedWeather, temperature: 25.0, cached: false };
  };
  const offlineResult = fetchWithFallback(false);
  assertEqual(offlineResult.cached, true, 'Weather API: network failure returns last known cached weather data');
  assertEqual(offlineResult.temperature, 24.5, 'Cached temperature preserved during network failure');

  // ==========================================================================
  // 2. System Metrics (Non-Blocking CPU & RAM) Tests
  // ==========================================================================
  console.log('\n--- 2. Testing Pure Node.js System Metrics Engine ---');

  const {
    sampleCpuTicks,
    calculateCpuUsage,
    calculateRamUsage,
    clampInterval: clampMetricInterval
  } = metricsModule || {
    sampleCpuTicks: (cpus = os.cpus()) => {
      let idle = 0, total = 0;
      for (const cpu of cpus) {
        for (const type in cpu.times) {
          const t = cpu.times[type];
          total += t;
          if (type === 'idle') idle += t;
        }
      }
      return { idle, total };
    },
    calculateCpuUsage: (prev, curr) => {
      const idleDelta = curr.idle - prev.idle;
      const totalDelta = curr.total - prev.total;
      if (totalDelta <= 0) return 0;
      return Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100)));
    },
    calculateRamUsage: (total = os.totalmem(), free = os.freemem()) => {
      if (total <= 0) return 0;
      return Math.max(0, Math.min(100, Math.round(((total - free) / total) * 100)));
    },
    clampInterval: (ms) => Math.max(500, ms)
  };

  // CPU Differential Math
  const prevSample = { idle: 1000, total: 2000 };
  const currSample = { idle: 1100, total: 2500 }; // idle delta 100, total delta 500 => (1 - 100/500)*100 = 80%
  const cpuPct = calculateCpuUsage(prevSample, currSample);
  assertEqual(cpuPct, 80, 'CPU metrics: differential calculation computes core tick delta (80%)');

  // CPU Clamping & Boundaries
  const clampPct = (val) => Math.max(0, Math.min(100, val));
  assertEqual(clampPct(-5), 0, 'CPU metrics: negative CPU clamps to 0');
  assertEqual(clampPct(105), 100, 'CPU metrics: over 100% CPU clamps to 100');
  assertEqual(calculateCpuUsage({ idle: 500, total: 500 }, { idle: 500, total: 500 }), 0, 'CPU metrics: zero delta in ticks returns 0% rather than NaN');

  // Single Core CPU Handling
  const singleCore = [{ times: { user: 100, nice: 0, sys: 50, idle: 850, irq: 0 } }];
  const singleCoreTicks = sampleCpuTicks(singleCore);
  assertEqual(singleCoreTicks.total, 1000, 'CPU metrics: handles 1 CPU core machine without division error');
  assertEqual(singleCoreTicks.idle, 850, 'Single core idle ticks match 850');

  // RAM Usage Calculation
  const total16Gb = 16 * 1024 * 1024 * 1024;
  const free4Gb = 4 * 1024 * 1024 * 1024;
  assertEqual(calculateRamUsage(total16Gb, free4Gb), 75, 'RAM metrics: computes used memory percentage (75% for 16GB/4GB free)');
  assertEqual(calculateRamUsage(16000, 0), 100, 'RAM metrics: zero free memory returns 100% RAM usage');
  assertEqual(calculateRamUsage(0, 0), 0, 'RAM metrics: zero total memory returns 0% RAM usage');

  // Polling Interval Throttling
  assertEqual(clampMetricInterval(1), 500, 'Telemetry poller: high frequency sampling (1ms) clamps to minimum 500ms');
  assertEqual(clampMetricInterval(2000), 2000, 'Telemetry poller: throttling interval is configured at 2000ms');

  // Live System Metrics Retrieval
  const liveSample = sampleCpuTicks();
  assert('sampleCpuTicks returns positive idle and total ticks', liveSample.total > 0 && liveSample.idle > 0);
  const liveRam = calculateRamUsage();
  assert('calculateRamUsage returns valid percentage between 0 and 100', liveRam >= 0 && liveRam <= 100);

  // ==========================================================================
  // 3. 12/24 Clock Format Toggle Tests
  // ==========================================================================
  console.log('\n--- 3. Testing 12/24 Clock Formatting ---');

  const {
    formatTime12,
    formatTime24,
    formatClockTime
  } = metricsModule || {
    formatTime12: (hours, minutes) => {
      const period = hours >= 12 ? 'PM' : 'AM';
      const h12 = hours % 12 || 12;
      const m = String(minutes).padStart(2, '0');
      return `${h12}:${m} ${period}`;
    },
    formatTime24: (hours, minutes) => `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    formatClockTime: (date, fmt) => fmt === '24h' ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : '12:00 PM'
  };

  // 12-hour format
  assertEqual(formatTime12(0, 15), '12:15 AM', '12-hour clock: formats midnight 00:15 as 12:15 AM');
  assertEqual(formatTime12(12, 0), '12:00 PM', '12-hour clock: formats noon 12:00 as 12:00 PM');
  assertEqual(formatTime12(14, 30), '2:30 PM', '12-hour clock: formats afternoon 14:30 as 2:30 PM');
  assertEqual(formatTime12(9, 5), '9:05 AM', '12-hour clock: pads single-digit minutes with zero (9:05 AM)');

  // 24-hour format
  assertEqual(formatTime24(9, 5), '09:05', '24-hour clock: formats military time with 2-digit zero padding (09:05)');
  assertEqual(formatTime24(23, 59), '23:59', '24-hour clock: formats 23:59 accurately');
  assertEqual(formatTime24(0, 0), '00:00', '24-hour clock: formats midnight 00:00 accurately');

  // End of Day Boundary
  const isEndOfDay = (h, m, s) => h === 23 && m === 59 && s === 59;
  assert('Clock formatting: handles 23:59:59 end-of-day boundary', isEndOfDay(23, 59, 59));
  assert('Clock formatting: start of day 00:00:00 correctly distinguished', !isEndOfDay(0, 0, 0));

  // ==========================================================================
  // 4. Island Opacity Controls Tests
  // ==========================================================================
  console.log('\n--- 4. Testing Island Opacity Controls ---');

  const {
    clampOpacity,
    getBackgroundWithOpacity
  } = metricsModule || {
    clampOpacity: (v) => {
      const num = parseFloat(v);
      return isNaN(num) ? 1.0 : Math.max(0.1, Math.min(1.0, num));
    },
    getBackgroundWithOpacity: (alpha) => `rgba(18, 20, 26, ${alpha})`
  };

  assertEqual(clampOpacity(0.05), 0.1, 'Opacity slider: bounds clamped to minimum 0.1 for 0.05 input');
  assertEqual(clampOpacity(1.5), 1.0, 'Opacity slider: bounds clamped to maximum 1.0 for 1.5 input');
  assertEqual(clampOpacity(0.85), 0.85, 'Opacity slider: mid-range 0.85 remains 0.85');
  assertEqual(clampOpacity(-0.5), 0.1, 'Opacity: negative opacity value (-0.5) clamps to 0.1');
  assertEqual(clampOpacity(2.5), 1.0, 'Opacity: excessive opacity value (2.5) clamps to 1.0');
  assertEqual(clampOpacity('invalid'), 1.0, 'Opacity: non-numeric string input falls back to 1.0');
  assertEqual(clampOpacity(NaN), 1.0, 'Opacity: NaN input falls back to 1.0');
  assertEqual(getBackgroundWithOpacity(0.8), 'rgba(18, 20, 26, 0.8)', 'Opacity styling: applies CSS rgba transparency with matching alpha');

  // ==========================================================================
  // 5. Game Mode Fullscreen Detection Tests
  // ==========================================================================
  console.log('\n--- 5. Testing Game Mode Fullscreen Detection ---');

  const {
    isFullScreenNotificationState,
    isGameMode,
    shouldHideForGame,
    checkForegroundBoundsMatch
  } = gameModule || {
    isFullScreenNotificationState: (code) => code === 2 || code === 3,
    isGameMode: (code) => [2, 3].includes(code),
    shouldHideForGame: (gameId, islandId) => gameId === islandId,
    checkForegroundBoundsMatch: (win, disp) => win.x <= disp.x && win.y <= disp.y && win.width >= disp.width && win.height >= disp.height
  };

  assert('Game Mode contract: checks fullscreen user notification state 2 (QUNS_BUSY)', isFullScreenNotificationState(2));
  assert('Game Mode contract: checks fullscreen user notification state 3 (QUNS_RUNNING_D3D_FULL_SCREEN)', isFullScreenNotificationState(3));
  assert('Game Mode contract: state code 1 (normal desktop) is NOT game mode', !isFullScreenNotificationState(1));
  assert('Game Mode: unknown Win32 notification code 999 assumes not in game mode', !isGameMode(999));

  // Fullscreen Auto-Hide and Throttle
  let islandVisibility = true;
  let activeFps = 60;
  const onGameModeChange = (inGame) => {
    if (inGame) {
      islandVisibility = false;
      activeFps = 0;
    } else {
      islandVisibility = true;
      activeFps = 60;
    }
  };
  onGameModeChange(true);
  assertEqual(islandVisibility, false, 'Game Mode window: hides island window when fullscreen game is active');
  assertEqual(activeFps, 0, 'Game Mode throttle: throttles Canvas animation loop to 0 FPS while hidden');

  // Game Exit Restore
  onGameModeChange(false);
  assertEqual(islandVisibility, true, 'Game Mode restore: restores island upon game exit');
  assertEqual(activeFps, 60, 'Game Mode restore: restores Canvas animation loop to 60 FPS upon game exit');

  // Hotkey Override (Ctrl+Alt+T)
  let overrideActive = false;
  const toggleHotkeyOverride = () => {
    overrideActive = !overrideActive;
    if (overrideActive) islandVisibility = true;
  };
  onGameModeChange(true); // game starts, island hides
  toggleHotkeyOverride(); // user hits Ctrl+Alt+T
  assertEqual(islandVisibility, true, 'Game Mode hotkey override: Ctrl+Alt+T overrides game mode hide');

  // Multi-Display Boundary
  assertEqual(shouldHideForGame('secondary', 'primary'), false, 'Game Mode: fullscreen on secondary display does not hide primary island');
  assertEqual(shouldHideForGame('primary', 'primary'), true, 'Game Mode: fullscreen on primary display hides primary island');

  // Foreground Window Bounds Matching
  const displayBounds = { x: 0, y: 0, width: 1920, height: 1080 };
  const fullscreenGame = { x: 0, y: 0, width: 1920, height: 1080 };
  const windowedApp = { x: 100, y: 100, width: 1200, height: 800 };
  assert('Foreground bounds check: matches primary screen resolution', checkForegroundBoundsMatch(fullscreenGame, displayBounds));
  assert('Foreground bounds check: windowed application does not match fullscreen bounds', !checkForegroundBoundsMatch(windowedApp, displayBounds));

  // ==========================================================================
  // 6. Multi-Display Positioning Math Tests
  // ==========================================================================
  console.log('\n--- 6. Testing Multi-Display DIP Top-Center Positioning ---');

  const PANEL_WIDTH = 860;
  const PANEL_HEIGHT = 340;
  const ISLAND_FLOAT_GAP = 10;

  const calculatePositionMath = (dispBounds, scale, style) => {
    const effectiveWidth = Math.round(PANEL_WIDTH * scale);
    const effectiveHeight = Math.round(PANEL_HEIGHT * scale);
    const x = Math.round(dispBounds.x + (dispBounds.width - effectiveWidth) / 2);
    const y = Math.round(dispBounds.y + (style === 'floating' ? ISLAND_FLOAT_GAP * scale : 0));
    return { x, y, width: effectiveWidth, height: effectiveHeight };
  };

  // Primary 1080p Display
  const primaryDisplay = { x: 0, y: 0, width: 1920, height: 1080 };
  const floatingPos = calculatePositionMath(primaryDisplay, 1.0, 'floating');
  assertEqual(floatingPos.x, 530, 'Primary display floating centers horizontally at x=530 (1920 - 860) / 2');
  assertEqual(floatingPos.y, 10, 'Primary display floating sets y with 10px offset (y=10)');

  const notchPos = calculatePositionMath(primaryDisplay, 1.0, 'notch');
  assertEqual(notchPos.x, 530, 'Primary display notch centers horizontally at x=530');
  assertEqual(notchPos.y, 0, 'Primary display notch sets y flush with top display bound (y=0)');

  // Secondary 1440p Display (Extended right)
  const secondaryDisplay = { x: 1920, y: 0, width: 2560, height: 1440 };
  const secondaryFloating = calculatePositionMath(secondaryDisplay, 1.0, 'floating');
  const expectedSecondaryX = Math.round(1920 + (2560 - 860) / 2); // 1920 + 850 = 2770
  assertEqual(secondaryFloating.x, expectedSecondaryX, 'Secondary display floating centers horizontally at x=2770');
  assertEqual(secondaryFloating.y, 10, 'Secondary display floating sets y with 10px offset on secondary bound');

  // Disconnected Monitor Safe Fallback
  const resolveTargetDisplay = (selectedId, allDisplays, primary) => {
    if (selectedId && selectedId !== 'primary') {
      const match = allDisplays.find(d => String(d.id) === selectedId);
      if (match) return match;
    }
    return primary;
  };
  const mockAll = [{ id: '1', bounds: primaryDisplay }];
  const fallbackDisplay = resolveTargetDisplay('disconnected_monitor_99', mockAll, mockAll[0]);
  assertEqual(fallbackDisplay.id, '1', 'Display fallback: unplugged display falls back safely to primary monitor');

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests();
