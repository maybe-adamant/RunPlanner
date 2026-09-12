# Executor hook correctness and intervention cleanup

## Status and baseline

Status: locked; A1 resumes after planner Fields Forfeit correction `550a56a7`.
The user-approved A1 amendment retains steering and records completed Fields
contents/positions as diagnostics only. Native Forfeit creates the Onion;
existing room-exit conformance remains unchanged.

A1 implementation and independent review are complete locally, with no
actionable review findings. Verification: `lua tests/all.lua` 434/434 passed;
`luacheck src/` zero warnings/errors across 93 files; modpack smoke passed one
module entrypoint and one coordinator pipeline. Live Fields placement remains
pending user testing. A2–A5 and later gates have not been started by this slice.

- Planner baseline: `a400489d`.
- Plan Executor baseline: `3252224`, in sibling repository
  `../run-planner-modpack/Submodules/adamantRunPlanner-Plan_Executor`.
- The paused executor A1 draft changes `room/features/fields.lua`,
  `native_bindings.lua`, and `tests/room/test_fields_features.lua`. Amend it in
  place: retain the coordinator fix, remove the new placement mismatch proof
  and unsupported `acquisitionEnabled`-to-Onion inference. Admission logging
  remains separately committed as `3252224`.
- Evidence: [hook audit](../investigations/executor-hook-audit/README.md), its
  168 expanded registration rows, mode classifications, and thread-lifetime
  dispositions. Source findings are not claims of live reproduction.
- Per-outcome execution contract:
  [published outcome/native-contact matrix](../investigations/executor-hook-audit/OUTCOME_INTERVENTIONS.md).
  Its per-product recommendations are the default intervention decisions for
  this plan, not optional background. Keep those decisions unless concrete
  source evidence disproves them; update the affected row before changing
  approach. Open condition and timing dispositions remain open; locking the
  plan does not treat those questions as resolved.

## Objective

Make the existing executor reliably realize the planner's published outcomes
through narrow native contacts. Correct concrete failures first; remove proven
dead weight second; clarify and correct adapter contracts third; adjudicate
condition overrides last. This is not another executor architecture rewrite.

The user-visible outcome is correct planned Fields content, random-level
pickups, encounter effects, and NPC trades, with no realization after the
session has become passive and no scope leakage after a native fault.

## Governing invariant and authority

[Game Integration Boundary](../design/GAME_INTEGRATION_BOUNDARY.md), especially
“Prefer the published answer,” exact source correlation, mismatch
classification, and native continuation, governs this plan.

Apply that authority through the outcome matrix's specific recommendations,
not a fresh interpretation of the preference hierarchy for each gate. This
plan does not authorize native behavior recreation; a demonstrated need for it
requires explicit evidence and approval.

Ownership stays unchanged:

- Catalog owns source-backed declarations. No catalog correction is currently
  established by this audit.
- Engine owns resolved outcomes, semantic owners, dependencies, and conformance
  products. Compiler copies those facts; it does not infer new meaning.
- Executor owns binding, native-input translation, outcome insertion/steering,
  local DAG coordination, and existing checkpoints.
- Planner UI, authored schema, protocol, route architecture, and new mismatch
  families are out of scope. If a missing engine product is proven, pause that
  item for an explicit amendment rather than invent it in Lua.

Native evidence is the supplied `../../1GameData/Scripts` snapshot. Use exact
functions/callers identified in the matrices; do not reread broad game data or
re-audit unrelated feature families for each gate.

Every implementation packet must name the outcome-matrix row, exact exported
fields, native contact, recommended intervention, native work retained,
specific defect/question, expected deletion (or explicitly none), and focused
acceptance witness. The preference hierarchy alone is not an implementation
specification. Do not reopen settled insertion-versus-selection decisions in
each task. A deviation must identify what it replaces, why the existing
recommendation fails, and why the published answer cannot be applied more
directly without recreating native work.

### Gate A intervention contracts

| Unit | Exported product                                                         | Fixed intervention direction                                                                                                                                                                |
| ---- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1   | `overview.fields` entry/placement/optional rewards; target `cageRewards` | Use the real occurrence; retain native cage construction and published inputs. Record planned/observed contents and placements as diagnostics only; existing exit conformance is unchanged. |
| A2   | Acquisition role `levelResolution.selectedTarget/levelCount`             | Supply native `AddStackToTraits` target/count arguments through the existing accepted direct-level carrier. No new random-target selector or purchase implementation.                       |
| A3   | `encounterPhases[].figLeafSkip`                                          | Select the exact native skip roll; preserve native skip conditions, charge/latch handling and spawning.                                                                                     |
| A4   | Nemesis trait-trade `traitKey/response`                                  | Insert the target into native sell selection. The player chooses the response; native trade/removal remains native.                                                                         |
| A5   | Anvil/Twist transformation result; Shrine `purchase.roomDelay`           | Preserve existing native selectors; correct their admission and fault-cleanup scopes, not the outcome application mechanism.                                                                |

