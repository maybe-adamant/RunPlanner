# H Game Rules

## Purpose and Status

This document is the concrete game-rule authority for the Mourning Fields
(`H`). It defines the Fields cage batches, room-local reward slots, bridge
competition, and encounter-depth behavior now represented by the dormant H
catalog slice without importing the previous Lua control shape.

Shared picker, physical-door, cap, force, offer/acquisition, occurrence,
generated-store, forked-preboss, and fixed-completion semantics are defined by
`../GAME_GENERATION_RULES.md`. H remains a `LinearBiome`. Its ordinary generated
batches add one H-specific semantic outcome that activates bounded cage slots
owned by each combat occurrence.

H declarations, dormant authored topology, canonical Fields materialization,
route history, reward replay, selected validation, and focused parity fixtures
are ported. H intentionally remains non-authorable, non-simulatable, and
non-editable at the application capability boundary until its complete product
loop is implemented.

## Evidence Status

These rules were verified against the Hades II script extraction and physical
map data on 2026-07-18. Primary sources are:

```text
../../../../1GameData/Scripts/RoomSets.lua
../../../../1GameData/Scripts/RoomDataH.lua
../../../../1GameData/Scripts/EncounterSets.lua
../../../../1GameData/Scripts/EncounterData.lua
../../../../1GameData/Scripts/EncounterData_Generated.lua
../../../../1GameData/Scripts/EncounterData_MiniBoss.lua
../../../../1GameData/Scripts/EncounterData_Story.lua
../../../../1GameData/Scripts/EncounterData_Unique.lua
../../../../1GameData/Scripts/LootData.lua
../../../../1GameData/Scripts/RunLogic.lua
../../../../1GameData/Scripts/RoomLogic.lua
../../../../1GameData/Scripts/RewardLogic.lua
../../../../1GameData/Scripts/EventLogic.lua
../../../../1GameData/Maps/bin/
```

The previous Lua declaration and revamp audits are interpreted evidence only.
This audit corrects four inherited assumptions:

- `H_Bridge01.AlwaysForce` places the bridge in the forced pool but does not
  guarantee that a physical exit selects it;
- the exact topology bound is nine target occurrences, not the previous
  conservative bound of ten;
- a cage batch must persist semantic `Min` or `Max`, because a capacity-two
  batch can hide a successful Max outcome that still updates history;
- the terminal preboss generation performs no modeled cage outcome because
  its otherwise-real internal roll has no later observable H consumer.

## Feature Projection Map

The disposition vocabulary is defined by `../CATALOG_MODEL.md`; implementation
coverage is defined by `../MIGRATION_PROVENANCE.md`. H currently has normalized
declaration, dormant authored-topology, canonical-materialization, history,
reward-replay, and selected-validation coverage.

