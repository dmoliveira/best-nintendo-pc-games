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
const sourceDocument = loadJson("data/source-rights.json") as { sources?: unknown[]; publicNumericSignalPolicy?: { eligiblePredicate?: { approvedCriticProviders?: string[]; minimumScore?: number; requiredScale?: number } } };
const assetDocument = loadJson("data/assets-manifest.json") as { assets?: unknown[] };

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
const context: CatalogContext = { platformIds, genreIds, sourceById, assetById, approvedCriticProviders, criticMinimumScore: predicate?.minimumScore ?? 80, criticRequiredScale: predicate?.requiredScale ?? 100, todayKey: localTodayKey() };
const gamesDirectory = path.join(root, "data/games");
const gameFiles = fs.existsSync(gamesDirectory) ? fs.readdirSync(gamesDirectory).filter((file) => file.endsWith(".json")).sort() : [];
const identityRecords: Array<{ file: string; slug: string; title: string; aliases: string[] }> = [];

for (const file of gameFiles) {
  const relativePath = path.join("data/games", file);
  let game: unknown;
  try { game = loadJson(relativePath); } catch (error) { errors.push(`${relativePath}: invalid JSON (${String(error)})`); continue; }
  for (const problem of validateGameRecord(game, relativePath, context)) errors.push(`${problem.path}: ${problem.message}`);
  const candidate = game as { slug?: string; title?: string; aliases?: string[] };
  if (candidate.slug && candidate.title) identityRecords.push({ file: relativePath, slug: candidate.slug, title: candidate.title, aliases: candidate.aliases ?? [] });
}

errors.push(...findCatalogIdentityCollisions(identityRecords));

if (errors.length) {
  console.error("Catalog validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Catalog validation passed (${platformItems.length} platforms, ${genreItems.length} genres, ${gameFiles.length} game records).`);
