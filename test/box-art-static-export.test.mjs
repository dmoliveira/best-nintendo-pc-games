import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { validateGameArtExport } from "../lib/box-art/static-export.mjs";

const basePath = "/best-nintendo-pc-games";
const asset = {
  path: "public/assets/games/sample-game/front-cartridge-portrait.png",
  alt: "Original GameAtlas editorial front artwork for Sample Game.",
  provenanceId: "game-sample-game-box-front-cartridge-portrait",
  role: "box-front",
  boxFormatId: "cartridge-portrait",
};
const manifest = { assetId: asset.provenanceId, path: asset.path };

test("accepts a box-only page without requiring separate scene art", () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "gameatlas-export-"));
  try {
    const outputAsset = path.join(outDir, "assets/games/sample-game/front-cartridge-portrait.png");
    fs.mkdirSync(path.dirname(outputAsset), { recursive: true });
    fs.writeFileSync(outputAsset, "fixture");
    const game = { assets: [asset] };
    const gameHtml = `<img src="${basePath}/assets/games/sample-game/front-cartridge-portrait.png">`;
    assert.deepEqual(validateGameArtExport({ game, gameHtml, outDir, assetById: new Map([[asset.provenanceId, manifest]]), expectedBasePath: basePath }), []);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test("requires separate scene art only when a non-box asset exists", () => {
  const generic = { path: "public/assets/games/sample-game.svg", alt: "Abstract editorial tile", provenanceId: "tile" };
  const failures = validateGameArtExport({ game: { assets: [asset, generic] }, gameHtml: `<img src="${basePath}/assets/games/sample-game/front-cartridge-portrait.png">`, outDir: os.tmpdir(), assetById: new Map([[asset.provenanceId, manifest]]), expectedBasePath: basePath });
  assert.ok(failures.some((failure) => failure.includes("not an approved editorial game-card thumbnail")));
});
