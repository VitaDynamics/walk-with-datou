# Roadmap

Two-week sprints. Each sprint must end with a playable demo and a tight scope.

## Sprint 0 - Hello Datou (current)

**Goal:** Open a tab, see a virtual park, walk around, see Datou wandering. Click to pet.

- [x] Vite + TypeScript + Three.js scaffold
- [x] Park scene (ground, trees, path, home post)
- [x] Player avatar + WASD movement + follow camera
- [x] Datou placeholder (low-poly box-dog) wandering
- [x] Click-to-pet interaction
- [x] HUD with mood indicator
- [x] `PhysicsAdapter` interface so MuJoCo can plug in later

**Done condition:** A team member opens the dev server, walks for 2 minutes, says
"yeah, the dog feels like it's there."

## Sprint 1 - Follow + Mood

**Goal:** Spend 3 minutes with Datou and not get bored.

- [ ] Follow mode: Datou steers toward the player when in range
- [ ] Mood state machine: `happy / calm / curious / tired` (4 states, no numbers shown)
- [ ] Per-mood idle animations and SFX hooks
- [ ] First user test (n = 3-5): "does the dog feel like it has emotions?"

**Gate to Sprint 2:** At least 2/3 testers spontaneously say the dog has emotions.

## Sprint 2 - Explore + Daily ritual

**Goal:** A reason to come back tomorrow.

- [ ] Explore mode: Datou auto-selects a path; player follows or watches
- [ ] Procedural POI generation (1-2 per session, from a 30-template library)
- [ ] Datou reacts at POIs (stops, sniffs, barks)
- [ ] **Daily gate:** explore mode runs once per real-world day
- [ ] D1 retention check (small internal cohort)

## Sprint 3 - Diary + Bond

**Goal:** "My Datou is different from yours."

- [ ] LLM-generated daily diary (Claude Haiku / GPT-4o-mini)
- [ ] Diary archive page
- [ ] Single `bond` metric, all four modes contribute
- [ ] Bond unlocks small idle habits (e.g., Datou lies down at your feet at 50 bond)

## Sprint 4 - Personality drift

**Goal:** Two users playing a week have noticeably different Datous.

- [ ] Two archetypes: Adventurer (favors exploration) and Cuddler (favors proximity)
- [ ] 7-day rolling window drives drift - no instant switches
- [ ] Personality affects POI selection and idle behavior

## Sprint 5 - Public beta

- [ ] Telemetry (PostHog free tier)
- [ ] Vercel / Cloudflare Pages deploy
- [ ] 50-100 seed users; collect D1 / D7 retention and qualitative feedback

## Out of scope (deferred)

- Voice STT / TTS - Sprint 6+
- Multiplayer - Sprint 7+
- Real-world tie-in (donations, etc.) - Sprint 8+
- Mobile / touch controls - undecided
