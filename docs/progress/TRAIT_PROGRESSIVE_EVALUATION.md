# Trait Progressive Evaluation Plan

## Status

Draft implementation plan. No delivery gate has started.

This document is intentionally isolated while the work is active. Stable
candidate, simulation, workspace, and editor contracts remain owned by the
documents under `docs/design/`. When this plan is complete, absorb only the
durable decisions into those authorities and retire this file.

## Goal

Make each trait and rarity control explain the support of its available choices
before the user commits them, using the same contextual-picker language as room
and reward editing.

The feature must reuse the exact pre-offer trait candidate artifact already
published by progressive or canonical simulation. It must not add a second
trait simulator, reconstruct trait history in the application, or move offer
rules into React.

The completed interaction keeps the existing three-option offer editor:

```text
Option 1                 Option 2                 Option 3
Trait picker             Trait picker             Trait picker
Rarity picker            Rarity picker            Rarity picker
Selected radio           Selected radio           Selected radio

Offer feedback
Save trait offer
```

The native selects become contextual pickers. Available choices are searchable;
unsupported choices remain inspectable in a collapsed section; a persisted
invalid choice remains visible for repair.

## Current Baseline

The necessary chronological authority already exists:

- each reached trait offer has one exact `TraitOfferAddress`;
- simulation captures the branch-local `TraitHistoryState` and resolved
  `TraitOfferContext` before processing that offer;
- `TraitOfferCandidateCapability.evaluateOffer(value)` assesses an arbitrary
  complete three-option proposal against every retained pre-offer branch;
- progressive evaluation retains that capability through the first blocking
  trait offer;
- the candidate result already contains option assessments, first-offer
  composition, replacement composition, replacement transitions, and typed
  findings;
- the modal evaluates its complete local draft after each edit, blocks Save for
  an evaluated-impossible proposal, and keeps an unassessed proposal
  structurally authorable.

No authored schema, trait ledger, reward chronology, progressive-biome model,
Redux state, or semantic command is missing for this feature.

The current editor is incomplete in four ways:

1. trait and rarity controls are native selects over structural catalog domains;
2. the complete-offer `supported` result cannot truthfully describe one field's
   alternatives because unrelated sibling failures poison the result;
3. replacement rarity is recovered through a provisional projection-side
   enrichment plus synchronous probing in `rarityChoicesFor`;
4. option domains are not lazily projected into available, unassessed,
   selected-invalid, and unavailable sections.

## Core Modeling Decision

### Complete validity and focused support are different products

The existing complete-offer candidate remains the authority for:

- the consolidated feedback panel;
- whether an evaluated complete draft must be blocked from Save;
- whether the selected authored offer enters trait history.

A new focused option candidate answers a narrower question:

> With the other two draft options held as authored, can this concrete trait and
> rarity occupy this one option position in at least one retained pre-offer
> history?

It receives the complete proposed offer plus the focused `TraitOptionKey`. It
uses the same exact candidate capability and branch contexts as complete-offer
evaluation. It does not construct another history or replay a biome.

### Sibling failures must not poison the focused domain

If Option 2 lacks a prerequisite, otherwise legal alternatives for Option 1
remain supported. The complete offer remains invalid until Option 2 is fixed,
but Option 1's picker must not claim every choice is unavailable.

Focused support is true when at least one retained branch satisfies every
finding attributable to the focused option. The engine, not the application,
owns that attribution.

| Evidence                                                              | Focused-option treatment                                |
| --------------------------------------------------------------------- | ------------------------------------------------------- |
| Focused option's ordinary assessment                                  | Blocks when illegal                                     |
| Ordinary assessment on another option                                 | Does not block                                          |
| Duplicate of the focused trait in a sibling                           | Blocks the focused concrete choice                      |
| Duplicate only between the two siblings                               | Does not block                                          |
| `nonPriorityTrait` owned by the focused option                        | Blocks                                                  |
| `nonPriorityTrait` owned only by a sibling                            | Does not block                                          |
| `missingAttackOrSpecial` for the complete proposal                    | Blocks a proposal that leaves the guarantee unsatisfied |
| Replacement-composition excess with a focused replacement participant | Blocks                                                  |
| Replacement-composition excess caused only by sibling participants    | Does not block a non-replacement focused proposal       |
| Unrelated sibling prerequisite, rarity, context, or loadout finding   | Does not block                                          |

