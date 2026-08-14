import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidHttpsUrl } from "../lib/url-policy.mjs";

test("accepts only absolute HTTPS URLs with a hostname", () => {
  assert.equal(isValidHttpsUrl("https://example.com/path"), true);
  assert.equal(isValidHttpsUrl("http://example.com/path"), false);
  assert.equal(isValidHttpsUrl("/relative/path"), false);
  assert.equal(isValidHttpsUrl("https://"), false);
  assert.equal(isValidHttpsUrl("https://?query"), false);
});
