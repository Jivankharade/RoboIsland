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
  }
}

export type IslandMode = 'rest' | 'compact' | 'expanded';
export type IslandTab = 'media' | 'home' | 'ai' | 'tools' | 'focus' | 'tray';

export interface IslandNotification {
  id: string;
  title: string;
  body?: string;
  app?: string;
  kind?: 'done' | 'question' | 'error' | 'warn' | 'pop' | 'badge' | 'info' | 'whatsapp' | 'mail' | 'download' | 'telegram' | 'discord' | 'chat';
  filePath?: string;
  durationMs?: number;
  actions?: Array<{
    id: string;
    label: string;
    primary?: boolean;
  }>;
  sessionId?: string;
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
  private visualizerBars: number[] = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
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
  private readonly LYRICS_FONT = '600 13px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  public isDevicesOpen: boolean = false;
  public spotifyDevices: any[] = [];

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

  // Apple Quick Look & LAN Drop Beam State
  public latestTrayFiles: any[] = [];
  public activeQuickLookPath: string | null = null;
  public isQuickLookOpen = false;
  public transferProgress: number | null = null;
  public transferDirection: 'download' | 'upload' = 'download';
  public transferProgressUntil = 0;

  public isNotificationActive(): boolean {
    if (!this.activeNotification) return false;
    if (this.notificationUntil > 0 && performance.now() > this.notificationUntil) {
      this.activeNotification = null;
      return false;
    }
    return true;
  }

  public getNotificationColor(kind?: string): string {
    switch (kind) {
      case 'done':
        return '#22e05a'; // TwoCode green
      case 'whatsapp':
        return '#25d366'; // WhatsApp brand green
      case 'mail':
        return '#0078d4'; // Outlook / Apple Mail blue
      case 'download':
        return '#00d2ff'; // Apple Mac download cyan
      case 'telegram':
        return '#229ed9'; // Telegram blue
      case 'discord':
        return '#5865f2'; // Discord blurple
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
        return '#00d2ff'; // Cyan
      case 'badge':
        return '#bf5af2'; // Purple
      default:
        return '#ffffff';
    }
  }

  public triggerNotification(n: IslandNotification): void {
    this.activeNotification = n;
    const duration = n.durationMs || (n.actions && n.actions.length > 0 ? 0 : 4000);
    this.notificationUntil = duration > 0 ? performance.now() + duration : 0;

    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
      this.notificationTimer = null;
    }

    if (duration > 0) {
      this.notificationTimer = setTimeout(() => {
        this.clearNotification();
      }, duration);
    }

    // TwoCode Physics: Spring jelly kick on arrival
    this.kickJelly(0.18, 5.0, 4.0);

    // TwoCode Sound Melodies
    const soundKind = (n.kind || 'pop') as any;
    try {
      AudioSynth.getInstance().play(soundKind);
    } catch {}

    // Confetti on celebration / success / badge
    if (n.kind === 'done' || n.kind === 'badge') {
      try {
        AudioSynth.getInstance().launchConfetti(45, window.innerWidth / 2, this.getTopY() + 18);
      } catch {}
    }

