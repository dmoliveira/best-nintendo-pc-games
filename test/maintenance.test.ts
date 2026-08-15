import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
// These standalone maintenance scripts are executed by Node and intentionally do not ship app declarations.
// @ts-expect-error The test supplies the narrow runtime contract below.
import { checkInventory, checkUrl, validatePublicUrl } from "../scripts/check-links.mjs";
// @ts-expect-error The test supplies the narrow runtime contract below.
import { buildMaintenanceUrlInventory } from "../scripts/maintenance-url-inventory.mjs";
// @ts-expect-error The test supplies the narrow runtime contract below.
import { buildCoverageReport } from "../scripts/report-catalog-coverage.mjs";

function response(status: number, location?: string) {
  return {
    status,
    headers: { get: (name: string) => name.toLowerCase() === "location" ? location ?? null : null },
    body: { cancel: () => undefined },
  };
}

test("coverage report is deterministic and describes the published catalog", () => {
  const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
  const first = buildCoverageReport(root);
  const second = buildCoverageReport(root);
  assert.deepEqual(first, second);
  assert.equal(first.catalog.games, 1000);
  assert.equal(first.platforms.length, 16);
  assert.equal(first.genres.length, 20);
  assert.equal(first.signals.licensedNumericSignals, 0);
  assert.ok(first.links.uniquePublishedUrls > 0);
  assert.equal(first.platforms[0].id, "game-boy");
  assert.deepEqual(JSON.parse(readFileSync(new URL("../data/catalog-coverage-report.json", import.meta.url), "utf8")), first);
});

test("maintenance inventory is sorted, deduplicated, and excludes frozen curation inputs", () => {
  const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
  const inventory = buildMaintenanceUrlInventory(root);
  assert.deepEqual(inventory.map((entry: { url: string }) => entry.url), [...inventory].map((entry: { url: string }) => entry.url).sort());
  assert.equal(new Set(inventory.map((entry: { url: string }) => entry.url)).size, inventory.length);
  assert.ok(inventory.some((entry: { url: string }) => entry.url.startsWith("https://www.wikidata.org/wiki/")));
  assert.ok(inventory.every((entry: { sources: string[] }) => entry.sources.every((source: string) => !source.includes("data/curation/"))));
});

test("link policy rejects insecure and private targets before fetching", async () => {
  assert.equal(validatePublicUrl("http://example.com").ok, false);
  assert.equal(validatePublicUrl("https://127.0.0.1/private").ok, false);
  assert.equal(validatePublicUrl("https://[::ffff:127.0.0.1]/private").ok, false);
  assert.equal(validatePublicUrl("https://198.19.0.1/private").ok, false);
  assert.equal(validatePublicUrl("https://[fec0::1]/private").ok, false);
  let calls = 0;
  const result = await checkUrl("http://example.com", { fetchImpl: async () => { calls += 1; return response(200); } });
  assert.equal(result.status, "fail");
  assert.equal(calls, 0);
});

test("link checker falls back from HEAD and rejects insecure redirects", async () => {
  const methods: string[] = [];
  const fallback = await checkUrl("https://example.com/fallback", { fetchImpl: async (_url: string, options: { method: string }) => { methods.push(options.method); return options.method === "HEAD" ? response(405) : response(200); } });
  assert.equal(fallback.status, "pass");
  assert.deepEqual(methods, ["HEAD", "GET"]);

  const redirect = await checkUrl("https://example.com/redirect", { fetchImpl: async () => response(302, "http://example.com/insecure") });
  assert.equal(redirect.status, "fail");
  assert.match(redirect.reason, /non-HTTPS/);
});

test("link checker distinguishes definitive failures from transient warnings", async () => {
  const missing = await checkUrl("https://example.com/missing", { fetchImpl: async () => response(404) });
  const blocked = await checkUrl("https://example.com/blocked", { fetchImpl: async () => response(403) });
  assert.equal(missing.status, "fail");
  assert.equal(blocked.status, "warn");
});

test("link inventory checks are bounded and return URL-sorted results", async () => {
  let active = 0;
  let maximum = 0;
  const results = await checkInventory([
    { url: "https://example.com/z", sources: ["z"] },
    { url: "https://example.com/a", sources: ["a"] },
    { url: "https://example.com/m", sources: ["m"] },
  ], { concurrency: 2, fetchImpl: async () => { active += 1; maximum = Math.max(maximum, active); await new Promise((resolve) => setTimeout(resolve, 2)); active -= 1; return response(200); } });
  assert.ok(maximum <= 2);
  assert.deepEqual(results.map((entry: { url: string }) => entry.url), ["https://example.com/a", "https://example.com/m", "https://example.com/z"]);
});
