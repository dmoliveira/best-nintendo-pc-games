import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const reviewDate = "2026-08-15";
const targetAdditions = 897;
const targetTotal = 1000;
const queryEndpoint = "https://query.wikidata.org/sparql";
const inventoryPath = "data/curation/2026-08-15-wikidata-catalog-1000.json";
const identitySnapshotPath = "data/curation/2026-08-15-existing-identity-snapshot.json";
const userAgent = "GameAtlasCatalogImport/1.0 (https://github.com/dmoliveira/best-nintendo-pc-games)";
const platformPlan = [
  ["nintendo-switch-2", 4],
  ["nintendo-new-3ds", 3],
  ["nintendo-dsi", 12],
  ["game-boy-color", 20],
  ["nintendo-64", 35],
  ["nintendo-wii-u", 40],
  ["nintendo-gamecube", 45],
  ["game-boy", 45],
  ["nintendo-nes", 50],
  ["nintendo-3ds", 50],
  ["nintendo-snes", 55],
  ["nintendo-wii", 55],
  ["game-boy-advance", 55],
  ["nintendo-ds", 65],
  ["nintendo-switch", 90],
  ["pc-windows", 273],
];
const platformQids = {
  "nintendo-nes": "Q172742",
  "nintendo-snes": "Q183259",
  "nintendo-64": "Q184839",
  "nintendo-gamecube": "Q182172",
  "nintendo-wii": "Q8079",
  "nintendo-wii-u": "Q56942",
  "nintendo-switch": "Q19610114",
  "nintendo-switch-2": "Q122761124",
  "game-boy": "Q186437",
  "game-boy-color": "Q203992",
  "game-boy-advance": "Q188642",
  "nintendo-ds": "Q170323",
  "nintendo-dsi": "Q637178",
  "nintendo-3ds": "Q203597",
  "nintendo-new-3ds": "Q17679679",
  "pc-windows": "Q1406",
};
const genreRules = [
  ["role-playing", /role-playing|rpg/],
  ["platformer", /platform/],
  ["racing", /racing|driving|kart/],
  ["puzzle", /puzzle|maze|word game|board game/],
  ["simulation", /simulation|management|city-building|construction/],
  ["strategy", /strategy|tactical|tower defense|4x/],
  ["fighting", /fighting|beat em up|brawler/],
  ["shooter", /shooter|shoot em up|run and gun|rail shooter/],
  ["sports", /sports|football|soccer|basketball|baseball|golf|tennis|boxing|skateboard/],
  ["rhythm", /rhythm|music game|dance/],
  ["horror", /horror/],
  ["stealth", /stealth/],
  ["visual-novel", /visual novel|interactive fiction/],
  ["sandbox", /sandbox|open world/],
  ["party", /party game|minigame/],
  ["survival", /survival/],
  ["educational", /educational/],
  ["arcade", /arcade|pinball/],
  ["adventure", /adventure|point-and-click|graphic adventure|interactive movie|dating sim/],
  ["action", /action|hack and slash|metroidvania/],
];
const titleExclusion = /\b(remaster(?:ed)?|deluxe|collection|compilation|anniversary|definitive edition|game of the year edition|complete edition|directors cut|enhanced edition|hd)\b/i;
const copyShortForms = [
  "appears in GameAtlas's {platform} {genre} collection, paired with independently written context and a linked Wikidata structured-data record.",
  "is grouped with GameAtlas's {platform} {genre} picks, where original catalog context sits beside a direct Wikidata record.",
  "joins the {platform} {genre} path in GameAtlas with original context and a clearly labeled Wikidata structured-data link.",
  "is kept in GameAtlas's {platform} {genre} discovery path through original editorial organization and a direct Wikidata record.",
  "anchors a {platform} {genre} entry in GameAtlas, with independently written context and a linked structured-data source.",
  "is cataloged with {platform} {genre} picks in GameAtlas, keeping its editorial context separate from the linked Wikidata record.",
  "sits in the GameAtlas {platform} {genre} collection, pairing a direct structured-data reference with original catalog context.",
  "is included in GameAtlas's {platform} {genre} route, alongside independently authored context and a linked Wikidata item.",
  "helps define a {platform} {genre} path in GameAtlas through original editorial framing and a direct Wikidata record.",
  "is organized in GameAtlas's {platform} {genre} collection with a source-linked record and independently written context.",
];
const copyFirstHighlights = [
  "Adds a clearly sourced {genre} option to the {platform} discovery path.",
  "Keeps a documented {genre} option visible in the {platform} collection.",
  "Places a source-linked {genre} entry in the {platform} browsing path.",
  "Frames a {genre} pick for source-aware {platform} exploration.",
  "Maps a direct-reference {genre} entry into the {platform} catalog.",
  "Offers a clearly labeled {genre} route through the {platform} collection.",
  "Builds a traceable {genre} option into the {platform} discovery path.",
  "Brings a source-aware {genre} entry to the {platform} browsing route.",
  "Sets a direct-reference {genre} marker within the {platform} catalog.",
  "Makes a documented {genre} option easier to find in the {platform} path.",
];
const copySecondHighlights = [
  "Pairs original GameAtlas organization with a direct Wikidata structured-data record.",
  "Keeps third-party commentary and scores out of the linked metadata path.",
  "Uses structured metadata as provenance rather than imported review copy.",
  "Links the catalog entry to a source record without presenting a rating.",
  "Separates GameAtlas editorial context from the external factual reference.",
  "Preserves a direct source trail without copying provider prose or media.",
  "Labels the source relationship without treating it as a popularity signal.",
  "Keeps the external item link distinct from original GameAtlas commentary.",
  "Uses a factual reference path instead of an aggregate score or review.",
  "Retains source provenance while keeping the catalog context independently authored.",
];
const copyRationaleVerbs = ["Recorded", "Listed", "Indexed", "Mapped", "Documented", "Cataloged", "Logged", "Classified", "Registered", "Grouped"];
const copyRationaleSources = ["a linked Wikidata platform-and-genre statement", "Wikidata-listed platform and genre statements", "a direct Wikidata structured-data record", "the frozen Wikidata metadata snapshot", "a source-linked Wikidata item", "the documented Wikidata platform mapping", "a Wikidata-listed catalog relationship", "the preserved Wikidata entity record", "a linked structured-data reference", "the frozen source metadata record"];
const copyRationaleEnds = ["a source-aware catalog entry, not a review or rating", "catalog organization rather than provider commentary", "a catalog record, never an aggregate score", "source-aware discovery without copied review text", "an independently authored entry rather than a provider verdict", "a labeled reference path, not a popularity claim", "original context with no imported numerical signal", "a factual-reference workflow rather than a rating", "a browsable catalog record, not a score", "a catalog entry with its source kept explicit"];
const wikidataSource = {
  id: "wikidata-fact-reference",
  provider: "Wikidata contributors",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/legalcode",
  termsUrl: "https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use/en",
  structuredDataPolicyUrl: "https://www.wikidata.org/wiki/Wikidata:Copyright",
  dataAccessUrl: "https://www.wikidata.org/wiki/Wikidata:Data_access",
  queryServiceUrl: queryEndpoint,
  retrievedAt: reviewDate,
  attribution: "Data from Wikidata (CC0); item link provided.",
};

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalize(value) {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function writeJson(relativePath, value) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value, null, 2) + "\n");
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function gameFiles() {
  return fs.readdirSync(path.join(root, "data/games")).filter((file) => file.endsWith(".json")).sort();
}

