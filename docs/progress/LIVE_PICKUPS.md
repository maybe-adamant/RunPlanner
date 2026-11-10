# Part 2: live pickups

Status: framing and step C decisions settled by the owner (2026-11-10);
steps A and B's Draft half delivered and accepted on `live-pickups`; the run
import's half of B is decided and lands as C3; C1 in progress; D not
started. Temporary
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
   the earliest deadline. An event is then passed once it happens, even while
   items it spawned are unresolved; an unresolved spawned item stops the walk
   at its own row or deadline, never at the event that spawned it. Until
   then a missing required pickup stops the walk at its spawn.
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
  - W8 rekey: settlement-time only; the product is read-only and carries
    nothing about it.

  Open items, temporary limits of today's walk and scope:
  - While a required pickup is unplaced, the walk stops at the event or source
    action that spawns it, so the pickup may not be live where it could go: a
    deferred Ship wheel's reward (its encounter end waits on it), an
    Artificer's replacement, a Nemesis trade's result, a delivery due after a
    wheel reward, a Fields cage reward (the stop rewinds to room entry), and a
    Boss room's reward after its forced drop (the stop rewinds before the
    drop's row). The witness pins each by room, row and kind; C's walk change
    should turn each into an offer at its own gap and empty the pin.
  - Not offered: a new door, cage, wheel, Well or Pool reroll, a Pool sale of a
    slot not yet chosen and a rack keepsake, each needing its own choice
    first; their rows are. Owner to decide whether the live row offers them
    (with the choice still to make) or they stay on their objects.
  - The walk takes Gold Gold Gold's duplicate before the purchase that spawns
    it: its row has no order dependency on that purchase. The live product
    offers it only once spawned; the witness pins this leniency for C or the
    owner to settle.
  - A choice's values (a blank Travel Deal item) are read where the room's
    reached actions end, not at the gap; the indices are value-independent.
  - Exported on the `simulation` entry with Draft, its first consumer.

- **B.** Draft and the run import author pickups from it, placing what they
  relied on being inserted.
  - Draft: a room's placement finding (required action, Hermes delivery, Gold
    Gold Gold duplicate) places, one at a time, each required pickup or object
    action live at the room's frontier by its offered command, the canonical
    restore when offered anywhere through the frontier, otherwise at the
    frontier. A required row no action of the product names at any gap falls
    back to the canonical schedule; only a deferred Ship wheel's reward does
    today, pinned by the Draft witness for C to remove with that open item. The
    witness attributes every placement to an offered command or that pin.
    Against the old schedule, 105 of 110 stripped golden rooms restore
    identically. The corpus is unchanged, since automatic placement still
    places these rows first.
  - Run import: required rows at the live product's canonical position
    (owner decision below); delivered in step C3.
- **C.** Remove automatic placement (change 1). Placements are persisted
  rows, so no saved plan needs migrating. Slices, each independently
  reviewed: C1 the walk passes a spawning event while its spawned item is
  unresolved (clears the pinned held cases and Draft's wheel-reward
  fallback); C2 removes writers W1-W6 (W8 rekey stays), allows Remove and
  Reset of required rows and adds the missing-pickup finding wording; C3 the
  run import's half of B; C4 the Collect all required command.
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
- The reward-swap rekey stays.
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
