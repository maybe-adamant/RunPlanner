# Boon Rarity Sources and Mutations

## Scope and evidence

This audit separates fresh-screen chance construction, in-menu Rarification,
direct grants and later equipped mutation. It records the supported source
facts and chosen planner simplifications, not an implementation chronology.

Primary contacts in the installed scripts, checked on 2026-09-15:

- `HeroData.lua:170–188`, `RoomLogic.lua:IsRarityForcedCommon/GetRarityChances`
  and `TraitLogic.lua:SetTraitsOnLoot`: bases, overrides and ordered checks;
- `TraitData_MetaUpgrade.lua`, `TraitData_Chaos.lua`,
  `TraitData_Elementals.lua`, `TraitData_Store.lua`: bonus declarations;
- `RoomDataF/G/H/I/N/O/P/Q.lua`: miniboss profiles;
- `NPCData_Artemis/Athena/Dionysus.lua`, `EncounterPresentation.lua:1428`
  and `TraitData_Keepsake.lua`: provider order and Gorgon source context;
- `UpgradeChoiceLogic.lua`, `TraitLogic.lua`, `PowersLogic.lua` and
  `EventLogic.lua`: screen closure, direct grants and mutation contacts;
- `SurfaceShopLogic.lua`, `StoreLogic.lua`, `StoreData.lua`: delivery and
  exact store-item context.

[Initial offer construction](TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md)
owns seeding, bucket depletion and rescue. [Trait pools](TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md)
owns declaration membership and upgrade target predicates.
[Run-impacting effects](RUN_IMPACTING_TRAIT_EFFECTS_GAME_DATA_AUDIT.md)
owns Bridal's retained target and Personal Loan's payout lifecycle.

## Chance arithmetic is not a probability distribution

| Provider          | Rare | Epic |  Duo | Legendary |
| ----------------- | ---: | ---: | ---: | --------: |
| Ordinary Olympian | 0.10 | 0.05 | 0.12 |      0.10 |
| Hermes            | 0.06 | 0.03 | 0.00 |      0.01 |

Common starts as the default. Ordinary checks run Common → Rare → Epic →
Duo → Legendary; later successes overwrite earlier results. Heroic is not a
fresh ordinary roll. These values do not sum to one and must not be normalized.

For one roll over a supported domain, a non-Common tier needs positive chance
and all later applicable checks must be able to fail. Common requires every
applicable later check to be able to fail. A value at or above one guarantees
its check; a value at or below zero cannot win the random pass. Bucket rescue
has different rules, including present-zero support; this arithmetic alone
does not decide complete-screen legality.

Priority seeds roll against their own declared rarity support. Remaining
positions roll against the eligible pool's nonempty buckets. A guaranteed
later bucket can exclude a Common-only identity at one position but become
empty after earlier selections. Thus per-trait roll feasibility cannot replace
whole-screen construction.

## Source precedence

Forced Common is resolved before the normal ledger. When active it clears
the table, prevents ordinary replacement seeding and avoids marking the
screen as temporarily rarity-boosted. Hymn and replacement vacancy rescue
retain their distinct construction rules.

Otherwise the source is:

1. provider base;
2. current-room sparse override, unless ignored; otherwise the loot/item
   sparse override;
3. all applicable additive contributions;
4. all applicable multiplicative contributions.

Missing override entries retain the provider base; zero is an explicit value.
Room and item overrides are alternatives, not cumulative layers. Values remain
unclamped. God-only bonuses accept `GodLoot` or `TreatAsGodLootByShops`,
including Hermes and the shop-aware field NPCs, but not Chaos.

The apparent miniboss exemption in `IsRarityForcedCommon` requires
`Hero.BoonData.AllowRarityOverride`. That field is absent from the declaration
and no installed script enables it. The similarly named StackData field is
unrelated: miniboss and boosted-item overrides do not bypass Ordinary.

## Chance-source matrix

Rank lists are I / II / III / IV. Numeric additions precede multipliers.

