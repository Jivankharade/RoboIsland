/**
 * RoboIsland 2.0 Project Mode Renderer UI (Milestone M7 Part B)
 * 
 * Features:
 * 1. Interactive Workspace & Git status panel (#pane-project / #panel-project).
 * 2. Workspace directory selector with instant folder index summary.
 * 3. Fast fuzzy and full-text search input with real-time ranked results.
 * 4. Dual-column layout: Search/File list and Syntax-highlighted code preview.
 * 5. Code preview with line numbers and one-click copy button.
 * 6. Git branch pill and dirty file status indicator.
 * 7. ZERO EMOJI COMPLIANCE: 100% SVG vector icons used throughout.
 */

// Browser compatibility guard for CommonJS / bundler
if (typeof exports === 'undefined') {
  (globalThis as any).exports = {};
}

export interface ProjectFileItem {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  size: number;
  formattedSize: string;
  modifiedMs: number;
  modifiedIso: string;
  isBinary: boolean;
  lineCount?: number;
}

export interface ProjectGitStatus {
  isRepo: boolean;
  branch: string;
  dirtyCount: number;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  stagedFiles: string[];
  unstagedFiles: string[];
  untrackedFiles: string[];
  isClean: boolean;
}

export interface ProjectSearchResult {
  file: ProjectFileItem;
  score: number;
  matchType: 'exact-name' | 'prefix-name' | 'contains-name' | 'fuzzy-name' | 'content';
  filenameMatches: boolean;
  snippets: Array<{
    line: number;
    text: string;
    matchStart: number;
    matchEnd: number;
  }>;
}

/**
 * 100% SVG Vector Icons (ZERO EMOJIS).
 */
