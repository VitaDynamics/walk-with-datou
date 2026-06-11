# Workshop Item Identity And Asset Prompt

Use this document as the master prompt and review contract for creating item
assets for _Walk with Datou_.

The pipeline is:

```text
item_name
→ base_design_card
→ 6 variant_design_cards
→ image_generation_prompt
→ image model
→ CLIP/VLM duplicate check
→ keep best 1–3 assets
```

The goal is not to generate many cosmetic variants. The goal is to discover one
strong visual identity for each form.

## Proven Lessons From Catalog Production

These rules come from revising the first large catalog and reviewing rendered
assets together at their real in-game size.

### Metadata Uniqueness Is Not Visual Uniqueness

Different names, descriptions, seeds, dimensions, or drawing instructions can
still produce the same visible object. Judge the render, not the record. Ask
whether neighboring cards differ before reading their labels.

### Random Variation Does Not Create Identity

Small changes in width, height, roof pitch, line wobble, scratches, speckles,
or ornament make variants, not new forms. Hash-driven variation is useful only
after semantic construction has been established.

Identity must come from noun-specific geometry:

- `stilt-house`: raised body, exposed supports, access path;
- `courtyard-house`: separated wings and central void;
- `a-frame-hut`: triangular load-bearing shell;
- `rope-bridge`: sagging deck, suspension lines, open span;
- `watermill`: building mass plus visible working wheel;
- `observatory`: dome plus directional viewing instrument.

### Use A Shape Hierarchy

Successful forms read in this order:

1. **primary mass** establishes the broad category;
2. **secondary structure** establishes topology and construction;
3. **functional signature** identifies the exact form;
4. **surface detail** adds material character without carrying identity.

If layers 2 and 3 are removed, the result must not collapse into every other
member of its family.

### Favor Topology Over Texture

At small scale, an opening, raised body, suspended span, split mass, exposed
frame, wheel, mast, or asymmetric extension distinguishes forms more reliably
than texture. Prefer changing negative space, supports, and load path over
adding decoration.

### Review The Actual Thumbnail Treatment

The first catalog flattened hinted assets into opaque black silhouettes. That
hid doors, frames, braces, windows, and working parts, making different designs
look identical.

Review every candidate in three presentations:

1. normal low-saturation render;
2. low-saturation grayscale render that preserves internal tones;
3. binary outer-contour mask used only for contour comparison.

Do not use the binary mask as the only preview. Interior construction and
negative space are part of identity.

### Compare Families Together

An asset can look distinctive alone and repetitive beside its siblings. Review
contact sheets grouped by `duplicate_group`, with labels hidden for the first
pass. Inspect the actual 64 px card before inspecting the full-resolution
image.

### Detail Must Be Semantic

More detail helped only when it described construction: braces, rails,
openings, shelves, wheels, glazing, stairs, tools, or access points. Random
ticks and surface noise made assets busier without making them clearer.

Use a few bold structural details before any fine material detail.

### Automation Is A Guardrail

Track template uniqueness, detail density, topology diversity, CLIP distance,
and VLM verdicts, but always render a catalog contact sheet. A structurally
unique data object can still be a perceptual duplicate.

## Product And Art Direction

_Walk with Datou_ is a calm companion experience about sharing a miniature
home/lab/tabletop world with an intelligent quadruped robot.

Every item must feel:

- warm, quiet, premium, useful, and physically believable;
- designed for a small shared world rather than a fantasy inventory;
- slightly handmade, with restrained irregularity and material honesty;
- readable beside Datou, whose presence and interactions remain the focus;
- emotionally inviting without becoming childish or overly anthropomorphic.

Visual references are principles rather than assets to copy:

- _Minecraft_: immediate functional readability and constructive logic;
- _Don't Starve_: strong silhouettes and authored object personality;
- _Stardew Valley_: domestic usefulness and cozy daily-life specificity;
- _RimWorld_: purpose visible through construction and working parts;
- _Pokopia_: gentle co-creation and objects that invite companionship.

The project style is a refined hand-drawn cutout:

- single centered object on transparency;
- front or calm three-quarter elevation;
- flat, readable masses with one restrained shade pass;
- subtle ink contour, not a thick cartoon sticker outline;
- low-saturation warm materials;
- sparse details chosen for identity, not decoration;
- no environment scene, UI frame, text label, or dramatic effects.

Use the project palette as the default color language:

```text
paper/off-white: #F5F2EC, #FAF8F3, #ECE7DF
ink:             #3A372F, #5A564B
sage:            #B5C2A2, #94A781, #7C8C7A, #67785F
clay/wood:       #ECDFC9, #DCC3A4, #C2A07C, #9A7E5E
blossom:         #D9B3A0
water/glass:     #9CB4AB, #ABC1B7, #C4D2C4
robot neutral:   #F1EFE6, #DDD9CB, #34373A
amber accent:    #D9A441, used only as a small focal detail
```

