import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const inventoryPath = "data/curation/2026-08-15-wikidata-catalog-1000.json";
const identitySnapshotPath = "data/curation/2026-08-15-existing-identity-snapshot.json";
const generatedAssetRoot = "public/assets/games/catalog-1000";
const generatedAssetPrefix = "gameatlas-catalog-1000-";
const failures = [];

function fail(message) {
  failures.push(message);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function sha256(value) {
  return "sha256:" + crypto.createHash("sha256").update(value).digest("hex");
}

function normalize(value) {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function assertExactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(label + " must be an object");
    return;
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(label + " has unsupported or missing keys: " + actual.join(", "));
}

function hasNonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(target));
    else result.push(path.relative(root, target));
  }
  return result;
}

function textSignature(value, title) {
  const titleTerms = new Set(normalize(title).split("-").filter(Boolean));
  return normalize(value).split("-").filter((term) => term && !titleTerms.has(term));
}

function ngrams(words) {
  const values = new Set();
  for (let index = 0; index <= words.length - 3; index += 1) values.add(words.slice(index, index + 3).join("-"));
  return values;
}

function jaccard(left, right) {
  let shared = 0;
  for (const value of left) if (right.has(value)) shared += 1;
  return shared / Math.max(1, left.size + right.size - shared);
}

function inventoryCopy(candidate) {
  return [candidate.editorialCopy.shortDescription, ...candidate.editorialCopy.highlights, candidate.editorialCopy.rationale].join(" ");
}

