# Echo Gift Gift Gift Keepsake Audit

## Status

Source audit completed against the installed Hades II scripts on 2026-08-14
and extended across the 13 previously effect-neutral declarations on
2026-08-26. This document isolates the game behavior of Echo's
`EchoRepeatKeepsakeBoon` (Gift Gift Gift) for the keepsakes whose effects are
implemented or deliberately deferred by the planner.

The planner disposition was implemented at schema 35 and commit `5920482`
after the supported-keepsake and Cherished Heirloom phase. The planner owns the
current keepsake identity, ordered replacements, removed keys, all six
supported rank profiles, the captured Gift identity, its replay count, and the
biome-start keepsake-state transition.

This is not an implementation plan. It records source chronology, exact
rank-I replay values, repetition behavior, bounded planner simplifications,
and remaining uncertainties so a later implementation does not need to
rediscover the game path.

## Scope and Rank Boundary

The detailed matrix covers all 33 selectable keepsakes: the six modeled
effects, the four trait/fountain/Arcana effects, the ten reward-steering
effects, and the 13 effects that are strictly sim-neutral under the planner's
current health/Magick/gold/armor/damage/time boundary.

Those 13 rows now record the real source replay even though the implemented
planner transition remains an explicit no-op. They still participate in
ordinary equip/retain/replace history, removed-key and no-return legality,
Fated/Unfated state, and Run State identity. Discordant Bell remains in the
matrix because the game explicitly excludes it from Gift Gift Gift.

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

