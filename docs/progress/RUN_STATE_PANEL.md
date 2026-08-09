# Run State Decision Snapshot Plan

## Status

Implementation-ready. This is a temporary delivery contract. It remains
isolated while the feature is being implemented; durable engine and editor
decisions should be absorbed into their owning design documents when the work
closes, then this file should be retired.

## Purpose

Add one read-only Run State surface that explains the effective run state
immediately before a reached decision generates its rooms and rewards. The
surface makes the simulator's existing history, trait, source-pool, and counted
bag products inspectable without turning React into a second simulator.

This is both a player tool and a modeling witness. It should make errors in
chronology, bag consumption, trait acquisition, and counter updates visible at
the exact decision where they begin, while remaining a projection over the
normal simulation rather than a production self-audit.

## Product Outcome

Every reached outer decision exposes a compact `Run State` launcher. It opens a
left-side contextual sheet titled from the structural decision, for example:

```text
Run state — before Decision 3
Run state — before Hub
Run state — before Preboss
```

The sheet contains:

1. God pool;
2. element counts;
3. equipped traits;
4. current-run counters;
5. counted reward bags.

The state is descriptive only. It never authors a value, changes candidate
support, enters Undo/Redo, or introduces a saved project field.

## Locked Timing Contract

`before decision` means the chronological checkpoint immediately before the
current decision's target generation and offer-time effects:

- every picked room before the decision has completed all lifecycle effects
  that occur before the next generation checkpoint;
- prior generated offers have consumed their exact counted entries, including
  unpicked offers where the game consumes at offer time;
- prior acquisitions, equipped traits, elements, source history, and counters
  are present;
- none of the current decision's authored targets has entered chronological
  room-creation history;
- none of the current decision's rewards has been offered, consumed from a
  bag, or acquired;
- current-decision peer exclusion and target-local reward filters have not yet
  been applied.

The existing reward walk's `outgoingGenerationCheckpoint` is the ordinary
capture point. The implementation must capture the history view and reward
branches together while they refer to that same event sequence. It must not
reconstruct an earlier reward state by walking backward from final biome
branches.

Consequences:

- changing the picked target, room, reward, payload, or trait offer inside the
  current decision leaves the snapshot unchanged;
- changing any reached upstream decision recomputes the snapshot naturally;
- an authored decision whose upstream prefix is not evaluable has no invented
  snapshot;
- editing the current decision never previews the state after that decision.

### Progressive Validation Availability

Run State is a direct witness of progressive validation, not an independent
reward-history diagnostic. A snapshot is available if and only if progressive
evaluation has validly reached that exact semantic decision's
`beforeTargetGeneration` checkpoint.

```text
complete-valid route prefix
  + valid reached biome prefix through the exact pre-decision checkpoint
  -> Run State available

checkpoint not validly reached
  -> Run State unavailable
```

The validity boundary ends immediately before the current decision:

- an invalid, incomplete, or encounter-blocked upstream owner prevents every
  later snapshot whose checkpoint was not reached;
- an invalid room, reward, payload, trait offer, or picked target inside the
  current decision does not suppress that decision's snapshot;
- invalid or incomplete downstream authorship does not suppress an already
  reached earlier snapshot;
- a route biome blocked by an earlier invalid biome publishes no Run State
  snapshots.

The engine evaluation product owns this availability decision. The application
must not infer it from finding counts, biome-wide validity, authored topology,
or the mere presence of reward branches. If a snapshot is published, its
entire represented chronological prefix has passed progressive validation.

## Decision Ownership and Placement

The snapshot owner is the semantic decision, never a rendered decision number.
Ordinary and mixed generated decisions use their exact `ExitDecisionAddress`.
The Hub snapshot uses its exact `HubDecisionAddress`. Presentation derives the
numbered or stage label from the structured workspace.

The launcher belongs in the selected decision workbench header, not in the
biome rail and not on every room card. The rail remains a concise decision
highlight and navigation surface.

For ordinary biomes, every reached generated decision gets one launcher,
including a generated Preboss decision. Fixed room stages, completion rooms,
and room-local children do not get independent launchers.

### N Hierarchy

N is presented as two chronological layers:

```text
outer: Opening -> PreHub -> Hub -> Preboss
inner Hub: ordered combat/story room visits and their local children
```

N follows the same outer-decision rule as every other biome. Its current
structure therefore exposes snapshots before PreHub, before Hub, and before
Preboss. Any future outer decision or detour receives the same treatment
without a room-name exception.

