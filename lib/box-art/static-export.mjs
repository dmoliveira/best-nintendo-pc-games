import fs from "node:fs";
import path from "node:path";
import { isApprovedBoxFrontAsset, isBoxFrontAsset, selectBoxFrontAssets, selectEditorialAsset } from "./asset-roles.mjs";

export function publicAssetUrl(manifestPath, expectedBasePath) {
  const localPath = manifestPath.replace(/^public\//, "");
  return `${expectedBasePath}/${localPath}`.replace(/^\/\//, "/");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function htmlTags(gameHtml, tagName) {
  return gameHtml.match(new RegExp(`<${tagName}\\b[^>]*>`, "gi")) ?? [];
}

function tagForSource(gameHtml, source) {
  const sourcePattern = new RegExp(`\\bsrc=(['"])${escapeRegExp(source)}\\1`, "i");
  return htmlTags(gameHtml, "img").find((tag) => sourcePattern.test(tag));
}

function hasAttribute(tag, name, value) {
  return new RegExp(`\\b${name}=(['"])${escapeRegExp(value)}\\1`, "i").test(tag);
}

function imagePreloaded(gameHtml, source) {
  const sourcePattern = new RegExp(`\\bhref=(['"])${escapeRegExp(source)}\\1`, "i");
  return htmlTags(gameHtml, "link").some((tag) => /\brel=(['"])preload\1/i.test(tag) && /\bas=(['"])image\1/i.test(tag) && sourcePattern.test(tag));
}

function hasHighPriorityImage(gameHtml) {
  return htmlTags(gameHtml, "img").some((tag) => hasAttribute(tag, "fetchpriority", "high"));
}

export function validateGameArtExport({ game, gameHtml, outDir, assetById, expectedBasePath }) {
  const failures = [];
  const sceneAsset = selectEditorialAsset(game.assets, assetById);
  const genericAssets = Array.isArray(game.assets) ? game.assets.filter((asset) => !isBoxFrontAsset(asset)) : [];
  if (genericAssets.length > 0 && !sceneAsset) failures.push("contains a non-box asset that is not an approved editorial game-card thumbnail");
  if (sceneAsset) {
    const manifestAsset = assetById.get(sceneAsset.provenanceId);
    const expectedUrl = manifestAsset ? publicAssetUrl(manifestAsset.path, expectedBasePath) : undefined;
    const sceneTag = expectedUrl ? tagForSource(gameHtml, expectedUrl) : undefined;
    if (!manifestAsset || manifestAsset.path !== sceneAsset.path) failures.push("editorial scene-art provenance does not resolve to the manifest");
    else if (!sceneTag) failures.push(`does not contain the base-prefixed editorial scene-art URL ${expectedUrl}`);
    if (!gameHtml.includes("game-box-stage__editorial-art") && !gameHtml.includes("game-reference-art__media")) failures.push("does not render its approved editorial scene art");
    else if (gameHtml.includes("game-box-stage__editorial-art") && sceneTag && (!hasAttribute(sceneTag, "loading", "lazy") || !hasAttribute(sceneTag, "decoding", "async") || !hasAttribute(sceneTag, "fetchpriority", "low"))) failures.push("does not defer its approved editorial scene art");
    if (expectedUrl && imagePreloaded(gameHtml, expectedUrl)) failures.push("preloads approved editorial scene art instead of deferring it");
  }
  const boxAssets = selectBoxFrontAssets(game.assets);
  for (const asset of boxAssets) {
    const manifestAsset = assetById.get(asset.provenanceId);
    if (!manifestAsset || manifestAsset.path !== asset.path) {
      failures.push("box-front provenance does not resolve to the manifest");
      continue;
    }
    if (!isApprovedBoxFrontAsset(asset, manifestAsset)) {
      failures.push("box-front is not an approved generated game-box-front manifest asset");
      continue;
    }
    const expectedUrl = publicAssetUrl(manifestAsset.path, expectedBasePath);
    const outputAsset = path.join(outDir, manifestAsset.path.replace(/^public\//, ""));
    const frontTag = tagForSource(gameHtml, expectedUrl);
    if (!frontTag) failures.push(`does not contain the base-prefixed box-front asset URL ${expectedUrl}`);
    else if (!hasAttribute(frontTag, "loading", "eager") || !hasAttribute(frontTag, "decoding", "async") || !hasAttribute(frontTag, "fetchpriority", "high")) failures.push("does not prioritize its approved generated game-box front");
    if (!fs.existsSync(outputAsset) || !fs.lstatSync(outputAsset).isFile() || fs.lstatSync(outputAsset).isSymbolicLink()) failures.push(`does not export a regular box-front asset at ${manifestAsset.path}`);
  }
  if (boxAssets.length === 0 && hasHighPriorityImage(gameHtml)) failures.push("prioritizes an image without an approved generated game-box front");
  if (expectedBasePath && /(?:src|href)=["']\/assets\//.test(gameHtml)) failures.push("emits a root-relative /assets URL that bypasses the Pages base path");
  return failures;
}
