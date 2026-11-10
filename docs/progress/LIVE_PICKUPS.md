# Part 2: live pickups

Status: framing and step C decisions settled by the owner (2026-11-10);
steps A and B's Draft half delivered and accepted on `live-pickups`; the run
import's half of B is decided and lands as C3; C1 and C4 delivered; C2's
engine core delivered with its test migration in progress; D not started. Temporary
plan; delete at delivery after promoting durable results. Follows the
progressive room Timeline and spawned-loot notices, both delivered.

You either interact with pickups or active objects.

## Engine changes

1. **No automatic placement of required pickups.** Edit settlement and
   default room state stop inserting spawned loot (the room reward collect,
   required deliveries, Echo gold, a rushed Shrine purchase's optional
   pickup); other required actions (cage completions, unlock presses, the
   fountain, Nemesis) keep theirs. A required pickup still loose past its
   deadline (the last slot its window and dependencies allow) is a finding,
   and the walk stops there: one finding per room naming what is missing, at
   the earliest deadline. An event is passed once it happens, even while
   items it spawned are unresolved; an unresolved spawned item stops the walk
   at its own row or deadline, never at the event that spawned it (C1).
2. **Live at Timeline position k.** The engine publishes what is live at k:
   loose pickups and active objects, each with its legal actions. The live
   row is that product at the walk frontier; the `+` at a gap is that product
   at that gap.

## Order

- **A.** The live-at-k product, a pure addition. Delivered: the
  [Live at a point](../design/ROOM_LIFECYCLE_MODEL.md#live-at-a-point) query,
  composed from the spawned loot, the room's published stop, the roster's
  proposals and the positioned commands' accepted indices (purchases and
  derived placements share one rule); no evaluation work, equivalence
  unchanged. Its witnesses (golden Underworld and Surface checkpoints) stand
  every reached row live at its own gap; in the shortest room of each action
  kind, the walk takes every offered placement and move at every gap through
  the frontier and takes none it was not offered at the gaps bounding each
  row's offered runs; each purchase and derived placement kind gets the same
  check; and a required row's deadline is the last gap the walk takes it at. Provisional classifications, current
  engine ownership, for the owner to confirm or change (classification, not
  structure):
  - Boss forced drop: a pickup (spawned-loot `requiredDrop`), required.
  - NPC and encounter contacts (Nemesis, Gorgon, Eris, field NPCs): actions on
    objects, required; what they drop is a pickup.
  - `completeFieldsCage`: an action on a `fieldsCage` object, required; the
    cage's reward is a caged pickup.
  - Hermes deliveries and Gold Gold Gold's duplicate: pickups at their derived
    host, placed by `PlaceHermesShrineDelivery` / `PlaceEchoGoldPickup` at any
    index the command accepts; required as the engine says today.
  - W8 rekey: deleted (owner, 2026-11-10); a reward swap replaces the item.

  Open items, temporary limits of today's walk and scope:
  - Not offered: a new door, cage, wheel, Well or Pool reroll, a Pool sale of a
    slot not yet chosen and a rack keepsake, each needing its own choice
    first; their rows are. Owner to decide whether the live row offers them
    (with the choice still to make) or they stay on their objects.
  - Gold Gold Gold's duplicate follows its source, the room's first World
    Shop purchase or Travel Deal refill whose item it can duplicate (C2); the
    witness pins that the walk refuses it earlier.
  - A choice's values (a blank Travel Deal item) are read where the room's
    reached actions end, not at the gap; the indices are value-independent.
  - Exported on the `simulation` entry with Draft, its first consumer.

- **B.** Draft and the run import author pickups from it, placing what they
  relied on being inserted.
  - Draft: a room's placement finding (required action, Hermes delivery, Gold
    Gold Gold duplicate) places, one at a time, each required pickup or object
    action live at the room's frontier by its offered command, the canonical
    restore when offered anywhere through the frontier, otherwise at the
    frontier. Since C1 every required row is offered at the frontier, so the
    canonical-schedule fallback is gone and the witness attributes every
    placement to an offered command. Against the old schedule, 105 of 110
    stripped golden rooms restore identically. The corpus is unchanged, since
    automatic placement still places these rows first.
  - Run import: required rows at the live product's canonical position
    (owner decision below); delivered in step C3.
