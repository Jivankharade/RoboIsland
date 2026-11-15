/**
 * RoboIsland 2.0 - Media UI Controller (`src/renderer/island/media-ui.ts`)
 * 
 * Features:
 * 1. Dedicated #panel-music overlay with frosted-glass container and dynamic backdrop blur.
 * 2. Real-time album artwork tinting and fallback vector iconography.
 * 3. Interactive scrub bar (3px resting, expanding to 6px on hover) with seek capability.
 * 4. Zero-emoji vector SVG playback controls (Prev, Play/Pause, Next, Volume).
 * 5. Spotify OAuth PKCE Connect/Disconnect toggle with live status indicator.
 * 6. Bi-directional synchronization with Home Dashboard #card-music.
 */

export interface MediaState {
  source: 'spotify' | 'smtc' | 'none';
  title: string;
  artist: string;
  album: string;
  albumArtUrl: string | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  supportsControls: boolean;
}

export class MediaUI {
  private panelEl: HTMLElement | null = null;
  private containerEl: HTMLElement | null = null;
  private backdropBlurEl: HTMLElement | null = null;
  private artImgEl: HTMLImageElement | null = null;
  private artFallbackEl: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private artistEl: HTMLElement | null = null;
  private albumEl: HTMLElement | null = null;
  private sourceBadgeEl: HTMLElement | null = null;
  private sourceLabelEl: HTMLElement | null = null;
  private spotifyBtnEl: HTMLElement | null = null;
  private spotifyBtnLabelEl: HTMLElement | null = null;
  private spotifyDevicesBtnEl: HTMLElement | null = null;
  private spotifyActiveDeviceNameEl: HTMLElement | null = null;
  private spotifyDevicePickerEl: HTMLElement | null = null;
  private spotifyDeviceListEl: HTMLElement | null = null;
  private spotifyDeviceNoteEl: HTMLElement | null = null;
  private btnDevicePickerClose: HTMLElement | null = null;
  private isDevicePickerOpen = false;
  private knownDevices: any[] = [];

  // Scrub Bar Elements
  private scrubBarEl: HTMLElement | null = null;
  private scrubFillEl: HTMLElement | null = null;
  private scrubHandleEl: HTMLElement | null = null;
  private timeCurrentEl: HTMLElement | null = null;
  private timeTotalEl: HTMLElement | null = null;

  // Controls Elements
  private btnPrev: HTMLElement | null = null;
  private btnPlay: HTMLElement | null = null;
  private btnNext: HTMLElement | null = null;
  private btnMute: HTMLElement | null = null;
  private volSlider: HTMLInputElement | null = null;

  // State
  private currentState: MediaState = {
    source: 'none',
    title: '',
    artist: '',
    album: '',
    albumArtUrl: null,
    isPlaying: false,
    positionMs: 0,
    durationMs: 0,
    supportsControls: false
  };

