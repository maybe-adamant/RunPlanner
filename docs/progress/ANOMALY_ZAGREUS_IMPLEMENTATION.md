# Anomaly and Zagreus Implementation Plan

## Status

**Implementation-ready.**

This temporary document owns delivery sequencing for Oceanus Anomaly and the
Zagreus contract. Source-backed facts are recorded in
`docs/audits/ROUTE_DETOUR_FINDINGS.md`. Stable contracts must be absorbed into
the owning design and biome documents before this plan is retired.

Natural Chaos is deliberately excluded. Its provisional follow-up lives in
`NATURAL_CHAOS_IMPLEMENTATION.md` and must be revalidated against the code
delivered here.

## Objective

Support two concrete route-generation features:

- an eligible G normal-door target may be atomically replaced by an Anomaly
  room;
- an eligible Midshop may offer an additional Zagreus contract exit beside its
  normal exit.

The resulting Anomaly and `C_Boss01` rooms are authored `RoomOccurrence`
values. Their declarations own encounters, rewards, counters, and outgoing
behavior; the canonical occurrence lifecycle owns entry, history, and exit
exactly as it does for every other room. Their generation rules remain
distinct, and this work must not create a second room classification, a
parallel room lifecycle, a generic detour framework, or a fake B/C route biome.

## Scope and baseline

Assume ordinary save/profile and narrative progression requirements have been
met. Preserve modeled route, room, encounter, reward, depth, and history
requirements. Author possible outcomes directly instead of replaying chance.

Excluded:

- natural or Ixion-forced Chaos;
- Anomaly/Zagreus chance values;
- save/profile inputs, bounty packages, and narrative gates;
- `GemPointsBigDrop` and other meta-progression payouts;
- the later free Zagreus pedestal placement;
- a generic Customize-room modal or encounter-feature framework;
- game-runtime forcing, adapter, or conformance work.

An absent Anomaly replacement or Zagreus door is valid. Neither feature is a
forced authored requirement merely because its run-level conditions pass.

## Settled game and product contracts

### Oceanus Anomaly

The source and target gates are separate.

Source preparation requires:

- route biome `G`;
- `BiomeDepthCache >= 3` at the source checkpoint;
- no entered Anomaly room earlier in the route;
- source room not `G_Shop01`, `G_Story01`, `G_PreBoss01`, or `C_Boss01`;
- source encounter not `ArtemisCombatG` or `NemesisRandomEvent`.

The otherwise-selected target must be an ordinarily eligible
`G_Combat01`–`G_Combat20`. The remembered G declaration proves replacement
capability but is never created, offered, rewarded, or entered after takeover.

The authored Anomaly state contains:

- one map from `B_Combat01`, `B_Combat05`, `B_Combat06`, `B_Combat07`,
  `B_Combat08`, `B_Combat10`, or `B_Combat21`;
- default map `B_Combat01`;
- fixed encounter `GeneratedAnomalyB`, which counts toward biome encounter
  depth;
- one ordinary G reward offer, excluding `Devotion` and `SpellDrop`;
- authored success, defaulting to `true`.

Takeover preserves the target occurrence ID and its current reward exactly. It
persists the replaced G game name for semantic revert, discards the replaced
room's encounter/customization state and downstream decision, and initializes
Anomaly-only state from declaration defaults. This reward handoff is an
authoring convenience, not a claim that the game created or rewarded the
discarded G candidate. Canonical simulation treats the retained leaf only as
the Anomaly offer: it must not emit a G creation/offer event, consume the reward
twice, or leave phantom G history. If the retained reward is `Devotion` or
`SpellDrop`, the result is an invalid but editable Anomaly state with an exact
finding: the command must never silently reroll, discard, refund, or replace
the reward. Changing Anomaly map preserves reward, outcome, and provenance.

Revert restores the remembered G game name, preserves the reward, recreates
the G room's other leaves from defaults, and removes the Anomaly continuation.
Undo/redo still restores exact snapshots independently of semantic revert.