| Source                              | Declared contribution or override                                         | Applicability and consumption                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Excellence                          | Rare +30/40/50/60%; Legendary ×1.30/1.40/1.50/1.60                        | Active Arcana; native processed-value rounding applies. Rare also affects Chaos.                                                  |
| The Queen                           | Duo +6/8/10/12%                                                           | Active Arcana; cannot manufacture Duo identities in providers without them.                                                       |
| Divinity                            | Epic +5/10/15/20%                                                         | Active Arcana; also affects Chaos.                                                                                                |
| Barren                              | Disables active Arcana; paired nonfixed blessing is Heroic                | Arcana suppression and paired rarity assignment are separate effects.                                                             |
| Favor                               | Rare +40–50% / +54–67% / +67–84% / +80–100%; Epic/Duo/Legendary +10% each | Matured or directly granted blessing; no GodLootOnly restriction. Magnitude is authored.                                          |
| Yarn of Ariadne                     | Rare +100%, Epic +25%, Duo +10%, Legendary +10%                           | One use, eligible god/shop-aware screen; ignored temporary bonuses and forced Common do not spend it.                             |
| Proper Upbringing                   | Rare +100% while activated                                                | God-only contribution; separate equipped promotion below. Higher checks still run.                                                |
| Ordinary                            | Forced fresh Common, not a negative bonus                                 | Qualifying god/shop-aware screens, including Artemis/Athena/Dionysus and Gorgon. Their qualifying use consumes its limited count. |
| Miniboss room                       | Sparse override in the room matrix below                                  | Applies to loot generated there, including delayed deliveries.                                                                    |
| Boosted Boon / upgraded shop Hermes | Rare 90%, Epic 25%, Legendary 10%; Duo retains base                       | Exact generated item, not a blanket shop/biome bonus. Room override still wins.                                                   |
| Gorgon                              | Sparse Common/Rare/Epic/Heroic = 1 by rank                                | II–IV ignore temporary bonuses; room override and permanent contributions remain. Ordinary still wins.                            |
| Trial                               | Duo chance written as zero                                                | Not equivalent to removing declarations or removing that chance key.                                                              |
| Denial / Rejected                   | No numeric contribution                                                   | Denial bans identities and disables final rescue; Rejected blocks selection of a displayed row, not generation.                   |

Sources: `TraitData_MetaUpgrade.lua:810,855,894`;
`TraitData_Chaos.lua:172,1007,1160`; `TraitData_Store.lua:280`;
`TraitData_Elementals.lua:118`; `StoreLogic.lua:166,194,212`;
`TraitData_Keepsake.lua:2236`; `EncounterLogic.lua:1686,1692`.

### Yarn consumption

Purchasing Yarn installs a limited-use rarity trait. The next eligible screen
that includes it in `GetRarityChances` is marked `RarityBoosted`; closing
that screen consumes the limited bonus
(`TraitLogic.lua:1778`, `UpgradeChoiceLogic.lua:1127`).
It boosts the generated screen, not just its selected row. Forced Common,
Chaos and Gorgon II–IV do not consume an ignored bonus. Rank-I Gorgon and
other qualifying NPC screens use the same applicability rule.

### Shop-aware NPCs and Gorgon

Artemis, Athena and Dionysus use the ordinary base, with their own roll orders:
Artemis Common/Rare/Epic; Athena Common/Rare/Epic/Heroic; Dionysus the default
order intersected with its declared support. God-only bonuses and Ordinary
apply. Hades has the shop-aware flag but remains player-rarityless in the
planner; its traits block in-run rarification.

Native Gorgon does not assign one final rarity to all three rows.
`RarityLevelBonus` becomes a source override; rank I retains ordinary
Common/Rare/Epic possibilities, II guarantees at least Rare, III Epic, IV
Heroic before other applicable context. A room override can replace that
source override. II–IV suppress temporary bonuses, not permanent ones.

The planner deliberately keeps Gorgon authoring as three trait identities.
It resolves the real forced/source context, then uses the lowest reachable
Athena rarity for all three rows. This omits legal random mixtures at lower
ranks while retaining a legal deterministic realization. Ordinary can make
that realization Common; the editor does not maintain a competing Gorgon
rarity policy.

### Chaos pair rarity

`TrialUpgrade` supplies Rare 40%, Epic 10%, Duo 0%, Legendary 5%
(`LootData_Chaos.lua:16,94`). It ignores temporary rarity bonuses and is not
god loot. Nonfixed pairs test Epic, then Rare (`TraitLogic.lua:1710`);
Barren assigns Heroic, and a blessing with one declared rarity uses it directly.

