# Authored Project Model

## Purpose

This document defines the durable user-authored planner state: project and route
scope, biome topology, occurrence-local state, semantic addresses, commands,
persistence, and history. Simulation algorithms, candidates, Redux state, and
React rendering are separate concerns.

## Schema 52 Boundary

Schema 52 is the sole persisted authored-project contract. The codec rejects
every other schema version rather than manufacturing current topology or leaf
state for a stale document. The migration CLI performs the explicit 49-to-50,
50-to-51, and 51-to-52 migrations outside the production decoder, and also
updates the schema-52 catalog metadata from
`0.32.0-run-impacting-traits` to `0.32.1-run-impacting-traits` without
inventing authored outcomes. Catalog versions must match exactly after
migration.

Schemas 46 and 47 completed the occurrence-owned topology and chronology
cutover: every supported authored main or N side room is a `RoomOccurrence`,
and every authored interaction in those ordinary occurrence rooms is referenced
from one occurrence-owned `roomActions.order`. Derived completion rooms are
the deliberate exception: Postboss actions are owned by the biome's
`postbossRoomActions` state and exact completion action address. Schema 48
removed the redundant authored
project name; the profile filename is application session state. Schema 49 adds
the structural Postboss `postbossRoomActions` order and the closed
`useFountain`/`interactKeepsakeRack` references while keeping the same
occurrence/completion action machinery. Ordinary room lifecycle timelines,
Run State checkpoints, Shop Purchased markers, and the derived Boss
`bossDefeated`/Judgment seam remain products over this authored state. Mandatory
Room Action defaults likewise use the existing `roomActions.order`: semantic
commands add newly active required references at their engine-owned canonical
late position without adding a required-action set, derived order, or second
chronology field.

Schema 50 adds the boon-rarity ledger contacts, schema 51 adds the closed Chaos
trait outcome, and schema 52 adds the Natural Selection result and sparse Steady
Growth target contacts described below. Their derived history, progress, Ransom
removals, and automatic rarity mutations remain outside the persisted document.

There is one biome plan and one topology language. Production state and
semantic addresses have no layout-specific plan family, completion-transition
decision, fixed-entry slot, continuation, or picked contract.

### Superseded vocabulary

Historical delivery records may refer to `LinearBiome`, `HubBiome`, terminal
transitions, fixed-entry slots, continuations, or picked contracts. Those names
identify the pre-unified migration state only; they are not current persisted
or semantic contracts. [`MIGRATION_PROVENANCE.md`](../progress/MIGRATION_PROVENANCE.md)
retains that evidence.

```ts
interface AuthoredBiomePlan {
  biomeKey: string;
  state: AuthoredBiomeState;
  topology: BiomeTopology | null;
}

interface BiomeTopology {
  startOccurrenceId: OccurrenceId;
  occurrences: readonly RoomOccurrence[];
  decisions: readonly NextRoomDecision[];
}

type NextRoomDecision = ExitDecision | HubDecision | LocalVisitDecision;
```

`topology: null` is the only representation of a configured biome whose start
has not been authored. A non-null topology always has a real authored start;
it never uses a null start ID or a positional synthetic parent.

## Separation of Models

```text
ProjectDocument    durable, possibly incomplete authored intent
ProjectEvaluation  replaceable pure simulation output for one document
EditorSession      transient navigation, focus, search, and expansion state
```

Only `ProjectDocument` is persisted. Simulation output, findings, candidate
lists, canvas positions, selected tabs, and history controls do not enter it.

## Core Terms and Ownership

`Room Declaration` is an immutable catalog fact keyed by game room name. It
owns kind, authored or derived mode, exits, requirements, force, caps, an
Encounter Envelope with exact slot bindings, incoming reward binding,
local-child descriptors, and complete declaration defaults.

`Room Occurrence` is one repeatable persisted appearance of a declaration in
one biome. It owns an opaque `occurrenceId`, selected `gameName`, and complete
occurrence-local room state. Several occurrences may use the same declaration.

`Exit Decision` owns one ordinary next-room source, its normal-door batch, and
the selection among its normal exits.

`Normal-door batch` owns batch reward-store state, batch-specific state such
as H cage outcome, and target references. Its target keys are declaration-owned
physical or semantic exit keys, never rendered indexes.

`Hub Decision` owns N's persistent board: fixed-slot open references, ordered
visits, and completion predicate. It does not own N Preboss room-local state.

