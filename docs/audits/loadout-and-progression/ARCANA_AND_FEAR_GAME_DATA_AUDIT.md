# Arcana and Fear Game-Data Audit

## Status

Source-fact audit completed against the installed Hades II scripts on
2026-08-11. This document records the game declarations and runtime behavior
needed to add a route-level Arcana and Fear loadout and to evaluate Circe's
Arcana/Fear choices. It does not prescribe the planner's persisted schema, UI,
or delivery gates.

## Sources

Primary evidence:

- `MetaUpgradeData.lua`
- `MetaUpgradeLogic.lua`
- `MetaUpgradeCardScreenLogic.lua`
- `TraitData_MetaUpgrade.lua`
- `TraitData_Circe.lua`
- `EventLogic.lua`
- `EncounterLogic.lua`
- `CombatLogic.lua`
- `ShrineLogic.lua`
- `HubPresentation.lua`
- English `TraitText.en.sjson`

The relevant game state is split across two authorities:

- Arcana configuration and permanent card level live in
  `GameState.MetaUpgradeState`; the current active set is its `Equipped` state.
- Fear configuration lives in `GameState.ShrineUpgrades`; run-local Circe
  suppression lives separately in `CurrentRun.ShrineUpgradesDisabled`.

## Arcana Card Layout

`MetaUpgradeDefaultCardLayout` is a fixed five-by-five board. Every one of the
25 cards declares a `TraitName` and three permanent upgrade levels. A card's
permanent level is mapped through `TraitRarityData.RarityUpgradeOrder`:

| Permanent level | Runtime trait rarity |
| --------------- | -------------------- |
| 1               | `Common`             |
| 2               | `Rare`               |
| 3               | `Epic`               |

The following table records the default board, player-facing label, attached
trait, Grasp cost, and ordinary activation class. A missing explicit cost
inherits the base cost of one. Zero-cost cards with live
`AutoEquipRequirements` are automatic; `BonusDodge` contains a commented-out
historical auto-equip block and remains manually activated in the live game.

| Row | Column | Game key              | Label            | Trait key                        | Grasp | Ordinary activation |
| --- | ------ | --------------------- | ---------------- | -------------------------------- | ----- | ------------------- |
| 1   | 1      | `ChanneledCast`       | The Sorceress    | `ChannelSlowMetaUpgrade`         | 1     | manual              |
| 1   | 2      | `HealthRegen`         | The Wayward Son  | `DoorHealMetaUpgrade`            | 1     | manual              |
| 1   | 3      | `LowManaDamageBonus`  | The Huntress     | `LowManaDamageMetaupgrade`       | 2     | manual              |
| 1   | 4      | `CastCount`           | Eternity         | `CastDamageMetaUpgrade`          | 3     | manual              |
| 1   | 5      | `SorceryRegenUpgrade` | The Moon         | `SorceryRegenMetaUpgrade`        | 0     | automatic           |
| 2   | 1      | `CastBuff`            | The Furies       | `InsideCastBuffMetaUpgrade`      | 2     | manual              |
| 2   | 2      | `BonusHealth`         | Persistence      | `HealthManaBonusMetaUpgrade`     | 2     | manual              |
| 2   | 3      | `BonusDodge`          | The Messenger    | `DodgeBonusMetaUpgrade`          | 1     | manual              |
| 2   | 4      | `ManaOverTime`        | The Unseen       | `ManaOverTimeMetaUpgrade`        | 5     | manual              |
| 2   | 5      | `MagicCrit`           | Night            | `MagicCritMetaUpgrade`           | 2     | manual              |
| 3   | 1      | `SprintShield`        | The Swift Runner | `SprintShieldMetaUpgrade`        | 1     | manual              |
| 3   | 2      | `LastStand`           | Death            | `LastStandSlowTimeMetaUpgrade`   | 4     | manual              |
| 3   | 3      | `MaxHealthPerRoom`    | The Centaur      | `ChamberHealthMetaUpgrade`       | 0     | automatic           |
| 3   | 4      | `StatusVulnerability` | Origination      | `EffectVulnerabilityMetaUpgrade` | 5     | manual              |
| 3   | 5      | `ChanneledBlock`      | The Lovers       | `BossShieldMetaUpgrade`          | 3     | manual              |
| 4   | 1      | `DoorReroll`          | The Enchantress  | `DoorRerollMetaUpgrade`          | 3     | manual              |
| 4   | 2      | `StartingGold`        | The Boatman      | `StartingGoldMetaUpgrade`        | 5     | manual              |
| 4   | 3      | `MetaToRunUpgrade`    | The Artificer    | `MetaToRunMetaUpgrade`           | 3     | manual              |
| 4   | 4      | `RarityBoost`         | Excellence       | `RarityBoostMetaUpgrade`         | 5     | manual              |
| 4   | 5      | `BonusRarity`         | The Queen        | `DuoRarityBoostMetaUpgrade`      | 0     | automatic           |
| 5   | 1      | `TradeOff`            | The Fates        | `RerollTradeOffMetaUpgrade`      | 0     | automatic           |
| 5   | 2      | `ScreenReroll`        | The Champions    | `PanelRerollMetaUpgrade`         | 4     | manual              |
| 5   | 3      | `LowHealthBonus`      | Strength         | `LowHealthBuffMetaUpgrade`       | 4     | manual              |
| 5   | 4      | `EpicRarityBoost`     | Divinity         | `EpicRarityBoostMetaUpgrade`     | 0     | automatic           |
| 5   | 5      | `CardDraw`            | Judgment         | `BossProgressionMetaUpgrade`     | 0     | automatic           |

