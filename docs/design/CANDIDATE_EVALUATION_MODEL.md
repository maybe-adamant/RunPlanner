# Candidate Evaluation Model

## Purpose

This document defines how the standalone planner evaluates contextual
alternatives without turning canonical history into an exhaustive candidate
simulator.

`SIMULATION_AND_VALIDATION.md` owns project evaluation, progressive coverage,
history, selected-plan validation, and semantic findings.
`CONTEXTUAL_EDITOR_UX.md` owns the player-facing grouping, explanation, and
interaction policy over candidate results. This document owns the boundary
between them:

- how one exact project-evaluation assembly prepares candidate contact;
- which selected-simulation facts candidate evaluation may consume;
- how an interactable evaluates its complete domain on demand;
- how much simulation a proposed value may replay;
- how candidate sessions are cached and invalidated.

Candidate results are replaceable derived data. They never enter the authored
project, profile document, autosave, undo history, or canonical game history.

## Current Production Shape

One semantic edit or profile replacement creates a new immutable
`ProjectDocument` and one exact evaluation assembly; undo and redo restore
prior immutable identities and may reuse their cached matching assemblies. Its
data-only `ProjectEvaluation` remains the public derived-result selector, while
the assembly carries opaque candidate capabilities produced by the same
simulation execution. Room-target, reward-producer, lifecycle, encounter, and
trait-offer preparation bind that one assembly. None reacquires project
evaluation or recovers a capability from public evaluation data.

Before the candidate refactor, the application expanded control domains into
independent scalar queries. Reward, shop, room-lifecycle, and Hub alternatives
could apply temporary commands and replay the complete addressed biome once per
value. A 72-pair Devotion domain therefore repeated the same materialization,
history walk, and selected-biome evaluation 72 times.

Production now prepares one semantic context per contacted owner:

- room targets use their selected-simulation generation context;
- rewards use typed producer frontiers;
- O lifecycle controls use opaque occurrence-local lifecycle capabilities;
- active pool-backed encounter phases use their lifecycle preparation
  checkpoint and the preceding valid same-room record prefix;
- N controls use joint-board, ordered-visit, or parent-local regions;
- shops use joint inventory or ordered purchase contexts;
- batch-level controls consume their typed selected-simulation contexts.

The structured workspace owns every declaration-derived interaction domain.
React activates one zero-argument loader through a shared adapter and cannot
construct a candidate request. Project-identity caching avoids repeated contact
for the same immutable snapshot; a semantic edit correctly invalidates the
workspace and every interaction result.

## Core Decision

Canonical and progressive simulation remain selected-plan evaluators.

They publish:

- the maximum truthful route and biome coverage;
- canonical or progressive materialization;
- lifecycle history and counter ledgers;
- selected room-generation and reward results;
- typed semantic pre-decision views needed to explain a covered decision.

They do not enumerate or evaluate every alternative.

An interactable with a covered semantic owner asks one project-bound candidate
session to evaluate its domain. The session prepares that owner's decision
context once and assesses every requested alternative through the same
generation, reward, requirement, and finding authorities used by selected-plan
simulation.

```text
ProjectEvaluationAssembly
  { public project + data-only evaluation; private opaque candidate artifacts }
  -> PreparedCandidateSession
      -> locate semantic owner
      -> require route and biome coverage
      -> prepare one decision context
      -> evaluate one candidate domain
  -> typed candidate results
```

History remains immutable game-language data. It does not contain callbacks,
UI option arrays, candidate colors, or executable per-control functions. The
candidate subsystem consumes typed history and decision views.

## Semantic Coverage

A candidate is assessable only when normal project evaluation has reached its
owner and the checkpoint required by that candidate family.

The existing route distinctions remain exact:

- `upstreamIncomplete`: the earlier active route biome is incomplete without a
  reached contextual block;
- `upstreamInvalid`: the earlier active route biome stopped at a contextual
  block, whether its authored state was complete or incomplete;
