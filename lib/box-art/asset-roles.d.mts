import type { GameAssetRef } from "../catalog/types";

export interface AssetManifestMetadata {
  path: string;
  altText?: string;
  assetKind?: string;
  intendedUse?: string;
  boxFormatId?: string;
}

export function isBoxFrontAsset(asset: unknown): asset is GameAssetRef & { role: "box-front" };
export function isApprovedBoxFrontAsset(asset: unknown, manifestAsset: AssetManifestMetadata | undefined): asset is GameAssetRef & { role: "box-front" };
export function isApprovedEditorialAsset(asset: unknown, manifestAsset: AssetManifestMetadata | undefined): asset is GameAssetRef;
export function selectEditorialAsset(assets: readonly GameAssetRef[] | unknown, manifestById: ReadonlyMap<string, AssetManifestMetadata>): GameAssetRef | undefined;
export function selectApprovedBoxFrontAsset(assets: readonly GameAssetRef[] | unknown, manifestById: ReadonlyMap<string, AssetManifestMetadata>): (GameAssetRef & { role: "box-front" }) | undefined;
export function selectBoxFrontAssets(assets: readonly GameAssetRef[] | unknown): Array<GameAssetRef & { role: "box-front" }>;
