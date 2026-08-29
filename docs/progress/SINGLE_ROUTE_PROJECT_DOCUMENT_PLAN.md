# Single-Route Project Document Plan

## Status

Deferred nice-to-have, recorded against base commit `e7fa43ab`.

Implementation is not currently authorized. Before this plan is reactivated,
re-audit its current-boundary inventory, schema number, migration inputs,
application lifecycle, test counts, and performance base against the then-live
repository. Amend and recommit any drift before starting Gate A.

This is an isolated future cross-lane delivery contract. It is not linked from
the project README or stable design authorities. If reactivated and completed,
its durable decisions move into the owning design documents and this file is
removed.

## Objective

Make one persisted Run Planner document represent exactly one selected catalog
route. A new application session has no authored run until the user chooses an
Underworld, Surface, or future catalog route. Selecting a route creates the
single route plan and hands it to the existing route authoring, simulation,
validation, findings, persistence, recovery, and undo/redo infrastructure.

The user-visible result is:

1. a fresh application presents a catalog-driven route chooser rather than two
   empty sibling route workspaces;
2. choosing one route creates a new unsaved plan for that route;
3. one saved JSON file contains only that route's loadout, resource placements,
   and biome plans;
4. opening or recovering a current-schema file enters its route directly; and
5. creating a plan for another route creates another document rather than
   retaining or switching to hidden sibling route state.

This is an authored-project correction, not only a navigation redesign. The
current model creates every catalog route in every project, the decoder requires
all of them, the simulator evaluates all of them, and the application exposes
them as switchable siblings. That container shape can represent two independent
runs in one file even though the execution product is one run.

## Current Live Boundary

At the base commit:

- `ProjectDocument.routes` is an array of `AuthoredRoutePlan`;
- `createProjectDocument` creates one row for every catalog route;
- the strict decoder requires the complete catalog route set in catalog order;
- project simulation maps and aggregates every authored route;
- project evaluation and structured workspace publish route arrays;
- commands locate and replace a route inside the project array;
- application startup always supplies a two-route empty fallback project;
- Redux workspace state always owns a project history and exact evaluation;
- the shell renders all catalog routes as sibling top-level tabs; and
- schema-70 checkpoints therefore contain both route rows even when only one is
  meaningfully authored.

The catalog route collection remains correct. It declares which route types can
be chosen and the ordered biomes belonging to each. The defect is carrying all
catalog alternatives into one authored run document.

## Locked Model

### One selected route per document

Schema 71 replaces the project route array with one explicit route plan:

```ts
interface ProjectDocument {
  readonly schemaVersion: 71;
  readonly projectId: string;
  readonly catalogVersion: string;
  readonly route: AuthoredRoutePlan;
}

interface AuthoredRoutePlan {
  readonly routeKey: string;
  readonly loadout: RouteLoadout;
  readonly resourcePlacements: ResourcePlacements;
  readonly biomes: readonly AuthoredBiomePlan[];
}
```

The route remains nested as one coherent plan rather than flattening its fields
into transport metadata. There is no additional root `routeKey`; the sole
`route.routeKey` is the persisted route-type variable. The decoder validates it
against the catalog and validates its biomes as a prefix of that declaration.

The final model must not retain a one-element `routes` array, a `routes` getter,
a compatibility facade, or a shadow route collection. Those would preserve the
superseded ownership shape without serving a second concrete run.

### No persisted null route

The route chooser is application state before a project exists. It is not
represented by `route: null`, an empty route key, a placeholder project, or a
special authored-project status. Every `ProjectDocument` accepted by the engine
has one real catalog route and can be simulated.

Application workspace state becomes a closed union:

- `noProject`: no history, evaluation assembly, or structured workspace exists;
- `openProject`: one project history and its exact evaluation assembly exist.

Choosing a route, loading a file, or restoring a valid autosave publishes a new
`openProject`. Creating a project starts a fresh history at that document; Undo
does not cross back into the route chooser. Choosing **New** while a project is
open must permit cancelling the chooser without destroying the current project;
the replacement occurs only when a route is selected.

### Route identity remains in semantic addresses

This change does not remove `routeKey` from biome, occurrence, encounter,
acquisition, trait, finding, or Run State addresses. Those keys remain stable
game-domain identity and allow every command or query to reject an address for
a route other than `document.route.routeKey`. Removing them would be an
unrelated address-schema rewrite and would make local products less explicit.

