import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CatalogCards from "../app/catalog-cards";
import { getCatalogSearchRecords } from "../lib/catalog/site-data";
import { toCatalogCardRecord, type CatalogSearchRecord } from "../lib/catalog/search";

test("catalog cards expose one game route and describe compact metadata and external destinations", () => {
  const base = getCatalogSearchRecords()[0];
  if (!base) throw new Error("missing catalog fixture");
  const record: CatalogSearchRecord = {
    ...base,
    slug: "visual-card-fixture",
    title: "Visual card fixture",
    platformIds: ["nintendo-switch", "pc-windows", "nintendo-ds"],
    platformLabels: ["Nintendo Switch", "PC (Windows)", "Nintendo DS"],
    platformDisplayLabels: ["Switch", "PC / Windows", "DS"],
    platformHubIds: ["nintendo-switch"],
    releaseScope: "earliest-title-release",
    platformAssociationScope: "source-listed",
    genreIds: ["action", "adventure", "racing", "puzzle"],
    genreLabels: ["Action", "Adventure", "Racing", "Puzzle"],
    genreHubIds: ["action"],
    releaseYear: 2020,
    developer: "Fixture Studio",
    publisher: "Fixture Publisher",
    editorialLabel: "Featured",
    criticalLink: { label: "External/reference — Example Critic", url: "https://example.test/fallback-critic" },
    criticSummary: { label: "Critic score", display: "92/100", detail: "Published review", provider: "Test Critics", url: "https://example.test/critic" },
    salesSummary: { label: "Reported sales", display: "1.2M", detail: "Reported units", provider: "Test Sales", url: "https://example.test/sales" },
  };
  const markup = renderToStaticMarkup(createElement(CatalogCards, { records: [toCatalogCardRecord(record)], basePath: "/best-nintendo-pc-games" }));
  const detailLinks = markup.match(/href="[^\"]*\/games\/visual-card-fixture(?:\/)?"/g) ?? [];
  assert.equal(detailLinks.length, 1);
  assert.match(markup, /<ul class="game-card-topline-platforms"/);
  assert.match(markup, /Wikidata-listed platforms/);
  assert.match(markup, /Title year/);
  assert.match(markup, /data-platform-overflow="1"/);
  assert.match(markup, /<span aria-hidden="true">\+1<\/span> platforms/);
  assert.match(markup, /visually-hidden">: Nintendo DS<\/span>/);
  assert.match(markup, /data-genre-overflow="1"/);
  assert.match(markup, /<span aria-hidden="true">\+1<\/span> more genres/);
  assert.match(markup, /visually-hidden">: Puzzle<\/span>/);
  assert.match(markup, /<span class="editorial-badge"><span class="editorial-dot" aria-hidden="true"><\/span>Featured<\/span>/);
  assert.doesNotMatch(markup, /<div class="game-card-art" aria-hidden/);
  assert.doesNotMatch(markup, /<div class="game-card-art"[^>]*><a/);
  assert.match(markup, /class="game-card-filter-link" data-catalog-filter="platform" aria-label="Show Wikidata-listed catalog entries associated with Nintendo Switch" href="\/best-nintendo-pc-games\/\?platform=nintendo-switch#games"/);
  assert.match(markup, /class="game-card-guide-link" data-catalog-guide="platform" aria-label="Open Nintendo Switch platform guide" href="\/platforms\/nintendo-switch">Guide<\/a>/);
  assert.match(markup, /class="tag tag--[a-z]+ game-card-filter-link" data-catalog-filter="genre" aria-label="Show Action games" href="\/best-nintendo-pc-games\/\?genre=action#games"/);
  assert.match(markup, /class="game-card-guide-link" data-catalog-guide="genre" aria-label="Open Action genre guide" href="\/genres\/action">Guide<\/a>/);
  assert.match(markup, /class="game-card-year game-card-filter-link" data-catalog-filter="year" aria-label="Show catalog entries with catalog year 2020" href="\/best-nintendo-pc-games\/\?year=2020#games"/);
  assert.match(markup, /data-catalog-filter="developer" aria-label="Show games by developer: Fixture Studio" href="\/best-nintendo-pc-games\/\?developer=fixture\+studio#games">Fixture Studio<\/a>/);
  assert.match(markup, /data-catalog-filter="publisher" aria-label="Show games by publisher: Fixture Publisher" href="\/best-nintendo-pc-games\/\?publisher=fixture\+publisher#games">Fixture Publisher<\/a>/);
  assert.match(markup, /class="score-value" href="https:\/\/example\.test\/critic" target="_blank" rel="noreferrer" title="Test Critics · Published review" aria-label="Critic score: 92\/100; Published review; source Test Critics; opens in a new tab"/);
  assert.match(markup, /class="sales-summary" href="https:\/\/example\.test\/sales" target="_blank" rel="noreferrer" title="Test Sales · Reported units" aria-label="Reported sales: 1\.2M; Reported units; source Test Sales; opens in a new tab"/);
  assert.doesNotMatch(markup, /Open Example Critic critic score context/);

  const compactMarkup = renderToStaticMarkup(createElement(CatalogCards, { records: [toCatalogCardRecord(record)], basePath: "/best-nintendo-pc-games", showImages: false }));
  assert.match(compactMarkup, /class="game-card game-card--no-image"/);
  assert.doesNotMatch(compactMarkup, /game-card-art/);
  assert.match(compactMarkup, /game-card-compact-rail/);
  assert.match(compactMarkup, /Featured/);

  const curatedBase = getCatalogSearchRecords().find((candidate) => candidate.platformAssociationScope === "verified-release");
  if (!curatedBase) throw new Error("missing curated card fixture");
  const curatedRecord: CatalogSearchRecord = { ...curatedBase, slug: "curated-card-fixture", title: "Curated card fixture" };
  const mixedMarkup = renderToStaticMarkup(createElement(CatalogCards, { records: [toCatalogCardRecord(record), toCatalogCardRecord(curatedRecord)], basePath: "/best-nintendo-pc-games" }));
  const [, generatedCardMarkup, curatedCardMarkup] = mixedMarkup.split('<article class="game-card">');
  assert.match(generatedCardMarkup ?? "", /Wikidata-listed platforms/);
  assert.match(generatedCardMarkup ?? "", /Title year/);
  assert.doesNotMatch(curatedCardMarkup ?? "", /Wikidata-listed platforms|Title year/);
  assert.match(curatedCardMarkup ?? "", /Release year/);

  const aggregateGeneratedMarkup = renderToStaticMarkup(createElement(CatalogCards, { records: [toCatalogCardRecord(record, false)], basePath: "/best-nintendo-pc-games", sourceListedByDefault: true }));
  assert.match(aggregateGeneratedMarkup, /Wikidata-listed platforms/);
  assert.match(aggregateGeneratedMarkup, /Title year/);
});
