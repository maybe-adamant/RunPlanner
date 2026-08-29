# Room Features Game-Data Audit

## Status and scope

This is the consolidated source audit for the optional and automatic room
features that are consequential to the modeled run: natural resource element
gains, Pools of Purging, Shrines of Hermes, and Stygian Wells. It records source
contacts, realized hosts, spacing and physical-capacity rules, inventories,
effect matrices, bounded uncertainties, and the current schema-71 planner
dispositions.

This audit owns feature-specific game facts. The shared post-encounter
interaction boundary is owned by [Acquisition Delivery and Room
Settlement](../rewards-and-acquisition/ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md), and the one entered-
room chronology and fixed lifecycle checkpoints are owned by [Room Action
Order](../rooms-and-routes/ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md). Those authorities are linked
here rather than reproduced as a second lifecycle matrix. This document does
not prescribe schema, commands, UI, module boundaries, or delivery sequencing.

The evidence below was checked against the installed Hades II scripts on the
dates retained from the focused audits: 2026-08-16 for Resources and Shrines,
2026-08-24 for Pools and Wells. Source evidence is not a claim of live-game
validation.

## Source and disposition map

| Superseded source                            | Unique claims retained here or in the surviving authority                                                                                                                                                                                                                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Natural Resources source audit               | Resource tool/element mapping, successful interaction boundary, run-local cap, point spacing/capacity/room declaration matrix, and selected-success planner abstraction retained in **Natural Resources**.                                                                                                                  |
| Purging Pool source audit                    | Physical F/G/H Postboss hosts, challenge-switch realization, shop-aware candidate predicate, stack removal, reroll boundary, and schema-71 sale disposition retained in **Pools of Purging**.                                                                                                                               |
| Shrine delivery source audit                 | Shrine host/chance/anchor matrix, three-offer inventory, pending delivery/rush/forced completion, Spell reservation, Travel Deal refill, and schema-71 disposition retained in **Shrines of Hermes**. Shared acquisition ordering remains in the acquisition and room-action authorities.                                   |
| Stygian Well source audit                    | Well host/spacing/anchor matrix, complete 25-identity effect table, repeat and temporary-use exceptions, consequential items, and schema-71 disposition retained in **Stygian Wells**. Ixion's exact SecretPoint host/count matrix remains with the [route-detour authority](../rooms-and-routes/ROUTE_DETOUR_FINDINGS.md). |
| Shop and Well lifecycle source audit         | Shared Shop/Well/Shrine post-outgoing boundary and RequiredNotInStore conclusion already survive in `../rewards-and-acquisition/ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md`; feature-specific pool facts are retained in this audit.                                                                                       |
| Boss completion source audit                 | Boss-death/Judgment and effect-neutral reward facts are retained in the Boss section of `../rooms-and-routes/ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md`; Shrine delivery remains here only for its feature-specific source facts.                                                                                                |
| Fountain and Postboss lifecycle source audit | Fountain, persistent N Hub, Postboss, rack, and Cleanup chronology are retained in the Fountains and Postboss section of `../rooms-and-routes/ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md`; Well/Shrine availability remains here.                                                                                                 |

The map is claim-level rather than filename-based: a superseded audit is
removed only after the listed claims have a surviving home and its inbound
links have been repaired.

## Natural Resources

### Source contacts and scope

Primary sources are `WeaponShopData.lua` for the four level-two tools;
`HarvestLogic.lua` for `GrantElementFromTool`, the four manual interaction
paths, and `AutoHarvestOnExit`; `HarvestPresentation.lua` for successful
manual fishing; `RoomLogic.lua` for the exit-time checkpoint;
`RunLogic.lua` for run-local `ToolElementsSpawned`; and
`TraitData_Essence.lua` for the resulting hidden traits. The focused evidence
was checked on 2026-08-16.

Meta-resource yields, gathering probabilities, tool costs, and presentation
are outside this audit unless they change element support. The colloquial
“herbing grants Earth” is not exact: Earth belongs to the upgraded Shovel's
digging interaction, not ordinary `HarvestPoint` flora.

### Tool, chance, and element matrix