`Local Visit Decision` is parent-occurrence-owned topology for one declared N
side-room group. It owns generated/not-generated slot membership and ordered
references to the entered side occurrences. Each referenced side room is an
ordinary `RoomOccurrence` that owns its own encounter, payload, `roomActions`,
and outgoing/return stage; the parent does not own a nested action list.

`Preboss` is a Room Declaration role inside a normal-door batch, not a
separate decision variant. Offering it does not complete a biome; selecting it
does. Boss and optional Postboss rooms are catalog-derived completion tail
rooms, not authored decisions or occurrences.

Topology owns occurrence relationships and decisions. Room state owns rewards,
Shop inventory, one occurrence-owned Room Action order, exact concrete
encounter selections, wheels, cages, and side-room state. The biome plan also
owns the structural Postboss `postbossRoomActions` order for a derived
completion owner. Sparse acquisition sites own optional generated payloads, not
a second chronology. UI state owns no domain topology.

## Route Scope

Routes persist a contiguous configured prefix in catalog order. Expansion
creates biome plans with `topology: null`; shrinking explicitly removes the
discarded plans and their state. `ConfigureRoutePrefix` is the only normal
scope-edit command and undo restores the prior snapshot.

```text
Underworld: [] -> [F] -> [F, G] -> [F, G, H] -> [F, G, H, I]
Surface:    [] -> [N] -> [N, O] -> [N, O, P] -> [N, O, P, Q]
```

Configured scope is not a claim that a biome is complete or simulation-valid.

### Route Loadout

Each route persists its weapon/aspect choice, mandatory starting keepsake, an
unordered canonical selection of manually active Arcana cards, and one
declaration-bounded rank for every Fear Vow. The catalog owns card order,
ordinary automatic-activation rules, Vow maxima, and Fear increments. The
authored model owns only the player's starting selections; derived automatic
cards and the configured Fear total are not persisted independently.

The closed route commands replace the complete manual Arcana selection or one
Vow rank. They validate catalog membership, static rank bounds, and the coupled
starting-Grasp capacity, preserve all topology and downstream authored state,
and participate normally in undo/redo. The codec enforces the same capacity, so
an authored starting loadout cannot retain an impossible manual selection.
Automatic cards and run-local Arcana grants are not part of this starting limit.
Other ordinary Vow gameplay effects remain outside these commands.

Circe's selected effect-backed offer detail is authored beneath its exact trait
option. `activateArcana` stores zero or one canonical card key, `promoteArcana`
stores a canonical distinct card set, and `disableFear` stores one Vow key.
The valid exhausted-domain empty result belongs to `activateArcana`. The codec
checks shape, catalog membership, option disposition, and canonical declaration
order, but does not evaluate current run eligibility. Dormant resolution detail
remains persisted when a user switches away from its owning option, so a later
switch can restore it.

Judgment stores one canonical distinct Arcana-card set on the exact derived
Boss-completion address for each authored biome. It is dormant unless Judgment
is active at that completion. This is a completion-local authored outcome, not
a synthetic room, reward, or topology edge.

### Keepsake Authorship

The route loadout's starting keepsake and each nonfinal F/G/H/N/O/P Postboss
completion own one exact chronological selection and one structural
`postbossRoomActions` order. A Postboss value is either `retain` or `replace`
with a catalog keepsake key. The value remains persisted while the configured
route has no successor, but it becomes reached only when another modeled biome
follows. I and Q own no final-route rack choice because no modeled consumer
follows them.

Every structural Postboss state defaults to a `useFountain` action. The
chronology is active only when that biome has a configured successor, so its
state is dormant on the configured route tail and reactivates if a later biome
is configured. Replacing a keepsake atomically adds the optional
`interactKeepsakeRack` action; retaining removes that action while preserving
any dormant keepsake-specific equip detail. The action order is the sole
chronology owner, and the structural completion address owns its findings and
history rather than a synthetic `RoomOccurrence`.

Selection legality is contextual rather than codec policy. Unknown keys are
malformed, while a structurally valid replacement that has already been
removed, conflicts with Fated state, or is blocked by prior Athena history
remains authored and repairable. Commands never silently convert it to retain,
delete it, or move its effect detail to another frontier.

