import fs from "node:fs";
import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS_BY_COLOR_TYPE = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const MAX_DECODED_BYTES = 64 * 1024 * 1024;

function validBitDepth(colorType, bitDepth) {
  const supported = {
    0: [1, 2, 4, 8, 16],
    2: [8, 16],
    3: [1, 2, 4, 8],
    4: [8, 16],
    6: [8, 16],
  };
  return supported[colorType]?.includes(bitDepth) ?? false;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function parsePng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 57 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("must be a PNG with a valid signature");
  let offset = 8;
  let ihdrCount = 0;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let foundIend = false;
  const idatChunks = [];
  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) throw new Error("is truncated before a complete PNG chunk");
    const length = buffer.readUInt32BE(offset);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + length;
    if (chunkEnd + 4 > buffer.length) throw new Error("is truncated inside a PNG chunk");
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (crc32(buffer.subarray(offset + 4, chunkEnd)) !== buffer.readUInt32BE(chunkEnd)) throw new Error(`has an invalid ${type} CRC`);
    if (type === "IHDR") {
      ihdrCount += 1;
      if (ihdrCount !== 1 || offset !== 8 || length !== 13) throw new Error("has an invalid or duplicate IHDR chunk");
      width = buffer.readUInt32BE(chunkStart);
      height = buffer.readUInt32BE(chunkStart + 4);
      bitDepth = buffer[chunkStart + 8];
      colorType = buffer[chunkStart + 9];
      interlace = buffer[chunkStart + 12];
      if (width < 1 || height < 1 || !validBitDepth(colorType, bitDepth) || buffer[chunkStart + 10] !== 0 || buffer[chunkStart + 11] !== 0 || interlace !== 0) throw new Error("has unsupported PNG header encoding");
    }
    if (type === "IDAT") idatChunks.push(buffer.subarray(chunkStart, chunkEnd));
    if (type === "IEND") {
      if (length !== 0) throw new Error("has an invalid IEND chunk");
      foundIend = true;
      if (chunkEnd + 4 !== buffer.length) throw new Error("has data after IEND");
      break;
    }
    offset = chunkEnd + 4;
  }
  if (ihdrCount !== 1 || !foundIend || idatChunks.length === 0) throw new Error("is missing a complete PNG header, image data, or IEND chunk");
  const channels = CHANNELS_BY_COLOR_TYPE[colorType];
  const expectedLength = (Math.ceil((width * channels * bitDepth) / 8) + 1) * height;
  if (!Number.isSafeInteger(expectedLength) || expectedLength < 1 || expectedLength > MAX_DECODED_BYTES) throw new Error("has unsafe decompressed image dimensions");
  let decoded;
  try { decoded = inflateSync(Buffer.concat(idatChunks), { maxOutputLength: expectedLength + 1 }); } catch { throw new Error("has invalid, oversized, or compressed-bomb image data"); }
  if (decoded.length !== expectedLength) throw new Error("has unexpected decompressed image dimensions");
  return { width, height };
}

export function readPng(filePath, maximumBytes = Number.POSITIVE_INFINITY) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("must be a regular, non-symlink PNG file");
  if (!(maximumBytes === Number.POSITIVE_INFINITY || (Number.isFinite(maximumBytes) && maximumBytes >= 1)) || stat.size > maximumBytes) throw new Error(`exceeds the ${maximumBytes} byte size limit`);
  return parsePng(fs.readFileSync(filePath));
}
