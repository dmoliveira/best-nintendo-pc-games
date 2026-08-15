import assert from "node:assert/strict";
import { test } from "node:test";
import { createSiteConfig } from "../lib/site-config";
import { createBreadcrumbStructuredData, createCollectionPageStructuredData, createVideoGameStructuredData, createWebSiteStructuredData, serializeStructuredData } from "../lib/structured-data";

const site = createSiteConfig({ NODE_ENV: "production", PAGES_BASE_PATH: "/best-nintendo-pc-games", SITE_URL: "https://dmoliveira.github.io/best-nintendo-pc-games/" });

test("structured data emits conservative score-free schemas with Pages URLs", () => {
  const gameUrl = site.publicUrl("games/example/");
  const game = createVideoGameStructuredData({ title: "Example", description: "A useful description.", url: gameUrl, releaseDate: "1990-01-02", platformNames: ["NES"], genreNames: ["Adventure"] });
  const collection = createCollectionPageStructuredData({ site, url: site.publicUrl("platforms/nintendo-nes/"), name: "NES Games", description: "NES guide." });
  const breadcrumb = createBreadcrumbStructuredData([{ name: "GameAtlas", url: site.canonicalUrl }, { name: "Example", url: gameUrl }]);
  const website = createWebSiteStructuredData(site);

  assert.equal(game["@type"], "VideoGame");
  assert.equal(game.datePublished, "1990-01-02");
  assert.equal(collection["@type"], "CollectionPage");
  assert.equal(breadcrumb["@type"], "BreadcrumbList");
  assert.equal(website["@type"], "WebSite");
  assert.doesNotMatch(JSON.stringify([game, collection, breadcrumb, website]), /aggregateRating|ratingValue|sales|popularity/);
});

test("structured data serialization cannot terminate its script element", () => {
  const serialized = serializeStructuredData(createVideoGameStructuredData({ title: "</script><script>alert(1)</script>", description: "A & B", url: site.publicUrl("games/example/"), platformNames: [], genreNames: [] }));
  assert.doesNotMatch(serialized, /<\/?script/i);
  assert.equal(JSON.parse(serialized).name, "</script><script>alert(1)</script>");
});

test("year-only game records omit an invented publication date", () => {
  const game = createVideoGameStructuredData({ title: "Example", description: "A useful description.", url: site.publicUrl("games/example/"), releaseDate: "1990", platformNames: [], genreNames: [] });
  assert.equal("datePublished" in game, false);
});
