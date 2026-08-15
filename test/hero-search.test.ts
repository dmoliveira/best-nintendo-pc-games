import assert from "node:assert/strict";
import { test } from "node:test";
import { getHeroSearchScrollBehavior } from "../app/hero-search";

test("hero search uses instant scrolling when reduced motion is requested", () => {
  assert.equal(getHeroSearchScrollBehavior(true), "auto");
  assert.equal(getHeroSearchScrollBehavior(false), "smooth");
});
