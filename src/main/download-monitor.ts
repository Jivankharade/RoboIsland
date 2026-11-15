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
  private scanTimer: NodeJS.Timeout | null = null;
  private isDisposed = false;

  constructor() {
    try {
      this.downloadsPath = app.getPath('downloads');
    } catch {
      this.downloadsPath = path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'Downloads');
    }

    this.startWatcher();
    this.startPeriodicScan();
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

  private startPeriodicScan(): void {
    // Run an immediate directory sweep on startup
    this.scanDownloadsDir();

    // Background scan every 1200ms to catch any missed or throttled filesystem events
    this.scanTimer = setInterval(() => {
      this.scanDownloadsDir();
    }, 1200);
    if (this.scanTimer.unref) this.scanTimer.unref();
  }

  /**
   * Fast non-blocking tail scan of Chrome / Edge history binary (<12ms)
   * Resolves the real target filename for "Unconfirmed *.crdownload" placeholders
   */
  public tryResolveChromeTargetName(placeholder: string): string | null {
    const historyCandidates = [
      path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'Default', 'History'),
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data', 'Default', 'History')
    ];

    for (const hPath of historyCandidates) {
      if (!fs.existsSync(hPath)) continue;
      try {
        const stat = fs.statSync(hPath);
        if (stat.size <= 0) continue;
        const fd = fs.openSync(hPath, 'r');
        const bufSize = Math.min(stat.size, 128 * 1024); // read last 128KB tail
        const buf = Buffer.alloc(bufSize);
        fs.readSync(fd, buf, 0, bufSize, Math.max(0, stat.size - bufSize));
        fs.closeSync(fd);
        const str = buf.toString('latin1');
        const matches = str.match(/([a-zA-Z0-9_\-\.\(\) ]{3,80}\.(mp4|mp3|zip|exe|pdf|docx|xlsx|iso|mkv|msi|tar|gz|jpg|png|webp|crx|7z|dmg|pkg))/gi);
        if (matches && matches.length > 0) {
          const cand = matches[matches.length - 1];
          if (cand && !/^unconfirmed/i.test(cand)) {
            return cand;
          }
        }
      } catch {}
    }
    return null;
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
    const isCrDownload = filename.toLowerCase().endsWith('.crdownload');
    const isPartDownload = filename.toLowerCase().endsWith('.part');

    if (isCrDownload || isPartDownload) {
      const fullPath = path.join(this.downloadsPath, filename);
      let cleanName = filename.replace(/\.(crdownload|part)$/i, '');

      // Resolve actual target filename from Chrome History or fallback cleanly
      if (/^unconfirmed/i.test(cleanName)) {
        const resolved = this.tryResolveChromeTargetName(filename);
        cleanName = resolved || 'Chrome Download';
      }

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
        this.broadcastDownloadsUpdate();
      }
    } else {
      // A non-temporary file appeared or was renamed: check if it matches a pending download
      for (const [tempName, info] of this.activeDownloads.entries()) {
        if (filename.toLowerCase() === info.cleanName.toLowerCase() || info.cleanName === 'Chrome Download') {
          const finalPath = path.join(this.downloadsPath, filename);
          if (fs.existsSync(finalPath)) {
            this.activeDownloads.delete(tempName);
            info.status = 'complete';
            info.cleanName = filename;
            info.finalPath = finalPath;
            this.broadcastDownloadComplete(info);
            this.broadcastDownloadsUpdate();
          }
        }
      }
    }
  }

  public scanDownloadsDir(): void {
    if (!fs.existsSync(this.downloadsPath) || this.isDisposed) return;
    try {
      const files = fs.readdirSync(this.downloadsPath);
      let changed = false;

      const currentTempFiles = new Set<string>();
      for (const file of files) {
        const lower = file.toLowerCase();
        if (lower.endsWith('.crdownload') || lower.endsWith('.part')) {
          currentTempFiles.add(file);
          if (!this.activeDownloads.has(file)) {
            this.handleFileChange(file);
            changed = true;
          }
        }
      }

      // Check for removed temp files in activeDownloads
      for (const [tempName, info] of this.activeDownloads.entries()) {
        if (!currentTempFiles.has(tempName)) {
          const finalExists = fs.existsSync(info.finalPath);
          this.activeDownloads.delete(tempName);
          changed = true;
          if (finalExists) {
            info.status = 'complete';
            this.broadcastDownloadComplete(info);
          } else {
            // Check if any recently created file matches
            let foundFinal = false;
            const now = Date.now();
            try {
              for (const f of files) {
                if (f.endsWith('.crdownload') || f.endsWith('.part')) continue;
                const fPath = path.join(this.downloadsPath, f);
                const st = fs.statSync(fPath);
                if (now - st.mtimeMs < 4000) {
                  info.status = 'complete';
                  info.cleanName = f;
                  info.finalPath = fPath;
                  this.broadcastDownloadComplete(info);
                  foundFinal = true;
                  break;
                }
              }
            } catch {}

            if (!foundFinal) {
              info.status = 'error';
              this.broadcastDownloadError(info);
            }
          }
        }
      }

      if (changed) {
        this.broadcastDownloadsUpdate();
      }
    } catch {}
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
          // Check for recent file in Downloads
          let foundFile: string | null = null;
          try {
            const files = fs.readdirSync(this.downloadsPath);
            for (const f of files) {
              if (f.endsWith('.crdownload') || f.endsWith('.part')) continue;
              const fPath = path.join(this.downloadsPath, f);
              const st = fs.statSync(fPath);
              if (now - st.mtimeMs < 3500) {
                foundFile = f;
                break;
              }
            }
          } catch {}

          this.activeDownloads.delete(tempName);
          if (foundFile) {
            info.status = 'complete';
            info.cleanName = foundFile;
            info.finalPath = path.join(this.downloadsPath, foundFile);
            this.broadcastDownloadComplete(info);
          } else {
            // Cancelled or failed
            info.status = 'error';
            this.broadcastDownloadError(info);
          }
        }
        this.broadcastDownloadsUpdate();
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

          // Try re-resolving clean name if it's still 'Chrome Download'
          if (info.cleanName === 'Chrome Download') {
            const resolved = this.tryResolveChromeTargetName(info.filename);
            if (resolved) {
              info.cleanName = resolved;
              info.finalPath = path.join(this.downloadsPath, resolved);
            }
          }

          this.broadcastDownloadActive(info);
          this.broadcastDownloadsUpdate();
        } catch {}
      }
    }
  }

  public broadcastDownloadsUpdate(): void {
    const list = Array.from(this.activeDownloads.values()).map(d => ({
      filename: d.filename,
      cleanName: d.cleanName,
      bytes: d.bytes,
      speedStr: d.speedStr,
      status: d.status,
      finalPath: d.finalPath,
      tempPath: d.tempPath
    }));

    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('island:downloads-update', {
          count: list.length,
          downloads: list
        });
      }
    });
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

  public getActiveDownloadsList(): ActiveDownloadInfo[] {
    return Array.from(this.activeDownloads.values());
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
      ipcMain.removeHandler('downloads:get-active');
    } catch {}
    ipcMain.handle('downloads:get-active', () => {
      return Array.from(this.activeDownloads.values()).map(d => ({
        filename: d.filename,
        cleanName: d.cleanName,
        bytes: d.bytes,
        speedStr: d.speedStr,
        status: d.status,
        finalPath: d.finalPath,
        tempPath: d.tempPath
      }));
    });

    try {
      ipcMain.removeHandler('system:simulate-toast');
    } catch {}
    ipcMain.handle('system:simulate-toast', (_event, payload: any) => {
      this.simulateNotification(payload);
      return true;
    });

    try {
      ipcMain.removeHandler('system:simulate-downloads');
    } catch {}
    ipcMain.handle('system:simulate-downloads', (_event, count: number = 2) => {
      this.activeDownloads.clear();
      for (let i = 1; i <= count; i++) {
        const dummy: ActiveDownloadInfo = {
          filename: `download-${i}.zip.crdownload`,
          cleanName: i === 1 ? 'Chromium-Build-win64.zip' : 'Node-v22.14.0-x64.msi',
          tempPath: path.join(this.downloadsPath, `download-${i}.zip.crdownload`),
          finalPath: path.join(this.downloadsPath, i === 1 ? 'Chromium-Build-win64.zip' : 'Node-v22.14.0-x64.msi'),
          bytes: i * 18 * 1024 * 1024,
          speedStr: `${(2.4 * i).toFixed(1)} MB/s`,
          status: 'downloading',
          startTime: Date.now()
        };
        this.activeDownloads.set(dummy.filename, dummy);
      }
      this.broadcastDownloadsUpdate();
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
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
  }
}