| Keepsake            | Gift Gift Gift source result                                                                                                                                                                                                                                            | Source repetition                                                                                                                                                              | Planner disposition                                                                                                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Silver Wheel        | Re-equips rank I. If the source-marked maximum-Magick trait from the ordinary equip remains, `EquipKeepsake` rewrites it to +50; otherwise it creates +50.                                                                                                              | First successful replay only; the Common unslotted Silver Wheel remains and blocks another equip.                                                                              | Strictly sim-neutral. Preserve as an audited no-op unless maximum Magick enters the planner.                                                                                                                                                     |
| Knuckle Bones       | Re-equips rank I with one 5% pre-boss damage use and the rank-independent 10% boss-damage reduction.                                                                                                                                                                    | First successful replay only. Spending the hit expires but does not remove the unslotted source.                                                                               | Strictly sim-neutral.                                                                                                                                                                                                                            |
| Luckier Tooth       | Re-equips rank I and adds one 51-health keepsake Last Stand.                                                                                                                                                                                                            | First successful replay only. Spending the restoration leaves the unslotted source present.                                                                                    | Strictly sim-neutral.                                                                                                                                                                                                                            |
| Ghost Onion         | Re-equips rank I with a 50-health room-exit reserve.                                                                                                                                                                                                                    | First successful replay only. Exhaustion leaves the unslotted source present.                                                                                                  | Strictly sim-neutral.                                                                                                                                                                                                                            |
| Evil Eye            | Re-equips rank I with the 20% prior-cause-of-death damage modifier.                                                                                                                                                                                                     | First successful replay only; the unslotted source has no finite use and remains.                                                                                              | Strictly sim-neutral.                                                                                                                                                                                                                            |
| Gold Purse          | Re-equips rank I, then the explicit `BonusMoneyKeepsake` biome-start special case grants 100 gold.                                                                                                                                                                      | First successful replay only; the unslotted source remains after the grant.                                                                                                    | Strictly sim-neutral under the planner's no-gold boundary.                                                                                                                                                                                       |
| Engraved Pin        | Re-equips rank I with the recurring encounter-local ten-second survival window and 30-health successful-clear restoration.                                                                                                                                              | First successful replay only; the unslotted source remains and can continue to act in later encounters.                                                                        | Strictly sim-neutral.                                                                                                                                                                                                                            |
| Discordant Bell     | Explicitly excluded.                                                                                                                                                                                                                                                    | Never eligible.                                                                                                                                                                | No Gift Gift Gift target or replay product.                                                                                                                                                                                                      |
| Metallic Droplet    | Re-equips rank I, starts a 200-second timer, and applies the fixed 20% speed effect while time remains.                                                                                                                                                                 | First successful replay only. Timer expiry marks the source exhausted but does not remove the unslotted trait.                                                                 | Strictly sim-neutral.                                                                                                                                                                                                                            |
| White Antler        | Re-equips rank I with the 30-health cap, 20% critical chance, and one boss-expiration use.                                                                                                                                                                              | First successful replay only. Boss expiration leaves the unslotted source present.                                                                                             | Strictly sim-neutral.                                                                                                                                                                                                                            |
| Silken Sash         | Re-equips rank I, runs ordinary costume setup for 30 armor, and adds 2 armor after qualifying rooms while some source armor remains.                                                                                                                                    | First successful replay only. The declaration is `Invincible`, so armor break leaves its unslotted source present at zero armor.                                               | Strictly sim-neutral.                                                                                                                                                                                                                            |
| Lion Fang           | Re-equips rank I at +30% damage with the ordinary five-point encounter decay.                                                                                                                                                                                           | First successful replay only. Complete decay expires but does not remove the unslotted source.                                                                                 | Strictly sim-neutral.                                                                                                                                                                                                                            |
| Blackened Fleece    | Re-equips rank I with +20% Omega damage after the same 250 total-damage-taken threshold.                                                                                                                                                                                | First successful replay only; the unslotted source remains.                                                                                                                    | Strictly sim-neutral.                                                                                                                                                                                                                            |
| Gorgon Amulet       | Explicitly excluded by `EchoRepeatKeepsakeBoon.GameStateRequirements`.                                                                                                                                                                                                  | Never eligible.                                                                                                                                                                | No Gift Gift Gift target or replay product.                                                                                                                                                                                                      |
| Fig Leaf            | Re-equips rank I and runs `DionysusSkipTrait`, creating another `PersistentDionysusSkipKeepsake` with one biome use.                                                                                                                                                    | First successful replay only; the unslotted `SkipEncounterKeepsake` copy remains and blocks another equip.                                                                     | At the first successful replay, preserve a positive retained use count or restore zero to exactly one, then mark the replay applied even when the numeric count did not change.                                                                  |
| Experimental Hammer | Re-equips rank I and attempts to grant one compatible random Hammer with 10 encounter uses. The source excludes already-equipped Hammer keys, permits a second distinct Hammer while the original remains active, and returns no Hammer when the exact domain is empty. | One-shot equip attempt; the unslotted keepsake source remains even when no Hammer can be granted, so an exhausted attempt does not retry later.                                | Reuse the general Experimental Hammer result: author one Common/10-use compatible Hammer when the domain is nonempty, or an explicit consumed no-result when it is empty. Retain successful grants as distinct independently expiring instances. |
| Jeweled Pom         | Explicitly excluded.                                                                                                                                                                                                                                                    | Never eligible.                                                                                                                                                                | No Gift Gift Gift target or replay product.                                                                                                                                                                                                      |
| Calling Card        | Adds two Common rarity-upgrade uses to the retained effect. If the trait is absent, the re-equip branch first creates an unslotted Common copy with two uses.                                                                                                           | Every biome.                                                                                                                                                                   | Add two remaining rarify uses at every biome start after capture, subject to the ordinary Gift Gift Gift activation frontier.                                                                                                                    |
| Time Piece          | Adds two Common gold-conversion uses to the retained effect. If the trait is absent, the re-equip branch first creates an unslotted Common copy with two uses.                                                                                                          | Every biome.                                                                                                                                                                   | Add two remaining conversion uses at every biome start after capture.                                                                                                                                                                            |
| Transcendent Embryo | Re-equips rank I, grants a Common Chaos blessing, and starts the ordinary eight-room transformation lifecycle at Common rarity.                                                                                                                                         | First successful replay only.                                                                                                                                                  | Deferred effect; retain the exact Common blessing and transformation facts for later implementation.                                                                                                                                             |
| Aromatic Phial      | Explicitly excluded.                                                                                                                                                                                                                                                    | Never eligible.                                                                                                                                                                | No Gift Gift Gift target or replay product.                                                                                                                                                                                                      |
| Concave Stone       | Re-equips rank I with a 25% double-boon chance and one use.                                                                                                                                                                                                             | First successful replay only; spending the use does not remove the replayed keepsake trait through this path.                                                                  | Deferred effect; one Common 25% result, not a recurring refill.                                                                                                                                                                                  |
| Crystal Figurine    | Re-equips rank I with one pending rank-I Arcana activation.                                                                                                                                                                                                             | Reconsidered every biome; spending the pending use removes the unslotted replayed trait, permitting another replay on a later biome.                                           | Deferred effect; evaluate every biome and create another rank-I pending activation only when no Echo-created Figurine remains.                                                                                                                   |
| Moon Beam           | Re-equips rank I, immediately adds three Path of Stars points, and adds the normal Selene-or-Path reward priority.                                                                                                                                                      | First successful replay only while the replayed Moon Beam trait remains.                                                                                                       | Deferred reward steering; both the three-point grant and priority are part of the replay.                                                                                                                                                        |
| Cloud Bangle        | Re-equips rank I, adds Zeus priority, and creates one Zeus-only Common-profile rarify use.                                                                                                                                                                              | Reconsidered every biome; while the replayed trait remains, equip is a no-op. Spending its unslotted rarify use removes that copy, permitting another replay on a later biome. | Deferred reward steering; evaluate every biome, replay only when no Echo-created Cloud Bangle remains.                                                                                                                                           |
| Iridescent Fan      | Same source shape for Hera.                                                                                                                                                                                                                                             | Same conditional every-biome behavior.                                                                                                                                         | Deferred reward steering; provider is Hera.                                                                                                                                                                                                      |
| Vivid Sea           | Same source shape for Poseidon.                                                                                                                                                                                                                                         | Same conditional every-biome behavior.                                                                                                                                         | Deferred reward steering; provider is Poseidon.                                                                                                                                                                                                  |
| Barley Sheaf        | Same source shape for Demeter.                                                                                                                                                                                                                                          | Same conditional every-biome behavior.                                                                                                                                         | Deferred reward steering; provider is Demeter.                                                                                                                                                                                                   |
| Harmonic Photon     | Same source shape for Apollo.                                                                                                                                                                                                                                           | Same conditional every-biome behavior.                                                                                                                                         | Deferred reward steering; provider is Apollo.                                                                                                                                                                                                    |
| Beautiful Mirror    | Same source shape for Aphrodite.                                                                                                                                                                                                                                        | Same conditional every-biome behavior.                                                                                                                                         | Deferred reward steering; provider is Aphrodite.                                                                                                                                                                                                 |
| Adamant Shard       | Same source shape for Hephaestus.                                                                                                                                                                                                                                       | Same conditional every-biome behavior.                                                                                                                                         | Deferred reward steering; provider is Hephaestus.                                                                                                                                                                                                |
| Everlasting Ember   | Same source shape for Hestia.                                                                                                                                                                                                                                           | Same conditional every-biome behavior.                                                                                                                                         | Deferred reward steering; provider is Hestia.                                                                                                                                                                                                    |
| Sword Hilt          | Same source shape for Ares.                                                                                                                                                                                                                                             | Same conditional every-biome behavior.                                                                                                                                         | Deferred reward steering; provider is Ares.                                                                                                                                                                                                      |

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

