# Catalog Maintainability and Decomposition Plan

## Status and base

Status: **Draft for review; implementation has not started.**

Planning base: `af4cc56b`

This plan is confined to `packages/hades2-catalog` except for a narrowly
proved adjustment to the planner engine's normalized catalog types when an
exact literal type is itself forcing the catalog to repeat source data. It
does not authorize planner simulation, authored-project, application, UI, or
game-module changes.

## Objective

Make the Hades II catalog easier to navigate and change without weakening its
strict source-to-catalog boundary.

The delivered catalog should have:

- one authoritative declaration for each supported game fact;
- a small composition root that makes compilation order visible;
- normalizers decomposed by the complete product or policy they own;
- explicit room and biome declarations whose important differences remain
  readable without executing builder layers;
- tests grouped by durable policy authority rather than catch-all regression
  files; and
- the same immutable normalized catalog product and downstream behavior as the
  base commit.

This is a targeted cleanup, not a catalog rewrite.

## Current baseline

At the planning base:

- catalog dependency direction is clean: production source consumes only the
  planner engine's public catalog-schema, reward-kernel, and requirements
  contracts;
- the package public surface is limited to the compiled `catalog`,
  `createCatalog`, `CatalogContractError`, and the catalog input type, with a
  separate test-support export;
- construction is deterministic and normalized products are frozen;
- no application, React, Redux, authored-project, or simulation implementation
  is imported by catalog production code;
- `npm run test:catalog` passes 24 files and 256 tests in approximately two
  seconds; and
- the worktree is clean.

Size is diagnostic rather than an acceptance target:

| Neighborhood | Approximate lines | Observed concern |
| --- | ---: | --- |
| `src/declarations` | 23,677 | Mostly legitimate explicit game data; a few oversized change neighborhoods |
| `src/compiler` | 9,614 | Several mixed-responsibility normalization and closure hubs |
| `test/catalog` | 9,727 | Strong coverage, but two catch-all owners and repeated mutation setup |
| `compiler/room-normalization.ts` | 1,097 | One function coordinates and implements most room fact families |
| `compiler/layouts.ts` | 1,018 | Generated, Hub, start, and completion variants share one implementation file |
| `test/catalog/traits.test.ts` | 2,047 | Several independent trait policy matrices share one suite |
| `declarations/rooms/n.ts` | 1,741 | Fixed, Hub-main, side-room, and completion declarations share one file |
| `declarations/traits/weapon-upgrade.ts` | 1,684 | Six independent weapon inventories share one file |

Historical change concentration supports the same diagnosis:
`declarations/types.ts`, the generic regression suite, route-detour tests,
trait closure tests, `compiler/traits.ts`, and `declarations/index.ts` are the
most frequently touched catalog files.

## Governing authorities

- [`CATALOG_MODEL.md`](../design/CATALOG_MODEL.md) owns the raw-to-normalized
  boundary, declaration authority, immutability, and source auditability.
- [`ARCHITECTURE.md`](../design/ARCHITECTURE.md) owns package dependency
  direction, construction flow, code placement, and refactoring discipline.
- Focused source audits under `docs/audits/` remain the authority for surprising
  game behavior. This cleanup does not reinterpret their findings.
- The planner engine owns the normalized `Catalog` interface. A catalog cleanup
  may adjust that interface only when all consumers treat an exact source value
  parametrically and the runtime normalized product remains unchanged.

## Locked boundaries

### Behavior and compatibility

- The normalized catalog produced from the production declarations must remain
  structurally and value-equivalent to the base product unless a separately
  identified defect is removed from this plan and handled as its own modeling
  change.
- No authored schema, execution protocol, save migration, catalog compatibility
  version, or fixture migration is required for behavior-preserving movement or
  a TypeScript-only broadening of a normalized field whose runtime value is
  unchanged.
- Existing construction failure order remains stable where a test or caller
  observes it. Moving a validator does not reorder compilation stages.
- Strict rejection of malformed shapes, unknown discriminants, duplicate keys,
  unresolved references, unsupported capabilities, and invalid cross-family
  combinations remains production behavior.

