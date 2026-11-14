/**
 * ROBOISLAND AI MONITOR AUTOMATED TEST SUITE
 * Verifies webhook event reception, unified diff formatting, file mutation extraction,
 * event history ring buffer, and agent process controls.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

// Import compiled AiMonitorHub from dist/main
const { AiMonitorHub, generateUnifiedDiff, extractFileMutation } = require('../dist/main/ai-monitor-hub');

let passedTests = 0;
let failedTests = 0;

function assert(description, condition, details = '') {
  if (condition) {
    console.log(`[PASS] ${description}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${description} ${details ? '(' + details + ')' : ''}`);
    failedTests++;
  }
}

async function sendPost(port, urlPath, payload) {
  const data = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 3000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, rawBody: body });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('       ROBOISLAND AI MONITOR VERIFICATION SUITE     ');
  console.log('====================================================\n');

  // --- 1. Testing Unified Diff Generator ---
  console.log('--- 1. Testing Unified Diff Generator Algorithm ---');
  
  // Test addition only (new file)
  const addDiff = generateUnifiedDiff('src/new-feature.ts', '', 'const x = 1;\nconst y = 2;');
  assert('New file diff contains /dev/null header', addDiff.includes('--- /dev/null') && addDiff.includes('+++ b/src/new-feature.ts'));
  assert('New file diff marks additions with +', addDiff.includes('+const x = 1;') && addDiff.includes('+const y = 2;'));
  assert('New file diff chunk header starts at line 1', addDiff.includes('@@ -0,0 +1,2 @@'));

  // Test deletion only (removed file)
  const delDiff = generateUnifiedDiff('src/old-code.ts', 'line1\nline2', '');
  assert('Deleted file diff contains /dev/null header', delDiff.includes('--- a/src/old-code.ts') && delDiff.includes('+++ /dev/null'));
  assert('Deleted file diff marks deletions with -', delDiff.includes('-line1') && delDiff.includes('-line2'));
  assert('Deleted file diff chunk header matches', delDiff.includes('@@ -1,2 +0,0 @@'));

  // Test modification diff (mixed additions, deletions, context)
  const oldText = 'function test() {\n  const oldVar = 10;\n  return oldVar;\n}';
  const newText = 'function test() {\n  const newVar = 20;\n  return newVar;\n}';
  const modDiff = generateUnifiedDiff('src/utils.ts', oldText, newText);
  assert('Modified diff has standard headers', modDiff.includes('--- a/src/utils.ts') && modDiff.includes('+++ b/src/utils.ts'));
  assert('Modified diff contains context lines', modDiff.includes(' function test() {'));
  assert('Modified diff contains deletion lines', modDiff.includes('-  const oldVar = 10;'));
  assert('Modified diff contains addition lines', modDiff.includes('+  const newVar = 20;'));

  // --- 2. Testing File Mutation Extraction ---
  console.log('\n--- 2. Testing File Mutation Extraction ---');
  
  const writeEvent = {
    tool: 'write_to_file',
    parameters: {
      TargetFile: 'c:/project/src/new-module.ts',
      CodeContent: 'export const hello = "world";'
    }
  };
  const writeMut = extractFileMutation(writeEvent);
  assert('Extracted file path from write_to_file', writeMut.file === 'c:/project/src/new-module.ts');
  assert('Detected operation as added or modified', writeMut.operation === 'added' || writeMut.operation === 'modified');
  assert('Generated unified diff for write_to_file', Boolean(writeMut.diff && writeMut.diff.includes('+export const hello = "world";')));

  const replaceEvent = {
    tool: 'replace_file_content',
    parameters: {
      TargetFile: 'src/main/index.ts',
      TargetContent: 'const oldVal = 1;',
      ReplacementContent: 'const newVal = 2;'
    }
  };
  const replaceMut = extractFileMutation(replaceEvent);
  assert('Extracted file path from replace_file_content', replaceMut.file === 'src/main/index.ts');
  assert('Detected operation as modified for replace tool', replaceMut.operation === 'modified');
  assert('Generated unified diff with replacement chunk', Boolean(replaceMut.diff && replaceMut.diff.includes('-const oldVal = 1;') && replaceMut.diff.includes('+const newVal = 2;')));

  const deleteEvent = {
    tool: 'rm',
    file: 'temp/cache.json'
  };
  const delMut = extractFileMutation(deleteEvent);
  assert('Detected operation as deleted for rm tool', delMut.operation === 'deleted');

  // --- 3. Testing AI Monitor Hub Webhook Server & Event Reception ---
  console.log('\n--- 3. Testing Webhook Server & Event Reception ---');
  const hub = new AiMonitorHub();
  await new Promise(r => setTimeout(r, 150));
  const port = hub.getPort();
  
  // Test UserPromptSubmit
  const promptRes = await sendPost(port, '/roboisland-hook', {
    event: 'UserPromptSubmit',
    prompt: 'Implement AI Monitor in RoboIsland',
    sessionId: 'session-unit-1',
    timestamp: Date.now()
  });
  assert('UserPromptSubmit returned HTTP 200 OK', promptRes.status === 200 && promptRes.body?.ok === true);

  // Test PreToolUse on /twocode-hook
  const preToolRes = await sendPost(port, '/twocode-hook', {
    event: 'PreToolUse',
    tool: 'replace_file_content',
    file: 'src/main/ai-monitor-hub.ts',
    targetContent: 'class Old {}',
    replacementContent: 'class New {}',
    sessionId: 'session-unit-1'
  });
  assert('PreToolUse returned HTTP 200 OK', preToolRes.status === 200 && preToolRes.body?.ok === true);

  // Test PostToolUse
  const postToolRes = await sendPost(port, '/roboisland-hook', {
    event: 'PostToolUse',
    tool: 'replace_file_content',
    file: 'src/main/ai-monitor-hub.ts',
    sessionId: 'session-unit-1'
  });
  assert('PostToolUse returned HTTP 200 OK', postToolRes.status === 200 && postToolRes.body?.ok === true);

  // Test PostToolUseFailure
  const failRes = await sendPost(port, '/roboisland-hook', {
    event: 'PostToolUseFailure',
    tool: 'run_command',
    error: 'Build exited with code 1',
    sessionId: 'session-unit-1'
  });
  assert('PostToolUseFailure returned HTTP 200 OK', failRes.status === 200 && failRes.body?.ok === true);

  // Verify Hub History contains events
  const history = hub.getEventHistory();
  assert('Event history contains recorded events', history.length >= 4);
  assert('History includes UserPromptSubmit', history.some(e => e.event === 'UserPromptSubmit' && e.prompt.includes('AI Monitor')));
  assert('History includes PreToolUse with diff', history.some(e => e.event === 'PreToolUse' && e.diff && e.diff.includes('+class New {}')));

  // --- 4. Testing Permission Request & Process Controls ---
  console.log('\n--- 4. Testing Permission Request & Process Controls ---');
  
  // Launch asynchronous PermissionRequest
  let permResolved = false;
  let permDecision = null;
  const permPromise = sendPost(port, '/roboisland-hook', {
    event: 'PermissionRequest',
    sessionId: 'session-perm-test',
    description: 'Allow editing src/main/ai-monitor-hub.ts?'
  }).then(res => {
    permResolved = true;
    permDecision = res.body;
  });

  // Small delay to allow request to register
  await new Promise(r => setTimeout(r, 60));

  // Verify permission is pending in hub
  const pendingHistory = hub.getEventHistory();
  assert('PermissionRequest recorded in hub history', pendingHistory.some(e => e.event === 'PermissionRequest'));

  // Approve permission via hub.controlAgent('allow')
  const allowed = hub.controlAgent('allow');
  assert('controlAgent("allow") succeeded', allowed === true);
  await permPromise;
  assert('Permission request resolved with allow behavior', permResolved && permDecision?.behavior === 'allow');

  // Test Pause Process Control
  const paused = hub.controlAgent('pause');
  assert('controlAgent("pause") toggles paused state', paused === true);
  const statusAfterPause = await sendPost(port, '/twocode-status', {});
  assert('Status endpoint reports paused=true', statusAfterPause.body?.paused === true);

  // Toggle resume
  hub.controlAgent('pause');
  const statusAfterResume = await sendPost(port, '/twocode-status', {});
  assert('Status endpoint reports paused=false after unpause', statusAfterResume.body?.paused === false);

  // Test Stop Process Control
  const stopped = hub.controlAgent('stop');
  assert('controlAgent("stop") succeeded', stopped === true);
  const statusAfterStop = await sendPost(port, '/twocode-status', {});
  assert('Status endpoint reports stopped=true', statusAfterStop.body?.stopped === true);

  // --- 5. Testing 50-Event Ring Buffer Boundary ---
  console.log('\n--- 5. Testing 50-Event Ring Buffer Boundary ---');
  hub.resetControls();
  for (let i = 0; i < 60; i++) {
    await sendPost(port, '/roboisland-hook', {
      event: 'PreToolUse',
      tool: `tool_run_${i}`,
      sessionId: `session-ring-${i}`
    });
  }

  const ringHistory = hub.getEventHistory();
  assert('Event history is capped at exactly 50 events', ringHistory.length === 50, `Length: ${ringHistory.length}`);
  assert('Ring buffer retained most recent events', ringHistory[ringHistory.length - 1].tool === 'tool_run_59');
  assert('Ring buffer evicted older events beyond 50', !ringHistory.some(e => e.tool === 'tool_run_0'));

  // Clean up hub
  hub.dispose();

  console.log('\n====================================================');
  console.log(`AI MONITOR TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('[FATAL TEST ERROR]', err);
  process.exit(1);
});
