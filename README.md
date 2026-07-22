# Run Planner

Run Planner is a standalone Hades II route-authoring and simulation
application for Run Director.

The application owns:

- route, biome, room, encounter, and reward declarations;
- linear decision-tree and Ephyra Hub authoring;
- deterministic game-language materialization and history;
- possibility, force, eligibility, and reward-store evaluation;
- semantic validation, findings, and contextual candidate feedback;
- project profiles, autosave recovery, and undo/redo;
- the future compilation of a declarative execution-plan document.

The game module is intentionally outside the current implementation scope. It
will eventually consume a validated execution plan through fixed runtime
adapters and audit the real run against the app's simulation. It will not own a
second planner or simulator.

## Current Product

All eight route biomes participate in the production catalog and complete
application loop:

```text
Underworld: F -> G -> H -> I
Surface:    N -> O -> P -> Q
```

Each route participant has declarations, authored state, simulation,
candidates, editor projection, profile persistence, recovery, and semantic
finding navigation. The editor supports the shared linear layout, H's
fixed-count Fields decisions, I's conditional terminal flow, O's ordered ship
encounters and reward wheels, Q's staged progression, and N's persistent Hub,
visit timeline, side rooms, and WorldShop.

The browser application is the active development host. Desktop packaging and
the app/game execution boundary remain deliberate later steps.

## Architecture

The repository is split by ownership:

```text
packages/hades2-catalog   Hades II declarations and catalog construction
packages/planner-engine   pure authored model, reward kernel, simulation, and validation
apps/planner              application composition, Redux session state, and React UI
```

The core dependency direction is:

```text
catalog construction -> pure planner engine <- application composition -> React UI
```

The architectural spine is:

```text
declarations
  -> normalized catalog
  -> authored project
  -> canonical materialization
  -> game-language history
  -> validation
  -> semantic findings
  -> editor presentation
```

The authored project and immutable catalog declarations are the durable
semantic inputs. Materialization, history, validation, candidates, findings,
and UI projections are replaceable derived results.

Important modeling contracts:

- simulation models possibility, not probability;
- game Room Declarations are unique, while authored Room Occurrences are
  repeatable and own stable persisted IDs;
- incomplete and context-invalid authored states remain editable;
- only complete-valid biomes advance the validated route prefix;
- the next active biome may publish a truthful partial evaluation without
  producing a canonical biome snapshot;
- catalog route placement means the biome's complete product loop is
  supported;
- route tabs, panel selection, findings selection, and other UI-session state
  never enter authored history.

## Technology

- TypeScript for catalog, authored model, simulator, and UI;
- React and Redux Toolkit for UI projection and application state;
- Vite for browser development and production builds;
- Vitest for domain, application, and interaction fixtures;
- Tauri 2 later, when desktop file and packaging capabilities are needed.

React Flow is not a foundation dependency. If introduced, it may render a
projection of canonical topology but will never own topology or node identity.

## Documentation Reading Order

The documents below are one coherent design set. A rule belongs in one
authority and should be referenced rather than copied elsewhere.

1. [`docs/design/ARCHITECTURE.md`](docs/design/ARCHITECTURE.md) — product
   boundaries, dependencies, lifecycle, and technology responsibilities.
2. [`docs/design/CATALOG_MODEL.md`](docs/design/CATALOG_MODEL.md) — declaration
   families, provenance, normalization, and supported game-rule scope.
3. [`docs/design/REWARD_MODEL.md`](docs/design/REWARD_MODEL.md) — rewards,
   stores, bags, shops, offer resolution, and acquisition semantics.
4. [`docs/audits/REWARD_GAME_DATA_AUDIT.md`](docs/audits/REWARD_GAME_DATA_AUDIT.md)
   — reward evidence and exact, simplified, deferred, or excluded disposition.
5. [`docs/design/GAME_GENERATION_RULES.md`](docs/design/GAME_GENERATION_RULES.md)
   — shared picker, door, cap, force, and generated-decision rules.
6. [`docs/design/ROOM_LIFECYCLE_MODEL.md`](docs/design/ROOM_LIFECYCLE_MODEL.md) —
   ordered room lifecycle, history fragments, effects, and counter timing.
