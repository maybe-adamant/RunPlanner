# Fountain and Postboss Lifecycle Implementation

## Status

Locked delivery plan based on clean commit
`9945192d3f4e60160489609b95ffcf87b3a60af8`. A fresh read-only adversarial
review completed, followed by a main-session overengineering pass requested by
the user. That pass removed the proposed participation/exit-blocking split and
required-object lifecycle specialization. The plan now extends the existing
Room Action machinery only: fountain is a structural required participant on
an active Postboss transition; an authored keepsake replacement atomically owns
one optional rack participant; and Retain means that rack interaction is
absent.

This is a temporary implementation plan. It is intentionally not linked from
the README or from stable design authorities. Gate B must absorb the completed
model into the durable documentation and delete this file.

Owning evidence and stable authorities:

- [`FOUNTAIN_AND_POSTBOSS_INTERACTION_LIFECYCLE.md`](../audits/FOUNTAIN_AND_POSTBOSS_INTERACTION_LIFECYCLE.md)
- [`KEEPSAKE_GAME_DATA_AUDIT.md`](../audits/KEEPSAKE_GAME_DATA_AUDIT.md)
- [`ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md`](../audits/ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md)
- [`AUTHORED_PROJECT_MODEL.md`](../design/AUTHORED_PROJECT_MODEL.md)
- [`ROOM_LIFECYCLE_MODEL.md`](../design/ROOM_LIFECYCLE_MODEL.md)
- [`REWARD_MODEL.md`](../design/REWARD_MODEL.md)
- [`SIMULATION_AND_VALIDATION.md`](../design/SIMULATION_AND_VALIDATION.md)
- [`EDITOR_MODEL.md`](../design/EDITOR_MODEL.md)
- [`STRUCTURED_EDITOR_WORKSPACE.md`](../design/STRUCTURED_EDITOR_WORKSPACE.md)

## Objective

Make fountain use a real required chronological interaction wherever the
planner models a one-visit physical fountain, and replace the fixed Postboss
keepsake effect with an authored local chronology.

The completed player-facing timelines are:

```text
Ordinary Reprieve

Room entered
  Interact with Reward pickup
  Use fountain
Cleanup · Doors open
```

The two required Reprieve actions can be arranged in either order. Cleanup
follows whichever required action is last.

```text
Reached nonfinal Postboss

Room entered
  Use fountain                         required
  Choose keepsake                      optional, if replacing
Cleanup · Doors open
  Choose keepsake                      may instead be ordered here
```

The rack interaction may occur before or after the required fountain. The
selected keepsake and its existing immediate equip result stay attached to
that exact action. Boss/Judgment presentation remains derived and fixed.

This slice establishes the truthful Cleanup frontier that future Wells of
Charon and Shrines of Hermes will consume. It does **not** implement either
feature.

The implementation budget is deliberately narrow. It may add the two action
reference variants, one Postboss action-order field, one completion action
address variant, and exact fountain/rack action events. Everything else must
extend the existing Room Action domain, scheduler, roster, timeline, command,
lifecycle, projection, and React rendering paths. A completion-owner adapter is
not a new policy owner. No generic feature framework or parallel
completion-action infrastructure is permitted.

## Source Facts and Planner Boundaries

### Ordinary Reprieve

The modeled F, G, I, O, and P Reprieve declarations have two parallel required
objects at entry: their fountain and their spawned incoming reward. The game
does not order those objects relative to one another. Exits become usable only
after both resolve.

The planner must therefore persist both action references in the occurrence's
sole `roomActions.order`. Neither action is removable while active. Existing
Room Action move, proposal, timeline, history, finding, and Undo machinery owns
their relative order.

The modeled H Bridge is the Echo Story realization and has no fountain. A
broad H activation hook is not permission to infer one. The persistent N Hub
fountain is also excluded because its required state spans visits and depends
on the sixth Soul Pylon.

### Nonfinal Postboss

Every realized Postboss transition before another configured biome has a
required fountain. This follows the structural completion role and route
adjacency, not biome identity, room game name, or declaration metadata. It
therefore remains true when a future route such as a Dream Dive reorders biomes
or overrides the concrete Postboss room. The rack remains an independent biome
capability and may be used on either side of the fountain. The last configured
biome has no succeeding-biome Postboss interaction frontier.

Activation must use route structure:

```ts
biomeIndex + 1 < route.biomes.length;
```