### One route evaluation and workspace

`ProjectEvaluation` publishes one `route: ProjectRouteEvaluation`, not a
one-element route array. Project status, findings, and summary derive from that
route without multi-route reduction. `ProjectEvaluationAssembly` continues to
bind the exact authored document, public evaluation, and private candidate
artifacts from one simulation attempt.

`StructuredWorkspaceProjection` likewise publishes one `route: WorkspaceRoute`.
Application projections must not re-wrap it in an array. Catalog-driven route
choice and editor-navigation declarations may continue to expose collections
because they describe available route types, not authored route instances.

### Route creation and navigation

The application route chooser projects the normalized catalog route collection.
React does not hardcode Underworld, Surface, their biome keys, or a closed route
union. Selecting a choice calls an application-owned operation that constructs
the engine-owned default document for that route.

Once open:

- the top-level shell identifies the selected route and retains access to
  Settings;
- it does not render other catalog routes as switches;
- the existing Route / biome / non-empty-index rail remains the selected route's
  authoring navigation;
- route-panel session state is singular rather than retained in a map for every
  catalog route; and
- semantic navigation still validates that every addressed route matches the
  open document.

The route chooser is also the fresh-start surface after an unreadable recovery
payload is blocked. The blocked recovery disclosure and discard/load actions
remain available; the application must not create a hidden fallback document
that could overwrite the preserved recovery value.

### New, load, save, recovery, and autosave

- **New** opens or reveals the route chooser. It does not create a document
  until a route is selected.
- **Load** remains available with no project open and decodes a current-schema
  single-route document directly.
- **Save** and authored history controls are unavailable with no open project.
- A valid autosave restores its one selected route directly.
- No autosave write is scheduled while no project is open.
- The first route selection and every later effective authored publication are
  ordinary autosave-observable project publications.
- A blocked recovery continues to suspend autosave until the user loads a valid
  profile or explicitly discards recovery.
- Profile status remains `Unsaved`, `Recovered`, `Clean`, or `Dirty` only for an
  open project. The empty chooser does not invent a fifth persisted-project
  status.

## Legacy Schema-70 Disposition

Schema 70 always contains all catalog routes, so converting it to a one-route
document is potentially lossy. Migration must never guess the intended route
from configured biome count, filename, current UI session, catalog order, or an
apparently default sibling loadout.

The standalone migration boundary gains an explicit route selection when a
migration crosses schema 70 to 71:

```text
node schema/migrate-project.js --route Surface INPUT
```

Locked rules:

1. `--route ROUTE_KEY` is required when crossing `70 -> 71`.
2. The selected route must exist exactly once in the schema-70 document.
3. Migration copies that complete `AuthoredRoutePlan` without reconstructing
   loadout, resource, biome, topology, occurrence, or room-local state.
4. The source file remains untouched unless the existing explicit `--in-place`
   option is used.
5. A file with meaningful content in both routes is converted twice with two
   explicit route choices and two output paths; no special split-file framework
   is added.
6. The migration result reports the selected route key and omitted sibling route
   keys.
7. Targeting schema 70 or earlier does not require a route option.
8. The strict production decoder remains current-schema only. In-app legacy
   migration is not introduced by this plan.

All canonical checkpoint fixtures migrate explicitly to their named route. A
migration witness must prove that selecting each route from a synthetic
two-authored-route schema-70 document preserves the selected subtree exactly
and never mutates the input. Fixture conversion must not mass-default or
re-author nested state.

Catalog version `0.49.0-completion-topology` is unchanged because this is an
authored transport and ownership correction, not a catalog-fact change.

## Ownership by Lane

### Hades II catalog

The catalog continues to own the collection of route declarations, their labels,
and ordered biome references. No catalog schema or declaration change is
required.

### Planner engine

The engine owns:

- schema 71 and the single-route `ProjectDocument` contract;
- route-specific project construction and strict decoding;
- command matching and immutable replacement of the sole route;
- one-route simulation, findings, summary, exact assembly, and candidate
  artifacts;
- rejection of cross-route semantic addresses and commands; and
- the explicit schema-70-to-71 migration transformation and its tests.

Functions that currently search, map, or flatten project routes must either
operate directly on `document.route` or disappear. A generic collection helper
must not be introduced to disguise the old model.

### Planner application

The application owns:

- the `noProject | openProject` Redux coordination state;
- route-choice composition from catalog navigation data;
- New/Load/Save/recovery/autosave behavior around the no-project state;
- one structured route projection and one active route-panel session;
- the selected-route/Settings shell and chooser presentation; and
- reconciliation of transient navigation when projects are created, loaded,
  replaced, undone, or closed back to the chooser.

React renders route choices and dispatches the application operation. It does
not construct route defaults or decide whether a route key is legal.

### Test support and fixtures

Production `createApplication()` must start without a project when no recovery
or explicit construction input is supplied. Tests that need an already-open
workspace use a clearly named test-support `createOpenTestApplication` helper.
That helper defaults to Underworld and accepts an explicit route or complete
project override; tests of startup, route choice, loading, and recovery continue
to call production `createApplication()` directly. The helper is test-only;
production must not gain a hidden environment-dependent default merely to avoid
migrating tests.

Underworld and Surface fixtures remain separate files and now contain only their
named route. Performance scenarios continue to prepare independent Underworld
and Surface projects rather than combining both into one document.

## Delivery Gates and Commit Boundaries

### Plan commit

This deferred plan is committed alone and changes no production behavior. A
future activation must first complete and commit the fresh audit required by
the Status section.

### Gate A — Atomic single-route vertical slice

This is one implementation gate and one Conventional Commit. It is intentionally
atomic because splitting the schema correction from route creation would either
make one catalog route temporarily impossible to author or preserve a hidden
second route. Internal work may proceed in the passes below, but the gate is not
reviewable or committable until all passes form one coherent product.

#### Pass A1 — Authored contract and legacy migration

- replace `ProjectDocument.routes` with `ProjectDocument.route`;
- require `routeKey` when constructing a project and validate it through the
  catalog;
- update strict codec paths and round-trip products;
- add explicit `--route` migration input for `70 -> 71`;
- migrate every canonical JSON checkpoint to its explicit route; and
- remove superseded all-catalog-route count/order requirements from the authored
  document.

#### Pass A2 — Commands, simulation, candidates, and projections

- replace all project route searches/maps with sole-route operations;
- reject route-mismatched commands and queries at their existing contract
  boundaries;
- publish singular project evaluation and structured workspace route products;
- remove multi-route aggregation and compatibility products;
- keep route-local chronology, availability, resource, trait, Shrine delivery,
  Hub, and completion behavior unchanged; and
- update Underworld and Surface engine fixtures as independent single-route
  witnesses.

#### Pass A3 — Application lifecycle and persistence

- introduce the closed no-project/open-project workspace state;
- prevent selectors, candidate sessions, and structured workspace projection
  from being invoked before a project exists;
- make New require a route choice and keep cancellation non-destructive;
- keep Load available and disable Save/history without a project;
- make startup/recovery/autosave operate correctly without a fallback document;
  and
- reconcile editor-session state when one selected route becomes available or
  is replaced by another document.

#### Pass A4 — Route chooser and selected-route workspace

- render catalog-driven choices on fresh startup;
- remove sibling route switching from an open document;
- retain a clear selected-route identity and Settings access;
- make route-panel state singular;
- render the existing workspace and all contextual dialogs only when a project
  is open; and
- preserve semantic navigation into the selected route's biomes, findings,
  route indexes, and room-local editors.

#### Required deletion

Gate A is incomplete while any of these remain in production:

- `ProjectDocument.routes` or a one-element substitute;
- `ProjectEvaluation.routes`;
- `StructuredWorkspaceProjection.routes`;
- project-wide route `find`, `map`, `flatMap`, count, or catalog-order checks;
- `activePanelByRoute` or sibling authored-route tabs;
- a fallback project created before route selection;
- autosave of a placeholder or null-route document; or
- a production compatibility decoder accepting both schema shapes.

Catalog route collections and route-qualified semantic addresses are explicitly
not deletion targets.

### Gate B — Closure absorption

After Gate A passes independent review and its accepted findings are remediated:

- update `AUTHORED_PROJECT_MODEL.md` with schema 71 and one-route persistence;
- update `SIMULATION_AND_VALIDATION.md` and `ARCHITECTURE.md` with singular route
  evaluation and pipeline language;
- update `EDITOR_MODEL.md` and `STRUCTURED_EDITOR_WORKSPACE.md` with the route
  chooser, selected-route navigation, and no-project application state;
- record the completed schema and migration disposition in
  `IMPLEMENTATION_PROGRESS.md`;
- correct stale schema numbers touched in those authorities;
- remove this temporary plan; and
- run the one complete repository closure gate.