Excellence, Divinity and Favor affect exact-context pair feasibility. Yarn and
Proper's god-only bonus do not; Queen and the Legendary multiplier do not
change the Epic/Rare pair roll. For example rank-IV Excellence makes Rare
0.40 + 0.60 = 1, so an ordinary Common pair cannot survive unless a different
source rule applies. The specialized pair model consumes these facts without
becoming an ordinary three-bucket editor. Embryo is a direct grant, not this roll.

## Miniboss room profiles

Each audited biome's miniboss family declares a room-level override. The
effective Olympian values are:

| Biome | Rooms/profile                                    | Rare | Epic |       Duo | Legendary |
| ----- | ------------------------------------------------ | ---: | ---: | --------: | --------: |
| F     | `F_MiniBoss01/02/03`                             | 0.90 | 0.07 | 0.12 base |      0.05 |
| G     | `G_MiniBoss01/02/03`                             | 0.90 | 0.10 | 0.12 base |      0.05 |
| H     | `H_MiniBoss01/02`                                | 0.90 | 0.10 | 0.12 base |      0.05 |
| I     | `I_MiniBoss01/02`                                | 0.90 | 0.10 |      0.20 |      0.20 |
| N     | `N_BaseMiniBoss` and its two inheriting children | 0.90 | 0.10 | 0.12 base |      0.05 |
| O     | `O_MiniBoss01/02`                                | 0.90 | 0.10 | 0.12 base |      0.05 |
| P     | `P_MiniBoss01/02`                                | 0.90 | 0.10 |      0.20 |      0.20 |
| Q     | `Q_BaseMiniBoss` and its inheriting children     | 1.00 | 0.70 |      0.20 |      0.20 |

The word `base` in the table means the room did not override that key, so the
ordinary provider base remains. For Hermes the same sparse room override is
applied over the Hermes base instead; a trait can only use rarities supported
by its own declaration.

The bonus belongs to the current room, not exclusively to that room's declared
reward. Any loot constructed there without an active
`IgnoreRoomRarityBonus` flag reads the room override.

### Delayed Hermes delivery in a miniboss room

A delayed Shrine purchase retains the original store item until its countdown
expires. At delivery, the expiration handler calls `SpawnStoreItemInWorld`,
which calls `CreateHermesLoot` or `GiveLoot`. `CreateLoot` immediately calls
`SetTraitsOnLoot`, and that call reads the current room's rarity override.

Only **after** the loot and its options have been constructed does the
expiration handler set `rewardItem.IgnoreRoomRarityBonus = true`. No pending
Shrine item carries that flag into `CreateLoot`.

Therefore, when a Hermes boon delivery resolves in a miniboss room, its initial
trait offer does receive that miniboss room's rarity override. The effect is
not restricted to the miniboss room reward. A later offer reroll preserves the
already assembled rarity table while explicitly ignoring a second room-bonus
application, so it does not erase or double the initial benefit.

This result follows from the exact construction order and is important for the
planner: the rarity context belongs to the room in which the delayed reward is
materialized, not the earlier Shrine purchase room.

## Proper Upbringing

Proper's offer threshold is one of each base element; activation needs two of
each. `UpgradeAllCommon` (`TraitLogic.lua:2629–2668`) upgrades equipped Common
shop-classified god traits to Rare unless in-run rarification is blocked,
then separately assigns Proper itself Rare, even if acquired Epic.
It installs the GodLootOnly Rare +1 bonus for future screens.

Deactivation removes the future bonus, not completed mutations. Reactivation
repeats the pass. Ordinary's expiry explicitly reruns it when Proper is
already active (`TraitData_Chaos.lua:1007`, `TraitLogic.lua:1328`); a Common
acquisition during Ordinary is not automatically corrected before that seam.
Authored offer rarity remains evidence distinct from equipped rarity.

A screen's residual acquisition can observe the primary selection's new
activation: Concave Stone may acquire its frozen Common alternative as Rare
(`UpgradeChoiceLogic.lua:1002–1023`). This is not a fresh screen or a second
Yarn use. The same distinction applies to direct replay grants.

### Infusions

