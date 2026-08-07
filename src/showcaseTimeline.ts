const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export type ShowcaseTimelineState = {
  stage: number;
  fromAct: number;
  toAct: number;
  transition: number;
  actProgress: number;
};

const smoothstep = (from: number, to: number, value: number) => {
  const progress = clamp01((value - from) / Math.max(to - from, 0.0001));
  return progress * progress * (3 - 2 * progress);
};

export function toShowcaseTimeline(progress: number): ShowcaseTimelineState {
  const scaled = clamp01(progress) * 4;
  const stage = Math.min(3, Math.floor(scaled));
  const actProgress = stage === 3 ? clamp01(scaled - 3) : clamp01(scaled - stage);
  return {
    stage,
    fromAct: stage,
    toAct: Math.min(3, stage + 1),
    transition: stage === 3 ? 0 : smoothstep(0.56, 0.96, actProgress),
    actProgress,
  };
}
