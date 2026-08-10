# Trait Offer Pools and Equipped-Trait Dependencies

## Purpose

This audit records the game-data inventory needed for concrete trait
authoring:

1. each in-scope trait giver;
2. the complete trait-key pool declared by that giver; and
3. the declaration, offer-context, and equipped-state facts that make a pooled
   trait eligible.

It is source evidence, not an implementation contract. It deliberately does
not design authored state, history folding, candidate evaluation, or UI.

## Source Baseline

Primary evidence comes from the installed game scripts:

- `LootData_Aphrodite.lua` through `LootData_Zeus.lua` for the nine ordinary
  Olympian pools;
- `LootData_Hermes.lua` for Hermes;
- `NPCData_Artemis.lua`, `NPCData_Icarus.lua`, and `NPCData_Athena.lua` for
  field-NPC pools;
- `NPCData_Arachne.lua`, `NPCData_Narcissus.lua`, `NPCData_Echo.lua`,
  `NPCData_Hades.lua`, `NPCData_Medea.lua`, `NPCData_Circe.lua`, and
  `NPCData_Dionysus.lua` for Story-room choice pools;
- `LootData.lua` for the Daedalus `WeaponUpgrade` pool;
- `UpgradeChoiceData.lua`, `TraitLogic.lua`, `HeroData.lua`, and `RunLogic.lua`
  for the shared three-choice surface, provider rarity behavior, equipped
  rarity caches, and element folding;
- `TraitData.lua` for `LinkedTraitData` and `TraitRequirements`; and
- the individual `TraitData_*.lua` files for direct equipped-trait conditions
  declared on a trait rather than in `TraitRequirements`;
- `TraitData_Elementals.lua` for elemental contributions and infusion offer
  thresholds;
- `EncounterLogic.lua` and `RewardLogic.lua` for Devotion rarity blocking; and
- `RoomDataAnomaly.lua` and `RoomDataC.lua` for the room-owned
  `BlockGiftBoons` fact.

The audit uses the current progressed, non-bounty, non-dream baseline already
established by the reward model. Selene Hex/Talent progression, Chaos
blessings/curses, keepsakes, Arcana forcing, and prior-run Echo payload content
are outside this inventory.

## Reading the Inventory

The giver pool is the unique union of its live `PriorityUpgrades`,
`WeaponUpgrades`, and `Traits` arrays. Priority and probability do not change
pool membership.

Positive dependency notation is:

- `any(A, B)` — at least one listed trait must already be equipped;
- `all(any(A, B); any(C, D))` — at least one trait from every listed group must
  already be equipped; and
- no dependency row — the pooled trait has no positive equipped-trait
  prerequisite.

The exact trait key joins the giver inventory to the dependency graph. The
positive graph records only positive equipped-trait prerequisites. Later
sections separately record the other legality axes needed by the first
implementation slice. Neither inventory records:

- the ordinary rule that an already-owned trait is not offered again;
- occupied-slot replacement and incompatible cast or Hammer traits;
- save or narrative progression requirements collapsed by the audit baseline;
- `PriorityChance`; or
- negative `HasNone` conditions.

Those are separate legality axes. In particular, weapon/aspect filtering is
summarized below but is not an equipped-trait prerequisite.

The game also routes NPC and Story choices through `Traits` arrays even when
selecting an entry immediately executes an effect instead of leaving that exact
key as a persistent equipped trait. `UpgradeHammerBoon`, `NarcissusA..I`,
`EchoLastReward`, and similar effect-backed choices remain giver-pool facts
here; later lifecycle work must classify their selected effects before treating
every pool entry as persistent inventory.

### Priority-upgrade closure

The source `GetPriorityTraits`/`PriorityUpgrades` surface is closed for the
first Olympian offer rule. Each ordinary Olympian declares exactly five core
keys, in Weapon/Attack, Special, Cast, Sprint, and Mana order:

| Giver      | Priority keys                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| Aphrodite  | `AphroditeWeaponBoon`, `AphroditeSpecialBoon`, `AphroditeCastBoon`, `AphroditeSprintBoon`, `AphroditeManaBoon`      |
| Apollo     | `ApolloWeaponBoon`, `ApolloSpecialBoon`, `ApolloCastBoon`, `ApolloSprintBoon`, `ApolloManaBoon`                     |
| Ares       | `AresWeaponBoon`, `AresSpecialBoon`, `AresCastBoon`, `AresSprintBoon`, `AresManaBoon`                               |
| Demeter    | `DemeterWeaponBoon`, `DemeterSpecialBoon`, `DemeterCastBoon`, `DemeterSprintBoon`, `DemeterManaBoon`                |
| Hephaestus | `HephaestusWeaponBoon`, `HephaestusSpecialBoon`, `HephaestusCastBoon`, `HephaestusSprintBoon`, `HephaestusManaBoon` |
| Hera       | `HeraWeaponBoon`, `HeraSpecialBoon`, `HeraCastBoon`, `HeraSprintBoon`, `HeraManaBoon`                               |
| Hestia     | `HestiaWeaponBoon`, `HestiaSpecialBoon`, `HestiaCastBoon`, `HestiaSprintBoon`, `HestiaManaBoon`                     |
| Poseidon   | `PoseidonWeaponBoon`, `PoseidonSpecialBoon`, `PoseidonCastBoon`, `PoseidonSprintBoon`, `PoseidonManaBoon`           |
| Zeus       | `ZeusWeaponBoon`, `ZeusSpecialBoon`, `ZeusCastBoon`, `ZeusSprintBoon`, `ZeusManaBoon`                               |

Hermes and `WeaponUpgrade` (Hammer) declare an explicitly empty priority set.
Normalization verifies membership, uniqueness, and coverage of the five
ordinary slots. Olympian defaults use priority keys only and include Melee or
Secondary. The first-offer guarantee is a support simplification: a first reached
Olympian offer while all ordinary slots are empty needs three distinct priority traits
and Attack (`Melee`) or Special (`Secondary`). Replacement,
weighted probability, and `PriorityChance` remain deferred rather than being
inferred from this guarantee.

## In-Scope Offer Shape

`ScreenData.UpgradeChoice.MaxChoices` is three. `CalcNumLootChoices` can reduce
an ordinary god screen by one when an acquired effect supplies
`RestrictBoonChoices`; no trait in this audit's first Olympian, Hermes, and
Hammer implementation slice supplies that effect. The supported baseline may
therefore author exactly three distinct options and one selected option.

The three options are alternatives against the same pre-selection state.
`SetTraitsOnLoot` removes a selected trait from every rarity table before
filling the next position; option order does not equip earlier options. Only
the final player selection enters equipped trait state.

Ordinary Olympian and Hermes providers roll rarity. Under the progressed
baseline, ordinary scalable traits can be freshly offered as `Common`, `Rare`,
or `Epic`; `LegendaryTrait` and `SynergyTrait` members instead expose their
sole `Legendary` or `Duo` rarity. `Heroic` is not a fresh-offer rarity, but it
is the next in-run rarity after `Epic` and therefore belongs to equipped-trait
state and rarity-derived eligibility. `WeaponUpgrade` declares
`ForceCommon = true`, but the planner does not model that as a player rarity:
Hammer options have no rarity domain and require no authored rarity choice.
Their source Legendary levels are separately retained as the exact Rank-II
capability used by Icarus's Latest Model; this remains Hammer state rather than
player-facing boon rarity.

## Giver Pool Inventory

### Ordinary Olympians

Every ordinary Olympian declares 22 unique pooled traits.

#### Aphrodite

`AphroditeWeaponBoon`, `AphroditeSpecialBoon`, `AphroditeCastBoon`,
`AphroditeSprintBoon`, `AphroditeManaBoon`, `HighHealthOffenseBoon`,
`HealthRewardBonusBoon`, `DoorHealToFullBoon`, `WeakPotencyBoon`,
`WeakVulnerabilityBoon`, `ManaBurstBoon`, `FocusRawDamageBoon`,
`ElementalDodgeBoon`, `RandomStatusBoon`, `SprintEchoBoon`, `CharmCrowdBoon`,
`AllCloseBoon`, `MaxHealthDamageBoon`, `ManaBurstCountBoon`,
`BurnRefreshBoon`, `SlamManaBurstBoon`, `BloodManaBurstBoon`.

#### Apollo

`ApolloWeaponBoon`, `ApolloSpecialBoon`, `ApolloCastBoon`, `ApolloSprintBoon`,
`ApolloManaBoon`, `ApolloRetaliateBoon`, `PerfectDamageBonusBoon`,
`BlindChanceBoon`, `ApolloBlindBoon`, `ApolloExCastBoon`,
`ApolloCastAreaBoon`, `DoubleStrikeChanceBoon`, `ElementalRallyBoon`,
`DoubleExManaBoon`, `ApolloSecondStageCastBoon`, `RaiseDeadBoon`,
`PoseidonSplashSprintBoon`, `StormSpawnBoon`, `ManaBurstCountBoon`,
`CoverRegenerationBoon`, `BlindClearBoon`, `DoubleSwordBoon`.

