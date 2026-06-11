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