    this.updateTargetDimensions();
  }

  public clearNotification(): void {
    this.activeNotification = null;
    this.notificationUntil = 0;
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
      this.notificationTimer = null;
    }
    this.updateTargetDimensions();
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
    const isDualActive = this.focusState.active && Boolean(this.mediaState.playing || (this.mediaState.active && this.mediaState.title));
    return this.mode === 'compact' && !this.isTucked && isDualActive && !(performance.now() < this.chargerSurgeUntil) && !(performance.now() < this.volumeHudUntil) && !(performance.now() < this.speedometerHudUntil) && !(performance.now() < this.airdropHudUntil);
  }

  public triggerChargerSurge(charging: boolean = true, level?: number): void {
    this.chargerSurgeCharging = charging;
    this.chargerSurgeLevel = typeof level === 'number' ? level : (this.batteryState.level || 100);
    this.chargerSurgeStartTime = performance.now();
    this.chargerSurgeUntil = performance.now() + 2600;
    this.updateTargetDimensions();
  }

  /**
   * Apple-Style Hardware Volume HUD Pop
   * When volume keys (Vol Up/Down/Mute) are pressed, smoothly expands pill to 270px for 2.2s.
   */
  public triggerVolumeHud(level: number, muted: boolean = false): void {
    this.volumeHudLevel = Math.max(0, Math.min(100, Math.round(level)));
    this.volumeHudMuted = Boolean(muted);
    this.volumeHudStartTime = performance.now();
    this.volumeHudUntil = performance.now() + 2200;
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
    this.kicks.push({ at: performance.now(), amp, hz, damp });
    if (this.kicks.length > 6) this.kicks.shift();
  }

  // Hybrid DOM Expanded UI Overlay (Rollback safety via config.expandedUiMode)
  private domOverlayEl: HTMLElement | null = null;
  private currentDomTab: 'home' | 'ai' | 'music' | 'chat' | 'focus' | 'tray' | 'clipboard' | 'notes' | 'settings' = 'home';
  private activePopover: 'none' | 'wifi' | 'bt' = 'none';

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

  private lastTime = performance.now();

  // UX-4: Resource Optimization — idle frame throttling and dirty-flag render
  private _idleFrameCount = 0;
  private _lastRenderHash = '';
  private _isPowerSaving = false;
  private _powerSavingFrameInterval = 0; // ms between frames in power-saving mode (0 = disabled)
  private _lastPowerSaveFrame = 0;

  constructor() {
    this.canvas = document.getElementById('island-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d', { alpha: true })!;
    this.mascot = new RoboMascot();

    this.initCanvasSize();
    this.initDomOverlay();
    this.setupEvents();
    this.loadInitialData();

    requestAnimationFrame(this.renderLoop.bind(this));
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

  private setupEvents(): void {
    window.addEventListener('resize', () => this.initCanvasSize());

    let dragStart: { x: number; y: number; time: number; onEyes: boolean } | null = null;
    let swallowClick = false;

    // Pointer down: track start of swipe or buddy drag
    window.addEventListener('mousedown', (e) => {
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
      this.pointerX = -1000;
      this.pointerY = -1000;
      this.checkHitTest();
    });

    // Clicks
    window.addEventListener('click', (e) => {
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
        e.clientX >= cx - halfW - 14 &&
        e.clientX <= cx + halfW + 14 &&
        e.clientY >= 0 &&
        e.clientY <= topY + effectiveH + 14;

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
        e.clientX >= cx - halfW - 14 &&
        e.clientX <= cx + halfW + 14 &&
        e.clientY >= 0 &&
        e.clientY <= topY + effectiveH + 14;

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
      }
    }, true);

    // Escape & Spacebar handling (Quick Look, Popover, Menu, Collapse)
    window.addEventListener('keydown', (e) => {
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
          this.pointerX = pt.x;
          this.pointerY = pt.y;
          this.checkHitTest();
        });
      }
      window.roboIsland.onToggleExpand(() => this.toggleExpand());
      if (window.roboIsland.onCollapseRequested) {
        window.roboIsland.onCollapseRequested(() => {
          if (this.mode === 'expanded' && this.canAutoCollapse()) {
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
      (window as any).__roboIslandTriggerNotification = (n: IslandNotification) => this.triggerNotification(n);
      (window as any).__roboIslandClearNotification = () => this.clearNotification();
    }

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
          this.focusState.active = false;
          this.focusState.remainingSeconds = f.chosen();
          this.focusState.totalSeconds = f.chosen();
        }
        wasFocusActive = isActive;
      } else {
        if (this.focusState.active && this.focusState.remainingSeconds > 0) {
          this.focusState.remainingSeconds--;
          if (this.focusState.remainingSeconds === 0) {
            this.focusState.active = false;
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
    }, 1000);
  }

  public extractAlbumColor(url: string): void {
    if (!url || url === this.lastCoverUrl) {
      if (!url) {
        this.albumImageElement = null;
        this.albumAccentColor = '#1ed760';
        this.targetTintR = 30;
        this.targetTintG = 215;
        this.targetTintB = 96;
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
      } catch {
        this.albumAccentColor = '#1ed760';
        this.targetTintR = 30;
        this.targetTintG = 215;
        this.targetTintB = 96;
      }
    };
    img.onerror = () => {
      this.albumImageElement = null;
      this.albumAccentColor = '#1ed760';
      this.targetTintR = 30;
      this.targetTintG = 215;
      this.targetTintB = 96;
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
    if (cover) {
      this.extractAlbumColor(cover);
    } else if (state.title && !cover) {
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
    if (this.isTucked) {
      // Tuck-away: 56×4 px line docked to top edge (peeks on hover)
      this.targetWidth = this.isHovered ? 72 : 56;
      this.targetHeight = 4;
      this.targetRadius = 2;
      return;
    }

    if (this.mode === 'expanded') {
      this.targetWidth = 520;
      const tab = (this.currentDomTab || 'home') as string;
      const isMusicWithLyrics = (tab === 'music' || this.activeTab === 'media') && this.hasSyncedLyrics();

      switch (tab) {
        case 'music':
          this.targetHeight = 280;
          break;
        case 'chat':
          this.targetHeight = 320;
          break;
        case 'ai':
          this.targetHeight = 310;
          break;
        case 'tray':
        case 'clipboard':
        case 'notes':
          this.targetHeight = 270;
          break;
        case 'settings':
          this.targetHeight = 300;
          break;
        case 'focus':
          this.targetHeight = 270;
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
      const hasActions = Boolean(n.actions && n.actions.length > 0);
      const hasBody = Boolean(n.body && n.body.trim().length > 0);
      const textLen = Math.max(n.title.length, (n.body || '').length * 0.65);
      this.targetWidth = hasActions ? 430 : Math.max(280, Math.min(410, 100 + textLen * 7.5));
      this.targetHeight = hasBody ? 42 : 36;
      this.targetRadius = hasBody ? 21 : 18;
      return;
    }

    if (this.mode === 'rest') {
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
      if (performance.now() < this.volumeHudUntil) {
        this.targetWidth = this.isHovered ? 280 : 270;
        this.targetHeight = 36;
        this.targetRadius = 18;
        return;
      }
      if (performance.now() < this.chargerSurgeUntil) {
        this.targetWidth = this.isHovered ? 190 : 180;
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
    } else if (this.mode === 'compact' && performance.now() < this.volumeHudUntil) {
      // Apple-style Hardware Volume HUD Pop
      this.targetWidth = this.isHovered ? 280 : 270;
      this.targetHeight = 36;
      this.targetRadius = 18;
    } else if (this.mode === 'compact' && performance.now() < this.chargerSurgeUntil) {
      // Feature B: Charger Plug-in Surge Pop (Zero Clutter)
      this.targetWidth = this.isHovered ? 190 : 180;
      this.targetHeight = 36;
      this.targetRadius = 18;
    } else if (this.aiState.status === 'running') {
      this.targetWidth = this.isHovered ? 300 : 280;
      this.targetHeight = 36;
      this.targetRadius = 18;
    } else if (this.focusState.active) {
      // TwoCode Focus Mode: Dual task (Music + Focus) or Single Focus Pill
      const isDualActive = Boolean(this.mediaState.playing || (this.mediaState.active && this.mediaState.title));
      if (isDualActive) {
        // Dual task: Spotify takes the primary pill, Focus takes the 36px detached circle bubble
        const baseWidth = 250;
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
      // Stable TwoCode compact music pill width (250px) preventing play/pause size jumping
      const baseWidth = 250;
      this.targetWidth = this.isHovered ? baseWidth + 8 : baseWidth;
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

  private getLyricNow(): { text: string | null; previous: string | null; k: number; font: string } | null {
    const rawK = Math.min(1, (performance.now() - this.lyricsChangedAt) / this.LYRICS_SWAP);
    const k = 1 - Math.pow(1 - rawK, 4);
    if (!this.syncedLyrics.length) {
      return this.lyricsLoading && performance.now() < this.lyricsHoldUntil
        ? { text: null, previous: rawK < 1 ? this.lyricsPrevious : null, k, font: this.LYRICS_FONT }
        : null;
    }
    return {
      text: this.getCurrentLyricText(),
      previous: rawK < 1 ? this.lyricsPrevious : null,
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
      // 32×18 px capsule with comfortable hover target
      const restHalfW = Math.max(halfW, 18);
      const restH = Math.max(effectiveH, 18);
      inBounds = this.pointerX >= cx - restHalfW &&
                 this.pointerX <= cx + restHalfW &&
                 this.pointerY >= topY &&
                 this.pointerY <= topY + restH;
    } else if (this.isSplitIslandActive()) {
      // Feature C: Split-Island Dual Bubble hit testing [ Pill ] ( ○ )
      const bubbleSize = this.currentHeight;
      const totalSpan = this.currentWidth + 8 + bubbleSize;
      const pillLeft = cx - totalSpan / 2;
      inBounds = this.pointerX >= pillLeft - 6 &&
                 this.pointerX <= pillLeft + totalSpan + 6 &&
                 this.pointerY >= topY &&
                 this.pointerY <= topY + this.currentHeight;
    } else {
      const marginX = this.mode === 'compact' ? 14 : 0;
      const marginY = this.mode === 'compact' ? 6 : 0;
      inBounds = this.pointerX >= cx - halfW - marginX &&
                 this.pointerX <= cx + halfW + marginX &&
                 this.pointerY >= Math.max(0, topY - marginY) &&
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
      // wait 300ms (TwoCode NORMAL_PEEK_DELAY) then auto-expand into the card.
      if (this.mode === 'compact') {
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
  }

  public getMascotMood(): MascotMood {
    return this.mascot.getMood();
  }

  public mascotJump(strength?: number): void {
    this.mascot.jump(strength);
  }

  public mascotBounce(strength?: number): void {
    this.mascot.bounce(strength);
  }

  public mascotSpeak(text: string, duration?: number): void {
    this.mascot.speak(text, duration);
  }

  public pokeMascot(x?: number, y?: number): void {
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

    // Desktop/margin outside-click collapses expanded island immediately
    if (!inBounds && this.mode === 'expanded') {
      if (this.canAutoCollapse()) {
        if (this.config && this.config.restModeEnabled && !this.mediaState.active && !this.focusState.active) {
          this.enterRest();
        } else {
          this.collapse();
        }
        return;
      }
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

    // Notification Interactive Button Clicks (TwoCode Parity: Allow, Deny, View, Dismiss)
    if (this.isNotificationActive() && Object.keys(this.notificationHits).length > 0) {
      for (const [key, rect] of Object.entries(this.notificationHits)) {
        if (this.isInsideHit(x, y, rect)) {
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
            this.clearNotification();
            return;
          }
          if (key.startsWith('action_')) {
            this.clearNotification();
            return;
          }
        }
      }
      // If notification has no interactive actions and user clicks the pill, dismiss it (or reveal file if download)
      if (inBounds && (!this.activeNotification?.actions || this.activeNotification.actions.length === 0)) {
        if (this.activeNotification?.filePath && window.roboIsland?.showItemInFolder) {
          window.roboIsland.showItemInFolder(this.activeNotification.filePath);
        }
        this.clearNotification();
        return;
      }
      if (inBounds) {
        return;
      }
    }

    if (this.mode === 'rest') {
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

        // Clicking on the detached circular bubble opens Focus tab directly
        if (Math.hypot(x - bubbleCx, y - bubbleCy) <= bubbleR + 4) {
          this.activeTab = 'focus';
          this.showDomTab('focus');
          this.expand();
          return;
        }

        // Clicking on the main Spotify pill opens Media tab
        if (x >= pillLeft && x <= pillLeft + this.currentWidth && y >= topY && y <= topY + this.currentHeight) {
          if (this.mediaState.active && this.mediaState.title) {
            this.activeTab = 'media';
            this.showDomTab('music');
          }
          this.mascot.jump();
          this.expand();
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
          if (this.focusState.active && !(this.mediaState.active && this.mediaState.title)) {
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
      requestAnimationFrame(this.renderLoop.bind(this));
      return;
    }

    // UX-4: Power-saving throttle — cap frame rate when battery is low & discharging
    if (this._isPowerSaving && this._powerSavingFrameInterval > 0) {
      if (time - this._lastPowerSaveFrame < this._powerSavingFrameInterval) {
        requestAnimationFrame(this.renderLoop.bind(this));
        return;
      }
      this._lastPowerSaveFrame = time;
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

    // Smooth album ambient tint color transition (RGB lerp)
    this.currentTintR += (this.targetTintR - this.currentTintR) * 0.12;
    this.currentTintG += (this.targetTintG - this.currentTintG) * 0.12;
    this.currentTintB += (this.targetTintB - this.currentTintB) * 0.12;

    // Push album tint into CSS custom properties only when RGB values change (prevents per-frame DOM style recalc)
    const tr = Math.round(this.currentTintR);
    const tg = Math.round(this.currentTintG);
    const tb = Math.round(this.currentTintB);
    if (tr !== this.lastPushedTintR || tg !== this.lastPushedTintG || tb !== this.lastPushedTintB) {
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

    // Compact idle state detection for motion stabilization (stops idle bobbing & vertical jitter)
    this.mascot.isCompactIdle = (this.mode === 'compact' && !this.mediaState.active && !this.focusState.active && this.aiState.status !== 'running');
    if (this.mascot.isCompactIdle && this.mascot.getMood() === 'focused') {
      this.mascot.setMood('neutral');
    }

    // Mascot state update (dead-center within the inner head capsule at topY + 13)
    this.mascot.update(dt, this.pointerX, this.pointerY, cx, topY + 13);

    // Render Content based on mode
    if (this.isTucked) {
      if (this.domOverlayEl) this.domOverlayEl.classList.add('hidden');
      requestAnimationFrame(this.renderLoop.bind(this));
      return;
    } else if (this.mode === 'rest') {
      if (this.domOverlayEl) this.domOverlayEl.classList.add('hidden');
      if (performance.now() < this.airdropHudUntil) {
        this.drawAirDropHudContent(cx, topY);
      } else if (performance.now() < this.speedometerHudUntil) {
        this.drawSpeedometerHudContent(cx, topY);
      } else if (performance.now() < this.volumeHudUntil) {
        this.drawVolumeHudContent(cx, topY);
      } else if (performance.now() < this.chargerSurgeUntil) {
        this.drawChargerSurgeContent(cx, topY);
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
        }
        // In DOM mode, draw capsule eyes inside the dedicated #mascot-eye-slot element
        const eyeSlot = document.getElementById('mascot-eye-slot');
        if (eyeSlot) {
          const rect = eyeSlot.getBoundingClientRect();
          const eyeX = rect.left + rect.width / 2;
          const eyeY = rect.top + rect.height / 2;
          this.mascot.drawFloatingEyes(this.ctx, eyeX, eyeY, 0.72);
        } else {
          this.mascot.drawFloatingEyes(this.ctx, cx - 140, topY + 18, 0.72);
        }
      }
    }

    requestAnimationFrame(this.renderLoop.bind(this));
  }

  // UX-4: Power-saving mode helper — throttle non-essential animations when battery is low & discharging
  private _updatePowerSavingMode(battery: any): void {
    const level = Math.round(battery.level * 100);
    const charging = battery.charging;
    // Enter power-saving mode: battery <= 20% and not charging
    this._isPowerSaving = !charging && level <= 20;
    // Cap at ~15 fps (66ms) in power-saving mode to reduce CPU/GPU load
    this._powerSavingFrameInterval = this._isPowerSaving ? 66 : 0;
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

      // 2. Secondary Circular Bubble: Subtle violet specular sheen
      this.ctx.beginPath();
      this.ctx.arc(bubbleCx, bubbleCy, bubbleR - 0.5, 0, Math.PI * 2);
      this.ctx.strokeStyle = 'rgba(191, 90, 242, 0.35)';
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
    const isMusicActive = this.mode === 'compact' && !this.isTucked && !isSurgeActive && Boolean(this.mediaState.active && this.mediaState.title);

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
      this.ctx.shadowColor = 'rgba(52, 199, 89, 0.50)';
      this.ctx.shadowBlur = 14;
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
    if (isMusicActive) {
      const tr = Math.round(this.currentTintR);
      const tg = Math.round(this.currentTintG);
      const tb = Math.round(this.currentTintB);
      this.ctx.save();
      this.islandPath(this.ctx, left, topY, w, h, r);
      this.ctx.clip();
      const fold = h < 60;
      const tintGrad = this.ctx.createLinearGradient(0, fold ? topY : topY + h * 0.18, 0, topY + h);
      tintGrad.addColorStop(0, `rgba(${tr}, ${tg}, ${tb}, ${fold ? 0.08 : 0})`);
      tintGrad.addColorStop(0.5, `rgba(${tr}, ${tg}, ${tb}, ${fold ? 0.18 : 0.12})`);
      tintGrad.addColorStop(1, `rgba(${tr}, ${tg}, ${tb}, 0.38)`);
      this.ctx.fillStyle = tintGrad;
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
      this.ctx.strokeStyle = this.getNotificationColor(this.activeNotification?.kind);
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
      this.ctx.strokeStyle = 'rgba(52, 199, 89, 0.55)';
    } else if (isMusicActive) {
      const tr = Math.round(this.currentTintR);
      const tg = Math.round(this.currentTintG);
      const tb = Math.round(this.currentTintB);
      const rimGrad = this.ctx.createLinearGradient(0, topY, 0, topY + h);
      rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
      rimGrad.addColorStop(0.5, `rgba(${tr}, ${tg}, ${tb}, 0.25)`);
      rimGrad.addColorStop(1, `rgba(${tr}, ${tg}, ${tb}, 0.70)`);
      this.ctx.strokeStyle = rimGrad;
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

  private drawRestContent(cx: number, topY: number): void {
    const midY = topY + this.currentHeight / 2;
    if (this.isNotificationActive()) {
      this.drawNotificationContent(cx - this.currentWidth / 2, midY, topY);
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

    if (performance.now() < this.airdropHudUntil) {
      // Apple AirDrop Transfer HUD Pop
      this.drawAirDropHudContent(cx, topY);
    } else if (performance.now() < this.speedometerHudUntil) {
      // Apple-style Hardware Speedometer HUD Pop (CPU, RAM, Storage)
      this.drawSpeedometerHudContent(cx, topY);
    } else if (performance.now() < this.volumeHudUntil) {
      // Apple-style Hardware Volume Pop HUD
      this.drawVolumeHudContent(cx, topY);
    } else if (performance.now() < this.chargerSurgeUntil) {
      // Feature B: Charger Plug-in Surge Pop (Zero Clutter)
      this.drawChargerSurgeContent(cx, topY);
    } else if (this.isSplitIslandActive()) {
      // Feature C: Split-Island Dual Bubble [ Pill ] ( ○ ) for Dual Tasks (Music + Focus)
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

      // 1. Primary Pill: Render Full Spotify Music Island!
      // (TwoCode ai-monitor-ui.js line 1156 & lyrics-ui.js line 81: Album art, synced lyrics or track title, visualizer)
      if (this.mediaState.active && this.mediaState.title) {
        this.drawCompactMusicIsland(left, midY, topY);
      } else {
        this.mascot.drawFloatingEyes(this.ctx, pillCx, midY, 0.95);
      }

      // 2. Detached Bubble: TwoCode Focus Circle (ai-monitor-ui.js lines 1258-1264)
      // d = UI.BAR_H + 4 (36px circle), ring radius d / 2 - 9 (9px)
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

      // Mascot eyes in the middle
      this.mascot.drawFloatingEyes(this.ctx, mid, cy + 0.5, 0.95);

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
    } else if (this.mediaState.active && this.mediaState.title) {
      // Dynamic Album-Tinted Music Island (TwoCode Direct Implementation)
      this.drawCompactMusicIsland(pillLeft, midY, topY);
    } else {
      // TRUE RESTING MODE (98 x 26 px TwoCode Visual Calibration matching Screenshot 2):
      this.drawCompactRestingDualStructure(cx, topY);
    }
  }

  /**
   * TwoCode Notification Content Renderer:
   * Direct parity with TwoCode ai-monitor-ui.js lines 1115-1135 & mascot.html.
   * - Left: Mascot eyes or Claude orange sparkle mark
   * - Center: Title & body with graceful font and string truncation
   * - Right: Interactive Allow / Deny buttons (76x26px, 8px radius) or circular dismiss button
   */
  public drawNotificationContent(pillLeft: number, midY: number, topY: number): void {
    if (!this.activeNotification) return;
    this.notificationHits = {};
    const n = this.activeNotification;
    const W = this.currentWidth;
    const cy = midY;
    const left = pillLeft + 14;
    const right = pillLeft + W - 14;
    const color = this.getNotificationColor(n.kind);

    // Left Icon / App Badge (WhatsApp, Mail, Download, Done, AI Sparkle, Mascot Eyes)
    const iconR = 10;
    const iconCx = left + 8;
    const iconCy = cy;

    if (n.kind === 'whatsapp') {
      // WhatsApp brand green circular badge with phone/chat handset icon
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(iconCx, iconCy, iconR, 0, Math.PI * 2);
      this.ctx.fillStyle = '#25d366';
      this.ctx.fill();

      // Handset silhouette in white
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(iconCx, iconCy, 5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = '#25d366';
      this.ctx.beginPath();
      this.ctx.arc(iconCx, iconCy, 3, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(iconCx - 2, iconCy - 4, 4, 8);
      this.ctx.restore();
    } else if (n.kind === 'mail') {
      // Mail blue circular badge with envelope icon
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(iconCx, iconCy, iconR, 0, Math.PI * 2);
      this.ctx.fillStyle = '#0078d4';
      this.ctx.fill();

      // Envelope icon
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.4;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      const ew = 10, eh = 7;
      this.ctx.strokeRect(iconCx - ew / 2, iconCy - eh / 2, ew, eh);
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx - ew / 2, iconCy - eh / 2);
      this.ctx.lineTo(iconCx, iconCy + 0.5);
      this.ctx.lineTo(iconCx + ew / 2, iconCy - eh / 2);
      this.ctx.stroke();
      this.ctx.restore();
    } else if (n.kind === 'download') {
      // Download cyan circular badge with downward arrow
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(iconCx, iconCy, iconR, 0, Math.PI * 2);
      this.ctx.fillStyle = '#00d2ff';
      this.ctx.fill();

      // Downward arrow
      this.ctx.strokeStyle = '#081018';
      this.ctx.lineWidth = 1.6;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx, iconCy - 4.5);
      this.ctx.lineTo(iconCx, iconCy + 3);
      this.ctx.moveTo(iconCx - 3.5, iconCy);
      this.ctx.lineTo(iconCx, iconCy + 3.5);
      this.ctx.lineTo(iconCx + 3.5, iconCy);
      this.ctx.stroke();
      this.ctx.restore();
    } else if (n.kind === 'done') {
      // Done green circular badge with checkmark
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(iconCx, iconCy, iconR, 0, Math.PI * 2);
      this.ctx.fillStyle = '#22e05a';
      this.ctx.fill();

      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.6;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(iconCx - 3.5, iconCy + 0.5);
      this.ctx.lineTo(iconCx - 1, iconCy + 3);
      this.ctx.lineTo(iconCx + 4, iconCy - 2.5);
      this.ctx.stroke();
      this.ctx.restore();
    } else if (n.kind === 'question') {
      this.ctx.save();
      this.ctx.strokeStyle = '#d97757';
      this.ctx.lineWidth = 2.4;
      this.ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const an = (i * Math.PI) / 4;
        this.ctx.beginPath();
        this.ctx.moveTo(left + 8 - Math.cos(an) * 6.5, cy - Math.sin(an) * 6.5);
        this.ctx.lineTo(left + 8 + Math.cos(an) * 6.5, cy + Math.sin(an) * 6.5);
        this.ctx.stroke();
      }
      this.ctx.restore();
    } else {
      this.mascot.drawFloatingEyes(this.ctx, left + 10, cy, 0.85);
    }

    const textLeft = left + 26;

    // Interactive Action Buttons (e.g. Deny & Allow for Claude Code tool execution)
    const actions = n.actions;
    if (actions && actions.length > 0) {
      const bw = 76;
      const bh = 26;
      const by = Math.round(cy - bh / 2);

      let curRight = right;
      for (let i = actions.length - 1; i >= 0; i--) {
        const item = actions[i];
        if (!item) continue;
        const bx = curRight - bw;
        const isPrimary = item.primary ?? (item.id === 'allow');
        const isHovered = this.isHovered && this.isInsideHit(this.pointerX, this.pointerY, { x: bx, y: by, width: bw, height: bh });

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.roundRect(bx, by, bw, bh, 8);
        this.ctx.fillStyle = isPrimary
          ? (isHovered ? '#e5e5ea' : '#ffffff')
          : (isHovered ? '#3a3a3c' : '#2c2c2e');
        this.ctx.fill();

        this.ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
        this.ctx.fillStyle = isPrimary ? '#000000' : '#ffffff';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(item.label, bx + bw / 2, cy);
        this.ctx.restore();

        const hitKey = item.id === 'allow' ? 'cAllow' : item.id === 'deny' ? 'cDeny' : `action_${item.id}`;
        this.notificationHits[hitKey] = { x: bx, y: by, width: bw, height: bh };

        curRight -= bw + 8;
      }

      // Title truncated before the buttons
      const maxTextW = Math.max(50, curRight - textLeft - 8);
      const titleFont = '600 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
      const truncTitle = this.truncateText(n.title, maxTextW, titleFont);

      this.ctx.save();
      this.ctx.font = titleFont;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(truncTitle, textLeft, cy);
      this.ctx.restore();

    } else {
      // Standard notification without buttons (Done, Error, Info, Badge)
      const hasBody = Boolean(n.body && n.body.trim().length > 0);
      const titleFont = hasBody
        ? '600 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif'
        : '600 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
      const bodyFont = '400 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';

      const closeSize = 20;
      const closeX = right - closeSize;
      const closeY = cy - closeSize / 2;
      const isCloseHovered = this.isHovered && this.isInsideHit(this.pointerX, this.pointerY, { x: closeX, y: closeY, width: closeSize, height: closeSize });

      const maxTextW = Math.max(80, closeX - textLeft - 10);
      const truncTitle = this.truncateText(n.title, maxTextW, titleFont);

      this.ctx.save();
      this.ctx.textAlign = 'left';
      if (hasBody) {
        const truncBody = this.truncateText(n.body!, maxTextW, bodyFont);
        this.ctx.font = titleFont;
        this.ctx.fillStyle = color;
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(truncTitle, textLeft, cy - 1);

        this.ctx.font = bodyFont;
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
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
    if (this.albumImageElement?.complete && this.albumImageElement.naturalWidth > 0) {
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
    const vizW = 18;
    const vizH = 14;
    const vizX = right - vizW - 4;
    const n = 5;
    const t = performance.now() / 1000;
    const playing = Boolean(this.mediaState.playing);
    const gap = 2.0;
    const bw = (vizW - gap * (n - 1)) / n;

    this.ctx.save();
    this.ctx.shadowColor = this.albumAccentColor || '#ffffff';
    this.ctx.shadowBlur = 3;
    for (let i = 0; i < n; i++) {
      const raw = !playing ? 0.06
        : 0.2 + 0.6 * Math.abs(Math.sin(t * (2.1 + i * 0.43) + i * 1.7)) * (0.65 + 0.35 * Math.sin(t * 1.3 + i * 0.9));
      const want = !playing ? 0.1 : Math.min(1, 0.12 + 1.15 * Math.pow(raw, 0.65));
      if (!this.visualizerBars[i]) this.visualizerBars[i] = 0.15;
      this.visualizerBars[i] += (want - this.visualizerBars[i]) * (want > this.visualizerBars[i] ? 0.5 : 0.16);
      const bh = Math.max(bw, vizH * Math.min(1, this.visualizerBars[i]));
      const bx = vizX + i * (bw + gap);
      const by = cy - bh / 2;

      this.ctx.beginPath();
      this.ctx.roundRect(bx, by, bw, bh, bw / 2);
      this.ctx.fillStyle = this.albumAccentColor || '#ffffff';
      this.ctx.fill();
    }
    this.ctx.restore();

    // 3. Middle Content: Synchronized Lyrics or Song / Ad Title (No eyes during media playback)
    const x0 = coverX + cs + 12;
    const x1 = vizX - 12;
    const w = Math.max(20, x1 - x0);
    const band = 20;

    // Resolve song/ad title text
    const getTrackDisplayName = (): string => {
      const title = (this.mediaState.title || '').trim();
      const artist = (this.mediaState.artist || '').trim();
      if (!title) return this.mediaState.app || 'Music';
      if (artist && artist !== 'Spotify' && !title.toLowerCase().includes(artist.toLowerCase())) {
        const combined = `${title} - ${artist}`;
        this.ctx.save();
        this.ctx.font = '500 12.5px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        const fits = this.ctx.measureText(combined).width <= w;
        this.ctx.restore();
        if (fits) return combined;
      }
      return title;
    };

    const trackName = getTrackDisplayName();
    const lyric = this.hasSyncedLyrics() ? this.getLyricNow() : null;

    const line = (s: string | null, dy: number) => {
      if (!s) return;
      const alpha = Math.max(0, 1 - Math.abs(dy) / band);
      if (alpha <= 0.01) return;
      this.ctx.save();
      this.ctx.globalAlpha *= alpha;
      let fontSz = 12.5;
      this.ctx.font = `500 ${fontSz}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      const full = this.ctx.measureText(s).width;
      if (full > w) {
        fontSz = Math.max(10.5, 12.5 * w / full);
        this.ctx.font = `500 ${fontSz.toFixed(1)}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      }
      let text = s;
      while (text.length > 1 && this.ctx.measureText(text + '...').width > w) {
        text = text.slice(0, -1);
      }
      if (text !== s) text += '...';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(text, x0 + w / 2, cy + 0.5 + dy);
      this.ctx.restore();
    };

    if (lyric && (lyric.text || lyric.previous)) {
      const k = lyric.k;
      const prev = lyric.previous || (lyric.text ? trackName : null);
      const curr = lyric.text || trackName;

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(x0 - 4, cy - band / 2 - 2, w + 8, band + 4);
      this.ctx.clip();
      line(prev, -band * k);
      line(curr, band * (1 - k));
      this.ctx.restore();
    } else {
      // Steady display of Track Name or Ad Name (zero eyes during media playback)
      line(trackName, 0);
    }
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
   * Feature B: Charger Plug-in Surge Pop Content (Zero Clutter)
   */
  private drawChargerSurgeContent(cx: number, topY: number): void {
    const pillLeft = cx - this.currentWidth / 2;
    const midY = topY + this.currentHeight / 2;
    const isCharging = this.chargerSurgeCharging;
    const level = this.chargerSurgeLevel;

    // Left: Floating Eyes
    this.mascot.drawFloatingEyes(this.ctx, pillLeft + 32, midY, 0.90);

    // Center divider dot
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    this.ctx.beginPath();
    this.ctx.arc(cx - 10, midY, 1.8, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // Right: Battery % and Lightning Bolt / Battery Glyph
    this.ctx.save();
    const rightAreaX = cx + 8;
    this.ctx.font = '700 12.5px -apple-system, BlinkMacSystemFont, "SF Pro Rounded", "Segoe UI", sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';

    if (isCharging) {
      // Glowing green text & lightning bolt
      this.ctx.fillStyle = '#34c759';
      this.ctx.shadowColor = 'rgba(52, 199, 89, 0.65)';
      this.ctx.shadowBlur = 6;
      this.ctx.fillText(`${level}%`, rightAreaX + 18, midY);

      // Canvas Lightning Bolt path
      const boltX = rightAreaX;
      const boltY = midY;
      this.ctx.fillStyle = '#34c759';
      this.ctx.beginPath();
      this.ctx.moveTo(boltX + 7, boltY - 7);
      this.ctx.lineTo(boltX + 2, boltY);
      this.ctx.lineTo(boltX + 6, boltY);
      this.ctx.lineTo(boltX + 4, boltY + 7);
      this.ctx.lineTo(boltX + 10, boltY - 1);
      this.ctx.lineTo(boltX + 6, boltY - 1);
      this.ctx.closePath();
      this.ctx.fill();
    } else {
      // Clean white text & battery icon outline
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText(`${level}%`, rightAreaX + 22, midY);

      const bX = rightAreaX;
      const bY = midY - 6;
      const bW = 15;
      const bH = 11;
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      this.ctx.lineWidth = 1.2;
      this.ctx.strokeRect(bX, bY, bW, bH);
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      this.ctx.fillRect(bX + bW + 1, bY + 3.5, 1.5, 4);
      const fillW = Math.max(1, (bW - 3) * (level / 100));
      this.ctx.fillStyle = level <= 20 ? '#ff453a' : '#ffffff';
      this.ctx.fillRect(bX + 1.5, bY + 1.5, fillW, bH - 3);
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
    const vizW = 44;
    const vizH = 28;
    const vizX = right - 44;
    const vizCy = top0 + 24;
    const n = 6;
    const t = performance.now() / 1000;
    const playing = Boolean(this.mediaState.playing);
    const gap = Math.max(2, (vizW / n) * 0.4);
    const vbw = (vizW - gap * (n - 1)) / n;

    this.ctx.save();
    this.ctx.shadowColor = accent;
    this.ctx.shadowBlur = vizH * 0.35;
    for (let i = 0; i < n; i++) {
      const raw = !playing ? 0.06
        : 0.2 + 0.6 * Math.abs(Math.sin(t * (2.1 + i * 0.43) + i * 1.7)) * (0.65 + 0.35 * Math.sin(t * 1.3 + i * 0.9));
      const want = !playing ? 0.1 : Math.min(1, 0.12 + 1.15 * Math.pow(raw, 0.65));
      if (!this.visualizerBars[i]) this.visualizerBars[i] = 0.15;
      this.visualizerBars[i] += (want - this.visualizerBars[i]) * (want > this.visualizerBars[i] ? 0.5 : 0.16);
      const bh = Math.max(vbw, vizH * Math.min(1, this.visualizerBars[i]));
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

      // Line before (dim)
      this.ctx.font = '500 12px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
      this.ctx.fillText(lyr.before, x0, ly + 12 + push);

      // Now sung line (bold white 15px)
      this.ctx.font = '700 15px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = lyr.now ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
      this.ctx.fillText(lyr.now || '♪', x0, ly + 12 + step + push);

      // Next line (dim)
      this.ctx.font = '500 12px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
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

    // Focus Toggle Play Button (Home Dashboard)
    const btnFocus = document.getElementById('btn-focus-toggle');
    if (btnFocus) {
      btnFocus.addEventListener('click', (e) => {
        e.stopPropagation();
        const f = (window as any).__roboFocus || (window as any).__twocodeFocus;
        if (f) {
          f.toggle();
        } else {
          this.focusState.active = !this.focusState.active;
        }
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
    }
    this.updateTargetDimensions();
    if (!this.domOverlayEl) return;

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
      if (phoneBtn) phoneBtn.classList.add('hidden');
      document.getElementById('panel-home')?.classList.add('active');
    } else if (tab === 'ai') {
      setTwoToneTitle('Claude ', 'Code', '#d97757');
      if (phoneBtn) phoneBtn.classList.add('hidden');
      document.getElementById('panel-ai')?.classList.add('active');
    } else if (tab === 'music') {
      const tint = this.albumAccentColor || '#ff375f';
      setTwoToneTitle('Music ', 'Player', tint);
      if (phoneBtn) phoneBtn.classList.add('hidden');
      document.getElementById('panel-music')?.classList.add('active');
    } else if (tab === 'tray') {
      setTwoToneTitle('File ', 'Tray', '#ffd60a');
      if (phoneBtn) phoneBtn.classList.remove('hidden');
      document.getElementById('panel-tray')?.classList.add('active');
      this.loadTrayShelf();
    } else if (tab === 'clipboard') {
      setTwoToneTitle('Clip', 'board', '#64d2ff');
      if (phoneBtn) phoneBtn.classList.add('hidden');
      document.getElementById('panel-clipboard')?.classList.add('active');
      this.loadClipboardList();
    } else if (tab === 'chat') {
      setTwoToneTitle('Robo ', 'Chat', '#30d158');
      if (phoneBtn) phoneBtn.classList.add('hidden');
      document.getElementById('panel-chat')?.classList.add('active');
      const input = document.getElementById('chat-input') as HTMLInputElement;
      if (input) input.focus();
    } else if (tab === 'focus') {
      setTwoToneTitle('Focus ', 'Timer', '#bf5af2');
      if (phoneBtn) phoneBtn.classList.add('hidden');
      const focusPanel = document.getElementById('panel-focus');
      if (focusPanel) {
        focusPanel.classList.add('active');
      } else {
        document.getElementById('panel-home')?.classList.add('active');
      }
    } else if (tab === 'settings') {
      if (titleEl) titleEl.textContent = '';
      document.getElementById('panel-home')?.classList.add('active');
      window.roboIsland?.openSettings();
    } else {
      if (titleEl) titleEl.textContent = '';
      document.getElementById('panel-home')?.classList.add('active');
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

  private async loadClipboardList(): Promise<void> {
    const list = document.getElementById('clipboard-list');
    const empty = document.getElementById('clipboard-empty');
    const badge = document.getElementById('clipboard-badge');
    const clearBtn = document.getElementById('btn-clipboard-clear');
    if (!list || !window.roboIsland) return;

    if (clearBtn && !(clearBtn as any).__bound) {
      (clearBtn as any).__bound = true;
      clearBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.roboIsland.clearClipboardHistory?.();
        this.mascot.sounds.playChirp();
        this.loadClipboardList();
      });
    }

    try {
      const history: any[] = await window.roboIsland.getClipboardHistory();
      list.innerHTML = '';
      if (history && history.length > 0) {
        if (empty) empty.style.display = 'none';
        if (badge) badge.textContent = `${history.length} clip${history.length > 1 ? 's' : ''}`;

        history.forEach((item) => {
          const card = document.createElement('div');
          const isImage = item.type === 'image' && (item.thumbnail || item.filePath);

          if (isImage) {
            card.className = 'clip-card clip-card-image';
            card.draggable = true;

            const resText = (item.width && item.height) ? `${item.width}×${item.height}` : 'Screenshot';
            card.innerHTML = `
              <div class="clip-thumb-wrap">
                <img class="clip-thumb-img" src="${item.thumbnail || ''}" alt="Screenshot" draggable="false" />
                <span class="clip-badge-drag">Drag Out</span>
              </div>
              <div class="clip-info">
                <div class="clip-title-row">
                  <span class="clip-tag image-tag">
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    Screenshot
                  </span>
                  <span class="clip-res">${resText}</span>
                </div>
                <div class="clip-actions">
                  <button class="clip-action-btn btn-copy" title="Copy image to clipboard" type="button">Copy</button>
                  <button class="clip-action-btn btn-del" title="Delete" type="button">×</button>
                </div>
              </div>
            `;

            // Native drag-out from RoboIsland to any external application
            card.addEventListener('dragstart', (e) => {
              e.preventDefault();
              if (item.filePath) {
                window.roboIsland.startClipboardDragOut?.(item.filePath);
              }
            });

            // Click to copy image back to clipboard
            card.addEventListener('click', async (e) => {
              const target = e.target as HTMLElement;
              if (target.closest('.btn-del')) {
                e.stopPropagation();
                await window.roboIsland.deleteClipboardItem?.(item.id);
                this.loadClipboardList();
                return;
              }
              await window.roboIsland.copyClipboardItem?.(item);
              this.mascot.sounds.playSuccess();
              card.classList.add('copied');
              setTimeout(() => card.classList.remove('copied'), 1000);
            });

          } else {
            // Text, URL, or Color Clip
            card.className = `clip-card clip-card-${item.type || 'text'}`;
            const text = item.text || '';
            const preview = text.length > 120 ? text.slice(0, 118) + '…' : text;

            let typeIcon = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
            let typeLabel = 'Text';
            let colorSwatch = '';

            if (item.type === 'color') {
              typeLabel = 'Color';
              colorSwatch = `<span class="clip-color-swatch" style="background:${text}"></span>`;
            } else if (item.type === 'url') {
              typeLabel = 'Link';
              typeIcon = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
            }

            card.innerHTML = `
              <div class="clip-header-mini">
                <span class="clip-tag ${item.type || 'text'}-tag">${typeIcon}${colorSwatch}${typeLabel}</span>
                <button class="clip-del-mini btn-del" title="Delete" type="button">×</button>
              </div>
              <div class="clip-text-body">${this.escapeHtml(preview)}</div>
            `;

            card.addEventListener('click', async (e) => {
              const target = e.target as HTMLElement;
              if (target.closest('.btn-del')) {
                e.stopPropagation();
                await window.roboIsland.deleteClipboardItem?.(item.id);
                this.loadClipboardList();
                return;
              }
              await window.roboIsland.copyClipboardItem?.(item);
              this.mascot.sounds.playSuccess();
              card.classList.add('copied');
              setTimeout(() => card.classList.remove('copied'), 1000);
            });
          }

          list.appendChild(card);
        });
      } else {
        if (empty) empty.style.display = 'block';
        if (badge) badge.textContent = '0 clips';
      }
    } catch {}
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

    // Position overlay matching the animated canvas pill
    const left = cx - this.currentWidth / 2;
    this.domOverlayEl.style.left = `${cx}px`;
    this.domOverlayEl.style.top = `${topY}px`;
    this.domOverlayEl.style.width = `${this.currentWidth}px`;
    this.domOverlayEl.style.height = `${this.currentHeight}px`;

    // Datetime with 12h/24h toggle support
    const dtEl = document.getElementById('status-datetime');
    if (dtEl) {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
      const is24h = this.config?.clockFormat === '24h';
      const timeStr = is24h
        ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        : now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      dtEl.textContent = `${dateStr} ${timeStr}`;
    }

    // Weather Widget in status bar
    const weatherTemp = document.getElementById('weather-temp');
    const weatherCond = document.getElementById('weather-cond');
    if (weatherTemp && this.weatherState) {
      weatherTemp.textContent = this.weatherState.temp || '--°C';
    }
    if (weatherCond && this.weatherState) {
      weatherCond.textContent = this.weatherState.condition || 'Clear';
    }

    // Wi-Fi & Bluetooth Popover Status
    this.updateNetworkDom();

    // Sync album tint variables on document root
    if (this.albumAccentColor) {
      document.documentElement.style.setProperty('--album-tint-hex', this.albumAccentColor);
      document.documentElement.style.setProperty('--album-tint-rgb', `${this.currentTintR}, ${this.currentTintG}, ${this.currentTintB}`);
    }

    // Header Music Visualizer Button (TwoCode: mx - 42 mini equalizer that opens Music player)
    const btnHeaderMusic = document.getElementById('btn-header-music');
    if (btnHeaderMusic) {
      const isMusicPlaying = Boolean(this.mediaState.playing && this.mediaState.active);
      if (isMusicPlaying && this.currentDomTab !== 'music') {
        btnHeaderMusic.classList.remove('hidden');
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

  private formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
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
