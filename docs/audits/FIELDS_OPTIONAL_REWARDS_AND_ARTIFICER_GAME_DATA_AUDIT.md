# Fields Optional Rewards and Artificer Game-Data Audit

## Status and scope

Source audit completed against the installed Hades II scripts on 2026-08-15.
This document records the game facts needed to reason about:

- Mourning Fields optional rewards and their relationship to cage rewards;
- player-authored acquisition chronology inside one H combat room; and
- the Arcana card `MetaToRunUpgrade` (The Artificer), including Circe's
  `ArcanaRarityTrait` (Lazuli).

This is not an implementation plan. It does not prescribe a persisted shape,
simulation product, command, UI, delivery gate, file placement, or commit
sequence. The Fields facts are recorded independently of Artificer so the room
surface remains useful even if the Arcana effect is deferred.

The currently implemented H baseline deliberately omits
`FieldsOptionalRewards`. This audit does not change that disposition. It
establishes the source contract a later Fields slice must settle before an
Artificer slice relies on those pickups.

## Sources

Primary evidence:

- `RoomDataH.lua`: `BonusRewardStoreName`, `OptionalRewardChances`, cage-count
  bounds, and H room declarations;
- `Maps/H_Combat*.thing_bin`: concrete `BonusRewardSpawnPoints` memberships;
- `LootData.lua`: `FieldsOptionalRewards`, `RunProgress`, `HubRewards`, and
  their entry multiplicities;
- `RoomLogic.lua`: H target preparation, cage-offer generation,
  `SpawnRewardCages`, optional reward spawning, and room restore data;
- `ObstacleDataH.lua` and `EncounterLogic.lua`: Fields cage interaction,
  encounter activation, and reward unlocking;
- `RewardLogic.lua`: counted-store initialization, eligibility, consumption,
  and first-refill behavior;
- `ConsumableData.lua`: `BaseMetaRoomReward` and the concrete metaprogression
  identities;
- `GiftLogic.lua`: Artificer eligibility, conversion, charge use, replacement
  generation, and source destruction;
- `MetaUpgradeData.lua` and `TraitData_MetaUpgrade.lua`: The Artificer's card
  declaration and rarity-scaled use count;
- `TraitData_Circe.lua`, `EventLogic.lua`, and `MetaUpgradeLogic.lua`: Lazuli's
  Arcana selection, rarity promotion, and spent-use preservation;
- `RequirementsData.lua` and `RequirementsLogic.lua`: early/late Hammer
  requirements and the Shop-only `RequiredNotInStore` check;
- `InteractLogic.lua`: loot-history update at acquisition rather than spawn;
- `TraitData_Narcissus.lua`: the free Ashes, Psyche, and Bones sources;
- `TraitData_Echo.lua` and `StoreLogic.lua`: Echo's free World Shop duplicate;
  and
- `EventLogic.lua`, route room data, and Poseidon trait data: explicit
  per-instance Artificer exclusions.

The exact supported counted-store declarations and refill proof remain owned
by `REWARD_GAME_DATA_AUDIT.md`. The broad Arcana board and Circe eligibility
facts remain owned by `ARCANA_AND_FEAR_GAME_DATA_AUDIT.md`.

## Mourning Fields reward surfaces

### Prepared cage offers

When an outgoing H target is prepared, the game selects that target's cage
count and resolves every cage offer before the target is entered. Ordinary H
combat cages consume `RunProgress` entries at that preparation checkpoint and
participate in the containing generated-peer exclusions.

On entering the selected target, `SpawnRewardCages` creates each cage and its
already-resolved reward object. The reward begins unusable behind a
`FieldsRewardCage`. Activating a cage starts its local encounter; the cage is
then destroyed and its reward becomes usable.

Only one non-completed Fields encounter can be active at once. The player may
choose the order in which available cages are activated. The game does not
declare one fixed cage-activation order.

