# Executor hook necessity and timing audit

## Question and scope

Does every installed game hook consume a necessary planner product or serve an
explicit runtime coordination/checkpoint responsibility, at the right native
point, while retaining the game's deterministic behavior?

This is a source-grounded investigation, not a new execution policy or an
implementation plan. The governing policy remains
[Game Integration Boundary](../../design/GAME_INTEGRATION_BOUNDARY.md).
Existing [feature contact inventories](../../audits/game-execution-contacts/README.md)
are compared against the actual implementation rather than taken as proof of
coverage. Do not promote this entire investigation into another competing
authority before its discrepancies are adjudicated.

## Inspected baseline

- Planner: `a400489d`.
- Plan Executor: `3252224`, clean worktree at baseline refresh. Initial
  inspection used `05c7c80` plus the same admission-logging edits subsequently
  committed as `3252224`; that commit added no hook registrations or outcome
  changes. Existing matrix source references therefore remain applicable.
- Executor root: sibling repository
  `../run-planner-modpack/Submodules/adamantRunPlanner-Plan_Executor`.
- Native source root: local `../../1GameData/Scripts`, resolved relative to the
  planner repository. Evidence is the supplied script snapshot, not a claim
  about every game release or another installed mod's wrappers.
- Planner wire authority: `packages/planner-engine/src/execution-plan/model.ts`;
  semantic products remain engine-owned. Native data/caller locations in the
  matrices are relative to the native source root.

No game deployment, gameplay probe, test execution, production edit, or fixture
rewrite was performed for this audit. Referenced tests are inspected witnesses,
not newly established passing or live-game evidence.

The separate logging-commit review ran 28 runtime tests successfully and found
no new lint warnings. That result verifies the logging change, not the hook
audit's gameplay or native-scheduling questions.

## Document ownership

| Document                       | Sole job in this investigation                                         |
| ------------------------------ | ---------------------------------------------------------------------- |
| OUTCOME_INTERVENTIONS          | Per-export recommendation and the native work that must remain native. |
| REGISTRATIONS                  | Completeness census; no independent implementation policy.             |
| WORLD / ACQUISITIONS / EFFECTS | Current contacts, source evidence, and concrete discrepancies.         |
| THREAD_LIFETIMES               | Why context crosses contacts and what timing proof is missing.         |
| INTERVENTION_MODES             | Classification legend and explicit condition-override questions.       |
| This index                     | Baseline, finding/probe index, and document navigation.                |

The integration design document owns the invariant. The separate correction
plan owns work order and acceptance. At closure, merge useful recommendations,
classifications, and lifetime evidence into the existing durable family contact
inventories; retire these temporary parallel views rather than maintaining
seven permanent authorities.

## Exhaustive registration coverage

| Family                                                                | Source registration sites | Expanded wrappers | Matrix                                  |
| --------------------------------------------------------------------- | ------------------------: | ----------------: | --------------------------------------- |
| Navigation, room lifecycle, features/inventory, encounters/automatics |                        65 |                68 | [World](WORLD.md)                       |
| Acquisition binding, traits, levels, Mystery, NPCs, Spell/Path        |                        60 |                65 | [Acquisitions](ACQUISITIONS.md)         |
| Loadout, keepsakes, Hex construction, fountain, transformations       |                        32 |                35 | [Effects](EFFECTS.md)                   |
| Total                                                                 |                       157 |               168 | [Registration census](REGISTRATIONS.md) |

The census covers 42 registration-bearing files. All sites call
`module.hooks.wrap`; there are no additional override/context-wrap registration
sites in executor production source. Dynamic expansion is six NPC functions,
four harvest-exit functions, three immediate keepsake callbacks and two Fig Leaf
spawn handlers. Repeated native names are distinct scoped wrappers, not
deduplicated rows. The static literal function/tag pairs have no duplicates.

The composition root installs shared Hex, loadout, acquisitions,
transformations, room features, navigation, room lifecycle, encounters,
inventory and fountain interaction adapters. Helper-only files are covered by
their callers; absence of a registration in a helper does not mean missing
realization. Each family also has a reverse planner-outcome coverage table.

### Non-gameplay registrations

