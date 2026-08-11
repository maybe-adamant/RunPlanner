# User-Facing Vocabulary Audit

## Status

This is the refreshed implementation inventory for Phase 7 Commit 5b.4. It
supersedes the 2026-07-27 inventory and was checked against the production
application under `apps/planner/src` on 2026-08-01. Commit 5b.4 implements its
P1 rows as a presentation-only change; the tables below remain the reviewable
pre-change inventory and target record.

The intervening work materially changed the surface this audit governs:

- Findings are scoped to the selected route; Settings deliberately has no
  Findings panel.
- The rail now keeps a narrow, progressive selected-decision context: one
  selected room is shown, and a direct single reward may follow as a structured
  token. This is not the removed generic reward summary.
- Generic reward footer/Hub-summary copy and removal-impact warnings have been
  deliberately removed. The vocabulary pass must not recreate either.
- Authored selection and evaluated entry are distinct. Copy must preserve that
  distinction even where a downstream selected room has not yet been entered by
  the evaluated route.

Commit 5b.4 is a presentation-only change. It translates visible copy,
accessible names, finding destinations, and evidence-dependent explanations;
it does not rename domain contracts, change candidate support, alter topology,
or make React calculate simulation or removal facts. Commit 5c subsequently
completed the exact-order `shopPurchaseUnavailable` wording recorded below.

## Audit Boundary

Included:

- rendered headings, labels, buttons, descriptions, findings, status text,
  candidate explanations, tooltips, and accessible names;
- route settings and route-scoped feedback;
- the shared biome rail, inspector, door workbenches, completion cards, Hub
  workbench, and room-local explanatory copy; and
- application presentation strings consumed by React.

Excluded:

- TypeScript type, enum, property, function, command, event, and test-fixture
  names;
- semantic addresses, persisted keys, catalog game names, CSS classes, cache
  keys, and developer-only contract errors;
- data attributes such as `data-projection-source` and
  `data-feedback-context`; and
- a localization framework, copy registry, generic terminology adapter, or
  repository-wide forbidden-word scan.

The acceptance condition is that raw terms do not reach visible copy,
accessible names, or tooltips. Their presence in a data attribute is not a
product-language regression.

## Product Language and Deliberate Terms

The editor may use rooms, doors, offered rooms, selected rooms, entered rooms,
rewards, reward pools, Shop inventory, side rooms, Hub rooms, route progress,
findings, complete/incomplete/valid/invalid/blocked, and `Not evaluated`.

Some terms are deliberately retained rather than translated mechanically:

- `Decision N` is a stable rail landmark. Translate generic `decision` and
  `batch` in action, repair, and finding prose, but do not replace the numbered
  rail label.
- `Biome stage` is a current explanatory rail kicker, not leaked model-state
  value.
- `Pylon visit order` is a genuine Ephyra game concept.
- `Dormant` describes a visible but inactive H/O reward offer and remains the
  current H/O presentation decision.
- `Eventual God` and `(eventual)` remain the intentional Blind Box planning
  concepts documented in `docs/design/EDITOR_MODEL.md`.
- `Findings`, `Empty project`, `Not configured`, `Project editor`, and the
  picker states `Required`, `Not evaluated`, and `Unavailable` are already
  understandable product copy.

Use `Room selected` for authored selection and `Door taken` for an evaluated
entry. Do not describe an authored selected room as entered merely because it
is retained in a downstream route suffix.

## Resolved or Intentionally Out of Scope

