# Project Design Baseline — BINDING

**Status:** Authoritative. This is the highest-priority design document in the
repo. Every screen, scene, component, asset, animation, and feature MUST obey it.
Where any other doc (ENVIRONMENT_DESIGN, GAMEPLAY_DESIGN, INTERACTION_VERBS,
ASSET_CATALOG, ROADMAP…) conflicts with this baseline, **this baseline wins** and
the other doc is to be revised toward it.

**If a change would violate any rule here, redesign the change before shipping it.**

---

## What we are building

A **front-end companion game for a quadruped robot** — a calm, premium, emotionally
engaging experience whose goal is to make the user *want to spend time with the
robot*. It is built around: human companionship, scene exploration, long-term
bonding, mutual understanding, personality differentiation, emotional feedback,
and daily micro-interactions.

It should feel like a blend of: a modern intelligent-hardware companion app · a
miniature interactive world · a soft exploration game · a digital pet with
emotional depth · a premium consumer-robotics interface.

**It is NOT:** a traditional browser mini-game, a Flash-style web game, a generic
dashboard, or an action game. This is a **low-pressure companionship game**.

## Core experience direction

The robot is **not a controllable character — it is a living companion** that
observes, responds, remembers, explores, and gradually develops a unique
personality. The product must feel **calm, premium, warm, intelligent, and
emotionally engaging.**

Encourage: checking in with the robot · watching it explore · responding to its
emotional state · building trust and familiarity · discovering small
environmental events · noticing personality changes over time · spending time
without pressure.

---

## Art direction

Premium consumer electronics · warm futuristic · minimal but emotionally rich ·
soft, quiet, refined · clean spatial composition · high-end companion-robot
product aesthetic. **More Apple Vision Pro / Nothing OS / Teenage Engineering /
Tesla app than a traditional web game.**

References: Apple Vision Pro onboarding · Nothing OS widgets · Tesla app vehicle
controls · Teenage Engineering interfaces · Nintendo Switch system UI · Alto's
Adventure · Monument Valley · Stray · Neko Atsume · Tamagotchi (but premium &
modern).

The visual language must communicate: companionship, curiosity, warm technology,
soft intelligence, trust, calmness, exploration, emotional growth.

## World direction

**Strongest direction: a warm robotics lab combined with a miniature exploration
world** — the robot is a small intelligent companion living in a carefully
designed physical space. Acceptable environments:

1. **Warm robotics lab** — soft beige/off-white background, wooden or matte
   technical table, small testing objects, soft sunlight/warm area light, calm
   premium atmosphere.
2. **Future home interior** — sofa, carpet, window light, subtle smart-home
   feeling; the robot explores the user's living space.
3. **Miniature tabletop world** — small ramps, tunnels, blocks, plants, sensors;
   exploration zones; discoverable objects; robot-scale environmental storytelling.
4. **Robot inner emotional space** — abstract emotional landscape, soft particles,
   mood islands, personality-growth visualization. **Only** when representing mood,
   memory, or personality.

**Do NOT build:** a cyberpunk city, a generic sci-fi arena, or a noisy RPG-style
game map.

> **Migration note (the existing "park" world):** the current 500×500 m flat
> green park, the GLB scatter catalog, and the large-world exploration framing
> predate this baseline and are **off-direction**. New work moves toward an
> intimate, premium, robot-scale space (lab / tabletop / home), not a bigger
> park. Do not invest further in scaling the park; redirect toward the baseline.

---

## Visual principles (always)

1. The robot is the **main character and primary visual focus**.
2. Every screen has **one clear focal point**.
3. Use **large negative space**.
4. Use **soft shadows and real spatial depth**.
5. Prefer **quiet materials** over decorative effects.
6. Prefer **believable lighting** over excessive effects.
7. Use **restrained motion**.
8. UI must feel like a **premium companion app, not a game HUD**.
9. Avoid visual clutter.
10. Modernity comes from **composition, spacing, typography, material, and
    motion — not neon effects**.

