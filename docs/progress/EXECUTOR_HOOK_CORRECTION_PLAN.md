# Executor hook correctness and intervention cleanup

## Status and baseline

Status: locked; Gates A and B complete. The final Gate B room-close correction
is committed in executor `ab7fcbe`. C1 (`ee1b31b`) and C2 (`9355a83`) are complete;
C3 is complete (`2f981b0`); C4 wheel (`a8d9eb1`) and inventory (`d5fdcf9`)
handling are complete. C5 is complete (`0d2ac61`), with the separate Mystery
composition witness correction in `bfb87df`. C6 admission wording is corrected.
Gate C is complete; Gate D has not started.
Fields Forfeit was corrected in the planner separately (`550a56a7`). The
user-approved Fields amendment retains steering and records completed contents
and positions as diagnostics only; native Forfeit creates the Onion and
existing room-exit conformance remains unchanged.

| Unit | Executor commit | Independent review and verification                                                                         |
| ---- | --------------- | ----------------------------------------------------------------------------------------------------------- |
| A1   | `789c42b`       | Passed; 434 executor tests, clean luacheck, modpack smoke passed.                                           |
| A2   | `5433248`       | Passed; direct-level and composed-carrier witnesses, 436 executor tests.                                    |
| A3   | `dc08c5f`       | Passed after adding the exact cross-handler regression witness; 8 focused tests and clean luacheck.         |
| A4   | `46e7a7b`       | Passed; 7 focused tests and clean luacheck, including both Pool/Nemesis hook orders.                        |
| A5   | `cd46cf4`       | Passed; 15 transformation and 14 feature-hook tests, including rejected admission and native-fault cleanup. |

Gate A closure: `lua tests/all.lua` passed 450/450; `luacheck src/` reported
zero warnings/errors in 93 files; modpack `lua tests/smoke.lua` passed one
module entrypoint and one coordinator pipeline. No protocol, fixture, catalog,
engine, or application changes were needed. The planner-wide suite was not
rerun for this isolated Lua/documentation delivery. No deployment or push.

Live-game verification remains pending; source and harness evidence are not
claims of tested host scheduling. Gate C retains the separate unresolved
deferred-menu and callback lifetime questions.

- Planner baseline: `a400489d`.
- Plan Executor baseline: `3252224`, in sibling repository
  `../run-planner-modpack/Submodules/adamantRunPlanner-Plan_Executor`.
- A1 replaced the paused placement-mismatch draft with the accepted diagnostic
  contact; no `acquisitionEnabled`-to-Onion inference or draft native binding
  remains. Admission logging is separately committed as `3252224`.
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

H08/H09 implemented in executor `e6e166f` and independently reviewed with no
actionable findings. Verification: 448/448 executor tests, clean luacheck for
both changed production files, and passing modpack smoke. Removed marker and
preflight-only setup; retained native preparation, row metadata, level/Sea Star
outcome witnesses, and strengthened the preparation/reordering witness.
The remaining unit removes the unproven `UseExitDoor` contact and checks its
published `exitUsable` obligations at actual room closure. Local verification:
449/449 executor tests, clean `luacheck src/`, passing modpack smoke, and clean
diff checks. Independent review found no actionable issues and independently
reran all 449 executor tests successfully. Gate B is complete in `ab7fcbe`.
No deployment or live-game verification.

- H09: remove the unused visible-Pom UseLoot marker wrapper and only its dead
  transport/test setup. Keep useful outcome witnesses, not historical tests
  whose sole assertion is that the removed mechanism no longer exists.
- H08: trace NPC option-specific preparation, then remove the redundant
  eligibility preflight if it adds no required construction input. Retain
  native preparation and exact planner-row insertion. Do not strengthen or
  recreate eligibility checks in its place.
- Remove `UseExitDoor`: the supplied native traversal is `AttemptUseDoor` to
  `LeaveRoom`, and ModUtil can register a wrapper without a native base, so
  successful registration is not contact evidence. Check `exitUsable` before
  `roomExit` in existing room closure, before timeline disposal. Keep the wire
  deadline, native continuation on mismatch, and existing route handling; add
  no replacement door-attempt hook or generalized checkpoint machinery.