| Feature                     | Verified game behavior                                                                                                               | Disposition and planner projection                                                                   | Current coverage                                        | Reconsider when                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------- |
| Linear entered spine        | Fixed intro, four entered Combat/Miniboss/Bridge rooms, then preboss                                                                 | **Exact:** `LinearBiome` with count-driven eligibility                                               | documented, declared, authored, materialized            | --                                                            |
| Room-set weights            | Every listed H room occurs once                                                                                                      | **Simplified:** preserve support and forced pools, never likelihood                                  | documented                                              | Probability analysis or seeded replay becomes a product goal  |
| Physical exits              | Intro, Combat01, Miniboss02, and preboss have one; other supported generated rooms have two                                          | **Exact:** declaration-owned ordered physical exits                                                  | documented, declared, authored, materialized            | --                                                            |
| Combat peer repetition      | Combat rooms have no creation cap and may be offered again until entered; current-room repeat and entered appearance are rejected    | **Exact:** repeated Room Occurrences with concrete game identity                                     | declared                                                | --                                                            |
| Fields cage batch           | One Min/Max result and one effective capacity apply to every combat target in a generated peer batch                                 | **Exact:** batch-owned semantic outcome activates room-owned bounded local slots                     | documented, declared, authored, materialized            | --                                                            |
| Maximum-cage ceiling        | At most two Max outcomes update `FieldsMaxDoorsRolled`; capacity clamping does not suppress the update                               | **Exact:** history-derived counter from semantic batch outcomes                                      | documented, history, validated                          | --                                                            |
| Passive and cage encounters | The ambient combat encounter does not count; every entered cage encounter counts                                                     | **Exact:** zero-count ambient phase plus one counting phase per active cage                          | documented, declared, materialized, history             | --                                                            |
| Cage rewards                | Every generated combat target receives two or three RunProgress cage offers; only entered target cages are fought and acquired       | **Exact:** offer every active local slot; acquire every active slot of the picked target             | documented, declared, authored, replayed, validated     | --                                                            |
| Generated base store        | Door generation computes Run/Meta, but every supported target is reward-free or resolves `BaseH.IndividualRewardStore = RunProgress` | **Simplified:** use batch policy `none`; preserve every concrete RunProgress offer and ledger effect | documented, declared, authored, materialized            | A supported H target consumes an unoverridden base store      |
| Fields optional rewards     | Entered combat rooms independently spawn zero to four non-required rewards from a separate bag                                       | **Deferred:** canonical v1 trace acquires none and emits no authored optional-reward state           | documented                                              | Optional pickup simulation becomes product scope              |
| Minibosses                  | Two mutually exclusive entered variants force Boons and compete under a depth force window                                           | **Exact:** separate declarations, sequential creation caps, and counting encounters                  | declared, materialized, validated                       | --                                                            |
| Bridge                      | Exactly-two combat/miniboss eligibility, always-force pressure, one creation, and Story/Shop/Nemesis variants                        | **Simplified:** progressed-save Echo Story projection; preserve exact topology competition           | declared, materialized, validated                       | Save-profile state or persistent NPC composition enters scope |
| Forked preboss              | After four counted rooms, predecessor exits create Shop first and at most one free reward                                            | **Exact:** shop-then-fill terminal occurrences with one free-reward capacity                         | documented, declared, authored, materialized, validated | --                                                            |
| Terminal-only cage roll     | Generic Fields generation can update its internal roll on the preboss batch even though no target owns cages                         | **Simplified:** omit because the biome terminates before any consumer can observe it                 | documented                                              | Exact RNG/debug trace becomes a product goal                  |
| Boss and postboss           | Neutral Cerberus links through postboss to `I_Intro`                                                                                 | **Exact:** declaration-driven derived completion sequence                                            | declared, materialized                                  | --                                                            |
| Boss store history          | Cerberus's Mixer drop is outside the reward surface but the entered boss records RunProgress provenance                              | **Exact:** fixed RunProgress ledger entry without a reward leaf or acquisition                       | declared, materialized                                  | --                                                            |
| Save/profile and difficulty | Intro reward, bridge variant, early Eris behavior, and boss variant depend on persistent state                                       | **Excluded:** progressed-save neutral-difficulty baseline                                            | documented                                              | Save-profile or difficulty state becomes a project input      |
| Persistent NPC variants     | Nemesis can replace passive, cage, or bridge encounter behavior                                                                      | **Deferred:** omit and suppress under the shared NPC-free baseline                                   | documented                                              | Persistent NPC entities are implemented                       |
| Optional interactions       | Wells, challenges, gathering, sell shops, and rerolls can add optional state                                                         | **Deferred:** canonical v1 traces never activate or use them                                         | documented                                              | The corresponding authored action enters product scope        |

## Possibility Contract

H uses the possibility-only picker contract from `../GAME_GENERATION_RULES.md`.
Every supported combat room has equal room-set weight, but weight never changes
validity. A positive-chance ordinary or forced outcome remains possible.

