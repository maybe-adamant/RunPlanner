# NPC Vertical Execution Plan

## Status

Locked on 2026-09-05 after a current-code inventory and source review. No
implementation gate in this plan has been committed or declared complete.

This focused plan runs before Gate E of
[Game Execution Layered Coverage Plan](GAME_EXECUTION_LAYERED_COVERAGE_PLAN.md).
It closes the six bespoke NPC trait-menu families without pulling Shop, Well,
Shrine, Pool, or later-biome navigation into the same delivery.

Starting commits:

- Run Planner: `aace4866`
- Plan Executor: `c2d0948`
- Modpack shell: `0bddabb`

The starting worktrees are explicitly inventoried rather than presumed clean:

- Run Planner has three uncommitted execution-audit edits describing the
  shared later-NPC menu carrier and retirement of the broad root Timeline hook.
- Plan Executor has the corresponding uncommitted shared six-NPC menu adapter,
  deletion of `src/mods/hooks_timeline.lua`, and focused test cleanup.
- The modpack shell reports only the modified executor submodule.

Gate A owns and absorbs those existing edits. No gate may revert or silently
reinterpret them.

## Objective

Close Medea, Arachne, Narcissus, Circe, Icarus, and Echo as vertical NPC
trait-acquisition families before commerce work begins.

The runtime contract is deliberately narrow:

```text
NPC interaction
  -> steer the exact authored three-row NPC menu
  -> observe the authored player selection
  -> let native trait acquisition run
       -> steer only an exact random result the planner already resolved
       -> hand any later independent pickup or purchase to its existing owner
  -> verify planner-visible state at the normal room checkpoint
```

The planner remains the only semantic authority. The execution compiler copies
exact complete-valid products. The Plan Executor identifies the native contact,
steers the smallest volatile choice, and otherwise lets game code execute.

## Owning authorities

- [NPC trait and generated-pickup execution](../audits/game-execution-contacts/NPC_TRAIT_AND_GENERATED_PICKUP_EXECUTION.md)
  owns the bespoke NPC menu, native-acquisition, generated-pickup, and Mystery
  Boon handoff boundary.
- [NPCs, encounters, and automatic outcomes](../audits/game-execution-contacts/NPCS_ENCOUNTERS_AND_AUTOMATICS.md)
  owns the provider-to-native-menu contact inventory.
- [Traits and offers](../audits/game-execution-contacts/TRAITS_AND_OFFERS.md)
  owns trait-family execution dispositions.
- [Trait offer pools and dependencies](../audits/traits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md)
  owns the six NPC pools, requirements, and selected-result source facts.
- [Game Execution Timeline Reconciliation Audit](../audits/rooms-and-routes/GAME_EXECUTION_TIMELINE_RECONCILIATION_AUDIT.md)
  owns occurrence-local semantic transactions, prerequisites, and carry-state
  closure.
- [Game Integration Boundary](../design/GAME_INTEGRATION_BOUNDARY.md) owns the
  planner/compiler/executor dependency direction and mismatch policy.

The relevant native source contacts are the six choice functions in
`Scripts/EventLogic.lua:906-1230`, their declarations in `Scripts/NPCData*.lua`,
and their trait acquire behavior in `Scripts/TraitData_*.lua` and
`Scripts/PowersLogic.lua`.

## Locked ownership rules

### One shared menu carrier

`EchoChoice`, `ArachneCostumeChoice`, `NarcissusBenefitChoice`,
`MedeaCurseChoice`, `CirceBlessingChoice`, and `IcarusBenefitChoice` share one
native acquisition cycle: filter native option rows, choose three, open the
generic upgrade menu, and resolve a selection.

The executor therefore owns one focused NPC-menu adapter, not six copied menu
implementations and not a broad root Timeline hook. Provider-specific native
preprocessing remains native. In particular, Circe's familiar preparation is
allowed to run before the authored rows are restored at menu opening.

Supporting all six menu contacts does not claim that every selected consequence
is complete. Gate A closes Medea, Arachne, and Narcissus; later gates close the
additional exact results of Circe, Icarus, and Echo.

### Native execution is preferred

The executor does not reimplement a trait merely because the planner simulates
its effect. Deterministic native behavior runs unchanged. The executor steers
only a random identity, target, or result that the complete-valid plan resolved.

Examples:

- Medea and Arachne choices need only their exact menu and native selection.
- Icarus applies Ingenious Strike and Ingenious Flourish through native
  `IcarusUpgradeBoon`; the planner must model the resulting level delta, but Lua
  does not apply the levels a second time.
