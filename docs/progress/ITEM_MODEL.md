# Part 2, step C5: the item model

Status: owner model approved (2026-11-10); schema 103 scope expanded for
the later slices. C5a delivered on `live-pickups` (awaiting review); C5b-C5d
not started. Temporary plan; delete at delivery after promoting durable
results. Follows [LIVE_PICKUPS](LIVE_PICKUPS.md) step C.

Investigations (read-only, 2026-11-10):

- `/home/ayyatma/run-planner-investigations/live-pickups/existence-vs-interaction.md`
- `/home/ayyatma/run-planner-investigations/live-pickups/lifecycle-triggers.md`

## Owner model

- A room is a set of **items**. An item's properties are either derived (by
  engine rules) or observed (game rolls the planner is told).
- **Outcomes** (player choices) live on items.
- Timeline rows are thin: subject + verb, in order.
- **Verbs** are distinct interactions: pick up, goldify, transform
  (Artificer), talk to, buy, sell, reroll, choose, unlock (cage), use
  (fountain, Well), and so on.
- The live row lists things. Clicking a thing shows its verbs; choosing one
  creates that interaction row.
- When an item's source or content changes, the old item and its whole chain
  go and the new item spawns live.

## Slices

- **C5a** items and verbs on the live product. No schema, no behaviour
  change, equivalence unchanged.
- **C5b** observations and outcomes onto items, thin rows, the 102 → 103
  conversion.
- **C5c** same-key swap: rows keyed by item, so a same-role swap (Zeus Boon
  to Hera Boon) removes the old row like any other swap.
- **C5d** lifecycle events as triggered consequences, with encounter begin
  (depth) split from combat start (`StartEncounterEffects`).

## C5a: what the live product publishes

- A separate query, `liveInteractionsForProjectEvaluationAssembly`, wraps the
  live actions product; Draft and Collect all required keep the cheap
  `liveActions…` and never pay for verbs.
- Every live item (pickup or object) carries `verbs`: kind, participation,
  deadline, the row it stands as or places, and either the ordered commands
  performing it at that gap (empty while standing) or a picker. A picker is
  `before` (it supplies the commands: reroll press, unpinned Pool sale, blank
  Travel Deal item) or `after` (the commands apply as is: Pom level, Well or
  Pool rerolled list, rack keepsake, Artificer replacement).
- Each existing action maps to one verb by its row kind. A standing row
  acquiring one reached role adds goldify and transform where the
  conversion capability captured at its contact supports them (paid items
  never), each a `ReplaceAcquisitionDisposition`; the row's own verb then
  undoes a conversion.
