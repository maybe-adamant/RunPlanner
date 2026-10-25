# H Game Rules

## Scope and evidence

This document is the game-rule authority for Mourning Fields (`H`) under the
progressed-save static baseline with supported Nemesis combat. Shared generation and reward rules are in
[`GAME_GENERATION_RULES.md`](../design/GAME_GENERATION_RULES.md); the H room
and layout declarations own concrete candidates, exits, counters, and caps.
[Fresh File Rules](FRESH_FILE_RULES.md#h) own the first-attempt differences.

The route rules were checked against `RoomSets.lua`, `RoomDataH.lua`, Fields map
data, encounter data, `RunLogic.lua`, and `RoomLogic.lua` on 2026-07-18. The
optional-reward capacities, room chronology, and Artificer contacts were
rechecked on 2026-08-15; source details remain in the focused audit.

## Authored shape

- `H_Intro` is the fixed authored start.
- H completion is eligibility-driven. `H_PreBoss01` becomes required after four
  entered H combat, miniboss, or Bridge occurrences. Each Fields batch has
  explicit `cageOutcome` state (`min` or `max`) before targets can be authored.
- A FieldsCombat occurrence owns its declaration-bounded cage offers. Active
  and dormant cages remain stable occurrence-owned leaves; changing a room
  reconciles only compatible cage keys.
- It also owns a zero-through-capacity optional count, complete retained
  optional reward values, and one mixed action chronology for atomic cage
  encounters plus cage, optional, NPC/Gorgon, and Artificer-replacement
  interactions. One entered-room chronology owns them all;
  [`ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md`](../audits/rooms-and-routes/ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md)
  owns the source evidence.
- Optional participation is sequence membership, not a second boolean.
  Lowering the active count removes newly dormant optional actions while
  retaining their values, dispositions and compatible placement; restoring the
  count does not silently restore participation. Cage interactions are
  required after their matching completion and default after it and any
  required NPC interaction, before the next cage, while other actions retain
  their lifecycle defaults; optional interactions are
  membership-controlled; a source selecting Artificer may add one later
  source-owned replacement action.
- Each FieldsCombat occurrence also owns its exact physical layout: one player
  entry, one retained cage-point assignment per cage slot, one retained
  optional-point assignment per optional slot, and one retained Nemesis point.
  Only active logical slots consume points. Active cage assignments are unique
  within the cage-point family; active optional rewards and active Nemesis are
  unique within their shared optional-point family. Dormant assignments remain
  stable without reserving a point. Cage and optional reward identities resolve
  before placement validation; incomplete layout never withholds their
  definition or replacement candidates. Occupied points remain assignable for
  manual rearrangement: duplicates are repairable findings, not selection locks,
  and assigning a point never moves or clears another assignment. Declaration
  exclusions still restrict which points a placement can use.
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

After four qualifying H occurrences have been entered, the next normal decision
resolves only to the required `H_PreBoss01` normal-door takeover. An unresolved
Fields cage outcome is ordinary setup for that envelope and does not remove the
supported Preboss resolution; takeover discards that ordinary-only setup.
Additional exits do not satisfy this room-history requirement. A selected Chaos
gate still adds its room-history record and Fields depth effects, while
the abandoned normal batch does not consume one of H's four qualifying
progression steps. Returning from Chaos therefore exposes another Fields batch
until the fourth qualifying H occurrence has actually been entered.

## Fields constraints

The Fields declaration data separates room depth, encounter depth, room
history, forced windows, and cage capacity. Door creation is sequential, so
each target observes earlier peer creation history. The planner preserves
possible and forced support but does not model weighted room-set RNG or
unmodeled combat wave composition.

H normal batches use no outgoing reward store. Fields combat Room Declarations
expose their active cage group as the selected door's offer-reward surface;
the Preboss declaration supplies its own required resolved stores. Optional
Fields rewards, including optional MetaProgress, remain entered-room controls
and do not become part of that outgoing cage surface.

H normal batches therefore use base-store policy `none`: the game still
computes a generic RunProgress/MetaProgress value, but every supported target
is reward-free or resolves declaration-owned RunProgress provenance, so no
canonical consumer observes it.

H's absence of an authored store choice is not an absence of consequence. No H
door is rolled at all: `BaseH` declares `IndividualRewardStore = "RunProgress"`
alongside its `TargetMetaRewardsRatio` of `0.0`
(`RoomDataH.lua:331-332`), and every H room inherits both, the boss included.
An individual store beats both a forced override and any authored batch value,
so H's `0.0` target is dead for door stores. It lives only through the
denominator H fills: every entered Fields room banks a RunProgress entry into
the run-wide count, a pure non-MetaProgress mass. RunProgress is the only store
key H banks, which Run State reports in place of a target.

That mass is real but route-confined. H's successors on its own route are I,
whose count it inflates but whose doors never roll, and — under a Dream
itinerary only — a rolling biome mixed in after it. It never
reaches O or P: `Underworld` is `[F, G, H, I]` and `Surface` is `[N, O, P, Q]`,
two disjoint routes of which a project carries one, so on an ordinary Surface
run no H room has been entered at all. A Dream itinerary is the one context
that can mix biomes across routes, and therefore the one context in which H's
RunProgress mass suppresses `C` for a Surface biome.
Changing a source to a narrower room preserves structurally represented
overflow targets until the explicit `ReconcileBatchExitCapacity` command
removes unavailable exits and their downstream subtrees.

### Physical doors and cage lifecycle

`H_Intro` has one Fields exit. The supported combat and miniboss declarations
then expose their own one- or two-door Fields shapes; the bridge is a
declaration-owned one-door source. The room declaration, not a rendered
branch, is the authority for that physical width. A later source can observe
earlier peer creation, while only the selected peer enters the normal spine.

FieldsCombat rooms own bounded `cages` children: three complete RunProgress
counted reward values with Devotion excluded. Cage capacity, active-slot
limit, and the RunProgress binding are concrete declaration facts. The
surrounding batch owns one semantic Min/Max outcome, selected before targets
are authored, and each target derives whether its active prefix holds two or
three cages. A capacity-two peer can make both outcomes visibly activate two
slots, so room state never stores the active count as reward authority. Cages
outside the active prefix remain dormant authored leaves; they emit no
canonical offer or acquisition and are neither discarded nor acquired.

Offer resolution walks every generated occurrence in physical target order,
resolving its ordinary incoming producer before its active cage slots. Picked
and unpicked targets therefore share one counted-bag and Boon-source offer
history; an earlier miniboss Boon can constrain a later combat cage source.
Only active cage offers of the entered combat target can later be acquired, at
the exact authored interaction after the matching cage completion.

The exact ordinary optional-reward maxima are declaration-owned from the
installed map assets:

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
history-neutral: optional generation neither consumes `RunProgress` nor
changes history, and only a later interaction reaches shared acquisition
settlement. Refilling that bag is the ordinary append-one-full-set transition
and retains ineligible leftovers.

Nemesis does not mechanically subtract one from that ordinary maximum. Its
active placement occupies one member of the same optional-point family, so the
effective maximum is the lesser of the ordinary reward maximum and the number
of points left after reserving Nemesis. `H_Combat03`, `H_Combat04`, and
`H_Combat05` can therefore still host four optional rewards with Nemesis. On
`H_Combat04`, optional point `572886` remains valid for ordinary optional
rewards but is excluded from Nemesis candidates by the native distance rule.

The order is:

```text
choose Fields cage outcome -> create normal-door targets ->
prepare each target's cage offers -> select one target -> enter its combat ->
generate active optionals -> execute its authored Fields actions
```

The active cage reward controls appear on the outgoing door offer through the
selected room's declaration-owned offer binding, while their leaves and
chronology remain owned by that Fields occurrence. A counted cage offer
consumes its declaration-backed RunProgress support when its owning room is
prepared; selecting another normal peer does not recreate that room's cages.

On entering the selected room, native cage reward objects spawn in active
cage-list order, before the authored encounter/pickup sequence. An available
Vow of Forfeit use replaces the first Boon/Hermes object in that list with a
required Red Onion. The original offer still owns its bag/source evidence;
the replacement is a fixed acquisition outcome, not a new selectable bag
reward. Reordering cage combat or pickup actions cannot move the Onion, and
its pickup cannot consume Forfeit a second time. Unentered offered siblings
and dormant cages do not participate in this spawn pass.

Natively, Fields rejects a new cage while another required encounter or an
object with `BlockFieldsEncounterStart` remains active. It then runs the
selected cage encounter synchronously; only after completion does the cage
reward become available and the cage obstacle disappear.

The Passive phase is fixed entry evidence and creates no player-chosen cage
cycle. The active cage count then creates a fixed sequence of two or three
ordinal encounter cycles. Authored cage order chooses which cage occupies the
first, second, and optional third cycle; it does not change the fixed
`Start encounter -> End encounter` skeleton. Each `completeFieldsCage` action
is a grouped simplification of activation through synchronous completion:
derived `encounterStart` and `encounterEnd` seams bracket it, no modeled action
occurs between them, and the model deliberately excludes pickup interaction
during an active wave. The room lifecycle is:

```text
prepare all cage offers and encounter identities
enter room
materialize active Fields optional offers
apply Passive entry effects
run optional pre-combat actions
for each active cage in authored order:
  start the chosen cage encounter
  complete that encounter atomically
  run legal between-encounter actions
resolve every remaining required cage/dependent pickup
generate outgoing batch
publish exit usability and room features
enter Doors open
run any remaining eligible optional actions
commit and exit when chosen
```

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

The Fields action sequence is the room's only chronology, but it is not an
unconstrained list. The active cage count fixes the ordinal Encounter start/end
pairs, the ordered cage references assign cage identities to them, and flexible
actions occupy the room-entry, between-encounter, pre-door and post-door
Cleanup intervals according to their engine-owned availability. Every
interaction uses the shared acquisition settlement fold.

Selecting Artificer at a source interaction consumes the current `RunProgress`
bag and creates, but does not acquire, its source-owned replacement. A required
cage transfers its obligation to a later replacement action; an optional
Fields source may omit that action and leave the replacement behind. Several
conversions may therefore precede every generated replacement acquisition,
all within the same room chronology.

The editor preserves four distinct occurrence views. Room Doors authors the
outgoing decision and projects the selected target's active cage reward group.
Room Overview authors every phase's encounter and composition, optional reward
identities/count and Nemesis activation.
Room Layout is the sole editor for player entry and physical cage, optional,
and Nemesis assignments; reward and event identities shown there are read-only
context. Room Timeline retains the single mixed action chronology and brackets
each ranked active `completeFieldsCage` with the exact ordinal Start/End
boundaries. An unranked retained cage is repair work, not an active encounter
cycle. These views reference the same occurrence-owned leaves without creating
a second owner or chronology.

### Depth, force, and completion facts

H keeps `biomeEncounterDepth` separate from room history and the biome depth
cache that follows it. The lower Fields outcomes are possible at
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
doors, declaration-owned entry/cage/optional point sets, exact occurrence
assignments, cage bounds, optional-pickup capacities and persistent bag, the
mixed room chronology, forced windows, normal reward support, the bridge, the
WorldShop, and completion counters. `H_Bridge01` includes its fixed
`Story_Echo_01` encounter and supported Echo trait offer. Its native
`ForcedRewards` Story entry needs lifetime `RoomsEntered.H_Boss01`
(`RoomDataH.lua:800-817`), so on Fresh File the same forced room, with its
window and creation limit, is a WorldShop with the `BridgeShop` encounter and
no Echo action. The model does not
cover optional-pickup chance weights, visual map coordinates or pathfinding,
pickup interaction during an active wave, weighted room-set replay, other
NPC/random-event or unmodeled Shop interactions, combat-wave composition,
rerolls, or profile-dependent variants. Those are explicit future modeling
inputs, not hidden eligibility predicates.

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

### Native execution contacts

While the previous room generates its doors, the game builds an ordered
`CageRewards` array on each Fields target. After the selected target is
entered, `SpawnRewardCages` creates those already-selected cage rewards, rolls
and creates the optional rewards, and assigns their physical points. The
Passive encounter and each cage encounter are chosen by separate repeated
`ChooseEncounter` calls rather than `SetupRoomMultipleEncountersData`; every
cage in the resolved payload is a required encounter. Player entry has a native
exact start/end override, while cage, optional-reward and Nemesis placement
choose randomly from finite map point sets.

## Product boundary

The canonical product owns H catalog facts, authored Fields state, concrete
encounter selection, cage and optional offer generation, exact room-scoped
physical layout, the action chronology, shared acquisition dispositions
including Artificer, semantic commands, validation, candidates, and workspace
projection. Room replacement resets declaration-scoped spatial state rather
than carrying point identities into another map. Declaration-supported
phase-produced NPC contacts and Gorgon Athena participate in the same room
chronology. Static map visualization, other
NPC/random-event variants, and unsupported player systems remain outside the
baseline until modeled explicitly.
