export function isBoxFrontAsset(asset) {
  return Boolean(asset && typeof asset === "object" && !Array.isArray(asset) && asset.role === "box-front");
}

function manifestFor(asset, manifestById) {
  return asset && manifestById && typeof manifestById.get === "function" ? manifestById.get(asset.provenanceId) : undefined;
}

export function isApprovedBoxFrontAsset(asset, manifestAsset) {
  return Boolean(
    isBoxFrontAsset(asset)
    && manifestAsset
    && asset.path === manifestAsset.path
    && asset.boxFormatId === manifestAsset.boxFormatId
    && manifestAsset.assetKind === "generated-game-box-front"
    && manifestAsset.intendedUse === "game-box-front"
    && typeof asset.alt === "string"
    && asset.alt === manifestAsset.altText,
  );
}

export function isApprovedEditorialAsset(asset, manifestAsset) {
  return Boolean(
    asset && manifestAsset && !isBoxFrontAsset(asset)
    && asset.path === manifestAsset.path
    && manifestAsset.assetKind === "generated-original-editorial"
    && manifestAsset.intendedUse === "game-card-thumbnail",
  );
}

export function selectEditorialAsset(assets, manifestById) {
  return Array.isArray(assets) ? assets.find((asset) => isApprovedEditorialAsset(asset, manifestFor(asset, manifestById))) : undefined;
}

export function selectApprovedBoxFrontAsset(assets, manifestById) {
  return Array.isArray(assets) ? assets.find((asset) => isApprovedBoxFrontAsset(asset, manifestFor(asset, manifestById))) : undefined;
}

export function selectBoxFrontAssets(assets) {
  return Array.isArray(assets) ? assets.filter(isBoxFrontAsset) : [];
}
