# Initial Trait Offers and Fear Pressure

## Scope and source ownership

This audit owns ordinary initial Olympian/Hermes screen construction, Denial's
bans and exhaustion effect, and Forfeit's reward substitution. The supported
baseline is a progressed run with three generation positions. Rerolls,
first-run overrides, profile-first-seen priorities and debug requirement
stripping are outside the planner model.

Related authorities:

- [Trait pools and dependencies](TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md): provider
  membership, current-state eligibility, linked prerequisites and replacement
  candidates.
- [Rarity effects](BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md): source overrides,
  chance arithmetic and later equipped mutations.
- [Reward model](../../design/REWARD_MODEL.md#trait-bearing-reward-leaves):
  planner assessment and chronological settlement.

The source anchors below refer to the installed scripts audited on 2026-09-15.
They establish possibility, not exact probability or RNG replay. The planner
treats chances at or below zero as unable to succeed and at or above one as
guaranteed. Native `RandomChance` uses `rng:Random() <= chance`
(`RandomLogic.lua:120–125`); the Lua snapshot alone does not establish the
native RNG's endpoint behavior.

## One pre-offer state, distinct eligibility questions

`IsTraitEligible` (`RunLogic.lua:98–134`) checks declaration existence,
`MaxAmount`, elemental/shared conditions, prior-picked exclusions, bans and
`GameStateRequirements`. Callers separately check ownership, occupied slots
and linked boon requirements.

`HasTraitRequirements` (`RunLogic.lua:57–96`) accepts a successful declared
requirement family: `OneOf`, at least two `TwoOf` members, or one member from
each `OneFromEachSet` group. Alternative families are not implicitly ANDed.

All generation stages read the same pre-selection hero state. Offering an
identity does not equip it, satisfy another row's prerequisite or mutate a
replacement slot. Individually selectable rows are not themselves proof that
a complete screen can be generated.

## Native construction sequence

| Stage                 | Native contact                                               | Rule                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source                | `TraitLogic.lua:1765–1784`                                   | Resolve forced Common or the chance ledger, then apply blocked-rarity values.                                                                                                               |
| Replacement seed      | `TraitLogic.lua:1790–1806`; `UpgradeChoiceLogic.lua:795–821` | Active Hymn attempts one swap first. Otherwise the normal progressed replacement roll may seed one unless forced Common. No result falls through to core seeding.                           |
| Core seeds            | `UpgradeChoiceLogic.lua:739–792`                             | Use the provider-eligible priority set and its owned/occupied state, as detailed below.                                                                                                     |
| Linked-priority seeds | `UpgradeChoiceLogic.lua:855–875`; `TraitLogic.lua:1816–1825` | Eligible unowned linked-priority identities may enter remaining seed positions.                                                                                                             |
| Buckets               | `TraitLogic.lua:1858–1888`                                   | Build identity sets for every declared rarity from seeds and eligible ordinary entries. Declaration membership differs from roll support.                                                   |
| Seed rarity           | `TraitLogic.lua:1898–1918`                                   | Preserve explicit replacement rarity. Other seeds roll against their own rarity support. Remove each seeded identity from all buckets.                                                      |
| Ordinary fill         | `TraitLogic.lua:1920–1947`                                   | Make the remaining number of draw attempts. A Common candidate can be overwritten by each later successful nonempty rarity bucket. Remove only the final chosen identity from every bucket. |
| Replacement rescue    | `TraitLogic.lua:1949–1961`                                   | Fill actual vacancies from remaining replacement candidates, without another replacement roll or forced-Common guard.                                                                       |
| Rarity rescue         | `TraitLogic.lua:1963–1993`                                   | Only with effective Denial off, fill vacancies from surviving rarity buckets without random rolls.                                                                                          |
| Empty result          | `UpgradeChoiceLogic.lua:149–150`                             | Only an empty generated list becomes Fallback Gold. A short nonempty list is not supplemented with Gold.                                                                                    |

### Core seeding

Let U be provider-priority identities that pass declaration eligibility and
are unowned with vacant slots. Let H mean at least one _eligible provider
priority identity_ is already owned or has an occupied slot. Let A be
Attack/Special members of U.

| State                                      | Seeds                                                |
| ------------------------------------------ | ---------------------------------------------------- |
| H, U nonempty                              | Exactly one member of U; no Attack/Special guarantee |
| H, U empty                                 | None                                                 |
| Not H, at most three members of U          | All members of U                                     |
| Not H, more than three members, A nonempty | Three distinct members including at least one of A   |
| Not H, more than three members, A empty    | Any three distinct members                           |

H is not a generic “a core slot is occupied” flag. An ineligible provider
identity cannot set it merely because its slot is occupied. Hermes has no
priority or weapon list (`LootData_Hermes.lua:57–58`).

### Linked-priority support

| Identity             | Linked prerequisites                 | Source              |
| -------------------- | ------------------------------------ | ------------------- |
| `BlindChanceBoon`    | Apollo Attack                        | `TraitData.lua:143` |
| `MassiveKnockupBoon` | Hephaestus Attack, Special or Sprint | `TraitData.lua:178` |
| `PoseidonStatusBoon` | Poseidon Attack or Special           | `TraitData.lua:223` |

Each native chance is 0.25. The normalized fact is simply
`optionalLinkedPriority: true`: both insertion and non-insertion are possible.
Existing linked prerequisites still apply; the chance is not a new condition.

This stage matters when a guaranteed later rarity bucket would otherwise
prevent the identity from occupying an ordinary-fill position. A native-helper
probe with Apollo Attack/Cast, Poseidon Sprint and Hera Gain owned, Epic 2.05
and Duo 1.04 produced:

- successful priority insertion: Nova Flourish, Dazzling Display, Beach Ball;
- failed priority insertion: Nova Flourish, Beach Ball, Sun Worshiper.

Without this optional path the first screen would be falsely rejected. These
were native-helper results using rank-IV Queen and eight source-supported
Yarn instances, not live-game or complete-route witnesses. Exact nonzero
optional probability does not otherwise change the planner's support question.

### Rarity buckets and depletion

Bucket membership uses `RarityLevels[key] ~= nil`, not a positive chance.
Missing rarity declarations default to Common-only; an explicitly empty table
has no members. The provider's ordered checks, not numeric rarity rank, decide
which winning bucket supersedes another. Ordinary order is Common, Rare, Epic,
Duo, Legendary; Heroic is not a fresh ordinary roll.

Ordinary filling has a finite number of attempts, not a loop until three
successes. An attempt may produce nothing if Common is empty and all applicable
checks fail. An overwritten tentative choice is not consumed. Guaranteed
checks must succeed when their buckets are nonempty, while an empty bucket
cannot win even at a guaranteed chance. Depletion changes later possibilities.

A Common-only infusion can become available after earlier positions exhaust
a guaranteed Rare/Epic bucket. Counting it as a dependable Common row while
that bucket remains would admit an impossible screen.

### Replacement semantics

The helper draws from provider priority identities: an unowned eligible trait,
an occupied slot with a different trait, and an available next rarity for that
occupant. Promotion is Common → Rare → Epic → Heroic; Heroic has no successor.
Explicit promoted rarity survives even if the fresh chance table guarantees
another tier.

Normal generation seeds at most one replacement. Vacancy rescue may add more;
there is no quota inferred from the total number of ordinary candidates.
Only selection replaces the occupant. Its folded level transfers to the new
trait, including non-Pom replacements, before the exchange level bonus.

Hymn takes precedence over the normal roll and forced Common. When it seeds a
swap, every replacement alternative on that screen—including vacancy
rescues—receives its +2 level benefit. Closing the screen consumes the pending
use once, not once per alternative (`UpgradeChoiceLogic.lua:320–331,1134–1142`).
Without a seeded swap, the failed attempt does not spend that use.

### Final rescue, Denial and zero-valued entries

Effective Denial disables the final rarity rescue; it does not merely make
exhaustion arrive sooner. With Denial off, each rescue position starts from
Common and the last nonempty rarity bucket with a present truthy chance entry
wins, without calling `RandomChance`. Lua numeric zero is truthy.

Ordinary `GetRarityChances` creates zero entries for rarity keys
(`RoomLogic.lua:2140–2143`). Forced Common clears the table; `BlockRarities`
can subsequently reinsert a zero-valued entry. Absent and present-zero remain
different. Short or empty screens are supported only after all applicable
stages can terminate there.

### Trial of the Gods

Trial's `BlockRarities = { Duo = true }` writes a zero Duo chance. Most Duos
also inherit `SynergyTrait.GameStateRequirements`, which excludes Devotion
(`TraitData.lua:869–875`), so they never enter Trial buckets.

Five Duos replace that inherited requirement table:

| Identity                    | Own table                |
| --------------------------- | ------------------------ |
| `ApolloSecondStageCastBoon` | `TraitData_Duo.lua:527`  |
| `GoodStuffBoon`             | `TraitData_Duo.lua:757`  |
| `SuperSacrificeBoonHera`    | `TraitData_Duo.lua:965`  |
| `SuperSacrificeBoonZeus`    | `TraitData_Duo.lua:1004` |
| `SelfCastBoon`              | `TraitData_Duo.lua:1297` |

`DeepInheritData` (`RunData.lua:1390–1417`) does not merge these child tables.
Their own current-state and linked requirements remain, but not the inherited
Devotion exclusion. With Denial off, they can survive the final zero-chance
rescue. A native-helper probe produced Glorious Disaster this way. This does
not permit all Duos in Trials, bypass prerequisites, or enable a normal Duo
roll. Catalog requirements preserve the resolved source facts; the engine
needs no five-trait exception switch.

## Vow of Denial

### Declaration and applicability

`BanUnpickedBoonsShrineUpgrade` has one rank. Its extracted `ChangeValue` is
two. `BaseLoot` declares `BanUnpickedBoonsEligible = true`; ordinary Olympian
loot inherits `BaseLoot`, and `HermesUpgrade` also inherits it.

Stack/Pom and Weapon/Hammer loot explicitly disable the flag. Field-NPC and
Story choice surfaces do not inherit this eligible BaseLoot contract. The
ordinary-screen Denial domain is therefore Olympian and Hermes trait offers,
including those reached through a Shop or Devotion rather than only room-door
rewards.

Chaos has its own transforming-screen Denial contact: unselected curses, not
blessings, are banned. The [Chaos audit](CHAOS_TRAIT_GAME_DATA_AUDIT.md#denial-bans-unselected-curses-not-blessings)
owns that separate provider rule.

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

The interception is called only from `RewardLogic`'s `SpawnRoomReward` cases
whose outer reward type is:

- `rewardType == "Boon"`; and
- `rewardType == "HermesUpgrade"`.

The authored door or generated replacement remains a Boon or Hermes reward.
At spawn time the Vow substitutes the consolation consumable, so no trait
offer is opened and no trait is acquired from that reward.

This spawn boundary is reached from ordinary rooms, Fields cages, Ship wheels,
and Artificer replacements. Ordinary room
completion calls `SpawnRoomReward` for its selected door reward. A selected
Thessaly Ship wheel reward is stored as the active encounter's room-reward
override, and `EncounterEventsShipsCombat` calls `SpawnRoomReward` after that
encounter. A picked Ship-wheel Boon or Hermes reward therefore qualifies;
unpicked wheel previews do not.

Fields `SpawnRewardCages` (`RoomLogic.lua:5683`) calls `SpawnRoomReward` for
each active `room.CageRewards` entry in `ipairs` order during room setup.
Therefore the first qualifying cage reward consumes the available Forfeit use
before any cage combat or pickup. Nonqualifying cages are skipped; later
qualifying cages spawn their real loot. Native random point selection changes
where each cage appears, not this reward-list order. The user confirmed in a
live game probe that one specific cage contains the Onion before acquisition;
choosing a different cage first does not move that substitution.

The room retains each original `CageRewards` offer, while the cage's `RewardId`
refers to its spawned reward object. `UseFieldsRewardFinder` reads the spawned
objects' icon fields. The Onion is not a presentation wrapper retaining its
original god identity. Planner generation must retain the original offer/bag
identity, fix the replacement on selected room entry, and settle the already
fixed object on pickup. Merely offering an unentered Fields room does not spawn
its cages or consume Forfeit.

Artificer first destroys the eligible minor object, consumes one use, and
chooses a `RunProgress` replacement while excluding Devotion and Spell Drop;
it then calls `SpawnRoomReward` with that selected replacement as
`RewardOverride`. An Artificer-selected Boon or Hermes reward therefore enters
the same `CheckBoonSkipShrineUpgrade` branch, consumes the biome's Forfeit use,
and spawns `RoomRewardConsolationPrize` instead.

`CheckBoonSkipShrineUpgrade` registers the consolation object in
`MapState.RoomRequiredObjects`. Artificer's caller restores requiredness when
the destroyed source was required but never removes the new object's own
required registration when the source was optional. An Artificer-generated
consolation object is therefore still required. The caller separately copies
the destroyed source's `CanDuplicate` value onto a duplicable replacement, so
Sea Star support remains constrained by the converted source's duplication
capability.

The generic Shop `GiveLoot` path does not call
`CheckBoonSkipShrineUpgrade`. Devotion is structurally separate even though it
is a door reward and both outcomes are god trait screens: its pre-combat pair
and post-combat spurned reward call `GiveLoot` directly under the outer
`Devotion` lifecycle. Forfeit therefore does not consume its biome trigger or
replace those offers. Pom, Hammer, NPC, and Story traits likewise do not enter
the qualifying switch cases.

### Suppression by Circe

Black Night may disable Forfeit. The comparison uses the effective rank from
`GetNumShrineUpgrades`, so a disabled Vow does not intercept later room
rewards. A skip already consumed earlier in the biome remains historical; no
trait offer is restored retroactively.

### Biome coverage and accepted settlement timing

The planner preserves observable outcomes, not every native spawn callback.
Required-reward acquisition settlement remains sufficient unless an earlier
decision changes a modeled outcome. Fields' coexisting cages need earlier
consumption because pickup order is independent of spawn order. This is one
Forfeit policy with different lifecycle contacts, not one policy per biome.

| Biome / surface | Native reward path                                                                                                                                    | Accepted planner contact                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F               | Opening and ordinary encounters call SpawnRoomReward.                                                                                                 | Shared required-reward settlement.                                                                                                                       |
| G               | Ordinary incoming rewards, including qualifying rewards after detours.                                                                                | Shared settlement; door generation does not consume.                                                                                                     |
| H combat cages  | All active cage objects spawn in list order during room setup.                                                                                        | Selected room entry fixes the Onion and consumes the use; pickup reuses that outcome.                                                                    |
| H minibosses    | One locked reward spawns before combat and unlocks afterward.                                                                                         | Shared required-reward settlement. No observable modeled counterexample justifies separate pre-combat machinery.                                         |
| H other rooms   | Ordinary incoming rewards qualify; FieldsOptionalRewards contains no natural Boon/Hermes.                                                             | Shared incoming settlement; optional Artificer replacements use conversion settlement.                                                                   |
| I               | TartarusRewards includes Boon; ClockworkGoal does not qualify.                                                                                        | Shared reward settlement, not goal completion.                                                                                                           |
| N               | Hub generates offers; entered rooms spawn rewards. Side-room stores have no natural Boon/Hermes.                                                      | Shared settlement in visit order, not board order. Restores do not replay consumption or reset the use. Side-room Artificer remains separately eligible. |
| O ships         | Selected wheel reward spawns after combat. WaitForNextEncounterReady waits for required objects and reward screens before continuing.                 | Picked reward settlement only; unpicked previews do not consume. No separate spawn phase is needed.                                                      |
| O other rooms   | Ordinary incoming reward path; empty intro does not qualify.                                                                                          | Shared settlement.                                                                                                                                       |
| P               | GeneratedP_PreCombat overrides the reward to Empty; rewarded combat supplies the incoming reward. HeraclesCombatP can replace the encounter sequence. | One incoming reward settlement, not one opportunity per phase.                                                                                           |
| Q               | Qualifying ordinary rewards use SpawnRoomReward; shop purchases and boss drops do not qualify merely by being rewards.                                | Shared incoming settlement; purchases remain separate.                                                                                                   |

Source anchors: `EncounterSets.lua:446–490` (ordinary, H miniboss and Ship
sequences); `RoomLogic.lua:1368` (WaitForNextEncounterReady), `:1466` (wheel
reward override), `:5758` (SpawnRewardCagesMiniboss);
`EncounterData_MiniBoss.lua:260,331` (both H bindings);
`EncounterData_Generated.lua:1182` (P preliminary Empty reward);
`EncounterData_Heracles.lua:168` (Heracles P). Catalog stores mirror the
nonqualifying N side-room and H optional reward domains. Fountain rewards
also spawn early through HealthRestore start events in EncounterData_Unique;
early spawn alone does not warrant another planner timing mechanism.

Artificer's required replacement uses existing settlement. In Fields,
converting an optional minor reward into a boon before collecting the cage
Onion cannot produce a second Onion: entry has already consumed Forfeit.
The later cage pickup does not consume again. Merely tagging the cage while
leaving the counter available would be incorrect. Additional timing machinery
requires a concrete legal interleaving that changes the modeled outcome.

## Planner disposition

The engine asks whether a complete authored initial screen has one supported
construction path against one exact pre-offer branch. It does not combine
evidence from different histories or require a particular random seed. Row
eligibility, generation feasibility and selected acquisition effects are
separate questions.

Olympian/Hermes outcomes contain one to three distinct traits or mutually
exclusive Fallback Gold. Empty and short outcomes obey terminal-stage rules,
not ordinary/high-tier/replacement count quotas. Other provider families, Echo
replay and later rerolls do not inherit this algorithm.

Denial records actual unselected keys; Forfeit substitutes a concrete required
Onion before the affected trait lifecycle begins. Original reward/bag evidence
remains intact. Neither effect changes the initial generation envelope.
The separate native `RestrictBoonChoices` effect has no currently modeled
supplier and is not conflated with exhaustion.
