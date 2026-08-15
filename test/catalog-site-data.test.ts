import assert from "node:assert/strict";
import { test } from "node:test";
import { getCatalogGame, getCatalogGames, getCatalogGenre, getCatalogGenres, getCatalogPlatform, getCatalogPlatforms, getEditorialSignals, getGenreHub, getGenreHubs, getPlatformHub, getPlatformHubs, getPopulatedPlatforms } from "../lib/catalog/site-data";

test("loads every validated game with resolved taxonomy labels", () => {
  const games = getCatalogGames();
  assert.equal(games.length, 43);
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
  assert.equal(populated.length, 16);
  assert.ok(populated.every((platform) => platform.coverage === "populated"));
});


test("taxonomy hub inventories include only referenced populated entries", () => {
  const platforms = getCatalogPlatforms();
  const genres = getCatalogGenres();
  const records = getCatalogGames();
  assert.equal(platforms.length, 16);
  assert.equal(genres.length, 7);
  assert.ok(platforms.every((platform) => records.some(({ game }) => game.platforms.includes(platform.id))));
  assert.ok(genres.every((genre) => records.some(({ game }) => game.genres.includes(genre.id))));
  assert.equal(getPlatformHubs().length, 8);
  assert.equal(getGenreHubs().length, 7);
  assert.equal(getPlatformHub("nintendo-nes"), undefined);
  assert.equal(getGenreHub("missing-genre"), undefined);
  assert.equal(getCatalogPlatform("missing-platform"), undefined);
  assert.equal(getCatalogGenre("missing-genre"), undefined);
});
