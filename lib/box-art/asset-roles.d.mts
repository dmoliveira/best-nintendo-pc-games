import type { GameAssetRef } from "../catalog/types";
export interface AssetManifestMetadata { path: string; assetKind?: string; intendedUse?: string; }
export function isBoxFrontAsset(asset: unknown): asset is GameAssetRef & { role: "box-front" };
export function isApprovedEditorialAsset(asset: unknown, manifestAsset: AssetManifestMetadata | undefined): asset is GameAssetRef;
export function selectEditorialAsset(assets: readonly GameAssetRef[] | unknown, manifestById: ReadonlyMap<string, AssetManifestMetadata>): GameAssetRef | undefined;
export function selectBoxFrontAssets(assets: readonly GameAssetRef[] | unknown): Array<GameAssetRef & { role: "box-front" }>;
