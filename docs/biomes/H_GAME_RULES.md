# H Game Rules

## Scope and evidence

This document is the game-rule authority for Mourning Fields (`H`) under the
progressed-save, NPC-free baseline. Shared generation and reward rules are in
[`GAME_GENERATION_RULES.md`](../design/GAME_GENERATION_RULES.md); the H room
and layout declarations own concrete candidates, exits, counters, and caps.

The rules were checked against `RoomSets.lua`, `RoomDataH.lua`, Fields map
data, encounter data, `RunLogic.lua`, and `RoomLogic.lua` on 2026-07-18.

## Authored shape

- `H_Intro` is the fixed authored start.
- H has at most four realized ordinary Fields batches and seven ordinary target
  occurrences. Each Fields batch has explicit `cageOutcome` state (`min` or
  `max`) before targets can be authored.
- A FieldsCombat occurrence owns its declaration-bounded cage offers. Active
  and dormant cages remain stable occurrence-owned leaves; changing a room
  reconciles only compatible cage keys.
- `H_PreBoss01` is an atomic takeover Preboss. For a two-door predecessor it
  creates a Shop occurrence on the first exit and a counted free-reward
  occurrence on the second. Its batch has no ordinary batch reward store, so
  the free offer resolves from `H_PreBoss01`'s authored RunProgress store.
- Selecting a Preboss begins the fixed `H_Boss01`, `H_PostBoss01` completion
  tail.

The Preboss batch follows the predecessor's declaration-owned normal exits.
It is not a separate room family, and it cannot be edited one target at a
time. Reconciliation retains state only at the same exit key and allocates a
new occurrence ID only for a newly required key.

After four realized ordinary Fields batches, H admits one terminal zero-target
normal decision envelope. It resolves only to the required `H_PreBoss01`
normal-door takeover; a fifth ordinary Fields target remains out of bounds. An
unresolved Fields cage outcome is ordinary setup for that envelope and does
not remove the supported Preboss resolution; takeover discards that
ordinary-only setup.

## Fields constraints

The Fields declaration data separates room depth, encounter depth, room
history, forced windows, and cage capacity. Door creation is sequential, so
each target observes earlier peer creation history. The planner preserves
possible and forced support but does not model weighted room-set RNG or
unmodeled combat wave composition.

H normal batches use no outgoing reward store. Their room-local cage bindings
and the Preboss declaration supply the required resolved stores instead.
Changing a source to a narrower room preserves structurally represented
overflow targets until the explicit `ReconcileBatchExitCapacity` command
removes unavailable exits and their downstream subtrees.

### Physical doors and cage lifecycle

`H_Intro` has one Fields exit. The supported combat and miniboss declarations
then expose their own one- or two-door Fields shapes; the bridge is a
declaration-owned one-door source. The room declaration, not a rendered
branch, is the authority for that physical width. A later source can observe
earlier peer creation, while only the selected peer enters the normal spine.

FieldsCombat rooms own bounded `cages` children. Cage capacity, active-slot
limit, and the RunProgress binding are concrete declaration facts. The normal
H outcome selects the lower or upper supported cage count before targets are
authored. Cages outside that active prefix remain dormant authored leaves;
they are neither discarded nor acquired. The optional Fields reward behavior
that depends on unmodeled game-side conditions remains outside the baseline,
not an invented third outcome.

The order is:

```text
choose Fields cage outcome -> create normal-door targets ->
prepare each target's cage offers -> select one target -> enter its combat
```

This keeps local cages distinct from the normal-door decision and from the
Preboss free reward. A counted cage offer consumes its declaration-backed
RunProgress support when its owning room is prepared; selecting another normal
peer does not recreate that room's cages.

### Depth, force, and completion facts

H keeps `biomeDepthCache`, `biomeEncounterDepth`, and room-history effects as
separate declared lifecycle axes. The lower Fields outcomes are possible at
the early optional depths; the maximum outcome support is required at the
later declared depths. Combat and miniboss force windows, the bridge's fixed
place after the ordinary Fields body, and the Preboss pressure are catalog
facts rather than UI ordering rules.

The bridge contributes its own declaration-owned Story behavior before the
atomic Preboss batch. `H_Boss01` and `H_PostBoss01` are layout-derived
completion declarations, not persisted target occurrences. Their transition
resets are applied only after the selected Preboss has entered.

### Baseline boundaries

The canonical H model preserves the progressed-save, NPC-free Fields route:
physical doors, cage bounds, forced windows, normal reward support, the bridge,
the WorldShop, and completion counters. It does not model weighted room-set
replay, optional Fields rewards, natural Chaos, NPC replacements, combat-wave
composition, rerolls, or profile-dependent variants. Those are explicit
future modeling inputs, not hidden eligibility predicates.

## Product boundary

The canonical product owns H catalog facts, authored Fields state, semantic
commands, validation, candidates, and workspace projection. Persistent NPCs,
natural Chaos, anomaly detours, and optional player systems remain outside the
baseline until they are modeled explicitly.
