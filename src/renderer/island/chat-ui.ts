/**
 * RoboIsland AI Chat UI & Markdown Streaming Engine
 * Provides rich streaming markdown rendering, code blocks with syntax highlighting,
 * copy-to-clipboard buttons with visual feedback, conversation history persistence,
 * multi-provider routing (OpenAI, Claude, Custom), and Voice I/O (Win+H & TTS).
 * ZERO emoji compliance: uses SVG vectors throughout.
 */

// Browser compatibility guard
if (typeof exports === 'undefined') {
  (globalThis as any).exports = {};
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'robo';
  text: string;
  timestamp: number;
  provider?: string;
  imageData?: string;
}

const SVG_ICONS = {
  copy: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  check: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#34c759" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  close: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  speaker: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
  speakerMuted: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`,
  export: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`
};

/**
 * Escapes raw HTML special characters to prevent injection.
 */
export function sanitizeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Syntax highlighters for common languages (JS, TS, Python, Bash, JSON, etc.)
 */
export function highlightSyntax(code: string, lang = 'text'): string {
  const safe = sanitizeHtml(code);

  const tokenRegex = /(\/\/.*$|#.*$|\/\*[\s\S]*?\*\/)|(&quot;[\s\S]*?&quot;|&#039;[\s\S]*?&#039;|`[\s\S]*?`)|(\b(?:const|let|var|function|return|if|else|for|while|import|export|from|class|extends|interface|type|async|await|try|catch|finally|throw|new|switch|case|break|continue|default|typeof|instanceof|void|yield|null|undefined|true|false|def|self|print|elif|lambda|pass|raise|with|as|echo|sudo)\b)|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\())/gm;

  return safe.replace(tokenRegex, (_match, comment, str, kw, num, fn) => {
    if (comment) return `<span class="syn-cmt">${comment}</span>`;
    if (str) return `<span class="syn-str">${str}</span>`;
    if (kw) return `<span class="syn-kw">${kw}</span>`;
    if (num) return `<span class="syn-num">${num}</span>`;
    if (fn) return `<span class="syn-fn">${fn}</span>`;
    return _match;
  });
}

/**
 * Streaming Markdown Renderer
 * Parses code blocks, inline code, bold, italics, headers, lists, blockquotes, and linebreaks.
 * Renders copy buttons on code blocks with visual feedback.
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') return '';

  try {
    const codeBlocks: string[] = [];

    // 1. Extract closed code blocks
    let text = markdown.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g, (_match, lang, code) => {
      const language = (lang || 'code').trim().toLowerCase();
      const rawCode = code.trimEnd();
      const highlighted = highlightSyntax(rawCode, language);
      const encodedRaw = encodeURIComponent(rawCode);

      const blockHtml = `
<div class="code-block-wrapper">
  <div class="code-block-header">
    <span class="code-lang-label">${sanitizeHtml(language)}</span>
    <button class="btn-copy-code" data-code="${encodedRaw}" title="Copy Code">
      <span class="copy-icon">${SVG_ICONS.copy}</span>
      <span class="copy-label">Copy</span>
    </button>
  </div>
  <pre class="code-block-content"><code>${highlighted}</code></pre>
</div>`.trim();

      const placeholder = `@@ROBOCODEBLOCK${codeBlocks.length}@@`;
      codeBlocks.push(blockHtml);
      return placeholder;
    });

    // 2. Extract unclosed code block during active streaming
    text = text.replace(/```([a-zA-Z0-9_-]*)\r?\n?([\s\S]*)$/g, (_match, lang, code) => {
      const language = (lang || 'code').trim().toLowerCase();
      const rawCode = code;
      const highlighted = highlightSyntax(rawCode, language);
      const encodedRaw = encodeURIComponent(rawCode);

      const blockHtml = `
<div class="code-block-wrapper streaming">
  <div class="code-block-header">
    <span class="code-lang-label">${sanitizeHtml(language)} (streaming)</span>
    <button class="btn-copy-code" data-code="${encodedRaw}" title="Copy Code">
      <span class="copy-icon">${SVG_ICONS.copy}</span>
      <span class="copy-label">Copy</span>
    </button>
  </div>
  <pre class="code-block-content"><code>${highlighted}</code></pre>
</div>`.trim();

      const placeholder = `@@ROBOCODEBLOCK${codeBlocks.length}@@`;
      codeBlocks.push(blockHtml);
      return placeholder;
    });

    // 3. Extract inline code
    const inlineCodes: string[] = [];
    text = text.replace(/`([^`]+)`/g, (_match, code) => {
      const placeholder = `@@ROBOINLINE${inlineCodes.length}@@`;
      inlineCodes.push(`<code class="inline-code">${sanitizeHtml(code)}</code>`);
      return placeholder;
    });

    // 4. Blockquotes
    text = text.replace(/^>\s+(.+)$/gm, '<blockquote class="chat-quote">$1</blockquote>');

    // 5. Headers (# H1, ## H2, ### H3)
    text = text.replace(/^###\s+(.+)$/gm, '<h4 class="chat-h4">$1</h4>');
    text = text.replace(/^##\s+(.+)$/gm, '<h3 class="chat-h3">$1</h3>');
    text = text.replace(/^#\s+(.+)$/gm, '<h2 class="chat-h2">$1</h2>');

    // 6. Bold & Italics
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    text = text.replace(/_([^_]+)_/g, '<em>$1</em>');

    // 7. Bullet lists (- item or * item)
    text = text.replace(/^[\*\-]\s+(.+)$/gm, '<li class="chat-li">$1</li>');
    text = text.replace(/((?:<li class="chat-li">.*<\/li>\s*)+)/g, '<ul class="chat-ul">$1</ul>');

    // 8. Numbered lists (1. item)
    text = text.replace(/^\d+\.\s+(.+)$/gm, '<li class="chat-oli">$1</li>');
    text = text.replace(/((?:<li class="chat-oli">.*<\/li>\s*)+)/g, '<ol class="chat-ol">$1</ol>');

    // 9. Line breaks (preserve spacing outside tags)
    text = text.replace(/\n/g, '<br>');

    // 10. Restore code blocks & inline code
    for (let i = 0; i < codeBlocks.length; i++) {
      text = text.replace(`@@ROBOCODEBLOCK${i}@@`, codeBlocks[i]);
    }
    for (let i = 0; i < inlineCodes.length; i++) {
      text = text.replace(`@@ROBOINLINE${i}@@`, inlineCodes[i]);
    }

    return text;
  } catch (err) {
    // Plaintext fallback on parser error
    console.warn('[renderMarkdown] Parser error, using plaintext fallback:', err);
    return sanitizeHtml(markdown).replace(/\n/g, '<br>');
  }
}

/**
 * Chat UI Stylesheet Injection
 */
function injectChatStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('roboisland-chat-ui-styles')) return;

  const style = document.createElement('style');
  style.id = 'roboisland-chat-ui-styles';
  style.textContent = `
    .chat-container {
      overflow-x: hidden !important;
    }
    .chat-messages {
      overflow-x: hidden !important;
      overflow-y: auto !important;
      scrollbar-width: none !important;
    }
    .chat-messages::-webkit-scrollbar {
      width: 4px !important;
      height: 0px !important;
    }
    .chat-messages::-webkit-scrollbar-track {
      background: transparent !important;
    }
    .chat-messages::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.18) !important;
      border-radius: 4px !important;
    }
    .chat-messages::-webkit-scrollbar-button {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
    }
    .chat-header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .chat-provider-select,
    .chat-model-select {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: #e2e8f0;
      border-radius: 6px;
      font-size: 10px;
      padding: 2px 6px;
      outline: none;
      cursor: pointer;
      max-width: 130px;
    }
    .chat-model-select {
      color: #38bdf8;
      border-color: rgba(56, 189, 248, 0.3);
    }
    .chat-model-select.hidden {
      display: none !important;
    }
    .chat-provider-select option,
    .chat-model-select option {
      background: #16181f;
      color: #fff;
    }
    .chat-tool-btn.active {
      color: #00d2ff;
      background: rgba(0, 210, 255, 0.15);
    }
    .chat-input-bar .chat-vision-btn,
    .chat-input-bar .chat-mic-btn {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      border-radius: 50%;
      transition: all 0.2s;
    }
    .chat-input-bar .chat-vision-btn:hover,
    .chat-input-bar .chat-mic-btn:hover {
      color: #00d2ff;
      background: rgba(255, 255, 255, 0.1);
    }
    .chat-input-bar .chat-vision-btn.capturing {
      color: #00d2ff;
      transform: scale(1.15);
    }
    .chat-input-bar .chat-mic-btn.listening {
      color: #ff3b30;
      animation: pulseMic 1.2s infinite ease-in-out;
    }
    @keyframes pulseMic {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.4); }
      70% { transform: scale(1.1); box-shadow: 0 0 0 8px rgba(255, 59, 48, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 59, 48, 0); }
    }
    .chat-attachment-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 10px;
      margin: 0 10px 4px 10px;
      background: rgba(0, 210, 255, 0.08);
      border: 1px solid rgba(0, 210, 255, 0.25);
      border-radius: 8px;
      animation: slideInAttachment 0.2s ease-out;
    }
    .chat-attachment-bar.hidden {
      display: none !important;
    }
    @keyframes slideInAttachment {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .chat-attachment-thumb {
      width: 32px;
      height: 20px;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .chat-attachment-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .chat-attachment-label {
      font-size: 11px;
      font-weight: 600;
      color: #00d2ff;
    }
    .chat-attachment-sub {
      font-size: 9px;
      color: rgba(255, 255, 255, 0.5);
    }
    .chat-attachment-remove-btn {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px;
      border-radius: 4px;
      transition: all 0.15s;
    }
    .chat-attachment-remove-btn:hover {
      color: #ff3b30;
      background: rgba(255, 59, 48, 0.15);
    }
    .msg-attachment-thumb-wrap {
      margin-bottom: 6px;
    }
    .msg-attachment-thumb {
      max-width: 180px;
      max-height: 100px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      cursor: pointer;
      transition: transform 0.2s;
    }
    .msg-attachment-thumb:hover {
      transform: scale(1.03);
    }
    .code-block-wrapper {
      margin: 6px 0;
      border-radius: 6px;
      background: #11141a;
      border: 1px solid rgba(255, 255, 255, 0.1);
      overflow: hidden;
      font-family: 'Consolas', 'Courier New', monospace;
    }
    .code-block-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3px 8px;
      background: rgba(255, 255, 255, 0.05);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 10px;
    }
    .code-lang-label {
      color: #94a3b8;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .btn-copy-code {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #cbd5e1;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9.5px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.2s ease;
    }
    .btn-copy-code:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      border-color: rgba(255, 255, 255, 0.3);
    }
    .btn-copy-code.copied {
      background: rgba(52, 199, 89, 0.2);
      border-color: #34c759;
      color: #34c759;
    }
    .code-block-content {
      margin: 0;
      padding: 6px 10px;
      overflow-x: auto;
      font-size: 11px;
      line-height: 1.45;
      color: #f1f5f9;
      white-space: pre;
    }
    .inline-code {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 3px;
      padding: 1px 4px;
      font-family: 'Consolas', monospace;
      font-size: 10.5px;
      color: #38bdf8;
    }
    .chat-quote {
      margin: 4px 0;
      padding-left: 8px;
      border-left: 2px solid #00d2ff;
      color: #94a3b8;
      font-style: italic;
    }
    .chat-h2 { font-size: 13px; font-weight: 700; margin: 4px 0 2px; color: #fff; }
    .chat-h3 { font-size: 12px; font-weight: 600; margin: 3px 0 2px; color: #f8fafc; }
    .chat-h4 { font-size: 11.5px; font-weight: 600; margin: 2px 0 1px; color: #e2e8f0; }
    .chat-ul, .chat-ol { margin: 4px 0; padding-left: 18px; }
    .chat-li, .chat-oli { margin: 2px 0; }
    .syn-kw { color: #f43f5e; font-weight: 600; }
    .syn-str { color: #10b981; }
    .syn-cmt { color: #64748b; font-style: italic; }
    .syn-num { color: #f59e0b; }
    .syn-fn { color: #38bdf8; }
    .streaming-cursor {
      display: inline-block;
      width: 6px;
      height: 11px;
      background: #00d2ff;
      margin-left: 2px;
      vertical-align: middle;
      animation: blinkCursor 0.8s infinite;
    }
    @keyframes blinkCursor {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    /* TwoCode AI Quick Action Chips & Frosted Glass */
    .chat-quick-chips.cr-list {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin: 8px 10px 4px 10px;
      max-width: 100%;
      pointer-events: auto;
      flex-wrap: wrap;
    }
    .cr-row {
      flex: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 30px;
      padding: 0 12px 0 10px;
      border: 0;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
      font: 500 12.5px Inter, "Segoe UI", sans-serif;
      white-space: nowrap;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s ease-out;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.09);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }
    .cr-row:hover {
      background: rgba(255, 255, 255, 0.16);
    }
    .cr-row:active {
      transform: scale(0.97);
    }
    .cr-row svg {
      flex: none;
      color: var(--k);
    }
  `;
  document.head.appendChild(style);
}