This attribution must be a typed engine product. The application must not
switch on finding codes to reproduce it.

### Branch semantics

The planner models possibility. A focused concrete option is supported when one
retained branch supports it with all focused and attributable offer-shape
requirements satisfied in that same branch. Evidence from separate branches
must never be combined.

When no exact candidate artifact exists, the domain is `unassessed`, not
`impossible`. Its context-dependent choices remain authorable.

Context-independent authored invariants do not become unassessed merely because
lifecycle coverage is absent. In particular, a proposed trait that duplicates
a sibling option remains impossible for an unreached or unpurchased offer. The
engine candidate family must assess that closed offer-shape invariant before
returning unavailable contextual coverage. React and the application must not
reimplement command validation to close this gap.

## Concrete Option Domain

The candidate value beneath both pickers reuses the existing authored option
shape:

```ts
interface AuthoredTraitOption {
  readonly traitKey: string;
  readonly rarity?: TraitRarity;
}
```

The application prepares concrete variants from normalized declarations:

- Hammers contribute one rarity-free variant per giver trait;
- ranked traits contribute every structurally authored rarity required to
  discover fresh offers and exact replacements;
- the currently persisted concrete value is always retained;
- all three complete offer options remain distinct persisted positions;
- sibling values and selected-option identity are held fixed while one option
  domain is evaluated.

The prepared domain contains only declaration- and authored-schema-compatible
giver/rarity pairs. Context-free sibling distinctness still comes from the
engine focused candidate so unavailable entries retain a typed explanation.

Technical probe variants need not all become visible picker rows. In
particular, unsupported Heroic fresh-offer probes stay hidden unless Heroic is
the persisted value or a supported exact replacement. This preserves the
player-facing rule that Heroic is not a normal fresh rarity.

## Trait-Domain Projection

The trait picker aggregates concrete option candidates by `traitKey`:

- a trait is available when at least one visible concrete rarity variant is
  supported;
- it is unassessed when exact candidate context is unavailable;
- it is unavailable only when no candidate rarity variant is supported;
- the currently selected trait is retained and pinned when invalid;
- labels come from normalized catalog declarations, never game keys;
- the unavailable explanation comes from typed focused candidate evidence;
- provider membership and ordering remain declaration-owned.

No probability or ranking is introduced. The picker does not claim that one
supported trait is more likely than another.

When a user chooses a different trait, the application chooses its concrete
variant in this order:

1. retain the current rarity if that concrete variant is supported;
2. otherwise choose the first supported visible rarity in declaration order;
3. use the one supported exact replacement rarity when replacement requires it.

An unavailable trait cannot be selected through the contextual picker.

## Rarity-Domain Projection

The rarity picker filters the same evaluated concrete domain to the selected
trait:

- Common, Rare, and Epic follow the giver and trait fresh-offer declarations;
- Proper Upbringing marks Common unavailable while leaving supported higher
  rarities available;
- Devotion, Anomaly, and other offer contexts retain their engine-owned rarity
  restrictions;
- replacement exposes exactly its promoted rarity, including Heroic only for
  a supported Epic-to-Heroic transition;
- a Heroic occupied trait has no replacement option;
- Hammers render no rarity control;
- a selected invalid rarity remains visible for repair.

If one supported rarity exists and the current value already uses it, the UI
may present a fixed rarity label. If the current value is invalid, the picker
must remain available even when only one repair choice exists.

## Application Boundary

The candidate projection session gains one bounded, cacheable option-domain
operation. Its exact naming may follow the existing session vocabulary, but its
contract is:

```text
exact TraitOfferAddress
+ complete local draft
+ focused option key
+ concrete option variants
-> focused candidate projections
```

The operation:

- constructs complete proposed offers outside React;
- evaluates them through the existing project-bound candidate session;
- supports cooperative or measured synchronous execution on deliberate picker
  activation;
- caches by immutable evaluation assembly, semantic owner, complete draft,
  focused option, and concrete domain;
- never stores results in Redux or authored history;
- rejects stale results after project replacement, undo/redo, or a newer local
  draft revision.

A dedicated application trait-domain projector aggregates concrete candidates
into trait and rarity picker models. React receives a prepared loadable
interaction; it does not receive the candidate session or construct engine
queries.

