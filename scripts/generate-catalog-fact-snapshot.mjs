import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

const root = process.cwd();
const snapshotPath = "data/curation/2026-08-15-catalog-fact-snapshot.json";
const inventoryPath = "data/curation/2026-08-15-wikidata-catalog-1000.json";
const capturedAt = "2026-08-15";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function createSnapshot() {
  const inventory = readJson(inventoryPath);
  const candidateBySlug = new Map((inventory.candidates ?? []).map((candidate) => [candidate.slug, candidate]));
  const gameDirectory = path.join(root, "data/games");
  const records = fs.readdirSync(gameDirectory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => {
      const game = readJson(path.join("data/games", file));
      const candidate = candidateBySlug.get(game.slug);
      return {
        slug: game.slug,
        title: game.title,
        releaseYear: game.release?.year,
        platformIds: [...(game.platforms ?? [])],
        genreIds: [...(game.genres ?? [])],
        sourceIds: [...(game.sources ?? [])],
        assets: [...(game.assets ?? [])]
          .map((asset) => ({ path: asset.path, provenanceId: asset.provenanceId }))
          .sort((left, right) => `${left.path}:${left.provenanceId}`.localeCompare(`${right.path}:${right.provenanceId}`)),
        wikidataId: candidate?.wikidataId ?? null,
        entityUrl: candidate?.entityUrl ?? null,
      };
    })
    .sort((left, right) => left.slug.localeCompare(right.slug));
  const base = { schemaVersion: 1, capturedAt, recordCount: records.length, records };
  return { ...base, snapshotDigest: sha256(JSON.stringify(base)) };
}

const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
if ((write && check) || (!write && !check)) {
  console.error("Usage: node scripts/generate-catalog-fact-snapshot.mjs --write|--check");
  process.exit(1);
}

try {
  const snapshot = createSnapshot();
  if (snapshot.recordCount !== 1000) throw new Error(`Catalog fact snapshot requires exactly 1,000 records, found ${snapshot.recordCount}`);
  if (write) {
    if (fs.existsSync(path.join(root, snapshotPath))) throw new Error(`Refusing to overwrite immutable fact snapshot ${snapshotPath}`);
    writeJson(snapshotPath, snapshot);
    console.log(`Catalog fact snapshot frozen (${snapshot.recordCount} records).`);
  } else {
    const existing = readJson(snapshotPath);
    const existingBase = { ...existing };
    delete existingBase.snapshotDigest;
    if (existing.snapshotDigest !== sha256(JSON.stringify(existingBase))) throw new Error("Catalog fact snapshot digest is invalid");
    if (!isDeepStrictEqual(existing, snapshot)) throw new Error("Catalog fact snapshot differs from the current factual projection");
    console.log(`Catalog fact snapshot check passed (${snapshot.recordCount} records).`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