- **C.** Remove automatic placement (change 1). Placements are persisted
  rows, so no saved plan needs migrating. Slices, each independently
  reviewed: C1 (delivered, awaiting review) the walk passes a spawning event
  while its spawned item is unresolved, clearing the pinned held cases and
  Draft's wheel-reward fallback; C2 removes writers W1-W6 (and, by a later owner decision, the W8 rekey), allows Remove and
  Reset of required rows, adds the missing-pickup finding wording and closes
  the Gold Gold Gold duplicate's order leniency; C3 the
  run import's half of B; C4 (delivered, awaiting review) Collect all
  required: an engine-internal settlement composition beside edit
  settlement (`collectRequiredItems`, one room); engine tests reach it
  through the `collectTestRequiredItems` test support. Its export lands with
  its first production consumer, whichever comes first: the Draft and import
  seam slice (S1), through `./simulation` and an
  `AuthoringSession.collectRequired`, or the planner's button in D. It moved
  an unplaced cage's or wheel choice's due point after the executable rows of
  its window the walk reaches before it, unless a required action of an
  earlier window is missing.
  Equivalence and Draft corpus lanes before and after; separate and
  revertible. Expected Draft output changes, from the stripped-room witness:
  - a room reward placed at the frontier, before the required drop
    (`collectRequiredReward`), where the reward's canonical index lies past
    the frontier (the Zagreus contract rooms);
  - Fields rooms completing every cage before collecting the cage rewards;
  - Hermes deliveries at the frontier rather than settlement's due contact.
  - Owner to confirm whether the reward-before-drop and cages-before-rewards
    orders are game-correct.
- **D.** The UI product as a whole:
  - the live row (one per Ship phase), placing through the engine's
    insert-at-index commands and query;
  - `+` and Reset on the Timeline spine as a gap menu: one control per action
    position; its menu lists what can be inserted there plus Reset from here
    (the engine command exists); hidden where nothing applies; which gap is
    open is UI-session state, never history;
  - removal of the Optional actions section (object pins later move onto
    their map objects);
  - chronology presentation: one chronology of events the engine announces
    (emphasized, may host choices), notices (Spawned, Unlocks, Delivered,
    Restock; quiet) and authored actions (handle and trash), with no rows
    nested under banners; ship phase tabs and the Combat order header stay;
  - two or three styling candidates (emphasis levels; optionally a moment's
    spawn chips folded into its event line) on an ordinary combat room,
    H Fields, an O ship room and a Postboss;
  - one copy pass.

## Also carried

- An engine-published reach/stop product, so the planner stops deriving
  `walkReached` and the room-stop cut from the walk's history (planner review
  follow-up).
- Rooms off the selected path hidden while the biome has a stop, shown again
  when it completes.
- Map clustering: each notice maps to one cluster per room at a display spot
  away from other markers, a generated default with a small hand-override
  table.

## Inventory

Inventory: pending (Part 2 step 0), recording the decision for each pickup
kind.

## Vision (owner, 2026-11-10)

Planning a room mimics playing it.

- **Existence is a game fact** the player does not control: items spawn on
  the ground, an NPC stands there, a delivery arrives when it matures, a shop
  exists. The engine announces it as spawn notices and lifecycle events.
- **Interaction is the player's**, in the order they choose: talk to the NPC,
  collect an item, unlock a cage, transform a Pom, buy. Only interactions are
  Timeline rows; placing a row places the interaction, never the spawn.
- **The live row** is a one-line snapshot of everything interactable at that
  point: Required items/NPCs | Optional items | Active objects. Clicking an
  icon performs that interaction as the next row; lifecycle events (encounter
  ends, doors open) then progress and the live row updates. The `+` at a gap
  is the same snapshot at that earlier point.

## Step C decisions (owner, 2026-11-10)

- **Owner-placed interactions:** the Boss forced drop, NPC/encounter contacts
  (Nemesis, Gorgon, Eris), the Fields cage unlock, Hermes deliveries and Gold
  Gold Gold duplicates. Settlement stops auto-placing deliveries and
  duplicates (they arrive automatically; their pickup is a row). Rooms are
  created without seeded rows.
- **Remove and Reset of a required row** are allowed: the item is live on the
  ground again and the walk shows its finding.
- The reward-swap rekey is deleted (owner, revised 2026-11-10): a reward swap
  replaces the item; the old item's rows go and the new item is live.
- A rescheduled Hermes delivery (due at another host) is a new item: it
  arrives with no choices, and the old item's chain goes with it. Due again at
  the same host, it keeps its choices.
- **Collect all required:** a simple command placing every required live
  item at its canonical spot; dropped if it feels bad in the planner.
- **Draft order:** Fields goes clear then collect, cage by cage. Boss rooms
  are like normal rooms, with no preferred order between the forced drop and
  the room reward.
