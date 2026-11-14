/**
 * RoboIsland 2.0 Project Mode & Git Indexer (Milestone M7 Part B)
 * 
 * Features:
 * 1. High-performance workspace directory crawler with ignore filters.
 * 2. Capped at 500 files for sub-50ms indexing latency.
 * 3. File metadata extraction: relative path, size, modified date, extension, line count.
 * 4. Fast full-text and fuzzy search ranking by filename and file content.
 * 5. Git repository status inspection (branch name, dirty count, staged/unstaged files).
 * 6. Code reading and syntax-highlighted preview data preparation.
 * 7. Electron IPC handlers registration for Project Mode.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

// Optional Electron imports for safe loading in Node.js test runners
let electronModule: any = null;
try {
  electronModule = require('electron');
} catch {
  // Running outside Electron (e.g. standalone test scripts)
}

export interface FileMetadata {
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

export interface IndexedFile extends FileMetadata {
  content?: string;
}

export interface GitStatus {
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

export interface ContentSnippet {
  line: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

export interface SearchResult {
  file: FileMetadata;
  score: number;
  matchType: 'exact-name' | 'prefix-name' | 'contains-name' | 'fuzzy-name' | 'content';
  filenameMatches: boolean;
  snippets: ContentSnippet[];
}

export interface WorkspaceIndexResult {
  rootPath: string;
  fileCount: number;
  capped: boolean;
  durationMs: number;
  files: FileMetadata[];
  gitStatus: GitStatus;
}

export interface IndexerOptions {
  maxFiles?: number;
  maxFileSizeForContent?: number; // In bytes (default 128 KB)
  ignorePatterns?: string[];
}

export const DEFAULT_IGNORE_PATTERNS: string[] = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.bin',
  '.vscode',
  '.idea',
  'coverage',
  '.cache',
  'out',
  'target',
  '.next',
  '.nuxt',
  'vendor',
  'tmp',
  'temp',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'release'
];

export const BINARY_EXTENSIONS = new Set<string>([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svgz',
  '.zip', '.tar', '.gz', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.mp3', '.wav', '.ogg', '.flac', '.mp4', '.mkv', '.avi', '.mov',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.class', '.pyc', '.pyd'
]);

/**
 * Format raw byte size into human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/**
 * Checks if a buffer contains binary/null bytes.
 */