Only immediate equip outcomes are persisted beneath a selection. Jeweled Pom
and Experimental Hammer use one closed `KeepsakeEquipResultAddress` family with
effect-specific complete children; the result is reached on start or
replacement and is dormant on retention or while another identity is selected.
Calling Card row actions stay on their exact trait offers, Time Piece conversion
choices stay on exact acquisition roles, and Fig Leaf/Gorgon results stay on
exact encounter phases. This preserves one semantic owner for every authored
effect decision rather than creating a keepsake-owned catch-all result bag.

Schema 30 gives Gorgon Amulet one strict phase-local Athena child. It persists
only three ordered distinct Athena trait identities and the selected option
key. Athena provider, offer kind, and reached rarity are derived; the Death
Defiance condition remains on the parent Gorgon phase. Keepsake rank and the
result of Cherished Heirloom are never authored: ordinary selection is fixed at
Epic and simulation derives both Cherished transitions from catalog facts and
canonical trait history.

Schema 38 introduced Echo's active authored children without adding effect state to
the project. Pom persists one selected greatest-level target or the explicit
empty-domain `null` result. Boon persists one to three distinct trait-key rows
whose giver identity and equipped rarity are explicit, plus only the selected
trait's declaration-owned acquisition detail. Reward persists only the exact
recreated acquisition's conversion, trait-offer, and level children; the
replayed source descriptor remains derived history. Gold uses the sole stable
`echoDoubleShopReward` key: its complete payload may persist sparsely in
`pickupEntries` before participation, and it enters the existing Shop
`roomActions.order` only when picked up. No source selector or source-keyed Gold
child is persisted. Gift's captured keepsake, replay schedule,
and replay count remain chronological trait history; only a reached
Experimental Hammer replay persists its selected-compatible or explicit
exhausted result beneath that succeeding biome's start address. Dormant Echo
option detail remains structurally retained but is not active authorship.

Schemas 39 and 40 give every Fields combat occurrence one closed `actionOrder`,
one selected optional-reward count, and complete retained optional-reward
values through the declaration's exact capacity. The action sequence contains
atomic cage completions and interactions with cage, active optional, and
Artificer-replacement pickups. Optional participation is sequence membership,
not a second boolean. Lowering the active count removes newly dormant optional
actions while retaining their values and dispositions; restoring the count
does not silently restore participation.

Schema 41 replaces the former `normal | gold` role state with one exact
acquisition disposition: `normal`, `timePiece`, or `artificer` with a complete
`RunProgress` replacement reward. The child belongs to its exact source and
acquisition role. Ordinary ordered acquisition sites represent its later
pickup with a collision-safe source-derived entry key; Fields uses its one
room-action chronology. Mandatory singleton room rewards derive their required
classification and pickup checkpoint, but activation/default reconciliation
persists the exact pickup reference in the occurrence's one shared
`roomActions.order`; there is no separate or synthetic one-row order. No
pending Artificer map or remaining-use counter is authored.

## Common Decision Model

```ts
type ExitDecisionSource =
  { kind: 'occurrence'; occurrenceId: OccurrenceId } | { kind: 'hubDecision'; decisionKey: string };

type ExitSelection =
  | { kind: 'derived' }
  | { kind: 'unresolved' }
  | { kind: 'normal'; exitKey: string }
  | { kind: 'additional'; additionalExitKey: string };

type AdditionalExit = {
  kind: 'zagreusContract';
  key: 'zagreusContract';
  occurrenceId: OccurrenceId;
};

interface ExitDecision {
  kind: 'exit';
  source: ExitDecisionSource;
  normal: NormalDoorBatch;
  additional: readonly AdditionalExit[];
  selection: ExitSelection;
}

interface NormalDoorBatch {
  kind: 'batch';
  rewardStore: BatchRewardStoreState;
  batchState: AuthoredBatchState;
  targets: readonly ExitTargetReference[];
}

interface HubDecision {
  kind: 'hub';
  hubKey: string;
  source: { kind: 'occurrence'; occurrenceId: OccurrenceId };
  openTargets: readonly HubTargetReference[];
  visitOrder: readonly string[];
}
```

An `ExitDecision` has at most one semantic source. Occurrence-sourced batches
belong to a layout's normal-decision policy, including N's bounded entry;
Hub-sourced batches belong only to N's completed-Hub Preboss handoff.