- Acceptance: room closure catches an unfinished `exitUsable` obligation,
  completed obligations permit closure, and failed departure checks still
  invoke the native departure. Replace synthetic hook invocation witnesses.
- Acceptance: existing NPC preparation/choice and level acquisition witnesses
  exercise the remaining path; deletions have no replacement shadow path.
- One cleanup commit is appropriate if these remain small. Do not refactor
  directories, imports, or session APIs merely to consolidate this work.
- There is no hook-count reduction target. Keep straightforward result
  insertion, necessary bindings, and useful tests; do not replace deleted
  machinery with new RNG plumbing merely to make the remaining code uniform.

## Gate C — Bounded contract and lifetime correction

C1 source disposition: `Main.lua:thread` resumes immediately until a yield.
Ordinary keepsake and Circe/Icarus selectors run before yielding; retain those
scopes and the existing selected-trait consequence carriers. Echo BBB genuinely
waits before constructing its nested menu. Narrow its pending-payload consumer
to that native menu, with a coroutine witness for an unrelated intervening menu.
Do not simulate an unsupported delayed first dispatch to justify new transport.
C1 verification: NPC acquisition 25/25 and acquisition composition 6/6;
changed-source lint and diff checks pass. Independent review passed after
correcting the new coroutine witness to start inside the selected-trait callback.

C2 complete: consume Mystery construction context at `GiveLoot`, bind its
returned native provider directly, and delete the separate `CreateLoot` hook.
The animation retains no construction override. Independent review and
focused tests pass (Mystery 3/3; acquisition composition 6/6), with clean lint
and diff checks. C3 retains the item-bound Spell/Path call stacks and binds Hex
construction to the owner's native spell-trait identity, consuming it before
the one native construction. Independent review and 38 focused tests pass,
with clean production lint and diff checks. The same-spell post-wait witness
proves one-shot retirement rather than just identity filtering.

C4 acceptance refinement: the checked-in Travel Deal fixture has no incoming
refill dependency. Do not invent an acquisition-to-refill edge or move another
owner's terminal to satisfy that proposed witness. Use the real independent
refill product for realization and source-backed wait/interleaving tests; a
denied-begin adapter test covers native continuation only, not a claim that the
planner currently emits such a dependency. Begin at the exact construction
contact before insertion. Any broader dependency claim remains unproven.
C4 wheel verification: independent review, 7/7 focused tests, production lint
and diff checks pass. A source-backed coroutine witness covers immediate
notification/resume, generation isolation, and one-shot reward handoff.
C4 inventory verification: independent review passed after correcting unowned
Well/Shrine refills to bypass initial inventory forcing. All 11 focused tests,
changed-production lint and diff checks pass. Coroutine tests cover a suspended
world restock, unrelated generation, native retry and single completion;
populated initial inventories witness denied/unowned native continuation.

C5 terminal disposition: spawn-time family selection is preparation, not a
transaction begin. Accepted trait exchange completes after native
`TradeDoExchange` returns, bound by the exact outer dialog screen that native
code forwards to it. Replace the global next-`RemoveTrait` observer with that
bounded contact, without verifying the removed trait. Free-item drop binds its
own source; contest begins at native setup rather than timer completion.
Keep unrelated existing diagnostics; this is not a mismatch-policy redesign.
No checked-in prerequisite-bearing Nemesis product has been established. Use
the real event product for native-sequence coverage and a denied-begin adapter
witness for generic continuation, without fabricating a planner dependency.
C5 verification: independent review passed; 9/9 Nemesis tests and 10/10 runtime
composition tests passed, with clean lint and diff checks. The separate stale
Mystery integration witness now follows the returned provider, not its removed
construction hook; independent review and 14/14 feature-interaction tests pass.
C6 confirms `CreateNewHero` admission before native construction; only the
durable wording changed, with existing loadout witnesses retained.

