import assert from "node:assert/strict";
import { test } from "node:test";
import { createManifest } from "../app/manifest";
import { createSiteConfig } from "../lib/site-config";

test("manifest start URL stays within configured Pages scope", () => {
  const projectPagesSite = createSiteConfig({ NODE_ENV: "production", PAGES_BASE_PATH: "/best-nintendo-pc-games", SITE_URL: "https://dmoliveira.github.io/best-nintendo-pc-games/" });
  const rootSite = createSiteConfig({ NODE_ENV: "production", PAGES_BASE_PATH: "/", SITE_URL: "https://example.com" });

  assert.equal(createManifest(projectPagesSite).start_url, "/best-nintendo-pc-games/");
  assert.equal(createManifest(rootSite).start_url, "/");
});
