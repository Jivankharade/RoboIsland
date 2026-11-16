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
exports.BuddyManager = void 0;
const electron_1 = require("electron");
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
class BuddyManager {
    overlayWindow = null;
    isOut = false;
    constructor() {
        this.setupIPC();
    }
    createOverlay() {
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
            return this.overlayWindow;
        }
        const primary = electron_1.screen.getPrimaryDisplay();
        this.overlayWindow = new electron_1.BrowserWindow({
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
    grabRobo() {
        const win = this.createOverlay();
        this.isOut = true;
        win.show();
        win.setIgnoreMouseEvents(false);
        win.webContents.send('buddy:state', { state: 'carrying' });
    }
    async inspectTarget(x, y) {
        if (process.platform !== 'win32') {
            return { title: 'Active Window', process: 'Application', image: '' };
        }
        let scriptPath = path.join(__dirname, '../native/buddy-helper.ps1');
        scriptPath = scriptPath.replace('app.asar', 'app.asar.unpacked');
        return new Promise((resolve) => {
            try {
                const child = (0, child_process_1.spawn)('powershell.exe', [
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
                    }
                    catch {
                        resolve({ title: 'Active Window', process: 'Application', image: '' });
                    }
                });
            }
            catch {
                resolve({ title: 'Active Window', process: 'Application', image: '' });
            }
        });
    }
    speakText(text) {
        if (!text)
            return;
        try {
            const sanitized = text.replace(/["'\\]/g, ' ');
            const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Speak("${sanitized}")`;
            (0, child_process_1.spawn)('powershell.exe', ['-NoProfile', '-Command', ps], { windowsHide: true });
        }
        catch { }
    }
    setupIPC() {
        electron_1.ipcMain.on('buddy:grab', () => {
            this.grabRobo();
        });
        electron_1.ipcMain.on('buddy:drop', () => {
            if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
                this.overlayWindow.webContents.send('buddy:state', { state: 'dropped' });
            }
        });
        electron_1.ipcMain.handle('buddy:inspect', async (_event, point) => {
            return this.inspectTarget(point.x, point.y);
        });
        electron_1.ipcMain.on('buddy:speak', (_event, text) => {
            this.speakText(text);
        });
        electron_1.ipcMain.on('buddy:fly-home', () => {
            if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
                this.overlayWindow.hide();
                this.overlayWindow.setIgnoreMouseEvents(true, { forward: true });
            }
            this.isOut = false;
            // Notify island that Robo returned
            electron_1.BrowserWindow.getAllWindows().forEach(w => {
                if (!w.isDestroyed())
                    w.webContents.send('buddy:home');
            });
        });
    }
}
exports.BuddyManager = BuddyManager;
