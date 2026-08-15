import fs from "node:fs";
import path from "node:path";
import { validateGameArtExport } from "../lib/box-art/static-export.mjs";

const outDir = path.resolve(process.env.OUT_DIR ?? "out");
const rootDir = process.cwd();
const expectedBasePath = (process.env.EXPECTED_BASE_PATH ?? "/best-nintendo-pc-games").replace(/\/$/, "");
const requiredFiles = ["index.html", ".nojekyll", "robots.txt", "sitemap.xml", "og-image.png", "mark.svg", "docs/rights-and-support-policy/index.html"];
const forbiddenEvidenceFields = ["sourceUrl", "termsUrl", "rightsStatus", "verificationStatus", "capturedAt", "recheckAt"];
const publicSecretPattern = /(?:\bsk-[A-Za-z0-9_-]{20,}\b|\b(?:ghp|gho|ghu|ghs)_[A-Za-z0-9_]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b|-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----|\b(?:api[_-]?key|authorization|bearer)\s*[:=]\s*[A-Za-z0-9._~+\/-]{12,})/i;

function fail(message) { console.error(`Static export validation failed: ${message}`); process.exitCode = 1; }
function escapeHtml(value) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#x27;"); }
function checkNoRawEvidence(html, location) { for (const field of forbiddenEvidenceFields) if (html.includes(field)) fail(`${location} leaks raw evidence field ${field}`); }
if (!fs.existsSync(outDir)) { fail(`missing output directory ${outDir}`); process.exit(1); }
for (const file of requiredFiles) if (!fs.existsSync(path.join(outDir, file))) fail(`missing ${file}`);
const html = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
for (const expected of ["GameAtlas", "Best Nintendo", "Find the games", "worth your time.", "Start with a game.", "Search games", "Showing", "GameAtlas pick", "platform-glyph", "data-platform-accent", "data-attribute-glyph", "Critic score", "Card layout", "Single-column layout on smaller screens.", "game-card-title-link", "Current result position"]) if (!html.includes(expected)) fail(`home page does not contain ${JSON.stringify(expected)}`);
if (!/<svg[^>]+aria-hidden="true"[^>]+focusable="false"/.test(html)) fail("home page is missing decorative, non-focusable catalog glyph semantics");
if (!/Showing[\s\S]{0,120}of[\s\S]{0,120}reviewed games/.test(html)) fail("home page is missing the accessible result count");
if (!html.includes("docs/rights-and-support-policy")) fail("home page is missing the policy link");
if (html.includes("Catalog search is coming soon") || html.includes("Catalog coming soon") || html.includes("next discovery layer") || html.includes("discovery tools arrive") || html.includes("80+")) fail("home page exposes stale preview or unauthorized numeric messaging");
if (/\b(?:score|rating)\s*[:=]\s*\d+(?:\.\d+)?/i.test(html)) fail("home page exposes a numeric score or rating");
if (html.includes("action=\"/\"")) fail("home page contains a root-relative form action that bypasses the Pages base path");
checkNoRawEvidence(html, "home page");
const sitemap = fs.readFileSync(path.join(outDir, "sitemap.xml"), "utf8");
if (expectedBasePath && !sitemap.includes(expectedBasePath)) fail(`sitemap does not include ${expectedBasePath || "/"}`);
const gamesDir = path.join(rootDir, "data/games");
const gameFiles = fs.existsSync(gamesDir) ? fs.readdirSync(gamesDir).filter((file) => file.endsWith(".json")).sort() : [];
const gameRecords = gameFiles.map((file) => JSON.parse(fs.readFileSync(path.join(gamesDir, file), "utf8")));
const detailLinkCounts = new Map();
for (const match of html.matchAll(/<a[^>]+href="[^"]*\/games\/([^/"?]+)\/[^"]*"/g)) detailLinkCounts.set(match[1], (detailLinkCounts.get(match[1]) ?? 0) + 1);
for (const game of gameRecords) if (detailLinkCounts.get(game.slug) !== 1) fail(`home page must expose exactly one primary detail link for ${game.slug}, found ${detailLinkCounts.get(game.slug) ?? 0}`);
const assetManifest = JSON.parse(fs.readFileSync(path.join(rootDir, "data/assets-manifest.json"), "utf8"));
const assetById = new Map((assetManifest.assets ?? []).map((asset) => [asset.assetId, asset]));
const usedPlatformIds = new Set(gameRecords.flatMap((game) => game.platforms ?? []));
const usedGenreIds = new Set(gameRecords.flatMap((game) => game.genres ?? []));
const platformsDocument = JSON.parse(fs.readFileSync(path.join(rootDir, "data/platforms.json"), "utf8"));
const genresDocument = JSON.parse(fs.readFileSync(path.join(rootDir, "data/genres.json"), "utf8"));
const coverageDocument = JSON.parse(fs.readFileSync(path.join(rootDir, "data/coverage.json"), "utf8"));
const minimumHubRecords = Number.isInteger(coverageDocument.minimumHubRecords) && coverageDocument.minimumHubRecords >= 1 ? coverageDocument.minimumHubRecords : 2;
const platformCounts = new Map([...usedPlatformIds].map((id) => [id, gameRecords.filter((game) => game.platforms?.includes(id)).length]));
const genreCounts = new Map([...usedGenreIds].map((id) => [id, gameRecords.filter((game) => game.genres?.includes(id)).length]));
const platformRecords = (platformsDocument.items ?? []).filter((platform) => platform.coverage === "populated" && usedPlatformIds.has(platform.id) && (platformCounts.get(platform.id) ?? 0) >= minimumHubRecords);
const genreRecords = (genresDocument.items ?? []).filter((genre) => usedGenreIds.has(genre.id) && (genreCounts.get(genre.id) ?? 0) >= minimumHubRecords);
for (const game of gameRecords) {
  const route = `games/${game.slug}/index.html`;
  const gamePath = path.join(outDir, route);
  if (!fs.existsSync(gamePath)) {
    fail(`missing static game route ${route}`);
    continue;
  }
  const gameHtml = fs.readFileSync(gamePath, "utf8");
  if (![game.title, escapeHtml(game.title)].some((title) => gameHtml.includes(title))) fail(`${route} does not contain its game title`);
  if (!gameHtml.includes("Original editorial")) fail(`${route} does not contain explicit editorial evidence labeling`);
  if (!gameHtml.includes('data-attribute-glyph="year"') || !gameHtml.includes("detail-label")) fail(`${route} is missing text-backed metadata glyphs`);
  for (const link of (game.links ?? []).filter((candidate) => candidate.kind === "critical")) if (!gameHtml.includes(link.url)) fail(`${route} is missing its outbound critical context link`);
  if (gameHtml.includes("80+") || /(?:popularity value|popularity rank)/i.test(gameHtml)) fail(`${route} exposes unauthorized numeric evidence messaging`);
  checkNoRawEvidence(gameHtml, route);
  const boxAssets = Array.isArray(game.assets) ? game.assets.filter((asset) => asset?.role === "box-front") : [];
  if (boxAssets.length === 0 && !gameHtml.includes("GameAtlas reference case")) fail(`${route} does not retain the no-art reference package fallback`);
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
  if (!hubHtml.includes("reviewed games")) fail(`${route} does not contain a reviewed game count`);
  if (!hubHtml.includes(`data-taxonomy-visual="${hub.type}"`)) fail(`${route} is missing its text-backed taxonomy visual`);
  if (!hubHtml.includes('class="skip-link"') || !hubHtml.includes('<main') || !hubHtml.includes('<h1')) fail(`${route} is missing accessible page landmarks`);
  if (!hubHtml.includes(`${hub.type}s/${hub.record.id}/`)) fail(`${route} is missing its canonical/internal path`);
  const representedGame = gameRecords.find((game) => hub.type === "platform" ? game.platforms?.includes(hub.record.id) : game.genres?.includes(hub.record.id));
  if (!representedGame || !hubHtml.includes(`games/${representedGame.slug}/`)) fail(`${route} is missing a represented game link`);
  if (!/Original editorial|GameAtlas editorial/.test(hubHtml)) fail(`${route} is missing editorial evidence labeling`);
  if (!sitemap.includes(`${hub.type}s/${hub.record.id}/`)) fail(`sitemap is missing ${route}`);
  checkNoRawEvidence(hubHtml, route);
}
const allFiles = [];
function walk(directory) { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) { const fullPath = path.join(directory, entry.name); if (entry.isDirectory()) walk(fullPath); else allFiles.push(fullPath); } }
walk(outDir);
for (const file of allFiles.filter((candidate) => /\.(html|js|css|xml|txt)$/.test(candidate))) {
  const text = fs.readFileSync(file, "utf8");
  if (/buy\.stripe\.com|\b(?:task|session|epic|memory|doc)_[0-9]+\b/i.test(text)) fail(`public support/tracker detail found in ${path.relative(outDir, file)}`);
  if (publicSecretPattern.test(text)) fail(`credential-like value found in ${path.relative(outDir, file)}`);
}
if (!process.exitCode) console.log(`Static export validation passed (${allFiles.length} files, ${platformRecords.length} platform hubs (min ${minimumHubRecords}), ${genreRecords.length} genre hubs (min ${minimumHubRecords}), ${gameFiles.length} game routes, base path ${expectedBasePath || "/"}).`);
