# Hex Talent Layout Game-Data Audit

## Status and scope

Source audit completed on 2026-08-27 against installed Steam build `24556151`.
This document is the primary evidence authority for:

- the four generated Path of Stars layouts: node graph, kinds, links and
  finite capacities;
- the exact Rare, Epic and repeatable candidate identities for every Hex, and
  the repeatable refill cycle with its `MaxCount` limits;
- node availability and investment on a writable talent screen;
- the two-node Olympian extension and its god/keepsake eligibility; and
- the source's full-tree reward closure and late-extension cache behavior.

Base Hex identity and acquisition remain owned by the
[Selene Spell audit](../traits/SELENE_SPELL_GAME_DATA_AUDIT.md). Point grants,
the mutable point bank, initial Spell Drop bonuses, Aspect of Selene routing,
and Moon Beam contacts remain owned by the
[Path of Stars and Spell Drop audit](PATH_OF_STARS_AND_SPELL_DROP_GAME_DATA_AUDIT.md).

This audit does not model individual talent effects or talent rarity values.

## Sources

Primary evidence:

- `SpellData.lua`: `TalentTreeStructures` and the nine Hex talent pools;
- `SpellLogic.lua`: `CreateTalentTree`, `CheckAndAddOlympianDuo`, and
  `UpdateTalentPointInvestedCache`;
- `TalentScreenLogic.lua`: writable versus read-only screens, node
  availability, investment, and cache refresh;
- `TraitTrayLogic.lua`: the read-only inspection entry point;
- `TraitData_Talent.lua`: talent identities, duo links, repeatable `MaxCount`,
  and the shared `OlympianSpellCountTalent`;
- `TraitData_Athena.lua`: the concrete Olympian-talent dependency;
- `TraitData_Hera.lua` and `TraitLogic.lua`: All Together's direct grants,
  current `MetGods` reconstruction, and provider attribution;
- `UpgradeChoiceLogic.lua`, `EventLogic.lua`, and `KeepsakeLogic.lua`: the
  concrete post-acquisition and keepsake reevaluation contacts;
- `RequirementsData.lua`: `TalentLegal`;
- `SurfaceShopLogic.lua`: committed delayed delivery and direct item spawning;
  and
- English `TraitText.en.sjson`: player-facing talent names.

## One generated tree, not a four-choice screen

`CreateTalentTree` gathers every currently progression-eligible structure and
chooses one with `GetRandomValue`. The player does not select among four
layouts. A planner layout picker freezes that random result for execution.

`Lung` has no prior-progression requirement. `Pyramid`, `Maze`, and `Nacelle`
require a profile-level prior `TalentDrop` use. All four are available under
the planner's established fully progressed profile baseline.

The structures contain ordinary repeatable nodes plus fixed high-value pool
positions. Counting the declarations gives:

| Source layout | Base nodes without Olympian pair | Rare positions | Epic positions | Repeatable positions | Capacity with Olympian pair |
| ------------- | -------------------------------: | -------------: | -------------: | -------------------: | --------------------------: |
| `Lung`        |                               16 |              2 |              1 |                   13 |                          18 |
| `Pyramid`     |                               18 |              3 |              1 |                   14 |                          20 |
| `Maze`        |                               22 |              3 |              2 |                   17 |                          24 |
| `Nacelle`     |                               18 |              3 |              2 |                   13 |                          20 |

## Layout graphs

Each `Structure[depth][slot]` entry is one node; the planner keys it
`depth:slot`. Depths start at 1 and slots are sparse integers; Nacelle's
depth 3 uses slot 0. A node's `Pool` names its kind: `Keystone` (Rare),
`Legendary` (Epic), `OlympianSpell` (the duo), `OlympianCount` (Lineage), or
no pool for a repeatable node. `GridOffsetX/Y` shift the node on the screen
grid in node-spacing units; Nacelle's structure also carries a 15-pixel
`OffsetY` for the whole tree.

`LinkTo` lists slots at the next depth. Every installed link resolves to a
declared node. `CreateTalentTree` derives each node's `LinkFrom` backlinks
from those links after omitting an absent Olympian pair
(`SpellLogic.lua:116-130`), and `CheckAndAddOlympianDuo` regenerates them on
insertion. Only Nacelle's two depth-2 nodes are `Bidirectional`.

