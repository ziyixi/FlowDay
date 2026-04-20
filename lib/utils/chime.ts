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

// NBC chime — the classic G–E–C descending triad, voiced an octave up
// (G5 → E5 → C5) so the higher partials cut through music in the background.
// Each note layers a sawtooth fundamental (rich in odd+even harmonics, perceived
// much louder than sine/triangle) with octave + fifth overtones for bell-like
// brightness. The whole chain runs through a heavy compressor that squashes peaks
// and boosts average loudness — this is the same trick mastering engineers use to
// make a track "loud" without clipping. ~1.0s total; notes overlap into a major triad.
export function playCompletionChime(): void {
  chimeCount++;

  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }

  let compressor: DynamicsCompressorNode;
  let master: GainNode;
  try {
    compressor = ctx.createDynamicsCompressor();
    master = ctx.createGain();
  } catch {
    return;
  }

  compressor.threshold.value = -18;
  compressor.knee.value = 12;
  compressor.ratio.value = 20;
  compressor.attack.value = 0.001;
  compressor.release.value = 0.1;
  master.gain.value = 0.8;

  compressor.connect(master);
  master.connect(ctx.destination);

  const now = ctx.currentTime;
  const notes = [
    { freq: 783.99, offset: 0 },    // G5
    { freq: 659.25, offset: 0.25 }, // E5
    { freq: 523.25, offset: 0.5 },  // C5
  ];

  for (const { freq, offset } of notes) {
    playBellNote(ctx, compressor, freq, now + offset);
  }
}

function playBellNote(
  ctx: AudioContext,
  destination: AudioNode,
  freq: number,
  start: number
): void {
  // Sawtooth fundamental gives the loudest perceived level (all harmonics
  // present); octave + fifth overtones add bell-like sparkle on top.
  const layers: Array<{ type: OscillatorType; multiplier: number; gain: number }> = [
    { type: "sawtooth", multiplier: 1, gain: 0.45 },
    { type: "triangle", multiplier: 2, gain: 0.22 },
    { type: "triangle", multiplier: 3, gain: 0.1 },
  ];

  for (const { type, multiplier, gain: peakGain } of layers) {
    let osc: OscillatorNode;
    let gain: GainNode;
    try {
      osc = ctx.createOscillator();
      gain = ctx.createGain();
    } catch {
      return;
    }

    osc.type = type;
    osc.frequency.value = freq * multiplier;

    const peak = start + 0.005;
    const end = start + 0.8;

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peakGain, peak);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain);
    gain.connect(destination);
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
