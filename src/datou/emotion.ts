/**
 * emotion — what just HAPPENED to Datou (docs/CHARACTER_IMPLEMENTATION.md §2).
 *
 * A discrete emotion with an intensity that decays exponentially, replacing
 * the speed-derived physics mood as the *expressive* source (mood stays in
 * the PhysicsAdapter contract as a locomotion flavor). Event-driven, pure,
 * zero RNG — fully deterministic and unit-tested.
 *
 * Canon invariants from the character bible:
 *  - 不记仇 (no grudges): no negative emotion outlives 60 s after its last
 *    trigger, and any kindness clears the negatives immediately.
 *  - 三分钟热度: excitement has a long (~3 min to fade) half-life and is the
 *    default response to anything NEW.
 *  - 害怕下雨: fear is sustained while rain lasts, then releases quickly.
 *  - Over-praise tips into shyness (兴奋过头 → 小傲娇's soft edge).
 */

export type EmotionKind =
  | 'neutral'
  | 'joy' // petted / praised — warm, brief
  | 'excited' // something NEW — the 三分钟热度 channel
  | 'proud' // made something, helped — the inventor beat
  | 'wronged' // 委屈 — wants ignored repeatedly
  | 'miffed' // 不悦 — turns his back, forgets fast
  | 'afraid' // rain
  | 'startled' // sudden nearby event
  | 'shy'; // over-praised

export type EmotionEvent =
  | 'pet'
  | 'comfort'
  | 'praise' // a want answered, a milestone
  | 'discover'
  | 'landmark'
  | 'craft'
  | 'helped'
  | 'fetch'
  | 'greetPlayer' // session start — friends are back!
  | 'ignoredWant' // expires unanswered; 3 within 90 s → wronged
  | 'startle'
  | 'rainStart'
  | 'rainEnd'
  | 'overPraise'; // applied internally; exported for tests/behaviors

export interface EmotionState {
  kind: EmotionKind;
  /** 0..1 — drives motion grammar scaling and the ear light rhythm. */
  intensity: number;
}

/** Motion grammar classes (bible: 兴奋类 body-dominant / 伤心类 expression-dominant). */
export type EmotionGrammar = 'excited' | 'sad' | null;

interface Channel {
  intensity: number;
  /** Seconds since the last triggering event (for the no-grudge invariant). */
  sinceEvent: number;
}

/** Intensity set on trigger and half-life of the exponential decay. */
const TUNING: Record<Exclude<EmotionKind, 'neutral'>, { set: number; halfLife: number }> = {
  joy: { set: 1, halfLife: 9 },
  excited: { set: 1, halfLife: 75 }, // ≈3 min to drop below threshold
  proud: { set: 0.9, halfLife: 25 },
  wronged: { set: 0.8, halfLife: 18 },
  miffed: { set: 0.7, halfLife: 12 },
  afraid: { set: 0.9, halfLife: 8 }, // halfLife applies AFTER rain ends
  startled: { set: 1, halfLife: 2 },
  shy: { set: 0.8, halfLife: 7 },
};

/** Below this an emotion stops being the face Datou wears. */
const THRESHOLD = 0.12;

const NEGATIVE: ReadonlySet<EmotionKind> = new Set(['wronged', 'miffed', 'afraid', 'startled']);
const POSITIVE_EVENTS: ReadonlySet<EmotionEvent> = new Set([
  'pet',
  'comfort',
  'praise',
  'discover',
  'landmark',
  'craft',
  'helped',
  'fetch',
  'greetPlayer',
]);

const BODY_DOMINANT: ReadonlySet<EmotionKind> = new Set(['joy', 'excited', 'proud']);
const EXPRESSION_DOMINANT: ReadonlySet<EmotionKind> = new Set(['wronged', 'shy', 'afraid']);

/** How long a streak of praise is remembered (for the shy tip-over). */
const PRAISE_WINDOW = 30;
const PRAISE_TIP = 4;
/** Ignored wants are forgiven if spaced out (no grudges, structurally). */
const IGNORE_WINDOW = 90;
const IGNORE_TIP = 3;

export class EmotionEngine {
  private readonly channels = new Map<EmotionKind, Channel>();
  private raining = false;
  private praiseTimes: number[] = [];
  private ignoreTimes: number[] = [];
  private now = 0;