7. [`docs/biomes/F_GAME_RULES.md`](docs/biomes/F_GAME_RULES.md) — Erebus.
8. [`docs/biomes/G_GAME_RULES.md`](docs/biomes/G_GAME_RULES.md) — Oceanus.
9. [`docs/biomes/P_GAME_RULES.md`](docs/biomes/P_GAME_RULES.md) — Mount Olympus.
10. [`docs/biomes/Q_GAME_RULES.md`](docs/biomes/Q_GAME_RULES.md) — Summit.
11. [`docs/biomes/H_GAME_RULES.md`](docs/biomes/H_GAME_RULES.md) — Fields of
    Mourning.
12. [`docs/biomes/O_GAME_RULES.md`](docs/biomes/O_GAME_RULES.md) — Rift of
    Thessaly.
13. [`docs/biomes/I_GAME_RULES.md`](docs/biomes/I_GAME_RULES.md) — Tartarus.
14. [`docs/biomes/N_GAME_RULES.md`](docs/biomes/N_GAME_RULES.md) — City of
    Ephyra.
15. [`docs/audits/N_SIDE_ROOM_FINDINGS.md`](docs/audits/N_SIDE_ROOM_FINDINGS.md)
    — runtime evidence for Ephyra side-room availability.
16. [`docs/audits/CROSS_BIOME_EDITOR_UX_AUDIT.md`](docs/audits/CROSS_BIOME_EDITOR_UX_AUDIT.md)
    — all-biome contextual-selection, frontier, repair, and feedback inventory.
17. [`docs/design/AUTHORED_PROJECT_MODEL.md`](docs/design/AUTHORED_PROJECT_MODEL.md)
    — persistence, topology ownership, identity, and semantic commands.
18. [`docs/design/SIMULATION_AND_VALIDATION.md`](docs/design/SIMULATION_AND_VALIDATION.md)
    — materialization, history, validation, feedback, and simulation.
19. [`docs/design/EDITOR_MODEL.md`](docs/design/EDITOR_MODEL.md) — editor
    projection, navigation, persistence UX, and interaction ownership.
20. [`docs/design/CONTEXTUAL_EDITOR_UX.md`](docs/design/CONTEXTUAL_EDITOR_UX.md)
    — contextual room/reward selection and compact picker behavior.
21. [`docs/design/GAME_INTEGRATION_BOUNDARY.md`](docs/design/GAME_INTEGRATION_BOUNDARY.md)
    — future execution artifact and runtime conformance loop.
22. [`docs/progress/IMPLEMENTATION_PLAN.md`](docs/progress/IMPLEMENTATION_PLAN.md)
    — forward delivery sequence and acceptance gates.
23. [`docs/progress/MIGRATION_PROVENANCE.md`](docs/progress/MIGRATION_PROVENANCE.md)
    — inherited evidence disposition and port verification.
24. [`docs/progress/IMPLEMENTATION_PROGRESS.md`](docs/progress/IMPLEMENTATION_PROGRESS.md)
    — completed delivery history; not design authority.

## Source Evidence

Two external sources remain useful evidence:

- `../run-director-modpack/Submodules/adamantRunDirector-Run_Planner/` contains
  the earlier Lua/ImGui prototype and revamp documents;
- `../../1GameData/Scripts/` contains the game-data reference used to verify
  declarations and simulation rules.

Neither is imported at runtime. Verified rules move into the catalog,
simulator, and focused fixtures; the previous control, storage, draw, and Lib
lifecycle machinery is not an API contract.

## Development

The repository uses the Linux-native Node installation selected by `.nvmrc`.
From WSL:

```bash
cd /home/ayyatma/wsl-projects/modding/modpacks/RunPlanner
source "$HOME/.nvm/nvm.sh"
nvm use
npm install
npm run dev
```

Activating `nvm` matters on systems where Windows npm also appears in the WSL
`PATH`; workspace symlinks must be created by Linux npm.

Run the complete validation suite with:

```bash
npm run check
```

Individual scripts are available for `typecheck`, `test`, `test:watch`,
`lint`, `format`, `format:check`, and `build`.
