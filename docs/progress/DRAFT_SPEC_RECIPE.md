# Draft Spec as a Recipe

Status: locked 2026-10-24. Base commit: `9b6f9da92`.

## Objective

The draft spec is the recipe a draft generates a plan from; it plays no part in
plan legality or execution. Decode it tolerantly so adding a draft option or
changing one's meaning needs no schema revision, no execution-fixture or
checkpoint change and no equivalence rewrite. The rest of the project stays
strict.

## Model

1. **Tolerant decoding of the whole spec.** Read what is present, heal it, drop
   what cannot be used, default what is missing:
   - unknown top-level keys are dropped;
   - an unknown god, trait, story or field NPC, or keepsake is dropped, as is an
     entry under an unknown biome; duplicates collapse to their first
     occurrence;
   - a field of the wrong type takes its default (empty list or record, option
     default, seed 1);
   - a number outside its range clamps; `resourceRoomChance` rounds to its step;
     a seed outside 0..`MAX_DRAFT_SEED` takes 1;
   - an option equal to its default is not stored, as today.

   Records still save in catalog biome order and entries for biomes off the
   itinerary are kept. Basket legality (per-god cap, prerequisites, order) stays
   a draft-time refusal, never a decode error. The same decoder serves the
   project codec, `ReplaceDraftSpec` and share codes.

2. **Option declarations.** One engine table declares each Advanced option: key,
   kind (bounded integer with optional step, flag stored only when on, or
   choice), default, and share-code tag. `godBoonsByBiome` is a per-biome kind
   whose default comes from `defaultDraftGodBoons`; `perGodCap`'s default takes
   the Denial context as today. The table carries no labels.
3. **Table-driven helpers.** One setter replaces `withDraftPerGodCap`,
   `withDraftPursueTartarusGoal`, `withDraftRoomForcing`,
   `withDraftPurchasesPerBiome`, `withDraftRetriesPerBiome`,
   `withDraftResourceRoomChance` and `withDraftPreferMidshops`;
   `withDraftGodBoons` stays as the per-biome setter. Equality,
   `draftAdvancedChanged` and `withDraftAdvancedDefaults` read the table; the
   separate `DRAFT_*_RANGE` / `DEFAULT_DRAFT_*` constants and `ADVANCED_KEYS` go.
4. **Share code layout 3.** The loadout and the draft world (gods, basket,
   story NPCs, field NPCs, racks, seed) stay positional. The stored Advanced
   options follow as tagged entries: a count, then per entry the option's tag,
   a payload length and the payload. A reader skips an unknown tag, so a later
   option (a Duo host map, say) is a new tag, not a layout bump; decoded values
   pass the tolerant decoder. Option ranges and choices leave the fingerprint;
   the catalog key lists stay. Layout 2 codes are refused as from an older
   planner; no reader is kept.
5. **No schema revision.** Decoding only accepts more, no new key is written and
   the plan wire is unchanged. Projects encode byte-identically.

## Ownership

- **Planner engine** (`authored-project/draft-spec.ts`,
  `authored-project/draft-share-code.ts`, the package index): declarations,
  tolerant decoder, setters, equality, Advanced helpers, layout 3.
- **Planner application** (`ui/shell/RouteDraftPanel.tsx`,
  `projections/draftSpec.ts`): the hand-built controls stay; they read range
  and default from the declaration and call the shared setter. No visible
  change.

## Gates

1. **Engine:** model items 1–5. `draft-spec.test.ts` owns the healing matrix
   (flip strict-refusal cases to healing); `draft-share-code.test.ts` owns
   layout 3, unknown-tag skipping and layout-2 refusal; command tests that
   expected a `ReplaceDraftSpec` refusal for bad entries now expect healing.
   Lanes: `test:engine`; `test:draft-corpus` reports no deltas.
2. **Application:** panel and projection on the declarations. Lanes:
   `test:planner`.
3. **Closure:** revise the draft spec paragraph in
   `docs/design/AUTHORED_PROJECT_MODEL.md` (tolerant, recipe, not exact) and
   "Draft share codes" in `docs/design/SIMULATION_AND_VALIDATION.md`; delete
   this plan.

## Non-goals

- Making any other part of the project tolerant.
- Decoupling the plan wire version from the project revision.
- Duo hosts.
- Equivalence or execution-fixture changes; neither lane is touched.