Anomaly reward behavior is:

- creation consumes and records the visible offer;
- success acquires it;
- failure does not acquire it and does not refund the reward-store entry.

Anomaly is limited once per route **on entry**. An offered but unentered
Anomaly does not consume the limit; structurally representable later offers may
remain authored until evaluation proves that an earlier selected Anomaly was
entered.

### Zagreus contract

The contract is game entry-time content surfaced from a selected Midshop's
room-local Shop workbench, like shop purchases and NPC encounter controls. The
workbench is the capability and presentation anchor, not the persisted owner:
the source's outgoing `ExitDecision` owns the additional door and its target
occurrence. Engine authorization requires the source to be on the selected
spine, use a supported Midshop declaration, and have materialized Shop state.
`detailsActive` is an application projection fact that controls whether the
workbench presents the action; it is not an engine command input or domain
precondition. An unpicked Midshop has no contract surface. Evaluated entry
remains a lifecycle fact, not a second authoring gate: a finding may invalidate
a selected, materialized source but must not hide its already-active control.

Only these sources can offer the additional contract exit:

| Host biome | Source room |
| ---------- | ----------- |
| `F`        | `F_Shop01`  |
| `G`        | `G_Shop01`  |
| `O`        | `O_Shop01`  |
| `P`        | `P_Shop01`  |

The additional exit always targets authored `C_Boss01`, whose supported
planner contract is:

- fixed encounter `BossZagreus01`;
- fixed acquired reward `InfernalContractBoon`;
- no `GemPointsBigDrop`;
- on entry, one `C_Boss01` entered-room record and contract-cap consumption;
  at commit, one route-wide room-history ordinal and the ordinary
  `runDepthCache` and host `biomeDepthCache` step;
- no `biomeEncounterDepth` advancement from `BossZagreus01`;
- no modeled `PauseBiomeState` trait suspension, because the planner currently
  has no biome-state trait lifecycle input or consumer;
- one automatic hidden continuation into the source Midshop's host biome.

Do not add a generic biome-state suspension contract or normalized catalog
field solely to retain the collapsed `PauseBiomeState` declaration.

The contract is limited once per route **on entry into `C_Boss01`**. Creating
and skipping a contract door does not consume the limit and may permit a later
eligible Midshop offer.

Adding the exit preserves the normal branch and its current selection. If the
normal branch was width-one and declaration-derived, the combined decision
records that normal exit explicitly as selected. If no continuation was
selected, the combined choice remains unresolved. Removing the contract
deletes only its occurrence and descendants and restores declaration-derived
normal selection when applicable.

The special contract ends at the door boundary. Normal-door force pressure and
Preboss takeover operate only on `ExitDecision.normal`; they do not replace,
remove, or count an additional door. A practical Zagreus/Preboss collision does
not occur at the supported Midshops, but the ownership rule belongs to the
decision shape. Once selected, `C_Boss01` is a room occurrence processed by the
shared lifecycle.

## Shared narrow contracts

Keep the shared contracts narrow. They describe declaration data and exit
behavior, not a second class of rooms.

### Room-set identity and conditional insertion

The catalog records each room's game room-set identity as declaration data. It
does not classify rooms by whether that room set matches the current route.
The containing authored biome supplies route context, while generation rules
express availability; room-set identity neither selects a lifecycle path nor
admits a room to a normal-door picker.

The catalog instead owns the exact generation data:

- G's Anomaly replacement declaration carries the source depth, entered-room,
  source-room, and source-encounter conditions; the twenty replaceable G target
  names; and the seven Anomaly replacement names;
- each supported Midshop declares the `zagreusContract` additional door with
  fixed target `C_Boss01` and its entry-history condition.

