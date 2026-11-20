"use strict";
/**
 * RoboIsland 2.0 - Procedural Web Audio Synthesizer & Particle System
 *
 * Direct mathematical parity with TwoCode twocode-fun.js:
 * 1. Pure Web Audio API oscillator synthesis (zero external audio files).
 * 2. 12 melodic chimes: pop, done, question, error, party, warn, hello, badge, yum, send, reply, fix.
 * 3. Configurable sound packs: klassiek, zacht, belletjes.
 * 4. Physics-based particle confetti burst for task and focus completions.
 *
 * ZERO-EMOJI ENFORCED: Source code contains zero unicode emojis.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioSynth = void 0;
const PACKS = {
    klassiek: { wave: 'sine', vol: 0.8, mul: 1, len: 1, label: 'Klassiek' },
    zacht: { wave: 'sine', vol: 0.55, mul: 0.75, len: 1.4, label: 'Zacht' },
    belletjes: { wave: 'triangle', vol: 0.9, mul: 2, len: 1.8, label: 'Belletjes' }
};
class AudioSynth {
    static instance = null;
    audioCtx = null;
    enabled = true;
    pack = 'klassiek';
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
        if (!AudioSynth.instance) {
            AudioSynth.instance = new AudioSynth();
        }
        return AudioSynth.instance;
    }
    getContext() {
        if (typeof window === 'undefined')
            return null;
        try {
            if (!this.audioCtx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx)
                    this.audioCtx = new AudioCtx();
            }
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().catch(() => { });
            }
            return this.audioCtx;
        }
        catch {
            return null;
        }
    }
    /**
     * Dual-oscillator frequency sweep with exponential gain envelope
     */
    synth(from, to, dur, vol, delay = 0) {
        if (!this.enabled)
            return;
        const ctx = this.getContext();
        if (!ctx)
            return;
        const p = PACKS[this.pack] || PACKS.klassiek;
        try {
            const t = ctx.currentTime + delay;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = p.wave;
            osc.frequency.setValueAtTime(Math.max(20, from * p.mul), t);
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, to * p.mul), t + dur * p.len);
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(vol * p.vol, t + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + dur * p.len);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + dur * p.len + 0.05);
        }
        catch { }
    }
    /**
     * TwoCode wet rounded blob tone (plop / bloop) - Direct copy from twocode-fun.js lines 334-341
     */
    blobTone(from, to, dur, gain = 0.05, at = 0) {
        if (!this.enabled)
            return;
        const c = this.getContext();
        if (!c)
            return;
        try {
            const t = c.currentTime + Math.max(0, at);
            const o = c.createOscillator();
            const g = c.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(from, t);
            o.frequency.exponentialRampToValueAtTime(to, t + dur);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(g);
            g.connect(c.destination);
            o.start(t);
            o.stop(t + dur + 0.03);
        }
        catch { }
    }
    /**
     * TwoCode chirp: sine that slides in pitch, triangle harmonic, optional trill - Direct copy from twocode-fun.js lines 317-332
     */
    chirp(at, from, to, dur, trill = 0, gain = 0.055) {
        if (!this.enabled)
            return;
        const c = this.getContext();
        if (!c)
            return;
        try {
            const t = c.currentTime + at;
            const out = c.createGain();
            out.gain.setValueAtTime(0.0001, t);
            out.gain.exponentialRampToValueAtTime(gain, t + 0.015);
            out.gain.setValueAtTime(gain, t + dur * 0.6);
            out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            out.connect(c.destination);
            const tones = [['sine', 1, 1], ['triangle', 2, 0.18]];
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
                oscillators.forEach(o => depth.connect(o.frequency));
                lfo.start(t);
                lfo.stop(t + dur + 0.05);
            }
            oscillators.forEach(o => {
                o.start(t);
                o.stop(t + dur + 0.05);
            });
        }
        catch { }
    }
    /**
     * TwoCode cheerful "hi!" upward chirp - Direct copy from twocode-fun.js line 343:
     * chirp(0, 760, 1180, 0.09); chirp(0.085, 1180, 1580, 0.2, 28);
     */
    sayHi() {
        if (!this.enabled)
            return;
        this.chirp(0, 760, 1180, 0.09);
        this.chirp(0.085, 1180, 1580, 0.2, 28);
    }
    /**
     * TwoCode goodbye chirp - Direct copy from twocode-fun.js line 344:
     * chirp(0, 1180, 940, 0.11); chirp(0.17, 1080, 640, 0.26, 24);
     */
    sayByeBye() {
        if (!this.enabled)
            return;
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
        if (!this.enabled)
            return;
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
                [740, 880, 0.10, 0.015, 0],
                [932, 1109, 0.14, 0.014, 0.08],
                [1109, 1480, 0.22, 0.012, 0.18]
            ],
            charging: [
                [523.25, 523.25, 0.12, 0.018, 0],
                [659.25, 659.25, 0.14, 0.016, 0.08],
                [783.99, 783.99, 0.24, 0.016, 0.16]
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
        if (typeof document === 'undefined')
            return;
        this.confettiCanvas = document.createElement('canvas');
        this.confettiCanvas.id = 'island-confetti-layer';
        this.confettiCanvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;';
        document.body.appendChild(this.confettiCanvas);
        this.confettiCtx = this.confettiCanvas.getContext('2d');
    }
    launchConfetti(amount = 80, originX, originY) {
        if (!this.confettiCanvas || !this.confettiCtx)
            return;
        const cx = typeof originX === 'number' ? originX : window.innerWidth / 2;
        const cy = typeof originY === 'number' ? originY : 20;
        const colours = ['#22e05a', '#ff9a1f', '#ffd166', '#4cc9f0', '#f72585', '#00e5ff', '#bf5af2'];
        for (let i = 0; i < amount; i++) {
            this.bits.push({
                x: cx + (Math.random() - 0.5) * 120,
                y: cy,
                vx: (Math.random() - 0.5) * 6,
                vy: -Math.random() * 3.5 - 1.5,
                size: 3.5 + Math.random() * 4,
                spin: Math.random() * Math.PI * 2,
                colour: colours[i % colours.length],
                life: 1.0
            });
        }
        if (!this.isConfettiRunning) {
            this.isConfettiRunning = true;
            requestAnimationFrame(this.renderConfetti.bind(this));
        }
    }
    renderConfetti() {
        if (!this.confettiCanvas || !this.confettiCtx)
            return;
        this.confettiCanvas.width = window.innerWidth;
        this.confettiCanvas.height = window.innerHeight;
        this.confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        this.bits = this.bits.filter(b => b.life > 0 && b.y < window.innerHeight + 10);
        for (const b of this.bits) {
            b.vy += 0.12;
            b.vx *= 0.99;
            b.x += b.vx;
            b.y += b.vy;
            b.spin += 0.18;
            b.life -= 0.009;
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
        }
        else {
            this.isConfettiRunning = false;
            this.confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        }
    }
}
exports.AudioSynth = AudioSynth;