All ten ordinary Infusions inherit the Infusion presentation and equal
per-tier effect multipliers. Six retain internal Common/Rare/Epic support;
`ElementalDamageBoon`, `ElementalBaseDamageBoon`, `ElementalDodgeBoon` and
`ElementalHealthBoon` narrow it to Common only. Internal rarity remains a
generation fact even when the frame reads Infusion.

Those four can be excluded by a guaranteed later bucket until it is depleted;
final rescue is a separate construction path. Infusions are excluded from
GodBoonRarities, so they do not add a Common count for Uncommon Grace. Hubris
uses its elemental-trait rule rather than hidden internal rarity. Presentation
does not warrant normalizing authored values or removing their repair controls.

## Rarity mutation and direct-grant matrix

These contacts do not add inputs to the fresh-screen ledger.

| Contact                                            | Native effect                                                                                             | Planner boundary                                                                                                                   |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Core replacement                                   | Exact next rarity; transferred level plus exchange bonus                                                  | Derived transition at the same pre-offer state, not a fresh roll.                                                                  |
| Calling Card                                       | One-step menu Rarification through Heroic; 2/4/6/8 uses                                                   | Ordered actions and Fated/charge guards.                                                                                           |
| Nine god keepsakes                                 | Provider-specific one-use Rarification; ranks I/II/III cap source at Common/Rare/Epic                     | Same action contract; Cherished reconstructs the nested use, not provider priority.                                                |
| Aromatic Phial                                     | Fountain use promotes an eligible Common boon to Rare/Epic/Heroic                                         | Separate consume/effective-target domains preserve cooldown limits.                                                                |
| Proper activation / reactivation / Ordinary expiry | Equipped Common promotion and source assignment                                                           | History transition, not authored-offer rewrite.                                                                                    |
| Bridal Glow                                        | Heroic target outcome plus +1/+2/+3/+4 levels by source rarity; later credit of positive grant difference | Preferred-only offer eligibility, acquisition-only fallback and remembered target; effect audit owns details and non-Pom omission. |
| Steady Growth                                      | Every 6/5/4/3 qualifying encounters, one eligible target advances a rarity                                | Native clock event; upgrading Growth preserves remaining time bounded by new interval.                                             |
| Concave Stone                                      | Acquires a residual row; can observe a newly activated Proper                                             | Frozen screen with selected-effect continuation, not regeneration.                                                                 |
| Boon Boon Boon                                     | Replays prior rarity, not level; active Proper can promote Common grant                                   | Authored stand-in for prior-run cache; replay-specific eligibility, no fresh roll.                                                 |
| All Together                                       | Direct Common infusion grants                                                                             | No new screen/chance test for each child.                                                                                          |
| Embryo                                             | Direct Common/Rare/Epic/Heroic Chaos blessing by keepsake rank                                            | Replaces on its native eight-encounter clock; Favor then contributes normally.                                                     |
| Cherished / Gift Gift Gift                         | Rank or effect-source reconstruction                                                                      | Indirectly changes future keepsake outcomes; not an extra rarity bonus.                                                            |
| Circe Lapis                                        | Active manually equipped Arcana rank promotion, native counts 2/2/3/5                                     | Rarityless NPC baseline selects up to two cards for Heroic promotion.                                                              |
| Judgment / Figurine                                | Activate Arcana                                                                                           | Contributions become live through existing Arcana state; Barren still suppresses.                                                  |
| Latest Model                                       | Permanent hammer becomes native Legendary                                                                 | Hammer Rank II, independent of boon rarity.                                                                                        |
| Experimental Hammer / Anvil                        | Direct hammer grants/removal                                                                              | Hammer acquisition/rank state, not a rarity roll.                                                                                  |
| Personal Loan payout                               | Retains trait and sets runtime rarity block                                                               | Later rarity mutations respect the equipped-instance block; original rarity still counts.                                          |

Source contacts: `UpgradeChoiceLogic.lua:1203`;
`TraitData_Keepsake.lua:77,2338`; `InteractLogic.lua:741`;
`TraitLogic.lua:2703,2823–2857,2967–3033`; `EventLogic.lua:1363,1580`;
`PowersLogic.lua:3688,4869`; `CombatLogic.lua:3953–3966`.

Calling Card and a slotted god keepsake are not competing usable sources:
equipping a god keepsake makes the run Unfated, clears Calling Card uses and
prevents re-equipping it (`KeepsakeLogic.lua:833,1222–1235`).
Unslotted Echo effects retain their separate source lifecycle.

