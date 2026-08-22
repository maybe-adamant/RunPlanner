# Boon Rarity Ledger Game-Data Audit

## Status and scope

This is an implementation-free source audit of the chance ledger that decides
which boon rarities can appear. It covers:

- ordinary Olympian and Hermes base values;
- Excellence, The Queen, and Divinity;
- miniboss room overrides in F through Q;
- the exact interaction between a miniboss room and a delayed Shrine of Hermes
  delivery;
- Proper Upbringing's activation and future-offer effect;
- Yarn of Ariadne's one-off rarity boost and consumption boundary; and
- direct boon and Hermes offers in the I and Q World Shops.

The evidence was checked on 2026-08-22 against the installed Hades II scripts:

- `HeroData.lua`, `TraitData.lua`, `RoomLogic.lua`, and `TraitLogic.lua` for the
  base tables, modifier precedence, and sequential rarity checks;
- `TraitData_MetaUpgrade.lua` and `MetaUpgradeData.lua` for Arcana effects and
  ranks;
- `RoomDataF/G/H/I/N/O/P/Q.lua` for miniboss overrides;
- `TraitData_Elementals.lua`, `TraitLogic.lua`, and `UpgradeChoiceLogic.lua` for
  Proper Upbringing;
- `StoreData.lua`, `TraitData_Store.lua`, `StoreLogic.lua`,
  `UpgradeChoiceLogic.lua`, `RequirementsData.lua`, and `RoomDataI/Q.lua` for
  Yarn of Ariadne and the I/Q World Shops; and
- `SurfaceShopLogic.lua` and `TraitLogic.lua` for delayed Shrine deliveries.

This audit does not ask the planner to reproduce random rolls or exact offer
probabilities. Its target is the smaller deterministic question needed by the
editor: given an exact reached history and reward source, which authored
rarities are possible, and which are impossible?

Chaos rarity effects are a future consumer of this ledger. Their declarations
and maturation remain owned by the separate
[Chaos trait audit](CHAOS_TRAIT_GAME_DATA_AUDIT.md).

## The source is an ordered chance ledger, not a distribution

`GetRarityChances` builds one table of independent chance checks. It begins
from the provider's base table, applies one contextual override, adds active
`RarityBonus` values, and finally applies active
`MultiplicativeRarityBonus` values.

For an ordinary Olympian boon, the base table is:

| Check     | Base value |
| --------- | ---------: |
| Rare      |       0.10 |
| Epic      |       0.05 |
| Duo       |       0.12 |
| Legendary |       0.10 |

Hermes uses a distinct base table:

| Check     | Base value |
| --------- | ---------: |
| Rare      |       0.06 |
| Epic      |       0.03 |
| Duo       |       0.00 |
| Legendary |       0.01 |

Common has no chance entry. A candidate begins at Common and remains Common if
no supported later check replaces it. Heroic is not in
`BoonRarityRollOrder`; it is never an ordinary fresh roll.

The live roll order is:

```text
Common -> Rare -> Epic -> Duo -> Legendary
```

Each supported non-Common check is independent. A successful later check
overwrites an earlier result. These values therefore do **not** sum to 100%,
and normalizing them into one probability distribution would change the game
rule.

For planner possibility analysis:

- a supported non-Common rarity is possible when its chance is greater than
  zero and every later supported check can fail;
- Common is possible only when every supported non-Common check can fail;
- a chance at or above `1` is guaranteed, so it makes Common and any earlier
  supported result impossible unless a later check succeeds; and
- the trait's own declared rarity support remains authoritative. A positive
  Duo check does not make an ordinary scalable trait a Duo trait.

`IsRarityForcedCommon` is a separate earlier guard. When it succeeds, the game
clears the chance table and does not apply the ledger.

## Override and modifier precedence

The exact source order is:

```text
provider base
  -> current-room override, if present and not ignored
     otherwise loot/item override, if present
  -> additive active rarity bonuses
  -> multiplicative active rarity bonuses
```

Room and loot overrides are alternatives, not layers. A current-room
`BoonRaritiesOverride` wins over a loot object's own override. Each override is
sparse: a missing key falls back to the current provider base rather than
becoming zero.

