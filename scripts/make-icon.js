const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const assetsDir = path.resolve(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

// Generate a valid PNG buffer using basic PNG encoder or pure JS
function createRoboPng(size) {
  // We can write a 32-bit RGBA uncompressed IDAT raw PNG
  const zlib = require('zlib');
  const width = size;
  const height = size;

  const rawData = Buffer.alloc(height * (width * 4 + 1));
  const cx = width / 2;
  const cy = height / 2;

  let pos = 0;
  for (let y = 0; y < height; y++) {
    rawData[pos++] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Cute robotic helmet shape
      const inHead = Math.abs(dx) <= width * 0.38 && Math.abs(dy - 4) <= height * 0.32;
      const isAntenna = Math.abs(dx) <= 2 && dy <= -height * 0.32 && dy >= -height * 0.45;
      const isAntennaTip = Math.hypot(dx, dy - (-height * 0.46)) <= 5;
      const isLeftEye = Math.abs(dx - (-width * 0.16)) <= 6 && Math.abs(dy - 2) <= 10;
      const isRightEye = Math.abs(dx - (width * 0.16)) <= 6 && Math.abs(dy - 2) <= 10;

      if (isLeftEye || isRightEye) {
        // Glowing cyan eye (#00ffff)
        rawData[pos++] = 0;
        rawData[pos++] = 255;
        rawData[pos++] = 255;
        rawData[pos++] = 255;
      } else if (isAntenna || isAntennaTip) {
        // Accent cyan
        rawData[pos++] = 0;
        rawData[pos++] = 210;
        rawData[pos++] = 255;
        rawData[pos++] = 255;
      } else if (inHead) {
        // Dark titanium body
        rawData[pos++] = 22;
        rawData[pos++] = 25;
        rawData[pos++] = 34;
        rawData[pos++] = 255;
      } else {
        // Transparent
        rawData[pos++] = 0;
        rawData[pos++] = 0;
        rawData[pos++] = 0;
        rawData[pos++] = 0;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    // Simple CRC32
    const crcVal = crc32(Buffer.concat([t, data]));
    crc.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, t, data, crc]);
  }

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const png256 = createRoboPng(256);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), png256);

// Create valid Windows .ico file with the PNG image
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // Reserved
icoHeader.writeUInt16LE(1, 2); // Icon
icoHeader.writeUInt16LE(1, 4); // 1 Image

const icoEntry = Buffer.alloc(16);
icoEntry[0] = 0; // 256 width
icoEntry[1] = 0; // 256 height
icoEntry[2] = 0; // color count
icoEntry[3] = 0; // reserved
icoEntry.writeUInt16LE(1, 4); // planes
icoEntry.writeUInt16LE(32, 6); // bit count
icoEntry.writeUInt32LE(png256.length, 8); // size
icoEntry.writeUInt32LE(22, 12); // offset (6 + 16 = 22)

const icoFile = Buffer.concat([icoHeader, icoEntry, png256]);
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), icoFile);

console.log('[RoboIsland] assets/icon.png and assets/icon.ico generated successfully.');
