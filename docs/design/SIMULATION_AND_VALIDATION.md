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
- `simulation/draft/` owns Draft generation over those products.

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

`settleProjectEdit` composes a structural command with exact timed-effect
reconciliation and derived required-action activation before application history
publication. It consumes the before
assembly and returns the final project and its exact assembly. Required Hermes
obligations are inserted at reached due contacts read from the Hermes delivery
obligation product (`authored-project/hermes-shrine-delivery.ts` owns its
predicates); optional clocked pickups are
never accepted automatically. Proven displaced payload and automatic outcomes
are reset, while unassessed representable authorship remains retained. When a later
edit reaches inherited timed-effect choices, agreeing current evidence without
established prior correspondence also resets them; the exact choice authored by that
edit is protected. A delivery already ranked at its exact due host and phase with an
unchanged obligation has that correspondence and is retained when first reached. Each
repair consumes an explicit obligation or displaced owner. A repeated repair is
not replayed: settlement stops and returns the last evaluated assembly with a
settlement fault naming the owner, which the application publishes beside the
assembly rather than treating as an error. A fault signals an engine defect, not
an authoring task: it never appears as an editor finding; dev builds warn in the
console when one is recorded, and bug reports carry the current one. Loading and projection
remain read-only, and Undo/Redo restore the settled snapshots.

Evaluation rebuilds synchronously for a new authored snapshot. Application
caching may reuse a complete assembly for the identical immutable project,
including Undo/Redo. There is no semantic dependence on a background worker,
incremental invalidation graph or mutable application singleton.

