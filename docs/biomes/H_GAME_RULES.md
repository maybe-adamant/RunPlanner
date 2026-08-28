# H Game Rules

## Scope and evidence

This document is the game-rule authority for Mourning Fields (`H`) under the
progressed-save static baseline with supported Nemesis combat. Shared generation and reward rules are in
[`GAME_GENERATION_RULES.md`](../design/GAME_GENERATION_RULES.md); the H room
and layout declarations own concrete candidates, exits, counters, and caps.

The route rules were checked against `RoomSets.lua`, `RoomDataH.lua`, Fields map
data, encounter data, `RunLogic.lua`, and `RoomLogic.lua` on 2026-07-18. The
optional-reward capacities, room chronology, and Artificer contacts were
rechecked on 2026-08-15; source details remain in the focused audit.

## Authored shape

- `H_Intro` is the fixed authored start.
- H has at most four realized ordinary Fields batches and seven ordinary target
  occurrences. Each Fields batch has explicit `cageOutcome` state (`min` or
  `max`) before targets can be authored.
- A FieldsCombat occurrence owns its declaration-bounded cage offers. Active
  and dormant cages remain stable occurrence-owned leaves; changing a room
  reconciles only compatible cage keys.
- It also owns a zero-through-capacity optional count, complete retained
  optional reward values, and one mixed action chronology for atomic cage
  encounters plus cage, optional, NPC/Gorgon, and Artificer-replacement
  interactions. One entered-room chronology owns them all;
  [`ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md`](../audits/rooms-and-routes/ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md)
  owns the source evidence.
- `H_PreBoss01` is an atomic takeover Preboss. For a two-door predecessor it
  creates a Shop occurrence on the first exit and a counted free-reward
  occurrence on the second. Its batch has no ordinary batch reward store, so
  the free offer resolves from `H_PreBoss01`'s authored RunProgress store.
- Selecting a Preboss creates the ordinary `H_Boss01` and route-position
  `H_PostBoss01` occurrences through fixed links.

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
they are neither discarded nor acquired.

The exact optional maxima are declaration-owned from the installed map assets:

```text
capacity 4: H_Combat01, 03, 04, 05, 06, 10
capacity 3: H_Combat02, 07, 08, 12
capacity 2: H_Combat09, 11, 13, 14, 15
```

Every count from zero through the concrete capacity is possible. The uniform
authored default is two because every supported map admits it; this is a
planner default, not a probability or minimum claim. Active optional slots
resolve sequentially on entry from the persistent 19-entry
`FieldsOptionalRewards` bag without sibling exclusion. Generation consumes the
bag whether or not a pickup is later taken, while unpicked optionals remain
history-neutral.

The order is:

```text
choose Fields cage outcome -> create normal-door targets ->
prepare each target's cage offers -> select one target -> enter its combat ->
generate active optionals -> execute its authored Fields actions
```

This keeps local cages distinct from the normal-door decision and from the
Preboss free reward. A counted cage offer consumes its declaration-backed
RunProgress support when its owning room is prepared; selecting another normal
peer does not recreate that room's cages.

The Passive phase is fixed entry evidence. The active cage count then creates a
fixed sequence of two or three ordinal encounter cycles. Authored cage order
chooses which cage occupies the first, second, and optional third cycle; it does
not change the fixed `Start encounter -> End encounter` skeleton. Each cage
action represents activation through completion as one indivisible planner
step, and the model deliberately excludes pickup interaction during an active
wave.

A cage reward cannot be interacted with before its matching encounter ends,
but leaving that reward unpicked does not block the next cage. Optional minor
rewards may be picked before the first cage, between completed cages, or after
the final cage. A phase-produced required contact that declares
`BlockFieldsEncounterStart`, including Gorgon Athena, must resolve after its
own encounter and before whichever cage is authored next. This barrier follows
authored cage execution order, not `Cage01`/`Cage02` declaration order.

After the final cage, every remaining required cage, NPC, and dependent
acquisition action must resolve before exit use. **Cleanup · Doors open** begins
at that exact readiness boundary. Eligible optional rewards and Artificer
replacement pickups may be ordered before or after Cleanup; future door-open-
only room features remain Cleanup-only. There is no cage-only order or
Fields-private acquisition fold.

The editor keeps cage and optional identities in Room Overview and renders the
single chronology in Room Timeline. Its engine-derived timeline brackets each
ranked active `completeFieldsCage` with the exact ordinal Start/End boundaries;
an unranked retained cage is repair work, not an active encounter cycle. Room
Doors contains the unchanged outgoing decision. These tabs do not create a
Fields-specific order or move cage rewards onto door contracts.

### Depth, force, and completion facts

H keeps `biomeDepthCache`, `biomeEncounterDepth`, and room-history effects as
separate declared lifecycle axes. The lower Fields outcomes are possible at
the early optional depths; the maximum outcome support is required at the
later declared depths. Combat and miniboss force windows, the bridge's fixed
place after the ordinary Fields body, and the Preboss pressure are catalog
facts rather than UI ordering rules.

The bridge contributes its own declaration-owned Story behavior before the
atomic Preboss batch. `H_Boss01` and `H_PostBoss01` are ordinary declarations
created as persisted target occurrences through fixed links. Their transition
resets are applied only after the selected Preboss has entered.

### Baseline boundaries

The canonical H model preserves the progressed-save Fields route: physical
doors, cage bounds, optional-pickup capacities and persistent bag, the mixed
room chronology, forced windows, normal reward support, the bridge, the
WorldShop, and completion counters. `H_Bridge01` includes its fixed
`Story_Echo_01` encounter and supported Echo trait offer. The model does not
cover optional-pickup chance weights or map positions, pickup interaction
during an active wave, weighted room-set replay, other NPC/random-event or
unmodeled Shop interactions, combat-wave composition, rerolls, or
profile-dependent variants. Those are explicit future modeling inputs, not
hidden eligibility predicates.

H miniboss room declarations own their sparse boon-rarity override. It applies
to any eligible Olympian or Hermes offer materialized in the reached miniboss
room, not only to its declared incoming reward; the offer-local ledger consumes
the room fact while all other H room declarations remain unoverridden.

### Concrete encounter selection

Fields rooms use one complete `FieldsEncounter` envelope: `Passive`,
`Cage01`, `Cage02`, and `Cage03`. The selected Fields outcome structurally
activates a cage prefix while retaining inactive selections dormantly. Cage
rewards remain attached to their exact cage slots independently of the selected
encounter definition's depth effect.

`NemesisCombatH` is a member of `HEncountersDefault` only. It can therefore
resolve on an active cage, never on either Passive set, an inactive cage, the
bridge, Shop, or another non-cage room. Its exact-key requirements participate
in the same preparation history as every other concrete definition.
`NemesisRandomEvent` is instead a declared Passive choice presented as an
add/remove Room Feature: it requires its ordinary encounter interaction,
reserves one physical optional-reward position, leaves cage rewards untouched,
and retains an over-cap optional count for repair. Gold wager, Bridge Nemesis,
other unsupported NPC interactions, and unmodeled Shop interaction variants
remain outside the planner's modeled surface; the fixed Echo Bridge offer is
supported.

## Product boundary

The canonical product owns H catalog facts, authored Fields state, concrete
encounter selection, cage and optional offer generation, the action chronology,
shared acquisition dispositions including Artificer, semantic commands,
validation, candidates, and workspace projection. Declaration-supported
phase-produced NPC contacts and Gorgon Athena participate in the same room
chronology. Other NPC/random-event variants and unsupported player systems
remain outside the baseline until modeled explicitly.
