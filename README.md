# Run Planner

Run Planner is a standalone desktop planning and simulation application for
Hades II Run Director routes.

The application owns the sophisticated part of the product:

- route and biome authoring;
- room, encounter, and reward declarations;
- decision-tree editing;
- deterministic simulation;
- semantic validation and feedback;
- project persistence and undo/redo;
- eventual compilation of a declarative execution-plan document.

The game module is deliberately outside the current implementation scope. It
will eventually accept a JSON execution plan, translate that trusted document
through fixed runtime adapters, and audit the real game against the app's
simulation. It will not contain a second planner or simulator.

## Status

Phases 0 and 1 are complete: the TypeScript application foundation and focused
F/G normalized catalog now exist, including the pure current-run requirement
evaluator registry. Phase 2 is complete with the versioned authored-project
codec, configured-route defaults, recursive F/G room state, non-null linear
topology, complete F/G semantic commands, and authored undo/redo history. Phase
2.5 is complete with the F-configured application state, route shell, and
command-bound Erebus topology and leaf editor. The post-editor audit and
cross-biome design reconciliation are complete. P, Q, H, O, I, and N close the
linear, scripted-linear, batch-local-slot, ordered multi-encounter,
conditional-terminal, and persistent-hub pressure tests.

Phases 2.6, 2.7, and 2.8 are complete. The audited reward kernel is the sole
connected F/G reward authority, and the authored project/editor use schema
version 3. All eight biomes close one catalog-wide reference matrix while
P/Q/H/O/I/N remain dormant behind the application capability boundary. Phase
3 is complete: F completeness, single-room lifecycle execution, canonical
materialization, and event-folded history through the biome transition are
implemented. F room-generation possibility, force pressure, contextual room
legality, and semantic generation findings are also implemented. F reward,
bag, acquisition, and shop orchestration feed the public deterministic
`simulateProject` composition root. Phase 3 made F simulatable while G remained
authorable but dormant until its complete product loop landed in Phase 5.

Phase 4 is complete. The browser editor publishes simulation and semantic
findings atomically with authored history, supports semantic finding
navigation and keyboard undo/redo, and introduced temporary New, Save, Load,
Export, and Import operations over normalized project JSON. A browser
interaction fixture authors the representative valid F route through visible
controls, verifies player-facing labels, and reloads equal authored and
evaluated state.

Phase 5 is complete. Generated room candidates and every
active reward/shop value are evaluated through the
same simulation authorities used by selected-plan validation. F and G now
share the complete linear simulation, candidate, editor, navigation, and
finding path; both are authorable, simulatable, and editable while later
biomes remain dormant. The current profile workflow saves and loads normalized
`ProjectDocument` files through one injected adapter, supports undoable project
names and safe filename suggestions, and tracks the exact explicit save/load
baseline. Clean, Dirty, Unsaved, and Recovered are derived from that canonical
baseline contract. A separately injected browser-local recovery channel now
debounces only authored replacements, capability-decodes startup recovery, and
preserves unreadable recovery behind an explicit discard/load blockade. The
complete F/G browser fixture now closes authoring, simulation, validation,
candidate feedback, profiles, recovery, semantic navigation, accessible
control naming, keyboard navigation, player-facing labels, and measured
responsiveness. The acceptance matrix and browser-only smoke procedure are
recorded in
[`docs/PHASE_5_PRODUCT_LOOP_CLOSURE.md`](docs/PHASE_5_PRODUCT_LOOP_CLOSURE.md).

Phase 6 now includes dormant H authored topology, canonical Fields
materialization, route-history/reward replay, and selected validation. The
shared validator applies declaration-owned eligibility, caps, sequential force
competition, terminal timing, cage bag support, and the pre-commit Fields
Min/Max support table without rewriting authored state. Application
capabilities remain limited to F/G; H candidates, editor projection, and
activation remain subsequent controlled slices.

The previous Lua/ImGui planner remains a behavioral prototype and source of
verified domain decisions. It is not the architecture authority for this app.
Useful rules are brought forward deliberately; Lib controls, ImGui drawing,
managed-storage codecs, and module lifecycle contracts are not.

## Initial Technology Direction

The initial application stack is:

- TypeScript for the catalog, authored model, simulator, and UI;
- React for UI projection;
- Vite for development and builds;
- Redux Toolkit for explicit authored edit commands and application state;
- Vitest for catalog, model, simulation, and UI-adapter tests;
- shadcn/ui and Tailwind CSS for selectively adopted UI components;
- Tauri 2 later, after the browser-hosted app needs desktop file and packaging
  capabilities.

