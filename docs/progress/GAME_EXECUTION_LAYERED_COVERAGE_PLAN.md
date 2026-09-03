# Layered Game Execution Coverage Plan

## Status

Drafted on 2026-09-02 for adversarial review. Gate A was completed on
2026-09-03. Gate A.2 was added and locked after the first live run exposed the
native run-construction boundary. The later gates remain scope outlines until
they receive the same component-by-component review. Do not begin a gate until
its components, ownership, native contacts, pass-through boundary, and concrete
witnesses have been discussed, cleaned up here, and locked.

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
eligibility, random outcomes, action dependencies, or fallback choices from
game-name strings, encoded addresses, callback order, or current inventory.

## Outcome boundary for later biomes

After closure, enabling H, I, N, O, P, Q, or Dream Dives may add:

- route- and biome-specific room topology;
- nonstandard encounter assembly such as H cages, N side rooms, O wheels, P
  phase envelopes, I goals, or Q structured rooms;
- biome-owned Overview or Doors contacts; and
- live evidence for already-implemented dormant native carriers.

It must not silently add a new generic reward, acquisition, trait-effect,
keepsake, Shop, Well, Pool, Shrine, fallback, or retained-state policy. If a
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

- Protocol v10 publishes one selected Underworld F or F/G occurrence sequence
  with Overview, consequential Timeline transactions, local prerequisites,
  obligations, Doors, sparse room-exit conformance, and diagnostic Run State.
- The active executor uses a route cursor and one Room Occurrence session. The
  global callback/action cursor has been removed.
- Runtime fallbacks, Artificer producer relations, Mystery Boon staging,
  required boss rewards, Chaos pairs and returns, World Shops, Wells, Pools,
  resources, fountains, racks, and F/G topology have working bounded paths.
- Direct Nectar and Pom Slice levels and bespoke NPC menu carriers now have
  native adapters.

These are implementation evidence. Each layer below may retain them only after
its coverage matrix proves the contact; working code is not exempt from audit.

### Known gaps that motivate the plan

| Layer                 | Current gap                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run start             | Weapon, aspect, Arcana, and Fear are diagnostic data rather than a blocking start contract; Aspect of Selene's native starting tree remains random. |
| Structure             | F/G is broadly functional, but coverage was established incrementally and still needs one coherent room/reward/encounter/feature/door proof.        |
| Acquisition carriers  | A generic result may work through loot while failing through a consumable, generated object, NPC menu, or purchase.                                 |
| Trait effects         | Natural Selection, Ransoms, and All Together lack exact execution payloads; Concave Stone's nested result is dropped.                               |
| Sea Star              | A positive `UseLoot` duplicate is forced, but direct consumables and the authored negative outcome are not.                                         |
| Keepsake effects      | Immediate and retained effects need explicit pass-through or exact-result dispositions rather than assuming equip identity closes the family.       |
| Commerce              | Existing Shop/Well/Pool support needs an exhaustive item/contact audit; Shrine delivery remains dormant and unproven.                               |
| Later-route abilities | Hex/Path, Moon Beam, Echo, Circe, and later NPC carriers are modeled but not all have complete execution products and native proofs.                |

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

A later-route semantic product may enter v11 before its route structure is
publishable only when a planner test assembles it from a real complete-valid
occurrence evaluation through the existing occurrence-level execution
projection. The executor may then consume that exact payload in protocol and
native-adapter tests. Do not fabricate an impossible F/G occurrence, add a
test-only production builder, or enable the later route merely to manufacture
coverage.

This proves the planner-to-wire contact without claiming a live native probe.
Live support remains deferred until the owning biome gate reaches that contact.

## Protocol policy

The first schema-changing gate replaces protocol v10 with protocol v11. v11 is
the single development protocol for this entire unclosed plan:

- there is no v10 compatibility decoder or dual executor;
- each gate updates planner fixtures, strict Lua decode, and the modpack pin in
  lockstep before that gate is considered complete;
- v11 may gain only the concrete closed fields and variants named by this plan;
- unknown fields and union members remain rejected; and
- v11 is not declared stable or release-ready until the final closure gate.

