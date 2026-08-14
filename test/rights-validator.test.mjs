import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const repoRoot = process.cwd();
const rightsValidator = path.join(repoRoot, "scripts/validate-rights.mjs");

function runRightsValidator(mutator) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gameatlas-rights-"));
  try {
    fs.mkdirSync(path.join(fixtureRoot, "data"), { recursive: true });
    fs.cpSync(path.join(repoRoot, "public"), path.join(fixtureRoot, "public"), { recursive: true });
    for (const file of ["source-rights.json", "evidence-policy.json", "asset-rights.json", "assets-manifest.json"]) {
      fs.copyFileSync(path.join(repoRoot, "data", file), path.join(fixtureRoot, "data", file));
    }
    const manifestPath = path.join(fixtureRoot, "data", "assets-manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    mutator(manifest);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    try {
      execFileSync(process.execPath, [rightsValidator], { cwd: fixtureRoot, encoding: "utf8", stdio: "pipe" });
      return "";
    } catch (error) {
      return `${error.stdout ?? ""}${error.stderr ?? ""}`;
    }
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

test("rejects whitespace-only nullable-license provenance", () => {
  const output = runRightsValidator((manifest) => {
    const asset = manifest.assets[0];
    asset.assetKind = "generated-original-editorial";
    asset.intendedUse = "og-image";
    asset.promptOrGenerationBrief = "fixture generation brief";
    asset.modelOrTool = "fixture tool";
    asset.outputOrAssetId = "fixture output";
    asset.notApplicableReason = "   ";
  });
  assert.match(output, /null license URL needs notApplicableReason/);
});

test("rejects non-HTTPS license URLs", () => {
  const output = runRightsValidator((manifest) => {
    const asset = manifest.assets[0];
    asset.assetKind = "public-domain-or-compatible-license";
    asset.intendedUse = "only-the-recorded-purpose";
    asset.licenseOrPermissionUrl = "http://example.com/license";
    asset.licenseName = "Fixture license";
    asset.recheckAt = "2099-01-01";
  });
  assert.match(output, /licenseOrPermissionUrl must be a valid https URL/);
});
