import assert from "node:assert/strict";
import { test } from "node:test";
import { findCatalogIdentityCollisions, findDuplicateRecordIds, isEligibleCritic80, normalizeCatalogKey, validateGameRecord, validateSignal, type CatalogContext, type GameRecord } from "../lib/catalog/index";

const sourcePolicy = (id: string, provider: string, allowedFields: string[], status: "approved" | "outbound-only" = "approved") => ({ id, provider, status, allowedFields, termsUrl: "https://example.com/terms", rightsReviewedAt: "2026-08-15", recheckAt: "2026-09-15", decisionEvidence: "fixture", coveredProcess: "fixture" });
const context: CatalogContext = {
  platformIds: new Set(["nintendo-switch"]),
  genreIds: new Set(["action"]),
  sourceById: new Map([
    ["official-publisher-pages", sourcePolicy("official-publisher-pages", "Official Publisher", ["officialUrl"])],
    ["licensed-critic", sourcePolicy("licensed-critic", "Licensed Critics", ["numericScore"])],
    ["nintendo-ir", sourcePolicy("nintendo-ir", "Nintendo Investor Relations", ["manuallyReviewedSalesFact"])],
  ]),
  todayKey: "2026-08-15",
  assetById: new Map(),
  approvedCriticProviders: new Set(["Licensed Critics"]),
  criticMinimumScore: 80,
  criticRequiredScale: 100,
};

const baseGame: GameRecord = {
  schemaVersion: 1,
  slug: "sample-game",
  title: "Sample Game",
  aliases: ["Sample"],
  emoji: "🎮",
  shortDescription: "A sample fixture for the catalog contract.",
  highlights: ["A valid fixture"],
  release: { year: 2026 },
  platforms: ["nintendo-switch"],
  genres: ["action"],
  keywords: ["sample"],
  signals: [],
  links: [{ label: "Official page", url: "https://example.com/game", kind: "official" }],
  assets: [],
  sources: ["official-publisher-pages"],
};

test("accepts a valid game record with no signals or assets", () => {
  assert.deepEqual(validateGameRecord(baseGame, "fixture", context), []);
});

test("rejects a cached score when rights are outbound-only", () => {
  const signal = {
    kind: "critic",
    provider: "Licensed Critics",
    label: "Critic score",
    score: 85,
    scale: 100,
    scoreType: "average",
    sourceId: "licensed-critic",
    sourceUrl: "https://example.com/score",
    capturedAt: "2026-08-15",
    verificationStatus: "verified",
    rightsStatus: "outbound-only",
  } as const;
  assert.ok(validateSignal(signal, "signal", context).some((problem) => problem.message.includes("approved rights")));
});

test("rejects an approved signal when its source registry is not approved", () => {
  const signal = {
    kind: "sales",
    provider: "Unapproved source",
    label: "Sales",
    sourceId: "licensed-critic",
    sourceUrl: "https://example.com/sales",
    capturedAt: "2026-08-15",
    verificationStatus: "verified",
    rightsStatus: "approved",
    termsUrl: "https://example.com/terms",
    reviewedBy: "fixture reviewer",
    editionOrPlatform: "Nintendo Switch",
    rightsReviewedAt: "2026-08-15",
    recheckAt: "2026-09-15",
    territory: "worldwide",
    period: "lifetime",
    asOf: "2026-08-15",
    value: 1,
  } as const;
  const restrictedContext = { ...context, sourceById: new Map([["licensed-critic", sourcePolicy("licensed-critic", "Licensed Critics", ["numericScore"], "outbound-only")]]) };
  assert.ok(validateSignal(signal, "signal", restrictedContext).some((problem) => problem.message.includes("approved source registry")));
});

test("requires explicit provider authorization for critic 80+", () => {
  const signal = {
    kind: "critic",
    provider: "Unknown Critics",
    label: "Critic score",
    score: 85,
    scale: 100,
    scoreType: "average",
    sourceId: "licensed-critic",
    sourceUrl: "https://example.com/score",
    capturedAt: "2026-08-15",
    verificationStatus: "verified",
    rightsStatus: "approved",
    termsUrl: "https://example.com/terms",
    reviewedBy: "fixture reviewer",
    editionOrPlatform: "Nintendo Switch",
    rightsReviewedAt: "2026-08-15",
    recheckAt: "2026-09-15",
  } as const;
  assert.equal(isEligibleCritic80(signal, context), false);
  assert.ok(validateSignal(signal, "signal", context).some((problem) => problem.message.includes("not authorized")));
});

test("requires sales provenance fields", () => {
  const signal = {
    kind: "sales",
    provider: "Nintendo Investor Relations",
    label: "Worldwide units",
    sourceId: "nintendo-ir",
    sourceUrl: "https://example.com/sales",
    capturedAt: "2026-08-15",
    verificationStatus: "verified",
    rightsStatus: "approved",
    termsUrl: "https://example.com/terms",
    reviewedBy: "fixture reviewer",
    editionOrPlatform: "Nintendo Switch",
    rightsReviewedAt: "2026-08-15",
    recheckAt: "2026-09-15",
    territory: "worldwide",
    period: "lifetime",
    asOf: "not-a-date",
  } as const;
  assert.ok(validateSignal(signal, "signal", context).some((problem) => problem.message.includes("valid YYYY-MM-DD calendar date")));
});

