import assert from "node:assert/strict";
import { test } from "node:test";
import { getGenreTone, getPlatformIconKind } from "../lib/catalog/display";
import { getCatalogPlatforms, getCatalogGenres } from "../lib/catalog/site-data";

test("maps every populated platform to a stable generic device glyph", () => {
  const platforms = getCatalogPlatforms();
  assert.equal(platforms.length, 16);
  assert.ok(platforms.every((platform) => ["console", "handheld", "hybrid", "pc"].includes(getPlatformIconKind(platform.id))));
  assert.equal(getPlatformIconKind("pc-steam-deck"), "pc");
  assert.equal(getPlatformIconKind("future-console"), "console");
});

test("assigns deterministic semantic tones to every populated genre", () => {
  const genres = getCatalogGenres();
  assert.equal(genres.length, 7);
  assert.ok(genres.every((genre) => ["amber", "coral", "cyan", "lime", "violet"].includes(getGenreTone(genre.id))));
  assert.equal(getGenreTone("future-genre"), "cyan");
});