#### Ares

`AresWeaponBoon`, `AresSpecialBoon`, `AresCastBoon`, `AresSprintBoon`,
`AresManaBoon`, `AresExCastBoon`, `RendBloodDropBoon`,
`AresStatusDoubleDamageBoon`, `BloodDropRevengeBoon`, `MissingHealthCritBoon`,
`LowHealthLifestealBoon`, `OmegaDelayedDamageBoon`,
`ElementalOlympianDamageBoon`, `DoubleBloodDropBoon`, `SelfCastBoon`,
`AutoRevengeBoon`, `BloodRetentionBoon`, `RapidSwordBoon`, `DoubleSplashBoon`,
`DoubleSwordBoon`, `FireballRendBoon`, `BloodManaBurstBoon`.

#### Demeter

`DemeterWeaponBoon`, `DemeterSpecialBoon`, `DemeterCastBoon`,
`DemeterSprintBoon`, `DemeterManaBoon`, `CastNovaBoon`, `PlantHealthBoon`,
`BoonGrowthBoon`, `ReserveManaHitShieldBoon`, `SlowExAttackBoon`,
`CastAttachBoon`, `RootDurationBoon`, `ElementalDamageCapBoon`,
`InstantRootKill`, `RootStrikeBoon`, `KeepsakeLevelBoon`, `GoodStuffBoon`,
`StormSpawnBoon`, `MaxHealthDamageBoon`, `BurnConsumeBoon`, `ClearRootBoon`,
`SelfCastBoon`.

#### Hephaestus

`HephaestusWeaponBoon`, `HephaestusSpecialBoon`, `HephaestusCastBoon`,
`HephaestusSprintBoon`, `HephaestusManaBoon`, `MassiveDamageBoon`,
`AntiArmorBoon`, `HeavyArmorBoon`, `ArmorBoon`,
`EncounterStartDefenseBuffBoon`, `ManaToHealthBoon`, `MassiveKnockupBoon`,
`ElementalDamageBoon`, `WeaponUpgradeBoon`, `ManaShieldBoon`,
`ReboundingSparkBoon`, `MassiveCastBoon`, `ClearRootBoon`, `BlindClearBoon`,
`SlamManaBurstBoon`, `DoubleMassiveAttackBoon`, `RapidSwordBoon`.

#### Hera

`HeraWeaponBoon`, `HeraSpecialBoon`, `HeraCastBoon`, `HeraSprintBoon`,
`HeraManaBoon`, `DamageShareRetaliateBoon`, `LinkedDeathDamageBoon`,
`BoonDecayBoon`, `DamageSharePotencyBoon`, `SpawnCastDamageBoon`,
`CommonGlobalDamageBoon`, `OmegaHeraProjectileBoon`,
`ElementalRarityUpgradeBoon`, `AllElementalBoon`, `SuperSacrificeBoonHera`,
`MoneyDamageBoon`, `KeepsakeLevelBoon`, `RaiseDeadBoon`,
`ManaRestoreDamageBoon`, `CharmCrowdBoon`, `ManaShieldBoon`,
`BloodRetentionBoon`.

#### Hestia

`HestiaWeaponBoon`, `HestiaSpecialBoon`, `HestiaCastBoon`,
`HestiaSprintBoon`, `HestiaManaBoon`, `OmegaZeroBurnBoon`,
`CastProjectileBoon`, `FireballManaSpecialBoon`, `BurnExplodeBoon`,
`BurnArmorBoon`, `BurnStackBoon`, `AloneDamageBoon`,
`ElementalBaseDamageBoon`, `BurnSprintBoon`, `EchoBurnBoon`, `SteamBoon`,
`BurnConsumeBoon`, `CoverRegenerationBoon`, `BurnRefreshBoon`,
`DoubleMassiveAttackBoon`, `ManaRestoreDamageBoon`, `FireballRendBoon`.

#### Poseidon

`PoseidonWeaponBoon`, `PoseidonSpecialBoon`, `PoseidonCastBoon`,
`PoseidonSprintBoon`, `PoseidonManaBoon`, `EncounterStartOffenseBuffBoon`,
`RoomRewardBonusBoon`, `FocusDamageShaveBoon`, `DoubleRewardBoon`,
`PoseidonStatusBoon`, `PoseidonExCastBoon`, `OmegaPoseidonProjectileBoon`,
`ElementalHealthBoon`, `AmplifyConeBoon`, `LightningVulnerabilityBoon`,
`MoneyDamageBoon`, `GoodStuffBoon`, `PoseidonSplashSprintBoon`, `AllCloseBoon`,
`SteamBoon`, `MassiveCastBoon`, `DoubleSplashBoon`.

#### Zeus

`ZeusWeaponBoon`, `ZeusSpecialBoon`, `ZeusCastBoon`, `ZeusSprintBoon`,
`ZeusManaBoon`, `ZeusManaBoltBoon`, `BoltRetaliateBoon`, `CastAnywhereBoon`,
`FocusLightningBoon`, `DoubleBoltBoon`, `EchoExpirationBoon`,
`LightningDebuffGeneratorBoon`, `ElementalDamageFloorBoon`, `SpawnKillBoon`,
`SuperSacrificeBoonZeus`, `LightningVulnerabilityBoon`, `RootStrikeBoon`,
`ApolloSecondStageCastBoon`, `SprintEchoBoon`, `EchoBurnBoon`,
`ReboundingSparkBoon`, `AutoRevengeBoon`.

### Hermes

Hermes declares 13 pooled traits:

`HermesWeaponBoon`, `HermesSpecialBoon`, `HermesCastDiscountBoon`,
`SprintShieldBoon`, `SorcerySpeedBoon`, `DodgeChanceBoon`,
`SlowProjectileBoon`, `MoneyMultiplierBoon`, `TimedKillBuffBoon`,
`RestockBoon`, `LuckyBoon`, `ElementalUnifiedBoon`,
`TimeStopLastStandBoon`.

### Field NPCs

#### Artemis

`SupportingFireBoon`, `CritBonusBoon`, `DashOmegaBuffBoon`,
`HighHealthCritBoon`, `InsideCastCritBoon`, `OmegaCastVolleyBoon`,
`TimedCritVulnerabilityBoon`, `FocusCritBoon`, `SorceryCritBoon`.

The installed `NPCData_Artemis.lua` declaration is the authoritative field-NPC
provider: it has no priority upgrades, declares the nine keys above, and rolls
fresh ordinary choices in `Common`, `Rare`, `Epic` order (`Rare` and `Epic`
chance entries are both zero in the current script). The first eight keys have
`Common`/`Rare`/`Epic` fresh domains and `Common`/`Rare`/`Epic`/`Heroic`
equipped domains. `SorceryCritBoon` appears in the source's Legendary pool
comment, but its executable `TraitData_Artemis.lua` declaration explicitly uses
the same `Common`/`Rare`/`Epic` fresh and `Common`/`Rare`/`Epic`/`Heroic`
equipped domains; the comment does not override that declaration. Its
declaration also requires one of `SpellLaserTrait`, `SpellLeapTrait`, `SpellSummonTrait`,
`SpellMeteorTrait`, `SpellTransformTrait`, `SpellMoonBeamTrait`, or
`SpellPolymorphTrait`, plus the `ArtemisGrantsReward01` narrative flag. The
spell operands remain deferred evidence, not placeholder production traits.
All nine contribute one `Air` or `Earth` element as inherited by the source
trait declarations; `FocusCritBoon` is explicitly non-stacking. Artemis has no
Olympian priority/replacement policy and uses the non-Olympian field-NPC
provider path.

#### Icarus

`FocusAttackDamageTrait`, `FocusSpecialDamageTrait`, `OmegaExplodeBoon`,
`CastHazardBoon`, `BreakInvincibleArmorBoon`, `BreakExplosiveArmorBoon`,
`SupplyDropBoon`, `UpgradeHammerBoon`.

`NPCData_Icarus.lua` exposes these eight choices in that order. Its live
benefit-choice entries set their offered rarity to Common, so the supported
normal-run surface is fixed Common rather than a selectable field-NPC rarity
roll. The individual `TraitData_Icarus.lua` declarations retain their wider
Common/Rare/Epic/Heroic progression levels, but those do not make a fresh
Icarus choice Rare or Epic. Heroic is not fresh here.

