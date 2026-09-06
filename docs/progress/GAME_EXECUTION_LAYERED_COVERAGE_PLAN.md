# Layered Game Execution Coverage Plan

## Status

Drafted on 2026-09-02 for adversarial review. Gates A, A.2, B, B.2, C1, C2,
C2.5, C3, C4, and D1 through D8 are complete as of 2026-09-05. Gate D closure
has recorded the universal disposition matrix, retired the superseded broad
trait paths, and completed its bounded verification. The follow-up NPC vertical
closure now also covers Medea, Arachne, Narcissus, Circe, Icarus, and Echo
without enabling their deferred route structure. The focused keepsake closure
now covers all 33 selectable keepsakes, including Aromatic Phial target
steering, complete retained-state reading, and Gift Gift Gift's volatile
Hammer/Embryo replay. Gate E's five commerce slices are complete as of
2026-09-06: Anvil of Fates, all three World Shops, Pools of Purging, Stygian
Wells, Shrines of Hermes, and their shared Travel Deal contacts now have bounded
execution dispositions. Gate F was reassessed against the live protocol-v24
product, semantic executor layout, durable contact audits, and primary tests on
2026-09-06. Its former room-action and automatic-effect implementation lists
were already closed by earlier acquisition, encounter, keepsake,
transformation, and commerce slices. Gates F1 and F2 are now complete: residual
native contacts are proved, the universal F/G disposition inventory is
exhaustive, and durable execution authorities describe the current boundary.
Gate G's focused live F/G proof is next; Gate H remains the final durable and
Windows closure. Do not begin a later gate until its components, ownership,
native contacts, pass-through boundary, and concrete witnesses have been
discussed, cleaned up here, and locked.

Starting commits:

- Run Planner: `7450f08eb8efec44548386048bb86984726d67fd`
- Plan Executor: `b7ebefa8fdc2f2b2d4135ca1c909908c1186dcd4`
- Modpack shell: `f2fb00db1b867d65c0d5bde4861c4b7385afbeaf`

The room-session replacement is already complete. This plan does not replace
the route cursor, Room Occurrence session, sparse prerequisite DAG, Overview /
Timeline / Doors split, or first-mismatch shell. It replaces the former broad
"live F/G closure" gate with bounded semantic layers whose planner product and
native carriers can be audited and completed independently.

## Objective

Close the universal planner-to-game execution surface in layers so that a
future biome gate primarily adds that biome's room, encounter, reward, feature,
and exit structure rather than rediscovering how ordinary rewards, trait
effects, keepsakes, purchases, or generated pickups execute.

For every planner-modeled effect, the delivery path must answer six questions:

| Question                                                                                | Authority                         |
| --------------------------------------------------------------------------------------- | --------------------------------- |
| What semantic event occurred?                                                           | Planner engine                    |
| What exact result did the validated plan resolve?                                       | Planner engine                    |
| What data must cross the execution boundary?                                            | Engine execution product          |
| Through which native carrier is it realized or observed?                                | Plan Executor adapter             |
| Is it realized, locally verified, native pass-through, simulation-neutral, or deferred? | Owning audit and this plan's gate |
| Which concrete test or live probe proves that disposition?                              | Owning package or adapter test    |

The compiler remains a lossless translator. The Plan Executor remains a thin
native realizer and observer. Neither may infer trait policy, reward
eligibility, random outcomes, action dependencies, or substitute outcomes from
game-name strings, encoded addresses, callback order, or current inventory.

## Outcome boundary for later biomes

After closure, enabling H, I, N, O, P, Q, or Dream Dives may add:

- route- and biome-specific room topology;
- nonstandard encounter assembly such as H cages, N side rooms, O wheels, P
  phase envelopes, I goals, or Q structured rooms;
- biome-owned Overview or Doors contacts; and
- live evidence for already-implemented dormant native carriers.

It must not silently add a new generic reward, acquisition, trait-effect,
keepsake, Shop, Well, Pool, Shrine, substitution, or retained-state policy. If a
later biome exposes a genuinely new native carrier, that is not "just biome
structure": its contact audit and universal disposition must be amended before
the route is enabled.

This is a goal and an enforcement boundary, not a claim that every future game
callback is already known.

## Owning authorities

- [Game execution contact audit](../audits/game-execution-contacts/README.md)
  owns the complete semantic-family-to-native-carrier inventory and coverage
  statuses.
- [Game execution Timeline reconciliation](../audits/rooms-and-routes/GAME_EXECUTION_TIMELINE_RECONCILIATION_AUDIT.md)
  owns semantic transactions, native subcontacts, occurrence-local
  prerequisites, obligations, and carry-state closure.
- [Game integration boundary](../design/GAME_INTEGRATION_BOUNDARY.md) owns the
  durable planner/compiler/executor dependency direction.
- Focused loadout, trait, reward, keepsake, room-feature, and biome audits own
  source facts. This plan must not copy their full game-data matrices.
- `packages/planner-engine` owns the exact resolved execution product.
- `apps/planner` owns publication and transport only.
- `adamantRunPlanner-Plan_Executor` owns strict decode, native translation,
  bounded contact state, realization, and local verification.
- The modpack shell owns deployment, smoke, and the pinned executor revision;
  it owns no semantic rule.

## Current-state inventory

### Proven base retained

- Protocol v24 publishes one selected Underworld F or F/G occurrence sequence
  with Overview, consequential Timeline transactions, local prerequisites,
  obligations, Doors, sparse room-exit conformance, and diagnostic Run State.
- The active executor uses a route cursor and one Room Occurrence session. The
  global callback/action cursor has been removed.
- Artificer producer relations, Mystery Boon staging, required boss rewards,
  Chaos pairs and returns, World Shops, Wells, Pools, resources, fountains,
  racks, and F/G topology have working bounded paths. Runtime fallback support
  is a superseded path removed by Gate D2.5.
- Ordinary and NPC trait offers, Mystery Boons, visible and direct level
  outcomes, direct pickup consumption, and Artificer transformations now have
  focused native adapters. Optional untaken actions and Time Piece destruction
  are omitted at the planner-to-executor boundary.

These are implementation evidence. Each layer below may retain them only after
its coverage matrix proves the contact; working code is not exempt from audit.

### Remaining boundary after Gate D

| Layer                 | Disposition after closure                                                                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structure             | The F/G room/reward/encounter/feature/Door proof is closed. Live host probes remain evidence work, not a missing execution product.                                                      |
| Acquisition carriers  | Ordinary, level, direct-pickup, NPC, Mystery Boon, Artificer, Spell, and Path carriers are closed. Commerce remains Gate E; later-route carrier activation remains route-owned.          |
| Trait effects         | Natural Selection, All Together, Concave Stone, and Sea Star have exact scoped products. Ransoms are native-authoritative, not a second executor implementation.                         |
| Keepsake effects      | Closed for all 33 keepsakes. Phial steering, complete retained-state reading, and Gift's exact volatile Hammer/Embryo replay use bounded native contacts; passive effects remain native. |
| Commerce              | Closed for World Shops, Anvil, Pools, Wells, Shrines, and Travel Deal. Native purchase, sale, delivery, and retained-effect algorithms remain game-owned.                                |
| Later-route abilities | Spell/Hex, Path, and all six bespoke NPC menu/consequence adapters are covered but await route activation and bounded live native probes. Biome-specific structure remains deferred.     |

## Locked architectural rules

### One semantic owner, potentially several native contacts

A trait acquisition may construct a screen, select a row, apply a trait, run a
trait-specific callback, create pickups, and update retained state. Those are
native subcontacts of one semantic owner unless a new freely interactable
object is created. Concave Stone's frozen residual remains inside its source
acquisition; Sea Star's later world pickup remains a separate child owner.

### Exact result before native mapping

If the planner authors a random or multi-target result, the engine product must
publish the exact resolved outcome before the executor can support it. Examples
include Natural Selection targets, All Together grants, Sea Star proc/no-proc,
and Concave Stone's residual. Lua may map the result to `DistributeLevels`,
`GrantBoons`, or another native contact; it may not recreate the selection.

### Native pass-through is explicit

An effect may be native pass-through only when:

1. the planner does not author a random choice inside it;
2. its inputs are already exact and locally bound;
3. vanilla execution deterministically produces the modeled result; and
4. a focused test or source-backed audit names the settlement contact.

"The game probably handles it" is not a disposition. Simulation-neutral
health, Gold, damage, Magick, and meta-resource amounts remain ignored after
the relevant object or selection identity is realized.

### Negative outcomes are products when native randomness can contradict them

Publishing only a generated child proves a positive result but cannot suppress
an unplanned native proc. Sea Star, optional keepsake procs, and similar
effects must carry the planner-authored negative outcome wherever the live game
would otherwise roll independently.

### Universal policy does not move into biome modules

Biome modules may identify room declarations and native structural contacts.
They may not own generic trait, item, Shop, Well, acquisition, or keepsake
semantics. General room handling remains in a general adapter; a biome-specific
module contains only genuinely exceptional facts for that biome.

### Test-owned coverage, no production registry

Coverage closure may use test-only expected sets for closed catalog or protocol
families. Do not add a production capability registry, plugin table, semantic
callback language, or manifest whose only purpose is proving that every case
was remembered.

### Executor organization follows semantic ownership

The executor may introduce a semantic directory when a gate owns several
cohesive protocol, session, native-contact, and hook responsibilities. The
gate moves the existing implementation and its primary tests into that slice
and deletes the superseded root-level path in the same change. Root modules
compose the slices; they do not retain a second implementation or forward
individual semantic operations.

This is not a requirement to create one directory or one file per feature.
Keep a cohesive module intact when splitting it would only add imports and
wrappers. Do not create empty future gate directories, generic registries, or
parallel `old` and `new` layouts. Later gates decide their own smallest useful
boundary during their component review.

### Dormant later-route contacts still need real planner evidence

A later-route semantic product may enter the active execution protocol before
its route structure is publishable only when a planner test assembles it from a
real complete-valid occurrence evaluation through the existing occurrence-level
execution projection. The executor may then consume that exact payload in
protocol and native-adapter tests. Do not fabricate an impossible F/G
occurrence, add a test-only production builder, or enable the later route merely
to manufacture coverage.

This proves the planner-to-wire contact without claiming a live native probe.
Live support remains deferred until the owning biome gate reaches that contact.

## Protocol policy

Protocol v16 is the completed carrier baseline through D2. Gate D2.5 advances
the single active development protocol to v17 for explicit modeled-state
publication; D3 and every later gate target v17:

- there is no compatibility decoder or dual executor for an earlier protocol;
- each gate updates planner fixtures, strict Lua decode, and the modpack pin in
  lockstep before that gate is considered complete;
- a protocol change must be earned by a concrete closed field or variant named
  by the refined gate rather than silently mutating an already-consumed shape;
- unknown fields and union members remain rejected; and
- v16 is not declared stable or release-ready until the final closure gate.

This does not authorize a generic `effectName`/`arguments` object or speculative
placeholders for later features.

## Delivery gates

Each gate is refined before implementation. Refinement must enumerate the
finite modeled components, separate verification from realization and native
pass-through, identify the engine product and native carrier for every
consequential result, and remove work that belongs to a later lifecycle. The
gate text is then rewritten as a clean contract rather than accumulating
discussion notes. A later gate outline is not authority to fill gaps by
analogy while implementing an earlier gate.

### Gate A — Run-start loadout contract

User-visible outcome: a published plan cannot begin realizing rooms under a
different weapon, aspect, Arcana board, Fear configuration, or starting
keepsake, and Aspect of Selene begins with the authored Sky Fall tree rather
than a different native random tree.

#### Component dispositions

| Component         | Start-boundary disposition                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Weapon            | Read and compare the equipped weapon. A mismatch stops planner realization before the opening room and delegates the run to the native game; the executor does not equip or unlock it. |
| Aspect            | Read and compare the equipped aspect. Except for Aspect of Selene's linked Hex initialization, aspect behavior remains native or is represented by later resolved products.            |
| Arcana            | Compare the exact active starting cards, including engine-derived automatic activation, origin, and rarity. Do not rewrite the Crossroads board.                                       |
| Fear              | Compare configured and effective ranks at their respective native start state. Downstream effects such as Forfeit, Denial, Void, and Rivals remain planner-resolved facts.             |
| Starting keepsake | Compare the selected keepsake at `EquipKeepsake`, preserve deterministic native equip behavior, and realize any published exact immediate result.                                      |
| Aspect of Selene  | Realize and verify the linked Sky Fall spell plus its authored starting layout and modeled special-node identities at native aspect initialization.                                    |

The route start has two bounded windows. Before native run initialization, the
executor checks the player-selected weapon, aspect, manual Arcana
configuration and rarities, configured Fear, and starting keepsake. A failure
does not call the planner room realizer, but the native run still starts and
selects its own opening room. During native initialization, the executor
arms only the exact nested starting contacts for the selected keepsake and
Aspect of Selene. Before the first Room Occurrence session can be armed, it
verifies the derived active Arcana/effective Fear state and the required
starting results.

Planner deliverables:

- promote the selected weapon and aspect, the exact active Arcana identities,
  origins, and rarities, and configured/effective Fear ranks from the
  complete-valid route frontier into one explicit `startingLoadout` execution
  product;
- retain `startingKeepsake` as the single start-equip product, including the
  already-authored exact Jeweled Pom, Experimental Hammer, or Transcendent
  Embryo immediate result when applicable;
- when Aspect of Selene is selected, publish one explicit starting-Hex result
  containing `SpellMoonBeamTrait`, the selected layout, the authored Rare and
  Epic node identities, and the initial God Sent extension and identity when
  the engine has already derived it;
