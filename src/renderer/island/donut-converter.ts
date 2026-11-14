/**
 * Donut Radial Action Wheel for RoboIsland.
 * Inspired by Filee's open-source circular drag-and-drop file converter.
 *
 * Center Circle: Drops file into Phone AirDrop / File Tray (never disturbs existing transfer flow).
 * Outer Petals: Dynamically fan out format wedges (PDF, DOCX, PNG, etc.) with lift & glow animation.
 */

export interface DonutConversionRequest {
  filePath: string;
  targetFormat: string;
}

export class DonutConverter {
  private static instance: DonutConverter | null = null;
  private containerEl: HTMLElement | null = null;
  private svgEl: SVGSVGElement | null = null;

  private currentFile: { path: string; name: string; ext: string } | null = null;
  private currentFormats: string[] = [];
  private hoveredIndex: number = -1; // -1 = center / none
  private isCenterHovered: boolean = false;
  private isProgressActive: boolean = false;

  private cx: number = 0;
  private cy: number = 0;
  private readonly innerRadius: number = 38;
  private readonly outerRadius: number = 86;
  private readonly centerRadius: number = 34;

  private constructor() {
    this.createDom();
  }

  public static getInstance(): DonutConverter {
    if (!DonutConverter.instance) {
      DonutConverter.instance = new DonutConverter();
    }
    return DonutConverter.instance;
  }

  private createDom(): void {
    let wrap = document.getElementById('donut-converter-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'donut-converter-wrap';
      wrap.className = 'donut-converter-wrap hidden';
      wrap.innerHTML = `
        <div class="donut-backdrop"></div>
        <div class="donut-interactive-stage">
          <svg id="donut-svg" class="donut-svg" viewBox="0 0 240 240" width="240" height="240">
            <defs>
              <linearGradient id="donut-petal-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#00d2ff"/>
                <stop offset="100%" stop-color="#7928ca"/>
              </linearGradient>
              <linearGradient id="donut-petal-normal" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="rgba(255, 255, 255, 0.12)"/>
                <stop offset="100%" stop-color="rgba(255, 255, 255, 0.05)"/>
              </linearGradient>
              <filter id="donut-slice-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="rgba(0, 210, 255, 0.4)"/>
              </filter>
            </defs>
            <g id="donut-wedges-group"></g>
            <g id="donut-center-group"></g>
            <g id="donut-progress-group" class="hidden"></g>
          </svg>
          <div class="donut-guide-banner">
            <span>Hover petal to <b>Convert</b> &bull; Drop in center to <b>Transfer to Phone</b></span>
          </div>
        </div>
      `;

      // Mount inside drag-drop-overlay
      const overlay = document.getElementById('drag-drop-overlay');
      if (overlay) {
        overlay.appendChild(wrap);
      } else {
        document.body.appendChild(wrap);
      }
    }

    this.containerEl = wrap;
    this.svgEl = wrap.querySelector('#donut-svg');
  }

  /**
   * Determine available conversion formats for file.
   */
  public getFormatsForFile(fileName: string): string[] {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    switch (ext) {
      case 'docx':
      case 'doc':
        return ['PDF', 'TXT', 'HTML'];
      case 'pptx':
      case 'ppt':
        return ['PDF'];
      case 'xlsx':
      case 'xls':
        return ['PDF', 'CSV'];
      case 'pdf':
        return ['DOCX', 'TXT', 'PNG'];
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'webp':
      case 'bmp':
      case 'ico':
        return ['PDF', 'PNG', 'JPG', 'WEBP', 'ICO'];
      case 'txt':
      case 'md':
        return ['PDF', 'HTML', 'DOCX'];
      default:
        return ['ZIP'];
    }
  }

