import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

const root = process.cwd();
const inventoryPath = "data/curation/2026-08-15-wikidata-catalog-1000.json";
const sourceUrl = "https://dmoliveira.github.io/best-nintendo-pc-games/";
const reviewDate = "2026-08-15";
const recheckDate = "2026-09-15";
const generatedAssetRoot = "public/assets/games/catalog-1000";
const generatedAssetPrefix = "gameatlas-catalog-1000-";
const palettes = [
  ["#09111f", "#ff8f78", "#d5f27b"],
  ["#09111f", "#7be7ff", "#e7ebf0"],
  ["#101127", "#b89cff", "#ffcf70"],
  ["#07151b", "#79e4bc", "#ff8f78"],
  ["#15101f", "#ff9bc6", "#79d7ff"],
];

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value, null, 2) + "\n");
}

function normalize(value) {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function assetId(candidate) {
  return generatedAssetPrefix + candidate.wikidataId.toLocaleLowerCase("en-US");
}

function assetPath(candidate) {
  return generatedAssetRoot + "/" + candidate.wikidataId.toLocaleLowerCase("en-US") + ".svg";
}

function assetAlt(candidate) {
  return "Abstract GameAtlas art tile for " + candidate.title;
}

function numericSeed(value) {
  return Number.parseInt(digest(value).slice(0, 8), 16);
}

function createSvg(candidate) {
  const value = numericSeed(candidate.wikidataId);
  const [base, accent, light] = palettes[value % palettes.length];
  const firstX = 80 + (value % 170);
  const firstY = 70 + ((value >>> 6) % 100);
  const secondX = 590 + ((value >>> 13) % 150);
  const secondY = 220 + ((value >>> 20) % 140);
  const curve = 175 + ((value >>> 3) % 170);
  const rotation = (value % 42) - 21;
  const id = candidate.wikidataId.toLocaleLowerCase("en-US");
  return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 800 450\" role=\"img\" aria-label=\"Abstract GameAtlas art tile\">\n" +
    "  <defs>\n" +
    "    <linearGradient id=\"" + id + "-g\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">\n" +
    "      <stop offset=\"0\" stop-color=\"" + base + "\"/>\n" +
    "      <stop offset=\"1\" stop-color=\"" + accent + "\" stop-opacity=\".52\"/>\n" +
    "    </linearGradient>\n" +
    "    <pattern id=\"" + id + "-grid\" width=\"42\" height=\"42\" patternUnits=\"userSpaceOnUse\">\n" +
    "      <path d=\"M42 0H0V42\" fill=\"none\" stroke=\"#e7ebf0\" stroke-opacity=\".12\"/>\n" +
    "    </pattern>\n" +
    "  </defs>\n" +
    "  <rect width=\"800\" height=\"450\" fill=\"url(#" + id + "-g)\"/>\n" +
    "  <rect width=\"800\" height=\"450\" fill=\"url(#" + id + "-grid)\" opacity=\".42\"/>\n" +
    "  <circle cx=\"" + firstX + "\" cy=\"" + firstY + "\" r=\"118\" fill=\"none\" stroke=\"" + light + "\" stroke-opacity=\".55\" stroke-width=\"3\"/>\n" +
    "  <circle cx=\"" + secondX + "\" cy=\"" + secondY + "\" r=\"178\" fill=\"none\" stroke=\"" + accent + "\" stroke-opacity=\".4\" stroke-width=\"2\"/>\n" +
    "  <path d=\"M-30 " + curve + " C160 " + (curve + 4) + " 280 430 480 245 S690 80 830 155\" fill=\"none\" stroke=\"" + light + "\" stroke-opacity=\".7\" stroke-width=\"18\"/>\n" +
    "  <path d=\"M-40 405 C130 240 250 470 430 300 S650 180 840 45\" fill=\"none\" stroke=\"#e7ebf0\" stroke-opacity=\".2\" stroke-width=\"2\" transform=\"rotate(" + rotation + " 400 225)\"/>\n" +
    "  <circle cx=\"" + (firstX + 34) + "\" cy=\"" + Math.max(36, firstY - 22) + "\" r=\"8\" fill=\"" + accent + "\"/>\n" +
    "  <circle cx=\"" + Math.max(32, secondX - 56) + "\" cy=\"" + Math.min(420, secondY + 38) + "\" r=\"6\" fill=\"" + light + "\"/>\n" +
    "</svg>\n";
}

function createRecord(candidate) {
  const record = {
    schemaVersion: 1,
    slug: candidate.slug,
    title: candidate.title,
    aliases: candidate.aliases,
    emoji: candidate.emoji,
    shortDescription: candidate.editorialCopy.shortDescription,
    highlights: candidate.editorialCopy.highlights,
    release: { year: candidate.wikidataReleaseYear, scope: candidate.releaseScope },
    platformAssociationScope: candidate.platformAssociationScope,
    platforms: [candidate.platformId],
    genres: candidate.genreIds,
    keywords: [candidate.title, candidate.platformId, ...candidate.genreIds, "source-linked", "wikidata"],
    signals: [{
      kind: "editorial",
      provider: "GameAtlas",
      label: "GameAtlas catalog method",
      rationale: candidate.editorialCopy.rationale,
      sourceId: "gameatlas-editorial",
      sourceUrl,
      capturedAt: reviewDate,
      verificationStatus: "verified",
      rightsStatus: "approved",
      reviewedBy: candidate.review.reviewedBy,
      rightsReviewedAt: reviewDate,
      recheckAt: recheckDate,
      evidenceState: "catalog-method",
    }],
    links: [{ label: "External/reference — Wikidata structured data", url: candidate.entityUrl, kind: "reference" }],
    assets: [{ path: assetPath(candidate), alt: assetAlt(candidate), provenanceId: assetId(candidate) }],
    sources: ["wikidata-fact-reference", "gameatlas-editorial"],
  };
  if (candidate.platformId === "nintendo-dsi") record.releaseFormat = "digital";
  return record;
}

function createManifestEntry(candidate) {
  const svg = createSvg(candidate);
  return {
    assetId: assetId(candidate),
    path: assetPath(candidate),
    assetKind: "generated-original-editorial",
    creatorOrSource: "GameAtlas repository authors",
    licenseOrPermissionUrl: null,
    notApplicableReason: "Original abstract SVG generated by the GameAtlas repository; no third-party artwork, logo, character, screenshot, packaging, or trademark is used.",
    attribution: "GameAtlas project",
    generatedOrAcquiredAt: reviewDate,
    intendedUse: "game-card-thumbnail",
    altText: assetAlt(candidate),
    reviewedBy: "GameAtlas deterministic asset process",
    rightsReviewedAt: reviewDate,
    recheckAt: null,
    promptOrGenerationBrief: "Original abstract atlas tile generated deterministically from a Wikidata QID and a generic geometric palette; exclude title text, logos, characters, screenshots, packaging, trademarks, and franchise-specific visual motifs.",
    modelOrTool: "GameAtlas deterministic SVG generator",
    outputOrAssetId: assetId(candidate),
    contentChecksum: "sha256:" + digest(svg),
  };
}

function assertInventory(inventory) {
  if (inventory?.schemaVersion !== 1 || inventory?.target?.additions !== 897 || inventory?.target?.totalRecords !== 1000 || !Array.isArray(inventory.candidates) || inventory.candidates.length !== 897) {
    throw new Error("Catalog-1000 inventory must contain exactly 897 candidates for a 1,000-record target");
  }
  const qids = new Set();
  const slugs = new Set();
  for (const candidate of inventory.candidates) {
    if (!/^Q\d+$/.test(candidate.wikidataId ?? "") || qids.has(candidate.wikidataId)) throw new Error("Catalog-1000 inventory has an invalid or duplicate Wikidata QID");
    if (!candidate.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.slug) || slugs.has(candidate.slug)) throw new Error("Catalog-1000 inventory has an invalid or duplicate generated slug");
    if (candidate.entityUrl !== "https://www.wikidata.org/wiki/" + candidate.wikidataId) throw new Error("Catalog-1000 inventory entity URL must match its Wikidata QID");
    if (!Number.isInteger(candidate.wikidataReleaseYear) || candidate.wikidataReleaseYear < 1950 || candidate.wikidataReleaseYear > 2100) throw new Error("Catalog-1000 inventory has an invalid Wikidata release year");
    if (candidate.releaseScope !== "earliest-title-release" || candidate.platformAssociationScope !== "source-listed") throw new Error("Catalog-1000 inventory has invalid title-release/platform-association semantics");
    qids.add(candidate.wikidataId);
    slugs.add(candidate.slug);
  }
}

