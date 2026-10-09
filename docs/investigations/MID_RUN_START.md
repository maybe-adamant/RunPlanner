# Mid-run start

Status: open. Owner decisions recorded below; the product shape remains before
a plan is locked.

## Question

How can a published plan start a run at a later biome's Opening (Intro) or at
its Preboss, with the planner's complete state at that point installed into a
fresh native run, and the game playing on natively from there under the
existing plan?

## Scope

- Start points are only a biome Opening or that biome's Preboss. The biome's own
  state is therefore either fully game-owned (Opening) or fully complete
  (Preboss). Starts inside a biome, such as the N Hub, I Clockwork or the O Ship,
  are excluded.
- The first biome's Opening is a normal run, not a mid-run start.

## Owner decisions

- The start point is a run modifier: a biome on the selected route plus
  `opening` or `preboss`. Run modifiers still do not change simulation.
- A start point can be chosen only for a valid project, the same gate as
  publishing.
- Install only the planner-known state. Anything the planner knows exactly at
  the start point is forced, for example Centaur's tick, Discordant Bell, Lion
  Fang, Steady Growth, Chaos remaining uses and values, Well holdings, keepsake
  charges, Hermes orders, Path of Stars nodes and Fight Fight Fight decay.
  Anything the planner does not know is left as a fresh install leaves it (new
  or full): the Expiring timer, Evade Evade Evade, armor, the Ghost Onion,
  Silver Wheel and Mist Veil pools, spell charge, the Hades lifesteal pool, and
  Icarus armor boons assumed intact.
- Max health and Magick are derived by the game from the installed traits.
  Current health is set to max.
- The game assigns Death Defiance from its sources; every charge starts unused.
- Gold is set manually on the start point, defaulting to native starting gold.
- The plan drives the run after the start. The module installs a stub
  `RoomHistory` (one record per planned room, `Name` plus `NextRoomSet` where
  RoomData declares or inherits it: F_Opening01-03, N_Opening01 and the F, G,
  H, N, O, P and Dream Postbosses) so native depth is exact, plus the run-wide
  records the planner already holds exactly (use and loot records, consumables,
  priorities, entered and reached biomes, encounter depth). Full per-room
  records (encounter recency caches, meta-reward ratio, shop and harvest flags,
  dialogue) are not fabricated; while synchronized the plan overrides them.
- After a mismatch, execution goes passive as today and the run continues as a
  native practice run; recency checks may drift. That is accepted.
- Install traits without `FromLoot`, and drop `FromLoot` on the start keepsake,
  so acquire functions do not duplicate planner state. No other side-effect
  suppression.
- The game runs its lifecycle normally. The only record change is removing the
  shortcut run from `RunHistory`.
- Tight Deadline on a Preboss start grants the biome's full allowance.
- Weather: whatever the path of least resistance gives; it is cosmetic.
- Reward pools that differ by branch at the start point are left out; the game
  builds fresh stores.
- Unsuppressible in-play `GameState` writes and achievements are real play.
- Delivery order is the Opening first, then the Preboss.

## Evidence

Game scripts live under `1GameData/Scripts`.

### Installing traits

- There is no bulk restore path. Save load deserializes `Hero` as is, and
  `SetupHeroObject` (`RoomLogic.lua:1647-1745`) re-derives only engine
  properties. The Lua tables `AddTraitData` fills (modifiers,
  `WeaponDataOverride`, `EffectMultipliers`, ammo; `TraitLogic.lua:981-1121`)
  are not rebuilt, so `AddTraitData` must run; inserting into `Hero.Traits`
  directly is unsafe.
- The game's own way to re-create a trait is `AddTraitToHero` without `FromLoot`.
  It is used by `IncreaseTraitLevel` (`TraitLogic.lua:2533-2571`), the rarity
  upgrades (`3009-3030`, `2650-2662`) and patching (`PatchLogic.lua:1272`).
  `FromLoot` alone gates `AcquireFunctionName`, `HealOnAcquire` and the store
  pin (`TraitLogic.lua:901-907`).
- Recommended install:
  `GetProcessedTraitData{Unit, TraitName, Rarity, StackNum}` (rarity covers
  hammer rank), then overwrite the planner-known per-instance fields
  (`PersistentTraitKeys`, `TraitData.lua:29-41`), then call
  `AddTraitToHero{SkipNewTraitHighlight, SkipQuestStatusCheck,
SkipActivatedTraitUpdate, SkipSetup}` inside the module's `StartNewRun` wrap.
  The first room's `SetupHeroObject` runs activation and setup.
- Some effects are not gated:
  - `GameState.TraitsTaken` is set unconditionally; it drives Fated List quests.
    Snapshot it before the install and restore it after.
  - Max-stat presentation text fires; stub it during the install.
  - `ChaosLastStandBlessing` adds its Death Defiance unconditionally.
  - `GetProcessedTraitData` draws from the global RNG.
- Trait-local values that only the skipped acquire functions set must be written
  directly: Chaos and Hermes keepsake timers, `SetManaRegenUnique`, Personal Loan
  `StoredGold`, Echo `RepeatedKeepsake`, Fight Fight Fight start values, and the
  blood-drop display.
