import assert from "node:assert/strict";
import { test } from "node:test";
import { getCatalogGame, getCatalogGames, getEditorialSignals, getPopulatedPlatforms } from "../lib/catalog/site-data";

test("loads every validated game with resolved taxonomy labels", () => {
  const games = getCatalogGames();
  assert.equal(games.length, 30);
  assert.equal(new Set(games.map(({ game }) => game.slug)).size, games.length);
  assert.ok(games.every(({ platforms, genres }) => platforms.length > 0 && genres.length > 0));
  assert.ok(games.every(({ game }) => getEditorialSignals(game).length > 0));
  assert.ok(games.every(({ platforms, genres }) => platforms.every((platform) => platform.name.length > 0) && genres.every((genre) => genre.name.length > 0)));
});

test("resolves static game routes by slug and fails closed for unknown slugs", () => {
  assert.equal(getCatalogGame("super-mario-bros")?.game.title, "Super Mario Bros.");
  assert.equal(getCatalogGame("missing-game"), undefined);
});

test("reports only platform families with validated records as populated", () => {
  const populated = getPopulatedPlatforms();
  assert.equal(populated.length, 14);
  assert.ok(populated.every((platform) => platform.coverage === "populated"));
});
