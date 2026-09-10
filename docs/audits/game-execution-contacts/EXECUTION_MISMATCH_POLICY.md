# Execution mismatch policy

## Purpose and scope

This audit defines when the Plan Executor may stop later planner realization,
what that stop means, and which nearby failures must remain distinct. It covers
the current fixed Underworld and Surface execution boundary. It does not define
new planner eligibility rules, recover a run after divergence, or turn complete
Run State into a blocking comparison.

The central question is not whether the native game called the same functions
the executor expected. It is whether an admitted, planner-owned semantic fact
can still be realized safely or whether the live run has ceased to satisfy the
bounded assumptions used by the remaining plan.

## Vocabulary

Four outcomes must remain separate:

| Outcome             | Meaning                                                                                                                               | Runtime disposition                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Admission rejection | A selected slot is absent, malformed, incompatible, or not a complete execution plan.                                                 | Do not start a synchronized session. Report the inspection/admission error.                                   |
| Executor fault      | The installed game host lacks a required function, native code throws, or an internal decoded-plan/session invariant fails.           | Restore any temporary forcing scope and propagate the fault. Do not describe it as player or plan divergence. |
| Incidental contact  | Native code reached a supported hook, but no compatible ready planner directive owns that contact.                                    | Pass through unchanged. Do not consume a transaction and do not desynchronize.                                |
| Execution mismatch  | A standard or explicitly justified semantic checkpoint proves that the live run can no longer support the remaining simulated prefix. | Preserve the first mismatch, stop all later planner realization, and let the native game continue.            |

`mismatch` is therefore narrower than “something unexpected happened.” It is a
statement about the admitted plan and live run, not a general error channel.

## Current state transition

The live coordinator has one terminal execution transition:

```text
starting/synchronized
  -> first semantic mismatch
  -> desynchronized
  -> all later hooks pass through to the native game
```

`runtime.mismatch` retains the first `{ checkpoint, expected, observed }`
record, disposes the active room coordinator, mirrors the record onto the route
session, and changes the session to `desynchronized: first-mismatch`. Later
contacts cannot replace that first cause. Subsequent state-gated hooks pass
through to the native game, and the reporting root logs the mismatch once.

This is the correct failure effect. Desynchronization must never prevent a
button press, return early instead of calling the native function, block a
door, suppress room creation, or attempt to repair/replan the remaining route.
The next fresh run may admit a plan again. Postboss recovery is a separate
fresh-process admission path, not a way to resume a session after a mismatch.

## Checkpoint validity rule

A mismatch exists to protect the reliability of the next simulated prefix. It
does not exist to prove that each hook, callback, or steering step behaved
exactly as expected.

Between standard checkpoints, adapters are actuators. They may claim a ready
transaction, steer the native result, and complete the transaction to unlock
its published DAG dependents. Completion proves only that the native action
reached its declared terminal contact. It does not prove that steering
succeeded, that the player chose the authored result, or that the resulting
state is correct.

Readiness is different from result verification. A native action that is
correlated to one exact published owner may begin only after that owner's
published prerequisites have completed. Consuming an exact action early is an
immediate mismatch: the action is irreversible, cannot later be replayed in its
authored position, and cannot safely be rebound to some other ready transaction
with a similar payload. The native operation still proceeds after the executor
desynchronizes.

If steering cannot be applied, the default behavior is:

1. record the failed intervention as diagnostic evidence;
2. let native behavior continue;
3. complete the transaction if its native action still reaches the published
   terminal, thereby unlocking its DAG dependents; and
4. let the next applicable room checkpoint decide whether the resulting state
   remains truthful.

The transaction remains incomplete only when the expected action never reaches
its terminal contact. An obligation can therefore prove that a required action
happened by its deadline, but it does not prove the action's semantic result.
That result belongs to structural or named conformance.

```text
DAG completion      = the prerequisite action finished; dependents may run
exact owner binding = the contacted native action, independent of payload similarity
adapter diagnostics = what the executor attempted and where steering differed
room checkpoint     = the resulting planner-visible state is truthful
```

The executor therefore validates boundary state, not the historical trace that
produced it. Two different native action permutations are equivalent when they
respect the published dependencies and close the room over the same bounded
planner-visible state.

This deliberately tolerates imperfect or slightly late forcing when the room
still closes over the exact state required by the next occurrence. The native
game is the fallback after genuine divergence, and runs are disposable. Extra
strictness between checkpoints therefore has little safety value and creates
substantial callback coupling.

A mismatch outside the standard checkpoints is allowed only when it earns that
authority with a concrete case proving all of the following:

- an irreversible planner-visible fact is consumed before the next checkpoint;
- exact-owner binding and action-terminal DAG coordination cannot contain the
  risk without another semantic comparison;
- no published obligation or named conformance fact can detect the divergence;
- continuing planner realization before the next checkpoint is unsafe; and
- the exact native authority and regression witness are recorded.

