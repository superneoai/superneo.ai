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

test("showcase impulses unlock and schedule a restrained two-tone cue", async () => {
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
    await soundtrack.playShowcaseImpulse({ kind: "clash", intensity: 0.8, pan: -0.4 });

    assert.deepEqual(
      FakeAudioContext.latest.oscillators.map(({ startTime }) => startTime),
      [0, 0.035],
    );
    assert.deepEqual(
      FakeAudioContext.latest.oscillators.map(({ frequency }) => frequency.value),
      [184, 368],
    );
    soundtrack.dispose();
  } finally {
    globalThis.window = originalWindow;
  }
});

test("each act maps to its own simulation cue", async () => {
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
    for (const kind of ["drive", "clash", "terrain", "orbit"] as const) {
      await soundtrack.playShowcaseImpulse({ kind, intensity: 0.7, pan: 0.2 });
    }
    assert.deepEqual(
      FakeAudioContext.latest.oscillators
        .filter((_, index) => index % 2 === 0)
        .map(({ frequency }) => frequency.value),
      [92, 184, 72, 246],
    );
    soundtrack.dispose();
  } finally {
    globalThis.window = originalWindow;
  }
});
