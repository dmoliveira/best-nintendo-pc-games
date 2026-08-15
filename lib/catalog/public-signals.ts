import { isEligibleCriticDisplay, isEligibleSalesValueDisplay } from "./validator";
import type { CatalogContext, GameRecord } from "./types";
import type { CatalogCriticSummary, CatalogSalesSummary } from "./search";

export interface PublicSignalSummaries {
  critic?: CatalogCriticSummary;
  sales?: CatalogSalesSummary;
}

function compactNumber(value: number): string {
  const absolute = Math.abs(value);
  let divisor = 1;
  let suffix = "";
  if (absolute >= 1_000_000_000) { divisor = 1_000_000_000; suffix = "B"; }
  else if (absolute >= 1_000_000) { divisor = 1_000_000; suffix = "M"; }
  else if (absolute >= 1_000) { divisor = 1_000; suffix = "K"; }
  let rounded = Math.round((value / divisor) * 10) / 10;
  if (suffix === "K" && Math.abs(rounded) >= 1000) { rounded = Math.round((value / 1_000_000) * 10) / 10; suffix = "M"; }
  if (suffix === "M" && Math.abs(rounded) >= 1000) { rounded = Math.round((value / 1_000_000_000) * 10) / 10; suffix = "B"; }
  return `${String(rounded).replace(/\.0$/, "")}${suffix}`;
}

export function formatRoundedUnits(value: number, unit: string): string {
  return `${compactNumber(value)} ${unit}`;
}

export function getPublicSignalSummaries(game: GameRecord, context: CatalogContext): PublicSignalSummaries {
  const criticSignal = game.signals.find((signal) => isEligibleCriticDisplay(signal, context));
  const salesSignal = game.signals.find((signal) => isEligibleSalesValueDisplay(signal, context));
  return {
    critic: criticSignal && criticSignal.kind === "critic" ? {
      label: "Critic score",
      display: `${criticSignal.score}/${criticSignal.scale}`,
      detail: `${criticSignal.editionOrPlatform} · as of ${criticSignal.capturedAt}`,
      provider: criticSignal.provider,
      url: criticSignal.sourceUrl,
    } : undefined,
    sales: salesSignal && salesSignal.kind === "sales" && salesSignal.value !== undefined && salesSignal.unit ? {
      label: "Reported sales",
      display: `About ${formatRoundedUnits(salesSignal.value, salesSignal.unit)}`,
      detail: `${salesSignal.territory} · ${salesSignal.period} · as of ${salesSignal.asOf}`,
      provider: salesSignal.provider,
      url: salesSignal.sourceUrl,
    } : undefined,
  };
}
