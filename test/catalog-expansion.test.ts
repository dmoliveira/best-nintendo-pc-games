import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { MINIMUM_HUB_RECORDS, getCatalogGame, getCatalogGames, getCatalogPlatforms, getPlatformHub, getPlatformHubs } from "../lib/catalog/site-data";

type ExpansionCandidate = {
  slug: string;
  title: string;
  platformId: string;
  genres: string[];
  linkSourceId: string;
  link: { label: string; url: string; kind: "official" | "reference" };
};

type ExpansionInventory = {
  review: { copyPolicy: string };
  candidates: ExpansionCandidate[];
};

type AssetManifest = {
  assets: Array<{ assetId: string; path: string }>;
};

type SourceRegistry = {
  sources: Array<{ id: string; role: string; allowedFields: string[]; notes: string; coveredProcess: string }>;
};

const root = process.cwd();
const inventory = JSON.parse(fs.readFileSync(path.join(root, "data/curation/2026-08-15-curated-catalog-expansion.json"), "utf8")) as ExpansionInventory;
const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/assets-manifest.json"), "utf8")) as AssetManifest;
const sourceRegistry = JSON.parse(fs.readFileSync(path.join(root, "data/source-rights.json"), "utf8")) as SourceRegistry;
const prohibitedSignalFields = ["score", "scale", "count", "value", "rank", "methodVersion", "scoreType"];
const nintendoLifePlatformPaths: Record<string, string> = {
  "nintendo-nes": "/games/nes/",
  "nintendo-snes": "/games/snes/",
  "nintendo-64": "/games/n64/",
  "nintendo-gamecube": "/games/gamecube/",
  "nintendo-wii": "/games/wii/",
  "nintendo-wii-u": "/games/wiiu/",
  "game-boy": "/games/gameboy/",
  "game-boy-color": "/games/gbc/",
  "game-boy-advance": "/games/gba/",
  "nintendo-ds": "/games/ds/",
  "nintendo-dsi": "/games/dsiware/",
};

test("materializes the 60-item curated expansion inventory without numeric evidence", () => {
  assert.equal(inventory.candidates.length, 60);
  assert.equal(new Set(inventory.candidates.map((candidate) => candidate.slug)).size, inventory.candidates.length);
  assert.match(inventory.review.copyPolicy, /original GameAtlas editorial copy/i);

  const catalog = getCatalogGames();
  const candidateSlugs = new Set(inventory.candidates.map((candidate) => candidate.slug));
  assert.equal(catalog.filter(({ game }) => candidateSlugs.has(game.slug)).length, 60);

  for (const candidate of inventory.candidates) {
    const entry = getCatalogGame(candidate.slug);
    assert.ok(entry, `missing generated record for ${candidate.slug}`);
    assert.equal(entry.game.title, candidate.title);
    assert.deepEqual(entry.game.platforms, [candidate.platformId]);
    assert.deepEqual(entry.game.genres, candidate.genres);
    assert.ok(entry.game.links.some((link) => link.url === candidate.link.url && link.label === candidate.link.label && link.kind === candidate.link.kind));
    assert.ok(entry.game.sources.includes(candidate.linkSourceId));
    assert.equal(new URL(candidate.link.url).protocol, "https:");
    assert.ok(["official", "reference"].includes(candidate.link.kind));

    assert.equal(entry.game.signals.length, 1);
    const [signal] = entry.game.signals;
    assert.equal(signal.kind, "editorial");
    assert.equal(signal.evidenceState, "original-editorial");
    assert.equal(signal.provider, "GameAtlas");
    const serializedSignal = signal as unknown as Record<string, unknown>;
    for (const field of prohibitedSignalFields) assert.ok(!(field in serializedSignal), `${candidate.slug} should not contain ${field}`);
  }
});

test("keeps every game-card asset unique and manifest-backed", () => {
  const catalog = getCatalogGames();
  const assets = catalog.map(({ game }) => {
    assert.equal(game.assets.length, 1, `${game.slug} should have one game-card asset`);
    return game.assets[0];
  });
  const paths = assets.map((asset) => asset.path);
  const provenanceIds = assets.map((asset) => asset.provenanceId);
  assert.equal(new Set(paths).size, catalog.length);
  assert.equal(new Set(provenanceIds).size, catalog.length);

  const manifestGameAssets = manifest.assets.filter((asset) => asset.path.startsWith("public/assets/games/"));
  assert.equal(manifestGameAssets.length, catalog.length);
  for (const asset of assets) {
    const manifestEntry = manifest.assets.find((entry) => entry.assetId === asset.provenanceId);
    assert.equal(manifestEntry?.path, asset.path);
    assert.ok(fs.existsSync(path.join(root, asset.path)), `${asset.path} should exist`);
  }
});

test("raises the curated hub floor to three records across every supported platform", () => {
  const catalog = getCatalogGames();
  const counts = new Map(getCatalogPlatforms().map((platform) => [platform.id, 0]));
  for (const { game } of catalog) for (const platformId of game.platforms) counts.set(platformId, (counts.get(platformId) ?? 0) + 1);

  assert.equal(MINIMUM_HUB_RECORDS, 3);
  assert.equal(getCatalogPlatforms().length, 16);
  for (const platform of getCatalogPlatforms()) assert.ok((counts.get(platform.id) ?? 0) >= MINIMUM_HUB_RECORDS, `${platform.id} should meet the hub floor`);
  assert.equal(getPlatformHubs().length, 16);
  assert.equal(getPlatformHub("nintendo-nes")?.id, "nintendo-nes");
  assert.equal(getPlatformHub("nintendo-new-3ds")?.id, "nintendo-new-3ds");
});

test("limits Nintendo Life to title-specific historical outbound references", () => {
  const nintendoLife = sourceRegistry.sources.find((source) => source.id === "nintendo-life-reference");
  assert.ok(nintendoLife);
  assert.equal(nintendoLife.role, "historical Nintendo catalog reference");
  assert.deepEqual(nintendoLife.allowedFields, ["individualSourceUrl"]);
  assert.match(nintendoLife.notes, /title-specific outbound reference/i);
  assert.match(nintendoLife.coveredProcess, /no scores, review text, images, or provider content/i);

  const referenceCandidates = inventory.candidates.filter((candidate) => candidate.linkSourceId === "nintendo-life-reference");
  assert.equal(referenceCandidates.length, 39);
  for (const candidate of referenceCandidates) {
    assert.equal(candidate.link.kind, "reference");
    const expectedPlatformPath = nintendoLifePlatformPaths[candidate.platformId];
    assert.ok(expectedPlatformPath, `${candidate.platformId} needs a Nintendo Life platform-path rule`);
    assert.ok(candidate.link.url.includes(expectedPlatformPath), `${candidate.slug} must point to its cataloged platform edition`);
  }
});
