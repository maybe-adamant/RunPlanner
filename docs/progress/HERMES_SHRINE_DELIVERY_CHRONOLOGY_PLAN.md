# Hermes Shrine Delivery Chronology Plan

## Status and base

- Status: locked for execution.
- Base commit: `4d4a705a feat(planner): author shrine rewards at delivery`.
- Intended persisted schema: 70.
- Catalog declarations and catalog version are unchanged except for the bounded
  room- and encounter-level Shrine encounter-use policy added in Gate A.
- This temporary plan is not linked from `README.md` or durable design
  authorities. Closure absorbs the lasting decisions and deletes this file.

## Objective

Make Shrine purchase configuration feature-local and make the concrete Shrine
delivery the only timeline participant.

The user-visible result is:

- checking **Purchased**, choosing delay, and choosing **Rushed** remain on the
  Shrine inventory row in Room Overview;
- an ordinary delayed purchase creates no source-room timeline action;
- a rushed purchase creates one required same-room delivery action;
- a matured or forced delayed purchase creates the same required delivery
  action at its reached host;
- Shrine sources and delivery hosts may be main-route, Hub side-room, or fixed
  completion occurrences; occurrence chronology, not parent-room topology,
  governs scheduling and maturity;
- Mystery Boon God selection, trait acquisition, Pom resolution, conversion,
  and order-sensitive history belong to that delivery row; and
- the timeline never contains a separate `Buy Shrine offer` action.

## Locked model

### Purchase and delivery are distinct authored facts

Shrine state owns the visible offer identity and sparse purchase configuration:

```text
offer identity + purchased + delay + rushed
```

Purchase configuration says whether and how an item is scheduled. It is not a
ranked room action. The engine derives pending state and the eventual host from
that feature state and reached lifecycle events.

A concrete delivery entry owns the delivered reward payload and acquisition
children. When due, it is a required `interactAcquisitionEntry` room action and
therefore participates in the occurrence's one action order. “Creates a
delivery action” means that the exact reference enters the active required
action domain; simulation never mutates authored order. An unranked reached
delivery blocks completion and is surfaced for the user to place.

### Rushed delivery is the planner's collapsed purchase boundary

The planner intentionally does not author separate purchase and rush actions.
One rushed delivery action represents:

```text
purchase + rush
  -> resolve first-rush Travel Deal refill
  -> spawn, deliver, and acquire the item
```

The first ranked rushed delivery is therefore also the first settled rushed
purchase. This is deliberate outcome authoring, not a claim that every game
callback is one event.

Travel Deal is evaluated immediately before acquisition of that first rushed
delivery. Consequently:

- Travel Deal already active at that prefix may create one refill;
- acquiring Travel Deal from the delivered reward cannot trigger itself
  retroactively;
- later rushed deliveries cannot trigger another refill;
- an ordinary delayed delivery never triggers the refill; and
- no second purchase order, trigger selector, feature-local ranking, or inferred
  physical-slot chronology is introduced.

If the generated Travel Deal refill is itself purchased, that purchase remains
feature-local and schedules its ordinary delayed delivery at the first-rush
settlement boundary. The refill cannot be rushed.

### Delayed delivery

An ordinary purchased item is scheduled once at the source room's
`postOutgoing` Shrine cleanup boundary. For profiles with outgoing generation,
that boundary follows it; for a Hub side room, it is reached before commit. It
does not decrement in that room. Qualifying later
encounter-end effects advance its countdown; forced final-Preboss completion
may make it due. Once due, its exact host-owned capability participates as a
required acquisition action; materialized payload detail is then retained at
that host.

Several delayed items may mature at one host. Their delivery actions share the
ordinary room order because their acquisition order can affect God pools,
trait legality, Mystery Boons, Poms, Hex state, and later rewards. Their common
maturity does not create a Travel Deal opportunity.

An eligible Hub side room is an ordinary Shrine source for this purpose. Its
purchase is scheduled from that side-room occurrence at its own cleanup
boundary. The source room does not consume one delay use. Ephyra side rooms
also do not advance older delayed Shrine uses: the catalog owns an explicit
`advancesHermesShrineDeliveryUses` room fact, with false overrides for every
Ephyra side-room declaration and a true normalized default for ordinary rooms.
The resolved encounter owns the same fact: combat-bearing encounters default
true, noncombat/story encounters default false, and exact exceptions such as
the combat-shaped O intro declare false. A countdown advances only when the
room and exact resolved encounter both permit it and the encounter was not
skipped. Later qualifying main Hub visits advance or host the delivery
according to the same encounter-end rules; the parent main room is neither the
source nor an implicit delivery host.

