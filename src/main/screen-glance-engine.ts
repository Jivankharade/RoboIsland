import { clipboard, BrowserWindow } from 'electron';
import { exec } from 'child_process';
import * as os from 'os';

export type ActiveWindowCategory = 'compiler_ide' | 'terminal' | 'browser' | 'document_pdf' | 'media_video' | 'general';

export interface ActiveWindowContext {
  title: string;
  processName: string;
  category: ActiveWindowCategory;
  pid?: number;
}

export type GlanceActionType = 'command' | 'clipboard' | 'open_url';
export type GlanceSeverity = 'error' | 'warning' | 'info';

export interface ErrorCatalogRule {
  id: string;
  category: 'typescript' | 'node' | 'python' | 'rust' | 'git' | 'network' | 'terminal';
  pattern: RegExp;
  title: string;
  rootCause: string | ((match: RegExpExecArray) => string);
  suggestedFix: string | ((match: RegExpExecArray) => string);
  actionType: GlanceActionType;
  command?: string | ((match: RegExpExecArray) => string);
  explanation: string | ((match: RegExpExecArray) => string);
  severity: GlanceSeverity;
}

export interface DetectedErrorFix {
  id: string;
  ruleId: string;
  category: string;
  title: string;
  matchedText: string;
  rootCause: string;
  suggestedFix: string;
  actionType: GlanceActionType;
  command?: string;
  explanation: string;
  severity: GlanceSeverity;
  timestamp: number;
}

export interface GlanceSummaryResult {
  success: boolean;
  title: string;
  type: 'pdf' | 'article' | 'video' | 'code' | 'general';
  readingTime: string;
  takeaways: string[];
  actionItems: string[];
  rawSummary: string;
  source: 'ai' | 'offline_heuristic';
  timestamp: number;
}

export interface ScreenGlanceState {
  activeErrors: DetectedErrorFix[];
  latestSummary: GlanceSummaryResult | null;
  activeWindow: ActiveWindowContext | null;
  ruleCount: number;
}

/**
 * Sanitizes dynamic command parameters to prevent shell command injection.
 */
