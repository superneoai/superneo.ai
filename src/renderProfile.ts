export type RenderProfile = {
  compact: boolean;
  bloomEnabled: boolean;
  pixelRatio: number;
  objectScale: number;
  fov: number;
};

const PHONE_MAX_DPR = 1;
const COMPACT_MAX_DPR = 1;
const DESKTOP_MAX_DPR = 1.35;
const PHONE_PIXEL_BUDGET = 420_000;
const COMPACT_PIXEL_BUDGET = 720_000;
const DESKTOP_PIXEL_BUDGET = 2_400_000;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function createRenderProfile(
  width: number,
  height: number,
  devicePixelRatio: number,
  coarsePointer: boolean,
): RenderProfile {
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const aspect = safeWidth / safeHeight;
  const phone = safeWidth <= 480 || (coarsePointer && safeHeight <= 480);
  const compact = phone || coarsePointer || safeWidth <= 720 || aspect < 0.82;
  const pixelBudget = phone
    ? PHONE_PIXEL_BUDGET
    : compact
      ? COMPACT_PIXEL_BUDGET
      : DESKTOP_PIXEL_BUDGET;
  const maximumDpr = phone
    ? PHONE_MAX_DPR
    : compact
      ? COMPACT_MAX_DPR
      : DESKTOP_MAX_DPR;
  const budgetDpr = Math.sqrt(pixelBudget / (safeWidth * safeHeight));
  const minimumDpr = phone ? 0.72 : compact ? 0.8 : 0.55;
  const pixelRatio = clamp(
    Math.min(Math.max(devicePixelRatio, 1), maximumDpr, budgetDpr),
    minimumDpr,
    maximumDpr,
  );
  const compactScale = Math.min(safeWidth / 430, safeHeight / 780) * 0.94;

  return {
    compact,
    bloomEnabled: true,
    pixelRatio,
    objectScale: compact ? clamp(compactScale, 0.68, 0.9) : 1,
    fov: compact ? (aspect < 0.75 ? 38 : 36) : 32,
  };
}