Gate B is documentation absorption and verification, not a second opportunity
to repair an incomplete Gate A model.

## Primary Tests and Product Witnesses

### Authored model and migration

- construction creates exactly the requested Underworld or Surface route;
- codec round trips each route and rejects unknown routes, the old `routes`
  property, duplicate transport fields, and out-of-prefix biomes;
- a command addressed to another route is rejected without changing identity;
- `70 -> 71` fails without explicit route selection;
- selecting either route preserves that complete route subtree and leaves the
  source object unchanged; and
- all checkpoint fixtures pass integrity and current-schema decoding.

### Simulation and candidates

- Underworld evaluation contains only Underworld biomes, findings, summaries,
  candidate artifacts, and route-start state;
- Surface evaluation contains only Surface equivalents;
- no empty sibling route affects project status, finding count, availability,
  resources, keepsakes, traits, or execution eligibility;
- representative F/G/H/I and N/O/P/Q checkpoints retain their established
  canonical histories; and
- exact assembly identity and cached candidate/Undo behavior remain intact.

### Application and persistence

- fresh startup shows route choices and does not evaluate, autosave, or expose
  Save/Undo/Redo;
- choosing Underworld or Surface creates one unsaved project and opens its route
  overview;
- cancelling New while a project is open preserves its document, history,
  profile metadata, evaluation, and active workspace;
- loading a current file from the chooser opens its selected route;
- valid recovery opens the recovered route, while invalid recovery remains
  blocked without a fallback-project autosave;
- selecting a route after discard establishes the first autosave-observable
  document;
- Settings can be entered and the selected route workspace can be resumed; and
- opening or replacing a project clears stale route-panel, finding, dialog, and
  Run State destinations that belong to another route.

### Product loops and performance

- one browser product witness creates and authors an Underworld plan from the
  chooser;
- one creates and authors a Surface plan;
- save/load round trips the route identity and returns to the same workspace;
- the performance snapshot still publishes the established eight independent
  Underworld/Surface metrics using single-route inputs; and
- a same-host performance comparison against `e7fa43ab` checks that removing
  sibling-route evaluation does not regress rebuild, candidate, edit, or cached
  Undo behavior.

During implementation use the narrowest owning-lane tests. At phase closure run
fixture integrity, typecheck, lint, format/diff checks, production build, the
performance comparison, and exactly one complete `npm run check`. Do not rerun
the complete gate after unchanged narrow suites already establish a sequential
pass.

## Independent Review Audits Against

The Gate A reviewer receives the base commit, full gate diff, this locked plan,
and validation results. Review must specifically audit:

1. no route collection survives in authored, evaluation, or structured-workspace
   products;
2. no route-key legality or route-choice policy moved into React;
3. no placeholder project is created or autosaved before route selection;
4. no legacy migration path silently chooses or discards a route;
5. no test-only default leaked into production construction;
6. no semantic address lost its route identity;
7. route-local simulation chronology and downstream candidate behavior did not
   change while removing outer aggregation;
8. fixture migration preserved selected subtrees rather than re-authoring them;
9. New cancellation and blocked recovery cannot destroy the open or preserved
   document; and
10. production code and tests have net deletion of multi-route coordination
    rather than a second abstraction layered over it.

The main session performs the final bird's-eye review and owns every finding
disposition, closure documentation, and Git operations.

## Explicit Non-Goals

- authoring, comparing, or merging several runs in one file;
- a multi-document project manager or recent-files workspace;
- in-app migration of legacy schemas;
- guessing a legacy route from authored depth or filename;
- adding Dream routes, alternate biome placements, or new route declarations;
- changing any room, reward, encounter, trait, resource, Shop, Shrine, Well,
  Pool, keepsake, or biome game rule;
- removing route keys from semantic addresses or persisted acquisition keys;
- changing catalog route identity or globally unique biome declarations;
- adding a generic run-type hierarchy, plugin route registry, or dependency
  container; and
- retaining a compatibility array to reduce mechanical migration work.

## Completion Definition

The plan is complete only when a fresh app owns no project until route choice,
every current JSON document contains exactly one explicit route plan, engine and
application products are singular through the complete pipeline, legacy route
selection is explicit and non-destructive, both standard routes retain their
full behavior independently, all superseded multi-route production paths are
deleted, durable authorities absorb the decision, this temporary plan is
removed, and the complete repository closure gate passes.
