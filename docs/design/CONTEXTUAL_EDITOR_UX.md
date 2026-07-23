# Contextual Editor UX

## Purpose

This document defines the contextual-selection foundation for Phase 7 of the
standalone editor. It begins after the complete F/G/H/I and N/O/P/Q product
loops, using all eight concrete editors rather than an F-shaped projection.

The work is organized by user-facing ideas rather than by a global visual
redesign. Its goal is to make room and reward authoring context-aware, compact,
and deliberate while preserving the existing authored-project, simulation,
validation, and semantic-command authorities.

This document owns contextual selector behavior. `EDITOR_MODEL.md` remains the
broader authority for editor ownership, topology projection, findings,
persistence, and undo/redo. `STRUCTURED_EDITOR_WORKSPACE.md` owns the route rail,
layout-specific biome structure, inspector, and final placement of these
controls. `CANDIDATE_EVALUATION_MODEL.md` owns candidate-session preparation,
domain evaluation, and replay scope below this presentation policy.

## Scope

The immediate work contains six independent ideas:

1. context-aware room selection;
2. one grouped room picker instead of a required Type/Room sequence;
3. reward choices constrained by their resolved store;
4. reward choices constrained by jointly generated siblings;
5. reward choices informed by counted-bag state;
6. one compact compound interaction for reward type and payload.

Each idea may land as a separate reviewed slice, but they share one assessment
and presentation boundary. They consume one progressive biome evaluation
foundation from `SIMULATION_AND_VALIDATION.md`; authoring-prefix support is not
a seventh UI feature or a second candidate simulator.

The cross-biome frontier audit is now recorded in
`../audits/CROSS_BIOME_EDITOR_UX_AUDIT.md`. Contextual selection lands before
the final frontier and presentation closure because frontier guidance consumes
the same progressive coverage and candidate evidence. The current
`Add Next Decision`, layout-specific `Go to Preboss`, I conditional-terminal,
N fixed-Hub, and O/Q direct-terminal behaviors do not collapse into one action.

The broad visual treatment of route findings, enrichment color, graph views,
and final application styling are also outside this first set. Existing
semantic findings and navigation remain in force; contextual controls add
local selection guidance rather than replacing validation.

## Product Contract

At every contextual selector, the editor should answer:

- which values can occur at this exact game decision point;
- whether any value is required by the current support set;
- why an unavailable value cannot occur;
- whether the simulator lacks enough upstream history to make a claim;
- whether the currently authored value has become invalid.

The editor helps the user choose a possible plan. It does not optimize for
probability, automatically repair authored state, or silently replace a value
that became invalid after another edit.

## Ownership Boundary

The data flow remains:

```text
simulation candidate assessment
  -> application presentation policy
  -> contextual picker projection
  -> React interaction
  -> one semantic command
```

The simulator owns game facts:

- candidate support;
- force support;
- exact exclusion reasons;
- counter values and declared ranges;
- creation and appearance counts;
- reachable reward-store and counted-bag states;
- peer reward and source conflicts;
- evaluation coverage.

The application presentation layer owns:

- ordering and grouping;
- ordinary versus diagnostic visibility;
- player-facing reason text;
- category aggregation;
- selected-invalid retention;
- compact summary values.

React owns accessible interaction and transient picker state. It does not
reevaluate requirements, bags, force pressure, or sibling legality.

The application also projects the ordered picker sections consumed by React.
The shared component may mechanically render those sections, manage search and
focus, and open an unavailable disclosure; it does not decide category order,
required-first policy, selected-invalid pinning, or ordinary-versus-diagnostic
visibility from raw candidates.

## Progressive Evaluation Foundation

The central project evaluator derives the maximum truthful prefix of the
active biome from the current authored project. The same result becomes the
canonical biome evaluation when authorship reaches the terminal and completion
sequence. Contextual selectors consume addressed pre-decision views from that
single result.

Downstream incompleteness does not block an already-covered selector. An F
plan may therefore explain that Combat 14 is unavailable at Decision 3 before
Preboss is authored or picked.