Every node below depth 1 has a backlink, and every non-Olympian node has a
non-Olympian backlink, so the tree is fully reachable from its depth-1 roots
with or without the Olympian pair. The pair's positions:

| Source layout | `OlympianSpell` | `OlympianCount` | `OlympianSpell` linked from |
| ------------- | --------------- | --------------- | --------------------------- |
| `Lung`        | `5:3`           | `6:1`           | `4:3`                       |
| `Pyramid`     | `4:3`           | `5:2`           | `3:3`                       |
| `Maze`        | `5:7`           | `6:3`           | `4:3`                       |
| `Nacelle`     | `4:5`           | `5:3`           | `3:1`, `3:5`                |

`OlympianCount` is linked only from `OlympianSpell`; no other node depends on
the pair. The pair's draws do not touch the repeatable or high-value pools.

Pyramid, Maze and Nacelle carry a `GameStateRequirements` of a prior profile
`TalentDrop` use; Lung has none.

The two Olympian positions are excluded together when their linked duo is not
eligible. They are additional capacity; they do not replace Rare, Epic, or
ordinary positions.

## High-value pool construction

The source calls Rare positions `Keystone`. Each receives one identity removed
without replacement from the selected Hex's `Talents.Unique` list and is
assigned runtime rarity `Rare`.

The source calls Epic positions `Legendary`. Each receives one non-duo identity
removed without replacement from the selected Hex's `Talents.Legendary` list
and is assigned runtime rarity `Epic`. The declaration-list name therefore
must not be exposed as the node's runtime rarity.

Every Hex pool is large enough to fill the maximum layout: at least three Rare
candidates and at least two non-duo Epic candidates. The generated identities
are distinct within each rarity pool, and each position removes a random
remaining identity, so any arrangement of distinct pool identities over a
layout's positions is a possible tree.

`CreateTalentTree` visits depths in order with `ipairs` and the nodes of one
depth with `pairs` (`SpellLogic.lua:52-53`). Draw order across depths is
therefore fixed; order among the nodes of one depth is not observable.

Player-facing names are not globally unique: `Ambition` is used by both
`PolymorphBossDamageTalent` and `MoonBeamPrimaryTalent`, while `Contingency` is
used by both last-stand recharge talents. Persisted identity must therefore use
the game key rather than the display name.

## Repeatable nodes and the refill cycle

Repeatable nodes draw from the Hex's four-talent `Talents.Repeatable` list
without replacement (`SpellLogic.lua:53-79`). When the list is empty it
refills with every listed talent whose tree count is still below its
`MaxCount`. The source also excludes a bounded talent never drawn, which
cannot arise because the first cycle draws all four.
`SpellTalentData` declares no `RarityChances`, so `GetTalentRarity` makes
every repeatable node `Common`.

Two shared talents declare `MaxCount` in `TraitData_Talent.lua`:
`ChargeRegenTalent` (`Growth`) at 1 and `PreChargeTalent` (`Preparation`) at 2.
Every other repeatable talent is unbounded.

The refill lists are fixed by the counts after each full cycle, and the draws
form one sequence of cycles, each a run of distinct talents from its list in
random order; only the last cycle can stop early. Repeatable nodes take that
sequence depth by depth, so each depth receives a fixed slice of it: a node can
hold only talents of the cycles its depth's slice covers, and a tree is
possible exactly when every depth's talents are its slice of some such
sequence. A cycle can straddle two depths, which then share its talents.

For example, Twilight Curse on Lung draws its first cycle, including its one
`Growth`, at depths 1–2; depth 3 holds each unbounded talent twice; `4:3`,
`5:2` and `5:4` hold the three unbounded talents once each. On Pyramid, depth 1
draws the whole first cycle and one talent of the second.