const inventory = readJson(inventoryPath);
const rootKeys = ["schemaVersion", "id", "target", "source", "query", "platformQids", "genreMappings", "existingIdentitySnapshot", "quotaLedger", "candidates", "snapshotDigest"];
assertExactKeys(inventory, rootKeys, "catalog-1000 inventory");
if (inventory.schemaVersion !== 1 || inventory.id !== "2026-08-15-wikidata-catalog-1000") fail("catalog-1000 inventory has an invalid schemaVersion or id");
if (inventory.target?.existingRecords !== 103 || inventory.target?.additions !== 897 || inventory.target?.totalRecords !== 1000) fail("catalog-1000 inventory must declare 103 existing, 897 additions, and 1,000 total");
const inventoryBase = { ...inventory };
delete inventoryBase.snapshotDigest;
if (inventory.snapshotDigest !== sha256(JSON.stringify(inventoryBase))) fail("catalog-1000 inventory snapshot digest does not match its frozen content");
assertExactKeys(inventory.source, ["id", "provider", "licenseUrl", "termsUrl", "structuredDataPolicyUrl", "dataAccessUrl", "queryServiceUrl", "retrievedAt", "attribution"], "catalog-1000 source metadata");
if (inventory.source?.id !== "wikidata-fact-reference" || inventory.source?.provider !== "Wikidata contributors") fail("catalog-1000 inventory must use the approved Wikidata structured-data source");
if (inventory.source?.structuredDataPolicyUrl !== "https://www.wikidata.org/wiki/Wikidata:Copyright" || inventory.source?.attribution !== "Data from Wikidata (CC0); item link provided.") fail("catalog-1000 inventory must identify Wikidata structured-data policy and provenance");
for (const field of ["licenseUrl", "termsUrl", "structuredDataPolicyUrl", "dataAccessUrl", "queryServiceUrl"]) if (!/^https:\/\//.test(String(inventory.source?.[field] ?? ""))) fail("catalog-1000 source " + field + " must be https");
if (inventory.query?.minimumSitelinks !== 3 || !hasNonEmpty(inventory.query?.text) || !/^sha256:[a-f0-9]{64}$/.test(inventory.query?.sha256 ?? "")) fail("catalog-1000 query metadata is incomplete");
if (inventory.query?.sha256 !== sha256(inventory.query.text)) fail("catalog-1000 query digest does not match query text");
if (!Array.isArray(inventory.candidates) || inventory.candidates.length !== 897) fail("catalog-1000 inventory must contain exactly 897 candidates");

const genres = readJson("data/genres.json").items ?? [];
const genreIds = new Set(genres.map((genre) => genre.id));
const platforms = readJson("data/platforms.json").items ?? [];
const platformIds = new Set(platforms.map((platform) => platform.id));
const candidateKeys = ["wikidataId", "entityUrl", "slug", "title", "aliases", "emoji", "wikidataReleaseYear", "platformId", "wikidataPlatformId", "genreIds", "wikidataGenreIds", "editorialCopy", "review"];
const editorialKeys = ["shortDescription", "highlights", "rationale"];
const reviewKeys = ["reviewedBy", "reviewedAt", "copyStatus", "sourceMethod"];
const qids = new Set();
const slugs = new Set();
const candidateBySlug = new Map();
const copySignatures = new Map();
for (const [index, candidate] of (inventory.candidates ?? []).entries()) {
  const label = "inventory.candidates[" + index + "]";
  assertExactKeys(candidate, candidateKeys, label);
  assertExactKeys(candidate.editorialCopy, editorialKeys, label + ".editorialCopy");
  assertExactKeys(candidate.review, reviewKeys, label + ".review");
  if (!/^Q\d+$/.test(candidate.wikidataId ?? "") || qids.has(candidate.wikidataId)) fail(label + " has an invalid or duplicate Wikidata QID");
  qids.add(candidate.wikidataId);
  if (candidate.entityUrl !== "https://www.wikidata.org/wiki/" + candidate.wikidataId) fail(label + " entityUrl must exactly match its Wikidata QID");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.slug ?? "") || slugs.has(candidate.slug)) fail(label + " has an invalid or duplicate slug");
  slugs.add(candidate.slug);
  candidateBySlug.set(candidate.slug, candidate);
  if (!hasNonEmpty(candidate.title) || !Array.isArray(candidate.aliases) || !hasNonEmpty(candidate.emoji)) fail(label + " requires title, aliases, and emoji");
  if (!Number.isInteger(candidate.wikidataReleaseYear) || candidate.wikidataReleaseYear < 1950 || candidate.wikidataReleaseYear > 2100) fail(label + " has an invalid Wikidata release year");
  if (!platformIds.has(candidate.platformId) || inventory.platformQids?.[candidate.platformId] !== candidate.wikidataPlatformId) fail(label + " has an invalid platform/QID pair");
  if (!Array.isArray(candidate.genreIds) || !candidate.genreIds.length || candidate.genreIds.some((genreId) => !genreIds.has(genreId))) fail(label + " has an invalid canonical genre");
  if (!Array.isArray(candidate.wikidataGenreIds) || !candidate.wikidataGenreIds.length || candidate.wikidataGenreIds.some((qid) => !/^Q\d+$/.test(qid) || !inventory.genreMappings?.[qid])) fail(label + " has an invalid Wikidata genre mapping");
  for (const qid of candidate.wikidataGenreIds) {
    const mapping = inventory.genreMappings[qid];
    if (!hasNonEmpty(mapping?.label) || !Array.isArray(mapping?.genreIds) || mapping.genreIds.some((genreId) => !genreIds.has(genreId))) fail(label + " contains an invalid frozen genre mapping for " + qid);
  }
  if (!hasNonEmpty(candidate.editorialCopy?.shortDescription) || !Array.isArray(candidate.editorialCopy?.highlights) || candidate.editorialCopy.highlights.length !== 2 || candidate.editorialCopy.highlights.some((highlight) => !hasNonEmpty(highlight)) || !hasNonEmpty(candidate.editorialCopy?.rationale)) fail(label + " has incomplete deterministic catalog-method copy");
  if (candidate.review?.reviewedBy !== "GameAtlas deterministic catalog process" || candidate.review?.reviewedAt !== "2026-08-15" || candidate.review?.copyStatus !== "deterministic-catalog-method" || candidate.review?.sourceMethod !== "frozen-wikidata-structured-data") fail(label + " has an invalid catalog-method attestation");
  const signature = textSignature(inventoryCopy(candidate), candidate.title).join("-");
  if (copySignatures.has(signature)) fail(label + " duplicates editorial copy from " + copySignatures.get(signature));
  else copySignatures.set(signature, label);
}