The current ordinary source bounds are two or three cage offers, subject to the
selected target's own maximum. The third value is an ordinary retained offer
even when a lower cage-count roll leaves it inactive.

### Optional reward generation

After cage objects and rewards are spawned, `SpawnRewardCages` performs the
optional-reward pass:

1. evaluate each entry of `OptionalRewardChances` independently;
2. count the successful rolls;
3. obtain the map's `BonusRewardSpawnPoints`;
4. choose that many entries from `FieldsOptionalRewards`, one call at a time;
5. spawn each selected reward with `NotRequiredPickup = true`; and
6. retain its spawn data under the encounter's `RewardsToRestore`.

`BaseH.OptionalRewardChances` contains four trials:

```text
0.95, 0.75, 0.50, 0.25
```

The Lua source therefore permits zero to four successful rolls before map
capacity. Each realized count is additionally bounded by the number of
`BonusRewardSpawnPoints` present on the concrete map. The installed
`thing_bin` map assets close that declaration-local capacity:

| Room declaration | Physical spawn points | Effective optional maximum |
| ---------------- | --------------------: | -------------------------: |
| `H_Combat01`     |                     4 |                          4 |
| `H_Combat02`     |                     3 |                          3 |
| `H_Combat03`     |                     5 |                          4 |
| `H_Combat04`     |                     7 |                          4 |
| `H_Combat05`     |                     7 |                          4 |
| `H_Combat06`     |                     4 |                          4 |
| `H_Combat07`     |                     3 |                          3 |
| `H_Combat08`     |                     3 |                          3 |
| `H_Combat09`     |                     2 |                          2 |
| `H_Combat10`     |                     4 |                          4 |
| `H_Combat11`     |                     2 |                          2 |
| `H_Combat12`     |                     3 |                          3 |
| `H_Combat13`     |                     2 |                          2 |
| `H_Combat14`     |                     2 |                          2 |
| `H_Combat15`     |                     2 |                          2 |

The effective maximum is the lesser of the four chance trials and physical
spawn-point count. The supported ordinary cage encounters do not set
`BlockMaxBonusRewards`; the source's reduction belongs to the separate
`NemesisRandomEvent` room-level encounter and is not an ordinary-H capacity
rule.

`BlockMaxBonusRewards` can reserve one spawn point for specific encounter
families when every point would otherwise be used. It is not a generic
ordinary-H rule.

### Exact optional store

`FieldsOptionalRewards` contains 19 entries:

| Reward identity            | Multiplicity | Requirement   |
| -------------------------- | -----------: | ------------- |
| `MaxManaDropSmall`         |            3 | none          |
| `MaxHealthDropSmall`       |            3 | none          |
| `RoomMoneyTinyDrop`        |            3 | none          |
| `RoomRewardHealDrop`       |            1 | none          |
| `ArmorBoost`               |            1 | none          |
| `GiftDrop`                 |            1 | none          |
| `MetaCurrencyDrop`         |            1 | none          |
| `MetaCardPointsCommonDrop` |            4 | none          |
| `MinorTalentDrop`          |            2 | `TalentLegal` |

Each optional reward calls `ChooseRoomReward` without a
`previouslyChosenRewards` peer list. Optional siblings therefore do not
duplicate-block one another. They still consume the same persistent
`FieldsOptionalRewards` bag one entry at a time, and the ordinary counted-store
refill rule applies if its current eligible support is empty.

This store is separate from `RunProgress`. Generating or acquiring an optional
reward does not itself consume an H cage entry.

### Optional versus required acquisition

Optional rewards are explicitly spawned with `NotRequiredPickup = true` and
are recorded in `MapState.OptionalRewards`. The player may leave them behind.
The cage rewards use their normal reward acquisition behavior and may remain
uncollected on the ground after their cage encounter has made them usable.

The source therefore distinguishes at least three chronologies:

- cage offer generation before room entry;
- cage activation and local encounter order inside the room; and
- actual acquisition order across unlocked cage rewards and optional pickups.

