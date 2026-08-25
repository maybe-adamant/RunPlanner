# Editor UX Audit

## Purpose and boundary

This audit records the cross-biome editor observations and player-facing
language decisions established while the eight route editors were brought to a
shared workspace. It is evidence and product disposition, not a second editor
architecture document.

The stable ownership authorities are [`EDITOR_MODEL.md`](../design/EDITOR_MODEL.md),
[`CONTEXTUAL_EDITOR_UX.md`](../design/CONTEXTUAL_EDITOR_UX.md), and
[`STRUCTURED_EDITOR_WORKSPACE.md`](../design/STRUCTURED_EDITOR_WORKSPACE.md):
they own the domain/projection/React boundary, contextual candidate policy, and
structured presentation contract. Biome rules and normalized declarations own
game facts. This audit records the cross-biome conclusions that those
authorities consume and the visible vocabulary that keeps their products
understandable.

The audit includes rendered headings, labels, buttons, descriptions, findings,
status text, candidate explanations, tooltips, accessible names, route
settings, the shared biome rail, workbenches, completion cards, Hub controls,
and room-local explanatory copy. It excludes TypeScript and persisted-domain
names, semantic addresses, catalog names, CSS classes, cache keys, data
attributes, developer errors, localization infrastructure, and any rule that
would require React to calculate simulation or topology.

## Cross-biome product observations

All eight route biomes participate in the same catalog-driven product loop:
authoring, simulation, editing, profile persistence, recovery, candidate
evaluation, and semantic finding navigation. The shared application provides
stable Room Occurrence and semantic-owner identity, semantic commands with
undo/redo, retained authored values after upstream replacement, scoped
findings, direct semantic navigation, cached candidate projections, and one
`WorkspaceBiome` projection for ordinary and Hub decisions.

The shared workspace evaluates the maximum truthful ordinary-decision or Hub
prefix supported by authored state. It projects addressed candidate support as
`forced`, `possible`, `impossible`, or `unassessed`; an unreached local owner is
`coverageNotReached`, while later route biomes distinguish upstream-incomplete
and upstream-invalid context. These are evidence states, not rendered row
positions. The contextual picker consumes this projection and does not recreate
a second editor surface.

### Biome interaction matrix

| Biome | Progression and ordinary decisions                                                        | Reward/local surface                                                       | Preboss and completion form                                                 | Current authoring interaction                                                         |
| ----- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| F     | Eligibility-driven standard batches; source rooms expose one or two doors                 | Authored Run/Meta batch store and target incoming rewards                  | Takeover Preboss batch; Shop plus at most one free reward                   | Direct empty doors; Door 1 chooses an ordinary room or supported takeover Preboss     |
| G     | Eligibility-driven standard batches; source rooms expose one to three doors               | Authored Run/Meta batch store and target incoming rewards                  | Takeover Preboss batch; Shop plus at most two free rewards                  | Direct empty doors; Door 1 chooses an ordinary room or supported takeover Preboss     |
| H     | Exactly four Fields batches; each owns Min/Max and one or two physical targets            | No base batch store; combat targets own active cage rewards                | Takeover Preboss after the fourth Fields batch                              | Direct empty doors; only the required takeover is authorable at terminal Door 1       |
| I     | Eligibility-driven Clockwork batches with one or two doors; Goal/NonGoal is derived       | No base batch store; combat targets retain dormant-capable NonGoal rewards | Generated Preboss peer after Goals complete; selected peer closes the biome | Direct empty doors; Door 1 uses the ordinary target path, including the Preboss peer  |
| N     | Fixed Opening/PreHub, fixed Hub slots, open members, and six ordered visits               | Joint Hub rewards, parent-local side rooms, and fixed WorldShop            | Completed-Hub handoff creates fixed width-one Preboss Shop                  | Hub membership and visit order; create the handoff after six visits                   |
| O     | Exactly six one-door decisions; ShipCombat rooms own ordered encounters and active wheels | Outgoing store may derive from the final active wheel                      | Declaration-fixed width-one Preboss after the sixth decision                | Direct empty doors; only the fixed width-one Preboss is authorable at terminal Door 1 |
| P     | Eligibility-driven standard batches with source-sensitive compatibility                   | Authored Run/Meta batch store and target incoming rewards                  | Takeover Preboss batch; Shop plus at most one free reward                   | Direct empty doors; Door 1 chooses an ordinary room or supported takeover Preboss     |
| Q     | Six declaration-owned stages; ordinary stages have one door and miniboss stages have two  | No ordinary base store; miniboss targets own counted rewards               | Declaration-fixed width-one Preboss after the sixth stage                   | Direct empty doors; only the fixed width-one Preboss is authorable at terminal Door 1 |

