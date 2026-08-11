import { toStageIndex } from "./morphTimeline";
import { dispatchStageChange } from "./stageSignal";

export type SceneProgressSnapshot = {
  progress: number;
  scrollDelta: number;
  scrollEnergy: number;
};

type SceneProgressOptions = {
  onDiscover: () => void;
  onProgress: (snapshot: SceneProgressSnapshot) => void;
};

export function createSceneProgressController({
  onDiscover,
  onProgress,
}: SceneProgressOptions) {
  let frame: number | null = null;
  let scrollRange = 1;
  let previousScrollY = window.scrollY;
  let previousScrollTime = performance.now();
  let currentStage = 0;
  let discovered = false;
  const scrollRailFill = document.querySelector<HTMLElement>(".scroll-rail-fill");

  const sync = () => {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    const now = performance.now();
    const scrollY = window.scrollY;
    const elapsed = Math.max(now - previousScrollTime, 8);
    const scrollDelta = scrollY - previousScrollY;
    const progress = Math.min(1, Math.max(0, scrollY / scrollRange));
    const scrollEnergy = Math.min(Math.abs(scrollDelta) * 1000 / elapsed / 2300, 1);
    const nextStage = toStageIndex(progress);

    if (nextStage !== currentStage) {
      const previousStage = currentStage;
      currentStage = nextStage;
      dispatchStageChange(nextStage, previousStage);
    }
    if (scrollRailFill) scrollRailFill.style.transform = `scaleY(${progress.toFixed(4)})`;
    if (!discovered && progress > 0.006) {
      discovered = true;
      onDiscover();
    }
    onProgress({ progress, scrollDelta, scrollEnergy });
    previousScrollY = scrollY;
    previousScrollTime = now;
  };

  const schedule = () => {
    if (frame !== null) return;
    frame = window.requestAnimationFrame(sync);
  };

  const updateRange = () => {
    scrollRange = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    schedule();
  };

  updateRange();
  window.addEventListener("resize", updateRange, { passive: true });
  window.addEventListener("scroll", schedule, { passive: true });

  return {
    sync,
    dispose() {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateRange);
      window.removeEventListener("scroll", schedule);
      scrollRailFill?.style.removeProperty("transform");
    },
  };
}