- `authoredPrerequisiteMissing`: the active biome reached the decision source,
  but a required authored reward pool, Fields door roll, or biome outcome must
  be selected before this dependent option can be assessed;
- `coverageNotReached`: the active biome has not reached this local owner and
  checkpoint.

The prerequisite selector itself remains assessable. It consumes the already
prepared prefix state before the missing outcome and never simulates a
placeholder selection. A blocking room or reward finding earlier than that
authored prerequisite retains ordinary `coverageNotReached`; a later missing
field must not conceal the actual invalid frontier.

The application may avoid requesting an unassessed control, but the engine
remains the contact boundary and must independently enforce coverage.

The decision point immediately before a selected invalid value is covered. Its
pre-decision state must remain available so the user can evaluate replacements,
whether the authored biome was otherwise complete or still an incomplete
prefix. Owners after the first blocking invalid state remain unassessed unless
the layout defines an atomic decision region that must be evaluated as one unit.
This includes lifecycle-owned values such as an exact acquisition-site order:
the declared `roomExit` lifecycle point remains available to evaluate a complete
replacement order that removes, adds, or reorders exact entries. A reward-wheel
lifecycle control likewise owns the diagnostics of offers within that same wheel,
but never a sibling wheel or another room's offers.

When an entered Shop owns the active ordinary exit frontier, its outgoing batch
still precedes the declared `roomExit` acquisition point in canonical history.
The lifecycle publishes that bounded first-class point before the unresolved
continuation, so its exact order, entry children, findings, and candidates remain
assessable without a downstream room. That bounded product cannot advance route
history or retroactively affect outgoing-target candidates.

N's open Hub board and any jointly unordered reward producer are such atomic
regions. They do not acquire a false slot- or sibling-order coverage prefix.
Their declaration-ordered physical creations and reward lookup still remain
facts once the board reaches outgoing generation; a board-owned invalid value
blocks every later visit and parent-local candidate rather than erasing that
atomic region. A blocked visit is phase-aware: target-lifecycle failure stops
before outgoing generation, side-generation failure retains only target
outgoing creation, and local-lifecycle failure retains only the entered local
prefix through its invalid owner. None of those frontiers returns to the Hub.

## Candidate Session

A prepared session belongs to exactly one identity-attested assembly:

```ts
interface ProjectEvaluationAssembly {
  readonly project: ProjectDocument;
  readonly evaluation: ProjectEvaluation;
  // The exact implementation privately retains non-persisted candidate artifacts.
}

interface PreparedCandidateSession {
  readonly project: ProjectDocument;
  readonly evaluation: ProjectEvaluation;
  evaluateDomain(request: CandidateDomainRequest): CandidateDomainEvaluation;
}
```

Construction verifies that the assembly and its public evaluation came from
one exact project execution. An explicit-artifact family also verifies and
consumes its capability from that assembly. `simulateProject` is the data-only
facade over that execution; it does not rerun simulation for candidate
artifacts. A session may cache:

- route, biome, occurrence, target, and semantic-owner indexes;
- prepared generation views;
- prepared reward-producer frontiers;
- opaque lifecycle capabilities and scoped lifecycle-region inputs;
- evaluated domains keyed by semantic owner and exact domain identity.

No cache crosses an exact assembly or `ProjectDocument` identity. A semantic
edit, profile load, or new project receives a new document identity and a new
assembly and candidate session. Undo or redo may restore a prior immutable
document identity and reuse that identity's cached assembly and session; a
cache miss still creates a fresh matching assembly. Navigation, focus, search,
and disclosure do not invalidate it.

The application API is domain-shaped rather than scalar-shaped. The former
scalar compatibility service has been deleted. Engine fixtures bind the same
production session factory, workspace fixtures compose the production
structured-workspace boundary, and React fixtures activate its descriptors.

### First-blocking artifact horizon