The engine must consume the existing `hasConfiguredSuccessor` fact or its
equivalent route-derived input. No implementation may branch on literal `I`,
`Q`, or room-name lists to decide whether the Postboss chronology is active.

### Cleanup

`Cleanup · Doors open` begins after every required object has resolved and the
continuation is usable. Optional actions whose source permits either side of
that barrier may be ordered before or after it. Future realized Wells and
Shrines will be Cleanup-only interactions because the game unlocks them with
the exits, but this plan adds no Well/Shrine action, declaration field,
command, candidate, finding, fixture, or UI.

## Locked Cross-Cutting Decisions

### 1. The realized Postboss transition owns fountain presence

Do not add a declaration flag, second required-object system, or general
room-feature framework. The existing authored Fountain template remains the
authority for ordinary Reprieves. A derived completion room receives the
fountain action from two structural facts already owned by simulation: its
descriptor role is `postboss`, and its biome has a configured successor.

Concrete room identity and biome order are deliberately irrelevant. This keeps
future Dream Dive room overrides and reordered biome sequences on the same
rule without copying fountain metadata into every possible replacement room.
Do not infer a fountain on the modeled H Echo Bridge or persistent N Hub,
because neither is the active Postboss completion transition.

### 2. Schema 49 adds one Postboss chronology

Advance the strict authored contract from schema 48 to schema 49. Extend the
existing biome-owned Postboss state rather than creating a synthetic
`RoomOccurrence`:

```ts
interface AuthoredBiomePlan {
  // existing fields
  readonly postbossKeepsakeDisposition?: PostbossKeepsakeDisposition;
  readonly postbossRoomActions?: RoomActionState;
  readonly keepsakeEquipResults?: AuthoredKeepsakeEquipResults;
}
```

`postbossRoomActions` is required when the layout owns a Postboss completion
descriptor. Its default contains `useFountain`; simulation activates that
chronology only when the route has a configured successor. The existing Room
Action domain contributes `interactKeepsakeRack` independently from the biome's
rack capability plus an active replacement.

The field remains persisted but dormant while that biome is the configured
route tail. `postbossKeepsakeDisposition` remains required only by rack
capability. A future overridden Postboss therefore keeps its structural
fountain chronology without gaining a rack or room-specific fountain flag.

The state uses the same `RoomActionState` and `RoomActionReference` contracts as
ordinary occurrences. There is no second order type, boolean
`fountainBeforeRack`, fixed-effect rank, or synthetic completion occurrence.

The codec stays strict and rejects schema 48. There is no production
compatibility decoder, load-time repair, or dual-field period.

### 3. The shared action vocabulary gains two exact references

Extend the closed `RoomActionReference` union with:

```ts
{ readonly kind: 'useFountain' }
{ readonly kind: 'interactKeepsakeRack' }
```

`useFountain` uses the existing `participation: 'required'`. The existing
roster therefore defaults it, prevents active removal, reports a missing row,
and places Cleanup after it without a new blocking concept.

`interactKeepsakeRack` uses the existing `participation: 'optional'`. Retain
means the action is absent. Replace means the action and replacement payload
are authored atomically by `ReplacePostbossKeepsake`; the strict Postboss codec
requires that relationship, so normal state cannot contain a replacement
without its rack row or a rack row while retaining. Because the ranked rack is
optional, the existing roster already permits it before or after the last
required fountain and therefore before or after Cleanup.

Do not add `exitBlocking`, a second participation enum, a selected-action
obligation layer, or special missing-rack repair semantics. Fountain uses the
required path that already exists. Rack uses the optional path that already
exists, with its membership synchronized by the selection command.

Both references pass through the same collision-safe key function, structural
action-domain product, roster assembly, ordering assessment, proposal system,
timeline placement, lifecycle execution, and application action presentation
as existing Room Actions. Do not create a completion-only scheduler, timeline
ranker, or lifecycle executor.

### 4. Completion actions have a truthful semantic owner

Keep the current occurrence action address intact and add a sibling exact
completion action address:

```ts
interface CompletionRoomActionAddress {
  readonly kind: 'completionRoomAction';
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly completion: CompletionRoomAddress & { readonly role: 'postboss' };
  readonly actionKey: string;
}

type RoomActionSemanticAddress = RoomActionAddress | CompletionRoomActionAddress;
```