Additive and multiplicative bonuses may restrict themselves to one provider or
to god loot. The source's `GodLootOnly` check accepts either `GodLoot` or
`TreatAsGodLootByShops`. Hermes declares `GodLoot = false` but
`TreatAsGodLootByShops = true`, so god-loot-only rarity effects such as Proper
Upbringing do apply to Hermes.

The source does not clamp the assembled values before `RandomChance`. For
possibility analysis, values at or above one are therefore guaranteed and
values at or below zero are impossible.

## Arcana effects

Arcana cards are installed as traits at their resolved active rank. Ordinary
permanent ranks I through III correspond to Common, Rare, and Epic. Circe's
Lapis effect can temporarily produce the Heroic rank-IV values already
declared by the same cards.

The three rarity cards contribute:

| Card       | Rank I                          | Rank II                         | Rank III                        | Rank IV                         |
| ---------- | ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| Excellence | Rare `+0.30`; Legendary `x1.30` | Rare `+0.40`; Legendary `x1.40` | Rare `+0.50`; Legendary `x1.50` | Rare `+0.60`; Legendary `x1.60` |
| The Queen  | Duo `+0.06`                     | Duo `+0.08`                     | Duo `+0.10`                     | Duo `+0.12`                     |
| Divinity   | Epic `+0.05`                    | Epic `+0.10`                    | Epic `+0.15`                    | Epic `+0.20`                    |

The displayed values above include `GetProcessedValue`'s two-decimal
normalization. Excellence's Legendary value is a true multiplier: it is
applied after all additive Legendary bonuses, including future modeled
sources. The other entries are additive.

The cards change feasibility only when their assembled value crosses the
zero/guaranteed boundaries for an exact supported rarity. They must still be
retained numerically, rather than collapsed immediately to a minimum rarity,
because later effects can add to or multiply the same checks.

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

Proper Upbringing (`ElementalRarityUpgradeBoon`) may be offered at one Fire,
Earth, Air, and Water. Its effect activates at two of each base element.

On the inactive-to-active transition, `UpgradeAllCommon`:

- upgrades each unique equipped Common god trait to Rare when it satisfies the
  source's shop god-trait classification and is not blocked from in-run
  rarification; and
- installs a `GodLootOnly` additive rarity bonus with `Rare = 1`.

The source adds one to the Rare check; it does not replace the existing Rare
value with exactly one. Since the assembled value is then at least one for
eligible Olympian and Hermes loot, the Rare check is guaranteed. Higher
supported checks still run later and may overwrite Rare. The resulting
planner-facing rule is a Rare-or-higher floor for fresh scalable god traits,
but the underlying source fact is a numeric `+1` ledger contribution.

The activation pass also upgrades already equipped eligible Common traits.
Deactivation removes only the future-offer bonus; it does not downgrade those
past promotions. Reactivation runs the promotion pass again. Echo's second
choice receives a special selection-time upgrade if the first selected choice
activated Proper Upbringing after the second choice had already been generated
as Common.

The existing planner's `minimumScalableGodTraitRarity: Rare` is therefore a
correct projection of Proper Upbringing in isolation. It is not a sufficient
general rarity authority once room/item overrides, Arcana, and future Chaos
effects must compose numerically.

## Yarn of Ariadne

Yarn of Ariadne is the Stygian Well item `TemporaryBoonRarityTrait`; the broader
Well pool is recorded in the
[Stygian Well audit](STYGIAN_WELL_GAME_DATA_AUDIT.md). The Well sells Yarn for
70 gold. Its declaration is a `GodLootOnly` additive rarity contribution with
one remaining use:

| Check     | Added value |
| --------- | ----------: |
| Rare      |       +1.00 |
| Epic      |       +0.25 |
| Duo       |       +0.10 |
| Legendary |       +0.10 |

The values compose with the exact provider base, room or item override, Arcana,
Proper Upbringing, and any other active rarity contribution. Rare is therefore
guaranteed for a scalable god trait while Yarn applies, but later supported
Epic, Duo, or Legendary checks may still overwrite it. The boost applies to the
whole generated offer, not only to the option ultimately selected.