- Acquire functions are skipped, but several of them change another trait or
  run field persistently. The module installs that result from planner state.
  It does not run the acquire, which would compute from the player's profile
  rather than the plan.
  - Premium Service (`WeaponUpgradeBoon`, `TraitLogic.lua:2801-2818`) re-adds
    the aspect one rank above the profile rank. Nothing re-derives it, and
    removing the boon does not undo it. If Premium Service was ever acquired,
    re-add the aspect at `Perfect`.
  - Cherished Heirloom (`KeepsakeLevelBoon`, `KeepsakeLogic.lua:260-351`)
    rebuilds the current keepsake one rank higher, with per-instance
    adjustments: Calling Card uses, Time Piece conversions, Moon Beam talent
    points, Lion Fang reset and the Silver Wheel amount. Later equips re-derive
    the bonus from the held boon. Install with
    `EquipKeepsake{ForceRarity = <planner rank>}`, then write the per-instance
    fields, including Calling Card's nested `RarityUpgradeData.Uses`, which is
    not a persistent key.
  - Circe and Chaos Arcana and Fear results:
    - Vows disabled by Circe: write `ShrineUpgradesDisabled` and call each vow's
      disable hook. That also stops Tight Deadline.
    - Temporary Arcana: write `TemporaryMetaUpgrades`.
    - Lapis-raised Arcana: install at the raised rarity.
    - Barren: unequip Arcana while active.
    - The familiar stack multiplier.
  - Hammer upgrades: install at Legendary. Hera's boost and Hera supercharge:
    install the target rarity and level, and write `UpgradedTraitName`.
    Extra boons and levels: install them. Icarus slot boosts: write
    `SelectedTrait`.
  - Experimental Hammer: also write `UsesAsEncounters` and `OnExpire`, or the
    hammer never expires.
  - Embryo blessing: write `FromChaosKeepsake`.
  - Jeweled Pom's Hades boon: write `GrantedTrait` and
    `DeathDefianceDamageBoonEligible`.
  - Fig Leaf: install `PersistentDionysusSkipKeepsake` with its fields.
  - Talent points and reward priorities: write them after `StartNewRun`, which
    overwrites talent points.
- Values the planner does not model are set fresh or full: spell charges
  include `BonusSpellUses` (Moon Water Abundance), and `NumRerolls` is
  recomputed from installed traits.
- Shop prices are re-derived from held traits whenever a shop is generated
  (`StoreLogic.lua:678-686`). The Travel Deal and discount acquires only
  re-price shop items already spawned.
- Silver Wheel's equip adds its max-Magick trait even without `FromLoot`. The
  lumped max-Magick trait must exclude it, or carry it as a separately tagged
  source.
- Arcana Death Defiance and rerolls are computed inside `StartNewRun`, so either
  install Arcana before those lines or add the temporary and Lapis deltas.
- Chaos: an active boon is the processed curse trait carrying `RemainingUses`
  and `OnExpire.TraitData` (the blessing) (`UpgradeChoiceLogic.lua:350-379`). A
  matured blessing is a standalone trait.

### Keepsakes

- Native `StartNewRun` equips the loadout keepsake with `FromLoot`
  (`RunLogic.lua:478`), which would fire its acquire effect a second time.
  During a shortcut start the module drops `FromLoot`, and equips the planner's
  current keepsake rather than the loadout's starting one.
- `EquipKeepsake` has unconditional effects (`KeepsakeLogic.lua:106-163`):
  Lion Fang initialization, the Reincarnation Death Defiance, and the Silver
  Wheel max-Magick trait. These must agree with the planner's values.

### Max health and Magick

- Neither can be set as a base value. `ValidateMaxHealth` and
  `ValidateMaxMana` (`RoomLogic.lua:601-673`) rebuild both from `HeroData` plus
  every flat property change on every change.
- Flat values are summed before multipliers, so one hidden
  `RoomRewardMaxHealthTrait` or `RoomRewardMaxManaTrait` carrying the planner's
  pickup total equals the individual pickups.
- With a non-empty `RoomHistory`, `StartRoom` skips first-room hero setup
  (`RoomLogic.lua:1114-1119`), which applies trait Lua `MaxHealth`/`MaxMana`
  changes (`UpgradeLogic.lua:143, 561, 609`). The module must force
  first-room setup for X, then validate.
- The engine's `maxStats` serves as the post-install self-check.

### Death Defiance

- Death Defiance is never recomputed; each source adds it once when equipped.
  The run start adds the keepsake (Reincarnation), familiar and Arcana charges.
  Chaos blessings add theirs on install. Athena `FocusLastStandBoon` and
  `CircePetMultiplier` add theirs only through acquire functions, so the module
  adds those explicitly with `AddLastStand` (`CombatLogic.lua:2204-2262`, which
  stores its args and skips the cap check when silent).

### Gold

- `AddResource` credits lifetime totals, which gate incantations. Write
  `GameState.Resources.Money` directly, as the game does
  (`DeathLoopLogic.lua:136`), then call `UpdateMoneyUI`.