/**
 * Controller class for the embedded Chat UI in #panel-chat.
 */
export class ChatUI {
  private static instance: ChatUI | null = null;
  private messages: ChatMessage[] = [];
  private currentProvider: 'openai' | 'anthropic' | 'custom' | 'ollama' | 'gemini' = 'gemini';
  private currentModel = '';
  private ttsEnabled = false;
  private isStreaming = false;
  private activeAssistantBubble: HTMLElement | null = null;
  private activeAssistantText = '';
  private pendingImageData: string | null = null;

  private constructor() {
    this.loadState();
    this.enhanceUI();
    this.attachEvents();
    this.restoreMessages();
    if (this.currentProvider === 'ollama') {
      this.refreshOllamaModels();
    } else if (this.currentProvider === 'gemini') {
      this.setupGeminiModels();
    }
  }

  public static init(): ChatUI {
    if (!ChatUI.instance) {
      ChatUI.instance = new ChatUI();
    }
    return ChatUI.instance;
  }

  public static getInstance(): ChatUI | null {
    return ChatUI.instance;
  }

  private loadState(): void {
    try {
      const savedProvider = localStorage.getItem('roboisland_chat_provider') as any;
      if (savedProvider && ['openai', 'anthropic', 'custom', 'ollama', 'gemini'].includes(savedProvider)) {
        this.currentProvider = savedProvider;
      }
      this.currentModel = localStorage.getItem('roboisland_chat_model') || '';
      this.ttsEnabled = localStorage.getItem('roboisland_chat_tts') === 'true';
      const historyRaw = localStorage.getItem('roboisland_chat_history');
      if (historyRaw) {
        this.messages = JSON.parse(historyRaw);
      }
    } catch (e) {
      console.warn('[ChatUI] Error reading local state:', e);
    }
  }