- omit a starting-Hex result for every other aspect; and
- bump the execution protocol to v11 with strict codec/compiler coverage.

Executor deliverables:

- establish `mods/loadout/` as the owned run-start slice, absorbing the
  existing starting-keepsake decoder, pending start state, `StartNewRun` /
  `EquipKeepsake` hooks, immediate-result contacts, and the new loadout and
  Selene contacts;
- use a small internal split only where responsibilities are real: strict
  loadout protocol decoding, start-session verification/state, and native hook
  composition; add a separate native reader/contact module only if combining
  it with the session or hooks would mix policy with game access;
- leave `mods/logic.lua` responsible for constructing and attaching the
  loadout slice, and remove starting-keepsake state and comparison policy from
  `mods/runtime_session.lua`;
- move the existing start/keepsake tests out of the broad hook-composition
  suite into loadout-owned protocol and native-contact tests, reusing shared
  harness support rather than copying it;
- read the bounded native loadout at the `StartNewRun` boundary and keep the
  Room Occurrence session unarmed until start conformance closes;
- treat weapon, aspect, Arcana, and Fear as exact checked prerequisites rather
  than forcing or repairing the player's configuration;
- retain starting keepsake realization through the existing nested
  `EquipKeepsake` contact, constraining `AddRandomHammer`,
  `GiveRandomHadesBoonAndBoostBoons`, or `AddRandomChaosBlessing` only when the
  published starting result owns that call;
- at Aspect of Selene's native linked-spell initialization, constrain
  `CreateTalentTree` to the published layout and modeled Rare/Epic and initial
  God Sent identities while leaving ordinary unmodeled node identities and
  native spell/cache setup intact;
- verify the installed Sky Fall spell and those modeled tree dimensions after
  initialization rather than replacing the completed native spell state; and
- stop planner enforcement cleanly on a loadout mismatch, while allowing the
  current native operation and the rest of the run to continue.

The executor must not mutate permanent save progression, unlock weapons,
rewrite the Crossroads Arcana board, or silently change Vows. The player may
correct the loadout and start a new run, matching the established no-mid-run
attach policy.

Aspect of Persephone has no run-start result beyond its verified aspect
identity. Its 0-5, or Premium-Service 0-8, additive contribution is already
folded into later authored trait offers' effective levels and is exercised at
those offers. The executor must not recompute or apply it during loadout.

Aspect of Selene starts with zero banked and invested Path points and does not
record a Spell Drop use at initialization. Later Spell Drops, Talent Drops,
Moon Beam points, late God Sent insertion, investment, and closed-tree
behavior remain Gate D7 work, but must reuse the starting-Hex tree realization
primitive rather than introduce a second layout representation or native
tree-forcing path.

Primary witnesses:

- one non-default weapon/aspect F fixture;
- active manual and automatically activated Arcana with rarity plus one
  inactive card;
- configured and effective Vow ranks, including a Rivals-selected boss variant;
- one mismatch each for weapon/aspect, Arcana, Fear, and starting keepsake;
- exact starting results for Jeweled Pom, Experimental Hammer, and
  Transcendent Embryo through their native nested contacts;
- Aspect of Selene installs the published Sky Fall layout and Rare/Epic nodes,
  with one witness for an initial God Sent extension and one without it;
- Selene initialization leaves Path points at zero and does not record a Spell
  Drop use; and
- Aspect of Persephone publishes no starting realization and still reaches a
  later offer through its planner-authored effective level.

Gate A must delete the displaced root implementations. Success is not a new
`loadout` facade that delegates back to `logic.lua`, `runtime_session.lua`, or
`protocol.lua` for the actual policy.

Intended commits:

- Run Planner: `feat(execution): publish starting loadout contract`
- Plan Executor: `feat(executor): verify starting loadout contract`
- Modpack shell: pin the completed executor commit.

### Gate A.2 — Native-owned startup and post-start conformance

Gate A's execution product remains authoritative and unchanged. This corrective
gate replaces only the executor lifecycle used to consume it. A live run showed
that the outer `StartNewRun` pre-hook cannot read a `currentRun`-domain cache:
the game has not assigned `CurrentRun` yet, so the cache correctly returns
`nil`. The correction must not introduce a second pre-run cache or make every
Hex and keepsake adapter handle both cached and uncached execution.

Gate A.2 starts from:

- Run Planner: `1db91596`;
- Plan Executor: `668a367`; and
- Modpack shell: `3281dac`.

#### Native lifecycle and chosen boundary

The relevant native order is fixed:

1. `StartNewRun` assigns a new `CurrentRun` and calls `RunStateInit`;
2. `CreateNewHero` constructs and returns the hero;
3. `EquipKeepsake` applies the starting keepsake and its nested result;
4. `EquipWeaponUpgrade` applies the aspect and creates Aspect of Selene's
   starting Hex tree;
5. `EquipMetaUpgrades` installs the active Arcana state;
6. `ChooseStartingRoom` creates the opening room; and
7. `StartNewRun` returns the completed native run.

`CreateNewHero` is called only by `StartNewRun`, and `CurrentRun` already exists
when that call begins. It is therefore the stable session-attachment contact.
`RunStateInit` is not suitable because it also runs during ordinary map load.

The executor uses one run-owned session with the following lifecycle:

```text
inactive
   | CreateNewHero
   v
starting
   | StartNewRun returns
   +-- completed loadout conforms --> synchronized
   +-- mismatch -------------------> desynchronized
```

The `starting` phase exists only during the synchronous native `StartNewRun`
call. It makes the decoded plan available to the exact startup contacts without
claiming that the completed native loadout already conforms.

The native realization primitives are not loadout-specific. A keepsake result
adapter receives one exact resolved Experimental Hammer, Jeweled Pom, or
Transcendent Embryo outcome and constrains that keepsake's ordinary native
contact. A Hex-tree adapter receives one exact resolved spell/layout/node
outcome and constrains the ordinary native tree contacts. Neither primitive
knows whether its owner is the starting loadout, a later Keepsake Rack change,
or a later Hex acquisition. Owner resolution remains outside the primitive:
Gate A.2 supplies the starting-loadout owner, while the later owning gate may
supply a room Timeline owner without creating another realization path.

#### Realization and validation policy

During `starting`, the executor may realize only outcomes it can constrain at
an exact native contact:

- Experimental Hammer's selected Hammer or exhausted result;
- Jeweled Pom's exact selected Hades trait;
- Transcendent Embryo's selected Chaos blessing;
- Aspect of Selene's linked spell, layout, modeled Rare/Epic identities, and
  initial God Sent result; and
- the published opening Room Occurrence.

The opening room is intentionally optimistic. It may be realized before the
completed loadout is known to conform. If post-start validation later fails,
that already-created room is retained and all subsequent planner enforcement
stops. This is the sole relaxation from Gate A's earlier requirement that a
loadout mismatch be known before opening-room realization.

After native `StartNewRun` returns, the executor performs one completed-state
validation covering:

- weapon and aspect identities;
- exact active Arcana identities, manual/automatic origins, and rarities;
- configured and effective Fear ranks;
- starting keepsake identity and the exact immediate result when one was
  published;
- Aspect of Selene's installed spell and modeled tree dimensions; and
- zero initial banked/invested Path points and no recorded Spell Drop use where
  those facts are available in the Gate A contract.

Success promotes the same session to `synchronized` before `StartRoom` can arm
the opening Room Occurrence. Failure records the first mismatch and promotes it
to `desynchronized`. A mismatch never cancels `StartNewRun`, blocks player
input, suppresses a native callback, or causes an early return from a native
operation. The native run remains playable and the game owns all subsequent
behavior.

#### Executor deliverables

- keep the outer `StartNewRun` hook limited to opening the bounded start scope,
  invoking native construction, performing the one final validation, reporting
  its result, and cleaning up the scope on success or error;
- initialize and freeze the single `CurrentRun`-owned execution session at the
  `CreateNewHero` contact, before the native hero constructor runs;
- represent provisional startup explicitly as `starting`; do not overload
  `synchronized` or add an unrelated Boolean that can disagree with session
  state;
- let only starting-loadout contacts and starting-room realization consume a
  `starting` session; ordinary room, Timeline, feature, and Doors adapters must
  continue to require `synchronized`;
- give the starting-room adapter a bounded starting-occurrence accessor rather
  than broadening the ordinary route cursor API to provisional sessions;
- consolidate split pre-start/post-start comparison into one completed-loadout
  validator while retaining exact native readers and first-mismatch evidence;
- make starting and later keepsake effects use the same run-session-backed
  adapter and native hook. Keep Aspect of Selene on that same session contract
  so later Hex work does not require a startup-only cache path, without
  implementing the deferred later-Hex lifecycle here;
- extract or retain one owner-agnostic realization function for each of the
  keepsake-result and Hex-tree families. Starting-loadout code may select the
  expected result but must not contain a second copy of native selection or
  tree-construction policy;
- retain the exact nested scopes needed to bind a random native result to its
  owning keepsake or Hex call; and
- remove the superseded pre-run session access, `EquipMetaUpgrades` closure
  coordination, `startPrepared` handoff, and any nil-state branches added only
  to tolerate the invalid outer pre-hook.

Planner production, protocol v11, published fixtures, and the execution codec
do not change in Gate A.2. The game module must not equip a weapon or aspect,
rewrite the Arcana board, change Fear, add a general non-`CurrentRun` cache
domain, introduce a detached execution session, or add mid-run attachment.

#### Primary witnesses

- the outer `StartNewRun` hook performs no cache access while `CurrentRun` is
  absent;
- `CreateNewHero` creates exactly one `starting` session against the newly
  assigned `CurrentRun`;
- Experimental Hammer, Jeweled Pom, Transcendent Embryo, and Aspect of Selene
  realize their exact published results through their existing native contacts;
- the keepsake-result and Hex-tree primitives accept an exact resolved outcome
  without inspecting whether it came from a starting-loadout or Timeline owner;
- the opening room is realized while the session is `starting`;
- a conforming completed native loadout promotes the session before the first
  `StartRoom` contact;
- representative weapon/aspect, Arcana, Fear, keepsake-result, and Hex
  mismatches return the native run, retain the opening room, and disable later
  enforcement;
- a missing or malformed published plan leaves every native startup contact
  intact and does not crash;
- an error raised by native `StartNewRun` clears the bounded start scope before
  propagating the original error; and
- a later rack equip uses the same session-backed keepsake adapter without a
  startup-specific cache path.

Gate A.2 is one corrective executor commit followed by one shell pin. Its
intended commits are:

- Plan Executor: `fix(executor): attach after native run creation`; and
- Modpack shell: pin the corrected executor commit.

### Gate A.3 — Exact Transcendent Embryo blessing outcomes

Live Gate A.2 proof established that route-start Experimental Hammer, Jeweled
Pom, Transcendent Embryo, and Aspect of Selene realization all reach their
native contacts. It also exposed one planner under-model: every Embryo path
persists only the Chaos blessing identity. Simulation then substitutes the
minimum value for each operand at the derived rarity, while the executor leaves
the native magnitude roll unconstrained. That is not an exact resolved result.

This gate makes one closed Embryo outcome consist of `blessingKey` plus the
declaration-closed `blessingValues` record. The rarity is still derived from
the owning chronology: ordinary rank, Cherished Heirloom, Gift Gift Gift, and
the reached transformation decide rarity exactly as they do now. Authored data
owns only the independent within-rarity rolls. Fixed or context-derived values
remain declaration-derived and do not become fabricated authoring controls.

The same result shape applies without exceptions to:

- the route-start keepsake result;
- a Postboss Keepsake Rack result;
- the Gift Gift Gift replay result; and
- every reached eight-encounter transformation.

Planner deliverables:

- replace the identity-only equip result and phase-key transformation value
  with one exact authored Embryo result shape;
- validate a complete command against the selected blessing's closed operands
  and every captured derived-rarity frontier, while preserving structurally
  representable incomplete migrated state for contextual repair;
- reuse the ordinary Chaos blessing operand declarations, numeric bounds,
  stepping, normalization, and authoring defaults rather than create an
  Embryo-specific value table;
- show the selected derived rarity and the applicable value controls directly
  with the existing Embryo picker at route start, rack equip, Gift replay, and
  automatic transformation points;
- feed the exact authored values into trait history, Creation elements, Favor
  rarity pressure, Run State, and later eligibility instead of calling
  `transcendentEmbryoBlessingValues` to choose rarity minima;
- advance the project schema and provide one focused migration from schema 74
  that preserves each recorded blessing identity with an empty value record,
  making the unresolved magnitude visible and repairable without inventing a
  historical random roll; and
- advance the strict execution protocol and carry exact values on both
  keepsake equip results and automatic Embryo transactions.

Executor deliverables:

- decode the closed value record at both carriers;
- pass the exact result to the owner-agnostic Embryo realization primitive;
- reuse the existing Chaos blessing value applier so route-start, later rack,
  Gift replay, and automatic transformation contacts enforce identical native
  fields; and
- compare the realized result by blessing identity and applicable processed
  values without re-deriving rarity or operand policy in Lua.

Primary witnesses belong with their authorities:

- authored command and codec coverage for zero-, one-, and two-operand
  blessings, including rejected missing, extra, off-step, and out-of-range
  values;
- candidate and UI coverage that changing blessing or derived rarity restores
  declaration-owned defaults and that a migrated empty record remains
  repairable;
- simulation witnesses for Creation, Favor, and one effect-neutral numeric
  blessing using authored rather than minimum values;
- execution codec/compiler witnesses for starting/rack/Gift results and an
  automatic transformation; and
- Lua contact tests showing exact one- and two-operand application through the
  shared Chaos adapter.

