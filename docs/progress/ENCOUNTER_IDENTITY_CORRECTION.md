# Encounter identity correction: bind the native carrier, keep exact proof

Status: locked 2026-09-25; the proposed ownership plan it replaced is
discarded. Planner base `e84fdd7c`, executor base `69132ed`. Written from the
F postboss live mismatch.

## Objective

Correct F postboss's declared encounter to the game's legal carrier and add
source-backed noncombat binding coverage, so the executor's existing forced
selection and exact identity proof succeed without a new ownership concept,
wire field, protocol bump, or executor branching.

## Evidence

- Native `LegalEncounters` for every postboss room is a single key: `Empty`
  in G, H, I, N, O, P and Q (`RoomDataG.lua:1027`, `RoomDataH.lua:1857`,
  `RoomDataI.lua:3455`, `RoomDataN.lua:2538`, `RoomDataO.lua:1420`,
  `RoomDataP.lua:1444`, `RoomDataQ.lua:2568`); `Story_Chronos_01` in F
  (`RoomDataF.lua`, `F_PostBoss01`). `Story_Chronos_01` is
  `InheritFrom = { "Empty" }` with conversation events
  (`EncounterData_Story.lua:177-183`).
- Every story room is also single-carrier: `Story_Arachne_01` (F),
  `Story_Narcissus_01` (G), `Story_Medea_01` (N), `Story_Circe_01` (O),
  `Story_Dionysus_01` (P), `Story_Hades_01` (I), `Story_Palace_01` (Q). The
  only multi-carrier story set is the H bridge (`Story_Echo_01` ×4,
  `BridgeShop` ×2, `BridgeNemesisRandomEvent`). The catalog models the Echo
  version through `H_Bridge01` → `Story_Echo_01`, not all three alternatives
  as authored variants. Forcing Echo delivers the planned interaction;
  letting native selection choose another variant would cause a preventable
  failure of the required Echo acquisition or conformance obligations.
  This does not establish that an additional exact-name check is necessary.
