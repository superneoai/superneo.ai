export const SHOWCASE_IMPULSE_EVENT = "superneo:showcase-impulse";

export type ShowcaseImpulseKind = "drive" | "clash" | "terrain" | "orbit";

export type ShowcaseImpulseDetail = {
  kind: ShowcaseImpulseKind;
  intensity: number;
  pan: number;
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