`src/main.lua:17-44` attaches the module through `once_loaded.game` and
ReLoad `auto_single`, defines storage/status, registers `drawTab` and
`drawQuickContent`, attaches runtime hooks and activates the module. These own
initialization, slot selection/inspection and status presentation, not a
planner gameplay outcome. They are outside the 168 gameplay wrappers.
`runtime/composition.lua` owns construction, diagnostics and admission logging;
it does not directly register another native function.

ModpackLib's `core/hooks/modutil_registry.lua:77-91` installs wrappers through
ModUtil's path wrapper and supplies native continuation. This does not prove a
particular function exists in the supplied game scripts. Engine exports and
host-dependent contacts must be labeled explicitly rather than guessed.

## How to read the matrices

Start with [published outcomes → recommended native interventions](OUTCOME_INTERVENTIONS.md)
for implementation choices: the actual exported fields, available native
input, recommended insertion/selection/native behavior, and required scope.
The registration matrices below document current hooks; they do not themselves
establish that those hooks are the preferred solution.

Every expanded hook row carries an [intervention mode](INTERVENTION_MODES.md):
scope/binding, RNG steering, direct outcome insertion, coordination/checkpoint,
and explicit recreation/condition-policy review flags. Direct answer insertion
is not automatically native behavior recreation. Flagged exceptions name the
exact overridden condition or repeated policy check for discussion.

[Thread and deferred-lifetime dispositions](THREAD_LIFETIMES.md) are part of
the necessity review. For every thread-sensitive chain, they identify the
participating hooks, the single-point alternative, why it is insufficient (if
established), and the remaining lifetime risk. A native threaded caller is not
itself justification for executor state spanning that thread.

- **Source-supported** / **Confirmed**: the relevant caller and data handoff are
  visible in source. This is not certification of native coroutine scheduling
  or proof of runtime success.
- **Concrete discrepancy**: an incompatible shape, missing reachable carrier,
  wrong native field, or policy-conflicting branch is traceable in code.
- **Probe required**: the source does not establish the host scheduling/export
  behavior needed to decide; do not implement a speculative workaround.
- **Native pass-through**: intentionally no forcing. Simulating an effect in
  the planner does not itself justify a hook.

For each wrapper distinguish correlation, steering, local DAG completion,
checkpoint verification and native continuation. Acquisition completion is not
proof of the player's selected result. Do not solve timing uncertainty by
introducing per-action semantic validation or recreating native lifecycle.

## Findings to adjudicate

These are static findings, not claims that the user has already encountered
each one in a live run. Full evidence and qualification live in the linked
family matrix.

H01–H07 have since been corrected and locally verified by the correction plan's
Gate A. The rows below retain the inspected baseline defect descriptions;
accepted contact details now live in the owning durable feature inventories.
Live-game verification remains separate. H08/H09 are addressed by the bounded
NPC-preflight and unused Pom-marker cleanup. The `UseExitDoor` contact is
resolved by moving its obligation check to actual room closure; the bounded
timing and condition questions remain open for later work.