- Catalog: `F_PostBoss01` binds `Empty` (`rooms/f.ts:1248`); every other
  postboss binds `Empty` correctly. `F_GAME_RULES.md:200-203` records the
  `Empty` binding as a deliberate simplification ("the raw `Story_Chronos_01`
  binding is a progression-event carrier over `Empty`"). That simplification
  is incompatible with the executor, which forces the declared key, probes
  `IsEncounterEligible` (`encounters/hooks.lua:108-119`), falls back to native
  when ineligible, then proves the native name against the declared key
  (`encounters/phases.lua:84-118`). The live log shows exactly that sequence:
  `encounter-eligibility {encounterKey=Empty, reason=native-ineligible}` then
  `first-mismatch checkpoint=encounter expected=Empty observed=Story_Chronos_01`.
- `unmodeledEncounterKeys` (`rooms/types.ts:139`) is the existing mechanism
  for zero-slot envelopes (intros, Hub) and is still exact-name proof; it does
  not apply to a room with a modeled lifecycle phase.
- Saves are unaffected: a fixed phase's key is catalog-owned and persists only
  when its declaration owns a trait offer
  (`encounter-state-codec.ts:236-247`); neither `Empty` nor the Chronos
  carrier does.

## Chosen model

- Declare `Story_Chronos_01` as a catalog encounter definition with the same
  planner semantics as `Empty` (`kind: 'nonCombat'`,
  `countsEncounterDepth: false`, no producer, no lifecycle effects beyond
  the postboss template's), and bind `F_PostBoss01` to it. The postboss
  lifecycle (fountain, Purging Pool, cleanup, exit) does not change.
- Keep the executor's contract exactly as it is: forced selection where
  eligible, native fallback when not, exact identity proof, occurrence-bound
  phase binding. No policy field, no name aliasing, no suppressed proof.
- Add the guard that would have caught this: a catalog test asserting, for
  every supported noncombat room whose native `LegalEncounters` has one member and whose envelope
  has one fixed slot, that the bound definition key equals that member. The
  expected map is an inline, source-cited table in the test (game facts, not
  a production declaration). Rooms with more than one legal carrier are
  listed with their modeled alternative and excluded from the equality check.
  Zero-slot intros and the Hub have a separate source-backed inventory for
  `unmodeledEncounterKeys`; they are not covered by the fixed-slot assertion.
- Update `F_GAME_RULES.md:200-203` to state the corrected binding and why
  (execution enforces exact identity), replacing the simplification sentence.

## Not chosen, and why

- A per-room `encounterExecutionPolicy` on the wire (the ownership plan):
  the observed failure is one wrong declaration, not evidence that a new
  execution ownership model is needed. The policy would
  cost protocol 46 → 47, both strict decoders, republishing every execution
  artifact, all execution fixtures regenerated and mirrored, an exhaustive
  catalog matrix, and executor branching — and, as scoped ("story/bridge"
  native), it would stop forcing the authored H bridge choice.
  Steering and verification are separate decisions: selecting Echo avoids
  native randomness defeating the plan, while missing Echo's meaningful
  outcome is already detectable downstream. This correction retains existing
  proof without claiming every exact-name check earns its keep. Any later
  reduction of redundant checks must assess verification independently of
  selection; it is not part of this fix.
- Adding `Story_Chronos_01` to `unmodeledEncounterKeys`: that list is for
  envelopes with no modeled phase; the postboss has one.

## Single delivery slice

Implement the catalog correction, regression coverage, affected fixture mirrors,
and documentation together. This is a focused fix, not a multi-gate feature;
no separate gate executors or gate-by-gate reviews are needed. Review the complete
diff once before committing the corresponding changes in each repository.

- `declarations/encounters/f.ts` (or `shared.ts` beside `Empty` if the
  compiler requires shared placement): add `Story_Chronos_01`.
- `declarations/rooms/f.ts`: bind `F_PostBoss01` to it.
- `test/catalog/encounters.test.ts`: the single-carrier noncombat fixed-slot
  equality guard described above. Explicitly disposition multi-carrier and
  route-contextual cases rather than applying the assertion to them. Keep
  zero-slot intro/Hub evidence separate; do not imply the single-slot guard
  covers those representations.
- Execution fixtures carrying the F postboss phase (`automatic-boss`,
  `f-opening`, `fg-anomaly`, `fg-ixion-chaos`, `fg`, `underworld-fgh`,
  `underworld-fghi`, `underworld-generated-composition`) are the initial
  inventory, not an exhaustive list. Refresh only affected products through
  the owning execution fixture builder; inspect derived fingerprints and any
  other legitimate consequences of the changed key. Prettier format, mirror
  byte-for-byte to the Plan Executor, `cmp` each pair, and inspect numstat.
  No authored fixture changes or unrelated fixture regeneration.
- Add one executor contact witness: a published story-derived noncombat key
  is forced, proves, and binds. Retain existing coverage of ineligible-key
  fallback and mismatch; extend only if the witness is missing. No executor
  production change.
- Replace the stale F postboss explanation in `F_GAME_RULES.md` and update the
  owning encounter audit's identity inventory without adding a fix narrative.

## Verification and closure checklist

- During implementation: focused catalog and engine execution-fixture tests,
  plus the affected Lua contact tests.
- Before completion: planner `npm run check` (includes the full test suite),
  executor full Lua suite and luacheck, fixture mirror comparisons, and diff
  inspection.
- Live acceptance: F postboss runs its native Chronos carrier and stays synced
  through fountain/pool and exit into G. Conversation remains conditional on
  game progression. Record pending testing in `ENCOUNTER_LIVE_ACCEPTANCE.md`
  until confirmed; do not report unperformed testing as passed.
- Delete this plan at delivery closure.

## Non-goals

No NPC story-progression model, no change to which encounters combat rooms
force, no mismatch-policy change, no executor ownership concept, no protocol
change, no authored schema change.