| Successful interaction        | Source tool        | Upgraded tool       | Base chance | Resulting trait | Element |
| ----------------------------- | ------------------ | ------------------- | ----------: | --------------- | ------- |
| Fully mine a deposit          | `ToolPickaxe`      | `ToolPickaxe2`      |        0.50 | `FireEssence`   | Fire    |
| Successfully exorcise a shade | `ToolExorcismBook` | `ToolExorcismBook2` |        0.50 | `AirEssence`    | Air     |
| Dig a seed/resource spot      | `ToolShovel`       | `ToolShovel2`       |        0.50 | `EarthEssence`  | Earth   |
| Successfully catch a fish     | `ToolFishingRod`   | `ToolFishingRod2`   |        0.50 | `WaterEssence`  | Water   |

`GrantElementFromTool` requires the named upgraded tool, rejects a tool that
has already succeeded during the run, and rejects a dead hero. An eligible
attempt rolls `ElementChance * LuckMultiplier`; 0.50 is the base chance, not a
guaranteed result. A failed roll does not spend the tool. A success sets
`CurrentRun.ToolElementsSpawned[toolName]`, so each exact upgraded tool can
grant at most one element in a run. The four families are independent and can
therefore yield at most one Fire, Air, Earth, and Water.

The roll is reached only after a successful boundary: digging after the reward
is granted, mining after the deposit is fully depleted, exorcism after the
successful resource sequence, and fishing after a successful catch. Cancelled,
failed, partial, or unusable interactions do not roll.

### Manual and automatic collection

Manual paths call `GrantElementFromTool` directly. With
`WorldUpgradeAutoHarvestOnExit`, `AutoHarvestOnExit` finds still-usable
Harvest, Shovel, Pickaxe, Exorcism, and Fishing points during `LeaveRoom` and
invokes their exit-use functions with presentation delays suppressed. It does
not grant a second roll after a point was manually consumed; it consumes a
still-usable point through the same per-tool success cap.

Exit collection occurs after room-local Cleanup interactions and exit
selection, before the next room starts. Its element can affect the next room,
not decisions already resolved in the room being left. The resulting hidden
traits inherit `FireBoon`, `AirBoon`, `EarthBoon`, and `WaterBoon` respectively
and participate in ordinary element and infusion logic; accompanying meta
resources are not the modeled effect.

### Point spacing, capacity, and room declarations

The element roll is downstream of physical point generation. The source
lookback requirements are:

| Family          | Same-family lookback                      |
| --------------- | ----------------------------------------- |
| Shovel / Earth  | no Shovel point in the previous 4 rooms   |
| Pickaxe / Fire  | no Pickaxe point in the previous 4 rooms  |
| Exorcism / Air  | no Exorcism point in the previous 6 rooms |
| Fishing / Water | no Fishing point in the previous 5 rooms  |

Every family also excludes every other tool-point family in the immediately
previous room. N expands off-diagonal windows to three rooms and uses
same-family windows of 12 (Shovel/Pickaxe), 16 (Exorcism), and 14 (Fishing);
H uses a two-room same-family window. Each family normally has a per-biome
limit of one; a matching familiar raises that limit by one; a declaration can
force a point or ignore the biome limit. These are point-generation facts, not
element cooldowns. A spawned point that fails its element roll still consumes
spacing and biome-count capacity in the game.

| Tool-point family | Default ordinary room families | Chaos declaration |
| ----------------- | ------------------------------ | ----------------- |
| Pickaxe / Mine    | F, G, H, I, N, O, P, Q         | Yes               |
| Exorcism / Spirit | F, G, H, I, N, O, P, Q         | No                |
| Shovel / Dig      | F, G, H, I, N, O, P, Q         | Yes               |
| Fishing / Fish    | F, G, H, I, P, Q               | Yes               |

Individual room declarations override these defaults. N and O default
Fishing to false but have specific positive rooms. Chaos disables Exorcism but
can declare the other three. Source declaration contacts are
`RoomDataF.lua` through `RoomDataQ.lua` and `RoomDataChaos.lua`; conditional
`*PointForceRequirements` occur at F Opening/Boss, G/H/I/P/Q PreBoss, I Boss,
N PreHub/Boss, and O Boss. Their profile, familiar, and meta-resource
predicates remain unmodeled and do not become guaranteed points.

