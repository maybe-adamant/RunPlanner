# Hex Talent Layout Game-Data Audit

## Status and scope

Source audit completed on 2026-08-27 against installed Steam build `24556151`.
This document is the primary evidence authority for:

- the four generated Path of Stars layouts and their finite node capacities;
- the number of Rare and Epic nodes in each layout;
- the exact Rare and Epic candidate identities for every Hex;
- the two-node Olympian extension and its god/keepsake eligibility;
- the source's full-tree reward closure and late-extension cache behavior; and
- the boundary for authoring a frozen high-value composition without modeling
  the talent graph.

Base Hex identity and acquisition remain owned by the
[Selene Spell audit](../traits/SELENE_SPELL_GAME_DATA_AUDIT.md). Point grants,
the mutable point bank, initial Spell Drop bonuses, Aspect of Selene routing,
and Moon Beam contacts remain owned by the
[Path of Stars and Spell Drop audit](PATH_OF_STARS_AND_SPELL_DROP_GAME_DATA_AUDIT.md).

This audit does not model common/repeatable talent identities, graph
coordinates, links, prerequisites, investment order, or individual talent
effects. It records which high-value identities the generated tree contains,
not when those nodes become reachable or are invested.

## Sources

Primary evidence:

- `SpellData.lua`: `TalentTreeStructures` and the nine Hex talent pools;
- `SpellLogic.lua`: `CreateTalentTree`, `CheckAndAddOlympianDuo`, and
  `UpdateTalentPointInvestedCache`;
- `TalentScreenLogic.lua`: writable versus read-only screens, investment, and
  cache refresh;
- `TraitTrayLogic.lua`: the read-only inspection entry point;
- `TraitData_Talent.lua`: talent identities, duo links, and the shared
  `OlympianSpellCountTalent`;
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

| Source layout | Base nodes without Olympian pair | Rare positions | Epic positions | Capacity with Olympian pair |
| ------------- | -------------------------------: | -------------: | -------------: | --------------------------: |
| `Lung`        |                               16 |              2 |              1 |                          18 |
| `Pyramid`     |                               18 |              3 |              1 |                          20 |
| `Maze`        |                               22 |              3 |              2 |                          24 |
| `Nacelle`     |                               18 |              3 |              2 |                          20 |

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
are distinct within each rarity pool. Because this planner slice does not map
node coordinates or links, its truthful frozen outcome is an unordered set of
the required Rare identities and an unordered set of the required Epic
identities. Assigning those identities to hidden graph positions would add
false precision.

Player-facing names are not globally unique: `Ambition` is used by both
`PolymorphBossDamageTalent` and `MoonBeamPrimaryTalent`, while `Contingency` is
used by both last-stand recharge talents. Persisted identity must therefore use
the game key rather than the display name.

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
equipped. Exact acquisition timing depends on the omitted graph and investment
path, so neither generated pair presence nor aggregate invested points proves
that predicate at the relevant Athena offer.

The Planner can still enforce the necessary modeled prefix: one of the nine
base Hex traits must currently occupy the Spell state, including Aspect of
Selene's built-in Sky Fall. It does not claim that this proves acquisition of
the required Olympian node. The authored Task Force selection expresses that
deeper intent, while the declaration supplies requirement-free Athena
fallbacks for execution. The exact mapping is owned by the
[Runtime Offer Fallback audit](../rewards-and-acquisition/RUNTIME_OFFER_FALLBACK_AUDIT.md).
No generated Path talent needs to enter the simulated equipped-trait ledger
merely to support Task Force.

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

## Planner disposition

The planner will freeze one layout and the exact Rare/Epic identity sets
generated for that Hex while deliberately omitting graph coordinates and
ordinary-node identities. The layout owns the required cardinalities and base
capacity; the persistent Olympian-pair fact adds exactly two capacity.

Generated Hex talents remain execution-facing frozen identities. The Planner
does not simulate their individual acquisition, equip them into trait history,
or derive its Olympian-node eligibility from them. Task Force requires an
equipped base Hex in Planner history, keeps its deeper source requirement as a
runtime-offer fact, and uses the ordinary one-step fallback contract when the
preferred result is unavailable in game.

Talent Drop eligibility will use a latched closed state:

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
reopen ordinary Talent Drops, only this closure disposition should change; the
layout declarations, candidate pools, capacity, and committed-delivery rules
remain valid.

The audit does not prescribe a persisted schema, catalog module, editor
component, or delivery sequence. Those ownership and gate decisions belong in
the subsequent implementation plan.