Selection belongs to the enclosing decision: a width-one normal-only batch uses
`derived`; a multi-target or sibling-additional decision may be `unresolved`;
`normal` selects one declared normal target; and `additional` selects one
closed sibling continuation. Additional exits are authored by the source
`RoomOccurrence`, while the active outgoing decision exposes that source's
closed siblings. Supported additional exits are a declared Zagreus contract
beside a Midshop's normal lane and declared natural Chaos beside eligible
N/F/G/P sources. Both remain source-occurrence-owned and are never synthetic
normal targets or generic cross-room-set escapes.

Decision-array order is not reachability authority. Decoding follows semantic
sources and selected targets to determine the selected spine. An unpicked
target is a real dead leaf but cannot own a downstream exit decision. Cycles,
detached decisions, duplicate sources, multiply-owned occurrences, and orphan
occurrences are contract errors.

Changing the picked target between compatible ordinary normal continuations is
one authored edit. If the previously picked target owns the next exit decision,
that decision is re-anchored to the newly picked occurrence while its complete
subtree remains intact. Occurrence identity and room-local authored state never
move between the two targets. The old target becomes a dead leaf and the new
target becomes the decision's sole semantic source. A continuation cannot be
re-anchored onto an additional exit or a terminal source. Additional exits and
their target packages remain with their original source occurrence, becoming
dormant when that source is unpicked and available again if it is reselected.

## Starts, Batches, Preboss, and Completion

The catalog declares either an `authoredChoice` start or a declaration-fixed
`fixedAuthored` start. `CreateStart` requires a selected game name for an
authored choice; it derives the fixed declaration and rejects substitution. F
has an authored Opening choice. G/H/I/O/P/Q have fixed Intros. N has fixed
`N_Opening01`.

Generated batches retain their layout's progression, reward-store, and
batch-state contracts. Q's candidate pools are checked on the selected spine,
not decision-array position. H's Fields result remains batch-owned. O can
derive a reward store from the active Ship wheel. I remains a normal Clockwork
batch: `I_PreBoss02` may coexist with normal peers but its one-creation-per-
source policy is declaration-owned.

### Empty decision envelopes