| Room kind                                  | Declared families                                                              | Capacity after point generation                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary room                              | Shovel, Pickaxe, Exorcism, and Fishing when declaration and requirements allow | At most one simple point (Shovel/Pickaxe, except two forced simple points) and one complex point (Exorcism/Fishing); one simple and one complex may coexist |
| `AllowOnlyOneToolHarvestableResource` room | Any family that passes its requirements                                        | At most one tool-backed point across all four                                                                                                               |
| Chaos                                      | Shovel, Pickaxe, Fishing; Exorcism disabled by base declaration                | At most one tool-backed point across declared families; ordinary biome limits ignored, all-tool capacity retained                                           |

The focused declaration evidence includes: F Fishing disabled in
MiniBoss01/02, Combat02/03/09/22, Boss01, PostBoss01; G Boss01 disables all;
H Fishing disabled in MiniBoss01, Combat05/09/13, Boss01 and all families in
PostBoss01; I Fishing disabled in Combat02/03/04/05/08/09/15/16/18/20/21/22,
MiniBoss01/03, Story01 while MiniBoss02 enables it; N Fishing enabled only in
Opening01, Shop01, PreBoss01, Combat16, Story01, all Hub points disabled,
Fishing disabled in Sub01-15, and Exorcism disabled in Combat08; O Fishing
enabled only in Intro, Boss01, Devotion01, Reprieve01, Story01 and all
PostBoss01 points disabled; P Fishing disabled in Combat02/04/08/09/12/18/19,
MiniBoss01/02, Boss01 and Exorcism disabled in Combat09; Q Fishing disabled
in Combat03/08 and all families in Boss01. Chaos_01-06 inherit the Chaos base
table. F/G Reprieve and Story, N Story, and O Reprieve/Story ignore biome
limits.

### Current planner disposition

The planner chooses one protected selected-success singleton per upgraded tool
family. An authored `Add` for Mine, Exorcism, Dig, or Fish means the selected
successful interaction, not an arbitrary physical point or a free probability
checkbox. The selected room must be declaration-eligible, reserve its
source-required lookback and room-local capacity, and acquire exactly one
matching element at the automatic room-exit checkpoint. Failed rolls, meta-only
points, familiar capacity, and manual-versus-auto choice are not modeled.
If a fixed or separately modeled point cannot be suppressed, it makes an
incompatible selected-success placement unavailable rather than being treated
as a hidden failed roll.

Every raw room declaration explicitly names supported families, including an
empty list; the normalized catalog owns support, mapping, lookback, and
capacity. An authored placement made impossible by later edits remains
repairable invalid state rather than being silently moved or removed.

## Pools of Purging

### Source contacts and realized hosts

The evidence was checked on 2026-08-24. Primary sources are
`RoomDataF.lua:2561-2640`, `RoomDataG.lua:1053-1123`,
`RoomDataH.lua:1852-2012`; `RoomLogic.lua:4064-4069, 4891-4918`;
`ObstacleData.lua:3312-3365`; and `SellTraitLogic.lua:1-53, 71-92, 327-386`
with `TraitLogic.lua:1202-1210, 1547-1559` for removal and history.

The only supported physical hosts are `F_PostBoss01`, `G_PostBoss01`, and
`H_PostBoss01`. F/G declare `SellShopSpawnChance = 1.0` and require
`WorldUpgradePostBossSellTraitShops`; H declares chance 1.0 without that local
requirement. Each owns a Postboss `ChallengeSwitchBase` slot. The surface
`SellTraitShrineUpgrade = true` marker is not the realization rule and does
not create a Pool outside these hosts. `HandleSecretSpawns` requires a
remaining physical challenge-switch ID and `IsSellTraitShopEligible` success.

The Pool remains locked during the encounter. `DoUnlockRoomExits` makes it
usable only after outgoing exits are generated, so a sale cannot alter the
already-generated exits. Physical challenge-switch capacity is shared with
other switch-backed features; the source exposes no generic room-feature
count.

### Offers and sale effects

