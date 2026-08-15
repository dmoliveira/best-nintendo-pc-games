export declare const DEFAULT_MINIMUM_HUB_RECORDS: number;
export function normalizeMinimumHubRecords(value: unknown): number;
export function isPlatformHubEligible(platform: { coverage?: string }, recordCount: number, minimumHubRecords: number): boolean;
export function isGenreHubEligible(recordCount: number, minimumHubRecords: number): boolean;