The exact assembly privately retains candidate capability only through the first
blocking atomic region. Earlier reached owners retain their captured
capabilities, and the blocking owner retains the capability needed to repair
that complete decision. Later authored owners remain in the document but have
no candidate artifact and report `coverageNotReached`.

The evaluator locates the first region from its existing materialization,
generation, reward, encounter, and lifecycle chronology. Aggregate evaluators
attach an internal atomic-region key while producing their findings; the
shared locator does not infer grouping from finding codes or rendered UI
sections. Every error finding in that first region is retained, and
later-region findings are withheld. Warnings do not establish the horizon.
Exact finding identity and deduplication belong to the selected evaluator, not
the candidate session.

Candidate consumers select the already-published complete-valid or assessed
prefix product. They do not call a progressive evaluator to reconstruct a
missing selected-path context. The only replay after publication is the
declared scoped alternative replay owned by the candidate family itself, such
as one proposed Hub visit order, side-room region, Shop order, or joint reward
group.

## Evaluation Strategies

Not every candidate requires the same replay scope.

### Direct Support Lookup

These candidates already have selected-simulation support ledgers or immutable
declaration domains:

- authored start rooms;
- batch reward stores;
- Fields Min/Max outcomes;
- fixed declaration constraints.

They should remain direct lookups. Session indexes remove repeated array scans
without changing their semantics.

When a required batch value is unresolved, selected simulation cannot publish a
support entry for that value. The candidate session therefore invokes the same
pure support function at the source room's already-materialized
`preOutgoing` history view. This applies to authored reward pools and Fields
Min/Max outcomes. It does not replay the biome or create one scratch project per
option. Fixed `none` and derived `sourceOfferPoint` policies need no authored
prerequisite and remain immediately evaluable.

### Prepared Decision Evaluation

Ordinary room targets and concrete reward alternatives share one exact
pre-decision context.

For a room-target domain, the session prepares:

- source room and physical exit;
- addressed target-generation frontier;
- room creation and appearance ledgers;
- force and requirement facts;
- the applicable staged or ordinary declaration pool;
- reward history needed by room eligibility.

Every candidate room is then evaluated against that same context. The engine
does not rebuild target-generation maps or relocate the semantic owner for each
game name.

The frontier belongs to the reachable physical exit slot, not to an authored
Room Occurrence. Exit 1 is therefore assessable as soon as the parent reaches
outgoing generation, before a room is created there. Completing an earlier
physical offer advances history, reward-bag, same-batch, cap, and force state
and exposes the next slot's frontier. A later blank exit remains unassessed
until every preceding physical exit is concrete; the engine does not invent
hypothetical earlier siblings to assess it.

Candidate evaluation is not the complete authoring domain. For an empty
decision's first target, the engine also exposes static ordinary-target
authorability: the source, physical exit, declared game-name domain, batch and
target bounds, and ordinary topology must admit `CreateTarget`. The application
uses that result with any local setup prerequisite to keep a valid unassessed
ordinary choice authorable, while disabling a statically invalid terminal or
staged choice. It does not infer those bounds from UI position or treat missing
evaluation coverage as a blanket prohibition.

An already-authored target uses the same slot frontier for replacement.
Replacing an earlier target retains later authorship but may change its
subsequent support, following the ordinary visible-invalid repair contract.
Retained targets on exits no longer present after an upstream edit remain
assessable through their concrete pre-generation history so
`physicalExitUnavailable` is preserved.

### Takeover Preboss Batches

A takeover Preboss is not an ordinary per-target room choice. Its declaration
replaces the complete normal-door batch at one source: the same Preboss room is
created for every declaration-owned physical exit, with Shop/free lifecycle
roles derived from the policy and exit order. The candidate owner is therefore
the source `ExitDecisionAddress`:

```ts
interface TakeoverPrebossBatchCandidateQuery {
  kind: 'takeoverPrebossBatch';
  source: ExitDecisionAddress;
  gameName: string;
}
```

