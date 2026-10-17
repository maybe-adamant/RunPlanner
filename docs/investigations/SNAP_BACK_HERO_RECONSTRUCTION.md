# Snap-back hero reconstruction

Status: settled; implementation plan drafted in `docs/progress/SNAP_BACK_PLAN.md`.
Open only while that plan's probe gate runs. Delete at plan closure after
promoting the native facts below to `docs/audits/`.

Native paths are relative to `Content/Scripts`, engine paths to
`packages/planner-engine/src/`, and module paths to `game-module/src/mods/`.

## Question

After a mismatch, can the module return the live hero to the plan's state at
the next room and resynchronize, from source alone? If so, what must the plan
publish for that?

## Settled recommendation

**Principle.** Snap is the minimal intervention that gets back to a
synchronized state. The test for each piece of state:

- if a module check reads it, the plan publishes it and snap sets it;
- if no check reads it, it stays live.

**Mechanism.**

- With snap enabled, `LeaveRoom` steers the destination to the planned next
  room.
- At that room's `StartRoom`, before `base`, snap diffs the live hero against
  the room's `roomEntered` frame and applies only the differences.
- It then verifies the result with `room/conformance/admission.lua` and
  resynchronizes at that occurrence.

**Superseded approaches:**

- **Full rebuild** (reset plus the Practice installer on a per-room start
  state): rewrites far more than synchronization needs.
- **Saved state plus delta:** the `roomEntered` frame is already the full
  target. The saved state would only bring back the desync.

## Native facts that make a minimal diff safe

- **The hero unit is rebuilt on every map load.**
  - `RunStateInit` clears `Hero.ObjectId` (RunLogic.lua:433-435), from
    `OnPreThingCreation` (RoomLogic.lua:138).
  - `SetupHeroObject` asserts there is no unit (RoomLogic.lua:1652), then
    re-equips weapons and reapplies every trait's property changes and setup
    functions (RoomLogic.lua:1720-1724).
  - Before `base StartRoom`, only Lua state matters.
- **Native precedent.** `DoPatches` already removes and re-adds traits on an
  unbound hero at every map load (PatchLogic.lua:1055-1302).
- **What `RemoveTraitData` (TraitLogic.lua:1221-1366) does:**
  - It reverses membership, the `MaxHealth`/`MaxMana` `LuaProperty` changes,
    the modifiers, `WeaponDataOverride`, and the weapon and projectile
    changes.
  - Its `OnExpire` must be skipped with `SkipExpire`. Otherwise a Chaos curse
    grants its blessing, Barren re-equips the Arcana, and a delivery spawns
    its item.
- **Fix levels and rarities by remove plus re-add, never
  `IncreaseTraitLevel`.**
  - `IncreaseTraitLevel` and the rarity upgrades fire
    `OnLevelOrRarityChangeFunctionName` (TraitLogic.lua:2564-2565, 2664-2665,
    3032-3033).
  - Those hooks credit stacks, gold, armor and mana reserve: Bridal Glow,
    Personal Loan, `BoonGrowthBoon` accumulated time, Hephaestus armor, Athena's
    reserve.
  - Snap uses `RemoveTrait(..., { SkipExpire = true, SkipActivatedTraitUpdate = true })`
    and `AddTraitToHero` with processed data, without `FromLoot`, with
    `SkipSetup`.
  - It carries `PersistentTraitKeys` (TraitData.lua:29-41) across, as
    `IncreaseTraitLevel` does (2543-2560).
- **In-place changes need no replay.** Effects that change a held trait in
  place (Pom, Bridal Glow, Icarus, Duo, Echo, Circe, rarify) are restored by
  writing the frame's resulting rarity and level.
- **Health.** Adding a `MaxHealth` trait heals and removing one clamps
  (UpgradeLogic.lua:171-209). Snap captures `Health`, then calls
  `ValidateMaxHealth(true)` and clamps. Mana refills at `StartRoom`
  (RoomLogic.lua:1317).
- **Death Defiance lives outside the trait list.** It is `Hero.LastStands`
  plus `MaxLastStands`. Equips add charges with `IncreaseMax`: Reincarnation
  (KeepsakeLogic.lua:133-144), the cat (FamiliarLogic.lua:180), Circe's
  multiplier (EventLogic.lua:1437) and the Chaos blessing field
  (TraitLogic.lua:893-895). Snap restores the captured tables after the
  equipment step.
- **Armor lives on trait `CurrentArmor`** (CostumeLogic.lua:144-226). It stays
  live because snap does not touch armor traits.
- **Weapon and aspect identity are fixed for the run** (`loadout/install.lua`).
  Only the Premium Service aspect rarity changes in-run (`UpgradeAspect`,
  TraitLogic.lua:2801-2821).
- **Hex is not undone by trait removal.** It is `Hero.SlottedSpell`,
  `NumTalentPoints`, `InvestedTalentPoints` and the talent traits.
  - Talents stack when invested at several nodes (TalentScreenLogic.lua:520-533).
  - The planner already holds the exact invested nodes in order
    (`simulation/hex-progress.ts:6-17`). It publishes them per Path screen as
    highlight-only `plannedHexNodeKeys` (`execution-plan/model.ts:447-448`).

## Inventory