| Surface                        | Current, verified behavior                                                                                                                                              | 5b.4 disposition                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Findings scope                 | `App.tsx` passes only the selected route's findings to `ProjectFindings`; Settings renders no findings surface. The empty state is already `No findings in this route.` | Keep. Do not restore the old evaluated-prefix wording or add Settings findings.                         |
| Selected-decision rail context | `biome-presentation.ts` projects the selected room and, only for a direct single reward, a structured reward token.                                                     | Keep. Do not restore generic inspector, Hub-card, or footer reward summaries.                           |
| Removal impact                 | The UI now exposes danger actions without `This removes …` scope paragraphs.                                                                                            | Keep the danger treatment and translate only visible action labels. Do not add warning/scope copy back. |
| Shop purchase wording          | Shop rows derive `Purchased` from the authored exact acquisition-site order; `shopPurchaseUnavailable` refers to that order.                                            | Keep `Purchased` for row membership; the Acquisitions workbench owns order controls.                    |
| Candidate picker states        | The shared picker already says `Required`, `Not evaluated`, `Current · unavailable`, and `Unavailable`; unavailable options use `— unavailable`.                        | Keep.                                                                                                   |

The old audit's proposed Shop text was also incorrect: Shop details activate
when a room is selected in authored state, not only after evaluated entry. The
target copy is therefore `Shop inventory appears when you select this room.`

## Open Inventory

### P1 — Route Settings and Evaluation Context

| Live copy                                                                                                                                                  | Target copy                                                                                                                                        | Owner                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `<n> configured`                                                                                                                                           | `Through <last configured biome>`; use `No biomes` when none are configured                                                                        | `ui/shell/App.tsx`                    |
| `Configured biomes`                                                                                                                                        | `Configure route up to`                                                                                                                            | `ui/shell/App.tsx`                    |
| `None`                                                                                                                                                     | `No biomes`                                                                                                                                        | `ui/shell/App.tsx`                    |
| `Configured biomes form one contiguous route prefix. Removing a biome also removes every authored room beneath it; Undo restores the exact prior project.` | An exact included-biome sentence such as `Configuring Erebus, Oceanus, and Fields.`, or `No biomes configured.` Do not restate deletion mechanics. | `ui/shell/App.tsx`                    |
| `<Biome> has no evaluated route prefix yet. Its choices remain editable and are marked Not evaluated.`                                                     | `<Biome> is not evaluated yet. You can still edit it.`                                                                                             | `projections/evaluationProjection.ts` |
| `<Biome> is blocked by an earlier route biome. Its authored values remain editable but are not evaluated.`                                                 | `Finish the earlier biomes before this biome can be evaluated. You can still edit it.`                                                             | `projections/evaluationProjection.ts` |
| `<Biome> is blocked until <Blocker> is complete and valid. Its authored values remain editable but are not evaluated.`                                     | `Finish and fix <Blocker> before <Biome> can be evaluated. You can still edit it.`                                                                 | `projections/evaluationProjection.ts` |

`Blocked`, `Incomplete`, `Complete · Valid`, and `Complete · Invalid` remain
useful status labels. The nearby context explains what the player can do.

### P1 — Rail, Inspector, and Room Surface

| Live copy                                                                                  | Target copy                                                                                         | Owner                                            |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Visible raw source: `authored`, `canonical`, or `progressive`                              | Omit. These are projection provenance, not player status.                                           | `ui/editor/biome/BiomeWorkspace.tsx`             |
| `Assessed` / `Unassessed`                                                                  | `Evaluated` / `Not evaluated`                                                                       | `BiomeWorkspace.tsx`, `HubDecisionWorkbench.tsx` |
| `Coverage frontier` / `Active frontier`                                                    | `Next step`                                                                                         | `BiomeWorkspace.tsx`, `DecisionWorkbench.tsx`    |
| `Decision point`                                                                           | `Door choice`                                                                                       | `BiomeWorkspace.tsx`                             |
| `Start biome here`                                                                         | `Choose the first room` for a selectable start; `Start with <Room>` remains right for a fixed start | `BiomeWorkspace.tsx`                             |
| `Continue authoring here`                                                                  | `Continue route`                                                                                    | `BiomeWorkspace.tsx`                             |
| `Biome structure`                                                                          | `Route structure`                                                                                   | `BiomeWorkspace.tsx`                             |
| `Focused inspector`                                                                        | `Details`                                                                                           | `BiomeWorkspace.tsx`                             |
| `No authored structure is available yet.`                                                  | `Choose the first room to start this biome.`                                                        | `BiomeWorkspace.tsx`                             |
| Raw topology state: `complete`, `partial`, or `retained`                                   | Omit. Existing findings and product status convey actionable state.                                 | `ui/editor/biome/DecisionWorkbench.tsx`          |
| `This completion room is derived from the biome layout and is not an authored occurrence.` | `This room is added automatically after the biome.`                                                 | `BiomeWorkspace.tsx`                             |
| `No room-local reward.`                                                                    | `No room reward.`                                                                                   | `OccurrenceWorkbench.tsx`                        |
| `Shop inventory materializes when this room is picked.`                                    | `Shop inventory appears when you select this room.`                                                 | `OccurrenceWorkbench.tsx`                        |

