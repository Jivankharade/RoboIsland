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
exports.StartupManager = void 0;
const electron_1 = require("electron");
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const config_store_1 = require("./config-store");
class StartupManager {
    static REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
    static APP_NAME = 'com.roboisland.app';
    static init() {
        const config = config_store_1.configStore.get();
        const shouldStart = config.autoStart !== false;
        this.setEnabled(shouldStart);
    }
    static isEnabled() {
        if (process.platform === 'linux') {
            const homeDir = process.env.HOME || electron_1.app.getPath('home');
            const desktopFile = path.join(homeDir, '.config', 'autostart', 'roboisland.desktop');
            return fs.existsSync(desktopFile);
        }
        const settings = electron_1.app.getLoginItemSettings();
        return settings.openAtLogin;
    }
    static setEnabled(enable) {
        // 1. Electron Native Login Item Settings
        try {
            const options = electron_1.app.isPackaged
                ? { openAtLogin: enable, path: process.execPath, args: ['--autostart'] }
                : { openAtLogin: enable, path: process.execPath, args: [electron_1.app.getAppPath(), '--autostart'] };
            electron_1.app.setLoginItemSettings(options);
        }
        catch (e) {
            console.warn('[StartupManager] Electron setLoginItemSettings error:', e);
        }
        // 2. Windows Registry HKCU Run Key (Guarantees startup on Windows 10/11)
        if (process.platform === 'win32' && electron_1.app.isPackaged) {
            if (enable) {
                const cmd = `reg add "${this.REG_KEY}" /v "${this.APP_NAME}" /t REG_SZ /d "\\"${process.execPath}\\" --autostart" /f`;
                (0, child_process_1.exec)(cmd, (err) => {
                    if (err)
                        console.warn('[StartupManager] Failed to write registry startup key:', err);
                });
            }
            else {
                const cmd = `reg delete "${this.REG_KEY}" /v "${this.APP_NAME}" /f`;
                (0, child_process_1.exec)(cmd, () => { });
            }
        }
        // 3. Linux XDG Desktop Autostart (Fedora / KDE Plasma / GNOME)
        if (process.platform === 'linux') {
            try {
                const homeDir = process.env.HOME || electron_1.app.getPath('home');
                const autostartDir = path.join(homeDir, '.config', 'autostart');
                const desktopFile = path.join(autostartDir, 'roboisland.desktop');
                if (enable) {
                    if (!fs.existsSync(autostartDir)) {
                        fs.mkdirSync(autostartDir, { recursive: true });
                    }
                    const execTarget = electron_1.app.isPackaged
                        ? `"${process.execPath}" --autostart`
                        : `"${process.execPath}" "${electron_1.app.getAppPath()}" --autostart`;
                    const content = [
                        '[Desktop Entry]',
                        'Type=Application',
                        'Version=1.0',
                        'Name=RoboIsland',
                        'Comment=RoboIsland Dynamic Island for Linux KDE Plasma',
                        `Exec=${execTarget}`,
                        'Icon=roboisland',
                        'Terminal=false',
                        'StartupNotify=false',
                        'Categories=Utility;'
                    ].join('\n') + '\n';
                    fs.writeFileSync(desktopFile, content, 'utf8');
                }
                else {
                    if (fs.existsSync(desktopFile)) {
                        fs.unlinkSync(desktopFile);
                    }
                }
            }
            catch (err) {
                console.warn('[StartupManager] Linux autostart error:', err);
            }
        }
        config_store_1.configStore.set('autoStart', enable);
    }
}
exports.StartupManager = StartupManager;