- Choice verbs the live product lacked: door, cage and wheel reroll presses
  at the surface's append point; Well and Pool rerolls and unpinned Pool
  sales where the room's reached actions end; each only while a held card
  enables it and the pool pays, and a sale only while its list can show a
  held trait (the picker's `traitKeys`, never empty). A pinned Pool sale and
  the rack are roster rows already. Verbs at one gap are alternatives: each
  is one edit, and the product is read again after it, so a sale and a
  reroll at the same gap never compose.
- `progression` at the frontier: `leaveRoom` once the walk passes the room
  with nothing required live; `chooseWheel` when the next wheel's choice is
  the only required thing live. Leaving is the exit decision, not a row, so
  it carries no command.
- `leftBehind`: the optional pickups live at the room's last gap, once the
  walk passes the room.

Gaps left for C5b (the engine cannot derive them today):

- Goldify and transform for an unplaced item, or for a placed one at any
  gap but its own: the conversion capability exists only at a reached
  contact, so the state at another gap is unknown.
- Shared conversion capacity: a row's offer reads its own contact, which
  counts only earlier conversions, so goldifying or transforming an earlier
  row can starve a later standing conversion (its finding then shows). The
  witness pins it; the item model fixes it by judging an item's conversion
  against the whole room's.
- An Artificer offer withheld at zero uses is not witnessed: no fixture
  reaches a fourth eligible pickup without the replacement choices
  rippling. The offer reads the same `supported` assessment as Time Piece,
  whose zero-charge and Unfated cases are witnessed.
- A new reroll press carries no `reference`: the picker allocates its row
  id. (A Well or Pool reroll names its row since C5b-1.)
- A row covering several roles (a caged Blind Box) gets no conversion verbs.
- Well and Pool rerolls, Pool sales and door rerolls only at their append
  point: no engine query answers their other legal indices. A wheel
  reroll while its choice is unplaced appends past the frontier, so it is
  not offered.
- The keepsake rack's choice uses `ReplacePostbossKeepsake` after placing
  the row; there is no placement command carrying the keepsake.
- No new verb exports on `./simulation` yet; they land with the first
  consumer (the planner's live row in D).

## C5b contract changes

What Draft and the run import adapt to, slice by slice.

C5b-1, Well and Pool rolls on their objects (schema 103 shape):

- `rerollStygianWell` and `rerollPurgingPool` rows are `{ kind, rerollId }`
  only. Read a reroll's pins with `stygianWellRerollPins(well, rerollId)` or
  `purgingPoolRerollPins(pool, rerollId)` (persisted as
  `stygianWell.rerollOfferKeyBySlot` and `purgingPool.rerollTraitKeyBySlot`);
  the existing `stygianWellGenerationItemKey` and `purgingPoolRollTraitKey`
  are unchanged.
- Fateful Twist results are `stygianWell.twistResultKeyByGeneration`, keyed
  by generation (`initial:<slot>`, `<rerollId>:<slot>`, `travelDealRefill`);
  read them with `stygianWellGenerationTwistResultKey`.
- `stygianWell.purchasedGenerationKeys` is gone: a generation is bought when
  the room's order holds its `purchaseStygianWellOffer`; read them with
  `stygianWellPurchasedGenerationKeys(order)`. Run import
  `commerce.ts` (the restock slot search) is re-pointed; its tests
  `import-rerolls`, `import-synthetic-erebus` and `import-underworld-capture`
  have their literals adapted but were compiled, not run.
- Removing a Well or Pool reroll row removes its pins and Twist results.
- A live Well or Pool reroll verb now carries the `reference` of the row its
  command creates.

C5b-2, locked-door fight on the door:

- `UnlockExitRoomAction` is thin (`kind`, `exitKey`); the fight's decisions
  live in `encounters.customizationByLockedExit[exitKey]`.
  `ReplaceUnlockExitCustomization {action}` is replaced by
  `ReplaceLockedExitCustomization {occurrence, exitKey, decisionKey, value}`,
  accepted for any locked door, pressed or not.
- `ReplaceLockedExit locked:false` drops that door's fight; removing the press
  keeps it.
- The live `lockedDoors.unlocks[].encounter` and
  `unlockExitEncounterSupportForProjectEvaluationAssembly` now also answer for
  an unpressed locked door, prepared where its press would append.
- Run import (`locked-doors.ts`): no change; it locks and presses doors and
  never authors the fight, so an imported fight stays native. A later fight
  import authors it with `ReplaceLockedExitCustomization`, before or after the
  press.

C5b-3, Shrine rush as its own row (schema 103 shape):

- `purchaseHermesShrineOffer` loses `rushed`; a rush is a
  `rushHermesShrineOffer { generationKey }` row after its purchase
  (authoring-only dependency, post-outgoing window), and a same-room pickup
  follows the rush. `SetHermesShrinePurchaseRush` is replaced by
  `SetHermesShrineRush { occurrence, generationKey, rushed, index? }`
  (directly after the purchase); `PurchaseHermesShrineOffer` loses
  `rushed` and only buys. The Shrine object interaction lists `offers` (Buy)
  and `rushes` (Rush); the live product
  offers `rush` on a bought, unrushed item. Gold prices the order on the
  purchase row and the rush on the rush row. The rush settles with its
  purchase, so the walk and the wire are unchanged.
- Until C5d the rush row stays directly after its purchase (an immediate
  `afterAction` dependency): `SetHermesShrineRush` accepts no other index,
  the live verb and the Shrine interaction offer only that gap (its command
  carries no index), a moved purchase carries its rush, and insertions or
  moves that would part the pair are refused. C5d revisits this when the
  rush becomes its own triggered consequence. Import: `commerce.ts`
  rushes with the new command; `action-order.ts` reads the rush row.

C5b-4, Sea Star proc as an observation (no schema change):

- A procced `ReplaceSeaStarResult` only adds the duplicate's site; its pickup
  lies live for the owner (or Collect all required) to place, and clearing the
  proc still removes a placed pickup. Import: `features.ts`
  `placeSeaStarDuplicate` must place the duplicate's pickup itself (an
  `InsertRoomAction` right after its source) instead of moving a row the
  command no longer appends. Today (`features.ts`, the `duplicateIndex < 0`
  branch) it returns true without placing anything, so an imported proc
  leaves its duplicate live; fix it in the consumer pass.

C5b wave B, item content on rows (schema 103 shape):

- Pickup, purchase and sale references carry an optional `content` (outside
  the row key and the wire): build them from the roster or the live product,
  which carry it, or leave it absent and let the command stamp it once the
  item is observed; `InsertRoomAction` refuses a reference whose content its
  item does not hold. `withItemContent` (engine test support) builds an
  expected reference.
- A value-to-value rewrite of an item (another reward at the same role, a
  door, cage or wheel press, another Shop option, Well or Pool pin, Shrine
  stock or wheel pick) removes its rows in settlement; the new item lies live
  to be placed again. Run import's iterative rewrites (first draws after
  rerolls, Artificer replacements) that change a placed item's value must
  re-place the row from the live product; unknown-to-value is a refinement and
  keeps it.
