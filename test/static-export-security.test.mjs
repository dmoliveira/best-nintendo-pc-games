import assert from "node:assert/strict";
import { test } from "node:test";
import { publicArtifactCredentialIssue } from "../lib/static-export-security.mjs";

test("rejects credential-like data in the catalog search index static artifact", () => {
  const token = "a".repeat(24);
  const issue = "credential-like value found in catalog-search-index.json";
  const prefixedSecret = ["sk", token].join("-");
  assert.equal(publicArtifactCredentialIssue("catalog-search-index.json", JSON.stringify({ schemaVersion: 1, records: [{ developer: prefixedSecret }] })), issue);
  assert.equal(publicArtifactCredentialIssue("catalog-search-index.json", JSON.stringify({ apiKey: token })), issue);
  assert.equal(publicArtifactCredentialIssue("catalog-search-index.json", JSON.stringify({ authorization: `Bearer ${token}` })), issue);
  assert.equal(publicArtifactCredentialIssue("catalog-search-index.json", JSON.stringify({ schemaVersion: 1, records: [] })), undefined);
});
