import assert from "node:assert/strict";
import { test } from "node:test";
import { getCatalogSearchRecords } from "../lib/catalog/site-data";
import { filterCatalog, normalizeSearchText, parseSearchState, serializeSearchState, type SearchStateOptions } from "../lib/catalog/search";

const records = getCatalogSearchRecords();
const options: SearchStateOptions = {
  platformIds: new Set(records.flatMap((record) => record.platformIds)),
  genreIds: new Set(records.flatMap((record) => record.genreIds)),
  years: new Set(records.map((record) => String(record.releaseYear))),
};

test("normalizes punctuation, diacritics, and whitespace for search", () => {
  assert.equal(normalizeSearchText("  Pokémon: Crystal  "), "pokemon crystal");
  assert.equal(normalizeSearchText("Mario—Kart"), "mario kart");
});

test("round-trips canonical URL search state and drops unknown filters", () => {
  const state = { q: "  mario   kart ", platform: "nintendo-switch", genre: "racing", year: "2023" };
  const query = serializeSearchState(state);
  assert.equal(query, "?q=mario+kart&platform=nintendo-switch&genre=racing&year=2023");
  assert.deepEqual(parseSearchState(new URLSearchParams(query), options), { q: "mario kart", platform: "nintendo-switch", genre: "racing", year: "2023" });
  assert.deepEqual(parseSearchState(new URLSearchParams("?platform=unknown&genre=nope&year=1900"), options), { q: "", platform: "", genre: "", year: "" });
});

test("applies AND query matching and combined filters deterministically", () => {
  const marioKart = filterCatalog(records, { q: "mario kart", platform: "", genre: "", year: "" });
  assert.ok(marioKart.length >= 5);
  assert.ok(marioKart.every((record) => record.searchText.includes("mario") && record.searchText.includes("kart")));
  const switchAction = filterCatalog(records, { q: "", platform: "nintendo-switch", genre: "action", year: "" });
  assert.deepEqual(switchAction.map((record) => record.slug), ["the-legend-of-zelda-tears-of-the-kingdom"]);
  const pcGames = filterCatalog(records, { q: "", platform: "pc-windows", genre: "", year: "" });
  assert.equal(pcGames.length, 10);
  const sortedPcTitles = [...pcGames].sort((left, right) => {
    const leftKey = normalizeSearchText(left.title);
    const rightKey = normalizeSearchText(right.title);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  }).map((record) => record.title);
  assert.deepEqual(pcGames.map((record) => record.title), sortedPcTitles);
});

test("client search projection excludes raw evidence objects", () => {
  const serialized = JSON.stringify(records);
  for (const forbidden of ["sourceUrl", "termsUrl", "rightsStatus", "verificationStatus", "capturedAt", "recheckAt", "rationale", "links", "provenanceId", "\"score\"", "\"scale\"", "\"count\"", "\"value\"", "\"rank\""]) assert.doesNotMatch(serialized, new RegExp(forbidden));
  assert.match(serialized, /GameAtlas editorial/);
  assert.ok(records.every((record) => record.artPath?.includes("/assets/games/") && record.artAlt));
  assert.ok(records.every((record) => record.editorialLabel === "GameAtlas pick"));
  assert.equal(records.filter((record) => record.criticalLink).length, 32);
  assert.ok(records.filter((record) => record.criticalLink).every((record) => record.criticalLink?.url.startsWith("https://www.metacritic.com/game/")));
});
