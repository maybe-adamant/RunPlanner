# Encounter Events and Aetos Placement

Status: proposed execution contract; implementation not started.
Base: `fcd8d55680ad30abd7599122a4abcad8ad04bde7`.

## Outcome and scope

Give Fig Leaf, Gorgon Amulet and Aetos a compact encounter-local authoring
home. Add explicit Aetos placement without requiring enemy-composition
customization, changing combat budgets, or manufacturing a native spawn.

Three delivery gates: existing event presentation; Aetos planner authoring;
bilateral execution integration and closure. Commit this plan before execution.
Fresh File work in the separate worktree is outside scope.

## Locked authoring shape

```text
Encounter   [ Combat ▾ ]       Customize Encounter
Events      ☐ Skip with Fig Leaf   ☐ Gorgon Amulet: Death Defiance   ☐ Aetos appearance [Wave ▾]
```

- Events flow horizontally, wrapping on narrow screens. Each checkbox and
  label stays together; Aetos's wave selector belongs to its control group.
  Use spacing, not literal dot separators, and normal sentence-case typography.
- Show Events only for applicable controls or retained selected values needing
  repair. No event dialog, exclusive event picker, preboss control, biome
  settings page, or extra timeline action.
- Preserve Fig Leaf and Gorgon semantics. They are not renamed domain types
  or folded into a new generic modifier framework merely to share layout.
- Aetos is independent of the composition Edit/Reset lifecycle. Resetting
  generated composition must not clear Aetos.
- Checking Aetos authors a concrete wave, initialized to the first supported
  wave (2). Unchecking removes that placement. Subsequent wave changes are
  semantic edits. Wave labels are `Wave 2`, `Wave 3`.
- Earlier eligible encounters remain available when a later encounter owns
  Aetos. After a reached valid placement, later unselected controls are absent.
  Selecting an earlier placement does not silently clear the later selection:
  retain it with a duplicate-placement finding and a repairable control.

## Source evidence and bounded policy

Source root: `/home/ayyatma/wsl-projects/modding/1GameData/Scripts`.

| Fact                                                                                        | Source contact                                                                                                                                |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| GeneratedP owns OlympusEagleSpawn in WaveStartUnthreadedEvents; Large inherits it           | `EncounterData_Generated.lua`, GeneratedP and GeneratedP_Large                                                                                |
| Native chance is 0.33; current-room flag and SumPrevRooms=20 prevent repeat appearances     | Same event declaration; `RequirementsLogic.lua`, SumPrevRooms evaluation                                                                      |
| That window includes current room and preceding 19 history entries                          | `RequirementsLogic.lua`, roomsBack loop starting at zero                                                                                      |
| Requires Outdoor; refuses first wave; sets room flag; temporarily reduces active cap by two | `EventLogic.lua`, OlympusEagleSpawn                                                                                                           |
| Eagle's departure restores the two-cap adjustment                                           | `EnemyAILogic.lua`, EagleAttackAndFlee                                                                                                        |
| Skipped encounters return before wave-start dispatch                                        | `EncounterLogic.lua`, HandleEnemySpawns                                                                                                       |
| P precombat Fig Leaf propagates skip to the follow-up                                       | `EncounterLogic.lua`, pre-spawn skip handling; existing P lifecycle authority                                                                 |
| Precombat and Athena explicitly clear the inherited Aetos callback                          | `EncounterData_Generated.lua`, GeneratedP_PreCombat; `EncounterData_Athena.lua`, BaseAthenaCombat                                             |
| Icarus's own wave-start array masks the inherited callback                                  | `EncounterData_Icarus.lua`, BaseIcarusCombat; `RunData.lua`, ProcessDataInheritance/DeepInheritData                                           |
| Heracles requires Indoor, excluding this Outdoor event                                      | `EncounterData_Heracles.lua`, HeraclesCombatP                                                                                                 |
| Gorgon Athena does not replace the generated encounter or its waves                         | `TraitData_Keepsake.lua`, UniqueEncounterArgs; `RoomLogic.lua`, StartEncounter/StartEncounterEffects; `EncounterLogic.lua`, HandleAthenaSpawn |

Aetos adds no authored wave, ordinary enemy count, budget, reward acquisition,
or automatic encounter-end effect. Native spawn pacing and eagle behavior stay
native. Gorgon and Aetos are not mutually exclusive; Fig Leaf skipping prevents
Aetos, including skip inherited from P's leading phase.

Initial catalog support is GeneratedP (native 1–2 waves) and GeneratedP_Large
(native three waves), in Outdoor combat rooms. Current outdoor combat maps:
P_Combat01, 03, 05, 06, 11, 13–17 and 19. This list is evidence, not a second
runtime whitelist: declarations own event support and room tags own Outdoor.
Intro, precombat, Athena, Icarus, Heracles, miniboss and boss profiles are excluded.

The planner deliberately authors at most one appearance per Olympus biome.
This is the bounded user-facing policy, not a claim that the native game has a
once-per-run flag. Native cooldown remains authoritative in execution.

