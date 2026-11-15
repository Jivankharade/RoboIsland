import { AudioSynth, SoundMelody } from './audio-synth';

export type MascotMood =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'sleepy'
  | 'focused'
  | 'curious'
  | 'excited'
  | 'thinking'
  | 'surprised'
  | 'relaxed'
  // Legacy & expressive aliases for backward-compatibility
  | 'idle'
  | 'wink'
  | 'blink'
  | 'heart'
  | 'dizzy'
  | 'alert'
  | 'dance'
  | 'poked';

export interface SkinPalette {
  name: string;
  headBg: string;
  headBorder: string;
  eyeColor: string;
  eyeGlow: string;
  accent: string;
}

export const SKINS: Record<string, SkinPalette> = {
  classic: {
    name: 'Classic Titanium',
    headBg: '#181b22',
    headBorder: 'rgba(255, 255, 255, 0.16)',
    eyeColor: '#00e5ff',
    eyeGlow: 'rgba(0, 229, 255, 0.45)',
    accent: '#00d2ff'
  },
  cyberpunk: {
    name: 'Cyberpunk Neon',
    headBg: '#130924',
    headBorder: '#ff007f',
    eyeColor: '#ff007f',
    eyeGlow: 'rgba(255, 0, 127, 0.6)',
    accent: '#00ffff'
  },
  matrix: {
    name: 'Matrix Emerald',
    headBg: '#05160c',
    headBorder: 'rgba(0, 255, 100, 0.3)',
    eyeColor: '#00ff66',
    eyeGlow: 'rgba(0, 255, 102, 0.55)',
    accent: '#00ff66'
  },
  solar: {
    name: 'Solar Amber',
    headBg: '#211508',
    headBorder: 'rgba(255, 180, 0, 0.35)',
    eyeColor: '#ffaa00',
    eyeGlow: 'rgba(255, 170, 0, 0.55)',
    accent: '#ffdd00'
  },
  amethyst: {
    name: 'Amethyst Violet',
    headBg: '#1b0d2a',
    headBorder: 'rgba(190, 80, 255, 0.35)',
    eyeColor: '#cf53ff',
    eyeGlow: 'rgba(207, 83, 255, 0.55)',
    accent: '#cf53ff'
  }
};

// Swatch Palettes (Screenshots 05 & 06)
export const BODY_COLORS: Record<string, string> = {
  cloud: '#ffffff',
  mint: '#63e6e2',
  sky: '#5ac8fa',
  rose: '#ff2d55',
  classic: '#2c2d35',
  night: '#121318',
  blue: '#0a84ff',
  purple: '#af52de',
  pink: '#ff375f',
  gold: '#f5c518'
};

export const EYE_COLORS: Record<string, string> = {
  mint: '#63e6e2',
  white: '#ffffff',
  blue: '#00d2ff',
  pink: '#ff2d55',
  purple: '#af52de',
  yellow: '#ffcc00'
};

export interface SpeechBubbleState {
  text: string;
  timer: number;
  duration: number;
  alpha: number;
  active: boolean;
}

export interface SleepyParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
}

export class SoundSynthesizer {
  public enabled = true;
  private synth = AudioSynth.getInstance();

  public playChirp(): void {
    if (!this.enabled) return;
    this.synth.play('pop');
  }

  public playSuccess(): void {
    if (!this.enabled) return;
    this.synth.play('done');
  }

  public playAlert(): void {
    if (!this.enabled) return;
    this.synth.play('warn');
  }

  public playMelody(kind: SoundMelody): void {
    if (!this.enabled) return;
    this.synth.play(kind);
  }

  public celebrate(kind: SoundMelody = 'party', bits = 80): void {
    if (!this.enabled) return;
    this.synth.play(kind);
    this.synth.launchConfetti(bits);
  }
}

export class ParticleSystem {
  private particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    alpha: number;
    rotation: number;
    vRot: number;
    life: number;
  }> = [];

  public burst(x: number, y: number, count = 28): void {
    const colors = ['#00d2ff', '#ff007f', '#00ff66', '#ffaa00', '#cf53ff', '#ffffff'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2.5 + Math.random() * 3.5,
        alpha: 1.0,
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.2,
        life: 1.0
      });
    }
  }

  public update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12; // gravity
      p.rotation += p.vRot;
      p.life -= dt * 1.5;
      p.alpha = Math.max(0, p.life);

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const p of this.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    ctx.restore();
  }
}

export class RoboMascot {
  public mood: MascotMood = 'neutral';
  public skinKey = 'classic';
  public hatKey = 'none';
  public outfitKey = 'none';
  public bodyColorKey = 'cloud';
  public eyeColorKey = 'mint';

  // Eye gaze tracking
  public targetLookX = 0;
  public targetLookY = 0;
  public lookX = 0;
  public lookY = 0;

  // Saccadic micro-movements
  public saccadeX = 0;
  public saccadeY = 0;
  private targetSaccadeX = 0;
  private targetSaccadeY = 0;
  private saccadeTimer = 1.8;

  // Blinking & TwoCode idleLife random blinking/winking
  public blinkProgress = 0;
  public isBlinking = false;
  private nextBlinkTimer = 2.5;
  private nextIdleLifeBlink = performance.now() + 2500;
  private currentIdleMood: MascotMood | null = null;

