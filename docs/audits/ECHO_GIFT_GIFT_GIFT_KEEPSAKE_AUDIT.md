# Echo Gift Gift Gift Keepsake Audit

## Status

Source audit completed against the installed Hades II scripts on 2026-08-14.
This document isolates the game behavior of Echo's
`EchoRepeatKeepsakeBoon` (Gift Gift Gift) for the keepsakes whose effects are
implemented or deliberately deferred by the planner.

This is not an implementation plan. It records source chronology, exact
rank-I replay values, repetition behavior, bounded planner simplifications,
and remaining uncertainties so a later implementation does not need to
rediscover the game path.

## Scope and Rank Boundary

The detailed matrix covers:

- the six modeled keepsakes: Gorgon Amulet, Fig Leaf, Experimental Hammer,
  Jeweled Pom, Calling Card, and Time Piece;
- the four lower-priority deferred effects: Transcendent Embryo, Aromatic
  Phial, Concave Stone, and Crystal Figurine; and
- the ten deferred reward-steering keepsakes: Moon Beam and the nine
  Olympian keepsakes.

The 13 intentionally effect-neutral keepsakes remain outside the detailed
effect matrix. They still participate in ordinary equip/retain/replace history,
removed-key and no-return legality, Fated/Unfated state, and Run State identity;
only their inherent and Gift Gift Gift effects are deferred. Discordant Bell is
still mentioned because the game explicitly excludes it from Gift Gift Gift.

The planner always treats an ordinary player-selected keepsake as rank III.
Gift Gift Gift's forced rank-I replay is a distinct, source-created effect; it
does not introduce player-authored keepsake ranks or weaken the rank-III equip
baseline.

## Sources

Primary evidence:

- `TraitData_Echo.lua`: `EchoRepeatKeepsakeBoon`, its offer requirements,
  stored `RepeatedKeepsake`, and acquisition callback;
- `EventLogic.lua`: `EchoRepeatKeepsake`;
- `RoomLogic.lua`: the `BiomeStartRoom` Gift Gift Gift replay block;
- `KeepsakeLogic.lua`: `EquipKeepsake`, `KeepsakeAcquireSpellDrop`, and the
  permanent keepsake behavior used by Calling Card and Time Piece;
- `TraitLogic.lua`: `AddTrait`, `AddTraitData`, `UseHeroTraitsWithValue`, and
  `ReduceTraitUses`;
- `UpgradeChoiceLogic.lua`: source-specific rarify use and removal;
- `PowersLogic.lua`: `DionysusSkipTrait`, `GiveDurationHammer`,
  `ChaosBlessingBonus`, and `AddTalentPoints`; and
- `TraitData_Keepsake.lua`: the scoped keepsake declarations and rank tables.

The broad selection, swap, retention, and rank baseline remains owned by
`KEEPSAKE_GAME_DATA_AUDIT.md`.

## Captured Keepsake Identity

Gift Gift Gift does not watch a later rack transition and does not capture the
keepsake selected at that transition. Its offer requirements first inspect
`GameState.LastAwardTrait` and reject four exact current identities:

- `AthenaEncounterKeepsake` (Gorgon Amulet);
- `HadesAndPersephoneKeepsake` (Jeweled Pom);
- `EscalatingKeepsake` (Discordant Bell); and
- `FountainRarityKeepsake` (Aromatic Phial).

When the boon is acquired, `EchoRepeatKeepsake` immediately verifies that the
current `GameState.LastAwardTrait` is still present on the hero and copies
that key into the boon instance's `RepeatedKeepsake` field. Later keepsake
changes update `GameState.LastAwardTrait`; they do not update
`RepeatedKeepsake`.

Therefore a route that acquires Gift Gift Gift while Fig Leaf is equipped and
then changes to Time Piece continues to replay Fig Leaf. Time Piece is the
ordinary current keepsake; it is not Echo's target.

### Planner disposition

The repeated keepsake is an immutable acquisition-time fact. It must be
captured when Gift Gift Gift is selected and must not be inferred from the
next outgoing keepsake, the next incoming keepsake, or the current keepsake at
a later biome start.

## Biome-Start Replay Algorithm

At every room whose declaration sets `BiomeStartRoom`, `RoomLogic.lua` reads
the stored `RepeatedKeepsake` and follows one of two source branches.

### Permanent retained branch

If the repeated declaration is `Permanent` and that trait is still present,
the source creates processed rank-I (`Common`) data and handles exactly two
keys:

- `GoldifyKeepsake`: add the Common value of two to
  `BoonConversionUses`; and
- `RarifyKeepsake`: add the Common value of two to
  `RarityUpgradeData.Uses`.

The source comment explicitly says these are the only two cases. Jeweled Pom
is also permanent, but it is excluded before Gift Gift Gift can be offered.

