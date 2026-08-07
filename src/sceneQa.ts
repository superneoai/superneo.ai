export type NeoQaState = "full" | "medium" | "fault-low";
export type SceneQaFault = "texture" | "shader" | "renderer" | "context";

export type SceneQaConfig = {
  neoState: NeoQaState | null;
  sceneFault: SceneQaFault | null;
  sceneDelay: number;
  freezeScene: boolean;
  reducedMotion: boolean;
  objectMask: boolean;
  showcaseAct: number | null;
  showcaseTransition: number | null;
};

const NEO_STATES = new Set<NeoQaState>(["full", "medium", "fault-low"]);
const SCENE_FAULTS = new Set<SceneQaFault>([
  "texture",
  "shader",
  "renderer",
  "context",
]);

export function parseSceneQa(search: string): SceneQaConfig {
  const query = new URLSearchParams(search);
  const neoState = query.get("neoState");
  const sceneFault = query.get("sceneFault");
  const requestedDelay = Number(query.get("sceneDelay") ?? 0);
  const showcaseNames = new Map([
    ["car", 0],
    ["ninja", 1],
    ["island", 2],
    ["cosmos", 3],
  ]);
  const requestedAct = showcaseNames.get(query.get("qaAct") ?? "") ?? null;
  const requestedTransition = query.has("qaTransition")
    ? Number(query.get("qaTransition"))
    : Number.NaN;

  return {
    neoState: NEO_STATES.has(neoState as NeoQaState)
      ? neoState as NeoQaState
      : null,
    sceneFault: SCENE_FAULTS.has(sceneFault as SceneQaFault)
      ? sceneFault as SceneQaFault
      : null,
    sceneDelay: Number.isFinite(requestedDelay)
      ? Math.min(10_000, Math.max(0, requestedDelay))
      : 0,
    freezeScene: query.get("freezeScene") === "1",
    reducedMotion: query.get("reducedMotion") === "1",
    objectMask: query.get("objectMask") === "1",
    showcaseAct: requestedAct,
    showcaseTransition: Number.isFinite(requestedTransition)
      ? Math.min(1, Math.max(0, requestedTransition))
      : null,
  };
}