function createExistingIdentitySnapshot() {
  const identities = gameFiles().map((file) => {
    const game = readJson(path.join("data/games", file));
    const keys = [game.slug, game.title, ...(game.aliases ?? [])].map(normalize).filter(Boolean).sort();
    return { slug: game.slug, title: game.title, aliases: game.aliases ?? [], normalizedKeys: keys };
  }).sort((left, right) => left.slug.localeCompare(right.slug));
  const payload = { schemaVersion: 1, capturedAt: reviewDate, catalogCount: identities.length, identities };
  return { ...payload, snapshotDigest: "sha256:" + digest(JSON.stringify(payload)) };
}

function entityUrl(qid) {
  return "https://www.wikidata.org/wiki/" + qid;
}

function platformQuery(qid, offset, limit) {
  return [
    "SELECT ?game ?gameLabel (MIN(?date) AS ?releaseDate) (GROUP_CONCAT(DISTINCT CONCAT(STR(?genre), \"@@\", ?genreLabel); separator=\"||\") AS ?genrePairs) ?sitelinks WHERE {",
    "  ?game wdt:P31/wdt:P279* wd:Q7889;",
    "        wdt:P577 ?date;",
    "        wdt:P400 wd:" + qid + ";",
    "        wdt:P136 ?genre;",
    "        wikibase:sitelinks ?sitelinks;",
    "        rdfs:label ?gameLabel.",
    "  ?genre rdfs:label ?genreLabel.",
    "  FILTER(LANG(?gameLabel) = \"en\")",
    "  FILTER(LANG(?genreLabel) = \"en\")",
    "  FILTER(?sitelinks >= 3)",
    "}",
    "GROUP BY ?game ?gameLabel ?sitelinks",
    "ORDER BY DESC(?sitelinks) ASC(STR(?game))",
    "LIMIT " + limit,
    "OFFSET " + offset,
  ].join("\n");
}