**The interface should feel designed, not generated.**

## Strict visual prohibitions (never)

20-year-old Flash style · 4399-style browser-game aesthetics · cheap mobile-game
HUD · cyberpunk neon panels · excessive purple-blue gradients · random glowing
borders · heavy outlines · over-saturated colors · cartoonish oversized buttons ·
fake sci-fi dashboards · random particle effects · rotating logos · cluttered
floating icons · RPG inventory-like UI · low-quality clipart icons · generic game
menu screens · overcrowded 3D scenes · random emissive materials · loud bloom ·
toy-like plastic look (unless intentionally subtle).

**If any of these appear, redesign the visual direction before adding features.**

---

## Color system

Calm, warm, low-saturation. The base palette (use these tokens):

```ts
export const theme = {
  colors: {
    background: '#F5F2EC',
    backgroundSoft: '#FAF8F3',
    surface: 'rgba(255, 255, 255, 0.72)',
    surfaceStrong: '#FFFFFF',
    surfaceMuted: '#ECE7DF',

    textPrimary: '#1D1D1F',
    textSecondary: '#6E6E73',
    textTertiary: '#9A9A9E',

    accent: '#7C8C7A',
    accentSoft: '#DDE5D8',
    accentWarm: '#D6BFA7',
    accentWarmSoft: '#EFE2D2',

    success: '#7BAE7F',
    warning: '#D9A441',
    danger: '#D96C6C',

    robotDark: '#2A2D2E',
    robotLight: '#F1F1EE',
    robotEye: '#111111',
  },
  radius: { small: '14px', medium: '20px', card: '28px', large: '36px', pill: '999px' },
  shadow: {
    soft: '0 24px 80px rgba(0,0,0,0.08)',
    card: '0 12px 40px rgba(0,0,0,0.06)',
    floating: '0 32px 100px rgba(0,0,0,0.12)',
  },
  motion: { fast: '160ms', normal: '280ms', slow: '600ms', breathing: '2400ms' },
};
```

**No screen may show more than three dominant colors.**

## Typography

Premium, calm, readable. Clean sans-serif · clear hierarchy · generous spacing ·
large-but-not-childish headings · small refined metadata text. **Avoid:**
game/display/cartoon fonts, heavy outlines, glow, too many weights, dense
paragraphs in the game UI. Typography should feel like a modern product interface.

---

## UI design rules

The UI is a **companion-robot control & relationship interface.** Components may
include: robot status card · mood indicator · trust/bond meter · personality
profile · exploration log · daily interaction prompt · memory fragments · scene
discovery panel · soft action buttons · robot thought bubble · minimal event
timeline.

Behavior: cards soft/glass-like/spatial · buttons rounded/tactile/quiet · motion
subtle & responsive · **avoid large HUD overlays** · UI must not cover the robot
unnecessarily · UI supports emotional clarity, not visual noise. Prefer:
glassmorphism (carefully) · soft shadows · matte surfaces · rounded geometry ·
clean spacing · calm hierarchy · small emotional details · gentle transitions.

## 3D scene rules

≤ **5 major objects** per scene · robot is the visual anchor · soft ambient light ·
one clear key light · contact shadows · PBR materials when possible ·
low-saturation materials · avoid excessive emissive · avoid random sci-fi
decorations · calm, intentional camera. Recommended elements: tabletop surface,
small ramp, soft sensor pad, minimal plant, small cube/exploration object, warm
lamp, glass/matte-acrylic object, subtle background depth. **Avoid:** floating
neon rings, sci-fi grid floors, holograms, glowing panels, busy city backgrounds,
cheap low-poly clutter, cartoonish props, fake futuristic control rooms.

## Lighting rules

