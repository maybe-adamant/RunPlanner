# Cherished Heirloom Keepsake Audit

## Status

Source audit completed against the installed Hades II scripts on 2026-08-14.
This document isolates the game behavior of Demeter and Hera's
`KeepsakeLevelBoon` (Cherished Heirloom) for the keepsakes whose effects are
implemented or deliberately deferred by the planner.

This is not an implementation plan. It records rank data, current-equip
reconstruction, persistent-field behavior, exact declaration exceptions, and
same-offer Concave Stone chronology.

## Scope and Planner Rank Simplification

The detailed matrix covers:

- the six modeled keepsakes;
- the four lower-priority deferred effects; and
- Moon Beam plus the nine deferred Olympian reward-steering keepsakes.

The 13 intentionally effect-neutral keepsakes remain valid ordinary keepsake
declarations, but their inherent gameplay effects are not individually resolved
here. Their source rank facts remain audit evidence; production rank profiles
are deferred until each keepsake receives its own effect slice. Effect-neutral
is not system-neutral: they still participate in ordinary equip/retain/replace
history, removed-key and no-return legality, Fated/Unfated state, and Run State
identity.

This audit records rank-I, rank-II, rank-III, and rank-IV declaration facts
where the game supplies them. The current implementation slice normalizes
four-rank profiles only for the six supported effects; the other source rows
remain evidence for their later effect slices. The planner does not author or
simulate a player's profile rank: every ordinary player-equipped keepsake begins
from the fixed rank-III baseline. Cherished Heirloom is modeled only as the
source rank-III to rank-IV transition. If a declaration has no rank-IV row, its
effective rank remains III even while the boon is active.

This is a deliberate planner simplification. Rank-I effects created by Echo
or another game system are separate produced effects, not ordinary
player-equipped rank choices.

## Sources

Primary evidence:

- `TraitData_Duo.lua`: `KeepsakeLevelBoon`;
- `Main.lua`: immediate `thread` coroutine startup and yield scheduling;
- `PowersLogic.lua`: `AttemptAdvanceKeepsake`, Chaos blessing creation, Fig
  Leaf persistent-trait creation, and Path of Stars point mutation;
- `KeepsakeLogic.lua`: `GetKeepsakeLevel`, `KeepsakeHasHeroicRarity`,
  `AdvanceKeepsake`, `EquipKeepsake`, and `UnequipKeepsake`;
- `TraitData_Keepsake.lua`: `PersistentKeepsakeKeys`, `GiftTrait`,
  `BaseBoonUpgradeKeepsake`, and the scoped declaration rank tables;
- `TraitLogic.lua`: `AddTraitData` and the Chaos transformation fold;
- `EncounterLogic.lua` and `EncounterPresentation.lua`: Gorgon Amulet's
  processed Athena-spawn rarity arguments; and
- `UpgradeChoiceLogic.lua`: selected-trait acquisition order, Concave Stone,
  and source-specific rarify use.

The ordinary rank-III planner baseline and keepsake selection history remain
owned by `KEEPSAKE_GAME_DATA_AUDIT.md`.

## Boon and Rank Authority

`KeepsakeLevelBoon` declares `KeepsakeLevelBonus = 1` and calls
`AttemptAdvanceKeepsake` when acquired. That callback invokes
`AdvanceKeepsake(true)`.

`GetKeepsakeLevel` applies the bonus only when the queried declaration is not
already profile-maxed or declares a Heroic rarity row. Under the planner's
fixed rank-III baseline:

- a keepsake with a Heroic row resolves as rank IV while Cherished Heirloom is
  active; and
- a rank-III keepsake without a Heroic row remains rank III.

`AdvanceKeepsake(true)` still reconstructs the current keepsake even when its
effective rank does not change. That detail produces the Olympian rarify
refill described below.

## Exact Target and Timing

Cherished Heirloom's acquisition callback targets only
`GameState.LastAwardTrait`, and only when that exact trait is still present on
the hero. It does not search retained effects created by previously equipped
keepsakes.

Consequently:

- an equipped Time Piece is upgraded immediately;
- retained Time Piece charges from a previously removed Time Piece are not
  changed when another keepsake is current;
- the same rule applies to retained Calling Card, Jeweled Pom, Fig Leaf, and
  other effect-owned state; and
- keepsakes equipped later begin from the planner's rank-III baseline and
  consult the still-active `KeepsakeLevelBonus`, becoming rank IV only when
  their declaration supports it.

The planner therefore needs two contacts rather than one generic run-wide
mutation: an acquisition-time transition for the current keepsake and rank
resolution for each later equip.

## Reconstruction and Persistence

