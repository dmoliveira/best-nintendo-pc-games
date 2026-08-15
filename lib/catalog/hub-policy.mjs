export const DEFAULT_MINIMUM_HUB_RECORDS = 2;

export function normalizeMinimumHubRecords(value) {
  return Number.isInteger(value) && value >= 1 ? value : DEFAULT_MINIMUM_HUB_RECORDS;
}

export function isPlatformHubEligible(platform, recordCount, minimumHubRecords) {
  return platform?.coverage === "populated" && recordCount >= minimumHubRecords;
}

export function isGenreHubEligible(recordCount, minimumHubRecords) {
  return recordCount >= minimumHubRecords;
}
