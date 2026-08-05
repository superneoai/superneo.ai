export const TIP_SIGNAL_EVENT = "superneo:tip-arrivals";
export const SIGNAL_PROGRESS_PER_SECOND = 0.92;

export type TipArrival = {
  delay: number;
  frequency: number;
  pan: number;
};

const fract = (value: number) => value - Math.floor(value);

export function tipTravelSpeed(strand: number, side: number, variation: number) {
  const randomSpeed = fract(Math.sin(
    (strand + 1) * 12.9898 + side * 78.233 + variation * 127.117,
  ) * 43758.5453);
  const easedSpeed = randomSpeed * randomSpeed * (3 - 2 * randomSpeed);
  return 0.68 + easedSpeed * (1.34 - 0.68);
}

export function createTipArrivals(clickAlong: number, variation: number): TipArrival[] {
  const longestRoute = Math.max(clickAlong, 1 - clickAlong);
  const routeScale = longestRoute + 0.38;
  const arrivals: TipArrival[] = [];

  for (let strand = 0; strand < 3; strand += 1) {
    for (let side = 0; side < 2; side += 1) {
      const routeLength = side === 0 ? clickAlong : 1 - clickAlong;
      const speed = tipTravelSpeed(strand, side, variation);
      const arrivalProgress = routeLength / routeScale;
      arrivals.push({
        delay: arrivalProgress / (SIGNAL_PROGRESS_PER_SECOND * speed),
        frequency: 720 + strand * 118 + side * 74 + variation * 86,
        pan: Math.max(-0.55, Math.min(0.55, (strand - 1) * 0.23 + (side * 2 - 1) * 0.08)),
      });
    }
  }

  return arrivals;
}