export function isBinaryBuffer(buf: Buffer): boolean {
  const len = Math.min(buf.length, 512);
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

/**
 * Fuzzy match algorithm: tests if chars of query occur in sequence in target.
 * Returns match score (0 if no match, higher for closer / consecutive matches).
 */
export function fuzzyMatch(target: string, query: string): { matches: boolean; score: number } {
  const t = target.toLowerCase();
  const q = query.toLowerCase();

  if (q.length === 0) return { matches: true, score: 0 };
  if (q.length > t.length) return { matches: false, score: 0 };

  let tIdx = 0;
  let qIdx = 0;
  let score = 0;
  let consecutive = 0;

  while (tIdx < t.length && qIdx < q.length) {
    if (t[tIdx] === q[qIdx]) {
      qIdx++;
      consecutive++;
      score += 10 + consecutive * 5;
    } else {
      consecutive = 0;
    }
    tIdx++;
  }

  const matches = qIdx === q.length;
  if (!matches) return { matches: false, score: 0 };

  // Penalize distance from start
  const firstIndex = t.indexOf(q[0]);
  if (firstIndex > 0) score -= Math.min(firstIndex * 2, 20);

  return { matches: true, score };
}

/**
 * Workspace Indexer Core Engine
 */
export class ProjectIndexer {
  private workspaceRoot: string = '';
  private indexedFiles: Map<string, IndexedFile> = new Map();
  private isCapped: boolean = false;
  private lastIndexDurationMs: number = 0;
  private options: Required<IndexerOptions>;

  constructor(options?: IndexerOptions) {
    this.options = {
      maxFiles: options?.maxFiles ?? 500,
      maxFileSizeForContent: options?.maxFileSizeForContent ?? 128 * 1024, // 128 KB
      ignorePatterns: options?.ignorePatterns ?? [...DEFAULT_IGNORE_PATTERNS]
    };
  }

  /**
   * Sets or updates workspace root and indexes the directory.
   */
  public async indexWorkspace(dirPath: string): Promise<WorkspaceIndexResult> {
    const startTime = Date.now();
    const resolvedPath = path.resolve(dirPath);

    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
      throw new Error(`Invalid workspace directory: ${resolvedPath}`);
    }

    this.workspaceRoot = resolvedPath;
    this.indexedFiles.clear();
    this.isCapped = false;

    // Crawl directory
    this.crawlDirectory(resolvedPath);

    this.lastIndexDurationMs = Date.now() - startTime;

    const gitStatus = this.getGitStatus(resolvedPath);

    return {
      rootPath: this.workspaceRoot,
      fileCount: this.indexedFiles.size,
      capped: this.isCapped,
      durationMs: this.lastIndexDurationMs,
      files: this.getFileMetadataList(),
      gitStatus
    };
  }

  /**
   * In-memory directory crawler with strict 500-file capping.
   */
  private crawlDirectory(currentDir: string, relDir: string = ''): void {
    if (this.indexedFiles.size >= this.options.maxFiles) {
      this.isCapped = true;
      return;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    // Sort entries: files first then folders for consistent deterministic traversal
    entries.sort((a, b) => (a.name < b.name ? -1 : 1));

    const subDirs: Array<{ fullPath: string; relDir: string }> = [];

    for (const entry of entries) {
      if (this.indexedFiles.size >= this.options.maxFiles) {
        this.isCapped = true;
        return;
      }

      const entryName = entry.name;

      // Ignore check
      if (this.shouldIgnore(entryName)) {
        continue;
      }

      const fullPath = path.join(currentDir, entryName);
      const relPath = relDir ? `${relDir}/${entryName}` : entryName;

      if (entry.isDirectory()) {
        subDirs.push({ fullPath, relDir: relPath });
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        try {
          const stats = fs.statSync(fullPath);
          const ext = path.extname(entryName).toLowerCase();
          const isBinary = BINARY_EXTENSIONS.has(ext);

          const fileInfo: IndexedFile = {
            path: fullPath,
            relativePath: relPath,
            name: entryName,
            extension: ext,
            size: stats.size,
            formattedSize: formatBytes(stats.size),
            modifiedMs: stats.mtimeMs,
            modifiedIso: stats.mtime.toISOString(),
            isBinary,
            lineCount: undefined,
            content: undefined
          };

          this.indexedFiles.set(relPath, fileInfo);
        } catch {
          // File access failed or was removed during indexing
        }
      }
    }

    // Recurse subdirectories
    for (const sub of subDirs) {
      if (this.indexedFiles.size >= this.options.maxFiles) {
        this.isCapped = true;
        break;
      }
      this.crawlDirectory(sub.fullPath, sub.relDir);
    }
  }

  /**
   * Checks whether a file or directory name matches ignore rules.
   */
  public shouldIgnore(name: string): boolean {
    if (name.startsWith('.') && name !== '.' && name !== '..') {
      // Ignore hidden files and directories except common root configs if needed
      if (name === '.git' || name === '.bin' || name === '.vscode' || name === '.idea' || name === '.cache') {
        return true;
      }
    }

    for (const pattern of this.options.ignorePatterns) {
      if (pattern.startsWith('*.')) {
        const ext = pattern.slice(1).toLowerCase();
        if (name.toLowerCase().endsWith(ext)) return true;
      } else if (name.toLowerCase() === pattern.toLowerCase()) {
        return true;
      }
    }

    return false;
  }

  /**
   * Fast full-text and fuzzy search ranking by filename and content.
   */
  public search(query: string, maxResults: number = 50): SearchResult[] {
    const trimmed = (query || '').trim();
    const results: SearchResult[] = [];

    if (!trimmed) {
      // Empty query returns recently modified files up to maxResults
      const allFiles = Array.from(this.indexedFiles.values())
        .sort((a, b) => b.modifiedMs - a.modifiedMs)
        .slice(0, maxResults);

      return allFiles.map((f) => ({
        file: this.stripContent(f),
        score: 1,
        matchType: 'contains-name',
        filenameMatches: false,
        snippets: []
      }));
    }

    const qLower = trimmed.toLowerCase();

    for (const file of this.indexedFiles.values()) {
      const nameLower = file.name.toLowerCase();
      const relLower = file.relativePath.toLowerCase();
      const extLower = file.extension.toLowerCase();
      const nameWithoutExt = nameLower.slice(0, nameLower.length - extLower.length);

      let score = 0;
      let matchType: SearchResult['matchType'] = 'contains-name';
      let filenameMatches = false;

      // 1. Filename exact match
      if (nameLower === qLower) {
        score += 1000;
        matchType = 'exact-name';
        filenameMatches = true;
      } else if (nameWithoutExt === qLower) {
        score += 850;
        matchType = 'exact-name';
        filenameMatches = true;
      }
      // 2. Filename prefix match
      else if (nameLower.startsWith(qLower)) {
        score += 600;
        matchType = 'prefix-name';
        filenameMatches = true;
      }
      // 3. Filename substring match
      else if (nameLower.includes(qLower)) {
        score += 400;
        matchType = 'contains-name';
        filenameMatches = true;
      }
      // 4. Relative path substring match
      else if (relLower.includes(qLower)) {
        score += 250;
        matchType = 'contains-name';
        filenameMatches = true;
      }
      // 5. Fuzzy match on filename
      else {
        const fuzzy = fuzzyMatch(file.name, trimmed);
        if (fuzzy.matches) {
          score += 150 + fuzzy.score;
          matchType = 'fuzzy-name';
          filenameMatches = true;
        }
      }

      // 6. Full-text content search
      const snippets: ContentSnippet[] = [];
      const content = this.getFileContent(file);
      if (content) {
        const lines = content.split(/\r?\n/);
        let contentHits = 0;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineLower = line.toLowerCase();
          const matchIdx = lineLower.indexOf(qLower);

          if (matchIdx !== -1) {
            contentHits++;
            if (snippets.length < 5) {
              snippets.push({
                line: i + 1,
                text: line.length > 200 ? line.slice(0, 200) + '...' : line,
                matchStart: matchIdx,
                matchEnd: matchIdx + qLower.length
              });
            }
          }
        }

        if (contentHits > 0) {
          if (!filenameMatches) {
            matchType = 'content';
          }
          // Boost score based on occurrences
          score += 50 + Math.min(contentHits * 8, 120);
        }
      }

      if (score > 0) {
        results.push({
          file: this.stripContent(file),
          score,
          matchType,
          filenameMatches,
          snippets
        });
      }
    }

    // Rank results descending by score, tie-break by shorter path
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.file.relativePath.length - b.file.relativePath.length;
    });

    return results.slice(0, maxResults);
  }

  /**
   * Retrieves file content and metadata for preview.
   */
  public getFilePreview(relativePath: string): { file: FileMetadata; content: string; lines: string[] } | null {
    const normalized = relativePath.replace(/\\/g, '/');
    let file = this.indexedFiles.get(normalized);

    const fullPath = file ? file.path : path.resolve(this.workspaceRoot, relativePath);

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const stats = fs.statSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const isBinary = BINARY_EXTENSIONS.has(ext);

    let content = '';
    let lines: string[] = [];

    if (isBinary) {
      content = `[Binary file: ${formatBytes(stats.size)}]`;
      lines = [content];
    } else {
      try {
        const buf = fs.readFileSync(fullPath);
        if (isBinaryBuffer(buf)) {
          content = `[Binary file: ${formatBytes(stats.size)}]`;
          lines = [content];
        } else {
          content = buf.toString('utf8');
          lines = content.split(/\r?\n/);
        }
      } catch (err: any) {
        content = `[Error reading file: ${err.message}]`;
        lines = [content];
      }
    }

    if (file) {
      file.content = content;
      file.lineCount = lines.length;
    }

    const metadata: FileMetadata = file ? this.stripContent(file) : {
      path: fullPath,
      relativePath: normalized,
      name: path.basename(fullPath),
      extension: ext,
      size: stats.size,
      formattedSize: formatBytes(stats.size),
      modifiedMs: stats.mtimeMs,
      modifiedIso: stats.mtime.toISOString(),
      isBinary,
      lineCount: lines.length
    };

    return {
      file: metadata,
      content,
      lines
    };
  }

  /**
   * Lazily loads and caches text file content.
   */
  public getFileContent(file: IndexedFile): string | undefined {
    if (file.content !== undefined) return file.content;
    if (file.isBinary || file.size > this.options.maxFileSizeForContent) return undefined;

    try {
      const buffer = fs.readFileSync(file.path);
      if (!isBinaryBuffer(buffer)) {
        file.content = buffer.toString('utf8');
        file.lineCount = file.content.split(/\r?\n/).length;
        return file.content;
      } else {
        file.isBinary = true;
      }
    } catch {
      // Non-fatal
    }
    return undefined;
  }

  /**
   * Checks if .git directory exists in current directory or any ancestor.
   */
  private hasGitDirectory(startDir: string): boolean {
    let current = path.resolve(startDir);
    while (true) {
      if (fs.existsSync(path.join(current, '.git'))) {
        return true;
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return false;
  }

  /**
   * Inspects Git repository status (branch, dirty count, staged/unstaged).
   */
  public getGitStatus(targetDir?: string): GitStatus {
    const repoDir = targetDir || this.workspaceRoot;

    const defaultStatus: GitStatus = {
      isRepo: false,
      branch: '',
      dirtyCount: 0,
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
      stagedFiles: [],
      unstagedFiles: [],
      untrackedFiles: [],
      isClean: true
    };

    if (!repoDir || !fs.existsSync(repoDir)) {
      return defaultStatus;
    }

    if (!this.hasGitDirectory(repoDir)) {
      return defaultStatus;
    }

    try {
      // 1. Check if git repo
      const checkInside = child_process.execSync('git rev-parse --is-inside-work-tree', {
        cwd: repoDir,
        timeout: 3000,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      }).toString().trim();

      if (checkInside !== 'true') {
        return defaultStatus;
      }

      // 2. Query branch name
      let branch = '';
      try {
        branch = child_process.execSync('git branch --show-current', {
          cwd: repoDir,
          timeout: 3000,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true
        }).toString().trim();
      } catch {
        // Fallback for detached HEAD
      }

      if (!branch) {
        try {
          branch = child_process.execSync('git rev-parse --short HEAD', {
            cwd: repoDir,
            timeout: 3000,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true
          }).toString().trim();
          branch = branch ? `detached (${branch})` : 'HEAD';
        } catch {
          branch = 'HEAD';
        }
      }

      // 3. Query porcelain status
      const porcelainOut = child_process.execSync('git status --porcelain', {
        cwd: repoDir,
        timeout: 4000,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      }).toString();

      const lines = porcelainOut.split(/\r?\n/).filter((l) => l.trim().length > 0);

      const stagedFiles: string[] = [];
      const unstagedFiles: string[] = [];
      const untrackedFiles: string[] = [];

      for (const line of lines) {
        if (line.length < 3) continue;
        const x = line[0];
        const y = line[1];
        const file = line.slice(3).trim();

        if (x === '?' && y === '?') {
          untrackedFiles.push(file);
        } else {
          if (x !== ' ' && x !== '?') {
            stagedFiles.push(file);
          }
          if (y !== ' ' && y !== '?') {
            unstagedFiles.push(file);
          }
        }
      }

      const allDirty = new Set([...stagedFiles, ...unstagedFiles, ...untrackedFiles]);
      const dirtyCount = allDirty.size;

      return {
        isRepo: true,
        branch,
        dirtyCount,
        stagedCount: stagedFiles.length,
        unstagedCount: unstagedFiles.length,
        untrackedCount: untrackedFiles.length,
        stagedFiles,
        unstagedFiles,
        untrackedFiles,
        isClean: dirtyCount === 0
      };
    } catch {
      // Git command failed or directory is not a repo
      return defaultStatus;
    }
  }

  /**
   * Helper to strip cached file content for metadata-only lists.
   */
  private stripContent(file: IndexedFile): FileMetadata {
    const { content, ...meta } = file;
    return meta;
  }

  public getFileMetadataList(): FileMetadata[] {
    return Array.from(this.indexedFiles.values()).map((f) => this.stripContent(f));
  }

  public getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  public getIndexedCount(): number {
    return this.indexedFiles.size;
  }

  public isIndexCapped(): boolean {
    return this.isCapped;
  }

  public getLastIndexDurationMs(): number {
    return this.lastIndexDurationMs;
  }

  public clear(): void {
    this.workspaceRoot = '';
    this.indexedFiles.clear();
    this.isCapped = false;
  }
}

// Global singleton instance for electron main process
export const projectIndexer = new ProjectIndexer();

/**
 * Register Electron IPC channels for Project Mode
 */
export function registerProjectIndexerIPC(indexer: ProjectIndexer = projectIndexer): void {
  const ipcMain = electronModule?.ipcMain;
  const dialog = electronModule?.dialog;

  if (!ipcMain) return;

  // Open directory dialog
  ipcMain.handle('project:choose-folder', async () => {
    if (!dialog) return null;
    const res = await dialog.showOpenDialog({
      title: 'Select Project Workspace Directory',
      properties: ['openDirectory']
    });
    if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
      return null;
    }
    return res.filePaths[0];
  });

  // Index workspace
  ipcMain.handle('project:index-workspace', async (_event: any, dirPath?: string) => {
    const target = dirPath || indexer.getWorkspaceRoot();
    if (!target) throw new Error('No workspace directory specified');
    return indexer.indexWorkspace(target);
  });

  // Search workspace
  ipcMain.handle('project:search', async (_event: any, query: string, maxResults?: number) => {
    return indexer.search(query || '', maxResults || 50);
  });

  // Read file for preview
  ipcMain.handle('project:get-file-preview', async (_event: any, relativePath: string) => {
    return indexer.getFilePreview(relativePath);
  });

  // Query git status
  ipcMain.handle('project:get-git-status', async (_event: any, dirPath?: string) => {
    return indexer.getGitStatus(dirPath || indexer.getWorkspaceRoot());
  });

  // Get current workspace info
  ipcMain.handle('project:get-workspace-info', async () => {
    return {
      rootPath: indexer.getWorkspaceRoot(),
      fileCount: indexer.getIndexedCount(),
      capped: indexer.isIndexCapped(),
      durationMs: indexer.getLastIndexDurationMs(),
      gitStatus: indexer.getGitStatus()
    };
  });
}
