# Keepsake Game-Data Audit

## Status

Source-fact audit completed against the installed Hades II scripts on
2026-08-12, amended on 2026-08-13 with the exact encounter-use decrement
boundary, and amended on 2026-08-14 with Experimental Hammer's exhausted equip
result. A focused 2026-08-23 reread against installed Steam build `24556151`
corrected the NonCombat/`SkipEndEncounterEffects` boundary and confirmed P Fig
Leaf propagation. This document records the ordinary keepsake inventory, rank
model, equip/swap lifecycle, and the effect surfaces that may contact systems
already modeled by the planner.

This is not an implementation plan. It records the source-backed first effect
frontier, but it does not choose a persisted schema, editor layout, module
shape, delivery sequence, or commit gates.

## Sources

Primary evidence:

- `KeepsakeData.lua`
- `KeepsakeLogic.lua`
- `TraitData_Keepsake.lua`
- `RewardLogic.lua`
- `GiftLogic.lua`
- `InteractLogic.lua`
- `StoreLogic.lua`
- `ResourceLogic.lua`
- `RoomLogic.lua`
- `EncounterLogic.lua`
- `EncounterData.lua` and the biome/challenge/NPC encounter declarations
- `TraitLogic.lua`
- `CombatLogic.lua`
- `PowersLogic.lua`
- `UpgradeChoiceLogic.lua`
- `LootData.lua` and `LootData_Selene.lua`
- `ConsumableData.lua`
- `LootData_Hermes.lua`
- `NPCData_Artemis.lua`, `NPCData_Athena.lua`, `NPCData_Dionysus.lua`, and
  `NPCData_Hades.lua`
- `MetaUpgradeData.lua`
- `MetaUpgradeLogic.lua`
- `WorldUpgradeData.lua`
- `ObstacleData.lua`
- `RoomDataF.lua`, `RoomDataG.lua`, and `RoomDataH.lua`
- `RoomDataN.lua`, `RoomDataO.lua`, and `RoomDataP.lua`
- English `TraitText.en.sjson`

Profile unlock requirements, relationship progression, special bounty
loadouts, and the Crossroads presentation are adjacent systems. They are not
ordinary in-run keepsake selection rules and are not expanded here.

## Core Runtime Authorities

The game separates four facts that should not be conflated:

| Fact                      | Game authority                                          | Meaning                                                                            |
| ------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| current selection         | `GameState.LastAwardTrait`                              | the keepsake occupying the keepsake slot                                           |
| unavailable after removal | `CurrentRun.BlockedKeepsakes`                           | keepsakes that cannot be selected again during this run                            |
| exhausted current effect  | `CurrentRun.ExpiredKeepsakes`                           | an effect-use marker; this is not the re-equip exclusion set                       |
| retained effect state     | hero traits, reward priorities, and effect-owned fields | state created by a keepsake that may not be reducible to the current slot identity |

`CurrentRun.BlockedKeepsakes` is the authority for the ordinary "once removed,
gone for the run" rule. `CurrentRun.ExpiredKeepsakes` instead records effects
whose uses have been exhausted. The rack and encounter code consult these
collections for different purposes.

## Ordinary Equip and Swap Lifecycle

### Run start

The selected keepsake is stored in `GameState.LastAwardTrait`. Run
initialization equips that keepsake onto the hero and adds it to the run's
keepsake cache. A run can begin with no selected keepsake if the profile has no
last selection. The planner deliberately narrows this source possibility: every
authored route must begin with exactly one keepsake.

The Crossroads rack is a free-swap context. Changes there establish the
starting selection and do not consume an in-run swap opportunity or block the
previous selection.

### Postboss swap frontiers

The ordinary in-run rack is placed in the postboss rooms after F, G, and H on
the Underworld route and after N, O, and P on the Surface route. Its presence
is unlocked by `WorldUpgradePostBossGiftRack`. In ordinary play, that makes it
a choice for the next biome, even though the physical interaction occurs in
the preceding biome's postboss room.

The timing is exact: the player enters the postboss room with the keepsake used
through the preceding biome and boss still equipped. The rack interaction then
creates an in-room transition. On closing the rack after a change, the game
unequips the old keepsake and immediately equips the new one. Immediate equip
effects and any Fated transition occur in that postboss room, not at entry to
the next biome.

Consequently:

- boss-completion and postboss-entry effects observe the old keepsake;
- nonpersistent old effects end only when the rack swap is committed;
- retained old effects continue according to their own lifetime;
- Jeweled Pom, Experimental Hammer, and other immediate equip products are
  created at the rack interaction; and
- later actions in the postboss room and the next biome observe the new
  keepsake and any newly created retained effects.

The planner preserves this distinction through the reached nonfinal Postboss
completion's shared Room Action order. The required fountain and optional rack
interaction are ranked independently, so the exact source prefix determines
whether the fountain observes the carried Boss keepsake or the newly equipped
replacement. Boss completion and Postboss entry still see the old keepsake;
immediate equip results occur only when the ranked rack action executes. Retain
means that the optional rack participant is absent, while replacement adds it
atomically. The action belongs to the exact completion owner rather than a
synthetic room or a second keepsake chronology.

At a normal rack the player can:

- retain the current keepsake by closing the rack without changing it; or
- select one different, currently unblocked keepsake.

After a change, the rack locks for that postboss room and appends the old key to
`CurrentRun.BlockedKeepsakes`. The old keepsake is disabled in every later rack
for the same run. Retaining a keepsake through several postboss frontiers does
not block it.

The normal rack has no explicit "unequip to none" action. The planner's required
starting selection means every later ordinary postboss rack action either
retains the current keepsake or replaces it with another keepsake.

### Route-level invariant

For an ordinary four-biome route, the resulting selection history is one
mandatory pre-route equip followed by up to three postboss replacement events.
There is exactly one current keepsake on both sides of every event, with these
constraints:

1. the current key may be retained across any number of postboss frontiers;
2. a postboss frontier may replace it with a key not previously removed this
   run;
3. replacing a key permanently excludes that key from later selections; and
4. the final biome has no later frontier at which another ordinary selection
   matters.

Associating one selected key with each biome is a useful projection, but it is
not the source chronology. The preceding postboss room has the old keepsake on
entry, then the retained or newly equipped keepsake at the ranked rack action
when replacement is selected. The next biome begins with the post-swap
selection already active.

Special free-swap rooms, packaged bounties that randomize the rack, and saved
starting-keepsake profile features are separate modes. They do not alter the
ordinary route invariant above.

