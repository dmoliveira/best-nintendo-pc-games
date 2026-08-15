import fs from "node:fs";
import path from "node:path";
import { isGenreHubEligible, isPlatformHubEligible, normalizeMinimumHubRecords } from "../lib/catalog/hub-policy.mjs";
import { buildMaintenanceUrlInventory } from "./maintenance-url-inventory.mjs";

const root = process.cwd();
const outputPath = path.join(root, "data/catalog-coverage-report.json");

function readJson(relativePath, repositoryRoot = root) {
  return JSON.parse(fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8"));
}

function sortedObject(entries) {
  return Object.fromEntries([...entries].sort(([left], [right]) => left.localeCompare(right)));
}

function countBy(records, selector) {
  const counts = new Map();
  for (const record of records) {
    const key = selector(record);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return sortedObject(counts);
}

export function buildCoverageReport(repositoryRoot = root) {
  const gamesDirectory = path.join(repositoryRoot, "data/games");
  const games = fs.readdirSync(gamesDirectory).filter((file) => file.endsWith(".json")).sort().map((file) => JSON.parse(fs.readFileSync(path.join(gamesDirectory, file), "utf8")));
  const platformsDocument = readJson("data/platforms.json", repositoryRoot);
  const genresDocument = readJson("data/genres.json", repositoryRoot);
  const coverageDocument = readJson("data/coverage.json", repositoryRoot);
  const platforms = platformsDocument.items ?? [];
  const genres = genresDocument.items ?? [];
  const coverage = new Map((coverageDocument.items ?? []).map((item) => [item.platformId, item]));
  const platformCounts = new Map(platforms.map((platform) => [platform.id, games.filter((game) => game.platforms?.includes(platform.id)).length]));
  const genreCounts = new Map(genres.map((genre) => [genre.id, games.filter((game) => game.genres?.includes(genre.id)).length]));
  const minimumHubRecords = normalizeMinimumHubRecords(coverageDocument.minimumHubRecords);
  const signals = games.flatMap((game) => game.signals ?? []);
  const links = games.flatMap((game) => game.links ?? []);
  const optionalFields = {
    developer: games.filter((game) => !game.developer).length,
    publisher: games.filter((game) => !game.publisher).length,
    officialLink: games.filter((game) => !(game.links ?? []).some((link) => link.kind === "official")).length,
    storeLink: games.filter((game) => !(game.links ?? []).some((link) => link.kind === "store")).length,
  };

  return {
    schemaVersion: 1,
    catalog: {
      games: games.length,
      gamesWithAssets: games.filter((game) => Array.isArray(game.assets) && game.assets.length > 0).length,
      gamesWithEditorialContext: games.filter((game) => (game.signals ?? []).some((signal) => signal.kind === "editorial")).length,
    },
    platforms: platforms.map((platform) => ({
      id: platform.id,
      name: platform.name,
      family: platform.family,
      coverage: platform.coverage,
      catalogTarget: coverage.get(platform.id)?.catalogTarget ?? null,
      records: platformCounts.get(platform.id) ?? 0,
      hubEligible: isPlatformHubEligible(platform, platformCounts.get(platform.id) ?? 0, minimumHubRecords),
    })).sort((left, right) => left.id.localeCompare(right.id)),
    genres: genres.map((genre) => ({
      id: genre.id,
      name: genre.name,
      records: genreCounts.get(genre.id) ?? 0,
      hubEligible: isGenreHubEligible(genreCounts.get(genre.id) ?? 0, minimumHubRecords),
    })).sort((left, right) => left.id.localeCompare(right.id)),
    links: {
      uniquePublishedUrls: buildMaintenanceUrlInventory(repositoryRoot).length,
      catalogLinks: links.length,
      byKind: countBy(links, (link) => link.kind),
    },
    signals: {
      byKind: countBy(signals, (signal) => signal.kind),
      byEvidenceState: countBy(signals, (signal) => signal.evidenceState),
      licensedNumericSignals: signals.filter((signal) => signal.evidenceState === "licensed-signal").length,
    },
    optionalFields,
  };
}

function serializedReport(repositoryRoot = root) {
  return `${JSON.stringify(buildCoverageReport(repositoryRoot), null, 2)}\n`;
}

function main() {
  const mode = process.argv.includes("--write") ? "write" : process.argv.includes("--check") ? "check" : "print";
  const output = serializedReport();
  if (mode === "write") {
    fs.writeFileSync(outputPath, output);
    console.log(`Catalog coverage report written to ${path.relative(root, outputPath)}.`);
    return;
  }
  if (mode === "check") {
    if (!fs.existsSync(outputPath)) throw new Error(`missing ${path.relative(root, outputPath)}; run npm run report:coverage -- --write`);
    if (fs.readFileSync(outputPath, "utf8") !== output) throw new Error(`${path.relative(root, outputPath)} is stale; run npm run report:coverage -- --write`);
    console.log(`Catalog coverage report is current (${buildCoverageReport().catalog.games} games).`);
    return;
  }
  process.stdout.write(output);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