### A derived host must have a visible required footprint

A delayed delivery can become due at an occurrence that has no authored
`acquisitionSites` state yet. The engine-published due-delivery capability must
therefore be sufficient to expose one unranked required delivery row at that
host. Projection must not require a pre-existing acquisition site or pickup
entry as a prerequisite for showing it.

Placing that row uses one Shrine-specific semantic intent that atomically:

- materializes the declaration-owned default delivery entry at the exact host;
- inserts its `interactAcquisitionEntry` reference at the engine-owned canonical
  rank, after which ordinary timeline moves own player-selected reordering; and
- preserves the full source occurrence address in the delivery key.

Until it is placed, progressive evaluation blocks at that host before later
room actions or occurrences can observe a run state that omitted the required
delivery. The exact derived capability owns due status, source identity, and
fixed reward type; React does not infer any of them. A main-room source, a side
room source, and a fixed completion source all use this same transition.

### One order and one repair path

There is no Shrine-private action order and no shadow purchase rank. The only
persisted order that affects Shrine rewards is the occurrence's existing
`roomActions.order`, and it contains delivery entry references only.

Changing a purchase between rushed and delayed activates or deactivates the
same-room delivery action without relocating pickup-owned detail. Existing
schema-69 policy remains: dormant retained delivery detail may become active
again if its exact delivery point is restored, while Undo restores the complete
prior authored state.

An invalid retained purchase, refill, or delivery remains visible through its
feature or delivery owner and receives findings. Repair must not require
recreating a removed purchase action.

## Ownership and implementation boundaries

### Hades II catalog

Shrine hosts, inventory groups, item requirements, and delay bounds do not
change. The catalog adds normalized room- and encounter-level
`advancesHermesShrineDeliveryUses` facts. Ordinary rooms default true and every
Ephyra side-room declaration is false. Combat-bearing encounters default true,
noncombat/story encounters default false, and O's combat-shaped Intro is an
explicit false exception. The engine must require both facts rather than infer
Shrine advancement from encounter depth, Hammer-use behavior, or the mere
existence of an end-effects event.

### Planner engine: authored model and schema

Schema 70 removes `purchaseHermesShrineOffer` from `RoomActionReference` and
all action keys, codecs, domains, labels, and roster derivation.

`SetHermesShrinePurchase` continues to own sparse purchase state. Its action
effects become:

- delayed or removed purchase: no active same-room delivery action;
- rushed initial purchase: ensure the source-room delivery entry exists and
  ensure its exact `interactAcquisitionEntry` reference is active;
- changing rushed to delayed or removing the purchase: remove that active
  reference while retaining existing dormant entry detail; and
- Travel Deal refill purchase: never create a source-room action.

Removing an ordinary Shrine clears its active same-room delivery references
with the feature. Existing dormant detail follows the repository's current
non-destructive leaf policy and must not become an executable orphan.

The schema-69-to-70 migration replaces each ranked rushed Shrine purchase
reference in place with its exact same-room delivery-entry reference. Delayed
and refill purchase references are removed. Relative order of every unaffected
action and every converted rushed delivery is preserved. Migration must be
idempotent under the strict schema harness and must not invent reward payloads
beyond the schema-69 delivery defaults already owned by the source offer.

### Planner engine: lifecycle and simulation

The lifecycle publishes one non-authored Shrine scheduling checkpoint in every
reached Shrine-owning occurrence, including a visited Hub side room,
immediately before `postOutgoing` actions are drained. This is after outgoing
generation where the lifecycle profile has it and before commit where it does
not. It schedules every purchased initial offer exactly once:

- delayed items enter pending delivery state;
- rushed items become due at their source occurrence and await the required
  delivery reference activated by the purchase command; and
- the source room does not consume a newly scheduled delay use.

The exact internal event or transition must remain Shrine-specific and return
its complete branch/findings product. It must not become a generic scheduler,
effect registry, ambient callback, or second room-action system.

`interactAcquisitionEntry` becomes the sole reached transition for both rushed
and delayed Shrine delivery. It must:

- validate the exact due delivery and retained reward type;
- resolve first-rush Travel Deal before the first same-room rushed acquisition;
- schedule a purchased refill when that refill is valid;
- settle the required pickup through the existing free-pickup lifecycle;
- publish reward-producer, trait-child, level, and conversion frontiers at the
  delivery owner; and
- consume the pending/due entry only after that delivery settles on a branch.

