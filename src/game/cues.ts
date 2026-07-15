/**
 * Sound cues — the game's only audio (landmark plan Phase 3), kept to the
 * baseline's "subtle sound pulse": two quiet, short, synthesized cues. No
 * assets, no loops, no music. The chime is the Commons' audible re-lure
 * (§7A: "chime sounds when the player passes"); the response is the relay's
 * one distant answer (§7C).
 *
 * WebAudio is created lazily and resumes on the first user gesture; every
 * call is failure-safe (audio is garnish, never load-bearing).
 */

let ctx: AudioContext | null = null;

function ensure(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx.state === 'running' ? ctx : null;
  } catch {
    return null;
  }
}

/** One soft struck note: triangle osc with a fast rise and a long fall. */
function note(
  c: AudioContext,
  freq: number,
  at: number,
  peak: number,
  fall: number,
  type: OscillatorType = 'triangle',
): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = c.currentTime + at;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + fall);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + fall + 0.05);
}

/** The repaired message chime: three small notes, barely there. */
export function cueChime(): void {
  const c = ensure();
  if (!c) return;
  note(c, 880, 0, 0.05, 1.4);
  note(c, 1174.7, 0.16, 0.04, 1.5);
  note(c, 1568, 0.34, 0.035, 1.7);
}

/** The relay's distant response: one low tone and its faint octave echo. */
export function cueResponse(): void {
  const c = ensure();
  if (!c) return;
  note(c, 196, 0, 0.06, 1.8, 'sine');
  note(c, 392, 0.55, 0.025, 2.2, 'sine');
}

// ── Footstep foley ──────────────────────────────────────────────────────────
// One soft, short tap per footfall, voiced by surface. Filtered noise, not a
// sample — the same "quiet synthesized garnish, never load-bearing" rule as the
// cues above. Kept low-gain so the walk gains a felt cadence without becoming a
// sound effect you'd notice as such.

let noiseBuffer: AudioBuffer | null = null;

/** A short shared white-noise buffer (0.2 s), the grain of every footstep. */
function noise(c: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === c.sampleRate) return noiseBuffer;
  const len = Math.floor(c.sampleRate * 0.2);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  // Deterministic pseudo-noise (no Math.random — cosmetic, but keep the codebase
  // habit): a cheap LCG so the buffer is identical run to run.
  let s = 0x2545f4;
  for (let i = 0; i < len; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (s / 0x3fffffff - 1) * 0.9;
  }
  noiseBuffer = buf;
  return buf;
}

/** Voicing per surface: filter centre (Hz), Q, peak gain, decay (s), type. */
const FOOT: Record<string, { freq: number; q: number; peak: number; fall: number; hp: boolean }> = {
  grass: { freq: 900, q: 0.7, peak: 0.05, fall: 0.11, hp: true }, // soft hush
  path: { freq: 420, q: 1.4, peak: 0.075, fall: 0.09, hp: false }, // firmer tap
  sand: { freq: 620, q: 0.6, peak: 0.045, fall: 0.13, hp: true }, // softest
  water: { freq: 340, q: 2.6, peak: 0.06, fall: 0.16, hp: false }, // wet plip
  wood: { freq: 220, q: 3.2, peak: 0.07, fall: 0.1, hp: false }, // hollow knock
};

/**
 * Fire one footstep. `surface` picks the voicing; `gain` scales it (Datou's are
 * quieter than the human's); `pitch` (0.85–1.15) varies each step so a run
 * doesn't machine-gun the same click.
 */
export function cueFootstep(surface: string, gain = 1, pitch = 1): void {
  const c = ensure();
  if (!c) return;
  const v = FOOT[surface] ?? FOOT.grass;
  const t0 = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.playbackRate.value = pitch;
  const filt = c.createBiquadFilter();
  filt.type = v.hp ? 'highpass' : 'bandpass';
  filt.frequency.value = v.freq * pitch;
  filt.Q.value = v.q;
  const g = c.createGain();
  const peak = Math.max(0.0001, v.peak * gain);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + v.fall);
  src.connect(filt).connect(g).connect(c.destination);
  src.start(t0);
  src.stop(t0 + v.fall + 0.02);
}
