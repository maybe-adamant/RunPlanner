# Reward Game-Data Audit

## Purpose

This document records the game-data evidence behind `../design/REWARD_MODEL.md` and the
Phase 2.6 reward-kernel closure. It is an audit note, not a
second design authority. When this document and the model disagree, the model
must be reconciled before implementation proceeds.

Primary evidence comes from the current game scripts:

- `LootData.lua` for counted reward stores;
- `RewardLogic.lua` for store initialization, entry eligibility, depletion,
  refill, Boon sources, and Devotion setup;
- `RoomLogic.lua` for generated-door store resolution, O wheels, H cages, and N
  hub offers;
- `StoreData.lua` and `StoreLogic.lua` for shop groups and entry-time generation;
- `InteractLogic.lua`, `ConsumableData.lua`, `WorldUpgradeData.lua`, and loot
  creation paths for acquisition history and source-sensitive consumable
  upgrades.

## Disposition Vocabulary

Every audited behavior receives one of four dispositions:

`Exact`
: The planner represents the same support, ordering, lifecycle, and observable
state used by the game within the declared baseline.

`Simplified`
: The planner deliberately admits or merges behavior. The lost distinction and
its consequence must be stated; simplification must never be described as
exact.

`Deferred`
: The behavior is a coherent additive feature that is intentionally absent from
the first complete model. The canonical trace suppresses or fixes it so the
omission cannot silently change the supported spine.

`Excluded`
: The behavior is outside the selected planning baseline, normally because it
depends on save/profile state, equipment, a bounty, a dream run, or an
unsupported route detour. Production declarations contain no zombie predicate
for it.

`Current coverage` is separate from disposition. A game behavior may have an
exact target model while production remains pending.

## Baseline

The planner models possibility, not probability. Positive weights and chances
do not make an authored outcome more or less valid. Zero support, forced
support, finite multiplicity, requirements, physical ordering, and without-
replacement selection remain semantic.

The baseline assumes:

- a normal non-bounty, non-dream run;
- no keepsake or trait forcing a reward or Boon source;
- the declared route order;
- external save/profile progression predicates removed from production data;
- store rerolls suppressed; NPC gift internals and reward-duplication effects
  use the explicit dispositions in the trait audit. The active Story-NPC plan
  scopes implementation to source-sensitive Nectar and Narcissus.

Removing external predicates is not automatically equivalent to selecting one
concrete fully progressed save. When raw data contains mutually exclusive save
tiers, the planner must select the tier consistent with its declared baseline
rather than unioning every externally gated entry.

## Global Reward Mechanics

| Mechanic                    | Game behavior                                                                                                                                                               | Disposition                                  | Phase 2.6 consequence                                                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Counted-store lifetime      | Every store is deep-copied into one run-local mutable bag at run start                                                                                                      | Exact                                        | Scratch bag state is route-scoped, not room-scoped                                                                                                                              |
| Offer-time depletion        | Every generated counted offer removes one exact bag entry, including unpicked doors, wheels, cages, and side rooms                                                          | Exact                                        | Offer materialization mutates bags before entry/acquisition                                                                                                                     |
| Offer-time fact projection  | Devotion setup records `LastDevotionDepth` when the offer is materialized, including for an unpicked target                                                                 | Exact                                        | Add a reward-type `devotionSpacing` offer projection; never infer it from acquisition                                                                                           |
| Same-batch duplicates       | Entry-level `AllowDuplicates`; otherwise an earlier peer with the same duplicate key blocks the later peer                                                                  | Exact                                        | Normalize `allowDuplicates`, default false                                                                                                                                      |
| Entry selection             | The game randomly removes one eligible concrete entry                                                                                                                       | Exact support, not RNG replay                | Retain exact states internally; diagnostics aggregate only proven-equivalent semantic states.                                                                                   |
| Refill                      | When no entry in the whole bag is eligible, append a complete base set while retaining leftovers; repeat once more; after two refills fall back to `RoomRewardHealDrop`     | Exact raw picker behavior                    | Exact for every store and route; mature consumers never exhaust one refill, see the reachability proof below                                                                    |
| Reward priority queue       | Keepsakes can prioritize an otherwise eligible reward                                                                                                                       | Excluded                                     | Neutral equipment baseline contains no priority queue                                                                                                                           |
| Bounty overrides            | Active bounties can replace store declarations and forced rewards                                                                                                           | Excluded                                     | No bounty predicates or alternate bags                                                                                                                                          |
| Generated base-store ratio  | Entered-room store history influences RunProgress versus MetaProgress support                                                                                               | Simplified                                   | Preserve possible/forced support, not probability or RNG state                                                                                                                  |
| Generated target stores     | Physical target scan may let a later forced store become the shared store used by an earlier ordinary target                                                                | Exact                                        | Preserve the verified two-pass, physical-order algorithm                                                                                                                        |
| Store history               | Entered rooms can record resolved store provenance even when their visible producer did not consume that bag                                                                | Exact                                        | Keep store-history policy separate from reward producer                                                                                                                         |
| Rerolls                     | A door, wheel, cage or Hub reroll is one more draw from the target's store; a World Shop reroll regenerates its inventory                                                   | Exact for doors, wheels, cages and Hub doors | Authored presses settle as real draws ([reward model](../../design/REWARD_MODEL.md#rerolls)); World Shop rerolls stay outside the plan                                          |
| Duplicate/bonus traits      | Traits may add extra rewards or duplicate pickups                                                                                                                           | Deferred                                     | Canonical lifecycle emits only the authored producer's concrete acquisitions                                                                                                    |
| Nectar run-progress upgrade | With `WorldUpgradeGiftDropRunProgress`, a `GiftDrop` instance created with `RunProgressUpgradeEligible` keeps its Nectar pickup and also attempts one random `+1` Pom level | Exact supported source split                 | Ordinary room rewards opt in; Shop inventory does not. An empty target set is a valid no-op; the effect belongs to the producer/acquisition binding, not globally to `GiftDrop` |

### Offer-time side effects

`SetupRoomReward` performs all common offer selection before entry. Counted
entry consumption, same-batch duplicate tracking, Boon peer-source exclusion,
and canonical offer history are shared offer-point mechanics.

Devotion has one additional supported persistent effect at that boundary:
after choosing its encounter, setup writes the current `RunDepthCache` to
`LastDevotionDepth`. This happens for every materialized Devotion offer and is
not conditional on entering its target or acquiring either source. The
`RequiredMinRoomsSinceEvent` check later reads that exact marker.

The closed Phase 2.6 offer-projection vocabulary is therefore `none` and
`devotionSpacing`. No other supported reward type writes a persistent
current-run fact merely by being offered. Devotion's global encounter record is
presentation/progression evidence with no supported downstream planner
consumer and remains outside the canonical projection.

### Forced room rewards

`RewardLogic.lua:ChooseRoomReward` returns the first room `ForcedRewards`
entry whose `GameStateRequirements` hold (lines 124–135) before the bag
eligibility scan, refills and `RewardPriorities` (line 163), setting
`ForceLootName` so `SetupRoomReward` skips `ChooseLoot` and keepsake
`ForceBoonName` (line 228). No bag entry is withdrawn. `F_Combat01` is the only
supported room declaring one: an Apollo Boon while `GameState.UseRecord.ApolloUpgrade`
is false (`RoomDataF.lua:F_Combat01`). The planner declares it on the room's
counted producer with a `lifetimeGodUseRecord` requirement, so it applies on
`FreshFile` and never on a mature save.

### Latent Bag State

Multiplicity entries are not interchangeable merely because they share a
reward name. Once `ordinaryLootCount` is satisfied, for example, both the base
and qualified `MaxHealthDrop` entries are eligible and the game may remove
either exact entry. The planner must not choose declaration order as a hidden
tie-breaker.

That exact internal split does **not** currently imply two behaviorally
different supported futures. A fresh audit of the normalized stores found:

- the base and `ordinaryLootCount` copies of `MaxHealthDrop`, `MaxManaDrop`, and
  `RoomMoneyDrop` become interchangeable after their requirements overlap,
  because ordinary-loot history is monotonic;
- the two `StackUpgrade` copies share `stackLegal`, and the qualified copy only
  adds the same monotonic ordinary-loot condition;
- the early and late `WeaponUpgrade` requirements cannot overlap: the first
  requires no prior Hammer, while the second requires exactly one prior Hammer
  and at least three entered biomes;
- every other same-reward multiplicity in the normalized stores has the same
  requirement as its peers.

The planner disposition keeps every exact ordered entry and requirement in the
normalized store, then lets a store declaration certify same-name entries as
interchangeable when simultaneous eligibility makes their future behavior
identical. `RunProgress` certifies the Health, Magick, Gold, and Pom pairs. Bag
transition canonicalization aggregates only those certified pairs; this is an
equivalence-class representative, not an assertion about which random game
index was removed. Hammer remains uncertified, and every undeclared
different-requirement pair retains its exact latent branches. Diagnostic bag
projection likewise exposes effective aggregate counts rather than presenting
certified exact-entry identity as multiple run histories.

## Generated Base-Store Ratio Controller

The `Generated base-store ratio` row above is `Simplified` only in its refusal
to reproduce probability. Its support geometry, its count, and its exclusions
are exact, and this section records the evidence.

### The chance formula

`ChooseNextRewardStore` (`RoomLogic.lua:3846–3868`) computes

```text
chance = T + AdjustSpeed * (T - C) = 11T - 10C
```

`T` is resolved by a three-way fallback at `RoomLogic.lua:3852`:
`run.TargetMetaRewardsRatio`, else `run.CurrentRoom.TargetMetaRewardsRatio`
(the biome base block, which is where every biome target below is declared),
else `run.Hero.TargetMetaRewardsRatio`. `C` is `CalcMetaProgressRatio`, and
`AdjustSpeed` is `Hero.TargetMetaRewardsAdjustSpeed = 10` (`HeroData.lua:72`),
unmodified anywhere in the data. `RandomChance` applies no clamp, so the chance
saturates: `chance >= 1` is always MetaProgress and `chance <= 0` is
effectively always RunProgress.

One consequence follows from the coefficients alone. The free window — the band
of `C` where both stores are possible — is always exactly `0.1` wide, for every
biome and every target, because `0 < 11T - 10C < 1` solves to
`C ∈ ((11T - 1)/10, 1.1T)`.

How often a door actually lands in that window is a separate, route-dependent
question, and the enumeration of reachable states does not support calling
saturation the norm. The window's width is comparable to the step one counted
entry makes in `C`, not small against it, so forced and open doors alternate:
in an illustrative F, roughly half the doors are open, and an enumeration
across F shapes and override mixes found none whose every reachable ratio
forces G's opening (`C = 0.300`, reachable in some shapes, gives
`chance = 0.85`). Forced doors
are common enough that every consumer must treat them as ordinary, but calling
saturation the common case overstates what the reachable states show.

| Biome | Target `T` | Source                                                                                                                                            |
| ----- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| F     |      0.315 | biome base block                                                                                                                                  |
| G     |       0.35 | biome base block                                                                                                                                  |
| H     |        0.0 | biome base block; never consulted, see the pin below                                                                                              |
| I     |       0.25 | biome base block                                                                                                                                  |
| O     |       0.30 | biome base block                                                                                                                                  |
| P     |       0.20 | biome base block                                                                                                                                  |
| Q     |       0.15 | biome base block (`RoomDataQ.lua:44`)                                                                                                             |
| N     |       0.45 | no base block; falls through to the Hero default. Never consulted: the hub is count-excluded and its progression declares no generated base store |