The shared engine/application roster products consume the union. Postboss
markers, findings, focus, and history use the completion address; they must not
borrow a preceding Boss/Preboss occurrence ID or invent a hidden occurrence.

The existing `InsertRoomAction`, `RemoveRoomAction`, and `MoveRoomAction`
commands accept the semantic-address union and dispatch to the exact owner.
Internal handlers may remain owner-specific, but their supported command and
roster policy is shared.

### 5. Required fountain defaults and repair semantics remain canonical

Newly created ordinary Reprieve occurrences seed `useFountain` through the
existing required-action reconciliation. It shares the full pre-Cleanup window
with the required incoming reward. The engine's contribution order is the
stable default tie-break, so the canonical new-room order is:

```text
incoming reward -> fountain
```

Both orders remain legal after a user move. Existing ranked relative order is
never normalized by an unrelated command.

Every structural Postboss state defaults to:

```ts
{
  order: [{ kind: 'useFountain' }];
}
```

The required fountain cannot be removed while its owner is active. A decoded
structurally valid omission remains visible as one canonical Restore repair;
the decoder does not silently insert it. Dormant final-biome state does not
block evaluation and publishes no active action interaction.

### 6. Keepsake selection owns optional rack membership atomically

Keep `postbossKeepsakeDisposition` as the existing selection/payload owner and
`keepsakeEquipResults` as its existing immediate-result child. Do not move the
payload into `RoomActionReference`.

`ReplacePostbossKeepsake` owns rack participation:

- `retain -> replace` validates the keepsake, records the replacement, and
  inserts `interactKeepsakeRack` at the latest legal position if missing;
- `replace -> replace` changes only the selected keepsake and preserves the
  rack's existing rank;
- `replace -> retain` removes the active rack row while retaining any
  keepsake-specific equip-result detail dormantly, following the existing
  switch-away/switch-back contract; and
- each transition is one semantic command and one Undo entry.

For a newly selected replacement, the latest legal default is after the
fountain, inside Cleanup. The user may move it before the fountain.

A `replace` value with a missing rack row is structurally malformed under
schema 49: the codec requires rack membership exactly when the disposition is
`replace`. Generic Insert/Remove commands reject
`interactKeepsakeRack`; the specialized keepsake command is the only normal
membership owner. Clearing it uses `ReplacePostbossKeepsake(...retain)`, so
payload and participation cannot diverge and no second repair interaction is
needed.

### 7. Existing lifecycle schedules host the new actions

Do not add fountain-specific lifecycle profiles, required-object spawn or
completion operations, or a second action executor. Ordinary Reprieve keeps
its current Fountain/standard lifecycle. Postboss keeps the existing
`PostBossRoom` lifecycle.

The existing Room Action scheduling seam inserts `useFountain` and the optional
rack interaction into those lifecycles. Required participation already makes
fountain the barrier before Cleanup. Executing the ranked fountain row emits
one exact `fountainUsed` history event; no separate required-object event or
ledger is introduced in this slice.

For Postboss, the existing automatic noncombat Start/End sequence remains
after `roomEntered` and before the first ranked player action. Completion
materialization publishes and executes the Postboss action roster only when
`hasConfiguredSuccessor` activates that room. A dormant configured tail keeps
its persisted state but emits no action event or blocker. This is the existing
dynamic completion boundary, not a new lifecycle-profile switch.

### 8. Schema migration preserves prior authored meaning

The schema-local fixture migration maps schema 48 to 49 as follows:

- every biome with a Postboss descriptor receives `postbossRoomActions`;
- every new Postboss order receives `[useFountain]`;
- an existing `replace` receives `[interactKeepsakeRack, useFountain]`, because
  schema 48 always applied replacement before the newly modeled fountain;
- every existing ordinary Reprieve occurrence receives a missing
  `useFountain` at the production scheduler's canonical late position; and
- existing unrelated Room Action order, topology, payload, dormant state, and
  fixture intent remain unchanged.

Use a checked per-checkpoint intent ledger rather than asking schema-48 raw data
to call schema-49 semantic code:

1. parse each schema-48 checkpoint as `unknown`;
2. mechanically set schema 49 and add the closed `postbossRoomActions` shape
   to every Postboss-owning biome (`[fountain]`, or `[rack, fountain]` when the
   old disposition was `replace`);
3. strict-decode that structurally complete but potentially chronology-incomplete
   schema-49 document;
4. invoke the production action domain/scheduler on the decoded exact Reprieve
   owners to add only their missing required fountain rows;
