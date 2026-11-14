"use strict";
(() => {
  // src/renderer/island/audio-synth.ts
  var PACKS = {
    klassiek: { wave: "sine", vol: 0.8, mul: 1, len: 1, label: "Klassiek" },
    zacht: { wave: "sine", vol: 0.55, mul: 0.75, len: 1.4, label: "Zacht" },
    belletjes: { wave: "triangle", vol: 0.9, mul: 2, len: 1.8, label: "Belletjes" }
  };
  var AudioSynth = class _AudioSynth {
    static instance = null;
    audioCtx = null;
    enabled = true;
    pack = "klassiek";
    get soundPack() {
      return this.pack;
    }
    set soundPack(val) {
      this.pack = val;
    }
    // Confetti overlay state
    confettiCanvas = null;
    confettiCtx = null;
    bits = [];
    isConfettiRunning = false;
    constructor() {
      this.initConfettiLayer();
    }
    static getInstance() {
      if (!_AudioSynth.instance) {
        _AudioSynth.instance = new _AudioSynth();
      }
      return _AudioSynth.instance;
    }
    getContext() {
      if (typeof window === "undefined") return null;
      try {
        if (!this.audioCtx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) this.audioCtx = new AudioCtx();
        }
        if (this.audioCtx && this.audioCtx.state === "suspended") {
          this.audioCtx.resume().catch(() => {
          });
        }
        return this.audioCtx;
      } catch {
        return null;
      }
    }
    /**
     * Dual-oscillator frequency sweep with exponential gain envelope
     */
    synth(from, to, dur, vol, delay = 0) {
      if (!this.enabled) return;
      const ctx = this.getContext();
      if (!ctx) return;
      const p = PACKS[this.pack] || PACKS.klassiek;
      try {
        const t = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = p.wave;
        osc.frequency.setValueAtTime(Math.max(20, from * p.mul), t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, to * p.mul), t + dur * p.len);
        gain.gain.setValueAtTime(1e-4, t);
        gain.gain.exponentialRampToValueAtTime(vol * p.vol, t + 0.012);
        gain.gain.exponentialRampToValueAtTime(1e-4, t + dur * p.len);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur * p.len + 0.05);
      } catch {
      }
    }
    /**
     * TwoCode wet rounded blob tone (plop / bloop) - Direct copy from twocode-fun.js lines 334-341
     */
    blobTone(from, to, dur, gain = 0.05, at = 0) {
      if (!this.enabled) return;
      const c = this.getContext();
      if (!c) return;
      try {
        const t = c.currentTime + Math.max(0, at);
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(from, t);
        o.frequency.exponentialRampToValueAtTime(to, t + dur);
        g.gain.setValueAtTime(1e-4, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
        g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
        o.connect(g);
        g.connect(c.destination);
        o.start(t);
        o.stop(t + dur + 0.03);
      } catch {
      }
    }
    /**
     * TwoCode chirp: sine that slides in pitch, triangle harmonic, optional trill - Direct copy from twocode-fun.js lines 317-332
     */
    chirp(at, from, to, dur, trill = 0, gain = 0.055) {
      if (!this.enabled) return;
      const c = this.getContext();
      if (!c) return;
      try {
        const t = c.currentTime + at;
        const out = c.createGain();
        out.gain.setValueAtTime(1e-4, t);
        out.gain.exponentialRampToValueAtTime(gain, t + 0.015);
        out.gain.setValueAtTime(gain, t + dur * 0.6);
        out.gain.exponentialRampToValueAtTime(1e-4, t + dur);
        out.connect(c.destination);
        const tones = [["sine", 1, 1], ["triangle", 2, 0.18]];
        const oscillators = tones.map(([type, mul, level]) => {
          const o = c.createOscillator();
          const g = c.createGain();
          o.type = type;
          g.gain.value = level;
          o.frequency.setValueAtTime(from * mul, t);
          o.frequency.exponentialRampToValueAtTime(to * mul, t + dur * 0.7);
          o.connect(g);
          g.connect(out);
          return o;
        });
        if (trill > 0) {
          const lfo = c.createOscillator();
          const depth = c.createGain();
          lfo.frequency.value = 16;
          depth.gain.setValueAtTime(0, t);
          depth.gain.linearRampToValueAtTime(trill, t + dur);
          lfo.connect(depth);
          oscillators.forEach((o) => depth.connect(o.frequency));
          lfo.start(t);
          lfo.stop(t + dur + 0.05);
        }
        oscillators.forEach((o) => {
          o.start(t);
          o.stop(t + dur + 0.05);
        });
      } catch {
      }
    }
    /**
     * TwoCode cheerful "hi!" upward chirp - Direct copy from twocode-fun.js line 343:
     * chirp(0, 760, 1180, 0.09); chirp(0.085, 1180, 1580, 0.2, 28);
     */
    sayHi() {
      if (!this.enabled) return;
      this.chirp(0, 760, 1180, 0.09);
      this.chirp(0.085, 1180, 1580, 0.2, 28);
    }
    /**
     * TwoCode goodbye chirp - Direct copy from twocode-fun.js line 344:
     * chirp(0, 1180, 940, 0.11); chirp(0.17, 1080, 640, 0.26, 24);
     */
    sayByeBye() {
      if (!this.enabled) return;
      this.chirp(0, 1180, 940, 0.11);
      this.chirp(0.17, 1080, 640, 0.26, 24);
    }
    /**
     * Play one of the 12 TwoCode procedural melodies
     */
    playMelody(kind) {
      this.play(kind);
    }
    play(kind) {
      if (!this.enabled) return;
      const melodies = {
        pop: [[700, 1100, 0.06, 0.012]],
        done: [
          [660, 880, 0.12, 0.02, 0],
          [880, 1320, 0.18, 0.018, 0.12]
        ],
        question: [
          [520, 600, 0.09, 0.018, 0],
          [600, 820, 0.14, 0.016, 0.1]
        ],
        error: [
          [300, 220, 0.18, 0.022, 0],
          [220, 160, 0.22, 0.02, 0.16]
        ],
        party: [523, 659, 784, 1047].map((f, i) => [f, f * 1.01, 0.12, 0.016, i * 0.09]),
        warn: [
          [440, 440, 0.1, 0.02, 0],
          [440, 440, 0.1, 0.02, 0.18]
        ],
        hello: [392, 523, 659, 784].map((f, i) => [f, f * 1.02, 0.1, 0.014, i * 0.07]),
        badge: [784, 988, 1175, 1568].map((f, i) => [f, f * 1.01, 0.1, 0.014, i * 0.06]),
        yum: [
          [500, 760, 0.08, 0.016, 0],
          [760, 620, 0.08, 0.014, 0.09]
        ],
        send: [[480, 960, 0.07, 0.011]],
        reply: [
          [880, 1175, 0.08, 0.012, 0],
          [1175, 1568, 0.12, 0.01, 0.08]
        ],
        fix: [523, 659, 784, 1047, 1319].map((f, i) => [f, f * 1.01, 0.13, 0.015, i * 0.075]),
        airdrop: [
          [740, 880, 0.1, 0.015, 0],
          [932, 1109, 0.14, 0.014, 0.08],
          [1109, 1480, 0.22, 0.012, 0.18]
        ]
      };
      const notes = melodies[kind] || melodies.pop;
      for (const n of notes) {
        this.synth(n[0], n[1], n[2], n[3], n[4] || 0);
      }
    }
    // =========================================================================
    // Confetti Particle Explosion
    // =========================================================================
    initConfettiLayer() {
      if (typeof document === "undefined") return;
      this.confettiCanvas = document.createElement("canvas");
      this.confettiCanvas.id = "island-confetti-layer";
      this.confettiCanvas.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;";
      document.body.appendChild(this.confettiCanvas);
      this.confettiCtx = this.confettiCanvas.getContext("2d");
    }
    launchConfetti(amount = 80, originX, originY) {
      if (!this.confettiCanvas || !this.confettiCtx) return;
      const cx = typeof originX === "number" ? originX : window.innerWidth / 2;
      const cy = typeof originY === "number" ? originY : 20;
      const colours = ["#22e05a", "#ff9a1f", "#ffd166", "#4cc9f0", "#f72585", "#00e5ff", "#bf5af2"];
      for (let i = 0; i < amount; i++) {
        this.bits.push({
          x: cx + (Math.random() - 0.5) * 120,
          y: cy,
          vx: (Math.random() - 0.5) * 6,
          vy: -Math.random() * 3.5 - 1.5,
          size: 3.5 + Math.random() * 4,
          spin: Math.random() * Math.PI * 2,
          colour: colours[i % colours.length],
          life: 1
        });
      }
      if (!this.isConfettiRunning) {
        this.isConfettiRunning = true;
        requestAnimationFrame(this.renderConfetti.bind(this));
      }
    }
    renderConfetti() {
      if (!this.confettiCanvas || !this.confettiCtx) return;
      this.confettiCanvas.width = window.innerWidth;
      this.confettiCanvas.height = window.innerHeight;
      this.confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      this.bits = this.bits.filter((b) => b.life > 0 && b.y < window.innerHeight + 10);
      for (const b of this.bits) {
        b.vy += 0.12;
        b.vx *= 0.99;
        b.x += b.vx;
        b.y += b.vy;
        b.spin += 0.18;
        b.life -= 9e-3;
        this.confettiCtx.save();
        this.confettiCtx.globalAlpha = Math.max(0, Math.min(1, b.life * 2));
        this.confettiCtx.translate(b.x, b.y);
        this.confettiCtx.rotate(b.spin);
        this.confettiCtx.fillStyle = b.colour;
        this.confettiCtx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2);
        this.confettiCtx.restore();
      }
      if (this.bits.length > 0) {
        requestAnimationFrame(this.renderConfetti.bind(this));
      } else {
        this.isConfettiRunning = false;
        this.confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    }
  };

  // src/renderer/island/robo-mascot.ts
  var SKINS = {
    classic: {
      name: "Classic Titanium",
      headBg: "#181b22",
      headBorder: "rgba(255, 255, 255, 0.16)",
      eyeColor: "#00e5ff",
      eyeGlow: "rgba(0, 229, 255, 0.45)",
      accent: "#00d2ff"
    },
    cyberpunk: {
      name: "Cyberpunk Neon",
      headBg: "#130924",
      headBorder: "#ff007f",
      eyeColor: "#ff007f",
      eyeGlow: "rgba(255, 0, 127, 0.6)",
      accent: "#00ffff"
    },
    matrix: {
      name: "Matrix Emerald",
      headBg: "#05160c",
      headBorder: "rgba(0, 255, 100, 0.3)",
      eyeColor: "#00ff66",
      eyeGlow: "rgba(0, 255, 102, 0.55)",
      accent: "#00ff66"
    },
    solar: {
      name: "Solar Amber",
      headBg: "#211508",
      headBorder: "rgba(255, 180, 0, 0.35)",
      eyeColor: "#ffaa00",
      eyeGlow: "rgba(255, 170, 0, 0.55)",
      accent: "#ffdd00"
    },
    amethyst: {
      name: "Amethyst Violet",
      headBg: "#1b0d2a",
      headBorder: "rgba(190, 80, 255, 0.35)",
      eyeColor: "#cf53ff",
      eyeGlow: "rgba(207, 83, 255, 0.55)",
      accent: "#cf53ff"
    }
  };
  var BODY_COLORS = {
    cloud: "#ffffff",
    mint: "#63e6e2",
    sky: "#5ac8fa",
    rose: "#ff2d55",
    classic: "#2c2d35",
    night: "#121318",
    blue: "#0a84ff",
    purple: "#af52de",
    pink: "#ff375f",
    gold: "#f5c518"
  };
  var EYE_COLORS = {
    mint: "#63e6e2",
    white: "#ffffff",
    blue: "#00d2ff",
    pink: "#ff2d55",
    purple: "#af52de",
    yellow: "#ffcc00"
  };
  var SoundSynthesizer = class {
    enabled = true;
    synth = AudioSynth.getInstance();
    playChirp() {
      if (!this.enabled) return;
      this.synth.play("pop");
    }
    playSuccess() {
      if (!this.enabled) return;
      this.synth.play("done");
    }
    playAlert() {
      if (!this.enabled) return;
      this.synth.play("warn");
    }
    playMelody(kind) {
      if (!this.enabled) return;
      this.synth.play(kind);
    }
    celebrate(kind = "party", bits = 80) {
      if (!this.enabled) return;
      this.synth.play(kind);
      this.synth.launchConfetti(bits);
    }
  };
  var ParticleSystem = class {
    particles = [];
    burst(x, y, count = 28) {
      const colors = ["#00d2ff", "#ff007f", "#00ff66", "#ffaa00", "#cf53ff", "#ffffff"];
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
          alpha: 1,
          rotation: Math.random() * Math.PI,
          vRot: (Math.random() - 0.5) * 0.2,
          life: 1
        });
      }
    }
    update(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12;
        p.rotation += p.vRot;
        p.life -= dt * 1.5;
        p.alpha = Math.max(0, p.life);
        if (p.life <= 0) {
          this.particles.splice(i, 1);
        }
      }
    }
    draw(ctx) {
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
  };
  var RoboMascot = class {
    mood = "neutral";
    skinKey = "classic";
    hatKey = "none";
    outfitKey = "none";
    bodyColorKey = "cloud";
    eyeColorKey = "mint";
    // Eye gaze tracking
    targetLookX = 0;
    targetLookY = 0;
    lookX = 0;
    lookY = 0;
    // Saccadic micro-movements
    saccadeX = 0;
    saccadeY = 0;
    targetSaccadeX = 0;
    targetSaccadeY = 0;
    saccadeTimer = 1.8;
    // Blinking & TwoCode idleLife random blinking/winking
    blinkProgress = 0;
    isBlinking = false;
    nextBlinkTimer = 2.5;
    nextIdleLifeBlink = performance.now() + 2500;
    currentIdleMood = null;
    // Jump, Bounce & Jelly Wobble Physics
    heightFactor = 1;
    widthFactor = 1;
    wobbleVelocity = 0;
    jumpY = 0;
    jumpVelocity = 0;
    isJumping = false;
    tiltAngle = 0;
    // Compact Idle & Motion Stability
    isCompactIdle = false;
    // Inactivity & Sleep State Transition (R4)
    inactivityTimer = 0;
    sleepProgress = 0;
    isSleeping = false;
    savedActiveMood = "neutral";
    sleepBreathPhase = 0;
    // Idle float bobbing
    idleFloatPhase = 0;
    idleFloatY = 0;
    // Speech Bubble System
    speechBubble = {
      text: "",
      timer: 0,
      duration: 0,
      alpha: 0,
      active: false
    };
    // Sleeping Z Particles
    sleepyZzzs = [];
    zzzTimer = 0.5;
    // Poking / Dizziness tracking
    pokeCount = 0;
    pokeTimer = 0;
    dizzyDuration = 0;
    spiralAngle = 0;
    // Dancing to music
    isDancing = false;
    dancePhase = 0;
    sounds = new SoundSynthesizer();
    particles = new ParticleSystem();
    setSkin(skin) {
      if (skin) this.skinKey = skin;
    }
    setHat(hat) {
      if (hat) this.hatKey = hat;
    }
    setOutfit(outfit) {
      if (outfit) {
        this.outfitKey = outfit;
        if (outfit === "sunglasses") this.hatKey = "sunglasses";
        else if (outfit === "crown") this.hatKey = "crown";
        else if (outfit === "party") this.hatKey = "party";
        else if (outfit === "none") this.hatKey = "none";
      }
    }
    setBodyColor(bodyColor) {
      if (bodyColor) this.bodyColorKey = bodyColor;
    }
    moodResetTimer = null;
    setEyeColor(eyeColor) {
      if (eyeColor) this.eyeColorKey = eyeColor;
    }
    setMood(mood, autoResetMs = 0) {
      if (this.moodResetTimer) {
        clearTimeout(this.moodResetTimer);
        this.moodResetTimer = null;
      }
      this.mood = mood;
      if (autoResetMs > 0 && mood !== "neutral") {
        this.moodResetTimer = setTimeout(() => {
          this.mood = "neutral";
          this.moodResetTimer = null;
        }, autoResetMs);
      }
    }
    getMood() {
      return this.mood;
    }
    /**
     * Reset the 60-second inactivity timer on user interaction.
     * If the mascot is currently sleeping or transitioning, triggers snappy elastic wakeup.
     */
    resetInactivity() {
      this.inactivityTimer = 0;
      if (this.mood === "focused" && this.isCompactIdle) {
        this.mood = "neutral";
      }
      if (this.isSleeping || this.sleepProgress > 0) {
        this.triggerWakeup();
      }
    }
    /**
     * Trigger transition to sleepy state after 60s inactivity.
     */
    triggerSleep() {
      if (!this.isSleeping) {
        this.isSleeping = true;
        this.savedActiveMood = this.mood;
      }
    }
    /**
     * Snappy 0.35s elastic spring wakeup upon mouse interaction,
     * playing soft chirp and cleanly restoring the prior active mood.
     */
    triggerWakeup() {
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
    jump(strength = 140) {
      this.jumpVelocity = -strength;
      this.isJumping = true;
      this.wobbleVelocity = 14;
      this.heightFactor = 1.28;
      this.sounds.playChirp();
    }
    /**
     * Bounce animation: rhythmic elastic spring hop.
     */
    bounce(strength = 90) {
      this.jumpVelocity = -strength;
      this.isJumping = true;
      this.wobbleVelocity = 10;
      this.sounds.playChirp();
    }
    /**
     * Spring impulse: elastic jelly wobble deformation.
     */
    spring(impulse = 0.35) {
      this.heightFactor = 1 + impulse;
      this.wobbleVelocity = impulse * 22;
    }
    /**
     * Kick animation: lateral tilt and spring wobble.
     */
    kick(direction = 1) {
      this.tiltAngle = direction * 0.22;
      this.spring(0.25);
    }
    /**
     * Speech bubble trigger for notification and contextual responses.
     */
    speak(text, duration = 4) {
      this.speechBubble = {
        text,
        timer: duration,
        duration,
        alpha: 0,
        active: true
      };
    }
    hideSpeech() {
      this.speechBubble.timer = 0;
    }
    /**
     * Resolve active skin palette merged with custom wardrobe body/eye swatches.
     */
    getActivePalette() {
      const base = SKINS[this.skinKey] || SKINS.classic;
      const bodyHex = this.bodyColorKey && BODY_COLORS[this.bodyColorKey] || (this.bodyColorKey && this.bodyColorKey.startsWith("#") ? this.bodyColorKey : base.headBg);
      const eyeHex = this.eyeColorKey && EYE_COLORS[this.eyeColorKey] || (this.eyeColorKey && this.eyeColorKey.startsWith("#") ? this.eyeColorKey : base.eyeColor);
      return {
        ...base,
        headBg: bodyHex,
        eyeColor: eyeHex,
        eyeGlow: eyeHex
      };
    }
    update(dt, pointerX, pointerY, headCenterX, headCenterY) {
      const dx = pointerX - headCenterX;
      const dy = pointerY - headCenterY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxLook = 1;
      const isPointerOffscreen = pointerX < -500 || pointerY < -500;
      if (!isPointerOffscreen && dist > 5) {
        this.targetLookX = Math.max(-maxLook, Math.min(maxLook, dx / 150));
        this.targetLookY = Math.max(-maxLook, Math.min(maxLook, dy / 120));
      } else {
        this.targetLookX = 0;
        this.targetLookY = 0;
      }
      let moodLookBiasX = 0;
      let moodLookBiasY = 0;
      if (this.mood === "thinking") {
        moodLookBiasX = 0.85;
        moodLookBiasY = -0.9;
      } else if (this.mood === "curious") {
        moodLookBiasX = 0.45;
        moodLookBiasY = -0.35;
      }
      this.saccadeTimer -= dt;
      if (this.saccadeTimer <= 0) {
        this.targetSaccadeX = (Math.random() - 0.5) * 0.28;
        this.targetSaccadeY = 0;
        this.saccadeTimer = 1.4 + Math.random() * 2.6;
      }
      this.saccadeX += (this.targetSaccadeX - this.saccadeX) * 0.2;
      this.saccadeY = 0;
      const gazeDamping = 1 - Math.exp(-8 * dt);
      this.lookX += (this.targetLookX + moodLookBiasX + this.saccadeX - this.lookX) * gazeDamping;
      this.lookY += (this.targetLookY + moodLookBiasY + this.saccadeY - this.lookY) * gazeDamping;
      if (this.isJumping) {
        this.jumpY += this.jumpVelocity * dt;
        this.jumpVelocity += 460 * dt;
        if (this.jumpY >= 0) {
          this.jumpY = 0;
          this.isJumping = false;
          this.jumpVelocity = 0;
          this.heightFactor = 0.74;
          this.wobbleVelocity = -14;
          this.sounds.playChirp();
        }
      }
      const springK = 190;
      const springDamping = 15;
      const springForce = -springK * (this.heightFactor - 1) - springDamping * this.wobbleVelocity;
      this.wobbleVelocity += springForce * dt;
      this.heightFactor += this.wobbleVelocity * dt;
      this.widthFactor = 1 / Math.max(0.3, Math.sqrt(Math.max(0.1, this.heightFactor)));
      this.tiltAngle += (0 - this.tiltAngle) * 0.14;
      this.idleFloatPhase += dt * 2.2;
      if (this.isCompactIdle) {
        this.idleFloatY = 0;
      } else {
        this.idleFloatY = Math.sin(this.idleFloatPhase) * 2.2;
      }
      if (this.isSleeping) {
        if (this.sleepProgress < 1) {
          this.sleepProgress = Math.min(1, this.sleepProgress + dt / 1.2);
        }
        this.sleepBreathPhase += dt * (Math.PI * 2 / 4);
      } else {
        if (this.sleepProgress > 0) {
          this.sleepProgress = Math.max(0, this.sleepProgress - dt / 0.35);
        }
        this.inactivityTimer += dt;
        if (this.inactivityTimer >= 60) {
          this.triggerSleep();
        }
      }
      if (this.dizzyDuration > 0) {
        this.dizzyDuration -= dt;
        this.spiralAngle += dt * 9;
        this.mood = "dizzy";
      } else {
        if (this.mood === "dizzy") this.mood = "neutral";
        this.nextBlinkTimer -= dt;
        if (this.nextBlinkTimer <= 0 && !this.isBlinking && this.mood !== "sleepy" && !this.isSleeping) {
          this.isBlinking = true;
          this.blinkProgress = 0;
        }
        if (this.isBlinking) {
          this.blinkProgress += dt / 0.15;
          if (this.blinkProgress >= 1) {
            this.isBlinking = false;
            this.blinkProgress = 0;
            this.nextBlinkTimer = 3 + Math.random() * 2.5;
          }
        }
      }
      if (this.speechBubble.active) {
        this.speechBubble.timer -= dt;
        if (this.speechBubble.timer <= 0) {
          this.speechBubble.alpha = Math.max(0, this.speechBubble.alpha - dt * 3.5);
          if (this.speechBubble.alpha <= 0) {
            this.speechBubble.active = false;
          }
        } else {
          this.speechBubble.alpha = Math.min(1, this.speechBubble.alpha + dt * 5);
        }
      }
      if (this.mood === "sleepy") {
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
      if (this.pokeTimer > 0) {
        this.pokeTimer -= dt;
        if (this.pokeTimer <= 0) this.pokeCount = 0;
      }
      if (this.isDancing) {
        this.dancePhase += dt * 7.5;
      } else {
        this.dancePhase = 0;
      }
      this.particles.update(dt);
    }
    poke(x, y) {
      this.pokeCount++;
      this.pokeTimer = 2;
      this.jump(120);
      this.sounds.playChirp();
      this.particles.burst(x, y, 12);
      if (this.pokeCount >= 5) {
        this.dizzyDuration = 3.5;
        this.pokeCount = 0;
        this.sounds.playAlert();
      }
    }
    /**
     * TwoCode random life: blinking and the odd wink
     * Direct parity with TwoCode twocode-fun.js lines 537-546
     */
    idleLife(t, mood) {
      if (mood !== "neutral") return mood;
      if (t > this.nextIdleLifeBlink) {
        if (t > this.nextIdleLifeBlink + 140) {
          this.nextIdleLifeBlink = t + 2500 + Math.random() * 3500;
          this.currentIdleMood = null;
        } else {
          if (!this.currentIdleMood) {
            this.currentIdleMood = Math.random() < 4e-3 ? "wink" : "blink";
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
    drawFloatingEyes(ctx, cx, cy, size = 1) {
      const skin = this.getActivePalette();
      const isCustomEye = Boolean(this.eyeColorKey && this.eyeColorKey !== "mint" && this.eyeColorKey !== "classic");
      const eyeCoreColor = isCustomEye ? skin.eyeColor : "#ffffff";
      const eyeGlowColor = isCustomEye ? skin.eyeGlow : "rgba(0, 229, 255, 0.40)";
      const effectiveMood = this.idleLife(performance.now(), this.mood);
      const lookX = Math.max(-1, Math.min(1, this.lookX)) * 1.8 * size;
      const lookY = Math.max(-1, Math.min(1, this.lookY)) * 1 * size;
      const bob = (this.isDancing ? Math.sin(this.dancePhase) * 1.5 * size : this.isCompactIdle ? 0 : this.idleFloatY * size) + this.jumpY;
      const blinkYScale = this.isBlinking ? Math.max(0.05, 1 - Math.sin(this.blinkProgress * Math.PI)) : 1;
      const t = Math.max(0, Math.min(1, this.sleepProgress));
      const smoothSleep = t * t * (3 - 2 * t);
      const effectiveSleep = effectiveMood === "sleepy" ? 1 : smoothSleep;
      const eyeGap = 7.3 * size;
      const eyeScale = 0.533 * size;
      ctx.save();
      ctx.translate(cx + lookX, cy + lookY + bob);
      ctx.rotate(this.tiltAngle);
      ctx.scale(this.widthFactor, this.heightFactor);
      if ((effectiveMood === "sleepy" || this.isSleeping) && this.sleepyZzzs.length > 0) {
        for (const z of this.sleepyZzzs) {
          this.drawVectorZ(ctx, z.x * size, z.y * size, z.size * size, z.alpha, eyeCoreColor);
        }
      }
      if (effectiveMood === "thinking") {
        this.drawThoughtDot(ctx, eyeGap * 1.6, -8 * eyeScale, eyeCoreColor);
      }
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(side * eyeGap, 0);
        ctx.fillStyle = eyeCoreColor;
        ctx.strokeStyle = eyeCoreColor;
        ctx.shadowColor = eyeGlowColor;
        ctx.shadowBlur = Math.round(6 * size);
        ctx.lineWidth = 3 * eyeScale;
        ctx.lineCap = "round";
        if (effectiveMood === "sleepy" || effectiveMood === "blink" || effectiveSleep >= 0.85) {
          ctx.scale(eyeScale, eyeScale);
          ctx.beginPath();
          ctx.arc(0, -2, 5, Math.PI * 0.15, Math.PI * 0.85);
          ctx.stroke();
        } else if (effectiveMood === "happy") {
          ctx.scale(eyeScale, eyeScale);
          ctx.beginPath();
          ctx.arc(0, 3, 5, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        } else if (effectiveMood === "heart") {
          ctx.scale(eyeScale, eyeScale);
          ctx.beginPath();
          ctx.moveTo(0, 6);
          ctx.bezierCurveTo(-9, -1, -5, -9, 0, -4);
          ctx.bezierCurveTo(5, -9, 9, -1, 0, 6);
          ctx.fillStyle = "#ff5c8a";
          ctx.fill();
        } else if (effectiveMood === "focused") {
          ctx.scale(eyeScale, eyeScale);
          ctx.beginPath();
          ctx.ellipse(0, 1, 5.5, 4, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (effectiveMood === "curious") {
          ctx.scale(eyeScale, eyeScale);
          ctx.beginPath();
          if (side === 1) {
            ctx.ellipse(0, -1, 6, 9.5, 0, 0, Math.PI * 2);
          } else {
            ctx.ellipse(0, 1, 5, 7.5, -0.1, 0, Math.PI * 2);
          }
          ctx.fill();
        } else if (effectiveMood === "excited") {
          ctx.scale(eyeScale, eyeScale);
          ctx.beginPath();
          ctx.ellipse(0, 0, 6.2, 9.5, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (effectiveMood === "thinking") {
          ctx.scale(eyeScale, eyeScale);
          ctx.beginPath();
          ctx.ellipse(0, -1, 5, 7.5, side * 0.15, 0, Math.PI * 2);
          ctx.fill();
        } else if (effectiveMood === "surprised") {
          ctx.scale(eyeScale, eyeScale);
          ctx.beginPath();
          ctx.arc(0, 0, 7, 0, Math.PI * 2);
          ctx.fill();
        } else if (effectiveMood === "relaxed") {
          ctx.scale(eyeScale, eyeScale);
          ctx.beginPath();
          ctx.ellipse(0, 2, 4.5, 6.5, side * -0.45, 0, Math.PI * 2);
          ctx.fill();
        } else if (effectiveMood === "wink" && side === 1) {
          ctx.scale(eyeScale, eyeScale);
          ctx.beginPath();
          ctx.moveTo(-5, 2);
          ctx.lineTo(5, 2);
          ctx.stroke();
        } else if (effectiveMood === "dizzy") {
          ctx.scale(eyeScale, eyeScale);
          const turn = performance.now() / 140 * side;
          ctx.beginPath();
          for (let a = 0; a < Math.PI * 4; a += 0.3) {
            const r = a * 0.55;
            ctx.lineTo(Math.cos(a + turn) * r, Math.sin(a + turn) * r);
          }
          ctx.lineWidth = 2.2;
          ctx.stroke();
        } else {
          const sleepHeightFactor = effectiveSleep > 0 ? Math.max(0.2, 1 - effectiveSleep * 0.8) : 1;
          const currentBlink = blinkYScale;
          const finalYScale = sleepHeightFactor * currentBlink;
          if (finalYScale < 0.25) {
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
      if (this.outfitKey === "sunglasses") {
        this.drawVectorSunglasses(ctx, 0, 0, eyeGap, 5 * eyeScale, 8 * eyeScale, size);
      } else if (this.outfitKey === "crown" || this.hatKey === "crown") {
        this.drawVectorCrown(ctx, 0, -8 * eyeScale - 6 * size, size * 0.85);
      } else if (this.outfitKey === "party" || this.hatKey === "party") {
        this.drawVectorPartyHat(ctx, -eyeGap * 0.8, -8 * eyeScale - 8 * size, size * 0.8);
      } else if (this.outfitKey === "best") {
        this.drawVectorBestStar(ctx, eyeGap * 1.4, 8 * eyeScale * 0.6, size * 0.75);
      }
      ctx.restore();
      if (this.speechBubble.active && this.speechBubble.text) {
        this.drawSpeechBubble(ctx, cx, cy - 16 * size);
      }
    }
    /**
     * Draw full mascot robot character (Head, Antenna, Eyes, Wardrobe).
     */
    draw(ctx, cx, cy, size = 32) {
      const skin = this.getActivePalette();
      ctx.save();
      let bobY = (this.isDancing ? Math.sin(this.dancePhase) * 2.2 : this.idleFloatY) + this.jumpY;
      let tilt = this.tiltAngle;
      if (this.isDancing) {
        tilt += Math.cos(this.dancePhase * 0.5) * 0.08;
      }
      ctx.translate(cx, cy + bobY);
      ctx.rotate(tilt);
      ctx.scale(this.widthFactor, this.heightFactor);
      const headW = size * 0.95;
      const headH = size * 0.78;
      const r = headH * 0.42;
      ctx.beginPath();
      ctx.roundRect(-headW / 2, -headH / 2, headW, headH, r);
      ctx.fillStyle = skin.headBg;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = skin.headBorder;
      ctx.stroke();
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
      if (this.mood === "happy") {
        ctx.fillStyle = "rgba(255, 107, 139, 0.45)";
        [-headW * 0.32, headW * 0.32].forEach((bx) => {
          ctx.beginPath();
          ctx.arc(bx, 4, 3.2, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      this.drawEyes(ctx, headW, headH, skin);
      this.drawHat(ctx, headW, headH, skin);
      ctx.restore();
      if (this.speechBubble.active && this.speechBubble.text) {
        this.drawSpeechBubble(ctx, cx, cy - size / 2 - 10);
      }
      this.particles.draw(ctx);
    }
    drawEyes(ctx, headW, headH, skin) {
      const eyeOffsetX = headW * 0.22;
      const eyeY = 0;
      const eyeRadius = 3.6;
      const gazeX = this.lookX * 1.5;
      const gazeY = this.lookY * 1.5;
      ctx.fillStyle = skin.eyeColor;
      ctx.shadowColor = skin.eyeGlow;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = skin.eyeColor;
      if (this.mood === "dizzy") {
        [-eyeOffsetX, eyeOffsetX].forEach((ex) => {
          ctx.save();
          ctx.translate(ex, eyeY);
          ctx.rotate(this.spiralAngle);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          for (let a = 0; a < Math.PI * 3; a += 0.2) {
            const rad = a / (Math.PI * 3) * 4.2;
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
        if (this.isBlinking && this.mood !== "sleepy") {
          const squish = Math.sin(this.blinkProgress * Math.PI);
          const h = Math.max(0.4, (1 - squish) * eyeRadius);
          ctx.beginPath();
          ctx.ellipse(0, 0, eyeRadius, h, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (this.mood === "happy" || this.mood === "wink" && idx === 1) {
          ctx.beginPath();
          ctx.lineWidth = 1.8;
          ctx.arc(0, 1.2, eyeRadius, Math.PI * 1.15, Math.PI * 1.85, false);
          ctx.stroke();
        } else if (this.mood === "sleepy") {
          ctx.beginPath();
          ctx.lineWidth = 1.6;
          ctx.moveTo(-eyeRadius, 0);
          ctx.lineTo(eyeRadius, 0);
          ctx.stroke();
        } else if (this.mood === "focused") {
          ctx.beginPath();
          ctx.ellipse(0, 0, eyeRadius * 1.2, eyeRadius * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(0, 0, 0.9, 0, Math.PI * 2);
          ctx.fill();
        } else if (this.mood === "excited") {
          ctx.beginPath();
          ctx.ellipse(0, 0, eyeRadius * 1.1, eyeRadius * 1.3, 0, 0, Math.PI * 2);
          ctx.fill();
          this.drawVectorSparkle(ctx, 0, 0, 2.2, "#ffffff");
        } else if (this.mood === "surprised") {
          ctx.beginPath();
          ctx.arc(0, 0, eyeRadius * 1.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#0a0b0e";
          ctx.beginPath();
          ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (this.mood === "relaxed") {
          ctx.beginPath();
          ctx.ellipse(0, 0, eyeRadius * 1, eyeRadius * 0.65, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.ellipse(0, 0, eyeRadius * 0.85, eyeRadius * 1.2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(-0.8, -0.8, 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
      ctx.shadowBlur = 0;
    }
    drawHat(ctx, headW, headH, skin) {
      ctx.save();
      const topY = -headH / 2;
      const hat = this.hatKey !== "none" ? this.hatKey : this.outfitKey;
      switch (hat) {
        case "headphones": {
          ctx.beginPath();
          ctx.lineWidth = 2.4;
          ctx.strokeStyle = "#2b313e";
          ctx.arc(0, -2, headW * 0.54, Math.PI, 0, false);
          ctx.stroke();
          [-headW * 0.53, headW * 0.53].forEach((hx) => {
            ctx.beginPath();
            ctx.roundRect(hx - 3, -4, 6, 12, 3);
            ctx.fillStyle = skin.accent;
            ctx.shadowColor = skin.eyeGlow;
            ctx.shadowBlur = 6;
            ctx.fill();
          });
          break;
        }
        case "crown": {
          this.drawVectorCrown(ctx, 0, topY - 1, 1);
          break;
        }
        case "party": {
          this.drawVectorPartyHat(ctx, 0, topY, 1);
          break;
        }
        case "cap": {
          ctx.translate(0, topY + 2);
          ctx.fillStyle = "#2160fd";
          ctx.beginPath();
          ctx.arc(0, 0, 12, Math.PI, 0, false);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(8, 0, 8, 2.5, 0.1, 0, Math.PI * 2);
          ctx.fillStyle = "#1748c4";
          ctx.fill();
          break;
        }
        case "sunglasses": {
          this.drawVectorSunglasses(ctx, 0, 0, headW * 0.22, 5, 8, 0.9);
          break;
        }
        case "best": {
          this.drawVectorBestStar(ctx, headW * 0.32, headH * 0.36, 0.85);
          break;
        }
      }
      ctx.restore();
    }
    /**
     * Vector Drawing Helpers — Strictly Canvas 2D Vector Paths (Zero Unicode Emojis)
     */
    drawVectorZ(ctx, x, y, size, alpha, color) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.2, size * 0.22);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x - size / 2, y - size / 2);
      ctx.lineTo(x + size / 2, y - size / 2);
      ctx.lineTo(x - size / 2, y + size / 2);
      ctx.lineTo(x + size / 2, y + size / 2);
      ctx.stroke();
      ctx.restore();
    }
    drawVectorSparkle(ctx, cx, cy, r, color) {
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
    drawThoughtDot(ctx, cx, cy, color) {
      const now = performance.now() * 5e-3;
      const pulse = 0.7 + Math.sin(now) * 0.3;
      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8 * pulse;
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2 * pulse, 0, Math.PI * 2);
      ctx.fill();
      const ripple = now % 2 / 2;
      ctx.strokeStyle = color;
      ctx.globalAlpha = Math.max(0, 1 - ripple);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 3 + ripple * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawVectorSunglasses(ctx, cx, cy, gap, w, h, scale = 1) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = "#0a0a0f";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 1.4 * scale;
      ctx.beginPath();
      ctx.moveTo(-gap * 0.5, -2 * scale);
      ctx.lineTo(gap * 0.5, -2 * scale);
      ctx.stroke();
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(side * gap, 0);
        ctx.beginPath();
        ctx.roundRect(-w * 1.35 * scale, -h * 0.85 * scale, w * 2.7 * scale, h * 1.7 * scale, 3 * scale);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
        ctx.lineWidth = 1 * scale;
        ctx.beginPath();
        ctx.moveTo(-w * 0.7 * scale, -h * 0.5 * scale);
        ctx.lineTo(w * 0.6 * scale, h * 0.5 * scale);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
    drawVectorCrown(ctx, x, y, scale = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = "#ffcc00";
      ctx.strokeStyle = "#e6a800";
      ctx.lineWidth = 1;
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
      ctx.fillStyle = "#ff2d55";
      ctx.beginPath();
      ctx.arc(0, -5, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    drawVectorPartyHat(ctx, x, y, scale = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = "#ff007f";
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(0, -16);
      ctx.lineTo(7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#00ffff";
      ctx.beginPath();
      ctx.arc(0, -17, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    drawVectorBestStar(ctx, x, y, scale = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      this.drawVectorSparkle(ctx, 0, 0, 5, "#ffcc00");
      ctx.restore();
    }
    /**
     * Floating speech bubble rendered strictly with Canvas 2D vector shapes.
     */
    drawSpeechBubble(ctx, targetX, targetY) {
      if (!this.speechBubble.active || !this.speechBubble.text) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, this.speechBubble.alpha));
      const text = this.speechBubble.text;
      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const maxLineW = 170;
      const words = text.split(" ");
      const lines = [];
      let curLine = "";
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
      ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = "#0c0e14";
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 8);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(targetX - 6, boxY + boxH);
      ctx.lineTo(targetX, boxY + boxH + 6);
      ctx.lineTo(targetX + 6, boxY + boxH);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
      ctx.stroke();
      ctx.fillStyle = "#f0f3f8";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < lines.length; i++) {
        const lineY = boxY + padY + (i + 0.5) * lineH;
        ctx.fillText(lines[i], targetX, lineY);
      }
      ctx.restore();
    }
  };

  // src/renderer/island/texture-engine.ts
  var TextureEngine = class _TextureEngine {
    static instance = null;
    style = "none";
    state = {
      L: 50,
      R: 50,
      split: null,
      web: 0,
      grow: 0,
      k: 0
    };
    sessionStartTime = Date.now();
    constructor() {
    }
    static getInstance() {
      if (!_TextureEngine.instance) {
        _TextureEngine.instance = new _TextureEngine();
      }
      return _TextureEngine.instance;
    }
    clamp(v) {
      return Math.max(0, Math.min(1, v));
    }
    update(cpu = 25, ram = 45) {
      const slow = 0.06;
      if (this.style === "fire") {
        const all = Math.max(cpu, ram);
        this.state.L += (all - this.state.L) * slow;
        this.state.R += (all - this.state.R) * slow;
        this.state.k = Math.min(1, this.state.k + 0.05);
      } else if (this.style === "web") {
        const d = /* @__PURE__ */ new Date();
        const h = d.getHours() + d.getMinutes() / 60;
        const lateness = this.clamp(h >= 23 ? (h - 23) / 6 : h < 5 ? (h + 1) / 6 : 0);
        this.state.web += (lateness - this.state.web) * slow;
        this.state.k = Math.min(1, this.state.k + 0.05);
      } else if (this.style === "grow") {
        const hours = (Date.now() - this.sessionStartTime) / (1e3 * 3600);
        const dayGreen = this.clamp(hours / 8);
        this.state.grow += (dayGreen - this.state.grow) * slow;
        this.state.k = Math.min(1, this.state.k + 0.05);
      } else {
        this.state.k = Math.max(0, this.state.k - 0.08);
      }
    }
    /**
     * Render environmental textures behind and on the island pill
     */
    renderBehind(ctx, x, topY, w, h, radius) {
      if (this.state.k <= 0.01 || this.style === "none") return;
      ctx.save();
      ctx.globalAlpha = this.state.k;
      if (this.style === "fire") {
        this.renderFireIceBehind(ctx, x, topY, w, h, radius);
      } else if (this.style === "web") {
        this.renderWebs(ctx, x, topY, w, h);
      } else if (this.style === "grow") {
        this.renderVines(ctx, x, topY, w, h);
      }
      ctx.restore();
    }
    // =========================================================================
    // 1. Fire & Ice Shader
    // =========================================================================
    renderFireIceBehind(ctx, x, topY, w, h, radius) {
      const t = performance.now() * 3e-3;
      const avgLoad = (this.state.L + this.state.R) / 2;
      const isCold = avgLoad < 35;
      const isHot = avgLoad > 55;
      if (isCold) {
        const coldIntensity = this.clamp((35 - avgLoad) / 25);
        const icicleCount = Math.floor(w / 18);
        ctx.save();
        ctx.fillStyle = "rgba(180, 230, 255, 0.65)";
        ctx.shadowColor = "rgba(160, 220, 255, 0.7)";
        ctx.shadowBlur = 6;
        for (let i = 0; i < icicleCount; i++) {
          const ix = x + 12 + i * 18;
          const iy = topY + h;
          const len = (6 + Math.sin(i * 1.7 + t * 0.5) * 4) * coldIntensity;
          ctx.beginPath();
          ctx.moveTo(ix - 3, iy);
          ctx.lineTo(ix, iy + len);
          ctx.lineTo(ix + 3, iy);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
      if (isHot) {
        const fireIntensity = this.clamp((avgLoad - 55) / 35);
        ctx.save();
        const emberCount = Math.floor(fireIntensity * 8);
        for (let i = 0; i < emberCount; i++) {
          const side = i % 2 === 0 ? x : x + w;
          const ex = side + Math.sin(t * 2 + i) * 8;
          const ey = topY + h - Math.abs(Math.sin(t * 3 + i * 1.3)) * 18;
          const er = 1.5 + Math.sin(t * 4 + i) * 1;
          ctx.beginPath();
          ctx.arc(ex, ey, Math.max(0.8, er), 0, Math.PI * 2);
          ctx.fillStyle = i % 2 === 0 ? "#ff9a1f" : "#ff453a";
          ctx.shadowColor = "#ff8800";
          ctx.shadowBlur = 8;
          ctx.fill();
        }
        ctx.restore();
      }
    }
    // =========================================================================
    // 2. Spider Web Shader
    // =========================================================================
    renderWebs(ctx, x, topY, w, h) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x + 18, topY + 12);
      ctx.moveTo(x, topY + 8);
      ctx.quadraticCurveTo(x + 8, topY + 8, x + 14, topY);
      ctx.moveTo(x, topY + 16);
      ctx.quadraticCurveTo(x + 12, topY + 14, x + 20, topY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w, topY);
      ctx.lineTo(x + w - 18, topY + 12);
      ctx.moveTo(x + w, topY + 8);
      ctx.quadraticCurveTo(x + w - 8, topY + 8, x + w - 14, topY);
      ctx.moveTo(x + w, topY + 16);
      ctx.quadraticCurveTo(x + w - 12, topY + 14, x + w - 20, topY);
      ctx.stroke();
      ctx.restore();
    }
    // =========================================================================
    // 3. Overgrown Vines Shader
    // =========================================================================
    renderVines(ctx, x, topY, w, h) {
      ctx.save();
      ctx.strokeStyle = "#34c759";
      ctx.fillStyle = "#30d158";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + 6, topY + h - 2);
      ctx.quadraticCurveTo(x + 16, topY + h + 6, x + 24, topY + h - 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 16, topY + h + 4, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + w - 6, topY + h - 2);
      ctx.quadraticCurveTo(x + w - 16, topY + h + 6, x + w - 24, topY + h - 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + w - 16, topY + h + 4, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  // src/renderer/island/canvas-engine.ts
  var CanvasEngine = class {
    canvas;
    ctx;
    mascot;
    // View & Geometry State
    mode = "compact";
    activeTab = "media";
    isTucked = false;
    isGameModeThrottled = false;
    // Notification State (TwoCode Parity: Melodies, Spring Jelly Kick, Rim Glow, Allow/Deny Actions)
    activeNotification = null;
    notificationUntil = 0;
    notificationTimer = null;
    notificationHits = {};
    // TwoCode Resting Geometry Parity (matching Screenshot 2):
    // Rest Mode: 32 x 18 px (radius = 9px)
    // Resting Compact Dock: 98 x 26 px (radius = 13px)
    // Media / Active: 300 x 36 px
    // Expanded Hub: 520 x 240 px
    // Tuck-away: 56 x 4 px (radius = 2px)
    currentWidth = 98;
    currentHeight = 26;
    currentRadius = 13;
    targetWidth = 98;
    targetHeight = 26;
    targetRadius = 13;
    // Cursor & Interactivity
    pointerX = -1e3;
    pointerY = -1e3;
    isHovered = false;
    isInteractive = false;
    collapseTimer = null;
    isDraggingOver = false;
    justRestoredFromRest = false;
    // Live Media State (Windows SMTC, YouTube, Spotify)
    mediaState = {
      active: false,
      source: "none",
      app: "",
      title: "",
      artist: "",
      album: "",
      playing: false,
      positionMs: 0,
      durationMs: 0,
      coverUrl: "",
      lyricLine: ""
    };
    lastMediaSampleTime = performance.now();
    basePositionMs = 0;
    // Album dominant color extraction & visualizer (TwoCode Parity)
    albumAccentColor = "#1ed760";
    albumImageElement = null;
    lastCoverUrl = "";
    currentTintR = 30;
    currentTintG = 215;
    currentTintB = 96;
    targetTintR = 30;
    targetTintG = 215;
    targetTintB = 96;
    visualizerBars = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
    syncedLyrics = [];
    // TwoCode Synchronized Lyrics State Machine (lyrics-ui.js)
    lyricsIndex = -1;
    lyricsGap = false;
    lyricsChangedAt = 0;
    lyricsPrevious = null;
    lyricsWidest = 0;
    LYRICS_LEAD = 250;
    LYRICS_SWAP = 420;
    LYRICS_FONT = '500 12.5px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    isDevicesOpen = false;
    spotifyDevices = [];
    // Live AI State (Claude Code & Codex)
    aiState = {
      connected: false,
      agent: "claude",
      status: "ready",
      prompt: "",
      currentTool: "",
      pendingPermission: null
    };
    // Weather State (Open-Meteo)
    weatherState = {
      temp: "--",
      condition: "Checking...",
      city: "Local"
    };
    // System Hardware Info
    batteryState = {
      level: 100,
      charging: false
    };
    // Feature B: Charger Plug-in Surge Pop State (Zero Clutter)
    chargerSurgeUntil = 0;
    chargerSurgeStartTime = 0;
    chargerSurgeCharging = false;
    chargerSurgeLevel = 100;
    // Apple Hardware Volume HUD Pop State
    volumeHudUntil = 0;
    volumeHudStartTime = 0;
    volumeHudLevel = 50;
    volumeHudMuted = false;
    isVolumeInitialized = false;
    isScrubbingVolumeHud = false;
    engineStartTime = performance.now();
    // Apple Speedometer Telemetry HUD Pop State (CPU, RAM, Storage)
    speedometerHudUntil = 0;
    speedometerHudStartTime = 0;
    metricsState = {
      cpu: 18,
      ram: 45,
      storage: { totalGb: 280, freeGb: 77, usedGb: 203, percent: 72 },
      cores: 8,
      totalMemMb: 16384,
      freeMemMb: 9011,
      usedMemMb: 7373
    };
    // Apple AirDrop Transfer HUD State
    airdropHudUntil = 0;
    airdropHudStartTime = 0;
    airdropHudType = "received";
    airdropHudFileName = "";
    airdropHudFileSize = "";
    // Apple Quick Look & LAN Drop Beam State
    latestTrayFiles = [];
    activeQuickLookPath = null;
    isQuickLookOpen = false;
    transferProgress = null;
    transferDirection = "download";
    transferProgressUntil = 0;
    isNotificationActive() {
      if (!this.activeNotification) return false;
      if (this.notificationUntil > 0 && performance.now() > this.notificationUntil) {
        this.activeNotification = null;
        return false;
      }
      return true;
    }
    getNotificationColor(kind) {
      switch (kind) {
        case "done":
          return "#22e05a";
        // TwoCode green
        case "question":
          return "#ff9a1f";
        // TwoCode orange
        case "error":
          return "#ff3b3b";
        // TwoCode red
        case "warn":
          return "#ffd60a";
        // TwoCode yellow
        case "pop":
        case "info":
          return "#00d2ff";
        // Cyan
        case "badge":
          return "#bf5af2";
        // Purple
        default:
          return "#ffffff";
      }
    }
    triggerNotification(n) {
      this.activeNotification = n;
      const duration = n.durationMs || (n.actions && n.actions.length > 0 ? 0 : 4e3);
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
      this.kickJelly(0.18, 5, 4);
      const soundKind = n.kind || "pop";
      try {
        AudioSynth.getInstance().play(soundKind);
      } catch {
      }
      if (n.kind === "done" || n.kind === "badge") {
        try {
          AudioSynth.getInstance().launchConfetti(45, window.innerWidth / 2, this.getTopY() + 18);
        } catch {
        }
      }
      this.updateTargetDimensions();
    }
    clearNotification() {
      this.activeNotification = null;
      this.notificationUntil = 0;
      if (this.notificationTimer) {
        clearTimeout(this.notificationTimer);
        this.notificationTimer = null;
      }
      this.updateTargetDimensions();
    }
    isInsideHit(px, py, hit) {
      return px >= hit.x && px <= hit.x + hit.width && py >= hit.y && py <= hit.y + hit.height;
    }
    truncateText(text, maxWidth, font) {
      this.ctx.save();
      this.ctx.font = font;
      if (this.ctx.measureText(text).width <= maxWidth) {
        this.ctx.restore();
        return text;
      }
      let str = text;
      while (str.length > 3 && this.ctx.measureText(str + "...").width > maxWidth) {
        str = str.slice(0, -1);
      }
      this.ctx.restore();
      return str + "...";
    }
    isSplitIslandActive() {
      if (this.isNotificationActive()) return false;
      const isDualActive = this.focusState.active && Boolean(this.mediaState.playing || this.mediaState.active && this.mediaState.title);
      return this.mode === "compact" && !this.isTucked && isDualActive && !(performance.now() < this.chargerSurgeUntil) && !(performance.now() < this.volumeHudUntil) && !(performance.now() < this.speedometerHudUntil) && !(performance.now() < this.airdropHudUntil);
    }
    triggerChargerSurge(charging = true, level) {
      this.chargerSurgeCharging = charging;
      this.chargerSurgeLevel = typeof level === "number" ? level : this.batteryState.level || 100;
      this.chargerSurgeStartTime = performance.now();
      this.chargerSurgeUntil = performance.now() + 2600;
      this.updateTargetDimensions();
    }
    /**
     * Apple-Style Hardware Volume HUD Pop
     * When volume keys (Vol Up/Down/Mute) are pressed, smoothly expands pill to 270px for 2.2s.
     */
    triggerVolumeHud(level, muted = false) {
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
    getAppleGaugeColor(pct) {
      if (pct >= 85) {
        return {
          hex: "#ff453a",
          glow: "rgba(255, 69, 58, 0.65)",
          track: "rgba(255, 69, 58, 0.18)",
          label: "HIGH"
        };
      } else if (pct >= 60) {
        return {
          hex: "#ff9f0a",
          glow: "rgba(255, 159, 10, 0.60)",
          track: "rgba(255, 159, 10, 0.18)",
          label: "MED"
        };
      } else {
        return {
          hex: "#30d158",
          glow: "rgba(48, 209, 88, 0.55)",
          track: "rgba(48, 209, 88, 0.18)",
          label: "LOW"
        };
      }
    }
    /**
     * Apple-Style Hardware Speedometer HUD Pop (CPU, RAM, Storage)
     * Smoothly springs compact island out to ~360px showing 3 tachometer dials.
     */
    triggerSpeedometerHud() {
      this.speedometerHudStartTime = performance.now();
      this.speedometerHudUntil = performance.now() + 4200;
      this.kickJelly(0.09);
      this.updateTargetDimensions();
    }
    /**
     * Apple AirDrop Transfer HUD & Animation
     * Pops concentric pulsing radar waves, file name, and green checkmark.
     */
    triggerAirDropHud(type, fileName, fileSize = "") {
      this.airdropHudType = type;
      this.airdropHudFileName = fileName || "File";
      this.airdropHudFileSize = fileSize;
      this.airdropHudStartTime = performance.now();
      this.airdropHudUntil = performance.now() + 3800;
      this.kickJelly(0.12);
      try {
        AudioSynth.getInstance()?.play?.("airdrop");
      } catch {
      }
      this.updateTargetDimensions();
      this.showAirDropToast(type, fileName, fileSize);
    }
    showAirDropToast(type, fileName, fileSize = "") {
      const toast = document.getElementById("airdrop-toast");
      const toastTitle = document.getElementById("airdrop-toast-title");
      const toastName = document.getElementById("airdrop-toast-name");
      const toastIcon = document.getElementById("airdrop-toast-icon-svg");
      if (!toast) return;
      if (toastTitle) {
        toastTitle.textContent = type === "sent" ? "AirDrop Sent" : "AirDrop Received";
      }
      if (toastName) {
        toastName.textContent = fileSize ? `${fileName} (${fileSize})` : fileName;
      }
      if (toastIcon) {
        toastIcon.innerHTML = type === "sent" ? '<polyline points="12 19 12 5"></polyline><polyline points="5 12 12 5 19 12"></polyline>' : '<polyline points="12 5 12 19"></polyline><polyline points="19 12 12 19 5 12"></polyline>';
      }
      toast.classList.remove("hidden");
      toast.classList.remove("airdrop-fade-out");
      toast.classList.add("airdrop-pop-in");
      clearTimeout(this.__airdropToastTimer);
      this.__airdropToastTimer = setTimeout(() => {
        toast.classList.add("airdrop-fade-out");
        setTimeout(() => {
          toast.classList.add("hidden");
          toast.classList.remove("airdrop-pop-in");
          toast.classList.remove("airdrop-fade-out");
        }, 400);
      }, 3200);
    }
    /**
     * Pure vector Canvas renderer for Apple AirDrop Transfer HUD:
     * - Left: Concentric pulsing radar waves with vector document fold & arrow
     * - Center: Bold title and filename
     * - Right: Apple Green circular checkmark badge with glow
     */
    drawAirDropHudContent(cx, topY) {
      const W = this.currentWidth;
      const H = this.currentHeight;
      const midY = topY + H / 2;
      const pillLeft = cx - W / 2;
      const t = performance.now();
      const elapsed = (t - this.airdropHudStartTime) / 1e3;
      this.ctx.save();
      const radarCx = pillLeft + 26;
      const radarCy = midY;
      const isSent = this.airdropHudType === "sent";
      const ringColor = isSent ? "#00d2ff" : "#30d158";
      for (let i = 0; i < 3; i++) {
        const phase = (elapsed * 0.9 + i * 0.33) % 1;
        const r = 7 + phase * 13;
        const alpha = Math.max(0, (1 - phase) * 0.75);
        this.ctx.beginPath();
        this.ctx.arc(radarCx, radarCy, r, 0, Math.PI * 2);
        this.ctx.strokeStyle = ringColor;
        this.ctx.lineWidth = 1.6;
        this.ctx.globalAlpha = alpha;
        this.ctx.stroke();
      }
      this.ctx.globalAlpha = 1;
      this.ctx.beginPath();
      this.ctx.arc(radarCx, radarCy, 9, 0, Math.PI * 2);
      this.ctx.fillStyle = isSent ? "rgba(0, 210, 255, 0.22)" : "rgba(48, 209, 88, 0.22)";
      this.ctx.fill();
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = 1.5;
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";
      this.ctx.strokeRect(radarCx - 4.5, radarCy - 5.5, 9, 11);
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
      const textLeft = pillLeft + 48;
      const maxTextW = W - 92;
      this.ctx.textAlign = "left";
      this.ctx.textBaseline = "alphabetic";
      this.ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
      this.ctx.fillStyle = ringColor;
      const titleText = isSent ? "AirDrop Sent" : "AirDrop Received";
      this.ctx.fillText(titleText, textLeft, midY - 2);
      this.ctx.font = '500 10px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      let nameText = this.airdropHudFileName;
      if (this.airdropHudFileSize) {
        nameText += ` (${this.airdropHudFileSize})`;
      }
      if (this.ctx.measureText(nameText).width > maxTextW) {
        while (nameText.length > 3 && this.ctx.measureText(nameText + "...").width > maxTextW) {
          nameText = nameText.slice(0, -1);
        }
        nameText += "...";
      }
      this.ctx.fillText(nameText, textLeft, midY + 11);
      const checkCx = pillLeft + W - 22;
      const checkCy = midY;
      const checkR = 9.5;
      this.ctx.beginPath();
      this.ctx.arc(checkCx, checkCy, checkR, 0, Math.PI * 2);
      this.ctx.fillStyle = "#30d158";
      this.ctx.shadowColor = "rgba(48, 209, 88, 0.55)";
      this.ctx.shadowBlur = 6;
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = 2;
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";
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
    startHello() {
      if (this.isStartupHelloBusy) return;
      this.isStartupHelloBusy = true;
      const now = performance.now();
      this.startupHelloStartTime = now;
      this.popAt = now + 180;
      this.setMode("compact");
      this.kickJelly(0.12);
      try {
        AudioSynth.getInstance().blobTone(180, 620, 0.16, 0.06);
      } catch {
      }
      setTimeout(() => {
        try {
          AudioSynth.getInstance().blobTone(520, 240, 0.08, 0.05);
        } catch {
        }
      }, 380);
      setTimeout(() => {
        this.mascot.setMood("happy");
        try {
          AudioSynth.getInstance().sayHi();
        } catch {
        }
      }, 700);
      setTimeout(() => {
        this.mascot.setMood("happy");
      }, 1300);
      setTimeout(() => {
        this.mascot.setMood("wink");
        try {
          AudioSynth.getInstance().blobTone(900, 1300, 0.05, 0.025);
        } catch {
        }
      }, 2e3);
      setTimeout(() => {
        this.isStartupHelloBusy = false;
        this.startupHelloStartTime = 0;
        this.popAt = 0;
        this.mascot.setMood("neutral");
        if (this.config && this.config.restModeEnabled) {
          this.setMode("rest");
        } else {
          this.setMode("compact", false);
        }
        this.kickJelly(0.07, 3);
      }, 2700);
    }
    volumeState = {
      level: 50,
      muted: false
    };
    netState = {
      ssid: "Connected",
      bars: 4,
      wifiOn: true,
      btOn: false,
      btDevice: ""
    };
    // Focus Timer
    focusState = {
      active: false,
      totalSeconds: 25 * 60,
      remainingSeconds: 25 * 60,
      isBreak: false
    };
    // Config
    config = {
      islandStyle: "floating",
      islandScale: 1,
      visualTexture: "obsidian",
      soundEnabled: true,
      expandedUiMode: "dom"
    };
    isBuddyOut = false;
    // TwoCode startup animation & jelly spring physics
    isStartupHelloBusy = false;
    startupHelloStartTime = 0;
    popAt = 0;
    kicks = [];
    tuckHoverStartTime = 0;
    tuckChangedAt = 0;
    tuckArmed = false;
    nextBlinkTime = performance.now() + 2500;
    islandSpring = { vWidth: 0, vHeight: 0, vRadius: 0, last: 0 };
    twoCodeSpring(ms, amp, hz = 3, damp = 6) {
      return ms < 0 ? 0 : amp * Math.exp(-damp * ms / 1e3) * Math.sin(2 * Math.PI * hz * ms / 1e3);
    }
    kickJelly(amp = 0.12, hz = 2.6, damp = 5.5) {
      this.kicks.push({ at: performance.now(), amp, hz, damp });
      if (this.kicks.length > 6) this.kicks.shift();
    }
    // Hybrid DOM Expanded UI Overlay (Rollback safety via config.expandedUiMode)
    domOverlayEl = null;
    currentDomTab = "home";
    activePopover = "none";
    setPopover(target) {
      this.activePopover = target;
      const popover = document.getElementById("system-popover");
      const panelWifi = document.getElementById("popover-panel-wifi");
      const panelBt = document.getElementById("popover-panel-bt");
      const btnWifi = document.getElementById("btn-status-wifi");
      const btnBt = document.getElementById("btn-status-bt");
      const btnGroup = document.getElementById("btn-system-popover");
      if (btnWifi) btnWifi.classList.toggle("active", target === "wifi");
      if (btnBt) btnBt.classList.toggle("active", target === "bt");
      if (btnGroup) btnGroup.classList.toggle("active", target !== "none");
      if (target === "none") {
        if (popover) popover.classList.add("hidden");
        if (panelWifi) panelWifi.classList.add("hidden");
        if (panelBt) panelBt.classList.add("hidden");
      } else if (target === "wifi") {
        if (popover) {
          popover.style.left = "12px";
          popover.classList.remove("hidden");
        }
        if (panelWifi) panelWifi.classList.remove("hidden");
        if (panelBt) panelBt.classList.add("hidden");
      } else if (target === "bt") {
        if (popover) {
          popover.style.left = "34px";
          popover.classList.remove("hidden");
        }
        if (panelWifi) panelWifi.classList.add("hidden");
        if (panelBt) panelBt.classList.remove("hidden");
      }
    }
    updateNetworkDom() {
      const ssidEl = document.getElementById("popover-wifi-ssid");
      const tileWifiEl = document.getElementById("tile-wifi");
      if (ssidEl) ssidEl.textContent = this.netState.wifiOn ? this.netState.ssid || "Connected" : "Off";
      if (tileWifiEl) tileWifiEl.classList.toggle("active", this.netState.wifiOn);
      const btStatusEl = document.getElementById("popover-bt-status");
      const tileBtEl = document.getElementById("tile-bt");
      if (btStatusEl) btStatusEl.textContent = this.netState.btOn ? this.netState.btDevice || "Active" : "Off";
      if (tileBtEl) tileBtEl.classList.toggle("active", this.netState.btOn);
    }
    lastTime = performance.now();
    // UX-4: Resource Optimization — idle frame throttling and dirty-flag render
    _idleFrameCount = 0;
    _lastRenderHash = "";
    _isPowerSaving = false;
    _powerSavingFrameInterval = 0;
    // ms between frames in power-saving mode (0 = disabled)
    _lastPowerSaveFrame = 0;
    constructor() {
      this.canvas = document.getElementById("island-canvas");
      this.ctx = this.canvas.getContext("2d", { alpha: true });
      this.mascot = new RoboMascot();
      this.initCanvasSize();
      this.initDomOverlay();
      this.setupEvents();
      this.loadInitialData();
      requestAnimationFrame(this.renderLoop.bind(this));
    }
    initCanvasSize() {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
      this.ctx.scale(dpr, dpr);
    }
    async loadInitialData() {
      if (!window.roboIsland) return;
      try {
        this.config = await window.roboIsland.getConfig();
        if (this.config.mascotSkin) this.mascot.setSkin(this.config.mascotSkin);
        if (this.config.mascotHat) this.mascot.setHat(this.config.mascotHat);
        if (this.config.mascotOutfit) this.mascot.setOutfit(this.config.mascotOutfit);
        if (this.config.mascotBodyColor) this.mascot.setBodyColor(this.config.mascotBodyColor);
        if (this.config.mascotEyeColor) this.mascot.setEyeColor(this.config.mascotEyeColor);
        if (this.config.mascotMood) this.setMascotMood(this.config.mascotMood);
        if (this.config.language && window.roboIslandI18n) window.roboIslandI18n.setLocale(this.config.language);
        if (this.config.textureSkin) TextureEngine.getInstance().style = this.config.textureSkin;
        else if (this.config.visualTexture) TextureEngine.getInstance().style = this.config.visualTexture;
        if (this.config.soundPack) AudioSynth.getInstance().soundPack = this.config.soundPack;
        if (typeof this.config.soundEnabled === "boolean") AudioSynth.getInstance().enabled = this.config.soundEnabled;
      } catch {
      }
      try {
        const state = await window.roboIsland.getMediaState();
        if (state) this.handleMediaStateUpdate(state);
      } catch {
      }
      try {
        const vol = await window.roboIsland.getVolume();
        if (vol && typeof vol.level === "number" && vol.level >= 0) {
          this.volumeState = vol;
          this.volumeHudLevel = vol.level;
          this.volumeHudMuted = Boolean(vol.muted);
          this.isVolumeInitialized = true;
        }
      } catch {
      }
      try {
        const net = await window.roboIsland.getNetwork();
        if (net) {
          if (net.wifi) {
            this.netState.wifiOn = net.wifi.on !== false;
            this.netState.ssid = net.wifi.ssid || (this.netState.wifiOn ? "Connected" : "Off");
            this.netState.bars = net.wifi.bars || 4;
          }
          if (net.bt) {
            this.netState.btOn = net.bt.on === true;
            this.netState.btDevice = net.bt.devices && net.bt.devices[0] ? net.bt.devices[0] : this.netState.btOn ? "Active" : "Off";
          }
          this.updateNetworkDom();
        }
      } catch {
      }
      try {
        if (window.roboIsland?.getSystemMetrics) {
          const m = await window.roboIsland.getSystemMetrics();
          if (m) {
            this.metricsState = m;
            if (typeof m.cpu === "number") this.config.lastCpuPercent = m.cpu;
            if (typeof m.ram === "number") this.config.lastRamPercent = m.ram;
          }
        }
      } catch {
      }
      if ("getBattery" in navigator) {
        try {
          const b = await navigator.getBattery();
          this.batteryState.level = Math.round(b.level * 100);
          this.batteryState.charging = b.charging;
          this._updatePowerSavingMode(b);
          b.addEventListener("levelchange", () => {
            this.batteryState.level = Math.round(b.level * 100);
            this._updatePowerSavingMode(b);
          });
          b.addEventListener("chargingchange", () => {
            const wasCharging = this.batteryState.charging;
            this.batteryState.charging = b.charging;
            this._updatePowerSavingMode(b);
            if (wasCharging !== b.charging) {
              this.triggerChargerSurge(b.charging, Math.round(b.level * 100));
            }
          });
        } catch {
        }
      }
      this.fetchWeather();
      setInterval(() => this.fetchWeather(), 15 * 60 * 1e3);
      setTimeout(() => {
        this.startHello();
      }, 280);
    }
    async fetchWeather() {
      try {
        if (window.roboIsland && typeof window.roboIsland.getWeatherData === "function") {
          const data = await window.roboIsland.getWeatherData();
          if (data && typeof data.temperature === "number") {
            this.weatherState.temp = `${Math.round(data.temperature)}\xB0C`;
            this.weatherState.condition = data.condition || "Clear";
            return;
          }
        }
        const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=28.61&longitude=77.23&current=temperature_2m,weather_code", {
          signal: AbortSignal.timeout(4e3)
        });
        if (res.ok) {
          const json = await res.json();
          if (json.current) {
            const t = Math.round(json.current.temperature_2m);
            this.weatherState.temp = `${t}\xB0C`;
            this.weatherState.condition = "Clear";
          }
        }
      } catch {
      }
    }
    setupEvents() {
      window.addEventListener("resize", () => this.initCanvasSize());
      let dragStart = null;
      let swallowClick = false;
      window.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        const cx = window.innerWidth / 2;
        const topY = this.getTopY();
        const effectiveW = this.mode === "expanded" ? Math.max(this.targetWidth, this.currentWidth) : this.currentWidth;
        const effectiveH = this.mode === "expanded" ? Math.max(this.targetHeight, this.currentHeight) : this.currentHeight;
        const inIsland = Math.abs(e.clientX - cx) <= effectiveW / 2 && e.clientY >= topY && e.clientY <= topY + effectiveH;
        const onEyes = (this.mode === "compact" || this.mode === "rest") && Math.abs(e.clientX - cx) <= 32 && e.clientY >= topY && e.clientY <= topY + effectiveH;
        if (inIsland) {
          dragStart = { x: e.clientX, y: e.clientY, time: performance.now(), onEyes };
        }
        if (performance.now() < this.volumeHudUntil) {
          const trackLeft = cx - this.currentWidth / 2 + 52;
          const trackRight = cx + this.currentWidth / 2 - 52;
          const trackW = Math.max(20, trackRight - trackLeft);
          const midY = topY + this.currentHeight / 2;
          if (e.clientX >= trackLeft - 8 && e.clientX <= trackRight + 8 && Math.abs(e.clientY - midY) <= 14) {
            this.isScrubbingVolumeHud = true;
            swallowClick = true;
            const clampedX = Math.max(trackLeft, Math.min(trackRight, e.clientX));
            const pct = Math.round((clampedX - trackLeft) / trackW * 100);
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
      window.addEventListener("mousemove", (e) => {
        this.pointerX = e.clientX;
        this.pointerY = e.clientY;
        this.mascot.resetInactivity();
        this.checkHitTest();
        if (this.isScrubbingVolumeHud) {
          const cx = window.innerWidth / 2;
          const trackLeft = cx - this.currentWidth / 2 + 52;
          const trackRight = cx + this.currentWidth / 2 - 52;
          const trackW = Math.max(20, trackRight - trackLeft);
          const clampedX = Math.max(trackLeft, Math.min(trackRight, e.clientX));
          const pct = Math.round((clampedX - trackLeft) / trackW * 100);
          this.volumeHudLevel = pct;
          this.volumeHudMuted = false;
          this.volumeHudUntil = performance.now() + 2200;
          if (window.roboIsland?.setVolume) {
            window.roboIsland.setVolume(pct);
          }
          return;
        }
        if (dragStart && dragStart.onEyes && !this.isBuddyOut) {
          const dy = e.clientY - dragStart.y;
          if (dy > 16) {
            dragStart = null;
            swallowClick = true;
            this.isBuddyOut = true;
            const api = window.roboIsland;
            api?.buddyGrab?.();
            try {
              AudioSynth.getInstance().playMelody("pop");
            } catch {
            }
          }
        }
      });
      window.addEventListener("mouseup", (e) => {
        if (this.isScrubbingVolumeHud) {
          this.isScrubbingVolumeHud = false;
          swallowClick = true;
        }
        if (!dragStart) return;
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        const isMusicActive = Boolean(this.mediaState.playing || this.mediaState.title && this.mode === "compact");
        if (Math.abs(dx) > 48 && Math.abs(dy) < 36 && isMusicActive) {
          swallowClick = true;
          const api = window.roboIsland;
          if (dx < 0) {
            api?.mediaNext?.();
          } else {
            api?.mediaPrev?.();
          }
          try {
            AudioSynth.getInstance().playMelody("pop");
          } catch {
          }
        }
        dragStart = null;
      });
      window.addEventListener("wheel", (e) => {
        const isMusicActive = Boolean(this.mediaState.playing || this.mediaState.title && this.mode === "compact");
        const cx = window.innerWidth / 2;
        const inIsland = Math.abs(e.clientX - cx) <= this.currentWidth / 2 && e.clientY <= this.currentHeight + 10;
        if (inIsland && isMusicActive && Math.abs(e.deltaX) > 60 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          const api = window.roboIsland;
          if (e.deltaX > 0) {
            api?.mediaNext?.();
          } else {
            api?.mediaPrev?.();
          }
          try {
            AudioSynth.getInstance().playMelody("pop");
          } catch {
          }
        }
      }, { passive: true });
      const islandApi = window.roboIsland;
      if (islandApi?.onBuddyHome) {
        islandApi.onBuddyHome(() => {
          this.isBuddyOut = false;
          try {
            AudioSynth.getInstance().playMelody("done");
          } catch {
          }
        });
      }
      if (islandApi?.onFocusDistraction) {
        islandApi.onFocusDistraction((data) => {
          this.triggerMindfulDistractionPause(data);
        });
      }
      window.addEventListener("mouseenter", () => {
        this.mascot.resetInactivity();
      });
      window.addEventListener("mouseleave", () => {
        this.pointerX = -1e3;
        this.pointerY = -1e3;
        this.checkHitTest();
      });
      window.addEventListener("click", (e) => {
        if (swallowClick) {
          swallowClick = false;
          e.stopPropagation();
          return;
        }
        this.mascot.resetInactivity();
        const ctxMenu = document.getElementById("island-context-menu");
        if (ctxMenu && !ctxMenu.classList.contains("hidden")) {
          ctxMenu.classList.add("hidden");
        }
        if (this.activePopover !== "none") {
          const popover = document.getElementById("system-popover");
          const btnWifi = document.getElementById("btn-status-wifi");
          const btnBt = document.getElementById("btn-status-bt");
          const btnGroup = document.getElementById("btn-system-popover");
          const targetNode = e.target && e.target instanceof Node ? e.target : null;
          const clickedInside = targetNode ? Boolean(popover?.contains(targetNode)) || Boolean(btnWifi?.contains(targetNode)) || Boolean(btnBt?.contains(targetNode)) || Boolean(btnGroup?.contains(targetNode)) : false;
          if (!clickedInside) {
            this.setPopover("none");
          }
        }
        this.handleClick(e.clientX, e.clientY, e.altKey);
      });
      window.addEventListener("contextmenu", (e) => {
        if (e.target?.closest?.('input, textarea, [contenteditable="true"]')) return;
        const cx = window.innerWidth / 2;
        const topY = this.getTopY();
        const effectiveW = this.mode === "expanded" ? Math.max(this.targetWidth, this.currentWidth) : this.currentWidth;
        const effectiveH = this.mode === "expanded" ? Math.max(this.targetHeight, this.currentHeight) : this.currentHeight;
        const halfW = effectiveW / 2;
        const insideIsland = e.clientX >= cx - halfW - 14 && e.clientX <= cx + halfW + 14 && e.clientY >= 0 && e.clientY <= topY + effectiveH + 14;
        if (insideIsland) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (e.shiftKey) {
            this.showContextMenu(e.clientX, e.clientY);
          } else {
            this.setTucked(true);
            try {
              AudioSynth.getInstance().playMelody("pop");
            } catch {
            }
            if (window.roboIsland?.setTucked) {
              window.roboIsland.setTucked(true);
            } else if (window.roboIsland?.toggleTuck) {
              window.roboIsland.toggleTuck();
            }
          }
        }
      }, true);
      window.addEventListener("keydown", (e) => {
        const activeTag = (document.activeElement?.tagName || "").toLowerCase();
        if (activeTag === "input" || activeTag === "textarea") return;
        if (e.key === " " || e.code === "Space") {
          if (this.isQuickLookOpen) {
            e.preventDefault();
            this.closeQuickLook();
            return;
          }
          if ((this.activeTab === "tray" || this.currentDomTab === "tray") && this.latestTrayFiles.length > 0) {
            e.preventDefault();
            const target = this.latestTrayFiles.find((f) => f.isActive) || this.latestTrayFiles[0];
            if (target && target.path) {
              this.openQuickLook(target.path);
            }
            return;
          }
        }
        if (e.key === "Escape") {
          if (this.isQuickLookOpen) {
            this.closeQuickLook();
            return;
          }
          if (this.activePopover !== "none") {
            this.setPopover("none");
            return;
          }
          const ctxMenu = document.getElementById("island-context-menu");
          if (ctxMenu && !ctxMenu.classList.contains("hidden")) {
            ctxMenu.classList.add("hidden");
            return;
          }
          if (this.mode === "expanded") {
            this.collapse();
          }
        }
      });
      if (window.roboIsland) {
        if (window.roboIsland.onPointer) {
          window.roboIsland.onPointer((pt) => {
            this.pointerX = pt.x;
            this.pointerY = pt.y;
            this.checkHitTest();
          });
        }
        window.roboIsland.onToggleExpand(() => this.toggleExpand());
        if (window.roboIsland.onCollapseRequested) {
          window.roboIsland.onCollapseRequested(() => {
            if (this.mode === "expanded" && this.canAutoCollapse()) {
              this.collapse();
            }
          });
        }
        if (window.roboIsland.onCollapse) {
          window.roboIsland.onCollapse(() => {
            if (this.mode === "expanded") {
              this.collapse();
            }
          });
        }
        window.roboIsland.onConfigUpdated((cfg) => {
          this.config = cfg;
          if (cfg.mascotSkin) this.mascot.setSkin(cfg.mascotSkin);
          if (cfg.mascotHat) this.mascot.setHat(cfg.mascotHat);
          if (cfg.mascotOutfit) this.mascot.setOutfit(cfg.mascotOutfit);
          if (cfg.mascotBodyColor) this.mascot.setBodyColor(cfg.mascotBodyColor);
          if (cfg.mascotEyeColor) this.mascot.setEyeColor(cfg.mascotEyeColor);
          if (cfg.mascotMood) this.setMascotMood(cfg.mascotMood);
          if (cfg.textureSkin) TextureEngine.getInstance().style = cfg.textureSkin;
          else if (cfg.visualTexture) TextureEngine.getInstance().style = cfg.visualTexture;
          if (cfg.soundPack) AudioSynth.getInstance().soundPack = cfg.soundPack;
          if (typeof cfg.soundEnabled === "boolean") AudioSynth.getInstance().enabled = cfg.soundEnabled;
          if (cfg.language && window.roboIslandI18n) window.roboIslandI18n.setLocale(cfg.language);
        });
        window.roboIsland.onMediaStateChanged((state) => this.handleMediaStateUpdate(state));
        window.roboIsland.onVolumeChanged((vol) => {
          const isWarmup = performance.now() - this.engineStartTime < 4e3;
          if (!this.isVolumeInitialized || isWarmup) {
            this.isVolumeInitialized = true;
            this.volumeState = vol;
            if (vol && typeof vol.level === "number" && vol.level >= 0) {
              this.volumeHudLevel = vol.level;
              this.volumeHudMuted = Boolean(vol.muted);
            }
            return;
          }
          const prevLevel = this.volumeHudLevel;
          const prevMuted = this.volumeHudMuted;
          this.volumeState = vol;
          if (vol && typeof vol.level === "number") {
            const changed = prevLevel !== vol.level || prevMuted !== Boolean(vol.muted);
            if (changed) {
              this.triggerVolumeHud(vol.level, Boolean(vol.muted));
            }
          }
        });
        window.roboIsland.onNetworkChanged((net) => {
          if (net) {
            if (net.wifi) {
              this.netState.wifiOn = net.wifi.on !== false;
              this.netState.ssid = net.wifi.ssid || (this.netState.wifiOn ? "Connected" : "Off");
              this.netState.bars = net.wifi.bars || 4;
            }
            if (net.bt) {
              this.netState.btOn = net.bt.on === true;
              this.netState.btDevice = net.bt.devices && net.bt.devices[0] ? net.bt.devices[0] : this.netState.btOn ? "Active" : "Off";
            }
            this.updateNetworkDom();
          }
        });
        window.roboIsland.onAiStateChanged((state) => {
          const prevStatus = this.aiState.status;
          this.aiState = state;
          if (state.status === "question" && state.pendingPermission) {
            this.triggerNotification({
              id: "ai-perm-" + Date.now(),
              title: state.pendingPermission.tool || "Permission Required",
              body: state.pendingPermission.description || "Claude needs your authorization.",
              kind: "question",
              sessionId: state.pendingPermission.sessionId,
              actions: [
                { id: "deny", label: "Deny", primary: false },
                { id: "allow", label: "Allow", primary: true }
              ]
            });
          } else if (state.status === "done" && prevStatus !== "done") {
            this.triggerNotification({
              id: "ai-done-" + Date.now(),
              title: "Task Completed",
              body: state.currentTool || "Claude Code finished task",
              kind: "done",
              durationMs: 3500
            });
            this.mascot.setMood("happy", 3500);
          } else if (state.status === "error" && prevStatus !== "error") {
            this.triggerNotification({
              id: "ai-error-" + Date.now(),
              title: "Task Error",
              body: state.currentTool || "Error occurred during execution",
              kind: "error",
              durationMs: 4e3
            });
            this.mascot.setMood("dizzy", 4e3);
          } else if (state.status === "running") {
            this.mascot.setMood("focused");
          } else if (state.status === "ready" || state.status === "idle" || !state.status) {
            if (this.mascot.getMood() === "focused") {
              this.mascot.setMood("neutral");
            }
          }
          this.updateTargetDimensions();
        });
        if (window.roboIsland.onNotification) {
          window.roboIsland.onNotification((payload) => {
            if (payload && payload.title) {
              this.triggerNotification(payload);
            }
          });
        }
        if (window.roboIsland.onMascotMood) {
          window.roboIsland.onMascotMood((mood) => this.setMascotMood(mood));
        }
        if (window.roboIsland.onMascotSpeak) {
          window.roboIsland.onMascotSpeak((text, duration) => this.mascotSpeak(text, duration));
        }
        if (window.roboIsland.onMascotJump) {
          window.roboIsland.onMascotJump(() => this.mascotJump());
        }
        if (window.roboIsland.onModeChanged) {
          window.roboIsland.onModeChanged((mode) => {
            this.setMode(mode);
          });
        }
        if (window.roboIsland.onTuckedState) {
          window.roboIsland.onTuckedState((tucked) => {
            this.setTucked(tucked);
          });
        }
        if (window.roboIsland.onWeatherUpdated) {
          window.roboIsland.onWeatherUpdated((data) => {
            if (data && typeof data.temperature === "number") {
              this.weatherState.temp = `${Math.round(data.temperature)}\xB0C`;
              this.weatherState.condition = data.condition || "Clear";
            }
          });
        }
        if (window.roboIsland.onGameModeChanged) {
          window.roboIsland.onGameModeChanged((state) => {
            this.isGameModeThrottled = Boolean(state && state.inGame && !state.override);
          });
        }
        if (window.roboIsland.onBatteryStateChanged) {
          window.roboIsland.onBatteryStateChanged((data) => {
            if (data && typeof data.charging === "boolean") {
              const wasCharging = this.batteryState.charging;
              this.batteryState.charging = data.charging;
              if (typeof data.level === "number") this.batteryState.level = data.level;
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
          window.roboIsland.onMetricsChanged((m) => {
            if (m) {
              this.metricsState = m;
              if (typeof m.cpu === "number") this.config.lastCpuPercent = m.cpu;
              if (typeof m.ram === "number") this.config.lastRamPercent = m.ram;
            }
          });
        }
      }
      if (typeof window !== "undefined") {
        window.__roboIslandSetMode = (mode) => this.setMode(mode);
        window.__roboIslandGetMode = () => this.getMode();
        window.__roboIslandSetMascotMood = (mood) => this.setMascotMood(mood);
        window.__roboIslandGetMascotMood = () => this.getMascotMood();
        window.__roboIslandMascotJump = (strength) => this.mascotJump(strength);
        window.__roboIslandMascotBounce = (strength) => this.mascotBounce(strength);
        window.__roboIslandMascotSpeak = (text, duration) => this.mascotSpeak(text, duration);
        window.__roboIslandTriggerChargerSurge = (charging, level) => this.triggerChargerSurge(charging, level);
        window.__roboIslandTriggerVolumeHud = (level, muted) => this.triggerVolumeHud(level, Boolean(muted));
        window.__roboIslandTriggerSpeedometerHud = () => this.triggerSpeedometerHud();
        window.__roboIslandTriggerNotification = (n) => this.triggerNotification(n);
        window.__roboIslandClearNotification = () => this.clearNotification();
      }
      let wasFocusActive = false;
      setInterval(() => {
        const f = window.__roboFocus || window.__twocodeFocus;
        if (f) {
          const isActive = Boolean(f.active());
          if (isActive) {
            this.focusState.active = true;
            this.focusState.remainingSeconds = Math.ceil(f.left() / 1e3);
            this.focusState.totalSeconds = Math.ceil(f.length() / 1e3);
          } else {
            if (wasFocusActive && f.left() <= 0) {
              AudioSynth.getInstance().play("done");
              this.mascot.sounds.playSuccess();
              this.mascot.jump();
              this.triggerNotification({
                id: "focus-complete-" + Date.now(),
                title: "Focus Session Complete!",
                body: "Take a mindful 5-minute break.",
                kind: "done",
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
                id: "focus-complete-" + Date.now(),
                title: "Focus Session Complete!",
                body: "Take a mindful 5-minute break.",
                kind: "done",
                durationMs: 4500
              });
            }
          }
        }
      }, 1e3);
    }
    extractAlbumColor(url) {
      if (!url || url === this.lastCoverUrl) {
        if (!url) {
          this.albumImageElement = null;
          this.albumAccentColor = "#1ed760";
          this.targetTintR = 30;
          this.targetTintG = 215;
          this.targetTintB = 96;
        }
        return;
      }
      this.lastCoverUrl = url;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = 12;
          c.height = 12;
          const x = c.getContext("2d");
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
          this.albumAccentColor = "#1ed760";
          this.targetTintR = 30;
          this.targetTintG = 215;
          this.targetTintB = 96;
        }
      };
      img.onerror = () => {
        this.albumImageElement = null;
        this.albumAccentColor = "#1ed760";
        this.targetTintR = 30;
        this.targetTintG = 215;
        this.targetTintB = 96;
      };
      img.src = url;
    }
    handleMediaStateUpdate(state) {
      const isSongChanged = state.title !== this.mediaState.title;
      this.mediaState = {
        ...this.mediaState,
        ...state
      };
      this.basePositionMs = state.positionMs || 0;
      this.lastMediaSampleTime = performance.now();
      const cover = state.coverUrl || state.albumArtUrl || "";
      if (cover) {
        this.extractAlbumColor(cover);
      } else if (state.title && !cover) {
        this.extractAlbumColor("");
      }
      this.mascot.isDancing = Boolean(state.playing && state.active);
      if (state.playing && state.active) {
        this.mascot.setMood("excited");
      } else if (this.mascot.mood === "excited") {
        this.mascot.setMood("neutral");
      }
      if (isSongChanged && state.active && state.title) {
        this.syncedLyrics = [];
        this.lyricsIndex = -1;
        this.lyricsGap = false;
        this.lyricsPrevious = null;
        this.lyricsWidest = 0;
        this.mediaState.lyricLine = "";
        window.roboIsland?.getLyrics({
          title: state.title,
          artist: state.artist,
          duration: state.durationMs
        }).then((res) => {
          if (res && res.lines && res.lines.length > 0) {
            this.syncedLyrics = res.lines;
            this.ctx.save();
            this.ctx.font = this.LYRICS_FONT;
            this.lyricsWidest = res.lines.reduce((max, l) => {
              return Math.max(max, l.text ? this.ctx.measureText(l.text).width : 0);
            }, 0);
            this.ctx.restore();
            this.updateTargetDimensions();
          }
        }).catch(() => {
        });
      }
      this.updateTargetDimensions();
    }
    updateTargetDimensions() {
      if (this.isTucked) {
        this.targetWidth = this.isHovered ? 72 : 56;
        this.targetHeight = 4;
        this.targetRadius = 2;
        return;
      }
      if (this.mode === "expanded") {
        this.targetWidth = 520;
        const tab = this.currentDomTab || "home";
        const isMusicWithLyrics = (tab === "music" || this.activeTab === "media") && this.hasSyncedLyrics();
        switch (tab) {
          case "music":
            this.targetHeight = isMusicWithLyrics ? 340 : 280;
            break;
          case "chat":
            this.targetHeight = 320;
            break;
          case "ai":
            this.targetHeight = 310;
            break;
          case "tray":
          case "clipboard":
          case "notes":
            this.targetHeight = 270;
            break;
          case "settings":
            this.targetHeight = 300;
            break;
          case "focus":
            this.targetHeight = 270;
            break;
          case "home":
          default:
            this.targetHeight = 240;
            break;
        }
        this.targetRadius = 32;
        return;
      }
      if (this.isNotificationActive()) {
        const n = this.activeNotification;
        const hasActions = Boolean(n.actions && n.actions.length > 0);
        this.targetWidth = hasActions ? 430 : Math.max(260, Math.min(390, 90 + n.title.length * 8.5));
        this.targetHeight = 36;
        this.targetRadius = 18;
        return;
      }
      if (this.mode === "rest") {
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
        const cfgW = this.config && this.config.restCapsuleWidth || 32;
        const cfgH = this.config && this.config.restCapsuleHeight || 18;
        this.targetWidth = this.isHovered ? cfgW + 6 : cfgW;
        this.targetHeight = cfgH;
        this.targetRadius = Math.round(cfgH / 2);
        return;
      }
      if (this.mode === "compact" && performance.now() < this.airdropHudUntil) {
        this.targetWidth = this.isHovered ? 350 : 340;
        this.targetHeight = 44;
        this.targetRadius = 22;
      } else if (this.mode === "compact" && performance.now() < this.speedometerHudUntil) {
        this.targetWidth = this.isHovered ? 370 : 360;
        this.targetHeight = 44;
        this.targetRadius = 22;
      } else if (this.mode === "compact" && performance.now() < this.volumeHudUntil) {
        this.targetWidth = this.isHovered ? 280 : 270;
        this.targetHeight = 36;
        this.targetRadius = 18;
      } else if (this.mode === "compact" && performance.now() < this.chargerSurgeUntil) {
        this.targetWidth = this.isHovered ? 190 : 180;
        this.targetHeight = 36;
        this.targetRadius = 18;
      } else if (this.aiState.status === "running") {
        this.targetWidth = this.isHovered ? 300 : 280;
        this.targetHeight = 36;
        this.targetRadius = 18;
      } else if (this.focusState.active) {
        const isDualActive = Boolean(this.mediaState.playing || this.mediaState.active && this.mediaState.title);
        if (isDualActive) {
          const hasLyrics = this.hasSyncedLyrics();
          const baseWidth = hasLyrics ? Math.round(Math.max(280, Math.min(380, (this.lyricsWidest || 140) + 106))) : 250;
          this.targetWidth = this.isHovered ? baseWidth + 8 : baseWidth;
          this.targetHeight = 36;
          this.targetRadius = 18;
        } else {
          this.targetWidth = this.isHovered ? 258 : 250;
          this.targetHeight = 36;
          this.targetRadius = 18;
        }
      } else if (this.mediaState.active && this.mediaState.title) {
        const hasLyrics = this.hasSyncedLyrics();
        const baseWidth = hasLyrics ? Math.round(Math.max(280, Math.min(380, (this.lyricsWidest || 140) + 106))) : 250;
        this.targetWidth = this.isHovered ? baseWidth + 8 : baseWidth;
        this.targetHeight = 36;
        this.targetRadius = 16;
      } else {
        const hasTelemetry = this.config?.restLeft && this.config.restLeft !== "none" || this.config?.restRight && this.config.restRight !== "none";
        const baseW = hasTelemetry ? this.calculateRestWidth() : 98;
        this.targetWidth = this.isHovered ? baseW + 6 : baseW;
        this.targetHeight = 26;
        this.targetRadius = 13;
      }
    }
    canAutoCollapse() {
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || active.isContentEditable)) {
        return false;
      }
      const chatInput = document.getElementById("chat-input");
      if (chatInput && (chatInput === document.activeElement || chatInput.value.trim().length > 0)) {
        return false;
      }
      const islandInput = document.getElementById("island-input");
      if (islandInput && (islandInput === document.activeElement || islandInput.value.trim().length > 0)) {
        return false;
      }
      if (this.activePopover !== "none") {
        return false;
      }
      const popover = document.getElementById("system-popover");
      if (popover && !popover.classList.contains("hidden") && popover.style.display !== "none") {
        return false;
      }
      const ctxMenu = document.getElementById("island-context-menu");
      if (ctxMenu && !ctxMenu.classList.contains("hidden") && ctxMenu.style.display !== "none") {
        return false;
      }
      const quicklook = document.getElementById("quicklook-modal");
      if (quicklook && !quicklook.classList.contains("hidden") && quicklook.style.display !== "none") {
        return false;
      }
      const guardModal = document.getElementById("focus-guard-modal");
      if (guardModal && !guardModal.classList.contains("hidden") && guardModal.style.display !== "none") {
        return false;
      }
      if (window.isMediaInteracting || window.isMediaScrubbing || window.isMediaVolumeDragging || this.isScrubbingVolumeHud) {
        return false;
      }
      const scrubBar = document.getElementById("media-scrub-bar");
      if (scrubBar && (scrubBar.classList.contains("active") || scrubBar.getAttribute("data-scrubbing") === "true")) {
        return false;
      }
      const volSlider = document.getElementById("media-vol-slider");
      if (volSlider && (volSlider === document.activeElement || volSlider.matches(":active"))) {
        return false;
      }
      if (this.isDraggingOver || window.isDraggingFiles) {
        return false;
      }
      const dropOverlay = document.getElementById("drag-drop-overlay");
      if (dropOverlay && !dropOverlay.classList.contains("hidden") && dropOverlay.style.display !== "none") {
        return false;
      }
      const selection = window.getSelection ? window.getSelection() : null;
      if (selection && selection.toString().trim().length > 0) {
        return false;
      }
      const protectedSelectors = [
        "#ai-diff-viewer:hover",
        ".ai-diff-content:hover",
        "#ai-task-feed:hover",
        "#tray-files-shelf:hover",
        ".tray-shelf:hover",
        ".tray-file-chip:hover",
        ".tray-chip:hover",
        "#clipboard-list:hover",
        ".clipboard-item:hover",
        "#chat-messages:hover"
      ];
      for (const selector of protectedSelectors) {
        try {
          if (document.querySelector(selector)) {
            return false;
          }
        } catch {
        }
      }
      if (document.body && document.body.classList.contains("interacting-internal")) {
        return false;
      }
      return true;
    }
    /**
     * TwoCode Bezel Docking:
     * When in notch mode (default), topY = 0 (flush against top bezel).
     * When floating mode is selected in settings, topY = 6.
     */
    getTopY() {
      if (this.isTucked) return this.isHovered ? 2 : 0;
      return this.config?.islandStyle === "floating" ? 6 : 0;
    }
    /**
     * TwoCode MacBook Notch Path (mascot.html lines 1145-1172):
     * Hangs from top edge of the screen with two smooth inward curves ("ears").
     */
    islandPath(ctx, x, y, width, height, radius) {
      const isFloating = this.config?.islandStyle === "floating";
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
    tickLyrics() {
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
      let g = false;
      if (i >= 0) {
        const since = pos - this.syncedLyrics[i].timeMs;
        const next = this.syncedLyrics[i + 1];
        g = next ? next.timeMs - this.syncedLyrics[i].timeMs > 14e3 && since > 9e3 : since > 8e3;
      }
      if (i !== this.lyricsIndex || g !== this.lyricsGap) {
        this.lyricsPrevious = this.getCurrentLyricText();
        this.lyricsIndex = i;
        this.lyricsGap = g;
        this.lyricsChangedAt = performance.now();
      }
      this.mediaState.lyricLine = this.getCurrentLyricText() || "";
    }
    getCurrentLyricText() {
      if (this.lyricsGap || this.lyricsIndex < 0 || this.lyricsIndex >= this.syncedLyrics.length) {
        return null;
      }
      const l = this.syncedLyrics[this.lyricsIndex];
      return l && l.text ? l.text : null;
    }
    getLyricNow() {
      if (!this.syncedLyrics.length) return null;
      const rawK = Math.min(1, (performance.now() - this.lyricsChangedAt) / this.LYRICS_SWAP);
      const k = 1 - Math.pow(1 - rawK, 4);
      return {
        text: this.getCurrentLyricText(),
        previous: rawK < 1 ? this.lyricsPrevious : null,
        k,
        font: this.LYRICS_FONT
      };
    }
    hasSyncedLyrics() {
      return Boolean(this.syncedLyrics.length > 0 && this.mediaState.playing && !this.isTucked);
    }
    checkHitTest() {
      const cx = window.innerWidth / 2;
      const topY = this.getTopY();
      const effectiveW = this.mode === "expanded" ? Math.max(this.targetWidth, this.currentWidth) : this.currentWidth;
      const effectiveH = this.mode === "expanded" ? Math.max(this.targetHeight, this.currentHeight) : this.currentHeight;
      const halfW = effectiveW / 2;
      let inBounds = false;
      if (this.isTucked) {
        const over = this.pointerX >= cx - 80 && this.pointerX <= cx + 80 && this.pointerY >= 0 && this.pointerY <= 10;
        if (!over) {
          this.tuckArmed = true;
        }
        if (over && this.tuckArmed) {
          if (!this.tuckHoverStartTime) {
            this.tuckHoverStartTime = performance.now();
          } else if (performance.now() - this.tuckHoverStartTime > 450) {
            this.tuckHoverStartTime = 0;
            this.setTucked(false);
            try {
              AudioSynth.getInstance().playMelody("pop");
            } catch {
            }
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
        const shouldBeInteractive2 = over;
        if (shouldBeInteractive2 !== this.isInteractive) {
          this.isInteractive = shouldBeInteractive2;
          if (window.roboIsland) {
            window.roboIsland.setInteractive(shouldBeInteractive2);
          }
        }
        return;
      }
      if (this.mode === "rest") {
        const restHalfW = Math.max(halfW, 18);
        const restH = Math.max(effectiveH, 18);
        inBounds = this.pointerX >= cx - restHalfW && this.pointerX <= cx + restHalfW && this.pointerY >= topY && this.pointerY <= topY + restH;
      } else if (this.isSplitIslandActive()) {
        const bubbleSize = this.currentHeight;
        const totalSpan = this.currentWidth + 8 + bubbleSize;
        const pillLeft = cx - totalSpan / 2;
        inBounds = this.pointerX >= pillLeft - 6 && this.pointerX <= pillLeft + totalSpan + 6 && this.pointerY >= topY && this.pointerY <= topY + this.currentHeight;
      } else {
        const marginX = this.mode === "compact" ? 14 : 0;
        const marginY = this.mode === "compact" ? 6 : 0;
        inBounds = this.pointerX >= cx - halfW - marginX && this.pointerX <= cx + halfW + marginX && this.pointerY >= Math.max(0, topY - marginY) && this.pointerY <= topY + effectiveH + marginY;
      }
      if (inBounds !== this.isHovered) {
        this.isHovered = inBounds;
        this.updateTargetDimensions();
      }
      if (inBounds && this.mode === "rest") {
        this.restoreFromRest("compact");
        if (this.collapseTimer) {
          clearTimeout(this.collapseTimer);
          this.collapseTimer = null;
        }
        this.expand();
      } else if (inBounds && this.mode === "compact") {
        if (!(performance.now() < this.volumeHudUntil) && !(performance.now() < this.chargerSurgeUntil)) {
          if (this.collapseTimer) {
            clearTimeout(this.collapseTimer);
            this.collapseTimer = null;
          }
          this.expand();
        }
      } else if (!inBounds) {
        this.justRestoredFromRest = false;
        if (this.mode === "expanded" && this.canAutoCollapse()) {
          if (!this.collapseTimer) {
            this.collapseTimer = window.setTimeout(() => {
              this.collapseTimer = null;
              if (this.mode === "expanded" && !this.isHovered && this.canAutoCollapse()) {
                this.collapse();
              }
            }, 200);
          }
        }
      } else if (inBounds && this.collapseTimer) {
        clearTimeout(this.collapseTimer);
        this.collapseTimer = null;
      }
      const shouldBeInteractive = inBounds || this.mode === "expanded" || this.isDraggingOver;
      if (shouldBeInteractive !== this.isInteractive) {
        this.isInteractive = shouldBeInteractive;
        if (window.roboIsland) {
          window.roboIsland.setInteractive(shouldBeInteractive);
        }
      }
    }
    getMode() {
      return this.mode;
    }
    setMode(mode, playSound = true) {
      if (mode === "expanded") {
        this.expand();
      } else if (mode === "rest") {
        this.enterRest();
      } else {
        this.collapse(playSound);
      }
    }
    setMascotMood(mood) {
      this.mascot.setMood(mood);
    }
    getMascotMood() {
      return this.mascot.getMood();
    }
    mascotJump(strength) {
      this.mascot.jump(strength);
    }
    mascotBounce(strength) {
      this.mascot.bounce(strength);
    }
    mascotSpeak(text, duration) {
      this.mascot.speak(text, duration);
    }
    enterRest() {
      if (this.collapseTimer) {
        clearTimeout(this.collapseTimer);
        this.collapseTimer = null;
      }
      this.mode = "rest";
      this.mascot.setMood("sleepy");
      this.setPopover("none");
      if (this.domOverlayEl) this.domOverlayEl.classList.add("hidden");
      const ctxMenu = document.getElementById("island-context-menu");
      if (ctxMenu) ctxMenu.classList.add("hidden");
      this.updateTargetDimensions();
      if (window.roboIsland?.notifyModeChanged) {
        window.roboIsland.notifyModeChanged("rest");
      }
    }
    restoreFromRest(targetMode = "compact") {
      if (this.mode !== "rest") return;
      this.mode = targetMode;
      this.mascot.setMood("happy");
      this.mascot.jump(90);
      setTimeout(() => {
        if (this.mascot.mood === "happy") this.mascot.setMood("neutral");
      }, 1800);
      this.updateTargetDimensions();
      this.mascot.sounds.playChirp();
      if (window.roboIsland?.notifyModeChanged) {
        window.roboIsland.notifyModeChanged(targetMode);
      }
    }
    setTucked(tucked) {
      if (this.isTucked === Boolean(tucked)) return;
      this.isTucked = Boolean(tucked);
      this.tuckHoverStartTime = 0;
      this.tuckArmed = false;
      this.tuckChangedAt = performance.now();
      if (this.isTucked) {
        if (document.activeElement && document.activeElement !== document.body) {
          document.activeElement.blur();
        }
        try {
          this.setMode("rest");
        } catch {
        }
      } else {
        if (this.mode === "rest" && (!this.config || !this.config.restModeEnabled)) {
          try {
            this.setMode("compact", false);
          } catch {
          }
        }
      }
      this.updateTargetDimensions();
    }
    getTucked() {
      return this.isTucked;
    }
    toggleExpand() {
      if (this.mode === "expanded") {
        this.collapse();
      } else {
        this.expand();
      }
    }
    expand() {
      if (this.collapseTimer) {
        clearTimeout(this.collapseTimer);
        this.collapseTimer = null;
      }
      this.mode = "expanded";
      this.setPopover("none");
      this.updateTargetDimensions();
      this.mascot.sounds.playChirp();
      if (window.roboIsland) {
        window.roboIsland.setInteractive(true);
        if (window.roboIsland.notifyModeChanged) {
          window.roboIsland.notifyModeChanged("expanded");
        }
      }
    }
    collapse(playSound = true) {
      if (this.collapseTimer) {
        clearTimeout(this.collapseTimer);
        this.collapseTimer = null;
      }
      this.mode = "compact";
      this.isHovered = false;
      this.setPopover("none");
      this.updateTargetDimensions();
      if (playSound) {
        this.mascot.sounds.playChirp();
      }
      const ctxMenu = document.getElementById("island-context-menu");
      if (ctxMenu) ctxMenu.classList.add("hidden");
      if (window.roboIsland?.notifyModeChanged) {
        window.roboIsland.notifyModeChanged("compact");
      }
      if (window.roboIsland?.setInteractive) {
        window.roboIsland.setInteractive(false);
      }
    }
    triggerMindfulDistractionPause(data) {
      const modal = document.getElementById("focus-guard-modal");
      const titleEl = document.getElementById("guard-title");
      const ringEl = document.getElementById("guard-breath-ring");
      const wordEl = document.getElementById("guard-breath-word");
      const faceEl = document.getElementById("guard-face");
      const btnBack = document.getElementById("btn-guard-back");
      const btnAnyway = document.getElementById("btn-guard-anyway");
      if (!modal || !titleEl) return;
      if (this.mode !== "expanded") {
        this.setMode("expanded");
      }
      const appName = data?.item?.target || data?.windowTitle || "Distraction";
      titleEl.textContent = `You are opening ${appName}`;
      faceEl?.classList.remove("happy");
      modal.classList.remove("hidden");
      try {
        AudioSynth.getInstance().playMelody("warn");
      } catch {
      }
      if (ringEl && wordEl) {
        wordEl.textContent = "Breathe in";
        ringEl.classList.add("expand");
        setTimeout(() => {
          if (wordEl) wordEl.textContent = "Breathe out";
          if (ringEl) ringEl.classList.remove("expand");
        }, 2500);
      }
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
            btnAnyway.textContent = "Open anyway (5 min)";
          }
        }, 1e3);
        btnAnyway.onclick = async (e) => {
          e.stopPropagation();
          clearInterval(countTimer);
          modal.classList.add("hidden");
          const api = window.roboIsland;
          await api?.snoozeDistraction?.(5);
        };
      }
      if (btnBack) {
        btnBack.onclick = async (e) => {
          e.stopPropagation();
          faceEl?.classList.add("happy");
          try {
            AudioSynth.getInstance().playMelody("done");
          } catch {
          }
          setTimeout(() => {
            modal.classList.add("hidden");
            const api = window.roboIsland;
            api?.minimizeDistraction?.(data?.pid);
          }, 400);
        };
      }
    }
    handleClick(x, y, isAlt = false) {
      const cx = window.innerWidth / 2;
      const topY = this.getTopY();
      const effectiveW = this.mode === "expanded" ? Math.max(this.targetWidth, this.currentWidth) : this.currentWidth;
      const effectiveH = this.mode === "expanded" ? Math.max(this.targetHeight, this.currentHeight) : this.currentHeight;
      const halfW = effectiveW / 2;
      const inBounds = x >= cx - halfW && x <= cx + halfW && y >= topY && y <= topY + effectiveH;
      if (!inBounds && this.mode === "expanded") {
        if (this.canAutoCollapse()) {
          if (this.config && this.config.restModeEnabled) {
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
      if (this.isNotificationActive() && Object.keys(this.notificationHits).length > 0) {
        for (const [key, rect] of Object.entries(this.notificationHits)) {
          if (this.isInsideHit(x, y, rect)) {
            if (key === "cAllow") {
              const sid = this.activeNotification?.sessionId;
              if (sid && window.roboIsland?.aiApprove) {
                window.roboIsland.aiApprove(sid, true);
              }
              this.clearNotification();
              return;
            }
            if (key === "cDeny") {
              const sid = this.activeNotification?.sessionId;
              if (sid && window.roboIsland?.aiApprove) {
                window.roboIsland.aiApprove(sid, false);
              }
              this.clearNotification();
              return;
            }
            if (key === "cDismiss") {
              this.clearNotification();
              return;
            }
            if (key.startsWith("action_")) {
              this.clearNotification();
              return;
            }
          }
        }
        if (inBounds && (!this.activeNotification?.actions || this.activeNotification.actions.length === 0)) {
          this.clearNotification();
          return;
        }
        if (inBounds) {
          return;
        }
      }
      if (this.mode === "rest") {
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
        if (inBounds) {
          if (isAlt) {
            this.triggerSpeedometerHud();
            return;
          }
          this.restoreFromRest("compact");
        }
        return;
      }
      if (this.mode === "compact") {
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
        if (isAlt) {
          this.triggerSpeedometerHud();
          return;
        }
        if (performance.now() < this.volumeHudUntil) {
          const pillLeft = cx - this.currentWidth / 2;
          const midY = topY + this.currentHeight / 2;
          if (Math.hypot(x - (pillLeft + 26), y - midY) <= 16) {
            const nextMuted = !this.volumeHudMuted;
            this.volumeHudMuted = nextMuted;
            if (window.roboIsland?.setMute) {
              window.roboIsland.setMute(nextMuted);
            }
            this.triggerVolumeHud(this.volumeHudLevel, nextMuted);
            return;
          }
          const trackLeft = pillLeft + 52;
          const trackRight = pillLeft + this.currentWidth - 52;
          const trackW = Math.max(20, trackRight - trackLeft);
          if (x >= trackLeft - 6 && x <= trackRight + 6 && Math.abs(y - midY) <= 14) {
            const clampedX = Math.max(trackLeft, Math.min(trackRight, x));
            const pct = Math.round((clampedX - trackLeft) / trackW * 100);
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
          if (Math.hypot(x - bubbleCx, y - bubbleCy) <= bubbleR + 4) {
            this.activeTab = "focus";
            this.showDomTab("focus");
            this.expand();
            return;
          }
          if (x >= pillLeft && x <= pillLeft + this.currentWidth && y >= topY && y <= topY + this.currentHeight) {
            if (this.mediaState.active && this.mediaState.title) {
              this.activeTab = "media";
              this.showDomTab("music");
            }
            this.mascot.jump();
            this.expand();
            return;
          }
        }
        const isRestingCompact = !this.focusState.active && !(this.mediaState.active && this.mediaState.title) && this.aiState.status !== "running";
        if (isRestingCompact) {
          const leftItem = this.config?.restLeft && this.config.restLeft !== "none" ? this.config.restLeft : null;
          const rightItem = this.config?.restRight && this.config.restRight !== "none" ? this.config.restRight : null;
          const pillLeft = cx - this.currentWidth / 2;
          const pillRight = cx + this.currentWidth / 2;
          const isLeftClick = x >= pillLeft && x <= pillLeft + 54 && y >= topY && y <= topY + this.currentHeight;
          const isRightClick = x >= pillRight - 54 && x <= pillRight && y >= topY && y <= topY + this.currentHeight;
          const isTelemetryKind = (k) => k === "cpu" || k === "ram" || k === "storage" || k === "disk" || k === "battery";
          if (isLeftClick && isTelemetryKind(leftItem) || isRightClick && isTelemetryKind(rightItem)) {
            this.triggerSpeedometerHud();
            return;
          }
        }
        if (Math.abs(x - cx) <= this.currentWidth / 2 && y >= topY && y <= topY + this.currentHeight) {
          if (this.focusState.active && !(this.mediaState.active && this.mediaState.title)) {
            this.activeTab = "focus";
            this.showDomTab("focus");
          } else if (this.mediaState.active && this.mediaState.title) {
            this.activeTab = "media";
            this.showDomTab("music");
          } else {
            this.activeTab = "home";
            this.showDomTab("home");
          }
          this.mascot.jump();
          this.expand();
        }
        return;
      }
      if (this.mode === "expanded") {
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
      if (this.config.expandedUiMode === "canvas") {
        const pillLeft = cx - effectiveW / 2;
        if (Math.hypot(x - (pillLeft + 32), y - (topY + 28)) < 16) {
          if (window.roboIsland) window.roboIsland.openSettings();
          return;
        }
        if (Math.hypot(x - (pillLeft + effectiveW - 32), y - (topY + 28)) < 16) {
          this.collapse();
          return;
        }
        const tabsY = topY + 28;
        const tabs = [
          { id: "media", label: "Music", x: cx - 140 },
          { id: "home", label: "System", x: cx - 60 },
          { id: "ai", label: "AI", x: cx + 20 },
          { id: "tools", label: "Tools", x: cx + 90 },
          { id: "focus", label: "Focus", x: cx + 160 }
        ];
        for (const t of tabs) {
          if (Math.abs(x - t.x) < 32 && Math.abs(y - tabsY) < 14) {
            this.activeTab = t.id;
            this.mascot.sounds.playChirp();
            return;
          }
        }
        if (this.activeTab === "media") {
          this.handleMediaClick(x, y, cx, topY);
        } else if (this.activeTab === "home") {
          this.handleHomeClick(x, y, cx, topY);
        } else if (this.activeTab === "ai") {
          this.handleAiClick(x, y, cx, topY);
        } else if (this.activeTab === "focus") {
          this.handleFocusClick(x, y, cx, topY);
        }
      }
    }
    handleMediaClick(x, y, cx, topY) {
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
      if (this.isDevicesOpen) {
        const pw = 280;
        const list = this.spotifyDevices.slice(0, 4);
        const ph = 52 + Math.max(1, list.length) * 40;
        const px = right - pw;
        const py = Math.max(topY + 36, cy - 11 - ph - 8);
        if (Math.hypot(x - (px + pw - 22), y - (py + 28)) < 16) {
          this.isDevicesOpen = false;
          return;
        }
        for (let i = 0; i < list.length; i++) {
          const ry = py + 44 + i * 40;
          if (x >= px + 6 && x <= px + pw - 6 && y >= ry && y <= ry + 40) {
            const targetDev = list[i];
            if (window.roboIsland?.transferSpotifyPlayback && targetDev.id) {
              window.roboIsland.transferSpotifyPlayback(targetDev.id);
            }
            this.isDevicesOpen = false;
            try {
              AudioSynth.getInstance().playMelody("pop");
            } catch {
            }
            return;
          }
        }
        if (x < px || x > px + pw || y < py || y > py + ph) {
          this.isDevicesOpen = false;
        }
        return;
      }
      const devLabel = this.mediaState.source === "spotify" ? "Spotify" : "This PC";
      this.ctx.save();
      this.ctx.font = '600 11px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const dw = Math.min(130, this.ctx.measureText(devLabel).width + 34);
      this.ctx.restore();
      const dbx = right - dw;
      const dby = cy - 11;
      if (x >= dbx && x <= dbx + dw && y >= dby && y <= dby + 22) {
        this.isDevicesOpen = !this.isDevicesOpen;
        if (this.isDevicesOpen && window.roboIsland?.getSpotifyDevices) {
          window.roboIsland.getSpotifyDevices().then((res) => {
            this.spotifyDevices = res?.devices || [];
          }).catch(() => {
          });
        }
        try {
          AudioSynth.getInstance().playMelody("pop");
        } catch {
        }
        return;
      }
      if (x >= bx0 && x <= bx0 + bw && Math.abs(y - barY) <= 10) {
        const clickRatio = Math.max(0, Math.min(1, (x - bx0) / bw));
        const targetPosMs = clickRatio * (this.mediaState.durationMs || 18e4);
        this.mediaState.positionMs = targetPosMs;
        this.basePositionMs = targetPosMs;
        this.lastMediaSampleTime = performance.now();
        if (window.roboIsland) {
          window.roboIsland.mediaSeek(targetPosMs);
        }
        this.mascot.sounds.playChirp();
        return;
      }
      if (Math.hypot(x - (mid - 46), y - cy) < 18) {
        if (window.roboIsland) window.roboIsland.mediaPrev();
        this.mascot.sounds.playChirp();
        return;
      }
      if (Math.hypot(x - mid, y - cy) < 20) {
        const action = this.mediaState.playing ? "pause" : "play";
        this.mediaState.playing = !this.mediaState.playing;
        if (window.roboIsland) window.roboIsland.mediaControl(action);
        this.mascot.sounds.playChirp();
        return;
      }
      if (Math.hypot(x - (mid + 46), y - cy) < 18) {
        if (window.roboIsland) window.roboIsland.mediaNext();
        this.mascot.sounds.playChirp();
        return;
      }
    }
    handleHomeClick(x, y, cx, topY) {
      const volY = topY + 165;
      const volLeft = cx - 120;
      const volW = 240;
      if (Math.abs(y - volY) < 14 && x >= volLeft && x <= volLeft + volW) {
        const percent = Math.round(Math.max(0, Math.min(100, (x - volLeft) / volW * 100)));
        this.volumeState.level = percent;
        if (window.roboIsland) window.roboIsland.setVolume(percent);
        return;
      }
      if (Math.hypot(x - (cx - 140), y - volY) < 16) {
        this.volumeState.muted = !this.volumeState.muted;
        if (window.roboIsland) window.roboIsland.setMute(this.volumeState.muted);
        return;
      }
    }
    handleAiClick(x, y, cx, topY) {
      if (this.aiState.pendingPermission) {
        const btnY = topY + 185;
        if (Math.abs(x - (cx - 60)) < 45 && Math.abs(y - btnY) < 16) {
          window.roboIsland?.aiApprove(this.aiState.pendingPermission.sessionId, true);
          this.aiState.pendingPermission = null;
          this.mascot.sounds.playSuccess();
          return;
        }
        if (Math.abs(x - (cx + 60)) < 45 && Math.abs(y - btnY) < 16) {
          window.roboIsland?.aiApprove(this.aiState.pendingPermission.sessionId, false);
          this.aiState.pendingPermission = null;
          this.mascot.sounds.playAlert();
          return;
        }
      }
    }
    handleFocusClick(x, y, cx, topY) {
      const btnY = topY + 185;
      if (Math.abs(x - cx) < 65 && Math.abs(y - btnY) < 20) {
        this.focusState.active = !this.focusState.active;
        this.mascot.sounds.playChirp();
      }
    }
    renderLoop(time) {
      if (this.isGameModeThrottled) {
        requestAnimationFrame(this.renderLoop.bind(this));
        return;
      }
      if (this._isPowerSaving && this._powerSavingFrameInterval > 0) {
        if (time - this._lastPowerSaveFrame < this._powerSavingFrameInterval) {
          requestAnimationFrame(this.renderLoop.bind(this));
          return;
        }
        this._lastPowerSaveFrame = time;
      }
      const dt = Math.min(0.1, (time - this.lastTime) / 1e3);
      this.lastTime = time;
      const now = performance.now();
      const springDt = this.islandSpring.last ? Math.min(1 / 20, Math.max(0, (now - this.islandSpring.last) / 1e3)) : 1 / 60;
      this.islandSpring.last = now;
      const growing = this.targetWidth * this.targetHeight > this.currentWidth * this.currentHeight;
      const speed = 1;
      const response = (growing ? 0.42 : 0.34) * speed;
      const damping = growing ? 0.86 : 1;
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
      this.currentTintR += (this.targetTintR - this.currentTintR) * 0.12;
      this.currentTintG += (this.targetTintG - this.currentTintG) * 0.12;
      this.currentTintB += (this.targetTintB - this.currentTintB) * 0.12;
      const tr = Math.round(this.currentTintR);
      const tg = Math.round(this.currentTintG);
      const tb = Math.round(this.currentTintB);
      document.documentElement.style.setProperty("--album-tint-r", String(tr));
      document.documentElement.style.setProperty("--album-tint-g", String(tg));
      document.documentElement.style.setProperty("--album-tint-b", String(tb));
      document.documentElement.style.setProperty("--album-tint-rgb", `${tr}, ${tg}, ${tb}`);
      TextureEngine.getInstance().update(this.config?.lastCpuPercent || 25, this.config?.lastRamPercent || 45);
      if (this.chargerSurgeUntil > 0 && performance.now() >= this.chargerSurgeUntil) {
        this.chargerSurgeUntil = 0;
        this.updateTargetDimensions();
      }
      if (this.volumeHudUntil > 0 && performance.now() >= this.volumeHudUntil) {
        this.volumeHudUntil = 0;
        this.updateTargetDimensions();
      }
      if (this.airdropHudUntil > 0 && performance.now() >= this.airdropHudUntil) {
        if (!this.isHovered) {
          this.airdropHudUntil = 0;
          this.updateTargetDimensions();
        }
      }
      if (this.speedometerHudUntil > 0 && performance.now() >= this.speedometerHudUntil) {
        if (!this.isHovered) {
          this.speedometerHudUntil = 0;
          this.updateTargetDimensions();
        }
      }
      if (this.mediaState.playing && this.mediaState.durationMs > 0) {
        const elapsed = performance.now() - this.lastMediaSampleTime;
        this.mediaState.positionMs = Math.min(this.mediaState.durationMs, this.basePositionMs + elapsed);
        this.tickLyrics();
      }
      this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      this.drawIslandPill();
      const cx = window.innerWidth / 2;
      const topY = this.getTopY();
      this.mascot.isCompactIdle = this.mode === "compact" && !this.mediaState.active && !this.focusState.active && this.aiState.status !== "running";
      if (this.mascot.isCompactIdle && this.mascot.getMood() === "focused") {
        this.mascot.setMood("neutral");
      }
      this.mascot.update(dt, this.pointerX, this.pointerY, cx, topY + 13);
      if (this.isTucked) {
        if (this.domOverlayEl) this.domOverlayEl.classList.add("hidden");
        requestAnimationFrame(this.renderLoop.bind(this));
        return;
      } else if (this.mode === "rest") {
        if (this.domOverlayEl) this.domOverlayEl.classList.add("hidden");
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
      } else if (this.mode === "compact") {
        if (this.domOverlayEl) this.domOverlayEl.classList.add("hidden");
        this.drawCompactContent(cx, topY);
      } else {
        if (this.config.expandedUiMode === "canvas") {
          if (this.domOverlayEl) this.domOverlayEl.classList.add("hidden");
          this.drawExpandedContent(cx, topY);
        } else {
          if (this.domOverlayEl) {
            this.domOverlayEl.classList.remove("hidden");
            this.updateDomOverlay(cx, topY);
          }
          const eyeSlot = document.getElementById("mascot-eye-slot");
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
    _updatePowerSavingMode(battery) {
      const level = Math.round(battery.level * 100);
      const charging = battery.charging;
      this._isPowerSaving = !charging && level <= 20;
      this._powerSavingFrameInterval = this._isPowerSaving ? 66 : 0;
    }
    drawIslandPill() {
      const cx = window.innerWidth / 2;
      const topY = this.getTopY();
      const isSurgeActive = performance.now() < this.chargerSurgeUntil;
      const isVolumeHudActive = performance.now() < this.volumeHudUntil;
      const isSpeedometerHudActive = performance.now() < this.speedometerHudUntil;
      const isAirDropHudActive = performance.now() < this.airdropHudUntil;
      const isFloating = this.config?.islandStyle === "floating";
      if (this.isTucked) {
        const k = Math.min(1, (performance.now() - this.tuckChangedAt) / 220);
        const w2 = 56 * (0.4 + 0.6 * k);
        const color = this.aiState.status === "running" ? "#ff9a1f" : this.aiState.status === "done" ? "#22e05a" : this.mediaState.playing ? "#ffffff" : "#ffffff";
        this.ctx.save();
        this.ctx.globalAlpha = 0.7 + 0.3 * k;
        this.ctx.fillStyle = color;
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.roundRect(cx - w2 / 2, 2, w2, 4, 2);
        this.ctx.fill();
        this.ctx.restore();
        return;
      }
      if (this.isSplitIslandActive()) {
        const h2 = this.currentHeight;
        const r2 = Math.min(this.currentRadius, h2 / 2);
        const bubbleSize = h2;
        const gap = 8;
        const mainWidth = this.currentWidth;
        const totalSpan = mainWidth + gap + bubbleSize;
        const pillLeft = cx - totalSpan / 2;
        const bubbleCx = pillLeft + mainWidth + gap + bubbleSize / 2;
        const bubbleCy = topY + h2 / 2;
        const bubbleR = bubbleSize / 2;
        const isMusicActive2 = Boolean(this.mediaState.active && this.mediaState.title);
        this.ctx.save();
        this.ctx.shadowColor = "rgba(0, 0, 0, 0.40)";
        this.ctx.shadowBlur = 14;
        this.ctx.shadowOffsetY = 3;
        this.islandPath(this.ctx, pillLeft, topY, mainWidth, h2, r2);
        this.ctx.moveTo(bubbleCx + bubbleR, bubbleCy);
        this.ctx.arc(bubbleCx, bubbleCy, bubbleR, 0, Math.PI * 2);
        this.ctx.fillStyle = "#000000";
        this.ctx.fill();
        if (isMusicActive2) {
          const tr = Math.round(this.currentTintR);
          const tg = Math.round(this.currentTintG);
          const tb = Math.round(this.currentTintB);
          this.ctx.save();
          this.islandPath(this.ctx, pillLeft, topY, mainWidth, h2, r2);
          this.ctx.clip();
          const fold = h2 < 60;
          const tintGrad = this.ctx.createLinearGradient(0, fold ? topY : topY + h2 * 0.18, 0, topY + h2);
          tintGrad.addColorStop(0, `rgba(${tr}, ${tg}, ${tb}, ${fold ? 0.08 : 0})`);
          tintGrad.addColorStop(0.5, `rgba(${tr}, ${tg}, ${tb}, ${fold ? 0.18 : 0.12})`);
          tintGrad.addColorStop(1, `rgba(${tr}, ${tg}, ${tb}, 0.38)`);
          this.ctx.fillStyle = tintGrad;
          this.ctx.fillRect(pillLeft - 20, topY, mainWidth + 40, h2);
          this.ctx.restore();
        }
        this.ctx.shadowColor = "transparent";
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(0, isFloating ? 0 : 3, window.innerWidth, window.innerHeight);
        this.ctx.clip();
        this.islandPath(this.ctx, pillLeft + 0.5, topY, mainWidth - 1, h2 - 0.5, r2);
        this.ctx.lineWidth = 1;
        if (isMusicActive2) {
          const tr = Math.round(this.currentTintR);
          const tg = Math.round(this.currentTintG);
          const tb = Math.round(this.currentTintB);
          const rimGrad = this.ctx.createLinearGradient(0, topY, 0, topY + h2);
          rimGrad.addColorStop(0, "rgba(255, 255, 255, 0.08)");
          rimGrad.addColorStop(0.5, `rgba(${tr}, ${tg}, ${tb}, 0.25)`);
          rimGrad.addColorStop(1, `rgba(${tr}, ${tg}, ${tb}, 0.70)`);
          this.ctx.strokeStyle = rimGrad;
        } else {
          this.ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        }
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(bubbleCx, bubbleCy, bubbleR - 0.5, 0, Math.PI * 2);
        this.ctx.strokeStyle = "rgba(191, 90, 242, 0.35)";
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
          jelly += k.amp * Math.exp(-k.damp * ms / 1e3) * Math.sin(2 * Math.PI * k.hz * ms / 1e3);
        }
      }
      const visualW = Math.max(30, this.currentWidth * (1 + jelly));
      const visualH = Math.max(4, this.currentHeight * (1 - jelly * 1.4));
      const left = cx - visualW / 2;
      const w = visualW;
      const h = visualH;
      const r = Math.min(this.currentRadius, h / 2);
      const isMusicActive = this.mode === "compact" && !this.isTucked && !isSurgeActive && Boolean(this.mediaState.active && this.mediaState.title);
      this.ctx.save();
      this.ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
      this.ctx.shadowBlur = this.mode === "expanded" ? 24 : 14;
      this.ctx.shadowOffsetY = 3;
      if (this.isNotificationActive()) {
        const tint = this.getNotificationColor(this.activeNotification?.kind);
        this.ctx.shadowColor = tint;
        this.ctx.shadowBlur = 22;
        this.ctx.shadowOffsetY = 3;
      } else if (this.aiState.status === "running") {
        this.ctx.shadowColor = "rgba(255, 140, 0, 0.65)";
        this.ctx.shadowBlur = 24;
      } else if (isAirDropHudActive) {
        this.ctx.shadowColor = this.airdropHudType === "sent" ? "rgba(0, 210, 255, 0.45)" : "rgba(48, 209, 88, 0.45)";
        this.ctx.shadowBlur = 20;
      } else if (this.transferProgress !== null && Date.now() < this.transferProgressUntil) {
        this.ctx.shadowColor = "rgba(0, 210, 255, 0.55)";
        this.ctx.shadowBlur = 22;
      } else if (isSpeedometerHudActive) {
        this.ctx.shadowColor = "rgba(0, 210, 255, 0.28)";
        this.ctx.shadowBlur = 18;
      } else if (isVolumeHudActive) {
        this.ctx.shadowColor = "rgba(255, 255, 255, 0.22)";
        this.ctx.shadowBlur = 16;
      } else if (isSurgeActive && this.chargerSurgeCharging) {
        this.ctx.shadowColor = "rgba(52, 199, 89, 0.50)";
        this.ctx.shadowBlur = 14;
      } else if (isMusicActive) {
        this.ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
        this.ctx.shadowBlur = 14;
        this.ctx.shadowOffsetY = 3;
      }
      TextureEngine.getInstance().renderBehind(this.ctx, left, topY, w, h, r);
      this.islandPath(this.ctx, left, topY, w, h, r);
      this.ctx.fillStyle = "#000000";
      this.ctx.fill();
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
      this.ctx.save();
      this.ctx.shadowColor = "transparent";
      this.ctx.beginPath();
      this.ctx.rect(0, isFloating ? 0 : 3, window.innerWidth, window.innerHeight);
      this.ctx.clip();
      this.islandPath(this.ctx, left + 0.5, topY, w - 1, h - 0.5, r);
      this.ctx.lineWidth = 1;
      if (this.isNotificationActive()) {
        this.ctx.strokeStyle = this.getNotificationColor(this.activeNotification?.kind);
        this.ctx.lineWidth = 1.6;
      } else if (isAirDropHudActive) {
        this.ctx.strokeStyle = this.airdropHudType === "sent" ? "rgba(0, 210, 255, 0.55)" : "rgba(48, 209, 88, 0.55)";
        this.ctx.lineWidth = 1.4;
      } else if (this.transferProgress !== null && Date.now() < this.transferProgressUntil) {
        this.ctx.strokeStyle = "rgba(0, 210, 255, 0.75)";
        this.ctx.lineWidth = 1.6;
      } else if (this.aiState.status === "running") {
        this.ctx.strokeStyle = "rgba(255, 140, 0, 0.7)";
      } else if (isSpeedometerHudActive) {
        this.ctx.strokeStyle = "rgba(0, 210, 255, 0.35)";
        this.ctx.lineWidth = 1.2;
      } else if (isVolumeHudActive) {
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
        this.ctx.lineWidth = 1.2;
      } else if (isSurgeActive && this.chargerSurgeCharging) {
        this.ctx.strokeStyle = "rgba(52, 199, 89, 0.55)";
      } else if (isMusicActive) {
        const tr = Math.round(this.currentTintR);
        const tg = Math.round(this.currentTintG);
        const tb = Math.round(this.currentTintB);
        const rimGrad = this.ctx.createLinearGradient(0, topY, 0, topY + h);
        rimGrad.addColorStop(0, "rgba(255, 255, 255, 0.08)");
        rimGrad.addColorStop(0.5, `rgba(${tr}, ${tg}, ${tb}, 0.25)`);
        rimGrad.addColorStop(1, `rgba(${tr}, ${tg}, ${tb}, 0.70)`);
        this.ctx.strokeStyle = rimGrad;
      } else {
        this.ctx.strokeStyle = this.mode === "rest" ? "rgba(255, 255, 255, 0.10)" : "rgba(255, 255, 255, 0.08)";
      }
      this.ctx.stroke();
      this.ctx.restore();
      if (this.transferProgress !== null && Date.now() < this.transferProgressUntil) {
        const pct = Math.max(0, Math.min(100, this.transferProgress)) / 100;
        this.ctx.save();
        this.ctx.fillStyle = "#00d2ff";
        this.ctx.shadowColor = "#00d2ff";
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.roundRect(left + r, topY + h - 3, (w - 2 * r) * pct, 2, 1);
        this.ctx.fill();
        this.ctx.restore();
      }
      this.ctx.restore();
    }
    drawRestContent(cx, topY) {
      const midY = topY + this.currentHeight / 2;
      if (this.isNotificationActive()) {
        this.drawNotificationContent(cx - this.currentWidth / 2, midY, topY);
        return;
      }
      this.mascot.drawFloatingEyes(this.ctx, cx, midY, 0.75);
    }
    drawCompactContent(cx, topY) {
      const midY = topY + this.currentHeight / 2;
      const pillLeft = cx - this.currentWidth / 2;
      if (this.isNotificationActive()) {
        this.drawNotificationContent(pillLeft, midY, topY);
        return;
      }
      if (performance.now() < this.airdropHudUntil) {
        this.drawAirDropHudContent(cx, topY);
      } else if (performance.now() < this.speedometerHudUntil) {
        this.drawSpeedometerHudContent(cx, topY);
      } else if (performance.now() < this.volumeHudUntil) {
        this.drawVolumeHudContent(cx, topY);
      } else if (performance.now() < this.chargerSurgeUntil) {
        this.drawChargerSurgeContent(cx, topY);
      } else if (this.isSplitIslandActive()) {
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
        if (this.mediaState.active && this.mediaState.title) {
          this.drawCompactMusicIsland(left, midY, topY);
        } else {
          this.mascot.drawFloatingEyes(this.ctx, pillCx, midY, 0.95);
        }
        const d = bubbleSize;
        const ringR = Math.max(7, d / 2 - 9);
        const leftFraction = this.focusState.totalSeconds > 0 ? Math.max(0, Math.min(1, this.focusState.remainingSeconds / this.focusState.totalSeconds)) : 0;
        this.ctx.save();
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = "round";
        this.ctx.beginPath();
        this.ctx.arc(bubbleCx, bubbleCy, ringR, 0, Math.PI * 2);
        this.ctx.strokeStyle = "rgba(191, 90, 242, 0.3)";
        this.ctx.stroke();
        if (leftFraction > 1e-3) {
          this.ctx.beginPath();
          this.ctx.arc(bubbleCx, bubbleCy, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * leftFraction);
          this.ctx.strokeStyle = "#bf5af2";
          this.ctx.shadowColor = "rgba(191, 90, 242, 0.5)";
          this.ctx.shadowBlur = 4;
          this.ctx.stroke();
        }
        this.ctx.restore();
        const min = Math.floor(this.focusState.remainingSeconds / 60);
        const sec = this.focusState.remainingSeconds % 60;
        const minText = min > 0 ? String(min) : `${sec}s`;
        this.ctx.save();
        this.ctx.font = '700 9px -apple-system, BlinkMacSystemFont, "SF Pro Rounded", Inter, "Segoe UI", sans-serif';
        this.ctx.fillStyle = "#ffffff";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(minText, bubbleCx, bubbleCy + 0.5);
        this.ctx.restore();
      } else if (this.aiState.status === "running") {
        this.mascot.drawFloatingEyes(this.ctx, pillLeft + 22, midY, 0.85);
        this.ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        this.ctx.fillStyle = "#ffa500";
        this.ctx.textAlign = "left";
        this.ctx.fillText(this.aiState.currentTool || "AI Thinking...", pillLeft + 42, midY + 4);
      } else if (this.focusState.active) {
        const H = this.currentHeight;
        const cy = midY;
        const left = pillLeft + 14;
        const right = pillLeft + this.currentWidth - 14;
        const mid = (left + right) / 2;
        const r = 8;
        const leftFraction = this.focusState.totalSeconds > 0 ? Math.max(0, Math.min(1, this.focusState.remainingSeconds / this.focusState.totalSeconds)) : 0;
        this.ctx.save();
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = "round";
        this.ctx.beginPath();
        this.ctx.arc(left + 8, cy, r, 0, Math.PI * 2);
        this.ctx.strokeStyle = "rgba(191, 90, 242, 0.3)";
        this.ctx.stroke();
        if (leftFraction > 1e-3) {
          this.ctx.beginPath();
          this.ctx.arc(left + 8, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * leftFraction);
          this.ctx.strokeStyle = "#bf5af2";
          this.ctx.shadowColor = "rgba(191, 90, 242, 0.5)";
          this.ctx.shadowBlur = 4;
          this.ctx.stroke();
        }
        this.ctx.restore();
        this.mascot.drawFloatingEyes(this.ctx, mid, cy + 0.5, 0.95);
        const min = Math.floor(this.focusState.remainingSeconds / 60);
        const sec = this.focusState.remainingSeconds % 60;
        const timeStr = `${min}:${String(sec).padStart(2, "0")}`;
        this.ctx.save();
        this.ctx.font = '600 15px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        this.ctx.fillStyle = "#bf5af2";
        this.ctx.textAlign = "right";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(timeStr, right, cy + 0.5);
        this.ctx.restore();
      } else if (this.mediaState.active && this.mediaState.title) {
        this.drawCompactMusicIsland(pillLeft, midY, topY);
      } else {
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
    drawNotificationContent(pillLeft, midY, topY) {
      if (!this.activeNotification) return;
      this.notificationHits = {};
      const n = this.activeNotification;
      const W = this.currentWidth;
      const cy = midY;
      const left = pillLeft + 14;
      const right = pillLeft + W - 14;
      const color = this.getNotificationColor(n.kind);
      if (n.kind === "question") {
        this.ctx.save();
        this.ctx.strokeStyle = "#d97757";
        this.ctx.lineWidth = 2.4;
        this.ctx.lineCap = "round";
        for (let i = 0; i < 4; i++) {
          const an = i * Math.PI / 4;
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
          const isPrimary = item.primary ?? item.id === "allow";
          const isHovered = this.isHovered && this.isInsideHit(this.pointerX, this.pointerY, { x: bx, y: by, width: bw, height: bh });
          this.ctx.save();
          this.ctx.beginPath();
          this.ctx.roundRect(bx, by, bw, bh, 8);
          this.ctx.fillStyle = isPrimary ? isHovered ? "#e5e5ea" : "#ffffff" : isHovered ? "#3a3a3c" : "#2c2c2e";
          this.ctx.fill();
          this.ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
          this.ctx.fillStyle = isPrimary ? "#000000" : "#ffffff";
          this.ctx.textAlign = "center";
          this.ctx.textBaseline = "middle";
          this.ctx.fillText(item.label, bx + bw / 2, cy);
          this.ctx.restore();
          const hitKey = item.id === "allow" ? "cAllow" : item.id === "deny" ? "cDeny" : `action_${item.id}`;
          this.notificationHits[hitKey] = { x: bx, y: by, width: bw, height: bh };
          curRight -= bw + 8;
        }
        const maxTextW = Math.max(50, curRight - textLeft - 8);
        const titleFont = '600 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
        const truncTitle = this.truncateText(n.title, maxTextW, titleFont);
        this.ctx.save();
        this.ctx.font = titleFont;
        this.ctx.fillStyle = "#ffffff";
        this.ctx.textAlign = "left";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(truncTitle, textLeft, cy);
        this.ctx.restore();
      } else {
        const hasBody = Boolean(n.body && n.body.trim().length > 0);
        const titleFont = hasBody ? '600 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif' : '600 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
        const bodyFont = '400 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif';
        const closeSize = 20;
        const closeX = right - closeSize;
        const closeY = cy - closeSize / 2;
        const isCloseHovered = this.isHovered && this.isInsideHit(this.pointerX, this.pointerY, { x: closeX, y: closeY, width: closeSize, height: closeSize });
        const maxTextW = Math.max(80, closeX - textLeft - 10);
        const truncTitle = this.truncateText(n.title, maxTextW, titleFont);
        this.ctx.save();
        this.ctx.textAlign = "left";
        if (hasBody) {
          const truncBody = this.truncateText(n.body, maxTextW, bodyFont);
          this.ctx.font = titleFont;
          this.ctx.fillStyle = color;
          this.ctx.textBaseline = "bottom";
          this.ctx.fillText(truncTitle, textLeft, cy - 1);
          this.ctx.font = bodyFont;
          this.ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
          this.ctx.textBaseline = "top";
          this.ctx.fillText(truncBody, textLeft, cy + 2);
        } else {
          this.ctx.font = titleFont;
          this.ctx.fillStyle = color;
          this.ctx.textBaseline = "middle";
          this.ctx.fillText(truncTitle, textLeft, cy);
        }
        this.ctx.restore();
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(closeX + closeSize / 2, cy, closeSize / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = isCloseHovered ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.08)";
        this.ctx.fill();
        this.ctx.strokeStyle = isCloseHovered ? "#ffffff" : "rgba(255, 255, 255, 0.6)";
        this.ctx.lineWidth = 1.4;
        this.ctx.lineCap = "round";
        const crossR = 3.5;
        this.ctx.beginPath();
        this.ctx.moveTo(closeX + closeSize / 2 - crossR, cy - crossR);
        this.ctx.lineTo(closeX + closeSize / 2 + crossR, cy + crossR);
        this.ctx.moveTo(closeX + closeSize / 2 + crossR, cy - crossR);
        this.ctx.lineTo(closeX + closeSize / 2 - crossR, cy + crossR);
        this.ctx.stroke();
        this.ctx.restore();
        this.notificationHits["cDismiss"] = { x: closeX, y: closeY, width: closeSize, height: closeSize };
      }
    }
    /**
     * TwoCode Compact Music Island:
     * Direct parity with TwoCode ai-monitor-ui.js & spotify-ui.js.
     * Left: 24x24 px album cover with 7px rounded corners (cs = H - 12).
     * Middle: Synchronized live lyric line or track title in crisp white.
     * Right: Animated visualizer in extracted album color with soft glow.
     */
    drawCompactMusicIsland(pillLeft, midY, topY) {
      const H = this.currentHeight;
      const cy = midY;
      const left = pillLeft + 14;
      const right = pillLeft + this.currentWidth - 14;
      const mid = (left + right) / 2;
      const cs = Math.max(18, Math.min(22, H - 12));
      const coverX = left + 4;
      const coverY = cy - cs / 2;
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
        this.ctx.fillStyle = "#1c1c1e";
        this.ctx.fill();
        this.ctx.strokeStyle = this.albumAccentColor || "#ffffff";
        this.ctx.fillStyle = this.albumAccentColor || "#ffffff";
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
        this.ctx.arc(coverX + 13, coverY + 12, 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }
      const vizW = 18;
      const vizH = 14;
      const vizX = right - vizW - 4;
      const n = 5;
      const t = performance.now() / 1e3;
      const playing = Boolean(this.mediaState.playing);
      const gap = 2;
      const bw = (vizW - gap * (n - 1)) / n;
      this.ctx.save();
      this.ctx.shadowColor = this.albumAccentColor || "#ffffff";
      this.ctx.shadowBlur = 3;
      for (let i = 0; i < n; i++) {
        const raw = !playing ? 0.06 : 0.2 + 0.6 * Math.abs(Math.sin(t * (2.1 + i * 0.43) + i * 1.7)) * (0.65 + 0.35 * Math.sin(t * 1.3 + i * 0.9));
        const want = !playing ? 0.1 : Math.min(1, 0.12 + 1.15 * Math.pow(raw, 0.65));
        if (!this.visualizerBars[i]) this.visualizerBars[i] = 0.15;
        this.visualizerBars[i] += (want - this.visualizerBars[i]) * (want > this.visualizerBars[i] ? 0.5 : 0.16);
        const bh = Math.max(bw, vizH * Math.min(1, this.visualizerBars[i]));
        const bx = vizX + i * (bw + gap);
        const by = cy - bh / 2;
        this.ctx.beginPath();
        this.ctx.roundRect(bx, by, bw, bh, bw / 2);
        this.ctx.fillStyle = this.albumAccentColor || "#ffffff";
        this.ctx.fill();
      }
      this.ctx.restore();
      const x0 = coverX + cs + 12;
      const x1 = vizX - 12;
      const w = Math.max(20, x1 - x0);
      const band = 20;
      const getTrackDisplayName = () => {
        const title = (this.mediaState.title || "").trim();
        const artist = (this.mediaState.artist || "").trim();
        if (!title) return this.mediaState.app || "Music";
        if (artist && artist !== "Spotify" && !title.toLowerCase().includes(artist.toLowerCase())) {
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
      const line = (s, dy) => {
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
        while (text.length > 1 && this.ctx.measureText(text + "...").width > w) {
          text = text.slice(0, -1);
        }
        if (text !== s) text += "...";
        this.ctx.fillStyle = "#ffffff";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
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
        line(trackName, 0);
      }
    }
    /**
     * TwoCode Compact Resting Island (matching Screenshot 2):
     * Clean single black pill (98 x 26 px, radius 13px rendered by drawIslandPill).
     * Mascot Eyes centered vertically at cy = topY + currentHeight / 2 (topY + 13px).
     * Zero unwanted cyan shapes/paws beneath the eyes, zero clipping artifacts.
     */
    drawCompactRestingDualStructure(cx, topY) {
      if (this.isBuddyOut) {
        return;
      }
      const eyeCy = topY + this.currentHeight / 2;
      if (this.isStartupHelloBusy && this.startupHelloStartTime > 0) {
        const t = performance.now();
        const k = t - this.startupHelloStartTime;
        let scale = 1.2;
        const pop = (t - this.popAt) / 420;
        if (pop >= 0 && pop < 1) {
          scale *= 1 + 2.70158 * Math.pow(pop - 1, 3) + 1.70158 * Math.pow(pop - 1, 2);
        }
        if (k < 180) {
          scale = 0;
        }
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
        this.mascot.drawFloatingEyes(this.ctx, 0, 0, 1);
        this.ctx.restore();
        const hk = (k - 700 - 120) / 900;
        if (hk > 0 && hk < 1) {
          this.ctx.save();
          this.ctx.globalAlpha = hk < 0.7 ? 1 : 1 - (hk - 0.7) / 0.3;
          this.ctx.translate(cx + 20 + Math.sin(hk * 6) * 3, eyeCy - 34 - hk * 22);
          this.ctx.scale(1 + hk * 0.6, 1 + hk * 0.6);
          this.ctx.fillStyle = "#ff7eb6";
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
        this.mascot.drawFloatingEyes(this.ctx, cx - 10, eyeCy, 0.95);
        this.drawMicroEqualizer(cx + 24, eyeCy);
        return;
      }
      const leftItem = this.config?.restLeft && this.config.restLeft !== "none" ? this.config.restLeft : null;
      const rightItem = this.config?.restRight && this.config.restRight !== "none" ? this.config.restRight : null;
      if (!leftItem && !rightItem) {
        this.mascot.drawFloatingEyes(this.ctx, cx, eyeCy, 1);
        return;
      }
      const pillLeft = cx - this.currentWidth / 2;
      const pillRight = cx + this.currentWidth / 2;
      const pad = 12;
      if (leftItem) {
        this.drawRestTelemetryItem(leftItem, pillLeft + pad, eyeCy, "left");
      }
      if (rightItem) {
        this.drawRestTelemetryItem(rightItem, pillRight - pad, eyeCy, "right");
      }
      this.mascot.drawFloatingEyes(this.ctx, cx, eyeCy, 0.95);
    }
    // =========================================================================
    // Resting Island Telemetry Indicators (TwoCode rest-ui.js Parity)
    // =========================================================================
    drawBatteryGlyph(x, cy, level, charging) {
      const GLYPH = 17;
      const h = 8;
      const y = cy - h / 2;
      this.ctx.save();
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.roundRect(x + 0.5, y + 0.5, GLYPH - 1, h - 1, 2.5);
      this.ctx.stroke();
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      this.ctx.fillRect(x + GLYPH + 0.5, cy - 1.5, 1.6, 3);
      this.ctx.fillStyle = charging ? "#34c759" : level <= 0.2 ? "#ff453a" : "#ffffff";
      this.ctx.beginPath();
      this.ctx.roundRect(x + 2, y + 2, Math.max(1.5, (GLYPH - 4) * level), h - 4, 1.2);
      this.ctx.fill();
      this.ctx.restore();
    }
    drawWifiGlyph(x, cy, size = 14, levels = 4) {
      const cx = x + size / 2;
      const by = cy + size * 0.34;
      const lw = size * 0.13;
      const a0 = -Math.PI * 0.75;
      const a1 = -Math.PI * 0.25;
      const DIM = "rgba(255, 255, 255, 0.28)";
      const colour = "#ffffff";
      this.ctx.save();
      this.ctx.lineCap = "round";
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
    drawBtGlyph(x, cy, h = 14, colour = "#ffffff") {
      const w = h * 0.5;
      const l = x - w / 2;
      const r = x + w / 2;
      const t = cy - h / 2;
      const b = cy + h / 2;
      this.ctx.save();
      this.ctx.lineWidth = Math.max(1.4, h * 0.12);
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";
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
    getRestItemText(kind) {
      if (kind === "time") {
        const d = /* @__PURE__ */ new Date();
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }
      if (kind === "battery") {
        return `${Math.round(this.batteryState.level)}%`;
      }
      if (kind === "cpu") {
        const val = this.metricsState?.cpu ?? this.config?.lastCpuPercent ?? 12;
        return `CPU ${Math.round(val)}%`;
      }
      if (kind === "ram") {
        const val = this.metricsState?.ram ?? this.config?.lastRamPercent ?? 42;
        return `RAM ${Math.round(val)}%`;
      }
      if (kind === "storage" || kind === "disk") {
        const val = this.metricsState?.storage?.percent ?? 55;
        return `SSD ${Math.round(val)}%`;
      }
      return "";
    }
    measureRestItem(kind) {
      if (!kind || kind === "none") return 0;
      if (kind === "wifi") return 14;
      if (kind === "bluetooth") return 10;
      const txt = this.getRestItemText(kind);
      this.ctx.save();
      this.ctx.font = '600 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const w = this.ctx.measureText(txt).width;
      this.ctx.restore();
      return w + (kind === "battery" ? 17 + 2 + 5 : 0);
    }
    drawRestTelemetryItem(kind, x, cy, align) {
      const w = this.measureRestItem(kind);
      const x0 = align === "left" ? x : align === "right" ? x - w : x - w / 2;
      let tx = x0;
      if (kind === "wifi") {
        this.drawWifiGlyph(x0, cy, 14, this.netState.bars || 4);
        return;
      }
      if (kind === "bluetooth") {
        this.drawBtGlyph(x0 + 5, cy, 14, this.netState.btOn ? "#ffffff" : "rgba(255, 255, 255, 0.35)");
        return;
      }
      if (kind === "battery") {
        this.drawBatteryGlyph(x0, cy, (this.batteryState.level || 100) / 100, this.batteryState.charging);
        tx += 17 + 2 + 5;
      }
      this.ctx.save();
      this.ctx.font = '600 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = "#ffffff";
      this.ctx.textAlign = "left";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(this.getRestItemText(kind), tx, cy + 0.5);
      this.ctx.restore();
    }
    calculateRestWidth() {
      const leftItem = this.config?.restLeft && this.config.restLeft !== "none" ? this.config.restLeft : null;
      const rightItem = this.config?.restRight && this.config.restRight !== "none" ? this.config.restRight : null;
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
    drawMicroEqualizer(x, y, color = "#00e5ff") {
      const bars = 3;
      const barWidth = 2.2;
      const barSpacing = 4.2;
      const now = performance.now() * 9e-3;
      const heights = [
        Math.max(2.5, 3 + Math.sin(now * 1.2) * 4.5),
        Math.max(3.5, 5 + Math.sin(now * 1.8 + 1.2) * 6),
        Math.max(2, 3 + Math.sin(now * 1.5 + 2.4) * 4)
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
    drawSpeedometerHudContent(cx, topY) {
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
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(pillLeft + bayWidth, midY - 14);
      this.ctx.lineTo(pillLeft + bayWidth, midY + 14);
      this.ctx.moveTo(pillLeft + bayWidth * 2, midY - 14);
      this.ctx.lineTo(pillLeft + bayWidth * 2, midY + 14);
      this.ctx.stroke();
      const renderGauge = (centerX, title, percent, subText, colorInfo) => {
        const dialR = 12.5;
        const dialX = centerX - 26;
        const dialY = midY;
        const startAngle = 0.75 * Math.PI;
        const totalSweep = 1.5 * Math.PI;
        const endAngle = startAngle + totalSweep;
        this.ctx.save();
        this.ctx.strokeStyle = colorInfo.track;
        this.ctx.lineWidth = 2.6;
        this.ctx.lineCap = "round";
        this.ctx.beginPath();
        this.ctx.arc(dialX, dialY, dialR, startAngle, endAngle);
        this.ctx.stroke();
        const activeAngle = startAngle + totalSweep * (percent / 100);
        this.ctx.strokeStyle = colorInfo.hex;
        this.ctx.shadowColor = colorInfo.glow;
        this.ctx.shadowBlur = 6;
        this.ctx.beginPath();
        this.ctx.arc(dialX, dialY, dialR, startAngle, activeAngle);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = "#ffffff";
        this.ctx.beginPath();
        this.ctx.arc(dialX, dialY, 1.8, 0, Math.PI * 2);
        this.ctx.fill();
        const needleLen = 9.5;
        const nx = dialX + Math.cos(activeAngle) * needleLen;
        const ny = dialY + Math.sin(activeAngle) * needleLen;
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.lineWidth = 1.2;
        this.ctx.lineCap = "round";
        this.ctx.beginPath();
        this.ctx.moveTo(dialX, dialY);
        this.ctx.lineTo(nx, ny);
        this.ctx.stroke();
        this.ctx.restore();
        this.ctx.save();
        const textX = dialX + dialR + 7;
        this.ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "SF Pro Rounded", "Segoe UI", sans-serif';
        this.ctx.fillStyle = colorInfo.hex;
        this.ctx.textAlign = "left";
        this.ctx.textBaseline = "alphabetic";
        this.ctx.fillText(`${title} ${percent}%`, textX, midY - 1);
        this.ctx.font = '500 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.60)";
        this.ctx.fillText(subText, textX, midY + 11);
        this.ctx.restore();
      };
      const cores = this.metricsState?.cores || 8;
      renderGauge(pillLeft + bayWidth * 0.5, "CPU", cpuVal, `${cores} Cores`, cpuColor);
      const usedMb = this.metricsState?.usedMemMb || 7373;
      const usedGb = (usedMb / 1024).toFixed(1);
      renderGauge(pillLeft + bayWidth * 1.5, "RAM", ramVal, `${usedGb} GB`, ramColor);
      const freeSsd = this.metricsState?.storage?.freeGb ?? 77;
      renderGauge(pillLeft + bayWidth * 2.5, "SSD", ssdVal, `${freeSsd}GB Free`, ssdColor);
      this.ctx.restore();
    }
    /**
     * Apple-Style Hardware Volume Pop HUD (Zero Unicode Emojis)
     * Renders sleek animated speaker vector icon, horizontal pill progress track, and numeric percentage
     */
    drawVolumeHudContent(cx, topY) {
      const pillLeft = cx - this.currentWidth / 2;
      const midY = topY + this.currentHeight / 2;
      const isMuted = this.volumeHudMuted || this.volumeHudLevel === 0;
      const level = isMuted ? 0 : this.volumeHudLevel;
      this.ctx.save();
      const spkX = pillLeft + 26;
      const spkY = midY;
      this.ctx.fillStyle = isMuted ? "#ff453a" : "rgba(255, 255, 255, 0.95)";
      this.ctx.strokeStyle = isMuted ? "#ff453a" : "rgba(255, 255, 255, 0.95)";
      this.ctx.beginPath();
      this.ctx.rect(spkX - 8, spkY - 3.5, 3.5, 7);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.moveTo(spkX - 4.5, spkY - 3.5);
      this.ctx.lineTo(spkX + 1.5, spkY - 7.5);
      this.ctx.lineTo(spkX + 1.5, spkY + 7.5);
      this.ctx.lineTo(spkX - 4.5, spkY + 3.5);
      this.ctx.closePath();
      this.ctx.fill();
      if (isMuted) {
        this.ctx.lineWidth = 1.6;
        this.ctx.lineCap = "round";
        this.ctx.beginPath();
        this.ctx.moveTo(spkX + 5, spkY - 4);
        this.ctx.lineTo(spkX + 11, spkY + 4);
        this.ctx.moveTo(spkX + 11, spkY - 4);
        this.ctx.lineTo(spkX + 5, spkY + 4);
        this.ctx.stroke();
      } else {
        this.ctx.lineWidth = 1.5;
        this.ctx.lineCap = "round";
        if (level > 0) {
          this.ctx.beginPath();
          this.ctx.arc(spkX - 0.5, spkY, 5.5, -0.65, 0.65);
          this.ctx.stroke();
        }
        if (level > 33) {
          this.ctx.beginPath();
          this.ctx.arc(spkX - 0.5, spkY, 9.5, -0.7, 0.7);
          this.ctx.stroke();
        }
        if (level > 66) {
          this.ctx.beginPath();
          this.ctx.arc(spkX - 0.5, spkY, 13.5, -0.75, 0.75);
          this.ctx.stroke();
        }
      }
      const trackX = pillLeft + 52;
      const trackRight = pillLeft + this.currentWidth - 52;
      const trackW = Math.max(20, trackRight - trackX);
      const trackH = 7;
      const trackY = midY - trackH / 2;
      const trackR = trackH / 2;
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
      this.ctx.beginPath();
      this.ctx.roundRect(trackX, trackY, trackW, trackH, trackR);
      this.ctx.fill();
      const fillW = Math.max(0, Math.min(trackW, trackW * level / 100));
      if (fillW > 0) {
        this.ctx.fillStyle = isMuted ? "#ff453a" : "rgba(255, 255, 255, 0.96)";
        this.ctx.shadowColor = isMuted ? "rgba(255, 69, 58, 0.5)" : "rgba(255, 255, 255, 0.35)";
        this.ctx.shadowBlur = 4;
        this.ctx.beginPath();
        this.ctx.roundRect(trackX, trackY, fillW, trackH, trackR);
        this.ctx.fill();
      }
      this.ctx.shadowBlur = 0;
      const textX = pillLeft + this.currentWidth - 16;
      this.ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "SF Pro Rounded", "Segoe UI", sans-serif';
      this.ctx.textAlign = "right";
      this.ctx.textBaseline = "middle";
      if (isMuted) {
        this.ctx.fillStyle = "#ff453a";
        this.ctx.fillText("Muted", textX, midY);
      } else {
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        this.ctx.fillText(`${level}%`, textX, midY);
      }
      this.ctx.restore();
    }
    /**
     * Feature B: Charger Plug-in Surge Pop Content (Zero Clutter)
     */
    drawChargerSurgeContent(cx, topY) {
      const pillLeft = cx - this.currentWidth / 2;
      const midY = topY + this.currentHeight / 2;
      const isCharging = this.chargerSurgeCharging;
      const level = this.chargerSurgeLevel;
      this.mascot.drawFloatingEyes(this.ctx, pillLeft + 32, midY, 0.9);
      this.ctx.save();
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      this.ctx.beginPath();
      this.ctx.arc(cx - 10, midY, 1.8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
      this.ctx.save();
      const rightAreaX = cx + 8;
      this.ctx.font = '700 12.5px -apple-system, BlinkMacSystemFont, "SF Pro Rounded", "Segoe UI", sans-serif';
      this.ctx.textAlign = "left";
      this.ctx.textBaseline = "middle";
      if (isCharging) {
        this.ctx.fillStyle = "#34c759";
        this.ctx.shadowColor = "rgba(52, 199, 89, 0.65)";
        this.ctx.shadowBlur = 6;
        this.ctx.fillText(`${level}%`, rightAreaX + 18, midY);
        const boltX = rightAreaX;
        const boltY = midY;
        this.ctx.fillStyle = "#34c759";
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
        this.ctx.fillStyle = "#ffffff";
        this.ctx.fillText(`${level}%`, rightAreaX + 22, midY);
        const bX = rightAreaX;
        const bY = midY - 6;
        const bW = 15;
        const bH = 11;
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
        this.ctx.lineWidth = 1.2;
        this.ctx.strokeRect(bX, bY, bW, bH);
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
        this.ctx.fillRect(bX + bW + 1, bY + 3.5, 1.5, 4);
        const fillW = Math.max(1, (bW - 3) * (level / 100));
        this.ctx.fillStyle = level <= 20 ? "#ff453a" : "#ffffff";
        this.ctx.fillRect(bX + 1.5, bY + 1.5, fillW, bH - 3);
      }
      this.ctx.restore();
    }
    drawWaveform(x, y) {
      const bars = 4;
      const now = performance.now() * 8e-3;
      this.ctx.fillStyle = "#00d2ff";
      for (let i = 0; i < bars; i++) {
        const h = this.mediaState.playing ? 4 + Math.sin(now + i * 1.5) * 5 : 3;
        this.ctx.fillRect(x + i * 4, y - h / 2, 2, h);
      }
    }
    drawExpandedContent(cx, topY) {
      this.ctx.save();
      const pillLeft = cx - this.currentWidth / 2;
      this.ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      this.ctx.textAlign = "center";
      this.ctx.fillText("CONFIG", pillLeft + 36, topY + 28);
      this.ctx.fillText("CLOSE", pillLeft + this.currentWidth - 36, topY + 28);
      const tabsY = topY + 28;
      const tabs = [
        { id: "media", label: "Music", x: cx - 140 },
        { id: "home", label: "System", x: cx - 60 },
        { id: "ai", label: "AI", x: cx + 20 },
        { id: "tools", label: "Tools", x: cx + 90 },
        { id: "focus", label: "Focus", x: cx + 160 }
      ];
      for (const t of tabs) {
        const isSelected = this.activeTab === t.id;
        this.ctx.font = isSelected ? '600 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' : '500 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        this.ctx.fillStyle = isSelected ? "#00d2ff" : "rgba(255, 255, 255, 0.45)";
        this.ctx.fillText(t.label, t.x, tabsY);
        if (isSelected) {
          this.ctx.fillStyle = "#00d2ff";
          this.ctx.beginPath();
          this.ctx.roundRect(t.x - 14, tabsY + 6, 28, 2, 1);
          this.ctx.fill();
        }
      }
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(pillLeft + 24, topY + 44);
      this.ctx.lineTo(pillLeft + this.currentWidth - 24, topY + 44);
      this.ctx.stroke();
      if (this.activeTab === "media") {
        this.drawMediaTab(cx, topY);
      } else if (this.activeTab === "home") {
        this.drawHomeTab(cx, topY);
      } else if (this.activeTab === "ai") {
        this.drawAiTab(cx, topY);
      } else if (this.activeTab === "tools") {
        this.drawToolsTab(cx, topY);
      } else if (this.activeTab === "focus") {
        this.drawFocusTab(cx, topY);
      }
      this.ctx.restore();
    }
    // Vector media icons (Direct TwoCode spotify-ui.js parity: crisper than text glyphs)
    mediaIcon(kind, x, y, s, colour) {
      this.ctx.save();
      this.ctx.fillStyle = colour;
      this.ctx.beginPath();
      const tri = (x0, dir) => {
        this.ctx.moveTo(x0, y - s / 2);
        this.ctx.lineTo(x0 + dir * s * 0.75, y);
        this.ctx.lineTo(x0, y + s / 2);
        this.ctx.closePath();
      };
      if (kind === "play") {
        tri(x - s * 0.3, 1);
      } else if (kind === "pause") {
        this.ctx.roundRect(x - s * 0.4, y - s / 2, s * 0.28, s, 2);
        this.ctx.roundRect(x + s * 0.12, y - s / 2, s * 0.28, s, 2);
      } else {
        const d = kind === "next" ? 1 : -1;
        tri(x - d * s * 0.6, d);
        tri(x - d * s * 0.05, d);
        this.ctx.roundRect(x + d * s * 0.7 - (d > 0 ? 0 : s * 0.16), y - s / 2, s * 0.16, s, 1);
      }
      this.ctx.fill();
      this.ctx.restore();
    }
    // Device vector icon (TwoCode spotify-ui.js parity)
    devIcon(type, x, y, s, colour) {
      this.ctx.save();
      this.ctx.strokeStyle = colour;
      this.ctx.fillStyle = colour;
      this.ctx.lineWidth = 1.6;
      this.ctx.lineJoin = "round";
      this.ctx.beginPath();
      if (type === "Smartphone") {
        this.ctx.roundRect(x - s * 0.28, y - s * 0.5, s * 0.56, s, 2.5);
      } else if (type === "Automobile") {
        this.ctx.roundRect(x - s * 0.5, y - s * 0.1, s, s * 0.38, 3);
        this.ctx.moveTo(x - s * 0.32, y - s * 0.1);
        this.ctx.lineTo(x - s * 0.2, y - s * 0.38);
        this.ctx.lineTo(x + s * 0.2, y - s * 0.38);
        this.ctx.lineTo(x + s * 0.32, y - s * 0.1);
      } else if (type === "Speaker" || type === "CastAudio" || type === "AVR") {
        this.ctx.roundRect(x - s * 0.34, y - s * 0.5, s * 0.68, s, 3);
        this.ctx.moveTo(x + s * 0.14, y + s * 0.12);
        this.ctx.arc(x, y + s * 0.12, s * 0.14, 0, Math.PI * 2);
      } else if (type === "TV" || type === "CastVideo") {
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
    drawMediaTab(cx, topY) {
      const contentW = 472;
      const x0 = cx - contentW / 2;
      const right = cx + contentW / 2;
      const top0 = topY + 48;
      const cs = 60;
      const trackTitle = this.mediaState.title;
      const trackArtist = this.mediaState.artist;
      const accent = this.albumAccentColor || "#1ed760";
      const soft = "rgba(255, 255, 255, 0.55)";
      if (this.albumImageElement?.complete && this.albumImageElement.naturalWidth > 0) {
        this.ctx.save();
        this.ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
        this.ctx.shadowBlur = 12;
        this.ctx.shadowOffsetY = 4;
        this.ctx.beginPath();
        this.ctx.roundRect(x0, top0, cs, cs, 10);
        this.ctx.fillStyle = "#1c1c1e";
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
        this.ctx.fillStyle = "#1c1c1e";
        this.ctx.fill();
        this.ctx.restore();
      }
      const vizW = 44;
      const vizH = 28;
      const vizX = right - 44;
      const vizCy = top0 + 24;
      const n = 6;
      const t = performance.now() / 1e3;
      const playing = Boolean(this.mediaState.playing);
      const gap = Math.max(2, vizW / n * 0.4);
      const vbw = (vizW - gap * (n - 1)) / n;
      this.ctx.save();
      this.ctx.shadowColor = accent;
      this.ctx.shadowBlur = vizH * 0.35;
      for (let i = 0; i < n; i++) {
        const raw = !playing ? 0.06 : 0.2 + 0.6 * Math.abs(Math.sin(t * (2.1 + i * 0.43) + i * 1.7)) * (0.65 + 0.35 * Math.sin(t * 1.3 + i * 0.9));
        const want = !playing ? 0.1 : Math.min(1, 0.12 + 1.15 * Math.pow(raw, 0.65));
        if (!this.visualizerBars[i]) this.visualizerBars[i] = 0.15;
        this.visualizerBars[i] += (want - this.visualizerBars[i]) * (want > this.visualizerBars[i] ? 0.5 : 0.16);
        const bh2 = Math.max(vbw, vizH * Math.min(1, this.visualizerBars[i]));
        const bx = vizX + i * (vbw + gap);
        const by = vizCy - bh2 / 2;
        this.ctx.beginPath();
        this.ctx.roundRect(bx, by, vbw, bh2, vbw / 2);
        this.ctx.fillStyle = accent;
        this.ctx.fill();
      }
      this.ctx.restore();
      const tx = x0 + cs + 14;
      const titleW = right - 56 - tx;
      const overTitle = this.pointerX >= tx && this.pointerX <= tx + titleW && this.pointerY >= top0 + 10 && this.pointerY <= top0 + 30;
      this.ctx.save();
      this.ctx.font = '600 15px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = overTitle ? soft : "#ffffff";
      this.ctx.textAlign = "left";
      this.ctx.textBaseline = "alphabetic";
      let displayTitle = trackTitle || "Nothing Playing";
      if (this.ctx.measureText(displayTitle).width > titleW) {
        while (displayTitle.length > 1 && this.ctx.measureText(displayTitle + "\u2026").width > titleW) {
          displayTitle = displayTitle.slice(0, -1);
        }
        displayTitle += "\u2026";
      }
      this.ctx.fillText(displayTitle, tx, top0 + 26);
      this.ctx.font = '400 12px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = soft;
      let displayArtist = trackArtist || "Start music in Spotify or Windows";
      if (this.ctx.measureText(displayArtist).width > titleW) {
        while (displayArtist.length > 1 && this.ctx.measureText(displayArtist + "\u2026").width > titleW) {
          displayArtist = displayArtist.slice(0, -1);
        }
        displayArtist += "\u2026";
      }
      this.ctx.fillText(displayArtist, tx, top0 + 44);
      this.ctx.restore();
      const hasLyrics = Boolean(this.mediaState.lyricLine && this.syncedLyrics.length > 0);
      const extra = hasLyrics ? 74 : 0;
      if (hasLyrics) {
        const ly = top0 + cs + 14;
        const lw = right - x0;
        const curPos = this.mediaState.positionMs;
        let curIdx = -1;
        for (let k = 0; k < this.syncedLyrics.length; k++) {
          if (this.syncedLyrics[k].timeMs <= curPos + 250) curIdx = k;
          else break;
        }
        const prevLine = curIdx > 0 ? this.syncedLyrics[curIdx - 1].text : "";
        const nowLine = curIdx >= 0 ? this.syncedLyrics[curIdx].text : "";
        const nextLine = curIdx + 1 < this.syncedLyrics.length ? this.syncedLyrics[curIdx + 1].text : "";
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(x0, ly - 2, lw, 60);
        this.ctx.clip();
        this.ctx.textAlign = "left";
        this.ctx.textBaseline = "alphabetic";
        this.ctx.font = '500 12px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
        this.ctx.fillText(prevLine, x0, ly + 14);
        this.ctx.font = '700 15px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        this.ctx.fillStyle = "#ffffff";
        this.ctx.fillText(nowLine || "...", x0, ly + 34);
        this.ctx.font = '500 12px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
        this.ctx.fillText(nextLine, x0, ly + 54);
        this.ctx.restore();
      }
      const barY = top0 + cs + 16 + extra;
      const bx0 = x0 + 34;
      const bw = right - 40 - bx0;
      const pos = this.mediaState.positionMs || 0;
      const dur = this.mediaState.durationMs || 1;
      const part = Math.max(0, Math.min(1, pos / dur));
      const overBar = this.pointerX >= bx0 && this.pointerX <= bx0 + bw && Math.abs(this.pointerY - barY) <= 8;
      const bh = overBar ? 6 : 3;
      this.ctx.save();
      this.ctx.font = '500 10px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = soft;
      this.ctx.textAlign = "left";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(this.formatTime(pos), x0, barY);
      this.ctx.beginPath();
      this.ctx.roundRect(bx0, barY - bh / 2, bw, bh, bh / 2);
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.roundRect(bx0, barY - bh / 2, Math.max(bh, bw * part), bh, bh / 2);
      this.ctx.fillStyle = "#ffffff";
      this.ctx.fill();
      this.ctx.textAlign = "right";
      const remMs = Math.max(0, dur - pos);
      this.ctx.fillText(dur > 0 ? "-" + this.formatTime(remMs) : "0:00", right, barY);
      this.ctx.restore();
      const cy = barY + 22;
      const mid = (x0 + right) / 2;
      const overPrev = Math.abs(this.pointerX - (mid - 46)) <= 20 && Math.abs(this.pointerY - cy) <= 14;
      const overPlay = Math.abs(this.pointerX - mid) <= 20 && Math.abs(this.pointerY - cy) <= 14;
      const overNext = Math.abs(this.pointerX - (mid + 46)) <= 20 && Math.abs(this.pointerY - cy) <= 14;
      this.ctx.save();
      if (overPrev) this.ctx.globalAlpha = 0.6;
      this.mediaIcon("prev", mid - 46, cy, 12, "#ffffff");
      this.ctx.restore();
      this.ctx.save();
      if (overPlay) this.ctx.globalAlpha = 0.6;
      this.mediaIcon(this.mediaState.playing ? "pause" : "play", mid, cy, 17, "#ffffff");
      this.ctx.restore();
      this.ctx.save();
      if (overNext) this.ctx.globalAlpha = 0.6;
      this.mediaIcon("next", mid + 46, cy, 12, "#ffffff");
      this.ctx.restore();
      const devLabel = this.mediaState.source === "spotify" ? "Spotify" : "This PC";
      this.ctx.save();
      this.ctx.font = '600 11px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const dw = Math.min(130, this.ctx.measureText(devLabel).width + 34);
      const dbx = right - dw;
      const dby = cy - 11;
      const overDev = this.pointerX >= dbx && this.pointerX <= dbx + dw && this.pointerY >= dby && this.pointerY <= dby + 22;
      this.ctx.beginPath();
      this.ctx.roundRect(dbx, dby, dw, 22, 7);
      this.ctx.fillStyle = this.isDevicesOpen || overDev ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.1)";
      this.ctx.fill();
      this.devIcon(this.mediaState.source === "spotify" ? "Smartphone" : "Computer", dbx + 13, dby + 11, 12, "#ffffff");
      this.ctx.fillStyle = "#ffffff";
      this.ctx.textAlign = "left";
      this.ctx.textBaseline = "alphabetic";
      this.ctx.fillText(devLabel, dbx + 25, dby + 15);
      this.ctx.restore();
      if (this.isDevicesOpen) {
        const pw = 280;
        const list = this.spotifyDevices.slice(0, 4);
        const ph = 52 + Math.max(1, list.length) * 40;
        const px = right - pw;
        const py = Math.max(topY + 36, dby - ph - 8);
        this.ctx.save();
        this.ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
        this.ctx.shadowBlur = 24;
        this.ctx.shadowOffsetY = 8;
        this.ctx.beginPath();
        this.ctx.roundRect(px, py, pw, ph, 12);
        this.ctx.fillStyle = "#1c1c1e";
        this.ctx.fill();
        this.ctx.restore();
        this.ctx.save();
        this.ctx.font = '600 15px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        this.ctx.fillStyle = "#ffffff";
        this.ctx.textAlign = "left";
        this.ctx.textBaseline = "alphabetic";
        this.ctx.fillText("Play on", px + 16, py + 28);
        this.ctx.textAlign = "center";
        this.ctx.fillStyle = "#8e8e93";
        this.ctx.fillText("\xD7", px + pw - 22, py + 28);
        if (list.length === 0) {
          this.ctx.font = "500 12px Inter, sans-serif";
          this.ctx.textAlign = "left";
          this.ctx.fillText("No Spotify devices found", px + 16, py + 65);
        } else {
          list.forEach((d, i) => {
            const ry = py + 44 + i * 40;
            const overItem = this.pointerX >= px + 6 && this.pointerX <= px + pw - 6 && this.pointerY >= ry && this.pointerY <= ry + 40;
            this.ctx.fillStyle = "#2c2c2e";
            this.ctx.fillRect(px + 16, ry, pw - 32, 1);
            if (overItem) {
              this.ctx.beginPath();
              this.ctx.roundRect(px + 6, ry + 2, pw - 12, 36, 8);
              this.ctx.fillStyle = "#2c2c2e";
              this.ctx.fill();
            }
            this.devIcon(d.type || "Speaker", px + 26, ry + 20, 15, "#ffffff");
            this.ctx.font = d.is_active ? "600 14px Inter, sans-serif" : "500 14px Inter, sans-serif";
            this.ctx.fillStyle = "#ffffff";
            this.ctx.textAlign = "left";
            this.ctx.fillText(d.name, px + 46, ry + 25);
            if (d.is_active) {
              this.ctx.strokeStyle = "#ffffff";
              this.ctx.lineWidth = 2.4;
              this.ctx.lineCap = "round";
              this.ctx.lineJoin = "round";
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
    drawHomeTab(cx, topY) {
      const col1 = cx - 130;
      const col2 = cx + 130;
      this.ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = "#ffffff";
      this.ctx.textAlign = "center";
      this.ctx.fillText(`${this.weatherState.temp} \u2022 ${this.weatherState.condition}`, col1, topY + 84);
      const timeStr = (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      this.ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
      this.ctx.fillText(`${timeStr}`, col2, topY + 84);
      this.ctx.font = '500 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
      this.ctx.fillText(`Wi-Fi: ${this.netState.ssid}`, col1, topY + 116);
      this.ctx.fillText("LAN Drop Ready", col2, topY + 116);
      const volY = topY + 165;
      const volLeft = cx - 120;
      const volW = 240;
      const volLevel = this.volumeState.muted ? 0 : this.volumeState.level;
      this.ctx.font = "600 11px sans-serif";
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      this.ctx.textAlign = "right";
      this.ctx.fillText(this.volumeState.muted ? "MUTE" : "VOL", volLeft - 14, volY + 5);
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      this.ctx.beginPath();
      this.ctx.roundRect(volLeft, volY - 3, volW, 6, 3);
      this.ctx.fill();
      this.ctx.fillStyle = "#00d2ff";
      this.ctx.beginPath();
      this.ctx.roundRect(volLeft, volY - 3, volW * volLevel / 100, 6, 3);
      this.ctx.fill();
      this.ctx.font = "500 11px monospace";
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      this.ctx.textAlign = "left";
      this.ctx.fillText(`${volLevel}%`, volLeft + volW + 14, volY + 4);
    }
    drawAiTab(cx, topY) {
      const isRunning = this.aiState.status === "running";
      const statusColor = isRunning ? "#ffa500" : "#00d2ff";
      this.ctx.font = '600 14.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = statusColor;
      this.ctx.textAlign = "center";
      this.ctx.fillText("Claude Code & OpenAI Codex Monitor", cx, topY + 82);
      this.ctx.font = '500 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      this.ctx.fillText(
        isRunning ? `Active Task: ${this.aiState.currentTool || "Executing..."}` : "Agent Idle \u2022 Listening on port 47823",
        cx,
        topY + 106
      );
      if (this.aiState.pendingPermission) {
        const cardY = topY + 128;
        this.ctx.fillStyle = "rgba(255, 160, 0, 0.12)";
        this.ctx.strokeStyle = "rgba(255, 160, 0, 0.4)";
        this.ctx.beginPath();
        this.ctx.roundRect(cx - 200, cardY, 400, 68, 8);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        this.ctx.fillStyle = "#ffb300";
        this.ctx.fillText("CLI Permission Request", cx, cardY + 20);
        this.ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        this.ctx.fillStyle = "#e8ecf4";
        this.ctx.fillText(this.aiState.pendingPermission.description || "Execution authorization required", cx, cardY + 38);
        this.ctx.fillStyle = "#00ff66";
        this.ctx.beginPath();
        this.ctx.roundRect(cx - 70, cardY + 46, 55, 16, 4);
        this.ctx.fill();
        this.ctx.font = "600 10px sans-serif";
        this.ctx.fillStyle = "#000";
        this.ctx.fillText("Allow", cx - 42, cardY + 58);
        this.ctx.fillStyle = "#ff4444";
        this.ctx.beginPath();
        this.ctx.roundRect(cx + 15, cardY + 46, 55, 16, 4);
        this.ctx.fill();
        this.ctx.fillStyle = "#fff";
        this.ctx.fillText("Deny", cx + 42, cardY + 58);
      }
    }
    drawToolsTab(cx, topY) {
      this.ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = "#ffffff";
      this.ctx.textAlign = "center";
      this.ctx.fillText("Productivity Tools", cx, topY + 84);
      this.ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
      this.ctx.fillText("Clipboard History \u2022 Local Wi-Fi Drop (Port 48912) \u2022 Scratchpad", cx, topY + 110);
      this.ctx.fillStyle = "rgba(0, 210, 255, 0.15)";
      this.ctx.strokeStyle = "#00d2ff";
      this.ctx.beginPath();
      this.ctx.roundRect(cx - 100, topY + 150, 200, 34, 8);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = "#00d2ff";
      this.ctx.fillText("Open Settings Dashboard", cx, topY + 172);
    }
    drawFocusTab(cx, topY) {
      const min = Math.floor(this.focusState.remainingSeconds / 60);
      const sec = this.focusState.remainingSeconds % 60;
      const timeStr = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
      this.ctx.font = "600 28px monospace";
      this.ctx.fillStyle = this.focusState.active ? "#cf53ff" : "#ffffff";
      this.ctx.textAlign = "center";
      this.ctx.fillText(timeStr, cx, topY + 115);
      this.ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      this.ctx.fillText(this.focusState.isBreak ? "Short Break" : "Deep Focus Session", cx, topY + 140);
      const btnY = topY + 175;
      this.ctx.fillStyle = this.focusState.active ? "rgba(255, 80, 80, 0.2)" : "rgba(207, 83, 255, 0.2)";
      this.ctx.strokeStyle = this.focusState.active ? "#ff5050" : "#cf53ff";
      this.ctx.beginPath();
      this.ctx.roundRect(cx - 60, btnY, 120, 32, 6);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      this.ctx.fillStyle = this.focusState.active ? "#ff5050" : "#cf53ff";
      this.ctx.fillText(this.focusState.active ? "Pause" : "Start Focus", cx, btnY + 20);
    }
    /* ========================================================================
       HYBRID DOM OVERLAY INTEGRATION (Screenshots 01, 03, 04, 07, 08)
       ======================================================================== */
    initDomOverlay() {
      this.domOverlayEl = document.getElementById("expanded-island-overlay");
      if (!this.domOverlayEl) return;
      this.setPopover("none");
      this.updateNetworkDom();
      this.domOverlayEl.addEventListener("click", (e) => {
        this.mascot.resetInactivity();
        const ctxMenu2 = document.getElementById("island-context-menu");
        if (ctxMenu2 && !ctxMenu2.classList.contains("hidden")) {
          ctxMenu2.classList.add("hidden");
        }
        if (this.activePopover !== "none") {
          const popover = document.getElementById("system-popover");
          const btnWifi2 = document.getElementById("btn-status-wifi");
          const btnBt2 = document.getElementById("btn-status-bt");
          const btnGroup2 = document.getElementById("btn-system-popover");
          const targetNode = e.target && e.target instanceof Node ? e.target : null;
          const clickedInsidePopover = targetNode ? Boolean(popover?.contains(targetNode)) || Boolean(btnWifi2?.contains(targetNode)) || Boolean(btnBt2?.contains(targetNode)) || Boolean(btnGroup2?.contains(targetNode)) : false;
          if (!clickedInsidePopover) {
            this.setPopover("none");
          }
        }
        e.stopPropagation();
      });
      const navItems = this.domOverlayEl.querySelectorAll(".nav-item[data-tab]");
      navItems.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const tab = btn.dataset.tab;
          if (tab) {
            this.showDomTab(tab);
            this.mascot.sounds.playChirp();
          }
        });
      });
      const btnMenu = document.getElementById("btn-island-menu");
      if (btnMenu) {
        btnMenu.addEventListener("click", (e) => {
          e.stopPropagation();
          window.roboIsland?.openSettings();
        });
      }
      const btnWifi = document.getElementById("btn-status-wifi");
      if (btnWifi) {
        btnWifi.addEventListener("click", (e) => {
          e.stopPropagation();
          this.setPopover(this.activePopover === "wifi" ? "none" : "wifi");
        });
      }
      const btnBt = document.getElementById("btn-status-bt");
      if (btnBt) {
        btnBt.addEventListener("click", (e) => {
          e.stopPropagation();
          this.setPopover(this.activePopover === "bt" ? "none" : "bt");
        });
      }
      const btnGroup = document.getElementById("btn-system-popover");
      if (btnGroup) {
        btnGroup.addEventListener("click", (e) => {
          if (e.target.closest("#btn-status-wifi, #btn-status-bt")) return;
          e.stopPropagation();
          this.setPopover(this.activePopover === "none" ? "wifi" : "none");
        });
      }
      const btnPhone = document.getElementById("btn-phone-quick");
      if (btnPhone) {
        btnPhone.addEventListener("click", (e) => {
          e.stopPropagation();
          this.openPhoneDrop();
        });
      }
      const btnTrayPhone = document.getElementById("btn-tray-phone");
      if (btnTrayPhone) {
        btnTrayPhone.addEventListener("click", (e) => {
          e.stopPropagation();
          this.openPhoneDrop();
        });
      }
      const btnHeaderMusic = document.getElementById("btn-header-music");
      if (btnHeaderMusic) {
        btnHeaderMusic.addEventListener("click", (e) => {
          e.stopPropagation();
          this.showDomTab("music");
          this.mascot.sounds.playChirp();
        });
      }
      const btnFocus = document.getElementById("btn-focus-toggle");
      if (btnFocus) {
        btnFocus.addEventListener("click", (e) => {
          e.stopPropagation();
          const f = window.__roboFocus || window.__twocodeFocus;
          if (f) {
            f.toggle();
          } else {
            this.focusState.active = !this.focusState.active;
          }
          this.mascot.sounds.playChirp();
        });
      }
      const btnHomeMusicPlay = document.getElementById("btn-home-music-play");
      if (btnHomeMusicPlay) {
        btnHomeMusicPlay.addEventListener("click", (e) => {
          e.stopPropagation();
          window.roboIsland?.mediaControl("playPause");
          this.mascot.sounds.playChirp();
        });
      }
      const cardClaude = document.getElementById("card-claude");
      if (cardClaude) {
        cardClaude.addEventListener("click", (e) => {
          e.stopPropagation();
          this.showDomTab("ai");
        });
      }
      const cardMusic = document.getElementById("card-music");
      if (cardMusic) {
        cardMusic.addEventListener("click", (e) => {
          e.stopPropagation();
          if (e.target.closest("#btn-home-music-play")) return;
          this.showDomTab("music");
        });
      }
      const cardFocus = document.getElementById("card-focus");
      if (cardFocus) {
        cardFocus.addEventListener("click", (e) => {
          e.stopPropagation();
          if (e.target.closest("#btn-focus-toggle")) return;
          this.showDomTab("focus");
        });
      }
      const navVolContainer = document.getElementById("nav-vol-container");
      const navVolTrack = document.getElementById("nav-vol-track");
      if (navVolTrack && navVolContainer) {
        let isDraggingVol = false;
        const setVolFromEvent = (e) => {
          const rect = navVolTrack.getBoundingClientRect();
          const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const level = Math.round(pct * 100);
          this.volumeState.level = level;
          this.volumeState.muted = level === 0;
          window.roboIsland?.setVolume(level);
        };
        navVolTrack.addEventListener("mousedown", (e) => {
          e.stopPropagation();
          isDraggingVol = true;
          navVolContainer.classList.add("sliding");
          setVolFromEvent(e);
        });
        window.addEventListener("mousemove", (e) => {
          if (isDraggingVol) {
            setVolFromEvent(e);
          }
        });
        window.addEventListener("mouseup", () => {
          if (isDraggingVol) {
            isDraggingVol = false;
            navVolContainer.classList.remove("sliding");
          }
        });
      }
      const btnMute = document.getElementById("btn-quick-mute");
      if (btnMute) {
        btnMute.addEventListener("click", (e) => {
          e.stopPropagation();
          window.roboIsland?.setMute(!this.volumeState.muted);
        });
      }
      const tileWifi = document.getElementById("tile-wifi");
      if (tileWifi) {
        tileWifi.addEventListener("click", (e) => {
          e.stopPropagation();
          this.netState.wifiOn = !this.netState.wifiOn;
          tileWifi.classList.toggle("active", this.netState.wifiOn);
          const ssidEl = document.getElementById("popover-wifi-ssid");
          if (ssidEl) ssidEl.textContent = this.netState.wifiOn ? this.netState.ssid || "Connected" : "Off";
          window.roboIsland?.setRadio("wifi", this.netState.wifiOn);
        });
      }
      const tileBt = document.getElementById("tile-bt");
      if (tileBt) {
        tileBt.addEventListener("click", (e) => {
          e.stopPropagation();
          this.netState.btOn = !this.netState.btOn;
          tileBt.classList.toggle("active", this.netState.btOn);
          const btStatusEl = document.getElementById("popover-bt-status");
          if (btStatusEl) btStatusEl.textContent = this.netState.btOn ? "Active" : "Off";
          window.roboIsland?.setRadio("bt", this.netState.btOn);
        });
      }
      const rowWifi = document.getElementById("row-wifi-list");
      if (rowWifi) {
        rowWifi.addEventListener("click", (e) => {
          e.stopPropagation();
          window.roboIsland?.openExternal?.("ms-settings:network-wifi");
        });
      }
      const rowBt = document.getElementById("row-bt-list");
      if (rowBt) {
        rowBt.addEventListener("click", (e) => {
          e.stopPropagation();
          window.roboIsland?.openExternal?.("ms-settings:bluetooth");
        });
      }
      const ctxHide = document.getElementById("ctx-hide");
      if (ctxHide) {
        ctxHide.addEventListener("click", (e) => {
          e.stopPropagation();
          document.getElementById("island-context-menu")?.classList.add("hidden");
          window.roboIsland?.hideIsland();
        });
      }
      const ctxToggle = document.getElementById("ctx-toggle");
      if (ctxToggle) {
        ctxToggle.addEventListener("click", (e) => {
          e.stopPropagation();
          document.getElementById("island-context-menu")?.classList.add("hidden");
          this.toggleExpand();
        });
      }
      const ctxSettings = document.getElementById("ctx-settings");
      if (ctxSettings) {
        ctxSettings.addEventListener("click", (e) => {
          e.stopPropagation();
          document.getElementById("island-context-menu")?.classList.add("hidden");
          window.roboIsland?.openSettings();
        });
      }
      const ctxQuit = document.getElementById("ctx-quit");
      if (ctxQuit) {
        ctxQuit.addEventListener("click", (e) => {
          e.stopPropagation();
          document.getElementById("island-context-menu")?.classList.add("hidden");
          window.roboIsland?.quit();
        });
      }
      const ctxMenu = document.getElementById("island-context-menu");
      if (ctxMenu) {
        ctxMenu.addEventListener("click", (e) => {
          e.stopPropagation();
        });
      }
      const chatForm = document.getElementById("chat-input-form");
      const chatInput = document.getElementById("chat-input");
      const chatMessages = document.getElementById("chat-messages");
      if (chatForm && chatInput && chatMessages) {
        chatForm.addEventListener("submit", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const text = chatInput.value.trim();
          if (!text) return;
          chatInput.value = "";
          const userMsg = document.createElement("div");
          userMsg.className = "chat-msg user";
          userMsg.innerHTML = `<div class="msg-bubble">${text}</div>`;
          chatMessages.appendChild(userMsg);
          chatMessages.scrollTop = chatMessages.scrollHeight;
          setTimeout(() => {
            const roboMsg = document.createElement("div");
            roboMsg.className = "chat-msg robo";
            let reply = "I'm listening! Focus and companion tracking are active.";
            const lower = text.toLowerCase();
            if (lower.includes("focus")) reply = "Focus session is ready! Click the Focus card or tell me how many minutes to set.";
            else if (lower.includes("file") || lower.includes("tray") || lower.includes("phone")) reply = "You can drag files straight into RoboIsland to stage them and scan the QR code to download on your phone!";
            else if (lower.includes("music") || lower.includes("play")) reply = "Media session is synchronized with Windows audio controls.";
            else if (lower.includes("hi") || lower.includes("hello")) reply = "Hello! I'm Robo, your Dynamic Island companion. Everything is running smoothly.";
            roboMsg.innerHTML = `<div class="msg-bubble">${reply}</div>`;
            chatMessages.appendChild(roboMsg);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            this.mascot.sounds.playChirp();
          }, 320);
        });
      }
      const btnChatClear = document.getElementById("btn-chat-clear");
      if (btnChatClear && chatMessages) {
        btnChatClear.addEventListener("click", (e) => {
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
      const triggerTrayBrowse = async (e) => {
        e.stopPropagation();
        const added = await window.roboIsland?.trayBrowseFiles?.();
        if (added && added.length > 0) {
          this.showDomTab("tray");
          await this.loadTrayShelf(true);
          const first = added[0].split(/[/\\]/).pop() || "File";
          this.triggerAirDropHud("received", added.length > 1 ? `${first} (+${added.length - 1})` : first);
        }
      };
      const btnTrayBrowse = document.getElementById("btn-tray-browse");
      if (btnTrayBrowse) {
        btnTrayBrowse.addEventListener("click", triggerTrayBrowse);
      }
      const btnTrayAddMore = document.getElementById("btn-tray-add-more");
      if (btnTrayAddMore) {
        btnTrayAddMore.addEventListener("click", triggerTrayBrowse);
      }
      const btnTrayClear = document.getElementById("btn-tray-clear");
      if (btnTrayClear) {
        btnTrayClear.addEventListener("click", async (e) => {
          e.stopPropagation();
          await window.roboIsland?.trayClearFiles();
          this.loadTrayShelf();
        });
      }
      const btnCopyUrl = document.getElementById("btn-copy-qr-url");
      if (btnCopyUrl) {
        btnCopyUrl.addEventListener("click", (e) => {
          e.stopPropagation();
          const urlEl = document.getElementById("tray-qr-url");
          if (urlEl && urlEl.textContent) {
            navigator.clipboard.writeText(urlEl.textContent.trim());
            btnCopyUrl.textContent = "Copied!";
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
      const dropOverlay = document.getElementById("drag-drop-overlay");
      let dragDepth = 0;
      const resetDragState = () => {
        dragDepth = 0;
        this.isDraggingOver = false;
        window.roboIsland?.setDragging?.(false);
        if (dropOverlay) dropOverlay.classList.add("hidden");
      };
      window.addEventListener("dragenter", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragDepth += 1;
        this.isDraggingOver = true;
        if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
        window.roboIsland?.setDragging?.(true);
        window.roboIsland?.setInteractive(true);
        if (this.mode === "compact" || this.mode === "rest") {
          this.expand();
        }
        if (dropOverlay) dropOverlay.classList.remove("hidden");
      }, true);
      window.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.isDraggingOver = true;
        window.roboIsland?.setDragging?.(true);
        window.roboIsland?.setInteractive(true);
        if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      }, true);
      window.addEventListener("dragleave", (e) => {
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0 || e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
          resetDragState();
        }
      }, true);
      window.addEventListener("dragend", () => {
        resetDragState();
      }, true);
      window.addEventListener("drop", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetDragState();
        const fileList = [];
        if (e.dataTransfer) {
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            for (let i = 0; i < e.dataTransfer.files.length; i++) {
              fileList.push(e.dataTransfer.files[i]);
            }
          } else if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            for (let i = 0; i < e.dataTransfer.items.length; i++) {
              const item = e.dataTransfer.items[i];
              if (item.kind === "file") {
                const f = item.getAsFile();
                if (f) fileList.push(f);
              }
            }
          }
        }
        if (fileList.length > 0) {
          const filePaths = [];
          for (const f of fileList) {
            let p = "";
            if (window.roboIsland?.getPathForFile) {
              try {
                p = window.roboIsland.getPathForFile(f);
              } catch {
              }
            }
            if (!p && f.path) {
              p = f.path;
            }
            if (p && typeof p === "string" && p.length > 0) {
              filePaths.push(p);
            }
          }
          if (filePaths.length > 0 && window.roboIsland) {
            await window.roboIsland.trayAddFiles(filePaths);
            const firstFileName = filePaths[0].split(/[/\\]/).pop() || "File";
            const count = filePaths.length;
            const displayTitle = count > 1 ? `${firstFileName} (+${count - 1})` : firstFileName;
            this.triggerAirDropHud("received", displayTitle);
            this.activeTab = "tray";
            this.showDomTab("tray");
            await this.loadTrayShelf(true);
            const statusBadge = document.getElementById("tray-qr-status");
            if (statusBadge) {
              statusBadge.textContent = `${filePaths.length} file${filePaths.length > 1 ? "s" : ""} added!`;
              statusBadge.className = "qr-status-badge qr-status-success";
              statusBadge.style.color = "#00d2ff";
              statusBadge.style.background = "rgba(0, 210, 255, 0.15)";
              setTimeout(() => {
                if (statusBadge && statusBadge.textContent?.includes("added")) {
                  const isOffline = document.getElementById("tray-qr-url")?.textContent?.includes("127.0.0.1");
                  statusBadge.textContent = isOffline ? "Offline / No Wi-Fi" : "Waiting for phone...";
                  statusBadge.className = isOffline ? "qr-status-badge qr-status-warning" : "qr-status-badge qr-status-ready";
                  statusBadge.style.color = isOffline ? "#ff9f0a" : "#27c93f";
                  statusBadge.style.background = isOffline ? "rgba(255, 159, 10, 0.15)" : "rgba(39, 201, 63, 0.15)";
                }
              }, 3e3);
            }
          }
        }
      }, true);
      window.roboIsland?.onTransferActive?.((data) => {
        const statusBadge = document.getElementById("tray-qr-status");
        if (statusBadge) {
          if (data.type === "progress") {
            this.transferProgress = typeof data.percent === "number" ? data.percent : 0;
            this.transferDirection = data.direction || "download";
            this.transferProgressUntil = Date.now() + 3e3;
            const dirText = data.direction === "upload" ? "Receiving" : "Sending";
            const sizeText = data.total ? ` (${this.formatBytes(data.transferred || 0)} / ${this.formatBytes(data.total)})` : "";
            statusBadge.textContent = `${dirText}: ${data.percent}%${sizeText}`;
            statusBadge.className = "qr-status-badge qr-status-progress";
            return;
          }
          if (data.type === "connected") {
            statusBadge.textContent = "Phone opened page!";
            statusBadge.className = "qr-status-badge qr-status-ready";
            statusBadge.style.color = "#27c93f";
            statusBadge.style.background = "rgba(39, 201, 63, 0.15)";
          } else if (data.type === "download") {
            this.transferProgress = null;
            statusBadge.textContent = "Phone downloading file...";
            statusBadge.className = "qr-status-badge qr-status-success";
            statusBadge.style.color = "#00d2ff";
            statusBadge.style.background = "rgba(0, 210, 255, 0.15)";
            const name = data.name || "File";
            this.triggerAirDropHud("sent", name);
          } else if (data.type === "upload") {
            this.transferProgress = null;
            statusBadge.textContent = "File received from phone!";
            statusBadge.className = "qr-status-badge qr-status-success";
            statusBadge.style.color = "#27c93f";
            statusBadge.style.background = "rgba(39, 201, 63, 0.15)";
            const name = data.name || (data.files && data.files[0] ? data.files[0].split(/[/\\]/).pop() : "File");
            this.triggerAirDropHud("received", name);
            this.loadTrayShelf(true);
          }
          this.mascot.sounds?.playSuccess?.();
          setTimeout(() => {
            if (statusBadge) {
              const isOffline = document.getElementById("tray-qr-url")?.textContent?.includes("127.0.0.1");
              statusBadge.textContent = isOffline ? "Offline / No Wi-Fi" : "Waiting for phone...";
              statusBadge.className = isOffline ? "qr-status-badge qr-status-warning" : "qr-status-badge qr-status-ready";
              statusBadge.style.color = isOffline ? "#ff9f0a" : "#27c93f";
              statusBadge.style.background = isOffline ? "rgba(255, 159, 10, 0.15)" : "rgba(39, 201, 63, 0.15)";
            }
          }, 4e3);
        }
      });
    }
    showDomTab(tab) {
      this.currentDomTab = tab;
      if (tab === "music") {
        this.activeTab = "media";
      } else if (tab === "home") {
        this.activeTab = "home";
      } else if (tab === "ai") {
        this.activeTab = "ai";
      } else if (tab === "focus") {
        this.activeTab = "focus";
      } else if (tab === "tray") {
        this.activeTab = "tray";
      }
      this.updateTargetDimensions();
      if (!this.domOverlayEl) return;
      const navItems = this.domOverlayEl.querySelectorAll(".nav-item");
      navItems.forEach((item) => {
        if (item.dataset.tab === tab) {
          item.classList.add("active");
        } else {
          item.classList.remove("active");
        }
      });
      const titleEl = document.getElementById("status-title");
      const phoneBtn = document.getElementById("btn-phone-quick");
      this.setPopover("none");
      const panels = this.domOverlayEl.querySelectorAll(".island-panel");
      panels.forEach((p) => p.classList.remove("active"));
      const setTwoToneTitle = (a, b, tint) => {
        if (!titleEl) return;
        titleEl.innerHTML = `<span style="color:#ffffff; font-weight:700;">${a}</span><span style="color:${tint}; font-weight:700;">${b}</span>`;
      };
      if (tab === "home") {
        if (titleEl) titleEl.textContent = "";
        if (phoneBtn) phoneBtn.classList.add("hidden");
        document.getElementById("panel-home")?.classList.add("active");
      } else if (tab === "ai") {
        setTwoToneTitle("Claude ", "Code", "#d97757");
        if (phoneBtn) phoneBtn.classList.add("hidden");
        document.getElementById("panel-ai")?.classList.add("active");
      } else if (tab === "music") {
        const tint = this.albumAccentColor || "#ff375f";
        setTwoToneTitle("Music ", "Player", tint);
        if (phoneBtn) phoneBtn.classList.add("hidden");
        document.getElementById("panel-music")?.classList.add("active");
      } else if (tab === "tray") {
        setTwoToneTitle("File ", "Tray", "#ffd60a");
        if (phoneBtn) phoneBtn.classList.remove("hidden");
        document.getElementById("panel-tray")?.classList.add("active");
        this.loadTrayShelf();
      } else if (tab === "clipboard") {
        setTwoToneTitle("Clip", "board", "#64d2ff");
        if (phoneBtn) phoneBtn.classList.add("hidden");
        document.getElementById("panel-clipboard")?.classList.add("active");
        this.loadClipboardList();
      } else if (tab === "chat") {
        setTwoToneTitle("Robo ", "Chat", "#30d158");
        if (phoneBtn) phoneBtn.classList.add("hidden");
        document.getElementById("panel-chat")?.classList.add("active");
        const input = document.getElementById("chat-input");
        if (input) input.focus();
      } else if (tab === "focus") {
        setTwoToneTitle("Focus ", "Timer", "#bf5af2");
        if (phoneBtn) phoneBtn.classList.add("hidden");
        const focusPanel = document.getElementById("panel-focus");
        if (focusPanel) {
          focusPanel.classList.add("active");
        } else {
          document.getElementById("panel-home")?.classList.add("active");
        }
      } else if (tab === "settings") {
        if (titleEl) titleEl.textContent = "";
        document.getElementById("panel-home")?.classList.add("active");
        window.roboIsland?.openSettings();
      } else {
        if (titleEl) titleEl.textContent = "";
        document.getElementById("panel-home")?.classList.add("active");
      }
    }
    async loadTrayShelf(forceShowQr = false) {
      const activeView = document.getElementById("tray-active-view");
      const emptyHero = document.getElementById("tray-empty-hero");
      const shelf = document.getElementById("tray-files-shelf");
      const countLabel = document.getElementById("tray-count-label");
      const qrContainer = document.getElementById("tray-qr-container");
      const qrUrlEl = document.getElementById("tray-qr-url");
      const qrTargetEl = document.getElementById("tray-qr-target");
      const statusBadge = document.getElementById("tray-qr-status");
      if (!window.roboIsland) return;
      if (statusBadge) {
        statusBadge.textContent = "Generating QR code...";
        statusBadge.className = "qr-status-badge qr-status-loading";
        statusBadge.style.color = "#8892b0";
        statusBadge.style.background = "rgba(136, 146, 176, 0.15)";
      }
      try {
        const dropInfo = await window.roboIsland.getDropInfo();
        const files = dropInfo?.files || [];
        this.latestTrayFiles = files;
        if (files.length > 0 || forceShowQr) {
          if (emptyHero) emptyHero.classList.add("hidden");
          if (activeView) activeView.classList.remove("hidden");
          if (countLabel) countLabel.textContent = `Staged Files (${files.length})`;
          const activeFile = files.find((f) => f.isActive) || files[0] || null;
          if (qrTargetEl) {
            qrTargetEl.textContent = activeFile ? activeFile.name : "Phone Upload Mode";
            qrTargetEl.title = activeFile ? activeFile.name : "Scan QR to send files to PC";
          }
          if (shelf) {
            shelf.innerHTML = "";
            if (files.length === 0) {
              shelf.innerHTML = '<div class="tray-empty-hint" style="color:rgba(255,255,255,0.45);font-size:11px;padding:10px;text-align:center;">No files staged yet. Click + Add File or scan QR to send from phone.</div>';
            } else {
              files.forEach((f, idx) => {
                const chip = document.createElement("div");
                chip.className = f.isActive ? "tray-item-chip active-qr" : "tray-item-chip";
                if (idx === 0) {
                  chip.classList.add("airdrop-enter");
                }
                chip.title = `${f.name} - Spacebar for Quick Look, Drag to export`;
                chip.setAttribute("draggable", "true");
                chip.addEventListener("dragstart", (e) => {
                  e.preventDefault();
                  window.roboIsland?.startDragOut?.(f.path);
                });
                const infoDiv = document.createElement("div");
                infoDiv.className = "tray-item-info";
                const nameB = document.createElement("b");
                nameB.textContent = f.name;
                const sizeSpan = document.createElement("span");
                sizeSpan.className = "tray-item-size";
                sizeSpan.textContent = f.sizeFormatted || (f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.round(f.size / 1024)} KB`);
                infoDiv.appendChild(nameB);
                infoDiv.appendChild(sizeSpan);
                const actionsDiv = document.createElement("div");
                actionsDiv.className = "tray-item-actions";
                const qlBtn = document.createElement("button");
                qlBtn.className = "tray-item-btn btn-ql";
                qlBtn.title = "Quick Look Preview (Spacebar)";
                qlBtn.type = "button";
                qlBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
                qlBtn.addEventListener("click", (e) => {
                  e.stopPropagation();
                  this.openQuickLook(f.path);
                });
                const revBtn = document.createElement("button");
                revBtn.className = "tray-item-btn";
                revBtn.title = "Show in Folder";
                revBtn.type = "button";
                revBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';
                revBtn.addEventListener("click", async (e) => {
                  e.stopPropagation();
                  await window.roboIsland?.showItemInFolder?.(f.path);
                });
                const delBtn = document.createElement("button");
                delBtn.className = "tray-item-btn btn-del";
                delBtn.title = "Remove file";
                delBtn.type = "button";
                delBtn.dataset.idx = String(idx);
                delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
                delBtn.addEventListener("click", async (e) => {
                  e.stopPropagation();
                  await window.roboIsland?.trayRemoveFile(idx);
                  this.loadTrayShelf();
                });
                actionsDiv.appendChild(qlBtn);
                actionsDiv.appendChild(revBtn);
                actionsDiv.appendChild(delBtn);
                chip.addEventListener("click", async (e) => {
                  e.stopPropagation();
                  if (!f.isActive && window.roboIsland?.setDropActiveFile) {
                    await window.roboIsland.setDropActiveFile(f.path);
                    await this.loadTrayShelf(true);
                  }
                });
                chip.addEventListener("dblclick", (e) => {
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
          const isOffline = !dropInfo?.ip || dropInfo.ip === "127.0.0.1" || dropInfo.ip.startsWith("127.");
          if (isOffline) {
            if (statusBadge) {
              statusBadge.textContent = "Offline / No Wi-Fi";
              statusBadge.className = "qr-status-badge qr-status-warning";
              statusBadge.style.color = "#ff9f0a";
              statusBadge.style.background = "rgba(255, 159, 10, 0.15)";
            }
            if (qrUrlEl) {
              qrUrlEl.textContent = "Connect Wi-Fi for phone transfer";
              qrUrlEl.title = "Localhost only (127.0.0.1) \u2014 phone cannot reach this PC";
            }
          } else {
            if (statusBadge) {
              statusBadge.textContent = "Waiting for phone...";
              statusBadge.className = "qr-status-badge qr-status-ready";
              statusBadge.style.color = "#27c93f";
              statusBadge.style.background = "rgba(39, 201, 63, 0.15)";
            }
            if (qrUrlEl) {
              qrUrlEl.textContent = dropInfo.url;
              qrUrlEl.title = dropInfo.url;
            }
          }
        } else {
          if (emptyHero) emptyHero.classList.remove("hidden");
          if (activeView) activeView.classList.add("hidden");
        }
      } catch (err) {
        console.error("[CanvasEngine] loadTrayShelf failed:", err);
        if (statusBadge) {
          statusBadge.textContent = "Transfer server offline";
          statusBadge.className = "qr-status-badge qr-status-error";
          statusBadge.style.color = "#ff453a";
          statusBadge.style.background = "rgba(255, 69, 58, 0.15)";
        }
      }
    }
    async openQuickLook(filePath) {
      if (!filePath || !window.roboIsland?.getFilePreviewData) return;
      try {
        const data = await window.roboIsland.getFilePreviewData(filePath);
        if (!data || !data.exists) return;
        const modal = document.getElementById("quicklook-modal");
        const titleEl = document.getElementById("quicklook-title");
        const badgeEl = document.getElementById("quicklook-file-badge");
        const metaEl = document.getElementById("quicklook-meta");
        const bodyEl = document.getElementById("quicklook-body");
        const btnReveal = document.getElementById("quicklook-btn-reveal");
        const btnOpen = document.getElementById("quicklook-btn-open");
        const btnClose = document.getElementById("quicklook-btn-close");
        if (!modal || !bodyEl) return;
        if (titleEl) titleEl.textContent = data.name;
        if (badgeEl) badgeEl.textContent = data.ext || "FILE";
        if (metaEl) {
          const lineInfo = data.lineCount ? ` \u2022 ${data.lineCount} lines` : "";
          metaEl.textContent = `${data.sizeFormatted} \u2022 ${data.mtime}${lineInfo}`;
        }
        bodyEl.innerHTML = "";
        if (data.category === "image" && data.content) {
          const imgWrap = document.createElement("div");
          imgWrap.className = "quicklook-img-wrap";
          const img = document.createElement("img");
          img.src = data.content;
          img.alt = data.name;
          imgWrap.appendChild(img);
          bodyEl.appendChild(imgWrap);
        } else if (data.category === "text" && data.content !== void 0) {
          const pre = document.createElement("pre");
          pre.className = "quicklook-code-wrap";
          pre.textContent = data.content || "(Empty file)";
          bodyEl.appendChild(pre);
        } else {
          const binWrap = document.createElement("div");
          binWrap.className = "quicklook-binary-wrap";
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
          <div class="quicklook-binary-desc">${this.escapeHtml(data.mimeType || "Binary file")} \u2022 ${data.sizeFormatted}</div>
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
        modal.classList.remove("hidden");
        this.isQuickLookOpen = true;
        this.activeQuickLookPath = filePath;
        try {
          AudioSynth.getInstance().play("pop");
        } catch {
        }
      } catch (err) {
        console.error("[CanvasEngine] openQuickLook failed:", err);
      }
    }
    closeQuickLook() {
      const modal = document.getElementById("quicklook-modal");
      if (modal) {
        modal.classList.add("hidden");
      }
      this.isQuickLookOpen = false;
      this.activeQuickLookPath = null;
    }
    formatBytes(bytes) {
      if (!bytes || bytes < 0) return "0 B";
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
      return `${(bytes / 1073741824).toFixed(2)} GB`;
    }
    escapeHtml(str) {
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    showContextMenu(x, y) {
      const menu = document.getElementById("island-context-menu");
      if (!menu) return;
      menu.style.left = `${Math.min(window.innerWidth - 180, Math.max(10, x))}px`;
      menu.style.top = `${Math.min(window.innerHeight - 150, Math.max(10, y))}px`;
      menu.classList.remove("hidden");
    }
    async loadClipboardList() {
      const list = document.getElementById("clipboard-list");
      const empty = document.getElementById("clipboard-empty");
      if (!list || !window.roboIsland) return;
      try {
        const history = await window.roboIsland.getClipboardHistory();
        list.innerHTML = "";
        if (history && history.length > 0) {
          if (empty) empty.style.display = "none";
          history.slice(0, 5).forEach((text) => {
            const chip = document.createElement("div");
            chip.className = "clip-chip";
            chip.textContent = text.length > 50 ? text.slice(0, 48) + "\u2026" : text;
            chip.title = text;
            chip.addEventListener("click", () => {
              navigator.clipboard.writeText(text);
              this.mascot.sounds.playSuccess();
            });
            list.appendChild(chip);
          });
        } else {
          if (empty) empty.style.display = "block";
        }
      } catch {
      }
    }
    async openPhoneDrop() {
      if (!window.roboIsland) return;
      try {
        this.showDomTab("tray");
        await this.loadTrayShelf(true);
      } catch {
      }
    }
    updateDomOverlay(cx, topY) {
      if (!this.domOverlayEl) return;
      const left = cx - this.currentWidth / 2;
      this.domOverlayEl.style.left = `${cx}px`;
      this.domOverlayEl.style.top = `${topY}px`;
      this.domOverlayEl.style.width = `${this.currentWidth}px`;
      this.domOverlayEl.style.height = `${this.currentHeight}px`;
      const dtEl = document.getElementById("status-datetime");
      if (dtEl) {
        const now = /* @__PURE__ */ new Date();
        const dateStr = now.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
        const is24h = this.config?.clockFormat === "24h";
        const timeStr = is24h ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` : now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
        dtEl.textContent = `${dateStr} ${timeStr}`;
      }
      const weatherTemp = document.getElementById("weather-temp");
      const weatherCond = document.getElementById("weather-cond");
      if (weatherTemp && this.weatherState) {
        weatherTemp.textContent = this.weatherState.temp || "--\xB0C";
      }
      if (weatherCond && this.weatherState) {
        weatherCond.textContent = this.weatherState.condition || "Clear";
      }
      this.updateNetworkDom();
      if (this.albumAccentColor) {
        document.documentElement.style.setProperty("--album-tint-hex", this.albumAccentColor);
        document.documentElement.style.setProperty("--album-tint-rgb", `${this.currentTintR}, ${this.currentTintG}, ${this.currentTintB}`);
      }
      const btnHeaderMusic = document.getElementById("btn-header-music");
      if (btnHeaderMusic) {
        const isMusicPlaying = Boolean(this.mediaState.playing && this.mediaState.active);
        if (isMusicPlaying && this.currentDomTab !== "music") {
          btnHeaderMusic.classList.remove("hidden");
        } else {
          btnHeaderMusic.classList.add("hidden");
        }
      }
      const cardClaude = document.getElementById("card-claude");
      const aiStatus = document.getElementById("card-ai-status");
      const aiSub = document.getElementById("card-ai-sub");
      const aiGaugeBar = document.getElementById("card-ai-gauge-bar");
      const aiMark = document.getElementById("card-ai-mark");
      if (aiStatus && aiSub) {
        const isRunning = this.aiState.status === "running";
        if (cardClaude) cardClaude.classList.toggle("live", isRunning);
        if (aiMark) aiMark.classList.toggle("spinning", isRunning);
        if (isRunning) {
          aiStatus.textContent = "Thinking...";
          aiSub.textContent = this.aiState.currentTool || "Executing task";
          if (aiGaugeBar) {
            const part = 0.5 + 0.3 * Math.sin(performance.now() / 800);
            aiGaugeBar.style.strokeDashoffset = `${(94.2 * (1 - part)).toFixed(1)}`;
            aiGaugeBar.style.stroke = "#ffffff";
          }
        } else if (this.aiState.status === "question" || this.aiState.status === "waiting") {
          aiStatus.textContent = "May I?";
          aiSub.textContent = "Waiting for your reply";
          if (aiGaugeBar) {
            aiGaugeBar.style.strokeDashoffset = "0";
            aiGaugeBar.style.stroke = "#ff9f0a";
          }
        } else if (this.aiState.status === "done") {
          aiStatus.textContent = "Done";
          aiSub.textContent = "Every step complete";
          if (aiGaugeBar) {
            aiGaugeBar.style.strokeDashoffset = "0";
            aiGaugeBar.style.stroke = "#30d158";
          }
        } else {
          aiStatus.textContent = "Connect";
          aiSub.textContent = "in Settings";
          if (aiGaugeBar) {
            aiGaugeBar.style.strokeDashoffset = "94.2";
            aiGaugeBar.style.stroke = "#ffffff";
          }
        }
      }
      const cardMusic = document.getElementById("card-music");
      const musicTitle = document.getElementById("card-music-title");
      const musicSub = document.getElementById("card-music-sub");
      const musicCover = document.getElementById("card-music-cover");
      const musicFallback = document.getElementById("card-music-fallback");
      const musicViz = document.getElementById("card-music-viz");
      const homeMusicPlayIcon = document.getElementById("home-music-play-icon");
      const isMusicActive = Boolean(this.mediaState.active && this.mediaState.title);
      const isPlaying = Boolean(isMusicActive && this.mediaState.playing);
      if (cardMusic) cardMusic.classList.toggle("live", isPlaying);
      if (musicViz) musicViz.classList.toggle("hidden", !isPlaying);
      const coverUrl = this.mediaState.coverUrl || this.mediaState.albumArtUrl || "";
      if (musicCover && musicFallback) {
        if (isMusicActive && coverUrl) {
          if (musicCover.src !== coverUrl) musicCover.src = coverUrl;
          musicCover.classList.remove("hidden");
          musicFallback.classList.add("hidden");
        } else {
          musicCover.classList.add("hidden");
          musicFallback.classList.remove("hidden");
        }
      }
      if (musicTitle && musicSub) {
        if (isMusicActive) {
          const title = this.mediaState.title;
          musicTitle.textContent = title.length > 15 ? title.slice(0, 14) + "\u2026" : title;
          musicSub.textContent = isPlaying ? this.mediaState.artist || "Playing" : "paused";
        } else {
          musicTitle.textContent = "Quiet";
          musicSub.textContent = "Nothing playing";
        }
      }
      if (homeMusicPlayIcon) {
        homeMusicPlayIcon.innerHTML = isPlaying ? '<rect x="6" y="4" width="3.5" height="16" rx="1"/><rect x="14.5" y="4" width="3.5" height="16" rx="1"/>' : '<polygon points="7 4 19 12 7 20 7 4"/>';
      }
      const cardFocus = document.getElementById("card-focus");
      const focusTime = document.getElementById("card-focus-time");
      const focusSub = document.getElementById("card-focus-sub");
      const btnFocusToggle = document.getElementById("btn-focus-toggle");
      const f = window.__roboFocus || window.__twocodeFocus;
      const isFocusActive = f ? Boolean(f.active()) : this.focusState.active;
      const remSec = f ? isFocusActive ? Math.ceil(f.left() / 1e3) : f.chosen() : this.focusState.remainingSeconds;
      const totSec = f ? Math.ceil((isFocusActive ? f.length() : f.chosen() * 1e3) / 1e3) : this.focusState.totalSeconds || 1500;
      if (cardFocus) cardFocus.classList.toggle("live", isFocusActive);
      if (focusTime && focusSub) {
        const min = Math.floor(remSec / 60);
        const sec = remSec % 60;
        focusTime.textContent = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
        const minsLeft = Math.max(1, Math.ceil(remSec / 60));
        focusSub.textContent = isFocusActive ? this.focusState.isBreak ? "Short Break" : `${minsLeft} min left` : "Ready to start";
        if (btnFocusToggle) {
          const currentActive = btnFocusToggle.dataset.active === "true";
          if (currentActive !== isFocusActive) {
            btnFocusToggle.dataset.active = isFocusActive ? "true" : "false";
            if (!isFocusActive) {
              btnFocusToggle.dataset.lastOffset = "";
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
      const volBar = document.getElementById("nav-vol-bar");
      const volThumb = document.getElementById("nav-vol-thumb");
      const volTrack = document.getElementById("nav-vol-track");
      const level = this.volumeState.muted ? 0 : this.volumeState.level;
      if (volBar) volBar.style.width = `${level}%`;
      if (volThumb) volThumb.style.left = `${level}%`;
      if (volTrack) volTrack.setAttribute("aria-valuenow", String(level));
      const btnMute = document.getElementById("btn-quick-mute");
      if (btnMute) {
        btnMute.innerHTML = `<span class="nav-icon"><svg class="nav-svg" viewBox="0 0 24 24">${this.volumeState.muted || level === 0 ? '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>' : '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>'}</svg></span>`;
      }
    }
    formatTime(ms) {
      const totalSec = Math.floor(ms / 1e3);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      return `${m}:${String(s).padStart(2, "0")}`;
    }
  };
  if (typeof window !== "undefined") {
    const initEngine = () => {
      if (!window.__canvasEngine) {
        window.__canvasEngine = new CanvasEngine();
      }
    };
    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", initEngine);
    } else {
      initEngine();
    }
  }
})();