  private saveState(): void {
    try {
      localStorage.setItem('roboisland_chat_provider', this.currentProvider);
      localStorage.setItem('roboisland_chat_model', this.currentModel);
      localStorage.setItem('roboisland_chat_tts', String(this.ttsEnabled));
      localStorage.setItem('roboisland_chat_history', JSON.stringify(this.messages.slice(-50)));
    } catch (e) {
      console.warn('[ChatUI] Error saving local state:', e);
    }
  }

  private enhanceUI(): void {
    injectChatStyles();

    const panel = document.getElementById('panel-chat');
    if (!panel) return;

    // 1. Enhance Header with Provider Selector, Model Selector, Export, and TTS controls
    const header = panel.querySelector('.chat-header');
    if (header && !header.querySelector('.chat-header-actions')) {
      const actionsWrapper = document.createElement('div');
      actionsWrapper.className = 'chat-header-actions';
      actionsWrapper.innerHTML = `
        <select id="chat-provider-select" class="chat-provider-select" title="AI Provider">
          <option value="gemini" ${this.currentProvider === 'gemini' ? 'selected' : ''}>Google Gemini (Free Flash)</option>
          <option value="ollama" ${this.currentProvider === 'ollama' ? 'selected' : ''}>Ollama (Local Offline)</option>
          <option value="openai" ${this.currentProvider === 'openai' ? 'selected' : ''}>OpenAI (GPT-4o)</option>
          <option value="anthropic" ${this.currentProvider === 'anthropic' ? 'selected' : ''}>Claude (3.5 Sonnet)</option>
          <option value="custom" ${this.currentProvider === 'custom' ? 'selected' : ''}>Custom API</option>
        </select>
        <select id="chat-model-select" class="chat-model-select ${this.currentProvider === 'ollama' ? '' : 'hidden'}" title="Model Select">
          <option value="">Default</option>
        </select>
        <button id="btn-chat-tts" class="chat-tool-btn ${this.ttsEnabled ? 'active' : ''}" title="Text-to-Speech Toggle">
          ${this.ttsEnabled ? SVG_ICONS.speaker : SVG_ICONS.speakerMuted}
        </button>
        <button id="btn-chat-export" class="chat-tool-btn" title="Export Conversation">
          ${SVG_ICONS.export}
        </button>
      `;

      // Insert before clear button
      const clearBtn = document.getElementById('btn-chat-clear');
      if (clearBtn) {
        header.insertBefore(actionsWrapper, clearBtn);
      } else {
        header.appendChild(actionsWrapper);
      }
    }

    // 2. Enhance Input Bar with Robo Vision (Camera) and Voice Typing (Mic)
    const form = document.getElementById('chat-input-form');
    if (form) {
      // Add attachment chip bar above the form if not present
      let attachBar = document.getElementById('chat-attachment-bar');
      if (!attachBar && form.parentNode) {
        attachBar = document.createElement('div');
        attachBar.id = 'chat-attachment-bar';
        attachBar.className = 'chat-attachment-bar hidden';
        attachBar.innerHTML = `
          <img id="chat-attachment-thumb" class="chat-attachment-thumb" src="" alt="Thumbnail" />
          <div class="chat-attachment-info">
            <span class="chat-attachment-label">Screen attached</span>
            <span class="chat-attachment-sub" id="chat-attachment-meta">1920x1080 JPEG</span>
          </div>
          <button type="button" id="btn-chat-attachment-remove" class="chat-attachment-remove-btn" title="Remove attachment">
            ${SVG_ICONS.close}
          </button>
        `;
        form.parentNode.insertBefore(attachBar, form);
      }

      if (!document.getElementById('btn-chat-vision')) {
        const visionBtn = document.createElement('button');
        visionBtn.type = 'button';
        visionBtn.id = 'btn-chat-vision';
        visionBtn.className = 'chat-vision-btn';
        visionBtn.title = 'Robo Vision: Look at Screen (Ctrl+Shift+S)';
        visionBtn.innerHTML = SVG_ICONS.camera;

        const input = document.getElementById('chat-input');
        if (input) {
          form.insertBefore(visionBtn, input);
        } else {
          form.prepend(visionBtn);
        }
      }

      if (!document.getElementById('btn-chat-mic')) {
        const micBtn = document.createElement('button');
        micBtn.type = 'button';
        micBtn.id = 'btn-chat-mic';
        micBtn.className = 'chat-mic-btn';
        micBtn.title = 'Voice Typing (Win + H)';
        micBtn.innerHTML = SVG_ICONS.mic;

        const sendBtn = document.getElementById('btn-chat-send');
        if (sendBtn) {
          form.insertBefore(micBtn, sendBtn);
        } else {
          form.appendChild(micBtn);
        }
      }
    }
  }

