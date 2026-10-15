# Schema-Versioned Plans Plan

Status: locked. Base commit: `6ff8f3494`.

## Objective

One version governs both saved projects and compiled plans. It replaces the
module build hash. Sent plans stay valid across module updates that do not
change the version. When the version changes, the planner rebuilds every
deployed slot from the project that was sent.

## Current state

- **Projects** carry `schemaVersion`, currently 96
  (`authored-project/model.ts`). The loader migrates 86 and later through the
  transition chain, and every bump needs owner approval
  (`AUTHORED_PROJECT_MODEL.md#schema-change-approval`).
- **Plans** carry `format` and `catalogVersion`. Admission compares the module
  build id:
  - It is the SHA-256 of `game-module/src`, excluding `mods/presentation/`.
  - It is stamped into `execution-compatibility.json` at assembly.
  - It is carried in the slot envelope `{format:'run-planner-slot', buildId, plan}`.
  - The overview's `matchesBuild` and the module inbox's `stale-slot` read it.
- **Any execution file edit** changes the build id and makes every sent plan
  outdated, whether or not the plan's meaning changed.
- **Community events** already compile locally from the project, and the feed
  carries `projectSchemaVersion`.

## Versioning contract

- **The version is a pair:**
  - `schemaVersion` is the major.
  - `schemaRevision` is the minor. It is an optional integer, and absent means 0.
  - Existing files from 86 to 96 stay valid as major N, minor 0.
- **Major bump.** The authored model's shape changes and the saved document
  must be transformed. It needs a transition script and explicit owner approval,
  as today.
- **Minor bump.** It is needed when:
  - a change can make a previously valid project invalid (tightened validity);
  - or a change alters the compiled plan wire.

  It has no script, and the document is unchanged. It is announced in the
  commit and change summary, and needs no owner approval.

- **No bump** for module-only changes (wiring, presentation, lifecycle,
  performance, steering fixes) or for planner changes that change neither
  validity nor the wire.
- **Loader:**
  - It runs transitions across majors.
  - Within a major, it loads as is and stamps the current minor on save.
  - Majors outside the supported range are refused, as today.
- **Same-version invariant.** A project that compiled under a version still
  compiles under the same version. A failure is a defect: a missing bump.

## Plan admission

- **Plans** carry `schemaVersion` and `schemaRevision` alongside `format` and
  `catalogVersion`.
- **The module** ships `execution-compatibility.json` with the planner's current
  pair, stamped at assembly. It admits a plan only when the pair and the
  `catalogVersion` match exactly. A mismatch reads `stale-slot` (outdated).
- **The build hash is removed:**
  - `build_identity`;
  - the `src/` hash and its presentation exclusion;
  - the presentation-hook fence that exists only for that exclusion;
  - the envelope `buildId`;
  - `matchesBuild`;
  - `events_ci build-id`.
- **"Outdated"** in the overview, the module picker and the planner's Active
  plan dropdown now means a mismatched pair or catalog.
- **Module identity** for installed-versus-bundled and update checks uses the
  module's manifest version.
- **Events** need no change beyond comparing the pair. The feed's
  `projectSchemaVersion` gains an optional `projectSchemaRevision`, and any
  revision within a supported major compiles.

## Rebuild on version change

- **Storing the source.** On Send, the host stores the sent project document and
  the Send options needed to reproduce the compile (the internal run-modifier
  flag, the display name). It writes them beside the slot as a planner-owned
  `slot-N.project.runplanner.json`, in the same atomic transaction as the slot
  file and overview.
  - The module ignores this file.
  - Slot 0 (events) has none.
- **When it runs.** After the planner installs a module whose pair differs from
  the deployed slots, and on a manual **Rebuild slots** action, for each slot
  with a stored source:
  - **Same pair:** nothing to do.
  - **Minor differs:** recompile with the Send pipeline and resend. If the
    compile fails, the slot stays outdated with its reason.
  - **Major differs:** migrate, recompile and resend. If it fails, the slot stays
    outdated with its reason.
  - **Same pair but the compile fails:** this is a defect. The slot stays
    outdated, and the failure is logged and offered as a bug report.
- **Slot numbers and the active slot** are kept. A rebuilt slot's sent time is
  the rebuild time.
- **Slots sent before this feature** have no stored source. They stay outdated
  until resent once.

## Gates

1. **Policy and versioning.**
   - `schemaRevision` in the authored codec and loader (optional, defaults to
     0, stamped on save).
   - The contract above, recorded in `AUTHORED_PROJECT_MODEL.md` (schema change
     approval), `AGENTS.md` (Modeling Rules) and `SIMULATION_AND_VALIDATION.md`.
   - **The corpus rebuild test:** every checked-in fixture, checkpoint and route
     builder project compiles under the current pair. This is the same-version
     invariant in CI.
   - The equivalence lane and fixtures move with the new plan fields.
2. **Version gate.**
   - Plans carry the pair.
   - The engine codec, the module decoder and inbox, and the host publish
     checks admit on the pair and catalog.
   - `execution-compatibility.json` is stamped with the pair.
   - The build hash and its fence are removed.
   - Overview, module UI and Active plan "outdated" follow the pair.
   - Module identity comes from the manifest.
   - Fixtures are regenerated per AGENTS discipline.
   - Docs: `GAME_INTEGRATION_BOUNDARY.md` and `CONTRIBUTING.md`.
3. **Rebuild.**
   - The stored source in the slot transaction.
   - The rebuild flow with its four outcomes, the defect flag and its bug-report
     path.
   - **Rebuild slots** in the Game panel.
   - A live checklist.
   - Retire this plan.

## Tests

- **Codec:**
  - a missing revision reads 0;
  - revision round-trips;
  - majors outside the range are refused.
- **Corpus:** every corpus project compiles under the current pair.
- **Engine, host and module admission:**
  - an exact pair and catalog are admitted;
  - any mismatch is outdated;
  - no build-id path remains.
- **Rebuild:**
  - the same pair is skipped;
  - a minor or major difference rebuilds;
  - a failure after migrating stays outdated;
  - a same-pair failure is flagged as a defect;
  - slot 0 is untouched;
  - slots without a stored source stay outdated.

## Non-goals

- Migrating compiled plans directly.
- Folding `catalogVersion` into the pair.
- Changing the event feed's signature or trust model.
