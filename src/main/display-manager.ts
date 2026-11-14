import { screen, Display } from 'electron';
import { configStore } from './config-store';

export const PANEL_WIDTH = 860;
export const PANEL_HEIGHT = 440;
export const ISLAND_FLOAT_GAP = 6;

export class DisplayManager {
  public static getAllDisplays(): Array<{ id: string; name: string; bounds: Electron.Rectangle; isPrimary: boolean }> {
    const primary = screen.getPrimaryDisplay();
    return screen.getAllDisplays().map((d, index) => ({
      id: String(d.id),
      name: d.id === primary.id ? `Display ${index + 1} (Primary)` : `Display ${index + 1}`,
      bounds: d.bounds,
      isPrimary: d.id === primary.id
    }));
  }

  public static getTargetDisplay(): Display {
    const config = configStore.get();
    const all = screen.getAllDisplays();
    if (config.selectedDisplayId && config.selectedDisplayId !== 'primary') {
      const match = all.find(d => String(d.id) === config.selectedDisplayId);
      if (match) return match;
    }
    return screen.getPrimaryDisplay();
  }

  public static calculatePosition(scale: number, style: 'floating' | 'notch'): { x: number; y: number; width: number; height: number } {
    const display = this.getTargetDisplay();
    const effectiveWidth = Math.round(PANEL_WIDTH * scale);
    const effectiveHeight = Math.round(PANEL_HEIGHT * scale);

    const x = Math.round(display.bounds.x + (display.bounds.width - effectiveWidth) / 2);
    const y = Math.round(display.bounds.y + (style === 'floating' ? ISLAND_FLOAT_GAP * scale : 0));

    return {
      x,
      y,
      width: effectiveWidth,
      height: effectiveHeight
    };
  }
}
