import type { TipArrival } from "./tipSignal";

const BPM = 72;
const STEPS_PER_BEAT = 4;
const LOOK_AHEAD_SECONDS = 0.28;
const SCHEDULER_INTERVAL_MS = 80;

const chords = [
  [50, 53, 57, 60],
  [46, 50, 53, 57],
  [53, 57, 60, 64],
  [48, 52, 55, 62],
  [50, 53, 57, 65],
  [46, 50, 55, 57],
  [43, 50, 53, 58],
  [48, 52, 57, 62],
];

const midiToFrequency = (note: number) => 440 * 2 ** ((note - 69) / 12);

type AudioContextConstructor = new (options?: AudioContextOptions) => AudioContext;
type TrackedSource = OscillatorNode | AudioBufferSourceNode;

export class SuperneoSoundtrack {
  private context: AudioContext;
  private musicBus: GainNode;
  private sfxBus: GainNode;
  private toneFilter: BiquadFilterNode;
  private master: GainNode;
  private compressor: DynamicsCompressorNode;
  private reverb: ConvolverNode;
  private reverbGain: GainNode;
  private delay: DelayNode;
  private delayGain: GainNode;
  private delayFeedback: GainNode;
  private noiseBuffer: AudioBuffer;
  private sources = new Set<TrackedSource>();
  private timer: number | null = null;
  private suspendTimer: number | null = null;
  private nextStepTime = 0;
  private step = 0;
  private stage = 0;
  private volume = 0.46;
  private playing = false;

