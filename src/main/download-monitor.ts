import { app, BrowserWindow, shell, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export interface ActiveDownloadInfo {
  filename: string;
  cleanName: string;
  tempPath: string;
  finalPath: string;
  bytes: number;
  totalBytes?: number;
  percent?: number;
  speedStr?: string;
  status: 'downloading' | 'complete' | 'error';
  startTime: number;
  lastBytes?: number;
  lastTime?: number;
}

export class DownloadMonitor {
  private downloadsPath: string;
  private watcher: fs.FSWatcher | null = null;
  private activeDownloads: Map<string, ActiveDownloadInfo> = new Map();
  private pollTimer: NodeJS.Timeout | null = null;
  private isDisposed = false;

  constructor() {
    try {
      this.downloadsPath = app.getPath('downloads');
    } catch {
      this.downloadsPath = path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'Downloads');
    }

    this.startWatcher();
    this.setupIPC();
  }

  private startWatcher(): void {
    if (!fs.existsSync(this.downloadsPath)) return;

    try {
      // Windows kernel ReadDirectoryChangesW watcher (0% CPU at idle)
      this.watcher = fs.watch(this.downloadsPath, { persistent: false }, (_eventType, filename) => {
        if (!filename) return;
        this.handleFileChange(filename);
      });

      this.watcher.on('error', (err) => {
        console.warn('[DownloadMonitor] Watcher error:', err);
      });
    } catch (err) {
      console.warn('[DownloadMonitor] Failed to start fs.watch:', err);
    }
  }

  public formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  private ensurePollLoop(): void {
    if (this.pollTimer || this.isDisposed) return;
    this.pollTimer = setInterval(() => {
      if (this.activeDownloads.size > 0) {
        this.checkActiveDownloads();
      } else if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    }, 450);
    if (this.pollTimer.unref) this.pollTimer.unref();
  }

  private handleFileChange(filename: string): void {
    // 1. Chrome / Chromium initial placeholder: "Unconfirmed 12345.crdownload"
    // ALWAYS ignore unconfirmed placeholder until Chrome negotiates headers and renames to the actual file!
    if (/^unconfirmed/i.test(filename)) {
      return;
    }

    const isCrDownload = filename.toLowerCase().endsWith('.crdownload');
    const isPartDownload = filename.toLowerCase().endsWith('.part');

    if (isCrDownload || isPartDownload) {
      const fullPath = path.join(this.downloadsPath, filename);
      // Clean target name: remove .crdownload or .part extension
      const cleanName = filename.replace(/\.(crdownload|part)$/i, '');

      // Double-check cleanName is not an unconfirmed prefix
      if (/^unconfirmed/i.test(cleanName)) return;

      if (!this.activeDownloads.has(filename)) {
        let bytes = 0;
        try {
          if (fs.existsSync(fullPath)) {
            bytes = fs.statSync(fullPath).size;
          }
        } catch {}

        const now = Date.now();
        const info: ActiveDownloadInfo = {
          filename,
          cleanName,
          tempPath: fullPath,
          finalPath: path.join(this.downloadsPath, cleanName),
          bytes,
          lastBytes: bytes,
          lastTime: now,
          status: 'downloading',
          startTime: now
        };

        this.activeDownloads.set(filename, info);
        this.ensurePollLoop();
        this.broadcastDownloadActive(info);
      }
    } else {
      // A non-temporary file appeared or was renamed: check if it matches a pending download
      for (const [tempName, info] of this.activeDownloads.entries()) {
        if (filename.toLowerCase() === info.cleanName.toLowerCase()) {
          const finalPath = path.join(this.downloadsPath, filename);
          if (fs.existsSync(finalPath)) {
            this.activeDownloads.delete(tempName);
            info.status = 'complete';
            info.finalPath = finalPath;
            this.broadcastDownloadComplete(info);
          }
        }
      }
    }
  }

  private checkActiveDownloads(): void {
    const now = Date.now();
    for (const [tempName, info] of this.activeDownloads.entries()) {
      if (!fs.existsSync(info.tempPath)) {
        // Temp file is gone: check if final file was produced
        const finalPath = path.join(this.downloadsPath, info.cleanName);
        if (fs.existsSync(finalPath)) {
          this.activeDownloads.delete(tempName);
          info.status = 'complete';
          info.finalPath = finalPath;
          this.broadcastDownloadComplete(info);
        } else {
          // Download was cancelled or failed by the user / browser!
          // User requirement: "and when not download it show red"
          this.activeDownloads.delete(tempName);
          info.status = 'error';
          this.broadcastDownloadError(info);
        }
      } else {
        try {
          const stats = fs.statSync(info.tempPath);
          const currentBytes = stats.size;
          const timeDiff = Math.max(150, now - (info.lastTime || info.startTime));
          const byteDiff = Math.max(0, currentBytes - (info.lastBytes || 0));
          const speedBytesPerSec = Math.round((byteDiff / timeDiff) * 1000);

          info.bytes = currentBytes;
          info.lastBytes = currentBytes;
          info.lastTime = now;
          if (speedBytesPerSec > 0) {
            info.speedStr = `${this.formatBytes(speedBytesPerSec)}/s`;
          }

          this.broadcastDownloadActive(info);
        } catch {}
      }
    }
  }

  private broadcastDownloadActive(info: ActiveDownloadInfo): void {
    const sizeStr = this.formatBytes(info.bytes);
    const speed = info.speedStr ? ` • ${info.speedStr}` : '';
    const payload = {
      id: 'dl-progress-' + info.cleanName,
      app: 'Downloads',
      title: info.cleanName,
      body: `${sizeStr}${speed}`,
      kind: 'download',
      status: 'downloading',
      bytes: info.bytes,
      sizeStr,
      speedStr: info.speedStr,
      durationMs: 4000
    };

    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('island:notify', payload);
      }
    });
  }

  private broadcastDownloadComplete(info: ActiveDownloadInfo): void {
    const payload = {
      id: 'dl-complete-' + Date.now(),
      app: 'Downloads',
      title: 'Download Complete',
      body: info.cleanName,
      kind: 'download',
      status: 'complete',
      filePath: info.finalPath,
      durationMs: 5000
    };

    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('island:notify', payload);
      }
    });
  }

  private broadcastDownloadError(info: ActiveDownloadInfo): void {
    const payload = {
      id: 'dl-error-' + Date.now(),
      app: 'Downloads',
      title: 'Download Cancelled',
      body: info.cleanName,
      kind: 'download',
      status: 'error',
      durationMs: 4500
    };

    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('island:notify', payload);
      }
    });
  }

  /**
   * Helper method to simulate a download or toast notification for tests/settings.
   */
  public simulateNotification(payload: { title: string; body: string; kind?: string; app?: string; status?: string; filePath?: string }): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('island:notify', {
          id: 'sim-' + Date.now(),
          app: payload.app || 'RoboIsland',
          title: payload.title,
          body: payload.body,
          kind: payload.kind || 'info',
          status: payload.status,
          filePath: payload.filePath,
          durationMs: 5000
        });
      }
    });
  }

  private setupIPC(): void {
    if (!ipcMain || typeof ipcMain.handle !== 'function') return;
    try {
      ipcMain.removeHandler('tools:show-item-in-folder');
    } catch {}
    ipcMain.handle('tools:show-item-in-folder', (_event, filePath: string) => {
      if (filePath && fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath);
        return true;
      }
      return false;
    });

    try {
      ipcMain.removeHandler('system:simulate-toast');
    } catch {}
    ipcMain.handle('system:simulate-toast', (_event, payload: any) => {
      this.simulateNotification(payload);
      return true;
    });
  }

  public dispose(): void {
    this.isDisposed = true;
    if (this.watcher) {
      try { this.watcher.close(); } catch {}
      this.watcher = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
