export const SHOWCASE_IMPULSE_EVENT = "superneo:showcase-impulse";
export const SHOWCASE_STATE_EVENT = "superneo:showcase-state";
export const SHOWCASE_SIGNAL_PROGRESS_PER_SECOND = 0.92;

export type ShowcaseImpulseKind = "drive" | "clash" | "terrain" | "orbit";

export type ShowcaseImpulseDetail = {
  kind: ShowcaseImpulseKind;
  intensity: number;
  pan: number;
};

export type ShowcaseDiagnostic = { label: string; value: string };

export type ShowcaseStateDetail = {
  act: number;
  primary: ShowcaseDiagnostic;
  secondary: ShowcaseDiagnostic;
};

const kinds: readonly ShowcaseImpulseKind[] = ["drive", "clash", "terrain", "orbit"];

export function dispatchShowcaseImpulse(act: number, intensity: number, pan: number) {
  window.dispatchEvent(new CustomEvent<ShowcaseImpulseDetail>(SHOWCASE_IMPULSE_EVENT, {
    detail: {
      kind: kinds[Math.min(3, Math.max(0, Math.round(act)))],
      intensity: Math.min(1, Math.max(0.2, intensity)),
      pan: Math.min(0.8, Math.max(-0.8, pan)),
    },
  }));
}

export function dispatchShowcaseState(
  act: number,
  progress: number,
  time: number,
  cellCount: number,
) {
  const phase = Math.sin(time * 1.7) * 0.5 + 0.5;
  const details: ShowcaseStateDetail[] = [
    {
      act: 0,
      primary: { label: "SPD", value: `${Math.round(286 + phase * 34)} KM/H` },
      secondary: { label: "SUSP", value: `${Math.round(38 + phase * 18)}%` },
    },
    {
      act: 1,
      primary: { label: "BONES", value: "048" },
      secondary: { label: "PRED", value: `+0${2 + Math.round(phase)} POSE` },
    },
    {
      act: 2,
      primary: { label: "CELLS", value: cellCount.toLocaleString("en-US") },
      secondary: { label: "BIOME", value: `${Math.round(68 + phase * 19)}%` },
    },
    {
      act: 3,
      primary: {
        label: "SCALE",
        value: progress < 0.34 ? "1.00 R⊕" : progress < 0.68 ? "4.80 AU" : "52 KLY",
      },
      secondary: { label: "ORBIT", value: `${Math.round(12 + progress * 76)}%` },
    },
  ];
  const detail = details[Math.min(3, Math.max(0, Math.round(act)))];
  window.dispatchEvent(new CustomEvent<ShowcaseStateDetail>(SHOWCASE_STATE_EVENT, { detail }));
}
