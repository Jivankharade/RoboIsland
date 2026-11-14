/**
 * RoboIsland AI Chat Verification Suite (Milestone M2)
 * Tests:
 * 1. Secure Credential Storage & Encryption (safeStorage DPAPI & AES-256-GCM fallback)
 * 2. Provider Configurations (OpenAI, Claude, Custom Ollama)
 * 3. SSE Protocol Event Parsers
 * 4. Live Local HTTP Server SSE Streaming
 * 5. Markdown & Code Block Rendering (Bold, Italic, Code Blocks, Copy Buttons, Zero Emojis)
 * 6. Voice I/O Interfaces
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('====================================================');
console.log('       ROBOISLAND AI CHAT VERIFICATION SUITE        ');
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

// Import compiled main and renderer modules from dist/
const {
  AIProviderManager,
  SecureCredentialStorage,
  parseOpenAISSELine,
  parseClaudeSSELine
} = require('../dist/main/ai-provider-manager');

const {
  renderMarkdown,
  highlightSyntax,
  sanitizeHtml
} = require('../dist/renderer/island/chat-ui');

async function runTests() {
  // --------------------------------------------------------------------------
  // 1. Secure Credential Storage & Encryption
  // --------------------------------------------------------------------------
  console.log('--- 1. Testing Secure Credential Storage & DPAPI/AES-GCM Encryption ---');
  const tempVaultPath = path.join(os.tmpdir(), `roboisland-test-vault-${Date.now()}.enc`);
  const storage = new SecureCredentialStorage(tempVaultPath);

  const testKey = 'sk-proj-test1234567890abcdefghijklmnopqrstuvwxyz';
  const encResult = storage.encrypt(testKey);

  assert('Encryption produces valid cipher tag (dpapi or aes-gcm)', encResult.cipher === 'dpapi' || encResult.cipher === 'aes-gcm');
  assert('Ciphertext data is non-empty Base64', typeof encResult.data === 'string' && encResult.data.length > 20);
  assert('Ciphertext data does NOT contain plaintext API key', !encResult.data.includes(testKey));

  const decrypted = storage.decrypt(encResult.cipher, encResult.data);
  assert('Decryption perfectly restores original plaintext API key', decrypted === testKey);

  // Test full credentials vault file save and load
  const testCreds = {
    openai: { apiKey: 'sk-openai-secret-key-12345' },
    anthropic: { apiKey: 'sk-ant-claude-secret-key-67890' },
    custom: { apiKey: 'custom-local-key', baseUrl: 'http://localhost:11434/v1', model: 'llama3:8b' }
  };
  storage.saveCredentials(testCreds);
  assert('Vault file exists on disk', fs.existsSync(tempVaultPath));

  const rawDiskContent = fs.readFileSync(tempVaultPath, 'utf8');
  assert('Plaintext API keys are NEVER written to disk', !rawDiskContent.includes('sk-openai-secret-key') && !rawDiskContent.includes('sk-ant-claude'));

  const loadedCreds = storage.loadCredentials();
  assert('OpenAI credentials loaded matches original', loadedCreds.openai?.apiKey === 'sk-openai-secret-key-12345');
  assert('Anthropic credentials loaded matches original', loadedCreds.anthropic?.apiKey === 'sk-ant-claude-secret-key-67890');
  assert('Custom credentials loaded matches original', loadedCreds.custom?.baseUrl === 'http://localhost:11434/v1');

  // Test credential status masking
  const manager = new AIProviderManager(tempVaultPath);
  const status = manager.getCredentialStatus();
  assert('Credential status reports openai configured', status.openai === true);
  assert('Credential status reports anthropic configured', status.anthropic === true);
  assert('Credential status reports custom configured', status.custom === true);

  // Clean up temp vault file
  try { fs.unlinkSync(tempVaultPath); } catch {}

  // --------------------------------------------------------------------------
  // 2. Provider Configurations
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing Provider Configurations & Credentials API ---');
  const tempVault2 = path.join(os.tmpdir(), `roboisland-test-vault-2-${Date.now()}.enc`);
  const mgr2 = new AIProviderManager(tempVault2);

  const initialStatus = mgr2.getCredentialStatus();
  assert('Unconfigured openai reports false', initialStatus.openai === false);
  assert('Unconfigured anthropic reports false', initialStatus.anthropic === false);

  mgr2.saveCredential('openai', 'sk-test-live-key', undefined, 'gpt-4o');
  mgr2.saveCredential('custom', '', 'http://127.0.0.1:1234/v1', 'mistral');

  const credOpenAI = mgr2.getCredential('openai');
  assert('OpenAI model defaults or sets correctly', credOpenAI?.model === 'gpt-4o');
  assert('OpenAI key saved securely', credOpenAI?.apiKey === 'sk-test-live-key');

  const credCustom = mgr2.getCredential('custom');
  assert('Custom baseUrl saved correctly', credCustom?.baseUrl === 'http://127.0.0.1:1234/v1');
  assert('Custom model saved correctly', credCustom?.model === 'mistral');

  try { fs.unlinkSync(tempVault2); } catch {}

  // --------------------------------------------------------------------------
  // 3. SSE Protocol Event Parsers
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing SSE Protocol Parsers (OpenAI & Anthropic) ---');
  
  // OpenAI SSE Lines
  const openAIChunk1 = 'data: {"id":"chatcmpl-1","choices":[{"delta":{"content":"Hello"},"index":0}]}';
  const openAIChunk2 = 'data: {"id":"chatcmpl-2","choices":[{"delta":{"content":" world!"},"index":0}]}';
  const openAIDone = 'data: [DONE]';
  const openAIEmpty = ': keep-alive';

  assert('OpenAI parser extracts chunk 1 "Hello"', parseOpenAISSELine(openAIChunk1) === 'Hello');
  assert('OpenAI parser extracts chunk 2 " world!"', parseOpenAISSELine(openAIChunk2) === ' world!');
  assert('OpenAI parser detects [DONE] stream termination', parseOpenAISSELine(openAIDone) === '[DONE]');
  assert('OpenAI parser ignores comment lines', parseOpenAISSELine(openAIEmpty) === null);

  // Claude SSE Lines
  const claudeDelta = 'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Claude response chunk"}}';
  const claudeStop = 'data: {"type":"message_stop"}';
  const claudePing = 'event: ping\ndata: {"type": "ping"}';

  assert('Claude parser extracts text_delta', parseClaudeSSELine(claudeDelta) === 'Claude response chunk');
  assert('Claude parser detects message_stop as [DONE]', parseClaudeSSELine(claudeStop) === '[DONE]');
  assert('Claude parser ignores non-delta events', parseClaudeSSELine(claudePing) === null);

  // --------------------------------------------------------------------------
  // 4. Live Local HTTP Server SSE Streaming
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Live HTTP Server-Sent Events (SSE) Streaming ---');
  
  let sseServerReceivedRequest = false;
  const sseServer = http.createServer((req, res) => {
    if (req.url === '/v1/chat/completions' && req.method === 'POST') {
      sseServerReceivedRequest = true;
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      // Stream 3 SSE chunks
      res.write('data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n');
      setTimeout(() => {
        res.write('data: {"choices":[{"delta":{"content":"from "}}]}\n\n');
      }, 30);
      setTimeout(() => {
        res.write('data: {"choices":[{"delta":{"content":"Robo SSE!"}}]}\n\n');
      }, 60);
      setTimeout(() => {
        res.write('data: [DONE]\n\n');
        res.end();
      }, 90);
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise((resolve) => sseServer.listen(0, '127.0.0.1', resolve));
  const ssePort = sseServer.address().port;
  assert('Local SSE Test Server listening on ephemeral port', ssePort > 0);

  const streamingManager = new AIProviderManager();
  streamingManager.saveCredential('custom', 'mock-key', `http://127.0.0.1:${ssePort}/v1`, 'test-model');

  const receivedChunks = [];
  let doneCalled = false;

  const fullResult = await streamingManager.streamPrompt(
    'custom',
    'Test prompt',
    'test-model',
    (chunk) => {
      receivedChunks.push(chunk);
    },
    () => {
      doneCalled = true;
    }
  );

  assert('SSE Server received POST /v1/chat/completions', sseServerReceivedRequest);
  assert('Received all 3 token chunks in order', receivedChunks.length === 3);
  assert('Chunk 1 matches "Hello "', receivedChunks[0] === 'Hello ');
  assert('Chunk 2 matches "from "', receivedChunks[1] === 'from ');
  assert('Chunk 3 matches "Robo SSE!"', receivedChunks[2] === 'Robo SSE!');
  assert('Stream done callback was executed', doneCalled === true);
  assert('Full concatenated response string matches', fullResult === 'Hello from Robo SSE!');

  await new Promise((resolve) => sseServer.close(resolve));

  // --------------------------------------------------------------------------
  // 5. Markdown & Code Block Rendering
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Testing Streaming Markdown & Code Block Renderer ---');

  // Bold & Italic
  const mdText = 'Hello **bold world** and *italic phrase* with `inline code`';
  const htmlOut = renderMarkdown(mdText);
  assert('Bold rendered with <strong>', htmlOut.includes('<strong>bold world</strong>'));
  assert('Italics rendered with <em>', htmlOut.includes('<em>italic phrase</em>'));
  assert('Inline code rendered with <code class="inline-code">', htmlOut.includes('<code class="inline-code">inline code</code>'));

  // Lists & Quotes
  const listMd = '- First item\n- Second item\n> A thoughtful quote';
  const listHtml = renderMarkdown(listMd);
  assert('Bullet list rendered with <ul class="chat-ul">', listHtml.includes('<ul class="chat-ul">') && listHtml.includes('<li class="chat-li">First item</li>'));
  assert('Blockquote rendered with <blockquote class="chat-quote">', listHtml.includes('<blockquote class="chat-quote">A thoughtful quote</blockquote>'));

  // Code Block with Copy Code Button
  const codeBlockMd = '```typescript\nconst greeting: string = "Hello Robo";\nconsole.log(greeting);\n```';
  const codeHtml = renderMarkdown(codeBlockMd);
  assert('Code block wrapper rendered', codeHtml.includes('class="code-block-wrapper"'));
  assert('Language label rendered', codeHtml.includes('<span class="code-lang-label">typescript</span>'));
  assert('Copy code button rendered', codeHtml.includes('class="btn-copy-code"'));
  assert('Copy code button contains encoded raw data', codeHtml.includes('data-code="const%20greeting%3A%20string%20%3D%20%22Hello%20Robo%22%3B%0Aconsole.log(greeting)%3B"'));
  assert('Syntax highlighting keyword span rendered', codeHtml.includes('<span class="syn-kw">const</span>'));
  assert('Syntax highlighting string span rendered', codeHtml.includes('<span class="syn-str">&quot;Hello Robo&quot;</span>'));
  assert('Syntax highlighting function call span rendered', codeHtml.includes('<span class="syn-fn">log</span>'));

  // Zero-Emoji Verification
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert('Rendered HTML contains exactly ZERO emoji characters', !emojiRegex.test(codeHtml) && !emojiRegex.test(listHtml));

  // --------------------------------------------------------------------------
  // 6. Voice I/O Interfaces
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Testing Voice I/O Interfaces (Voice Typing & TTS) ---');
  
  assert('AIProviderManager has triggerVoiceTyping method', typeof streamingManager.triggerVoiceTyping === 'function');
  assert('AIProviderManager has speakTTS method', typeof streamingManager.speakTTS === 'function');

  const emptyTtsResult = await streamingManager.speakTTS('');
  assert('speakTTS handles empty string gracefully', emptyTtsResult.success === true);

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
