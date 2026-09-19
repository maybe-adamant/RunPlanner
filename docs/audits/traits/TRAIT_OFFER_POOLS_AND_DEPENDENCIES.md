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
- `LootData.lua`, `ConsumableData.lua`, `WorldUpgradeData.lua`,
  `RewardLogic.lua`, `StoreLogic.lua`, `InteractLogic.lua`, `EventLogic.lua`,
  `UpgradeChoiceData.lua`, `UpgradeChoiceLogic.lua`, `TraitLogic.lua`,
  `HeroData.lua`, and `RunLogic.lua` for the shared three-choice surface, Pom
  and random-Stack behavior, source-sensitive Nectar upgrades, provider rarity
  behavior, equipped rarity/level state, replacement transfer, Story-choice
  effects, and element folding;
- `TraitData.lua` for `LinkedTraitData` and `TraitRequirements`; and
- the individual `TraitData_*.lua` files for direct equipped-trait conditions
  declared on a trait rather than in `TraitRequirements`;
- `TraitData_Elementals.lua` for elemental contributions and infusion offer
  thresholds;
- `EncounterLogic.lua` and `RewardLogic.lua` for Devotion rarity blocking; and
- `RoomDataAnomaly.lua` and `RoomDataC.lua` for the room-owned
  `BlockGiftBoons` fact.

The audit uses the current progressed, non-bounty, non-dream baseline already
established by the reward model. Selene spell progression and Chaos
blessing/curse effect details are audited separately in [Selene spell game
data](SELENE_SPELL_GAME_DATA_AUDIT.md) and [Chaos trait game
data](CHAOS_TRAIT_GAME_DATA_AUDIT.md), while their SpellDrop and Chaos provider
identities are included in the normalized catalog inventory. Keepsakes, Arcana
forcing, and prior-run Echo payload content are likewise outside this
inventory.

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
sections separately record the other legality axes. Neither inventory records:

- the ordinary rule that an already-owned trait is not offered again;
- occupied-slot replacement and incompatible cast or Hammer traits;
- save or narrative progression requirements collapsed by the audit baseline;
- `PriorityChance`; or
- negative `HasNone` conditions.

Those are separate legality axes. In particular, weapon/aspect filtering is
summarized below but is not an equipped-trait prerequisite.

The game also routes NPC and Story choices through `Traits` arrays even when
selecting an entry immediately executes an effect. `UpgradeHammerBoon` and
`NarcissusA..I` are effect-backed choice keys whose exact persistence must be
classified before treating them as inventory. Echo is different: generic trait
acquisition inserts every selected Echo identity into hero trait
state before its acquisition callback runs. The source `Hidden` flag affects
presentation, not persistence; its internal scaling tier is not player-facing
boon rarity.

### Priority-upgrade closure

The source `GetPriorityTraits`/`PriorityUpgrades` surface supplies initial
core and replacement candidates. Each ordinary Olympian declares exactly five core
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
Normalization verifies membership, uniqueness and coverage of the five ordinary
slots. Olympian defaults use priority keys and include Attack or Special;
actual core seeding depends on provider-eligible state, not a global first-offer
flag.

## Offer Shape and Rarity Domains

The [initial-screen audit](TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md)
owns generation, optional linked-priority support, replacement rescue, Denial
and Gold. Olympian/Hermes screens contain up to three distinct alternatives
against one pre-selection state; only the selection is equipped. Short or
empty outcomes must be reachable after native fill stages.

Scalable ordinary traits declare Common/Rare/Epic; fixed Legendary and Duo
members keep their own tier. Heroic is not an ordinary fresh roll, but exact
replacement and in-run promotion can reach it. Gorgon's source-specific Heroic
is separate. `WeaponUpgrade` uses internal ForceCommon without player rarity;
its native Legendary upgrade is represented as Hammer Rank II.

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
SpellDrop is the production provider for these eight spell identities; their
progression and effect details remain in the separate Selene audit.
All nine contribute one `Air` or `Earth` element as inherited by the source
trait declarations; `FocusCritBoon` is explicitly non-stacking. Artemis has no
Olympian priority/replacement policy and uses the non-Olympian field-NPC
provider path.

#### Icarus

`FocusAttackDamageTrait`, `FocusSpecialDamageTrait`, `OmegaExplodeBoon`,
`CastHazardBoon`, `BreakInvincibleArmorBoon`, `BreakExplosiveArmorBoon`,
`SupplyDropBoon`, `UpgradeHammerBoon`.

