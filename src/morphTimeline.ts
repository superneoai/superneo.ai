const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const STAGE_COUNT = 3;
export const LAST_STAGE = STAGE_COUNT - 1;

export function toMorphPhase(progress: number) {
  return Math.min(clamp01(progress) * STAGE_COUNT, LAST_STAGE);
}

export function toStageIndex(progress: number) {
  return Math.floor(toMorphPhase(progress));
}

export function toStageProgress(progress: number, stage: number) {
  return clamp01(clamp01(progress) * STAGE_COUNT - stage);
}