  private isDraggingScrub = false;
  private lastSampleTime = 0;
  private basePositionMs = 0;
  private interpolationTimer: any = null;
  private isMuted = false;
  private volumeLevel = 50;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.mount());
    } else {
      this.mount();
    }
  }

  public isInteracting(): boolean {
    return this.isDraggingScrub || (window as any).isMediaVolumeDragging === true;
  }

  public mount(): void {
    const parentContainer = document.getElementById('island-panel-container');
    if (!parentContainer) return;
    (window as any).roboIslandMediaUI = this;

    // 1. Inject or locate #panel-music
    let panel = document.getElementById('panel-music');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'panel-music';
      panel.className = 'island-panel';
      panel.innerHTML = this.renderPanelHtml();
      parentContainer.appendChild(panel);
    } else if (!panel.querySelector('.media-panel-container')) {
      panel.innerHTML = this.renderPanelHtml();
    }
    this.panelEl = panel;

    // 2. Cache DOM references
    this.containerEl = panel.querySelector('.media-panel-container');
    this.backdropBlurEl = document.getElementById('media-backdrop-blur');
    this.artImgEl = document.getElementById('media-art-img') as HTMLImageElement;
    this.artFallbackEl = document.getElementById('media-art-fallback');
    this.titleEl = document.getElementById('media-title');
    this.artistEl = document.getElementById('media-artist');
    this.albumEl = document.getElementById('media-album');
    this.sourceBadgeEl = document.getElementById('media-source-badge');
    this.sourceLabelEl = document.getElementById('media-source-label');
    this.spotifyBtnEl = document.getElementById('btn-spotify-toggle');
    this.spotifyBtnLabelEl = document.getElementById('spotify-btn-label');
    this.spotifyDevicesBtnEl = document.getElementById('btn-spotify-devices');
    this.spotifyActiveDeviceNameEl = document.getElementById('spotify-active-device-name');
    this.spotifyDevicePickerEl = document.getElementById('spotify-device-picker');
    this.spotifyDeviceListEl = document.getElementById('spotify-device-list');
    this.spotifyDeviceNoteEl = document.getElementById('spotify-device-note');
    this.btnDevicePickerClose = document.getElementById('btn-device-picker-close');

    this.scrubBarEl = document.getElementById('media-scrub-bar');
    this.scrubFillEl = document.getElementById('media-scrub-fill');
    this.scrubHandleEl = document.getElementById('media-scrub-handle');
    this.timeCurrentEl = document.getElementById('media-time-current');
    this.timeTotalEl = document.getElementById('media-time-total');

    this.btnPrev = document.getElementById('btn-media-prev');
    this.btnPlay = document.getElementById('btn-media-play');
    this.btnNext = document.getElementById('btn-media-next');
    this.btnMute = document.getElementById('btn-media-mute');
    this.volSlider = document.getElementById('media-vol-slider') as HTMLInputElement;

    // 3. Attach Listeners
    this.bindEvents();

    // 4. Initial sync with backend
    this.syncInitialState();

    // 5. Start smooth interpolation timer
    this.interpolationTimer = setInterval(() => this.tickInterpolation(), 250);
  }

  private renderPanelHtml(): string {
    return `
      <div class="media-panel-container">
        <!-- Dynamic Backdrop Blur Tint -->
        <div id="media-backdrop-blur" class="media-backdrop-blur"></div>

        <!-- Top Bar: Source Badge & Spotify Controls -->
        <div class="media-header">
          <div class="media-source-pill" id="media-source-badge">
            <span class="source-dot"></span>
            <span id="media-source-label">Windows SMTC</span>
          </div>
          <div class="media-header-actions">
            <button id="btn-spotify-devices" class="spotify-devices-btn hidden" title="Spotify Connect Devices">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <span id="spotify-active-device-name">Devices</span>
            </button>
            <button id="btn-spotify-toggle" class="spotify-auth-btn" title="Spotify Account">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 14.5c2.5-1 5.5-1 8 0"/>
                <path d="M7 11.5c3.2-1.2 6.8-1.2 10 0"/>
                <path d="M6 8.5c4-1.5 8-1.5 12 0"/>
              </svg>
              <span id="spotify-btn-label">Connect</span>
            </button>
          </div>
        </div>

        <!-- Spotify Connect Device Picker Popover -->
        <div id="spotify-device-picker" class="spotify-device-picker hidden">
          <div class="device-picker-header">
            <span>Play on a Device</span>
            <button id="btn-device-picker-close" class="picker-close-btn">&times;</button>
          </div>
          <div id="spotify-device-list" class="device-picker-list"></div>
          <div id="spotify-device-note" class="device-picker-note"></div>
        </div>

        <!-- Media Body: Artwork & Meta -->
        <div class="media-body">
          <div class="media-art-wrapper" id="media-art-box">
            <img id="media-art-img" class="media-art-img hidden" alt="Artwork" />
            <div id="media-art-fallback" class="media-art-fallback">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
              </svg>
            </div>
          </div>

          <div class="media-meta">
            <h2 id="media-title" class="media-title">No Media Active</h2>
            <p id="media-artist" class="media-artist">Play music on Spotify or Windows</p>
            <p id="media-album" class="media-album"></p>
          </div>
        </div>

        <!-- Spotify-Style Synced Lyrics Stream (Active vs Dark & Faint Floating Lines) -->
        <div class="media-lyrics-wrap" id="media-lyrics-wrap" style="display: none;">
          <div class="lyrics-line lyrics-prev" id="lyrics-line-prev"></div>
          <div class="lyrics-line lyrics-active" id="lyrics-line-active"></div>
          <div class="lyrics-line lyrics-next" id="lyrics-line-next"></div>
        </div>

        <!-- Interactive Expanding Scrub Bar (3px to 6px on hover) -->
        <div class="media-scrub-container">
          <div id="media-scrub-bar" class="media-scrub-bar" role="slider" aria-label="Playback scrub bar">
            <div id="media-scrub-track" class="media-scrub-track">
              <div id="media-scrub-fill" class="media-scrub-fill"></div>
              <div id="media-scrub-handle" class="media-scrub-handle"></div>
            </div>
          </div>
          <div class="media-time-row">
            <span id="media-time-current">0:00</span>
            <span id="media-time-total">0:00</span>
          </div>
        </div>

        <!-- Zero-Emoji Vector SVG Controls Row -->
        <div class="media-controls-row">
          <div class="media-controls-center">
            <button id="btn-media-prev" class="media-ctrl-btn" title="Previous Track">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="19 20 9 12 19 4 19 20"/>
                <line x1="5" y1="19" x2="5" y2="5"/>
              </svg>
            </button>

            <button id="btn-media-play" class="media-play-btn" title="Play / Pause">
              <svg id="media-play-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </button>

            <button id="btn-media-next" class="media-ctrl-btn" title="Next Track">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 4 15 12 5 20 5 4"/>
                <line x1="19" y1="5" x2="19" y2="19"/>
              </svg>
            </button>
          </div>

          <div class="media-volume-wrap">
            <button id="btn-media-mute" class="media-ctrl-btn" title="Mute">
              <svg id="media-vol-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
            </button>
            <input type="range" id="media-vol-slider" min="0" max="100" value="50" class="media-vol-slider" title="Volume">
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    const api = (window as any).roboIsland;

    // 1. Playback Controls
    this.btnPlay?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (api?.mediaPlayPause) {
        api.mediaPlayPause();
      } else {
        api?.mediaControl?.('playPause');
      }
    });

    this.btnPrev?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (api?.mediaPrev) {
        api.mediaPrev();
      } else {
        api?.mediaControl?.('previous');
      }
    });

    this.btnNext?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (api?.mediaNext) {
        api.mediaNext();
      } else {
        api?.mediaControl?.('next');
      }
    });

    // 2. Interactive Scrub Bar
    if (this.scrubBarEl) {
      const handleScrub = (clientX: number, isFinal: boolean) => {
        if (!this.scrubBarEl || !this.currentState.durationMs) return;
        const rect = this.scrubBarEl.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const targetMs = Math.round(ratio * this.currentState.durationMs);

        // Immediate visual feedback
        this.updateScrubDisplay(targetMs, this.currentState.durationMs);

        if (isFinal) {
          this.basePositionMs = targetMs;
          this.lastSampleTime = Date.now();
          api?.mediaSeek?.(targetMs);
        }
      };

      this.scrubBarEl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.isDraggingScrub = true;
        (window as any).isMediaScrubbing = true;
        (window as any).isMediaInteracting = true;
        this.scrubBarEl?.classList.add('active');
        this.scrubBarEl?.setAttribute('data-scrubbing', 'true');
        handleScrub(e.clientX, false);

        const onMouseMove = (moveEvent: MouseEvent) => {
          if (this.isDraggingScrub) {
            handleScrub(moveEvent.clientX, false);
          }
        };

        const onMouseUp = (upEvent: MouseEvent) => {
          if (this.isDraggingScrub) {
            this.isDraggingScrub = false;
            (window as any).isMediaScrubbing = false;
            (window as any).isMediaInteracting = false;
            this.scrubBarEl?.classList.remove('active');
            this.scrubBarEl?.removeAttribute('data-scrubbing');
            handleScrub(upEvent.clientX, true);
          }
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });

      this.scrubBarEl.addEventListener('click', (e) => {
        e.stopPropagation();
        handleScrub(e.clientX, true);
      });
    }

    // 3. Spotify Connect / Disconnect Toggle & Device Switcher
    this.spotifyBtnEl?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!api) return;

      const status = await api.getSpotifyStatus?.();
      if (status && status.connected) {
        await api.disconnectSpotify?.();
        this.updateSpotifyBtn(false);
      } else {
        if (this.spotifyBtnLabelEl) this.spotifyBtnLabelEl.textContent = 'Connecting...';
        const ok = await api.connectSpotifyPKCE?.();
        this.updateSpotifyBtn(Boolean(ok));
      }
    });

    this.spotifyDevicesBtnEl?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDevicePicker();
    });

    this.btnDevicePickerClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeDevicePicker();
    });

    this.spotifyDevicePickerEl?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    window.addEventListener('click', () => {
      if (this.isDevicePickerOpen) {
        this.closeDevicePicker();
      }
    });

    // 4. Volume and Mute Controls
    this.volSlider?.addEventListener('input', (e) => {
      e.stopPropagation();
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      this.volumeLevel = val;
      (window as any).isMediaVolumeDragging = true;
      (window as any).isMediaInteracting = true;
      (window as any).__twocodeVolumeQuietUntil = performance.now() + 1500;
      api?.setVolume?.(val);
    });

    this.volSlider?.addEventListener('change', (e) => {
      e.stopPropagation();
      setTimeout(() => {
        (window as any).isMediaVolumeDragging = false;
        (window as any).isMediaInteracting = false;
      }, 500);
    });

    this.volSlider?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    this.volSlider?.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      (window as any).isMediaVolumeDragging = true;
      (window as any).isMediaInteracting = true;
      (window as any).__twocodeVolumeQuietUntil = performance.now() + 1500;
      const onMouseUp = () => {
        setTimeout(() => {
          (window as any).isMediaVolumeDragging = false;
          (window as any).isMediaInteracting = false;
        }, 500);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mouseup', onMouseUp);
    });

    this.btnMute?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isMuted = !this.isMuted;
      (window as any).__twocodeVolumeQuietUntil = performance.now() + 1500;
      api?.setMute?.(this.isMuted);
      this.updateVolumeUI();
    });

    // 5. Connect to Bottom Navigation (Tab "music")
    const navMusicBtn = document.querySelector('.nav-item[data-tab="music"]');
    if (navMusicBtn) {
      navMusicBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.activateMediaPanel();
      });
    }

    // 6. Connect to Dashboard Card #card-music
    const cardMusic = document.getElementById('card-music');
    if (cardMusic) {
      cardMusic.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.activateMediaPanel();
      });
    }

    // 7. Subscribe to Live State Changes from Preload
    if (api?.onMediaStateChanged) {
      api.onMediaStateChanged((state: any) => {
        this.updateState(state);
      });
    }

    if (api?.onVolumeChanged) {
      api.onVolumeChanged((vol: any) => {
        if (vol) {
          this.volumeLevel = vol.level || 0;
          this.isMuted = Boolean(vol.muted);
          this.updateVolumeUI();
        }
      });
    }
  }

  public activateMediaPanel(): void {
    const overlay = document.getElementById('expanded-island-overlay');
    if (!overlay) return;

    // Remove active class from all panels
    const panels = overlay.querySelectorAll('.island-panel');
    panels.forEach(p => p.classList.remove('active'));

    // Activate #panel-music
    if (this.panelEl) {
      this.panelEl.classList.add('active');
    }

    // Update bottom nav
    const navItems = overlay.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      if ((item as HTMLElement).dataset.tab === 'music') {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update status bar title
    const titleEl = document.getElementById('status-title');
    if (titleEl) {
      titleEl.textContent = 'Music';
    }
  }

  private async syncInitialState(): Promise<void> {
    const api = (window as any).roboIsland;
    if (!api) return;

    try {
      const state = await api.getMediaState?.();
      if (state) this.updateState(state);

      const spotifyStatus = await api.getSpotifyStatus?.();
      if (spotifyStatus) {
        this.updateSpotifyBtn(Boolean(spotifyStatus.connected));
      }

      const vol = await api.getVolume?.();
      if (vol) {
        this.volumeLevel = vol.level || 0;
        this.isMuted = Boolean(vol.muted);
        this.updateVolumeUI();
      }
    } catch {}
  }

  public updateState(state: any): void {
    if (!state) return;

    const isPlaying = Boolean(state.isPlaying != null ? state.isPlaying : state.playing);
    const cover = state.albumArtUrl || state.coverUrl || null;
    const source: 'spotify' | 'smtc' | 'none' = state.source || (state.active ? 'smtc' : 'none');

    this.currentState = {
      source,
      title: state.title || '',
      artist: state.artist || '',
      album: state.album || '',
      albumArtUrl: cover,
      isPlaying,
      positionMs: Number(state.positionMs) || 0,
      durationMs: Number(state.durationMs) || 0,
      supportsControls: Boolean(state.supportsControls)
    };

    this.basePositionMs = this.currentState.positionMs;
    this.lastSampleTime = Date.now();

    this.renderState();
  }

  private renderState(): void {
    // 1. Title, Artist, Album
    if (this.titleEl) {
      this.titleEl.textContent = this.currentState.title || 'No Media Active';
    }
    if (this.artistEl) {
      this.artistEl.textContent = this.currentState.artist || 'Play music on Spotify or Windows';
    }
    if (this.albumEl) {
      this.albumEl.textContent = this.currentState.album || '';
    }

    // 2. Artwork & Dynamic Backdrop Blur
    if (this.currentState.albumArtUrl) {
      if (this.artImgEl) {
        this.artImgEl.src = this.currentState.albumArtUrl;
        this.artImgEl.classList.remove('hidden');
      }
      if (this.artFallbackEl) {
        this.artFallbackEl.style.display = 'none';
      }
      if (this.backdropBlurEl) {
        this.backdropBlurEl.style.backgroundImage = `url("${this.currentState.albumArtUrl}")`;
        this.backdropBlurEl.style.opacity = '0.35';
      }
    } else {
      if (this.artImgEl) {
        this.artImgEl.classList.add('hidden');
      }
      if (this.artFallbackEl) {
        this.artFallbackEl.style.display = 'flex';
      }
      if (this.backdropBlurEl) {
        this.backdropBlurEl.style.backgroundImage = 'none';
        this.backdropBlurEl.style.opacity = '0';
      }
    }

    // 3. Source Pill
    if (this.sourceBadgeEl && this.sourceLabelEl) {
      if (this.currentState.source === 'spotify') {
        this.sourceBadgeEl.className = 'media-source-pill spotify';
        this.sourceLabelEl.textContent = 'Spotify';
      } else if (this.currentState.source === 'smtc') {
        this.sourceBadgeEl.className = 'media-source-pill';
        this.sourceLabelEl.textContent = 'Windows SMTC';
      } else {
        this.sourceBadgeEl.className = 'media-source-pill';
        this.sourceLabelEl.textContent = 'Standby';
      }
    }

    // 4. Play / Pause Button SVG
    if (this.btnPlay) {
      this.btnPlay.innerHTML = this.currentState.isPlaying
        ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
             <rect x="6" y="4" width="4" height="16" rx="1"/>
             <rect x="14" y="4" width="4" height="16" rx="1"/>
           </svg>`
        : `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
             <polygon points="5 3 19 12 5 21 5 3"/>
           </svg>`;
    }

    // 5. Scrub Bar Display
    if (!this.isDraggingScrub) {
      this.updateScrubDisplay(this.currentState.positionMs, this.currentState.durationMs);
    }

    // 6. Home Dashboard Card Sync (#card-music)
    const cardTitle = document.getElementById('card-music-title');
    const cardSub = document.getElementById('card-music-sub');
    if (cardTitle && cardSub) {
      if (this.currentState.title) {
        cardTitle.textContent = this.currentState.title.length > 16
          ? this.currentState.title.slice(0, 15) + '…'
          : this.currentState.title;
        cardSub.textContent = this.currentState.artist || (this.currentState.isPlaying ? 'Playing' : 'Paused');
      } else {
        cardTitle.textContent = 'Quiet';
        cardSub.textContent = 'Nothing playing';
      }
    }
  }

  private updateScrubDisplay(currentMs: number, totalMs: number): void {
    if (this.timeCurrentEl) {
      this.timeCurrentEl.textContent = this.formatTime(currentMs);
    }
    if (this.timeTotalEl) {
      this.timeTotalEl.textContent = this.formatTime(totalMs);
    }

    const pct = totalMs > 0 ? Math.min(100, Math.max(0, (currentMs / totalMs) * 100)) : 0;
    if (this.scrubFillEl) {
      this.scrubFillEl.style.width = `${pct}%`;
    }
    if (this.scrubHandleEl) {
      this.scrubHandleEl.style.left = `${pct}%`;
    }
  }

  private tickInterpolation(): void {
    if (!this.currentState.isPlaying || this.isDraggingScrub || !this.currentState.durationMs) {
      return;
    }

    const elapsed = Date.now() - this.lastSampleTime;
    let interpolatedMs = this.basePositionMs + elapsed;
    if (this.currentState.durationMs > 0) {
      interpolatedMs = Math.min(interpolatedMs, this.currentState.durationMs);
    }

    this.updateScrubDisplay(interpolatedMs, this.currentState.durationMs);
  }

  private updateSpotifyBtn(connected: boolean): void {
    if (!this.spotifyBtnEl || !this.spotifyBtnLabelEl) return;
    if (connected) {
      this.spotifyBtnEl.className = 'spotify-auth-btn connected';
      this.spotifyBtnLabelEl.textContent = 'Disconnect';
      this.spotifyDevicesBtnEl?.classList.remove('hidden');
      this.refreshSpotifyDevices();
    } else {
      this.spotifyBtnEl.className = 'spotify-auth-btn';
      this.spotifyBtnLabelEl.textContent = 'Connect';
      this.spotifyDevicesBtnEl?.classList.add('hidden');
      this.closeDevicePicker();
    }
  }

  public async toggleDevicePicker(): Promise<void> {
    if (this.isDevicePickerOpen) {
      this.closeDevicePicker();
    } else {
      await this.openDevicePicker();
    }
  }

  public closeDevicePicker(): void {
    this.isDevicePickerOpen = false;
    this.spotifyDevicePickerEl?.classList.add('hidden');
  }

  public async openDevicePicker(): Promise<void> {
    this.isDevicePickerOpen = true;
    this.spotifyDevicePickerEl?.classList.remove('hidden');
    await this.refreshSpotifyDevices();
  }

  public async refreshSpotifyDevices(): Promise<void> {
    const api = (window as any).roboIsland;
    if (!api?.getSpotifyDevices) return;

    if (this.spotifyDeviceNoteEl) {
      this.spotifyDeviceNoteEl.textContent = 'Scanning for devices...';
    }

    try {
      const res = await api.getSpotifyDevices();
      const devices = (res && Array.isArray(res.devices)) ? res.devices : [];
      this.knownDevices = devices;
      this.renderDeviceList(devices);

      const activeDev = devices.find((d: any) => d.is_active);
      if (activeDev && this.spotifyActiveDeviceNameEl) {
        this.spotifyActiveDeviceNameEl.textContent = activeDev.name.length > 12 ? activeDev.name.slice(0, 11) + '…' : activeDev.name;
      }
    } catch {
      if (this.spotifyDeviceNoteEl) {
        this.spotifyDeviceNoteEl.textContent = 'Could not fetch devices.';
      }
    }
  }

  private renderDeviceList(devices: any[]): void {
    if (!this.spotifyDeviceListEl) return;
    this.spotifyDeviceListEl.innerHTML = '';

    if (!devices || devices.length === 0) {
      if (this.spotifyDeviceNoteEl) {
        this.spotifyDeviceNoteEl.textContent = 'Open Spotify on another phone, speaker or PC to see it here.';
      }
      return;
    }

    if (this.spotifyDeviceNoteEl) {
      this.spotifyDeviceNoteEl.textContent = '';
    }

    devices.forEach((dev: any) => {
      const item = document.createElement('div');
      item.className = `device-picker-item ${dev.is_active ? 'active' : ''}`;
      
      let iconSvg = '';
      if (dev.type === 'Smartphone') {
        iconSvg = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="3"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`;
      } else if (dev.type === 'Speaker' || dev.type === 'CastAudio') {
        iconSvg = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="14" r="4"/><line x1="12" y1="6" x2="12.01" y2="6"/></svg>`;
      } else if (dev.type === 'TV') {
        iconSvg = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>`;
      } else {
        iconSvg = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`;
      }

      item.innerHTML = `
        <span class="device-picker-icon">${iconSvg}</span>
        <span class="device-picker-name" title="${dev.name}">${dev.name}</span>
        ${dev.is_active ? `<span class="device-picker-active-check"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>` : ''}
      `;

      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.transferToDevice(dev.id, dev.name);
      });

      this.spotifyDeviceListEl?.appendChild(item);
    });
  }

  public async transferToDevice(deviceId: string, deviceName: string): Promise<void> {
    const api = (window as any).roboIsland;
    if (!api?.transferSpotifyPlayback) return;

    if (this.spotifyDeviceNoteEl) {
      this.spotifyDeviceNoteEl.textContent = `Switching to ${deviceName}...`;
    }

    try {
      const res = await api.transferSpotifyPlayback(deviceId);
      if (res && res.ok) {
        if (this.spotifyActiveDeviceNameEl) {
          this.spotifyActiveDeviceNameEl.textContent = deviceName.length > 12 ? deviceName.slice(0, 11) + '…' : deviceName;
        }
        this.closeDevicePicker();
        try {
          const synth = (window as any).AudioSynth?.getInstance?.();
          synth?.playMelody?.('pop');
        } catch {}
        setTimeout(() => this.refreshSpotifyDevices(), 1000);
      } else {
        if (this.spotifyDeviceNoteEl) {
          this.spotifyDeviceNoteEl.textContent = res?.error || 'Transfer failed.';
        }
      }
    } catch {
      if (this.spotifyDeviceNoteEl) {
        this.spotifyDeviceNoteEl.textContent = 'Transfer error.';
      }
    }
  }

  private updateVolumeUI(): void {
    if (this.volSlider) {
      this.volSlider.value = String(this.volumeLevel);
    }
    if (this.btnMute) {
      this.btnMute.innerHTML = this.isMuted
        ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
             <line x1="23" y1="9" x2="17" y2="15"/>
             <line x1="17" y1="9" x2="23" y2="15"/>
           </svg>`
        : `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
             <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
           </svg>`;
    }
  }

  private formatTime(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  public dispose(): void {
    if (this.interpolationTimer) {
      clearInterval(this.interpolationTimer);
      this.interpolationTimer = null;
    }
  }
}

// Auto-initialize when loaded
export const mediaUI = new MediaUI();
