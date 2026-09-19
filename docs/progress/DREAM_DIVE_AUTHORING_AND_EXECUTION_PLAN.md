# Dream Dive authoring and execution

Status: proposed delivery contract; no implementation started.
Planner base: `625ba63e`. Inventory both repository heads and worktrees before
execution. This plan does not authorize pushing or deployment.

## Outcome and locked decisions

Create a Dream Dive project by selecting its four-biome itinerary once, author
it with the existing Loadout and biome editors, publish a valid configured
prefix, and have the game module steer the native Dream route accordingly.

- New Dream Dive opens a transient draft, not an empty authored project.
- One staged contextual picker selects four ordered biome badges. Earlier
  choices can be revised in the draft; invalidate only the incompatible draft
  suffix through the existing staged-picker pattern.
- Create is available only for a complete legal itinerary. Closing leaves the
  current project, persistence identity and history untouched.
- Creation supplies the complete itinerary atomically and configures its first
  biome. The itinerary is visible but immutable thereafter. A different order
  requires a new project; there is no reorder command or repair workflow.
- Biomes to configure remains the editable prefix length of that itinerary.
- Starting reward, biome-local entry selection, ordinal NPC outcomes, Dream
  Postboss derivation, restrictions and clocks reuse delivered authorities.
- Executor work steers itinerary choices and integrates admission. Native game
  transitions, difficulty, presentations and completion remain native.

## Evidence and authorities

Read `SIMULATION_AND_VALIDATION.md` before engine work, then relevant sections
of `AUTHORED_PROJECT_MODEL.md`, `CANDIDATE_EVALUATION_MODEL.md`,
`GAME_INTEGRATION_BOUNDARY.md` and the application architecture/editor guide.
The source-backed route facts live in
`docs/audits/rooms-and-routes/ROUTE_POSITION_GAME_DATA_AUDIT.md`.
`docs/investigations/DREAM_DIVE_SCOPE.md` owns the remaining admission probe.
Read the downstream repository's own instructions before modifying it.

Native `DreamRunLogic.lua:SelectNextDreamBiome` owns both initial and later
selection: first pool G/H/I/O/P/Q, F/N added afterward, no repeats, and no
immediate natural successor (F→G→H→I; N→O→P→Q). The exclusion is directional.
Exactly four biomes constitute a full route. First-ever forced H and last-run
starting-biome avoidance are external save predicates intentionally excluded
from the matured-state planner; explicit authored choices override them.

`EnterNextDreamBiome` calls `ChooseStartingRoom` then `LeaveRoom`.
`CheckDreamBiomeCompletion` retains native Dream Points use, ordinal Postboss
selection and fourth-biome ending. `AttemptUseDreamRunExit` skips later entry
reward selection. Dream_Intro is native prologue, outside authored chronology;
it must not be mistaken for the first published occurrence.

## Ownership and bounded changes

Catalog owns start pools and successor declarations. Engine owns a single pure
public itinerary legality product, used for incremental draft alternatives and
complete creation/load admission. Do not duplicate legality in React or Lua.
Preserve structural decoding/internal foundation fixtures where they intentionally
exercise non-public itineraries; distinguish public admission from those tests.

Application owns transient creation draft, project replacement, persistence and
presentation. Starting contacts:

- `apps/planner/src/composition/projectBootstrap.ts`;
- `apps/planner/src/workspace/projectOperations.ts`, `project-admission.ts`;
- `apps/planner/src/projections/editorNavigation.ts`;
- `apps/planner/src/ui/project/ProjectFileControls.tsx`;
- engine `authored-project/defaults.ts`, `codec.ts`, `route-context.ts`.

Execution assembly owns the explicit published route identity and configured
biome order. Extend its closed route/extent contract and both strict decoders;
do not infer order from biome names. The configured prefix is sufficient for
steering within supported execution extent. Preserve existing end-of-prefix
behavior; do not force an unauthored next biome or confuse prefix termination
with the native fourth-biome ending.

Downstream contacts are `src/mods/protocol/decoder.lua`, `loadout/hooks.lua`,
`loadout/session.lua`, `room/hooks.lua`, `runtime/session.lua`,
`route/session.lua` and the navigation neighborhood. Adapt the existing session
and cursor, not a second Dream coordinator. Preserve first-room reward forcing
and later entry-room forcing through the real `ChooseStartingRoom` contacts.