A native callback being unique to one feature is useful binding evidence, but
uniqueness alone does not create a mismatch checkpoint.

The generic readiness check is the narrow exception that does not require a
feature-specific semantic comparison: once an exact native action is consumed,
an unmet published prerequisite is itself sufficient evidence of divergence.
This does not authorize the executor to re-evaluate trait eligibility,
replacement legality, store legality, or any other planner-owned rule before
steering.

## Standard mismatch checkpoints

### Starting loadout and Postboss admission

The starting weapon, aspect, Arcana set, configured/effective Fear, keepsake,
and authored Hex tree are explicit execution inputs. A difference after native
`StartNewRun` has finished is a legitimate mismatch: the very first authored
room would otherwise start from a different state.

Postboss recovery is deliberately strict. It may synchronize only when the
native room identifies exactly one published Postboss boundary and the bounded
loadout plus nine named conformance families match that entry frame. A failed
recovery attempt may desynchronize because the live run is an attempted
execution session whose starting checkpoint does not match.

An absent, malformed, or incompatible selected slot is different. That is an
admission rejection, not evidence that a live run diverged from an admitted
plan.

### Room entry

After native room setup finishes, these are legitimate blocking comparisons:

- the current room's game name against the next selected occurrence;
- the incoming physical reward, except logical acquisitions and
  native-required effect-neutral boss rewards under their declared policies;
- the published encounter phase surface;
- required room objects and declared Overview feature presence; and
- fixed layout products whose adapter has completed construction.

The occurrence ID stamped onto a native room is executor correlation metadata,
not a native game fact. A conflicting or missing stamp after game-name
resolution indicates an adapter/session fault unless the game name itself is
wrong.

### Room features and inventory

A fixed feature-presence difference at room entry is a legitimate structural
mismatch. Inventory construction after entry is steering rather than another
automatic checkpoint: an interacted Shop, Well, Shrine, or Pool adapter should
constrain its visible rows and then let acquired results, obligations, and
room-exit conformance establish whether the room remains a valid prefix.

Travel Deal is also exact after the planner has published one refill owner. The
published source, carrier, replacement slot, and replacement inventory must be
realizable. `StoreLogic.lua` calls `RestockWorldItem` only after the first World
Shop purchase consumes `FirstPurchaseDiscount`, so every supported
`RestockWorldItem` contact is a Travel Deal refill. This proves the adapter can
bind that contact without inference. It does not require immediate mismatch:
the expected refill completes when the refill action reaches its terminal, and
the resulting acquisition or room-exit state protects later simulation.

Ordinary payment, affordability, prices, and purchase counters are not mismatch
facts. They remain native behavior. A pedestal is likewise not compared as a
gameplay result, but executor-stamped source identity must bind it to its exact
published acquisition owner before steering. This is correlation, not purchase
verification.

### Timeline obligations and dependencies

Only transactions explicitly listed in `timeline.obligations` may fail a
lifecycle checkpoint merely by remaining incomplete. The current publication
policy obligates non-acquisition transactions and excludes acquisitions.

A required non-acquisition transaction still incomplete at its published
deadline is a legitimate mismatch. A generic or observational native contact
with no ready compatible owner passes through. By contrast, consuming a native
action already bound to an exact published owner before that owner's
prerequisites complete is an immediate `transaction-prerequisite` mismatch.
It must not be rebound to another ready owner merely because both actions carry
the same god, reward, item, or callback. Lifecycle windows are legitimate only
as published semantic deadlines. A difference in callback spelling, duplicate
callback, or representation-only callback order is not.

Acquisition completion has a narrower meaning: the executor finished the last
steering intervention needed to release a same-room dependent. An unclaimed or
unfinished acquisition handle does not itself fail room close.

### Steering between checkpoints

Adapters currently attempt exact steering for these families:

- installing exact Boon, Hermes, Hammer, NPC, Chaos, Spell, Hex, or Path offer
  rows;
- selecting a planner-owned random target or result for Jeweled Pom,
  Transcendent Embryo, Steady Growth, Aromatic Phial, Concave Stone, All
  Together, Natural Selection, Anvil, Artificer, Circe, Icarus, and similar
  explicitly steered effects;
- constraining an authored Nemesis result or exact encounter phase; and
- placing H Fields cage/optional rewards, Ephyra board/side-room facts, and
  Thessaly wheel outcomes at their verified native construction contacts.

Failure to apply one of these instructions does not automatically earn a new
mismatch point. The adapter records the failure, lets the native action finish,
and completes the owner if its terminal is reached. Published dependents then
become ready according to action order, while the next checkpoint judges the
resulting state. This keeps the adapter from becoming a second semantic
validator.