async function wait(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchQuery(query) {
  const url = queryEndpoint + "?" + new URLSearchParams({ query, format: "json" }).toString();
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "user-agent": userAgent, accept: "application/sparql-results+json" }, signal: AbortSignal.timeout(90000) });
      if (!response.ok) throw new Error("Wikidata Query Service returned HTTP " + response.status);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 5) await wait(attempt * attempt * 1200);
    }
  }
  throw lastError;
}

function parseGenrePairs(value) {
  return String(value ?? "").split("||").map((pair) => {
    const [url, label] = pair.split("@@");
    const qid = String(url ?? "").match(/Q\d+$/)?.[0];
    return qid && label ? { qid, label } : undefined;
  }).filter(Boolean);
}

function mapGenres(pairs) {
  const resolved = [];
  const mappings = {};
  for (const pair of pairs) {
    const normalized = normalize(pair.label).replaceAll("-", " ");
    const genreIds = genreRules.filter(([, pattern]) => pattern.test(normalized)).map(([id]) => id);
    if (!genreIds.length) continue;
    mappings[pair.qid] = { label: pair.label, genreIds };
    resolved.push(...genreIds);
  }
  return { genreIds: [...new Set(resolved)].sort(), mappings };
}

function parseCandidate(row, platformId, existingKeys) {
  const qid = String(row.game?.value ?? "").match(/Q\d+$/)?.[0];
  const title = String(row.gameLabel?.value ?? "").trim();
  const releaseDate = String(row.releaseDate?.value ?? "");
  const releaseYear = Number.parseInt(releaseDate.slice(0, 4), 10);
  if (!qid || !title || !Number.isInteger(releaseYear) || releaseYear < 1950 || releaseYear > 2100) return undefined;
  if (titleExclusion.test(title) || existingKeys.has(normalize(title))) return undefined;
  const mapped = mapGenres(parseGenrePairs(row.genrePairs?.value));
  if (!mapped.genreIds.length) return undefined;
  return { qid, title, releaseYear, platformId, genreIds: mapped.genreIds, wikidataGenreIds: Object.keys(mapped.mappings).sort(), genreMappings: mapped.mappings };
}

function pick(values, seed, shift) {
  const offset = Number.parseInt(seed.slice(shift, shift + 4), 16);
  return values[offset % values.length];
}

function emojiForGenre(genreId) {
  const emojis = { action: "⚡", adventure: "🧭", platformer: "🪜", puzzle: "🧩", simulation: "🌱", racing: "🏁", "role-playing": "🗺️", strategy: "♟️", fighting: "🥊", shooter: "🎯", sports: "🏟️", rhythm: "🎵", horror: "🕯️", stealth: "🫥", "visual-novel": "📖", sandbox: "🧱", party: "🎉", survival: "⛺", educational: "🔎", arcade: "🕹️" };
  return emojis[genreId] ?? "🎮";
}

function createEditorialCopy(candidate, platformName, genreNames) {
  const seed = digest((candidate.qid ?? candidate.wikidataId) + candidate.title);
  const genre = genreNames.join(" and ").toLocaleLowerCase("en-US");
  const interpolate = (template) => template.replaceAll("{platform}", platformName).replaceAll("{genre}", genre);
  return {
    shortDescription: candidate.title + " " + interpolate(pick(copyShortForms, seed, 0)),
    highlights: [
      interpolate(pick(copyFirstHighlights, seed, 4)),
      pick(copySecondHighlights, seed, 8),
    ],
    rationale: pick(copyRationaleVerbs, seed, 12) + " for the " + platformName + " " + genre + " discovery path using " + pick(copyRationaleSources, seed, 16) + "; this remains " + pick(copyRationaleEnds, seed, 20) + ".",
  };
}