React Flow is not a foundation dependency. It may later provide an optional
graph projection, but it will never own topology or node identity.

## Documentation Reading Order

1. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) defines product boundaries,
   package dependencies, lifecycle, and technology responsibilities.
2. [`docs/CATALOG_MODEL.md`](docs/CATALOG_MODEL.md) defines declaration
   families, source evidence, normalization, and supported game-rule scope.
3. [`docs/REWARD_MODEL.md`](docs/REWARD_MODEL.md) defines reward types, resolved
   offers, offer projections, counted bags, concrete acquisitions, history
   projections, producer bindings, shops, and reward lifecycle semantics.
4. [`docs/REWARD_GAME_DATA_AUDIT.md`](docs/REWARD_GAME_DATA_AUDIT.md) records
   the game evidence and exact, simplified, deferred, or excluded disposition
   behind the reward model.
5. [`docs/GAME_GENERATION_RULES.md`](docs/GAME_GENERATION_RULES.md) defines
   shared picker, door, cap, force, and generated-decision rules.
6. [`docs/ROOM_LIFECYCLE_MODEL.md`](docs/ROOM_LIFECYCLE_MODEL.md) defines the
   ordered single-room lifecycle, history-fragment boundary, typed effects,
   counter/cache timing, and additive audit contract.
7. [`docs/biomes/F_GAME_RULES.md`](docs/biomes/F_GAME_RULES.md) defines Erebus game behavior,
   projection decisions, and current feature coverage.
8. [`docs/biomes/G_GAME_RULES.md`](docs/biomes/G_GAME_RULES.md) defines Oceanus game behavior,
   projection decisions, and current feature coverage.
9. [`docs/biomes/P_GAME_RULES.md`](docs/biomes/P_GAME_RULES.md) pressure-tests that model
   against P and defines the dormant P declaration contract.
10. [`docs/biomes/Q_GAME_RULES.md`](docs/biomes/Q_GAME_RULES.md) defines Q's scripted stages,
    independently generated miniboss peers, reward-free spine, and repeat-run
    completion contract.
11. [`docs/biomes/H_GAME_RULES.md`](docs/biomes/H_GAME_RULES.md) defines H's cage batches,
    bridge competition, encounter multiplicity, and Fields reward projection.
12. [`docs/biomes/O_GAME_RULES.md`](docs/biomes/O_GAME_RULES.md) defines O's ship encounter
    phases, reward wheels, source-derived outgoing stores, and special rooms.
13. [`docs/biomes/I_GAME_RULES.md`](docs/biomes/I_GAME_RULES.md) defines Clockwork Goal and
    non-goal acquisition, special peers, and repeated mixed preboss batches.
14. [`docs/biomes/N_GAME_RULES.md`](docs/biomes/N_GAME_RULES.md) defines Ephyra's fixed
    entry, persistent hub board, ordered pylon visits, side rooms, and terminal
    shop effects.
15. [`docs/biomes/F_G_ROOM_TEMPLATES.md`](docs/biomes/F_G_ROOM_TEMPLATES.md) defines the
    app-native leaf contracts shared by F/G room declarations.
16. [`docs/AUTHORED_PROJECT_MODEL.md`](docs/AUTHORED_PROJECT_MODEL.md) defines
    persisted project state, topology ownership, identities, and edit commands.
17. [`docs/SIMULATION_AND_VALIDATION.md`](docs/SIMULATION_AND_VALIDATION.md)
    defines the pure derived pipeline, history, counters, validation, and
    findings.
18. [`docs/EDITOR_MODEL.md`](docs/EDITOR_MODEL.md) maps authored and derived
    state into the external editor without leaking UI structure into the
    domain.
19. [`docs/GAME_INTEGRATION_BOUNDARY.md`](docs/GAME_INTEGRATION_BOUNDARY.md)
    records the intentionally deferred app/game contract and conformance loop.
20. [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) defines the
    development order and acceptance gates.
21. [`docs/MIGRATION_PROVENANCE.md`](docs/MIGRATION_PROVENANCE.md) tracks the
    disposition and implementation status of inherited evidence.

These documents are one coherent design set. A rule belongs in exactly one
authority and should be referenced rather than copied elsewhere.

## Authority Boundaries