- Echo Reward Reward Reward, Gold Gold Gold, and Gift Gift Gift remain native.
- Echo Pom Pom Pom needs its random target steered.

### Acquisition owns no physical-object provenance

Once native code creates a freely interactable object, that object is handled by
its own acquisition or purchase family. The executor does not retain a special
"Narcissus pickup", "Echo pickup", or "Supply Chain pickup" relationship.

The planner may retain producer provenance and exact dependencies because those
facts are needed for simulation and publication. Runtime claiming remains based
on a compatible ready semantic transaction at the object's accepted interaction.

### Consequences stay with their existing action families

- An ordinary or Mystery Boon trait screen reuses the existing trait adapter.
- A Pom Slice reuses the direct-level pickup adapter.
- A Hammer rank upgrade reuses the existing Hammer/trait consequence path.
- A later Shop purchase remains owned by Gate E even when Echo Gold Gold Gold
  caused its native duplicate.
- A later keepsake effect reuses the normal keepsake path even when Gift Gift
  Gift caused it to coexist.

No NPC adapter becomes a second pickup, purchase, level, Hammer, Arcana, Fear,
or keepsake subsystem.

### Later-biome structure remains deferred

This plan may publish and test dormant later-route NPC consequences through a
real complete-valid occurrence evaluation and the occurrence-level execution
projection. It does not enable N, O, H, or later route navigation in the F/G
execution assembler.

## Source-backed outcome matrix

| Provider  | Planner-visible consequence                                                                                           | Execution disposition                                                                                                                                 |
| --------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Medea     | selected rarityless trait only                                                                                        | Exact NPC menu and selection; native trait behavior.                                                                                                  |
| Arachne   | selected rarityless costume; armor depletion remains intentionally collapsed                                          | Exact NPC menu and selection; native equipment and native companion drops.                                                                            |
| Narcissus | selected option plus any separately authored optional pickups or Mystery Boon                                         | Existing exact menu; native drop creation; downstream objects use independent acquisition adapters.                                                   |
| Circe     | selected trait; exact Arcana activation, Arcana rarity promotion, or Fear removal for three stateful options          | Exact menu for every option; steer only the three authored stateful result sets; all other effects remain native.                                     |
| Icarus    | selected trait; deterministic Attack/Special levels; Latest Model Hammer target; repeating optional Supply Chain Poms | Correct planner first; native level mutation and clocks; steer only genuinely volatile exact targets through existing consequence paths.              |
| Echo      | selected trait; last reward, last-run boon, double-level target, Shop duplicate, keepsake replay, or neutral effects  | Native result wherever deterministic; steer nested last-run offer and Pom target; downstream pickup, purchase, and keepsake paths remain independent. |

## Delivery gates

### Gate A — Shared carrier and Medea/Arachne/Narcissus closure

User-visible outcome: all three NPCs use the same stable trait-screen language,
and the executor no longer has a second root Timeline hook for later NPC menus.

Deliverables:

- absorb the inventoried shared six-NPC menu adapter and delete the superseded
  `src/mods/hooks_timeline.lua` path;
- preserve each native NPC function's eligibility filtering, preprocessing,
  presentation, and post-choice behavior;
- install the exact three authored rows at the bounded menu contact and complete
  the encounter transaction only for the authored selected identity;
- keep native-unavailable behavior as a mismatch with no substitute search and
  no blocked player input;
- close Medea and Arachne as native trait acquisitions with no extra effect
  actuator;
- retain Narcissus's already-closed generated-pickup and Mystery Boon handoff;
  and
- update the durable contact audits to distinguish shared carrier coverage from
  provider-specific consequence coverage.

Primary witnesses:

- one representative menu and selection test for Medea, Arachne, and Narcissus;
- one native-unavailable row that reports a mismatch while native interaction
  continues;
- Circe preprocessing still runs even though the shared carrier later restores
  authored row order; and
- an unmodeled native companion drop remains pass-through.

Expected deletion is larger than production growth: the root hook disappears,
and the focused NPC adapter becomes the sole menu owner.

### Gate B — Circe's three stateful results

User-visible outcome: the three planner-authored Circe resolutions are realized
exactly, while her other six choices remain ordinary native trait acquisitions.

The closed consequential set is:

- `RandomArcanaTrait` — activate the exact authored Arcana keys;
- `ArcanaRarityTrait` — promote the exact authored Arcana keys; and
- `RemoveShrineTrait` — disable the exact authored Fear vow.

Deliverables:

- publish each selected option's existing `circeResolution` through the
  occurrence-level execution product without deriving it from the trait key in
  the compiler;
- extend strict TypeScript and Lua codecs only with the smallest closed Circe
  result shape;
