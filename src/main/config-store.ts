import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface RoboIslandConfig {
  islandStyle: 'floating' | 'notch';
  islandScale: number; // 0.85, 1.0, 1.15
  selectedDisplayId: string; // 'primary' or display ID
  restingDisplay: 'eyes' | 'clock' | 'stats' | 'lyrics';
  soundEnabled: boolean;
  autoStart: boolean;
  gameModeEnabled: boolean;
  tuckEnabled: boolean;
  
  // Rest Mode & Capsule Configuration
  restModeEnabled: boolean;
  restCapsuleWidth: number;
  restCapsuleHeight: number;
  restHotkey: string;
  
  // Architecture & UI Mode (Rollback flag)
  expandedUiMode: 'dom' | 'canvas';
  
  // Customization & Skins (100% Free)
  mascotName: string;
  mascotSkin: 'classic' | 'cyberpunk' | 'matrix' | 'emerald' | 'amber' | 'amethyst' | 'solar';
  mascotHat: 'none' | 'headphones' | 'crown' | 'cap' | 'party' | 'beanie';
  mascotOutfit: 'best' | 'none' | 'party' | 'sunglasses' | 'crown';
  mascotBodyColor: string;
  mascotEyeColor: string;
  trafficLightEyes: {
    preset: 'classic' | 'soft' | 'colorblind';
    working: string;
    done: string;
    error: string;
  };
  visualTexture: 'obsidian' | 'carbon' | 'frosted' | 'neon' | 'brushed_metal' | 'matrix';
  restLeft?: 'none' | 'time' | 'battery' | 'cpu' | 'ram' | 'wifi' | 'bluetooth';
  restRight?: 'none' | 'time' | 'battery' | 'cpu' | 'ram' | 'wifi' | 'bluetooth';
  textureSkin?: 'none' | 'fire' | 'web' | 'grow';
  soundPack?: 'klassiek' | 'zacht' | 'belletjes';
  
  // Productivity & AI (100% Free)
  focusGuardEnabled: boolean;
  focusGuardBlockedApps: string[];
  focusGuardBlocked?: string;
  claudeCodeHooksEnabled: boolean;
  codexHooksEnabled: boolean;
  aiMonitoringEnabled: boolean;
  aiProvider?: string;
  ttsEnabled?: boolean;
  openAiApiKey: string;
  openAiModel: string;
  customAssistantPrompt: string;
  appsOff?: string[];
  profileName?: string;
  theme?: string;
  
  // Media & Widgets
  lyricsEnabled: boolean;
  spotifyClientId?: string;
  calendarIcsUrl: string;
  weatherCity: string;
  clockFormat?: '12h' | '24h';
  islandOpacity?: number;
  language?: 'en' | 'hi';
}

export const DEFAULT_CONFIG: RoboIslandConfig = {
  islandStyle: 'floating',
  islandScale: 1.0,
  selectedDisplayId: 'primary',
  restingDisplay: 'eyes',
  soundEnabled: true,
  autoStart: true,
  gameModeEnabled: true,
  tuckEnabled: true,
  restModeEnabled: false,
  restCapsuleWidth: 32,
  restCapsuleHeight: 18,
  restHotkey: 'CommandOrControl+Alt+R',
  expandedUiMode: 'dom',
  mascotName: 'Robo',
  mascotSkin: 'classic',
  mascotHat: 'none',
  mascotOutfit: 'none',
  mascotBodyColor: 'cloud',
  mascotEyeColor: 'mint',
  trafficLightEyes: {
    preset: 'classic',
    working: '#ff9500',
    done: '#34c759',
    error: '#ff3b30'
  },
  visualTexture: 'obsidian',
  restLeft: 'none',
  restRight: 'none',
  textureSkin: 'none',
  soundPack: 'klassiek',
  focusGuardEnabled: false,
  focusGuardBlockedApps: [
    'youtube.com',
    'twitter.com',
    'x.com',
    'reddit.com',
    'tiktok.com',
    'instagram.com',
    'facebook.com',
    'discord.exe'
  ],
  claudeCodeHooksEnabled: true,
  codexHooksEnabled: true,
  aiMonitoringEnabled: true,
  openAiApiKey: '',
  openAiModel: 'gpt-4o-mini',
  customAssistantPrompt: 'You are Robo, a helpful, witty, and concise desktop companion living inside the Dynamic Island.',
  aiProvider: 'claude',
  ttsEnabled: true,
  theme: 'dark',
  appsOff: [],
  profileName: 'Robo Companion',
  focusGuardBlocked: 'youtube.com, twitter.com, x.com, reddit.com, tiktok.com, instagram.com, discord.exe',
  lyricsEnabled: true,
  calendarIcsUrl: '',
  weatherCity: '',
  clockFormat: '12h',
  islandOpacity: 1.0,
  language: 'en'
};

class ConfigStore {
  private config: RoboIslandConfig;
  private filePath: string;

  constructor() {
    const userDataPath = (app && typeof app.getPath === 'function')
      ? app.getPath('userData')
      : (process.env.APPDATA ? path.join(process.env.APPDATA, 'RoboIsland') : path.join(process.cwd(), '.roboisland'));
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    this.filePath = path.join(userDataPath, 'roboisland-config.json');
    this.config = this.load();
  }

  private load(): RoboIslandConfig {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.mascotOutfit === 'best') {
          parsed.mascotOutfit = 'none';
        }
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (err) {
      console.error('[ConfigStore] Failed to load config, using defaults:', err);
    }
    return { ...DEFAULT_CONFIG };
  }

  public get(): RoboIslandConfig {
    return { ...this.config };
  }

  public set<K extends keyof RoboIslandConfig>(key: K, value: RoboIslandConfig[K]): void {
    this.config[key] = value;
    this.save();
  }

  public update(partial: Partial<RoboIslandConfig>): void {
    this.config = { ...this.config, ...partial };
    this.save();
  }

  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (err) {
      console.error('[ConfigStore] Failed to save config:', err);
    }
  }
}

export const configStore = new ConfigStore();
