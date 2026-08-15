import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

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
  assert.match(gamePage, /<AttributeGlyph kind="year" \/>/);
  assert.match(gamePage, /<span className="detail-label">/);
});
