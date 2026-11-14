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
exports.systemMetricsEngine = exports.SystemMetricsEngine = void 0;
exports.sampleCpuTicks = sampleCpuTicks;
exports.calculateCpuUsage = calculateCpuUsage;
exports.calculateRamUsage = calculateRamUsage;
exports.clampInterval = clampInterval;
exports.formatTime12 = formatTime12;
exports.formatTime24 = formatTime24;
exports.formatClockTime = formatClockTime;
exports.clampOpacity = clampOpacity;
exports.getBackgroundWithOpacity = getBackgroundWithOpacity;
const electron_1 = require("electron");
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
/**
 * Samples current CPU ticks from os.cpus().
 * Aggregates user, nice, sys, idle, irq across all logical cores.
 */
function sampleCpuTicks(cpus = os.cpus()) {
    let idle = 0;
    let total = 0;
    if (!Array.isArray(cpus) || cpus.length === 0) {
        return { idle: 0, total: 0 };
    }
    for (const cpu of cpus) {
        if (!cpu || !cpu.times)
            continue;
        const times = cpu.times;
        const coreTotal = times.user + times.nice + times.sys + times.idle + times.irq;
        total += coreTotal;
        idle += times.idle;
    }
    return { idle, total };
}
/**
 * Differential CPU active vs idle percentage calculation.
 * Measures delta of idle ticks against total ticks since previous sample.
 * Clamped strictly between 0 and 100. Returns 0 on zero delta.
 */
function calculateCpuUsage(prev, curr) {
    const idleDelta = curr.idle - prev.idle;
    const totalDelta = curr.total - prev.total;
    if (totalDelta <= 0) {
        return 0;
    }
    const raw = (1 - idleDelta / totalDelta) * 100;
    return Math.max(0, Math.min(100, Math.round(raw)));
}
/**
 * Computes used RAM percentage from total and free memory bytes.
 * Clamped strictly between 0 and 100.
 */
function calculateRamUsage(total = os.totalmem(), free = os.freemem()) {
    if (total <= 0) {
        return 0;
    }
    const used = Math.max(0, total - free);
    const pct = (used / total) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
}
/**
 * Telemetry poller interval clamp (minimum 500ms).
 */
function clampInterval(ms) {
    if (typeof ms !== 'number' || isNaN(ms))
        return 2000;
    return Math.max(500, Math.round(ms));
}
// ============================================================================
// 12/24 Clock Format Functions
// ============================================================================
/**
 * Formats time in 12-hour format with AM/PM (e.g. "12:15 AM", "12:00 PM", "2:30 PM").
 */
function formatTime12(hours, minutes) {
    const period = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    const m = String(minutes).padStart(2, '0');
    return `${h12}:${m} ${period}`;
}
/**
 * Formats military time in 24-hour format with 2-digit zero padding (e.g. "09:05", "23:59").
 */
function formatTime24(hours, minutes) {
    const h = String(hours).padStart(2, '0');
    const m = String(minutes).padStart(2, '0');
    return `${h}:${m}`;
}
/**
 * Format clock time according to 12h or 24h format setting.
 */
function formatClockTime(date = new Date(), format = '12h') {
    const h = date.getHours();
    const m = date.getMinutes();
    return format === '24h' ? formatTime24(h, m) : formatTime12(h, m);
}
// ============================================================================
// Opacity Control Helpers
// ============================================================================
/**
 * Clamps opacity value between 0.1 and 1.0. Non-numeric or NaN input defaults to 1.0.
 */
function clampOpacity(val) {
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num))
        return 1.0;
    return Math.max(0.1, Math.min(1.0, Math.round(num * 100) / 100));
}
/**
 * Generates RGBA color string with specified opacity alpha channel.
 */
function getBackgroundWithOpacity(alpha) {
    const clamped = clampOpacity(alpha);
    return `rgba(18, 20, 26, ${clamped})`;
}
// ============================================================================
// SystemMetricsEngine Class
// ============================================================================
class SystemMetricsEngine {
    prevTicks;
    timer = null;
    intervalMs = 2000;
    latestMetrics;
    constructor(initialIntervalMs = 2000) {
        this.intervalMs = clampInterval(initialIntervalMs);
        this.prevTicks = sampleCpuTicks();
        this.latestMetrics = this.computeMetrics();
        this.setupIPC();
        this.start();
    }
    computeMetrics() {
        const currentTicks = sampleCpuTicks();
        const cpu = calculateCpuUsage(this.prevTicks, currentTicks);
        this.prevTicks = currentTicks;
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const ram = calculateRamUsage(totalMem, freeMem);
        const totalMemMb = Math.round(totalMem / (1024 * 1024));
        const freeMemMb = Math.round(freeMem / (1024 * 1024));
        const usedMemMb = Math.max(0, totalMemMb - freeMemMb);
        const cores = os.cpus().length || 1;
        let storage = { totalGb: 256, freeGb: 128, usedGb: 128, percent: 50 };
        try {
            const rootPath = process.platform === 'win32' ? (process.env.SystemDrive ? `${process.env.SystemDrive}\\` : 'C:\\') : '/';
            const stat = fs.statfsSync(rootPath);
            const totalGb = Math.round((stat.bsize * stat.blocks) / (1024 * 1024 * 1024));
            const freeGb = Math.round((stat.bsize * stat.bavail) / (1024 * 1024 * 1024));
            const usedGb = Math.max(0, totalGb - freeGb);
            const percent = totalGb > 0 ? Math.max(0, Math.min(100, Math.round((usedGb / totalGb) * 100))) : 0;
            storage = { totalGb, freeGb, usedGb, percent };
        }
        catch { }
        this.latestMetrics = {
            cpu,
            ram,
            storage,
            cores,
            totalMemMb,
            freeMemMb,
            usedMemMb,
            timestamp: Date.now()
        };
        return this.latestMetrics;
    }
    getMetrics() {
        return { ...this.latestMetrics };
    }
    setInterval(ms) {
        this.intervalMs = clampInterval(ms);
        if (this.timer) {
            this.stop();
            this.start();
        }
    }
    start() {
        if (this.timer)
            clearInterval(this.timer);
        this.timer = setInterval(() => {
            const metrics = this.computeMetrics();
            this.broadcastMetrics(metrics);
        }, this.intervalMs);
        if (this.timer && typeof this.timer.unref === 'function') {
            this.timer.unref();
        }
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    dispose() {
        this.stop();
    }
    broadcastMetrics(metrics) {
        try {
            if (!electron_1.BrowserWindow || typeof electron_1.BrowserWindow.getAllWindows !== 'function')
                return;
            const windows = electron_1.BrowserWindow.getAllWindows();
            for (const win of windows) {
                if (!win.isDestroyed()) {
                    win.webContents.send('system:metrics', metrics);
                }
            }
        }
        catch { }
    }
    setupIPC() {
        if (!electron_1.ipcMain || typeof electron_1.ipcMain.handle !== 'function')
            return;
        try {
            electron_1.ipcMain.removeHandler('system:get-metrics');
        }
        catch { }
        electron_1.ipcMain.handle('system:get-metrics', () => {
            return this.computeMetrics();
        });
        try {
            electron_1.ipcMain.removeHandler('system:set-metrics-interval');
        }
        catch { }
        electron_1.ipcMain.handle('system:set-metrics-interval', (_event, intervalMs) => {
            this.setInterval(intervalMs);
            return this.intervalMs;
        });
    }
}
exports.SystemMetricsEngine = SystemMetricsEngine;
exports.systemMetricsEngine = new SystemMetricsEngine();
