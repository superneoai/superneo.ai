export const SCENE_PROGRESS_EVENT = "superneo:qa-scene-progress";

export type SceneSignalPhase = "idle" | "travel" | "arrival" | "fade";

export type SceneProgressSnapshot = {
  progress: number;
  signalPhase: SceneSignalPhase;
  revision: number;
};

type SceneProgressOptions = {
  eventTarget: EventTarget;
  host: Pick<HTMLElement, "dataset">;
  onProgress: (snapshot: SceneProgressSnapshot) => void;
};

const SIGNAL_PHASE_PROGRESS: Record<SceneSignalPhase, number> = {
  idle: 1.7,
  travel: 0.28,
  arrival: 0.83,
  fade: 1.42,
};

const isSceneSignalPhase = (value: unknown): value is SceneSignalPhase =>
  value === "idle" || value === "travel" || value === "arrival" || value === "fade";

export function createSceneProgressController({
  eventTarget,
  host,
  onProgress,
}: SceneProgressOptions) {
  let snapshot: SceneProgressSnapshot = {
    progress: SIGNAL_PHASE_PROGRESS.idle,
    signalPhase: "idle",
    revision: 0,
  };
  let publishedRevision = -1;

  const requestProgress = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const phase = event.detail?.signalPhase;
    if (!isSceneSignalPhase(phase)) return;
    snapshot = {
      progress: SIGNAL_PHASE_PROGRESS[phase],
      signalPhase: phase,
      revision: snapshot.revision + 1,
    };
    onProgress(snapshot);
  };

  eventTarget.addEventListener(SCENE_PROGRESS_EVENT, requestProgress);

  return {
    publish() {
      if (publishedRevision === snapshot.revision) return;
      // Publishing after composer.render keeps the queryable phase tied to visible pixels.
      host.dataset.qaSceneProgress = JSON.stringify(snapshot);
      publishedRevision = snapshot.revision;
    },
    dispose() {
      eventTarget.removeEventListener(SCENE_PROGRESS_EVENT, requestProgress);
      delete host.dataset.qaSceneProgress;
    },
  };
}