This gate does not author Embryo rarity, change its eight-encounter clock,
generalize all random effects, or move Hex/keepsake code to its final feature
directories. It is one cross-lane correction followed by an executor pin; live
proof repeats one route-start Embryo and one reached transformation only.

### Gate B — Room, reward, encounter, feature, and Doors structure

User-visible outcome: the executor has one coherent structural contract for a
room rather than a collection of fixes tied to whichever native callback was
last observed.

Deliverables:

- audit current F/G room realization against every field in execution Overview
  and Doors;
- keep the route session outside `src/mods/navigation/`. The route session owns
  the configured occurrence cursor, current occurrence identity, route entry,
  and room-to-room advancement. The route/room handshake opens and closes
  exactly one inner room session around that current occurrence;
- make `src/mods/navigation/` a narrow, stateless transition adapter. It owns
  the complete normal/additional Door product, each Door's destination and
  reward, native Door bindings, incoming-reward realization for the selected
  transition, and reporting the selected destination back to the route session;
- make the room session the inner occurrence envelope. It owns the active
  occurrence, room-entry and room-exit checkpoints, local lifecycle windows,
  the sparse Timeline dependency graph, obligations, and coordination of
  separate room-identity, encounter, and feature components;
- organize exceptional F/G topology beneath `navigation/biomes/` only when it
  has real biome-owned behavior. Do not add empty per-biome shells or move later
  acquisition/effect policy merely because it occurs in that biome;
- retain general declaration-driven adapters for ordinary room structure and
  navigation rather than adding room-name branches;
- isolate only genuine F- or G-specific structure, including Anomaly, Zagreus
  Contract, and Chaos return batches, in bounded biome-owned modules if the
  current code benefits from that boundary;
- have the route/room handshake realize and prove current room identity; have
  encounter and feature components realize their inner-room facts; and have
  navigation realize incoming rewards plus additional and normal Doors at their
  stable logical checkpoints;
- keep required effect-neutral boss drops native without treating their exact
  meta-progression identity as a simulation result;
- keep native game-literal translation in the existing bounded sidecar rather
  than leaking native strings into planner policy; and
- delete the superseded top-level room/Overview/Doors realization paths and
  structural fragments left in generic feature hooks, along with redundant
  transition, raw door-class, or duplicate callback checks that do not
  contribute to Overview or Doors proof.

The route session is the sole outer cursor. Navigation does not own a second
cursor, the current room, lifecycle windows, Timeline obligations, encounters,
or room features. It reports the selected bound destination and lets the route
session advance. The room session owns the volatile inner-room envelope and
aggregates its component proofs: room entry compares the complete current room
and Overview product; Doors open compares the complete navigation product; room
exit closes local obligations and conformance. No component compares every
native transition between those checkpoints.

Feature presence and behavior remain deliberately separate. The room feature
component owns whether a Well, Pool, fountain, resource point, or other object
is present and reports that structural fact to the room-entry proof; its later
inventory, purchase, use, or acquisition behavior remains with the owning
Timeline/feature gate. A feature that creates an exit owns its spawn condition,
while navigation owns the resulting Door binding and selected-destination
report. Navigation proves the complete additional-door set at Doors-open;
room-exit conformance owns only retained effects such as Ixion consumption and
does not re-prove that topology. Protocol decoding remains in the protocol
family.

Room feature construction, native spawning contacts, and feature inventory
realization live under one bounded `room/features/` family. This includes
Timeline-triggered inventory mutations such as Travel Deal and, when H is in
scope, Gold Gold Gold. The feature adapter does not decide when either effect
is legal: it resolves the exact published mutation owner, asks the room
coordinator whether that owner is ready, performs the native mutation only
after approval, and reports completion afterward. The coordinator answers from
the local Timeline graph without knowing the feature or trait that produced the
dependency. Purchases, sales, choices, and acquired effects remain outside the
feature family.

Native room-exit readers and expected-versus-observed proofs live under a
bounded `room/conformance/` family. The room session owns only the atomic exit
boundary: it requests the complete conformance proof and closes only when both
local obligations and that proof pass. It does not dispatch individual
conformance kinds.

Primary witnesses:

- F opening, Combat, Miniboss, Story, Shop, Reprieve, Preboss, Boss, and
  Postboss occurrences;
- G Combat, Devotion, Anomaly, Contract, and natural/Ixion Chaos hosts;
- zero-, one-, two-, and three-normal-exit declaration shapes where reachable;
- one-, two-, and three-exit Chaos return batches;
- present/interacted and present/uninteracted Well/Pool Overview facts; and
- wrong room, missing required feature, wrong reward, and wrong complete Doors
  product each fail at their owning checkpoint only.

This gate must not add trait-effect or item-effect policy to a biome adapter.

Intended commits:

- Run Planner only if a missing explicit structural fact is found.
- Plan Executor: `refactor(executor): close declaration-driven room structure`
- Modpack shell: pin the completed executor commit.

### Gate B.2 — Occurrence-local Timeline runtime skeleton

User-visible outcome: actions inside a room may occur in every order the
validated plan permits, while exact dependencies and required lifecycle
deadlines still protect modeled outcomes. Later gates add native action
adapters to one stable room-local runtime rather than rebuilding ordering and
completion policy for each carrier.

This gate establishes the Timeline runtime only. It does not close the outcome
families assigned to Gates C through F.

#### Runtime ownership

The active room session remains the inner occurrence envelope:

```text
room session
├─ Overview and feature proofs
├─ Timeline session
│  ├─ published transaction owners
│  ├─ exact native-object bindings
│  ├─ open lifecycle capabilities
│  ├─ completed owners
│  ├─ planner-owned prerequisite DAG
│  └─ checkpoint obligations
└─ room-exit conformance
```

The room session owns the active occurrence, creates and closes exactly one
Timeline session, and coordinates its exit with conformance. The Timeline
session owns only occurrence-local readiness, binding, completion, and
obligation bookkeeping. It does not own route advancement, current-room
selection, Overview realization, Doors, feature construction, native effect
semantics, or retained state after room exit.

The implementation target is a bounded family beneath `src/mods/room/`:

```text
room/
├─ session.lua
├─ coordinator.lua
└─ timeline/
   ├─ session.lua
   ├─ bindings.lua
   └─ lifecycle.lua
```

`room/session.lua` becomes the real room envelope rather than a disguised
Timeline implementation. `timeline/session.lua` owns graph readiness,
session-attested handles, exact native identity bindings, completion, and
obligations. `timeline/bindings.lua` owns the private index that resolves
published contact facts to their transaction rows; it does not own a second
native-binding policy. `timeline/lifecycle.lua` maps the decoded closed
lifecycle-window union to internal capabilities and checkpoint behavior. It
must not infer game semantics from transaction kinds.

Gate B.2 must remove the superseded generic Timeline state from
`runtime_session.lua`, the generic binding half of
`native_timeline_adapters.lua`, and any duplicate room-local ordering logic.
Outcome-specific contacts may remain temporarily in their current files until
their owning later gate replaces them; this gate must not move code merely to
produce the target tree.

#### Supported Timeline interface

The room coordinator owns one occurrence-scoped Timeline port. Graph storage,
binding indexes, decoded transaction rows, and owner lookup remain private to
that port; native hooks must not request an index namespace or inspect an
indexed row. The port exposes one small semantic-free interface:

- `prepare(occurrence)` builds exact native-binding context early enough for
  selected-room inventory such as a World Shop to be generated before formal
  room entry;
- `enter(prepared)` promotes that exact prepared occurrence into the active
  room session without reconstructing or broadening its bindings or handles;
- `resolve(contact)` resolves one published contact descriptor to a
  session-attested opaque transaction handle;
- `bind(handle, nativeObject)` associates an exact native identity with that
  handle, while `bound(nativeObject)` recovers only that bound handle;
- `begin(handle)` succeeds only when the handle belongs to this active
  occurrence, its lifecycle capability is open, and every declared
  prerequisite owner is complete; on success it returns the declared
  transaction payload needed by the owning actuator; when that semantic owner
  is already complete it returns a non-enforcing completed disposition rather
  than exposing the payload or reporting a mismatch;
- `complete(handle)` records the handle's semantic owner complete only after
  the owning adapter reaches its exact accepted native terminal contact, then
  retires every handle for that owner from further enforcement;
- `checkpoint(name)` checks only obligations whose published deadline is that
  checkpoint; and
- `close()` checks the final room-exit obligations and then discards all local
  handles, native bindings, capabilities, and completed-owner state before the
  route advances.

A contact descriptor identifies a published carrier fact such as an offer,
generation, phase, automatic effect, role, produced child, or materialized
role. The binding layer owns how those fields are indexed and correlated.
Protocol v16 publishes the Fountain carrier explicitly as the required
`interactionKey: "fountain"` field on `fountainUse`; Gate B.2 must not recover
that contact by scanning transaction kinds. v16 strictly replaces v15 with no
compatibility decoder.
Hooks may construct the descriptor from their native contact, but they do not
construct composite index keys, choose index namespaces, recover decoded rows,
or read `.node` fields. Handles are valid only for the port that issued them;
cross-room, stale, or fabricated handles fail through the first-mismatch
policy. An unbound incidental native object remains native pass-through and
does not acquire a transaction by item name, authored order, hook order, or
"next action" fallback.

The four current obligation checkpoints are `roomEntered`,
`outgoingGeneration`, `exitUsable`, and `roomExit`. Gate B.2 must exercise all
four, including the currently underused `roomEntered` checkpoint. A lifecycle
window is not a checkpoint: it controls when an owner may begin, while an
obligation controls the deadline by which a required owner must complete.

Every later Gate C-through-F adapter follows the same boundary:

```text
resolve one published contact to a transaction handle
→ bind that handle to its exact native carrier
→ recover the handle from that carrier at the interaction seam
→ begin the handle before planner-directed mutation and read its payload
→ let the exact accepted native terminal return
→ complete that same handle
```

If binding, readiness, realization, or structural terminal admission fails,
the existing first-mismatch policy disables further planner enforcement. The
native game callback must still run and player input must not be blocked or
returned from prematurely. Modeled semantic state is checked separately at
room exit under D2.5.

#### Ordering, participation, and identity invariants

- Transaction array order has no runtime meaning. Reversing it must not alter
  readiness or completion.
- The sparse prerequisite edge is the only action-order primitive. If the plan
  publishes `X -> Y` and leaves `Z` independent, `X,Y,Z`, `X,Z,Y`, and `Z,X,Y`
  are legal; beginning `Y` before `X` is not.
- The runtime does not topologically sort, schedule, search, replay, or advance
  an action cursor. `begin(owner)` only checks that owner's declared
  prerequisites against the completed-owner set.
- Publication intent and dependency remain explicit Planner Timeline facts,
  and the publication boundary emits only intended transactions. Every
  emitted transaction receives exactly one obligation from its declared
  lifecycle window; an optional untaken action is omitted before this wire
  product exists. A dependency never promotes an unchosen competitor or
  invents a transaction.
- An obligation blocks only its declared checkpoint. It does not manufacture
  an ordering edge or make an earlier checkpoint fail.
- One semantic transaction may use several native subcontacts, but those
  subcontacts do not become independent owners. Each subcontact may receive a
  distinct handle carrying the same semantic owner, and the owning adapter may
  retain a bounded modal/subcontact scope between native callbacks. The owner
  completes only at its declared native terminal contact. A preferred result
  completes that owner only through its exact declared result.
- One exact handle may bind to one native carrier. Rebinding the same
  handle/carrier pair is idempotent; binding that handle to another carrier or
  binding one carrier to a different handle is a mismatch. Distinct declared
  subcontacts receive distinct handles even when they share one semantic
  owner, while resolving the same exact declared subcontact again returns the
  same handle.
- Repeated callbacks recover the already-bound handle. After its owner
  completes, `begin` yields the completed disposition and the native callback
  continues without planner enforcement. It is not treated as another action,
  a mismatch, or an opportunity to apply the outcome twice.
- Multi-hook carriers such as Mystery Boon purchase then acquisition, or
  Concave Stone's primary and residual screens, reuse their published owner or
  planner-declared dependent owners exactly as encoded. The Timeline port does
  not infer where one semantic transaction should split or terminate, and it
  does not model callback progression as another cursor. The owning adapter
  identifies one authoritative binding point, begins at the native action
  entry, retains its handle through a bounded native sequence, and requests
  completion only after its exact terminal contact returns.
- Dependencies are strictly occurrence-local. Decode continues to reject
  cross-occurrence edges, and completed owners never survive `close()`.
- Pending effects, clocks, charges, Shrine deliveries, and other later-room
  consequences remain retained game state proved by room-exit conformance and
  a future room's local transaction. They are not cross-room action edges.

#### Lifecycle capabilities and later-biome pressure

The runtime must represent open lifecycle capabilities rather than one scalar
phase cursor. Capabilities may overlap when the game permits it: for example,
an `afterCombat` action remains legal after `postOutgoing` becomes available.
Phase-keyed contacts such as `encounterEnd:<phaseKey>` and
`bossDefeated:<phaseKey>` are transient and close after their native seam.

Gate B.2 uses only the lifecycle variants already present in the closed
execution product. It does not publish speculative H or O values. Its internal
capability model must nevertheless admit the following later extensions
without changing graph, binding, completion, optionality, or close semantics:

- one H room session spans all Fields cages; each cage is an exact phase-owned
  barrier, phase-produced required work depends on that owner, optional
  room-wide work may occur in legal gaps, and the executor never derives cage
  order independently of the planner;
- one O room session spans both wheels; each wheel owns its choice, encounter,
  post-combat work, and next-phase deadline, while independent same-phase work
  remains unordered; and
- entering a later phase closes only capabilities that cannot legally survive
  that transition rather than globally incrementing a room action cursor.

