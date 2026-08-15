import assert from "node:assert/strict";
import { test } from "node:test";
import { createSiteConfig, normalizeBasePath } from "../lib/site-config";

test("normalizes Pages base paths", () => {
  assert.equal(normalizeBasePath("best-nintendo-pc-games/"), "/best-nintendo-pc-games");
  assert.equal(normalizeBasePath("/"), "");
  assert.equal(normalizeBasePath(undefined), "");
  assert.throws(() => normalizeBasePath("//example.com"), /Invalid Pages base path/);
  assert.throws(() => normalizeBasePath("/catalog/../private"), /Invalid Pages base path/);
  assert.throws(() => normalizeBasePath("/catalog?redirect=1"), /Invalid Pages base path/);
});

test("builds stable public URLs for a project Pages site", () => {
  const site = createSiteConfig({ NODE_ENV: "production", PAGES_BASE_PATH: "/best-nintendo-pc-games", SITE_URL: "https://dmoliveira.github.io/best-nintendo-pc-games/" });
  assert.equal(site.basePath, "/best-nintendo-pc-games");
  assert.equal(site.canonicalUrl, "https://dmoliveira.github.io/best-nintendo-pc-games/");
  assert.equal(site.publicUrl("sitemap.xml"), "https://dmoliveira.github.io/best-nintendo-pc-games/sitemap.xml");
  assert.equal(site.assetPath("og-image.svg"), "/best-nintendo-pc-games/og-image.svg");
  assert.equal(site.repositoryUrl, "https://github.com/dmoliveira/best-nintendo-pc-games");
  assert.match(site.correctionUrl, /issues\/new\?template=catalog-correction\.yml&title=GameAtlas%20catalog%20correction/);
});

test("rejects unsafe production site URL configuration", () => {
  assert.throws(() => createSiteConfig({ NODE_ENV: "production", PAGES_BASE_PATH: "/best-nintendo-pc-games", SITE_URL: "http://example.com/best-nintendo-pc-games" }), /must use HTTPS/);
  assert.throws(() => createSiteConfig({ NODE_ENV: "production", PAGES_BASE_PATH: "/best-nintendo-pc-games", SITE_URL: "https://example.com/other" }), /do not match/);
  assert.throws(() => createSiteConfig({ NODE_ENV: "production", PAGES_BASE_PATH: "/best-nintendo-pc-games", SITE_URL: "https://example.com/best-nintendo-pc-games?x=1" }), /do not match/);
});