The raw source and topology-state chips are the highest-confidence visible
leaks in this group. Do not confuse them with the intentionally excluded data
attributes that carry the same internal values.

### P1 — Doors, Fixed Rooms, and Preboss

| Live copy                                                                                             | Target copy                                                                 | Owner                                                      |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `Exit <n>` / `exit` / `physical exit`                                                                 | `Door <n>` / `door`                                                         | `DecisionWorkbench.tsx`, evidence presentation             |
| Accessible `Pick … from Exit <n>`, `Exit <n> unspecified room offer`, and `Exit <n> room`             | The corresponding `Door <n>` labels                                         | `DecisionWorkbench.tsx`                                    |
| `Normal exits` / `Mixed normal exits`                                                                 | `Doors`                                                                     | `BiomeWorkspace.tsx`                                       |
| `Linked exit`                                                                                         | `Fixed next room`                                                           | `BiomeWorkspace.tsx`, `DecisionWorkbench.tsx`              |
| `Create linked exit`                                                                                  | `Add fixed next room`                                                       | `DecisionWorkbench.tsx`                                    |
| `This declaration-owned exit is linked to its fixed room; there is no room selector.`                 | `The game fixes the next room here.`                                        | `DecisionWorkbench.tsx`                                    |
| `Enter <Room> through this declaration-owned transition.`                                             | `Go to <Room>.`                                                             | `structured-workspace/interactions/interaction-binding.ts` |
| `Enter <World Shop>. This declaration-owned transition creates one automatically entered World Shop.` | `Go to <World Shop>. The World Shop is entered automatically.`              | `structured-workspace/interactions/interaction-binding.ts` |
| `Selected route`                                                                                      | `Room selected`                                                             | `DecisionWorkbench.tsx`                                    |
| `Entered route`                                                                                       | `Door taken`                                                                | `DecisionWorkbench.tsx`                                    |
| `Unavailable retained offer` / `Retained authored offer` / `Generated offer`                          | `Unavailable saved room` / `Saved room` / `Offered room`                    | `DecisionWorkbench.tsx`                                    |
| `Choose Exit <n> first.`                                                                              | `Choose Door <n> first.`                                                    | `structured-workspace/assembly/decision-assembly.ts`       |
| `Select the batch reward store first.`                                                                | `Choose the reward pool first.`                                             | `structured-workspace/assembly/decision-assembly.ts`       |
| `Select the Fields cage outcome first.`                                                               | `Choose the Fields door roll first.`                                        | `structured-workspace/assembly/decision-assembly.ts`       |
| `Reconcile unavailable exits`                                                                         | `Remove unavailable doors`                                                  | `DecisionWorkbench.tsx`                                    |
| `Remove decision`                                                                                     | `Remove these doors`                                                        | `DecisionWorkbench.tsx`                                    |
| `This retained exit is unavailable. Reconcile unavailable exits first.`                               | `This saved door is no longer available here. Fix the earlier route first.` | `DecisionWorkbench.tsx`                                    |
| `This exit cannot be replaced.`                                                                       | `This door cannot be changed.`                                              | `DecisionWorkbench.tsx`                                    |
| `This start room is declaration-fixed.`                                                               | `The game fixes the first room.`                                            | `DecisionWorkbench.tsx`                                    |
| `Preboss batch` / `Repair Preboss batch`                                                              | `Preboss doors` / `Fix Preboss doors`                                       | `DecisionWorkbench.tsx`                                    |
| Separate generated Preboss action or selector                                                         | Choose `Preboss` from the shared `Door 1 room` picker                       | `DecisionWorkbench.tsx`                                    |
| `This Preboss batch is authored atomically.`                                                          | `These Preboss doors are changed together.`                                 | `DecisionWorkbench.tsx`                                    |
| `Reconcile <label> against the current declaration-owned exits.`                                      | `Fix <label> to restore the missing doors.`                                 | `DecisionWorkbench.tsx`                                    |
| `Missing Preboss exits are repaired atomically through the projected Preboss action.`                 | `Fix Preboss doors to restore the missing doors.`                           | `DecisionWorkbench.tsx`                                    |

