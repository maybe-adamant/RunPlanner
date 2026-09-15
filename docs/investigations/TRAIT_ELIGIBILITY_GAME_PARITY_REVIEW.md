# Trait eligibility: planner/game parity review

## Question and status

Does the current planner admit exactly the supported trait screens the game
can generate, using the same pre-acquisition state and respecting the project's
explicit modeling exclusions?

Reviewed against planner commit `238cb1a0` and the local game-script snapshot at
`/home/ayyatma/wsl-projects/modding/1GameData/Scripts`. Source references below
refer to that snapshot, not an assumed latest game release. This is a temporary
investigation, not an implementation contract. No production behavior changed.

The [BBB requirement-origin matrix](#bbb-requirement-origin-matrix) was refreshed
against `de59551e` on 2026-09-15, after the ordinary composition correction.
It closes the declaration-classification question for the proposed BBB gate;
the original composition findings below retain their original review baseline.

The supported screen is the initial, pre-reroll offer. Reroll inventory and use
are not modeled, and outcomes reachable only through rerolls do not widen the
planner's initial-screen eligibility domain.

The immediate witness is the Apollo Trial offer in the user's `underworld.json`:
Perfect Image, Exceptional Talent, and Nova Strike are individually legal, but
the complete screen is rejected.

## Assessment

The existing ownership and chronological architecture are worth keeping. The
catalog owns declarations; simulation owns the exact pre-offer history and
context; candidate evaluation and validation consume the same assessments;
selected acquisition effects remain separate from the offered alternatives.

The weakness is narrower: the game constructs a screen in stages, while the
planner approximates those stages with pool partitions, cardinality rules,
and row-local rarity checks. That approximation both rejects possible screens
and accepts impossible ones. A separate replay boundary conflates native
current-state eligibility with ordinary linked-trait prerequisites.

Four discrepancies are confirmed below against the initial-screen boundary.
The source's Denial-dependent final exhaustion pass is an additional, already
documented deliberate divergence; changing it requires an explicit policy decision.

## Coverage and evidence limits

- The normalized catalog contains 419 trait declarations across 23 givers.
  This count includes effect-backed NPC choices, Chaos entries and spells;
  it is not a count of ordinary boons.
- A disposable probe compared all nine Olympian pools and Hermes against
  `LootData_<God>.lua`: all ten memberships matched.
- The probe evaluated the game's actual `LinkedTraitData` and
  `TraitRequirements` Lua declarations, including its `CombineTables` helper,
  and compared the positive requirement groups against the catalog. All 75
  non-Chaos, non-Selene-special entries matched. The additional
  `SpellMoonBeamTrait -> SuitHexAspect` entry is represented through the
  catalog's explicit aspect-starting-trait path, not the ordinary Spell Drop
  pool. The two Chaos entries were checked through their dedicated predicates.
- Targeted source reads covered generation stages, rarity, Trial restrictions,
  ownership/bans, negative requirements, infusion thresholds, NPC/direct
  acquisition boundaries, Chaos pairs, and nested trait carriers.
- Existing focused coverage passed: 149 tests across trait offers, rarity,
  Denial, Chaos, Echo, catalog offer declarations and rarity/elements.
  Additional disposable probes demonstrated the discrepancies below and were
  removed after recording their results.

This is a rule-family review, not an exhaustive enumeration of all combinations
of 419 traits. It did not replay every live game screen, reaudit every Hammer
data row, test executor hooks, or redo the complete scheduler/lifecycle audit.
The counterexamples distinguish the supplied project witness from isolated
pre-offer-state probes. Passing existing tests establishes current behavior,
not native parity where those tests encode an approximation.

## Model comparison

Engine paths in this table are relative to `packages/planner-engine/src/`.

| Boundary                                          | Game authority                                                              | Planner authority                                                                | Assessment                                                                                                                                                                                                                         |
| ------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider membership                               | `LootData_<God>.lua`, NPC choice arrays                                     | Catalog `declarations/traits/`; normalized giver membership                      | Ten ordinary/Hermes pools mechanically match. NPC pools retain their separate acquisition semantics.                                                                                                                               |
| Positive linked prerequisites                     | `TraitData.lua:121`, `RunLogic.lua:57` (`HasTraitRequirements`)             | Catalog requirement groups; `simulation/traits/level-effects.ts:169`             | The 75 compared entries match. No Apollo/Exceptional Talent transcription error.                                                                                                                                                   |
| Current-run requirements                          | `RunLogic.lua:98` (`IsTraitEligible`), each trait's `GameStateRequirements` | `simulation/traits/authoring/assessment.ts:224`, `level-effects.ts:169`          | Ordinary checks cover modeled facts. Echo drops this layer; finding 4.                                                                                                                                                             |
| Already owned, prior-picked, banned               | `GetEligibleUpgrades`, `IsTraitEligible`                                    | `assessTraitOptionAgainstRarityDomain`; history fold                             | Explicitly modeled. Ownership, permanent bans and prior-picked exclusions are distinct.                                                                                                                                            |
| Weapon/aspect compatibility and mutual exclusions | Hammer declarations, `IsTraitEligible`, occupied slots                      | Catalog `hammerCompatibility`, negative requirements, exact context              | Existing typed domains and 92-by-24 Hammer coverage are appropriate. No new discrepancy identified in this bounded review.                                                                                                         |
| Initial and later core-slot priority              | `UpgradeChoiceLogic.lua:739`, `TraitLogic.lua:1791`                         | `assessTraitOfferComposition`, `traitCandidates`, draft construction             | First-offer-only approximation omits the later seed requirement; finding 2.                                                                                                                                                        |
| Replacements and final screen composition         | `GetReplacementTraits`; staged fill in `SetTraitsOnLoot`                    | `assessTraitOfferDomainComposition`, `assessTraitReplacementComposition`         | Pool-count rules lose the distinction between initial replacement seeding and vacancy rescue; finding 1.                                                                                                                           |
| Rarity arithmetic and provider overrides          | `RoomLogic.lua:2093`, `GetRarityChances`, `SetTraitsOnLoot`                 | `simulation/traits/rarity.ts`, `offers.ts`, provider declarations                | Ordered checks, non-normalized values, room/item precedence and ordinary provider distinctions are represented. Applying fresh-roll availability to an explicit replacement is wrong; finding 3.                                   |
| Trial high tiers                                  | `EncounterLogic.lua:1686/1692`, `RewardLogic.lua:396`                       | Exact `devotionNoDuo` context                                                    | Trial blocks the ordinary Duo roll, not Legendary. The later bucket investigation S10 distinguishes inherited individual bans from five declaration overrides and final rescue. This is not the original Apollo rejection's cause. |
| Denial and exhaustion                             | `HandleUpgradeChoiceSelection`, `TraitLogic.lua:1963`                       | Trait history bans; shared composition policy                                    | Ordinary bans and Chaos curse bans are represented. The final no-Denial rarity-rescue branch is deliberately not mirrored; decision below.                                                                                         |
| Rejected and Ordinary Chaos effects               | `CalcNumLootChoices`, upgrade-menu selection, `IsRarityForcedCommon`        | `simulation/traits/offers.ts` and authored rejected option                       | Rejected retains visible alternatives with one unselectable identity; Ordinary controls source rarity/replacement opportunity. Do not reinterpret Rejected as simply deleting a displayed row.                                     |
| Chaos pairing                                     | `TraitLogic.lua:1700-1744`, `TraitData_Chaos.lua`                           | Chaos catalog and `evaluateReachedTraitOfferWithAssessments`                     | Separate paired domain is appropriate: unique blessings, possibly repeated curses, selected magnitude/rarity and all displayed curse eligibility. Unselected blessing magnitudes are intentionally not authored.                   |
| Story/effect-backed choices                       | `EventLogic.lua:906-1249`, source option requirements                       | NPC declarations and trait-settlement selected dispositions                      | Must not inherit ordinary Olympian composition. Volatile predicates retain their documented boundary.                                                                                                                              |
| Echo Boon Boon Boon                               | `EventLogic.lua:1580-1625`                                                  | `simulation/traits/offer-domain.ts:96`                                           | Correctly bypasses the linked-prerequisite graph and uses an authored prior-run-cache approximation. Incorrectly also bypasses modeled native current-state predicates; finding 4.                                                 |
| Concave Stone and nested payloads                 | Frozen upgrade-button data and selection callbacks                          | `rewards/trait-settlement/concave-stone-secondary.ts`, selected-child settlement | Frozen offer rows and selected-child consequences are distinct. No basis to recheck every residual against a newly generated ordinary offer. Preserve the current carrier/payload architecture.                                    |
| Candidate context and chronology                  | Generation/interaction contact determines native state                      | Trait settlement captures `before`/context; candidate capability consumes them   | No supplied witness requires reconstructing context in React or changing lifecycle timing. Correct the shared assessments, not individual picker exceptions.                                                                       |

## Confirmed discrepancies

### 1. Exhaustion can require an ordinary boon the native screen may omit

**Impact: rejects a valid complete offer.**

The supplied project's G Trial is in `G_Combat13`, occurrence
`05d7ce68-dcfd-4dcd-8750-6a4efbdd6c36`. At its Apollo offer:

- the remaining ordinary identities are Perfect Image and Extra Dose;
- Exceptional Talent's three prerequisite groups are satisfied;
- Nova Strike can replace the existing Epic Zeus Attack at Heroic;
- the normal replacement chance is nonzero; and
- Denial is active, while Trial blocks Duo only.

Perfect Image / Exceptional Talent / Nova Strike each passes the engine's
individual assessment. The whole offer fails solely with
`missingMandatoryOrdinary: DoubleStrikeChanceBoon` (Extra Dose).

The native construction can seed Nova Strike through the successful replacement
roll, fill one remaining slot with Perfect Image, then roll Exceptional Talent
for the last slot. That final rarity selection supersedes the tentative Common
candidate; Extra Dose need not appear. This is a possible native branch, not a
claim about its probability or a recorded live-game roll.

The planner instead requires every ordinary identity whenever the ordinary
pool contains fewer than three members:

- engine: `simulation/traits/offer-domain.ts:231`, especially the
  `missingOrdinary` condition;
- native: `TraitLogic.lua:1791-1806`, `1920-1947`, and the separate
  vacancy-only replacement pass at `1949-1961`.

**Disposition:** correct shared offer composition, not Apollo or Trial data.
Simply deleting the mandatory-ordinary rule is not enough: preserve real
vacancy-filling obligations while recognizing screens filled by the earlier
replacement/high-tier stages.

### 2. Later initial offers can omit a required priority seed

**Impact: accepts an initial screen the native generation path cannot produce.**

A focused pre-offer witness owns Common Zeus Attack, with the other ordinary
slots vacant. Offer Apollo's Perfect Image / Extra Dose / Super Nova, all
Common, with no replacement.

The engine accepts all three rows and the complete composition. Its output is:
eight ordinary candidates, one replacement candidate, zero required
replacements, and no applicable first-offer priority constraint.

Native `GetPriorityTraits` still operates here. If the replacement roll succeeds,
Nova Strike occupies an offer position. If it does not, an eligible vacant
Apollo core-slot trait occupies a position. Neither fresh-generation path yields
three non-core options. Optional linked-trait priority does not remove that
initial seed.

Rerolls have a different source path: `RerollBoonLoot`
(`UpgradeChoiceLogic.lua:706-718`) supplies `ExclusionNames`, which can remove
the sole priority seed before ordinary filling (`TraitLogic.lua:1848-1857`).
That can produce three non-core boons, but reroll-only outcomes are outside
the supported initial-screen domain and do not make this witness valid.

- native: `UpgradeChoiceLogic.lua:739-793`, `TraitLogic.lua:1791-1830`;
- engine: `simulation/traits/offer-domain.ts:317` and
  `simulation/traits/authoring/assessment.ts:589` restrict priority composition
  only while all ordinary slots are empty.

**Disposition:** include later priority seeding in the shared composition
correction. Preserve the no-eligible-priority and replacement cases; do not
substitute an unconditional core requirement for source-stage support. No
reroll machinery or new authored input is needed.

The older pool audit scoped its guarantee to the first offer. That misses the
weaker priority guarantee on later initial screens.

### 3. A replacement's promoted rarity is checked as a fresh roll

**Impact: rejects an available replacement under sufficiently strong rarity
bonuses.**

Keep a Common Zeus Attack and consider Rare Nova Strike as its replacement.
Use the declared Q miniboss rarity override (`Epic = 0.7`), Rare-rank Divinity
(`+0.1 Epic`), and one Yarn (`+0.25 Epic`). These supported contributions make
the ordinary fresh Epic check `1.05`.

The isolated pre-offer assessment rejects Rare Nova Strike with both
`occupiedBoonSlot` and `rarityRollUnavailable: Rare`.

Native `GetReplacementTraits` explicitly assigns `GetUpgradedRarity` of the
old slotted trait. `SetTraitsOnLoot` preserves an already assigned rarity when
processing priority entries. The Rare replacement does not roll against the
fresh Epic table.

- native: `UpgradeChoiceLogic.lua:795-822`, `TraitLogic.lua:1898-1912`;
- engine: `simulation/traits/authoring/assessment.ts:280` checks fresh-roll
  availability before establishing the replacement, then treats that finding
  as a non-slot reason to deny the replacement transition;
- source facts: catalog `declarations/rooms/q.ts`,
  `declarations/arcana-fear.ts:152`, and the Yarn contribution in
  `simulation/traits/offers.ts`.

**Disposition:** keep explicit promoted replacement rarity separate from
fresh-roll rarity. The row assessor, composition domain and candidate picker
should agree through the same authority. Do not exempt an entire offer from
rarity checks, or change the correct rarity arithmetic.

### 4. Echo bypasses current-state predicates along with linked prerequisites

**Impact: admits replay boons the game excludes using state the planner already
models.**

With only Common Zeus Attack and no Fire, the ordinary assessment rejects
Apollo's Self Healing because it requires two Fire. Echo's
`echoLastRunBoonOutcomes` marks its Common, Rare and Epic variants legal.
The same probe exposes Whispered Prayer without any Hex and Proper Upbringing
without the required elements. It also accepts Uncommon Grace despite the
existing Common Zeus Attack; the native offer predicate requires zero Common
god boons (`TraitData_Hera.lua:1806`).

The source is unambiguous:

- `EventLogic.lua:1608-1618` calls `IsTraitEligible` for every prior-run candidate;
- `RunLogic.lua:98-134` includes each trait's `GameStateRequirements`;
- `TraitData_Elementals.lua:349-361` requires two Fire for Self Healing;
- `TraitData_Artemis.lua` requires a supported equipped Hex for Whispered Prayer;
- `TraitData_Elementals.lua:64` declares Proper Upbringing's elemental offer
  requirements.

Echo does **not** call `HasTraitRequirements`, so an ordinary positive-linked
prerequisite such as Weak Potency's prerequisite is correctly bypassed. But
`assessEchoLastRunBoonOption` currently checks only ownership, bans, prior-picked
exclusion, slot occupancy and targeted-acquisition availability. It never
checks the remaining modeled current-run predicates.

The catalog currently collects both native layers into `offerRequirements`.
Filtering by expression kind would not fully repair this: for example,
Whispered Prayer's `anyEquippedTrait` comes from native `GameStateRequirements`,
while many other `anyEquippedTrait` expressions come from `TraitRequirements`.

**Disposition:** make that distinction explicit at the owning declaration and
assessment boundary, then reuse current-run predicate evaluation for Echo.
Do not rerun all ordinary prerequisites for BBB, add per-trait Echo exceptions,
or introduce live Death Defiance/Hex-node simulation. The existing Echo audit
already requires queryable current-state predicates; this implementation does
not fulfill that part of the documented contract.

### BBB requirement-origin matrix

This inventory classifies the current `TraitDeclaration.offerRequirements`,
not every condition in the game. Requirements already represented by separate
ownership, source-domain, loadout or selected-effect contracts stay there.
`eligibility` below includes native trait and NPC-choice state conditions;
`linked` means the separate native `TraitRequirements` generation table.
Both may read equipped trait identities. Predicate shape does not determine
classification.

#### Inventory and verification

The current normalized catalog has 419 traits. BBB's declared source union has
201 distinct trait identities; multiple giver variants of a Duo are counted
once here.

| Current declaration class      | All traits | In BBB's source union | Disposition                                                                     |
| ------------------------------ | ---------: | --------------------: | ------------------------------------------------------------------------------- |
| Linked groups only             |         41 |                    41 | Move the existing groups intact to linked prerequisites; BBB bypasses them      |
| Linked groups plus eligibility |         34 |                    34 | Separate the groups; BBB retains eligibility                                    |
| Eligibility only               |         28 |                    19 | Retain the expressions as eligibility; nine excluded traits keep their behavior |
| Empty `offerRequirements`      |        316 |                   107 | No expression to classify; separate exclusions/effects still apply              |
| Total                          |        419 |                   201 | All 103 non-empty declarations are accounted for                                |

A disposable probe loaded the actual catalog through Vite and evaluated the
native `LinkedTraitData`/`TraitRequirements` declaration prefix. It compared
the exact positive groups, normalizing group/member order only: **all 75
supported linked entries matched, with no missing owner or differing group**.
The native `CombineTables` use is array concatenation. The two Chaos entries
and the special `SpellMoonBeamTrait` aspect prerequisite were excluded from
this comparison because their existing dedicated owners are not this trait
offer contract. No native eligibility evaluator or new production parser was
created by the probe.

This is stronger than assuming every `anyEquippedTrait` is linked: the native
owner and its entire positive group must match. In this inventory, every
matched group is an existing top-level expression; none needs a mixed Boolean
expression split. Keep each group's existing AND/OR structure intact.

#### Native contacts and retained policy

| Contact                    | Native source                                                                      | Planner disposition                                                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary linked generation | `RunLogic.lua:57`, `UpgradeChoiceLogic.lua:867–888`, `TraitData.lua:121–658`       | Ordinary eligibility/generation continues to evaluate linked and eligibility collections                                                                                                    |
| Trait eligibility          | `RunLogic.lua:98–134`                                                              | Reuse the existing modeled predicate evaluator; do not infer scope from expression kind                                                                                                     |
| BBB filtering              | `EventLogic.lua:1604–1618`                                                         | Checks `IsTraitEligible`, ownership, giver membership, slot occupancy and replay exclusions; does not call `HasTraitRequirements`                                                           |
| Profile progression        | `RunLogic.lua:110–115`, provider/trait unlock and text-line predicates             | Preserve the fully progressed baseline; do not add prior-save inputs                                                                                                                        |
| Volatile conditions        | Task Force's exact invested talents, missing Death Defiance and related predicates | Preserve the [volatile eligibility disposition](../audits/rewards-and-acquisition/VOLATILE_OFFER_ELIGIBILITY_GAME_DATA_AUDIT.md), including Task Force's existing modeled Spell Drop prefix |

#### All linked owners, including mixed declarations

Every row's linked group is the existing catalog group, verified against the
listed line of **`TraitData.lua`**. BBB bypasses that group; the final column
must remain eligibility. A dash means no additional expression in the current
`offerRequirements`, not unconditional trait availability.

`D` means `offerContext(devotionNoDuo = false)`, sourced from
`SynergyTrait.GameStateRequirements` at `TraitData.lua:866–875`. The 32 `D` rows
retain that condition. The five source overrides (`ApolloSecondStageCastBoon`,
`GoodStuffBoon`, `SuperSacrificeBoonHera`, `SuperSacrificeBoonZeus`,
`SelfCastBoon`) do not inherit it; the already-resolved
[S10 source evidence](INITIAL_OFFER_BUCKET_RULES.md#s10--trial-eligibility-and-zero-chance-rescue-are-separate)
owns that distinction. It is not a new BBB exception.

`C` means exclude the other four members of the exact cast family:
`CastProjectileBoon`, `CastAnywhereBoon`, `HadesCastProjectileBoon`,
`CastLobBoon`, `SelfCastBoon`. The two mixed rows source this from
`TraitData_Zeus.lua:1685` and `TraitData_Duo.lua:1298`, respectively.

| Trait key                      | Linked source line | Eligibility retained |
| ------------------------------ | -----------------: | -------------------- |
| `DoorHealToFullBoon`           |                126 | —                    |
| `WeakPotencyBoon`              |                124 | —                    |
| `WeakVulnerabilityBoon`        |                125 | —                    |
| `RandomStatusBoon`             |                129 | —                    |
| `SprintEchoBoon`               |                403 | D                    |
| `CharmCrowdBoon`               |                412 | D                    |
| `AllCloseBoon`                 |                574 | D                    |
| `MaxHealthDamageBoon`          |                421 | D                    |
| `ManaBurstCountBoon`           |                430 | D                    |
| `BurnRefreshBoon`              |                484 | D                    |
| `SlamManaBurstBoon`            |                529 | D                    |
| `BloodManaBurstBoon`           |                647 | D                    |
| `BlindChanceBoon`              |                143 | —                    |
| `ApolloBlindBoon`              |                142 | —                    |
| `ApolloExCastBoon`             |                144 | —                    |
| `DoubleStrikeChanceBoon`       |                141 | —                    |
| `DoubleExManaBoon`             |                145 | —                    |
| `ApolloSecondStageCastBoon`    |                375 | —                    |
| `RaiseDeadBoon`                |                328 | D                    |
| `PoseidonSplashSprintBoon`     |                384 | D                    |
| `StormSpawnBoon`               |                394 | D                    |
| `CoverRegenerationBoon`        |                475 | D                    |
| `BlindClearBoon`               |                520 | D                    |
| `DoubleSwordBoon`              |                620 | D                    |
| `AresExCastBoon`               |                255 | —                    |
| `RendBloodDropBoon`            |                253 | —                    |
| `AresStatusDoubleDamageBoon`   |                254 | —                    |
| `DoubleBloodDropBoon`          |                256 | —                    |
| `SelfCastBoon`                 |                583 | C                    |
| `AutoRevengeBoon`              |                592 | D                    |
| `BloodRetentionBoon`           |                602 | D                    |
| `RapidSwordBoon`               |                611 | D                    |
| `DoubleSplashBoon`             |                629 | D                    |
| `FireballRendBoon`             |                638 | D                    |
| `SlowExAttackBoon`             |                161 | —                    |
| `CastAttachBoon`               |                164 | —                    |
| `RootDurationBoon`             |                163 | —                    |
| `InstantRootKill`              |                165 | —                    |
| `RootStrikeBoon`               |                347 | D                    |
| `KeepsakeLevelBoon`            |                356 | D                    |
| `GoodStuffBoon`                |                365 | —                    |
| `BurnConsumeBoon`              |                466 | D                    |
| `ClearRootBoon`                |                511 | D                    |
| `MassiveDamageBoon`            |                177 | —                    |
| `MassiveKnockupBoon`           |                178 | —                    |
| `WeaponUpgradeBoon`            |                179 | —                    |
| `ManaShieldBoon`               |                320 | D                    |
| `ReboundingSparkBoon`          |                493 | D                    |
| `MassiveCastBoon`              |                502 | D                    |
| `DoubleMassiveAttackBoon`      |                538 | D                    |
| `LinkedDeathDamageBoon`        |                192 | —                    |
| `DamageSharePotencyBoon`       |                190 | —                    |
| `SpawnCastDamageBoon`          |                191 | —                    |
| `AllElementalBoon`             |                194 | —                    |
| `SuperSacrificeBoonHera`       |                556 | —                    |
| `MoneyDamageBoon`              |                337 | D                    |
| `ManaRestoreDamageBoon`        |                448 | D                    |
| `OmegaZeroBurnBoon`            |                207 | —                    |
| `BurnArmorBoon`                |                205 | —                    |
| `BurnStackBoon`                |                206 | —                    |
| `BurnSprintBoon`               |                210 | —                    |
| `EchoBurnBoon`                 |                439 | D                    |
| `SteamBoon`                    |                457 | D                    |
| `PoseidonStatusBoon`           |                223 | —                    |
| `PoseidonExCastBoon`           |                224 | —                    |
| `AmplifyConeBoon`              |                225 | —                    |
| `LightningVulnerabilityBoon`   |                565 | D                    |
| `CastAnywhereBoon`             |                240 | C                    |
| `DoubleBoltBoon`               |                237 | —                    |
| `EchoExpirationBoon`           |                238 | —                    |
| `LightningDebuffGeneratorBoon` |                239 | —                    |
| `SpawnKillBoon`                |                241 | —                    |
| `SuperSacrificeBoonZeus`       |                547 | —                    |
| `LuckyBoon`                    |                267 | —                    |
| `TimeStopLastStandBoon`        |                300 | —                    |

The three `optionalLinkedPriority` flags remain ordinary generation metadata,
not BBB requirements. No numeric roll or initial-offer bucket is introduced
into replay by separating their prerequisites.

#### All eligibility-only owners in BBB's domain

These 19 traits have no group in the native linked table. All listed expressions
must be evaluated for BBB against its exact pre-choice state. Source locations
identify the native predicate; accepted simplifications are explicit.

| Trait key                     | Existing expression retained                     | Native source / disposition                                                                                                                        |
| ----------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ElementalDodgeBoon`          | Air ≥ 2                                          | `TraitData_Elementals.lua:453`                                                                                                                     |
| `ElementalRallyBoon`          | Fire ≥ 2                                         | `TraitData_Elementals.lua:354`                                                                                                                     |
| `ElementalOlympianDamageBoon` | Earth ≥ 4                                        | `TraitData_Elementals.lua:232`                                                                                                                     |
| `ElementalDamageCapBoon`      | Water ≥ 4                                        | `TraitData_Elementals.lua:517`                                                                                                                     |
| `ElementalDamageBoon`         | Earth ≥ 2                                        | `TraitData_Elementals.lua:156`                                                                                                                     |
| `ElementalBaseDamageBoon`     | Fire ≥ 2                                         | `TraitData_Elementals.lua:286`                                                                                                                     |
| `ElementalHealthBoon`         | Water ≥ 2                                        | `TraitData_Elementals.lua:568`                                                                                                                     |
| `ElementalDamageFloorBoon`    | Air ≥ 3                                          | `TraitData_Elementals.lua:410`                                                                                                                     |
| `ElementalUnifiedBoon`        | Highest base element count ≥ 4                   | `TraitData_Elementals.lua:18`                                                                                                                      |
| `ElementalRarityUpgradeBoon`  | All four base elements ≥ 1                       | `TraitData_Elementals.lua:71`; offer threshold, not the later activation threshold                                                                 |
| `SorceryCritBoon`             | `anyEquippedTrait` over the seven declared Hexes | `TraitData_Artemis.lua:502`; the game itself enumerates these identities, not a generic “has Hex” predicate                                        |
| `OlympianSpellCountBoon`      | `settledSpellDrop`                               | `TraitData_Athena.lua:505` checks nine invested Olympian talents; retain only the already-approved necessary prefix, not precise talent investment |
| `CommonGlobalDamageBoon`      | Common god-boon count = 0                        | `TraitData_Hera.lua:1807`                                                                                                                          |
| `BoonGrowthBoon`              | `rarifiableTrait`                                | `TraitData_Demeter.lua:1899`, `RequirementsLogic.lua:1202`; retain existing modeled upgradeability predicate                                       |
| `PlantHealthBoon`             | `blockGiftBoons = false`                         | `TraitData_Demeter.lua:1818`; shovel unlock/non-bounty/non-Dream conditions remain supported-baseline exclusions                                   |
| `RoomRewardBonusBoon`         | `blockGiftBoons = false`                         | `TraitData_Poseidon.lua:2064`; previous-pick exclusion remains separate                                                                            |
| `MoneyMultiplierBoon`         | `blockGiftBoons = false`                         | `TraitData_Hermes.lua:183`                                                                                                                         |
| `CastProjectileBoon`          | C: exclude the other four cast-family members    | `TraitData_Hestia.lua:1765`                                                                                                                        |
| `CastLobBoon`                 | C: exclude the other four cast-family members    | `TraitData_Dionysus.lua:6`                                                                                                                         |

The seven-Hex list is `SpellLaserTrait`, `SpellLeapTrait`, `SpellSummonTrait`,
`SpellMeteorTrait`, `SpellTransformTrait`, `SpellMoonBeamTrait`,
`SpellPolymorphTrait`. It must not be inferred from an arbitrary spell-giver
pool. The unchanged positive linked lists above may use the same
`anyEquippedTrait` expression without acquiring the same replay policy.

#### Remaining eligibility-only owners: excluded from BBB

These nine declarations close the inventory of non-empty requirement arrays.
They do not motivate new BBB behavior, new predicate kinds or alternate grant
paths. If the common field is renamed, their existing behavior is preserved.

| Trait key                 | Existing expression retained            | Native source / disposition                                                                                                                                                    |
| ------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `FocusAttackDamageTrait`  | Any of nine core Attack traits          | `NPCData.lua:5351–5373` actually checks occupied `Melee` plus the Hephaestus cooldown condition; current list and slot-upgradeability check are the equivalent supported model |
| `FocusSpecialDamageTrait` | Any of nine core Special traits         | `NPCData.lua:5377–5399`; corresponding `Secondary` condition and existing upgradeability check                                                                                 |
| `CirceSorceryDamageBoon`  | The same seven-Hex membership predicate | Choice-level `NPCData.lua:5286–5305`, not linked prerequisites                                                                                                                 |
| `ArcanaRarityTrait`       | Manual Arcana Grasp cost ≥ 1            | Choice-level `NPCData.lua:5263–5273` checks the loadout cost cache > 0                                                                                                         |
| `RemoveShrineTrait`       | `circeRemovableFearVow = true`          | Choice-level `NPCData.lua:5236–5244`, `HasAnyCirceRemovableShrineUpgrade`                                                                                                      |
| `NarcissusA`              | `upgradableTrait`                       | Choice-level `NPCData.lua:4303–4313`, `StackUpgradeLegal`; shovel unlock remains baseline                                                                                      |
| `HadesCastProjectileBoon` | C: exclude other cast-family members    | `TraitData_Hades.lua:55`; Hades's entire giver is excluded from last-run replay                                                                                                |
| `LobAmmoMagnetismTrait`   | Exclude `LobPulseAmmoTrait`             | `TraitData_Lob.lua:67`; weapon/aspect compatibility remains in its existing separate contract                                                                                  |
| `LobPulseAmmoTrait`       | Exclude `LobAmmoMagnetismTrait`         | `TraitData_Lob.lua:429`; same boundary                                                                                                                                         |

Icarus's occupied-slot expression is a deliberate representation choice, unlike
Whispered Prayer's native identity list. Neither should be mislabeled as a
linked prerequisite merely because it mentions traits. No predicate redesign
for Icarus, Circe or Hammer is required to separate the collections.

#### Boundaries outside the two expression collections

| Existing boundary                                                                     | Disposition for the BBB gate                                                                                                                                  |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source union, prior-run approximation, giver variants and exact identity distinctness | Unchanged; no actual prior-run cache import or expanded provider membership                                                                                   |
| Equipped, banned, previously picked and occupied-slot exclusions                      | Retain BBB's existing checks; do not replace them with the ordinary fresh-offer assessor                                                                      |
| Selected effects and target availability                                              | Preserve the existing acquisition owners and exact child repair products; classification does not repair Bridal's acquisition fallback or later rarity credit |
| Direct-grant rarity/level, Proper's Common→Rare behavior and no stack boost           | Unchanged; eligibility context must not turn BBB into a fresh rarity roll or slot replacement                                                                 |
| Chaos and Well fields also named `offerRequirements`                                  | Different contracts; not part of this migration                                                                                                               |
| Native `GameStateRequirements` omitted under the progressed/volatile baseline         | Do not silently add them during this source separation                                                                                                        |

#### Consumer and context matrix

Paths below are relative to `packages/planner-engine/src/`. Independent
read-only tracing found exactly two runtime readers of the trait declaration's
combined list and four production consumers of BBB's outcome builder.

| Consumer                                                                                | Available exact facts                                                         | Bounded disposition                                                                                                         |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `simulation/traits/authoring/assessment.ts:assessTraitDeclarationEligibility`           | Pre-offer history and context                                                 | Continue evaluating both collections; this feeds ordinary generation pools and must not become eligibility-only by accident |
| `authored-project/traits/state.ts:traitGiverUsesOfferContext`                           | Catalog declarations                                                          | Read eligibility context expressions; currently no in-repository caller of the exported query                               |
| `simulation/traits/offer-domain.ts:echoLastRunBoonOutcomes`                             | Currently catalog/history only                                                | Accept exact context and apply eligibility with the existing `checkRequirement`; retain the separate replay exclusions      |
| `simulation/traits/authoring/assessment.ts` outer BBB availability                      | History and context already present                                           | Pass that context to the outcome builder                                                                                    |
| `simulation/candidates/trait-offer/capability.ts` BBB capability                        | `context.before` and captured `context.context`                               | Pass the existing branch-local context; no new artifact or UI field                                                         |
| `simulation/rewards/trait-settlement/encounter-child-settlement.ts:assessEchoBoonChild` | Pre-choice history only                                                       | Accept the same pre-choice context; validate every row before nested acquisition                                            |
| `simulation/rewards/trait-settlement/coordinator.ts` sole child-assessment caller       | Original reward history, pre-choice trait history and `encounterTraitContext` | Make the existing settled-Spell fact available in that context before both paths, then pass it to child assessment          |
| `simulation/rewards/biome/selected-trait-products.ts`                                   | `trace.before` and `trace.context`                                            | Pass retained context when resolving effective BBB options; no new published field                                          |
| `simulation/traits/offers.ts` nested settlement                                         | Already assessed BBB outcome                                                  | Preserve the validated-outcome handoff; do not reevaluate ordinary eligibility                                              |

`settledSpellDrop` currently enters captured contexts inside
`applyTraitOfferForAcquisitionInternal`, from
`(branch.history.useRecord.SpellDrop ?? 0) > 0`. The child validator is called
outside that augmentation. Its fix is a shared pre-choice fact, not a new
history walk, session cache or caller-specific approximation.

Live Echo currently occurs in the unblocked, non-Devotion `H_Bridge01`; false
defaults for `blockGiftBoons`/`devotionNoDuo` describe that supported contact.
Predicate tests can exercise explicit contexts through the pure outcome
boundary, but a product witness must not invent Echo in an unsupported room.
Whispered Prayer reads trait history; Task Force reads the modeled Spell Drop
prefix. Aspect of Selene's starting Hex alone must continue to distinguish them.

Do not import the ordinary assessor back into `offer-domain.ts`: it already
imports BBB outcomes, and ordinary assessment also imposes the linked, rarity
and replacement policies replay deliberately bypasses. Reuse the lower-level
predicate evaluator without creating a second one.

#### Readiness for the plan amendment

Declaration classification is complete: no unclassified expression or mixed
Boolean group remains in the current 103-owner inventory. The remaining work
is the two-collection contract, the narrow context threading above and focused
verification—not another broad trait audit.

The existing catalog requirement/normalization suites own the exact partition
and ordinary-conjunction preservation. `simulation/echo-traits.test.ts` owns
replay behavior: bypass a linked prerequisite; retain elements, Hex/prefix,
rarity counts, cast exclusions and source-context predicates; preserve
invalid-row repair and branch-local agreement. Include context-only divergence
at the pure outcome boundary for gift/Devotion predicates and a settled-Spell
chronology witness, since history-only divergence cannot detect dropped context.
Reuse the existing ordinary composition and real H Echo witnesses.
Do not reproduce the complete catalog matrix in application tests or create a
new per-trait eligibility interpreter in test helpers.

This review ran the disposable declaration comparison and inspected all
eligibility-only source predicates, existing mixed-condition evidence and
consumer paths. It did not run correctness/performance suites or change
production behavior. Bridal and other known model simplifications remain
separate work. The proposed split changes the normalized catalog contract,
but requires no persisted authored-schema or execution-protocol change.

## Deliberate differences, not automatic bug fixes

| Difference                                           | Current policy and disposition                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fully progressed save                                | Lifetime unlocks, introductory narrative restrictions and first-seen presentation priorities are intentionally outside the authored run. Do not add profile-progression fields to achieve literal parity with every save.                                                                                                                                                            |
| Death Defiance and precise invested God Sent talents | The volatile-eligibility audit deliberately allows exact authored outcomes without simulating combat losses or the complete purchased Hex graph. Task Force retains the necessary settled-Spell-Drop prefix. Preserve this boundary.                                                                                                                                                 |
| Echo's unknown previous-run cache                    | The author supplies up to three source-valid prior-run results. The planner does not prove those traits appeared in an actual previous save. This does not justify ignoring current-run facts it already knows.                                                                                                                                                                      |
| High-tier exhaustion with Denial off                 | `TraitLogic.lua:1963-1993` runs an additional vacancy rescue when `BanUnpickedBoonsShrineUpgrade.ChangeValue <= 0`. The composition audit expressly chooses universal exhaustion/Fallback Gold behavior instead. That policy can disagree with native screens even after finding 1 is fixed. Decide whether to retire the simplification before claiming literal composition parity. |
| Exact random probability and seed                    | The planner authors supported outcomes, not a replica of the game's RNG stream or weighted probability distribution. Nonzero optional priority chances do not alone require a new authored field.                                                                                                                                                                                    |
| Chaos's unselected blessing detail                   | The selected pair's exact blessing/values and all displayed curse identities carry modeled consequences. There is no requirement to persist irrelevant unselected blessing rolls merely to copy the entire native object.                                                                                                                                                            |

## Boundaries not promoted to findings

- `ExchangeOnlyFromLootName` appears on the spurned Trial loot, but a search of
  this source snapshot found no generation consumer of that field. The
  existence of a suggestive flag does not establish an additional planner
  restriction.
- The composition-domain cache omits some `TraitOfferContext` fields. The
  inspected ordinary/Hermes consumer paths do not establish a user-visible
  collision for those omitted fields. Do not report a cache bug without a
  same-history, differing-result production witness.
- The original optional-context inconsistency in `checkRequirement` is resolved
  at `de59551e`: all three context keys now use `?? false`, matching the
  absent-as-false contract. It is not an outstanding BBB context-capture defect.
- First-offer recovery after removing every core boon, while Denial has banned
  some priority options, needs coverage when correcting priority seeding.
  It is a consequence of finding 2's stage model, not a separately reproduced
  project failure here.

## Recommended next scope

Keep the existing catalog/engine/application direction and exact candidate
artifacts. The
[initial offer plan](../progress/INITIAL_TRAIT_OFFER_COMPOSITION_PLAN.md) delivered
findings 1–3 and the exhaustion policy through Gate E. Finding 4, Echo Boon Boon
Boon's current-state predicates versus linked prerequisites, now has the
completed matrix above and the user-approved declaration shape in Gate F.
The ordinary-screen design below records the original recommendation, not a
request to redo Gate E.

The intended correctness test is: **can this complete authored initial screen
result from the source stages at this exact pre-offer state?** It is not “is every
trait individually eligible?” or “did we include every member of a small
ordinary pool?”

Use a bounded staged support check over a maximum of three positions, with
explicit initial priority/replacement, ordinary/high-tier fill, and vacancy
rescue semantics. Establish the concrete algorithm before committing to any
abstraction; this does not call for a generic rules engine, an RNG emulator,
a second simulation pass, or semantic checks in React/the executor.

Retain source-derived witnesses for both acceptance directions:

- the supplied Apollo screen must be accepted;
- a later initial three-non-core screen with an unavoidable priority seed must
  fail; reroll-only support must not widen this domain;
- explicit replacement rarity must survive guaranteed fresh higher rarity;
- exhaustion/rescue behavior must match the explicitly chosen Denial policy.

Gate F bypasses linked prerequisites for Echo while respecting modeled
current-run eligibility. Both are independent declaration collections, not
BBB-specific flags or a runtime classifier of the old combined list.

The accepted authoring boundary separates individual picker eligibility from
complete-offer generation support. Both use exact pre-offer facts, but a row
must not become unselectable because its siblings make the current composition
invalid. The focused
[bucket-rule investigation](INITIAL_OFFER_BUCKET_RULES.md) records the detailed
native stage inputs and remaining source questions.

The shared editor already delegates draft operations to engine capabilities.
Retire its high-tier-only append/remove helpers and complete-path prediction.
Add/Remove are structural edits within the ordinary zero-to-three-row envelope;
zero uses the existing Fallback Gold variant. Removing the last row enters Gold,
and adding one individually eligible row leaves it without a separate fallback
button or completion search. Add disables at three or when no unused eligible
identity remains; Remove disables at zero. An intermediate short, Gold or
incompatible draft gets findings without losing its repair controls. Start over
remains an assisted valid-outcome constructor. Generation buckets and
composition policy remain in the engine, not React.

## Documentation disposition

No new permanent audit is needed just to accumulate these findings. On eventual
implementation, revise the existing owners:

- `TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md`: replace its unconditional
  small-pool membership rule with source-stage evidence; resolve the documented
  Denial divergence rather than silently retaining an incompatible claim.
- `TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md`: distinguish current-state predicates
  from linked prerequisites and replace historical first-slice/deferred wording
  where it misdescribes implemented replacements. Keep its matching declaration
  inventory.
- The owning catalog/reward/candidate design sections: update only the changed
  shared contract, not a narrative for each counterexample.

At delivery closure, promote the source facts into those existing owners and
retire this investigation. BBB's declaration-classification question is resolved;
the matrix supports Gate F, not an indefinite research backlog. No protocol,
persisted-schema or executor changes are implied by the review. The plan's
ordinary editor changes and BBB eligibility correction remain distinct slices.