The evaluator considers the whole declared exit set before any target
occurrence is created. It returns ordered exit evidence, compatibility, force,
creation and appearance caps, and the required target count as one atomic
result. A Preboss declaration is excluded from the ordinary `roomTarget`
domain for a takeover source; I remains an ordinary per-target choice because
its Preboss policy does not take over normal doors. Candidate evaluation never
creates a partial mixed batch to discover that result.

The ordinary and takeover evaluators consume one source-owned generation
support set. The takeover result publishes engine-reduced batch support
(`impossible`, `possible`, or `required`) only after validating its complete
normal-exit shape; its per-exit pressure remains evidence. The application may
place the two result families in Door 1's one picker, but it consumes that
batch classification directly rather than reducing exit pressure itself. An
ordinary option stays target-owned; a takeover option stays decision-owned,
even when they share the same visual control.

### Terminal Hub Takeover

N's bounded entry publishes one closed candidate after the selected PreHub
occurrence reaches its exact empty terminal envelope:

```ts
interface HubTerminalTakeoverCandidateQuery {
  kind: 'hubTerminalTakeover';
  source: ExitDecisionAddress;
}
```

Structural topology resolves the one declared Hub key and room; the candidate
evaluator does not accept an arbitrary game name. It evaluates the terminal's
depth requirement against PreHub's committed post-room history and returns
`required` or `impossible`. The application projects that result as the
affordance for one complete `ReplaceWithHubDecision` intent. Findings or
unavailable candidate coverage may disable the action, but they never remove
the authored terminal control. The completed-Hub Preboss remains in the
separate takeover-Preboss domain owned by the Hub-sourced handoff.

For a reward domain, the session prepares the producer frontier described
below. Every complete offer is evaluated from the same frontier.

### Scoped Region Replay

Some changes alter more than one local support calculation:

- O encounter count and reward-wheel settings alter a room-local lifecycle;
- a shop offer participates in one joint inventory;
- a Shop acquisition-site order participates in ordered settlement; and
- N membership, visits, and side-room state alter joint-board, visit, or
  parent-local regions.

An encounter phase is narrower than an occurrence lifecycle replay. Its
declaration-owned set is evaluated at the exact active phase address from the
prepared checkpoint. A prior valid phase contributes its recorded exact
definition to the same-room preparation view but no started counter effect;
previous-room requirements still exclude the current room. A retained invalid
selection remains an addressable correction target. Later structurally active
phases retain their authored controls but publish no candidate support or
findings until that blocker is repaired, because no exact predecessor
checkpoint exists for them. A valid suffix-terminating phase instead publishes
the exact later slots as dormant, and those slots have no candidate contact at
all. React receives the bound result and does not inspect set membership or
requirements.

These candidates replay the smallest declared semantic region that contains
their effect. No current candidate family owns a full addressed-biome replay.
A future genuinely broad interaction would need to introduce that authority
explicitly rather than inheriting a generic fallback.

## Reward Producer Frontiers

Reward candidates are the first and highest-value conversion to the new model.

Selected reward simulation already holds the necessary state while walking the
room lifecycle. At every covered reward producer it must retain a typed
pre-decision frontier containing enough state to rerun that producer:

- every reachable latent reward branch;
- counted bags and reward history;
- lifecycle and history sequence;
- semantic producer and offer owner;
- resolved store and declaration binding;
- sibling offers with their semantic origins;
- sequential or jointly unordered generation policy;
- room, lifecycle, and generation facts used at resolution;
- shop, wheel, cage, side-room, or incoming-reward policy as applicable.

These frontiers are selected-simulation facts, not candidate arrays. Capturing
frozen branch references during the normal reward walk is preferred to
replaying history later to rediscover them. Reward evaluation returns them as
an opaque producer capability beside its data-only simulation result, and
biome/project composition carries that capability through the exact assembly.
The public reward and project results omit it entirely; a producer evaluator
can look up only its addressed owner and evaluate its offered value.