Physical exits are generated sequentially. Combat rooms have only
`MaxAppearancesThisBiome = 1`, so an unentered combat map may appear in several
occurrences, including peer offers where ordinary eligibility permits it.
Entered combat identity remains capped and the current room cannot immediately
repeat itself.

The bridge and both minibosses instead have `MaxCreationsThisRun = 1`.
Selecting one for an earlier physical exit removes that concrete declaration
from later exits. Both miniboss declarations may be offered in one batch before
either is entered, but the same miniboss cannot occupy both exits.

## Canonical Baseline

The supported H projection assumes:

- an ordinary non-dream Underworld run arriving from `G_PostBoss01`;
- a progressed save on which the Echo Story bridge variant is available;
- the neutral boss-difficulty setting;
- no persistent Nemesis encounter replacement;
- no natural Chaos, optional challenge, well, gathering, sell-shop, reroll, or
  other deferred interaction;
- no pickup from `FieldsOptionalRewards`;
- no modeled automatic Cerberus or weapon-dependent boss drop.

Persistent conditions are evidence for why the baseline exists. They are not
production `unsupported` requirements or authored project fields.

## Layout and Entered Sequence

H has a fixed intro followed by exactly four selected ordinary rooms before
the terminal transition:

```text
H_Intro
  -> entered room 1
  -> entered room 2
  -> entered room 3
  -> entered room 4
  -> H_PreBoss01
  -> H_Boss01
  -> H_PostBoss01
  -> I_Intro
```

The four ordinary entered rooms are combat rooms, one of the two minibosses,
and optionally the bridge. H does not have a fixed room-kind stage sequence.
Eligibility and forced pools derive the possible target set from current
history at each generated batch.

The authored topology contains five continuations after `H_Intro`: four
ordinary generated batches followed by one terminal transition. The normalized
layout bound is four ordinary batches and seven ordinary target occurrences;
terminal occurrences are governed separately by the terminal policy. The full
maximum target-occurrence count is:

```text
intro exit       1
ordinary batch 2 2
ordinary batch 3 2
ordinary batch 4 2
terminal targets 2
                  -
total             9
```

The terminal targets are distinct occurrences that may reference the same
`H_PreBoss01` declaration. The preboss map's own one physical exit to the boss
is part of the derived completion sequence, not another authored continuation.

## Physical Exit Matrix

| Room group       | Physical exits  |
| ---------------- | --------------- |
| `H_Intro`        | one             |
| `H_Combat01`     | one             |
| `H_Combat02..15` | two             |
| `H_MiniBoss01`   | two             |
| `H_MiniBoss02`   | one             |
| `H_Bridge01`     | two             |
| `H_PreBoss01`    | one, fixed boss |

Cage count is never inferred from physical exit count. One generated combat
target owns two or three active local cage slots independently of whether its
map has one or two exits.

## Combat Rooms

All fifteen H combat declarations:

- inherit `MaxAppearancesThisBiome = 1`;
- own no top-level incoming reward;
- use RunProgress with Devotion excluded for their cage rewards;
- own three stable bounded cage slots;
- use a non-counting passive ambient encounter;
- preserve concrete game identity and physical exits.

These rooms have the additional source-depth eligibility requirement
`biomeDepthCache < 4`:

```text
H_Combat02
H_Combat09
H_Combat13
H_Combat14
H_Combat15
```

The other combat rooms have no additional current-run eligibility predicate.
Persistent Nemesis alternatives in the passive encounter sets are suppressed
under the shared NPC-free baseline.

### Cage Capacity

The declaration-owned raw `MaxCageRewards` values reduce against H's global
maximum of three:

| Combat rooms                | Raw maximum | Effective individual maximum |
| --------------------------- | ----------- | ---------------------------- |
| `H_Combat01/05/06/10/11`    | five        | three                        |
| `H_Combat04`                | four        | three                        |
| `H_Combat02/03/07/08/12/15` | three       | three                        |
| `H_Combat09/13/14`          | two         | two                          |