### Re-equip branch

Every other case calls `EquipKeepsake` with:

- `ForceRarity = "Common"`;
- `FromLoot = true`;
- `OverwriteSlot = true`; and
- `SkipAddToHUD = true`.

`OverwriteSlot` removes the keepsake slot from the replayed trait data. It does
not replace the player's current keepsake identity. `FromLoot` reruns that
declaration's acquisition callback, which is why immediate products such as a
Hammer, Chaos blessing, reward priority, or Fig Leaf persistent trait are
created again.

`EquipKeepsake` returns without doing anything when the target trait is already
present. Consequently the source loop executes every biome, but an individual
biome-start transition may be a no-op.

## Two Independent Declaration Axes

A faithful planner declaration needs two independent facts:

1. **Biome-start transition:** the keepsake-specific state change attempted at
   a biome start; and
2. **Replay schedule:** whether that transition is allowed only for the first
   successful replay or is reconsidered on every later biome.

"First successful replay" means the first biome start at which the captured
keepsake is no longer present and the source can actually create its Common
copy. Retaining the captured keepsake through a biome does not consume that
replay.

An every-biome schedule does not imply an unconditional mutation. The
transition may still return no change while its source trait or effect remains
present.

## Scoped Effect Matrix

| Keepsake            | Gift Gift Gift source result                                                                                                                                   | Source repetition                                                                                                                                                              | Planner disposition                                                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gorgon Amulet       | Explicitly excluded by `EchoRepeatKeepsakeBoon.GameStateRequirements`.                                                                                         | Never eligible.                                                                                                                                                                | No Gift Gift Gift target or replay product.                                                                                                                                     |
| Fig Leaf            | Re-equips rank I and runs `DionysusSkipTrait`, creating another `PersistentDionysusSkipKeepsake` with one biome use.                                           | First successful replay only; the unslotted `SkipEncounterKeepsake` copy remains and blocks another equip.                                                                     | At the first successful replay, preserve a positive retained use count or restore zero to exactly one, then mark the replay applied even when the numeric count did not change. |
| Experimental Hammer | Re-equips rank I and grants one compatible random Hammer with 10 encounter uses.                                                                               | First successful replay only; expiry removes the granted Hammer, not the unslotted keepsake source.                                                                            | Author one Common/10-use replay Hammer at the first successful replay. Do not recreate it in every later biome.                                                                 |
| Jeweled Pom         | Explicitly excluded.                                                                                                                                           | Never eligible.                                                                                                                                                                | No Gift Gift Gift target or replay product.                                                                                                                                     |
| Calling Card        | Adds two Common rarity-upgrade uses to the retained effect. If the trait is absent, the re-equip branch first creates an unslotted Common copy with two uses.  | Every biome.                                                                                                                                                                   | Add two remaining rarify uses at every biome start after capture, subject to the ordinary Gift Gift Gift activation frontier.                                                   |
| Time Piece          | Adds two Common gold-conversion uses to the retained effect. If the trait is absent, the re-equip branch first creates an unslotted Common copy with two uses. | Every biome.                                                                                                                                                                   | Add two remaining conversion uses at every biome start after capture.                                                                                                           |
| Transcendent Embryo | Re-equips rank I, grants a Common Chaos blessing, and starts the ordinary eight-room transformation lifecycle at Common rarity.                                | First successful replay only.                                                                                                                                                  | Deferred effect; retain the exact Common blessing and transformation facts for later implementation.                                                                            |
| Aromatic Phial      | Explicitly excluded.                                                                                                                                           | Never eligible.                                                                                                                                                                | No Gift Gift Gift target or replay product.                                                                                                                                     |
| Concave Stone       | Re-equips rank I with a 25% double-boon chance and one use.                                                                                                    | First successful replay only; spending the use does not remove the replayed keepsake trait through this path.                                                                  | Deferred effect; one Common 25% result, not a recurring refill.                                                                                                                 |
| Crystal Figurine    | Re-equips rank I with one pending rank-I Arcana activation.                                                                                                    | Reconsidered every biome; spending the pending use removes the unslotted replayed trait, permitting another replay on a later biome.                                           | Deferred effect; evaluate every biome and create another rank-I pending activation only when no Echo-created Figurine remains.                                                  |
| Moon Beam           | Re-equips rank I, immediately adds three Path of Stars points, and adds the normal Selene-or-Path reward priority.                                             | First successful replay only while the replayed Moon Beam trait remains.                                                                                                       | Deferred reward steering; both the three-point grant and priority are part of the replay.                                                                                       |
| Cloud Bangle        | Re-equips rank I, adds Zeus priority, and creates one Zeus-only Common-profile rarify use.                                                                     | Reconsidered every biome; while the replayed trait remains, equip is a no-op. Spending its unslotted rarify use removes that copy, permitting another replay on a later biome. | Deferred reward steering; evaluate every biome, replay only when no Echo-created Cloud Bangle remains.                                                                          |
| Iridescent Fan      | Same source shape for Hera.                                                                                                                                    | Same conditional every-biome behavior.                                                                                                                                         | Deferred reward steering; provider is Hera.                                                                                                                                     |
| Vivid Sea           | Same source shape for Poseidon.                                                                                                                                | Same conditional every-biome behavior.                                                                                                                                         | Deferred reward steering; provider is Poseidon.                                                                                                                                 |
| Barley Sheaf        | Same source shape for Demeter.                                                                                                                                 | Same conditional every-biome behavior.                                                                                                                                         | Deferred reward steering; provider is Demeter.                                                                                                                                  |
| Harmonic Photon     | Same source shape for Apollo.                                                                                                                                  | Same conditional every-biome behavior.                                                                                                                                         | Deferred reward steering; provider is Apollo.                                                                                                                                   |
| Beautiful Mirror    | Same source shape for Aphrodite.                                                                                                                               | Same conditional every-biome behavior.                                                                                                                                         | Deferred reward steering; provider is Aphrodite.                                                                                                                                |
| Adamant Shard       | Same source shape for Hephaestus.                                                                                                                              | Same conditional every-biome behavior.                                                                                                                                         | Deferred reward steering; provider is Hephaestus.                                                                                                                               |
| Everlasting Ember   | Same source shape for Hestia.                                                                                                                                  | Same conditional every-biome behavior.                                                                                                                                         | Deferred reward steering; provider is Hestia.                                                                                                                                   |
| Sword Hilt          | Same source shape for Ares.                                                                                                                                    | Same conditional every-biome behavior.                                                                                                                                         | Deferred reward steering; provider is Ares.                                                                                                                                     |