- **Run import** (B's second half): required rows at the live product's
  canonical position. Independent rows' order does not change the end state;
  dependent rows produce different end states, which the end-room
  conformance catches.
- **Choice actions:** rerolls (door, cage, wheel, Well, Pool), Pool sales and
  rack keepsakes are listed on their object with an action that opens the
  picker on click. They appear only once their context is resolved (doors
  unlocked and door values settled; Pool slot resolved, otherwise "resolve
  first").
- **Engine work:**
  - the walk passes spawning events while their spawned item is unresolved,
    clearing the pinned held cases;
  - a new missing-pickup finding wording ("Collect X before …"), routed into
    Draft's `placeRequiredActions`;
  - close the walk leniency that accepts a Gold Gold Gold duplicate before
    its purchase;
  - remove Draft's wheel-reward fallback.

  Old saves are unaffected: placements are persisted rows.

## C2 contract changes for Draft and the run import

What the consumer pass starts from: every published engine entry or behaviour
Draft or the run import depend on that C2 changes.

- **No automatic placement.** No command, settlement or room creation places
  a row the owner did not place:
  - rooms are created with no rows (no Boss `collectRequiredReward`, no
    `useFountain`, no keepsake rack), and a replaced room keeps only its
    still-active rows, with no required defaults added;
  - a command no longer inserts the required actions it activates (incoming
    reward pickups, cage completions and rewards, wheel choices and rewards,
    contacts, generated pickups);
  - taking a trait no longer places its optional same-room drops (Quick Buck,
    Buried Treasure, Narcissus, a switch claim);
  - rushing a Shrine purchase no longer places its same-room pickup;
    `PurchaseHermesShrineOffer { rushed: true, index }` moves only the purchase;
  - `settleProjectEdit` no longer places due Hermes deliveries
    (`PlaceHermesShrineDelivery`) or Gold Gold Gold duplicates
    (`PlaceEchoGoldPickup`), and a displaced delivery is only unplaced.
    A consumer places every required row itself, from the live product or with
    `collectRequiredItems`.
- **Remove and Reset.** `RemoveRoomAction` accepts a required row,
  `UnplaceGeneratedDelivery` a reached valid delivery, and
  `ResetRoomActionsAfter` removes required rows; `settleProjectEdit` no longer
  refuses removing a required Gold Gold Gold duplicate or unplacing a valid
  delivery. The roster offers a `remove` proposal for every placed row (an
  `unplace` one for a cross-room delivery). The item is live again with its
  finding.
- **Reward swap.** The rekey is gone: `ReplaceIncomingReward` and settlement
  remove the old reward's pickup rows and place nothing; the new reward's
  pickups are live. A consumer places them like any required row.
- **Rescheduled delivery.** `PlaceHermesShrineDelivery` reuses a retained
  payload only from the host it places at; a payload retained at another host
  is dropped and the delivery arrives with its default reward; settlement
  removes a retained item whose delivery the walk has due at another host.
- **Keepsake rack.** An optional ordinary row: `InsertRoomAction` and
  `RemoveRoomAction` accept `interactKeepsakeRack` (removal clears the
  choice); the codec allows at most one rack row; `ReplacePostbossKeepsake`
  with a key appends the rack's use when the room has none; with no rack row
  the held keepsake stays. `RoomActionResetPlan.clearsKeepsake` is gone.
- **Gold Gold Gold source order.** The duplicate's row depends on its source
  (the first World Shop purchase or Travel Deal refill whose item it can
  duplicate), an authoring-only `afterAction`: insertion before it is
  refused and an authored row before it is out of order.
- **Findings.** `roomActionPlacementRequired`,
  `hermesShrineDeliveryPlacementRequired` and
  `echoGoldPickupPlacementRequired` carry deadline evidence: `deadline`
  (`action`, `encounter`, `phaseEnd`, `doorsOpen`, `leave`) with
  `deadlineAction` or `deadlinePhase`. The Gold Gold Gold finding now stands
  at its deadline (the walk passes the purchase that spawns the duplicate)
  rather than at the Shop's last purchase, and is withheld while the walk
  does not reach it.
- **New export.** `collectRequiredItems` (with `CollectRequiredOptions`,
  `CollectedRequiredItems`, `CollectRequiredStop`) on `./simulation`; its
  first consumer is the shared test fixtures' `collectTestRequiredItems`.
  `scheduleRequiredRoomActions` stays exported on `./authored-project`.