The frontier must be captured before processing the selected offer or atomic
offer group. This preserves repair support when the selected value is invalid
and would otherwise collapse the reachable branch set.

Candidate evaluation substitutes one proposed complete offer into the producer
and invokes the existing reward authorities:

- sequential producers include the effects and peer exclusions of earlier
  siblings;
- jointly unordered producers reevaluate the complete sibling group and every
  supported generation order required by policy;
- counted rewards preserve every reachable bag transition;
- support is existential over reachable latent branches, never probabilistic;
- Boon sources and complete Devotion pairs use the ordinary source rules;
- shop inventory candidates use the joint inventory authority;
- Q shared-store shop slots retain no-duplicate behavior;
- selected-invalid candidates retain exact bag, peer, source, payload,
  acquisition, or shop findings.

The large N Hub board has one focused-repair refinement. Selected simulation
and the selected candidate still validate the complete atomic board. When that
board has no supported ordering because several retained declaration defaults
are invalid together, a changed focused reward may be supported from the
board's pre-generation frontier without requiring unrelated siblings to become
valid in the same edit. This authorizes one repair step; it does not publish a
valid board, consume the remaining offers, or expose Hub visit candidates.

The application may aggregate complete offer results into reward-type,
Boon-source, and Devotion-source steps. It does not implement reward support.

## Replay Horizons

Each candidate family has an explicit semantic horizon:

| Candidate family              | Required horizon                                            |
| ----------------------------- | ----------------------------------------------------------- |
| Start room                    | Declaration-owned start domain                              |
| Room target                   | Target generation support                                   |
| Takeover Preboss batch        | Source pre-generation support across all physical exits     |
| Batch reward store            | Pre-generation store support                                |
| Incoming or local reward      | Offer generation and its own entered acquisition lifecycle  |
| Sequential sibling reward     | Earlier sibling generation plus the addressed offer         |
| Joint unordered rewards       | Complete atomic sibling generation region                   |
| Shop offer                    | Complete joint inventory generation                         |
| Shop acquisition-site order   | Ordered acquisition-site settlement                         |
| Fields Min/Max                | Pre-outcome support ledger                                  |
| Encounter phase               | Active phase preparation checkpoint and valid record prefix |
| O encounter or wheel setting  | Addressed occurrence lifecycle region                       |
| Hub membership                | Joint open-board constraint region                          |
| Hub visit order               | Complete proposed prefix through the Hub visit region       |
| Side-room generation or entry | Parent-local side-room region                               |
| Broad biome field             | Smallest biome suffix whose rules consume the field         |

A candidate does not become impossible merely because retained downstream
authorship would require later repair. Room replacement, structural capacity,
and downstream eligibility remain separate semantic effects. Validators beyond
the candidate horizon run only when the candidate family depends on them.

A Hub visit-order candidate is one Hub-decision-owned complete dense-prefix
proposal. It replays every proposed visit in order, then returns evidence at
the exact affected visit and room-local descendants. A structurally valid
proposal remains authorable when that replay produces findings; those findings
are repair evidence rather than a reason to hide the control or reject the
authored order.

## Application and React Boundary

The application publishes one transient exact assembly and creates or retrieves
its candidate session from that assembly. The ordinary evaluation selector
returns only the assembly's data-only evaluation:

```text
Redux authored project + published exact assembly
  -> data-only ProjectEvaluation selector
  -> project-bound candidate projection session
  -> contextual option and picker projection
  -> structured workspace interaction catalog
  -> single UI interaction adapter
  -> React rendering and activation
```

The candidate projection should not hide evaluation acquisition behind a
general `evaluateProject(project)` callback or recover candidate artifacts from
a public evaluation for an explicit-artifact family. Passing the exact
published assembly makes identity, ownership, and invalidation explicit. The
assembly is replaceable derived state: it never enters profiles, autosave,
persistence, or authored undo history, and React does not inspect its callable
artifacts.