The Hub itself remains one outer decision: its snapshot is captured after
Opening and PreHub have completed but before the Hub board's room and reward
offers are generated. The following Preboss snapshot is captured after the
complete ordered Hub visit prefix and its local effects, but before the
completed-Hub handoff generates Preboss.

Hub visits, Hub slots, story rooms, combat rooms, side rooms, and Hub restores
remain real chronological simulation events, but they do not receive separate
Run State launchers. React must not infer this distinction from room names or
rendered nesting; the workspace projection supplies the two launchers.

## Engine Product

The planner engine owns a frozen `DecisionRunStateSnapshot`-equivalent product
for each reached semantic decision. The final name may follow the local module
vocabulary, but the supported product must contain data rather than UI labels
or callable presentation behavior.

At minimum it carries:

```ts
interface DecisionRunStateSnapshot {
  readonly owner: ExitDecisionAddress | HubDecisionAddress;
  readonly historySequence: number;
  readonly checkpoint: 'beforeTargetGeneration';
  readonly godPool: DecisionGodPoolState;
  readonly traits: DecisionTraitState;
  readonly counters: DecisionCounterState;
  readonly bags: readonly DecisionRewardBagState[];
}
```

The exact subtypes should reuse engine/catalog vocabulary. They must not carry
sheet titles, player-facing store labels, disclosure state, CSS roles, or
workspace node keys.

The product is returned through the normal progressive/canonical biome
evaluation. The reward walk may collect state only at checkpoints reached by
that evaluation; the published snapshot set is bounded by the same progressive
coverage and validation result. It is not stored in a result-keyed side map,
hidden registration, Redux, or a second evaluation pass. Complete and
progressive evaluation expose the same snapshot vocabulary.

### God Pool

God-pool state is the ordinary Olympian source domain interpreted by the same
engine policy used for Boon payload support:

- acquired ordinary source keys;
- source keys currently in the effective pool;
- whether the four-source cap has narrowed the pool.

Hermes remains separate from the ordinary Olympian pool. The product does not
show probabilities, priority-queue state, or a speculative next Boon roll.
The implementation should extract or call the existing engine-owned ordinary
source support query; it must not copy the four-source rule into the snapshot
producer or application.

### Traits and Elements

Trait state comes from the reached branch's canonical `TraitHistoryState`:

- equipped trait key and giver;
- rarity and ordinary slot when present;
- all declared element counters, including zero values;
- derived `upgradableTraitCount`;
- active minimum scalable-god-trait rarity when present.

The snapshot does not recalculate elements from catalog traits in the
application. Proper Upbringing and replacement effects appear only through the
normal chronological trait fold.

### Counters

Counter state begins with the exact `HistoryCounters` at the checkpoint and
adds only existing run facts already consumed by current requirements:

- `runDepthCache`, derived through the existing history projection;
- `enteredBiomes`;
- `lastDevotionDepth` when present;
- `upgradableTraitCount` from the trait fold.

This includes the existing optional Fields, Clockwork, N side-room, and Soul
Pylon counters when they are present. The feature does not create a new generic
counter registry, copy record ledgers into counters, or add facts solely for
display.

### Effective Counted Bags

Every displayed bag is a read-only projection of the exact reachable reward
branches at this checkpoint.

For each normalized counted store, in stable catalog order, the engine product
provides:

- stable `storeKey`;
- total effective remaining multiplicity;
- entry reward type;
- current eligible/ineligible classification;
- retained requirement identity or evaluation evidence;
- the effective remaining count, or a minimum/maximum range if exact branches
  produce a genuinely different aggregate.

This deliberately follows the game's run-start bag model and avoids inventing
a new route-to-store reachability policy for presentation. Stores without a
producer on the current route may remain collapsed; React does not scan room
declarations or remove stores based on the current authored batch selection.
That stable domain is also necessary for the snapshot to remain unchanged when
the current decision's batch store is edited.

The planner lazily creates a bag on first use. An absent `branch.bags[storeKey]`
therefore projects as the complete declaration-owned initial bag. Reading the
panel must not materialize or mutate that bag.

Eligibility has a deliberately narrow meaning: the counted store entry's own
requirement is satisfied by the exact pre-decision facts. Those facts include
the already-entered source room's reward, structural tags, and materialized
Shop option names when a requirement reads them. It excludes facts that only
exist after the upcoming targets are generated:

- current target room reward filters;
- forced-store resolution for a current target;
- same-batch peer duplicate and source exclusion;
- current offer payload support;
- target-local Shop option conflicts.