  // Jump, Bounce & Jelly Wobble Physics
  public heightFactor = 1.0;
  public widthFactor = 1.0;
  public wobbleVelocity = 0;
  public jumpY = 0;
  public jumpVelocity = 0;
  public isJumping = false;
  public tiltAngle = 0;

  // Compact Idle & Motion Stability
  public isCompactIdle = false;

  // Inactivity & Sleep State Transition (R4)
  public inactivityTimer = 0;
  public sleepProgress = 0;
  public isSleeping = false;
  public savedActiveMood: MascotMood = 'neutral';
  public sleepBreathPhase = 0;

  // Idle float bobbing
  public idleFloatPhase = 0;
  public idleFloatY = 0;

  // Speech Bubble System
  public speechBubble: SpeechBubbleState = {
    text: '',
    timer: 0,
    duration: 0,
    alpha: 0,
    active: false
  };

  // Sleeping Z Particles
  public sleepyZzzs: SleepyParticle[] = [];
  private zzzTimer = 0.5;

  // Poking / Dizziness tracking
  private pokeCount = 0;
  private pokeTimer = 0;
  private dizzyDuration = 0;
  private spiralAngle = 0;

  // Dancing to music
  public isDancing = false;
  private dancePhase = 0;

  public sounds = new SoundSynthesizer();
  public particles = new ParticleSystem();

  public setSkin(skin: string): void {
    if (skin) this.skinKey = skin;
  }

  public setHat(hat: string): void {
    if (hat) this.hatKey = hat;
  }

  public setOutfit(outfit: string): void {
    if (outfit) {
      this.outfitKey = outfit;
      if (outfit === 'sunglasses') this.hatKey = 'sunglasses';
      else if (outfit === 'crown') this.hatKey = 'crown';
      else if (outfit === 'party') this.hatKey = 'party';
      else if (outfit === 'none') this.hatKey = 'none';
    }
  }

  public setBodyColor(bodyColor: string): void {
    if (bodyColor) this.bodyColorKey = bodyColor;
  }

  private moodResetTimer: any = null;

  public setEyeColor(eyeColor: string): void {
    if (eyeColor) this.eyeColorKey = eyeColor;
  }

  public setMood(mood: MascotMood, autoResetMs = 0): void {
    if (this.moodResetTimer) {
      clearTimeout(this.moodResetTimer);
      this.moodResetTimer = null;
    }
    this.mood = mood;
    if (autoResetMs > 0 && mood !== 'neutral') {
      this.moodResetTimer = setTimeout(() => {
        this.mood = 'neutral';
        this.moodResetTimer = null;
      }, autoResetMs);
    }
  }

  public getMood(): MascotMood {
    return this.mood;
  }

  /**
   * Reset the 60-second inactivity timer on user interaction.
   * If the mascot is currently sleeping or transitioning, triggers snappy elastic wakeup.
   */
  public resetInactivity(): void {
    this.inactivityTimer = 0;
    if (this.mood === 'focused' && this.isCompactIdle) {
      this.mood = 'neutral';
    }
    if (this.isSleeping || this.sleepProgress > 0) {
      this.triggerWakeup();
    }
  }

  /**
   * Trigger transition to sleepy state after 60s inactivity.
   */
  public triggerSleep(): void {
    if (!this.isSleeping) {
      this.isSleeping = true;
      this.savedActiveMood = this.mood;
    }
  }

  /**
   * Snappy 0.35s elastic spring wakeup upon mouse interaction,
   * playing soft chirp and cleanly restoring the prior active mood.
   */
  public triggerWakeup(): void {
    if (this.isSleeping || this.sleepProgress > 0) {
      this.isSleeping = false;
      this.inactivityTimer = 0;
      this.sounds.playChirp();
      if (this.savedActiveMood) {
        this.mood = this.savedActiveMood;
      }
    }
  }

  /**
   * Jump animation with spring impulse and jelly squash on landing.
   */
  public jump(strength = 140): void {
    this.jumpVelocity = -strength;
    this.isJumping = true;
    this.wobbleVelocity = 14;
    this.heightFactor = 1.28;
    this.sounds.playChirp();
  }

  /**
   * Bounce animation: rhythmic elastic spring hop.
   */
  public bounce(strength = 90): void {
    this.jumpVelocity = -strength;
    this.isJumping = true;
    this.wobbleVelocity = 10;
    this.sounds.playChirp();
  }

  /**
   * Spring impulse: elastic jelly wobble deformation.
   */
  public spring(impulse = 0.35): void {
    this.heightFactor = 1.0 + impulse;
    this.wobbleVelocity = impulse * 22;
  }

  /**
   * Kick animation: lateral tilt and spring wobble.
   */
  public kick(direction = 1): void {
    this.tiltAngle = direction * 0.22;
    this.spring(0.25);
  }

  /**
   * Speech bubble trigger for notification and contextual responses.
   */
  public speak(text: string, duration = 4.0): void {
    this.speechBubble = {
      text,
      timer: duration,
      duration,
      alpha: 0,
      active: true
    };
  }

  public hideSpeech(): void {
    this.speechBubble.timer = 0;
  }

