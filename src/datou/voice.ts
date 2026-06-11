/**
 * voice — BOBO speaks (CHARACTER_IMPLEMENTATION §C4).
 *
 * He's a chatterbox (话痨), but the screen is not: one quiet chip at a time,
 * rate-limited so the baseline keeps the silence between lines. The picker
 * returns i18n keys (`voice.<context>.<n>`); the pools live in i18n.ts in
 * both locales, written in-character (child voice, "Babo~" punctuation,
 * 2049 wonder, 讲道理 when wronged).
 *
 * Two tiers: `beat` lines ride a game event (discovery, craft, being
 * wronged) and only need a short breath between lines; `ambient` lines fill
 * companionable silence and respect a long floor that SHRINKS as the
 * friendship deepens — chatter frequency is itself familiarity-scaled (R1).
 *
 * Deterministic: line choice comes from the injected (seeded) rand.
 */

export type VoiceContext =
  | 'greet'
  | 'discover'
  | 'craft'
  | 'pet'
  | 'wronged'
  | 'milestone'
  | 'inspired'
  | 'landmark'
  | 'fetch'
  | 'shy'
  | 'startled'
  | 'wonder'
  | 'showTell'
  | 'ask';

/** Lines per context — i18n holds `voice.<context>.1 … .<n>` in en + zh. */
export const VOICE_POOL: Record<VoiceContext, number> = {
  greet: 5,
  discover: 6,
  craft: 5,
  pet: 4,
  wronged: 4,
  milestone: 3,
  inspired: 4,
  landmark: 4,
  fetch: 3,
  shy: 3,
  startled: 3,
  wonder: 6,
  showTell: 4,
  ask: 4,
};

const AMBIENT: ReadonlySet<VoiceContext> = new Set(['wonder', 'ask']);

/** Minimum breath between any two lines (he never talks over himself). */
const BEAT_GAP = 6;

export class Voice {
  private sinceLast = 999;
  private readonly lastIdx = new Map<VoiceContext, number>();
  private readonly rand: () => number;

  constructor(rand: () => number) {
    this.rand = rand;
  }

  update(dt: number): void {
    this.sinceLast += dt;
  }

  /**
   * Ask for a line. Returns an i18n key, or null when it's not his moment —
   * callers just drop the beat (a missed line is silence, never a queue).
   * @param amplitude familiarity expressiveness 0.35..1 — scales how often
   *                  the ambient chatter is allowed.
   */
  request(context: VoiceContext, amplitude: number): string | null {
    const gap = AMBIENT.has(context) ? 18 + 30 * (1 - amplitude) : BEAT_GAP;
    if (this.sinceLast < gap) return null;
    const n = VOICE_POOL[context];
    let idx = 1 + Math.floor(this.rand() * n);
    if (idx > n) idx = n;
    // Never the same line twice in a row from one pool.
    if (n > 1 && idx === this.lastIdx.get(context)) idx = 1 + (idx % n);
    this.lastIdx.set(context, idx);
    this.sinceLast = 0;
    return `voice.${context}.${idx}`;
  }
}
