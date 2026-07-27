# User-Facing Vocabulary Audit

## Status

This is the implementation inventory for Phase 7 Commit 5b.4. It audits the
current standalone editor after the unified-biome migration and defines the
player-facing translations that
[`WORKSPACE_PRESENTATION_POLISH.md`](../progress/WORKSPACE_PRESENTATION_POLISH.md)
will deliver.

The audit is based on the production application under `apps/planner/src` as of
2026-07-27. Internal identifiers remain governed by the authored-project,
simulation, candidate, and structured-workspace authorities. This document
does not rename those contracts.

## Problem

The engine and application projection need exact terms such as `prefix`,
`frontier`, `occurrence`, `batch`, `takeover`, `canonical`, and `progressive`.
Several of those terms currently pass through to visible copy, accessible
names, or status text. The result describes how the planner is implemented
instead of what the player is configuring.

The product boundary is:

```text
internal model and projection vocabulary
  -> explicit presentation translation
  -> player intent, rooms, doors, rewards, and route progress
```

The translation changes copy only. It does not weaken or replace the internal
model.

## Audit Boundary

Included:

- rendered headings, labels, buttons, descriptions, banners, findings, status
  text, removal impact, candidate explanations, tooltips, and accessible names;
- route settings and project feedback;
- the shared biome rail, inspector, door workbenches, completion cards, Hub
  workbench, and room-local explanatory copy;
- presentation strings projected by application code and consumed by React.

Excluded:

- TypeScript type, enum, property, function, command, event, and test-fixture
  names;
- semantic addresses, persisted keys, game names, data attributes, CSS classes,
  cache keys, and developer-only contract errors;
- design documents that intentionally explain the internal architecture;
- catalog labels and genuine game terms;
- a localization framework, copy registry, or generic terminology adapter.

A word is not forbidden globally. The question is whether the rendered use
describes a player-visible game or planning concept. Focused UI tests should
assert the intended copy; the repository should not gain a brittle
forbidden-word scan.

## Player-Facing Vocabulary

The editor may use these concepts directly:

- route and biome labels such as Underworld, Erebus, Oceanus, Fields, Ephyra,
  and Rift of Thessaly;
- room labels and room roles such as Opening, PreHub, Hub, Preboss, Boss,
  Postboss, Combat, Miniboss, Story, Fountain, and Shop;
- door, offered room, generated room, entered room, and door taken;
- reward, reward pool, offer, source, Shop inventory, cage, reward wheel, and
  side room;
- complete, incomplete, valid, invalid, blocked, not evaluated, unavailable,
  findings, Undo, and Redo;
- game-specific choices such as Fields Minimum/Maximum and Ship encounter
  count.

`Normal door` is valid game vocabulary when it must be distinguished from a
future Chaos or other special door. Until that distinction is visible, plain
`Door` is clearer.

## Route and Evaluation Translation

| Internal or current copy                                    | Player-facing translation                                                              | Surface                      |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------- |
| `Configured biomes`                                         | `Configure route up to`                                                                | Route setting label          |
| `None`                                                      | `No biomes`                                                                            | Route setting empty option   |
| `3 configured`                                              | `Through Fields`                                                                       | Route setting summary badge  |
| `Configured biomes form one contiguous route prefix...`     | `Configuring Erebus, Oceanus, and Fields.`                                             | Route setting description    |
| Empty configured route                                      | `No biomes configured.`                                                                | Route setting description    |
| `route prefix`                                              | `configured biomes`, `evaluated biomes`, or `earlier biomes`, according to context     | Route and feedback copy      |
| `has no evaluated route prefix yet`                         | `<Biome> is not evaluated yet. You can still edit it.`                                 | Biome context banner         |
| `blocked until <Biome> is complete and valid`               | `Finish and fix <Biome> before <Biome> can be evaluated. You can still edit it.`       | Biome context banner         |
| `blocked by an earlier route biome`                         | `Finish the earlier biomes before this biome can be evaluated. You can still edit it.` | Biome context banner         |
| `No findings in the evaluated route prefix`                 | `No findings in the evaluated biomes.`                                                 | Findings empty state         |
| `authored`, `canonical`, or `progressive` projection source | Omit. These raw source values are never product status.                                | Biome heading and navigation |
| `Assessed` / `Unassessed`                                   | `Evaluated` / `Not evaluated`                                                          | Rail and Hub status          |
| `Blocked`                                                   | Keep `Blocked`; the nearby banner names what must be finished or fixed                 | Rail and navigation status   |

### Route Settings Target

For an Underworld route configured through Fields:

```text
Route settings
Underworld                         Through Fields

Configure route up to
[ Fields ]

Configuring Erebus, Oceanus, and Fields.
```

For an empty route:

```text
Configure route up to
[ No biomes ]

No biomes configured.
```

The current technical destruction paragraph is removed. Choosing an earlier
biome visibly shortens the configured list, and the existing Undo/Redo history
owns recovery.

## Structure and Navigation Translation

| Internal or current copy                                | Player-facing translation                                                              | Surface                      |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------- |
| `Coverage frontier` / `Active frontier`                 | `Next step`                                                                            | Rail and focused inspector   |
| `Start biome here`                                      | `Choose the first room` for selectable starts, or `Start with <Room>` for fixed starts | Rail                         |
| `Continue authoring here`                               | `Continue route`                                                                       | Rail                         |
| `Active frontier` inspector title                       | `Next step`                                                                            | Inspector                    |
| `Move to Next Decision`                                 | `Go to next step`                                                                      | Room workbench               |
| `occurrence` / `room occurrence`                        | `room`                                                                                 | Explanatory and removal copy |
| `topology` / `authored topology`                        | `route structure`, or omit when the surrounding action already makes the meaning clear | Empty and removal copy       |
| `No authored structure is available yet`                | `Choose the first room to start this biome.`                                           | Empty inspector              |
| `decision` / `exit decision`                            | `door choice`, `later choice`, or `next step`, according to context                    | Actions and removal scope    |
| Raw `complete`, `partial`, or `retained` topology state | Omit. Findings and human status already explain whether work is needed.                | Door workbench status        |
| `completion room`                                       | `Boss` or `Postboss`                                                                   | Completion card              |
| `terminal` / `fixed terminal`                           | Name the concrete `Preboss`, `Boss`, `Postboss`, or final room instead                 | Any future product copy      |
| `derived from the biome layout`                         | `This room is added automatically after the biome.`                                    | Completion card              |
| `not an authored occurrence`                            | Omit                                                                                   | Completion card              |
| `declaration-fixed` / `declaration-owned`               | `fixed by the game`, `added automatically`, or omit                                    | Fixed-room and door copy     |
| `materializes when this room is picked`                 | `appears after this room is entered`                                                   | Shop copy                    |

Internal `frontier`, `occurrence`, `topology`, and completion-node identities
remain unchanged. Only their presentation changes.

## Door and Preboss Translation

| Internal or current copy                                 | Player-facing translation                                                         | Surface                           |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------- |
| `Exit <n>`                                               | `Door <n>`                                                                        | Door row                          |
| `physical exit` / `physical target`                      | `door`                                                                            | Findings, repair, and impact copy |
| `Normal exits` / `Normal batch`                          | `Doors`                                                                           | Rail and door workbench           |
| `Mixed normal exits` / `Mixed batch`                     | `Doors`                                                                           | Rail and door workbench           |
| `Generated exits`                                        | `Offered doors`                                                                   | Door workbench heading            |
| `Configure physical exits`                               | `Choose rooms for these doors`                                                    | Door workbench heading            |
| `Entered exit`                                           | `Door taken`                                                                      | Door selection                    |
| `The entered exit is derived by this batch`              | `The game fixes which door is taken here.`                                        | Fixed selection copy              |
| `This batch awaits its declaration-owned selection`      | `Choose which door is taken.`                                                     | Missing selection copy            |
| `Choose Exit <n> first`                                  | `Choose Door <n> first.`                                                          | Door prerequisite                 |
| `Select the batch reward store first`                    | `Choose the reward pool first.`                                                   | Door prerequisite                 |
| `Select the Fields cage outcome first`                   | `Choose the Fields door roll first.`                                              | Door prerequisite                 |
| `Linked exit` / `Linked decision`                        | `Fixed next room`                                                                 | Rail and linked-room workbench    |
| `Create linked exit`                                     | `Add fixed next room`                                                             | Next-step action                  |
| `This declaration-owned exit is linked...`               | `The game fixes the next room here.`                                              | Linked-room explanation           |
| `Enter <Room> through this declaration-owned transition` | `Go to <Room>.`                                                                   | Fixed next-room action            |
| `...creates one automatically entered World Shop`        | `Go to <Room>. The World Shop is entered automatically.`                          | Fixed World Shop action           |
| `Preboss batch` / `Atomic Preboss batch`                 | `Preboss doors`                                                                   | Rail and door workbench           |
| `Atomic takeover` / `takeover`                           | `Preboss doors`, `Go to Preboss`, or `Fix Preboss doors`, according to the action | Kicker, creation, and repair      |
| `Create Preboss batch`                                   | `Add Preboss doors`                                                               | Preboss action                    |
| `Replace with Preboss batch`                             | `Replace doors with Preboss`                                                      | Preboss action                    |
| `Repair Preboss batch` / `Reconcile takeover`            | `Fix Preboss doors`                                                               | Repair action                     |
| `Preboss declaration`                                    | `Preboss room`                                                                    | Preboss selector                  |
| `Evaluate Preboss batches`                               | `Check Preboss rooms`                                                             | Lazy candidate action             |
| `This Preboss batch is authored atomically`              | `These Preboss doors are changed together.`                                       | Read-only target copy             |
| `Missing Preboss exits are repaired atomically...`       | `Fix Preboss doors to restore the missing doors.`                                 | Repair copy                       |
| `fixed Preboss takeover is not supported...`             | `This Preboss route is not available with the current plan.`                      | Fixed Preboss action              |
| `retained authored offer` / `unavailable retained offer` | `Saved` / `Unavailable`                                                           | Door status                       |
| `This retained exit is unavailable...`                   | `This saved door is no longer available here. Fix the earlier route first.`       | Door explanation                  |
| `Generated offer`                                        | `Offered`                                                                         | Door status                       |
| `Entered route`                                          | `Door taken`                                                                      | Door status                       |