Progressive evaluation remains route-gated:

```text
complete-valid route prefix
  -> progressively evaluated active biome
  -> blocked downstream biome suffix
```

Each route remains ordered. F must be complete and valid before G receives
contextual evaluation, and N must be complete and valid before O receives it.
Later biome pages stay fully editable, but their contextual room, store, peer,
bag, wheel, Hub, and local-child states are unassessed. The editor must not
derive a downstream seed from predecessor defaults, partial history, or
hypothetical future completion.

Within the active biome, a selector is assessed when evaluation coverage has
reached its exact semantic pre-decision point. Missing unrelated downstream
decisions or terminal structure does not make that context unavailable. A
missing or unsupported upstream state still does.

The UI may display an addressed coverage point as `evaluated through Decision
4`, but decision indexes and rendered rows never enter simulation identity.
Only a complete and valid biome may seed the next biome or contribute to an
execution-ready route.

## Shared Candidate Language

The simulation-level vocabulary remains equivalent to:

| State               | Meaning                                                             |
| ------------------- | ------------------------------------------------------------------- |
| `possible`          | At least one reachable game state supports the proposed value       |
| `forced`            | The current support set requires this candidate or candidate family |
| `impossible`        | No reachable state in the evaluated context supports the value      |
| unavailable context | The required semantic pre-decision context was not reached          |

Unavailable context is not candidate invalidity. The editor must not color or
filter a stable declaration domain as though it had been evaluated when the
simulator could not reach that owner.

### Selected-Value Invariant

A currently authored value is never hidden.

If an upstream edit makes an authored room, reward, or payload impossible, the
editor retains it, presents the exact reason, and permits an explicit
replacement. Only an owning structural deletion may remove it without a
replacement.

### Ordinary and Diagnostic Presentation

The ordinary picker emphasizes supported authoring:

- forced values appear first under `Required now`;
- possible values appear under semantic categories;
- unselected impossible values are absent from the ordinary list;
- a selected impossible value remains pinned and visibly invalid;
- unavailable context leaves the stable domain editable but clearly
  unassessed.

An `Unavailable` disclosure may expose impossible values with their reasons.
These entries are inspectable but not selectable. This replaces the old
choice between an entirely hidden support-first mode and an always-expanded
diagnostic mode.

Color is supplementary. Text, grouping, icons, and accessible descriptions
must carry the same meaning.

## Idea 1: Context-Aware Room Selection

### Room Exclusion Families

The current room generator exposes these exclusion families:

| Simulation reason              | Game meaning                                                      | Ordinary presentation                                      |
| ------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| `notCandidate`                 | The declaration is outside this biome generation domain           | Omit                                                       |
| `physicalExitUnavailable`      | The addressed physical exit does not exist                        | Do not render an active selector for that exit             |
| `exitIncompatible`             | Source/exit structure rejects this target                         | Omit; retain and explain if already authored               |
| `currentRoomRepeat`            | The game cannot immediately repeat the current room               | Omit; retain and explain if already authored               |
| `forceMinimum`                 | A forced declaration has not reached its minimum counter boundary | Omit; expose as `not yet available` diagnostically         |
| failed eligibility requirement | A declared current-run requirement rejects the room               | Present from its typed failure, not one opaque reason      |
| `maxCreationsThisRun`          | Prior generated occurrences exhausted the run-wide creation cap   | Omit; show the current and maximum counts diagnostically   |
| `maxCreationsPerRoom`          | This predecessor exhausted its parent-local creation cap          | Omit; identify the parent-local exhaustion                 |
| `maxAppearancesThisBiome`      | An entered occurrence exhausted the biome appearance cap          | Omit; show the current and maximum counts diagnostically   |
| `forcedPool`                   | A required forced pool excludes otherwise eligible rooms          | Show only supported forced candidates under `Required now` |

