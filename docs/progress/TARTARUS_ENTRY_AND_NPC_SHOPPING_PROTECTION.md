# Tartarus entry identity and NPC shopping protection

## Status and objective

Draft for owner review, 2026-09-25. Implementation has not started.
Planner base: `8841c8b8`; executor base: `61818e7`.

Correct three confirmed gaps:

1. Tartarus Combat at `biomeEncounterDepth === 1` resolves to the appropriate
   Standard/Small Chronos-intro identity and its generated-composition policy.
2. Native Nemesis shopping cannot invalidate a later planned Nemesis encounter.
3. Native Heracles shopping cannot invalidate a later planned Heracles encounter.

These are two focused delivery slices, not a general NPC/event redesign.
Keep native behavior outside the protected windows. The planner derives the
windows; the executor consumes them without scanning ahead through the plan.

## Source facts and supported assumptions

Source root: `/home/ayyatma/wsl-projects/modding/1GameData/Scripts`.

| Fact                         | Source and consequence                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recurring first I combat     | `EncounterData_Generated.lua`, `GeneratedIChronosIntro` and `GeneratedI_SmallChronosIntro`: `AlwaysForce`, `BiomeEncounterDepth == 1`, completed `ClockworkIntro`. These are not the one-time tutorial encounter. The planner retains its mature-save assumption.                                                                                         |
| Variant-specific generation  | Standard intro inherits `GeneratedI` and overrides `DifficultyModifier = 85`; Small intro inherits `GeneratedI_Small`. Both clear the inherited reward exclusion and disable pre-spawning. Do not copy the Standard modifier into Small or treat these as presentation-only aliases.                                                                      |
| Native presentation          | Both definitions carry the speaking presentation and unthreaded wait. Publish the proper identity and let native encounter execution run those events; no new dialogue or delay hook.                                                                                                                                                                     |
| Nemesis shopping history     | `StoreLogic.lua:CheckNemesisShoppingEvent` writes `eventSource.NemesisShopping` and `CurrentRun.NemesisShopped` before starting the shopping thread. `RequirementsData.lua:NoRecentNemesisEncounter` rejects a true encounter shopping flag in `SumPrevRooms = 12`.                                                                                       |
| Heracles shopping history    | The corresponding function writes `HeraclesShopping`/`HeraclesShopped`; `NoRecentHeraclesEncounter` uses `SumPrevRooms = 10`.                                                                                                                                                                                                                             |
| Exact lookback               | `RequirementsLogic.lua:SumPrevRooms` reads CurrentRoom, then RoomHistory backwards. At ordinary outgoing encounter preparation, `RoomLogic.lua:LeaveRoom` has already appended the departing room, so it appears twice. The existing planner preparation contact already accounts for this. A window is not N distinct selected occurrences or N combats. |
| Native shopping availability | `EncounterData_Unique.lua:Shop.StartRoomUnthreadedEvents` limits Nemesis to F/G/H/I, Heracles to N/O/P, and excludes both during Dream runs. Preserve those native checks; no planner-side replay of their chance, dialogue or save-progression predicates.                                                                                               |

The identity rule is exactly `biomeEncounterDepth === 1`, not “the first room
whose name looks like I_Combat”. The planner already initializes this counter
to 1 through the biome declaration and `biomeStarted`; no counter translation
or timing correction is needed. Presentation, delay and their interaction with
skipping remain native responsibilities. Existing Fig Leaf handling is unchanged
and is not an input to this identity mapping.

## Ownership and implementation contract

### A. Tartarus first-combat identity

Keep the existing authored Combat keys, room-driven Standard/Small choice and
editor label. No new user choice or persisted intro flag.

- Catalog owns both concrete intro definitions, exact generated policies and
  the declared first-combat mapping on the existing I Combat profiles.
- Engine encounter preparation resolves that mapping when its reached
  `biomeEncounterDepth === 1`, before the ordinary reward-context mapping.
  Later combat continues to use the current ordinary/Goal/Devotion resolution.
- Extend the narrow normalized resolution contract and its compiler/validators
  as needed; do not hard-code I room names in React, export or Lua. Retained
  materialization must not guess depth before preparation is reached.
