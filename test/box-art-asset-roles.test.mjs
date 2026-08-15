import assert from "node:assert/strict";
import { test } from "node:test";
import { selectEditorialAsset } from "../lib/box-art/asset-roles.mjs";

const editorialAsset = { path: "public/assets/games/sample.svg", alt: "Abstract tile", provenanceId: "editorial" };

test("selects only a manifest-approved generic editorial thumbnail", () => {
  const manifest = new Map([
    ["editorial", { path: editorialAsset.path, assetKind: "generated-original-editorial", intendedUse: "game-card-thumbnail" }],
    ["mark", { path: "public/mark.svg", assetKind: "original-project-vector", intendedUse: "brand-mark" }],
  ]);
  assert.equal(selectEditorialAsset([{ path: "public/mark.svg", alt: "Mark", provenanceId: "mark" }, editorialAsset], manifest), editorialAsset);
  assert.equal(selectEditorialAsset([{ path: "public/mark.svg", alt: "Mark", provenanceId: "mark" }], manifest), undefined);
});
