import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parseCatalogSearchIndex } from "../lib/catalog/search";
import { createCatalogSearchIndexEnvelope, serializeCatalogSearchIndex } from "../lib/catalog/search-index";
import { getCatalogSearchRecords } from "../lib/catalog/site-data";

const indexPath = new URL("../public/catalog-search-index.json", import.meta.url);
const root = new URL("..", import.meta.url);
const catalogIndexUrl = "/best-nintendo-pc-games/catalog-search-index.json";
const packageScripts = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).scripts;

test("keeps the public search index aligned with the validated client projection", async () => {
  const records = getCatalogSearchRecords();
  const content = readFileSync(indexPath, "utf8");
  const envelope = JSON.parse(content);
  assert.equal(content, serializeCatalogSearchIndex(records));
  assert.equal(envelope.schemaVersion, 2);
  assert.equal(envelope.recordCount, 1000);
  assert.equal(envelope.records.length, 1000);
  assert.equal((await parseCatalogSearchIndex(envelope, 1000, envelope.projectionDigest, catalogIndexUrl))?.length, 1000);
  for (const forbidden of ["\"sourceUrl\":", "\"termsUrl\":", "\"rightsStatus\":", "\"verificationStatus\":", "\"capturedAt\":", "\"recheckAt\":", "\"rationale\":", "\"links\":", "\"provenanceId\":", "\"score\":", "\"scale\":", "\"count\":", "\"value\":", "\"rank\":"]) assert.equal(content.includes(forbidden), false, `search index must not contain ${forbidden}`);
});

test("fails closed when a fetched search index has unsafe or misaligned records", async () => {
  const envelope = JSON.parse(readFileSync(indexPath, "utf8"));
  const cloneRecords = () => JSON.parse(JSON.stringify(envelope.records));
  const parseEnvelope = async (records: unknown[]) => {
    const candidate = createCatalogSearchIndexEnvelope(records as ReturnType<typeof getCatalogSearchRecords>);
    return await parseCatalogSearchIndex(candidate, 1000, candidate.projectionDigest, catalogIndexUrl);
  };

  const misaligned = cloneRecords();
  misaligned[0].platformLabels = [];
  assert.equal(await parseEnvelope(misaligned), undefined);

  const unsafeAsset = cloneRecords();
  unsafeAsset[0].artPath = "https://example.invalid/game.svg";
  assert.equal(await parseEnvelope(unsafeAsset), undefined);

  const sentinelOriginAsset = cloneRecords();
  sentinelOriginAsset[0].artPath = "https://gameatlas.invalid/best-nintendo-pc-games/assets/games/catalog-1000/q161234.svg";
  assert.equal(await parseEnvelope(sentinelOriginAsset), undefined);

  const protocolRelativeAsset = cloneRecords();
  protocolRelativeAsset[0].artPath = "//gameatlas.invalid/best-nintendo-pc-games/assets/games/catalog-1000/q161234.svg";
  assert.equal(await parseEnvelope(protocolRelativeAsset), undefined);

  const mixedSeparatorAsset = cloneRecords();
  mixedSeparatorAsset[0].artPath = "/\\gameatlas.invalid/best-nintendo-pc-games/assets/games/catalog-1000/q161234.svg";
  assert.equal(await parseEnvelope(mixedSeparatorAsset), undefined);

  const duplicateSlug = cloneRecords();
  duplicateSlug[1].slug = duplicateSlug[0].slug;
  assert.equal(await parseEnvelope(duplicateSlug), undefined);

  const leakedField = cloneRecords();
  leakedField[0].rationale = "unexpected";
  assert.equal(await parseEnvelope(leakedField), undefined);

  const missingSemantics = cloneRecords();
  delete missingSemantics[0].releaseScope;
  assert.equal(await parseEnvelope(missingSemantics), undefined);

  const mismatchedSemantics = cloneRecords();
  mismatchedSemantics[0].releaseScope = "earliest-title-release";
  mismatchedSemantics[0].platformAssociationScope = "verified-release";
  assert.equal(await parseEnvelope(mismatchedSemantics), undefined);

  const stale = JSON.parse(JSON.stringify(envelope));
  stale.records[0].title = "Stale title";
  assert.equal(await parseCatalogSearchIndex(stale, 1000, envelope.projectionDigest, catalogIndexUrl), undefined);

  const versionOne = { ...envelope, schemaVersion: 1 };
  assert.equal(await parseCatalogSearchIndex(versionOne, 1000, envelope.projectionDigest, catalogIndexUrl), undefined);
});

test("generates a parser-safe index for the active Pages base path", async () => {
  const basePath = "/preview-catalog";
  const outputDirectory = mkdtempSync(path.join(os.tmpdir(), "gameatlas-catalog-index-"));
  const outputPath = path.join(outputDirectory, "catalog-search-index.json");
  try {
    assert.match(packageScripts.build, /^npm run generate:catalog-search-index && next build/);
    const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/generate-catalog-search-index.ts", "--write", "--output", outputPath], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "production", PAGES_BASE_PATH: basePath },
    });
    assert.equal(result.status, 0, result.stderr);
    const envelope = JSON.parse(readFileSync(outputPath, "utf8"));
    const assetPaths = envelope.records.flatMap((record: { artPath?: string; packageThumbnail?: { frontPath?: string } }) => [record.artPath, record.packageThumbnail?.frontPath]).filter(Boolean);
    assert.ok(assetPaths.length > 0);
    assert.ok(assetPaths.every((assetPath: string) => assetPath.startsWith(`${basePath}/assets/games/`)));
    assert.equal((await parseCatalogSearchIndex(envelope, 1000, envelope.projectionDigest, `${basePath}/catalog-search-index.json`))?.length, 1000);
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});
