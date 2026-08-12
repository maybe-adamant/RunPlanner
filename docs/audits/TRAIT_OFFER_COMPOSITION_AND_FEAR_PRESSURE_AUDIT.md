# Trait Offer Composition and Fear Pressure Audit

## Status

Draft source-fact audit against the installed Hades II scripts on 2026-08-12.
The giver inventories, trait requirements, rarity domains, and replacement
target rules remain owned by
[`TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md`](TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md).
This document owns the narrower questions that the original three-option
baseline did not answer:

1. how an Olympian or Hermes offer is filled when fewer than three dependable
   fresh traits remain;
2. when Duo, Legendary, replacement, and fallback outcomes participate;
3. how Vow of Denial changes later offer eligibility; and
4. where Vow of Forfeit intercepts a Boon or Hermes reward.

This is evidence and modeling disposition, not an implementation plan. It does
not prescribe persisted schema, commands, findings, candidate products, or UI
layout.

## Sources

Primary executable evidence:

- `TraitLogic.lua`: `SetTraitsOnLoot`, `CalcNumLootChoices`, and
  `GetTotalLootChoices`;
- `UpgradeChoiceLogic.lua`: `GetPriorityTraits`, `GetReplacementTraits`,
  `GetEligibleUpgrades`, `CreateBoonLootButtons`, and
  `HandleUpgradeChoiceSelection`;
- `RunLogic.lua`: `IsTraitEligible` and `EndBiomeRecords`;
- `LootData.lua` and `LootData_Hermes.lua`;
- `TraitData.lua`: `LegendaryTrait`, `SynergyTrait`, `UnityTrait`, and
  `FallbackGold`;
- `RewardLogic.lua`: the `Boon` and `HermesUpgrade` room-reward spawn paths;
- `ShrineLogic.lua`: `ShrineUpgradeExtractValues`, `GetNumShrineUpgrades`, and
  `CheckBoonSkipShrineUpgrade`;
- `MetaUpgradeData.lua`: `BoonSkipShrineUpgrade` and
  `BanUnpickedBoonsShrineUpgrade`;
- `StoreLogic.lua` and `EncounterLogic.lua` for Shop and Devotion acquisition
  paths; and
- English `TraitText.en.sjson` for the player-facing Vow descriptions.

The audit uses the same progressed, ordinary-run baseline as the existing
trait audit. Probability values are evidence about optional versus dependable
offer participation; the planner still models positive-probability support
rather than RNG replay.

## Offer-Pool Terms

For one exact giver and pre-offer trait history, this audit separates three
domains. All three domains already apply the giver, equipped-state,
offer-context, uniqueness, and banned-trait requirements appropriate to the
candidate.

### Ordinary pool — `O`

`O` contains legal fresh traits that can occupy the Common rarity table. This
includes:

- scalable ordinary traits with a fresh `Common` rarity; and
- infusion/Unity traits, whose declaration includes Common even though the
  player-facing frame is Infusion.

It excludes Duo-only and Legendary-only traits. It also excludes replacement
transitions: a replacement is derived from an occupied core slot rather than
a second fresh copy of the same declaration.

`SetTraitsOnLoot` initializes a vacant position from the Common table before
rarity rolls. A non-empty `O` therefore supplies a dependable option for that
position.

### Optional high-tier pool — `H`

`H` contains legal traits whose fresh domain is only `Duo` or `Legendary`.
Eligibility admits them to the appropriate rarity table, but it does not force
their rarity roll to succeed. They may occupy a position; they are not a
dependable source with which to prove that the offer must contain three
traits.

Devotion blocks Duo rarity before this composition runs. Room-owned
`BlockGiftBoons` and all ordinary trait requirements likewise reduce the exact
pre-offer domain before cardinality is considered.

### Replacement pool — `R`

`R` contains legal core-slot replacement transitions. Each transition:

- comes from the giver's `PriorityUpgrades`;
- targets an occupied ordinary slot containing a different trait;
- requires a supported next rarity;
- retains the candidate's ordinary requirements and banned-trait exclusion;
  and
- carries the exact promoted rarity derived from the displaced trait.

The source may seed at most one normal replacement while a sufficiently large
ordinary domain remains. Its later exchange-fill pass may use replacement
transitions for every still-vacant position after the fresh/high-tier pass.
Each replacement alternative is assessed against the same pre-offer equipped
state; unselected options do not mutate slots.

## General Offer-Composition Contract