Translate the visible action and explanation only. The underlying all-at-once
Preboss command remains one semantic operation.

### P1 — Hub Surface

| Live copy                                     | Target copy                   | Owner                                            |
| --------------------------------------------- | ----------------------------- | ------------------------------------------------ |
| `Persistent board` / `Persistent offer board` | `Hub` / `Open Hub rooms`      | `BiomeWorkspace.tsx`, `HubDecisionWorkbench.tsx` |
| `Ephyra Hub decision` (accessible name)       | `Ephyra Hub`                  | `HubDecisionWorkbench.tsx`                       |
| `<Room> Hub slot` (accessible name)           | `<Room> Hub room`             | `HubDecisionWorkbench.tsx`                       |
| `Hub decision`                                | `Hub`                         | `BiomeWorkspace.tsx`, finding destinations       |
| `Create board first`                          | `Set up Hub rooms first`      | `HubDecisionWorkbench.tsx`                       |
| `Closed board slot.`                          | `This room is closed.`        | `HubDecisionWorkbench.tsx`                       |
| `Create Hub board`                            | `Set up Hub rooms`            | `HubDecisionWorkbench.tsx`                       |
| `Assessed` / `Unassessed`                     | `Evaluated` / `Not evaluated` | `HubDecisionWorkbench.tsx`                       |

`Open Ephyra rooms`, `Visited`, `Choose next room`, `Player traversal`,
`Pylon visit order`, and `Continue to Preboss` are already suitable.

### P1 — Findings and Candidate Explanations

Evidence-dependent copy stays in the current projection owner. React must not
inspect evidence to decide which player-facing phrase to use.

