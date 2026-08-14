export type VerificationStatus = "verified" | "unverified";
export type RightsStatus = "approved" | "outbound-only" | "pending-review" | "prohibited";
export type SignalKind = "critic" | "user" | "sales" | "popularity" | "editorial";

export interface SourcePolicy {
  id: string;
  provider: string;
  status: RightsStatus;
  allowedFields: string[];
  termsUrl?: string | null;
  rightsReviewedAt: string;
  recheckAt: string | null;
  decisionEvidence: string;
  coveredProcess: string;
}

export interface SourceRef {
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

export interface CriticOrUserSignal extends SourceRef {
  kind: "critic" | "user";
  provider: string;
  label: string;
  score: number;
  scale: number;
  scoreType: string;
  count?: number;
  editionOrPlatform?: string;
}

export interface SalesSignal extends SourceRef {
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

export interface PopularitySignal extends SourceRef {
  kind: "popularity";
  provider: string;
  label: string;
  value?: number;
  rank?: number;
  methodVersion: string;
  asOf: string;
}

export interface EditorialSignal extends SourceRef {
  kind: "editorial";
  provider: "GameAtlas";
  label: string;
  rationale: string;
}

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
}

export interface GameRelease {
  year: number;
  date?: string;
  region?: string;
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
  assetById: ReadonlyMap<string, { path: string }>;
  approvedCriticProviders: ReadonlySet<string>;
  criticMinimumScore: number;
  criticRequiredScale: number;
  todayKey: string;
}

export interface ValidationIssue {
  path: string;
  message: string;
}
