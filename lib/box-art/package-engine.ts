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
  platformAssociationScope?: "source-listed" | "verified-release";
  releaseFormat?: "cartridge" | "digital";
  governedFront?: GovernedPackageFront;
  editorialThumbnail?: EditorialThumbnail;
}

export interface PackagePresentation {
  title: string;
  platformLabel: string;
  formatId: string;
  formatKind: BoxArtFormatKind;
  presentationMode: "platform-package" | "source-listed-reference";
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
  editorialThumbnail?: EditorialThumbnail;
  governedFront?: GovernedPackageFront;
}

const sourceListedReferenceProfile: PlatformPackageProfile = {
  id: "source-listed-reference",
  formatId: "catalog-reference",
  kind: "digital",
  category: "source-listed catalog reference",
  material: "digital",
  openingSide: "none",
  dimensions: { width: 720, height: 960, depth: 0 },
  sourceId: "gameatlas-editorial",
  basis: "representative-estimate",
  confidence: "high",
  scope: "Neutral GameAtlas reference presentation for a source-listed platform association.",
  caveat: "Does not represent platform-specific packaging, distribution, or a verified platform release.",
};

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
  if (input.platformAssociationScope === "source-listed") {
    const dimensions = viewerSize(sourceListedReferenceProfile.dimensions, "digital");
    return {
      title: input.title,
      platformLabel: input.platformLabel,
      formatId: sourceListedReferenceProfile.formatId,
      formatKind: "digital",
      presentationMode: "source-listed-reference",
      profile: sourceListedReferenceProfile,
      viewer: {
        ...dimensions,
        restAngle: 0,
        tiltAngle: 0,
        canRotate: false,
      },
      thumbnail: {
        frontSrc: input.editorialThumbnail?.src,
        frontAlt: input.editorialThumbnail?.alt,
        aspectRatio: sourceListedReferenceProfile.dimensions.width / sourceListedReferenceProfile.dimensions.height,
        depthRatio: 0,
        isPhysical: false,
      },
      editorialThumbnail: input.editorialThumbnail,
      governedFront: undefined,
    };
  }
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
    presentationMode: "platform-package",
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
    editorialThumbnail: input.editorialThumbnail,
    governedFront,
  };
}