When H and O are implemented, their owning gates may add concrete
phase-qualified lifecycle windows and `nextPhaseUsable` obligations to the
closed execution product. They must not replace or fork this Timeline runtime.

#### Primary witnesses

- one dependency `X -> Y` plus independent `Z`, covering every legal
  permutation above and rejecting only `Y` before `X`;
- transaction-array reversal with identical behavior;
- an untouched optional owner omitted before publication, paired with an
  authored optional owner that publishes one obligated transaction;
- one required owner that blocks only at each of the four declared checkpoint
  kinds;
- a prepared selected-room Shop binding promoted intact on room entry, plus an
  unselected or different occurrence that cannot inherit that preparation;
- exact native identity refusing silent rebinding to another owner while
  allowing the documented subcontacts of one owner;
- a session-attested handle refusing use against another occurrence, and a
  hook receiving its payload only through `begin(handle)` rather than through
  a raw indexed transaction row;
- one exact handle refusing a second native carrier while accepting an
  idempotent repeat of the original binding;
- an owner completing once, retiring all of its handles, and returning a
  non-enforcing completed disposition on a later callback without mismatching;
- one multi-hook transaction retaining the same semantic owner until its
  terminal contact, without introducing callback-order matching;
- overlapping `afterCombat` and `postOutgoing` capabilities;
- one current phase-keyed transient contact using
  `encounterEnd:<phaseKey>` or `bossDefeated:<phaseKey>`;
- room close clearing bindings, completed owners, and lifecycle capabilities;
- a readiness or structural-contact mismatch disabling enforcement while the
  wrapped native callback still completes; and
- one representative decode/graph witness retaining the existing rejection of
  cross-occurrence prerequisites.

Tests in this gate prove the skeleton and its boundaries, not every action
family. Planner tests already own the complete dependency and obligation
matrices; executor tests retain representative wire and runtime witnesses
without reproducing planner policy. Gates C through F own exact carrier and
outcome contact tests through this interface.

#### Exclusions

- no H or O native realization and no speculative H/O execution-schema member;
- no acquisition, trait, Chaos, keepsake, Hex, Shop, Well, Pool, Shrine,
  fountain, or automatic-outcome closure assigned to Gates C through F;
- no global action cursor, scheduler, permutation engine, event bus, semantic
  action registry, service locator, or cross-room dependency;
- no public raw binding-index lookup, composite-key construction in hooks,
  decoded transaction-row exposure, or direct `.node` access outside the
  Timeline port and outcome adapters;
- no transaction-kind inference, planner simulation, or runtime reconstruction
  of dependencies and obligations; and
- no Timeline-owned table of native callback sequences, callback counter, or
  per-action termination policy; those bounded native facts belong to the
  owning action adapter;
- no broad hook reorganization unless this gate's Timeline skeleton directly
  supersedes and deletes the old path in the same change.

Intended commits:

- Run Planner: this locked plan amendment only; no production change unless a
  concrete missing execution product is demonstrated.
- Plan Executor: `refactor(executor): establish room timeline skeleton`
- Modpack shell: pin the completed executor commit.

### Native intervention policy for Gates C through F

Simulation completeness does not imply executor ownership. The planner engine
must model every consequence that changes later eligibility or Run State, but
the executor remains a thin steering layer over the native game. Each later
effect receives one implementation disposition during its owning gate:

| Disposition          | Executor responsibility                                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native-authoritative | Let the complete native callback chain run. Publish no extra actuator merely because the simulator models the result.                                    |
| Observe at exit      | Let native code run and compare only the planner-owned sparse modeled-state projection at the room-exit checkpoint.                                      |
| Native-steered       | Replace the smallest authored RNG, eligibility, ordering, source, or target decision and let native code apply all resulting mutations and side effects. |
| Executor-realized    | Directly create or replace state only when no bounded native steering seam exists and the gate explicitly justifies the exception.                       |

These are planning classifications, not a required production enum or runtime
registry. The default is native-authoritative. Observation does not authorize
mutation. Native-steered adapters must call the original callback chain and
must not copy the surrounding game algorithm. A desync disables later planner
enforcement but never blocks player input or prevents the native callback from
continuing.

For example, Proper Upbringing remains fully modeled by the simulator but its
deterministic native activation is not reimplemented. Ransoms likewise leave
trait removal and level application to `SacrificeAllBoon`; the executor does
not perform or reconstruct those mutations. Steady Growth keeps its native
encounter clock and rarity application; the executor steers only the authored
target when that clock fires.

Every Gate C-through-F carrier audit records:

- the complete native callback chain and stable terminal point;
- which part is deterministic native behavior and which part is volatile;
- what the planner simulates so later planning remains correct;
- the smallest value, target, or branch the executor must steer, if any;
- the exact native terminal contact that records the intended action as done;
- which existing bounded conformance fact, if any, observes its result; and
- why any executor-realized exception cannot use a bounded native seam.

If the native sequence has no bounded terminal contact, or exact realization
would require copying a full block of game logic, the gate stops for
adjudication. It must not push that complexity into the generic Timeline
runtime.

### Gate C — Cascading acquisition carriers

User-visible outcome: ordinary loot, level outcomes, NPC rewards,
transformations, and direct consumables reach the same occurrence-local
Timeline through small independently reviewable adapters. Gate C is five
ordered delivery gates, not one atomic acquisition rewrite.

Each slice first records its carrier's binding point, entry callback,
intermediate callbacks, exact terminal contact or finite alternatives,
cancel/retry behavior, and owner split. Implementation then moves only that
closed family beneath `room/timeline/`; it deletes the displaced branch from
the broad legacy hook in the same commit and does not add forwarding layers or
empty future directories.

#### C1 — Ordinary Boon and Hammer acquisition

- create `room/timeline/traits/` around the native loot-to-offer-to-selection
  sequence used by ordinary Olympian/Hermes Boons and Hammers;
- resolve the published transaction at its owning producer contact, bind the
  exact returned native loot to its materialized role, and begin only when a
  valid interaction reaches `HandleLootPickup`. Button and selection callbacks
  recover the same handle through that loot; there is no second screen binding;
- reuse native option tables as carriers while installing the exact authored
  membership and base values; let native slot sorting run, then correlate
  selected and rejected rows by identity rather than assuming authored row
  index remains the physical button index;
- extend the execution trait offer only with the missing base-rarity fact.
  Install that initial rarity once, do not observe or replay Rarify button
  presses, and let native Calling Card/provider-keepsake behavior consume its
  own source. The existing effective rarity and `beforeRoomExit`
  `keepsakeEffects` conformance verifies the aggregate charge ledger;
- let the native selection callback equip or stack the published selected
  trait and complete when that exact selected-row callback returns. C1 consumes
  the planner's indivisible final
  `effectiveLevel`, including any already-folded Jeweled Pom, Aspect of
  Persephone, or Premium Service contribution by supplying that final native
  row input. It does not inspect or recompute those sources;
- treat a failed `UseLoot` attempt as no begin, never reinstall the initial
  authored offer after a native reroll, and treat Concave Stone's recursive
  `DoubleBoonChance` selection as a deferred residual rather than the primary
  terminal; and
- leave every selected trait's later special effect unclaimed. Successful outer
  acquisition does not imply that Natural Selection, Sea Star, a Ransom, or
  another consequential trait has been implemented.

Primary witnesses are one ordinary Olympian Boon, one Hermes Boon, one Hammer,
one replacement offer, one Rejected-curse disabled option, one Calling Card
and one provider-keepsake rarification outcome, one non-default effective-level
row, and the no-begin/reroll/Concave alternative paths. Rarification witnesses
prove the initial base rarity and room-exit charge ledger without observing
individual button presses; the exact selected-row terminal owns the result. The whole-offer
`fallbackGold` branch reuses the screen but completes from its native
hidden-trait selection; its optional currency is native pass-through. This
slice excludes Chaos, Spell, NPC, Pom, Mystery Boon, generated-child, purchase,
and direct-consumable carriers.

#### C2 — Level outcomes

- establish `room/timeline/acquisitions/` now that ordinary traits and level
  outcomes are two concrete consumers. Move C1's complete ordinary-trait
  vertical slice beneath that action family without changing its contract;
  share exact producer/materialized-object correlation, not a native callback
  or global pending action;
- close the native Pom offer and selected-target sequence for ordinary Poms
  without manually changing trait stacks;
- close the separate direct random-level sequence through source-eligible
  room-reward Nectar. Transport the exact bound handle through the native
  consumable, begin only when `UseStoreRewardRandomStack` is reached after
  `UseConsumableItem` guards, and complete at the non-threaded
  `AddStackToTraits` terminal. This same carrier will accept Pom Slices after a
  later NPC, Shop, or generated-consumable gate binds one, but C2 does not own
  or test those producer and purchase paths;
- keep the level adapter producer-neutral. Later NPC, Shop, Shrine, replay, and
  transformation gates own materializing and binding their objects, then hand
  a bound level-bearing object to this already-closed carrier;
- steer the offered targets and authored selected target, then let native code
  apply the level count. Treat published `levelCount` as the final delta,
  accounting for native `FatedPomLevelBonus` adjustment exactly once, and
  complete when the exact target/count terminal returns. D2.5 normalizes and
  verifies the resulting level at room exit. A legal null Nectar target
  requires native confirmation that no eligible target exists; otherwise it
  is a mismatch and native behavior continues;
- leave ordinary-offer effective-level composition in C1. Aspect of Persephone
  and Premium Service have no separate executor adapter because the planner has
  already folded them into that one published final value.

Primary witnesses are an ordinary Pom, a rejected `UseLoot` attempt that does
not begin it, source-eligible room-reward Nectar with a target,
source-eligible room-reward Nectar with no legal target, a rejected
`UseConsumableItem` attempt that does not begin, and an unrelated native
direct-level call with no bound role. No Pom Slice producer, purchase, or
optional-participation witness belongs to C2. Planner-owned tests retain the
Persephone/Premium Service composition matrix; the executor needs only a
representative C1 non-default effective-level witness. Natural Selection
follows as the separate D4 consequence slice after this carrier is committed.

This slice uses the existing `ExecutionLevelResolution`; it adds no planner
wire or project-schema field. Its executor commit removes `pendingLevel`, the
visible/direct level branches, and their generic adapter helpers from the
legacy root hook, and relocates the complete C1 ordinary-trait slice beneath
`room/timeline/acquisitions/` without a forwarding layer. Unrelated NPC,
transformation, Chaos, and direct-pickup branches remain for their own gates.

#### C2.5 — Direct pickup acquisitions

- close the producer-neutral consumer for a bound acquisition whose native
  result is one directly used pickup rather than a choice screen or generated
  child. The immediate room-reward scope includes Max Health, Max Magick,
  Gold, healing, Armor, ordinary Nectar without a level resolution, elemental
  pickups, Red Onion, and meta-resource pickups;
- bind the exact materialized object from its published acquisition role, wait
  until native interaction has passed its guards, let native code consume the
  object and apply its effect, and complete from the accepted native item
  identity. Do not reproduce health, Magick, Gold, element, Forfeit, resource,
  or history mutation in executor code;
- make the consumer independent of its producer. C3 may hand Narcissus direct
  rewards to it, while later Echo, Quick Buck, Buried Treasure, Sea Star,
  Shop, Well, Shrine, and transformation gates may reuse it once the
  planner-owned child action is ready. The consumer claims the compatible
  native object at accepted use; a producer does not assign physical-object
  identity to that child;
- classify by the published acquisition shape rather than a duplicated catalog
  inventory in Lua. Trait offers, level resolutions, Chaos, Spell/Hex,
  Talent Drop/Path of Stars screens, Mystery Boon, Chaos Anvil,
  generated-child production, purchases, and transformations remain with
  their specialized owners; and
- retire the legacy `pendingSimple`, `completeSimpleAcquisition`, and
  `verifySimple` path in the same executor commit, with no forwarding layer.

Primary witnesses are one ordinary run-progress consumable such as Max Health,
one resource pickup, one deterministic modeled element pickup, one rejected
`UseConsumableItem` attempt that does not begin, and one unbound native
consumable that passes through. A Talent Drop pass-through witness protects
the specialized `OpenTalentScreen` boundary owned by D7. The witnesses prove
the generic carrier boundary; they do not repeat the catalog's full reward
matrix. No generated producer, purchase, NPC choice, transformation,
duplication, or delayed-delivery behavior belongs to C2.5.

This slice uses the existing acquisition role and native `gameName`; it adds no
planner wire or project-schema field. Deterministic effects remain
native-authoritative even when the planner models their result for subsequent
simulation.

#### C3 — NPC acquisitions and Mystery Boon resolution

- use
  [NPC trait and generated-pickup execution](../audits/game-execution-contacts/NPC_TRAIT_AND_GENERATED_PICKUP_EXECUTION.md)
  as the locked native-contact authority for this slice;
- create a focused NPC acquisition adapter beneath
  `room/timeline/acquisitions/` for Arachne and Narcissus menu entry, native
  option preparation, selection, and exact terminal contact. Bind through the
  exact NPC source, install only the published three-row result at the
  menu-open seam, and let native button construction and trait equipment run;
- require Narcissus Life Savings to remain the exact published result. If its
  native predicate rejects it, report a mismatch without substituting another
  NPC choice or preventing the native interaction from continuing;
- let every selected trait run its native `AcquireFunctionName`. In particular,
  never call `GiveRandomConsumables`, copy its output loop, or synthesize a
  Narcissus/Arachne drop. Complete the NPC interaction when its exact selected
  native callback returns, independently of any later pickup;
