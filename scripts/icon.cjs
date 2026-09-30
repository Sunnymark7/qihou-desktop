const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
function crc32(buf) { let c = 0xffffffff; for (const b of buf) { c ^= b; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const t = Buffer.from(type), n = Buffer.alloc(4), crc = Buffer.alloc(4); n.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([n, t, data, crc]); }
const size = 64, raw = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const i = y * (size * 4 + 1) + 1 + x * 4;
  const inside = Math.hypot(Math.max(0, Math.abs(x - 31.5) - 18), Math.max(0, Math.abs(y - 31.5) - 18)) < 13;
  let c = [44, 83, 71, inside ? 255 : 0];
  if (Math.hypot(x - 39, y - 24) < 10) c = [243, 203, 113, 255];
  if (Math.hypot(x - 24, y - 34) < 9 || Math.hypot(x - 33, y - 31) < 11 || Math.hypot(x - 42, y - 37) < 8 || (x > 23 && x < 44 && y > 33 && y < 44)) c = [246, 249, 244, 255];
  c.forEach((v, j) => raw[i + j] = v);
}
const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
const dir = path.join(__dirname, '../assets'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'icon.png'), png);
const ico = Buffer.alloc(22); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4); ico[6] = size; ico[7] = size; ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(dir, 'icon.ico'), Buffer.concat([ico, png]));