export const SVG_ICONS = {
  folder: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>`,
  search: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  gitBranch: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>`,
  gitCommit: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/></svg>`,
  fileCode: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/></svg>`,
  fileText: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  check: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#34c759" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>`,
  clear: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`
};

/**
 * Escapes raw HTML special characters.
 */
export function sanitizeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format raw byte size into human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Syntax highlighter for code preview (TypeScript, JavaScript, Python, Rust, Go, JSON, Bash, CSS, HTML).
 */
export function highlightCode(code: string, lang = 'text'): string {
  const safe = sanitizeHtml(code);

  const tokenRegex = /(\/\/.*$|#.*$|\/\*[\s\S]*?\*\/)|(&quot;[\s\S]*?&quot;|&#039;[\s\S]*?&#039;|`[\s\S]*?`)|(\b(?:const|let|var|function|return|if|else|for|while|import|export|from|class|extends|interface|type|async|await|try|catch|finally|throw|new|switch|case|break|continue|default|typeof|instanceof|void|yield|null|undefined|true|false|def|self|print|elif|lambda|pass|raise|with|as|fn|pub|mut|struct|impl|match|enum|package|func|go|defer|select|chan)\b)|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\())/gm;

  return safe.replace(tokenRegex, (_match, comment, str, kw, num, fn) => {
    if (comment) return `<span class="proj-syn-comment">${comment}</span>`;
    if (str) return `<span class="proj-syn-string">${str}</span>`;
    if (kw) return `<span class="proj-syn-keyword">${kw}</span>`;
    if (num) return `<span class="proj-syn-number">${num}</span>`;
    if (fn) return `<span class="proj-syn-function">${fn}</span>`;
    return _match;
  });
}

/**
 * Generates the complete HTML template for Project Mode (#pane-project).
 */
export function buildProjectTemplate(): string {
  return `
<div class="project-container">
  <!-- Top Control Bar: Workspace Folder, Git Status, Stats -->
  <div class="project-header">
    <div class="project-header-left">
      <button id="btn-project-choose" class="project-btn project-folder-btn" title="Open Workspace Directory">
        ${SVG_ICONS.folder}
        <span id="project-folder-label">Open Workspace...</span>
      </button>

      <!-- Git Status Pill -->
      <div id="project-git-pill" class="project-git-pill hidden" title="Git Repository Status">
        ${SVG_ICONS.gitBranch}
        <span id="project-git-branch" class="git-branch-text">main</span>
        <span id="project-git-dirty" class="git-dirty-badge clean">Clean</span>
      </div>
    </div>

    <div class="project-header-right">
      <span id="project-index-stats" class="project-stats-pill">0 files</span>
      <button id="btn-project-refresh" class="project-mini-btn" title="Re-index Workspace">
        ${SVG_ICONS.refresh}
      </button>
    </div>
  </div>

  <!-- Search Input Bar -->
  <div class="project-search-bar">
    <span class="project-search-icon">${SVG_ICONS.search}</span>
    <input type="text" id="project-search-input" class="project-search-input" placeholder="Search filenames or code content..." autocomplete="off" />
    <button id="btn-project-clear-search" class="project-clear-btn hidden" title="Clear Search">
      ${SVG_ICONS.clear}
    </button>
  </div>

  <!-- Split View: File Results List & Code Preview -->
  <div class="project-split-layout">
    <!-- Left Column: Search & File Results -->
    <div class="project-list-column">
      <div class="project-column-header">
        <span id="project-results-title">Workspace Files</span>
        <span id="project-results-count" class="project-results-count">0 items</span>
      </div>
      <div id="project-file-list" class="project-file-list">
        <div id="project-list-empty" class="project-empty-state">
          ${SVG_ICONS.folder}
          <p>No workspace opened. Click "Open Workspace" to index files.</p>
        </div>
      </div>
    </div>

    <!-- Right Column: Syntax-Highlighted Code Preview -->
    <div class="project-preview-column">
      <div class="project-preview-header">
        <div class="project-preview-meta">
          <span id="project-preview-filename" class="preview-filename">No file selected</span>
          <span id="project-preview-size" class="preview-meta-tag hidden">0 B</span>
          <span id="project-preview-lines" class="preview-meta-tag hidden">0 lines</span>
        </div>
        <button id="btn-project-copy" class="project-btn project-copy-btn hidden" title="Copy Code to Clipboard">
          <span id="project-copy-icon">${SVG_ICONS.copy}</span>
          <span id="project-copy-text">Copy</span>
        </button>
      </div>
      <div id="project-preview-body" class="project-preview-body">
        <div id="project-preview-empty" class="project-empty-state">
          ${SVG_ICONS.fileCode}
          <p>Select a file to inspect content and syntax</p>
        </div>
        <div id="project-code-wrapper" class="project-code-wrapper hidden">
          <div id="project-line-gutter" class="project-line-gutter"></div>
          <pre id="project-code-content" class="project-code-content"></pre>
        </div>
      </div>
    </div>
  </div>
</div>
`;
}

/**
 * ProjectUI Component Controller.
 */
export class ProjectUI {
  private panel: HTMLElement | null = null;
  private btnChoose: HTMLElement | null = null;
  private folderLabel: HTMLElement | null = null;
  private gitPill: HTMLElement | null = null;
  private gitBranch: HTMLElement | null = null;
  private gitDirty: HTMLElement | null = null;
  private indexStats: HTMLElement | null = null;
  private btnRefresh: HTMLElement | null = null;

  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;

  private fileList: HTMLElement | null = null;
  private listEmpty: HTMLElement | null = null;
  private resultsTitle: HTMLElement | null = null;
  private resultsCount: HTMLElement | null = null;

  private previewFilename: HTMLElement | null = null;
  private previewSize: HTMLElement | null = null;
  private previewLines: HTMLElement | null = null;
  private btnCopy: HTMLElement | null = null;
  private copyIcon: HTMLElement | null = null;
  private copyText: HTMLElement | null = null;
  private previewEmpty: HTMLElement | null = null;
  private codeWrapper: HTMLElement | null = null;
  private lineGutter: HTMLElement | null = null;
  private codeContent: HTMLElement | null = null;

  private currentWorkspaceRoot: string = '';
  private currentFiles: ProjectFileItem[] = [];
  private currentGitStatus: ProjectGitStatus | null = null;
  private selectedRelativePath: string | null = null;
  private rawSelectedCode: string = '';

  constructor(mountParentId?: string) {
    if (typeof document === 'undefined') {
      // In headless test mode without DOM
      return;
    }
    this.mount(mountParentId);
  }

  /**
   * Mounts the ProjectUI into the DOM (#pane-project or #panel-project).
   */
  public mount(mountParentId: string = 'island-panel-container'): void {
    if (typeof document === 'undefined') return;

    let panel = document.getElementById('pane-project') || document.getElementById('panel-project');

    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'pane-project';
      panel.className = 'island-panel project-panel';
      panel.innerHTML = buildProjectTemplate();

      const container = document.getElementById(mountParentId) ||
                        document.getElementById('expanded-island-overlay') ||
                        document.body;
      container.appendChild(panel);
    } else if (!panel.innerHTML.trim()) {
      panel.innerHTML = buildProjectTemplate();
    }

    this.panel = panel;
    this.bindDomElements();
    this.setupEventListeners();
  }

  private bindDomElements(): void {
    if (!this.panel) return;

    this.btnChoose = this.panel.querySelector('#btn-project-choose');
    this.folderLabel = this.panel.querySelector('#project-folder-label');
    this.gitPill = this.panel.querySelector('#project-git-pill');
    this.gitBranch = this.panel.querySelector('#project-git-branch');
    this.gitDirty = this.panel.querySelector('#project-git-dirty');
    this.indexStats = this.panel.querySelector('#project-index-stats');
    this.btnRefresh = this.panel.querySelector('#btn-project-refresh');

    this.searchInput = this.panel.querySelector('#project-search-input');
    this.btnClearSearch = this.panel.querySelector('#btn-project-clear-search');

    this.fileList = this.panel.querySelector('#project-file-list');
    this.listEmpty = this.panel.querySelector('#project-list-empty');
    this.resultsTitle = this.panel.querySelector('#project-results-title');
    this.resultsCount = this.panel.querySelector('#project-results-count');

    this.previewFilename = this.panel.querySelector('#project-preview-filename');
    this.previewSize = this.panel.querySelector('#project-preview-size');
    this.previewLines = this.panel.querySelector('#project-preview-lines');
    this.btnCopy = this.panel.querySelector('#btn-project-copy');
    this.copyIcon = this.panel.querySelector('#project-copy-icon');
    this.copyText = this.panel.querySelector('#project-copy-text');
    this.previewEmpty = this.panel.querySelector('#project-preview-empty');
    this.codeWrapper = this.panel.querySelector('#project-code-wrapper');
    this.lineGutter = this.panel.querySelector('#project-line-gutter');
    this.codeContent = this.panel.querySelector('#project-code-content');
  }

  private setupEventListeners(): void {
    // Choose folder button
    if (this.btnChoose) {
      this.btnChoose.addEventListener('click', async () => {
        await this.handleChooseFolder();
      });
    }

    // Refresh button
    if (this.btnRefresh) {
      this.btnRefresh.addEventListener('click', async () => {
        if (this.currentWorkspaceRoot) {
          await this.loadWorkspace(this.currentWorkspaceRoot);
        }
      });
    }

    // Search input
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => {
        const query = this.searchInput?.value || '';
        if (this.btnClearSearch) {
          this.btnClearSearch.classList.toggle('hidden', !query);
        }
        this.performSearch(query);
      });
    }

    // Clear search button
    if (this.btnClearSearch && this.searchInput) {
      this.btnClearSearch.addEventListener('click', () => {
        this.searchInput!.value = '';
        this.btnClearSearch!.classList.add('hidden');
        this.performSearch('');
      });
    }

    // Copy code button
    if (this.btnCopy) {
      this.btnCopy.addEventListener('click', () => {
        this.copyCurrentCode();
      });
    }
  }

  /**
   * Triggers folder selection via Electron IPC or dialog.
   */
  public async handleChooseFolder(): Promise<string | null> {
    try {
      const electron = (window as any).electron || (window as any).roboIsland;
      let folderPath: string | null = null;

      if (electron?.chooseProjectFolder) {
        folderPath = await electron.chooseProjectFolder();
      } else if (electron?.ipcRenderer?.invoke) {
        folderPath = await electron.ipcRenderer.invoke('project:choose-folder');
      }

      if (folderPath) {
        await this.loadWorkspace(folderPath);
        return folderPath;
      }
    } catch (err) {
      console.error('[ProjectUI] Error opening folder:', err);
    }
    return null;
  }

  /**
   * Loads and indexes a workspace path.
   */
  public async loadWorkspace(dirPath: string): Promise<void> {
    this.currentWorkspaceRoot = dirPath;

    // Update folder label
    if (this.folderLabel) {
      const shortName = dirPath.replace(/\\/g, '/').split('/').pop() || dirPath;
      this.folderLabel.textContent = shortName;
      this.btnChoose?.setAttribute('title', dirPath);
    }

    try {
      const electron = (window as any).electron || (window as any).roboIsland;
      let indexResult: any = null;

      if (electron?.indexWorkspace) {
        indexResult = await electron.indexWorkspace(dirPath);
      } else if (electron?.ipcRenderer?.invoke) {
        indexResult = await electron.ipcRenderer.invoke('project:index-workspace', dirPath);
      }

      if (indexResult) {
        this.currentFiles = indexResult.files || [];
        this.currentGitStatus = indexResult.gitStatus || null;
        this.updateStats(indexResult.fileCount, indexResult.capped, indexResult.durationMs);
        this.updateGitStatus(this.currentGitStatus);
        this.renderFileList(this.currentFiles);

        // Auto-select first file if available
        if (this.currentFiles.length > 0) {
          this.selectFile(this.currentFiles[0].relativePath);
        }
      }
    } catch (err) {
      console.error('[ProjectUI] Indexing failed:', err);
    }
  }

  /**
   * Updates Git status badge and branch name pill.
   */
  public updateGitStatus(status: ProjectGitStatus | null): void {
    if (!this.gitPill || !this.gitBranch || !this.gitDirty) return;

    if (!status || !status.isRepo) {
      this.gitPill.classList.add('hidden');
      return;
    }

    this.gitPill.classList.remove('hidden');
    this.gitBranch.textContent = status.branch || 'HEAD';

    if (status.isClean) {
      this.gitDirty.className = 'git-dirty-badge clean';
      this.gitDirty.textContent = 'Clean';
      this.gitDirty.setAttribute('title', 'Git repository working tree is clean');
    } else {
      this.gitDirty.className = 'git-dirty-badge dirty';
      this.gitDirty.textContent = `${status.dirtyCount} modified`;
      this.gitDirty.setAttribute('title', `${status.stagedCount} staged, ${status.unstagedCount} unstaged, ${status.untrackedCount} untracked`);
    }
  }

  /**
   * Updates file count and indexing latency stats pill.
   */
  public updateStats(count: number, capped: boolean, durationMs?: number): void {
    if (!this.indexStats) return;
    const cappedText = capped ? ' (capped at 500)' : '';
    const durText = durationMs !== undefined ? ` · ${durationMs}ms` : '';
    this.indexStats.textContent = `${count} files${cappedText}${durText}`;
  }

  /**
   * Performs real-time search and renders results.
   */
  public async performSearch(query: string): Promise<void> {
    const trimmed = query.trim();

    if (!trimmed) {
      if (this.resultsTitle) this.resultsTitle.textContent = 'Workspace Files';
      if (this.resultsCount) this.resultsCount.textContent = `${this.currentFiles.length} items`;
      this.renderFileList(this.currentFiles);
      return;
    }

    try {
      const electron = (window as any).electron || (window as any).roboIsland;
      let searchResults: ProjectSearchResult[] = [];

      if (electron?.searchProject) {
        searchResults = await electron.searchProject(trimmed);
      } else if (electron?.ipcRenderer?.invoke) {
        searchResults = await electron.ipcRenderer.invoke('project:search', trimmed);
      } else {
        // In-memory fallback search if offline/mock
        searchResults = this.fallbackSearch(trimmed);
      }

      if (this.resultsTitle) this.resultsTitle.textContent = 'Search Results';
      if (this.resultsCount) this.resultsCount.textContent = `${searchResults.length} matches`;

      this.renderSearchResults(searchResults, trimmed);
    } catch (err) {
      console.error('[ProjectUI] Search failed:', err);
    }
  }

  /**
   * Renders standard file list.
   */
  public renderFileList(files: ProjectFileItem[]): void {
    if (!this.fileList) return;
    this.fileList.innerHTML = '';

    if (files.length === 0) {
      if (this.listEmpty) {
        this.fileList.appendChild(this.listEmpty);
      }
      return;
    }

    for (const file of files) {
      const itemEl = document.createElement('div');
      itemEl.className = `project-file-item ${file.relativePath === this.selectedRelativePath ? 'active' : ''}`;
      itemEl.dataset.path = file.relativePath;

      const icon = file.isBinary ? SVG_ICONS.fileText : SVG_ICONS.fileCode;

      itemEl.innerHTML = `
        <div class="file-item-left">
          <span class="file-item-icon">${icon}</span>
          <div class="file-item-info">
            <span class="file-item-name">${sanitizeHtml(file.name)}</span>
            <span class="file-item-relpath">${sanitizeHtml(file.relativePath)}</span>
          </div>
        </div>
        <div class="file-item-right">
          <span class="file-item-size">${file.formattedSize}</span>
        </div>
      `;

      itemEl.addEventListener('click', () => {
        this.selectFile(file.relativePath);
      });

      this.fileList.appendChild(itemEl);
    }
  }

  /**
   * Renders search results with match type badges and code snippets.
   */
  public renderSearchResults(results: ProjectSearchResult[], query: string): void {
    if (!this.fileList) return;
    this.fileList.innerHTML = '';

    if (results.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'project-empty-state';
      empty.innerHTML = `
        ${SVG_ICONS.search}
        <p>No matching files or code content found for "${sanitizeHtml(query)}"</p>
      `;
      this.fileList.appendChild(empty);
      return;
    }

    for (const res of results) {
      const file = res.file;
      const itemEl = document.createElement('div');
      itemEl.className = `project-file-item ${file.relativePath === this.selectedRelativePath ? 'active' : ''}`;
      itemEl.dataset.path = file.relativePath;

      let badgeClass = 'badge-name';
      let badgeLabel = 'Name';
      if (res.matchType === 'exact-name') {
        badgeClass = 'badge-exact';
        badgeLabel = 'Exact';
      } else if (res.matchType === 'prefix-name') {
        badgeClass = 'badge-prefix';
        badgeLabel = 'Prefix';
      } else if (res.matchType === 'fuzzy-name') {
        badgeClass = 'badge-fuzzy';
        badgeLabel = 'Fuzzy';
      } else if (res.matchType === 'content') {
        badgeClass = 'badge-content';
        badgeLabel = 'Content';
      }

      let snippetsHtml = '';
      if (res.snippets && res.snippets.length > 0) {
        snippetsHtml = `
          <div class="file-item-snippets">
            ${res.snippets.map((sn) => `
              <div class="snippet-line">
                <span class="snippet-lineno">L${sn.line}:</span>
                <span class="snippet-text">${sanitizeHtml(sn.text)}</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      itemEl.innerHTML = `
        <div class="file-item-top">
          <div class="file-item-left">
            <span class="file-item-icon">${SVG_ICONS.fileCode}</span>
            <div class="file-item-info">
              <span class="file-item-name">${sanitizeHtml(file.name)}</span>
              <span class="file-item-relpath">${sanitizeHtml(file.relativePath)}</span>
            </div>
          </div>
          <div class="file-item-right">
            <span class="match-badge ${badgeClass}">${badgeLabel}</span>
            <span class="file-item-size">${file.formattedSize}</span>
          </div>
        </div>
        ${snippetsHtml}
      `;

      itemEl.addEventListener('click', () => {
        this.selectFile(file.relativePath);
      });

      this.fileList.appendChild(itemEl);
    }
  }

  /**
   * Selects and loads a file into the syntax-highlighted code preview.
   */
  public async selectFile(relativePath: string): Promise<void> {
    this.selectedRelativePath = relativePath;

    // Update active highlight in file list
    if (this.fileList) {
      const items = this.fileList.querySelectorAll('.project-file-item');
      items.forEach((item) => {
        const el = item as HTMLElement;
        el.classList.toggle('active', el.dataset.path === relativePath);
      });
    }

    try {
      const electron = (window as any).electron || (window as any).roboIsland;
      let previewData: any = null;

      if (electron?.getFilePreview) {
        previewData = await electron.getFilePreview(relativePath);
      } else if (electron?.ipcRenderer?.invoke) {
        previewData = await electron.ipcRenderer.invoke('project:get-file-preview', relativePath);
      }

      if (previewData) {
        this.renderPreview(previewData.file, previewData.content, previewData.lines);
      }
    } catch (err) {
      console.error('[ProjectUI] Error loading preview:', err);
    }
  }

  /**
   * Renders code preview with line numbers and copy button.
   */
  public renderPreview(file: ProjectFileItem, content: string, lines: string[]): void {
    this.rawSelectedCode = content || '';

    if (this.previewFilename) this.previewFilename.textContent = file.name;
    if (this.previewSize) {
      this.previewSize.textContent = file.formattedSize;
      this.previewSize.classList.remove('hidden');
    }
    if (this.previewLines) {
      this.previewLines.textContent = `${lines ? lines.length : 0} lines`;
      this.previewLines.classList.remove('hidden');
    }
    if (this.btnCopy) {
      this.btnCopy.classList.remove('hidden');
      if (this.copyIcon) this.copyIcon.innerHTML = SVG_ICONS.copy;
      if (this.copyText) this.copyText.textContent = 'Copy';
    }

    if (this.previewEmpty) this.previewEmpty.classList.add('hidden');
    if (this.codeWrapper) this.codeWrapper.classList.remove('hidden');

    // Build line numbers gutter
    if (this.lineGutter && lines) {
      const lineNos = lines.map((_, idx) => `<span>${idx + 1}</span>`).join('');
      this.lineGutter.innerHTML = lineNos;
    }

    // Build syntax-highlighted code content
    if (this.codeContent) {
      const ext = file.extension.replace('.', '');
      this.codeContent.innerHTML = highlightCode(content, ext);
    }
  }

  /**
   * Copies currently selected code to clipboard.
   */
  public async copyCurrentCode(): Promise<void> {
    if (!this.rawSelectedCode) return;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(this.rawSelectedCode);
      }
      if (this.copyIcon) this.copyIcon.innerHTML = SVG_ICONS.check;
      if (this.copyText) this.copyText.textContent = 'Copied!';

      setTimeout(() => {
        if (this.copyIcon) this.copyIcon.innerHTML = SVG_ICONS.copy;
        if (this.copyText) this.copyText.textContent = 'Copy';
      }, 1500);
    } catch (err) {
      console.error('[ProjectUI] Failed to copy code:', err);
    }
  }

  /**
   * Fallback in-memory search for test runs or disconnected mode.
   */
  private fallbackSearch(query: string): ProjectSearchResult[] {
    const qLower = query.toLowerCase();
    const results: ProjectSearchResult[] = [];

    for (const f of this.currentFiles) {
      const nameLower = f.name.toLowerCase();
      if (nameLower.includes(qLower)) {
        results.push({
          file: f,
          score: nameLower === qLower ? 1000 : 500,
          matchType: nameLower === qLower ? 'exact-name' : 'contains-name',
          filenameMatches: true,
          snippets: []
        });
      }
    }

    return results;
  }

  // Getters for testing
  public getPanel(): HTMLElement | null {
    return this.panel;
  }

  public getRawCode(): string {
    return this.rawSelectedCode;
  }
}

// Auto-initialize when running in browser / electron DOM
if (typeof window !== 'undefined') {
  const initProjectUI = () => {
    if (!(window as any).__projectUI) {
      (window as any).__projectUI = new ProjectUI();
    }
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initProjectUI);
  } else {
    initProjectUI();
  }
}
