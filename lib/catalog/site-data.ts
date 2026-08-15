import fs from "node:fs";
import path from "node:path";
import { localTodayKey } from "../date-policy.mjs";
import { createSiteConfig } from "../site-config";
import { getPlatformDisplayLabel } from "./display";
import { getPublicSignalSummaries, type PublicSignalSummaries } from "./public-signals";
import { normalizeSearchText, type CatalogSearchRecord } from "./search";
import { selectApprovedBoxFrontAsset, selectEditorialAsset } from "../box-art/asset-roles.mjs";
import { BOX_ART_FORMAT_IDS } from "../box-art/formats";
import { createPackagePresentation } from "../box-art/package-engine";
import { validateGameRecord } from "./validator";
import type {
  CatalogContext,
  EditorialSignal,
  GameRecord,
  GenreRecord,
  PlatformRecord,
  SourcePolicy,
} from "./types";

type Document = Record<string, unknown>;

export interface CatalogGame {
  game: GameRecord;
  platforms: PlatformRecord[];
  genres: GenreRecord[];
}

const root = process.cwd();
const site = createSiteConfig(process.env);

function loadJson(relativePath: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(/* turbopackIgnore: true */ root, relativePath), "utf8")) as unknown;
}

function asDocument(value: unknown): Document {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Catalog document must be an object");
  return value as Document;
}

function asItems<T>(document: Document, relativePath: string): T[] {
  if (!Array.isArray(document.items)) throw new Error(`${relativePath}: expected an items array`);
  return document.items as T[];
}

function createContext(platforms: PlatformRecord[], genres: GenreRecord[], sourceDocument: Document, assetDocument: Document): CatalogContext {
  const sourceRecords = (sourceDocument.sources ?? []) as SourcePolicy[];
  const assets = (assetDocument.assets ?? []) as Array<{ assetId: string; path: string; altText?: string; assetKind?: string; intendedUse?: string; boxFormatId?: string }>;
  const predicate = sourceDocument.publicNumericSignalPolicy && typeof sourceDocument.publicNumericSignalPolicy === "object"
    ? sourceDocument.publicNumericSignalPolicy as { eligiblePredicate?: { approvedCriticProviders?: string[]; minimumScore?: number; requiredScale?: number } }
    : undefined;
  const popularityPolicy = sourceDocument.popularitySignalPolicy && typeof sourceDocument.popularitySignalPolicy === "object"
    ? sourceDocument.popularitySignalPolicy as { eligiblePredicate?: { approvedPopularityProviders?: string[]; publicMode?: string } }
    : undefined;
  const approvedCriticProviders = new Set(predicate?.eligiblePredicate?.approvedCriticProviders ?? []);
  const approvedPopularityProviders = new Set(popularityPolicy?.eligiblePredicate?.approvedPopularityProviders ?? []);

  return {
    platformIds: new Set(platforms.map((platform) => platform.id)),
    genreIds: new Set(genres.map((genre) => genre.id)),
    sourceById: new Map(sourceRecords.map((source) => [source.id, source])),
    assetById: new Map(assets.map((asset) => [asset.assetId, { path: asset.path, altText: asset.altText, assetKind: asset.assetKind, intendedUse: asset.intendedUse, boxFormatId: asset.boxFormatId }])),
    boxArtFormatIds: BOX_ART_FORMAT_IDS,
    approvedCriticProviders,
    approvedPopularityProviders,
    popularityPublicMode: popularityPolicy?.eligiblePredicate?.publicMode === "numeric-display" ? "numeric-display" : "outbound-only",
    criticMinimumScore: predicate?.eligiblePredicate?.minimumScore ?? 80,
    criticRequiredScale: predicate?.eligiblePredicate?.requiredScale ?? 100,
    todayKey: localTodayKey(),
  };
}