## Ordinary Arcana Activation

### Manual cards

The live board has 19 manually activated cards. The card screen permits the
player to toggle those cards directly while respecting the current Grasp
limit. The six automatic cards cannot be manually enabled when their awakening
condition is false.

### Automatic cards

`CheckAutoEquipRequirements` counts only active cards that do **not** declare
`AutoEquipRequirements` for its Grasp-cost and total-card predicates. Spatial
predicates inspect the actual active board and therefore can see already-active
automatic cards.

| Game key              | Label       | Exact ordinary trigger                                                                                                       |
| --------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `SorceryRegenUpgrade` | The Moon    | At least one of its eight surrounding cells is active. On the default board those cells are Eternity, The Unseen, and Night. |
| `MaxHealthPerRoom`    | The Centaur | The manually active cards include at least one card at every Grasp cost from 1 through 5.                                    |
| `BonusRarity`         | The Queen   | At least one manual card is active and no Grasp-cost value occurs more than twice among the manually active cards.           |
| `TradeOff`            | The Fates   | Every surrounding cell is active. At its corner position these are The Enchantress, The Boatman, and The Champions.          |
| `EpicRarityBoost`     | Divinity    | All five cards in any other complete row or any other complete column are active.                                            |
| `CardDraw`            | Judgment    | Between one and three manual cards, inclusive, are active.                                                                   |

The game first evaluates automatic-card requirements from the board state and
then applies the resulting active/inactive changes. Automatic activation is a
derived property of the configured board; it does not consume Grasp.

### Resolved active state

For runtime consumers, the game deliberately converges these origins onto one
fact: `GameState.MetaUpgradeState[cardName].Equipped`. Circe's Arcana effects
and the hero's Arcana trait installation consume this resolved active state,
not a manual-only list.

The origins nevertheless remain distinguishable:

- manual cards are the player's Grasp-bearing configuration;
- automatic cards are derived from the manual/resolved board;
- temporary cards are recorded in `CurrentRun.TemporaryMetaUpgrades` after a
  run-local random activation.

## Run-Local Random Arcana Activation

`AddRandomMetaUpgrades` is the shared operation used by Red Citrine Divination,
Judgment, and other later effects. It:

