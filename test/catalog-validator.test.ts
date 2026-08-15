import assert from "node:assert/strict";
import { test } from "node:test";
import { findCatalogIdentityCollisions, findDuplicateRecordIds, isEligibleCritic80, isEligibleCriticDisplay, isEligiblePopularity, isEligibleSalesValueDisplay, normalizeCatalogKey, validateGameRecord, validateSignal, type CatalogContext, type GameRecord, type GameSignal } from "../lib/catalog/index";

const sourcePolicy = (id: string, provider: string, allowedFields: string[], status: "approved" | "outbound-only" = "approved") => ({ id, provider, status, allowedFields, termsUrl: "https://example.com/terms", rightsReviewedAt: "2026-08-15", recheckAt: "2026-09-15", decisionEvidence: "fixture", coveredProcess: "fixture" });
const context: CatalogContext = {
  platformIds: new Set(["nintendo-switch"]),
  genreIds: new Set(["action"]),
  sourceById: new Map([
    ["official-publisher-pages", sourcePolicy("official-publisher-pages", "Official Publisher", ["officialUrl"])],
    ["licensed-critic", sourcePolicy("licensed-critic", "Licensed Critics", ["numericScore"])],
    ["nintendo-ir", sourcePolicy("nintendo-ir", "Nintendo Investor Relations", ["manuallyReviewedSalesFact"])],
    ["popularity-source", sourcePolicy("popularity-source", "Popularity Provider", ["popularitySignal"])],
    ["gameatlas-editorial", sourcePolicy("gameatlas-editorial", "GameAtlas", ["editorialRationale"])],
  ]),
  todayKey: "2026-08-15",
  assetById: new Map(),
  boxArtFormatIds: new Set(["cartridge-portrait"]),
  approvedCriticProviders: new Set(["Licensed Critics"]),
  approvedPopularityProviders: new Set(),
  popularityPublicMode: "outbound-only",
  criticMinimumScore: 80,
  criticRequiredScale: 100,
};


