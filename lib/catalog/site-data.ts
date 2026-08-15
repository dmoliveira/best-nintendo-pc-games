import fs from "node:fs";
import path from "node:path";
import { localTodayKey } from "../date-policy.mjs";
import { normalizeSearchText, type CatalogSearchRecord } from "./search";
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
  const assets = (assetDocument.assets ?? []) as Array<{ assetId: string; path: string }>;
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
    assetById: new Map(assets.map((asset) => [asset.assetId, { path: asset.path }])),
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

export function getCatalogGames(): readonly CatalogGame[] {
  return catalogGames;
}

export function getCatalogGame(slug: string): CatalogGame | undefined {
  return catalogBySlug.get(slug);
}

export function getPopulatedPlatforms(): PlatformRecord[] {
  return platforms.filter((platform) => platform.coverage === "populated");
}

export function getEditorialSignals(game: GameRecord): EditorialSignal[] {
  return game.signals.filter((signal): signal is EditorialSignal => signal.kind === "editorial");
}


export function toCatalogSearchRecord({ game, platforms, genres }: CatalogGame): CatalogSearchRecord {
  const evidenceKinds = [...new Set(game.signals.map((signal) => signal.kind))];
  const evidenceLabels = evidenceKinds.map((kind) => kind === "editorial" ? "GameAtlas editorial" : kind);
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
  return {
    slug: game.slug,
    title: game.title,
    aliases: [...game.aliases],
    emoji: game.emoji,
    shortDescription: game.shortDescription,
    searchText,
    releaseYear: game.release.year,
    releaseFormat: game.releaseFormat,
    platformIds: platforms.map((platform) => platform.id),
    platformLabels: platforms.map((platform) => platform.name),
    genreIds: genres.map((genre) => genre.id),
    genreLabels: genres.map((genre) => genre.name),
    evidenceKinds,
    evidenceLabels,
  };
}

export function getCatalogSearchRecords(): readonly CatalogSearchRecord[] {
  return catalogGames.map(toCatalogSearchRecord);
}
