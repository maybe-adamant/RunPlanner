# Game Execution Room-Session Replacement Plan

## Status

Locked on 2026-09-01 after the execution Timeline reconciliation audit and a
live inventory of the current planner protocol and Plan Executor.

Gate A completed at Run Planner commit `3ba4c13e`. Gate A.2 completed at Run
Planner commit `d8868277`, replacing the provisional stream-plus-edge ordering
product with one planner-owned sparse prerequisite DAG and closing runtime
fallback, automatic-outcome, and room-exit conformance publication. Protocol
v10 still has no external consumer, so Gate A.2 corrected v10 in place without
a compatibility path or version bump. Its five checked-in execution fixtures
are the exact Gate B input authority.

Gate B subsequently completed the room-session cutover. Live Gate C probing
was suspended on 2026-09-02 after it exposed incomplete cross-carrier and
special-effect coverage rather than another coordinator defect. Its successor,
the [Layered Game Execution Coverage Plan](GAME_EXECUTION_LAYERED_COVERAGE_PLAN.md),
has closed universal implementation through Gate F. Its Gate G live F/G proof
and Gate H durable/Windows closure remain active.

Starting authorities and commits:

- Run Planner: `cd63aff8b3a052fd914a7f593ed990e2cddf9556`
- Plan Executor: `3fe7aaa59370aeb6472dca56802f95e825b6ee37`
- Modpack shell: `6744368314f404d40e2d3da477caadf42e9e4d8f`

This is a replacement plan, not an incremental relaxation of protocol v9.
Protocol v10 is the single room-session replacement. The current active
executor remains the historical baseline in Git. No second archived runtime
copy or protocol-v9 compatibility path will be added.

## Objective

Replace the F/G execution contract and Plan Executor coordination core with a
runtime shaped around the planner's existing Room Occurrences:

```text
selected Room Occurrence
├─ Overview — what the room contains
├─ Timeline — consequential semantic transactions in the room
└─ Doors — what the completed outgoing batch contains
```

The user-visible outcome is a start-of-run executor that remains strict about
the planned room, enforceable room contents, consequential player outcomes,
required lifecycle obligations, and generated doors/rewards without treating
every native callback or the planner's complete authored Timeline order as a
blocking replay program.

The planner retains its exact total Timeline order for authoring, simulation,
candidate generation, findings, and player guidance. This plan changes only
the engine-owned projection used for runtime realization and reconciliation.

## Why replacement is warranted

The current active executor concentrates the trace contract in three files:

| Current file   | Approximate size | Current responsibility concentration                                                              |
| -------------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| `logic.lua`    | 815 lines        | all native hooks, scoped callback state, status publication, and calls into the trace session     |
| `protocol.lua` | 1,271 lines      | strict protocol decoding plus semantic-address parsing and validation for trace-owned payloads    |
| `session.lua`  | 2,805 lines      | realization, runtime bindings, global trace progression, Run State comparison, and mismatch state |

`session.lua` is organized around `traceCursor`, `nextTrace`, and
`consumeTraceStep`. Acquisition, encounter, purchase, automatic-effect,
fountain, rack, cleanup, room-entry, and room-exit paths all consult or advance
that cursor. The protocol and its tests encode the same assumption.

Removing a few comparisons would leave the global action cursor as the hidden
coordination authority. Refactoring every current method around a new meaning
would preserve interfaces that no longer represent the desired product. A
controlled replacement is therefore smaller and safer than a compatibility
refactor, provided the proven native forcing work is harvested rather than
rediscovered.

## Owning authorities

- [Game Execution Timeline Reconciliation Audit](../audits/rooms-and-routes/GAME_EXECUTION_TIMELINE_RECONCILIATION_AUDIT.md)
  owns the action-family assessment, hard edges, commutative regions, and the
  planner-owned sparse-dependency disposition.
- [Game Integration Boundary](../design/GAME_INTEGRATION_BOUNDARY.md) owns the
  durable app/compiler/game-module dependency direction and will absorb the
  completed replacement contract at closure.
- [Room Lifecycle Model](../design/ROOM_LIFECYCLE_MODEL.md) owns lifecycle
  windows and stable room checkpoints.
- [Room Action Order Audit](../audits/rooms-and-routes/ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md)
  owns source-backed barriers and interaction windows.
- [Acquisition, Delivery, and Room Settlement](../audits/rewards-and-acquisition/ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md)
  owns acquisition roles, generated children, purchases, and delivery timing.
- `packages/planner-engine` remains the sole authority for the complete-valid
  simulation, exact acquisition semantics, action consequences, dependencies,
  and runtime execution disposition.
- The Plan Executor owns only bounded decoding, native realization, semantic
  contact binding, checkpoint proof, diagnostics, and first-mismatch state.

Protocol v9 and the current executor are implementation evidence, not stable
authorities for the replacement.

## Source facts and chosen simplifications

### Source and model facts retained

- Publication is start-of-run only. The executor cannot attach midway or
  truthfully recover a partially executed plan.
- Room Occurrences have stable persisted identity and resolve through exact
  game room declarations.
- Overview, Timeline, and Doors already separate room contents, in-room
  chronology, and outgoing topology in the planner.
- One semantic transaction may require several native callbacks.
- Trait offers, first/next-use effects, generated children, and automatic
  mutations depend on exact modeled prefixes.
