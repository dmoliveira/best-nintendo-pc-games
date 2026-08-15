import assert from "node:assert/strict";
import { test } from "node:test";
import { getCatalogSearchRecords } from "../lib/catalog/site-data";
import { filterCatalog, getCatalogPaginationItems, normalizeSearchText, paginateCatalog, parseSearchState, serializeSearchState, type SearchStateOptions } from "../lib/catalog/search";

const records = getCatalogSearchRecords();
const options: SearchStateOptions = {
  platformIds: new Set(records.flatMap((record) => record.platformIds)),
  genreIds: new Set(records.flatMap((record) => record.genreIds)),
  years: new Set(records.map((record) => String(record.releaseYear))),
  developerValues: new Set(records.flatMap((record) => record.developer ? [normalizeSearchText(record.developer)] : [])),
  publisherValues: new Set(records.flatMap((record) => record.publisher ? [normalizeSearchText(record.publisher)] : [])),
  yearMin: Math.min(...records.map((record) => record.releaseYear)),
  yearMax: Math.max(...records.map((record) => record.releaseYear)),
};

test("normalizes punctuation, diacritics, and whitespace for search", () => {
  assert.equal(normalizeSearchText("  Pokémon: Crystal  "), "pokemon crystal");
  assert.equal(normalizeSearchText("Mario—Kart"), "mario kart");
});

test("round-trips canonical URL search state and drops unknown filters", () => {
  const state = { q: "  mario   kart ", platform: "pc-windows,nintendo-switch", genre: "racing,action", year: "", columns: "3" as const, yearFrom: "2010", yearTo: "2023", developer: "nintendo", publisher: "nintendo", sort: "newest" as const, page: 2, pageSize: 48 as const };
  const query = serializeSearchState(state);
  assert.equal(query, "?q=mario+kart&platform=nintendo-switch%2Cpc-windows&genre=action%2Cracing&from=2010&to=2023&developer=nintendo&publisher=nintendo&sort=newest&page=2&perPage=48&columns=3");
  assert.deepEqual(parseSearchState(new URLSearchParams(query), options), { ...state, q: "mario kart", platform: "nintendo-switch,pc-windows", genre: "action,racing" });
  assert.deepEqual(parseSearchState(new URLSearchParams("?platform=unknown%2Cnintendo-switch&platform=pc-windows&genre=nope&year=1900&sort=score&page=0&perPage=13&columns=9"), options), { q: "", platform: "nintendo-switch,pc-windows", genre: "", year: "", columns: "auto", yearFrom: "", yearTo: "", developer: "", publisher: "", sort: "relevance", page: 1, pageSize: 24 });
  assert.deepEqual(parseSearchState(new URLSearchParams("?year=2023"), options), { q: "", platform: "", genre: "", year: "2023", columns: "auto", yearFrom: "", yearTo: "", developer: "", publisher: "", sort: "relevance", page: 1, pageSize: 24 });
});

test("applies AND query matching and combined filters deterministically", () => {
  const marioKart = filterCatalog(records, { q: "mario kart", platform: "", genre: "", year: "", columns: "auto" });
  assert.ok(marioKart.length >= 5);
  assert.ok(marioKart.every((record) => record.searchText.includes("mario") && record.searchText.includes("kart")));
  const switchAction = filterCatalog(records, { q: "", platform: "nintendo-switch", genre: "action", year: "", columns: "auto" });
  const expectedExistingSwitchAction = [
    "kirby-and-the-forgotten-land",
    "metroid-dread",
    "super-mario-odyssey",
    "the-legend-of-zelda-breath-of-the-wild",
    "the-legend-of-zelda-tears-of-the-kingdom",
  ];
  assert.ok(expectedExistingSwitchAction.every((slug) => switchAction.some((record) => record.slug === slug)));
  assert.ok(switchAction.every((record) => record.platformIds.includes("nintendo-switch") && record.genreIds.includes("action")));
  const pcGames = filterCatalog(records, { q: "", platform: "pc-windows", genre: "", year: "", columns: "auto" });
  assert.ok(pcGames.length >= 273);
  const sortedPcTitles = [...pcGames].sort((left, right) => {
    const leftKey = normalizeSearchText(left.title);
    const rightKey = normalizeSearchText(right.title);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  }).map((record) => record.title);
  assert.deepEqual(pcGames.map((record) => record.title), sortedPcTitles);
});