For the current keepsake, `AdvanceKeepsake(true)`:

1. records selected fields from the current trait;
2. unequips it with `AdvanceKeepsakeMoment = true`;
3. re-equips the same key with `SkipSetup = true` and its newly resolved rank;
4. restores the recorded fields; and
5. applies exact declaration-specific adjustments.

The re-equip does not pass `FromLoot`, so `AddTraitData` does not rerun the
keepsake's acquisition callback. Immediate products are therefore not granted
again merely because the declaration was reconstructed.

The relevant entries in `PersistentKeepsakeKeys` are:

- `RemainingUses`;
- `Uses`;
- `CurrentRoom`; and
- `BoonConversionUses`.

Nested `RarityUpgradeData.Uses` is not in that common list. `AdvanceKeepsake`
separately snapshots it only for `RarifyKeepsake` and restores it as the old
count plus two. The nine Olympian keepsakes receive no equivalent nested-field
preservation.

## Rank Profiles and Current-Equip Outcomes

The rank values below are source declaration facts retained as durable audit
evidence; only the six supported rows enter the production catalog in this
slice. They are not player-authored planner states. Values are listed as I / II
/ III / IV. A dash means the declaration has no Heroic row. The outcome column
is always evaluated from the planner's rank-III player-equip baseline.

| Keepsake            | Rank-sensitive declaration value (I / II / III / IV)                         | Current rank-III outcome when Cherished Heirloom is acquired                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gorgon Amulet       | Athena rarity level 1 / 2 / 3 / 4                                            | Preserve `RemainingUses`. If still pending, the future Athena appearance uses Heroic; if consumed, it remains consumed.                                                        |
| Fig Leaf            | 1 / 2 / 3 / 4 supported biomes                                               | No new persistent Fig Leaf trait and no added use. The rank-IV base declaration is rebuilt, but `DionysusSkipTrait` is not rerun and the separate retained state is untouched. |
| Experimental Hammer | 10 / 15 / 20 / 30 encounter uses                                             | No new Hammer and no extension of the existing Hammer. Its acquire callback is not rerun.                                                                                      |
| Jeweled Pom         | +1 / +2 / +3 / +4 eligible trait levels                                      | The retained prospective bonus becomes +4. No new Hades blessing is granted, and previously acquired traits are not changed.                                                   |
| Calling Card        | 2 / 4 / 6 / 8 rarify uses                                                    | Preserve the old nested use count and add exactly two. This is `remaining + 2`, not a reset to eight.                                                                          |
| Time Piece          | 2 / 3 / 4 / 5 conversion uses                                                | Preserve the old `BoonConversionUses` and add exactly one. This is `remaining + 1`, not a reset to five.                                                                       |
| Transcendent Embryo | Common / Rare / Epic / Heroic Chaos blessing                                 | Keep the current Chaos blessing and preserve `CurrentRoom`. The next eight-room transformation uses the rebuilt Heroic blessing rarity.                                        |
| Aromatic Phial      | target rarity 2 / 3 / 4 / —; one use and +20% fountain healing at every rank | Remains rank III. Its use count is preserved, so Cherished Heirloom produces no effect. The Duo itself is not blocked; the equipped Phial simply has no rank IV.               |
| Concave Stone       | 25% / 50% / 75% / 100%; one use                                              | An unused current Stone becomes 100%. A consumed Stone keeps `Uses = 0`, so it remains consumed.                                                                               |
| Crystal Figurine    | Arcana rank I / II / III / IV; one use                                       | An unused current Figurine changes its pending activation to rank IV. A consumed Figurine preserves its exhausted use state.                                                   |
| Moon Beam           | 3 / 4 / 5 / 7 Path of Stars points                                           | The rank-III to rank-IV transition immediately adds two points. Existing reward priority is not replayed.                                                                      |
| Cloud Bangle        | Zeus rarify cap 1 / 2 / 3 / —; one use                                       | Remains rank III. Reconstruction resets the non-preserved nested use count to one; provider priority is not replayed.                                                          |
| Iridescent Fan      | Hera rarify cap 1 / 2 / 3 / —; one use                                       | Same refill-to-one behavior for Hera.                                                                                                                                          |
| Vivid Sea           | Poseidon rarify cap 1 / 2 / 3 / —; one use                                   | Same refill-to-one behavior for Poseidon.                                                                                                                                      |
| Barley Sheaf        | Demeter rarify cap 1 / 2 / 3 / —; one use                                    | Same refill-to-one behavior for Demeter.                                                                                                                                       |
| Harmonic Photon     | Apollo rarify cap 1 / 2 / 3 / —; one use                                     | Same refill-to-one behavior for Apollo.                                                                                                                                        |
| Beautiful Mirror    | Aphrodite rarify cap 1 / 2 / 3 / —; one use                                  | Same refill-to-one behavior for Aphrodite.                                                                                                                                     |
| Adamant Shard       | Hephaestus rarify cap 1 / 2 / 3 / —; one use                                 | Same refill-to-one behavior for Hephaestus.                                                                                                                                    |
| Everlasting Ember   | Hestia rarify cap 1 / 2 / 3 / —; one use                                     | Same refill-to-one behavior for Hestia.                                                                                                                                        |
| Sword Hilt          | Ares rarify cap 1 / 2 / 3 / —; one use                                       | Same refill-to-one behavior for Ares.                                                                                                                                          |