  private setupGeminiModels(): void {
    const modelSelect = document.getElementById('chat-model-select') as HTMLSelectElement;
    if (modelSelect) {
      modelSelect.classList.remove('hidden');
      if (!this.currentModel || ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'].includes(this.currentModel)) {
        this.currentModel = 'gemini-3.8-flash';
      }
      modelSelect.innerHTML = `
        <option value="gemini-3.8-flash" ${this.currentModel === 'gemini-3.8-flash' ? 'selected' : ''}>Gemini 3.8 Flash (Fast Free)</option>
        <option value="gemini-flash-latest" ${this.currentModel === 'gemini-flash-latest' ? 'selected' : ''}>Gemini Flash Latest</option>
        <option value="gemini-3-flash-preview" ${this.currentModel === 'gemini-3-flash-preview' ? 'selected' : ''}>Gemini 3 Flash Preview</option>
      `;
      this.saveState();
    }
  }

  private async refreshOllamaModels(): Promise<void> {
    const modelSelect = document.getElementById('chat-model-select') as HTMLSelectElement;
    if (!modelSelect) return;

    try {
      const api = (window as any).roboIsland;
      if (api && typeof api.getOllamaModels === 'function') {
        const models: string[] = await api.getOllamaModels();
        if (Array.isArray(models) && models.length > 0) {
          modelSelect.innerHTML = models.map((m) => `<option value="${m}" ${m === this.currentModel ? 'selected' : ''}>${m}</option>`).join('');
          if (!this.currentModel || !models.includes(this.currentModel)) {
            this.currentModel = models[0];
            this.saveState();
          }
          modelSelect.classList.remove('hidden');
          return;
        }
      }
    } catch (e) {
      console.warn('[ChatUI] Failed to load Ollama models:', e);
    }

    modelSelect.innerHTML = '<option value="llama3:latest">llama3</option>';
  }