The common surface is therefore a presentation seam, not a common semantic
decision model. F/G/P ordinary batches use history, depth, caps, force,
compatibility, and reward context; H adds Fields pressure; I derives Goal,
NonGoal, and generated Preboss support from Clockwork history; O uses ordered
ship phases and reward wheels; Q starts from declaration-owned stages; N owns a
persistent joint board and parent-local side state rather than arbitrary room
replacement.

### Shared room and reward presentation

One grouped searchable room picker is useful for replaceable ordinary
occurrences, but its concrete candidate domain remains owner-specific. N fixed
Hub slots are not ordinary room replacement. A compact reward interaction is
useful across incoming rewards, cages, wheels, side rooms, and shops, but the
candidate domain is resolved at the exact producer. Store, bag, sibling,
source, Devotion-pair, and counted-reward evidence remain distinct; the editor
does not flatten them into a generic invalid reward.

Direct occurrence workbenches are section-based. Standard rooms use
`Encounter`, `Room features`, and `Room Actions`; N main visits insert `Side
rooms` before room features; H inserts `Fields setup`; Shops lead with
inventory and conditions; and O groups one chronology under `Intro`, `Combat
1`, and optional `Combat 2`. Missing products do not create empty sections.

The shared rule is preserve first, repair explicitly. A room replacement can
retain targets beyond a reduced door capacity; a retained picked door can
become unavailable; and a Preboss batch or completed-Hub handoff can become
unsupported by its predecessor. Previously selected rooms, rewards, source,
Fields outcomes, wheels, Hub membership, visits, and side-room state remain
authored when their owning model permits dormancy. Findings identify the exact
semantic owner and repair route; projection never deletes or silently coerces
retained state.

Candidate explanations guide selection before a command. Findings describe
selected or structural invalidity after a command. Owner markers navigate to
the semantic control, while route and biome status summarize descendants.
Later biomes remain editable when an earlier biome is incomplete or invalid;
their local context is `unassessed`, not locally invalid.

## Evidence and status language

The shared picker vocabulary is:

- `Required` for a value required by reachable support;
- `Possible` for a value supported by at least one reachable state;
- `Unavailable` for a value unsupported by the current assessed context; and
- `Not evaluated` when the required semantic context is not covered yet.

The application may retain the distinction between a selected authored room
and an evaluated entry. Use `Room selected` for authored selection and `Door
taken` for an evaluated entry. A downstream selected room is not entered merely
because it is retained in an authored route suffix.

`Complete`, `Incomplete`, `Valid`, `Invalid`, and `Blocked` remain useful status
labels when nearby copy explains the actionable meaning. Raw projection
provenance (`authored`, `canonical`, `progressive`) and topology-state chips
(`complete`, `partial`, `retained`) are not player status and must not appear in
visible labels, accessible names, or tooltips. The same values may remain in
non-product data attributes.

Evidence-dependent wording belongs in the application projection, not in
React's rule logic. The simulator owns support and evidence; the application
owns grouping, ordering, ordinary versus diagnostic visibility, reason copy,
and selected-invalid pinning; React owns accessible interaction and transient
picker progress.

### Resolved presentation boundaries

- Findings are scoped to the selected route. Settings has no Findings panel,
  and the empty route state is `No findings in this route.`