| Concern                                                                 | Authority                      |
| ----------------------------------------------------------------------- | ------------------------------ |
| Product layers, dependencies, lifecycle, and stack                      | `ARCHITECTURE.md`              |
| Declaration schema, provenance, normalization, and supported game facts | `CATALOG_MODEL.md`             |
| Single-room operation order and history-fragment boundaries             | `ROOM_LIFECYCLE_MODEL.md`      |
| Reward vocabulary, composition, stores, shops, and offer semantics      | `REWARD_MODEL.md`              |
| Shared picker, door, cap, force, and generated-decision game rules      | `GAME_GENERATION_RULES.md`     |
| F behavior, projection decisions, topology, and feature coverage        | `biomes/F_GAME_RULES.md`       |
| G behavior, projection decisions, topology, and feature coverage        | `biomes/G_GAME_RULES.md`       |
| P topology, encounter, exit, and dormant declaration rules              | `biomes/P_GAME_RULES.md`       |
| Q scripted topology, rewards, counters, and repeat-run completion       | `biomes/Q_GAME_RULES.md`       |
| H cage batches, bridge, counters, rewards, and completion               | `biomes/H_GAME_RULES.md`       |
| O ship phases, wheels, outgoing stores, counters, and completion        | `biomes/O_GAME_RULES.md`       |
| I Clockwork counters, conditional terminal, rewards, and completion     | `biomes/I_GAME_RULES.md`       |
| N fixed entry, persistent hub, side rooms, restores, and completion     | `biomes/N_GAME_RULES.md`       |
| F/G room-template leaf and materialization contracts                    | `biomes/F_G_ROOM_TEMPLATES.md` |
| Authored state, persistence, topology, identity, and commands           | `AUTHORED_PROJECT_MODEL.md`    |
| Materialization, history, validation, feedback, and simulation          | `SIMULATION_AND_VALIDATION.md` |
| UI projection and interaction policy                                    | `EDITOR_MODEL.md`              |
| Future execution artifact and runtime audit                             | `GAME_INTEGRATION_BOUNDARY.md` |
| Delivery sequence and acceptance                                        | `IMPLEMENTATION_PLAN.md`       |
| Legacy evidence disposition and port verification status                | `MIGRATION_PROVENANCE.md`      |

## Architectural Spine

The app preserves the established planning cycle in a framework-independent
form:

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

The authored project and immutable declarations are the only durable semantic
inputs. History, validation, candidate decoration, and UI projections are
derived and replaceable.

Simulation models possibility, not probability. An authored outcome is valid
when it belongs to the support set derived from exact game state; extreme
unlikelihood never makes a possible route invalid. Forced and impossible
boundaries are modeled, while likelihood scores, RNG seeds, and Monte Carlo
search are outside the product.

Room Declarations are unique by Hades `gameName`. Authored Room Occurrences
have their own stable persisted IDs, so several offers may reference the same
game room without conflating their leaf state or feedback identity.

## Source Evidence

During migration, two existing sources remain useful evidence:

- `../run-director-modpack/Submodules/adamantRunDirector-Run_Planner/`
  contains the Lua prototype and its revamp documents;
- `../../1GameData/Scripts/` contains the game-data reference used to verify
  declarations and simulation rules.

Neither is imported at runtime. Once a rule has been ported and covered by app
fixtures, the app's catalog and simulator become its implementation authority.

## Current Scope

The first complete product slice delivers F with shared F/G foundations:

- explicit declarations;
- authored linear-biome topology;
- complete room and reward leaf defaults;
- materialized history;
- validation and semantic feedback;
- a usable editor with undo/redo and browser-local/JSON persistence.

Before Phase 3 simulation, every remaining biome was audited and the full
feature set was reconciled. Declarations can now be imported without editor or
simulation activation. This model-coherence gate does not change the later
full-loop rollout order. P, Q, H, O, I, and N are closed; their combined
feature map is the declaration-freeze authority.

## Development

The repository uses the Linux-native Node installation already managed by
`nvm`. From WSL:

```bash
cd /home/ayyatma/wsl-projects/modding/modpacks/RunPlanner
source "$HOME/.nvm/nvm.sh"
nvm use
npm install
npm run dev
```

Activating `nvm` is important on systems where Windows npm also appears in the
WSL `PATH`; workspace symlinks must be created by Linux npm.

Run the complete local validation suite with:

```bash
npm run check
```

Individual commands are available for `typecheck`, `test`, `lint`,
`format:check`, and `build`.

Implementation status is recorded separately in
[`docs/IMPLEMENTATION_PROGRESS.md`](docs/IMPLEMENTATION_PROGRESS.md).
