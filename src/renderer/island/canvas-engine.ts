import { RoboMascot, MascotMood } from './robo-mascot';
import { TextureEngine } from './texture-engine';
import { AudioSynth } from './audio-synth';

function getConvertibleTargetFormat(fileName: string): string | null {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'docx':
    case 'doc':
    case 'pptx':
    case 'ppt':
    case 'xlsx':
    case 'xls':
      return 'PDF';
    case 'pdf':
      return 'DOCX';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'bmp':
      return 'PDF';
    case 'txt':
    case 'md':
      return 'PDF';
    default:
      return null;
  }
}

declare global {
  interface Window {
    roboIsland: any;
    island?: any;
    islandAPI?: any;
  }
}

export type IslandMode = 'rest' | 'compact' | 'expanded';
export type IslandTab = 'media' | 'home' | 'ai' | 'tools' | 'focus' | 'tray';

export interface IslandNotification {
  id: string;
  title: string;
  body?: string;
  app?: string;
  kind?: 'done' | 'question' | 'error' | 'warn' | 'pop' | 'badge' | 'info' | 'whatsapp' | 'mail' | 'download' | 'telegram' | 'discord' | 'chat' | 'chrome' | 'edge' | 'slack' | 'teams' | 'spotify' | 'antigravity' | 'defender' | 'snipping' | 'terminal' | 'settings' | 'explorer' | 'vscode' | string;
  status?: 'downloading' | 'complete' | 'error' | 'sent' | 'voicenote' | 'message' | string;
  filePath?: string;
  url?: string;
  bytes?: number;
  sizeStr?: string;
  speedStr?: string;
  progress?: number;
  durationMs?: number;
  actions?: Array<{
    id: string;
    label: string;
    primary?: boolean;
  }>;
  sessionId?: string;
  phone?: string;
  tag?: string;
  isVoiceNote?: boolean;
  durationSeconds?: number;
  smartReplies?: string[];
  transcript?: string;
}

// ============================================================================
// SYSTEM AUDIO VISUALIZER (TwoCode Parity: Real-Time Sound Reactive Equalizer)
// ============================================================================
export class SystemAudioVisualizer {
  private static instance: SystemAudioVisualizer | null = null;
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private data: any = null;
  private starting = false;
  private failed = false;
  private onSince = 0;
  private offSince = 0;
  private readonly BARS = 18;
  private levels: number[] = new Array(18).fill(0);
  private peaks: number[] = new Array(18).fill(0.08);
  private loudPeak = 0.1;
  public isHearing = false;
  private _lastLevelsFrameTime = 0;
  private _cachedLevels = new Map<number, number[]>();

  public static getInstance(): SystemAudioVisualizer {
    if (!SystemAudioVisualizer.instance) {
      SystemAudioVisualizer.instance = new SystemAudioVisualizer();
    }
    return SystemAudioVisualizer.instance;
  }

  public async startListening(): Promise<void> {
    // Pure acoustic synthesis engine: eliminates GPU loopback capture spikes while keeping silky visualizer
    this.failed = false;
    this.starting = false;
  }

  public stopListening(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.analyser = null;
    this.data = null;
    this.levels.fill(0);
    this.isHearing = false;
  }

  public resumeAudioContext(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public update(isPlaying: boolean): void {
    const now = performance.now();
    if (isPlaying) {
      this.offSince = 0;
      if (!this.onSince) this.onSince = now;
      if (!this.failed && now - this.onSince > 600) {
        this.startListening();
      }
    } else {
      this.onSince = 0;
      if (this.stream) {
        if (!this.offSince) this.offSince = now;
        if (now - this.offSince > 4000) {
          this.stopListening();
        }
      }
    }
  }

  public getLevels(barCount: number = 5): number[] | null {
    if (!this.analyser || !this.data || !this.ctx) return null;
    const now = performance.now();
    if (now - this._lastLevelsFrameTime < 14 && this._cachedLevels.has(barCount)) {
      return this._cachedLevels.get(barCount)!;
    }
    if (now - this._lastLevelsFrameTime >= 14) {
      this._lastLevelsFrameTime = now;
      this._cachedLevels.clear();
      this.analyser.getByteFrequencyData(this.data);
      const n = this.data.length;
      const hzPerBin = (this.ctx.sampleRate / 2) / n;
      const raw: number[] = [];

      for (let i = 0; i < this.BARS; i++) {
        const f0 = 60 * Math.pow(200, i / this.BARS);
        const f1 = 60 * Math.pow(200, (i + 1) / this.BARS);
        const from = Math.max(1, Math.floor(f0 / hzPerBin));
        const to = Math.max(from + 1, Math.ceil(f1 / hzPerBin));
        let sum = 0;
        for (let j = from; j < to && j < n; j++) {
          sum += this.data[j];
        }
        raw.push(sum / (to - from) / 255);
      }

      const loud = raw.reduce((a, b) => a + b, 0) / this.BARS;
      this.isHearing = loud > 0.05;
      if (!this.isHearing) {
        for (let i = 0; i < this.BARS; i++) {
          this.levels[i] *= 0.8;
        }
      } else {
        this.loudPeak = Math.max(loud, this.loudPeak * 0.997, 0.12);
        const overall = Math.min(1, (loud / this.loudPeak) * 1.15); // soft parts settle lower, loud parts punch higher

        for (let i = 0; i < this.BARS; i++) {
          this.peaks[i] = Math.max(raw[i], this.peaks[i] * 0.996, 0.15);
          const v = Math.pow(raw[i] / this.peaks[i], 1.6) * overall; // stretch so beats and vocal spikes stand out
          this.levels[i] += (v - this.levels[i]) * (v > this.levels[i] ? 0.55 : 0.2); // snappy rise attack, smooth decay
        }
      }
    }

    const res = this.sampleBarCount(this.levels, barCount);
    this._cachedLevels.set(barCount, res);
    return res;
  }

  private sampleBarCount(sourceLevels: number[], targetCount: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < targetCount; i++) {
      const idx = Math.min(sourceLevels.length - 1, Math.floor((i * sourceLevels.length) / targetCount));
      out.push(sourceLevels[idx] || 0.06);
    }
    return out;
  }
}

export class CanvasEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public mascot: RoboMascot;

  // View & Geometry State
  public mode: IslandMode = 'compact';
  public activeTab: IslandTab = 'media';
  public isTucked = false;
  public isGameModeThrottled = false;

  // Notification State (TwoCode Parity: Melodies, Spring Jelly Kick, Rim Glow, Allow/Deny Actions)
  public activeNotification: IslandNotification | null = null;
  public notificationUntil = 0;
  private notificationTimer: any = null;
  public notificationHits: Record<string, { x: number; y: number; width: number; height: number }> = {};

  // WhatsApp Quick Reply State (Apple Dynamic Island Parity)
  public isWhatsAppReplying = false;
  public whatsAppReplyText = '';
  public whatsAppReplySent = false;
  public whatsAppReplySentUntil = 0;
  public whatsAppReplyContext: {
    contact: string;
    phone: string;
    tag: string;
    title: string;
    body: string;
  } | null = null;

  // TwoCode Resting Geometry Parity (matching Screenshot 2):
  // Rest Mode: 32 x 18 px (radius = 9px)
  // Resting Compact Dock: 98 x 26 px (radius = 13px)
  // Media / Active: 300 x 36 px
  // Expanded Hub: 520 x 240 px
  // Tuck-away: 56 x 4 px (radius = 2px)
  public currentWidth = 98;
  public currentHeight = 26;
  public currentRadius = 13;
  public targetWidth = 98;
  public targetHeight = 26;
  public targetRadius = 13;

  // Cursor & Interactivity
  public pointerX = -1000;
  public pointerY = -1000;
  public isHovered = false;
  public isInteractive = false;
  private collapseTimer: any = null;
  private hoverOpenTimer: any = null;
  private compactClickTimer: any = null;
  private isDraggingOver = false;
  private justRestoredFromRest = false;

  // Live Media State (Windows SMTC, YouTube, Spotify)
  private mediaState = {
    active: false,
    source: 'none' as 'spotify' | 'smtc' | 'none',
    app: '',
    title: '',
    artist: '',
    album: '',
    playing: false,
    positionMs: 0,
    durationMs: 0,
    coverUrl: '',
    lyricLine: ''
  };
  private lastMediaSampleTime = performance.now();
  private basePositionMs = 0;

  // Album dominant color extraction & visualizer (TwoCode Parity)
  public albumAccentColor: string = '#1ed760';
  public albumImageElement: HTMLImageElement | null = null;
  private lastCoverUrl: string = '';
  private currentTintR: number = 30;
  private currentTintG: number = 215;
  private currentTintB: number = 96;
  private targetTintR: number = 30;
  private targetTintG: number = 215;
  private targetTintB: number = 96;
  private lastPushedTintR: number = -1;
  private lastPushedTintG: number = -1;
  private lastPushedTintB: number = -1;
  public visualizerBars: number[] = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
  public compactVizBars: number[] = [0.1, 0.1, 0.1, 0.1, 0.1];
  public expandedVizBars: number[] = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
  private syncedLyrics: Array<{ timeMs: number; text: string }> = [];
  // TwoCode Synchronized Lyrics State Machine (lyrics-ui.js)
  private lyricsSongKey: string = '';
  private lyricsIndex: number = -1;
  private lyricsGap: boolean = false;
  private lyricsChangedAt: number = 0;
  private lyricsPrevious: string | null = null;
  private lyricsWidest: number = 0;
  private lyricsHoldUntil: number = 0;
  private lyricsLoading: boolean = false;
  private readonly LYRICS_HOLD = 2500;
  private readonly LYRICS_LEAD = 250;
  private readonly LYRICS_SWAP = 420;
  private readonly LYRICS_FONT = '600 13px Inter, "Segoe UI", sans-serif';
  public isDevicesOpen: boolean = false;
  public spotifyDevices: any[] = [];

  // Performance caches for 60 FPS media rendering
  private _lyricsCacheFont = new Map<string, string>();
  private _lyricsCacheText = new Map<string, string>();
  private _cachedTrackNameKey: string = '';
  private _cachedTrackDisplayName: string = '';
  private _cachedCoverCanvas: HTMLCanvasElement | null = null;
  private _cachedMusicTintKey: string = '';
  private _cachedMusicTintGrad: CanvasGradient | null = null;
  private _cachedMusicRimKey: string = '';
  private _cachedMusicRimGrad: CanvasGradient | null = null;

  // Live AI State (Claude Code & Codex)
  private aiState = {
    connected: false,
    agent: 'claude',
    status: 'ready',
    prompt: '',
    currentTool: '',
    pendingPermission: null as null | { sessionId: string; description: string; command?: string }
  };

  // Weather State (Open-Meteo)
  private weatherState = {
    temp: '--',
    condition: 'Checking...',
    city: 'Local'
  };

  // System Hardware Info
  private batteryState = {
    level: 100,
    charging: false
  };
  // Feature B: Charger Plug-in Surge Pop State (Zero Clutter)
  public chargerSurgeUntil = 0;
  public chargerSurgeStartTime = 0;
  public chargerSurgeCharging = false;
  public chargerSurgeLevel = 100;

  // Apple Hardware Volume HUD Pop State
  public volumeHudUntil = 0;
  public volumeHudStartTime = 0;
  public volumeHudLevel = 50;
  public volumeHudMuted = false;
  private isVolumeInitialized = false;
  private isScrubbingVolumeHud = false;
  private engineStartTime = performance.now();

  // Apple Speedometer Telemetry HUD Pop State (CPU, RAM, Storage)
  public speedometerHudUntil = 0;
  public speedometerHudStartTime = 0;
  public metricsState: any = {
    cpu: 18,
    ram: 45,
    storage: { totalGb: 280, freeGb: 77, usedGb: 203, percent: 72 },
    cores: 8,
    totalMemMb: 16384,
    freeMemMb: 9011,
    usedMemMb: 7373
  };

  // Apple AirDrop Transfer HUD State
  public airdropHudUntil = 0;
  public airdropHudStartTime = 0;
  public airdropHudType: 'sent' | 'received' = 'received';
  public airdropHudFileName = '';
  public airdropHudFileSize = '';

  // Ambient Screen Glance & Error Fixer State (R3)
  public isGlanceSetup = false;
  public activeGlanceError: any = null;
  public activeGlanceSummary: any = null;

  // Apple AirPods / Bluetooth Battery & Device HUD State (R5)
  public bluetoothHudUntil = 0;
  public bluetoothHudStartTime = 0;
  public activeBluetoothDevice: any = null;
  public activeBluetoothEvent: any = null;

  // Full Hands-Free Voice Companion Mode (Jarvis Voice) State (R6)
  public voiceState: 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'ERROR' = 'IDLE';
  public voiceAudioLevel = 0.0;
  public voiceBands: number[] = [0, 0, 0, 0, 0];
  public voiceQueryText = '';
  public voiceResponseText = '';
  public voiceHudStartTime = 0;
  public voiceHudUntil = 0;

  // Apple Quick Look & LAN Drop Beam State
  public latestTrayFiles: any[] = [];
  public activeQuickLookPath: string | null = null;
  public isQuickLookOpen = false;
  public transferProgress: number | null = null;
  public transferDirection: 'download' | 'upload' = 'download';
  public transferProgressUntil = 0;

  // Apple macOS Style Clipboard History State
  public rawClipboardHistory: any[] = [];
  public clipboardSearchQuery = '';
  public clipboardFilter = 'all';
  public activeDownloadsList: any[] = [];

  // Apple macOS / iOS Dynamic Time-of-Day Greeting State
  public greetingUntil = 0;
  public greetingStartTime = 0;
  public greetingType: 'morning' | 'afternoon' | 'evening' | 'night' = 'morning';
  public userName = 'Gaurav';
  public lastGreetingHour = -1;
  public greetingTimer: NodeJS.Timeout | null = null;

  // Apple macOS / iPhone Live Activity Smart Status State
  public appActivityUntil = 0;
  public appActivityStartTime = 0;
  public activeAppActivity: {
    proc: string;
    appName: string;
    cleanTitle: string;
    kind: string;
    timestamp: number;
    hwnd?: number;
  } | null = null;

  // Sports Live Activity State (Cricket, Football, F1)
  public sportsState: any = null;
  public activeSportsActivity: any = null;
  public isSportsPillEnabled: boolean = false;
  public sportsFlashUntil = 0;
  public sportsFlashText = '';
  public sportsFlashColor = '#22e05a';

  // Universal Spotlight / Raycast Launcher State (R2)
  public isLauncherActive = false;
  public launcherExpanded = false;
  public selectedLauncherIndex = 0;
  public launcherItems: any[] = [];
  public launcherHeroResult: any = null;
  public isLauncherSetup = false;

  public isNotificationActive(): boolean {
    if (!this.activeNotification) return false;
    if (this.isWhatsAppReplying) return true;
    if (this.notificationUntil > 0 && performance.now() > this.notificationUntil) {
      this.activeNotification = null;
      return false;
    }
    return true;
  }

  public static resolveNotificationKindStatic(kind?: string, status?: string, appName?: string, titleText?: string): string {
    const app = (appName || '').toLowerCase();
    const title = (titleText || '').toLowerCase();
    let k = (kind || '').toLowerCase();

    if (!k || k === 'info' || k === 'badge' || k === 'pop') {
      if (app.includes('whatsapp') || title.includes('whatsapp')) return 'whatsapp';
      if (app.includes('antigravity') || title.includes('antigravity') || app.includes('gemini') || title.includes('gemini') || app.includes('deepmind')) return 'antigravity';
      if (app.includes('defender') || title.includes('defender') || app.includes('security') || title.includes('security') || title.includes('threat') || title.includes('antivirus')) return 'defender';
      if (app.includes('snipping') || title.includes('snipping') || title.includes('screenshot') || title.includes('screen clip') || title.includes('snip')) return 'snipping';
      if (app.includes('terminal') || title.includes('terminal') || app.includes('powershell') || title.includes('powershell') || app.includes('cmd') || title.includes('command prompt')) return 'terminal';
      if (app.includes('setting') || title.includes('setting')) return 'settings';
      if (app.includes('explorer') || title.includes('file explorer')) return 'explorer';
      if (app.includes('chrome') || title.includes('chrome')) return 'chrome';
      if (app.includes('brave') || title.includes('brave')) return 'brave';
      if (app.includes('mail') || app.includes('outlook') || app.includes('thunderbird') || title.includes('mail')) return 'mail';
      if (app.includes('edge') || title.includes('edge')) return 'edge';
      if (app.includes('telegram') || title.includes('telegram')) return 'telegram';
      if (app.includes('discord') || title.includes('discord')) return 'discord';
      if (app.includes('slack') || title.includes('slack')) return 'slack';
      if (app.includes('teams') || title.includes('teams')) return 'teams';
      if (app.includes('spotify') || title.includes('spotify')) return 'spotify';
      if (app.includes('vscode') || app.includes('code') || title.includes('visual studio')) return 'vscode';
      if (app.includes('download') || title.includes('download')) return 'download';
    }
    return k || 'info';
  }

  public resolveNotificationKind(kind?: string, status?: string, appName?: string, titleText?: string): string {
    const app = appName || (this && this.activeNotification ? this.activeNotification.app : '');
    const title = titleText || (this && this.activeNotification ? this.activeNotification.title : '');
    const k = kind || (this && this.activeNotification ? this.activeNotification.kind : '');
    return CanvasEngine.resolveNotificationKindStatic(k, status, app, title);
  }

  /**
   * WhatsApp Deep Parsing: Accurately identifies sender, group name, direct message, or call type
   */

  public isWhatsAppVoiceNoteActive(): boolean {
    if (!this.activeNotification) return false;
    const n = this.activeNotification;
    return Boolean(
      (n as any).isVoiceNote ||
      /(?:voice\s*message|audio\s*message|voice\s*note)\s*\((\d+):(\d+)\)/i.test(n.body || '') ||
      /\b(?:voice\s*message|audio\s*message|voice\s*note)\b/i.test(n.body || '')
    );
  }

  private async fetchAndRenderSmartReplies(
    bodyText: string,
    sender: string,
    input: HTMLInputElement | null,
    sendBtn: HTMLElement | null
  ): Promise<void> {
    const chipsContainer = document.getElementById('whatsapp-smart-reply-chips');
    if (!chipsContainer) return;
    chipsContainer.innerHTML = '';

    const waApi = (window.island || window.roboIsland)?.whatsapp || (window.island || window.roboIsland);
    let replies: string[] = [];

    if (waApi?.getSmartReplies) {
      try {
        const res = await waApi.getSmartReplies(bodyText, sender);
        if (res && Array.isArray(res.replies)) {
          replies = res.replies;
        }
      } catch (err) {
        console.warn('[WhatsApp] Smart replies query error:', err);
      }
    }

    if (!replies || replies.length === 0) {
      replies = ['Sounds good to me!', 'Got it, thanks!', "I'll follow up shortly."];
    }

    // Render exactly 3 chips
    chipsContainer.innerHTML = '';
    for (const reply of replies.slice(0, 3)) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'whatsapp-smart-chip';
      chip.textContent = reply;
      chip.title = `1-Tap reply: "${reply}"`;
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (input) {
          input.value = reply;
          this.whatsAppReplyText = reply;
          try {
            input.dispatchEvent(new Event('input'));
          } catch {}
        }
        if (sendBtn) sendBtn.classList.add('active');
        this.submitWhatsAppReply(reply);
      });
      chipsContainer.appendChild(chip);
    }
  }

  public parseWhatsAppDetails(rawTitle?: string, rawBody?: string): {
    isCall: boolean;
    callType?: 'voice' | 'video' | 'missed';
    isGroup: boolean;
    groupName?: string;
    senderName: string;
    messageText: string;
  } {
    let title = (rawTitle || '').replace(/^WhatsApp:\s*/i, '').trim();
    let body = (rawBody || '').trim();

    // 1. Detect Calls (Incoming voice/video call or missed call)
    const lowerTitle = title.toLowerCase();
    const lowerBody = body.toLowerCase();

    const isVideoCall = lowerTitle.includes('video call') || lowerBody.includes('video call');
    const isVoiceCall = lowerTitle.includes('voice call') || lowerBody.includes('voice call') || (lowerTitle.includes('call') && !lowerTitle.includes('caller')) || (lowerBody.includes('call') && !lowerBody.includes('called'));
    const isMissed = lowerTitle.includes('missed') || lowerBody.includes('missed');
    const isCallNotification = isVideoCall || isVoiceCall || isMissed;

    if (isCallNotification) {
      let callType: 'voice' | 'video' | 'missed' = 'voice';
      if (isMissed) {
        callType = 'missed';
      } else if (isVideoCall) {
        callType = 'video';
      }

      // Extract caller name from whichever field does not contain the word "call"
      let caller = title;
      if (lowerTitle.includes('call') || lowerTitle.includes('whatsapp') || lowerTitle.includes('incoming')) {
        caller = body && !lowerBody.includes('call') && !lowerBody.includes('incoming') ? body : (title.replace(/whatsapp|incoming|voice|video|missed|call|:/gi, '').trim() || 'Incoming Call');
      } else if (lowerBody.includes('call') || lowerBody.includes('incoming')) {
        caller = title;
      }

      return {
        isCall: true,
        callType,
        isGroup: false,
        senderName: caller || 'Unknown Caller',
        messageText: isMissed ? 'Missed Call' : (isVideoCall ? 'Incoming Video Call...' : 'Incoming Voice Call...')
      };
    }

    // 2. Detect Groups
    // Pattern A: "Alice @ Tech Group"
    if (title.includes(' @ ')) {
      const parts = title.split(' @ ');
      const sender = parts[0].trim();
      const group = parts[1].trim();
      return {
        isCall: false,
        isGroup: true,
        groupName: group,
        senderName: sender,
        messageText: body
      };
    }

    // Pattern B: Body is "Alice: Hey there"
    const colonMatch = body.match(/^([^:\n]{1,35}):\s*(.*)$/s);
    if (colonMatch) {
      if (title && !title.toLowerCase().includes('whatsapp')) {
        const cleanGroup = title.replace(/\s*\(\d+\s*messages?\)/i, '').trim();
        return {
          isCall: false,
          isGroup: true,
          groupName: cleanGroup,
          senderName: colonMatch[1].trim(),
          messageText: colonMatch[2].trim()
        };
      } else {
        return {
          isCall: false,
          isGroup: false,
          senderName: colonMatch[1].trim(),
          messageText: colonMatch[2].trim()
        };
      }
    }

    // Pattern C: Title contains "(X messages)"
    if (/\(\d+\s*messages?\)/i.test(title)) {
      const cleanGroup = title.replace(/\s*\(\d+\s*messages?\)/i, '').trim();
      return {
        isCall: false,
        isGroup: true,
        groupName: cleanGroup,
        senderName: cleanGroup,
        messageText: body
      };
    }

    // 3. Direct 1-on-1 Message
    const cleanSender = title || 'WhatsApp';
    return {
      isCall: false,
      isGroup: false,
      senderName: cleanSender,
      messageText: body
    };
  }

  public getNotificationColor(kind?: string, status?: string): string {
    const s = status || (this && this.activeNotification ? this.activeNotification.status : undefined);
    const resolvedKind = (this && typeof this.resolveNotificationKind === 'function')
      ? this.resolveNotificationKind(kind, s)
      : CanvasEngine.resolveNotificationKindStatic(kind, s);
    if (resolvedKind === 'download') {
      if (s === 'complete') return '#22e05a'; // Green smile & glow
      if (s === 'error') return '#ff3b3b';    // Red frown on cancel/error
      return '#00d2ff'; // Apple Mac download cyan
    }
    switch (resolvedKind) {
      case 'done':
        return '#22e05a'; // TwoCode green
      case 'whatsapp':
        return '#25d366'; // WhatsApp brand green
      case 'antigravity':
        return '#818cf8'; // Antigravity electric indigo
      case 'defender':
        return '#0078d4'; // Windows Security Azure blue
      case 'snipping':
        return '#8b5cf6'; // Snipping Tool purple
      case 'terminal':
        return '#38bdf8'; // Terminal cyan
      case 'settings':
        return '#9ca3af'; // System Settings graphite
      case 'explorer':
        return '#0284c7'; // Explorer ocean blue
      case 'vscode':
        return '#007acc'; // VS Code blue
      case 'chrome':
        return '#4285f4'; // Google Chrome blue
      case 'brave':
        return '#fb542b'; // Brave lion fiery orange
      case 'mail':
        return '#0078d4'; // Outlook / Apple Mail blue
      case 'edge':
        return '#00b294'; // Edge teal
      case 'telegram':
        return '#229ed9'; // Telegram blue
      case 'discord':
        return '#5865f2'; // Discord blurple
      case 'slack':
        return '#e01e5a'; // Slack berry red
      case 'teams':
        return '#6264a7'; // Teams purple
      case 'spotify':
        return '#1ed760'; // Spotify green
      case 'chat':
        return '#27c93f'; // Chat green
      case 'question':
        return '#ff9a1f'; // TwoCode orange
      case 'error':
        return '#ff3b3b'; // TwoCode red
      case 'warn':
        return '#ffd60a'; // TwoCode yellow
      case 'pop':
      case 'info':
      default: {
        const app = (this && this.activeNotification ? (this.activeNotification.app || this.activeNotification.title) : '') || '';
        if (app) {
          let hash = 0;
          for (let i = 0; i < app.length; i++) hash = (hash << 5) - hash + app.charCodeAt(i);
          const colors = ['#007aff', '#34c759', '#5856d6', '#af52de', '#ff9500', '#ff2d55', '#30b0c7'];
          return colors[Math.abs(hash) % colors.length];
        }
        return '#00d2ff';
      }
    }
  }

  public getNotificationRgb(kind?: string, status?: string): { r: number; g: number; b: number } {
    const s = status || (this && this.activeNotification ? this.activeNotification.status : undefined);
    const resolvedKind = (this && typeof this.resolveNotificationKind === 'function')
      ? this.resolveNotificationKind(kind, s)
      : CanvasEngine.resolveNotificationKindStatic(kind, s);
    if (resolvedKind === 'download') {
      if (s === 'complete') return { r: 34, g: 224, b: 90 };
      if (s === 'error') return { r: 255, g: 59, b: 59 };
      return { r: 0, g: 210, b: 255 };
    }
    switch (resolvedKind) {
      case 'done':
        return { r: 34, g: 224, b: 90 };
      case 'whatsapp':
        return { r: 37, g: 211, b: 102 };
      case 'antigravity':
        return { r: 129, g: 140, b: 248 };
      case 'defender':
        return { r: 0, g: 120, b: 212 };
      case 'snipping':
        return { r: 139, g: 92, b: 246 };
      case 'terminal':
        return { r: 56, g: 189, b: 248 };
      case 'settings':
        return { r: 156, g: 163, b: 175 };
      case 'explorer':
        return { r: 2, g: 132, b: 199 };
      case 'vscode':
        return { r: 0, g: 122, b: 204 };
      case 'chrome':
        return { r: 66, g: 133, b: 244 };
      case 'mail':
        return { r: 0, g: 120, b: 212 };
      case 'edge':
        return { r: 0, g: 178, b: 148 };
      case 'telegram':
        return { r: 34, g: 158, b: 217 };
      case 'discord':
        return { r: 88, g: 101, b: 242 };
      case 'slack':
        return { r: 224, g: 30, b: 90 };
      case 'teams':
        return { r: 98, g: 100, b: 167 };
      case 'spotify':
        return { r: 30, g: 215, b: 96 };
      case 'question':
        return { r: 255, g: 154, b: 31 };
      case 'error':
        return { r: 255, g: 59, b: 59 };
      case 'warn':
        return { r: 255, g: 214, b: 10 };
      case 'badge':
        return { r: 191, g: 90, b: 242 };
      default:
        return { r: 0, g: 210, b: 255 };
    }
  }

  public triggerNotification(n: IslandNotification): void {
    const resolved = this.resolveNotificationKind(n.kind, n.status, n.app, n.title);
    if (resolved && resolved !== 'info') {
      n.kind = resolved as any;
    }

    // CRITICAL GUARD: If user is actively replying in WhatsApp, ignore unrelated background toasts (battery, snipping tool)
    if (this.isWhatsAppReplying && n.kind !== 'whatsapp') {
      return;
    }

    // Special WhatsApp Call Handling: Auto-attach call actions & extend duration
    if (n.kind === 'whatsapp') {
      const wa = this.parseWhatsAppDetails(n.title, n.body);
      if (wa.isCall && wa.callType !== 'missed') {
        n.actions = [
          { id: 'wa-decline', label: 'Decline', primary: false },
          { id: 'wa-answer', label: 'Answer', primary: true }
        ];
        n.durationMs = n.durationMs || 15000;
      }
    }

    this.activeNotification = n;
    const duration = n.durationMs || (n.actions && n.actions.length > 0 ? 0 : 4000);
    this.notificationUntil = duration > 0 ? performance.now() + duration : 0;

    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
      this.notificationTimer = null;
    }

    if (duration > 0) {
      this.notificationTimer = setTimeout(() => {
        if (!this.isWhatsAppReplying) {
          this.clearNotification();
        }
      }, duration);
    }

    // TwoCode Physics: Spring jelly kick on arrival only (never during repeated download progress updates)
    const isUpdate = Boolean(this.activeNotification && (this.activeNotification.id === n.id || (n.kind === 'download' && this.activeNotification.kind === 'download')));
    const isDownloadingProgress = n.kind === 'download' && n.status === 'downloading';
    if (!isUpdate && !isDownloadingProgress) {
      this.kickJelly(0.18, 5.0, 4.0);
    }

    // Mascot & Audio reactions
    if (n.kind === 'download') {
      const isComplete = n.status === 'complete' || n.title?.toLowerCase().includes('complete');
      const isError = n.status === 'error' || n.title?.toLowerCase().includes('cancel') || n.title?.toLowerCase().includes('fail');
      if (isComplete) {
        // "when download complete it show green smile"
        this.mascot.setMood('happy', 5000);
        try { AudioSynth.getInstance().play('done'); } catch {}
        try { AudioSynth.getInstance().launchConfetti(45, window.innerWidth / 2, this.getTopY() + 18); } catch {}
      } else if (isError) {
        // "and when not download it show red"
        this.mascot.setMood('sad', 4500);
        try { AudioSynth.getInstance().play('error'); } catch {}
      } else {
        try { AudioSynth.getInstance().play('pop'); } catch {}
      }
    } else {
      const soundKind = (n.kind || 'pop') as any;
      try { AudioSynth.getInstance().play(soundKind); } catch {}
      if (n.kind === 'done' || n.kind === 'badge') {
        try { AudioSynth.getInstance().launchConfetti(45, window.innerWidth / 2, this.getTopY() + 18); } catch {}
      }
    }

    this.updateTargetDimensions();
  }

  public clearNotification(): void {
    this.activeNotification = null;
    this.notificationUntil = 0;
    this.isWhatsAppReplying = false;
    this.whatsAppReplyText = '';
    this.whatsAppReplySent = false;
    const bar = document.getElementById('whatsapp-quick-reply-bar');
    const input = document.getElementById('whatsapp-reply-input') as HTMLInputElement | null;
    if (bar) bar.classList.add('hidden');
    if (input) input.blur();
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
      this.notificationTimer = null;
    }
    this.updateTargetDimensions();
  }

  public openWhatsAppReply(): void {
    if (!this.activeNotification) return;
    const resolvedKind = this.resolveNotificationKind(this.activeNotification?.kind, this.activeNotification?.status, this.activeNotification?.app, this.activeNotification?.title);
    if (resolvedKind !== 'whatsapp') return;
    const wa = this.parseWhatsAppDetails(this.activeNotification?.title, this.activeNotification?.body);
    const target = wa.isGroup ? (wa.groupName || wa.senderName) : wa.senderName;
    const bar = document.getElementById('whatsapp-quick-reply-bar');
    const input = document.getElementById('whatsapp-reply-input') as HTMLInputElement | null;
    const sendBtn = document.getElementById('whatsapp-reply-send-btn');

    // Populate smart reply chips (per R4)
    const bodyText = this.activeNotification?.body || '';
    const sender = target || 'WhatsApp';
    this.fetchAndRenderSmartReplies(bodyText, sender, input, sendBtn);

    // Lock in the reply context so it cannot be corrupted by subsequent system toasts
    this.whatsAppReplyContext = {
      contact: target || 'WhatsApp',
      phone: this.activeNotification?.phone || '',
      tag: this.activeNotification?.tag || '',
      title: this.activeNotification?.title || '',
      body: this.activeNotification?.body || ''
    };

    this.isWhatsAppReplying = true;
    this.whatsAppReplyText = '';
    this.whatsAppReplySent = false;
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
      this.notificationTimer = null;
    }
    if (window.roboIsland?.setInteractive) {
      window.roboIsland.setInteractive(true);
    }
    if ((window.roboIsland as any)?.focusWindow) {
      (window.roboIsland as any).focusWindow();
    }
    this.kickJelly(0.14, 4.0, 3.5);
    this.updateTargetDimensions();

    if (bar && input) {
      bar.classList.remove('hidden');
      input.value = '';
      input.placeholder = `Reply to ${target}...`;
      if (sendBtn) sendBtn.classList.remove('active');
      setTimeout(() => {
        input.focus();
      }, 50);
    }

    // Voice note card handling (per R4)
    const vnCard = document.getElementById('whatsapp-voicenote-card');
    if (this.isWhatsAppVoiceNoteActive()) {
      if (vnCard) vnCard.classList.remove('hidden');
      const vnDuration = document.getElementById('wa-vn-duration');
      const vnTranscript = document.getElementById('wa-vn-transcript');
      const n = this.activeNotification;

      // Parse duration
      const match = (n.body || '').match(/\((\d+):(\d+)\)/);
      let durationStr = '0:15';
      let durationSeconds = 15;
      if (match) {
        durationStr = `${match[1]}:${match[2]}`;
        durationSeconds = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
      } else if ((n as any).durationSeconds) {
        const d = (n as any).durationSeconds;
        durationSeconds = d;
        durationStr = `${Math.floor(d / 60)}:${(d % 60).toString().padStart(2, '0')}`;
      }
      if (vnDuration) vnDuration.textContent = durationStr;

      // Populate or request transcript
      if ((n as any).transcript && vnTranscript) {
        vnTranscript.textContent = (n as any).transcript;
      } else {
        if (vnTranscript) vnTranscript.textContent = 'Transcribing voice note...';
        const waApi = (window.island || window.roboIsland)?.whatsapp || (window.island || window.roboIsland);
        if (waApi?.transcribeVoiceNote) {
          const vnId = (n as any).voiceNoteId || (n as any).tag || 'vn-active';
          waApi.transcribeVoiceNote(vnId, durationSeconds, n.body || n.title).then((res: any) => {
            if (res && res.transcript && vnTranscript) {
              vnTranscript.textContent = res.transcript;
              (n as any).transcript = res.transcript;
            }
          }).catch(() => {});
        }
      }
    } else {
      if (vnCard) vnCard.classList.add('hidden');
    }
  }

  public closeWhatsAppReply(): void {
    this.isWhatsAppReplying = false;
    this.whatsAppReplyContext = null;
    this.whatsAppReplyText = '';
    this.whatsAppReplySent = false;
    const bar = document.getElementById('whatsapp-quick-reply-bar');
    const input = document.getElementById('whatsapp-reply-input') as HTMLInputElement | null;
    const vnCard = document.getElementById('whatsapp-voicenote-card');
    if (bar) bar.classList.add('hidden');
    if (vnCard) vnCard.classList.add('hidden');
    if (input) input.blur();
    this.updateTargetDimensions();
  }

  public startWhatsAppReply(): void {
    this.openWhatsAppReply();
  }

  public submitWhatsAppReply(customText?: string): void {
    const input = document.getElementById('whatsapp-reply-input') as HTMLInputElement | null;
    const text = (typeof customText === 'string' ? customText : (input?.value || this.whatsAppReplyText)).trim();
    if (!text || this.whatsAppReplySent) return;

    this.whatsAppReplySent = true;
    this.whatsAppReplySentUntil = performance.now() + 1200;

    const bar = document.getElementById('whatsapp-quick-reply-bar');
    if (bar) bar.classList.add('hidden');

    try {
      AudioSynth.getInstance().play('pop');
    } catch {}

    this.mascot.setMood('happy', 4000);

    const wa = this.parseWhatsAppDetails(this.activeNotification?.title, this.activeNotification?.body);
    const fallbackContact = wa.isGroup ? (wa.groupName || wa.senderName) : wa.senderName;
    const rawContact = this.whatsAppReplyContext?.contact || fallbackContact || '';
    const contact = (rawContact && rawContact.toLowerCase() !== 'whatsapp') ? rawContact : (fallbackContact && fallbackContact.toLowerCase() !== 'whatsapp' ? fallbackContact : '');
    const phone = this.whatsAppReplyContext?.phone || this.activeNotification?.phone || '';
    const tag = this.whatsAppReplyContext?.tag || this.activeNotification?.tag || '';
    if (window.roboIsland?.replyWhatsApp) {
      window.roboIsland.replyWhatsApp({ contact, phone, tag, text });
    }

    if (input) input.value = '';

    setTimeout(() => {
      this.closeWhatsAppReply();
      this.clearNotification();
    }, 1200);
  }

  public isInsideHit(px: number, py: number, hit: { x: number; y: number; width: number; height: number }): boolean {
    return px >= hit.x && px <= hit.x + hit.width && py >= hit.y && py <= hit.y + hit.height;
  }

  public truncateText(text: string, maxWidth: number, font: string): string {
    this.ctx.save();
    this.ctx.font = font;
    if (this.ctx.measureText(text).width <= maxWidth) {
      this.ctx.restore();
      return text;
    }
    let str = text;
    while (str.length > 3 && this.ctx.measureText(str + '...').width > maxWidth) {
      str = str.slice(0, -1);
    }
    this.ctx.restore();
    return str + '...';
  }

  public isSplitIslandActive(): boolean {
    if (this.isNotificationActive()) return false;
    if (this.mode !== 'compact' || this.isTucked) return false;
    if (performance.now() < this.chargerSurgeUntil ||
        performance.now() < this.volumeHudUntil ||
        performance.now() < this.speedometerHudUntil ||
        performance.now() < this.bluetoothHudUntil ||
        performance.now() < this.airdropHudUntil) {
      return false;
    }

    const isDualActive = this.focusState.active && Boolean(this.mediaState.playing || (this.mediaState.active && this.mediaState.title));
    if (this.mode === 'compact' && !this.isTucked && isDualActive) {
      return this.mode === 'compact' && !this.isTucked && isDualActive;
    }

    const isMusicActive = Boolean(this.mediaState.playing || (this.mediaState.active && this.mediaState.title));
    const hasFocus = this.focusState.active;
    const hasDownloads = this.activeDownloadsList.length > 0;

    // 1. Music + Focus dual mode
    if (hasFocus && isMusicActive) return true;

    // 2. Music + Downloads (Music playing + Download active -> Apple Dynamic Island Split Dual Bubble)
    if (hasDownloads && isMusicActive) return true;

    // 3. Multiple simultaneous downloads (split into primary download pill + detached counter ring bubble)
    if (this.activeDownloadsList.length > 1) return true;

    return false;
  }

  public triggerChargerSurge(charging: boolean = true, level?: number): void {
    this.chargerSurgeCharging = charging;
    this.chargerSurgeLevel = typeof level === 'number' ? level : (this.batteryState.level || 100);
    this.chargerSurgeStartTime = performance.now();
    this.chargerSurgeUntil = performance.now() + 3600;
    if (charging) {
      try {
        AudioSynth.getInstance().play('charging');
      } catch {}
      this.mascot?.setMood('happy');
    }
    this.kickJelly(0.12);
    this.updateTargetDimensions();
  }

  /**
   * Apple-Style Hardware Volume HUD Pop
   * When volume keys (Vol Up/Down/Mute) are pressed, smoothly expands pill to 270px for 2.2s.
   */
  public triggerVolumeHud(level: number, muted: boolean = false): void {
    // Only trigger compact/rest pill HUD pop — NEVER in expanded mode, and never while dragging volume in UI
    if (this.mode !== 'compact' && this.mode !== 'rest') return;
    if ((window as any).isMediaVolumeDragging || performance.now() < ((window as any).__twocodeVolumeQuietUntil || 0)) return;
    this.volumeHudLevel = Math.max(0, Math.min(100, Math.round(level)));
    this.volumeHudMuted = Boolean(muted);
    this.volumeHudStartTime = performance.now();
    this.volumeHudUntil = performance.now() + 1800;
    this.kickJelly(0.08);
    this.updateTargetDimensions();
  }

  /**
   * Performance-Adaptive Apple Color Gauge Selector
   * Green for Low (< 60%), Amber for Medium (60% - 84%), Coral Red for High (>= 85%)
   */
  public getAppleGaugeColor(pct: number): { hex: string; glow: string; track: string; label: string } {
    if (pct >= 85) {
      return {
        hex: '#ff453a',
        glow: 'rgba(255, 69, 58, 0.65)',
        track: 'rgba(255, 69, 58, 0.18)',
        label: 'HIGH'
      };
    } else if (pct >= 60) {
      return {
        hex: '#ff9f0a',
        glow: 'rgba(255, 159, 10, 0.60)',
        track: 'rgba(255, 159, 10, 0.18)',
        label: 'MED'
      };
    } else {
      return {
        hex: '#30d158',
        glow: 'rgba(48, 209, 88, 0.55)',
        track: 'rgba(48, 209, 88, 0.18)',
        label: 'LOW'
      };
    }
  }

  /**
   * Apple-Style Hardware Speedometer HUD Pop (CPU, RAM, Storage)
   * Smoothly springs compact island out to ~360px showing 3 tachometer dials.
   */
  public triggerSpeedometerHud(): void {
    this.speedometerHudStartTime = performance.now();
    this.speedometerHudUntil = performance.now() + 4200;
    this.kickJelly(0.09);
    this.updateTargetDimensions();
  }

  /**
   * Apple AirDrop Transfer HUD & Animation
   * Pops concentric pulsing radar waves, file name, and green checkmark.
   */
  public triggerAirDropHud(type: 'sent' | 'received', fileName: string, fileSize: string = ''): void {
    this.airdropHudType = type;
    this.airdropHudFileName = fileName || 'File';
    this.airdropHudFileSize = fileSize;
    this.airdropHudStartTime = performance.now();
    this.airdropHudUntil = performance.now() + 3800;
    this.kickJelly(0.12);
    try {
      AudioSynth.getInstance()?.play?.('airdrop');
    } catch {}
    this.updateTargetDimensions();
    this.showAirDropToast(type, fileName, fileSize);
  }

  public showAirDropToast(type: 'sent' | 'received', fileName: string, fileSize: string = ''): void {
    const toast = document.getElementById('airdrop-toast');
    const toastTitle = document.getElementById('airdrop-toast-title');
    const toastName = document.getElementById('airdrop-toast-name');
    const toastIcon = document.getElementById('airdrop-toast-icon-svg');
    if (!toast) return;

    if (toastTitle) {
      toastTitle.textContent = type === 'sent' ? 'AirDrop Sent' : 'AirDrop Received';
    }
    if (toastName) {
      toastName.textContent = fileSize ? `${fileName} (${fileSize})` : fileName;
    }
    if (toastIcon) {
      toastIcon.innerHTML = type === 'sent'
        ? '<polyline points="12 19 12 5"></polyline><polyline points="5 12 12 5 19 12"></polyline>'
        : '<polyline points="12 5 12 19"></polyline><polyline points="19 12 12 19 5 12"></polyline>';
    }

    toast.classList.remove('hidden');
    toast.classList.remove('airdrop-fade-out');
    toast.classList.add('airdrop-pop-in');

    clearTimeout((this as any).__airdropToastTimer);
    (this as any).__airdropToastTimer = setTimeout(() => {
      toast.classList.add('airdrop-fade-out');
      setTimeout(() => {
        toast.classList.add('hidden');
        toast.classList.remove('airdrop-pop-in');
        toast.classList.remove('airdrop-fade-out');
      }, 400);
    }, 3200);
  }

  /**
   * Pure vector Canvas renderer for Apple AirDrop Transfer HUD:
   * - Left: Concentric pulsing radar waves with vector document fold & arrow
   * - Center: Bold title and filename
   * - Right: Apple Green circular checkmark badge with glow
   */
  public drawAirDropHudContent(cx: number, topY: number): void {
    const W = this.currentWidth;
    const H = this.currentHeight;
    const midY = topY + H / 2;
    const pillLeft = cx - W / 2;
    const t = performance.now();
    const elapsed = (t - this.airdropHudStartTime) / 1000;

    this.ctx.save();

    // 1. Apple AirDrop Pulsing Radar Rings (Left side)
    const radarCx = pillLeft + 26;
    const radarCy = midY;
    const isSent = this.airdropHudType === 'sent';
    const ringColor = isSent ? '#00d2ff' : '#30d158';

    // 3 expanding radar wave rings
    for (let i = 0; i < 3; i++) {
      const phase = ((elapsed * 0.9) + (i * 0.33)) % 1;
      const r = 7 + phase * 13;
      const alpha = Math.max(0, (1 - phase) * 0.75);
      this.ctx.beginPath();
      this.ctx.arc(radarCx, radarCy, r, 0, Math.PI * 2);
      this.ctx.strokeStyle = ringColor;
      this.ctx.lineWidth = 1.6;
      this.ctx.globalAlpha = alpha;
      this.ctx.stroke();
    }
    this.ctx.globalAlpha = 1.0;

    // Center icon inside radar: circular pill
    this.ctx.beginPath();
    this.ctx.arc(radarCx, radarCy, 9, 0, Math.PI * 2);
    this.ctx.fillStyle = isSent ? 'rgba(0, 210, 255, 0.22)' : 'rgba(48, 209, 88, 0.22)';
    this.ctx.fill();

    // Small vector document fold icon
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1.5;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeRect(radarCx - 4.5, radarCy - 5.5, 9, 11);

    // Arrow in the document
    this.ctx.beginPath();
    if (isSent) {
      this.ctx.moveTo(radarCx, radarCy + 2.5);
      this.ctx.lineTo(radarCx, radarCy - 2.5);
      this.ctx.lineTo(radarCx - 2.5, radarCy);
      this.ctx.moveTo(radarCx, radarCy - 2.5);
      this.ctx.lineTo(radarCx + 2.5, radarCy);
    } else {
      this.ctx.moveTo(radarCx, radarCy - 2.5);
      this.ctx.lineTo(radarCx, radarCy + 2.5);
      this.ctx.lineTo(radarCx - 2.5, radarCy);
      this.ctx.moveTo(radarCx, radarCy + 2.5);
      this.ctx.lineTo(radarCx + 2.5, radarCy);
    }
    this.ctx.stroke();

    // 2. Middle Text: Title and File Name
    const textLeft = pillLeft + 48;
    const maxTextW = W - 92;

    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'alphabetic';

    // Title: "AirDrop Sent" or "AirDrop Received"
    this.ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
    this.ctx.fillStyle = ringColor;
    const titleText = isSent ? 'AirDrop Sent' : 'AirDrop Received';
    this.ctx.fillText(titleText, textLeft, midY - 2);

    // Subtitle: Truncated file name (+ size if available)
    this.ctx.font = '500 10px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    let nameText = this.airdropHudFileName;
    if (this.airdropHudFileSize) {
      nameText += ` (${this.airdropHudFileSize})`;
    }
    if (this.ctx.measureText(nameText).width > maxTextW) {
      while (nameText.length > 3 && this.ctx.measureText(nameText + '...').width > maxTextW) {
        nameText = nameText.slice(0, -1);
      }
      nameText += '...';
    }
    this.ctx.fillText(nameText, textLeft, midY + 11);

    // 3. Right: Apple Circular Checkmark Badge
    const checkCx = pillLeft + W - 22;
    const checkCy = midY;
    const checkR = 9.5;

    this.ctx.beginPath();
    this.ctx.arc(checkCx, checkCy, checkR, 0, Math.PI * 2);
    this.ctx.fillStyle = '#30d158';
    this.ctx.shadowColor = 'rgba(48, 209, 88, 0.55)';
    this.ctx.shadowBlur = 6;
    this.ctx.fill();
    this.ctx.shadowBlur = 0;

    // Vector checkmark
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2.0;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(checkCx - 4.5, checkCy);
    this.ctx.lineTo(checkCx - 1, checkCy + 3.5);
    this.ctx.lineTo(checkCx + 4.5, checkCy - 3.5);
    this.ctx.stroke();

    this.ctx.restore();
  }

  // ==========================================================================
  // AirPods / Bluetooth Battery & Device HUD (R5)
  // ==========================================================================

  /**
   * Apple-Style AirPods / Bluetooth Battery & Device HUD
   * Expands Dynamic Island capsule into HUD view showing:
   * - Device vector glyph (AirPods, headphones, earbuds, mouse, keyboard, or BT symbol)
   * - Device name (e.g. "AirPods Pro")
   * - Status ("Connected", "Disconnected", etc.)
   * - Battery gauge with color coding (Green >=50%, Yellow 20-49%, Red <20%)
   * - Multi-battery meters if multiBattery exists (Left, Right, Case)
   * - Stays strictly within 860x440 transparent viewport
   */
  public triggerBluetoothHud(eventOrDevice: any): void {
    if (!eventOrDevice) return;
    const device = eventOrDevice.device || eventOrDevice;
    const eventType = eventOrDevice.type || (device.connected ? 'connected' : 'disconnected');

    this.activeBluetoothEvent = eventOrDevice;
    this.activeBluetoothDevice = device;
    this.bluetoothHudStartTime = performance.now();
    this.bluetoothHudUntil = performance.now() + 4000;

    this.kickJelly(0.12, 4.0, 3.5);
    try {
      AudioSynth.getInstance()?.play?.('pop');
    } catch {}

    this.updateTargetDimensions();
    this.showBluetoothHudCard(device, eventType);
    this.requestRender();
  }

  public showBluetoothHudCard(device: any, eventType: string = 'connected'): void {
    const card = document.getElementById('bluetooth-hud-card');
    if (!card) return;

    const iconEl = document.getElementById('bt-hud-icon');
    const nameEl = document.getElementById('bt-hud-name');
    const statusEl = document.getElementById('bt-hud-status');
    const pctEl = document.getElementById('bt-hud-battery-percent');
    const fillEl = document.getElementById('bt-hud-battery-fill');
    const multiEl = document.getElementById('bt-hud-multibattery');
    const mbLeft = document.getElementById('bt-hud-mb-left');
    const mbRight = document.getElementById('bt-hud-mb-right');
    const mbCase = document.getElementById('bt-hud-mb-case');

    const devType = device.deviceType || 'peripheral';
    let iconChar = '🎧';
    if (devType === 'airpods') iconChar = '🎧';
    else if (devType === 'earbuds') iconChar = '🫧';
    else if (devType === 'headphones') iconChar = '🎧';
    else if (devType === 'mouse') iconChar = '🖱️';
    else if (devType === 'keyboard') iconChar = '⌨️';
    else if (devType === 'speaker') iconChar = '🔊';
    else iconChar = '📶';

    if (iconEl) iconEl.textContent = iconChar;
    if (nameEl) nameEl.textContent = device.name || 'Bluetooth Device';
    if (statusEl) {
      if (eventType === 'connected') statusEl.textContent = 'Connected';
      else if (eventType === 'disconnected') statusEl.textContent = 'Disconnected';
      else statusEl.textContent = `${device.batteryPercent ?? 100}% Battery`;
    }

    const pct = typeof device.batteryPercent === 'number' ? device.batteryPercent : 100;
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (fillEl) {
      fillEl.style.width = `${pct}%`;
      const color = pct >= 50 ? '#30d158' : (pct >= 20 ? '#ffd60a' : '#ff453a');
      fillEl.style.background = color;
      if (pctEl) pctEl.style.color = color;
    }

    if (device.multiBattery && (device.multiBattery.left !== undefined || device.multiBattery.right !== undefined || device.multiBattery.case !== undefined)) {
      if (multiEl) multiEl.classList.remove('hidden');
      if (mbLeft) {
        if (typeof device.multiBattery.left === 'number') {
          mbLeft.textContent = `L ${device.multiBattery.left}%`;
          mbLeft.style.display = 'inline-block';
        } else {
          mbLeft.style.display = 'none';
        }
      }
      if (mbRight) {
        if (typeof device.multiBattery.right === 'number') {
          mbRight.textContent = `R ${device.multiBattery.right}%`;
          mbRight.style.display = 'inline-block';
        } else {
          mbRight.style.display = 'none';
        }
      }
      if (mbCase) {
        if (typeof device.multiBattery.case === 'number') {
          mbCase.textContent = `C ${device.multiBattery.case}%`;
          mbCase.style.display = 'inline-block';
        } else {
          mbCase.style.display = 'none';
        }
      }
    } else {
      if (multiEl) multiEl.classList.add('hidden');
    }

    card.classList.remove('hidden');
    clearTimeout((this as any).__btHudTimer);
    (this as any).__btHudTimer = setTimeout(() => {
      card.classList.add('hidden');
    }, 3900);
  }

  /**
   * Pure vector Canvas renderer for Apple AirPods / Bluetooth Battery & Device HUD:
   * - Left: Device Icon glyph (AirPods stems + bulbs, Headphones, Mouse, or BT rune)
   * - Middle: Bold Title ("AirPods Pro") + Subtle Status ("Connected" / "88% Battery")
   * - Right: Color-coded Battery Meter + Multi-Battery Chips (L/R/Case)
   */
  public drawBluetoothHudContent(cx: number, topY: number): void {
    const W = this.currentWidth;
    const H = this.currentHeight;
    const midY = topY + H / 2;
    const pillLeft = cx - W / 2;
    const dev = this.activeBluetoothDevice || { name: 'AirPods Pro', deviceType: 'airpods', batteryPercent: 88, connected: true };
    const devType = dev.deviceType || 'airpods';
    const pct = typeof dev.batteryPercent === 'number' ? dev.batteryPercent : 100;

    this.ctx.save();

    // 1. Left Device Icon Badge
    const iconCx = pillLeft + 22;
    const iconCy = midY;
    const iconR = 12;

    // Platter background for icon
    this.ctx.beginPath();
    this.ctx.arc(iconCx, iconCy, iconR, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    this.ctx.fill();

    // Vector Icon Drawing based on deviceType
    this.ctx.save();
    if (devType === 'airpods') {
      // Draw authentic dual AirPods vector glyphs
      this.ctx.fillStyle = '#ffffff';
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.3;
      this.ctx.lineCap = 'round';

      // Left AirPod: stem + bulb
      this.ctx.beginPath();
      this.ctx.arc(iconCx - 3.5, iconCy - 3, 2.8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx - 2.8, iconCy - 1.5);
      this.ctx.lineTo(iconCx - 2.2, iconCy + 4.5);
      this.ctx.stroke();

      // Right AirPod: stem + bulb
      this.ctx.beginPath();
      this.ctx.arc(iconCx + 3.5, iconCy - 3, 2.8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx + 2.8, iconCy - 1.5);
      this.ctx.lineTo(iconCx + 2.2, iconCy + 4.5);
      this.ctx.stroke();
    } else if (devType === 'headphones') {
      // Over-ear headphones: arch + earcups
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.4;
      this.ctx.beginPath();
      this.ctx.arc(iconCx, iconCy - 1, 5.5, Math.PI * 0.9, Math.PI * 2.1);
      this.ctx.stroke();

      // Left & Right Earcups
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.roundRect(iconCx - 6.5, iconCy - 1, 2.2, 5.5, 1);
      this.ctx.roundRect(iconCx + 4.3, iconCy - 1, 2.2, 5.5, 1);
      this.ctx.fill();
    } else if (devType === 'mouse') {
      // Mouse body + wheel
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.2;
      this.ctx.beginPath();
      this.ctx.roundRect(iconCx - 3.5, iconCy - 5.5, 7, 11, 3.5);
      this.ctx.stroke();
      // Scroll wheel line
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx, iconCy - 3.5);
      this.ctx.lineTo(iconCx, iconCy - 1);
      this.ctx.stroke();
    } else if (devType === 'keyboard') {
      // Keyboard frame + keys
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.2;
      this.ctx.beginPath();
      this.ctx.roundRect(iconCx - 6, iconCy - 4, 12, 8, 1.5);
      this.ctx.stroke();
      this.ctx.fillStyle = '#ffffff';
      for (let kx = -3.5; kx <= 3.5; kx += 3.5) {
        this.ctx.fillRect(iconCx + kx - 0.7, iconCy - 1.5, 1.4, 1.2);
        this.ctx.fillRect(iconCx + kx - 0.7, iconCy + 0.8, 1.4, 1.2);
      }
    } else {
      // Bluetooth rune symbol
      this.ctx.strokeStyle = '#38bdf8';
      this.ctx.lineWidth = 1.4;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx, iconCy - 5.5);
      this.ctx.lineTo(iconCx, iconCy + 5.5);
      this.ctx.lineTo(iconCx + 3.2, iconCy + 2.8);
      this.ctx.lineTo(iconCx - 2.8, iconCy - 2.5);
      this.ctx.moveTo(iconCx - 2.8, iconCy + 2.5);
      this.ctx.lineTo(iconCx + 3.2, iconCy - 2.8);
      this.ctx.lineTo(iconCx, iconCy - 5.5);
      this.ctx.stroke();
    }
    this.ctx.restore();

    // 2. Middle Device Name and Connection Status
    const textLeft = iconCx + iconR + 10;
    this.ctx.font = '600 12px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';

    const multi = dev.multiBattery;
    const hasMulti = Boolean(multi && (multi.left !== undefined || multi.right !== undefined || multi.case !== undefined));
    const maxTextW = hasMulti ? 110 : 150;
    const devName = this.truncateText(dev.name || 'Bluetooth Device', maxTextW, this.ctx.font);
    this.ctx.fillText(devName, textLeft, midY - 6);

    // Subtitle status text
    this.ctx.font = '500 10px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const isConn = dev.connected !== false;
    this.ctx.fillStyle = isConn ? 'rgba(255, 255, 255, 0.55)' : '#ff453a';
    const statusText = isConn ? (dev.isCharging ? 'Charging' : 'Connected') : 'Disconnected';
    this.ctx.fillText(statusText, textLeft, midY + 8);

    // 3. Right Battery Section
    // Color coding: Green >= 50%, Yellow 20-49%, Red < 20%
    const gaugeColor = pct >= 50 ? '#30d158' : (pct >= 20 ? '#ffd60a' : '#ff453a');

    let rightCursor = pillLeft + W - 14;

    // Draw main battery icon & percentage
    const batW = 20;
    const batH = 10;
    const batX = rightCursor - batW;
    const batY = midY - batH / 2;

    // Main battery outline
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    this.ctx.lineWidth = 1.2;
    this.ctx.beginPath();
    this.ctx.roundRect(batX, batY, batW, batH, 2.5);
    this.ctx.stroke();

    // Terminal nipple on right side
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    this.ctx.beginPath();
    this.ctx.roundRect(batX + batW + 1, batY + 2.5, 1.8, batH - 5, [0, 1, 1, 0]);
    this.ctx.fill();

    // Battery fill
    const fillMaxW = batW - 3;
    const fillW = Math.max(1, Math.round(fillMaxW * (pct / 100)));
    this.ctx.fillStyle = gaugeColor;
    this.ctx.beginPath();
    this.ctx.roundRect(batX + 1.5, batY + 1.5, fillW, batH - 3, 1.2);
    this.ctx.fill();

    // Percentage text to left of battery icon
    this.ctx.font = '700 11px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.ctx.fillStyle = gaugeColor;
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'middle';
    const pctText = `${pct}%`;
    const pctTextW = this.ctx.measureText(pctText).width;
    this.ctx.fillText(pctText, batX - 5, midY);

    rightCursor = batX - pctTextW - 12;

    // Multi-Battery Display (Left, Right, Case)
    if (hasMulti) {
      const mb = multi!;
      const items: Array<{ label: string; val: number }> = [];
      if (typeof mb.case === 'number') items.unshift({ label: 'C', val: mb.case });
      if (typeof mb.right === 'number') items.unshift({ label: 'R', val: mb.right });
      if (typeof mb.left === 'number') items.unshift({ label: 'L', val: mb.left });

      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        const itemColor = item.val >= 50 ? '#30d158' : (item.val >= 20 ? '#ffd60a' : '#ff453a');
        const badgeText = `${item.label} ${item.val}%`;
        this.ctx.font = '600 9px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        const bw = this.ctx.measureText(badgeText).width + 8;
        const bx = rightCursor - bw;
        const by = midY - 8;

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        this.ctx.beginPath();
        this.ctx.roundRect(bx, by, bw, 16, 4);
        this.ctx.fill();

        this.ctx.fillStyle = itemColor;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(badgeText, bx + bw / 2, midY);

        rightCursor = bx - 4;
      }
    }

    this.ctx.restore();
  }

  // ==========================================================================
  // Full Hands-Free Voice Companion Mode (Jarvis Voice) Implementation (R6)
  // ==========================================================================

  public isVoiceCompanionActive(): boolean {
    return this.voiceState === 'LISTENING' || this.voiceState === 'THINKING' || this.voiceState === 'SPEAKING';
  }

  public triggerVoiceCompanion(): void {
    const voiceApi = (window.islandAPI || window.island || window.roboIsland)?.voice || (window.islandAPI || window.island || window.roboIsland);
    if (this.isVoiceCompanionActive()) {
      if (voiceApi?.stopSpeaking) {
        voiceApi.stopSpeaking();
      } else if (voiceApi?.stopListening) {
        voiceApi.stopListening();
      }
      this.setVoiceState({ state: 'IDLE' });
    } else {
      if (voiceApi?.startListening) {
        voiceApi.startListening();
      } else if (voiceApi?.toggle) {
        voiceApi.toggle();
      }
      this.setVoiceState({ state: 'LISTENING', text: 'Listening...' });
    }
  }

  public interruptVoiceCompanion(): void {
    const voiceApi = (window.islandAPI || window.island || window.roboIsland)?.voice || (window.islandAPI || window.island || window.roboIsland);
    try {
      if (voiceApi?.stopSpeaking) {
        voiceApi.stopSpeaking();
      }
      if (voiceApi?.stopListening) {
        voiceApi.stopListening();
      }
    } catch {}
    this.setVoiceState({ state: 'IDLE' });
    try {
      AudioSynth.getInstance()?.play?.('pop');
    } catch {}
  }

  public setVoiceState(payload: any): void {
    if (!payload) return;
    const nextState = payload.state || 'IDLE';
    this.voiceState = nextState;
    if (typeof payload.audioLevel === 'number') this.voiceAudioLevel = payload.audioLevel;
    if (Array.isArray(payload.bands)) this.voiceBands = payload.bands;
    if (payload.text !== undefined) this.voiceQueryText = payload.text;
    if (payload.response !== undefined) this.voiceResponseText = payload.response;

    if (this.isVoiceCompanionActive()) {
      this.voiceHudStartTime = performance.now();
      this.voiceHudUntil = performance.now() + 8000;
      this.kickJelly(0.1, 3.5, 3.0);
      this.showVoiceCompanionCard(nextState, this.voiceResponseText || this.voiceQueryText);
    } else {
      this.voiceHudUntil = 0;
      this.hideVoiceCompanionCard();
    }

    this.updateTargetDimensions();
    this.requestRender();
  }

  public showVoiceCompanionCard(state: string, text?: string): void {
    const card = document.getElementById('voice-companion-card');
    if (!card) return;

    const titleEl = document.getElementById('voice-hud-title');
    const statusEl = document.getElementById('voice-hud-status');
    const iconEl = document.getElementById('voice-hud-icon');

    if (iconEl) {
      iconEl.textContent = state === 'SPEAKING' ? '🔊' : (state === 'THINKING' ? '⚡' : '🎙️');
    }

    if (titleEl) {
      titleEl.textContent = state === 'SPEAKING' ? 'Jarvis' : (state === 'THINKING' ? 'Thinking...' : 'Listening');
    }

    if (statusEl) {
      if (state === 'LISTENING') statusEl.textContent = text || 'Speak your request...';
      else if (state === 'THINKING') statusEl.textContent = 'Processing request...';
      else if (state === 'SPEAKING') statusEl.textContent = text || 'Jarvis speaking';
      else statusEl.textContent = '';
    }

    card.classList.remove('hidden');
  }

  public hideVoiceCompanionCard(): void {
    const card = document.getElementById('voice-companion-card');
    if (card) card.classList.add('hidden');
  }

  /**
   * 60FPS Vector Canvas Reactive Fluid Sound Wave Rendering for Jarvis Voice Companion.
   * Renders:
   * - 3-4 layered fluid sinusoidal waves with varying frequencies, phase offsets, and glowing colors.
   * - Jarvis cyan (#00f2fe), neon blue (#4facfe), amber (#ffaa00), magenta (#ff007f).
   * - Left: Animated Voice mic / pulsing orb glyph.
   * - Center: Live transcribed voice query, "Thinking...", or Jarvis response text.
   * - Right: 5-band frequency equalizer bars reflecting live audio level.
   * - All strictly inside 860x440 transparent viewport bounds.
   */
  public drawVoiceCompanionWave(cx: number, topY: number): void {
    const W = this.currentWidth;
    const H = this.currentHeight;
    const midY = topY + H / 2;
    const pillLeft = cx - W / 2;
    const now = performance.now();
    const t = now * 0.003;

    this.ctx.save();

    // 1. Fluid Sinusoidal Sound Waves
    const waveLeft = pillLeft + 16;
    const waveRight = pillLeft + W - 16;
    const waveWidth = waveRight - waveLeft;

    // Amplitude dynamically driven by audio level & frequency bands
    const baseAmp = this.voiceState === 'SPEAKING' ? 9.0 : (this.voiceState === 'THINKING' ? 4.5 : 6.0);
    const dynamicAmp = baseAmp * (0.3 + 0.7 * Math.max(0.15, this.voiceAudioLevel));

    // Multi-color sinusoidal waves
    const waves = [
      { color: 'rgba(0, 242, 254, 0.75)', freq: 0.035, speed: 2.8, phase: 0.0, ampMul: 1.0, shadow: '#00f2fe' },
      { color: 'rgba(79, 172, 254, 0.65)', freq: 0.025, speed: 2.1, phase: 1.6, ampMul: 0.85, shadow: '#4facfe' },
      { color: 'rgba(255, 170, 0, 0.55)', freq: 0.045, speed: 3.4, phase: 3.1, ampMul: 0.70, shadow: '#ffaa00' },
      { color: 'rgba(255, 0, 127, 0.45)', freq: 0.030, speed: 1.7, phase: 4.8, ampMul: 0.60, shadow: '#ff007f' }
    ];

    for (const w of waves) {
      this.ctx.save();
      this.ctx.strokeStyle = w.color;
      this.ctx.lineWidth = 1.6;
      this.ctx.lineCap = 'round';
      this.ctx.shadowColor = w.shadow;
      this.ctx.shadowBlur = 8;

      this.ctx.beginPath();
      const step = 4;
      for (let x = 0; x <= waveWidth; x += step) {
        const px = waveLeft + x;
        // Smooth bell curve envelope so wave tapers neatly at pill margins
        const normX = x / waveWidth;
        const envelope = Math.sin(normX * Math.PI);
        const yOffset = Math.sin(x * w.freq + t * w.speed + w.phase) * dynamicAmp * w.ampMul * envelope;
        const py = midY + yOffset;

        if (x === 0) {
          this.ctx.moveTo(px, py);
        } else {
          this.ctx.lineTo(px, py);
        }
      }
      this.ctx.stroke();
      this.ctx.restore();
    }

    // 2. Left Icon Slot: Jarvis Voice Orb / Mic Glyph
    const iconCx = pillLeft + 22;
    const iconCy = midY;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.5);

    this.ctx.save();
    // Glowing ambient halo
    this.ctx.beginPath();
    this.ctx.arc(iconCx, iconCy, 12 + pulse * 2.5, 0, Math.PI * 2);
    const haloColor = this.voiceState === 'SPEAKING'
      ? `rgba(0, 242, 254, ${0.15 + 0.15 * pulse})`
      : (this.voiceState === 'THINKING' ? `rgba(255, 170, 0, ${0.15 + 0.15 * pulse})` : `rgba(79, 172, 254, ${0.15 + 0.15 * pulse})`);
    this.ctx.fillStyle = haloColor;
    this.ctx.fill();

    // Central orb
    this.ctx.beginPath();
    this.ctx.arc(iconCx, iconCy, 7, 0, Math.PI * 2);
    const orbGrad = this.ctx.createLinearGradient(iconCx - 7, iconCy - 7, iconCx + 7, iconCy + 7);
    if (this.voiceState === 'SPEAKING') {
      orbGrad.addColorStop(0, '#00f2fe');
      orbGrad.addColorStop(1, '#4facfe');
    } else if (this.voiceState === 'THINKING') {
      orbGrad.addColorStop(0, '#ffaa00');
      orbGrad.addColorStop(1, '#ff5e62');
    } else {
      orbGrad.addColorStop(0, '#00f2fe');
      orbGrad.addColorStop(1, '#818cf8');
    }
    this.ctx.fillStyle = orbGrad;
    this.ctx.shadowColor = '#00f2fe';
    this.ctx.shadowBlur = 6;
    this.ctx.fill();

    // Inner highlight
    this.ctx.beginPath();
    this.ctx.arc(iconCx - 2, iconCy - 2, 2.2, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    this.ctx.fill();
    this.ctx.restore();

    // 3. Status Text / Voice Response / Query
    this.ctx.save();
    const textLeft = iconCx + 18;
    const maxTextW = W - 110;

    let displayTitle = '';
    let displaySub = '';
    let titleColor = '#ffffff';

    if (this.voiceState === 'LISTENING') {
      displayTitle = 'Jarvis';
      displaySub = this.voiceQueryText || 'Listening...';
      titleColor = '#00f2fe';
    } else if (this.voiceState === 'THINKING') {
      displayTitle = 'Thinking...';
      displaySub = 'Processing command';
      titleColor = '#ffaa00';
    } else if (this.voiceState === 'SPEAKING') {
      displayTitle = 'Jarvis';
      displaySub = this.voiceResponseText || 'Responding...';
      titleColor = '#00f2fe';
    } else {
      displayTitle = 'Voice Mode';
      displaySub = 'Idle';
    }

    // Title text
    this.ctx.font = '700 11px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.ctx.fillStyle = titleColor;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(displayTitle, textLeft, midY - 6);

    // Subtitle text (truncated smoothly)
    this.ctx.font = '500 10px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    let subToRender = displaySub;
    if (this.ctx.measureText(subToRender).width > maxTextW) {
      while (subToRender.length > 5 && this.ctx.measureText(subToRender + '…').width > maxTextW) {
        subToRender = subToRender.slice(0, -1);
      }
      subToRender += '…';
    }
    this.ctx.fillText(subToRender, textLeft, midY + 7);
    this.ctx.restore();

    // 4. Right 5-Band Equalizer Frequency Bars
    const eqRight = pillLeft + W - 16;
    const barW = 2.4;
    const gap = 2.0;
    const bands = this.voiceBands && this.voiceBands.length === 5 ? this.voiceBands : [0.3, 0.5, 0.8, 0.6, 0.4];

    this.ctx.save();
    for (let i = 0; i < 5; i++) {
      const bx = eqRight - (4 - i) * (barW + gap) - barW;
      const bVal = Math.max(0.15, Math.min(1.0, bands[i]));
      const bHeight = Math.max(4, Math.round(18 * bVal));
      const by = midY - bHeight / 2;

      this.ctx.fillStyle = i === 2 ? '#00f2fe' : (i < 2 ? '#4facfe' : '#ffaa00');
      this.ctx.shadowColor = '#00f2fe';
      this.ctx.shadowBlur = 4;
      this.ctx.beginPath();
      this.ctx.roundRect(bx, by, barW, bHeight, 1.2);
      this.ctx.fill();
    }
    this.ctx.restore();

    this.ctx.restore();
  }

  // ==========================================================================
  // Apple macOS / iOS Dynamic Time-of-Day Greetings & Smart Status Pill
  // ==========================================================================

  public triggerGreeting(forcedType?: 'morning' | 'afternoon' | 'evening' | 'night'): void {
    const now = new Date();
    const hour = now.getHours();
    this.lastGreetingHour = hour;

    if (forcedType) {
      this.greetingType = forcedType;
    } else if (hour >= 5 && hour < 12) {
      this.greetingType = 'morning';
    } else if (hour >= 12 && hour < 17) {
      this.greetingType = 'afternoon';
    } else if (hour >= 17 && hour < 21) {
      this.greetingType = 'evening';
    } else {
      this.greetingType = 'night';
    }

    if (this.greetingTimer) {
      clearTimeout(this.greetingTimer);
      this.greetingTimer = null;
    }

    this.greetingStartTime = performance.now();
    this.greetingUntil = performance.now() + 5500;
    if (this.mascot && typeof this.mascot.setMood === 'function') {
      this.mascot.setMood('happy', 5500);
    }
    this.kickJelly(0.12, 3.2, 4.8);
    this.updateTargetDimensions();

    // Fallback auto-dismiss timer ensures clean transition back to normal resting state
    this.greetingTimer = setTimeout(() => {
      this.dismissGreeting();
    }, 5600);
  }

  public dismissGreeting(): void {
    if (this.greetingTimer) {
      clearTimeout(this.greetingTimer);
      this.greetingTimer = null;
    }
    const hadGreeting = this.greetingUntil > 0;
    this.greetingUntil = 0;
    if (this.mascot && typeof this.mascot.setMood === 'function') {
      if (this.mascot.getMood() === 'happy') {
        this.mascot.setMood('neutral');
      }
    }
    if (hadGreeting) {
      this.updateTargetDimensions();
      if (this.config?.restModeEnabled && !this.mediaState.active && !this.focusState.active) {
        this.enterRest();
      }
    }
  }

  private safeRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient {
    if (this.ctx && typeof this.ctx.createRadialGradient === 'function') {
      return this.ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
    }
    return this.ctx.createLinearGradient(x0 - r1, y0, x1 + r1, y1);
  }

  public drawGreetingIcon(iconCx: number, iconCy: number, iconR: number = 12, type: string): void {
    const size = iconR * 2;
    const sx = iconCx - iconR;
    const sy = iconCy - iconR;
    const cr = iconR * 0.52; // Continuous Apple squircle corner radius

    this.ctx.save();

    // 1. Apple Continuous Squircle Platter with Realistic Sky Gradient
    let grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
    let borderRgba = 'rgba(255, 255, 255, 0.35)';

    switch (type) {
      case 'morning':
        // Apple Dawn Sky: Coral rose fading to golden sunrise amber
        grad.addColorStop(0, '#ff5722');
        grad.addColorStop(0.48, '#ff9800');
        grad.addColorStop(1, '#ffc107');
        borderRgba = 'rgba(255, 240, 215, 0.55)';
        break;
      case 'afternoon':
        // Apple Weather Vivid Cerulean: Deep sky blue fading into light azure
        grad.addColorStop(0, '#0070eb');
        grad.addColorStop(0.55, '#1ea1f2');
        grad.addColorStop(1, '#5ac8fa');
        borderRgba = 'rgba(215, 245, 255, 0.60)';
        break;
      case 'evening':
        // Apple Sunset Twilight: Velvet plum to orchid magenta to horizon amber
        grad.addColorStop(0, '#4a148c');
        grad.addColorStop(0.48, '#c2185b');
        grad.addColorStop(1, '#ff6f00');
        borderRgba = 'rgba(255, 215, 245, 0.55)';
        break;
      case 'night':
      default:
        // Apple Cosmic Midnight: Deep space navy to rich cosmic indigo
        grad.addColorStop(0, '#090d16');
        grad.addColorStop(0.55, '#1e1b4b');
        grad.addColorStop(1, '#312e81');
        borderRgba = 'rgba(199, 210, 254, 0.45)';
        break;
    }

    // Ambient drop shadow beneath the squircle plinth
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.42)';
    this.ctx.shadowBlur = 4;
    this.ctx.shadowOffsetY = 1.2;

    this.ctx.beginPath();
    this.ctx.roundRect(sx, sy, size, size, cr);
    this.ctx.fillStyle = grad;
    this.ctx.fill();

    // Reset shadow for crisp inner elements
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetY = 0;

    // Specular glass top reflection (Apple HIG glassmorphic luster)
    const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.48);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    this.ctx.fillStyle = sheen;
    this.ctx.beginPath();
    this.ctx.roundRect(sx, sy, size, size * 0.48, [cr, cr, 0, 0]);
    this.ctx.fill();

    // Inner rim stroke
    this.ctx.strokeStyle = borderRgba;
    this.ctx.lineWidth = 0.85;
    this.ctx.stroke();

    // 2. 3D Layered Apple Weather Vector Glyphs
    if (type === 'morning' || type === 'afternoon') {
      // 3D Apple Sun & Volumetric Cumulus Cloud
      const sunX = iconCx + 3.2;
      const sunY = iconCy - 2.8;

      // Soft sun corona bloom
      const sunGlow = this.safeRadialGradient(sunX, sunY, 1, sunX, sunY, 7.5);
      sunGlow.addColorStop(0, 'rgba(255, 220, 50, 0.65)');
      sunGlow.addColorStop(1, 'rgba(255, 149, 0, 0)');
      this.ctx.fillStyle = sunGlow;
      this.ctx.beginPath();
      this.ctx.arc(sunX, sunY, 7.5, 0, Math.PI * 2);
      this.ctx.fill();

      // 4 Apple micro corona rays
      this.ctx.strokeStyle = 'rgba(255, 240, 140, 0.75)';
      this.ctx.lineWidth = 1.1;
      this.ctx.lineCap = 'round';
      const rayAngles = [0, -Math.PI / 4, -Math.PI / 2, Math.PI / 4];
      for (const a of rayAngles) {
        this.ctx.beginPath();
        this.ctx.moveTo(sunX + Math.cos(a) * 4.6, sunY + Math.sin(a) * 4.6);
        this.ctx.lineTo(sunX + Math.cos(a) * 6.4, sunY + Math.sin(a) * 6.4);
        this.ctx.stroke();
      }

      // 3D Spherical Sun Orb with specular highlight
      const sunGrad = this.safeRadialGradient(sunX - 1.0, sunY - 1.0, 0.4, sunX, sunY, 4.0);
      sunGrad.addColorStop(0, '#ffffff');
      sunGrad.addColorStop(0.35, '#ffea79');
      sunGrad.addColorStop(0.75, '#ffb800');
      sunGrad.addColorStop(1, '#ff8800');
      this.ctx.fillStyle = sunGrad;
      this.ctx.beginPath();
      this.ctx.arc(sunX, sunY, 3.8, 0, Math.PI * 2);
      this.ctx.fill();

      // 3D Volumetric Cumulus Cloud (Layered in front of the sun)
      this.ctx.save();
      // Drop shadow from cloud onto squircle
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      this.ctx.shadowBlur = 3;
      this.ctx.shadowOffsetY = 1.2;

      // Cloud composite path: flat pill base + 3 organic rounded puffs
      const cloudGrad = this.ctx.createLinearGradient(iconCx - 6, iconCy - 4, iconCx - 6, iconCy + 6);
      cloudGrad.addColorStop(0, '#ffffff');
      cloudGrad.addColorStop(0.48, '#f8fafc');
      cloudGrad.addColorStop(1, '#cbd5e1'); // Soft silver underside shadow

      this.ctx.fillStyle = cloudGrad;
      this.ctx.beginPath();
      // Left puff
      this.ctx.arc(iconCx - 4.2, iconCy + 1.8, 3.2, 0, Math.PI * 2);
      // Main tall puff
      this.ctx.arc(iconCx - 1.2, iconCy - 0.2, 4.3, 0, Math.PI * 2);
      // Right puff
      this.ctx.arc(iconCx + 2.5, iconCy + 1.6, 3.3, 0, Math.PI * 2);
      // Flat bottom pill
      this.ctx.roundRect(iconCx - 5.8, iconCy + 1.4, 9.8, 4.0, 2.0);
      this.ctx.fill();

      // Cloud crest specular rim
      this.ctx.shadowColor = 'transparent';
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      this.ctx.lineWidth = 0.7;
      this.ctx.beginPath();
      this.ctx.arc(iconCx - 1.2, iconCy - 0.2, 4.3, -Math.PI * 0.85, -Math.PI * 0.15);
      this.ctx.stroke();

      this.ctx.restore();
    } else if (type === 'evening') {
      // Golden Sunset Horizon with Warm Shimmer
      const sunX = iconCx;
      const sunY = iconCy + 1.0;

      // Descending golden sunset sun orb
      const sunGrad = this.safeRadialGradient(sunX - 0.8, sunY - 0.8, 0.4, sunX, sunY, 4.6);
      sunGrad.addColorStop(0, '#ffffff');
      sunGrad.addColorStop(0.35, '#ffea79');
      sunGrad.addColorStop(0.75, '#ff8000');
      sunGrad.addColorStop(1, '#d84315');
      this.ctx.fillStyle = sunGrad;
      this.ctx.beginPath();
      this.ctx.arc(sunX, sunY, 4.4, 0, Math.PI * 2);
      this.ctx.fill();

      // Sunset horizon water/atmosphere shimmer lines
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      this.ctx.lineWidth = 1.1;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx - 6.2, iconCy + 2.4);
      this.ctx.lineTo(iconCx + 6.2, iconCy + 2.4);
      this.ctx.stroke();

      this.ctx.strokeStyle = 'rgba(255, 220, 180, 0.50)';
      this.ctx.lineWidth = 0.9;
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx - 3.8, iconCy + 4.2);
      this.ctx.lineTo(iconCx + 3.8, iconCy + 4.2);
      this.ctx.moveTo(iconCx - 1.8, iconCy + 5.6);
      this.ctx.lineTo(iconCx + 1.8, iconCy + 5.6);
      this.ctx.stroke();

      // Soft twilight cloud puff drifting above
      const cloudGrad = this.ctx.createLinearGradient(iconCx, iconCy - 5, iconCx, iconCy);
      cloudGrad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
      cloudGrad.addColorStop(1, 'rgba(253, 216, 178, 0.70)');
      this.ctx.fillStyle = cloudGrad;
      this.ctx.beginPath();
      this.ctx.arc(iconCx - 2.8, iconCy - 1.8, 2.5, 0, Math.PI * 2);
      this.ctx.arc(iconCx - 0.6, iconCy - 3.0, 3.0, 0, Math.PI * 2);
      this.ctx.arc(iconCx + 2.0, iconCy - 1.8, 2.2, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      // Cosmic Midnight: 3D Silver Crescent Moon & Diamond Stars
      const moonX = iconCx - 1.4;
      const moonY = iconCy + 0.5;

      // Soft lunar aura
      const moonGlow = this.safeRadialGradient(moonX, moonY, 1, moonX, moonY, 7.5);
      moonGlow.addColorStop(0, 'rgba(199, 210, 254, 0.55)');
      moonGlow.addColorStop(1, 'rgba(99, 102, 241, 0)');
      this.ctx.fillStyle = moonGlow;
      this.ctx.beginPath();
      this.ctx.arc(moonX, moonY, 7.5, 0, Math.PI * 2);
      this.ctx.fill();

      // 3D Silver Crescent Moon Path
      this.ctx.save();
      const moonGrad = this.ctx.createLinearGradient(moonX - 4, moonY - 5, moonX + 4, moonY + 5);
      moonGrad.addColorStop(0, '#ffffff');
      moonGrad.addColorStop(0.5, '#e2e8f0');
      moonGrad.addColorStop(1, '#94a3b8');
      this.ctx.fillStyle = moonGrad;

      this.ctx.beginPath();
      this.ctx.arc(moonX, moonY, 4.8, -Math.PI * 0.45, Math.PI * 0.55, false);
      this.ctx.bezierCurveTo(moonX + 3.0, moonY + 3.8, moonX + 3.0, moonY - 3.2, moonX, moonY - 4.4);
      this.ctx.closePath();
      this.ctx.fill();

      // Specular crest line on the moon's outer rim
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      this.ctx.lineWidth = 0.7;
      this.ctx.stroke();
      this.ctx.restore();

      // 4-Point Diamond Sparkle Star (Primary)
      const star1X = iconCx + 4.4;
      const star1Y = iconCy - 3.6;
      this.ctx.strokeStyle = '#c7d2fe';
      this.ctx.lineWidth = 1.1;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(star1X - 2.5, star1Y);
      this.ctx.lineTo(star1X + 2.5, star1Y);
      this.ctx.moveTo(star1X, star1Y - 2.5);
      this.ctx.lineTo(star1X, star1Y + 2.5);
      this.ctx.stroke();
      // Center brilliant glint
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(star1X, star1Y, 0.9, 0, Math.PI * 2);
      this.ctx.fill();

      // Micro twinkle star (Secondary)
      const star2X = iconCx + 5.0;
      const star2Y = iconCy + 3.8;
      this.ctx.fillStyle = '#a5b4fc';
      this.ctx.beginPath();
      this.ctx.arc(star2X, star2Y, 0.8, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  public drawGreetingPill(cx: number, topY: number): void {
    const midY = topY + this.currentHeight / 2;
    const pillLeft = cx - this.currentWidth / 2;
    const pillRight = cx + this.currentWidth / 2;

    const type = this.greetingType;
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayStr = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;

    let greetingTitle = `Good Morning, ${this.userName || 'Gaurav'}!`;
    let auraColor = 'rgba(255, 149, 0, 0.12)';
    let weatherCond = this.weatherState.condition && this.weatherState.condition !== 'Checking...'
      ? this.weatherState.condition
      : 'Sunny';

    switch (type) {
      case 'morning':
        greetingTitle = `Good Morning, ${this.userName || 'Gaurav'}!`;
        auraColor = 'rgba(255, 149, 0, 0.12)';
        break;
      case 'afternoon':
        greetingTitle = `Good Afternoon, ${this.userName || 'Gaurav'}!`;
        auraColor = 'rgba(14, 165, 233, 0.12)';
        break;
      case 'evening':
        greetingTitle = `Good Evening, ${this.userName || 'Gaurav'}!`;
        auraColor = 'rgba(192, 38, 211, 0.12)';
        weatherCond = this.weatherState.condition && this.weatherState.condition !== 'Checking...'
          ? this.weatherState.condition
          : 'Clear';
        break;
      case 'night':
      default:
        greetingTitle = `Good Night, ${this.userName || 'Gaurav'}!`;
        auraColor = 'rgba(99, 102, 241, 0.12)';
        weatherCond = this.weatherState.condition && this.weatherState.condition !== 'Checking...'
          ? this.weatherState.condition
          : 'Clear Night';
        break;
    }

    const greetingSubtitle = `${dayStr} • ${weatherCond}`;

    this.ctx.save();

    // 1. Subtle Apple Ambient Background Glow inside the Pill
    const auraGrad = this.safeRadialGradient(pillLeft + 22, midY, 4, pillLeft + 60, midY, 110);
    auraGrad.addColorStop(0, auraColor);
    auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.ctx.fillStyle = auraGrad;
    this.ctx.beginPath();
    this.ctx.roundRect(pillLeft, topY, this.currentWidth, this.currentHeight, this.currentRadius);
    this.ctx.fill();

    // 2. Draw Apple Continuous Squircle Time-of-Day Weather Icon
    this.drawGreetingIcon(pillLeft + 22, midY, 12, type);

    // 3. Title & Subtitle Typography (Apple SF Pro Display / Text)
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';

    // Title
    this.ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", sans-serif';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText(greetingTitle, pillLeft + 42, midY - 4.5);

    // Subtitle
    this.ctx.font = '500 10px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    this.ctx.fillText(greetingSubtitle, pillLeft + 42, midY + 7.5);

    // 4. Right Side: Apple Live Weather Temperature Badge
    const badgeW = 46;
    const badgeH = 20;
    const badgeR = 10;
    const bx = pillRight - badgeW - 12;
    const by = midY - badgeH / 2;

    // Frosted glass background
    const bGrad = this.ctx.createLinearGradient(bx, by, bx, by + badgeH);
    bGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    bGrad.addColorStop(1, 'rgba(255, 255, 255, 0.06)');
    this.ctx.fillStyle = bGrad;
    this.ctx.beginPath();
    this.ctx.roundRect(bx, by, badgeW, badgeH, badgeR);
    this.ctx.fill();

    // Subtle glass border
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    this.ctx.lineWidth = 0.8;
    this.ctx.stroke();

    // Temperature text & weather micro pip
    const tempRaw = this.weatherState.temp || '25°';
    const tempClean = tempRaw.replace('C', '').trim();

    if (type === 'night') {
      // Mini silver moon pip
      this.ctx.fillStyle = '#e2e8f0';
      this.ctx.beginPath();
      this.ctx.arc(bx + 9, midY, 2.2, -Math.PI * 0.4, Math.PI * 0.6, false);
      this.ctx.closePath();
      this.ctx.fill();
    } else {
      // Mini golden sun pip
      this.ctx.fillStyle = '#ffcc00';
      this.ctx.beginPath();
      this.ctx.arc(bx + 9, midY, 2.4, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.font = '700 10.5px -apple-system, BlinkMacSystemFont, "SF Pro Rounded", "SF Pro Text", "Segoe UI", sans-serif';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(tempClean, bx + 16, midY);

    this.ctx.restore();
  }

  public static parseAppActivityStatic(proc: string, rawTitle: string, hwnd?: number): {
    proc: string;
    appName: string;
    cleanTitle: string;
    kind: string;
    timestamp: number;
    hwnd?: number;
  } | null {
    const p = (proc || '').toLowerCase().trim();
    const title = (rawTitle || '').trim();
    let appName = proc;
    let cleanTitle = title;
    let kind = 'default';

    // 1. VS Code
    if (p === 'code' || p === 'code - oss' || p === 'vscodium') {
      appName = 'Visual Studio Code';
      kind = 'vscode';
      // Format: <file> - <project> - Visual Studio Code
      const parts = title.split(' - ');
      if (parts.length >= 3) {
        const file = parts[0].trim();
        const project = parts[1].trim();
        cleanTitle = `${project} • ${file}`;
      } else if (parts.length === 2) {
        cleanTitle = parts[0].trim();
      }
    }
    // 2. Google Chrome
    else if (p === 'chrome') {
      appName = 'Google Chrome';
      kind = 'chrome';
      cleanTitle = title.replace(/\s*-\s*Google Chrome\s*$/i, '').trim();
    }
    // 3. Microsoft Edge
    else if (p === 'msedge') {
      appName = 'Microsoft Edge';
      kind = 'edge';
      cleanTitle = title.replace(/\s*-\s*Microsoft\u200b? Edge\s*$/i, '').replace(/\s*-\s*Work\s*$/i, '').trim();
    }
    // 4. Terminal / PowerShell / Command Prompt
    else if (p === 'powershell' || p === 'pwsh' || p === 'cmd' || p === 'windowsterminal' || p === 'wt' || p === 'bash') {
      appName = 'Terminal';
      kind = 'terminal';
      if (title.toLowerCase().includes('powershell') || title.toLowerCase().includes('cmd.exe')) {
        cleanTitle = 'PowerShell Session';
      } else {
        cleanTitle = title.replace(/\s*-\s*Terminal\s*$/i, '').trim();
      }
    }
    // 5. WhatsApp
    else if (p.includes('whatsapp')) {
      appName = 'WhatsApp';
      kind = 'whatsapp';
      cleanTitle = title.replace(/\s*-\s*WhatsApp\s*$/i, '').trim();
      if (!cleanTitle || cleanTitle.toLowerCase() === 'whatsapp') {
        cleanTitle = 'Active Chat';
      }
    }
    // 6. Spotify
    else if (p === 'spotify') {
      appName = 'Spotify';
      kind = 'spotify';
      cleanTitle = title.replace(/\s*-\s*Spotify\s*(Premium|Free)?\s*$/i, '').trim();
      if (!cleanTitle || cleanTitle.toLowerCase() === 'spotify') {
        cleanTitle = 'Playing Audio';
      }
    }
    // 7. Discord
    else if (p === 'discord') {
      appName = 'Discord';
      kind = 'discord';
      cleanTitle = title.replace(/\s*-\s*Discord\s*$/i, '').trim();
    }
    // 8. Slack
    else if (p === 'slack') {
      appName = 'Slack';
      kind = 'slack';
      cleanTitle = title.replace(/\s*-\s*Slack\s*$/i, '').trim();
    }
    // 9. Windows Explorer
    else if (p === 'explorer') {
      appName = 'File Explorer';
      kind = 'explorer';
      cleanTitle = title || 'Files';
    }
    // 10. Snipping Tool
    else if (p.includes('snipping') || p.includes('screensketch')) {
      appName = 'Snipping Tool';
      kind = 'snipping';
      cleanTitle = 'Screen Capture';
    }
    // 11. Windows Security / Defender
    else if (p.includes('sechealth') || p.includes('security')) {
      appName = 'Windows Security';
      kind = 'defender';
      cleanTitle = 'Protected';
    }
    // 12. Settings
    else if (p.includes('settings')) {
      appName = 'Settings';
      kind = 'settings';
      cleanTitle = title.replace(/\s*-\s*Settings\s*$/i, '').trim() || 'System Preferences';
    }
    // 13. Creative & Productivity Apps
    else if (p === 'figma') {
      appName = 'Figma';
      kind = 'figma';
      cleanTitle = title.replace(/\s*-\s*Figma\s*$/i, '').trim();
    } else if (p === 'blender') {
      appName = 'Blender';
      kind = 'blender';
      cleanTitle = title.replace(/\s*-\s*Blender\s*$/i, '').trim();
    } else if (p.includes('photoshop')) {
      appName = 'Photoshop';
      kind = 'photoshop';
      cleanTitle = title.replace(/\s*@.*$/i, '').trim();
    } else if (p === 'notepad') {
      appName = 'Notepad';
      kind = 'notepad';
      cleanTitle = title.replace(/\s*-\s*Notepad\s*$/i, '').trim();
    }
    // Default fallback
    else {
      appName = proc ? (proc.charAt(0).toUpperCase() + proc.slice(1)) : 'Application';
      cleanTitle = title.replace(new RegExp(`\\s*-\\s*${appName}\\s*$`, 'i'), '').trim();
      kind = p || 'default';
    }

    if (!cleanTitle) cleanTitle = appName;
    if (cleanTitle.length > 40) cleanTitle = cleanTitle.slice(0, 38) + '...';

    return {
      proc,
      appName,
      cleanTitle,
      kind,
      timestamp: performance.now(),
      hwnd
    };
  }

  public parseAppActivity(proc: string, rawTitle: string, hwnd?: number): any {
    return CanvasEngine.parseAppActivityStatic(proc, rawTitle, hwnd);
  }

  public handleAppActivity(act: { proc?: string; title?: string; hwnd?: number }): void {
    if (!act || !act.proc) return;
    const proc = (act.proc || '').trim();
    const title = (act.title || '').trim();

    // Ignore RoboIsland itself and internal background system windows
    const lowerProc = proc.toLowerCase();
    if (lowerProc === 'roboisland' || lowerProc === 'electron' ||
        lowerProc === 'shellexperiencehost' || lowerProc === 'searchhost' ||
        lowerProc === 'startmenuexperiencehost' || lowerProc === 'lockapp' ||
        lowerProc === 'idle') {
      return;
    }

    // Ignore empty desktop titles or lock screen
    if (!title || title === 'Task Switching' || title === 'Windows Shell Experience') {
      return;
    }

    const parsed = CanvasEngine.parseAppActivityStatic(proc, title, act.hwnd);
    if (!parsed) return;

    // Check if it actually changed from previous activity
    if (this.activeAppActivity &&
        this.activeAppActivity.proc === parsed.proc &&
        this.activeAppActivity.cleanTitle === parsed.cleanTitle) {
      return;
    }

    this.activeAppActivity = parsed;
    this.appActivityStartTime = performance.now();
    this.appActivityUntil = performance.now() + 4500;
    this.kickJelly(0.10, 3.5, 5.0);
    this.updateTargetDimensions();
  }

  public drawCompactAppActivity(cx: number, topY: number): void {
    if (!this.activeAppActivity) return;
    const act = this.activeAppActivity;
    const midY = topY + this.currentHeight / 2;
    const pillLeft = cx - this.currentWidth / 2;
    const pillRight = cx + this.currentWidth / 2;

    // 1. Draw Apple Mac Squircle App Icon
    this.drawAppleAppIcon(pillLeft + 19, midY, 11, act.kind, undefined, act.appName);

    // 2. App Name & Clean Activity Title
    this.ctx.save();
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';

    // Title (App Name)
    this.ctx.font = '700 11.5px -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", sans-serif';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText(act.appName, pillLeft + 37, midY - 4.5);

    // Subtitle (Active Document / Page / Session)
    this.ctx.font = '500 10px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillText(act.cleanTitle, pillLeft + 37, midY + 7.5);

    // 3. Apple macOS / iPhone Live Activity Pulsing Radar Dot
    const dotX = pillRight - 18;
    const dotY = midY;
    const pulse = (Math.sin(performance.now() / 250) + 1) / 2;
    const radarR = 4.2 + pulse * 2.5;
    const radarAlpha = (1 - pulse) * 0.45;

    // Outer radar wave
    this.ctx.strokeStyle = `rgba(34, 197, 94, ${radarAlpha})`;
    this.ctx.lineWidth = 1.2;
    this.ctx.beginPath();
    this.ctx.arc(dotX, dotY, radarR, 0, Math.PI * 2);
    this.ctx.stroke();

    // Inner vibrant live green dot
    this.ctx.fillStyle = '#22c55e';
    this.ctx.beginPath();
    this.ctx.arc(dotX, dotY, 3.0, 0, Math.PI * 2);
    this.ctx.fill();

    // Center specular reflection
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(dotX - 0.7, dotY - 0.7, 0.9, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  public drawDetachedAppActivityBubble(bubbleCx: number, bubbleCy: number, bubbleR: number, activity: any): void {
    if (!activity) return;

    this.ctx.save();
    // 1. Apple Squircle App Icon inside detached circular bubble
    this.drawAppleAppIcon(bubbleCx, bubbleCy, 10, activity.kind, undefined, activity.appName);

    // 2. Tiny Live Status Indicator Dot at bottom right
    const dotX = bubbleCx + 7;
    const dotY = bubbleCy + 7;
    this.ctx.fillStyle = '#22c55e';
    this.ctx.beginPath();
    this.ctx.arc(dotX, dotY, 2.2, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1.0;
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * TwoCode startHello() Windows Startup Entrance Animation
   * Direct parity with TwoCode twocode-fun.js lines 305-397.
   * HELLO = { land: 380, hi: 700, tilt: 1300, wink: 2000, end: 2700 }
   */
  public startHello(): void {
    if (this.isStartupHelloBusy) return;
    this.isStartupHelloBusy = true;
    const now = performance.now();
    this.startupHelloStartTime = now;
    this.popAt = now + 180;

    // 1. Plop open from the screen bezel into compact mode
    this.setMode('compact');
    this.kickJelly(0.12);
    try {
      AudioSynth.getInstance().blobTone(180, 620, 0.16, 0.06);
    } catch {}

    // 2. Lands in island with squash (380ms)
    setTimeout(() => {
      try {
        AudioSynth.getInstance().blobTone(520, 240, 0.08, 0.05);
      } catch {}
    }, 380);

    // 3. Stretches up tall, says "Hi!", smiles & waves (700ms)
    setTimeout(() => {
      this.mascot.setMood('happy');
      try {
        AudioSynth.getInstance().sayHi();
      } catch {}
    }, 700);

    // 4. Cute head tilt (1300ms)
    setTimeout(() => {
      this.mascot.setMood('happy');
    }, 1300);

    // 5. Playful wink with sweet blip tone (2000ms)
    setTimeout(() => {
      this.mascot.setMood('wink');
      try {
        AudioSynth.getInstance().blobTone(900, 1300, 0.05, 0.025);
      } catch {}
    }, 2000);

    // 6. Gentle settle back into minimal resting dock (2700ms)
    setTimeout(() => {
      this.isStartupHelloBusy = false;
      this.startupHelloStartTime = 0;
      this.popAt = 0;
      this.mascot.setMood('neutral');
      if (this.config && this.config.restModeEnabled) {
        this.setMode('rest');
      } else {
        this.setMode('compact', false);
      }
      this.kickJelly(0.07, 3);

      // Trigger time-of-day greeting cleanly after Robo's startup entrance & blink animation finish
      setTimeout(() => {
        this.triggerGreeting();
      }, 400);
    }, 2700);
  }

  private volumeState = {
    level: 50,
    muted: false
  };
  private netState = {
    ssid: 'Connected',
    bars: 4,
    wifiOn: true,
    btOn: false,
    btDevice: ''
  };

  // Focus Timer
  private focusState = {
    active: false,
    totalSeconds: 25 * 60,
    remainingSeconds: 25 * 60,
    isBreak: false
  };

  // Config
  private config: any = {
    islandStyle: 'floating',
    islandScale: 1.0,
    visualTexture: 'obsidian',
    soundEnabled: true,
    expandedUiMode: 'dom'
  };

  public isBuddyOut = false;

  // TwoCode startup animation & jelly spring physics
  public isStartupHelloBusy = false;
  public startupHelloStartTime = 0;
  public popAt = 0;
  private kicks: Array<{ at: number; amp: number; hz: number; damp: number }> = [];
  private tuckHoverStartTime = 0;
  private tuckChangedAt = 0;
  private tuckArmed = false;
  private nextBlinkTime = performance.now() + 2500;
  private islandSpring = { vWidth: 0, vHeight: 0, vRadius: 0, last: 0 };

  public twoCodeSpring(ms: number, amp: number, hz = 3, damp = 6): number {
    return ms < 0 ? 0 : amp * Math.exp(-damp * ms / 1000) * Math.sin(2 * Math.PI * hz * ms / 1000);
  }

  public kickJelly(amp: number = 0.12, hz: number = 2.6, damp: number = 5.5): void {
    const nowMs = performance.now();
    if (!this.kicks) this.kicks = [];
    this.kicks = this.kicks.filter(k => nowMs - k.at < 1200);
    this.kicks.push({ at: nowMs, amp, hz, damp });
    if (this.kicks.length > 4) this.kicks.shift();
    this.requestRender();
  }

  // Hybrid DOM Expanded UI Overlay (Rollback safety via config.expandedUiMode)
  private domOverlayEl: HTMLElement | null = null;
  private currentDomTab: 'home' | 'ai' | 'music' | 'chat' | 'focus' | 'tray' | 'clipboard' | 'notes' | 'settings' | 'agenda' = 'home';
  private activePopover: 'none' | 'wifi' | 'bt' = 'none';
  private agendaEvents: Array<{ id: string; title: string; timeStr: string; mins: number; duration: number; subtitle?: string }> = [
    { id: '1', title: 'Design review', timeStr: '10:30 AM', mins: 630, duration: 60, subtitle: 'NEXT • IN 48 MIN' },
    { id: '2', title: 'Team Sync', timeStr: '1:00 PM', mins: 780, duration: 60, subtitle: 'TODAY • IN 3 HRS' },
    { id: '3', title: 'Sprint Retro', timeStr: '6:00 PM', mins: 1080, duration: 60, subtitle: 'TONIGHT • AT 6:00 PM' }
  ];
  private selectedAgendaEventId = '1';
  private agendaViewMode: 'day' | 'month' = 'day';
  private agendaAccountEmail = 'you@gmail.com';
  private agendaListenersBound = false;
  private agendaNotificationWarned = new Set<string>();
  private agendaNotifierTimer: any = null;

  public setPopover(target: 'none' | 'wifi' | 'bt'): void {
    this.activePopover = target;
    const popover = document.getElementById('system-popover');
    const panelWifi = document.getElementById('popover-panel-wifi');
    const panelBt = document.getElementById('popover-panel-bt');
    const btnWifi = document.getElementById('btn-status-wifi');
    const btnBt = document.getElementById('btn-status-bt');
    const btnGroup = document.getElementById('btn-system-popover');

    if (btnWifi) btnWifi.classList.toggle('active', target === 'wifi');
    if (btnBt) btnBt.classList.toggle('active', target === 'bt');
    if (btnGroup) btnGroup.classList.toggle('active', target !== 'none');

    if (target === 'none') {
      if (popover) popover.classList.add('hidden');
      if (panelWifi) panelWifi.classList.add('hidden');
      if (panelBt) panelBt.classList.add('hidden');
    } else if (target === 'wifi') {
      if (popover) {
        popover.style.left = '12px';
        popover.classList.remove('hidden');
      }
      if (panelWifi) panelWifi.classList.remove('hidden');
      if (panelBt) panelBt.classList.add('hidden');
    } else if (target === 'bt') {
      if (popover) {
        popover.style.left = '34px';
        popover.classList.remove('hidden');
      }
      if (panelWifi) panelWifi.classList.add('hidden');
      if (panelBt) panelBt.classList.remove('hidden');
    }
  }

  public updateNetworkDom(): void {
    const ssidEl = document.getElementById('popover-wifi-ssid');
    const tileWifiEl = document.getElementById('tile-wifi');
    if (ssidEl) ssidEl.textContent = this.netState.wifiOn ? (this.netState.ssid || 'Connected') : 'Off';
    if (tileWifiEl) tileWifiEl.classList.toggle('active', this.netState.wifiOn);

    const btStatusEl = document.getElementById('popover-bt-status');
    const tileBtEl = document.getElementById('tile-bt');
    if (btStatusEl) btStatusEl.textContent = this.netState.btOn ? (this.netState.btDevice || 'Active') : 'Off';
    if (tileBtEl) tileBtEl.classList.toggle('active', this.netState.btOn);
  }

  /**
   * Spotify-Style Synced Lyrics Stream DOM updater:
   * Keeps prev (dark & faint), active (bright white bold), and next (dark & faint) synchronized
   * with smooth vertical roll transitions matching TwoCode & Spotify.
   */
  public updateLyricsDom(): void {
    const wrapEl = document.getElementById('media-lyrics-wrap');
    const prevEl = document.getElementById('lyrics-line-prev');
    const activeEl = document.getElementById('lyrics-line-active');
    const nextEl = document.getElementById('lyrics-line-next');
    if (!wrapEl || !activeEl) return;

    // Normal mode: If no synced lyrics or music isn't actively playing, completely hide the lyrics box
    if (!this.hasSyncedLyrics() || !this.mediaState.playing || !this.mediaState.active) {
      wrapEl.style.display = 'none';
      if (prevEl) prevEl.textContent = '';
      if (activeEl) activeEl.textContent = '';
      if (nextEl) nextEl.textContent = '';
      return;
    }

    // Synced lyrics are available: reveal the floating transparent lyrics
    wrapEl.style.display = 'flex';
    const lyr = this.getLyricAround();
    const newPrev = (lyr && lyr.before) || '';
    const newNow = (lyr && lyr.now) || '';
    const newNext = (lyr && lyr.next) || '';

    if (activeEl.textContent !== newNow) {
      activeEl.textContent = newNow;
      wrapEl.classList.remove('lyrics-roll');
      void wrapEl.offsetWidth; // force reflow for smooth animation
      wrapEl.classList.add('lyrics-roll');
    }
    if (prevEl && prevEl.textContent !== newPrev) prevEl.textContent = newPrev;
    if (nextEl && nextEl.textContent !== newNext) nextEl.textContent = newNext;
  }

  private lastTime = performance.now();

  // UX-4: Resource Optimization — idle frame throttling and dirty-flag render
  private _idleFrameCount = 0;
  private _lastRenderHash = '';
  private _isPowerSaving = false;
  private _powerSavingFrameInterval = 0; // ms between frames in power-saving mode (0 = disabled)
  private _lastPowerSaveFrame = 0;
  private _lastIdleRestFrame = 0;
  private _lastRenderTimestamp = 0;
  private lastSentBoundsW = 0;
  private lastSentBoundsH = 0;
  private _isRenderingActive = false;
  private _hasRenderedSettledFrame = false;
  private _idleWakeupTimer: any = null;
  private _cachedEyeSlotRect: DOMRect | null = null;
  private _statusDateTimeEl: HTMLElement | null = null;
  private _weatherTempEl: HTMLElement | null = null;
  private _weatherCondEl: HTMLElement | null = null;
  private _mascotEyeSlotEl: HTMLElement | null = null;
  private _lastOverlayW = -1;
  private _lastOverlayH = -1;
  private _lastOverlayTopY = -1;
  private _lastClockSec = -1;
  private _lastClockIs24h: boolean | null = null;
  private _lastWeatherTemp = '';
  private _lastWeatherCond = '';

  public requestRender(): void {
    this._hasRenderedSettledFrame = false;
    if (this._idleWakeupTimer) {
      clearTimeout(this._idleWakeupTimer);
      this._idleWakeupTimer = null;
    }
    if (!this._isRenderingActive) {
      this._isRenderingActive = true;
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(this.renderLoop);
      }
    }
  }

  constructor() {
    this.renderLoop = this.renderLoop.bind(this);
    this.canvas = document.getElementById('island-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d', { alpha: true })!;
    this.mascot = new RoboMascot();

    this.initCanvasSize();
    this.initDomOverlay();
    try {
      this.isSportsPillEnabled = localStorage.getItem('roboisland_sports_pill_enabled') === 'true';
    } catch {
      this.isSportsPillEnabled = false;
    }
    this.setupEvents();
    this.loadInitialData();
    this.reportCapsuleBounds();

    this._isRenderingActive = true;
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(this.renderLoop);
    }
  }

  public reportCapsuleBounds(): void {
    if (typeof window === 'undefined' || !window.roboIsland?.updateCapsuleBounds) return;
    const curW = Math.round(this.mode === 'expanded' ? Math.max(this.targetWidth, this.currentWidth) : this.currentWidth);
    const curH = Math.round(this.mode === 'expanded' ? Math.max(this.targetHeight, this.currentHeight) : this.currentHeight);
    const bubbleSize = this.currentHeight;
    const isSplit = this.isSplitIslandActive();
    const totalSpan = isSplit ? Math.round(curW + 8 + bubbleSize) : curW;

    window.roboIsland.updateCapsuleBounds({
      width: curW,
      height: curH,
      topY: this.getTopY(),
      isSplit,
      splitSpan: totalSpan
    });
  }

  private initCanvasSize(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  private async loadInitialData(): Promise<void> {
    if (!window.roboIsland) return;

    try {
      this.config = await window.roboIsland.getConfig();
      if (this.config.mascotSkin) this.mascot.setSkin(this.config.mascotSkin);
      if (this.config.mascotHat) this.mascot.setHat(this.config.mascotHat);
      if (this.config.mascotOutfit) this.mascot.setOutfit(this.config.mascotOutfit);
      if (this.config.mascotBodyColor) this.mascot.setBodyColor(this.config.mascotBodyColor);
      if (this.config.mascotEyeColor) this.mascot.setEyeColor(this.config.mascotEyeColor);
      if (this.config.mascotMood) this.setMascotMood(this.config.mascotMood);
      if (this.config.language && (window as any).roboIslandI18n) (window as any).roboIslandI18n.setLocale(this.config.language);
      if (this.config.textureSkin) TextureEngine.getInstance().style = this.config.textureSkin as any;
      else if (this.config.visualTexture) TextureEngine.getInstance().style = this.config.visualTexture as any;
      if (this.config.soundPack) AudioSynth.getInstance().soundPack = this.config.soundPack as any;
      if (typeof this.config.soundEnabled === 'boolean') AudioSynth.getInstance().enabled = this.config.soundEnabled;
    } catch {}

    try {
      const state = await window.roboIsland.getMediaState();
      if (state) this.handleMediaStateUpdate(state);
    } catch {}

    try {
      const vol = await window.roboIsland.getVolume();
      if (vol && typeof vol.level === 'number' && vol.level >= 0) {
        this.volumeState = vol;
        this.volumeHudLevel = vol.level;
        this.volumeHudMuted = Boolean(vol.muted);
        this.isVolumeInitialized = true;
      }
    } catch {}

    try {
      const net = await window.roboIsland.getNetwork();
      if (net) {
        if (net.wifi) {
          this.netState.wifiOn = net.wifi.on !== false;
          this.netState.ssid = net.wifi.ssid || (this.netState.wifiOn ? 'Connected' : 'Off');
          this.netState.bars = net.wifi.bars || 4;
        }
        if (net.bt) {
          this.netState.btOn = net.bt.on === true;
          this.netState.btDevice = (net.bt.devices && net.bt.devices[0]) ? net.bt.devices[0] : (this.netState.btOn ? 'Active' : 'Off');
        }
        this.updateNetworkDom();
      }
    } catch {}

    try {
      if (window.roboIsland?.getSystemMetrics) {
        const m = await window.roboIsland.getSystemMetrics();
        if (m) {
          this.metricsState = m;
          if (typeof m.cpu === 'number') this.config.lastCpuPercent = m.cpu;
          if (typeof m.ram === 'number') this.config.lastRamPercent = m.ram;
        }
      }
    } catch {}

    // Init Battery + UX-4: Power-saving throttle detection
    if ('getBattery' in navigator) {
      try {
        const b = await (navigator as any).getBattery();
        this.batteryState.level = Math.round(b.level * 100);
        this.batteryState.charging = b.charging;
        this._updatePowerSavingMode(b);
        b.addEventListener('levelchange', () => {
          this.batteryState.level = Math.round(b.level * 100);
          this._updatePowerSavingMode(b);
        });
        b.addEventListener('chargingchange', () => {
          const wasCharging = this.batteryState.charging;
          this.batteryState.charging = b.charging;
          this._updatePowerSavingMode(b);
          if (wasCharging !== b.charging) {
            this.triggerChargerSurge(b.charging, Math.round(b.level * 100));
          }
        });
      } catch {}
    }

    // Init Sports Scoreboard State (Cricket, Football, F1)
    try {
      if (window.roboIsland?.sports?.getState) {
        this.sportsState = await window.roboIsland.sports.getState();
        if (this.sportsState && this.sportsState.activities) {
          this.activeSportsActivity = this.sportsState.activities[this.sportsState.activeSport];
          this.updateTargetDimensions();
          this.renderSportsScorecardDOM();
        }
      } else if (window.roboIsland?.getSportsState) {
        this.sportsState = await window.roboIsland.getSportsState();
        if (this.sportsState && this.sportsState.activities) {
          this.activeSportsActivity = this.sportsState.activities[this.sportsState.activeSport];
          this.updateTargetDimensions();
          this.renderSportsScorecardDOM();
        }
      }
    } catch {}

    // Init Weather via Open-Meteo (No API key required)
    this.fetchWeather();
    setInterval(() => this.fetchWeather(), 15 * 60 * 1000);

    // Trigger TwoCode startup hello entrance animation
    setTimeout(() => {
      this.startHello();
    }, 280);
  }

  private async fetchWeather(): Promise<void> {
    try {
      if (window.roboIsland && typeof window.roboIsland.getWeatherData === 'function') {
        const data = await window.roboIsland.getWeatherData();
        if (data && typeof data.temperature === 'number') {
          this.weatherState.temp = `${Math.round(data.temperature)}°C`;
          this.weatherState.condition = data.condition || 'Clear';
          return;
        }
      }
      const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=28.61&longitude=77.23&current=temperature_2m,weather_code', {
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.current) {
          const t = Math.round(json.current.temperature_2m);
          this.weatherState.temp = `${t}°C`;
          this.weatherState.condition = 'Clear';
        }
      }
    } catch {}
  }

  private initWhatsAppQuickReply(): void {
    const waBar = document.getElementById('whatsapp-quick-reply-bar');
    const waInput = document.getElementById('whatsapp-reply-input') as HTMLInputElement | null;
    const waBtn = document.getElementById('whatsapp-reply-send-btn');

    // Emoji reaction buttons
    const reactBtns = document.querySelectorAll('.wa-react-btn');
    reactBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const emoji = btn.getAttribute('data-emoji') || '👍';
        this.submitWhatsAppReply(emoji);
      });
    });

    if (waInput) {
      waInput.addEventListener('input', () => {
        this.whatsAppReplyText = waInput.value;
        if (waBtn) {
          if (waInput.value.trim().length > 0) {
            waBtn.classList.add('active');
          } else {
            waBtn.classList.remove('active');
          }
        }
      });
    }

    if (waBtn && waInput) {
      waBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.submitWhatsAppReply(waInput.value);
      });
    }

    if (waBar) {
      waBar.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      waBar.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
    }
  }

  private setupEvents(): void {
    window.addEventListener('resize', () => this.initCanvasSize());
    this.initWhatsAppQuickReply();

    let dragStart: { x: number; y: number; time: number; onEyes: boolean } | null = null;
    let swallowClick = false;

    // Pointer down: track start of swipe or buddy drag
    window.addEventListener('mousedown', (e) => {
      SystemAudioVisualizer.getInstance().resumeAudioContext();
      if (e.button !== 0) return;
      const cx = window.innerWidth / 2;
      const topY = this.getTopY();
      const effectiveW = this.mode === 'expanded' ? Math.max(this.targetWidth, this.currentWidth) : this.currentWidth;
      const effectiveH = this.mode === 'expanded' ? Math.max(this.targetHeight, this.currentHeight) : this.currentHeight;
      const inIsland = Math.abs(e.clientX - cx) <= effectiveW / 2 && e.clientY >= topY && e.clientY <= topY + effectiveH;
      const onEyes = (this.mode === 'compact' || this.mode === 'rest') && Math.abs(e.clientX - cx) <= 32 && e.clientY >= topY && e.clientY <= topY + effectiveH;

      if (inIsland) {
        dragStart = { x: e.clientX, y: e.clientY, time: performance.now(), onEyes };
      }

      // Volume HUD scrubbing on pill track
      if (performance.now() < this.volumeHudUntil) {
        const trackLeft = cx - this.currentWidth / 2 + 52;
        const trackRight = cx + this.currentWidth / 2 - 52;
        const trackW = Math.max(20, trackRight - trackLeft);
        const midY = topY + this.currentHeight / 2;
        if (e.clientX >= trackLeft - 8 && e.clientX <= trackRight + 8 && Math.abs(e.clientY - midY) <= 14) {
          this.isScrubbingVolumeHud = true;
          swallowClick = true;
          const clampedX = Math.max(trackLeft, Math.min(trackRight, e.clientX));
          const pct = Math.round(((clampedX - trackLeft) / trackW) * 100);
          this.volumeHudLevel = pct;
          this.volumeHudMuted = false;
          this.volumeHudUntil = performance.now() + 2200;
          if (window.roboIsland?.setVolume) {
            window.roboIsland.setVolume(pct);
          }
          return;
        }
      }
    });

    // Mouse movement & interactivity tracking
    window.addEventListener('mousemove', (e) => {
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
      this.mascot.resetInactivity();
      this.checkHitTest();

      // Volume HUD dynamic dragging
      if (this.isScrubbingVolumeHud) {
        const cx = window.innerWidth / 2;
        const trackLeft = cx - this.currentWidth / 2 + 52;
        const trackRight = cx + this.currentWidth / 2 - 52;
        const trackW = Math.max(20, trackRight - trackLeft);
        const clampedX = Math.max(trackLeft, Math.min(trackRight, e.clientX));
        const pct = Math.round(((clampedX - trackLeft) / trackW) * 100);
        this.volumeHudLevel = pct;
        this.volumeHudMuted = false;
        this.volumeHudUntil = performance.now() + 2200;
        if (window.roboIsland?.setVolume) {
          window.roboIsland.setVolume(pct);
        }
        return;
      }

      // Desktop Buddy Drag-Out detection (dragging down on mascot eyes in compact/rest mode)
      if (dragStart && dragStart.onEyes && !this.isBuddyOut) {
        const dy = e.clientY - dragStart.y;
        if (dy > 16) {
          dragStart = null;
          swallowClick = true;
          this.isBuddyOut = true;
          const api = (window as any).roboIsland;
          api?.buddyGrab?.();
          try {
            AudioSynth.getInstance().playMelody('pop');
          } catch {}
        }
      }
    });

    // Pointer up: evaluate swipe gestures
    window.addEventListener('mouseup', (e) => {
      this.isDraggingOver = false;
      (window as any).isDraggingFiles = false;
      const dropOverlay = document.getElementById('drag-drop-overlay');
      if (dropOverlay) dropOverlay.classList.add('hidden');
      if (this.isScrubbingVolumeHud) {
        this.isScrubbingVolumeHud = false;
        swallowClick = true;
      }
      if (!dragStart) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      const isMusicActive = Boolean(this.mediaState.playing || (this.mediaState.title && this.mode === 'compact'));

      // TwoCode Swipe gesture for skipping tracks (drag left = next, drag right = prev)
      if (Math.abs(dx) > 48 && Math.abs(dy) < 36 && isMusicActive) {
        swallowClick = true;
        const api = (window as any).roboIsland;
        if (dx < 0) {
          api?.mediaNext?.();
        } else {
          api?.mediaPrev?.();
        }
        try {
          AudioSynth.getInstance().playMelody('pop');
        } catch {}
      }
      dragStart = null;
    });

    // Trackpad horizontal wheel swipe for skipping music tracks
    window.addEventListener('wheel', (e) => {
      const isMusicActive = Boolean(this.mediaState.playing || (this.mediaState.title && this.mode === 'compact'));
      const cx = window.innerWidth / 2;
      const inIsland = Math.abs(e.clientX - cx) <= this.currentWidth / 2 && e.clientY <= this.currentHeight + 10;
      if (inIsland && isMusicActive && Math.abs(e.deltaX) > 60 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const api = (window as any).roboIsland;
        if (e.deltaX > 0) {
          api?.mediaNext?.();
        } else {
          api?.mediaPrev?.();
        }
        try {
          AudioSynth.getInstance().playMelody('pop');
        } catch {}
      }
    }, { passive: true });

    // Desktop Buddy return listener
    const islandApi = (window as any).roboIsland;
    if (islandApi?.onBuddyHome) {
      islandApi.onBuddyHome(() => {
        this.isBuddyOut = false;
        try {
          AudioSynth.getInstance().playMelody('done');
        } catch {}
      });
    }

    if (islandApi?.onFocusDistraction) {
      islandApi.onFocusDistraction((data: any) => {
        this.triggerMindfulDistractionPause(data);
      });
    }

    window.addEventListener('mouseenter', () => {
      this.mascot.resetInactivity();
    });

    window.addEventListener('mouseleave', () => {
      this.pointerX = -1;
      this.pointerY = -1;
      this.isHovered = false;
      dragStart = null;
      this.isScrubbingVolumeHud = false;
      this.isDraggingOver = false;
      (window as any).isDraggingFiles = false;
      const dropOverlay = document.getElementById('drag-drop-overlay');
      if (dropOverlay) dropOverlay.classList.add('hidden');
      this.checkHitTest();
    });

    window.addEventListener('blur', () => {
      this.pointerX = -1;
      this.pointerY = -1;
      this.isHovered = false;
      dragStart = null;
      this.isScrubbingVolumeHud = false;
      this.isDraggingOver = false;
      (window as any).isDraggingFiles = false;
      const dropOverlay = document.getElementById('drag-drop-overlay');
      if (dropOverlay) dropOverlay.classList.add('hidden');
      const summaryModal = document.getElementById('screen-summary-modal');
      const isModalOpen = summaryModal && !summaryModal.classList.contains('hidden') && summaryModal.style.display !== 'none';
      if (this.mode === 'expanded' && !isModalOpen) {
        this.collapse();
      }
    });

    // Clicks
    window.addEventListener('click', (e) => {
      SystemAudioVisualizer.getInstance().resumeAudioContext();
      if (swallowClick) {
        swallowClick = false;
        e.stopPropagation();
        return;
      }
      this.mascot.resetInactivity();
      const ctxMenu = document.getElementById('island-context-menu');
      if (ctxMenu && !ctxMenu.classList.contains('hidden')) {
        ctxMenu.classList.add('hidden');
      }
      if (this.activePopover !== 'none') {
        const popover = document.getElementById('system-popover');
        const btnWifi = document.getElementById('btn-status-wifi');
        const btnBt = document.getElementById('btn-status-bt');
        const btnGroup = document.getElementById('btn-system-popover');
        const targetNode = (e.target && e.target instanceof Node) ? (e.target as Node) : null;
        const clickedInside = targetNode ? (
          Boolean(popover?.contains(targetNode)) ||
          Boolean(btnWifi?.contains(targetNode)) ||
          Boolean(btnBt?.contains(targetNode)) ||
          Boolean(btnGroup?.contains(targetNode))
        ) : false;
        if (!clickedInside) {
          this.setPopover('none');
        }
      }
      this.handleClick(e.clientX, e.clientY, e.altKey);
    });

    // Double-Click on the Island: Poke Robo mascot (circle eyes, bouncy jump, cute sound)
    window.addEventListener('dblclick', (e) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea, button, select, [contenteditable="true"]')) return;

      const cx = window.innerWidth / 2;
      const topY = this.getTopY();
      const effectiveW = this.mode === 'expanded' ? Math.max(this.targetWidth, this.currentWidth) : this.currentWidth;
      const effectiveH = this.mode === 'expanded' ? Math.max(this.targetHeight, this.currentHeight) : this.currentHeight;
      const halfW = effectiveW / 2;
      const insideIsland =
        e.clientX >= cx - halfW &&
        e.clientX <= cx + halfW &&
        e.clientY >= topY &&
        e.clientY <= topY + effectiveH;

      if (insideIsland) {
        e.preventDefault();
        e.stopPropagation();
        this.pokeMascot(e.clientX, e.clientY);
      }
    });

    // Right-Click on the Island: TwoCode instant tuck away (Shift+Right-Click for context menu)
    window.addEventListener('contextmenu', (e) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea, [contenteditable="true"]')) return;

      const cx = window.innerWidth / 2;
      const topY = this.getTopY();
      const effectiveW = this.mode === 'expanded' ? Math.max(this.targetWidth, this.currentWidth) : this.currentWidth;
      const effectiveH = this.mode === 'expanded' ? Math.max(this.targetHeight, this.currentHeight) : this.currentHeight;
      const halfW = effectiveW / 2;
      const insideIsland =
        e.clientX >= cx - halfW &&
        e.clientX <= cx + halfW &&
        e.clientY >= topY &&
        e.clientY <= topY + effectiveH;

      if (insideIsland) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.shiftKey) {
          this.showContextMenu(e.clientX, e.clientY);
        } else {
          // TwoCode tuck-ui.js parity: right-click instantly tucks away into 56x4px line
          this.setTucked(true);
          try {
            AudioSynth.getInstance().playMelody('pop');
          } catch {}
          if (window.roboIsland?.setTucked) {
            window.roboIsland.setTucked(true);
          } else if (window.roboIsland?.toggleTuck) {
            window.roboIsland.toggleTuck();
          }
        }
      } else {
        // Explicitly clear interactivity if a right-click landed outside the island
        if (window.roboIsland) {
          window.roboIsland.setInteractive(false);
        }
      }
    }, true);

    // Escape & Spacebar handling (Quick Look, Popover, Menu, Collapse, WhatsApp Quick Reply)
    window.addEventListener('keydown', (e) => {
      // WhatsApp Quick Reply input handling (Apple Dynamic Island Parity)
      const waInput = document.getElementById('whatsapp-reply-input') as HTMLInputElement | null;
      if (document.activeElement === waInput) {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.closeWhatsAppReply();
          this.clearNotification();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          this.submitWhatsAppReply(waInput?.value);
        }
        return;
      }

      if (this.isWhatsAppReplying && this.activeNotification) {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.closeWhatsAppReply();
          this.clearNotification();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          this.submitWhatsAppReply();
          return;
        }
        if (e.key === 'Backspace') {
          e.preventDefault();
          if (this.whatsAppReplyText.length > 0) {
            this.whatsAppReplyText = this.whatsAppReplyText.slice(0, -1);
          }
          return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
          e.preventDefault();
          navigator.clipboard?.readText?.().then(clip => {
            if (clip) {
              this.whatsAppReplyText = (this.whatsAppReplyText + clip).slice(0, 200);
            }
          }).catch(() => {});
          return;
        }
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          if (this.whatsAppReplyText.length < 200) {
            this.whatsAppReplyText += e.key;
          }
          return;
        }
      }

      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === ' ' || e.code === 'Space') {
        if (this.isQuickLookOpen) {
          e.preventDefault();
          this.closeQuickLook();
          return;
        }
        if ((this.activeTab === 'tray' || this.currentDomTab === 'tray') && this.latestTrayFiles.length > 0) {
          e.preventDefault();
          const target = this.latestTrayFiles.find((f: any) => f.isActive) || this.latestTrayFiles[0];
          if (target && target.path) {
            this.openQuickLook(target.path);
          }
          return;
        }
      }

      if (e.key === 'Escape') {
        if (this.isQuickLookOpen) {
          this.closeQuickLook();
          return;
        }
        if (this.activePopover !== 'none') {
          this.setPopover('none');
          return;
        }
        const ctxMenu = document.getElementById('island-context-menu');
        if (ctxMenu && !ctxMenu.classList.contains('hidden')) {
          ctxMenu.classList.add('hidden');
          return;
        }
        if (this.mode === 'expanded') {
          this.collapse();
        }
      }
    });

    if (window.roboIsland) {
      if (window.roboIsland.onPointer) {
        window.roboIsland.onPointer((pt: any) => {
          if (!pt || pt.offscreen || pt.x == null || pt.y == null || pt.x <= -8000 || pt.y <= -8000) {
            this.isHovered = false;
            this.pointerX = -9999;
            this.pointerY = -9999;
            this.requestRender();
            return;
          }
          this.pointerX = pt.x;
          this.pointerY = pt.y;
          this.isHovered = Boolean(pt.insideWindow);
          this.mascot.resetInactivity();
          this.checkHitTest();
          this.requestRender();
        });
      }
      window.roboIsland.onToggleExpand(() => this.toggleExpand());
      if (window.roboIsland.onCollapseRequested) {
        window.roboIsland.onCollapseRequested(() => {
          this.isDraggingOver = false;
          (window as any).isDraggingFiles = false;
          const summaryModal = document.getElementById('screen-summary-modal');
          const isModalOpen = summaryModal && !summaryModal.classList.contains('hidden') && summaryModal.style.display !== 'none';
          if (this.mode === 'expanded' && !isModalOpen) {
            this.collapse();
          }
        });
      }
      if (window.roboIsland.onCollapse) {
        window.roboIsland.onCollapse(() => {
          if (this.mode === 'expanded') {
            this.collapse();
          }
        });
      }
      window.roboIsland.onConfigUpdated((cfg: any) => {
        this.config = cfg;
        if (cfg.mascotSkin) this.mascot.setSkin(cfg.mascotSkin);
        if (cfg.mascotHat) this.mascot.setHat(cfg.mascotHat);
        if (cfg.mascotOutfit) this.mascot.setOutfit(cfg.mascotOutfit);
        if (cfg.mascotBodyColor) this.mascot.setBodyColor(cfg.mascotBodyColor);
        if (cfg.mascotEyeColor) this.mascot.setEyeColor(cfg.mascotEyeColor);
        if (cfg.mascotMood) this.setMascotMood(cfg.mascotMood);
        if (cfg.textureSkin) TextureEngine.getInstance().style = cfg.textureSkin as any;
        else if (cfg.visualTexture) TextureEngine.getInstance().style = cfg.visualTexture as any;
        if (cfg.soundPack) AudioSynth.getInstance().soundPack = cfg.soundPack as any;
        if (typeof cfg.soundEnabled === 'boolean') AudioSynth.getInstance().enabled = cfg.soundEnabled;
        if (cfg.language && (window as any).roboIslandI18n) (window as any).roboIslandI18n.setLocale(cfg.language);
      });
      window.roboIsland.onMediaStateChanged((state: any) => this.handleMediaStateUpdate(state));
      window.roboIsland.onVolumeChanged((vol: any) => {
        const isWarmup = (performance.now() - this.engineStartTime) < 4000;
        if (!this.isVolumeInitialized || isWarmup) {
          this.isVolumeInitialized = true;
          this.volumeState = vol;
          if (vol && typeof vol.level === 'number' && vol.level >= 0) {
            this.volumeHudLevel = vol.level;
            this.volumeHudMuted = Boolean(vol.muted);
          }
          return;
        }

        const prevLevel = this.volumeHudLevel;
        const prevMuted = this.volumeHudMuted;
        this.volumeState = vol;
        if (vol && typeof vol.level === 'number') {
          const changed = prevLevel !== vol.level || prevMuted !== Boolean(vol.muted);
          if (changed) {
            this.triggerVolumeHud(vol.level, Boolean(vol.muted));
          }
        }
      });
      window.roboIsland.onNetworkChanged((net: any) => {
        if (net) {
          if (net.wifi) {
            this.netState.wifiOn = net.wifi.on !== false;
            this.netState.ssid = net.wifi.ssid || (this.netState.wifiOn ? 'Connected' : 'Off');
            this.netState.bars = net.wifi.bars || 4;
          }
          if (net.bt) {
            this.netState.btOn = net.bt.on === true;
            this.netState.btDevice = (net.bt.devices && net.bt.devices[0]) ? net.bt.devices[0] : (this.netState.btOn ? 'Active' : 'Off');
          }
          this.updateNetworkDom();
        }
      });
      window.roboIsland.onAiStateChanged((state: any) => {
        const prevStatus = this.aiState.status;
        this.aiState = state;

        if (state.status === 'question' && state.pendingPermission) {
          this.triggerNotification({
            id: 'ai-perm-' + Date.now(),
            title: state.pendingPermission.tool || 'Permission Required',
            body: state.pendingPermission.description || 'Claude needs your authorization.',
            kind: 'question',
            sessionId: state.pendingPermission.sessionId,
            actions: [
              { id: 'deny', label: 'Deny', primary: false },
              { id: 'allow', label: 'Allow', primary: true }
            ]
          });
        } else if (state.status === 'done' && prevStatus !== 'done') {
          this.triggerNotification({
            id: 'ai-done-' + Date.now(),
            title: 'Task Completed',
            body: state.currentTool || 'Claude Code finished task',
            kind: 'done',
            durationMs: 3500
          });
          this.mascot.setMood('happy', 3500);
        } else if (state.status === 'error' && prevStatus !== 'error') {
          this.triggerNotification({
            id: 'ai-error-' + Date.now(),
            title: 'Task Error',
            body: state.currentTool || 'Error occurred during execution',
            kind: 'error',
            durationMs: 4000
          });
          this.mascot.setMood('dizzy', 4000);
        } else if (state.status === 'running') {
          this.mascot.setMood('focused');
        } else if (state.status === 'ready' || state.status === 'idle' || !state.status) {
          if (this.mascot.getMood() === 'focused') {
            this.mascot.setMood('neutral');
          }
        }
        this.updateTargetDimensions();
      });
      if (window.roboIsland.onNotification) {
        window.roboIsland.onNotification((payload: any) => {
          if (payload && payload.title) {
            this.triggerNotification(payload);
          }
        });
      }

      // WhatsApp AI Smart Replies & Voice Note Reader IPC Listeners (R4)
      const waApi = (window.island || window.roboIsland)?.whatsapp || (window.island || window.roboIsland);
      if (waApi?.onIncomingMessage) {
        waApi.onIncomingMessage((payload: any) => {
          if (payload) {
            this.triggerNotification({
              id: payload.id || `wa-${Date.now()}`,
              title: payload.sender || 'WhatsApp',
              body: payload.body || '',
              kind: 'whatsapp',
              status: payload.isVoiceNote ? 'voicenote' : 'message',
              durationMs: 7000,
              isVoiceNote: Boolean(payload.isVoiceNote),
              durationSeconds: payload.durationSeconds || 0,
              smartReplies: payload.smartReplies || []
            });
          }
        });
      }
      if (waApi?.onVoiceNoteTranscribed) {
        waApi.onVoiceNoteTranscribed((data: any) => {
          if (data && data.transcript) {
            const transcriptEl = document.getElementById('wa-vn-transcript');
            if (transcriptEl) {
              transcriptEl.textContent = data.transcript;
            }
            if (this.activeNotification) {
              (this.activeNotification as any).transcript = data.transcript;
            }
          }
        });
      }

      const sportsUpdateHandler = (data: any) => {
        if (!data) return;
        this.activeSportsActivity = data;
        if (!this.sportsState) {
          this.sportsState = {
            enabled: true,
            activeSport: data.sport || 'cricket',
            mode: data.isSimulated ? 'simulated' : 'live',
            activities: { [data.sport]: data }
          };
        } else {
          this.sportsState.activities[data.sport] = data;
          this.sportsState.activeSport = data.sport;
        }
        if (data.highlightText) {
          this.sportsFlashText = data.highlightText;
          this.sportsFlashColor = data.highlightColor || '#22e05a';
          this.sportsFlashUntil = performance.now() + 3500;
          this.kickJelly(0.2, 5.0, 4.0);
          try { AudioSynth.getInstance().play('pop'); } catch {}
        }
        this.renderSportsScorecardDOM();
        this.updateTargetDimensions();
        this.requestRender();
      };

      if (window.roboIsland?.sports?.onSportsUpdate) {
        window.roboIsland.sports.onSportsUpdate(sportsUpdateHandler);
      } else if (window.roboIsland?.onSportsUpdate) {
        window.roboIsland.onSportsUpdate(sportsUpdateHandler);
      }
      if ((window.roboIsland as any).onDownloadsUpdate) {
        (window.roboIsland as any).onDownloadsUpdate((data: any) => {
          this.activeDownloadsList = data && Array.isArray(data.downloads) ? data.downloads : [];
          this.updateTargetDimensions();
        });
      }
      if ((window.roboIsland as any).getActiveDownloads) {
        (window.roboIsland as any).getActiveDownloads().then((list: any[]) => {
          if (Array.isArray(list) && list.length > 0) {
            this.activeDownloadsList = list;
            this.updateTargetDimensions();
          }
        }).catch(() => {});
      }
      if (window.roboIsland.onMascotMood) {
        window.roboIsland.onMascotMood((mood: MascotMood) => this.setMascotMood(mood));
      }
      if (window.roboIsland.onMascotSpeak) {
        window.roboIsland.onMascotSpeak((text: string, duration?: number) => this.mascotSpeak(text, duration));
      }
      if (window.roboIsland.onMascotJump) {
        window.roboIsland.onMascotJump(() => this.mascotJump());
      }
      if (window.roboIsland.onModeChanged) {
        window.roboIsland.onModeChanged((mode: IslandMode) => {
          this.setMode(mode);
        });
      }
      if (window.roboIsland.onTuckedState) {
        window.roboIsland.onTuckedState((tucked: boolean) => {
          this.setTucked(tucked);
        });
      }
      if (window.roboIsland?.launcher?.onToggleLauncher) {
        window.roboIsland.launcher.onToggleLauncher((forceState?: boolean) => {
          this.toggleLauncher(forceState);
        });
      } else if (window.roboIsland?.onToggleLauncher) {
        window.roboIsland.onToggleLauncher((forceState?: boolean) => {
          this.toggleLauncher(forceState);
        });
      }
      this.setupSpotlightLauncherDOM();
      this.setupScreenGlanceDOM();
      if (window.roboIsland?.screenGlance?.onGlanceError) {
        window.roboIsland.screenGlance.onGlanceError((errors: any[]) => {
          if (Array.isArray(errors) && errors.length > 0) {
            this.showGlanceErrorPill(errors[0]);
          } else {
            this.hideGlanceErrorPill();
          }
        });
      } else if (window.roboIsland?.onGlanceError) {
        window.roboIsland.onGlanceError((errors: any[]) => {
          if (Array.isArray(errors) && errors.length > 0) {
            this.showGlanceErrorPill(errors[0]);
          } else {
            this.hideGlanceErrorPill();
          }
        });
      }
      if (window.roboIsland?.screenGlance?.onGlanceSummary) {
        window.roboIsland.screenGlance.onGlanceSummary((summary: any) => {
          if (summary) this.openGlanceSummaryModal(summary);
        });
      } else if (window.roboIsland?.onGlanceSummary) {
        window.roboIsland.onGlanceSummary((summary: any) => {
          if (summary) this.openGlanceSummaryModal(summary);
        });
      }
      if (window.roboIsland.onWeatherUpdated) {
        window.roboIsland.onWeatherUpdated((data: any) => {
          if (data && typeof data.temperature === 'number') {
            this.weatherState.temp = `${Math.round(data.temperature)}°C`;
            this.weatherState.condition = data.condition || 'Clear';
          }
        });
      }
      if (window.roboIsland.onGameModeChanged) {
        window.roboIsland.onGameModeChanged((state: any) => {
          this.isGameModeThrottled = Boolean(state && state.inGame && !state.override);
        });
      }
      if (window.roboIsland.onBatteryStateChanged) {
        window.roboIsland.onBatteryStateChanged((data: any) => {
          if (data && typeof data.charging === 'boolean') {
            const wasCharging = this.batteryState.charging;
            this.batteryState.charging = data.charging;
            if (typeof data.level === 'number') this.batteryState.level = data.level;
            if (wasCharging !== data.charging) {
              this.triggerChargerSurge(data.charging, this.batteryState.level);
            }
          }
        });
      }
      if (window.roboIsland.onShowSpeedometerHud) {
        window.roboIsland.onShowSpeedometerHud(() => this.triggerSpeedometerHud());
      }
      if (window.roboIsland.onMetricsChanged) {
        window.roboIsland.onMetricsChanged((m: any) => {
          if (m) {
            this.metricsState = m;
            if (typeof m.cpu === 'number') this.config.lastCpuPercent = m.cpu;
            if (typeof m.ram === 'number') this.config.lastRamPercent = m.ram;
          }
        });
      }
      if (window.roboIsland.onClipboardUpdated) {
        window.roboIsland.onClipboardUpdated(() => {
          if (this.currentDomTab === 'clipboard') {
            this.loadClipboardList();
          }
        });
      }
      if ((window.roboIsland as any).onTriggerGreeting) {
        (window.roboIsland as any).onTriggerGreeting((type?: string) => {
          this.triggerGreeting(type as any);
        });
      }
      if ((window.roboIsland as any).getUserName) {
        (window.roboIsland as any).getUserName().then((name: string) => {
          if (name) this.userName = name.split(' ')[0];
        }).catch(() => {});
      }

      // Bluetooth Battery & Device HUD IPC Listeners (R5)
      const btApi = (window.islandAPI || window.island || window.roboIsland)?.bluetooth || (window.islandAPI || window.island || window.roboIsland);
      if (btApi?.onHudEvent) {
        btApi.onHudEvent((event: any) => {
          this.triggerBluetoothHud(event);
        });
      } else if ((window.islandAPI || window.island || window.roboIsland)?.onBluetoothHudEvent) {
        (window.islandAPI || window.island || window.roboIsland).onBluetoothHudEvent((event: any) => {
          this.triggerBluetoothHud(event);
        });
      }

      // Voice Companion Mode IPC Listeners (R6)
      const voiceApi = (window.islandAPI || window.island || window.roboIsland)?.voice || (window.islandAPI || window.island || window.roboIsland);
      if (voiceApi?.onVoiceState) {
        voiceApi.onVoiceState((payload: any) => {
          this.setVoiceState(payload);
        });
      }
    }

    if (typeof window !== 'undefined') {
      (window as any).__roboIslandSetMode = (mode: IslandMode) => this.setMode(mode);
      (window as any).__roboIslandGetMode = () => this.getMode();
      (window as any).__roboIslandSetMascotMood = (mood: MascotMood) => this.setMascotMood(mood);
      (window as any).__roboIslandGetMascotMood = () => this.getMascotMood();
      (window as any).__roboIslandMascotJump = (strength?: number) => this.mascotJump(strength);
      (window as any).__roboIslandMascotBounce = (strength?: number) => this.mascotBounce(strength);
      (window as any).__roboIslandMascotSpeak = (text: string, duration?: number) => this.mascotSpeak(text, duration);
      (window as any).__roboIslandPokeMascot = (x?: number, y?: number) => this.pokeMascot(x, y);
      (window as any).__roboIslandTriggerChargerSurge = (charging?: boolean, level?: number) => this.triggerChargerSurge(charging, level);
      (window as any).__roboIslandTriggerVolumeHud = (level: number, muted?: boolean) => this.triggerVolumeHud(level, Boolean(muted));
      (window as any).__roboIslandTriggerSpeedometerHud = () => this.triggerSpeedometerHud();
      (window as any).__roboIslandTriggerBluetoothHud = (event: any) => this.triggerBluetoothHud(event);
      (window as any).__roboIslandTriggerVoiceCompanion = () => this.triggerVoiceCompanion();
      (window as any).__roboIslandSetVoiceState = (state: any) => this.setVoiceState(state);
      (window as any).__roboIslandInterruptVoice = () => this.interruptVoiceCompanion();
      (window as any).__roboIslandTriggerNotification = (n: IslandNotification) => this.triggerNotification(n);
      (window as any).__roboIslandClearNotification = () => this.clearNotification();
      (window as any).__roboIslandTriggerGreeting = (type?: string) => this.triggerGreeting(type as any);
      (window as any).__roboIslandDismissGreeting = () => this.dismissGreeting();
      (window as any).__roboIslandTriggerAppActivity = (act: any) => this.handleAppActivity(act);
    }

    // Fallback: If startup hello entrance was not running, trigger greeting cleanly at 3400ms
    setTimeout(() => {
      if (!this.isStartupHelloBusy && this.greetingStartTime === 0) {
        this.triggerGreeting();
      }
    }, 3400);

    // Focus timer interval (synced with canonical FocusEngine)
    let wasFocusActive = false;
    setInterval(() => {
      const f = (window as any).__roboFocus || (window as any).__twocodeFocus;
      if (f) {
        const isActive = Boolean(f.active());
        if (isActive) {
          this.focusState.active = true;
          this.focusState.remainingSeconds = Math.ceil(f.left() / 1000);
          this.focusState.totalSeconds = Math.ceil(f.length() / 1000);
          if (!wasFocusActive) {
            this.updateTargetDimensions();
          }
          this.requestRender();
        } else {
          if (wasFocusActive && f.left() <= 0) {
            AudioSynth.getInstance().play('done');
            this.mascot.sounds.playSuccess();
            this.mascot.jump();
            this.triggerNotification({
              id: 'focus-complete-' + Date.now(),
              title: 'Focus Session Complete!',
              body: 'Take a mindful 5-minute break.',
              kind: 'done',
              durationMs: 4500
            });
          }
          if (wasFocusActive) {
            this.updateTargetDimensions();
            this.requestRender();
          }
          this.focusState.active = false;
          this.focusState.remainingSeconds = f.chosen();
          this.focusState.totalSeconds = f.chosen();
        }
        wasFocusActive = isActive;
      } else {
        if (this.focusState.active && this.focusState.remainingSeconds > 0) {
          this.focusState.remainingSeconds--;
          this.requestRender();
          if (this.focusState.remainingSeconds === 0) {
            this.focusState.active = false;
            this.updateTargetDimensions();
            this.requestRender();
            this.triggerNotification({
              id: 'focus-complete-' + Date.now(),
              title: 'Focus Session Complete!',
              body: 'Take a mindful 5-minute break.',
              kind: 'done',
              durationMs: 4500
            });
          }
        }
      }

      // Dynamic Time-of-Day Hourly Greeting Rollover
      const currentHour = new Date().getHours();
      if (this.lastGreetingHour !== -1 && this.lastGreetingHour !== currentHour) {
        this.triggerGreeting();
      }
    }, 1000);
  }

  public extractAlbumColor(url: string): void {
    if (!url || url === this.lastCoverUrl) {
      if (!url) {
        this.albumImageElement = null;
        this._cachedCoverCanvas = null;
        this.albumAccentColor = '#ffffff';
        this.targetTintR = 110;
        this.targetTintG = 115;
        this.targetTintB = 130;
      }
      return;
    }
    this.lastCoverUrl = url;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 12;
        c.height = 12;
        const x = c.getContext('2d');
        if (!x) return;
        x.drawImage(img, 0, 0, 12, 12);
        const d = x.getImageData(0, 0, 12, 12).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          const sat = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
          const w = 1 + sat / 16;
          r += d[i] * w;
          g += d[i + 1] * w;
          b += d[i + 2] * w;
          n += w;
        }
        if (n > 0) {
          r /= n;
          g /= n;
          b /= n;
          const boost = 200 / Math.max(60, Math.max(r, g, b));
          const rBoost = Math.min(255, Math.round(r * boost));
          const gBoost = Math.min(255, Math.round(g * boost));
          const bBoost = Math.min(255, Math.round(b * boost));
          this.albumAccentColor = `rgb(${rBoost}, ${gBoost}, ${bBoost})`;
          this.targetTintR = rBoost;
          this.targetTintG = gBoost;
          this.targetTintB = bBoost;
        }
        this.albumImageElement = img;

        // Pre-render 22x22 rounded cover art to eliminate per-frame clipping & bicubic downsampling
        try {
          const off = document.createElement('canvas');
          off.width = 22;
          off.height = 22;
          const ox = off.getContext('2d');
          if (ox) {
            ox.beginPath();
            ox.roundRect(0, 0, 22, 22, 7);
            ox.clip();
            ox.drawImage(img, 0, 0, 22, 22);
            this._cachedCoverCanvas = off;
          }
        } catch {
          this._cachedCoverCanvas = null;
        }
      } catch {
        this.albumAccentColor = '#ffffff';
        this.targetTintR = 110;
        this.targetTintG = 115;
        this.targetTintB = 130;
      }
    };
    img.onerror = () => {
      this.albumImageElement = null;
      this._cachedCoverCanvas = null;
      this.albumAccentColor = '#ffffff';
      this.targetTintR = 110;
      this.targetTintG = 115;
      this.targetTintB = 130;
    };
    img.src = url;
  }

  private handleMediaStateUpdate(state: any): void {
    const isSongChanged = state.title !== this.mediaState.title;
    this.mediaState = {
      ...this.mediaState,
      ...state
    };
    this.basePositionMs = state.positionMs || 0;
    this.lastMediaSampleTime = performance.now();

    const cover = state.coverUrl || state.albumArtUrl || '';
    if (state.active && state.title && cover) {
      this.extractAlbumColor(cover);
    } else {
      this.extractAlbumColor('');
    }

    this.mascot.isDancing = Boolean(state.playing && state.active);
    if (state.playing && state.active) {
      this.mascot.setMood('excited');
    } else if (this.mascot.mood === 'excited') {
      this.mascot.setMood('neutral');
    }

    const songKey = state.active && state.title ? `${state.title}|${state.artist}` : '';
    if (songKey !== this.lyricsSongKey) {
      const had = this.syncedLyrics.length > 0;
      if (had) {
        this.lyricsPrevious = this.getCurrentLyricText();
        this.lyricsChangedAt = performance.now();
        this.lyricsHoldUntil = performance.now() + this.LYRICS_HOLD;
      }
      this.lyricsSongKey = songKey;
      this.syncedLyrics = [];
      this.lyricsIndex = -1;
      this.lyricsGap = false;
      this.lyricsLoading = Boolean(songKey);
      if (!had) this.lyricsWidest = 0;
      this.mediaState.lyricLine = '';

      if (songKey) {
        window.roboIsland?.getLyrics({
          title: state.title,
          artist: state.artist,
          duration: state.durationMs
        }).then((res: any) => {
          if (this.lyricsSongKey !== songKey) return;
          this.lyricsLoading = false;
          if (res && res.lines && res.lines.length > 0) {
            this.syncedLyrics = res.lines;
            this.ctx.save();
            this.ctx.font = this.LYRICS_FONT;
            this.lyricsWidest = res.lines.reduce((max: number, l: any) => {
              return Math.max(max, l.text ? this.ctx.measureText(l.text).width : 0);
            }, 0);
            this.ctx.restore();
            this.updateTargetDimensions();
          }
        }).catch(() => {
          if (this.lyricsSongKey === songKey) this.lyricsLoading = false;
        });
      }
    }

    this.updateTargetDimensions();
  }

  public updateTargetDimensions(): void {
    if (this.isLauncherActive) {
      this.targetWidth = 620;
      this.targetHeight = this.launcherExpanded ? 380 : 54;
      this.targetRadius = 24;
      this.requestRender();
      return;
    }

    if (this.isTucked) {
      // Tuck-away: 56×4 px line docked to top edge (peeks on hover)
      this.targetWidth = this.isHovered ? 72 : 56;
      this.targetHeight = 4;
      this.targetRadius = 2;
      this.requestRender();
      return;
    }

    if (this.mode === 'expanded') {
      this.targetWidth = 520;
      const tab = (this.currentDomTab || 'home') as string;
      const isMusicWithLyrics = (tab === 'music' || this.activeTab === 'media') && this.hasSyncedLyrics();

      switch (tab) {
        case 'music':
          this.targetHeight = this.hasSyncedLyrics() ? 330 : 280;
          break;
        case 'chat':
          this.targetWidth = 560;
          this.targetHeight = 400;
          break;
        case 'ai':
          this.targetHeight = 310;
          break;
        case 'tray':
          this.targetHeight = 270;
          break;
        case 'notes':
          this.targetHeight = 290;
          break;
        case 'clipboard':
          this.targetWidth = 560;
          this.targetHeight = 370;
          break;
        case 'settings':
          this.targetHeight = 300;
          break;
        case 'focus':
          this.targetHeight = 270;
          break;
        case 'agenda':
          this.targetWidth = 540;
          this.targetHeight = 280;
          break;
        case 'sports':
          this.targetWidth = 540;
          this.targetHeight = 300;
          break;
        case 'home':
        default:
          this.targetHeight = 240;
          break;
      }
      this.targetRadius = 32;
      return;
    }

    if (this.isNotificationActive()) {
      const n = this.activeNotification!;
      if (this.isWhatsAppReplying) {
        this.targetWidth = 400;
        const isVn = this.isWhatsAppVoiceNoteActive();
        const chipsContainer = typeof document !== 'undefined' ? document.getElementById('whatsapp-smart-reply-chips') : null;
        const hasChips = Boolean(chipsContainer && chipsContainer.children && chipsContainer.children.length > 0);
        if (isVn) {
          this.targetHeight = 220;
        } else if (hasChips) {
          this.targetHeight = 144;
        } else {
          this.targetHeight = 108;
        }
        this.targetRadius = 24;
        return;
      }
      const hasBody = Boolean(n.body && n.body.trim().length > 0);
      if (n.kind === 'download') {
        // Rock-solid fixed stable width for downloads (prevents jitter / moving motion on progress bytes update)
        this.targetWidth = 330;
        this.targetHeight = hasBody ? 42 : 36;
        this.targetRadius = hasBody ? 21 : 18;
        return;
      }
      const hasActions = Boolean(n.actions && n.actions.length > 0);
      const isWhatsApp = n.kind === 'whatsapp';
      if (hasActions) {
        let actionsW = 0;
        for (const a of n.actions || []) {
          const estLabelW = (a.label || '').length * 7.5;
          actionsW += Math.max(56, Math.round(estLabelW + 24)) + 8;
        }
        const titleEstimateW = Math.min(260, Math.round(n.title.length * 7.8 + 36));
        const neededW = titleEstimateW + actionsW + 36;
        this.targetWidth = Math.max(380, Math.min(580, neededW));
        this.targetHeight = hasBody ? 46 : 38;
        this.targetRadius = hasBody ? 23 : 19;
        return;
      }
      const textLen = Math.max(n.title.length, (n.body || '').length * 0.65);
      const baseMinW = isWhatsApp ? 320 : 280;
      this.targetWidth = Math.max(baseMinW, Math.min(420, 100 + textLen * 7.5 + (isWhatsApp ? 50 : 0)));
      this.targetHeight = hasBody ? 42 : 36;
      this.targetRadius = hasBody ? 21 : 18;
      return;
    }

    if (this.mode === 'rest') {
      if (this.focusState.active) {
        const isDualActive = Boolean(this.mediaState.playing || (this.mediaState.active && this.mediaState.title));
        if (isDualActive) {
          const dynamicMusicW = Math.max(300, Math.min(440, Math.round((this.mediaState.title || '').length * 7.8 + 104)));
          this.targetWidth = this.isHovered ? dynamicMusicW + 8 : dynamicMusicW;
          this.targetHeight = 36;
          this.targetRadius = 18;
        } else {
          this.targetWidth = this.isHovered ? 258 : 250;
          this.targetHeight = 36;
          this.targetRadius = 18;
        }
        return;
      }
      if (performance.now() < this.airdropHudUntil) {
        this.targetWidth = this.isHovered ? 350 : 340;
        this.targetHeight = 44;
        this.targetRadius = 22;
        return;
      }
      if (performance.now() < this.speedometerHudUntil) {
        this.targetWidth = this.isHovered ? 370 : 360;
        this.targetHeight = 44;
        this.targetRadius = 22;
        return;
      }
      if (this.isVoiceCompanionActive()) {
        const w = this.voiceState === 'SPEAKING' ? 340 : (this.voiceState === 'THINKING' ? 300 : 320);
        this.targetWidth = this.isHovered ? w + 10 : w;
        this.targetHeight = 44;
        this.targetRadius = 22;
        return;
      }
      if (performance.now() < this.bluetoothHudUntil) {
        const hasMb = Boolean(this.activeBluetoothDevice?.multiBattery);
        this.targetWidth = this.isHovered ? (hasMb ? 368 : 338) : (hasMb ? 360 : 330);
        this.targetHeight = 44;
        this.targetRadius = 22;
        return;
      }
      if (performance.now() < this.volumeHudUntil) {
        this.targetWidth = this.isHovered ? 280 : 270;
        this.targetHeight = 36;
        this.targetRadius = 18;
        return;
      }
      if (performance.now() < this.chargerSurgeUntil) {
        // iOS / Mac Fluid Premium Charging Dynamic Island Capsule (310x44, radius 22)
        this.targetWidth = this.isHovered ? 320 : 310;
        this.targetHeight = 44;
        this.targetRadius = 22;
        return;
      }
      if (performance.now() < this.greetingUntil) {
        this.targetWidth = this.isHovered ? 312 : 304;
        this.targetHeight = 36;
        this.targetRadius = 18;
        return;
      }
      // Rest Mode: Minimal 32×18 px capsule (radius = 9px)
      const cfgW = (this.config && this.config.restCapsuleWidth) || 32;
      const cfgH = (this.config && this.config.restCapsuleHeight) || 18;
      this.targetWidth = this.isHovered ? cfgW + 6 : cfgW;
      this.targetHeight = cfgH;
      this.targetRadius = Math.round(cfgH / 2);
      return;
    }

    // Compact modes
    if (this.mode === 'compact' && performance.now() < this.airdropHudUntil) {
      // Apple-style AirDrop HUD Pop
      this.targetWidth = this.isHovered ? 350 : 340;
      this.targetHeight = 44;
      this.targetRadius = 22;
    } else if (this.mode === 'compact' && performance.now() < this.speedometerHudUntil) {
      // Apple-style Hardware Speedometer HUD Pop (CPU, RAM, Storage)
      this.targetWidth = this.isHovered ? 370 : 360;
      this.targetHeight = 44;
      this.targetRadius = 22;
    } else if (this.mode === 'compact' && this.isVoiceCompanionActive()) {
      const w = this.voiceState === 'SPEAKING' ? 340 : (this.voiceState === 'THINKING' ? 300 : 320);
      this.targetWidth = this.isHovered ? w + 10 : w;
      this.targetHeight = 44;
      this.targetRadius = 22;
    } else if (this.mode === 'compact' && performance.now() < this.bluetoothHudUntil) {
      // Apple AirPods / Bluetooth Battery & Device HUD
      const hasMb = Boolean(this.activeBluetoothDevice?.multiBattery);
      this.targetWidth = this.isHovered ? (hasMb ? 368 : 338) : (hasMb ? 360 : 330);
      this.targetHeight = 44;
      this.targetRadius = 22;
    } else if (this.mode === 'compact' && performance.now() < this.volumeHudUntil) {
      // Apple-style Hardware Volume HUD Pop (stable width when music is playing)
      const isMediaPlaying = Boolean(this.mediaState.active && this.mediaState.title);
      const baseW = isMediaPlaying
        ? Math.max(280, Math.min(360, Math.round(((this.mediaState.title || '').length) * 7.5 + 104)))
        : 270;
      this.targetWidth = this.isHovered ? baseW + 8 : baseW;
      this.targetHeight = 36;
      this.targetRadius = 18;
    } else if (this.mode === 'compact' && performance.now() < this.chargerSurgeUntil) {
      // iOS / Mac Fluid Premium Charging Dynamic Island Capsule (310x44, radius 22)
      this.targetWidth = this.isHovered ? 320 : 310;
      this.targetHeight = 44;
      this.targetRadius = 22;
    } else if (this.aiState.status === 'running') {
      this.targetWidth = this.isHovered ? 300 : 280;
      this.targetHeight = 36;
      this.targetRadius = 18;
    } else if (this.focusState.active) {
      // TwoCode Focus Mode: Dual task (Music + Focus) or Single Focus Pill
      const isDualActive = Boolean(this.mediaState.playing || (this.mediaState.active && this.mediaState.title));
      if (isDualActive) {
        // Dual task: Spotify takes the primary pill, Focus takes the 36px detached circle bubble
        const hasLyrics = this.hasSyncedLyrics();
        const baseWidth = hasLyrics ? Math.round(Math.max(280, Math.min(440, (this.lyricsWidest || 140) + 106))) : 250;
        this.targetWidth = this.isHovered ? baseWidth + 8 : baseWidth;
        this.targetHeight = 36;
        this.targetRadius = 18;
      } else {
        // Single Focus Pill (TwoCode ai-monitor-ui.js line 1147: compactWidth = 300 / 250)
        this.targetWidth = this.isHovered ? 258 : 250;
        this.targetHeight = 36;
        this.targetRadius = 18;
      }
    } else if (this.mediaState.active && this.mediaState.title) {
      // Dynamic music pill width: dynamically expand to accommodate full lyrics/title without truncation
      let textLen = (this.mediaState.title || '').length;
      if (this.hasSyncedLyrics()) {
        const lyric = this.getLyricNow();
        if (lyric && lyric.text) {
          textLen = Math.max(textLen, lyric.text.length);
        }
      }
      const dynamicMusicW = Math.max(300, Math.min(440, Math.round(textLen * 7.8 + 104)));
      this.targetWidth = this.isHovered ? dynamicMusicW + 8 : dynamicMusicW;
      this.targetHeight = 36;
      this.targetRadius = 18;
    } else if (this.activeDownloadsList.length > 0) {
      // Active Downloads (Single or Multiple)
      if (this.activeDownloadsList.length > 1) {
        // Multiple downloads split island
        this.targetWidth = this.isHovered ? 268 : 260;
      } else {
        // Single download platter
        const dl = this.activeDownloadsList[0];
        const nameLen = (dl?.cleanName || '').length;
        const baseW = Math.max(260, Math.min(340, Math.round(nameLen * 6.5 + 130)));
        this.targetWidth = this.isHovered ? baseW + 8 : baseW;
      }
      this.targetHeight = 36;
      this.targetRadius = 18;
    } else if (this.sportsState?.enabled && this.activeSportsActivity && this.isSportsPillEnabled) {
      const baseW = this.calculateSportsPillWidth();
      this.targetWidth = this.isHovered ? baseW + 8 : baseW;
      this.targetHeight = 36;
      this.targetRadius = 18;
    } else if (performance.now() < this.greetingUntil) {
      this.targetWidth = this.isHovered ? 312 : 304;
      this.targetHeight = 36;
      this.targetRadius = 18;
    } else {
      // True Resting Pill (98 x 26 px, TwoCode compact calibration matching Screenshot 2)
      const hasTelemetry = (this.config?.restLeft && this.config.restLeft !== 'none') ||
                           (this.config?.restRight && this.config.restRight !== 'none');
      const baseW = hasTelemetry ? this.calculateRestWidth() : 98;
      this.targetWidth = this.isHovered ? baseW + 6 : baseW;
      this.targetHeight = 26;
      this.targetRadius = 13;
    }
    this.reportCapsuleBounds();
    this.requestRender();
  }

  public canAutoCollapse(): boolean {
    const active = document.activeElement;
    if (active && (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.tagName === 'SELECT' ||
      (active as HTMLElement).isContentEditable
    )) {
      return false;
    }

    const chatInput = document.getElementById('chat-input') as HTMLInputElement | null;
    if (chatInput && (chatInput === document.activeElement || chatInput.value.trim().length > 0)) {
      return false;
    }

    const islandInput = document.getElementById('island-input') as HTMLInputElement | null;
    if (islandInput && (islandInput === document.activeElement || islandInput.value.trim().length > 0)) {
      return false;
    }

    if (this.activePopover !== 'none') {
      return false;
    }
    const popover = document.getElementById('system-popover');
    if (popover && !popover.classList.contains('hidden') && popover.style.display !== 'none') {
      return false;
    }
    const ctxMenu = document.getElementById('island-context-menu');
    if (ctxMenu && !ctxMenu.classList.contains('hidden') && ctxMenu.style.display !== 'none') {
      return false;
    }
    const quicklook = document.getElementById('quicklook-modal');
    if (quicklook && !quicklook.classList.contains('hidden') && quicklook.style.display !== 'none') {
      return false;
    }
    const guardModal = document.getElementById('focus-guard-modal');
    if (guardModal && !guardModal.classList.contains('hidden') && guardModal.style.display !== 'none') {
      return false;
    }

    // Media player scrubbing or dragging volume slider
    if ((window as any).isMediaInteracting || (window as any).isMediaScrubbing || (window as any).isMediaVolumeDragging || this.isScrubbingVolumeHud) {
      return false;
    }
    const scrubBar = document.getElementById('media-scrub-bar');
    if (scrubBar && (scrubBar.classList.contains('active') || scrubBar.getAttribute('data-scrubbing') === 'true')) {
      return false;
    }
    const volSlider = document.getElementById('media-vol-slider');
    if (volSlider && (volSlider === document.activeElement || volSlider.matches(':active'))) {
      return false;
    }

    // Drag-and-drop operations
    if (this.isDraggingOver || (window as any).isDraggingFiles) {
      return false;
    }
    const dropOverlay = document.getElementById('drag-drop-overlay');
    if (dropOverlay && !dropOverlay.classList.contains('hidden') && dropOverlay.style.display !== 'none') {
      return false;
    }

    // Active selection or interaction within diff viewer, file tray chips, or clipboard history
    const selection = window.getSelection ? window.getSelection() : null;
    if (selection && selection.toString().trim().length > 0) {
      return false;
    }

    const protectedSelectors = [
      '#ai-diff-viewer:hover',
      '.ai-diff-content:hover',
      '#ai-task-feed:hover',
      '#tray-files-shelf:hover',
      '.tray-shelf:hover',
      '.tray-file-chip:hover',
      '.tray-chip:hover',
      '#clipboard-list:hover',
      '.clipboard-item:hover',
      '#chat-messages:hover'
    ];
    for (const selector of protectedSelectors) {
      try {
        if (document.querySelector(selector)) {
          return false;
        }
      } catch {}
    }

    if (document.body && document.body.classList.contains('interacting-internal')) {
      return false;
    }

    return true;
  }

  /**
   * TwoCode Bezel Docking:
   * When in notch mode (default), topY = 0 (flush against top bezel).
   * When floating mode is selected in settings, topY = 6.
   */
  public getTopY(): number {
    if (this.isTucked) return this.isHovered ? 2 : 0;
    return this.config?.islandStyle === 'floating' ? 6 : 0;
  }

  /**
   * TwoCode MacBook Notch Path (mascot.html lines 1145-1172):
   * Hangs from top edge of the screen with two smooth inward curves ("ears").
   */
  public islandPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    const isFloating = this.config?.islandStyle === 'floating';
    if (isFloating) {
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, Math.max(0, Math.min(radius, width / 2, height / 2)));
      return;
    }
    const r = Math.max(0, Math.min(radius, width / 2, height));
    const ear = Math.max(0, Math.min(10, height / 3, width / 8));
    ctx.beginPath();
    ctx.moveTo(x - ear, y);
    ctx.lineTo(x + width + ear, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + ear);
    ctx.lineTo(x + width, y + height - r);
    ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
    ctx.lineTo(x + r, y + height);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.lineTo(x, y + ear);
    ctx.quadraticCurveTo(x, y, x - ear, y);
    ctx.closePath();
  }

  /**
   * TwoCode Synchronized Lyrics state tick (lyrics-ui.js lines 48-67).
   * Determines active sung line, lead time, roll transition, and detects
   * instrumental gaps / tone interludes so Robo's eyes return between singing.
   */
  private tickLyrics(): void {
    if (!this.syncedLyrics.length) {
      this.lyricsIndex = -1;
      this.lyricsGap = false;
      this.lyricsPrevious = null;
      return;
    }

    const pos = (this.mediaState.positionMs || 0) + this.LYRICS_LEAD;
    let i = -1;
    for (let k = 0; k < this.syncedLyrics.length; k++) {
      if (this.syncedLyrics[k].timeMs <= pos) i = k;
      else break;
    }

    // A long instrumental part after a line: let the line go (Robo's eyes come back)
    // Formula directly from TwoCode lyrics-ui.js lines 62-65:
    let g = false;
    if (i >= 0) {
      const since = pos - this.syncedLyrics[i].timeMs;
      const next = this.syncedLyrics[i + 1];
      g = next ? (next.timeMs - this.syncedLyrics[i].timeMs > 14000 && since > 9000) : (since > 8000);
    }

    if (i !== this.lyricsIndex || g !== this.lyricsGap) {
      this.lyricsPrevious = this.getCurrentLyricText();
      this.lyricsIndex = i;
      this.lyricsGap = g;
      this.lyricsChangedAt = performance.now();
    }

    this.mediaState.lyricLine = this.getCurrentLyricText() || '';
  }

  private getCurrentLyricText(): string | null {
    if (this.lyricsGap || this.lyricsIndex < 0 || this.lyricsIndex >= this.syncedLyrics.length) {
      return null;
    }
    const l = this.syncedLyrics[this.lyricsIndex];
    return l && l.text ? l.text : null;
  }

  private getLyricNow(): { text: string | null; previous: string | null; next: string | null; k: number; font: string } | null {
    const rawK = Math.min(1, (performance.now() - this.lyricsChangedAt) / this.LYRICS_SWAP);
    const k = 1 - Math.pow(1 - rawK, 4);
    if (!this.syncedLyrics.length) {
      return this.lyricsLoading && performance.now() < this.lyricsHoldUntil
        ? { text: null, previous: rawK < 1 ? this.lyricsPrevious : null, next: null, k, font: this.LYRICS_FONT }
        : null;
    }
    const nextIdx = this.lyricsIndex >= 0 ? this.lyricsIndex + 1 : 0;
    const nextText = (this.syncedLyrics[nextIdx] && this.syncedLyrics[nextIdx].text) || null;
    return {
      text: this.getCurrentLyricText(),
      previous: rawK < 1 ? this.lyricsPrevious : null,
      next: nextText,
      k,
      font: this.LYRICS_FONT
    };
  }

  public getLyricAround(): { before: string; now: string; next: string; k: number } | null {
    if (!this.syncedLyrics.length) {
      return this.lyricsLoading && performance.now() < this.lyricsHoldUntil ? { before: '', now: '', next: '', k: 1 } : null;
    }
    const rawK = Math.min(1, (performance.now() - this.lyricsChangedAt) / this.LYRICS_SWAP);
    const k = 1 - Math.pow(1 - rawK, 4);
    const textAt = (idx: number) => (this.syncedLyrics[idx] && this.syncedLyrics[idx].text) || '';
    if (this.lyricsIndex < 0) {
      return { before: '', now: '', next: this.syncedLyrics.find(l => l.text)?.text || '', k: 1 };
    }
    return {
      before: textAt(this.lyricsIndex - 1),
      now: this.getCurrentLyricText() || '',
      next: textAt(this.lyricsIndex + 1),
      k
    };
  }

  public hasSyncedLyrics(): boolean {
    return Boolean(
      (this.syncedLyrics.length > 0 || (this.lyricsLoading && performance.now() < this.lyricsHoldUntil)) &&
      this.mediaState.playing &&
      !this.isTucked
    );
  }

  public checkHitTest(): void {
    const cx = window.innerWidth / 2;
    const topY = this.getTopY();
    // Use effective target dimensions in expanded mode to avoid premature collapse during spring transition
    const effectiveW = this.mode === 'expanded' ? Math.max(this.targetWidth, this.currentWidth) : this.currentWidth;
    const effectiveH = this.mode === 'expanded' ? Math.max(this.targetHeight, this.currentHeight) : this.currentHeight;
    const halfW = effectiveW / 2;

    let inBounds = false;
    if (this.isTucked) {
      // TwoCode tuck-ui.js: ZONE_W = 160, ZONE_H = 10, BACK_AFTER = 450
      const over = this.pointerX >= cx - 80 &&
                   this.pointerX <= cx + 80 &&
                   this.pointerY >= 0 &&
                   this.pointerY <= 10;

      if (!over) {
        this.tuckArmed = true; // armed: mouse left line once since tucking
      }

      if (over && this.tuckArmed) {
        if (!this.tuckHoverStartTime) {
          this.tuckHoverStartTime = performance.now();
        } else if (performance.now() - this.tuckHoverStartTime > 450) {
          this.tuckHoverStartTime = 0;
          this.setTucked(false);
          try {
            AudioSynth.getInstance().playMelody('pop');
          } catch {}
          if (window.roboIsland?.setTucked) {
            window.roboIsland.setTucked(false);
          } else if (window.roboIsland?.toggleTuck) {
            window.roboIsland.toggleTuck();
          }
        }
      } else {
        this.tuckHoverStartTime = 0;
      }

      if (over !== this.isHovered) {
        this.isHovered = over;
      }

      // Only the thin zone catches the mouse; everything else clicks through to browser tabs
      const shouldBeInteractive = over;
      if (shouldBeInteractive !== this.isInteractive) {
        this.isInteractive = shouldBeInteractive;
        if (window.roboIsland) {
          window.roboIsland.setInteractive(shouldBeInteractive);
        }
      }
      return;
    }

    if (this.mode === 'rest') {
      inBounds = this.pointerX >= cx - halfW &&
                 this.pointerX <= cx + halfW &&
                 this.pointerY >= topY &&
                 this.pointerY <= topY + effectiveH;
    } else if (this.isSplitIslandActive()) {
      // Feature C: Split-Island Dual Bubble hit testing [ Pill ] ( ○ )
      const bubbleSize = this.currentHeight;
      const totalSpan = this.currentWidth + 8 + bubbleSize;
      const pillLeft = cx - totalSpan / 2;
      inBounds = this.pointerX >= pillLeft &&
                 this.pointerX <= pillLeft + totalSpan &&
                 this.pointerY >= topY &&
                 this.pointerY <= topY + this.currentHeight;
    } else {
      const marginX = this.mode === 'compact' ? 1 : 0;
      const marginY = this.mode === 'compact' ? 1 : 0;
      inBounds = this.pointerX >= cx - halfW - marginX &&
                 this.pointerX <= cx + halfW + marginX &&
                 this.pointerY >= topY - marginY &&
                 this.pointerY <= topY + effectiveH + marginY;
    }

    if (inBounds !== this.isHovered) {
      this.isHovered = inBounds;
      this.updateTargetDimensions();
    }

    if (inBounds) {
      if (this.collapseTimer) {
        clearTimeout(this.collapseTimer);
        this.collapseTimer = null;
      }

      if (this.mode === 'rest') {
        this.restoreFromRest('compact');
      }

      // Hover to open: when hovering over compact (or after restoring from rest),
      // wait 300ms (TwoCode NORMAL_PEEK_DELAY) then auto-expand into the card (unless notification is active).
      if (this.mode === 'compact' && !this.isNotificationActive()) {
        if (!this.hoverOpenTimer) {
          this.hoverOpenTimer = window.setTimeout(() => {
            this.hoverOpenTimer = null;
            if (this.isHovered && this.mode === 'compact') {
              if (this.mediaState.active && this.mediaState.title) {
                this.activeTab = 'media';
                this.showDomTab('music');
              } else if (this.focusState.active) {
                this.activeTab = 'focus';
                this.showDomTab('focus');
              } else {
                this.activeTab = 'home';
                this.showDomTab('home');
              }
              this.mascot.jump();
              this.expand();
            }
          }, 300);
        }
      } else if (this.mode === 'expanded') {
        if (this.hoverOpenTimer) {
          clearTimeout(this.hoverOpenTimer);
          this.hoverOpenTimer = null;
        }
      }
    } else {
      // Not in bounds: cancel hover-to-open
      this.justRestoredFromRest = false;
      if (this.hoverOpenTimer) {
        clearTimeout(this.hoverOpenTimer);
        this.hoverOpenTimer = null;
      }

      // Hover-to-close outside: auto-collapse when mouse moves outside expanded island
      if (this.mode === 'expanded' && this.canAutoCollapse()) {
        if (!this.collapseTimer) {
          this.collapseTimer = window.setTimeout(() => {
            this.collapseTimer = null;
            if (this.mode === 'expanded' && !this.isHovered && this.canAutoCollapse()) {
              this.collapse();
              if (this.config?.restModeEnabled && !this.mediaState.active && !this.focusState.active) {
                this.enterRest();
              }
            }
          }, 380);
        }
      } else if (this.mode === 'compact' && this.config?.restModeEnabled && !this.mediaState.active && !this.focusState.active) {
        // Return to rest only when music and focus are not active
        if (!this.collapseTimer) {
          this.collapseTimer = window.setTimeout(() => {
            this.collapseTimer = null;
            if (this.mode === 'compact' && !this.isHovered && !this.mediaState.active && !this.focusState.active) {
              this.enterRest();
            }
          }, 350);
        }
      }
    }

    const shouldBeInteractive = inBounds || this.mode === 'expanded' || this.isDraggingOver;
    if (shouldBeInteractive !== this.isInteractive) {
      this.isInteractive = shouldBeInteractive;
      if (window.roboIsland) {
        window.roboIsland.setInteractive(shouldBeInteractive);
      }
    }
  }

  public getMode(): IslandMode {
    return this.mode;
  }

  public setMode(mode: IslandMode, playSound = true): void {
    this.requestRender();
    if (mode === 'expanded') {
      this.expand();
    } else if (mode === 'rest') {
      this.enterRest();
    } else {
      this.collapse(playSound);
    }
  }

  public setMascotMood(mood: MascotMood): void {
    this.mascot.setMood(mood);
    this.requestRender();
  }

  public getMascotMood(): MascotMood {
    return this.mascot.getMood();
  }

  public mascotJump(strength?: number): void {
    this.mascot.jump(strength);
    this.requestRender();
  }

  public mascotBounce(strength?: number): void {
    this.mascot.bounce(strength);
    this.requestRender();
  }

  public mascotSpeak(text: string, duration?: number): void {
    this.mascot.speak(text, duration);
    this.requestRender();
  }

  public pokeMascot(x?: number, y?: number): void {
    this.requestRender();
    if (this.compactClickTimer) {
      clearTimeout(this.compactClickTimer);
      this.compactClickTimer = null;
    }
    const cx = window.innerWidth / 2;
    const topY = this.getTopY();
    const midY = topY + this.currentHeight / 2;
    const pokeX = typeof x === 'number' ? x : cx;
    const pokeY = typeof y === 'number' ? y : midY;

    this.mascot.poke(pokeX, pokeY);

    try {
      AudioSynth.getInstance().playMelody('pop');
    } catch {}
  }

  public enterRest(): void {
    if (this.focusState.active || (this.mediaState.active && this.mediaState.title)) return;
    if (this.collapseTimer) {
      clearTimeout(this.collapseTimer);
      this.collapseTimer = null;
    }
    if (this.hoverOpenTimer) {
      clearTimeout(this.hoverOpenTimer);
      this.hoverOpenTimer = null;
    }
    this.mode = 'rest';
    this.mascot.setMood('sleepy');
    this.setPopover('none');
    if (this.domOverlayEl) this.domOverlayEl.classList.add('hidden');
    const ctxMenu = document.getElementById('island-context-menu');
    if (ctxMenu) ctxMenu.classList.add('hidden');
    this.updateTargetDimensions();
    this.reportCapsuleBounds();
    if (window.roboIsland?.notifyModeChanged) {
      window.roboIsland.notifyModeChanged('rest');
    }
  }

  public restoreFromRest(targetMode: IslandMode = 'compact'): void {
    if (this.mode !== 'rest') return;
    this.mode = targetMode;
    this.mascot.setMood('happy');
    this.mascot.jump(90);
    setTimeout(() => {
      if (this.mascot.mood === 'happy') this.mascot.setMood('neutral');
    }, 1800);
    this.updateTargetDimensions();
    this.reportCapsuleBounds();
    this.mascot.sounds.playChirp();
    if (window.roboIsland?.notifyModeChanged) {
      window.roboIsland.notifyModeChanged(targetMode);
    }
  }

  public setTucked(tucked: boolean): void {
    if (this.isTucked === Boolean(tucked)) return;
    this.isTucked = Boolean(tucked);
    this.tuckHoverStartTime = 0;
    this.tuckArmed = false;
    this.tuckChangedAt = performance.now();
    if (this.isTucked) {
      if (document.activeElement && document.activeElement !== document.body) {
        (document.activeElement as HTMLElement).blur();
      }
      try { this.setMode('rest'); } catch {}
    } else {
      if (this.mode === 'rest' && (!this.config || !this.config.restModeEnabled)) {
        try { this.setMode('compact', false); } catch {}
      }
    }
    this.updateTargetDimensions();
    this.reportCapsuleBounds();
    this.requestRender();
  }

  public getTucked(): boolean {
    return this.isTucked;
  }

  public toggleExpand(): void {
    if (this.mode === 'expanded') {
      this.collapse();
    } else {
      this.expand();
    }
  }

  public expand(): void {
    if (this.collapseTimer) {
      clearTimeout(this.collapseTimer);
      this.collapseTimer = null;
    }
    if (this.hoverOpenTimer) {
      clearTimeout(this.hoverOpenTimer);
      this.hoverOpenTimer = null;
    }
    this.mode = 'expanded';
    this.setPopover('none');
    this.updateTargetDimensions();
    this.reportCapsuleBounds();
    this.mascot.sounds.playChirp();
    if (window.roboIsland) {
      window.roboIsland.setInteractive(true);
      if (window.roboIsland.notifyModeChanged) {
        window.roboIsland.notifyModeChanged('expanded');
      }
    }
  }

  public collapse(playSound = true): void {
    if (this.collapseTimer) {
      clearTimeout(this.collapseTimer);
      this.collapseTimer = null;
    }
    if (this.hoverOpenTimer) {
      clearTimeout(this.hoverOpenTimer);
      this.hoverOpenTimer = null;
    }
    this.mode = 'compact';
    this.isHovered = false;
    this.setPopover('none');
    if (this.domOverlayEl) {
      this.domOverlayEl.classList.add('hidden');
    }
    this.updateTargetDimensions();
    this.reportCapsuleBounds();
    if (playSound) {
      this.mascot.sounds.playChirp();
    }
    const ctxMenu = document.getElementById('island-context-menu');
    if (ctxMenu) ctxMenu.classList.add('hidden');
    if (window.roboIsland?.notifyModeChanged) {
      window.roboIsland.notifyModeChanged('compact');
    }
    if (window.roboIsland?.setInteractive) {
      window.roboIsland.setInteractive(false);
    }
  }

  public triggerMindfulDistractionPause(data: any): void {
    const modal = document.getElementById('focus-guard-modal');
    const titleEl = document.getElementById('guard-title');
    const ringEl = document.getElementById('guard-breath-ring');
    const wordEl = document.getElementById('guard-breath-word');
    const faceEl = document.getElementById('guard-face');
    const btnBack = document.getElementById('btn-guard-back');
    const btnAnyway = document.getElementById('btn-guard-anyway') as HTMLButtonElement;

    if (!modal || !titleEl) return;

    if (this.mode !== 'expanded') {
      this.setMode('expanded');
    }

    const appName = data?.item?.target || data?.windowTitle || 'Distraction';
    titleEl.textContent = `You are opening ${appName}`;
    faceEl?.classList.remove('happy');
    modal.classList.remove('hidden');

    try {
      AudioSynth.getInstance().playMelody('warn');
    } catch {}

    // Animated Breathing Circle (5 seconds total)
    if (ringEl && wordEl) {
      wordEl.textContent = 'Breathe in';
      ringEl.classList.add('expand');
      setTimeout(() => {
        if (wordEl) wordEl.textContent = 'Breathe out';
        if (ringEl) ringEl.classList.remove('expand');
      }, 2500);
    }

    // 5-second countdown on "Open anyway"
    let secondsLeft = 5;
    if (btnAnyway) {
      btnAnyway.disabled = true;
      btnAnyway.textContent = `Open anyway (${secondsLeft})`;
      const countTimer = setInterval(() => {
        secondsLeft--;
        if (secondsLeft > 0) {
          btnAnyway.textContent = `Open anyway (${secondsLeft})`;
        } else {
          clearInterval(countTimer);
          btnAnyway.disabled = false;
          btnAnyway.textContent = 'Open anyway (5 min)';
        }
      }, 1000);

      btnAnyway.onclick = async (e) => {
        e.stopPropagation();
        clearInterval(countTimer);
        modal.classList.add('hidden');
        const api = (window as any).roboIsland;
        await api?.snoozeDistraction?.(5);
      };
    }

    if (btnBack) {
      btnBack.onclick = async (e) => {
        e.stopPropagation();
        faceEl?.classList.add('happy');
        try {
          AudioSynth.getInstance().playMelody('done');
        } catch {}
        setTimeout(() => {
          modal.classList.add('hidden');
          const api = (window as any).roboIsland;
          api?.minimizeDistraction?.(data?.pid);
        }, 400);
      };
    }
  }

  public handleClick(x: number, y: number, isAlt: boolean = false): void {
    const cx = window.innerWidth / 2;
    const topY = this.getTopY();
    const effectiveW = this.mode === 'expanded' ? Math.max(this.targetWidth, this.currentWidth) : this.currentWidth;
    const effectiveH = this.mode === 'expanded' ? Math.max(this.targetHeight, this.currentHeight) : this.currentHeight;
    const halfW = effectiveW / 2;
    const inBounds =
      x >= cx - halfW &&
      x <= cx + halfW &&
      y >= topY &&
      y <= topY + effectiveH;

    // Outside-click handling: collapses expanded island or immediately releases interactivity
    if (!inBounds) {
      if (this.mode === 'expanded') {
        this.isDraggingOver = false;
        (window as any).isDraggingFiles = false;
        const summaryModal = document.getElementById('screen-summary-modal');
        const isModalOpen = summaryModal && !summaryModal.classList.contains('hidden') && summaryModal.style.display !== 'none';
        if (!isModalOpen) {
          if (this.config && this.config.restModeEnabled && !this.mediaState.active && !this.focusState.active) {
            this.enterRest();
          } else {
            this.collapse();
          }
        }
      } else {
        if (window.roboIsland) {
          window.roboIsland.setInteractive(false);
        }
      }
      return;
    }

    if (this.isVoiceCompanionActive()) {
      this.interruptVoiceCompanion();
      return;
    }

    if (this.isTucked) {
      if (inBounds) {
        this.setTucked(false);
        if (window.roboIsland?.setTucked) {
          window.roboIsland.setTucked(false);
        } else if (window.roboIsland?.toggleTuck) {
          window.roboIsland.toggleTuck();
        }
      }
      return;
    }

    // Notification Interactive Button Clicks (TwoCode & Apple Dynamic Island Parity)
    if (this.isNotificationActive() && Object.keys(this.notificationHits).length > 0) {
      for (const [key, rect] of Object.entries(this.notificationHits)) {
        if (this.isInsideHit(x, y, rect)) {
          if (key === 'cWhatsAppReply') {
            this.openWhatsAppReply();
            return;
          }
          if (key === 'cWhatsAppSend') {
            this.submitWhatsAppReply();
            return;
          }
          if (key === 'cWhatsAppAnswer') {
            if (window.roboIsland?.openExternal) {
              window.roboIsland.openExternal('whatsapp://');
            }
            this.clearNotification();
            return;
          }
          if (key === 'cWhatsAppDecline') {
            this.clearNotification();
            return;
          }
          if (key === 'cOpenFile') {
            if (this.activeNotification?.filePath && window.roboIsland?.showItemInFolder) {
              window.roboIsland.showItemInFolder(this.activeNotification.filePath);
            }
            this.clearNotification();
            return;
          }
          if (key === 'cOpenApp') {
            const notif = this.activeNotification;
            if (notif?.url && window.roboIsland?.openExternal) {
              window.roboIsland.openExternal(notif.url);
            } else if ((notif?.kind === 'chrome' || notif?.app?.toLowerCase().includes('chrome')) && window.roboIsland?.openExternal) {
              window.roboIsland.openExternal(notif?.url || 'https://www.google.com');
            } else if ((notif?.kind === 'mail' || notif?.app?.toLowerCase().includes('mail') || notif?.app?.toLowerCase().includes('outlook')) && window.roboIsland?.openExternal) {
              window.roboIsland.openExternal(notif?.url || 'mailto:');
            } else if ((notif?.kind === 'edge' || notif?.app?.toLowerCase().includes('edge')) && window.roboIsland?.openExternal) {
              window.roboIsland.openExternal(notif?.url || 'microsoft-edge:https://www.bing.com');
            }
            this.clearNotification();
            return;
          }
          if (key === 'cAllow') {
            const sid = this.activeNotification?.sessionId;
            if (sid && window.roboIsland?.aiApprove) {
              window.roboIsland.aiApprove(sid, true);
            }
            this.clearNotification();
            return;
          }
          if (key === 'cDeny') {
            const sid = this.activeNotification?.sessionId;
            if (sid && window.roboIsland?.aiApprove) {
              window.roboIsland.aiApprove(sid, false);
            }
            this.clearNotification();
            return;
          }
          if (key === 'cDismiss') {
            if (this.isWhatsAppReplying) {
              this.closeWhatsAppReply();
            }
            this.clearNotification();
            return;
          }
          if (key.startsWith('action_')) {
            const actionId = key.replace('action_', '');
            if (actionId === 'opt_ram' && (window.roboIsland as any)?.optimizeMemory) {
              (window.roboIsland as any).optimizeMemory();
            } else if ((window.roboIsland as any)?.dispatchDiagnosticsAction) {
              (window.roboIsland as any).dispatchDiagnosticsAction(actionId);
            }
            this.clearNotification();
            return;
          }
        }
      }
      // If user clicked inside the WhatsApp Quick Reply box, retain focus without dismissing
      if (inBounds && this.isWhatsAppReplying) {
        const input = document.getElementById('whatsapp-reply-input') as HTMLInputElement | null;
        if (input && document.activeElement !== input) {
          input.focus();
        }
        return;
      }
      // If notification is clicked directly (WhatsApp opens quick reply; download complete reveals in folder; apps open)
      if (inBounds && (!this.activeNotification?.actions || this.activeNotification.actions.length === 0)) {
        const resolvedKind = this.resolveNotificationKind(this.activeNotification?.kind, this.activeNotification?.status, this.activeNotification?.app, this.activeNotification?.title);
        if (resolvedKind === 'whatsapp' && !this.isWhatsAppReplying) {
          const wa = this.parseWhatsAppDetails(this.activeNotification?.title, this.activeNotification?.body);
          if (wa.isCall) {
            if (window.roboIsland?.openExternal) {
              window.roboIsland.openExternal('whatsapp://');
            }
            this.clearNotification();
            return;
          }
          this.openWhatsAppReply();
          return;
        }
        if (this.activeNotification?.filePath && window.roboIsland?.showItemInFolder) {
          window.roboIsland.showItemInFolder(this.activeNotification.filePath);
        } else if ((this.activeNotification?.kind === 'chrome' || this.activeNotification?.app?.toLowerCase().includes('chrome')) && window.roboIsland?.openExternal) {
          window.roboIsland.openExternal(this.activeNotification.url || 'https://www.google.com');
        } else if ((this.activeNotification?.kind === 'mail' || this.activeNotification?.app?.toLowerCase().includes('mail') || this.activeNotification?.app?.toLowerCase().includes('outlook')) && window.roboIsland?.openExternal) {
          window.roboIsland.openExternal(this.activeNotification.url || 'mailto:');
        }
        this.clearNotification();
        return;
      }
      if (inBounds) {
        return;
      }
    }

    if (this.mode === 'rest') {
      if (this.focusState.active) {
        this.activeTab = 'focus';
        this.showDomTab('focus');
        this.expand();
        return;
      }
      if (performance.now() < this.airdropHudUntil) {
        this.airdropHudUntil = 0;
        this.updateTargetDimensions();
        return;
      }
      if (performance.now() < this.speedometerHudUntil) {
        this.speedometerHudUntil = 0;
        this.updateTargetDimensions();
        return;
      }
      if (performance.now() < this.bluetoothHudUntil) {
        this.bluetoothHudUntil = 0;
        this.updateTargetDimensions();
        return;
      }
      if (performance.now() < this.greetingUntil) {
        this.dismissGreeting();
        return;
      }
      // In rest mode: click restores cleanly to compact (or Alt+click triggers speedometer HUD)
      if (inBounds) {
        if (isAlt) {
          this.triggerSpeedometerHud();
          return;
        }
        this.restoreFromRest('compact');
      }
      return;
    }

    if (this.mode === 'compact') {
      if (performance.now() < this.greetingUntil) {
        this.dismissGreeting();
        return;
      }
      if (performance.now() < this.airdropHudUntil) {
        // Clicking active AirDrop HUD dismisses it immediately
        this.airdropHudUntil = 0;
        this.updateTargetDimensions();
        return;
      }

      if (performance.now() < this.speedometerHudUntil) {
        // Clicking active Speedometer HUD dismisses it immediately
        this.speedometerHudUntil = 0;
        this.updateTargetDimensions();
        return;
      }

      if (performance.now() < this.bluetoothHudUntil) {
        // Clicking active Bluetooth HUD dismisses it immediately
        this.bluetoothHudUntil = 0;
        this.updateTargetDimensions();
        return;
      }

      if (isAlt) {
        this.triggerSpeedometerHud();
        return;
      }

      if (performance.now() < this.volumeHudUntil) {
        const pillLeft = cx - this.currentWidth / 2;
        const midY = topY + this.currentHeight / 2;
        // Speaker click: toggle mute
        if (Math.hypot(x - (pillLeft + 26), y - midY) <= 16) {
          const nextMuted = !this.volumeHudMuted;
          this.volumeHudMuted = nextMuted;
          if (window.roboIsland?.setMute) {
            window.roboIsland.setMute(nextMuted);
          }
          this.triggerVolumeHud(this.volumeHudLevel, nextMuted);
          return;
        }
        // Track click: adjust volume directly
        const trackLeft = pillLeft + 52;
        const trackRight = pillLeft + this.currentWidth - 52;
        const trackW = Math.max(20, trackRight - trackLeft);
        if (x >= trackLeft - 6 && x <= trackRight + 6 && Math.abs(y - midY) <= 14) {
          const clampedX = Math.max(trackLeft, Math.min(trackRight, x));
          const pct = Math.round(((clampedX - trackLeft) / trackW) * 100);
          this.volumeHudLevel = pct;
          this.volumeHudMuted = false;
          if (window.roboIsland?.setVolume) {
            window.roboIsland.setVolume(pct);
          }
          this.triggerVolumeHud(pct, false);
          return;
        }
      }

      if (this.isSplitIslandActive()) {
        const bubbleSize = this.currentHeight;
        const totalSpan = this.currentWidth + 8 + bubbleSize;
        const pillLeft = cx - totalSpan / 2;
        const bubbleCx = pillLeft + this.currentWidth + 8 + bubbleSize / 2;
        const bubbleCy = topY + this.currentHeight / 2;
        const bubbleR = bubbleSize / 2;

        // Clicking on the detached circular bubble:
        if (Math.hypot(x - bubbleCx, y - bubbleCy) <= bubbleR + 4) {
          if (this.activeDownloadsList.length > 0) {
            // Reveal download in Windows Explorer
            const dl = this.activeDownloadsList[0];
            const target = dl?.finalPath || dl?.tempPath;
            if (target && (window.roboIsland as any)?.showItemInFolder) {
              (window.roboIsland as any).showItemInFolder(target);
            }
            return;
          }
          this.activeTab = 'focus';
          this.showDomTab('focus');
          this.expand();
          return;
        }

        // Clicking on the main primary pill
        if (x >= pillLeft && x <= pillLeft + this.currentWidth && y >= topY && y <= topY + this.currentHeight) {
          if (this.mediaState.active && this.mediaState.title) {
            this.activeTab = 'media';
            this.showDomTab('music');
            this.mascot.jump();
            this.expand();
            return;
          } else if (this.activeDownloadsList.length > 0) {
            const dl = this.activeDownloadsList[0];
            const target = dl?.finalPath || dl?.tempPath;
            if (target && (window.roboIsland as any)?.showItemInFolder) {
              (window.roboIsland as any).showItemInFolder(target);
            }
            return;
          }
          this.mascot.jump();
          this.expand();
          return;
        }
      }

      // Single active download platter click: reveal in Windows Explorer
      if (this.activeDownloadsList.length === 1 && !(this.mediaState.active && this.mediaState.title)) {
        const pillLeft = cx - this.currentWidth / 2;
        if (x >= pillLeft && x <= pillLeft + this.currentWidth && y >= topY && y <= topY + this.currentHeight) {
          const dl = this.activeDownloadsList[0];
          const target = dl?.finalPath || dl?.tempPath;
          if (target && (window.roboIsland as any)?.showItemInFolder) {
            (window.roboIsland as any).showItemInFolder(target);
          }
          return;
        }
      }

      // Check if user clicked on left or right resting telemetry slot (CPU, RAM, Storage, Battery)
      const isRestingCompact = !(this.focusState.active) && !(this.mediaState.active && this.mediaState.title) && (this.aiState.status !== 'running');
      if (isRestingCompact) {
        const leftItem = this.config?.restLeft && this.config.restLeft !== 'none' ? this.config.restLeft : null;
        const rightItem = this.config?.restRight && this.config.restRight !== 'none' ? this.config.restRight : null;
        const pillLeft = cx - this.currentWidth / 2;
        const pillRight = cx + this.currentWidth / 2;
        const isLeftClick = x >= pillLeft && x <= pillLeft + 54 && y >= topY && y <= topY + this.currentHeight;
        const isRightClick = x >= pillRight - 54 && x <= pillRight && y >= topY && y <= topY + this.currentHeight;

        const isTelemetryKind = (k: string | null) => k === 'cpu' || k === 'ram' || k === 'storage' || k === 'disk' || k === 'battery';
        if ((isLeftClick && isTelemetryKind(leftItem)) || (isRightClick && isTelemetryKind(rightItem))) {
          this.triggerSpeedometerHud();
          return;
        }
      }

      // In compact mode: click anywhere on pill triggers mascot jump and expands it (debounced for double-click poke)
      if (Math.abs(x - cx) <= this.currentWidth / 2 && y >= topY && y <= topY + this.currentHeight) {
        if (this.compactClickTimer) {
          clearTimeout(this.compactClickTimer);
          this.compactClickTimer = null;
        }
        this.compactClickTimer = setTimeout(() => {
          this.compactClickTimer = null;
          if (this.mode !== 'compact') return;
          if (this.sportsState?.enabled && this.activeSportsActivity && this.isSportsPillEnabled) {
            this.activeTab = 'sports' as any;
            this.showDomTab('sports');
          } else if (this.focusState.active && !(this.mediaState.active && this.mediaState.title)) {
            this.activeTab = 'focus';
            this.showDomTab('focus');
          } else if (this.mediaState.active && this.mediaState.title) {
            this.activeTab = 'media';
            this.showDomTab('music');
          } else {
            this.activeTab = 'home';
            this.showDomTab('home');
          }
          this.mascot.jump();
          this.expand();
        }, 220);
      }
      return;
    }

    // Expanded mode: Clicking outside the capsule collapses back to compact
    if (this.mode === 'expanded') {
      const pillLeft = cx - effectiveW / 2;
      const pillRight = cx + effectiveW / 2;
      const pillBottom = topY + effectiveH;
      const insidePill = x >= pillLeft && x <= pillRight && y >= topY && y <= pillBottom;
      if (!insidePill) {
        if (this.canAutoCollapse()) {
          this.collapse();
        }
        return;
      }
    }

    // Expanded Hub Interactions (only for canvas UI mode; DOM overlay handles DOM UI clicks)
    if (this.config.expandedUiMode === 'canvas') {
      const pillLeft = cx - effectiveW / 2;

      // 1. Settings icon (top left)
      if (Math.hypot(x - (pillLeft + 32), y - (topY + 28)) < 16) {
        if (window.roboIsland) window.roboIsland.openSettings();
        return;
      }

      // 2. Close icon (top right)
      if (Math.hypot(x - (pillLeft + effectiveW - 32), y - (topY + 28)) < 16) {
        this.collapse();
        return;
      }

      // 3. Tab Navigation
      const tabsY = topY + 28;
      const tabs: Array<{ id: IslandTab; label: string; x: number }> = [
        { id: 'media', label: 'Music', x: cx - 140 },
        { id: 'home', label: 'System', x: cx - 60 },
        { id: 'ai', label: 'AI', x: cx + 20 },
        { id: 'tools', label: 'Tools', x: cx + 90 },
        { id: 'focus', label: 'Focus', x: cx + 160 }
      ];

      for (const t of tabs) {
        if (Math.abs(x - t.x) < 32 && Math.abs(y - tabsY) < 14) {
          this.activeTab = t.id;
          this.mascot.sounds.playChirp();
          return;
        }
      }

      // 4. Tab interactions
      if (this.activeTab === 'media') {
        this.handleMediaClick(x, y, cx, topY);
      } else if (this.activeTab === 'home') {
        this.handleHomeClick(x, y, cx, topY);
      } else if (this.activeTab === 'ai') {
        this.handleAiClick(x, y, cx, topY);
      } else if (this.activeTab === 'focus') {
        this.handleFocusClick(x, y, cx, topY);
      }
    }
  }

  private handleMediaClick(x: number, y: number, cx: number, topY: number): void {
    const contentW = 472;
    const x0 = cx - contentW / 2;
    const right = cx + contentW / 2;
    const top0 = topY + 48;
    const cs = 60;
    const hasLyrics = Boolean(this.mediaState.lyricLine && this.syncedLyrics.length > 0);
    const extra = hasLyrics ? 74 : 0;
    const barY = top0 + cs + 16 + extra;
    const bx0 = x0 + 34;
    const bw = right - 40 - bx0;
    const cy = barY + 22;
    const mid = (x0 + right) / 2;

    // 1. Device popup interactions (if open)
    if (this.isDevicesOpen) {
      const pw = 280;
      const list = this.spotifyDevices.slice(0, 4);
      const ph = 52 + Math.max(1, list.length) * 40;
      const px = right - pw;
      const py = Math.max(topY + 36, cy - 11 - ph - 8);

      // Close button (x)
      if (Math.hypot(x - (px + pw - 22), y - (py + 28)) < 16) {
        this.isDevicesOpen = false;
        return;
      }

      // Device rows
      for (let i = 0; i < list.length; i++) {
        const ry = py + 44 + i * 40;
        if (x >= px + 6 && x <= px + pw - 6 && y >= ry && y <= ry + 40) {
          const targetDev = list[i];
          if (window.roboIsland?.transferSpotifyPlayback && targetDev.id) {
            window.roboIsland.transferSpotifyPlayback(targetDev.id);
          }
          this.isDevicesOpen = false;
          try { AudioSynth.getInstance().playMelody('pop'); } catch {}
          return;
        }
      }

      // Click outside popup closes it
      if (x < px || x > px + pw || y < py || y > py + ph) {
        this.isDevicesOpen = false;
      }
      return;
    }

    // 2. Device button toggle (bottom right)
    const devLabel = this.mediaState.source === 'spotify' ? 'Spotify' : 'This PC';
    this.ctx.save();
    this.ctx.font = '600 11px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const dw = Math.min(130, this.ctx.measureText(devLabel).width + 34);
    this.ctx.restore();
    const dbx = right - dw;
    const dby = cy - 11;
    if (x >= dbx && x <= dbx + dw && y >= dby && y <= dby + 22) {
      this.isDevicesOpen = !this.isDevicesOpen;
      if (this.isDevicesOpen && window.roboIsland?.getSpotifyDevices) {
        window.roboIsland.getSpotifyDevices().then((res: any) => {
          this.spotifyDevices = res?.devices || [];
        }).catch(() => {});
      }
      try { AudioSynth.getInstance().playMelody('pop'); } catch {}
      return;
    }

    // 3. Timeline scrub click
    if (x >= bx0 && x <= bx0 + bw && Math.abs(y - barY) <= 10) {
      const clickRatio = Math.max(0, Math.min(1, (x - bx0) / bw));
      const targetPosMs = clickRatio * (this.mediaState.durationMs || 180000);
      this.mediaState.positionMs = targetPosMs;
      this.basePositionMs = targetPosMs;
      this.lastMediaSampleTime = performance.now();
      if (window.roboIsland) {
        window.roboIsland.mediaSeek(targetPosMs);
      }
      this.mascot.sounds.playChirp();
      return;
    }

    // 4. Centered Playback Controls (Previous, Play/Pause, Next)
    // Previous (mid - 46)
    if (Math.hypot(x - (mid - 46), y - cy) < 18) {
      if (window.roboIsland) window.roboIsland.mediaPrev();
      this.mascot.sounds.playChirp();
      return;
    }
    // Play/Pause (mid)
    if (Math.hypot(x - mid, y - cy) < 20) {
      const action = this.mediaState.playing ? 'pause' : 'play';
      this.mediaState.playing = !this.mediaState.playing;
      if (window.roboIsland) window.roboIsland.mediaControl(action);
      this.mascot.sounds.playChirp();
      return;
    }
    // Next (mid + 46)
    if (Math.hypot(x - (mid + 46), y - cy) < 18) {
      if (window.roboIsland) window.roboIsland.mediaNext();
      this.mascot.sounds.playChirp();
      return;
    }
  }

  private handleHomeClick(x: number, y: number, cx: number, topY: number): void {
    // Volume slider interaction
    const volY = topY + 165;
    const volLeft = cx - 120;
    const volW = 240;
    if (Math.abs(y - volY) < 14 && x >= volLeft && x <= volLeft + volW) {
      const percent = Math.round(Math.max(0, Math.min(100, ((x - volLeft) / volW) * 100)));
      this.volumeState.level = percent;
      if (window.roboIsland) window.roboIsland.setVolume(percent);
      return;
    }

    // Mute toggle (speaker icon at cx - 140)
    if (Math.hypot(x - (cx - 140), y - volY) < 16) {
      this.volumeState.muted = !this.volumeState.muted;
      if (window.roboIsland) window.roboIsland.setMute(this.volumeState.muted);
      return;
    }
  }

  private handleAiClick(x: number, y: number, cx: number, topY: number): void {
    if (this.aiState.pendingPermission) {
      const btnY = topY + 185;
      // Approve
      if (Math.abs(x - (cx - 60)) < 45 && Math.abs(y - btnY) < 16) {
        window.roboIsland?.aiApprove(this.aiState.pendingPermission.sessionId, true);
        this.aiState.pendingPermission = null;
        this.mascot.sounds.playSuccess();
        return;
      }
      // Deny
      if (Math.abs(x - (cx + 60)) < 45 && Math.abs(y - btnY) < 16) {
        window.roboIsland?.aiApprove(this.aiState.pendingPermission.sessionId, false);
        this.aiState.pendingPermission = null;
        this.mascot.sounds.playAlert();
        return;
      }
    }
  }

  private handleFocusClick(x: number, y: number, cx: number, topY: number): void {
    const btnY = topY + 185;
    if (Math.abs(x - cx) < 65 && Math.abs(y - btnY) < 20) {
      this.focusState.active = !this.focusState.active;
      this.mascot.sounds.playChirp();
    }
  }

  public renderLoop(time: number): void {
    if (this.isGameModeThrottled) {
      this._isRenderingActive = false;
      return;
    }

    // Lock max render rate to 60 FPS to prevent 120Hz/144Hz/240Hz monitors from wasting GPU/CPU
    if (this._lastRenderTimestamp && time - this._lastRenderTimestamp < 15.5) {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(this.renderLoop);
      }
      return;
    }
    this._lastRenderTimestamp = time;

    // Activity evaluation for smart resting idle & dirty check
    const isTransitioning = (
      Math.abs(this.currentWidth - this.targetWidth) >= 0.25 ||
      Math.abs(this.currentHeight - this.targetHeight) >= 0.25 ||
      Math.abs(this.currentRadius - this.targetRadius) >= 0.25 ||
      Math.abs(this.islandSpring.vWidth) >= 0.4 ||
      Math.abs(this.islandSpring.vHeight) >= 0.4
    );
    // Prune expired jelly kicks (1200ms decay window)
    if (this.kicks && this.kicks.length > 0) {
      const nowMs = performance.now();
      this.kicks = this.kicks.filter(k => nowMs - k.at < 1200);
    }
    const isJellyActive = Boolean(this.kicks && this.kicks.length > 0);
    const isMediaActive = Boolean(this.mediaState.playing && this.mediaState.active);
    const isHudActive = (
      (this.volumeHudUntil > 0 && performance.now() < this.volumeHudUntil) ||
      (this.speedometerHudUntil > 0 && performance.now() < this.speedometerHudUntil) ||
      (this.bluetoothHudUntil > 0 && performance.now() < this.bluetoothHudUntil) ||
      this.isVoiceCompanionActive() ||
      (this.chargerSurgeUntil > 0 && performance.now() < this.chargerSurgeUntil) ||
      (this.airdropHudUntil > 0 && performance.now() < this.airdropHudUntil) ||
      (this.greetingUntil > 0 && performance.now() < this.greetingUntil) ||
      (this.appActivityUntil > 0 && performance.now() < this.appActivityUntil) ||
      this.isNotificationActive() ||
      this.isStartupHelloBusy
    );
    const isMascotGazeActive = (
      Math.abs(this.mascot.targetGazeX - this.mascot.lookX) >= 0.006 ||
      Math.abs(this.mascot.targetGazeY - this.mascot.lookY) >= 0.006
    );
    const isMascotActive = (
      this.mascot.isJumping ||
      this.mascot.isBlinking ||
      this.mascot.blinkProgress > 0 ||
      isMascotGazeActive ||
      Math.abs(this.mascot.wobbleVelocity) >= 0.08 ||
      (this.mascot.particles && this.mascot.particles.particles.length > 0) ||
      this.mascot.dizzyDuration > 0
    );
    const isInteracting = this.isHovered || this.isDraggingOver || this.isWhatsAppReplying || (this.transferProgress !== null);
    const isTuckAnimating = this.isTucked && (performance.now() - this.tuckChangedAt < 250);

    const isBusy = isTransitioning || isJellyActive || isMediaActive || isHudActive || isMascotActive || isInteracting || isTuckAnimating || (this.mode === 'expanded' && this.config.expandedUiMode === 'canvas');

    // Runtime CPU/GPU Optimization: Idle Rest (drops background CPU consumption to 0.0%)
    const isIdleRest = (
      (this.mode === 'rest' || this.mode === 'compact') &&
      !this.isHovered &&
      !this.mediaState.playing &&
      !this.isNotificationActive() &&
      !this.isVoiceCompanionActive() &&
      performance.now() > this.greetingUntil &&
      performance.now() > this.volumeHudUntil &&
      performance.now() > this.speedometerHudUntil &&
      performance.now() > this.bluetoothHudUntil &&
      performance.now() > this.chargerSurgeUntil &&
      performance.now() > this.airdropHudUntil &&
      Math.abs(this.currentWidth - this.targetWidth) < 0.3 &&
      Math.abs(this.islandSpring.vWidth) < 0.3
    );

    if (isIdleRest) {
      if (time - this._lastIdleRestFrame < 33) {
        if (!isBusy && this._hasRenderedSettledFrame) {
          this._isRenderingActive = false;
          if (!this._idleWakeupTimer) {
            const nextBlink = Math.max(4000, (this.mascot.nextBlinkTimer && this.mascot.nextBlinkTimer > 0.5 ? this.mascot.nextBlinkTimer : 4.5 + Math.random() * 3.5) * 1000);
            this._idleWakeupTimer = setTimeout(() => {
              this._idleWakeupTimer = null;
              if (this.mascot && typeof this.mascot.triggerBlink === 'function') {
                this.mascot.triggerBlink();
              }
              this.requestRender();
            }, nextBlink);
          }
          return;
        }
      }
      this._lastIdleRestFrame = time;
    }

    const dt = Math.min(0.1, (time - this.lastTime) / 1000);
    this.lastTime = time;

    // TwoCode 240Hz sub-stepping Runge-Kutta / Euler integration spring (mascot.html lines 1110-1138)
    const now = performance.now();
    const springDt = this.islandSpring.last ? Math.min(1 / 20, Math.max(0, (now - this.islandSpring.last) / 1000)) : 1 / 60;
    this.islandSpring.last = now;

    const growing = (this.targetWidth * this.targetHeight > this.currentWidth * this.currentHeight);
    const speed = 1.0;
    const response = (growing ? 0.42 : 0.34) * speed;
    const damping = growing ? 0.86 : 1.0;
    const stiffness = Math.pow(2 * Math.PI / response, 2);
    const friction = 4 * Math.PI * damping / response;
    const steps = Math.max(1, Math.ceil(springDt / (1 / 240)));
    const h = springDt / steps;

    for (let i = 0; i < steps; i++) {
      this.islandSpring.vWidth += (-stiffness * (this.currentWidth - this.targetWidth) - friction * this.islandSpring.vWidth) * h;
      this.currentWidth += this.islandSpring.vWidth * h;

      this.islandSpring.vHeight += (-stiffness * (this.currentHeight - this.targetHeight) - friction * this.islandSpring.vHeight) * h;
      this.currentHeight += this.islandSpring.vHeight * h;

      this.islandSpring.vRadius += (-stiffness * (this.currentRadius - this.targetRadius) - friction * this.islandSpring.vRadius) * h;
      this.currentRadius += this.islandSpring.vRadius * h;
    }

    if (Math.abs(this.currentWidth - this.targetWidth) < 0.3 && Math.abs(this.islandSpring.vWidth) < 3) {
      this.currentWidth = this.targetWidth;
      this.islandSpring.vWidth = 0;
    }
    if (Math.abs(this.currentHeight - this.targetHeight) < 0.3 && Math.abs(this.islandSpring.vHeight) < 3) {
      this.currentHeight = this.targetHeight;
      this.islandSpring.vHeight = 0;
    }
    if (Math.abs(this.currentRadius - this.targetRadius) < 0.3 && Math.abs(this.islandSpring.vRadius) < 3) {
      this.currentRadius = this.targetRadius;
      this.islandSpring.vRadius = 0;
    }

    // Real-time synchronization of exact visible capsule bounds to Electron main process
    const roundedW = Math.round(this.mode === 'expanded' ? Math.max(this.targetWidth, this.currentWidth) : this.currentWidth);
    const roundedH = Math.round(this.mode === 'expanded' ? Math.max(this.targetHeight, this.currentHeight) : this.currentHeight);
    if (roundedW !== this.lastSentBoundsW || roundedH !== this.lastSentBoundsH) {
      this.lastSentBoundsW = roundedW;
      this.lastSentBoundsH = roundedH;
      this.reportCapsuleBounds();
    }

    // Smooth album ambient tint color transition (RGB lerp)
    this.currentTintR += (this.targetTintR - this.currentTintR) * 0.12;
    this.currentTintG += (this.targetTintG - this.currentTintG) * 0.12;
    this.currentTintB += (this.targetTintB - this.currentTintB) * 0.12;

    // Push album tint into CSS custom properties only when RGB values change and expanded overlay is visible (prevents per-frame DOM style recalc)
    const tr = Math.round(this.currentTintR);
    const tg = Math.round(this.currentTintG);
    const tb = Math.round(this.currentTintB);
    if (this.mode === 'expanded' && (tr !== this.lastPushedTintR || tg !== this.lastPushedTintG || tb !== this.lastPushedTintB)) {
      this.lastPushedTintR = tr;
      this.lastPushedTintG = tg;
      this.lastPushedTintB = tb;
      document.documentElement.style.setProperty('--album-tint-r', String(tr));
      document.documentElement.style.setProperty('--album-tint-g', String(tg));
      document.documentElement.style.setProperty('--album-tint-b', String(tb));
      document.documentElement.style.setProperty('--album-tint-rgb', `${tr}, ${tg}, ${tb}`);
    }

    // Update dynamic reactive textures (TwoCode parity)
    TextureEngine.getInstance().update(this.config?.lastCpuPercent || 25, this.config?.lastRamPercent || 45);

    // Feature B: Auto-relax charger surge pop after duration expires
    if (this.chargerSurgeUntil > 0 && performance.now() >= this.chargerSurgeUntil) {
      this.chargerSurgeUntil = 0;
      this.updateTargetDimensions();
    }

    // Apple-style Hardware Volume Pop: Auto-relax after duration expires
    if (this.volumeHudUntil > 0 && performance.now() >= this.volumeHudUntil) {
      this.volumeHudUntil = 0;
      this.updateTargetDimensions();
    }

    // Apple-style AirDrop HUD: Auto-relax after duration expires
    if (this.airdropHudUntil > 0 && performance.now() >= this.airdropHudUntil) {
      if (!this.isHovered) {
        this.airdropHudUntil = 0;
        this.updateTargetDimensions();
      }
    }

    // Apple-style Hardware Speedometer HUD: Auto-relax after duration expires
    if (this.speedometerHudUntil > 0 && performance.now() >= this.speedometerHudUntil) {
      if (!this.isHovered) {
        this.speedometerHudUntil = 0;
        this.updateTargetDimensions();
      }
    }

    // Apple-style AirPods / Bluetooth Battery & Device HUD: Auto-relax after duration expires
    if (this.bluetoothHudUntil > 0 && performance.now() >= this.bluetoothHudUntil) {
      if (!this.isHovered) {
        this.bluetoothHudUntil = 0;
        this.updateTargetDimensions();
      }
    }

    // Hands-Free Voice Companion Mode: Auto-relax when duration expires and not listening/speaking
    if (this.voiceHudUntil > 0 && performance.now() >= this.voiceHudUntil && !this.isVoiceCompanionActive()) {
      this.voiceHudUntil = 0;
      this.updateTargetDimensions();
    }

    // Apple macOS / iOS Dynamic Time-of-Day Greeting Pill: Auto-relax to rest/compact dimensions when expired
    if (this.greetingUntil > 0 && performance.now() >= this.greetingUntil) {
      this.dismissGreeting();
    }

    // Apple Live Activity Smart Status: Auto-relax when expired
    if (this.appActivityUntil > 0 && performance.now() >= this.appActivityUntil) {
      this.appActivityUntil = 0;
      this.activeAppActivity = null;
      this.updateTargetDimensions();
    }

    // Interpolate live playback position
    if (this.mediaState.playing && this.mediaState.durationMs > 0) {
      const elapsed = performance.now() - this.lastMediaSampleTime;
      this.mediaState.positionMs = Math.min(this.mediaState.durationMs, this.basePositionMs + elapsed);

      // Update live synchronized lyrics state machine (lyrics-ui.js lines 48-67)
      this.tickLyrics();
    }

    // Clear Canvas
    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Render Pill Background
    this.drawIslandPill();

    const cx = window.innerWidth / 2;
    const topY = this.getTopY();

    // Position WhatsApp Quick Reply overlay input over pill
    const waBar = document.getElementById('whatsapp-quick-reply-bar');
    if (waBar) {
      if (this.isWhatsAppReplying && this.isNotificationActive() && !this.whatsAppReplySent) {
        const pillLeft = cx - this.currentWidth / 2;
        waBar.style.left = `${Math.round(pillLeft + 12)}px`;
        waBar.style.top = `${Math.round(topY + 34)}px`;
        waBar.style.width = `${Math.round(this.currentWidth - 24)}px`;
        const isVn = this.isWhatsAppVoiceNoteActive();
        const chipsContainer = document.getElementById('whatsapp-smart-reply-chips');
        const hasChips = Boolean(chipsContainer && chipsContainer.children && chipsContainer.children.length > 0);
        let barHeight = 64;
        if (isVn) {
          barHeight = 172;
        } else if (hasChips) {
          barHeight = 96;
        } else {
          barHeight = 64;
        }
        waBar.style.height = `${barHeight}px`;
        if (waBar.classList.contains('hidden')) waBar.classList.remove('hidden');
      } else if (!waBar.classList.contains('hidden')) {
        waBar.classList.add('hidden');
      }
    }

    // Compact idle state detection for motion stabilization (stops idle bobbing & vertical jitter)
    this.mascot.isCompactIdle = ((this.mode === 'compact' || this.mode === 'rest') && !this.mediaState.active && !this.focusState.active && this.aiState.status !== 'running');
    if (this.mascot.isCompactIdle) {
      if (this.mascot.getMood() === 'focused') {
        this.mascot.setMood('neutral');
      } else if (this.greetingUntil <= 0 && this.mascot.getMood() === 'happy' && !this.isNotificationActive()) {
        this.mascot.setMood('neutral');
      }
    }

    // Mascot state update: in expanded mode, bind to the dedicated #mascot-eye-slot position, otherwise dead-center in capsule
    let mascotCx = cx;
    let mascotCy = topY + 13;
    if (this.mode === 'expanded') {
      const eyeSlot = this._mascotEyeSlotEl || (this._mascotEyeSlotEl = document.getElementById('mascot-eye-slot'));
      if (eyeSlot && eyeSlot.offsetParent !== null) {
        const rect = eyeSlot.getBoundingClientRect();
        mascotCx = rect.left + rect.width / 2;
        mascotCy = rect.top + rect.height / 2;
      }
    }
    this.mascot.update(dt, this.pointerX, this.pointerY, mascotCx, mascotCy);

    // Real-time audio reactive equalizer update (TwoCode Parity)
    const isMusicPlaying = Boolean(this.mediaState.playing && this.mediaState.active);
    SystemAudioVisualizer.getInstance().update(isMusicPlaying);

    // Render Content based on mode
    if (this.isTucked) {
      if (this.domOverlayEl) this.domOverlayEl.classList.add('hidden');
      if (isBusy) {
        this._isRenderingActive = true;
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(this.renderLoop);
        }
      } else {
        this._hasRenderedSettledFrame = true;
        this._isRenderingActive = false;
      }
      return;
    } else if (this.mode === 'rest') {
      if (this.domOverlayEl) this.domOverlayEl.classList.add('hidden');
      if (this.isVoiceCompanionActive()) {
        this.drawVoiceCompanionWave(cx, topY);
      } else if (performance.now() < this.airdropHudUntil) {
        this.drawAirDropHudContent(cx, topY);
      } else if (performance.now() < this.speedometerHudUntil) {
        this.drawSpeedometerHudContent(cx, topY);
      } else if (performance.now() < this.bluetoothHudUntil) {
        this.drawBluetoothHudContent(cx, topY);
      } else if (performance.now() < this.volumeHudUntil) {
        this.drawVolumeHudContent(cx, topY);
      } else if (performance.now() < this.chargerSurgeUntil) {
        this.drawChargerSurgeContent(cx, topY);
      } else if (performance.now() < this.greetingUntil) {
        this.drawGreetingPill(cx, topY);
      } else {
        this.drawRestContent(cx, topY);
      }
    } else if (this.mode === 'compact') {
      if (this.domOverlayEl) this.domOverlayEl.classList.add('hidden');
      this.drawCompactContent(cx, topY);
    } else {
      if (this.config.expandedUiMode === 'canvas') {
        if (this.domOverlayEl) this.domOverlayEl.classList.add('hidden');
        this.drawExpandedContent(cx, topY);
      } else {
        if (this.domOverlayEl) {
          this.domOverlayEl.classList.remove('hidden');
          this.updateDomOverlay(cx, topY);
          this.updateAmbientGlow(this.currentDomTab);
        }
        // In DOM mode, draw capsule eyes strictly inside the dedicated #mascot-eye-slot element
        const eyeSlot = this._mascotEyeSlotEl || (this._mascotEyeSlotEl = document.getElementById('mascot-eye-slot'));
        if (eyeSlot && eyeSlot.offsetParent !== null) {
          const rect = eyeSlot.getBoundingClientRect();
          const eyeX = rect.left + rect.width / 2;
          const eyeY = rect.top + rect.height / 2;
          this.mascot.drawFloatingEyes(this.ctx, eyeX, eyeY, 0.85);
        } else {
          this.mascot.drawFloatingEyes(this.ctx, cx - 140, topY + 18, 0.85);
        }
      }
    }

    if (isBusy) {
      this._hasRenderedSettledFrame = false;
      this._isRenderingActive = true;
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(this.renderLoop);
      }
    } else {
      this._hasRenderedSettledFrame = true;
      this._isRenderingActive = false;
      if (!this._idleWakeupTimer) {
        const nextBlink = Math.max(4000, (this.mascot.nextBlinkTimer && this.mascot.nextBlinkTimer > 0.5 ? this.mascot.nextBlinkTimer : 4.5 + Math.random() * 3.5) * 1000);
        this._idleWakeupTimer = setTimeout(() => {
          this._idleWakeupTimer = null;
          if (this.mascot && typeof this.mascot.triggerBlink === 'function') {
            this.mascot.triggerBlink();
          }
          this.requestRender();
        }, nextBlink);
      }
    }
  }

  // Battery power state: Always maintain 60fps / native refresh rate with zero frame drops
  private _updatePowerSavingMode(_battery: any): void {
    this._isPowerSaving = false;
    this._powerSavingFrameInterval = 0;
  }

  private drawIslandPill(): void {
    const cx = window.innerWidth / 2;
    const topY = this.getTopY();
    const isSurgeActive = performance.now() < this.chargerSurgeUntil;
    const isVolumeHudActive = performance.now() < this.volumeHudUntil;
    const isSpeedometerHudActive = performance.now() < this.speedometerHudUntil;
    const isAirDropHudActive = performance.now() < this.airdropHudUntil;
    const isFloating = this.config?.islandStyle === 'floating';

    // TwoCode tuck-ui.js lines 58-63: micro-line at screen bezel with fade-in and status glow
    if (this.isTucked) {
      const k = Math.min(1, (performance.now() - this.tuckChangedAt) / 220);
      const w = 56 * (0.4 + 0.6 * k);
      const color = this.aiState.status === 'running'
        ? '#ff9a1f'
        : this.aiState.status === 'done'
        ? '#22e05a'
        : this.mediaState.playing
        ? '#ffffff'
        : '#ffffff';

      this.ctx.save();
      this.ctx.globalAlpha = 0.7 + 0.3 * k;
      this.ctx.fillStyle = color;
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 10;
      this.ctx.beginPath();
      this.ctx.roundRect(cx - w / 2, 2, w, 4, 2);
      this.ctx.fill();
      this.ctx.restore();
      return;
    }

    // Feature C: Split-Island Dual Bubble for Focus Mode [ Pill ] ( ○ )
    if (this.isSplitIslandActive()) {
      const h = this.currentHeight;
      const r = Math.min(this.currentRadius, h / 2);
      const bubbleSize = h;
      const gap = 8;
      const mainWidth = this.currentWidth;
      const totalSpan = mainWidth + gap + bubbleSize;
      const pillLeft = cx - totalSpan / 2;
      const bubbleCx = pillLeft + mainWidth + gap + bubbleSize / 2;
      const bubbleCy = topY + h / 2;
      const bubbleR = bubbleSize / 2;
      const isMusicActive = Boolean(this.mediaState.active && this.mediaState.title);

      this.ctx.save();
      // Apple-grade ambient drop shadow
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.40)';
      this.ctx.shadowBlur = 14;
      this.ctx.shadowOffsetY = 3;

      // TwoCode double-pass frosted glass: first pass under shadow, second pass crisp on top
      const seeThrough = (this.config as any)?.islandAlpha ?? 0.96;
      const black = seeThrough >= 1 ? '#000000' : `rgba(0,0,0,${(1 - Math.sqrt(1 - Math.min(0.999, seeThrough))).toFixed(3)})`;

      this.islandPath(this.ctx, pillLeft, topY, mainWidth, h, r);
      this.ctx.moveTo(bubbleCx + bubbleR, bubbleCy);
      this.ctx.arc(bubbleCx, bubbleCy, bubbleR, 0, Math.PI * 2);
      this.ctx.fillStyle = black;
      this.ctx.fill();
      this.ctx.restore();

      this.islandPath(this.ctx, pillLeft, topY, mainWidth, h, r);
      this.ctx.moveTo(bubbleCx + bubbleR, bubbleCy);
      this.ctx.arc(bubbleCx, bubbleCy, bubbleR, 0, Math.PI * 2);
      this.ctx.fillStyle = black;
      this.ctx.fill();

      // Bottom-rising dynamic album gradient glow inside primary pill (TwoCode spotify-ui.js lines 58-60)
      if (isMusicActive) {
        const tr = Math.round(this.currentTintR);
        const tg = Math.round(this.currentTintG);
        const tb = Math.round(this.currentTintB);
        this.ctx.save();
        this.islandPath(this.ctx, pillLeft, topY, mainWidth, h, r);
        this.ctx.clip();
        const fold = h < 60;
        const tintGrad = this.ctx.createLinearGradient(0, fold ? topY : topY + h * 0.18, 0, topY + h);
        tintGrad.addColorStop(0, `rgba(${tr}, ${tg}, ${tb}, ${fold ? 0.08 : 0})`);
        tintGrad.addColorStop(0.5, `rgba(${tr}, ${tg}, ${tb}, ${fold ? 0.18 : 0.12})`);
        tintGrad.addColorStop(1, `rgba(${tr}, ${tg}, ${tb}, 0.38)`);
        this.ctx.fillStyle = tintGrad;
        this.ctx.fillRect(pillLeft - 20, topY, mainWidth + 40, h);
        this.ctx.restore();
      }

      // Specular glass sheen and color-matched rim strokes
      this.ctx.shadowColor = 'transparent';
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(0, isFloating ? 0 : 3, window.innerWidth, window.innerHeight);
      this.ctx.clip();

      // 1. Primary Pill: Dynamic Album-Tinted Rim Gradient (exact parity with single mode)
      this.islandPath(this.ctx, pillLeft + 0.5, topY, mainWidth - 1, h - 0.5, r);
      this.ctx.lineWidth = 1.0;
      if (isMusicActive) {
        const tr = Math.round(this.currentTintR);
        const tg = Math.round(this.currentTintG);
        const tb = Math.round(this.currentTintB);
        const rimGrad = this.ctx.createLinearGradient(0, topY, 0, topY + h);
        rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
        rimGrad.addColorStop(0.5, `rgba(${tr}, ${tg}, ${tb}, 0.25)`);
        rimGrad.addColorStop(1, `rgba(${tr}, ${tg}, ${tb}, 0.70)`);
        this.ctx.strokeStyle = rimGrad;
      } else {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      }
      this.ctx.stroke();

      // 2. Secondary Circular Bubble: Cyan for downloads or violet for focus
      this.ctx.beginPath();
      this.ctx.arc(bubbleCx, bubbleCy, bubbleR - 0.5, 0, Math.PI * 2);
      this.ctx.strokeStyle = this.activeDownloadsList.length > 0 ? 'rgba(0, 210, 255, 0.40)' : 'rgba(191, 90, 242, 0.35)';
      this.ctx.stroke();
      this.ctx.restore();

      this.ctx.restore();
      return;
    }

    const tNow = performance.now();
    let jelly = 0;
    for (const k of this.kicks) {
      const ms = tNow - k.at;
      if (ms >= 0 && ms < 1500) {
        jelly += k.amp * Math.exp(-k.damp * ms / 1000) * Math.sin(2 * Math.PI * k.hz * ms / 1000);
      }
    }
    const visualW = Math.max(30, this.currentWidth * (1 + jelly));
    const visualH = Math.max(4, this.currentHeight * (1 - jelly * 1.4));
    const left = cx - visualW / 2;
    const w = visualW;
    const h = visualH;
    const r = Math.min(this.currentRadius, h / 2);
    const isMusicActive = this.mode === 'compact' && !this.isTucked && !isSurgeActive && !this.isNotificationActive() && Boolean(this.mediaState.active && this.mediaState.title);

    this.ctx.save();

    // Shadow & Glow (TwoCode obsidian dock calibration: rgba(0, 0, 0, 0.28), blur=14, offsetY=3)
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    this.ctx.shadowBlur = this.mode === 'expanded' ? 24 : 14;
    this.ctx.shadowOffsetY = 3;

    // Glowing aura if Notification active, AI is running or Charger Surge active, OR dynamic album backlight tint
    if (this.isNotificationActive()) {
      const tint = this.getNotificationColor(this.activeNotification?.kind);
      this.ctx.shadowColor = tint;
      this.ctx.shadowBlur = 22;
      this.ctx.shadowOffsetY = 3;
    } else if (this.aiState.status === 'running') {
      this.ctx.shadowColor = 'rgba(255, 140, 0, 0.65)';
      this.ctx.shadowBlur = 24;
    } else if (isAirDropHudActive) {
      this.ctx.shadowColor = this.airdropHudType === 'sent' ? 'rgba(0, 210, 255, 0.45)' : 'rgba(48, 209, 88, 0.45)';
      this.ctx.shadowBlur = 20;
    } else if (this.transferProgress !== null && Date.now() < this.transferProgressUntil) {
      this.ctx.shadowColor = 'rgba(0, 210, 255, 0.55)';
      this.ctx.shadowBlur = 22;
    } else if (isSpeedometerHudActive) {
      this.ctx.shadowColor = 'rgba(0, 210, 255, 0.28)';
      this.ctx.shadowBlur = 18;
    } else if (isVolumeHudActive) {
      this.ctx.shadowColor = 'rgba(255, 255, 255, 0.22)';
      this.ctx.shadowBlur = 16;
    } else if (isSurgeActive && this.chargerSurgeCharging) {
      this.ctx.shadowColor = 'rgba(52, 199, 89, 0.75)';
      this.ctx.shadowBlur = 22;
      this.ctx.shadowOffsetY = 1;
    } else if (isMusicActive) {
      // In TwoCode, music maintains an obsidian dark drop shadow, not a harsh neon cloud
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
      this.ctx.shadowBlur = 14;
      this.ctx.shadowOffsetY = 3;
    }

    // Environmental Reactive Texture (Fire & Ice, Spider Web, Overgrown parity with TwoCode texture-ui.js)
    TextureEngine.getInstance().renderBehind(this.ctx, left, topY, w, h, r);

    // TwoCode double-pass frosted glass: first pass under shadow, second pass crisp on top
    const seeThrough = (this.config as any)?.islandAlpha ?? 0.96;
    const black = seeThrough >= 1 ? '#000000' : `rgba(0,0,0,${(1 - Math.sqrt(1 - Math.min(0.999, seeThrough))).toFixed(3)})`;

    this.islandPath(this.ctx, left, topY, w, h, r);
    this.ctx.fillStyle = black;
    this.ctx.fill();
    this.ctx.restore();

    this.islandPath(this.ctx, left, topY, w, h, r);
    this.ctx.fillStyle = black;
    this.ctx.fill();

    // Bottom-rising dynamic album gradient glow inside the pill (Directly from TwoCode spotify-ui.js lines 58-60)
    if (this.isNotificationActive()) {
      // Dynamic Notification App Ambient Tint Gradient (Direct parity with Spotify album styling)
      const { r: nr, g: ng, b: nb } = this.getNotificationRgb(this.activeNotification?.kind, this.activeNotification?.status);
      this.ctx.save();
      this.islandPath(this.ctx, left, topY, w, h, r);
      this.ctx.clip();
      const fold = h < 60;
      const tintGrad = this.ctx.createLinearGradient(0, fold ? topY : topY + h * 0.18, 0, topY + h);
      tintGrad.addColorStop(0, `rgba(${nr}, ${ng}, ${nb}, ${fold ? 0.08 : 0})`);
      tintGrad.addColorStop(0.5, `rgba(${nr}, ${ng}, ${nb}, ${fold ? 0.18 : 0.12})`);
      tintGrad.addColorStop(1, `rgba(${nr}, ${ng}, ${nb}, 0.36)`);
      this.ctx.fillStyle = tintGrad;
      this.ctx.fillRect(left - 20, topY, w + 40, h);
      this.ctx.restore();
    } else if (isSurgeActive && this.chargerSurgeCharging) {
      // iOS Fluid MagSafe Emerald Ambient Glow inside Dynamic Island
      this.ctx.save();
      this.islandPath(this.ctx, left, topY, w, h, r);
      this.ctx.clip();
      const tintGrad = this.ctx.createLinearGradient(0, topY, 0, topY + h);
      tintGrad.addColorStop(0, 'rgba(52, 199, 89, 0.06)');
      tintGrad.addColorStop(0.5, 'rgba(48, 209, 88, 0.18)');
      tintGrad.addColorStop(1, 'rgba(52, 199, 89, 0.36)');
      this.ctx.fillStyle = tintGrad;
      this.ctx.fillRect(left - 20, topY, w + 40, h);
      this.ctx.restore();
    } else if (isMusicActive) {
      const tr = Math.round(this.currentTintR);
      const tg = Math.round(this.currentTintG);
      const tb = Math.round(this.currentTintB);
      const gradKey = `${topY}|${h}|${tr}|${tg}|${tb}`;
      if (gradKey !== this._cachedMusicTintKey || !this._cachedMusicTintGrad) {
        this._cachedMusicTintKey = gradKey;
        const fold = h < 60;
        const tintGrad = this.ctx.createLinearGradient(0, fold ? topY : topY + h * 0.18, 0, topY + h);
        tintGrad.addColorStop(0, `rgba(${tr}, ${tg}, ${tb}, ${fold ? 0.08 : 0})`);
        tintGrad.addColorStop(0.5, `rgba(${tr}, ${tg}, ${tb}, ${fold ? 0.18 : 0.12})`);
        tintGrad.addColorStop(1, `rgba(${tr}, ${tg}, ${tb}, 0.38)`);
        this._cachedMusicTintGrad = tintGrad;
      }
      this.ctx.save();
      this.islandPath(this.ctx, left, topY, w, h, r);
      this.ctx.clip();
      this.ctx.fillStyle = this._cachedMusicTintGrad;
      this.ctx.fillRect(left - 20, topY, w + 40, h);
      this.ctx.restore();
    }

    // Subtle Rim Stroke (Clipped to y >= 3 so top bezel has zero stroke, exactly matching TwoCode mascot.html:2154-2159)
    this.ctx.save();
    this.ctx.shadowColor = 'transparent';
    this.ctx.beginPath();
    this.ctx.rect(0, isFloating ? 0 : 3, window.innerWidth, window.innerHeight);
    this.ctx.clip();

    this.islandPath(this.ctx, left + 0.5, topY, w - 1, h - 0.5, r);
    this.ctx.lineWidth = 1.0;
    if (this.isNotificationActive()) {
      const { r: nr, g: ng, b: nb } = this.getNotificationRgb(this.activeNotification?.kind, this.activeNotification?.status);
      const rimGrad = this.ctx.createLinearGradient(0, topY, 0, topY + h);
      rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
      rimGrad.addColorStop(0.5, `rgba(${nr}, ${ng}, ${nb}, 0.45)`);
      rimGrad.addColorStop(1, `rgba(${nr}, ${ng}, ${nb}, 0.75)`);
      this.ctx.strokeStyle = rimGrad;
      this.ctx.lineWidth = 1.6;
    } else if (isAirDropHudActive) {
      this.ctx.strokeStyle = this.airdropHudType === 'sent' ? 'rgba(0, 210, 255, 0.55)' : 'rgba(48, 209, 88, 0.55)';
      this.ctx.lineWidth = 1.4;
    } else if (this.transferProgress !== null && Date.now() < this.transferProgressUntil) {
      this.ctx.strokeStyle = 'rgba(0, 210, 255, 0.75)';
      this.ctx.lineWidth = 1.6;
    } else if (this.aiState.status === 'running') {
      this.ctx.strokeStyle = 'rgba(255, 140, 0, 0.7)';
    } else if (isSpeedometerHudActive) {
      this.ctx.strokeStyle = 'rgba(0, 210, 255, 0.35)';
      this.ctx.lineWidth = 1.2;
    } else if (isVolumeHudActive) {
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      this.ctx.lineWidth = 1.2;
    } else if (isSurgeActive && this.chargerSurgeCharging) {
      const rimGrad = this.ctx.createLinearGradient(left, topY, left + w, topY + h);
      rimGrad.addColorStop(0, 'rgba(52, 199, 89, 0.90)');
      rimGrad.addColorStop(0.5, 'rgba(48, 209, 88, 0.40)');
      rimGrad.addColorStop(1, 'rgba(52, 199, 89, 0.90)');
      this.ctx.strokeStyle = rimGrad;
      this.ctx.lineWidth = 1.8;
    } else if (isMusicActive) {
      const tr = Math.round(this.currentTintR);
      const tg = Math.round(this.currentTintG);
      const tb = Math.round(this.currentTintB);
      const rimKey = `${topY}|${h}|${tr}|${tg}|${tb}`;
      if (rimKey !== this._cachedMusicRimKey || !this._cachedMusicRimGrad) {
        this._cachedMusicRimKey = rimKey;
        const rimGrad = this.ctx.createLinearGradient(0, topY, 0, topY + h);
        rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
        rimGrad.addColorStop(0.5, `rgba(${tr}, ${tg}, ${tb}, 0.25)`);
        rimGrad.addColorStop(1, `rgba(${tr}, ${tg}, ${tb}, 0.70)`);
        this._cachedMusicRimGrad = rimGrad;
      }
      this.ctx.strokeStyle = this._cachedMusicRimGrad;
    } else {
      this.ctx.strokeStyle = this.mode === 'rest' ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 255, 255, 0.08)';
    }
    this.ctx.stroke();
    this.ctx.restore();

    // Live AirDrop / LAN Drop Transfer Beam (Progress bar along bottom edge)
    if (this.transferProgress !== null && Date.now() < this.transferProgressUntil) {
      const pct = Math.max(0, Math.min(100, this.transferProgress)) / 100;
      this.ctx.save();
      this.ctx.fillStyle = '#00d2ff';
      this.ctx.shadowColor = '#00d2ff';
      this.ctx.shadowBlur = 10;
      this.ctx.beginPath();
      this.ctx.roundRect(left + r, topY + h - 3, (w - 2 * r) * pct, 2, 1);
      this.ctx.fill();
      this.ctx.restore();
    }

    this.ctx.restore();
  }

  public drawNotificationContent(pillLeft: number, midY: number, topY: number): void {
    if (!this.activeNotification) return;
    this.notificationHits = {};
    const n = this.activeNotification;
    const W = this.currentWidth;
    const cy = midY;
    const left = pillLeft + 14;
    const right = pillLeft + W - 14;
    const color = this.getNotificationColor(n.kind, n.status);

    // =========================================================================
    // 1. WhatsApp Dynamic Island Quick Reply Box (Apple iPhone / Mac Style)
    // =========================================================================
    if (this.isWhatsAppReplying) {
      const headCy = topY + 18;
      const badgeR = 8;
      const badgeCx = left + 8;

      this.ctx.save();
      // WhatsApp Apple Squircle mini icon
      this.drawAppleAppIcon(badgeCx, headCy, badgeR, 'whatsapp');

      // Contact / Group Title
      const wa = this.parseWhatsAppDetails(n.title, n.body);
      const fallbackTarget = wa.isGroup ? (wa.groupName || wa.senderName) : wa.senderName;
      const target = this.whatsAppReplyContext?.contact || fallbackTarget;
      this.ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      const maxHeadW = right - (badgeCx + badgeR + 10) - 24;
      const truncSender = this.truncateText(`Reply to ${target}`, maxHeadW, this.ctx.font);
      this.ctx.fillText(truncSender, badgeCx + badgeR + 8, headCy);

      // Close button
      const closeSize = 18;
      const closeX = right - closeSize;
      const closeY = headCy - closeSize / 2;
      const isCloseHovered = this.isHovered && this.isInsideHit(this.pointerX, this.pointerY, { x: closeX, y: closeY, width: closeSize, height: closeSize });

      this.ctx.beginPath();
      this.ctx.arc(closeX + closeSize / 2, headCy, closeSize / 2, 0, Math.PI * 2);
      this.ctx.fillStyle = isCloseHovered ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)';
      this.ctx.fill();

      this.ctx.strokeStyle = isCloseHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.6)';
      this.ctx.lineWidth = 1.3;
      this.ctx.lineCap = 'round';
      const crossR = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(closeX + closeSize / 2 - crossR, headCy - crossR);
      this.ctx.lineTo(closeX + closeSize / 2 + crossR, headCy + crossR);
      this.ctx.moveTo(closeX + closeSize / 2 + crossR, headCy - crossR);
      this.ctx.lineTo(closeX + closeSize / 2 - crossR, headCy + crossR);
      this.ctx.stroke();
      this.notificationHits['cDismiss'] = { x: closeX, y: closeY, width: closeSize, height: closeSize };

      // Row 2: Input Box
      const boxX = left;
      const boxY = topY + 36;
      const boxW = W - 28;
      const boxH = 28;
      const boxR = 14;

      this.ctx.beginPath();
      this.ctx.roundRect(boxX, boxY, boxW, boxH, boxR);
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      this.ctx.fill();
      this.ctx.strokeStyle = this.whatsAppReplySent ? 'rgba(34, 224, 90, 0.7)' : 'rgba(37, 211, 102, 0.45)';
      this.ctx.lineWidth = 1.2;
      this.ctx.stroke();

      if (this.whatsAppReplySent) {
        // Sent confirmation
        this.ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
        this.ctx.fillStyle = '#22e05a';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('Sent', boxX + boxW / 2, boxY + boxH / 2);
      } else {
        const textPadX = boxX + 12;
        const textCy = boxY + boxH / 2;
        const sendBtnR = 10;
        const sendBtnX = boxX + boxW - 14;
        const sendBtnY = textCy;
        const isSendHovered = this.isHovered && this.isInsideHit(this.pointerX, this.pointerY, { x: sendBtnX - 12, y: sendBtnY - 12, width: 24, height: 24 });
        const hasText = this.whatsAppReplyText.length > 0;

        // User typed text or placeholder
        this.ctx.font = '400 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';

        if (!hasText) {
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          this.ctx.fillText('Type a reply...', textPadX, textCy);
        } else {
          this.ctx.fillStyle = '#ffffff';
          const maxInputW = boxW - 48;
          const trunc = this.truncateText(this.whatsAppReplyText, maxInputW, this.ctx.font);
          this.ctx.fillText(trunc, textPadX, textCy);

          // Blinking cursor
          const cursorBlink = Math.floor(performance.now() / 500) % 2 === 0;
          if (cursorBlink) {
            const cursorX = textPadX + this.ctx.measureText(trunc).width + 1;
            this.ctx.fillStyle = '#25d366';
            this.ctx.fillRect(cursorX, textCy - 7, 1.5, 14);
          }
        }

        // Send Button circle
        this.ctx.beginPath();
        this.ctx.arc(sendBtnX, sendBtnY, sendBtnR, 0, Math.PI * 2);
        this.ctx.fillStyle = hasText
          ? (isSendHovered ? '#1ebe5d' : '#25d366')
          : 'rgba(255, 255, 255, 0.12)';
        this.ctx.fill();

        // Send arrow in button
        this.ctx.strokeStyle = hasText ? '#ffffff' : 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 1.4;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(sendBtnX - 3.5, sendBtnY + 3.5);
        this.ctx.lineTo(sendBtnX + 3.5, sendBtnY - 2.5);
        this.ctx.moveTo(sendBtnX - 1.5, sendBtnY - 2.5);
        this.ctx.lineTo(sendBtnX + 3.5, sendBtnY - 2.5);
        this.ctx.lineTo(sendBtnX + 3.5, sendBtnY + 2.5);
        this.ctx.stroke();

        this.notificationHits['cWhatsAppSend'] = { x: sendBtnX - 12, y: sendBtnY - 12, width: 24, height: 24 };
      }

      this.ctx.restore();
      return;
    }

    // =========================================================================
    // 2. Standard Compact Island Notification (WhatsApp, Downloads, Mail, Chrome, AI)
    // =========================================================================

    // Authentic Apple Mac / iOS Style Vector App Icon (Zero bitmap lag, crisp 60 FPS)
    const iconR = 11;
    const iconCx = left + 9;
    const iconCy = cy;
    const hasIcon = this.drawAppleAppIcon(iconCx, iconCy, iconR, n.kind, n.status, n.app);

    let textLeft = hasIcon ? left + 27 : left + 6;

    if (this.isWhatsAppVoiceNoteActive()) {
      // Draw four dynamic oscillating audio wave bars in WhatsApp green (#25d366) next to the WhatsApp icon/badge
      this.ctx.save();
      const waveStartX = textLeft;
      const now = performance.now();
      const barCount = 4;
      const barWidth = 2.5;
      const barGap = 2;
      const maxH = 14;
      const minH = 3;

      for (let i = 0; i < barCount; i++) {
        const wavePhase = (now / 180) + i * 0.9;
        const osc = (Math.sin(wavePhase) + 1) / 2;
        const barH = minH + osc * (maxH - minH);
        const bx = waveStartX + i * (barWidth + barGap);
        const by = cy - barH / 2;

        this.ctx.fillStyle = '#25d366';
        this.ctx.beginPath();
        this.ctx.roundRect(bx, by, barWidth, barH, 1.2);
        this.ctx.fill();
      }
      this.ctx.restore();
      textLeft += barCount * (barWidth + barGap) + 4;
    }

    // Interactive Action Buttons (e.g. Deny & Allow for Claude Code tool execution)
    const actions = n.actions;
    if (actions && actions.length > 0) {
      const bh = 24;
      const by = Math.round(cy - bh / 2);
      const btnFont = '600 11.5px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';

      let curRight = right;
      for (let i = actions.length - 1; i >= 0; i--) {
        const item = actions[i];
        if (!item) continue;

        this.ctx.font = btnFont;
        const metrics = this.ctx.measureText(item.label);
        const bw = Math.max(54, Math.round(metrics.width + 22)); // 11px padding on each side
        const bx = curRight - bw;
        const isPrimary = item.primary ?? (item.id === 'allow');
        const isAnswer = item.id === 'wa-answer';
        const isDecline = item.id === 'wa-decline';
        const isHovered = this.isHovered && this.isInsideHit(this.pointerX, this.pointerY, { x: bx, y: by, width: bw, height: bh });

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.roundRect(bx, by, bw, bh, 7);
        this.ctx.fillStyle = isAnswer
          ? (isHovered ? '#34c759' : '#30d158')
          : isDecline
            ? (isHovered ? '#ff3b30' : '#ff453a')
            : isPrimary
              ? (isHovered ? '#e5e5ea' : '#ffffff')
              : (isHovered ? '#3a3a3c' : '#2c2c2e');
        this.ctx.fill();
        this.ctx.clip();

        this.ctx.font = btnFont;
        this.ctx.fillStyle = (isAnswer || isDecline) ? '#ffffff' : (isPrimary ? '#000000' : '#ffffff');
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(item.label, bx + bw / 2, cy);
        this.ctx.restore();

        const hitKey = item.id === 'allow' ? 'cAllow'
          : item.id === 'deny' ? 'cDeny'
          : item.id === 'wa-answer' ? 'cWhatsAppAnswer'
          : item.id === 'wa-decline' ? 'cWhatsAppDecline'
          : `action_${item.id}`;
        this.notificationHits[hitKey] = { x: bx, y: by, width: bw, height: bh };

        curRight -= bw + 8;
      }

      // Title & Body before the buttons
      const maxTextW = Math.max(60, curRight - textLeft - 10);
      const isCall = n.kind === 'whatsapp' && (actions.some(a => a.id === 'wa-answer'));
      const hasBody = Boolean(n.body && n.body.trim().length > 0);
      const titleFont = hasBody
        ? '600 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif'
        : '600 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
      const bodyFont = '400 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';

      this.ctx.save();
      this.ctx.textAlign = 'left';
      if (isCall) {
        const wa = this.parseWhatsAppDetails(n.title, n.body);
        const callHeading = wa.callType === 'video' ? 'Video Call' : 'Incoming Call';
        this.ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
        this.ctx.fillStyle = '#25d366';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(callHeading, textLeft, cy - 1);

        this.ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textBaseline = 'top';
        const truncCaller = this.truncateText(wa.senderName, maxTextW, this.ctx.font);
        this.ctx.fillText(truncCaller, textLeft, cy + 1);
      } else if (hasBody && n.body) {
        const truncTitle = this.truncateText(n.title, maxTextW, titleFont);
        const truncBody = this.truncateText(n.body, maxTextW, bodyFont);

        this.ctx.font = titleFont;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(truncTitle, textLeft, cy - 1);

        this.ctx.font = bodyFont;
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(truncBody, textLeft, cy + 2);
      } else {
        const truncTitle = this.truncateText(n.title, maxTextW, titleFont);
        this.ctx.font = titleFont;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(truncTitle, textLeft, cy);
      }
      this.ctx.restore();

    } else {
      // Standard notification with optional quick action (WhatsApp Reply chip, Download Open chip, App Open chip, Dismiss)
      const hasBody = Boolean(n.body && n.body.trim().length > 0);
      const titleFont = hasBody
        ? '600 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif'
        : '600 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
      const bodyFont = '400 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';

      const closeSize = 20;
      const closeX = right - closeSize;
      const closeY = cy - closeSize / 2;
      const isCloseHovered = this.isHovered && this.isInsideHit(this.pointerX, this.pointerY, { x: closeX, y: closeY, width: closeSize, height: closeSize });

      let actionRight = closeX - 6;

      // 1. WhatsApp Quick Reply Chip (Apple iPhone / Mac Style)
      if (n.kind === 'whatsapp') {
        const replyW = 52;
        const replyH = 22;
        const replyX = actionRight - replyW;
        const replyY = cy - replyH / 2;
        const isReplyHovered = this.isHovered && this.isInsideHit(this.pointerX, this.pointerY, { x: replyX, y: replyY, width: replyW, height: replyH });

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.roundRect(replyX, replyY, replyW, replyH, 11);
        this.ctx.fillStyle = isReplyHovered ? '#25d366' : 'rgba(37, 211, 102, 0.22)';
        this.ctx.fill();
        this.ctx.strokeStyle = '#25d366';
        this.ctx.lineWidth = 1.0;
        this.ctx.stroke();

        this.ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
        this.ctx.fillStyle = isReplyHovered ? '#000000' : '#25d366';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('Reply', replyX + replyW / 2, cy);
        this.ctx.restore();

        this.notificationHits['cWhatsAppReply'] = { x: replyX, y: replyY, width: replyW, height: replyH };
        actionRight -= replyW + 6;
      }

      // 2. Download Complete "Open" File Chip
      else if (n.kind === 'download' && n.status === 'complete' && n.filePath) {
        const openW = 48;
        const openH = 22;
        const openX = actionRight - openW;
        const openY = cy - openH / 2;
        const isOpenHovered = this.isHovered && this.isInsideHit(this.pointerX, this.pointerY, { x: openX, y: openY, width: openW, height: openH });

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.roundRect(openX, openY, openW, openH, 11);
        this.ctx.fillStyle = isOpenHovered ? '#22e05a' : 'rgba(34, 224, 90, 0.22)';
        this.ctx.fill();
        this.ctx.strokeStyle = '#22e05a';
        this.ctx.lineWidth = 1.0;
        this.ctx.stroke();

        this.ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
        this.ctx.fillStyle = isOpenHovered ? '#000000' : '#22e05a';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('Open', openX + openW / 2, cy);
        this.ctx.restore();

        this.notificationHits['cOpenFile'] = { x: openX, y: openY, width: openW, height: openH };
        actionRight -= openW + 6;
      }

      // 3. Google Chrome "Open" Action Chip
      else if (n.kind === 'chrome' || (n.app && n.app.toLowerCase().includes('chrome'))) {
        const openW = 48;
        const openH = 22;
        const openX = actionRight - openW;
        const openY = cy - openH / 2;
        const isOpenHovered = this.isHovered && this.isInsideHit(this.pointerX, this.pointerY, { x: openX, y: openY, width: openW, height: openH });

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.roundRect(openX, openY, openW, openH, 11);
        this.ctx.fillStyle = isOpenHovered ? '#4285f4' : 'rgba(66, 133, 244, 0.22)';
        this.ctx.fill();
        this.ctx.strokeStyle = '#4285f4';
        this.ctx.lineWidth = 1.0;
        this.ctx.stroke();

        this.ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
        this.ctx.fillStyle = isOpenHovered ? '#ffffff' : '#4285f4';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('Open', openX + openW / 2, cy);
        this.ctx.restore();

        this.notificationHits['cOpenApp'] = { x: openX, y: openY, width: openW, height: openH };
        actionRight -= openW + 6;
      }

      // 4. Apple Mail / Outlook "Open" Action Chip
      else if (n.kind === 'mail' || (n.app && (n.app.toLowerCase().includes('mail') || n.app.toLowerCase().includes('outlook')))) {
        const openW = 48;
        const openH = 22;
        const openX = actionRight - openW;
        const openY = cy - openH / 2;
        const isOpenHovered = this.isHovered && this.isInsideHit(this.pointerX, this.pointerY, { x: openX, y: openY, width: openW, height: openH });

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.roundRect(openX, openY, openW, openH, 11);
        this.ctx.fillStyle = isOpenHovered ? '#0078d4' : 'rgba(0, 120, 212, 0.22)';
        this.ctx.fill();
        this.ctx.strokeStyle = '#0078d4';
        this.ctx.lineWidth = 1.0;
        this.ctx.stroke();

        this.ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
        this.ctx.fillStyle = isOpenHovered ? '#ffffff' : '#0078d4';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('Open', openX + openW / 2, cy);
        this.ctx.restore();

        this.notificationHits['cOpenApp'] = { x: openX, y: openY, width: openW, height: openH };
        actionRight -= openW + 6;
      }

      // 5. Generic URL "Open" Action Chip
      else if (n.url) {
        const openW = 48;
        const openH = 22;
        const openX = actionRight - openW;
        const openY = cy - openH / 2;
        const isOpenHovered = this.isHovered && this.isInsideHit(this.pointerX, this.pointerY, { x: openX, y: openY, width: openW, height: openH });

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.roundRect(openX, openY, openW, openH, 11);
        this.ctx.fillStyle = isOpenHovered ? color : 'rgba(255, 255, 255, 0.15)';
        this.ctx.fill();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1.0;
        this.ctx.stroke();

        this.ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
        this.ctx.fillStyle = isOpenHovered ? '#000000' : '#ffffff';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('Open', openX + openW / 2, cy);
        this.ctx.restore();

        this.notificationHits['cOpenApp'] = { x: openX, y: openY, width: openW, height: openH };
        actionRight -= openW + 6;
      }

      let displayTitle = n.title;
      let displayBody = n.body;
      if (n.kind === 'whatsapp') {
        const wa = this.parseWhatsAppDetails(n.title, n.body);
        if (wa.isGroup) {
          displayTitle = `${wa.groupName}`;
          displayBody = `${wa.senderName}: ${wa.messageText}`;
        } else if (wa.isCall) {
          displayTitle = wa.callType === 'video' ? 'Video Call' : 'Incoming Call';
          displayBody = wa.senderName;
        } else {
          displayTitle = wa.senderName;
          displayBody = wa.messageText;
        }
      }

      const maxTextW = Math.max(80, actionRight - textLeft - 6);
      const truncTitle = this.truncateText(displayTitle, maxTextW, titleFont);

      this.ctx.save();
      this.ctx.textAlign = 'left';
      if (hasBody && displayBody) {
        const truncBody = this.truncateText(displayBody, maxTextW, bodyFont);
        this.ctx.font = titleFont;
        this.ctx.fillStyle = color;
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(truncTitle, textLeft, cy - 1);

        this.ctx.font = bodyFont;
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(truncBody, textLeft, cy + 2);
      } else {
        this.ctx.font = titleFont;
        this.ctx.fillStyle = color;
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(truncTitle, textLeft, cy);
      }
      this.ctx.restore();

      // Dismiss Button
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(closeX + closeSize / 2, cy, closeSize / 2, 0, Math.PI * 2);
      this.ctx.fillStyle = isCloseHovered ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.08)';
      this.ctx.fill();

      this.ctx.strokeStyle = isCloseHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.6)';
      this.ctx.lineWidth = 1.4;
      this.ctx.lineCap = 'round';
      const crossR = 3.5;
      this.ctx.beginPath();
      this.ctx.moveTo(closeX + closeSize / 2 - crossR, cy - crossR);
      this.ctx.lineTo(closeX + closeSize / 2 + crossR, cy + crossR);
      this.ctx.moveTo(closeX + closeSize / 2 + crossR, cy - crossR);
      this.ctx.lineTo(closeX + closeSize / 2 - crossR, cy + crossR);
      this.ctx.stroke();
      this.ctx.restore();

      this.notificationHits['cDismiss'] = { x: closeX, y: closeY, width: closeSize, height: closeSize };
    }
  }

  private drawRestContent(cx: number, topY: number): void {
    const midY = topY + this.currentHeight / 2;
    if (this.isNotificationActive()) {
      this.drawNotificationContent(cx - this.currentWidth / 2, midY, topY);
      return;
    }
    if (this.isVoiceCompanionActive()) {
      this.drawVoiceCompanionWave(cx, topY);
      return;
    }
    if (performance.now() < this.bluetoothHudUntil) {
      this.drawBluetoothHudContent(cx, topY);
      return;
    }
    this.mascot.drawFloatingEyes(this.ctx, cx, midY, 0.75);
  }

  private drawCompactContent(cx: number, topY: number): void {
    const midY = topY + this.currentHeight / 2;
    const pillLeft = cx - this.currentWidth / 2;

    if (this.isNotificationActive()) {
      this.drawNotificationContent(pillLeft, midY, topY);
      return;
    }

    if (this.isVoiceCompanionActive()) {
      this.drawVoiceCompanionWave(cx, topY);
      return;
    }

    if (performance.now() < this.airdropHudUntil) {
      // Apple AirDrop Transfer HUD Pop
      this.drawAirDropHudContent(cx, topY);
    } else if (performance.now() < this.speedometerHudUntil) {
      // Apple-style Hardware Speedometer HUD Pop (CPU, RAM, Storage)
      this.drawSpeedometerHudContent(cx, topY);
    } else if (performance.now() < this.bluetoothHudUntil) {
      // Apple AirPods / Bluetooth Battery & Device HUD
      this.drawBluetoothHudContent(cx, topY);
    } else if (performance.now() < this.volumeHudUntil) {
      // Apple-style Hardware Volume Pop HUD
      this.drawVolumeHudContent(cx, topY);
    } else if (performance.now() < this.chargerSurgeUntil) {
      // Feature B: Charger Plug-in Surge Pop (Zero Clutter)
      this.drawChargerSurgeContent(cx, topY);
    } else if (this.isSplitIslandActive()) {
      // Feature C: Split-Island Dual Bubble [ Pill ] ( ○ ) for Dual Tasks (Music + Focus, Music + Downloads, or Multiple Downloads)
      const h = this.currentHeight;
      const bubbleSize = h;
      const gap = 8;
      const mainWidth = this.currentWidth;
      const totalSpan = mainWidth + gap + bubbleSize;
      const left = cx - totalSpan / 2;
      const pillCx = left + mainWidth / 2;
      const bubbleCx = left + mainWidth + gap + bubbleSize / 2;
      const bubbleCy = midY;
      const bubbleR = bubbleSize / 2;
      const hasDownloads = this.activeDownloadsList.length > 0;
      const isMusicActive = Boolean(this.mediaState.active && this.mediaState.title);

      // 1. Primary Pill: Render Full Spotify Music Island or Primary Download
      if (isMusicActive) {
        this.drawCompactMusicIsland(left, midY, topY);
      } else if (hasDownloads) {
        this.drawCompactDownloadContent(left, midY, topY, this.activeDownloadsList[0]);
      } else {
        this.mascot.drawFloatingEyes(this.ctx, pillCx, midY, 0.95);
      }

      // 2. Detached Bubble: Downloads Progress Ring or TwoCode Focus Circle
      if (hasDownloads) {
        this.drawDetachedDownloadBubble(bubbleCx, bubbleCy, bubbleR, this.activeDownloadsList);
      } else {
        const d = bubbleSize;
        const ringR = Math.max(7, d / 2 - 9);
        const leftFraction = this.focusState.totalSeconds > 0
          ? Math.max(0, Math.min(1, this.focusState.remainingSeconds / this.focusState.totalSeconds))
          : 0;

        this.ctx.save();
        this.ctx.lineWidth = 3.0;
        this.ctx.lineCap = 'round';

        // Background dim track ring (TwoCode: 'rgba(191,90,242,.3)')
        this.ctx.beginPath();
        this.ctx.arc(bubbleCx, bubbleCy, ringR, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(191, 90, 242, 0.3)';
        this.ctx.stroke();

        // Active progress arc running empty (TwoCode: '#bf5af2', -Math.PI / 2 to -Math.PI / 2 + Math.PI * 2 * left)
        if (leftFraction > 0.001) {
          this.ctx.beginPath();
          this.ctx.arc(bubbleCx, bubbleCy, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * leftFraction);
          this.ctx.strokeStyle = '#bf5af2';
          this.ctx.shadowColor = 'rgba(191, 90, 242, 0.5)';
          this.ctx.shadowBlur = 4;
          this.ctx.stroke();
        }
        this.ctx.restore();

        // Center: Clean remaining minutes matching Apple HIG & TwoCode
        const min = Math.floor(this.focusState.remainingSeconds / 60);
        const sec = this.focusState.remainingSeconds % 60;
        const minText = min > 0 ? String(min) : `${sec}s`;
        this.ctx.save();
        this.ctx.font = '700 9px -apple-system, BlinkMacSystemFont, "SF Pro Rounded", Inter, "Segoe UI", sans-serif';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(minText, bubbleCx, bubbleCy + 0.5);
        this.ctx.restore();
      }
    } else if (this.aiState.status === 'running') {
      // AI Task Mode
      this.mascot.drawFloatingEyes(this.ctx, pillLeft + 22, midY, 0.85);
      this.ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = '#ffa500';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(this.aiState.currentTool || 'AI Thinking...', pillLeft + 42, midY + 4);
    } else if (this.focusState.active) {
      // TwoCode Focus Pill (ai-monitor-ui.js lines 1147-1155):
      // Left: Focus ring (radius 8px, lineWidth 3, rgba(191,90,242,.3) & #bf5af2)
      // Center: Mascot eyes
      // Right: Countdown time label in #bf5af2
      const H = this.currentHeight;
      const cy = midY;
      const left = pillLeft + 14;
      const right = pillLeft + this.currentWidth - 14;
      const mid = (left + right) / 2;
      const r = 8;
      const leftFraction = this.focusState.totalSeconds > 0
        ? Math.max(0, Math.min(1, this.focusState.remainingSeconds / this.focusState.totalSeconds))
        : 0;

      this.ctx.save();
      this.ctx.lineWidth = 3.0;
      this.ctx.lineCap = 'round';
      // Background track ring
      this.ctx.beginPath();
      this.ctx.arc(left + 8, cy, r, 0, Math.PI * 2);
      this.ctx.strokeStyle = 'rgba(191, 90, 242, 0.3)';
      this.ctx.stroke();
      // Active progress arc running empty
      if (leftFraction > 0.001) {
        this.ctx.beginPath();
        this.ctx.arc(left + 8, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * leftFraction);
        this.ctx.strokeStyle = '#bf5af2';
        this.ctx.shadowColor = 'rgba(191, 90, 242, 0.5)';
        this.ctx.shadowBlur = 4;
        this.ctx.stroke();
      }
      this.ctx.restore();

      // Mascot eyes in the middle (guarded so eyes are only drawn if width >= 230 to prevent overlap with timer text)
      if (this.currentWidth >= 230) {
        this.mascot.drawFloatingEyes(this.ctx, mid, cy + 0.5, 0.95);
      }

      // Time on the right (TwoCode: text(focus.label(), right, cy + 5, 15, '#bf5af2', 600, 'right'))
      const min = Math.floor(this.focusState.remainingSeconds / 60);
      const sec = this.focusState.remainingSeconds % 60;
      const timeStr = `${min}:${String(sec).padStart(2, '0')}`;
      this.ctx.save();
      this.ctx.font = '600 15px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = '#bf5af2';
      this.ctx.textAlign = 'right';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(timeStr, right, cy + 0.5);
      this.ctx.restore();
    } else if (this.sportsState?.enabled && this.activeSportsActivity && this.isSportsPillEnabled) {
      this.drawCompactSportsScoreboard(pillLeft, midY, topY);
    } else if (this.activeDownloadsList.length === 1 && !(this.mediaState.active && this.mediaState.title)) {
      // Single compact download platter
      this.drawCompactDownloadContent(pillLeft, midY, topY, this.activeDownloadsList[0]);
    } else if (this.mediaState.active && this.mediaState.title) {
      // Dynamic Album-Tinted Music Island (TwoCode Direct Implementation)
      this.drawCompactMusicIsland(pillLeft, midY, topY);
    } else if (performance.now() < this.greetingUntil) {
      this.drawGreetingPill(cx, topY);
    } else {
      // TRUE RESTING MODE (98 x 26 px TwoCode Visual Calibration matching Screenshot 2):
      this.drawCompactRestingDualStructure(cx, topY);
    }
  }

  /**
   * Authentic Apple Mac / iOS Vector Squircle App Icon:
   * Zero bitmap lag, 100% 60 FPS vector canvas rendering.
   * Matches Apple HIG squircle geometry with continuous curvature,
   * specular glass gradient top reflection, and crisp brand vector glyphs.
   */
  public drawAppleAppIcon(iconCx: number, iconCy: number, iconR: number = 11, kind?: string, status?: string, appName?: string): boolean {
    const s = status || (this && this.activeNotification ? this.activeNotification.status : undefined);
    const titleStr = this.activeNotification?.title || '';
    const app = (appName || '').toLowerCase();
    let k = this.resolveNotificationKind(kind, s, appName, titleStr);

    const size = iconR * 2;
    const sx = iconCx - iconR;
    const sy = iconCy - iconR;
    const cr = iconR * 0.48; // Continuous Apple squircle corner radius

    this.ctx.save();

    // 1. WhatsApp iOS App Icon
    if (k === 'whatsapp') {
      const grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
      grad.addColorStop(0, '#2ee26a');
      grad.addColorStop(1, '#1aa84b');

      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size, cr);
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      // Top specular glass highlight
      const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = sheen;
      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      this.ctx.lineWidth = 0.8;
      this.ctx.stroke();

      // WhatsApp Speech Bubble in crisp white
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(iconCx, iconCy - 0.5, 5.2, 0, Math.PI * 2);
      this.ctx.fill();

      // Speech bubble tail at bottom-left
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx - 2.8, iconCy + 3.0);
      this.ctx.lineTo(iconCx - 5.4, iconCy + 5.5);
      this.ctx.lineTo(iconCx - 1.0, iconCy + 4.6);
      this.ctx.closePath();
      this.ctx.fill();

      // Telephone Handset in WhatsApp Green
      this.ctx.save();
      this.ctx.translate(iconCx, iconCy - 0.5);
      this.ctx.rotate(-Math.PI / 10);
      this.ctx.strokeStyle = '#20b852';
      this.ctx.lineWidth = 1.6;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 2.5, Math.PI * 0.65, Math.PI * 1.35, true);
      this.ctx.stroke();

      this.ctx.fillStyle = '#20b852';
      this.ctx.beginPath();
      this.ctx.arc(-2.0, -1.8, 1.0, 0, Math.PI * 2);
      this.ctx.arc(-2.0, 1.8, 1.0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();

      this.ctx.restore();
      return true;
    }

    // 2. Google Chrome Apple Mac / iOS Icon
    if (k === 'chrome') {
      const grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#f0f0f2');

      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size, cr);
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      // Specular sheen
      const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = sheen;
      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
      this.ctx.lineWidth = 0.8;
      this.ctx.stroke();

      // Google Chrome 4-Color Pinwheel
      const chromeR = 6.8;
      // Red Blade (top)
      this.ctx.fillStyle = '#ea4335';
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx, iconCy);
      this.ctx.arc(iconCx, iconCy, chromeR, -Math.PI * 5 / 6, -Math.PI / 6);
      this.ctx.closePath();
      this.ctx.fill();

      // Yellow Blade (bottom-right)
      this.ctx.fillStyle = '#fbbc05';
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx, iconCy);
      this.ctx.arc(iconCx, iconCy, chromeR, -Math.PI / 6, Math.PI / 2);
      this.ctx.closePath();
      this.ctx.fill();

      // Green Blade (bottom-left)
      this.ctx.fillStyle = '#34a853';
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx, iconCy);
      this.ctx.arc(iconCx, iconCy, chromeR, Math.PI / 2, -Math.PI * 5 / 6);
      this.ctx.closePath();
      this.ctx.fill();

      // White Divider Ring
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(iconCx, iconCy, 3.2, 0, Math.PI * 2);
      this.ctx.fill();

      // Google Blue Core
      this.ctx.fillStyle = '#4285f4';
      this.ctx.beginPath();
      this.ctx.arc(iconCx, iconCy, 2.3, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
      return true;
    }

    // Brave Browser Apple Mac / iOS Icon
    if (k === 'brave') {
      const grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
      grad.addColorStop(0, '#ff602e');
      grad.addColorStop(1, '#e63900');

      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size, cr);
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      // Specular glass sheen
      const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = sheen;
      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      this.ctx.lineWidth = 0.8;
      this.ctx.stroke();

      // Brave Lion Silhouette Glyph in crisp white
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx, iconCy + 5.5);
      this.ctx.lineTo(iconCx - 4.8, iconCy + 1.2);
      this.ctx.lineTo(iconCx - 5.2, iconCy - 2.5);
      this.ctx.lineTo(iconCx - 3.2, iconCy - 4.8);
      this.ctx.lineTo(iconCx - 1.2, iconCy - 3.2);
      this.ctx.lineTo(iconCx, iconCy - 4.5);
      this.ctx.lineTo(iconCx + 1.2, iconCy - 3.2);
      this.ctx.lineTo(iconCx + 3.2, iconCy - 4.8);
      this.ctx.lineTo(iconCx + 5.2, iconCy - 2.5);
      this.ctx.lineTo(iconCx + 4.8, iconCy + 1.2);
      this.ctx.closePath();
      this.ctx.fill();

      // Lion face inner cut / eyes
      this.ctx.fillStyle = '#e63900';
      this.ctx.beginPath();
      this.ctx.arc(iconCx - 2.0, iconCy - 0.5, 0.7, 0, Math.PI * 2);
      this.ctx.arc(iconCx + 2.0, iconCy - 0.5, 0.7, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
      return true;
    }

    // 3. Apple Mail / Outlook Icon
    if (k === 'mail') {
      const grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
      grad.addColorStop(0, '#1a85ff');
      grad.addColorStop(1, '#005edb');

      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size, cr);
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      // Top specular glass highlight
      const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = sheen;
      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      this.ctx.lineWidth = 0.8;
      this.ctx.stroke();

      // White Folded Envelope
      const ew = 12.0;
      const eh = 8.5;
      const ex = iconCx - ew / 2;
      const ey = iconCy - eh / 2;

      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.roundRect(ex, ey, ew, eh, 1.2);
      this.ctx.fill();

      // Flap crease
      this.ctx.strokeStyle = '#005edb';
      this.ctx.lineWidth = 1.1;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(ex + 0.6, ey + 0.6);
      this.ctx.lineTo(iconCx, ey + 4.8);
      this.ctx.lineTo(ex + ew - 0.6, ey + 0.6);
      this.ctx.stroke();

      // Subtle lower creases
      this.ctx.strokeStyle = 'rgba(0, 94, 219, 0.35)';
      this.ctx.lineWidth = 0.9;
      this.ctx.beginPath();
      this.ctx.moveTo(ex + 0.6, ey + eh - 0.6);
      this.ctx.lineTo(iconCx - 2.0, ey + 4.0);
      this.ctx.moveTo(ex + ew - 0.6, ey + eh - 0.6);
      this.ctx.lineTo(iconCx + 2.0, ey + 4.0);
      this.ctx.stroke();

      this.ctx.restore();
      return true;
    }

    // 4. Apple Mac Safari / Downloads Icon
    if (k === 'download') {
      const isComplete = s === 'complete' || (this.activeNotification?.title?.toLowerCase().includes('complete') ?? false);
      const isError = s === 'error' || (this.activeNotification?.title?.toLowerCase().includes('cancel') ?? false) || (this.activeNotification?.title?.toLowerCase().includes('fail') ?? false);

      if (isComplete) {
        // Complete: Emerald Green Apple Squircle with Bold White Checkmark
        const grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
        grad.addColorStop(0, '#28cd41');
        grad.addColorStop(1, '#22e05a');

        this.ctx.beginPath();
        this.ctx.roundRect(sx, sy, size, size, cr);
        this.ctx.fillStyle = grad;
        this.ctx.fill();

        const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
        sheen.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
        this.ctx.fillStyle = sheen;
        this.ctx.beginPath();
        this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
        this.ctx.fill();

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 0.8;
        this.ctx.stroke();

        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1.8;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(iconCx - 3.8, iconCy + 0.2);
        this.ctx.lineTo(iconCx - 1.2, iconCy + 3.2);
        this.ctx.lineTo(iconCx + 4.2, iconCy - 2.8);
        this.ctx.stroke();
      } else if (isError) {
        // Error / Cancelled: Crimson Red Apple Squircle with Bold White X
        const grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
        grad.addColorStop(0, '#ff3b30');
        grad.addColorStop(1, '#d70015');

        this.ctx.beginPath();
        this.ctx.roundRect(sx, sy, size, size, cr);
        this.ctx.fillStyle = grad;
        this.ctx.fill();

        const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
        sheen.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
        sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
        this.ctx.fillStyle = sheen;
        this.ctx.beginPath();
        this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
        this.ctx.fill();

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 0.8;
        this.ctx.stroke();

        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1.8;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(iconCx - 3.2, iconCy - 3.2);
        this.ctx.lineTo(iconCx + 3.2, iconCy + 3.2);
        this.ctx.moveTo(iconCx + 3.2, iconCy - 3.2);
        this.ctx.lineTo(iconCx - 3.2, iconCy + 3.2);
        this.ctx.stroke();
      } else {
        // Downloading: Apple Mac Safari Platter with Dynamic Progress Ring and Bobbing Arrow
        const grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
        grad.addColorStop(0, '#1c1c1e');
        grad.addColorStop(1, '#0e1217');

        this.ctx.beginPath();
        this.ctx.roundRect(sx, sy, size, size, cr);
        this.ctx.fillStyle = grad;
        this.ctx.fill();

        const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
        sheen.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
        sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
        this.ctx.fillStyle = sheen;
        this.ctx.beginPath();
        this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
        this.ctx.fill();

        this.ctx.strokeStyle = 'rgba(0, 210, 255, 0.45)';
        this.ctx.lineWidth = 0.9;
        this.ctx.stroke();

        // Progress ring
        const pr = 6.4;
        this.ctx.beginPath();
        this.ctx.arc(iconCx, iconCy, pr, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(0, 210, 255, 0.22)';
        this.ctx.lineWidth = 1.6;
        this.ctx.stroke();

        // Progress arc
        this.ctx.beginPath();
        const prog = this.activeNotification?.progress;
        if (typeof prog === 'number' && prog > 0) {
          const startAngle = -Math.PI / 2;
          const endAngle = startAngle + Math.PI * 2 * Math.min(1, Math.max(0, prog));
          this.ctx.arc(iconCx, iconCy, pr, startAngle, endAngle);
        } else {
          const rot = (performance.now() / 450) % (Math.PI * 2);
          this.ctx.arc(iconCx, iconCy, pr, rot, rot + Math.PI * 0.9);
        }
        this.ctx.strokeStyle = '#00d2ff';
        this.ctx.lineWidth = 1.8;
        this.ctx.lineCap = 'round';
        this.ctx.stroke();

        // Bobbing Arrow & Platter Tray
        const arrowBob = Math.sin(performance.now() / 240) * 0.7;
        this.ctx.strokeStyle = '#00d2ff';
        this.ctx.lineWidth = 1.4;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // Downward Arrow
        this.ctx.beginPath();
        this.ctx.moveTo(iconCx, iconCy - 3.2 + arrowBob);
        this.ctx.lineTo(iconCx, iconCy + 1.8 + arrowBob);
        this.ctx.moveTo(iconCx - 2.2, iconCy + arrowBob);
        this.ctx.lineTo(iconCx, iconCy + 2.0 + arrowBob);
        this.ctx.lineTo(iconCx + 2.2, iconCy + arrowBob);
        this.ctx.stroke();

        // Tray platter
        this.ctx.beginPath();
        this.ctx.moveTo(iconCx - 3.2, iconCy + 3.8);
        this.ctx.lineTo(iconCx + 3.2, iconCy + 3.8);
        this.ctx.stroke();
      }

      this.ctx.restore();
      return true;
    }

    // 5. Telegram Icon
    if (k === 'telegram') {
      const grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
      grad.addColorStop(0, '#29b6f6');
      grad.addColorStop(1, '#0288d1');

      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size, cr);
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      // Sheen
      const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = sheen;
      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      this.ctx.lineWidth = 0.8;
      this.ctx.stroke();

      // White Paper Airplane
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx - 4.8, iconCy + 0.4);
      this.ctx.lineTo(iconCx + 5.2, iconCy - 4.4);
      this.ctx.lineTo(iconCx + 1.2, iconCy + 4.6);
      this.ctx.lineTo(iconCx - 0.6, iconCy + 1.2);
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.strokeStyle = '#0288d1';
      this.ctx.lineWidth = 0.9;
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx + 5.2, iconCy - 4.4);
      this.ctx.lineTo(iconCx - 0.6, iconCy + 1.2);
      this.ctx.stroke();

      this.ctx.restore();
      return true;
    }

    // 6. Discord Icon
    if (k === 'discord') {
      const grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
      grad.addColorStop(0, '#5865f2');
      grad.addColorStop(1, '#4752c4');

      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size, cr);
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = sheen;
      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      this.ctx.lineWidth = 0.8;
      this.ctx.stroke();

      // Clydesdale silhouette in white
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.roundRect(iconCx - 5.5, iconCy - 3.8, 11, 7.6, 2.8);
      this.ctx.fill();

      // Eyes in blurple
      this.ctx.fillStyle = '#4752c4';
      this.ctx.beginPath();
      this.ctx.arc(iconCx - 2.4, iconCy, 1.2, 0, Math.PI * 2);
      this.ctx.arc(iconCx + 2.4, iconCy, 1.2, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
      return true;
    }

    // 7. Microsoft Edge Icon
    if (k === 'edge') {
      const grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
      grad.addColorStop(0, '#0078d7');
      grad.addColorStop(1, '#00b294');

      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size, cr);
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = sheen;
      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      this.ctx.lineWidth = 0.8;
      this.ctx.stroke();

      // Wave swirl
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.8;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.arc(iconCx, iconCy, 4.8, 0.2, Math.PI * 1.4);
      this.ctx.stroke();

      this.ctx.restore();
      return true;
    }

    // 8. Spotify Icon
    if (k === 'spotify') {
      const grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
      grad.addColorStop(0, '#1db954');
      grad.addColorStop(1, '#1aa34a');

      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size, cr);
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = sheen;
      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      this.ctx.lineWidth = 0.8;
      this.ctx.stroke();

      // 3 Black Curved Audio Waves
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineCap = 'round';

      this.ctx.lineWidth = 1.6;
      this.ctx.beginPath();
      this.ctx.arc(iconCx, iconCy + 5.6, 6.6, -Math.PI * 0.72, -Math.PI * 0.28);
      this.ctx.stroke();

      this.ctx.lineWidth = 1.4;
      this.ctx.beginPath();
      this.ctx.arc(iconCx, iconCy + 5.0, 4.8, -Math.PI * 0.72, -Math.PI * 0.28);
      this.ctx.stroke();

      this.ctx.lineWidth = 1.2;
      this.ctx.beginPath();
      this.ctx.arc(iconCx, iconCy + 4.4, 3.2, -Math.PI * 0.72, -Math.PI * 0.28);
      this.ctx.stroke();

      this.ctx.restore();
      return true;
    }

    // 9. Done / Checkmark Icon
    if (k === 'done') {
      const grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
      grad.addColorStop(0, '#28cd41');
      grad.addColorStop(1, '#22e05a');

      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size, cr);
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = sheen;
      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.lineWidth = 0.8;
      this.ctx.stroke();

      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.8;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx - 3.8, iconCy + 0.2);
      this.ctx.lineTo(iconCx - 1.2, iconCy + 3.2);
      this.ctx.lineTo(iconCx + 4.2, iconCy - 2.8);
      this.ctx.stroke();

      this.ctx.restore();
      return true;
    }

    // 10. AI Sparkle / Question Icon
    if (k === 'question') {
      const grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
      grad.addColorStop(0, '#ff9500');
      grad.addColorStop(1, '#ff5e3a');

      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size, cr);
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = sheen;
      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.lineWidth = 0.8;
      this.ctx.stroke();

      // Claude 8-point Sparkle in white
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.8;
      this.ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const an = (i * Math.PI) / 4;
        this.ctx.beginPath();
        this.ctx.moveTo(iconCx - Math.cos(an) * 4.8, iconCy - Math.sin(an) * 4.8);
        this.ctx.lineTo(iconCx + Math.cos(an) * 4.8, iconCy + Math.sin(an) * 4.8);
        this.ctx.stroke();
      }

      this.ctx.restore();
      return true;
    }

    // 11. Google Antigravity / Gemini / DeepMind Apple Mac Icon
    if (k === 'antigravity') {
      const grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
      grad.addColorStop(0, '#312e81');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#0f172a');

      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size, cr);
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      // Top specular glass highlight
      const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.40)');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = sheen;
      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(129, 140, 248, 0.45)';
      this.ctx.lineWidth = 0.8;
      this.ctx.stroke();

      // Antigravity 4-Point Radiant Diamond Star in Google Cyan / Violet
      const starGrad = this.ctx.createLinearGradient(iconCx - 4.5, iconCy - 6.5, iconCx + 4.5, iconCy + 6.5);
      starGrad.addColorStop(0, '#00d2ff');
      starGrad.addColorStop(0.5, '#818cf8');
      starGrad.addColorStop(1, '#c084fc');

      this.ctx.fillStyle = starGrad;
      this.ctx.beginPath();
      const starR = 6.2;
      const pinch = 1.6;
      this.ctx.moveTo(iconCx, iconCy - starR);
      this.ctx.bezierCurveTo(iconCx + pinch * 0.3, iconCy - pinch, iconCx + pinch, iconCy - pinch * 0.3, iconCx + starR, iconCy);
      this.ctx.bezierCurveTo(iconCx + pinch, iconCy + pinch * 0.3, iconCx + pinch * 0.3, iconCy + pinch, iconCx, iconCy + starR);
      this.ctx.bezierCurveTo(iconCx - pinch * 0.3, iconCy + pinch, iconCx - pinch, iconCy + pinch * 0.3, iconCx - starR, iconCy);
      this.ctx.bezierCurveTo(iconCx - pinch, iconCy - pinch * 0.3, iconCx - pinch * 0.3, iconCy - pinch, iconCx, iconCy - starR);
      this.ctx.fill();

      // Glowing white core
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(iconCx, iconCy, 1.3, 0, Math.PI * 2);
      this.ctx.fill();

      // Satellite spark dot at top right
      this.ctx.fillStyle = '#00d2ff';
      this.ctx.beginPath();
      this.ctx.arc(iconCx + 4.8, iconCy - 4.6, 1.1, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
      return true;
    }

    // 12. Windows Defender / Windows Security Apple Mac Icon
    if (k === 'defender') {
      const grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
      grad.addColorStop(0, '#0078d4');
      grad.addColorStop(1, '#005a9e');

      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size, cr);
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.40)');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = sheen;
      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      this.ctx.lineWidth = 0.8;
      this.ctx.stroke();

      // Windows Security Shield in Crisp White
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx - 4.6, iconCy - 4.8);
      this.ctx.lineTo(iconCx + 4.6, iconCy - 4.8);
      this.ctx.lineTo(iconCx + 4.6, iconCy - 0.5);
      this.ctx.bezierCurveTo(iconCx + 4.6, iconCy + 3.8, iconCx, iconCy + 6.0, iconCx, iconCy + 6.0);
      this.ctx.bezierCurveTo(iconCx, iconCy + 6.0, iconCx - 4.6, iconCy + 3.8, iconCx - 4.6, iconCy - 0.5);
      this.ctx.closePath();
      this.ctx.fill();

      // Emerald Checkmark centered inside shield
      this.ctx.strokeStyle = '#0078d4';
      this.ctx.lineWidth = 1.6;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx - 2.5, iconCy - 0.2);
      this.ctx.lineTo(iconCx - 0.8, iconCy + 1.8);
      this.ctx.lineTo(iconCx + 2.6, iconCy - 1.8);
      this.ctx.stroke();

      this.ctx.restore();
      return true;
    }

    // 13. Snipping Tool / Screen Capture Apple Mac Icon
    if (k === 'snipping') {
      const grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
      grad.addColorStop(0, '#8b5cf6');
      grad.addColorStop(1, '#6d28d9');

      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size, cr);
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.40)');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = sheen;
      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      this.ctx.lineWidth = 0.8;
      this.ctx.stroke();

      // Snipping Tool Viewfinder Crosshairs and Crop Corners
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.3;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      // Top-Left Corner
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx - 4.8, iconCy - 2.2);
      this.ctx.lineTo(iconCx - 4.8, iconCy - 4.8);
      this.ctx.lineTo(iconCx - 2.2, iconCy - 4.8);
      this.ctx.stroke();

      // Top-Right Corner
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx + 2.2, iconCy - 4.8);
      this.ctx.lineTo(iconCx + 4.8, iconCy - 4.8);
      this.ctx.lineTo(iconCx + 4.8, iconCy - 2.2);
      this.ctx.stroke();

      // Bottom-Left Corner
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx - 4.8, iconCy + 2.2);
      this.ctx.lineTo(iconCx - 4.8, iconCy + 4.8);
      this.ctx.lineTo(iconCx - 2.2, iconCy + 4.8);
      this.ctx.stroke();

      // Bottom-Right Corner
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx + 2.2, iconCy + 4.8);
      this.ctx.lineTo(iconCx + 4.8, iconCy + 4.8);
      this.ctx.lineTo(iconCx + 4.8, iconCy + 2.2);
      this.ctx.stroke();

      // Center Crossed Scissor Blades
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx - 3.0, iconCy - 3.0);
      this.ctx.lineTo(iconCx + 3.0, iconCy + 3.0);
      this.ctx.moveTo(iconCx - 3.0, iconCy + 3.0);
      this.ctx.lineTo(iconCx + 3.0, iconCy - 3.0);
      this.ctx.stroke();

      this.ctx.restore();
      return true;
    }

    // 14. Terminal / PowerShell Apple Mac Icon
    if (k === 'terminal') {
      const grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
      grad.addColorStop(0, '#1c1c1e');
      grad.addColorStop(1, '#09090b');

      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size, cr);
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = sheen;
      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      this.ctx.lineWidth = 0.8;
      this.ctx.stroke();

      // Prompt Chevron `>`
      this.ctx.strokeStyle = '#38bdf8';
      this.ctx.lineWidth = 1.6;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx - 4.6, iconCy - 3.4);
      this.ctx.lineTo(iconCx - 1.2, iconCy);
      this.ctx.lineTo(iconCx - 4.6, iconCy + 3.4);
      this.ctx.stroke();

      // Underline Cursor `_`
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx + 0.6, iconCy + 3.4);
      this.ctx.lineTo(iconCx + 4.8, iconCy + 3.4);
      this.ctx.stroke();

      this.ctx.restore();
      return true;
    }

    // 15. System Settings Apple Mac Icon
    if (k === 'settings') {
      const grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
      grad.addColorStop(0, '#4b5563');
      grad.addColorStop(1, '#374151');

      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size, cr);
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = sheen;
      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      this.ctx.lineWidth = 0.8;
      this.ctx.stroke();

      // Gear Glyph
      const gearR = 4.8;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(iconCx, iconCy, gearR, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = '#374151';
      this.ctx.beginPath();
      this.ctx.arc(iconCx, iconCy, 2.2, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.8;
      this.ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 4;
        this.ctx.beginPath();
        this.ctx.moveTo(iconCx - Math.cos(a) * 5.8, iconCy - Math.sin(a) * 5.8);
        this.ctx.lineTo(iconCx + Math.cos(a) * 5.8, iconCy + Math.sin(a) * 5.8);
        this.ctx.stroke();
      }

      this.ctx.restore();
      return true;
    }

    // 16. Windows Explorer / Files Apple Mac Icon
    if (k === 'explorer') {
      const grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
      grad.addColorStop(0, '#0284c7');
      grad.addColorStop(1, '#0369a1');

      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size, cr);
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.40)');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = sheen;
      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      this.ctx.lineWidth = 0.8;
      this.ctx.stroke();

      // File Folder Tab & Body in white
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.roundRect(iconCx - 5.5, iconCy - 3.2, 11, 7.6, 1.2);
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.moveTo(iconCx - 5.5, iconCy - 3.0);
      this.ctx.lineTo(iconCx - 2.0, iconCy - 5.0);
      this.ctx.lineTo(iconCx + 0.5, iconCy - 5.0);
      this.ctx.lineTo(iconCx + 2.0, iconCy - 3.0);
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.restore();
      return true;
    }

    // 17. Visual Studio Code Apple Mac Icon
    if (k === 'vscode') {
      const grad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
      grad.addColorStop(0, '#007acc');
      grad.addColorStop(1, '#005999');

      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size, cr);
      this.ctx.fillStyle = grad;
      this.ctx.fill();

      const sheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.40)');
      sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = sheen;
      this.ctx.beginPath();
      this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      this.ctx.lineWidth = 0.8;
      this.ctx.stroke();

      // Folded Ribbon Code Chevron `{}`
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.4;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      this.ctx.beginPath();
      this.ctx.moveTo(iconCx - 4.5, iconCy - 3.0);
      this.ctx.lineTo(iconCx - 1.5, iconCy - 4.8);
      this.ctx.lineTo(iconCx + 4.5, iconCy);
      this.ctx.lineTo(iconCx - 1.5, iconCy + 4.8);
      this.ctx.lineTo(iconCx - 4.5, iconCy + 3.0);
      this.ctx.stroke();

      this.ctx.restore();
      return true;
    }

    // =========================================================================
    // 18. Automatic Detection for Any System App (Apple Mac Style Vibrant Squircle)
    // =========================================================================
    const nameStr = (appName || titleStr || 'System').trim();
    let hash = 0;
    for (let i = 0; i < nameStr.length; i++) {
      hash = (hash << 5) - hash + nameStr.charCodeAt(i);
      hash |= 0;
    }
    const applePalettes = [
      ['#007aff', '#0051ba'], // Apple Blue
      ['#34c759', '#248a3d'], // Apple Green
      ['#5856d6', '#3634a3'], // Apple Indigo
      ['#af52de', '#7d26b0'], // Apple Purple
      ['#ff9500', '#c96800'], // Apple Orange
      ['#ff2d55', '#cc183b'], // Apple Pink
      ['#30b0c7', '#1a7787'], // Apple Teal
      ['#48484a', '#2c2c2e']  // Apple Graphite
    ];
    const palIdx = Math.abs(hash) % applePalettes.length;
    const [c1, c2] = applePalettes[palIdx];

    const autoGrad = this.ctx.createLinearGradient(sx, sy, sx, sy + size);
    autoGrad.addColorStop(0, c1);
    autoGrad.addColorStop(1, c2);

    this.ctx.beginPath();
    this.ctx.roundRect(sx, sy, size, size, cr);
    this.ctx.fillStyle = autoGrad;
    this.ctx.fill();

    // Top specular sheen
    const autoSheen = this.ctx.createLinearGradient(sx, sy, sx, sy + size * 0.5);
    autoSheen.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
    autoSheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    this.ctx.fillStyle = autoSheen;
    this.ctx.beginPath();
    this.ctx.roundRect(sx, sy, size, size * 0.5, [cr, cr, 0, 0]);
    this.ctx.fill();

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    this.ctx.lineWidth = 0.8;
    this.ctx.stroke();

    // Bold Apple Monogram Typography Letter
    const monogramChar = (nameStr[0] || 'S').toUpperCase();
    this.ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "SF Pro Rounded", "SF Pro Text", Inter, sans-serif';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(monogramChar, iconCx, iconCy + 0.5);

    this.ctx.restore();
    return true;
  }

  /**
   * TwoCode & Apple Dynamic Island Notification Content Renderer:
   * Direct parity with TwoCode ai-monitor-ui.js & Apple Dynamic Island.
   * - Left: Authentic Apple Mac / iOS Squircle App Icon (WhatsApp, Chrome, Mail, Safari/Download, etc.)
   * - Center: Title & body with graceful font and string truncation
   * - Right: Interactive Allow / Deny buttons, WhatsApp Reply chip, App Open chip, or circular dismiss button
   * - Expanded Quick Reply: Apple iPhone / Mac style WhatsApp text input & send button
   */
  /**
   * TwoCode Compact Music Island:
   * Direct parity with TwoCode ai-monitor-ui.js & spotify-ui.js.
   * Left: 24x24 px album cover with 7px rounded corners (cs = H - 12).
   * Middle: Synchronized live lyric line or track title in crisp white.
   * Right: Animated visualizer in extracted album color with soft glow.
   */
  public drawCompactMusicIsland(pillLeft: number, midY: number, topY: number): void {
    const H = this.currentHeight;
    const cy = midY;
    const left = pillLeft + 14;
    const right = pillLeft + this.currentWidth - 14;
    const mid = (left + right) / 2;
    const cs = Math.max(18, Math.min(22, H - 12)); // 22px square cover for clean inset matching TwoCode
    const coverX = left + 4;
    const coverY = cy - cs / 2;

    // 1. Cover Art (Left: coverX, coverY, cs, cs, radius 7)
    if (this._cachedCoverCanvas && cs === 22) {
      this.ctx.drawImage(this._cachedCoverCanvas, coverX, coverY);
    } else if (this.albumImageElement?.complete && this.albumImageElement.naturalWidth > 0) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.roundRect(coverX, coverY, cs, cs, 7);
      this.ctx.clip();
      this.ctx.drawImage(this.albumImageElement, coverX, coverY, cs, cs);
      this.ctx.restore();
    } else {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.roundRect(coverX, coverY, cs, cs, 7);
      this.ctx.fillStyle = '#1c1c1e';
      this.ctx.fill();
      this.ctx.strokeStyle = this.albumAccentColor || '#ffffff';
      this.ctx.fillStyle = this.albumAccentColor || '#ffffff';
      this.ctx.lineWidth = 1.4;
      this.ctx.beginPath();
      this.ctx.arc(coverX + 8, coverY + 15, 2.2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.moveTo(coverX + 10, coverY + 15);
      this.ctx.lineTo(coverX + 10, coverY + 7);
      this.ctx.lineTo(coverX + 15, coverY + 5);
      this.ctx.lineTo(coverX + 15, coverY + 12);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(coverX + 13, coverY + 12, 2.0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // 2. Visualizer (Right: 5 slim razor-sharp vertical bars matching TwoCode Image 2)
    // Sound-reactive: scales higher with loud sounds/beats and drops lower with soft quiet sounds
    const vizW = 18;
    const vizH = 14;
    const vizX = right - vizW - 4;
    const n = 5;
    const t = performance.now() / 1000;
    const playing = Boolean(this.mediaState.playing && this.mediaState.active);
    const gap = 2.0;
    const bw = (vizW - gap * (n - 1)) / n;
    const audioViz = SystemAudioVisualizer.getInstance();
    const levels = audioViz.getLevels(n);

    // Batch draw all 5 bars into 1 single canvas path (80% fewer GPU/CPU draw operations)
    this.ctx.save();
    this.ctx.beginPath();
    for (let i = 0; i < n; i++) {
      let raw = 0.06;
      if (playing) {
        if (levels) {
          raw = levels[i] || 0.06;
        } else {
          // Dynamic volume-aware acoustic fallback: distinct frequency bands & beat kicks
          const volFactor = this.volumeState.muted ? 0 : Math.max(0.2, (this.volumeState.level || 70) / 100);
          const beatKick = Math.pow(Math.max(0, Math.sin(t * 4.2)), 3); // ~130 BPM beat pulse
          const bandPattern = [
            0.35 + 0.65 * beatKick,                                       // Bar 0: Bass kick (60-180 Hz)
            0.25 + 0.55 * Math.abs(Math.sin(t * 3.1 + 0.6)),             // Bar 1: Low-Mid groove (180-500 Hz)
            0.30 + 0.60 * Math.abs(Math.sin(t * 5.4 + 1.2) * Math.cos(t * 2.1)), // Bar 2: Vocals (500-2000 Hz)
            0.20 + 0.70 * Math.pow(Math.max(0, Math.sin(t * 4.2 + Math.PI)), 4), // Bar 3: Snare (2-6 kHz)
            0.25 + 0.50 * Math.abs(Math.sin(t * 11.2))                   // Bar 4: Treble shimmer (6-12 kHz)
          ];
          const pattern = bandPattern[i % bandPattern.length];
          raw = Math.min(1, Math.max(0.06, pattern * volFactor));
        }
      }
      const want = !playing ? 0.1 : Math.min(1, 0.12 + 1.15 * Math.pow(raw, 0.65));
      if (!this.compactVizBars[i]) this.compactVizBars[i] = 0.15;
      this.compactVizBars[i] += (want - this.compactVizBars[i]) * (want > this.compactVizBars[i] ? 0.55 : 0.18);
      this.visualizerBars[i] = this.compactVizBars[i];

      const bh = Math.max(bw, vizH * Math.min(1, this.compactVizBars[i]));
      const bx = vizX + i * (bw + gap);
      const by = cy - bh / 2;
      this.ctx.roundRect(bx, by, bw, bh, bw / 2);
    }
    this.ctx.fillStyle = this.albumAccentColor || '#ffffff';
    this.ctx.shadowColor = this.albumAccentColor || '#ffffff';
    this.ctx.shadowBlur = 2;
    this.ctx.fill();
    this.ctx.restore();

    // 3. Middle Content: Synchronized Lyrics or Song / Ad Title (No eyes during media playback)
    const x0 = coverX + cs + 12;
    const x1 = vizX - 12;
    const w = Math.max(20, x1 - x0);
    const band = 20;

    // Resolve song/ad title text with cached formatting
    const getTrackDisplayName = (): string => {
      const title = (this.mediaState.title || '').trim();
      const artist = (this.mediaState.artist || '').trim();
      if (!title) return this.mediaState.app || 'Music';
      const key = `${title}|${artist}|${Math.round(w)}`;
      if (key === this._cachedTrackNameKey && this._cachedTrackDisplayName) {
        return this._cachedTrackDisplayName;
      }
      this._cachedTrackNameKey = key;
      if (artist && artist !== 'Spotify' && !title.toLowerCase().includes(artist.toLowerCase())) {
        const combined = `${title} - ${artist}`;
        this.ctx.save();
        this.ctx.font = '500 12.5px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        const fits = this.ctx.measureText(combined).width <= w;
        this.ctx.restore();
        if (fits) {
          this._cachedTrackDisplayName = combined;
          return combined;
        }
      }
      this._cachedTrackDisplayName = title;
      return title;
    };

    const trackName = getTrackDisplayName();
    const lyric = this.hasSyncedLyrics() ? this.getLyricNow() : null;
    const twoCodeLyricsFont = '600 13px Inter, "Segoe UI", sans-serif';

    const line = (s: string | null, dy: number, isBright: boolean = true) => {
      const alpha = Math.max(0, 1 - Math.abs(dy) / band);
      if (!s || alpha <= 0.01) return;
      this.ctx.save();
      this.ctx.globalAlpha *= alpha;

      // O(1) Cache lookup: eliminates 2,000+ synchronous measureText Skia layout calls per second
      const cacheKey = `${s}|${Math.round(w)}`;
      let fittedFont = this._lyricsCacheFont.get(cacheKey);
      let truncatedText = this._lyricsCacheText.get(cacheKey);

      if (!fittedFont || !truncatedText) {
        this.ctx.font = twoCodeLyricsFont;
        const full = this.ctx.measureText(s).width;
        fittedFont = twoCodeLyricsFont;
        if (full > w) {
          fittedFont = twoCodeLyricsFont.replace(/\d+(\.\d+)?px/, (m: string) => Math.max(10.5, parseFloat(m) * w / full).toFixed(1) + 'px');
        }
        this.ctx.font = fittedFont;

        let t = s;
        while (t.length > 1 && this.ctx.measureText(t).width > w) {
          t = t.slice(0, -2) + '…';
        }
        truncatedText = t;

        if (this._lyricsCacheFont.size > 50) {
          this._lyricsCacheFont.clear();
          this._lyricsCacheText.clear();
        }
        this._lyricsCacheFont.set(cacheKey, fittedFont);
        this._lyricsCacheText.set(cacheKey, truncatedText);
      }

      this.ctx.font = fittedFont;
      this.ctx.fillStyle = isBright ? '#ffffff' : 'rgba(255, 255, 255, 0.45)';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      if (isBright) {
        this.ctx.shadowColor = 'rgba(255, 255, 255, 0.30)';
        this.ctx.shadowBlur = 3;
      }
      this.ctx.fillText(truncatedText, x0 + w / 2, cy + 0.5 + dy);
      this.ctx.restore();
    };

    if (lyric && (lyric.text || lyric.previous)) {
      const k = lyric.k;
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(x0 - 4, cy - band / 2 - 2, w + 8, band + 4);
      this.ctx.clip();
      line(lyric.previous, -band * k, false);
      line(lyric.text, band * (1 - k), true);
      this.ctx.restore();
    } else {
      // Steady display of Track Name or Ad Name (zero eyes during media playback)
      line(trackName, 0, true);
    }
  }

  /**
   * Apple Mac / iOS Style Detached Download Circle Bubble ( ○ )
   * Features:
   * - 36px circular platter with continuous rim stroke
   * - Progress ring with glowing cyan arc (#00d2ff)
   * - Single download: Bobbing downward arrow + platter tray
   * - Multiple downloads: Centered bold download count badge (e.g. "2") + mini downward arrow
   */
  public drawDetachedDownloadBubble(bubbleCx: number, bubbleCy: number, bubbleR: number, downloads: any[]): void {
    const ringR = Math.max(7, bubbleR - 8);
    const count = downloads.length;

    this.ctx.save();

    // 1. Dim track ring (Apple Mac Safari download style)
    this.ctx.lineWidth = 2.4;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.arc(bubbleCx, bubbleCy, ringR, 0, Math.PI * 2);
    this.ctx.strokeStyle = 'rgba(0, 210, 255, 0.22)';
    this.ctx.stroke();

    // 2. Active cyan progress arc
    let hasKnownProgress = false;
    let avgProgress = 0;
    let knownCount = 0;
    for (const d of downloads) {
      if (typeof d.percent === 'number' && d.percent > 0) {
        avgProgress += d.percent;
        knownCount++;
      }
    }
    if (knownCount > 0) {
      avgProgress /= knownCount;
      hasKnownProgress = true;
    }

    this.ctx.beginPath();
    if (hasKnownProgress) {
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + Math.PI * 2 * Math.min(1, Math.max(0.05, avgProgress));
      this.ctx.arc(bubbleCx, bubbleCy, ringR, startAngle, endAngle);
    } else {
      // Indeterminate smooth Apple Safari rotation
      const rot = (performance.now() / 450) % (Math.PI * 2);
      this.ctx.arc(bubbleCx, bubbleCy, ringR, rot, rot + Math.PI * 0.95);
    }

    this.ctx.strokeStyle = '#00d2ff';
    this.ctx.shadowColor = 'rgba(0, 210, 255, 0.65)';
    this.ctx.shadowBlur = 5;
    this.ctx.stroke();
    this.ctx.restore();

    // 3. Inside Content: Bobbing arrow or download count
    if (count > 1) {
      // Multiple simultaneous downloads: Show bold badge count
      this.ctx.save();
      this.ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "SF Pro Rounded", Inter, "Segoe UI", sans-serif';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(String(count), bubbleCx, bubbleCy - 1.5);

      // Mini downward arrowhead below the count
      this.ctx.strokeStyle = '#00d2ff';
      this.ctx.lineWidth = 1.3;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(bubbleCx - 2.5, bubbleCy + 5.0);
      this.ctx.lineTo(bubbleCx, bubbleCy + 7.5);
      this.ctx.lineTo(bubbleCx + 2.5, bubbleCy + 5.0);
      this.ctx.stroke();
      this.ctx.restore();
    } else {
      // Single download: Apple Mac Safari bobbing downward arrow + tray platter
      const arrowBob = Math.sin(performance.now() / 240) * 0.7;
      this.ctx.save();
      this.ctx.strokeStyle = '#00d2ff';
      this.ctx.lineWidth = 1.4;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      // Downward Arrow
      this.ctx.beginPath();
      this.ctx.moveTo(bubbleCx, bubbleCy - 3.4 + arrowBob);
      this.ctx.lineTo(bubbleCx, bubbleCy + 1.8 + arrowBob);
      this.ctx.moveTo(bubbleCx - 2.4, bubbleCy - 0.2 + arrowBob);
      this.ctx.lineTo(bubbleCx, bubbleCy + 2.0 + arrowBob);
      this.ctx.lineTo(bubbleCx + 2.4, bubbleCy - 0.2 + arrowBob);
      this.ctx.stroke();

      // Platter tray line
      this.ctx.beginPath();
      this.ctx.moveTo(bubbleCx - 3.4, bubbleCy + 4.2);
      this.ctx.lineTo(bubbleCx + 3.4, bubbleCy + 4.2);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  /**
   * Compact Single Download Platter (When No Music is Playing)
   * Left: Apple Safari Download Icon Squircle with Progress Ring
   * Center: Real filename + Formatted Size & Speed
   * Right: Clean Folder Reveal Glyph
   */
  public drawCompactDownloadContent(pillLeft: number, midY: number, topY: number, dl: any): void {
    if (!dl) return;
    const cy = midY;
    const left = pillLeft + 14;
    const right = pillLeft + this.currentWidth - 14;

    // Left: Apple Mac Safari Download App Icon
    const iconR = 11;
    const iconCx = left + 9;
    this.drawAppleAppIcon(iconCx, cy, iconR, 'download', dl.status);

    // Center: Filename & Transfer Metric
    const textLeft = left + 27;
    const textRight = right - 24;
    const maxW = Math.max(60, textRight - textLeft);

    const titleFont = '600 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
    const subFont = '400 10.5px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';

    const cleanTitle = dl.cleanName || 'Downloading File...';
    const truncTitle = this.truncateText(cleanTitle, maxW, titleFont);

    const sizeStr = typeof dl.bytes === 'number' ? this.formatBytes(dl.bytes) : '';
    const speedStr = dl.speedStr ? ` • ${dl.speedStr}` : '';
    const metricStr = `${sizeStr}${speedStr}` || 'Downloading...';

    this.ctx.save();
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';

    // Title line
    this.ctx.font = titleFont;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText(truncTitle, textLeft, cy - 6);

    // Subtitle / Speed line
    this.ctx.font = subFont;
    this.ctx.fillStyle = 'rgba(0, 210, 255, 0.9)';
    this.ctx.fillText(metricStr, textLeft, cy + 7);

    // Right: Folder reveal icon (Apple style folder glyph)
    const folderX = right - 10;
    const folderY = cy;
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    this.ctx.lineWidth = 1.2;
    this.ctx.beginPath();
    this.ctx.roundRect(folderX - 7, folderY - 5, 14, 10, 1.5);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(folderX - 5, folderY - 5);
    this.ctx.lineTo(folderX - 2, folderY - 7);
    this.ctx.lineTo(folderX + 1, folderY - 7);
    this.ctx.lineTo(folderX + 2, folderY - 5);
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * TwoCode Compact Resting Island (matching Screenshot 2):
   * Clean single black pill (98 x 26 px, radius 13px rendered by drawIslandPill).
   * Mascot Eyes centered vertically at cy = topY + currentHeight / 2 (topY + 13px).
   * Zero unwanted cyan shapes/paws beneath the eyes, zero clipping artifacts.
   */
  public drawCompactRestingDualStructure(cx: number, topY: number): void {
    if (this.isBuddyOut) {
      // Mascot is detached and exploring desktop: eyes hidden from island
      return;
    }
    const eyeCy = topY + this.currentHeight / 2;

    // TwoCode Windows Startup Entrance Animation (twocode-fun.js lines 305-404 & 569-598)
    if (this.isStartupHelloBusy && this.startupHelloStartTime > 0) {
      const t = performance.now();
      const k = t - this.startupHelloStartTime;
      let scale = 1.2; // TwoCode: he stands in the middle of the island a bit bigger: he is the show!

      // TwoCode ease-out-back pop entrance (twocode-fun.js lines 570-571)
      const pop = (t - this.popAt) / 420;
      if (pop >= 0 && pop < 1) {
        scale *= 1 + 2.70158 * Math.pow(pop - 1, 3) + 1.70158 * Math.pow(pop - 1, 2);
      }
      if (k < 180) {
        scale = 0; // Island is popping open first
      }

      // TwoCode squash & stretch + hop + tilt (twocode-fun.js lines 572-581)
      let sx = 1, sy = 1, dy = 0, tilt = 0;
      const land = this.twoCodeSpring(k - 380, 0.3, 3.2, 7);
      const hi = this.twoCodeSpring(k - 700, -0.22, 3, 6);
      sx += land + hi;
      sy -= land + hi;

      const hop = (k - 700) / 450;
      if (hop > 0 && hop < 1) {
        dy -= Math.sin(hop * Math.PI) * 7;
      }
      const hehe = (k - 1300) / 600;
      if (hehe > 0 && hehe < 1) {
        tilt += Math.sin(hehe * Math.PI * 2) * 0.22 * (1 - hehe);
      }

      this.ctx.save();
      this.ctx.translate(cx, eyeCy + dy);
      this.ctx.rotate(tilt);
      this.ctx.scale(scale * sx, scale * sy);
      this.mascot.drawFloatingEyes(this.ctx, 0, 0, 1.0);
      this.ctx.restore();

      // TwoCode floating pink heart (twocode-fun.js lines 594-598)
      const hk = (k - 700 - 120) / 900;
      if (hk > 0 && hk < 1) {
        this.ctx.save();
        this.ctx.globalAlpha = hk < 0.7 ? 1 : 1 - (hk - 0.7) / 0.3;
        this.ctx.translate(cx + 20 + Math.sin(hk * 6) * 3, eyeCy - 34 - hk * 22);
        this.ctx.scale(1 + hk * 0.6, 1 + hk * 0.6);
        this.ctx.fillStyle = '#ff7eb6';
        this.ctx.beginPath();
        this.ctx.moveTo(0, 4);
        this.ctx.bezierCurveTo(-9, -3, -5, -11, 0, -6);
        this.ctx.bezierCurveTo(5, -11, 9, -3, 0, 4);
        this.ctx.fill();
        this.ctx.restore();
      }
      return;
    }

    if (this.mediaState.playing) {
      // Feature A: Compact Micro-Waveform Equalizer
      this.mascot.drawFloatingEyes(this.ctx, cx - 10, eyeCy, 0.95);
      this.drawMicroEqualizer(cx + 24, eyeCy);
      return;
    }

    const leftItem = this.config?.restLeft && this.config.restLeft !== 'none' ? this.config.restLeft : null;
    const rightItem = this.config?.restRight && this.config.restRight !== 'none' ? this.config.restRight : null;

    if (!leftItem && !rightItem) {
      this.mascot.drawFloatingEyes(this.ctx, cx, eyeCy, 1.0);
      return;
    }

    // Configurable Resting Island Telemetry (TwoCode rest-ui.js Parity)
    const pillLeft = cx - this.currentWidth / 2;
    const pillRight = cx + this.currentWidth / 2;
    const pad = 12;

    if (leftItem) {
      this.drawRestTelemetryItem(leftItem, pillLeft + pad, eyeCy, 'left');
    }
    if (rightItem) {
      this.drawRestTelemetryItem(rightItem, pillRight - pad, eyeCy, 'right');
    }

    this.mascot.drawFloatingEyes(this.ctx, cx, eyeCy, 0.95);
  }

  // =========================================================================
  // Resting Island Telemetry Indicators (TwoCode rest-ui.js Parity)
  // =========================================================================
  public drawBatteryGlyph(x: number, cy: number, level: number, charging: boolean): void {
    const GLYPH = 17;
    const h = 8;
    const y = cy - h / 2;
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.roundRect(x + 0.5, y + 0.5, GLYPH - 1, h - 1, 2.5);
    this.ctx.stroke();
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.fillRect(x + GLYPH + 0.5, cy - 1.5, 1.6, 3);
    this.ctx.fillStyle = charging ? '#34c759' : level <= 0.2 ? '#ff453a' : '#ffffff';
    this.ctx.beginPath();
    this.ctx.roundRect(x + 2, y + 2, Math.max(1.5, (GLYPH - 4) * level), h - 4, 1.2);
    this.ctx.fill();
    this.ctx.restore();
  }

  public drawWifiGlyph(x: number, cy: number, size: number = 14, levels: number = 4): void {
    const cx = x + size / 2;
    const by = cy + size * 0.34;
    const lw = size * 0.13;
    const a0 = -Math.PI * 0.75;
    const a1 = -Math.PI * 0.25;
    const DIM = 'rgba(255, 255, 255, 0.28)';
    const colour = '#ffffff';

    this.ctx.save();
    this.ctx.lineCap = 'round';
    this.ctx.lineWidth = lw;
    this.ctx.beginPath();
    this.ctx.moveTo(cx, by);
    this.ctx.arc(cx, by, size * 0.2, a0, a1);
    this.ctx.closePath();
    this.ctx.fillStyle = levels >= 1 ? colour : DIM;
    this.ctx.fill();

    [0.41, 0.62].forEach((r, i) => {
      this.ctx.beginPath();
      this.ctx.arc(cx, by, size * r, a0, a1);
      this.ctx.strokeStyle = levels >= i + 2 ? colour : DIM;
      this.ctx.stroke();
    });
    this.ctx.restore();
  }

  public drawBtGlyph(x: number, cy: number, h: number = 14, colour: string = '#ffffff'): void {
    const w = h * 0.5;
    const l = x - w / 2;
    const r = x + w / 2;
    const t = cy - h / 2;
    const b = cy + h / 2;

    this.ctx.save();
    this.ctx.lineWidth = Math.max(1.4, h * 0.12);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = colour;
    this.ctx.beginPath();
    this.ctx.moveTo(l, t + h * 0.27);
    this.ctx.lineTo(r, t + h * 0.73);
    this.ctx.lineTo(x, b);
    this.ctx.lineTo(x, t);
    this.ctx.lineTo(r, t + h * 0.27);
    this.ctx.lineTo(l, t + h * 0.73);
    this.ctx.stroke();
    this.ctx.restore();
  }

  public getRestItemText(kind: string): string {
    if (kind === 'time') {
      const d = new Date();
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    if (kind === 'battery') {
      return `${Math.round(this.batteryState.level)}%`;
    }
    if (kind === 'cpu') {
      const val = this.metricsState?.cpu ?? this.config?.lastCpuPercent ?? 12;
      return `CPU ${Math.round(val)}%`;
    }
    if (kind === 'ram') {
      const val = this.metricsState?.ram ?? this.config?.lastRamPercent ?? 42;
      return `RAM ${Math.round(val)}%`;
    }
    if (kind === 'storage' || kind === 'disk') {
      const val = this.metricsState?.storage?.percent ?? 55;
      return `SSD ${Math.round(val)}%`;
    }
    return '';
  }

  public measureRestItem(kind: string): number {
    if (!kind || kind === 'none') return 0;
    if (kind === 'wifi') return 14;
    if (kind === 'bluetooth') return 10;
    const txt = this.getRestItemText(kind);
    this.ctx.save();
    this.ctx.font = '600 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const w = this.ctx.measureText(txt).width;
    this.ctx.restore();
    return w + (kind === 'battery' ? 17 + 2 + 5 : 0);
  }

  public drawRestTelemetryItem(kind: string, x: number, cy: number, align: 'left' | 'right' | 'middle'): void {
    const w = this.measureRestItem(kind);
    const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
    let tx = x0;

    if (kind === 'wifi') {
      this.drawWifiGlyph(x0, cy, 14, this.netState.bars || 4);
      return;
    }
    if (kind === 'bluetooth') {
      this.drawBtGlyph(x0 + 5, cy, 14, this.netState.btOn ? '#ffffff' : 'rgba(255, 255, 255, 0.35)');
      return;
    }
    if (kind === 'battery') {
      this.drawBatteryGlyph(x0, cy, (this.batteryState.level || 100) / 100, this.batteryState.charging);
      tx += 17 + 2 + 5;
    }

    this.ctx.save();
    this.ctx.font = '600 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(this.getRestItemText(kind), tx, cy + 0.5);
    this.ctx.restore();
  }

  public calculateRestWidth(): number {
    const leftItem = this.config?.restLeft && this.config.restLeft !== 'none' ? this.config.restLeft : null;
    const rightItem = this.config?.restRight && this.config.restRight !== 'none' ? this.config.restRight : null;
    const PAD = 14;
    const EYES_HALF = 19;
    const GAP = 12;
    const REST = 98;

    if (!leftItem && !rightItem) return REST;
    if (leftItem && rightItem) {
      return Math.max(140, Math.ceil(2 * (PAD + Math.max(this.measureRestItem(leftItem), this.measureRestItem(rightItem)) + GAP + EYES_HALF)));
    }
    return Math.max(120, Math.ceil(2 * PAD + this.measureRestItem(leftItem || rightItem) + GAP + 2 * EYES_HALF));
  }

  /**
   * Feature A: Animated 3-bar Micro Equalizer for Compact Mode
   */
  public drawMicroEqualizer(x: number, y: number, color: string = '#00e5ff'): void {
    const bars = 3;
    const barWidth = 2.2;
    const barSpacing = 4.2;
    const now = performance.now() * 0.009;
    const heights = [
      Math.max(2.5, 3 + Math.sin(now * 1.2) * 4.5),
      Math.max(3.5, 5 + Math.sin(now * 1.8 + 1.2) * 6.0),
      Math.max(2.0, 3 + Math.sin(now * 1.5 + 2.4) * 4.0)
    ];

    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 4;
    for (let i = 0; i < bars; i++) {
      const h = this.mediaState.playing ? heights[i] : 2.5;
      const bx = x + i * barSpacing;
      const by = y - h / 2;
      this.ctx.beginPath();
      this.ctx.roundRect(bx, by, barWidth, h, 1);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  /**
   * Apple-Style Hardware Speedometer Telemetry HUD (Zero Unicode Emojis)
   * Renders 3 circular 240-degree speedometer tachometer gauges for CPU, RAM, and Storage (SSD)
   * with performance-adaptive color rings (Green -> Amber -> Red), rotating needles, and live readouts.
   */
  private drawSpeedometerHudContent(cx: number, topY: number): void {
    const pillLeft = cx - this.currentWidth / 2;
    const midY = topY + this.currentHeight / 2;

    const cpuVal = Math.max(0, Math.min(100, Math.round(this.metricsState?.cpu ?? this.config?.lastCpuPercent ?? 18)));
    const ramVal = Math.max(0, Math.min(100, Math.round(this.metricsState?.ram ?? this.config?.lastRamPercent ?? 45)));
    const ssdVal = Math.max(0, Math.min(100, Math.round(this.metricsState?.storage?.percent ?? 72)));

    const cpuColor = this.getAppleGaugeColor(cpuVal);
    const ramColor = this.getAppleGaugeColor(ramVal);
    const ssdColor = this.getAppleGaugeColor(ssdVal);

    const totalWidth = this.currentWidth;
    const bayWidth = totalWidth / 3;

    this.ctx.save();

    // Subtle divider lines between bays
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(pillLeft + bayWidth, midY - 14);
    this.ctx.lineTo(pillLeft + bayWidth, midY + 14);
    this.ctx.moveTo(pillLeft + bayWidth * 2, midY - 14);
    this.ctx.lineTo(pillLeft + bayWidth * 2, midY + 14);
    this.ctx.stroke();

    // Helper to render an individual Apple Speedometer Dial
    const renderGauge = (
      centerX: number,
      title: string,
      percent: number,
      subText: string,
      colorInfo: { hex: string; glow: string; track: string }
    ) => {
      const dialR = 12.5;
      const dialX = centerX - 26;
      const dialY = midY;

      // 1. Frosted Background Track Arc (240 degrees, from 135 deg to 405 deg)
      const startAngle = 0.75 * Math.PI;
      const totalSweep = 1.5 * Math.PI;
      const endAngle = startAngle + totalSweep;

      this.ctx.save();
      this.ctx.strokeStyle = colorInfo.track;
      this.ctx.lineWidth = 2.6;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.arc(dialX, dialY, dialR, startAngle, endAngle);
      this.ctx.stroke();

      // 2. Active Illuminated Progress Ring
      const activeAngle = startAngle + (totalSweep * (percent / 100));
      this.ctx.strokeStyle = colorInfo.hex;
      this.ctx.shadowColor = colorInfo.glow;
      this.ctx.shadowBlur = 6;
      this.ctx.beginPath();
      this.ctx.arc(dialX, dialY, dialR, startAngle, activeAngle);
      this.ctx.stroke();

      // 3. Speedometer Needle & Center Pivot
      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(dialX, dialY, 1.8, 0, Math.PI * 2);
      this.ctx.fill();

      // Sleek Needle line
      const needleLen = 9.5;
      const nx = dialX + Math.cos(activeAngle) * needleLen;
      const ny = dialY + Math.sin(activeAngle) * needleLen;
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.2;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(dialX, dialY);
      this.ctx.lineTo(nx, ny);
      this.ctx.stroke();
      this.ctx.restore();

      // 4. Metric Readout Text (Right of Dial)
      this.ctx.save();
      const textX = dialX + dialR + 7;

      // Title & Percentage
      this.ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "SF Pro Rounded", "Segoe UI", sans-serif';
      this.ctx.fillStyle = colorInfo.hex;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'alphabetic';
      this.ctx.fillText(`${title} ${percent}%`, textX, midY - 1);

      // Subtitle (Cores, Memory GB, or SSD Free)
      this.ctx.font = '500 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.60)';
      this.ctx.fillText(subText, textX, midY + 11);
      this.ctx.restore();
    };

    // Bay 1: CPU Speedometer
    const cores = this.metricsState?.cores || 8;
    renderGauge(pillLeft + bayWidth * 0.5, 'CPU', cpuVal, `${cores} Cores`, cpuColor);

    // Bay 2: RAM Speedometer
    const usedMb = this.metricsState?.usedMemMb || 7373;
    const usedGb = (usedMb / 1024).toFixed(1);
    renderGauge(pillLeft + bayWidth * 1.5, 'RAM', ramVal, `${usedGb} GB`, ramColor);

    // Bay 3: Storage (SSD) Speedometer
    const freeSsd = this.metricsState?.storage?.freeGb ?? 77;
    renderGauge(pillLeft + bayWidth * 2.5, 'SSD', ssdVal, `${freeSsd}GB Free`, ssdColor);

    this.ctx.restore();
  }

  /**
   * Apple-Style Hardware Volume Pop HUD (Zero Unicode Emojis)
   * Renders sleek animated speaker vector icon, horizontal pill progress track, and numeric percentage
   */
  private drawVolumeHudContent(cx: number, topY: number): void {
    const pillLeft = cx - this.currentWidth / 2;
    const midY = topY + this.currentHeight / 2;
    const isMuted = this.volumeHudMuted || this.volumeHudLevel === 0;
    const level = isMuted ? 0 : this.volumeHudLevel;

    this.ctx.save();

    // 1. Vector Speaker Icon (Left)
    const spkX = pillLeft + 26;
    const spkY = midY;

    this.ctx.fillStyle = isMuted ? '#ff453a' : 'rgba(255, 255, 255, 0.95)';
    this.ctx.strokeStyle = isMuted ? '#ff453a' : 'rgba(255, 255, 255, 0.95)';

    // Speaker body (box + cone flare)
    this.ctx.beginPath();
    this.ctx.rect(spkX - 8, spkY - 3.5, 3.5, 7);
    this.ctx.fill();

    // Cone
    this.ctx.beginPath();
    this.ctx.moveTo(spkX - 4.5, spkY - 3.5);
    this.ctx.lineTo(spkX + 1.5, spkY - 7.5);
    this.ctx.lineTo(spkX + 1.5, spkY + 7.5);
    this.ctx.lineTo(spkX - 4.5, spkY + 3.5);
    this.ctx.closePath();
    this.ctx.fill();

    // Sound waves or Mute cross
    if (isMuted) {
      this.ctx.lineWidth = 1.6;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(spkX + 5, spkY - 4);
      this.ctx.lineTo(spkX + 11, spkY + 4);
      this.ctx.moveTo(spkX + 11, spkY - 4);
      this.ctx.lineTo(spkX + 5, spkY + 4);
      this.ctx.stroke();
    } else {
      this.ctx.lineWidth = 1.5;
      this.ctx.lineCap = 'round';

      // Wave 1 (Low, level > 0)
      if (level > 0) {
        this.ctx.beginPath();
        this.ctx.arc(spkX - 0.5, spkY, 5.5, -0.65, 0.65);
        this.ctx.stroke();
      }

      // Wave 2 (Medium, level > 33)
      if (level > 33) {
        this.ctx.beginPath();
        this.ctx.arc(spkX - 0.5, spkY, 9.5, -0.70, 0.70);
        this.ctx.stroke();
      }

      // Wave 3 (High, level > 66)
      if (level > 66) {
        this.ctx.beginPath();
        this.ctx.arc(spkX - 0.5, spkY, 13.5, -0.75, 0.75);
        this.ctx.stroke();
      }
    }

    // 2. Volume Pill Track (Center)
    const trackX = pillLeft + 52;
    const trackRight = pillLeft + this.currentWidth - 52;
    const trackW = Math.max(20, trackRight - trackX);
    const trackH = 7;
    const trackY = midY - trackH / 2;
    const trackR = trackH / 2;

    // Track Background (Dark frosted glass track)
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    this.ctx.beginPath();
    this.ctx.roundRect(trackX, trackY, trackW, trackH, trackR);
    this.ctx.fill();

    // Track Fill (Pure white or amber/red with rounded corners)
    const fillW = Math.max(0, Math.min(trackW, (trackW * level) / 100));
    if (fillW > 0) {
      this.ctx.fillStyle = isMuted ? '#ff453a' : 'rgba(255, 255, 255, 0.96)';
      this.ctx.shadowColor = isMuted ? 'rgba(255, 69, 58, 0.5)' : 'rgba(255, 255, 255, 0.35)';
      this.ctx.shadowBlur = 4;
      this.ctx.beginPath();
      this.ctx.roundRect(trackX, trackY, fillW, trackH, trackR);
      this.ctx.fill();
    }

    // 3. Numeric Percentage Digits or Muted Status (Right)
    this.ctx.shadowBlur = 0;
    const textX = pillLeft + this.currentWidth - 16;
    this.ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "SF Pro Rounded", "Segoe UI", sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'middle';

    if (isMuted) {
      this.ctx.fillStyle = '#ff453a';
      this.ctx.fillText('Muted', textX, midY);
    } else {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      this.ctx.fillText(`${level}%`, textX, midY);
    }

    this.ctx.restore();
  }

  /**
   * iOS / Mac Fluid Premium Charging Dynamic Island HUD
   * - Crisp Mascot bounce with energetic eye expression
   * - Elegant "Charging" / "On Battery" SF Pro Text typography
   * - Glowing green Apple battery percentage (SF Pro Rounded bold)
   * - Apple Battery Capsule with rounded cap & fluid liquid energy gradient
   * - Pure white glowing Apple Lightning Bolt centered inside the battery
   * - Animated energy wave pulse
   */
  private drawChargerSurgeContent(cx: number, topY: number): void {
    const pillLeft = cx - this.currentWidth / 2;
    const pillRight = cx + this.currentWidth / 2;
    const midY = topY + this.currentHeight / 2;
    const isCharging = this.chargerSurgeCharging;
    const level = Math.max(0, Math.min(100, Math.round(this.chargerSurgeLevel)));
    const now = performance.now();
    const elapsed = now - (this.chargerSurgeStartTime || (now - 400));

    // 1. Left: Energized Mascot + Subtitle
    this.ctx.save();
    const eyeBob = isCharging ? Math.sin(elapsed * 0.007) * 1.5 : 0;
    this.mascot.drawFloatingEyes(this.ctx, pillLeft + 30, midY + eyeBob, 0.95);

    // Dynamic Status label
    const statusText = isCharging ? 'Charging' : 'On Battery';
    this.ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    this.ctx.shadowBlur = 4;
    this.ctx.fillText(statusText, pillLeft + 54, midY);

    // Subtle divider dot
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    this.ctx.beginPath();
    this.ctx.arc(cx - 10, midY, 2, 0, Math.PI * 2);
    this.ctx.fill();

    // 2. Right: Apple SF Pro Rounded Percentage + Fluid Battery Capsule
    const capW = 34;
    const capH = 17;
    const capR = 4.5;
    const notchW = 2.5;
    const notchH = 6;
    const notchR = 1.2;

    const bX = pillRight - 46;
    const bY = midY - capH / 2;

    // Percentage Text (Right aligned to the left of the battery capsule)
    this.ctx.font = '700 14px -apple-system, BlinkMacSystemFont, "SF Pro Rounded", "SF Pro Text", "Segoe UI", sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'middle';

    if (isCharging) {
      this.ctx.fillStyle = '#34c759';
      this.ctx.shadowColor = 'rgba(52, 199, 89, 0.75)';
      this.ctx.shadowBlur = 8;
    } else {
      this.ctx.fillStyle = level <= 20 ? '#ff453a' : 'rgba(255, 255, 255, 0.95)';
      this.ctx.shadowColor = level <= 20 ? 'rgba(255, 69, 58, 0.6)' : 'rgba(0, 0, 0, 0.3)';
      this.ctx.shadowBlur = 4;
    }
    this.ctx.fillText(`${level}%`, bX - 8, midY);
    this.ctx.shadowBlur = 0;

    // Helper to draw rounded rectangle safely on any canvas
    const drawPillRect = (x: number, y: number, w: number, h: number, r: number) => {
      this.ctx.beginPath();
      if (typeof (this.ctx as any).roundRect === 'function') {
        (this.ctx as any).roundRect(x, y, w, h, r);
      } else {
        const rad = Math.min(r, w / 2, h / 2);
        this.ctx.moveTo(x + rad, y);
        this.ctx.arcTo(x + w, y, x + w, y + h, rad);
        this.ctx.arcTo(x + w, y + h, x, y + h, rad);
        this.ctx.arcTo(x, y + h, x, y, rad);
        this.ctx.arcTo(x, y, x + w, y, rad);
        this.ctx.closePath();
      }
    };

    // Outer Battery Outline
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    this.ctx.lineWidth = 1.6;
    drawPillRect(bX, bY, capW, capH, capR);
    this.ctx.stroke();

    // Terminal Notch on right
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    drawPillRect(bX + capW + 1.2, midY - notchH / 2, notchW, notchH, notchR);
    this.ctx.fill();

    // Inner Liquid Energy Fill
    const innerPad = 2.2;
    const maxFillW = capW - innerPad * 2;
    const fillH = capH - innerPad * 2;
    const fillW = Math.max(3, maxFillW * (level / 100));

    this.ctx.save();
    drawPillRect(bX + innerPad, bY + innerPad, fillW, fillH, 2.5);
    this.ctx.clip();

    if (isCharging) {
      // Flowing fluid neon green energy gradient
      const fillGrad = this.ctx.createLinearGradient(bX + innerPad, 0, bX + innerPad + maxFillW, 0);
      fillGrad.addColorStop(0, '#30d158');
      fillGrad.addColorStop(0.5, '#34c759');
      fillGrad.addColorStop(1, '#63e6be');
      this.ctx.fillStyle = fillGrad;
      this.ctx.fillRect(bX + innerPad, bY + innerPad, fillW, fillH);

      // Subtle traveling shine highlight wave across the fluid energy
      const shinePhase = (elapsed * 0.0025) % 1;
      const shineX = bX + innerPad + (fillW + 16) * shinePhase - 8;
      const shineGrad = this.ctx.createLinearGradient(shineX - 8, 0, shineX + 8, 0);
      shineGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      shineGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.45)');
      shineGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = shineGrad;
      this.ctx.fillRect(bX + innerPad, bY + innerPad, fillW, fillH);
    } else {
      this.ctx.fillStyle = level <= 20 ? '#ff453a' : '#ffffff';
      this.ctx.fillRect(bX + innerPad, bY + innerPad, fillW, fillH);
    }
    this.ctx.restore();

    // Iconic Apple Lightning Bolt (Rendered centered in the battery capsule when charging)
    if (isCharging) {
      const boltX = bX + capW / 2;
      const boltY = midY;
      this.ctx.save();
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      this.ctx.shadowBlur = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(boltX + 2.4, boltY - 5.5);
      this.ctx.lineTo(boltX - 2.8, boltY - 0.4);
      this.ctx.lineTo(boltX + 0.5, boltY - 0.4);
      this.ctx.lineTo(boltX - 1.6, boltY + 5.5);
      this.ctx.lineTo(boltX + 3.2, boltY + 0.4);
      this.ctx.lineTo(boltX + 0.4, boltY + 0.4);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();
    }

    this.ctx.restore();
  }

  private drawWaveform(x: number, y: number): void {
    const bars = 4;
    const now = performance.now() * 0.008;
    this.ctx.fillStyle = '#00d2ff';
    for (let i = 0; i < bars; i++) {
      const h = this.mediaState.playing ? 4 + Math.sin(now + i * 1.5) * 5 : 3;
      this.ctx.fillRect(x + i * 4, y - h / 2, 2, h);
    }
  }

  private drawExpandedContent(cx: number, topY: number): void {
    this.ctx.save();
    const pillLeft = cx - this.currentWidth / 2;

    // Header Controls (Canvas fallback mode)
    this.ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('CONFIG', pillLeft + 36, topY + 28);
    this.ctx.fillText('CLOSE', pillLeft + this.currentWidth - 36, topY + 28);

    // Tab Navigation Bar
    const tabsY = topY + 28;
    const tabs: Array<{ id: IslandTab; label: string; x: number }> = [
      { id: 'media', label: 'Music', x: cx - 140 },
      { id: 'home', label: 'System', x: cx - 60 },
      { id: 'ai', label: 'AI', x: cx + 20 },
      { id: 'tools', label: 'Tools', x: cx + 90 },
      { id: 'focus', label: 'Focus', x: cx + 160 }
    ];

    for (const t of tabs) {
      const isSelected = this.activeTab === t.id;
      this.ctx.font = isSelected
        ? '600 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        : '500 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = isSelected ? '#00d2ff' : 'rgba(255, 255, 255, 0.45)';
      this.ctx.fillText(t.label, t.x, tabsY);

      if (isSelected) {
        this.ctx.fillStyle = '#00d2ff';
        this.ctx.beginPath();
        this.ctx.roundRect(t.x - 14, tabsY + 6, 28, 2, 1);
        this.ctx.fill();
      }
    }

    // Divider Line
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(pillLeft + 24, topY + 44);
    this.ctx.lineTo(pillLeft + this.currentWidth - 24, topY + 44);
    this.ctx.stroke();

    // Render Tab View
    if (this.activeTab === 'media') {
      this.drawMediaTab(cx, topY);
    } else if (this.activeTab === 'home') {
      this.drawHomeTab(cx, topY);
    } else if (this.activeTab === 'ai') {
      this.drawAiTab(cx, topY);
    } else if (this.activeTab === 'tools') {
      this.drawToolsTab(cx, topY);
    } else if (this.activeTab === 'focus') {
      this.drawFocusTab(cx, topY);
    }

    this.ctx.restore();
  }

  // Vector media icons (Direct TwoCode spotify-ui.js parity: crisper than text glyphs)
  private mediaIcon(kind: 'play' | 'pause' | 'prev' | 'next', x: number, y: number, s: number, colour: string): void {
    this.ctx.save();
    this.ctx.fillStyle = colour;
    this.ctx.beginPath();
    const tri = (x0: number, dir: number) => {
      this.ctx.moveTo(x0, y - s / 2);
      this.ctx.lineTo(x0 + dir * s * 0.75, y);
      this.ctx.lineTo(x0, y + s / 2);
      this.ctx.closePath();
    };
    if (kind === 'play') {
      tri(x - s * 0.3, 1);
    } else if (kind === 'pause') {
      this.ctx.roundRect(x - s * 0.4, y - s / 2, s * 0.28, s, 2);
      this.ctx.roundRect(x + s * 0.12, y - s / 2, s * 0.28, s, 2);
    } else {
      const d = kind === 'next' ? 1 : -1;
      tri(x - d * s * 0.6, d);
      tri(x - d * s * 0.05, d);
      this.ctx.roundRect(x + d * s * 0.7 - (d > 0 ? 0 : s * 0.16), y - s / 2, s * 0.16, s, 1);
    }
    this.ctx.fill();
    this.ctx.restore();
  }

  // Device vector icon (TwoCode spotify-ui.js parity)
  private devIcon(type: string, x: number, y: number, s: number, colour: string): void {
    this.ctx.save();
    this.ctx.strokeStyle = colour;
    this.ctx.fillStyle = colour;
    this.ctx.lineWidth = 1.6;
    this.ctx.lineJoin = 'round';
    this.ctx.beginPath();
    if (type === 'Smartphone') {
      this.ctx.roundRect(x - s * 0.28, y - s * 0.5, s * 0.56, s, 2.5);
    } else if (type === 'Automobile') {
      this.ctx.roundRect(x - s * 0.5, y - s * 0.1, s, s * 0.38, 3);
      this.ctx.moveTo(x - s * 0.32, y - s * 0.1);
      this.ctx.lineTo(x - s * 0.2, y - s * 0.38);
      this.ctx.lineTo(x + s * 0.2, y - s * 0.38);
      this.ctx.lineTo(x + s * 0.32, y - s * 0.1);
    } else if (type === 'Speaker' || type === 'CastAudio' || type === 'AVR') {
      this.ctx.roundRect(x - s * 0.34, y - s * 0.5, s * 0.68, s, 3);
      this.ctx.moveTo(x + s * 0.14, y + s * 0.12);
      this.ctx.arc(x, y + s * 0.12, s * 0.14, 0, Math.PI * 2);
    } else if (type === 'TV' || type === 'CastVideo') {
      this.ctx.roundRect(x - s * 0.5, y - s * 0.38, s, s * 0.62, 2);
      this.ctx.moveTo(x - s * 0.22, y + s * 0.42);
      this.ctx.lineTo(x + s * 0.22, y + s * 0.42);
    } else {
      this.ctx.roundRect(x - s * 0.42, y - s * 0.36, s * 0.84, s * 0.56, 2);
      this.ctx.moveTo(x - s * 0.55, y + s * 0.34);
      this.ctx.lineTo(x + s * 0.55, y + s * 0.34);
    }
    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * TwoCode Expanded Spotify Player (`spotify-ui.js` drawSpotify direct port).
   * Exact layout: 60x60 album art, 44x28 dancing visualizer, 15px title, 12px artist,
   * 3-line live rolling synced lyrics (previous, current, next),
   * 3px/6px interactive timeline, centered vector playback controls,
   * bottom-right Spotify Connect device switcher button & AirPlay-style popup menu.
   */
  private drawMediaTab(cx: number, topY: number): void {
    const contentW = 472; // 520 - 48
    const x0 = cx - contentW / 2;
    const right = cx + contentW / 2;
    const top0 = topY + 48;
    const cs = 60;
    const trackTitle = this.mediaState.title;
    const trackArtist = this.mediaState.artist;
    const accent = this.albumAccentColor || '#1ed760';
    const soft = 'rgba(255, 255, 255, 0.55)';

    // 1. Album Cover Art (60x60, radius 10, shadow blur 12, offset 4)
    if (this.albumImageElement?.complete && this.albumImageElement.naturalWidth > 0) {
      this.ctx.save();
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      this.ctx.shadowBlur = 12;
      this.ctx.shadowOffsetY = 4;
      this.ctx.beginPath();
      this.ctx.roundRect(x0, top0, cs, cs, 10);
      this.ctx.fillStyle = '#1c1c1e';
      this.ctx.fill();
      this.ctx.restore();

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.roundRect(x0, top0, cs, cs, 10);
      this.ctx.clip();
      this.ctx.drawImage(this.albumImageElement, x0, top0, cs, cs);
      this.ctx.restore();
    } else {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.roundRect(x0, top0, cs, cs, 10);
      this.ctx.fillStyle = '#1c1c1e';
      this.ctx.fill();
      this.ctx.restore();
    }

    // 2. Visualizer in Cover Colour (Top Right: right - 44, top0 + 24, 44x28, 6 bars)
    // Sound-reactive: rises higher on loud/high sounds and drops lower on soft/quiet sounds
    const vizW = 44;
    const vizH = 28;
    const vizX = right - 44;
    const vizCy = top0 + 24;
    const n = 6;
    const t = performance.now() / 1000;
    const playing = Boolean(this.mediaState.playing && this.mediaState.active);
    const gap = Math.max(2, (vizW / n) * 0.4);
    const vbw = (vizW - gap * (n - 1)) / n;
    const audioViz = SystemAudioVisualizer.getInstance();
    const levels = audioViz.getLevels(n);

    this.ctx.save();
    this.ctx.shadowColor = accent;
    this.ctx.shadowBlur = vizH * 0.35;
    for (let i = 0; i < n; i++) {
      let raw = 0.06;
      if (playing) {
        if (levels) {
          raw = levels[i] || 0.06;
        } else {
          const volFactor = this.volumeState.muted ? 0 : Math.max(0.2, (this.volumeState.level || 70) / 100);
          const beatKick = Math.pow(Math.max(0, Math.sin(t * 4.2)), 3);
          const bandPattern = [
            0.35 + 0.65 * beatKick,
            0.25 + 0.55 * Math.abs(Math.sin(t * 3.1 + 0.6)),
            0.30 + 0.60 * Math.abs(Math.sin(t * 5.4 + 1.2) * Math.cos(t * 2.1)),
            0.28 + 0.58 * Math.abs(Math.sin(t * 7.1 + 2.0)),
            0.20 + 0.70 * Math.pow(Math.max(0, Math.sin(t * 4.2 + Math.PI)), 4),
            0.25 + 0.50 * Math.abs(Math.sin(t * 11.2))
          ];
          const pattern = bandPattern[i % bandPattern.length];
          raw = Math.min(1, Math.max(0.06, pattern * volFactor));
        }
      }
      const want = !playing ? 0.1 : Math.min(1, 0.12 + 1.15 * Math.pow(raw, 0.65));
      if (!this.expandedVizBars[i]) this.expandedVizBars[i] = 0.15;
      this.expandedVizBars[i] += (want - this.expandedVizBars[i]) * (want > this.expandedVizBars[i] ? 0.55 : 0.18);
      const bh = Math.max(vbw, vizH * Math.min(1, this.expandedVizBars[i]));
      const bx = vizX + i * (vbw + gap);
      const by = vizCy - bh / 2;

      this.ctx.beginPath();
      this.ctx.roundRect(bx, by, vbw, bh, vbw / 2);
      this.ctx.fillStyle = accent;
      this.ctx.fill();
    }
    this.ctx.restore();

    // 3. Track Title & Artist
    const tx = x0 + cs + 14;
    const titleW = right - 56 - tx;
    const overTitle = this.pointerX >= tx && this.pointerX <= tx + titleW &&
                      this.pointerY >= top0 + 10 && this.pointerY <= top0 + 30;

    this.ctx.save();
    this.ctx.font = '600 15px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.ctx.fillStyle = overTitle ? soft : '#ffffff';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'alphabetic';

    let displayTitle = trackTitle || 'Nothing Playing';
    if (this.ctx.measureText(displayTitle).width > titleW) {
      while (displayTitle.length > 1 && this.ctx.measureText(displayTitle + '…').width > titleW) {
        displayTitle = displayTitle.slice(0, -1);
      }
      displayTitle += '…';
    }
    this.ctx.fillText(displayTitle, tx, top0 + 26);

    this.ctx.font = '400 12px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.ctx.fillStyle = soft;
    let displayArtist = trackArtist || 'Start music in Spotify or Windows';
    if (this.ctx.measureText(displayArtist).width > titleW) {
      while (displayArtist.length > 1 && this.ctx.measureText(displayArtist + '…').width > titleW) {
        displayArtist = displayArtist.slice(0, -1);
      }
      displayArtist += '…';
    }
    this.ctx.fillText(displayArtist, tx, top0 + 44);
    this.ctx.restore();

    // 4. Live Synced Lyrics (3 lines with TwoCode Apple Music rolling push)
    const lyr = this.hasSyncedLyrics() ? this.getLyricAround() : null;
    const extra = lyr ? 74 : 0;
    if (lyr) {
      const ly = top0 + cs + 14;
      const lw = right - x0;
      const step = 19;
      const push = (1 - lyr.k) * step;

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(x0, ly - 2, lw, 60);
      this.ctx.clip();
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'alphabetic';

      // Line before (Spotify past line: dark and faint)
      this.ctx.font = '500 12px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      this.ctx.shadowBlur = 0;
      this.ctx.fillText(lyr.before, x0, ly + 12 + push);

      // Now sung line (Spotify active line: bright white bold with glow)
      this.ctx.font = '700 15px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = lyr.now ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
      this.ctx.shadowColor = 'rgba(255, 255, 255, 0.45)';
      this.ctx.shadowBlur = 10;
      this.ctx.fillText(lyr.now || '...', x0, ly + 12 + step + push);

      // Next line (Spotify upcoming line: dark and faint)
      this.ctx.shadowBlur = 0;
      this.ctx.font = '500 12px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
      this.ctx.fillText(lyr.next, x0, ly + 12 + step * 2 + push);

      this.ctx.restore();
    }

    // 5. Timeline / Scrub Bar (3px to 6px on hover)
    const barY = top0 + cs + 16 + extra;
    const bx0 = x0 + 34;
    const bw = right - 40 - bx0;
    const pos = this.mediaState.positionMs || 0;
    const dur = this.mediaState.durationMs || 1;
    const part = Math.max(0, Math.min(1, pos / dur));

    const overBar = this.pointerX >= bx0 && this.pointerX <= bx0 + bw &&
                    Math.abs(this.pointerY - barY) <= 8;
    const bh = overBar ? 6 : 3;

    // Elapsed
    this.ctx.save();
    this.ctx.font = '500 10px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.ctx.fillStyle = soft;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(this.formatTime(pos), x0, barY);

    // Track background
    this.ctx.beginPath();
    this.ctx.roundRect(bx0, barY - bh / 2, bw, bh, bh / 2);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.fill();

    // Track fill
    this.ctx.beginPath();
    this.ctx.roundRect(bx0, barY - bh / 2, Math.max(bh, bw * part), bh, bh / 2);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fill();

    // Remaining
    this.ctx.textAlign = 'right';
    const remMs = Math.max(0, dur - pos);
    this.ctx.fillText(dur > 0 ? '-' + this.formatTime(remMs) : '0:00', right, barY);
    this.ctx.restore();

    // 6. Centered Controls (Previous, Play/Pause, Next)
    const cy = barY + 22;
    const mid = (x0 + right) / 2;

    const overPrev = Math.abs(this.pointerX - (mid - 46)) <= 20 && Math.abs(this.pointerY - cy) <= 14;
    const overPlay = Math.abs(this.pointerX - mid) <= 20 && Math.abs(this.pointerY - cy) <= 14;
    const overNext = Math.abs(this.pointerX - (mid + 46)) <= 20 && Math.abs(this.pointerY - cy) <= 14;

    this.ctx.save();
    if (overPrev) this.ctx.globalAlpha = 0.6;
    this.mediaIcon('prev', mid - 46, cy, 12, '#ffffff');
    this.ctx.restore();

    this.ctx.save();
    if (overPlay) this.ctx.globalAlpha = 0.6;
    this.mediaIcon(this.mediaState.playing ? 'pause' : 'play', mid, cy, 17, '#ffffff');
    this.ctx.restore();

    this.ctx.save();
    if (overNext) this.ctx.globalAlpha = 0.6;
    this.mediaIcon('next', mid + 46, cy, 12, '#ffffff');
    this.ctx.restore();

    // 7. Spotify Connect Device Switcher Button (Bottom Right)
    const devLabel = this.mediaState.source === 'spotify' ? 'Spotify' : 'This PC';
    this.ctx.save();
    this.ctx.font = '600 11px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const dw = Math.min(130, this.ctx.measureText(devLabel).width + 34);
    const dbx = right - dw;
    const dby = cy - 11;
    const overDev = this.pointerX >= dbx && this.pointerX <= dbx + dw &&
                    this.pointerY >= dby && this.pointerY <= dby + 22;

    this.ctx.beginPath();
    this.ctx.roundRect(dbx, dby, dw, 22, 7);
    this.ctx.fillStyle = this.isDevicesOpen || overDev ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)';
    this.ctx.fill();

    this.devIcon(this.mediaState.source === 'spotify' ? 'Smartphone' : 'Computer', dbx + 13, dby + 11, 12, '#ffffff');

    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'alphabetic';
    this.ctx.fillText(devLabel, dbx + 25, dby + 15);
    this.ctx.restore();

    // 8. Device Selector Popup (TwoCode AirPlay-style menu)
    if (this.isDevicesOpen) {
      const pw = 280;
      const list = this.spotifyDevices.slice(0, 4);
      const ph = 52 + Math.max(1, list.length) * 40;
      const px = right - pw;
      const py = Math.max(topY + 36, dby - ph - 8);

      this.ctx.save();
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      this.ctx.shadowBlur = 24;
      this.ctx.shadowOffsetY = 8;
      this.ctx.beginPath();
      this.ctx.roundRect(px, py, pw, ph, 12);
      this.ctx.fillStyle = '#1c1c1e';
      this.ctx.fill();
      this.ctx.restore();

      this.ctx.save();
      this.ctx.font = '600 15px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'alphabetic';
      this.ctx.fillText('Play on', px + 16, py + 28);

      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = '#8e8e93';
      this.ctx.fillText('\u00D7', px + pw - 22, py + 28);

      if (list.length === 0) {
        this.ctx.font = '500 12px Inter, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('No Spotify devices found', px + 16, py + 65);
      } else {
        list.forEach((d: any, i: number) => {
          const ry = py + 44 + i * 40;
          const overItem = this.pointerX >= px + 6 && this.pointerX <= px + pw - 6 &&
                           this.pointerY >= ry && this.pointerY <= ry + 40;

          // Separator
          this.ctx.fillStyle = '#2c2c2e';
          this.ctx.fillRect(px + 16, ry, pw - 32, 1);

          if (overItem) {
            this.ctx.beginPath();
            this.ctx.roundRect(px + 6, ry + 2, pw - 12, 36, 8);
            this.ctx.fillStyle = '#2c2c2e';
            this.ctx.fill();
          }

          this.devIcon(d.type || 'Speaker', px + 26, ry + 20, 15, '#ffffff');

          this.ctx.font = d.is_active ? '600 14px Inter, sans-serif' : '500 14px Inter, sans-serif';
          this.ctx.fillStyle = '#ffffff';
          this.ctx.textAlign = 'left';
          this.ctx.fillText(d.name, px + 46, ry + 25);

          if (d.is_active) {
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2.4;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(px + pw - 30, ry + 20);
            this.ctx.lineTo(px + pw - 26, ry + 24);
            this.ctx.lineTo(px + pw - 19, ry + 16);
            this.ctx.stroke();
          }
        });
      }
      this.ctx.restore();
    }
  }

  private drawHomeTab(cx: number, topY: number): void {
    // System Status Grid: Weather, Battery, Wi-Fi, Volume
    const col1 = cx - 130;
    const col2 = cx + 130;

    // Weather widget
    this.ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${this.weatherState.temp} • ${this.weatherState.condition}`, col1, topY + 84);

    // Time & Status widget (right column, battery removed per UI cleanup)
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    this.ctx.fillText(`${timeStr}`, col2, topY + 84);

    // Wi-Fi widget
    this.ctx.font = '500 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    this.ctx.fillText(`Wi-Fi: ${this.netState.ssid}`, col1, topY + 116);

    // Sub-status label
    this.ctx.fillText('LAN Drop Ready', col2, topY + 116);

    // Master Volume Control Slider
    const volY = topY + 165;
    const volLeft = cx - 120;
    const volW = 240;
    const volLevel = this.volumeState.muted ? 0 : this.volumeState.level;

    this.ctx.font = '600 11px sans-serif';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(this.volumeState.muted ? 'MUTE' : 'VOL', volLeft - 14, volY + 5);

    // Slider track
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.beginPath();
    this.ctx.roundRect(volLeft, volY - 3, volW, 6, 3);
    this.ctx.fill();

    // Slider filled
    this.ctx.fillStyle = '#00d2ff';
    this.ctx.beginPath();
    this.ctx.roundRect(volLeft, volY - 3, (volW * volLevel) / 100, 6, 3);
    this.ctx.fill();

    // Label
    this.ctx.font = '500 11px monospace';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`${volLevel}%`, volLeft + volW + 14, volY + 4);
  }

  private drawAiTab(cx: number, topY: number): void {
    const isRunning = this.aiState.status === 'running';
    const statusColor = isRunning ? '#ffa500' : '#00d2ff';

    this.ctx.font = '600 14.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.ctx.fillStyle = statusColor;
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Claude Code & OpenAI Codex Monitor', cx, topY + 82);

    this.ctx.font = '500 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    this.ctx.fillText(
      isRunning ? `Active Task: ${this.aiState.currentTool || 'Executing...'}` : 'Agent Idle • Listening on port 47823',
      cx,
      topY + 106
    );

    if (this.aiState.pendingPermission) {
      const cardY = topY + 128;
      this.ctx.fillStyle = 'rgba(255, 160, 0, 0.12)';
      this.ctx.strokeStyle = 'rgba(255, 160, 0, 0.4)';
      this.ctx.beginPath();
      this.ctx.roundRect(cx - 200, cardY, 400, 68, 8);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = '#ffb300';
      this.ctx.fillText('CLI Permission Request', cx, cardY + 20);

      this.ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = '#e8ecf4';
      this.ctx.fillText(this.aiState.pendingPermission.description || 'Execution authorization required', cx, cardY + 38);

      // Buttons
      this.ctx.fillStyle = '#00ff66';
      this.ctx.beginPath();
      this.ctx.roundRect(cx - 70, cardY + 46, 55, 16, 4);
      this.ctx.fill();
      this.ctx.font = '600 10px sans-serif';
      this.ctx.fillStyle = '#000';
      this.ctx.fillText('Allow', cx - 42, cardY + 58);

      this.ctx.fillStyle = '#ff4444';
      this.ctx.beginPath();
      this.ctx.roundRect(cx + 15, cardY + 46, 55, 16, 4);
      this.ctx.fill();
      this.ctx.fillStyle = '#fff';
      this.ctx.fillText('Deny', cx + 42, cardY + 58);
    }
  }

  private drawToolsTab(cx: number, topY: number): void {
    this.ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Productivity Tools', cx, topY + 84);

    this.ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    this.ctx.fillText('Clipboard History • Local Wi-Fi Drop (Port 48912) • Scratchpad', cx, topY + 110);

    // Open settings button
    this.ctx.fillStyle = 'rgba(0, 210, 255, 0.15)';
    this.ctx.strokeStyle = '#00d2ff';
    this.ctx.beginPath();
    this.ctx.roundRect(cx - 100, topY + 150, 200, 34, 8);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.ctx.fillStyle = '#00d2ff';
    this.ctx.fillText('Open Settings Dashboard', cx, topY + 172);
  }

  private drawFocusTab(cx: number, topY: number): void {
    const min = Math.floor(this.focusState.remainingSeconds / 60);
    const sec = this.focusState.remainingSeconds % 60;
    const timeStr = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

    this.ctx.font = '600 28px monospace';
    this.ctx.fillStyle = this.focusState.active ? '#cf53ff' : '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(timeStr, cx, topY + 115);

    this.ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    this.ctx.fillText(this.focusState.isBreak ? 'Short Break' : 'Deep Focus Session', cx, topY + 140);

    // Button
    const btnY = topY + 175;
    this.ctx.fillStyle = this.focusState.active ? 'rgba(255, 80, 80, 0.2)' : 'rgba(207, 83, 255, 0.2)';
    this.ctx.strokeStyle = this.focusState.active ? '#ff5050' : '#cf53ff';
    this.ctx.beginPath();
    this.ctx.roundRect(cx - 60, btnY, 120, 32, 6);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.ctx.fillStyle = this.focusState.active ? '#ff5050' : '#cf53ff';
    this.ctx.fillText(this.focusState.active ? 'Pause' : 'Start Focus', cx, btnY + 20);
  }

  /* ========================================================================
     HYBRID DOM OVERLAY INTEGRATION (Screenshots 01, 03, 04, 07, 08)
     ======================================================================== */
  private initDomOverlay(): void {
    this.domOverlayEl = document.getElementById('expanded-island-overlay');
    if (!this.domOverlayEl) return;
    this.setPopover('none');
    this.updateNetworkDom();

    // Click isolation on expanded DOM overlay: prevents clicks inside the card from bubbling to window
    this.domOverlayEl.addEventListener('click', (e) => {
      this.mascot.resetInactivity();
      const ctxMenu = document.getElementById('island-context-menu');
      if (ctxMenu && !ctxMenu.classList.contains('hidden')) {
        ctxMenu.classList.add('hidden');
      }
      if (this.activePopover !== 'none') {
        const popover = document.getElementById('system-popover');
        const btnWifi = document.getElementById('btn-status-wifi');
        const btnBt = document.getElementById('btn-status-bt');
        const btnGroup = document.getElementById('btn-system-popover');
        const targetNode = (e.target && e.target instanceof Node) ? (e.target as Node) : null;
        const clickedInsidePopover = targetNode ? (
          Boolean(popover?.contains(targetNode)) ||
          Boolean(btnWifi?.contains(targetNode)) ||
          Boolean(btnBt?.contains(targetNode)) ||
          Boolean(btnGroup?.contains(targetNode))
        ) : false;
        if (!clickedInsidePopover) {
          this.setPopover('none');
        }
      }
      e.stopPropagation();
    });

    // Double-click on expanded overlay or mascot eye slot pokes Robo
    this.domOverlayEl.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement;
      if (target?.closest?.('input, textarea, button, .nav-item, select, [contenteditable="true"]')) return;
      e.stopPropagation();
      this.pokeMascot(e.clientX, e.clientY);
    });

    const eyeSlot = document.getElementById('mascot-eye-slot');
    if (eyeSlot) {
      eyeSlot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pokeMascot(e.clientX, e.clientY);
      });
      eyeSlot.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.pokeMascot(e.clientX, e.clientY);
      });
    }

    // Bottom Navigation Bar tabs
    const navItems = this.domOverlayEl.querySelectorAll('.nav-item[data-tab]');
    navItems.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tab = (btn as HTMLElement).dataset.tab;
        if (tab) {
          this.showDomTab(tab);
          this.mascot.sounds.playChirp();
        }
      });
    });

    // Three-dot Options Menu
    const btnMenu = document.getElementById('btn-island-menu');
    if (btnMenu) {
      btnMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        window.roboIsland?.openSettings();
      });
    }

    // Dedicated Wi-Fi & Bluetooth Status Bar Buttons
    const btnWifi = document.getElementById('btn-status-wifi');
    if (btnWifi) {
      btnWifi.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setPopover(this.activePopover === 'wifi' ? 'none' : 'wifi');
      });
    }

    const btnBt = document.getElementById('btn-status-bt');
    if (btnBt) {
      btnBt.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setPopover(this.activePopover === 'bt' ? 'none' : 'bt');
      });
    }

    const btnGroup = document.getElementById('btn-system-popover');
    if (btnGroup) {
      btnGroup.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('#btn-status-wifi, #btn-status-bt')) return;
        e.stopPropagation();
        this.setPopover(this.activePopover === 'none' ? 'wifi' : 'none');
      });
    }

    // Phone quick button in status bar
    const btnPhone = document.getElementById('btn-phone-quick');
    if (btnPhone) {
      btnPhone.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openPhoneDrop();
      });
    }

    const btnTrayPhone = document.getElementById('btn-tray-phone');
    if (btnTrayPhone) {
      btnTrayPhone.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openPhoneDrop();
      });
    }

    // Header Music Button
    const btnHeaderMusic = document.getElementById('btn-header-music');
    if (btnHeaderMusic) {
      btnHeaderMusic.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showDomTab('music');
        this.mascot.sounds.playChirp();
      });
    }

    // Header Voice Companion Button (Jarvis Voice Mode)
    const btnVoice = document.getElementById('btn-voice-companion');
    if (btnVoice) {
      btnVoice.addEventListener('click', (e) => {
        e.stopPropagation();
        this.triggerVoiceCompanion();
      });
    }

    // Focus Toggle Play Button (Home Dashboard)
    const btnFocus = document.getElementById('btn-focus-toggle');
    if (btnFocus) {
      btnFocus.addEventListener('click', (e) => {
        e.stopPropagation();
        const f = (window as any).__roboFocus || (window as any).__twocodeFocus;
        if (f) {
          f.toggle();
          this.focusState.active = Boolean(f.active());
        } else {
          this.focusState.active = !this.focusState.active;
        }
        this.updateTargetDimensions();
        this.requestRender();
        this.mascot.sounds.playChirp();
      });
    }

    // Home Music Play/Pause Round Button
    const btnHomeMusicPlay = document.getElementById('btn-home-music-play');
    if (btnHomeMusicPlay) {
      btnHomeMusicPlay.addEventListener('click', (e) => {
        e.stopPropagation();
        window.roboIsland?.mediaControl('playPause');
        this.mascot.sounds.playChirp();
      });
    }

    // Cards Clicks (TwoCode Parity: clicking tile navigates to that app page)
    const cardClaude = document.getElementById('card-claude');
    if (cardClaude) {
      cardClaude.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showDomTab('ai');
      });
    }

    const cardMusic = document.getElementById('card-music');
    if (cardMusic) {
      cardMusic.addEventListener('click', (e) => {
        e.stopPropagation();
        if ((e.target as HTMLElement).closest('#btn-home-music-play')) return;
        this.showDomTab('music');
      });
    }

    const cardFocus = document.getElementById('card-focus');
    if (cardFocus) {
      cardFocus.addEventListener('click', (e) => {
        e.stopPropagation();
        if ((e.target as HTMLElement).closest('#btn-focus-toggle')) return;
        this.showDomTab('focus');
      });
    }

    // Sports Switcher Tabs
    const sportBtns = this.domOverlayEl.querySelectorAll('.sport-tab-btn[data-sport]');
    sportBtns.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const sport = (btn as HTMLElement).dataset.sport as any;
        if (sport) {
          if (window.roboIsland?.sports?.toggleSport) {
            const updated = await window.roboIsland.sports.toggleSport(sport);
            if (updated) {
              this.activeSportsActivity = updated;
              if (this.sportsState) {
                this.sportsState.activeSport = sport;
                this.sportsState.activities[sport] = updated;
              }
            }
          } else if (window.roboIsland?.toggleSport) {
            const updated = await window.roboIsland.toggleSport(sport);
            if (updated) {
              this.activeSportsActivity = updated;
              if (this.sportsState) {
                this.sportsState.activeSport = sport;
                this.sportsState.activities[sport] = updated;
              }
            }
          }
          sportBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.renderSportsScorecardDOM();
          this.updateTargetDimensions();
          this.requestRender();
        }
      });
    });

    // Sports Step Simulation Button
    const btnSimStep = document.getElementById('sport-sim-step');
    if (btnSimStep) {
      btnSimStep.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (window.roboIsland?.sports?.stepSimulation) {
          const updated = await window.roboIsland.sports.stepSimulation();
          if (updated) {
            this.activeSportsActivity = updated;
            this.renderSportsScorecardDOM();
            this.updateTargetDimensions();
            this.requestRender();
          }
        } else if (window.roboIsland?.stepSportsSimulation) {
          const updated = await window.roboIsland.stepSportsSimulation();
          if (updated) {
            this.activeSportsActivity = updated;
            this.renderSportsScorecardDOM();
            this.updateTargetDimensions();
            this.requestRender();
          }
        }
      });
    }

    // Sports Mode Toggle (Live vs Simulated)
    const btnModeToggle = document.getElementById('sport-mode-toggle');
    if (btnModeToggle) {
      btnModeToggle.addEventListener('click', async (e) => {
        e.stopPropagation();
        const curMode = this.sportsState?.mode || 'simulated';
        const nextMode = curMode === 'live' ? 'simulated' : 'live';
        if (window.roboIsland?.sports?.setMode) {
          const updated = await window.roboIsland.sports.setMode(nextMode);
          if (this.sportsState) this.sportsState.mode = nextMode;
          if (updated) this.activeSportsActivity = updated;
        } else if (window.roboIsland?.setSportsMode) {
          const updated = await window.roboIsland.setSportsMode(nextMode);
          if (this.sportsState) this.sportsState.mode = nextMode;
          if (updated) this.activeSportsActivity = updated;
        }
        this.renderSportsScorecardDOM();
        this.updateTargetDimensions();
        this.requestRender();
      });
    }

    // Sports Island Pill Visibility Opt-In Toggle
    const btnIslandToggle = document.getElementById('sport-island-toggle');
    if (btnIslandToggle) {
      btnIslandToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.isSportsPillEnabled = !this.isSportsPillEnabled;
        try {
          localStorage.setItem('roboisland_sports_pill_enabled', String(this.isSportsPillEnabled));
        } catch {}
        this.renderSportsScorecardDOM();
        this.updateTargetDimensions();
        this.requestRender();
        try { AudioSynth.getInstance().play(this.isSportsPillEnabled ? 'pop' : 'done'); } catch {}
      });
    }

    // TwoCode Volume Scrubber with slide & drag support
    const navVolContainer = document.getElementById('nav-vol-container');
    const navVolTrack = document.getElementById('nav-vol-track');
    if (navVolTrack && navVolContainer) {
      let isDraggingVol = false;
      const setVolFromEvent = (e: MouseEvent) => {
        const rect = navVolTrack.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const level = Math.round(pct * 100);
        this.volumeState.level = level;
        this.volumeState.muted = level === 0;
        window.roboIsland?.setVolume(level);
      };

      navVolTrack.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isDraggingVol = true;
        navVolContainer.classList.add('sliding');
        setVolFromEvent(e);
      });

      window.addEventListener('mousemove', (e) => {
        if (isDraggingVol) {
          setVolFromEvent(e);
        }
      });

      window.addEventListener('mouseup', () => {
        if (isDraggingVol) {
          isDraggingVol = false;
          navVolContainer.classList.remove('sliding');
        }
      });
    }

    // Mute button in bottom nav
    const btnMute = document.getElementById('btn-quick-mute');
    if (btnMute) {
      btnMute.addEventListener('click', (e) => {
        e.stopPropagation();
        window.roboIsland?.setMute(!this.volumeState.muted);
      });
    }

    // Wi-Fi Popover Tile Toggle
    const tileWifi = document.getElementById('tile-wifi');
    if (tileWifi) {
      tileWifi.addEventListener('click', (e) => {
        e.stopPropagation();
        this.netState.wifiOn = !this.netState.wifiOn;
        tileWifi.classList.toggle('active', this.netState.wifiOn);
        const ssidEl = document.getElementById('popover-wifi-ssid');
        if (ssidEl) ssidEl.textContent = this.netState.wifiOn ? (this.netState.ssid || 'Connected') : 'Off';
        window.roboIsland?.setRadio('wifi', this.netState.wifiOn);
      });
    }

    // Bluetooth Popover Tile Toggle
    const tileBt = document.getElementById('tile-bt');
    if (tileBt) {
      tileBt.addEventListener('click', (e) => {
        e.stopPropagation();
        this.netState.btOn = !this.netState.btOn;
        tileBt.classList.toggle('active', this.netState.btOn);
        const btStatusEl = document.getElementById('popover-bt-status');
        if (btStatusEl) btStatusEl.textContent = this.netState.btOn ? 'Active' : 'Off';
        window.roboIsland?.setRadio('bt', this.netState.btOn);
      });
    }

    // Popover menu items (Wi-Fi networks and Bluetooth devices)
    const rowWifi = document.getElementById('row-wifi-list');
    if (rowWifi) {
      rowWifi.addEventListener('click', (e) => {
        e.stopPropagation();
        window.roboIsland?.openExternal?.('ms-settings:network-wifi');
      });
    }

    const rowBt = document.getElementById('row-bt-list');
    if (rowBt) {
      rowBt.addEventListener('click', (e) => {
        e.stopPropagation();
        window.roboIsland?.openExternal?.('ms-settings:bluetooth');
      });
    }

    // Context Menu action wiring
    const ctxHide = document.getElementById('ctx-hide');
    if (ctxHide) {
      ctxHide.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('island-context-menu')?.classList.add('hidden');
        window.roboIsland?.hideIsland();
      });
    }

    const ctxToggle = document.getElementById('ctx-toggle');
    if (ctxToggle) {
      ctxToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('island-context-menu')?.classList.add('hidden');
        this.toggleExpand();
      });
    }

    const ctxSettings = document.getElementById('ctx-settings');
    if (ctxSettings) {
      ctxSettings.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('island-context-menu')?.classList.add('hidden');
        window.roboIsland?.openSettings();
      });
    }

    const ctxQuit = document.getElementById('ctx-quit');
    if (ctxQuit) {
      ctxQuit.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('island-context-menu')?.classList.add('hidden');
        window.roboIsland?.quit();
      });
    }

    const ctxMenu = document.getElementById('island-context-menu');
    if (ctxMenu) {
      ctxMenu.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Embedded Chat Form submit & clear
    const chatForm = document.getElementById('chat-input-form') as HTMLFormElement;
    const chatInput = document.getElementById('chat-input') as HTMLInputElement;
    const chatMessages = document.getElementById('chat-messages');
    if (chatForm && chatInput && chatMessages) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const text = chatInput.value.trim();
        if (!text) return;
        chatInput.value = '';

        const userMsg = document.createElement('div');
        userMsg.className = 'chat-msg user';
        userMsg.innerHTML = `<div class="msg-bubble">${text}</div>`;
        chatMessages.appendChild(userMsg);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        setTimeout(() => {
          const roboMsg = document.createElement('div');
          roboMsg.className = 'chat-msg robo';
          let reply = "I'm listening! Focus and companion tracking are active.";
          const lower = text.toLowerCase();
          if (lower.includes('focus')) reply = "Focus session is ready! Click the Focus card or tell me how many minutes to set.";
          else if (lower.includes('file') || lower.includes('tray') || lower.includes('phone')) reply = "You can drag files straight into RoboIsland to stage them and scan the QR code to download on your phone!";
          else if (lower.includes('music') || lower.includes('play')) reply = "Media session is synchronized with Windows audio controls.";
          else if (lower.includes('hi') || lower.includes('hello')) reply = "Hello! I'm Robo, your Dynamic Island companion. Everything is running smoothly.";
          roboMsg.innerHTML = `<div class="msg-bubble">${reply}</div>`;
          chatMessages.appendChild(roboMsg);
          chatMessages.scrollTop = chatMessages.scrollHeight;
          this.mascot.sounds.playChirp();
        }, 320);
      });
    }

    const btnChatClear = document.getElementById('btn-chat-clear');
    if (btnChatClear && chatMessages) {
      btnChatClear.addEventListener('click', (e) => {
        e.stopPropagation();
        chatMessages.innerHTML = `
          <div class="chat-msg robo">
            <div class="msg-bubble">
              Hi! I'm Robo, your intelligent companion. Ask me anything, or drag files to the tray to send them to your phone!
            </div>
          </div>
        `;
      });
    }

    // Clear All, Browse & Copy QR link in File Tray
    const triggerTrayBrowse = async (e: Event) => {
      e.stopPropagation();
      const added = await window.roboIsland?.trayBrowseFiles?.();
      if (added && added.length > 0) {
        this.showDomTab('tray');
        await this.loadTrayShelf(true);
        const first = added[0].split(/[/\\]/).pop() || 'File';
        this.triggerAirDropHud('received', added.length > 1 ? `${first} (+${added.length - 1})` : first);
      }
    };

    const btnTrayBrowse = document.getElementById('btn-tray-browse');
    if (btnTrayBrowse) {
      btnTrayBrowse.addEventListener('click', triggerTrayBrowse);
    }

    const btnTrayAddMore = document.getElementById('btn-tray-add-more');
    if (btnTrayAddMore) {
      btnTrayAddMore.addEventListener('click', triggerTrayBrowse);
    }

    const btnTrayClear = document.getElementById('btn-tray-clear');
    if (btnTrayClear) {
      btnTrayClear.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.roboIsland?.trayClearFiles();
        this.loadTrayShelf();
      });
    }

    const btnCopyUrl = document.getElementById('btn-copy-qr-url');
    if (btnCopyUrl) {
      btnCopyUrl.addEventListener('click', (e) => {
        e.stopPropagation();
        const urlEl = document.getElementById('tray-qr-url');
        if (urlEl && urlEl.textContent) {
          navigator.clipboard.writeText(urlEl.textContent.trim());
          btnCopyUrl.textContent = 'Copied!';
          this.mascot.sounds.playSuccess();
          setTimeout(() => {
            btnCopyUrl.innerHTML = `
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg> Copy Link`;
          }, 1800);
        }
      });
    }

    // Windows File Drag-and-Drop (Capture phase on window so child overlays never swallow dragover)
    const dropOverlay = document.getElementById('drag-drop-overlay');
    let dragDepth = 0;

    const resetDragState = () => {
      dragDepth = 0;
      this.isDraggingOver = false;
      window.roboIsland?.setDragging?.(false);
      if (dropOverlay) dropOverlay.classList.add('hidden');
    };

    // CRITICAL: When a file is dragged from Windows Explorer, the island window
    // is in setIgnoreMouseEvents(true) mode (compact/rest) which can cause Windows
    // to show a "not-allowed" circle+cross cursor. Locking interactive & drag state
    // in capture phase ensures OLE drops land cleanly.
    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepth += 1;
      this.isDraggingOver = true;
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      window.roboIsland?.setDragging?.(true);
      window.roboIsland?.setInteractive(true);
      if (this.mode === 'compact' || this.mode === 'rest') {
        this.expand();
      }
      if (dropOverlay) dropOverlay.classList.remove('hidden');
    }, true);

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.isDraggingOver = true;
      window.roboIsland?.setDragging?.(true);
      window.roboIsland?.setInteractive(true);
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    }, true);

    window.addEventListener('dragleave', (e) => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0 || e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        resetDragState();
      }
    }, true);

    window.addEventListener('dragend', () => {
      resetDragState();
    }, true);

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      resetDragState();

      const fileList: any[] = [];
      if (e.dataTransfer) {
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          for (let i = 0; i < e.dataTransfer.files.length; i++) {
            fileList.push(e.dataTransfer.files[i]);
          }
        } else if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
          for (let i = 0; i < e.dataTransfer.items.length; i++) {
            const item = e.dataTransfer.items[i];
            if (item.kind === 'file') {
              const f = item.getAsFile();
              if (f) fileList.push(f);
            }
          }
        }
      }

      if (fileList.length > 0) {
        const filePaths: string[] = [];
        for (const f of fileList) {
          let p = '';
          if (window.roboIsland?.getPathForFile) {
            try {
              p = window.roboIsland.getPathForFile(f);
            } catch {}
          }
          if (!p && f.path) {
            p = f.path;
          }
          if (p && typeof p === 'string' && p.length > 0) {
            filePaths.push(p);
          }
        }

        if (filePaths.length > 0 && window.roboIsland) {
          await window.roboIsland.trayAddFiles(filePaths);
          const firstFileName = filePaths[0].split(/[/\\]/).pop() || 'File';
          const count = filePaths.length;
          const displayTitle = count > 1 ? `${firstFileName} (+${count - 1})` : firstFileName;

          this.triggerAirDropHud('received', displayTitle);
          this.activeTab = 'tray';
          this.showDomTab('tray');
          await this.loadTrayShelf(true);
          const statusBadge = document.getElementById('tray-qr-status');
          if (statusBadge) {
            statusBadge.textContent = `${filePaths.length} file${filePaths.length > 1 ? 's' : ''} added!`;
            statusBadge.className = 'qr-status-badge qr-status-success';
            statusBadge.style.color = '#00d2ff';
            statusBadge.style.background = 'rgba(0, 210, 255, 0.15)';
            setTimeout(() => {
              if (statusBadge && statusBadge.textContent?.includes('added')) {
                const isOffline = document.getElementById('tray-qr-url')?.textContent?.includes('127.0.0.1');
                statusBadge.textContent = isOffline ? 'Offline / No Wi-Fi' : 'Waiting for phone...';
                statusBadge.className = isOffline ? 'qr-status-badge qr-status-warning' : 'qr-status-badge qr-status-ready';
                statusBadge.style.color = isOffline ? '#ff9f0a' : '#27c93f';
                statusBadge.style.background = isOffline ? 'rgba(255, 159, 10, 0.15)' : 'rgba(39, 201, 63, 0.15)';
              }
            }, 3000);
          }
        }
      }
    }, true);

    // Listen for live LAN transfer events (connected/download/upload/progress)
    window.roboIsland?.onTransferActive?.((data: any) => {
      const statusBadge = document.getElementById('tray-qr-status');
      if (statusBadge) {
        if (data.type === 'progress') {
          this.transferProgress = typeof data.percent === 'number' ? data.percent : 0;
          this.transferDirection = data.direction || 'download';
          this.transferProgressUntil = Date.now() + 3000;
          const dirText = data.direction === 'upload' ? 'Receiving' : 'Sending';
          const sizeText = data.total ? ` (${this.formatBytes(data.transferred || 0)} / ${this.formatBytes(data.total)})` : '';
          statusBadge.textContent = `${dirText}: ${data.percent}%${sizeText}`;
          statusBadge.className = 'qr-status-badge qr-status-progress';
          return;
        }

        if (data.type === 'connected') {
          statusBadge.textContent = 'Phone opened page!';
          statusBadge.className = 'qr-status-badge qr-status-ready';
          statusBadge.style.color = '#27c93f';
          statusBadge.style.background = 'rgba(39, 201, 63, 0.15)';
        } else if (data.type === 'download') {
          this.transferProgress = null;
          statusBadge.textContent = 'Phone downloading file...';
          statusBadge.className = 'qr-status-badge qr-status-success';
          statusBadge.style.color = '#00d2ff';
          statusBadge.style.background = 'rgba(0, 210, 255, 0.15)';
          const name = data.name || 'File';
          this.triggerAirDropHud('sent', name);
        } else if (data.type === 'upload') {
          this.transferProgress = null;
          statusBadge.textContent = 'File received from phone!';
          statusBadge.className = 'qr-status-badge qr-status-success';
          statusBadge.style.color = '#27c93f';
          statusBadge.style.background = 'rgba(39, 201, 63, 0.15)';
          const name = data.name || (data.files && data.files[0] ? data.files[0].split(/[/\\]/).pop() : 'File');
          this.triggerAirDropHud('received', name);
          this.loadTrayShelf(true);
        }
        this.mascot.sounds?.playSuccess?.();
        setTimeout(() => {
          if (statusBadge) {
            const isOffline = document.getElementById('tray-qr-url')?.textContent?.includes('127.0.0.1');
            statusBadge.textContent = isOffline ? 'Offline / No Wi-Fi' : 'Waiting for phone...';
            statusBadge.className = isOffline ? 'qr-status-badge qr-status-warning' : 'qr-status-badge qr-status-ready';
            statusBadge.style.color = isOffline ? '#ff9f0a' : '#27c93f';
            statusBadge.style.background = isOffline ? 'rgba(255, 159, 10, 0.15)' : 'rgba(39, 201, 63, 0.15)';
          }
        }, 4000);
      }
    });
  }

  public showDomTab(tab: string): void {
    this.currentDomTab = tab as any;
    if (tab === 'music') {
      this.activeTab = 'media';
    } else if (tab === 'home') {
      this.activeTab = 'home';
    } else if (tab === 'ai') {
      this.activeTab = 'ai';
    } else if (tab === 'focus') {
      this.activeTab = 'focus';
    } else if (tab === 'tray') {
      this.activeTab = 'tray';
    } else if (tab === 'notes') {
      this.activeTab = 'notes' as any;
    } else if (tab === 'chat') {
      this.activeTab = 'chat' as any;
    } else if (tab === 'clipboard') {
      this.activeTab = 'clipboard' as any;
    } else if (tab === 'agenda') {
      this.activeTab = 'agenda' as any;
    } else if (tab === 'sports') {
      this.activeTab = 'sports' as any;
    }

    this.updateTargetDimensions();
    this.updateAmbientGlow(tab);
    if (!this.domOverlayEl) return;

    // Set deterministic active tab attribute on overlay for CSS glow bindings
    this.domOverlayEl.setAttribute('data-active-tab', tab);

    // Update active nav button
    const navItems = this.domOverlayEl.querySelectorAll('.nav-item');
    navItems.forEach((item) => {
      if ((item as HTMLElement).dataset.tab === tab) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Title & Phone button logic (TwoCode Two-Tone Header Titles)
    const titleEl = document.getElementById('status-title');
    const phoneBtn = document.getElementById('btn-phone-quick');
    // Hide phone button unconditionally by default (only File Tray reveals it)
    if (phoneBtn) phoneBtn.classList.add('hidden');
    this.setPopover('none');

    // Hide all panels
    const panels = this.domOverlayEl.querySelectorAll('.island-panel');
    panels.forEach((p) => p.classList.remove('active'));

    const setTwoToneTitle = (a: string, b: string, tint: string) => {
      if (!titleEl) return;
      titleEl.innerHTML = `<span style="color:#ffffff; font-weight:700;">${a}</span><span style="color:${tint}; font-weight:700;">${b}</span>`;
    };

    if (tab === 'home') {
      if (titleEl) titleEl.textContent = '';
      document.getElementById('panel-home')?.classList.add('active');
    } else if (tab === 'ai') {
      setTwoToneTitle('Claude ', 'Code', '#d97757');
      document.getElementById('panel-ai')?.classList.add('active');
    } else if (tab === 'music') {
      const isMediaActive = Boolean(this.mediaState.active && this.mediaState.title);
      const tint = isMediaActive ? (this.albumAccentColor || '#1ed760') : '#1ed760';
      setTwoToneTitle('Music ', 'Player', tint);
      document.getElementById('panel-music')?.classList.add('active');
    } else if (tab === 'tray') {
      setTwoToneTitle('File ', 'Tray', '#00c7be');
      if (phoneBtn) phoneBtn.classList.remove('hidden');
      document.getElementById('panel-tray')?.classList.add('active');
      this.loadTrayShelf();
    } else if (tab === 'notes') {
      setTwoToneTitle('Quick ', 'Notes', '#ffd60a');
      document.getElementById('panel-notes')?.classList.add('active');
      this.initNotesUI();
    } else if (tab === 'clipboard') {
      setTwoToneTitle('Clip', 'board', '#0a84ff');
      document.getElementById('panel-clipboard')?.classList.add('active');
      this.loadClipboardList();
    } else if (tab === 'chat') {
      setTwoToneTitle('Robo ', 'Chat', '#818cf8');
      document.getElementById('panel-chat')?.classList.add('active');
      const input = document.getElementById('chat-input') as HTMLInputElement;
      if (input) input.focus();
    } else if (tab === 'focus') {
      setTwoToneTitle('Focus ', 'Timer', '#bf5af2');
      const focusPanel = document.getElementById('panel-focus');
      if (focusPanel) {
        focusPanel.classList.add('active');
      } else {
        document.getElementById('panel-home')?.classList.add('active');
      }
    } else if (tab === 'agenda') {
      setTwoToneTitle('Age', 'nda', '#0070f3');
      document.getElementById('panel-agenda')?.classList.add('active');
      this.initAgendaUI();
    } else if (tab === 'sports') {
      setTwoToneTitle('Live ', 'Scoreboard', '#22e05a');
      document.getElementById('panel-sports')?.classList.add('active');
      this.renderSportsScorecardDOM();
    } else if (tab === 'settings') {
      if (titleEl) titleEl.textContent = '';
      document.getElementById('panel-home')?.classList.add('active');
      window.roboIsland?.openSettings();
    } else {
      if (titleEl) titleEl.textContent = '';
      document.getElementById('panel-home')?.classList.add('active');
    }
  }

  /**
   * Apple Mac / iOS Dynamic Ambient Feature Glow
   * Changes bottom radiant aura dynamically to match the active feature & album artwork
   */
  public updateAmbientGlow(tab: string): void {
    const overlay = this.domOverlayEl || document.getElementById('expanded-island-overlay');
    if (!overlay) return;

    overlay.setAttribute('data-active-tab', tab);

    let primary = 'rgba(255, 255, 255, 0.16)';
    let secondary = 'rgba(140, 140, 160, 0.08)';
    let accent = '#ffffff';

    switch (tab) {
      case 'agenda':
        // Apple Calendar oceanic blue
        primary = 'rgba(0, 112, 243, 0.52)';
        secondary = 'rgba(2, 132, 199, 0.24)';
        accent = '#0070f3';
        break;
      case 'music': {
        // Spotify / Apple Music emerald green or dynamic album artwork tint
        const isMediaActive = Boolean(this.mediaState.active && this.mediaState.title);
        if (isMediaActive) {
          const r = this.currentTintR || 30;
          const g = this.currentTintG || 215;
          const b = this.currentTintB || 96;
          primary = `rgba(${r}, ${g}, ${b}, 0.50)`;
          secondary = `rgba(${Math.round(r * 0.65)}, ${Math.round(g * 0.65)}, ${Math.round(b * 0.65)}, 0.22)`;
          accent = this.albumAccentColor || '#1ed760';
        } else {
          primary = 'rgba(30, 215, 96, 0.50)';
          secondary = 'rgba(20, 140, 62, 0.22)';
          accent = '#1ed760';
        }
        break;
      }
      case 'ai':
        // Anthropic warm terracotta / sunset amber
        primary = 'rgba(217, 119, 87, 0.52)';
        secondary = 'rgba(245, 158, 11, 0.22)';
        accent = '#d97757';
        break;
      case 'chat':
        // Electric Cyber AI Indigo / Neon Sparkle (distinct from Spotify green)
        primary = 'rgba(99, 102, 241, 0.52)';
        secondary = 'rgba(129, 140, 248, 0.25)';
        accent = '#818cf8';
        break;
      case 'focus':
        // Mindfulness lavender & violet purple
        primary = 'rgba(191, 90, 242, 0.52)';
        secondary = 'rgba(142, 68, 173, 0.22)';
        accent = '#bf5af2';
        break;
      case 'tray':
        // Apple AirDrop Mint / Teal
        primary = 'rgba(0, 199, 190, 0.52)';
        secondary = 'rgba(0, 150, 180, 0.22)';
        accent = '#00c7be';
        break;
      case 'notes':
        // Warm golden amber notepad
        primary = 'rgba(255, 214, 10, 0.48)';
        secondary = 'rgba(245, 158, 11, 0.22)';
        accent = '#ffd60a';
        break;
      case 'clipboard':
        // Apple macOS Deep Electric Blue
        primary = 'rgba(10, 132, 255, 0.52)';
        secondary = 'rgba(0, 100, 220, 0.22)';
        accent = '#0a84ff';
        break;
      case 'home':
      case 'settings':
      default:
        // Frosted Apple glass neutral silver
        primary = 'rgba(255, 255, 255, 0.16)';
        secondary = 'rgba(140, 140, 160, 0.08)';
        accent = '#ffffff';
        break;
    }

    overlay.style.setProperty('--feature-glow-primary', primary);
    overlay.style.setProperty('--feature-glow-secondary', secondary);
    overlay.style.setProperty('--feature-glow-accent', accent);
  }

  private isNotesInitialized = false;
  private notesList: Array<{ id: string; title: string; body: string; updatedAt: number }> = [];
  private activeNoteId: string = '';

  /**
   * Apple Notes Pad Experience (#panel-notes)
   * Real multi-note manager with dynamic shelf, persistence, word/char counts, checklist, and timestamps
   */
  public initNotesUI(): void {
    if (!this.domOverlayEl) return;

    const titleInput = document.getElementById('notes-title-input') as HTMLInputElement | null;
    const textArea = document.getElementById('notes-textarea') as HTMLTextAreaElement | null;
    const statsBadge = document.getElementById('notes-stats-badge');
    const statusBadge = document.getElementById('notes-status-badge');
    const countBadge = document.getElementById('notes-count-badge');
    const lastEditedEl = document.getElementById('notes-last-edited');
    const shelfList = document.getElementById('notes-shelf-list');

    // 1. Load notes from localStorage (with seamless migration from legacy single note)
    const loadNotesData = () => {
      try {
        const raw = localStorage.getItem('roboisland_notes_all');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.notesList = parsed;
          }
        }
      } catch {}

      if (!this.notesList.length) {
        // Migration from single legacy note
        try {
          const legacyRaw = localStorage.getItem('roboisland_apple_note');
          if (legacyRaw) {
            const legacy = JSON.parse(legacyRaw);
            if (legacy && (legacy.title || legacy.body)) {
              this.notesList = [{
                id: 'note-1',
                title: legacy.title || '',
                body: legacy.body || '',
                updatedAt: legacy.updatedAt || Date.now()
              }];
            }
          }
        } catch {}
      }

      if (!this.notesList.length) {
        this.notesList = [{
          id: 'note-' + Date.now(),
          title: '',
          body: '',
          updatedAt: Date.now()
        }];
      }

      const savedActiveId = localStorage.getItem('roboisland_active_note_id');
      if (savedActiveId && this.notesList.some(n => n.id === savedActiveId)) {
        this.activeNoteId = savedActiveId;
      } else {
        this.activeNoteId = this.notesList[0].id;
      }
    };

    const persistNotes = () => {
      try {
        localStorage.setItem('roboisland_notes_all', JSON.stringify(this.notesList));
        localStorage.setItem('roboisland_active_note_id', this.activeNoteId);
        // Also keep legacy note updated with active note for backward compatibility
        const cur = getActiveNote();
        if (cur) {
          localStorage.setItem('roboisland_apple_note', JSON.stringify({
            title: cur.title,
            body: cur.body,
            updatedAt: cur.updatedAt
          }));
        }
      } catch {}
    };

    const getActiveNote = () => {
      return this.notesList.find(n => n.id === this.activeNoteId) || this.notesList[0];
    };

    const updateStats = () => {
      const text = (textArea?.value || '') + ' ' + (titleInput?.value || '');
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const chars = (textArea?.value?.length || 0) + (titleInput?.value?.length || 0);
      if (statsBadge) {
        statsBadge.textContent = `${words} ${words === 1 ? 'word' : 'words'} • ${chars} ${chars === 1 ? 'char' : 'chars'}`;
      }
      if (countBadge) {
        countBadge.textContent = `${this.notesList.length} ${this.notesList.length === 1 ? 'Note' : 'Notes'}`;
      }
    };

    const updateLastEdited = (updatedAt: number) => {
      if (!lastEditedEl) return;
      const dt = new Date(updatedAt || Date.now());
      const isToday = dt.toDateString() === new Date().toDateString();
      const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      lastEditedEl.textContent = isToday
        ? `Last edited today at ${timeStr}`
        : `Last edited ${dt.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
    };

    const renderShelf = () => {
      if (!shelfList) return;
      shelfList.innerHTML = '';
      this.notesList.forEach((n, idx) => {
        const chip = document.createElement('div');
        chip.className = `note-chip${n.id === this.activeNoteId ? ' active' : ''}`;
        chip.dataset.id = n.id;

        const rawTitle = n.title.trim() || n.body.trim().split('\n')[0] || `Note ${idx + 1}`;
        const displayTitle = rawTitle.length > 18 ? rawTitle.slice(0, 18) + '…' : rawTitle;

        chip.innerHTML = `
          <span class="note-chip-title">${displayTitle}</span>
          <button type="button" class="note-chip-del" data-id="${n.id}" aria-label="Delete note">×</button>
        `;

        chip.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).closest('.note-chip-del')) return;
          e.stopPropagation();
          switchActiveNote(n.id);
        });

        const delBtn = chip.querySelector('.note-chip-del');
        delBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteNote(n.id);
        });

        shelfList.appendChild(chip);
      });
      updateStats();
    };

    const switchActiveNote = (id: string) => {
      // Save current inputs before switching
      const cur = getActiveNote();
      if (cur) {
        cur.title = titleInput?.value || '';
        cur.body = textArea?.value || '';
        cur.updatedAt = Date.now();
      }

      this.activeNoteId = id;
      persistNotes();

      const next = getActiveNote();
      if (next) {
        if (titleInput) titleInput.value = next.title || '';
        if (textArea) textArea.value = next.body || '';
        updateLastEdited(next.updatedAt);
      }

      renderShelf();
      updateStats();
    };

    const createNewNote = () => {
      // Save current note first
      const cur = getActiveNote();
      if (cur) {
        cur.title = titleInput?.value || '';
        cur.body = textArea?.value || '';
        cur.updatedAt = Date.now();
      }

      const newId = 'note-' + Date.now();
      const newNote = {
        id: newId,
        title: '',
        body: '',
        updatedAt: Date.now()
      };
      this.notesList.push(newNote);
      this.activeNoteId = newId;
      persistNotes();

      if (titleInput) titleInput.value = '';
      if (textArea) textArea.value = '';
      updateLastEdited(newNote.updatedAt);
      renderShelf();
      updateStats();

      // Scroll shelf to right so the new note is visible
      if (shelfList) shelfList.scrollLeft = shelfList.scrollWidth;
      titleInput?.focus();
    };

    const deleteNote = (id: string) => {
      if (this.notesList.length <= 1) {
        // Only one note left: just clear it
        const single = this.notesList[0];
        single.title = '';
        single.body = '';
        single.updatedAt = Date.now();
        if (titleInput) titleInput.value = '';
        if (textArea) textArea.value = '';
        persistNotes();
        renderShelf();
        updateStats();
        return;
      }

      const idx = this.notesList.findIndex(n => n.id === id);
      this.notesList = this.notesList.filter(n => n.id !== id);
      if (this.activeNoteId === id) {
        const nextNote = this.notesList[Math.min(idx, this.notesList.length - 1)];
        this.activeNoteId = nextNote ? nextNote.id : this.notesList[0].id;
        const active = getActiveNote();
        if (active) {
          if (titleInput) titleInput.value = active.title || '';
          if (textArea) textArea.value = active.body || '';
          updateLastEdited(active.updatedAt);
        }
      }
      persistNotes();
      renderShelf();
      updateStats();
    };

    let saveTimer: any = null;
    const triggerSave = () => {
      if (statusBadge) {
        statusBadge.textContent = 'Saving...';
        statusBadge.style.color = '#ff9f0a';
        statusBadge.style.borderColor = 'rgba(255, 159, 10, 0.35)';
      }
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try {
          const cur = getActiveNote();
          if (cur) {
            cur.title = titleInput?.value || '';
            cur.body = textArea?.value || '';
            cur.updatedAt = Date.now();
            persistNotes();
            updateLastEdited(cur.updatedAt);

            // Update active chip title live in the shelf
            const activeChip = shelfList?.querySelector(`.note-chip[data-id="${cur.id}"] .note-chip-title`);
            if (activeChip) {
              const rawTitle = cur.title.trim() || cur.body.trim().split('\n')[0] || 'Untitled';
              activeChip.textContent = rawTitle.length > 18 ? rawTitle.slice(0, 18) + '…' : rawTitle;
            }
          }
          if (statusBadge) {
            statusBadge.textContent = 'Auto-Saved';
            statusBadge.style.color = '#ffd60a';
            statusBadge.style.borderColor = 'rgba(255, 214, 10, 0.25)';
          }
        } catch {}
      }, 300);
    };

    // Initialize or load notes on tab activation
    if (!this.notesList.length) {
      loadNotesData();
    }
    const currentNote = getActiveNote();
    if (currentNote) {
      if (titleInput && titleInput.value !== currentNote.title) titleInput.value = currentNote.title || '';
      if (textArea && textArea.value !== currentNote.body) textArea.value = currentNote.body || '';
      updateLastEdited(currentNote.updatedAt);
    }
    renderShelf();
    updateStats();

    if (this.isNotesInitialized) return;
    this.isNotesInitialized = true;

    titleInput?.addEventListener('input', () => {
      updateStats();
      triggerSave();
    });

    textArea?.addEventListener('input', () => {
      updateStats();
      triggerSave();
    });

    // Helper: + New Note in header
    const btnNew = document.getElementById('btn-notes-new');
    btnNew?.addEventListener('click', (e) => {
      e.stopPropagation();
      createNewNote();
    });

    // Helper: + Note in shelf
    const btnShelfAdd = document.getElementById('btn-notes-shelf-add');
    btnShelfAdd?.addEventListener('click', (e) => {
      e.stopPropagation();
      createNewNote();
    });

    // Helper: Clear current note
    const btnClear = document.getElementById('btn-notes-clear');
    btnClear?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!titleInput?.value && !textArea?.value) return;
      if (window.confirm('Clear content of this note?')) {
        if (titleInput) titleInput.value = '';
        if (textArea) textArea.value = '';
        triggerSave();
        updateStats();
      }
    });

    // Helper: Checklist button
    const btnTodo = document.getElementById('btn-notes-todo');
    btnTodo?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!textArea) return;
      const start = textArea.selectionStart || 0;
      const end = textArea.selectionEnd || 0;
      const val = textArea.value;
      const prefix = (start === 0 || val[start - 1] === '\n') ? '- [ ] ' : '\n- [ ] ';
      textArea.value = val.substring(0, start) + prefix + val.substring(end);
      textArea.selectionStart = textArea.selectionEnd = start + prefix.length;
      textArea.focus();
      triggerSave();
      updateStats();
    });

    // Helper: Timestamp button
    const btnTimestamp = document.getElementById('btn-notes-timestamp');
    btnTimestamp?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!textArea) return;
      const start = textArea.selectionStart || 0;
      const end = textArea.selectionEnd || 0;
      const val = textArea.value;
      const now = new Date();
      const ts = `[${now.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}] `;
      textArea.value = val.substring(0, start) + ts + val.substring(end);
      textArea.selectionStart = textArea.selectionEnd = start + ts.length;
      textArea.focus();
      triggerSave();
      updateStats();
    });

    // Helper: Copy button
    const btnCopy = document.getElementById('btn-notes-copy');
    btnCopy?.addEventListener('click', (e) => {
      e.stopPropagation();
      const textToCopy = [titleInput?.value, textArea?.value].filter(Boolean).join('\n\n');
      if (!textToCopy.trim()) return;
      navigator.clipboard?.writeText(textToCopy);
      const span = btnCopy.querySelector('span');
      if (span) {
        const orig = span.textContent;
        span.textContent = 'Copied';
        setTimeout(() => { span.textContent = orig; }, 1500);
      }
    });
  }

  public initAgendaUI(): void {
    if (!this.domOverlayEl) return;

    // Update Header Date / Weather and Live Clock
    const now = new Date();
    const dateEl = document.getElementById('agenda-date-str');
    if (dateEl) {
      const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const dayName = days[now.getDay()];
      const dayNum = String(now.getDate()).padStart(2, '0');
      const monthName = months[now.getMonth()];
      dateEl.textContent = `${dayName} ${dayNum} ${monthName}`;
    }

    const weatherEl = document.getElementById('agenda-weather-str');
    if (weatherEl) {
      const tempStr = document.getElementById('weather-temp')?.textContent?.trim();
      weatherEl.textContent = tempStr && tempStr !== '--°C' ? tempStr.replace('C', '').trim() : '25°';
    }

    const timeEl = document.getElementById('agenda-live-time');
    if (timeEl) {
      let h = now.getHours();
      const m = String(now.getMinutes()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      timeEl.textContent = `${h}:${m} ${ampm}`;
    }

    // Update timeline playhead position
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const playheadEl = document.getElementById('agenda-playhead');
    if (playheadEl) {
      // Timeline covers 08:00 (480 mins) to 20:00 (1200 mins) = 720 mins span
      const pct = Math.max(0, Math.min(100, ((currentMins - 480) / 720) * 100));
      playheadEl.style.left = `${pct.toFixed(1)}%`;
    }

    this.renderAgendaTimeline();

    // Start background sound notifier for upcoming events (10m and now)
    if (!this.agendaNotifierTimer) {
      this.checkAgendaNotifications();
      this.agendaNotifierTimer = setInterval(() => {
        this.checkAgendaNotifications();
      }, 15000);
    }

    // Bind event listeners only once
    if (this.agendaListenersBound) return;
    this.agendaListenersBound = true;

    // Day / Month View Toggles
    const dayBtn = document.getElementById('agenda-toggle-day');
    const monthBtn = document.getElementById('agenda-toggle-month');
    const timelineView = document.getElementById('agenda-timeline-view');
    const monthView = document.getElementById('agenda-month-view');

    dayBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.agendaViewMode = 'day';
      dayBtn.classList.add('active');
      monthBtn?.classList.remove('active');
      timelineView?.classList.remove('hidden');
      monthView?.classList.add('hidden');
    });

    monthBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.agendaViewMode = 'month';
      monthBtn.classList.add('active');
      dayBtn?.classList.remove('active');
      timelineView?.classList.add('hidden');
      monthView?.classList.remove('hidden');
      this.renderAgendaMonth();
    });

    // Delete Active Event Button
    const delBtn = document.getElementById('agenda-btn-delete-event');
    delBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.selectedAgendaEventId) return;
      this.agendaEvents = this.agendaEvents.filter((ev) => ev.id !== this.selectedAgendaEventId);
      this.selectedAgendaEventId = this.agendaEvents[0]?.id || '';
      try {
        localStorage.setItem('roboisland_agenda_events', JSON.stringify(this.agendaEvents));
      } catch {}
      this.mascot.sounds.playChirp();
      this.renderAgendaTimeline();
    });

    // Add Event (+) Button & Popover
    const addBtn = document.getElementById('agenda-btn-add-event');
    const addPopover = document.getElementById('agenda-add-event-popover');
    const titleInput = document.getElementById('agenda-input-title') as HTMLInputElement | null;
    const timeInput = document.getElementById('agenda-input-time') as HTMLInputElement | null;
    const saveBtn = document.getElementById('agenda-save-event-btn');
    const cancelBtn = document.getElementById('agenda-cancel-event-btn');
    const clearDefaultsBtn = document.getElementById('agenda-clear-all-events-btn');

    addBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!addPopover) return;
      addPopover.classList.toggle('hidden');
      if (!addPopover.classList.contains('hidden') && titleInput) {
        titleInput.value = '';
        titleInput.focus();
      }
    });

    cancelBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      addPopover?.classList.add('hidden');
    });

    clearDefaultsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.agendaEvents = [];
      this.selectedAgendaEventId = '';
      try {
        localStorage.setItem('roboisland_agenda_events', JSON.stringify(this.agendaEvents));
      } catch {}
      this.mascot.sounds.playChirp();
      this.renderAgendaTimeline();
      addPopover?.classList.add('hidden');
    });

    saveBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const title = titleInput?.value.trim() || 'Custom Agenda';
      const timeVal = timeInput?.value || '14:00';
      const [hStr, mStr] = timeVal.split(':');
      let h = parseInt(hStr || '14', 10);
      const m = parseInt(mStr || '00', 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 || 12;
      const timeStr = `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;
      const mins = h * 60 + m;

      const newEv = {
        id: String(Date.now()),
        title,
        timeStr,
        mins,
        duration: 60,
        subtitle: `TODAY • AT ${timeStr}`
      };

      this.agendaEvents.push(newEv);
      this.selectedAgendaEventId = newEv.id;
      this.renderAgendaTimeline();
      addPopover?.classList.add('hidden');
      try {
        localStorage.setItem('roboisland_agenda_events', JSON.stringify(this.agendaEvents));
      } catch {}
      this.mascot.sounds.playChirp();
      this.checkAgendaNotifications();
    });

    // Three-dot Options Menu on Agenda
    const dotsBtn = document.getElementById('agenda-action-dots-btn');
    dotsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.roboIsland?.openSettings();
    });
  }

  public renderAgendaTimeline(): void {
    const container = document.getElementById('agenda-events-container');
    if (!container) return;

    // Load saved events from localStorage if available
    try {
      const saved = localStorage.getItem('roboisland_agenda_events');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.agendaEvents = parsed;
        }
      }
    } catch {}

    container.innerHTML = '';
    const heroTitle = document.getElementById('agenda-hero-title');
    const heroTime = document.getElementById('agenda-hero-time');
    const heroSub = document.getElementById('agenda-hero-sub');
    const delBtn = document.getElementById('agenda-btn-delete-event');

    const selected = this.agendaEvents.find((e) => e.id === this.selectedAgendaEventId) || this.agendaEvents[0];
    if (selected) {
      this.selectedAgendaEventId = selected.id;
      if (heroTitle) heroTitle.textContent = selected.title;
      if (heroTime) heroTime.textContent = selected.timeStr;
      
      const now = new Date();
      const curMins = now.getHours() * 60 + now.getMinutes();
      const diff = selected.mins - curMins;
      let dynamicSub = selected.subtitle || `TODAY • AT ${selected.timeStr}`;
      if (diff > 0 && diff <= 120) {
        dynamicSub = `NEXT • IN ${diff} MIN`;
      } else if (diff === 0) {
        dynamicSub = `HAPPENING NOW`;
      }
      if (heroSub) heroSub.textContent = dynamicSub;
      if (delBtn) delBtn.style.display = 'inline-flex';
    } else {
      this.selectedAgendaEventId = '';
      if (heroTitle) heroTitle.textContent = 'No upcoming events';
      if (heroTime) heroTime.textContent = '--:--';
      if (heroSub) heroSub.textContent = 'TODAY • ALL CLEAR';
      if (delBtn) delBtn.style.display = 'none';
    }

    this.agendaEvents.forEach((ev) => {
      // 08:00 (480 mins) to 20:00 (1200 mins) = 720 mins span
      const leftPct = Math.max(0, Math.min(90, ((ev.mins - 480) / 720) * 100));
      const widthPct = Math.max(8, Math.min(20, (ev.duration / 720) * 100));
      const isActive = ev.id === this.selectedAgendaEventId;

      const capsule = document.createElement('div');
      capsule.className = `agenda-event-capsule ${isActive ? 'active' : ''}`;
      capsule.dataset.id = ev.id;
      capsule.dataset.title = ev.title;
      capsule.dataset.time = ev.timeStr;
      capsule.style.left = `${leftPct.toFixed(1)}%`;
      capsule.style.width = `${widthPct.toFixed(1)}%`;
      capsule.title = `${ev.timeStr} - ${ev.title}`;

      const splitLine = document.createElement('span');
      splitLine.className = 'capsule-split-line';
      capsule.appendChild(splitLine);

      capsule.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedAgendaEventId = ev.id;
        this.renderAgendaTimeline();
      });

      container.appendChild(capsule);
    });
  }

  public checkAgendaNotifications(): void {
    if (!this.agendaEvents || !this.agendaEvents.length) return;
    const now = new Date();
    const curMins = now.getHours() * 60 + now.getMinutes();

    this.agendaEvents.forEach(ev => {
      const diff = ev.mins - curMins;
      // 10 minutes before event
      if (diff === 10 && !this.agendaNotificationWarned.has(`10m_${ev.id}`)) {
        this.agendaNotificationWarned.add(`10m_${ev.id}`);
        this.mascot.sounds.playChirp();
        this.triggerNotification({
          id: `agenda-10m-${ev.id}`,
          title: `Agenda • In 10 min`,
          body: `${ev.title} at ${ev.timeStr}`,
          kind: 'info',
          durationMs: 5500
        });
      }
      // Starting now (diff === 0)
      if (diff === 0 && !this.agendaNotificationWarned.has(`now_${ev.id}`)) {
        this.agendaNotificationWarned.add(`now_${ev.id}`);
        this.mascot.sounds.playAlert();
        this.triggerNotification({
          id: `agenda-now-${ev.id}`,
          title: `Agenda • Starting Now`,
          body: `${ev.title} (${ev.timeStr})`,
          kind: 'pop',
          durationMs: 6500
        });
      }
    });
  }

  public renderAgendaMonth(): void {
    const grid = document.getElementById('agenda-calendar-grid');
    const titleEl = document.getElementById('agenda-month-title');
    if (!grid) return;

    grid.innerHTML = '';
    const now = new Date();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    if (titleEl) titleEl.textContent = `${months[now.getMonth()]} ${now.getFullYear()}`;

    // Days header
    const dayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    dayHeaders.forEach((dh) => {
      const headerCell = document.createElement('div');
      headerCell.className = 'cal-header-cell';
      headerCell.textContent = dh;
      grid.appendChild(headerCell);
    });

    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const todayNum = now.getDate();

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'cal-day-cell empty';
      grid.appendChild(emptyCell);
    }

    // Days of month
    for (let d = 1; d <= totalDays; d++) {
      const dayCell = document.createElement('div');
      dayCell.className = `cal-day-cell ${d === todayNum ? 'today' : ''}`;
      dayCell.textContent = String(d);
      dayCell.addEventListener('click', (e) => {
        e.stopPropagation();
        // Switch back to day view on day click
        const dayBtn = document.getElementById('agenda-toggle-day');
        dayBtn?.click();
      });
      grid.appendChild(dayCell);
    }
  }

  private async loadTrayShelf(forceShowQr = false): Promise<void> {
    const activeView = document.getElementById('tray-active-view');
    const emptyHero = document.getElementById('tray-empty-hero');
    const shelf = document.getElementById('tray-files-shelf');
    const countLabel = document.getElementById('tray-count-label');
    const qrContainer = document.getElementById('tray-qr-container');
    const qrUrlEl = document.getElementById('tray-qr-url');
    const qrTargetEl = document.getElementById('tray-qr-target');
    const statusBadge = document.getElementById('tray-qr-status');
    if (!window.roboIsland) return;

    // Loading feedback state
    if (statusBadge) {
      statusBadge.textContent = 'Generating QR code...';
      statusBadge.className = 'qr-status-badge qr-status-loading';
      statusBadge.style.color = '#8892b0';
      statusBadge.style.background = 'rgba(136, 146, 176, 0.15)';
    }

    try {
      const dropInfo = await window.roboIsland.getDropInfo();
      const files = dropInfo?.files || [];
      this.latestTrayFiles = files;

      if (files.length > 0 || forceShowQr) {
        if (emptyHero) emptyHero.classList.add('hidden');
        if (activeView) activeView.classList.remove('hidden');
        if (countLabel) countLabel.textContent = `Staged Files (${files.length})`;

        const activeFile = files.find((f: any) => f.isActive) || files[0] || null;
        if (qrTargetEl) {
          qrTargetEl.textContent = activeFile ? activeFile.name : 'Phone Upload Mode';
          qrTargetEl.title = activeFile ? activeFile.name : 'Scan QR to send files to PC';
        }

        if (shelf) {
          shelf.innerHTML = '';
          if (files.length === 0) {
            shelf.innerHTML = '<div class="tray-empty-hint" style="color:rgba(255,255,255,0.45);font-size:11px;padding:10px;text-align:center;">No files staged yet. Click + Add File or scan QR to send from phone.</div>';
          } else {
            files.forEach((f: any, idx: number) => {
              const chip = document.createElement('div');
              chip.className = f.isActive ? 'tray-item-chip active-qr' : 'tray-item-chip';
              if (idx === 0) {
                chip.classList.add('airdrop-enter');
              }
              chip.title = `${f.name} - Spacebar for Quick Look, Drag to export`;
              chip.setAttribute('draggable', 'true');

              chip.addEventListener('dragstart', (e) => {
                e.preventDefault();
                window.roboIsland?.startDragOut?.(f.path);
              });

              const infoDiv = document.createElement('div');
              infoDiv.className = 'tray-item-info';

              const nameB = document.createElement('b');
              nameB.textContent = f.name;

              const sizeSpan = document.createElement('span');
              sizeSpan.className = 'tray-item-size';
              sizeSpan.textContent = f.sizeFormatted || (f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.round(f.size / 1024)} KB`);

              infoDiv.appendChild(nameB);
              infoDiv.appendChild(sizeSpan);

              // Apple Action Buttons (Quick Look Eye, Reveal in Folder, Delete)
              const actionsDiv = document.createElement('div');
              actionsDiv.className = 'tray-item-actions';

              const qlBtn = document.createElement('button');
              qlBtn.className = 'tray-item-btn btn-ql';
              qlBtn.title = 'Quick Look Preview (Spacebar)';
              qlBtn.type = 'button';
              qlBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
              qlBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openQuickLook(f.path);
              });

              const revBtn = document.createElement('button');
              revBtn.className = 'tray-item-btn';
              revBtn.title = 'Show in Folder';
              revBtn.type = 'button';
              revBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';
              revBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await window.roboIsland?.showItemInFolder?.(f.path);
              });

              const delBtn = document.createElement('button');
              delBtn.className = 'tray-item-btn btn-del';
              delBtn.title = 'Remove file';
              delBtn.type = 'button';
              delBtn.dataset.idx = String(idx);
              delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
              delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await window.roboIsland?.trayRemoveFile(idx);
                this.loadTrayShelf();
              });

              actionsDiv.appendChild(qlBtn);
              actionsDiv.appendChild(revBtn);

              const targetFmt = getConvertibleTargetFormat(f.name);
              if (targetFmt) {
                const convBtn = document.createElement('button');
                convBtn.className = 'tray-item-btn btn-conv';
                convBtn.title = `Convert to ${targetFmt}`;
                convBtn.type = 'button';
                convBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#00d2ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>';
                convBtn.addEventListener('click', async (e) => {
                  e.stopPropagation();
                  convBtn.style.opacity = '0.5';
                  try {
                    const res = await window.roboIsland?.convertFile?.(f.path, targetFmt);
                    if (res && res.success) {
                      await this.loadTrayShelf(true);
                      this.triggerAirDropHud('received', res.fileName || 'Converted File');
                    }
                  } catch (err) {
                    console.error('[CanvasEngine] Shelf conversion error:', err);
                  } finally {
                    convBtn.style.opacity = '1';
                  }
                });
                actionsDiv.appendChild(convBtn);
              }

              actionsDiv.appendChild(delBtn);

              chip.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!f.isActive && window.roboIsland?.setDropActiveFile) {
                  await window.roboIsland.setDropActiveFile(f.path);
                  await this.loadTrayShelf(true);
                }
              });

              chip.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.openQuickLook(f.path);
              });

              chip.appendChild(infoDiv);
              chip.appendChild(actionsDiv);
              shelf.appendChild(chip);
            });
          }
        }

        if (qrContainer && dropInfo?.svg) {
          qrContainer.innerHTML = dropInfo.svg;
        }

        const isOffline = !dropInfo?.ip || dropInfo.ip === '127.0.0.1' || dropInfo.ip.startsWith('127.');
        if (isOffline) {
          if (statusBadge) {
            statusBadge.textContent = 'Offline / No Wi-Fi';
            statusBadge.className = 'qr-status-badge qr-status-warning';
            statusBadge.style.color = '#ff9f0a';
            statusBadge.style.background = 'rgba(255, 159, 10, 0.15)';
          }
          if (qrUrlEl) {
            qrUrlEl.textContent = 'Connect Wi-Fi for phone transfer';
            qrUrlEl.title = 'Localhost only (127.0.0.1) — phone cannot reach this PC';
          }
        } else {
          if (statusBadge) {
            statusBadge.textContent = 'Waiting for phone...';
            statusBadge.className = 'qr-status-badge qr-status-ready';
            statusBadge.style.color = '#27c93f';
            statusBadge.style.background = 'rgba(39, 201, 63, 0.15)';
          }
          if (qrUrlEl) {
            qrUrlEl.textContent = dropInfo.url;
            qrUrlEl.title = dropInfo.url;
          }
        }
      } else {
        if (emptyHero) emptyHero.classList.remove('hidden');
        if (activeView) activeView.classList.add('hidden');
      }
    } catch (err) {
      console.error('[CanvasEngine] loadTrayShelf failed:', err);
      if (statusBadge) {
        statusBadge.textContent = 'Transfer server offline';
        statusBadge.className = 'qr-status-badge qr-status-error';
        statusBadge.style.color = '#ff453a';
        statusBadge.style.background = 'rgba(255, 69, 58, 0.15)';
      }
    }
  }

  public async openQuickLook(filePath: string): Promise<void> {
    if (!filePath || !window.roboIsland?.getFilePreviewData) return;
    try {
      const data = await window.roboIsland.getFilePreviewData(filePath);
      if (!data || !data.exists) return;

      const modal = document.getElementById('quicklook-modal');
      const titleEl = document.getElementById('quicklook-title');
      const badgeEl = document.getElementById('quicklook-file-badge');
      const metaEl = document.getElementById('quicklook-meta');
      const bodyEl = document.getElementById('quicklook-body');
      const btnReveal = document.getElementById('quicklook-btn-reveal');
      const btnOpen = document.getElementById('quicklook-btn-open');
      const btnClose = document.getElementById('quicklook-btn-close');

      if (!modal || !bodyEl) return;

      if (titleEl) titleEl.textContent = data.name;
      if (badgeEl) badgeEl.textContent = data.ext || 'FILE';
      if (metaEl) {
        const lineInfo = data.lineCount ? ` • ${data.lineCount} lines` : '';
        metaEl.textContent = `${data.sizeFormatted} • ${data.mtime}${lineInfo}`;
      }

      bodyEl.innerHTML = '';
      if (data.category === 'image' && data.content) {
        const imgWrap = document.createElement('div');
        imgWrap.className = 'quicklook-img-wrap';
        const img = document.createElement('img');
        img.src = data.content;
        img.alt = data.name;
        imgWrap.appendChild(img);
        bodyEl.appendChild(imgWrap);
      } else if (data.category === 'text' && data.content !== undefined) {
        const pre = document.createElement('pre');
        pre.className = 'quicklook-code-wrap';
        pre.textContent = data.content || '(Empty file)';
        bodyEl.appendChild(pre);
      } else {
        const binWrap = document.createElement('div');
        binWrap.className = 'quicklook-binary-wrap';
        binWrap.innerHTML = `
          <div class="quicklook-binary-icon">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <div class="quicklook-binary-name">${this.escapeHtml(data.name)}</div>
          <div class="quicklook-binary-desc">${this.escapeHtml(data.mimeType || 'Binary file')} • ${data.sizeFormatted}</div>
        `;
        bodyEl.appendChild(binWrap);
      }

      if (btnReveal) {
        btnReveal.onclick = (e) => {
          e.stopPropagation();
          window.roboIsland?.showItemInFolder?.(data.path);
        };
      }
      if (btnOpen) {
        btnOpen.onclick = (e) => {
          e.stopPropagation();
          window.roboIsland?.openPath?.(data.path);
        };
      }
      if (btnClose) {
        btnClose.onclick = (e) => {
          e.stopPropagation();
          this.closeQuickLook();
        };
      }
      modal.onclick = (e) => {
        if (e.target === modal) {
          this.closeQuickLook();
        }
      };

      modal.classList.remove('hidden');
      this.isQuickLookOpen = true;
      this.activeQuickLookPath = filePath;
      try {
        AudioSynth.getInstance().play('pop');
      } catch {}
    } catch (err) {
      console.error('[CanvasEngine] openQuickLook failed:', err);
    }
  }

  public closeQuickLook(): void {
    const modal = document.getElementById('quicklook-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
    this.isQuickLookOpen = false;
    this.activeQuickLookPath = null;
  }

  public formatBytes(bytes: number): string {
    if (!bytes || bytes < 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  }

  public escapeHtml(str: string): string {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private showContextMenu(x: number, y: number): void {
    const menu = document.getElementById('island-context-menu');
    if (!menu) return;
    menu.style.left = `${Math.min(window.innerWidth - 180, Math.max(10, x))}px`;
    menu.style.top = `${Math.min(window.innerHeight - 150, Math.max(10, y))}px`;
    menu.classList.remove('hidden');
  }

  private isCodeSnippet(text: string): boolean {
    if (!text) return false;
    const trimmed = text.trim();
    if (/^(>|npm |pnpm |yarn |git |cd |dir |ls |curl |node |powershell |python |pip |docker |kubectl |ssh )/i.test(trimmed)) return true;
    if (trimmed.includes('{') && trimmed.includes('}')) return true;
    if (trimmed.includes('const ') || trimmed.includes('let ') || trimmed.includes('function ') || trimmed.includes('import ') || trimmed.includes('class ') || trimmed.includes('export ')) return true;
    if (trimmed.split('\n').length > 1 && trimmed.includes(';')) return true;
    return false;
  }

  private formatTimeAgo(timestamp?: number): string {
    if (!timestamp) return '';
    const sec = Math.floor((Date.now() - timestamp) / 1000);
    if (sec < 60) return 'Just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    return `${day}d ago`;
  }

  private async loadClipboardList(): Promise<void> {
    const list = document.getElementById('clipboard-list');
    const badge = document.getElementById('clipboard-badge');
    const clearBtn = document.getElementById('btn-clipboard-clear');
    const searchInput = document.getElementById('clipboard-search-input') as HTMLInputElement | null;
    const filterChips = document.querySelectorAll('.clip-filter-chip');
    if (!list || !window.roboIsland) return;

    if (clearBtn && !(clearBtn as any).__bound) {
      (clearBtn as any).__bound = true;
      clearBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.roboIsland.clearClipboardHistory?.();
        this.mascot.sounds.playChirp();
        this.rawClipboardHistory = [];
        if (badge) badge.textContent = '0 clips';
        this.renderClipboardCards();
      });
    }

    if (searchInput && !(searchInput as any).__bound) {
      (searchInput as any).__bound = true;
      searchInput.addEventListener('input', () => {
        this.clipboardSearchQuery = searchInput.value.trim().toLowerCase();
        this.renderClipboardCards();
      });
      searchInput.addEventListener('click', (e) => e.stopPropagation());
      searchInput.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    filterChips.forEach((chip) => {
      if (!(chip as any).__bound) {
        (chip as any).__bound = true;
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          filterChips.forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          this.clipboardFilter = (chip as HTMLElement).dataset.filter || 'all';
          this.renderClipboardCards();
        });
      }
    });

    try {
      const history: any[] = await window.roboIsland.getClipboardHistory();
      this.rawClipboardHistory = history || [];
      if (badge) {
        badge.textContent = `${this.rawClipboardHistory.length} clip${this.rawClipboardHistory.length === 1 ? '' : 's'}`;
      }
      this.renderClipboardCards();
    } catch {}
  }

  private renderClipboardCards(): void {
    const list = document.getElementById('clipboard-list');
    const empty = document.getElementById('clipboard-empty');
    if (!list) return;

    list.innerHTML = '';

    // Filter items
    let filtered = this.rawClipboardHistory;

    // Filter by type
    if (this.clipboardFilter === 'image') {
      filtered = filtered.filter(item => item.type === 'image');
    } else if (this.clipboardFilter === 'url') {
      filtered = filtered.filter(item => item.type === 'url');
    } else if (this.clipboardFilter === 'text') {
      filtered = filtered.filter(item => item.type !== 'image');
    }

    // Filter by search query
    if (this.clipboardSearchQuery) {
      const q = this.clipboardSearchQuery;
      filtered = filtered.filter(item => {
        if (item.type === 'image') {
          const dims = `${item.width}x${item.height}`.toLowerCase();
          const fName = (item.filePath || '').toLowerCase();
          return dims.includes(q) || fName.includes(q) || 'screenshot'.includes(q) || 'image'.includes(q);
        }
        const text = (item.text || '').toLowerCase();
        return text.includes(q);
      });
    }

    if (!filtered || filtered.length === 0) {
      if (empty) {
        empty.style.display = 'flex';
        const h2 = empty.querySelector('h2');
        if (h2) {
          h2.textContent = this.clipboardSearchQuery ? 'No matching clips found' : 'Nothing copied yet';
        }
      }
      return;
    }

    if (empty) empty.style.display = 'none';

    filtered.forEach((item) => {
      const card = document.createElement('div');
      const timeStr = this.formatTimeAgo(item.timestamp);

      if (item.type === 'image' && (item.thumbnail || item.filePath)) {
        card.className = 'clip-card clip-card-image';
        card.draggable = true;

        const resText = (item.width && item.height) ? `${item.width} × ${item.height}` : 'Screenshot';
        const imgSrc = item.thumbnail || (item.filePath ? `file://${item.filePath.replace(/\\/g, '/')}` : '');
        card.innerHTML = `
          <div class="clip-card-header">
            <div class="clip-header-left">
              <span class="clip-tag image-tag">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                Image
              </span>
              ${timeStr ? `<span class="clip-time">${timeStr}</span>` : ''}
            </div>
            <div class="clip-card-actions">
              <button class="clip-btn-icon btn-copy" title="Copy Image" type="button">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
              <button class="clip-btn-icon btn-del" title="Delete" type="button">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div class="clip-thumb-wrap">
            <img class="clip-thumb-img" src="${imgSrc}" alt="Screenshot" draggable="false" />
            <span class="clip-badge-drag">Drag Out</span>
          </div>
          <div class="clip-image-meta">
            <span>PNG • ${resText}</span>
            <span style="color:#0a84ff; font-weight:500;">Click to copy</span>
          </div>
        `;

        // Native drag-out from RoboIsland to any external application
        card.addEventListener('dragstart', (e) => {
          e.preventDefault();
          if (item.filePath) {
            window.roboIsland.startClipboardDragOut?.(item.filePath);
          }
        });

      } else {
        const text = item.text || '';
        const isCode = this.isCodeSnippet(text);
        let tagClass = 'text-tag';
        let tagLabel = 'Text';
        let tagIcon = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

        if (item.type === 'color') {
          tagClass = 'color-tag';
          tagLabel = 'Color';
          tagIcon = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/></svg>';
        } else if (item.type === 'url') {
          tagClass = 'url-tag';
          tagLabel = 'Link';
          tagIcon = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
        } else if (isCode) {
          tagClass = 'code-tag';
          tagLabel = 'Code';
          tagIcon = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';
        }

        let bodyHtml = '';
        if (item.type === 'color') {
          bodyHtml = `
            <div class="clip-color-body">
              <span class="clip-color-swatch-large" style="background:${this.escapeHtml(text)}"></span>
              <span class="clip-color-val">${this.escapeHtml(text)}</span>
            </div>
          `;
        } else if (item.type === 'url') {
          bodyHtml = `
            <div class="clip-url-body">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              <span>${this.escapeHtml(text)}</span>
            </div>
          `;
        } else if (isCode) {
          const preview = text.length > 200 ? text.slice(0, 198) + '…' : text;
          bodyHtml = `<div class="clip-code-body">${this.escapeHtml(preview)}</div>`;
        } else {
          const preview = text.length > 180 ? text.slice(0, 178) + '…' : text;
          bodyHtml = `<div class="clip-text-body">${this.escapeHtml(preview)}</div>`;
        }

        card.className = `clip-card clip-card-${item.type || 'text'}`;
        card.innerHTML = `
          <div class="clip-card-header">
            <div class="clip-header-left">
              <span class="clip-tag ${tagClass}">${tagIcon}${tagLabel}</span>
              ${timeStr ? `<span class="clip-time">${timeStr}</span>` : ''}
            </div>
            <div class="clip-card-actions">
              <button class="clip-btn-icon btn-copy" title="Copy" type="button">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
              <button class="clip-btn-icon btn-del" title="Delete" type="button">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          ${bodyHtml}
        `;
      }

      // Click to copy item with Apple Mac feedback banner
      card.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.btn-del')) {
          e.stopPropagation();
          await window.roboIsland.deleteClipboardItem?.(item.id);
          this.rawClipboardHistory = this.rawClipboardHistory.filter(c => c.id !== item.id);
          const badge = document.getElementById('clipboard-badge');
          if (badge) badge.textContent = `${this.rawClipboardHistory.length} clip${this.rawClipboardHistory.length === 1 ? '' : 's'}`;
          this.renderClipboardCards();
          return;
        }

        await window.roboIsland.copyClipboardItem?.(item);
        this.mascot.sounds.playSuccess();

        // Show Copied overlay banner
        card.classList.add('copied');
        let banner = card.querySelector('.clip-copied-banner') as HTMLElement | null;
        if (!banner) {
          banner = document.createElement('div');
          banner.className = 'clip-copied-banner';
          banner.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Copied to Clipboard</span>
          `;
          card.appendChild(banner);
        }
        setTimeout(() => {
          card.classList.remove('copied');
          banner?.remove();
        }, 900);
      });

      list.appendChild(card);
    });
  }

  private async openPhoneDrop(): Promise<void> {
    if (!window.roboIsland) return;
    try {
      this.showDomTab('tray');
      await this.loadTrayShelf(true);
    } catch {}
  }

  private updateDomOverlay(cx: number, topY: number): void {
    if (!this.domOverlayEl) return;

    // Position overlay matching the animated canvas pill (guarded to avoid per-frame layout thrash)
    if (this._lastOverlayTopY !== topY || this._lastOverlayW !== this.currentWidth || this._lastOverlayH !== this.currentHeight) {
      this._lastOverlayTopY = topY;
      this._lastOverlayW = this.currentWidth;
      this._lastOverlayH = this.currentHeight;
      this.domOverlayEl.style.left = `${cx}px`;
      this.domOverlayEl.style.top = `${topY}px`;
      this.domOverlayEl.style.width = `${this.currentWidth}px`;
      this.domOverlayEl.style.height = `${this.currentHeight}px`;
    }

    // Datetime with 12h/24h toggle support (throttled to 1 Hz)
    const dtEl = this._statusDateTimeEl || (this._statusDateTimeEl = document.getElementById('status-datetime'));
    if (dtEl) {
      const now = new Date();
      const nowSec = Math.floor(now.getTime() / 1000);
      const is24h = this.config?.clockFormat === '24h';
      if (nowSec !== this._lastClockSec || is24h !== this._lastClockIs24h) {
        this._lastClockSec = nowSec;
        this._lastClockIs24h = is24h;
        const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
        const timeStr = is24h
          ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
          : now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        dtEl.textContent = `${dateStr} ${timeStr}`;
      }
    }

    // Weather Widget in status bar (guarded against duplicate DOM sets)
    const weatherTemp = this._weatherTempEl || (this._weatherTempEl = document.getElementById('weather-temp'));
    const weatherCond = this._weatherCondEl || (this._weatherCondEl = document.getElementById('weather-cond'));
    if (weatherTemp && this.weatherState) {
      const t = this.weatherState.temp || '--°C';
      if (this._lastWeatherTemp !== t) {
        this._lastWeatherTemp = t;
        weatherTemp.textContent = t;
      }
    }
    if (weatherCond && this.weatherState) {
      const c = this.weatherState.condition || 'Clear';
      if (this._lastWeatherCond !== c) {
        this._lastWeatherCond = c;
        weatherCond.textContent = c;
      }
    }

    // Wi-Fi & Bluetooth Popover Status
    this.updateNetworkDom();

    // Spotify Synced Lyrics DOM Stream
    this.updateLyricsDom();

    // Sync album tint variables on document root (guarded against duplicate style mutations)
    if (this.albumAccentColor) {
      if (this.currentTintR !== this.lastPushedTintR || this.currentTintG !== this.lastPushedTintG || this.currentTintB !== this.lastPushedTintB) {
        this.lastPushedTintR = this.currentTintR;
        this.lastPushedTintG = this.currentTintG;
        this.lastPushedTintB = this.currentTintB;
        document.documentElement.style.setProperty('--album-tint-hex', this.albumAccentColor);
        document.documentElement.style.setProperty('--album-tint-rgb', `${this.currentTintR}, ${this.currentTintG}, ${this.currentTintB}`);
      }
    }

    // Header Music Visualizer Button (TwoCode: mx - 42 mini equalizer that opens Music player)
    const btnHeaderMusic = document.getElementById('btn-header-music');
    if (btnHeaderMusic) {
      const isMusicPlaying = Boolean(this.mediaState.playing && this.mediaState.active);
      if (isMusicPlaying && this.currentDomTab !== 'music') {
        btnHeaderMusic.classList.remove('hidden');
        // Live sound-reactive equalizer bar heights
        const headerLevels = SystemAudioVisualizer.getInstance().getLevels(4);
        const spans = btnHeaderMusic.querySelectorAll('.header-eq-bars span');
        if (spans.length === 4) {
          spans.forEach((span, idx) => {
            const el = span as HTMLElement;
            if (headerLevels) {
              const hPct = Math.max(20, Math.min(100, Math.round((headerLevels[idx] || 0.1) * 100)));
              el.style.animation = 'none';
              el.style.height = `${hPct}%`;
            } else {
              el.style.animation = '';
            }
          });
        }
      } else {
        btnHeaderMusic.classList.add('hidden');
      }
    }

    // Card 1: Claude Code / AI Status
    const cardClaude = document.getElementById('card-claude');
    const aiStatus = document.getElementById('card-ai-status');
    const aiSub = document.getElementById('card-ai-sub');
    const aiGaugeBar = document.getElementById('card-ai-gauge-bar');
    const aiMark = document.getElementById('card-ai-mark');
    if (aiStatus && aiSub) {
      const isRunning = this.aiState.status === 'running';
      if (cardClaude) cardClaude.classList.toggle('live', isRunning);
      if (aiMark) aiMark.classList.toggle('spinning', isRunning);

      if (isRunning) {
        aiStatus.textContent = 'Thinking...';
        aiSub.textContent = this.aiState.currentTool || 'Executing task';
        if (aiGaugeBar) {
          const part = 0.5 + 0.3 * Math.sin(performance.now() / 800);
          aiGaugeBar.style.strokeDashoffset = `${(94.2 * (1 - part)).toFixed(1)}`;
          aiGaugeBar.style.stroke = '#ffffff';
        }
      } else if (this.aiState.status === 'question' || this.aiState.status === 'waiting') {
        aiStatus.textContent = 'May I?';
        aiSub.textContent = 'Waiting for your reply';
        if (aiGaugeBar) {
          aiGaugeBar.style.strokeDashoffset = '0';
          aiGaugeBar.style.stroke = '#ff9f0a';
        }
      } else if (this.aiState.status === 'done') {
        aiStatus.textContent = 'Done';
        aiSub.textContent = 'Every step complete';
        if (aiGaugeBar) {
          aiGaugeBar.style.strokeDashoffset = '0';
          aiGaugeBar.style.stroke = '#30d158';
        }
      } else {
        aiStatus.textContent = 'Connect';
        aiSub.textContent = 'in Settings';
        if (aiGaugeBar) {
          aiGaugeBar.style.strokeDashoffset = '94.2';
          aiGaugeBar.style.stroke = '#ffffff';
        }
      }
    }

    // Card 2: Music Status
    const cardMusic = document.getElementById('card-music');
    const musicTitle = document.getElementById('card-music-title');
    const musicSub = document.getElementById('card-music-sub');
    const musicCover = document.getElementById('card-music-cover') as HTMLImageElement;
    const musicFallback = document.getElementById('card-music-fallback');
    const musicViz = document.getElementById('card-music-viz');
    const homeMusicPlayIcon = document.getElementById('home-music-play-icon');

    const isMusicActive = Boolean(this.mediaState.active && this.mediaState.title);
    const isPlaying = Boolean(isMusicActive && this.mediaState.playing);

    if (cardMusic) cardMusic.classList.toggle('live', isPlaying);
    if (musicViz) musicViz.classList.toggle('hidden', !isPlaying);

    const coverUrl = this.mediaState.coverUrl || (this.mediaState as any).albumArtUrl || '';
    if (musicCover && musicFallback) {
      if (isMusicActive && coverUrl) {
        if (musicCover.src !== coverUrl) musicCover.src = coverUrl;
        musicCover.classList.remove('hidden');
        musicFallback.classList.add('hidden');
      } else {
        musicCover.classList.add('hidden');
        musicFallback.classList.remove('hidden');
      }
    }

    if (musicTitle && musicSub) {
      if (isMusicActive) {
        const title = this.mediaState.title;
        musicTitle.textContent = title.length > 15 ? title.slice(0, 14) + '…' : title;
        musicSub.textContent = isPlaying ? (this.mediaState.artist || 'Playing') : 'paused';
      } else {
        musicTitle.textContent = 'Quiet';
        musicSub.textContent = 'Nothing playing';
      }
    }

    if (homeMusicPlayIcon) {
      homeMusicPlayIcon.innerHTML = isPlaying
        ? '<rect x="6" y="4" width="3.5" height="16" rx="1"/><rect x="14.5" y="4" width="3.5" height="16" rx="1"/>'
        : '<polygon points="7 4 19 12 7 20 7 4"/>';
    }

    // Card 3: Focus Status
    const cardFocus = document.getElementById('card-focus');
    const focusTime = document.getElementById('card-focus-time');
    const focusSub = document.getElementById('card-focus-sub');
    const btnFocusToggle = document.getElementById('btn-focus-toggle');

    const f = (window as any).__roboFocus || (window as any).__twocodeFocus;
    const isFocusActive = f ? Boolean(f.active()) : this.focusState.active;
    const remSec = f ? (isFocusActive ? Math.ceil(f.left() / 1000) : f.chosen()) : this.focusState.remainingSeconds;
    const totSec = f ? Math.ceil((isFocusActive ? f.length() : f.chosen() * 1000) / 1000) : (this.focusState.totalSeconds || 1500);

    if (cardFocus) cardFocus.classList.toggle('live', isFocusActive);

    if (focusTime && focusSub) {
      const min = Math.floor(remSec / 60);
      const sec = remSec % 60;
      focusTime.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      const minsLeft = Math.max(1, Math.ceil(remSec / 60));
      focusSub.textContent = isFocusActive
        ? (this.focusState.isBreak ? 'Short Break' : `${minsLeft} min left`)
        : 'Ready to start';

      if (btnFocusToggle) {
        const currentActive = btnFocusToggle.dataset.active === 'true';
        if (currentActive !== isFocusActive) {
          btnFocusToggle.dataset.active = isFocusActive ? 'true' : 'false';
          if (!isFocusActive) {
            btnFocusToggle.dataset.lastOffset = '';
            btnFocusToggle.innerHTML = `
              <svg viewBox="0 0 36 36" width="36" height="36">
                <circle cx="18" cy="18" r="18" fill="#ffffff"/>
                <polygon points="15 12 25 18 15 24" fill="#bf5af2"/>
              </svg>
            `;
          }
        }
        if (isFocusActive) {
          const part = Math.max(0, Math.min(1, remSec / (totSec || 1500)));
          const offset = (94.2 * (1 - part)).toFixed(1);
          if (btnFocusToggle.dataset.lastOffset !== offset) {
            btnFocusToggle.dataset.lastOffset = offset;
            btnFocusToggle.innerHTML = `
              <svg viewBox="0 0 36 36" width="36" height="36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="3"/>
                <circle cx="18" cy="18" r="15" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-dasharray="94.2" stroke-dashoffset="${offset}" transform="rotate(-90 18 18)"/>
                <rect x="13" y="13" width="10" height="10" rx="2.5" fill="#ffffff"/>
              </svg>
            `;
          }
        }
      }
    }

    // Volume Scrubber
    const volBar = document.getElementById('nav-vol-bar');
    const volThumb = document.getElementById('nav-vol-thumb');
    const volTrack = document.getElementById('nav-vol-track');
    const level = this.volumeState.muted ? 0 : this.volumeState.level;
    if (volBar) volBar.style.width = `${level}%`;
    if (volThumb) volThumb.style.left = `${level}%`;
    if (volTrack) volTrack.setAttribute('aria-valuenow', String(level));

    // Volume button icon
    const btnMute = document.getElementById('btn-quick-mute');
    if (btnMute) {
      btnMute.innerHTML = `<span class="nav-icon"><svg class="nav-svg" viewBox="0 0 24 24">${
        this.volumeState.muted || level === 0
          ? '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>'
          : '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>'
      }</svg></span>`;
    }
  }

  public calculateSportsPillWidth(): number {
    if (performance.now() < this.sportsFlashUntil) return 340;
    const act = this.activeSportsActivity;
    if (!act || !act.pill) return 290;
    const text = `${act.pill.leftBadge} ${act.pill.leftScore} ${act.pill.badgeText} ${act.pill.rightScore} ${act.pill.rightBadge}`;
    return Math.max(290, Math.min(360, Math.round(text.length * 8.2 + 80)));
  }

  public drawCompactSportsScoreboard(pillLeft: number, midY: number, topY: number): void {
    const act = this.activeSportsActivity;
    if (!act || !act.pill) return;

    const w = this.currentWidth;
    const cx = pillLeft + w / 2;

    // Check if highlight flash is active
    if (performance.now() < this.sportsFlashUntil && this.sportsFlashText) {
      const sportEmoji = act.sport === 'cricket' ? '🏏' : (act.sport === 'football' ? '⚽' : '🏎️');
      this.ctx.save();
      this.ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, sans-serif';
      this.ctx.fillStyle = this.sportsFlashColor || '#22e05a';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.shadowColor = this.sportsFlashColor || '#22e05a';
      this.ctx.shadowBlur = 8;
      this.ctx.fillText(`${sportEmoji} ${this.sportsFlashText}`, cx, midY);
      this.ctx.restore();
      return;
    }

    const sportEmoji = act.sport === 'cricket' ? '🏏' : (act.sport === 'football' ? '⚽' : '🏎️');
    const pill = act.pill;

    this.ctx.save();

    // 1. Left sport icon
    this.ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(sportEmoji, pillLeft + 12, midY);

    // 2. Left team badge and score
    this.ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(pill.leftBadge, pillLeft + 30, midY);

    const badgeW = this.ctx.measureText(pill.leftBadge).width;
    this.ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "SF Pro Rounded", Inter, sans-serif';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText(pill.leftScore, pillLeft + 30 + badgeW + 5, midY);

    // 3. Center Live Indicator & Status Badge
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.005);
    this.ctx.beginPath();
    this.ctx.arc(cx - 24, midY, 3, 0, Math.PI * 2);
    this.ctx.fillStyle = `rgba(34, 224, 90, ${0.4 + 0.6 * pulse})`;
    this.ctx.fill();

    this.ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
    this.ctx.fillStyle = '#22e05a';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(pill.badgeText, cx + 2, midY);

    // 4. Right team score and badge
    this.ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(pill.rightBadge, pillLeft + w - 12, midY);

    const rBadgeW = this.ctx.measureText(pill.rightBadge).width;
    this.ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "SF Pro Rounded", Inter, sans-serif';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(pill.rightScore, pillLeft + w - 12 - rBadgeW - 5, midY);

    this.ctx.restore();
  }

  public renderSportsScorecardDOM(): void {
    const body = document.getElementById('sports-card-body');
    if (!body) return;

    const act = this.activeSportsActivity;
    if (!act) {
      body.innerHTML = '<div style="color:rgba(255,255,255,0.4); text-align:center; padding:30px;">Loading sports feed...</div>';
      return;
    }

    // Update Mode indicator button
    const modeLabel = document.getElementById('sport-mode-label');
    const modeBtn = document.getElementById('sport-mode-toggle');
    const isLive = act.isLive && !act.isSimulated;
    if (modeLabel && modeBtn) {
      modeLabel.textContent = isLive ? 'LIVE' : 'SIMULATED';
      if (isLive) {
        modeBtn.classList.remove('simulated');
        modeBtn.classList.add('live');
      } else {
        modeBtn.classList.remove('live');
        modeBtn.classList.add('simulated');
      }
    }

    // Update Island Pill Opt-In Toggle button
    const islandToggleBtn = document.getElementById('sport-island-toggle');
    const islandToggleText = document.getElementById('sport-island-toggle-text');
    if (islandToggleBtn && islandToggleText) {
      if (this.isSportsPillEnabled) {
        islandToggleBtn.classList.add('active');
        islandToggleText.textContent = 'Showing on Island: ON';
      } else {
        islandToggleBtn.classList.remove('active');
        islandToggleText.textContent = 'Show on Island: OFF';
      }
    }

    // Update Active tab buttons
    const tabBtns = document.querySelectorAll('.sport-tab-btn[data-sport]');
    tabBtns.forEach((btn) => {
      const s = (btn as HTMLElement).dataset.sport;
      if (s === act.sport) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    if (act.sport === 'cricket' && act.scorecard.cricket) {
      const sc = act.scorecard.cricket;
      const recentHtml = sc.recentBalls.map((b: string) => {
        let cls = '';
        if (b === '4') cls = 'b4';
        else if (b === '6') cls = 'b6';
        else if (b === 'W') cls = 'bW';
        return `<span class="recent-ball-pill ${cls}">${b}</span>`;
      }).join('');

      const battersHtml = sc.currentBatters.map((bat: any) => `
        <div class="subbox-row ${bat.isStriker ? 'striker' : ''}">
          <span>${bat.name} ${bat.isStriker ? '*' : ''}</span>
          <span><b>${bat.runs}</b> (${bat.balls}) <small style="color:rgba(255,255,255,0.4)">${bat.fours}x4 ${bat.sixes}x6</small></span>
        </div>
      `).join('');

      const latestComment = sc.commentary && sc.commentary.length > 0 ? sc.commentary[0].text : '';

      const homeFlag = sc.homeTeam.code === 'NZ' ? '🇳🇿' : (sc.homeTeam.code === 'IND' ? '🇮🇳' : (sc.homeTeam.code === 'AUS' ? '🇦🇺' : (sc.homeTeam.code === 'ENG' ? '🏴󠁧󠁢󠁥󠁮󠁧󠁿' : (sc.homeTeam.code === 'PAK' ? '🇵🇰' : (sc.homeTeam.code === 'SA' ? '🇿🇦' : '🏏')))));
      const awayFlag = sc.awayTeam.code === 'IND' ? '🇮🇳' : (sc.awayTeam.code === 'NZ' ? '🇳🇿' : (sc.awayTeam.code === 'AUS' ? '🇦🇺' : (sc.awayTeam.code === 'ENG' ? '🏴󠁧󠁢󠁥󠁮󠁧󠁿' : (sc.awayTeam.code === 'PAK' ? '🇵🇰' : (sc.awayTeam.code === 'SA' ? '🇿🇦' : '🏏')))));

      const matchDay = act.matchDay || 'Thursday';
      const matchDate = act.matchDate || '19 Nov 2026';
      const matchTime = act.matchTime || '11:00 AM NZDT (3:30 AM IST)';
      const venue = act.venue || 'Basin Reserve, Wellington';
      const league = act.league || 'India tour of New Zealand 2026/27';

      body.innerHTML = `
        <div class="scorecard-tour-header">
          <div class="tour-header-left">
            <span class="tour-title">${league}</span>
            <span class="tour-subtitle">${act.title || '1st Test • Basin Reserve, Wellington'}</span>
          </div>
          <div class="tour-header-right">
            <span class="tour-status-tag">${act.statusText}</span>
          </div>
        </div>

        <div class="scorecard-schedule-pill">
          <span class="sched-item">📅 <b>${matchDay}</b>, ${matchDate}</span>
          <span class="sched-divider">•</span>
          <span class="sched-item">⏰ <b>${matchTime}</b></span>
          <span class="sched-divider">•</span>
          <span class="sched-item">📍 ${venue}</span>
        </div>

        <div class="scorecard-hero">
          <div class="scorecard-team-box">
            <div class="team-identity-row">
              <span class="team-flag-icon">${homeFlag}</span>
              <span class="scorecard-team-code">${sc.homeTeam.code}</span>
            </div>
            <span class="scorecard-team-name">${sc.homeTeam.name}</span>
          </div>
          <div class="scorecard-score-box">
            <span class="scorecard-primary-score">${sc.homeTeam.score} <small style="font-size:12px; color:rgba(255,255,255,0.5)">(${sc.homeTeam.overs} ov)</small></span>
            <span class="scorecard-status-sub">${act.statusText}</span>
          </div>
          <div class="scorecard-team-box" style="align-items:flex-end">
            <div class="team-identity-row" style="flex-direction:row-reverse">
              <span class="team-flag-icon">${awayFlag}</span>
              <span class="scorecard-team-code">${sc.awayTeam.code}</span>
            </div>
            <span class="scorecard-team-name">${sc.awayTeam.name} (${sc.awayTeam.score})</span>
          </div>
        </div>

        <div class="scorecard-subgrid">
          <div class="scorecard-subbox">
            <span class="subbox-title">Batters</span>
            ${battersHtml}
          </div>
          <div class="scorecard-subbox">
            <span class="subbox-title">Bowler & Recent Balls</span>
            <div class="subbox-row">
              <span>${sc.currentBowler.name}</span>
              <span>${sc.currentBowler.overs}-${sc.currentBowler.maidens}-${sc.currentBowler.runs}-${sc.currentBowler.wickets} (Econ: ${sc.currentBowler.economy})</span>
            </div>
            <div class="recent-balls-row">
              ${recentHtml}
            </div>
          </div>
        </div>

        ${latestComment ? `
          <div style="font-size:10.5px; color:rgba(255,255,255,0.6); background:rgba(255,255,255,0.03); border-radius:8px; padding:6px 10px; line-height:1.4;">
            <b style="color:#22e05a;">Live Commentary:</b> ${latestComment}
          </div>
        ` : ''}
      `;
    } else if (act.sport === 'football' && act.scorecard.football) {
      const fb = act.scorecard.football;
      const eventsHtml = fb.events.slice(0, 4).map((ev: any) => {
        const icon = ev.type === 'goal' ? '⚽' : (ev.type === 'card_yellow' ? '🟨' : '🟥');
        return `<div class="subbox-row"><span>${icon} ${ev.minute}'</span><span>${ev.player} (${ev.team})</span></div>`;
      }).join('');

      body.innerHTML = `
        <div class="scorecard-hero">
          <div class="scorecard-team-box">
            <span class="scorecard-team-code">${fb.homeTeam.code}</span>
            <span class="scorecard-team-name">${fb.homeTeam.name}</span>
          </div>
          <div class="scorecard-score-box">
            <span class="scorecard-primary-score">${fb.homeTeam.score} - ${fb.awayTeam.score}</span>
            <span class="scorecard-status-sub">${fb.matchClock} • ${fb.half}</span>
          </div>
          <div class="scorecard-team-box" style="align-items:flex-end">
            <span class="scorecard-team-code">${fb.awayTeam.code}</span>
            <span class="scorecard-team-name">${fb.awayTeam.name}</span>
          </div>
        </div>

        <div class="scorecard-subgrid">
          <div class="scorecard-subbox">
            <span class="subbox-title">Key Match Events</span>
            ${eventsHtml || '<div style="color:rgba(255,255,255,0.4); font-size:11px;">No goals yet</div>'}
          </div>
          <div class="scorecard-subbox">
            <span class="subbox-title">Match Statistics</span>
            <div class="subbox-row">
              <span>Possession</span>
              <span><b>${fb.stats.possession[0]}%</b> - <b>${fb.stats.possession[1]}%</b></span>
            </div>
            <div class="subbox-row">
              <span>Shots on Target</span>
              <span>${fb.stats.shotsOnTarget[0]} - ${fb.stats.shotsOnTarget[1]}</span>
            </div>
            <div class="subbox-row">
              <span>Corners / Fouls</span>
              <span>${fb.stats.corners[0]}-${fb.stats.corners[1]} / ${fb.stats.fouls[0]}-${fb.stats.fouls[1]}</span>
            </div>
          </div>
        </div>
      `;
    } else if (act.sport === 'f1' && act.scorecard.f1) {
      const f1 = act.scorecard.f1;
      const driversHtml = (f1.leaderboard || []).slice(0, 5).map((d: any) => `
        <div class="f1-driver-row">
          <div class="f1-driver-left">
            <span class="f1-pos-badge">P${d.pos}</span>
            <span class="f1-color-stripe" style="background:${d.teamColor}"></span>
            <span class="f1-driver-name">${d.driverCode}</span>
            <span class="f1-tyre-badge ${d.tyreCompound}">${d.tyreCompound[0]}</span>
          </div>
          <span style="font-size:11px; font-weight:600; color:rgba(255,255,255,0.85);">${d.gapToLeader}</span>
        </div>
      `).join('');

      body.innerHTML = `
        <div class="scorecard-hero">
          <div class="scorecard-team-box">
            <span class="scorecard-team-code">${f1.grandPrix}</span>
            <span class="scorecard-team-name">${f1.circuit}</span>
          </div>
          <div class="scorecard-score-box">
            <span class="scorecard-primary-score">Lap ${f1.currentLap}/${f1.totalLaps}</span>
            <span class="scorecard-status-sub">${f1.safetyCar !== 'NONE' ? '⚠️ ' + f1.safetyCar + ' DEPLOYED' : 'GREEN FLAG'}</span>
          </div>
          <div class="scorecard-team-box" style="align-items:flex-end">
            <span class="scorecard-team-code" style="color:#a855f7;">FL: ${f1.fastestLap.driver}</span>
            <span class="scorecard-team-name">${f1.fastestLap.lapTime}</span>
          </div>
        </div>

        <div class="scorecard-subbox" style="gap:2px;">
          <span class="subbox-title">Driver Standings & Gaps</span>
          ${driversHtml}
        </div>
      `;
    }
  }

  private formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ==========================================================================
  // Universal Spotlight / Raycast Launcher Implementation (R2)
  // ==========================================================================
  public setupSpotlightLauncherDOM(): void {
    if (this.isLauncherSetup) return;
    this.isLauncherSetup = true;

    const overlay = document.getElementById('spotlight-launcher-overlay');
    const input = document.getElementById('spotlight-input') as HTMLInputElement | null;
    const clearBtn = document.getElementById('spotlight-btn-clear');
    const heroCopyBtn = document.getElementById('spotlight-btn-hero-copy');

    if (!overlay || !input) return;

    input.addEventListener('input', () => {
      const q = input.value;
      if (clearBtn) {
        if (q.length > 0) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
      }
      this.queryLauncher(q);
    });

    clearBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      input.value = '';
      clearBtn.classList.add('hidden');
      this.queryLauncher('');
      input.focus();
    });

    heroCopyBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.copyLauncherHeroResult();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (input.value.length > 0) {
          input.value = '';
          clearBtn?.classList.add('hidden');
          this.queryLauncher('');
        } else {
          this.toggleLauncher(false);
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.launcherItems.length > 0) {
          this.selectedLauncherIndex = Math.min(this.selectedLauncherIndex + 1, this.launcherItems.length - 1);
          this.updateLauncherSelection();
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.launcherItems.length > 0) {
          this.selectedLauncherIndex = Math.max(0, this.selectedLauncherIndex - 1);
          this.updateLauncherSelection();
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.launcherHeroResult) {
          this.copyLauncherHeroResult();
        } else if (this.launcherItems.length > 0 && this.selectedLauncherIndex < this.launcherItems.length) {
          const item = this.launcherItems[this.selectedLauncherIndex];
          this.executeLauncherItem(item);
        }
        return;
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (!this.isLauncherActive) return;
      if (overlay && !overlay.contains(e.target as Node)) {
        this.toggleLauncher(false);
      }
    });
  }

  public toggleLauncher(forceState?: boolean): void {
    const nextState = typeof forceState === 'boolean' ? forceState : !this.isLauncherActive;
    if (this.isLauncherActive === nextState) return;

    this.isLauncherActive = nextState;
    const overlay = document.getElementById('spotlight-launcher-overlay');
    const input = document.getElementById('spotlight-input') as HTMLInputElement | null;
    const bar = document.getElementById('spotlight-bar');
    const results = document.getElementById('spotlight-results');

    if (this.isLauncherActive) {
      if (this.isTucked) {
        this.setTucked(false);
      }
      try {
        if (window.roboIsland?.launcher?.setActive) {
          window.roboIsland.launcher.setActive(true);
        }
        window.roboIsland?.setInteractive(true);
      } catch {}

      overlay?.classList.remove('hidden');
      this.setupSpotlightLauncherDOM();

      if (input) {
        input.value = '';
        input.focus();
        this.queryLauncher('');
      }

      this.updateTargetDimensions();
      this.requestRender();
      try { AudioSynth.getInstance().play('pop'); } catch {}
    } else {
      overlay?.classList.add('hidden');
      bar?.classList.remove('has-results');
      results?.classList.add('hidden');
      this.launcherExpanded = false;
      this.launcherHeroResult = null;
      this.launcherItems = [];

      try {
        if (window.roboIsland?.launcher?.setActive) {
          window.roboIsland.launcher.setActive(false);
        }
        if (this.mode !== 'expanded') {
          window.roboIsland?.setInteractive(false);
        }
      } catch {}

      this.updateTargetDimensions();
      this.requestRender();
    }
  }

  public async queryLauncher(query: string): Promise<void> {
    const overlay = document.getElementById('spotlight-launcher-overlay');
    const bar = document.getElementById('spotlight-bar');
    const badge = document.getElementById('spotlight-badge');
    const liveIcon = document.getElementById('spotlight-live-icon');
    const results = document.getElementById('spotlight-results');
    const heroCard = document.getElementById('spotlight-hero-card');
    const heroType = document.getElementById('spotlight-hero-type');
    const heroVal = document.getElementById('spotlight-hero-val');
    const heroSub = document.getElementById('spotlight-hero-sub');
    const list = document.getElementById('spotlight-list');

    if (!overlay) return;

    try {
      const res = await (window.roboIsland?.launcher?.query ? window.roboIsland.launcher.query(query) : (window.roboIsland?.queryLauncher ? window.roboIsland.queryLauncher(query) : null));
      if (!res) return;

      if (badge && liveIcon) {
        badge.className = 'spotlight-mode-badge';
        if (res.type === 'calc') {
          badge.textContent = 'CALC';
          badge.classList.add('calc');
          badge.classList.remove('hidden');
          liveIcon.textContent = '🧮';
        } else if (res.type === 'convert') {
          badge.textContent = 'CONVERT';
          badge.classList.add('convert');
          badge.classList.remove('hidden');
          liveIcon.textContent = '🔄';
        } else if (res.type === 'ai') {
          badge.textContent = 'AI';
          badge.classList.add('ai');
          badge.classList.remove('hidden');
          liveIcon.textContent = '🤖';
        } else if (res.type === 'app' && query.trim()) {
          badge.textContent = 'APP';
          badge.classList.add('app');
          badge.classList.remove('hidden');
          liveIcon.textContent = '🚀';
        } else {
          badge.classList.add('hidden');
          liveIcon.textContent = '🔍';
        }
      }

      if (res.type === 'calc' && res.result) {
        this.launcherHeroResult = res.result.formatted || String(res.result.result);
        if (heroCard && heroType && heroVal && heroSub) {
          heroType.textContent = 'CALCULATION';
          heroType.style.color = '#00d2ff';
          heroVal.textContent = res.result.formatted;
          heroSub.textContent = `${res.result.expression} = ${res.result.formatted} (Press Enter to copy)`;
          heroCard.classList.remove('hidden');
        }
      } else if (res.type === 'convert' && res.result) {
        this.launcherHeroResult = res.result.formatted || String(res.result.toValue || res.result.toAmount);
        if (heroCard && heroType && heroVal && heroSub) {
          heroType.textContent = res.result.category ? `CONVERSION (${res.result.category.toUpperCase()})` : 'CURRENCY';
          heroType.style.color = '#f5c518';
          heroVal.textContent = res.result.formatted ? res.result.formatted.split('=')[1]?.trim() || res.result.formatted : '';
          heroSub.textContent = res.result.formatted + ' (Press Enter to copy)';
          heroCard.classList.remove('hidden');
        }
      } else {
        this.launcherHeroResult = null;
        heroCard?.classList.add('hidden');
      }

      this.launcherItems = Array.isArray(res.items) ? res.items : [];
      this.selectedLauncherIndex = 0;

      if (list) {
        if (this.launcherItems.length === 0) {
          list.innerHTML = '<li style="color:rgba(255,255,255,0.4); text-align:center; padding:16px; font-size:12px;">No matching results found</li>';
        } else {
          list.innerHTML = this.launcherItems.map((item, idx) => `
            <li class="spotlight-item ${idx === 0 ? 'selected' : ''}" data-idx="${idx}">
              <span class="spotlight-item-icon">${item.icon || '🚀'}</span>
              <div class="spotlight-item-text">
                <span class="spotlight-item-title">${this.escapeHtml(item.title)}</span>
                <span class="spotlight-item-sub">${this.escapeHtml(item.subtitle)}</span>
              </div>
              <span class="spotlight-item-badge">${this.escapeHtml(item.category)}</span>
            </li>
          `).join('');

          list.querySelectorAll('.spotlight-item').forEach((el) => {
            el.addEventListener('click', () => {
              const idx = parseInt((el as HTMLElement).dataset.idx || '0', 10);
              const item = this.launcherItems[idx];
              if (item) this.executeLauncherItem(item);
            });
          });
        }
      }

      const hasContent = !!this.launcherHeroResult || this.launcherItems.length > 0;
      if (hasContent) {
        bar?.classList.add('has-results');
        results?.classList.remove('hidden');
        this.launcherExpanded = true;
      } else {
        bar?.classList.remove('has-results');
        results?.classList.add('hidden');
        this.launcherExpanded = false;
      }

      this.updateTargetDimensions();
      this.requestRender();
    } catch (err) {
      console.warn('[CanvasEngine] Launcher query failed:', err);
    }
  }

  private updateLauncherSelection(): void {
    const list = document.getElementById('spotlight-list');
    if (!list) return;
    const items = list.querySelectorAll('.spotlight-item');
    items.forEach((item, idx) => {
      if (idx === this.selectedLauncherIndex) {
        item.classList.add('selected');
        (item as HTMLElement).scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });
  }

  private copyLauncherHeroResult(): void {
    if (!this.launcherHeroResult) return;
    try {
      navigator.clipboard.writeText(String(this.launcherHeroResult));
      try { AudioSynth.getInstance().play('pop'); } catch {}
      const copyBtn = document.getElementById('spotlight-btn-hero-copy');
      if (copyBtn) {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          this.toggleLauncher(false);
          if (copyBtn) copyBtn.textContent = 'Copy (Enter)';
        }, 300);
      } else {
        this.toggleLauncher(false);
      }
    } catch {
      this.toggleLauncher(false);
    }
  }

  private executeLauncherItem(item: any): void {
    if (!item) return;
    try { AudioSynth.getInstance().play('pop'); } catch {}

    if (item.category === 'ai') {
      this.toggleLauncher(false);
      this.showDomTab('chat');
      const chatInput = document.getElementById('chat-input') as HTMLInputElement | null;
      if (chatInput) {
        chatInput.value = item.actionPayload || item.title;
        chatInput.focus();
      }
      return;
    }

    const launchFn = window.roboIsland?.launcher?.launch || window.roboIsland?.launchLauncherItem;
    if (launchFn) {
      launchFn(item.actionPayload, item.category === 'file' ? 'file' : 'app');
    }
    this.toggleLauncher(false);
  }

  // ==========================================================================
  // Ambient Screen Glance & Error Fixer Implementation (R3)
  // ==========================================================================
  public setupScreenGlanceDOM(): void {
    if (this.isGlanceSetup) return;
    this.isGlanceSetup = true;

    // Pill click & actions
    const pill = document.getElementById('glance-error-pill');
    const btnQuickFix = document.getElementById('glance-pill-btn-quickfix');
    const btnDismiss = document.getElementById('glance-pill-btn-dismiss');

    pill?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.activeGlanceError) {
        this.openGlanceErrorModal(this.activeGlanceError);
      }
    });

    btnQuickFix?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.activeGlanceError) {
        this.applyGlanceFix(this.activeGlanceError.id);
      }
    });

    btnDismiss?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideGlanceErrorPill();
    });

    // Error Modal
    const errorModal = document.getElementById('glance-error-modal');
    const btnModalClose = document.getElementById('glance-modal-close');
    const btnModalCopy = document.getElementById('glance-modal-btn-copy');
    const btnModalRun = document.getElementById('glance-modal-btn-run');

    btnModalClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeGlanceErrorModal();
    });

    btnModalCopy?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.activeGlanceError) {
        const cmd = this.activeGlanceError.command || this.activeGlanceError.suggestedFix;
        try { navigator.clipboard.writeText(cmd); } catch {}
        this.showGlanceToast('Copied to clipboard');
        try { AudioSynth.getInstance().play('pop'); } catch {}
      }
    });

    btnModalRun?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.activeGlanceError) {
        this.applyGlanceFix(this.activeGlanceError.id);
      }
    });

    errorModal?.addEventListener('click', (e) => {
      if (e.target === errorModal) {
        this.closeGlanceErrorModal();
      }
    });

    // Summarizer Trigger & Modal
    const btnSummarize = document.getElementById('btn-glance-summarize');
    const summaryModal = document.getElementById('glance-summary-modal');
    const btnSummaryClose = document.getElementById('glance-summary-close');
    const btnSummaryCopy = document.getElementById('glance-summary-btn-copy');
    const btnSummaryAction = document.getElementById('glance-summary-btn-action');

    btnSummarize?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.triggerScreenSummarizer();
    });

    btnSummaryClose?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeGlanceSummaryModal();
    });
    btnSummaryClose?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeGlanceSummaryModal();
    });

    btnSummaryCopy?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.activeGlanceSummary) {
        const fullText = `${this.activeGlanceSummary.title}\n\nKey Takeaways:\n${(this.activeGlanceSummary.takeaways || []).map((t: string) => `• ${t}`).join('\n')}`;
        try { navigator.clipboard.writeText(fullText); } catch {}
        if (btnSummaryCopy) {
          btnSummaryCopy.textContent = 'Copied!';
          setTimeout(() => { if (btnSummaryCopy) btnSummaryCopy.textContent = 'Copy Summary'; }, 1500);
        }
        try { AudioSynth.getInstance().play('pop'); } catch {}
      }
    });

    btnSummaryAction?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeGlanceSummaryModal();
      this.showDomTab('notes');
      try { AudioSynth.getInstance().play('done'); } catch {}
    });

    summaryModal?.addEventListener('click', (e) => {
      if (e.target === summaryModal) {
        e.preventDefault();
        e.stopPropagation();
        this.closeGlanceSummaryModal();
      }
    });

    // Global Escape and Alt+S shortcuts inside island window
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const summaryModal = document.getElementById('glance-summary-modal');
        const errorModal = document.getElementById('glance-error-modal');
        let handled = false;
        if (summaryModal && !summaryModal.classList.contains('hidden')) {
          this.closeGlanceSummaryModal();
          handled = true;
        }
        if (errorModal && !errorModal.classList.contains('hidden')) {
          this.closeGlanceErrorModal();
          handled = true;
        }
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
        }
      } else if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        this.triggerScreenSummarizer();
      }
    });
  }

  public showGlanceErrorPill(error: any): void {
    this.activeGlanceError = error;
    const pill = document.getElementById('glance-error-pill');
    const badge = document.getElementById('glance-pill-badge');
    const fixText = document.getElementById('glance-pill-fix-text');

    if (pill && error) {
      if (badge) badge.textContent = (error.ruleId || error.title || 'ERROR').slice(0, 16);
      if (fixText) fixText.textContent = error.suggestedFix || error.command || '1-Tap Fix Available';
      pill.classList.remove('hidden');
      try { AudioSynth.getInstance().play('pop'); } catch {}
    }
  }

  public hideGlanceErrorPill(): void {
    const pill = document.getElementById('glance-error-pill');
    if (pill) pill.classList.add('hidden');
  }

  public openGlanceErrorModal(error?: any): void {
    const err = error || this.activeGlanceError;
    if (!err) return;
    this.activeGlanceError = err;

    const modal = document.getElementById('glance-error-modal');
    const cat = document.getElementById('glance-modal-category');
    const title = document.getElementById('glance-modal-title');
    const cause = document.getElementById('glance-modal-cause');
    const cmd = document.getElementById('glance-modal-command');
    const actionType = document.getElementById('glance-code-action-type');
    const expl = document.getElementById('glance-modal-explanation');

    if (cat) cat.textContent = (err.category || 'ERROR').toUpperCase();
    if (title) title.textContent = err.title || 'Error Detected';
    if (cause) cause.textContent = err.rootCause || 'Root cause analyzed';
    if (cmd) cmd.textContent = err.command || err.suggestedFix || '';
    if (actionType) actionType.textContent = (err.actionType || 'COMMAND').toUpperCase();
    if (expl) expl.textContent = err.explanation || '';

    modal?.classList.remove('hidden');
    window.roboIsland?.setModalActive?.(true);
    window.roboIsland?.setInteractive?.(true);
    try { AudioSynth.getInstance().play('pop'); } catch {}
  }

  public closeGlanceErrorModal(): void {
    const modal = document.getElementById('glance-error-modal');
    modal?.classList.add('hidden');
    const toast = document.getElementById('glance-modal-toast');
    if (toast) toast.classList.add('hidden');
    const isSummaryOpen = !document.getElementById('glance-summary-modal')?.classList.contains('hidden');
    if (!isSummaryOpen) {
      window.roboIsland?.setModalActive?.(false);
      if (this.mode !== 'expanded') {
        window.roboIsland?.setInteractive?.(false);
      }
    }
  }

  public async applyGlanceFix(fixId: string): Promise<void> {
    const fn = window.roboIsland?.screenGlance?.applyFix || window.roboIsland?.applyScreenFix;
    try {
      const res = fn ? await fn(fixId) : { success: true, message: 'Executed fix' };
      this.showGlanceToast(res?.message || 'Fix executed');
      try { AudioSynth.getInstance().play('done'); } catch {}
      this.mascot.setMood('happy', 3500);
      setTimeout(() => {
        this.closeGlanceErrorModal();
        this.hideGlanceErrorPill();
      }, 1200);
    } catch (err: any) {
      this.showGlanceToast(`Fix error: ${err.message || 'failed'}`);
    }
  }

  private showGlanceToast(msg: string): void {
    const toast = document.getElementById('glance-modal-toast');
    if (toast) {
      toast.textContent = `✓ ${msg}`;
      toast.classList.remove('hidden');
      setTimeout(() => { if (toast) toast.classList.add('hidden'); }, 3000);
    }
  }

  public openGlanceSummaryModal(summary?: any): void {
    if (!summary) return;
    this.activeGlanceSummary = summary;

    const modal = document.getElementById('glance-summary-modal');
    const typeIcon = document.getElementById('glance-summary-type-icon');
    const typeBadge = document.getElementById('glance-summary-type-badge');
    const readtime = document.getElementById('glance-summary-readtime');
    const title = document.getElementById('glance-summary-title');
    const takeawaysList = document.getElementById('glance-summary-takeaways');
    const sourceHint = document.getElementById('glance-summary-source');

    if (typeBadge) typeBadge.textContent = (summary.type || 'DOCUMENT').toUpperCase();
    if (typeIcon) {
      typeIcon.textContent = summary.type === 'video' ? '🎬' : (summary.type === 'pdf' ? '📄' : (summary.type === 'code' ? '💻' : '📰'));
    }
    if (readtime) readtime.textContent = summary.readingTime || '2 min read';
    if (title) title.textContent = summary.title || 'Summary';
    if (sourceHint) {
      sourceHint.textContent = summary.source === 'ai' ? '✨ Apple Intelligence Vision Summary' : '⚡ Offline Apple Intelligence Heuristic';
    }

    if (takeawaysList) {
      takeawaysList.innerHTML = '';
      const items: string[] = Array.isArray(summary.takeaways) ? summary.takeaways : [summary.rawSummary || 'Summary ready'];
      items.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        takeawaysList.appendChild(li);
      });
    }

    modal?.classList.remove('hidden');
    window.roboIsland?.setModalActive?.(true);
    window.roboIsland?.setInteractive?.(true);
    try { AudioSynth.getInstance().play('pop'); } catch {}
  }

  public closeGlanceSummaryModal(): void {
    const modal = document.getElementById('glance-summary-modal');
    modal?.classList.add('hidden');
    this.activeGlanceSummary = null;
    const isErrorOpen = !document.getElementById('glance-error-modal')?.classList.contains('hidden');
    if (!isErrorOpen) {
      window.roboIsland?.setModalActive?.(false);
      if (this.mode !== 'expanded') {
        window.roboIsland?.setInteractive?.(false);
      }
    }
  }

  public async triggerScreenSummarizer(): Promise<void> {
    const fn = window.roboIsland?.screenGlance?.summarizeActive || window.roboIsland?.summarizeActiveScreen;
    if (!fn) return;

    try {
      this.mascot.setMood('focused');
      const res = await fn();
      if (res) {
        this.openGlanceSummaryModal(res);
      }
    } catch (err) {
      console.warn('[CanvasEngine] Summarizer failed:', err);
    }
  }
}

// Instantiate engine when DOM is ready
if (typeof window !== 'undefined') {
  const initEngine = () => {
    if (!(window as any).__canvasEngine) {
      (window as any).__canvasEngine = new CanvasEngine();
    }
  };
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initEngine);
  } else {
    initEngine();
  }
}
