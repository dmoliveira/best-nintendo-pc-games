import { resolvePackageProfile, type BoxArtFormatKind, type PackageDimensions, type PlatformPackageProfile } from "./formats";

export interface GovernedPackageFront {
  src: string;
  alt: string;
  formatId: string;
}

export interface EditorialThumbnail {
  src: string;
  alt: string;
}

export interface PackageEngineInput {
  title: string;
  platformIds: readonly string[];
  platformLabel: string;
  releaseFormat?: "cartridge" | "digital";
  governedFront?: GovernedPackageFront;
  editorialThumbnail?: EditorialThumbnail;
}

export interface PackagePresentation {
  title: string;
  platformLabel: string;
  formatId: string;
  formatKind: BoxArtFormatKind;
  profile: PlatformPackageProfile;
  viewer: {
    widthPx: number;
    heightPx: number;
    depthPx: number;
    restAngle: number;
    tiltAngle: number;
    canRotate: boolean;
  };
  thumbnail: {
    frontSrc?: string;
    frontAlt?: string;
    aspectRatio: number;
    depthRatio: number;
    isPhysical: boolean;
  };
  governedFront?: GovernedPackageFront;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function viewerSize(dimensions: PackageDimensions, kind: BoxArtFormatKind) {
  const scale = Math.min(296 / dimensions.height, 282 / dimensions.width);
  const widthPx = Math.round(dimensions.width * scale);
  const heightPx = Math.round(dimensions.height * scale);
  const depthPx = kind === "physical" ? clamp(Math.round(dimensions.depth * scale), 8, 46) : 0;
  return { widthPx, heightPx, depthPx };
}

export function createPackagePresentation(input: PackageEngineInput): PackagePresentation {
  const resolution = resolvePackageProfile(input.platformIds, input.releaseFormat);
  if (resolution.status !== "resolved") throw new Error(`cannot create package presentation: ${resolution.reason}`);
  const { format, profile } = resolution;
  const governedFront = input.governedFront?.formatId === format.id ? input.governedFront : undefined;
  const dimensions = viewerSize(profile.dimensions, profile.kind);
  return {
    title: input.title,
    platformLabel: input.platformLabel,
    formatId: format.id,
    formatKind: profile.kind,
    profile,
    viewer: {
      ...dimensions,
      restAngle: profile.kind === "physical" ? -24 : 0,
      tiltAngle: profile.kind === "physical" ? -5 : 0,
      canRotate: profile.kind === "physical",
    },
    thumbnail: {
      frontSrc: input.editorialThumbnail?.src,
      frontAlt: input.editorialThumbnail?.alt,
      aspectRatio: profile.dimensions.width / profile.dimensions.height,
      depthRatio: profile.kind === "physical" ? profile.dimensions.depth / profile.dimensions.width : 0,
      isPhysical: profile.kind === "physical",
    },
    governedFront,
  };
}
