import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { deflateSync } from "node:zlib";

const repoRoot = process.cwd();
const rightsValidator = path.join(repoRoot, "scripts/validate-rights.mjs");

function runRightsValidator(mutator) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gameatlas-rights-"));
  try {
    fs.mkdirSync(path.join(fixtureRoot, "data"), { recursive: true });
    fs.mkdirSync(path.join(fixtureRoot, "data", "curation"), { recursive: true });
    fs.cpSync(path.join(repoRoot, "public"), path.join(fixtureRoot, "public"), { recursive: true });
    for (const file of ["source-rights.json", "evidence-policy.json", "asset-rights.json", "assets-manifest.json", "box-art-formats.json", "platform-chronology.json", "platforms.json"]) {
      fs.copyFileSync(path.join(repoRoot, "data", file), path.join(fixtureRoot, "data", file));
    }
    fs.copyFileSync(path.join(repoRoot, "data", "curation", "2026-08-15-wikidata-catalog-1000.json"), path.join(fixtureRoot, "data", "curation", "2026-08-15-wikidata-catalog-1000.json"));
    const manifestPath = path.join(fixtureRoot, "data", "assets-manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    mutator(manifest, fixtureRoot);
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


function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function png(width, height) {
  const chunk = (type, content) => {
    const output = Buffer.alloc(12 + content.length);
    output.writeUInt32BE(content.length, 0);
    output.write(type, 4, "ascii");
    content.copy(output, 8);
    output.writeUInt32BE(crc32(output.subarray(4, 8 + content.length)), 8 + content.length);
    return output;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.alloc((width * 4 + 1) * height))), chunk("IEND", Buffer.alloc(0))]);
}

function appendBoxFront(manifest, fixtureRoot, approvalNote) {
  const relativePath = "public/assets/games/sample-game/front-cartridge-portrait.png";
  const imagePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(imagePath), { recursive: true });
  fs.writeFileSync(imagePath, png(1024, 1536));
  const checksum = `sha256:${crypto.createHash("sha256").update(fs.readFileSync(imagePath)).digest("hex")}`;
  manifest.assets.push({
    assetId: "game-sample-game-box-front-cartridge-portrait",
    path: relativePath,
    assetKind: "generated-game-box-front",
    creatorOrSource: "fixture",
    licenseOrPermissionUrl: "https://openai.com/policies/terms-of-use/",
    providerTermsEffectiveDate: "2026-01-01",
    attribution: "AI-generated with OpenAI Codex Image for GameAtlas",
    aiGeneratedDisclosure: "AI-generated with OpenAI Codex Image; reviewed before publication.",
    generatedOrAcquiredAt: "2026-08-15",
    intendedUse: "game-box-front",
    altText: "AI-generated GameAtlas editorial front artwork for Sample Game.",
    reviewedBy: "fixture reviewer",
    rightsReviewedAt: "2026-08-15",
    recheckAt: null,
    promptOrGenerationBrief: "original abstract fixture",
    modelOrTool: "fixture tool",
    outputOrAssetId: checksum,
    contentChecksum: checksum,
    boxFormatId: "cartridge-portrait",
    pixelWidth: 1024,
    pixelHeight: 1536,
    approvalNote,
  });
}

test("requires an affirmative attestation for a generated game-box front", () => {
  const output = runRightsValidator((manifest, fixtureRoot) => {
    appendBoxFront(manifest, fixtureRoot, "Reviewed visually.");
  });
  assert.match(output, /approvalNote must attest/);
});

test("rejects a checksum mismatch for a generated game-box front", () => {
  const output = runRightsValidator((manifest, fixtureRoot) => {
    appendBoxFront(manifest, fixtureRoot, "I reviewed this exact asset and confirm it contains no recreated official box art, no logos, no characters, and no screenshots.");
    manifest.assets.at(-1).contentChecksum = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
  });
  assert.match(output, /contentChecksum does not match file bytes/);
});


test("rejects a negated or embellished box-front attestation", () => {
  const output = runRightsValidator((manifest, fixtureRoot) => {
    appendBoxFront(manifest, fixtureRoot, "Not reviewed, but no recreated official box art, no logos, no characters, and no screenshots. Extra text.");
  });
  assert.match(output, /approvalNote must attest/);
});

test("requires a dated provider terms record and AI disclosure for a generated game-box front", () => {
  const output = runRightsValidator((manifest, fixtureRoot) => {
    appendBoxFront(manifest, fixtureRoot, "I reviewed this exact asset and confirm it contains no recreated official box art, no logos, no characters, and no screenshots.");
    manifest.assets.at(-1).providerTermsEffectiveDate = "not-a-date";
    manifest.assets.at(-1).aiGeneratedDisclosure = "Reviewed editorial artwork.";
  });
  assert.match(output, /providerTermsEffectiveDate: must be a valid YYYY-MM-DD date/);
  assert.match(output, /aiGeneratedDisclosure must identify AI generation/);
});

test("rejects credential-like data from a public manifest field", () => {
  const output = runRightsValidator((manifest) => {
    manifest.assets[0].attribution = "api_key=abcdefghijklmnopqrstuvwxyz123456";
  });
  assert.match(output, /credential-like value found in public content/);
});
