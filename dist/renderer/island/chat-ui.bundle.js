"use strict";
(() => {
  // src/renderer/island/chat-ui.ts
  if (typeof exports === "undefined") {
    globalThis.exports = {};
  }
  var SVG_ICONS = {
    copy: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    check: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#34c759" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    mic: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
    camera: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
    paperclip: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    speaker: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
    speakerMuted: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`,
    export: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    document: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    chevronDown: `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`
  };
  function sanitizeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function highlightSyntax(code, lang = "text") {
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
  function renderMarkdown(markdown) {
    if (!markdown || typeof markdown !== "string") return "";
    try {
      const codeBlocks = [];
      let text = markdown.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g, (_match, lang, code) => {
        const language = (lang || "code").trim().toLowerCase();
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
      text = text.replace(/```([a-zA-Z0-9_-]*)\r?\n?([\s\S]*)$/g, (_match, lang, code) => {
        const language = (lang || "code").trim().toLowerCase();
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
      const inlineCodes = [];
      text = text.replace(/`([^`]+)`/g, (_match, code) => {
        const placeholder = `@@ROBOINLINE${inlineCodes.length}@@`;
        inlineCodes.push(`<code class="inline-code">${sanitizeHtml(code)}</code>`);
        return placeholder;
      });
      text = text.replace(/^>\s+(.+)$/gm, '<blockquote class="chat-quote">$1</blockquote>');
      text = text.replace(/^###\s+(.+)$/gm, '<h4 class="chat-h4">$1</h4>');
      text = text.replace(/^##\s+(.+)$/gm, '<h3 class="chat-h3">$1</h3>');
      text = text.replace(/^#\s+(.+)$/gm, '<h2 class="chat-h2">$1</h2>');
      text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
      text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
      text = text.replace(/_([^_]+)_/g, "<em>$1</em>");
      text = text.replace(/^[\*\-]\s+(.+)$/gm, '<li class="chat-li">$1</li>');
      text = text.replace(/((?:<li class="chat-li">.*<\/li>\s*)+)/g, '<ul class="chat-ul">$1</ul>');
      text = text.replace(/^\d+\.\s+(.+)$/gm, '<li class="chat-oli">$1</li>');
      text = text.replace(/((?:<li class="chat-oli">.*<\/li>\s*)+)/g, '<ol class="chat-ol">$1</ol>');
      text = text.replace(/\n/g, "<br>");
      for (let i = 0; i < codeBlocks.length; i++) {
        text = text.replace(`@@ROBOCODEBLOCK${i}@@`, codeBlocks[i]);
      }
      for (let i = 0; i < inlineCodes.length; i++) {
        text = text.replace(`@@ROBOINLINE${i}@@`, inlineCodes[i]);
      }
      return text;
    } catch (err) {
      console.warn("[renderMarkdown] Parser error, using plaintext fallback:", err);
      return sanitizeHtml(markdown).replace(/\n/g, "<br>");
    }
  }
  function injectChatStyles() {
    if (typeof document === "undefined") return;
    if (document.getElementById("roboisland-chat-ui-styles")) return;
    const style = document.createElement("style");
    style.id = "roboisland-chat-ui-styles";
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
    .msg-file-chip {
      display: flex;
      align-items: center;
      gap: 7px;
      background: rgba(255, 255, 255, 0.22);
      border: 1px solid rgba(255, 255, 255, 0.35);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-radius: 10px;
      padding: 5px 11px;
      margin-bottom: 7px;
      font-size: 11.5px;
      font-weight: 600;
      color: #ffffff !important;
      width: fit-content;
      max-width: 100%;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
    }
    .msg-file-chip svg {
      flex-shrink: 0;
      color: #ffffff !important;
    }
    .msg-file-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 240px;
      color: #ffffff !important;
    }
    .msg-file-chip * {
      color: #ffffff !important;
    }
    .msg-text-content {
      line-height: 1.48;
      word-break: break-word;
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

    /* Apple macOS Siri Suggestion Quick Action Chips */
    .chat-quick-chips.cr-list {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin: 4px 8px 3px 8px;
      max-width: 100%;
      pointer-events: auto;
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .chat-quick-chips.cr-list::-webkit-scrollbar {
      display: none;
    }
    .cr-row {
      flex: none;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: 25px;
      padding: 0 10px;
      border: 0;
      border-radius: 13px;
      background: rgba(255, 255, 255, 0.08);
      color: #e5e5ea;
      font: 500 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.15s ease;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }
    .cr-row:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
      transform: translateY(-1px);
    }
    .cr-row:active {
      transform: scale(0.96);
    }
    .cr-row svg {
      flex: none;
      width: 12px;
      height: 12px;
      color: var(--k);
    }
  `;
    document.head.appendChild(style);
  }
  var ChatUI = class _ChatUI {
    static instance = null;
    messages = [];
    currentProvider = "gemini";
    currentModel = "";
    ttsEnabled = false;
    isStreaming = false;
    activeAssistantBubble = null;
    activeAssistantText = "";
    pendingImageData = null;
    pendingFileText = null;
    pendingFileName = null;
    constructor() {
      this.loadState();
      this.enhanceUI();
      this.attachEvents();
      this.restoreMessages();
      if (this.currentProvider === "ollama") {
        this.refreshOllamaModels();
      } else if (this.currentProvider === "gemini") {
        this.setupGeminiModels();
      }
    }
    static init() {
      if (!_ChatUI.instance) {
        _ChatUI.instance = new _ChatUI();
      }
      return _ChatUI.instance;
    }
    static getInstance() {
      return _ChatUI.instance;
    }
    loadState() {
      try {
        const savedProvider = localStorage.getItem("roboisland_chat_provider");
        if (savedProvider && ["openai", "anthropic", "custom", "ollama", "gemini"].includes(savedProvider)) {
          this.currentProvider = savedProvider;
        }
        this.currentModel = localStorage.getItem("roboisland_chat_model") || "";
        this.ttsEnabled = localStorage.getItem("roboisland_chat_tts") === "true";
        const historyRaw = localStorage.getItem("roboisland_chat_history");
        if (historyRaw) {
          this.messages = JSON.parse(historyRaw);
        }
      } catch (e) {
        console.warn("[ChatUI] Error reading local state:", e);
      }
    }
    saveState() {
      try {
        localStorage.setItem("roboisland_chat_provider", this.currentProvider);
        localStorage.setItem("roboisland_chat_model", this.currentModel);
        localStorage.setItem("roboisland_chat_tts", String(this.ttsEnabled));
        localStorage.setItem("roboisland_chat_history", JSON.stringify(this.messages.slice(-50)));
      } catch (e) {
        console.warn("[ChatUI] Error saving local state:", e);
      }
    }
    enhanceUI() {
      injectChatStyles();
      const panel = document.getElementById("panel-chat");
      if (!panel) return;
      const header = panel.querySelector(".chat-header");
      if (header && !header.querySelector(".chat-header-actions")) {
        const actionsWrapper = document.createElement("div");
        actionsWrapper.className = "chat-header-actions";
        actionsWrapper.innerHTML = `
        <select id="chat-provider-select" class="chat-provider-select" title="AI Provider">
          <option value="gemini" ${this.currentProvider === "gemini" ? "selected" : ""}>Google Gemini (Free Flash)</option>
          <option value="ollama" ${this.currentProvider === "ollama" ? "selected" : ""}>Ollama (Local Offline)</option>
          <option value="openai" ${this.currentProvider === "openai" ? "selected" : ""}>OpenAI (GPT-4o)</option>
          <option value="anthropic" ${this.currentProvider === "anthropic" ? "selected" : ""}>Claude (3.5 Sonnet)</option>
          <option value="custom" ${this.currentProvider === "custom" ? "selected" : ""}>Custom API</option>
        </select>
        <select id="chat-model-select" class="chat-model-select ${this.currentProvider === "ollama" ? "" : "hidden"}" title="Model Select">
          <option value="">Default</option>
        </select>
        <button id="btn-chat-tts" class="chat-tool-btn ${this.ttsEnabled ? "active" : ""}" title="Text-to-Speech Toggle">
          ${this.ttsEnabled ? SVG_ICONS.speaker : SVG_ICONS.speakerMuted}
        </button>
        <button id="btn-chat-export" class="chat-tool-btn" title="Export Conversation">
          ${SVG_ICONS.export}
        </button>
      `;
        const clearBtn = document.getElementById("btn-chat-clear");
        if (clearBtn) {
          header.insertBefore(actionsWrapper, clearBtn);
        } else {
          header.appendChild(actionsWrapper);
        }
      }
      const form = document.getElementById("chat-input-form");
      if (form) {
        let attachBar = document.getElementById("chat-attachment-bar");
        if (!attachBar && form.parentNode) {
          attachBar = document.createElement("div");
          attachBar.id = "chat-attachment-bar";
          attachBar.className = "chat-attachment-bar hidden";
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
        if (!document.getElementById("btn-chat-attach")) {
          let fileInput = document.getElementById("chat-file-input");
          if (!fileInput) {
            fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.id = "chat-file-input";
            fileInput.accept = ".pdf,.txt,.md,.py,.js,.ts,.json,.csv,.doc,.docx,.html,.c,.cpp,.java,.xml,.yaml,.yml,.log";
            fileInput.style.display = "none";
            form.appendChild(fileInput);
          }
          const attachBtn = document.createElement("button");
          attachBtn.type = "button";
          attachBtn.id = "btn-chat-attach";
          attachBtn.className = "chat-vision-btn";
          attachBtn.title = "Attach Document or PDF (Analyze like ChatGPT)";
          attachBtn.innerHTML = SVG_ICONS.paperclip;
          const input = document.getElementById("chat-input");
          if (input) {
            form.insertBefore(attachBtn, input);
          } else {
            form.prepend(attachBtn);
          }
        }
        if (!document.getElementById("btn-chat-vision")) {
          const visionBtn = document.createElement("button");
          visionBtn.type = "button";
          visionBtn.id = "btn-chat-vision";
          visionBtn.className = "chat-vision-btn";
          visionBtn.title = "Robo Vision: Look at Screen (Ctrl+Shift+S)";
          visionBtn.innerHTML = SVG_ICONS.camera;
          const input = document.getElementById("chat-input");
          if (input) {
            form.insertBefore(visionBtn, input);
          } else {
            form.prepend(visionBtn);
          }
        }
        if (!document.getElementById("btn-chat-mic")) {
          const micBtn = document.createElement("button");
          micBtn.type = "button";
          micBtn.id = "btn-chat-mic";
          micBtn.className = "chat-mic-btn";
          micBtn.title = "Voice Typing (Win + H)";
          micBtn.innerHTML = SVG_ICONS.mic;
          const sendBtn = document.getElementById("btn-chat-send");
          if (sendBtn) {
            form.insertBefore(micBtn, sendBtn);
          } else {
            form.appendChild(micBtn);
          }
        }
      }
    }
    setupGeminiModels() {
      const modelSelect = document.getElementById("chat-model-select");
      if (modelSelect) {
        modelSelect.classList.remove("hidden");
        if (!this.currentModel || ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-3.8-flash"].includes(this.currentModel)) {
          this.currentModel = "gemini-3-flash-preview";
        }
        modelSelect.innerHTML = `
        <option value="gemini-3-flash-preview" ${this.currentModel === "gemini-3-flash-preview" ? "selected" : ""}>Gemini 3 Flash (High Availability)</option>
        <option value="gemini-3.1-flash-lite-preview" ${this.currentModel === "gemini-3.1-flash-lite-preview" ? "selected" : ""}>Gemini 3.1 Flash-Lite (Fastest)</option>
        <option value="gemini-3.8-flash" ${this.currentModel === "gemini-3.8-flash" ? "selected" : ""}>Gemini 3.8 Flash</option>
        <option value="gemini-flash-latest" ${this.currentModel === "gemini-flash-latest" ? "selected" : ""}>Gemini Flash Latest</option>
      `;
        this.saveState();
      }
    }
    async refreshOllamaModels() {
      const modelSelect = document.getElementById("chat-model-select");
      if (!modelSelect) return;
      try {
        const api = window.roboIsland;
        if (api && typeof api.getOllamaModels === "function") {
          const models = await api.getOllamaModels();
          if (Array.isArray(models) && models.length > 0) {
            modelSelect.innerHTML = models.map((m) => `<option value="${m}" ${m === this.currentModel ? "selected" : ""}>${m}</option>`).join("");
            if (!this.currentModel || !models.includes(this.currentModel)) {
              this.currentModel = models[0];
              this.saveState();
            }
            modelSelect.classList.remove("hidden");
            return;
          }
        }
      } catch (e) {
        console.warn("[ChatUI] Failed to load Ollama models:", e);
      }
      modelSelect.innerHTML = '<option value="llama3:latest">llama3</option>';
    }
    attachEvents() {
      const form = document.getElementById("chat-input-form");
      const input = document.getElementById("chat-input");
      if (input) {
        input.addEventListener("click", (e) => {
          e.stopPropagation();
        });
        input.addEventListener("keydown", (e) => {
          e.stopPropagation();
        });
      }
      if (form) {
        form.addEventListener(
          "submit",
          (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            const text = input ? input.value.trim() : "";
            if (!text && !this.pendingImageData && !this.pendingFileText || this.isStreaming) return;
            const promptText = text || (this.pendingFileText ? "Please analyze this attached document and provide a helpful summary or answer." : "Analyze what is visible on my screen and provide concise, helpful insights or troubleshooting steps.");
            const attachedImage = this.pendingImageData;
            const attachedFileText = this.pendingFileText;
            const attachedFileName = this.pendingFileName;
            this.clearAttachment();
            if (input) input.value = "";
            this.handleSendMessage(promptText, attachedImage, attachedFileText, attachedFileName);
          },
          true
          // Capture phase
        );
      }
      const providerSelect = document.getElementById("chat-provider-select");
      const modelSelect = document.getElementById("chat-model-select");
      if (providerSelect) {
        providerSelect.addEventListener("change", (e) => {
          e.stopPropagation();
          this.currentProvider = providerSelect.value;
          if (this.currentProvider === "gemini") {
            this.setupGeminiModels();
          } else if (this.currentProvider === "ollama") {
            if (modelSelect) modelSelect.classList.remove("hidden");
            this.refreshOllamaModels();
          } else {
            if (modelSelect) modelSelect.classList.add("hidden");
            this.currentModel = "";
          }
          this.saveState();
        });
        providerSelect.addEventListener("click", (e) => {
          e.stopPropagation();
        });
      }
      if (modelSelect) {
        modelSelect.addEventListener("change", (e) => {
          e.stopPropagation();
          this.currentModel = modelSelect.value;
          this.saveState();
        });
        modelSelect.addEventListener("click", (e) => {
          e.stopPropagation();
        });
      }
      const clearBtn = document.getElementById("btn-chat-clear");
      if (clearBtn) {
        clearBtn.addEventListener(
          "click",
          (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.clearHistory();
          },
          true
        );
      }
      const quickChips = document.getElementById("chat-quick-chips");
      if (quickChips) {
        quickChips.addEventListener("click", (e) => {
          const btn = e.target.closest(".cr-row");
          if (!btn) return;
          const kind = btn.dataset.kind;
          if (!kind) return;
          let prompt = "";
          if (kind === "explain") {
            prompt = "Explain what is on my screen or the topic in plain, clear language.";
          } else if (kind === "spelling") {
            prompt = "Check my spelling and grammar. Highlight errors and provide the corrected version.";
          } else if (kind === "translate") {
            prompt = "Translate the text on screen or provided into clear, natural English.";
          } else if (kind === "summary") {
            prompt = "Summarize what is on screen or the topic in a few clear bullet points.";
          }
          if (prompt) {
            const input2 = document.getElementById("chat-input");
            if (input2) input2.value = "";
            const attachedImage = this.pendingImageData;
            this.clearAttachment();
            this.handleSendMessage(prompt, attachedImage);
          }
        });
      }
      const exportBtn = document.getElementById("btn-chat-export");
      if (exportBtn) {
        exportBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.exportHistory();
        });
      }
      const ttsBtn = document.getElementById("btn-chat-tts");
      if (ttsBtn) {
        ttsBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.ttsEnabled = !this.ttsEnabled;
          ttsBtn.classList.toggle("active", this.ttsEnabled);
          ttsBtn.innerHTML = this.ttsEnabled ? SVG_ICONS.speaker : SVG_ICONS.speakerMuted;
          this.saveState();
        });
      }
      const micBtn = document.getElementById("btn-chat-mic");
      if (micBtn) {
        micBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          micBtn.classList.add("listening");
          if (input) input.focus();
          const api = window.roboIsland;
          if (api && typeof api.triggerVoiceTyping === "function") {
            try {
              await api.triggerVoiceTyping();
            } catch (e2) {
              console.warn("[ChatUI] Voice typing trigger error:", e2);
            }
          } else {
            if ("webkitSpeechRecognition" in window) {
              const SpeechRec = window.webkitSpeechRecognition;
              const rec = new SpeechRec();
              rec.continuous = false;
              rec.interimResults = false;
              rec.onresult = (ev) => {
                const transcript = ev.results[0]?.[0]?.transcript;
                if (transcript && input) {
                  input.value = transcript;
                }
              };
              rec.onend = () => micBtn.classList.remove("listening");
              rec.onerror = () => micBtn.classList.remove("listening");
              rec.start();
              return;
            }
          }
          setTimeout(() => {
            micBtn.classList.remove("listening");
          }, 3e3);
        });
      }
      const attachBtn = document.getElementById("btn-chat-attach");
      const fileInput = document.getElementById("chat-file-input");
      if (attachBtn && fileInput) {
        attachBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          fileInput.click();
        });
        fileInput.addEventListener("change", async () => {
          const file = fileInput.files?.[0];
          if (!file) return;
          let content = "";
          const api = window.roboIsland;
          const filePath = file.path;
          if (api && typeof api.readChatFile === "function" && filePath) {
            try {
              const res = await api.readChatFile(filePath);
              if (res && res.success && res.text) {
                content = res.text;
              }
            } catch {
            }
          }
          if (!content) {
            try {
              content = await file.text();
            } catch {
              content = `[File attached: ${file.name} (${Math.round(file.size / 1024)} KB)]`;
            }
          }
          this.pendingFileText = content;
          this.pendingFileName = file.name;
          const attachBar = document.getElementById("chat-attachment-bar");
          const attachThumb = document.getElementById("chat-attachment-thumb");
          const attachLabel = document.querySelector(".chat-attachment-label");
          const attachSub = document.getElementById("chat-attachment-meta");
          if (attachBar) {
            attachBar.classList.remove("hidden");
            if (attachThumb) {
              attachThumb.style.display = "none";
            }
            if (attachLabel) {
              attachLabel.textContent = `\u{1F4C4} ${file.name}`;
            }
            if (attachSub) {
              attachSub.textContent = `${Math.round(file.size / 1024)} KB \u2022 Document Attached for Analysis`;
            }
            const input2 = document.getElementById("chat-input");
            if (input2) {
              input2.placeholder = `Ask anything about ${file.name}...`;
              input2.focus();
            }
          }
          fileInput.value = "";
        });
      }
      const visionBtn = document.getElementById("btn-chat-vision");
      if (visionBtn) {
        visionBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.triggerScreenCapture();
        });
      }
      const removeAttachBtn = document.getElementById("btn-chat-attachment-remove");
      if (removeAttachBtn) {
        removeAttachBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.clearAttachment();
        });
      }
      window.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === "S" || e.key === "s")) {
          e.preventDefault();
          this.triggerScreenCapture();
        }
      });
      if (window.roboIsland?.onVisionQuery) {
        window.roboIsland.onVisionQuery((data) => {
          if (data.dataUrl) {
            this.pendingImageData = data.dataUrl;
            const attachBar = document.getElementById("chat-attachment-bar");
            const thumb = document.getElementById("chat-attachment-thumb");
            if (attachBar && thumb) {
              thumb.src = data.dataUrl;
              attachBar.classList.remove("hidden");
            }
          }
          this.handleSendMessage(data.prompt, data.dataUrl);
        });
      }
      const messagesContainer = document.getElementById("chat-messages");
      if (messagesContainer) {
        messagesContainer.addEventListener("click", (e) => {
          e.stopPropagation();
          const target = e.target.closest(".btn-copy-code");
          if (!target) return;
          const encoded = target.getAttribute("data-code");
          if (!encoded) return;
          const rawCode = decodeURIComponent(encoded);
          navigator.clipboard.writeText(rawCode).then(() => {
            target.classList.add("copied");
            target.innerHTML = `<span class="copy-icon">${SVG_ICONS.check}</span><span class="copy-label">Copied!</span>`;
            setTimeout(() => {
              target.classList.remove("copied");
              target.innerHTML = `<span class="copy-icon">${SVG_ICONS.copy}</span><span class="copy-label">Copy</span>`;
            }, 2e3);
          }).catch((err) => {
            console.warn("[ChatUI] Copy code error:", err);
          });
        });
      }
      const roboIsland = window.roboIsland;
      if (roboIsland) {
        if (typeof roboIsland.onAIChatChunk === "function") {
          roboIsland.onAIChatChunk((chunk) => {
            this.handleIncomingChunk(chunk);
          });
        }
        if (typeof roboIsland.onAIChatDone === "function") {
          roboIsland.onAIChatDone(() => {
            this.handleStreamDone();
          });
        }
      }
    }
    restoreMessages() {
      const container = document.getElementById("chat-messages");
      if (!container) return;
      if (this.messages.length === 0) {
        container.innerHTML = `
        <div class="chat-msg robo">
          <div class="msg-bubble">
            Hi! I'm Robo, your intelligent companion. Ask me anything, or configure OpenAI / Claude / Ollama in settings!
          </div>
        </div>
      `;
        return;
      }
      container.innerHTML = "";
      for (const msg of this.messages) {
        const el = document.createElement("div");
        el.className = `chat-msg ${msg.role}`;
        const bubble = document.createElement("div");
        bubble.className = "msg-bubble";
        const imageHtml = msg.imageData ? `<div class="msg-attachment-thumb-wrap"><img class="msg-attachment-thumb" src="${msg.imageData}" alt="Screen Glance" /></div>` : "";
        const fileChipHtml = msg.fileName ? `<div class="msg-file-chip"><span class="msg-file-icon">${SVG_ICONS.document}</span><span class="msg-file-name">${sanitizeHtml(msg.fileName)}</span></div>` : "";
        const textHtml = msg.text ? `<div class="msg-text-content">${msg.role === "robo" ? renderMarkdown(msg.text) : sanitizeHtml(msg.text)}</div>` : "";
        bubble.innerHTML = `${imageHtml}${fileChipHtml}${textHtml}`;
        el.appendChild(bubble);
        container.appendChild(el);
      }
      container.scrollTop = container.scrollHeight;
    }
    handleSendMessage(text, imageData, fileText, fileName) {
      const container = document.getElementById("chat-messages");
      if (!container) return;
      const userMsgEl = document.createElement("div");
      userMsgEl.className = "chat-msg user";
      const imageHtml = imageData ? `<div class="msg-attachment-thumb-wrap"><img class="msg-attachment-thumb" src="${imageData}" alt="Screen Glance" /></div>` : "";
      const fileChipHtml = fileName ? `<div class="msg-file-chip"><span class="msg-file-icon">${SVG_ICONS.document}</span><span class="msg-file-name">${sanitizeHtml(fileName)}</span></div>` : "";
      const textHtml = text ? `<div class="msg-text-content">${sanitizeHtml(text)}</div>` : "";
      userMsgEl.innerHTML = `<div class="msg-bubble">${imageHtml}${fileChipHtml}${textHtml}</div>`;
      container.appendChild(userMsgEl);
      this.messages.push({
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: "user",
        text,
        timestamp: Date.now(),
        imageData: imageData || void 0,
        fileName: fileName || void 0
      });
      const roboMsgEl = document.createElement("div");
      roboMsgEl.className = "chat-msg robo";
      const bubble = document.createElement("div");
      bubble.className = "msg-bubble";
      bubble.innerHTML = `<span class="streaming-cursor"></span>`;
      roboMsgEl.appendChild(bubble);
      container.appendChild(roboMsgEl);
      container.scrollTop = container.scrollHeight;
      this.activeAssistantBubble = bubble;
      this.activeAssistantText = "";
      this.isStreaming = true;
      const api = window.roboIsland;
      if (api && typeof api.sendAIChatPrompt === "function") {
        api.sendAIChatPrompt(this.currentProvider, text, this.currentModel || void 0, imageData || void 0, fileText || void 0).then((fullResponse) => {
          if (this.isStreaming && fullResponse) {
            this.activeAssistantText = fullResponse;
            this.handleStreamDone();
          }
        }).catch((err) => {
          console.warn("[ChatUI] sendAIChatPrompt failed:", err);
          if (this.isStreaming) {
            this.activeAssistantText = `Error: ${err.message || "Failed to reach AI service"}`;
            this.handleStreamDone();
          }
        });
      } else {
        setTimeout(() => {
          const imageNote = imageData ? " [Screen captured]" : "";
          const fileNote = fileName ? ` [File: ${fileName}]` : "";
          this.activeAssistantText = `I analyzed your prompt${imageNote}${fileNote}: "${text}". Connect OpenAI, Claude, or local Ollama in settings for live visual inference!`;
          this.handleStreamDone();
        }, 350);
      }
    }
    async triggerScreenCapture() {
      const visionBtn = document.getElementById("btn-chat-vision");
      if (visionBtn) visionBtn.classList.add("capturing");
      try {
        const api = window.roboIsland;
        if (api && typeof api.captureScreen === "function") {
          const dataUrl = await api.captureScreen();
          if (dataUrl) {
            this.pendingImageData = dataUrl;
            const attachBar = document.getElementById("chat-attachment-bar");
            const attachThumb = document.getElementById("chat-attachment-thumb");
            if (attachBar && attachThumb) {
              attachThumb.src = dataUrl;
              attachBar.classList.remove("hidden");
            }
            const input = document.getElementById("chat-input");
            if (input) {
              input.placeholder = "Ask about what is on your screen...";
              input.focus();
            }
          }
        }
      } catch (err) {
        console.warn("[ChatUI] Screen capture error:", err);
      } finally {
        if (visionBtn) visionBtn.classList.remove("capturing");
      }
    }
    clearAttachment() {
      this.pendingImageData = null;
      this.pendingFileText = null;
      this.pendingFileName = null;
      const attachBar = document.getElementById("chat-attachment-bar");
      const attachThumb = document.getElementById("chat-attachment-thumb");
      const attachLabel = document.querySelector(".chat-attachment-label");
      const attachSub = document.getElementById("chat-attachment-meta");
      if (attachBar) attachBar.classList.add("hidden");
      if (attachThumb) {
        if (attachThumb instanceof HTMLImageElement) attachThumb.src = "";
        attachThumb.style.display = "";
      }
      if (attachLabel) attachLabel.textContent = "Screen attached";
      if (attachSub) attachSub.textContent = "1920x1080 JPEG";
      const input = document.getElementById("chat-input");
      if (input) {
        input.placeholder = "Ask Robo...";
      }
    }
    handleIncomingChunk(chunk) {
      if (!this.isStreaming || !this.activeAssistantBubble) return;
      this.activeAssistantText += chunk;
      const rendered = renderMarkdown(this.activeAssistantText);
      this.activeAssistantBubble.innerHTML = `${rendered}<span class="streaming-cursor"></span>`;
      const container = document.getElementById("chat-messages");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
    handleStreamDone() {
      if (!this.isStreaming) return;
      this.isStreaming = false;
      if (this.activeAssistantBubble) {
        this.activeAssistantBubble.innerHTML = renderMarkdown(this.activeAssistantText);
      }
      this.messages.push({
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: "robo",
        text: this.activeAssistantText,
        timestamp: Date.now(),
        provider: this.currentProvider
      });
      this.saveState();
      if (this.ttsEnabled && this.activeAssistantText) {
        this.speakText(this.activeAssistantText);
      }
      this.activeAssistantBubble = null;
      this.activeAssistantText = "";
    }
    speakText(text) {
      const cleaned = text.replace(/```[\s\S]*?```/g, "Code block omitted.").replace(/`[^`]+`/g, "code snippet").replace(/[#*_~\[\]]/g, "").trim();
      if (!cleaned) return;
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleaned.slice(0, 300));
        utterance.rate = 1.05;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
      } else {
        const api = window.roboIsland;
        if (api && typeof api.speakTTS === "function") {
          api.speakTTS(cleaned.slice(0, 300)).catch(() => {
          });
        }
      }
    }
    clearHistory() {
      this.messages = [];
      this.saveState();
      this.restoreMessages();
    }
    exportHistory() {
      if (this.messages.length === 0) {
        alert("Conversation is empty.");
        return;
      }
      let md = `# RoboIsland Conversation Export
`;
      md += `*Generated: ${(/* @__PURE__ */ new Date()).toLocaleString()}*

---

`;
      for (const msg of this.messages) {
        const role = msg.role === "user" ? "You" : `Robo (${msg.provider || "AI"})`;
        const time = new Date(msg.timestamp).toLocaleTimeString();
        md += `### ${role} - ${time}

${msg.text}

---

`;
      }
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RoboIsland-Chat-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };
  if (typeof window !== "undefined") {
    window.ChatUI = ChatUI;
    window.renderMarkdown = renderMarkdown;
    window.highlightSyntax = highlightSyntax;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        ChatUI.init();
      });
    } else {
      ChatUI.init();
    }
  }
})();
