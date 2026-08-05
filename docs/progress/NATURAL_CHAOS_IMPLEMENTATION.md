# Natural Chaos Implementation Plan

## Status

**Provisional. Do not implement from this document yet.**

Promote this plan to implementation-ready only after the Anomaly and Zagreus
work is complete and Gate A has been rerun against the resulting live code.
The plan exists now to preserve the settled product and game-model decisions;
it does not require the preceding work to build dormant Chaos types, commands,
state, or UI.

This is a temporary delivery document. Stable game facts currently live in
`docs/audits/ROUTE_DETOUR_FINDINGS.md`; completed modeling and ownership
contracts must be absorbed into the appropriate design and biome authorities
before this document is retired.

## Objective

Support authored **natural** Chaos gates in `N`, `F`, `G`, and `P` as real
additional exits beside the source room's normal exits. A gate may be offered
and skipped, or selected to enter a concrete Chaos room and then resume the
host biome through a fresh ordinary continuation. Gate offer, gate selection,
Chaos entry, and resumed target generation remain distinct lifecycle events.

## Scope

Included: exact source capability, ten-prior-room offer spacing, concrete
Chaos-map selection, fixed encounter/reward identity, normal-versus-Chaos
selection, fresh host-biome continuation, Opening/Intro continuation UX, and
the complete persisted/simulated/editor product loop.

Excluded:

- Spark of Ixion and every forced-Chaos path;
- Stygian Well items, trait lifetime, and zero-health-cost gates, including
  Chaos in `H` or another source enabled only by forced placement;
- chance or RNG replay;
- external save/profile progression inputs;
- Nyx narrative activation in Chaos;
- detailed Chaos curse, blessing, or trait-payload simulation;
- game-runtime forcing, adapters, and conformance execution.

Natural eligibility must not inherit any bypass from the excluded Ixion path.

## Locked planner baseline

The planner assumes ordinary Chaos and Surface progression requirements have
been met and authors possible outcomes rather than their probabilities.

### Source capability

The supported natural-source inventory is:

| Host biome | Supported source declarations                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `N`        | `N_Opening01` only                                                                                                              |
| `F`        | `F_Opening01`–`F_Opening03`, `F_Combat01`–`F_Combat22`, `F_Story01`, `F_Reprieve01`, and `F_Shop01`                             |
| `G`        | `G_Intro`, `G_Combat01`–`G_Combat20`, `G_MiniBoss01`–`G_MiniBoss03`, `G_Story01`, `G_Reprieve01`, and `G_Shop01`                |
| `P`        | `P_Intro`, `P_Combat01`–`P_Combat19`, `P_Reprieve01`, and `P_Shop01`, while the source satisfies the natural depth-five ceiling |

Every supported source must retain its concrete physical `SecretPoint`
capability. Room category, nonzero biome chance, or a UI label is not a
substitute for that declaration-backed fact.

### Chaos targets and defaults

Use the progressed-save target pools:

| Host source      | Authored Chaos maps    | Default    |
| ---------------- | ---------------------- | ---------- |
| `N`              | `Chaos_03`, `Chaos_06` | `Chaos_03` |
| `F`, `G`, or `P` | `Chaos_01`–`Chaos_06`  | `Chaos_01` |

Each Chaos room owns:

- fixed encounter `Empty_Chaos`, with no encounter picker and no modeled Nyx
  progression behavior;
- fixed direct reward `TrialUpgrade`, presented as **Chaos Blessing**;
- one ordinary outgoing continuation in the previous host room set;
- one room-history ordinal and its ordinary declared biome-depth effect.

`BaseChaos.PauseBiomeState` is deliberately collapsed because the planner has
no biome-state trait lifecycle input or consumer. Do not introduce a generic
biome-state suspension abstraction solely for this declaration.

The game reaches `TrialUpgrade` through `BaseChaos.ForcedRewardStore =
"Secrets"`, whose supported entry is that reward. The planner deliberately
normalizes this one-entry forced store to a direct fixed `TrialUpgrade` leaf; it
does not introduce a reusable `Secrets` reward-store abstraction. The reward
is acquired as a named fact. This slice does not model its curse/blessing
payload or make it affect unrelated eligibility.

An eligible source without a gate is valid and produces no finding. An
authored gate that later becomes invalid remains visible with an owned finding
and removal control.

## Authored topology contract

