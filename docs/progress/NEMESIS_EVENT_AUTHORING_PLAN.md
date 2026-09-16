# Nemesis Event Selection and Interaction

## Status and base

Status: **Locked; slice A ready for implementation.**

Implementation base: `fce8cdc1` in Run Planner. The superseded presentation
rewrite has been discarded; application files are back at the original
baseline. The focused accepted-to-declined pickup cleanup and its regression
test are committed in the base (26 focused tests passed). Incorporate that
cleanup into slice A rather than adding another parallel cleanup path.

## Objective

Separate **which Nemesis event occurs** from **what happens when the player
interacts with Nemesis**. Keep the ordinary Encounter selector in its normal
location. Selecting Nemesis must not move that whole editor into the action row.

The encounter controls show:

```text
Encounter  [Nemesis event]   Event  [Boon trade]
```

The separately ordered timeline action shows its own controls:

```text
Interact with Nemesis
  Boon offered  [contextual picker]   [ ] Accept
  Reward: Triple Gold
```

Resolving that interaction activates ordinary required/optional pickups. Their
trait, Pom, Hex and disposition editors remain on those pickup actions.

## Scope and non-goals

Included: phase-owned event type, incomplete interaction authoring, commands
and reconciliation, exact interaction-time candidates, findings/navigation,
the two UI surfaces, migration and unchanged complete-plan publication.

Excluded: new Nemesis mechanics, Gold/health affordability simulation, combat
Nemesis wagers/theft, Bridge progression events, catalog pool changes, generic
NPC editing infrastructure, new scheduling, executor hooks and deployment.
This separates authoring and preserves candidate policy; it does not silently
fold in the pre-existing eligibility discrepancy recorded below.

Use a small same-line native Event selector for the five closed family values.
Keep the existing Encounter contextual picker unchanged. A cascading Encounter
picker is not required for this delivery. Concrete boon/reward choices use
the shared contextual picker. There is no whole-event wizard, Save or Discard.
Semantic edits apply immediately and use normal Undo/Redo.

## Authorities and source facts

- `docs/design/SIMULATION_AND_VALIDATION.md`: engine ownership, exact candidate
  contacts, incomplete-versus-invalid state, chronology and findings.
- `docs/design/AUTHORED_PROJECT_MODEL.md`: semantic commands, retained state and
  ordered reconciliation.
- `docs/design/ROOM_LIFECYCLE_MODEL.md`: the existing required Nemesis contact
  and subsequent declaration-owned generated-pickup lifecycle.
- `docs/design/REWARD_MODEL.md`: ordinary acquisition entries and their payloads.
- `docs/design/EDITOR_MODEL.md` and `CONTEXTUAL_EDITOR_UX.md`: bound intents,
  contextual presentation, selected-invalid repair and exact finding targets.
- `docs/audits/rooms-and-routes/ENCOUNTER_SELECTION_AND_COMPOSITION_FINDINGS.md`,
  **Nemesis Random Events and Adjacent Behavior**: source-backed family matrix,
  interaction gate, result requiredness and H timing.

The encounter is selected before its interaction. The game chooses the concrete
narrative family/request at interaction through `GetRandomEligibleTextLines`.
Showing the authored family beside Encounter does **not** move its game-time
eligibility or reward generation to room entry. In H, Nemesis interaction may
occur before, between or after cages; concrete candidate support must use that
exact authored position.

| Event type     | Timeline interaction authoring                                            | Generated result                                                                 |
| -------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Free item      | Concrete offered item; no response control                                | Optional pickup                                                                  |
| Gold trade     | Concrete offered item and **Accept** checkbox                             | Required pickup if accepted; none if refused                                     |
| Damage trade   | Concrete offered item and **Accept** checkbox                             | Required pickup if accepted; none if refused                                     |
| Boon trade     | Concrete boon offered and **Accept** checkbox; fixed Gold shown read-only | Remove that boon and create required Triple Gold if accepted; neither on refusal |
| Damage contest | **Win** checkbox; success reward picker or fixed consolation on loss      | Optional pickup for either result                                                |

The Nemesis interaction itself remains required for every family. Optionality
belongs to its generated pickup, not to whether the interaction is resolved.
An accepted authored damage trade represents the surviving branch. Native death
produces no pickup, but death and affordability are outside the modeled run;
this change does not introduce health simulation to determine that branch.
F/G still suppress the incoming room-reward spawn without refunding its bag
draw. H still preserves its cage rewards and existing passive-slot/capacity rules.

## Locked design decisions

### 1. Two command responsibilities, one phase-owned authored event

Reuse `nemesisRandomEventByPhase` and the existing closed family union rather
than adding parallel event/response maps or a second timeline. The family
discriminant owns event selection; its remaining fields own interaction detail.
Their separate authoring capabilities need not imply separate storage registries.

- Selecting the Nemesis encounter leaves its family unresolved, as today.
- Selecting the family is its own semantic command. It must not require a
  concrete reward, sacrificed boon or a positive player response.