`ScreenData.UpgradeChoice.MaxChoices` declares a fixed three-position offer
envelope. Three is a constant for the supported Olympian/Hermes surface, not a
cardinality derived from the active Vows. The concrete offer is composed
against one immutable pre-selection state; only the selected option changes
equipped-trait history.

The fixed envelope and the number of materialized trait choices are separate
facts. Exhaustion may leave only one or two trait choices in that envelope, or
may put Fallback Gold in its first position and close the other two. Denial
does not change the envelope width to `3 - 2`; its value of two is the maximum
number of other positions banned after the player selects one.

The following rules state the game-language support boundary independently of
why a pool became small. Vow of Denial is one way to reach these pressure
points quickly, but the domains and exhaustion behavior are general.

### At least three ordinary candidates

When `|O| >= 3`:

- the offer contains exactly three trait options;
- an actual option may instead be a legal Duo, Legendary, or replacement
  outcome; and
- the normal maximum of one replacement remains in force.

The three authored options need not be the first three members of `O`.
`O` establishes dependable cardinality, while all concrete options still need
their own exact legality witness.

### One or two ordinary candidates

When `0 < |O| < 3`:

- every member of `O` must appear;
- zero or more actually rolled members of `H` may occupy remaining positions;
- after those optional high-tier outcomes, legal replacements fill as many
  remaining positions as possible; and
- the exhaustion replacement fill is no longer limited to one replacement.

If the replacement domain cannot fill every vacant position, only one or two
trait choices materialize inside the fixed three-position envelope. Fallback
Gold does not coexist with those traits: the presence of a dependable ordinary
option prevents the whole-offer fallback outcome.

### No ordinary candidates

When `|O| == 0`:

- members of `H` may appear when their optional rolls succeed;
- legal replacements then fill the remaining positions and may occupy more
  than one position; and
- if neither an optional high-tier trait nor a replacement materializes, the
  offer becomes Fallback Gold.

If `R` is empty, an eligible `H` does not by itself exclude Fallback Gold:
the high-tier roll may fail. The supported authored outcomes are therefore
either one-to-three actual high-tier traits or the whole-offer fallback. If a
high-tier trait does materialize, Fallback Gold is not displayed beside it.

### Fallback Gold is a whole-offer outcome

`CreateBoonLootButtons` inserts `FallbackGold` only when the generated option
list is empty. Its trait declaration immediately grants consumables rather
than leaving an equipped boon.

For modeling purposes, Fallback Gold is therefore mutually exclusive with a
trait-option list:

- choosing Fallback Gold as the first outcome closes the remaining option
  positions;
- it does not have a trait rarity choice merely because the source declaration
  uses `Rarity = "Common"` to drive the generic boon screen; and
- it does not enter equipped-trait history or the banned-trait set as a boon.

This distinction prevents a consumable fallback from becoming a fake trait
declaration solely to reuse a three-slot UI.

## Literal Source Branch at Exhaustion

There is one executable detail that conflicts with the clean universal
interpretation above and must not be hidden.

After the initial rarity-sensitive fill and replacement fill,
`SetTraitsOnLoot` contains a final pass labelled “Fill empty spots with any
traits that failed the rarity check the first time around.” The pass is guarded
by:

```lua
local numBans = MetaUpgradeData.BanUnpickedBoonsShrineUpgrade.ChangeValue
if numBans <= 0 then
  -- fill remaining positions from the surviving rarity tables
end
```

`ShrineUpgradeExtractValues` sets that `ChangeValue` to two while Denial is
active and to zero while inactive or suppressed. In the installed source,
Denial therefore does more than merely make exhaustion arrive sooner: it also
skips this final forced rarity-table fill at the exhaustion boundary.

The player-facing Vow description mentions only the permanent loss of
unselected blessings. The agreed planner interpretation is that reduced
cardinality and Fallback Gold are universal exhaustion behavior, while Denial
only accelerates exhaustion by banning traits. That interpretation is cleaner
and matches the observed game-language model, but it is not a literal
translation of the source guard above.

This discrepancy must be resolved explicitly before an implementation plan is
locked. The implementation must not accidentally claim both behaviors or put
an unexplained Denial conditional inside otherwise general composition.

## Vow of Denial

### Declaration and applicability

`BanUnpickedBoonsShrineUpgrade` has one rank. Its extracted `ChangeValue` is
two. `BaseLoot` declares `BanUnpickedBoonsEligible = true`; ordinary Olympian
loot inherits `BaseLoot`, and `HermesUpgrade` also inherits it.