test("accepts 80 and rejects 79 at the configured critic threshold", () => {
  const signal = (score: number) => ({
    kind: "critic" as const,
    provider: "Licensed Critics",
    label: "Critic score",
    score,
    scale: 100,
    scoreType: "average",
    editionOrPlatform: "Nintendo Switch",
    sourceId: "licensed-critic",
    sourceUrl: "https://example.com/score",
    termsUrl: "https://example.com/terms",
    capturedAt: "2026-08-15",
    verificationStatus: "verified" as const,
    rightsStatus: "approved" as const,
    reviewedBy: "fixture reviewer",
    rightsReviewedAt: "2026-08-15",
    recheckAt: "2026-09-15",
  });
  assert.equal(isEligibleCritic80(signal(80), context), true);
  assert.equal(isEligibleCritic80(signal(79), context), false);
});

test("requires an official or reference link", () => {
  const communityOnly = { ...baseGame, links: [{ label: "Community", url: "https://example.com/community", kind: "community" as const }] };
  assert.ok(validateGameRecord(communityOnly, "community-only", context).some((problem) => problem.message.includes("official or reference")));
});

test("normalizes diacritics and separators for catalog identity", () => {
  assert.equal(normalizeCatalogKey("Pokémon: Fire Red"), "pokemon-fire-red");
  assert.equal(normalizeCatalogKey("pokemon-fire-red"), "pokemon-fire-red");
});

test("rejects normalized cross-record name collisions", () => {
  const collisions = findCatalogIdentityCollisions([
    { file: "one.json", slug: "pokemon-fire-red", title: "Pokémon: Fire Red", aliases: [] },
    { file: "two.json", slug: "pokemon-yellow", title: "Pokémon Yellow", aliases: ["pokemon fire red"] },
  ]);
  assert.equal(collisions.length, 1);
});

test("rejects null numeric values even when rank is present", () => {
  const signal = {
    kind: "sales",
    provider: "Nintendo Investor Relations",
    label: "Sales",
    sourceId: "nintendo-ir",
    sourceUrl: "https://example.com/sales",
    capturedAt: "2026-08-15",
    verificationStatus: "verified",
    rightsStatus: "approved",
    rightsReviewedAt: "2026-08-15",
    recheckAt: "2026-09-15",
    territory: "worldwide",
    period: "lifetime",
    asOf: "2026-08-15",
    value: null,
    rank: 1,
  } as const;
  assert.ok(validateSignal(signal, "signal", context).some((problem) => problem.message.includes("finite number")));
});

test("rejects timestamp-shaped provenance and expired rechecks by calendar key", () => {
  const timestampSignal = {
    kind: "critic",
    provider: "Licensed Critics",
    label: "Critic score",
    score: 80,
    scale: 100,
    scoreType: "average",
    editionOrPlatform: "Nintendo Switch",
    sourceId: "licensed-critic",
    sourceUrl: "https://example.com/score",
    termsUrl: "https://example.com/terms",
    capturedAt: "2026-08-15T23:59:59Z",
    verificationStatus: "verified",
    rightsStatus: "approved",
    reviewedBy: "fixture reviewer",
    rightsReviewedAt: "2026-08-15",
    recheckAt: "2026-09-15",
  } as const;
  assert.ok(validateSignal(timestampSignal, "timestamp", context).some((problem) => problem.message.includes("YYYY-MM-DD")));

  const expiredSignal = { ...timestampSignal, capturedAt: "2026-08-15", recheckAt: "2026-08-14" };
  assert.ok(validateSignal(expiredSignal, "expired", context).some((problem) => problem.message.includes("future recheck")));
});


test("rejects malformed URLs and sales values without units", () => {
  const salesSignal = {
    kind: "sales",
    provider: "Nintendo Investor Relations",
    label: "Worldwide units",
    sourceId: "nintendo-ir",
    sourceUrl: "https://",
    capturedAt: "2026-08-15",
    verificationStatus: "verified",
    rightsStatus: "approved",
    termsUrl: "https://example.com/terms",
    reviewedBy: "fixture reviewer",
    rightsReviewedAt: "2026-08-15",
    recheckAt: "2026-09-15",
    territory: "worldwide",
    period: "lifetime",
    asOf: "2026-08-15",
    value: 1,
  } as const;
  const signalProblems = validateSignal(salesSignal, "sales", context);
  assert.ok(signalProblems.some((problem) => problem.path === "sales.sourceUrl"));
  assert.ok(signalProblems.some((problem) => problem.path === "sales.unit"));
  const malformedLink = { ...baseGame, links: [{ label: "Official", url: "https://", kind: "official" as const }] };
  assert.ok(validateGameRecord(malformedLink, "malformed-link", context).some((problem) => problem.path === "malformed-link.links[0]"));
});

test("finds duplicate source and asset identifiers before map construction", () => {
  assert.deepEqual(findDuplicateRecordIds([{ id: "source-a" }, { id: "source-a" }, { id: "source-b" }], "id"), ["source-a"]);
  assert.deepEqual(findDuplicateRecordIds([{ assetId: "asset-a" }, { assetId: "asset-b" }, { assetId: "asset-a" }], "assetId"), ["asset-a"]);
});

test("rejects whitespace-only approved signal provenance", () => {
  const signal = {
    kind: "critic",
    provider: "Licensed Critics",
    label: "Critic score",
    score: 80,
    scale: 100,
    scoreType: "average",
    editionOrPlatform: "Nintendo Switch",
    sourceId: "licensed-critic",
    sourceUrl: "https://example.com/score",
    termsUrl: "https://example.com/terms",
    capturedAt: "2026-08-15",
    verificationStatus: "verified",
    rightsStatus: "approved",
    reviewedBy: "   ",
    rightsReviewedAt: "2026-08-15",
    recheckAt: "2026-09-15",
  } as const;
  assert.ok(validateSignal(signal, "whitespace", context).some((problem) => problem.message.includes("reviewedBy")));
});