5. assert against a small ledger of each checkpoint's intended added owners,
   rows, and relative order; and
6. canonical-encode, refresh manifest hashes, run integrity, and delete the
   transformer and ledger in the same gate.

This tooling is never a production migration API. It may not copy required
classification or placement policy into raw JSON manipulation.

All named readable checkpoint JSON files and the manifest remain committed
artifacts. Do not reconstruct their routes with command-heavy builders.

### 9. Fountain and rack placement changes real history

Add exact lifecycle events for the two interactions:

```ts
{ readonly kind: 'fountainUsed'; readonly owner: RoomActionSemanticAddress }
{ readonly kind: 'keepsakeRackUsed'; readonly owner: CompletionRoomActionAddress }
```

The precise names may follow the existing lifecycle vocabulary, but they must
remain distinct exact events owned by ranked actions.

Move Postboss replacement execution out of `roomCreated`. The replacement and
its immediate equip result apply only when the ranked rack action executes.
Consequently:

- `[rack, fountain]` makes the fountain observe the replacement;
- `[fountain, rack]` makes the fountain observe the Boss keepsake; and
- the history prefix after each action differs truthfully.

Retention crosses the Postboss selection frontier without fabricating a rack
interaction. A final configured biome never executes dormant Postboss actions.

The completion history runs the declaration's automatic noncombat Start/End
sequence immediately after `roomEntered` and before the first ranked player
action; the player-facing timeline omits those noncombat boundaries. The
carried Boss keepsake observes that entry sequence. Equipping Experimental
Hammer at the later rack action does not retroactively consume a use at room
entry. This needs an exact regression and must not redefine the shared
`roomEntered` event or its Run State checkpoint.

Fountain use is initially effect-neutral except for its required participation
and chronology meaning. Do not invent healing state, fountain damage, refill
effects, or an Aromatic Phial rarity target. The exact `fountainUsed` event and
history prefix are the future contact for those separate effects.

### 10. Completion materialization consumes the shared roster

Generalize the pure Room Action domain and roster input from occurrence-only to
one closed owner union. Completion materialization publishes the active
Postboss domain, action roster, timeline, proposals, repair rows, checkpoints,
and action history into the normal simulation product.

Boss completion remains the existing fixed lifecycle:

```text
Room entered -> Start encounter -> End encounter -> optional Judgment -> Cleanup
```

It gains no authored order. Postboss remains a derived completion room but now
uses the shared roster:

```text
Room entered -> ranked actions -> Cleanup after last required action
```

The completion history composer must execute the shared roster instead of
reconstructing a fixed keepsake effect. Missing required fountain blocks at
the exact completion action address. Do not add a second history fold or
parallel reward walker.

### 11. The application renders one Room Timeline language

Ordinary Fountain rooms need only the exhaustive `Use fountain` action label;
the existing occurrence workbench continues to own dragging, proposals,
disabled deletion, Cleanup placement, and Undo.

Postboss replaces its bespoke fixed-effect list with the engine-projected
action roster and timeline. Extract or reuse the standard Room Timeline row
renderer and proposal/drop behavior; do not copy it into a second completion
implementation.

The Postboss presentation must show:

- `Room entered`;
- required, move-only `Use fountain`;
- optional `Choose keepsake` only for an active replacement; it may move, but
  Retain through the keepsake selector is its sole removal path;
- the existing keepsake candidate selector and immediate equip-result editor
  attached to `Choose keepsake`;
- `Cleanup · Doors open` immediately after the fountain; and
- one inactive retain/replace control that can create the optional rack action
  atomically without adding a fake timeline row for retention.

Choosing retain removes the active action through the same semantic command.
Moving the rack or fountain dispatches one `MoveRoomAction` and creates one
Undo step. React does not infer whether a fountain exists, whether the biome is
final, where Cleanup lands, or whether a move is legal.

Completion action markers and keepsake/equip-result findings route to the
Postboss completion inspector. Boss/Judgment presentation is unchanged.

### 12. Incomplete state remains visible and repairable

Schema 49 remains strict about shape, catalog membership, duplicate action
keys, closed reference tags, and `postbossRoomActions` appearing only on a
biome whose Postboss has at least one completion-action capability. It does not
normalize semantically incomplete chronology during decode.