- The rail keeps a narrow selected-decision context: one selected room and,
  only for a direct single reward, one structured reward token. Generic
  inspector, Hub-card, footer reward summaries, and removal-impact paragraphs
  are not part of the product surface.
- Danger actions retain their visual treatment and player-facing labels, but
  they do not add a second removal-scope explanation.
- Shop details activate when a room is selected in authored state. They do not
  wait for evaluated entry.
- A selected Shop purchase is `Purchased` in inventory overview; Room Actions
  owns the order of participating purchases and the exact unavailable-order
  explanation.

## Product vocabulary

The editor may use rooms, doors, offered rooms, selected rooms, entered rooms,
rewards, reward pools, Shop inventory, side rooms, Hub rooms, route progress,
findings, and the statuses above. The following terms are deliberate:

- `Decision N` is a stable numbered rail landmark. Generic action, repair, and
  finding prose uses `door choice` or `door`, but the numbered landmark stays.
- `Biome stage` is an explanatory rail kicker, not leaked model state.
- `Pylon visit order` is a genuine Ephyra game concept.
- `Dormant` describes a visible but inactive H/O reward offer.
- `Eventual God` remains the intentional Blind Box picker concept; compact
  reward summaries omit a redundant `(eventual)` qualifier.
- `Findings`, `Not configured`, `Required`, `Not evaluated`, and `Unavailable`
  are already understandable product copy.

### Route, rail, and room copy

| Internal or technical presentation                      | Player-facing form                                                                                                                     |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `<n> configured`, `Configured biomes`, `None`           | `Through <last configured biome>`, `Configure route up to`, `No biomes`                                                                |
| `Coverage frontier`, `Active frontier`                  | `Next step`                                                                                                                            |
| `Decision point`                                        | `Door choice`                                                                                                                          |
| `Start biome here`                                      | `Choose the first room`; fixed-start copy says `The game fixes the first room.`; retain `Start with <Room>` as the fixed-start heading |
| `Continue authoring here`                               | `Continue route`                                                                                                                       |
| `Biome structure` / `Focused inspector`                 | `Route structure` / `Details`                                                                                                          |
| `Assessed` / `Unassessed`                               | `Evaluated` / `Not evaluated`                                                                                                          |
| `No authored structure is available yet.`               | `Choose the first room to start this biome.`                                                                                           |
| `No room-local reward.`                                 | `No room reward.`                                                                                                                      |
| `Shop inventory materializes when this room is picked.` | `Shop inventory appears when you select this room.`                                                                                    |
| `Persistent board` / `Persistent offer board`           | `Hub` / `Open Hub rooms`                                                                                                               |
| `Ephyra Hub decision` / `<Room> Hub slot`               | `Ephyra Hub` / `<Room> Hub room`                                                                                                       |
| `Create board first` / `Create Hub board`               | `Set up Hub rooms first` / `Set up Hub rooms`                                                                                          |
| `Closed board slot.`                                    | `This room is closed.`                                                                                                                 |

The route description has an exact empty and non-empty form: use `No biomes
configured.` when the route is empty, and `Configuring <included biome list>.`
when it has an included route prefix. `Through <last configured biome>` and
`Configure route up to` describe the extent and setting control; they do not
replace that route-description sentence.

Use `Doors` rather than `Normal exits` or `Mixed normal exits`; `Door <n>`
rather than `Exit <n>`, `physical exit`, or technical exit wording. Use `Fixed
next room` for a linked transition, `Add fixed next room` for its action, and
`The game fixes the next room here.` for its explanation. Use `Go to <Room>.`
for a fixed transition and state that the World Shop is entered automatically
when that is the relevant destination.

Use `Unavailable saved door`, `Saved room`, and `Offered room` for retained,
authored, and generated values. Use `Remove unavailable doors`, `Remove these
doors`, and `This saved door is no longer available here. Fix the earlier route
first.` for repair. Use `This door cannot be changed.` when the door is fixed.
Preboss actions are `Preboss doors` and `Fix Preboss doors`; a supported
Preboss is selected from the shared `Door 1 room` picker, not from a separate
generated action.