## Rank and Progression

All selectable keepsakes inherit the keepsake slot and the default chamber
thresholds from `GiftTrait`. Ordinary profile progression begins at rank I,
reaches rank II after 25 credited chambers, and reaches rank III after another
50 credited chambers. `AdvanceKeepsake` credits the currently equipped
keepsake as rooms complete and reconstructs it when a threshold is crossed
while preserving named runtime fields.

The game's runtime rarity vocabulary for keepsake ranks is
`Common`/`Rare`/`Epic`. Some declarations also provide a `Heroic` scaling row;
`KeepsakeLevelBonus` can temporarily raise an equipped keepsake above its
ordinary profile rank. Rank changes the scalar or count owned by each
declaration, not the legal swap sequence.

Therefore identity-only modeling can be independent of ranks. The planner uses
a fixed max-profile-rank baseline: every keepsake is rank III (`Epic`). It does
not author per-keepsake ranks or simulate chamber progression. Temporary
Heroic scaling from `KeepsakeLevelBonus` remains outside the modeled baseline.

Two focused companion audits preserve the exact source behavior needed to add
those later effects without reopening the broad inventory investigation:

- [Echo Gift Gift Gift keepsake audit](ECHO_GIFT_GIFT_GIFT_KEEPSAKE_AUDIT.md);
  and
- [Cherished Heirloom keepsake audit](CHERISHED_HEIRLOOM_KEEPSAKE_AUDIT.md).

## Selectable Inventory

The rack declares 33 selectable keepsakes. The table records player-facing
behavior and the game-system contact that would matter if that effect were
modeled. Scalar tuning is intentionally left in the source declarations until
an effect is selected for implementation.

| Game key                      | Label               | Source-backed effect                                                                                                                           | Primary system contact                                              |
| ----------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `ManaOverTimeRefundKeepsake`  | Silver Wheel        | immediately grants maximum Magick, scaled by rank                                                                                              | player resource only                                                |
| `BossPreDamageKeepsake`       | Knuckle Bones       | damages the next boss before combat and reduces damage taken from bosses                                                                       | combat only                                                         |
| `ReincarnationKeepsake`       | Luckier Tooth       | adds one keepsake-owned death restoration                                                                                                      | Death Defiance / combat                                             |
| `DoorHealReserveKeepsake`     | Ghost Onion         | fully heals on room exit while consuming a finite run-wide healing reserve                                                                     | room exit and health                                                |
| `DeathVengeanceKeepsake`      | Evil Eye            | increases damage against the enemy recorded as the last cause of death                                                                         | prior-run profile and combat                                        |
| `BonusMoneyKeepsake`          | Gold Purse          | grants an immediate amount of gold                                                                                                             | currency                                                            |
| `BlockDeathKeepsake`          | Engraved Pin        | on the first zero-health event, grants a timed survival window and restores health if the encounter is cleared                                 | combat and Death Defiance-adjacent state                            |
| `EscalatingKeepsake`          | Discordant Bell     | after each encounter, increases both damage dealt and damage received for the rest of the run                                                  | encounter counter and combat                                        |
| `TimedBuffKeepsake`           | Metallic Droplet    | grants a real-time movement, attack, and channel-speed buff                                                                                    | real time and combat                                                |
| `LowHealthCritKeepsake`       | White Antler        | grants critical chance for the next biome while imposing a maximum-health cap                                                                  | biome boundary and combat                                           |
| `SpellTalentKeepsake`         | Moon Beam           | prioritizes a Selene reward before one has been taken, then prioritizes Path of Stars rewards; the next Path of Stars grants extra upgrades    | reward priority and Hex progression                                 |
| `ForceZeusBoonKeepsake`       | Cloud Bangle        | prioritizes a Zeus boon and permits one Zeus offer rarity upgrade                                                                              | reward source and trait rarity                                      |
| `ForceHeraBoonKeepsake`       | Iridescent Fan      | prioritizes a Hera boon and permits one Hera offer rarity upgrade                                                                              | reward source and trait rarity                                      |
| `ForcePoseidonBoonKeepsake`   | Vivid Sea           | prioritizes a Poseidon boon and permits one Poseidon offer rarity upgrade                                                                      | reward source and trait rarity                                      |
| `ForceDemeterBoonKeepsake`    | Barley Sheaf        | prioritizes a Demeter boon and permits one Demeter offer rarity upgrade                                                                        | reward source and trait rarity                                      |
| `ForceApolloBoonKeepsake`     | Harmonic Photon     | prioritizes an Apollo boon and permits one Apollo offer rarity upgrade                                                                         | reward source and trait rarity                                      |
| `ForceAphroditeBoonKeepsake`  | Beautiful Mirror    | prioritizes an Aphrodite boon and permits one Aphrodite offer rarity upgrade                                                                   | reward source and trait rarity                                      |
| `ForceHephaestusBoonKeepsake` | Adamant Shard       | prioritizes a Hephaestus boon and permits one Hephaestus offer rarity upgrade                                                                  | reward source and trait rarity                                      |
| `ForceHestiaBoonKeepsake`     | Everlasting Ember   | prioritizes a Hestia boon and permits one Hestia offer rarity upgrade                                                                          | reward source and trait rarity                                      |
| `ForceAresBoonKeepsake`       | Sword Hilt          | prioritizes an Ares boon and permits one Ares offer rarity upgrade                                                                             | reward source and trait rarity                                      |
| `AthenaEncounterKeepsake`     | Gorgon Amulet       | while the player has no Death Defiance, may create one Athena encounter with a rank-scaled boon-rarity bonus                                   | encounter eligibility, local Death Defiance, and trait rarity       |
| `SkipEncounterKeepsake`       | Fig Leaf            | creates a run-persistent chance to skip one eligible encounter in each of a rank-scaled number of biomes                                       | encounter topology and biome-local usage                            |
| `ArmorGainKeepsake`           | Silken Sash         | grants armor and adds armor after rooms while any armor remains                                                                                | room completion and combat resources                                |
| `FountainRarityKeepsake`      | Aromatic Phial      | improves fountain healing and upgrades one eligible Common boon when the next fountain is used                                                 | fountain interaction and equipped-trait rarity                      |
| `UnpickedBoonKeepsake`        | Concave Stone       | after choosing eligible god loot, may also grant one random unpicked non-replacement option, once                                              | trait-offer composition and acquisition history                     |
| `DecayingBoostKeepsake`       | Lion Fang           | starts with a damage bonus that decays after each encounter                                                                                    | encounter counter and combat                                        |
| `DamagedDamageBoostKeepsake`  | Blackened Fleece    | after accumulating a damage threshold, increases Omega damage                                                                                  | damage history and combat                                           |
| `BossMetaUpgradeKeepsake`     | Crystal Figurine    | after the next boss, activates two random inactive Arcana cards at a rank-scaled Arcana rarity                                                 | boss transition and Arcana state                                    |
| `TempHammerKeepsake`          | Experimental Hammer | grants one random compatible Hammer trait for a rank-scaled encounter duration                                                                 | weapon/aspect compatibility, equipped traits, and encounter counter |
| `HadesAndPersephoneKeepsake`  | Jeweled Pom         | immediately grants a random Hades blessing and adds levels to most subsequently acquired eligible boons; its effect is retained after swapping | trait acquisition, trait levels, and retained effect state          |
| `RarifyKeepsake`              | Calling Card        | permits a rank-scaled number of rarity upgrades on eligible god-loot offers; unused uses are retained after swapping                           | trait-offer rarity and retained effect state                        |
| `GoldifyKeepsake`             | Time Piece          | permits a rank-scaled number of eligible reward conversions into gold; unused uses are retained after swapping                                 | reward conversion, currency, and retained effect state              |
| `RandomBlessingKeepsake`      | Transcendent Embryo | grants a random Chaos blessing at rank-scaled rarity and replaces it after a fixed encounter interval                                          | equipped traits and encounter counter                               |