`GenerateSellTraitValues` retains current traits only when
`IsGodTrait(name, { ForShop = true })` and `trait.Rarity` hold. `ForShop = true`
admits Hermes and eligible field-loot sources marked
`TreatAsGodLootByShops`; unslotted and Duo traits can therefore qualify.
The candidate map is keyed by trait name, and `GenerateSellTraitShop` selects
up to three distinct random names without replacement. The player may sell
any displayed entry or none. Selling one displayed name calls
`RemoveWeaponTrait(name)` until no instance remains, so all stacks of that
name are removed. Gold amount, permanent-upgrade requirements, and pricing are
sim-neutral.

The Pool participates in the shared Store reroll system. A reroll excludes one
random previous option while other previous options can return. Rerolls and
currency are global Store behavior, not a Pool-owned modeled rule.

### Current schema-71 planner disposition

Schema 59 represents forced physical Pools on the F/G/H Postboss occurrences.
An uninteracted Pool keeps dormant runtime-random inventory and contributes no
candidate, action, or simulation effect. Interaction activates an exact final
list of up to three distinct eligible names; the authored list is the outcome
after unmodeled rerolls. Each selected sale is an ordinary ranked Cleanup
action, validates against the shop-aware God-trait predicate at Pool entry,
requires the selected name to remain equipped at its action prefix, removes
every current stack, and retains previously-picked history for
`BlockOfferIfPreviouslyPicked` behavior.

## Shrines of Hermes

### Source contacts, appearance, and physical capacity

The evidence was checked on 2026-08-16. Primary sources are `RoomData.lua` and
`RoomDataI/N/O/P/Q.lua`; `RoomLogic.lua` (`HandleSecretSpawns`,
`IsSurfaceShopEligible`, `EndEncounterEffects`, `DoUnlockRoomExits`);
`StoreData.lua`, `StoreLogic.lua`, `SurfaceShopData.lua`,
`SurfaceShopLogic.lua`; `TraitData.lua`, `TraitLogic.lua`,
`EventPresentation.lua`, `NPCData_Hermes.lua`; and
`EncounterSets.lua`, `RequirementsData.lua`, `RequirementsLogic.lua`.

Base eligibility requires `WorldUpgradeSurfaceShops`, `BiomeDepthCache >= 3`,
no SurfaceShop in the previous three rooms, and a loaded-map
`ChallengeSwitchBase`. Base chance is zero; declarations provide:

| Host family         | Chance / rule                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `N_Shop01`          | 0.25                                                                                       |
| Eligible N subrooms | 0.08                                                                                       |
| Ordinary O          | 0.125                                                                                      |
| Ordinary P          | 0.13                                                                                       |
| Ordinary Q          | 0.10                                                                                       |
| N/O/P Postboss      | forced at 1.0, subject to Postboss Shrine upgrade                                          |
| O/P Reprieve        | chance 1.0                                                                                 |
| I                   | no ordinary Shrine spawn chance; participates only in final delivery through `I_PreBoss01` |

The `SumPrevRooms = 3` requirement reads the current room plus the two latest
`RoomHistory` entries without filtering biome, encounter, room class, Hub,
side room, Shop, Boss/Postboss, or Chaos. A forced room bypasses the ordinary
eligibility requirement. The exact map-anchor matrix is:

| Route | Ordinary maps with a `ChallengeSwitchBase`                                |
| ----- | ------------------------------------------------------------------------- |
| N     | `N_Sub01`-`N_Sub04`, `N_Sub06`-`N_Sub15`                                  |
| O     | `O_Combat02`-`O_Combat15`, `O_Devotion01`, `O_MiniBoss02`, `O_Reprieve01` |
| P     | `P_Combat01`-`P_Combat03`, `P_Combat05`-`P_Combat19`, `P_Reprieve01`      |
| Q     | `Q_Combat01`-`Q_Combat13`, `Q_Combat16`                                   |