const dsiContext: CatalogContext = {
  ...context,
  platformIds: new Set([...context.platformIds, "nintendo-dsi"]),
  genreIds: new Set([...context.genreIds, "puzzle"]),
  sourceById: new Map([...context.sourceById, ["nintendo-life-reference", sourcePolicy("nintendo-life-reference", "Nintendo Life", ["individualSourceUrl"], "outbound-only")]]),
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

test("requires explicit title-year and source-listed platform semantics for Wikidata-generated records", () => {
  const wikidataContext: CatalogContext = {
    ...context,
    sourceById: new Map([
      ...context.sourceById,
      ["wikidata-fact-reference", sourcePolicy("wikidata-fact-reference", "Wikidata contributors", ["wikidataReleaseYear", "wikidataListedPlatform"])],
    ]),
  };
  const generated = {
    ...baseGame,
    sources: ["wikidata-fact-reference"],
    release: { year: 2013, scope: "earliest-title-release" as const },
    platformAssociationScope: "source-listed" as const,
  };
  assert.deepEqual(validateGameRecord(generated, "generated", wikidataContext), []);
  assert.ok(validateGameRecord({ ...generated, release: { year: 2013 } }, "missing-release-scope", wikidataContext).some((problem) => problem.path.endsWith("release.scope")));
  assert.ok(validateGameRecord({ ...generated, platformAssociationScope: undefined }, "missing-platform-scope", wikidataContext).some((problem) => problem.path.endsWith("platformAssociationScope")));
  assert.ok(validateGameRecord({ ...baseGame, release: { year: 2013, scope: "earliest-title-release" as const } }, "curated-title-scope", context).some((problem) => problem.message.includes("curated records")));
});

test("distinguishes deterministic catalog-method signals from original editorial", () => {
  const catalogMethod = {
    kind: "editorial",
    evidenceState: "catalog-method",
    provider: "GameAtlas",
    label: "GameAtlas catalog method",
    rationale: "A deterministic note about the frozen catalog method.",
    sourceId: "gameatlas-editorial",
    sourceUrl: "https://example.com/catalog-method",
    termsUrl: "https://example.com/terms",
    capturedAt: "2026-08-15",
    verificationStatus: "verified",
    rightsStatus: "approved",
    reviewedBy: "GameAtlas deterministic catalog process",
    rightsReviewedAt: "2026-08-15",
    recheckAt: "2026-09-15",
  } as const;
  assert.deepEqual(validateSignal(catalogMethod, "catalog-method", context), []);
  assert.deepEqual(validateSignal({ ...catalogMethod, evidenceState: "original-editorial" }, "original-editorial", context), []);
  assert.ok(validateSignal({ ...catalogMethod, evidenceState: "unsupported" }, "unsupported", context).some((problem) => problem.message.includes("unsupported evidence state")));
});

test("rejects a cached score when rights are outbound-only", () => {
  const signal = {
    kind: "critic",
    evidenceState: "licensed-signal" as const,
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
    evidenceState: "verified-fact",
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
    evidenceState: "licensed-signal",
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
    evidenceState: "verified-fact",
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
    evidenceState: "licensed-signal" as const,
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

test("separates public critic display from the 80+ editorial threshold", () => {
  const signal = {
    kind: "critic" as const, evidenceState: "licensed-signal" as const, provider: "Licensed Critics", label: "Critic score", score: 79, scale: 100, scoreType: "average", editionOrPlatform: "Nintendo Switch", sourceId: "licensed-critic", sourceUrl: "https://example.com/score", termsUrl: "https://example.com/terms", capturedAt: "2026-08-15", verificationStatus: "verified" as const, rightsStatus: "approved" as const, reviewedBy: "fixture reviewer", rightsReviewedAt: "2026-08-15", recheckAt: "2026-09-15",
  };
  assert.equal(isEligibleCriticDisplay(signal, context), true);
  assert.equal(isEligibleCritic80(signal, context), false);
});

test("only exposes value-based, fully sourced sales facts", () => {
  const signal = {
    kind: "sales" as const, evidenceState: "verified-fact" as const, provider: "Nintendo Investor Relations", label: "Worldwide units", sourceId: "nintendo-ir", sourceUrl: "https://example.com/sales", termsUrl: "https://example.com/terms", capturedAt: "2026-08-15", verificationStatus: "verified" as const, rightsStatus: "approved" as const, reviewedBy: "fixture reviewer", rightsReviewedAt: "2026-08-15", recheckAt: "2026-09-15", territory: "worldwide", period: "lifetime", asOf: "2026-08-15", value: 1234567, unit: "units",
  };
  assert.equal(isEligibleSalesValueDisplay(signal, context), true);
  assert.equal(isEligibleSalesValueDisplay({ ...signal, value: undefined, rank: 1 }, context), false);
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
    evidenceState: "verified-fact",
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
    evidenceState: "licensed-signal",
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
    evidenceState: "verified-fact",
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
    evidenceState: "licensed-signal",
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


test("requires popularity method and dated asOf provenance", () => {
  const signal = {
    kind: "popularity",
    evidenceState: "licensed-signal",
    provider: "Popularity Provider",
    label: "Popularity index",
    sourceId: "popularity-source",
    sourceUrl: "https://example.com/popularity",
    termsUrl: "https://example.com/terms",
    capturedAt: "2026-08-15",
    verificationStatus: "verified",
    rightsStatus: "approved",
    reviewedBy: "fixture reviewer",
    rightsReviewedAt: "2026-08-15",
    recheckAt: "2026-09-15",
    value: 42,
    asOf: "not-a-date",
  } as const;
  const problems = validateSignal(signal, "popularity", context);
  assert.ok(problems.some((problem) => problem.path === "popularity.methodVersion"));
  assert.ok(problems.some((problem) => problem.path === "popularity.asOf"));
  assert.ok(problems.some((problem) => problem.message.includes("not authorized")));
});

test("popularity eligibility requires an explicitly authorized provider and stays separate from critic threshold", () => {
  const signal = {
    kind: "popularity",
    evidenceState: "licensed-signal",
    provider: "Popularity Provider",
    label: "Popularity index",
    sourceId: "popularity-source",
    sourceUrl: "https://example.com/popularity",
    termsUrl: "https://example.com/terms",
    capturedAt: "2026-08-15",
    verificationStatus: "verified",
    rightsStatus: "approved",
    reviewedBy: "fixture reviewer",
    rightsReviewedAt: "2026-08-15",
    recheckAt: "2026-09-15",
    value: 42,
    methodVersion: "fixture-v1",
    asOf: "2026-08-15",
  } as const;
  assert.equal(isEligiblePopularity(signal, context), false);
  assert.equal(isEligibleCritic80(signal, context), false);
  const authorizedContext = { ...context, approvedPopularityProviders: new Set(["Popularity Provider"]), popularityPublicMode: "numeric-display" as const };
  assert.equal(isEligiblePopularity(signal, authorizedContext), true);
});


test("link-only evidence cannot satisfy numeric eligibility", () => {
  const critic = {
    kind: "critic",
    evidenceState: "link-only",
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
    reviewedBy: "fixture reviewer",
    rightsReviewedAt: "2026-08-15",
    recheckAt: "2026-09-15",
  } as const;
  assert.equal(isEligibleCritic80(critic as unknown as GameSignal, { ...context, approvedCriticProviders: new Set(["Licensed Critics"]) }), false);
  assert.ok(validateSignal(critic, "link-only", context).some((problem) => problem.message.includes("numeric-display")));

  const scaleOnlyCritic = {
    kind: "critic",
    evidenceState: "link-only",
    provider: "Licensed Critics",
    label: "Critic score",
    scale: 100,
    sourceId: "licensed-critic",
    sourceUrl: "https://example.com/score",
    capturedAt: "2026-08-15",
    verificationStatus: "unverified",
    rightsStatus: "outbound-only",
  } as const;
  assert.ok(validateSignal(scaleOnlyCritic, "scale-only-link-only", context).some((problem) => problem.message.includes("numeric-display")));
});

test("accepts a numeric-free link-only evidence reference", () => {
  const signal = {
    kind: "popularity",
    evidenceState: "link-only",
    provider: "Popularity Provider",
    label: "Popularity page",
    sourceId: "popularity-source",
    sourceUrl: "https://example.com/popularity",
    capturedAt: "2026-08-15",
    verificationStatus: "unverified",
    rightsStatus: "outbound-only",
  } as const;
  assert.deepEqual(validateSignal(signal, "link-only", context), []);
  assert.equal(isEligiblePopularity(signal, context), false);
});


test("requires explicit digital distribution for DSi records", () => {
  const dsiGame = { ...baseGame, slug: "dsiware-sample", platforms: ["nintendo-dsi"], genres: ["puzzle"] };
  assert.ok(validateGameRecord(dsiGame, "dsiware-missing-format", dsiContext).some((problem) => problem.message.includes("DSiWare/digital")));
  assert.ok(validateGameRecord({ ...dsiGame, releaseFormat: "cartridge" }, "dsiware-cartridge", dsiContext).some((problem) => problem.message.includes("DSiWare/digital")));
  assert.deepEqual(validateGameRecord({ ...dsiGame, releaseFormat: "digital" }, "dsiware-digital", dsiContext), []);
});

test("does not authorize Nintendo Life numeric signals", () => {
  const signal = {
    kind: "critic",
    evidenceState: "licensed-signal",
    provider: "Nintendo Life",
    label: "Critic score",
    score: 85,
    scale: 100,
    scoreType: "average",
    sourceId: "nintendo-life-reference",
    sourceUrl: "https://www.nintendolife.com/games/dsiware/mighty_flip_champs",
    capturedAt: "2026-08-14",
    verificationStatus: "verified",
    rightsStatus: "outbound-only",
  } as const;
  assert.ok(validateSignal(signal, "nintendo-life-signal", dsiContext).some((problem) => problem.message.includes("approved rights")));
});


test("requires a checksum-governed manifest record for box-front assets", () => {
  const boxContext: CatalogContext = {
    ...context,
    assetById: new Map([["game-sample-game-box-front-cartridge-portrait", {
      path: "public/assets/games/sample-game/front-cartridge-portrait.png",
      altText: "Original GameAtlas editorial front artwork for Sample Game.",
      assetKind: "generated-game-box-front",
      intendedUse: "game-box-front",
      boxFormatId: "cartridge-portrait",
    }]]),
  };
  const valid = {
    ...baseGame,
    assets: [{
      path: "public/assets/games/sample-game/front-cartridge-portrait.png",
      alt: "Original GameAtlas editorial front artwork for Sample Game.",
      provenanceId: "game-sample-game-box-front-cartridge-portrait",
      role: "box-front" as const,
      boxFormatId: "cartridge-portrait",
    }],
  };
  assert.deepEqual(validateGameRecord(valid, "fixture", boxContext), []);
  const wrongManifest = { ...valid, assets: [{ ...valid.assets[0], boxFormatId: "unknown-format" }] };
  assert.ok(validateGameRecord(wrongManifest, "fixture", boxContext).some((problem) => problem.message.includes("unknown box-art format") || problem.message.includes("does not match the approved manifest")));
  const duplicate = { ...valid, assets: [...valid.assets, valid.assets[0]] };
  assert.ok(validateGameRecord(duplicate, "fixture", boxContext).some((problem) => problem.message.includes("duplicates a box-front asset")));
});

test("rejects box metadata on non-box assets", () => {
  const misplaced = { ...baseGame, assets: [{ path: "public/mark.svg", alt: "mark", provenanceId: "unknown", boxFormatId: "cartridge-portrait" }] };
  assert.ok(validateGameRecord(misplaced, "fixture", context).some((problem) => problem.message.includes("only allowed for a box-front asset")));
});


test("rejects a generic game asset unless its manifest grants the editorial thumbnail use", () => {
  const nonEditorialContext: CatalogContext = {
    ...context,
    assetById: new Map([["project-mark", {
      path: "public/mark.svg",
      altText: "Project mark",
      assetKind: "original-project-vector",
      intendedUse: "brand-mark",
    }]]),
  };
  const game = { ...baseGame, assets: [{ path: "public/mark.svg", alt: "Project mark", provenanceId: "project-mark" }] };
  assert.ok(validateGameRecord(game, "fixture", nonEditorialContext).some((problem) => problem.message.includes("generic game assets require")));
});