- Required objects and some phase contacts prevent later native progression.
- The compiler consumes the complete-valid engine product and does not rerun
  candidate policy, validation, or simulation.

### Replacement simplifications

- One route-level cursor identifies the next selected Room Occurrence.
- Room entry, completed door generation, consequential Timeline transactions,
  and required lifecycle obligations are the only blocking reconciliation
  surfaces after run start.
- Door selection is not independently compared. Entering a different resulting
  room is caught at the next room-entry checkpoint.
- Raw native door names, object identifiers, callback spelling, callback
  multiplicity, and representation-only callback order are adapter details.
- Full Run State remains expected/observed diagnostic evidence but cannot
  desynchronize the session.
- Simulation-neutral or unproven Timeline contacts are omitted from blocking
  execution rather than serialized as empty obligations.
- Every semantic prerequisite is occurrence-local. The selected occurrence
  cursor orders rooms, but prior-room completed owners never enter a later room
  session.
- Cross-room effects use canonical engine Run State. The engine publishes a
  sparse room-exit conformance delta only for pending or clocked values changed
  by that occurrence; unchanged and broad diagnostic state is not repeated.

## Locked runtime model

### Route session

The route session owns only:

- the frozen decoded execution plan;
- the selected occurrence sequence and current room index;
- the current room session, if one is active;
- bounded native bindings for exact retained game identities, such as
  independent Shrine deliveries, without prior action-completion provenance;
- starting-keepsake realization state;
- diagnostic observations; and
- the first blocking mismatch.

It does not own reward eligibility, trait eligibility, reward bags, simulated
Run State advancement, room search, fallback planning, or action permutation
resolution.

### Room session

The current room session is constructed directly from one published Room
Occurrence and owns:

- its expected room identity;
- the expected Overview product and accumulated native proofs;
- the current declaration-owned lifecycle window;
- completed semantic transaction owners;
- explicit planner-owned owner prerequisites;
- required obligations keyed to lifecycle checkpoints;
- the expected Doors product and accumulated native proofs; and
- occurrence-bounded diagnostics.

Room entry creates this session and verifies every entry-stable Overview fact.
Some Overview-owned payloads are deliberately constructed later at their
native feature contact: an interacted Well's inventory, for example, does not
exist until the player opens it during cleanup. That later adapter still
consults the room's Overview product; it does not become a Timeline action or a
new global checkpoint. Door readiness does not end the session: post-outgoing
Wells and other cleanup interactions may still occur. Room exit closes it only
after its exit obligations are satisfied. The next entered room must match the
next selected occurrence.

When the current occurrence has terminal Doors, satisfying its remaining
obligations and room-exit conformance completes the configured execution
prefix. The executor then stops realizing later rooms. Entering the next
unsupported biome after that completed prefix is not a mismatch.

### Semantic transaction completion

Native adapters identify a transaction from explicit published fields and
bounded native bindings: for example `offerKey`, `generationKey`, `phaseKey`,
`sourceOwner`, or the exact object bound when a pickup was materialized. The
adapter passes the resulting opaque owner to the room session. Neither decoder
nor session parses semantic-address grammar, scans for the next transaction, or
uses authored order as a fallback matcher.

When a native adapter reports one consequential transaction, the room session
performs one atomic operation:

1. locate the transaction by its opaque semantic owner;
2. verify that its lifecycle window is active;
3. verify that every declared prerequisite owner is complete;
4. compare only the transaction's planner-visible outcome; and
5. mark the owner complete.

Failure before step 5 changes no completion state. The runtime does not
topologically sort, search for another match, choose a first purchase or next
consumer, or infer exchangeability.

One semantic transaction may span several synchronous or asynchronous native
callbacks. The owning adapter retains that bounded intermediate contact state;
the room session sees only the final completed proof. A canceled or incomplete
interaction leaves the owner incomplete so its declared obligation, if any,
remains authoritative.

An unmatched native callback or interaction is not independently a mismatch.
The planner has intentionally omitted guidance-only and simulation-neutral
contacts from the blocking product. Once an adapter has bound a native object,
screen, slot, or phase to a published owner, however, a different
planner-visible result is a transaction mismatch. Missing required work is
caught by obligations, and changed pending or clocked state is caught by the
sparse room-exit conformance product. The runtime does not classify an omitted
contact by reconstructing planner semantics.

This requires only a completed-owner set, each node's declared prerequisite
owners, and checkpoint obligation sets. It does not justify a scheduler,
topological executor, event bus, rule registry, or embedded simulator.
The completed-owner set is discarded when room-exit conformance succeeds. A
later occurrence receives no action-completion state from an earlier one.

### Logical checkpoints and native hooks

Room entry and door readiness are logical checkpoints rather than assumed
single callbacks. Several source-backed native hooks may contribute realized
facts before one stable seam closes the checkpoint. An Overview-owned feature
payload generated later is verified at that feature's normal native seam and
remains part of the same active room session.

Native hooks have four bounded roles:

- obtain the expected fact from the active room session;
- constrain or realize the corresponding vanilla construction;
- bind the resulting native object, slot, phase, or screen to its semantic
  owner; and
- report one completed proof or transaction.

Hooks do not advance the occurrence cursor, choose which transaction should
come next globally, derive whether an action matters, or compare broad Run
State.

