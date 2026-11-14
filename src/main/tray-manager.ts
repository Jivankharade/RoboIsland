import { app, Tray, Menu, nativeImage } from 'electron';
import { IconGenerator } from './icon-generator';
import { configStore } from './config-store';
import { IslandWindow } from './island-window';
import { StartupManager } from './startup-manager';

export class TrayManager {
  private tray: Tray | null = null;
  private islandWindow: IslandWindow;
  private onOpenSettings: () => void;

  constructor(islandWindow: IslandWindow, onOpenSettings: () => void) {
    this.islandWindow = islandWindow;
    this.onOpenSettings = onOpenSettings;
    this.createTray();
  }

  private createTray(): void {
    try {
      const icon = IconGenerator.getTrayIcon();
      this.tray = new Tray(icon);
      this.tray.setToolTip('RoboIsland - Dynamic Island');
      this.updateContextMenu();

      this.tray.on('click', () => {
        const win = this.islandWindow.getWindow();
        if (win) {
          if (!win.isVisible()) {
            win.show();
            win.webContents.send('island:collapse');
          } else {
            win.webContents.send('island:toggle-expand');
          }
        }
      });
    } catch (err) {
      console.warn('[TrayManager] Failed to create system tray icon:', err);
    }
  }

  public updateContextMenu(): void {
    if (!this.tray) return;
    try {
      const config = configStore.get();
      const win = this.islandWindow.getWindow();
      const isVisible = win ? win.isVisible() : true;

      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'RoboIsland',
          enabled: false,
          icon: IconGenerator.getTrayIcon().resize({ width: 16, height: 16 })
        },
        { type: 'separator' },
        {
          label: 'Show RoboIsland (Compact)',
          click: () => {
            const w = this.islandWindow.getWindow();
            if (w) {
              w.show();
              w.webContents.send('island:collapse');
            }
          }
        },
        {
          label: 'Hide RoboIsland',
          click: () => {
            this.islandWindow.getWindow()?.hide();
          }
        },
        { type: 'separator' },
        {
          label: 'Expand / Collapse Island',
          click: () => {
            this.islandWindow.getWindow()?.webContents.send('island:toggle-expand');
          }
        },
      {
        label: 'Open Settings (100% Free)',
        click: () => {
          this.onOpenSettings();
        }
      },
      { type: 'separator' },
      {
        label: 'Attachment Style',
        submenu: [
          {
            label: 'Floating Island (8px Gap)',
            type: 'radio',
            checked: config.islandStyle === 'floating',
            click: () => {
              configStore.set('islandStyle', 'floating');
              this.islandWindow.reposition();
              this.updateContextMenu();
            }
          },
          {
            label: 'Screen Notch (Top Edge)',
            type: 'radio',
            checked: config.islandStyle === 'notch',
            click: () => {
              configStore.set('islandStyle', 'notch');
              this.islandWindow.reposition();
              this.updateContextMenu();
            }
          }
        ]
      },
      {
        label: 'Size Scale',
        submenu: [
          {
            label: 'Compact (85%)',
            type: 'radio',
            checked: config.islandScale === 0.85,
            click: () => {
              configStore.set('islandScale', 0.85);
              this.islandWindow.reposition();
              this.updateContextMenu();
            }
          },
          {
            label: 'Normal (100%)',
            type: 'radio',
            checked: config.islandScale === 1.0,
            click: () => {
              configStore.set('islandScale', 1.0);
              this.islandWindow.reposition();
              this.updateContextMenu();
            }
          },
          {
            label: 'Large (115%)',
            type: 'radio',
            checked: config.islandScale === 1.15,
            click: () => {
              configStore.set('islandScale', 1.15);
              this.islandWindow.reposition();
              this.updateContextMenu();
            }
          }
        ]
      },
      {
        label: 'Start with Windows',
        type: 'checkbox',
        checked: config.autoStart,
        click: (item) => {
          StartupManager.setEnabled(item.checked);
          this.updateContextMenu();
        }
      },
      { type: 'separator' },
      {
        label: 'Quit RoboIsland',
        click: () => {
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
    } catch (err) {
      console.warn('[TrayManager] Failed to update context menu:', err);
    }
  }
}