These are closed data expressions, not a generic route-feature framework. The
engine evaluates them at their declared checkpoints. Commands and codecs admit
an Anomaly room only through replacement provenance and admit `C_Boss01` only
through the declared additional door. Normal-door generation continues to use
the layout's normal candidate policy, so neither set appears in normal-door
pickers.

Replace structural assumptions such as
`room.biomeKey === layout.biomeKey` only where they conflate room-set identity
with legal topology position. Do not globally weaken document validation. Once
a command or decoded topology has established a legal occurrence, incoming
rewards, materialization, encounters, lifecycle, counters, and history resolve
from that occurrence and its room declaration through the shared engine path.
`GeneratedAnomalyB` advances encounter depth; `BossZagreus01` does not.

### Automatic hidden continuation

Anomaly maps and `C_Boss01` declare one `AnomalyAutoExitDoor`-style exit with:

- automatic traversal;
- hidden reward preview;
- fresh target generation from the occurrence's host biome and normal candidate
  policy.

The authored continuation is still a normal one-target exit decision:

- its target room and reward are explicit planner state;
- its selection is declaration-derived;
- the target is created and its reward-store entry consumed before entry;
- React exposes no player choice between targets and does not infer hiddenness.

The return target is a real next host target, not an accounting-free callback.
It participates in normal target/batch progression under its host declaration;
the automatic traversal only removes the player choice. Its candidate may be a
host Preboss or terminal takeover when the normal host policy requires one;
the return must not be hardcoded as an ordinary combat room.

The two concrete forms have an explicit, closed structural meaning:

- Anomaly replaces exactly one normal G target position; the remembered G
  target never materializes, and the automatic return is the next normal host
  target.
- Zagreus preserves the source Midshop's ordinary normal offer and its normal
  offer/bag effects. A selected contract occupies that source decision's
  selected-spine position, then bridges through `C_Boss01` to the automatic
  return as the next normal host target.

The depth-five O boundary is an ordinary instance of that rule, not an O
exception: `O_Shop01`'s normal batch creates the unpicked, reward-consuming
fifth O target; the selected contract enters `C_Boss01`; its automatic normal
host decision creates the distinct sixth O target. `C_Boss01` is an intervening
room occurrence, not an O normal-door batch or target. After it commits, the
returned target enters at host depth seven and its outgoing normal decision
resolves `O_PreBoss01`. Neither normal target is deleted, reused, or made
accounting-free.

The selected-spine and normal-batch queries must implement that closed
Zagreus bridge rather than stopping at an additional selection. In particular,
they must cross both the Midshop-to-contract and contract-to-return
continuations through the same accounting—never through a route-specific skip
or a generic detour exception.

Generation timing follows the game and existing room lifecycle profiles. The
automatic target is created at the Anomaly or `C_Boss01` occurrence's
outgoing-generation checkpoint, before that occurrence commits its own
room-depth/history counters. It therefore observes the occurrence's entry-time
`roomsEntered` and run-cap facts plus every earlier room-local effect, including
encounter and acquisition effects. It does not observe that occurrence's later
`RoomHistory`, route-ordinal, `runDepthCache`, or `biomeDepthCache` commit
contributions. The occurrence then commits and exits; the generated target
enters automatically afterward.

The catalog exit/generation declaration and canonical engine product own these
facts. An automatic continuation is not an application callback, a special
address family, or a pointer to the discarded/previous normal target.

## Authored schema and command contract

Make one schema and catalog-version change for both features. The schema
version is `13`; reject older documents clearly rather than adding a
compatibility shim in this feature slice.

Extend the persisted model with:

- explicit Anomaly replacement provenance on its normal target occurrence;
- Anomaly outcome and counted reward state;
- an `additional` collection on `ExitDecision`;
- a closed additional-exit variant for `zagreusContract` with its occurrence;
- an exit selection variant that can select an additional exit.

Normal-door force pressure and Preboss takeover continue to own only `normal`.
Additional doors remain sibling continuations outside that policy; no command
may repair a normal takeover by deleting or replacing one.