const snapshot = readJson(identitySnapshotPath);
const snapshotBase = { ...snapshot };
delete snapshotBase.snapshotDigest;
if (snapshot.catalogCount !== 103 || snapshot.snapshotDigest !== sha256(JSON.stringify(snapshotBase))) fail("existing identity snapshot is invalid");
if (inventory.existingIdentitySnapshot?.path !== identitySnapshotPath || inventory.existingIdentitySnapshot?.snapshotDigest !== snapshot.snapshotDigest) fail("catalog-1000 inventory does not bind the existing identity snapshot");
const existingKeys = new Set((snapshot.identities ?? []).flatMap((identity) => identity.normalizedKeys ?? []));
for (const candidate of inventory.candidates ?? []) if (existingKeys.has(normalize(candidate.slug)) || existingKeys.has(normalize(candidate.title)) || candidate.aliases.some((alias) => existingKeys.has(normalize(alias)))) fail("candidate " + candidate.wikidataId + " collides with an existing catalog identity");

const primary = inventory.quotaLedger?.primary ?? {};
const selected = inventory.quotaLedger?.selected ?? {};
const transfers = inventory.quotaLedger?.transfersToWindows ?? [];
if (Object.values(primary).reduce((total, value) => total + value, 0) !== 897) fail("primary quota matrix must sum to 897");
const actualPlatformCounts = Object.fromEntries([...platformIds].map((platformId) => [platformId, (inventory.candidates ?? []).filter((candidate) => candidate.platformId === platformId).length]));
for (const [platformId, quota] of Object.entries(primary)) {
  const transfer = transfers.filter((item) => item.fromPlatformId === platformId).reduce((total, item) => total + item.count, 0);
  const expected = platformId === "pc-windows" ? quota + transfers.reduce((total, item) => total + item.count, 0) : quota - transfer;
  if (selected[platformId] !== expected || actualPlatformCounts[platformId] !== expected) fail("quota ledger does not reconcile for " + platformId);
}
if (!Array.isArray(transfers) || transfers.some((item) => !platformIds.has(item.fromPlatformId) || !Number.isInteger(item.count) || item.count < 1 || !hasNonEmpty(item.reason))) fail("quota transfer ledger is invalid");