test("combines multi-select facets, advanced filters, and inclusive year ranges", () => {
  const switchOrPc = filterCatalog(records, { q: "", platform: "nintendo-switch,pc-windows", genre: "", year: "" });
  assert.ok(switchOrPc.length > 17);
  assert.ok(switchOrPc.every((record) => record.platformIds.includes("nintendo-switch") || record.platformIds.includes("pc-windows")));

  const nintendoAction = filterCatalog(records, { q: "", platform: "", genre: "action", year: "", developer: "Nintendo", yearFrom: "1985", yearTo: "2025" });
  assert.ok(nintendoAction.length > 0);
  assert.ok(nintendoAction.every((record) => normalizeSearchText(record.developer ?? "") === "nintendo" && record.genreIds.includes("action") && record.releaseYear >= 1985 && record.releaseYear <= 2025));
});

test("sorts by release, platform, title, and query relevance with stable ties", () => {
  const newest = filterCatalog(records, { q: "", platform: "", genre: "", year: "", sort: "newest" });
  assert.ok(newest.every((record, index) => index === 0 || record.releaseYear <= newest[index - 1].releaseYear));

  const title = filterCatalog(records, { q: "", platform: "", genre: "", year: "", sort: "title" });
  assert.deepEqual(title.map((record) => normalizeSearchText(record.title)), [...title].map((record) => normalizeSearchText(record.title)).sort());

  const mario = filterCatalog(records, { q: "mario", platform: "", genre: "", year: "", sort: "relevance" });
  assert.match(mario[0]?.title ?? "", /mario/i);
});

test("clamps pagination and exposes stable ranges", () => {
  const sorted = filterCatalog(records, { q: "", platform: "", genre: "", year: "", sort: "title" });
  const page = paginateCatalog(sorted, 999, 48);
  assert.equal(page.pageSize, 48);
  assert.equal(page.pageCount, Math.ceil(records.length / 48));
  assert.equal(page.page, Math.ceil(records.length / 48));
  assert.equal(page.startIndex, (page.pageCount - 1) * 48);
  assert.equal(page.endIndex, records.length);
  assert.equal(page.records.length, records.length - page.startIndex);
});

test("keeps large catalog pagination compact while retaining boundary and nearby pages", () => {
  const labels = (pageCount: number, currentPage: number) => getCatalogPaginationItems(pageCount, currentPage).map((item) => item.type === "page" ? item.page : "…");
  assert.deepEqual(labels(42, 21), [1, "…", 19, 20, 21, 22, 23, "…", 42]);
  assert.deepEqual(labels(84, 1), [1, 2, 3, 4, 5, 6, 7, "…", 84]);
  assert.deepEqual(labels(3, 2), [1, 2, 3]);
});

test("client search projection excludes raw evidence objects", () => {
  const serialized = JSON.stringify(records);
  for (const forbidden of ["\"sourceUrl\":", "\"termsUrl\":", "\"rightsStatus\":", "\"verificationStatus\":", "\"capturedAt\":", "\"recheckAt\":", "\"rationale\":", "\"links\":", "\"provenanceId\":", "\"score\":", "\"scale\":", "\"count\":", "\"value\":", "\"rank\":"]) assert.doesNotMatch(serialized, new RegExp(forbidden));
  assert.match(serialized, /GameAtlas editorial/);
  assert.ok(records.every((record) => record.artPath?.includes("/assets/games/") && record.artAlt));
  assert.ok(records.every((record) => record.platformDisplayLabels.length === record.platformLabels.length));
  assert.equal(records.find((record) => record.platformIds.includes("pc-windows"))?.platformDisplayLabels[0], "PC / Windows");
  assert.ok(records.every((record) => ["GameAtlas pick", "GameAtlas catalog entry"].includes(record.editorialLabel ?? "")));
  assert.equal(records.find((record) => record.slug === "halo-3")?.editorialLabel, "GameAtlas catalog entry");
  assert.ok(records.find((record) => record.slug === "halo-3")?.evidenceLabels.includes("GameAtlas catalog method"));
  assert.equal(records.find((record) => record.slug === "super-mario-bros")?.editorialLabel, "GameAtlas pick");
  assert.ok(records.find((record) => record.slug === "super-mario-bros")?.evidenceLabels.includes("GameAtlas editorial"));
  assert.ok(records.every((record) => !record.criticSummary && !record.salesSummary));
  assert.equal(records.filter((record) => record.criticalLink).length, 32);
  assert.ok(records.filter((record) => record.criticalLink).every((record) => record.criticalLink?.url.startsWith("https://www.metacritic.com/game/")));
});

test("round-trips the optional layout mode without treating it as a filter", () => {
  const auto = parseSearchState(new URLSearchParams("?columns=auto"), options);
  assert.equal(auto.columns, "auto");
  assert.equal(serializeSearchState({ ...auto, q: "mario" }), "?q=mario");
  const three = parseSearchState(new URLSearchParams("?columns=3"), options);
  assert.equal(three.columns, "3");
  assert.equal(filterCatalog(records, three).length, records.length);
});
