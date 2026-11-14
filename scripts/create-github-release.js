const fs = require('fs');
const path = require('path');

const credsPath = 'C:/Users/hp218/.git-credentials';
if (!fs.existsSync(credsPath)) {
  console.error('Git credentials not found');
  process.exit(1);
}

const creds = fs.readFileSync(credsPath, 'utf8').trim();
const match = creds.match(/https?:\/\/[^:]+:([^@]+)@/);
const token = match ? match[1] : null;

if (!token) {
  console.error('No GitHub token extracted');
  process.exit(1);
}

async function main() {
  console.log('[RoboIsland Publisher] Creating GitHub Release v1.0.0...');
  const releasePayload = {
    tag_name: 'v1.0.0',
    target_commitish: 'main',
    name: 'RoboIsland v1.0.0 - Official Launch',
    body: [
      '# RoboIsland v1.0.0',
      '',
      'The Intelligent Dynamic Island & AI Companion for Windows & Linux (Fedora KDE/GNOME).',
      '',
      '## Highlights',
      '- **Apple-Grade Hardware HUD**: Live 240-degree speedometer rings for RAM, SSD/HDD storage, and CPU.',
      '- **Local AirDrop & Phone QR Drop**: Instant direct Wi-Fi file transfer over port 48912 with no cloud accounts.',
      '- **Apple Quick Look (Spacebar)**: Frosted-glass preview modal for images, code syntax, documents, and media.',
      '- **Native Two-Way Drag-and-Drop**: Drag files directly into the tray or out into Explorer / Dolphin.',
      '- **Spotify PKCE & Live Lyrics**: Full playback controls and line-by-line synced lyrics.',
      '- **Multi-Provider AI Mascot**: Reactive procedural vector mascot connected to Claude, OpenAI, and Gemini.',
      '- **Owner Edition & Customer License Generator**: Built-in cryptographic license generator.',
      '',
      '## Downloads',
      '- **Windows 10 / 11**: Download `RoboIsland-Setup-1.0.0.exe` below and run the installer.',
      '- **Linux (Fedora KDE/GNOME)**: Clone and run `npm run dist:rpm` or `npm run dist:appimage`.'
    ].join('\n'),
    draft: false,
    prerelease: false
  };

  const createRes = await fetch('https://api.github.com/repos/Jivankharade/RoboIsland/releases', {
    method: 'POST',
    headers: {
      'Authorization': 'token ' + token,
      'User-Agent': 'RoboIsland-Publisher',
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(releasePayload)
  });

  const releaseData = await createRes.json();
  if (createRes.status !== 201 && createRes.status !== 200) {
    console.error('Failed to create release:', createRes.status, releaseData);
    process.exit(1);
  }

  console.log('[RoboIsland Publisher] Release created successfully!');
  console.log('Release URL:', releaseData.html_url);

  // Upload Windows Installer Asset
  const installerPath = 'C:/Users/hp218/Downloads/RoboIsland-Setup-1.0.0.exe';
  if (!fs.existsSync(installerPath)) {
    console.warn('Installer file not found at', installerPath);
    return;
  }

  const stat = fs.statSync(installerPath);
  console.log(`[RoboIsland Publisher] Uploading ${path.basename(installerPath)} (${(stat.size / 1024 / 1024).toFixed(1)} MB)...`);

  const uploadUrl = releaseData.upload_url.replace('{?name,label}', '?name=RoboIsland-Setup-1.0.0.exe');
  const fileStream = fs.createReadStream(installerPath);

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': 'token ' + token,
      'User-Agent': 'RoboIsland-Publisher',
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(stat.size)
    },
    body: fileStream,
    duplex: 'half'
  });

  if (uploadRes.ok) {
    const assetData = await uploadRes.json();
    console.log('[RoboIsland Publisher] Windows Installer uploaded successfully!');
    console.log('Download URL:', assetData.browser_download_url);
  } else {
    console.error('Failed to upload asset:', uploadRes.status, await uploadRes.text());
  }
}

main().catch(err => {
  console.error('[RoboIsland Publisher] Error:', err);
});