## Gate A — Correctness at existing contacts

Deliver in the following bounded review units. Each can be a focused fix
commit after independent review; do not combine six unrelated bugs into one
large rewrite.

### A1: Fields context and completed-content diagnostics — H01/H07

A1 is independently reviewable. Keep its wiring correction and bounded
diagnostic snapshot together; do not build a structural-check framework.

- Start: `src/mods/room/features/fields.lua`, `room/coordinator.lua`,
  `room/session.lua`, `room/features/structure.lua`; `tests/room/test_fields_features.lua`.
- Read native `RoomLogic.lua` cage generation and `EncounterLogic.lua`
  Nemesis placement contacts cited in World.
- Consume the real room-session occurrence instead of the erroneous raw-room
  shape. Prove existing layout, cage/optional rewards, and Nemesis placement
  can arm through actual coordinator composition.
- Placement and completed-content observations are diagnostic, not mismatch
  conditions. At the existing pre-presentation contact record planned entry
  points, cage offers/points, optional rewards/points, and Nemesis point beside
  the observed native objects, IDs, spawn points and available locations.
  Report missing objects/data as observations; do not assert exact coordinate
  equality or require metadata native restore records do not retain.
  Make this snapshot readable in the normal diagnostic log without requiring
  a mismatch, once per emitted snapshot. The existing mismatch-only shallow
  formatter is insufficient; use a bounded Fields reporting contact, not a
  general logging redesign.
- Preserve original cage reward inputs. The diagnostic may show an original
  Boon/Hermes alongside an actual Onion, without interpreting Forfeit or
  inferring substitution from `acquisitionEnabled`. No new wire field.
- Existing acquisition steering, DAG and room-exit conformance remain intact.
  Neither positional drift nor a content observation itself halts the session.
  Required native API faults still propagate; diagnostics are not a catch-all
  exception handler. Snapshot data must not remain live references to objects
  that can subsequently move or mutate.
- Acceptance: real coordinator-shaped session arms steering; a bounded native
  product snapshot records correct, missing, displaced and Onion observations
  without mismatch or lost native continuation. Use legal optional consumables,
  distinct cage/reward IDs, and native object registries. No fabricated optional
  boon or duplicated game-rule interpreter in tests. Remove the superseded
  `fields.prove` path and the draft's Onion binding, not merely downgrade its
  return value while retaining its assertions.

### A2: Direct random-level carrier — H02

- Start: `room/timeline/acquisitions/levels/hooks.lua`, direct carrier/binding
  helpers, and `tests/room/test_level_acquisitions.lua`.
- Native: `ConsumableData.lua` StoreRewardRandomStack;
  `InteractLogic.lua` accepted use/thread dispatch; `TraitLogic.lua`
  UseStoreRewardRandomStack and AddStackToTraits.
- Route published Pom Slice level outcomes through the existing direct-level
  settlement, not a second purchase or Supply Chain implementation.
- Acceptance: generated/picked-up and purchased Pom Slice contacts use the
  same published target/count; GiftDrop remains correct; threaded redispatch
  does not retire the owner before actual effect entry or apply levels twice.
  One composed carrier witness complements the existing target-policy tests.

### A3: Exact Fig Leaf decision — H03

- Start: `keepsakes/fig_leaf.lua`, existing encounter-effect tests;
  native HandleEncounterPreSpawns, HandleEnemySpawns, HandleNextSpawn.
- Bind the intended skip decision. Do not implement native encounter skipping
  or treat the first arbitrary RandomChance as that decision.
- Acceptance: planned skip/no-skip follows the native skip path; when native
  pre-spawn has cleared CanEncounterSkip, the later Vow enemy-substitution roll
  remains native. Include the concrete nested-call witness from the audit.

### A4: Nemesis trait-trade surface — H04

- Start: `room/timeline/encounters/nemesis.lua`, Nemesis tests;
  native NPCData GiveOptions/SellTrait, TradeLogic, and room SellOptions.
- Put the published target at the native sell-selection surface, preserving
  native trade response, payment, and removal. Do not invent a trait-named
  GiveOptions row or expand transaction-result verification.
- Acceptance: accepted/rejected trade uses native behavior with the correct
  offered trait; free-item behavior remains covered by its existing witness.
  Leave broader deferred completion policy to Gate C unless it prevents this
  fix from being truthful, in which case amend the boundary before proceeding.