In particular, exact trait forcing trusts the planner's validated offer and the
player's authored selection. The executor does not run `IsTraitEligible`, duo
requirements, replacement constraints, or another offer-legality pass before
installing the rows. A different player selection is allowed to become an
invalid room state and is judged by the applicable room-exit facts. This is
separate from attempting a later exact transaction before its published DAG
prerequisite: the latter is known without re-evaluating trait semantics and
desynchronizes immediately.

For an ordinary acquisition, a later player selection is not adapter-local
proof. If the planner selected a durable result, the appropriate named
room-exit fact proves it. Simulation-neutral acquisitions intentionally have no
blocking proof. A non-acquisition encounter interaction completes only when its
declared native action terminates. Its obligation proves participation by the
deadline; any consequential result is proved separately by structural or named
conformance.

### Doors ready and room exit

Immediately before native room exit, the complete published Doors product is
blocking:

- normal and additional exit counts;
- physical order where the plan publishes physical slots;
- destination game names;
- reward identities and provider sources;
- shared reward store;
- H cage rewards attached to the outgoing target; and
- exact additional-exit owner/kind correlation for Chaos and Zagreus Contract.

The executor does not compare transition callback names or require a special
transition trace for Chaos, Contract, Anomaly, Hub restoration, or side-room
return. It proves the doors at the room that owns them and proves the next room
when that room begins.

After obligations settle, room exit compares only the planner-selected named
facts:

1. `traitInventory`;
2. `elementCounts`;
3. `steadyGrowth`;
4. `chaos`;
5. `keepsakeEffects`;
6. `rewardPriorities`;
7. `pathOfStars`;
8. `forfeit`; and
9. `stygianWell`.

A difference is legitimate because the following occurrence was simulated
from that retained state. The comparison is exact only over the published
projection; unmodeled native traits and state remain outside it.

## Facts that must not desynchronize execution

The following are useful observations or native implementation details, not
independent mismatch causes:

- complete Run State diagnostics outside the sparse named conformance set;
- health, Magick, healing, Armor, Gold, ordinary meta-progression currency,
  damage, and price amounts that the planner deliberately treats as neutral;
- an untouched optional authored action that was omitted at publication;
- an acquisition handle that was never claimed or never reached a later native
  terminal;
- a claimed steering instruction that could not be applied, when leaving its
  owner incomplete and checking the next standard checkpoint is sufficient;
- a different player acquisition choice when no explicit named conformance
  fact makes the durable result blocking;
- an unbound or duplicate native callback;
- a callback name, callback count, or representation-only ordering difference;
- a native-only room object such as Ephyra Soul Pylons;
- ordinary Shop/Well/Shrine payment and purchase provenance;
- exit transition strings or the internal native object used to carry a room
  between generation callbacks; and
- executor-side re-evaluation of whether the planner-authored choice was legal.

The planner's validated execution document is authoritative for legality. If
the game cannot realize an authored fact despite the player following the
plan, that mismatch is evidence for planner/game-data under-modeling and must
be adjudicated at the owning planner or source-data boundary. The executor must
not silently substitute another result.

## Mismatch disposition matrix

The matrix below classifies the complete current mismatch surface by semantic
owner. It is intentionally organized around the fact being protected rather
than the Lua function that happened to observe it. Every current direct
`mismatch` producer belongs to one of these rows.

The disposition terms are:

- **keep**: this is a standard semantic checkpoint and may stop later
  realization;
- **aggregate**: preserve the comparison, but decide it once at the owning
  standard checkpoint rather than inside a construction callback;
- **defer**: a steering failure is diagnostic; action termination still unlocks
  DAG dependents, and structural or named conformance judges the result;
- **readiness mismatch**: an exact native action was consumed before its
  published prerequisites completed;
- **exact binding**: a required correlation invariant that selects the owner to
  steer but does not itself compare a gameplay result;
- **fault**: this is a host, decoder, binding, or coordinator invariant, not
  plan divergence; and
- **pass through**: no blocking comparison is warranted.

### Admission and outer-session matrix

