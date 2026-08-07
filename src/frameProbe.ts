type FrameProbeReport = {
  frames: number;
  fps: number;
  p50Gap: number;
  p95Gap: number;
  maxGap: number;
  p95Render: number;
  maxRender: number;
  over25: number;
  over50: number;
};

const percentile = (values: number[], ratio: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
};

const round = (value: number) => Math.round(value * 1000) / 1000;

export function createFrameProbe() {
  const params = new URLSearchParams(window.location.search);
  const isDevelopment = (import.meta as ImportMeta & { env: { DEV?: boolean } }).env.DEV;
  if (!isDevelopment || params.get("perf") !== "1") return null;

  const delay = Math.max(300, Number(params.get("perfDelay")) || 1200);
  const duration = Math.max(1200, Number(params.get("perfDuration")) || 3600);
  const manualStart = params.get("perfManual") === "1";
  let startsAt = manualStart ? Number.POSITIVE_INFINITY : performance.now() + delay;
  const gaps: number[] = [];
  const renders: number[] = [];
  let previousFrame = 0;
  let reported = false;

  delete document.documentElement.dataset.frameReport;

  const start = () => {
    startsAt = performance.now();
    gaps.length = 0;
    renders.length = 0;
    previousFrame = 0;
    reported = false;
    delete document.documentElement.dataset.frameReport;
  };
  const probeWindow = window as Window & {
    __superneoStartFrameProbe?: () => void;
  };
  if (manualStart) probeWindow.__superneoStartFrameProbe = start;

  return {
    sample(now: number, renderDuration: number) {
      if (reported || now < startsAt) return;
      if (previousFrame > 0) gaps.push(now - previousFrame);
      previousFrame = now;
      renders.push(renderDuration);
      if (now - startsAt < duration) return;

      reported = true;
      const report: FrameProbeReport = {
        frames: gaps.length,
        fps: round(gaps.length / (duration / 1000)),
        p50Gap: round(percentile(gaps, 0.5)),
        p95Gap: round(percentile(gaps, 0.95)),
        maxGap: round(Math.max(...gaps)),
        p95Render: round(percentile(renders, 0.95)),
        maxRender: round(Math.max(...renders)),
        over25: gaps.filter((gap) => gap > 25).length,
        over50: gaps.filter((gap) => gap > 50).length,
      };
      document.documentElement.dataset.frameReport = JSON.stringify(report);
    },
    start,
    dispose() {
      if (probeWindow.__superneoStartFrameProbe === start) {
        delete probeWindow.__superneoStartFrameProbe;
      }
    },
  };
}