| Hex            | `Talents.Repeatable` (source order)                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| Twilight Curse | Purpose `CooldownDamageTalent`, Growth, Humility `PolymorphDurationTalent`, Exposure `PolymorphDamageTalent`          |
| Total Eclipse  | Purpose, Preparation, Vastness `MeteorSizeTalent`, Magnitude `MeteorDamageTalent`                                     |
| Dark Side      | Focus `TransformDurationTalent`, Bloodthirst `TransformDamageTalent`, Tension `TransformCooldownDodgeTalent`, Growth  |
| Wolf Howl      | Growth, Instinct `LeapDamageTalent`, Hunger `LeapArmorDamageTalent`, Urgency `LeapCooldownSpeedTalent`                |
| Lunar Ray      | Purpose, Growth, Intensity `LaserDamageTalent`, Bearing `LaserDefenseTalent`                                          |
| Night Bloom    | Purpose, Growth, Preparation, Devotion `SummonDamageTalent`                                                           |
| Phase Shift    | Preparation, Growth, Patience `TimeSlowAmountTalent`, Steadfastness `CooldownDefenseTalent`                           |
| Moon Water     | Purity `PotionManaRestoreTalent`, Abundance `PotionUsesTalent`, Vigor `HealAmountTalent`, Fortune `CurrencyUseTalent` |
| Sky Fall       | Growth, Omen `MoonBeamVulnerabilityTalent`, Sting `MoonBeamDamageTalent`, Brilliance `MoonBeamCountTalent`            |

## Activation on a writable screen

`UpdateTalentButtons` (`TalentScreenLogic.lua:287-330`) makes a node available
when it has no backlinks, when a backlink node is invested or queued on this
screen, or, for a `Bidirectional` node, when a `LinkTo` neighbour is invested
or queued. A Nacelle depth-2 node can therefore open from an invested depth-3
node reached through the other branch.

`OnTalentPressed` rejects an invested or queued node; every node costs one
selection and is invested once, so a repeatable talent's level is the number
of its invested nodes. `TryCloseTalentTree` queues each choice and closes the
screen only after the bank is spent or the tree is full; queued nodes become
invested together and cannot be refunded. Availability only grows as nodes
are queued, so whether a screen's selection set is legal does not depend on
its order. Absent Olympian nodes cannot be selected until inserted.

## Exact Hex candidate pools

### Twilight Curse (`Polymorph`)

| Runtime role | Game key                      | Player-facing name |
| ------------ | ----------------------------- | ------------------ |
| Rare         | `PolymorphBossDamageTalent`   | Ambition           |
| Rare         | `PolymorphDeathExplodeTalent` | Extinction         |
| Rare         | `PolymorphTauntTalent`        | Spread             |
| Rare         | `PolymorphTeleportCastTalent` | Orchestration      |
| Rare         | `PolymorphHealthCrushTalent`  | Decline            |
| Epic         | `PolymorphSandwichTalent`     | Sustenance         |
| Epic         | `PolymorphCurseTalent`        | Infection          |
| Olympian     | `PolymorphZeusTalent`         | Temper of Zeus     |

The Olympian extension is linked to Zeus and `ForceZeusBoonKeepsake`.

### Total Eclipse (`Meteor`)

| Runtime role | Game key                         | Player-facing name |
| ------------ | -------------------------------- | ------------------ |
| Rare         | `MeteorVulnerabilityDecalTalent` | Softness           |
| Rare         | `MeteorSlowDecalTalent`          | Numbness           |
| Rare         | `MeteorShowerTalent`             | Fragmentation      |
| Rare         | `MeteorChargeTalent`             | Consequence        |
| Epic         | `MeteorInvulnerableChargeTalent` | Eminence           |
| Epic         | `MeteorDoubleTalent`             | Devastation        |
| Epic         | `MeteorExCastTalent`             | Excess             |
| Olympian     | `MeteorHestiaTalent`             | Hearth of Hestia   |

The Olympian extension is linked to Hestia and `ForceHestiaBoonKeepsake`.

### Dark Side (`Transform`)

| Runtime role | Game key                           | Player-facing name  |
| ------------ | ---------------------------------- | ------------------- |
| Rare         | `TransformCastDamageTalent`        | Dominion            |
| Rare         | `TransformLastStandRechargeTalent` | Contingency         |
| Rare         | `TransformAttackSpeedTalent`       | Savagery            |
| Rare         | `TransformSpecialTalent`           | Splendor            |
| Epic         | `TransformPrimaryTalent`           | Resonance           |
| Epic         | `TransformSpecialCritTalent`       | Horror              |
| Epic         | `TransformExCastTalent`            | Sanctity            |
| Olympian     | `TransformAphroditeTalent`         | Allure of Aphrodite |