Within the engine, the project decoder returns an already-decoded frozen biome
plan, loadout, itinerary and route unchanged when their decode inputs (catalog,
route, starting reward, biome position) are the same, so an edit keeps every
untouched biome plan by identity. The route walk (`simulation/evaluation/project.ts`)
then reuses a biome's complete frozen `{ evaluation, candidateArtifacts }` keyed by
the predecessor biome's evaluation (the catalog for the first biome), the plan and
loadout by identity, and the route position, the biome's own forced-Chaos keys and
its slice of resource placements and findings by value. A changed input misses and
every later biome then misses on its new predecessor, so nothing is invalidated;
entries die with their weak keys. The Hub alternative and predecessor replay do
not use it. `test/simulation/biome-evaluation-cache.test.ts` owns the cached
versus cold witness and the reuse and miss cases.

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
`assessmentPrefix`, when present, is the smaller structure reached by the
[selected cut](#selected-cut) through the first blocking product. Coverage,
history, findings and candidate artifacts refer to the assessed product, not
every retained materialized leaf. The authored document retains any remaining
suffix.

Canonical rooms retain addresses, resolved identities, active local products
and the one action roster/timeline. They do not copy catalog predicates,
labels or candidate arrays. A canonical snapshot is not execution JSON.

## Completeness, Validity and Coverage

Completeness asks whether the required concrete choices exist. Validity asks
whether reached choices are possible. Coverage says which facts were actually
assessed. These axes must remain distinct.

| Biome state                                         | Available product                                                          | May seed the next biome? |
| --------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------ |
| Start or required field not materializable          | Exact incomplete frontier, no assessed snapshot                            | No                       |
| Incomplete with a reached prefix                    | Materialized prefix, assessed history and repair contacts                  | No                       |
| Complete or incomplete with a reached invalid value | Retained materialization and the selected cut through the blocking product | No                       |
| Complete and valid                                  | Canonical snapshot, final history and completion transition                | Yes                      |

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

A change that can make a previously valid project invalid or incomplete is a
tightened validity and needs a minor schema bump
([Schema change approval](AUTHORED_PROJECT_MODEL.md#schema-change-approval)).

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
Invalidity alone creates no readiness lock, and unassessed is not itself a
lock: past a blocking product, a control that needs a reached context has none
and shows read-only with the unreached hint, which follows coverage, not
readiness.

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
evidence. Independent repairs sharing a checkpoint follow the engine's
semantic ordering, never presentation order. An unlocatable finding is a broken
engine contract.

Detailed findings remain available to their owning repair, candidate and
delivery-placement consumers. They are not a competing route-level agenda.
The selected issue comes from the same assessment stop that governs coverage;
its containing repair owner neither moves that stop nor sets edit readiness.
A picked host's resource-placement error participates at its room's Overview,
while an unpicked generated host retains its structural repair at its door.
Invalid Fig Leaf choices remain repairable but cannot publish a normally
executed encounter as assessed continuation.

The blocking owner retains its repair capability when reached. Later history
effects, findings and capabilities do not become true merely because their
authored controls still exist. The candidate session answers whether an
exact context exists for a native setting's owner (Ship phase count, reward
wheel, Hub slot and action order, side-room generation and order, Fields point)
by reading retained products or authored structure only; it evaluates no
candidate and replays nothing. No candidate-only evaluation or UI fallback may
restore withheld semantic facts.

### Selected cut

Every block, in an ordinary, fixed Boss or Postboss, opening or Hub-visit room,
on the Hub board or its Handoff, or at the biome start, is published through
one cut of the selected attempt (`simulation/progressive/selected-cut.ts`).
History, the reward walk, door generation and encounter support are cut at the
same chronology position; products before it are the selected attempt's own,
with their candidate capabilities, and nothing after it is evaluated. Every
blocking finding carries that position; an unpositioned block is a broken
engine contract.

Where the cut falls follows the room's
[stages](ROOM_LIFECYCLE_MODEL.md#room-stages):

| Block                                                                                                                                                                                                  | Cut and published products                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview: anything fixed on entry, such as Shop, Shrine, Well or Contract inventory, any phase's encounter identity, composition, customization or introduction, or a picked host's resource placement | After the whole Overview. The room is entered with its `roomEntered` snapshot, its entry effects (Preboss delivery flush, forced-Chaos spark, Fields forfeits) and the continuations created on entry, as on success minus the failed product. The Overview is the repair region; the Timeline and Exit are unreached. |
| Timeline, including the doors opening                                                                                                                                                                  | At the start of the blocking product. Earlier Timeline products are kept. Coverage publishes the room's `roomTimeline.blockingRowKeys`: every Timeline row that settles an owner of the blocking region, whether or not it carries a finding. Later rows, the Exit and later rooms are unreached.                      |
| Exit work                                                                                                                                                                                              | At the failing exit contact. The Timeline, door selection, commit and `beforeRoomExit` snapshot are kept; the room does not exit.                                                                                                                                                                                      |
| The next room                                                                                                                                                                                          | The source room has committed and exited first: its Shop completion, resource element grants and `beforeRoomExit` snapshot are kept. Nothing in the next room changes the source room's door selection.                                                                                                                |

Overview assessments read only entry state, never a Timeline product. The
blocking product is the engine atomic region of the blocking finding, so every
row it owns stays editable at row level (order, removal, purchase
participation). Inside it, only rows at or before the failing contact have
reached inner capabilities; later rows show their inner pickers read-only.
Findings arise only at or before that contact, so no repair is locked.

Encounter support follows the same cut. Every phase of a room prepared through
the cut keeps its identity, composition, generation and roster support, since
those read only the room's preparation and entry state. A phase that started
before the cut keeps its status and Fig Leaf and Gorgon support; a phase
blocked at its own start by a Fig Leaf, Aetos or Gorgon finding keeps its
status without execution and its Fig Leaf support.

### Generated-batch retention

Outgoing generation publishes one decision-owned assessment, including its
ordered target assessments and any batch-policy evidence. Each target retains
its exact generation pressure and target-local evidence.

A block before generation publishes no assessment. The doors opening is one
blocking product because door offers share one offer-time store: an invalid
door offer keeps the whole batch, every door's generation and offer
capability, and blocks at the source room's Timeline, not its Exit. A physical
target generation failure retains completed targets and the bounded repair
contact at the failing target. A block in a later acquisition child retains
the already-generated batch. An unresolved trait or Pom must neither equip its
effect nor retroactively discard the source doors. Shared generation rules
serve selected validation, candidate support and workspace consumers.

## Chronology and History

`SimulationState` is the immutable, branch-local authority for live equipment,
trait history, Arcana/Fear, keepsakes, Hex progression, Well effects, reward
bags/history/priorities, persistent offered-reward lookups, the transient
per-map transition-offered reward types, pending Shop or Shrine work,
pending trait offers and uncollected resource objects' stored amounts. It also
carries the reached route position and history view.

`pendingTraitOffers` (`simulation/state/pending-trait-offers.ts`) records each
spawned, unopened trait-bearing loot by room: a reference to the substates its
options were built from, or a stale mark. It changes only through spawn, open,
room exit and one closed `TraitOfferContextTransition` union—`screenCompleted`
rebuilds every record in the room; `invalidated` (Steady Growth, Transcendent
Embryo, fountain rarity, Nemesis trade) marks them stale. Offer lifecycle
owners spawn records; the transitions owning each native contact return the
union member. The [Reward Model](REWARD_MODEL.md#generation-time-offer-context)
owns the policy.
Transitions return a new state while retaining unchanged substates; replacing
trait history also updates the reward kernel's derived trait facts and, when
Barren starts or ends, the per-card Arcana it unequips or re-adds at Epic
(`reconcileBarrenArcana`), atomically. Echo's Common keepsake copy is a
keepsake-ledger fact (`echoCopyKey`) recorded at the biome start that found
the captured keepsake unheld.
Catalog declarations remain separate from acquired instances and their clocks.

Eligibility consumes the exact reached state plus explicit operation context:
source policy, generation view, store contents or peer-generation contact.
Callers must not assemble parallel copies of live player facts or silently
default a missing state. Pure adapters derive narrow kernel requirements from
that state. Whether a contact consults a fact is distinct from the fact itself;
for example, inventory consults persistent Hub offers while ordinary acquisition
settlement does not.

Earlier source witnesses remain explicit when they differ from current state,
such as Travel Deal's post-purchase generation facts and a pending trait
offer's generation context. Branch evaluation products and executable candidate/continuation
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
facts. Echo Gold consumes its use and registers the duplicate as a pending
trait offer before the source acquisition, and the source screen's completion
rebuilds it. Resuming the
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

All offer options are assessed against the same immutable generation-time
context, while selected effects settle against the current branch;
unselected alternatives do not equip traits. Selected children, Hex effects
and Concave Stone residuals return complete products to their coordinator.
Structural child discovery and alternative probes do not become another
selected-acquisition history.

Acquisition settlement (`trait-settlement/coordinator.ts`) records on each
screen's evaluation the one-use effects it spent when the screen closed (Hymn,
Yarn, an Ordinary curse use) and orders the screen only after the latest
earlier screen in its room from the same giver. `trait-settlement/screen-expectation.ts`
joins those spends with the uses, Concave Stone and rarify state held when the
screen opens into the screen's expectation; execution publication copies the
fields every reached branch agrees on and never derives a spend again. Their
primary tests are `screen-expectation.test.ts` and `screen-spend.test.ts` under
`test/simulation/rewards/trait-settlement/`.

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
Arcana, keepsake history, pending effects, pending trait-offer contexts or
stale marks, or future bag support remain distinct.
Declaration-certified interchangeable entries may collapse; arbitrary
first-entry selection cannot replace possibility branching.

Reward-generation contacts require agreement on the history families they
consume. If those exact inputs diverge where the contract requires agreement,
report a contract failure rather than selecting a convenient branch.
Aggregated diagnostic ranges are not authorization to merge semantic states.

## Findings and Repair

Every finding is a simulation blocker; there is no severity. A finding
carries a stable semantic origin, code and typed evidence. Why a reward-offer
candidate is impossible is a candidate product, not a finding: see
[Offer exclusions](CANDIDATE_EVALUATION_MODEL.md#offer-exclusions).
Instance identity belongs in the address, not the code. Messages and display
labels are application products. An actual lifecycle action block retains each
matching dependency or window violation as invalid ordering; a missing required
action remains incomplete. Dormant stale roster rows do not create findings.

Three responsibilities stay separate:

1. the effect or validation authority identifies the narrowest proven owner;
2. progressive evaluation locates that owner's chronological region;
3. the application maps it to one repair destination shared by navigation and
   inline feedback.

Generated pickup placement assessment is separate from required participation
and reward completeness. Hermes deliveries and clocked trait pickups publish
exact source, entry and reached-contact evidence as valid, invalid or unassessed.
Universal rejection across reached branches proves invalidity; mixed or empty
cohorts do not. Missing candidate capability is not evidence of a stale source.
A valid placement with missing or mismatched reward details retains its reward
repair instead of becoming an obsolete placement.

Lifecycle assessment travels explicitly through chronology publication and
first-blocking retention, independently of reward candidates. The blocking
placement keeps its repair even when it has no candidates; later lifecycle
claims remain withheld. Authored source absence or inactivity is independent
structural proof and remains available for retained hosts beyond coverage,
without synthesizing entered rooms, timelines or history. Existing authoring
readiness still governs invocation. Application projections bind the supported
unplacement or optional-removal intent to the same semantic repair owner used
by finding navigation; local generated required pickups retain source-owned
repair rather than acquiring arbitrary relocation.

An N side-room acquisition is not located by its parent rail position.
A Supply Chain Pom's target belongs to its generated level-resolution owner,
not the original trait's offer. Extending an address family therefore requires
a chronological-location test and a real application repair witness, not just
a codec test.

Shop purchases settle one row at a time over forward-only shared state, so
each purchase owns its own region: purchase, Contract, refill and Gold Gold
Gold duplicate findings belong to their acquisition entry, and a Travel Deal
refill inventory finding to the refill offer. Inventory generation failure
belongs to the Shop's Overview with the relevant slots in evidence; only the
close-time Echo Gold pickup placement finding is Shop-wide. A purchase order
that loses every branch without an entry finding is a broken engine contract.
A sequence failure belongs to chronology, not every supported sibling. Missing
trait or target authorship retains the exact child finding rather than an
additional generic purchase failure.

Encounter preparation owns the Fresh File finding
`encounterIntroductionRequired` on the exact phase for a retained enemy whose
introduction is unfinished. It is an error that withholds execution. Like every
encounter identity and composition finding, it stops assessment at the room's
Overview; the [introduction model](ROOM_LIFECYCLE_MODEL.md#enemy-introductions)
owns the rules. Fig Leaf, Aetos and Gorgon findings have their own phase-child
owners and stop assessment where the phase starts.

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

Snapshots also publish the generated base-store controller's inputs at the
checkpoint's own settled boundary: the run-wide entered/Meta entered tallies and
their ratio, read from the same ledger the door controller reads rather than
counted again, plus the `targetMetaRewardsRatio` this biome's rolled doors
consult. The ratio is null before anything is counted. Where no door in the
biome rolls, the target is absent and the snapshot reports instead the distinct
store keys the biome's room declarations can bank — a room's fixed key, or the
individual/forced pin a `resolvedOffer` room carries. H banks only
`RunProgress`, I only `TartarusRewards`, and N banks nothing.

Snapshots include trait/element history, god-pool state, Arcana/Fear,
keepsakes and their retained effects, the resources gained by acquisitions
settled before the checkpoint, and max health and Magick with their flat
sources. The maxima are derived from folded state only; their settlement-time
inputs (pickup grants, permanent trait grants, the Fight Fight Fight base, the
Silver Wheel grants and the White Antler window) are folded by their owners.
Snapshots also publish lasting armor with its sources under the planner's
no-damage assumption, so armor is never consumed: held armor traits at their
rarity, Pom level or acquisition ordinal, the hidden item total and the held
Silken Sash's `CurrentArmor`. Configured Fear and effective suppression
remain distinct; spent effects are not restored by later suppression.
Acquisition identities distinguish repeated temporary effects. Snapshots
observe those engine products instead of reconstructing clocks, charges or
rarity state from the current selected key.

Each snapshot also carries its biome and an `effects` product derived from the
same folded state: every running clock with its game unit, as a countdown of
what is left or a build-up toward its total; one keepsake chain per entered
biome, with a postboss rack's choice on the biome that ends with it; the current
state of keepsake effects and activation-gated traits (a trait's declared
`activationRequirement` evaluated over the folded element counts), the current
element count of an element-scaled trait, the equipped aspect's rank, and the
acquisition order of non-slot traits, consumed Gold Gold Gold and matured
Chaos blessings.

Offer-local rarity and level context is not a global Run State table.
Exact room/item witnesses, generation-time contributions and history govern
each offer; sibling selection cannot rewrite that frozen context. Detailed
rarity, level and effect facts belong to the
[trait audits](../audits/README.md#traits) and their owning reward/candidate
contracts.

### Start installations

A start installation is the pure projection of a Practice mode start point
from folded states; it adds no simulation. An Opening installs its
predecessor biome's terminal branches in post-reset biome form, since the
native Intro resets the biome records before anything reads them; it requires
a complete, valid predecessor. A Preboss or Boss installs the states its start
room's preparation received, captured for every Preboss and completion Boss
(the Rivals map where Rivals applies) in every simulation, so they already
include the room's own creation effects; a Boss's follow its Preboss's
departure. Biome records are installed in current form for both, and I's
Clockwork counters only at the Preboss. Every installed family must
agree across the reached branches, or the start point is unavailable and names
the disagreeing families. Reward stores are the one exception: a store exact
across branches is installed, and one that differs by branch is left
native-fresh. The stub room history has one record per room-history ordinal
advance, carrying its room's declared `NextRoomSet`; execution assembly adds a
Dream route's `Dream_Intro` prologue, and the visited biomes are the
itinerary prefix before the start (including its own biome for a Preboss or
Boss).
Availability and its reasons are
[authored-model policy](AUTHORED_PROJECT_MODEL.md#route-loadout); the published
form is the execution plan's
[`startState`](GAME_INTEGRATION_BOUNDARY.md#practice-mode-start).

The same projection owns the held-keepsake rows (`projectStartKeepsake`) and
exact store contents (`exactRewardStoreContents`) that every Run State
snapshot, and so every execution frame, carries. `run-state-conformance.ts`
owns the room-exit fact kinds over those snapshots, with its matrix in
`test/simulation/run-state.test.ts`. `execution-plan/modeled-traits.ts`
owns the traits snap restores; its drift test generates the module's
`modeled_traits.lua`.

## Draft Generation

Draft Mode fills a route with a random plan inside a user-described world. The
engine owns all of it: the spec's world options (`draftWorldOptions`), static
basket legality with its caps and refusals (`assessDraftBasket`,
`draftRefusals`), the search (`draftProject` and its biome walk), the encounter
post pass and the report. The application only runs it in a worker and applies
the result as one `ReplaceRoute`.

The walk is driven by the route's next blocking finding and authors each
decision from an engine domain or candidate query through edit settlement,
including every selected-trait child; it never computes game legality. Its own
rules are draft policy, not legality: monotonic acquisition, the god pool,
draft-illegal traits (the Ransoms and the replaying Echo choices), the per-slot
basket claim, the basket's exclusive sets and the planner caps.

The contract is best effort with no compromise on validity: a drafted project
always has zero findings, and the report lists each basket trait, story and
field NPC and rack keepsake as met or unmet. After a biome's first success
that misses a target there, it retries up to the spec's retries per biome
(default 3) and keeps the best. A biome that dead-ends retries only itself;
attempt counts alone bound the search, so a seed drafts the same project on
every machine. The encounter post pass then makes every reached
encounter deterministic from the same seed.

### Draft spec meaning

The draft covers the route's planned biome prefix: targets, racks, caps and the
report stop at the last planned biome. The god pool's order is the order new
gods arrive: whenever the walk would author an offer from a god not yet
acquired this run, it uses the next unacquired pool god instead, so the run's
first Olympian pick is pool #1's. The basket holds one ordered list per giver,
that giver's acquisition order; order across givers means nothing. Only a
god's next unheld trait may be taken from it, and a trait waiting only on run
state (an element threshold or a rarity count) is passed over until that state
holds. A Duo sits in the list of one of its gods, its host: only the host
offers it, it counts toward the host's per-god cap, and when the host's queue
reaches it before its prerequisites are held the host takes its next trait and
returns to the Duo once they are.

Caps are engine-owned and scale with the plan. The god boon cap sums each
planned biome's planned god boons (a route- and biome-keyed default, less one
per biome under Forfeit); the per-god cap defaults to 5, or 4 under Denial;
Hermes and Hammer share one cap equal to the planned biome count. An
over-budget basket is refused, never trimmed. Static refusals also cover a
basket order that places a trait (never a Duo) above its own prerequisite, a
second trait of a mutually exclusive set (read from the catalog's
`notEquippedTrait` requirements, such as the Cast boons), and a pool #1 god
whose first queued trait cannot be the run's first pick (a core boon on a
mature route, the route's first-run offer on Fresh File). World options read
route legality: Fresh File offers only gods its acquisition requirements
admit, with its first-run god required as pool #1, no Hermes, Hammer, Selene,
NPCs or racks, and a nullable loadout; a pool that leaves a god unreachable is
refused.

The loadout is input; the draft generates the starting reward, the biomes and
their rack equip results and the resource points. The starting keepsake's
equip result is input when the player set one: the walk takes it where it is
possible and the basket's trait guard admits it, otherwise it samples one, and
the report lists it met or unmet. The walk never takes a trait outside the
basket while a basket trait it would exclude is still to come, and fills a
Travel Deal refill from the refilled slot's options, as settlement reads it. A
choice that clearly contradicts the basket
is refused: a Jeweled Pom trait in a basket trait's slot, or an Experimental
Hammer trait queued after another basket Hammer or one past the Hammer or the
Hermes and Hammer cap.

### Draft steering

Steering weights are draft policy over legal candidates, reading every room as
the route declares it, route overlays included:

- A selected NPC's window, read generically from its encounter requirements
  (room-reward exclusions, depth window, room tags, the gap since the previous
  NPC, once per route), outranks a due trait: hosting rooms are favoured while
  the window is open and their door reward avoids the excluded types. A missed
  window is reported as a miss.
- Pacing spreads a biome's due god traits over its rooms. When a biome starts,
  each god trait due there gets a target room depth: sorted random draws, in
  schedule order (a Duo after its prerequisites), over a share of the biome's
  expected rooms (its latest forced depth; a Hub's required visits plus its
  entry rooms) that shrinks as the due traits crowd the biome's planned god
  boons. A god's pull is a weight, not a threshold: below a non-god reward's
  well before its trait's target, the due weight at it, growing past it, so a
  trait can land early or a little late; an overdue trait is past its target
  from the biome's first room, and one due in a later biome keeps the wanted
  weight. A god room that comes up early still takes the trait. Hub board doors are authored at the due weight, since their visits come
  later.
- Each exit shows at most one god boon door when it can: once another door of
  the exit holds a god boon (a boon reward, Mystery boon or Devotion trial),
  such rewards on this door are strongly damped, since every shown door draws
  from the bag whether taken or not.
- Shop purchases buy a boon or Mystery boon of a god that can take its next
  queued trait, and Hermes or a Hammer when due, at a soft pace
  of about two purchases per planned biome. The pace steepens when behind or
  when the boon entries left in the bags this biome's doors draw from (its
  base-store policy, else the stores its rooms declare) are nearly spent; it never forces or blocks a purchase, and gold is not modelled.
  The pace is the spec's purchases per biome (default 2); at 0 the draft
  never buys a god boon, while Hermes, Hammer and Dream boosts keep their own
  rules. Filler purchases do not count toward the pace.
- Filler ranking groups non-boon rewards into four kinds, each covering every
  variant: Max Health (`MaxHealthDrop`, its Big, Small and Empty variants),
  Max Magick (`MaxManaDrop` and its Big and Small variants), Gold (`Currency`
  and the `RoomMoney` drops) and Pom (`StackUpgrade`, its Big and Triple
  variants, and the Pom Slice `StoreRewardRandomStack`). Every pickup counts
  one, whatever its size, at a door or in a Shop. Rank weights (6, 3, 2, 1.5
  from the top) apply only to the ranked kinds still short of their per-run
  amount, so the kinds below move up as one finishes; a finished or unranked
  kind is plain filler at weight 1. While a ranked kind is still short, a god
  with no basket trait left weighs below the top-ranked filler. Amounts are
  preferences, never draft targets.
- Once every slot of a Shop holds an item, so its boons are bought first, the
  draft spends the biome's spare purchases (its purchases per biome less those
  made there) on ranked Max Health, Max Magick and Pom still short of their
  amount, each a weighted pick; Shops sell no Gold. A mid-biome Shop keeps one
  spare purchase for the Preboss Shop, which may use them all. The reserve
  counts purchases, not gold.
- Without the midshop preference, a Preboss Shop door still takes the
  preferred-Shop weight when the boon bag runs low or a trait some god can take
  is past its target, and a mid-biome Shop door does once the door bags hold no
  boon.
- On a route whose save-file god history starts closed (Fresh File), a Shop
  stocks only gods already picked up, so a door offering a not-yet-met god
  with queued traits outranks a Shop door, midshop preference included.
- A new door rolls each legal room inside its declared depth window and
  places a hit first. The spec's room forcing picks the chance: by default the
  game's 1 / (deadline - depth) ramp softened one step to
  1 / (deadline - depth + 1), the game's own ramp, or nothing before the
  deadline; a window one depth wide keeps the game's rule under every setting.
  A door that can show a wanted story room keeps it instead, and an offered
  story room's door is always taken. Legality still only forces a room at its
  deadline.
- Fountain rooms only break ties between equal doors and make a wanted god's
  reward likelier. Resource points roll at the spec's resource room chance
  (default one room in ten), preferring an element a waiting trait needs; Dream buys elemental boosts instead.
- Offer exclusions that hold in every branch stop the walk chasing that god or
  source for the biome rather than retrying it.
- Each reached encounter phase where the engine offers the Fig Leaf skip rolls
  the native flat 37% (luck ignored) and is skipped on a hit; uses, the one skip
  per biome and eligibility stay the engine's.
- An unskipped phase where the engine offers Gorgon's Athena trigger takes it,
  assuming the trigger condition met; the Athena offer that follows is authored
  like any trait offer. While the amulet is equipped (starting keepsake, or a
  rack keepsake for a later planned biome), Athena's traits join the basket
  under her one shared NPC cap.

A fixed corpus (`npm run test:draft-corpus`) measures these rules, including
the spread of basket traits' in-biome landing depths, the god boon rooms'
count, gaps and early share per biome, and the Shops entered per run; its committed baseline records rates
and medians, not plans.

### Draft share codes

A share code carries what a player authors for a draft, so drafting a pasted
code gives the same plan: the route (and a Dream itinerary), the configured
prefix, the loadout choices the draft reads (weapon, aspect with its Hex tree,
keepsake with its chosen equip result, familiar, Vows and manual Arcana; none
on Fresh File), the ordered god pool and basket, NPC and rack picks, the
Advanced overrides that differ from their defaults and the seed. Pasting
installs a carried equip result and leaves one the code lacks. It leaves out
what the draft generates (the starting reward) and what sits outside the draft
(the Practice start and run modifiers), so a code reproduces the plan only
when those match.

The engine codec (`encodeDraftShareCode`, `decodeDraftShareCode`) packs
positions in catalog-ordered lists into base32 behind a layout version (3) and
a fingerprint of those lists and the catalog facts that shape the layout. The
loadout and the draft world (gods, basket, NPCs, racks, seed) are positional;
the basket is its traits giver by giver, each with one more position naming
which of its givers lists it when more than one offers it (a Duo's host), and
the fingerprint covers each giver's traits. The stored Advanced options follow as tagged entries (a count, then each
option's `DRAFT_OPTIONS` tag, payload length and payload; a ranking's payload
is each entry's counted choice index and counted amount, 0 for none), and a reader skips
an unknown tag, so a new option needs no layout change. A code from another
layout, catalog or route is refused rather than decoded into other keys (a code
from an earlier layout as from an older planner); the loadout passes its
validation and the draft spec heals through the tolerant draft spec decode.
Codes are made on demand and never persisted, so they touch neither the project
schema nor the plan wire. Pasting
installs the spec and loadout through semantic commands (`draftShareCommands`)
as one history edit.

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

`npm run test:equivalence` is the behaviour-preservation witness for engine
refactors: it compares digests of the simulation product, the encoded
execution plan and a candidate-session probe, including every settled trait
child's attached Run State captures, against a committed baseline. No corpus
project attaches a capture to a child emitted in the same step's leading
emissions; the Echo encounter child attaches to a later exit-decision capture
in one entry. Reachability of same-step attachment is a follow-up.

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
