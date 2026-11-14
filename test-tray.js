const { app, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
  const p = path.resolve('assets/icon.png');
  console.log('Path:', p, 'exists:', fs.existsSync(p));
  const img = nativeImage.createFromPath(p);
  console.log('Image isEmpty:', img.isEmpty(), 'size:', JSON.stringify(img.getSize()));
  try {
    const tray = new Tray(img.resize({ width: 16, height: 16 }));
    console.log('Tray created successfully!');
    tray.setToolTip('Test RoboIsland');
    console.log('Tooltip set successfully!');
  } catch (e) {
    console.error('Tray error:', e);
  }
  setTimeout(() => app.quit(), 1000);
});