`Batch`, `takeover`, `atomic`, `linked`, `physical`, and `target` remain valid
internal words. The player sees the resulting doors and actions.

## Removal and Repair Translation

| Internal or current copy                                        | Player-facing translation                       | Surface                    |
| --------------------------------------------------------------- | ----------------------------------------------- | -------------------------- |
| `<n> room occurrences`                                          | `<n> rooms`                                     | Removal scope              |
| `<n> exit decisions` / `<n> downstream decisions`               | `<n> later choices`                             | Removal scope              |
| `no authored topology` / `No authored descendants`              | `nothing later in the route`                    | Removal scope              |
| `Repair will reconcile...through the projected takeover action` | `Fixing the Preboss doors will update <scope>.` | Repair scope               |
| `Reconcile unavailable exits`                                   | `Remove unavailable doors`                      | Repair action              |
| `This replacement removes...and resets physical targets`        | `This replaces <n> doors and removes <scope>.`  | Preboss replacement impact |
| `Remove decision`                                               | `Remove these doors`                            | Door-group removal         |
| `projected repair scope`                                        | `changes listed above` or omit                  | Retained-door explanation  |

Counts and removal ownership still come from engine-projected impact. Copy
translation must not make React traverse topology or calculate descendants.

## Findings and Candidate Explanation Translation

| Internal or current copy                                                 | Player-facing translation                                              | Owner |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ----- |
| `Choose the batch outcome`                                               | `Finish setting up these doors`                                        | 5b.4  |
| `generated batch outcome`                                                | `door setup`                                                           | 5b.4  |
| `Add the next exit decision or select a declaration-owned Preboss batch` | `Add the next doors or go to Preboss.`                                 | 5b.4  |
| `Complete the open Hub set`                                              | `Choose the open Hub rooms`                                            | 5b.4  |
| `persistent Hub open set`                                                | `open Hub rooms`                                                       | 5b.4  |
| `Choose an entered exit`                                                 | `Choose the door taken`                                                | 5b.4  |
| `Complete the missing offer for this physical exit`                      | `Choose a room for this door.`                                         | 5b.4  |
| `Configure the entered shop`                                             | `Finish setting up this Shop`                                          | 5b.4  |
| `generation point`                                                       | `when this door appears`                                               | 5b.4  |
| `possible store outcomes`                                                | `available reward pools`                                               | 5b.4  |
| `resolve at its acquisition point`                                       | `be acquired here`                                                     | 5b.4  |
| `shop inventory cannot be generated together at room entry`              | `These Shop offers cannot appear together.`                            | 5b.4  |
| `currentBatchTargetCount` explanation using `batch`/`targets`            | `These doors contain <n> rooms, outside the supported range.`          | 5b.4  |
| `currentBatchRoomCount` explanation                                      | `These doors contain <n> matching rooms, outside the supported range.` | 5b.4  |
| `The parent has <n> exits`                                               | `This room has <n> doors.`                                             | 5b.4  |
| `This room is not in the authored candidate set`                         | `This room is not available for this door.`                            | 5b.4  |
| `Exit <n> is unavailable here`                                           | `Door <n> is unavailable here.`                                        | 5b.4  |
| `possible room set for this exit`                                        | `rooms that can be offered for this door`                              | 5b.4  |
| `side-room outcome conflicts with Hub generation pressure`               | `This side-room setup is not available with the selected Hub rooms.`   | 5b.4  |
| `required authored structure`                                            | `required earlier route steps`                                         | 5b.4  |
| `owner has not been reached by the current evaluated prefix`             | `This part of the route has not been evaluated yet.`                   | 5b.4  |
| `simulation does not reach this reward producer`                         | `The current route does not reach this reward yet.`                    | 5b.4  |
| `physical exit is not reachable in the current authored prefix`          | `This door is not reachable in the current route.`                     | 5b.4  |
| `before editing this biome contextually`                                 | `before choices here can be evaluated`                                 | 5b.4  |
| `lifecycle point`                                                        | `this point in the route`                                              | 5b.4  |
| `counted reward pool`                                                    | `reward pool`                                                          | 5b.4  |
| `reward-pool state`                                                      | `reward pool`                                                          | 5b.4  |
| `reward payload`                                                         | `reward details`                                                       | 5b.4  |
| `required choice set at this decision`                                   | `This option must be included here.`                                   | 5b.4  |
| `not supported by the current route state`                               | `not available with the current route`                                 | 5b.4  |
| `selected purchases cannot be acquired in any valid purchase order`      | `The selected purchase order cannot be completed.`                     | 5c    |

