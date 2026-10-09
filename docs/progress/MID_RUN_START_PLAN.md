# Mid-run start plan

Status: locked. Base commit: `9c7e7c712`. No authored schema bump: run modifiers
are the tolerant record (`AUTHORED_PROJECT_MODEL.md`, run modifiers). Evidence:
`docs/investigations/MID_RUN_START.md`.

## Objective

A run modifier starts the published run at a later biome's Opening or at a
biome's Preboss. The game module installs the planner's state at that point
into a fresh native run, creates the start room, and the plan drives the run
from there as usual. The run is not recorded in the save's run history.

## Scope

- Start points: the Opening (Intro) of any biome after the first, or any
  biome's Preboss, on Underworld, Surface and Dream routes.
- Excluded: starts inside a biome (Hub, Clockwork, Ship, Fields interior), the
  first biome's Opening (a normal run), and reconstructing full native room
  records.

## Source facts and planner simplifications

- Source facts are in the investigation's Evidence section.
- Simplifications chosen by the owner:
  - **Known state is forced.** The planner's exact state at the start point is
    installed, including progress counters such as the Centaur tick.
  - **Unknown state starts fresh or full:**
    - timers, armor and pools;
    - spell charges (including bonus uses) and rerolls;
    - Personal Loan stored gold, Last Gasp eligibility and the last Challenge
      depth.
  - **Max health and Magick:** one hidden native pickup trait per planner
    source carries its flat amount; Silver Wheel stays its own source-tagged
    trait. The game validates the maxima, and current health is set to max.
  - **Death Defiance:** assigned by the game from equipped sources; Athena and
    the Circe familiar multiplier add theirs explicitly. Every charge starts
    unused.
  - **Gold:** a numeric field on the start point, defaulting to native starting
    gold.
  - **Room history:** one stub `RoomHistory` record per planned room (`Name`,
    plus `NextRoomSet` on Openings and Postbosses). Run-wide records the planner
    holds exactly are installed; per-room recency records are not.
  - **After a mismatch:** execution goes passive and the run continues natively.
  - **Tight Deadline:** a Preboss start grants the biome's full allowance.
  - **Weather:** whatever the native path produces.
  - **Reward bags:** included only where exact across branches.
  - **Records:** the lifecycle is native. The only record change is removing the
    run from `RunHistory`; clear-time and depth records still write.

## Ownership

- **Catalog:** no new facts expected. Gate 1 confirms the Moon Beam effect kind
  and the Traces of Spirit max-stat path.
- **Engine:**
  - folds: Hera boost and supercharge target (`UpgradedTraitName`), Icarus slot
    boost (`SelectedTrait`);
  - capture of a Preboss start state at the start room's `roomPrepared`
    received state, for every Preboss in every simulation;
  - reuse of the predecessor's terminal branches for an Opening;
  - a pure start-installation projection over the captured states:
    - run-wide families must agree, or the start point is unavailable;
    - biome-local records in post-reset form;
    - bags only where exact;
    - route-derived entered biomes, visit order and the Dream visited prefix;
  - run-modifier declarations for the start point and gold, and an eligibility
    query: valid project, biome on the itinerary, not the first biome's
    Opening, and start state available;
  - the execution plan's optional `startState` section: assembly, codec,
    fingerprint, graph validation.
- **Planner app and UI:**
  - start-point and gold controls in run modifiers;
  - the eligibility result presented as a finding-free disabled state with its
    reason in the Game panel's publish gate.

  React holds no policy.

- **Game module:**
  - **Decoding and start:** strict decoding of `startState`. In the
    `StartNewRun` wrap: start room override, stub history and run overrides,
    and dropping `FromLoot` on the keepsake equip.
  - **Install:** at the start room's creation:
    - traits through `GetProcessedTraitData` and `AddTraitToHero` without
      `FromLoot`;
    - acquire results from the plan, including Premium Service's Perfect
      aspect, the Cherished Heirloom keepsake rank and the Circe and Barren
      Arcana and Fear results;
    - trait-local fields, max-stat traits, Death Defiance additions, gold;
    - biome records for a Preboss, then `RunShopGeneration`;
    - forced first-room hero setup.
  - **Plan cursor and self-check:** `route.newAt` cursor, and `admission.verify`
    plus a max-stats self-check, with a mismatch making execution passive.
  - **Dream:** entry overrides.
  - **Records:** removing the run from `RunHistory`.

## Gates

1. **Engine folds.**
   - Fold `UpgradedTraitName` and `SelectedTrait` onto `EquippedTrait`; equivalence
     must be unchanged.
   - Confirm Moon Beam, the Traces of Spirit max-stat path and whether the start
     room's `roomPrepared` effects (Fields optional-reward counts) belong in the
     product.
2. **Engine capture and projection.**
   - Preboss capture, Opening hand-off, the start-installation product and
     per-start-point availability.
   - The Preboss capture already includes the start room's creation effects
     (encounter record, offer-time reward and bag effects). Native `CreateRoom`
     repeats them, so the product marks which run-wide records the install
     writes after creation.
   - Intended equivalence baseline rewrite for the always-on Preboss capture.
   - `npm run test:performance:compare` must pass; the capture must not add
     measurable rebuild or edit cost.
3. **Run modifiers and eligibility.**
   - Start point and gold declarations; engine eligibility; planner controls and
     publish-gate presentation.
   - Owner inspects the UI before review.
4. **Execution plan.**
   - `startState` section, assembly, codec, fingerprint, graph validation.
   - New fixtures for Opening, Preboss and Dream. Existing fixtures must not
     change.
   - Amend `GAME_INTEGRATION_BOUNDARY.md` for the new mid-run attachment.
   - Fresh independent reviewer, since the protocol changes.
5. **Game module, Opening.**
   - Decoder, `StartNewRun` and `CreateRoom` install, cursor, self-check,
     `RunHistory` removal, Dream entry.
   - Lua tests and the `docs/testing/` checklist.
6. **Game module, Preboss.**
   - Current-biome records, Clockwork completion, `RunShopGeneration`, Tight
     Deadline allowance.
   - Checklist items.

Each gate is one commit and closes with `npm run check`. The plan closes by
deleting this document and the investigation, after promoting durable facts to
the audits and design documents.

## Tests

- Engine:
  - folds and capture beside their seams;
  - the projection matrix (agreement, unavailability, bags, Dream prefix) in
    one primary owner;
  - eligibility beside the run-modifier declarations.
- Execution: codec and fixtures under `test/execution-plan`.
- Planner: run-modifier binding and one UI witness.
- Game module:
  - Lua tests over the new fixtures for decode, install order, cursor,
    self-check and record removal;
  - live acceptance in `docs/testing/`.

## Non-goals

- Starts inside a biome.
- Full native room records, dialogue and recency caches.
- Modelling gold, armor, timers or pools.
- Suppressing writes made during play, or achievements.