This avoids both silently mutating the already-consumed v10 contract and
inventing a new protocol version for every layer. It does not authorize a
generic `effectName`/`arguments` object or speculative placeholders for later
features.

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
behavior remain Gate D2 work, but must reuse the starting-Hex tree realization
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
- Jeweled Pom's selected Hades trait or declared runtime fallback;
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
- make `src/mods/navigation/` the executor-side owner of room occurrence
  navigation and structural realization: the active room session, room identity,
  Overview structure, Doors structure, native bindings, and genuinely
  biome-specific topology adapters live together there;
- organize exceptional F/G topology beneath `navigation/biomes/` only when it
  has real biome-owned behavior. Do not add empty per-biome shells or move later
  acquisition/effect policy merely because it occurs in that biome;
- retain one general room adapter for ordinary declaration-driven facts;
- isolate only genuine F- or G-specific structure, including Anomaly, Zagreus
  Contract, and Chaos return batches, in bounded biome-owned modules if the
  current code benefits from that boundary;
- realize room identity, incoming reward, encounter phases, required objects,
  resources, Shop-like object presence, additional exits, and normal Doors at
  their stable logical checkpoints;
- keep required effect-neutral boss drops native without treating their exact
  meta-progression identity as a simulation result;
- keep native game-literal translation in the existing bounded sidecar rather
  than leaking native strings into planner policy; and
- delete the superseded top-level room/Overview/Doors realization paths and
  structural fragments left in generic feature hooks, along with redundant
  transition, raw door-class, or duplicate callback checks that do not
  contribute to Overview or Doors proof.

The `navigation/` name does not authorize a new transition-conformance cursor.
It advances the room occurrence session and owns the two stable structural
checkpoints: room entry compares the complete current room and Overview product;
Doors open compares the complete exit product. It does not compare every native
transition between those checkpoints. Protocol decoding remains in the protocol
family, while Timeline actions, acquisitions, purchases, and trait/item effects
remain with their later owning gates. Object presence belongs to navigation;
interaction with that object does not.

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

### Gate C — Generic acquisition carriers

User-visible outcome: the same planner acquisition result works regardless of
whether the game carries it through loot, a consumable, a generated object, an
NPC menu, a Shop purchase, or a Well purchase.

Deliverables:

- establish one exact carrier matrix for ordinary loot, Pom/level loot, direct
  consumables, direct random-level items, generated pickups, Mystery Boons,
  bespoke NPC menus, World Shop items, Well items, and resources;
- bind every materialized object/screen to its published semantic owner before
  attempting completion;
- keep purchase/payment distinct from a later trait or level acquisition;
- apply the same one-step runtime fallback relation at its four published
  availability contacts without searching another pool;
- preserve producer/child relations for Artificer, generated trait pickups,
  Mystery Boon unwrap, and later effect layers; and
- replace carrier-specific duplicate code with a shared adapter only where the
  native inputs and completion proof are genuinely identical.

Primary witnesses:

- ordinary Olympian Boon and Hammer;
- Pom choice, Nectar, and Pom Slice;
- Mystery Boon provider then trait acquisition;
- Arachne and Narcissus bespoke menus plus one dormant later-biome NPC menu;
- direct consumable and generated consumable with the same semantic result;
- purchased Boon whose purchase does not complete its trait owner;
- Artificer source, generated replacement, and later pickup; and
- preferred, fallback, and neither-available cases at all four fallback
  contacts.

No special trait's internal random effect is closed merely because its outer
trait selection passes this gate.

Intended commits:

- Run Planner only for a demonstrated missing carrier fact.
- Plan Executor: `feat(executor): unify acquisition carriers`
- Modpack shell: pin the completed executor commit.

### Gate D — Trait, Chaos, keepsake, and Hex effect closure

User-visible outcome: every planner-modeled trait or keepsake consequence has
an exact execution disposition independent of biome.

Gate D has two separately reviewable delivery gates. D1 closes the generic
offer carrier before D2 adds any trait-specific acquisition behavior.

#### D1 — Generic offers

- ordinary Olympian, Hermes, Hammer, Spell, NPC, Duo/Legendary, replacement,
  effective-level, Calling Card, and Denial-rejected offers;