| Current fact or failure                                                               | What it protects                                                 | Existing later protection                                                                                                              | Disposition             | Reason                                                                                                                                                      |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing, malformed, or incompatible selected plan                                     | Whether an execution session can be constructed                  | None is needed because no plan was admitted                                                                                            | **Admission rejection** | Calling this a mismatch invents a divergent run before synchronization exists.                                                                              |
| Postboss recovery has no unique matching occurrence                                   | The one permitted mid-run entry point                            | Recovery cannot proceed without an occurrence cursor                                                                                   | **Keep**                | This is the recovery admission checkpoint itself.                                                                                                           |
| Postboss loadout or named entry frame differs                                         | Whether the recovered run equals the published Postboss boundary | No earlier checkpoint exists in a recovered process                                                                                    | **Keep**                | It directly determines whether later simulation is trustworthy.                                                                                             |
| Published starting-loadout product is absent after successful decode                  | Decoder/composition completeness                                 | Strict decode should make it unreachable                                                                                               | **Fault**               | Absence is not a player-selected loadout difference.                                                                                                        |
| Native weapon, aspect, Arcana, Fear, keepsake, or Hex differs after `StartNewRun`     | The starting state of the first simulated occurrence             | First room exit is too late to establish initial admission                                                                             | **Keep**                | This is the ordinary run-start checkpoint.                                                                                                                  |
| A nested starting Hex or keepsake-result steering callback misses a candidate/contact | Whether one start-time actuator succeeded                        | The completed post-`StartNewRun` start projection should observe the durable result; otherwise the first room's named conformance does | **Aggregate/defer**     | The nested callback is not a second start checkpoint. Any missing start projection is a publication gap to close, not a reason to retain callback mismatch. |
| Route enters a different native game name                                             | Whether the cursor reached the next selected occurrence          | None before that room is realized                                                                                                      | **Keep**                | Native room identity is a standard room-entry fact.                                                                                                         |
| Occurrence stamp differs while game name and route position agree                     | Executor correlation integrity                                   | The route cursor and game name already identify the semantic occurrence                                                                | **Fault**               | The stamp is executor-owned metadata, not live game state.                                                                                                  |
| A second room enters before the active room closes, or route exit has no active room  | Route/coordinator lifecycle integrity                            | None; this indicates a missed or misordered host contact                                                                               | **Fault**               | It is not a legal alternate player outcome.                                                                                                                 |

### Room-entry and structural matrix

| Current fact or failure                                          | What it protects                       | Existing later protection                                                                                   | Disposition   | Reason                                                                                                                                                                                    |
| ---------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current room game name                                           | Correct occurrence realization         | Next-room checks would be based on the wrong room                                                           | **Keep**      | Standard room-entry checkpoint.                                                                                                                                                           |
| Incoming physical reward and provider                            | Correct room-local acquisition surface | A neutral pickup may leave no retained-state evidence                                                       | **Keep**      | This is deterministic room content, with the documented logical/boss-reward exclusions.                                                                                                   |
| Encounter phase count and identities                             | Correct native encounter envelope      | Timeline hooks cannot bind safely to the wrong phase surface                                                | **Keep**      | Standard room-entry structure.                                                                                                                                                            |
| Missing or duplicate native encounter-phase binding              | Adapter binding integrity              | Strict phase proof already supplied the expected surface                                                    | **Fault**     | The adapter failed to correlate a proved structure.                                                                                                                                       |
| Required object and ordinary feature presence                    | Correct room Overview realization      | A missing uninteracted feature may leave no later state delta                                               | **Keep**      | Standard room-entry structure.                                                                                                                                                            |
| H cage, optional-reward, entry/exit, and Nemesis point layout    | Correct fixed Fields layout            | Cage rewards are also checked in Doors, but spatial and optional placement are not generally retained state | **Aggregate** | Preserve one complete Fields layout proof at the end of native room construction; individual `RemoveRandomValue`, reward-choice, and spawn callbacks do not each earn mismatch authority. |
| A room declaration or required room adapter capability is absent | Executor installation/composition      | Strict plan decode and module construction should make it unreachable                                       | **Fault**     | This is not a native divergence.                                                                                                                                                          |

### Navigation and Doors matrix

| Current fact or failure                                                                                             | What it protects                                                        | Existing later protection                                                                                                     | Disposition      | Reason                                                                                         |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| N's initial Hub board room/reward set                                                                               | The fixed first Hub navigation surface                                  | Side-room entry cannot prove doors that were never offered                                                                    | **Keep**         | This is the owning first Doors-ready checkpoint; the board is not rechecked after every visit. |
| Normal/additional exit counts, targets, rewards, providers, shared store, H cage payloads, and additional-exit kind | The exact outgoing navigation product                                   | The next room can prove only the door actually taken, not omitted or incorrect peer doors                                     | **Keep**         | Standard Doors-ready checkpoint.                                                               |
| Door transition callback name, exit object identity, or transition trace                                            | Native implementation detail                                            | Outgoing Doors and next room identity bracket the transition                                                                  | **Pass through** | Chaos, Contract, Anomaly, Hub restore, and side-room return need no transition mismatch.       |
| O wheel result cannot be steered or the selected result differs                                                     | A published non-acquisition wheel transaction and its downstream reward | Reaching the wheel terminal satisfies its obligation and releases dependents; durable acquired results are checked separately | **Defer**        | Exact wheel callback success is not an additional checkpoint.                                  |

### Feature inventory and refill matrix