Same-origin Shrine delivery entries are no longer suppressed from room-action
roster derivation. Their action window is post-outgoing. A delivery whose source
is another occurrence preserves the exact `encounterPhaseKey` carried by the due
capability from the encounter-end event that matured it; the room-action domain
maps that reference to the matching encounter-end window. This phase is
persisted only after the delivery is due, so it is not future host authority.
Stale dormant source-room entries remain excluded unless the matching purchase
is currently rushed. Ordinary non-delivery cleanup remains at the final
after-combat window.

When a cross-occurrence delivery becomes due, the progressive engine publishes
the exact required-action capability and blocks at that host until the
Shrine-specific placement intent materializes and ranks it. This capability
must be published even when the host has no authored acquisition-site object.
It extends the existing derived-acquisition seam; it does not introduce an
application-owned action domain or a generic runtime-to-authored synchronizer.

Delete the atomic `hermesShrinePurchase:*` acquisition path and the special
purchase-owned rushed producer frontier after the delivery path owns all of
their consumers. Do not retain a forwarding or compatibility runtime path.

### Planner application and React

Room Overview continues to render all three Shrine offers and the Purchased,
Delay, and Rushed controls. These controls mutate Shrine feature state only.

Room Timeline renders concrete delivery rows:

- `Receive <item>` for a rushed same-room delivery;
- the same delivery vocabulary at a matured/forced host, with a concise delayed
  provenance hint only if useful;
- required participation with no trash shortcut or second purchase checkbox;
  and
- the ordinary reward payload, trait, level, and conversion controls owned by
  the acquisition entry.

For a newly due delayed delivery, the timeline renders the engine-published
required row before an authored acquisition site exists. Ranking that row
dispatches the one atomic placement intent. The workspace must not hide it
behind a reward-editor visit or require the user to manufacture an empty site
first.

Remove purchase-row projection, `Buy Mystery Boon`/`Buy <item>` action labels,
purchase-owned reward-control lookup, and purchase-specific timeline
participation policy. The Shrine overview checkbox remains the sole way to add
or remove purchase participation.

The existing Shrine route index remains an overview/navigation surface. It
does not gain ordering controls.

## Delivery gates and commits

### Gate A — Delivery-owned authored chronology

Implement the complete schema-70 vertical slice:

- authored reference removal and strict codec updates;
- schema migration with rank-preserving rushed conversion;
- purchase command activation/deactivation of delivery references;
- automatic post-outgoing purchase scheduling;
- unified rushed/delayed delivery settlement;
- first-delivery Travel Deal behavior;
- roster/window correction; and
- deletion of the purchase acquisition path; and
- mechanical migration of every checked-in schema-69 checkpoint JSON and
  manifest entry to schema 70, which is a hard Gate A dependency because the
  fixture loader strictly decodes the raw current schema.

The application may receive the minimum compile-preserving adaptation in this
gate, but Gate A is not complete while any persisted or executable Shrine
purchase action remains.

Primary tests:

- authored command tests for delayed, rushed, toggle, removal, and dormant
  detail restoration;
- codec and schema migration tests proving exact rank preservation;
- codec, command, and room-action domain tests proving exact due-phase
  round-trip, same-origin rush is post-outgoing, and delayed host delivery
  maps to its reached encounter-end window;
- Shrine simulation tests proving delayed scheduling without a source action,
  same-room rush settlement, and no source-room delay decrement;
- lifecycle tests for O phase-1/phase-2 and Fields exact encounter-end
  settlement, including multiple same-phase deliveries in authored order;
- a Hub side-room test proving a purchase in `N_Sub10` is sourced from that
  occurrence, the side-room encounter does not advance it, and a later main Hub
  visit becomes its exact delivery host;
- catalog regression witnesses proving the Shrine encounter-use facts cover
  ordinary rooms, every Ephyra side-room declaration, O Intro, O Devotion,
  O Story, and `PreHubGeneratedN` independently of encounter depth;
- progressive chronology tests proving an unplaced due delivery records its
  finding and capability but stops before later actions/occurrences, then
  resumes after the atomic placement intent;
- progressive tests proving a due delivery with no authored acquisition site
  blocks at its host and the atomic placement intent materializes and ranks the
  exact source-keyed entry;
- two-rush Travel Deal tests proving the first ranked delivery alone triggers
  refill and a delivered Travel Deal cannot trigger itself; and
- multiple-delivery tests proving one host order controls Mystery God/trait
  consequences without creating a refill.

Intended commit: `refactor(engine): make Shrine delivery chronological`.