These are immutable Room Declaration facts. An occurrence always owns three
bounded local cage values so replacement and dormancy remain total; the batch
determines which prefix is active.

## Fields Cage Batch

Every ordinary H generated batch owns one authored semantic outcome:

```ts
type FieldsCageOutcome = 'min' | 'max';
```

After every physical target has been created, materialization derives the
effective batch capacity in physical generation order:

```text
batchCapacity = 3

for each generated H combat target:
    batchCapacity = min(batchCapacity, target.maxCageRewards)

min -> active cage count = 2
max -> active cage count = batchCapacity
```

Every combat occurrence in that peer batch receives the same active cage
count. Non-combat occurrences receive no active cage slots. A batch containing
no combat target still owns a semantic outcome because a Max outcome can update
the shared ceiling and affect a later ordinary batch.

The semantic outcome cannot be reconstructed from visible cage count. When
`batchCapacity = 2`, both Min and Max visibly activate two slots, but only Max
increments `fieldsMaxDoorsRolled`.

The terminal transition is the narrow exception. The game can execute the
generic roll while creating only preboss targets, but it creates no cages and
H immediately enters its completion sequence. The canonical model omits that
unobservable terminal-only outcome and counter update.

### Maximum-Outcome Support

`fieldsMaxDoorsRolled` begins at zero and is derived from prior ordinary H
batches whose authored outcome was Max. It never exceeds two.

The game reads the current source room's pre-creation `biomeDepthCache`:

| Source depth | Max chance | Ceiling check | Support while counter is below two |
| ------------ | ---------- | ------------- | ---------------------------------- |
| 1            | `0.05`     | no            | Min or Max                         |
| 2            | `0.20`     | no            | Min or Max                         |
| 3            | `0.40`     | no            | Min or Max                         |
| 4            | `0.80`     | yes           | Max only                           |
| 5            | `0.10`     | yes           | Max only                           |
| 6 and later  | `0`        | no            | Min only                           |

Once `fieldsMaxDoorsRolled = 2`, only Min remains possible at every depth. A
successful or ceiling-forced Max increments the counter even when capacity
clamps the visible result to two or the ordinary batch has no combat target.

Source depth four is the terminal generation point in canonical H after four
ordinary entered rooms, and its unobservable terminal roll is omitted as
described above. The declaration retains the verified depth-five and later
game table as possibility data rather than encoding a canonical-path or UI
shortcut.

## Cage Reward and Encounter Lifecycle

All target rewards and cage rewards in one batch share the game's
`rewardsChosen` offer history. Physical target order, ordinary incoming-producer
order, and cage-slot order are therefore observable during reward resolution.
For each target in physical order, the game resolves its ordinary incoming
producer first and then its cage slots. A miniboss Boon offered on an earlier
target consequently participates in the same-batch Boon-source exclusion seen
by later combat cages, even if that miniboss is not picked.

For each generated combat target:

```text
for each active cage slot:
  choose RunProgress reward with Devotion excluded
  consume the counted offer from the bag
  apply same-batch non-Boon and Boon-source rules
```

Every generated target emits its cage offers, including unpicked targets. Only
the picked combat target is entered. Its ambient Fields phase contributes no
encounter-depth increment. Each active cage starts one ordinary `GeneratedH`
encounter, contributes one `biomeEncounterDepth` and route encounter-depth
increment, and requires its reward to be acquired before the room can finish.

Consequently, an entered H combat room contributes exactly two or three
counting encounters under the canonical NPC-free trace. Cage activation order
does not need authored state: every active cage is completed and acquired, and
the final modeled history is invariant under their physical order.

Cage encounters do not themselves carry entered-room reward-store provenance.
The top-level H combat room has no chosen reward, so entering a combat room
adds no RunProgress/MetaProgress ratio-ledger entry despite generating and
acquiring its local RunProgress cages.