| Current fact or failure                                                                                | What it protects                               | Existing later protection                                                                                                                                                               | Disposition       | Reason                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shop, Well, Shrine, or Pool inventory generation differs from the authored rows                        | Whether the player sees the intended inventory | Consequential purchases produce acquisition/item-effect state; Pool removal is in `traitInventory`; Well effects are in `stygianWell`; neutral omissions do not affect later simulation | **Defer**         | Inventory construction is steering after room entry, not a new checkpoint.                                                                                                        |
| Two planned store offers share a native carrier or provider                                            | Exact acquisition steering and DAG ownership   | Room-exit conformance would detect the resulting state only after the executor had already steered the wrong payload                                                                    | **Exact binding** | Preserve the Overview offer identity through the materialized native object and bind it to that offer's acquisition owner. Do not correlate by god, item kind, or authored order. |
| Travel Deal refill source or replacement slot differs                                                  | Exact refill binding and inventory steering    | The refill is a published non-acquisition transaction with an obligation; its dependent remains locked while incomplete                                                                 | **Defer**         | `RestockWorldItem` is uniquely Travel Deal, but contact uniqueness proves binding, not mismatch authority.                                                                        |
| `RestockWorldItem` occurs with no compatible published refill                                          | Incidental native contact                      | No planner owner was claimed                                                                                                                                                            | **Pass through**  | An unowned contact cannot diverge from an admitted semantic owner. If source evidence says this is impossible, log it diagnostically rather than desynchronize.                   |
| Payment, price, affordability, purchase count, or native pedestal provenance beyond its executor stamp | Native commerce implementation                 | Planner legality and later acquired/effect state                                                                                                                                        | **Pass through**  | These facts are intentionally outside the execution contract; the stamped exact source key remains required correlation metadata.                                                 |

### Acquisition and targeted-effect matrix

| Current producer family                       | Representative current checkpoints                                                              | Existing protection                                                                                                                                   | Disposition      | Reason                                                                                                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Ordinary Boon/Hermes/Hammer and level screens | `trait-offer-install`, `trait-selection`, `level-offer-install`                                 | Action termination unlocks DAG dependents; `traitInventory`, keepsake effects, and other named state prove durable results                            | **Defer**        | Acquisition callbacks steer and coordinate order; they are not semantic proof.                                                             |
| Chaos, Spell, Hex, and Path screens           | `chaos-trait-offer`, `spell-offer-*`, `hex-tree-*`                                              | The acquisition terminal releases dependents; `traitInventory`, `chaos`, and `pathOfStars` prove modeled state                                        | **Defer**        | Missing native rows/contact are steering failures, except malformed decoded payloads, which are faults.                                    |
| Mystery-provider unwrap/binding               | `timeline-binding` for a Mystery provider                                                       | The resulting trait acquisition and local dependencies                                                                                                | **Defer/fault**  | No compatible provider is incidental and passes through; two contradictory bindings are an internal fault. Neither is a semantic mismatch. |
| NPC offer and selection steering              | `npc-trait-offer`, `npc-trait-selection`, Echo last-run, Circe, and Icarus selection checks     | The encounter interaction remains obligated; resulting traits/Arcana are reflected by the transaction and named durable state                         | **Defer**        | Specialized menu shape does not create a special mismatch policy.                                                                          |
| Trait-carrier side effects                    | `all-together-grant`, `natural-selection-order`, `sea-star-chance`, targeted acquisition target | The outer action terminal releases dependents; generated/changed traits are in `traitInventory`                                                       | **Defer**        | The planner owns legality; the adapter only steers native selection.                                                                       |
| Keepsake and automatic trait targets          | Aromatic Phial, Concave Stone, Transcendent Embryo, Jeweled Pom/equip results, Steady Growth    | Non-acquisition actions retain obligations where applicable; `traitInventory`, `steadyGrowth`, `chaos`, and `keepsakeEffects` prove retained outcomes | **Defer**        | A missing candidate does not justify stopping inside the callback.                                                                         |
| Simulation-neutral direct pickups             | Health, Magick, Armor, healing, Gold, ordinary meta progression                                 | Deliberately none                                                                                                                                     | **Pass through** | Failure to observe or settle these cannot invalidate the next simulated prefix.                                                            |

### Encounter, transformation, and automatic matrix

| Current producer family                                 | Representative current checkpoints                                        | Existing protection                                                                                                               | Disposition      | Reason                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| Nemesis event result and response                       | `nemesis-event-family`, trait trade/removal, response, contest, free item | The encounter-interaction transaction has an explicit obligation; durable trait changes use `traitInventory`                      | **Defer**        | Complete at the bounded terminal; the obligation proves participation, not the chosen result. |
| Boss Arcana outcomes                                    | `boss-arcana-cardinality`, `boss-arcana-selection`                        | The automatic transaction is obligated at its declared checkpoint                                                                 | **Defer**        | The target loop is steering inside one obligated outcome.                                     |
| Other automatic outcomes                                | `steady-growth-target`, Embryo target                                     | The automatic terminal releases dependents and named conformance covers its retained effect                                       | **Defer**        | Native owns the clock and mutation; executor owns only target steering.                       |
| Anvil, Artificer, and Well Twist                        | `anvil-result`, `artificer-replacement`, `well-twist-result`              | Each non-acquisition transformation/item-effect owner is obligated; child acquisitions and `traitInventory` cover durable results | **Defer**        | Do not convert one failed native step into an early semantic checkpoint.                      |
| Encounter callback fires with no compatible ready owner | Incidental contact                                                        | No DAG owner is completed                                                                                                         | **Pass through** | Native may legitimately call shared functions for unmodeled content.                          |