async function fetchPlatformQueue(platformId, minimumCandidates, existingKeys) {
  const qid = platformQids[platformId];
  const pageSize = 180;
  const target = Math.max(120, minimumCandidates * 2 + 40);
  const candidates = new Map();
  const mappings = {};
  let offset = 0;
  let exhausted = false;
  let requests = 0;
  while (!exhausted && (candidates.size < target || requests === 0)) {
    const data = await fetchQuery(platformQuery(qid, offset, pageSize));
    const rows = data.results?.bindings ?? [];
    requests += 1;
    for (const row of rows) {
      const candidate = parseCandidate(row, platformId, existingKeys);
      if (!candidate || candidates.has(candidate.qid)) continue;
      candidates.set(candidate.qid, candidate);
      Object.assign(mappings, candidate.genreMappings);
    }
    if (rows.length < pageSize || requests >= 12) exhausted = true;
    else offset += pageSize;
    await wait(700);
  }
  return { candidates: [...candidates.values()], mappings, exhausted, requests };
}

function selectCandidates(queue, count, selectedQids, usedKeys) {
  const selected = [];
  for (const candidate of queue.candidates) {
    if (selected.length >= count) break;
    const titleKey = normalize(candidate.title);
    if (selectedQids.has(candidate.qid) || usedKeys.has(titleKey)) continue;
    selected.push(candidate);
    selectedQids.add(candidate.qid);
    usedKeys.add(titleKey);
  }
  return selected;
}

async function main() {
  const existingSnapshot = createExistingIdentitySnapshot();
  if (existingSnapshot.catalogCount !== 103) throw new Error("Catalog import expects exactly 103 existing game records, found " + existingSnapshot.catalogCount);
  writeJson(identitySnapshotPath, existingSnapshot);
  const existingKeys = new Set(existingSnapshot.identities.flatMap((identity) => identity.normalizedKeys));
  const usedKeys = new Set(existingKeys);
  const selectedQids = new Set();
  const selected = [];
  const quotaLedger = { primary: Object.fromEntries(platformPlan), selected: {}, transfersToWindows: [], availability: {} };
  const allMappings = {};
  let transferred = 0;
  for (const [platformId, quota] of platformPlan.filter(([platformId]) => platformId !== "pc-windows")) {
    const queue = await fetchPlatformQueue(platformId, quota, existingKeys);
    Object.assign(allMappings, queue.mappings);
    const picks = selectCandidates(queue, quota, selectedQids, usedKeys);
    selected.push(...picks);
    quotaLedger.selected[platformId] = picks.length;
    quotaLedger.availability[platformId] = { retrievedEligibleCandidates: queue.candidates.length, exhausted: queue.exhausted, queryRequests: queue.requests };
    if (picks.length < quota) {
      const shortfall = quota - picks.length;
      transferred += shortfall;
      quotaLedger.transfersToWindows.push({ fromPlatformId: platformId, count: shortfall, reason: "eligible queue exhausted before the primary quota" });
    }
  }
  const windowsQuota = platformPlan.find(([platformId]) => platformId === "pc-windows")?.[1] ?? 0;
  const windowsQueue = await fetchPlatformQueue("pc-windows", windowsQuota + transferred, existingKeys);
  Object.assign(allMappings, windowsQueue.mappings);
  const windowsPicks = selectCandidates(windowsQueue, windowsQuota + transferred, selectedQids, usedKeys);
  selected.push(...windowsPicks);
  quotaLedger.selected["pc-windows"] = windowsPicks.length;
  quotaLedger.availability["pc-windows"] = { retrievedEligibleCandidates: windowsQueue.candidates.length, exhausted: windowsQueue.exhausted, queryRequests: windowsQueue.requests };
  if (windowsPicks.length !== windowsQuota + transferred) throw new Error("Windows queue could not satisfy the 1,000-game target");
  if (selected.length !== targetAdditions) throw new Error("Expected " + targetAdditions + " additions, selected " + selected.length);
  const genres = readJson("data/genres.json").items;
  const platforms = readJson("data/platforms.json").items;
  const genreNames = new Map(genres.map((genre) => [genre.id, genre.name]));
  const platformNames = new Map(platforms.map((platform) => [platform.id, platform.name]));
  const candidates = selected.map((candidate) => {
    const platformName = platformNames.get(candidate.platformId);
    const candidateGenreNames = candidate.genreIds.map((id) => genreNames.get(id)).filter(Boolean);
    if (!platformName || candidateGenreNames.length !== candidate.genreIds.length) throw new Error("Candidate taxonomy could not be resolved for " + candidate.qid);
    const editorialCopy = createEditorialCopy(candidate, platformName, candidateGenreNames);
    return {
      wikidataId: candidate.qid,
      entityUrl: entityUrl(candidate.qid),
      slug: normalize(candidate.title),
      title: candidate.title,
      aliases: [],
      emoji: emojiForGenre(candidate.genreIds[0]),
      wikidataReleaseYear: candidate.releaseYear,
      platformId: candidate.platformId,
      wikidataPlatformId: platformQids[candidate.platformId],
      genreIds: candidate.genreIds,
      wikidataGenreIds: candidate.wikidataGenreIds,
      editorialCopy,
      review: { reviewedBy: "GameAtlas frozen catalog method", reviewedAt: reviewDate, copyStatus: "original-gameatlas", sourceMethod: "fact-only-wikidata" },
    };
  }).sort((left, right) => left.wikidataId.localeCompare(right.wikidataId));
  const queryTemplate = platformQuery("<PLATFORM_QID>", 0, 180);
  const inventoryBase = {
    schemaVersion: 1,
    id: "2026-08-15-wikidata-catalog-1000",
    target: { existingRecords: existingSnapshot.catalogCount, additions: targetAdditions, totalRecords: targetTotal },
    source: { ...wikidataSource },
    query: { version: 1, text: queryTemplate, sha256: "sha256:" + digest(queryTemplate), minimumSitelinks: 3, ordering: "descending sitelinks then ascending QID; sitelink counts are not retained" },
    platformQids,
    genreMappings: allMappings,
    existingIdentitySnapshot: { path: identitySnapshotPath, snapshotDigest: existingSnapshot.snapshotDigest },
    quotaLedger,
    candidates,
  };
  const inventory = { ...inventoryBase, snapshotDigest: "sha256:" + digest(JSON.stringify(inventoryBase)) };
  writeJson(inventoryPath, inventory);
  console.log("Wikidata catalog inventory frozen (" + candidates.length + " additions, " + Object.keys(allMappings).length + " mapped source genres).");
}

