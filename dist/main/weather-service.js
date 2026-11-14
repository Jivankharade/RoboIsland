"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.weatherService = exports.WeatherService = exports.WEATHER_CACHE_TTL_MS = void 0;
exports.validateCoordinates = validateCoordinates;
exports.buildWeatherUrl = buildWeatherUrl;
exports.mapWmoCodeToCondition = mapWmoCodeToCondition;
exports.formatTemperature = formatTemperature;
exports.isCacheExpired = isCacheExpired;
exports.parseWeatherPayload = parseWeatherPayload;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.WEATHER_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
/**
 * Validate latitude and longitude coordinates.
 * Throws INVALID_LATITUDE or INVALID_LONGITUDE on out-of-range inputs.
 */
function validateCoordinates(lat, lon) {
    if (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90) {
        throw new Error('INVALID_LATITUDE');
    }
    if (typeof lon !== 'number' || isNaN(lon) || lon < -180 || lon > 180) {
        throw new Error('INVALID_LONGITUDE');
    }
    return true;
}
/**
 * Construct Open-Meteo REST API URL.
 */
function buildWeatherUrl(lat, lon) {
    validateCoordinates(lat, lon);
    return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
}
/**
 * Maps WMO weather code to standard human-readable weather description.
 */
function mapWmoCodeToCondition(code) {
    if (code === 0)
        return 'Clear';
    if ([1, 2, 3].includes(code))
        return 'Partly Cloudy';
    if ([45, 48].includes(code))
        return 'Fog';
    if ([51, 53, 55].includes(code))
        return 'Drizzle';
    if ([61, 63, 65].includes(code))
        return 'Rain';
    if ([71, 73, 75, 77].includes(code))
        return 'Snow';
    if ([80, 81, 82].includes(code))
        return 'Rain Showers';
    if ([85, 86].includes(code))
        return 'Snow Showers';
    if ([95, 96, 99].includes(code))
        return 'Thunderstorm';
    return 'Overcast';
}
/**
 * Format numerical temperature as integer °C.
 */
function formatTemperature(temp) {
    return `${Math.round(temp)}°C`;
}
/**
 * Evaluates whether cache timestamp is expired (>= 30 minutes).
 */
function isCacheExpired(storedTimestamp, currentTimestamp = Date.now()) {
    return (currentTimestamp - storedTimestamp) >= exports.WEATHER_CACHE_TTL_MS;
}
/**
 * Parses raw Open-Meteo JSON payload into typed WeatherData structure.
 */
function parseWeatherPayload(payload, cityName = 'New Delhi') {
    if (!payload || !payload.current_weather) {
        throw new Error('INVALID_WEATHER_PAYLOAD');
    }
    const cw = payload.current_weather;
    const temp = typeof cw.temperature === 'number' ? Math.round(cw.temperature * 10) / 10 : 0;
    const code = typeof cw.weathercode === 'number' ? cw.weathercode : 0;
    const condition = mapWmoCodeToCondition(code);
    const wind = typeof cw.windspeed === 'number' ? cw.windspeed : 0;
    // Extract relative humidity from hourly if available
    let humidity = 50;
    if (payload.hourly && Array.isArray(payload.hourly.relativehumidity_2m) && payload.hourly.relativehumidity_2m.length > 0) {
        const rawHumidity = payload.hourly.relativehumidity_2m[0];
        if (typeof rawHumidity === 'number')
            humidity = rawHumidity;
    }
    // Extract daily forecast
    const dates = [];
    const maxTemps = [];
    const minTemps = [];
    const codes = [];
    if (payload.daily && Array.isArray(payload.daily.time)) {
        for (let i = 0; i < payload.daily.time.length; i++) {
            dates.push(String(payload.daily.time[i]));
            maxTemps.push(payload.daily.temperature_2m_max?.[i] ?? temp);
            minTemps.push(payload.daily.temperature_2m_min?.[i] ?? temp);
            codes.push(payload.daily.weathercode?.[i] ?? code);
        }
    }
    return {
        city: cityName,
        temperature: temp,
        condition,
        conditionCode: code,
        humidity,
        windspeed: wind,
        forecast: {
            dates,
            maxTemps,
            minTemps,
            codes
        },
        cached: false,
        timestamp: Date.now()
    };
}
/**
 * WeatherService: Open-Meteo client with 30-minute in-memory & disk cache fallback.
 */