Known occurrence action references that no longer match the occurrence's
current room still decode and project as stale removable repairs. Replacing a
Fountain occurrence must not make its retained `useFountain` row codec-invalid.
Completion orders remain closed to the two completion-supported references,
and the codec requires rack membership to agree with replace/retain. That
atomic relation is schema structure, not a second repairable participation
state.

The engine must retain and project:

- missing active required fountain as an unranked required repair;
- dormant Postboss state on the current configured route tail; and
- a retained invalid keepsake replacement with its exact candidate/finding.

Normal commands restore or clear these states atomically. The application must
not hide, auto-dispatch, or repair them during projection/render.

## Explicit Non-Goals

This delivery does not add or change:

- Wells of Charon, Shrines of Hermes, purge shops, sell-trait shops, natural
  resources, inspection points, or their profile requirements;
- persistent N Hub fountain use, sixth-pylon activation, or restoration;
- a fountain on the modeled H Echo Bridge;
- I/Q or any literal-biome final-route switch;
- healing amounts, health state, fountain damage, fountain refresh, or
  Aromatic Phial's random rarity target;
- an authored rack-open-without-replacement event;
- a new required-object lifecycle, fountain lifecycle profile, action
  participation dimension, or exit-blocking field;
- Boss or Judgment action ordering;
- Postboss as a synthetic occurrence or ordinary exit decision;
- a generic feature/action framework for future room contacts;
- a compatibility decoder or production schema migration; or
- broad fixture reconstruction or unrelated test consolidation.

The plan may document that future Well/Shrine actions belong after Cleanup. It
must not add dormant placeholder fields, empty arrays, enum variants, commands,
UI cards, or tests for those future features.

## Delivery Gates

### Gate A — schema 49 vertical product

Deliver one complete catalog -> authored project -> simulation -> application
-> React slice. This is one commit because splitting the schema, completion
roster, or action execution from its consumer would leave a parallel fixed
effect or an unusable persisted contract.

Gate A owns:

1. structural Postboss fountain participation while ordinary Reprieve
   continues using its existing Fountain template;
2. schema-49 `postbossRoomActions`, strict codec/defaults, semantic addresses,
   commands, and temporary fixture migration;
3. extension of the existing occurrence/completion Room Action domain, roster,
   scheduler, proposals, timeline, repair, and exact action events;
4. Postboss materialization, history, reward/keepsake execution, candidates,
   findings, and dynamic successor activation;
5. ordinary Reprieve and Postboss application projection, interaction binding,
   navigation, shared Room Timeline rendering, and Undo workflows;
6. named checkpoint updates or one focused reached-Reprieve checkpoint if no
   existing saved state owns that contact; and
7. deletion of the fixed Postboss keepsake timeline/execution path and the
   temporary schema transformer.

Gate A explicitly excludes all non-goals above. It ends frozen and unstaged for
a fresh independent adversarial review before the main session performs the
holistic diff review and commit.

### Gate B — durable absorption and phase closure

After Gate A is committed, update only the smallest owning durable documents:

- `AUTHORED_PROJECT_MODEL.md` for schema 49 and completion chronology;
- `ROOM_LIFECYCLE_MODEL.md` for exact fountain/rack events and Postboss
  Cleanup;
- `REWARD_MODEL.md` and `SIMULATION_AND_VALIDATION.md` for ranked replacement
  execution;
- `EDITOR_MODEL.md` and `STRUCTURED_EDITOR_WORKSPACE.md` for the shared
  Postboss Room Timeline;
- the planner disposition in `KEEPSAKE_GAME_DATA_AUDIT.md`;
- `ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md` for the completion owner;
- `IMPLEMENTATION_PROGRESS.md` with exact validation; and
- the README's current schema number if needed.

Preserve the source facts in the fountain audit. Delete this temporary plan in
the same docs-only commit. Run the complete repository gate exactly once after
Gate A review fixes and documentation are stable; record its truthful result.

## Primary Ownership and Expected Files

### Authored project and commands

- `packages/planner-engine/src/authored-project/model.ts`
- `packages/planner-engine/src/authored-project/addresses.ts`
- `packages/planner-engine/src/authored-project/codec.ts`
- `packages/planner-engine/src/authored-project/defaults.ts`
- `packages/planner-engine/src/authored-project/room-actions.ts`
- `packages/planner-engine/src/authored-project/room-action-domain.ts`
- `packages/planner-engine/src/authored-project/room-action-defaults.ts`
- `packages/planner-engine/src/authored-project/commands/room-actions.ts`
- `packages/planner-engine/src/authored-project/commands/keepsake.ts`
- command types/dispatch/index exports in the same neighborhood

