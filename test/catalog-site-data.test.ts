import assert from "node:assert/strict";
import { test } from "node:test";
import { MINIMUM_HUB_RECORDS, getCatalogGame, getCatalogGames, getCatalogGenre, getCatalogGenres, getCatalogPlatform, getCatalogPlatforms, getEditorialSignals, getGenreHub, getGenreHubs, getPlatformHub, getPlatformHubs, getPopulatedPlatforms, toCatalogSearchRecord } from "../lib/catalog/site-data";

test("loads every validated game with resolved taxonomy labels", () => {
  const games = getCatalogGames();
  assert.equal(games.length, 1000);
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
  assert.equal(genres.length, 20);
  assert.ok(platforms.every((platform) => records.some(({ game }) => game.platforms.includes(platform.id))));
  assert.ok(genres.every((genre) => records.some(({ game }) => game.genres.includes(genre.id))));
  assert.equal(getPlatformHubs().length, 16);
  const expectedGenreHubCount = genres.filter((genre) => records.filter(({ game }) => game.genres.includes(genre.id)).length >= MINIMUM_HUB_RECORDS).length;
  assert.equal(getGenreHubs().length, expectedGenreHubCount);
  assert.ok(getGenreHubs().every((genre) => records.filter(({ game }) => game.genres.includes(genre.id)).length >= MINIMUM_HUB_RECORDS));
  assert.equal(getPlatformHub("nintendo-nes")?.id, "nintendo-nes");
  assert.equal(getGenreHub("missing-genre"), undefined);
  assert.equal(getCatalogPlatform("missing-platform"), undefined);
  assert.equal(getCatalogGenre("missing-genre"), undefined);
});


test("keeps external rating references link-only and manifest-backed card art present", () => {
  const games = getCatalogGames();
  const ratingLinks = games.flatMap(({ game }) => game.links.filter((link) => link.label === "External/reference — Metacritic"));
  assert.ok(ratingLinks.length >= 32);
  assert.ok(ratingLinks.every((link) => link.kind === "critical" && link.url.startsWith("https://www.metacritic.com/game/")));
  assert.ok(games.every(({ game }) => {
    const cardAssets = game.assets.filter((asset) => asset.role !== "box-front");
    return cardAssets.length === 1 && cardAssets[0].path.startsWith("public/assets/games/");
  }));
});


test("excludes governed package fronts from catalog-card artwork", () => {
  const entry = getCatalogGame("art-of-rally");
  if (!entry) throw new Error("missing art-of-rally fixture");
  const packageFront = {
    path: "public/assets/games/art-of-rally/front-pc-big-box.png",
    alt: "Original GameAtlas editorial front artwork for art of rally.",
    provenanceId: "game-art-of-rally-box-front-pc-big-box",
    role: "box-front" as const,
    boxFormatId: "pc-big-box",
  };
  const record = toCatalogSearchRecord({ ...entry, game: { ...entry.game, assets: [packageFront, ...entry.game.assets] } });
  assert.ok(record.artPath?.endsWith("/assets/games/art-of-rally.svg"));
  assert.equal(record.artAlt, entry.game.assets[0]?.alt);
  const boxOnly = toCatalogSearchRecord({ ...entry, game: { ...entry.game, assets: [packageFront] } });
  assert.equal(boxOnly.artPath, undefined);
  assert.equal(boxOnly.artAlt, undefined);
});
