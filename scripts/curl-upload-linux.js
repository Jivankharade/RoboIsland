const fs = require('fs');
const { spawn } = require('child_process');

const credsPath = 'C:/Users/hp218/.git-credentials';
const creds = fs.readFileSync(credsPath, 'utf8').trim();
const match = creds.match(/https?:\/\/[^:]+:([^@]+)@/);
const token = match ? match[1] : null;

async function main() {
  const filePath = 'C:/Users/hp218/.gemini/antigravity/scratch/RoboIsland/release/roboisland-1.0.0.tar.gz';
  const stat = fs.statSync(filePath);
  console.log(`[Linux Asset Uploader] Uploading ${filePath} (${(stat.size / 1024 / 1024).toFixed(1)} MB)...`);

  const relRes = await fetch('https://api.github.com/repos/Jivankharade/RoboIsland/releases/tags/v1.0.0', {
    headers: { 'Authorization': 'token ' + token, 'User-Agent': 'RoboIsland-Publisher' }
  });
  const rel = await relRes.json();
  const uploadUrl = rel.upload_url.replace('{?name,label}', '?name=roboisland-1.0.0-linux-x64.tar.gz');

  console.log('[Linux Asset Uploader] Calling curl.exe...');
  const child = spawn('curl.exe', [
    '-#',
    '-L',
    '-X', 'POST',
    '-H', `Authorization: token ${token}`,
    '-H', 'Content-Type: application/octet-stream',
    '--data-binary', `@${filePath}`,
    uploadUrl
  ], {
    stdio: 'inherit'
  });

  child.on('close', (code) => {
    console.log('[Linux Asset Uploader] Finished with exit code:', code);
  });
}

main().catch(console.error);