| Trait                      | Player-facing label | Positive offer fact                 | Element / classification           |
| -------------------------- | ------------------- | ----------------------------------- | ---------------------------------- |
| `FocusAttackDamageTrait`   | Ingenious Strike    | occupied Attack (`Melee`) slot      | no element; retained non-god trait |
| `FocusSpecialDamageTrait`  | Ingenious Flourish  | occupied Special (`Secondary`) slot | no element; retained non-god trait |
| `OmegaExplodeBoon`         | Explosive Intent    | none                                | no element; retained non-god trait |
| `CastHazardBoon`           | Hazard Boom         | none                                | no element; retained non-god trait |
| `BreakInvincibleArmorBoon` | Protective Coating  | none                                | no element; retained non-god trait |
| `BreakExplosiveArmorBoon`  | Volatile Coating    | none                                | no element; retained non-god trait |
| `SupplyDropBoon`           | Supply Chain        | none                                | no element; retained non-god trait |
| `UpgradeHammerBoon`        | Latest Model        | one eligible equipped Rank-I Hammer | no element; retained non-god trait |

The source additionally excludes Ingenious Strike or Flourish when the matching
Hephaestus trait's extracted `UnmodifiedCooldown` is not greater than 2.
Cooldowns and levels are not a modeled input, so the supported predicate keeps
only the exact occupied-slot fact. Both Coating traits can later be consumed by
combat, Supply Chain has a delivery effect, and other Icarus combat effects
remain outside the planner's trait-acquisition scope; selecting each source
still leaves that source in the equipped trait ledger.

`UpgradeHammerBoon` first equips its own source trait and then uses
`UpgradeHammers` to select exactly one equipped Hammer with a source Legendary
level and no remaining uses. Of the 92 declared Hammers, 65 have that Rank-II
capability. The 27 without a Legendary level are: `StaffDashAttackTrait`,
`StaffTripleShotTrait`, `StaffOneWayAttackTrait`, `StaffRaiseDeadDoubleTrait`,
`DaggerSpecialConsecutiveTrait`, `DaggerDashAttackTripleTrait`,
`AxeMassiveThirdStrikeTrait`, `AxeFreeSpinTrait`, `AxeArmorTrait`,
`AxeSecondStageTrait`, `AxeDashAttackTrait`, `AxeRallyFrenzyTrait`,
`AxeRallyFirstStrikeTrait`, `TorchExSpecialCountTrait`, `TorchSpecialSpeedTrait`,
`TorchSpecialLineTrait`, `TorchSplitAttackTrait`, `TorchEnhancedAttackTrait`,
`TorchDiscountExAttackTrait`, `LobRushArmorTrait`, `LobSpreadShotTrait`,
`LobInOutSpecialExTrait`, `LobGunAttackDoublerTrait`, `SuitArmorTrait`,
`SuitDashAttackTrait`, `SuitSpecialStartUpTrait`, and `SuitSpecialBlockTrait`.
The persistent `RemainingUses` exception has no member in this supported
Rank-II subset.

#### Athena

`InvulnerabilityDashBoon`, `RetaliateInvulnerabilityBoon`,
`FocusLastStandBoon`, `DeathDefianceRefillBoon`, `AthenaProjectileBoon`,
`InvulnerabilityCastBoon`, `ManaSpearBoon`, `OlympianSpellCountBoon`.

The installed `NPCData_Athena.lua` declaration is the authoritative field-NPC
provider: it exposes the eight keys above in that order, has no priority
upgrades, uses the selectable Common/Rare/Epic field-NPC rarity domain, and
does not declare a fixed Legendary option. Its `RarityRollOrder` also mentions
Heroic, but the provider inherits the normal progressed `BoonData` rarity
chances, which have no fresh Heroic chance; Heroic is therefore equipped-only
for this pool. `ScreenData.UpgradeChoice.MaxChoices` remains three and the
supported baseline has no `RestrictBoonChoices` effect, so the offer is three
distinct options. The English player-facing labels from `TraitText.en.sjson`
are:

| Trait                          | Player-facing label | Fresh rarities     | Equipped rarities          | Element | Boon-rarity / flags                |
| ------------------------------ | ------------------- | ------------------ | -------------------------- | ------- | ---------------------------------- |
| `InvulnerabilityDashBoon`      | Divine Dash         | Common, Rare, Epic | Common, Rare, Epic, Heroic | Fire    | no Pom levels; rarifiable; counted |
| `RetaliateInvulnerabilityBoon` | Defensive Posture   | Common, Rare, Epic | Common, Rare, Epic, Heroic | Fire    | no Pom levels; rarifiable; counted |
| `FocusLastStandBoon`           | Stalwart Stand      | Common, Rare, Epic | Common, Rare, Epic, Heroic | Fire    | no Pom levels; rarifiable; counted |
| `DeathDefianceRefillBoon`      | Renewed Faith       | Common, Rare, Epic | Common, Rare, Epic, Heroic | Fire    | no Pom levels; rarifiable; counted |
| `AthenaProjectileBoon`         | Phalanx Shot        | Common, Rare, Epic | Common, Rare, Epic, Heroic | Fire    | no Pom levels; rarifiable; counted |
| `InvulnerabilityCastBoon`      | Mental Block        | Common, Rare, Epic | Common, Rare, Epic, Heroic | Fire    | no Pom levels; rarifiable; counted |
| `ManaSpearBoon`                | Righteous Pike      | Common, Rare, Epic | Common, Rare, Epic, Heroic | Fire    | no Pom levels; rarifiable; counted |
| `OlympianSpellCountBoon`       | Task Force          | Common, Rare, Epic | Common, Rare, Epic, Heroic | Fire    | no Pom levels; rarifiable; counted |

All eight are retained boon-rarity trait entries after selection; their
`AcquireFunction` side effects do not replace the equipped trait key with an
effect-only transient outcome. The source requirements that are representable
or intentionally deferred by the planner are:

- `InvulnerabilityDashBoon` and `AthenaProjectileBoon` require
  `CurrentRun.TextLinesRecord.AthenaFirstMeeting` to be absent;
- `DeathDefianceRefillBoon` requires the named `MissingLastStand` predicate and
  the same absent `AthenaFirstMeeting` flag;
- `OlympianSpellCountBoon` requires `GameState.TextLinesRecord.AthenaGrantsReward01`
  and at least one of `PolymorphZeusTalent`, `MeteorHestiaTalent`,
  `TransformAphroditeTalent`, `LeapHephaestusTalent`, `LaserApolloTalent`,
  `SummonHeraTalent`, `TimeSlowDemeterTalent`, `PotionPoseidonTalent`, or
  `MoonBeamAresTalent` in the hero trait dictionary. The nine talent keys stay
  deferred operands, so this option remains candidate-ineligible until that
  dependency is modeled.

`RetaliateInvulnerabilityBoon`, `FocusLastStandBoon`, `InvulnerabilityCastBoon`,
and `ManaSpearBoon` declare no additional offer requirement in the installed
trait data. Athena contributes no ordinary boon slot, no negative equipped-trait
requirement, no non-stacking/rerify block, and no exclusion from rarity count.
The narrative/save predicates above remain source evidence rather than guessed
production state.

### Story-Room Choice Givers

#### Arachne

`AgilityCostume`, `ManaCostume`, `VitalityCostume`, `HighArmorCostume`,
`CastDamageCostume`, `IncomeCostume`, `SpellCostume`, `EscalatingCostume`.

#### Narcissus

`NarcissusA`, `NarcissusB`, `NarcissusC`, `NarcissusD`, `NarcissusE`,
`NarcissusF`, `NarcissusH`, `NarcissusI`, `NarcissusG`.

#### Echo

`EchoLastReward`, `EchoLastRunBoon`, `EchoDeathDefianceRefill`,
`EchoDoubleLevelBoon`, `DiminishingDodgeBoon`,
`DiminishingHealthAndManaBoon`, `EchoDoubleShop`,
`EchoRepeatKeepsakeBoon`.

#### Hades

`HadesLifestealBoon`, `HadesCastProjectileBoon`, `HadesPreDamageBoon`,
`HadesChronosDebuffBoon`, `HadesDashSweepBoon`,
`HadesDeathDefianceDamageBoon`, `HadesManaUrnBoon`,
`HadesInvisibilityRetaliateBoon`.

#### Medea

`HealingOnDeathCurse`, `MoneyOnDeathCurse`, `ManaOverTimeCurse`,
`SpawnDamageCurse`, `ArmorPenaltyCurse`, `SlowProjectileCurse`,
`DeathDefianceRetaliateCurse`, `NewStatusDamage`.

#### Circe

`CirceShrinkTrait`, `CirceEnlargeTrait`, `ArcanaRarityTrait`,
`HealAmplifyTrait`, `DoubleFamiliarTrait`, `RemoveShrineTrait`,
`RandomArcanaTrait`, `CirceSorceryDamageBoon`, `ExPolymorphBoon`.

#### Dionysus

`CastLobBoon`, `HiddenMaxHealthBoon`, `FirstHangoverBoon`,
`CombatEncounterHealBoon`, `PowerDrinkBoon`, `FogDamageBonusBoon`, `BankBoon`,
`RandomBaseDamageBoon`.

### Daedalus Weapon Upgrades