The game still computes a generic RunProgress/MetaProgress value for each door
batch, but no supported H target observes it. Combat targets are `NoReward`,
and their cages, minibosses, Bridge, and preboss realizations resolve
declaration-owned RunProgress provenance inherited from `BaseH`. The authored H
batch therefore uses generated-store policy `none`; its independent Fields
Min/Max state remains batch-owned.

## Fields Optional Rewards

When an H combat room is entered, the game independently evaluates four spawn
chances:

```text
0.95, 0.75, 0.50, 0.25
```

The resulting zero to four rewards come from the separate
`FieldsOptionalRewards` bag and are marked as non-required pickups. They are
not cage rewards, do not block room completion, and do not change the cage
batch's Min/Max outcome or active slot count.

The v1 planner deliberately defers this optional acquisition surface. The
canonical trace picks up none and authors no spawn count, contents, or pickup
state. This is a documented scope choice, not a claim that the game does not
spawn them. If optional Fields pickups later enter scope, they should become
bounded room-local optional slots with separate spawn and acquisition choices;
they must not be folded into the cage producer.

## Minibosses

| Room           | Encounter         | Exits | Reward           | Creation cap | Entered exclusion |
| -------------- | ----------------- | ----- | ---------------- | ------------ | ----------------- |
| `H_MiniBoss01` | `MiniBossVampire` | two   | RunProgress Boon | one          | `H_MiniBoss02`    |
| `H_MiniBoss02` | `MiniBossLamia`   | one   | RunProgress Boon | one          | `H_MiniBoss01`    |

Both miniboss encounters count once. Their rewards are physically caged until
combat completes, but each remains one ordinary incoming target reward rather
than a Fields multi-cage local-slot surface.

Both declarations have `ForceAtBiomeDepthMin = 2` and
`ForceAtBiomeDepthMax = 4`, with no separate upper eligibility bound. Under
the shared capped force formula:

- at source depth two, forced and unforced outcomes both have support;
- at source depth three and later, an eligible miniboss must enter the forced
  pool;
- entering either miniboss makes the other ineligible;
- merely offering one does not trigger the other's entered-room exclusion,
  but its own one-creation cap removes that concrete declaration from later
  physical exits.

## Bridge

`H_Bridge01` is eligible only while exactly two rooms from the combined H
Combat/Miniboss set have been entered. It has two physical exits,
`MaxCreationsThisRun = 1`, `MaxAppearancesThisBiome = 1`, and `AlwaysForce`.

`AlwaysForce` means that an eligible bridge enters the forced candidate pool.
It does not reserve an exit. At the same source history, eligible minibosses
can also be forced. Sequential generation may therefore select one or two
minibosses and crowd the bridge out of a one- or two-exit batch.

If the bridge is generated but unpicked, its creation cap prevents a later
offer. If it is not generated and the player enters a third Combat/Miniboss
room, its exact-two eligibility window closes. If it is picked, it contributes
one room to the terminal total without increasing the Combat/Miniboss count.

The game selects Bridge Story, Bridge Shop, or a Nemesis event from persistent
state and encounter conditions. The canonical progressed-save projection uses
the fixed Echo Story encounter and fixed Story reward. It is non-counting,
does not consume a RunProgress bag entry, and records one fixed RunProgress
store-history contribution inherited from H's individual store policy.
Persistent Nemesis composition remains deferred.

## Terminal Entry

`H_PreBoss01` becomes eligible and forced after four entered rooms counted
across Combat, Miniboss, and Bridge declarations. Canonical paths therefore
reach the threshold as either:

```text
three Combat/Miniboss + Bridge
four Combat/Miniboss without Bridge
```

The predecessor's physical exits create terminal target occurrences in order:

1. the first preboss occurrence realizes the `WorldShop`;
2. every remaining predecessor exit realizes a free RunProgress reward with
   Devotion and `RoomMoneyDrop` excluded.