## Gorgon Amulet Chronology

The Gorgon declaration stores the rank-scaled `RarityLevelBonus` inside its
processed `UniqueEncounterArgs`. When the encounter reaches Athena,
`HandleAthenaSpawn` consumes the pending use and passes those processed args
to `AthenaSpawnPresentation`. That function writes the exact rarity override
onto the spawned Athena unit.

Cherished Heirloom can alter a still-pending Gorgon Amulet because the rebuilt
rank-IV declaration supplies a future `RarityLevelBonus` of four. It cannot
retroactively mutate an Athena child whose spawn arguments were already
processed. Under the planner's room chronology, acquiring Cherished Heirloom
from the same settled encounter as that already-created Gorgon Athena child
therefore leaves the Athena offer at its original rank-III Epic rarity.

If Gorgon Amulet has already consumed its one use, reconstruction restores
`RemainingUses = 0`; Cherished Heirloom does not create a second Athena
appearance.

## Fig Leaf and Experimental Hammer

Both declarations demonstrate why rank IV cannot be modeled as a generic
replacement of all effect state.

Fig Leaf's usable state belongs to the separate
`PersistentDionysusSkipKeepsake` created by `DionysusSkipTrait`. Reconstructing
the equipped base declaration without `FromLoot` does not run that function,
so neither the retained use count nor the biome activation guard changes.

Experimental Hammer likewise creates its actual Hammer trait only in
`GiveDurationHammer`. Reconstructing `TempHammerKeepsake` does not call that
acquisition function. The existing Hammer keeps its existing remaining
duration, and no second Hammer is created.

## Calling Card and Time Piece

These two permanent effects have explicit, different source adjustments.

For Calling Card, `AdvanceKeepsake` snapshots the old nested rarify count,
rebuilds the rank-IV declaration, and then overwrites its default eight with
`old + 2`.

For Time Piece, `BoonConversionUses` participates in the common persistent-key
restore. After restoring the old count, the source adds one. A current Time
Piece with zero, one, or four remaining uses therefore becomes one, two, or
five respectively.

Neither rule applies to retained charges belonging to a no-longer-current
keepsake, because `AdvanceKeepsake` targets only `GameState.LastAwardTrait`.

## Transcendent Embryo

The special advance unequip uses `AdvanceKeepsakeMoment = true`, which avoids
the ordinary Embryo cleanup that would detach the current Chaos blessing.
`CurrentRoom` is restored to the rebuilt source trait, and its acquisition
callback is not replayed, so the current blessing remains unchanged.

When the restored room counter next reaches eight, `CheckChamberTraits` reads
the rebuilt `AcquireFunctionArgs.BlessingRarity`. The subsequent transformed
blessing is therefore Heroic. Cherished Heirloom changes the future
transformation rarity, not the already-equipped blessing.

## Moon Beam and Olympian Keepsakes

Moon Beam has an explicit `AdvanceKeepsake` special case. The source adds one
Path of Stars point after a lower-rank advance, but adds two when
`GetKeepsakeLevel` is four. Under the planner's only modeled transition,
rank III to rank IV, Cherished Heirloom therefore adds two immediately to
`CurrentRun.NumTalentPoints`. It does not call `KeepsakeAcquireSpellDrop`, so
it does not add Selene or Path priority again.

The nine Olympian declarations inherit `BaseBoonUpgradeKeepsake`, which
replaces the default keepsake rarity table with Common, Rare, and Epic rows
only. They have no Heroic row. Cherished Heirloom still forces reconstruction
through `AdvanceKeepsake(true)`, but:

- the rebuilt current keepsake remains Epic;
- `RewardStoreAddPriority` is not replayed because the re-equip is not
  `FromLoot`; and
- the nested provider-specific rarify use is rebuilt at its declaration
  default of one because no common or special persistence path restores it.

