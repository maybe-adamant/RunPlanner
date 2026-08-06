# Natural Chaos Implementation Plan

## Status

**Implementation-ready.**

The post-Anomaly/Zagreus preflight is complete against schema 13 and the live
structured workspace. Natural Chaos remains absent from production state. The
first implementation gate deliberately corrects the ownership of the existing
Zagreus additional exit before adding a second family.

This is a temporary delivery document. Stable game facts remain in
`docs/audits/ROUTE_DETOUR_FINDINGS.md`. Completed authored, lifecycle,
simulation, editor, and biome contracts must be absorbed into their owning
design and biome documents before this plan is retired.

## Objective

Support authored **natural** Chaos gates in `N`, `F`, `G`, and `P` as real
additional exits emitted by a source Room Occurrence beside its normal exits.
A gate may be offered and skipped, or selected to enter a concrete Chaos room
and then resume the host biome through a fresh ordinary continuation.

Gate authorship, gate offer, branch selection, Chaos entry, and resumed target
generation are distinct facts. The selected source occurrence emits the door;
the outgoing decision owns only the choice among its normal lane and the
source's emitted additional exits.

## Scope

Included:

- occurrence-owned Zagreus and natural-Chaos additional-exit state;
- exact declaration-backed natural source capability;
- the preceding-ten-committed-room offer-spacing rule;
- concrete Chaos-map selection and defaults;
- fixed `Empty_Chaos` encounter and direct `TrialUpgrade` reward;
- normal-versus-Chaos branch selection;
- a fresh, ordinary, visible host-biome continuation after Chaos;
- source-room spawn actions, decision presentation, findings, persistence,
  recovery, and the complete product loop;
- focused N Opening/Hub and normal-door Preboss coexistence witnesses.

Excluded:

- Spark of Ixion and every forced-Chaos path;
- Stygian Well items, trait lifetime, zero-health-cost gates, and Chaos in `H`
  or another source enabled only by forced placement;
- chance or RNG replay;
- external save/profile progression inputs;
- Nyx narrative activation;
- detailed Chaos curse, blessing, or trait-payload simulation;
- a generic room-feature bag, generic special edge, or generic detour graph;
- game-runtime forcing, adapters, and conformance execution;
- a broad entry/first-decision inspector reorganization unless manual Chaos
  acceptance demonstrates a concrete remaining UX problem.

Natural eligibility must not inherit any bypass from the excluded Ixion path.
An eligible source without an authored gate remains valid and finding-free.

## Locked game and product baseline

The planner authors possible outcomes rather than replaying probability. It
assumes ordinary Chaos and Surface progression requirements have been met, but
retains the modeled current-route conditions below.

### Static source capability

The catalog must declare natural-Chaos capability only for concrete maps that
have the supported physical `SecretPoint` and pass the game's static natural
source restrictions:

| Host biome | Supported source declarations                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `N`        | `N_Opening01` only                                                                                               |
| `F`        | `F_Opening01`–`F_Opening03`, `F_Combat01`–`F_Combat22`, `F_Story01`, `F_Reprieve01`, and `F_Shop01`              |
| `G`        | `G_Intro`, `G_Combat01`–`G_Combat20`, `G_MiniBoss01`–`G_MiniBoss03`, `G_Story01`, `G_Reprieve01`, and `G_Shop01` |
| `P`        | `P_Intro`, `P_Combat01`–`P_Combat19`, `P_Reprieve01`, and `P_Shop01`                                             |

Room category, nonzero chance, or a UI label is not a substitute for this
declaration-backed fact. `N_PreHub01`, `H`, and all other Ixion-only or
unsupported sources declare no natural capability.

Static capability and contextual eligibility are separate:

- the command may create a gate only on a declaration with natural capability;
- P's natural depth-five ceiling and route offer spacing are evaluated against
  the current history;
- a structurally valid authored gate that becomes context-invalid remains
  visible and removable when its source is active;
