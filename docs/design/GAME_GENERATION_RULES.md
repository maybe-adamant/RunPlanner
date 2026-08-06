# Game Generation Rules

## Scope

This document owns the shared generation contract used by the concrete biome
authorities. It defines candidate support, physical exits, creation and cap
semantics, ordinary batches, Preboss batches, retained-peer Prebosses,
completed-Hub handoff, reward-store ownership, and derived completion.
Concrete starts, room sets, exit types, lifecycle effects, and biome-specific
fields remain in the documents under `docs/biomes/` and the normalized
catalog.

`ROOM_LIFECYCLE_MODEL.md` owns the ordered within-room timing used by these
rules. The prior game-module implementation is evidence, not a production API.

## Candidate and door contract

The picker preserves possible and forced support, not probability. A room with
positive declared support is possible; a non-empty forced set excludes the
ordinary set for that decision. Room-set multiplicity is weighted game RNG and
is intentionally not simulated by the planner.

Physical exits are declaration-owned and processed in order. Creating a target
creates a distinct Room Occurrence immediately, so later exits can observe
earlier creation history. Repeated room game names are allowed whenever the
declarations admit them. A target's occurrence ID is topology identity; its
game name resolves catalog behavior.

Creation cap, appearance cap, force window, eligibility, and entered history
are different predicates. Production declarations must not smuggle an
unmodeled external save or profile predicate into one of them.

### Sequential creation and lifecycle boundary

Normal exits are created in physical declaration order. A target created for
an earlier exit contributes its creation facts before the later exit is
considered; it is not entered merely because it has been offered. This keeps
physical exit keys separate from selected traversal and prevents candidate
support from being inferred from a rendered branch count.

The common sequence is:

```text
resolve source and normal exits
  -> create target occurrences in physical order
  -> prepare declaration-owned room-local state
  -> select one normal target (or derive width one)
  -> enter and acquire only the selected target's entered effects
```

An offered counted target keeps its complete offer. An offered Shop keeps its
structural Shop state until entry. The detailed timing, including purchases,
is owned by [`ROOM_LIFECYCLE_MODEL.md`](ROOM_LIFECYCLE_MODEL.md).

## Ordinary batches

An occurrence-source `ExitDecision` owns one normal-door batch. The batch owns
its ordered target references, selection, batch field state, and (when the
layout declares one) reward-store state. A target owns its room-local reward,
shop, wheel, side-room, or Fields cage state.

`CreateBatch` and `CreateTarget` create ordinary shape progressively. Target
creation validates the source's current declaration-owned exit key. A source
room replacement may retain structurally represented targets whose keys are no
longer supplied by the new room. Those targets are context-invalid rather than
silently deleted. `ReconcileBatchExitCapacity` is the explicit topology-removal
repair: it removes unavailable targets and their downstream subtree, then
normalizes selection from the retained keys.

The retained-key rule is intentionally narrow. The codec accepts only normal
exit keys present in the biome's authored declarations (or the one fixed Hub
exit key); it never accepts an arbitrary string as a repair placeholder. A
narrower replacement remains representable, while a corrupt key such as
`banana` is rejected.

Ordinary progression bounds count only ordinary batches and their ordinary
targets. A takeover batch is the declaration-owned completion shape, not one
more unit of generated progression, so it never consumes H, O, or Q capacity.

An empty occurrence-sourced batch is an uncommitted decision envelope, not an
ordinary progression unit. It can be created at the next ordinary slot, and a
single extra envelope is admitted at the bound only when the exact selected
source has a declaration-admitted terminal takeover shape. The engine rejects
that exception for layouts such as I whose Preboss remains an ordinary peer.
The first ordinary target realizes the ordinary unit and checks its bounds;
selecting takeover replaces the envelope and leaves ordinary counts unchanged.

## Preboss batches

A `takeOverNormalDoors` Preboss is an atomic replacement of every normal exit
of one source. The command receives the complete declaration-owned exit-key
set. The first target owns the Preboss Shop state. Later targets own complete
free offers only when `remainingOffers` is a counted binding; a width-one or
`none` policy has no later offer.