`PersistentDionysusSkipKeepsake` is not a rack item. It is the separate
run-persistent trait created by Fig Leaf and is therefore excluded from the 33
selectable declarations.

## Selection and Effect Lifetime Are Different

Most keepsakes are removed from the hero when swapped, but this is not a
universal effect-lifetime rule.

### Declaration-owned retained effects

Four selectable declarations are explicitly `Permanent`:

- Discordant Bell;
- Calling Card;
- Jeweled Pom; and
- Time Piece.

At an ordinary swap, `UnequipKeepsake` removes their keepsake-slot presentation
but normally leaves the trait and its accumulated/remaining effect in the run.
Calling Card and Time Piece are discarded instead when their relevant uses are
already exhausted. Fig Leaf separately materializes
`PersistentDionysusSkipKeepsake`, whose remaining biome uses survive changing
the equipped slot.

Some other keepsakes install effects into another run authority when equipped.
For example, the god keepsakes and Moon Beam add reward priorities, while the
temporary-Hammer and random-Chaos keepsakes create equipped trait state. A
future effect model must follow the declaration's actual output rather than
assuming every effect can be recomputed from the current keepsake key.

### Exhaustion is not removal

One-use and finite-use effects can become inactive while their keepsake remains
selected. `CurrentRun.ExpiredKeepsakes` records that state for presentation and
for effect-specific conditions. Closing a later rack clears this expiration
collection, while `CurrentRun.BlockedKeepsakes` continues to enforce the
run-wide no-re-equip rule.

The legal selection timeline therefore needs only current and removed
identities. Any selected effect that has uses, targets, generated traits,
accumulated counters, or post-swap persistence needs its own canonical runtime
fact in the owning system.

## Effect Contact Map

The inventory falls into four implementation-independent contact groups:

1. **Loadout identity only.** Every declaration can participate in the legal
   initial-equip/postboss-swap history even if its effect is not simulated.
2. **Already modeled domain contact.** God priorities, rarity upgrades, extra
   boon selection, Hades/Chaos/Hammer traits, Arcana activation, Athena
   encounter generation, and Fig Leaf encounter skipping touch existing
   reward, trait, Arcana, encounter, or counter authorities.
3. **Partially modeled contact.** Death restoration, fountains, Selene
   progression, gold, and reward conversion have adjacent planner concepts but
   not necessarily the full game subsystem needed by the keepsake.
4. **Combat-only or real-time effects.** Damage, health, armor, speed, and
   prior-death combat modifiers can remain inert declarations without changing
   keepsake selection legality.

This grouping is descriptive. It does not select the first supported effect
set.

## Planner Disposition

The planner will distinguish keepsake-history coverage from effect coverage.
All 33 selectable declarations are relevant to the initial-equip/postboss-swap
timeline, including declarations whose gameplay effect is not simulated.
Selecting an identity-only keepsake records its active interval and
participates in retain, replace, and no-return legality without inventing a
trait, counter, reward mutation, or other effect.

### First effect group

The first effect-modeling frontier consists of six declarations:

| Game key                     | Label               | Reason it is structurally relevant                                                  |
| ---------------------------- | ------------------- | ----------------------------------------------------------------------------------- |
| `HadesAndPersephoneKeepsake` | Jeweled Pom         | creates a Hades trait and changes subsequent eligible trait levels                  |
| `GoldifyKeepsake`            | Time Piece          | changes eligible reward settlement into a bounded player choice                     |
| `RarifyKeepsake`             | Calling Card        | changes offered trait rarity through bounded actions on exact option rows           |
| `SkipEncounterKeepsake`      | Fig Leaf            | changes encounter execution and retains biome-scoped uses after the slot is changed |
| `AthenaEncounterKeepsake`    | Gorgon Amulet       | creates a conditional Athena encounter and rarity-modified trait acquisition        |
| `TempHammerKeepsake`         | Experimental Hammer | creates a weapon/aspect-compatible temporary trait with encounter-counted duration  |

These effects should retain the domain ownership identified by the inventory
and lifetime sections. They are not six variations of one generic keepsake
effect.

All six have rank-sensitive behavior in the game: Jeweled Pom changes its level
bonus, Time Piece and Calling Card change their use counts, Fig Leaf changes
its biome-use count, Gorgon Amulet changes its boon-rarity bonus, and
Experimental Hammer changes its encounter duration. Their modeled effects use
the fixed rank-III values; there is no rank choice in authored route state.

### Fated keepsake effect lifecycles

The fixed rank-III baseline gives the three Fated-enabling keepsakes these
exact effect products.

Because all three declarations are permanent, their live effects can overlap.
For example, a route can equip Jeweled Pom, later replace it with Time Piece,
and later replace Time Piece with Calling Card while retaining the earlier
unconsumed effects. The first transition to `Unfated` invalidates every
remaining Fated effect together.

#### Jeweled Pom