1. collects every unlocked card in the board that is not currently active;
2. chooses the requested number of distinct cards;
3. records each in `CurrentRun.TemporaryMetaUpgrades`;
4. sets the card's ordinary `Equipped` fact to true;
5. installs the card's trait at its permanent card level unless the caller
   supplies an explicit rarity override.

The operation does not re-check a card's ordinary manual/automatic activation
rule. An inactive automatic card is therefore a valid temporary draw and can
remain active even while its awakening condition is false.

Three selection details affect weighting or external modes but not the normal
positive-probability support:

- `CastCount`/Eternity has `RandomDrawChance = 0.1`; a failed roll moves it to
  a fallback pool, so it remains a possible result.
- `TradeOff`/The Fates names `ScreenReroll` and `DoorReroll` as preferred
  companion cards; when neither is active, it is deprioritized while
  alternatives remain but does not become impossible.
- the game's Fated mode removes `DoorReroll`, `ScreenReroll`, and `TradeOff`
  from this random-draw domain. That is a distinct run mode, not an ordinary
  Arcana-loadout rule.

### Red Citrine Divination

`RandomArcanaTrait` calls `AddRandomMetaUpgrades` with a base count of one.
Circe's menu uses internal Common scaling, so Red Citrine activates exactly one
inactive card; this is not player-facing boon rarity. Under a fully progressed
rank-III baseline, the newly installed Arcana trait begins at Epic.

### Judgment

`CardDraw` installs `BossProgressionMetaUpgrade`. Its `PostBossCards` base is
three and its permanent Arcana rank scales that effect as follows:

| Judgment rank | Trait rarity | Cards activated after each defeated boss |
| ------------- | ------------ | ---------------------------------------- |
| 1             | Common       | 3                                        |
| 2             | Rare         | 4                                        |
| 3             | Epic         | 5                                        |
| 4             | Heroic       | 6                                        |

`TriggerPostBossEvents` calls the same `AddRandomMetaUpgrades` operation after
a boss when the derived `PostBossCards` value is positive and
`CurrentRun.EnteredBiomes < GameData.FullRunBiomeCount`. The planner derives
that full-run count from the catalog route structure rather than the currently
configured authored prefix. Each trigger draws
from the then-inactive set, so previously activated temporary cards cannot be
drawn again.

The source chronology is explicit at the shared boss seam: `TriggerPostBossEvents`
invokes Judgment's `AddRandomMetaUpgrades(PostBossCards)` before the
`BossMetaUpgradeKeepsake` Figurine invocation of `AddRandomMetaUpgrades(2,
RarityLevel)`. `MetaUpgradeLogic.lua` mutates each selected card's resolved
`Equipped` state synchronously; presentation is downstream of that mutation.
The planner therefore treats Figurine's domain as a fresh inactive-card query
after Judgment, rather than as a second draw from the pre-Judgment frontier.

The same rank multipliers are source-backed for other run-local Arcana uses:
`TraitData_MetaUpgrade.lua` declares the `MetaUpgradeTrait` multipliers as
1/2/3/4, and `MetaToRunMetaUpgrade` supplies a base conversion-use value of 1,
giving The Artificer capacities Common/Rare/Epic/Heroic of 1/2/3/4. These
values apply to a temporary Arcana card at its source rarity; they do not
change the ordinary Judgment default path.

## Run-Local Arcana Rarity Upgrade

Lapis Lazuli Insight (`ArcanaRarityTrait`) requests two targets. The game
builds its domain from cards that are:

- currently active, regardless of whether activation was manual, automatic,
  or temporary;
- backed by a `TraitName` whose trait is currently installed on the hero;
- at a rarity with a supported next rarity.

Each selected card's installed trait is removed and re-added one rarity step
higher. The card's permanent `GameState.MetaUpgradeState.Level` is not changed.
The upgrade is therefore a run-local Arcana-trait rarity override. The normal
three permanent ranks map through Epic, while Lapis can create Heroic Arcana
traits for the current run.