`TransformLastStandRechargeTalent` inherits its player-facing text from
`TimeSlowLastStandRechargeTalent`. The Olympian extension is linked to
Aphrodite and `ForceAphroditeBoonKeepsake`.

### Wolf Howl (`Leap`)

| Runtime role | Game key               | Player-facing name |
| ------------ | ---------------------- | ------------------ |
| Rare         | `LeapLaunchAoETalent`  | Duality            |
| Rare         | `LeapAoETalent`        | Vicinity           |
| Rare         | `LeapCritTalent`       | Lethality          |
| Rare         | `LeapSprintTalent`     | Tremor             |
| Epic         | `LeapShieldTalent`     | Tenacity           |
| Epic         | `LeapTwiceTalent`      | Brutality          |
| Olympian     | `LeapHephaestusTalent` | Hand of Hephaestus |

The Olympian extension is linked to Hephaestus and
`ForceHephaestusBoonKeepsake`.

### Lunar Ray (`Laser`)

| Runtime role | Game key                    | Player-facing name |
| ------------ | --------------------------- | ------------------ |
| Rare         | `LaserAoETalent`            | Dispersion         |
| Rare         | `LaserStartAoETalent`       | Overflow           |
| Rare         | `LaserPenetrationTalent`    | Exodus             |
| Rare         | `LaserDurationTalent`       | Obstinance         |
| Rare         | `LaserFirstHitDamageTalent` | Contact            |
| Epic         | `LaserTripleTalent`         | Trinity            |
| Epic         | `LaserCrystalTalent`        | Prominence         |
| Olympian     | `LaserApolloTalent`         | Shine of Apollo    |

The Olympian extension is linked to Apollo and `ForceApolloBoonKeepsake`.

### Night Bloom (`Summon`)

| Runtime role | Game key                  | Player-facing name |
| ------------ | ------------------------- | ------------------ |
| Rare         | `SummonSpeedTalent`       | Rigor              |
| Rare         | `SummonTeleportTalent`    | Confluence         |
| Rare         | `SummonPermanenceTalent`  | Servitude          |
| Rare         | `SummonRetaliateTalent`   | Retaliation        |
| Epic         | `SummonDamageSplitTalent` | Selflessness       |
| Epic         | `SummonExplodeTalent`     | Eruption           |
| Olympian     | `SummonHeraTalent`        | Nurture of Hera    |

The Olympian extension is linked to Hera and `ForceHeraBoonKeepsake`.

### Phase Shift (`TimeSlow`)

| Runtime role | Game key                           | Player-facing name |
| ------------ | ---------------------------------- | ------------------ |
| Rare         | `TimeSlowDestroyProjectilesTalent` | Purification       |
| Rare         | `TimeSlowSpeedTalent`              | Alacrity           |
| Rare         | `TimeSlowLastStandRechargeTalent`  | Contingency        |
| Rare         | `TimeSlowCumulativeBuffTalent`     | Accumulation       |
| Epic         | `TimeSlowCritTalent`               | Precision          |
| Epic         | `TimeSlowFreezeTimeTalent`         | Stillness          |
| Olympian     | `TimeSlowDemeterTalent`            | Squall of Demeter  |

The Olympian extension is linked to Demeter and `ForceDemeterBoonKeepsake`.

### Moon Water (`Potion`)

| Runtime role | Game key               | Player-facing name |
| ------------ | ---------------------- | ------------------ |
| Rare         | `DamageBuffTalent`     | Zeal               |
| Rare         | `ShieldTalent`         | Radiance           |
| Rare         | `RolloverUsesTalent`   | Conservation       |
| Rare         | `HealLastTalent`       | Panacea            |
| Epic         | `ClearCastTalent`      | Clarity            |
| Epic         | `HealRetaliateTalent`  | Tribulation        |
| Epic         | `PotionExCastTalent`   | Saturation         |
| Olympian     | `PotionPoseidonTalent` | Pride of Poseidon  |

The Olympian extension is linked to Poseidon and
`ForcePoseidonBoonKeepsake`.

### Sky Fall (`MoonBeam`)