function rewriteFrozenInventory() {
  const inventory = readJson(inventoryPath);
  const platformNames = new Map(readJson("data/platforms.json").items.map((platform) => [platform.id, platform.name]));
  const genreNames = new Map(readJson("data/genres.json").items.map((genre) => [genre.id, genre.name]));
  const candidates = inventory.candidates.map((candidate) => {
    const wikidataReleaseYear = candidate.wikidataReleaseYear ?? candidate.canonicalReleaseYear;
    const platformName = platformNames.get(candidate.platformId);
    const candidateGenreNames = candidate.genreIds.map((id) => genreNames.get(id)).filter(Boolean);
    if (!Number.isInteger(wikidataReleaseYear) || !platformName || candidateGenreNames.length !== candidate.genreIds.length) throw new Error("Frozen inventory has unresolved taxonomy or release metadata for " + candidate.wikidataId);
    return {
      wikidataId: candidate.wikidataId,
      entityUrl: candidate.entityUrl,
      slug: candidate.slug,
      title: candidate.title,
      aliases: candidate.aliases,
      emoji: candidate.emoji,
      wikidataReleaseYear,
      platformId: candidate.platformId,
      wikidataPlatformId: candidate.wikidataPlatformId,
      genreIds: candidate.genreIds,
      wikidataGenreIds: candidate.wikidataGenreIds,
      editorialCopy: createEditorialCopy(candidate, platformName, candidateGenreNames),
      review: {
        reviewedBy: "GameAtlas frozen catalog method",
        reviewedAt: reviewDate,
        copyStatus: "original-gameatlas",
        sourceMethod: "fact-only-wikidata",
      },
    };
  }).sort((left, right) => left.wikidataId.localeCompare(right.wikidataId));
  const frozenBase = { ...inventory, source: { ...wikidataSource }, candidates };
  delete frozenBase.snapshotDigest;
  writeJson(inventoryPath, { ...frozenBase, snapshotDigest: "sha256:" + digest(JSON.stringify(frozenBase)) });
  console.log("Frozen Wikidata inventory rewritten with structured-data terminology and original editorial copy (" + candidates.length + " candidates).");
}

const rewrite = process.argv.includes("--rewrite-frozen-inventory");
const operation = rewrite ? rewriteFrozenInventory : main;
Promise.resolve().then(operation).catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
