import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const root = process.cwd();
const readJson = (relativePath: string) => JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as Record<string, unknown>;
const registry = readJson("data/platform-chronology.json");
const audit = readJson("data/curation/2026-08-15-platform-chronology-audit.json");
const facts = readJson("data/curation/2026-08-15-catalog-fact-snapshot.json");
const sourceRights = readJson("data/source-rights.json");

function runChronologyValidator(mutator: (candidate: Record<string, unknown>) => void): string {
  const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "gameatlas-chronology-"));
  try {
    const dataRoot = path.join(fixtureRoot, "data");
    const curationRoot = path.join(dataRoot, "curation");
    mkdirSync(curationRoot, { recursive: true });
    cpSync(path.join(root, "data", "games"), path.join(dataRoot, "games"), { recursive: true });
    cpSync(path.join(root, "data", "source-rights.json"), path.join(dataRoot, "source-rights.json"));
    cpSync(path.join(root, "data", "platforms.json"), path.join(dataRoot, "platforms.json"));
    cpSync(path.join(root, "data", "platform-chronology.json"), path.join(dataRoot, "platform-chronology.json"));
    for (const file of ["2026-08-15-platform-chronology-audit.json", "2026-08-15-catalog-fact-snapshot.json", "2026-08-15-wikidata-catalog-1000.json"]) cpSync(path.join(root, "data", "curation", file), path.join(curationRoot, file));
    const registryPath = path.join(dataRoot, "platform-chronology.json");
    const candidate = JSON.parse(readFileSync(registryPath, "utf8")) as Record<string, unknown>;
    mutator(candidate);
    writeFileSync(registryPath, `${JSON.stringify(candidate, null, 2)}\n`);
    try {
      execFileSync(process.execPath, [path.join(root, "scripts", "validate-catalog-platform-chronology.mjs")], { cwd: fixtureRoot, encoding: "utf8", stdio: "pipe" });
      return "";
    } catch (error: unknown) {
      const failure = error as { stdout?: string; stderr?: string };
      return `${failure.stdout ?? ""}${failure.stderr ?? ""}`;
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

test("keeps the reviewed platform-debut registry source-bound and complete", () => {
  const platforms = registry.platforms as Array<Record<string, unknown>>;
  const sourceById = new Map((sourceRights.sources as Array<Record<string, unknown>>).map((source) => [source.id, source]));
  assert.equal(registry.schemaVersion, 1);
  assert.equal(registry.reviewedAt, "2026-08-15");
  assert.equal(platforms.length, 16);
  assert.equal(new Set(platforms.map((platform) => platform.platformId)).size, 16);
  assert.ok(platforms.every((platform) => platform.scope === "earliest-known-market-debut" && typeof platform.caveat === "string" && platform.caveat.includes("not an individual title availability date")));
  assert.ok(platforms.every((platform) => sourceById.has(platform.sourceId)));
  const nintendoHistory = sourceById.get("nintendo-platform-history");
  assert.deepEqual(nintendoHistory?.allowedFields, ["platformDebutYear", "individualSourceUrl"]);
  assert.deepEqual(nintendoHistory?.evidenceUrls, ["https://www.nintendo.co.jp/corporate/history/index.html", "https://www.nintendo.co.jp/corporate/release/en/2025/250402.html"]);
  for (const platform of platforms) {
    if (platform.sourceId === "nintendo-platform-history") assert.ok((nintendoHistory?.evidenceUrls as string[]).includes(platform.sourceUrl as string));
    if (platform.sourceId === "wikidata-fact-reference") assert.equal(platform.sourceUrl, `https://www.wikidata.org/wiki/${platform.wikidataPlatformId}`);
  }
});

test("rejects chronology citations outside their approved Nintendo and Wikidata evidence URLs", () => {
  const nintendoOutput = runChronologyValidator((candidate) => {
    const platforms = candidate.platforms as Array<Record<string, unknown>>;
    (platforms.find((platform) => platform.sourceId === "nintendo-platform-history") as Record<string, unknown>).sourceUrl = "https://example.com/not-approved";
  });
  assert.match(nintendoOutput, /requires an approved recorded Nintendo platform-debut evidence URL/);
  const wikidataOutput = runChronologyValidator((candidate) => {
    const platforms = candidate.platforms as Array<Record<string, unknown>>;
    (platforms.find((platform) => platform.sourceId === "wikidata-fact-reference") as Record<string, unknown>).sourceUrl = "https://example.com/not-approved";
  });
  assert.match(wikidataOutput, /requires its exact approved Wikidata platform-debut item URL/);
});

test("rejects a chronology entry that substitutes another approved catalog source", () => {
  const output = runChronologyValidator((candidate) => {
    const platforms = candidate.platforms as Array<Record<string, unknown>>;
    (platforms.find((platform) => platform.sourceId === "nintendo-platform-history") as Record<string, unknown>).sourceId = "gameatlas-editorial";
  });
  assert.match(output, /requires an approved chronology source/);
});

test("keeps title-year-before-debut associations neutral and preserves the four Switch 2 fixtures", () => {
  const associations = audit.associations as Array<Record<string, unknown>>;
  assert.equal(audit.recordCount, 1000);
  assert.equal(audit.associationCount, 153);
  assert.equal(associations.length, 153);
  assert.ok(associations.every((association) => association.platformReleaseYear === null && association.interpretation === "unresolved" && Number(association.titleReleaseYear) < Number(association.platformDebutYear)));
  const switch2 = new Map(associations.filter((association) => association.platformId === "nintendo-switch-2").map((association) => [association.slug, association]));
  for (const [slug, titleReleaseYear] of [["tomb-raider", 2013], ["cyberpunk-2077", 2020], ["apex-legends", 2019], ["hogwarts-legacy", 2023]] as const) {
    assert.deepEqual(switch2.get(slug), {
      slug,
      title: switch2.get(slug)?.title,
      titleReleaseYear,
      platformId: "nintendo-switch-2",
      platformDebutYear: 2025,
      platformReleaseYear: null,
      interpretation: "unresolved",
    });
  }
});

test("preserves facts while requiring explicit semantics for all frozen Wikidata records", () => {
  const snapshotRecords = facts.records as Array<Record<string, unknown>>;
  assert.equal(facts.recordCount, 1000);
  assert.equal(snapshotRecords.length, 1000);
  assert.ok(snapshotRecords.every((record) => !("releaseScope" in record) && !("platformAssociationScope" in record)));
  const games = readdirSync(path.join(root, "data/games")).filter((file) => file.endsWith(".json")).map((file) => JSON.parse(readFileSync(path.join(root, "data/games", file), "utf8")) as Record<string, unknown>);
  const generated = games.filter((game) => (game.sources as string[]).includes("wikidata-fact-reference"));
  assert.equal(generated.length, 897);
  assert.ok(generated.every((game) => (game.release as Record<string, unknown>).scope === "earliest-title-release" && game.platformAssociationScope === "source-listed"));
  execFileSync(process.execPath, ["scripts/generate-catalog-fact-snapshot.mjs", "--check"], { cwd: root, stdio: "pipe" });
  execFileSync(process.execPath, ["scripts/generate-catalog-platform-chronology.mjs", "--check"], { cwd: root, stdio: "pipe" });
});
