export const BOX_VIEW_ANGLES = [0, 90, 180, 270] as const;
export const BOX_VIEW_ZOOMS = [1, 1.15, 1.3, 1.45] as const;

export interface BoxViewState {
  angle: (typeof BOX_VIEW_ANGLES)[number];
  zoom: (typeof BOX_VIEW_ZOOMS)[number];
}

export type BoxViewAction = "rotate-left" | "rotate-right" | "zoom-in" | "zoom-out" | "reset";

export const INITIAL_BOX_VIEW_STATE: BoxViewState = { angle: 0, zoom: 1 };

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

export function describeBoxView(state: BoxViewState): string {
  const face = state.angle === 0 ? "Front" : state.angle === 180 ? "Back" : "Spine";
  return `${face} view, ${Math.round(state.zoom * 100)}% zoom.`;
}