The shared `WeaponUpgrade` declaration contains 92 traits. None has a positive
equipped-trait prerequisite in `TraitRequirements`. Eligibility is instead
filtered by the selected weapon, selected aspect, and conflicts with already
equipped Hammer slots.

#### Witch's Staff — `WeaponStaffSwing`

`StaffDoubleAttackTrait`, `StaffLongAttackTrait`, `StaffDashAttackTrait`,
`StaffTripleShotTrait`, `StaffJumpSpecialTrait`, `StaffExAoETrait`,
`StaffAttackRecoveryTrait`, `StaffFastSpecialTrait`, `StaffExHealTrait`,
`StaffSecondStageTrait`, `StaffPowershotTrait`, `StaffOneWayAttackTrait`,
`StaffRaiseDeadBigTrait`, `StaffRaiseDeadDoubleTrait`,
`StaffLoneShadeRespawnTrait`, `StaffLoneShadeRallyTrait`.

Declared aspects: `BaseStaffAspect`, `StaffClearCastAspect`,
`StaffSelfHitAspect`, `StaffRaiseDeadAspect`.

#### Sister Blades — `WeaponDagger`

`DaggerBlinkAoETrait`, `DaggerSpecialJumpTrait`, `DaggerSpecialLineTrait`,
`DaggerRapidAttackTrait`, `DaggerSpecialConsecutiveTrait`,
`DaggerBackstabTrait`, `DaggerSpecialReturnTrait`, `DaggerSpecialFanTrait`,
`DaggerAttackFinisherTrait`, `DaggerFinalHitTrait`,
`DaggerChargeStageSkipTrait`, `DaggerDashAttackTripleTrait`,
`DaggerTripleBuffTrait`, `DaggerTripleRepeatWomboTrait`,
`DaggerTripleHomingSpecialTrait`.

Declared aspects: `DaggerBackstabAspect`, `DaggerHomingThrowAspect`,
`DaggerBlockAspect`, `DaggerTripleAspect`.

#### Moonstone Axe — `WeaponAxe`

`AxeSpinSpeedTrait`, `AxeChargedSpecialTrait`, `AxeAttackRecoveryTrait`,
`AxeMassiveThirdStrikeTrait`, `AxeThirdStrikeTrait`,
`AxeRangedWhirlwindTrait`, `AxeFreeSpinTrait`, `AxeArmorTrait`,
`AxeBlockEmpowerTrait`, `AxeSecondStageTrait`, `AxeDashAttackTrait`,
`AxeSturdyTrait`, `AxeRallyFrenzyTrait`, `AxeRallyFirstStrikeTrait`.

Declared aspects: `AxeRecoveryAspect`, `AxeArmCastAspect`,
`AxePerfectCriticalAspect`, `AxeRallyAspect`.

#### Umbral Flames — `WeaponTorch`

`TorchExSpecialCountTrait`, `TorchSpecialSpeedTrait`, `TorchAttackSpeedTrait`,
`TorchSpecialLineTrait`, `TorchSpecialImpactTrait`, `TorchMoveSpeedTrait`,
`TorchSplitAttackTrait`, `TorchEnhancedAttackTrait`,
`TorchDiscountExAttackTrait`, `TorchLongevityTrait`, `TorchOrbitPointTrait`,
`TorchSpinAttackTrait`, `TorchAutofireSprintTrait`.

Declared aspects: `TorchSpecialDurationAspect`, `TorchSprintRecallAspect`,
`TorchDetonateAspect`, `TorchAutofireAspect`.

#### Argent Skull — `WeaponLob`

`LobAmmoTrait`, `LobAmmoMagnetismTrait`, `LobRushArmorTrait`,
`LobSpreadShotTrait`, `LobSpecialSpeedTrait`, `LobSturdySpecialTrait`,
`LobOneSideTrait`, `LobInOutSpecialExTrait`, `LobStraightShotTrait`,
`LobPulseAmmoTrait`, `LobPulseAmmoCollectTrait`, `LobGrowthTrait`,
`LobGunOverheatTrait`, `LobGunBounceTrait`, `LobGunSpecialBounceTrait`,
`LobGunAttackRangeTrait`, `LobGunAttackDoublerTrait`.

Declared aspects: `LobAmmoBoostAspect`, `LobCloseAttackAspect`,
`LobImpulseAspect`, `LobGunAspect`.

#### Black Coat — `WeaponSuit`

`SuitArmorTrait`, `SuitAttackSpeedTrait`, `SuitAttackSizeTrait`,
`SuitAttackRangeTrait`, `SuitFullChargeTrait`, `SuitDashAttackTrait`,
`SuitSpecialJumpTrait`, `SuitSpecialStartUpTrait`, `SuitSpecialAutoTrait`,
`SuitSpecialBlockTrait`, `SuitSpecialDiscountTrait`,
`SuitSpecialConsecutiveHitTrait`, `SuitComboForwardRocketTrait`,
`SuitComboBlockBuffTrait`, `SuitComboDoubleSpecialTrait`,
`SuitComboDashAttackTrait`, `SuitPowershotTrait`.

Declared aspects: `BaseSuitAspect`, `SuitMarkCritAspect`, `SuitHexAspect`,
`SuitComboAspect`.

#### Hammer aspect compatibility

The weapon pool is not the legal offer pool for every aspect of that weapon.
The following 48 traits declare an explicit `LastWeaponUpgradeName` condition.
Traits in the weapon inventories above that are not listed here have no aspect
condition and therefore accept all four declared aspects, subject to explicit
equipped-trait exclusions.

| Weapon        | Traits                                                                                                                                                                                  | Accepted aspects                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Witch's Staff | `StaffDoubleAttackTrait`, `StaffLongAttackTrait`, `StaffDashAttackTrait`, `StaffExAoETrait`, `StaffOneWayAttackTrait`                                                                   | `BaseStaffAspect`, `StaffClearCastAspect`, `StaffSelfHitAspect`                |
| Witch's Staff | `StaffRaiseDeadBigTrait`, `StaffRaiseDeadDoubleTrait`, `StaffLoneShadeRespawnTrait`, `StaffLoneShadeRallyTrait`                                                                         | `StaffRaiseDeadAspect` only                                                    |
| Sister Blades | `DaggerDashAttackTripleTrait`                                                                                                                                                           | `DaggerBackstabAspect`, `DaggerHomingThrowAspect`, `DaggerBlockAspect`         |
| Sister Blades | `DaggerTripleBuffTrait`, `DaggerTripleRepeatWomboTrait`, `DaggerTripleHomingSpecialTrait`                                                                                               | `DaggerTripleAspect` only                                                      |
| Moonstone Axe | `AxeMassiveThirdStrikeTrait`, `AxeThirdStrikeTrait`                                                                                                                                     | `AxeRecoveryAspect`, `AxeArmCastAspect`, `AxePerfectCriticalAspect`            |
| Moonstone Axe | `AxeRallyFrenzyTrait`, `AxeRallyFirstStrikeTrait`                                                                                                                                       | `AxeRallyAspect` only                                                          |
| Umbral Flames | `TorchExSpecialCountTrait`                                                                                                                                                              | `TorchSpecialDurationAspect`, `TorchDetonateAspect`, `TorchAutofireAspect`     |
| Umbral Flames | `TorchAttackSpeedTrait`, `TorchDiscountExAttackTrait`, `TorchLongevityTrait`                                                                                                            | `TorchSpecialDurationAspect`, `TorchSprintRecallAspect`, `TorchDetonateAspect` |
| Umbral Flames | `TorchSplitAttackTrait`                                                                                                                                                                 | `TorchSpecialDurationAspect`, `TorchAutofireAspect`                            |
| Umbral Flames | `TorchAutofireSprintTrait`                                                                                                                                                              | `TorchAutofireAspect` only                                                     |
| Argent Skull  | `LobAmmoTrait`, `LobAmmoMagnetismTrait`, `LobSpreadShotTrait`, `LobOneSideTrait`, `LobStraightShotTrait`, `LobPulseAmmoTrait`, `LobPulseAmmoCollectTrait`, `LobGrowthTrait`             | `LobAmmoBoostAspect`, `LobCloseAttackAspect`, `LobImpulseAspect`               |
| Argent Skull  | `LobGunOverheatTrait`, `LobGunBounceTrait`, `LobGunSpecialBounceTrait`, `LobGunAttackRangeTrait`, `LobGunAttackDoublerTrait`                                                            | `LobGunAspect` only                                                            |
| Black Coat    | `SuitDashAttackTrait`, `SuitSpecialJumpTrait`, `SuitSpecialStartUpTrait`, `SuitSpecialAutoTrait`, `SuitSpecialBlockTrait`, `SuitSpecialDiscountTrait`, `SuitSpecialConsecutiveHitTrait` | `BaseSuitAspect`, `SuitMarkCritAspect`, `SuitHexAspect`                        |
| Black Coat    | `SuitComboForwardRocketTrait`, `SuitComboBlockBuffTrait`, `SuitComboDoubleSpecialTrait`, `SuitComboDashAttackTrait`, `SuitPowershotTrait`                                               | `SuitComboAspect` only                                                         |