Runtime fallback relations remain part of the native adapter boundary. The
closed contacts are `traitEligibility`, `storeInventoryGeneration`,
`storePurchase`, and `npcConsumableSelection`. At the declared contact the
adapter asks only whether the preferred result is natively available, realizes
the one declared fallback when it is not, and reports failure when neither can
be realized. Preferred and fallback outcomes both complete the same semantic
owner and conform to the plan. The route and room sessions do not know why the
fallback was required and never search another provider pool.

## Execution product

The replacement execution document remains strict, bounded, data-only JSON.
It contains:

1. protocol/catalog identity and the route-start keepsake result;
2. an explicit selected occurrence sequence for the route cursor;
3. occurrence records addressed by stable opaque IDs;
4. each occurrence's complete supported Overview realization product;
5. its consequential owner-bearing nodes, sparse prerequisite edges, and
   checkpoint obligations;
6. its complete supported Doors realization product; and
7. its sparse engine-owned room-exit conformance delta for changed pending and
   clocked state; and
8. optional diagnostic Run State snapshots or deltas keyed to room entry and
   before-room-exit.

Semantic owners are bounded opaque correlation IDs in the game module. The
planner engine and compiler have already established their meaning. The Lua
decoder validates uniqueness, reference integrity, bounds, and closed payload
unions; it does not parse planner semantic-address grammar or reconstruct
ownership policy.

The selected occurrence sequence is distinct from the complete Doors product.
Doors include selected and unselected authored offers that must be realized.
The cursor contains only the path the plan expects the player to traverse.

### Overview contract and room-entry checkpoint

For the supported F/G slice, the room-entry checkpoint verifies the concrete
Overview facts available after room setup, while later feature contacts realize
the deferred payloads owned by that same Overview:

- occurrence marker and game room identity;
- incoming reward and its acquisition surface;
- required effect-neutral boss reward presence and its end-encounter chronology
  action, without a simulated acquisition, executor transaction, or native
  reward-name contract;
- encounter assembly and supported encounter-owned results;
- required room objects;
- resources and successful element placement;
- World Shop, Stygian Well, Pool, rack, and fountain presence;
- authored inventory at its normal generation contact when an object was
  interacted with;
- presence without fabricated inventory when a Well or Pool was not
  interacted with;
- Chaos gate, Zagreus Contract, and other supported F/G room features at their
  owning room; and
- fixed Boss/Postboss continuation-room contents.

The checkpoint compares semantic facts, not native construction callback
order.

### Timeline reconciliation

The engine publishes only transactions whose outcome, ordering, production,
or completion affects the supported plan. Current concrete witnesses include:

- normal and Artificer reward dispositions, with Time Piece acquisitions
  consumed before execution publication;
- Artificer source-to-child production;
- trait, Chaos, Pom, level, and rarity outcomes;
- Mystery Boon provider resolution and its resulting trait transaction;
- generated pickups, including Sea Star and trait-produced children;
- supported NPC and Nemesis encounter outcomes;
- consequential World-Shop and Well purchases;
- Pool sales;
- keepsake changes and immediate equip results;
- fountain use and Aromatic Phial;
- Steady Growth, Transcendent Embryo, and other reached automatic mutations;
  and
- required object and lifecycle obligations.

A node may have several prerequisites or several dependents. Mystery Boon is a
representative atomic-owner witness: its exact acquisition owner carries the
provider resolution and resulting trait outcome without creating parallel
family cursors. Artificer is the representative producer-to-child witness. An
unrelated simulation-neutral purchase has no edge to either.

The engine does not publish unowned outcome allocation for Mystery Boon,
Artificer, or any other family unless complete-valid evaluation has explicitly
certified a bounded group exchangeable. No current family is presumed
exchangeable merely because two outcomes have the same display type or final
inventory count.

### Doors checkpoint

Door-ready verification covers:

- the complete normal-door count and ordering;
- each target occurrence/game room identity;
- each door reward's semantic reward/store/provider identity;
- declaration-sized Chaos return batches.

Chaos gates and Zagreus Contract objects are additional room features and are
proved through Overview. Anomaly is the selected normal-door target
replacement. Neither is compared a second time as a different door product.

The native adapter may need game-specific names to construct these doors, but
the checkpoint does not compare raw native door class names, object IDs, or
callback sequences. Selecting a nonplanned offered door does not immediately
desynchronize; the next room-entry checkpoint observes the resulting player
divergence.

### Canonical Run State and room-exit conformance

Run State remains the sole canonical engine publication for retained planner
state. Its existing keepsake, trait/Chaos, Echo Gold, Hex/Path, Forfeit,
Artificer, Arcana/Fear, and reward-priority fields are reused. Gate A.2 promotes
agreed pending Hermes Shrine deliveries and consequential Stygian Well uses and
duration counters from public reward branches into that same product.

Complete-valid evaluation also publishes one sparse room-exit conformance
delta. The engine derives it from the previous closed Run State and the current
`beforeRoomExit` state and includes only pending or clocked values created,
advanced, consumed, reset, or materialized by the current occurrence. It does
not include unchanged retained state, complete trait/bag/history state, or an
earlier action owner.

On the wire, each sparse fact names the changed family and selects the expected
value already present in that occurrence's `beforeRoomExit` Run State frame.
The value is not serialized a second time. This preserves one canonical state
representation while still making the selected family a first-class blocking
contract.

The compiler copies the delta losslessly. The game adapter compares each
declared state fact to the corresponding native retained state at room exit. A
match closes the room and discards its completed-owner set; a mismatch blocks
later realization. The compiler and runtime do not derive why the value changed
or which later contact may consume it.