Add a stable `AdditionalExitAddress` using route, biome, decision source, and
additional-exit key. Normal `TargetAddress` remains reserved for normal-door
targets. Occurrence-owned room, reward, encounter, and outgoing-decision
addresses remain unchanged.

`AdditionalExitAddress` is a first-class semantic owner: workspace assembly
must publish its exact marker, containing decision destination, and bound
select/remove interactions; findings must route through that destination, and
removal must reconcile focused owners and selected findings. Closure and
mutation tests must prove that deleting or misrouting any of those products
fails.

Required semantic commands are:

- switch an eligible normal target to Anomaly;
- change Anomaly map;
- change Anomaly success;
- revert Anomaly to its remembered G declaration;
- add the fixed Zagreus contract exit, creating its source decision envelope
  atomically if necessary;
- remove the contract exit;
- select normal or additional continuation through the existing decision
  selection authority.

Command handlers own structural validation, exact destructive impact, and
leaf reconciliation. Candidate evaluation owns contextual possibility. React
must receive complete bound intents rather than reconstruct source, target,
history, or default facts.

Adding the contract is structurally permitted only for a selected declared
Midshop whose Shop state is materialized. The command receives semantic source
identity and authored state, never workspace `detailsActive`. It does not
require evaluated entry; the normal candidate/finding path reports an invalid
selected source without withdrawing its active room-local control. Lifecycle
entry into `C_Boss01` remains the only point that consumes the contract cap.

Changing selection retains the existing rule that a prior selected branch's
downstream decision must be removed explicitly before another branch is
selected. Browser confirmation is not added; project undo/redo remains the
recovery mechanism.

## Simulation and validation order

### Anomaly replacement

At the source's outgoing generation checkpoint:

1. evaluate the remembered G target under ordinary target eligibility;
2. evaluate source depth, source room/encounter exclusions, and prior entered
   Anomaly history;
3. create only the Anomaly occurrence and consume its authored offer;
4. record Anomaly appearance and enter only when its physical exit is selected;
5. run `GeneratedAnomalyB` and condition acquisition on authored success;
6. at Anomaly's outgoing-generation checkpoint, create one fresh hidden host
   target and reward through G's normal candidate policy;
7. commit Anomaly's declared counters and exit;
8. enter that generated target automatically.

The remembered G target is validation evidence, not a phantom creation or
history record.

### Zagreus additional exit

The contract and ordinary exits have different game checkpoints:

1. at the entered Midshop's room-start checkpoint, create the fixed contract
   exit and `C_Boss01` without consuming a normal host reward-store entry for
   the contract room;
2. at ordinary outgoing generation, create and process the normal branch as
   today;
3. resolve the authored normal-versus-contract selection and enter only the
   selected branch;
4. when the contract is selected, run `BossZagreus01` and acquire
   `InfernalContractBoon`;
5. at `C_Boss01`'s outgoing-generation checkpoint, create one fresh hidden
   host target and reward through the host's normal candidate policy;
6. commit `C_Boss01`'s declared room counters (but no encounter-depth delta)
   and exit;
7. enter that generated target automatically.

Unpicked normal targets retain creation, offer, and bag-consumption effects
when the contract is selected. An unpicked contract room contributes creation
but no appearance, encounter, reward acquisition, or run-limit consumption.

Invalid authored state stays visible and receives exact semantic findings.
Evaluation may not replace it, remove it, or hide its controls.

## Editor contract

### Anomaly

Every authored G combat target—picked or unpicked—may expose the engine-bound
`Switch to Anomaly` action when supported. This is structural target takeover,
not general unpicked-room customization.

The resulting target card keeps its reward editor and adds:

- Anomaly map selector;
- success/failure control;
- fixed `GeneratedAnomalyB` encounter fact;
- `Revert to <remembered room>` action.