| Runtime role | Game key                          | Player-facing name |
| ------------ | --------------------------------- | ------------------ |
| Rare         | `MoonBeamConsecutiveDamageTalent` | Ferocity           |
| Rare         | `MoonBeamDefenseTalent`           | Calm               |
| Rare         | `MoonBeamPrimaryTalent`           | Ambition           |
| Epic         | `MoonBeamTargetTalent`            | Prism              |
| Epic         | `MoonBeamExBeamBonusTalent`       | Cascade            |
| Olympian     | `MoonBeamAresTalent`              | Lance of Ares      |

The Olympian extension is linked to Ares and `ForceAresBoonKeepsake`.

## Olympian two-node extension

The extension consists of the selected Hex's one fixed Olympian duo talent
listed above plus the shared `OlympianSpellCountTalent` (`Lineage`). The game
does not choose among multiple duo identities for one Hex in the installed
declarations.

At initial tree generation, the pair is present only when the profile-level
Selene duo unlock is satisfied and either:

- the linked god is represented by a trait currently held by the hero; or
- the linked god's force-boon keepsake trait is currently held by the hero.

The source field is named `CurrentRun.Hero.MetGods`, but it is not a historical
"seen this run" set. `UpdateHeroTraitDictionary` reconstructs it from the
currently held traits by calling `GetGodSourceName` for every trait. It can
therefore gain a provider through a direct trait grant and lose a provider
when the final trait associated with that provider is removed. It is also
distinct from `LootTypeHistory` and from the ordinary god-pool record.

The force-keepsake side is equally current-state-based: the requirement reads
the linked `Force*BoonKeepsake` identity from `Hero.TraitDictionary`. A normal
equipped keepsake and an active Gift Gift Gift recreation can satisfy that
identity. Once the pair has actually been inserted, later provider-trait
removal or keepsake removal does not remove it.

### All Together is a provider-presence source

All Together is selected from a normal Hera upgrade screen. Its outer
`AllElementalBoon` is itself a currently held Hera trait, so it satisfies Night
Bloom's linked-Hera condition even when every direct-grant set is exhausted.

Before the normal upgrade screen's final `CheckAndAddOlympianDuo` call, All
Together's `GrantBoons` callback directly adds each authored child with
`FromLoot = true`. Each child is indexed by one Olympian loot declaration, so
the next `UpdateHeroTraitDictionary` includes that provider in `MetGods` even
though the grant did not increment `LootTypeHistory` or add that provider to
the ordinary god pool.

The exact child-to-Hex contacts are:

| Selected Hex   | Linked provider | All Together identity that satisfies it |
| -------------- | --------------- | --------------------------------------- |
| Twilight Curse | Zeus            | `ElementalDamageFloorBoon`              |
| Total Eclipse  | Hestia          | `ElementalBaseDamageBoon`               |
| Dark Side      | Aphrodite       | `ElementalDodgeBoon`                    |
| Wolf Howl      | Hephaestus      | `ElementalDamageBoon`                   |
| Lunar Ray      | Apollo          | `ElementalRallyBoon`                    |
| Night Bloom    | Hera            | outer `AllElementalBoon`                |
| Phase Shift    | Demeter         | `ElementalDamageCapBoon`                |
| Moon Water     | Poseidon        | `ElementalHealthBoon`                   |
| Sky Fall       | Ares            | `ElementalOlympianDamageBoon`           |

Selecting the other identity from the same All Together set does not satisfy
that Hex's linked-provider condition. The Planner already freezes all four
direct-grant results and records each granted identity with its exact giver, so
God Sent can consume the post-settlement equipped-trait state without adding
an All Together special flag.

### Reevaluation contacts

`CheckAndAddOlympianDuo` reevaluates the current predicate after a normal
upgrade choice, after Echo's explicit previous-run boon choice, and after a
keepsake-screen interaction. Tree creation performs the same eligibility check
while generating the initial tree. The post-choice check observes the complete
selected result, including direct grants and removals performed by the chosen
trait, rather than merely the outer giver that opened the screen.

Once a reevaluation finds the requirement true, it restores both previously
omitted positions and their links. The added nodes persist after the qualifying
trait or keepsake is removed; capacity must therefore remember that the pair
was added rather than continuously derive it from current state.

Athena's `OlympianSpellCountBoon` (`Task Force`) has one external eligibility
contact: it requires at least one of the nine Olympian talent identities to be
equipped. Exact acquisition timing depends on the investment path, so neither
generated pair presence nor aggregate invested points proves that predicate at
the relevant Athena offer.