  /**
   * Resolve active skin palette merged with custom wardrobe body/eye swatches.
   */
  public getActivePalette(): SkinPalette {
    const base = SKINS[this.skinKey] || SKINS.classic;
    const bodyHex = (this.bodyColorKey && BODY_COLORS[this.bodyColorKey]) ||
                    (this.bodyColorKey && this.bodyColorKey.startsWith('#') ? this.bodyColorKey : base.headBg);
    const eyeHex = (this.eyeColorKey && EYE_COLORS[this.eyeColorKey]) ||
                   (this.eyeColorKey && this.eyeColorKey.startsWith('#') ? this.eyeColorKey : base.eyeColor);
    return {
      ...base,
      headBg: bodyHex,
      eyeColor: eyeHex,
      eyeGlow: eyeHex
    };
  }

  public update(dt: number, pointerX: number, pointerY: number, headCenterX: number, headCenterY: number): void {
    // 1. Pointer gaze tracking (interpolate toward cursor)
    const dx = pointerX - headCenterX;
    const dy = pointerY - headCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxLook = 1.0;

    const isPointerOffscreen = pointerX < -500 || pointerY < -500;
    if (!isPointerOffscreen && dist > 5) {
      this.targetLookX = Math.max(-maxLook, Math.min(maxLook, dx / 150));
      this.targetLookY = Math.max(-maxLook, Math.min(maxLook, dy / 120));
    } else {
      this.targetLookX = 0;
      this.targetLookY = 0;
    }

    // Bias target look based on mood
    let moodLookBiasX = 0;
    let moodLookBiasY = 0;
    if (this.mood === 'thinking') {
      moodLookBiasX = 0.85;
      moodLookBiasY = -0.9;
    } else if (this.mood === 'curious') {
      moodLookBiasX = 0.45;
      moodLookBiasY = -0.35;
    }

    // Saccadic micro-movements (horizontal micro-saccades only, 0 vertical jitter during idle)
    this.saccadeTimer -= dt;
    if (this.saccadeTimer <= 0) {
      this.targetSaccadeX = (Math.random() - 0.5) * 0.28;
      this.targetSaccadeY = 0; // Vertical saccade eliminated
      this.saccadeTimer = 1.4 + Math.random() * 2.6;
    }
    this.saccadeX += (this.targetSaccadeX - this.saccadeX) * 0.2;
    this.saccadeY = 0; // Strict 0 vertical saccade jitter during normal idle

    // Subtle, smooth gaze tracking with exponential damping returning smoothly to center
    const gazeDamping = 1 - Math.exp(-8 * dt);
    this.lookX += (this.targetLookX + moodLookBiasX + this.saccadeX - this.lookX) * gazeDamping;
    this.lookY += (this.targetLookY + moodLookBiasY + this.saccadeY - this.lookY) * gazeDamping;

    // 2. Jump and Spring Physics (gravity and landing squash)
    if (this.isJumping) {
      this.jumpY += this.jumpVelocity * dt;
      this.jumpVelocity += 460 * dt; // gravity
      if (this.jumpY >= 0) {
        this.jumpY = 0;
        this.isJumping = false;
        this.jumpVelocity = 0;
        // Landing squash: compress vertically, expand horizontally
        this.heightFactor = 0.74;
        this.wobbleVelocity = -14;
        this.sounds.playChirp();
      }
    }

    // 3. Jelly wobble oscillation (damped spring harmonic oscillator)
    const springK = 190; // stiffness
    const springDamping = 15; // damping
    const springForce = -springK * (this.heightFactor - 1.0) - springDamping * this.wobbleVelocity;
    this.wobbleVelocity += springForce * dt;
    this.heightFactor += this.wobbleVelocity * dt;

    // Volume/area conservation: width factor inversely proportional to square root of height factor
    this.widthFactor = 1.0 / Math.max(0.3, Math.sqrt(Math.max(0.1, this.heightFactor)));

    // Tilt recovery
    this.tiltAngle += (0 - this.tiltAngle) * 0.14;

    // 4. Idle float bobbing (stopped during compact idle to eliminate vertical jitter)
    this.idleFloatPhase += dt * 2.2;
    if (this.isCompactIdle) {
      this.idleFloatY = 0;
    } else {
      this.idleFloatY = Math.sin(this.idleFloatPhase) * 2.2;
    }

    // 5. Inactivity & Sleep State Transition (R4)
    if (this.isSleeping) {
      if (this.sleepProgress < 1.0) {
        this.sleepProgress = Math.min(1.0, this.sleepProgress + dt / 1.2); // 1.2s transition
      }
      this.sleepBreathPhase += dt * (Math.PI * 2 / 4.0); // 4.0s respiratory cycle
    } else {
      if (this.sleepProgress > 0) {
        this.sleepProgress = Math.max(0.0, this.sleepProgress - dt / 0.35); // 0.35s elastic wakeup
      }
      this.inactivityTimer += dt;
      if (this.inactivityTimer >= 60.0) {
        this.triggerSleep();
      }
    }

    // 6. Blinking logic (150ms duration every 3.0-5.5s)
    if (this.dizzyDuration > 0) {
      this.dizzyDuration -= dt;
      this.spiralAngle += dt * 9;
      this.mood = 'dizzy';
    } else {
      if (this.mood === 'dizzy') this.mood = 'neutral';

      this.nextBlinkTimer -= dt;
      if (this.nextBlinkTimer <= 0 && !this.isBlinking && this.mood !== 'sleepy' && !this.isSleeping) {
        this.isBlinking = true;
        this.blinkProgress = 0;
      }

      if (this.isBlinking) {
        this.blinkProgress += dt / 0.15; // 150ms blink duration
        if (this.blinkProgress >= 1.0) {
          this.isBlinking = false;
          this.blinkProgress = 0;
          this.nextBlinkTimer = 3.0 + Math.random() * 2.5; // 3.0 - 5.5s
        }
      }
    }

    // 6. Speech Bubble update
    if (this.speechBubble.active) {
      this.speechBubble.timer -= dt;
      if (this.speechBubble.timer <= 0) {
        this.speechBubble.alpha = Math.max(0, this.speechBubble.alpha - dt * 3.5);
        if (this.speechBubble.alpha <= 0) {
          this.speechBubble.active = false;
        }
      } else {
        this.speechBubble.alpha = Math.min(1.0, this.speechBubble.alpha + dt * 5.0);
      }
    }

    // 7. Sleepy Z particles
    if (this.mood === 'sleepy') {
      this.zzzTimer -= dt;
      if (this.zzzTimer <= 0) {
        this.zzzTimer = 1.1;
        this.sleepyZzzs.push({
          x: 6 + (Math.random() - 0.5) * 4,
          y: -4,
          vx: 4 + Math.random() * 4,
          vy: -10 - Math.random() * 6,
          size: 5 + Math.random() * 3.5,
          alpha: 0.9,
          life: 1.8
        });
      }
    }
    for (let i = this.sleepyZzzs.length - 1; i >= 0; i--) {
      const z = this.sleepyZzzs[i];
      z.x += z.vx * dt;
      z.y += z.vy * dt;
      z.life -= dt;
      z.alpha = Math.max(0, z.life / 1.8);
      if (z.life <= 0) {
        this.sleepyZzzs.splice(i, 1);
      }
    }

    // 8. Poke reset timer
    if (this.pokeTimer > 0) {
      this.pokeTimer -= dt;
      if (this.pokeTimer <= 0) this.pokeCount = 0;
    }

    // 9. Dancing oscillation
    if (this.isDancing) {
      this.dancePhase += dt * 7.5;
    } else {
      this.dancePhase = 0;
    }

    // 10. Update particles
    this.particles.update(dt);
  }