- Interaction edits cannot change the selected family. Replace the old
  whole-outcome editing contact with an exact family-bound interaction command.
- Permit the concrete boon target and reward identity to be unresolved where
  needed. Do not use an empty trait string, choose the first eligible target,
  or hide missing detail in React state.
- **Accept unchecked means decline; Win unchecked means failure.** These are
  real two-state choices, not an additional unresolved-response state. New
  families start unchecked. Existing files retain their authored responses.
  The checkbox maps to the existing response/result enums; do not persist an
  additional boolean that could disagree with them.
- Family selection uses declaration-owned defaults: known fixed rewards can
  be populated; variable rewards/boon targets start unresolved. Changing family
  resets incompatible detail through the engine command, not React follow-ups.
- Choosing the already-selected family is a no-op. Keep the existing dormant
  encounter-detail retention policy when switching away from Nemesis and back.

The current codec forbids a selected trait-trade family without its boon target
and the command forbids a selected event without a concrete reward. Widen those
incomplete authored shapes deliberately. Bump the authored schema once and
provide a migration preserving every existing complete event, response, reward,
pickup child and action identity. Keep old complete event field spelling where
possible; do not restructure unrelated saves merely to express the UI split.

### 2. Configuration does not settle the interaction

Reuse `interactEncounter` and `nemesisGenerated:<phase>/result`. There is no new
action kind, scheduler or acquisition mechanism.

- Selecting the encounter supplies its existing required interaction row even
  while the family or its detail is incomplete.
- Concrete reward/boon candidates and selected validation use the existing
  `encounterInteractionReached` pre-effect context. Event-family authoring is
  available before these concrete candidates are reached.
- A refused offer still has authored offer details, but activates no pickup.
  A boon is removed only by acceptance at the interaction, never by configuration.
- An unresolved variable reward creates its interaction finding, not an
  impossible-to-edit generated-pickup finding. Fixed results need no picker.
- Switching Win to loss installs the declared consolation. Switching back to
  Win exposes a success-reward choice; it must not silently retain consolation
  as a valid success result or choose a random first result.
- Reconciliation atomically adds/retracts generated actions with source
  activation. Accept -> refuse cannot leave a stale result action. Restoring
  acceptance preserves compatible nested pickup detail and recreates required
  participation. Family/reward replacement removes incompatible references.
- A generated pickup stays after its source interaction and follows the
  existing optional/required placement policy. Configuring or moving the source
  does not count as collecting its reward.

### 3. Distinct presentation and finding owners

The current `timelineAnchor: 'action'` for Nemesis moves the entire phase editor
onto `interactEncounter`. Replace that presentation coupling:

- The encounter selector and Event selector stay at the phase's ordinary
  encounter-configuration location, including while incomplete. Use the existing
  noncombat room-entry host when no combat-start boundary exists; configuration
  visibility must not depend on finding an already-settled interaction action.
- The interaction row renders only family-specific interaction controls.
  H's passive event uses its existing feature/phase location; do not invent an
  ordinary combat Encounter selector for a feature-owned slot.
- Reuse the phase-owned Nemesis event address for the Event selector, and the
  existing `RoomActionAddress` for the `interactEncounter` configuration surface.
  Missing family points to Event; missing/invalid concrete interaction detail
  points to the interaction controls. Pickup-child findings retain their own
  acquisition/trait/level owners.
- Inline borders and finding navigation consume the same destination mapping.
  Do not choose destinations by rendered index, selected tab or message text.
- Keep all repair controls visible in incomplete/context-invalid states. The
  normal occurrence-level readiness policy applies; no Nemesis-specific locks.

### 4. Publication remains a resolved product

The execution format already carries an encounter interaction and separate
generated acquisitions. Keep that wire contract and complete-plan behavior.
No game-module change or protocol bump is intended.

The engine owns completion and legality. The assembler copies the resolved
Nemesis event into the existing execution shape; it does not supply missing
targets, infer responses, rerun eligibility or reconstruct pickup policy.
Incomplete authoring must not reach a successfully published plan. Prove that
migrated complete witnesses retain the same semantic execution product.

## Delivery slices

### A — Engine selection/interaction boundary

Starting contacts:

- `packages/planner-engine/src/authored-project/model.ts`
- `authored-project/commands/occurrence/encounter.ts` and `commands/types.ts`
- `authored-project/room-state/decoding/nemesis-outcome-codec.ts`
- `authored-project/acquisition/pickup-producers.ts` and existing reconciliation
- `simulation/rewards/biome/encounter-acquisition/encounter-settlement.ts`
- `simulation/rewards/model.ts`, progressive finding ownership and chronology
- `execution-plan/assembly/timeline-transactions.ts`; existing wire codec/model
- the next authored-schema migration under `schema/`

Deliver the family and interaction command capabilities, representable partial
states, exact candidate contexts, addressed findings and coherent generated
actions. Carry the existing decline-cleanup regression into this boundary rather
than retaining a second ad hoc cleanup path. Adapt current application bindings
only as necessary to consume the new commands; do not add compatibility commands
or temporary public models solely to split commits.