Gate B's start-of-run F/G extent requires native readers for the seven
conformance families that can change before leaving G: `steadyGrowth`, `chaos`,
`keepsakeEffects`, `rewardPriorities`, `pathOfStars`, `forfeit`, and
`stygianWell`. `echoShopDuplicate` cannot exist before Echo in H, and
`hermesShrineDeliveries` cannot exist before the later Shrine-owning route
surface. Protocol v10 still decodes those two closed-union members
structurally, but the F/G executor rejects an occurrence that declares either
as an unsupported execution contact instead of silently skipping it or
building unreachable native readers. A later-biome gate must deliberately add
their native comparison contacts before accepting them.

### Diagnostics and mismatch policy

Run State snapshots remain available for investigation. The decoder expands
their globally sequenced `replace` frames once at load time and attaches the
complete `roomEntered` and `beforeRoomExit` values to their occurrences. It
also resolves each named room-exit conformance fact to the corresponding value
in that occurrence's expanded `beforeRoomExit` state. Frame numbers and delta
accumulation never enter the live route or room session. The executor may log a
bounded expected/observed diagnostic difference at either checkpoint, but that
difference never changes session synchronization.

The first blocking mismatch is limited to:

- invalid or incompatible published input at run start;
- entering a different occurrence than the room cursor expects;
- failure to realize or prove an expected Overview fact at room entry or its
  later feature-owned generation contact;
- a consequential transaction with a different non-equivalent result;
- a consequential owner used before a declared prerequisite;
- an unresolved required obligation at its lifecycle checkpoint; or
- a changed pending/clocked state value that fails its room-exit conformance
  fact; or
- failure to realize or prove the expected Doors product.

Duplicate/incidental callbacks, untracked simulation-neutral interactions,
raw exit-name differences, selected-exit contacts, and diagnostic Run State
differences cannot independently create a mismatch.

## Code disposition

### Retain

- desktop publication and the fixed `active.runplanner.json` inbox contract;
- Tauri profile discovery and write boundary;
- module manifest/bootstrap and ModpackLib binding;
- bounded JSON parser;
- inbox file handling;
- status output and first-mismatch presentation shell;
- deployment tooling, shell smoke, and module test harness; and
- the principle of a strict single supported protocol/catalog version.

### Harvest into the replacement

The following current algorithms and verified native seams are evidence to be
moved behind the new room-session contract where still correct:

- room copying, occurrence stamping, and starting-room forcing;
- incoming reward and reward-store forcing;
- encounter selection and multiple-encounter assembly;
- normal/additional door construction and Chaos returns;
- World-Shop, Well, and Pool inventory construction;
- room-feature presence forcing;
- trait-offer construction and selected outcome application;
- Time Piece, Artificer, Sea Star, and generated-child native contacts;
- Chaos curse/blessing reservation and processing;
- keepsake equip and immediate result interception;
- fountain, resource, Nemesis, Anomaly, Steady Growth, and Transcendent Embryo
  native contacts; and
- native object/slot tagging that provides stable semantic correlation.

Harvesting preserves proven behavior, not current `session.lua` method names or
trace-oriented call structure.

### Construct as new native behavior

The following Gate B contacts have no completed protocol-v9 realization path
and must not be estimated as mechanical harvesting:

- `bossDefeated` realization and proof for Judgment and Crystal Figurine;
- preferred/fallback resolution at `traitEligibility`,
  `storeInventoryGeneration`, `storePurchase`, and `npcConsumableSelection`;
  and
- the seven bounded F/G room-exit conformance readers named above. Existing
  broad Run State observation may supply source-backed native access, but the
  sparse blocking comparison is new behavior.

Each new contact needs its own native adapter witness before the old trace
coordinator is deleted. None may be implemented as a semantic rule in the
route or room session.

### Rebuild

- execution protocol model and decoder;
- route and room session state;
- Overview and Doors proof accumulation;
- semantic transaction completion;
- lifecycle obligations and sparse prerequisites;
- room-exit pending/clocked-state conformance;
- mismatch classification and diagnostic logging;
- explicit hook composition; and
- primary session/protocol tests.

The target module neighborhood is deliberately small:

- a route/room session coordinator;
- one semantic Timeline reconciliation module;
- one Overview/Doors checkpoint module;
- a strict protocol decoder;
- explicit hook groups for rooms/doors, acquisitions/traits, and
  Shops/features; and
- focused existing special adapters such as Chaos where they retain one
  coherent native responsibility.

This is an ownership target, not a line-count mandate. A cohesive decoder or
adapter may remain large. No generic adapter registry, dependency-injection
container, event bus, or catch-all utility layer is authorized.

### Retire in the cutover

- `ExecutionTraceStep` and the per-room global `trace` program;
- `traceCursor`, `nextTrace`, `consumeTraceStep`, and cursor-derived pending
  selection logic;
- blocking `expectedRunState` comparison and Run State frame progression as a
  conformance mechanism;
- selected-exit/before-exit transition comparison;
- raw native exit-name conformance;
- semantic-address parsing in Lua solely to rediscover planner ownership;
- protocol-v9 decoder paths and fixtures;
- cursor-oriented session tests; and
- any compatibility adapter that lets the new coordinator call the old trace
  session or vice versa.

Git is the archive. The existing `archive/phase9-prototype` remains historical
evidence and is not expanded with another retired active executor.

