import fs from "node:fs";
import path from "node:path";
import { localTodayKey } from "../lib/date-policy.mjs";
import { isValidHttpsUrl } from "../lib/url-policy.mjs";
import { findCatalogIdentityCollisions, findDuplicateRecordIds, validateGameRecord, validateGenreRecord, validatePlatformRecord, type CatalogContext, type GenreRecord, type PlatformRecord, type SourcePolicy } from "../lib/catalog/index";

const root = process.cwd();
const loadJson = (relativePath: string) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8")) as unknown;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const errors: string[] = [];
const platformsDocument = loadJson("data/platforms.json") as { schemaVersion?: number; items?: unknown[] };
const genresDocument = loadJson("data/genres.json") as { schemaVersion?: number; items?: unknown[] };
const sourceDocument = loadJson("data/source-rights.json") as { sources?: unknown[]; publicNumericSignalPolicy?: { eligiblePredicate?: { approvedCriticProviders?: string[]; minimumScore?: number; requiredScale?: number } }; popularitySignalPolicy?: { eligiblePredicate?: { approvedPopularityProviders?: string[]; publicMode?: string } } };
const assetDocument = loadJson("data/assets-manifest.json") as { assets?: unknown[] };
const coverageDocument = loadJson("data/coverage.json") as { schemaVersion?: number; coveragePolicy?: string; sources?: unknown[]; items?: unknown[] };

if (platformsDocument.schemaVersion !== 1 || !Array.isArray(platformsDocument.items)) errors.push("data/platforms.json: expected schemaVersion 1 and items array");
if (genresDocument.schemaVersion !== 1 || !Array.isArray(genresDocument.items)) errors.push("data/genres.json: expected schemaVersion 1 and items array");

const platformItems = (platformsDocument.items ?? []) as PlatformRecord[];
const genreItems = (genresDocument.items ?? []) as GenreRecord[];
const platformIds = new Set<string>();
const genreIds = new Set<string>();
for (const [index, platform] of platformItems.entries()) {
  for (const problem of validatePlatformRecord(platform, `data/platforms.json.items[${index}]`)) errors.push(`${problem.path}: ${problem.message}`);
  if (platformIds.has(platform.id)) errors.push(`data/platforms.json: duplicate platform ${platform.id}`);
  platformIds.add(platform.id);
}
for (const [index, genre] of genreItems.entries()) {
  for (const problem of validateGenreRecord(genre, `data/genres.json.items[${index}]`)) errors.push(`${problem.path}: ${problem.message}`);
  if (genreIds.has(genre.id)) errors.push(`data/genres.json: duplicate genre ${genre.id}`);
  genreIds.add(genre.id);
}

const validCoverage = new Set(["planned", "partial", "populated"]);
if (coverageDocument.schemaVersion !== 1 || !nonEmpty(coverageDocument.coveragePolicy) || !Array.isArray(coverageDocument.sources) || !Array.isArray(coverageDocument.items)) errors.push("data/coverage.json: expected schemaVersion 1, coveragePolicy, sources, and items");
const coverageSources = coverageDocument.sources ?? [];
for (const id of findDuplicateRecordIds(coverageSources, "id")) errors.push(`data/coverage.json: duplicate source ${id}`);
for (const [index, source] of coverageSources.entries()) {
  const sourcePath = `data/coverage.json.sources[${index}]`;
  if (!isRecord(source) || !nonEmpty(source.id) || !nonEmpty(source.label) || !isValidHttpsUrl(source.url)) errors.push(`${sourcePath}: requires id, label, and a valid https URL`);
}
const knownCoverageSourceIds = new Set(coverageSources.filter(isRecord).map((source) => source.id).filter(nonEmpty));
const platformById = new Map(platformItems.filter((platform) => nonEmpty(platform.id)).map((platform) => [platform.id, platform]));
const coverageById = new Map<string, Record<string, unknown>>();
for (const [index, coverage] of (coverageDocument.items ?? []).entries()) {
  const coveragePath = `data/coverage.json.items[${index}]`;
  if (!isRecord(coverage)) {
    errors.push(`${coveragePath}: must be an object`);
    continue;
  }
  const platformId = coverage.platformId;
  if (!nonEmpty(platformId) || !platformById.has(platformId)) errors.push(`${coveragePath}.platformId: must reference a known platform`);
  if (nonEmpty(platformId) && coverageById.has(platformId)) errors.push(`${coveragePath}.platformId: duplicate coverage entry ${platformId}`);
  if (!validCoverage.has(String(coverage.coverage))) errors.push(`${coveragePath}.coverage: unsupported coverage status`);
  if (!['alpha', 'expansion'].includes(String(coverage.catalogTarget))) errors.push(`${coveragePath}.catalogTarget: must be alpha or expansion`);
  if (!Array.isArray(coverage.sourceIds) || coverage.sourceIds.length < 1 || coverage.sourceIds.some((sourceId) => !nonEmpty(sourceId) || !knownCoverageSourceIds.has(sourceId))) errors.push(`${coveragePath}.sourceIds: must contain declared source IDs`);
  const platform = nonEmpty(platformId) ? platformById.get(platformId) : undefined;
  if (platform && coverage.coverage !== platform.coverage) errors.push(`${coveragePath}.coverage: must match ${platformId} in data/platforms.json`);
  if (nonEmpty(platformId)) coverageById.set(platformId, coverage);
}
for (const platform of platformItems) if (nonEmpty(platform.id) && !coverageById.has(platform.id)) errors.push(`data/coverage.json: missing coverage entry for ${platform.id}`);

