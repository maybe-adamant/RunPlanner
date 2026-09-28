# Game module ownership, installer and self-update

Status: locked 2026-09-27. Gates 0 and A delivered; Gate B implemented and
awaiting review and the owner's updater key; Gates C and D remain. All
decisions below are owner-approved. No push or release until the owner
requests one.
Base: planner `094746d3`; executor `main` at the time the merge runs.

## Objective

The game module becomes part of the planner: the same repository, release,
version and update cycle.

1. **One repository.** The Plan Executor moves into this repository. One
   commit can change protocol, codecs, fixtures and executor together. There
   is no fixture mirroring and no cross-repository pin.
2. **First-party game module lane.** A Settings panel next to About locates the
   r2modman profile, and installs, updates and removes the module built from
   this release. It reports ModpackLib and dependency status. Publish to Game uses
   the established target.
3. **Installed application.** The planner is installed, updates itself, and
   carries its game module in every update.
4. **Retire separate distribution.** The module and coordinator leave
   Thunderstore. `adamant-ModpackLib` stays on Thunderstore and brings the
   third-party stack through its own dependencies.

## Current facts (inventory at base)

- **Release.**
  - `windows-portable.yml` is manual dispatch only. It runs
    `tauri build --no-bundle` and publishes a draft-then-published release
    containing a portable zip and its `.sha256`.
  - `assert-release-version.mjs` requires a stable version newer than every
    published release.
  - Tauri is 2.11.5 with dialog and fs plugins only. Bundling is inactive,
    and there is no updater and no signing.
- **Release discovery.**
  - It requires the exact portable asset names on GitHub `releases/latest`.
  - "Download" opens the zip in a browser.
- **Executor repository.**
  - Package `adamantRunPlanner-Run_Planner` 0.10.0 on Thunderstore
    (`thunderstore.toml`, `tcli publish`), with its own CHANGELOG and GitHub
    releases.
  - Tests run through `lua tests/all.lua` (684), plus `luacheck src`. Its
    pre-commit hook is not executable.
  - `.gitignore` contains unresolved merge-conflict markers.
  - A stale, gitignored `src/manifest.json` 0.3.0 exists locally.
  - Execution fixtures are mirrored byte-for-byte from
    `packages/planner-engine/test/execution-plan/fixtures/` and verified with
    `cmp`. The AGENTS.md mirroring rules describe this.
- **Publication.**
  - `game_plan_publication.rs` discovers r2modman profiles only when
    publishing.
  - Compatibility is the module manifest identity plus an exact
    `execution-compatibility.json` triple.
  - Plans are written atomically to
    `config/adamantRunPlanner-Run_Planner/slot-N.runplanner.json`.
- **On disk.**
  - r2modman flattens packages into `plugins/<FullName>/` and records managed
    mods in `mods.yml`.
  - Disabling a package renames its files to `*.old`, including plan slots.
  - Hell2Modding loads unmanaged plugin folders.
  - Thunderstore dependencies resolve **by name only**.
- **Versions.**
  - The executor names `adamant-ModpackLib` 4.1.0. ModpackLib is mature and
    backward compatible.
  - Run Director and Speedrun share its install in a common profile.
- **Coordinator.** `adamantRunPlanner-RunPlanner_Modpack` is optional.

## Decisions

Decided:

- **D1.** Retire the coordinator. It is neither bundled nor published.
- **D7.** The planner bundles only its own module. ModpackLib is installed by
  the user through r2modman, which also installs its dependency chain. The
  planner detects and reports it but never installs, upgrades or removes it.
- **D8.** Fold the executor into this repository. It has no separate
  releases, versions or Thunderstore package.
- **T1.** ModpackLib is compatible when its version is at or above the
  module's declared requirement, with the same major.
- **T2.** That requirement is read from the module's own manifest dependency.
- **T3 (owner-approved amendment, Gate B).** The installed application owns
  its data. Portable and installed builds resolve the same per-user config,
  data and WebView directories from the bundle identifier, so there is no
  separate portable data; the owner accepted the shared directories with no
  import, replacing the original one-time import offer.
- **T4.** There is no game-running check.
- **D9.** Merge with `git subtree add --prefix=game-module` without squash,
  keeping executor history under the new path.
- **T5.** The module has no version of its own. At build time its manifest
  `version_number` is stamped with the planner version.
  - The protocol and catalog triple remains the compatibility contract.
  - An install record captures version and file hashes. Installing an
    identical module is a no-op.

- **D2.** Per-user NSIS installer.
- **D3.** Clean installer-only release, with no bridge. Existing portable builds
  do not detect it; the owner announces the switch in release notes and
  community channels.