### Coordinator and protocol matrix

| Current failure                                                                                                            | Disposition | Reason                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Unknown/foreign Timeline handle, conflicting native binding, duplicate role binding, or active owner released as completed | **Fault**   | These are executor identity-ledger invariants.                                                                                    |
| Missing transaction owner or Timeline-index capability                                                                     | **Fault**   | Strict decoding/composition promised these values.                                                                                |
| Non-callable compatibility predicate                                                                                       | **Fault**   | Adapter construction is malformed.                                                                                                |
| Exact-bound native action is consumed before its published prerequisite completes                                          | **Keep**    | The irreversible action cannot be replayed later or rebound to a similar ready owner; this is the generic DAG-readiness mismatch. |
| Adapter calls `begin` outside the published window, or calls it without an exact consuming native action                   | **Fault**   | Ready-action resolution and adapter ownership are malformed; this is not player divergence.                                       |
| Unsupported checkpoint name                                                                                                | **Fault**   | The wire codec and closed lifecycle union should reject it.                                                                       |
| Operation on a closed/disposed room session                                                                                | **Fault**   | Host lifecycle or adapter ownership is broken.                                                                                    |
| Published obligation is incomplete when its named lifecycle checkpoint closes                                              | **Keep**    | This is the Timeline's standard semantic checkpoint.                                                                              |
| Native host function is missing or throws                                                                                  | **Fault**   | Restore any active forcing scope, then propagate/report the host failure.                                                         |

### Named room-exit matrix

| Published fact                                                                | Keep as mismatch? | Why it earns the boundary                                                                                                                          |
| ----------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `traitInventory`                                                              | **Yes**           | Later eligibility, levels, rarity, and replacements were simulated from it.                                                                        |
| `elementCounts`                                                               | **Yes**           | Later trait eligibility and element-dependent effects use it. The one-room-late native gather is already normalized into the published checkpoint. |
| `steadyGrowth`                                                                | **Yes**           | Its clock and processed interval determine later automatic outcomes.                                                                               |
| `chaos`                                                                       | **Yes**           | Active/matured identity, magnitude, and remaining clock affect later state.                                                                        |
| `keepsakeEffects`                                                             | **Yes**           | Charges, latches, temporary traits, and pending outcomes affect later realization.                                                                 |
| `rewardPriorities`                                                            | **Yes**           | Ordered pressure changes later reward generation.                                                                                                  |
| `pathOfStars`                                                                 | **Yes**           | Banked/invested points and tree closure determine later Talent Drop eligibility.                                                                   |
| `forfeit`                                                                     | **Yes**           | The biome latch determines later Boon-to-Onion behavior.                                                                                           |
| `stygianWell`                                                                 | **Yes**           | Pending Spark, Yarn, Hymn, and duration effects alter later generation.                                                                            |
| Full Run State diagnostics, `echoShopDuplicate`, and `hermesShrineDeliveries` | **No**            | They are adjudication evidence or inactive diagnostic values, not blocking predicates.                                                             |

### Current producer coverage index

This index makes the family matrix auditable against the live executor without
turning native hook names into policy owners.

| Live source neighborhood                                                                                                       | Owning matrix rows                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `runtime/session.lua`, `loadout/`, and `route/session.lua`                                                                     | Admission, starting loadout, Postboss recovery, room identity, and outer-session faults        |
| `room/hooks.lua`, `room/overview.lua`, `room/features/structure.lua`, `navigation/`, and `room/timeline/encounters/phases.lua` | Room-entry structure, initial N board, complete Doors, and encounter-binding faults            |
| `room/session.lua`, `room/coordinator.lua`, and `room/timeline/session.lua`                                                    | Coordinator/protocol faults and published obligation checkpoints                               |
| `room/features/fields.lua` and `room/features/inventory/`                                                                      | Aggregated Fields layout, deferred inventory/refill steering, and incidental commerce contacts |
| `room/timeline/acquisitions/`, `keepsakes/`, and `spells/`                                                                     | Deferred acquisition, targeted-effect, NPC, Chaos, Spell, Hex, and keepsake steering           |
| `room/timeline/encounters/` and `room/timeline/transformations/`                                                               | Deferred encounter, automatic, wheel, Anvil, Artificer, and Well Twist outcomes                |
| `room/conformance/`                                                                                                            | The nine retained-state facts at the room-exit checkpoint                                      |

