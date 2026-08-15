import assert from "node:assert/strict";
import { test } from "node:test";
import { getGenreTone, getPlatformAccentKind, getPlatformDisplayLabel, getPlatformIconKind } from "../lib/catalog/display";
import { getCatalogPlatforms, getCatalogGenres } from "../lib/catalog/site-data";

test("maps every populated platform to a stable generic device glyph", () => {
  const platforms = getCatalogPlatforms();
  assert.equal(platforms.length, 16);
  assert.ok(platforms.every((platform) => ["console", "handheld", "hybrid", "pc"].includes(getPlatformIconKind(platform.id))));
  assert.equal(getPlatformIconKind("pc-steam-deck"), "pc");
  assert.equal(getPlatformIconKind("future-console"), "console");
});

test("adds an abstract, deterministic accent without recreating platform trade dress", () => {
  const platforms = getCatalogPlatforms();
  const accents = ["signal", "orbit", "prism", "wave", "frame", "bridge", "spark", "grid"];
  assert.ok(platforms.every((platform) => accents.includes(getPlatformAccentKind(platform.id))));
  assert.equal(getPlatformAccentKind("pc-steam-deck"), "grid");
  assert.equal(getPlatformAccentKind("future-console"), "signal");
});

test("assigns deterministic semantic tones to every populated genre", () => {
  const genres = getCatalogGenres();
  assert.equal(genres.length, 20);
  assert.ok(genres.every((genre) => ["amber", "coral", "cyan", "lime", "violet"].includes(getGenreTone(genre.id))));
  assert.equal(getGenreTone("future-genre"), "cyan");
});

test("uses concise platform labels without changing canonical names", () => {
  const platforms = getCatalogPlatforms();
  const labels = new Map(platforms.map((platform) => [platform.id, getPlatformDisplayLabel(platform)]));
  assert.equal(labels.get("nintendo-nes"), "NES");
  assert.equal(labels.get("nintendo-switch-2"), "Switch 2");
  assert.equal(labels.get("pc-windows"), "PC / Windows");
  assert.equal(getPlatformDisplayLabel({ id: "future-platform", name: "Future Platform", aliases: ["Future"] }), "Future");
});