### A5: Passive-mode and exception scope hygiene — H05/H06

- Start: `room/timeline/transformations/use.lua`, Anvil/Twist selectors,
  `room/features/inventory/button_hooks.lua`, owning tests.
- Only an admitted action may arm subsequent realization. A failed exact
  prerequisite check must leave later native callbacks in that call native.
- Restore shrine delay context on exception and rethrow the original fault.
- Acceptance: failed begin followed by native Anvil/Twist callbacks cannot
  steer; native operation still runs. A throwing shrine button builder cannot
  affect a later unrelated RandomInt. Successful paths remain unchanged.

## Gate B — Remove proven unnecessary machinery

- H09: remove the unused visible-Pom UseLoot marker wrapper and only its dead
  transport/test setup. Keep useful outcome witnesses, not historical tests
  whose sole assertion is that the removed mechanism no longer exists.
- H08: trace NPC option-specific preparation, then remove the redundant
  eligibility preflight if it adds no required construction input. Retain
  native preparation and exact planner-row insertion. Do not strengthen or
  recreate eligibility checks in its place.
- Inspect `UseExitDoor` against the actual host registration/caller chain.
  Lua-source absence alone is insufficient proof that it is dead. Remove only
  if redundant/unreachable is established; otherwise retain a bounded probe.
- Acceptance: existing NPC preparation/choice and level acquisition witnesses
  exercise the remaining path; deletions have no replacement shadow path.
- One cleanup commit is appropriate if these remain small. Do not refactor
  directories, imports, or session APIs merely to consolidate this work.
- There is no hook-count reduction target. Keep straightforward result
  insertion, necessary bindings, and useful tests; do not replace deleted
  machinery with new RNG plumbing merely to make the remaining code uniform.

## Gate C — Bounded contract and lifetime correction

This gate is a bounded list of unresolved contract questions, not a new adapter
design pass. The outcome matrix already recommends the intervention. Establish
only the missing owner transport, scope duration, or begin/terminal fact below;
then correct a demonstrated defect or record “retain.” No global DAG or
mismatch-policy changes, thread manager, event bus, callback manifest, or
coroutine-wide active action are permitted.

| Unit                               | Question to resolve                                                                                                                                                                                                      | Intervention retained / bounded acceptance                                                                                                                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1 — Acquired consequence handoff  | Does native threaded dispatch outlive ordinary equip or NPC selection scope? Cover immediate keepsake results, Circe/Icarus, All Together, Natural Selection and Bridal Glow, including their nested Stone/BBB carriers. | Keep the outcome matrix's native targets/selectors. Prove exact published consequence reaches its callback without depending on an expired active selection. One primary witness per shared lifetime plus representative nested-carrier contact, not a source permutation suite. |
| C2 — Mystery construction lifetime | Must unwrap context remain active after native provider construction, or only provider identity?                                                                                                                         | Keep `ForceLootName` insertion and ordinary trait-row insertion. Verify later animation/wait cannot expose unrelated loot to construction-only context. Do not retain a producer chain merely to prove acquisition.                                                              |
| C3 — Spell/Path lifecycle          | When do pregeneration, tree construction and talent-screen entry/return actually occur relative to their owner scope?                                                                                                    | Keep the published partial Hex's native construction and existing Path application. Prove scope covers the required contact without assuming synchronous menu dispatch; do not build an unexported complete tree or automate Path choices.                                       |
| C4 — Dynamic refill/wheel context  | Which source/slot/wheel identity must survive native waits, and when should generation-only selectors retire? Are current begin contacts later than the irreversible action?                                             | Keep exact replacement inventory and wheel content copying/count selection. Use real published prerequisites to test readiness and an unrelated intervening contact to test isolation. No purchase-policy reconstruction.                                                        |
| C5 — Nemesis coordination          | Does spawn/text selection begin the owner too early? What published terminal is reached before/after deferred exchange?                                                                                                  | Keep native trade behavior and Gate A's corrected offer surface. Use an actual prerequisite-bearing owner; do not equate steering completion with proof of response/removal or add callback-local semantic mismatches.                                                           |
| C6 — Admission wording             | Does the durable description match the tested CreateNewHero-before-construction admission?                                                                                                                               | Resolve H10 in documentation after checking the owning tests. No startup behavior change to satisfy stale prose.                                                                                                                                                                 |

For each unit, record the native sequence, minimal carried data, exact consumer,
retirement point, and evidence status in the existing outcome/lifetime rows.
If a proposed fix needs a different intervention, first amend that row with
the source-backed reason; a meaningful product/policy expansion requires user
approval. There is no production-edit quota.

