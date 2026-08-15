import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

const root = process.cwd();
const inventoryPath = "data/curation/2026-08-15-curated-catalog-expansion.json";
const reviewDate = "2026-08-15";
const recheckDate = "2026-09-15";
const sourceUrl = "https://dmoliveira.github.io/best-nintendo-pc-games/";
const batches = {
  "legacy-home": new Set(["nintendo-nes", "nintendo-snes", "nintendo-64", "nintendo-gamecube"]),
  "modern-home": new Set(["nintendo-wii", "nintendo-wii-u", "nintendo-switch", "nintendo-switch-2"]),
  "legacy-handheld": new Set(["game-boy", "game-boy-color", "game-boy-advance", "nintendo-ds"]),
  "modern-handheld-pc": new Set(["nintendo-dsi", "nintendo-3ds", "nintendo-new-3ds", "pc-windows"]),
};
const palettes = [
  ["#09111f", "#ff8f78", "#d5f27b"],
  ["#09111f", "#7be7ff", "#e7ebf0"],
  ["#101127", "#b89cff", "#ffcf70"],
  ["#07151b", "#79e4bc", "#ff8f78"],
  ["#15101f", "#ff9bc6", "#79d7ff"],
];

function usage() {
  console.log("Usage: node scripts/generate-curated-catalog-expansion.mjs [--batch <name>] [--check]");
  console.log(`Batches: ${Object.keys(batches).join(", ")}`);
}