H predecessors have at most two exits, so H supports at most one free reward.
The selected terminal occurrence acquires its realization and enters the same
physical `H_PreBoss01` map. Both Shop and Free realizations record fixed
RunProgress store provenance when entered.

The preboss map then has one fixed exit to the neutral H boss. It does not own
another authored continuation or expose the omitted terminal cage roll.

## Fixed Boss and Postboss Tail

H completes through the layout-derived sequence:

```text
H_PreBoss01
  -> H_Boss01
  -> H_PostBoss01
  -> I_Intro
```

`H_Boss01` is the neutral-difficulty Cerberus declaration using
`BossInfestedCerberus01`. `H_Boss02` and `BossInfestedCerberus02` are excluded
until difficulty becomes a project input.

The automatic `MixerHBossDrop` and equipped-weapon-dependent result are outside
the modeled reward surface. The boss nevertheless enters with fixed
RunProgress reward-store provenance and contributes one RunProgress entry to
the ratio ledger. It owns no authored reward leaf, bag depletion, or modeled
acquisition.

`H_PostBoss01` uses the empty non-counting encounter, records no modeled reward
or store contribution, and links to the fixed `I_Intro` entry. Optional well
and sell-shop behavior in the postboss map remains deferred.

## Counter and History Projection

Canonical H history preserves:

- one non-counting fixed `H_Intro` appearance;
- one creation event per physical target occurrence, including repeated combat
  identities and unpicked peers;
- one semantic Fields cage outcome per ordinary generated batch;
- one `fieldsMaxDoorsRolled` increment per supported Max outcome, including
  capacity-two and no-combat ordinary batches;
- one RunProgress offer per active cage slot of every generated combat target;
- acquisition of every active cage reward on the picked combat occurrence;
- two or three encounter-depth increments for an entered combat occurrence;
- one encounter-depth increment for an entered miniboss;
- no encounter-depth increment for the bridge, preboss, intro, or postboss;
- one fixed RunProgress store-ledger entry for an entered miniboss, bridge,
  preboss, and H boss;
- no store-ledger entry for H intro, H combat, or H postboss;
- derived `H_Boss01` and `H_PostBoss01` history followed by `I_Intro`.

`biomeDepthCache`, `biomeEncounterDepth`, `fieldsMaxDoorsRolled`, reward bag
history, and route-wide room-history ordinal remain separate axes. The cage
chance table reads source `biomeDepthCache`; combat encounter multiplicity
must not advance it more than once per entered room.

## Excluded and Deferred Systems

The H v1 baseline excludes:

- dream-run intro reward and other dream variants;
- first-time Bridge Shop behavior and lifetime Echo availability predicates;
- early-run Eris progression events;
- difficulty variant `H_Boss02`;
- automatic Cerberus and equipped-weapon-dependent boss drops.

It defers and, where structurally necessary, suppresses:

- Nemesis encounter variants in passive, cage, and bridge encounter pools;
- natural Chaos under the shared route-predictability policy;
- `FieldsOptionalRewards` spawn and pickup authoring;
- challenges, wells, gathering, sell shops, rerolls, and similar optional
  player actions.

The no-pickup trace for Fields optional rewards is sufficient because those
rewards are non-required and use an isolated bag. Persistent NPC variants are
different: they can change encounter structure and therefore remain suppressed
until entity composition enters the model.

## Declaration-Port Contract

The faithful H declaration contract requires the normalized catalog and
authored model to express:

1. fixed H intro and exact physical exit fixtures;
2. fifteen concrete repeatable-offer combat declarations;
3. three bounded cage reward slots on every H combat occurrence;
4. immutable raw cage capacity per combat declaration;
5. batch-owned semantic Min/Max state, with an explicit policy default,
   independent of visible cage count;
