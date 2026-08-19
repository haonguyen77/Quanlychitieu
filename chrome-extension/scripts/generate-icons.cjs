/**
 * Generate placeholder PNG icons for Chrome Extension.
 * Creates simple colored squares as icons.
 * Run: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Minimal PNG file generator (creates solid color square)
function createPNG(size, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);  // width
  ihdrData.writeUInt32BE(size, 4);  // height
  ihdrData.writeUInt8(8, 8);        // bit depth
  ihdrData.writeUInt8(2, 9);        // color type (RGB)
  ihdrData.writeUInt8(0, 10);       // compression
  ihdrData.writeUInt8(0, 11);       // filter
  ihdrData.writeUInt8(0, 12);       // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk - raw image data
  // Each row: filter byte (0) + RGB pixels
  const rowSize = 1 + size * 3;
  const rawData = Buffer.alloc(rowSize * size);

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // filter: none

    for (let x = 0; x < size; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      
      // Create a simple gradient/logo-like pattern
      const cx = x - size / 2;
      const cy = y - size / 2;
      const dist = Math.sqrt(cx * cx + cy * cy);
      const maxDist = size / 2;

      if (dist < maxDist * 0.7) {
        // Inner circle - primary color
        rawData[pixelOffset] = r;
        rawData[pixelOffset + 1] = g;
        rawData[pixelOffset + 2] = b;
      } else if (dist < maxDist * 0.85) {
        // Ring
        rawData[pixelOffset] = Math.min(255, r + 40);
        rawData[pixelOffset + 1] = Math.min(255, g + 40);
        rawData[pixelOffset + 2] = Math.min(255, b + 40);
      } else {
        // Background - transparent white
        rawData[pixelOffset] = 240;
        rawData[pixelOffset + 1] = 240;
        rawData[pixelOffset + 2] = 245;
      }
    }
  }

  // Compress with zlib (deflate)
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate icons
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const sizes = [16, 48, 128];
// Blue color matching the primary brand color (#3b82f6)
const [r, g, b] = [59, 130, 246];

for (const size of sizes) {
  const png = createPNG(size, r, g, b);
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Created: icon${size}.png (${png.length} bytes)`);
}

console.log('Done! Icons generated in public/icons/');
