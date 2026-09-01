# Game Execution Room-Session Replacement Plan

## Status

Locked on 2026-09-01 after the execution Timeline reconciliation audit and a
live inventory of the current planner protocol and Plan Executor.

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
  owner-bearing semantic-stream disposition.
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
- Most semantic streams are occurrence-local. The selected occurrence cursor
  already orders completed prior rooms before the current room.
- Cross-room effects retain only their concrete native correlation state, such
  as a pending Shrine delivery or Ixion-created gate origin. They do not create
  a second global action cursor.

## Locked runtime model

### Route session

The route session owns only:

- the frozen decoded execution plan;
- the selected occurrence sequence and current room index;
- the current room session, if one is active;
- bounded cross-room native correlations required by concrete supported
  features;
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
- occurrence-local semantic streams;
- completed semantic transaction owners;
- explicit owner dependencies;
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

### Semantic transaction completion

When a native adapter reports one consequential transaction, the room session
performs one atomic operation:

1. locate the transaction by its opaque semantic owner;
2. verify that every explicit dependency is complete;
3. verify that the owner is at the head of every stream in which it
   participates;
4. compare only the transaction's planner-visible outcome;
5. mark the owner complete; and
6. advance every participating stream together.

Failure before step 5 advances nothing. The runtime does not topologically
sort, search for another match, or infer exchangeability.

This requires only a completed-owner set, a cursor per published stream, and
checkpoint obligation sets. It does not justify a general graph engine, event
bus, rule registry, or embedded simulator.

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

## Execution product

The replacement execution document remains strict, bounded, data-only JSON.
It contains:

1. protocol/catalog identity and the route-start keepsake result;
2. an explicit selected occurrence sequence for the route cursor;
3. occurrence records addressed by stable opaque IDs;
4. each occurrence's complete supported Overview realization product;
5. its consequential semantic transactions, owner dependencies, stream
   memberships, and checkpoint obligations;
6. its complete supported Doors realization product; and
7. optional diagnostic Run State snapshots or deltas keyed to room entry and
   door readiness.

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

- normal, Time Piece, and Artificer reward dispositions;
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

A transaction may participate in more than one owner-bearing stream. Mystery
Boon acquisition is the representative multi-stream witness: its exact pickup
owner participates in provider resolution and the resulting trait-history
mutation. An unrelated simulation-neutral purchase advances neither stream.

The engine does not publish an unowned outcome-allocation stream for Mystery
Boon, Artificer, or any other family unless complete-valid evaluation has
explicitly certified a bounded group exchangeable. No current family is
presumed exchangeable merely because two outcomes have the same display type
or final inventory count.

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

### Diagnostics and mismatch policy

Run State snapshots remain available for investigation. The executor may log a
bounded expected/observed difference at room entry or door readiness, but that
difference never changes session synchronization.

The first blocking mismatch is limited to:

- invalid or incompatible published input at run start;
- entering a different occurrence than the room cursor expects;
- failure to realize or prove an expected Overview fact at room entry or its
  later feature-owned generation contact;
- a consequential transaction with a different non-equivalent result;
- a consequential owner used before its dependency or semantic-stream turn;
- an unresolved required obligation at its lifecycle checkpoint; or
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
- fountain, resource, Nemesis, Anomaly, and supported automatic-effect native
  contacts; and
- native object/slot tagging that provides stable semantic correlation.

Harvesting preserves proven behavior, not current `session.lua` method names or
trace-oriented call structure.

### Rebuild

- execution protocol model and decoder;
- route and room session state;
- Overview and Doors proof accumulation;
- semantic transaction completion;
- lifecycle obligations and local streams;
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

| Product or primitive       | Required concrete witness                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| selected occurrence cursor | F opening through an ordinary continuation; Ixion Chaos detour and declaration-sized G return                         |
| Overview checkpoint        | interacted and uninteracted Well/Pool presence, resources, encounter assembly, Chaos/Contract, and an incoming reward |
| Doors checkpoint           | ordinary F multi-door batch, Anomaly replacement, and one-, two-, and three-exit Chaos returns                        |
| owner-bearing stream       | two trait-history mutations whose authored offers depend on their order                                               |
| multi-stream transaction   | Mystery Boon provider resolution plus its exact resulting trait acquisition                                           |
| owner dependency           | Artificer source conversion before its generated replacement pickup                                                   |
| checkpoint obligation      | required incoming/Onion acquisition before later cleanup or room exit                                                 |
| guidance omission          | a simulation-neutral Well purchase that does not affect any later modeled result                                      |
| automatic transaction      | Steady Growth or Transcendent Embryo at its exact reached end-effects checkpoint                                      |
| diagnostic-only Run State  | an expected/observed difference that is logged while the session remains synchronized                                 |