6. history-derived `fieldsMaxDoorsRolled` support and ceiling behavior;
7. non-counting passive phases plus one counting phase per active cage;
8. shared ordered cage-offer resolution across picked and unpicked targets;
9. separate, one-creation, mutually exclusive miniboss declarations;
10. bridge forced-pool competition rather than a guaranteed structural stage;
11. forked preboss shop-then-fill with one free-reward capacity;
12. derived neutral boss/postboss completion and explicit store-history
    policies;
13. `none` generated-store policy without suppressing declaration-owned
    RunProgress target and cage offers;
14. the deferred optional-reward and NPC-free baselines without production
    `unsupported` predicates.

The declaration port includes all supported H rooms and exact physical exits
in one readable parity matrix. It does not activate H in the editor or
simulator.

## Current Product Boundary

The schema-version-3 project codec and semantic commands can author H's
fixed start, four ordinary batches, seven-target bound, Fields Min/Max state,
complete dormant cage leaves, and forked terminal entry. Ordinary H batches
own `{ kind: 'none' }` generated-store state and default to Min; the explicit
Fields outcome command retains every target, cage value, and downstream
continuation. Linear completeness accepts that closed authored form.

Canonical materialization derives batch capacity in physical target order,
retains the semantic outcome even for no-combat and capacity-two Max batches,
and exposes only the active two- or three-slot local-reward prefix on each
combat target. It selects the matching concrete Fields encounter profile and
materializes the fixed intro, both terminal realizations, neutral boss, and
postboss without mutating authored cage state. The terminal transition owns no
synthetic Fields outcome.

Route history composes that snapshot only after validated G history. Every
ordinary batch emits its semantic Fields outcome before target creation, so
the folded state exposes the correct `fieldsMaxDoorsRolled` value at each
generation checkpoint. Actual materialized encounter-profile identity is
recorded rather than reconstructed from the room declaration: the entered
combat occurrence therefore contributes one non-counting Passive phase and
exactly one counting phase per active cage. Fixed RunProgress provenance is
recorded for entered miniboss, Bridge, preboss, and boss rooms but not for H
combat rooms.

Reward replay begins from G's carried reward bags and history. It resolves
each target's ordinary producer and then every active cage in physical order,
retaining one peer context across the batch. Active cages on unpicked combat
targets emit offers and consume bag support but never acquire; each active cage
on the picked combat target acquires at its matching encounter completion.

Selected validation now evaluates each ordinary Fields outcome from the source
room's pre-commit depth and prior Max count, then merges continuation-addressed
failures with the common room-generation and reward finding streams. The same
declaration-driven walk validates combat depth restrictions, sequential force
competition, Bridge and miniboss caps/exclusions, and the forced preboss after
four entered ordinary rooms. Invalid values remain authored.

H does not yet evaluate candidates or project an editor. The application
capability boundary and project simulator dispatch therefore continue to
reject H profiles until the complete product loop is ready.

## Model Conclusions

H keeps these shared contracts intact:

- concrete Room Declarations are unique while occurrences may repeat;
- `LinearBiome` remains valid for count-driven rather than stage-driven
  continuation;
- topology owns physical target batches while room occurrences own local
  bounded reward state;
- validation models possibility rather than probability;
- forked preboss targets are occurrences, not singleton room controls;
- fixed boss/postboss history is declaration-driven.

H strengthens the shared model in four places:

- a generated batch can own biome-specific semantic state in addition to its
  generated reward-store policy;
- local slot activation is derived from batch context without moving slot
  values out of their room occurrence;
- a semantic outcome may affect history even when capacity hides its visible
  result or no target activates the local surface;
- room reward generation and entered-room store-ratio provenance are distinct
  ledgers, demonstrated by Fields cages and the H boss.

F, G, P, Q, H, O, I, and N are now closed as game-rule/design audits. I
confirms that a generated batch may derive completion from its picked target
without moving leaf state out of occurrences; N separately confirms the fixed-
slot persistent-hub and restore model.