### The counted ratio

`CalcMetaProgressRatio` (`RewardLogic.lua:469–489`) walks the whole run
history plus the current room. The scope is the run, not the biome: every
entered room the run has passed through feeds the same `C`. "Run" is the
operative bound — a project carries one route, and `Underworld` (`[F, G, H,
I]`) and `Surface` (`[N, O, P, Q]`) are disjoint, so on an ordinary run the
history reaching a door is that route's earlier biomes only. A Dream itinerary
is the sole context that mixes biomes across routes into one count.

`CalcRoomRewardStores` (`RewardLogic.lua:491–511`) defines the granularity. A
room whose encounters carry stores contributes one count per such encounter;
otherwise it contributes one count per room that has both a `ChosenRewardType`
and a `RewardStoreName`. The ratio is `MetaProgress / Total`, so every
non-`MetaProgress` store — `RunProgress`, `TartarusRewards`,
`TyphonBossRewards` and `Secrets` — counts only in the denominator. N's hub
bags (`PreHubRewards`, `HubRewards`, `SubRoomRewards`, `SubRoomRewardsHard`) never reach either
side of the ratio: the whole hub is count-excluded by the flags below. A biome
whose stores are entirely biome-local therefore still moves the controller for
every later biome on its route, by diluting `C` toward zero.

The function returns `nil` before anything is counted, which makes
`chance = T` exactly at the run's first resolved door.

### Count exclusions and their inconsistency

`IgnoreForRewardStoreCount` appears at exactly four sites in the room data:

| Site                                    | Coverage                                        |
| --------------------------------------- | ----------------------------------------------- |
| `RoomDataF.lua:2093` (`F_Boss01`)       | the F boss room                                 |
| `RoomDataF.lua:2347` (`F_Boss02`)       | the F alternate boss room                       |
| `RoomDataN.lua:10` (`BaseN`)            | the N hub, covering the N bosses by inheritance |
| `RoomDataN.lua:3796` (`BaseN_SubRooms`) | the N side rooms                                |

G and every later boss room are structurally identical to the F bosses —
`ForcedReward` completion rooms reached by a fixed link — and carry no flag, so
they count. This is a game-data inconsistency, not a rule. The planner mirrors
it exactly and never rationalizes it into a "bosses do not count" principle;
any declaration that departs from these four sites is a defect.

### Boss doors

There is one uniform native rule at every door, boss doors included
(`RoomLogic.lua:3951–3956`): the target's `IndividualRewardStore`, else a
forced override for that door, else the batch roll — with the individual store
winning over the forced one.

| Boss door  | Resolution                                                                    |
| ---------- | ----------------------------------------------------------------------------- |
| G, O, P, Q | genuinely roll the ordinary batch chance                                      |
| H          | pinned by `BaseH.IndividualRewardStore = "RunProgress"` (`RoomDataH.lua:332`) |
| I          | pinned by `BaseI.ForcedRewardStore = "TartarusRewards"` (`RoomDataI.lua:305`) |
| F, N       | count-excluded by the flags above                                             |

Both pins sit on the biome base block, not on the boss declaration, so every
room in H and every room in I inherits one — the boss is pinned because every
H or I door is. Two facts follow. H and I therefore never roll for any door at
all, so their ratio targets (`0.0` and `0.25`) are dead for door stores — they are consumed only
through the denominator those biomes' entered rooms contribute. And a boss door
never depletes a store bag: `ForcedReward` short-circuits at
`RewardLogic.lua:86–88`, ahead of both the store read at `:141` and the
`RemoveIndexAndCollapse` depletion at `:178`. The store assignment counts
toward `C`; the reward itself is forced and draws nothing.

### Per-encounter counting at ship wheels

Multi-wheel O ship rooms are the live case for the per-encounter branch of
`CalcRoomRewardStores`. Each wheel's store is stamped when the wheel spawns
(`RoomLogic.lua:1427–1431`) and copied onto the encounter
(`RoomLogic.lua:1465`), so a three-phase ship contributes two counts, not one.
The ship room itself is `NoReward`, so its room-level store never counts; the
room's whole contribution is its encounters'.

### The rolling cursor

`run.NextRewardStoreName` is a cursor, not a record. It is overwritten at every
room start (`RoomLogic.lua:1179`) and again at every wheel spawn
(`RoomLogic.lua:1427`), and consumed by door assignment
(`RoomLogic.lua:3880`). A roll that no door consumes is overwritten before
anything can observe it, so unconsumed rolls have no observable consequence and
the planner models none.

### Spawn-fixed stores

Two rooms receive their store at spawn rather than through door resolution, and
therefore count with a store no door decided:

- `C_Boss01`. The Zagreus contract room is created and bound to its door
  directly (`EventLogic.lua:1888–1893`: `RoomData.C_Boss01`, then `CreateRoom`
  with no second argument, then `AssignRoomToExitDoor`). Because `CreateRoom`
  receives no store, `RunLogic.lua:604–620` supplies one:
  the room's `ForcedRewardStore` if it declares one, else `RunProgress`.
  `RoomDataC` declares none, so `C_Boss01` is `RunProgress` by spawn-time
  default — not by inheritance from its host biome's door.
- The Chaos secret rooms. The secret room is likewise created by `CreateRoom`
  with no store and assigned to the secret door (`RoomLogic.lua:4885`), and
  `RoomDataChaos.lua:160` declares `ForcedRewardStore` `Secrets`. That store has
  one `TrialUpgrade` entry (`LootData.lua:807–812`) and is listed in
  `RewardStoreData.InvalidOverrides` (`LootData.lua:802–805`), so no
  door may ever roll it — it is reachable only as a declaration-forced store.

### Census encoding convention

This is a planner convention, recorded here because the game-data verdict
depends on it. A room's `enteredRewardStoreHistory` kind is load-bearing for
bosses: `resolvedOffer` means the boss door takes an authored store (G, O, P,
Q), `fixed` means the store is pinned (H, I). For non-boss pinned rooms both
`resolvedOffer` plus a pin and `fixed:<key>` appear in the catalog, and the two
are verdict-equivalent — the count and its store are the same either way.
Spawn-built rooms are always `fixed`, since no door resolution runs for them:
this covers the Chaos rooms and `C_Boss01`.

### Biome-intro rewards never count mid-run

Biome-intro rooms natively carry `ForcedRewardStore` `RunProgress` gated by
`RewardGameStateRequirements`. The planner rewrites every non-first biome
start to a history of `none` (`entry-resolution.ts`); this is exact, on two
independent native guards:

- The gate is enforced on every reward path: `ChooseRoomReward` returns `nil`
  whenever the room's `RewardGameStateRequirements` fails
  (`RewardLogic.lua:67`), so no `ChosenRewardType` exists and the room cannot
  count. All six gated intros — `G_Intro`, `H_Intro`, `I_Intro`, `O_Intro`,
  `P_Intro`, `Q_Intro` — declare the identical gate, `IsDreamRun` and
  `EnteredBiomes == 0`, so it passes only for the first biome of a Dream run
  (where the planner's route-first room owns the run-start `RunProgress`
  reward — the same fact).
- Every later Dream biome start is created with `SkipChooseReward = true`
  (`DreamRunLogic.lua:110`), and that branch sets neither `RewardStoreName`
  nor `ChosenRewardType` (`RunLogic.lua:618-622`). This also covers
  `F_Opening01`, which declares no gate at all: F appears mid-run only in a
  later Dream leg, where the skip guards it; on a normal Underworld run its
  opening is the run's first room and counts as the run-start reward. N is
  count-excluded whole-hub regardless.

## Counted Store Inventory

| Store                   | Projected entries | Live use                                                                  | Disposition and notes                                                                                              |
| ----------------------- | ----------------: | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `RunProgress`           |                18 | Ordinary generated rewards, F/G/P free preboss rewards, O wheels, H cages | Exact target. Four Boon entries allow duplicates; all other entries do not                                         |
| `MetaProgress`          |                19 | Ordinary generated rewards and O wheels                                   | Exact native store; a mature bag holds 13 route-filtered entries, see below                                        |
| `HubRewards`            |                10 | N initial combat-room offers                                              | Exact target. Five Boon entries allow duplicates                                                                   |
| `SubRoomRewards`        |                23 | N ordinary side-room offers                                               | Exact current-run target; external elemental unlock is excluded                                                    |
| `SubRoomRewardsHard`    |                 8 | N hard side-room offers                                                   | Exact target                                                                                                       |
| `FieldsOptionalRewards` |                19 | Automatic H optional rewards                                              | Exact persistent bag; generated optionals are independently acquired                                               |
| `TartarusRewards`       |                 9 | I non-goal combat offers                                                  | Exact target under the common external-predicate baseline                                                          |
| `TyphonBossRewards`     |                 6 | Q miniboss offers                                                         | Exact target under the common external-predicate baseline                                                          |
| `Secrets`               |                 1 | Chaos detour                                                              | Raw counted-store replay is excluded; the unified Chaos direct one-entry `TrialUpgrade` normalization is supported |
| `MinorRunProgress`      |                13 | No supported canonical producer                                           | Excluded until a live supported producer requires it                                                               |
| `PreHubRewards`         |                 0 | None                                                                      | Excluded; empty game declaration                                                                                   |
| `FieldsCombatRewards`   |                 0 | None                                                                      | Excluded; empty game declaration                                                                                   |

### RunProgress

The target declaration preserves all 18 entries in game order:

- two each of health, mana, money, Stack, and Hammer;
- one Hermes, Devotion, Spell, and Talent;
- four Boons with `allowDuplicates: true`.

Current-run requirements remain exact: acquired ordinary gods, the
equipped-trait-derived upgradeable count, Hammer history, current active shop
options at the evaluation point, entered biome count, Hermes history, Devotion
depth/spacing/exits, Spell state, and Talent state. External introduction and
unlock gates are excluded. The equipped-trait ledger and its canonical fold are
owned by the trait-offer authority; loot acquisition never increments a shadow
trait counter.

`SpellDropRequirements` also reads `PendingSpellDrop`, but the canonical route
never uses the separately deferred Surface Shop delivery system that sets it.
The value is therefore exactly false in the supported trace. `TalentLegal`
reads `AllSpellInvestedCache`; the planner derives its equivalent from the
installed finite Hex tree's latched closure state. After a writable Path screen
fills the then-current tree, future ordinary Talent generation is unsupported;
committed delivery retains its separately audited settlement path.

### MetaProgress

The raw 19-entry store (`LootData.lua` `RewardStoreData.MetaProgress`) combines
early resources, late resources for the low lifetime-resource tier, and late
large resources for the high tier:

| Entries                                                       | Raw requirement                                                                           |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| one `GiftDrop`                                                | `GiftDropLootRequirements` (a completed run)                                              |
| two `MetaCurrencyDrop`                                        | `EnteredBiomes <= 1`; lifetime Ashes `>= 5`                                               |
| four `MetaCardPointsCommonDrop`                               | `EnteredBiomes <= 1`                                                                      |
| two `MetaCurrencyDrop`                                        | `EnteredBiomes > 1`; lifetime Ashes `>= 5`; lifetime Bones `< 500` or Ashes `< 100`       |
| four `MetaCardPointsCommonDrop`                               | `EnteredBiomes > 1`; lifetime Bones `< 500` or Ashes `< 100`                              |
| two `MetaCurrencyBigDrop`, four `MetaCardPointsCommonBigDrop` | `EnteredBiomes > 1`; lifetime Bones `>= 500` and Ashes `>= 100` (Bones also Ashes `>= 5`) |

