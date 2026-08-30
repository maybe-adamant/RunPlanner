# Single-Route Project Document Plan

## Status

Reactivated and relocked against production base commit `659d0f5c`.

The current-boundary inventory, schema number, migration input, application
lifecycle, fixture surface, test surface, and performance base were refreshed
on 2026-08-30. Gate A began from plan commit `74002a5f` and was paused when the
schema-72 disposition changed from selecting one route to losslessly splitting
both routes. This amendment replaces that migration contract before Gate A
continues; its commit is the amended review base.

This is an isolated active cross-lane delivery contract. It is not linked from
the project README or stable design authorities. At completion, its durable
decisions move into the owning design documents and this file is removed.

## Objective

Make one persisted Run Planner document represent exactly one selected catalog
route. A new application session has no authored run until the user chooses a
route. The current catalog offers Underworld and Surface; a future Dream Dive
implementation will add the third game route without changing this one-document,
one-run boundary. Selecting a route creates the single route plan and hands it
to the existing route authoring, simulation, validation, findings, persistence,
recovery, and undo/redo infrastructure.

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

At production base `659d0f5c`:

- `ProjectDocument.routes` is an array of `AuthoredRoutePlan`;
- `createProjectDocument` creates one row for every catalog route;
- construction accepts route-keyed `configuredBiomeCounts`, even though each
  configured route is an independent run;
- the strict decoder requires the complete catalog route set in catalog order;
- project simulation maps and aggregates every authored route;
- project evaluation and structured workspace publish route arrays;
- commands locate and replace a route inside the project array;
- application startup always supplies a two-route empty fallback project;
- Redux workspace state always owns a project history and exact evaluation;
- the shell renders all catalog routes as sibling top-level tabs; and
- schema-72 checkpoints therefore contain both route rows even when only one is
  meaningfully authored.

The live catalog version is `0.51.0-biome-i-encounter-profiles` and exposes the
fixed Underworld `F/G/H/I` and Surface `N/O/P/Q` declarations. Dream Dive is not
yet a catalog route. The repository has 28 canonical checkpoint JSON files; all
are schema 72 and carry both standard route rows. A source inventory finds the
route-collection shape in 31 planner-engine production files and 12 planner
application production files. The current test surface has 264 test files and
2,265 direct `it`/`test` declarations; these counts are diagnostic baselines,
not acceptance targets.

The catalog route collection remains correct. It declares which route types can
be chosen and the ordered biomes belonging to each. The defect is carrying all
catalog alternatives into one authored run document.

## Locked Model

### One selected route per document

Schema 73 replaces the project route array with one explicit route plan:

```ts
interface ProjectDocument {
  readonly schemaVersion: 73;
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
against the catalog. For the two current fixed routes, it validates `biomes` as
a prefix of the declaration's fixed order.

The final model must not retain a one-element `routes` array, a `routes` getter,
a compatibility facade, or a shadow route collection. Those would preserve the
superseded ownership shape without serving a second concrete run.

Route-specific construction is equally singular:

```ts
interface CreateProjectDocumentOptions {
  readonly projectId: string;
  readonly routeKey: string;
  readonly configuredBiomeCount?: number;
}
```

There is no route-keyed configured-count record after the cutover. The engine
validates the selected key and initializes only that route. Test support may
offer an explicit convenience default; production construction may not.

### Dream Dive compatibility without Dream implementation

The game has three conceptual routes: Underworld, Surface, and Dream Dive.
Dream Dive reuses four biomes from the standard biome set in a run-specific
order. The correct eventual persisted unit is still one Dream Dive route in one
document, with that route plan owning its chosen four-biome sequence. It is not
an Underworld row, a Surface row, and a Dream row bundled into one project.

This gate does not add Dream Dive declarations, selection, randomization,
biome-order authoring, ordinal Dream Postboss rooms, or Dream-only rules. It
also does not generalize the current fixed-route declaration contract in
advance. When Dream Dive is implemented, its catalog route policy must define
the allowed biome domain and its authored route instance must persist the
chosen order. The schema-73 singular root and route-qualified semantic
addresses already provide the required ownership boundary.

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

On the current catalog the chooser therefore shows exactly Underworld and
Surface. It must not show a speculative disabled Dream Dive choice. Dream Dive
appears automatically only after its declaration and construction policy are
implemented in a later slice.

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

The open route identity is derived from `document.route.routeKey`; editor
session state does not duplicate it as a selectable `activeRouteKey`.
Presentation may retain one transient `route | settings` section choice and one
singular `RoutePanel`, but not a route-keyed panel map or another authored-route
selector.

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

When no project is open, the file controls expose New-route selection and Load,
but omit project status, Save, Undo, and Redo. When New is invoked from an open
project, the chooser-open flag is transient editor/application state: Cancel
restores the untouched open project, while selecting a route atomically replaces
the document, history, evaluation, profile metadata, and route-local session
state.

Choosing a route while recovery is blocked does not discard or overwrite the
unreadable recovery payload. It may open an unsaved project, but autosave stays
suspended until explicit Discard Autosave; unblocking then makes the current
project eligible for the ordinary autosave publication. A successful Load may
replace the workspace and clear the blockade only after the loaded document
decodes.

## Schema-72 Split Boundary and Migration Reset

Schema 72 always contains two independent authored runs: Underworld and
Surface. Schema 73 makes one route one document, so `72 -> 73` is a one-to-many
split rather than an ordinary linear migration. The converter must not ask the
user which route to discard and must not infer intent from configured biome
count, filename, current UI session, catalog order, or an apparently default
sibling loadout.

The accumulated schema-49-through-72 migrator is retired at this boundary.
Supporting arbitrarily long migration chains would preserve syntactically
readable files while allowing many intervening semantic changes to make them
misleading. Schema 73 becomes the new baseline for future linear migrations.
The repository retains only a focused schema-72-to-73 splitter for the
immediately preceding document shape; schema 71 and older are deliberately no
longer supported migration inputs.

The standalone boundary is explicit about the fork:

```text
node schema/split-project-72-to-73.js INPUT
```

Locked rules:

1. The splitter accepts exactly schema 72 with the expected catalog version and
   rejects older, newer, malformed, missing-route, or duplicate-route inputs.
2. One invocation emits two schema-73 sibling files, one containing the complete
   Underworld `AuthoredRoutePlan` and one containing the complete Surface plan.
3. Each output preserves the source root metadata and copies its selected route
   subtree exactly; it does not reconstruct loadout, resource, biome, topology,
   occurrence, or room-local state.
4. The source object and source file are never mutated. There is no `--route`,
   `--target`, or `--in-place` mode for this one-to-many operation.
5. Default output names include the normalized route key and schema number so
   both products are unambiguous siblings of the source. Output paths are
   preflighted and existing files are not silently overwritten.
6. The programmatic splitter returns both route-keyed documents and the CLI
   reports both written paths. The CLI does not hide a route-selection policy.
7. The old general migration implementation and its historical jump tests are
   deleted rather than wrapped by the splitter. A future schema-74 migration
   starts a fresh linear chain at schema 73.
8. The strict production decoder remains current-schema only. In-app legacy
   migration is not introduced by this plan.

Canonical checkpoint fixtures are intentionally narrower than a general user
document: every manifest row already declares the single route whose behavior
the fixture witnesses. Fixture conversion runs the same pure split, retains the
manifest-named output, and discards the irrelevant sibling. A witness must prove
that each retained schema-73 route deep-equals its schema-72 subtree and that
the source object was not mutated. Fixture conversion must not mass-default or
re-author nested state.

Catalog version `0.51.0-biome-i-encounter-profiles` remains unchanged; this is
an authored transport and ownership correction, not a catalog-fact change.

## Ownership by Lane

### Hades II catalog

The catalog continues to own the collection of route declarations, their labels,
and ordered biome references. No catalog schema or declaration change is
required.

### Planner engine

The engine owns:

- schema 73 and the single-route `ProjectDocument` contract;
- route-specific project construction and strict decoding;
- command matching and immutable replacement of the sole route;
- one-route simulation, findings, summary, exact assembly, and candidate
  artifacts;
- rejection of cross-route semantic addresses and commands; and
- the focused schema-72-to-73 split transformation, migration-baseline reset,
  and their tests.

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
That helper defaults to Underworld and accepts an explicit catalog route key or
complete project override; tests of startup, route choice, loading, and recovery
continue to call production `createApplication()` directly. The helper is
test-only; production must not gain a hidden environment-dependent default
merely to avoid migrating tests.

Underworld and Surface fixtures remain separate files and now contain only their
named route. Performance scenarios continue to prepare independent Underworld
and Surface projects rather than combining both into one document.

## Delivery Gates and Commit Boundaries

### Plan commit

This reactivated plan is committed alone and changes no production behavior.
Its commit becomes the implementation base for Gate A; the performance baseline
remains the production commit recorded in Status.

### Gate A — Atomic single-route vertical slice

This is one implementation gate and one Conventional Commit. It is intentionally
atomic because splitting the schema correction from route creation would either
make one catalog route temporarily impossible to author or preserve a hidden
second route. Internal work may proceed in the passes below, but the gate is not
reviewable or committable until all passes form one coherent product.

#### Pass A1 — Authored contract and schema-72 split

- replace `ProjectDocument.routes` with `ProjectDocument.route`;
- replace route-keyed `configuredBiomeCounts` with one required `routeKey` and
  one optional `configuredBiomeCount`, validated through the catalog;
- update strict codec paths and round-trip products;
- replace the accumulated linear migrator with the focused lossless
  schema-72-to-73 splitter;
- migrate every canonical JSON checkpoint through the split and retain its
  manifest-declared route;
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
- derive the open route identity from the document and replace route switching
  with one transient route/Settings section choice;
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
- an editor-session `activeRouteKey` that duplicates the open document route;
- a fallback project created before route selection;
- autosave of a placeholder or null-route document; or
- a production compatibility decoder accepting both schema shapes;
- the retired schema-49-through-72 linear migration chain; or
- route-selection, target-version, or in-place flags on the one-to-many
  schema-72 splitter.

Catalog route collections and route-qualified semantic addresses are explicitly
not deletion targets.

### Gate B — Closure absorption

After Gate A passes independent review and its accepted findings are remediated:

- update `AUTHORED_PROJECT_MODEL.md` with schema 73 and one-route persistence;
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
- the focused splitter rejects anything other than the exact schema-72 boundary;
- one split emits exactly the Underworld and Surface documents, preserves both
  complete route subtrees, leaves the source unchanged, and never overwrites an
  existing output;
- fixture migration retains exactly the manifest-declared split product; and
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
- selecting a route while recovery is blocked preserves the unreadable payload
  and schedules no autosave; explicit discard then makes that open project the
  first autosave-observable document;
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
- a same-host performance comparison against `659d0f5c` checks that removing
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
4. the schema-72 splitter emits both routes without mutation, inference, silent
   overwrite, or a hidden route-selection mode, and the retired historical
   migration chain is actually deleted;
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
- migration support for schema 71 or older;
- selecting or guessing one schema-72 route in the general splitter;
- implementing Dream Dive route declarations, random or authored biome order,
  Dream Postboss rooms, or Dream-only game rules;
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
application products are singular through the complete pipeline, the
schema-72 split preserves both routes without mutating its source, both standard
routes retain their full behavior independently, all superseded multi-route and
historical migration paths are deleted, durable authorities absorb the
decision, this temporary plan is removed, and the complete repository closure
gate passes.