- bind the result to the selected Circe transaction and steer the corresponding
  native random selection while leaving the native acquire function in control;
- reuse existing Arcana/Fear room-exit conformance rather than proving the
  mutation through callback-threaded state; and
- classify the remaining Circe traits as native-authoritative or
  simulation-neutral without adding empty actuator branches.

Primary witnesses:

- one exact activation, one exact promotion, and one exact Fear removal;
- one ordinary Circe option proving no additional actuator runs; and
- a real complete-valid Circe occurrence whose selected resolution reaches the
  occurrence-level execution projection and strict Lua decoder.

### Gate C1 — Icarus planner correction

User-visible outcome: authoring Icarus produces the same planner state that the
native choice produces, before the executor attempts to realize any Icarus
result.

Deliverables:

- correct Ingenious Strike to add its declared level count to the currently
  equipped Attack-slot trait;
- correct Ingenious Flourish analogously for the Special slot;
- require an occupied, still-upgradable target in the corresponding slot by
  reusing the existing Pom/Bridal Glow upgrade predicate and declaration-owned
  Hephaestus cooldown caps;
- derive the target from the occupied slot with no new author target picker;
- model Supply Chain's native encounter clock and, at each supported maturity,
  expose two optional Pom Slice pickups while leaving the healing pickup
  simulation-neutral;
- reuse the existing generated-pickup and Pom Slice machinery rather than
  introducing an Icarus-specific pickup model;
- preserve Latest Model's existing Hammer Rank-II target semantics; and
- correct the durable Icarus audit, including the normal-run `+3` and seven-
  encounter values and the deferred Dream Dive rarity scaling.

Primary owners and witnesses:

- catalog tests own the Icarus declarations and slot/cap facts;
- planner simulation tests own Attack/Special eligibility and exact level
  deltas, including a cooldown-capped Hephaestus target;
- planner lifecycle tests own seven-encounter maturity, repeat maturity, and two
  optional Pom Slice acquisitions; and
- the existing Icarus encounter fixture is strengthened so it no longer proves
  only that the outer Focus trait was equipped.

This gate changes no executor code. It must land and be reviewed before C2.

### Gate C2 — Complete Icarus execution

User-visible outcome: every Icarus choice has an explicit minimal runtime
disposition, and the newly corrected planner outcomes reach their existing
native realization families.

Deliverables:

- reuse the shared exact NPC menu for all eight Icarus choices;
- let native `IcarusUpgradeBoon` apply Ingenious Strike/Flourish and verify the
  resulting planner trait delta at room exit;
- let the game own Supply Chain's clock and native object creation; when an
  authored generated Pom Slice is accepted, hand it to the existing direct-
  level adapter;
- route Latest Model's exact target through the existing Hammer Rank-II
  realization rather than adding a second Icarus Hammer implementation;
- classify Explosive Intent, Hazard Boom, Protective Coating, and Volatile
  Coating as native-authoritative combat effects outside the current simulator;
  and
- publish no cross-room dependency from Supply Chain to a later pickup.

Primary witnesses:

- Ingenious Strike or Flourish uses native mutation and leaves the exact room-
  exit level delta;
- Latest Model reaches the existing exact Hammer upgrade path;
- one matured Supply Chain room hands each accepted Slice to the normal Pom
  Slice consumer, while an unselected optional Slice is ignored; and
- a test-owned eight-trait disposition matrix has no production registry.

### Gate D — Echo consequence closure

User-visible outcome: all eight Echo choices are selectable through the shared
NPC carrier, and only Echo's two volatile authored trait results receive new
steering.

Deliverables by choice:

- **Reward Reward Reward:** let native Echo recreate `CurrentRun.LastReward`.
  Do not spawn or bind it as an Echo-owned object; any separately authored
  pickup or resulting trait screen uses its normal acquisition adapter.
- **Survive Survive Survive:** native-authoritative Death Defiance refill;
  native unavailability remains an exact menu mismatch.
- **Evade Evade Evade** and **Fight Fight Fight:** native-authoritative numeric
  effects outside the simulator.
- **Boon Boon Boon:** publish the existing exact nested last-run offer, steer its
  three rows and selected trait at `EchoLastRunBoon` / `SelectEchoBoon`, and
  reuse ordinary trait consequence handling for the selected result.
- **Pom Pom Pom:** publish the existing exact `echoPomTarget`, steer only the
  target chosen inside native `EchoDoubleLevelBoon`, and let native
  `IncreaseTraitLevel` apply the mutation.
- **Gold Gold Gold:** let native code establish and consume its one-use Shop
  duplicate. This gate does not implement Shop purchase binding; Gate E owns
  the later purchase contact.
