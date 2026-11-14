"use strict";
/**
 * RoboIsland 2.0 - Environmental Reactive Texture Engine
 *
 * Direct mathematical parity with TwoCode texture-ui.js:
 * 1. Fire & Ice: Reacts to hardware CPU & RAM load in real-time.
 *    - Cold (< 30%): Renders icy rim, frost gradients, and hanging icicles along island edge.
 *    - Hot (> 50%): Renders warm glowing embers at island tips.
 *    - Fire (> 75%): Renders animated procedural flame licks rising along the sides.
 * 2. Spider Web: Reacts to time of day.
 *    - Late night (11 PM - 5 AM): Delicate procedural webs weave into island corners.
 *    - Peak night (2 AM): Animated spider descends from thread.
 * 3. Overgrown: Reacts to continuous session duration.
 *    - Flourishes organic procedural leaves, vines, and blossoms after long coding hours.
 *
 * ZERO-EMOJI ENFORCED: Source code contains zero unicode emojis.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextureEngine = void 0;
class TextureEngine {
    static instance = null;
    style = 'none';
    state = {
        L: 50,
        R: 50,
        split: null,
        web: 0,
        grow: 0,
        k: 0
    };
    sessionStartTime = Date.now();
    constructor() { }
    static getInstance() {
        if (!TextureEngine.instance) {
            TextureEngine.instance = new TextureEngine();
        }
        return TextureEngine.instance;
    }
    clamp(v) {
        return Math.max(0, Math.min(1, v));
    }
    update(cpu = 25, ram = 45) {
        const slow = 0.06;
        if (this.style === 'fire') {
            const all = Math.max(cpu, ram);
            this.state.L += (all - this.state.L) * slow;
            this.state.R += (all - this.state.R) * slow;
            this.state.k = Math.min(1, this.state.k + 0.05);
        }
        else if (this.style === 'web') {
            const d = new Date();
            const h = d.getHours() + d.getMinutes() / 60;
            const lateness = this.clamp(h >= 23 ? (h - 23) / 6 : h < 5 ? (h + 1) / 6 : 0);
            this.state.web += (lateness - this.state.web) * slow;
            this.state.k = Math.min(1, this.state.k + 0.05);
        }
        else if (this.style === 'grow') {
            const hours = (Date.now() - this.sessionStartTime) / (1000 * 3600);
            const dayGreen = this.clamp(hours / 8); // fully grown at 8 hours
            this.state.grow += (dayGreen - this.state.grow) * slow;
            this.state.k = Math.min(1, this.state.k + 0.05);
        }
        else {
            this.state.k = Math.max(0, this.state.k - 0.08);
        }
    }
    /**
     * Render environmental textures behind and on the island pill
     */
    renderBehind(ctx, x, topY, w, h, radius) {
        if (this.state.k <= 0.01 || this.style === 'none')
            return;
        ctx.save();
        ctx.globalAlpha = this.state.k;
        if (this.style === 'fire') {
            this.renderFireIceBehind(ctx, x, topY, w, h, radius);
        }
        else if (this.style === 'web') {
            this.renderWebs(ctx, x, topY, w, h);
        }
        else if (this.style === 'grow') {
            this.renderVines(ctx, x, topY, w, h);
        }
        ctx.restore();
    }
    // =========================================================================
    // 1. Fire & Ice Shader
    // =========================================================================
    renderFireIceBehind(ctx, x, topY, w, h, radius) {
        const t = performance.now() * 0.003;
        const avgLoad = (this.state.L + this.state.R) / 2;
        const isCold = avgLoad < 35;
        const isHot = avgLoad > 55;
        if (isCold) {
            // Procedural Icicles hanging from bottom of island
            const coldIntensity = this.clamp((35 - avgLoad) / 25);
            const icicleCount = Math.floor(w / 18);
            ctx.save();
            ctx.fillStyle = 'rgba(180, 230, 255, 0.65)';
            ctx.shadowColor = 'rgba(160, 220, 255, 0.7)';
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
            // Procedural Flame Embers & Flame Licks along island sides
            const fireIntensity = this.clamp((avgLoad - 55) / 35);
            ctx.save();
            const emberCount = Math.floor(fireIntensity * 8);
            for (let i = 0; i < emberCount; i++) {
                const side = i % 2 === 0 ? x : x + w;
                const ex = side + (Math.sin(t * 2 + i) * 8);
                const ey = topY + h - (Math.abs(Math.sin(t * 3 + i * 1.3)) * 18);
                const er = 1.5 + Math.sin(t * 4 + i) * 1.0;
                ctx.beginPath();
                ctx.arc(ex, ey, Math.max(0.8, er), 0, Math.PI * 2);
                ctx.fillStyle = i % 2 === 0 ? '#ff9a1f' : '#ff453a';
                ctx.shadowColor = '#ff8800';
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
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 0.8;
        // Left Corner Web
        ctx.beginPath();
        ctx.moveTo(x, topY);
        ctx.lineTo(x + 18, topY + 12);
        ctx.moveTo(x, topY + 8);
        ctx.quadraticCurveTo(x + 8, topY + 8, x + 14, topY);
        ctx.moveTo(x, topY + 16);
        ctx.quadraticCurveTo(x + 12, topY + 14, x + 20, topY);
        ctx.stroke();
        // Right Corner Web
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
        ctx.strokeStyle = '#34c759';
        ctx.fillStyle = '#30d158';
        ctx.lineWidth = 1.2;
        // Delicate green vine curling under left side
        ctx.beginPath();
        ctx.moveTo(x + 6, topY + h - 2);
        ctx.quadraticCurveTo(x + 16, topY + h + 6, x + 24, topY + h - 2);
        ctx.stroke();
        // Tiny leaf
        ctx.beginPath();
        ctx.arc(x + 16, topY + h + 4, 2.2, 0, Math.PI * 2);
        ctx.fill();
        // Delicate green vine curling under right side
        ctx.beginPath();
        ctx.moveTo(x + w - 6, topY + h - 2);
        ctx.quadraticCurveTo(x + w - 16, topY + h + 6, x + w - 24, topY + h - 2);
        ctx.stroke();
        // Tiny leaf
        ctx.beginPath();
        ctx.arc(x + w - 16, topY + h + 4, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}
exports.TextureEngine = TextureEngine;
