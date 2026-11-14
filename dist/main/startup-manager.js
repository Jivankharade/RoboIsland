"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartupManager = void 0;
const electron_1 = require("electron");
const child_process_1 = require("child_process");
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
        config_store_1.configStore.set('autoStart', enable);
    }
}
exports.StartupManager = StartupManager;
