# Game Generation Rules

## Scope

This document owns the shared generation contract used by the concrete biome
authorities. It defines candidate support, physical exits, creation and cap
semantics, ordinary batches, Preboss batches, retained-peer Prebosses,
completed-Hub handoff, reward-store ownership, and fixed completion links.
Concrete starts, room sets, exit types, lifecycle effects, and biome-specific
fields remain in the documents under `docs/biomes/` and the normalized
catalog.

`ROOM_LIFECYCLE_MODEL.md` owns the ordered within-room timing used by these
rules. Game scripts and focused audits provide evidence; the external game
module is a consumer, not generation authority.

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

Batch and target creation, continuation changes (reanchoring), exit-capacity
repair and the retained-key codec rule are command behavior; the
[authored model](AUTHORED_PROJECT_MODEL.md#reanchoring) is their single owner.
Generation decides only which targets a source can offer.

Generated progression has no catalog-owned batch or target maximum. Candidate
declarations, entered history, and force pressure decide when it continues or
closes. Q's ordinary declarations use exact depth eligibility through depth 6;
at depth 7 only its required Preboss takeover is supported. N's one-step Hub
entry remains the only structurally bounded normal progression.

An empty occurrence-sourced batch is an uncommitted decision envelope, not an
ordinary progression unit. At that frontier the same generation authority can
offer ordinary declarations or a `takeOverNormalDoors` Preboss according to
their evaluated requirements and force. Selecting takeover atomically replaces
the envelope.

## Preboss batches

A `takeOverNormalDoors` Preboss is an atomic replacement of every normal exit
of one source. The command receives the complete declaration-owned exit-key
set. The first target owns the Preboss Shop state. Later targets own complete
free offers only when `remainingOffers` is a counted binding; a width-one or
`none` policy has no later offer.

The takeover commands and their minimal exit-capacity repair are owned by the
[authored model](AUTHORED_PROJECT_MODEL.md#takeover-batches).

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
is diagnostic evidence, not a UI rule. F/G/H/O/P/Q can become required through
this policy; O and Q differ only in their physical width-one takeover shape.
I remains outside this family because its Preboss is an ordinary target.

Takeover concerns normal exits only. An additional special exit belongs to the
source occurrence and is exposed by its outgoing decision; it is not replaced,
counted, or selected by the takeover policy.

## Reward stores and leaves

Complete defaults are declaration-owned. An ordinary batch can provide an
authored base store, derive its store from the source's active offer point, or
provide none. A counted Preboss free offer resolves first from the Preboss
declaration's individual or forced store, in that order, then only from a
compatible incoming batch store. A forced `RunProgress` Preboss never inherits a parent
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

## Hub handoff and fixed completion links

A Hub uses one `HubDecision` for its declaration-fixed slot membership and
visit order. It owns exactly one completed-Hub width-one normal exit whose
persisted source is `{ kind: 'hubDecision', decisionKey }`, created and removed
with the Hub. That exit holds the declaration-fixed Preboss occurrence in the
same batch language as other biomes; the Hub's completion predicate gates its
reachability, not its existence. The [authored model](AUTHORED_PROJECT_MODEL.md#n-hub-progression)
owns the Hub commands and board.

Selecting any Preboss stops editable traversal and realizes its fixed Boss and
route-position Postboss occurrences, when a Postboss exists. Those rooms are
ordinary catalog declarations and authored topology occurrences connected by
`fixedRoomLinks`; they are not an alternate topology owner or a normal exit
decision. A biome may omit a Postboss room when the route-position declaration
is `null`.

### Completeness and validation

Structural validity and contextual validity are distinct. A project can retain
an incomplete batch, a dormant Shop, an unavailable target after source
replacement, or a later valid subtree behind an invalid frontier. The codec
preserves the first three when their ownership is structurally sound;
evaluation reports the contextual problem at its semantic owner and stops
progressive traversal at that frontier.

Commands are the only topology-removal authority
([authored model](AUTHORED_PROJECT_MODEL.md#commands)). Undo and redo record
semantic authored edits, not findings, focus, canvas positions, or transient
expansion state.

## Explicit exclusions

The canonical product does not model weighted RNG replay, combat-wave
composition, NPC event/interactions outside selected combat definitions,
unsupported detours, optional player interactions, or external profile gates.
Natural Chaos, the Anomaly and the Zagreus contract are explicit detours whose
source facts live in the
[route detours audit](../audits/rooms-and-routes/ROUTE_DETOURS_GAME_DATA_AUDIT.md)
and the biome documents; P's Chaos source declaration adds its depth ceiling.
Other features can enter only
with an explicit catalog/input model, authored owner, lifecycle rule,
validation behavior, and UI projection.