### Simulation

- `packages/planner-engine/src/simulation/room-actions/assemble.ts`
- `packages/planner-engine/src/simulation/room-actions/timeline.ts`
- lifecycle model/execution and history input/fold modules
- completion materialization model/assembler
- progressive biome and reward-walk Postboss execution
- candidate/finding publication only where exact event timing changes their
  current owner

### Application and React

- structured-workspace contract, source, biome/occurrence assembly,
  interaction requirement/binding, marker, and inspector-destination modules
- `OccurrenceWorkbench.tsx` or a narrowly extracted shared Room Timeline
  renderer
- `BiomeWorkspace.tsx` Postboss completion workbench
- existing styles only where shared rendering requires them
- Redux/history requires representative witnesses, not new semantic logic

### Test fixtures

- schema/version tests and the fixture checkpoint manifest
- the 14 current named readable schema-48 JSON checkpoints migrated to 49
- one additional named reached-Reprieve checkpoint only if behavioral coverage
  cannot reuse an existing checkpoint cheaply
- temporary transformer deleted before Gate A review

The inventory is a routing guide, not authorization for unrelated cleanup.
Executors must inspect live consumers and change only files required by the
closed product.

## Acceptance Matrix

Gate A is not complete until the following behaviors have owning witnesses.

1. F/G/I/O/P Reprieves remain on the existing Fountain template. Every
   structural Postboss chronology defaults a fountain, but only a Postboss with
   a configured successor activates it; concrete room overrides, H Echo Bridge,
   and persistent N Hub do not change that rule.
2. Strict schema 49 requires `postbossRoomActions` on exact capable biomes,
   rejects schema 48, duplicate/unknown action references, and completion state
   on owners with no completion-action capability, while preserving
   structurally valid incomplete and occurrence-stale orders.
3. New Reprieve occurrences atomically default both required reward pickup and
   fountain; one command/Undo that creates or replaces the occurrence owns the
   complete required delta.
4. Reprieve `[reward, fountain]` and `[fountain, reward]` both execute; Cleanup
   follows the last required row and neither required row is removable.
5. H Echo Bridge and N Hub gain no fountain action, default, finding, repair,
   event, or UI row.
6. A capable nonfinal Postboss activates required fountain chronology; the
   same authored state is dormant on the configured last biome and reactivates
   when a successor is configured, without I/Q literal branching.
7. Fresh Postboss retain defaults to `[fountain]`; selecting a replacement
   atomically adds rack after fountain; changing replacement preserves rank;
   returning to retain removes the rack, retains equip-result detail dormantly,
   and is one Undo step.
8. Migrated schema-48 replacement preserves historical fixed-first meaning as
   `[rack, fountain]`; migrated retain becomes `[fountain]`; unrelated order
   and payload bytes re-encode canonically, and the per-checkpoint ledger
   attests every added owner and relative order.
9. `[rack, fountain]` applies replacement/equip effects before `fountainUsed`;
   `[fountain, rack]` applies them afterward. Replacement no longer executes at
   `roomCreated`.
10. Postboss Room entered completes its automatic noncombat entry sequence
    before either player action. Equipping Experimental Hammer at the rack does
    not retroactively spend a Postboss entry use.
11. Missing active fountain blocks at its exact action owner and exposes one
    canonical Restore. Codec and commands maintain the exact
    `replace <-> rack row` relation, while a context-invalid replacement remains
    authored and repairable without React inference.
12. Ordinary Fountain UI shows reward and `Use fountain` as compact move-only
    rows before Cleanup, supports both orders, and records a move as one
    semantic history step.
13. Postboss UI shows the shared Room Timeline language with exact required
    fountain, optional `Choose keepsake`, candidate/equip child, Cleanup seam,
    proposal controls, and one-step move/selection Undo; Retain is the sole
    rack-removal path, and there are no encounter boundaries or fixed-effect
    duplicates.
14. Completion action, keepsake selection, equip result, and repair findings
    route to the exact Postboss inspector and action row.
15. Boss/Judgment behavior and presentation remain unchanged.
16. The existing Reprieve and Postboss lifecycle profiles execute the ranked
    action after automatic noncombat entry. No new required-object operation,
    profile family, Cleanup/commit shortcut, dormant final state, H Echo
    Bridge, or N Hub emits `fountainUsed`.