### Matrix conclusion

No feature-specific adapter-local result comparison currently satisfies all
five requirements for a nonstandard checkpoint. The useful checks are already
expressible as:

1. admission/start verification;
2. one complete room-entry structural proof;
3. one complete Doors-ready proof;
4. exact-owner DAG readiness when an irreversible action begins;
5. published non-acquisition obligations at their lifecycle deadlines; and
6. named retained-state conformance at room exit.

This does **not** mean deleting exact steering or its diagnostics. Adapters
still need to record why a scope failed and complete the owner only when the
native action reaches its declared terminal. It means that DAG completion owns
ordering, exact source binding identifies which owner is being consumed, and a
prerequisite mismatch stops only that genuinely out-of-order action. A
callback-local steering failure remains diagnostic until an owning standard
checkpoint proves the remaining prefix is unsafe. If
implementation reveals a genuine gap, the remedy is first to ask whether the
planner omitted a dependency, obligation, or named conformance fact—not to add
another immediate mismatch by default.

## Live implementation assessment

### Policy that is already sound

- The first mismatch is immutable and disables later realization globally.
- Hook wrappers normally call the native function after recording a mismatch;
  the dedicated composition witness verifies that desynchronization does not
  block native room flow.
- Structural comparisons are concentrated at room entry, doors ready, and room
  exit rather than at every native transition callback.
- Unclaimed ready-action searches return `nil` and pass through instead of
  inventing a mismatch.
- An exact-bound action cannot begin before its published prerequisites; this
  is the generic immediate DAG-readiness mismatch rather than a feature rule.
- Acquisition transactions are absent from checkpoint obligations, while
  their completion can still release exact local dependencies.
- Native exceptions inside temporary forcing scopes restore the scope and are
  rethrown.
- Full Run State frames are not used as a universal blocking predicate.
- World Shop `RestockWorldItem` is exclusively the native Travel Deal refill
  path, giving the adapter an exact semantic binding.

### Finding 1: admission rejection is partly reported as mismatch

The inbox and inspection UI correctly classify malformed JSON/protocol content
as `malformed-plan`. During new-run startup, however, `runtime.start` sends a
failed load through the same `fail` function that creates
`desynchronized: first-mismatch` with checkpoint `run-start`.

This does not currently alter native gameplay, but its diagnosis is wrong: no
execution plan was admitted, so there was nothing for the run to mismatch.
Postboss state mismatch remains a legitimate strict recovery rejection; plan
decode/load failure should remain an admission error.

### Finding 2: internal invariants share the semantic mismatch funnel

The room and Timeline coordinators currently convert several internal failures
into first mismatch, including:

- a missing Timeline-index capability;
- an unknown or foreign handle;
- conflicting native-handle bindings;
- a missing decoded transaction owner;
- an unsupported checkpoint name;
- use of a closed/disposed room session; and
- malformed decoded payload structure discovered only inside a specialized
  adapter.

These conditions cannot be caused by a compliant player choosing a different
route or action. Strict decoding and composition should make most unreachable.
If reached, they are executor/protocol faults. Keeping them in the mismatch
channel makes live reports falsely implicate the plan or player and can conceal
decoder coverage gaps.

This finding does not argue for a complex error hierarchy. One narrow boundary
is sufficient: standard checkpoint failures may call `mismatch`; host,
decoded-contract, and coordinator invariant failures must raise or report an
executor fault.

### Finding 3: occurrence correlation is over-weighted at route entry

`routeSession.enter` compares both the occurrence ID and game name. Ordinary
restoration already repairs a missing stamp from the expected game name, so
the ID usually acts only as correlation. A wrong surviving stamp can currently
produce `room-entry` mismatch even when the native room name is correct.

The native fact is the game name at the current route position. The occurrence
ID remains necessary for executor ownership, but disagreement in executor-owned
metadata is an internal binding fault rather than proof that the game entered
the wrong room.

### Finding 4: the diagnostic adjudication path is not active in ordinary runs

The wire expands complete Run State diagnostic frames, and the runtime exposes
`runtime.diagnostic`, but no ordinary room hook calls it. The live log records
only a compact first-mismatch tuple, truncating nested values and emitting no
nearby observed Run State frame.

This preserves the important rule that diagnostics are non-blocking, but it
does not yet fulfill their intended purpose of distinguishing player deviation
from planner under-modeling after a mismatch. Postboss admission is the one
place that actively consumes an expanded diagnostic entry frame.

### Finding 5: adapter-local mismatches are broader than the checkpoint policy

The ordinary trait adapter now avoids treating a player's different selection
as an acquisition-local mismatch, but bespoke NPC and other specialized paths
still contain direct `*-selection`, missing-candidate, missing-contact,
unavailable-result, and unexpected-refill mismatches. These checks usually
describe whether one callback-level steering attempt succeeded, not whether
the room can still provide the state assumed by the next occurrence.