  public poke(x: number, y: number): void {
    this.resetInactivity();
    this.pokeCount++;
    this.pokeTimer = 2.0;

    // 1. Elastic squish & wobble spring
    this.heightFactor = 0.62;
    this.wobbleVelocity = -22;
    this.tiltAngle = (Math.random() - 0.5) * 0.35;
    this.jump(130);

    // 2. Set circle eyes mood for 2.2 seconds
    this.setMood('poked', 2200);

    // 3. Sound effect & particles
    this.sounds.playChirp();
    this.particles.burst(x, y, 14);

    // 4. Playful vocal reaction
    const pokePhrases = ['Eep!', 'Ouch!', 'Hey!', 'Hehe!', 'Whoa!'];
    const phrase = pokePhrases[Math.floor(Math.random() * pokePhrases.length)];
    this.speak(phrase, 1.2);

    // 5. Dizzy spiral reaction if poked 5 times in rapid succession
    if (this.pokeCount >= 5) {
      this.dizzyDuration = 3.5;
      this.pokeCount = 0;
      this.sounds.playAlert();
      this.speak('Whoa, dizzy!', 2.0);
    }
  }

  /**
   * TwoCode random life: blinking and the odd wink
   * Direct parity with TwoCode twocode-fun.js lines 537-546
   */
  public idleLife(t: number, mood: MascotMood): MascotMood {
    if (mood !== 'neutral') return mood;
    if (t > this.nextIdleLifeBlink) {
      if (t > this.nextIdleLifeBlink + 140) {
        this.nextIdleLifeBlink = t + 2500 + Math.random() * 3500;
        this.currentIdleMood = null;
      } else {
        if (!this.currentIdleMood) {
          this.currentIdleMood = Math.random() < 0.004 ? 'wink' : 'blink';
        }
        return this.currentIdleMood;
      }
    }
    return mood;
  }

