import assert from "node:assert/strict";
import test from "node:test";
import { createTipArrivals } from "../src/tipSignal.ts";

test("each glow wave schedules six varied spatial tip arrivals", () => {
  const arrivals = createTipArrivals(0.43, 0.618);

  assert.equal(arrivals.length, 6);
  assert.ok(new Set(arrivals.map(({ delay }) => delay.toFixed(4))).size >= 4);
  assert.ok(arrivals.every(({ delay }) => delay >= 0 && delay < 1.5));
  assert.ok(arrivals.some(({ pan }) => pan < 0));
  assert.ok(arrivals.some(({ pan }) => pan > 0));
  assert.ok(arrivals.every(({ frequency }) => frequency >= 700 && frequency <= 1200));
});
