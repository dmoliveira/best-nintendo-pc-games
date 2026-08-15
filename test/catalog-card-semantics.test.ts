import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CatalogCards from "../app/catalog-cards";
import { getCatalogSearchRecords } from "../lib/catalog/site-data";
import type { CatalogSearchRecord } from "../lib/catalog/search";

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
    platformHubIds: [],
    genreIds: ["action", "adventure", "racing", "puzzle"],
    genreLabels: ["Action", "Adventure", "Racing", "Puzzle"],
    genreHubIds: [],
    editorialLabel: "Featured",
    criticalLink: { label: "External/reference — Example Critic", url: "https://example.test/fallback-critic" },
    criticSummary: { label: "Critic score", display: "92/100", detail: "Published review", provider: "Test Critics", url: "https://example.test/critic" },
    salesSummary: { label: "Reported sales", display: "1.2M", detail: "Reported units", provider: "Test Sales", url: "https://example.test/sales" },
  };
  const markup = renderToStaticMarkup(createElement(CatalogCards, { records: [record] }));
  const detailLinks = markup.match(/href="[^\"]*\/games\/visual-card-fixture(?:\/)?"/g) ?? [];
  assert.equal(detailLinks.length, 1);
  assert.match(markup, /<ul class="game-card-topline-platforms"/);
  assert.match(markup, /data-platform-overflow="1"/);
  assert.match(markup, /<span aria-hidden="true">\+1<\/span> platforms/);
  assert.match(markup, /visually-hidden">: Nintendo DS<\/span>/);
  assert.match(markup, /data-genre-overflow="1"/);
  assert.match(markup, /<span aria-hidden="true">\+1<\/span> more genres/);
  assert.match(markup, /visually-hidden">: Puzzle<\/span>/);
  assert.match(markup, /<span class="editorial-badge"><span class="editorial-dot" aria-hidden="true"><\/span>Featured<\/span>/);
  assert.doesNotMatch(markup, /<div class="game-card-art" aria-hidden/);
  assert.doesNotMatch(markup, /<div class="game-card-art"[^>]*><a/);
  assert.match(markup, /class="score-value" href="https:\/\/example\.test\/critic" target="_blank" rel="noreferrer" title="Test Critics · Published review" aria-label="Critic score: 92\/100; Published review; source Test Critics; opens in a new tab"/);
  assert.match(markup, /class="sales-summary" href="https:\/\/example\.test\/sales" target="_blank" rel="noreferrer" title="Test Sales · Reported units" aria-label="Reported sales: 1\.2M; Reported units; source Test Sales; opens in a new tab"/);
  assert.doesNotMatch(markup, /Open Example Critic critic score context/);

  const compactMarkup = renderToStaticMarkup(createElement(CatalogCards, { records: [record], showImages: false }));
  assert.match(compactMarkup, /class="game-card game-card--no-image"/);
  assert.doesNotMatch(compactMarkup, /game-card-art/);
  assert.match(compactMarkup, /game-card-compact-rail/);
  assert.match(compactMarkup, /Featured/);
});