A source decision contains one normal lane and, when authored, one natural
Chaos additional exit:

```text
source occurrence
  -> normal batch and its offered targets
  -> natural Chaos exit and Chaos occurrence
  -> one selected continuation across both branches
```

The required command behavior is:

- adding a Chaos gate creates its occurrence but preserves the current
  selection;
- normal targets remain created, offered, inspectable, and reward-consuming;
- selecting Chaos retains the normal branch as unentered authored structure;
- selecting normal retains the Chaos gate as an offered but unentered branch;
- removing Chaos deletes only its occurrence and selected descendants;
- undo restores the exact removed branch and selection;
- replacing or invalidating the source retains structurally representable
  Chaos authorship and reports contextual invalidity;
- a normal-door Preboss takeover owns only the normal lane and cannot replace,
  remove, or count the Chaos exit.

The special behavior ends at the door boundary. Normal-door force pressure and
Preboss takeover operate only on the normal lane. Once the Chaos door is
selected, its target is a room occurrence whose declaration drives encounter,
reward, counters, history, and outgoing generation. Chaos is not another normal
target, a host-room encounter, a fake route biome, a detached list, or a generic
graph edge with policy hidden elsewhere.

The exact persisted type and command names remain provisional until Gate A.

## Offer-spacing and lifecycle contract

Natural Chaos uses an **offer-consumed** spacing rule. Eligibility requires no
Chaos-offering source among the previous ten committed room-history records.

When an authored gate is created for an entered source:

1. the gate and Chaos target become offered source facts;
2. the source records that it offered natural Chaos;
3. leaving the source commits that marker with its room-history record;
4. the next ten-room window observes the marker even if the player selected a
   normal door;
5. entering Chaos separately records the Chaos occurrence, encounter, reward,
   history ordinal, and depth effects.

The offer marker belongs in simulation history and cannot be reconstructed
from entered Chaos history, Redux, rendered topology, or an application
sidecar.

## Return contract

Chaos uses an ordinary outgoing door, not the automatic hidden continuation
used by Anomaly and Zagreus.

Leaving a selected Chaos occurrence:

- generates a fresh target from the host room set;
- applies normal-door target eligibility, force, creation, reward-store, and
  reward-preview behavior at that new checkpoint;
- never reuses the earlier unpicked normal target or its reward;
- uses the ordinary decision workbench for the generated room and reward.

### Preboss coexistence

A forced normal-door Preboss batch and a Chaos gate may coexist. If Chaos is
selected, that Preboss batch remains an unentered offer. The return generation
may create a fresh Preboss batch with fresh rewards because appearance caps
observe entered rooms, not the abandoned creation. A focused fixture must
protect this distinction in at least one takeover biome.

### Ephyra (`N`) entry

`N_Opening01` may offer its normal PreHub exit and an additional Chaos gate.
The supported outcomes are:

```text
normal selection: N_Opening01 -> N_PreHub01 -> N_Hub
Chaos selection:  N_Opening01 -> Chaos -> fresh N_Hub
```

Chaos contributes the depth step that reaches N's depth-two Hub takeover. The
return must therefore skip PreHub and produce a fresh Hub through the existing
N eligibility/takeover authority. Do not persist PreHub as a hidden resume
target or add a Chaos-specific `ForceNextRoom = N_Hub` repair.

## Entry workbench UX correction

Opening and Intro inspectors currently edit the entry room and reward, then
expose outgoing generation through a detached `Add next decision` frontier.
Natural Chaos requires the source's normal and additional exits to be
selectable together.

Before adding Chaos UI, project every route entry through one containing
workbench:

```text
Opening / Intro
├─ current room and incoming reward
└─ next route choice
   ├─ normal offered rooms and rewards
   ├─ picked normal-door target
   └─ additional exits, when authored
```

Requirements:

- create and edit the first outgoing decision in place;
- show the exact picked continuation rather than only the entry reward;
- reuse ordinary decision controls and semantic owners;
- keep one control package per semantic owner;
- allow the Opening/Entrance and first-decision rail highlights to resolve to
  the same containing inspector without duplicating controls;
- apply the containing workbench consistently to all route entry rooms;
- expose Chaos controls only where the engine projects supported capability;
- preserve current behavior in non-Chaos biomes.

This is a presentation/composition correction, not a second topology model.
React must not determine Chaos eligibility or construct domain commands from
catalog facts.