- **D4.** No code signing for now.
- **D5.** The owner generates the updater key. The private key and password
  live in GitHub secrets, with an offline backup.
- **D6.** No prerequisites package. Deprecate `Run_Planner` and
  `RunPlanner_Modpack` on Thunderstore, with a pointer to the planner.

## Locked contract

### Repository shape

- The executor lives at `game-module/`: `src/`, `tests/`, a `.luacheckrc`, and
  the README folded into docs.
- **Fixtures.**
  - Execution fixtures have one copy, in
    `packages/planner-engine/test/execution-plan/fixtures/`.
  - Lua tests read them from that path.
  - The mirrored copies, the fixture README duplication, and the AGENTS.md
    mirroring and `cmp` rules are removed.
- **Checks.** A new `npm run test:game-module` runs `lua tests/all.lua` and
  `luacheck src`. `npm run check` includes it, and CI installs Lua 5.x and
  luacheck.
- **Ownership.** AGENTS.md gains a fourth ownership lane, Game Module
  (`game-module/`). It owns the runtime execution of published plans and
  consumes the execution protocol. It must not own planner semantics.
- **Retired executor tooling.** `thunderstore.toml`, `tcli` publishing,
  executor GitHub releases, the executor CHANGELOG (folded into planner
  release notes), the stale local manifest, and the non-executable hook.
- **Archive.** The executor repository is archived with a pointer to this
  repository. The `run-planner-modpack` development layout is superseded by
  the Settings lane, including its development install (below).

### Bundled packages

- **Module.** The build assembles `game-module/` into the plugin package,
  with the manifest from `manifest.template.json` stamped with the planner
  version.
  - It is embedded into the application binary at compile time, not as a
    Tauri resource file, so portable and installed builds behave identically.
  - Packaging, targeting, install and publication live in the Tauri-free
    `run-planner-game-host` crate, tested by `npm run test:game-host`. The
    Tauri crate keeps only the command layer.
- **ModpackLib** is not bundled, and there is no lock file.
- **Runtime.** The planner never downloads game packages.

### Game target (application setting)

- The chosen profile root is an application setting. It never goes into
  authored projects or history.
- **Locate Game Module** discovers r2modman profiles or accepts a chosen
  folder, using the existing containment and symlink rules, and shows the
  path.
  - The r2modman data root is resolved per platform: `%APPDATA%` on Windows
    today, behind one platform-root function. Adding a Linux or macOS root
    later is then a single addition, not a discovery rewrite.
- **Status** is an application projection of Rust-reported facts:
  - the target path;
  - installed versus bundled module version;
  - installed versus required ModpackLib version, with an
    "install/update ModpackLib in r2modman" instruction when it is missing or
    older;
  - whether r2modman manages the module (read-only `mods.yml`);
  - missing dependencies named by the module and ModpackLib manifests, which
    are reported but never installed.

### Install / Update Game Module

1. Operate only on the established target. If the hashes already match, do
   nothing.
2. **ModpackLib.** It is never touched. When it is missing or incompatible,
   install still proceeds, but status and publishing report it.
3. **Existing copies.** Show the folder's version and whether r2modman
   manages it, then **ask before overwriting**. Declining leaves it
   untouched.
4. **r2modman-managed copies.** Warn that r2modman disable or uninstall will
   rename or delete the planner's files, and recommend removing the package
   there.
5. **Staging.** Stage next to the target, verify hashes, then swap. A failure
   leaves the prior install intact.
6. **Backup.** The replaced copy goes to the planner's app data, never
   `plugins/`, which Hell2Modding would load. The latest backup is kept.
7. **Install record.** Write a planner-owned record of the version and hashes.
8. **Coordinator.** A managed coordinator gets a non-blocking removal notice.

### Remove Game Module

- Removes only a planner-installed module, after confirmation.
- Never touches ModpackLib.
- Leaves `config/` plan slots untouched.
- Reports a module the planner did not install, and does not remove it.

### Development install

- Available only in development builds.
- "Install game module from this checkout" builds `game-module/` locally and
  runs the same install flow and checks.

### Publish to Game

- Uses only the established target.
- Publishes only when the installed module matches this build and ModpackLib
  is compatible.
- Otherwise it names the found and required values and links to Settings.
- No discovery during publish.
- `mods.yml` is never edited, and only plan slots are written under `config/`.

### Updates (after Gate B)

- The signed Tauri updater installs a new planner after explicit
  confirmation.