The chosen planner simplification applies that collapsed transition at the
first succeeding-biome start after Gift acquisition, even though the source's
unslotted `EquipKeepsake` call is phrased in terms of whether the source trait
is still present. The planner does not persist the duplicate source trait; the
one-shot replay marker is the complete replacement for that presence check.

## Experimental Hammer Overlap

`GiveDurationHammer` calls `AddRandomHammer`. That function filters out Hammer
keys already present on the hero, but it does not require the hero to have no
other Hammer. It creates a new trait carrying its own `RemainingUses` and
`UsesAsEncounters` fields.

If the compatible, not-yet-equipped domain is empty, `AddRandomHammer` returns
without creating a Hammer. `EquipKeepsake` has already inserted the rank-I
Experimental Hammer keepsake trait, so that source remains present and blocks a
later replay. The attempt is therefore consumed as a legal no-result rather
than deferred until a Hammer becomes eligible.

The ordinary Experimental Hammer trait can still be active after the player
switches keepsakes. Gift's unslotted rank-I re-equip may therefore add a second
distinct temporary Hammer before the original expires. Both active traits lose
uses at qualifying encounter completions and expire independently.

### Planner disposition

The ordinary, rack, Cherished-contact, and Gift paths must share one exact equip
result: a compatible selected Hammer when the domain is nonempty or an explicit
exhausted result when it is empty. The latter creates no Hammer ledger and does
not mean that authoring is incomplete. The current singular temporary-Hammer
ledger is sufficient only for the successful ordinary one-instance model. Gift
support must replace it with an acquisition-identity-keyed collection and
preserve the existing successful single-Hammer behavior as the one-element
case. A successful Echo replay owns its authored result at the reached
biome-start frontier and starts that instance at the rank-I value of 10 uses.

