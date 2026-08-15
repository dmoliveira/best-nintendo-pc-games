import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

const root = process.cwd();
const registryPath = "data/platform-chronology.json";
const factSnapshotPath = "data/curation/2026-08-15-catalog-fact-snapshot.json";
const auditPath = "data/curation/2026-08-15-platform-chronology-audit.json";

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

function assertRegistry(registry) {
  if (registry?.schemaVersion !== 1 || typeof registry.reviewedAt !== "string" || typeof registry.policy !== "string" || !Array.isArray(registry.platforms) || registry.platforms.length !== 16) throw new Error("Platform chronology registry must contain exactly 16 reviewed platform entries");
  const ids = new Set();
  const qids = new Set();
  for (const entry of registry.platforms) {
    if (!entry || typeof entry.platformId !== "string" || ids.has(entry.platformId) || !/^Q\d+$/.test(entry.wikidataPlatformId ?? "") || qids.has(entry.wikidataPlatformId) || !Number.isInteger(entry.debutYear) || entry.debutYear < 1950 || entry.debutYear > 2100 || typeof entry.sourceId !== "string" || !/^https:\/\//.test(entry.sourceUrl ?? "") || entry.reviewedAt !== registry.reviewedAt || entry.scope !== "earliest-known-market-debut" || typeof entry.caveat !== "string" || !entry.caveat.trim()) throw new Error(`Invalid chronology registry entry ${entry?.platformId ?? "unknown"}`);
    ids.add(entry.platformId);
    qids.add(entry.wikidataPlatformId);
  }
  return new Map(registry.platforms.map((entry) => [entry.platformId, entry]));
}

function createAudit() {
  const registry = readJson(registryPath);
  const platformById = assertRegistry(registry);
  const factSnapshot = readJson(factSnapshotPath);
  const gameDirectory = path.join(root, "data/games");
  const records = fs.readdirSync(gameDirectory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => readJson(path.join("data/games", file)));
  if (records.length !== 1000 || factSnapshot.recordCount !== 1000) throw new Error("Platform chronology audit requires the 1,000-record catalog fact snapshot");
  const associations = records.flatMap((game) => (game.platforms ?? []).flatMap((platformId) => {
    const platform = platformById.get(platformId);
    if (!platform || !Number.isInteger(game.release?.year) || game.release.year >= platform.debutYear) return [];
    return [{
      slug: game.slug,
      title: game.title,
      titleReleaseYear: game.release.year,
      platformId,
      platformDebutYear: platform.debutYear,
      platformReleaseYear: null,
      interpretation: "unresolved",
    }];
  })).sort((left, right) => left.platformId.localeCompare(right.platformId) || left.titleReleaseYear - right.titleReleaseYear || left.slug.localeCompare(right.slug));
  const base = {
    schemaVersion: 1,
    reviewedAt: registry.reviewedAt,
    registryDigest: sha256(JSON.stringify(registry)),
    factSnapshotDigest: factSnapshot.snapshotDigest,
    recordCount: records.length,
    associationCount: associations.length,
    associations,
  };
  return { ...base, snapshotDigest: sha256(JSON.stringify(base)) };
}

const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
if ((write && check) || (!write && !check)) {
  console.error("Usage: node scripts/generate-catalog-platform-chronology.mjs --write|--check");
  process.exit(1);
}

try {
  const audit = createAudit();
  if (write) {
    writeJson(auditPath, audit);
    console.log(`Catalog platform chronology audit generated (${audit.associationCount} unresolved associations).`);
  } else {
    const existing = readJson(auditPath);
    const existingBase = { ...existing };
    delete existingBase.snapshotDigest;
    if (existing.snapshotDigest !== sha256(JSON.stringify(existingBase))) throw new Error("Catalog platform chronology audit digest is invalid");
    if (!isDeepStrictEqual(existing, audit)) throw new Error("Catalog platform chronology audit differs from the current frozen catalog facts");
    console.log(`Catalog platform chronology audit check passed (${audit.associationCount} unresolved associations).`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
