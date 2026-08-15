export function isBoxFrontAsset(asset) {
  return Boolean(asset && typeof asset === "object" && !Array.isArray(asset) && asset.role === "box-front");
}

export function isApprovedEditorialAsset(asset, manifestAsset) {
  return Boolean(
    asset && manifestAsset && !isBoxFrontAsset(asset)
    && asset.path === manifestAsset.path
    && manifestAsset.assetKind === "generated-original-editorial"
    && manifestAsset.intendedUse === "game-card-thumbnail",
  );
}

function manifestFor(asset, manifestById) {
  return asset && manifestById && typeof manifestById.get === "function" ? manifestById.get(asset.provenanceId) : undefined;
}

export function selectEditorialAsset(assets, manifestById) {
  return Array.isArray(assets) ? assets.find((asset) => isApprovedEditorialAsset(asset, manifestFor(asset, manifestById))) : undefined;
}

export function selectBoxFrontAssets(assets) {
  return Array.isArray(assets) ? assets.filter(isBoxFrontAsset) : [];
}