- keep trait-to-generated-pickup provenance out of the execution wire. The
  room Timeline instead exposes one semantic-agnostic `claimReady` operation.
  At accepted interaction it filters compatible unfinished actions by the open
  lifecycle window, satisfied DAG prerequisites, action contact, and native
  game identity. If multiple independent actions are ready, it chooses
  deterministically from the published transaction order; it never treats the
  physical object as having a preassigned planner owner;
- correct `NarcissusPickup` so a Mystery Boon's box role occurs at its pickup
  point and its hidden-source role occurs at `afterUnwrap`, matching the
  already-declared Shrine and Contract carriers;
- add no synthetic source-to-child dependency: native object availability is
  the pickup boundary, while the NPC interaction independently proves the
  selected trait. Correct C2's direct-level and C2.5's direct-pickup entry
  seams so an unbound native object claims a compatible action only after
  accepted use; already-bound carriers, C1 ordinary loot, and C2 visible Poms
  remain unchanged. Native companion drops and unselected optional pickups
  remain pass-through;
- close each already-bound Mystery Box as one child acquisition with a box and
  hidden provider subcontact, regardless of its producer: begin only after
  accepted box use, force only `GiveLoot`'s published provider input, bind the
  exact returned provider loot, and hand its final offer and terminal contact
  to C1. Commerce owns purchase creation and binding; this slice does not claim an
  unbound shop purchase. Preserve the native `GiveLoot`-before-`BoughtFromShop`
  ordering; and
- delete the superseded Arachne, Narcissus, generated-child, and Mystery Boon
  branches and their global `pendingTrait` / unwrap state from the broad legacy
  hook in the same executor commit. Other NPCs and unrelated legacy families
  remain untouched for their owning gates;
- add later NPC functions only in their biome gate or a separately reviewed
  universal NPC extension, not speculatively in this F/G slice.

Primary witnesses are Arachne's trait menu; exact Narcissus Life Savings and
native-unavailable mismatch; separation
of selected-trait completion from asynchronous native drop creation; one Pom
Slice handoff to C2; one direct-pickup handoff to C2.5; native pass-through for
an unmodeled companion drop; two independent Mystery Boons that may be claimed
through either physical box without a wrong-object mismatch; and Narcissus
Mystery Boon through accepted box use, hidden-provider creation, and C1 final
trait selection. Planner tests own
the exhaustive Narcissus output matrix; executor tests retain only these
representative contacts. Mystery purchase and Hermes Shrine delivery remain
outside this slice.

#### C4 — Artificer reward transformation

- create `room/timeline/transformations/` for the published Artificer source
  disposition. Ordinary acquisition adapters accept only `normal` roles;
  Time Piece has no published disposition or executor adapter;
- bind or claim Artificer at the accepted native
  `ConvertMetaRewardPresentation` contact. Resolve its already-published child
  only to supply the scoped expected `ChooseRoomReward` result, then let native
  code consume the bag/use, spawn the replacement, transfer requiredness and
  duplication capability, and destroy the source. Complete only the source
  after the expected child exists and the source has been destroyed;
- exclude native Artificer's unique `IgnoreRoomSpawnOnLootPoint` spawn from
  ordinary incoming-reward binding. Do not publish that native flag or turn it
  into planner semantics;
- do not bind the generated physical object to its source-derived child owner.
  The planner dependency makes the child ready after source completion; the
  applicable ordinary trait, level, or direct-pickup adapter claims the child
  at accepted interaction according to its own published disposition. Extend
  C1 and C2 only as needed to support the same bound-or-ready
  normal-acquisition contract already established for C2.5 and C3; and
- force the underlying Artificer Boon/Hermes reward and let the native Forfeit
  path produce the published Onion. The executor neither spawns the Onion nor
  mutates the Vow latch. An Artificer child cannot recursively use Artificer.

At the planner-owned execution-publication boundary, omit every optional
untaken action and every Time Piece `conversionToGold` acquisition. Every
published transaction is intended and receives exactly one checkpoint
obligation; dependencies are filtered to published endpoints only. The
aggregate of remaining intended acquisitions and sparse room-exit
keepsake/Time Piece charge conformance proves the authored room outcome. It
does not claim exact destroyed-object identity. This keeps Time Piece out of
the execution union and avoids recreating native Goldify behavior.

If an Artificer-produced child was itself consumed by Time Piece, do not publish
a non-obligatory child transaction. Instead, the Artificer source role carries
the planner-resolved replacement game identity and reward steering payload
needed at the native materialization contact. An ordinary Artificer child
remains a separate intended transaction with its producer dependency. Planner
tests continue to own eligibility, bag, requiredness, charge, and producer
matrices. Executor tests own only Artificer contact admission, bounded closure,
disposition isolation, source-owned replacement steering, and carrier handoff.
Sea Star follows as the final D8 consequence slice after every eligible pickup
carrier is closed.

Gate C stops if any carrier lacks an exact bounded terminal contact or has an
unbounded callback sequence. Semantic post-state observation belongs at the
D2.5 room-exit checkpoint; the gate must not add a callback cursor, proof
thread, or carrier protocol to the generic Timeline runtime.

Each C1-through-C4 slice, including C2.5, has its own executor commit,
independent review, and modpack pin. Run Planner changes are allowed only for a
demonstrated missing carrier fact; no slice publishes executor convenience
state.

### Gate D — Universal consequential outcomes

User-visible outcome: every universal consequential outcome reachable in the
F/G execution extent either follows an explicitly native-authoritative path or
has the smallest exact planner result needed to steer its native contact. Gate
D does not implement later-route NPCs, commerce, or combat effects merely to
claim catalog-wide coverage.

Gate C is complete. Its transaction carriers remain the sole owners of native
admission, begin, and terminal completion. A consequence that occurs while one
trait is being acquired extends that already-bound transaction; it does not
create a second transaction, dependency, callback cursor, or source-to-object
identity. The C1 adapter may expose one bounded selected-acquisition scope to
its consequence modules while its native selection call is in flight. Those
modules may steer only their named nested callback. The outer adapter completes
at its native terminal contact; modeled inventory consequences are observed at
room exit rather than returned through the callback stack.

All exact consequence data is published on the offer option or acquisition role
that owns it. Option-local data is published for every authored option, not only
the primary selected option, because Concave Stone can acquire one of the
residual options. Production does not gain a generic selected-disposition
language, effect registry, or copied trait simulator.

The automatic outcomes and loadout effects already closed by Gates A and B
remain closed. Gate D neither republishes them nor creates parallel contacts
merely because their underlying traits or keepsakes belong to this catalog
family.

The following native-authoritative classifications are locked before actuator
work begins:

| Family                     | Locked disposition                                                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proper Upbringing          | Native `CheckActivatedTraits` remains the sole implementation. The planner's rarity and trait histories model its deterministic activation; execution publishes no effect payload and installs no effect hook.      |
| Ransoms                    | Native `SacrificeAllBoon` removes and levels the exact traits present after the selected outer trait is added. Execution neither publishes a removal/level replay nor verifies a second owner.                      |
| Cherished Heirloom         | Native `AttemptAdvanceKeepsake` and `AdvanceKeepsake` remain authoritative. Existing `keepsakeEffects` conformance proves modeled retained-state changes where they occur; no separate Heirloom transaction exists. |
| Olympian keepsake pressure | Native equip owns pressure and charge setup. Each later authored offer already publishes its exact giver/base rarity, while room-exit keepsake conformance owns charge consumption.                                 |
| Simulation-neutral effects | Native pass-through after the selected trait or keepsake is proved. Health, Magick, Gold, damage, and combat arithmetic remain outside execution.                                                                   |
| Echo and Circe             | Deferred to their reachable biome gates. Existing dormant legacy contacts are not F/G closure evidence and are not broadened here.                                                                                  |

A deterministic native callback that later proves to disagree with the planner
is an under-modeling finding for adjudication. It is not permission to add a
second executor implementation. The diagnostic Run State remains available for
that investigation without becoming a blocking full-state comparator.

#### D1 — F/G encounter-altering keepsakes

Fig Leaf and Gorgon Amulet are already reachable in F/G and therefore cannot
be deferred with later-biome encounter work. Fig Leaf is a phase-local RNG
result that requires steering. Gorgon is deterministic native behavior whose
resulting Athena interaction requires binding and trait-offer steering, not
keepsake-effect steering.

This gate first completes the encounter ownership move that Gates B and B.2
deliberately left unfinished. The supported encounter stack moves beneath
`src/mods/room/timeline/encounters/` as one complete vertical slice:

- declaration-driven phase selection and native encounter binding;
- active-phase identity plus `encounterEnd` and `bossDefeated` lifecycle
  publication;
- encounter-interaction binding and handoff to the already-closed acquisition
  carriers;
- currently supported encounter-owned automatic outcomes;
- Nemesis random-event realization; and
- the new Fig Leaf phase-result and Gorgon interaction adapters.

The move deletes `room/encounters.lua`, `room/encounter_hooks.lua`, and the
displaced encounter, Nemesis, boss, and automatic branches from
`hooks_timeline.lua`. It must not leave forwarding modules or a second phase
lookup. The room coordinator consumes one narrow encounter interface; native
hooks outside this directory ask it for the active published phase or hand off
an already-bound encounter transaction rather than scanning
`overview.encounterPhases` themselves.

Phase identity and transaction identity remain separate:

- when native encounter selection or multi-encounter assembly creates an
  encounter object, bind that exact native object to its published phase. A
  later start, end, or interaction contact recovers the phase from native
  identity; it must not search for the first matching encounter name;
- do not index a transaction by bare `phaseKey` or require one transaction per
  phase. One phase may simultaneously own an encounter interaction, one or
  more effect-qualified automatic outcomes, and later H/O-specific actions;
- resolve each transaction through its complete published contact, such as an
  encounter interaction plus phase, an automatic effect plus phase, or a
  future cage/wheel identity. Several opaque handles may therefore share one
  phase without becoming interchangeable; and
- treat encounter start and end as lifecycle contacts that open or close the
  matching phase capability. They do not consume a generic phase handle or
  manufacture a transaction when the planner published no meaningful action.

This foundation must support repeated native encounter identities without
implementing H or O early. Their later gates may add concrete
`completeFieldsCage`, `chooseRewardWheel`, and `interactWheelReward` contacts,
but must not replace phase binding, Timeline readiness, or completion rules.

Acquisition semantics do not move merely because an encounter produced them.
Arachne and Narcissus menu-result steering remains in the acquisition family;
the encounter layer supplies their phase-owned transaction handle. Likewise,
the ordinary Athena trait screen remains owned by the trait acquisition
adapter after Gorgon has produced and bound the Athena interaction. Room
features, navigation, and conformance remain outside the encounter directory.

After that ownership move, the F/G encounter-keepsake behavior is added:

- extend each published encounter phase with an optional exact Fig Leaf
  skip/no-skip result. Absence means the effect is not pending at a
  structurally relevant phase; it must not be inferred from the room or
  encounter name in Lua;
- publish the negative Fig Leaf result while a pending effect reaches an
  eligible phase. Otherwise native RNG could realize a different positive
  outcome even though the plan contains no resulting skip;
- for Fig Leaf, scope the exact keepsake decision across both native paths:
  `HandleEncounterPreSpawns` and `HandleEnemySpawns`. Select the authored
  branch, but let the ordinary spawn handler remain the positive terminal after
  native use consumption and biome-latch mutation. Native code remains
  responsible for suppressing enemy spawns and preserving the room and reward;
- for Gorgon, do not steer the `AthenaEncounterKeepsake`
  `UniqueEncounterArgs` eligibility/dispatch, schedule `HandleAthenaSpawn`, or
  suppress either native start path. The game owns this deterministic keepsake
  effect when its Death Defiance and encounter conditions are met;
- when native Athena reaches `AthenaUse`, bind the existing `interactGorgon`
  transaction for that exact phase and hand its published trait offer to the
  already-closed ordinary trait screen. Do not create a second Gorgon,
  encounter, or trait transaction; and
- keep room-exit `keepsakeEffects` conformance as the retained-state proof for
  both effects. It verifies the Fig Leaf use/latch and Gorgon pending/consumed
  state without making either effect a generic Timeline obligation.

The planner engine retains the complete declaration-owned eligibility matrix.
F/G execution witnesses are one ordinary positive and negative Fig Leaf phase,
one source-supported skippable miniboss, one blocked phase, a natively produced
Gorgon Athena interaction, exact Athena rarity/selection handoff, no executor
intervention in an ineligible Gorgon phase, and the rule that a Fig Leaf-skipped
encounter cannot consume Gorgon. Opening, Devotion, boss, and miniboss behavior
is taken from the published phase result rather than reclassified by encounter
kind in executor tests. Encounter-foundation witnesses additionally bind two
native objects with the same encounter name to different phases, allow an
automatic and encounter interaction to hold distinct handles on one phase, and
prove that ending either native encounter opens only its bound phase
capability.

This is one delivery gate with two intentional commit boundaries so
behavior-preserving movement remains reviewable separately from the new wire
and runtime behavior:

1. Plan Executor: `refactor(executor): consolidate encounter timeline`
2. Run Planner: `feat(execution): publish Fig Leaf encounter outcomes`; Plan
   Executor: `feat(executor): realize F/G encounter keepsakes`; then pin the
   reviewed executor revision in the modpack shell.

The first commit must retain the existing encounter tests byte-for-byte in
meaning and delete every superseded path. The second owns only the new Fig Leaf
phase-result codec and steering, Gorgon interaction binding, and focused
witnesses above. D1 receives one independent review across both commits before
D2 begins.

#### D2 — Chaos offer extraction and closure

- retain the existing exact `ExecutionTraitOffer` Chaos payload; no planner wire
  or project schema changes are allowed;