### One source of game facts

Production normalization must not independently restate a declaration dataset
merely to attest that the declaration contains the expected source values.

Every exact compiler check is classified before removal:

1. **Supported-shape invariant** — a downstream consumer implements only this
   closed form. Keep the check in production and locate it with the owning
   normalizer or relational closure.
2. **Relational invariant** — independently declared facts must agree. Keep one
   cross-product closure check without copying either fact.
3. **Source-data attestation** — an exact key set, count, label, numeric table,
   or placement matrix is repeated only to prove the production declarations
   match audited game data. Keep the fact in declarations and its exact witness
   in the focused catalog test; remove the second production table.

The compiler may derive complete normalized defaults from a declared semantic
kind. It may not infer a second game policy from a key when that same policy is
already present in the declaration.

### Decomposition discipline

- Split by semantic owner and complete returned product, not by line count.
- Preserve one visible ordered assembler for the catalog, one room, one biome
  layout, and one trait catalog.
- New helpers receive explicit inputs and return every fact their caller needs.
  No registration, ambient state, sidecar maps, service containers, or staged
  mutable objects may cross a module boundary.
- Do not introduce generic Room, Trait, or Keepsake builders. Explicit
  source-backed differences remain visible at their declaration site.
- Do not create forwarding-only modules or barrels merely to shorten imports.
  An assembly module is allowed when it visibly concatenates complete domain
  declaration families.
- A responsibility moves with its primary tests, and the superseded path is
  removed in the same commit.

### Tests

- Each policy matrix has one primary test owner. Integration and normalized
  snapshot tests retain representative contact rather than duplicate the
  matrix.
- Catalog snapshot hashes may remain as the existing coarse change detector,
  but they are not evidence that an individual policy is correct.
- Shared test support may clone production declarations and locate entries; it
  must not reproduce normalization or semantic policy.
- Do not add durable tests whose sole purpose is proving that an old file,
  helper, or implementation path no longer exists.

## Target responsibility shape

The exact filenames may adjust during implementation, but the ownership seams
are fixed.

```text
declarations
  catalog input assembly
  family-local raw types and explicit facts
  rooms
    biome-owned explicit declaration families
  traits
    provider declarations
    weapon-owned Hammer declarations

compiler
  createCatalog                 ordered construction only
  rooms
    room assembly
    identity/template
    encounters
    exits/detours
    rewards/features
    Fields/local children
    collection/template/layout closure
  layouts
    layout assembly
    start/completion
    generated progression
    Hub progression
  encounters
    envelope normalization
    definition normalization
    set normalization
    encounter relational closure
  traits
    trait catalog assembly
    weapons/aspects/traits/givers/offers/dispositions/Chaos/Hexes
  rewards
    existing decomposed reward compiler
```

This is a responsibility map, not a mandate to pre-create every directory.
Directories emerge only as a complete vertical slice moves into them.

## Delivery gates and commit boundaries

### Gate A — Catalog composition and relational closure ownership

Make `createCatalog` an ordered composition root rather than a semantic policy
owner.

1. Move Hex/God Sent/Keepsake closure to the Hex or trait-catalog neighborhood.
2. Move room/profile/reward lifecycle closure to the lifecycle neighborhood.
3. Move Echo Gift/Keepsake agreement to the keepsake closure neighborhood.
4. Move fixed acquisition grants and acquisition-role/giver agreement to their
   reward and trait-giver owners.
5. Move the Nemesis event contract to an encounter relational-closure owner.
6. Leave `createCatalog` visibly ordering normalization, closure, and final
   immutable assembly.
7. Preserve the current failure order and normalized product.

Expected deletion: all domain validator bodies and source matrices currently
embedded in `compiler/createCatalog.ts`; no forwarding wrappers remain there.

Primary verification:

- focused Hex, Keepsake, lifecycle, encounter, reward-acquisition, and trait
  giver suites;
- normalized biome hashes remain unchanged; and
- catalog package typecheck.

### Gate B — Declaration authority and Keepsake vertical slice

Use Keepsakes as the first complete single-authority correction because their
declaration and compiler currently contain parallel key switches and exact
rank tables.

