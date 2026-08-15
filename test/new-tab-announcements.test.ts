import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RightsAndSupportPolicyPage from "../app/docs/rights-and-support-policy/page";
import SiteFooter from "../app/site-footer";

const gamePage = readFileSync(new URL("../app/games/[slug]/page.tsx", import.meta.url), "utf8");

test("external destinations announce new tabs consistently", () => {
  const footerMarkup = renderToStaticMarkup(createElement(SiteFooter));
  const policyMarkup = renderToStaticMarkup(createElement(RightsAndSupportPolicyPage));

  assert.match(footerMarkup, /aria-label="Report a correction; opens in a new tab"/);
  assert.match(footerMarkup, /Report a correction <span aria-hidden="true">↗<\/span>/);
  assert.match(policyMarkup, /aria-label="Open the catalog correction form; opens in a new tab"/);
  assert.equal((footerMarkup.match(/aria-label="Report a correction; opens in a new tab"/g) ?? []).length, 1);
  assert.equal((policyMarkup.match(/aria-label="Open the catalog correction form; opens in a new tab"/g) ?? []).length, 1);
  assert.equal((gamePage.match(/target="_blank"/g) ?? []).length, 4);
  assert.equal((gamePage.match(/opens in a new tab/g) ?? []).length, 4);
  assert.match(gamePage, /source \${publicSignals\.critic\.provider}; opens in a new tab/);
  assert.match(gamePage, /source \${publicSignals\.sales\.provider}; opens in a new tab/);
  assert.match(gamePage, /critic score context for \${game\.title}; opens in a new tab/);
  assert.match(gamePage, /<span>\{criticalLink\.label\.replace\([^)]*\)\} <span aria-hidden="true">↗<\/span><\/span>/);
  assert.match(gamePage, /aria-label=\{`\$\{link\.label\}; opens in a new tab`\}/);
});