The Planner models the predicate exactly: Task Force is eligible once the
God Sent Olympian node is among the invested nodes the authored Path screens
select, so the pair must have been inserted and that node invested before the
Athena offer. A settled Spell Drop or Aspect of Selene's built-in Sky Fall does
not qualify by itself. Live native ineligibility follows the
[Volatile Offer Eligibility audit](../rewards-and-acquisition/VOLATILE_OFFER_ELIGIBILITY_GAME_DATA_AUDIT.md).
No Path talent needs to enter the simulated equipped-trait ledger to support
Task Force.

## Full-tree closure, inspection, and committed delivery

`UpdateTalentPointInvestedCache` marks `AllSpellInvestedCache` true only when
every concrete node in the current tree is invested. `TalentLegal` rejects new
Talent Drops while that cache is true.

Late Olympian insertion exposes a source cache wrinkle:

1. `CheckAndAddOlympianDuo` can append two uninvested nodes to a tree;
2. it does not call `UpdateTalentPointInvestedCache`;
3. the only assignments to `AllSpellInvestedCache` occur inside that update
   function; and
4. ordinary `TalentLegal` therefore continues to observe the previously
   closed value.

The trait-tray inspection entry point does not repair this state or spend
points. It opens `OpenTalentScreen({ ReadOnly = true }, nil)`. Read-only screens
do not attach selection actions, do not add Path points, and skip the
investment branch on close. Banked points cannot be spent merely because new
Olympian nodes have appeared.

A Shrine of Hermes purchase is different. The item must satisfy `TalentLegal`
when the store is filled and purchased, but its pending-delivery trait stores
the concrete item. On expiry, `SpawnStoreItemInWorld` spawns that stored item
without reevaluating `TalentLegal`. A Talent Drop that was ordered legally is
therefore still delivered and opens a writable screen even if the tree closed
before maturity.

Investment never exceeds the concrete tree capacity. If a writable screen
opens on an already-full tree, no node is invested. The source nevertheless
adds `AddTalentPoints - 1` to its raw bank before discovering that the screen
is full, so an ordinary three-point delayed Talent Drop can leave two raw
points banked. Those points still require another writable acquisition screen;
read-only inspection cannot spend them.

## Current planner coverage

The catalog declares every layout's node graph and each Hex's Rare, Epic and
repeatable pools with their `MaxCount` limits; capacities and Rare/Epic
cardinalities are derived from the graph. The persisted tree is planner owned:
one layout and the talent on every non-Olympian node, generated by the default
fill and edited node by node. The module overwrites the native tree's
non-Olympian nodes with that map after `CreateTalentTree` keeps every native
draw, so node identities are not conformance facts. The persistent
Olympian-pair fact adds exactly two capacity. The prior-`TalentDrop` layout
requirement is a profile predicate and stays out of catalog data under the
fully progressed baseline.

Each node's Hex talent is an authored execution fact, and each writable Path
screen authors the nodes it invests. Settlement accumulates the invested nodes
across screens, derives the invested point count and each talent's level
(its invested node count) from them, and does not equip them into trait
history. Task Force requires the invested God Sent Olympian node. The module
marks planned nodes on the native screen but does not enforce them; conformance
checks only the invested point count and the invested Olympian fact. If native
eligibility rejects an authored result, execution reports a mismatch rather
than substituting another trait.

Talent Drop eligibility uses a latched closed state:

- closure begins false;
- a writable Path screen that completes the then-current tree closes future
  Talent Drop generation;
- once closed, later Olympian capacity does not reopen generation;
- read-only inspection never settles banked points; and
- already-committed deliveries bypass generation closure, open their writable
  screen, and clamp investment to the current capacity.

This matches the installed source's coded cache boundary without
embedding `AllSpellInvestedCache` as a planner-facing implementation concept.
If live-game confirmation later establishes that late Olympian insertion does
reopen ordinary Talent Drops, only this closure disposition changes; the layout
declarations, candidate pools, capacity, and committed-delivery rules remain
valid.

The audit does not prescribe a persisted schema, catalog module, or editor
component. Those ownership details remain with their owning implementation
authorities.
