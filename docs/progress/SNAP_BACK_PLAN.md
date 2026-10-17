# Snap Back Plan

Status: locked. Base commit: `24f6062cf`.

Evidence: `docs/investigations/SNAP_BACK_HERO_RECONSTRUCTION.md`. Native paths
are relative to `Content/Scripts`, engine paths to `packages/planner-engine/src/`,
and module paths to `game-module/src/mods/`.

## Objective

- **Exact conformance.** The `roomEntered` and `beforeRoomExit` frames carry
  every hero fact a module check reads, and conformance compares them exactly.
- **Snap mode.** An opt-in module toggle, off by default. After a mismatch,
  the run is steered into the planned next room. There the live hero is
  diffed against that room's `roomEntered` frame, only the differences are
  applied, and the session resynchronizes.

**Principle.** If a check reads a piece of state, the plan publishes it and
snap sets it. If no check reads it, it stays live.

## Current state

- **What the frames carry.** The frames are `ExecutionRunStateDiagnostic`
  (`execution-plan/model.ts:55-156`), assembled by
  `assembleRunStateDiagnostic` (`execution-plan/assembly/diagnostics.ts:52-187`).
  They are encoded in frames by `codec/diagnostics.ts` and expanded by
  `protocol/diagnostics.lua`.
  - Traits: rarity, level and hammer rank.
  - Arcana, vows, Forfeit, Chaos (keys, rarity, remaining), keepsake keys and
    the keepsake ledgers, the Hex counts plus the God Sent pair, Artificer,
    Well uses, deliveries and bag counts.
- **What the frames lack.** The keepsake rank, unslotted keepsakes, the aspect
  rarity, familiar stacks, Chaos values, Hex node identities, exact store
  contents and the modelled-trait universe.
- **Room-exit facts.** `deriveRoomExitConformanceDeltas`
  (`simulation/rewards/run-state-conformance.ts:115-182`) selects them. The
  module reads them in `protocol/conformance.lua` and
  `room/conformance/readers.lua`, and the Practice start check runs all nine
  families against `roomEntered` (`room/conformance/admission.lua`).
- **What a mismatch does.** It makes the session `desynchronized`
  (`runtime/session.lua:23-34`). From then on:
  - doors are unsteered (`navigation/hooks.lua:229-316`);
  - the route cursor stops (`route/session.lua:215-247`; `room/hooks.lua:177-205`).
- **Practice already contains the pieces snap reuses:**
  - starting at an occurrence (`route.newAt`, `runtime/session.lua:186-195`);
  - building a planned room through `room.prepare`/`room.realize` + `CreateRoom`
    (`room/hooks.lua:22-60`);
  - the hero writers `processed`/`add`, `installHex`, `installWell`,
    `installDeliveries` and `keepsakeEquipArgs` (`practice/install.lua`).
- The authored `schemaRevision` is 1 (`authored-project/model.ts:13`).

## Source facts and chosen simplifications

**Source facts** (cited in the investigation):

- `StartRoom` before `base` has no hero unit bound, and `SetupHeroObject`
  rebuilds every engine-side trait effect.
- `RemoveTraitData` reverses Lua-side trait effects except `OnExpire`, which
  `SkipExpire` suppresses, and acquire-time effects.
- The level hooks fire on `IncreaseTraitLevel` and the rarity upgrades.
- Death Defiance and armor live outside the trait list.

**Chosen simplifications:**

- **Kept live, never published:** health, magick, armor, Death Defiance, gold,
  rerolls, Spell uses, cooldowns, timers' `CurrentTime` and hidden max-stat
  grants. Acquire-time residue from a wrongly taken trait stays, because none
  of it is checked.
- **Essences** are corrected from the published element totals. There are no
  essence counts.
- **Run records** stay live unless the probe gate shows that a proof reads
  them.
- **Snap targets only** an occurrence with a published `roomEntered` frame.
  Hubs, Ephyra, Dream biome transitions and other biome edges are deferred:
  snap declines there, and the session stays passive.

## Ownership

- **Engine.** The frame fields come from `RunStateSnapshot`
  (`simulation/rewards/run-state.ts:128-176`):
  - keepsakes;
  - `hexProgress` (`tree`, `investedNodeKeys`);
  - `arcanaFear`;
  - traits and Chaos;
  - bags;
  - equipment upgrades (`aspectIsPerfect`, `familiarStackMultiplier` in
    `simulation/traits/equipment-upgrades.ts`).

  The held-keepsake rows and Chaos values reuse the start-installation
  projection (`simulation/start-installation/projection.ts`). There is one
  projection owner, not a second one. The new fact kinds are owned by
  `run-state-conformance.ts`.

- **Wire.** `execution-plan/model.ts`, `codec/diagnostics.ts` and
  `assembly/diagnostics.ts`. The modelled-trait universe is a plan-level field
  built from the catalog's in-run trait keys.