## Delivery gates

### A — Fixed-itinerary public authoring

Implement engine-owned legal choices/admission and the creation dialog. Thread
the complete itinerary through bootstrap and project operations. Enable Dream
navigation, file loading and autosave restoration under that same admission.
Show the fixed itinerary without edit controls; retain current Loadout layout.
Keep Dream publication explicitly unavailable until Gate B is coherent.

Primary engine tests exhaust the bounded four-position legality matrix,
including directional exclusions, duplicate/start restrictions and candidate
prefix agreement with complete admission. Do not reproduce rules in UI tests.
Representative application witnesses cover draft cancellation, revising a draft
prefix, atomic creation, save/load/autosave, configured-prefix edits and Undo
preserving itinerary identity. Include F as a later biome with entry selection,
N later with Hub initialization, and a non-F/N first biome with starting reward.
Retain ordinary route creation regression coverage.

Commit boundary: coherent planner authoring with explicit publication guard.

### B — Publication and native Dream navigation

Extend engine execution route/extent types, assembly and codec and the Lua
decoder together. Admit the correct native run mode; retain ordinary admission
and bounded Postboss recovery. Explicitly handle native prologue without
consuming the first occurrence or replaying loadout at the first biome.

Steer the published next biome at `SelectNextDreamBiome`. Before implementing,
trace its mutation of DreamBiomePool, LastDreamStartingBiome and NextRoomSet:
the intervention must keep native bookkeeping consistent with the chosen biome,
not merely replace NextRoomSet after consuming a different random choice.
Prefer a bounded selector-scoped decision input; do not recreate the transition
loop or add a global RNG override. Document the chosen contact in the hook map.

Verify first and later `ChooseStartingRoom` forcing and native Dream Postboss
transitions. Recovery derives the next published biome from the existing cursor,
not a separate counter. No custom Dream Points transaction, additional per-action
semantic mismatch checks or eligibility engine. Existing entry/exit checkpoints
remain authoritative.

Primary tests: strict TS/Lua protocol acceptance/rejection; real compiler-built
Dream execution fixture; native-hook witnesses for first choice, subsequent
choice, pool bookkeeping, ordinary/passive pass-through, prefix exhaustion,
first-room identity/reward and Postboss resume followed by correct next choice.
Use one representative legal mixed itinerary with both F and N later. Preserve
ordinary fixture products. Update inspector route labels only where necessary.

Commit boundary: matching producer/consumer contract and enabled publication.
One execution protocol bump for this extension, with byte-identical mirrored
fixtures. No authored schema bump expected: existing itinerary storage suffices.
If a persisted shape change becomes necessary, amend this plan before adding it.

### C — Review, closure and runtime handoff

Use the repository gate routine: one focused executor at a time, reuse for
remediation, fresh independent review for each stabilized gate. Review ownership,
locked identity, public admission consistency, native selector bookkeeping,
first/later entry timing, prefix boundaries and resync without new policy paths.
Remove obsolete public Dream rejection paths when replaced, not unrelated guards.

After narrow tests and review fixes, run one full planner `npm run check` and
the downstream required test/check lane. Generate changed execution fixtures
through production encoding and repository Prettier; mirror and compare bytes.
Record results and pending manual checks truthfully in closure commit history.

Manual acceptance: create/save/reopen a mixed itinerary; start a native Dream
run; confirm first room/reward, all three onward biome choices, ordinal Postboss
rooms, Postboss reload/resync followed by correct steering, and native final
completion. Confirm ordinary runs remain unaffected. Code closure must not claim
these passed before user testing. Keep a bounded checklist if probes remain.

Update only owning durable contracts: fixed project itinerary/admission,
execution extent/Dream admission and the focused hook mapping. Correct stale
deferred-scope claims rather than appending a changelog. Promote itinerary source
facts from the investigation, retire resolved investigation content and delete
this plan at closure (retain only concrete pending runtime probes if needed).

## Non-goals and audit-againsts

No editable itinerary after creation, blank Dream project, topology conversion,
new scheduler, route-mode registry, generic navigation framework or loadout
redesign. Do not reimplement delivered NPC scaling, inventory restrictions,
resource suppression or Supply Chain deferral. No new save-progression inputs,
Dream Points economy or native transition recreation. No exhaustive UI copy of
engine legality tests. Do not treat successful compilation as in-game validation.
