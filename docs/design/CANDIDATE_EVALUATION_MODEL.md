# Candidate Evaluation Model

## Purpose

This document defines how the standalone planner evaluates contextual
alternatives without turning canonical history into an exhaustive candidate
simulator.

[Simulation and Validation](SIMULATION_AND_VALIDATION.md) owns project
evaluation, progressive coverage, history, selected-plan validation, and
semantic findings. [Contextual Editor UX](CONTEXTUAL_EDITOR_UX.md) owns the
player-facing grouping, explanation, and interaction policy over candidate
results. This document owns the boundary between them:

- how one exact project-evaluation assembly prepares candidate contact;
- which selected-simulation facts candidate evaluation may consume;
- how an interactable evaluates its complete domain on demand;
- how much simulation a proposed value may replay;
- how candidate sessions are cached and invalidated.

Candidate results are replaceable derived data. They never enter the authored
project, stored plan, undo history, or canonical game history.

## Core Decision

Canonical and progressive simulation remain selected-plan evaluators. They
publish the maximum truthful route and biome coverage, canonical or progressive
materialization, lifecycle history and counter ledgers, selected
room-generation and reward results, and the typed semantic pre-decision views
needed to explain a covered decision. They do not enumerate or evaluate every
alternative.

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

## Candidate Assembly

One semantic edit or profile replacement creates a new immutable
`ProjectDocument` and one exact evaluation assembly. Its data-only
`ProjectEvaluation` remains the public derived-result selector, while the
assembly carries opaque candidate capabilities produced by the same simulation
execution. Room-target, reward-producer, lifecycle, encounter, and trait-offer
preparation bind that one assembly. None reacquires project evaluation or
recovers a capability from public evaluation data.

Candidate assembly prepares one semantic context per contacted owner:

- room targets use their selected-simulation generation context;
- rewards use typed producer frontiers;
- O lifecycle controls use opaque occurrence-local lifecycle capabilities;
- active pool-backed encounter phases use their lifecycle preparation
  checkpoint and the preceding valid same-room record prefix;
- N controls use joint-board, ordered-visit, or parent-local regions;
- shops use joint inventory or ordered purchase contexts;
- batch-level controls consume their typed selected-simulation contexts;
- reached Boss completions expose their exact inactive-Arcana outcome domain;
- selected Circe effect options expose their exact pre-effect Arcana or Fear
  target domain.

The candidate session owns evaluation of every declaration-derived domain; the
structured workspace binds each domain to its semantic control.

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
artifacts.

A session may cache route, biome, occurrence, target, and semantic-owner
indexes; prepared generation views and reward-producer frontiers; opaque
lifecycle capabilities and scoped lifecycle-region inputs; and evaluated
domains keyed by semantic owner and exact domain identity. Reuse may memoize
complete explicit products, never supply missing semantic context.

No cache crosses an exact assembly or `ProjectDocument` identity. A semantic
edit, profile load, or new project receives a new document identity and a new
assembly and candidate session. Undo or redo may restore a prior immutable
document identity and reuse that identity's cached assembly and session; a
cache miss still creates a fresh matching assembly. Navigation, focus, search,
and disclosure do not invalidate it.

The API is domain-shaped rather than scalar-shaped. Engine fixtures bind the
same production session factory, workspace fixtures compose the production
structured-workspace boundary, and React fixtures activate its descriptors;
there is no separate candidate-evaluation harness. Candidate observers are
production instrumentation points shared by runtime and tests. They may record
project evaluations, candidate batches, replay horizons, and cache behavior
without changing evaluation semantics.

## Semantic Coverage

A candidate is assessable only when normal project evaluation has reached its
owner and the checkpoint required by that candidate family. The route
distinctions remain exact:

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
field must not conceal the actual invalid frontier. The application may avoid
requesting an unassessed control, but the engine independently enforces
coverage. An unreached unique proposal returns unavailable contextual
coverage; structural duplicate detection still applies without it, but must
not claim that the complete unreached offer was evaluated.

Arcana/Fear candidates never receive the raw mutable ledger. A Boss-completion
capability exposes its ordered inactive Arcana domain, required count, grant
rarity, and current active card rarities. A selected Circe option exposes the
domain its declaration needs: inactive cards for Red, active non-Heroic cards
plus the clamped cardinality for Lapis, or effectively active removable Vows
for Black Night. Its current active card rarities remain branch-correlated,
separate from its resulting rarity. Candidate grouping may merge branch
products only when those exact domains agree; otherwise it withholds a false
unified domain. The exact resolution/completion owner retains its repair
domain at the first blocking point, while later state remains unassessed.