Declaration-eligible zero-anchor exceptions are `N_Shop01`, `N_Sub05`,
`O_Combat01`, `O_MiniBoss01`, `P_Combat04`, `Q_Combat14`, and `Q_Combat15`.
Intro, Hub, Story, ordinary Shop, Boss, Preboss, and Q Postboss maps have no
usable anchor. N/O/P Postboss maps retain an anchor. `HandleSecretSpawns`
consumes anchors sequentially across Well, Sell Shop, Shrine, Challenge
Switch, and Meta Reward Stand; Resources, fountains, Gift Racks, and Nemesis
use separate systems. The source exposes no generic `NumRoomFeatures` or
passive-feature capacity.

### Inventory and effect matrix

`SurfaceShop` produces exactly three initial offers: one weighted first-group
offer and two without-replacement second-group offers.

| First-group offer    | Weight |
| -------------------- | -----: |
| `HealBigDrop`        |   0.25 |
| `RoomRewardHealDrop` |   1.50 |
| `ArmorBigBoost`      |   0.25 |
| `ArmorBoost`         |   1.00 |
| `LastStandDrop`      |   1.50 |
| `GiftDrop`           |   0.15 |

| Second-group offer  |
| ------------------- |
| `SpellDrop`         |
| `ShopHermesUpgrade` |
| `MaxHealthDrop`     |
| `MaxManaDrop`       |
| `BlindBoxLoot`      |
| `TalentDrop`        |

`LastStandDrop` retains `MissingLastStand` during generation and purchase;
`FillInShopOptions` filters it before weighted selection. `RequiredNotInStore`
observes the complete pre-purchase inventory: visible Hermes, Spell, and
Talent names suppress their corresponding outgoing reward requirements. The
live Hammer requirement still checks `WeaponUpgradeDrop`, but the Hammer group
in the source is commented out and cannot produce that option. Pending SpellDrop sets
`CurrentRun.PendingSpellDrop`, suppressing another SpellDrop until acquisition;
the installed source does not clear the flag on delivery, and ordinary use
records independently retain the exclusion.

### Purchase, delivery, and Travel Deal facts

Each materialized offer receives an integer `RoomDelay` from 2 through 8.
Normal purchase creates a `StorePendingDeliveryItem` with the exact payload,
encounter-use countdown, purchase depth, and expiration action. Qualifying
encounter completions decrement it; noncombat, skipped, ignored-use, and
otherwise nonqualifying encounters do not. Expiration spawns a required
pickup, which is mandatory when delivered. A rushed purchase removes pending
state and spawns the exact required pickup when the Shrine screen closes.
Multiple purchases remain independent. Forced final-Preboss completion
delivers all pending Shrine items when `EnteredBiomes == 4`: Dream routes use
`AutocompleteSurfaceShopDelivery`; the normal fixed route uses the Hermes
event at `Q_PreBoss01`.

Travel Deal applies its first-purchase treatment. Only the first rushed
purchase refills its vacated slot with a fresh SurfaceShop option, excluding
the rushed and visible names first and then using ordinary fallback. A normal
delayed purchase does not refill. `Gold Gold Gold` and Infernal Contract are
World Shop mechanisms and do not add Shrine offers.

The shared distinction is that Shrine purchase schedules delivery, while the
later spawned object is an ordinary required pickup. The complete chronology,
including which checkpoint can host or advance that delivery, remains in the
acquisition and room-action authorities.

### Current schema-70 planner disposition

Shrine presence is authored at exact ordinary and forced Postboss hosts, with
all three visible offers always authored. There is no Interact/random-inventory
bypass because visible names can affect host-room outgoing exclusions before
purchase. Inventory owns only each visible reward type. Hidden payload and
pickup-owned detail—including Mystery Boon's eventual God and trait offer—are
authored only on the concrete rushed or delayed delivery pickup. Purchase state
is sparse per stable generation; delay, rush, pending delivery, delivery host,
Spell reservation, and runtime fallback are derived products. Purchase itself
is not a room action. A rushed purchase creates one required source-room pickup;
a delayed purchase is scheduled at source cleanup, counts qualifying later
encounter-end effects, and materializes at its reached host. Side-room Shrines
use the same source rule but do not consume a newly scheduled or older pending
use. Final Preboss completion flushes pending deliveries. Numeric prices and
economy remain sim-neutral.

## Stygian Wells

