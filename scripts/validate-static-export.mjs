import fs from "node:fs";
import path from "node:path";
import { validateGameArtExport } from "../lib/box-art/static-export.mjs";
import { isGenreHubEligible, isPlatformHubEligible, normalizeMinimumHubRecords } from "../lib/catalog/hub-policy.mjs";
import { publicArtifactCredentialIssue } from "../lib/static-export-security.mjs";

const outDir = path.resolve(process.env.OUT_DIR ?? "out");
const rootDir = process.cwd();
const expectedBasePath = (process.env.EXPECTED_BASE_PATH ?? "/best-nintendo-pc-games").replace(/\/$/, "");
const expectedSiteUrl = process.env.EXPECTED_SITE_URL ?? process.env.SITE_URL ?? `https://dmoliveira.github.io${expectedBasePath}`;
let expectedOrigin = "";
try {
  const parsedExpectedSiteUrl = new URL(expectedSiteUrl);
  if (parsedExpectedSiteUrl.protocol !== "https:") fail(`expected site URL must use HTTPS: ${expectedSiteUrl}`);
  expectedOrigin = parsedExpectedSiteUrl.origin;
} catch {
  fail(`expected site URL is invalid: ${expectedSiteUrl}`);
}
const expectedCatalogGameCount = 1000;
// App Router static exports include required Flight payloads for every client-navigable route.
const maximumArtifactBytes = 150 * 1024 * 1024;
const maximumHomePayloadBytes = 400 * 1024;
const maximumCatalogSearchIndexBytes = 2 * 1024 * 1024;
const expectedInitialCatalogCards = 24;
const requiredFiles = ["index.html", ".nojekyll", "robots.txt", "sitemap.xml", "og-image.png", "mark.svg", "catalog/index.html", "catalog-search-index.json", "docs/rights-and-support-policy/index.html"];
const forbiddenEvidenceFields = ["sourceUrl", "termsUrl", "rightsStatus", "verificationStatus", "capturedAt", "recheckAt"];
const forbiddenSearchIndexFields = [...forbiddenEvidenceFields, "rationale", "links", "provenanceId", "score", "scale", "count", "value", "rank"];
const forbiddenStructuredDataKeys = ["aggregateRating", "review", "reviewRating", "ratingValue", "ratingCount", "bestRating", "worstRating", "contentRating", "sales", "popularity"];

