/**
 * RoboIsland 2.0 - E2E Testing Shared Harness
 * Provides assertions, HTTP test clients, mathematical invariants,
 * temp filesystem isolations, and reporting structures.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const os = require('os');

class AssertionError extends Error {
  constructor(message, actual, expected) {
    super(message);
    this.name = 'AssertionError';
    this.actual = actual;
    this.expected = expected;
  }
}

function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new AssertionError(message, condition, true);
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    const msg = message ? `${message} (Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})` : `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
    throw new AssertionError(msg, actual, expected);
  }
}

function assertNotEqual(actual, expected, message = '') {
  if (actual === expected) {
    const msg = message ? `${message} (Expected value not to equal ${JSON.stringify(expected)})` : `Expected value not to equal ${JSON.stringify(expected)}`;
    throw new AssertionError(msg, actual, expected);
  }
}

function assertDeepEqual(actual, expected, message = '') {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    const msg = message ? `${message} (Deep equality mismatch)` : `Deep equality mismatch:\nActual:   ${actualStr}\nExpected: ${expectedStr}`;
    throw new AssertionError(msg, actual, expected);
  }
}

function assertMatch(actual, regex, message = '') {
  if (!regex.test(String(actual))) {
    const msg = message ? `${message} (Value ${JSON.stringify(actual)} did not match regex ${regex})` : `Value ${JSON.stringify(actual)} did not match regex ${regex}`;
    throw new AssertionError(msg, actual, regex);
  }
}

function assertRoughlyEqual(actual, expected, delta = 0.01, message = '') {
  if (Math.abs(actual - expected) > delta) {
    const msg = message ? `${message} (${actual} not within ±${delta} of ${expected})` : `${actual} not within ±${delta} of ${expected}`;
    throw new AssertionError(msg, actual, expected);
  }
}

function assertThrows(fn, message = 'Expected function to throw') {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
  }
  if (!threw) {
    throw new AssertionError(message, false, true);
  }
}

async function assertRejects(asyncFn, message = 'Expected promise to reject') {
  let threw = false;
  try {
    await asyncFn();
  } catch (err) {
    threw = true;
  }
  if (!threw) {
    throw new AssertionError(message, false, true);
  }
}

// HTTP request helper for localhost testing
function sendHttpRequest({ method = 'GET', url, headers = {}, body = null, timeout = 3000 }) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const reqHeaders = { ...headers };
    let payload = null;

    if (body !== null) {
      if (typeof body === 'object' && !Buffer.isBuffer(body)) {
        payload = JSON.stringify(body);
        if (!reqHeaders['Content-Type']) {
          reqHeaders['Content-Type'] = 'application/json';
        }
      } else {
        payload = body;
      }
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const options = {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      method,
      headers: reqHeaders,
      timeout
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data,
          json
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`HTTP request timed out after ${timeout}ms`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

// Temporary directory management
function createTempDir(prefix = 'robo-test-') {
  const dir = path.join(os.tmpdir(), `${prefix}${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function removeTempDir(dir) {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch {}
}

// RFC 7636 PKCE Mathematical Validators
function generatePkceVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function derivePkceChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// Spring Physics Simulation Helper (matching Apple-style damped spring)
function simulateSpring({
  from = 116,
  to = 32,
  initialVelocity = 0,
  stiffness = 280,
  damping = 26,
  mass = 1,
  dt = 1 / 60,
  maxSteps = 240
}) {
  let pos = from;
  let vel = initialVelocity;
  const history = [pos];

  for (let i = 0; i < maxSteps; i++) {
    const springForce = -stiffness * (pos - to);
    const dampingForce = -damping * vel;
    const accel = (springForce + dampingForce) / mass;
    vel += accel * dt;
    pos += vel * dt;
    history.push(pos);

    if (Math.abs(pos - to) < 0.05 && Math.abs(vel) < 0.05) {
      pos = to;
      history.push(pos);
      break;
    }
  }

  return {
    finalPos: pos,
    steps: history.length,
    converged: Math.abs(pos - to) < 0.1,
    history
  };
}

module.exports = {
  assert,
  assertEqual,
  assertNotEqual,
  assertDeepEqual,
  assertMatch,
  assertRoughlyEqual,
  assertThrows,
  assertRejects,
  sendHttpRequest,
  createTempDir,
  removeTempDir,
  generatePkceVerifier,
  derivePkceChallenge,
  simulateSpring
};