#### Hammer equipped-trait exclusions

Hammer incompatibility is not declared as a general slot system in the
audited source. The Hammer files contain one mutual `HasNone` pair:

- `LobAmmoMagnetismTrait` requires `LobPulseAmmoTrait` to be absent; and
- `LobPulseAmmoTrait` requires `LobAmmoMagnetismTrait` to be absent.

These are exact negative equipped-trait predicates. They should be evaluated
through the same requirement machinery as other `HasNone` conditions rather
than normalized into an invented Hammer conflict slot.

#### Cast-family equipped-trait exclusions

The source cast-family pool also carries four-way negative predicates:

- `CastProjectileBoon` excludes `HadesCastProjectileBoon`, `CastAnywhereBoon`,
  `CastLobBoon`, and `SelfCastBoon`;
- `CastAnywhereBoon` excludes `CastProjectileBoon`, `HadesCastProjectileBoon`,
  `CastLobBoon`, and `SelfCastBoon`; and
- `SelfCastBoon` excludes `CastProjectileBoon`, `CastAnywhereBoon`,
  `HadesCastProjectileBoon`, and `CastLobBoon`.

The deferred `CastLobBoon` declaration carries the reciprocal exclusion list
(`CastProjectileBoon`, `CastAnywhereBoon`, `HadesCastProjectileBoon`, and
`SelfCastBoon`); its provider remains outside this persistent slice.

`HadesCastProjectileBoon` and `CastLobBoon` are deferred operand keys only;
they do not receive placeholder declarations in this slice.

## Offer-Context Restrictions

Some offer restrictions belong to the room or reward that produced the choice,
not to equipped trait history. The normalized catalog has two such rules.

### Devotion blocks Duo traits

Both initial Devotion choices are created with `BlockRarities = { Duo = true
}`. The spurned god's post-combat reward repeats the same block. The
`SynergyTrait` requirement independently checks that the current room's
`ChosenRewardType` is not `Devotion`.

Therefore all three authored alternatives in either Devotion role must reject
traits whose sole rarity is `Duo`. This is one reward-context rule, not a
provider-pool mutation and not a copied negative condition on every Duo trait.

### `BlockGiftBoons` rooms

`RoomDataAnomaly` and `RoomDataC` declare `BlockGiftBoons = true`. Three
included traits require that fact to be absent from the current room:

- `PlantHealthBoon`;
- `RoomRewardBonusBoon`; and
- `MoneyMultiplierBoon`.

Anomaly may retain an ordinary boon reward and is therefore the relevant
current offer surface. `C_Boss` does not currently produce an in-scope boon,
but remains source evidence for the meaning of the room flag. Legality should
consume the resolved room fact; trait declarations should not name Anomaly or
`C_Boss` directly.

## Trait-Contributed and Derived Equipped Facts

The game rebuilds several run facts by folding the current equipped-trait
collection. These facts are not independent acquisition counters. The exact
equipped trait key and rarity, combined with declaration facts, are sufficient
to derive the modeled subset below.

### Element contributions and infusion eligibility

Trait inheritance supplies most ordinary god traits with one element. A trait
may instead contribute no element or multiple elements;
`AllElementalBoon`, for example, explicitly contributes `Aether`, `Earth`,
`Air`, `Fire`, and `Water`. The truthful declaration fact is therefore an
element-contribution set or count map, not one optional `element` field.

The ten `Elemental*Boon` infusion declarations inherit `UnityTrait`; their
membership in a god's pool does not grant that god's element. All ten therefore
contribute no elements. Their `BlockStacking`, `BlockInRunRarify`, and
`ExcludeFromRarityCount` flags come from `UnityTrait`; the
`ElementalOlympianDamageBoon` declaration in particular has no invented Earth
contribution and uses only the source Unity rarity domain.

The game rebuilds `Hero.Elements` by adding every equipped trait's declared
elements. `Earth`, `Air`, `Fire`, and `Water` are base elements; `Aether` is
not. `HighestBaseElementCount` is the maximum count among those four base
elements.

The ten included infusion/Unity traits use these offer thresholds:

| Trait                         | Offer requirement                                            |
| ----------------------------- | ------------------------------------------------------------ |
| `ElementalUnifiedBoon`        | `HighestBaseElementCount >= 4`                               |
| `ElementalRarityUpgradeBoon`  | `Fire >= 1` and `Earth >= 1` and `Air >= 1` and `Water >= 1` |
| `ElementalDamageBoon`         | `Earth >= 2`                                                 |
| `ElementalOlympianDamageBoon` | `Earth >= 4`                                                 |
| `ElementalBaseDamageBoon`     | `Fire >= 2`                                                  |
| `ElementalRallyBoon`          | `Fire >= 2`                                                  |
| `ElementalDamageFloorBoon`    | `Air >= 3`                                                   |
| `ElementalDodgeBoon`          | `Air >= 2`                                                   |
| `ElementalDamageCapBoon`      | `Water >= 4`                                                 |
| `ElementalHealthBoon`         | `Water >= 2`                                                 |

Their higher `ActivationRequirements` affect the strength or activation of an
already equipped trait; they do not raise the offer threshold. Most remain
outside the current simulation because their activated effects do not yet
change a modeled history fact. `ElementalRarityUpgradeBoon` is the exception:
its activation changes equipped rarities and the legal rarity domain of later
offers, so that lifecycle is retained below. The external
progression/narrative gate inherited by `UnityTrait` is collapsed by the
progressed baseline.

### Rarity-derived facts

The equipped ledger must retain each selected trait's concrete rarity. The
game derives `GodBoonRarities` from equipped traits that have a rarity, satisfy
the god-trait classification used by Shops and last-run boons, and do not
declare `ExcludeFromRarityCount`.

`CommonGlobalDamageBoon` is offerable only when the derived `Common` count is
zero. This is a cross-trait condition; it must not be approximated from loot
source names.

Fresh ordinary offers remain `Common`, `Rare`, or `Epic`. The in-run upgrade
order is:

```text
Common -> Rare -> Epic -> Heroic
```

`Heroic` is consequently a valid equipped rarity even though it is not a
fresh authored choice.

### Proper Upbringing lifecycle

`ElementalRarityUpgradeBoon` (Proper Upbringing) has two distinct element
thresholds:

- it may be offered at `Fire >= 1`, `Earth >= 1`, `Air >= 1`, and
  `Water >= 1`; and
- its equipped effect is active only at `Fire >= 2`, `Earth >= 2`,
  `Air >= 2`, and `Water >= 2`.

Crossing the activation threshold from inactive to active calls
`UpgradeAllCommon`. That operation visits the equipped collection once per
unique trait key and upgrades a trait from Common to Rare only when it:

- satisfies the game's god-trait classification with `ForShop = true`;
- does not declare `BlockInRunRarify`; and
- is currently Common.

The same activation installs a `GodLootOnly` rarity bonus with `Rare = 1`.
Because rarity rolls continue through higher valid rarities, this is a Rare
floor for later scalable god-loot choices rather than a command to make every
choice exactly Rare. It applies to ordinary Olympian and Hermes loot in the
currently modeled provider set when the proposed trait actually supports Rare.
It does not turn fixed-Common infusion traits, Hammer traits, fixed Legendary
traits, or fixed Duo traits into Rare choices.

Falling below the activation threshold removes the future-offer rarity bonus.
It does not downgrade traits already promoted to Rare. If the effect later
reactivates, `UpgradeAllCommon` runs again and promotes newly present eligible
Common traits. A trait acquisition or replacement that supplies the final
required element participates in the activation check after it enters equipped
state, so that newly selected trait is included when eligible.

The source function also assigns Proper Upbringing's own displayed rarity to
Rare on activation, independently of its rolled rarity. Its infusion rarity
participates in the game's offer-generation tabulation, but the planner models
possible authored offers rather than their rarity probabilities. The
self-assignment changes neither the effect's activation/strength nor a modeled
eligibility fact: the declaration is `BlockInRunRarify`, `BlockStacking`, and
`ExcludeFromRarityCount`. The planner therefore retains its authored rarity as
offer evidence and does not mutate its effective rarity on activation. This is
a deliberate probability/presentation collapse, not a general rule for
infusion traits. The observable promotions of other equipped traits and the
future-offer floor remain semantic. Selling, level/stack preservation,
presentation delays, double-boon handling, and sources that explicitly ignore
temporary or all rarity bonuses remain outside the slice.

### Three related upgradeability contracts

The source has three similar but distinct queries:

1. `Hero.UpgradableTraitCount` counts core god traits that do not declare
   `BlockStacking` and do not exclude themselves through
   `RequiredFalseTrait`. The query uses plain `IsGodTrait`, so it excludes
   boon-rarity providers outside the core nine. It does not inspect the current
   rarity's next step.
