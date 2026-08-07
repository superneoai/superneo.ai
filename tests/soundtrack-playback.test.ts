import assert from "node:assert/strict";
import test from "node:test";
import { SuperneoSoundtrack } from "../src/soundtrackEngine.ts";

class FakeAudioParam {
  value = 0;
  cancelScheduledValues() {}
  setValueAtTime(value: number) { this.value = value; }
  exponentialRampToValueAtTime(value: number) { this.value = value; }
  setTargetAtTime(value: number) { this.value = value; }
}

class FakeAudioNode {
  connect<T>(target: T) { return target; }
  addEventListener() {}
}

class FakeGainNode extends FakeAudioNode { gain = new FakeAudioParam(); }
class FakeFilterNode extends FakeAudioNode {
  type = "lowpass";
  frequency = new FakeAudioParam();
  Q = new FakeAudioParam();
}
class FakeCompressorNode extends FakeAudioNode {
  threshold = new FakeAudioParam();
  knee = new FakeAudioParam();
  ratio = new FakeAudioParam();
  attack = new FakeAudioParam();
  release = new FakeAudioParam();
}
class FakeDelayNode extends FakeAudioNode { delayTime = new FakeAudioParam(); }
class FakeConvolverNode extends FakeAudioNode { buffer: FakeAudioBuffer | null = null; }
class FakePannerNode extends FakeAudioNode { pan = new FakeAudioParam(); }
class FakeSourceNode extends FakeAudioNode {
  startTime = 0;
  start(time = 0) { this.startTime = time; }
  stop() {}
}
class FakeOscillatorNode extends FakeSourceNode {
  type = "sine";
  frequency = new FakeAudioParam();
  detune = new FakeAudioParam();
}
class FakeBufferSourceNode extends FakeSourceNode { buffer: FakeAudioBuffer | null = null; }

class FakeAudioBuffer {
  private channels: Float32Array[];

  constructor(channelCount: number, length: number) {
    this.channels = Array.from({ length: channelCount }, () => new Float32Array(length));
  }

  getChannelData(channel: number) { return this.channels[channel]; }
}

class FakeAudioContext {
  static latest: FakeAudioContext;
  static interruptFirstResume = true;
  currentTime = 0;
  sampleRate = 8000;
  state = "suspended";
  resumeCalls = 0;
  oscillators: FakeOscillatorNode[] = [];
  destination = new FakeAudioNode();

  constructor() { FakeAudioContext.latest = this; }
  createGain() { return new FakeGainNode(); }
  createBiquadFilter() { return new FakeFilterNode(); }
  createDynamicsCompressor() { return new FakeCompressorNode(); }
  createConvolver() { return new FakeConvolverNode(); }
  createDelay() { return new FakeDelayNode(); }
  createStereoPanner() { return new FakePannerNode(); }
  createOscillator() {
    const oscillator = new FakeOscillatorNode();
    this.oscillators.push(oscillator);
    return oscillator;
  }
  createBufferSource() { return new FakeBufferSourceNode(); }
  createBuffer(channels: number, length: number) {
    return new FakeAudioBuffer(channels, length);
  }
  async resume() {
    this.resumeCalls += 1;
    if (FakeAudioContext.interruptFirstResume && this.resumeCalls === 1) {
      throw new Error("gesture interrupted");
    }
    this.state = "running";
  }
  async suspend() { this.state = "suspended"; }
  async close() { this.state = "closed"; }
}

test("playback can recover when the first AudioContext resume is interrupted", async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    AudioContext: FakeAudioContext,
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {},
  } as unknown as Window & typeof globalThis;

  try {
    FakeAudioContext.interruptFirstResume = true;
    const soundtrack = new SuperneoSoundtrack();
    await assert.rejects(soundtrack.play(), /gesture interrupted/);
    await soundtrack.play();

    assert.equal(FakeAudioContext.latest.resumeCalls, 2);
    assert.equal(FakeAudioContext.latest.state, "running");
    soundtrack.dispose();
  } finally {
    globalThis.window = originalWindow;
  }
});

test("tip arrivals schedule subtle tones at their visual arrival times", async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    AudioContext: FakeAudioContext,
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {},
  } as unknown as Window & typeof globalThis;

  try {
    FakeAudioContext.interruptFirstResume = false;
    const soundtrack = new SuperneoSoundtrack();
    await soundtrack.playTipArrivals([
      { delay: 0.24, frequency: 820, pan: -0.4 },
      { delay: 0.61, frequency: 1040, pan: 0.45 },
    ]);

    assert.deepEqual(
      FakeAudioContext.latest.oscillators.map(({ startTime }) => startTime),
      [0.24, 0.61],
    );
    assert.ok(FakeAudioContext.latest.oscillators.every(
      ({ frequency }) => frequency.value >= 190 && frequency.value <= 700,
    ));
    soundtrack.dispose();
  } finally {
    globalThis.window = originalWindow;
  }
});

test("foot contacts stay silent until playback and then add one restrained impact", async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    AudioContext: FakeAudioContext,
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {},
  } as unknown as Window & typeof globalThis;

  try {
    FakeAudioContext.interruptFirstResume = false;
    const soundtrack = new SuperneoSoundtrack();
    soundtrack.playFootstep(1, -0.4);
    assert.equal(FakeAudioContext.latest.oscillators.length, 0);

    await soundtrack.play();
    const scheduledByMusic = FakeAudioContext.latest.oscillators.length;
    soundtrack.setStage(2);
    soundtrack.playFootstep(0.8, 0.35);

    assert.equal(FakeAudioContext.latest.oscillators.length, scheduledByMusic + 1);
    assert.equal(FakeAudioContext.latest.oscillators.at(-1)?.frequency.value, 76);
    soundtrack.dispose();
  } finally {
    globalThis.window = originalWindow;
  }
});
