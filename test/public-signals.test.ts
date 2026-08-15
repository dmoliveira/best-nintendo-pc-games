import assert from "node:assert/strict";
import { test } from "node:test";
import { formatRoundedUnits, getPublicSignalSummaries } from "../lib/catalog/public-signals";
import { getCatalogSearchRecords } from "../lib/catalog/site-data";
import type { CatalogContext, GameRecord, SourcePolicy } from "../lib/catalog/types";

function fixtureContext(): CatalogContext {
  const sources: SourcePolicy[] = [
    {
      id: "critic-source",
      provider: "Licensed Critics",
      status: "approved",
      allowedFields: ["numericScore"],
      termsUrl: "https://example.com/terms",
      rightsReviewedAt: "2026-08-01",
      recheckAt: "2026-09-01",
      decisionEvidence: "fixture",
      coveredProcess: "fixture",
    },
    {
      id: "sales-source",
      provider: "Publisher Investor Relations",
      status: "approved",
      allowedFields: ["manuallyReviewedSalesFact"],
      termsUrl: null,
      rightsReviewedAt: "2026-08-01",
      recheckAt: "2026-09-01",
      decisionEvidence: "fixture",
      coveredProcess: "fixture",
    },
  ];
  return {
    platformIds: new Set(["nintendo-switch"]),
    genreIds: new Set(["action"]),
    sourceById: new Map(sources.map((source) => [source.id, source])),
    assetById: new Map(),
    boxArtFormatIds: new Set(),
    approvedCriticProviders: new Set(["Licensed Critics"]),
    approvedPopularityProviders: new Set(),
    popularityPublicMode: "outbound-only",
    criticMinimumScore: 80,
    criticRequiredScale: 100,
    todayKey: "2026-08-15",
  };
}

function fixtureGame(): GameRecord {
  return {
    schemaVersion: 1,
    slug: "fixture-game",
    title: "Fixture Game",
    aliases: [],
    emoji: "✦",
    shortDescription: "A fixture used to test public signal projection.",
    highlights: ["Fixture"],
    release: { year: 2020 },
    platforms: ["nintendo-switch"],
    genres: ["action"],
    keywords: ["fixture"],
    signals: [
      {
        kind: "critic",
        evidenceState: "licensed-signal",
        provider: "Licensed Critics",
        label: "Critic score",
        score: 85,
        scale: 100,
        scoreType: "average",
        editionOrPlatform: "Nintendo Switch",
        sourceId: "critic-source",
        sourceUrl: "https://example.com/critic-score",
        termsUrl: "https://example.com/terms",
        capturedAt: "2026-08-10",
        verificationStatus: "verified",
        rightsStatus: "approved",
        rightsReviewedAt: "2026-08-01",
        recheckAt: "2026-09-01",
        reviewedBy: "Fixture reviewer",
      },
      {
        kind: "user",
        evidenceState: "link-only",
        provider: "Community",
        label: "User score",
        sourceId: "missing-user-source",
        sourceUrl: "https://example.com/user-score",
        capturedAt: "2026-08-10",
        verificationStatus: "unverified",
        rightsStatus: "outbound-only",
      },
      {
        kind: "sales",
        evidenceState: "verified-fact",
        provider: "Publisher Investor Relations",
        label: "Worldwide units",
        value: 1_234_567,
        unit: "units",
        territory: "worldwide",
        period: "lifetime",
        asOf: "2026-08-10",
        sourceId: "sales-source",
        sourceUrl: "https://example.com/sales",
        capturedAt: "2026-08-10",
        verificationStatus: "verified",
        rightsStatus: "approved",
        rightsReviewedAt: "2026-08-01",
        recheckAt: "2026-09-01",
        reviewedBy: "Fixture reviewer",
      },
    ],
    links: [],
    assets: [],
    sources: ["critic-source", "sales-source"],
  };
}

test("rounds reported units without scientific notation", () => {
  assert.equal(formatRoundedUnits(0, "units"), "0 units");
  assert.equal(formatRoundedUnits(999, "units"), "999 units");
  assert.equal(formatRoundedUnits(1234, "units"), "1.2K units");
  assert.equal(formatRoundedUnits(999999, "units"), "1M units");
  assert.equal(formatRoundedUnits(1234567, "units"), "1.2M units");
  assert.equal(formatRoundedUnits(1234567890, "units"), "1.2B units");
  assert.doesNotMatch(formatRoundedUnits(1234567, "units"), /e\+/i);
});

test("projects only approved public critic and sales summaries", () => {
  const summary = getPublicSignalSummaries(fixtureGame(), fixtureContext());
  assert.deepEqual(summary.critic, {
    label: "Critic score",
    display: "85/100",
    detail: "Nintendo Switch · as of 2026-08-10",
    provider: "Licensed Critics",
    url: "https://example.com/critic-score",
  });
  assert.deepEqual(summary.sales, {
    label: "Reported sales",
    display: "About 1.2M units",
    detail: "worldwide · lifetime · as of 2026-08-10",
    provider: "Publisher Investor Relations",
    url: "https://example.com/sales",
  });
  const serialized = JSON.stringify(summary);
  assert.doesNotMatch(serialized, /User score|user-score|rightsStatus|verificationStatus|sourceId|capturedAt/);
});

test("keeps current link-only catalog free of numeric signal summaries", () => {
  const records = getCatalogSearchRecords();
  assert.ok(records.every((record) => !record.criticSummary && !record.salesSummary));
});