The planner declares all nineteen entries with these thresholds over
`resourceGains`. A mature save is past every threshold, so the threshold terms
hold there through a route alternative and the six low-tier late entries carry
`routeKeys: ['FreshFile']`. A mature bag is therefore a route-filtered view of
the native store: its thirteen entries have exactly the eligibility of the
fully progressed save. A fresh profile's bag holds all nineteen, reading the
thresholds from gains accumulated during the attempt, and its Nectar entry is
unavailable.

A fresh bag can exhaust: before 5 Ashes only the four early Ashes entries are
eligible, and below the high tier only the low-tier Bones and Ashes are. The
high tier is reachable within one attempt: a bounded `ChooseNextRewardStore`
probe with generous Buried Treasure, Sea Star and shop Bones choices crossed
100 Ashes and 500 Bones by G's third room. The
planner reproduces the native two-append Heal fallback there; see
[Planner consequence](#planner-consequence).

### Nectar run-progress upgrade

The fully progressed baseline includes
`WorldUpgradeGiftDropRunProgress`. Its effect is not an unconditional property
of the `GiftDrop` acquisition identity:

- `ConsumableData.GiftDrop.RunProgress` replaces the pickup use function with
  `UseStoreRewardRandomStack` only when the constructed item also receives
  `RunProgressUpgradeEligible = true`;
- ordinary room-reward spawning in `RewardLogic.lua` passes that flag, so a
  room-acquired Nectar records the exact `GiftDrop` resource/use acquisition
  and then raises one random Pom-eligible equipped trait by one level when at
  least one exists;
- World Shop spawning in `StoreLogic.lua` does not pass the flag, so purchased
  Nectar records `GiftDrop` but grants no trait level; and
- Echo's `EchoLastReward` recreation path explicitly passes the flag for a
  replayed consumable. `GiftDrop`'s effective `LastRewardEligible` value is
  `true` because the later of its two raw assignments wins, so replayed Nectar
  receives the random `+1` effect as well.

The `RunProgress` override itself is gated on
`GameState.WorldUpgrades.WorldUpgradeGiftDropRunProgress`
(`ConsumableData.lua:1852-1863`). A fresh profile has not bought it, so on the
`FreshFile` route every Nectar, including Fields optional Nectar, is a plain
resource pickup with no level.

Unlike normal `StoreRewardRandomStack` sources, Nectar is not gated by
`StackUpgradeLegal`. `AddStackToTraits` accepts an empty eligible set and simply
performs no mutation. Source-eligible Nectar therefore needs a legal
empty-target outcome; a non-empty target domain still resolves exactly one
target.

The supported model must therefore keep `GiftDrop` as the one concrete
acquisition in reward history and attach the random level mutation at an exact
producer/lifecycle binding. It must not globally add a level effect to the
`GiftDrop` declaration, synthesize a `StoreRewardRandomStack` acquisition, or
infer the effect from whether the UI happens to call an offer a room reward.
Any later producer must declare whether its game creation path supplies the
flag.

### Later-store contents

The later-biome declarations must preserve these concrete multisets:

- `HubRewards`: large health, large mana, Hammer, Hermes, Spell, and five Boon
  entries with duplicates allowed;
- `SubRoomRewards`: one each of small mana, small health, empty small health,
  tiny money, four elemental boosts, and Gift; two each of Bones, Ashes,
  ordinary health, ordinary mana, Stack, money, and Minor Talent;
- `SubRoomRewardsHard`: two each of ordinary health, ordinary mana, Stack, and
  money;
- `FieldsOptionalRewards`: three small mana, three small health, three tiny
  money, one heal, one armor, one Gift, one Bones, four Ashes, and two Minor
  Talents;
- `TartarusRewards`: triple money, triple Stack, two Hammer entries, Devotion,
  large Talent, and three duplicate-permitted Boons;
- `TyphonBossRewards`: two duplicate-permitted Boons, large Talent, triple
  Stack, and two Hammer entries.

Stack, Talent, Hammer, Hermes, Spell, and Devotion retain their applicable
current-run requirement trees. External unlock predicates are excluded under
the common baseline rather than represented as inert requirement kinds.

## Refill Reachability Proof

### Raw rule and proof boundary

`ChooseRoomReward` evaluates one mutable bag for one resolved offer. When no
entry is eligible, it appends the complete base store while retaining every
leftover, increments a call-local refill counter, and recursively evaluates the
same offer. After two unsuccessful appends it returns
`RoomRewardHealDrop`. Eligibility includes the producer's room filter,
so a Boon-only miniboss offer refills a `RunProgress` bag whose Boons are spent
while its other entries remain; the miniboss door need only be shown.

Within one supported picker call, the current-run facts, room filters, and
`previouslyChosenRewards` peer list do not change during recursion. None of the
projected store-entry requirements uses a chance predicate. The second appended
base set therefore has exactly the same eligibility support as the first. It
cannot make an entry eligible when the first complete set contained no eligible
entry; in raw game code it only delays the final Heal fallback.

A call consequently never reaches the second append exactly when every
reachable supported call satisfies this invariant:

```text
if the current bag has no eligible entry,
the complete projected base store has at least one eligible entry
```

This is an offer-support proof, not merely a bag-size comparison. It includes
producer filters, entry requirements, `allowDuplicates`, cross-store duplicate
keys in a shared peer list, and the widest reachable peer scope.

### Supported-store results

| Store                   | Fresh-set eligibility witness                                                                                                                                                                                                                                                       | Consumer pressure                                                                                                                                                                                                                                                                | Result                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `RunProgress`           | Four unconditional `Boon` entries set `AllowDuplicates = true`. Every supported RunProgress producer admits Boon; Boon-only miniboss filters strengthen rather than weaken this witness. Boon source setup separately retries with weaker exclusions and finally no peer exclusion. | H can generate six RunProgress cages in one two-target batch; width is irrelevant because the witness permits duplicate reward types.                                                                                                                                            | First refill always succeeds.                                                           |
| `MetaProgress`          | A mature bag has exactly three eligible identities in either phase: Gift/Bones/Ashes early or Gift/Big Bones/Big Ashes late. A fresh bag can have one (Ashes) or two, so it can exhaust.                                                                                            | G is the maximum with three Meta offers in one peer list. Before the third offer at most two of those identities are blocked. F and P have at most two; an O wheel has at most two and owns a fresh peer list. Supported mixed-store peers do not use a colliding duplicate key. | First refill always succeeds on a mature save; a fresh bag can reach the Heal fallback. |
| `HubRewards`            | Five unconditional `Boon` entries set `AllowDuplicates = true`. The easy-room exclusions for Hammer, Hermes, and the concrete Hephaestus source do not exclude the generic Boon reward entries.                                                                                     | N materializes nine or ten persistent hub offers in one peer list. Width is irrelevant because the witness permits duplicate reward types.                                                                                                                                       | First refill always succeeds.                                                           |
| `SubRoomRewards`        | Even without conditional Stack/Talent entries, ten distinct identities are unconditional: small mana, small health, empty small health, tiny money, Gift, Bones, Ashes, ordinary health, ordinary mana, and ordinary money.                                                         | At most three generated side-room siblings share a peer list, possibly mixing ordinary and hard stores. At most two earlier peers can block two of these identities.                                                                                                             | First refill always succeeds.                                                           |
| `SubRoomRewardsHard`    | Ordinary health, ordinary mana, and ordinary money are three distinct unconditional identities; Stack is additional conditional support.                                                                                                                                            | At most three generated siblings share the mixed side-room peer list. Before the third hard-store offer, at most two earlier peers can block two of the three unconditional identities.                                                                                          | First refill always succeeds.                                                           |
| `FieldsOptionalRewards` | Small mana, small health, tiny money, Heal, Armor, Gift, Bones, and Ashes all have unconditional entries; only Minor Talent is conditional.                                                                                                                                         | Each optional pickup calls the picker without `previouslyChosenRewards`, so optional peers do not duplicate-block one another. The bag persists across calls and the implemented H producer consumes it sequentially at room entry.                                              | First refill always succeeds.                                                           |
| `TartarusRewards`       | Ordinary I combat excludes Boon but retains unconditional triple money. Reprieve also retains triple money. I minibosses admit only the three unconditional duplicate-capable Boon entries.                                                                                         | A two-exit I batch produces at most one Tartarus non-goal peer after its Goal or generated Preboss offer. The witness is valid independently of that bound.                                                                                                                      | First refill always succeeds.                                                           |
| `TyphonBossRewards`     | Two unconditional `Boon` entries set `AllowDuplicates = true`.                                                                                                                                                                                                                      | Q resolves two independently generated miniboss peers in one batch.                                                                                                                                                                                                              | First refill always succeeds.                                                           |

The MetaProgress count refers only to calls that consume the `MetaProgress`
bag. H optional pickups use `FieldsOptionalRewards`, and N side rooms use
`SubRoomRewards` or `SubRoomRewardsHard`; containing meta-resource reward types
does not make either producer a MetaProgress consumer.

### Stores outside the supported proof

| Store                 | Reason it does not weaken the planner invariant                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Secrets`             | Raw counted-store replay remains excluded. The supported unified Chaos projection normalizes its direct one-entry `TrialUpgrade` outcome without replaying the raw store.                                            |
| `MinorRunProgress`    | No supported canonical producer consumes it. A future producer must establish its filters and maximum peer scope before activation.                                                                                  |
| `PreHubRewards`       | The game declaration is empty and has no live supported consumer. N PreHub explicitly uses `RunProgress`. Calling this empty bag would reach the raw fallback and is treated as an invalid producer/store contract.  |
| `FieldsCombatRewards` | The game declaration is empty. H combat rooms are `NoReward`, their old store override is commented out, and cages explicitly use `RunProgress`. Calling this empty bag would be an invalid producer/store contract. |

Shops are ordered entry-generated groups rather than counted bags and never use
the counted-store refill path.

### Planner consequence

The simulator reproduces `ChooseRoomReward` exactly for every store and route:
up to two appended route-filtered base sets without discarding leftovers, then
the `RoomRewardHealDrop` fallback, which keeps both appended sets and draws no
entry. On a mature save every reachable call resolves after zero or one
refill, so the second append and the fallback never occur and mature bags,
picks and domains are unchanged. A fresh profile's MetaProgress bag can reach
the fallback.

This does not remove `RoomRewardHealDrop` as a normal reward identity.
`FieldsOptionalRewards` contains an explicit Heal entry. It is ordinary
counted-store content rather than the picker fallback.

## Boon and Devotion Payloads

The progressed baseline ordinary source domain contains Aphrodite, Apollo,
Ares, Demeter, Hephaestus, Hera, Hestia, Poseidon, and Zeus. Hermes is a
separate reward and does not count toward the ordinary four-source cap.

Several ordinary gods carry LootData `GameStateRequirements`:

- Hestia and Aphrodite require lifetime `GameState.UseRecord` HasAny Poseidon or
  Demeter (`LootData_Hestia.lua`, `LootData_Aphrodite.lua`). Planner
  disposition: declared as each acquisition's `lootRequirement` over the
  derived `lifetimeGodUseRecord`.
- Zeus requires `GameState.TextLinesRecord` `ZeusFirstPickUp`
  (`LootData_Zeus.lua:7-14`).
- Hephaestus requires `UseRecord` Zeus and `CurrentRun.TextLinesRecord` lacking
  `ZeusFirstPickUp` (`LootData_Hephaestus.lua:7-23`).

The Zeus and Hephaestus text-record gates are not declared. A mature file
satisfies them; a closed profile therefore yields a seven-god initial pool where
the game allows three. The Mystery Boon
requirement (`BlindBoxLootRequirements`, `RequirementsData.lua:1218-1232`:
lifetime use of Zeus, Poseidon, Apollo, Demeter, Aphrodite, Hephaestus and
Hestia) is a later consumer of `lifetimeGodUseRecord`.

### Source-support policies

Source support is not payload validation. The `BoonSource` domain only proves
that a value is an ordinary god source; game history and lifecycle determine
whether that source can be resolved at one concrete point. Phase 2.6 therefore
normalizes a closed source-policy registry rather than dispatching on reward
names.

#### Ordinary generated Boon

- The cap check counts the union of sources already acquired in loot history
  and earlier same-batch Boon sources, including unpicked offers.
- Before that union reaches four sources, all eligible ordinary sources are the
  primary pool. At the cap, the primary pool narrows to acquired sources.
- Earlier same-batch Boon sources are then excluded from the primary pool.
- If those exclusions exhaust support, game setup retries with weaker
  exclusions and finally no exclusions. The unrestricted retry recomputes the
  cap without peer sources, so it may restore the full ordinary domain when
  fewer than four sources have actually been acquired. Same-batch source
  uniqueness is therefore strict only while the primary pool remains nonempty.
- Keepsake-forced sources are excluded from the neutral baseline.

This behavior is `Exact` support logic. The planner does not reproduce source
probabilities. The normalized policy is `ordinaryBoonPeer`, resolved at offer
generation.

Ephyra makes the fallback observable in an ordinary door batch. `HubRewards`
contains five duplicate-capable Boon entries, and the miniboss door can add a
sixth Boon from `RunProgress`; all participate in the same peer list while the
board is materialized. With two sources acquired before the Hub, the board can
first represent those sources and two new sources, then use the unrestricted
retry for two further globally eligible sources. Visiting all six Boon rooms
can therefore leave Ephyra with six distinct acquired ordinary sources even
though the ordinary source cap is four.

#### Shop RandomLoot and Blind Box

`RandomLoot` and `BoostedRandomLoot` call `GetEligibleInteractedGod` while shop
inventory is generated. It intersects ordinary eligible gods with lifetime
`GameState.LootPickups` and falls back to every eligible god when the
intersection is empty (`RunLogic.lua:1799-1813`). `LootPickups` is incremented
when an upgrade-screen selection is made (`UpgradeChoiceLogic.lua:1046`), not
when a door is offered. Planner disposition: both shop entries normalize to
`ordinaryInteracted` at offer generation, reading the derived save-file pickup
record; a mature file holds every ordinary god, so its support equals ordinary
eligibility. Their option-entry identities remain distinct for
without-replacement selection.

`BlindBoxLoot` does not resolve its source during shop generation. Purchasing
the box records the box use and then calls ordinary `ChooseLoot` with no peer
exclusion. It uses the same `ordinaryNoPeer` support rule at its authored-source
acquisition role. The different resolution point, not a second source-policy
implementation, expresses the distinction.

### Devotion role and timing

A Devotion offer selects two distinct sources from ordinary god loot already
present in `CurrentRun.LootTypeHistory`. Supported Devotion producers require at
least two acquired ordinary sources, so the raw fallback to a new eligible god
is unreachable under the selected baseline. The `RunProgress` Devotion entry
counts them with `CountOf` over `LootTypeHistory` (`LootData.lua` Devotion
entry; `RequirementsLogic.lua`), which counts distinct present keys, not
pickups: the entry needs boons from two distinct Olympians other than Ares. The
planner declares it as `distinctRecordKeyCount`. The game's `SumOf` is a total
instead; `H_Bridge01` and `H_PreBoss01` use it and keep `recordCount`, and the
remaining 29 `recordCount` declarations were verified against their game
counters. The selection does not apply
ordinary same-batch peer exclusion or re-run the four-source cap over that
already-acquired set. The normalized policy is `devotionAcquiredPair`, resolved
at offer generation.

On entry the player chooses one member before combat and receives the other,
spurned source after combat. The game-generated pair is unordered for planner
support, while the authored payload uses `chosenSource` and `spurnedSource` to
record the player's ordered execution intent. Both orderings of every supported
pair are valid.

Both acquisitions occur before the next room is generated. The ordered roles
remain authored because the game observes them during the room and execution
must reproduce the choice: the selected chosen-source trait folds before
combat, and the spurned-source trait folds after combat. Their exact loot/use
records and equipped-trait state therefore remain distinct even when both
sources are acquired in one room.

## Offer Resolution and Concrete Acquisition

One string alias cannot connect a store entry directly to history. Store-entry
identity, resolved-offer identity, concrete acquisition identity, acquisition
timing, and history projection are separately observable. The game writes
distinct loot, run-use, and biome-use ledgers, and one offer can produce zero,
one, or multiple concrete acquisitions.

The write boundary confirms the distinction. `RecordUse` indexes global,
current-run, biome, and current-room use records by the concrete used object's
name. `HandleLootPickup` separately indexes `LootTypeHistory` and
`LootBiomeRecord` by the concrete loot object's name. A `Boon` store entry is
therefore not written to loot history as `Boon`; after offer resolution, the
picked-up source such as `ApolloUpgrade` is the observed loot identity.
No script reads `LootBiomeRecord`: it is initialized by `RunStateInit`,
written by `HandleLootPickup` (`InteractLogic.lua:718`) and reset by
`EndBiomeRecords` (`RunLogic.lua:399, 1913`), so nothing installs it into a
fresh run.

Phase 2.6 must normalize the following distinct declarations or derived
records:

- counted store entries with reward type, requirements, multiplicity, and
  duplicate policy;
- resolved reward offers retaining both reward type and complete payload;
- reward-type acquisition roles with typed identity resolution from the
  complete offer;
- producer and encounter lifecycle bindings for those roles at explicit
  points;
- concrete acquisition declarations with zero or more typed history writes.

The complete role-resolution families are:

| Producer                       | Store/option identity | Resolved offer                                         | Concrete acquisition timing and identity                                                                                                            | Disposition                                                                 |
| ------------------------------ | --------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Ordinary `Boon`                | `Boon`                | `Boon` plus visible source                             | acquire the concrete source, such as `ApolloUpgrade`, on room-reward pickup                                                                         | Exact                                                                       |
| `Devotion`                     | `Devotion`            | chosen and spurned source roles                        | acquire chosen source before combat, then spurned source after combat                                                                               | Exact roles and concrete trait lifecycle                                    |
| `Story`                        | fixed `Story`         | structural Story offer                                 | no concrete acquisition                                                                                                                             | Exact                                                                       |
| Structural `Shop`              | fixed `Shop`          | structural Shop offer                                  | no incoming acquisition; entered shop creates option offers                                                                                         | Exact                                                                       |
| `ClockworkGoal`                | fixed goal marker     | structural Clockwork Goal                              | decrement goal counter on entered spawn; no ordinary concrete acquisition                                                                           | Exact                                                                       |
| `WeaponUpgradeDrop` shop offer | wrapper option        | `WeaponUpgradeDrop`                                    | acquire concrete `WeaponUpgrade` on purchase                                                                                                        | Exact                                                                       |
| `ShopHermesUpgrade`            | wrapper option        | `ShopHermesUpgrade`                                    | acquire concrete `HermesUpgrade` on purchase                                                                                                        | Exact; wrapper identity remains relevant to active shop-option requirements |
| `RandomLoot` / boosted variant | distinct option entry | `RandomLoot` plus source resolved at generation        | acquire that concrete source on purchase                                                                                                            | Exact support; rarity detail deferred                                       |
| `BlindBoxLoot`                 | `BlindBoxLoot`        | type-only Shop inventory; hidden source at acquisition | record the box, then validate/acquire that source after purchase                                                                                    | Exact target; source support and authorship are acquisition-time            |
| Big/Triple/resource variants   | concrete variant      | same exact visible variant                             | acquire and preserve that variant's exact game-history identity                                                                                     | Exact                                                                       |
| `StoreRewardRandomStack`       | wrapper option        | visible random-Stack wrapper                           | preserve concrete wrapper acquisition/history and apply one random `+1` Pom mutation                                                                | Exact                                                                       |
| source-eligible `GiftDrop`     | exact Nectar identity | same `GiftDrop`; no wrapper alias                      | preserve `GiftDrop` acquisition/history and attempt one random `+1` Pom mutation only at opted-in producer bindings; empty support is a valid no-op | Exact within the progressed baseline                                        |

An optional semantic-effect alias may later help trait/resource simulation, but
it must not replace the concrete acquisition identity used by requirements.

### Exhaustive concrete acquisition registry

The supported reward surface uses two history projection profiles, independent
of acquisition kind. Every identity in this table is exact and exhaustive for
the Phase 2.6 store/shop inventory.

| Acquisition kind | History projection | Concrete acquisition identities                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `loot`           | `lootAndUse`       | `AphroditeUpgrade`, `ApolloUpgrade`, `AresUpgrade`, `DemeterUpgrade`, `HephaestusUpgrade`, `HeraUpgrade`, `HestiaUpgrade`, `PoseidonUpgrade`, `ZeusUpgrade`, `HermesUpgrade`, `StackUpgrade`, `StackUpgradeBig`, `StackUpgradeTriple`, `WeaponUpgrade`                                                                                                                                                                                                                                           |
| `loot`           | `consumableAndUse` | `SpellDrop`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `consumable`     | `consumableAndUse` | `MaxHealthDrop`, `MaxHealthDropBig`, `MaxHealthDropSmall`, `EmptyMaxHealthSmallDrop`, `MaxManaDrop`, `MaxManaDropBig`, `MaxManaDropSmall`, `Currency`, `RoomMoneyDrop`, `RoomMoneyTripleDrop`, `RoomMoneyTinyDrop`, `TalentDrop`, `TalentBigDrop`, `MinorTalentDrop`, `RoomRewardHealDrop`, `HealBigDrop`, `ArmorBoost`, `ArmorBigBoost`, `AirBoost`, `EarthBoost`, `FireBoost`, `WaterBoost`, `ElementalBoost`, `StoreRewardRandomStack`, `LastStandDrop`, `ChaosWeaponUpgrade`, `BlindBoxLoot` |
| `resource`       | `consumableAndUse` | `GiftDrop`, `MetaCurrencyDrop`, `MetaCurrencyBigDrop`, `MetaCardPointsCommonDrop`, `MetaCardPointsCommonBigDrop`, `WeaponPointsRareDrop`, `CardUpgradePointsDrop`, `CharonPointsDrop`                                                                                                                                                                                                                                                                                                            |

`lootAndUse` increments exact-name current-run use, biome-use, current-room use,
loot-type, and loot-biome records. `consumableAndUse` increments exact-name
current-run use, biome-use, current-room use, and consumable records. The
generic interaction path and `ManualRecordUse` split decide who calls
`RecordUse`, but supported acquisitions still write it exactly once.

`SpellDrop` is the intentional cross-kind exception. Although it is declared in
LootData and remains a `loot` acquisition, its custom spell-screen flow calls
`RecordConsumableItem` and does not pass through `HandleLootPickup`; therefore
it does not write loot histories. Resource pickups use the consumable history
path while retaining `resource` kind. Quantities follow
[Resource quantities](#resource-quantities); affordability remains deferred. Persistent `GameState.UseRecord` is derived
only as lifetime use for ordinary gods; the table is exact for current-run history.

The role registry composes those concrete identities as follows:

- direct loot, consumable, and resource reward types use one `self` role;
- `Boon` uses one `payloadSource` role targeting its authored `BoonSource`;
- Devotion uses ordered `payloadSource` roles targeting `chosenSource` before
  combat and `spurnedSource` after combat;
- `RandomLoot` and the distinct `BoostedRandomLoot` shop entry both resolve one
  `RandomLoot` offer with an authored source at shop generation and acquire that
  source on purchase; the supporting entry remains derived witness provenance;
- `WeaponUpgradeDrop` uses a fixed `WeaponUpgrade` loot role;
- `ShopHermesUpgrade` uses a fixed `HermesUpgrade` loot role;
- `BlindBoxLoot` uses a self `BlindBoxLoot` consumable role on purchase followed
  by an authored-source loot role validated after unwrap;
- `Story` and structural `Shop` have no acquisition roles;
- `ClockworkGoal` has no concrete acquisition role and decrements the goal
  counter through its entered-spawn structural lifecycle;
- `StoreRewardRandomStack`, Big/Triple drops, and every resource variant remain
  exact self identities. They never project a related base name. A
  source-eligible `GiftDrop` still writes only `GiftDrop`; its separate level
  mutation does not alias that acquisition to `StoreRewardRandomStack`.

Ordinary god-source loot updates the acquired-source set and reaches its
authored concrete trait offer at the declared acquisition role. Hermes remains
outside the ordinary-god source set. Other resource, health, mana, armor, Last
Stand, and weapon mutation effects retain their documented simplified or
deferred dispositions rather than entering an untyped semantic-effect bag.

The registry intentionally omits raw `Secrets` counted-store replay while
supporting the unified Chaos direct one-entry `TrialUpgrade` normalization. It
also omits `ElementalBoost`, whose I/Q shop entry is Dream-only. The four
individual elemental boosts remain supported through N side-room rewards even
though their ordinary World Shop entries are also Dream-only. The commented
Devotion block inside `HubRewards` is not a live store entry.

### Resource quantities

`ConsumableData.lua` declares `AddResources`: `MetaCardPointsCommonDrop` 5 and
`MetaCardPointsCommonBigDrop` 10 Ashes (`MetaCardPointsCommon`);
`MetaCurrencyDrop` 50 and `MetaCurrencyBigDrop` 100 Bones (`MetaCurrency`);
`MemPointsCommonDrop` 10 Psyche (`MemPointsCommon`, `ConsumableData.lua:1621`).
Narcissus's Ashes drop overrides it to 10 (`TraitData_Narcissus.lua`).

`InteractLogic.lua:ApplyConsumableItemResourceMultiplier` scales each amount
when the object is created: equipped `RoomRewardBonus` values add their excess
over one, and each object rounds once with `UtilityLogic.round`
(`floor(v + 0.5)`). Room rewards (`SpawnRoomReward`), Fields cages and
optionals (spawned at room setup), World Shop items and Gold duplicates
(`StoreLogic.lua`), Echo's replay and `GiveRandomConsumables` producers call
it. `NPCDrop` objects skip the bonus. `NPCRewardDrop` consumables (Nemesis
events), Stygian Well trades (`TradeLogic.lua:215`) and Eris's gifts set it:
G 20 Ashes (`RoomDataG.lua:1365-1375`), H 50 Psyche (`RoomDataH.lua:573-581`)
and I 300 Bones (`RoomDataI.lua:527-535`), each also `CanDuplicate = false` and
`MetaConversionEligible = false`. `ShrinePresentation.lua:600-608` drops the
gift when her curse applies; it is a room-required pickup because
`NotRequiredPickup` stays commented out (`RoomLogic.lua:1983`).

Buried Treasure (`TraitData_Poseidon.lua:RoomRewardBonusBoon`) declares base
1.5 for Ashes, Psyche and Bones with `SourceIsMultiplier`; its rarity
multipliers 1/1.5/2/2.5 scale the excess, giving 1.5/1.75/2/2.25. Five Ashes
become 8/9/10/11 and ten become 15/18/20/23. Its own Bones gift spawns after
the trait is equipped and is scaled.

`UseConsumableItem` grants the stored amount through `AddResource`, which adds
to `LifetimeResourcesGained` at once. A Double Up proc retains the same object,
so the second pickup grants the same rounded amount (8 + 8, never
round(10 × 1.5)); a bonus gained after the object spawned never changes it.
Spending leaves lifetime gains untouched.

Planner disposition: concrete acquisitions declare `resourceGrant`, producer
lifecycles declare `resourceBonusExempt` and `resourceGrantOverrides`, and the
trait declares a rarity-resolved `resourceRewardBonus`. Only Ashes and Bones
are tracked; Psyche has no consumer and is untracked, not zero. Stygian Well
resource items grant a random range and are not credited. Eris's gifts use
the `ErisCursePickup` producer: bonus-exempt, its `duplicationExempt` blocks
Sea Star, and its bindings block Artificer; H's Psyche gift is a required
pickup that declares no amount.

## Shops

Shops are entry-generated option groups, not counted bags. Every group filters
its options by requirements and chooses its declared number of offers without
replacement. Positive weights affect probability only and may be omitted from
the possibility model; group membership, offer count, requirements, and
without-replacement support are semantic.

| Profile       | Game groups | Offers | Route use                                                   | Target disposition        |
| ------------- | ----------: | -----: | ----------------------------------------------------------- | ------------------------- |
| `WorldShop`   |           3 |      3 | F/G/P/N midshops and preboss shops                          | Exact structural support  |
| `I_WorldShop` |           5 |      5 | Entered I preboss                                           | Exact second-half support |
| `Q_WorldShop` |           5 |      6 | Entered Q preboss; first group produces two distinct offers | Exact second-half support |

The catalog represents ordered groups, `offerCount`, per-option requirements
and payload rules, with a complete authored slot for every offer emitted by
the group. Two offers from one group are distinct authored
slots and cannot select the same option entry.

### Persistent hub-offer exclusions

`RoomDataN.lua:1190` invokes `UpdateHubRewardLookup` on hub departure.
`RoomLogic.lua:5625` unions all offered board reward types into
`CurrentRun.HubRewardLookup`, regardless of visitation or acquisition. The
lookup survives biome transitions; no in-run reset was found. New-run
initialization replaces `CurrentRun`. Closed doors contribute no offered type.

| Inventory entry                          | Excluded lookup type  | Source                                                    |
| ---------------------------------------- | --------------------- | --------------------------------------------------------- |
| `SurfaceShop` Spell (all Hermes shrines) | `SpellDrop`           | `StoreData.lua:143–173`                                   |
| `WorldShop` Spell                        | `SpellDrop`           | `StoreData.lua:280–303`                                   |
| `WorldShop` early Hammer                 | `WeaponUpgrade`       | `StoreData.lua:231–245`                                   |
| `I_WorldShop` early Hammer               | `WeaponUpgrade`       | `StoreData.lua:371–382`                                   |
| `Q_WorldShop` early Hammer               | `WeaponUpgrade`       | `StoreData.lua:506–517`                                   |
| Late Hammer entries                      | None from this lookup | `StoreData.lua:247–257`; `RequirementsData.lua:1261–1296` |
| I/Q Spell entries                        | None from this lookup | `StoreData.lua:349,473`                                   |

The late Hammer path still requires a third-or-later entered biome and exactly
one acquired Hammer. Reaching biome three alone does not restore Hammer
eligibility. These entry requirements bind only room and Shop generation:
Reward Reward Reward (`EchoLastReward`, `EventLogic.lua:1537–1560`) recreates
an earlier Hammer pickup and Gold Gold Gold (`EchoDoubleShop`) duplicates a
purchased Shop Hammer without consulting them, so either can grant a third
Hammer. The lookup's native `WeaponUpgrade` identity differs from the
shop wrapper `WeaponUpgradeDrop`. Generic Spell/Hammer reward requirements do
not impose these source-specific exclusions on other reward producers.

Planner disposition: exact entry-owned requirements, conjoined with existing
rules for initial inventory and Travel Deal generation. The simulation publishes
the completed board's contribution chronologically and carries it across route
biomes, including reordered Dream routes. Invalid authored offers remain
repairable; they are not replaced automatically.

### Transition-offered rewards and the ordinary WorldShop Spell entry

Separate from the run-persistent hub lookup, the game keeps a per-map offered
reward set. `RoomLogic.lua:4013–4026` rebuilds `MapState.OfferedRewards` when a
room's exits unlock, from every door in `MapState.OfferedExitDoors` — the
chosen reward type and the cage reward identities of each offered room, with
selection playing no part. `RoomLogic.lua:4391–4394` runs shop generation for
the next room immediately after `CurrentRun.CurrentRoom` changes and before the
next map loads, so the previous map's set is the set that generation reads, and
`MapStateInit` (`RoomLogic.lua:295–310`) then wipes it. Exactly one inventory
entry in the game data consults it: the ordinary `WorldShop` Spell entry
requires `MapState.OfferedRewards.SpellDrop` absent (`StoreData.lua:290`).
`SurfaceShop` Spell and the `I_WorldShop`/`Q_WorldShop`
`SpellDropRequirements` entries carry no such clause. Dynamic restock
(`StoreLogic.lua:417`) re-runs entry filtering while the player is in the room,
after that room's own exits rebuilt the set, so a shop's own outgoing Spell
Drop can constrain a restock but never that shop's initial inventory.

Two bounded gaps in the planner's published set, both currently inert:

- Additional-exit doors. Native registers the Chaos gate
  (`RoomLogic.lua:4886`) and the Zagreus contract door (`EventLogic.lua:1893`)
  through `AssignRoomToExitDoor` before the rebuild, so their rooms' reward
  identities enter the native set. The planner's publish reads the generated
  batch only; additional continuations are created at parent entry and are not
  included. No such room carries `SpellDrop`, so no current output differs.
- Hub-origin generations and fixed room links. Hub board and local-visit
  generations and the persistent-hub handoff publish nothing (the hub board
  owns the run-persistent lookup with its own lifetime), and declaration-fixed
  links reach their target without an offered door batch. The only hub-progression
  WorldShop is reached by the single-target handoff, whose Ephyra board offers
  are already excluded through the persistent hub lookup.

Planner disposition: a transient `offeredRewardTypes` substate on the branch
state, published once when the arriving batch's last target completes
generation, cleared at room entry, and consumed only through the
entry-declared `offeredRewardExcludes` requirement on the ordinary `WorldShop`
Spell entry. Inventory validation, candidates and Travel Deal generation read
the same facts at their own contacts.

### Ordinary WorldShop groups

| Group | Offers | Supported options under the baseline                                              | Modeled current-run conditions                                                               |
| ----- | -----: | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1     |      1 | `RandomLoot`, `BlindBoxLoot`, `ShopHermesUpgrade`                                 | Hermes biome-use and route loot history; Blind Box's external unlock is excluded             |
| 2     |      1 | two distinct `WeaponUpgradeDrop` entries, heal, health, armor, Ashes, Bones, Gift | Hammer early/late history and current shop exclusion; external armor/Gift gates are excluded |
| 3     |      1 | mana, Stack, random Stack, Spell, Talent                                          | upgradeable trait count, Spell/Talent run state, and current shop exclusion                  |

The two Hammer entries keep distinct keys and requirements even though both
author the same resolved-offer identity.

### I and Q second-half groups

Normal route order guarantees that I and Q preboss shops use their second-half
branches. Internal reordered itineraries resolve the appropriate first/second
half from the acquisition ordinal. The complete phase-sensitive matrices
are owned by the focused
[`../rooms-and-routes/I_Q_WORLD_SHOP_PHASE_GAME_DATA_AUDIT.md`](../rooms-and-routes/I_Q_WORLD_SHOP_PHASE_GAME_DATA_AUDIT.md).

`I_WorldShop` emits one offer from each group:

1. boosted random Boon or large Stack;
2. random Boon, Blind Box, health, mana, Stack, Talent, or Spell;
3. large heal, large armor, or Last Stand;
4. shop Hermes, Chaos weapon upgrade, boosted random Boon, large health, or
   large mana;
5. `WeaponPointsRareDrop`, `CardUpgradePointsDrop`, or `CharonPointsDrop` under
   the fully progressed baseline.

`Q_WorldShop` emits two distinct offers from group 1 and one from every later
group:

1. boosted random Boon, large Stack, random Boon, Blind Box, health, mana,
   Talent, or Spell;
2. large heal or large armor;
3. large heal, large armor, or Last Stand;
4. shop Hermes, Chaos weapon upgrade, boosted random Boon, large health, or
   large mana;
5. `WeaponPointsRareDrop`, `CardUpgradePointsDrop`, or `CharonPointsDrop` under
   the fully progressed baseline.

Spell, Talent, Stack, Hermes, and Chaos weapon upgrade keep their current-run
requirements. The Chaos option requires an acquired Hammer. Last Stand requires
a missing use at both generation and purchase. Because exact Last Stand combat
loss and inventory are deferred, v1 treats an authored Last Stand offer or
purchase as a possible valid-use outcome rather than deriving that inventory.
This is a named `Simplified` support expansion, not an unconditional option in
the exact game model.

Shop inventory generation occurs during transition into the room, before its
outgoing doors are generated. The Shop noncombat encounter then initiates exit
generation before ordinary player purchases. Consequently Hammer, Hermes,
Spell, and Talent `RequiredNotInStore` checks used by that outgoing generation
observe the complete generated inventory, not a post-purchase remainder. The
requirement kind should be `notInCurrentRoomShopOptions` rather than implying a
counted bag.

Purchases later remove items and update acquisition history, but the outgoing
rooms and rewards are already materialized and are not revalidated. A shop
Boon can therefore introduce a fourth ordinary source after the same shop's
outgoing batch already offered a fifth source. The purchase first affects room
generation at the selected next room's outgoing-generation checkpoint. The
canonical profile and source-backed fixture are specified in
`../design/ROOM_LIFECYCLE_MODEL.md`.

Exact money, health, last-stand inventory, prices, discounts, and affordability
are `Deferred`. V1 authors one exact order of offered options purchased under a
sufficient-resource and valid-use assumption. This preserves acquisition and
outgoing-door consequences but may admit a purchase that one concrete resource
state could not afford. The Last Stand support expansion above is separately
`Simplified` because its missing-inventory condition controls generation as
well as purchase.

The exact occurrence-owned `roomActions.order` is the authored chronology.
Initial Shop purchase participation is the presence of its exact
`interactShopOffer` reference; sparse acquisition sites retain payloads only.
A Blind Box persists its intended eventual source in authored payload while
keeping that source game-hidden and semantically dormant until purchase. An
earlier purchased Boon can change whether the authored source is then possible.
Possibility simulation validates the authored order and hidden source only in
that order; it retains reward-source branches but never retries another
permutation. World Shop rerolls remain outside the plan.

### Prices

Script root is `Content/Scripts`.

- **Multiplier.** `GetShopCostMultiplier` (`StoreLogic.lua:678-686`) is
  `Vow × V`, or `Vow × (V − (1 − FirstPurchaseDiscount))` while the room's
  `FirstPurchase` flag is unset and Travel Deal is held. `Vow` is
  `ShopPricesShrineUpgrade` `ChangeValue` 1.4 / 1.8 by rank
  (`MetaUpgradeData.lua:1650-1671`, inactive 1.0). `V` is the product of held
  `StoreCostMultiplier` traits; only the Ferry Voucher declares one, 0.7
  (`TraitData_Store.lua:323-346`). Travel Deal's `FirstPurchaseDiscount` is
  `0.95` with `SourceIsMultiplier` rarity scaling 1-4
  (`TraitData_Hermes.lua:581-618`), held rounded to the percent
  (`ProcessValue`, `TraitLogic.lua`), so 5/10/15/20% by rarity. Grepping
  `StoreCostMultiplier`, `FirstPurchaseDiscount`, `ShopPrices`,
  `CostMultiplier`, `PriceMultiplier`, `Discount` and `CostOverride` finds no
  other modifier; `IgnoreCostIncrease` and `CostIncreasePerStack` are read but
  no data sets them.
- **Rounding.** `round` is `floor(x + 0.5)` (`UtilityLogic.lua:732-735`).
  World items price `round(cost × M)` once at spawn
  (`InteractLogic.lua:878-891`). Every store purchase sets `FirstPurchase`
  (`RemoveStoreItem`, `StoreLogic.lua:353-356`); under Travel Deal the
  remaining items reprice from `OriginalResourceCosts` (`StoreLogic.lua:385-396`),
  and acquiring Travel Deal reprices them too (`UpdateStoreItemCostText`).
- **Base prices.** An option costs its item's `ResourceCosts.Money`
  (`ConsumableData.lua`, `LootData_Selene.lua:39` for `SpellDrop`) unless its
  StoreData entry sets `Cost`, passed as `CostOverride`
  (`StoreLogic.lua:202-204`). Random and boosted Boons take
  `ConsumableData.RandomLoot`/`BoostedRandomLoot` costs.

| Option                                                       |         Base | Source                                 |
| ------------------------------------------------------------ | -----------: | -------------------------------------- |
| `RandomLoot` / `BoostedRandomLoot`                           |    150 / 450 | ConsumableData                         |
| `BlindBoxLoot`                                               |          125 | ConsumableData                         |
| `ShopHermesUpgrade`                                          |          150 | ConsumableData; I/Q entry `Cost = 500` |
| `WeaponUpgradeDrop`                                          |          200 | ConsumableData                         |
| `RoomRewardHealDrop` / `HealBigDrop`                         |      50 / 90 | ConsumableData                         |
| `MaxHealthDrop` / `MaxHealthDropBig`                         |    125 / 250 | ConsumableData                         |
| `MaxManaDrop` / `MaxManaDropBig`                             |    100 / 200 | ConsumableData                         |
| `ArmorBoost` / `ArmorBigBoost`                               |      40 / 80 | ConsumableData                         |
| Dream element boosts / `ElementalBoost`                      |      20 / 40 | ConsumableData                         |
| `MetaCardPointsCommonDrop` / `MetaCurrencyDrop` / `GiftDrop` | 50 / 90 / 75 | ConsumableData                         |
| `TalentDrop` / `SpellDrop`                                   |     60 / 100 | ConsumableData / LootData_Selene       |
| `LastStandDrop`                                              |          200 | ConsumableData; I/Q entry `Cost = 200` |
| `StackUpgrade` / `StackUpgradeBig`                           |    100 / 300 | StoreData entry `Cost`                 |
| `StoreRewardRandomStack`                                     |           50 | StoreData entry `Cost`                 |
| `ChaosWeaponUpgrade`                                         |          650 | StoreData entry `Cost`                 |
| `WeaponPointsRareDrop` / `CardUpgradePointsDrop`             |  1300 / 1000 | StoreData entry `Cost`                 |
| `CharonPointsDrop`                                           |          600 | ConsumableData                         |

I/Q `ShopHermesUpgrade` also sets `UpgradeChance = 1.0` with
`UpgradedCost = 500`, so it is always boosted at 500
(`StoreLogic.lua:213-217`). The Contract pedestal (`ZagPedestalOptions`) and
the Echo duplicate cost nothing (`EventLogic.lua:1912`). Well and Shrine
prices are in the
[room-feature audit](../room-features/ROOM_FEATURES_GAME_DATA_AUDIT.md).

### Gold sources

Script root is `Content/Scripts`. Gold the run gains or loses outside shop
purchases, as the gold ledger counts it.

- **Money multiplier.** `GetTotalHeroTraitValue("MoneyMultiplier", IsMultiplier)`
  is one plus each held trait's excess over one (`TraitLogic.lua:372-396`).
  Quick Buck `MoneyMultiplier` 1.2 is `SourceIsMultiplier` by 1 / 1.5 / 2 /
  2.5: 1.2 / 1.3 / 1.4 / 1.5 (`TraitData_Hermes.lua:154-215`). Chaos
  Affluence adds its rolled `MoneyMultiplier` (`TraitData_Chaos.lua:220-258`),
  authored as the blessing's value.
- **Money pickups.** `ApplyConsumableItemResourceMultiplier` sets `DropMoney`
  to `round(DropMoney × (1 + (Σ − 1) + (MoneyRewardBonus − 1)))`; an
  `NPCDrop` forces the bonus to 1 (`InteractLogic.lua:916-965`); pickup adds it
  unchanged (`InteractLogic.lua:1077`). `DropMoney`: Tiny 20, Small 50, normal
  100, Triple 300 (`ConsumableData.lua:334-390`). Buried Treasure's
  `MoneyRewardBonus` 1.5 by 1 / 1.5 / 2 / 2.5 is 1.5 / 1.75 / 2 / 2.25
  (`TraitData_Poseidon.lua:2058-2190`). Quick Buck drops one normal and Buried
  Treasure one Small and two Tiny money pickups, multiplied like any other.
  The value is fixed when the object spawns. Coins a trait's
  `GiveRandomConsumables` drops (Quick Buck's, Buried Treasure's, Narcissus's
  and fallback gold) spawn with `NotRequiredPickup`, outside
  `MapState.RoomRequiredObjects`, valued at that moment
  (`RoomLogic.lua:1944-1985`). Acquiring a `MoneyMultiplier` trait multiplies
  every uncollected object in `MapState.RoomRequiredObjects` and
  `MapState.OptionalRewards` (room rewards, Fields cages and optionals) by its
  own value, `round(DropMoney × MoneyMultiplier)` per trait
  (`TraitLogic.lua:1045-1058`); a later money-reward bonus does not.
- **Σ-only gold.** Narcissus's Precious Metals `Amount` 100 by 1 / 1 / 1.5 /
  2.5 (`TraitData_Narcissus.lua:208-262`), fallback gold 90
  (`TraitData.lua:1147-1175`, `UpgradeChoiceLogic.lua:149-151`) and a Gold
  Purse equipped mid-run (`KeepsakeLogic.lua:1209-1210, 1365-1366`) or repeated
  by Echo at Common (`RoomLogic.lua:1237`) pay `round(gold × Σ)`. Gold Purse
  `BonusMoney` is 100 / 125 / 150 / 200 by rank
  (`TraitData_Keepsake.lua:683-715`).
- **Time Piece.** `GetRewardGoldifyValue` pays `round((GoldifyValue or 100,
+150 with AddBoostedAnimation) × Σ)` (`PowersLogic.lua:6733-6749`). A boon
  is 400, Hammer and Spell 500, Pom 300 / 400 / 500, heart and Magick drops
  150-400, Talents 200-400, Last Stand 400, armor 200, Meta rewards 200,
  consolation 150 (`ConsumableData.lua`, `LootData.lua`,
  `LootData_Selene.lua`). `CreateLoot` sets `AddBoostedAnimation` on loot
  spawned in a room with `BoonRaritiesOverride` (`RoomLogic.lua:2145-2147,
2266`): the Mini-Boss rooms of every biome (for example
  `RoomDataF.lua:1058`). Such loot has no cost, so Time Piece can convert it
  with the bonus. `BoostedBoonValueAddition` is unread.
- **Unmultiplied gold.** `CalculateStartingMoney` sums the Boatman Arcana's and
  a starting Gold Purse's `BonusMoney` (`RunLogic.lua:41-42, 481, 514`); the
  Boatman's is 200 / 250 / 300 / 350 by rarity
  (`TraitData_MetaUpgrade.lua:274-310`), and a mid-run grant or upgrade pays
  it or its difference (`MetaUpgradeLogic.lua:597-608`). Personal Loan spends
  all held gold into `StoredGold` with `ReturnGold` 300 / 400 / 500 / 600
  (`PowersLogic.lua:1717-1731`, `TraitData_Dionysus.lua:494-546`) and pays it
  at the next boss while `EnteredBiomes < 4` (`CombatLogic.lua:3953-3965`).
  A Pool sale pays `floor(RandomInt(min, max) / 5) × 5` plus 20 per level
  above the first (`SellTraitData.lua:172-187`, `SellTraitLogic.lua:443-468`).
- **Price of Midas** pays `round(PayoutPerHealthPoint × HealthCost)`, with
  `HealthCost` 10-30 and `PayoutPerHealthPoint` 1.1-1.8 rolled and rounded
  (`ConsumableData.lua:1329-1347`, `InteractLogic.lua:1233-1238`), then the
  money-pickup formula.
- **Nemesis.** A Nemesis trade costs `RandomInt(CostResourceMin,
CostResourceMax)`: heart 105-130 / 230-255, Magick 80-105 / 180-205, Pom
  80-105 / 280-305, Hammer 180-205 (`NPCData.lua:5560-5650`,
  `TradeLogic.lua:21, 196-197`). Nemesis combat F, G, H and I
  (`EncounterData_Nemesis.lua:3-53`) bet `min(100, held)` on kills; a win
  pays `round(bet × Σ)`, a loss takes the bet and a tie pays nothing
  (`InteractLogic.lua:545-590`); `BlockMoney` stops only the win. The ledger
  reads the authored outcome, a win when absent.
- **Pauper's** (`ChaosNoMoneyCurse`, `TraitData_Chaos.lua:756-760`) sets
  `BlockMoney`. Every coin collected through `DropMoney` → `UseMoneyDrop`
  pays nothing (`RoomLogic.lua:2602-2652`). That covers every gushed amount
  (`GushMoney`, `InteractLogic.lua:1154-1174`):
  - a money pickup, whose `DropMoney` gushes unless its `DropMoneyDelay` is 0
    (`InteractLogic.lua:1075-1084`; only `DamageSelfDrop` sets 0), Heracles's
    bounty `RoomMoneyDrop` (`EnemyAILogic.lua:5332-5336`) and an NPC's drop
    (`InteractLogic.lua:529-530`);
  - Wealth from the Dead's `MedeaMoneyTinyDrop` (`CombatLogic.lua:4263-4275`);
  - the `Currency` coins of Narcissus and fallback gold
    (`GiveRandomConsumables`, `RoomLogic.lua:2002-2007`);
  - a Personal Loan's payback, whose stored gold is cleared all the same
    (`CombatLogic.lua:3956-3965`).

  Kill and urn drops stop in `CheckMoneyDrop` (`RoomLogic.lua:2354`). The
  Midas payout is zeroed when its Well item is ramped
  (`InteractLogic.lua:1233-1235`), Time Piece in `GetRewardGoldifyValue`
  (`PowersLogic.lua:6741`), the bet win (`InteractLogic.lua:578`), a Pool sale
  in `GetTraitValue` (`SellTraitLogic.lua:457`) and Arcana gold
  (`MetaUpgradeLogic.lua:599-606`). A Gold Purse equipped or repeated by Echo
  pays through `AddResource`, which does not check it
  (`KeepsakeLogic.lua:1209-1210, 1365-1366`). Spending (a loan's take, a
  Nemesis trade, a lost bet) is unaffected.

- **Enemy kills.** A kill with a positive `MoneyDropOnDeath.Chance` pays one
  parcel of `RandomInt(MinValue, MaxValue)` times
  `(enemy MoneyMultiplier) + (Σ − 1)`, rounded, at least 1, while the encounter's
  [store](../loadout-and-progression/RUN_MODIFIERS_GAME_DATA_AUDIT.md#encounter-gold-budget)
  is positive, deducting it; without a store, a parcel rounding to 0 drops
  nothing (`RoomLogic.lua:2340-2395`). Unit setup replaces a positive
  `ValuePerDifficulty`'s bounds with `ValuePerDifficulty × DifficultyRating`
  and that times `ValuePerDifficultyMaxValueVariance` (1.3), from the unit's
  own `GeneratorData` (`RoomLogic.lua:3440-3447`). The products are rarely
  whole; the planner takes the engine binding's integer conversion to
  truncate them (a bounded unknown of at most one gold per parcel). The
  parcel loop spends a parcel budget of `RandomInt(MinParcels, MaxParcels)`
  gold, not parcels, so with both 1 every kill drops one parcel. No modelled
  enemy sets `MoneyMultiplier` outside Dream-run overrides.
  - `MoneyDropOnDeath` resolves through `InheritFrom` like any enemy field: an
    enemy's own table replaces the inherited one whole, parents in listed
    order (`RunData.lua:1363-1405`). `BaseVulnerableEnemy` gives Chance 0.7
    and value per difficulty 0.33 (`EnemyData.lua:166-176`); `BaseOEnemy`
    0.125, `BasePEnemy` 0.035 and `BaseQEnemy` 0.16
    (`EnemyData.lua:895-905, 960-970, 1025-1035`). Own tables: Guard (0.25,
    which Guard2 inherits; `EnemyData_Guard.lua:47`), Turtle (0.2;
    `EnemyData_Turtle.lua:55`), FogEmitter2 (0.15;
    `EnemyData_FogEmitter.lua:180`), Lycanthrope_Elite (0.225;
    `EnemyData_Lycanthrope.lua:126`), FishSwarmer (0.25, 0.33;
    `EnemyData_FishSwarmer.lua:59`), Carrion (0.25, 0.2), Mudman (0.125),
    Zombie (0.25, 0.17), ZombieSpawner (0.1), ZombieHeavyRanged (0.125),
    ZombieAssassin (0.1), Scimiterror (0.4, 0.05) and WaterElemental (0.2,
    0.075) (`EnemyData_Carrion.lua:68`, `EnemyData_Mudman.lua:67`,
    `EnemyData_Zombie.lua:60`, `EnemyData_ZombieSpawner.lua:56`,
    `EnemyData_ZombieHeavyRanged.lua:66`, `EnemyData_ZombieAssassin.lua:54`,
    `EnemyData_Scimiterror.lua:60`, `EnemyData_WaterElemental.lua:61`); an
    elite inherits its base's table. Treant2 inherits Treant's Chance 0
    (`EnemyData_Treant.lua:50`); bosses, SuperElites and several minibosses
    have Chance 0. The FogEmitter miniboss (`FogEmitter_Elite`) pays a fixed
    50–70 at Chance 1 (`EnemyData_FogEmitter.lua:61-81`).
  - Unit groups (`IsUnitGroup`) spawn their `UnitGroup` members, which drop as
    themselves: FishSwarmerSquad five FishSwarmer, its elite two
    FishSwarmer_Elite, SimpleSquad four Simple, its elite two Simple_Elite
    (`EnemyData_FishSwarmer.lua:155-199`, `EnemyData_Simple.lua:122-160`;
    `EncounterLogic.lua:836-840`). A Menace conversion spawns its target
    identity with the target's own drop (`EncounterLogic.lua:784-810`); the
    targets outside every pool rate DespairElemental 50, LycanSwarmer 40 and
    its elite 80, FishSwarmer 5 and its elite 10, Simple 20 and its elite 50
    (`EnemyData_DespairElemental.lua:70`, `EnemyData_LycanSwarmer.lua:61, 87`,
    `EnemyData_FishSwarmer.lua:77, 150`, `EnemyData_Simple.lua:74, 117`).
  - Only the room's own encounter's store pays: `CheckMoneyDrop` reads
    `CurrentRun.CurrentRoom.Encounter` (`RoomLogic.lua:2361-2376`). Rooms with
    `MultipleEncountersData` (Thessaly's ship, Olympus) make each stage that
    encounter in turn (`RoomLogic.lua:1319-1325`), as Devotion does
    (`RewardLogic.lua:263`). A Fields cage starts as
    `MapState.EncounterOverride` and never becomes it (`StartFieldsEncounter`,
    `EncounterLogic.lua:2890-2938`), so cage and Passive kills together drain
    the room's Passive store (10–30, or the Nemesis event's data-set 25,
    `EncounterData_Story.lua:1915-1924`); the cages' own `GeneratedH` stores,
    drawn at `LeaveRoom` (`RoomLogic.lua:4384-4387`), are never read. Recorded
    `H_Combat15` and `H_Combat07` saves: the Passive store fell to −12 and −4,
    every cage store stayed whole, and each room gained exactly its Passive
    drain (overshoots 12 and 4). A challenge or boss-spawned encounter likewise
    never drains its own store.
  - A weapon `SpawnerOptions` spawn gets `ClearLootDrops` and drops nothing
    (`EnemyAILogic.lua:4847, 4950`). An encounter's `WipeEnemiesOnKill` enemy
    drops first, then kills every other enemy with `BlockLoot`
    (`CombatLogic.lua:3873-3874, 3934`; `RoomLogic.lua:5201-5219`); the
    FogEmitter's is commented out (`EncounterData.lua:860`). Pre-placed units
    (`ActivatePrePlaced`) are set up with their `GeneratorData` and drop
    normally (`EventLogic.lua:124-127`).
  - Each miniboss encounter's own enemies are fixed: its wave template or
    SpawnWaves and its pre-placed units, shrine-only shadows aside
    (`EncounterData.lua:699-909`, `EncounterData_MiniBoss.lua:7-1086`; the maps
    place two `Stalker_Miniboss` and five `CharybdisTentacle`). Their units
    rate ZombieAssassin_Miniboss 60 at 0.1; WaterUnitMiniboss 60,
    Octofish_Miniboss 300 with 24 Jellyfish at 30, CrawlerMiniboss 100,
    Vampire 80, Lamia_Miniboss 200 with Lamia_Support 110, SatyrCrossbow 100,
    Boar 100, SatyrRatCatcher_Miniboss 400 and GoldElemental_MiniBoss 200 at
    0.33; Captain 200 at 0.2 and Chance 0.25; Talos 500 and Dragon_MiniBoss
    1000 at 0.035; EarthElemental 30 at 0.16 (their `EnemyData_*` entries).
    Treant, Brute_Miniboss, Stalker_Miniboss, TyphonTail, TyphonEye and
    Charybdis with its tentacles have Chance 0. `MiniBossCaptain` and
    `MiniBossStalker` set `Generated = false` (`EncounterData_MiniBoss.lua:601,
940`), and Crawler, Charybdis, Talos and the Typhon eye inherit no
    generated base, so their kills pay uncapped. The shadow FogEmitter's
    Screamers spawn without end (`EncounterData.lua:863-909`). Recorded rooms:
    Treant, Brute and the Typhon tail drained nothing; Vampire paid 17 of 15,
    WaterUnit 27 of 25, and SatyrCrossbow 4 of 15 when the boss missed its 70%.
  - Recorded runs drained the store exactly by the enemy gold gained in 140 of
    150 rooms.
- **Wealth from the Dead** (`MoneyOnDeathCurse`) drops an NPC
  `MedeaMoneyTinyDrop` of 20 / 30 / 40 / 60 gold × Σ at `0.1 × LuckMultiplier`
  per kill, at most two per room (`TraitData_Medea.lua:98-155`,
  `CombatLogic.lua:4225-4285`, `SessionMapState.LifeOnKillRecord`). Success
  Rate's `LuckMultiplier` 1.3 is `SourceIsMultiplier` by 1 / 4⁄3 / 5⁄3 / 2
  (`TraitData_Hermes.lua:620-647`). `BlockMoney` stops its coins when they
  are collected (`RoomLogic.lua:2648-2652`).
- **Golden urns.** `HandleBreakableSwap` runs as every room starts, revisits
  included, and only with the Crossroads upgrade `WorldUpgradeBreakableValue1`
  (`RoomData.lua:29-41`, `RoomLogic.lua:1196`; `WorldUpgradeData.lua:1786`),
  which a Fresh File lacks. It swaps `MaxHighValueBreakables` + 1 of the map's
  breakables carrying `BreakableValueOptions`, or all of them when the map has
  fewer (`RoomLogic.lua:2533-2597`), each trying 15, 10 and 5 gold in order at
  its chance times the room's `BreakableHighValueChanceMultiplier`: 1 / 2 / 2%
  for the Chronos pot (`BaseBreakable`, `ObstacleData.lua:756-834`, which the
  F, G, I, O, Chaos and Anomaly breakables inherit), 5% each for the surface
  pots (`ObstacleDataN.lua:491`, `ObstacleDataP.lua:118`,
  `ObstacleDataQ.lua:184`). The limits are 3 in F, G, N and Chaos rooms, 6 in
  I and P, 8 in Q and none in H, O, the Anomaly and `C_Boss01`
  (`RoomDataF.lua:299`, `RoomDataG.lua:291`, `RoomDataChaos.lua:165`,
  `RoomDataI.lua:306`, `RoomDataN.lua:354`, `RoomDataP.lua:345`,
  `RoomDataQ.lua:30`, `RoomDataH.lua:503` commented out, `RoomDataO.lua:292`,
  `RoomDataAnomaly.lua:12`, `RoomDataC.lua:16`); `I_MiniBoss02` has 12 at 100×
  (`RoomDataI.lua:2931-2932`), Ephyra's side rooms (`BaseN_SubRooms`) 1 at 2×
  (`RoomDataN.lua:3824-3825`) and `Q_Intro` 0.33× (`RoomDataQ.lua:401`).
  Each room's breakables are the `Breakable_<set>` obstacles its
  `Content/Maps/bin/<room>.thing_bin` places: none on any Fields map, the
  Tartarus Preboss, Postboss and boss maps, `I_Combat14`, `G_Combat01`,
  `G_Shop01`, `G_Story01`, `G_Reprieve01` and the Summit's boss, story and
  Postboss maps; one on `I_Combat08`; four to eight on several Summit maps,
  under its nine candidates; 111 on `I_MiniBoss02`. Shops, stories, Prebosses
  and Postbosses with breakables swap as combats do: recorded surface gains of
  5–15 in `N_Hub`, `N_PreBoss01`, `P_Story01`, `P_PreBoss01`, `P_PostBoss01`
  and `Q_Intro`. Urn gold ignores the store and pays `round(gold × Σ)`.
- **Heracles's bounty.** A Heracles combat marks 2–3 enemies per wave
  (`HeraclesBountyPerWaveMin/Max`, `HeraclesBountyValue` 20,
  `EncounterData_Heracles.lua:8-10`; `CheckHeraclesBounty`,
  `EncounterLogic.lua:2314-2339`) over its three waves. A marked kill credits
  the player unless Heracles lands it without recent player damage
  (`TrackHeraclesChallengeProgress`, `EncounterLogic.lua:2342-2378`); the
  credited total drops after combat as one `RoomMoneyDrop` whose `DropMoney`
  is set after creation, so unmultiplied (`EnemyAILogic.lua:5332-5336`).
  `HeraclesCombatMoneyValue` on enemies is unread.
- **Not counted.** Arachne's `DoorCash` (`CostumeLogic.lua:36-46`), Selene's
  `MoneyOnSpell` (`SpellLogic.lua:1728`) and challenge switches
  (`EncounterLogic.lua:2138-2141`) are outside planner authorship.

### Empty groups and bounded unknowns

`FillInShopOptions` appends a group only when its filtered option list is
nonempty; there is no replacement or minimum fill, and later items shift to
compact `StoreOptions` positions. Planner disposition: a group with zero
eligible options is a validly empty slot, and publication maps declared slots
to compact positions. The reachable case is a fresh profile's `I_WorldShop`
resource group: a bounded probe of the unmodified `FillInShopOptions` returned
no item with empty lifetime resources, and a brand-new profile run
(2026-09-30) showed four items with every purchase bound. Three bounded unknowns remain:

- In the `OptionsData` path, `RandomLoot` and `BoostedRandomLoot` still append
  a copy when `GetEligibleInteractedGod` returns nil (`StoreLogic.lua:183–205`),
  so such a group is not natively empty even with no eligible god. The
  Executor's planned-empty-group probe diagnostic is the guard.
- A `WeightedList` group whose `Offers` exceeds its eligible count loops past
  100 picks and returns `{}`, emptying the whole shop (`StoreLogic.lua:224–231`;
  for example Q group 1 with `Offers = 2`). Partial underfill stays
  `incomplete` and is not modeled.
- Travel Deal regenerates with `ExclusionNames` and reads
  `options[replacedIndex]` (`StoreLogic.lua:424–428`). If the exclusion empties
  the source's group, native shifts later groups left and refills from the next
  group, while the planner falls back within the same group and the Executor
  forces the planner's group.

## Biome Reward Producer Map

| Biome | Modeled producers                                                                                       | Disposition notes                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| F     | Run/Meta generated rewards, forced Run rewards, Story, takeover Preboss Shop/free roles                 | Exact support; base-store probability simplified                                         |
| G     | Same core producers as F plus linked boss store provenance                                              | Exact support; locked-door interaction deferred; base-store probability simplified       |
| P     | Run/Meta rewards, takeover Preboss Shop/free roles, linked boss provenance                              | Exact NPC-free reward support; NPC gift internals deferred                               |
| Q     | Reward-free spine, `TyphonBossRewards` minibosses, declaration-fixed width-one Preboss Shop             | Exact supported reward topology; no invented Run/Meta base store                         |
| H     | Declaration-owned RunProgress offers, ordered cages, optional pickups, takeover Preboss Shop/free roles | No generated base-store value; exact cage and persistent `FieldsOptionalRewards` support |
| O     | Ordered Run/Meta reward wheels, fixed Devotion, declaration-fixed width-one Preboss Shop                | Exact wheel support and source-derived outgoing store; probability simplified            |
| I     | Derived Goal/NonGoal, `TartarusRewards`, generated Preboss Shop                                         | Exact structural support; Goal emits no ordinary concrete acquisition                    |
| N     | Persistent `HubRewards` board, RunProgress minibosses, side bags, completed-Hub Preboss Shop            | Exact persistent offer support; NPC internals deferred                                   |

Boss-specific and weapon-dependent automatic drops are not projected as
RunProgress or MetaProgress acquisitions. Boss/postboss Room Declarations still
carry their exact layout position and entered-store history policy.

## Current Planner Disposition

Schema 41 retains exact concrete acquisition identity through Echo's two
reward-facing effects. Reward Reward Reward folds the latest successfully
settled effective `LastRewardEligible` recreation descriptor and settles the
mandatory recreated entry through the ordinary acquisition roles. This keeps
replayed Nectar on its opted-in run-progress path and keeps Blind Box identity
separate from its resolved source.

World Shop profiles retain only their declaration-owned initial slots.
Infernal Contract, Travel Deal, and Gold use fixed supplemental entry keys in
the existing room-exit settlement site: Contract is a free pedestal, Travel is
a paid refill, and Gold is a free later pickup. Payload/participation and the
single authored chronology are separate products; Contract never enters paid
purchase policy, and Travel/Gold keep distinct source-time frontiers.

Gold Gold Gold's first purchased non-`SpellDrop` World Shop entry consumes the
exact one-use trait and materializes one separate free object. The source does
not automatically acquire that object: its later interaction may be interwoven
with other purchases and pickups in the room. Loot creation fixes its generated
offer at materialization, while consumable behavior occurs at interaction.
`RemoveStoreItem` runs before the purchased loot choice or consumable effect is
settled, so the duplicate loot is created from the pre-source-acquisition
history; the source screen's close then rebuilds its options, like every live
loot in the room. The
[composition audit](../traits/TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md#generation-position-and-option-rebuild)
owns option build, rebuild and regeneration contacts, including why the
open-time `StackOnly` regeneration has no reachable trigger.
Blind Box resolves its hidden loot on interaction in the game. Gold's
`CreateLoot` branch registers a required room object (`RoomLogic.lua`,
`CreateLoot`); its `CreateConsumableItem` branch does not (`InteractLogic.lua`).
Thus duplicated boons, Hermes, hammers, and full Poms require pickup, while
consumables—including unopened Blind Boxes—remain optional. The planner
requires Timeline placement before editing the stable `echoDoubleShopReward`
payload, using pickup context for its hidden source. The Shop kernel's
accepted paid removal consumes Gold and materializes the duplicate even when
later nested source detail is invalid; rejection before that checkpoint leaves
the trait armed. A loot duplicate's options are rebuilt when its source screen
completes and otherwise keep that context until opened.

Fields optional offers now consume the persistent
`FieldsOptionalRewards` bag sequentially on room entry, independently of cage
`RunProgress` preparation. Artificer conversion reuses the same counted-bag
transition against the current `RunProgress` bag with Devotion and Spell
excluded. It consumes the exact reachable entry at source interaction and
defers the generated replacement's concrete acquisition to its later
checkpoint; no second reward bag or acquisition fold is introduced.