The automatic continuation appears only when the Anomaly occurrence is on the
selected spine. It exposes the exact hidden target room and reward for planner
authorship, labels the traversal as automatic/hidden in game, and has no exit
selection control.

### Zagreus

A selected, details-active declared Midshop with materialized Shop state
exposes `Spawn Zagreus Door`. The containing decision presents the normal lane
and contract exit as sibling continuations. The contract card exposes fixed
room, encounter, and reward facts rather than selectors for them.

When selected, `C_Boss01` exposes the same automatic-continuation presentation
as Anomaly, using its host biome's resolved normal candidate and reward. The
presentation may therefore show a host Preboss/takeover target when that is
what host progression requires.

The rail remains a decision-highlight projection. It may summarize the
selected contract or selected room but must not add a parallel detour editor,
fake biome, or footer-style summary.

## Delivery gates

### Gate A — Room, availability, and exit declarations

Deliver normalized room-set identity, the closed Anomaly replacement and
Zagreus additional-door declarations, automatic-exit presentation/traversal
facts, all seven Anomaly rooms, `GeneratedAnomalyB`, `C_Boss01`,
`BossZagreus01`, and `InfernalContractBoon`.

Primary surfaces:

- `packages/planner-engine/src/catalog-schema/`;
- `packages/hades2-catalog/src/declarations/`;
- `packages/hades2-catalog/src/compiler/`.

Acceptance:

- existing room declarations retain their current generation and lifecycle
  behavior;
- room-set identity does not define legal topology positions or normal-door
  picker membership;
- the catalog owns the complete Anomaly source/target/replacement matrix and
  the four Zagreus-capable Midshops;
- the normalized catalog exposes Anomaly only through the declared replacement
  rule and `C_Boss01` only through the declared additional door;
- automatic hidden exit facts normalize without app knowledge;
- the room and encounter declarations preserve the exact asymmetry: Anomaly
  advances encounter depth and `C_Boss01` does not;
- catalog tests own the complete declaration matrix.

### Gate B — Complete engine vertical slice

Deliver schema 13, persisted forms, codecs, defaults, addresses, destructive
impact, commands, materialization, generation, history, lifecycle, candidates,
requirements, and findings for both features. This gate may be developed in an
internal sequence, but it lands only when the new authored states have complete
canonical simulation semantics; do not commit a production schema that later
work must teach the simulator to understand.

Primary surfaces:

- `packages/planner-engine/src/authored-project/model.ts`;
- `addresses.ts`, `codec.ts`, `topology/`, `room-state/`, and `commands/`;
- `packages/planner-engine/src/simulation/materialization/`;
- `generation/`, `history/`, `lifecycle/`, `candidates/`, requirements, and
  findings.

Acceptance:

- JSON round-trips exact incomplete, selected, unselected, and reverted states;
- Anomaly takeover/revert preserves occurrence identity and reward only;
- an incompatible retained Anomaly reward remains authored, editable, and
  finding-backed rather than being silently changed;
- contract add/remove preserves the normal branch and reconciles selection;
- incoming-reward commands, materialization, and lifecycle resolve every legal
  occurrence from its room declaration without a route-specific room branch;
- normal-door candidate domains exclude Anomaly and `C_Boss01`; their declared
  insertion rules are their only entry paths;
- `AdditionalExitAddress` has exact identity, codec, command, and destructive
  impact coverage;
- downstream removal and undo/redo restore exact snapshots;
- engine command authorization does not accept or reconstruct workspace
  `detailsActive`;
- no context-invalid command path silently repairs authored state.

Engine acceptance fixtures include:

- Anomaly success and failure with identical offer consumption;
- unentered Anomaly followed by a later valid offer;
- entered Anomaly invalidating a later authored offer;
- excluded source room and source encounter;
- Anomaly return generation before its room-depth commit, with its encounter
  depth already advanced;
- hidden G continuation reward consumption;
- skipped Zagreus door followed by a later valid offer;
- entered `C_Boss01` invalidating a later door;
- contract creation at Midshop room start before ordinary host target/reward
  generation;