Those facts do not exist until the current decision is generated. The UI labels
the sections `Eligible now` and `Ineligible now`, not `Can be selected on this
door`.

Exact entry identity remains internal. The effective diagnostic projection
uses two levels:

1. compact rows group by reward type and current eligibility, producing the
   useful count shown to the user;
2. expanded condition detail retains distinct semantic entry groups and their
   requirements.

Eligible and ineligible copies of one reward are never merged. Across exact
reward branches, counts are aggregated by this semantic diagnostic identity.
Equal counts render as `xN`; a genuine difference renders as `xA–N`. The
current catalog is expected to collapse to one effective total even where the
kernel correctly retains different exact entry-removal histories.

The requirement evaluator remains engine authority. If diagnostic condition
evidence needs the same typed tree currently produced for room generation,
extract that evaluator to the requirements/simulation boundary rather than
copying it in the bag projector or React.

## Application Projection

The structured-workspace application layer joins snapshots to their exact
semantic decision owners and creates presentation-ready launcher and sheet
products. It owns:

- structural titles such as `Decision 3`, `Hub`, and `Preboss`;
- `Major Reward` / `Minor Reward` labels while retaining `RunProgress` /
  `MetaProgress` keys;
- catalog-backed player labels for traits and rewards;
- ordering and section grouping;
- compact condition text from engine evidence;
- the engine-published available/unavailable snapshot state for a structural
  decision.

The application may reuse the existing reward-store label and contextual
requirement explanation policies. It must not evaluate a requirement, derive a
god pool, fold traits, count bag entries from raw simulation branches, or infer
N's inner/outer hierarchy. It also must not recreate snapshot availability by
checking findings or biome validity.

The workspace contract should give each structurally eligible decision node
one projected Run State launcher state. A reached launcher binds its exact
engine snapshot. An unreached launcher is unavailable and carries the
engine-projected coverage reason; it never binds a partial or default state.
React mechanically renders that product and opens only its available snapshot.
No room-name switch, finding-count test, or separate topology traversal is
allowed in `BiomeWorkspace`, `DecisionWorkbench`, or `HubDecisionWorkbench`.

## React and Session Contract

Opening `Run State` displays an accessible non-modal contextual sheet anchored
to the left edge of the editor workspace. On desktop it overlays the route and
general navigation region while leaving the active decision inspector visible.
It uses the main panel's visual language rather than the trait dialog's
commit-oriented modal language.

The sheet has:

- a structural title and a clear close button;
- no Save, Cancel, Apply, or authored controls;
- compact God pool, element, trait, and counter sections;
- reward bags collapsed by default, with each bag independently expandable;
- keyboard close on `Escape`;
- outside-click close where the accessible sheet primitive supports it;
- focus moved to the sheet heading/first control on open and restored to the
  launcher on close;
- a full-width narrow-screen treatment rather than a squeezed side column.

Open target and disclosure state are transient editor-session/presentation
state. They never enter project persistence or authored history. Route, panel,
or semantic navigation closes the sheet. After every project publication, the
existing editor-session reconciliation clears a Run State target whose exact
snapshot/launcher no longer exists; it does not silently rehome the sheet to a
different decision.

The initial visual shape is:

```text
+------------------------------------------------+
| Run state — before Decision 3              [x] |
|                                                |
| God pool                                      |
| In pool: Apollo, Demeter, Hera, Poseidon      |
|                                                |
| Elements  Air 2  Earth 0  Fire 1  Water 0 ...|
|                                                |
| Equipped traits                               |
| Flutter Strike · Rare · Attack                |
| Proper Upbringing · Infusion                  |
|                                                |
| Counters                                      |
| biomeDepthCache 4 · routeEncounterDepth 7     |
|                                                |
| > Major Reward (RunProgress)                  |
|   18 entries · 11 eligible · 7 ineligible     |
+------------------------------------------------+
```

Expanded bag shape:

```text
Major Reward (RunProgress)

Eligible now
  MaxHealthDrop x2
  Boon x4
  WeaponUpgrade x1
    HammerLootRequirements

Ineligible now
  StackUpgrade x2
    StackUpgradeLegal
  WeaponUpgrade x1
    LateHammerLootRequirements
```

The concrete condition labels may use normalized/game code names because this
is an explicitly technical disclosure. Player-facing reward and store labels
remain visible alongside those keys.

## Non-Goals

This delivery does not:

- make the sheet an editor or command surface;
- show probability, RNG seed, expected route length, or roll odds;
- preview current-decision candidates or explain peer conflicts;
- expose one tab or selector per internal possibility branch;
- simplify or replace the exact counted-bag kernel;
- change bag refill or consumption behavior;
- add persisted snapshots or caches;
- add launchers to Hub visits or room-local children;
- reorganize the broader structured workspace;
- add a generic diagnostics framework, service container, or catch-all context;
- use production shadow audits as a test surface.

## Delivery Gates

### Gate A — Engine decision snapshots

Deliver one engine-owned vertical product through progressive and canonical
evaluation:

- capture ordinary decision state at the aligned outgoing-generation event;
- capture every N outer decision while treating the Hub as one decision rather
  than its individual visits;
- bound snapshot publication to the exact progressive-validation coverage
  point;
- derive god pool, traits/elements, existing counters, and effective bags;
- treat lazy bags as full declarations without mutation;
- semantically consolidate exact bag branches for diagnostics;
- expose snapshots on the supported biome reward/evaluation product;
- add direct engine tests at the owning reward/history authorities.

Do not land an interface-only or context-threading commit. Gate A is complete
only when direct callers can query real F and N evaluation results.

### Gate B — Workspace projection and transient sheet

Deliver the complete consuming application slice:

- join snapshots to exact decision owners during semantic assembly;
- add projected launcher/sheet products to the deliberate workspace surface;
- place ordinary, Hub, and Preboss launchers without React topology inference;
- add transient Run State target/open/close/reconciliation state;
- render the accessible left sheet and responsive layout;
- retain the existing biome rail and inspector behavior;
- add focused projection, session, and UI tests.

Gate B should normally be one application/UI commit. Split only if each commit
has a real consumer and deletes or completes the path it supersedes.

### Gate C — Product-loop closure and absorption

- add representative complete F and N browser/product witnesses;
- run the complete repository gate;
- perform desktop and narrow visual inspection;
- absorb stable timing, ownership, N placement, and transient-sheet contracts
  into their owning design documents;
- retire this progress document.

Gate C must not duplicate the engine's complete bag or counter matrix in React
tests. Product tests prove contact and chronology; engine tests own the policy.

## Audit Matrix

The implementation is not complete until these claims are witnessed:

| Contract                                                                                         | Primary witness                           |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Previous room acquisition is present; current decision offer is absent                           | engine chronological snapshot test        |
| Changing the current decision leaves its snapshot structurally equivalent                        | engine/project evaluation test            |
| Changing a reached upstream decision recomputes the snapshot                                     | engine/project evaluation test            |
| An unreached decision receives no fabricated snapshot                                            | progressive engine test                   |
| An invalid upstream owner removes every later snapshot whose checkpoint is no longer reached     | progressive engine test                   |
| An invalid value inside the current decision leaves that decision's pre-state snapshot available | progressive engine test                   |
| Downstream invalidity leaves earlier reached snapshots available                                 | progressive engine test                   |
| F publishes one snapshot for each reached generated decision                                     | engine + workspace representative test    |
| N publishes every outer decision while Hub visits receive no independent launcher                | engine + workspace N test                 |
| N's Preboss snapshot includes all ordered Hub visits and local effects                           | engine N chronological test               |
| An unused counted store displays its full declaration without initializing the branch bag        | reward-kernel/snapshot test               |
| Prior offers deplete the displayed effective bag at offer time even when unpicked                | reward snapshot test                      |
| Early and late `WeaponUpgrade` entries appear in the correct eligible sections                   | reward snapshot test                      |
| Same-reward exact entry branches collapse to one effective diagnostic total                      | reward snapshot test                      |
| God-pool cap matches the existing source-support query                                           | reward-kernel/snapshot contact test       |
| Proper Upbringing, replacements, elements, and rarity floor come from chronological trait state  | trait/snapshot contact test               |
| React performs no requirement, bag, counter, or Hub-policy evaluation                            | architecture test and focused code review |
| React and the workspace do not derive snapshot availability from findings or biome validity      | architecture/projection test              |
| Open/close, Escape, focus restoration, route navigation, and stale-target reconciliation work    | session/UI tests                          |
| Opening and closing the sheet creates no authored command or Undo entry                          | Redux/product test                        |

## Verification

During implementation, use the narrow truthful lane for the owner being
changed:

```text
npm run test:engine
npm run test:planner
npm run test:ui
npm run test:product
```

Before Gate C closes:

```text
npm run check
```

Record a small executable work-count witness for one complete F route and one
complete N route. Opening or closing the sheet must perform no new project
evaluation or candidate-session preparation; it reads the already-published
workspace product.
