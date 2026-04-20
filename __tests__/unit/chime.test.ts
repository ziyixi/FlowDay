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

interface FakeAudioContext {
  state: string;
  currentTime: number;
  destination: object;
  resume: ReturnType<typeof vi.fn>;
  createOscillator: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
}

function makeFakeContext(): {
  ctx: FakeAudioContext;
  oscillators: FakeOscillator[];
  gains: FakeGain[];
} {
  const oscillators: FakeOscillator[] = [];
  const gains: FakeGain[] = [];

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
  };

  return { ctx, oscillators, gains };
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

  it("creates two oscillators with sine waves on the C5/E5 notes", () => {
    const { ctx, oscillators, gains } = makeFakeContext();
    const Ctor = vi.fn(() => ctx);
    vi.stubGlobal("window", { AudioContext: Ctor });

    playCompletionChime();

    expect(Ctor).toHaveBeenCalledTimes(1);
    expect(oscillators).toHaveLength(2);
    expect(gains).toHaveLength(2);

    expect(oscillators[0].type).toBe("sine");
    expect(oscillators[1].type).toBe("sine");
    expect(oscillators[0].frequency.value).toBeCloseTo(523.25);
    expect(oscillators[1].frequency.value).toBeCloseTo(659.25);

    // Each oscillator should have been started and stopped exactly once.
    for (const osc of oscillators) {
      expect(osc.start).toHaveBeenCalledTimes(1);
      expect(osc.stop).toHaveBeenCalledTimes(1);
    }

    // Gentle envelope: peak gain should be 0.08 — quiet on purpose.
    for (const gain of gains) {
      const peakCall = gain.gain.linearRampToValueAtTime.mock.calls[0];
      expect(peakCall?.[0]).toBeCloseTo(0.08);
    }
  });

  it("resumes a suspended AudioContext before scheduling notes", () => {
    const { ctx } = makeFakeContext();
    ctx.state = "suspended";
    vi.stubGlobal("window", { AudioContext: vi.fn(() => ctx) });

    playCompletionChime();

    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
  });

  it("reuses a single AudioContext across multiple chimes", () => {
    const { ctx } = makeFakeContext();
    const Ctor = vi.fn(() => ctx);
    vi.stubGlobal("window", { AudioContext: Ctor });

    playCompletionChime();
    playCompletionChime();
    playCompletionChime();

    expect(Ctor).toHaveBeenCalledTimes(1);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(6);
  });
});