- A row on a replaced item that an edit does not settle (an unsettled
  `applyProjectCommand`, a hand-edited file) stays ranked as an
  item-replaced row: not executed, `roomActionItemReplaced` at the walk.
  Builders that swap a reward after placing its pickup must swap first or
  settle.

Wave A review follow-ups:

- A Well or Pool reroll never takes an id the room's rows still name (a
  removed reroll's purchase, sale, Twist result or pins), so a new reroll
  cannot adopt an orphaned purchase; the live verb's `reference` and index
  come from the authored order, as the command's do. Door, cage, wheel and
  Hub reroll ids are named only by their own rows, so their allocation is
  unchanged.
- An edit that changes an item's source discards its same-room derived items
  with their pickups in the same Undo step: a Sea Star duplicate when its
  source is no longer produced or its offer changes, an Artificer replacement
  also when the edit takes its source off the Artificer (no longer kept
  dormant; the 102 → 103 upgrade drops dormant ones once), and a
  Nemesis result with its chain when the event's kind or contest result
  changes. Consumers that swap a source and re-proc must re-author the
  duplicate after the swap.
- The plan's Shrine `rushed` and the Well's bought generations read the rows
  the walk performs (ranked, non-stale), the walk's own input.
- Run import test literal: `packages/run-import/test/import-surface-capture.test.ts`
  still expects `{ kind: 'purchaseHermesShrineOffer', …, rushed: true }`; it
  must expect the purchase followed by its `rushHermesShrineOffer` row.

## Inventory (summary of existence-vs-interaction)

Item identity today is (reward owner address, acquisition role); every
outcome map is keyed by role. The pickup verb (normal, Time Piece,
Artificer) is the item's `dispositionByAcquisitionRole`, not a row kind.

