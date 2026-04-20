import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _getChimeCount,
  _resetChime,
  playCompletionChime,
} from "@/lib/utils/chime";

interface FakeOscillator {
  type: string;
  frequency: { value: number };
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

interface FakeGain {
  gain: {
    setValueAtTime: ReturnType<typeof vi.fn>;
    linearRampToValueAtTime: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
  connect: ReturnType<typeof vi.fn>;
}

interface FakeCompressor {
  threshold: { value: number };
  knee: { value: number };
  ratio: { value: number };
  attack: { value: number };
  release: { value: number };
  connect: ReturnType<typeof vi.fn>;
}

interface FakeAudioContext {
  state: string;
  currentTime: number;
  destination: object;
  resume: ReturnType<typeof vi.fn>;
  createOscillator: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
  createDynamicsCompressor: ReturnType<typeof vi.fn>;
}

function makeFakeContext(): {
  ctx: FakeAudioContext;
  oscillators: FakeOscillator[];
  gains: FakeGain[];
  compressors: FakeCompressor[];
} {
  const oscillators: FakeOscillator[] = [];
  const gains: FakeGain[] = [];
  const compressors: FakeCompressor[] = [];

  const ctx: FakeAudioContext = {
    state: "running",
    currentTime: 0,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    createOscillator: vi.fn(() => {
      const osc: FakeOscillator = {
        type: "",
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(osc);
      return osc;
    }),
    createGain: vi.fn(() => {
      const gain: FakeGain = {
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      };
      gains.push(gain);
      return gain;
    }),
    createDynamicsCompressor: vi.fn(() => {
      const compressor: FakeCompressor = {
        threshold: { value: 0 },
        knee: { value: 0 },
        ratio: { value: 0 },
        attack: { value: 0 },
        release: { value: 0 },
        connect: vi.fn(),
      };
      compressors.push(compressor);
      return compressor;
    }),
  };

  return { ctx, oscillators, gains, compressors };
}

describe("playCompletionChime", () => {
  beforeEach(() => {
    _resetChime();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    _resetChime();
  });

  it("increments the chime count even when no AudioContext is available", () => {
    vi.stubGlobal("window", {});
    expect(_getChimeCount()).toBe(0);

    playCompletionChime();
    playCompletionChime();

    expect(_getChimeCount()).toBe(2);
  });

  it("plays the NBC G5-E5-C5 chime with sawtooth fundamentals through a loudness compressor", () => {
    const { ctx, oscillators, gains, compressors } = makeFakeContext();
    const Ctor = vi.fn(() => ctx);
    vi.stubGlobal("window", { AudioContext: Ctor });

    playCompletionChime();

    expect(Ctor).toHaveBeenCalledTimes(1);
    // Three notes × (fundamental + octave + fifth) = nine oscillators.
    // Plus one master gain on top of the per-note gains (9 + 1 = 10).
    expect(oscillators).toHaveLength(9);
    expect(gains).toHaveLength(10);
    expect(compressors).toHaveLength(1);

    // Compressor squashes peaks so the makeup gain can boost the average level.
    const compressor = compressors[0];
    expect(compressor.threshold.value).toBeCloseTo(-18);
    expect(compressor.ratio.value).toBeCloseTo(20);
    expect(compressor.attack.value).toBeCloseTo(0.001);

    // Master gain (first gain created — before the note loop) provides makeup
    // gain after compression. .value is set directly, so no ramp methods fire.
    expect(gains[0].gain.linearRampToValueAtTime).not.toHaveBeenCalled();
    expect(gains[0].gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();

    for (const osc of oscillators) {
      expect(osc.start).toHaveBeenCalledTimes(1);
      expect(osc.stop).toHaveBeenCalledTimes(1);
    }

    // Fundamentals (indices 0, 3, 6): sawtooth for maximum perceived loudness.
    expect(oscillators[0].type).toBe("sawtooth");
    expect(oscillators[3].type).toBe("sawtooth");
    expect(oscillators[6].type).toBe("sawtooth");

    // Overtones use triangle for bell-like sparkle without harshness.
    expect(oscillators[1].type).toBe("triangle");
    expect(oscillators[2].type).toBe("triangle");

    // Fundamentals form the G5 → E5 → C5 NBC chime, an octave up.
    expect(oscillators[0].frequency.value).toBeCloseTo(783.99);
    expect(oscillators[3].frequency.value).toBeCloseTo(659.25);
    expect(oscillators[6].frequency.value).toBeCloseTo(523.25);

    // Octave overtones (indices 1, 4, 7) are 2× the fundamental.
    expect(oscillators[1].frequency.value).toBeCloseTo(783.99 * 2);
    expect(oscillators[4].frequency.value).toBeCloseTo(659.25 * 2);
    expect(oscillators[7].frequency.value).toBeCloseTo(523.25 * 2);

    // Fifth overtones (indices 2, 5, 8) are 3× the fundamental.
    expect(oscillators[2].frequency.value).toBeCloseTo(783.99 * 3);
    expect(oscillators[5].frequency.value).toBeCloseTo(659.25 * 3);
    expect(oscillators[8].frequency.value).toBeCloseTo(523.25 * 3);

    // Per-note gains (skip master at index 0): 0.45 / 0.22 / 0.1.
    const peaks = gains
      .slice(1)
      .map((g) => g.gain.linearRampToValueAtTime.mock.calls[0]?.[0]);
    for (let i = 0; i < 3; i++) {
      expect(peaks[i * 3]).toBeCloseTo(0.45);
      expect(peaks[i * 3 + 1]).toBeCloseTo(0.22);
      expect(peaks[i * 3 + 2]).toBeCloseTo(0.1);
    }
  });

  it("resumes a suspended AudioContext before scheduling notes", () => {
    const { ctx } = makeFakeContext();
    ctx.state = "suspended";
    vi.stubGlobal("window", { AudioContext: vi.fn(() => ctx) });

    playCompletionChime();

    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(9);
  });

  it("reuses a single AudioContext across multiple chimes", () => {
    const { ctx } = makeFakeContext();
    const Ctor = vi.fn(() => ctx);
    vi.stubGlobal("window", { AudioContext: Ctor });

    playCompletionChime();
    playCompletionChime();
    playCompletionChime();

    expect(Ctor).toHaveBeenCalledTimes(1);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(27);
  });
});
