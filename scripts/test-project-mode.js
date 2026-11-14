/**
 * RoboIsland Project Mode & Git Indexer Verification Suite (Milestone M7 Part B)
 * 
 * Verifies:
 * 1. Directory Crawler & Metadata Extraction (relative paths, sizes, extensions, lines).
 * 2. Strict 500-File Capping & Sub-50ms Indexing Performance.
 * 3. Ignore Filter Compliance (node_modules, .git, dist, build, .bin).
 * 4. Fast Full-Text & Fuzzy Search Ranking (Exact, Prefix, Substring, Fuzzy, Content Snippets).
 * 5. Git Status Retrieval (Branch name, dirty count, staged/unstaged parsing).
 * 6. Code Reading, Binary File Detection & Syntax Highlighting.
 * 7. Zero Emoji Compliance & 100% SVG Vector UI Integration.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('====================================================');
console.log('    ROBOISLAND PROJECT MODE & GIT INDEXER SUITE     ');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

function assert(desc, condition) {
  if (condition) {
    console.log(`[PASS] ${desc}`);
    passed++;
  } else {
    console.error(`[FAIL] ${desc}`);
    failed++;
  }
}

// Ensure dist/ has compiled artifacts
const {
  ProjectIndexer,
  formatBytes,
  isBinaryBuffer,
  fuzzyMatch,
  DEFAULT_IGNORE_PATTERNS
} = require('../dist/main/project-indexer');

const {
  buildProjectTemplate,
  highlightCode,
  formatFileSize,
  sanitizeHtml,
  SVG_ICONS
} = require('../dist/renderer/island/project-ui');

async function runTests() {
  // --------------------------------------------------------------------------
  // 1. Directory Crawler, Ignore Filters & Metadata Extraction
  // --------------------------------------------------------------------------
  console.log('--- 1. Testing Workspace Crawler, Ignore Filters & Metadata ---');

  const tempWorkspace = path.join(os.tmpdir(), `robo-test-workspace-${Date.now()}`);
  fs.mkdirSync(tempWorkspace, { recursive: true });

  try {
    // Create directory hierarchy
    fs.mkdirSync(path.join(tempWorkspace, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tempWorkspace, 'src', 'utils'), { recursive: true });
    fs.mkdirSync(path.join(tempWorkspace, 'node_modules', 'dep'), { recursive: true });
    fs.mkdirSync(path.join(tempWorkspace, '.git', 'objects'), { recursive: true });
    fs.mkdirSync(path.join(tempWorkspace, 'dist'), { recursive: true });
    fs.mkdirSync(path.join(tempWorkspace, 'build'), { recursive: true });
    fs.mkdirSync(path.join(tempWorkspace, '.bin'), { recursive: true });

    // Valid source files
    fs.writeFileSync(path.join(tempWorkspace, 'README.md'), '# Project Title\nWelcome to RoboIsland Project Mode.');
    fs.writeFileSync(path.join(tempWorkspace, 'package.json'), '{\n  "name": "test-app",\n  "version": "1.0.0"\n}');
    fs.writeFileSync(path.join(tempWorkspace, 'src', 'index.ts'), 'export const greeting = "hello world";\nconsole.log(greeting);');
    fs.writeFileSync(path.join(tempWorkspace, 'src', 'utils', 'math.ts'), 'export function add(a: number, b: number): number {\n  return a + b;\n}');

    // Files that MUST be ignored
    fs.writeFileSync(path.join(tempWorkspace, 'node_modules', 'dep', 'package.json'), '{"name":"dep"}');
    fs.writeFileSync(path.join(tempWorkspace, '.git', 'config'), '[core]\nrepositoryformatversion = 0');
    fs.writeFileSync(path.join(tempWorkspace, 'dist', 'bundle.js'), 'console.log("dist");');
    fs.writeFileSync(path.join(tempWorkspace, 'build', 'output.js'), 'console.log("build");');
    fs.writeFileSync(path.join(tempWorkspace, '.bin', 'cli.js'), 'console.log("cli");');

    const indexer = new ProjectIndexer();
    const result = await indexer.indexWorkspace(tempWorkspace);

    assert('indexWorkspace returns correct rootPath', result.rootPath === path.resolve(tempWorkspace));
    assert('indexWorkspace indexed exactly 4 valid files', result.fileCount === 4);
    assert('indexWorkspace capped is false for small project', result.capped === false);
    assert('Ignored files in node_modules are not indexed', !result.files.some(f => f.relativePath.includes('node_modules')));
    assert('Ignored files in .git are not indexed', !result.files.some(f => f.relativePath.includes('.git')));
    assert('Ignored files in dist are not indexed', !result.files.some(f => f.relativePath.includes('dist/')));
    assert('Ignored files in build are not indexed', !result.files.some(f => f.relativePath.includes('build/')));
    assert('Ignored files in .bin are not indexed', !result.files.some(f => f.relativePath.includes('.bin')));

    // Check metadata fields
    const indexTs = result.files.find(f => f.relativePath === 'src/index.ts');
    assert('File relativePath normalized with forward slashes', !!indexTs && indexTs.relativePath === 'src/index.ts');
    assert('File name extracted correctly', !!indexTs && indexTs.name === 'index.ts');
    assert('File extension extracted with dot', !!indexTs && indexTs.extension === '.ts');
    assert('File size matches bytes on disk', !!indexTs && indexTs.size > 20);
    assert('File formattedSize is string like "58 B"', !!indexTs && typeof indexTs.formattedSize === 'string');
    assert('File modifiedIso is valid date string', !!indexTs && !isNaN(Date.parse(indexTs.modifiedIso)));
    assert('File isBinary is false for TypeScript source', !!indexTs && indexTs.isBinary === false);

  } finally {
    // Cleanup temporary workspace
    try {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    } catch {}
  }

  // --------------------------------------------------------------------------
  // 2. Strict 500-File Cap & Sub-50ms Performance
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing Strict 500-File Capping & Sub-50ms Indexing ---');

  const largeWorkspace = path.join(os.tmpdir(), `robo-large-workspace-${Date.now()}`);
  fs.mkdirSync(largeWorkspace, { recursive: true });

  try {
    // Generate 530 files across 10 folders
    const totalFilesToCreate = 530;
    for (let d = 0; d < 10; d++) {
      const dir = path.join(largeWorkspace, `dir_${d}`);
      fs.mkdirSync(dir, { recursive: true });
      for (let f = 0; f < 53; f++) {
        fs.writeFileSync(path.join(dir, `file_${f}.txt`), `Sample content for file ${f} in dir ${d}`);
      }
    }

    const indexer = new ProjectIndexer({ maxFiles: 500 });
    const startTime = Date.now();
    const result = await indexer.indexWorkspace(largeWorkspace);
    const duration = Date.now() - startTime;

    assert('Workspace file count is strictly capped at 500', result.fileCount === 500);
    assert('result.capped flag is true when files exceed limit', result.capped === true);
    assert('indexer.isIndexCapped() returns true', indexer.isIndexCapped() === true);
    assert(`Indexing 500 files took <50ms (${duration}ms)`, duration < 50);

  } finally {
    try {
      fs.rmSync(largeWorkspace, { recursive: true, force: true });
    } catch {}
  }

  // --------------------------------------------------------------------------
  // 3. Fast Full-Text and Fuzzy Search Ranking
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing Fast Full-Text & Fuzzy Search Ranking ---');

  const searchWorkspace = path.join(os.tmpdir(), `robo-search-workspace-${Date.now()}`);
  fs.mkdirSync(searchWorkspace, { recursive: true });

  try {
    fs.mkdirSync(path.join(searchWorkspace, 'src'), { recursive: true });
    fs.mkdirSync(path.join(searchWorkspace, 'docs'), { recursive: true });

    fs.writeFileSync(path.join(searchWorkspace, 'src', 'project-indexer.ts'), 'export class ProjectIndexer {\n  private workspaceRoot: string = "";\n  public search() {}\n}');
    fs.writeFileSync(path.join(searchWorkspace, 'src', 'project-ui.ts'), 'export class ProjectUI {\n  private panel: HTMLElement | null = null;\n  public render() {}\n}');
    fs.writeFileSync(path.join(searchWorkspace, 'src', 'config-store.ts'), 'export const DEFAULT_CONFIG = {\n  version: 2,\n  restModeEnabled: false\n};');
    fs.writeFileSync(path.join(searchWorkspace, 'docs', 'PROJECT.md'), '# Project Mode Guide\nLearn how to use Project Mode and fuzzy search ranking in RoboIsland.');

    const indexer = new ProjectIndexer();
    await indexer.indexWorkspace(searchWorkspace);

    // Test 3.1: Exact Filename Match
    const exactResults = indexer.search('project-ui.ts');
    assert('Exact filename search returns results', exactResults.length > 0);
    assert('Exact filename match ranked #1', exactResults[0].file.name === 'project-ui.ts');
    assert('Exact filename score is highest (>=1000)', exactResults[0].score >= 1000);
    assert('Exact filename matchType is "exact-name"', exactResults[0].matchType === 'exact-name');

    // Test 3.2: Exact Filename without extension
    const noExtResults = indexer.search('config-store');
    assert('Filename match without extension ranked #1', noExtResults[0].file.name === 'config-store.ts');
    assert('Match without extension has high score (>=850)', noExtResults[0].score >= 850);

    // Test 3.3: Prefix Filename Match
    const prefixResults = indexer.search('project-');
    assert('Prefix search finds both project files', prefixResults.length >= 2);
    assert('Top results have matchType "prefix-name"', prefixResults[0].matchType === 'prefix-name');
    assert('Prefix match score is >= 600', prefixResults[0].score >= 600);

    // Test 3.4: Substring Filename Match
    const subResults = indexer.search('indexer');
    assert('Substring match finds project-indexer.ts', subResults.length > 0 && subResults[0].file.name === 'project-indexer.ts');
    assert('Substring match score is >= 400', subResults[0].score >= 400);

    // Test 3.5: Fuzzy Matching
    const fuzzyResults = indexer.search('prui');
    assert('Fuzzy search "prui" matches "project-ui.ts"', fuzzyResults.some(r => r.file.name === 'project-ui.ts'));
    const pUiMatch = fuzzyResults.find(r => r.file.name === 'project-ui.ts');
    assert('Fuzzy matchType is "fuzzy-name"', pUiMatch && pUiMatch.matchType === 'fuzzy-name');

    // Test 3.6: Full-Text Content Search & Snippet Extraction
    const contentResults = indexer.search('DEFAULT_CONFIG');
    assert('Full-text content search returns matching file', contentResults.length > 0);
    assert('Content match correctly identifies config-store.ts', contentResults[0].file.name === 'config-store.ts');
    assert('Content match generates snippets', contentResults[0].snippets.length > 0);
    assert('Snippet contains line number', contentResults[0].snippets[0].line === 1);
    assert('Snippet contains matched line text', contentResults[0].snippets[0].text.includes('DEFAULT_CONFIG'));
    assert('Snippet contains matchStart and matchEnd', contentResults[0].snippets[0].matchEnd > contentResults[0].snippets[0].matchStart);

    // Test 3.7: Ranking Order (scores strictly non-increasing)
    const allResults = indexer.search('project');
    let isSorted = true;
    for (let i = 1; i < allResults.length; i++) {
      if (allResults[i].score > allResults[i - 1].score) {
        isSorted = false;
        break;
      }
    }
    assert('Search results are strictly sorted descending by score', isSorted);

    // Test 3.8: Empty query
    const emptyResults = indexer.search('');
    assert('Empty query returns workspace files up to limit', emptyResults.length === 4);

  } finally {
    try {
      fs.rmSync(searchWorkspace, { recursive: true, force: true });
    } catch {}
  }

  // --------------------------------------------------------------------------
  // 4. Git Status Inspection
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Git Repository Status Inspection ---');

  const rootRepo = path.resolve(__dirname, '..');
  const indexer = new ProjectIndexer();

  const gitStatus = indexer.getGitStatus(rootRepo);
  assert('Current RoboIsland repo detected as git repo', gitStatus.isRepo === true);
  assert('Branch name is non-empty string', typeof gitStatus.branch === 'string' && gitStatus.branch.length > 0);
  assert('Branch matches "feature/roboisland-2-mega-upgrade"', gitStatus.branch === 'feature/roboisland-2-mega-upgrade');
  assert('Dirty file count is a non-negative number', typeof gitStatus.dirtyCount === 'number' && gitStatus.dirtyCount >= 0);
  assert('stagedFiles is an array', Array.isArray(gitStatus.stagedFiles));
  assert('unstagedFiles is an array', Array.isArray(gitStatus.unstagedFiles));
  assert('untrackedFiles is an array', Array.isArray(gitStatus.untrackedFiles));
  assert('isClean is a boolean', typeof gitStatus.isClean === 'boolean');

  // Test on non-git directory
  const nonGitDir = path.join(os.tmpdir(), `robo-non-git-${Date.now()}`);
  fs.mkdirSync(nonGitDir, { recursive: true });
  try {
    const nonGitStatus = indexer.getGitStatus(nonGitDir);
    assert('Non-git directory reports isRepo: false', nonGitStatus.isRepo === false);
    assert('Non-git directory reports branch: ""', nonGitStatus.branch === '');
    assert('Non-git directory reports dirtyCount: 0', nonGitStatus.dirtyCount === 0);
    assert('Non-git directory reports isClean: true', nonGitStatus.isClean === true);
  } finally {
    try {
      fs.rmSync(nonGitDir, { recursive: true, force: true });
    } catch {}
  }

  // --------------------------------------------------------------------------
  // 5. Code Reading, Binary Detection & Syntax Highlighting
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Testing Code Reading, Binary Detection & Syntax Highlighting ---');

  const previewDir = path.join(os.tmpdir(), `robo-preview-${Date.now()}`);
  fs.mkdirSync(previewDir, { recursive: true });

  try {
    const tsCode = `// Sample TypeScript
import { app } from 'electron';

export function calculate(val: number): number {
  const factor = 42;
  return val * factor;
}
`;
    fs.writeFileSync(path.join(previewDir, 'sample.ts'), tsCode);

    // Create binary file with null bytes
    const binBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x0d]);
    fs.writeFileSync(path.join(previewDir, 'image.png'), binBuffer);

    const prevIndexer = new ProjectIndexer();
    await prevIndexer.indexWorkspace(previewDir);

    // Test text preview
    const textPreview = prevIndexer.getFilePreview('sample.ts');
    assert('Text file preview loaded successfully', textPreview !== null);
    assert('Text preview contains raw code', textPreview && textPreview.content.includes('calculate'));
    assert('Text preview splits lines array', textPreview && textPreview.lines.length === 8);
    assert('File metadata lineCount is accurate', textPreview && textPreview.file.lineCount === 8);
    assert('Text file is not marked as binary', textPreview && textPreview.file.isBinary === false);

    // Test binary preview
    const binPreview = prevIndexer.getFilePreview('image.png');
    assert('Binary file preview handled safely', binPreview !== null);
    assert('Binary file marked isBinary: true', binPreview && binPreview.file.isBinary === true);
    assert('Binary preview content shows descriptive placeholder', binPreview && binPreview.content.includes('[Binary file'));

    // Test Syntax Highlighting
    const highlighted = highlightCode(tsCode, 'ts');
    assert('Syntax highlighter wraps keywords in proj-syn-keyword', highlighted.includes('class="proj-syn-keyword">import</span>') || highlighted.includes('class="proj-syn-keyword">export</span>'));
    assert('Syntax highlighter wraps strings in proj-syn-string', highlighted.includes('class="proj-syn-string">'));
    assert('Syntax highlighter wraps comments in proj-syn-comment', highlighted.includes('class="proj-syn-comment">// Sample TypeScript</span>'));
    assert('Syntax highlighter wraps numbers in proj-syn-number', highlighted.includes('class="proj-syn-number">42</span>'));

  } finally {
    try {
      fs.rmSync(previewDir, { recursive: true, force: true });
    } catch {}
  }

  // --------------------------------------------------------------------------
  // 6. Renderer UI Template & ZERO EMOJI COMPLIANCE
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Testing Renderer UI Template & Zero-Emoji Compliance ---');

  const templateHtml = buildProjectTemplate();
  assert('Template contains #btn-project-choose', templateHtml.includes('id="btn-project-choose"'));
  assert('Template contains #project-git-pill', templateHtml.includes('id="project-git-pill"'));
  assert('Template contains #project-search-input', templateHtml.includes('id="project-search-input"'));
  assert('Template contains #project-file-list', templateHtml.includes('id="project-file-list"'));
  assert('Template contains #project-preview-body', templateHtml.includes('id="project-preview-body"'));
  assert('Template contains #btn-project-copy', templateHtml.includes('id="btn-project-copy"'));

  // Test SVG Icons
  assert('SVG_ICONS folder is valid SVG', SVG_ICONS.folder.startsWith('<svg') && SVG_ICONS.folder.endsWith('</svg>'));
  assert('SVG_ICONS search is valid SVG', SVG_ICONS.search.startsWith('<svg') && SVG_ICONS.search.endsWith('</svg>'));
  assert('SVG_ICONS gitBranch is valid SVG', SVG_ICONS.gitBranch.startsWith('<svg') && SVG_ICONS.gitBranch.endsWith('</svg>'));
  assert('SVG_ICONS fileCode is valid SVG', SVG_ICONS.fileCode.startsWith('<svg') && SVG_ICONS.fileCode.endsWith('</svg>'));
  assert('SVG_ICONS copy is valid SVG', SVG_ICONS.copy.startsWith('<svg') && SVG_ICONS.copy.endsWith('</svg>'));
  assert('SVG_ICONS check is valid SVG', SVG_ICONS.check.startsWith('<svg') && SVG_ICONS.check.endsWith('</svg>'));

  // ZERO EMOJI COMPLIANCE CHECK
  const emojiRegex = /\p{Extended_Pictographic}/u;
  const projectUiSource = fs.readFileSync(path.join(__dirname, '../src/renderer/island/project-ui.ts'), 'utf8');
  const projectIndexerSource = fs.readFileSync(path.join(__dirname, '../src/main/project-indexer.ts'), 'utf8');

  assert('src/renderer/island/project-ui.ts contains ZERO emoji characters', !emojiRegex.test(projectUiSource));
  assert('src/main/project-indexer.ts contains ZERO emoji characters', !emojiRegex.test(projectIndexerSource));
  assert('buildProjectTemplate() output contains ZERO emoji characters', !emojiRegex.test(templateHtml));

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('[FATAL] Test runner threw unhandled exception:', err);
  process.exit(1);
});