The decision point immediately before a selected invalid value is covered. Its
pre-decision state must remain available so the user can evaluate replacements,
whether the authored biome was otherwise complete or still an incomplete
prefix. Owners after the first blocking invalid state remain unassessed unless
the layout defines an atomic decision region that must be evaluated as one unit.
This includes lifecycle-owned values such as an exact `roomActions.order`: the
declared lifecycle timeline remains available to evaluate a complete replacement
order that removes, adds, or reorders exact action references. A reward-wheel
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

### First-blocking artifact horizon

The exact assembly retains candidate capability only through the
[first blocking region](SIMULATION_AND_VALIDATION.md#first-blocking-region).
Earlier reached owners retain their captured capabilities, and the blocking
owner retains the capability needed to repair that complete decision. Later
authored owners remain in the document but have no candidate artifact and
report `coverageNotReached`. Exact finding identity and deduplication belong to
the selected evaluator, not the candidate session.

Candidate consumers select the already-published complete-valid or assessed
prefix product. They do not call a progressive evaluator to reconstruct a
missing selected-path context. The only replay after publication is the
declared scoped alternative replay owned by the candidate family itself, such
as one proposed Hub action order, side-room region, Shop order, or joint reward
group.

### Outgoing-batch repair horizon

An ordinary outgoing decision has one generation horizon owned by its source
decision. The candidate session consumes the grouped generation assessment
published by [selected or progressive evaluation](SIMULATION_AND_VALIDATION.md#generated-batch-retention);
it does not rebuild separate Fields, target-pressure, or target-local
generation views:

| First blocking position                                                                     | Candidate generation evidence                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before the source reaches outgoing generation                                               | No outgoing-batch assessment or target-generation candidate is claimed. The source's pre-outgoing repair contact remains the boundary.                                                                                                                                                                                                              |
| During physical target generation                                                           | The source decision, completed physical target prefix, and any bounded repair assessment for the blocking target remain. Later physical targets have no candidate artifact and report `coverageNotReached`. An invalid incoming offer instead blocks the whole doors opening, so every door of the batch keeps its generation and offer capability. |
| After the source batch has completed, in the picked target's acquisition or later lifecycle | The complete source batch and every generated peer remain available with their previously reached generation capabilities. The blocking child remains repairable with its own capability; only unexecuted target lifecycle work, later outgoing decisions, and downstream owners remain outside coverage.                                           |

The second row may retain a blocking target's authored repair contact without
claiming that its room or incoming offer completed generation. The third row
applies even when the blocker is nested under an incoming reward: trait
offers, targeted trait targets, Pom level resolution, and other supported
acquisition children occur after the source batch is frozen and therefore
cannot erase its generation evidence. The horizon is derived from canonical
ancestry, evaluator chronology, and target-generation completion markers, not
from finding order, reward/provider identity, biome name, authored batch count,
or rendered control position. A retained batch assessment supplies evidence for
its own decision only; it does not make a later room candidate, target
lifecycle, or downstream decision reachable.

## Evaluation Strategies

Not every candidate requires the same replay scope.

### Direct Support Lookup

Authored start rooms, batch reward stores, Fields Min/Max outcomes, and fixed
declaration constraints already have selected-simulation support ledgers or
immutable declaration domains. They remain direct lookups; session indexes
remove repeated array scans without changing their semantics.

When a required batch value is unresolved, selected simulation cannot publish a
support entry for that value. The candidate session therefore invokes the same
pure support function at the source room's already-materialized `preOutgoing`
history view. This applies to authored reward pools and Fields Min/Max
outcomes. It does not replay the biome or create one scratch project per
option. Fixed `none` and derived `sourceOfferPoint` policies need no authored
prerequisite and remain immediately evaluable.

### Prepared Decision Evaluation

Ordinary room targets and concrete reward alternatives share one exact
pre-decision context. For a room-target domain, the session prepares the source
room and physical exit, the addressed target-generation frontier, room creation
and appearance ledgers, force and requirement facts, the applicable staged or
ordinary declaration pool, and the reward history needed by room eligibility.
Every candidate room is evaluated against that same context; the engine does
not rebuild target-generation maps or relocate the semantic owner for each game
name. For a reward domain, the session prepares the producer frontier described
below, and every complete offer is evaluated from it.

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
the authored terminal control. The completed-Hub Preboss is created with the
Hub and has no candidate domain; the takeover-Preboss domain belongs only to
generated layouts' occurrence sources.

### Scoped Region Replay

Some changes alter more than one local support calculation: O encounter count
and reward-wheel settings alter a room-local lifecycle; a Shop offer
participates in one joint inventory and its participating offers occupy the
Shop's one Room Action chronology; and N membership, visits, and side-room
state alter joint-board, visit, or parent-local regions. These candidates
replay the smallest declared semantic region that contains their effect. No
current candidate family owns a full addressed-biome replay; a genuinely broad
interaction would have to introduce that authority explicitly rather than
inherit a generic fallback.

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

## Reward Producer Frontiers

Selected reward simulation holds the necessary state while walking the room
lifecycle. At every covered reward producer it retains a typed pre-decision
frontier containing enough state to rerun that producer: every reachable latent
reward branch; counted bags and reward history; lifecycle and history
sequence; the semantic producer and offer owner; the resolved store and
declaration binding; sibling offers with their semantic origins; sequential or
jointly unordered generation policy; the room, lifecycle, and generation facts
used at resolution; and the Shop, wheel, cage, side-room, or incoming-reward
policy as applicable.

These frontiers are selected-simulation facts, not candidate arrays. They are
captured as frozen branch references during the normal reward walk rather than
rediscovered by replaying history. Reward evaluation returns them as an opaque
producer capability beside its data-only simulation result, and biome/project
composition carries that capability through the exact assembly. The public
reward and project results omit it entirely; a producer evaluator can look up
only its addressed owner and evaluate its offered value. The frontier is
captured before processing the selected offer or atomic offer group, which
preserves repair support when the selected value is invalid and would
otherwise collapse the reachable branch set.

Candidate evaluation substitutes one proposed complete offer into the producer
and invokes the existing reward authorities:

- a changed offer identity receives the same fresh unresolved acquisition
  children as its semantic replacement command; only the unchanged offer keeps
  its currently authored descendants. Incoming-reward alternatives stop at
  generation support; their new children are authored after selection. Only
  the unchanged incoming offer replays its retained acquisition descendants;
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

The N Hub board's focused-repair fold is owned by
[N Game Rules](../biomes/N_GAME_RULES.md#persistent-board-generation): it starts
from the board's pre-generation frontier, folds every other contributing
authored peer once and omits independently invalid peers. The fold is linear in
the number of open doors and never searches peer subsets or future Hub visits;
it authorizes one edit without publishing a valid board or exposing Hub visit
candidates.

Rerolls and hidden draws use the same frontiers. A reroll surface captured at
its append point (a room's doors after they unlock, a wheel among its offers,
an open Hub stay) evaluates rewards for a press not yet inserted against the
target's store, its first draw and every target's current reward there, with
the pool at that point. A hidden return door's placeholder and reward
candidates come from its room's first outgoing generation, under the creation
caps and the placeholder's own store. When a bag entry is unavailable, the
finding names earlier hidden return doors of the biome that drew from the same
store on a reached branch, as an alternative repair. A rerolled screen's
candidates judge the offer's whole screen chain exactly as settlement does.

The application may aggregate complete offer results into reward-type,
Boon-source, and Devotion-source steps. It does not implement reward support.

### Offer exclusions

An unsupported reward-offer result carries `exclusions`, the engine's typed
answer to why the offer is impossible; a supported result never has them. Each
reason is a closed kind with typed params (store, reward type, god, Shop slot or
option, peer origins, requirement evidence) and no copy; the application words
it. Every reward-offer capability (door, local, wheel, Shop, Fields cohort,
acquisition entry, Artificer, Echo and Travel Deal derivations, starting reward)
publishes the same product:

- **First failing gate per branch.** Each reached branch contributes only the
  first gate that rejects the offer, in the boolean path's own gate order.
  Later gates are not evaluated, and an unexplained branch still counts as
  reached.
- **Static causes.** A cause that cannot depend on rolls (not in the store or
  Shop slot, a reward type the producer fixes or filters out, off the route, an
  Echo replay's fixed offer) is the whole answer only when every branch cites
  it. A static kind cited by only some branches is dropped rather than worded
  as roll-dependent.
- **Aggregation.** Reasons are de-duplicated by their identifying params; the
  first citation's branch-local params (counts, acquired sources, requirement
  evidence) stand for the group. They are ranked by how many branches cite them,
  ties broken by a fixed kind precedence following the gate order, and capped
  at two. `allBranches` marks a reason held in every reached branch.
- **Peers.** Wheel and Shop offers are first assessed alone against the
  frontier: a cause alone is reported as such, and only an offer supported
  alone reports the authored peers it cannot be generated beside, so the
  existential search is unchanged.
- **Cohorts.** A capability that requires every cohort merges their reasons;
  a supported cohort cites nothing, so no merged reason holds in all branches.
- **Cost.** The explanation runs only on the failure path, after the unchanged
  boolean decision; supported offers pay nothing.

Selected-plan findings do not carry these exclusions.

## Replay Horizons

Each candidate family has an explicit semantic horizon:

| Candidate family              | Required horizon                                              |
| ----------------------------- | ------------------------------------------------------------- |
| Start room                    | Declaration-owned start domain                                |
| Room target                   | Target generation support                                     |
| Takeover Preboss batch        | Source pre-generation support across all physical exits       |
| Batch reward store            | Pre-generation store support                                  |
| Incoming reward               | Generation; retained acquisition only for the unchanged offer |
| Local reward                  | Offer generation and its own entered acquisition lifecycle    |
| Sequential sibling reward     | Earlier sibling generation plus the addressed offer           |
| Joint unordered rewards       | Complete atomic sibling generation region                     |
| Shop offer                    | Complete joint inventory generation                           |
| Room Action order             | Occurrence lifecycle and roster-order assessment              |
| Fields Min/Max                | Pre-outcome support ledger                                    |
| Encounter phase               | Active phase preparation checkpoint and valid record prefix   |
| O encounter count             | Supported phase topology; retained leaves are repair evidence |
| O wheel store                 | Exact wheel pre-offer Run/Meta support                        |
| O wheel offer count           | Active-wheel declaration bounds                               |
| O wheel picked offer          | Complete generated cohort through the selected choice         |
| Hub membership                | Joint open-board constraint region                            |
| Hub visit order               | Complete proposed prefix through the Hub visit region         |
| Side-room generation or entry | Parent-local side-room region                                 |
| Broad biome field             | Smallest biome suffix whose rules consume the field           |

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

## Trait Offer Candidate Boundary

Selected assessment and alternative capability are separate products of the
same reached reward walk:

- `BiomeRewardSimulation.selectedTraitOffers` publishes data-only
  `SelectedTraitOfferAssessment` values at exact `TraitOfferAddress` owners,
  with branch-correlated option, generation and selected-effect assessments.
- `BiomeCandidateArtifacts.traitOffers.at(address)` returns opaque operations
  over the captured current and generation-time `SimulationState` and source
  context: complete assessment, starting outcome, structural append/removal
  and selected child queries.

The capability captures each branch before selected settlement or equivalent
post-state merging. Selected assessment and alternatives read the same
state-based predicates; source context carries offer policy rather than copies
of equipment, Arcana/Fear or keepsake facts. Neither the snapshots nor
generation domains escape to React. A query supplies a complete proposed
outcome, and optionally the exact focused option or child selector. Data-only
selected findings cannot assess a replacement. Provider membership and authored
rarity shape remain structural command/codec responsibilities.

Context deduplication compares the explicit semantic inputs consumed by trait
assessment, not the entire state. Unrelated bag or chronology differences must
not multiply equivalent contacts, and relevant differences must not collapse.
The JSON-compared identity must remain serialization-faithful; Sets, Maps and
functions cannot be added to it without an explicit faithful representation.

Publication stops at the first blocking region. The blocking offer retains
its complete finding group and exact repair capability; later unreached offers
do not acquire speculative contexts. Public downstream history carries state
and events, not private candidate inputs or diagnostic offer traces. The
application lazily invokes exact capabilities; it never inspects chance
arithmetic, god membership, lifecycle counters or retained trait history.

### Individual repair and complete-screen support

The focused query assesses the proposed row's declaration/current-state
eligibility, concrete rarity shape, exact replacement and duplicate identity.
It does not use whole-screen generation failure to disable that row.
Unrelated sibling failures do not poison repair; a duplicate blocks its actual
participants. A missing selected target is a following compound edit, not a
reason to make the parent identity unselectable.

Complete assessment separately asks whether the ordinary initial screen is
constructible and whether its selected acquisition detail is valid. The engine
uses the exact reached source, provider, chance ledger, trait history and
Denial state in its staged generation solver. A constructibility failure is
owned by the complete offer (`traitOfferGenerationUnavailable`), not invented
as a prerequisite on each row. Declaration-invalid rarity remains a distinct
structural or individual failure. Specialized provider rarity checks retain
their own contracts.

A replacement candidate supplies its exact occupied slot, prior identity and
promoted rarity. It waives only occupied-slot failure and is not tested as a
fresh random rarity. Siblings are never equipped during candidate evaluation.
All evidence for support must agree within one retained branch; one branch's
eligibility cannot borrow another's generation or selected-effect result.

The [trait offer model](TRAIT_OFFERS.md#assessment-and-settlement) owns settlement;
the [construction audit](../audits/traits/TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md)
owns the source stages. The application must not reproduce either.

### Offer drafts

An unsaved trait offer is shaped through operations on the same prepared
capability:

- Start over returns one engine-supported initial traits-or-Gold outcome.
- Append adds an unused individually eligible identity, subject to the
  three-row structural bound. It may produce a composition-invalid draft.
- Remove deletes the trailing row and retains valid prefix selection/detail.
  Removing the last row returns the existing `fallbackGold` outcome.
- Append from Gold is the inverse structural transition. Gold has no separate
  activation rule in the editor.

Complete assessment still controls Save support. Invalid cardinality is
repairable; it is not a reason to hide the controls that repair it. The
generation authority supplies starting outcomes without becoming a UI domain.

Echo (BBB) drafts instead consume the evaluated mixed-provider replay domain.
They retain sparse rows, selected payloads, distinct identities and trailing
append/removal. Replay eligibility keeps current-state requirements but
bypasses linked boon prerequisites. Shared presentation does not imply
ordinary generation.

### Selected child context

Target enumeration and selected-target validation use the same exact
acquisition state, including earlier primary acquisition for a Stone residual.
Only active selected effects require complete detail; retained incomplete
siblings are not erased. Source availability and acquisition targets stay
distinct where the game makes them so, and products never union targets from
incompatible histories. Missing or stale targets remain pinned and repairable.

Trait-specific child capabilities follow the effect facts in the
[run-impacting trait audit](../audits/traits/RUN_IMPACTING_TRAIT_EFFECTS_GAME_DATA_AUDIT.md):

- Bridal's offer availability stays preferred-only, while its selected
  acquisition uses the broader fallback only after the preferred pool is empty.
- Latest Model uses its declaration-owned Hammer Rank-II domain.
- Natural Selection exposes the next step of its ordered one-to-eight
  allocation, including round completion and capped-target removal, not eight
  independent Pom domains.
- The Ransoms expose a data-only assessment of removed identities and level
  changes, because no authored random result exists.
- Steady Growth exposes the exact reached automatic owner and rarity-target
  capability: an empty domain is a legal no-op; a nonempty domain requires a
  repairable target.

### Specialized offers

Chaos has its specialized prepared domain: three independently legal
curse/requirement columns, then the selected pair's operands, blessing,
shared-rarity support and declaration-owned defaults. Unselected blessings
remain native-generated, not authored state. Exact-context Chaos chance
support does not turn it into ordinary bucket composition.

Qualifying god/shop-aware screen assessments also expose applicable Chaos rules.
Rejected's blockable rows and required/repair state are engine products; the
blocked row remains displayed but cannot be selected or Rarified. React does
not infer provider applicability or active curse state.

A normal Spell Drop owns a fixed-three rarityless self-child capability.
Aspect of Selene instead owns the starting tree in loadout; later concrete
Spell Drops settle Path points without a false trait-offer child.

## Non-Goals

The candidate model does not:

- add incremental Redux simulation across authored project identities;
- store candidate results or interaction progress in authored Redux history;
- cache candidate evidence across semantic edits;
- move simulation rules into React or application presentation code;
- place candidate arrays or UI grouping in canonical history;
- introduce probability, ranking, or likely-route guidance;
- automatically repair retained downstream authorship;
- add a Web Worker merely to conceal repeated biome simulation.