  private attachEvents(): void {
    // 1. Intercept Chat Form Submit with capture phase to prevent mock duplicate
    const form = document.getElementById('chat-input-form');
    const input = document.getElementById('chat-input') as HTMLInputElement;

    if (input) {
      input.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
      });
    }

    if (form) {
      form.addEventListener(
        'submit',
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          const text = input ? input.value.trim() : '';
          if ((!text && !this.pendingImageData) || this.isStreaming) return;

          const promptText = text || 'Analyze what is visible on my screen and provide concise, helpful insights or troubleshooting steps.';
          const attachedImage = this.pendingImageData;
          this.clearAttachment();
          if (input) input.value = '';
          this.handleSendMessage(promptText, attachedImage);
        },
        true // Capture phase
      );
    }

    // 2. Provider Select
    const providerSelect = document.getElementById('chat-provider-select') as HTMLSelectElement;
    const modelSelect = document.getElementById('chat-model-select') as HTMLSelectElement;

    if (providerSelect) {
      providerSelect.addEventListener('change', (e) => {
        e.stopPropagation();
        this.currentProvider = providerSelect.value as any;
        if (this.currentProvider === 'gemini') {
          this.setupGeminiModels();
        } else if (this.currentProvider === 'ollama') {
          if (modelSelect) modelSelect.classList.remove('hidden');
          this.refreshOllamaModels();
        } else {
          if (modelSelect) modelSelect.classList.add('hidden');
          this.currentModel = '';
        }
        this.saveState();
      });
      providerSelect.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    if (modelSelect) {
      modelSelect.addEventListener('change', (e) => {
        e.stopPropagation();
        this.currentModel = modelSelect.value;
        this.saveState();
      });
      modelSelect.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // 3. Clear Chat Button
    const clearBtn = document.getElementById('btn-chat-clear');
    if (clearBtn) {
      clearBtn.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          this.clearHistory();
        },
        true
      );
    }

    // TwoCode AI Quick Action Chips Listener
    const quickChips = document.getElementById('chat-quick-chips');
    if (quickChips) {
      quickChips.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest('.cr-row') as HTMLButtonElement;
        if (!btn) return;
        const kind = btn.dataset.kind;
        if (!kind) return;

        let prompt = '';
        if (kind === 'explain') {
          prompt = 'Explain what is on my screen or the topic in plain, clear language.';
        } else if (kind === 'spelling') {
          prompt = 'Check my spelling and grammar. Highlight errors and provide the corrected version.';
        } else if (kind === 'translate') {
          prompt = 'Translate the text on screen or provided into clear, natural English.';
        } else if (kind === 'summary') {
          prompt = 'Summarize what is on screen or the topic in a few clear bullet points.';
        }

        if (prompt) {
          const input = document.getElementById('chat-input') as HTMLInputElement;
          if (input) input.value = '';
          const attachedImage = this.pendingImageData;
          this.clearAttachment();
          this.handleSendMessage(prompt, attachedImage);
        }
      });
    }

    // 4. Export Chat Button
    const exportBtn = document.getElementById('btn-chat-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.exportHistory();
      });
    }

    // 5. TTS Button
    const ttsBtn = document.getElementById('btn-chat-tts');
    if (ttsBtn) {
      ttsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.ttsEnabled = !this.ttsEnabled;
        ttsBtn.classList.toggle('active', this.ttsEnabled);
        ttsBtn.innerHTML = this.ttsEnabled ? SVG_ICONS.speaker : SVG_ICONS.speakerMuted;
        this.saveState();
      });
    }

    // 6. Voice Typing Button
    const micBtn = document.getElementById('btn-chat-mic');
    if (micBtn) {
      micBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        micBtn.classList.add('listening');
        if (input) input.focus();

        const api = (window as any).roboIsland;
        if (api && typeof api.triggerVoiceTyping === 'function') {
          try {
            await api.triggerVoiceTyping();
          } catch (e) {
            console.warn('[ChatUI] Voice typing trigger error:', e);
          }
        } else {
          // Web speech fallback if in supported environment
          if ('webkitSpeechRecognition' in window) {
            const SpeechRec = (window as any).webkitSpeechRecognition;
            const rec = new SpeechRec();
            rec.continuous = false;
            rec.interimResults = false;
            rec.onresult = (ev: any) => {
              const transcript = ev.results[0]?.[0]?.transcript;
              if (transcript && input) {
                input.value = transcript;
              }
            };
            rec.onend = () => micBtn.classList.remove('listening');
            rec.onerror = () => micBtn.classList.remove('listening');
            rec.start();
            return;
          }
        }

        setTimeout(() => {
          micBtn.classList.remove('listening');
        }, 3000);
      });
    }

    // 7. Robo Vision Button & Attachment Handlers
    const visionBtn = document.getElementById('btn-chat-vision');
    if (visionBtn) {
      visionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.triggerScreenCapture();
      });
    }

    const removeAttachBtn = document.getElementById('btn-chat-attachment-remove');
    if (removeAttachBtn) {
      removeAttachBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearAttachment();
      });
    }

    // Hotkey: Ctrl+Shift+S or Alt+S triggers screen capture glance
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) || (e.altKey && (e.key === 'S' || e.key === 's'))) {
        e.preventDefault();
        this.triggerScreenCapture();
      }
    });

    if ((window.roboIsland as any)?.onVisionQuery) {
      (window.roboIsland as any).onVisionQuery((data: { prompt: string; dataUrl: string }) => {
        if (data.dataUrl) {
          this.pendingImageData = data.dataUrl;
          const attachBar = document.getElementById('chat-attachment-bar');
          const thumb = document.getElementById('chat-attachment-thumb') as HTMLImageElement | null;
          if (attachBar && thumb) {
            thumb.src = data.dataUrl;
            attachBar.classList.remove('hidden');
          }
        }
        this.handleSendMessage(data.prompt, data.dataUrl);
      });
    }

    // 7. Event delegation for Code Block "Copy Code" buttons & message click isolation
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
      messagesContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = (e.target as HTMLElement).closest('.btn-copy-code') as HTMLElement;
        if (!target) return;

        const encoded = target.getAttribute('data-code');
        if (!encoded) return;

        const rawCode = decodeURIComponent(encoded);
        navigator.clipboard.writeText(rawCode).then(() => {
          target.classList.add('copied');
          target.innerHTML = `<span class="copy-icon">${SVG_ICONS.check}</span><span class="copy-label">Copied!</span>`;
          setTimeout(() => {
            target.classList.remove('copied');
            target.innerHTML = `<span class="copy-icon">${SVG_ICONS.copy}</span><span class="copy-label">Copy</span>`;
          }, 2000);
        }).catch((err) => {
          console.warn('[ChatUI] Copy code error:', err);
        });
      });
    }

    // 8. IPC Listeners for Streaming
    const roboIsland = (window as any).roboIsland;
    if (roboIsland) {
      if (typeof roboIsland.onAIChatChunk === 'function') {
        roboIsland.onAIChatChunk((chunk: string) => {
          this.handleIncomingChunk(chunk);
        });
      }
      if (typeof roboIsland.onAIChatDone === 'function') {
        roboIsland.onAIChatDone(() => {
          this.handleStreamDone();
        });
      }
    }
  }

  private restoreMessages(): void {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    if (this.messages.length === 0) {
      // Default welcome message
      container.innerHTML = `
        <div class="chat-msg robo">
          <div class="msg-bubble">
            Hi! I'm Robo, your intelligent companion. Ask me anything, or configure OpenAI / Claude / Ollama in settings!
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    for (const msg of this.messages) {
      const el = document.createElement('div');
      el.className = `chat-msg ${msg.role}`;
      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble';
      const imageHtml = msg.imageData ? `<div class="msg-attachment-thumb-wrap"><img class="msg-attachment-thumb" src="${msg.imageData}" alt="Screen Glance" /></div>` : '';
      bubble.innerHTML = `${imageHtml}${msg.role === 'robo' ? renderMarkdown(msg.text) : sanitizeHtml(msg.text)}`;
      el.appendChild(bubble);
      container.appendChild(el);
    }
    container.scrollTop = container.scrollHeight;
  }

  private handleSendMessage(text: string, imageData?: string | null): void {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    // 1. User Message Element
    const userMsgEl = document.createElement('div');
    userMsgEl.className = 'chat-msg user';
    const imageHtml = imageData ? `<div class="msg-attachment-thumb-wrap"><img class="msg-attachment-thumb" src="${imageData}" alt="Screen Glance" /></div>` : '';
    userMsgEl.innerHTML = `<div class="msg-bubble">${imageHtml}${sanitizeHtml(text)}</div>`;
    container.appendChild(userMsgEl);

    // Save to message list
    this.messages.push({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      text,
      timestamp: Date.now(),
      imageData: imageData || undefined
    });

    // 2. Assistant Streaming Placeholder
    const roboMsgEl = document.createElement('div');
    roboMsgEl.className = 'chat-msg robo';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = `<span class="streaming-cursor"></span>`;
    roboMsgEl.appendChild(bubble);
    container.appendChild(roboMsgEl);
    container.scrollTop = container.scrollHeight;

    this.activeAssistantBubble = bubble;
    this.activeAssistantText = '';
    this.isStreaming = true;

    // 3. Send to AI Provider Manager
    const api = (window as any).roboIsland;
    if (api && typeof api.sendAIChatPrompt === 'function') {
      api.sendAIChatPrompt(this.currentProvider, text, this.currentModel || undefined, imageData || undefined).then((fullResponse: string) => {
        // Fallback in case onAIChatDone wasn't triggered
        if (this.isStreaming && fullResponse) {
          this.activeAssistantText = fullResponse;
          this.handleStreamDone();
        }
      }).catch((err: any) => {
        console.warn('[ChatUI] sendAIChatPrompt failed:', err);
        if (this.isStreaming) {
          this.activeAssistantText = `Error: ${err.message || 'Failed to reach AI service'}`;
          this.handleStreamDone();
        }
      });
    } else {
      // Local simulated response if no backend connection available
      setTimeout(() => {
        const imageNote = imageData ? ' [Screen captured]' : '';
        this.activeAssistantText = `I analyzed your screen${imageNote} and prompt: "${text}". Connect OpenAI, Claude, or local Ollama in settings for live visual inference!`;
        this.handleStreamDone();
      }, 350);
    }
  }

  private async triggerScreenCapture(): Promise<void> {
    const visionBtn = document.getElementById('btn-chat-vision');
    if (visionBtn) visionBtn.classList.add('capturing');

    try {
      const api = (window as any).roboIsland;
      if (api && typeof api.captureScreen === 'function') {
        const dataUrl = await api.captureScreen();
        if (dataUrl) {
          this.pendingImageData = dataUrl;
          const attachBar = document.getElementById('chat-attachment-bar');
          const attachThumb = document.getElementById('chat-attachment-thumb') as HTMLImageElement;
          if (attachBar && attachThumb) {
            attachThumb.src = dataUrl;
            attachBar.classList.remove('hidden');
          }
          const input = document.getElementById('chat-input') as HTMLInputElement;
          if (input) {
            input.placeholder = 'Ask about what is on your screen...';
            input.focus();
          }
        }
      }
    } catch (err) {
      console.warn('[ChatUI] Screen capture error:', err);
    } finally {
      if (visionBtn) visionBtn.classList.remove('capturing');
    }
  }

  private clearAttachment(): void {
    this.pendingImageData = null;
    const attachBar = document.getElementById('chat-attachment-bar');
    const attachThumb = document.getElementById('chat-attachment-thumb') as HTMLImageElement;
    if (attachBar) attachBar.classList.add('hidden');
    if (attachThumb) attachThumb.src = '';
    const input = document.getElementById('chat-input') as HTMLInputElement;
    if (input) {
      input.placeholder = 'Ask Robo...';
    }
  }

  private handleIncomingChunk(chunk: string): void {
    if (!this.isStreaming || !this.activeAssistantBubble) return;

    this.activeAssistantText += chunk;
    const rendered = renderMarkdown(this.activeAssistantText);
    this.activeAssistantBubble.innerHTML = `${rendered}<span class="streaming-cursor"></span>`;

    const container = document.getElementById('chat-messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  private handleStreamDone(): void {
    if (!this.isStreaming) return;
    this.isStreaming = false;

    if (this.activeAssistantBubble) {
      this.activeAssistantBubble.innerHTML = renderMarkdown(this.activeAssistantText);
    }

    // Save Robo response
    this.messages.push({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'robo',
      text: this.activeAssistantText,
      timestamp: Date.now(),
      provider: this.currentProvider
    });
    this.saveState();

    // Trigger TTS if enabled
    if (this.ttsEnabled && this.activeAssistantText) {
      this.speakText(this.activeAssistantText);
    }

    this.activeAssistantBubble = null;
    this.activeAssistantText = '';
  }

  private speakText(text: string): void {
    // Strip markdown code blocks before speaking
    const cleaned = text
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/`[^`]+`/g, 'code snippet')
      .replace(/[#*_~\[\]]/g, '')
      .trim();

    if (!cleaned) return;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleaned.slice(0, 300));
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } else {
      const api = (window as any).roboIsland;
      if (api && typeof api.speakTTS === 'function') {
        api.speakTTS(cleaned.slice(0, 300)).catch(() => {});
      }
    }
  }

  public clearHistory(): void {
    this.messages = [];
    this.saveState();
    this.restoreMessages();
  }

  public exportHistory(): void {
    if (this.messages.length === 0) {
      alert('Conversation is empty.');
      return;
    }

    let md = `# RoboIsland Conversation Export\n`;
    md += `*Generated: ${new Date().toLocaleString()}*\n\n---\n\n`;

    for (const msg of this.messages) {
      const role = msg.role === 'user' ? 'You' : `Robo (${msg.provider || 'AI'})`;
      const time = new Date(msg.timestamp).toLocaleTimeString();
      md += `### ${role} - ${time}\n\n${msg.text}\n\n---\n\n`;
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RoboIsland-Chat-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}



// Auto-initialize when running in browser
if (typeof window !== 'undefined') {
  (window as any).ChatUI = ChatUI;
  (window as any).renderMarkdown = renderMarkdown;
  (window as any).highlightSyntax = highlightSyntax;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ChatUI.init();
    });
  } else {
    ChatUI.init();
  }
}