## Reward-Steering Replay Details

The complete reward-priority, provider-force, materialization, and exact Moon
Beam target rules are owned by the focused
[Olympian keepsake and Moon Beam reward-pressure audit](OLYMPIAN_KEEPSAKE_AND_MOON_BEAM_REWARD_PRESSURE_AUDIT.md).

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

Gift Gift Gift requires an immutable acquisition-time keepsake identity, not a
new rack control. The schema-35 keepsake state supplies the exact current
identity at Echo acquisition and the existing route boundary supplies the
biome-start frontier. The implementation adds only the Gift-owned state that
cannot be derived later:

- the immutable captured keepsake key;
- whether a one-shot replay has occurred;
- the declaration-owned every-biome schedule; and
- the exact keepsake-owned effect product.

For the currently supported set, Gorgon Amulet and Jeweled Pom are source-
excluded, Fig Leaf and Experimental Hammer are one-shot rank-I effects, and
Calling Card and Time Piece add their rank-I values every biome. The 13
sim-neutral identities now have exact source replays in the matrix but still
produce no modeled mutation; other eligible captured identities remain visible
chronological facts until their dedicated effect slice.

It must not derive replay policy from React labels, treat the newly equipped
keepsake as Echo's target, or interpret every keepsake through a generic
callback registry.

## Current Planner Disposition

Schema 35 implements the audited boundary. Gift is unavailable for the four
exact exclusions. A valid selection snapshots the current key on the equipped
rarityless Echo trait, and later rack changes do not retarget it. Fig Leaf and
Experimental Hammer use their one-shot schedules; Calling Card and Time Piece
apply their rank-I value on every succeeding biome. The other eligible
identities remain captured, visible, and effect-neutral in the current planner,
but their exact source replay is now recorded above.

The reached Experimental Hammer replay owns the shared selected-compatible or
explicit exhausted authored result at the succeeding biome-start address.
Successful ordinary and Echo Hammer acquisitions are retained as distinct
instances with independent use counts and expiry. Candidate evaluation,
persistence, findings, workspace interaction, and Run State consume the same
chronological products. No authored captured-key flag outside trait history,
generic effect registry, or React keepsake-key policy was introduced.

## Audit Conclusions

Gift Gift Gift is a captured-identity biome-start effect, not a keepsake-swap
listener. The source stores the acquisition-time keepsake once and continues
to use that key after later switches. The outcome for every one of the 33
possible current keepsakes is now audited: four exclusions, two permanent
refill cases, and the declaration-specific Common re-equip results for every
other eligible identity. The current planner has the exact acquisition and
biome-start contacts needed to own that chronology.

The implementation surface is accurately described by two axes: an exact
biome-start transition and a replay schedule. Fig Leaf, Experimental Hammer,
Transcendent Embryo, Concave Stone, and Moon Beam have one successful Common
replay while their Echo-created source remains. Calling Card and Time Piece
add their Common use counts every biome. Crystal Figurine and the Olympian
keepsakes are reconsidered every biome but replay only after their prior
unslotted source has been consumed and removed. Gorgon Amulet, Jeweled Pom,
Discordant Bell, and Aromatic Phial are source-excluded.

Experimental Hammer adds two structural requirements: every equip supports a
legal consumed no-result when no compatible Hammer exists, and a successful
Gift result may overlap the ordinary temporary Hammer. Distinct successful
acquisition identities and use counters cannot be collapsed into one ledger.