Those orders are related but not identical. A reward merely existing on the
map does not add it to acquisition history. Optional pickups can be taken
before, between, or after cage reward acquisitions whenever ordinary
interaction blocking permits; an uncollected optional pickup contributes no
history.

The installed scripts do not require one fixed total order independent of
player actions. A later planner abstraction may ask the player for a complete
room-local acquisition chronology, but it must retain the difference between
an offered cage reward, an activated cage, and an acquired reward.

## The Artificer

### Card rank and uses

`MetaToRunUpgrade` installs `MetaToRunMetaUpgrade`. The trait declares
`MetaConversionUses = 1`, scaled by the inherited Arcana rarity multiplier:

| Arcana rank | Runtime rarity | Total conversion capacity |
| ----------: | -------------- | ------------------------: |
|           1 | Common         |                         1 |
|           2 | Rare           |                         2 |
|           3 | Epic           |                         3 |
|           4 | Heroic         |                         4 |

The planner's ordinary fully upgraded Arcana baseline therefore begins with
three Artificer uses when the card is active.

The runtime trait stores remaining uses. `CurrentRun.MetaConversionUses`
separately counts uses already spent during the run.

### Per-instance eligibility

`CanReceiveGift` exposes the Artificer interaction only when all of these are
true:

- the concrete target has effective `MetaConversionEligible = true`;
- the hero has at least one remaining `MetaConversionUses`; and
- the target has no positive resource cost.

Eligibility belongs to the concrete spawned instance, not merely its reward
name. A declaration may normally inherit Artificer eligibility while one
producer overrides its instance to false. Likewise, the same identity can be
eligible as a free room pickup and ineligible while it remains a paid Shop
item.

The concrete declarations that inherit `BaseMetaRoomReward` are:

| Identity                      | Notes                             |
| ----------------------------- | --------------------------------- |
| `GiftDrop`                    | Nectar                            |
| `MetaCurrencyDrop`            | Bones                             |
| `MetaCurrencyBigDrop`         | inherits ordinary Bones behavior  |
| `MetaCardPointsCommonDrop`    | Ashes                             |
| `MetaCardPointsCommonBigDrop` | inherits ordinary Ashes behavior  |
| `MemPointsCommonDrop`         | Psyche                            |
| `MemPointsCommonBigDrop`      | inherits ordinary Psyche behavior |

These are the source identity families. Actual eligibility still depends on
the producer and cost facts above.

### Psyche is a producer-owned pickup, not a store entry

`MemPointsCommonDrop` remains a complete concrete consumable declaration and
inherits both Gold- and metaprogression-conversion eligibility from
`BaseMetaRoomReward`. Narcissus's Mystic Secrets explicitly produces that
identity.

It also declares `LastRewardEligible = true`. Successfully acquiring the
Psyche pickup therefore makes Psyche the current last reward, and Echo's Reward
Reward Reward may later recreate a fresh `MemPointsCommonDrop`. Restoring
Psyche to the planner must extend the exact Echo last-reward recreation matrix;
silently retaining the previous Ashes/Bones-only resource set would make the
new concrete acquisition internally inconsistent.

The current installed reward stores contain no `MemPointsCommonDrop` entry:
it is absent from `MetaProgress`, `RunProgress`, and the other counted bags.
Its declaration and its Narcissus production are therefore independent of
store membership. Supporting the concrete Psyche pickup must not reinsert it
into `MetaProgress` or make it an ordinary generated room reward.

### Complete Narcissus conversion surface

Each Narcissus choice creates the concrete pickups listed in that trait's
`LootOptions`. The planner has historically retained only pickups with an
already-modeled run effect and omitted numerically neutral resources. Time
Piece and Artificer make some of those omitted world objects consequential,
so the corrective boundary must be derived from the effective flags on every
source pickup rather than from the planner's current reduced rows.

The complete source matrix is:

| Narcissus choice                     | Source pickups                    | Time Piece eligible   | Artificer eligible |
| ------------------------------------ | --------------------------------- | --------------------- | ------------------ |
| `NarcissusA` — Verdure Sampler       | Moly, Nightshade, Pom Slice       | none                  | none               |
| `NarcissusB` — Heartfelt Condolences | Ashes, Major Heal                 | Ashes                 | Ashes              |
| `NarcissusC` — Precious Metals       | Silver, Gold                      | none                  | none               |
| `NarcissusD` — Mystic Secrets        | Psyche, Max Magick                | Psyche and Max Magick | Psyche             |
| `NarcissusE` — Ancestral Offering    | Bones, Max Health                 | Bones and Max Health  | Bones              |
| `NarcissusF` — Fates' Trimmings      | Fate Fabric, rerolls              | none                  | none               |
| `NarcissusG` — Heavenly Splendor     | Star Dust, two Elemental Essences | none                  | none               |
| `NarcissusH` — Life Savings          | Death Defiance, Lotus             | Death Defiance        | none               |
| `NarcissusI` — Mixed Blessings       | Blind Box, Mystery Seeds          | none                  | none               |

The positive rows come from two distinct declaration mechanisms:

- Ashes, Psyche, and Bones inherit both flags from `BaseMetaRoomReward`;
- `MaxManaDrop`, `MaxHealthDrop`, and `LastStandDrop` explicitly opt into
  `GoldConversionEligible` but not `MetaConversionEligible`.

None of the other listed identities inherits or declares either flag. In
particular, Narcissus uses `HealDropMajor`, not a Gold-convertible room-reward
heal; `BlindBoxLoot` resolves on interaction but is not itself eligible for
either conversion; and the plant, ore, fabric, reroll, Star Dust, element, and
seed pickups remain outside both systems.

The corrective slice therefore has two obligations:

1. restore the omitted Ashes, Psyche, and Bones as independent free Narcissus
   pickups; and
2. harden the already-modeled Max Magick, Max Health, and Death Defiance
   pickups as part of the same complete Narcissus Time Piece/Artificer matrix.

It does **not** need to restore every effect-neutral companion pickup merely to
support these two systems. Those omitted identities can remain an explicit
planner simplification until another modeled system makes their existence
consequential. Psyche remains producer-owned and must not be added to a counted
reward store as part of this correction.

### Known producer distinctions

The following source cases are explicit:

- ordinary free `MetaProgress` instances retain their inherited eligibility;
- H optional `GiftDrop`, `MetaCurrencyDrop`, and
  `MetaCardPointsCommonDrop` instances retain it;
- Narcissus's Heartfelt Condolences, Mystic Secrets, and Ancestral Offering
  create free `MetaCardPointsCommonDrop`, `MemPointsCommonDrop`, and
  `MetaCurrencyDrop` instances respectively. `GiveRandomConsumables` supplies
  a zero cost and none of those options overrides `MetaConversionEligible`, so
  the Ashes, Psyche, and Bones pickups are all Artificer-eligible;
- ordinary paid Shop instances have positive `ResourceCosts` and cannot be
  converted while offered for sale;
- Echo's Reward Reward Reward explicitly sets
  `MetaConversionEligible = false` on its recreated consumable;
- Eris's G/H/I opening catch-up drops and Poseidon's resource-bonus drop
  explicitly set the flag false; and
- Echo's Gold Gold Gold free consumable duplicate is created at zero cost from
  the duplicated identity. When that identity inherits
  `BaseMetaRoomReward` and no producer override removes it, the free duplicate
  is Artificer-eligible.

`BlindBoxLoot` is not a `BaseMetaRoomReward`; neither the box nor its resolved
god loot is an Artificer source.

The current planner treats the Ashes, Psyche, and Bones components of those
three Narcissus options as effect-neutral because their numeric resource gains
have no downstream effect. Time Piece and Artificer make the existence of each
pickup consequential. The pre-Artificer corrective slice must therefore
restore all three free sources explicitly rather than preserving only each
option's other pickup.

