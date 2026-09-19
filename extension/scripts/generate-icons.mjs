#!/usr/bin/env node
/** Rebuild the PNG action icons (no extra deps). */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let i = 0; i < 8; i += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(tag, data) {
  const tagBuf = Buffer.from(tag);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tagBuf, data])));
  return Buffer.concat([len, tagBuf, data, crc]);
}

function png(size) {
  const raw = [];
  const cx = (size - 1) / 2;
  for (let y = 0; y < size; y += 1) {
    raw.push(0);
    for (let x = 0; x < size; x += 1) {
      const nx = (x - cx) / cx;
      const ny = (y - cx) / cx;
      const ax = Math.abs(nx);
      const ay = Math.abs(ny);
      const inside = ax < 0.78 && ay < 0.78 && ax ** 4 + ay ** 4 < 0.55;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      if (inside) {
        r = 255;
        g = 92;
        b = 92;
        a = 255;
        if (ax < 0.18 && ny > -0.35 && ny < 0.28) {
          r = 20;
          g = 8;
          b = 10;
        }
        if (ax < 0.1 && ny > 0.38 && ny < 0.52) {
          r = 20;
          g = 8;
          b = 10;
        }
      }
      raw.push(r, g, b, a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.from(raw), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "icons");
for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(dir, `icon${size}.png`), png(size));
}
console.log("wrote icons");