The structured workspace is the React contact. It owns the exact bound
candidate session and carries a typed interaction descriptor for every live
candidate control. Each descriptor captures its semantic owner,
declaration-owned choice domain, labels, authored selection, and a
zero-argument lazy loader. React receives neither the session, the unbound
candidate service, a general evaluation callback, nor an API that accepts an
owner and arbitrary domain values.

One UI interaction adapter is the only React-side caller of workspace loaders.
It invokes them on open, focus, pointer, or other explicit activation; caches
results against the immutable workspace interaction identity; and rejects
pending results after an edit, undo, redo, or profile replacement. Rendering a
control must not evaluate its candidate domain.

React may render declaration-owned choices and the currently authored value,
but it does not walk topology to discover candidate owners, rebuild candidate
grouping, choose a replay horizon, or construct candidate queries. Room and
reward interactions follow the same contract as batch stores, Fields outcomes,
O wheels, Hub controls, side rooms, and Shop acquisition-site orders. I's
bounded non-goal limit is a direct declaration-owned authored field rather
than a contextual candidate interaction. Room-target candidates consume its
selected value from their prepared generation context.

There is no separate candidate-evaluation harness for tests. Engine candidate
tests bind the production session factory to a real assembly. Workspace tests
construct the production structured workspace from that assembly, and React
tests exercise the production application boundary. Test fixtures may provide
authored setup, controlled catalogs, and injectable observers, but they must
not implement a parallel candidate API or alternate evaluation behavior.

Candidate observers are production instrumentation points shared by runtime
and tests. They may record project evaluations, candidate batches, replay
horizons, and cache behavior without changing evaluation semantics.

## Exact Artifact Boundaries

### Trait offer candidate boundary

Trait-offer candidates use the same project-bound session as reward and Shop
interactions. Selected assessment and alternative capability are separate
products of the same reached reward walk:

- `BiomeRewardSimulation.selectedTraitOffers` publishes data-only
  `SelectedTraitOfferAssessment` values addressed by exact
  `TraitOfferAddress`. Each value contains the selected authored offer,
  acquisition role, chronological index, and branch-grouped option,
  composition, and replacement-composition assessments. It does not contain
  pre-offer trait histories or resolved giver contexts.
- `BiomeCandidateArtifacts.traitOffers.at(address)` returns only opaque
  `evaluateOffer(value)` and
  `targetedAcquisitionTargets(value, optionKey)` capabilities. Their private
  branch-local inputs are the exact pre-offer `TraitHistoryState` and resolved
  `TraitOfferContext` captured before the selected offer was processed and
  before equivalent post-state branches could merge.

A query names one exact address and passes one complete proposed offer to that
capability. The engine assesses all three options against every retained
branch-local context and returns branch-grouped evidence. The application may
present the selected assessment, but it cannot use that data-only product to
assess a replacement. Provider membership and trait-local rarity shape remain
structural command/codec checks.

The selected assessment is published once at biome reward ownership and only
through the first blocking region. The blocking trait offer retains both its
complete selected finding group and its exact alternative capability; later
offers publish neither. Public reward branches carry reachable reward state,
trait history, and events downstream, but do not carry diagnostic trait-offer
assessment traces or candidate contexts.

The returned findings cover prerequisite, negative predicate, context,
element, rarity-count, targeted-acquisition source and exact-target,
occupied-slot, wrong-loadout, and acquired-Hammer exclusion rules. For an
occupied Olympian slot, the same product may carry one exact derived
replacement transition and its promoted rarity; Heroic is emitted only for
Epic-to-Heroic replacement and never as a fresh candidate. Replacement
candidates remain limited to
`priorityTraitKeys`, and waive only occupied-slot failure. Candidate evaluation
does not equip a sibling option, rewrite trait history, or persist counters.
React receives only the bound interaction projection and cannot recreate this
policy.