### Gate B — Editor workflow and product witnesses

Complete the user-facing adoption:

- keep purchase configuration entirely in Room Overview;
- replace purchase timeline rows with delivery rows;
- retain contextual reward repair and direct God-step editing on delivery;
- ensure required delivery rows have no optional-action deletion control;
- update action labels and route navigation destinations; and
- remove obsolete purchase-row application projections and tests.

Primary tests:

- Shrine workbench: delayed purchase creates no source timeline row;
- Shrine workbench: rushed purchase creates one `Receive` row and toggling Rush
  removes/restores it without losing retained payload detail;
- Shrine workbench: an unplaced delayed delivery exposes only its atomic
  placement action, then gains ordinary reward editing after placement;
- structured-workspace contract: a matured delivery points to its host action
  and source Shrine overview remains navigable; and
- product loop: author a Mystery God and trait, save, reload, and repair it after
  an upstream God-pool change. Generic room-action ordering witnesses and Gate
  A's multiple-delivery/Travel Deal tests remain the owners of those unchanged
  policies.

Intended commit: `fix(planner): present Shrine deliveries in room order`.

### Gate C — Fixture and authority closure

Gate A updates the canonical `surface-no-hermes-shrine-delivery` checkpoint as
part of schema and chronology closure. Gate C adds one compact N checkpoint for
the side-room source seam rather than copying a large editor save. Together the
checkpoints must contain:

- one rushed source-room delivery action;
- one delayed delivery with no source-room action;
- a reached host delivery ordered against another trait-sensitive reward; and
- Travel Deal resolved by the first rushed delivery.

The N checkpoint must prove a side-room Shrine purchase has no source-room
delivery action, preserves that side-room occurrence as its source identity,
and produces a required delivery footprint at the later reached host.
Its application witness must then prove that the empty host exposes the
unranked placement row and that source-Shrine and host-delivery navigation each
retain their own occurrence owner. This witness lives here because the existing
full-N fixtures do not reach a newly added side-room Shrine lifecycle; the
compact reached checkpoint is its truthful prerequisite.

Absorb the stable disposition into:

- `docs/design/AUTHORED_PROJECT_MODEL.md`;
- `docs/design/ROOM_LIFECYCLE_MODEL.md`;
- `docs/audits/room-features/ROOM_FEATURES_GAME_DATA_AUDIT.md`;
- `docs/audits/rewards-and-acquisition/ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md`;
- `docs/progress/IMPLEMENTATION_PROGRESS.md`; and
- `docs/progress/MIGRATION_PROVENANCE.md`.

Delete this temporary plan in the same closure commit. Run one complete
repository gate after all narrow tests and review fixes are stable; do not
repeat it for documentation-only adjustments.

Intended commit: `docs(planner): close Shrine delivery chronology`.

## Review routine

Each implementation gate uses a fresh executor and fresh independent reviewer
under the repository's multi-agent gate routine. The main session retains
oversight and performs the final bird's-eye diff review. Review must explicitly
audit:

- no remaining persisted, decoded, projected, or executed Shrine purchase
  action;
- no second purchase order or Travel Deal trigger selector;
- no duplicate rushed and delayed settlement paths;
- no reward payload retained on Shrine inventory;
- no React-owned lifecycle or Travel Deal policy;
- no generated delivery that can be deleted as an optional action;
- no derived delivery hidden merely because its host lacks an authored
  acquisition-site object;
- no substitution of a Hub parent occurrence for a side-room Shrine source;
- no migration rank drift; and
- no generic scheduling abstraction introduced for this one feature.

## Excluded scope

- Stygian Well, World Shop, and Purging Pool purchase/sale chronology.
- Gold, price, discount amount, affordability, or rush cost simulation.
- Random Shrine inventory or an Interact shortcut.
- Optional abandonment of a delivered item.
- Reauthoring delivery delay outside the Shrine feature.
- Persisting a future delayed-delivery host.
- Giving Hub side-room Shrines a separate scheduling or delivery model.
- Reordering or separately authoring purchase and rush.
- Unrelated catalog declaration changes, game-module work, or Dream-route expansion.

## Completion criteria

The plan is complete only when a project can express purchase configuration in
the Shrine overview, observe no purchase action in the source timeline, order
every concrete rushed or matured delivery exactly once at its acquisition host,
resolve Travel Deal from the first rushed delivery, preserve a visited side
room as a first-class Shrine source, surface a due delivery at an otherwise
empty host, and round-trip schema 70 without a compatibility or shadow purchase
path.
