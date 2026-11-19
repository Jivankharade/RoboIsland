/**
 * Challenger 1: Adversarial Stress Test Harness for Milestone 3 (R3: Screen Glance & Error Fixer)
 * 
 * Comprehensive empirical test suite covering:
 * 1. ANSI Color Escape Codes Handling & Command Corruption
 * 2. Command Injection & Metacharacter Parameter Tampering
 * 3. Multiline Error Logs, Deep Stack Traces & Truncated Inputs
 * 4. Active Window Taxonomy & Edge Case Classification
 * 5. Document & Media Summarizer Boundaries (Empty, Giant, Non-ASCII, CJK)
 * 6. Engine State, Event Lifecycle & Listener Resilience
 */

const path = require('path');
const fs = require('fs');
const v8 = require('v8');

// Load ScreenGlanceEngine from dist
const screenGlanceEnginePath = path.join(__dirname, '../dist/main/screen-glance-engine.js');
if (!fs.existsSync(screenGlanceEnginePath)) {
  console.error('[ERROR] screen-glance-engine.js not found in dist/main! Run npm run build first.');
  process.exit(1);
}

const {
  ScreenGlanceEngine,
  screenGlanceEngine,
  ERROR_CATALOG_RULES
} = require(screenGlanceEnginePath);

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failureDetails = [];
const vulnerabilityFindings = [];

