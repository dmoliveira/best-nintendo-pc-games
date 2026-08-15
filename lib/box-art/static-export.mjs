import fs from "node:fs";
import path from "node:path";
import { isBoxFrontAsset, selectBoxFrontAssets, selectEditorialAsset } from "./asset-roles.mjs";

export function publicAssetUrl(manifestPath, expectedBasePath) {
  const localPath = manifestPath.replace(/^public\//, "");
  return `${expectedBasePath}/${localPath}`.replace(/^\/\//, "/");
}

export function validateGameArtExport({ game, gameHtml, outDir, assetById, expectedBasePath }) {
  const failures = [];
  const sceneAsset = selectEditorialAsset(game.assets, assetById);
  const genericAssets = Array.isArray(game.assets) ? game.assets.filter((asset) => !isBoxFrontAsset(asset)) : [];
  if (genericAssets.length > 0 && !sceneAsset) failures.push("contains a non-box asset that is not an approved editorial game-card thumbnail");
  if (sceneAsset && !gameHtml.includes("game-box-stage__editorial-art")) failures.push("does not render its approved editorial scene art");
  const boxAssets = selectBoxFrontAssets(game.assets);
  for (const asset of boxAssets) {
    const manifestAsset = assetById.get(asset.provenanceId);
    if (!manifestAsset || manifestAsset.path !== asset.path) {
      failures.push("box-front provenance does not resolve to the manifest");
      continue;
    }
    const expectedUrl = publicAssetUrl(manifestAsset.path, expectedBasePath);
    const outputAsset = path.join(outDir, manifestAsset.path.replace(/^public\//, ""));
    if (!gameHtml.includes(expectedUrl)) failures.push(`does not contain the base-prefixed box-front asset URL ${expectedUrl}`);
    if (!fs.existsSync(outputAsset) || !fs.lstatSync(outputAsset).isFile() || fs.lstatSync(outputAsset).isSymbolicLink()) failures.push(`does not export a regular box-front asset at ${manifestAsset.path}`);
  }
  if (expectedBasePath && /(?:src|href)=["']\/assets\//.test(gameHtml)) failures.push("emits a root-relative /assets URL that bypasses the Pages base path");
  return failures;
}
