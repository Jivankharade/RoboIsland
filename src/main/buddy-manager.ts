import { BrowserWindow, screen, ipcMain, app } from 'electron';
import { spawn } from 'child_process';
import * as path from 'path';
import { configStore } from './config-store';

export class BuddyManager {
  private overlayWindow: BrowserWindow | null = null;
  private isOut = false;

  constructor() {
    this.setupIPC();
  }

  private createOverlay(): BrowserWindow {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      return this.overlayWindow;
    }

    const primary = screen.getPrimaryDisplay();
    this.overlayWindow = new BrowserWindow({
      x: primary.bounds.x,
      y: primary.bounds.y,
      width: primary.bounds.width,
      height: primary.bounds.height,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, '../preload/buddy-preload.js')
      }
    });

    this.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    this.overlayWindow.setIgnoreMouseEvents(true, { forward: true });

    const buddyHtmlPath = path.join(__dirname, '../renderer/buddy/buddy.html');
    this.overlayWindow.loadFile(buddyHtmlPath);

    this.overlayWindow.on('closed', () => {
      this.overlayWindow = null;
      this.isOut = false;
    });

    return this.overlayWindow;
  }

  public grabRobo(): void {
    const win = this.createOverlay();
    this.isOut = true;
    win.show();
    win.setIgnoreMouseEvents(false);
    win.webContents.send('buddy:state', { state: 'carrying' });
  }

  public async inspectTarget(x: number, y: number): Promise<any> {
    let scriptPath = path.join(__dirname, '../native/buddy-helper.ps1');
    scriptPath = scriptPath.replace('app.asar', 'app.asar.unpacked');
    return new Promise((resolve) => {
      try {
        const child = spawn('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          scriptPath,
          '-X',
          String(x),
          '-Y',
          String(y)
        ], { windowsHide: true });

        let out = '';
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', chunk => (out += chunk));
        child.on('exit', () => {
          try {
            const data = JSON.parse(out.trim());
            resolve(data);
          } catch {
            resolve({ title: 'Active Window', process: 'Application', image: '' });
          }
        });
      } catch {
        resolve({ title: 'Active Window', process: 'Application', image: '' });
      }
    });
  }

  public speakText(text: string): void {
    if (!text) return;
    try {
      const sanitized = text.replace(/["'\\]/g, ' ');
      const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Speak("${sanitized}")`;
      spawn('powershell.exe', ['-NoProfile', '-Command', ps], { windowsHide: true });
    } catch {}
  }

  private setupIPC(): void {
    ipcMain.on('buddy:grab', () => {
      this.grabRobo();
    });

    ipcMain.on('buddy:drop', () => {
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.webContents.send('buddy:state', { state: 'dropped' });
      }
    });

    ipcMain.handle('buddy:inspect', async (_event, point: { x: number; y: number }) => {
      return this.inspectTarget(point.x, point.y);
    });

    ipcMain.on('buddy:speak', (_event, text: string) => {
      this.speakText(text);
    });

    ipcMain.on('buddy:fly-home', () => {
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.hide();
        this.overlayWindow.setIgnoreMouseEvents(true, { forward: true });
      }
      this.isOut = false;
      // Notify island that Robo returned
      BrowserWindow.getAllWindows().forEach(w => {
        if (!w.isDestroyed()) w.webContents.send('buddy:home');
      });
    });
  }
}