  /**
   * TwoCode-style resting island eyes: sleek glowing capsule eyes,
   * tracking cursor and blinking naturally, supporting all 9 moods and spring physics.
   * Derived from TwoCode mascot.html drawIslandEyes & drawEye under ISC license.
   */
  public drawFloatingEyes(ctx: CanvasRenderingContext2D, cx: number, cy: number, size = 1.0): void {
    const skin = this.getActivePalette();
    const isCustomEye = Boolean(this.eyeColorKey && this.eyeColorKey !== 'mint' && this.eyeColorKey !== 'classic');
    let eyeCoreColor = isCustomEye ? skin.eyeColor : '#ffffff';
    let eyeGlowColor = isCustomEye ? skin.eyeGlow : 'rgba(0, 229, 255, 0.40)';

    const effectiveMood = this.idleLife(performance.now(), this.mood);

    // Dynamic green smile on download complete / happy, and vibrant red frown on cancel / error
    if (effectiveMood === 'happy') {
      eyeCoreColor = '#22e05a';
      eyeGlowColor = 'rgba(34, 224, 90, 0.60)';
    } else if (effectiveMood === 'sad') {
      eyeCoreColor = '#ff3b3b';
      eyeGlowColor = 'rgba(255, 59, 59, 0.60)';
    }

    // Cursor tracking gaze — damped to stay subtle in the pill (clamped to ±1.8px X, ±1.0px Y)
    const lookX = Math.max(-1, Math.min(1, this.lookX)) * 1.8 * size;
    const lookY = Math.max(-1, Math.min(1, this.lookY)) * 1.0 * size;

    // Dancing bobbing or idle floating (strictly 0 during compact idle)
    const bob = (this.isDancing ? Math.sin(this.dancePhase) * 1.5 * size : (this.isCompactIdle ? 0 : this.idleFloatY * size)) + this.jumpY;

    // Blink squish: animate vertical scale of eye, 0=open, 1=fully closed
    const blinkYScale = this.isBlinking
      ? Math.max(0.05, 1.0 - Math.sin(this.blinkProgress * Math.PI))
      : 1.0;

    // Inactivity sleep state easing (smoothstep cubic ease-in-out: 3t^2 - 2t^3)
    const t = Math.max(0, Math.min(1, this.sleepProgress));
    const smoothSleep = t * t * (3 - 2 * t);
    const effectiveSleep = effectiveMood === 'sleepy' ? 1.0 : smoothSleep;

    // TwoCode geometry matching Screenshot 2:
    // Distance between centers: 14.6px -> half-distance: 7.3px * size
    // Scale: 0.533 * size -> base ellipse (5, 8) scales to radius (2.66px, 4.26px), i.e. 5.3x8.5px
    const eyeGap = 7.3 * size;
    const eyeScale = 0.533 * size;

    ctx.save();
    ctx.translate(cx + lookX, cy + lookY + bob);
    ctx.rotate(this.tiltAngle);
    ctx.scale(this.widthFactor, this.heightFactor);

    // Sleepy Z particles
    if ((effectiveMood === 'sleepy' || this.isSleeping) && this.sleepyZzzs.length > 0) {
      for (const z of this.sleepyZzzs) {
        this.drawVectorZ(ctx, z.x * size, z.y * size, z.size * size, z.alpha, eyeCoreColor);
      }
    }

    // Thinking dot / ripple
    if (effectiveMood === 'thinking') {
      this.drawThoughtDot(ctx, eyeGap * 1.6, -8 * eyeScale, eyeCoreColor);
    }

    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * eyeGap, 0);

      // Subtle cyan glow & clean white/light-cyan core
      ctx.fillStyle = eyeCoreColor;
      ctx.strokeStyle = eyeCoreColor;
      ctx.shadowColor = eyeGlowColor;
      ctx.shadowBlur = Math.round(6 * size);
      ctx.lineWidth = 3 * eyeScale;
      ctx.lineCap = 'round';