| ID  | Finding                                                                                                                                                                                     | Disposition                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H01 | Fields `currentLayout` reads `overview/id` from the room-session wrapper instead of its `occurrence`; cage and Nemesis placement scopes do not arm. Its focused test stubs the wrong shape. | Concrete wiring defect; restore the existing planner layout product's contact, not a new Fields model. [World](WORLD.md)                                                                 |
| H02 | Direct level entry accepts only `GiftDrop`; published `StoreRewardRandomStack` Pom Slices never obtain the transport required by their downstream level hooks.                              | Source-supported missing carrier, including generated/purchased Pom Slices; use the existing level result, not another leveling implementation. [Acquisitions](ACQUISITIONS.md)          |
| H03 | Fig Leaf's first-`RandomChance` scope spans an entire spawn handler; after the native skip flag is cleared it can intercept a Vow enemy-substitution roll instead.                          | Concrete wrong-roll path; the random contact must identify the intended native decision. [Effects](EFFECTS.md)                                                                           |
| H04 | Nemesis trait-trade steering filters `GiveOptions` by trait name, but the native option is `SellTrait=true`; the actual chosen trait lives in `SellOptions`.                                | Concrete wrong native data surface; not a need to reimplement trading. [World](WORLD.md)                                                                                                 |
| H05 | Anvil/Twist scopes arm from `peek` before acceptance's `begin`; a prerequisite mismatch can leave them steering later callbacks in that same native use.                                    | Concrete passive-mode violation on the rejected-begin path; still retain native continuation. [Effects](EFFECTS.md)                                                                      |
| H06 | Shrine delay scope restoration is skipped when native `CreateSurfaceShopButtons` throws.                                                                                                    | Fault-cleanup gap; restore temporary state and rethrow, not fallback or plan mismatch. [World](WORLD.md)                                                                                 |
| H07 | Fields internal spawn-count/contact failures directly mismatch outside the agreed checkpoints; existing structural proof does not compare the completed Fields layout/rewards.              | Resolved: retain planned/observed content and placement as readable diagnostics, not positional mismatch assertions. Existing room-exit conformance remains unchanged. [World](WORLD.md) |
| H08 | NPC input installation adds a native eligibility preflight, then the later common menu reinstalls authored rows without that preflight.                                                     | Redundant/inconsistent executor policy; audit removal against option-specific native preparation rather than strengthening eligibility checks. [Acquisitions](ACQUISITIONS.md)           |
| H09 | Visible-Pom `UseLoot` wrapper writes a marker with no production reader.                                                                                                                    | Bounded unnecessary-hook/transport cleanup candidate. [Acquisitions](ACQUISITIONS.md)                                                                                                    |
| H10 | Integration authority says admission freezes at nested EquipKeepsake; current implementation admits before CreateNewHero to support starting Hex.                                           | Documentation drift; do not revert working startup behavior merely to match stale prose. [Effects](EFFECTS.md)                                                                           |

## Open timing/host questions

1. Resolved: native `UseExitDoor` has no definition/call in the supplied Lua
   snapshot. Registration does not prove existence because ModUtil accepts a
   nil base. Remove this contact and check its obligations at existing
   `LeaveRoom` closure, reached by native `AttemptUseDoor` after usable-door
   checks. No replacement attempt hook or protocol change is needed.
2. Native acquired trait effects use `thread(CallFunctionName, ...)`. Circe,
   Icarus and ordinary equip scopes need an actual scheduling witness; immediate
   test callbacks do not prove their lifetime. Echo explicitly retains some
   pending consequences. Do not conflate these different lifetimes.
3. Scope-wide random hooks can encounter nested unrelated calls or coroutine
   interleaving. H03 has a concrete nested path; the broader interleaving concern
   remains a probe, not an established failure in every scoped selector.
4. Spell pregeneration, chosen Hex construction and Path screen return should
   be checked against actual native screen/setup timing, not only nested mock
   callbacks.
5. Nemesis resolving/beginning its transaction during spawn/text selection may
   assess dependencies before player interaction. Establish a publishable
   prerequisite witness before classifying the early contact as a live defect.
6. Well/Shrine refill generation and Ship-wheel selection precede their current
   `begin` calls. Native order is visible; use real prerequisite-bearing
   published owners to decide the required admission contact without turning
   purchase attempts or every native callback into conformance checks.
7. Non-trait Nemesis trade completion precedes the deferred native exchange.
   Resolve the published terminal meaning before declaring this either harmless
   steering completion or an incorrectly released dependency.
8. Post-native reward source patching can coexist with native keepsake
   provenance or Devotion setup. Trace a concrete differing-source case before
   claiming all `SetupRoomReward` post-hooks are too late.

## Maintenance and next decision

The delivery priority is correctness, then proven unnecessary machinery, then
bounded adapter-contract corrections, then condition-override adjudication.
The owning integration invariant prefers copying a published answer, then
specific RNG steering, with native recreation last. The mode and lifetime
matrices describe current contacts; they are not mandates to replace direct
insertion with RNG hooks or to redesign the runtime.

This audit is actionable enough for a focused correction plan; it is not an
authorization to implement those corrections. Keep the complete census while
adjudicating the rows. Avoid a rewrite: most contacts are legitimate narrow
selectors or explicit coordination points.

For each runtime discovery, update the owning row with the native sequence,
planner payload, observed failure and final disposition; distinguish source
evidence from tested/live evidence. Update the relevant existing durable
contact inventory when a discrepancy is settled. At delivery closure, promote
the accepted per-hook evidence into that existing audit neighborhood, retire
this temporary investigation, and keep one owning policy document rather than
two contradictory inventories. If a probe remains unresolved, retain only its
bounded question and evidence.