  apply(event: EmotionEvent): void {
    // Kindness clears the negatives on the spot — he forgets the moment
    // you're warm to him (不记仇).
    if (POSITIVE_EVENTS.has(event)) {
      this.channels.delete('wronged');
      this.channels.delete('miffed');
    }
    switch (event) {
      case 'pet':
      case 'comfort':
        this.trigger('joy');
        this.notePraise();
        break;
      case 'praise':
        this.trigger('joy');
        this.trigger('excited', 0.6);
        this.notePraise();
        break;
      case 'discover':
      case 'landmark':
      case 'greetPlayer':
        this.trigger('excited');
        break;
      case 'craft':
      case 'helped':
      case 'fetch':
        this.trigger('proud');
        this.trigger('excited', 0.5);
        break;
      case 'ignoredWant': {
        this.ignoreTimes.push(this.now);
        this.ignoreTimes = this.ignoreTimes.filter((t) => this.now - t <= IGNORE_WINDOW);
        if (this.ignoreTimes.length >= IGNORE_TIP) {
          this.trigger('wronged');
          this.ignoreTimes = [];
        }
        break;
      }
      case 'startle':
        this.trigger('startled');
        // Startle resolves into curiosity about the thing (ENFP).
        this.trigger('excited', 0.3);
        break;
      case 'rainStart':
        this.raining = true;
        this.trigger('afraid');
        break;
      case 'rainEnd':
        this.raining = false;
        this.touch('afraid'); // release: decay starts counting from here
        break;
      case 'overPraise': {
        // The joy doesn't vanish — it converts: he ducks his head (兴奋过头
        // tipping into 小傲娇's soft edge), so shy must win the face.
        this.trigger('shy');
        const joy = this.channels.get('joy');
        if (joy) joy.intensity *= 0.4;
        break;
      }
    }
  }

  update(dt: number): void {
    this.now += dt;
    for (const [kind, ch] of this.channels) {
      ch.sinceEvent += dt;
      if (kind === 'afraid' && this.raining) {
        // Sustained while the cause persists (and slowly saturating).
        ch.intensity = Math.min(0.9, ch.intensity + dt * 0.01);
        continue;
      }
      const { halfLife } = TUNING[kind as Exclude<EmotionKind, 'neutral'>];
      ch.intensity *= Math.pow(0.5, dt / halfLife);
      if (ch.intensity < THRESHOLD * 0.5) this.channels.delete(kind);
    }
  }

  /** The face Datou wears right now: the strongest channel above threshold. */
  get state(): EmotionState {
    let best: EmotionKind = 'neutral';
    let bestI = THRESHOLD;
    // Startle is an interrupt: it wins while alive regardless of intensity rank.
    const startled = this.channels.get('startled');
    if (startled && startled.intensity >= THRESHOLD) {
      return { kind: 'startled', intensity: startled.intensity };
    }
    for (const [kind, ch] of this.channels) {
      if (ch.intensity > bestI) {
        best = kind;
        bestI = ch.intensity;
      }
    }
    return { kind: best, intensity: best === 'neutral' ? 0 : bestI };
  }

  /** Bible motion grammar: 兴奋类 fast/large/body vs 伤心类 slow/small/face. */
  get grammar(): EmotionGrammar {
    const s = this.state;
    if (s.intensity < 0.25) return null;
    if (BODY_DOMINANT.has(s.kind)) return 'excited';
    if (EXPRESSION_DOMINANT.has(s.kind)) return 'sad';
    return null;
  }

  private trigger(kind: Exclude<EmotionKind, 'neutral'>, scale = 1): void {
    const set = TUNING[kind].set * scale;
    const ch = this.channels.get(kind);
    if (ch) {
      ch.intensity = Math.max(ch.intensity, set);
      ch.sinceEvent = 0;
    } else {
      this.channels.set(kind, { intensity: set, sinceEvent: 0 });
    }
  }

  /** Reset the decay clock without raising intensity. */
  private touch(kind: EmotionKind): void {
    const ch = this.channels.get(kind);
    if (ch) ch.sinceEvent = 0;
  }

  private notePraise(): void {
    this.praiseTimes.push(this.now);
    this.praiseTimes = this.praiseTimes.filter((t) => this.now - t <= PRAISE_WINDOW);
    if (this.praiseTimes.length >= PRAISE_TIP) {
      this.apply('overPraise');
      this.praiseTimes = [];
    }
  }
}

export { NEGATIVE as NEGATIVE_EMOTIONS, THRESHOLD as EMOTION_THRESHOLD };