## Fig Leaf Duplicate Semantics

The source does not merge duplicate persistent Fig Leaf traits. It creates a
new Common `PersistentDionysusSkipKeepsake`. `HasHeroTraitValue` observes the
first matching trait, while `UseHeroTraitsWithValue("SkipEncounterChance")`
decrements every matching persistent trait on a successful skip. A one-use
Echo copy therefore expires on the same first successful skip that also
decrements the older retained copy.

For the planner's deterministic model, the number of future successful skips
after the replay is therefore equivalent to:

```text
max(existing remaining biome uses, 1)
```

The planner may collapse the duplicate traits into that one count, but it must
also record that Echo's Fig Leaf replay has occurred. Otherwise a numerically
unchanged positive count could incorrectly receive another refill after later
consumption.

## Reward-Steering Replay Details

Moon Beam's Common acquisition callback immediately increments
`CurrentRun.NumTalentPoints` by three and then adds either Selene priority or,
if Selene has already appeared, Path of Stars priority. Both behaviors are
replayed because the Echo equip uses `FromLoot = true`.

Each Olympian keepsake inherits `BaseBoonUpgradeKeepsake`, whose rank table has
only Common, Rare, and Epic rows. Gift Gift Gift always forces Common anyway.
The Common copy:

- reruns `RewardStoreAddPriority` for its exact provider;
- carries one source-specific `RarityUpgradeData.Uses`; and
- can rarify only within the Common-profile cap.

When that unslotted use is spent, `UpgradeChoiceLogic.lua` removes the
replayed trait. That removal is what permits a later biome-start replay. The
source does not grant a fresh use every biome while an earlier Echo copy still
exists.

## Planner Boundary

Gift Gift Gift requires previous-keepsake identity even though the base Echo
implementation can remain independent of ordinary rack UI. A later plan must
own:

- the immutable captured keepsake key;
- the first biome-start frontier after each rack transition;
- whether the first successful replay has occurred;
- any every-biome transition state; and
- the exact keepsake-owned effect product.

It must not derive replay policy from React labels, treat the newly equipped
keepsake as Echo's target, or interpret every keepsake through a generic
callback registry.

## Audit Conclusions

Gift Gift Gift is a captured-identity biome-start effect, not a keepsake-swap
listener. The source stores the acquisition-time keepsake once and continues
to use that key after later switches.

The implementation surface is accurately described by two axes: an exact
biome-start transition and a replay schedule. Fig Leaf, Experimental Hammer,
Transcendent Embryo, Concave Stone, and Moon Beam have one successful Common
replay while their Echo-created source remains. Calling Card and Time Piece
add their Common use counts every biome. Crystal Figurine and the Olympian
keepsakes are reconsidered every biome but replay only after their prior
unslotted source has been consumed and removed. Gorgon Amulet, Jeweled Pom,
Discordant Bell, and Aromatic Phial are source-excluded.