17. No production or test symbol introduces a Well/Shrine action, placeholder,
    command, picker, or persisted state; only future Cleanup wording is added
    to durable documentation in Gate B.
18. All checkpoint files decode/freeze, canonical re-encoding and manifest
    hashes match, and fixture changed-graph coverage remains static and
    discoverable.

## Primary Tests

### Catalog and authored commands

- project defaults own structural Postboss chronology across concrete room
  overrides and reordered route positions;
- `authored-project/commands/room-actions.test.ts` owns required fountain
  defaulting, both orders, removal rejection, canonical restore, and H/N
  negatives;
- keepsake-selection command tests own rack atomicity, rank preservation,
  retain removal, codec membership equality, and Undo;
- codec/default tests own schema-49 exactness and dormant final state.

### Simulation

- `simulation/room-action-timeline.test.ts` owns both Reprieve orders, both
  Postboss orders, and Cleanup placement;
- `simulation/lifecycle.test.ts` owns exact fountain/rack event order and
  missing-required blocking;
- keepsake candidate/history tests own action-time replacement and immediate
  result timing;
- representative F and N history tests contact one Underworld and one Surface
  path without duplicating the matrix;
- progressive evaluation owns dynamic configured-successor dormancy/reactivation;
- existing Boss/Judgment tests remain the regression owner.

### Application

- occurrence assembly and `OccurrenceWorkbench` own ordinary Fountain label,
  ordering, disabled removal, and one-step Undo;
- biome semantic assembly and interaction binding own completion roster,
  exact move command, candidate/equip child, and final-biome absence;
- `BiomeWorkspace` owns both Postboss visual orders, Cleanup barrier, retained
  replacement repair, and absence of combat seams;
- structured-workspace contract/navigation tests own exact completion action
  and child destinations; and
- one product-loop witness owns a complete Postboss replace/move/Undo workflow.

Use a named saved checkpoint for any expensive reached-room setup. Do not add a
second command-heavy route builder merely for these witnesses.

## Validation and Review

During Gate A implementation, use only the narrow truthful lanes for the files
being changed:

- catalog tests for declaration/compiler work;
- engine command/timeline/lifecycle/keepsake tests for engine work;
- focused planner/UI/contract/product files for application work;
- `npm run test:changed` where its graph covers the edited source; and
- workspace/fixture typecheck, changed-file lint/format, and diff-check at
  stable boundaries.

Before Gate A review, run the proportional owning lanes once:

- `npm run test:catalog`;
- `npm run test:engine`;
- `npm run test:planner`;
- `npm run test:contract`;
- `npm run test:product`;
- `npm run test:ui`;
- `npm run test:fixtures:check`;
- `npm run typecheck`;
- `npm run lint`;
- `npm run format:check`;
- `git diff --check`; and
- `npm run build`.

Do not repeatedly run full lanes after minor corrections. One fresh executor
implements Gate A; one fresh sibling reviewer remains read-only and reports
only evidence-backed P1/P2 findings. Accepted findings return to the executor
for one bounded remediation/verification pass. The main session then reviews
the whole diff for ownership, fixed-path deletion, schema cleanliness, fixture
intent, test duplication, and production growth before committing.

Gate B runs the complete `npm run check` exactly once after its documentation
is stable. Record any timeout separately from assertion behavior; do not alter
timeouts or worker configuration to manufacture a green result.

## Deletion and Closure Checklist

Gate A must delete or retire:

- Postboss `fixedEffect: 'keepsakeSelection'` timeline entries and contracts;
- the statement that derived Postboss completion never has authored ordering;
- fixed-first Postboss replacement execution at `roomCreated`;
- bespoke Postboss fixed-effect ranks/rendering and duplicated CSS that no
  longer has a consumer;
- fixed-first tests that do not represent schema-49 chronology;
- any temporary schema-48-to-49 checkpoint transformer; and
- any app inference of nonfinal fountain/rack presence displaced by the engine
  product.

Gate B must:

- reconcile every affected durable authority;
- preserve source evidence while replacing stale planner dispositions;
- update the schema number and exact validation record;
- verify all local Markdown links and formatting;
- remove every reference to this temporary plan; and
- delete this file in the closure commit.

No gate may stage, commit, push, or rewrite commits unless the main session has
explicitly authorized that exact Git operation.