2. `RequiredUpgradeableGodTraits`, used by `BoonGrowthBoon`, calls
   `UpgradableGodTraitCountAtLeast(1)`. That query requires a unique persistent
   core god trait whose concrete rarity has a supported next in-run rarity
   and that does not declare `BlockInRunRarify`. It uses the same plain
   `IsGodTrait` classification.
3. `HasSuperchargeableBoon`, used by `BoonDecayBoon`, applies the same
   next-rarity and `BlockInRunRarify` tests and additionally rejects
   `BlockStacking` traits. It also uses plain `IsGodTrait` and has a special
   minimum-cooldown branch for Hephaestus Weapon, Special, and Sprint boons.

These must not collapse into one generic counter. The first implementation
slice models the first count exactly and evaluates the latter two predicates
from equipped traits plus declaration facts. Because every freshly authored
ordinary rarity has a next step through `Heroic`, Boon Decay will ordinarily
succeed when at least one equipped non-`BlockStacking` god trait exists. The
explicit next-rarity test is still retained so an all-`Heroic` ledger is
correctly ineligible when later work can create it.

This is deliberately separate from whether a provider rolls variable rarity.
In the supported normal-run model, the nine core gods are the only
providers whose eligible traits can receive Pom levels. Variable offer rarity
belongs to those nine plus Hermes, Artemis, Athena, and Dionysus. Hammers use
their independent Rank I/Rank II domain, with Icarus's Latest Model as the
modeled in-run Rank II transition. Other normal-run providers are fixed-rarity
and do not receive Pom levels. Hades participates in the source's broader
`IsGodTrait(..., { ForShop = true })` query and its traits carry processed
rarity tables, but its live field offer is effectively fixed Common and every
Hades trait declares `BlockInRunRarify`. Icarus choices
also explicitly author Common in normal runs; the dream-run rarity rewrite is
outside the supported route baseline.

On acquisition, `AddTraitData` first retains Bridal Glow itself, then
`HeraSuperchargeBoon` calls `AddRarityToTraits` with `NumTraits = 1`,
`TargetRarity = 4`, `MaxRarity = 3`, and `StackEligibleOnly = true`. The game
therefore chooses exactly one eligible equipped target and promotes it to
Heroic. It records that target on Bridal Glow as `UpgradedTraitName`; the
source boon remains equipped with its own rarity and Water element.

Trait levels and stacks are outside the current model, so the Hephaestus
rarity/cooldown exception cannot yet be represented. The supported lifecycle
therefore applies the generic non-`BlockStacking`, next-rarity rule to Hephaestus Weapon,
Special, and Sprint boons as well. This is an explicit temporary collapse, not
an implicit claim that every source cooldown state passes the game check. The
planner models the exact chosen target and its Heroic promotion; the additional
level/stack grant and later `CreditMissingStacks` adjustment remain deferred.

### Other direct condition dispositions

| Source condition                                   | Normalized disposition                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| already equipped                                   | modeled from exact equipped keys                                                                                    |
| `BlockOfferIfPreviouslyPicked`                     | equivalent to already equipped under the slice's no-sale/no-replacement lifecycle                                   |
| `PlantHealthBoon` shovel, bounty, and dream checks | collapsed by the progressed, non-bounty, non-dream baseline; `BlockGiftBoons` remains modeled                       |
| `WeaponUpgradeBoon` progression gate               | collapsed by the progressed baseline                                                                                |
| `UnityTrait` progression and narrative gates       | collapsed by the progressed baseline; element thresholds remain modeled                                             |
| mechanical activation/effect requirements          | deferred because this slice models offer legality, not trait effects                                                |
| Hephaestus cooldown/level exception in Boon Decay  | deferred until equipped trait levels/stacks exist; the generic non-stacking, next-rarity rule applies in this slice |

## Positive Equipped-Trait Dependency Graph

All in-scope pool members not listed below have no positive equipped-trait
prerequisite. The following aliases are copied from `LinkedTraitData` only to
keep the graph readable:

- `WeaponTraits`: the nine ordinary `*WeaponBoon` traits;
- `CastTraits`: the nine ordinary `*CastBoon` traits;
- `{God}Core`: that god's Weapon, Special, Cast, Sprint, and Mana traits;
- `AphroditeWeak`: `AphroditeCastBoon`, `AphroditeSprintBoon`,
  `AphroditeManaBoon`;
- `ApolloBlind`: `ApolloCastBoon`, `ApolloSprintBoon`,
  `ApolloRetaliateBoon`, `BlindChanceBoon`;
- `AresRend`: `AresWeaponBoon`, `AresSpecialBoon`;
- `AresBloodDrop`: `AresManaBoon`, `BloodDropRevengeBoon`;
- `AresSword`: `AresCastBoon`, `AresSprintBoon`, `OmegaDelayedDamageBoon`,
  `RendBloodDropBoon`;
- `DemeterRoot`: `DemeterWeaponBoon`, `DemeterSpecialBoon`,
  `DemeterCastBoon`;
- `HephaestusMassive`: `HephaestusWeaponBoon`, `HephaestusSpecialBoon`,
  `HephaestusSprintBoon`;
- `HeraLink`: `HeraWeaponBoon`, `HeraSpecialBoon`, `HeraCastBoon`,
  `HeraSprintBoon`;
- `HestiaBurn`: `HestiaWeaponBoon`, `HestiaSpecialBoon`, `HestiaCastBoon`;
- `PoseidonSplash`: `PoseidonWeaponBoon`, `PoseidonSpecialBoon`;
- `PoseidonKnockbackAmplify`: `PoseidonCastBoon`, `PoseidonStatusBoon`;
- `ZeusEcho`: `ZeusWeaponBoon`, `ZeusSpecialBoon`; and
- `ZeusBolt`: `ZeusWeaponBoon`, `ZeusSpecialBoon`, `ZeusCastBoon`,
  `ZeusSprintBoon`, `ZeusManaBoltBoon`, `BoltRetaliateBoon`,
  `CastAnywhereBoon`.

### Single-group dependencies

| Trait                          | Required equipped trait                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DoorHealToFullBoon`           | `any(HighHealthOffenseBoon)`                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `WeakPotencyBoon`              | `any(AphroditeWeak)`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `WeakVulnerabilityBoon`        | `any(AphroditeWeak)`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `BlindChanceBoon`              | `any(ApolloWeaponBoon)`                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ApolloBlindBoon`              | `any(ApolloBlind)`                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `DoubleStrikeChanceBoon`       | `any(WeaponTraits)`                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `ApolloExCastBoon`             | `any(CastTraits)`                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `AresExCastBoon`               | `any(CastTraits)`                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `RendBloodDropBoon`            | `any(AresRend, AresBloodDrop)`                                                                                                                                                                                                                                                                                                                                                                                                               |
| `AresStatusDoubleDamageBoon`   | `any(AresRend)`                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `SlowExAttackBoon`             | `any(WeaponTraits)`                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `CastAttachBoon`               | `any(CastTraits)`                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `RootDurationBoon`             | `any(DemeterRoot)`                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `MassiveDamageBoon`            | `any(HephaestusMassive)`                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `MassiveKnockupBoon`           | `any(HephaestusMassive)`                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `DamageSharePotencyBoon`       | `any(HeraLink)`                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `LinkedDeathDamageBoon`        | `any(HeraLink)`                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `SpawnCastDamageBoon`          | `any(CastTraits)`                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `OmegaZeroBurnBoon`            | `any(HestiaBurn)`                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `BurnArmorBoon`                | `any(HestiaBurn)`                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `BurnStackBoon`                | `any(HestiaBurn)`                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `PoseidonStatusBoon`           | `any(PoseidonSplash)`                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `PoseidonExCastBoon`           | `any(CastTraits)`                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `CastAnywhereBoon`             | `any(CastTraits)`                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `DoubleBoltBoon`               | `any(ZeusBolt)`                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `EchoExpirationBoon`           | `any(ZeusEcho)`                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `LightningDebuffGeneratorBoon` | `any(FocusLightningBoon)`                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `LuckyBoon`                    | `any(DoubleRewardBoon, PoseidonCastBoon, PoseidonStatusBoon, BoltRetaliateBoon, DoubleBoltBoon, SpawnKillBoon, BlindChanceBoon, DoubleStrikeChanceBoon, CritBonusBoon, HighHealthCritBoon, InsideCastCritBoon, TimedCritVulnerabilityBoon, FocusCritBoon, DashOmegaBuffBoon, SorceryCritBoon, AresManaBoon, BloodDropRevengeBoon, MissingHealthCritBoon, AresStatusDoubleDamageBoon, DoubleSplashBoon, BloodManaBurstBoon, MoneyDamageBoon)` |
| `TimeStopLastStandBoon`        | `any(HermesWeaponBoon, HermesSpecialBoon, HermesCastDiscountBoon, SprintShieldBoon, SorcerySpeedBoon, DodgeChanceBoon, SlowProjectileBoon, MoneyMultiplierBoon, TimedKillBuffBoon, RestockBoon, LuckyBoon)`                                                                                                                                                                                                                                  |
| `SorceryCritBoon`              | `any(SpellLaserTrait, SpellLeapTrait, SpellSummonTrait, SpellMeteorTrait, SpellTransformTrait, SpellMoonBeamTrait, SpellPolymorphTrait)`                                                                                                                                                                                                                                                                                                     |
| `OlympianSpellCountBoon`       | `any(PolymorphZeusTalent, MeteorHestiaTalent, TransformAphroditeTalent, LeapHephaestusTalent, LaserApolloTalent, SummonHeraTalent, TimeSlowDemeterTalent, PotionPoseidonTalent, MoonBeamAresTalent)`                                                                                                                                                                                                                                         |

