import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const gamePage = readFileSync(new URL("../app/games/[slug]/page.tsx", import.meta.url), "utf8");
const browser = readFileSync(new URL("../app/catalog-browser.tsx", import.meta.url), "utf8");
const boxViewer = readFileSync(new URL("../app/game-box-viewer.tsx", import.meta.url), "utf8");

test("home shell exposes a keyboard bypass and stable main landmark", () => {
  assert.match(page, /className="skip-link" href="#main-content"/);
  assert.match(page, /<main id="main-content">/);
  assert.match(page, /<SiteHeader active="browse" \/>/);
  assert.match(page, /<SiteFooter \/>/);
});

test("home shell exposes accessible catalog search and filters", () => {
  assert.match(page, /CatalogBrowser/);
  assert.match(page, /getCatalogSearchRecords/);
  assert.doesNotMatch(page, /Catalog search is coming soon/);
  assert.doesNotMatch(page, /Catalog coming soon/);
  assert.doesNotMatch(page, /80\+/);
  assert.match(browser, /syncUrl\(state, "replace"\)/);
  assert.match(browser, /addEventListener\("popstate"/);
});

test("visual shell protects focus, contrast, and reduced-motion behavior", () => {
  assert.match(styles, /--faint:\s*#718194/);
  assert.match(styles, /\.skip-link\s*\{/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /wordmark-orbit/);
  assert.match(styles, /@keyframes wordmark-orbit-spin/);
  assert.match(styles, /overflow-x:\s*clip/);
  assert.match(styles, /game-box\{transition:none/);
  assert.match(styles, /game-card-credits>span/);
  assert.doesNotMatch(styles, /\.platform-card:hover\s*\{[^}]*transform/);
});

test("game detail pages expose static params, a skip link, and explicit editorial evidence", () => {
  assert.match(gamePage, /dynamicParams = false/);
  assert.match(gamePage, /generateStaticParams/);
  assert.match(gamePage, /className="skip-link" href="#main-content"/);
  assert.match(gamePage, /Original editorial/);
  assert.match(gamePage, /PlatformGlyph/);
  assert.match(gamePage, /game-status-row/);
  assert.match(gamePage, /getPlatformDisplayLabel/);
  assert.match(browser, /platformDisplayLabels/);
  assert.match(gamePage, /Official &amp; external resources/);
  assert.match(gamePage, /DSiWare · Digital/);
});

test("game pages expose an honest, keyboard-operable package-view fallback", () => {
  assert.match(gamePage, /GameBoxViewer/);
  assert.match(gamePage, /site\.assetPath\(boxAsset\.path\.replace/);
  assert.match(boxViewer, /GameAtlas reference case/);
  assert.match(boxViewer, /data-game-box-stage/);
  assert.match(boxViewer, /aria-live="polite"/);
  assert.match(boxViewer, /requestFullscreen/);
  assert.match(styles, /game-box-viewer--fallback-fullscreen/);
  assert.match(styles, /forced-colors:active/);
});