const gameFiles = fs.readdirSync(path.join(root, "data/games")).filter((file) => file.endsWith(".json")).sort();
if (gameFiles.length !== 1000) fail("catalog must contain exactly 1,000 game files, found " + gameFiles.length);
const manifest = readJson("data/assets-manifest.json");
const manifestById = new Map((manifest.assets ?? []).map((asset) => [asset.assetId, asset]));
const generatedGames = [];
for (const file of gameFiles) {
  const game = readJson(path.join("data/games", file));
  if (Array.isArray(game.sources) && game.sources.includes("wikidata-fact-reference")) generatedGames.push({ file, game });
}
if (generatedGames.length !== 897) fail("catalog must contain exactly 897 Wikidata-generated game records");
const generatedSlugs = new Set(generatedGames.map(({ game }) => game.slug));
for (const slug of candidateBySlug.keys()) if (!generatedSlugs.has(slug)) fail("missing generated game for " + slug);
for (const { game } of generatedGames) {
  const candidate = candidateBySlug.get(game.slug);
  if (!candidate) { fail("stale generated game record " + game.slug); continue; }
  if (game.title !== candidate.title || game.release?.year !== candidate.wikidataReleaseYear || JSON.stringify(game.platforms) !== JSON.stringify([candidate.platformId]) || JSON.stringify(game.genres) !== JSON.stringify(candidate.genreIds)) fail("generated game metadata diverges for " + game.slug);
  if (JSON.stringify(game.sources) !== JSON.stringify(["wikidata-fact-reference", "gameatlas-editorial"])) fail("generated game sources are invalid for " + game.slug);
  if (!Array.isArray(game.links) || game.links.length !== 1 || game.links[0]?.kind !== "reference" || game.links[0]?.url !== candidate.entityUrl || game.links[0]?.label !== "External/reference — Wikidata structured data") fail("generated Wikidata link is invalid for " + game.slug);
  if (!Array.isArray(game.signals) || game.signals.length !== 1 || game.signals[0]?.kind !== "editorial" || game.signals[0]?.evidenceState !== "catalog-method" || game.signals[0]?.label !== "GameAtlas catalog method" || game.signals[0]?.reviewedBy !== "GameAtlas deterministic catalog process") fail("generated catalog signal is invalid for " + game.slug);
  const signal = game.signals?.[0] ?? {};
  for (const field of ["score", "scale", "count", "value", "rank", "methodVersion", "scoreType", "sitelinkCount"]) if (field in signal) fail("generated signal contains prohibited field " + field + " for " + game.slug);
  if (!Array.isArray(game.assets) || game.assets.length !== 1 || "role" in game.assets[0] || "boxFormatId" in game.assets[0]) fail("generated game must have exactly one non-box generic asset for " + game.slug);
  const asset = game.assets?.[0];
  const expectedAssetId = generatedAssetPrefix + candidate.wikidataId.toLocaleLowerCase("en-US");
  const expectedPath = generatedAssetRoot + "/" + candidate.wikidataId.toLocaleLowerCase("en-US") + ".svg";
  if (asset?.provenanceId !== expectedAssetId || asset?.path !== expectedPath || asset?.alt !== "Abstract GameAtlas art tile for " + candidate.title) fail("generated asset reference is invalid for " + game.slug);
  const manifestAsset = manifestById.get(expectedAssetId);
  if (!manifestAsset || manifestAsset.path !== expectedPath || manifestAsset.assetKind !== "generated-original-editorial" || manifestAsset.intendedUse !== "game-card-thumbnail" || manifestAsset.altText !== asset.alt || manifestAsset.reviewedBy !== "GameAtlas deterministic asset process" || !/^sha256:[a-f0-9]{64}$/.test(manifestAsset.contentChecksum ?? "")) fail("generated manifest asset is invalid for " + game.slug);
  const assetFile = path.join(root, expectedPath);
  if (!fs.existsSync(assetFile)) fail("generated SVG is missing for " + game.slug);
  else {
    const content = fs.readFileSync(assetFile, "utf8");
    if (manifestAsset.contentChecksum !== sha256(content)) fail("generated SVG checksum is invalid for " + game.slug);
    if (/<(?:text|image|title|script|foreignObject)\b/i.test(content) || /https?:\/\/(?!www\.w3\.org\/2000\/svg)/i.test(content)) fail("generated SVG contains prohibited non-abstract content for " + game.slug);
  }
}
const generatedManifestAssets = (manifest.assets ?? []).filter((asset) => String(asset.assetId ?? "").startsWith(generatedAssetPrefix));
if (generatedManifestAssets.length !== 897) fail("asset manifest must contain exactly 897 catalog-1000 assets");
const manifestIds = new Set(generatedManifestAssets.map((asset) => asset.assetId));
for (const candidate of inventory.candidates ?? []) if (!manifestIds.has(generatedAssetPrefix + candidate.wikidataId.toLocaleLowerCase("en-US"))) fail("missing manifest asset for " + candidate.wikidataId);
const generatedAssetFiles = new Set(walk(path.join(root, generatedAssetRoot)).filter((file) => file.endsWith(".svg")));
if (generatedAssetFiles.size !== 897) fail("catalog-1000 asset directory must contain exactly 897 SVG files");
for (const candidate of inventory.candidates ?? []) if (!generatedAssetFiles.has(generatedAssetRoot + "/" + candidate.wikidataId.toLocaleLowerCase("en-US") + ".svg")) fail("missing generated SVG for " + candidate.wikidataId);
const generatedAssetChecksums = new Map();
for (const asset of generatedManifestAssets) {
  const existing = generatedAssetChecksums.get(asset.contentChecksum);
  if (existing) fail("generated SVG checksum is shared by " + existing + " and " + asset.assetId);
  else generatedAssetChecksums.set(asset.contentChecksum, asset.assetId);
}

const groups = new Map();
for (const candidate of inventory.candidates ?? []) {
  const key = candidate.platformId + "|" + candidate.genreIds.join(",");
  const group = groups.get(key) ?? [];
  group.push(candidate);
  groups.set(key, group);
}
for (const group of groups.values()) {
  for (let left = 0; left < group.length; left += 1) {
    const leftGrams = ngrams(textSignature(inventoryCopy(group[left]), group[left].title));
    for (let right = left + 1; right < group.length; right += 1) {
      const similarity = jaccard(leftGrams, ngrams(textSignature(inventoryCopy(group[right]), group[right].title)));
      if (similarity > 0.82) fail("editorial copy similarity exceeds 0.82 for " + group[left].wikidataId + " and " + group[right].wikidataId);
    }
  }
}

if (failures.length) {
  console.error("Catalog-1000 validation failed:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}
console.log("Catalog-1000 validation passed (897 frozen Wikidata candidates, 1,000 game records, 897 deterministic SVG assets).");