function fail(message) { console.error(`Static export validation failed: ${message}`); process.exitCode = 1; }
function escapeHtml(value) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#x27;"); }
function checkNoRawEvidence(html, location) { for (const field of forbiddenEvidenceFields) if (html.includes(field)) fail(`${location} leaks raw evidence field ${field}`); }
function structuredDataBlocks(html, location) {
  const blocks = [];
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { blocks.push(JSON.parse(match[1])); } catch { fail(`${location} contains invalid JSON-LD`); }
  }
  return blocks;
}
function checkStructuredData(html, location, requiredTypes) {
  const blocks = structuredDataBlocks(html, location);
  const types = new Set(blocks.flatMap((block) => Array.isArray(block) ? block : [block]).map((block) => block?.["@type"]).filter((type) => typeof type === "string"));
  for (const type of requiredTypes) if (!types.has(type)) fail(`${location} is missing JSON-LD type ${type}`);
  const visit = (value, key = "") => {
    if (Array.isArray(value)) { value.forEach((item) => visit(item, key)); return; }
    if (!value || typeof value !== "object") {
      if (["url", "@id", "item", "target"].includes(key) && typeof value === "string") {
        try {
          const parsed = new URL(value);
          if (parsed.protocol !== "https:" || parsed.origin !== expectedOrigin || (expectedBasePath && !parsed.pathname.startsWith(`${expectedBasePath}/`) && parsed.pathname !== expectedBasePath)) fail(`${location} has an origin or base-path-invalid JSON-LD ${key}: ${value}`);
        } catch { fail(`${location} has an invalid JSON-LD ${key}: ${value}`); }
      }
      return;
    }
    for (const [childKey, childValue] of Object.entries(value)) visit(childValue, childKey);
  };
  for (const block of blocks) visit(block);
  const serialized = JSON.stringify(blocks);
  for (const key of forbiddenStructuredDataKeys) if (new RegExp(`"${key}"\\s*:`).test(serialized)) fail(`${location} exposes forbidden JSON-LD field ${key}`);
}
if (!fs.existsSync(outDir)) { fail(`missing output directory ${outDir}`); process.exit(1); }
for (const file of requiredFiles) if (!fs.existsSync(path.join(outDir, file))) fail(`missing ${file}`);
const html = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
const homePayloadFiles = ["index.html", "index.txt", "__next._full.txt", "__next.__PAGE__.txt"];
const homePayloadBytes = homePayloadFiles.reduce((total, file) => total + (fs.existsSync(path.join(outDir, file)) ? fs.statSync(path.join(outDir, file)).size : 0), 0);
if (homePayloadBytes > maximumHomePayloadBytes) fail(`home HTML and Flight payload exceed ${maximumHomePayloadBytes} bytes (${homePayloadBytes} bytes)`);
const initialCardCount = (html.match(/<article class="game-card"/g) ?? []).length;
if (initialCardCount !== expectedInitialCatalogCards) fail(`home page must render exactly ${expectedInitialCatalogCards} initial catalog cards, found ${initialCardCount}`);
for (const expected of ["GameAtlas", "Best Nintendo", "Find a game.", "Explore the atlas.", "Start with a game.", "Search games", "Showing", "catalog games", "platform-glyph", "data-platform-accent", "data-attribute-glyph", "Critic score", "Score", "Card layout", "Display", "Cards per page", "Single-column layout on smaller screens.", "game-card-title-link", "game-card-topline-platforms", "Current result position", "no-JavaScript index"]) if (!html.includes(expected)) fail(`home page does not contain ${JSON.stringify(expected)}`);
if (!/<svg[^>]+aria-hidden="true"[^>]+focusable="false"/.test(html)) fail("home page is missing decorative, non-focusable catalog glyph semantics");
if (!/Showing[\s\S]{0,120}of[\s\S]{0,120}catalog games/.test(html)) fail("home page is missing the accessible result count");
if (!html.includes("docs/rights-and-support-policy")) fail("home page is missing the policy link");
if (html.includes("Catalog search is coming soon") || html.includes("Catalog coming soon") || html.includes("next discovery layer") || html.includes("discovery tools arrive") || html.includes("80+")) fail("home page exposes stale preview or unauthorized numeric messaging");
if (/\b(?:score|rating)\s*[:=]\s*\d+(?:\.\d+)?/i.test(html)) fail("home page exposes a numeric score or rating");
if (html.includes("action=\"/\"")) fail("home page contains a root-relative form action that bypasses the Pages base path");
checkNoRawEvidence(html, "home page");
checkStructuredData(html, "home page", ["WebSite"]);
const sitemap = fs.readFileSync(path.join(outDir, "sitemap.xml"), "utf8");
if (expectedBasePath && !sitemap.includes(expectedBasePath)) fail(`sitemap does not include ${expectedBasePath || "/"}`);
const gamesDir = path.join(rootDir, "data/games");
const gameFiles = fs.existsSync(gamesDir) ? fs.readdirSync(gamesDir).filter((file) => file.endsWith(".json")).sort() : [];
const gameRecords = gameFiles.map((file) => JSON.parse(fs.readFileSync(path.join(gamesDir, file), "utf8")));
if (gameFiles.length !== expectedCatalogGameCount) fail(`catalog must contain exactly ${expectedCatalogGameCount} game records, found ${gameFiles.length}`);
const sitemapGameLocations = [...sitemap.matchAll(/<loc>[^<]*\/games\/[^/<]+\/<\/loc>/g)];
if (sitemapGameLocations.length !== expectedCatalogGameCount) fail(`sitemap must contain exactly ${expectedCatalogGameCount} game entries, found ${sitemapGameLocations.length}`);
const catalogSearchIndex = JSON.parse(fs.readFileSync(path.join(outDir, "catalog-search-index.json"), "utf8"));
const catalogSearchIndexKeys = ["projectionDigest", "recordCount", "records", "schemaVersion"];
if (!catalogSearchIndex || typeof catalogSearchIndex !== "object" || Array.isArray(catalogSearchIndex) || JSON.stringify(Object.keys(catalogSearchIndex).sort()) !== JSON.stringify(catalogSearchIndexKeys) || catalogSearchIndex.schemaVersion !== 2 || catalogSearchIndex.recordCount !== expectedCatalogGameCount || !/^sha256:[a-f0-9]{64}$/.test(catalogSearchIndex.projectionDigest ?? "") || !Array.isArray(catalogSearchIndex.records) || catalogSearchIndex.records.length !== expectedCatalogGameCount) fail(`catalog search index must contain exactly ${expectedCatalogGameCount} digest-bound records`);
if (fs.statSync(path.join(outDir, "catalog-search-index.json")).size > maximumCatalogSearchIndexBytes) fail(`catalog search index exceeds ${maximumCatalogSearchIndexBytes} bytes`);
for (const field of forbiddenSearchIndexFields) if (JSON.stringify(catalogSearchIndex.records ?? []).includes(`"${field}":`)) fail(`catalog search index leaks raw evidence field ${field}`);
if (!(catalogSearchIndex.records ?? []).every((record) => (record?.releaseScope === "earliest-title-release" && record?.platformAssociationScope === "source-listed" && record?.packageThumbnail?.kind === "digital" && record?.packageThumbnail?.formatId === "catalog-reference" && record?.packageThumbnail?.depthRatio === 0) || (record?.releaseScope === "platform-release" && record?.platformAssociationScope === "verified-release"))) fail("catalog search index must retain explicit aligned semantics and flat reference presentation for source-listed records");
const initialCatalogSlugs = new Set(catalogSearchIndex.records.slice(0, expectedInitialCatalogCards).map((record) => record?.slug).filter((slug) => typeof slug === "string"));
const initialSourceListedRecords = catalogSearchIndex.records.slice(0, expectedInitialCatalogCards).filter((record) => record?.platformAssociationScope === "source-listed");
if (initialSourceListedRecords.length > 0 && (!html.includes("Wikidata-listed platforms") || !html.includes("Title year"))) fail("home cards must visibly scope generated Wikidata platform associations and title years");
const detailLinkCounts = new Map();
for (const match of html.matchAll(/<a[^>]+href="[^"]*\/games\/([^/"?]+)\/[^"]*"/g)) detailLinkCounts.set(match[1], (detailLinkCounts.get(match[1]) ?? 0) + 1);
if (initialCatalogSlugs.size !== expectedInitialCatalogCards) fail(`catalog search index must expose ${expectedInitialCatalogCards} unique initial slugs`);
for (const slug of initialCatalogSlugs) if (detailLinkCounts.get(slug) !== 1) fail(`home page must expose exactly one primary detail link for initial ${slug}, found ${detailLinkCounts.get(slug) ?? 0}`);
if (detailLinkCounts.size !== expectedInitialCatalogCards) fail(`home page must expose exactly ${expectedInitialCatalogCards} primary detail links, found ${detailLinkCounts.size}`);
const catalogIndexHtml = fs.readFileSync(path.join(outDir, "catalog/index.html"), "utf8");
if (!catalogIndexHtml.includes("Browse every game.")) fail("no-JavaScript catalog index is missing its heading");
if (!catalogIndexHtml.includes("Wikidata-listed platforms:")) fail("no-JavaScript catalog index must scope generated platform associations");
checkStructuredData(catalogIndexHtml, "catalog index", ["CollectionPage", "BreadcrumbList"]);
for (const game of gameRecords) if (!catalogIndexHtml.includes(`games/${game.slug}/`)) fail(`no-JavaScript catalog index is missing ${game.slug}`);
const policyHtml = fs.readFileSync(path.join(outDir, "docs/rights-and-support-policy/index.html"), "utf8");
if (!policyHtml.includes("Report a catalog correction") || !policyHtml.includes("catalog-correction.yml")) fail("policy page is missing the public catalog correction path");
const assetManifest = JSON.parse(fs.readFileSync(path.join(rootDir, "data/assets-manifest.json"), "utf8"));
const assetById = new Map((assetManifest.assets ?? []).map((asset) => [asset.assetId, asset]));
const usedPlatformIds = new Set(gameRecords.flatMap((game) => game.platforms ?? []));
const usedGenreIds = new Set(gameRecords.flatMap((game) => game.genres ?? []));
const platformsDocument = JSON.parse(fs.readFileSync(path.join(rootDir, "data/platforms.json"), "utf8"));
const genresDocument = JSON.parse(fs.readFileSync(path.join(rootDir, "data/genres.json"), "utf8"));
const coverageDocument = JSON.parse(fs.readFileSync(path.join(rootDir, "data/coverage.json"), "utf8"));
const minimumHubRecords = normalizeMinimumHubRecords(coverageDocument.minimumHubRecords);
const platformCounts = new Map([...usedPlatformIds].map((id) => [id, gameRecords.filter((game) => game.platforms?.includes(id)).length]));
const genreCounts = new Map([...usedGenreIds].map((id) => [id, gameRecords.filter((game) => game.genres?.includes(id)).length]));
const platformRecords = (platformsDocument.items ?? []).filter((platform) => usedPlatformIds.has(platform.id) && isPlatformHubEligible(platform, platformCounts.get(platform.id) ?? 0, minimumHubRecords));
const genreRecords = (genresDocument.items ?? []).filter((genre) => usedGenreIds.has(genre.id) && isGenreHubEligible(genreCounts.get(genre.id) ?? 0, minimumHubRecords));
for (const game of gameRecords) {
  const route = `games/${game.slug}/index.html`;
  const gamePath = path.join(outDir, route);
  if (!fs.existsSync(gamePath)) {
    fail(`missing static game route ${route}`);
    continue;
  }
  const gameHtml = fs.readFileSync(gamePath, "utf8");
  if (![game.title, escapeHtml(game.title)].some((title) => gameHtml.includes(title))) fail(`${route} does not contain its game title`);
  const expectedEvidenceLabel = game.signals?.some((signal) => signal?.kind === "editorial" && signal?.evidenceState === "catalog-method") ? "Catalog method" : "Original editorial";
  if (!gameHtml.includes(expectedEvidenceLabel)) fail(`${route} does not contain ${expectedEvidenceLabel} evidence labeling`);
  if (!gameHtml.includes('data-attribute-glyph="year"') || !gameHtml.includes("detail-label")) fail(`${route} is missing text-backed metadata glyphs`);
  if (game.release?.scope === "earliest-title-release" || game.platformAssociationScope === "source-listed") {
    if (game.release?.scope !== "earliest-title-release" || game.platformAssociationScope !== "source-listed" || !gameHtml.includes("Earliest documented title release") || !gameHtml.includes("Title year") || !gameHtml.includes("Wikidata-listed platform") || !gameHtml.includes("do not establish a platform-specific release date") || !gameHtml.includes("no platform-specific package is implied")) fail(`${route} must visibly distinguish a title year and Wikidata-listed platform from a platform release date or package`);
  }
  for (const link of (game.links ?? []).filter((candidate) => candidate.kind === "critical")) if (!gameHtml.includes(link.url)) fail(`${route} is missing its outbound critical context link`);
  if (gameHtml.includes("80+") || /(?:popularity value|popularity rank)/i.test(gameHtml)) fail(`${route} exposes unauthorized numeric evidence messaging`);
  checkNoRawEvidence(gameHtml, route);
  checkStructuredData(gameHtml, route, ["VideoGame", "BreadcrumbList"]);
  const videoGameStructuredData = structuredDataBlocks(gameHtml, route).find((block) => block?.["@type"] === "VideoGame");
  const sourceListedGame = game.release?.scope === "earliest-title-release" || game.platformAssociationScope === "source-listed";
  if (sourceListedGame && ("gamePlatform" in (videoGameStructuredData ?? {}) || "datePublished" in (videoGameStructuredData ?? {}))) fail(`${route} must omit playability and publication-date JSON-LD for source-listed semantics`);
  if (!sourceListedGame && !Array.isArray(videoGameStructuredData?.gamePlatform)) fail(`${route} must retain verified-release gamePlatform JSON-LD`);
  if (!sourceListedGame && typeof game.release?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(game.release.date) && videoGameStructuredData?.datePublished !== game.release.date) fail(`${route} must retain its verified full release date in JSON-LD`);
  const boxAssets = Array.isArray(game.assets) ? game.assets.filter((asset) => asset?.role === "box-front") : [];
  const expectedReferenceFallback = game.platformAssociationScope === "source-listed" ? "GameAtlas reference presentation — no platform-specific package is implied" : "GameAtlas reference case";
  if (boxAssets.length === 0 && !gameHtml.includes(expectedReferenceFallback)) fail(`${route} does not retain its safe no-art reference fallback`);
  for (const issue of validateGameArtExport({ game, gameHtml, outDir, assetById, expectedBasePath })) fail(`${route} ${issue}`);
  if (!sitemap.includes(`games/${game.slug}/`)) fail(`sitemap is missing ${game.slug}`);
}
for (const hub of [...platformRecords.map((record) => ({ type: "platform", record })), ...genreRecords.map((record) => ({ type: "genre", record }))]) {
  const route = `${hub.type}s/${hub.record.id}/index.html`;
  const hubPath = path.join(outDir, route);
  if (!fs.existsSync(hubPath)) {
    fail(`missing static ${hub.type} hub ${route}`);
    continue;
  }
  const hubHtml = fs.readFileSync(hubPath, "utf8");
  if (!hubHtml.includes(hub.record.name)) fail(`${route} does not contain its taxonomy name`);
  if (!hubHtml.includes("catalog games")) fail(`${route} does not contain a catalog game count`);
  if (!hubHtml.includes(`data-taxonomy-visual="${hub.type}"`)) fail(`${route} is missing its text-backed taxonomy visual`);
  if (!hubHtml.includes('class="skip-link"') || !hubHtml.includes('<main') || !hubHtml.includes('<h1')) fail(`${route} is missing accessible page landmarks`);
  if (!hubHtml.includes(`${hub.type}s/${hub.record.id}/`)) fail(`${route} is missing its canonical/internal path`);
  const representedGame = gameRecords.find((game) => hub.type === "platform" ? game.platforms?.includes(hub.record.id) : game.genres?.includes(hub.record.id));
  if (!representedGame || !hubHtml.includes(`games/${representedGame.slug}/`)) fail(`${route} is missing a represented game link`);
  if (!/Original editorial|GameAtlas editorial|Catalog method|GameAtlas catalog entry/.test(hubHtml)) fail(`${route} is missing catalog evidence labeling`);
  if (!sitemap.includes(`${hub.type}s/${hub.record.id}/`)) fail(`sitemap is missing ${route}`);
  checkNoRawEvidence(hubHtml, route);
  checkStructuredData(hubHtml, route, ["CollectionPage", "BreadcrumbList"]);
}
const switch2HubPath = path.join(outDir, "platforms/nintendo-switch-2/index.html");
if (!fs.existsSync(switch2HubPath)) fail("missing Switch 2 platform hub");
else {
  const switch2HubHtml = fs.readFileSync(switch2HubPath, "utf8");
  if (!switch2HubHtml.includes("Source-listed catalog associations do not establish an individual platform release date.") || /native Switch 2 releases|platform-specific official pages/.test(switch2HubHtml)) fail("Switch 2 platform hub must retain neutral source-listed chronology wording");
}
const allFiles = [];
function walk(directory) { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) { const fullPath = path.join(directory, entry.name); if (entry.isDirectory()) walk(fullPath); else allFiles.push(fullPath); } }
walk(outDir);
const artifactBytes = allFiles.reduce((total, file) => total + fs.statSync(file).size, 0);
if (artifactBytes > maximumArtifactBytes) fail(`static artifact exceeds ${maximumArtifactBytes} bytes (${artifactBytes} bytes)`);
for (const file of allFiles.filter((candidate) => /\.(html|js|css|xml|txt|json)$/.test(candidate))) {
  const text = fs.readFileSync(file, "utf8");
  const relativePath = path.relative(outDir, file);
  if (/buy\.stripe\.com|\b(?:task|session|epic|memory|doc)_[0-9]+\b/i.test(text)) fail(`public support/tracker detail found in ${relativePath}`);
  const credentialIssue = publicArtifactCredentialIssue(relativePath, text);
  if (credentialIssue) fail(credentialIssue);
}
if (!process.exitCode) console.log(`Static export validation passed (${allFiles.length} files, ${artifactBytes} bytes, ${homePayloadBytes} home payload bytes, ${platformRecords.length} platform hubs (min ${minimumHubRecords}), ${genreRecords.length} genre hubs (min ${minimumHubRecords}), ${gameFiles.length} game routes, base path ${expectedBasePath || "/"}).`);