The exact modeled caps are `MaxCreationsThisRun`,
`MaxCreationsPerRoom`, and `MaxAppearancesThisBiome`. Presentation must not
collapse creation and appearance histories into a generic uniqueness message.

`physicalExitUnavailable` also obeys downstream retention. An absent,
unauthored physical exit receives no active selector; a previously authored
target retained after capacity shrink remains visible as unavailable until an
explicit repair or structural deletion removes it.

### Structured Requirement Failures

Production currently reports the coarse room reason
`eligibilityRequirement`. That is insufficient for contextual explanations.
The assessment must retain the failed normalized requirement and its concrete
evidence.

A counter-range failure identifies at least:

```ts
interface CounterRangeFailure {
  readonly kind: 'counterRange';
  readonly axis: 'biomeDepthCache' | 'biomeEncounterDepth' | CounterAxis;
  readonly actual: number;
  readonly expected: CounterRange;
}
```

This is a general requirement-evidence contract. `biomeDepthCache` is a
high-value consumer, not a UI special case. The same policy can distinguish:

- not yet inside a minimum boundary;
- past a maximum boundary;
- an unmet history predicate;
- a failed creation, appearance, reward, or encounter condition.

### Force Presentation

Required force pressure matters to ordinary authoring and receives the
`Required now` group. Optional force pressure does not make a merely possible
room more or less valid in this possibility simulator and does not need a
prominent ordinary badge.

## Idea 2: One Grouped Room Picker

The required two-step `Type` then `Room` interaction is retired. Room kind is
navigation, not authored or session selection state.

One accessible searchable picker groups concrete room labels:

```text
Required now
  Preboss

Combat
  Combat 03
  Combat 06

Miniboss
  Shadow-Spiller

Unavailable
  Combat 01 — appearance cap reached
```

The category projection follows its concrete children:

- zero supported children: omit the category from the ordinary list;
- one supported child: present that concrete room directly with one explicit
  selection;
- several supported children: group them without requiring a prior category
  mutation;
- a retained invalid selection: pin it even when its category otherwise has
  no supported children.

Selecting a category must never implicitly author its only child. Choosing a
concrete room remains the user intent and dispatches one semantic command.

Once an occurrence has a room, its selector has no empty replacement. The room
may be replaced, or the occurrence may be removed through an explicit owning
structural command.

## Idea 3: Resolved-Store-Aware Rewards

A reward editor consumes the exact resolved store at its offer point. Its
ordinary reward-type domain must not remain a union of every store that the
template could theoretically use.

Examples:

- a RunProgress offer does not present Ashes as a supported choice;
- a MetaProgress offer does not present Max Health as a supported choice;
- a declaration-forced store applies even when the parent batch uses a
  different authored base store;
- fixed Story, Shop, wheel, cage, side-room, and Goal/NonGoal producers retain
  their declaration-owned store semantics.

Changing a parent batch store retains every authored child reward. A now-
unsupported child remains visible and invalid until replaced. The editor never
repairs child rewards as a side effect of changing the parent store.

## Idea 4: Joint Sibling Reward Awareness

Generated siblings share physical offer order, peer-duplicate rules, Boon
source rules, Devotion projection, and counted-bag mutation where declared.
Every reward candidate must therefore be assessed against the current authored
sibling set rather than in isolation.

Examples include:

- Max Health on Exit 1 can make Max Health unavailable on a later exit;
- a Boon source already used by an earlier sibling can make that source
  unavailable later;
- a Devotion source pair participates through its complete concrete payload;
- an earlier physical offer can deplete a counted-bag entry before a later
  sibling is evaluated.

The explanation identifies the conflicting semantic sibling in player-facing
language, such as `Already offered on Exit 1`. It does not expose occurrence
IDs or finding codes.

Changing an earlier sibling may invalidate a retained later reward. The later
reward remains authored; sibling awareness guides repair but does not perform
it.

## Idea 5: Counted-Bag Awareness

Counted-bag state should affect the candidate picker before the user authors an
impossible reward. An unavailable candidate distinguishes at least:

- outside the resolved store;
- excluded by a bag-entry requirement;
- depleted from every reachable bag state;
- blocked by a jointly generated peer;
- blocked by Boon or Devotion source support.

The simulator models possibility and may preserve several reachable latent
bag states. The ordinary UI therefore must not invent a deterministic
`remaining / total` counter when no single remaining bag exists.

A safe compact summary is based on candidate support, for example:

```text
Run Progress · 6 reward types currently supported
```

An optional diagnostic disclosure may explain unavailable entries and whether
a possible reward is supported by at least one reachable bag state. Exact bag
branches remain simulation evidence, not ordinary editor rows.

## Idea 6: Compact Compound Reward Picker

Reward type and payload form one semantic value and should use one compact
control while closed:

```text
Reward  [Boon · Apollo]
Reward  [Devotion · Apollo / Poseidon]
Reward  [Max Health]
```

Opening the control starts one transient interaction:

1. selecting a payload-free reward commits immediately;
2. selecting Boon advances within the same popover to one God picker;
3. selecting Devotion advances to the chosen-God picker and then the
   spurned-God picker;
4. the complete `ResolvedRewardOffer` is committed only when every required
   payload value exists;
5. cancelling leaves the authored reward unchanged.

The project never stores an incomplete reward or temporary payload. Transient
picker progress is UI-session state and does not enter undo history.

For Devotion, first-source presentation is derived from complete pairs:

- a first source is supported when at least one supported second source can
  complete it;
- after the first choice, the second picker evaluates concrete complete
  pairs;
- the same resolved-store, sibling, source, and bag constraints apply at both
  steps.

The final replacement is one semantic command and one undo entry. Editing only
an existing payload may open directly at the relevant source step while still
committing one complete replacement.

The closed control should occupy one row at normal editor widths. Its popover
may use additional space without permanently expanding every room card.

## Shared Contextual Picker Projection

Room and reward controls should share a presentation vocabulary without
sharing domain rules. A projected option is equivalent to:

```ts
interface ContextualOption<T> {
  readonly value: T;
  readonly label: string;
  readonly category?: string;
  readonly state: 'forced' | 'possible' | 'impossible' | 'unassessed';
  readonly selected: boolean;
  readonly explanation?: CandidateExplanation;
}
```

The production bridge now implements this vocabulary in the application
projection layer. It consumes typed candidate evidence, preserves the richer
engine result, and maps unavailable addressed coverage to `unassessed`. The
grouped room picker consumes the ordered model. Counted reward editors now
consume a producer-resolved type domain and one application-owned relational
payload domain. That domain evaluates complete offers through the existing
possibility frontier, aggregates Boon and Devotion source choices over concrete
witnesses, and retains selected-invalid values. A projected option keeps both
the exact authored offer evaluation and an aggregate supporting witness: a
Devotion source replacement therefore preserves the other authored source even
when another pair is what proves aggregate support. Relational assessment yields
between candidate simulations so opening or hovering a dense Devotion domain
does not monopolize one browser interaction task. Semantic sibling evidence
identifies the conflicting Exit, cage, wheel offer, side room, or Hub room
without exposing occurrence IDs. The compact compound reward picker remains a
subsequent slice.

Before React consumption, the application projects these options into an
ordered picker model containing required, semantic-category, unassessed, and
unavailable sections. This preserves one presentation-policy authority while
allowing room and reward controls to share one accessible component.

This is application/UI vocabulary. It must not replace the richer typed
simulation assessment or enter persisted state.

The common component must support:

- grouped and searchable values;
- an inspectable unavailable disclosure;
- selected-invalid pinning;
- reason text independent of color;
- keyboard traversal and typeahead;
- automatic continuation between compound payload steps;
- one completed user intent per semantic command;
- cached stable option projections rather than rebuilding domains during
  every draw.

## Implementation Seams

### Simulation and Core

- replace the binary incomplete early return with one progressive biome result
  carrying authoring frontier and semantic evaluation coverage;
