import assert from "node:assert/strict";
import { test } from "node:test";
import { selectApprovedBoxFrontAsset, selectEditorialAsset } from "../lib/box-art/asset-roles.mjs";

const editorialAsset = { path: "public/assets/games/sample.svg", alt: "Abstract tile", provenanceId: "editorial" };
const boxFront = { path: "public/assets/games/sample/front-pc-big-box.png", alt: "Approved package front", provenanceId: "box", role: "box-front", boxFormatId: "pc-big-box" };

test("selects only a manifest-approved generic editorial thumbnail", () => {
  const manifest = new Map([
    ["editorial", { path: editorialAsset.path, assetKind: "generated-original-editorial", intendedUse: "game-card-thumbnail" }],
    ["mark", { path: "public/mark.svg", assetKind: "original-project-vector", intendedUse: "brand-mark" }],
  ]);
  assert.equal(selectEditorialAsset([{ path: "public/mark.svg", alt: "Mark", provenanceId: "mark" }, editorialAsset], manifest), editorialAsset);
  assert.equal(selectEditorialAsset([{ path: "public/mark.svg", alt: "Mark", provenanceId: "mark" }], manifest), undefined);
});

test("selects a package front only when its governed manifest contract matches", () => {
  const manifest = new Map([
    ["box", { path: boxFront.path, altText: boxFront.alt, assetKind: "generated-game-box-front", intendedUse: "game-box-front", boxFormatId: "pc-big-box" }],
    ["editorial", { path: editorialAsset.path, altText: editorialAsset.alt, assetKind: "generated-original-editorial", intendedUse: "game-card-thumbnail" }],
  ]);
  assert.equal(selectApprovedBoxFrontAsset([editorialAsset, boxFront], manifest), boxFront);
  assert.equal(selectApprovedBoxFrontAsset([{ ...boxFront, boxFormatId: "cartridge-portrait" }], manifest), undefined);
  assert.equal(selectApprovedBoxFrontAsset([{ ...boxFront, provenanceId: "editorial" }], manifest), undefined);
});