Lighting matters more than decoration. Use: soft environment light · warm key
light · subtle fill · contact shadows · AO if available · smooth material
response. **Avoid:** multiple random colored lights, neon rim lights, harsh
shadows, overexposed bloom, flicker, pure-black backgrounds (unless intentional).
Lighting should make the robot feel physically present.

## Motion design rules

Motion communicates life, emotion, presence. Use: slow breathing animation ·
subtle idle movement · gentle gaze shifts · small body-weight shifts · smooth
camera easing · soft UI transitions · hover/tap micro-interactions · calm progress
changes. **Avoid:** fast bouncing, elastic UI, spinning objects, flashing,
shaking, excessive particles, arcade animations. Motion makes the robot feel
alive, not noisy.

---

## Gameplay direction (companionship, not action)

Long-term engagement through companionship. Core loops:

1. **Daily check-in** — open the game → robot mood, energy, curiosity, trust,
   recent discovery, suggested interaction. Builds a check-in habit.
2. **Exploration** — robot explores a small scene, discovers objects/sounds/
   places/memories/changes. Calm and rewarding.
3. **Bonding** — call it, guide it, praise it, help it choose, respond to its
   mood, complete small rituals. Trust grows gradually.
4. **Personality differentiation** — behavior changes over time from interaction.
   Traits (curious/cautious/playful/loyal/independent/quiet/energetic/sensitive)
   affect movement style, exploration preference, response tone, idle behavior,
   choice of discoveries, emotional reactions.
5. **Memory** — remember important moments (first discovery, frequent choices,
   overcoming a path, mood across days, special events) shown as **small,
   beautiful fragments, not long logs**.

## Emotional design

Emotionally legible without becoming overly human. Expression comes from: eye
shape · body posture · movement rhythm · distance from user · idle behavior ·
reaction timing · subtle sound/visual pulse · UI mood indicators. **Do not rely on
big cartoon faces or exaggerated expressions** — subtle, robotic, companion-like.
Examples: Curious = head tilt, slow approach, focused gaze · Happy = lighter
steps, soft eye arc, closer distance · Tired = slower motion, lower posture,
dimmer UI pulse · Cautious = stops before the unknown, looks back · Trusting =
follows guidance faster · Independent = explores side areas unprompted.

## Interaction style

Simple · tactile · emotionally meaningful · low-pressure · repeatable · slightly
different each time. Prefer: tap-to-call · drag-to-guide-attention ·
hold-to-comfort · swipe-to-suggest-direction · choose between two exploration
options · place small objects · unlock environmental changes through bonding.
**Avoid:** combat controls, heavy resource systems, quest spam, overloaded menus,
reward popups everywhere, arcade scores. The user spends time with a companion,
not grinding a game.

---

## Implementation philosophy

Do **not** build everything at once. Controlled phases: (1) visual shell →
(2) robot status system → (3) one beautiful scene → (4) one meaningful interaction
→ (5) one exploration event → (6) one bonding mechanic → (7) one personality
variable → **polish before expanding**. Every new feature must preserve the
visual and emotional direction. **If a feature makes the product feel cheaper,
simpler, or more cluttered, redesign it.**

## Development workflow (do not skip)

**Before writing code**, state: design goal · layout structure · visual hierarchy ·
color usage · motion strategy · how it avoids cheap game aesthetics · how it
supports robot companionship.

**After writing code**, report: visual QA result · whether any prohibited pattern
appeared · what changed · what still needs polish · whether it stays consistent
with this baseline.

## Visual QA checklist (gate before finalizing any screen/component)

- One clear visual focus?
- Robot visually prioritized?
- Three or fewer dominant colors?
- No cheap neon / random glow?
- Feels like a modern companion app (not a game HUD)?
- Scene physically grounded?
- Shadows and spacing refined?
- Layout calm and readable?
- Animations subtle and meaningful?
- Free of Flash-game aesthetics?
- Robot's emotional state understandable?
- **Does this make the user want to spend more time with the robot?**

If any item fails, **polish before adding functionality.**