No primitive is added only for a later biome or hypothetical action family.

## Delivery gates and commit boundaries

### Gate A — Engine execution disposition and protocol replacement

Owning repository: Run Planner.

Deliver one complete engine-to-publication vertical slice:

- add the engine-owned occurrence execution product described above;
- classify every Room Action family reachable in the supported F/G execution
  product into a published consequential transaction,
  dependency/obligation, or omitted guidance disposition;
- publish the selected occurrence sequence, Overview, local Timeline
  reconciliation, Doors, and diagnostic-only Run State;
- replace protocol v9 with strict protocol v10;
- keep the compiler a lossless mapper from the complete-valid engine product;
- regenerate the three representative execution fixtures;
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
- `f-opening`, `fg`, and `fg-ixion-chaos` fixtures own representative complete
  byte products;
- focused tests own Mystery Boon's multi-stream transaction, Artificer's
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

### Gate B — Plan Executor controlled replacement and cutover

Owning repository: Plan Executor, with the modpack shell used only for contact
and smoke verification.

Build the replacement coordinator against Gate A's fixtures, harvest the
proven native adapters, then atomically switch `main.lua`/hook composition to
the new runtime and delete the superseded active implementation. The committed
gate must not contain two selectable coordinators or a protocol compatibility
mode.

Deliver:

- the strict replacement decoder using opaque owner IDs and reference
  integrity rather than semantic-address parsing;
- route and room sessions;
- logical Overview and Doors checkpoints;
- occurrence-local streams, dependencies, and obligations;
- diagnostic-only Run State logging;
- explicit native hook groups and harvested F/G realization adapters;
- the existing inbox, bootstrap, status, and deployment contacts;
- byte-identical copies of Gate A's execution fixtures; and
- deletion of the cursor runtime and its cursor-specific tests.

Primary test ownership:

- protocol tests own bounded decode, closed unions, uniqueness, and reference
  integrity;
- session tests own occurrence advancement, checkpoint closure, atomic
  multi-stream completion, dependency failure, obligation failure, and
  diagnostic nonblocking behavior;
- hook/adapter tests own native realization contacts without reproducing
  session policy;
- Chaos tests retain gate/return behavior;
- one representative F/G session owns the complete room-entry → Timeline →
  Doors → next-room loop; and
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
  Occurrence sessions, logical checkpoints, and semantic streams;
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
- a general dependency graph, scheduler, workflow engine, or event bus;
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
local streams/dependencies; Doors are one complete checkpoint product.

### Does the room cursor become another hidden action cursor?

No. It advances only when the game enters the next selected Room Occurrence.
Lifecycle windows and semantic-stream cursors are scoped to the active room
and cannot be advanced by unrelated callbacks.

### Does this weaken the planner's deterministic Timeline?

No. The planner still simulates the complete authored total order. The engine
projects only the hard subset needed to protect that exact result at runtime.

### Does the executor decide which actions matter?

No. Omitted guidance, stream membership, dependencies, and obligations are
complete-valid engine products. The compiler copies them and the executor
strictly consumes them.

### Is a general DAG being hidden behind streams?

No. Current hard edges are represented by a completed-owner set, a small
number of owner-bearing chains, and checkpoint obligation sets. No search,
topological sort, or rule evaluation is required.

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
stays synchronized. No mismatch path accepts Run State difference as its sole
cause.

### Does ignoring selected-exit callbacks permit silent divergence?

Only until the next meaningful boundary. Every planned door is still realized
and verified. Entering a room outside the selected occurrence sequence blocks
at the next room-entry checkpoint with a direct, stable discrepancy.

## Completion condition

This plan is complete only when the active F/G Plan Executor is organized
around the selected occurrence cursor and one current Room Occurrence session;
Overview, consequential Timeline transactions, required obligations, and Doors
are the complete blocking surface; Run State and incidental callbacks are
diagnostic; protocol-v9 trace machinery is deleted; the representative live
F/G route succeeds; durable authorities record the replacement; and this
temporary plan is removed.