The table lists effects outside plain trait membership, and effects that change
a held trait in place. "Frame" is the
`roomEntered`/`beforeRoomExit` diagnostic (`execution-plan/model.ts:55-156`).
"Check" lists the module readers that consume the state: the screen checks
(`room/timeline/acquisitions/traits/screen_checks.lua`), the room-exit readers
(`room/conformance/readers.lua`, `keepsakes/conformance.lua`) and the
door and reward proofs.

| Effect                                                                                                                                            | Native                                                                                                                                     | Frame today                             | Check reads it                        | Settled disposition                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| Pom and level acquisitions, exchange, Duo Ransom and Natural Selection, Echo, Anvil, Icarus, Rank II hammers, Bridal Glow                         | TraitLogic.lua:2533-2569, 2573, 2724-2799, 2823-2836; UpgradeChoiceLogic.lua:952-961; PowersLogic.lua:3585, 3688; EventLogic.lua:1537-1699 | rarity, level, hammer rank ✓            | Pom, exchange, trait inventory        | Snap sets by re-add                                       |
| Per-instance fields (`UpgradedTraitName`, `SelectedTrait`, `GrantedTrait`, `RepeatedKeepsake`, Fight Fight Fight stats, Experimental Hammer uses) | Acquire functions above; EventLogic.lua:1704-1762; PowersLogic.lua:4840-4917                                                               | ✗, except hammer uses                   | `GrantedTrait` (keepsake reader)      | Written with the re-add from the start-state vocabulary   |
| Cherished Heirloom, rack swaps, Echo replay copies                                                                                                | KeepsakeLogic.lua:106-345; PowersLogic.lua:4808; RoomLogic.lua:1217-1241                                                                   | Current key ✓; **rank ✗; unslotted ✗**  | Rarify and keepsake ledgers           | **Frame adds** held keepsakes with rank                   |
| Keepsake ledgers (Calling Card, Time Piece, Fig Leaf, Phial, Figurine, Stone, Embryo, Pom)                                                        | `keepsakeEffects`                                                                                                                          | ✓                                       | ✓                                     | Snap sets fields                                          |
| Premium Service aspect rarity                                                                                                                     | TraitLogic.lua:2801-2821                                                                                                                   | ✗                                       | –                                     | **Frame adds**; snap re-adds                              |
| Familiar stacks (Circe)                                                                                                                           | EventLogic.lua:1431-1456                                                                                                                   | ✗                                       | –                                     | **Frame adds**; snap re-adds the traits                   |
| Arcana: Circe activation and promotion, post-boss draws, Barren                                                                                   | MetaUpgradeLogic.lua:~500-570; EventLogic.lua:1359-1397; EncounterLogic.lua:1640-1655; PowersLogic.lua:4836                                | Active list ✓                           | Admission                             | **Frame made exact**; snap sets                           |
| Vows: Circe disable, Forfeit                                                                                                                      | EventLogic.lua:1399-1421; ShrineLogic.lua:870-937                                                                                          | ✓                                       | Admission; encounter and reward logic | **Frame made exact**; snap sets                           |
| Artificer charges, Denial banned list                                                                                                             | `MetaConversionUses`; `BannedTraits`                                                                                                       | ✓                                       | Admission; offer legality             | **Frame made exact**; snap sets                           |
| Chaos rolled values and remaining clock                                                                                                           | Offer `ExtractValues` (module `chaos_offer.lua:191-214`)                                                                                   | Keys, rarity, remaining ✓; **values ✗** | Chaos fact                            | **Frame adds** values                                     |
| Well items and Hermes deliveries                                                                                                                  | StoreLogic.lua:1134; EventLogic.lua:1779; SurfaceShopLogic.lua:540-625                                                                     | ✓                                       | Hymn and yarn checks; Well fact       | Snap sets; removal uses `SkipExpire`                      |
| `Force*BoonKeepsake` reward priorities                                                                                                            | RewardLogic.lua:513                                                                                                                        | ✓                                       | `rewardPriorities` fact               | Snap sets                                                 |
| Reward store contents                                                                                                                             | `CurrentRun.RewardStores`                                                                                                                  | Remaining counts only                   | Door and reward proofs                | **Frame adds** exact contents                             |
| Hex nodes                                                                                                                                         | Spell and talent screens; PowersLogic.lua:5749                                                                                             | Counts and the God Sent pair only       | `pathOfStars`                         | **Frame adds the tree and nodes; node identity enforced** |
| Essences                                                                                                                                          | Hidden `<Element>Essence` traits                                                                                                           | Element totals ✓                        | `elementCounts`, every room exit      | Snap corrects from totals; no frame change                |
| Run records (`UseRecord`, `LootTypeHistory`, `ConsumableRecord`, `BiomeUseRecord`, `PickedTraits`)                                                | Reward, choice and pickup paths                                                                                                            | ✗                                       | Unverified                            | Live unless the probe shows a proof reads them            |
| Hidden max-stat grants (pickups, Worry Free, Traces, The Centaur, Silver Wheel)                                                                   | RoomLogic.lua:2722-2770 and callers                                                                                                        | ✗                                       | None                                  | Live                                                      |
| Armor, Death Defiance, gold and bank, rerolls, Spell uses, cooldowns, timers                                                                      | See the native facts above                                                                                                                 | ✗                                       | None                                  | Live                                                      |

## Remaining uncertainty

These are covered by the plan's probe gate:

- Whether any door or reward proof reads the run records.
- HUD refresh after the diff.
- The Silver Wheel grant thread on a keepsake re-equip.
- Restoring Death Defiance after equipment re-adds.
