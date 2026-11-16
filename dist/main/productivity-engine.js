"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductivityEngine = void 0;
const electron_1 = require("electron");
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const dgram = __importStar(require("dgram"));
const crypto = __importStar(require("crypto"));
const document_converter_1 = require("./document-converter");
class ProductivityEngine {
    // Clipboard History
    clipboardHistory = [];
    lastClipboardText = '';
    lastImageHash = '';
    clipboardPath;
    clipboardImagesDir;
    clipboardWatcherTimer = null;
    // File Tray
    trayFiles = [];
    activeFilePath = null;
    trayPath;
    // Scratchpad
    scratchpadPath;
    // Local Drop Server
    dropServer = null;
    dropPort = 48912;
    lanIp = '127.0.0.1';
    // Guard Window
    guardWindow = null;
    // Document Converter
    documentConverter = new document_converter_1.DocumentConverter();
    constructor() {
        const userData = electron_1.app.getPath('userData');
        this.trayPath = path.join(userData, 'tray-files.json');
        this.scratchpadPath = path.join(userData, 'scratchpad.txt');
        this.clipboardPath = path.join(userData, 'clipboard-history.json');
        this.clipboardImagesDir = path.join(userData, 'clipboard-images');
        if (!fs.existsSync(this.clipboardImagesDir)) {
            try {
                fs.mkdirSync(this.clipboardImagesDir, { recursive: true });
            }
            catch { }
        }
        this.loadPersistedData();
        this.startClipboardWatcher();
        this.startLocalDropServer();
        this.setupIPC();
    }
    loadPersistedData() {
        try {
            if (fs.existsSync(this.trayPath)) {
                this.trayFiles = JSON.parse(fs.readFileSync(this.trayPath, 'utf8'));
            }
        }
        catch { }
        try {
            if (fs.existsSync(this.clipboardPath)) {
                const raw = fs.readFileSync(this.clipboardPath, 'utf8');
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    this.clipboardHistory = parsed.map((item) => {
                        if (typeof item === 'string') {
                            return {
                                id: crypto.createHash('sha1').update(item).digest('hex').slice(0, 10),
                                type: 'text',
                                text: item,
                                timestamp: Date.now()
                            };
                        }
                        if (item.type === 'image' && item.filePath && fs.existsSync(item.filePath)) {
                            try {
                                const img = electron_1.nativeImage.createFromPath(item.filePath);
                                const size = img.getSize();
                                item.width = size.width;
                                item.height = size.height;
                                const maxW = 380;
                                const maxH = 240;
                                const scale = Math.min(1, Math.min(maxW / (size.width || 300), maxH / (size.height || 200)));
                                const tw = Math.max(1, Math.round((size.width || 300) * scale));
                                const th = Math.max(1, Math.round((size.height || 200) * scale));
                                item.thumbnail = img.resize({ width: tw, height: th, quality: 'better' }).toDataURL();
                            }
                            catch { }
                        }
                        return item;
                    }).filter(item => {
                        if (item.type === 'image') {
                            return item.filePath && fs.existsSync(item.filePath);
                        }
                        return Boolean(item.text);
                    }).slice(0, 30);
                }
            }
        }
        catch { }
    }
    savePersistedClipboard() {
        try {
            if (this.clipboardPath) {
                fs.writeFileSync(this.clipboardPath, JSON.stringify(this.clipboardHistory, null, 2), 'utf8');
            }
        }
        catch (err) {
            console.error('[ProductivityEngine] Failed to save clipboard history:', err);
        }
    }
    startClipboardWatcher() {
        if (this.clipboardWatcherTimer) {
            clearInterval(this.clipboardWatcherTimer);
            this.clipboardWatcherTimer = null;
        }
        this.clipboardWatcherTimer = setInterval(async () => {
            try {
                // 1. Check Image / Screenshot in clipboard (Electron 45 W3C Clipboard API)
                const hasPng = await electron_1.clipboard.has('image/png').catch(() => false);
                const hasJpg = !hasPng && (await electron_1.clipboard.has('image/jpeg').catch(() => false));
                if (hasPng || hasJpg) {
                    const mime = hasPng ? 'image/png' : 'image/jpeg';
                    const items = await electron_1.clipboard.read().catch(() => []);
                    for (const item of items) {
                        if (item.types && item.types.includes(mime)) {
                            const blob = await item.getType(mime);
                            const arrayBuffer = await blob.arrayBuffer();
                            const buf = Buffer.from(arrayBuffer);
                            if (buf.length > 0) {
                                const hash = crypto.createHash('sha1').update(buf.slice(0, Math.min(buf.length, 65536))).digest('hex');
                                if (hash !== this.lastImageHash) {
                                    this.lastImageHash = hash;
                                    const fileName = `screenshot_${Date.now()}.${hasPng ? 'png' : 'jpg'}`;
                                    const filePath = path.join(this.clipboardImagesDir, fileName);
                                    fs.writeFileSync(filePath, buf);
                                    // Generate thumbnail data URL with proportional aspect ratio
                                    const nativeImg = electron_1.nativeImage.createFromBuffer(buf);
                                    const size = nativeImg.getSize();
                                    const origW = size.width || 300;
                                    const origH = size.height || 200;
                                    const maxW = 380;
                                    const maxH = 240;
                                    const scale = Math.min(1, Math.min(maxW / origW, maxH / origH));
                                    const targetW = Math.max(1, Math.round(origW * scale));
                                    const targetH = Math.max(1, Math.round(origH * scale));
                                    const thumbImg = nativeImg.resize({ width: targetW, height: targetH, quality: 'better' });
                                    const thumbnail = thumbImg.toDataURL();
                                    const clipItem = {
                                        id: hash.slice(0, 10),
                                        type: 'image',
                                        filePath,
                                        thumbnail,
                                        width: size.width,
                                        height: size.height,
                                        timestamp: Date.now()
                                    };
                                    this.clipboardHistory = [clipItem, ...this.clipboardHistory.filter(c => c.id !== clipItem.id)].slice(0, 30);
                                    this.savePersistedClipboard();
                                    electron_1.BrowserWindow.getAllWindows().forEach(win => {
                                        if (!win.isDestroyed()) {
                                            win.webContents.send('tools:clipboard-updated', this.clipboardHistory);
                                        }
                                    });
                                    return;
                                }
                            }
                        }
                    }
                }
                // 2. Check Text in clipboard
                const raw = await electron_1.clipboard.readText().catch(() => '');
                const text = String(raw || '').trim();
                if (text && text !== this.lastClipboardText && text.length < 10000) {
                    this.lastClipboardText = text;
                    const hash = crypto.createHash('sha1').update(text).digest('hex').slice(0, 10);
                    let type = 'text';
                    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(text) || /^rgba?\([\d\s,.]+\)$/.test(text)) {
                        type = 'color';
                    }
                    else if (/^https?:\/\/[^\s]+$/.test(text)) {
                        type = 'url';
                    }
                    const item = {
                        id: hash,
                        type,
                        text,
                        timestamp: Date.now()
                    };
                    this.clipboardHistory = [item, ...this.clipboardHistory.filter(c => c.id !== item.id)].slice(0, 30);
                    this.savePersistedClipboard();
                    electron_1.BrowserWindow.getAllWindows().forEach(win => {
                        if (!win.isDestroyed()) {
                            win.webContents.send('tools:clipboard-updated', this.clipboardHistory);
                        }
                    });
                }
            }
            catch { }
        }, 1500);
    }
    getFileId(filePath) {
        return crypto.createHash('sha1').update(filePath).digest('hex').slice(0, 10);
    }
    savePersistedTrayFiles() {
        try {
            if (this.trayPath) {
                fs.writeFileSync(this.trayPath, JSON.stringify(this.trayFiles));
            }
        }
        catch (err) {
            console.error('[ProductivityEngine] Failed to save tray files:', err);
        }
    }
    getValidTrayFiles() {
        const valid = this.trayFiles.filter((f) => {
            try {
                return typeof f === 'string' && f.length > 0 && fs.existsSync(f) && fs.statSync(f).isFile();
            }
            catch {
                return false;
            }
        });
        this.trayFiles = valid;
        return valid;
    }
    escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes < 0)
            return '0 B';
        if (bytes < 1024)
            return `${bytes} B`;
        if (bytes < 1048576)
            return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1073741824)
            return `${(bytes / 1048576).toFixed(2)} MB`;
        return `${(bytes / 1073741824).toFixed(2)} GB`;
    }
    encodeRFC5987(str) {
        return encodeURIComponent(str).replace(/['()*!]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    }
    buildContentDisposition(filename) {
        const asciiFallback = filename
            .replace(/["\\]/g, '_')
            .replace(/[^\x20-\x7E]/g, '_')
            .trim() || 'download';
        return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${this.encodeRFC5987(filename)}`;
    }
    getMimeType(filePath) {
        const ext = path.extname(filePath).slice(1).toLowerCase();
        const types = {
            jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
            webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon',
            mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska',
            mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
            pdf: 'application/pdf', txt: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8',
            json: 'application/json', zip: 'application/zip', rar: 'application/vnd.rar',
            '7z': 'application/x-7z-compressed', apk: 'application/vnd.android.package-archive',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        };
        return types[ext] || 'application/octet-stream';
    }
    notifyRenderers(payload) {
        try {
            electron_1.BrowserWindow.getAllWindows().forEach((win) => {
                if (!win.isDestroyed()) {
                    win.webContents.send('tools:transfer-active', payload);
                }
            });
        }
        catch { }
    }
    buildPortalHtml(validFiles, featuredFilePath, missingNotice) {
        const featured = featuredFilePath && validFiles.includes(featuredFilePath) ? featuredFilePath : null;
        let featuredSection = '';
        if (missingNotice) {
            featuredSection = `<div style="background:rgba(255,69,58,0.12);border:1px solid rgba(255,69,58,0.35);border-radius:16px;padding:16px;margin-bottom:18px;text-align:center;">
        <div style="font-size:15px;font-weight:700;color:#ff6961;margin-bottom:4px;">File Unavailable</div>
        <div style="font-size:13px;color:#cfd6e6;">${this.escapeHtml(missingNotice)}</div>
      </div>`;
        }
        else if (featured) {
            const fName = path.basename(featured);
            const fId = this.getFileId(featured);
            const ext = path.extname(fName).replace('.', '').toUpperCase() || 'FILE';
            let fSizeStr = '';
            try {
                fSizeStr = this.formatBytes(fs.statSync(featured).size);
            }
            catch { }
            featuredSection = `<div style="background:linear-gradient(180deg,rgba(0,210,255,0.12),rgba(0,210,255,0.04));border:1px solid rgba(0,210,255,0.35);border-radius:18px;padding:18px;margin-bottom:18px;text-align:center;">
        <div style="display:inline-block;background:rgba(0,210,255,0.2);color:#5be2ff;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700;letter-spacing:0.04em;margin-bottom:10px;">${this.escapeHtml(ext)}</div>
        <div style="font-size:17px;font-weight:700;color:#ffffff;word-break:break-word;line-height:1.35;margin-bottom:6px;">${this.escapeHtml(fName)}</div>
        <div style="font-size:13px;color:#9aa5c4;margin-bottom:16px;">Size: ${this.escapeHtml(fSizeStr)}</div>
        <a href="/download/${fId}" style="display:flex;align-items:center;justify-content:center;width:100%;background:#00d2ff;color:#081018;text-decoration:none;padding:14px 20px;border-radius:14px;font-size:16px;font-weight:700;min-height:48px;touch-action:manipulation;">
          Download File
        </a>
      </div>`;
        }
        const otherFiles = featured ? validFiles.filter(f => f !== featured) : validFiles;
        const trayList = otherFiles.map((f) => {
            const name = path.basename(f);
            const fid = this.getFileId(f);
            let sizeStr = '';
            try {
                sizeStr = this.formatBytes(fs.statSync(f).size);
            }
            catch { }
            return `<li style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;background:#181c26;border:1px solid rgba(255,255,255,0.09);border-radius:14px;margin-bottom:10px;">
        <div style="text-align:left;min-width:0;flex:1;">
          <div style="font-size:14px;font-weight:600;color:#fff;word-break:break-word;line-height:1.3;">${this.escapeHtml(name)}</div>
          <div style="font-size:12px;color:#8892b0;margin-top:3px;">${this.escapeHtml(sizeStr)}</div>
        </div>
        <a href="/download/${fid}" style="flex-shrink:0;background:#00d2ff;color:#0b0e14;text-decoration:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;min-height:44px;touch-action:manipulation;">
          Download
        </a>
      </li>`;
        }).join('');
        const filesSection = otherFiles.length > 0
            ? `<div style="margin-bottom:10px;font-size:12px;font-weight:600;color:#8892b0;text-transform:uppercase;letter-spacing:0.04em;">${featured ? `Other Staged Files (${otherFiles.length})` : `Ready to Download (${otherFiles.length})`}</div><ul style="list-style:none;padding:0;margin:0;">${trayList}</ul>`
            : (!featured && !missingNotice
                ? `<div style="padding:26px 14px;text-align:center;color:#8892b0;font-size:14px;"><p style="margin:0 0 6px;color:#cfd6e6;">No files staged on PC yet.</p><p style="font-size:12px;color:#6c7693;margin:0;">Drag files onto RoboIsland on Windows to download them here.</p></div>`
                : '');
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RoboIsland Drop</title>
  <style>
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
    html,body{margin:0;padding:0;background:#0b0d13;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}
    body{padding:18px 14px 32px;min-height:100vh;display:flex;flex-direction:column;align-items:center;}
    .card{background:#131722;border:1px solid rgba(255,255,255,0.12);border-radius:22px;padding:22px 18px;max-width:460px;width:100%;box-shadow:0 16px 40px rgba(0,0,0,0.7);}
    .badge{display:inline-block;background:rgba(0,210,255,0.15);color:#00d2ff;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;margin-bottom:8px;}
    h2{color:#00d2ff;margin:0 0 4px;font-size:21px;font-weight:700;text-align:center;}
    .sub{color:#8892b0;font-size:13px;text-align:center;margin:0 0 18px;}
    .upload-box{background:rgba(255,255,255,0.03);border:2px dashed rgba(255,255,255,0.15);border-radius:16px;padding:18px;text-align:center;margin-top:18px;}
    .upload-box h3{margin:0 0 6px;font-size:15px;}
    .upload-box p{margin:0 0 14px;font-size:12.5px;color:#8892b0;}
    input[type=file]{display:block;margin:0 auto 14px;font-size:13px;color:#ccc;width:100%;}
    button[type=submit]{background:#27c93f;color:#000;border:none;padding:12px 24px;border-radius:14px;font-weight:700;font-size:15px;cursor:pointer;min-height:46px;width:100%;touch-action:manipulation;}
  </style>
</head>
<body>
  <div class="card">
    <div style="text-align:center;">
      <div class="badge">LAN Direct Transfer</div>
      <h2>RoboIsland Drop</h2>
      <p class="sub">Direct PC-to-Phone transfer over local Wi-Fi</p>
    </div>
    ${featuredSection}
    ${filesSection}
    <div class="upload-box" id="drop-area">
      <h3>Send a File to PC</h3>
      <p>Drag and drop files here or click Choose Files below.</p>
      <form id="upload-form" action="/upload" method="post" enctype="multipart/form-data">
        <input type="file" id="file-input" name="file" multiple required>
        <button type="submit" id="btn-upload">Upload to PC</button>
      </form>
      <div id="upload-status" style="display:none;margin-top:12px;font-size:13.5px;font-weight:600;"></div>
    </div>
  </div>
  <script>
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const uploadForm = document.getElementById('upload-form');
    const uploadStatus = document.getElementById('upload-status');
    const btnUpload = document.getElementById('btn-upload');

    ['dragenter', 'dragover'].forEach(evt => {
      dropArea.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropArea.style.borderColor = '#00d2ff';
        dropArea.style.background = 'rgba(0, 210, 255, 0.08)';
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      dropArea.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropArea.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        dropArea.style.background = 'rgba(255, 255, 255, 0.03)';
      });
    });

    dropArea.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt && dt.files;
      if (files && files.length > 0) {
        uploadFiles(files);
      }
    });

    uploadForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (fileInput.files && fileInput.files.length > 0) {
        uploadFiles(fileInput.files);
      }
    });

    function uploadFiles(files) {
      if (!files || files.length === 0) return;
      uploadStatus.style.display = 'block';
      uploadStatus.style.color = '#00d2ff';
      uploadStatus.textContent = 'Uploading ' + files.length + ' file(s)...';
      btnUpload.disabled = true;
      btnUpload.style.opacity = '0.6';

      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('file', files[i]);
      }

      fetch('/upload', { method: 'POST', body: formData })
        .then(res => res.text())
        .then(() => {
          uploadStatus.style.color = '#27c93f';
          uploadStatus.textContent = 'Uploaded ' + files.length + ' file(s) successfully!';
          setTimeout(() => { window.location.reload(); }, 1200);
        })
        .catch(err => {
          uploadStatus.style.color = '#ff453a';
          uploadStatus.textContent = 'Upload failed: ' + (err.message || 'Network error');
          btnUpload.disabled = false;
          btnUpload.style.opacity = '1.0';
        });
    }
  </script>
</body>
</html>`;
    }
    startLocalDropServer() {
        // Initial best-effort IP detection; async UDP query will update this.lanIp
        this.lanIp = this.detectReachableLanIp();
        this.resolveReachableLanIp().catch(() => { });
        const sendHtml = (res, statusCode, html, headOnly) => {
            const buf = Buffer.from(html, 'utf8');
            res.writeHead(statusCode, {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Length': buf.length,
                'Cache-Control': 'no-store, no-cache, must-revalidate',
            });
            res.end(headOnly ? undefined : buf);
        };
        const resolveTargetFile = (parsedUrl, validFiles) => {
            const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
            const idParam = parsedUrl.searchParams.get('id') || (pathParts.length >= 2 ? pathParts[1] : '');
            if (idParam) {
                const match = validFiles.find((f) => this.getFileId(f) === idParam);
                if (match)
                    return match;
            }
            if (parsedUrl.searchParams.has('idx')) {
                const idx = parseInt(parsedUrl.searchParams.get('idx') || '-1', 10);
                if (idx >= 0 && idx < validFiles.length)
                    return validFiles[idx];
            }
            return null;
        };
        this.dropServer = http.createServer((req, res) => {
            try {
                const parsedUrl = new URL(req.url || '/', `http://${this.lanIp}:${this.dropPort}`);
                const method = req.method || 'GET';
                const isHead = method === 'HEAD';
                if ((method === 'GET' || isHead) && parsedUrl.pathname === '/favicon.ico') {
                    res.writeHead(204);
                    res.end();
                    return;
                }
                // Root, /transfer, or file-specific /file/:id page
                if ((method === 'GET' || isHead) && (parsedUrl.pathname === '/' || parsedUrl.pathname === '/transfer' || parsedUrl.pathname.startsWith('/file/'))) {
                    const validFiles = this.getValidTrayFiles();
                    let featuredFile = null;
                    let missingNotice;
                    if (parsedUrl.pathname.startsWith('/file/')) {
                        const requestedId = parsedUrl.pathname.slice('/file/'.length).replace(/\/+$/, '');
                        featuredFile = validFiles.find((f) => this.getFileId(f) === requestedId) || null;
                        if (!featuredFile) {
                            missingNotice = 'The requested file is no longer staged or could not be found on the PC.';
                        }
                    }
                    else {
                        const qFile = parsedUrl.searchParams.get('id');
                        if (qFile) {
                            featuredFile = validFiles.find((f) => this.getFileId(f) === qFile) || null;
                        }
                        else if (this.activeFilePath && validFiles.includes(this.activeFilePath)) {
                            featuredFile = this.activeFilePath;
                        }
                        else if (validFiles.length === 1) {
                            featuredFile = validFiles[0];
                        }
                    }
                    if (!isHead) {
                        this.notifyRenderers({ type: 'connected' });
                    }
                    const html = this.buildPortalHtml(validFiles, featuredFile, missingNotice);
                    sendHtml(res, missingNotice ? 404 : 200, html, isHead);
                    return;
                }
                // File download route: /download/:id, /download?id=:id, or /download?idx=:idx
                if ((method === 'GET' || isHead) && (parsedUrl.pathname === '/download' || parsedUrl.pathname.startsWith('/download/'))) {
                    const validFiles = this.getValidTrayFiles();
                    const filePath = resolveTargetFile(parsedUrl, validFiles);
                    if (!filePath) {
                        if (isHead) {
                            res.writeHead(404);
                            res.end();
                        }
                        else {
                            sendHtml(res, 404, this.buildPortalHtml(validFiles, null, 'The requested file is unavailable or was removed from the tray.'), false);
                        }
                        return;
                    }
                    const filename = path.basename(filePath);
                    const stat = fs.statSync(filePath);
                    const mimeType = this.getMimeType(filePath);
                    const disposition = this.buildContentDisposition(filename);
                    const rangeHeader = req.headers.range;
                    if (rangeHeader && typeof rangeHeader === 'string') {
                        const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
                        if (match) {
                            const start = match[1] ? parseInt(match[1], 10) : 0;
                            const end = match[2] ? Math.min(parseInt(match[2], 10), stat.size - 1) : stat.size - 1;
                            if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= stat.size) {
                                res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
                                res.end();
                                return;
                            }
                            const chunkSize = end - start + 1;
                            if (!isHead)
                                this.notifyRenderers({ type: 'download', name: filename });
                            res.writeHead(206, {
                                'Content-Type': mimeType,
                                'Content-Disposition': disposition,
                                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                                'Content-Length': chunkSize,
                                'Accept-Ranges': 'bytes',
                                'X-Content-Type-Options': 'nosniff',
                                'Cache-Control': 'no-store',
                            });
                            if (isHead) {
                                res.end();
                                return;
                            }
                            const stream = fs.createReadStream(filePath, { start, end });
                            stream.on('error', (err) => {
                                console.error('[ProductivityEngine] Range stream error:', err);
                                if (!res.headersSent)
                                    res.writeHead(500);
                                res.end();
                            });
                            res.on('close', () => { try {
                                stream.destroy();
                            }
                            catch { } });
                            stream.pipe(res);
                            return;
                        }
                    }
                    if (!isHead) {
                        this.notifyRenderers({ type: 'download', name: filename });
                    }
                    res.writeHead(200, {
                        'Content-Type': mimeType,
                        'Content-Disposition': disposition,
                        'Content-Length': stat.size,
                        'Accept-Ranges': 'bytes',
                        'X-Content-Type-Options': 'nosniff',
                        'Cache-Control': 'no-store',
                    });
                    if (isHead) {
                        res.end();
                        return;
                    }
                    const stream = fs.createReadStream(filePath);
                    let transferred = 0;
                    let lastProgressEmit = 0;
                    stream.on('data', (chunk) => {
                        transferred += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
                        const now = Date.now();
                        if (now - lastProgressEmit > 180 || transferred >= stat.size) {
                            lastProgressEmit = now;
                            this.notifyRenderers({
                                type: 'progress',
                                direction: 'download',
                                name: filename,
                                transferred,
                                total: stat.size,
                                percent: stat.size > 0 ? Math.min(100, Math.round((transferred / stat.size) * 100)) : 0,
                            });
                        }
                    });
                    stream.on('error', (err) => {
                        console.error('[ProductivityEngine] Stream error during download:', err);
                        if (!res.headersSent)
                            res.writeHead(500);
                        res.end();
                    });
                    res.on('close', () => { try {
                        stream.destroy();
                    }
                    catch { } });
                    stream.pipe(res);
                    return;
                }
                if (req.method === 'POST' && parsedUrl.pathname === '/upload') {
                    const downloads = electron_1.app.getPath('downloads');
                    // Parse boundary — strip optional quotes and whitespace
                    const ctHeader = req.headers['content-type'] || '';
                    const boundaryMatch = ctHeader.match(/boundary=("?)([^";,\s]+)\1/);
                    const boundary = boundaryMatch ? boundaryMatch[2] : '';
                    if (!boundary) {
                        res.writeHead(400);
                        res.end('Missing boundary');
                        return;
                    }
                    const totalExpected = parseInt(req.headers['content-length'] || '0', 10);
                    let uploadedBytes = 0;
                    let lastUploadEmit = 0;
                    const chunks = [];
                    req.on('data', (chunk) => {
                        chunks.push(chunk);
                        uploadedBytes += chunk.length;
                        const now = Date.now();
                        if (now - lastUploadEmit > 180 || (totalExpected > 0 && uploadedBytes >= totalExpected)) {
                            lastUploadEmit = now;
                            this.notifyRenderers({
                                type: 'progress',
                                direction: 'upload',
                                transferred: uploadedBytes,
                                total: totalExpected,
                                percent: totalExpected > 0 ? Math.min(100, Math.round((uploadedBytes / totalExpected) * 100)) : 0,
                            });
                        }
                    });
                    req.on('end', () => {
                        const buffer = Buffer.concat(chunks);
                        const savedFiles = [];
                        const boundaryBytes = Buffer.from(`--${boundary}`);
                        let searchPos = 0;
                        while (searchPos < buffer.length) {
                            const partStart = buffer.indexOf(boundaryBytes, searchPos);
                            if (partStart === -1)
                                break;
                            const nextPartStart = buffer.indexOf(boundaryBytes, partStart + boundaryBytes.length);
                            if (nextPartStart === -1)
                                break;
                            const part = buffer.subarray(partStart + boundaryBytes.length, nextPartStart);
                            searchPos = nextPartStart;
                            const headerEnd = part.indexOf('\r\n\r\n');
                            if (headerEnd === -1)
                                continue;
                            const headerStr = part.toString('latin1', 0, headerEnd);
                            const headerMatch = headerStr.match(/[Cc]ontent-[Dd]isposition:[^\r\n]*filename\*?=(?:UTF-8''|"?)([^";\r\n]+)/i)
                                || headerStr.match(/filename="([^"]+)"/i)
                                || headerStr.match(/filename=([^\s;"\r\n]+)/i);
                            if (headerMatch && headerMatch[1]) {
                                let filename = headerMatch[1].trim();
                                try {
                                    filename = decodeURIComponent(filename);
                                }
                                catch { }
                                filename = path.basename(filename).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || `drop-${Date.now()}-${savedFiles.length}.bin`;
                                let fileData = part.subarray(headerEnd + 4);
                                if (fileData.length >= 2 && fileData[fileData.length - 2] === 0x0d && fileData[fileData.length - 1] === 0x0a) {
                                    fileData = fileData.subarray(0, fileData.length - 2);
                                }
                                const savePath = path.join(downloads, filename);
                                fs.writeFileSync(savePath, fileData);
                                savedFiles.push(savePath);
                                if (!this.trayFiles.includes(savePath)) {
                                    this.trayFiles.unshift(savePath);
                                }
                            }
                        }
                        if (savedFiles.length === 0) {
                            let filename = `drop-${Date.now()}.bin`;
                            const headerSection = buffer.toString('latin1', 0, Math.min(buffer.length, 2048));
                            const headerMatch = headerSection.match(/[Cc]ontent-[Dd]isposition:[^\r\n]*filename\*?=(?:UTF-8''|"?)([^";\r\n]+)/i)
                                || headerSection.match(/filename="([^"]+)"/i)
                                || headerSection.match(/filename=([^\s;"\r\n]+)/i);
                            if (headerMatch && headerMatch[1]) {
                                try {
                                    filename = decodeURIComponent(headerMatch[1].trim());
                                }
                                catch {
                                    filename = headerMatch[1].trim();
                                }
                                filename = path.basename(filename).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || `drop-${Date.now()}.bin`;
                            }
                            const savePath = path.join(downloads, filename);
                            const headerEnd = buffer.indexOf('\r\n\r\n');
                            const tailEnd = buffer.lastIndexOf(`\r\n--${boundary}`);
                            if (headerEnd !== -1 && tailEnd > headerEnd) {
                                const fileData = buffer.subarray(headerEnd + 4, tailEnd);
                                fs.writeFileSync(savePath, fileData);
                            }
                            else {
                                fs.writeFileSync(savePath, buffer);
                            }
                            savedFiles.push(savePath);
                            if (!this.trayFiles.includes(savePath)) {
                                this.trayFiles.unshift(savePath);
                            }
                        }
                        try {
                            fs.writeFileSync(this.trayPath, JSON.stringify(this.trayFiles));
                        }
                        catch { }
                        // Set most recently uploaded file as active and notify renderers
                        if (savedFiles.length > 0 && fs.existsSync(savedFiles[0])) {
                            this.activeFilePath = savedFiles[0];
                        }
                        this.notifyRenderers({ type: 'upload', files: savedFiles });
                        const fileCountStr = savedFiles.length === 1
                            ? `<b>${this.escapeHtml(path.basename(savedFiles[0]))}</b> has been saved to your PC Downloads folder.`
                            : `<b>${savedFiles.length} files</b> have been saved to your PC Downloads folder.`;
                        const uploadHtml = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="background:#0c0e14;color:#fff;font-family:sans-serif;text-align:center;padding:40px 16px;">
            <div style="background:#131722;padding:24px;border-radius:18px;max-width:360px;margin:0 auto;border:1px solid rgba(255,255,255,0.1);">
              <div style="width:48px;height:48px;margin:0 auto 12px;border-radius:50%;background:rgba(0,255,102,0.15);display:flex;align-items:center;justify-content:center;">
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="#00ff66" stroke-width="2.5" fill="none"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2 style="color:#00ff66;margin:0 0 8px;">File Received</h2>
              <p style="color:#aaa;">${fileCountStr}</p>
              <a href="/" style="display:inline-block;margin-top:16px;background:#00d2ff;color:#000;text-decoration:none;padding:10px 20px;border-radius:20px;font-weight:bold;">Send Another</a>
            </div>
          </body></html>`;
                        res.writeHead(200, {
                            'Content-Type': 'text/html; charset=utf-8',
                            'Content-Length': Buffer.byteLength(uploadHtml, 'utf8'),
                            'Cache-Control': 'no-store',
                        });
                        res.end(uploadHtml);
                    });
                    req.on('error', (err) => {
                        console.error('[ProductivityEngine] Upload request error:', err);
                        if (!res.headersSent)
                            res.writeHead(500);
                        res.end('Upload error');
                    });
                    return;
                }
                const notFoundHtml = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="background:#0b0d13;color:#fff;font-family:sans-serif;text-align:center;padding:40px 16px;"><div style="background:#131722;padding:24px;border-radius:18px;max-width:380px;margin:0 auto;border:1px solid rgba(255,255,255,0.12);"><h2 style="color:#ff5f56;margin:0 0 8px;">404 - Page Not Found</h2><p style="color:#9aa4bf;">The requested RoboIsland LAN Drop route does not exist.</p><a href="/" style="display:inline-block;margin-top:14px;background:#00d2ff;color:#000;text-decoration:none;padding:10px 20px;border-radius:14px;font-weight:700;">Open LAN Drop</a></div></body></html>`;
                res.writeHead(404, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Content-Length': Buffer.byteLength(notFoundHtml, 'utf8'),
                    'Cache-Control': 'no-store',
                });
                res.end(req.method === 'HEAD' ? undefined : notFoundHtml);
            }
            catch (err) {
                console.error('[ProductivityEngine] HTTP request handler error:', err);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                }
                res.end('Internal server error');
            }
        });
        this.dropServer.on('error', (err) => {
            console.error('[ProductivityEngine] LAN Drop Server error:', err);
            if (err && err.code === 'EADDRINUSE') {
                console.warn(`[ProductivityEngine] Port ${this.dropPort} is already in use; reusing existing listener.`);
            }
        });
        try {
            this.dropServer.listen(this.dropPort, '0.0.0.0', () => {
                console.log(`[ProductivityEngine] LAN Drop Server listening on 0.0.0.0:${this.dropPort}`);
            });
        }
        catch (err) {
            console.error('[ProductivityEngine] Failed to start LAN Drop server:', err);
        }
    }
    showFocusGuard(blockedTarget) {
        if (this.guardWindow && !this.guardWindow.isDestroyed())
            return;
        this.guardWindow = new electron_1.BrowserWindow({
            width: 580,
            height: 400,
            transparent: true,
            frame: false,
            alwaysOnTop: true,
            resizable: false,
            center: true,
            backgroundColor: '#00000000',
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false
            }
        });
        const guardHtml = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin:0; background: rgba(14,16,22,0.96); color: #fff; font-family: -apple-system, sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; border-radius:24px; border:1px solid rgba(255,255,255,0.15); box-shadow:0 20px 60px rgba(0,0,0,0.8); }
    h1 { color: #00d2ff; font-size: 26px; margin-bottom: 8px; }
    p { color: rgba(255,255,255,0.7); font-size: 14px; text-align:center; max-width: 440px; margin-bottom: 24px; }
    button { background: #00d2ff; border:none; color:#000; padding:12px 28px; border-radius:24px; font-weight:600; cursor:pointer; }
  </style>
</head>
<body>
  <h1>Focus Guard Active</h1>
  <p>You opened <b>${blockedTarget}</b> during your focus session. Take a deep breath and stay in the zone!</p>
  <button onclick="window.close()">Back to Focus</button>
</body>
</html>`;
        this.guardWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(guardHtml)}`);
    }
    setupIPC() {
        electron_1.ipcMain.handle('tools:clipboard-get', () => {
            return this.clipboardHistory;
        });
        electron_1.ipcMain.handle('tools:clipboard-copy', async (_event, item) => {
            try {
                if (item.type === 'image' && item.filePath && fs.existsSync(item.filePath)) {
                    const buf = fs.readFileSync(item.filePath);
                    const mime = item.filePath.endsWith('.jpg') || item.filePath.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
                    const clipItem = new electron_1.ClipboardItem({
                        [mime]: new Blob([buf], { type: mime })
                    });
                    await electron_1.clipboard.write([clipItem]);
                    return { ok: true, type: 'image' };
                }
                else if (item.text) {
                    await electron_1.clipboard.writeText(item.text);
                    return { ok: true, type: 'text' };
                }
            }
            catch (err) {
                return { ok: false, error: String(err) };
            }
            return { ok: false };
        });
        electron_1.ipcMain.handle('tools:clipboard-delete', (_event, id) => {
            this.clipboardHistory = this.clipboardHistory.filter(c => c.id !== id);
            this.savePersistedClipboard();
            return { ok: true };
        });
        electron_1.ipcMain.handle('tools:clipboard-clear', () => {
            this.clipboardHistory = [];
            this.savePersistedClipboard();
            return { ok: true };
        });
        electron_1.ipcMain.on('tools:clipboard-drag-out', (event, filePath) => {
            try {
                if (filePath && typeof filePath === 'string' && fs.existsSync(filePath)) {
                    let icon = electron_1.nativeImage.createEmpty();
                    try {
                        const img = electron_1.nativeImage.createFromPath(filePath);
                        icon = img.resize({ width: 64, height: 64 });
                    }
                    catch { }
                    event.sender.startDrag({
                        file: filePath,
                        icon
                    });
                }
            }
            catch (err) {
                console.error('[ProductivityEngine] clipboard startDrag error:', err);
            }
        });
        electron_1.ipcMain.handle('tools:convert-file', async (_event, args) => {
            const { filePath, targetFormat } = args || {};
            if (!filePath || !targetFormat) {
                return { success: false, error: 'Missing file path or target format' };
            }
            try {
                const res = await this.documentConverter.convert(filePath, targetFormat);
                if (res.success && res.outputPath && fs.existsSync(res.outputPath)) {
                    // Auto-stage converted file into tray shelf so user can drag it out or transfer it
                    this.trayFiles = [...new Set([res.outputPath, ...this.trayFiles])].slice(0, 24);
                    this.activeFilePath = res.outputPath;
                    this.savePersistedTrayFiles();
                    this.notifyRenderers({
                        type: 'upload',
                        files: [res.outputPath],
                        name: path.basename(res.outputPath)
                    });
                }
                return res;
            }
            catch (err) {
                return { success: false, error: err.message || 'Conversion failed' };
            }
        });
        electron_1.ipcMain.handle('tools:note-save', (_event, text) => {
            try {
                fs.writeFileSync(this.scratchpadPath, text, 'utf8');
                return { ok: true };
            }
            catch {
                return { ok: false };
            }
        });
        electron_1.ipcMain.handle('tools:note-get', () => {
            try {
                if (fs.existsSync(this.scratchpadPath)) {
                    return fs.readFileSync(this.scratchpadPath, 'utf8');
                }
            }
            catch { }
            return '';
        });
        electron_1.ipcMain.handle('tools:tray-get', () => {
            return this.getValidTrayFiles();
        });
        electron_1.ipcMain.handle('tools:tray-add', (_event, paths) => {
            const incoming = (Array.isArray(paths) ? paths : []).filter((p) => {
                try {
                    return typeof p === 'string' && p.length > 0 && fs.existsSync(p) && fs.statSync(p).isFile();
                }
                catch {
                    return false;
                }
            });
            this.trayFiles = [...new Set([...incoming, ...this.trayFiles])].slice(0, 24);
            const valid = this.getValidTrayFiles();
            if (incoming.length > 0 && valid.includes(incoming[0])) {
                this.activeFilePath = incoming[0];
            }
            else if (!this.activeFilePath || !valid.includes(this.activeFilePath)) {
                this.activeFilePath = valid[0] || null;
            }
            this.savePersistedTrayFiles();
            if (incoming.length > 0) {
                this.notifyRenderers({
                    type: 'upload',
                    files: incoming,
                    name: path.basename(incoming[0]),
                });
            }
            return valid;
        });
        electron_1.ipcMain.handle('tools:tray-browse', async () => {
            const focused = electron_1.BrowserWindow.getFocusedWindow() || electron_1.BrowserWindow.getAllWindows()[0] || undefined;
            const result = await electron_1.dialog.showOpenDialog(focused, {
                title: 'Select Files to Send to Phone',
                properties: ['openFile', 'multiSelections'],
            });
            if (!result.canceled && result.filePaths.length > 0) {
                this.trayFiles = [...new Set([...result.filePaths, ...this.trayFiles])].slice(0, 24);
                const valid = this.getValidTrayFiles();
                if (valid.includes(result.filePaths[0])) {
                    this.activeFilePath = result.filePaths[0];
                }
                else if (!this.activeFilePath || !valid.includes(this.activeFilePath)) {
                    this.activeFilePath = valid[0] || null;
                }
                this.savePersistedTrayFiles();
                this.notifyRenderers({
                    type: 'upload',
                    files: result.filePaths,
                    name: path.basename(result.filePaths[0]),
                });
                return valid;
            }
            return this.getValidTrayFiles();
        });
        electron_1.ipcMain.handle('tools:tray-clear', () => {
            this.trayFiles = [];
            this.activeFilePath = null;
            this.savePersistedTrayFiles();
            return [];
        });
        electron_1.ipcMain.handle('tools:tray-remove', (_event, idx) => {
            if (idx >= 0 && idx < this.trayFiles.length) {
                const [removed] = this.trayFiles.splice(idx, 1);
                const valid = this.getValidTrayFiles();
                if (removed && this.activeFilePath === removed) {
                    this.activeFilePath = valid[0] || null;
                }
                this.savePersistedTrayFiles();
                return valid;
            }
            return this.getValidTrayFiles();
        });
        electron_1.ipcMain.handle('tools:drop-set-active', (_event, filePath) => {
            const valid = this.getValidTrayFiles();
            if (filePath && valid.includes(filePath)) {
                this.activeFilePath = filePath;
            }
            else {
                this.activeFilePath = valid[0] || null;
            }
            return {
                activeFilePath: this.activeFilePath,
                activeFileId: this.activeFilePath ? this.getFileId(this.activeFilePath) : null,
            };
        });
        electron_1.ipcMain.handle('tools:drop-info', async () => {
            this.lanIp = await this.resolveReachableLanIp();
            const validPaths = this.getValidTrayFiles();
            const targetFile = (this.activeFilePath && validPaths.includes(this.activeFilePath))
                ? this.activeFilePath
                : (validPaths[0] || null);
            this.activeFilePath = targetFile;
            const activeFileId = targetFile ? this.getFileId(targetFile) : null;
            const url = activeFileId
                ? `http://${this.lanIp}:${this.dropPort}/file/${activeFileId}`
                : `http://${this.lanIp}:${this.dropPort}/`;
            const svg = this.generateQrSvg(url);
            const validFiles = validPaths.map((f, i) => {
                let size = 0;
                try {
                    size = fs.statSync(f).size;
                }
                catch { }
                const fileId = this.getFileId(f);
                return {
                    id: i,
                    fileId,
                    name: path.basename(f),
                    path: f,
                    size,
                    sizeFormatted: this.formatBytes(size),
                    isActive: f === targetFile,
                };
            });
            return {
                url,
                ip: this.lanIp,
                port: this.dropPort,
                svg,
                activeFileId,
                activeFilePath: targetFile,
                files: validFiles,
            };
        });
        electron_1.ipcMain.handle('tools:file-preview-data', async (_event, filePath) => {
            try {
                if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) {
                    return { exists: false, error: 'File not found' };
                }
                const stat = fs.statSync(filePath);
                if (!stat.isFile()) {
                    return { exists: false, error: 'Not a regular file' };
                }
                const ext = path.extname(filePath).toLowerCase();
                const name = path.basename(filePath);
                const mimeType = this.getMimeType(filePath);
                const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
                const textExts = [
                    '.txt', '.md', '.markdown', '.js', '.jsx', '.ts', '.tsx', '.json',
                    '.html', '.htm', '.css', '.scss', '.sass', '.less', '.py', '.c',
                    '.cpp', '.h', '.hpp', '.cs', '.rs', '.go', '.java', '.kt', '.sh',
                    '.bash', '.ps1', '.bat', '.cmd', '.yml', '.yaml', '.xml', '.log',
                    '.ini', '.env', '.toml', '.sql', '.conf',
                ];
                const audioExts = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma'];
                const videoExts = ['.mp4', '.webm', '.mov', '.mkv', '.avi'];
                let category = 'binary';
                let content = null;
                let lineCount;
                if (imageExts.includes(ext)) {
                    category = 'image';
                    if (stat.size <= 12 * 1024 * 1024) {
                        const buf = fs.readFileSync(filePath);
                        content = `data:${mimeType};base64,${buf.toString('base64')}`;
                    }
                }
                else if (textExts.includes(ext)) {
                    category = 'text';
                    const buf = Buffer.alloc(Math.min(stat.size, 64 * 1024));
                    const fd = fs.openSync(filePath, 'r');
                    fs.readSync(fd, buf, 0, buf.length, 0);
                    fs.closeSync(fd);
                    const text = buf.toString('utf8');
                    content = text;
                    lineCount = (text.match(/\n/g) || []).length + 1;
                }
                else if (audioExts.includes(ext)) {
                    category = 'audio';
                }
                else if (videoExts.includes(ext)) {
                    category = 'video';
                }
                else if (ext === '.pdf') {
                    category = 'pdf';
                }
                else {
                    category = 'binary';
                }
                return {
                    exists: true,
                    path: filePath,
                    name,
                    ext: ext.replace(/^\./, '').toUpperCase() || 'FILE',
                    size: stat.size,
                    sizeFormatted: this.formatBytes(stat.size),
                    mtime: stat.mtime.toLocaleString(),
                    category,
                    mimeType,
                    content,
                    lineCount,
                };
            }
            catch (err) {
                return { exists: false, error: err?.message || 'Failed to read file' };
            }
        });
        electron_1.ipcMain.on('tools:tray-drag-out', (event, filePath) => {
            try {
                if (filePath && typeof filePath === 'string' && fs.existsSync(filePath)) {
                    let icon = electron_1.nativeImage.createEmpty();
                    const iconPath = path.join(__dirname, '../../assets/icon-48.png');
                    if (fs.existsSync(iconPath)) {
                        icon = electron_1.nativeImage.createFromPath(iconPath);
                    }
                    event.sender.startDrag({
                        file: filePath,
                        icon,
                    });
                }
            }
            catch (err) {
                console.error('[ProductivityEngine] startDrag error:', err);
            }
        });
        try {
            electron_1.ipcMain.removeHandler('tools:show-item-in-folder');
        }
        catch { }
        electron_1.ipcMain.handle('tools:show-item-in-folder', (_event, filePath) => {
            try {
                if (filePath && typeof filePath === 'string' && fs.existsSync(filePath)) {
                    electron_1.shell.showItemInFolder(filePath);
                    return true;
                }
            }
            catch { }
            return false;
        });
        electron_1.ipcMain.handle('tools:open-path', async (_event, filePath) => {
            try {
                if (filePath && typeof filePath === 'string' && fs.existsSync(filePath)) {
                    const err = await electron_1.shell.openPath(filePath);
                    return !err;
                }
            }
            catch { }
            return false;
        });
    }
    async resolveReachableLanIp() {
        return new Promise((resolve) => {
            let resolved = false;
            const done = (ip) => {
                if (!resolved) {
                    resolved = true;
                    this.lanIp = ip;
                    resolve(ip);
                }
            };
            try {
                const socket = dgram.createSocket('udp4');
                const timeout = setTimeout(() => {
                    try {
                        socket.close();
                    }
                    catch { }
                    done(this.detectReachableLanIpFallback());
                }, 1500);
                socket.on('error', () => {
                    clearTimeout(timeout);
                    try {
                        socket.close();
                    }
                    catch { }
                    done(this.detectReachableLanIpFallback());
                });
                socket.connect(80, '8.8.8.8', () => {
                    clearTimeout(timeout);
                    try {
                        const addr = socket.address().address;
                        socket.close();
                        if (addr && addr !== '0.0.0.0' && !addr.startsWith('127.') && !addr.startsWith('192.168.56.')) {
                            done(addr);
                            return;
                        }
                    }
                    catch { }
                    done(this.detectReachableLanIpFallback());
                });
            }
            catch {
                done(this.detectReachableLanIpFallback());
            }
        });
    }
    detectReachableLanIp() {
        if (this.lanIp && this.lanIp !== '127.0.0.1' && !this.lanIp.startsWith('169.254.')) {
            return this.lanIp;
        }
        return this.detectReachableLanIpFallback();
    }
    detectReachableLanIpFallback() {
        const interfaces = os.networkInterfaces();
        // Skip pure VM/loopback adapters but NOT vEthernet bridged to real Wi-Fi
        const hardSkip = ['loopback pseudo', 'virtualbox host-only', 'default switch'];
        // Pass 1: real private LAN IPs excluding VirtualBox host-only and APIPA
        for (const [name, addrs] of Object.entries(interfaces)) {
            const lower = name.toLowerCase();
            if (hardSkip.some(k => lower.includes(k)))
                continue;
            if (lower.includes('wsl') || lower.includes('vmware'))
                continue;
            for (const iface of addrs || []) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    if (iface.address.startsWith('169.254.') || iface.address.startsWith('192.168.56.'))
                        continue;
                    if (iface.address.startsWith('192.168.') ||
                        iface.address.startsWith('10.') ||
                        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(iface.address)) {
                        return iface.address;
                    }
                }
            }
        }
        // Pass 2: any valid non-APIPA, non-VirtualBox-host-only IPv4
        for (const [name, addrs] of Object.entries(interfaces)) {
            const lower = name.toLowerCase();
            if (hardSkip.some(k => lower.includes(k)))
                continue;
            if (lower.includes('wsl') || lower.includes('vmware'))
                continue;
            for (const iface of addrs || []) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    if (!iface.address.startsWith('169.254.') && !iface.address.startsWith('192.168.56.')) {
                        return iface.address;
                    }
                }
            }
        }
        // Pass 3: last resort — any non-loopback, non-APIPA IPv4 (includes bridged vEthernet)
        for (const [name, addrs] of Object.entries(interfaces)) {
            const lower = name.toLowerCase();
            if (lower.includes('loopback') || lower.includes('virtualbox host-only'))
                continue;
            for (const iface of addrs || []) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    if (!iface.address.startsWith('169.254.') && !iface.address.startsWith('192.168.56.')) {
                        return iface.address;
                    }
                }
            }
        }
        return '127.0.0.1';
    }
    generateQrSvg(url) {
        try {
            const qrGen = require('./qr.js');
            const code = qrGen(url, 'M');
            const s = code.size;
            const margin = 4;
            const total = s + margin * 2;
            let paths = '';
            for (let y = 0; y < s; y++) {
                for (let x = 0; x < s; x++) {
                    if (code.dark(x, y)) {
                        paths += `M${x + margin},${y + margin}h1v1h-1z `;
                    }
                }
            }
            // High contrast black-on-white SVG with ISO/IEC 18004 4-module quiet zone and unclipped rx="0"
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="148" height="148" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff" rx="0"/><path fill="#000000" d="${paths}"/></svg>`;
        }
        catch (err) {
            console.error('[ProductivityEngine] QR generation failed:', err);
            return '';
        }
    }
    getDropPort() {
        return this.dropPort;
    }
    getLanIp() {
        return this.lanIp;
    }
    getDropServer() {
        return this.dropServer;
    }
    dispose() {
        if (this.clipboardWatcherTimer) {
            clearInterval(this.clipboardWatcherTimer);
            this.clipboardWatcherTimer = null;
        }
        if (this.dropServer) {
            try {
                this.dropServer.closeAllConnections?.();
                this.dropServer.close();
            }
            catch { }
            this.dropServer = null;
        }
    }
}
exports.ProductivityEngine = ProductivityEngine;