On equip, Jeweled Pom grants one eligible random Hades trait. The game marks
that trait as granted by the keepsake. While the Jeweled Pom effect remains
active, each newly acquired eligible trait receives three additional levels at
offer construction. The bonus is prospective: it does not add levels to traits
that were already equipped before the effect became active.

Jeweled Pom is `Permanent`. Replacing it with a neutral keepsake removes its
slot presentation but retains both the granted Hades trait and the level bonus
for subsequent eligible acquisitions. If the route becomes `Unfated`, the game
removes the granted Hades trait and ends the level bonus. Traits that already
received the three levels retain those levels; the invalidation does not roll
back prior trait-history events.

The planner can model the random Hades result as an authored choice from the
eligible Hades domain at equip time. The +3 is derived acquisition behavior
while the retained effect is active, not a mutation of every later authored
offer.

#### Time Piece

At rank III, Time Piece creates four conversion charges. A charge permits the
player to replace an eligible reward object with gold instead of acquiring its
normal effect. Eligibility is declaration-owned through
`GoldConversionEligible`, subject to the object's other source checks. It
includes broad loot rewards and selected consumable pickups; it is not limited
to ordinary room-reward doors.

Time Piece is `Permanent`. Unused charges survive replacing it with a neutral
keepsake. Becoming `Unfated` sets all remaining charges to zero. Conversions
already made remain settled.

The planner does not simulate gold. Its supported conversion result can
therefore be: consume one charge and suppress the selected eligible
acquisition. The converted room reward or pickup remains authored evidence of
what appeared, but it contributes no ordinary acquisition, trait, level, or
loot-history effect. This is an explicit player choice on an eligible
acquisition, not the automatic first-room-reward behavior of Vow of Forfeit.

The choice belongs to the exact reached acquisition role, not to the enclosing
room or resolved offer as one indivisible flag. Most rewards expose one role.
Devotion deliberately exposes two: its distinct chosen god is reached before
combat and its distinct spurned god after combat. Both underlying god rewards
are gold-conversion eligible, so either or both roles may be converted. Two
conversions consume two charges in lifecycle order. Converting one role does
not change the authored Devotion pair, the other god's identity, or the
encounter lifecycle; it only makes that role's trait choice and concrete
acquisition dormant. This means Devotion uses the shared conversion rule and
does not require a keepsake-specific encounter exception.

For an eligible mandatory acquisition, the authored disposition is normal
acquisition or conversion. For an eligible optional pickup, absence remains a
third state alongside picked up normally and picked up as gold. Paid Shop
objects fail the game's resource-cost guard and therefore expose no conversion
choice. Progressive evaluation derives availability from the effective Fated
state and remaining ordered charge count at each exact acquisition role.

The source capability predicate has three independent parts:

1. the reached world object has `GoldConversionEligible` after declaration
   inheritance and runtime overrides;
2. the reached object has no positive `ResourceCosts`; and
3. Fated remains valid and at least one conversion use remains.

The special interaction must also be available on that exact reached world
object. This is a separate lifecycle fact from the three capability checks: a
resolved acquisition can carry an eligible declaration without exposing an
independent player interaction at which Time Piece can be used.

This is object capability, not a reward-category inference. `BaseLoot` supplies
the capability to ordinary Olympian/Hermes loot, Poms, Hammers, and Chaos loot;
`SpellDrop` declares it directly. The supported consumable declarations that
carry it are the max-health family, max-Magick family, Path of Stars family,
`LastStandDrop`, and the armor family. `BaseMetaRoomReward` supplies it to the
ordinary Nectar, Bones, Ashes, and their large variants represented by the
planner. `RoomRewardConsolationPrize` is also eligible in the game, but the
planner does not currently model that acquisition.

The following currently modeled identities do not carry the source capability:
gold itself, the ordinary health-restoration drops other than the separately
eligible `RoomRewardConsolationPrize`, elemental essences, Pom Slices,
`ChaosWeaponUpgrade`, the Blind Box object, and the super-resource family such
as Nightmare, Moon Dust, and Obol Points. `InfernalContractBoon` is granted
directly rather than through an eligible reward object.

Blind Box remains non-convertible from both supported sources. A Shop box is
paid and lacks the capability. Narcissus creates a free optional box, proving
that zero cost alone is insufficient: the box still lacks
`GoldConversionEligible`. Interacting with either box unwraps a god-loot object
and immediately auto-activates it, so the resolved `hiddenSource` has no
separate Time Piece interaction window even though the underlying god-loot
declaration carries the capability. Neither the `box` nor `hiddenSource` role
therefore exposes a conversion disposition.

Likewise, an NPC trait menu is not made convertible merely because its provider
is treated as god loot for rarity UI. Time Piece follows the concrete spawned
reward object's capability. Calling Card follows a different menu-source
predicate described below. The planner must therefore normalize conversion
capability on the exact producer role or concrete acquisition, rather than
derive it from a resolved god key alone.

Runtime cost is the final discriminator for declarations used in more than one
context. An otherwise eligible room reward or free pickup can be converted;
the same declaration instantiated as a paid Shop object cannot. The planner's
currently modeled Shop purchases are paid and therefore excluded. No separate
Shop exception is needed beyond preserving that instance fact. The source room
reward path instantiates consumables with a zero cost, which makes
`HasResourceCost` false; Shop instantiation supplies the positive cost that
blocks conversion.

#### Calling Card

At rank III, Calling Card creates six rarity-upgrade charges. On a qualifying
trait-selection menu, the player may spend a charge to raise an eligible option
by one rarity step. The charge is spent when the option is rarified; the player
does not have to select that option afterward. Multiple charges may be used
across the run until exhausted. Because Calling Card declares `MultiUse`, the
same offered option can be rarified repeatedly while it has a supported next
rarity and charges remain.

Calling Card is `Permanent`. Unused charges survive replacing it with a neutral
keepsake. Becoming `Unfated` sets all remaining charges to zero. Rarity changes
already authored on earlier offers remain historical facts, whether the
rarified option was selected or left unpicked.

The final option rarity does not by itself prove that Calling Card was used:
the option may have rolled at that rarity naturally. Post-roll rarification is
a separate player action and must remain distinguishable even on an unpicked
row. This effect belongs to trait-offer authoring and assessment. Its charge
ledger must observe explicit rarification actions across all authored offer
rows, not only selected trait acquisitions.

Calling Card's menu-source predicate is closed in the game. The source must be
marked `GodLoot` or `TreatAsGodLootByShops`, and it must not declare
`ExcludeFromLastRunBoon`. Against the providers currently modeled by the
planner, this admits:

- the nine core Olympians;
- Hermes;
- Artemis;
- Athena; and
- Dionysus.

Hades is explicitly excluded even though his provider is otherwise treated as
god loot. Hammer, Pom, Icarus, Circe, Medea, Narcissus, and Arachne offers do
not satisfy the menu-source predicate. This provider set matches the existing
planner rarity-capability frontier; it must be declared once rather than
reconstructed from UI labels or the mere presence of a rarity field.

Within a qualifying menu, an individual option can be rarified only when the
offered trait does not set `BlockMenuRarify`, has a next rarity in the global
rarity order, and declares a value for that next rarity. Calling Card's
`MaxRarity = 3` and the next-rarity checks allow repeated actions through
Heroic but never beyond it. Replacement, Duo, Legendary, infusion, selected,
and unselected status do not independently exclude an option; the same
row-local capability test applies after the option has legally entered the
offer.

Rarification happens after offer composition and before the final option is
selected. It does not replace or reroll the option and does not add another
trait acquisition. Each successful row action consumes exactly one of the six
charges immediately, including when the option is later left unselected.
Progressive assessment must therefore fold authored rarification actions in
their actual order and expose another action on the same row only while a next
rarity and a charge remain.

### Experimental Hammer lifecycle

At rank III, Experimental Hammer attempts to grant one random eligible Hammer
trait when the keepsake is equipped. The game builds the domain from the
ordinary Weapon Upgrade trait set, applies current trait eligibility, and
excludes Hammer traits the player already has. When that domain is empty,
`AddRandomHammer` returns after the keepsake itself has already been equipped;
the acquisition callback is not retried later. Under the planner's
authored-possibility model, the result is therefore either one choice from the
exact weapon/aspect-valid domain or an explicit consumed no-result when that
domain is empty. Missing authored result state remains incomplete and is not
equivalent to exhaustion.

The acquired Hammer is a separate equipped trait with 20 encounter uses. The
source decrement belongs specifically to `RoomLogic.EndEncounterEffects`,
after encounter completion. That path advances an encounter-use trait when the
resolved encounter is either the room's current primary encounter or
`MapState.EncounterOverride`, unless the room declaration has
`IgnoreEncounterUses`. A noncombat encounter or a declaration with
`SkipEndEncounterEffects` completes without running this checkpoint. At zero,
the game removes the Hammer trait.

Consequently, the currently modeled positive checkpoints include ordinary
combat, miniboss, and boss encounters; every O phase whose declaration permits
end effects, including its non-counting Intro; the terminal P combat but not
its end-effect-suppressed pre-combat; and H cage encounters executed through
`MapState.EncounterOverride`. Story, Fountain, Shop, `Empty`, and Postboss
noncombat completions do not reduce the duration. Encounter depth and encounter
completion are therefore both insufficient proxies for this source rule.

The decrement occurs at the explicit end-effect checkpoint, not when the
player later talks to an NPC, uses a fountain, buys an item, or takes a room
reward. Fig Leaf suppresses enemy-spawn execution rather than this checkpoint:
a skipped phase whose declaration still permits end effects advances the
duration, while P's skipped pre-combat does not and its skipped terminal combat
does.

The source guard does not advance for a separate `ChallengeEncounter`, but
Challenge switches are outside the planner's modeled route and impose no
Experimental Hammer product or acceptance requirement.

Among the currently modeled room declarations, `BaseN_SubRooms` explicitly
sets `IgnoreEncounterUses = true`. Ephyra side rooms therefore do not reduce
the Experimental Hammer duration even though their own encounters complete.
The source search found no equivalent flag on the other currently modeled room
families. This is an explicit room-use distinction, not a combat-kind,
presentation, or encounter-depth distinction.

Postboss's primary noncombat completion does not reach the source encounter-use
decrement. A temporary Hammer granted at the reached rack therefore begins at
20 uses and reaches the next biome with 20; retaining an already-active Hammer
does not spend another use in Postboss.

The temporary Hammer is not tied to continued occupation of the keepsake slot.
Replacing Experimental Hammer at a later postboss rack removes the keepsake but
does not remove or refresh the granted Hammer. Its remaining encounter duration
continues until expiry. Retaining the keepsake likewise does not grant another
Hammer at each biome start.

The effect therefore requires one authored equip result at the pre-route or
postboss frontier: a compatible Hammer key when the exact domain is nonempty or
an explicit exhausted result when it is empty. Only a selected Hammer creates a
derived encounter-counted equipped-trait lifetime. The effect does not require
a recurring reward, a Hammer rarity, or a generic keepsake-effect interpreter.

### Encounter-altering keepsake lifecycles

Fig Leaf alters an eligible ordinary combat occurrence. Gorgon Amulet attaches
to an eligible hosted encounter, including the source-supported H passive
case. Neither should be represented as the existing selectable P Athena
encounter under a different source.

#### Fig Leaf

At rank III, Fig Leaf creates a separate persistent run trait with three biome
uses. In an eligible combat encounter, the game may suppress all enemy spawns.
The room occurrence, encounter completion, room reward, exits, and subsequent
route topology remain intact. Only the combat execution is skipped.

The persistent effect can activate at most once in a biome. A successful skip
consumes one of its three uses and prevents another skip in that biome; biome
start resets that local activation guard. The effect survives replacing Fig
Leaf with another keepsake. The source game rolls a 37% chance at each eligible
encounter until the biome-local activation occurs. The planner models positive
possibility rather than probability, so the player may author which eligible
encounter, if any, receives the skip.

Eligibility is not equivalent to `kind = combat` or to incrementing encounter
depth. The exact encounter must declare `CanEncounterSkip = true`; the current
room must not be a biome-start room; no member of the room's ordered encounter
envelope may declare `BlockDionysusEncounterKeepsake`; and the persistent effect
must not already have activated in the biome. A use is consumed only by an
actual skip. If no eligible encounter is skipped in a biome, the use remains
available for a later biome; the source does not unconditionally consume the
next three chronological biomes.

The source treats the existing multi-encounter shapes differently:

| Shape                                                       | Source behavior                                                                                                                                                     | Planner disposition                                                                                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ordinary F/G/I/N/Q combat and a generated H cage            | the exact generated encounter is independently skippable                                                                                                            | attach the authored skip to that encounter phase; the first authored success in the biome consumes the biome opportunity                                                                |
| O ship combat                                               | the intro and later generated combat are separate eligible roll points                                                                                              | permit either eligible phase to own the skip, but never both in one biome; skipping the intro does not suppress the later combat                                                        |
| P combat envelope                                           | the first pre-combat phase is skippable and declares `SkipEndEncounterEffects`; a later `GeneratedP` phase receives `CanEncounterSkip = false` when it is not first | author one envelope-level result at the eligible pre-combat phase; success suppresses enemy spawns for every phase in that room while preserving their identities and noncombat effects |
| H passive field encounter                                   | it does not declare `CanEncounterSkip = true`                                                                                                                       | do not expose a skip there; each eligible generated cage remains its own opportunity                                                                                                    |
| N side-room combat                                          | `GeneratedNSubRoom` declares `BlockDionysusEncounterKeepsake = true`, and `GeneratedNSubRoom_Bigger` inherits that blocker                                          | keep the exact side-room occurrence encounter phase, but do not permit a Fig Leaf skip there                                                                                            |
| Devotion, boss, field-NPC declarations; see miniboss matrix | they opt out through `CanEncounterSkip = false` or a blocking declaration                                                                                           | do not infer eligibility merely from their combat kind; use the exact miniboss matrix below for miniboss declarations                                                                   |

Miniboss is not a source-level Fig Leaf policy class. The currently modeled
miniboss declarations have this exact inherited/explicit matrix (from
`EncounterData.lua`, `EncounterData_Generated.lua`, and
`EncounterData_MiniBoss.lua`):

- `MiniBossTreant`, `MiniBossFogEmitter`, `MiniBossAssassin`,
  `MiniBossWaterUnit`, `MiniBossJellyfish`, `MiniBossVampire`, `MiniBossLamia`,
  `MiniBossRatCatcher`, `MiniBossGoldElemental`, `MiniBossSatyrCrossbow`, and
  `MiniBossBoar` inherit a `GeneratedF`/`G`/`H`/`I`/`N` declaration with
  `CanEncounterSkip = true` and no Dionysus-keepsake blocker: normalized as
  `canEncounterSkip: true`, `blocksFigLeaf: false`.
- `MiniBossCaptain`, `MiniBossDragon`, `MiniBossBrute`, `MiniBossStalker`, and
  `BossTyphonTail01` inherit generated positive support and explicitly set
  `BlockDionysusEncounterKeepsake = true`: normalized as
  `canEncounterSkip: true`, `blocksFigLeaf: true`.
- `MiniBossCrawler`, `MiniBossCharybdis`, and `BossTyphonEye01` explicitly
  block Dionysus-keepsake without inherited generated positive support:
  normalized as `canEncounterSkip: false`, `blocksFigLeaf: true`.
- `MiniBossTalos` inherits `MinibossEncounter` (including its Athena blocker),
  but declares neither `CanEncounterSkip` nor the Dionysus-keepsake blocker:
  normalized as `canEncounterSkip: false`, `blocksFigLeaf: false`.

`BossTyphonHead01` is modeled as a boss and is outside this miniboss matrix.
The normalized `kind` value must not be used to infer any of these facts.

For a room with ordered encounters, one blocking
`BlockDionysusEncounterKeepsake` member blocks the whole room even if another
member would otherwise be skippable. In P, a Heracles first phase is not
skippable and leaves the later generated phase non-skippable because it is no
longer first. In O, a non-skippable Heracles intro does not by itself block a
later ordinary ship combat unless a declaration supplies the explicit
room-wide block.

Successful skip propagation changes only execution. Every prepared P phase
still starts and completes. The pre-combat phase remains
`SkipEndEncounterEffects`, while the terminal phase still reaches end effects
and advances encounter-use consumers such as Experimental Hammer and
encounter-counted Chaos curses. The planner owns one Fig Leaf result at the
eligible first phase and derives that ordered event sequence from declarations;
it does not encode a P-specific consumer exception.

N does not create a separate Fig Leaf rule. Each visited main-room or side-room
combat remains an exact encounter phase at which the declaration can be
assessed, but the two generated side-room encounter identities carry the
explicit Dionysus-keepsake blocker and are not skippable. The shared persistent
trait's biome-local activation guard spans the full Hub, so only the first
authored successful skip among eligible visited main-room phases consumes the
biome opportunity.

Q remains a normal positive Fig Leaf surface when a retained use reaches the
fourth Surface biome. `GeneratedQ` declares `CanEncounterSkip = true`, while
`GeneratedQ_Large` and `GeneratedQ_Islands` inherit that declaration. Q's
ordinary generated combat phases therefore use the same exact phase-owned skip
fact as F, G, I, and N main rooms; the absence of a later rack frontier does not
end an already-retained Fig Leaf effect.

The authored fact therefore belongs to an existing eligible encounter phase:
`combat skipped by Fig Leaf`. It does not replace the room reward or introduce
a second room occurrence. Where the source cascades skipped spawns across a P
envelope, the one authored fact owns that cascade; the planner must not require
one checkbox per suppressed phase.

#### Gorgon Amulet

Gorgon Amulet owns one pending Athena appearance. At the first eligible hosted
encounter after equip, Athena is added to that encounter and the one use is
consumed. There is no biome-P restriction: the keepsake's requirements inspect
the current room and depth, and the encounter handler separately inspects the
active encounter. The frontier must begin at biome depth two or later and
requires the player to have no remaining Death Defiance. External
ending/progression predicates are collapsed by the planner baseline.

The source has two distinct `BlockAthenaEncounterKeepsake` owners:

- `TraitData_Keepsake.lua` checks
  `CurrentRun.CurrentRoom.BlockAthenaEncounterKeepsake` before starting the
  effect; and
- `HandleAthenaSpawn` in `EncounterLogic.lua` separately rejects the active
  encounter when `encounter.BlockAthenaEncounterKeepsake` is true.

These are not the later rack rule that prevents selecting Gorgon Amulet after
Athena has already appeared. The planner must preserve room-owned trigger
blocking, encounter-owned trigger blocking, and history-owned rack
unavailability as separate facts.

The effective modeled declaration matrix is:

| Disposition                       | Modeled declarations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| encounter permits Gorgon          | `GeneratedF`; `GeneratedG`; `GeneratedH_Passive`, `GeneratedH_PassiveSmall`, `GeneratedH`, `GeneratedH_Treant2`, and `GeneratedH_Screamer2`; `GeneratedI`, `GeneratedI_GoalReward`, `GeneratedI_Small`, and `GeneratedI_Small_GoalReward`; `OpeningGeneratedN`, `PreHubGeneratedN`, `GeneratedN`, `GeneratedN_Smaller`, `GeneratedN_Bigger`, `GeneratedNSubRoom`, and `GeneratedNSubRoom_Bigger`; `GeneratedO`; `GeneratedP` and `GeneratedP_Large`; and `GeneratedQ`, `GeneratedQ_Islands`, and `GeneratedQ_Large` |
| encounter blocks Gorgon           | `OpeningGeneratedF`; `GeneratedO_Intro01`; every P opening and pre-combat declaration; all modeled field-NPC combat declarations; `DevotionTestO`; all modeled miniboss and boss declarations; and `GeneratedAnomalyB`                                                                                                                                                                                                                                                                                              |
| room blocks Gorgon                | every modeled N side room, `N_Sub01` through `N_Sub15`, through inherited `BaseN_SubRooms.BlockAthenaEncounterKeepsake = true`                                                                                                                                                                                                                                                                                                                                                                                      |
| does not structurally host Gorgon | empty, story, shop, and other non-hosted noncombat phases                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

The N side-room row is deliberately independent: its generated encounter is
encounter-unblocked, but its room is blocked. H passive encounters are a
deliberate positive case rather than a kind-based inference; the Athena handler
contains H-specific active-enemy-cap handling to account for passive
encounters. Ordinary H cage encounters are positive through their selected
generated declarations. O's intro is blocked while its later `GeneratedO`
phases are positive. P's opening and pre-combat declarations are blocked while
the later `GeneratedP` and `GeneratedP_Large` declarations are positive.

The planner does not simulate a Death Defiance count. Gorgon Amulet therefore
reuses the existing source-local authored condition
`deathDefianceConditionMet` on the exact eligible encounter phase. `true`
means the source predicate "no remaining Death Defiance" is satisfied at that
frontier; `false` leaves the pending keepsake effect unconsumed so a later
eligible phase may receive Athena. The same local fact is available to the
resulting Athena offer for traits whose own requirements inspect the missing
Death Defiance condition. This is not a route loadout flag and must not create
a synthetic Death Defiance ledger.

A hosted combat skipped by Fig Leaf cannot consume Gorgon Amulet:
`HandleAthenaSpawn` returns before decrementing the pending use when enemy
spawns were skipped. The pending Athena appearance therefore advances to the
next eligible, non-skipped combat. This interaction can occur because Fig
Leaf's persistent run trait survives after another keepsake is equipped.

The keepsake appearance is additive. The ordinary encounter still runs; after
combat, Athena appears as an additional required interaction. The room's
ordinary reward is still acquired separately. This differs from the existing
`AthenaCombatP` encounter declaration, which is a selectable P encounter that
occupies the room's combat phase.

Athena then publishes her ordinary three-option trait offer. Rank III supplies
a rarity-level bonus of three, which makes every ordinary Athena option at
least Epic. The planner derives Gorgon rarity from its chronological keepsake
rank: an ordinary rank-III appearance is Epic and a rank-IV appearance under
prior Cherished Heirloom is Heroic. The reached encounter snapshots that rarity
for all three rows. The offer otherwise reuses Athena's existing trait
prerequisites and selection lifecycle.

Gorgon Amulet is not permanent. If it is replaced before finding an eligible
encounter, its pending appearance is lost. After Athena appears, the exhausted
effect remains historical and cannot trigger again.

Athena has one shared appearance budget per run. The ordinary P Athena
encounter requires `NPC_Athena_01` to be absent from the run-use record and the
Gorgon Amulet effect not to be expired. Conversely, the keepsake rack blocks
Gorgon Amulet after Athena has already appeared unless it is the currently
equipped keepsake. The two sources cannot produce separate Athena appearances
in one route.

In P, Gorgon Amulet has precedence through timing rather than a special
hard-coded source priority. Its additive appearance becomes eligible at biome
depth two, while the ordinary Athena encounter requires depth four. The first
eligible combat therefore consumes the keepsake before the normal P encounter
can enter the candidate domain; the resulting Athena history/expiration then
excludes that normal encounter. If a natural Athena encounter is reached while
the keepsake is still pending because all earlier encounters blocked the
keepsake, the encounter's `ExpireTrait` path consumes that pending use and
still produces only the one Athena appearance.

The authored product is therefore an additive encounter child on the eligible
combat phase plus its Athena trait offer. It is not a room takeover, a reward
replacement, or a P-only encounter selection. Progressive candidate evaluation
must arbitrate both sources against the same Athena appearance history.

### Later effect group

The nine Olympian source keepsakes remain lower-priority effect candidates:

- Cloud Bangle, Iridescent Fan, Vivid Sea, Barley Sheaf, Harmonic Photon,
  Beautiful Mirror, Adamant Shard, Everlasting Ember, and Sword Hilt.

Their identities belong in the initial keepsake history even when their reward
priority and rarity-upgrade effects remain inactive. Their later implementation
can reuse the planner's reward-source and trait-rarity authorities without
making those policies part of the base keepsake timeline.

### Identity/history only

The remaining 18 selectable keepsakes are not current effect-modeling targets.
They remain valid selectable identities and are recorded in the same equip/swap
history, but their gameplay effects are deliberately inert until a later scope
decision promotes an individual declaration.

This disposition is additive: effect support can be expanded declaration by
declaration without changing the legal identity history or requiring generic
placeholder effects.

## Fated Compatibility

`GameState.FatedStatus` is a three-state run fact:

- `Unknown`: no Fated-enabling keepsake has established the state and nothing
  has invalidated it;
- `Fated`: a Fated-enabling keepsake has established the state; and
- `Unfated`: an incompatible Arcana or keepsake has invalidated it.

`IsFateValid` returns true for both `Unknown` and `Fated`; it returns false only
for `Unfated`. Some behavior specifically checks for `Fated`, so the source
model cannot be reduced to one current validity boolean.

Three keepsakes establish `Fated` when the current Arcana state is compatible:

- Calling Card;
- Jeweled Pom; and
- Time Piece.

Their effects query `IsFateValid`; equipping the declaration is therefore not
by itself sufficient to guarantee that the effect is live.

The incompatible Arcana are:

- The Enchantress (`DoorReroll`);
- The Champions (`ScreenReroll`); and
- The Fates (`TradeOff`).