### Records

- Clear: `RecordRunCleared` and `RecordRunStats` write the `ClearedWith*`
  tables, depth records, fastest-clear records, lifetime trait stats and boss
  difficulty records (`RunLogic.lua:1945-2120`).
- Death: `KillHero` calls `RecordRunStats` and inline writes
  (`DeathLoopLogic.lua:36-240`).
- The run is appended to `RunHistory` at the next run's `EndRun`
  (`RunLogic.lua:1848-1855`).
- Chosen suppression: remove the shortcut run from `RunHistory` after `EndRun`.
  Clear-time and depth records from `RecordRunStats` are still written.
- Not suppressible: writes made during play (rooms entered, kills, dialogue,
  codex, `TraitsTaken` during play) and `CheckProgressAchievements` on every map
  load. Platform achievements can unlock irreversibly from real play.

### Biome entry

- A native precedent exists: Chaos Trials start at a later biome through
  `StartOver` → `StartNewRun` with `RunOverrides` (`BountyData.lua:162-232`,
  `RunLogic.lua:449-451`). They leave `RoomHistory` empty, which is not exact
  enough for the planner.
- On an Intro the game itself runs:
  - `EndBiomeRecords`, which resets the biome records and biome encounter
    depth;
  - `EnteredBiomes++` and `BiomeVisitOrder`, the Tight Deadline time and the
    keepsake biome-start effects (`RoomLogic.lua:1219-1293`);
  - `ChooseNextRewardStore`;
  - Clockwork initialization in I.
- Run-wide state is never reinitialized and must be installed:
  - `RoomHistory` (one whitelist record per planned room appearance;
    `RoomSaveWhitelist`, `SaveLogic.lua:86-114`, is the shape native code
    already tolerates), with run depth `1 + #RoomHistory`;
  - encounter caches and depths, and room counts;
  - `UseRecord`, `LootTypeHistory`, `ConsumableRecord`, `RewardStores`,
    `RewardPriorities`;
  - the last Devotion and Well depths, `Blacklist`, and talent points.
- The Intro's reward and encounter are chosen while the previous biome's
  records are still live, so those values matter only for X's creation.
- `LootBiomeRecord` is never read.

### Preboss

- Every Preboss forces `Shop` as its first reward (I forces `ClockworkGoal`).
- F, G, H, N, O and P get their World Shop only through `RunShopGeneration`,
  which `StartNewRun` never calls, so the module calls it after `CreateRoom`.
- What the Preboss, Boss and Postboss read is bounded and modelled: biome use
  records, `LootTypeHistory`, `EnteredBiomes`, the depth caches, Clockwork
  counters (I), Hermes delivery traits (Q, Dream) and Fear.
- Biome-interior native state with no planner value:
  - Tight Deadline `BiomeTime`, which drains immediately if zero;
  - F/N weather, absent on a Preboss start;
  - harvest points seen, which are meta only.

### Planner coverage

- Already exact in planner state:
  - room-history ordinal, depth caches, encounter depths;
  - entered biomes, Clockwork and sub-room counters, use and loot records;
  - consumables, traits, keepsakes, Hex, Well, Hermes, priorities, forfeit,
    Fear/Arcana, max stats.
- Derivable: the `RoomHistory` record list and its caches, room counts and the
  biome visit order, `RewardStores` (exact only on a single branch, and before
  X's own draw), harvest points and Chaos doors, and `Blacklist`.
- Missing: timers (`BiomeTime`, `GameplayTime`), weather, the last Challenge
  depth, rerolls, the text-line and speech records, and gold.
- The execution plan carries none of this as an authoritative product today.
  It needs a new engine-owned start installation product at a new checkpoint:
  after the predecessor's departure and before X's room-start effects.
  `roomEntered` is too late; `beforeRoomExit` misses the departure effects.

### Module fit

- In the `StartNewRun` wrap: set `args.RoomName = X` and pass `RunOverrides`
  for run-wide fields.
- In the `CreateRoom` opening branch: install state, override `BiomeDepthCache`
  for a Preboss, then call `RunShopGeneration`. Dream Intros need the Dream
  entrance overrides.
- The plan cursor starts with `route.newAt(plan, indexOf(X))`. The entry proof
  at `StartRoom` is unchanged.
- `admission.verify` is reused as the self-check, at the right point:
  - Preboss: before the base `StartRoom`;
  - Opening: after it, or against the new product.
- Loadout synchronization needs a mid-start variant.
- `docs/design/GAME_INTEGRATION_BOUNDARY.md` names the Postboss as the only
  mid-run attachment, and the protocol accepts only `postbossEntry`. Both
  change.

## Open points

1. Clockwork: the module does not write native `MaxClockworkNonGoalRewards` in
   any run; the plan's door rewards are forced regardless. An I Opening start
   therefore behaves like a normal run. A Preboss start writes
   `RemainingClockworkGoals = 0` and the planner's maximum.
2. The start installation product: its checkpoint (after the predecessor's
   departure, before X's room-start effects), shape, fingerprint and strict Lua
   decoding, plus the boundary-document amendment.
