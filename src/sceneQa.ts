export type NeoQaState = "full" | "medium" | "fault-low";
export type SceneQaFault = "texture" | "shader" | "renderer" | "context";

export type SceneQaConfig = {
  neoState: NeoQaState | null;
  sceneFault: SceneQaFault | null;
  sceneDelay: number;
  freezeScene: boolean;
  reducedMotion: boolean;
  objectMask: boolean;
  sceneProgress: boolean;
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
    sceneProgress: query.get("sceneProgress") === "1",
  };
}
