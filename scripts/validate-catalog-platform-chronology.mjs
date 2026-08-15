import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const fail = (message) => failures.push(message);
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const sha256 = (value) => `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
const isHttps = (value) => {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
};

const registry = readJson("data/platform-chronology.json");
const audit = readJson("data/curation/2026-08-15-platform-chronology-audit.json");
const facts = readJson("data/curation/2026-08-15-catalog-fact-snapshot.json");
const inventory = readJson("data/curation/2026-08-15-wikidata-catalog-1000.json");
const sourceRights = readJson("data/source-rights.json");
const platformDocument = readJson("data/platforms.json");
const sourceById = new Map((sourceRights.sources ?? []).map((source) => [source.id, source]));
const platformIds = new Set((platformDocument.items ?? []).map((platform) => platform.id));

if (registry.schemaVersion !== 1 || registry.reviewedAt !== "2026-08-15" || typeof registry.policy !== "string" || !Array.isArray(registry.platforms) || registry.platforms.length !== 16) fail("platform chronology registry must contain exactly 16 reviewed entries");
const registryPlatformIds = new Set();
for (const [index, entry] of (registry.platforms ?? []).entries()) {
  const label = `platform chronology registry entry ${index}`;
  const expectedQid = inventory.platformQids?.[entry?.platformId];
  const source = sourceById.get(entry?.sourceId);
  if (!entry || typeof entry.platformId !== "string" || registryPlatformIds.has(entry.platformId) || !platformIds.has(entry.platformId)) fail(`${label} has an invalid or duplicate platformId`);
  else registryPlatformIds.add(entry.platformId);
  if (!/^Q\d+$/.test(entry?.wikidataPlatformId ?? "") || entry.wikidataPlatformId !== expectedQid) fail(`${label} does not reconcile its Wikidata platform QID`);
  if (!Number.isInteger(entry?.debutYear) || entry.debutYear < 1950 || entry.debutYear > 2100) fail(`${label} has an invalid debutYear`);
  if (!source || !isHttps(entry?.sourceUrl) || entry.reviewedAt !== registry.reviewedAt || entry.scope !== "earliest-known-market-debut" || typeof entry.caveat !== "string" || !entry.caveat.trim()) fail(`${label} has incomplete source evidence, review metadata, or caveat`);
  if (entry?.sourceId === "nintendo-platform-history") {
    if (!source?.allowedFields?.includes("platformDebutYear") || !Array.isArray(source.evidenceUrls) || !source.evidenceUrls.includes(entry.sourceUrl)) fail(`${label} requires an approved recorded Nintendo platform-debut evidence URL`);
  } else if (entry?.sourceId === "wikidata-fact-reference") {
    if (!source?.allowedFields?.includes("wikidataPlatformDebutYear") || entry.sourceUrl !== `https://www.wikidata.org/wiki/${entry.wikidataPlatformId}`) fail(`${label} requires its exact approved Wikidata platform-debut item URL`);
  } else {
    fail(`${label} requires an approved chronology source`);
  }
}
if (registryPlatformIds.size !== platformIds.size || [...platformIds].some((id) => !registryPlatformIds.has(id))) fail("platform chronology registry must reconcile every catalog platform");

for (const [name, document] of [["catalog fact snapshot", facts], ["platform chronology audit", audit]]) {
  const base = { ...document };
  delete base.snapshotDigest;
  if (document?.snapshotDigest !== sha256(JSON.stringify(base))) fail(`${name} snapshot digest is invalid`);
}
if (facts.recordCount !== 1000 || !Array.isArray(facts.records) || facts.records.length !== 1000) fail("catalog fact snapshot must cover exactly 1,000 records");
if (audit.schemaVersion !== 1 || audit.reviewedAt !== registry.reviewedAt || audit.registryDigest !== sha256(JSON.stringify(registry)) || audit.factSnapshotDigest !== facts.snapshotDigest || audit.recordCount !== 1000 || !Array.isArray(audit.associations) || audit.associationCount !== audit.associations.length || audit.associationCount !== 153) fail("platform chronology audit metadata is invalid");

const auditKeys = ["slug", "title", "titleReleaseYear", "platformId", "platformDebutYear", "platformReleaseYear", "interpretation"];
const auditKeysByAssociation = new Set();
for (const [index, association] of (audit.associations ?? []).entries()) {
  const label = `platform chronology audit association ${index}`;
  if (!association || JSON.stringify(Object.keys(association).sort()) !== JSON.stringify([...auditKeys].sort())) { fail(`${label} has unsupported fields`); continue; }
  const key = `${association.slug}:${association.platformId}`;
  if (auditKeysByAssociation.has(key)) fail(`${label} duplicates ${key}`);
  else auditKeysByAssociation.add(key);
  if (typeof association.slug !== "string" || typeof association.title !== "string" || !Number.isInteger(association.titleReleaseYear) || !Number.isInteger(association.platformDebutYear) || association.titleReleaseYear >= association.platformDebutYear || association.platformReleaseYear !== null || association.interpretation !== "unresolved") fail(`${label} must retain a neutral unresolved pre-debut title-year association`);
}

const expectedSwitch2 = new Map([
  ["tomb-raider", 2013],
  ["cyberpunk-2077", 2020],
  ["apex-legends", 2019],
  ["hogwarts-legacy", 2023],
]);
const switch2Rows = (audit.associations ?? []).filter((association) => association.platformId === "nintendo-switch-2");
if (switch2Rows.length !== expectedSwitch2.size) fail("Switch 2 chronology audit must retain exactly four reviewed source-listed fixtures");
for (const [slug, titleReleaseYear] of expectedSwitch2) {
  const row = switch2Rows.find((association) => association.slug === slug);
  if (!row || row.titleReleaseYear !== titleReleaseYear || row.platformDebutYear !== 2025 || row.platformReleaseYear !== null || row.interpretation !== "unresolved") fail(`Switch 2 chronology fixture ${slug} is invalid`);
}

const gamesDirectory = path.join(root, "data/games");
const generatedGames = fs.readdirSync(gamesDirectory).filter((file) => file.endsWith(".json")).map((file) => readJson(path.join("data/games", file))).filter((game) => game.sources?.includes("wikidata-fact-reference"));
if (generatedGames.length !== 897) fail("catalog chronology validation requires exactly 897 generated Wikidata records");
for (const game of generatedGames) {
  if (game.release?.scope !== "earliest-title-release") fail(`${game.slug} must explicitly scope its year as an earliest title release`);
  if (game.platformAssociationScope !== "source-listed") fail(`${game.slug} must explicitly scope its platform association as source-listed`);
}

if (failures.length) {
  console.error("Catalog platform chronology validation failed:");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}
console.log(`Catalog platform chronology validation passed (${audit.associationCount} unresolved associations, ${generatedGames.length} source-listed generated records).`);