Finding codes, candidate evidence, support states, and semantic owners do not
change. Only `FindingPresentation` and `CandidateExplanation` copy changes.
The Shop purchase message is listed for completeness but remains owned by
Commit 5c because its meaning changes with the ordered authored contract.

## Hub Translation

| Internal or current copy            | Player-facing translation            |
| ----------------------------------- | ------------------------------------ |
| `Hub decision`                      | `Hub`                                |
| `open set` / `persistent Hub board` | `open Hub rooms` / `Hub`             |
| `Complete the Hub visit order`      | `Choose all six Hub visits`          |
| `completed Hub handoff`             | `Go to Preboss`                      |
| `Closing this slot removes <scope>` | `Closing this room removes <scope>.` |
| raw Hub `Assessed` / `Unassessed`   | `Evaluated` / `Not evaluated`        |

Commit 5b.1 owns the hierarchical N rail. Commit 5b.4 applies this vocabulary
to its final rendered surface and does not reopen Hub topology or workbench
ownership.

## Implementation Ownership

Likely 5b.4 production owners:

- `apps/planner/src/ui/shell/App.tsx`;
- `apps/planner/src/ui/feedback/EvaluationFeedback.tsx`;
- `apps/planner/src/projections/evaluationProjection.ts`;
- `apps/planner/src/projections/contextualOptions.ts`;
- `apps/planner/src/projections/structuredWorkspace.ts` for presentation-ready
  messages already owned by the projection;
- `apps/planner/src/ui/editor/biome/BiomeWorkspace.tsx`;
- `apps/planner/src/ui/editor/biome/DecisionWorkbench.tsx`;
- `apps/planner/src/ui/editor/biome/HubDecisionWorkbench.tsx`;
- `apps/planner/src/ui/editor/biome/OccurrenceWorkbench.tsx`;
- `apps/planner/src/ui/editor/biome/topologyRemovalPresentation.ts`.

Copy may stay in an existing React component when it is purely local
presentation. A string that depends on engine evidence or projected state
belongs in the existing application presentation function that already
interprets that evidence. Do not move game rules into React merely to avoid an
internal word.

## Acceptance Inventory

Commit 5b.4 should demonstrate:

- empty, partially configured, and fully configured route settings use
  `Configure route up to`, the selected biome label, and the exact included
  biome labels;
- unassessed and blocked downstream biomes explain their status without
  `prefix`, `assessed`, or application-pipeline vocabulary;
- representative F/G/P ordinary and Preboss doors, H Fields doors, I mixed
  doors, N fixed entry/Hub/Preboss, and O/Q width-one Preboss paths use the
  translations above;
- no representative render exposes raw `authored`, `canonical`, or
  `progressive` projection sources or raw topology-state chips; legitimate
  product status such as `Complete · Valid` remains;
- removal and repair copy names rooms, doors, later choices, and the exact
  projected impact without asking React to derive scope;
- findings and candidate explanations use player-facing route language while
  retaining the same code, evidence, and support result;
- visible labels and accessible names agree;
- internal types, commands, persisted state, simulation, candidates, semantic
  addresses, and data attributes remain unchanged; and
- focused tests assert intended copy by surface rather than enforcing a global
  forbidden-word list.