## Concrete abstractions and their witnesses

Every new runtime abstraction must be exercised by a present F/G instance:

| Product or primitive        | Required concrete witness                                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| selected occurrence cursor  | F opening through an ordinary continuation; Ixion Chaos detour and declaration-sized G return                           |
| Overview checkpoint         | interacted and uninteracted Well/Pool presence, resources, encounter assembly, Chaos/Contract, and an incoming reward   |
| Doors checkpoint            | ordinary F multi-door batch, Anomaly replacement, and one-, two-, and three-exit Chaos returns                          |
| sparse prerequisite edge    | Travel Deal source purchase before refill realization; Judgment before Crystal Figurine at `bossDefeated`               |
| atomic multi-effect owner   | Mystery Boon provider resolution plus its exact resulting trait acquisition                                             |
| producer dependency         | Artificer source conversion before its generated replacement pickup                                                     |
| checkpoint obligation       | required incoming/Onion acquisition before later cleanup or room exit                                                   |
| guidance omission           | a simulation-neutral Well purchase that does not affect any later modeled result                                        |
| automatic transaction       | Steady Growth or Transcendent Embryo at its exact reached end-effects checkpoint                                        |
| room-exit conformance delta | an Ixion purchase adds one use, a later Chaos-gate room consumes it, and unchanged intervening state is not republished |
| diagnostic-only Run State   | an expected/observed difference that is logged while the session remains synchronized                                   |

No primitive is added only for a later biome or hypothetical action family.

## Delivery gates and commit boundaries

### Gate A — Engine execution disposition and protocol replacement (completed)

Owning repository: Run Planner. Completed at `3ba4c13e`.

Gate A established the protocol-v10 occurrence, Overview, Timeline, Doors, and
diagnostic products. Its provisional Timeline relation product carried both
explicit dependencies and semantic streams. Gate A.2 supersedes only that
dual ordering representation; the rest of the completed vertical slice remains
the base.

Deliver one complete engine-to-publication vertical slice:

- add the engine-owned occurrence execution product described above;
- classify every Room Action family reachable in the supported F/G execution
  product into a published consequential transaction,
  dependency/obligation, or omitted guidance disposition;
- publish the selected occurrence sequence, Overview, local Timeline
  reconciliation, Doors, and diagnostic-only Run State;
- replace protocol v9 with strict protocol v10;
- keep the compiler a lossless mapper from the complete-valid engine product;
- regenerate the five representative execution fixtures, including one compact
  reached-automatic/bossDefeated witness;
- retain the desktop publisher and inbox location unchanged; and
- delete the v9 trace model, codec, compiler path, and v9-specific tests in the
  same commit.

Compilation remains ineligible for unsupported routes and later biomes. Gate A
does not add a persisted `unsupported` action disposition or pre-author future
H/I/N/O/P/Q adapters merely to make the TypeScript switch exhaustive.

Primary test ownership:

- an engine reconciliation-product suite owns the supported F/G action
  disposition and hard-edge matrix;
- execution compiler/codec tests own strict wire mapping and rejection;
- `f-opening`, `fg`, `fg-ixion-chaos`, `fg-anomaly`, and `automatic-boss`
  fixtures own representative complete byte products; the last fixture keeps
  the reached automatic/bossDefeated wire contact covered without adding that
  concern to the route-contract fixtures;
- focused tests own Mystery Boon's atomic provider/trait outcome, Artificer's
  dependency, required Onion obligation, and diagnostic-only Run State; and
- the application publication test retains one representative valid publish
  and one invalid-project rejection.

Narrow validation:

- focused new engine tests;
- `npm run test:engine`;
- focused publication tests;
- `npm run typecheck`;
- `npm run lint`;
- `npm run format:check`;
- `git diff --check`.

Intended commit: `feat(engine): publish room-session execution protocol`.

### Gate A.2 — Planner-owned sparse Timeline dependency DAG (completed)

Owning repository: Run Planner. Production base: `3ba4c13e`. Completed at
`d8868277`.

Correct protocol v10 before any Plan Executor cutover. The planner's authored
Timeline remains a total order for simulation and editing, but its execution
projection publishes only consequential owner-bearing nodes, the sparse
prerequisite edges already decided by planner semantics, and lifecycle
obligations.

Gate A.2 also closes the runtime-offer boundary. Every fallback is one
normalized relation of `preferredKey`, `fallbackKey`, and a closed
`availabilityContact` (`traitEligibility`, `storeInventoryGeneration`,
`storePurchase`, or `npcConsumableSelection`). Trait offers use this same
shape; the retired singular `runtimeFallback` field is not a protocol or
engine product. The engine chooses the contact and fallback from the complete
valid evaluation, while assembly and the compiler only copy it. The native
adapter performs the contact-specific availability question and one fallback
attempt; it does not interpret named game predicates or search a pool.

Timeline publication resolves authored participation before the wire product
exists. Untouched optional actions are omitted; every active required or
optional action that is published becomes an intended transaction with exactly
one checkpoint obligation. Dependencies are filtered to published endpoints
and never retain an unchosen competitor through closure.

Deliver one focused engine-to-publication correction:

- remove `ExecutionTimelineStream`, `timeline.streams`, stream codec fields,
  stream construction, stream fixtures, and stream-specific tests;
- remove the parallel top-level `wellRetainedEffects` correlation product and
  remove action-owner provenance from retained Well state;