The correct default is simpler:

- record steering failure without desynchronizing;
- complete an owner when its native action reaches the declared terminal,
  independent of the steered result;
- leave it incomplete only when the expected action never reaches that
  terminal; and
- let obligations, structural proof, and named conformance decide at their
  standard checkpoints.

This default does not apply when an exact bound action is consumed before its
published prerequisites. That case keeps the generic readiness mismatch. Nor
does it justify a trait-eligibility preflight: the planner owns eligibility and
the player owns the authored selection.

An adapter-local mismatch may remain only with the concrete justification
required by the checkpoint-validity rule. This is a bounded classification
review, not a reason to remove the useful specialized steering scopes.

### Finding 6: active forcing scopes can outlive the first mismatch

Disposing the room coordinator prevents later state-gated hooks from claiming
new work, but it does not centrally clear every module-local forcing scope that
was already active inside the native call. Most multi-contact adapters mark or
discard their scope when steering fails. A counterexample is Hex-tree
construction: a missing layout can report mismatch and fall back to native
selection while the same active scope can still steer later special-node
contacts before the outer call returns.

Removing callback-level mismatch as the default removes this conflict: the
adapter may keep attempting its scoped steering and records whether the action
reaches its terminal without changing global synchronization inside the nested
call. A genuinely earned mid-scope mismatch still needs one local
failed/disarmed state so later nested contacts pass through. This is a
scope-lifetime concern, not a reason for a global callback cursor.

### Finding 7: World Shop source correlation stops between products

The execution Overview preserves both identities needed by I/Q World Shops:
`optionKey` distinguishes native `RandomLoot` from `BoostedRandomLoot`, while
`offerKey` identifies the authored Shop position. Inventory realization keeps
the boosted native arguments and stamps the materialized item with that
`offerKey`.

The acquisition transaction separately carries the exact trait rows and
rarities plus an opaque `sourceOwner` whose planner address identifies the Shop
offer. The strict acquisition protocol does not expose `offerKey`, however.
The live Timeline index and world-item adapter already try to join on
`transaction.offerKey`, while direct Lua session tests manufacture that field
on decoded-like values. A real decoded execution plan therefore lacks the join
those tests exercise and may fall back to carrier/provider matching.

This is unsafe whenever two independent offers share a provider, and becomes a
generic DAG error when same-provider actions have different prerequisites. A
boosted Apollo pedestal must bind to its boosted acquisition owner regardless
of purchase order; it must never claim a ready ordinary Apollo owner. The
execution product must publish a direct exact correlation key rather than make
Lua parse the semantic `sourceOwner` address. A stamped materialized source then
uses only that exact binding; similarity and transaction order are not
fallbacks. This adds no purchase comparison and no boosted-specific mismatch
rule.

## Final disposition

The overall mismatch policy is appropriate when centered on standard
checkpoints: exact room content and Doors, explicit non-acquisition obligations,
and sparse retained-state facts are strong enough to protect later forcing
without making the executor a second simulator. Between checkpoints,
transaction completion should record action termination, unlock DAG dependents,
and do nothing more. Exact source correlation and the one generic prerequisite
check ensure that only the intended ready owner reaches that completion path.
Stopping at the first checkpoint mismatch while leaving the native game
playable remains the right safety behavior.

The live implementation is stricter than that policy. It uses one broad error
funnel for checkpoint divergence, callback-level steering failures, admission
failure, and internal faults, while its promised diagnostic evidence is not yet
sampled during ordinary execution. Tightening those boundaries means deleting
or explicitly justifying nonstandard mismatch producers, not adding more
runtime checkpoints.

## Evidence

Planner authorities:

- `docs/design/GAME_INTEGRATION_BOUNDARY.md`
- `docs/audits/rooms-and-routes/GAME_EXECUTION_TIMELINE_RECONCILIATION_AUDIT.md`
- `docs/audits/game-execution-contacts/NATIVE_CONFORMANCE_CONTACTS.md`
- `docs/progress/ACQUISITION_STEERING_BOUNDARY_PLAN.md`

Plan Executor implementation contacts:

- `src/mods/runtime/session.lua` and `src/mods/runtime/composition.lua`
- `src/mods/route/session.lua`
- `src/mods/room/coordinator.lua` and `src/mods/room/session.lua`
- `src/mods/room/timeline/session.lua`
- `src/mods/room/hooks.lua`
- `src/mods/navigation/doors.lua` and `src/mods/navigation/rewards.lua`
- `src/mods/room/features/structure.lua`
- `src/mods/room/conformance/proof.lua` and `readers.lua`
- specialized adapters under `src/mods/room/timeline/`,
  `src/mods/room/features/`, `src/mods/keepsakes/`, and `src/mods/spells/`
