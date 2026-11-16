import { app } from 'electron';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
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
    if (process.platform === 'linux') {
      const homeDir = process.env.HOME || app.getPath('home');
      const desktopFile = path.join(homeDir, '.config', 'autostart', 'roboisland.desktop');
      return fs.existsSync(desktopFile);
    }
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

    // 3. Linux XDG Desktop Autostart (Fedora / KDE Plasma / GNOME)
    if (process.platform === 'linux') {
      try {
        const homeDir = process.env.HOME || app.getPath('home');
        const autostartDir = path.join(homeDir, '.config', 'autostart');
        const desktopFile = path.join(autostartDir, 'roboisland.desktop');

        if (enable) {
          if (!fs.existsSync(autostartDir)) {
            fs.mkdirSync(autostartDir, { recursive: true });
          }
          const execTarget = app.isPackaged
            ? `"${process.execPath}" --autostart`
            : `"${process.execPath}" "${app.getAppPath()}" --autostart`;
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
        } else {
          if (fs.existsSync(desktopFile)) {
            fs.unlinkSync(desktopFile);
          }
        }
      } catch (err) {
        console.warn('[StartupManager] Linux autostart error:', err);
      }
    }

    configStore.set('autoStart', enable);
  }
}