| Live technical phrase or pattern                                                                                   | Player-facing target                                                                                     | Owner                                             |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `generated reward pool` / `generated batch outcome`                                                                | `reward pool` / `door setup`                                                                             | `evaluationProjection.ts`                         |
| `biome outcome` / `biome-wide outcome`                                                                             | `biome setting`                                                                                          | `evaluationProjection.ts`, `contextualOptions.ts` |
| `declaration-owned Preboss batch`                                                                                  | `Preboss` or `Preboss doors`, according to the action                                                    | `evaluationProjection.ts`                         |
| `fixed Ephyra slots` / `persistent Hub board` / `persistent Hub open set`                                          | `Ephyra rooms to keep open in the Hub`                                                                   | `evaluationProjection.ts`                         |
| `Choose six distinct open pylon rooms in player entry order.`                                                      | `Choose six different open Hub rooms in the order you enter them.`                                       | `evaluationProjection.ts`                         |
| `entered exit` / `physical exit`                                                                                   | `door taken` / `door`                                                                                    | `evaluationProjection.ts`, `contextualOptions.ts` |
| `generation point` / `possible room set`                                                                           | `when this door appears` / `rooms that can be offered for this door`                                     | `evaluationProjection.ts`, `contextualOptions.ts` |
| `possible store outcomes` / `counted reward pool` / `reward-pool state`                                            | `available reward pools` / `reward pool`                                                                 | `evaluationProjection.ts`, `contextualOptions.ts` |
| `resolve at its acquisition point` / `lifecycle point`                                                             | `be acquired here` / `this point in the route`                                                           | `evaluationProjection.ts`, `contextualOptions.ts` |
| `reward payload`                                                                                                   | `reward details`                                                                                         | `evaluationProjection.ts`, `contextualOptions.ts` |
| `shop configuration` / `inventory cannot be generated together at room entry`                                      | `Shop setup` / `These Shop offers cannot appear together.`                                               | `evaluationProjection.ts`, `contextualOptions.ts` |
| `required authored structure` / `owner has not been reached by the current evaluated prefix`                       | `required earlier route steps` / `This part of the route has not been evaluated yet.`                    | `contextualOptions.ts`                            |
| `simulation does not reach this reward producer` / `physical exit is not reachable in the current authored prefix` | `The current route does not reach this reward yet.` / `This door is not reachable in the current route.` | `contextualOptions.ts`                            |
| `before editing this biome contextually`                                                                           | `before choices here can be evaluated`                                                                   | `contextualOptions.ts`                            |
| `not supported by the current route state`                                                                         | `not available with the current route`                                                                   | `contextualOptions.ts`                            |
| `This batch has <n> targets` / `This batch contains <n> matching rooms`                                            | `These doors contain <n> rooms` / `These doors contain <n> matching rooms`                               | `contextualOptions.ts`                            |
| `The parent has <n> exits`                                                                                         | `This room has <n> doors`                                                                                | `contextualOptions.ts`                            |
| `This room is not in the authored candidate set`                                                                   | `This room is not available for this door`                                                               | `contextualOptions.ts`                            |
| `Exit <n> is unavailable here` / `incompatible with this exit`                                                     | `Door <n> is unavailable here` / `incompatible with this door`                                           | `contextualOptions.ts`                            |
| `run creation cap` / `parent ... creation cap`                                                                     | `This room can appear at most <n> times on this route` / `among these doors`                             | `contextualOptions.ts`                            |
| `A forced room must be selected` / `required choice set at this decision`                                          | `This room must be included here` / `This option must be included here`                                  | `contextualOptions.ts`                            |
| `side-room outcome conflicts with Hub generation pressure`                                                         | `This side-room setup is not available with the selected Hub rooms.`                                     | `contextualOptions.ts`                            |

The following finding rows should use the same vocabulary rather than only
rewriting their descriptions:

- `Choose the batch outcome` becomes `Finish setting up these doors`.
- `Add the next exit decision or select a declaration-owned Preboss batch.`
  becomes neutral `Continue this route` copy. Generated continuation is
  `Add next decision`, and any supported Preboss is chosen from `Door 1 room`.
- `Complete the open Hub set` becomes `Choose open Hub rooms`, with `Choose
nine or ten Ephyra rooms to keep open in the Hub.`
- `Complete the Hub visit order` becomes `Choose all six Hub visits`.
- `Choose an entered exit` becomes `Choose the door taken`.
- `Specify every exit` becomes `Choose a room for every door`.
- `Configure the entered shop` becomes `Finish setting up this Shop`.

`shopPurchaseUnavailable` now reports that the selected purchase order cannot
be completed; individual rows retain their stable Shop-purchase destination.

### P1 — Finding Destinations

`findingDestinationLabel` is rendered in the route-scoped Findings panel and
needs its own inventory; the prior audit missed this surface.