The nine Olympian source keepsakes and Gorgon Amulet form the opposing keepsake
set. Selecting one while Fated invalidates the state. The rack cleanup then
expires Calling Card and Time Piece uses and removes the Hades blessing granted
by Jeweled Pom. Neutral keepsakes do not themselves invalidate an already
established Fated state, so retained permanent effects can continue after a
neutral swap.

### Source transition order

At run initialization and whenever the rack is opened or closed,
`UpdateFateStatus` applies the following precedence:

1. any currently active incompatible Arcana sets `Unfated`;
2. otherwise, a currently selected opposing keepsake sets `Unfated`;
3. otherwise, a currently selected enabling keepsake sets `Fated`; and
4. otherwise, a neutral keepsake leaves the prior status unchanged.

The fourth rule makes the state history-sensitive. Changing from Jeweled Pom
to a neutral keepsake preserves `Fated`; the current Arcana and neutral
keepsake alone do not reveal whether the route is `Unknown` or `Fated`.

Once the state is `Unfated`, the ordinary in-run rack blocks all three enabling
keepsakes. The route cannot reactivate Fated later. Temporary Arcana activation
cannot invalidate an already-`Fated` route: its candidate domain excludes the
three incompatible Arcana while that state is active. If temporary Arcana are
activated earlier, while the status is still `Unknown`, those cards remain in
the domain; an incompatible result prevents later Fated activation when the
next rack evaluates the active Arcana state.

### Planner disposition

Fated status is completely derived from facts the planner can own:

- the current resolved active Arcana set, including any temporary activations;
  and
- the ordered keepsake-history prefix up to the current frontier.

The planner therefore needs neither an authored Fated flag nor a separately
mutated Fated state. At any frontier it can derive the source three-state value
with this precedence:

1. if the active Arcana contain an incompatible card, or the keepsake-history
   prefix contains an opposing keepsake, the result is `Unfated`;
2. otherwise, if the history prefix contains an enabling keepsake, the result
   is `Fated`; and
3. otherwise, the result is `Unknown`.

An attempted `Unknown` to `Fated` transition is consequently resolved by
checking the proposed enabling keepsake against the existing keepsake history
and the currently equipped Arcana. The same query supplies candidate
evaluation: it rejects an enabling keepsake from an `Unfated` frontier and,
once `Fated`, removes incompatible temporary Arcana targets. No additional
Fated lifecycle event or user-authored state is required. Effects that the game
cleans up when Fated is broken can trigger from the derived before/after
transition at the postboss rack frontier.

This interaction crosses the chosen priority groups: Jeweled Pom, Time Piece,
Calling Card, and Gorgon Amulet are first-group effects, while the nine
Olympian keepsakes are later-group effects. Even while their individual reward
priority and rarity effects are deferred, the later-group identities must
retain their Fated transition role because it governs the first-group effects.

## Source Predicates Separable from the Run Model

The game additionally gates keepsake availability or rack behavior through:

- relationship and gift progression;
- the postboss-rack incantation;
- a saved starting-keepsake profile upgrade;
- ending/progression gates on specific late keepsakes;
- special bounties that randomize selection;
- the Crossroads free-swap context; and
- a Duo trait that temporarily increases keepsake rank.

These are genuine source facts, but none is required to express the ordinary
initial-equip/postboss-swap timeline.

The planner baseline assumes:

- all 33 keepsakes are unlocked;
- all relationship, ending, and other profile-progression requirements are
  satisfied;
- the postboss keepsake rack is unlocked on both routes;
- the route starts with exactly one selected keepsake; and
- all keepsakes use their rank-III effects.

Therefore every declaration is initially selectable. Later availability is
derived from modeled run history: principally the no-return and Fated rules,
plus declaration-specific history such as Athena's shared once-per-run
appearance. The planner does not persist unlock flags, gift progression,
rack-incantation state, or per-keepsake ranks.

## Audit Conclusions

The smallest faithful common contract is a mandatory pre-route selection plus
ordered postboss swap frontiers, with a run-wide set of identities made
unavailable by prior replacement. Retention continues the existing selection
rather than creating a new acquisition, and a removed keepsake cannot later
return.

That contract is sufficient to declare all 33 keys without simulating all 33
effects. It is not sufficient to derive every selected effect. Effects with
uses, targets, generated traits, encounter counters, reward priorities, or
post-swap persistence must be added individually through their existing domain
authorities. The current slot identity must never be treated as a complete
snapshot of those effects.

The keepsake baseline has no remaining profile/loadout ambiguity: one starting
selection is mandatory, all declarations are unlocked, and every declaration
uses rank III. Effect support is extended only through a focused declaration,
authorship, simulation, and presentation slice for the settled effect subset.

## Current Planner Disposition

The keepsake model is current through authored schema 51. All 33 identities
participate in mandatory route-start selection, reached nonfinal Postboss
retain-or-replace frontiers, ordered history, no-return legality, and their
declared Fated role. The reached Postboss replacement is an optional ranked
rack action beside the required fountain, while retention has no rack
participant. Jeweled Pom, Experimental Hammer, Calling Card, Time Piece,
Fig Leaf, and Gorgon Amulet additionally own complete rank-I through rank-IV
profiles and implement the effect contracts audited above. Ordinary player
selection remains fixed at rank III.

Cherished Heirloom is complete for those six effects: acquisition advances the
current supported effect according to its exact reconstruction rule, and a
later supported equip uses rank IV while the Duo remains active. Gorgon uses the
schema-30 phase child and a chronologically snapped Epic or Heroic rarity. The
remaining 27 identities create no individual simulated gameplay effect, but
still participate fully in identity history, no-return, Fated policy, and Run
State.

Gift Gift Gift now captures all 29 source-eligible identities at Echo
acquisition. Fig Leaf and Experimental Hammer apply their rank-I replay once,
Calling Card and Time Piece add their rank-I charges at every succeeding biome,
and the other eligible identities remain effect-neutral while preserving
history and Run State. The four exact source exclusions are Gorgon Amulet,
Jeweled Pom, Discordant Bell, and Aromatic Phial. Experimental Hammer's authored
equip result now permits explicit exhaustion on every equip path, and each
successful acquisition owns an independent temporary-Hammer instance.

The implementation retains one branch-owned keepsake state and routes each
effect through its existing trait, acquisition, encounter, or lifecycle
authority. It has no generic effect registry, second route history, authored
rank, or React-owned keepsake-key policy. Experimental Hammer duration now
consumes the explicit `encounterEndEffectsApplied` event, while Fig Leaf keeps
phase completion identities and changes only the addressed execution result.