## Adjacent effects and bounded exclusions

Natural Selection, Ransoms, Poms, Pom Slices, Jeweled Pom and Persephone change
levels, not this chance ledger. Uncommon Grace, Hubris and cooldown saturation
consume internal rarity facts; Hex node rarity belongs to the talent layout.
Mystery boxes and Sea Star create or resolve sources whose later screens use
their normal context. Outer NPC cosmetic tiers are not player rarity.

Premium Service calls `UpgradeAspect` (`TraitLogic.lua:2801`); its numeric
aspect-rank mutation is not modeled here. This is a bounded aspect/combat-model
omission, not evidence of another boon-rarity modifier. Profile progression,
tutorial forcing and rerolls remain outside the initial-offer baseline.

## I and Q World Shops

The I and Q World Shop rooms do not declare their own room rarity override.
Their boon rarity differences come from the exact generated store item.
Their complete first-/second-half inventory matrices are recorded separately
in the
[I/Q World Shop phase audit](../rooms-and-routes/I_Q_WORLD_SHOP_PHASE_GAME_DATA_AUDIT.md); this
section owns only the rarity-bearing contacts.

`RandomLoot` uses the ordinary provider base. `BoostedRandomLoot` supplies the
following sparse loot override:

| Check     | Boosted value |
| --------- | ------------: |
| Rare      |          0.90 |
| Epic      |          0.25 |
| Duo       | provider base |
| Legendary |          0.10 |

Both World Shops use this same boosted profile. Their difference is inventory
shape, not a different boost formula:

- I has one leading weighted slot that is ordinary `RandomLoot` in the first
  half of a run and is `BoostedRandomLoot` or a Big Pom in the second half. Its
  mixed slot can still contain ordinary `RandomLoot`, and its premium slot can
  contain `BoostedRandomLoot` in the second half.
- Q draws two offers without replacement from its first mixed group. In the
  second half that group contains both ordinary `RandomLoot` and
  `BoostedRandomLoot`, so one board may expose both profiles. Its premium slot
  can also contain `BoostedRandomLoot`.
- In either shop, the second-half `ShopHermesUpgrade` has
  `UpgradeChance = 1.0`. Store generation therefore always assigns the boosted
  override to that Hermes item. Missing override keys fall back to Hermes's
  provider base.

`InRunFirstHalf` means `CurrentRun.EnteredBiomes <= 2`, while
`InRunSecondHalf` means `EnteredBiomes > 2`. This is dynamic route history, not
a literal assumption that I or Q occupies a fixed ordinal biome. Dream Dive or
future reordered routes must use the reached biome count.

Those predicates are local eligibility guards on entries inside
`I_WorldShop` and `Q_WorldShop`; they are not a global rule that upgrades every
Shop after two biomes. `F_Shop01` uses the separate ordinary `WorldShop`
profile, whose pool has `RandomLoot`, `BlindBoxLoot`, and an ordinary
`ShopHermesUpgrade` but no `BoostedRandomLoot`. Moving F later in a Dream Dive
therefore does not manufacture a boosted F Shop offer. The boost remains an
exact property of a generated `BoostedRandomLoot` item or an item whose own
`UpgradeChance` installed the same override.

The catalog normalizes the exact generated-item distinction: `RandomLoot` uses
the provider base and `BoostedRandomLoot` carries the sparse boosted override.
Authored I/Q Shop slots persist that exact option identity beside the resolved
boon source, and the rarity ledger consumes the confirmed option witness at
the offer frontier. Phase eligibility remains an option-entry requirement
owned by the Shop phase slice; no Shop profile or biome-name inference supplies
the rarity context.

## Planner disposition

The catalog owns provider bases and orders, sparse source overrides, declared
rarity support, bonus profiles and effect descriptors. Simulation resolves
the exact source, active effects and history before producing offer facts.
Ordinary generation uses those facts in its staged bucket solver; specialized
providers use their own source contract. The editor consumes results.

Fresh support, exact replacements, post-menu effective rarity and later
equipped mutation remain separate products. Declaration and equipped-instance
rarity blocks compose at in-run target predicates; neither removes a retained
trait from rarity counts. No global persisted chance table, inferred UI floor
or second eligibility engine is needed.