  static isSupported() {
    return typeof window !== "undefined" && Boolean(
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: AudioContextConstructor })
        .webkitAudioContext,
    );
  }

  constructor() {
    const AudioContextClass = window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: AudioContextConstructor })
        .webkitAudioContext;
    if (!AudioContextClass) throw new Error("Web Audio is not supported");

    this.context = new AudioContextClass({ latencyHint: "interactive" });
    this.musicBus = this.context.createGain();
    this.sfxBus = this.context.createGain();
    this.toneFilter = this.context.createBiquadFilter();
    this.master = this.context.createGain();
    this.compressor = this.context.createDynamicsCompressor();
    this.reverb = this.context.createConvolver();
    this.reverbGain = this.context.createGain();
    this.delay = this.context.createDelay(1.5);
    this.delayGain = this.context.createGain();
    this.delayFeedback = this.context.createGain();

    this.toneFilter.type = "lowpass";
    this.toneFilter.frequency.value = 680;
    this.toneFilter.Q.value = 0.7;
    this.master.gain.value = 0;
    this.sfxBus.gain.value = this.volume * 0.36;
    this.compressor.threshold.value = -20;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.018;
    this.compressor.release.value = 0.34;
    this.reverb.buffer = this.createImpulseResponse(2.8, 2.4);
    this.reverbGain.gain.value = 0.2;
    this.delay.delayTime.value = 0.375;
    this.delayGain.gain.value = 0.13;
    this.delayFeedback.gain.value = 0.24;

    this.musicBus.connect(this.toneFilter);
    this.toneFilter.connect(this.master);
    this.toneFilter.connect(this.reverb);
    this.reverb.connect(this.reverbGain).connect(this.master);
    this.toneFilter.connect(this.delay);
    this.delay.connect(this.delayGain).connect(this.master);
    this.delay.connect(this.delayFeedback).connect(this.delay);
    this.master.connect(this.compressor);
    this.sfxBus.connect(this.compressor);
    this.compressor.connect(this.context.destination);
    this.noiseBuffer = this.createNoiseBuffer(0.09);
  }

  async play() {
    if (this.playing) return;
    this.playing = true;
    if (this.suspendTimer !== null) {
      window.clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
    try {
      await this.context.resume();
    } catch (error) {
      this.playing = false;
      throw error;
    }
    if (this.context.state !== "running") {
      this.playing = false;
      throw new Error("Audio context did not enter the running state");
    }
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(Math.max(this.master.gain.value, 0.0001), now);
    this.master.gain.exponentialRampToValueAtTime(
      Math.max(this.volume * 1.2, 0.0001),
      now + 0.22,
    );
    this.nextStepTime = now + 0.06;
    this.schedule();
    this.timer = window.setInterval(() => this.schedule(), SCHEDULER_INTERVAL_MS);
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(Math.max(this.master.gain.value, 0.0001), now);
    this.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    for (const source of this.sources) {
      try {
        source.stop(now + 0.12);
      } catch {
        // The source may already have ended between scheduling and pause.
      }
    }
    this.suspendTimer = window.setTimeout(() => {
      if (!this.playing) void this.context.suspend();
    }, 150);
  }

  setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume));
    this.sfxBus.gain.setTargetAtTime(
      Math.max(this.volume * 0.36, 0.0001),
      this.context.currentTime,
      0.035,
    );
    if (!this.playing) return;
    this.master.gain.setTargetAtTime(
      Math.max(this.volume * 1.2, 0.0001),
      this.context.currentTime,
      0.035,
    );
  }

  async playTipArrivals(arrivals: TipArrival[]) {
    if (this.suspendTimer !== null) {
      window.clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
    await this.context.resume();
    if (this.context.state !== "running") {
      throw new Error("Audio context did not enter the running state");
    }

    const now = this.context.currentTime;
    arrivals.forEach((arrival) => this.scheduleTipTone(arrival, now + arrival.delay));
    if (!this.playing) {
      const lastArrival = Math.max(0, ...arrivals.map((arrival) => arrival.delay));
      this.suspendTimer = window.setTimeout(() => {
        if (!this.playing) void this.context.suspend();
      }, (lastArrival + 0.86) * 1000);
    }
  }

  setStage(stage: number) {
    this.stage = Math.min(3, Math.max(0, stage));
    const cutoff = [620, 920, 1380, 2100][this.stage];
    this.toneFilter.frequency.setTargetAtTime(cutoff, this.context.currentTime, 0.5);
    this.reverbGain.gain.setTargetAtTime(0.17 + this.stage * 0.025, this.context.currentTime, 0.5);
  }

  dispose() {
    this.pause();
    if (this.suspendTimer !== null) window.clearTimeout(this.suspendTimer);
    this.sources.clear();
    void this.context.close();
  }

  private schedule() {
    if (!this.playing) return;
    const now = this.context.currentTime;
    if (this.nextStepTime < now - 0.5) this.nextStepTime = now + 0.05;
    while (this.nextStepTime < now + LOOK_AHEAD_SECONDS) {
      this.scheduleStep(this.step, this.nextStepTime);
      this.step = (this.step + 1) % 128;
      this.nextStepTime += 60 / BPM / STEPS_PER_BEAT;
    }
  }

  private scheduleStep(step: number, time: number) {
    const slot = step % 16;
    const bar = Math.floor(step / 16) % chords.length;
    const chord = chords[bar];
    const root = chord[0] - 12;

    if (slot === 0) this.schedulePad(chord, time);
    if (slot === 0 || slot === 7 || slot === 10) {
      this.scheduleTone(midiToFrequency(root + (slot === 10 ? 7 : 0)), time, 0.72, {
        type: "triangle",
        level: 0.09,
        attack: 0.035,
        pan: -0.08,
      });
    }

    if (slot % 2 === 0) {
      const chordIndex = (slot / 2 + bar) % chord.length;
      const octave = slot === 14 ? 24 : 12;
      this.scheduleTone(midiToFrequency(chord[chordIndex] + octave), time, 0.48, {
        type: "sine",
        level: 0.034 + this.stage * 0.004,
        attack: 0.012,
        pan: ((slot % 8) / 8 - 0.5) * 0.72,
      });
    }

    if (this.stage >= 1 && (slot === 4 || slot === 12)) {
      this.scheduleNoise(time, slot === 12 ? 0.034 : 0.024, slot === 12 ? 3400 : 1900);
    }

    if (this.stage >= 2 && (slot === 3 || slot === 11)) {
      const signalNote = chord[(bar + slot) % chord.length] + 24;
      this.scheduleTone(midiToFrequency(signalNote), time + 0.025, 0.82, {
        type: "triangle",
        level: 0.026,
        attack: 0.065,
        pan: slot === 3 ? -0.55 : 0.55,
      });
    }
  }

  private schedulePad(notes: number[], time: number) {
    notes.slice(0, 3).forEach((note, index) => {
      const pan = (index - 1) * 0.46;
      this.scheduleTone(midiToFrequency(note), time, 3.9, {
        type: "triangle",
        level: 0.026,
        attack: 0.58,
        pan,
      });
      this.scheduleTone(midiToFrequency(note) * 0.999, time, 3.7, {
        type: "sine",
        level: 0.017,
        attack: 0.72,
        pan: -pan,
      });
    });
  }

  private scheduleTone(
    frequency: number,
    time: number,
    duration: number,
    options: { type: OscillatorType; level: number; attack: number; pan: number },
  ) {
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    const panner = this.context.createStereoPanner();
    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.detune.setValueAtTime((frequency % 7) - 3, time);
    panner.pan.value = options.pan;
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(options.level, time + options.attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(envelope).connect(panner).connect(this.musicBus);
    this.trackSource(oscillator);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.05);
  }

  private scheduleNoise(time: number, level: number, frequency: number) {
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    const panner = this.context.createStereoPanner();
    source.buffer = this.noiseBuffer;
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 2.8;
    panner.pan.value = frequency > 2500 ? 0.38 : -0.28;
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(level, time + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.075);
    source.connect(filter).connect(envelope).connect(panner).connect(this.musicBus);
    this.trackSource(source);
    source.start(time);
    source.stop(time + 0.09);
  }

  private scheduleTipTone(arrival: TipArrival, time: number) {
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    const panner = this.context.createStereoPanner();
    const chord = chords[Math.floor(this.step / 16) % chords.length];
    const voiceIndex = Math.abs(Math.round(arrival.frequency / 74)) % chord.length;
    const frequency = midiToFrequency(chord[voiceIndex] + 12);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency * 1.012, time);
    oscillator.frequency.exponentialRampToValueAtTime(frequency, time + 0.52);
    panner.pan.value = arrival.pan;
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(0.035, time + 0.065);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.78);
    oscillator.connect(envelope).connect(panner).connect(this.sfxBus);
    this.trackSource(oscillator);
    oscillator.start(time);
    oscillator.stop(time + 0.82);
  }

  private trackSource(source: TrackedSource) {
    this.sources.add(source);
    source.addEventListener("ended", () => this.sources.delete(source), { once: true });
  }

  private createNoiseBuffer(duration: number) {
    const length = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      const fade = 1 - index / length;
      samples[index] = (Math.random() * 2 - 1) * fade;
    }
    return buffer;
  }

  private createImpulseResponse(duration: number, decay: number) {
    const length = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(2, length, this.context.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const samples = buffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        samples[index] = (Math.random() * 2 - 1) * (1 - index / length) ** decay;
      }
    }
    return buffer;
  }
}