- On next launch, a mismatch between the bundled module and the install
  record offers Update Game Module.

## Delivery gates

Each gate follows the AGENTS.md routine: exact packet, one write-capable
executor, independent review, one remediation pass, main-session commits.

### 0 — Fold the executor into this repository

- Fix the executor `.gitignore` in the executor repository first.
- Subtree-merge it to `game-module/` (D9).
- Point Lua tests at the single fixture corpus and delete the mirrored
  fixtures.
- Add `test:game-module` to scripts, `check` and CI.
- Update AGENTS.md: add the lane, remove the mirroring and `cmp` rules, and
  replace executor-repository instructions.
- Update the documentation that names the external repository:
  `GAME_INTEGRATION_BOUNDARY.md`, `FEATURE_HOOK_MAP.md`, README and memory
  pointers.
- No behaviour change.
- **Acceptance:**
  - `lua tests/all.lua` is green with the same count against the single
    corpus;
  - `luacheck` is clean;
  - `npm run check` is green;
  - the executor history is visible under `game-module/`.
- Archive the executor repository afterwards, with owner action on GitHub.

### A — First-party game module lane (portable build)

- **Build.** Build and stamp the module, then embed it.
- **Planner capabilities.**
  - Rust: locate, status, install and update (consent, staging, backup,
    record, no-op on equal hashes), and remove.
  - The development install.
  - An application adapter with the persisted target.
  - The Settings panel next to About.
  - Publish to Game retargeted to the established target.
  - No policy in React.
- **Tests.**
  - Rust, on temporary profiles:
    - ModpackLib absent, older, compatible, newer on the same major, and
      another major, each reported and never modified;
    - missing dependency reporting;
    - existing unmanaged and managed copies, with prompt and decline;
    - backup outside `plugins/`;
    - interrupted swap;
    - identical-hash no-op;
    - remove only when planner-installed;
    - `config/` untouched;
    - containment and symlinks.
  - Application projection and UI tests for status, actions and publish
    blocking.
- **Docs.** Distribution and publication in `GAME_INTEGRATION_BOUNDARY.md`,
  and the README setup.

### B — Installed application and self-update

Status: implemented and reviewed; the owner has set the two signing secrets
and committed the real public key. The workflow has not been run. The owner's
first `dry_run` dispatch (build, sign, install and launch test; no tag, draft
or release) counts as the pre-release dry run. The owner decided that an
unsaved project turns the update action into Save and install.
Future hardening, tied to a later Tauri CLI upgrade: `require_signed_version`. D3 was verified against the shipped portable
discovery: an installer-only newer release makes the startup check silent
(one request, no notice) and a manual check reports "Update check
unavailable."; nothing opens a download.

- Per-user NSIS installer and `tauri-plugin-updater`, with a signed artifact
  and `latest.json`.
- Workflow: bundle, sign, keep the launch test, draft, publish.
- A clean installer-only release (D3). Verify that an older portable build
  handles a release without portable assets quietly, with no error loop or
  broken notice.
- Updater checks replace portable discovery, with the notification UX kept.
- Self-contained app data (T3: shared identifier-derived directories, no
  import).
- Tests: update-state logic and a pre-release dry run.
- Docs: ARCHITECTURE host section, README, and retirement of
  `PORTABLE_README.txt`.

### C — Distribution retirement (Thunderstore, modpack repository)

- Deprecate `Run_Planner` and `RunPlanner_Modpack` (D6).
- Retire the coordinator and "Release All" publication of the module.
- Mark the coordinator README retired.
- Ship in the same window as the first planner release that bundles the
  module.

### D — Closure

- Promote durable facts to `GAME_INTEGRATION_BOUNDARY.md` and ARCHITECTURE,
  then delete this plan.
- Run the full `npm run check`, including the game module lane.
- **Owner live acceptance:**
  - Locate, install, update and remove on a profile with only ModpackLib
    installed through r2modman.
  - A Thunderstore-installed profile: prompted, overwritten, and then cleaned
    in r2modman.
  - ModpackLib missing or older: reported, with publishing blocked.
  - Each publish-blocking reason.
  - Development install.
  - First launch of the installed app, carrying portable-build settings.
  - One update cycle carrying the planner and the module together.

## Exclusions

- Installing ModpackLib or third-party dependencies.
- Editing r2modman state.
- Discovery for managers other than r2modman. Manual targets (any folder that
  is or contains `ReturnOfModding`) are supported through the folder picker.
- macOS and Linux installers.
- Code signing (D4).
- Planner downgrade.
- Protocol, schema or executor behaviour changes. Gate 0 is movement only.