- move the complete Chaos acquisition path from the broad legacy hook into the
  focused trait-acquisition neighborhood. Extend shared materialization to bind
  exact `TrialUpgrade` loot, begin only at accepted `HandleLootPickup`, and
  recover the same handle from that native loot throughout the screen;
- leave `SetTransformingTraitsOnLoot` entirely native and delete the executor
  hook on it. During only the initial `CreateBoonLootButtons` call, prepare all
  three rows on the first post-sort `CreateUpgradeChoiceButton` contact. Install
  the ordered authored curses and requirements, swap the authored selected
  blessing into its physical position when a generated peer already owns it,
  preserve the other native blessings, and apply the selected rarity;
- scope exact curse/blessing operand overrides only around the matching native
  row construction. The selected native trait is the processed curse and its
  pending blessing remains nested under `OnExpire.TraitData`;
- leave native rerolls native, leave Vow of Denial to ban the authored
  unselected curse identities from the constructed buttons, and do not treat
  Rejected as a blocked Chaos-screen option;
- let native code equip the curse, run its clock, and mature the blessing; and
- complete after the exact authored curse row's native selection callback
  returns. D2.5's room-exit `chaos` conformance verifies the selected curse,
  nested pending blessing, requirement, rarity, and operands. Delete every
  displaced Chaos branch and mutable pending state from the broad hook in the
  same executor commit.

Primary witnesses are exact materialization and accepted admission, rejected
`UseLoot` without admission, three visible curse alternatives, a repeated curse
identity, a selected blessing at each physical position, peer-blessing swap
without duplication, native Denial receiving curse identities, native reroll
pass-through, representative operand-bearing curse/blessing values including
both Revelation values, exact terminal contact, and room-exit conformance of
the equipped curse plus pending blessing. A native carrier with fewer than
three rows is a mismatch, not permission to fabricate unmodeled peer blessings.
Existing exhaustive operand tests remain the sole owner of the numeric
declaration matrix.

Intended commit: Plan Executor `refactor(executor): isolate Chaos acquisitions`.
Run Planner changes are excluded.

#### D2.5 — Exact authored intent and runtime-fallback retirement

D2.5 is locked against Run Planner `562463e9`, Plan Executor `e90d5aa`, and
modpack shell `6f40ceb4`. The shell already has the completed D2 executor
revision checked out but not yet pinned.

User-visible outcome: one authored result remains the only result throughout
simulation and execution. The game module steers that exact result and never
silently substitutes another trait or item that would create an unauthored
alternate chronology.

This is a foundational correction to the completed Timeline and acquisition
gates, not another trait effect. It must complete before D3:

```text
exact native contact is accepted
  -> transaction owner completes
  -> same-room DAG dependents may become ready

room exit
  -> every intended transaction obligation is complete
  -> existing specialized conformance facts are checked
  -> room session closes
```

The terminal contact remains exact. An ordinary offer completes only from the
published selected row, a level action only from its published target and
count, a purchase only from its bound slot, and an Artificer source only after
its expected child carrier exists. Wrong contacts, failed native admission,
missing structural children, invalid bindings, and unmet DAG prerequisites do
not complete an owner. These are structural action facts needed by the current
room; they are not post-callback inventory proofs.

After the original native terminal callback returns successfully, adapters do
not scan Hero traits, Arcana, retained effects, or another native state table
and do not thread a semantic proof back through the callback stack. The
occurrence-local Timeline records only that the intended native action
finished. Unresolved intended transactions remain independently visible to the
existing room-exit obligation checkpoint.

##### Exact-intent policy

- The authored trait or item identity is the only simulated and executable
  result. There is no preferred/fallback pair, substitute item, hidden Hades
  reserve, realized alias, or alternate tracked state.
- Volatile native predicates remain documented source facts but are not
  authored Planner inputs. The author is responsible for choosing a result
  compatible with the live run state that the Planner deliberately does not
  model.
- At the native contact, the adapter may ask whether the exact published result
  is currently available. If it is unavailable, missing from the native source
  pool, or rejected by the native function, the adapter reports one execution
  mismatch, leaves native player input operational, and does not complete the
  transaction.
- Later levels, rarity changes, removals, and other target-bearing actions keep
  the same single authored trait identity. No adapter searches for a substitute
  identity or receives an alternative target.
- Planner Run State remains diagnostic evidence. This gate does not publish or
  block on a generic trait/Arcana inventory projection. Existing specialized
  retained conformance required by concrete execution gates remains unchanged.
- Starting Experimental Hammer, Jeweled Pom, and Transcendent Embryo results are
  steered at their existing native contacts. Static weapon, aspect, Arcana,
  Fear, keepsake, and Hex checks remain owned by Gate A.2. Generated-result
  callbacks do not publish a second semantic proof channel.

This policy applies uniformly to ordinary and NPC trait offers, Jeweled Pom,
Task Force, Last Gasp, Death Defiance-adjacent results, Nemesis items, Shops,
Shrines, Wells, Twist, and Travel Deal refills. A source family may not retain
fallback substitution merely because its current downstream effects happen to
be sim-neutral.

##### Deliverables

- Change the Timeline port from `complete(handle, proof)` to
  `complete(handle)`. Completion still retires every handle for that semantic
  owner and preserves all prerequisite and obligation behavior.
- Keep exact contact admission and structural terminal checks in each owning
  adapter, but remove post-callback Hero/Arcana/effect-state verification and
  all `expected`/`observed` arguments used only by `transaction-outcome`.
- Remove every runtime-fallback declaration, normalized catalog field,
  simulator emission/product, execution-plan carrier, codec branch, compiler
  join, Lua decoder, availability-substitution helper, and fallback-specific
  fixture expectation.
- Remove every callback-to-checkpoint realization stamp and do not replace it
  with a tracked trait/Arcana state projection.
- Make exact native unavailability a mismatch at the owning contact without
  preventing the native base function from running.
- Retain specialized conformance readers and immediate structural mismatches.
  Delete obsolete adapter `verify` helpers and the generic
  `transaction-outcome` path when no remaining caller requires them.

##### Required witnesses

Catalog, Planner Engine, and codec tests own:

- volatile traits/items remain authorable as exact deterministic results where
  their existing Planner prerequisites permit them;
- selected offers, direct keepsake results, Shop/Well/Shrine/Nemesis outcomes,
  and Travel Deal refills contain only their exact authored identity;
- protocol v17 retains its existing generic strict unknown-field rejection; and
- real execution fixtures witness the current exact-result product without
  carrying a historical absence assertion.

Fallback-specific codec mutations, catalog-absence assertions, and repository
searches may be used once while implementing the removal, but they are deleted
before commit. Durable tests describe the current product and generic strict
codec policy rather than preserving retired fallback vocabulary indefinitely.

Plan Executor tests own:

- exact unavailable trait, NPC, item-generation, and purchase contacts report a
  mismatch, do not complete the owner, and still call the native base path;
- later level and removal adapters target only the exact published identity;
- consuming an exact transaction at its native terminal requires no semantic
  state-proof argument, while a wrong contact or skipped transaction remains
  unresolved;
- unresolved obligations remain distinct from specialized conformance
  mismatch; and
- no acquisition, level, NPC, Chaos, encounter, feature, transformation, or
  automatic adapter threads semantic outcome proof through `complete`.

The protocol advances from v16 to v17 with no compatibility decoder. Focused
audits for ordinary traits, levels, NPC acquisitions, transformations, Chaos,
automatic outcomes, and commerce must be corrected wherever they still assign
semantic post-state proof or runtime substitution to an adapter. Source facts
and native steering contacts remain unchanged. The runtime-offer fallback audit
must preserve its source facts while recording fallback substitution as a
retired Planner policy.

Exclusions:

- no full native trait or Arcana equality;
- no callback/action cursor, event log replay, untyped cross-domain state-diff
  language, or executor reconstruction of planner trait effects;
- no realized-trait alias map, callback realization stamp, fallback carrier,
  substitution search, or hidden reserve;
- no new steering behavior for All Together, Natural Selection, Concave Stone,
  automatic outcomes, commerce, or later biomes; and
- no removal of structural contact checks needed to bind a carrier, complete a
  producer before its child, or protect same-room DAG readiness.

Intended commits:

- Run Planner: `refactor(execution): retire runtime offer fallbacks`
- Plan Executor: `refactor(executor): enforce exact authored outcomes`
- Modpack shell: pin the completed executor commit.

#### D3-D8 shared nested-consequence contract

D3-D8 extend already-bounded acquisition transactions with consequences that
native game code performs inside the outer accepted action. They do not create
another transaction merely because the planner simulates their result.

- When an outer acquisition begins, its adapter may create an
  occurrence-local, ephemeral expectation for the exact nested native contacts
  published on that selected result. Each matching callback consumes only its
  own expectation. This is callback-sequence bookkeeping, not a semantic
  post-state proof or another Timeline cursor.
- The outer transaction may complete at its existing native terminal only
  after every required nested expectation has been consumed. A missing,
  rejected, or unavailable exact contact reports a mismatch and leaves the
  outer transaction incomplete. Native behavior and player input continue.
- If a native callback already receives an eligibility-filtered candidate
  collection, the adapter checks only for the exact published identity. If the
  hook necessarily sees a raw declaration pool before native filtering, it
  delegates availability to that row's native eligibility predicate before
  narrowing the pool. The executor does not own a parallel conditional-item or
  conditional-trait list.
- Room-exit obligations remain the terminal backstop for an incomplete outer
  action. Existing specialized conformance checks validate only the durable
  state they already own; they do not repeat contact availability or reconstruct
  the nested game algorithm.
- A separately materialized pickup remains its own acquisition transaction.
  Consuming a nested production contact neither completes that child nor binds
  a physical object to it at creation.

#### D3 — All Together exact direct grants

- extend each ordinary trait-offer option with an optional exact All Together
  result containing the four declaration-owned Earth, Fire, Air, and Water
  outcomes, including an explicit null for an exhausted pair;
- assemble that result directly from the reached selected-offer product and
  round-trip it through the strict TypeScript and Lua codecs without adding a
  new transaction kind;
- while C1's selected acquisition is in flight, scope only native `GrantBoons`,
  require each non-null authored identity to exist in its matching
  native-filtered pair, and steer that exact identity;
- let native `AddTraitToHero`, presentation, activation, element contribution,
  and God Sent reevaluation run normally; and
- consume all four nested set expectations, including explicit exhausted/null
  sets, before allowing the outer C1 transaction to complete at its existing
  native terminal. The executor does not reconstruct the resulting inventory
  as a second proof.

Primary witnesses are four selected grants, one forced remaining member, and
one exhausted/null set. Planner tests own eligibility and complete set
construction; executor tests own only scoped native substitution and result
handoff to room-exit conformance. D5 owns the later Concave-residual composition
witness.

Intended commits:

- Run Planner: `feat(execution): publish All Together grants`
- Plan Executor: `feat(executor): steer All Together grants`
- Modpack shell: pin the reviewed executor revision.

#### D4 — Natural Selection ordered distribution

- extend each ordinary trait-offer option with its exact ordered successful
  Natural Selection target sequence;
- do not encode that sequence as eight level transactions or reuse C2's Pom and
  direct-level adapter. `DistributeLevels` is one nested native consequence of
  the selected outer trait;
- derive the scoped native shuffle order from first target appearances, retain
  otherwise eligible native entries so native cap detection can condemn them,
  and let the original loop apply every level and remove capped targets;
- consume the exact authored successful-target sequence through the bounded
  native distribution callbacks before allowing the outer C1 transaction to
  complete. A missing target or an unexpected early end is a structural contact
  mismatch, not a later final-level comparison;
- stop for adjudication before implementation if a focused source/contact audit
  finds an authored legal sequence that cannot be represented by one initial
  native order plus native condemnation; and
- let native level application return to C1 without a nested proof or a second
  executor-owned trait-state reconstruction.

Primary witnesses are fewer than eight successful levels due to exhausted
targets, a complete eight-level distribution over several slots, and a target
that becomes capped and is removed between rounds. C2 utilities may be reused
for reading native levels, but C2 callback ownership and payload types remain
unchanged. D5 owns the later Concave-residual composition witness.

Intended commits:

- Run Planner: `feat(execution): publish Natural Selection targets`
- Plan Executor: `feat(executor): steer Natural Selection distribution`
- Modpack shell: pin the reviewed executor revision.

#### D5 — Concave Stone residual selection

- extend an ordinary trait offer with the exact `noProc` or selected residual
  option already frozen by the planner;
- keep the outer selection and native `DoubleBoonChance` recursive selection
  inside one C1 transaction. No residual transaction or DAG edge is published;
- force only the scoped proc/no-proc roll and, on success, the authored residual
  button identity. Native code consumes the keepsake use and recursively applies
  the second trait;
- retain the outer C1 selected-acquisition scope through that recursive call so
  the D3 or D4 nested consequence for the residual option can run when needed;
  and
- consume the expected roll and, for a proc, exact residual-selection contacts
  before C1 can complete after the bounded recursive native selection returns.
  Existing `keepsakeEffects` room-exit conformance remains the authority for the
  Stone charge/status ledger; no fallback or aggregate trait-state proof is
  added.

Primary witnesses are Epic Stone no-proc, Epic Stone proc, Cherished Heirloom's
forced rank-IV proc, a residual ordinary trait, and one residual option carrying
an already-supported D3 or D4 consequence. Planner tests retain the complete
proc legality matrix.

Intended commits:

- Run Planner: `feat(execution): publish Concave Stone outcomes`
- Plan Executor: `feat(executor): steer Concave Stone residuals`
- Modpack shell: pin the reviewed executor revision.

#### D6 — Fixed native pickup producers