No asset may use more than three dominant color families.

## Identity Rules

A form is a distinct object type, not an adjective plus an existing object.

Valid separate forms:

- `rocking-chair` versus `kneeling-chair`: different posture and structure;
- `rain-barrel` versus `pond-basin`: different function and silhouette;
- `beam-bridge` versus `rope-bridge`: different load path and negative space.

Invalid separate forms:

- `simple-chair`, `painted-chair`, `ancient-chair`;
- `common-lamp`, `rare-lamp`, `legendary-lamp`;
- the same silhouette with a new color, ornament, texture, or damage pass.

Material, finish, condition, season, and rarity are variants or metadata. They
do not create a new form unless the object's construction, function, topology,
or interaction changes.

Before accepting a form, answer:

1. What action or use makes it different?
2. What outer contour identifies it at 64 px?
3. What negative space or support layout distinguishes it?
4. What working part explains its function?
5. Which existing form is most similar, and why is this still different?
6. Can a reviewer identify it in a sibling contact sheet without seeing its
   name?

If those answers are weak, merge or delete the form.

Every accepted design must have three readable shape layers:

1. **primary mass**: the overall object category;
2. **secondary structure**: roofline, supports, opening, suspension, wheel,
   frame, or working surface that explains construction;
3. **signature detail**: one functional feature unique to this item.

Test all three layers at 64 px in low-saturation grayscale. Interior detail
must use clear tonal separation and negative space; do not flatten the preview
into one solid mask. Tiny scratches, speckles, and ornaments do not count as
identity.

For forms in the same family, changing only the parameters of one shared body
template is insufficient. Add a semantic construction motif for the noun
itself before applying proportion or material variation.

## Prohibited Directions

Do not generate:

- weapons, armor, combat equipment, traps, cages, punishment devices;
- cyberpunk neon, holographic clutter, glowing rarity auras, magic runes;
- generic medieval/fantasy loot styling;
- toy-like plastic, candy colors, oversized cartoon proportions;
- random gears, pipes, straps, badges, or ornaments without function;
- a background scene, floor, room, pedestal card, UI frame, or text;
- six concepts that differ mainly by color, material, wear, or decoration.

Rarity must never be expressed as louder effects. A rare object may have more
resolved construction, an unusual topology, or a memorable interaction, while
remaining quiet and believable.

## Stage 1: Base Design Card

Input:

```text
ITEM_NAME: "{ITEM_NAME}"
EXISTING_FORMS: {EXISTING_FORMS}
NEAREST_VISUAL_NEIGHBORS: {NEAREST_VISUAL_NEIGHBORS}
```

Create one `base_design_card`. It defines the identity problem before visual
variants are explored.

Return:

```json
{
  "item_name": "rocking-chair",
  "family": "component|furnishing|structure|datou|keepsake|tool",
  "use_context": "where and why it exists in the shared world",
  "companionship_action": "what the player and/or Datou concretely do with it",
  "core_identity": "one sentence defining the object without color or rarity",
  "functional_cues": [
    "visible cue that explains use",
    "visible cue that explains stability or movement"
  ],
  "primary_silhouette": "clear description of the outer contour",
  "secondary_structure": "roofline, supports, frame, opening, suspension, or load path",
  "functional_signature": "one exact working feature unique to this form",
  "negative_space": "important openings, gaps, arches, loops, or space under it",
  "proportions": "flat|compact|upright|tall|wide|low-wide|long-thin|long-wide",
  "construction_logic": "how the object is supported and assembled",
  "material_roles": [
    {
      "role": "load-bearing frame",
      "allowed_materials": ["plank", "driftwood"]
    }
  ],
  "surface_language": "quiet material texture visible at icon scale",
  "signature_features": ["three to five structural features, not color swaps"],
  "intentional_asymmetry": "one restrained asymmetrical feature or 'none required'",
  "world_scale": "size relative to Datou",
  "rarity": "common|uncommon|rare|epic|legendary",
  "duplicate_group": "nearest functional/visual comparison group",
  "nearest_existing_forms": [
    {
      "form": "existing-form-id",
      "difference": "specific structural and functional difference"
    }
  ],
  "thumbnail_plan": {
    "normal_64px_read": "what is recognized first",
    "grayscale_64px_read": "which internal construction remains visible",
    "binary_mask_read": "what the outer contour distinguishes and what it cannot"
  },
  "non_negotiable_identity": ["features every valid variant must retain"],
  "negative_constraints": ["specific ways this item could collapse into a generic neighbor"]
}
```

The base card fails if:

- `core_identity`, `primary_silhouette`, and `functional_cues` could describe
  another existing form unchanged;
- `secondary_structure` is merely a proportion change to a family template;
- `functional_signature` is decorative rather than functional;
- the thumbnail plan depends on color or text for recognition.

## Stage 2: Six Variant Design Cards

Generate exactly six `variant_design_cards` from the base card.

The variants are concept explorations, not six assets to keep. Each must alter
at least three of these structural axes:

1. overall silhouette;
2. support count or load path;
3. topology and negative space;
4. working-part placement;
5. center of mass and proportions;
6. interaction orientation relative to Datou/player;
7. primary-to-secondary mass arrangement.

Color, material, ornament, wear, and rarity do not count as structural axes.

Use six deliberate exploration lenses:

1. **Function First**: clearest possible use and interaction.
2. **Silhouette First**: strongest 64 px outer contour.
3. **Construction First**: most believable joints, support, and assembly.
4. **Companionship First**: strongest shared action with Datou.
5. **Space First**: most distinctive opening, arch, loop, or negative space.
6. **Quiet Signature**: simplest concept with one unforgettable detail.

Return:

```json
{
  "base_design_card": {},
  "variant_design_cards": [
    {
      "variant_id": "function-first",
      "design_thesis": "one sentence",
      "silhouette": "specific contour",
      "primary_mass": "dominant category-defining mass",
      "secondary_structure": "distinct construction motif",
      "functional_signature": "exact form-specific working feature",
      "proportions": "specific dimensions and mass distribution",
      "support_and_topology": "legs, frame, suspension, openings, load path",
      "functional_layout": "where working parts sit and why",
      "negative_space": "specific readable gaps",
      "interaction_orientation": "how Datou/player approaches or uses it",
      "materials": ["two to four visible materials"],
      "surface_treatment": "quiet, scale-readable texture",
      "palette": ["three to six exact low-saturation colors"],
      "signature_features": ["three to five concrete structural features"],
      "difference_from_base_neighbors": "why this is not a duplicate",
      "three_structural_differences": [
        "difference from nearest neighbor 1",
        "difference from nearest neighbor 2",
        "difference from nearest neighbor 3"
      ],
      "thumbnail_read": {
        "normal": "recognition at 64 px",
        "grayscale": "preserved internal structure",
        "binary_mask": "outer-contour distinction"
      },
      "risk": "what may fail at 64 px",
      "negative_constraints": ["variant-specific avoidances"]
    }
  ]
}
```

Reject and regenerate the batch if:

- fewer than six variants are present;
- two variants share the same silhouette and support topology;
- a variant can be described as only a material/color/ornament change;
- a variant loses the non-negotiable identity from the base card;
- the secondary structure or signature detail disappears in a 64 px grayscale
  preview;
- the three structural differences mention color, material, texture, wear, or
  minor dimensions;
- labels must be read before sibling variants can be distinguished.

## Stage 3: Image Generation Prompt

Compile one image prompt per variant. Do not ask the image model to invent the
identity again; give it the resolved design card.

Template:

```text
Create one isolated 2D game asset for Walk with Datou: {item_name},
variant {variant_id}.

Identity: {design_thesis}.
Primary mass and silhouette: {primary_mass}; {silhouette}.
Secondary construction motif: {secondary_structure}.
Exact functional signature: {functional_signature}.
Proportions and center of mass: {proportions}.
Construction: {support_and_topology}.
Functional layout: {functional_layout}.
Important negative space: {negative_space}.
Datou/player interaction orientation: {interaction_orientation}.
Visible materials: {materials}.
Surface treatment: {surface_treatment}.
Palette: {palette}.
Mandatory signature features: {signature_features}.

Art direction: calm premium companion-robot world, refined handmade cutout,
front or gentle three-quarter elevation, flat readable masses, one restrained
shade pass, subtle warm ink contour, low saturation, physically believable,
clear at 64 px, designed rather than generated. Preserve separation between
the primary mass, secondary structure, and functional signature in grayscale.
Prioritize meaningful openings, supports, load paths, and working parts over
surface decoration.

Output requirements: exactly one complete centered object, transparent
background, no floor plane, no environment, no text, no UI card, no border,
no drop-shadow halo, no rarity glow, no dramatic perspective, no extra props,
no cropped parts.

Avoid: {negative_constraints}.
```

Recommended image-model settings:

- transparent PNG if supported;
- square 1024×1024 working image;
- one object only;
- low-to-medium stylization;
- fixed seed recorded in metadata;
- generate 2 candidates per variant, for 12 initial images.

## Stage 4: Image Model Output Contract

Each candidate must be saved with:

```json
{
  "item_name": "rocking-chair",
  "variant_id": "space-first",
  "candidate_id": "space-first-02",
  "model": "model/version",
  "seed": 12345,
  "prompt_hash": "sha256",
  "asset_path": "items/rocking-chair/space-first-02.png"
}
```

Immediately reject candidates with:

- background residue or multiple objects;
- cropped silhouette;
- unreadable function at 64 px;
- prohibited style;
- missing mandatory signature features;
- internal construction that disappears in low-saturation grayscale;
- detail that consists mainly of scratches, speckles, trim, or ornaments;
- a family-default body with only dimensions or roof pitch changed.

## Stage 5: CLIP/VLM Duplicate Check

Run duplicate checks against:

1. all candidates for the same item;
2. retained assets in the same `duplicate_group`;
3. the nearest visual neighbors named in the base card;
4. the complete retained catalog as a final pass.

### CLIP Pass

Use transparent-background-normalized renders on the same neutral matte for
embedding comparison.

Suggested starting thresholds, calibrated per embedding model:

- cosine similarity `>= 0.90`: automatic near-duplicate rejection;
- `0.84–0.90`: send to VLM adjudication;
- `< 0.84`: normally distinct, still subject to identity review.

Also compare 64 px silhouettes using a binary-mask embedding or shape metric.
A low full-image similarity does not save two assets with the same silhouette.
The reverse is also important: do not reject a candidate solely because its
binary mask is similar when its preserved internal topology and functional
signature are clearly different.

### VLM Adjudication

Show the candidate beside its nearest five CLIP neighbors and ask:

```text
Judge visual identity, not polish.

1. Are these the same object design with only color, material, ornament, wear,
   camera, or minor proportion changes?
2. Do they share the same outer silhouette and support topology?
3. Is the candidate's function distinguishable at 64 px?
4. Name the three strongest structural differences.
5. Which differences survive in a low-saturation 64 px grayscale preview?
6. Would the verdict change if all labels were hidden?
7. Verdict: DISTINCT, BORDERLINE, or DUPLICATE.
```

Rules:

- `DUPLICATE`: reject.
- `BORDERLINE`: keep only if human review can state three structural
  differences without mentioning color/material.
- `DISTINCT`: continue to scoring.

Store the nearest-neighbor IDs, CLIP scores, VLM verdict, and rationale.

### Contact-Sheet Pass

After pairwise checks, render every surviving candidate beside its complete
`duplicate_group`:

- use the exact in-game card dimensions and image treatment;
- show normal, grayscale, and binary-mask sheets;
- hide labels during the first review;
- sort nearest visual neighbors next to one another;
- reject repeated default bodies even when pairwise scores are below threshold.

Run this pass once after candidate generation and again after final selection.

## Stage 6: Keep Best 1–3 Assets

Score surviving candidates:

| Criterion                       | Weight |
| ------------------------------- | -----: |
| unique identity versus catalog  |     30 |
| silhouette readability at 64 px |     20 |
| visible function/construction   |     20 |
| project art-direction fit       |     15 |
| companionship relevance         |     10 |
| technical cleanliness           |      5 |

Selection rules:

- keep one asset when one concept is clearly strongest;
- keep two or three only when each has a structurally distinct, useful role;
- never keep extra assets merely to fill a quota;
- variants kept for one form must not become separate forms unless their
  function and identity genuinely diverge;
- mark one asset `primary`; others are optional approved alternates.
- prefer a simpler asset with clear semantic structure over a busier asset
  whose differences are decorative;
- no retained asset may rely on its label to distinguish it from siblings.

Final manifest:

```json
{
  "item_name": "rocking-chair",
  "base_design_card": {},
  "kept_assets": [
    {
      "candidate_id": "space-first-02",
      "role": "primary",
      "score": 91,
      "clip_nearest": [{ "asset_id": "reading-chair-primary", "similarity": 0.81 }],
      "vlm_verdict": "DISTINCT",
      "selection_reason": "recognizable curved runners and open lower arc"
    }
  ],
  "rejected_assets": [
    {
      "candidate_id": "quiet-signature-01",
      "reason": "duplicates reading-chair support topology"
    }
  ]
}
```

## Catalog-Wide Review

Before merging a batch:

- no form ID is adjective + existing form;
- every form has a distinct companionship or world function;
- every retained primary has a readable silhouette at 64 px;
- each duplicate group has meaningful topology diversity;
- sibling contact sheets are readable with labels hidden;
- normal and grayscale previews preserve secondary structure and working parts;
- binary masks are used as one signal, not the complete identity test;
- detail density comes from construction rather than random surface noise;
- no two primary assets survive solely because their colors differ;
- all prompts, seeds, model versions, scores, and rejection reasons are stored;
- the batch makes the world feel more intentional, not merely more populated.