The target-domain query is a sibling view of that exact offer capability. It
enumerates a declaration-owned targeted option's legal exact targets per
retained branch and never unions support into a target that exists in no single
history. A targeted source with no eligible target is unavailable. Only the
selected targeted option requires an authored `targetTraitKey`; a missing or
stale selected target blocks the complete offer while remaining pinned and
repairable in the application picker. Target enumeration and selected-target
validation share the engine predicate, including god-trait superchargeability
and Hammer Rank-II capability.

When the reached pre-acquisition history carries
`minimumScalableGodTraitRarity`, a fresh Common candidate is additionally
assessed against that derived floor only when its declaration supports Rare as
a fresh rarity. The engine reports `rarityBelowActiveFloor` separately from
`freshRarityUnavailable`; replacement candidates continue to use their exact
next rarity and the existing shortage composition. The application consumes
this finding through the ordinary trait-offer interaction and does not inspect
Proper Upbringing or recount elements.

For a first Olympian contact, the candidate product also carries
branch-grouped complete-offer composition assessments. Non-priority options are
unavailable with a composition-context finding; missing Attack/Special is one
offer-level finding rather than a fabricated prerequisite. Branch evidence is
not flattened before support is decided, so one branch's valid first offer
cannot hide another branch's invalid composition.

Replacement composition is a sibling branch-local product. It reports the
distinct legal ordinary-key count, the maximum replacement count, and an
offer-level excess finding. Option assessments and composition must succeed in
one branch; evidence from separate branch histories is never combined.

Trait editing uses two projections of that one assessment authority:

- a complete-offer query evaluates all three authored options and remains the
  authority for consolidated feedback and whether the complete draft is
  supported for Save; selected simulation remains the acquisition and history
  authority;
- a focused-option query receives the same complete proposal plus one
  `TraitOptionKey` and asks whether the concrete value in that position is
  supported while the two siblings remain fixed.

Focused support attributes option-local findings to their exact position.
Unrelated sibling prerequisite, rarity, context, loadout, and priority
failures do not disable the focused repair. A duplicate blocks every position
containing that trait; missing Attack/Special blocks a focused proposal that
still leaves the complete first offer without either core slot; replacement
composition blocks a focused replacement participant but does not poison an
ordinary focused option solely because siblings exceed the replacement limit.
One retained branch satisfying every focused requirement is sufficient, and
all required evidence must succeed in that same branch.

An unreached offer normally returns unavailable contextual coverage. Closed
authored invariants do not disappear with that coverage: duplicate sibling
traits remain an evaluated focused impossibility, using the same duplicate
authority as complete-offer evaluation. The candidate-session result type
therefore retains the explicit unavailable variant for unique unreached
proposals rather than claiming that every focused query was assessed.

The established boundary provides:

- one project/evaluation-bound candidate session;
- one prepared context per contacted semantic owner;
- domain-shaped room and reward evaluation;
- scoped room-local and Hub region replay;
- first-blocking publication with no generic selected-path recovery replay;
- exact-address trait artifacts distinct from biome-level selected assessment;
- structured-workspace ownership of lazy React candidate contact;
- declaration-owned interaction domains for every live candidate family;
- one React-side activation adapter and no render-time evaluation authority;
- one production candidate-session factory shared by runtime and tests;
- no scalar compatibility API or alternate test evaluation harness;
- measured removal of ordinary reward-domain biome replay.

## Non-Goals

This refactor does not:

- add incremental Redux simulation across authored project identities;
- store candidate results or interaction progress in authored Redux history;
- cache candidate evidence across semantic edits;
- move simulation rules into React or application presentation code;
- place candidate arrays or UI grouping in canonical history;
- introduce probability, ranking, or likely-route guidance;
- automatically repair retained downstream authorship;
- add a Web Worker merely to conceal repeated biome simulation.

A worker remains a later delivery option if the corrected owner-domain
algorithm still exceeds the interaction budget.