function parseArguments(argv) {
  let batch;
  let check = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--check") {
      check = true;
    } else if (argument === "--batch") {
      batch = argv[index + 1];
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (batch && !batches[batch]) throw new Error(`Unknown batch: ${batch}`);
  return { batch, check };
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function digest(value) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function gameAssetPath(slug) {
  return `public/assets/games/${slug}.svg`;
}

function gameAssetId(slug) {
  return `gameatlas-art-${slug}`;
}

function createRecord(candidate) {
  const assetId = gameAssetId(candidate.slug);
  const record = {
    schemaVersion: 1,
    slug: candidate.slug,
    title: candidate.title,
    aliases: candidate.aliases,
    emoji: candidate.emoji,
    shortDescription: candidate.shortDescription,
    highlights: candidate.highlights,
    release: { year: candidate.releaseYear },
    platforms: [candidate.platformId],
    genres: candidate.genres,
    developer: candidate.developer,
    publisher: candidate.publisher,
    keywords: [candidate.title, ...candidate.keywords, candidate.platformId],
    signals: [{
      kind: "editorial",
      provider: "GameAtlas",
      label: "GameAtlas editorial selection",
      rationale: candidate.rationale,
      sourceId: "gameatlas-editorial",
      sourceUrl,
      capturedAt: reviewDate,
      verificationStatus: "verified",
      rightsStatus: "approved",
      reviewedBy: "GameAtlas editorial review",
      rightsReviewedAt: reviewDate,
      recheckAt: recheckDate,
      evidenceState: "original-editorial",
    }],
    links: [candidate.link],
    assets: [{
      path: gameAssetPath(candidate.slug),
      alt: `Abstract GameAtlas art tile for ${candidate.title}`,
      provenanceId: assetId,
    }],
    sources: [candidate.linkSourceId, "gameatlas-editorial"],
  };
  if (candidate.platformId === "nintendo-dsi") record.releaseFormat = "digital";
  return record;
}

function createSvg(slug) {
  const value = digest(slug);
  const [base, accent, light] = palettes[value % palettes.length];
  const firstX = 92 + (value % 140);
  const firstY = 72 + ((value >>> 6) % 96);
  const secondX = 620 + ((value >>> 13) % 118);
  const secondY = 250 + ((value >>> 20) % 110);
  const curve = 190 + ((value >>> 4) % 150);
  const rotation = (value % 35) - 17;
  const id = slug.replace(/[^a-z0-9-]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" role="img" aria-label="Abstract GameAtlas art tile">
  <defs>
    <linearGradient id="${id}-g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${base}"/>
      <stop offset="1" stop-color="${accent}" stop-opacity=".52"/>
    </linearGradient>
    <pattern id="${id}-grid" width="42" height="42" patternUnits="userSpaceOnUse">
      <path d="M42 0H0V42" fill="none" stroke="#e7ebf0" stroke-opacity=".12"/>
    </pattern>
  </defs>
  <rect width="800" height="450" fill="url(#${id}-g)"/>
  <rect width="800" height="450" fill="url(#${id}-grid)" opacity=".42"/>
  <circle cx="${firstX}" cy="${firstY}" r="118" fill="none" stroke="${light}" stroke-opacity=".55" stroke-width="3"/>
  <circle cx="${secondX}" cy="${secondY}" r="178" fill="none" stroke="${accent}" stroke-opacity=".4" stroke-width="2"/>
  <path d="M-30 ${curve} C160 ${curve + 4} 280 430 480 245 S690 80 830 155" fill="none" stroke="${light}" stroke-opacity=".7" stroke-width="18"/>
  <path d="M-40 405 C130 240 250 470 430 300 S650 180 840 45" fill="none" stroke="#e7ebf0" stroke-opacity=".2" stroke-width="2" transform="rotate(${rotation} 400 225)"/>
  <circle cx="${firstX + 34}" cy="${Math.max(36, firstY - 22)}" r="8" fill="${accent}"/>
  <circle cx="${Math.max(32, secondX - 56)}" cy="${Math.min(420, secondY + 38)}" r="6" fill="${light}"/>
</svg>
`;
}

function createManifestEntry(candidate) {
  const assetId = gameAssetId(candidate.slug);
  return {
    assetId,
    path: gameAssetPath(candidate.slug),
    assetKind: "generated-original-editorial",
    creatorOrSource: "GameAtlas repository authors",
    licenseOrPermissionUrl: null,
    notApplicableReason: "Original abstract SVG generated by the GameAtlas repository; no third-party artwork, logo, character, screenshot, or packaging is used.",
    attribution: "GameAtlas project",
    generatedOrAcquiredAt: reviewDate,
    intendedUse: "game-card-thumbnail",
    altText: `Abstract GameAtlas art tile for ${candidate.title}`,
    reviewedBy: "GameAtlas asset review",
    rightsReviewedAt: reviewDate,
    recheckAt: null,
    promptOrGenerationBrief: "Original abstract atlas tile generated deterministically from a catalog identifier and a generic geometric palette; exclude titles, logos, characters, screenshots, packaging, and franchise-specific visual motifs.",
    modelOrTool: "GameAtlas deterministic SVG generator",
    outputOrAssetId: assetId,
  };
}

function normalizeIdentity(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function assertInventory(inventory) {
  if (inventory?.schemaVersion !== 1 || !Array.isArray(inventory.candidates) || inventory.candidates.length !== 60) {
    throw new Error("Catalog expansion inventory must contain exactly 60 candidates");
  }
  const slugs = new Set();
  for (const candidate of inventory.candidates) {
    if (!candidate?.slug || slugs.has(candidate.slug)) throw new Error(`Catalog expansion inventory has a duplicate or missing slug: ${candidate?.slug}`);
    if (!candidate.title || !candidate.platformId || !Array.isArray(candidate.genres) || !candidate.link?.url || !candidate.linkSourceId) {
      throw new Error(`Catalog expansion inventory is incomplete for ${candidate.slug}`);
    }
    if (!Array.isArray(candidate.aliases) || candidate.aliases.some((alias) => [candidate.title, candidate.slug].some((canonical) => normalizeIdentity(alias) === normalizeIdentity(canonical)))) {
      throw new Error(`Catalog expansion inventory has a title- or slug-equivalent alias for ${candidate.slug}`);
    }
    slugs.add(candidate.slug);
  }
}

function readOrMissing(relativePath) {
  const target = path.join(root, relativePath);
  return fs.existsSync(target) ? fs.readFileSync(target, "utf8") : undefined;
}

function checkOutput(candidates, manifest) {
  const failures = [];
  for (const candidate of candidates) {
    const recordPath = `data/games/${candidate.slug}.json`;
    try {
      const actual = readJson(recordPath);
      if (!isDeepStrictEqual(actual, createRecord(candidate))) failures.push(`${recordPath} is not generated from the canonical inventory`);
    } catch {
      failures.push(`${recordPath} is missing or invalid JSON`);
    }
    const assetPath = gameAssetPath(candidate.slug);
    if (readOrMissing(assetPath) !== createSvg(candidate.slug)) failures.push(`${assetPath} is missing or differs from the deterministic generator`);
    const manifestEntry = manifest.assets.find((asset) => asset.assetId === gameAssetId(candidate.slug));
    if (!isDeepStrictEqual(manifestEntry, createManifestEntry(candidate))) failures.push(`${assetPath} manifest entry is missing or differs from the canonical inventory`);
  }
  if (failures.length) throw new Error(`Catalog expansion generation check failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
}

function writeOutput(candidates, manifest) {
  for (const candidate of candidates) {
    writeJson(`data/games/${candidate.slug}.json`, createRecord(candidate));
    const assetPath = path.join(root, gameAssetPath(candidate.slug));
    fs.mkdirSync(path.dirname(assetPath), { recursive: true });
    fs.writeFileSync(assetPath, createSvg(candidate.slug));
  }
  const targetAssetIds = new Set(candidates.map((candidate) => gameAssetId(candidate.slug)));
  const targetAssetPaths = new Set(candidates.map((candidate) => gameAssetPath(candidate.slug)));
  manifest.assets = [
    ...manifest.assets.filter((asset) => !targetAssetIds.has(asset.assetId) && !targetAssetPaths.has(asset.path)),
    ...candidates.map(createManifestEntry),
  ];
  writeJson("data/assets-manifest.json", manifest);
}

try {
  const { batch, check } = parseArguments(process.argv.slice(2));
  const inventory = readJson(inventoryPath);
  assertInventory(inventory);
  const candidates = batch ? inventory.candidates.filter((candidate) => batches[batch].has(candidate.platformId)) : inventory.candidates;
  if (!candidates.length) throw new Error(`No candidates selected for ${batch ?? "all"}`);
  const manifest = readJson("data/assets-manifest.json");
  if (!Array.isArray(manifest.assets)) throw new Error("Asset manifest must contain an assets array");
  if (check) {
    checkOutput(candidates, manifest);
    console.log(`Catalog expansion generation check passed (${candidates.length} records${batch ? `, ${batch}` : ""}).`);
  } else {
    writeOutput(candidates, manifest);
    console.log(`Generated ${candidates.length} catalog records and assets${batch ? ` for ${batch}` : ""}.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