- **Module:**
  - decoding: `protocol/diagnostics.lua` and `protocol/conformance.lua`;
  - readers: `room/conformance/readers.lua` and `keepsakes/conformance.lua`;
  - snap: a new `snap/` neighborhood holding `apply.lua` (the diff) and
    `hooks.lua` (the `LeaveRoom` and `StartRoom` contacts). It reuses the
    Practice writers, which stay owned by `practice/install.lua`;
  - integrity: snap count and history on the session state
    (`runtime/session.lua`), shown by `presentation/status_ui.lua` and
    `presentation/victory_summary.lua`.
- **App.** No authored or UI change.

## Gates and commit boundaries

### 1. Exact frames (`schemaRevision` 2)

One commit. A minor bump: announce it in the commit, no approval needed.

1. **Engine: publish in both frames.**
   - a. **Hex:** the realised tree reference and `investedNodes` in order,
     from `hexProgress.tree` and `investedNodeKeys`.
   - b. **Equipment:** every held keepsake (key, rank, `slotted`, the
     counters the readers use), the aspect rarity and the familiar stacks.
   - c. **Arcana and vows, exact:** active and inactive cards with rarity and
     origin, vows, Forfeit, the Denial banned list, Artificer charges and the
     other used or charge counts the readers compare.
   - e. **Chaos:** curse and blessing values and the remaining clock.
   - f. **Exact reward-store contents** where they are exact across branches;
     otherwise omitted (decision 2).
   - d. **Once per plan:** the modelled-trait key list.
2. **Engine: new room-exit fact kinds** for keepsake rank, equipment, Arcana
   and vow exactness, Chaos values and Hex node identity. Path of Stars node
   identity becomes binding: `plannedHexNodeKeys` stops being highlight-only
   (`execution-plan/model.ts:447-448`).
3. **Module:** decoders, readers and proofs for the new fields and kinds.
   Practice's admission check gains them automatically.
4. **Schema and generated products:**
   - bump `PROJECT_DOCUMENT_SCHEMA_REVISION` to 2;
   - regenerate the execution fixtures through `encodeExecutionPlan` and
     Prettier;
   - rewrite the equivalence baseline (`EQUIVALENCE_WRITE=1`) as an intended
     product change.
5. **Acceptance:**
   - `npm run test:engine`;
   - `npm run test:game-module`;
   - `npm run test:equivalence`;
   - fixture `git diff --numstat` review;
   - an owner live run on an ordinary plan with no false room-exit mismatches,
     before gate 2 starts.

### 2. Snap apply and probe

One commit, for the shipped part only.

1. **`snap/apply.lua` `apply(occurrence, frame, plan)`.** It runs in the
   `StartRoom` wrap before `base`, in this order:
   1. Capture `Health`, `LastStands` and `MaxLastStands`.
   2. **Equipment:** aspect, keepsake and familiar.
      - The keepsake uses `UnequipKeepsake`, then `EquipKeepsake` with
        `keepsakeEquipArgs` and `ForceRarity`. Counters are written after.
      - The aspect and familiar traits are removed and re-added at the
        published rarity or stacks, only if they differ.
      - Restore the captured Death Defiance tables afterwards.
   3. **Arcana and vows.**
      - Cards: `RemoveWeaponTrait`, or `AddTraitToHero` with rarity and
        `SourceName`. Set the `GameState` `Equipped` flags and
        `TemporaryMetaUpgrades` by origin.
      - Disabled vows: set `ShrineUpgradesDisabled`, call
        `OnDisabledFunctionName`, then `ShrineUpgradeExtractValues`.
      - Re-enabled vows: `ShrineUpgradeExtractValues`, the
        `EnemyDamageShrineUpgrade` modifier (RunLogic.lua:24-28) and
        `ActiveBiomeTimer` (RunLogic.lua:488).
      - Set Forfeit, banned traits and Artificer.
   4. **Traits,** restricted to the modelled universe.
      - Skip exact matches: name, rarity, level and hammer rank.
      - Remove extras with `RemoveTraitData` and `SkipExpire`.
      - Add missing traits through Practice `processed`/`add`, without
        `FromLoot`, then write their per-instance fields.
      - Fix level or rarity by `RemoveTrait` with `SkipExpire`, then a re-add
        carrying `PersistentTraitKeys`. Never `IncreaseTraitLevel`.
      - Chaos curses are added with the published values; Well and delivery
        traits as Practice adds them.
      - Set the ledger fields and `RewardPriorities`.
   5. **Hex.** If the Spell differs, strip it and run `installHex`. Otherwise
      un-invest wrong nodes, invest the planned ones, and fix talent stacks by
      remove plus re-add. Then set `NumTalentPoints`, `InvestedTalentPoints`
      and `AllSpellInvestedCache`, and call `UpdateTalentPointInvestedCache`.
   6. **Reward stores:** write the published contents.
   7. **Essences, last and additively.** After `UpdateHeroTraitDictionary`,
      for each base element add or remove `<Element>Essence` traits until
      `Hero.Elements` matches the frame. `ElementalEssence` is split when a
      removal needs it; Aether follows from the traits alone.
   8. Call `ValidateMaxHealth(true)` and `ValidateMaxMana()`, clamp `Health`,
      then run `admission.verify(occurrence)`. The result is returned.