### Conversion chronology

When the player selects Artificer on an eligible target, `GiftLogic.lua`:

1. disables further use on the original target;
2. sets that instance's `MetaConversionEligible` to false;
3. decrements the Artificer trait's remaining use count;
4. increments `CurrentRun.MetaConversionUses`;
5. calls `ChooseRoomReward` on the current global `RunProgress` bag, excluding
   `Devotion` and `SpellDrop` and ignoring the room's forced reward;
6. remembers whether the original target was required and whether it could be
   duplicated;
7. spawns the selected replacement on the original object position;
8. transfers required-object membership and duplicate capability when
   applicable; and
9. destroys the original target.

The original metaprogression pickup is not acquired. It does not add its
resource, use record, consumable record, or last-reward history.

The generated `RunProgress` reward is a separate world object. It is not
automatically acquired by the conversion action. Its concrete history effects
occur only if and when the player later interacts with that replacement.

Consequently:

- converting an optional Fields pickup produces an optional replacement that
  may also be left behind;
- converting a required reward transfers the required-object obligation to
  the replacement; and
- multiple conversions can occur before any generated replacement enters
  history, provided the player can reach the other source interactions.

### RunProgress bag semantics

Artificer does not choose from a fresh abstract union. It reads and consumes
the run's current mutable `RunProgress` bag.

`ChooseRoomReward` first filters the entries currently remaining in that bag
through their live requirements. If at least one eligible entry remains, it
selects and removes one of those entries. It does not refill merely because a
particular desired reward identity is absent.

If no eligible entry remains, it appends one complete base `RunProgress` set
without discarding ineligible leftovers and retries. Repeated historical
refills can therefore accumulate copies of entries that were ineligible when
the refill occurred but become eligible later.

This distinguishes three facts:

- the source pickup's own store does not determine the Artificer output;
- current `RunProgress` bag membership constrains the output; and
- current acquisition history constrains each remaining entry's requirements.

For example, Ephyra's main board uses `HubRewards`, while Artificer explicitly
uses `RunProgress`. A prepared Hub Hammer does not consume a RunProgress Hammer
entry. Before that prepared Hammer is acquired, Artificer may still resolve an
eligible RunProgress Hammer. Acquiring the Hub Hammer first changes
`LootTypeHistory` and can make the early RunProgress Hammer ineligible.

### Multiple-Hammer Fields consequence

The source admits the following possibility:

1. enter H with exactly one acquired Hammer;
2. have several late-Hammer entries accumulated through prior RunProgress
   refills;
3. prepare a maximum cage room whose offers consume one of those Hammer
   entries;
4. realize several Artificer-eligible optional pickups;
5. convert those optional pickups before acquiring any generated Hammer; and
6. acquire the already-generated H Hammer and all converted Hammers afterward.

The late Hammer requirement reads `LootTypeHistory.WeaponUpgrade == 1`.
`LootTypeHistory` increments when a Hammer loot object is acquired, not when it
is generated. `RequiredNotInStore` inspects only the current room's actual Shop
inventory, not loose Hammer objects. Each Artificer conversion also omits a
peer list other than the explicit Devotion/Spell exclusions.

If three late-Hammer entries remain after the cage Hammer is prepared, three
optional pickups can therefore all be converted into Hammers before any of
those replacements is acquired. Picking up the first converted Hammer before
performing the later conversions instead raises Hammer history to two and
makes the remaining late-Hammer entries ineligible.

This consequence is possibility-sensitive and ordering-sensitive, not a claim
about likely RNG.

### No recursive conversion chain

The `RunProgress` store contains health, mana, money, Pom, Hammer, Hermes,
Devotion, Spell, Talent, and Boon entries. It contains none of the seven
`BaseMetaRoomReward` identities.