## Eligibility and retention

Engine assessment consumes the resolved active encounter, room tags, exact
phase execution/skip disposition, reached prior Aetos selections and resolved
wave domain. React must not derive these from room names or count prior controls.

- Native GeneratedP permits requesting Wave 2 despite its possible one-wave
  roll. This is valid best-effort authorship, not a missing customization finding.
- Native Large permits Wave 2 or 3. Customized composition uses its exact
  assessed wave count. One-wave customization has no eligible Aetos placement.
- A valid Gorgon selection alone does not disqualify Aetos.
- A selected invalid wave, duplicate placement, unsupported resolved encounter,
  or propagated Fig Leaf skip remains authored and produces an exact phase/event
  finding. Do not hide selected invalid controls or silently move the event.
- Dormant phases do not reserve Aetos, emit findings, or cause suppression
  targets. Existing occurrence/phase structural reconciliation governs deletion
  and replacement; context changes alone are not destructive repairs.
- Encounter-ineligible or unassessed suffixes must not fabricate reached
  history. Retained authoring and exact repair availability remain distinct.

## Ownership and compatibility

Catalog owns source-backed event capability and its native wave constraints.
Engine owns the optional phase-local selected wave, semantic command, strict
codec, reconciliation, assessment/history, findings, authoring query and export.
Application projections bind those products; React owns wrapping and rendering.
Game module owns scoped native event intervention and diagnostics only.

Use an optional phase-keyed Aetos wave field beside existing Fig Leaf/Gorgon
encounter state, not inside customizationByPhase. Absence means no planned
appearance. Do not persist both a checkbox boolean and a redundant nullable wave.
Default construction and old-document decoding must accept absence without
requiring fixture-wide authored rewrites. No authored schema bump is authorized.
If additive decoding cannot satisfy current contracts, stop and request approval.

Behavioral compatibility is explicit: an existing project without Aetos choices
still loads; when newly published with this feature it requests no appearance,
so Aetos is suppressed throughout Olympus. This replaces the earlier proposed
Any/Native default. There is no Native UI option in the agreed delivery.
Old execution artifacts are not silently reinterpreted under the new policy.
Gate C owns any necessary execution-protocol revision bilaterally, independently
of authored schema; old artifacts require re-export under normal compatibility.

## Runtime contract

Planner export must carry the completed biome directive (no appearance or an
exact occurrence/phase/wave target). The module consumes it without scanning
future rooms to derive policy. Use the narrowest existing execution owner for
this directive; avoid repeating equivalent flags on every room.

1. No target: suppress only the native Aetos event throughout the planned P biome.
2. Before target: suppress that event.
3. Target: inspect actual generated wave availability and retain native
   eligibility. Suppress earlier waves; at the requested wave bypass only the
   random chance and let native OlympusEagleSpawn perform its normal work.
4. Successful invocation/room-flag evidence: release management. Native history
   prevents a further appearance; no extra post-success suppression.
5. Missing actual wave, live ineligibility or skipped target: diagnose once and
   release management for subsequent encounters. Do not relocate, retry on another
   wave, alter the authored plan, or produce a conformance mismatch.

An actual one-wave roll in native GeneratedP is an intentional fallback witness.
If generation customization itself falls back, use actual waves, not exported
counts. Target exit without a successful attempt must also release management;
otherwise a missed callback could accidentally suppress the whole remaining biome.

RunEventsGeneric checks GameStateRequirements before calling OlympusEagleSpawn.
A wrapper around the spawn function alone cannot force a failed 33% roll.
Use a narrowly scoped event-dispatch adapter/local event copy that preserves
native nonrandom requirements and all sibling events. Do not mutate global
EncounterData, intercept general RNG, reimplement cooldown, or spawn Eagle directly.
Inspect the actual dispatch path before choosing the final hook; generated wave
installation does not itself replace the native declaration's event dispatch.
Scope retires on biome departure, session reset or lost plan binding; unrelated
rooms and unbound play remain native. Keep this state outside native saves.

## Gate A — Existing encounter-event layout

Owner: planner application/React only. Presentation-only commit.

Start at `apps/planner/src/ui/editor/biome/locals/EncounterPhaseControl.tsx`
and its existing styles/tests. Move Fig Leaf and Gorgon out of the encounter
picker row into the shared horizontal Events row. Align checkbox ordering and
use the approved labels. Preserve bound intents, selected/disabled conditions,
finding behavior and Gorgon child offer rendering.

Remove superseded per-control placement styles. No Aetos placeholder, domain
change, new generic event registry, or composition-editor redesign.

Acceptance: focused UI witnesses for no events, either event, both applicable,
selected unavailable repair, keyboard/label activation and existing intents.
Inspect wide/narrow and scaled layouts with the P two-phase case. Run `test:ui`
and affected planner tests; don't duplicate the engine legality matrix here.

## Gate B — Aetos catalog, engine and authoring

Owners: catalog -> engine -> application. One complete planner-side slice.

