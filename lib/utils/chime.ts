type AudioContextCtor = typeof AudioContext;

let audioContext: AudioContext | null = null;
let chimeCount = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor })
      .webkitAudioContext;

  if (!Ctor) return null;

  if (!audioContext) {
    try {
      audioContext = new Ctor();
    } catch {
      return null;
    }
  }

  return audioContext;
}

// Soft two-note chime (C5 → E5) with a gentle attack and exponential decay.
// Volume peaks at 0.08 — quiet on purpose; not meant to startle.
export function playCompletionChime(): void {
  chimeCount++;

  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  const notes = [
    { freq: 523.25, offset: 0 },
    { freq: 659.25, offset: 0.13 },
  ];

  for (const { freq, offset } of notes) {
    let osc: OscillatorNode;
    let gain: GainNode;
    try {
      osc = ctx.createOscillator();
      gain = ctx.createGain();
    } catch {
      return;
    }

    osc.type = "sine";
    osc.frequency.value = freq;

    const start = now + offset;
    const peak = start + 0.04;
    const end = start + 0.55;

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.08, peak);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

// Test-only — exposed for unit/integration/UI tests to verify the chime fired.
export function _getChimeCount(): number {
  return chimeCount;
}

export function _resetChime(): void {
  chimeCount = 0;
  audioContext = null;
}