The command reconciles existing targets by physical exit key, not a supplied
occurrence-ID order. A retained key keeps its occurrence ID and compatible
room-local state. New keys require new IDs. A caller may not move an existing
target ID to another physical door. Takeover shape, selection, and downstream
cleanup are atomic through `CreateTakeoverBatch`,
`ReplaceWithTakeoverBatch`, and `ReconcileTakeoverBatch`.

If a source is replaced by a narrower declaration, prior ordered normal keys
remain structurally represented until `ReconcileTakeoverBatch` performs the
same atomic repair. It retains matching physical keys, removes unavailable
peers and descendants, and recalculates the selected Shop's entry state. It
does not permit a single takeover target to be edited in isolation.

A `retainNormalPeers` Preboss is different: it is an ordinary target beside
ordinary peers. Its selected declaration starts completion; unselected peers
remain normal topology leaves. Neither form introduces a separate completion
decision family.

### Shared source support

For a generated source that admits `takeOverNormalDoors`, the engine evaluates
ordinary declarations and the takeover declaration from one source-owned
generation support set. Ordinary candidates and takeover candidates therefore
observe the same eligibility, creation/appearance caps, compatibility, and
forced-pool decision. A required supported takeover excludes ordinary choices;
an unsupported whole takeover shape is impossible rather than required.

Takeover support is reduced by the engine only after it has checked every
declaration-owned normal exit and the aggregate cap. Its published source-level
classification is `impossible`, `possible`, or `required`; per-exit pressure
is diagnostic evidence, not a UI rule. F/G/H/P can become required through
this policy. O/Q's declaration-fixed width-one terminal takeovers are required
by their fixed identity. I remains outside this family because its Preboss is
an ordinary target.

Takeover concerns normal exits only. A future additional special exit belongs
to the enclosing decision but is not replaced, counted, or selected by the
current takeover policy.

## Reward stores and leaves

Complete defaults are declaration-owned. An ordinary batch can provide an
authored base store, derive its store from the source's active offer point, or
provide none. A counted Preboss free offer resolves first from the Preboss
declaration's forced or individual store, then only from a compatible incoming
batch store. A forced `RunProgress` Preboss never inherits a parent
`MetaProgress` choice. This makes H's no-store normal batches well-defined and
keeps F/G/P preboss free offers on their authored RunProgress binding.

Shop inventory is entry-time state. Counted offers, Fields cages, and wheel
offers are complete creation-time state. A reward-wheel offer is a
`ResolvedRewardOffer` at its wheel offer key; replacing it installs that value
directly. Leaf commands address semantic owners, never rendered rows or
positions.

Selecting an ordinary or Preboss Shop target materializes its declaration's
inventory. Moving selection away may return that Shop to dormant structural
state when no entered inventory is valid for the new selection. This is a
topology-selection effect, not a React-only visibility convention.

## Hub handoff and completion

A Hub uses one `HubDecision` for its declaration-fixed slot membership and
visit order. Once its completion predicate holds, it owns a completed-Hub
width-one normal exit whose persisted source is
`{ kind: 'hubDecision', decisionKey }`. That exit creates the declaration-fixed
Preboss occurrence through the same batch language as other biomes.

Selecting any Preboss stops editable traversal and starts the layout-owned
derived completion sequence. Completion rooms are catalog declarations, not
authored occurrences or an alternate topology owner. A biome may omit a
postboss room when its completion descriptor says so.

### Completeness and validation

Structural validity and contextual validity are distinct. A project can retain
an incomplete batch, a dormant Shop, an unavailable target after source
replacement, or a later valid subtree behind an invalid frontier. The codec
preserves the first three when their ownership is structurally sound;
evaluation reports the contextual problem at its semantic owner and stops
progressive traversal at that frontier.

Commands are the only topology-removal authority. They reject partial takeover
shape, duplicate target keys, incompatible declarations, impossible selection
states, and edits to a dead leaf with downstream state. Undo and redo record
those semantic authored edits, not findings, focus, canvas positions, or
transient expansion state.

## Explicit exclusions

The canonical product does not model weighted RNG replay, combat-wave
composition, NPC event/interactions outside selected combat definitions,
Natural Chaos and other unsupported detours, optional player interactions, or
external profile gates. Each can enter only
with an explicit catalog/input model, authored owner, lifecycle rule,
validation behavior, and UI projection.
