import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { deflateSync } from "node:zlib";
import { parsePng, readPng } from "../lib/box-art/png.mjs";

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, content) {
  const output = Buffer.alloc(12 + content.length);
  output.writeUInt32BE(content.length, 0);
  output.write(type, 4, "ascii");
  content.copy(output, 8);
  output.writeUInt32BE(crc32(output.subarray(4, 8 + content.length)), 8 + content.length);
  return output;
}

function png(width, height, rawPixels = Buffer.alloc((width * 4 + 1) * height)) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(rawPixels)), chunk("IEND", Buffer.alloc(0))]);
}

test("accepts a complete PNG with the declared dimensions", () => {
  assert.deepEqual(parsePng(png(2, 3)), { width: 2, height: 3 });
});

test("caps decompression before a compressed PNG can exceed declared dimensions", () => {
  assert.throws(() => parsePng(png(1, 1, Buffer.alloc(2 * 1024 * 1024))), /oversized|compressed-bomb|unexpected decompressed/);
});

test("checks the regular-file size before reading PNG data", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gameatlas-png-"));
  const filePath = path.join(directory, "oversized.png");
  try {
    fs.writeFileSync(filePath, Buffer.alloc(33));
    assert.throws(() => readPng(filePath, 32), /size limit/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