1. Inventory the Keepsake compiler checks under the three locked categories.
2. Make the declaration surface directly readable as complete entries or small
   effect-family groups; remove the declaration's long key-conditioned object
   construction.
3. Normalize the closed effect and Echo Gift unions generically by
   discriminant, field shape, numeric validity, and references.
4. Retain genuine cross-fact constraints, such as matching an Olympian pressure
   effect to its declared provider, without restating the nine-entry source
   table in the compiler.
5. Keep the exact ordinary inventory, source rank profiles, Fated dispositions,
   and Gift schedules in one focused catalog test authority.
6. Audit every affected engine consumer before broadening an exact literal
   catalog type. Broaden only fields whose consumers use the published value;
   retain literal constraints when an engine algorithm actually assumes the
   constant.
7. Update `CATALOG_MODEL.md` only where its current wording claims the compiler
   independently rejects what is now a declaration-plus-test source
   attestation.

Expected deletion: the duplicate authoritative key set, enabling/opposing sets,
key-by-key Echo switch, key-by-key effect switch, and repeated exact rank tables
from the compiler. Any retained key-specific branch requires a documented
consumer assumption.

Primary verification:

- `keepsakes.test.ts` owns the exact source matrix and malformed union shapes;
- Echo Gift and trait/keepsake relational tests retain representative contact;
- engine tests for each supported Keepsake effect prove published-value use;
- production normalized catalog equality remains unchanged.

### Gate C — Room compiler decomposition

Decompose `room-normalization.ts` while preserving `normalizeRoom` as the
single explicit assembler.

1. Isolate core identity, room-set, mode/template, caps, counters, structural
   tags, and room eligibility.
2. Isolate encounter envelope and slot binding normalization.
3. Isolate physical and additional exit normalization, including Chaos,
   Zagreus Contract, and automatic host-continuation constraints.
4. Isolate incoming/local reward bindings, reward-store history, Preboss
   policy, and room-owned reward surfaces.
5. Isolate room features: resources, Shops, anchors, fountain, Pool, required
   objects, Infernal Contract, and related capability validation.
6. Keep Fields spatial and bounded local-child normalization in one coherent
   Fields product rather than scattering its coupled constraints.
7. Keep collection closure, template closure, and room-layout closure as
   explicit later stages; do not fold them back into local normalization.

Expected deletion: policy implementations from the monolithic function and
the current flat collection of separately named `room-*` files once their
responsibilities have moved. `normalizeRoom` remains only as the readable
assembly sequence.

Primary verification:

- room common normalization, template closure, collection closure, layout
  closure, resources, route detours, Fields, and normalized biome snapshots;
- mutation witnesses continue to fail at the same semantic boundary;
- no normalized snapshot hash changes.

### Gate D — Layout, encounter, and trait compiler products

Complete the remaining high-value compiler splits without changing policy.

1. Split layout normalization by start/completion, generated progression, and
   Hub progression; keep one `normalizeBiomeLayouts` assembler.
2. Split encounter envelopes, definitions, sets, and relational closure; keep
   one visible encounter construction order.
3. Split weapon, aspect, and trait declaration normalization from one another;
   keep `createTraitCatalog` as the ordered trait assembler.
4. Group the existing trait compiler modules under their semantic neighborhood
   only as each complete responsibility moves. Avoid a cosmetic all-files move.
5. Move exact cross-family checks to an explicit closure stage rather than
   allowing a local normalizer to inspect unrelated raw declarations.

Expected deletion: the mixed-responsibility bodies in `layouts.ts`,
`encounters.ts`, and `trait-declarations.ts`. The assembler functions remain and
must be materially smaller and chronological.

Primary verification:

- layout-normalization, unified-biome, route-detour, encounter, trait
  declaration/giver, offer, disposition, Chaos, Hex, and closure suites;
- normalized catalog snapshots unchanged;
- catalog package typecheck.

### Gate E — Declaration and test change locality

Improve navigation only where a stable semantic seam already exists.

1. Move raw Keepsake, encounter, room, and layout types beside their declaration
   families. Retain one small root `RawCatalogInput` aggregate and deliberate
   public type exports.
