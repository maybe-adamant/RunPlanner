# Loadout install plan

Status: locked. Base commit: `0e04b7391`. No authored schema change. Evidence:
`docs/investigations/LOADOUT_INSTALL.md`.

## Objective

Every planned run installs the plan's starting loadout instead of observing
it: weapon, Aspect, Arcana, Fear, keepsake and familiar, at the planner's
mature ranks. The override is run-scoped, and the profile is restored after
the run. The starting-loadout check and Postboss admission are retired;
Practice mode replaces the mid-run start, and a failed install makes execution
passive.

## Decisions

- **Run-scoped override, held for the whole run** (the Chaos Trial pattern):
  - The backup is saved on `CurrentRun`.
  - Planned values are written into the GameState loadout fields before base
    `CreateNewHero`, and the Vows are re-extracted.
  - Rank wrappers (`GetWeaponUpgradeLevel`, `GetMetaUpgradeLevel`,
    `GetKeepsakeLevel` with per-call chambers, `GetFamiliarTraitStacks`) and the
    per-call `Unlocked` scope in `AddRandomMetaUpgrades` key off the saved
    marker.
  - Restore runs after `RecordRunStats`, with safety restores at the next
    `StartNewRun` and on a hub load. Unlock and progression data are never
    written.
- **The plan publishes:**
  - the starting familiar;
  - explicit Aspect, keepsake and familiar ranks (the mature-file assumption is
    planner policy);
  - Arcana rarity, which it already carries.
- **Removed:**
  - starting-loadout verification, including the starting Hex check;
  - Postboss admission and the `postbossEntry` resume boundary;
  - the weapon and Aspect admission checks.
- **New guards:**
  - a Fresh File plan admits only on a brand-new save (route check);
  - admission is refused during a Chaos Trial.
- **Fresh File** installs nothing.
- **Accepted effects:**
  - run records, keepsake chambers and Shrine bounties earned with installed
    content count;
  - install state is saved with the run;
  - a module removed mid-run leaves the planned values in the profile.
- **After a reload** the run continues unsteered, with a plain status line.
  Profile restore still runs from the saved marker.
- **Practice mode** installs on top of the loadout baseline; its slotted
  keepsake is the run-wide `LastAwardTrait`.

## Gates

1. **Protocol and engine.**
   - Publish the starting familiar and explicit ranks in the execution plan.
   - Remove `postbossEntry` (assembly, codec, graph validation, fixtures).
   - Regenerate fixtures with the protocol discipline, then a fresh independent
     review.
2. **Game module.**
   - Loadout install and restore.
   - Remove verification and Postboss admission.
   - Add the Fresh File and Chaos Trial guards and the reload status line.
   - Practice mode composition.
   - Lua tests, docs and the live checklist.

Each gate is one commit and closes with `npm run check`. At closure, promote the
durable facts, then delete this plan and the investigation.

## Non-goals

- Writing profile unlocks or progression.
- Mid-run re-attachment of any kind.
- Fresh File loadout install.
