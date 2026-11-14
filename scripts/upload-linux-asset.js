const fs = require('fs');
const path = require('path');

const credsPath = 'C:/Users/hp218/.git-credentials';
const creds = fs.readFileSync(credsPath, 'utf8').trim();
const match = creds.match(/https?:\/\/[^:]+:([^@]+)@/);
const token = match ? match[1] : null;

async function uploadLinux() {
  const filePath = 'C:/Users/hp218/.gemini/antigravity/scratch/RoboIsland/release/roboisland-1.0.0.tar.gz';
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  const stat = fs.statSync(filePath);
  console.log(`[Upload Linux] Found ${path.basename(filePath)} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);

  const relRes = await fetch('https://api.github.com/repos/Jivankharade/RoboIsland/releases/tags/v1.0.0', {
    headers: { 'Authorization': 'token ' + token, 'User-Agent': 'RoboIsland-Publisher' }
  });

  if (!relRes.ok) {
    console.error('Failed to get release:', relRes.status);
    process.exit(1);
  }

  const releaseData = await relRes.json();
  const uploadUrl = releaseData.upload_url.replace('{?name,label}', '?name=roboisland-1.0.0-linux-x64.tar.gz');

  console.log('[Upload Linux] Uploading to GitHub Release...');
  const fileStream = fs.createReadStream(filePath);

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': 'token ' + token,
      'User-Agent': 'RoboIsland-Publisher',
      'Content-Type': 'application/gzip',
      'Content-Length': String(stat.size)
    },
    body: fileStream,
    duplex: 'half'
  });

  if (uploadRes.ok) {
    const data = await uploadRes.json();
    console.log('[Upload Linux] SUCCESS! Download URL:', data.browser_download_url);
  } else {
    console.error('Failed to upload:', uploadRes.status, await uploadRes.text());
  }
}

uploadLinux().catch(console.error);