| Live destination segment              | Target segment                                                         | Owner                                 |
| ------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------- |
| `Simulated outcome`                   | `Biome setting`                                                        | `projections/evaluationProjection.ts` |
| `Decision`                            | `Door choice`                                                          | `evaluationProjection.ts`             |
| `Selected exit`                       | `Door selection`                                                       | `evaluationProjection.ts`             |
| `Exit <n>`                            | `Door <n>`                                                             | `evaluationProjection.ts`             |
| `Local reward <n>`                    | `Cage <n> reward` or `Side room <n> reward`, based on the owning group | `evaluationProjection.ts`             |
| `Local room <n>` / `Local room order` | `Side room <n>` / `Side room order`                                    | `evaluationProjection.ts`             |
| `Hub decision`                        | `Hub`                                                                  | `evaluationProjection.ts`             |

Existing destinations such as `Room reward`, `Reward pool`, `Reward wheel`,
`Shop offer`, `Shop purchase`, `Open Hub rooms`, and `Boss` are already clear.

## Implementation Ownership and Test Witnesses

Likely 5b.4 production owners:

- `apps/planner/src/ui/shell/App.tsx` for route-setting copy and scoped empty
  findings text;
- `apps/planner/src/projections/evaluationProjection.ts` for route feedback,
  findings, and finding destinations;
- `apps/planner/src/projections/contextualOptions.ts` for candidate evidence
  explanations;
- `apps/planner/src/projections/structured-workspace/assembly/decision-assembly.ts`
  for evidence-backed door and prerequisite messages;
- `apps/planner/src/projections/structured-workspace/interactions/interaction-binding.ts`
  for fixed-next-room and Preboss interaction copy;
- `apps/planner/src/ui/editor/biome/BiomeWorkspace.tsx` for rail, inspector,
  raw-source removal, and completion copy;
- `apps/planner/src/ui/editor/biome/DecisionWorkbench.tsx` for door, fixed
  room, Preboss, repair, and raw-topology-state presentation;
- `apps/planner/src/ui/editor/biome/HubDecisionWorkbench.tsx` for Hub copy;
  and
- `apps/planner/src/ui/editor/biome/OccurrenceWorkbench.tsx` for room-local
  and Shop activation text.

The main focused witnesses are `App.interaction.test.tsx`,
`evaluationProjection.test.ts`, `contextualOptions.test.ts`,
`BiomeWorkspace.test.tsx`, `DecisionWorkbench.test.tsx`,
`HubDecisionWorkbench.test.tsx`, and `OccurrenceWorkbench.test.tsx`. Update
only the tests that own the changed surface; no test should reproduce
simulation, candidate, topology, or removal policy merely to assert copy.

## Updated 5b.4 Acceptance Inventory

Commit 5b.4 should demonstrate:

- empty, partial, and full route settings use `Configure route up to`, a
  player-facing route extent, and the exact included-biome sentence;
- Findings remain selected-route-only, Settings has none, and the current
  `No findings in this route.` empty state remains intact;
- rail and Hub assessment copy says `Evaluated` or `Not evaluated`, while the
  selected-decision room/reward context remains narrow and progressive;
- no representative render, accessible name, or tooltip exposes raw
  `authored`, `canonical`, `progressive`, or topology-state `complete`,
  `partial`, and `retained` values;
- representative ordinary, Fields, mixed, fixed-next-room, Hub, Preboss,
  retained, repair, and completion surfaces use the applicable player-facing
  vocabulary without changing their commands or topology ownership;
- `Room selected` and `Door taken` retain authored-selection versus
  evaluated-entry meaning;
- finding titles, descriptions, candidate explanations, and destinations use
  the same route/door/reward language while retaining the exact same finding
  code, evidence, and support result;
- danger actions retain their red treatment with player-facing labels, but no
  removal-impact warnings or generic reward summaries return; and
- internal types, commands, persisted state, simulation, candidate support,
  semantic addresses, and data attributes remain unchanged.

The active 5b.4 plan consequently requires player-facing removal action labels,
not removal summaries that the product deliberately no longer emits.
