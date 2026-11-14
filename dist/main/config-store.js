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
exports.configStore = exports.DEFAULT_CONFIG = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.DEFAULT_CONFIG = {
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
    mascotOutfit: 'best',
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
    config;
    filePath;
    constructor() {
        const userDataPath = (electron_1.app && typeof electron_1.app.getPath === 'function')
            ? electron_1.app.getPath('userData')
            : (process.env.APPDATA ? path.join(process.env.APPDATA, 'RoboIsland') : path.join(process.cwd(), '.roboisland'));
        if (!fs.existsSync(userDataPath)) {
            fs.mkdirSync(userDataPath, { recursive: true });
        }
        this.filePath = path.join(userDataPath, 'roboisland-config.json');
        this.config = this.load();
    }
    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const raw = fs.readFileSync(this.filePath, 'utf8');
                const parsed = JSON.parse(raw);
                return { ...exports.DEFAULT_CONFIG, ...parsed };
            }
        }
        catch (err) {
            console.error('[ConfigStore] Failed to load config, using defaults:', err);
        }
        return { ...exports.DEFAULT_CONFIG };
    }
    get() {
        return { ...this.config };
    }
    set(key, value) {
        this.config[key] = value;
        this.save();
    }
    update(partial) {
        this.config = { ...this.config, ...partial };
        this.save();
    }
    save() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.config, null, 2), 'utf8');
        }
        catch (err) {
            console.error('[ConfigStore] Failed to save config:', err);
        }
    }
}
exports.configStore = new ConfigStore();