Redundant prerequisite instructions are omitted when control order or
availability already carries the requirement. The editor may disable or defer
the dependent control and preserve its semantic finding, but it does not add
extra copy such as `Choose Door 1 first` or `Select the reward store first`.

### Findings and candidate explanations

Evidence-dependent technical phrases map to the following player language:

| Technical phrase                                                      | Player-facing form                                                   |
| --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `generated reward pool`, `generated batch outcome`                    | `reward pool`, `door setup`                                          |
| `biome outcome`, `biome-wide outcome`                                 | `biome setting`                                                      |
| `declaration-owned Preboss batch`                                     | `Preboss` or `Preboss doors`                                         |
| `fixed Ephyra slots`, `persistent Hub board`                          | `Ephyra rooms to keep open in the Hub`                               |
| `Choose six distinct open pylon rooms in player entry order.`         | `Choose six different open Hub rooms in the order you enter them.`   |
| `entered exit`, `physical exit`                                       | `door taken`, `door`                                                 |
| `generation point`, `possible room set`                               | `when this door appears`, `rooms that can be offered for this door`  |
| `possible store outcomes`, `counted reward pool`, `reward-pool state` | `available reward pools`, `reward pool`                              |
| `resolve at its acquisition point`, `lifecycle point`                 | `be acquired here`, `this point in the route`                        |
| `reward payload`                                                      | `reward details`                                                     |
| `shop configuration`                                                  | `Shop setup`                                                         |
| `required authored structure`                                         | `required earlier route steps`                                       |
| `owner has not been reached by the current evaluated prefix`          | `This part of the route has not been evaluated yet.`                 |
| `simulation does not reach this reward producer`                      | `The current route does not reach this reward yet.`                  |
| `physical exit is not reachable in the current authored prefix`       | `This door is not reachable in the current route.`                   |
| `not supported by the current route state`                            | `not available with the current route`                               |
| `This batch has <n> targets`                                          | `These doors contain <n> rooms`                                      |
| `The parent has <n> exits`                                            | `This room has <n> doors`                                            |
| `This room is not in the authored candidate set`                      | `This room is not available for this door`                           |
| `run creation cap`                                                    | `This room can appear at most <n> times on this route`               |
| `A forced room must be selected`                                      | `This room must be included here`                                    |
| `side-room outcome conflicts with Hub generation pressure`            | `This side-room setup is not available with the selected Hub rooms.` |

Finding destinations follow the same vocabulary: `Biome setting`, `Door
choice`, `Door selection`, `Door <n>`, `Cage <n> reward` or `Side room <n>
reward`, `Side room <n>`, `Side room order`, and `Hub`. Existing destinations
such as `Room reward`, `Reward pool`, `Reward wheel`, `Shop offer`, `Shop
purchase`, `Open Hub rooms`, and `Boss` remain clear.

The following finding intents retain their semantics while using player-facing
copy: `Finish setting up these doors`, `Continue this route`, `Choose open Hub
rooms`, `Choose all six Hub visits`, `Choose the door taken`, `Choose a room for
every door`, and `Finish setting up this Shop`. A selected purchase order that
cannot complete is described as an unavailable purchase order; individual rows
retain their stable Shop-purchase destination.

## Durable disposition

The shared editor surface is a projection over the existing catalog, authored
topology, simulation, candidate evidence, and semantic findings. N's Hub and
side-room workbench, I's generated Preboss, O's ordered ship phases, H's
Fields setup, and Q's declaration-fixed stage progression remain variant-owned
products inside that surface. No vocabulary change renames domain contracts,
changes candidate support, alters topology, or makes React calculate game
facts.

Cross-cutting editor questions should link to this audit and to the relevant
design authority. Reward and trait audits retain their own source matrices;
this editor audit does not merge them or create a permanent audit manifest.