- Candidate assessment, selected validation, customization and execution export
  consume the same resolved definition. Retained customization stays authored;
  changed support produces normal findings rather than silently resetting it.
- Executor uses its existing concrete-encounter admission/installation path.
  No new presentation, delay or Fig Leaf hook, suppression or obligation.

Starting files: catalog `declarations/encounters/i.ts`,
`declarations/encounters/generated/policies.ts`, compiler `encounters/`;
engine `catalog-schema/index.ts`, `simulation/encounters/resolve.ts`,
`preparation.ts`, and `generation-preparation.ts`.

### B. Planner-owned shopping protection

Catalog declares the supported protected encounter families and their native
shopping lookback lengths (Nemesis 12, Heracles 10). Include all supported
Nemesis combat, random and Bridge event definitions which actually consume
the named requirement, and Heracles N/O/P combat definitions. Membership must
follow native requirement inheritance, not an NPC display label.

#### Pinned lookback boundaries

At the ordinary outgoing preparation contact, let `P1` be the departing
room-history appearance immediately before the planned NPC room, `P2` the
appearance before that, and so on. These are chronological appearances, not
distinct room names or occurrence IDs. `LeaveRoom` has appended `P1` to history
but has not replaced CurrentRoom, so the native sequence is
`[P1, P1, P2, P3, ...]`.

| Protected NPC | Native window | Entries inspected      | Last protected Shop appearance                         | First unprotected Shop appearance  |
| ------------- | ------------- | ---------------------- | ------------------------------------------------------ | ---------------------------------- |
| Nemesis       | 12            | `P1, P1, P2, ..., P11` | `P11` (10 intervening appearances before the NPC room) | `P12` (11 intervening appearances) |
| Heracles      | 10            | `P1, P1, P2, ..., P9`  | `P9` (8 intervening appearances before the NPC room)   | `P10` (9 intervening appearances)  |

Both boundaries are inclusive at the last protected position. An immediately
preceding Shop (`P1`) is protected even though it consumes two native window
entries. Short histories use every available entry; do not pad them. A Shop
after the target encounter gets no protection from that target.

The implementation retains the native 12/10 declarations and evaluates the
existing preparation-history contact. Do not replace them with globally
hard-coded 11/9 room distances. Select the native window before deduplicating
source occurrence IDs for publication: repeated appearances and Hub restores
must consume their proper history positions. Extra encounter phases do not
invent room-history entries. At any differently timed preparation contact,
derive CurrentRoom and history membership from that contact; do not blindly
apply the ordinary departing-room duplication.

The engine derives a route-wide, occurrence-addressed execution policy from
reached selected encounter preparations and their existing history views:

1. For each planned protected encounter, obtain the exact preceding room window
   that its native eligibility check consults.
2. Identify any earlier authored Shop occurrences in that window. Mark only
   the corresponding NPC shopping event for suppression there.
3. Union overlapping protection and publish the result per source occurrence.
   Absence means native behavior. Unpicked rooms, dormant phases and targets
   outside the configured/evaluated prefix create no protection.

Reuse the history owner behind `projectPreviousRoomEncounterKeys` and
`simulation/encounters/preparation.ts`. If occurrence identity is not currently
exposed, add a narrow identity-bearing history projection and have both
consumers derive their views from it. Do not build a second chronology or
duplicate the CurrentRoom/history-tail rule in export.

`simulation/resources.ts:deriveResourceExecutionPolicy` is the architectural
precedent, not a request to merge unrelated resource and NPC policy owners.
The new policy belongs beside encounter simulation; execution assembly only
copies its complete derived product.

Apply the same route-history semantics across biome boundaries and Dream
itineraries, without an ordinary/Dream special-case window. Native Dream
shopping exclusion makes the protection inert there. Count history contacts,
not combats; cover Hub visits/restores, side rooms and multi-phase rooms using
their existing history behavior rather than adding offsets.

Publish a narrow optional occurrence field, `suppressedNpcShopping`, containing
unique `Nemesis`/`Heracles` values. Strict producer and consumer codecs validate
the closed domain. Do not persist it in the project or expose an editor toggle.

