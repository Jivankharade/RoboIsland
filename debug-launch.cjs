const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const electronExe = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');
console.log('Electron exe:', electronExe, '| exists:', require('fs').existsSync(electronExe));

const p = spawn(electronExe, ['.', '--enable-logging', '--log-level=0'], {
  cwd: __dirname,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1', ELECTRON_LOG_ASAR_READS: '1' }
});

let out = '';
p.stdout.on('data', d => { out += d; process.stdout.write('[STDOUT] ' + d); });
p.stderr.on('data', d => { out += d; process.stdout.write('[STDERR] ' + d); });
p.on('exit', (code) => {
  console.log('\n[EXIT CODE]:', code, '(0x' + (code >>> 0).toString(16) + ')');
  fs.writeFileSync('debug-output.txt', out);
  process.exit(0);
});

setTimeout(() => {
  console.log('[TIMEOUT] Still running, killing...');
  p.kill();
}, 12000);