      // 1. SLEEPY or INACTIVITY SLEEP STATE or BLINK: TwoCode downward curved arc matching Screenshot 2
      if (effectiveMood === 'sleepy' || effectiveMood === 'blink' || effectiveSleep >= 0.85) {
        ctx.scale(eyeScale, eyeScale);
        ctx.beginPath();
        ctx.arc(0, -2, 5, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
      // 2. HAPPY: cheerful upward arc (green smile)
      else if (effectiveMood === 'happy') {
        ctx.scale(eyeScale, eyeScale);
        ctx.beginPath();
        ctx.arc(0, 3, 5, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      // 2b. SAD: drooping downward arc (red frown on download cancelled/error)
      else if (effectiveMood === 'sad') {
        ctx.scale(eyeScale, eyeScale);
        ctx.beginPath();
        ctx.arc(0, -1, 5, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
      // 3. HEART: pink heart
      else if (effectiveMood === 'heart') {
        ctx.scale(eyeScale, eyeScale);
        ctx.beginPath();
        ctx.moveTo(0, 6);
        ctx.bezierCurveTo(-9, -1, -5, -9, 0, -4);
        ctx.bezierCurveTo(5, -9, 9, -1, 0, 6);
        ctx.fillStyle = '#ff5c8a';
        ctx.fill();
      }
      // 4. FOCUSED: concentrated narrowed horizontal ellipse
      else if (effectiveMood === 'focused') {
        ctx.scale(eyeScale, eyeScale);
        ctx.beginPath();
        ctx.ellipse(0, 1, 5.5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 5. CURIOUS: tilted, inquisitive oval
      else if (effectiveMood === 'curious') {
        ctx.scale(eyeScale, eyeScale);
        ctx.beginPath();
        if (side === 1) {
          ctx.ellipse(0, -1, 6, 9.5, 0, 0, Math.PI * 2);
        } else {
          ctx.ellipse(0, 1, 5, 7.5, -0.1, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      // 6. EXCITED: enlarged bright sparkling oval
      else if (effectiveMood === 'excited') {
        ctx.scale(eyeScale, eyeScale);
        ctx.beginPath();
        ctx.ellipse(0, 0, 6.2, 9.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 7. THINKING: eyes looking upward
      else if (effectiveMood === 'thinking') {
        ctx.scale(eyeScale, eyeScale);
        ctx.beginPath();
        ctx.ellipse(0, -1, 5, 7.5, side * 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
      // 8. SURPRISED / POKED: wide circular eyes with pupil and glint
      else if (effectiveMood === 'surprised' || effectiveMood === 'poked') {
        ctx.scale(eyeScale, eyeScale);
        ctx.beginPath();
        ctx.arc(0, 0, 7.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0a0d14';
        ctx.beginPath();
        ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(1.5, -1.5, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // 9. RELAXED: soft calm half-oval
      else if (effectiveMood === 'relaxed') {
        ctx.scale(eyeScale, eyeScale);
        ctx.beginPath();
        ctx.ellipse(0, 2, 4.5, 6.5, side * -0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      // 10. WINK (side === 1: flat line, side === -1: open eye)
      else if (effectiveMood === 'wink' && side === 1) {
        ctx.scale(eyeScale, eyeScale);
        ctx.beginPath();
        ctx.moveTo(-5, 2);
        ctx.lineTo(5, 2);
        ctx.stroke();
      }
      // 11. DIZZY: spiral
      else if (effectiveMood === 'dizzy') {
        ctx.scale(eyeScale, eyeScale);
        const turn = (performance.now() / 140) * side;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 4; a += 0.3) {
          const r = a * 0.55;
          ctx.lineTo(Math.cos(a + turn) * r, Math.sin(a + turn) * r);
        }
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
      // 12. DEFAULT / NEUTRAL: TwoCode sleek vertical oval matching Screenshot 2
      else {
        // Continuous smooth sleep transition (interpolating vertical height from 8 down to 1.6 as effectiveSleep goes 0 -> 0.85)
        const sleepHeightFactor = effectiveSleep > 0 ? Math.max(0.2, 1.0 - effectiveSleep * 0.8) : 1.0;
        const currentBlink = blinkYScale;
        const finalYScale = sleepHeightFactor * currentBlink;

        if (finalYScale < 0.25) {
          // At near-closure, draw sleek sleeping arc
          ctx.scale(eyeScale, eyeScale);
          ctx.beginPath();
          ctx.arc(0, -2, 5, Math.PI * 0.15, Math.PI * 0.85);
          ctx.stroke();
        } else {
          ctx.scale(eyeScale, eyeScale * finalYScale);
          ctx.beginPath();
          ctx.ellipse(0, 0, 5, 8, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    // Wardrobe accessories overlay for floating eyes
    if (this.outfitKey === 'sunglasses') {
      this.drawVectorSunglasses(ctx, 0, 0, eyeGap, 5 * eyeScale, 8 * eyeScale, size);
    } else if (this.outfitKey === 'crown' || this.hatKey === 'crown') {
      this.drawVectorCrown(ctx, 0, -8 * eyeScale - 6 * size, size * 0.85);
    } else if (this.outfitKey === 'party' || this.hatKey === 'party') {
      this.drawVectorPartyHat(ctx, -eyeGap * 0.8, -8 * eyeScale - 8 * size, size * 0.8);
    } else if (this.outfitKey === 'best') {
      this.drawVectorBestStar(ctx, eyeGap * 1.4, 8 * eyeScale * 0.6, size * 0.75);
    }

    ctx.restore();

    // Floating Speech Bubble
    if (this.speechBubble.active && this.speechBubble.text) {
      this.drawSpeechBubble(ctx, cx, cy - 16 * size);
    }
  }

  /**
   * Draw full mascot robot character (Head, Antenna, Eyes, Wardrobe).
   */
  public draw(ctx: CanvasRenderingContext2D, cx: number, cy: number, size = 32): void {
    const skin = this.getActivePalette();
    ctx.save();

    // Dancing bobbing, idle float and jump trajectory
    let bobY = (this.isDancing ? Math.sin(this.dancePhase) * 2.2 : this.idleFloatY) + this.jumpY;
    let tilt = this.tiltAngle;
    if (this.isDancing) {
      tilt += Math.cos(this.dancePhase * 0.5) * 0.08;
    }

    ctx.translate(cx, cy + bobY);
    ctx.rotate(tilt);
    ctx.scale(this.widthFactor, this.heightFactor);

    // Head dimensions
    const headW = size * 0.95;
    const headH = size * 0.78;
    const r = headH * 0.42;

    // Head Background & Border
    ctx.beginPath();
    ctx.roundRect(-headW / 2, -headH / 2, headW, headH, r);
    ctx.fillStyle = skin.headBg;
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = skin.headBorder;
    ctx.stroke();

    // Antenna on top
    ctx.beginPath();
    ctx.moveTo(0, -headH / 2);
    ctx.lineTo(0, -headH / 2 - 5);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = skin.accent;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -headH / 2 - 6, 2, 0, Math.PI * 2);
    ctx.fillStyle = skin.accent;
    ctx.shadowColor = skin.eyeGlow;
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Cheerful blush in happy mood
    if (this.mood === 'happy') {
      ctx.fillStyle = 'rgba(255, 107, 139, 0.45)';
      [-headW * 0.32, headW * 0.32].forEach(bx => {
        ctx.beginPath();
        ctx.arc(bx, 4, 3.2, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Draw Eyes
    this.drawEyes(ctx, headW, headH, skin);

    // Draw Hat/Outfit
    this.drawHat(ctx, headW, headH, skin);

    ctx.restore();

    // Draw Speech Bubble
    if (this.speechBubble.active && this.speechBubble.text) {
      this.drawSpeechBubble(ctx, cx, cy - size / 2 - 10);
    }

    // Draw active particle effects
    this.particles.draw(ctx);
  }

  private drawEyes(ctx: CanvasRenderingContext2D, headW: number, headH: number, skin: SkinPalette): void {
    const eyeOffsetX = headW * 0.22;
    const eyeY = 0;
    const eyeRadius = 3.6;

    const gazeX = this.lookX * 1.5;
    const gazeY = this.lookY * 1.5;

    let eyeColor = skin.eyeColor;
    let eyeGlow = skin.eyeGlow;
    if (this.mood === 'happy') {
      eyeColor = '#22e05a';
      eyeGlow = 'rgba(34, 224, 90, 0.60)';
    } else if (this.mood === 'sad') {
      eyeColor = '#ff3b3b';
      eyeGlow = 'rgba(255, 59, 59, 0.60)';
    }

    ctx.fillStyle = eyeColor;
    ctx.shadowColor = eyeGlow;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = eyeColor;

    if (this.mood === 'dizzy') {
      [-eyeOffsetX, eyeOffsetX].forEach(ex => {
        ctx.save();
        ctx.translate(ex, eyeY);
        ctx.rotate(this.spiralAngle);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 3; a += 0.2) {
          const rad = (a / (Math.PI * 3)) * 4.2;
          const sx = Math.cos(a) * rad;
          const sy = Math.sin(a) * rad;
          if (a === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.restore();
      });
      ctx.shadowBlur = 0;
      return;
    }

    [-eyeOffsetX, eyeOffsetX].forEach((ex, idx) => {
      ctx.save();
      ctx.translate(ex + gazeX, eyeY + gazeY);

      if (this.isBlinking && this.mood !== 'sleepy') {
        const squish = Math.sin(this.blinkProgress * Math.PI);
        const h = Math.max(0.4, (1 - squish) * eyeRadius);
        ctx.beginPath();
        ctx.ellipse(0, 0, eyeRadius, h, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.mood === 'happy' || (this.mood === 'wink' && idx === 1)) {
        // Happy smiling arc ^_^
        ctx.beginPath();
        ctx.lineWidth = 1.8;
        ctx.arc(0, 1.2, eyeRadius, Math.PI * 1.15, Math.PI * 1.85, false);
        ctx.stroke();
      } else if (this.mood === 'sad') {
        // Sad drooping frown
        ctx.beginPath();
        ctx.lineWidth = 1.8;
        ctx.arc(0, -0.6, eyeRadius, Math.PI * 0.15, Math.PI * 0.85, false);
        ctx.stroke();
      } else if (this.mood === 'sleepy') {
        // Sleepy drooping eye
        ctx.beginPath();
        ctx.lineWidth = 1.6;
        ctx.moveTo(-eyeRadius, 0);
        ctx.lineTo(eyeRadius, 0);
        ctx.stroke();
      } else if (this.mood === 'focused') {
        // Narrowed concentrated slit
        ctx.beginPath();
        ctx.ellipse(0, 0, eyeRadius * 1.2, eyeRadius * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 0.9, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.mood === 'excited') {
        // Sparkling eye
        ctx.beginPath();
        ctx.ellipse(0, 0, eyeRadius * 1.1, eyeRadius * 1.3, 0, 0, Math.PI * 2);
        ctx.fill();
        this.drawVectorSparkle(ctx, 0, 0, 2.2, '#ffffff');
      } else if (this.mood === 'surprised' || this.mood === 'poked') {
        // Wide circle with pupil and highlight
        ctx.beginPath();
        ctx.arc(0, 0, eyeRadius * 1.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0a0b0e';
        ctx.beginPath();
        ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0.8, -0.8, 0.7, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.mood === 'relaxed') {
        // Soft curve
        ctx.beginPath();
        ctx.ellipse(0, 0, eyeRadius * 1.0, eyeRadius * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Standard vibrant oval eye
        ctx.beginPath();
        ctx.ellipse(0, 0, eyeRadius * 0.85, eyeRadius * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tiny pupil highlight
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-0.8, -0.8, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

    ctx.shadowBlur = 0;
  }

  private drawHat(ctx: CanvasRenderingContext2D, headW: number, headH: number, skin: SkinPalette): void {
    ctx.save();
    const topY = -headH / 2;
    const hat = this.hatKey !== 'none' ? this.hatKey : this.outfitKey;

    switch (hat) {
      case 'headphones': {
        ctx.beginPath();
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = '#2b313e';
        ctx.arc(0, -2, headW * 0.54, Math.PI, 0, false);
        ctx.stroke();

        [-headW * 0.53, headW * 0.53].forEach(hx => {
          ctx.beginPath();
          ctx.roundRect(hx - 3, -4, 6, 12, 3);
          ctx.fillStyle = skin.accent;
          ctx.shadowColor = skin.eyeGlow;
          ctx.shadowBlur = 6;
          ctx.fill();
        });
        break;
      }
      case 'crown': {
        this.drawVectorCrown(ctx, 0, topY - 1, 1.0);
        break;
      }
      case 'party': {
        this.drawVectorPartyHat(ctx, 0, topY, 1.0);
        break;
      }
      case 'cap': {
        ctx.translate(0, topY + 2);
        ctx.fillStyle = '#2160fd';
        ctx.beginPath();
        ctx.arc(0, 0, 12, Math.PI, 0, false);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(8, 0, 8, 2.5, 0.1, 0, Math.PI * 2);
        ctx.fillStyle = '#1748c4';
        ctx.fill();
        break;
      }
      case 'sunglasses': {
        this.drawVectorSunglasses(ctx, 0, 0, headW * 0.22, 5, 8, 0.9);
        break;
      }
      case 'best': {
        this.drawVectorBestStar(ctx, headW * 0.32, headH * 0.36, 0.85);
        break;
      }
    }

    ctx.restore();
  }

  /**
   * Vector Drawing Helpers — Strictly Canvas 2D Vector Paths (Zero Unicode Emojis)
   */
  public drawVectorZ(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number, color: string): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.2, size * 0.22);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x - size / 2, y - size / 2);
    ctx.lineTo(x + size / 2, y - size / 2);
    ctx.lineTo(x - size / 2, y + size / 2);
    ctx.lineTo(x + size / 2, y + size / 2);
    ctx.stroke();
    ctx.restore();
  }

  public drawVectorSparkle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.quadraticCurveTo(cx, cy, cx + r, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + r);
    ctx.quadraticCurveTo(cx, cy, cx - r, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  public drawThoughtDot(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
    const now = performance.now() * 0.005;
    const pulse = 0.7 + Math.sin(now) * 0.3;
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 * pulse;
    ctx.beginPath();
    ctx.arc(cx, cy, 2.2 * pulse, 0, Math.PI * 2);
    ctx.fill();

    const ripple = (now % 2) / 2;
    ctx.strokeStyle = color;
    ctx.globalAlpha = Math.max(0, 1 - ripple);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 3 + ripple * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  public drawVectorSunglasses(ctx: CanvasRenderingContext2D, cx: number, cy: number, gap: number, w: number, h: number, scale = 1.0): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#0a0a0f';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.4 * scale;

    // Bridge connecting lenses
    ctx.beginPath();
    ctx.moveTo(-gap * 0.5, -2 * scale);
    ctx.lineTo(gap * 0.5, -2 * scale);
    ctx.stroke();

    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * gap, 0);

      // Lens
      ctx.beginPath();
      ctx.roundRect(-w * 1.35 * scale, -h * 0.85 * scale, w * 2.7 * scale, h * 1.7 * scale, 3 * scale);
      ctx.fill();
      ctx.stroke();

      // Glint reflection stripe
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.0 * scale;
      ctx.beginPath();
      ctx.moveTo(-w * 0.7 * scale, -h * 0.5 * scale);
      ctx.lineTo(w * 0.6 * scale, h * 0.5 * scale);
      ctx.stroke();

      ctx.restore();
    }
    ctx.restore();
  }

  public drawVectorCrown(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1.0): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffcc00';
    ctx.strokeStyle = '#e6a800';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(-12, -9);
    ctx.lineTo(-4, -4);
    ctx.lineTo(0, -11);
    ctx.lineTo(4, -4);
    ctx.lineTo(12, -9);
    ctx.lineTo(10, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Crown jewels
    ctx.fillStyle = '#ff2d55';
    ctx.beginPath();
    ctx.arc(0, -5, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  public drawVectorPartyHat(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1.0): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ff007f';
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(0, -16);
    ctx.lineTo(7, 0);
    ctx.closePath();
    ctx.fill();

    // Pompom
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(0, -17, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  public drawVectorBestStar(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1.0): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    this.drawVectorSparkle(ctx, 0, 0, 5, '#ffcc00');
    ctx.restore();
  }

  /**
   * Floating speech bubble rendered strictly with Canvas 2D vector shapes.
   */
  public drawSpeechBubble(ctx: CanvasRenderingContext2D, targetX: number, targetY: number): void {
    if (!this.speechBubble.active || !this.speechBubble.text) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1.0, this.speechBubble.alpha));

    const text = this.speechBubble.text;
    ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    // Word wrap into max width ~170px
    const maxLineW = 170;
    const words = text.split(' ');
    const lines: string[] = [];
    let curLine = '';

    for (const w of words) {
      const test = curLine ? `${curLine} ${w}` : w;
      if (ctx.measureText(test).width > maxLineW && curLine) {
        lines.push(curLine);
        curLine = w;
      } else {
        curLine = test;
      }
    }
    if (curLine) lines.push(curLine);

    let maxW = 0;
    for (const l of lines) {
      maxW = Math.max(maxW, ctx.measureText(l).width);
    }

    const padX = 12;
    const padY = 8;
    const lineH = 15;
    const boxW = Math.max(64, maxW + padX * 2);
    const boxH = lines.length * lineH + padY * 2;

    const boxX = targetX - boxW / 2;
    const boxY = targetY - boxH - 8;

    // Bubble Body
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;

    ctx.fillStyle = '#0c0e14';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 8);
    ctx.fill();

    // Tail Arrow pointing towards targetX, targetY
    ctx.beginPath();
    ctx.moveTo(targetX - 6, boxY + boxH);
    ctx.lineTo(targetX, boxY + boxH + 6);
    ctx.lineTo(targetX + 6, boxY + boxH);
    ctx.closePath();
    ctx.fill();

    // Subtle Outline Stroke
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.stroke();

    // Text Content
    ctx.fillStyle = '#f0f3f8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < lines.length; i++) {
      const lineY = boxY + padY + (i + 0.5) * lineH;
      ctx.fillText(lines[i], targetX, lineY);
    }

    ctx.restore();
  }
}