Quick Buck and Buried Treasure use native `GiveRandomConsumables` with fixed
declared output identities. Their production has no planner-selected RNG result.
Execution therefore does not hook production, bind objects at creation, or
publish trait-to-object provenance. The selected outer trait completes through
C1 independently of its delayed native drops.

The planner-owned dependency makes each authored pickup action ready after the
source trait. At accepted use, C2.5 claims a compatible ready action by native
identity and lets the game apply the pickup. Identical generated objects are
interchangeable; their physical creation order does not assign planner
ownership. Optional pickups not authored as taken remain unpublished and native
pass-through.

Primary witnesses are Quick Buck followed by its authored `RoomMoneyDrop`,
Buried Treasure with two same-identity objects satisfying ready actions in
either order, and an unselected generated pickup that creates no obligation.
If existing C1/C2.5 tests already prove a row, this gate cites that owner rather
than duplicating it. This slice adds no generic producer adapter and no empty
production module.

Intended disposition: audit/test closure only unless a concrete failure in the
existing action-time claim is demonstrated. Do not create an empty executor
commit or modpack pin merely to record a no-code result.

#### D7 — Spell, Hex tree, Path, and Moon Beam

This gate is two independently reviewed implementation passes because Spell
selection and Path investment have different native carriers.

##### D7.1 — Spell selection and Hex tree

- publish the selected Spell offer's complete layout, Rare identities, Epic
  identities, and currently reached God Sent extension with the existing offer;
- keep Spell as its own acquisition adapter rather than pretending its native
  screen is an ordinary C1 Boon screen;
- move the native Hex tree realization primitive out of the loadout-only
  neighborhood into one Hex-owned module used by both Aspect of Selene at run
  start and an ordinary Spell acquisition;
- steer the ordered three-spell offer and selected position, then let native
  spell installation, positional point bonus, and tree mutation run; and
- consume the expected Spell-selection and Hex-construction contacts, then
  complete at the Spell acquisition's existing native terminal without reading
  the installed Spell or tree as a callback proof. Room-exit `pathOfStars`
  conformance owns the durable projected Hex state. Aspect of Selene's routed
  `SpellDrop` continues directly to the Path carrier and does not construct a
  spell offer.

Primary witnesses are all three positional bonuses, a non-default layout and
Rare/Epic set, initial God Sent present/absent, and reuse of the same tree
primitive by the already-covered Aspect of Selene start path.

##### D7.2 — Path acquisition and retained Hex state

- add one specialized accepted-use carrier for `MinorTalentDrop`, `TalentDrop`,
  `TalentBigDrop`, and Aspect of Selene's routed `SpellDrop`;
- let native `OpenTalentScreen` own point addition, implicit first investment,
  player node choices, bank spending, and full-tree closure. The planner does
  not author graph position or individual acquired nodes;
- complete the acquisition only after the bounded native Talent screen returns;
  room-exit `pathOfStars` conformance proves the resulting spell, layout, talent
  identities, banked points, invested points, and closure state;
- change conformance activation to compare that complete projected Hex state,
  not only banked points and the closure flag. This is required for zero-bonus
  Spell selection, invested-only changes, and late God Sent insertion; and
- leave Moon Beam's equip, Cherished increment, exact reward priority, and point
  addition native-authoritative. Existing keepsake, reward-priority, and full
  Hex conformance prove the modeled deltas; no Moon Beam actuator is added.

Primary witnesses are one-, three-, and five-point Path pickups, an Aspect of
Selene routed Spell pickup, capacity-limited investment with a retained bank,
tree closure, late God Sent insertion, and Moon Beam ordinary/Cherished point
changes. Combat effects of individual talents remain unmodeled.

Intended commits:

- Run Planner: one D7.1 execution-product commit and one D7.2 conformance commit;
- Plan Executor: one D7.1 Spell/Hex commit and one D7.2 Path commit;
- Modpack shell: pin each reviewed executor revision.

#### D8 — Sea Star across closed pickup carriers

Sea Star closes last because Talent pickups and Quick Buck/Buried Treasure
children are eligible sources. Closing only the earlier C1/C2/C2.5 carriers
would leave the trait partially implemented again.

- publish an explicit `proc` or `noProc` result on each eligible source
  acquisition role. The existing positive duplicate child remains a separate
  intended transaction whose planner dependency makes it ready after the source;
- omit the field for ineligible sources and purchases. Shops cannot proc Sea
  Star, including purchased Poms;
- let each closed acquisition carrier expose only its bounded accepted native
  interaction to a Sea Star collaborator. Force the native chance branch while
  that source role is active, require that exact chance contact to be consumed
  before the source transaction completes, and let native code retain the
  consumable or create the fresh loot object;
- do not bind the physical duplicate to its planner child at creation. After the
  source completes, its ordinary C1, C2, C2.5, or D7 carrier claims a compatible
  ready action when the duplicate is actually used;
- support the consumable branch reusing the same native object by allowing a
  completed source binding to yield to a newly ready compatible action; and
- never arm a result for the produced duplicate. Native `CanDuplicate = false`
  and the absence of another authored Sea Star result jointly prevent recursion.

The source's proc/no-proc expectation remains required even when a positive
duplicate is intentionally left unpicked and therefore has no published child
transaction. The consumed chance contact proves only that native production was
steered; it does not prove or complete a later acquisition.

Primary witnesses are positive and negative direct-consumable outcomes, a fresh
Pom duplicate, a Talent duplicate, a Quick Buck or Buried Treasure generated
source, an Artificer-produced duplicable source, purchased-Pom exclusion, same-
object rebinding after source completion, and non-recursion. The two native
duplicate shapes own the complete executor matrix; tests do not repeat every
reward declaration.

Intended commits:

- Run Planner: `feat(execution): publish Sea Star outcomes`
- Plan Executor: `feat(executor): steer Sea Star duplication`
- Modpack shell: pin the reviewed executor revision.

#### Gate D closure

After D8:

- update the durable execution-contact audits to mark C1-C4 and D1-D8 truthfully
  covered, native-authoritative, or deferred;
- keep one test-owned exhaustive classification of every normalized
  `TraitSelectedDisposition` and modeled keepsake-effect family without adding a
  production registry;
- remove superseded Chaos, Sea Star, and generic trait consequence branches from
  the broad legacy hook while leaving explicitly deferred later-route contacts
  labeled as such; and
- run one bounded Gate D verification pass. The complete repository gate remains
  reserved for the final phase closure.

Each code-producing D slice uses a fresh executor, an independent reviewer, and
one bounded remediation pass. A slice stops for adjudication if its native
callback cannot be scoped to the selected C1/acquisition handle, if its result
requires a new cross-room dependency, or if faithful steering would copy the
surrounding game algorithm.

### Gate E — Universal commerce closure

User-visible outcome: every already-modeled World Shop, Anvil of Fates, Pool
of Purging, Stygian Well, and Shrine of Hermes has one bounded execution
disposition. The executor forces exact visible inventory and genuinely
volatile authored outcomes while native code continues to own payment, item
application, trait removal, retained-effect clocks, and generated-object
creation. Enabling a later route may add its room/navigation contact, but it
must not reopen these commerce semantics.

Gate E is five ordered delivery gates, not one Shop-like rewrite. Inventory is
Overview-owned feature state. World Shop and Well purchases retain their exact
published Timeline owners; Pool sales and Shrine purchases follow the explicit
publication exceptions below. Unpurchased offers remain visible inventory
rather than empty obligations. Every acquired or generated object reuses C1,
C2, C2.5, C3, D7, or another already-closed acquisition adapter according to
its published shape.

Travel Deal is one planner-owned retained effect shared by World Shops,
Stygian Wells, and Shrines. The validated plan supplies the exact replacement
or refill plus any required local dependency. Each carrier realizes that exact
item at its own native refill contact; Lua never recomputes “first purchase,”
candidate eligibility, or competing-item policy. Gold Gold Gold needs no
commerce actuator: native purchase code consumes the trait and creates its
free object, after which the ordinary acquisition path owns the object.

#### E1 — Anvil of Fates planner correction

- correct `ChaosWeaponUpgrade` from an effectless consumable into one atomic
  Hammer transformation and correct its declaration-owned `CanDuplicate` fact
  to `false`;
- model that transformation as the concrete acquisition's declared pickup
  effect. Because the supported item exists only in World Shops, its exact
  unresolved/resolved outcome remains on that authored Shop offer and reaches
  generic acquisition settlement through the Shop purchase source; unrelated
  incoming, local, Fields, and wheel reward carriers must not gain speculative
  effect-result plumbing. Shop generation and the reward kernel must not gain
  Anvil-specific policy;
- when an authored Anvil offer is purchased, expose one atomic Shop-row editor
  for that reward-owned effect: the removed Hammer and two added Hammers. Reuse
  the existing contextual Hammer picker language, while the engine supplies all
  eligibility, distinctness, and pre-transformation exclusion domains;
- publish the exact removable Hammer and two exact distinct added Hammers from
  the validated planner state. The removed Hammer is nullable only when the
  native history requirement permits the Anvil but no current non-temporary
  Hammer is removable;
- preserve the native candidate rule: a temporary Hammer cannot be removed,
  and neither the removed Hammer nor any Hammer present before the
  transformation may be re-added. Candidate legality is evaluated in native
  order: remove the selected Hammer, add the first result, then assess the
  second result against that updated trait frontier; and
- apply the authored removal and additions to canonical simulation so every
  later offer, Hammer history query, and room-exit trait delta sees the truthful
  post-Anvil inventory.

Primary witnesses are one permanent-Hammer removal plus two distinct additions,
a temporary Hammer excluded from removal and re-addition, candidate changes
after editing an earlier Hammer, and later simulation reading the exact
post-Anvil inventory. E1 is a complete Catalog / Planner Engine / application
correction; it does not publish an unused execution field or add a provisional
Lua hook.

#### E2 — All three World Shop profiles and purchase handoff

- steer the complete authored inventory for `WorldShop`, `I_WorldShop`, and
  `Q_WorldShop` at native generation, including offers the player does not
  purchase;
- consume the engine-published slot list without reproducing profile
  cardinality, group membership, I/Q run-half predicates, distinctness,
  weights, or eligibility rules in Lua;
- keep feature presence, inventory generation, purchase intent, payment, and
  later acquisition as separate facts;
- bind an authored paid purchase to its exact native slot/button only after the
  native admission guard accepts it, let native code pay and grant the item,
  then hand Boons, levels, direct pickups, Mystery Boons, Hammers, Spells, and
  Path items to their existing acquisition adapters;
- leave a rejected purchase retryable; an accepted purchase with no exact
  published purchase owner remains a player divergence but must never block or
  suppress the native action;
- publish E1's exact Anvil result on its Shop purchase, steer only its removed
  and two added identities inside the scoped native `ChaosHammerUpgrade` call,
  and let native code perform the transformation. Ordinary room-exit trait
  conformance proves the final Hammer delta;
- realize the exact authored Travel Deal replacement at the World Shop's native
  refill contact from planner-published readiness, without deriving purchase
  order in the adapter;
- realize Infernal Contract's one supplemental free World Shop pedestal as
  feature inventory, not a paid `shopPurchase`; its object uses the ordinary
  acquisition path; and
- leave prices, Gold, and simulation-neutral purchase effects entirely native.

Primary witnesses are complete 3-, 5-, and 6-offer inventories; Q's two offers
from one group remain distinct without Lua understanding that group; one
purchased and one unpurchased offer; accepted and rejected purchase contacts;
trait and direct-pickup handoffs; one Travel Deal replacement; one Infernal
Contract free object that never enters paid-purchase handling; and exact scoped
Anvil steering that does not affect unrelated Hammer RNG. A wrong or unavailable
Anvil identity reports mismatch while preserving the native base path.
Planner-owned tests retain the exhaustive Shop pool and I/Q phase matrices.

#### E3 — Pool of Purging

- allow an uninteracted Pool to remain wholly native-generated;
- when interaction is authored, steer its complete declared sale menu without
  replacing the native menu or tracking which displayed row the player presses;
- let native sale code remove all stacks of the selected traits;
- omit authored Pool sales at the planner-to-executor publication boundary.
  `poolSale` is not an execution transaction because no result remains to
  steer; and
- verify the intended removals through the sparse room-exit trait delta while
  ignoring sale order, Gold proceeds, rerolls, and unmodeled trait inventory.

Primary witnesses are uninteracted Pool pass-through, exact interacted menu
realization, one and three native sales reaching the expected room-exit trait
delta, and a missing intended removal reporting mismatch without blocking the
native sale. A focused engine witness owns the `poolSale` publication omission;
the executor must not retain a dormant Pool-sale consumer.

#### E4 — Stygian Wells and their Travel Deal refill

- allow an uninteracted Well to remain wholly native-generated and avoid false
  Timeline obligations;
- steer an interacted three-slot inventory and bind each consequential
  purchased native item while letting native code pay, grant, stack, and expire
  every effect;
- retain the audited dispositions for neutral, Spark, Yarn, Hymn, Discount,
  Empty Slot, Extended, Twist, and Last Stand. Steer only the exact nested Twist
  identity or another genuinely volatile authored target; deterministic native
  effects receive no second actuator;
- realize the exact Travel Deal refill from planner-published prerequisites and
  barriers, then treat an authored refill purchase as its own later transaction;
  and
- prove retained Spark, Yarn, Hymn, Discount, Empty Slot, and Extended state at
  room exit through their existing conformance authority rather than inferred
  purchase effects.

Primary witnesses are interacted and uninteracted Wells; two same-contact
purchases bound by distinct payload; Travel Deal source, refill readiness,
competing-purchase barrier, and optional refill purchase; exact Twist and Last
Stand results plus native-unavailable mismatch; one neutral stacking item with
no extra actuator; and a test-owned classification for every normalized Well
effect.