- dormant features on unpicked rooms remain persisted without producing
  active lifecycle facts or findings until their room becomes active again.

### Host policy and Chaos targets

The normalized host-biome policy owns the progressed-save target domain and
default, while each Room Declaration owns whether its concrete map can emit
the door:

| Host topology    | Authored Chaos maps    | Default    |
| ---------------- | ---------------------- | ---------- |
| `N`              | `Chaos_03`, `Chaos_06` | `Chaos_03` |
| `F`, `G`, or `P` | `Chaos_01`–`Chaos_06`  | `Chaos_01` |

The catalog should expose this as a narrow natural-Chaos host descriptor on
the supported `BiomeLayout`, not as a global service or a duplicate topology
read model. The descriptor contains the target domain, default, and ten-room
offer window. A source declaration contains the physical natural-exit
capability and any source-local requirement such as P's depth ceiling.

Each Chaos room owns:

- room-set identity `Chaos` and authored template `Chaos`;
- one player-selected ordinary outgoing exit with visible reward preview;
- fixed encounter `Empty_Chaos`, with no picker or modeled Nyx behavior;
- fixed direct reward `TrialUpgrade`, presented as **Chaos Blessing**;
- one room-history ordinal and its declared biome-depth effect.

`BaseChaos.PauseBiomeState` remains deliberately collapsed because the planner
has no biome-state trait lifecycle input or consumer. The game reaches
`TrialUpgrade` through the one-entry `Secrets` store; the planner normalizes
that store to a direct fixed leaf rather than introducing a reusable `Secrets`
reward-store abstraction.

## Additional-exit ownership correction

### Persisted authored shape

Schema 14 moves additional-exit authorship from `ExitDecision` to the source
Room Occurrence:

```ts
type AuthoredAdditionalExit =
  | {
      kind: 'zagreusContract';
      key: 'zagreusContract';
      occurrenceId: OccurrenceId;
    }
  | {
      kind: 'naturalChaos';
      key: 'naturalChaos';
      occurrenceId: OccurrenceId;
    };

interface RoomOccurrence {
  occurrenceId: OccurrenceId;
  gameName: string;
  state: AuthoredRoomState;
  encounters: RoomEncounterState;
  additionalExits: readonly AuthoredAdditionalExit[];
}

interface ExitDecision {
  kind: 'exit';
  source: ExitDecisionSource;
  normal: NormalDoorBatch;
  selection: ExitSelection;
}
```

This is the final schema-14 shape. Gate A lands the occurrence-owned collection
with only the already-supported `zagreusContract` member; Gate B expands the
closed union in the same vertical slice that delivers real natural-Chaos
declarations and commands. No dormant Chaos type is introduced in Gate A.

`AdditionalExitAddress` addresses an occurrence directly with
`occurrenceId + additionalExitKey`. It cannot name a Hub decision or imply
that the outgoing decision owns the feature.

The top-level occurrence array remains the occurrence registry. A source
occurrence's authored additional exit is the unique structural owner of its
target occurrence. Codec closure follows that forward edge, rejects duplicate
ownership and cycles, and admits the exact closed target templates without
requiring the target to inspect a previous room.

### Active decision projection

Authored decisions do not persist a second list of emitted exits. Canonical
materialization reads the active source occurrence's `additionalExits` and
projects a typed union into `CanonicalBatch.additional`:

```ts
type CanonicalAdditionalContinuation =
  CanonicalZagreusContractContinuation | CanonicalNaturalChaosContinuation;
```

This canonical list remains the supported input to history, generation,
rewards, findings, and the application workspace. Those consumers do not read
the occurrence registry independently.

An add command may create the source's empty outgoing decision envelope when
none exists, as the current Zagreus command does. The envelope supplies the
selection owner; it does not own the emitted feature.

### Reanchor and dormancy

Changing an upstream picked normal target reanchors only the outgoing normal
decision:

- source A keeps every authored additional exit and its target occurrence;
- source B emits only B's authored additional exits;
- normal targets and descendants remain with the reanchored decision;
- no additional target or room-local state moves between A and B;
- an additional selection unavailable on B becomes `derived` when the
  resulting choice is one normal exit, otherwise `unresolved`;
- reselecting A makes its preserved feature and exact target state active
  again.

The current rejection that requires the new source to declare every retained
decision-owned additional exit is deleted with this migration. The ordinary
reanchor contract remains unchanged for normal targets and descendants.

### Invalid retained features

Codec validation establishes structural shape, ownership, and the closed
target template. It must not require the source's current Room Declaration to
still advertise the feature. Creation commands require declared capability;
evaluation owns later source-capability, source-requirement, target-domain,
spacing, and entry-cap findings.

This keeps a feature editable after a room replacement without teaching Redux,
React, or the target room to reconstruct its source relationship.

## Natural Chaos topology and commands

The closed command surface is:

- `AddNaturalChaos` — address the source occurrence, allocate the default
  Chaos occurrence, retain/create its outgoing decision envelope, and preserve
  the selected continuation (making a width-one derived normal selection
  explicit when the new sibling requires it);
- `RemoveNaturalChaos` — remove the feature target and its selected descendants,
  then normalize the enclosing selection;
- `ReplaceNaturalChaosMap` — replace only the owned Chaos occurrence's map
  within the host policy's exact target domain;
- existing `SetExitSelection` — select the normal lane or `naturalChaos`;
- migrated `AddZagreusContract` and `RemoveZagreusContract` — preserve their
  current product behavior while addressing occurrence-owned state.

Adding a gate preserves all normal targets and their offers. Selecting Chaos
retains the normal branch as unentered authored structure; selecting normal
retains Chaos as an offered but unentered branch. Removing Chaos deletes only
its occurrence and descendants. Undo/redo restore exact state.

Normal-door force pressure, capacity, repair, and Preboss takeover operate only
on the normal lane. They neither own nor erase occurrence-emitted additional
exits. Once Chaos is selected, the Chaos occurrence uses ordinary room,
encounter, reward, counter, history, and outgoing-generation processing.

## Offer-spacing and lifecycle contract

Natural Chaos uses an **offer-consumed** spacing rule. Eligibility requires no
natural-Chaos offering source among the preceding ten committed room
appearances.

The existing history contract already records the authoritative offer:

```text
roomCreated
  source = additionalExit
  additionalOrigin = source occurrence + naturalChaos key
  parentOrigin = offering source occurrence
```

No second production marker, shadow ledger, Redux flag, or rendered-topology
inference is added. The room-creation ledger records the offered Chaos target
even when it is skipped. Spacing cross-references those natural-Chaos creation
records with their parent origins in the preceding ten committed
`roomAppearances`.

The boundary fixture must prove:

- while the offering source remains among the preceding ten committed room
  appearances, another gate is invalid;
- after ten later rooms have committed and the offering source has left that
  window, the next otherwise-valid source is eligible;
- selecting or skipping the first gate gives the same spacing result;
- entering Chaos separately records its occurrence, encounter, reward,
  counters, and appearance exactly once.

Do not implement spacing as entered-Chaos history, a raw depth subtraction, or
a second independently maintained counter.

## Return contract

Chaos uses one ordinary outgoing door, not the automatic hidden continuation
used by Anomaly and `C_Boss01`.

The current detour-room query is generalized narrowly from “automatic detour
return” to a declaration-owned **host continuation** that preserves each
template's exit behavior:

- Anomaly and ContractBoss: width one, automatic, hidden preview;
- Chaos: width one, player-selected, visible preview.

This is not a generic route edge. It admits only the three closed authored
templates and still requires their exact structural owner.

Leaving selected Chaos:

