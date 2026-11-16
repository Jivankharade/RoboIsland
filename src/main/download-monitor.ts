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
  browser?: string;
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

    // Background scan fallback (every 15s) to catch any missed or throttled filesystem events
    this.scanTimer = setInterval(() => {
      this.scanDownloadsDir();
    }, 15000);
    if (this.scanTimer.unref) this.scanTimer.unref();
  }

  /**
   * Fast non-blocking tail scan of Brave / Chrome / Edge history binary (<12ms)
   * Resolves the real target filename for "Unconfirmed *.crdownload" placeholders
   */
  public tryResolveChromeTargetName(placeholder: string): string | null {
    const res = this.tryResolveBrowserTargetName(placeholder);
    return res ? res.name : null;
  }

  public tryResolveBrowserTargetName(placeholder: string): { name: string; browser: string } | null {
    const localAppData = process.env.LOCALAPPDATA || '';
    const homeDir = process.env.HOME || app.getPath('home');

    const historyCandidates = [
      // 1. Brave Browser (Windows)
      { path: path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'History'), browser: 'brave' },
      { path: path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Profile 1', 'History'), browser: 'brave' },
      { path: path.join(localAppData, 'BraveSoftware', 'Brave-Browser-Beta', 'User Data', 'Default', 'History'), browser: 'brave' },
      { path: path.join(localAppData, 'BraveSoftware', 'Brave-Browser-Nightly', 'User Data', 'Default', 'History'), browser: 'brave' },

      // 2. Google Chrome (Windows)
      { path: path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'History'), browser: 'chrome' },
      { path: path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Profile 1', 'History'), browser: 'chrome' },

      // 3. Microsoft Edge (Windows)
      { path: path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'History'), browser: 'edge' },
      { path: path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Profile 1', 'History'), browser: 'edge' },

      // 4. Brave Browser (Linux Fedora / KDE Plasma / Flatpak)
      { path: path.join(homeDir, '.config', 'BraveSoftware', 'Brave-Browser', 'Default', 'History'), browser: 'brave' },
      { path: path.join(homeDir, '.config', 'BraveSoftware', 'Brave-Browser', 'Profile 1', 'History'), browser: 'brave' },
      { path: path.join(homeDir, '.var', 'app', 'com.brave.Browser', 'config', 'BraveSoftware', 'Brave-Browser', 'Default', 'History'), browser: 'brave' },

      // 5. Google Chrome & Microsoft Edge (Linux)
      { path: path.join(homeDir, '.config', 'google-chrome', 'Default', 'History'), browser: 'chrome' },
      { path: path.join(homeDir, '.config', 'microsoft-edge', 'Default', 'History'), browser: 'edge' }
    ];

    for (const cand of historyCandidates) {
      if (!fs.existsSync(cand.path)) continue;
      try {
        const stat = fs.statSync(cand.path);
        if (stat.size <= 0) continue;
        const fd = fs.openSync(cand.path, 'r');
        const bufSize = Math.min(stat.size, 128 * 1024); // read last 128KB tail
        const buf = Buffer.alloc(bufSize);
        fs.readSync(fd, buf, 0, bufSize, Math.max(0, stat.size - bufSize));
        fs.closeSync(fd);
        const str = buf.toString('latin1');
        const matches = str.match(/([a-zA-Z0-9_\-\.\(\) ]{3,80}\.(mp4|mp3|zip|exe|pdf|docx|xlsx|iso|mkv|msi|tar|gz|jpg|png|webp|crx|7z|dmg|pkg))/gi);
        if (matches && matches.length > 0) {
          const matched = matches[matches.length - 1];
          if (matched && !/^unconfirmed/i.test(matched)) {
            return { name: matched, browser: cand.browser };
          }
        }
      } catch {}
    }
    return null;
  }

  public isGenericDownloadName(name: string): boolean {
    return /^unconfirmed/i.test(name) ||
           name === 'Chrome Download' ||
           name === 'Brave Download' ||
           name === 'Browser Download' ||
           name === 'Downloading File...';
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
      let detectedBrowser: string | undefined;

      // Resolve actual target filename from Brave / Chrome / Edge History or fallback cleanly
      if (/^unconfirmed/i.test(cleanName)) {
        const resolved = this.tryResolveBrowserTargetName(filename);
        if (resolved) {
          cleanName = resolved.name;
          detectedBrowser = resolved.browser;
        } else {
          cleanName = 'Downloading File...';
        }
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
          startTime: now,
          browser: detectedBrowser
        };

        this.activeDownloads.set(filename, info);
        this.ensurePollLoop();
        this.broadcastDownloadActive(info);
        this.broadcastDownloadsUpdate();
      }
    } else {
      // A non-temporary file appeared or was renamed: check if it matches a pending download
      for (const [tempName, info] of this.activeDownloads.entries()) {
        if (filename.toLowerCase() === info.cleanName.toLowerCase() || this.isGenericDownloadName(info.cleanName)) {
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

          // Try re-resolving clean name if it's still a generic placeholder
          if (this.isGenericDownloadName(info.cleanName)) {
            const resolved = this.tryResolveBrowserTargetName(info.filename);
            if (resolved) {
              info.cleanName = resolved.name;
              info.browser = resolved.browser;
              info.finalPath = path.join(this.downloadsPath, resolved.name);
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

  private getDownloadAppName(info: ActiveDownloadInfo): string {
    if (info.browser === 'brave') return 'Brave';
    if (info.browser === 'chrome') return 'Chrome';
    if (info.browser === 'edge') return 'Edge';
    return 'Downloads';
  }

  private broadcastDownloadActive(info: ActiveDownloadInfo): void {
    const sizeStr = this.formatBytes(info.bytes);
    const speed = info.speedStr ? ` • ${info.speedStr}` : '';
    const payload = {
      id: 'dl-progress-' + info.cleanName,
      app: this.getDownloadAppName(info),
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
      app: this.getDownloadAppName(info),
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
      app: this.getDownloadAppName(info),
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