The final two rows come directly from their traits' `GameStateRequirements`;
the preceding rows come from `TraitRequirements`.

### Multi-group dependencies

| Trait                        | Required equipped trait groups                                                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RandomStatusBoon`           | `all(any(AphroditeWeak); any(AphroditeWeaponBoon, AphroditeSpecialBoon); any(WeakPotencyBoon, WeakVulnerabilityBoon, HighHealthOffenseBoon, FocusRawDamageBoon))`                                                                                                        |
| `DoubleExManaBoon`           | `all(any(ApolloWeaponBoon, ApolloSpecialBoon); any(ApolloCastBoon, ApolloSprintBoon, ApolloManaBoon); any(DoubleStrikeChanceBoon, ApolloCastAreaBoon, ApolloBlindBoon, ApolloExCastBoon))`                                                                               |
| `DoubleBloodDropBoon`        | `all(any(AresRend); any(AresBloodDrop); any(AresExCastBoon, AresStatusDoubleDamageBoon, MissingHealthCritBoon, LowHealthLifestealBoon, OmegaDelayedDamageBoon))`                                                                                                         |
| `InstantRootKill`            | `all(any(DemeterRoot); any(PlantHealthBoon, ReserveManaHitShieldBoon, BoonGrowthBoon); any(SlowExAttackBoon, RootDurationBoon, CastAttachBoon))`                                                                                                                         |
| `WeaponUpgradeBoon`          | `all(any(HephaestusMassive); any(HeavyArmorBoon, ArmorBoon, EncounterStartDefenseBuffBoon); any(MassiveDamageBoon, AntiArmorBoon, MassiveKnockupBoon))`                                                                                                                  |
| `AllElementalBoon`           | `all(any(HeraLink); any(BoonDecayBoon, CommonGlobalDamageBoon, OmegaHeraProjectileBoon); any(DamageSharePotencyBoon, SpawnCastDamageBoon))`                                                                                                                              |
| `BurnSprintBoon`             | `all(any(HestiaBurn); any(BurnExplodeBoon, BurnArmorBoon, BurnStackBoon, OmegaZeroBurnBoon); any(CastProjectileBoon, FireballManaSpecialBoon))`                                                                                                                          |
| `AmplifyConeBoon`            | `all(any(PoseidonSplash); any(PoseidonSprintBoon, PoseidonManaBoon, PoseidonExCastBoon); any(EncounterStartOffenseBuffBoon, OmegaPoseidonProjectileBoon, PoseidonStatusBoon, FocusDamageShaveBoon))`                                                                     |
| `SpawnKillBoon`              | `all(any(ZeusCore); any(FocusLightningBoon, ZeusManaBoltBoon, CastAnywhereBoon, BoltRetaliateBoon); any(EchoExpirationBoon, DoubleBoltBoon, LightningDebuffGeneratorBoon))`                                                                                              |
| `ManaShieldBoon`             | `all(any(DamageShareRetaliateBoon, LinkedDeathDamageBoon, DamageSharePotencyBoon, SpawnCastDamageBoon, OmegaHeraProjectileBoon); any(MassiveDamageBoon, AntiArmorBoon, HeavyArmorBoon, ArmorBoon, EncounterStartDefenseBuffBoon, ManaToHealthBoon, MassiveKnockupBoon))` |
| `RaiseDeadBoon`              | `all(any(HeraCastBoon, HeraSprintBoon, HeraManaBoon); any(ApolloCastBoon, ApolloSprintBoon, ApolloManaBoon))`                                                                                                                                                            |
| `MoneyDamageBoon`            | `all(any(HeraWeaponBoon, HeraSpecialBoon, HeraCastBoon, OmegaHeraProjectileBoon); any(PoseidonWeaponBoon, PoseidonSpecialBoon, PoseidonCastBoon, OmegaPoseidonProjectileBoon); any(OmegaHeraProjectileBoon, OmegaPoseidonProjectileBoon))`                               |
| `RootStrikeBoon`             | `all(any(ZeusCore); any(DemeterRoot))`                                                                                                                                                                                                                                   |
| `KeepsakeLevelBoon`          | `all(any(DemeterCore); any(HeraCore))`                                                                                                                                                                                                                                   |
| `GoodStuffBoon`              | `all(any(PoseidonCore); any(DemeterCore); any(RoomRewardBonusBoon, DoubleRewardBoon, BoonGrowthBoon, PlantHealthBoon))`                                                                                                                                                  |
| `ApolloSecondStageCastBoon`  | `all(any(ApolloExCastBoon); any(ZeusWeaponBoon, ZeusSpecialBoon, ZeusCastBoon, ZeusSprintBoon))`                                                                                                                                                                         |
| `PoseidonSplashSprintBoon`   | `all(any(ApolloCore); any(PoseidonCore); any(ApolloSprintBoon, PoseidonSprintBoon))`                                                                                                                                                                                     |
| `StormSpawnBoon`             | `all(any(ApolloCore); any(DemeterSprintBoon, CastNovaBoon))`                                                                                                                                                                                                             |
| `SprintEchoBoon`             | `all(any(ZeusEcho); any(AphroditeCore))`                                                                                                                                                                                                                                 |
| `CharmCrowdBoon`             | `all(any(HeraLink); any(AphroditeWeak))`                                                                                                                                                                                                                                 |
| `MaxHealthDamageBoon`        | `all(any(DemeterWeaponBoon, DemeterSpecialBoon, DemeterManaBoon, DemeterSprintBoon, PlantHealthBoon); any(AphroditeWeaponBoon, AphroditeSpecialBoon, AphroditeManaBoon, AphroditeSprintBoon, DoorHealToFullBoon))`                                                       |
| `ManaBurstCountBoon`         | `all(any(ManaBurstBoon); any(ApolloCore))`                                                                                                                                                                                                                               |
| `EchoBurnBoon`               | `all(any(ZeusEcho); any(HestiaBurn))`                                                                                                                                                                                                                                    |
| `ManaRestoreDamageBoon`      | `all(any(HeraLink); any(HestiaCore))`                                                                                                                                                                                                                                    |
| `SteamBoon`                  | `all(any(PoseidonKnockbackAmplify); any(HestiaWeaponBoon, HestiaSpecialBoon, HestiaCastBoon, HestiaSprintBoon, FireballManaSpecialBoon, CastProjectileBoon))`                                                                                                            |
| `BurnConsumeBoon`            | `all(any(DemeterRoot); any(HestiaBurn))`                                                                                                                                                                                                                                 |
| `CoverRegenerationBoon`      | `all(any(ApolloBlind); any(HestiaCore))`                                                                                                                                                                                                                                 |
| `BurnRefreshBoon`            | `all(any(HestiaBurn); any(AphroditeWeak))`                                                                                                                                                                                                                               |
| `ReboundingSparkBoon`        | `all(any(FocusLightningBoon); any(HephaestusCore))`                                                                                                                                                                                                                      |
| `MassiveCastBoon`            | `all(any(PoseidonCore); any(HephaestusMassive))`                                                                                                                                                                                                                         |
| `ClearRootBoon`              | `all(any(HephaestusMassive); any(DemeterRoot))`                                                                                                                                                                                                                          |
| `BlindClearBoon`             | `all(any(HephaestusMassive); any(ApolloBlind))`                                                                                                                                                                                                                          |
| `SlamManaBurstBoon`          | `all(any(AphroditeCore); any(HephaestusMassive))`                                                                                                                                                                                                                        |
| `DoubleMassiveAttackBoon`    | `all(any(HephaestusMassive); any(HestiaCore))`                                                                                                                                                                                                                           |
| `SuperSacrificeBoonZeus`     | `all(any(HeraCastBoon, HeraManaBoon, HeraSprintBoon); any(ZeusCore))`                                                                                                                                                                                                    |
| `SuperSacrificeBoonHera`     | `all(any(HeraCore); any(ZeusCastBoon, ZeusManaBoon, ZeusSprintBoon))`                                                                                                                                                                                                    |
| `LightningVulnerabilityBoon` | `all(any(PoseidonKnockbackAmplify); any(ZeusWeaponBoon, ZeusSpecialBoon, ZeusCastBoon, ZeusSprintBoon, BoltRetaliateBoon, CastAnywhereBoon))`                                                                                                                            |
| `AllCloseBoon`               | `all(any(PoseidonCore); any(AphroditeWeaponBoon, AphroditeSpecialBoon))`                                                                                                                                                                                                 |
| `SelfCastBoon`               | `all(any(AresCastBoon, AresExCastBoon, OmegaDelayedDamageBoon); any(DemeterCore))`                                                                                                                                                                                       |
| `AutoRevengeBoon`            | `all(any(AresRend); any(ZeusCore); any(BloodDropRevengeBoon, ApolloRetaliateBoon, BoltRetaliateBoon))`                                                                                                                                                                   |
| `BloodRetentionBoon`         | `all(any(AresBloodDrop); any(HeraCore))`                                                                                                                                                                                                                                 |
| `RapidSwordBoon`             | `all(any(AresSword); any(HephaestusCore))`                                                                                                                                                                                                                               |
| `DoubleSwordBoon`            | `all(any(AresSword); any(ApolloCore))`                                                                                                                                                                                                                                   |
| `DoubleSplashBoon`           | `all(any(AresCore); any(PoseidonSplash))`                                                                                                                                                                                                                                |
| `FireballRendBoon`           | `all(any(AresCore); any(FireballManaSpecialBoon, CastProjectileBoon))`                                                                                                                                                                                                   |
| `BloodManaBurstBoon`         | `all(any(AresBloodDrop); any(AphroditeCore))`                                                                                                                                                                                                                            |

## Audit Conclusions

1. The nine ordinary Olympians share one stable pool shape: 22 unique traits
   per giver, with core, secondary, elemental, legendary, and Duo entries in
   one declaration-owned domain.
2. Hermes is a separate 13-trait giver. Only `LuckyBoon` and
   `TimeStopLastStandBoon` have positive equipped-trait prerequisites.
3. Artemis and Athena each add one direct spell-state dependency outside the
   central `TraitRequirements` table. Icarus's Ingenious Strike and Ingenious
   Flourish require the occupied Attack and Special slots respectively; Latest
   Model requires one exact eligible Hammer target.
4. The audited Story-room pools contain no positive equipped-trait
   prerequisites, but several entries are effect-backed choices rather than
   simple persistent inventory additions.
5. Daedalus traits have no positive equipped-trait prerequisites. Their legal
   domain is still loadout- and exclusion-dependent: 48 of the 92 pooled traits
   explicitly restrict compatible aspects, while the other 44 have no aspect
   condition. One mutual equipped-trait exclusion pair applies to the Argent
   Skull. Route-level weapon and aspect selection and exact equipped traits are
   therefore necessary inputs before producing a legal Hammer offer pool.
6. Devotion's no-Duo rule and the declaration-owned `BlockGiftBoons` room fact
   are offer-context inputs. They do not belong in giver membership or copied
   per-trait room-name checks.
7. Exact equipped trait keys and rarities are the canonical state from which
   element counts, base-element maximum, god-boon rarity counts, and the three
   distinct upgradeability predicates derive. Persisted shadow counters would
   create a second authority.
8. `Heroic` is excluded from fresh ordinary offer authorship but retained in
   the equipped rarity universe so next-rarity eligibility has a truthful
   boundary. Boon Decay's effect and its Hephaestus level/cooldown exception
   remain deferred until levels and rarity mutation are modeled.
9. Loot/use history remains independently meaningful. This inventory supports
   an additive trait event ledger and folded equipped-trait state; it does not
   justify replacing the existing exact loot ledgers.
10. The closure inventory contains 21 givers, 386 giver-to-trait memberships,
    351 unique trait keys, and 76 in-scope traits with positive
    equipped-trait prerequisites. The broader source graph contains 77 such
    owners after retaining the remaining deferred Athena spell-state rows.

## Olympian Replacement Source Closure

The installed `UpgradeChoiceLogic.lua` and `TraitLogic.lua` replacement paths
retain the following possibility semantics. A normal replacement is drawn only
from an Olympian giver's normalized `PriorityUpgrades` (`priorityTraitKeys`),
must be a new trait whose ordinary slot is occupied by a different equipped
trait, and keeps every ordinary requirement and offer-context predicate. The
occupant may belong to another god. Its supported rarity advances exactly
`Common -> Rare -> Epic -> Heroic`; a Heroic occupant has no replacement.
Replacement identity is therefore a derived transition from the pre-offer
equipped ledger and authored option rarity, not a persisted offer field.

The game seeds at most one normal replacement and fills additional positions
with replacements only after the ordinary pool is exhausted. The planner
retains the possibility boundary without the source's 10 percent roll,
progression gates, force flags, counters, level/stack transfer, or
`ExchangeLevelBonus`. For an exact pre-offer branch, ordinary availability is
the count of distinct legal trait keys with at least one legal fresh rarity;
the maximum replacement count is `ordinaryCandidateCount >= 2 ? 1 : 3 -
ordinaryCandidateCount`. Replacement alternatives remain independent against
the same pre-offer state.

## Normalized Source-Closure Fields

The supported trait-offer catalog consumes the following declaration facts
from the installed scripts. These are normalized without
moving any lifecycle, authored-state, or simulation policy into declarations:

| Normalized fact               | Source authority and closure result                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| trait labels                  | English `TraitText.en.sjson` `DisplayName` for every included Olympian, Hermes, field-NPC, and Hammer key                                                                                                                                                                                                                                                               |
| fresh/equipped rarity domains | each included `TraitData_*` `RarityLevels`; ordinary scalable offers are `Common/Rare/Epic`, equipped state retains `Heroic`; Legendary/Duo retain their sole rarity; Hammer declarations use a `none` rarity domain (source `ForceCommon` is not player rarity, while the exact 65-member source Legendary capability is normalized separately as Hammer Rank-II data) |
| ordinary boon slots           | direct `Slot` declarations, limited to `Melee`, `Secondary`, `Ranged`, `Rush`, and `Mana`                                                                                                                                                                                                                                                                               |
| element contributions         | inherited `AirBoon`, `FireBoon`, `EarthBoon`, `WaterBoon`, and `AetherBoon` facts plus direct multi-element declarations; base elements are `Earth`, `Air`, `Fire`, and `Water`                                                                                                                                                                                         |
| god-trait/rareness flags      | the core-god versus broader boon-rarity distinction plus inherited `LegendaryTrait`, `SynergyTrait`, and `UnityTrait` facts, including `BlockStacking`, `BlockInRunRarify`, and `ExcludeFromRarityCount`; Hammer traits belong to neither trait classification                                                                                                          |
| self-exclusion                | no included trait declares a distinct `RequiredFalseTrait`; the optional field remains absent rather than being invented                                                                                                                                                                                                                                                |
| offer requirements            | all 76 in-scope positive dependency rows are retained as exact game-key operands (aliases are expanded from `LinkedTraitData`); the broader source graph has 77 owners including the remaining deferred Athena spell-state rows; Hammer and cast-family `HasNone` predicates are explicit negative requirements                                                         |
| element thresholds            | all ten audited infusion thresholds are represented: `ElementalUnifiedBoon`, `ElementalRarityUpgradeBoon`, `ElementalDamageBoon`, `ElementalOlympianDamageBoon`, `ElementalBaseDamageBoon`, `ElementalRallyBoon`, `ElementalDamageFloorBoon`, `ElementalDodgeBoon`, `ElementalDamageCapBoon`, and `ElementalHealthBoon`                                                 |
| rarity-derived predicates     | `CommonGlobalDamageBoon` requires zero derived Common god-boon count; `BoonGrowthBoon` and `BoonDecayBoon` retain distinct rarifiable and superchargeable predicates                                                                                                                                                                                                    |
| offer context                 | `devotionNoDuo` blocks `Duo` rarity; `blockGiftBoons` consumes the room-owned `BlockGiftBoons` flag for `PlantHealthBoon`, `RoomRewardBonusBoon`, and `MoneyMultiplierBoon`; no trait names a room                                                                                                                                                                      |

The normalized inventory has six weapons, 24 weapon/aspect pairs, 293 unique
included trait declarations, 236 Olympian/Hermes/field-NPC memberships across
13 non-Hammer givers, 92 Hammer memberships under the fourteenth giver, and one
loadout-keyed Hammer default triple for each of the 24 pairs. Deferred
spell/talent operands remain exact keys
only; Artemis, Athena, and Icarus are the modeled field-NPC providers, while
other NPC, Story, Spell, or Talent providers remain outside the persistent
trait catalog. Other source
predicates retain the dispositions above or the previously recorded
progressed-baseline, mechanical-effect, and Hephaestus level/cooldown
deferrals. Newly discovered predicates are explicitly listed above rather than
covered by a no-unlisted claim.