function generatedGameFiles() {
  return fs.readdirSync(path.join(root, "data/games")).filter((file) => file.endsWith(".json")).filter((file) => {
    const game = readJson(path.join("data/games", file));
    return Array.isArray(game.sources) && game.sources.includes("wikidata-fact-reference");
  }).sort();
}

function generatedAssetFiles() {
  const directory = path.join(root, generatedAssetRoot);
  return fs.existsSync(directory) ? fs.readdirSync(directory).filter((file) => file.endsWith(".svg")).sort().map((file) => generatedAssetRoot + "/" + file) : [];
}

function checkOutput(candidates, manifest) {
  const failures = [];
  const expectedSlugs = new Set(candidates.map((candidate) => candidate.slug + ".json"));
  const actualSlugs = new Set(generatedGameFiles());
  for (const file of actualSlugs) if (!expectedSlugs.has(file)) failures.push("stale generated game record " + file);
  for (const file of expectedSlugs) if (!actualSlugs.has(file)) failures.push("missing generated game record " + file);
  const expectedAssetPaths = new Set(candidates.map(assetPath));
  const actualAssetPaths = new Set(generatedAssetFiles());
  for (const file of actualAssetPaths) if (!expectedAssetPaths.has(file)) failures.push("stale generated SVG " + file);
  for (const file of expectedAssetPaths) if (!actualAssetPaths.has(file)) failures.push("missing generated SVG " + file);
  const expectedAssetIds = new Set(candidates.map(assetId));
  const actualEntries = manifest.assets.filter((entry) => String(entry.assetId ?? "").startsWith(generatedAssetPrefix));
  for (const entry of actualEntries) if (!expectedAssetIds.has(entry.assetId)) failures.push("stale generated manifest entry " + entry.assetId);
  for (const candidate of candidates) {
    const recordPath = "data/games/" + candidate.slug + ".json";
    try {
      if (!isDeepStrictEqual(readJson(recordPath), createRecord(candidate))) failures.push(recordPath + " differs from the frozen inventory");
    } catch {
      failures.push(recordPath + " is missing or invalid");
    }
    const svgPath = assetPath(candidate);
    const expectedSvg = createSvg(candidate);
    const actualSvg = fs.existsSync(path.join(root, svgPath)) ? fs.readFileSync(path.join(root, svgPath), "utf8") : undefined;
    if (actualSvg !== expectedSvg) failures.push(svgPath + " differs from the deterministic generator");
    const entry = manifest.assets.find((asset) => asset.assetId === assetId(candidate));
    if (!isDeepStrictEqual(entry, createManifestEntry(candidate))) failures.push(svgPath + " manifest entry differs from the frozen inventory");
  }
  if (failures.length) throw new Error("Catalog-1000 generation check failed:\n" + failures.map((failure) => "- " + failure).join("\n"));
}