- preserve native option records while imposing planner option order, rarity,
  effective level, replacement, and rejected identity;
- all three Chaos curse choices, requirements, selected curse/blessing pair,
  rarity, values, and blessing maturity state; and
- Concave Stone's frozen residual and any runtime fallback remain nested in the
  source acquisition rather than becoming new Timeline owners.

#### D2 — Closed consequential effect families

The planner engine must publish, and the executor must realize or locally
verify, the exact result for every applicable closed disposition:

| Family                   | Required exact product/contact                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Natural Selection        | Ordered eight-target level sequence consumed by `DistributeLevels`.                                                                                                                                                       |
| Ransoms                  | Removed trait identities plus exact resulting level mutations at `SacrificeAllBoon`.                                                                                                                                      |
| All Together             | One selected direct grant from each of the four declared sets at `GrantBoons`.                                                                                                                                            |
| Sea Star                 | Explicit duplicate/no-duplicate result at every eligible source; positive child binding for loot and consumable carriers; negative suppression; no purchase proc and no recursion.                                        |
| Concave Stone            | Proc/no-proc and selected frozen residual inside `HandleUpgradeChoiceSelection`, including Cherished Heirloom's same-offer ordering.                                                                                      |
| Cherished Heirloom       | Exact current-keepsake rank transition at `AttemptAdvanceKeepsake`, or an explicitly proven deterministic native pass-through.                                                                                            |
| Produced pickups         | Exact producer and child owners for Quick Buck, Buried Treasure, NPC gifts, Echo, and other declared producers.                                                                                                           |
| Echo / Circe             | Exact result payloads for every modeled non-neutral effect; adapters may remain dormant until their route is enabled but must decode and unit-test against their native carrier.                                          |
| Spell / Path / Moon Beam | Ordinary Spell choice; reuse of Gate A's Hex-tree realization for newly acquired spells; later Path-point contributions, late God Sent insertion, investment, and closed-tree ineligibility; no combat-effect simulation. |

`equip`, `noOp`, numeric-only Echo results, and simulation-neutral keepsakes may
be native pass-through only under the explicit pass-through rule above.
Olympian keepsake pressure must be classified deliberately: if exact equip plus
the later resolved reward/offer is sufficient, document that pass-through and
do not invent another transaction.

Primary witnesses:

- one concrete trait for every row above, using the named game-native contact;
- Sea Star positive and negative outcomes through full Pom/loot and direct
  consumable carriers, plus generated-child non-recursion;
- Concave Stone with and without Cherished Heirloom ordering pressure;
- Ransom removal followed by a same-room offer using the post-removal state;
- All Together's four exact grants; and
- a test-owned exhaustive check that every normalized
  `TraitSelectedDisposition` and modeled keepsake-effect family has one
  execution classification.

The exhaustive check belongs in tests. Production must not gain a generic
effect registry or a second trait simulator.

Intended D1 commits:

- Run Planner only for a demonstrated missing generic offer product.
- Plan Executor: `refactor(executor): close generic trait offers`
- Modpack shell: pin the completed executor commit.

Intended D2 commits:

- Run Planner: `feat(execution): publish consequential trait outcomes`
- Plan Executor: `feat(executor): realize consequential trait outcomes`
- Modpack shell: pin the completed executor commit.

### Gate E — Shop, Stygian Well, Pool, and Shrine closure

User-visible outcome: all Shop-like objects share stable inventory and
interaction primitives while preserving their different semantics.

Deliverables:

- cover Room Shop, World Shop, Surface Shop, I/Q World Shop, Stygian Well,
  Pool of Purging, and Shrine of Hermes inventory shapes without making one
  feature pretend to be another;
- keep object presence, generated inventory, purchase/sale intent, and later
  acquisition as separate facts;
- retain full Shop and Shrine inventory even when offers are not purchased;
- allow uninteracted Wells and Pools to generate natively without fabricated
  authored inventory;
- settle Pool sales by exact removed trait and ignore Gold amount;
- close every declared Well effect: neutral, Spark, Yarn, Hymn, Discount,
  Empty Slot, Extended, Twist, and Last Stand fallback;
