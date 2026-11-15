import { app, BrowserWindow, shell, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export interface ActiveDownloadInfo {
  filename: string;
  cleanName: string;
  tempPath: string;
  finalPath: string;
  bytes: number;
  status: 'downloading' | 'complete';
  startTime: number;
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

    // Periodic check (every 2.5s) to track download file growth while active
    this.pollTimer = setInterval(() => {
      if (this.activeDownloads.size > 0) {
        this.checkActiveDownloads();
      }
    }, 2500);
    if (this.pollTimer.unref) this.pollTimer.unref();
  }

  private handleFileChange(filename: string): void {
    const isCrDownload = filename.endsWith('.crdownload');
    const isPartDownload = filename.endsWith('.part');

    if (isCrDownload || isPartDownload) {
      const fullPath = path.join(this.downloadsPath, filename);
      const cleanName = filename.replace(/\.(crdownload|part)$/i, '').replace(/^Unconfirmed\s+\d+\./i, '');

      if (!this.activeDownloads.has(filename)) {
        let bytes = 0;
        try {
          if (fs.existsSync(fullPath)) {
            bytes = fs.statSync(fullPath).size;
          }
        } catch {}

        const info: ActiveDownloadInfo = {
          filename,
          cleanName,
          tempPath: fullPath,
          finalPath: path.join(this.downloadsPath, cleanName),
          bytes,
          status: 'downloading',
          startTime: Date.now()
        };

        this.activeDownloads.set(filename, info);
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
          // Cancelled download
          this.activeDownloads.delete(tempName);
        }
      } else {
        try {
          const stats = fs.statSync(info.tempPath);
          info.bytes = stats.size;
        } catch {}
      }
    }
  }

  private broadcastDownloadActive(info: ActiveDownloadInfo): void {
    const payload = {
      id: 'dl-progress-' + info.cleanName,
      app: 'Downloads',
      title: 'Downloading...',
      body: info.cleanName,
      kind: 'download',
      durationMs: 3500
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
      filePath: info.finalPath,
      durationMs: 5000
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
  public simulateNotification(payload: { title: string; body: string; kind?: string; app?: string }): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('island:notify', {
          id: 'sim-' + Date.now(),
          app: payload.app || 'RoboIsland',
          title: payload.title,
          body: payload.body,
          kind: payload.kind || 'info',
          durationMs: 5000
        });
      }
    });
  }

  private setupIPC(): void {
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