Primary tests: existing `occurrence-encounter.test.ts`,
`nemesis-random-events.test.ts`, owning codec/migration tests and the existing
execution assembler Nemesis witness. One source of truth for the five-family
policy matrix; UI tests exercise representative contacts rather than repeat it.

### B — Encounter configuration and timeline interaction UI

Starting contacts under `apps/planner/src/`:

- `projections/structured-workspace/contracts/locals.ts` and `contracts/timeline.ts`
- `projections/structured-workspace/interactions/occurrence-interaction-binding.ts`
- `projections/structured-workspace/assembly/occurrence-reward-assembly.ts`
- `projections/structured-workspace/assembly/occurrence-action-timeline-projection.ts`
- workspace finding destinations, markers and `projections/evaluationProjection.ts`
- `ui/editor/biome/locals/EncounterPhaseControl.tsx`
- `ui/editor/biome/NemesisEventEditor.tsx` and `OccurrenceRoomActions.tsx`
- `ui/styles/room-workbenches.css`

Deliver stable Encounter/Event controls plus a compact family-specific
interaction row. The row contains contextual concrete choices, an ordinary
Accept/Win checkbox where applicable, and read-only fixed results. Use catalog
labels without activation-dependent raw IDs. Missing detail remains editable
without requiring the response checkbox to be toggled first.

Replace the committed all-in-one form/tests/styles. Do not revive the discarded
whole-event picker. Reapply catalog-label presentation through the new bound
controls; do not preserve draft, wizard or generated-summary scaffolding for
compatibility.

Primary application witnesses: `OccurrenceRoomFeatures.test.tsx`, exact
inspector-destination/finding tests and workspace contract tests. Keep any
new projection-focused tests in the mirrored owning test neighborhood.

Slices A/B are review boundaries, not permission to commit a broken consumer.
Use coherent commits only; if the new command/model boundary cannot stand with
its application consumer, land A/B together after both reviews.

### C — Closure

Independently review the completed vertical slice, confirm removal of the
superseded authoring path, then run the complete repository gate once after
focused tests are stable. Main-session ownership includes Git and final diff
review; executors receive bounded packets and do not run repeated broad gates.

Update the owning design explanation only where this selection/interaction
contract changes it. Preserve the source facts in the encounter audit. Do not
add a bug-fix narrative to each authority. Remove this temporary plan at closure.
Do not regenerate unrelated execution fixtures; follow existing generated-fixture
formatting/mirroring policy for any genuinely changed wire products.

## Acceptance and adversarial checks

1. Selecting Nemesis then a family can be saved/reloaded with unresolved concrete
   detail. That produces repairable findings without exceptions or implicit picks.
2. The Encounter selector remains usable in its normal location. The required
   interaction exists independently; choosing a family does not move the selector.
3. For all five families, the matrix above matches settlement, child
   requiredness and response behavior within the surviving-run assumption.
   Refusal retains offer detail without a
   phantom pickup. Free items do not acquire an artificial response checkbox.
4. Accept/refuse, Win/lose, family replacement, encounter switching and Undo/Redo
   preserve or retract exact source/entry/action references coherently. Reopening
   and keyboard use work without Save/Discard or a preliminary checkbox toggle.
5. A real H witness places an acquisition before and after the Nemesis contact.
   The offered-boon candidates follow that contact's inventory, not room entry.
   Moving an already-authored interaction can make a target invalid but cannot
   hide its repair control. Keep F/G incoming suppression and H cage/feature
   behavior covered by their existing tests.
6. Missing family navigates/highlights Event; missing or invalid interaction
   detail navigates/highlights the action controls; a generated Pom/trait/Hex
   finding still repairs on the pickup, not the source event.
7. Migration preserves old accepted/declined and successful/failed outcomes,
   including nested pickup children and dormant detail. Incomplete states cannot
   publish; complete migrated witnesses publish the existing execution shape.
8. Inspect normal and narrow layouts: only additional Nemesis controls appear;
   no nested replacement form, raw trait IDs, selector-width jumps from summaries,
   or duplicated editors. Automated tests do not replace this visual check.

Before implementation, challenge three shortcuts explicitly: borrowing entry
state for concrete targets, treating unchecked as unresolved, and separating
rendered controls while leaving the whole-outcome command as the only mutation.
None satisfies this contract.

## Separate eligibility follow-up

Plan review identified an existing difference, not caused by this separation:
`encounter-settlement.ts` restricts boon-trade targets to equipped
`providerKind === 'olympian'` traits with rarity. The source audit requires
`IsGodTrait(..., { ForShop = true })`, for which the catalog already declares
`shopAwareGodTrait`; that can include non-Olympian givers. Both paths prefer
Common candidates when available.

Changing that filter can change which previously authored targets are valid,
so it is not included under the behavior-preserving candidate handoff in this
plan. A focused follow-up should use the existing normalized predicate and a
non-Olympian witness, preserving branch-local Common preference. At closure,
retain this source/model discrepancy in the existing encounter audit if it has
not been addressed separately; do not lose it when retiring this plan.