- restrict every prerequisite edge to owners in the same Room Occurrence and
  reject every cross-occurrence edge structurally;
- make the complete-valid planner evaluation the sole authority that selects
  first purchases, same-room consumers, producer/child relations, and any other
  occurrence-local noncommutative owner relation;
- expose those relations through the nearest existing simulation,
  materialization, Room Action, acquisition, and feature products instead of a
  parallel shadow model;
- have those planner-owned products explicitly publish every owner-bearing
  automatic or deferred node needed for a concrete realization and every
  action disposition needed for generic retention;
- publish a normally neutral action when the player authored it, omit untouched
  optional guidance, and filter planner-owned dependencies to the intended
  published endpoints without generic prerequisite closure;
- promote agreed pending Hermes Shrine deliveries and consequential Stygian
  Well use/duration state into canonical Run State without changing their
  simulation transitions;
- publish one first-class room-exit conformance delta derived from the previous
  closed Run State and current `beforeRoomExit` state, containing only changed
  pending or clocked values whose complete-valid branches agree;
- restrict execution assembly to generic node retention, prerequisite closure,
  opaque owner mapping, conformance-delta copying, reference validation, and
  serialization;
- delete assembly-side searches for a first purchase or next consumer and any
  inspection of action kind, effect, reward, feature, or payload to infer
  retention or ordering;
- preserve lifecycle windows and obligations as distinct products; and
- regenerate all five protocol-v10 fixtures without changing publication,
  inbox, Overview, or Doors semantics. Full Run State remains diagnostic; only
  its explicit sparse room-exit conformance derivative is blocking.

The locked assembly boundary is:

> Code under `execution-plan/assembly` may copy, prune, and
> reference-validate planner-owned nodes and edges and copy engine-owned
> room-exit conformance facts. It may not create a semantic node, edge, or
> conformance fact, inspect an action's meaning to decide retention, choose a
> first purchase, search for a next consumer, diff broad Run State, or decide
> whether actions commute.

The same rule applies after assembly. The compiler maps the generic node and
edge objects losslessly. The Plan Executor sees only that owner `Y` lists owner
`X` as a same-room prerequisite and checks completion accordingly. It separately
sees that one room-exit state fact must equal one declared value. It does not
know or branch on the semantic reason for either product.

The Travel Deal Well path is the mandatory pressure-point witness:

1. the already-resolved first accepted qualifying purchase is retained as the
   source node even when its direct item effect is simulation-neutral;
2. the refill is an exact owner-bearing automatic/deferred realization with
   its planner-resolved inventory payload;
3. source purchase precedes refill realization;
4. source purchase precedes every other authored qualifying purchase that
   could otherwise consume Travel Deal first;
5. an authored refill purchase follows refill realization; and
6. an unrelated purchase or room action has no edge to this subgraph.

Refill realization exists when the refill is generated, whether or not the
player authors its purchase. Source-to-competitor barriers exist only for
other authored purchases that survive execution publication. Purchasing the
refill adds the realization-to-purchase relation.

Gold Gold Gold, Artificer, generated acquisitions, same-room trait-history
prefixes, and same-room keepsake-sensitive consumers use exact local relations
already resolved by the planner. Extended, Yarn, Hymn, Ixion, Shrine delivery,
Chaos/Embryo clocks, and other retained effects use canonical Run State and the
sparse room-exit conformance delta. No execution-plan assembler predicate may
decide what the next eligible transaction is or connect its producer to a later
room.

Primary test ownership:

- existing planner simulation, Room Action, acquisition, Well, Shop, trait,
  and keepsake suites remain the primary owners of their semantic rules; amend
  the nearest existing witness only when it does not already prove the exact
  producer, local consumer, first-use, state transition, or dependency fact
  required by publication;
- do not duplicate complete Travel Deal, Gold Gold Gold, Extended, Yarn, Hymn,
  Artificer, generated-acquisition, or trait-history matrices in execution-plan
  tests;
- Run State tests own the canonical Shrine-delivery and Well-state promotion;
- one focused engine test owns sparse room-exit delta derivation, branch
  agreement, changed-family inclusion, and unchanged-family omission;
- one generic execution-projection witness owns `X -> Y` with independent `Z`,
  prerequisite-closure retention of an otherwise omitted node, and the absence
  of adjacency-derived edges;
- codec tests reject missing prerequisite owners, duplicate owners, duplicate
  edges, self-edges, cycles, and every cross-occurrence prerequisite, and reject
  the removed `streams` field;
- compiler tests prove lossless generic node/edge and room-exit-conformance
  mapping without semantic branching; and
- application publication tests retain one valid and one invalid project
  witness against the corrected v10 document.

Explicit exclusions:

- no generic runtime scheduler, topological sort, graph search, or action-rule
  evaluator;
- no action-family, reward-family, feature-family, or effect-specific dependency
  logic in execution assembly, compiler, decoder, or runtime;
- no cross-occurrence prerequisite and no route-level completed-owner set;
- no full Run State comparison promoted to blocking conformance;
- no edge for authored adjacency unless reversing that exact pair changes a
  modeled result;
- no Plan Executor or Lua changes in this gate;
- no protocol version bump or compatibility adapter;
- no later-biome adapter work; and
- no exchangeable outcome group without an explicit complete-valid engine
  proof.

Narrow validation:

- focused engine execution-disposition, codec, compiler, and fixture tests;
- `npm run test:engine`;
- focused application publication tests;
- `npm run typecheck`;
- `npm run lint`;
- `npm run format:check`;
- `git diff --check`.

Completed commit: `feat(engine): publish sparse execution dependencies`.

### Gate B — Plan Executor controlled replacement and cutover

Owning repository: Plan Executor, with the modpack shell used only for contact
and smoke verification.

Build the replacement coordinator against Gate A.2's fixtures, harvest the
proven native adapters, then atomically switch `main.lua`/hook composition to
the new runtime and delete the superseded active implementation. The committed
gate must not contain two selectable coordinators or a protocol compatibility
mode.

Deliver:

- the strict replacement decoder using opaque owner IDs and reference
  integrity rather than semantic-address parsing;
- one load-time expansion of the globally sequenced diagnostic `replace`
  frames into complete per-checkpoint state before any room-exit conformance
  lookup, including a ready-to-compare expected value for every named
  conformance fact; this is decoder state only and never a runtime route
  cursor;
- route and room sessions;
- logical Overview and Doors checkpoints;
- occurrence-local owner prerequisite edges and obligations;
- exact adapter-owned transaction binding through published fields and native
  object identity, with no authored-order fallback matching;
- all four closed runtime-fallback contacts, with preferred and declared
  fallback outcomes completing the same owner;
- sparse room-exit pending/clocked-state conformance with no route-level
  completed-owner set;
- diagnostic-only Run State logging;
- clean configured-prefix completion after terminal Doors;
- explicit native hook groups and harvested F/G realization adapters;
- the existing inbox, bootstrap, status, and deployment contacts;
- byte-identical copies of all five Gate A.2 execution fixtures; and
- deletion of the cursor runtime and its cursor-specific tests.

Implementation proceeds through four bounded internal passes while retaining
one atomic committed cutover:

1. replace the decoder and mirror all five protocol-v10 fixtures;
2. build the pure route and room sessions against decoded data;
3. harvest proven native realization algorithms behind explicit hook groups
   and exact owner bindings; and
4. switch `main.lua`, delete the trace coordinator and cursor-oriented tests,
   then run the complete Gate B verification.

No intermediate commit may expose two selectable coordinators or a
protocol-v9 compatibility mode.

Primary test ownership:

- protocol tests own bounded decode, closed unions, uniqueness, and reference
  integrity, including sequential diagnostic-frame expansion and rejection of
  a missing or out-of-order baseline; focused positive vectors cover every
  Timeline transaction union member, including `shopPurchase`, `poolSale`,
  `keepsakeChange`, `automatic:steadyGrowth`, and
  `automatic:transcendentEmbryo`, without turning the five route fixtures into
  an exhaustive schema matrix;
- session tests own occurrence advancement, checkpoint closure, atomic
  completion, local prerequisite failure, obligation failure, room-exit state
  conformance, room-owner disposal, terminal-prefix completion, unmatched
  guidance nonblocking behavior, and diagnostic nonblocking behavior;
- one publication witness omits an untouched optional action, while a paired
  authored-optional witness publishes it with exactly one obligation;
- hook/adapter tests own native realization contacts without reproducing
  session policy;
- fallback adapter tests own preferred success, one-step fallback success, and
  neither-result failure at each of the four closed availability contacts;
- conformance adapter tests own the seven reachable F/G readers and explicit
  rejection of the two later-route-only conformance contacts;
- Chaos tests retain gate/return behavior;
- the mirrored automatic/boss fixture owns `bossDefeated` automatic contacts,
  while the Ixion/Chaos fixture owns Travel Deal's source-to-refill edge;
- one representative F/G session owns the complete room-entry → Timeline →
  Doors → next-room loop and configured-prefix completion; and
- deliberate mismatches cover wrong room, missing Overview fact, wrong
  consequential outcome, unresolved obligation, and wrong Doors product.

Narrow validation:

- `lua tests/all.lua` in the Plan Executor;
- parse every active Lua source with `luac -p`;
- `luacheck` for the active module and tests;
- mirrored-fixture byte comparison;
- `lua tests/smoke.lua` in the modpack shell; and
- the shell's focused local test command.

Intended executor commit: `feat(executor): replace trace runtime with room sessions`.

The modpack shell receives only a submodule/reference update if required; it
does not own execution semantics.

### Gate C — Live F/G conformance closure

Owning authority depends on each observed discrepancy. The compiler is not the
default remediation owner.

Deploy and probe at least:

1. route-start keepsake immediate results and F opening reward;
2. ordinary F room contents and multi-door generation;
3. required acquisition before cleanup interaction;
4. World Shop, interacted/uninteracted Well, Pool, rack, fountain, and
   resources;
5. Artificer source and generated replacement;
6. Mystery Boon provider and trait selection;
7. Narcissus, Artemis, and supported Nemesis interactions;
8. natural and Ixion-generated Chaos, three-option offer, acquisition, and G
   return batch;
9. Anomaly and Zagreus Contract topology; and
10. entry into the next expected occurrence after each supported detour.

For each failure:

- wrong authored/simulated fact returns to catalog or planner-engine authority;
- missing engine fact returns to the engine execution product;
- misencoded explicit fact returns to the compiler/codec;
- wrong native contact or translation returns to the owning adapter; and
- player divergence remains a bounded room/transaction mismatch.

Run State differences are logged for adjudication and cannot be converted back
into a universal blocking comparison during remediation.