| Kind                                                                                               | Verbs                         | Outcome lives on                                                   |
| -------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------ |
| Boss forced drop, room, cage, optional, wheel reward                                               | pick up, goldify, transform   | the reward state, by role                                          |
| Generated entries (delivery, clocked drop, Echo, Artificer, Sea Star, Nemesis, Eris, switch claim) | pick up (+ conversions)       | the acquisition site entry; existence needs the source row settled |
| NPC contact, Gorgon, Eris                                                                          | talk to                       | the phase (Nemesis, Gorgon, bet) or the occurrence                 |
| Fields cage                                                                                        | unlock (starts its fight)     | none                                                               |
| Ship wheel                                                                                         | choose, reroll                | `pickedOfferIndex` on the wheel, no row                            |
| Fountain, keepsake rack                                                                            | use                           | the occurrence (Phial target, rack keepsake)                       |
| Challenge switch, locked door                                                                      | press, unlock (start a fight) | observation; door customization on the door                        |
| World Shop, Shrine, Well, Pedestal                                                                 | buy, rush, take               | the stock slot; membership = bought                                |
| Pool                                                                                               | sell, reroll                  | sale presence; the rolled list on the row                          |
| Door, cage, wheel reroll                                                                           | reroll                        | the reward on the row, mirrored into the target                    |

Mixing hot spots, where a row is the item's existence or holds its outcome:

- Commerce membership: Shop, Pedestal, Pool sale exist as contributions only
  with their row; the Well keeps a second membership list
  (`purchasedGenerationKeys`).
- Reroll rows (`reroll`, Well, Pool) are the new roll's existence and carry
  its result; door rerolls duplicate it into the target.
- Generated pickups exist only once their source row settles; Sea Star's
  proc is an observation stored as a row.
- Row-owned outcomes: reroll rewards, Well and Pool restocks,
  `unlockExit.customization`, Shrine `rushed`, a delivery's
  `encounterPhaseKey`.
- The incoming reward row key embeds the role; that alone made the W8 rekey
  necessary (deleted in C2).

## Lifecycle triggers (summary of lifecycle-triggers)

Owner corrections, binding:

1. A required delivery is always placed before Doors open. In a non-final
   Ship phase it sits after Wheels open but before the wheels are
   interactable; no after-doors fix is needed (confirmed in six cases).
2. Encounter depth matters for depth-gated room eligibility (read at Doors
   open) and the budget baked at entry. Begin-vs-gate increment timing
   matters only for rolls inside the room between an encounter's begin and
   its gate (Ship next-wheel rolls, per-encounter budgets). C5d audits
   `BiomeEncounterDepth` readers against those cases; the Q1 audit found no
   observable difference today.

| Event                           | Game trigger                                                                | Engine today                   | Fit                            |
| ------------------------------- | --------------------------------------------------------------------------- | ------------------------------ | ------------------------------ |
| Room prepared, entered          | previous door use                                                           | profile ops                    | clean                          |
| Encounter begun (depth++)       | automatic, or an interaction (cage, switch, locked door)                    | folded into encounter started  | fused                          |
| Combat starts                   | automatic, or a gate: Opening reward, Devotion choice, wheel use, intro end | point + windows, C1/C4 patches | slot + patches                 |
| Encounter outcome               | observation (Aetos, Gorgon, Nemesis, Anomaly)                               | outcome point                  | clean                          |
| Encounter end / end effects     | event list returns; Ship waits for required objects                         | point, Ship deferral           | slot + 1 exception             |
| Reward spawn                    | event-list step; Opening first; cages at entry                              | spawn moments                  | clean                          |
| Wheels open                     | next encounter's first event                                                | point (not the first wheel)    | asymmetry                      |
| Doors open                      | readiness predicate: last required removal or encounter end                 | fixed point + required-first   | derivable                      |
| Delivery arrival                | end effects tier B; Preboss flush at entry                                  | windows per room shape         | clean concept, patched windows |
| Switch press, locked door press | interaction starts a fight                                                  | rows                           | target shape already           |
| Leave                           | door use                                                                    | commit, exit                   | clean                          |

Target shape (C5d): items with verbs; each verb has an enabler and
consequences; events have declared triggers (a verb, an event, a predicate
becoming true, an observation). The windows, C1 and C4 patches, the Ship
deferral and Doors open as a slot collapse into "deadline = the first event
that needs the item". Nemesis event boundaries, observations, and
topology stay outside that shape.