The selection loop removes each chosen candidate, so its two outcomes are
distinct when at least two eligible cards exist. If fewer than two candidates
exist, the game upgrades the candidates that do exist and stops when the set
is empty.

Because Judgment's card count is a rarity-scaled trait value, upgrading an
active Epic Judgment trait to Heroic changes its postboss activation count
from five to six.

## Fear Loadout

Fear is represented as a rank per Vow. Rank zero is inactive. Each reached
rank contributes its own `Points` value, and `GetTotalSpentShrinePoints` sums
the contributions from rank one through the selected rank.

| Game key                        | Label          | Maximum rank | Incremental Fear by rank | Total Fear at each rank | Circe-removable |
| ------------------------------- | -------------- | ------------ | ------------------------ | ----------------------- | --------------- |
| `HealingReductionShrineUpgrade` | Vow of Scars   | 3            | 1, 1, 2                  | 1, 2, 4                 | yes             |
| `ShopPricesShrineUpgrade`       | Vow of Debt    | 2            | 1, 1                     | 1, 2                    | yes             |
| `EnemyHealthShrineUpgrade`      | Vow of Grit    | 3            | 1, 1, 1                  | 1, 2, 3                 | yes             |
| `EnemyDamageShrineUpgrade`      | Vow of Pain    | 3            | 1, 2, 2                  | 1, 3, 5                 | yes             |
| `EnemySpeedShrineUpgrade`       | Vow of Frenzy  | 2            | 3, 3                     | 3, 6                    | yes             |
| `EnemyShieldShrineUpgrade`      | Vow of Wards   | 2            | 1, 1                     | 1, 2                    | yes             |
| `EnemyCountShrineUpgrade`       | Vow of Hordes  | 3            | 1, 1, 1                  | 1, 2, 3                 | yes             |
| `EnemyRespawnShrineUpgrade`     | Vow of Return  | 2            | 1, 1                     | 1, 2                    | yes             |
| `NextBiomeEnemyShrineUpgrade`   | Vow of Menace  | 2            | 1, 2                     | 1, 3                    | yes             |
| `BiomeSpeedShrineUpgrade`       | Vow of Time    | 3            | 1, 2, 3                  | 1, 3, 6                 | yes             |
| `MinibossCountShrineUpgrade`    | Vow of Shadow  | 1            | 2                        | 2                       | yes             |
| `BossDifficultyShrineUpgrade`   | Vow of Rivals  | 4            | 2, 3, 3, 4               | 2, 5, 8, 12             | **no**          |
| `BoonSkipShrineUpgrade`         | Vow of Forfeit | 1            | 3                        | 3                       | yes             |
| `BoonManaReserveShrineUpgrade`  | Vow of Hubris  | 2            | 1, 1                     | 1, 2                    | yes             |
| `BanUnpickedBoonsShrineUpgrade` | Vow of Denial  | 1            | 2                        | 2                       | yes             |
| `LimitGraspShrineUpgrade`       | Vow of Void    | 4            | 1, 1, 1, 2               | 1, 2, 3, 5              | yes             |
| `EnemyEliteShrineUpgrade`       | Vow of Fangs   | 2            | 2, 3                     | 2, 5                    | yes             |

Vow of Rivals is the only declaration with
`IneligibleForCirceRemoval = true`.

## Run-Local Fear Suppression

Black Night Banishment (`RemoveShrineTrait`) is offered only when at least one
configured Vow has rank greater than zero and is not marked ineligible for
Circe removal. Its normal-run internal Common scaling chooses exactly one such
Vow; the Circe trait itself is player-rarityless.

The effect does not change `GameState.ShrineUpgrades` or the selected rank. It
sets `CurrentRun.ShrineUpgradesDisabled[vowKey] = true`. Runtime Shrine queries
then treat that Vow as rank zero or return its inactive value for the rest of
the run. The configured Fear total remains based on the original selected
ranks even though the Vow's gameplay effect is suppressed.

