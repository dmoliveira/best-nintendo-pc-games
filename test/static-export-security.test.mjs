import assert from "node:assert/strict";
import { test } from "node:test";
import { publicArtifactCredentialIssue } from "../lib/static-export-security.mjs";

test("rejects credential-like data in the catalog search index static artifact", () => {
  const searchIndex = JSON.stringify({ schemaVersion: 1, records: [{ developer: "sk-aaaaaaaaaaaaaaaaaaaa" }] });
  assert.equal(publicArtifactCredentialIssue("catalog-search-index.json", searchIndex), "credential-like value found in catalog-search-index.json");
  assert.equal(publicArtifactCredentialIssue("catalog-search-index.json", JSON.stringify({ schemaVersion: 1, records: [] })), undefined);
});