An occurrence-sourced normal batch with zero targets remains a supported
authored decision envelope. It has a stable decision address, remains on the
selected spine, may retain declaration-owned ordinary setup (such as a
reward-pool choice or H's Fields result), and is removable and undoable. It
does not add a persisted mode, discriminator, or schema variant.

The editor does not require authors to create that empty envelope as a separate
step. At an uncommitted exit frontier it projects the declaration-owned empty
shape without persisting a phantom decision. The first reward-pool, Fields
outcome, or ordinary target edit atomically creates the envelope and applies
that edit as one engine command and one history entry. A takeover choice uses
the corresponding atomic takeover creation command. Undo therefore returns
directly to the projected outgoing cards.

The envelope is not a realized ordinary generated batch. It consumes neither
ordinary batch/target progression nor a staged ordinal until its first
ordinary target is created. The engine can explicitly create the next envelope while
an ordinary slot remains. At the ordinary bound it can create one further
empty envelope only when the selected source and layout admit a declared
terminal resolution. F/G/H/O/P/Q admit a takeover Preboss; N admits its
required Hub candidate after the bounded PreHub stage; I admits neither because
its Preboss is an ordinary retained peer. These exceptions belong to
declaration-derived topology rules rather than the empty shape itself.

The supported Zagreus command may atomically create a selected Midshop's empty
normal envelope and append its closed additional contract to that Midshop
occurrence. The active envelope exposes the sibling beside its normal lane.
That incomplete normal lane remains authored and finding-backed until ordinary
targets are added; the additional exit neither consumes nor repairs normal
progression.

The first Door 1 choice resolves the envelope. An ordinary or
`retainNormalPeers` choice realizes an ordinary batch and must satisfy the
ordinary bounds at that point. A `takeOverNormalDoors` Preboss replaces the
empty envelope with its atomic batch, discarding ordinary-only setup and
initializing declaration-owned Preboss defaults. Undo restores the exact
empty envelope and any provisional setup; a takeover batch never consumes an
ordinary progression slot.

Takeover Preboss declarations F/G/H/O/P/Q own an atomic batch policy. A
takeover command receives one occurrence ID for every declared normal exit and
creates or repairs the whole batch in declaration order. The first target is a
Shop leaf; later targets are counted-free leaves only when the policy declares
them. A width-one policy has no later offer. Individual takeover targets are
not room-replaceable or capacity-repairable.

Selecting a Preboss derives completion. There is no persisted completion flag,
entry mode, or `closesBiomeWhenPicked` duplicate. The selected Preboss's
ordinary peers remain real unpicked occurrences.

## N Hub Progression

N is authored progressively:

```text
N_Opening01
  -> width-one normal exit prehub -> N_PreHub01
  -> exact empty terminal envelope
  -> source-bearing Hub decision hub
  -> completed-Hub exit preboss -> width-one N_PreBoss01 batch
  -> derived Boss and Postboss completion
```

The catalog bounds N's normal entry to one `prehub` physical exit and one
staged `N_PreHub01` target at biome depth 1. After PreHub reaches depth 2,
`CreateBatch` may create the exact zero-target terminal envelope.
`ReplaceWithHubDecision` atomically replaces that envelope with a Hub carrying
the PreHub occurrence as its source; `RemoveHubDecision` removes Hub-owned
state and restores the exact envelope. The Hub declaration owns the fixed
physical slot-to-room mapping, opening bounds and constraints, six distinct
ordered visits, side-room policy, restores, and the dedicated completed-Hub
handoff. An open slot creates one occurrence; its room identity is not
replaceable. Open unvisited slots remain real offered leaves.

The completed-Hub batch is permitted only after the declared open-set and
six-visit predicate holds. Its source is `{ kind: 'hubDecision', decisionKey: 'hub' }`, not
a rendered visit index or synthetic N completion owner.

Each entered main occurrence may own a `LocalVisitDecision` whose generated
targets are distinct side-room occurrences. Generation and visit order remain
parent topology, while each selected side occurrence executes its own room
lifecycle. Parent and Hub restoration preserve the canonical walk without
replaying either occurrence's already-settled actions.

Closing an unvisited slot below the declared open-set minimum retains the
already-authored visit sequence as an incomplete Hub board, but atomically
removes the completed-Hub batch and every descendant it owns. The handoff may
be authored again only after the board is restored to its completion predicate.

## Occurrence State and Replacement

Every occurrence begins with complete declaration-owned offer-time defaults and
complete static selections for each of its declaration's pool-backed potential
encounter slots. Fixed slots and slots in an empty Encounter Envelope carry no
redundant authored selection.
Shop inventory is entry-time state: selecting a Shop occurrence materializes
it; changing selection removes unselected inventory. Its materialized state
owns declaration-keyed offers. Exact `interactShopOffer` membership in the
occurrence's `roomActions.order` is both the Purchased fact and the purchase
order; no purchased set or Shop-private order is persisted. A counted-free
Preboss keeps its complete resolved offer regardless of selection.

An acquisition site is sparse occurrence-owned payload state for one exact
authorable lifecycle point. A declaration-produced pickup stores its exact
reward, trait-offer, and level-resolution children in the site's
`pickupEntries`; its participation and chronology are represented only by the
matching `interactAcquisitionEntry` in `roomActions.order`. Shop offers remain
owned by Shop inventory, while their matching `interactShopOffer` references
carry purchase participation and chronology. Mandatory singleton room rewards
derive required classification and lifecycle timing and create no redundant
persisted site state. Their activating semantic command nevertheless inserts
the exact required action reference into the occurrence's sole
`roomActions.order`; that row points back to the existing reward/acquisition
owner rather than copying its payload.
Declaration-derived supplemental entries, currently Gold Gold Gold's free Shop
duplicate and Travel Deal's refill, may own sparse acquisition-time children at
the site. A dormant payload may exist without participating; adding its fixed
Room Action reference alone joins chronology. Infernal Contract uses its own
fixed supplemental key and the same payload site rather than extending
declaration-owned Shop inventory.

`ReplaceShopPurchaseParticipation` inserts or removes one exact base-Shop
`interactShopOffer` reference. Generic Room Action insertion/removal rejects
that reference family so Overview's Purchased marker is the sole membership
interaction; ranked purchases remain movable with the ordinary Room Action
commands. Removing participation remains accepted for a retained stale
purchase after its Shop owner disappears, allowing exact repair without
deleting unrelated actions. `MoveRoomAction` changes one ranked action's
position within the complete chronology;
`ReplaceAcquisitionEntryOffer` edits only a declaration-compatible materialized
pickup. Neither command may infer entries from room names or rendered rows.
`EditDerivedShopEntry` atomically installs one engine-supplied complete default
for a dormant Travel or Gold row and applies one nested reward, trait, level, or
conversion edit without changing `roomActions.order`. `SelectDerivedShopEntry`
atomically materializes the same default and applies one engine-supplied
complete participation/order proposal. These are one shared command family,
not effect-specific state or a second Shop chronology.

The engine classifies every structurally active Room Action as required or
optional from the same action domain consumed by simulation. The semantic
command that newly activates a required reference inserts it in the
occurrence's order at the latest lifecycle-compatible position, preserving the
relative sequence of retained rows; one command and one history entry therefore
contain both the requested edit and its mandatory membership delta. Optional
actions remain membership-controlled by their existing owner. An active
required row may be moved within its legal range but cannot be generically
removed.

This guarantee is deliberately delta-only. A decoded or deliberately malformed
schema-50 document may already omit a required reference, and an unrelated edit
does not normalize that omission. Evaluation retains the missing-required
finding and publishes one engine-owned canonical restore intent. Dormant and
stale rows likewise remain authored until an explicit owning command removes
them; reactivation of the same key reuses its retained position rather than
adding a duplicate.

A Fields combat occurrence owns three related but non-duplicated products:
declaration-bounded cage reward values, a complete retained optional inventory
plus active count, and one mixed room-action order. That order alone owns cage
completion and pickup chronology. Cage interactions are required after their
matching completion; optional interactions are membership-controlled; and a
source selecting Artificer may add one later source-owned replacement action.
Commands and decoding use stable phase, slot, and acquisition-role identities,
never rendered ordinals.

`ReplaceOccurrenceRoom` preserves occurrence identity and reconciles only
declaration-compatible leaves. It never moves state to another occurrence or
guesses a reward. It resets incompatible state to complete defaults and cannot
bypass a staged candidate pool, fixed start/Hub identity, or atomic takeover
rule.

Route detours use narrower commands than general room replacement. An Anomaly
retains one normal G target occurrence identity, remembers its displaced G
declaration, and owns its retained incoming offer plus success state. A
Zagreus contract owns one `C_Boss01` occurrence as a declared additional exit.
Anomaly replacements, the Zagreus contract, and natural Chaos are the declared
detour ownership forms admitted by decoded topology. Anomaly and Zagreus each
have one declaration-owned automatic host return; selected natural Chaos
instead exposes one fresh, ordinary player-selected host continuation after its
Chaos room.

An Anomaly takeover preserves the target occurrence ID, incoming reward, and
remembered displaced G game name. It resets incompatible room-local leaves,
installs the declared Anomaly defaults, and never creates the remembered room.
Map changes retain that offer, outcome, and provenance. Revert restores the
remembered G identity, retains the offer, restores complete G defaults, and
removes the Anomaly continuation. An incompatible retained reward remains
authored and finding-backed rather than being silently rerolled or refunded.

The Zagreus command creates or extends the selected Midshop's ordinary decision
and appends a closed `zagreusContract` to that Midshop occurrence. Its active
decision exposes the sibling while preserving the normal lane and its
selection; a width-one declaration-derived normal selection becomes explicit
when the sibling makes selection ambiguous. Removing the sibling deletes only
its occurrence and descendants and restores that derived selection when
applicable. The additional exit is selected through the enclosing decision,
not represented as a synthetic normal target.

`AddNaturalChaos` attaches one declared `naturalChaos` sibling to an eligible
source occurrence; `ReplaceNaturalChaosMap` changes only that sibling's
concrete map within the host layout's declared domain, and `RemoveNaturalChaos`
deletes only the sibling and its descendants. Contextual spacing and source
requirements do not make the persisted gate undecodable: evaluation reports
them at its additional-exit owner. A selected Chaos room owns its fixed
`Empty_Chaos` encounter and direct `TrialUpgrade` reward, then its outgoing
ordinary decision owns the fresh host continuation.

Room-local commands address an occurrence and declaration-owned leaf key.
They cover incoming rewards, Fields cages, Ship encounter counts and wheels,
Ephyra side-room generation/order/rewards, Shop offers, sparse acquisition
payloads, and the exact occurrence-owned Room Action order. Leaf edits do not
rewrite topology.

### Trait Offer Outcomes

Every reward- or encounter-owned trait role persists one closed
`AuthoredTraitOffer` at its exact `TraitOfferAddress`. A `traits` outcome owns a
one-to-three tuple of distinct options and a selected key that addresses a
materialized position. A `fallbackGold` outcome owns only its giver; it has no
selected key, rarity, target, Circe resolution, or Death Defiance condition.
Only Olympian and Hermes givers support sparse or fallback outcomes. Defaults
for every giver remain complete three-option trait outcomes, and an upstream
edit may retain a context-invalid outcome for explicit repair.

`SpellDrop` uses that same `traits` shape at its existing `self` acquisition
role: exactly three distinct, rarityless options from Selene's ordered
eight-spell provider pool and one selected option. It is not a separate spell
offer model. Under Aspect of Selene, that persisted child is structurally
present but contextually dormant for the deferred Path of Stars outcome;
`null` is complete there, while a retained non-null child stays preserved for
reactivation after the aspect changes.

When the selected trait is All Together, that exact option additionally owns
one complete result keyed by its four declaration-owned sets. Each value is one
member of its pair or `null` for an exhausted pair. No generic direct-effect
bag, provider-history choice, or separate child offer is persisted. A semantic
command replaces one set result while ordinary trait selection and undo/redo
retain ownership of the complete outer option.

Natural Selection uses the same selected-trait outcome owner and persists one
nonempty ordered `naturalSelectionTargets` sequence of one to eight known trait
keys on the selected option. The sequence is the complete successful
round-robin allocation, not eight independent Pom choices. Echo Boon Boon
Boon's nested previous-run approximation may carry the same result. Ransom
outcomes persist no removal set or level total.

Steady Growth persists only reached random targets: ordinary occurrences use a
sparse `steadyGrowthTargetByPhase` map, while a derived Boss completion uses
`bossCompletionSteadyGrowthTarget`. A missing target is unresolved only at a
reached nonempty threshold; an empty target domain is a derived no-op. The
semantic `ReplaceSteadyGrowthTarget` command owns one exact phase/contact and
preserves retained invalid known keys for repair. Progress and threshold
settlement are derived from trait history.

### Concrete Encounter Selections

`RoomOccurrence.encounters.encounterKeyByPhase` persists the exact normalized
Encounter Definition key for every pool-backed potential slot of that room's
envelope. A generated N side room is an ordinary referenced occurrence and
keeps the same map on that occurrence. The parent-sourced local-visit decision
owns only generation and visit topology. The map does not store an Encounter
Set key, category sentinel, NPC family, or rendered phase ordinal.

Potential selections remain with their owning room through unpick/repick,
side-room generation and entry-order changes, optional-slot trimming, Undo,
and Redo. A structurally dormant slot emits no active control, candidate,
finding, history, counter, phase-owned reward effect, or NPC index row, but its
selection remains ready for reactivation. Replacing a declaration reconciles
only compatible stable phase keys and gives newly introduced or incompatible
slots their declaration defaults. Deleting an occurrence deletes its owned
selections; deleting its parent-owned local-visit target removes the same
occurrence and downstream state atomically.

An active retained selection may become context-invalid after a different
semantic edit. It remains persisted and repairable; the authored model never
falls back to another definition. `SelectEncounter` accepts an exact member of
the phase's declared Encounter Set at one structurally addressable occurrence
including a dormant or context-invalid selection.
`ResetEncounter` restores the set's static declared default even when that
default is dormant or currently invalid; it is a reset, not an automatic
repair.

An Encounter Definition may additionally declare one `traitOfferProducer`.
The owning room occurrence then persists its complete offer outcome
sparsely at `encounters.traitOffersByPhase[phaseKey][encounterKey]`. A trait
outcome contains one to three materialized options and a selected key that
addresses one of them; a `fallbackGold` outcome instead owns only the giver
and has no selected key or option-local children. Declaration defaults remain
complete three-option trait outcomes. Selecting that encounter installs its
declaration-owned default when no retained offer exists; selecting another
definition makes the prior offer dormant, and reselecting it restores the
retained value. Only the selected, active, entered definition publishes,
validates, or acquires its offer.

The exact encounter phase owns the offer's `TraitOfferAddress` with child role
`selection`. An option may retain an exact `targetTraitKey` only when its trait
declares a targeted acquisition. Dormant and unselected options may remain
incomplete or context-invalid; the selected targeted option must resolve to an
eligible equipped target before the offer can fold.

## Semantic Addresses

Addresses are immutable discriminated values. `semanticAddressKey` is a
canonical projection for maps and markers, not another identity source.

| Owner                             | Address                                                                     |
| --------------------------------- | --------------------------------------------------------------------------- |
| start and occurrence-local leaves | `OccurrenceAddress`                                                         |
| room-sourced decision             | `ExitDecisionAddress` with occurrence source                                |
| N handoff decision                | `ExitDecisionAddress` with Hub source                                       |
| normal target                     | `TargetAddress` with source and exit key                                    |
| additional continuation           | `AdditionalExitAddress` with occurrence ID and declared additional-exit key |
| decision selection                | `ExitSelectionAddress` with source                                          |
| batch reward store                | `BatchRewardStoreAddress` with source                                       |
| Hub board                         | `HubDecisionAddress`                                                        |
| Hub slot and visit                | `HubSlotAddress` and `HubVisitAddress`                                      |
| local reward and wheel            | occurrence plus declaration-owned child key                                 |
| N local visit topology            | parent occurrence, local group, and declaration-owned slot key              |
| pool-backed encounter phase       | `EncounterPhaseAddress` with occurrence owner and stable phase key          |
| derived completion                | `CompletionRoomAddress`                                                     |

`ContinuationAddress`, `PickedAddress`, fixed-entry addresses, parent-only
batch-store identity, and rendered target indexes are absent from the current
semantic-address union.

## Commands

Commands are semantic immutable transitions. Every successful proposal passes
through the project decoder before publication. A structural failure reports
its semantic owner and never leaves partial topology.

`applyProjectCommand(document, catalog, command)` accepts every transition that
is structurally representable. Command handlers may enforce exact semantic
ownership and address contact, catalog membership and declaration-owned static
domains, topology closure and bounds, fixed-versus-selectable slots, declared
set membership, and complete declaration-owned defaults. They do not consume a
project evaluation, candidate capability, history or reward branch, encounter
activation result, or contextual trait assessment. Contextual impossibility is
derived validation truth, so an authored value remains persisted until an
explicit semantic command changes or removes it.

Before decoding a successful proposed document, the command boundary compares
the structurally active Room Action domains before and after the edit and
closes only the newly required delta. This pure authored-domain step does not
invoke simulation or materialization. It may seed several newly active
occurrences or one Fields/Ship cohort atomically, but it neither repairs
pre-existing omissions nor removes rows made dormant by the command.

The command language includes project and route commands; start, batch, target,
takeover, selection, removal, and clear-topology commands; terminal Hub
replacement, Hub board and visit commands; and occurrence-local state
commands including `SelectEncounter` and `ResetEncounter`, plus the closed
Anomaly and Zagreus detour commands. The current union is defined by
`packages/planner-engine/src/authored-project/commands/types.ts`.

`RemoveExitDecision` explicitly removes its targets and downstream selected
subtree. Removing N's Opening decision therefore removes PreHub, its
source-bearing Hub, and any completed-Hub batch through persisted ownership.
Navigation and focus are not commands and do not enter authored history.

## Persistence and Validation

The portable document has exact keys, canonical catalog route order, and
stable indented JSON with a trailing newline:

```ts
interface ProjectDocument {
  schemaVersion: 52;
  projectId: string;
  catalogVersion: string;
  routes: readonly AuthoredRoutePlan[];
}
```

Unknown fields, malformed discriminants, wrong schema or catalog versions,
unauthorized cross-biome rooms, invalid leaf state, and malformed structural
ownership fail at decode contact. The codec preserves structurally
representable incomplete and context-invalid authored choices; simulation
findings, not fallback, describe context invalidity.

Persistence excludes filenames, Redux state, editor tabs, graph positions,
candidate sets, findings, simulation output, save baselines, autosave status,
and an alternate profile wrapper. The application profile session remembers
the selected file's basename for later saves; it is transport metadata, not
authored project identity.

## Undo and Redo

`ProjectHistory` holds frozen `past`, `present`, and `future` document
snapshots. One effective semantic command creates one history step and clears
redo. A no-op command retains history identity. Undo and redo restore exact
prior snapshots. Derived simulation and transient UI state remain outside this
history.

## Explicit Non-Goals

The authored model contains no generic special-exit placeholder, probability
score, RNG seed, game-profile predicate, generic graph edge,
rendered coordinate, React state, ImGui storage, silent repair, or guessed
fallback. Natural Chaos uses the closed additional-exit envelope; it does not
create a separate completion or layout-specific biome-plan family.
