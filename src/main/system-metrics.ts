import { BrowserWindow, ipcMain } from 'electron';
import * as os from 'os';
import * as fs from 'fs';

export interface CpuTicks {
  idle: number;
  total: number;
}

export interface StorageMetrics {
  totalGb: number;
  freeGb: number;
  usedGb: number;
  percent: number;
}

export interface SystemMetrics {
  cpu: number;
  ram: number;
  storage?: StorageMetrics;
  cores: number;
  totalMemMb: number;
  freeMemMb: number;
  usedMemMb: number;
  timestamp: number;
}

/**
 * Samples current CPU ticks from os.cpus().
 * Aggregates user, nice, sys, idle, irq across all logical cores.
 */
export function sampleCpuTicks(cpus: os.CpuInfo[] = os.cpus()): CpuTicks {
  let idle = 0;
  let total = 0;

  if (!Array.isArray(cpus) || cpus.length === 0) {
    return { idle: 0, total: 0 };
  }

  for (const cpu of cpus) {
    if (!cpu || !cpu.times) continue;
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
export function calculateCpuUsage(prev: CpuTicks, curr: CpuTicks): number {
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
export function calculateRamUsage(total: number = os.totalmem(), free: number = os.freemem()): number {
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
export function clampInterval(ms: number): number {
  if (typeof ms !== 'number' || isNaN(ms)) return 2000;
  return Math.max(500, Math.round(ms));
}

// ============================================================================
// 12/24 Clock Format Functions
// ============================================================================

/**
 * Formats time in 12-hour format with AM/PM (e.g. "12:15 AM", "12:00 PM", "2:30 PM").
 */
export function formatTime12(hours: number, minutes: number): string {
  const period = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  const m = String(minutes).padStart(2, '0');
  return `${h12}:${m} ${period}`;
}

/**
 * Formats military time in 24-hour format with 2-digit zero padding (e.g. "09:05", "23:59").
 */
export function formatTime24(hours: number, minutes: number): string {
  const h = String(hours).padStart(2, '0');
  const m = String(minutes).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Format clock time according to 12h or 24h format setting.
 */
export function formatClockTime(date: Date = new Date(), format: '12h' | '24h' = '12h'): string {
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
export function clampOpacity(val: any): number {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return 1.0;
  return Math.max(0.1, Math.min(1.0, Math.round(num * 100) / 100));
}

/**
 * Generates RGBA color string with specified opacity alpha channel.
 */
export function getBackgroundWithOpacity(alpha: number): string {
  const clamped = clampOpacity(alpha);
  return `rgba(18, 20, 26, ${clamped})`;
}

// ============================================================================
// SystemMetricsEngine Class
// ============================================================================

export class SystemMetricsEngine {
  private prevTicks: CpuTicks;
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number = 2000;
  private latestMetrics: SystemMetrics;
  private cachedStorage: StorageMetrics = { totalGb: 256, freeGb: 128, usedGb: 128, percent: 50 };
  private lastStorageSampleAt = 0;

  constructor(initialIntervalMs: number = 2000) {
    this.intervalMs = clampInterval(initialIntervalMs);
    this.prevTicks = sampleCpuTicks();
    this.latestMetrics = this.computeMetrics();
    this.setupIPC();
    this.start();
  }

  public computeMetrics(): SystemMetrics {
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

    let storage: StorageMetrics = this.cachedStorage;
    const now = Date.now();
    if (now - this.lastStorageSampleAt > 30000) {
      try {
        const rootPath = process.platform === 'win32' ? (process.env.SystemDrive ? `${process.env.SystemDrive}\\` : 'C:\\') : '/';
        const stat = fs.statfsSync(rootPath);
        const totalGb = Math.round((stat.bsize * stat.blocks) / (1024 * 1024 * 1024));
        const freeGb = Math.round((stat.bsize * stat.bavail) / (1024 * 1024 * 1024));
        const usedGb = Math.max(0, totalGb - freeGb);
        const percent = totalGb > 0 ? Math.max(0, Math.min(100, Math.round((usedGb / totalGb) * 100))) : 0;
        storage = { totalGb, freeGb, usedGb, percent };
        this.cachedStorage = storage;
        this.lastStorageSampleAt = now;
      } catch {}
    }

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

  public getMetrics(): SystemMetrics {
    return { ...this.latestMetrics };
  }

  public setInterval(ms: number): void {
    this.intervalMs = clampInterval(ms);
    if (this.timer) {
      this.stop();
      this.start();
    }
  }

  public start(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      const metrics = this.computeMetrics();
      this.broadcastMetrics(metrics);
    }, this.intervalMs);
    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public dispose(): void {
    this.stop();
  }

  private broadcastMetrics(metrics: SystemMetrics): void {
    try {
      if (!BrowserWindow || typeof BrowserWindow.getAllWindows !== 'function') return;
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('system:metrics', metrics);
        }
      }
    } catch {}
  }

  private setupIPC(): void {
    if (!ipcMain || typeof ipcMain.handle !== 'function') return;
    try {
      ipcMain.removeHandler('system:get-metrics');
    } catch {}
    ipcMain.handle('system:get-metrics', () => {
      return this.computeMetrics();
    });

    try {
      ipcMain.removeHandler('system:set-metrics-interval');
    } catch {}
    ipcMain.handle('system:set-metrics-interval', (_event, intervalMs: number) => {
      this.setInterval(intervalMs);
      return this.intervalMs;
    });
  }
}

export const systemMetricsEngine = new SystemMetricsEngine();