2. **Probe.** A dev-only manual trigger, not shipped, calls `apply` at the
   next room entry. Run the checklist below. Record the results in this plan.
   They decide decision 3.
3. **Acceptance:** module unit tests for `apply` against fake native
   functions, with representative cases per step; `npm run test:game-module`.

### 3. Snap mode

One commit.

1. **Toggle.** A module storage option, off by default, declared with the
   ModpackLib data API (`main.lua:49`). Read
   `external/adamant-ModpackLib/API.md` first.
2. **`LeaveRoom`** (`room/hooks.lua:177-205`):
   - all current checks stay unchanged;
   - when snap is enabled and the session is desynchronized from a mismatch,
     the route cursor still exits (`route.exit`);
   - the destination is steered to the planned next occurrence: the door's
     own room if it is that occurrence's game name, otherwise a planned room
     built through `room.prepare`/`room.realize` + `CreateRoom`, as
     `ChooseStartingRoom` does (`room/hooks.lua:22-60`).
3. **`StartRoom`** (`room/hooks.lua:119`), before `base`. When a snap is
   pending:
   - run `snap/apply.lua`;
   - on success, rebuild the route at the occurrence (`route.newAt`) and
     a fresh room coordinator. This reuses the Practice start-at-occurrence
     admission path in `runtime/session.lua`;
   - set the state to `synchronized`;
   - record the snap `{ occurrenceId, mismatch }`;
   - clear `firstMismatch` and the route's mismatch.
4. **Loop guard.** If the snap's verify fails, or the same mismatch checkpoint
   recurs at the snapped occurrence or the next one, the session goes passive
   with reason `snap-loop`, is reported, and never snaps again in this run.
5. **Integrity.** The snap count and history appear in the status window and
   the victory summary rows. Event runs are treated like any other run.
6. **Acceptance:**
   - module tests for the steering decision, resynchronization, the loop
     guard and integrity rows;
   - `npm run test:game-module`;
   - `npm run check` at phase closure.

### 4. Closure

- Promote the frame contract and snap mode into
  `docs/design/GAME_INTEGRATION_BOUNDARY.md`.
- Promote the native facts into a `docs/audits/` audit.
- Add a `docs/testing/` live checklist.
- Delete this plan and the investigation.

## Primary tests

- **Engine:** the frame-field and fact-kind matrix at
  `assembly/diagnostics.ts` and `run-state-conformance.ts`, covering present,
  absent and branch-inexact stores; codec round-trips; a Hex node-identity
  mismatch.
- **Module:**
  - decoder and reader cases per new field (`tests/protocol`,
    `tests/room/test_conformance_readers.lua`);
  - `snap/apply.lua` per step, including `SkipExpire` on curses and
    deliveries, never `IncreaseTraitLevel`, the essence split, and Death
    Defiance restored;
  - snap mode steering, resync and loop guard.
- **Product witnesses:** the regenerated execution fixtures decode in Lua.

## Probe checklist (gate 2)

1. **Desync deliberately:**
   - a different god boon;
   - a Pom on a different trait;
   - a Well item the plan lacks;
   - a keepsake swap at a rack;
   - a different Path of Stars node.

   Then fire the trigger and enter the planned next room.

2. **Check after the room starts:**
   - verify passes;
   - no duplicate traits;
   - a removed curse granted no blessing and a removed delivery spawned
     nothing;
   - health is clamped, not refilled;
   - armor, Death Defiance pips, gold and rerolls are unchanged.
3. **Keepsake re-equip at a new rank:**
   - counters;
   - the Silver Wheel thread grant (KeepsakeLogic.lua:145-162);
   - Reincarnation and cat Death Defiance restored to the captured state.
4. **Arcana and vows:**
   - add and remove a temporary card, then check the `GameState` flags;
   - re-enable a vow, then check the damage modifier and biome timer.
5. **Hex:** native tree display, point counts and talent stacks after
   re-investing.
6. **Essences:** element totals match after a forced essence or boon
   difference, including the `ElementalEssence` split.
7. **HUD:** the trait tray and Boon list show the post-diff traits, with no
   stale icons.
8. **Run records:** play two more rooms. Does any door or reward proof
   mismatch on records or stores?
9. **Persistence:** Save & Quit, then reload. Traits and maxima persist
   through `DoPatches`.

## Decisions

1. **Event runs** are not special: snap behaves the same on every slot.
2. **Reward stores that differ by branch:** contents are published only where
   exact across branches, as the Practice start state does. Elsewhere snap
   leaves the store live, and the existing door proofs decide.
3. **Run records** stay live. If the probe shows a door or reward proof
   reading them, they join the frame before gate 3.
4. **"Same mismatch"** for the loop guard means the same checkpoint at the
   snapped occurrence or the next one. A different mismatch later may snap
   again.

## Non-goals

- No snap into hubs, Ephyra, Dream biome transitions or a reloaded run
  (`resumed-unsteered`).
- No change to weapon or aspect identity, health, armor, Death Defiance, gold,
  rerolls, cooldowns or hidden max-stat grants.
- No saved-state restore and no full hero rebuild.
- No shadow mode and no snap diagnostics beyond the count, history and
  existing mismatch reporting.
