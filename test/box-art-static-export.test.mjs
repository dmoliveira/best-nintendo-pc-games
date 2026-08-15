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
const manifest = { assetId: asset.provenanceId, path: asset.path, altText: asset.alt, assetKind: "generated-game-box-front", intendedUse: "game-box-front", boxFormatId: asset.boxFormatId };

test("accepts a box-only page without requiring separate scene art", () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "gameatlas-export-"));
  try {
    const outputAsset = path.join(outDir, "assets/games/sample-game/front-cartridge-portrait.png");
    fs.mkdirSync(path.dirname(outputAsset), { recursive: true });
    fs.writeFileSync(outputAsset, "fixture");
    const game = { assets: [asset] };
    const gameHtml = `<img src="${basePath}/assets/games/sample-game/front-cartridge-portrait.png" loading="eager" decoding="async" fetchpriority="high">`;
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

test("separates eager governed fronts from deferred editorial reference art", () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "gameatlas-export-"));
  const editorial = { path: "public/assets/games/sample-game.svg", alt: "Abstract editorial tile", provenanceId: "tile" };
  const editorialManifest = { assetId: editorial.provenanceId, path: editorial.path, altText: editorial.alt, assetKind: "generated-original-editorial", intendedUse: "game-card-thumbnail" };
  try {
    const outputAsset = path.join(outDir, "assets/games/sample-game/front-cartridge-portrait.png");
    fs.mkdirSync(path.dirname(outputAsset), { recursive: true });
    fs.writeFileSync(outputAsset, "fixture");
    const gameHtml = [
      `<img class="game-box-stage__editorial-art" src="${basePath}/assets/games/sample-game.svg" loading="lazy" decoding="async" fetchpriority="low">`,
      `<img src="${basePath}/assets/games/sample-game/front-cartridge-portrait.png" loading="eager" decoding="async" fetchpriority="high">`,
    ].join("");
    const assetById = new Map([[asset.provenanceId, manifest], [editorial.provenanceId, editorialManifest]]);
    assert.deepEqual(validateGameArtExport({ game: { assets: [asset, editorial] }, gameHtml, outDir, assetById, expectedBasePath: basePath }), []);

    const unprioritized = gameHtml.replace('loading="eager" decoding="async" fetchpriority="high"', 'loading="lazy" decoding="async"');
    const failures = validateGameArtExport({ game: { assets: [asset, editorial] }, gameHtml: unprioritized, outDir, assetById, expectedBasePath: basePath });
    assert.ok(failures.some((failure) => failure.includes("does not prioritize its approved generated game-box front")));

    const preloadedEditorial = `${gameHtml}<link rel="preload" as="image" href="${basePath}/assets/games/sample-game.svg">`;
    const preloadFailures = validateGameArtExport({ game: { assets: [asset, editorial] }, gameHtml: preloadedEditorial, outDir, assetById, expectedBasePath: basePath });
    assert.ok(preloadFailures.some((failure) => failure.includes("preloads approved editorial scene art")));
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});


test("rejects a role-only package face without governed manifest metadata", () => {
  const failures = validateGameArtExport({ game: { assets: [asset] }, gameHtml: `<img src="${basePath}/assets/games/sample-game/front-cartridge-portrait.png">`, outDir: os.tmpdir(), assetById: new Map([[asset.provenanceId, { assetId: asset.provenanceId, path: asset.path }]]), expectedBasePath: basePath });
  assert.ok(failures.some((failure) => failure.includes("not an approved generated game-box-front")));
});