- authors a fresh target in the containing host topology;
- applies ordinary host target eligibility, force, batch, reward-store, and
  reward-preview behavior at that checkpoint;
- never reuses the earlier unpicked normal target or its reward;
- presents the return through the ordinary width-one decision workbench.

### Preboss coexistence

A forced normal-door Preboss batch and a Chaos gate may coexist. Selecting
Chaos leaves the offered Preboss batch unentered. The return may produce a
fresh Preboss batch with fresh rewards because entered-room history, rather
than abandoned creation, owns its appearance cap. One takeover-biome fixture
must protect this distinction.

### Ephyra (`N`)

`N_Opening01` may emit natural Chaos beside its normal PreHub exit:

```text
normal: N_Opening01 -> N_PreHub01 -> N_Hub
Chaos:  N_Opening01 -> Chaos -> fresh N_Hub
```

Chaos contributes the depth step that reaches the existing N depth-two Hub
takeover. Its outgoing host decision must therefore resolve through the normal
N eligibility/takeover authority. Do not preserve PreHub as a hidden resume
target or introduce a Chaos-specific `ForceNextRoom = N_Hub` rule.

## Workspace and UX contract

The current selected-occurrence inspector already receives its nearby
`Add next decision` frontier intent. Natural Chaos extends that existing action
row with a bound `Spawn Chaos door` action where the engine projects static
capability. It does not first reorganize every entry inspector.

After a gate exists, the ordinary decision workbench contains:

```text
Room selection
├─ normal room/reward offers
└─ Chaos door
   └─ Chaos room card, map choice, fixed encounter, fixed reward
```

Requirements:

- the source action appears beside outgoing authoring, including N Opening and
  supported G/P Intros;
- normal and Chaos branches use the same single-choice interaction;
- selected and unselected branches remain inspectable;
- the Chaos card exposes map selection, fixed encounter/reward facts, removal,
  selection, and findings without inventing editable fixed leaves;
- invalid active gates retain their controls;
- dormant gates on unpicked rooms retain state but do not expose active
  customization or findings;
- rail and finding focus resolve to the containing decision/occurrence
  inspectors without duplicated controls;
- non-Chaos routes and unsupported sources expose no invented action;
- React dispatches bound intents and performs no capability, spacing, target,
  force, or reward evaluation.

If manual N Opening or Intro testing still shows costly navigation after this
product loop exists, record the exact problem and deliver a focused containing
inspector follow-up. It is not a prerequisite or a speculative cross-route
composition refactor.

## Delivery gates

### Gate A — Occurrence-owned additional exits

Migrate the existing Zagreus contract end to end without adding Chaos data:

- schema 14 and mandatory `RoomOccurrence.additionalExits`;
- occurrence-owned `AdditionalExitAddress`;
- codec ownership, closure, selection, cycle, and topology-impact traversal;
- `AddZagreusContract`/`RemoveZagreusContract` and workspace source facts;
- canonical additional-continuation derivation from the active source;
- reanchor normalization and dormant feature restoration;
- removal of decision-owned additional-exit assumptions and the current
  incompatible-source reanchor rejection.

Primary neighborhoods:

- `packages/planner-engine/src/authored-project/{model,addresses}.ts`;
- `authored-project/topology/{codec,query,room-ownership}.ts` and
  `topologyImpact.ts`;
- `authored-project/commands/{route-detours,topology,room-replacement}.ts`;
- `simulation/materialization/{model,biome}.ts`;
- `apps/planner/src/projections/structured-workspace/assembly/` occurrence and
  decision assembly/facts;
- their existing authored, detour, materialization, workspace, UI, and product
  witnesses.

Acceptance:

- every existing Anomaly/Zagreus product test remains behaviorally equivalent;
- a Midshop-to-ordinary reanchor succeeds, leaves the contract dormant on the
  old Midshop, and preserves its target package;
- reselecting that Midshop restores the exact contract;
- no persisted or application sidecar duplicates occurrence feature ownership;
- `npm run test:engine`, `npm run test:planner`, and the full repository gate
  pass.

