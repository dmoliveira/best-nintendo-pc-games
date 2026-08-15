import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CatalogCards from "../app/catalog-cards";
import { getCatalogSearchRecords } from "../lib/catalog/site-data";

test("catalog cards expose one game route and announce omitted platform and genre labels", () => {
  const base = getCatalogSearchRecords()[0];
  if (!base) throw new Error("missing catalog fixture");
  const record = {
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
});