## Delivery gates

### Gate A — Post-Anomaly/Zagreus preflight

Do not start implementation until this gate replaces provisional assumptions
with evidence from the live code.

Audit:

- the delivered separation between a room's game room set and its host route;
- ownership and selection of Zagreus's additional exit;
- whether additional-exit infrastructure assumes fixed targets, automatic
  continuation, hidden preview, or an entry-consumed cap;
- the delivered ordinary occurrence, additional-door address, codec, removal,
  and focus contracts;
- the structured workspace's live entry/frontier/decision composition;
- schema and catalog-version impact;
- the narrow change neighborhood and primary test owners.

Then amend this document with exact types, commands, files, commit boundaries,
and expected displaced UI paths. If the delivered contracts cannot express an
ordinary-return additional exit without special cases, stop and correct the
plan rather than widening a Zagreus-specific path implicitly.

Acceptance: mark this document implementation-ready with exact types,
commands, files, displaced paths, commit boundaries, and primary test lanes;
leave no unresolved ownership or persistence decision.

### Gate B — Entry decision workbench

Deliver the behavior-preserving Opening/Intro containing workbench before
introducing Chaos controls.

Acceptance: every route can author its first picked continuation from the
entry inspector; entry and first-decision focus share one control package;
existing command, reward, finding, and keyboard behavior remains unchanged;
no Chaos production state exists yet.

### Gate C — Catalog, authored topology, and commands

Deliver:

- Chaos maps, room-set identity, encounter, reward identity, special-door
  source capability, and natural requirements;
- the natural additional-exit authored form;
- add, remove, and selection commands;
- exact codec, defaults, destructive impact, and undo/redo behavior.

Acceptance: unsupported and Ixion-only sources cannot author natural Chaos;
source changes retain invalid-but-structural authorship with findings; normal
and Chaos branches have distinct ownership; consumers do not recreate catalog
source capability.

### Gate D — Simulation, requirements, and candidates

Deliver:

- the source-level natural-Chaos-offered history fact;
- ten-prior-room spacing evaluation;
- selected and unselected gate lifecycle;
- Chaos entry, encounter, reward, history, and depth;
- ordinary fresh host-biome return generation;
- candidate support and exact semantic findings.

Acceptance:

- an unpicked gate makes another natural gate ineligible at every source whose
  previous-ten-record window still contains the marked host record;
- after ten later room-history records of any room set have committed, the
  first otherwise-eligible source may offer natural Chaos again;
- a selected gate records both source offer and Chaos entry;
- normal branch offers retain their creation and reward effects when Chaos is
  selected;
- Chaos return never reuses an abandoned normal occurrence;
- N Chaos resumes at a fresh Hub and skips PreHub;
- Chaos can delay an offered takeover Preboss and allow a fresh later batch.

### Gate E — Workspace, React, and product closure

Deliver:

- `Spawn Chaos Door`, removal, and normal-versus-Chaos selection through bound
  workspace interactions;
- a Chaos occurrence workbench with fixed encounter/reward facts and map
  selection;
- an ordinary continuation workbench after selected Chaos;
- decision and rail summaries for offered, selected, invalid, and removed
  gates;
- finding focus, editor-session reconciliation, persistence recovery, and
  representative product workflows.

Acceptance:

- invalid or unselected gates retain visible controls;
- selecting either branch leaves the other inspectable;
- N Opening presents PreHub versus Chaos in the same next-route package;
- non-Chaos routes and unsupported sources show no invented action;
- all repository gates pass;
- stable contracts are absorbed into owning design and biome documents and
  this temporary plan is retired.

## Provisional commit expectation

Expect approximately four to six focused commits after Gate A:

1. entry-workbench correction;
2. catalog and authored contract;
3. simulation/history/candidates;
4. workspace and React;
5. focused behavioral correction if integration exposes one;
6. closure and documentation absorption.

Gate A must revise the estimate rather than mix behavior-preserving movement
with a domain change or leave a parallel path for later repair.

## Closure audit

Before retirement, verify that no Ixion, chance, save-profile, React/Redux
eligibility, automatic-return assumption, generic `special` edge, fake Chaos
biome, shadow audit, or test-only production surface entered the product.
Offered-gate and entered-room histories must remain distinct; takeover must
still own only normal exits; each decision control must have one semantic
owner; complete policy matrices must remain with catalog/engine authority.