Yarn is eligible for Olympian and Hermes offers. Hermes is accepted by the
`GodLootOnly` condition through `TreatAsGodLootByShops`, as with Proper
Upbringing.

The exact one-use lifecycle is:

1. purchasing Yarn installs `TemporaryBoonRarityTrait` with
   `RemainingUses = 1`;
2. the next eligible God Boon constructed without
   `IgnoreTempRarityBonus` includes Yarn in `GetRarityChances` and marks that
   offer as rarity-boosted; and
3. when that boon choice screen closes, `UseHeroTraitsWithValue` consumes the
   first limited-use `RarityBonus` and removes the expired trait.

An offer that ignores temporary rarity bonuses does not receive or consume
Yarn. The planner should therefore model Yarn as a chronological, one-off
ledger contribution consumed by the next eligible boon offer—not as a
permanent floor and not as a bonus attached to the selected trait.

Stygian Wells are not implemented yet. This audit records Yarn now so future
Well authoring can add the purchase to history and let the same rarity-ledger
frontier consume it without inventing a separate rarity rule.

## I and Q World Shops

The I and Q World Shop rooms do not declare their own room rarity override.
Their boon rarity differences come from the exact generated store item.
Their complete first-/second-half inventory matrices are recorded separately
in the
[I/Q World Shop phase audit](I_Q_WORLD_SHOP_PHASE_GAME_DATA_AUDIT.md); this
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

The current catalog distinguishes `RandomLoot` and `BoostedRandomLoot` option
keys but does not normalize their rarity override or the first-/second-half
World Shop eligibility. That is a current planner gap, not a source
uncertainty.

## Planner disposition

The cohesive correction should introduce one engine-owned rarity-chance
ledger at an exact trait-offer frontier. Its inputs are:

1. the provider base (`BoonData` or `HermesData`);
2. the exact current room override, otherwise the exact reward/shop-item
   override;
3. active additive effects, including the resolved ranks of Excellence, The
   Queen, Divinity, Proper Upbringing, and any unconsumed Yarn of Ariadne; and
4. active multiplicative effects.

The engine then intersects that numeric ledger with the exact trait's declared
rarity support and returns possible authored rarities plus reasons for excluded
rarities. It must not simulate or persist RNG outcomes.

Ownership consequences:

- the catalog owns base tables, sparse room/item overrides, Arcana rank
  contributions, and declaration rarity support;
- chronological simulation owns active Arcana, Proper Upbringing, unconsumed
  Yarn, the reached room, dynamic biome count, and the exact reward source at
  the offer frontier;
- candidate evaluation owns the possible/impossible rarity result; and
- React renders that result without recomputing chance arithmetic.

Proper Upbringing's promotion of already equipped Common traits remains a
separate chronological transition. The general ledger replaces only its
special-case future-offer floor.

The implementation should preserve these exact contacts:

- ordinary versus Hermes bases;
- all four Arcana ranks, including Circe Lapis rank IV;
- every miniboss profile and the delivered-Hermes-in-miniboss edge;
- Proper Upbringing activation, deactivation, reactivation, and already-owned
  Common promotion;
- Yarn's exact additive values, Hermes eligibility, next-eligible-offer
  consumption, and temporary-bonus exclusion;
- ordinary versus boosted World Shop boon items and always-boosted
  second-half World Shop Hermes; and
- dynamic `EnteredBiomes` first-/second-half selection.

## Explicit non-goals

This audit does not require:

- normalized rarity probabilities or deterministic RNG replay;
- authored random seeds;
- UI percentages;
- provider-unrelated NPC choice systems with explicitly authored rarity;
- Chaos curse/blessing implementation;
- Stygian Well authoring or interaction implementation;
- Transcendent Embryo or Cherished Heirloom behavior; or
- a general interpreter for arbitrary trait effect tables.

Future Chaos Favor and Ordinary can consume the same ledger only after their
separate audit settles their exact additive/forced-common semantics. They must
not cause this foundational slice to speculate about Chaos authoring state.