function loadGames(context: CatalogContext): GameRecord[] {
  const gamesDirectory = path.join(root, "data/games");
  const files = fs.existsSync(gamesDirectory) ? fs.readdirSync(gamesDirectory).filter((file) => file.endsWith(".json")).sort() : [];
  const errors: string[] = [];
  const games: GameRecord[] = [];

  for (const file of files) {
    const relativePath = path.join("data/games", file);
    let game: unknown;
    try {
      game = loadJson(relativePath);
    } catch (error) {
      errors.push(`${relativePath}: invalid JSON (${String(error)})`);
      continue;
    }
    const problems = validateGameRecord(game, relativePath, context);
    if (problems.length > 0) {
      errors.push(...problems.map((problem) => `${problem.path}: ${problem.message}`));
      continue;
    }
    games.push(game as GameRecord);
  }

  if (errors.length > 0) throw new Error(`Catalog data is invalid:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  return games.sort((left, right) => {
    const leftKey = normalizeSearchText(left.title);
    const rightKey = normalizeSearchText(right.title);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0;
  });
}

const platformDocument = asDocument(loadJson("data/platforms.json"));
const genreDocument = asDocument(loadJson("data/genres.json"));
const sourceDocument = asDocument(loadJson("data/source-rights.json"));
const assetDocument = asDocument(loadJson("data/assets-manifest.json"));
const coverageDocument = asDocument(loadJson("data/coverage.json"));
export const MINIMUM_HUB_RECORDS = typeof coverageDocument.minimumHubRecords === "number" ? coverageDocument.minimumHubRecords : 2;
const platforms = asItems<PlatformRecord>(platformDocument, "data/platforms.json");
const genres = asItems<GenreRecord>(genreDocument, "data/genres.json");
const context = createContext(platforms, genres, sourceDocument, assetDocument);
const games = loadGames(context);
const platformById = new Map(platforms.map((platform) => [platform.id, platform]));
const genreById = new Map(genres.map((genre) => [genre.id, genre]));
const catalogGames: CatalogGame[] = games.map((game) => ({
  game,
  platforms: game.platforms.flatMap((id) => {
    const platform = platformById.get(id);
    return platform ? [platform] : [];
  }),
  genres: game.genres.flatMap((id) => {
    const genre = genreById.get(id);
    return genre ? [genre] : [];
  }),
}));
const catalogBySlug = new Map(catalogGames.map((entry) => [entry.game.slug, entry]));
const usedPlatformIds = new Set(catalogGames.flatMap(({ game }) => game.platforms));
const usedGenreIds = new Set(catalogGames.flatMap(({ game }) => game.genres));
const platformRecordCounts = new Map([...usedPlatformIds].map((id) => [id, catalogGames.filter(({ game }) => game.platforms.includes(id)).length]));
const genreRecordCounts = new Map([...usedGenreIds].map((id) => [id, catalogGames.filter(({ game }) => game.genres.includes(id)).length]));
const catalogSearchRecords = catalogGames.map(toCatalogSearchRecord);

export function getCatalogGames(): readonly CatalogGame[] {
  return catalogGames;
}

export function getCatalogGame(slug: string): CatalogGame | undefined {
  return catalogBySlug.get(slug);
}

export function getCatalogPlatforms(): PlatformRecord[] {
  return platforms.filter((platform) => platform.coverage === "populated" && usedPlatformIds.has(platform.id));
}

export function getCatalogPlatform(id: string): PlatformRecord | undefined {
  return getCatalogPlatforms().find((platform) => platform.id === id);
}

export function getPlatformHubs(): PlatformRecord[] {
  return getCatalogPlatforms().filter((platform) => (platformRecordCounts.get(platform.id) ?? 0) >= MINIMUM_HUB_RECORDS);
}

export function getPlatformHub(id: string): PlatformRecord | undefined {
  return getPlatformHubs().find((platform) => platform.id === id);
}

export function getPopulatedPlatforms(): PlatformRecord[] {
  return getCatalogPlatforms();
}

export function getCatalogGenres(): GenreRecord[] {
  return genres.filter((genre) => usedGenreIds.has(genre.id));
}

export function getCatalogGenre(id: string): GenreRecord | undefined {
  return getCatalogGenres().find((genre) => genre.id === id);
}

export function getGenreHubs(): GenreRecord[] {
  return getCatalogGenres().filter((genre) => (genreRecordCounts.get(genre.id) ?? 0) >= MINIMUM_HUB_RECORDS);
}

export function getGenreHub(id: string): GenreRecord | undefined {
  return getGenreHubs().find((genre) => genre.id === id);
}

export function getEditorialSignals(game: GameRecord): EditorialSignal[] {
  return game.signals.filter((signal): signal is EditorialSignal => signal.kind === "editorial");
}

export function getGameEditorialArt(game: GameRecord) {
  return selectEditorialAsset(game.assets, context.assetById);
}

export function getPublicGameSignals(game: GameRecord): PublicSignalSummaries {
  return getPublicSignalSummaries(game, context);
}

export function getGameBoxFront(game: GameRecord) {
  return selectApprovedBoxFrontAsset(game.assets, context.assetById);
}

export function toCatalogSearchRecord({ game, platforms, genres }: CatalogGame): CatalogSearchRecord {
  const evidenceKinds = [...new Set(game.signals.map((signal) => signal.kind))];
  const evidenceLabels = evidenceKinds.map((kind) => kind === "editorial" ? "GameAtlas editorial" : kind);
  const criticalLink = game.links.find((link) => link.kind === "critical");
  const editorialLabel = getEditorialSignals(game).length > 0 ? game.sources.includes("wikidata-fact-reference") ? "GameAtlas catalog entry" : "GameAtlas pick" : undefined;
  const publicSignals = getPublicSignalSummaries(game, context);
  const searchText = normalizeSearchText([
    game.title,
    ...game.aliases,
    game.shortDescription,
    ...game.highlights,
    ...game.keywords,
    game.developer,
    game.publisher,
    ...platforms.map((platform) => platform.name),
    ...genres.map((genre) => genre.name),
  ].filter((value): value is string => Boolean(value)).join(" "));
  const catalogArt = getGameEditorialArt(game);
  const catalogArtPath = catalogArt ? site.publicUrl(catalogArt.path.replace(/^public\//, "")) : undefined;
  const packagePresentation = createPackagePresentation({
    title: game.title,
    platformIds: game.platforms,
    platformLabel: platforms.map((platform) => getPlatformDisplayLabel(platform)).join(" · "),
    releaseFormat: game.releaseFormat,
    editorialThumbnail: catalogArtPath && catalogArt?.alt ? { src: catalogArtPath, alt: catalogArt.alt } : undefined,
  });
  return {
    slug: game.slug,
    title: game.title,
    aliases: [...game.aliases],
    emoji: game.emoji,
    artPath: catalogArtPath,
    artAlt: catalogArt?.alt,
    packageThumbnail: {
      formatId: packagePresentation.formatId,
      kind: packagePresentation.formatKind,
      aspectRatio: packagePresentation.thumbnail.aspectRatio,
      depthRatio: packagePresentation.thumbnail.depthRatio,
      frontPath: packagePresentation.thumbnail.frontSrc,
      frontAlt: packagePresentation.thumbnail.frontAlt,
    },
    developer: game.developer,
    publisher: game.publisher,
    editorialLabel,
    criticalLink: criticalLink ? { label: criticalLink.label, url: criticalLink.url } : undefined,
    criticSummary: publicSignals.critic,
    salesSummary: publicSignals.sales,
    shortDescription: game.shortDescription,
    searchText,
    releaseYear: game.release.year,
    releaseDate: game.release.date,
    releaseFormat: game.releaseFormat,
    platformIds: platforms.map((platform) => platform.id),
    platformLabels: platforms.map((platform) => platform.name),
    platformDisplayLabels: platforms.map((platform) => getPlatformDisplayLabel(platform)),
    platformHubIds: platforms.filter((platform) => (platformRecordCounts.get(platform.id) ?? 0) >= MINIMUM_HUB_RECORDS).map((platform) => platform.id),
    genreIds: genres.map((genre) => genre.id),
    genreLabels: genres.map((genre) => genre.name),
    genreHubIds: genres.filter((genre) => (genreRecordCounts.get(genre.id) ?? 0) >= MINIMUM_HUB_RECORDS).map((genre) => genre.id),
    evidenceKinds,
    evidenceLabels,
  };
}

export function getCatalogSearchRecords(): readonly CatalogSearchRecord[] {
  return catalogSearchRecords;
}
