import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const platformPage = readFileSync(new URL("../app/platforms/[id]/page.tsx", import.meta.url), "utf8");
const genrePage = readFileSync(new URL("../app/genres/[id]/page.tsx", import.meta.url), "utf8");
const hub = readFileSync(new URL("../app/taxonomy-hub.tsx", import.meta.url), "utf8");

test("platform and genre hubs are static, bounded, and metadata-aware", () => {
  for (const page of [platformPage, genrePage]) {
    assert.match(page, /dynamicParams = false/);
    assert.match(page, /generateStaticParams/);
    assert.match(page, /generateMetadata/);
    assert.match(page, /notFound/);
    assert.match(page, /TaxonomyHub/);
  }
  assert.match(hub, /className="skip-link" href="#main-content"/);
  assert.match(hub, /<main className="hub-page" id="main-content">/);
  assert.match(hub, /CatalogCards/);
  assert.match(hub, /catalog games/);
  assert.match(hub, /type TaxonomyVisual/);
  assert.match(hub, /visual: TaxonomyVisual/);
  assert.match(hub, /data-taxonomy-visual/);
  assert.match(hub, /catalogFilterHref/);
  assert.match(hub, /createSiteConfig\(process\.env\)/);
  assert.match(hub, /<a href=\{catalogHref\}>Show matching catalog games/);
  assert.match(hub, /CatalogCards records=\{records\.map\(\(record\) => toCatalogCardRecord\(record\)\)\} basePath=\{site\.basePath\}/);
  assert.match(hub, /Show matching catalog games/);
  assert.match(platformPage, /visual=\{\{ kind: "platform", platformId: platform.id \}\}/);
  assert.match(genrePage, /visual=\{\{ kind: "genre", genreId: genre.id \}\}/);
  assert.match(genrePage, /visual=\{\{ kind: "genre"/);
});
