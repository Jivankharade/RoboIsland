"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisplayManager = exports.ISLAND_FLOAT_GAP = exports.PANEL_HEIGHT = exports.PANEL_WIDTH = void 0;
const electron_1 = require("electron");
const config_store_1 = require("./config-store");
exports.PANEL_WIDTH = 860;
exports.PANEL_HEIGHT = 440;
exports.ISLAND_FLOAT_GAP = 6;
class DisplayManager {
    static getAllDisplays() {
        const primary = electron_1.screen.getPrimaryDisplay();
        return electron_1.screen.getAllDisplays().map((d, index) => ({
            id: String(d.id),
            name: d.id === primary.id ? `Display ${index + 1} (Primary)` : `Display ${index + 1}`,
            bounds: d.bounds,
            isPrimary: d.id === primary.id
        }));
    }
    static getTargetDisplay() {
        const config = config_store_1.configStore.get();
        const all = electron_1.screen.getAllDisplays();
        if (config.selectedDisplayId && config.selectedDisplayId !== 'primary') {
            const match = all.find(d => String(d.id) === config.selectedDisplayId);
            if (match)
                return match;
        }
        return electron_1.screen.getPrimaryDisplay();
    }
    static calculatePosition(scale, style) {
        const display = this.getTargetDisplay();
        const effectiveWidth = Math.round(exports.PANEL_WIDTH * scale);
        const effectiveHeight = Math.round(exports.PANEL_HEIGHT * scale);
        const x = Math.round(display.bounds.x + (display.bounds.width - effectiveWidth) / 2);
        const y = Math.round(display.bounds.y + (style === 'floating' ? exports.ISLAND_FLOAT_GAP * scale : 0));
        return {
            x,
            y,
            width: effectiveWidth,
            height: effectiveHeight
        };
    }
}
exports.DisplayManager = DisplayManager;