  /**
   * Show Donut when files are dragged into the island.
   */
  public show(filePath: string, fileName: string): void {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    this.currentFile = { path: filePath, name: fileName, ext };
    this.currentFormats = this.getFormatsForFile(fileName);
    this.hoveredIndex = -1;
    this.isCenterHovered = true;
    this.isProgressActive = false;

    if (this.containerEl) {
      this.containerEl.classList.remove('hidden');
    }

    this.render();
  }

  public hide(): void {
    if (this.containerEl) {
      this.containerEl.classList.add('hidden');
    }
    this.currentFile = null;
    this.hoveredIndex = -1;
  }

  public isVisible(): boolean {
    return Boolean(this.containerEl && !this.containerEl.classList.contains('hidden'));
  }

  /**
   * Update mouse position during dragover for slice hit-testing.
   */
  public onDragOver(clientX: number, clientY: number): void {
    if (!this.svgEl || !this.currentFile || this.isProgressActive) return;

    const rect = this.svgEl.getBoundingClientRect();
    const x = clientX - rect.left - rect.width / 2;
    const y = clientY - rect.top - rect.height / 2;
    const dist = Math.sqrt(x * x + y * y);

    let newHovered = -1;
    let newCenterHover = false;

    if (dist <= this.innerRadius) {
      newCenterHover = true;
    } else if (dist <= this.outerRadius + 14 && this.currentFormats.length > 0) {
      // Clockwise angle from 12 o'clock in radians: 0 to 2*PI
      let angle = Math.atan2(x, -y);
      if (angle < 0) angle += 2 * Math.PI;

      const span = (2 * Math.PI) / this.currentFormats.length;
      newHovered = Math.floor(angle / span) % this.currentFormats.length;
    } else {
      newCenterHover = true; // Outside boundary treats as default phone drop
    }

    if (newHovered !== this.hoveredIndex || newCenterHover !== this.isCenterHovered) {
      this.hoveredIndex = newHovered;
      this.isCenterHovered = newCenterHover;
      this.render();
    }
  }

  /**
   * Check if a format petal was targeted on drop.
   * Returns target format string, or null if center was targeted (Phone transfer).
   */
  public getTargetOnDrop(): string | null {
    if (this.hoveredIndex >= 0 && this.hoveredIndex < this.currentFormats.length) {
      return this.currentFormats[this.hoveredIndex];
    }
    return null;
  }

  /**
   * Switch Donut to animated progress sweep.
   */
  public showProgress(format: string): void {
    this.isProgressActive = true;
    const progressGroup = document.getElementById('donut-progress-group');
    if (progressGroup) {
      progressGroup.classList.remove('hidden');
      progressGroup.innerHTML = `
        <circle cx="120" cy="120" r="48" fill="rgba(10, 11, 16, 0.92)" stroke="rgba(255, 255, 255, 0.15)" stroke-width="4"/>
        <circle class="donut-progress-arc" cx="120" cy="120" r="48" fill="none" stroke="#00d2ff" stroke-width="4" stroke-dasharray="301" stroke-dashoffset="301" stroke-linecap="round"/>
        <text x="120" y="116" text-anchor="middle" font-size="11" font-weight="700" fill="#00d2ff">CONVERTING</text>
        <text x="120" y="132" text-anchor="middle" font-size="10" font-weight="500" fill="#ffffff">To ${format}</text>
      `;
    }
  }