### Source contacts, hosts, spacing, and physical capacity

The evidence was refreshed on 2026-08-24. Primary sources are
`StoreData.lua:14-118` and `StoreLogic.lua:436-438, 1101-1201`;
`TraitData_Store.lua:15-510`; `ConsumableData.lua:944-955, 1202-1529`;
`RoomData.lua:572-587`; `RequirementsLogic.lua:1231-1254`;
`RoomLogic.lua:4056-4069, 4891-4918`; `TraitLogic.lua:1766-1807`;
`UpgradeChoiceLogic.lua:1124-1141`; and the already-owned route-detour and
rarity audits for downstream Spark and Yarn rules.

The declaration contacts for the inherited and forced room profiles are
`RoomDataF.lua:283, 1945, 2561`, `RoomDataG.lua:310, 488, 1055`,
`RoomDataH.lua:18, 1902`, and `RoomDataI.lua:346, 3487, 3902, 4086`.
Physical-anchor counts are map evidence from
`1GameData/Maps/bin/<Room>.thing_bin`, not a runtime probability inference.

The base Well declaration has `WellShopSpawnChance = 0.15`, requires the Well
upgrade, biome depth at least three, an underworld route, and a depth gap of at
least four from `LastWellShopDepth` (three intervening rooms). A realized Well
also requires an available `ChallengeSwitchBase`. Forced Wells share the
spacing history.

| Biome | Ordinary hosts                                       | `ChallengeSwitchBase` counts in host order                                  | Chance |
| ----- | ---------------------------------------------------- | --------------------------------------------------------------------------- | -----: |
| F     | `F_Combat01`-`F_Combat22`                            | `1,1,2,1,2,2,1,1,1,2,2,2,2,2,2,2,1,2,1,1,1,1`                               |   0.25 |
| G     | `G_Combat01`-`G_Combat03`, `G_Combat07`-`G_Combat20` | `1,2,2,1,1,2,2,2,2,1,1,1,1,2,1,1,1`                                         |   0.30 |
| H     | `H_Combat01`-`H_Combat15`                            | each 1                                                                      |   0.35 |
| I     | `I_Combat01`-`I_Combat24`, `I_MiniBoss01/02`         | combats `3,2,2,2,2,2,2,2,2,1,2,1,1,2,2,1,1,2,1,1,2,3,1,1`; minibosses `2,2` |   0.08 |

The source does not declare a standalone ordinary Well name list: F/G/H/I
biome profiles provide inherited chances and room declarations can override
them. Explicit zero overrides are `F_PreBoss01`, `G_PreBoss01`,
`I_PostBoss01`, `I_ChronosFlashback01`, and `I_DeathAreaRestored`.
`F_PostBoss01`, `G_PostBoss01`, and `H_PostBoss01` each have two anchors and
own forced, upgrade-gated Wells; I has no matching forced Postboss Well.
`G_Combat04`-`06`, `I_PostBoss01`, `I_Story01`, and `I_Reprieve01` provide
representative physical/declaration exclusions. The planner resolves these
facts through unique room declarations and does not reconstruct a biome-name
matrix.

The Well is installed during room setup but locked through combat;
`DoUnlockRoomExits` first completes outgoing generation and then makes it
usable. The shared action chronology is therefore post-outgoing, while the
Well-specific interaction is immediate and paid.

### Complete inventory and disposition matrix

`RoomShop` has at most three offers: one from the eight-entry healing/defensive
weighted group, then remaining options from ten traits and seven consumables.
The complete live 25-identity pool is:

Player-facing Well names come from the matching English `DisplayName` entries
in `Game/Text/en/TraitText.en.sjson`, rather than from the runtime identities
below. The catalog retains both: the identity drives simulation and the display
name drives authoring. Representative pairs include `ArmorBoostStore` / **Splintered
Shield**, `RandomStoreItem` / **Fateful Twist**, `TemporaryBoonRarityTrait` /
**Yarn of Ariadne**, `TemporaryForcedSecretDoorTrait` / **Spark of Ixion**, and
`LimitedSwapTraitDrop` / **Sacrificial Hymn**; the catalog regression owns the
complete 25-name matrix.

