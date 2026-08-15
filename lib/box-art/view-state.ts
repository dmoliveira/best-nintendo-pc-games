export const BOX_VIEW_ANGLES = [0, 90, 180, 270] as const;
export const BOX_VIEW_ZOOMS = [1, 1.15, 1.3, 1.45] as const;
export type BoxViewAngle = (typeof BOX_VIEW_ANGLES)[number];

export interface BoxViewState {
  angle: BoxViewAngle;
  zoom: (typeof BOX_VIEW_ZOOMS)[number];
}

export type BoxViewAction = "rotate-left" | "rotate-right" | "zoom-in" | "zoom-out" | "reset";

export const INITIAL_BOX_VIEW_STATE: BoxViewState = { angle: 0, zoom: 1 };

export function normalizeBoxAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

export function snapBoxAngle(angle: number): BoxViewAngle {
  const normalized = normalizeBoxAngle(angle);
  return BOX_VIEW_ANGLES[Math.floor((normalized + 45) / 90) % BOX_VIEW_ANGLES.length];
}

/** Returns a target angle's equivalent nearest to an unwrapped visual angle. */
export function nearestEquivalentBoxAngle(referenceAngle: number, targetAngle: number): number {
  return targetAngle + 360 * Math.round((referenceAngle - targetAngle) / 360);
}

/** Keeps the front's dimensional rest pose while aligning cardinal side and back views with their actual faces. */
export function renderBoxAngle(angle: number, restAngle: number): number {
  const normalized = normalizeBoxAngle(angle);
  const turns = Math.floor(angle / 360);
  const projected = normalized <= 90
    ? normalized + restAngle * (1 - normalized / 90) ** 2
    : normalized >= 270
      ? normalized + restAngle * ((normalized - 270) / 90) ** 2
      : normalized;
  return projected + 360 * turns;
}

function moveIn<T>(values: readonly T[], value: T, direction: -1 | 1): T {
  const index = Math.max(0, values.indexOf(value));
  return values[(index + direction + values.length) % values.length];
}

export function reduceBoxView(state: BoxViewState, action: BoxViewAction): BoxViewState {
  if (action === "rotate-left") return { ...state, angle: moveIn(BOX_VIEW_ANGLES, state.angle, -1) };
  if (action === "rotate-right") return { ...state, angle: moveIn(BOX_VIEW_ANGLES, state.angle, 1) };
  if (action === "zoom-in") return { ...state, zoom: BOX_VIEW_ZOOMS[Math.min(BOX_VIEW_ZOOMS.length - 1, BOX_VIEW_ZOOMS.indexOf(state.zoom) + 1)] };
  if (action === "zoom-out") return { ...state, zoom: BOX_VIEW_ZOOMS[Math.max(0, BOX_VIEW_ZOOMS.indexOf(state.zoom) - 1)] };
  return INITIAL_BOX_VIEW_STATE;
}

export function describeBoxFace(angle: BoxViewAngle): string {
  if (angle === 90) return "Left spine";
  if (angle === 180) return "Back";
  if (angle === 270) return "Right spine";
  return "Front";
}

export function describeBoxView(state: BoxViewState): string {
  return `${describeBoxFace(state.angle)} view, ${Math.round(state.zoom * 100)}% zoom.`;
}