`NPCData_Icarus.lua` exposes these eight choices in that order. Its live
benefit-choice entries set their internal scaling tier to Common. The
individual `TraitData_Icarus.lua` declarations retain wider
Common/Rare/Epic/Heroic scaling levels, but the player sees no boon rarity and
the traits do not participate in ordinary boon-rarity mutation. The planner
therefore authors Icarus without rarity and resolves its numeric effects from
the acquisition ordinal; see the [route-position profiles](../rooms-and-routes/ROUTE_POSITION_GAME_DATA_AUDIT.md#npc-acquisition-profiles).

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

Ingenious Strike's source requirement checks the occupied Attack slot;
Ingenious Flourish checks the occupied Special slot. The planner represents
those conditions with the nine concrete core-god traits for each slot. Native
`IcarusUpgradeBoon` derives the occupied slot target and adds the declaration's
normal-run `Count = 3`. The same target must remain upgradeable under the
ordinary Pom predicate. This retains the exact Hephaestus exception: the
matching Attack or Special trait is no longer eligible once its extracted
`UnmodifiedCooldown` is not greater than 2, represented by the declaration-owned
maximum eligible levels. The planner therefore derives the slot target and
adds the ordinal-resolved levels without authoring a second random target.

Supply Chain declares `CurrentRoom = 0` and `RoomsPerUpgrade.Amount = 7` in a
normal run. Each seventh qualifying `CheckChamberTraits` checkpoint resets the
clock and calls `GiveRandomConsumables` for one simulation-neutral minor heal
and exactly two optional `StoreRewardRandomStack` Pom Slice objects. The clock
repeats while the trait remains equipped. `EndEncounterEffects` calls
`CheckChamberTraits` for each current room encounter. In a multi-phase O ship
room, `StartRoom` assigns each `Encounters[i]` entry as the current encounter;
the inherited combat Intro and both combat phases therefore each qualify even
though the Intro does not count for room encounter depth. Chaos rooms declare
`SkipTimedDropResources = true`; when a threshold lands there, native behavior
retains progress at `Amount - 1`, emits nothing, and matures on the next
qualifying encounter-end checkpoint. The planner retains those source-owned
facts at the shared encounter-end-effects seam and exposes the two Pom Slices
through the ordinary generated-pickup and direct-level acquisition machinery;
it does not add a modeled healing mutation or an Icarus-specific Pom path.
Dream's fourth-ordinal interval is three encounters; earlier ordinals retain
seven. The interval is captured at acquisition. Conditional boss deferral is
covered by the [scheduled-effects audit](../rooms-and-routes/SCHEDULED_AND_AUTOMATIC_TIMELINE_OUTCOMES_AUDIT.md).

Both Coating traits can later be consumed by combat, and other Icarus combat
effects remain outside the planner's trait-acquisition scope; selecting each
source still leaves that source in the equipped trait ledger.

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
  native operands. The planner uses the accepted settled concrete Spell Drop
  prefix; a starting Hex alone is not that evidence. The
  [volatile eligibility audit](../rewards-and-acquisition/VOLATILE_OFFER_ELIGIBILITY_GAME_DATA_AUDIT.md)
  owns this bounded approximation.

`RetaliateInvulnerabilityBoon`, `FocusLastStandBoon`, `InvulnerabilityCastBoon`,
and `ManaSpearBoon` declare no additional offer requirement in the installed
trait data. Athena contributes no ordinary boon slot, no negative equipped-trait
requirement, no non-stacking/rerify block, and no exclusion from rarity count.
The narrative/save predicates above remain source evidence rather than guessed
production state.

### Story-Room Choice Givers

#### Internal NPC scaling versus boon rarity

Several NPC traits reuse the source `Rarity` field to select numeric scaling
rows without joining the player-facing god-boon rarity system. The ordinary
Echo interaction makes this distinction explicit: `EchoChoice` assigns every
eligible choice internal `Epic`, matching Echo's ordinary third-biome
placement, while the Dream Dive branch replaces that value from the number of
entered biomes so Echo can scale from the first through fourth mixed biome.
`TraitData_Echo.lua` declares the corresponding scaling rows, and
`ForceCommonAppearanceTrait` suppresses the rarity name in player-facing
presentation rather than converting the underlying value to Common.

These scaling values are outside the mutation boundary used by Proper
Upbringing, Bridal Glow, and Aromatic Phial. Arachne, Icarus, Medea, Narcissus,
Circe, and Echo are outside the relevant `IsGodTrait`/shop-god classification;
Hades participates in the broader shop-style predicate. NPC Hades options
carry runtime `Common` and may therefore enter the sell-trait shop; direct and
Jeweled Pom Hades grants omit runtime `Rarity` and cannot. Every Hades trait
declares `BlockInRunRarify`. The different source exclusion mechanisms have
the same supported planner consequence: these traits expose no authored,
persisted, counted, mutable, or displayed boon rarity. The planner therefore
normalizes Arachne, Icarus, Medea, Narcissus, Circe, Hades, and Echo through the
explicit `none` rarity domain. The nine ordinary Olympians, Hermes, Athena,
Artemis, and Dionysus retain real player-facing rarity. Dream Dive and the
NPCs' scaled combat numbers remain outside scope.

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

#### Narcissus effect inventory

Narcissus's nine player-rarityless menu entries are trait identities whose
acquisition functions create benefits. Each selected identity also enters the
Planner's equipped-trait history, while its declaration-owned pickup producer
owns the separate generated acquisitions. External tool, dialogue,
lifetime-resource, and unlock predicates collapse under the progressed
baseline; the current-run predicates and outputs below do not.

| Choice       | Label                 | Current-run eligibility                            | Exact source output and supported consequence                                                                                                                                                                                                                      |
| ------------ | --------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NarcissusA` | Verdure Sampler       | `StackUpgradeLegal`                                | Moly, Nightshade, and one `StoreRewardRandomStack`; the latter records its exact acquisition and applies one random `+1` Pom mutation                                                                                                                              |
| `NarcissusB` | Heartfelt Condolences | none                                               | Ashes and one major heal; numeric healing and resource quantity have no downstream planner effect                                                                                                                                                                  |
| `NarcissusC` | Precious Metals       | none                                               | Silver and one `Currency` pickup; preserve the source-faithful Gold acquisition/history while affordability, quantity, and Silver remain outside the planner                                                                                                       |
| `NarcissusD` | Mystic Secrets        | none                                               | Psyche and one `MaxManaDrop`; preserve the supported concrete acquisition/history while numeric Magick is outside the planner                                                                                                                                      |
| `NarcissusE` | Ancestral Offering    | none                                               | Bones and one `MaxHealthDrop`; preserve the supported concrete acquisition/history while numeric Life is outside the planner                                                                                                                                       |
| `NarcissusF` | Fates' Trimmings      | `RerollAvailable`                                  | Fabric and two rerolls; reroll inventory and use remain deferred, so the option is a declared no-op for downstream supported state                                                                                                                                 |
| `NarcissusG` | Heavenly Splendor     | none after progressed-story collapse               | one Stardust and two `ElementalBoost` pickups; each pickup adds one hidden `ElementalEssence` carrying Air, Earth, Fire, and Water                                                                                                                                 |
| `NarcissusH` | Life Savings          | missing Death Defiance plus collapsed Lotus unlock | one `LastStandDrop` and Lotus; preserve the exact authored pickup history while the [volatile eligibility audit](../rewards-and-acquisition/VOLATILE_OFFER_ELIGIBILITY_GAME_DATA_AUDIT.md) owns the exact-result boundary without simulating Death Defiance counts |
| `NarcissusI` | Mixed Blessings       | collapsed persistent Blind Box unlocks             | one `BlindBoxLoot` and one Mystery Seed; the box requires an authored hidden source and that source's ordinary trait offer at unwrap time                                                                                                                          |

Every `GiveRandomConsumables` call in these declarations passes
`RunProgressUpgradeEligible = true`. That is a producer fact, not permission to
invent effects for outputs that do not declare a `RunProgress` overlay.
`NarcissusA` already produces the intrinsically random-Pom consumable; it does
not produce `GiftDrop`.

#### Echo effect inventory

Echo's live menu uses internal Epic scaling in an ordinary run and a
biome-indexed internal tier in Dream Dive, while `ForceCommonAppearanceTrait`
hides the rarity label. Every selected outer identity is first inserted into
hero trait state, including the four source-hidden effect-backed keys. Its
entries then mix one-shot effects, temporary lifecycle state, and additional
acquired traits, so the selected key alone is not a sufficient acquisition
model. The planner retains and shows all eight outer identities truthfully in
Run State but omits the source's non-boon scaling tier.

| Choice                         | Label                   | Eligibility                                                                          | Exact source effect and baseline disposition                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | ----------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EchoLastReward`               | Reward Reward Reward    | a prior effective `LastRewardEligible` pickup exists                                 | recreate that exact reward source; a loot source opens a fresh offer, while a consumable repeats its pickup. Recreated consumables receive `RunProgressUpgradeEligible = true`, including replayed Nectar                                                                                                                                                      |
| `EchoLastRunBoon`              | Boon Boon Boon          | eligible prior-run trait payload and no previous Shrine encounter                    | the game filters the prior run's exact trait/rarity cache against current eligibility, occupied slots, equipped traits, giver participation, and explicit exclusions, then offers up to three cross-provider traits and directly equips the selected one                                                                                                       |
| `EchoDeathDefianceRefill`      | Survive Survive Survive | missing Death Defiance                                                               | retain the exact trait identity while the [volatile eligibility audit](../rewards-and-acquisition/VOLATILE_OFFER_ELIGIBILITY_GAME_DATA_AUDIT.md) owns volatile native eligibility; restoration count and healing remain outside the planner                                                                                                                    |
| `EchoDoubleLevelBoon`          | Pom Pom Pom             | no offer-time requirement                                                            | among Pom-eligible equipped traits at the greatest current level, choose one random tied target and add that same level, thereby doubling it; with no eligible target the game performs no mutation                                                                                                                                                            |
| `DiminishingDodgeBoon`         | Evade Evade Evade       | none                                                                                 | persistent equipped Echo trait; retain identity while numeric dodge and per-dodge decay remain outside the planner                                                                                                                                                                                                                                             |
| `DiminishingHealthAndManaBoon` | Fight Fight Fight       | none                                                                                 | persistent equipped Echo trait; retain identity while numeric Life/Magick and room decay remain outside the planner                                                                                                                                                                                                                                            |
| `EchoDoubleShop`               | Gold Gold Gold          | none                                                                                 | equip one one-use Echo trait. The next purchased World Shop item other than `SpellDrop` sees that equipped trait, recreates the item for free, and consumes the trait's use. Loot recreations open a fresh trait offer; consumables use the Shop-duplicate creation path, which does not opt `GiftDrop` into its run-progress level effect                     |
| `EchoRepeatKeepsakeBoon`       | Gift Gift Gift          | current keepsake is not one of the four source exclusions plus collapsed progression | capture the exact current keepsake at acquisition and replay its supported rank-I effect at biome start. Gorgon Amulet and Jeweled Pom are excluded among the six modeled effects; Fig Leaf and Experimental Hammer replay once, while Calling Card and Time Piece add uses every biome. Other eligible keepsakes remain effect-neutral until their own slice. |

`CurrentRun.LastReward` is not simply the latest reward-history event. Loot
inherits `LastRewardEligible = true`; consumables/resources declare or inherit
their own effective value, and the last assignment in a Lua table wins. In
particular, `GiftDrop` first writes `false` and later writes `true`, so Nectar
is replayable. Echo's replay must retain the exact resolved reward source and
must not synthesize a generic Boon, Pom, or consumable alias.

The planner can support Boon Boon Boon without pretending to know the previous
run. The authored approximation is one to three source-resolved
`{giver, trait, rarity}` outcomes from the source-valid Echo domain that remain
legal under Echo's replay-specific current-run exclusions, followed by one direct selection. A
row retains the same selected-acquisition payload as an ordinary acquisition,
including All Together, Natural Selection and Bridal Glow when applicable.
Bridal availability still requires a preferred target at offer time; its
selected target query may use acquisition fallback after the source is
equipped. Carrier choice does not truncate the nested effect.
`KeepsakeLevelBoon` reuses the current-keepsake transition without a new row
field. These rows stand in for the unknown prior-run cache; they are not
evidence those traits appeared in a previous run or members of a fictional
Echo giver.

Every authored row is revalidated against the same pre-Echo frontier before
the selected row settles. A condition-bearing nested trait remains the exact
authored result; the [volatile eligibility audit](../rewards-and-acquisition/VOLATILE_OFFER_ELIGIBILITY_GAME_DATA_AUDIT.md)
owns the live-mismatch disposition rather than adding a Death Defiance input to
the Echo row. One otherwise-invalid selected or unselected row retains the
outer acquisition and child for repair without recording any nested trait or
loot-source history.

A single-provider trait contributes one outcome variant. A Duo trait present in
both participating giver inventories contributes two variants, one for each
possible history source. This represents `GetLootSourceName` returning the first
matching entry from unordered `pairs(LootData)` traversal. Offer distinctness
remains keyed by trait identity: both variants of the same Duo can never occupy
two rows in one offer. Selecting a Duo variant increments exactly that one
giver's loot history and equips one copy of the trait; it never adds both gods.
The authored rarity must belong to the trait's exact equipped-rarity domain,
including Heroic, Legendary, and Duo. The active rarity floor changes only a
Common result to Rare. Direct settlement bypasses ordinary offer composition,
`TraitRequirements`, replacement composition, and Calling Card actions while
retaining the selected trait's own acquisition behavior. Current Vow of Denial
bans remain replay exclusions, but unselected BBB rows do not create new bans.

The source-valid domain is closed over the giver inventories already recorded
in this audit. `IsGodTrait(..., { ForShop = true, ForLastRunBoon = true })`
admits the nine ordinary Olympians, Hermes, Artemis, Athena, and Dionysus. It
does not admit the other field-NPC or Story providers, Hammers, Selene, or
Chaos. Hades otherwise participates in the shop-style god predicate, but
`NPC_Hades_Field_01.ExcludeFromLastRunBoon = true` removes the entire Hades
pool. A member of this union is still eligible only when its exact key is in
the previous-run rarity cache, it is not currently equipped or banned, its
ordinary slot is open when it has a slot, its queryable source
`GameStateRequirements` pass, and it does not set
`ExcludeTraitFromLastRunBoonPool`. Source `IsTraitEligible` checks those
current-run and game-state exclusions; it does not re-run the ordinary boon
`TraitRequirements` graph. Boon Boon Boon is
therefore neither the union of every giver in this document nor the current
run's ordinary god pool.

`SelectEchoBoon` performs one additional chronological mutation before it
equips the selected processed trait. It resolves the selected key through
`GetLootSourceName` and, when that resolution returns a source, increments
`CurrentRun.LootTypeHistory[source]`. Consequently, selecting a boon from one
of the nine ordinary Olympians adds that Olympian to the current run's
interacted-god set even when the provider was absent before Echo. The selection
is not checked against `ReachedMaxGods`; if the ordinary pool was already at
its cap, the newly recorded provider joins the acquired set and future
cap-narrowed ordinary rewards draw from the expanded acquired set. An already
recorded provider only increments its count and does not change set membership.
Hermes can also receive a loot-history record, but `GodLoot = false` keeps it
outside `GetInteractedGodsThisRun` and the ordinary god cap. Field-NPC
participation does not make Artemis, Athena, or Dionysus ordinary-pool members.
An unselected, missing, or context-invalid authored row must not mutate loot
history.

The coarse outer requirement uses `EligiblePrevRunTraits`, which is computed
without the later `ForLastRunBoon` provider exclusion. A Hades-only prior cache
can therefore make the source outer row visible even though the nested menu's
actual filter excludes every Hades result. The planner deliberately requires at
least one legal nested outcome before publishing the outer Boon row, avoiding
an empty authored child while recording this stricter-than-source boundary.

Gold Gold Gold needs no parallel pending-effect record. `EchoDoubleShop`
itself is the equipped pending state. The first eligible purchased World Shop
entry consumes that one-use trait after Shop-kernel acceptance and materializes
a separate free duplicate before the paid entry's acquisition roles;
the duplicate may be interacted with later among other room acquisitions.
`SpellDrop` neither triggers nor consumes it. With no later eligible World Shop
purchase, the trait remains equipped. The duplicate is created from the
pre-source-acquisition branch: the paid source identity is known, but its boon
choice or consumable effect has not yet entered history. Wells use separate
purchase paths and are not part of this effect. The current planner represents
the materialized duplicate as the stable `echoDoubleShopReward` pickup.
Outcome editing follows explicit placement in the room's action order;
required versus optional participation follows the native loot/consumable
split recorded in the reward acquisition audit. No source-keyed child,
second order, or pending-effect ledger exists. Pom
duplicates retain the exact `StackOnly` interaction exception: if a stored
target disappeared before pickup, the final visible Pom options regenerate
from the pickup frontier.

The keepsake model owns the current identity at Echo acquisition,
ordered later replacements, supported rank-I profiles, and a biome-start
transition. Gift Gift Gift therefore participates in the complete eight-choice Echo
provider. Its captured key belongs to the equipped Echo trait and never follows
a later rack swap. The four source exclusions remain exact; modeled replay is
narrowed to the supported keepsake effects, with other eligible identities
retained as effect-neutral chronological facts.

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

`CastLobBoon` and `HadesCastProjectileBoon` carry reciprocal exclusions for the
other four members. All five are modeled declarations. These negative
current-state conditions remain eligibility requirements, not linked boon
prerequisites that Echo replay bypasses.

## Offer-Context Restrictions

Some offer restrictions belong to the room or reward that produced the choice,
not to equipped trait history. The normalized catalog has two such rules.

### Devotion rarity blocking and declaration eligibility

Both initial choices and the spurned reward set `BlockRarities.Duo`, writing
a zero Duo chance. Most Duos also inherit a Devotion exclusion in
`SynergyTrait.GameStateRequirements`; five replace that table.
The [construction audit](TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md#trial-of-the-gods)
owns the exact list and non-Denial final-rescue contact. Room context, resolved
declaration requirements and generation support remain distinct; there is no
blanket identity ban based solely on Duo rarity.

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

Proper's offer threshold is one of each base element; activation requires two
of each. The [rarity audit](BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md#proper-upbringing)
owns active contributions, equipped Common promotion, source assignment,
reactivation and the Ordinary-expiry recheck. Declaration or equipped-instance
rarity blocks apply without removing a trait from rarity counts.

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
   and that is not blocked from in-run rarification. It uses the same plain
   `IsGodTrait` classification.
3. `HasSuperchargeableBoon`, used by `BoonDecayBoon`, applies the same
   next-rarity and in-run rarity-block tests and additionally rejects
   `BlockStacking` traits. It also uses plain `IsGodTrait` and has a special
   minimum-cooldown branch for Hephaestus Weapon, Special, and Sprint boons.

These are distinct derived queries. Rarity blocking combines declaration facts
with the equipped-instance block set by Personal Loan's non-final boss payout.
An all-Heroic inventory fails preferred next-rarity queries; Bridal's broader
acquisition fallback is not its offer-eligibility predicate.

This is deliberately separate from whether a provider rolls variable rarity.
In the supported normal-run model, the nine core gods are the only
providers whose eligible traits can receive Pom levels. Variable offer rarity
belongs to those nine plus Hermes, Artemis, Athena, and Dionysus. Hammers use
their independent Rank I/Rank II domain, with Icarus's Latest Model as the
modeled in-run Rank II transition. Other normal-run providers are
player-rarityless and do not receive Pom levels. Some retain internal scaling
tables or values in source. Hades participates in the source's broader
`IsGodTrait(..., { ForShop = true })` query. NPC Hades offer instances carry
`Common`, while direct and Jeweled Pom Hades instances omit `Rarity`; every
Hades trait declares `BlockInRunRarify`. Icarus uses internal Common in normal runs and
Dream-indexed scaling outside the supported route baseline. Neither source
mechanism becomes planner rarity.

### Trait levels and Pom acquisition

The game represents a freshly acquired scalable trait at `StackNum = 1` when
the field is materialized; an absent `StackNum` is also treated as level 1.
`IncreaseTraitLevel` replaces the equipped instance with the same trait and
rarity at the old level plus the granted stack count. Level is therefore an
equipped-trait fact folded chronologically, not an independent reward counter.

Normal replacement separately carries the displaced trait's `StackNum` into
the replacement before adding `ExchangeLevelBonus`. That transfer is not
guarded by the replacement trait's `BlockStacking` value. A non-stackable
priority trait such as `HephaestusManaBoon` can therefore inherit a displayed
level from a level-bearing occupied Mana slot while remaining ineligible for
later Poms. Fresh non-Pom acquisitions still need no level fact.

`GetAllUpgradeableGodTraits(stackNum)` supplies the shared target domain for
visible Poms and random Pom consumables. A target must be:

- a persistent trait from the plain core-god `IsGodTrait` domain;
- not `BlockStacking`; and
- observably changed after applying the requested stack count.

The current normalized trait inventory does not carry every numeric tooltip
curve. For the supported possibility model, the last check collapses to the
source-closed core-god plus non-`BlockStacking` declaration predicate already
used by `upgradableTraitCount`. Hermes, Artemis, Athena, Dionysus, Hades,
Story traits, and Hammers remain outside the Pom target domain. Concrete
rarity does not remove an otherwise valid Pom target, including Heroic.

The acquisition surfaces remain distinct:

| Source acquisition         | Game surface                                                       | Level mutation                                                               |
| -------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `StackUpgrade`             | up to three distinct eligible equipped traits; player selects one  | selected target `+1`                                                         |
| `StackUpgradeBig`          | the same bounded choice surface                                    | selected target `+2`                                                         |
| `StackUpgradeTriple`       | the same bounded choice surface                                    | selected target `+3`                                                         |
| `StoreRewardRandomStack`   | no choice menu; one eligible target is chosen randomly             | exact random target `+1`                                                     |
| source-eligible `GiftDrop` | no choice menu; the Nectar pickup remains the concrete acquisition | exact random target `+1` when available; valid no-op for an empty target set |

When fewer than three eligible traits exist, a visible Pom presents every
eligible trait. With three or more, it presents exactly three. No Pom target
exists when the eligible set is empty. The Fated/Arcana level bonuses,
probability, rerolls, and numeric tooltip values remain outside the progressed
neutral route baseline.

`GiftDrop` receives the row above only when its producer constructs it with
`RunProgressUpgradeEligible = true` and the progressed baseline's
`WorldUpgradeGiftDropRunProgress` is active. Ordinary room rewards and Echo's
consumable replay opt in; Shop inventory does not. The exact reward history
still records `GiftDrop`, never a synthetic `StoreRewardRandomStack`.
Nectar has no `StackUpgradeLegal` requirement, so its empty Pom-target domain is
a valid no-op rather than an ineligible pickup or missing-target finding.

`NarcissusA` includes one real `StoreRewardRandomStack` and is guarded by
`StackUpgradeLegal`; its implementation therefore uses the same random target
and `+1` mutation while preserving the wrapper acquisition identity.

Bridal Glow retains its source before resolving a target. Its preferred
acquisition pool is the superchargeable core-god domain. Only when that pool is
empty does it widen to rarity-eligible shop-aware traits, including already
Heroic and non-Pom traits and Bridal itself. Its remembered recipient and later
rarity credit are recorded in the
[effect audit](RUN_IMPACTING_TRAIT_EFFECTS_GAME_DATA_AUDIT.md#bridal-glow).
Native non-Pom levels are possible; the planner's omission of those levels is
explicit there, not evidence that they cannot occur.

For Hephaestus Weapon, Special, and Sprint, `HasSuperchargeableBoon` additionally
requires the target's current `UnmodifiedCooldown` to be strictly greater than
`2`. The source cooldown curves reduce to these exact pre-acquisition level
limits:

| Target                                       |   Common |    Rare |    Epic |  Heroic |
| -------------------------------------------- | -------: | ------: | ------: | ------: |
| Hephaestus Attack — `HephaestusWeaponBoon`   |  level 9 | level 7 | level 5 | level 3 |
| Hephaestus Special — `HephaestusSpecialBoon` | level 11 | level 9 | level 7 | level 5 |
| Hephaestus Sprint — `HephaestusSprintBoon`   |  level 8 | level 7 | level 6 | level 5 |

Each cell is the highest still-effective level at that rarity. Pom and Natural
Selection use these caps for level-up eligibility, including the Heroic cells.
Steady Growth and Bridal's preferred pool also require an available next
rarity. Bridal's acquisition fallback relaxes that requirement but retains the
cooldown cap. These limits are a narrow offer-legality mapping; they do not
require the planner to simulate combat cooldown values.

### Other direct condition dispositions

| Source condition                                   | Normalized disposition                                                                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| already equipped                                   | modeled from exact equipped keys                                                                                                          |
| `BlockOfferIfPreviouslyPicked`                     | declaration-owned for Bridal Glow, Buried Treasure, and Cherished Heirloom; prior selected-offer history survives later removal           |
| `PlantHealthBoon` shovel, bounty, and dream checks | collapsed by the progressed, non-bounty, non-dream baseline; `BlockGiftBoons` remains modeled                                             |
| `WeaponUpgradeBoon` progression gate               | collapsed by the progressed baseline                                                                                                      |
| `UnityTrait` progression and narrative gates       | collapsed by the progressed baseline; element thresholds remain modeled                                                                   |
| mechanical activation/effect requirements          | retained by the owning selected-effect or lifecycle contract when they change modeled state; combat-only values remain outside simulation |
| Hephaestus cooldown/level exception in Boon Decay  | exact rarity/level limits above; no general combat-cooldown simulation is implied                                                         |

## Requirement Origins and Echo Replay

The normalized declaration separates `eligibilityRequirements` from
`linkedBoonRequirements`. Ordinary generation evaluates both. BBB calls the
current-state eligibility path without the linked boon graph
(`EventLogic.lua:1604–1618`, `RunLogic.lua:57–134`), while retaining
ownership, bans, slot occupancy, giver membership and replay exclusions.
Trait-key operands alone do not identify a linked requirement.

| Declaration category   | All traits | In BBB union | BBB treatment                                       |
| ---------------------- | ---------: | -----------: | --------------------------------------------------- |
| Linked only            |         41 |           41 | Bypass linked groups                                |
| Linked and eligibility |         34 |           34 | Retain eligibility                                  |
| Eligibility only       |         28 |           19 | Retain eligibility                                  |
| Empty collections      |        316 |          107 | Separate ownership/effect exclusions still apply    |
| Total                  |        419 |          201 | 103 declarations with expressions; 75 linked owners |

The 75 linked groups were compared with `TraitData.lua:121–658`; their exact
AND/OR grouping is retained in the graph below. Of the 34 mixed owners, 32
retain inherited Devotion eligibility. `CastAnywhereBoon` and `SelfCastBoon`
instead retain cast-family exclusions. The five Duo requirement-table overrides
are source facts, not BBB bypass flags.

The 19 eligibility-only owners inside BBB are:

| Owners                                                          | Retained current-state condition                                                              |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Ten Infusions                                                   | Exact element offer thresholds, including Proper's offer rather than activation threshold     |
| `SorceryCritBoon`                                               | Native seven-Hex identity list, `TraitData_Artemis.lua:502`                                   |
| `OlympianSpellCountBoon`                                        | Native nine invested talents, `TraitData_Athena.lua:505`; accepted concrete Spell Drop prefix |
| `CommonGlobalDamageBoon`                                        | Zero Common god-boon count                                                                    |
| `BoonGrowthBoon`                                                | Existing rarifiable-trait predicate                                                           |
| `PlantHealthBoon`, `RoomRewardBonusBoon`, `MoneyMultiplierBoon` | Gift-block context                                                                            |
| `CastProjectileBoon`, `CastLobBoon`                             | Cast-family exclusions                                                                        |

The nine eligibility-only owners outside BBB are Icarus Attack/Special,
Circe's Hex/Grasp/removable-Fear choices, `NarcissusA`, Hades Cast and the
mutually exclusive Skull Hammer pair. Icarus's trait lists approximate occupied
slots; Circe/Artemis Hex lists are native identity conditions. Neither becomes
linked merely by mentioning equipped keys. Volatile conditions retain the
[existing disposition](../rewards-and-acquisition/VOLATILE_OFFER_ELIGIBILITY_GAME_DATA_AUDIT.md).

Optional linked-priority metadata controls generation, not replay eligibility.
BBB still bypasses ordinary screen composition, replacement and menu
Rarification; direct acquisition retains the chosen trait's effect.

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

## Catalog Disposition

The provider inventory contains 23 givers, 427 memberships and 419 distinct
trait declarations: 335 memberships across 22 non-Hammer givers and 92 Hammer
memberships, with defaults for 24 weapon/aspect pairs. Spell Drop's eight-trait
pool and Chaos's 33-identity paired pool retain their specialist audits.

Normalization preserves membership, priority sets, requirement origin/grouping,
fresh/equipped rarity domains, slots, elements, loadout restrictions, exact
exclusions and selected-effect descriptors. It does not persist a live eligible
pool, generation bucket, banned set, target count or equipped rarity block.

Core-god, shop-aware rarity and Pom eligibility are separate classifications.
The equipped ledger derives slot/element/rarity facts; ordinary generation and
BBB replay consume their own declared requirement collections. Negative
cast/Hammer exclusions and source context remain independent of the positive
graph. Its Artemis/Athena spell-state rows are explicit current-state
conditions, not linked prerequisites to bypass.

Initial-screen construction and Fear pressure belong to the
[composition audit](TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md), source
arithmetic to the [rarity audit](BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md), and
acquired effects to their owning audits. All Together's children are direct
Common grants, Travel Deal is an ordinary ranked Hermes trait with a separate
refill effect, and Infernal Contract is a fixed rarityless acquisition rather
than an invented giver.
