import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AttributeGlyph, { ATTRIBUTE_GLYPH_KINDS } from "../app/attribute-glyph";
import { getPlatformAccentKind, getPlatformDisplayLabel, getPlatformIconKind } from "../lib/catalog/display";
import { getCatalogPlatforms } from "../lib/catalog/site-data";

const platformGlyph = readFileSync(new URL("../app/platform-glyph.tsx", import.meta.url), "utf8");
const attributeGlyph = readFileSync(new URL("../app/attribute-glyph.tsx", import.meta.url), "utf8");
const cards = readFileSync(new URL("../app/catalog-cards.tsx", import.meta.url), "utf8");
const gamePage = readFileSync(new URL("../app/games/[slug]/page.tsx", import.meta.url), "utf8");

test("catalog glyphs stay decorative, original, and text-backed", () => {
  for (const component of [platformGlyph, attributeGlyph]) {
    assert.match(component, /aria-hidden="true" focusable="false"/);
    assert.doesNotMatch(component, /logo|trademark|Nintendo|Switch|Game Boy|Wii|GameCube/i);
  }
  assert.match(platformGlyph, /data-platform-accent/);
  assert.match(attributeGlyph, /data-attribute-glyph/);
  assert.match(cards, /label: "Dev"/);
  assert.match(cards, /label: "Pub"/);
  assert.match(cards, /<AttributeGlyph kind="genre"/);
  assert.match(cards, /game-card-title-link/);
  assert.match(cards, /data-platform-overflow/);
  assert.match(cards, /data-genre-overflow/);
  assert.match(cards, /\+\{hiddenPlatformCount\}<\/span> platforms/);
  assert.match(gamePage, /<AttributeGlyph kind="year" \/>/);
  assert.match(gamePage, /<span className="detail-label">/);
});

test("every authored metadata glyph renders as a decorative SVG", () => {
  assert.deepEqual(ATTRIBUTE_GLYPH_KINDS, ["studio", "publisher", "genre", "year", "digital", "physical"]);
  for (const kind of ATTRIBUTE_GLYPH_KINDS) {
    const markup = renderToStaticMarkup(createElement(AttributeGlyph, { kind }));
    assert.match(markup, new RegExp(`data-attribute-glyph="${kind}"`));
    assert.match(markup, /aria-hidden="true"/);
    assert.match(markup, /focusable="false"/);
  }
});

test("every catalog platform resolves to a display label and supported generic glyph mapping", () => {
  const platforms = getCatalogPlatforms();
  const iconKinds = new Set(["console", "handheld", "hybrid", "pc"]);
  const accentKinds = new Set(["signal", "orbit", "prism", "wave", "frame", "bridge", "spark", "grid"]);
  assert.equal(platforms.length, 16);
  for (const platform of platforms) {
    assert.ok(getPlatformDisplayLabel(platform).trim(), `${platform.id} needs a display label`);
    assert.ok(iconKinds.has(getPlatformIconKind(platform.id)), `${platform.id} needs a generic device glyph`);
    assert.ok(accentKinds.has(getPlatformAccentKind(platform.id)), `${platform.id} needs an abstract accent`);
  }
  assert.deepEqual(new Set(platforms.map((platform) => getPlatformIconKind(platform.id))), iconKinds);
});