### Gate B — Chaos declarations, authored state, and commands

Deliver:

- `Chaos_01`–`Chaos_06`, `Empty_Chaos`, `TrialUpgrade`, Chaos exit behavior,
  and the `Chaos` room/template identity;
- exact F/G/N/P source capability declarations;
- normalized host target domains/defaults and P depth requirement;
- `naturalChaos` authored union member and canonical continuation member;
- add, remove, map replacement, selection, defaults, codec, destructive impact,
  undo/redo, and recovery behavior;
- the catalog-version update associated with the new declarations.

Acceptance:

- unsupported and Ixion-only sources cannot create natural Chaos;
- context-invalid active gates remain structurally representable;
- normal and Chaos occurrences have unique semantic owners;
- consumers do not recreate the source inventory or host target domain.

### Gate C — Generation, history, requirements, and findings

Deliver:

- natural-Chaos additional-room creation at the entered source checkpoint;
- exact offer-spacing evaluation from existing creation/appearance history;
- P depth evaluation;
- selected and unselected offer lifecycle;
- Chaos entry, encounter, direct reward, counters, and appearance;
- fresh ordinary host continuation;
- exact source, spacing, target-domain, and lifecycle findings.

Acceptance:

- the ten-room boundary, skipped/selected equivalence, and cross-biome route
  history are protected;
- normal offers retain their creation and reward effects when Chaos is selected;
- Chaos return never reuses an abandoned normal occurrence;
- one takeover fixture proves Chaos can delay an offered Preboss and later
  produce a fresh batch;
- one N fixture proves the fresh depth-two Hub takeover with no special repair.

### Gate D — Workspace and React product loop

Deliver:

- bound spawn, remove, map, and selection interactions;
- the source action beside existing outgoing authoring;
- typed Chaos decision/card presentation and summaries;
- finding focus and editor-session reconciliation;
- persistence recovery and representative browser workflows.

Acceptance:

- selected, unselected, and invalid active gates remain operable;
- N Opening presents and traverses PreHub versus Chaos through one decision;
- the Chaos continuation exposes its fresh normal target and reward;
- unsupported sources expose no action;
- React contains no domain-policy branch for Chaos.

### Gate E — Closure and absorption

Run the complete repository gate and audit the live diff for duplicated policy,
parallel topology paths, test-only production surfaces, and unexplained growth.
Absorb completed contracts into the authored-project, generation, lifecycle,
simulation, editor, integration-boundary, and affected biome documents. Update
the implementation progress frontier, then retire this file.

Manual acceptance decides whether a narrowly described entry-inspector UX
follow-up is warranted. It does not hold domain closure open if the existing
occurrence action row and decision workbench are sufficient.

## Commit expectation

Expect approximately five to seven focused commits:

1. occurrence-owned Zagreus migration and schema 14;
2. Chaos catalog plus authored command contract;
3. generation/history/findings;
4. workspace and React;
5. N/Preboss/product-loop closure;
6. focused behavioral or UX correction only if integration exposes one;
7. documentation absorption and plan retirement.

Keep the Gate A ownership migration behavior-preserving for Zagreus. Do not
mix an all-entry presentation reorganization into the domain gates, and do not
land dormant interfaces or forwarding paths for later commits to repair.

## Closure audit

Before retirement, verify that no Ixion bypass, chance replay, save-profile
input, React/Redux eligibility, automatic Chaos return, generic `special`
edge, fake Chaos route biome, shadow offer ledger, source-backward target
validation, or duplicated feature/decision ownership entered production.

Offered-gate and entered-room histories must remain distinct; normal-door
takeover must still own only normal exits; occurrence-owned additional-exit
state must remain with its occurrence through unpick/repick; each semantic
control must have one reachable inspector; and complete policy matrices must
remain with catalog or engine authority.
