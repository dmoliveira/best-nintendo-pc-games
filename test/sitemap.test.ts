import assert from "node:assert/strict";
import { test } from "node:test";
import sitemap from "../app/sitemap";
import { createSiteConfig } from "../lib/site-config";

test("sitemap exposes the canonical no-JavaScript catalog index exactly once", () => {
  const site = createSiteConfig(process.env);
  const catalogEntries = sitemap().filter((entry) => entry.url === site.publicUrl("catalog/"));

  assert.equal(catalogEntries.length, 1);
  assert.equal(catalogEntries[0]?.changeFrequency, "weekly");
  assert.equal(catalogEntries[0]?.priority, 0.9);
});
