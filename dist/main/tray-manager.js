"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrayManager = void 0;
const electron_1 = require("electron");
const icon_generator_1 = require("./icon-generator");
const config_store_1 = require("./config-store");
const startup_manager_1 = require("./startup-manager");
class TrayManager {
    tray = null;
    islandWindow;
    onOpenSettings;
    constructor(islandWindow, onOpenSettings) {
        this.islandWindow = islandWindow;
        this.onOpenSettings = onOpenSettings;
        this.createTray();
    }
    createTray() {
        try {
            const icon = icon_generator_1.IconGenerator.getTrayIcon();
            this.tray = new electron_1.Tray(icon);
            this.tray.setToolTip('RoboIsland - Dynamic Island');
            this.updateContextMenu();
            this.tray.on('click', () => {
                const win = this.islandWindow.getWindow();
                if (win) {
                    if (!win.isVisible()) {
                        win.show();
                        win.webContents.send('island:collapse');
                    }
                    else {
                        win.webContents.send('island:toggle-expand');
                    }
                }
            });
        }
        catch (err) {
            console.warn('[TrayManager] Failed to create system tray icon:', err);
        }
    }
    updateContextMenu() {
        if (!this.tray)
            return;
        try {
            const config = config_store_1.configStore.get();
            const win = this.islandWindow.getWindow();
            const isVisible = win ? win.isVisible() : true;
            const contextMenu = electron_1.Menu.buildFromTemplate([
                {
                    label: 'RoboIsland',
                    enabled: false,
                    icon: icon_generator_1.IconGenerator.getTrayIcon().resize({ width: 16, height: 16 })
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
                                config_store_1.configStore.set('islandStyle', 'floating');
                                this.islandWindow.reposition();
                                this.updateContextMenu();
                            }
                        },
                        {
                            label: 'Screen Notch (Top Edge)',
                            type: 'radio',
                            checked: config.islandStyle === 'notch',
                            click: () => {
                                config_store_1.configStore.set('islandStyle', 'notch');
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
                                config_store_1.configStore.set('islandScale', 0.85);
                                this.islandWindow.reposition();
                                this.updateContextMenu();
                            }
                        },
                        {
                            label: 'Normal (100%)',
                            type: 'radio',
                            checked: config.islandScale === 1.0,
                            click: () => {
                                config_store_1.configStore.set('islandScale', 1.0);
                                this.islandWindow.reposition();
                                this.updateContextMenu();
                            }
                        },
                        {
                            label: 'Large (115%)',
                            type: 'radio',
                            checked: config.islandScale === 1.15,
                            click: () => {
                                config_store_1.configStore.set('islandScale', 1.15);
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
                        startup_manager_1.StartupManager.setEnabled(item.checked);
                        this.updateContextMenu();
                    }
                },
                { type: 'separator' },
                {
                    label: 'Quit RoboIsland',
                    click: () => {
                        electron_1.app.quit();
                    }
                }
            ]);
            this.tray.setContextMenu(contextMenu);
        }
        catch (err) {
            console.warn('[TrayManager] Failed to update context menu:', err);
        }
    }
}
exports.TrayManager = TrayManager;
