# Planner Engine: Simulation and Validation

## Responsibility and Authority Map

The planner engine interprets an immutable authored project against an immutable
normalized catalog. It produces exact derived facts for validation, candidates,
the editor and execution publication. It is pure, deterministic and independent
of the catalog implementation, application framework and game runtime.

This is the engine entry document. Detailed contracts have narrower owners:

| Authority                                                   | Responsibility                                                             |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| [Authored Project Model](AUTHORED_PROJECT_MODEL.md)         | Persisted choices, addresses, codecs, atomic commands and topology closure |
| [Game Generation Rules](GAME_GENERATION_RULES.md)           | Physical batches, generation support, takeover and completion              |
| [Room Lifecycle Model](ROOM_LIFECYCLE_MODEL.md)             | Operation order, encounter composition, clocks, room history and resets    |
| [Reward Model](REWARD_MODEL.md)                             | Stores, offers, acquisitions, settlement and trait-bearing leaves          |
| [Candidate Evaluation Model](CANDIDATE_EVALUATION_MODEL.md) | Exact alternative queries and repair capabilities                          |
| [Game Integration Boundary](GAME_INTEGRATION_BOUNDARY.md)   | Engine-owned execution products and downstream responsibilities            |

This document owns their composition, evaluation coverage, finding chronology,
readiness and the explicit handoffs that keep these authorities coherent.

## Engine Ownership Map

Use semantic neighborhoods rather than the first caller that needs a result:

- `authored-project/` owns representable state, commands and local/structural
  decoding;
- `requirements/` and `reward-kernel/` own pure predicate and reward
  transitions over explicit facts;
- `simulation/materialization/` resolves declarations and authored structure;
- `simulation/lifecycle/` and history owners compose and fold ordered facts;
- `simulation/rewards/` owns ordered branch settlement, with acquisition,
  Shop and trait-settlement neighborhoods;
- `simulation/traits/` owns trait history, predicates, offers, levels and
  rarity;
- `simulation/state/` owns authoritative state composition and reached-state
  transitions; feature authorities still own their substate policies;
- `simulation/evaluation/` composes project/biome results and exact artifacts;
- `simulation/progressive/` locates blocking regions and authoring readiness;
- `simulation/candidates/` consumes exact captured capabilities.

A folder is not another processing stage. Shared normalized contracts sit
below their consumers; assembly does not become policy merely because it
joins those consumers. Large coordinators are appropriate when they own one
chronological or atomic invariant.

## The Evaluation Pipeline

```text
catalog + authored project
  → structural completeness and selected topology
  → retained materialization
  → declared lifecycle operations
  → history, generation and reward settlement at exact contacts
  → first blocking region or complete-valid biome
  → immutable biome result and its candidate artifacts
  → route composition and exact project evaluation assembly
```

These are responsibilities, not independent passes that may be freely reordered.
Reward acquisitions can affect later generation, and generation determines
later acquisition context. Their owning coordinators preserve that chronology.

`simulateProject` exposes data-only evaluation. Exact assembly construction
also carries opaque candidate artifacts from the same execution. Candidate
queries do not rerun the project to reconstruct them.

The result contains status, route processing regions, covered histories and
snapshots, findings, an optional selected assessment issue and summary. An
unconfigured project has explicit empty status; incomplete and invalid authored
plans are ordinary results. Malformed input, impossible catalog construction
and violated internal contacts throw contract errors rather than masquerading
as user findings.

Evaluation rebuilds synchronously for a new authored snapshot. Application
caching may reuse a complete assembly for the identical immutable project,
including Undo/Redo. There is no semantic dependence on a background worker,
incremental invalidation graph or mutable application singleton.

## Authored State Is Not Evaluated Truth

Commands answer whether a transition is structurally representable. They check
ownership, supported shapes, static domains and topology closure; they do not
require a successful simulation or erase choices that later become invalid.

