import { app } from 'electron';
import { exec } from 'child_process';
import { configStore } from './config-store';

export class StartupManager {
  private static readonly REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
  private static readonly APP_NAME = 'com.roboisland.app';

  public static init(): void {
    const config = configStore.get();
    const shouldStart = config.autoStart !== false;
    this.setEnabled(shouldStart);
  }

  public static isEnabled(): boolean {
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  }

  public static setEnabled(enable: boolean): void {
    // 1. Electron Native Login Item Settings
    try {
      const options = app.isPackaged
        ? { openAtLogin: enable, path: process.execPath, args: ['--autostart'] }
        : { openAtLogin: enable, path: process.execPath, args: [app.getAppPath(), '--autostart'] };
      app.setLoginItemSettings(options);
    } catch (e) {
      console.warn('[StartupManager] Electron setLoginItemSettings error:', e);
    }

    // 2. Windows Registry HKCU Run Key (Guarantees startup on Windows 10/11)
    if (process.platform === 'win32' && app.isPackaged) {
      if (enable) {
        const cmd = `reg add "${this.REG_KEY}" /v "${this.APP_NAME}" /t REG_SZ /d "\\"${process.execPath}\\" --autostart" /f`;
        exec(cmd, (err) => {
          if (err) console.warn('[StartupManager] Failed to write registry startup key:', err);
        });
      } else {
        const cmd = `reg delete "${this.REG_KEY}" /v "${this.APP_NAME}" /f`;
        exec(cmd, () => {});
      }
    }

    configStore.set('autoStart', enable);
  }
}