Starting neighborhoods:

- `packages/hades2-catalog/src/declarations/encounters/p_definitions.ts`,
  `generated/policies.ts`, and `rooms/p.ts`.
- Engine catalog contracts, authored-project model and
  `room-state/decoding/encounter-state-codec.ts`, `encounter-reconciliation.ts`,
  `commands/occurrence/encounter.ts`.
- `simulation/encounters/`, exact phase preparation and reached history;
  inspect Fig Leaf assessment and Gorgon support as existing integration patterns,
  not code to copy wholesale.
- Application structured-workspace source-index/interactions/finding routing,
  then EncounterPhaseControl.

Deliver the complete optional selected-wave path, one authoritative assessment,
chronological uniqueness, contextual repair and horizontal checkbox/wave control.
Use existing semantic phase addressing with event-specific evidence/binding unless
a genuinely distinct address is required. Findings must land on the event, not
Customize Encounter or room overview.

Gate B does not publish silently unenforceable Aetos policy. Until Gate C changes
the wire and consumer together, publication of an explicit Aetos choice must fail
with a narrow temporary application/publication explanation; ordinary no-selection
publication remains on the existing protocol. Delete this guard in Gate C.
Internal resolved event products are ready for export, but do not add unused wire
fields or churn execution fixtures in this gate.

Primary tests:

- Catalog: supported definitions, inherited exclusions, native wave domains and
  Outdoor contact, against native declarations.
- Authored model: old save omission, round-trip, commands/Undo, retained invalid
  choices, compatible phase retention and structural deletion.
- Engine: native 1–2 versus fixed/customized waves; Fig Leaf cascade; Gorgon
  coexistence; earlier/later/duplicate choices; dormant phase; exact first blocker
  and repair support. Cover standard Surface and P in Dream Dive without copying
  the whole matrix into both routes.
- App: representative checkbox/wave workflow, later-control disappearance,
  duplicate repair link, changing customization without losing Aetos, and the
  temporary publication guard.

Run affected catalog/engine/planner/UI lanes. Do not add a new full-run JSON
fixture solely for this feature if an existing P checkpoint can own the witness.

## Gate C — Execution integration, final review and closure

Owners: engine execution products/codecs and game module, then closure docs.

Start at engine `execution-plan/model.ts`, assembly and codec neighborhoods;
module `src/mods/room/timeline/encounters/hooks.lua`, `phases.lua`, `generated.lua`
and the existing binding/session authorities. Place the focused Aetos adapter in
that encounter neighborhood, not in the generated-composition installer.

Publish the explicit biome directive, implement the runtime contract above,
update bilateral compatibility if required, and remove Gate B's publication guard.
Preserve existing Fig Leaf/Gorgon enforcement and conformance. No Aetos-specific
reward transaction, DD enforcement, encounter mismatch or cap-management hook.

Primary witnesses: real planner-produced artifact decoded by Lua; no-target
suppression; pre-target suppression; Wave 2/3 success; native one-wave fallback;
failed native cooldown; skipped/missed target; native behavior after either
success or failure; Gorgon coexistence; unrelated event dispatch; session/biome
scope retirement. Malformed wave/target artifacts have strict decoder coverage.
Keep runtime outcome uncertainty out of planner findings.

Generate semantic fixture changes through the engine producer and format with
repository Prettier. Use bounded mechanical edits for protocol-only version
changes. Inspect numstat and representative diff; no duplicated Lua corpus.
Run `test:game-module` and affected execution/contract/product tests.

Perform final combined UI inspection without expanding scope. In-game acceptance:
no selection; forced early/late wave; native encounter target; target failure
diagnostic/release where reproducible; Fig Leaf exclusion; Gorgon coexistence.
Record unperformed live checks truthfully; do not manufacture a cooldown or claim
random fallback was observed without evidence. Code completion and live acceptance
are separate statuses; use the existing encounter live-acceptance tracker for
explicitly deferred probes if the owner approves deferral.

Promote source facts to the existing encounter audit/matrix and integration
contact audit; update only relevant authored/lifecycle/integration authority
sections. Remove this plan at closure after preserving pending live acceptance.
Run one complete `npm run test` and `npm run check` after review fixes stabilize.

## Review and delivery discipline

Use the repository multi-agent gate routine for implementation: focused packets,
one writer, independent review after stabilization, bounded remediation. The main
session owns commits, scope and complete closure checks. Each gate remains testable.

Adversarial audit-againsts:

- No second eligibility derivation in React or Lua; native runtime safety checks
  are not a reimplementation of planner history.
- No forced composition just to place an event, and no Native/Disabled/Forced
  biome settings model left over from discarded proposals.
- No assertion that Gorgon and Aetos are mutually exclusive.
- No unchecked/missing-field ambiguity: new publication's absence means suppress.
- No global event-table mutation or released scope persisting into another run.
- No selected invalid control disappearing, publication guard surviving Gate C,
  unused generic framework, unrelated Fresh File edits, or authored schema bump.