- selected contract with normal offers still consumed;
- `C_Boss01` return generation before its room-depth commit and with no
  encounter-depth advancement;
- a G Anomaly return and the exact depth-five O trace—unpicked fifth normal
  target created by the Shop, selected `C_Boss01`, distinct sixth automatic return, then
  `O_PreBoss01`—proving host candidate, Preboss, and fixed-position spine
  behavior;
- hidden return in each of `F`, `G`, `O`, and `P` represented by focused engine
  fixtures without duplicating the full policy matrix.

### Gate C — Anomaly workspace and UI

Deliver target takeover/revert, map/outcome controls, fixed encounter
presentation, automatic continuation, findings, focus, and interaction tests.

Acceptance:

- controls remain reachable on picked, unpicked, and invalid Anomaly targets;
- no generic Customize modal or React-side eligibility appears;
- source and target findings route to the exact containing inspector;
- one activation dispatches one complete semantic intent.

### Gate D — Zagreus workspace and UI

Deliver Midshop spawn/removal, combined normal/contract selection, fixed
contract presentation, automatic continuation, findings, and focus.

Acceptance:

- adding a door does not jump or silently change the selected route;
- only a selected, details-active declared Midshop with a materialized Shop
  state exposes the spawn surface; unpicked Midshops do not, while findings do
  not hide a selected source's active control;
- every `AdditionalExitAddress` has exact workspace marker, containing
  inspector destination, bound interactions, finding route, and closure/mutation
  coverage;
- removing a selected contract reconciles dead semantic focus/finding state;
- normal and contract branches remain independently inspectable;
- skipped versus entered contract workflows preserve their different caps.

### Gate E — Product closure and documentation

Run complete project, engine, catalog, planner, UI, contract, product, and
repository gates. Add representative browser workflows for Anomaly failure and
selected Zagreus return. Audit production growth, duplicate policy, semantic
owner reachability, and source/import placement.

Absorb stable contracts into catalog, authored-project, lifecycle,
simulation/validation, editor, G biome, and integration-boundary authorities.
Update feature status ledgers, then retire this temporary plan. Do not link the
temporary plan from broader design documents while it is active.

## Commit expectation

Expect approximately five to seven focused commits:

1. room, availability, and exit declarations;
2. complete schema-13 engine vertical slice;
3. Anomaly application/UI;
4. Zagreus application/UI;
5. focused corrections exposed by product testing;
6. documentation absorption and plan retirement.

Split a gate only along an owning authority or complete feature boundary. Do
not land forwarding, compatibility, shadow-model, or future-Chaos scaffolding
commits.

## Closure audit

Before completion, verify:

- no natural Chaos or generic detour policy entered production;
- room-set identity remains declaration data and does not determine topology
  position or lifecycle policy;
- conditional insertion is catalog-owned and neither Anomaly nor `C_Boss01`
  appears in a normal-door picker;
- every entered occurrence uses the ordinary lifecycle and contributes its
  declared counters, including the Anomaly/Zagreus encounter-depth asymmetry;
- original G targets leave no phantom creation/history records;
- Anomaly and Zagreus caps are consumed on entry, not offer;
- automatic continuation generation occurs before the inserted room's commit,
  and its target follows normal host candidate/preboss policy;
- selected Zagreus contracts bridge the selected spine and O fixed progression
  through its preserved normal offer, distinct automatic return, and natural
  Preboss frontier, without a route-specific skip;
- hidden continuation rewards are selected and consumed normally;
- every additional exit has exact workspace, focus, and finding reachability;
- `GemPointsBigDrop` and later pedestal effects remain absent;
- every persisted owner and editable leaf has one reachable control package;
- React dispatches bound intents and owns no eligibility, topology repair,
  reward lifecycle, or address-resolution policy;
- production code contains no exhaustive self-audit or test-only execution
  surface.