Stack/Pom and Weapon/Hammer loot explicitly disable the flag. Field-NPC and
Story choice surfaces do not inherit this eligible BaseLoot contract. The
supported Denial domain is therefore Olympian and Hermes trait offers,
including those reached through a Shop or Devotion rather than only room-door
rewards.

### Selection effect

After the player chooses an eligible offer option,
`HandleUpgradeChoiceSelection` iterates the other displayed buttons and stores
up to the declaration's fixed two exact trait names in
`CurrentRun.BannedTraits`. Two is `MaxChoices - 1` for the fixed three-position
offer language; it is not a requested post-Denial offer width.

Consequences:

- a three-trait offer bans two traits;
- a two-trait offer bans one;
- a one-trait offer bans none; and
- Fallback Gold has no unselected trait options to ban.

`IsTraitEligible` rejects an exact banned trait key on later offers. The ban is
route-wide and provider-key specific: banning one Apollo trait does not ban a
different Apollo trait or an analogous trait from another giver.

Denial does **not** remove an already equipped trait. It changes future offer
eligibility only after a concrete displayed option is left unselected.

### Suppression by Circe

Black Night Banishment may disable Denial for the rest of the run. Once
disabled, new eligible selections do not add bans because the extracted Vow
value becomes inactive. Trait keys already written to
`CurrentRun.BannedTraits` remain banned; the scripts do not restore them when
the Vow is suppressed.

## Vow of Forfeit

### Declaration and per-biome counter

`BoonSkipShrineUpgrade` has one rank with `ChangeValue = 1`.
`CheckBoonSkipShrineUpgrade` compares the effective Vow rank with
`CurrentRun.BiomeBoonSkipCount`. On the first qualifying spawn in a biome it:

1. increments the counter;
2. creates `RoomRewardConsolationPrize`; and
3. returns that consumable instead of creating the requested loot source.

`EndBiomeRecords` resets `BiomeBoonSkipCount` to zero. The effect can therefore
replace one qualifying reward in every biome while the Vow remains effective.

### Qualifying acquisition path

The interception is called only from `RewardLogic`'s room-reward spawn cases
for:

- `rewardType == "Boon"`; and
- `rewardType == "HermesUpgrade"`.

The authored door reward remains a Boon or Hermes reward. At spawn time the
Vow substitutes the consolation consumable, so no trait offer is opened and no
trait is acquired from that reward.

The generic Shop `GiveLoot` path and Devotion's two `GiveLoot` calls do not call
`CheckBoonSkipShrineUpgrade`. Forfeit therefore does not consume its biome
trigger or replace those offers. Pom, Hammer, NPC, and Story traits likewise
do not enter the qualifying switch cases.

### Suppression by Circe

Black Night may disable Forfeit. The comparison uses the effective rank from
`GetNumShrineUpgrades`, so a disabled Vow does not intercept later room
rewards. A skip already consumed earlier in the biome remains historical; no
trait offer is restored retroactively.

## Stable Source Facts

1. Banned trait keys are an input to ordinary trait eligibility, not a second
   post-composition validator.
2. Ordinary/infusion traits, optional Duo/Legendary traits, and replacement
   transitions have different cardinality roles and must not be flattened into
   one undifferentiated candidate count.
3. The supported Olympian/Hermes offer envelope has a constant width of three;
   Denial does not reduce that configured width. Exhaustion can still
   materialize fewer than three trait choices inside it.
4. Replacement overflow is general exhaustion behavior. It can fill multiple
   positions only after the dependable fresh domain has fallen below three.
5. Fallback Gold is created only for an empty generated offer and is not an
   equipped trait.
6. Denial records only actual displayed, unselected Olympian/Hermes traits and
   preserves prior bans if Circe later disables the Vow.
7. Forfeit is one qualifying room-reward substitution per biome. It does not
   apply to Shop or Devotion offers merely because they use the same giver.
8. Forfeit prevents the trait-offer lifecycle from starting; Denial acts only
   after a real trait option is selected.

## Planning Disposition

1. The planner adopts the universal exhaustion contract above as the
   user-validated game model. Denial adds bans but does not select a separate
   composition algorithm. The installed source guard remains recorded as an
   explicit discrepancy rather than becoming hidden production policy.
2. `RoomRewardConsolationPrize` receives its exact normalized concrete
   acquisition identity. Its numeric one-health/currency behavior remains
   outside the planner; it is not an equipped trait or ordinary authored
   reward type.
3. `CalcNumLootChoices` supports a separate acquired effect that reduces a god
   screen from three choices to two. No currently modeled trait supplies that
   effect, so it remains outside this slice rather than being conflated with
   exhaustion cardinality.