## React Interaction

Each option card uses the existing accessible `ContextualPicker` for Trait and,
when applicable, Rarity.

Required behavior:

- rendering the closed dialog performs no option-domain evaluation;
- opening a picker deliberately activates its domain;
- reopening an unchanged picker reuses the cached result;
- editing any option invalidates sibling-dependent domains for the new draft;
- a late result from an older draft cannot replace the current model;
- available and unassessed options remain selectable;
- context-independent impossible options remain disabled even when exact
  lifecycle coverage is unavailable;
- unavailable options remain inspectable but disabled;
- selected-invalid values are pinned with an explanation;
- keyboard search, traversal, unavailable disclosure, and focus restoration use
  the existing contextual-picker behavior;
- choosing a trait or rarity updates only the local draft;
- Save still dispatches one complete `ReplaceTraitOffer` semantic command;
- the Selected radio remains a local draft change committed with that offer;
- the consolidated feedback panel continues to describe complete-offer
  validity and replacements.

## Required Deletions

The new domain must replace, not coexist with, the provisional rarity path.
Delete in the same vertical application slice:

- `WorkspaceTraitOfferControl.replacementRarities`;
- `enrichTraitReplacementRarities` and its selected-evaluation traversal in the
  structured-workspace projector;
- `WorkspaceTraitOfferInteraction.rarityChoicesFor`;
- synchronous candidate probing from interaction binding;
- React's `draftRarityChoices` state;
- tests whose only purpose is to protect the superseded rarity-enrichment path.

The complete-offer `load(value)` path remains because it owns feedback and Save
support. It must not become a second option-domain evaluator.

## Delivery Gates

### Gate A — Focused engine candidate

Deliver one engine-owned focused option-candidate contract over the existing
exact artifact.

Deliverables:

- typed query and evaluation products;
- focused attribution for option-local, duplicate, first-offer, and replacement
  composition evidence;
- context-free duplicate assessment before exact lifecycle availability;
- exact same-branch support calculation;
- unavailable coverage behavior identical to the existing trait-offer family;
- candidate-session dispatch and exports;
- focused engine tests without application fixtures.

Audit against:

- a sibling missing prerequisite does not poison the focused option;
- a focused missing prerequisite blocks;
- a focused duplicate blocks while a sibling-only duplicate does not;
- a focused duplicate remains impossible when the offer is otherwise
  unassessed;
- first-offer non-priority ownership is respected;
- missing Attack/Special is repaired by an Attack or Special proposal;
- a focused excess replacement is blocked;
- a non-replacement focus is not poisoned by sibling replacement excess;
- one supporting history branch is sufficient;
- findings from different branches are not combined;
- Hammer loadout and acquired-Hammer exclusions remain engine-owned.

Gate A must not change React, authored commands, history, or the complete-offer
candidate's reached-support semantics. It may correct the current unreached
duplicate gap so the complete candidate and command invariant agree before
contextual coverage.

The complete and focused candidate products must share the same internal offer
assessment and duplicate authority. Gate A may project two support questions;
it may not create two implementations of trait legality or offer shape.

### Gate B — Application trait domain and interaction correction

Deliver one application-owned concrete option domain and expose it through the
structured-workspace trait interaction.

Deliverables:

- structural concrete variant preparation;
- cached option-domain candidate projection;
- trait aggregation and preferred concrete variant selection;
- rarity projection and technical-probe filtering;
- player-facing labels and explanations;
- unassessed and selected-invalid preservation;
- workspace interaction factory/loadable product;
- removal of the provisional replacement-rarity enrichment and probing path.

Audit against:

- ordinary Olympian fresh rarities;
- Proper Upbringing's Common-to-Rare floor;
- Common-to-Rare, Rare-to-Epic, and Epic-to-Heroic replacement;
- Heroic maximum-rarity rejection;
- Hammer rarity omission;
- selected-invalid persisted rarity;
- exact-address isolation between multiple trait offers;
- no topology walk or trait-history reconstruction in the application;
- no candidate evaluation while the workspace is merely projected.

Gate B must leave one interaction authority. It may not retain compatibility
fields forwarding to `rarityChoicesFor` or `replacementRarities`.

### Gate C — Contextual-picker UI and closure

Replace the native controls and close the product loop.

Deliverables:

- Trait contextual picker in all three option cards;
- Rarity contextual picker or truthful fixed-rarity label;
- loading, selected-invalid, unavailable, and explanation presentation;
- draft-revision invalidation and stale-result protection;
- unchanged complete feedback panel and one-command Save behavior;
- focused React and product-loop regressions;
- performance/work-count measurements;
- absorption of stable contracts into owning design documents;
- retirement of this plan after acceptance.

Audit against:

- an incompatible Hammer appears under Unavailable for the selected loadout;
- a prerequisite-blocked Olympian trait shows player-facing prerequisite
  labels;
- first-offer priority and Attack/Special choices update as sibling options
  change;
- duplicate alternatives update across both affected option cards;
- Proper Upbringing updates the rarity picker before Save;
- replacement selects the exact promoted rarity without exposing arbitrary
  Heroic choices;
- a complete invalid draft remains editable but cannot be saved;
- opening and searching a picker is keyboard and screen-reader operable;
- route Traits and room-local launchers still address the same dialog;
- unpurchased or otherwise unreached authored leaves remain unassessed rather
  than falsely unavailable.

## Performance and Work-Count Contract

Establish executable baselines before completing Gate B using:

- one ordinary Olympian giver with ranked rarity variants;
- one Daedalus Hammer offer using the largest declaration-owned trait domain;
- one replacement history;
- one engine-level branch-divergent pre-offer context fixture.

Current natural project simulation does not guarantee that two divergent trait
acquisition histories survive to the same reached trait owner. The divergent
fixture may therefore construct the engine candidate artifact from explicit
branch contexts. Product tests must not rewrite traces or require a fabricated
natural route witness.

Required invariants:

- zero candidate query batches during static render;
- one concrete candidate evaluation per unique prepared variant at most;
- no full biome or project replay per option;
- repeated opening of the same draft/option domain performs no new work;
- a rarity picker reuses an already loaded trait-domain batch;
- one sibling edit creates one new draft-domain identity;
- stale prior-domain results are ignored;
- query count is derived from the declared concrete domain, not from rendered
  component count.

Wall-clock measurements are diagnostic. The acceptance authority is bounded,
cacheable work through the exact trait capability with no hidden render-time
evaluation. If the largest Hammer domain causes visible blocking, add
cooperative chunking at the candidate projection boundary; do not add a worker
or production shadow model preemptively.

## Primary Test Ownership

| Concern                                                                       | Primary owner                             |
| ----------------------------------------------------------------------------- | ----------------------------------------- |
| Focused support and branch semantics                                          | planner-engine trait candidate tests      |
| Concrete variant construction                                                 | application trait-domain projection tests |
| Aggregation, labels, preferred rarity, selected-invalid retention             | application trait-domain projection tests |
| Workspace binding, lazy activation, cache identity                            | structured-workspace interaction tests    |
| Contextual picker rendering and local draft behavior                          | `TraitOfferEditor` tests                  |
| Cross-layer Hammer, first-offer, replacement, and Proper Upbringing workflows | representative product-loop tests         |
| No render-time evaluation and bounded query counts                            | application observer tests                |

Facade and product tests retain representative witnesses. They must not copy
the complete engine legality matrix.

## Non-Goals

This work does not:

- change trait declarations or import additional traits;
- add probabilities, offer weights, rerolls, or likely-choice ranking;
- change the three-option authored schema;
- change equipped-trait folding, replacement effects, or acquisition timing;
- persist draft state or candidate results;
- auto-save each local picker change;
- add a route-wide trait authoring mode;
- make unreached rooms consume traits;
- redesign the modal, launcher, feedback panel, or route Traits tab;
- generalize every candidate family around trait-specific composition;
- add a dependency-injection container, worker, or generic form engine.

## Completion Contract

The plan is complete when:

- every live trait and rarity control obtains contextual support or explicit
  unassessed coverage from the project-bound candidate session;
- sibling failures do not falsely disable unrelated repairs;
- all trait rules remain engine-owned;
- React renders prepared contextual picker models and dispatches one complete
  semantic command;
- the provisional rarity-enrichment path is deleted;
- selected-invalid and unassessed values remain authorable;
- the worst declared giver domain satisfies the executable work-count contract;
- the complete repository gate passes;
- durable decisions are absorbed into their owning design authorities and this
  file is retired.