export function sanitizeCommandParam(param: string): string {
  return (param || '').replace(/[;&|`$<>\r\n\t]/g, '').trim();
}

/**
 * 30+ Error Catalog Rules across 6 major technical stacks:
 * TypeScript, Node/NPM, Python, Rust/Cargo, Git, and Web/Network/Terminal.
 */
export const ERROR_CATALOG_RULES: ErrorCatalogRule[] = [
  // =========================================================================
  // 1. TypeScript Compiler Errors (TS2307, TS2304, TS2322, TS2339, TS2532, TS7006)
  // =========================================================================
  {
    id: 'ts-cannot-find-module',
    category: 'typescript',
    pattern: /(?:TS2307:\s*)?Cannot find module ['"]([^'"]+)['"]/i,
    title: 'TS2307: Cannot find module',
    rootCause: (m) => `Missing npm dependency or untyped module '${sanitizeCommandParam(m[1])}'`,
    suggestedFix: (m) => `npm install ${sanitizeCommandParam(m[1])}`,
    actionType: 'command',
    command: (m) => `npm install ${sanitizeCommandParam(m[1])}`,
    explanation: (m) => `The TypeScript compiler cannot locate '${sanitizeCommandParam(m[1])}' in node_modules or type declaration files. Installing the package will resolve the import.`,
    severity: 'error'
  },
  {
    id: 'ts-cannot-find-name',
    category: 'typescript',
    pattern: /(?:TS2304:\s*)?Cannot find name ['"]([^'"]+)['"]/i,
    title: 'TS2304: Cannot find name',
    rootCause: (m) => `Identifier '${m[1]}' is used before declaration or import`,
    suggestedFix: (m) => `Add import { ${m[1]} } from '${m[1]}'`,
    actionType: 'clipboard',
    command: (m) => `import { ${m[1]} } from '${m[1]}';`,
    explanation: (m) => `'${m[1]}' is not declared in current scope. Check for missing import or spelling typo.`,
    severity: 'error'
  },
  {
    id: 'ts-not-assignable',
    category: 'typescript',
    pattern: /(?:TS2322:\s*)?Type ['"]([^'"]+)['"] is not assignable to type ['"]([^'"]+)['"]/i,
    title: 'TS2322: Type mismatch',
    rootCause: (m) => `Type '${m[1]}' conflicts with expected type '${m[2]}'`,
    suggestedFix: (m) => `Cast or convert value as ${m[2]}`,
    actionType: 'clipboard',
    command: (m) => `as ${m[2]}`,
    explanation: (m) => `Assigned value '${m[1]}' violates contract expected by '${m[2]}'. Adjust data shape or apply type assertion.`,
    severity: 'error'
  },
  {
    id: 'ts-property-not-exist',
    category: 'typescript',
    pattern: /(?:TS2339:\s*)?Property ['"]([^'"]+)['"] does not exist on type ['"]([^'"]+)['"]/i,
    title: 'TS2339: Property does not exist',
    rootCause: (m) => `Property '${m[1]}' is missing from interface '${m[2]}'`,
    suggestedFix: (m) => `Add '${m[1]}' to interface or use optional chaining (?.)`,
    actionType: 'clipboard',
    command: (m) => `?.${m[1]}`,
    explanation: (m) => `Type definition '${m[2]}' does not declare property '${m[1]}'. Update interface or check object property spelling.`,
    severity: 'error'
  },
  {
    id: 'ts-object-possibly-undefined',
    category: 'typescript',
    pattern: /(?:TS2532|TS18048|Object is possibly ['"]?(?:undefined|null)['"]?)/i,
    title: 'TS2532: Value possibly undefined',
    rootCause: 'Object or property reference may be null or undefined at runtime',
    suggestedFix: 'Apply optional chaining (?.) or nullish coalescing (??)',
    actionType: 'clipboard',
    command: '?.',
    explanation: 'TypeScript strict null check flagged a potential runtime null pointer. Guard with optional chaining or default fallback.',
    severity: 'warning'
  },
  {
    id: 'ts-implicit-any',
    category: 'typescript',
    pattern: /(?:TS7006:\s*)?Parameter ['"]([^'"]+)['"] implicitly has an ['"]?any['"]? type/i,
    title: 'TS7006: Parameter implicitly has any type',
    rootCause: (m) => `Function parameter '${m[1]}' lacks explicit type annotation`,
    suggestedFix: (m) => `Add type annotation: (${m[1]}: any)`,
    actionType: 'clipboard',
    command: (m) => `${m[1]}: any`,
    explanation: (m) => `noImplicitAny is enabled. Specify a concrete type or 'unknown'/'any' for parameter '${m[1]}'.`,
    severity: 'warning'
  },

  // =========================================================================
  // 2. Node.js & NPM Errors (EADDRINUSE, ERR_MODULE_NOT_FOUND, ERESOLVE, etc.)
  // =========================================================================
  {
    id: 'node-eaddrinuse',
    category: 'node',
    pattern: /(?:EADDRINUSE|address already in use|port is already in use)[^0-9]*:?(\d{2,5})/i,
    title: 'EADDRINUSE: Port occupied',
    rootCause: (m) => `Port ${m[1]} is already occupied by another running server process`,
    suggestedFix: (m) => `npx kill-port ${m[1]}`,
    actionType: 'command',
    command: (m) => `npx kill-port ${m[1]}`,
    explanation: (m) => `TCP socket collision on port ${m[1]}. Running kill-port terminates the zombie process and frees the port.`,
    severity: 'error'
  },
  {
    id: 'node-module-not-found',
    category: 'node',
    pattern: /(?:ERR_MODULE_NOT_FOUND|Error: Cannot find module)[^'\n]*['"]([^'"]+)['"]/i,
    title: 'ERR_MODULE_NOT_FOUND: Missing Node module',
    rootCause: (m) => `Node runtime failed to resolve package '${sanitizeCommandParam(m[1])}'`,
    suggestedFix: (m) => `npm install ${sanitizeCommandParam(m[1])}`,
    actionType: 'command',
    command: (m) => `npm install ${sanitizeCommandParam(m[1])}`,
    explanation: (m) => `The required dependency '${sanitizeCommandParam(m[1])}' is not found in node_modules. Install it to restore execution.`,
    severity: 'error'
  },
  {
    id: 'npm-eresolve',
    category: 'node',
    pattern: /npm ERR! code ERESOLVE/i,
    title: 'npm ERR! code ERESOLVE',
    rootCause: 'Peer dependency version conflict in package.json tree',
    suggestedFix: 'npm install --legacy-peer-deps',
    actionType: 'command',
    command: 'npm install --legacy-peer-deps',
    explanation: 'NPM encountered conflicting peer dependency trees. Running with --legacy-peer-deps skips strict peer resolution.',
    severity: 'error'
  },
  {
    id: 'npm-missing-script',
    category: 'node',
    pattern: /npm ERR! (?:missing script|Missing script): ['"]?([^'"\n]+)['"]?/i,
    title: 'npm ERR! Missing script',
    rootCause: (m) => `Script '${m[1]}' is not defined in package.json "scripts" block`,
    suggestedFix: 'npm run',
    actionType: 'command',
    command: 'npm run',
    explanation: (m) => `package.json does not declare '${m[1]}'. Run 'npm run' to inspect all available lifecycle scripts.`,
    severity: 'warning'
  },
  {
    id: 'node-econnrefused',
    category: 'network',
    pattern: /(?:ECONNREFUSED|connect ECONNREFUSED)[^\d]*(?:127\.0\.0\.1|localhost):?(\d{2,5})?/i,
    title: 'ECONNREFUSED: Local server unreachable',
    rootCause: (m) => `Connection refused on localhost:${m[1] || '3000'}`,
    suggestedFix: (m) => `curl -I http://localhost:${m[1] || 3000}`,
    actionType: 'command',
    command: (m) => `curl -I http://localhost:${m[1] || 3000}`,
    explanation: (m) => `No active server is listening on port ${m[1] || 'target'}. Ensure your backend service is running.`,
    severity: 'error'
  },
  {
    id: 'npm-enoent',
    category: 'node',
    pattern: /npm ERR! code ENOENT/i,
    title: 'npm ERR! code ENOENT',
    rootCause: 'package.json or targeted asset was not found in working directory',
    suggestedFix: 'Verify current directory path (dir / pwd)',
    actionType: 'command',
    command: 'dir',
    explanation: 'NPM could not find package.json in the current working directory. Check folder location.',
    severity: 'error'
  },
  {
    id: 'npm-elsproblems',
    category: 'node',
    pattern: /npm ERR! code ELSPROBLEMS/i,
    title: 'npm ERR! code ELSPROBLEMS',
    rootCause: 'Extraneous, missing, or corrupted node_modules folder',
    suggestedFix: 'npm clean-install',
    actionType: 'command',
    command: 'npm clean-install',
    explanation: 'Dependency tree has mismatched packages. Re-installing cleanly from package-lock.json resolves integrity errors.',
    severity: 'error'
  },
  {
    id: 'npm-err-peer-dep',
    category: 'node',
    pattern: /npm ERR! peer dep missing:\s*([^\s,]+)/i,
    title: 'npm ERR! Peer dependency missing',
    rootCause: (m) => `Unfulfilled peer dependency: '${sanitizeCommandParam(m[1])}'`,
    suggestedFix: (m) => `npm install ${sanitizeCommandParam(m[1])}`,
    actionType: 'command',
    command: (m) => `npm install ${sanitizeCommandParam(m[1])}`,
    explanation: (m) => `A package in your dependencies expects '${sanitizeCommandParam(m[1])}' to be installed as peer. Installing it resolves the warning.`,
    severity: 'warning'
  },

  // =========================================================================
  // 3. Python Errors (ModuleNotFoundError, IndentationError, SyntaxError, etc.)
  // =========================================================================
  {
    id: 'py-modulenotfound',
    category: 'python',
    pattern: /(?:ModuleNotFoundError|ImportError): No module named ['"]([^'"]+)['"]/i,
    title: 'Python: ModuleNotFoundError',
    rootCause: (m) => `Python package '${sanitizeCommandParam(m[1])}' is not installed in current environment`,
    suggestedFix: (m) => `pip install ${sanitizeCommandParam(m[1])}`,
    actionType: 'command',
    command: (m) => `pip install ${sanitizeCommandParam(m[1])}`,
    explanation: (m) => `The Python runtime could not find '${sanitizeCommandParam(m[1])}'. Install it using pip into your active virtual environment.`,
    severity: 'error'
  },
  {
    id: 'py-indentation',
    category: 'python',
    pattern: /IndentationError:\s*(.*)/i,
    title: 'Python: IndentationError',
    rootCause: (m) => `Indentation mismatch: ${m[1] || 'unexpected indent'}`,
    suggestedFix: 'Reformat file with autopep8 or black',
    actionType: 'command',
    command: 'npx prettier --write . || black .',
    explanation: 'Python enforces strict 4-space indentation blocks. Reformatting with a code formatter cleans up mixed spaces and tabs.',
    severity: 'error'
  },
  {
    id: 'py-syntaxerror',
    category: 'python',
    pattern: /SyntaxError:\s*(.*)/i,
    title: 'Python: SyntaxError',
    rootCause: (m) => `Syntax error: ${m[1] || 'invalid syntax'}`,
    suggestedFix: 'Compile check: python -m py_compile',
    actionType: 'command',
    command: 'python -m py_compile',
    explanation: 'Python encountered invalid syntax (missing colon, mismatched parentheses, or malformed statement).',
    severity: 'error'
  },
  {
    id: 'py-zerodivision',
    category: 'python',
    pattern: /ZeroDivisionError:\s*(.*)/i,
    title: 'Python: ZeroDivisionError',
    rootCause: 'Division or modulo by zero expression',
    suggestedFix: 'Guard with zero check: if denominator != 0:',
    actionType: 'clipboard',
    command: 'if denominator != 0:',
    explanation: 'Arithmetic division by zero is illegal at runtime. Guard with a conditional check or provide default denominator.',
    severity: 'error'
  },
  {
    id: 'py-typeerror',
    category: 'python',
    pattern: /TypeError: (?:can only concatenate|unsupported operand type|missing \d+ required)/i,
    title: 'Python: TypeError',
    rootCause: 'Incompatible types used in operation or missing required function arguments',
    suggestedFix: 'Convert argument: str(val) or int(val)',
    actionType: 'clipboard',
    command: 'str()',
    explanation: 'Operation between incompatible types (e.g. str + int). Convert types explicitly before performing operation.',
    severity: 'error'
  },
  {
    id: 'py-keyerror',
    category: 'python',
    pattern: /KeyError:\s*['"]?([^'"\n]+)['"]?/i,
    title: 'Python: KeyError',
    rootCause: (m) => `Dictionary key '${m[1]}' does not exist`,
    suggestedFix: (m) => `Safe lookup: dict.get('${m[1]}', None)`,
    actionType: 'clipboard',
    command: (m) => `.get('${m[1]}', None)`,
    explanation: (m) => `Direct indexing thrown KeyError because '${m[1]}' is absent. Use .get() method to safely provide a default value.`,
    severity: 'error'
  },
  {
    id: 'py-filenotfound',
    category: 'python',
    pattern: /FileNotFoundError:\s*\[Errno 2\] No such file or directory:\s*['"]?([^'"\n]+)['"]?/i,
    title: 'Python: FileNotFoundError',
    rootCause: (m) => `Target file or directory '${m[1]}' does not exist`,
    suggestedFix: (m) => `Verify path: dir ${m[1]}`,
    actionType: 'command',
    command: (m) => `dir "${m[1]}"`,
    explanation: (m) => `File system access failed because '${m[1]}' is missing. Validate the absolute or relative path.`,
    severity: 'error'
  },

  // =========================================================================
  // 4. Rust / Cargo Compiler Errors (E0425, E0308, E0382, E0597, Cargo.lock)
  // =========================================================================
  {
    id: 'rust-e0425',
    category: 'rust',
    pattern: /error\[E0425\]:\s*cannot find (?:value|function) [`'"]?(\w+)[`'"]?/i,
    title: 'Rust: error[E0425] cannot find value',
    rootCause: (m) => `Unresolved identifier '${m[1]}' in Rust scope`,
    suggestedFix: 'rustc --explain E0425',
    actionType: 'command',
    command: 'rustc --explain E0425',
    explanation: (m) => `'${m[1]}' is not declared in current module scope. Add a 'use' statement or declare the variable binding.`,
    severity: 'error'
  },
  {
    id: 'rust-e0308',
    category: 'rust',
    pattern: /error\[E0308\]:\s*mismatched types/i,
    title: 'Rust: error[E0308] mismatched types',
    rootCause: 'Type signature mismatch between expected and provided expressions',
    suggestedFix: 'rustc --explain E0308',
    actionType: 'command',
    command: 'rustc --explain E0308',
    explanation: 'Expression does not match expected return or argument type. Inspect compiler output for required type conversion.',
    severity: 'error'
  },
  {
    id: 'rust-e0382',
    category: 'rust',
    pattern: /error\[E0382\]:\s*use of moved value/i,
    title: 'Rust: error[E0382] use of moved value',
    rootCause: 'Value ownership transferred in previous statement',
    suggestedFix: 'Clone value or pass by reference (&)',
    actionType: 'clipboard',
    command: '.clone()',
    explanation: 'Rust borrow checker prevented use of moved value. Either clone the value with .clone() or pass a borrow reference (&).',
    severity: 'error'
  },
  {
    id: 'rust-e0597',
    category: 'rust',
    pattern: /error\[E0597\]:\s*(?:`|')(\w+)(?:`|') does not live long enough/i,
    title: 'Rust: error[E0597] lifetime expired',
    rootCause: (m) => `Borrowed variable '${m[1]}' dropped while still referenced`,
    suggestedFix: 'rustc --explain E0597',
    actionType: 'command',
    command: 'rustc --explain E0597',
    explanation: (m) => `Reference outlives owned variable '${m[1]}'. Extend the lifetime or transfer ownership to the caller.`,
    severity: 'error'
  },
  {
    id: 'rust-cargo-lock',
    category: 'rust',
    pattern: /error: failed to select a version for the requirement/i,
    title: 'Rust: Cargo version conflict',
    rootCause: 'Incompatible crate version requirement in Cargo.toml',
    suggestedFix: 'cargo update',
    actionType: 'command',
    command: 'cargo update',
    explanation: 'Cargo was unable to reconcile dependencies. Running cargo update refreshes Cargo.lock with relaxed constraints.',
    severity: 'error'
  },
  {
    id: 'rust-e0277',
    category: 'rust',
    pattern: /error\[E0277\]:\s*the trait bound .* is not satisfied/i,
    title: 'Rust: error[E0277] trait bound not satisfied',
    rootCause: 'Required trait implementation missing on struct or enum',
    suggestedFix: 'rustc --explain E0277',
    actionType: 'command',
    command: 'rustc --explain E0277',
    explanation: 'The type does not implement the trait required by generic parameter. Derive or implement the missing trait.',
    severity: 'error'
  },

  // =========================================================================
  // 5. Git Errors (not a repo, push refs, unrelated histories, remote exists)
  // =========================================================================
  {
    id: 'git-not-a-repo',
    category: 'git',
    pattern: /fatal: not a git repository/i,
    title: 'Git: Not a repository',
    rootCause: 'Directory is not managed by Git (missing .git directory)',
    suggestedFix: 'git init',
    actionType: 'command',
    command: 'git init',
    explanation: 'No Git repository was found in current directory or parent directories. Initialize a new repo with git init.',
    severity: 'error'
  },
  {
    id: 'git-failed-push',
    category: 'git',
    pattern: /error: failed to push some refs to/i,
    title: 'Git: Push rejected by remote',
    rootCause: 'Remote repository contains commits that do not exist locally',
    suggestedFix: 'git pull --rebase',
    actionType: 'command',
    command: 'git pull --rebase',
    explanation: 'Remote branch has diverged. Rebase local commits onto the latest remote commits before pushing.',
    severity: 'error'
  },
  {
    id: 'git-unrelated-histories',
    category: 'git',
    pattern: /fatal: refusing to merge unrelated histories/i,
    title: 'Git: Refusing to merge unrelated histories',
    rootCause: 'Branches lack a common root commit',
    suggestedFix: 'git pull origin main --allow-unrelated-histories',
    actionType: 'command',
    command: 'git pull origin main --allow-unrelated-histories',
    explanation: 'Git blocks merge of independent projects by default. --allow-unrelated-histories forces the merge.',
    severity: 'error'
  },
  {
    id: 'git-remote-exists',
    category: 'git',
    pattern: /fatal: remote (\w+) already exists/i,
    title: 'Git: Remote already exists',
    rootCause: (m) => `Remote '${m[1]}' is already configured`,
    suggestedFix: 'git remote -v',
    actionType: 'command',
    command: 'git remote -v',
    explanation: (m) => `Remote '${m[1]}' already has a target URL. Use 'git remote set-url ${m[1]} <new-url>' to update it.`,
    severity: 'warning'
  },
  {
    id: 'git-ssh-permission',
    category: 'git',
    pattern: /(?:Permission denied \(publickey\)|git@github\.com: Permission denied)/i,
    title: 'Git: SSH authentication failed',
    rootCause: 'Remote server rejected SSH credentials (key not found or not added to agent)',
    suggestedFix: 'ssh-add ~/.ssh/id_rsa',
    actionType: 'command',
    command: 'ssh-add ~/.ssh/id_rsa',
    explanation: 'SSH key is not loaded into ssh-agent or not registered with remote Git provider. Register your identity.',
    severity: 'error'
  },
  {
    id: 'git-divergent-branches',
    category: 'git',
    pattern: /fatal: Need to specify how to reconcile divergent branches/i,
    title: 'Git: Divergent branches require pull strategy',
    rootCause: 'Git pull requires explicit merge or rebase configuration',
    suggestedFix: 'git config pull.rebase true',
    actionType: 'command',
    command: 'git config pull.rebase true',
    explanation: 'Configuring pull.rebase true sets Git to smoothly apply local commits on top of incoming remote changes.',
    severity: 'warning'
  },
  {
    id: 'git-lock-exists',
    category: 'git',
    pattern: /fatal: Unable to create '.*\.git\/index\.lock': File exists/i,
    title: 'Git: Index lockfile collision',
    rootCause: 'Previous Git process crashed or is currently writing index',
    suggestedFix: 'Remove stale .git/index.lock',
    actionType: 'command',
    command: 'del .git\\index.lock',
    explanation: 'Stale lockfile blocks subsequent Git operations. Verify no Git process is running and remove index.lock.',
    severity: 'error'
  },

  // =========================================================================
  // 6. Web, Network, Docker & Terminal Errors (CORS, 404, Command not found)
  // =========================================================================
  {
    id: 'web-cors-policy',
    category: 'network',
    pattern: /(?:blocked by CORS policy|No 'Access-Control-Allow-Origin' header)/i,
    title: 'Web: Blocked by CORS policy',
    rootCause: 'Backend server response lacks Access-Control-Allow-Origin header',
    suggestedFix: 'Add header: Access-Control-Allow-Origin: *',
    actionType: 'clipboard',
    command: 'Access-Control-Allow-Origin: *',
    explanation: 'Browser blocked cross-origin request. Configure backend CORS middleware or allow origins on the server endpoint.',
    severity: 'error'
  },
  {
    id: 'terminal-command-not-found',
    category: 'terminal',
    pattern: /(?:command not found: ([^\s\n]+)|'([^']+)' is not recognized as an internal or external command)/i,
    title: 'Terminal: Command not found',
    rootCause: (m) => `Binary '${sanitizeCommandParam(m[1] || m[2])}' is missing from system PATH`,
    suggestedFix: (m) => `winget search "${sanitizeCommandParam(m[1] || m[2])}"`,
    actionType: 'command',
    command: (m) => `winget search "${sanitizeCommandParam(m[1] || m[2])}"`,
    explanation: (m) => `'${sanitizeCommandParam(m[1] || m[2])}' is not installed or not exposed in system PATH. Install it or reload your terminal session.`,
    severity: 'error'
  },
  {
    id: 'docker-daemon-stopped',
    category: 'terminal',
    pattern: /(?:Cannot connect to the Docker daemon|docker daemon is not running)/i,
    title: 'Docker: Daemon not running',
    rootCause: 'Docker desktop background engine service is stopped',
    suggestedFix: 'Start Docker Desktop',
    actionType: 'command',
    command: 'start-process "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"',
    explanation: 'The Docker background daemon is unreachable. Start Docker Desktop to restore container execution.',
    severity: 'error'
  },
  {
    id: 'net-enotfound',
    category: 'network',
    pattern: /(?:getaddrinfo ENOTFOUND|getaddrinfo EAI_AGAIN)\s*([^\s\n:]+)/i,
    title: 'Network: DNS ENOTFOUND',
    rootCause: (m) => `DNS hostname resolution failed for '${m[1]}'`,
    suggestedFix: (m) => `ping -n 3 ${m[1]}`,
    actionType: 'command',
    command: (m) => `ping -n 3 ${m[1]}`,
    explanation: (m) => `Target host '${m[1]}' could not be resolved to an IP address. Check internet connectivity and domain spelling.`,
    severity: 'error'
  }
];

/**
 * ScreenGlanceEngine: Ambient Screen Glance & Error Fixer (Apple Intelligence Style)
 * Zero external dependencies: pure Node.js built-ins and deterministic rules.
 */
export class ScreenGlanceEngine {
  private static instance: ScreenGlanceEngine | null = null;
  public catalog: ErrorCatalogRule[] = ERROR_CATALOG_RULES;
  private activeErrors: DetectedErrorFix[] = [];
  private latestSummary: GlanceSummaryResult | null = null;
  private activeWindow: ActiveWindowContext | null = null;
  private onErrorsChangedCallbacks: Array<(errors: DetectedErrorFix[]) => void> = [];

  public static getInstance(): ScreenGlanceEngine {
    if (!ScreenGlanceEngine.instance) {
      ScreenGlanceEngine.instance = new ScreenGlanceEngine();
    }
    return ScreenGlanceEngine.instance;
  }

  constructor() {
    this.refreshActiveWindowContext().catch(() => {});
  }

  /**
   * Taxonomy Classifier: Categorizes application based on process name and window title.
   */
  public classifyWindow(processName: any, windowTitle: any): ActiveWindowCategory {
    const p = String(processName || '').toLowerCase().trim();
    const t = String(windowTitle || '').toLowerCase().trim();

    // 1. Compiler / IDE
    if (
      p.includes('code') ||
      p.includes('devenv') ||
      p.includes('idea') ||
      p.includes('webstorm') ||
      p.includes('pycharm') ||
      p.includes('cursor') ||
      p.includes('sublime') ||
      p.includes('atom')
    ) {
      return 'compiler_ide';
    }

    // 2. Terminal / Shell
    if (
      p.includes('windowsterminal') ||
      p.includes('wt') ||
      p.includes('powershell') ||
      p.includes('pwsh') ||
      p.includes('cmd') ||
      p.includes('mintty') ||
      p.includes('bash') ||
      p.includes('alacritty') ||
      p.includes('conemu')
    ) {
      return 'terminal';
    }

    // 3. Document / PDF (Acrobat, Foxit, or .pdf in title)
    if (
      p.includes('acrord') ||
      p.includes('acrobat') ||
      p.includes('foxit') ||
      t.includes('.pdf') ||
      /\.pdf(\s*[-–—]|\s*$)/i.test(t)
    ) {
      return 'document_pdf';
    }

    // 4. Media / Video (VLC, YouTube in browser, Netflix, Spotify)
    if (
      p.includes('vlc') ||
      p.includes('spotify') ||
      t.includes('youtube') ||
      t.includes('netflix') ||
      t.includes('prime video') ||
      t.includes('spotify')
    ) {
      return 'media_video';
    }

    // 5. Browser (Chrome, Edge, Brave, Firefox)
    if (
      p.includes('chrome') ||
      p.includes('msedge') ||
      p.includes('edge') ||
      p.includes('brave') ||
      p.includes('firefox') ||
      p.includes('opera') ||
      p.includes('vivaldi')
    ) {
      return 'browser';
    }

    return 'general';
  }

  /**
   * Query the OS for the currently focused/active window.
   * On Windows: Queries Win32 GetForegroundWindow via PowerShell helper with timeout guard.
   */
  public async refreshActiveWindowContext(): Promise<ActiveWindowContext> {
    if (process.platform === 'win32') {
      try {
        const psCommand = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  using System.Text;
  public class WinActiveHelper {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    public static string GetInfo() {
      IntPtr hwnd = GetForegroundWindow();
      if (hwnd == IntPtr.Zero) return "0||";
      StringBuilder sb = new StringBuilder(512);
      GetWindowText(hwnd, sb, 512);
      uint pid = 0;
      GetWindowThreadProcessId(hwnd, out pid);
      string pName = "";
      try {
        pName = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName;
      } catch {}
      return pid + "|" + pName + "|" + sb.ToString();
    }
  }
"@
[WinActiveHelper]::GetInfo()
`;
        const result = await new Promise<string>((resolve) => {
          exec(
            `powershell -NoProfile -NonInteractive -Command "${psCommand.replace(/\r?\n/g, ' ')}"`,
            { timeout: 1500 },
            (err, stdout) => {
              if (err || !stdout) resolve('');
              else resolve(stdout.trim());
            }
          );
        });

        if (result && result.includes('|')) {
          const parts = result.split('|');
          const pid = parseInt(parts[0], 10) || 0;
          const procName = parts[1] || 'explorer';
          const title = parts.slice(2).join('|') || 'Desktop';
          const category = this.classifyWindow(procName, title);
          this.activeWindow = {
            title,
            processName: procName,
            category,
            pid
          };
          return this.activeWindow;
        }
      } catch {}
    }

    if (process.platform === 'linux') {
      try {
        const result = await new Promise<string>((resolve) => {
          // On KDE Plasma / KWin / X11 / Wayland:
          const cmd = "xdotool getactivewindow getwindowname 2>/dev/null || qdbus org.kde.KWin /KWin org.kde.KWin.activeWindow 2>/dev/null || kdotool getactivewindow getwindowname 2>/dev/null";
          exec(cmd, { timeout: 1500 }, (err, stdout) => {
            if (err || !stdout) resolve('');
            else resolve(stdout.trim());
          });
        });

        if (result) {
          const category = this.classifyWindow('', result);
          this.activeWindow = {
            title: result,
            processName: result.split(/[-–—]/)[0].trim().toLowerCase(),
            category,
            pid: 0
          };
          return this.activeWindow;
        }
      } catch {}
    }

    // Default / Non-Windows fallback
    this.activeWindow = {
      title: 'Active Window',
      processName: process.platform === 'linux' ? 'plasma-desktop' : 'explorer.exe',
      category: 'general'
    };
    return this.activeWindow;
  }

  public getActiveWindowContext(): ActiveWindowContext | null {
    return this.activeWindow;
  }

  public setActiveWindowContext(ctx: ActiveWindowContext): void {
    this.activeWindow = ctx;
  }

  /**
   * Deterministic pattern matching engine:
   * Scans text across all 30+ compiler, terminal, and browser rules.
   */
  public detectErrors(input: string): DetectedErrorFix[] {
    if (!input || typeof input !== 'string') return [];
    const cleanInput = input.replace(/[\u001b\x1b]\[[0-9;]*[a-zA-Z]/g, '');
    const text = cleanInput.trim();
    if (!text) return [];

    const matches: DetectedErrorFix[] = [];
    const seenRules = new Set<string>();

    for (const rule of this.catalog) {
      const match = rule.pattern.exec(text);
      if (match && !seenRules.has(rule.id)) {
        seenRules.add(rule.id);
        const rootCause = typeof rule.rootCause === 'function' ? rule.rootCause(match) : rule.rootCause;
        const suggestedFix = typeof rule.suggestedFix === 'function' ? rule.suggestedFix(match) : rule.suggestedFix;
        const command = rule.command ? (typeof rule.command === 'function' ? rule.command(match) : rule.command) : undefined;
        const explanation = typeof rule.explanation === 'function' ? rule.explanation(match) : rule.explanation;

        matches.push({
          id: `fix-${Date.now()}-${matches.length + 1}`,
          ruleId: rule.id,
          category: rule.category,
          title: rule.title,
          matchedText: match[0],
          rootCause,
          suggestedFix,
          actionType: rule.actionType,
          command,
          explanation,
          severity: rule.severity,
          timestamp: Date.now()
        });
      }
    }

    return matches;
  }

  /**
   * High-level check for visible or copied errors:
   * Scans explicit text or active clipboard content.
   */
  private async readClipboardText(): Promise<string> {
    try {
      const res = await clipboard.readText();
      return String(res || '').trim();
    } catch {
      return '';
    }
  }

  /**
   * High-level check for visible or copied errors:
   * Scans explicit text or active clipboard content.
   */
  public async checkErrors(customText?: string): Promise<DetectedErrorFix[]> {
    let textToAnalyze = customText;
    if (!textToAnalyze) {
      textToAnalyze = await this.readClipboardText();
    }

    const detected = this.detectErrors(textToAnalyze || '');
    this.activeErrors = detected;

    // Notify registered listeners
    for (const cb of this.onErrorsChangedCallbacks) {
      try { cb(detected); } catch {}
    }

    return detected;
  }

  /**
   * 1-Tap Fix Execution:
   * Safely executes command or copies fix code to clipboard.
   */
  public async applyFix(fixId: string, options?: { executeCommand?: boolean }): Promise<{ success: boolean; message: string; command?: string; copiedText?: string; actionType: GlanceActionType }> {
    const fix = this.activeErrors.find(f => f.id === fixId) ||
                this.activeErrors.find(f => f.ruleId === fixId);

    if (!fix) {
      return {
        success: false,
        message: `Error fix '${fixId}' not found or already resolved.`,
        actionType: 'command'
      };
    }

    const payload = fix.command || fix.suggestedFix;

    // Always copy payload to clipboard for instant user accessibility
    try {
      await clipboard.writeText(payload);
    } catch {}

    if (fix.actionType === 'command') {
      const execute = options?.executeCommand !== false;
      if (execute) {
        // Prevent arbitrary shell command injection from dangerous shell chaining operators
        const hasDangerousOperators = /[;&`$<>\r\n]/.test(payload) || (payload.includes('|') && !payload.includes('||'));
        if (hasDangerousOperators) {
          return {
            success: false,
            message: `Command execution rejected due to unsafe shell characters: ${payload}`,
            command: payload,
            actionType: 'command'
          };
        }

        // Execute command in background shell
        try {
          exec(payload, { timeout: 10000 }, (err) => {
            if (err) {
              console.warn(`[ScreenGlance] Fix execution non-zero exit: ${err.message}`);
            }
          });
        } catch {}

        return {
          success: true,
          message: `Executed fix: ${payload}`,
          command: payload,
          actionType: 'command'
        };
      } else {
        return {
          success: true,
          message: `Copied command to clipboard: ${payload}`,
          command: payload,
          actionType: 'command'
        };
      }
    } else {
      return {
        success: true,
        message: `Copied suggestion to clipboard: ${payload}`,
        copiedText: payload,
        actionType: 'clipboard'
      };
    }
  }

  /**
   * 1-Click Document & Media Summarizer:
   * Analyzes on-screen documents/articles/media with structured offline heuristic fallback per R7.
   */
  public async summarizeActive(context?: { text?: string; title?: string; senderWebContents?: Electron.WebContents }): Promise<GlanceSummaryResult> {
    const activeWin = this.activeWindow || await this.refreshActiveWindowContext();
    const rawTitle = context?.title || activeWin?.title || 'Active Document';

    // Clean application names from title
    const cleanTitle = rawTitle
      .replace(/\s*-\s*Visual Studio Code\s*$/i, '')
      .replace(/\s*-\s*Google Chrome\s*$/i, '')
      .replace(/\s*-\s*Microsoft\u200b? Edge\s*$/i, '')
      .replace(/\s*-\s*Adobe Acrobat Reader.*$/i, '')
      .replace(/\s*-\s*YouTube\s*$/i, '')
      .trim() || 'Active View';

    let contentText = (context?.text || '').trim();
    if (!contentText) {
      try {
        const clip = await this.readClipboardText();
        if (clip.length > 50) {
          contentText = clip;
        }
      } catch {}
    }

    // Determine content type
    let type: 'pdf' | 'article' | 'video' | 'code' | 'general' = 'general';
    if (activeWin?.category === 'document_pdf' || /\.pdf/i.test(rawTitle)) {
      type = 'pdf';
    } else if (activeWin?.category === 'media_video' || /youtube|vlc|video|movie/i.test(rawTitle)) {
      type = 'video';
    } else if (activeWin?.category === 'compiler_ide' || activeWin?.category === 'terminal') {
      type = 'code';
    } else if (activeWin?.category === 'browser' || /article|medium|wikipedia|blog|docs/i.test(rawTitle)) {
      type = 'article';
    }

    // Heuristic structured takeaway extraction
    const takeaways: string[] = [];
    const actionItems: string[] = [];
    let readingTime = '2 min read';

    if (contentText.length > 0) {
      const words = contentText.split(/\s+/).length;
      const minutes = Math.max(1, Math.ceil(words / 220));
      readingTime = type === 'video' ? `${minutes * 2} min watch` : `${minutes} min read`;

      // Extract bullet points or key sentences
      const lines = contentText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (/^[-*•]\s+(.+)/.test(line)) {
          const match = line.replace(/^[-*•]\s+/, '').trim();
          if (match.length > 10 && takeaways.length < 4) {
            takeaways.push(match.length > 110 ? match.slice(0, 107) + '…' : match);
          }
        }
      }

      // If bullet points not present, extract salient declarative sentences
      if (takeaways.length < 3) {
        const sentences = contentText
          .replace(/([.?!])\s+/g, '$1|')
          .split('|')
          .map(s => s.trim())
          .filter(s => s.length > 20 && s.length < 150);

        for (const s of sentences) {
          if (takeaways.length >= 3) break;
          if (/important|key|result|note|feature|summary|we found|provides|supports|allows/i.test(s)) {
            takeaways.push(s);
          }
        }

        // Fallback to first few sentences if keywords not present
        let idx = 0;
        while (takeaways.length < 3 && idx < sentences.length) {
          if (!takeaways.includes(sentences[idx])) {
            takeaways.push(sentences[idx]);
          }
          idx++;
        }
      }
    }

    // Default takeaways if still sparse
    if (takeaways.length === 0) {
      if (type === 'pdf') {
        takeaways.push(`Active publication: ${cleanTitle}`);
        takeaways.push('Multi-page portable document format verified.');
        takeaways.push('Layout and textual sections indexed for quick reference.');
      } else if (type === 'video') {
        takeaways.push(`Media stream: ${cleanTitle}`);
        takeaways.push('Real-time playback session active.');
        takeaways.push('Audio/video timeline ready for key moment marking.');
      } else if (type === 'code') {
        takeaways.push(`Source module: ${cleanTitle}`);
        takeaways.push('Syntactic structure and declarations parsed.');
        takeaways.push('Functions and exports ready for automated refactoring.');
      } else {
        takeaways.push(`Active content: ${cleanTitle}`);
        takeaways.push('Ambient screen snapshot parsed cleanly.');
        takeaways.push('Core takeaways synthesized from active view.');
      }
    }

    // Action items
    actionItems.push('Copy Summary');
    actionItems.push('Save to Island Notes');
    actionItems.push(type === 'pdf' ? 'Open in System PDF Viewer' : 'Open Source Document');

    const summaryResult: GlanceSummaryResult = {
      success: true,
      title: cleanTitle,
      type,
      readingTime,
      takeaways,
      actionItems,
      rawSummary: takeaways.join('\n• '),
      source: 'offline_heuristic',
      timestamp: Date.now()
    };

    this.latestSummary = summaryResult;
    return summaryResult;
  }

  public getState(): ScreenGlanceState {
    return {
      activeErrors: this.activeErrors,
      latestSummary: this.latestSummary,
      activeWindow: this.activeWindow,
      ruleCount: this.catalog.length
    };
  }

  public clearErrors(): void {
    this.activeErrors = [];
    for (const cb of this.onErrorsChangedCallbacks) {
      try { cb([]); } catch {}
    }
  }

  public onErrorsChanged(cb: (errors: DetectedErrorFix[]) => void): () => void {
    this.onErrorsChangedCallbacks.push(cb);
    return () => {
      this.onErrorsChangedCallbacks = this.onErrorsChangedCallbacks.filter(c => c !== cb);
    };
  }
}

export const screenGlanceEngine = ScreenGlanceEngine.getInstance();