The [ordered command reconciliation](AUTHORED_PROJECT_MODEL.md#ordered-reconciliation)
closes source changes and generated state atomically before strict decoding.
Its source-action and generated-action passes have different inputs. A generated
pickup's source, entry and action must agree when the command returns; the
application must not repair them later.

Materialization does not repair missing authorship either. It resolves every
fully authored structural fact it can and leaves the first missing value
addressed. Only referenced occurrences participate. Unpicked offered rewards
can be active while the same room's entry-only Shop or feature state is dormant.

### Materialization products

Room templates produce complete declaration-specific reward, encounter and
lifecycle leaves. Common room assembly adds acquisition sites, features,
action domains, roster and timeline in their required order. Template products
such as Ship state may also support local authoring without a separate
materialization interpretation.

Generated-batch construction resolves source, physical targets, store/batch
state and continuation. Progressive traversal determines how much of that
structure can be assessed. A retained target with an unresolved acquisition
child must not erase its already-generated siblings.

Occurrence identity is independent of game name. Repeated room declarations
create distinct offered occurrences; only selected entry contributes appearance
and room-local effects. Boss/Postboss are ordinary fixed-linked occurrences,
not an evaluation unit merged with Preboss.

### Canonical and retained products

Only a complete-valid biome publishes a canonical snapshot, final history,
completion transition and seed for the next biome.

`materializedPrefix` retains the maximum structurally materializable prefix.
`assessmentPrefix`, when present, is the smaller prefix through the first
blocking region. Coverage, history, findings and candidate artifacts refer to
the assessed product, not every retained materialized leaf. The authored
document retains any remaining suffix.

Canonical rooms retain addresses, resolved identities, active local products
and the one action roster/timeline. They do not copy catalog predicates,
labels or candidate arrays. A canonical snapshot is not execution JSON.

## Completeness, Validity and Coverage

Completeness asks whether the required concrete choices exist. Validity asks
whether reached choices are possible. Coverage says which facts were actually
assessed. These axes must remain distinct.

| Biome state                                         | Available product                                                           | May seed the next biome? |
| --------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------ |
| Start or required field not materializable          | Exact incomplete frontier, no assessed snapshot                             | No                       |
| Incomplete with a reached prefix                    | Materialized prefix, assessed history and repair contacts                   | No                       |
| Complete or incomplete with a reached invalid value | Retained materialization and clamped assessment through the blocking region | No                       |
| Complete and valid                                  | Canonical snapshot, final history and completion transition                 | Yes                      |

Route evaluation composes a complete-valid prefix, at most one progressively
evaluated active biome and an unassessed suffix. A downstream page may expose
authored structure and declaration domains, but never simulates from a guessed
predecessor completion. Earlier invalidity and later incompleteness may coexist;
invalid presentation does not erase the missing owner's identity.

Completeness follows active ownership: offered targets require offer-time
leaves; picked rooms require their entry-time leaves; active generated pickups
and selected children require their own choices. Dormant retained values do not
create findings. An empty optional purchase order is complete, while a missing
required action remains a repairable incomplete state.

### Authoring readiness

The exact assessment stop and the authoring lock are not the same point.
The engine normalizes required incompleteness to the next boundary after the
region the user must be able to repair:

| Missing input       | Region still editable      | First locked region      |
| ------------------- | -------------------------- | ------------------------ |
| Route-start loadout | Loadout                    | First occurrence         |
| Occurrence interior | That occurrence's interior | Its outgoing decision    |
| Outgoing decision   | That outgoing decision     | Selected next occurrence |

Earlier regions stay editable and later authored values remain visible.
Invalidity alone creates no readiness lock. Unassessed does not automatically
mean disabled.

The same semantic chronology locates the missing owner, normalized horizon and
queried command owners. Jointly unordered products, such as a Hub board or
side-room sibling generation set, remain atomic. The application applies this
product; it does not infer chronology from tabs, rail order, a target index or
the component containing the finding.

An unresolved delivery or nested trait child must not prevent arranging and
repairing actions within the same occurrence. Conversely, opening-room editing
cannot bypass an incomplete loadout merely because it uses another control.
These are engine-region rules with application interaction witnesses.

### First blocking region

Producing authorities attach exact semantic owners and internal atomic-region
identity to findings. Progressive retention uses existing materialization,
generation and lifecycle chronology to locate them; finding-array order and
presentation phase alone cannot determine the first region.

An incomplete or invalid configured route publishes exactly one assessment
issue: its semantic repair owner, stable region identity, incomplete/invalid
kind and nonempty collection of reasons. Valid and empty routes have none.
Related reasons retain their exact child origins even when repair belongs to
the containing offer. Exact duplicates collapse by semantic identity and
evidence; warnings do not establish a block. Independent repairs sharing a
checkpoint follow the engine's semantic ordering, never presentation order.
An unlocatable error is a broken engine contract.

Detailed findings remain available to their owning repair, candidate and
delivery-placement consumers. They are not a competing route-level agenda.
The selected issue comes from the same assessment stop that governs coverage;
its containing repair owner neither moves that stop nor sets edit readiness.
Reached resource-placement errors participate at their room-exit effect
boundary, while an unpicked generated host retains its structural repair.
Invalid Fig Leaf choices remain repairable but cannot publish a normally
executed encounter as assessed continuation.

The blocking owner retains its repair capability when reached. Later history
effects, findings and capabilities do not become true merely because their
authored controls still exist. No candidate-only evaluation or UI fallback may
restore withheld semantic facts.

### Generated-batch retention

Outgoing generation publishes one decision-owned assessment, including its
ordered target assessments and any batch-policy evidence. Each target retains
its exact generation pressure and target-local evidence.

A block before generation publishes no assessment. A block during generation
retains completed targets and the bounded repair contact at the failing target.
A block in a later acquisition child retains the already-generated batch.
An unresolved trait or Pom must neither equip its effect nor retroactively
discard the source doors. Shared generation rules serve selected validation,
candidate support and workspace consumers.

## Chronology and History

`SimulationState` is the immutable, branch-local authority for live equipment,
trait history, Arcana/Fear, keepsakes, Hex progression, Well effects, reward
bags/history/priorities, persistent offered-reward lookups, the transient
per-map transition-offered reward types and pending Shop or Shrine work. It
also carries the reached route position and history view.
Transitions return a new state while retaining unchanged substates; replacing
trait history also updates the reward kernel's derived trait facts atomically.
Catalog declarations remain separate from acquired instances and their clocks.

Eligibility consumes the exact reached state plus explicit operation context:
source policy, generation view, store contents or peer-generation contact.
Callers must not assemble parallel copies of live player facts or silently
default a missing state. Pure adapters derive narrow kernel requirements from
that state. Whether a contact consults a fact is distinct from the fact itself;
for example, inventory consults persistent Hub offers while ordinary acquisition
settlement does not.

Earlier source witnesses remain explicit when they differ from current state,
such as Travel Deal's post-purchase generation facts and Echo Gold's source
trait history. Branch evaluation products and executable candidate/continuation
capabilities remain outside `SimulationState`. The state is neither a service
container nor an inspector summary used to authorize transitions.

The lifecycle authority determines operation order. History folding owns
sequence validation, paired-event closure, counters, room/ledger views and
the immutable result. Reward chronology owns possibility branches, findings,
producer frontiers and candidate capture alongside that fold.

Each operation consumes explicit pre- or post-operation facts. Important axes
must never be collapsed into a generic room number:

- creation includes unpicked offers; appearance requires entry;
- counted bags deplete on offers; loot/use history changes on acquisition;
- entered-store history follows declaration policy, not visible reward kind;
- encounter depth and room-history/depth-cache advancement are independent;
- outgoing generation reads its declared source checkpoint, not later pickups;
- biome resets change only declared local state; route history carries onward.

Exact timing and source concordance belong to
[Room Lifecycle Model](ROOM_LIFECYCLE_MODEL.md#counter-and-cache-timing).

### Persistent and multi-phase rooms

N generates its board in physical order and traverses it in authored visit
order. A main-room restore reuses its occurrence; it does not create a room,
reoffer its reward or replay its initial lifecycle. Side-room generation and
entry remain separate. History composes those events through the same fold,
with exact visit/restore identity.

H and O active phases come from declaration-resolved envelopes and authored
structure. Phase completion, automatic end effects, reward readiness and pickup
are separate lifecycle facts. Multiple required encounters do not imply
multiple room commits. P uses exact sequential phase preparation, not a
flattened cross-product encounter choice.

Anomaly, Chaos and Zagreus retain their distinct topology forms while consuming
the common history and generation authorities. The biome documents own
concrete policies; none needs a second validator or history fold.

### Clocks and trait history

Lifecycle decides when clocks advance or due effects run. Effect transitions
return complete history and due products; they do not create independent
schedulers. An automatic mutation and a newly available pickup are different:
the pickup's appearance does not apply its eventual acquisition.

Trait history separates chronological events from current equipment.
Removal does not erase prior acquisition, one-time selection, provider or
Denial history. Shared predicates derive slots, elements, rarity counts and
upgradeability from the same ledger.

Within-sequence order matters. Trait folding applies element derivation and
rarity-floor promotion for newly activated or explicitly rechecked sources
after the whole sequence group.
Those local helpers are not independent handlers that may run in arbitrary
order. Source-time target generation and application against current history
also remain distinct.

## Settlement Handoffs

### Complete products, not shared side effects

A settlement result is more than its surviving branches.
`simulation/rewards/acquisition/contracts.ts` defines the complete boundary:
ordered findings, entry and role frontiers, derived-entry frontiers,
trait-child checkpoints and timeline facts travel with the branches when
produced. Callers merge once at the chronological handoff, preserving distinct
evidence from divergent cohorts.

Site traversal owns entry order and unpicked candidate probes. Conversion
generation returns replacement sources, roles, branches and findings. The role
coordinator owns immediate recursion versus deferred pickups. Neither passes
a mutable accumulator into the other or replays settlement to recover a lost
frontier.

For example, a reached All Together child with no target needs both its finding
and exact pre-effect context. Returning only an outer successful branch loses
repair context. Returning only the finding allows navigation but leaves the
picker unable to propose a correction. The unresolved effect must not enter
history while its exact repair contact remains available.

Artificer uses the current bag at each conversion; a prior conversion can
change the next one's support. The generated replacement is separate from its
later pickup. Source capabilities, conversion history and replacement
acquisition must not be conflated.

### Shop settlement

Shop inventory generation and acquisition settlement are different products.
The ordered Shop coordinator retains inventory witnesses, purchase cohorts,
branch survival and pending state across interleaved actions.

Travel Deal uses its settled triggering purchase and post-purchase generation
facts. Echo Gold retains its pre-source acquisition frontier. Resuming the
room must not regenerate inventory, replay the first purchase or substitute
Shop-entry history for those captured contacts. Room exit closes pending
inventory. Exact ordinary/boosted item witnesses remain distinct even when
their resolved god is identical.

The [Shop contract](REWARD_MODEL.md#shops) owns inventory, participation,
supplemental entries and sufficient-resource policy. Paid purchases and free
pickups share acquisition authorities without losing their instance-specific
capabilities. Mystery Boon source settlement belongs to its acquisition, not
a dormant unpurchased inventory row.

### Selected traits and alternative candidates

Selected settlement answers what the authored outcome does. Candidate
capability answers what can replace it at the exact pre-effect frontier.
They use the same policy but are not interchangeable products.

All offer options are assessed against the same immutable pre-offer context;
unselected alternatives do not equip traits. Selected children, Hex effects
and Concave Stone residuals return complete products to their coordinator.
Structural child discovery and alternative probes do not become another
selected-acquisition history.

Candidate artifacts capture branch-local context before selected settlement
and before equivalent post-states merge. A target cannot borrow its eligibility
from one branch and its prerequisite from another. An invalid selected child
must not destroy its repair domain, and a child address must not be used as a
substitute for the outer prepared capability.

Keep the full contract in
[Candidate Evaluation Model](CANDIDATE_EVALUATION_MODEL.md#trait-offer-candidate-boundary).
Application code consumes typed child collections and bindings rather than
threading every trait-specific field through a parallel route.

### Branch equivalence

Merge only states equivalent to every downstream consumer. Distinct active
Arcana, keepsake history, pending effects or future bag support remain distinct.
Declaration-certified interchangeable entries may collapse; arbitrary
first-entry selection cannot replace possibility branching.

Reward-generation contacts require agreement on the history families they
consume. If those exact inputs diverge where the contract requires agreement,
report a contract failure rather than selecting a convenient branch.
Aggregated diagnostic ranges are not authorization to merge semantic states.

## Findings and Repair

Findings carry stable semantic origin, code, severity and typed evidence.
Instance identity belongs in the address, not the code. Messages and display
labels are application products.

Three responsibilities stay separate:

1. the effect or validation authority identifies the narrowest proven owner;
2. progressive evaluation locates that owner's chronological region;
3. the application maps it to one repair destination shared by navigation and
   inline feedback.

An N side-room acquisition is not located by its parent rail position.
A Supply Chain Pom's target belongs to its generated level-resolution owner,
not the original trait's offer. Extending an address family therefore requires
a chronological-location test and a real application repair witness, not just
a codec test.

Individual purchase failures stay on their acquisition entry. Joint inventory
failure belongs to the Shop with the relevant slots in evidence. A sequence
failure belongs to chronology, not every supported sibling. Missing trait or
target authorship retains the exact child finding rather than an additional
generic purchase failure.

Participation and position are also different: toggling a participant changes
membership without replaying chronological candidate legality. Move controls
assess positions through the simulator. Otherwise an unresolved earlier item
can prevent the user from adding the very action needed to repair the room.

## Run-State Snapshots

Run State is a read-only projection of captured `SimulationState` snapshots,
not a second simulation. All branches at a checkpoint share its exact reached
history view and route position; sequence and counters derive from those
snapshots rather than separately supplied values. It publishes semantic owner,
checkpoint, counters, bags and ledgers without exposing the internal state.

Projection caches account for both the source/view/store/peer contact and the
state inputs consumed by the derivation. Shared reward-history identity alone
does not establish equivalent eligibility: pending deliveries, Hex progression
and persistent reward lookups can differ. Immutable substate identities permit
reuse without serializing the whole state or recomputing every projection.

Ordinary occurrences expose entry and pre-exit snapshots. Ship phases expose
pre-encounter snapshots and the occurrence exposes pre-exit. N also retains
the meaningful pre-board and pre-handoff generation contacts. The
[lifecycle checkpoint contract](ROOM_LIFECYCLE_MODEL.md#lifecycle-run-state-checkpoints)
owns their precise timing.

A retained owner beyond coverage is unavailable with an explicit coverage
reason; it receives no fabricated state. A later failure cannot erase an
already-reached snapshot. Presentation may group equivalent branches and show
ranges for real differences, but must preserve correlated condition groups.
Lazy bags show their declared initial contents without materializing a branch.

Snapshots include trait/element history, god-pool state, Arcana/Fear,
keepsakes and their retained effects. Configured Fear and effective suppression
remain distinct; spent effects are not restored by later suppression.
Acquisition identities distinguish repeated temporary effects. Snapshots
observe those engine products instead of reconstructing clocks, charges or
rarity state from the current selected key.

Offer-local rarity and level context is not a global Run State table.
Exact room/item witnesses, current contributions and pre-offer history govern
each offer; sibling selection cannot rewrite that frozen context. Detailed
rarity, level and effect facts belong to the
[trait audits](../audits/README.md#traits) and their owning reward/candidate
contracts.

## Extension and Verification

Before changing a sensitive boundary, identify its complete input/output
product, chronological owner, downstream consumers and primary tests.

- A new generated child needs command insertion/retraction and retained-source
  tests, then lifecycle maturation and repair coverage.
- A new selected trait child needs complete settlement and exact candidate
  context, including incomplete and stale-target repair.
- A new room shape needs declaration/materialization and chronology evidence,
  not a parallel biome evaluator.
- A new snapshot fact must come from existing folded state, not a diagnostic
  reconstruction.

Keep policy matrices at their owners. Retain representative real-plan
witnesses across acquisition, maturity, upstream change, removal and Undo for
long-lived effects. Product tests prove handoffs rather than reproduce engine
rules in helpers.

Review coherent coordinators by what they own, not their line count. Extract
pure transitions only when they can return complete products without leaking
ordered mutable state. Avoid shadow models, compatibility forwarding layers,
ambient registries and speculative schedulers.

Source uncertainty belongs in focused audits or temporary investigations.
A materially unmodeled rule requires implementation, a narrower supported
surface or a documented bounded approximation—not a generic unsupported value.
No editor layout, runtime mutation or alternate executor semantics belongs in
this engine.
