import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { test } from "node:test";
import { deflateSync } from "node:zlib";
import { buildCodexImageArguments, generateBoxArt, getBoxArtPublicationLeaseInfo, publishBoxArt, recoverPendingBoxArtPublication } from "../lib/box-art/pipeline";
import { getBoxArtFormat } from "../lib/box-art/formats";

function checksum(filePath: string) {
  return `sha256:${createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, content: Buffer) {
  const chunkBuffer = Buffer.alloc(12 + content.length);
  chunkBuffer.writeUInt32BE(content.length, 0);
  chunkBuffer.write(type, 4, "ascii");
  content.copy(chunkBuffer, 8);
  chunkBuffer.writeUInt32BE(crc32(chunkBuffer.subarray(4, 8 + content.length)), 8 + content.length);
  return chunkBuffer;
}

function png(width: number, height: number) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const pixels = Buffer.alloc((width * 4 + 1) * height);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
}

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gameatlas-box-art-"));
  const draftDir = path.join(root, "artifacts/box-art/sample-game/draft-fixture");
  fs.mkdirSync(path.join(root, "data/games"), { recursive: true });
  fs.mkdirSync(path.join(root, "public"), { recursive: true });
  fs.mkdirSync(draftDir, { recursive: true });
  const game = { slug: "sample-game", title: "Sample Game", platforms: ["nintendo-switch"], assets: [] };
  fs.writeFileSync(path.join(root, "data/games/sample-game.json"), `${JSON.stringify(game, null, 2)}\n`);
  fs.writeFileSync(path.join(root, "data/assets-manifest.json"), `${JSON.stringify({ schemaVersion: 1, assets: [] }, null, 2)}\n`);
  const imagePath = path.join(draftDir, "front.png");
  const format = getBoxArtFormat("cartridge-portrait");
  if (!format) throw new Error("missing fixture format");
  fs.writeFileSync(imagePath, png(format.image.width, format.image.height));
  const draft = {
    schemaVersion: 1,
    slug: "sample-game",
    title: "Sample Game",
    formatId: format.id,
    prompt: "Original abstract faceted night landscape with a calm upward path.",
    provider: "codex",
    quality: "low",
    generatedAt: "2026-08-15",
    assetFile: "front.png",
    checksum: checksum(imagePath),
    pixelWidth: format.image.width,
    pixelHeight: format.image.height,
    modelOrTool: "codex-image fixture (codex provider)",
  };
  fs.writeFileSync(path.join(draftDir, "draft.json"), `${JSON.stringify(draft, null, 2)}\n`);
  return { root, draftPath: "artifacts/box-art/sample-game/draft-fixture/draft.json", imagePath };
}

const approval = "I reviewed this exact asset and confirm it contains no recreated official box art, no logos, no characters, and no screenshots.";

test("publishes only a checksum-bound draft and adds matching catalog provenance", async () => {
  const fixture = fixtureRoot();
  try {
    const result = await publishBoxArt({ root: fixture.root, draftPath: fixture.draftPath, reviewedBy: "fixture review", approvalNote: approval });
    assert.equal(result.assetPath, "public/assets/games/sample-game/front-cartridge-portrait.png");
    assert.ok(fs.existsSync(path.join(fixture.root, result.assetPath ?? "")));
    const manifest = JSON.parse(fs.readFileSync(path.join(fixture.root, "data/assets-manifest.json"), "utf8"));
    assert.equal(manifest.assets[0].contentChecksum, checksum(path.join(fixture.root, result.assetPath ?? "")));
    assert.equal(manifest.assets[0].boxFormatId, "cartridge-portrait");
    const game = JSON.parse(fs.readFileSync(path.join(fixture.root, "data/games/sample-game.json"), "utf8"));
    assert.deepEqual(game.assets[0], { path: result.assetPath, alt: manifest.assets[0].altText, provenanceId: result.provenanceId, role: "box-front", boxFormatId: "cartridge-portrait" });
    assert.equal(fs.existsSync(path.join(fixture.root, "artifacts/box-art/.publish-journal.json")), false);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("rolls back caught publish failures and can recover a pending transaction", async () => {
  const fixture = fixtureRoot();
  try {
    const originalManifest = fs.readFileSync(path.join(fixture.root, "data/assets-manifest.json"), "utf8");
    const originalGame = fs.readFileSync(path.join(fixture.root, "data/games/sample-game.json"), "utf8");
    await assert.rejects(() => publishBoxArt({ root: fixture.root, draftPath: fixture.draftPath, reviewedBy: "fixture review", approvalNote: approval, failureInjector: (stage) => { if (stage === "after-manifest") throw new Error("injected failure"); } }), /injected failure/);
    const target = path.join(fixture.root, "public/assets/games/sample-game/front-cartridge-portrait.png");
    assert.equal(fs.existsSync(target), false);
    assert.equal(fs.readFileSync(path.join(fixture.root, "data/assets-manifest.json"), "utf8"), originalManifest);
    assert.equal(fs.readFileSync(path.join(fixture.root, "data/games/sample-game.json"), "utf8"), originalGame);

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(fixture.imagePath, target);
    fs.writeFileSync(path.join(fixture.root, "data/assets-manifest.json"), "mutated\n");
    fs.writeFileSync(path.join(fixture.root, "data/games/sample-game.json"), "mutated\n");
    fs.writeFileSync(path.join(fixture.root, "artifacts/box-art/.publish-journal.json"), `${JSON.stringify({ schemaVersion: 1, imagePath: "public/assets/games/sample-game/front-cartridge-portrait.png", manifestPath: "data/assets-manifest.json", gamePath: "data/games/sample-game.json", manifestBefore: Buffer.from(originalManifest).toString("base64"), gameBefore: Buffer.from(originalGame).toString("base64") })}\n`);
    assert.equal(await recoverPendingBoxArtPublication(fixture.root), true);
    assert.equal(fs.existsSync(target), false);
    assert.equal(fs.readFileSync(path.join(fixture.root, "data/assets-manifest.json"), "utf8"), originalManifest);
    assert.equal(fs.readFileSync(path.join(fixture.root, "data/games/sample-game.json"), "utf8"), originalGame);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("dry run uses a controlled external directory and preserves the repository", () => {
  const fixture = fixtureRoot();
  const fakeCli = path.join(fixture.root, "fake-codex-image.mjs");
  fs.writeFileSync(fakeCli, `#!/usr/bin/env node\nimport path from "node:path";\nconst args = process.argv.slice(2); const output = args[args.indexOf("--output-dir") + 1]; console.log(JSON.stringify({ ok: true, status: "dry_run", outputs: [path.join(output, "front.png")] }));\n`);
  fs.chmodSync(fakeCli, 0o755);
  try {
    const result = generateBoxArt({ root: fixture.root, slug: "sample-game", brief: "Original luminous geological forms rising through a quiet midnight sky.", dryRun: true, command: fakeCli });
    assert.equal(result.dryRun, true);
    assert.equal(fs.existsSync(path.join(fixture.root, "artifacts/box-art")), true, "fixture draft directory pre-exists only because the test fixture created it");
    assert.equal(fs.existsSync(path.join(fixture.root, "artifacts/box-art/sample-game/draft-fixture/draft.json")), true);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("builds a fixed non-shell Codex Image argument vector", () => {
  const format = getBoxArtFormat("cartridge-portrait");
  if (!format) throw new Error("missing fixture format");
  const args = buildCodexImageArguments({ prompt: "original art", provider: "codex", outputDirectory: "/tmp/controlled", format, quality: "low", timeoutSeconds: 180, dryRun: true });
  assert.deepEqual(args.slice(0, 8), ["generate", "--prompt", "original art", "--provider", "codex", "--output-dir", "/tmp/controlled", "--name"]);
  assert.ok(args.includes("--dry-run"));
  assert.equal(args.at(-1), "--json");
});


test("rejects normalized-path escapes from staged draft input", async () => {
  const fixture = fixtureRoot();
  try {
    await assert.rejects(() => publishBoxArt({ root: fixture.root, draftPath: "artifacts/box-art/../../data/assets-manifest.json", reviewedBy: "fixture review", approvalNote: approval }), /normalized path under artifacts/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});


test("requires the exact review attestation and rejects secret-bearing staged provenance", async () => {
  const fixture = fixtureRoot();
  try {
    await assert.rejects(() => publishBoxArt({ root: fixture.root, draftPath: fixture.draftPath, reviewedBy: "fixture review", approvalNote: "Not reviewed, but no recreated official box art, no logos, no characters, and no screenshots." }), /exactly equal/);
    const draftFile = path.join(fixture.root, fixture.draftPath);
    const draft = JSON.parse(fs.readFileSync(draftFile, "utf8"));
    draft.prompt = "Original abstract light forms sk-abcdefghijklmnopqrstuvwxyz123456";
    fs.writeFileSync(draftFile, `${JSON.stringify(draft, null, 2)}\n`);
    await assert.rejects(() => publishBoxArt({ root: fixture.root, draftPath: fixture.draftPath, reviewedBy: "fixture review", approvalNote: approval }), /credential-like/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});


test("uses a kernel-owned lease to serialize publishers and releases it after a crash", async () => {
  const fixture = fixtureRoot();
  const lease = getBoxArtPublicationLeaseInfo(fixture.root);
  const child = spawn(process.execPath, ["-e", `const net = require("node:net"); const port = Number(process.argv[1]); const repoId = process.argv[2]; const server = net.createServer((socket) => socket.end(JSON.stringify({ schemaVersion: 1, repoId, owner: "other-process", pid: process.pid, acquiredAt: new Date().toISOString() }))); server.listen({ host: "127.0.0.1", port, exclusive: true }, () => process.stdout.write("ready")); setTimeout(() => {}, 60000);`, String(lease.port), lease.repoId], { stdio: ["ignore", "pipe", "ignore"] });
  try {
    await once(child.stdout, "data");
    await assert.rejects(() => publishBoxArt({ root: fixture.root, draftPath: fixture.draftPath, reviewedBy: "fixture review", approvalNote: approval }), /holds the repository lease/);
    child.kill("SIGKILL");
    await once(child, "close");
    const result = await publishBoxArt({ root: fixture.root, draftPath: fixture.draftPath, reviewedBy: "fixture review", approvalNote: approval });
    assert.equal(result.provenanceId, "game-sample-game-box-front-cartridge-portrait");
  } finally {
    if (!child.killed) child.kill("SIGKILL");
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});