Gate C closes only with recorded live evidence for the supported F/G seams and
no unresolved first-mismatch blocker in the representative route.

### Gate D — Closure and durable absorption

- rewrite `GAME_INTEGRATION_BOUNDARY.md` around the room cursor, Room
  Occurrence sessions, logical checkpoints, and sparse planner-owned
  prerequisites;
- update the concise F/G execution record in `IMPLEMENTATION_PROGRESS.md`;
- update the Plan Executor README to the replacement protocol and runtime;
- remove protocol-v9 wording and active comments from both repositories;
- delete this temporary plan after its durable decisions are absorbed;
- run one complete Run Planner `npm run check` after all narrow lanes and
  review remediations are stable;
- rerun the final Plan Executor suite, Lua parse, Luacheck, fixture mirror, and
  modpack shell smoke once; and
- commit closure independently in each owning repository.

Completed unchanged lanes are not rerun merely to create duplicate evidence.

## Review routine

Each implementation gate follows the repository's executor/reviewer routine:

1. record the exact clean or explicitly inventoried base commits;
2. use a fresh executor owning the complete gate;
3. run narrow owning tests while implementing;
4. use a fresh independent reviewer against this locked plan and the owning
   audits;
5. route accepted findings through one bounded remediation pass;
6. perform the main session's cross-repository bird's-eye review; and
7. commit only after superseded paths and duplicated policy are removed.

Gate B is intentionally one substantial cutover gate. Internal work may be
implemented in bounded passes, but no committed intermediate state may expose
both coordinators, restore protocol-v9 compatibility, or leave the active
executor with silently reduced F/G coverage.

## Explicit exclusions

- H, I, N, O, P, Q, and Dream Dives native realization;
- mid-run attach, recovery, plan edits, replay, or replanning;
- changing authored project schema or the planner Timeline editor;
- probabilistic/RNG simulation;
- health, Gold, damage, Magick, or meta-resource correctness comparisons;
- a runtime graph scheduler, topological executor, workflow engine, or event
  bus beyond direct prerequisite checks;
- unowned outcome allocation without engine-certified exchangeability;
- generic fallback or fuzzy native matching;
- protocol-v9 compatibility or dual-runtime selection;
- another archived copy of the active executor;
- runtime parsing of planner semantic-address grammar;
- runtime reconstruction of reward bags, candidates, trait legality, or Run
  State; and
- release/installer changes unrelated to the execution cutover.

## Adversarial review

The plan is accepted against the following challenges:

### Is this merely protocol v9 with fewer comparisons?

No. The global trace program and cursor are deleted. Room entry selects one
occurrence-owned runtime session; Timeline contacts complete owners through
declared prerequisites; Doors are one complete checkpoint product.

### Does the room cursor become another hidden action cursor?

No. It advances only when the game enters the next selected Room Occurrence.
Timeline completion has no action cursor. Lifecycle windows and prerequisite
checks are scoped to exact owners and cannot be advanced by unrelated
callbacks.

### Does this weaken the planner's deterministic Timeline?

No. The planner still simulates the complete authored total order. The engine
projects only the hard subset needed to protect that exact result at runtime.

### Does the executor decide which actions matter?

No. Omitted optional guidance, intended transactions, prerequisite edges, and
obligations are complete-valid engine products. The compiler copies them and
the executor strictly consumes them.

### Does the sparse DAG require a graph engine?

No. The document is a DAG because prerequisite edges may fan in and fan out,
but runtime completion only checks whether the current owner's listed
same-room prerequisites are in the room session's completed-owner set. No
search, topological sort, scheduling, route-level owner retention, or semantic
rule evaluation is required.

### Is starting from scratch discarding proven work?

No. Transport, deployment, native seam discovery, and concrete realization
algorithms are retained or harvested. Only the trace-shaped ownership and APIs
are deliberately not preserved.

### Could a compatibility layer lower delivery risk?

It would create two semantic authorities and force every adapter to serve both
models. Strict protocol versioning and an atomic executor cutover are the
smaller, safer boundary at this pre-release stage.

### Does diagnostic Run State silently remain blocking?

No. Tests must prove a diagnostic difference is emitted while the session
stays synchronized. Only the separate engine-owned sparse room-exit conformance
delta is blocking; the runtime cannot convert another Run State difference into
a mismatch.

### Does room-exit conformance duplicate Run State semantics?

No. Run State remains the canonical value product and owns the normalized
meaning of keepsakes, traits, clocks, deliveries, Well effects, and other
retained state. The conformance delta only identifies which already-derived
values changed in the current occurrence and are block-worthy at closure. It
does not own or replay their transition rules.

### Does ignoring selected-exit callbacks permit silent divergence?

Only until the next meaningful boundary. Every planned door is still realized
and verified. Entering a room outside the selected occurrence sequence blocks
at the next room-entry checkpoint with a direct, stable discrepancy.

## Completion condition

This plan is complete only when the active F/G Plan Executor is organized
around the selected occurrence cursor and one current Room Occurrence session;
Overview, consequential Timeline nodes with planner-owned prerequisites,
required obligations, sparse room-exit pending/clocked-state conformance, and
Doors are the complete blocking surface; full Run State and incidental callbacks
are diagnostic; protocol-v9 trace machinery is deleted; the representative live
F/G route succeeds; durable authorities record the replacement; and this
temporary plan is removed.