An Artificer replacement therefore cannot itself become another Artificer
source. The source operation is exactly one replacement; no recursion guard or
generic conversion chain is needed to describe the game behavior.

### Interaction with Time Piece

The metaprogression source identities also inherit Gold-conversion support.
Artificer and Time Piece are separate player controls on the same concrete
target:

- normal acquisition keeps the source reward;
- Artificer destroys it and creates one RunProgress replacement; or
- Time Piece destroys it for Gold.

Only one disposition can settle that target. Converting it through one system
precludes subsequently using the other system on the destroyed source.

## Lazuli promotion

`ArcanaRarityTrait` selects up to two distinct active Arcana traits whose
current rarity has a supported next rarity. If Artificer is selected, Circe:

1. removes the Epic `MetaToRunMetaUpgrade` trait;
2. creates its Heroic replacement;
3. adds the Heroic trait to the hero; and
4. calls `UpgradeMetaToRunUses(oldTrait, newTrait)`.

`UpgradeMetaToRunUses` reads the run's already-spent conversion count and sets
the new trait's remaining uses to:

```text
Heroic capacity (4) - CurrentRun.MetaConversionUses
```

Lazuli therefore preserves spent uses and adds exactly one remaining use:

| Uses already spent | Before promotion | After promotion |
| -----------------: | ---------------: | --------------: |
|                  0 |                3 |               4 |
|                  1 |                2 |               3 |
|                  2 |                1 |               2 |
|                  3 |                0 |               1 |

This is not a reset to four remaining charges after prior use. When no use has
been spent, the ordinary result naturally displays four remaining charges.

## Locked source conclusions

- H cage offers are generated before the target is entered; optional rewards
  are generated separately after cage objects spawn.
- `FieldsOptionalRewards` is one persistent 19-entry bag with the exact
  multiplicities above and no optional-sibling peer exclusions.
- Optional Fields pickups are genuinely optional and may be interleaved with
  cage activation and reward acquisition.
- The script declares four optional chance rolls, while exact physical map
  capacity is declaration-owned at two, three, or four after inspecting the
  installed map assets.
- Artificer rank III supplies three total uses; rank IV supplies four.
- Eligibility belongs to a free concrete `BaseMetaRoomReward` instance, not
  just a reward name.
- Psyche is a concrete Narcissus-produced acquisition identity but is not a
  member of any current counted reward store.
- Acquired Psyche is LastReward-eligible and can be recreated by Echo without
  becoming a counted-store entry.
- Narcissus has exactly six conversion-relevant pickups: Ashes, Psyche, and
  Bones support both systems, while Max Magick, Max Health, and Death Defiance
  support Time Piece only.
- The omitted Ashes, Psyche, and Bones must be restored before Artificer; the
  already-modeled other three belong to the same corrective contract and test
  matrix.
- Conversion consumes one charge and one exact current RunProgress bag entry,
  destroys the original without acquiring it, and creates a separately
  acquired replacement.
- RunProgress refills append complete sets without discarding ineligible
  leftovers, allowing later-eligible duplicate entries to accumulate.
- Generated-but-unacquired rewards do not change history; this makes the
  multiple-Hammer Fields sequence source-valid.
- RunProgress cannot produce another metaprogression source, so Artificer does
  not recurse.
- Lazuli preserves spent uses and adds one remaining Artificer use rather than
  resetting a previously used card.

## Remaining bounded questions

The product need not model pickup interaction during an active cage combat if
it preserves every legal between-encounter and post-encounter acquisition
ordering. If a future mechanic depends specifically on mid-combat pickup
timing, that interaction lock should receive its own focused source trace.

Before locking Artificer scope, complete the bounded Narcissus correction
recorded above: restore the three omitted dual-conversion pickups without
adding Psyche to a counted store, and harden all six conversion-relevant
pickups through their exact source options and independent acquisition
dispositions. The remaining source pickups may stay explicitly effect-neutral
until another supported system makes them consequential.