| Identity                                  | Exact game effect                                                        | Current planner disposition                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `ArmorBoostStore`                         | Grants 20 armor                                                          | Defer armor/combat state                                                         |
| `DamageSelfDrop`                          | Pays gold for 10-30 health damage                                        | Defer health/economy                                                             |
| `HealDropRange`                           | Heals 21-39% maximum health                                              | Defer health                                                                     |
| `EmptyMaxHealthShopItem`                  | Adds 25 maximum health without healing                                   | Defer health                                                                     |
| `FirstHitHealTrait`                       | Next hit heals 100% of damage; stacks add uses                           | Defer health/combat                                                              |
| `TemporaryDoorHealTrait`                  | Heals 10% maximum health after next three transitions                    | Defer health                                                                     |
| `TemporaryHealExpirationTrait`            | Heals 50% maximum health after four encounters                           | Defer health                                                                     |
| `LastStandShopItem`                       | Adds a Last Stand restoring 40% health and Magick                        | Concrete paid consumable with runtime fallback; no planner Death Defiance ledger |
| `TemporaryImprovedSecondaryTrait`         | 1.40 secondary damage for five encounters                                | Defer combat                                                                     |
| `TemporaryImprovedCastTrait`              | 1.35 Cast damage for five encounters                                     | Defer combat                                                                     |
| `TemporaryMoveSpeedTrait`                 | 1.20 movement speed for eight encounters                                 | Defer movement                                                                   |
| `TemporaryBoonRarityTrait` (Yarn)         | Next eligible God offer: +1 Rare, +0.25 Epic, +0.10 Duo, +0.10 Legendary | Consequential rarity ledger                                                      |
| `TemporaryImprovedExTrait`                | 1.50 Omega damage for six encounters                                     | Defer combat                                                                     |
| `TemporaryImprovedDefenseTrait`           | 0.90 incoming health damage for five encounters                          | Defer combat/health                                                              |
| `TemporaryDiscountTrait`                  | 0.70 Store costs for six encounters                                      | Consequential only for later Well eligibility; defer economy                     |
| `TemporaryForcedSecretDoorTrait` (Spark)  | Adds one forced secret-door use                                          | Consequential Chaos topology                                                     |
| `TemporaryEmptySlotDamageTrait`           | Triple damage for six encounters while a core slot is empty              | Consequential only for later Well eligibility; defer combat                      |
| `ExtendedShopTrait`                       | Next whitelisted temporary Well trait lasts for two boss uses            | Consequential for eligible lifetime; otherwise defer                             |
| `MetaCurrencyRange`                       | Grants 20-40 Bones                                                       | Defer meta resource                                                              |
| `MetaCardPointsCommonRange`               | Grants 6-12 Ashes                                                        | Defer meta resource                                                              |
| `MemPointsCommonRange`                    | Grants 20-30 Psyche                                                      | Defer meta resource                                                              |
| `SeedMysteryRange`                        | Grants two Mystery Seeds                                                 | Defer meta resource                                                              |
| `RandomStoreItem`                         | Awards one eligible item from a closed nested pool                       | Consequential if it produces Yarn, Discount, or Last Stand                       |
| `LimitedManaRegenDrop`                    | Regenerates 500 Magick over three seconds                                | Defer Magick                                                                     |
| `LimitedSwapTraitDrop` (Sacrificial Hymn) | One forced replacement; replacement gains +2 levels and next rarity tier | Consequential next eligible trait offer                                          |

`RandomStoreItem`'s nested pool includes Yarn, Discount, and Last Stand but
not Spark, Sacrificial Hymn, Empty Slot, or Extended. It is a separate
consumable path and does not make a nested result a direct Extended purchase.

### Repetition, temporary use, and direct consequential effects

Initial offers are distinct within one Well, and a Travel Deal refill excludes
the purchased and still-visible names in that Well. A later Well may repeat an
earlier identity. Most temporary traits stack or overlap. The exact source
exceptions are: `TemporaryDiscountTrait` is ineligible while held;
`TemporaryEmptySlotDamageTrait` is ineligible while held and requires an empty
primary or secondary core slot; and `LastStandShopItem` is offered only while a
Last Stand is missing. These are declaration-specific requirements, not a
global no-repeat rule.