2. Split `rooms/n.ts` into fixed route rooms, Hub main rooms, side rooms, and
   completion rooms while retaining explicit room records and one visible
   `nRooms` assembly order.
3. Split Hammer declarations by the six weapon identities, with Rank II closure
   and the Weapon Upgrade giver assembled once. Do not synthesize declarations
   from a generic Hammer factory.
4. Split `traits.test.ts` by its existing durable authorities: catalog closure,
   requirements/dependencies, rarity/elements, Hammer compatibility, and raw
   boundary rejection.
5. Retire the generic `regression-coverage.test.ts` owner by moving its facts to
   room features, lifecycle clocks, Fields spatial, biome layout, rarity
   override, and normalized snapshot owners.
6. Add one policy-free mutable catalog-input helper and replace repeated JSON
   clone boilerplate. It may clone and locate entries but may not know what
   makes a declaration valid.
7. Review package test-support exports and retain only symbols used across a
   genuine package test boundary.

Expected deletion: the central `declarations/types.ts` catch-all, the monolithic
N and Hammer declaration bodies, duplicated local clone helpers, and the two
catch-all test owners. Deliberate assembly modules may retain the old supported
export names without becoming forwarding-only compatibility layers.

Primary verification:

- `npm run test:catalog`;
- catalog and downstream engine TypeScript compilation;
- architecture/import inspection confirms production never imports test
  support;
- test matrices have one primary owner and no copied policy.

### Gate F — Closure

1. Compare the final normalized production catalog to the base product and
   explain any difference. The expected result is no difference.
2. Audit the final dependency graph, module responsibilities, exports, and
   compiler stage order against `ARCHITECTURE.md` and `CATALOG_MODEL.md`.
3. Search for superseded validators, duplicate exact source tables, forwarding
   files, stale imports, and generic catch-all tests.
4. Review production and test line-count movement as diagnostic evidence. Any
   net production growth must enforce a real boundary rather than merely wrap
   old code.
5. Update the smallest durable catalog/architecture sections that changed and
   delete this temporary plan in the same closure commit.
6. Run one complete repository gate with `npm run check`. Do not repeatedly run
   the complete gate after unchanged focused passes.

## Acceptance matrix

| Concern | Required evidence |
| --- | --- |
| Dependency direction | Catalog imports only supported engine contracts; no application or engine implementation reversal |
| Runtime behavior | Production normalized catalog is value-equivalent to the base product |
| Construction | One readable root order; local normalization precedes explicit relational closure |
| Source authority | No unexplained production table repeats a declaration's exact keys or values |
| Room compiler | One room assembler delegates complete fact products without hidden state |
| Declaration readability | Room exits, rewards, eligibility, and exceptional capabilities remain visible at declaration sites |
| Tests | One primary owner per policy matrix; snapshot hashes remain secondary tripwires |
| Compatibility | No catalog-version, authored-schema, protocol, or migration churn for unchanged runtime output |
| Cleanup | Superseded paths are deleted in the same gate; no compatibility wrappers or empty directories remain |

## Explicit non-goals

- Correcting or adding Hades II game facts.
- Changing room, reward, trait, Keepsake, encounter, or route semantics.
- Reworking the planner engine's simulation or candidate architecture.
- Changing authored documents, execution plans, migrations, or catalog version.
- Changing application composition or removing the application's direct catalog
  imports; that belongs to the later planner-application health assessment.
- Generating declarations from game scripts.
- Introducing code generation, reflection, decorators, a schema framework, a
  dependency-injection container, or a generic catalog plugin system.
- Splitting every large declaration file or removing explicit repetition that
  makes audited room differences readable.

## Review questions before locking

1. Is the Keepsake single-authority correction appropriately part of catalog
   hygiene, or should exact compiler attestation remain duplicated until the
   engine catalog-schema reassessment?
2. Should the N and Hammer declaration splits ship in this plan, or should the
   first delivery stop after compiler and test decomposition?
3. Are normalized catalog hashes still desired as the coarse tripwire once the
   underlying policy suites have durable owners?