- reuse the normal materialization, lifecycle, history, room-generation, and
  reward authorities for every covered prefix;
- reserve canonical snapshot, final biome history, completion, and downstream
  seeding for complete-valid results;
- replace the blanket active-biome `biomeIncomplete` candidate outcome with an
  addressed coverage-not-reached reason while preserving distinct
  `upstreamIncomplete` and `upstreamInvalid` route-gate reasons;
- enrich room requirement failure evidence beyond the coarse
  `eligibilityRequirement` reason;
- preserve exact candidate ownership and evaluation coverage;
- retain reward findings/evidence needed to distinguish store, bag, peer, and
  source exclusions;
- continue evaluating concrete reward proposals through the selected-plan
  reward authority.

### Application Projection

- map typed simulation facts to the common contextual option vocabulary;
- aggregate room categories from child support;
- aggregate Devotion first-source support from complete pair candidates;
- centralize player-facing candidate explanations;
- cache projections by immutable project identity and semantic owner.

### React UI

- replace the two native room selects with one accessible grouped picker;
- replace vertically stacked reward/payload selects with the compound reward
  picker;
- keep transient search, disclosure, and partial payload progress out of the
  authored project;
- render simulation facts but never infer them.

## Recommended Delivery Order

1. preserve the completed cross-biome audit and decision record;
2. progressive biome evaluation and validated-route-prefix gating for Linear
   and Hub coverage shapes;
3. candidate evidence and presentation-contract hardening;
4. shared contextual option resolver and reason-copy fixtures;
5. one application-projected contextual-picker model and its first grouped room
   picker consumer;
6. resolved-store-aware reward-type domains;
7. peer-, source-, Devotion-pair, and counted-bag-aware reward payload domains;
8. compact compound reward picker;
9. coverage-derived feedback and blocked presentation;
10. layout-specific structured-workspace projection;
11. Linear spine and focused-inspector presentation;
12. Hub board, visit-timeline, and focused-inspector presentation;
13. frontier, dialogs, repair, accessibility, performance, and responsiveness
    closure across F/G/H/I/N/O/P/Q.

Each slice should leave the existing product loop usable. Contextual-selector
slices do not change frontier topology or commands; the final closure may
change presentation only after the variant-owned action contract is preserved.

## Acceptance

This work closes when:

- an incomplete active biome publishes contextual support for every covered
  decision without publishing a canonical snapshot;
- a missing downstream decision or Preboss does not block earlier room and
  reward selectors;
- every downstream biome receives no contextual claim until every prior biome
  on its route is complete and valid;
- N's joint Hub board and ordered traversal publish coverage by semantic
  region rather than rendered slot order;
- F/G/H/I/O/P/Q room pickers show only context-supported ordinary choices
  while retaining selected invalid rooms; N retains its fixed-slot controls;
- every room exclusion can be explained from typed game evidence;
- zero- and one-candidate room categories require no redundant selection;
- reward choices follow their resolved store before authoring;
- later sibling reward and source conflicts are visible before selection;
- counted-bag depletion is distinguishable from store and peer exclusion;
- Boon and Devotion use one compact, automatically advancing interaction;
- incomplete payloads never enter the authored project or undo history;
- unavailable upstream context is not presented as local invalidity;
- no room, reward, bag, or force rule is implemented in React;
- representative F/G/H/I/N/O/P/Q browser fixtures, accessibility checks,
  responsiveness measurements, and the full repository validation suite pass.

## Phase 7 Integration

The completed audit in `../audits/CROSS_BIOME_EDITOR_UX_AUDIT.md` owns the
cross-biome inventory and frontier decision record. This document owns the
shared contextual-selection behavior. `EDITOR_MODEL.md` continues to own the
broader feedback, navigation, persistence, and interaction boundaries.
`STRUCTURED_EDITOR_WORKSPACE.md` owns structured presentation, while
`../progress/IMPLEMENTATION_PLAN.md` owns the concrete Phase 7 commit sequence.