Executor wraps the two real `Check*ShoppingEvent` functions. At a synchronized,
bound protected occurrence, return before native flag writes and thread launch.
Otherwise call native unchanged, including unbound/desynchronized execution.
Do not clear historical flags, force an NPC, weaken eligibility or search future
rooms. A suppressed shopping attempt is diagnostic, never a mismatch obligation.
Existing NPC acquisition/conformance remains the meaningful failure check.

## Compatibility

Authored schema stays 88: existing Combat choices and all saved state remain
representable; no save migration or authored schema bump is authorized here.

The shopping field requires a bilateral execution contract update. Proposed
execution protocol: 47 → 48, owned by slice B, with matching executor
`execution-compatibility.json` and strict codec tests. This is artifact-only:
existing projects are republished, not migrated. Confirm the execution revision
when locking this draft; do not silently change a shipped protocol's meaning.
Slice A can remain on 47 because it uses existing encounter payload shapes.

## Delivery and acceptance

Read the relevant sections of `SIMULATION_AND_VALIDATION.md`,
`ROOM_LIFECYCLE_MODEL.md`, `GAME_INTEGRATION_BOUNDARY.md` and
`biomes/I_GAME_RULES.md` before implementation. The current
`investigations/ENCOUNTER_RULES_AND_ENEMY_ELIGIBILITY.md` records the shopping
source evidence; reconcile its disposition at closure rather than treating
its older “not modeled” statement as an exclusion.

### Slice A — identity correction

- Source-backed catalog tests for both intro variants and inherited generation
  values, including the Standard-only modifier.
- Engine tests: depth-1 resolution in Standard/Small rooms, later
  Goal/non-Goal resolution, I first/later in a
  Dream itinerary, and retained customization evaluated against the new profile.
- Retain the one-Combat-to-one-concrete-identity invariant; candidate and selected
  paths must agree. Do not fabricate a first-room Trial/NPC authoring case just
  to test an unreachable combination.
- Real project export witness and executor admission witness demonstrate the
  published intro definition survives without being replaced by its parent.
- Regenerate only semantically changed execution fixtures, format and mirror
  byte-for-byte. Review and commit the complete slice.

### Slice B — both shopping envelopes and enforcement

- Primary engine matrix covers both window sizes, last included/first excluded
  history entries, duplicated departing-room contact, cross-biome carry,
  no planned NPC, wrong NPC family, unpicked/dormant targets and configured-prefix
  limits. Include representative Hub/side-room and Ship/P multi-phase contacts.
- Pin explicit ordinary-contact assertions: Nemesis suppresses shopping at
  `P1` and `P11`, not `P12`; Heracles suppresses it at `P1` and `P9`, not `P10`.
  Assert short-history behavior and that selecting the window precedes
  occurrence deduplication. Each special-contact witness states the actual
  native history sequence rather than inferring a distance from route indices.
- Removing or moving a planned NPC recomputes protection without mutating
  unrelated authorship; ordinary undo restores the prior derived policy.
- A real producer→decoder fixture contains a protected Shop before a planned
  NPC. Cover both families in engine tests and both native wrappers in Lua.
- Lua tests prove suppression occurs before flags/thread side effects; native
  calls still run outside the envelope, for the other NPC, and when unbound or
  desynchronized. No lookahead or new mismatch path.
- Advance execution compatibility together, mechanically update the protocol
  scalar in otherwise unchanged fixtures, regenerate changed semantic products,
  format, mirror and compare. Review and commit the complete bilateral slice.

Use the repository's bounded executor/reviewer routine for these cross-lane
slices. Each primary authority owns its full matrix; product witnesses prove
handoffs rather than duplicating the matrix in UI tests.

## Closure and non-goals

Run focused owner tests per slice, then one complete planner `npm run check`
and executor Lua suite/source lint at closure. Update only the owning encounter
and integration explanations; delete this temporary plan on delivery closure.
Keep live checks in `ENCOUNTER_LIVE_ACCEPTANCE.md`: the first I combat uses its
resolved Chronos-intro identity; protected shopping callbacks suppressed before planned
Nemesis/Heracles encounters; unprotected shopping remains native.

No shopping authoring, global shopping ban, NPC probability model, new player
state tracker, dialogue progression model, generic history refactor, UI work,
Hub behavior change, or additional encounter customization feature. Delete any
superseded resolution/window path in the slice that replaces it. No permanent
second implementation solely to verify the first.