const sourceCandidates = sourceDocument.sources ?? [];
for (const id of findDuplicateRecordIds(sourceCandidates, "id")) errors.push(`data/source-rights.json: duplicate source ${id}`);
const sourceRecords: SourcePolicy[] = [];
for (const [index, candidate] of sourceCandidates.entries()) {
  const recordPath = `data/source-rights.json.sources[${index}]`;
  if (!isRecord(candidate)) {
    errors.push(`${recordPath}: must be an object`);
    continue;
  }
  let valid = true;
  for (const field of ["id", "provider", "status", "reviewedBy", "rightsReviewedAt", "decisionEvidence", "coveredProcess"]) {
    if (!nonEmpty(candidate[field])) {
      errors.push(`${recordPath}.${field}: must be a non-empty string`);
      valid = false;
    }
  }
  if (!Array.isArray(candidate.allowedFields)) {
    errors.push(`${recordPath}.allowedFields: must be an array`);
    valid = false;
  }
  if (!("recheckAt" in candidate) || (candidate.recheckAt !== null && !nonEmpty(candidate.recheckAt))) {
    errors.push(`${recordPath}.recheckAt: must be a date string or null`);
    valid = false;
  }
  if (candidate.termsUrl !== undefined && candidate.termsUrl !== null && !isValidHttpsUrl(candidate.termsUrl)) {
    errors.push(`${recordPath}.termsUrl: must be a valid https URL when present`);
    valid = false;
  }
  if (Array.isArray(candidate.allowedFields) && candidate.allowedFields.some((field) => ["numericScore", "popularitySignal"].includes(String(field))) && !isValidHttpsUrl(candidate.termsUrl)) {
    errors.push(`${recordPath}.termsUrl: required for critic/popularity authorization`);
    valid = false;
  }
  if (valid) sourceRecords.push(candidate as unknown as SourcePolicy);
}

const assetCandidates = assetDocument.assets ?? [];
for (const id of findDuplicateRecordIds(assetCandidates, "assetId")) errors.push(`data/assets-manifest.json: duplicate asset ${id}`);
const assetRecords: Array<{ assetId: string; path: string }> = [];
for (const [index, candidate] of assetCandidates.entries()) {
  const recordPath = `data/assets-manifest.json.assets[${index}]`;
  if (!isRecord(candidate) || !nonEmpty(candidate.assetId) || !nonEmpty(candidate.path)) {
    errors.push(`${recordPath}: assetId and path must be non-empty strings`);
    continue;
  }
  assetRecords.push({ assetId: candidate.assetId, path: candidate.path });
}

const sourceById = new Map(sourceRecords.map((source) => [source.id, source]));
const assetById = new Map(assetRecords.map((asset) => [asset.assetId, { path: asset.path }]));
const predicate = sourceDocument.publicNumericSignalPolicy?.eligiblePredicate;
const approvedCriticProviders = new Set(predicate?.approvedCriticProviders ?? []);
const popularityPredicate = sourceDocument.popularitySignalPolicy?.eligiblePredicate;
const approvedPopularityProviders = new Set(popularityPredicate?.approvedPopularityProviders ?? []);
const context: CatalogContext = { platformIds, genreIds, sourceById, assetById, approvedCriticProviders, approvedPopularityProviders, popularityPublicMode: popularityPredicate?.publicMode === "numeric-display" ? "numeric-display" : "outbound-only", criticMinimumScore: predicate?.minimumScore ?? 80, criticRequiredScale: predicate?.requiredScale ?? 100, todayKey: localTodayKey() };
const gamesDirectory = path.join(root, "data/games");
const gameFiles = fs.existsSync(gamesDirectory) ? fs.readdirSync(gamesDirectory).filter((file) => file.endsWith(".json")).sort() : [];
const identityRecords: Array<{ file: string; slug: string; title: string; aliases: string[] }> = [];
const gamePlatformIds = new Set<string>();

for (const file of gameFiles) {
  const relativePath = path.join("data/games", file);
  let game: unknown;
  try { game = loadJson(relativePath); } catch (error) { errors.push(`${relativePath}: invalid JSON (${String(error)})`); continue; }
  const problems = validateGameRecord(game, relativePath, context);
  for (const problem of problems) errors.push(`${problem.path}: ${problem.message}`);
  if (problems.length === 0 && isRecord(game) && Array.isArray(game.platforms)) for (const platform of game.platforms) if (nonEmpty(platform)) gamePlatformIds.add(platform);
  const candidate = game as { slug?: string; title?: string; aliases?: string[] };
  if (candidate.slug && candidate.title) identityRecords.push({ file: relativePath, slug: candidate.slug, title: candidate.title, aliases: candidate.aliases ?? [] });
}

for (const platform of platformItems) if (platform.coverage === "populated" && nonEmpty(platform.id) && !gamePlatformIds.has(platform.id)) errors.push(`data/platforms.json: populated platform ${platform.id} has no validated game record`);
errors.push(...findCatalogIdentityCollisions(identityRecords));

if (errors.length) {
  console.error("Catalog validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Catalog validation passed (${platformItems.length} platforms, ${genreItems.length} genres, ${gameFiles.length} game records).`);
