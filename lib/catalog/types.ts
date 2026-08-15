export type VerificationStatus = "verified" | "unverified";
export type RightsStatus = "approved" | "outbound-only" | "pending-review" | "prohibited";
export type SignalKind = "critic" | "user" | "sales" | "popularity" | "editorial";
export type EvidenceState = "link-only" | "verified-fact" | "licensed-signal" | "original-editorial" | "catalog-method";
export type ReleaseFormat = "cartridge" | "digital";
export type ReleaseScope = "earliest-title-release" | "platform-release";
export type PlatformAssociationScope = "source-listed" | "verified-release";

export interface SourcePolicy {
  id: string;
  provider: string;
  status: RightsStatus;
  allowedFields: string[];
  termsUrl?: string | null;
  licenseUrl?: string | null;
  structuredDataPolicyUrl?: string | null;
  dataAccessUrl?: string | null;
  queryServiceUrl?: string | null;
  rightsReviewedAt: string;
  recheckAt: string | null;
  decisionEvidence: string;
  coveredProcess: string;
}

export interface SourceRef {
  evidenceState: EvidenceState;
  sourceId: string;
  sourceUrl: string;
  capturedAt: string;
  verificationStatus: VerificationStatus;
  rightsStatus: RightsStatus;
  rightsReviewedAt?: string;
  recheckAt?: string | null;
  termsUrl?: string | null;
  reviewedBy?: string;
}

export interface LinkOnlyCriticOrUserSignal extends SourceRef {
  evidenceState: "link-only";
  kind: "critic" | "user";
  provider: string;
  label: string;
  editionOrPlatform?: string;
}

export interface LicensedCriticOrUserSignal extends SourceRef {
  evidenceState: "licensed-signal";
  kind: "critic" | "user";
  provider: string;
  label: string;
  score: number;
  scale: number;
  scoreType: string;
  count?: number;
  editionOrPlatform?: string;
}

export type CriticOrUserSignal = LinkOnlyCriticOrUserSignal | LicensedCriticOrUserSignal;

export interface LinkOnlySalesSignal extends SourceRef {
  evidenceState: "link-only";
  kind: "sales";
  provider: string;
  label: string;
}

export interface VerifiedFactSalesSignal extends SourceRef {
  evidenceState: "verified-fact";
  kind: "sales";
  provider: string;
  label: string;
  value?: number;
  unit?: string;
  rank?: number;
  territory: string;
  period: string;
  asOf: string;
}

export type SalesSignal = LinkOnlySalesSignal | VerifiedFactSalesSignal;

export interface LinkOnlyPopularitySignal extends SourceRef {
  evidenceState: "link-only";
  kind: "popularity";
  provider: string;
  label: string;
}

export interface LicensedPopularitySignal extends SourceRef {
  evidenceState: "licensed-signal";
  kind: "popularity";
  provider: string;
  label: string;
  value?: number;
  rank?: number;
  methodVersion: string;
  asOf: string;
}

export type PopularitySignal = LinkOnlyPopularitySignal | LicensedPopularitySignal;

export interface OriginalEditorialSignal extends SourceRef {
  kind: "editorial";
  evidenceState: "original-editorial";
  provider: "GameAtlas";
  label: string;
  rationale: string;
}

export interface CatalogMethodSignal extends SourceRef {
  kind: "editorial";
  evidenceState: "catalog-method";
  provider: "GameAtlas";
  label: string;
  rationale: string;
}

export type EditorialSignal = OriginalEditorialSignal | CatalogMethodSignal;

export type GameSignal = CriticOrUserSignal | SalesSignal | PopularitySignal | EditorialSignal;

export interface GameLink {
  label: string;
  url: string;
  kind: "official" | "store" | "critical" | "community" | "reference";
}

export interface GameAssetRef {
  path: string;
  alt: string;
  provenanceId: string;
  role?: "box-front";
  boxFormatId?: string;
}

export interface GameRelease {
  year: number;
  date?: string;
  region?: string;
  scope?: ReleaseScope;
}

export interface GameRecord {
  schemaVersion: 1;
  slug: string;
  title: string;
  aliases: string[];
  emoji: string;
  shortDescription: string;
  highlights: string[];
  release: GameRelease;
  releaseFormat?: ReleaseFormat;
  platformAssociationScope?: PlatformAssociationScope;
  platforms: string[];
  genres: string[];
  developer?: string;
  publisher?: string;
  keywords: string[];
  signals: GameSignal[];
  links: GameLink[];
  assets: GameAssetRef[];
  sources: string[];
}

export interface PlatformRecord {
  schemaVersion: 1;
  id: string;
  name: string;
  family: "nintendo" | "pc";
  generation?: string;
  emoji: string;
  aliases: string[];
  coverage: "planned" | "partial" | "populated";
  description: string;
}

export interface GenreRecord {
  schemaVersion: 1;
  id: string;
  name: string;
  aliases: string[];
  description: string;
}

export interface CatalogContext {
  platformIds: ReadonlySet<string>;
  genreIds: ReadonlySet<string>;
  sourceById: ReadonlyMap<string, SourcePolicy>;
  assetById: ReadonlyMap<string, {
    path: string;
    altText?: string;
    assetKind?: string;
    intendedUse?: string;
    boxFormatId?: string;
  }>;
  boxArtFormatIds: ReadonlySet<string>;
  approvedCriticProviders: ReadonlySet<string>;
  approvedPopularityProviders: ReadonlySet<string>;
  popularityPublicMode: "outbound-only" | "numeric-display";
  criticMinimumScore: number;
  criticRequiredScale: number;
  todayKey: string;
}

export interface ValidationIssue {
  path: string;
  message: string;
}