- **Gift Gift Gift:** let native code retain the repeated keepsake. At later
  biome activation, reuse the ordinary keepsake-effect realization path rather
  than adding an Echo keepsake actuator.

Additional constraints:

- `EchoChoice` is only the outer menu carrier. It must not be treated as proof
  that a nested menu, freely interactable pickup, later purchase, or future
  keepsake activation has completed.
- Reward Reward Reward and Narcissus share downstream acquisition consumers,
  not producer-specific executor code.
- Gold Gold Gold may publish its existing retained state and planner dependency,
  but this gate does not move commerce work forward from Gate E.

Primary witnesses:

- exact nested Boon Boon Boon rows and selection use the existing trait
  realization path;
- Pom Pom Pom steers one highest-level eligible target and room-exit conformance
  observes the doubled level;
- Reward Reward Reward produces no Echo-specific pickup binding;
- Gold Gold Gold creates no premature purchase actuator;
- Gift Gift Gift creates no parallel keepsake implementation; and
- a test-owned eight-choice disposition matrix proves every Echo choice is
  steered, native-authoritative, delegated to an existing action family, or
  simulation-neutral.

## Protocol and schema policy

- Reuse the current protocol when an existing execution trait-option shape can
  express the outcome without ambiguity.
- Bump the single active protocol only when Circe, Icarus, or Echo needs a new
  exact resolved field. Update planner fixtures, strict Lua decoding, and the
  shell pin together in that gate.
- Do not add compatibility decoding, generic `{ effect, arguments }` payloads,
  provider-specific pickup provenance, or a production effect registry.
- No persisted project-schema bump is justified solely by publishing an
  already-authored Circe or Echo result. C1 may require a schema change only if
  Supply Chain needs new authored participation that cannot be represented by
  the existing generated-pickup model.

## Review and commit boundaries

Each gate is one complete vertical slice with:

1. owning planner or catalog facts first;
2. the smallest exact execution product, when required;
3. strict codec and native adapter changes;
4. narrow owning-lane validation;
5. independent adversarial review; and
6. one bounded remediation pass followed by the orchestrator's bird's-eye diff
   review.

Intended commit boundaries:

- Gate A: shared NPC carrier closure and superseded-hook deletion;
- Gate B: Circe stateful results;
- Gate C1: Icarus planner correction;
- Gate C2: Icarus execution closure;
- Gate D: Echo consequence closure; and
- final closure: durable audit absorption, temporary-plan deletion, bounded
  phase verification, and shell pin.

Planner, executor, and shell commits remain separate where a gate crosses
repositories. The current uncommitted Gate A precursor is not mixed into Gate B
or later work.

## Validation policy

Use the narrowest truthful lane during implementation:

- catalog declaration changes: `npm run test:catalog` or focused Vitest files;
- planner simulation/execution changes: focused engine tests, then
  `npm run test:engine` when the shared engine surface changes materially;
- planner UI changes: focused interaction/UI tests only when a new authoring
  control is introduced;
- executor changes: focused Lua suites, parse checks, and `luacheck` for touched
  files;
- shell changes: submodule pin and smoke/deployment checks only when required.

Do not rerun the complete repository gate after every NPC slice. Run one
complete phase gate only at final NPC closure because C1 changes shared planner
semantics and the resulting execution products cross repositories.

## Stop conditions

Stop and return for adjudication if:

- a supposedly deterministic native effect cannot be made to match the planner
  without reimplementing the full game function;
- one physical generated object must retain NPC-producer provenance for correct
  runtime behavior;
- Supply Chain requires a cross-occurrence action dependency instead of native
  clock state plus a later local acquisition;
- Circe or Echo requires the compiler or Lua adapter to infer an exact target
  absent from complete-valid planner output;
- Gift Gift Gift bypasses the reusable keepsake-effect contact in a way that
  would require an Echo-specific duplicate implementation; or
- later-biome navigation or commerce must be enabled merely to fabricate a test
  product for a dormant NPC consequence.

## Closure

After Gate D:

- absorb stable facts into the focused NPC, trait, Icarus, Circe, Echo, and game-
  integration audits without leaving gate language in durable authorities;
- update `GAME_EXECUTION_LAYERED_COVERAGE_PLAN.md` so Gate E begins from the
  closed six-NPC consequence baseline;
- remove this temporary plan;
- remove every superseded broad hook or duplicate provider-specific path; and
- record the complete phase-gate result in the durable implementation progress
  history.

Gate E then resumes with commerce only. It must not rediscover or duplicate NPC
menu, generated-pickup, level, Hammer, Arcana, Fear, or keepsake semantics.