Acceptance is a representative native-sequence witness for each changed
contract, including relevant deferred return/yield and an unrelated intervening
contact. Synchronous nested stubs are not proof of actual host scheduling.
Where source and local harness cannot establish it, request a bounded live
probe and leave the question explicitly open; do not fabricate proof or block
unrelated finished work. No deployment without user direction; any authorized
local deployment uses `--fast`.

Commit each coherent corrected family separately. A source-backed “retain as
is” disposition is valid; this gate has no quota of production edits.

## Gate D — Condition overrides under the clarified invariant

Adjudicate the seven groups in INTERVENTION_MODES, rather than blanket-removing
functions named Eligible. For each record: native condition, published answer,
whether it is a construction input or gameplay precondition, simplest supported
contact, retained native application, and a concrete witness.

- Sea Star: determine whether its actual chance read can remain native while
  forcing the roll. Do not force the gate open merely to guarantee a callback.
- God Sent absence: assess complete-tree insertion versus the current
  requirements suppression without reproducing talent generation. The current
  export is only layout/special identities, not a complete native tree; retain
  that matrix recommendation unless a smaller truthful native input is found.
- Structural Chaos/Well/Pool/Shrine presence: preserve the explicit published
  room-content contract. Gate substitution can be retained as a documented
  construction technique if its effects are confined to that realization.
- ZagreusContractSuccess: trace every affected use before treating the flag
  as a harmless spawn input.
- Reward eligibility filters: preserve exact published reward selection and
  native bookkeeping; no new bag/store policy in the executor.
- NPC preflight: consume Gate B's settled disposition, do not revisit or
  implement a second alternative.
- Final level count/Fated bonus: prevent double application. Keep current
  final-value insertion if that is the smallest truthful adapter; do not
  change engine products merely to make the hook look more native.

Acceptance: direct insertion and legitimate scoped rolls remain functional;
any removed override has a demonstrated native path to the published result.
An unresolved necessity or meaningful policy expansion requires user decision,
not speculative recreation. Implementation commits follow the specific family,
not a single sweeping “remove condition overrides” change.

Record one explicit result for each condition group: retain with bounded native
input justification, remove with proven native replacement path, correct a
specific overreach, or await a named decision/probe. None may be treated as an
undifferentiated instruction to remove eligibility overrides.

## Verification and delivery routine

- Main owns base inventory, finding disposition, commits, and final review.
  Delegate one bounded write-capable review unit at a time with exact starting
  files and native contacts above; reuse its executor for remediation. Use a
  fresh independent reviewer after the unit stabilizes.
- Primary tests remain with their existing adapter families; use the existing
  shared game harness and a representative real coordinator/product contact
  where the defect was hidden by a fabricated shape. No duplicate game rules
  in helpers, giant new fixture, exhaustive callback permutation suite, or
  durable tests for removed implementation names.
- Resolve actual test locations/runner registration before dispatch. Run the
  narrow owning tests during work; executor closure runs `lua tests/all.lua`
  and `luacheck src/` from the executor root. Check modpack smoke at integration
  closure if registration/composition changed. Do not run the planner-wide
  correctness suite for isolated Lua or documentation edits.
- No fixture regeneration or schema/protocol bump is expected. If a semantic
  wire gap requires an approved amendment, follow planner-owned generation,
  byte-for-byte mirroring, and bounded fixture churn rules.
- Existing user edits and the separate Postboss recovery plan are not silently
  absorbed or declared closed by this plan.

## Closure and retirement

Track implementation/review status separately from native-evidence status for
each unit. A corrected and locally verified unit may be committed while a
specific live probe remains pending; it must not be reported as live-verified.
An unavailable host-timing proof leaves that question open, not an invitation
to add speculative safeguards or stall unrelated corrections. Overall evidence
closure still requires resolving or explicitly deferring those questions with
the user.

Update the existing durable `docs/audits/game-execution-contacts/` inventories
with accepted contact evidence, classifications, and lifetime justifications.
Keep the cross-cutting preference invariant in GAME_INTEGRATION_BOUNDARY, not
duplicated competing policies. Merge outcome recommendations and thread/mode
dispositions into the existing owning family inventories as columns or focused
notes; do not preserve parallel permanent policy/matrix documents. The census
is a completeness check, not another permanent maintained registry. Retire the
temporary documents and this plan after their useful evidence is absorbed;
keep only bounded unresolved probe questions if live proof remains pending.

The final review checks correct behavior, native continuation, ownership,
retired paths, justified lifetimes, and no hidden semantic translation. Fewer
hooks or files are not acceptance criteria. No gate is closed on mock evidence
when its stated acceptance requires an unavailable native scheduling probe.