The exact `ExtendedShopTrait.ValidPermanentItemsLookup` whitelist is
`TemporaryDoorHealTrait`, `TemporaryImprovedSecondaryTrait`,
`TemporaryImprovedCastTrait`, `TemporaryMoveSpeedTrait`,
`TemporaryImprovedExTrait`, `TemporaryImprovedDefenseTrait`,
`TemporaryDiscountTrait`, and `TemporaryEmptySlotDamageTrait`. A direct Well
purchase of one of these can receive the two-boss-use lifetime and consumes an
Extended use. Only Discount and Empty Slot retain a modeled eligibility
effect; the other six durations are sim-neutral. Repeated Spark and Yarn
instances stack as one-use state; Sacrificial Hymn adds one replacement use.

The three direct run-consequential identities are:

- **Spark of Ixion** (`TemporaryForcedSecretDoorTrait`) requires the first
  Chaos pickup, is unavailable in Dream runs, and is consumed only when a
  force-capable physical `SecretPoint` creates the next Chaos gate. The
  forced branch precedes natural chance, preserves the ordinary route
  history, and is fully detailed by the [route-detour authority](../rooms-and-routes/ROUTE_DETOUR_FINDINGS.md);
  this audit does not duplicate its room-by-room SecretPoint matrix.
- **Yarn of Ariadne** (`TemporaryBoonRarityTrait`) contributes the declared
  rarity bonuses to the next eligible God-loot offer that does not ignore
  temporary rarity. One use is consumed when that choice screen closes, not
  merely when an offer is generated. The complete rarity ledger remains in
  `../traits/BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md`.
- **Sacrificial Hymn** (`LimitedSwapTraitDrop`) creates one
  `LimitedSwapBonusTrait` use with `ExchangeLevelBonus = 2`. The next eligible
  boon offer attempts one random replacement; if the replacement set is
  nonempty, one replacement is shown and is optional to take. The use is
  consumed when the choice screen closes, whether or not it is selected. An
  empty replacement set leaves the use intact. Its `ForceSwaps` branch precedes
  the ordinary 10% replacement roll and therefore still applies while
  Ordinary has disabled that roll.

### Current schema-71 planner disposition

Forced F/G/H Postboss Wells are always present. An uninteracted Well retains
dormant inventory detail but contributes no exact purchases or effects;
interaction requires all three visible identities. Each purchase is a paid,
atomic Cleanup action and never enters the free-pickup alternative-interaction
lifecycle. Travel Deal owns one same-group refill from the first ranked
purchase. The modeled state is limited to Ixion uses and their automatically
derived next host-capable Chaos gate, Yarn rarity uses, Sacrificial Hymn replacement uses, active
Discount and Empty Slot lifetimes, and Extended charges. Last Stand remains a
concrete paid consumable isolated by declaration-owned runtime fallback; the
planner owns no Death Defiance capacity ledger. Health, damage, Magick, gold,
price, and meta-resource amounts remain sim-neutral. Wells and Pools are the
only current room-feature interactions with a runtime-random Interact boundary;
Shrines and Shops remain fully authored because their visible inventory can
affect other generation rules.

## Bounded uncertainties and exclusions

The following remain explicit and outside this audit's modeled contract:

- profile, familiar, and meta-progression predicates that can force or suppress
  resource points;
- physical point probabilities and failed resource rolls;
- exact affordability, health, damage, Magick, gold, and meta-resource amounts;
- Store reroll chronology and currency;
- temporary Well effects whose expiration is entirely sim-neutral;
- changes to the installed Ixion SecretPoint host matrix, whose current
  declaration-backed counts live in the [route-detour authority](../rooms-and-routes/ROUTE_DETOUR_FINDINGS.md);
- future changes to source pools or permanent upgrades; and
- unsupported feature families or interaction details not declared by the
  current schema-71 catalog.

These boundaries preserve source/model discrepancies rather than encoding
generic permissive values. Any future expansion should update this audit's
feature section and its surviving lifecycle authority together.