Gate C closure: 463/463 executor tests pass, `luacheck src/` reports zero
warnings/errors across 93 files, and modpack smoke passes one entrypoint and one
coordinator pipeline. The first broad run exposed the stale Mystery test above;
the corrected final run passes. No planner code, protocol or fixture changed.
No deployment or push. Native-source and coroutine harness coverage are not
live-game timing verification; that remains pending user testing.

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

### Locked first delivery group

User-approved contract, based on executor `bfb87df` and planner `252327d4`.
Implement the following three independently reviewed slices, then pause to
discuss the remaining groups. No deployment or push is authorized.

**D1 — Sea Star chance operand.** Each supported planned acquisition owns its
proc/no-proc result. At its bound `DoubleRewardChance` read, insert `1` for proc
or `-1` for no proc. Native multiplies by its positive, at-least-one declared
Luck multiplier and performs `RandomChance` and duplication itself. `nil`
cannot be multiplied; zero is not a guaranteed false result under native `<=`.
Remove the separate `RandomChance` interception and its next-roll arming state.
Retain bounded acquisition context and a diagnostic for a missing chance read,
not proof of duplication. Outside active planner ownership, invoke native.
Primary tests: existing Sea Star and representative carrier/composition tests,
including native RNG consumption, both outcomes with luck, and scope cleanup.
No new execution field or native duplicate creation.

**D2 — Native God Sent.** The executor owns Hex layout and Rare/Epic identities,
not God Sent availability or identity. Remove the forced-false
`ServeDuoGameRequirements` override, God Sent selection and corresponding
missing-result diagnostic. Retain native God Sent creation and later updates,
ordinary tree generation and the D/C-corrected construction lifetime. Planner
simulation still counts the two eligible God Sent nodes for Path availability;
do not change simulation, UI, conformance or remove wire facts in this slice.
Tests exercise native God Sent present/absent behavior while layout and
Rare/Epic steering still work, including starting Selene and later Hex callers.

**D3 — Destination contract presence.** Add explicit
`zagreusContractPresent` to the destination door product for batch and fixed
navigation. Derive it from the same canonical additional-exit fact used for
the destination Overview; no midshop inference, legality replay or executor
look-ahead into destination features. Publish false as well as true. Set the
native destination room flag before its preview is constructed, preserving it
for later native `SpawnZagContract`; remove the spawn-time assignment while
retaining additional-exit binding. Trace `CreateRoom` initialization so native
generation cannot overwrite a published false. Fixed host returns must carry
the same destination fact, without moving ownership of the additional exit.

This is a bounded protocol amendment: engine model/assembly/strict codecs,
Lua decoder and navigation adapter, owning tests and generated fixtures.
One protocol bump; no authored schema bump or save migration. The assembler
copies the canonical fact; it does not derive eligibility. Check agreement
where both door and destination records are published. Preserve established
fixture serialization, regenerate only semantic changes, update unchanged
version scalars mechanically and mirror executor fixtures byte-for-byte.
Primary witnesses: contract present and absent before preview and at native
spawn, fixed destination path, strict protocol decode and one real published
contract route. No generic destination-Overview carrier or new checkpoint.

Each slice removes its superseded path in the same commit. Main owns plan,
docs, Git and closure; one executor writes, independent reviewer checks the
stable slice. D1/D2 use focused Lua tests; D3 also uses engine execution-product
tests and broad repository checks at delivery closure because the protocol
crosses packages. Live timing remains pending user testing.

### Remaining groups — discuss after D1–D3

Adjudicate the seven groups in INTERVENTION_MODES, rather than blanket-removing
functions named Eligible. For each record: native condition, published answer,
whether it is a construction input or gameplay precondition, simplest supported
contact, retained native application, and a concrete witness.

- Structural Chaos/Well/Pool/Shrine presence: preserve the explicit published
  room-content contract. Gate substitution can be retained as a documented
  construction technique if its effects are confined to that realization.
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
- D3 is the approved protocol amendment. Other slices do not change the wire;
  further gaps require an explicit amendment. Follow planner-owned generation,
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
