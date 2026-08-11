const REFERENCE_FRAMES_PER_SECOND = 60;
const MAX_ELAPSED_SECONDS = 0.25;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function boundedFrameDelta(timestamp: number, previousTimestamp: number) {
  const elapsed = (timestamp - previousTimestamp) / 1000;
  if (!Number.isFinite(elapsed)) return 0;
  return Math.min(MAX_ELAPSED_SECONDS, Math.max(0, elapsed));
}

export function frameAdjustedBlend(blendAt60Hz: number, elapsedSeconds: number) {
  const blend = clamp01(blendAt60Hz);
  const frames = Math.max(0, elapsedSeconds) * REFERENCE_FRAMES_PER_SECOND;
  return 1 - Math.pow(1 - blend, frames);
}

export function frameAdjustedRetention(retentionAt60Hz: number, elapsedSeconds: number) {
  const retention = clamp01(retentionAt60Hz);
  const frames = Math.max(0, elapsedSeconds) * REFERENCE_FRAMES_PER_SECOND;
  return Math.pow(retention, frames);
}