The result is a refill to one available rarify use, not an unconditional
addition of one. A still-unused keepsake remains at one; an exhausted one
returns to one. A later newly equipped Olympian keepsake remains rank III and
receives its ordinary single use because that declaration has no rank IV.

## Concave Stone Same-Offer Chronology

The later-offer result is settled: an unused Concave Stone rebuilt at Heroic
has a 100% double-boon chance, while a consumed Stone remains consumed.

If Concave Stone procs first and its randomly selected second boon is Cherished
Heirloom, there is no timing ambiguity. `HandleUpgradeChoiceSelection` spends
Concave Stone's use before recursively acquiring the second boon. Cherished
Heirloom then preserves `Uses = 0`; changing the declaration chance to 100%
cannot replay the roll that already succeeded or grant another second boon.

A different result applies when the player chooses Cherished Heirloom as the
primary option while an unused rank-III Concave Stone is active:

1. `HandleUpgradeChoiceSelection` adds Cherished Heirloom with
   `FromLoot = true` before it checks `DoubleBoonChance`.
2. `AddTraitData` calls `thread(CallFunctionName, ...)` for the Duo's
   acquisition function.
3. `thread` in `Main.lua` immediately calls `coroutine.resume`; it does not
   merely queue the callback for a later frame.
4. `AttemptAdvanceKeepsake` and the Concave-specific
   `AdvanceKeepsake(true)` path contain no `wait`, `waitUntil`, or coroutine
   yield. They therefore finish rebuilding Concave Stone at rank IV before
   the new coroutine returns.
5. The original selection thread then reads the rebuilt live trait through
   `HasHeroTraitValue("DoubleBoonChance")` and observes 100%.

That ordering is material to the planner's possibility model. At rank III,
75% admits both proc and no-proc outcomes. After Cherished Heirloom is selected
first, the same offer's second boon is mandatory under the planner's default
Luck baseline whenever another eligible unpicked option exists. No runtime
probe is required to settle this ordering.

The two same-screen cases are therefore exact and different:

- **Cherished Heirloom selected first:** rebuild Concave to 100%, then require
  its second boon when an eligible unpicked option exists, consuming the use.
- **Concave grants Cherished Heirloom second:** the earlier 75% roll already
  succeeded and the use was consumed before Cherished Heirloom was acquired;
  reconstruction preserves `Uses = 0` and cannot trigger a third boon.

All subsequent eligible offers also observe the upgraded 100% value while the
use remains available.

## Planner Disposition

Cherished Heirloom is implemented for the six supported keepsake effects
without a generic "replace rank III values with rank IV values" mutation. The
implemented source transition has three parts:

1. resolve the current `GameState.LastAwardTrait` only;
2. run that declaration's exact rank-III to rank-IV advance transition while
   preserving its specified state; and
3. resolve later player equips from rank III to rank IV while the boon remains
   active, only for declarations with a rank-IV row.

For Gorgon Amulet, Fig Leaf, Experimental Hammer, Jeweled Pom, Calling Card, and
Time Piece, the catalog owns complete four-rank profiles and one closed
Cherished capability. The engine applies the exact current-effect matrix after
ordinary selected acquisition, resolves later legal equips at rank IV from
canonical trait history, preserves removed ledgers, and snapshots Gorgon rarity
at encounter start. It does not use a callback registry or authored player
ranks.

The remaining audited rows are source evidence, not implemented behavior.
Transcendent Embryo, Aromatic Phial, Concave Stone, Crystal Figurine, Moon Beam,
and the Olympian reward-steering keepsakes retain the dispositions above for
their own future effect slices. Cherished currently gives those effect-neutral
identities no individual gameplay mutation.

## Audit Conclusions

Cherished Heirloom is a rank-III to rank-IV modifier plus an immediate
reconstruction of the current keepsake. Reconstruction deliberately preserves
some state, omits acquisition callbacks, and contains hard-coded exceptions.
That produces the source-backed supported outcomes: pending Gorgon becomes
Heroic, Fig Leaf and Experimental Hammer do nothing, Jeweled Pom becomes +4
prospectively, Calling Card gains two uses, and Time Piece gains one.

The deferred effects are equally explicit: Embryo changes its next
transformation, Phial has no rank IV, unused Concave and Crystal effects become
rank IV, Moon Beam adds two points, and each Olympian keepsake refills its one
nested rarify use without replaying reward priority. Concave Stone granting
Cherished Heirloom as its second boon preserves the already-consumed use. When
Cherished Heirloom is selected first, its no-yield acquisition path upgrades
Concave before the same offer checks it, making that second boon mandatory
whenever an eligible unpicked option exists.
