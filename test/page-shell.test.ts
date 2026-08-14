import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("home shell exposes a keyboard bypass and stable main landmark", () => {
  assert.match(page, /className="skip-link" href="#main-content"/);
  assert.match(page, /<main id="main-content">/);
  assert.match(page, /<header className="topbar">[\s\S]*<\/header>/);
  assert.match(page, /<footer className="footer">/);
});

test("home shell does not present unavailable search controls as interactive", () => {
  assert.doesNotMatch(page, /role="search"/);
  assert.doesNotMatch(page, /disabled/);
  assert.doesNotMatch(page, /<input/);
  assert.match(page, /Catalog search is coming soon/);
  assert.match(page, /Catalog coming soon/);
});

test("visual shell protects focus, contrast, and reduced-motion behavior", () => {
  assert.match(styles, /--faint:#718194/);
  assert.match(styles, /\.skip-link\{/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(styles, /overflow-x:clip/);
  assert.doesNotMatch(styles, /\.platform-card:hover\{[^}]*transform/);
});