  /**
   * Render SVG wedges and center hub.
   */
  private render(): void {
    const wedgesGroup = document.getElementById('donut-wedges-group');
    const centerGroup = document.getElementById('donut-center-group');
    if (!wedgesGroup || !centerGroup || !this.currentFile) return;

    const count = this.currentFormats.length;
    const span = count > 0 ? (2 * Math.PI) / count : 2 * Math.PI;
    const gap = 0.04; // Gap in radians between slices
    const cx = 120;
    const cy = 120;

    // 1. Render Format Wedges
    let wedgesHtml = '';
    for (let i = 0; i < count; i++) {
      const format = this.currentFormats[i];
      const isHovered = i === this.hoveredIndex;
      const midAngle = (i + 0.5) * span;

      // Displacement vector if hovered
      const disp = isHovered ? 6 : 0;
      const dx = disp * Math.sin(midAngle);
      const dy = -disp * Math.cos(midAngle);

      const r1 = this.innerRadius;
      const r2 = isHovered ? this.outerRadius + 4 : this.outerRadius;

      const a1 = i * span + gap / 2;
      const a2 = (i + 1) * span - gap / 2;

      // Arc coordinates
      const p1 = { x: cx + dx + r2 * Math.sin(a1), y: cy + dy - r2 * Math.cos(a1) };
      const p2 = { x: cx + dx + r2 * Math.sin(a2), y: cy + dy - r2 * Math.cos(a2) };
      const p3 = { x: cx + dx + r1 * Math.sin(a2), y: cy + dy - r1 * Math.cos(a2) };
      const p4 = { x: cx + dx + r1 * Math.sin(a1), y: cy + dy - r1 * Math.cos(a1) };

      const largeArc = a2 - a1 > Math.PI ? 1 : 0;
      const pathD = `M ${p1.x} ${p1.y} A ${r2} ${r2} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${r1} ${r1} 0 ${largeArc} 0 ${p4.x} ${p4.y} Z`;

      // Label coordinate along mid radius
      const midR = (r1 + r2) / 2;
      const labelX = cx + dx + midR * Math.sin(midAngle);
      const labelY = cy + dy - midR * Math.cos(midAngle) + 3.5;

      const fill = isHovered ? 'url(#donut-petal-glow)' : 'url(#donut-petal-normal)';
      const stroke = isHovered ? '#00d2ff' : 'rgba(255, 255, 255, 0.16)';
      const strokeWidth = isHovered ? '1.8' : '1.0';
      const textColor = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.85)';
      const filter = isHovered ? 'filter="url(#donut-slice-shadow)"' : '';

      wedgesHtml += `
        <g class="donut-slice ${isHovered ? 'hovered' : ''}" ${filter}>
          <path d="${pathD}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
          <text x="${labelX}" y="${labelY}" text-anchor="middle" font-size="10.5" font-weight="${isHovered ? '700' : '600'}" fill="${textColor}" letter-spacing="0.4">
            ${format}
          </text>
        </g>
      `;
    }
    wedgesGroup.innerHTML = wedgesHtml;

    // 2. Render Center Hub
    const isCenterActive = this.hoveredIndex === -1;
    const centerStroke = isCenterActive ? '#f5c518' : 'rgba(255, 255, 255, 0.2)';
    const centerFill = isCenterActive ? 'rgba(245, 197, 24, 0.14)' : 'rgba(15, 17, 23, 0.94)';

    let titleText = this.currentFile.ext ? `1 x ${this.currentFile.ext.toUpperCase()}` : '1 File';
    let subtitleText = isCenterActive ? 'Drop: Phone Transfer' : `Drop -> ${this.currentFormats[this.hoveredIndex]}`;
    let subtitleColor = isCenterActive ? '#f5c518' : '#00d2ff';

    centerGroup.innerHTML = `
      <circle cx="${cx}" cy="${cy}" r="${this.centerRadius}" fill="${centerFill}" stroke="${centerStroke}" stroke-width="1.8"/>
      <!-- Small Phone AirDrop Icon -->
      <g transform="translate(112, 98) scale(0.65)" stroke="${isCenterActive ? '#f5c518' : '#ffffff'}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
        <line x1="12" y1="18" x2="12.01" y2="18"/>
      </g>
      <text x="${cx}" y="119" text-anchor="middle" font-size="9" font-weight="700" fill="#ffffff" letter-spacing="0.2">
        ${titleText}
      </text>
      <text x="${cx}" y="129" text-anchor="middle" font-size="7.5" font-weight="600" fill="${subtitleColor}">
        ${subtitleText}
      </text>
    `;
  }
}