#### E5 — Shrines of Hermes and their Travel Deal refill

- publish and steer every Shrine's complete three-offer `SurfaceShop`
  inventory, including unpurchased offers; for each authored purchase publish
  its exact native `RoomDelay` from 2 through 8 and rushed disposition, plus any
  authored Travel Deal refill and refill purchase;
- preserve the authored rushed versus delayed disposition only as the input
  needed to bind the expected native purchase/delivery result. Do not create an
  executor-owned purchase clock, delivery scheduler, countdown decrement,
  delivery-host lookup, or forced-completion algorithm;
- let native code purchase the item, create and advance the pending delivery,
  rush it, flush it at its native final boundary, and spawn the required object;
- when the object materializes, reuse the ordinary acquisition pipeline for
  Mystery Boon, Hermes, Spell, Talent, Pom, health, Magick, armor, Last Stand,
  or any other already-published result. The acquisition transaction is the
  only Timeline consumer for the delivered object; and
- realize only the exact authored Travel Deal refill at the Shrine's native
  refill contact. The adapter does not reinterpret why only the first rushed
  purchase can refill while an ordinary delayed purchase cannot.

Primary witnesses are a complete inventory with an unpurchased offer, one
delayed purchase carrying its exact native `RoomDelay`, one rushed same-room
pickup, one later native-spawned pickup reusing the ordinary acquisition path,
a delivered Mystery Boon reusing C3/C1, and a Travel Deal refill. The witnesses
prove configuration and handoff at native contacts; they must not reproduce
the planner's encounter-use chronology, forced-completion rules, or trait-order
legality matrix.

Each E1-through-E5 slice has its own coherent commit in the repositories it
changes and an independent review; a modpack pin is required only when the
executor changes. E1 is the named Planner-only correction; E3 includes the
focused Planner publication correction. Any additional Planner change must
demonstrate a missing exact inventory, outcome, dependency, or publication fact
rather than moving native commerce policy into the engine.

Execution protocol changes are made only in slices that alter the wire product:
E2 adds the exact Anvil transformation, E3 removes `poolSale`, and E5 adds the
Shrine inventory/purchase disposition. They receive strict protocol advances
with regenerated byte fixtures and no compatibility decoder. E1 advances the
authored project schema; migration preserves an existing Anvil offer and
purchase but leaves its formerly unknowable random transformation unresolved
for the user to author.

### Gate F — Residual proof and universal F/G closure

User-visible outcome: the already-implemented F/G execution surface is proved
at its weakest native contacts and closed as one exhaustive, maintainable
boundary. Gate F does not add another generic callback layer or reimplement
room actions that already have bounded adapters. It is two ordered delivery
gates.

The following work is already closed and is not Gate F implementation scope:

- fountain use and Aromatic Phial target steering;
- Keepsake Rack changes at `EquipKeepsake`, with empty open/close cycles
  remaining incidental;
- ordinary and Artificer Forfeit Onion acquisition;
- required and participating optional pickup settlement;
- Artificer source transformation and Time Piece publication omission; and
- the production adapters for Steady Growth, Transcendent Embryo, Judgment, and
  Crystal Figurine.

Existing primary witnesses for those paths remain authoritative. Gate F must
not duplicate them merely to make a coverage table look symmetrical.

#### F1 — Residual native-contact proof

F1 is an executor-owned proof pass. It adds no planner model, execution field,
protocol revision, or new runtime abstraction unless a focused witness exposes
a concrete missing fact.

- prove that an authored successful resource point reaches the native element
  grant while native gathering and trait application remain authoritative;
- prove exact Steady Growth target steering at its reached encounter-end
  contact;
- prove exact Transcendent Embryo blessing identity, rarity, and processed
  values at its reached maturity contact;
- prove exact ordered Judgment and Crystal Figurine Arcana outcomes at their
  native Boss contact;
- prove that a repeated or incidental callback cannot replay a completed
  automatic owner; and
- prove that an unavailable or mismatching automatic target records the first
  mismatch while returning through native behavior rather than blocking player
  input or fabricating completion.

The executor tests own callback scoping, exact target injection, transaction
completion, replay prevention, and native pass-through. Planner tests continue
to own the automatic trigger, target eligibility, ordering, rarity, and final
Run State. F1 may correct a demonstrated adapter defect, but it must not add a
second encounter clock, Embryo schedule, Arcana selection policy, resource
roll, or room-exit mutation algorithm.

Primary witnesses are one successful resource grant; one reached result for
each of the four automatic effects; one shared repeated-contact witness; and
one unavailable-target witness that preserves the native return. Reuse a
single focused harness where that reduces duplication without hiding the four
distinct automatic effects across their three native carrier families.

Intended commits:

- Plan Executor: `test(executor): prove residual automatic contacts`, including
  only bounded production corrections exposed by those witnesses; and
- modpack shell: pin the reviewed executor revision only when executor source
  or tests change.

#### F2 — Exhaustive F/G classification and closure

F2 owns the final cross-repository inventory, deletion, durable absorption, and
phase gate. It does not create a production capability registry.

- add one test-owned exhaustive disposition map for every authored
  `RoomActionReference`, published Timeline transaction kind, automatic effect,
  acquisition disposition, Overview field, Doors variant, and room-exit
  conformance fact;
- classify each entry as covered, native-authoritative, intentionally omitted,
  or deferred-route, and fail compilation when the owning TypeScript union
  gains an unclassified member;
- keep the exhaustive semantic map beside the planner execution authority.
  Executor tests retain representative strict-decoder and native-contact
  witnesses rather than copying the TypeScript matrix into a Lua registry;
- verify the eight active F/G conformance readers: `traitInventory`,
  `steadyGrowth`, `chaos`, `keepsakeEffects`, `rewardPriorities`, `pathOfStars`,
  `forfeit`, and `stygianWell`;
- keep `echoShopDuplicate` and `hermesShrineDeliveries` explicitly dormant until
  their owning routes are enabled, while retaining their decoded diagnostic
  state;
- verify that changed conformance facts block, unchanged facts are absent, and
  diagnostic-only Run State differences remain nonblocking;
- audit the executor composition and native binding sidecar for one owner per
  supported contact, then delete only proven superseded hooks, duplicated
  readers, copied game algorithms, or broad claims that no longer match the
  implementation;
- update the durable execution-contact audits and
  `IMPLEMENTATION_PROGRESS.md` to the live protocol, closed commerce boundary,
  current semantic executor directories, and truthful covered/deferred
  dispositions; and
- retain this tracker through the unfinished Gate G live F/G proof and Gate H
  durable/Windows closure; Gate H removes it only after every remaining result
  has been absorbed into durable authorities.

The exhaustive map is a test authority, not an implementation manifest. It
must not be imported by production, enumerate native callback names, or require
one adapter per semantic entry. A covered family may remain native-authoritative
or share an existing adapter when the durable audit names that disposition.

Primary witnesses are the compile-time exhaustive map, exact active/dormant
conformance-reader classification, representative protocol decoding for every
published transaction shape, and the existing F/G structural fixture family.
No new large omnibus fixture is required unless the inventory discovers an
unrepresented wire shape.

F2 closes with one complete Run Planner repository gate, the complete executor
Lua suite, executor Luacheck, modpack smoke, and clean diffs. Completed lanes
are not rerun after documentation-only remediation. Each code-producing pass
uses a fresh executor, independent review, one bounded remediation pass, and a
coherent commit in each repository it changes. Planner production changes are
limited to a demonstrated missing choice, carrier, or proof fact; otherwise its
F2 changes are test and durable-document closure only.

### Gate G — Focused live F/G proof

Only after Gates A-F are complete, resume in-game testing with several short
plans rather than one enormous route intended to touch every feature.

Required live lanes:

1. start-loadout, opening reward, ordinary Boon/Hammer/Pom, and normal Doors;
2. Chaos plus positive/negative Sea Star and a generated pickup;
3. World Shop, Well effects, Travel Deal, Pool, fountain, and rack;
4. Artificer, Time Piece charge conformance, Forfeit, Mystery Boon, and NPC
   menus; and
5. Preboss, Boss automatic effects, required boss reward, Postboss, and clean
   configured-prefix completion.

Each discrepancy is routed by the layer matrix:

- wrong planner fact returns to catalog/simulation;
- missing exact result returns to the engine execution product;
- wrong serialized fact returns to compiler/codec;
- wrong native carrier or proof returns to the adapter; and
- player deviation remains a bounded divergence.

No live fix may introduce a family-specific rule into the room session,
compiler, or unrelated biome module. Each accepted fix adds the narrow owning
regression witness before redeployment. Use the modpack's fast deployment path
after the initial build; do not rerun the complete planner suite for an isolated
Lua adapter correction.

Gate G closes with all required F/G lanes reaching their configured prefix and
with source-only later-route adapters still labeled unproven rather than
silently called live-covered.

### Gate H — Durable closure

- absorb the final layered boundary into `GAME_INTEGRATION_BOUNDARY.md`;
- update each execution-contact audit status without erasing source facts or
  live limitations;
- add a concise F/G execution record to `IMPLEMENTATION_PROGRESS.md`;
- update the Plan Executor README;
- remove stale v10 and broad-coverage language;
- delete this plan and the superseded room-session replacement plan after their
  remaining durable decisions are absorbed;
- run one complete Run Planner `npm run check`;
- run final Plan Executor tests, Lua parse, Luacheck, fixture mirror, modpack
  smoke, and Windows build/deployment checks; and
- commit closure independently in each owning repository, then pin the final
  executor revision in the modpack shell.

Completed narrow lanes are not rerun repeatedly merely to create evidence.

## Review and delivery routine

Each implementation gate uses a fresh executor and a fresh independent
reviewer under the main session, with the main session retaining cross-layer
oversight. The gate brief must name:

- exact base commits;
- planner and native authorities;
- files or modules owned by the executor;
- accepted execution dispositions;
- explicit exclusions;
- focused tests; and
- expected deletions or replaced paths.

Only one Vitest lane runs at a time. Executor Lua tests may run independently
when no planner test process is active. Review findings receive one bounded
remediation pass, followed by the main session's bird's-eye review.

Each gate is complete only when planner, executor, and modpack parent are clean
and mutually pinned. Do not leave an active protocol change implemented on one
side only.

## Validation policy

During a gate, run the narrowest owning planner tests and the focused executor
adapter tests while iterating. A gate that changes the shared execution product
also runs the relevant engine execution-plan lane and `npm run typecheck`.
Every executor gate runs `lua tests/all.lua`, parses active Lua with `luac -p`,
and runs Luacheck where available. Hook/bootstrap changes additionally run the
modpack smoke test and fixture mirrors where their payload changed.

Only one Vitest lane runs at a time. Gate F2 owns the complete universal-layer
repository checks recorded above. Gate H repeats the complete Run Planner
`npm run check`, final executor suite, fixture mirror, smoke, and desktop build
only after the live Gate G remediation is stable; they are not repeated after
every Lua contact adjustment.

## Explicit exclusions

- enabling H, I, N, O, P, Q, or Dream Dives route structure;
- a new global action cursor, callback replay trace, scheduler, event bus, or
  runtime semantic rule engine;
- compiler-side interpretation of trait, reward, item, or keepsake meaning;
- runtime substitution, fuzzy native matching, or authored-order matching;
- mid-run attach, repair, replay, or replanning;
- mutating permanent save unlocks or Crossroads configuration;
- health, Gold, damage, Magick, price, or meta-resource simulation;
- enemy wave or combat-effect realization;
- reroll simulation;
- editor redesign or authored-project migration unrelated to an exact missing
  semantic product;
- a production coverage manifest or generic effect payload; and
- claiming live support for a dormant later-route adapter based only on Lua
  unit tests.

## Adversarial acceptance

### Does this repeat the one-shot executor implementation?

No. Each layer has its own exact planner products, native carriers, witnesses,
and commits. Existing code is retained only after it passes that layer. Live
testing begins after the universal layers are closed rather than serving as the
only discovery mechanism.

### Does a universal layer become another giant abstraction?

No. "Universal" means ownership is independent of biome. Native carriers stay
separate when their signatures or settlement proofs differ. The acquisition
layer may share binding and completion primitives without pretending that
loot, consumables, NPC menus, and purchases are one callback.

### Does the exhaustive audit force simulation-neutral effects into runtime?

No. Exhaustive means every family has a disposition. Native pass-through,
simulation-neutral, and deferred are valid dispositions when source-backed and
tested at the appropriate boundary.

### Does v16 become a generic future-proof schema?

No. It contains only concrete products required by the present catalog and
named audits. The strict decoder continues to reject unknown fields. Later
biomes reuse these products or deliberately amend the protocol for genuinely
new carriers.

### Can a future biome really be only structure?

Usually, after this closure. A biome with only existing rewards, traits,
items, and actions should add structural adapters and live proof. A genuinely
new interaction carrier must still add a universal contact disposition; the
plan makes that exception visible rather than denying it.

### Does loadout verification revive broad Run State blocking?

No. It is one bounded start prerequisite checked before any room realization.
Diagnostic Run State remains nonblocking during the run, and room-exit
conformance remains limited to named changed pending/clocked families.

## Completion condition

This plan is complete only when every current catalog-wide execution family
has an explicit planner product or a source-backed pass-through/neutral
disposition; every published consequential result has a native carrier and
focused proof; F/G structural and live lanes complete without unresolved
mismatch; dormant later-route carriers are honestly marked; the compiler and
room session contain no semantic policy; the final protocol produced by these
gates is the sole active contract; and durable authorities have absorbed the
resulting boundary.