Several Vows also run an immediate cleanup hook when disabled. Examples in the
current declarations include removing Vow of Pain's damage modifier, ending
Vow of Time's biome timer, and releasing Vow of Hubris's Magick reservation.
Those hooks implement the same semantic result: the selected Vow remains part
of the starting Fear loadout but is inactive after Circe.

Apart from run initialization/reset, the installed scripts contain no other
writer to `CurrentRun.ShrineUpgradesDisabled`. Circe is the only run-time
effect that changes which configured Vow is active during an ordinary run.

## Cross-Domain Interaction

Vow of Void changes the available Grasp percentage. Its inactive value is
`100`; ranks I through IV declare `60`, `40`, `20`, and `0`. The exit guard
compares the equipped-card cost ratio against that percentage. With the
planner's fully progressed 30-Grasp baseline, the exact starting capacities
are therefore 30, 18, 12, 6, and 0 at ranks zero through IV. This constrains
which manual Arcana configuration the player can actually bring into the run. It
does not change the Arcana automatic-activation predicates themselves, and
Black Night disabling it does not retroactively replace the player's starting
manual Arcana selection.

The two domains otherwise remain separate until Circe:

- Arcana activation and rarity changes operate on the resolved active Arcana
  state and its installed traits.
- Fear removal operates on configured positive-rank Vows and a separate
  run-local disabled set.

## Stable Conclusions

1. A pre-run Arcana loadout cannot be represented only as an undifferentiated
   active-card set if the planner intends to validate activation rules: 19
   cards are manually selected and six are derived automatic activations.
2. Runtime consumers do use one resolved active set. Circe and Judgment may
   temporarily activate either manual or automatic card declarations without
   satisfying their ordinary activation rules.
3. Arcana permanent level and run-local trait rarity are distinct. Lapis
   changes only the latter.
4. Red Citrine and Judgment share one random inactive-card operation with
   different counts and trigger timing.
5. Fear requires a rank per Vow, not a boolean, both to describe the selected
   loadout and to calculate its Fear total.
6. Black Night disables one eligible active Vow for the run without altering
   its configured rank. Vow of Rivals is the sole excluded target.

## Planner Disposition

Schema 21 established the Arcana/Fear and Circe subset: rank-III card
baselines, ordinary automatic activation, manual Arcana and ranked Fear
loadouts, configured versus effective Fear, temporary Arcana activation,
Lapis promotion, Black Night suppression, Judgment's exact post-Boss draws,
and Circe's nine player-rarityless choices. Schema 22 adds the two supported
reward-facing Vow effects without introducing a generic Fear interpreter:
Denial records exact displayed unselected Olympian/Hermes traits in the folded
route history, and Forfeit records one ordinary-room acquisition veto per
biome. Black Night stops future effects but does not erase prior bans or
restore an already vetoed acquisition.

Catalog declarations own card/Vow data, the three closed effect payloads, exact
Denial participation, and Judgment's rarity-scaled count; the engine owns the
progressive state, target domains, exact authored outcomes, banned history, and
Forfeit usage. The catalog also owns Void's source percentages and the fixed
30-Grasp baseline; the engine rejects starting manual selections above the
configured capacity without applying that limit to automatic or run-local
Arcana grants. Fated mode, permanent card advancement, and every other ordinary
Vow gameplay effect remain deliberately out of scope.

Schema 41 adds the Artificer's supported reward-facing effect without changing
the pre-run loadout model. The catalog owns Common/Rare/Epic/Heroic capacity
one/two/three/four. Canonical run-local Arcana state records exact successful source
interactions rather than a mutable remaining counter; remaining uses are
derived from current rarity and spent evidence. Lazuli promotion therefore
preserves every spent use and adds exactly one remaining use. Concrete source
eligibility, `RunProgress` bag consumption, source destruction, and later
replacement acquisition remain reward/lifecycle authorities rather than a
generic Arcana callback system.