- preserve Travel Deal's planner-owned purchase/refill prerequisites without
  recomputing "first purchase" in Lua;
- preserve Echo Gold Gold Gold as an exact purchase-to-child relation;
- keep Shrine purchase/rush setup distinct from the later delivery acquisition;
  rushed delivery is local while delayed delivery is retained state; and
- treat price, damage, health, Gold, duration of neutral effects, and other
  simulation-neutral amounts as native pass-through.

Primary witnesses:

- interacted and uninteracted Well and Pool;
- ordinary World Shop with purchased and unpurchased trait/consumable offers;
- Travel Deal source, refill realization, competing purchase barrier, and
  optional refill purchase;
- Twist preferred/fallback result;
- Last Stand available and fallback inventory/purchase;
- one neutral stacking Well item that creates no false obligation;
- Shrine rushed and delayed Mystery Boon delivery, including delivery after the
  source room has closed; and
- a test-owned exhaustive check for every normalized Well effect and Shop-like
  profile.

Intended commits:

- Run Planner only for missing exact semantic products revealed by the audit.
- Plan Executor: `feat(executor): close shop-like native contacts`
- Modpack shell: pin the completed executor commit.

### Gate F — Remaining room actions, retained effects, and automatic outcomes

User-visible outcome: everything outside loadout, structure, traits, and
commerce has an explicit execution disposition rather than falling through a
generic callback.

Deliverables:

- close resources and exact element contribution, fountain/Phial, keepsake
  rack changes, Forfeit Onion, required pickups, generated optional pickups,
  and effect-neutral boss drops;
- retain the already-closed Time Piece and Artificer carrier paths without
  moving their acquisition semantics into this layer;
- close the full automatic union: Steady Growth, Transcendent Embryo, Judgment,
  and Crystal Figurine;
- verify the seven F/G room-exit conformance readers and retain explicit
  dormant dispositions for Echo Shop duplicate and Shrine deliveries;
- audit every `RoomActionReference`, automatic transaction, acquisition
  disposition, runtime-fallback contact, retained-effect family, and Overview /
  Doors variant against the contact library;
- delete superseded positive-only hooks, duplicated native readers, and broad
  claims that are no longer true; and
- leave guidance-only and simulation-neutral actions nonblocking.

Primary witnesses:

- resource element acquired at room exit;
- Phial-sensitive and non-sensitive rack/fountain orders;
- Time Piece and Artificer on the same eligible source family;
- Forfeit ordinary and Artificer Onion paths;
- all four automatic transaction kinds at their lifecycle windows;
- changed conformance fact blocks, unchanged fact is absent, and diagnostic
  differences remain nonblocking; and
- one final test-owned coverage report has no unclassified universal family.

Intended commits:

- Run Planner: only any final missing execution products and coverage tests.
- Plan Executor: `feat(executor): close remaining execution contacts`
- Modpack shell: pin the completed executor commit.

### Gate G — Focused live F/G proof

Only after Gates A-F are complete, resume in-game testing with several short
plans rather than one enormous route intended to touch every feature.

Required live lanes:

1. start-loadout, opening reward, ordinary Boon/Hammer/Pom, and normal Doors;
2. Chaos plus positive/negative Sea Star and a generated pickup;
3. World Shop, Well effects, Travel Deal, Pool, fountain, and rack;
4. Artificer, Time Piece, Forfeit, Mystery Boon, and NPC menus; and
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

Only one Vitest lane runs at a time. The complete Run Planner `npm run check`,
final executor suite, fixture mirror, smoke, and desktop build belong to Gate H
after all narrow remediation is stable; they are not repeated after every Lua
contact adjustment.

## Explicit exclusions

- enabling H, I, N, O, P, Q, or Dream Dives route structure;
- a new global action cursor, callback replay trace, scheduler, event bus, or
  runtime semantic rule engine;
- compiler-side interpretation of trait, reward, item, or keepsake meaning;
- fuzzy native matching or authored-order fallback matching;
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

### Does v11 become a generic future-proof schema?

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
room session contain no semantic policy; protocol v11 is the sole active
contract; and durable authorities have absorbed the resulting boundary.