function writeOutput(candidates, manifest) {
  const existingGenerated = generatedGameFiles();
  const expectedFiles = new Set(candidates.map((candidate) => candidate.slug + ".json"));
  const staleFiles = existingGenerated.filter((file) => !expectedFiles.has(file));
  if (staleFiles.length) throw new Error("Refusing to overwrite a stale generated catalog set: " + staleFiles.join(", "));
  for (const candidate of candidates) {
    writeJson("data/games/" + candidate.slug + ".json", createRecord(candidate));
    const destination = path.join(root, assetPath(candidate));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, createSvg(candidate));
  }
  const ids = new Set(candidates.map(assetId));
  const paths = new Set(candidates.map(assetPath));
  manifest.assets = [...manifest.assets.filter((entry) => !ids.has(entry.assetId) && !paths.has(entry.path)), ...candidates.map(createManifestEntry)];
  writeJson("data/assets-manifest.json", manifest);
}

const check = process.argv.includes("--check");
const write = process.argv.includes("--write");
if ((check && write) || (!check && !write)) {
  console.error("Usage: node scripts/generate-catalog-1000.mjs --check|--write");
  process.exit(1);
}
try {
  const inventory = readJson(inventoryPath);
  assertInventory(inventory);
  const manifest = readJson("data/assets-manifest.json");
  if (!Array.isArray(manifest.assets)) throw new Error("Asset manifest must contain an assets array");
  if (check) {
    checkOutput(inventory.candidates, manifest);
    console.log("Catalog-1000 generation check passed (897 generated records).");
  } else {
    writeOutput(inventory.candidates, manifest);
    console.log("Generated 897 catalog records and abstract SVG assets from the frozen Wikidata inventory.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