class WeatherService {
    cache = null;
    cacheFilePath;
    pollTimer = null;
    defaultLat = 28.6139;
    defaultLon = 77.2090;
    defaultCity = 'New Delhi';
    constructor() {
        const userDataPath = (electron_1.app && typeof electron_1.app.getPath === 'function')
            ? electron_1.app.getPath('userData')
            : (process.env.APPDATA ? path.join(process.env.APPDATA, 'RoboIsland') : path.join(process.cwd(), '.roboisland'));
        if (!fs.existsSync(userDataPath)) {
            try {
                fs.mkdirSync(userDataPath, { recursive: true });
            }
            catch { }
        }
        this.cacheFilePath = path.join(userDataPath, 'weather-cache.json');
        this.loadCacheFromDisk();
        this.setupIPC();
    }
    loadCacheFromDisk() {
        try {
            if (fs.existsSync(this.cacheFilePath)) {
                const raw = fs.readFileSync(this.cacheFilePath, 'utf8');
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed.temperature === 'number') {
                    this.cache = { ...parsed, cached: true };
                }
            }
        }
        catch (err) {
            console.warn('[WeatherService] Could not read disk cache:', err);
        }
    }
    saveCacheToDisk(data) {
        try {
            fs.writeFileSync(this.cacheFilePath, JSON.stringify(data, null, 2), 'utf8');
        }
        catch (err) {
            console.warn('[WeatherService] Could not write disk cache:', err);
        }
    }
    /**
     * Geocode a city name into coordinates using Open-Meteo Geocoding API.
     */
    async geocodeCity(cityName) {
        try {
            const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`;
            const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
            if (res.ok) {
                const json = await res.json();
                if (json.results && json.results.length > 0) {
                    const first = json.results[0];
                    return {
                        lat: first.latitude,
                        lon: first.longitude,
                        name: first.name || cityName
                    };
                }
            }
        }
        catch { }
        return null;
    }
    /**
     * Fetch live weather data from Open-Meteo with 30-min cache fallback.
     */
    async fetchWeather(forceRefresh = false, lat, lon, city) {
        const targetLat = lat ?? this.defaultLat;
        const targetLon = lon ?? this.defaultLon;
        const targetCity = city ?? this.defaultCity;
        // Return in-memory or disk cache if fresh and not forced
        if (!forceRefresh && this.cache && !isCacheExpired(this.cache.timestamp)) {
            return { ...this.cache, cached: true };
        }
        try {
            const url = buildWeatherUrl(targetLat, targetLon);
            const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
            if (res.ok) {
                const json = await res.json();
                const freshData = parseWeatherPayload(json, targetCity);
                this.cache = freshData;
                this.saveCacheToDisk(freshData);
                this.broadcastWeather(freshData);
                return freshData;
            }
        }
        catch (err) {
            console.warn('[WeatherService] Network fetch failed, using cached fallback:', err);
        }
        // Network failure: return last known cached data if available
        if (this.cache) {
            return { ...this.cache, cached: true };
        }
        // Default safe fallback if network failed and no cache exists
        const fallback = {
            city: targetCity,
            temperature: 22.0,
            condition: 'Clear',
            conditionCode: 0,
            humidity: 50,
            windspeed: 5.0,
            forecast: {
                dates: [new Date().toISOString().split('T')[0]],
                maxTemps: [26.0],
                minTemps: [18.0],
                codes: [0]
            },
            cached: true,
            timestamp: Date.now()
        };
        this.cache = fallback;
        return fallback;
    }
    getCachedData() {
        return this.cache;
    }
    startPolling(intervalMs = 30 * 60 * 1000) {
        if (this.pollTimer)
            clearInterval(this.pollTimer);
        // Initial fetch
        this.fetchWeather().catch(() => { });
        this.pollTimer = setInterval(() => {
            this.fetchWeather(true).catch(() => { });
        }, Math.max(60000, intervalMs));
        if (this.pollTimer && typeof this.pollTimer.unref === 'function') {
            this.pollTimer.unref();
        }
    }
    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }
    dispose() {
        this.stopPolling();
    }
    broadcastWeather(data) {
        try {
            if (!electron_1.BrowserWindow || typeof electron_1.BrowserWindow.getAllWindows !== 'function')
                return;
            const windows = electron_1.BrowserWindow.getAllWindows();
            for (const win of windows) {
                if (!win.isDestroyed()) {
                    win.webContents.send('weather:updated', data);
                }
            }
        }
        catch { }
    }
    setupIPC() {
        if (!electron_1.ipcMain || typeof electron_1.ipcMain.handle !== 'function')
            return;
        try {
            electron_1.ipcMain.removeHandler('weather:get-data');
        }
        catch { }
        electron_1.ipcMain.handle('weather:get-data', async () => {
            return this.fetchWeather();
        });
        try {
            electron_1.ipcMain.removeHandler('weather:refresh');
        }
        catch { }
        electron_1.ipcMain.handle('weather:refresh', async (_event, lat, lon, city) => {
            return this.fetchWeather(true, lat, lon, city);
        });
    }
}
exports.WeatherService = WeatherService;
exports.weatherService = new WeatherService();