function assert(description, condition, details = '') {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  [PASS] ${description}`);
  } else {
    failedAssertions++;
    console.error(`  [FAIL] ${description} ${details ? '--> ' + details : ''}`);
    failureDetails.push({ description, details });
  }
}

function recordVulnerability(title, severity, description, evidence, recommendation) {
  vulnerabilityFindings.push({
    title,
    severity,
    description,
    evidence,
    recommendation
  });
  console.log(`\n  ⚠️ [VULNERABILITY IDENTIFIED] [${severity}] ${title}`);
  console.log(`     Evidence: ${evidence}`);
  console.log(`     Recommendation: ${recommendation}\n`);
}

async function runAdversarialGlanceTests() {
  console.log('======================================================================');
  console.log('   CHALLENGER 1: SCREEN GLANCE & ERROR FIXER ADVERSARIAL STRESS TEST  ');
  console.log('======================================================================\n');

  // =========================================================================
  // 1. ANSI Color Escape Codes Stress Testing
  // =========================================================================
  console.log('--- 1. Testing ANSI Color Escape Codes & Command Corruption ---');

  // 1.1 TS2307 with colored module name
  const tsColorInput = "\u001b[31mTS2307: Cannot find module '\u001b[1mreact\u001b[0m'\u001b[0m";
  const tsColorRes = screenGlanceEngine.detectErrors(tsColorInput);
  assert('detectErrors matches TS2307 when ANSI color codes are present', tsColorRes.length > 0 && tsColorRes[0].ruleId === 'ts-cannot-find-module');

  const tsHasAnsiInCommand = tsColorRes.length > 0 && /[\u001b\x1b]/.test(tsColorRes[0].command || '');
  if (tsHasAnsiInCommand) {
    recordVulnerability(
      'ANSI Escape Sequences Leak into Generated Shell Commands',
      'HIGH',
      'Terminal ANSI color codes inside quotes are captured verbatim into command payloads (e.g. "npm install \\x1b[1mreact\\x1b[0m"). When executed by shell, npm fails with EINVALIDPACKAGENAME.',
      `Input: ${JSON.stringify(tsColorInput)} -> Output command: ${JSON.stringify(tsColorRes[0].command)}`,
      'Strip ANSI escape sequences (replace(/[\\u001b\\x1b]\\[[0-9;]*[a-zA-Z]/g, "")) before regex evaluation.'
    );
  }
  assert('TS2307 generated command should NOT contain ANSI escape characters', !tsHasAnsiInCommand,
    `Command was: ${JSON.stringify(tsColorRes[0]?.command)}`);

  // 1.2 Python ModuleNotFoundError with ANSI
  const pyColorInput = "\u001b[31mModuleNotFoundError: No module named '\u001b[1mtorch\u001b[0m'\u001b[0m";
  const pyColorRes = screenGlanceEngine.detectErrors(pyColorInput);
  const pyHasAnsi = pyColorRes.length > 0 && /[\u001b\x1b]/.test(pyColorRes[0].command || '');
  assert('Python ModuleNotFoundError generated command should NOT contain ANSI escape characters', !pyHasAnsi,
    `Command was: ${JSON.stringify(pyColorRes[0]?.command)}`);

  // 1.3 Node EADDRINUSE with ANSI color before colon
  const nodeAnsiPort = "\u001b[31mError: listen EADDRINUSE\u001b[0m :::3000";
  const nodeAnsiRes = screenGlanceEngine.detectErrors(nodeAnsiPort);
  const nodeAnsiFailed = nodeAnsiRes.length === 0;
  if (nodeAnsiFailed) {
    recordVulnerability(
      'ANSI Reset Code (\\u001b[0m) Breaks EADDRINUSE Port Capture',
      'HIGH',
      'The regex for EADDRINUSE uses [^0-9]*(\\d{2,5}). The ANSI reset sequence "\\u001b[0m" contains the digit "0", which causes the regex to stop and fail to capture the actual port number (3000).',
      `Input: ${JSON.stringify(nodeAnsiPort)} -> Detected errors: 0`,
      'Strip ANSI sequences from input text before pattern evaluation in detectErrors().'
    );
  }
  assert('detectErrors matches EADDRINUSE and extracts port 3000 when ANSI codes are present',
    nodeAnsiRes.length > 0 && nodeAnsiRes[0].command === 'npx kill-port 3000',
    `Matches: ${nodeAnsiRes.length}`);

  // 1.4 Rust compiler error with ANSI color codes
  const rustAnsiErr = "\u001b[31merror[E0308]:\u001b[0m mismatched types";
  const rustAnsiRes = screenGlanceEngine.detectErrors(rustAnsiErr);
  const rustAnsiFailed = rustAnsiRes.length === 0;
  if (rustAnsiFailed) {
    recordVulnerability(
      'ANSI Reset Code Breaks Rust Compiler Error Matching',
      'MEDIUM',
      'The regex /error\\[E0308\\]:\\s*mismatched types/ requires \\s* after colon. Modern terminals emit "\\u001b[0m" after the colon, which is not whitespace, completely failing detection.',
      `Input: ${JSON.stringify(rustAnsiErr)} -> Detected errors: 0`,
      'Strip ANSI escape sequences from input before matching.'
    );
  }
  assert('detectErrors matches Rust error[E0308] when ANSI codes are present',
    rustAnsiRes.length > 0 && rustAnsiRes[0].ruleId === 'rust-e0308',
    `Matches: ${rustAnsiRes.length}`);

  // 1.5 Git fatal error with ANSI
  const gitAnsiErr = "\u001b[31mfatal:\u001b[0m not a git repository";
  const gitAnsiRes = screenGlanceEngine.detectErrors(gitAnsiErr);
  assert('detectErrors matches Git not a repo when ANSI codes are present',
    gitAnsiRes.length > 0 && gitAnsiRes[0].ruleId === 'git-not-a-repo',
    `Matches: ${gitAnsiRes.length}`);

  // =========================================================================
  // 2. Command Injection & Metacharacter Parameter Tampering
  // =========================================================================
  console.log('\n--- 2. Testing Command Injection & Parameter Tampering ---');

  // 2.1 Malicious package name with command chaining (&)
  const injectChainingInput = "Cannot find module 'lodash & calc.exe'";
  const injectChainingRes = screenGlanceEngine.detectErrors(injectChainingInput);
  const isChainingVulnerable = injectChainingRes.length > 0 && injectChainingRes[0].command === 'npm install lodash & calc.exe';
  if (isChainingVulnerable) {
    recordVulnerability(
      'Arbitrary Command Injection via Shell Metacharacters in Package Name',
      'CRITICAL',
      'ScreenGlanceEngine interpolates unvalidated capture group m[1] directly into child_process.exec(payload). An adversarial terminal or clipboard string can trigger arbitrary command execution upon 1-tap fix.',
      `Input: ${injectChainingInput} -> Generated Command: ${injectChainingRes[0].command}`,
      'Validate package names with strict regex (/^[a-zA-Z0-9@_\\-\\.\/]+$/) or sanitize metacharacters ([;&|`$<>\r\n]) before interpolating into shell command.'
    );
  }
  assert('Generated command must NOT contain unescaped shell chaining operators (&)',
    !isChainingVulnerable, `Command was: ${injectChainingRes[0]?.command}`);

  // 2.2 Semicolon command injection in Node ERR_MODULE_NOT_FOUND
  const injectSemiInput = "Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'express; notepad.exe'";
  const injectSemiRes = screenGlanceEngine.detectErrors(injectSemiInput);
  const isSemiVulnerable = injectSemiRes.length > 0 && (injectSemiRes[0].command || '').includes('; notepad.exe');
  assert('Generated command must NOT contain unescaped semicolon command separators (;)',
    !isSemiVulnerable, `Command was: ${injectSemiRes[0]?.command}`);

  // 2.3 Pipe command injection in Python ModuleNotFoundError
  const injectPipeInput = "ModuleNotFoundError: No module named 'torch | rm -rf /'";
  const injectPipeRes = screenGlanceEngine.detectErrors(injectPipeInput);
  const isPipeVulnerable = injectPipeRes.length > 0 && (injectPipeRes[0].command || '').includes('| rm -rf');
  assert('Generated Python command must NOT contain unescaped shell pipe operators (|)',
    !isPipeVulnerable, `Command was: ${injectPipeRes[0]?.command}`);

  // 2.4 Backtick subshell injection in terminal-command-not-found
  const injectBacktickInput = "'test`calc`' is not recognized as an internal or external command";
  const injectBacktickRes = screenGlanceEngine.detectErrors(injectBacktickInput);
  const isBacktickVulnerable = injectBacktickRes.length > 0 && (injectBacktickRes[0].command || '').includes('`calc`');
  assert('Generated terminal search command must NOT contain backtick subshell operators',
    !isBacktickVulnerable, `Command was: ${injectBacktickRes[0]?.command}`);

  // 2.5 Port parameter injection resistance (EADDRINUSE)
  const injectPortInput = "listen EADDRINUSE :::3000 & calc.exe";
  const injectPortRes = screenGlanceEngine.detectErrors(injectPortInput);
  assert('EADDRINUSE port parameter strictly captures digits and rejects chained commands',
    injectPortRes.length > 0 && injectPortRes[0].command === 'npx kill-port 3000');

  // =========================================================================
  // 3. Multiline Error Logs, Deep Stack Traces & Truncation
  // =========================================================================
  console.log('\n--- 3. Testing Multiline Logs, Deep Stack Traces & Truncation ---');

  // 3.1 5,000-line stack trace with error at line 3,450
  const stackLines = [];
  for (let i = 0; i < 5000; i++) {
    if (i === 3450) {
      stackLines.push("TS2304: Cannot find name 'computeChecksum'.");
    } else {
      stackLines.push(`    at Module.require (node:internal/modules/cjs/loader.js:${1000 + (i % 500)}:15)`);
    }
  }
  const deepStackDump = stackLines.join('\n');
  const deepStackRes = screenGlanceEngine.detectErrors(deepStackDump);
  assert('detectErrors finds buried TS2304 error at line 3,450 of 5,000-line trace',
    deepStackRes.length > 0 && deepStackRes.some(e => e.ruleId === 'ts-cannot-find-name'));

  // 3.2 8 distinct errors in a single build output
  const multiErrDump = `
[TypeScript] TS2307: Cannot find module 'zod'
[Server] Error: listen EADDRINUSE: address already in use :::8080
[Worker] ModuleNotFoundError: No module named 'scipy'
[Native] error[E0425]: cannot find value 'buffer' in this scope
[VCS] fatal: not a git repository (or any of the parent directories): .git
[Container] Cannot connect to the Docker daemon at unix:///var/run/docker.sock
[Network] getaddrinfo ENOTFOUND api.internal.local
[CLI] 'make' is not recognized as an internal or external command
  `;
  const multiErrRes = screenGlanceEngine.detectErrors(multiErrDump);
  assert('detectErrors identifies all 8 distinct errors across stacks in single pass',
    multiErrRes.length === 8);

  // 3.3 Truncated input without closing quote
  const truncatedQuote = "Cannot find module 'unfinished-package-name-with-no-closing-quote";
  const truncatedQuoteRes = screenGlanceEngine.detectErrors(truncatedQuote);
  assert('Truncated input without closing quote does not crash or throw',
    Array.isArray(truncatedQuoteRes) && truncatedQuoteRes.length === 0);

  // 3.4 Input with 10 duplicate identical errors (deduplication)
  const dupDump = Array(10).fill("TS2307: Cannot find module 'axios'").join('\n');
  const dupRes = screenGlanceEngine.detectErrors(dupDump);
  assert('Duplicate identical errors are deduplicated by rule ID to prevent UI spam',
    dupRes.length === 1 && dupRes[0].ruleId === 'ts-cannot-find-module');

  // 3.5 Massive 2,000,000-character terminal dump performance
  const massiveDump = ('0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ '.repeat(50) + '\n').repeat(1000);
  const tStart = Date.now();
  const massiveRes = screenGlanceEngine.detectErrors(massiveDump);
  const elapsed = Date.now() - tStart;
  assert('detectErrors on 1.8MB terminal dump executes within 100ms SLA',
    elapsed < 100, `Took ${elapsed}ms`);

  // =========================================================================
  // 4. Active Window Taxonomy & Edge Case Classification
  // =========================================================================
  console.log('\n--- 4. Testing Active Window Taxonomy & Edge Cases ---');

  // 4.1 Empty and falsy process / window names
  assert('classifyWindow handles empty strings gracefully',
    screenGlanceEngine.classifyWindow('', '') === 'general');

  // 4.2 Non-string types (should not throw)
  let nonStringThrew = false;
  try {
    screenGlanceEngine.classifyWindow(12345, null);
  } catch {
    nonStringThrew = true;
  }
  if (nonStringThrew) {
    recordVulnerability(
      'Type Error in classifyWindow When Passed Non-String Process Name',
      'LOW',
      'classifyWindow calls .toLowerCase() directly on processName without verifying typeof === "string". Passing a numeric PID or non-string causes uncaught TypeError.',
      'classifyWindow(12345, null) throws: (processName || "").toLowerCase is not a function',
      'Use String(processName || "").toLowerCase().trim() for defensive conversion.'
    );
  }
  assert('classifyWindow should not throw when passed non-string types', !nonStringThrew);

  // 4.3 PDF opened in Browser priority
  assert('classifyWindow prioritizes document_pdf when browser has .pdf in title',
    screenGlanceEngine.classifyWindow('chrome.exe', 'Financial_Report_Q4_2026.pdf - Google Chrome') === 'document_pdf');

  // 4.4 YouTube opened in Browser priority
  assert('classifyWindow prioritizes media_video when browser is playing YouTube',
    screenGlanceEngine.classifyWindow('msedge.exe', 'Dynamic Island Architecture Walkthrough - YouTube') === 'media_video');

  // 4.5 Spotify and streaming media
  assert('classifyWindow identifies media_video for Spotify',
    screenGlanceEngine.classifyWindow('Spotify.exe', 'Chill Lo-Fi Beats') === 'media_video');

  // 4.6 Terminal emulators (wt, powershell, bash, alacritty)
  assert('classifyWindow classifies WindowsTerminal.exe as terminal',
    screenGlanceEngine.classifyWindow('WindowsTerminal.exe', 'cmd.exe') === 'terminal');
  assert('classifyWindow classifies alacritty.exe as terminal',
    screenGlanceEngine.classifyWindow('alacritty.exe', 'zsh') === 'terminal');

  // 4.7 Modern IDEs (cursor, idea64, webstorm)
  assert('classifyWindow classifies cursor.exe as compiler_ide',
    screenGlanceEngine.classifyWindow('cursor.exe', 'App.tsx') === 'compiler_ide');
  assert('classifyWindow classifies idea64.exe as compiler_ide',
    screenGlanceEngine.classifyWindow('idea64.exe', 'BackendService.java') === 'compiler_ide');

  // 4.8 10,000-character window title
  const hugeTitle = 'A'.repeat(10000) + '.pdf';
  assert('classifyWindow correctly parses 10,000-character window title',
    screenGlanceEngine.classifyWindow('explorer.exe', hugeTitle) === 'document_pdf');

  // 4.9 Unicode and Emoji window titles
  assert('classifyWindow handles Unicode and Emoji titles without error',
    screenGlanceEngine.classifyWindow('Code.exe', '🚀 动态岛 / RoboIsland - Visual Studio Code') === 'compiler_ide');

  // =========================================================================
  // 5. Document & Media Summarizer Boundaries
  // =========================================================================
  console.log('\n--- 5. Testing Document & Media Summarizer Boundaries ---');

  // 5.1 Empty string input
  const emptySummary = await screenGlanceEngine.summarizeActive({ title: 'Untitled Document', text: '' });
  assert('summarizeActive handles empty text string with offline fallback',
    emptySummary && emptySummary.success && emptySummary.takeaways.length >= 2);

  // 5.2 Single word input
  const singleWordSummary = await screenGlanceEngine.summarizeActive({ title: 'Short Note', text: 'Hello' });
  assert('summarizeActive handles 1-word text without NaN or zero reading time',
    singleWordSummary && singleWordSummary.readingTime === '1 min read');

  // 5.3 100,000-word massive document
  const sampleParagraph = 'The system architecture uses event-driven reactive pipelines for high throughput. ';
  const giantDocText = sampleParagraph.repeat(10000); // ~110,000 words
  const giantStart = Date.now();
  const giantSummary = await screenGlanceEngine.summarizeActive({ title: 'Distributed Systems Spec.pdf', text: giantDocText });
  const giantElapsed = Date.now() - giantStart;
  assert('summarizeActive processes 100,000 words within 500ms',
    giantElapsed < 500, `Took ${giantElapsed}ms`);
  assert('summarizeActive estimates appropriate reading time for 100,000 words',
    giantSummary && giantSummary.readingTime.includes('min read') && parseInt(giantSummary.readingTime) > 300);

  // 5.4 CJK non-spaced text handling
  const cjkText = '这是一个非常重要的技术报告。微内核架构提供了最高级别的隔离保护。动态岛能够自动检测并提取关键指标。';
  const cjkSummary = await screenGlanceEngine.summarizeActive({ title: '技术架构白皮书', text: cjkText });
  assert('summarizeActive extracts takeaways from non-spaced CJK sentences',
    cjkSummary && cjkSummary.takeaways.length >= 1 && cjkSummary.takeaways[0].includes('这是一个非常重要的技术报告'));

  // 5.5 Pure symbols and punctuation (adversarial fuzz)
  const symbolText = '!@#$%^&*()_+=-~`{}[]|\\:;"<>,.?/ '.repeat(100);
  const symbolSummary = await screenGlanceEngine.summarizeActive({ title: 'Corrupted Stream', text: symbolText });
  assert('summarizeActive survives pure symbols and punctuation fuzzing without crashing',
    symbolSummary && symbolSummary.success && symbolSummary.takeaways.length > 0);

  // 5.6 Markdown lists and bullet extraction
  const mdListText = `
Key architectural principles:
- Sub-second UI reactivity at 240Hz
- Deterministic 30+ rule regex catalog
* Zero external cloud dependency per R7
• Apple Intelligence glassmorphism styling
  `;
  const mdSummary = await screenGlanceEngine.summarizeActive({ title: 'Design Principles', text: mdListText });
  assert('summarizeActive extracts bullet points with -, *, and • prefixes',
    mdSummary && mdSummary.takeaways.length >= 3 && mdSummary.takeaways.some(t => t.includes('240Hz')));

  // 5.7 High concurrency: 50 simultaneous summarize calls
  const concurrentPromises = Array.from({ length: 50 }, (_, idx) => 
    screenGlanceEngine.summarizeActive({ title: `Doc ${idx}`, text: `Sentence ${idx} is an important result.` })
  );
  const concurrentResults = await Promise.all(concurrentPromises);
  assert('summarizeActive survives 50 concurrent invocations without state corruption',
    concurrentResults.length === 50 && concurrentResults.every(r => r.success));

  // =========================================================================
  // 6. Engine State, Event Lifecycle & Listener Resilience
  // =========================================================================
  console.log('\n--- 6. Testing Engine State, Event Lifecycle & Listener Resilience ---');

  // 6.1 State retention after checkErrors
  await screenGlanceEngine.checkErrors("TS2307: Cannot find module 'mocha'");
  const stateAfterCheck = screenGlanceEngine.getState();
  assert('checkErrors populates activeErrors in engine state',
    stateAfterCheck.activeErrors.length > 0 && stateAfterCheck.activeErrors[0].ruleId === 'ts-cannot-find-module');

  // 6.2 Listener subscription and dispatch
  let listenerFiredCount = 0;
  let receivedErrors = [];
  const unsubscribe = screenGlanceEngine.onErrorsChanged((errors) => {
    listenerFiredCount++;
    receivedErrors = errors;
  });

  await screenGlanceEngine.checkErrors("listen EADDRINUSE :::4000");
  assert('onErrorsChanged listener receives detected error payload',
    listenerFiredCount === 1 && receivedErrors.length > 0 && receivedErrors[0].ruleId === 'node-eaddrinuse');

  // 6.3 Listener unsubscription
  unsubscribe();
  await screenGlanceEngine.checkErrors("fatal: not a git repository");
  assert('Unsubscribed listener does not fire on subsequent checkErrors',
    listenerFiredCount === 1);

  // 6.4 Resilient dispatch when a subscriber throws
  let goodListenerFired = false;
  screenGlanceEngine.onErrorsChanged(() => {
    throw new Error('Exploding rogue subscriber');
  });
  screenGlanceEngine.onErrorsChanged((errors) => {
    goodListenerFired = errors.length > 0;
  });

  await screenGlanceEngine.checkErrors("TS2307: Cannot find module 'sinon'");
  assert('A throwing listener does not prevent subsequent listeners from executing',
    goodListenerFired);

  // 6.5 clearErrors resets state and broadcasts empty array
  let clearEventPayload = null;
  screenGlanceEngine.onErrorsChanged((errors) => {
    clearEventPayload = errors;
  });
  screenGlanceEngine.clearErrors();
  assert('clearErrors empties activeErrors in state',
    screenGlanceEngine.getState().activeErrors.length === 0);
  assert('clearErrors notifies listeners with empty array',
    Array.isArray(clearEventPayload) && clearEventPayload.length === 0);

  // 6.6 applyFix with non-existent fix ID
  const invalidFixRes = await screenGlanceEngine.applyFix('non-existent-fix-id-999');
  assert('applyFix handles missing fix ID gracefully returning success=false',
    invalidFixRes && invalidFixRes.success === false && invalidFixRes.message.includes('not found'));

  // 6.7 applyFix with clipboard action type does not execute shell command
  await screenGlanceEngine.checkErrors("TS2304: Cannot find name 'useEffect'");
  const tsNameFix = screenGlanceEngine.getState().activeErrors.find(e => e.ruleId === 'ts-cannot-find-name');
  assert('TS2304 has clipboard actionType', tsNameFix && tsNameFix.actionType === 'clipboard');
  if (tsNameFix) {
    const clipboardRes = await screenGlanceEngine.applyFix(tsNameFix.id);
    assert('applyFix for clipboard action produces copiedText and actionType clipboard',
      clipboardRes && clipboardRes.success && clipboardRes.actionType === 'clipboard' && clipboardRes.copiedText.includes('useEffect'));
  }

  // =========================================================================
  // Summary & Report
  // =========================================================================
  console.log('\n======================================================================');
  console.log(`TOTAL ADVERSARIAL ASSERTIONS: ${totalAssertions}`);
  console.log(`PASSED: ${passedAssertions}`);
  console.log(`FAILED: ${failedAssertions}`);
  console.log(`IDENTIFIED VULNERABILITIES: ${vulnerabilityFindings.length}`);
  console.log('======================================================================\n');

  if (vulnerabilityFindings.length > 0) {
    console.log('VULNERABILITY SUMMARY TABLE:');
    vulnerabilityFindings.forEach((v, i) => {
      console.log(`  ${i + 1}. [${v.severity}] ${v.title}`);
    });
  }

  return {
    totalAssertions,
    passedAssertions,
    failedAssertions,
    failureDetails,
    vulnerabilityFindings
  };
}

runAdversarialGlanceTests().then(res => {
  if (res.failedAssertions > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}).catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
