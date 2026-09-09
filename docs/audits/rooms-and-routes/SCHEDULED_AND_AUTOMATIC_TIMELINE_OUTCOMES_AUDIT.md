# Scheduled and Automatic Timeline Outcomes Audit

## Status and scope

Audited on 2026-09-08 against the current planner, execution-plan compiler,
and Plan Executor implementation.

This audit owns the cross-cutting lifecycle facts for effects which become
observable without a direct player action at the moment they mature. It checks
their complete path through:

1. the native game trigger;
2. catalog timing declarations;
3. simulator clock or lifecycle transition;
4. progressive findings and candidates;
5. authored placement or fixed automatic resolution;
6. room Timeline presentation;
7. execution-plan publication; and
8. the native execution contact and room-exit obligation.

It does not make every delayed state a Timeline action. That distinction is the
main conclusion of the audit: fixed automatic effects, scheduled acquisitions,
and passive counters need different products even when they advance at the
same encounter-end seam.

The source facts for individual traits, keepsakes, and Shrine inventory remain
owned by the focused trait, keepsake, room-feature, and acquisition audits.
This document owns only the shared scheduled-maturity and automatic-outcome
contract.

## Source anchors

The native lifecycle was checked against the installed Hades II scripts:

- `RoomLogic.lua:2870-3020`: encounter-end use reduction,
  `SkipRoomsPerUpgrade`, `CheckChamberTraits`, and ordering before exit
  readiness;
- `TraitLogic.lua:2870-2965`: `CheckChamberTraits`, timed pickup production,
  Steady Growth rarity application, and the deferred Embryo transformation;
- `TraitData_Demeter.lua:1894-1950`: Steady Growth's rarity-scaled
  `RoomsPerUpgrade` declaration;
- `TraitData_Icarus.lua:460-510`: Supply Chain's seven-encounter clock and two
  optional Pom Slice drops;
- `TraitData_Keepsake.lua:1916-1980`: Transcendent Embryo's eight-encounter
  replacement clock;
- `SurfaceShopLogic.lua:450-555` and `TraitData.lua:998-1020`: delayed Shrine
  purchase state, rushing, expiry, and native item materialization;
- `TraitData_Store.lua:15-30`, `282-315`, and `489-505`,
  `StoreLogic.lua:886-900` and `1206-1225`, `UpgradeChoiceLogic.lua:1128-1140`,
  and `RoomLogic.lua:4860-4890`: Extended duration conversion, Yarn and Hymn
  offer-time consumption, and Ixion's pre-room Chaos forcing;
- `CombatLogic.lua:3950-3990` and `MetaUpgradeLogic.lua:499-560`: boss-owned
  Judgment and Crystal Figurine Arcana application; and
- the Echo Gift Gift Gift contacts recorded in
  `../loadout-and-progression/ECHO_GIFT_GIFT_GIFT_KEEPSAKE_AUDIT.md`.

The stable lifecycle interpretation remains owned by
`../../design/ROOM_LIFECYCLE_MODEL.md`. Acquisition separation remains owned by
`../rewards-and-acquisition/ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md`.

## Closed vocabulary

### Scheduled maturity

The source exists before a later lifecycle checkpoint. That checkpoint either
advances a bounded counter or makes an independently modeled outcome due. The
outcome may be an invisible deterministic mutation, a fixed automatic result,
or a generated acquisition. These products may share one maturity ownership
area with signal-specific coordinators without becoming one result or Timeline
action type.

A direct event trigger belongs to this class when it has the same shape: the
source already exists and the later event makes its outcome due. Judgment and
Crystal Figurine therefore belong beside counter-based maturities even though
they do not count encounters.

### Pending pressure

The source must be consulted while a later event is being constructed. Its
canonical consumer reads the pressure before settlement and consumes one use
only when the qualifying event is actually realized. Yarn, Sacrificial Hymn,
and Spark of Ixion are the representative members.

Pending pressures share lifecycle invariants but not a production registry:
Yarn and Hymn participate in trait-offer settlement, while Ixion participates
in route topology and room-entry settlement. Moving them into maturity
coordination would require it to understand reward composition and topology and
would turn it into an event bus.

### Fixed automatic outcome

The game applies the modeled mutation inside a fixed lifecycle callback. The
planner must resolve the random target or result, but the effect is not a
movable Room Action and does not create a later pickup.

Current members are:

- Steady Growth;
- Transcendent Embryo transformation;
- Judgment; and
- Crystal Figurine.

### Scheduled acquisition

A source creates pending clock state. Maturity creates a concrete pickup at a
later lifecycle point. The pickup is a distinct acquisition action because the
player still interacts with the materialized object.

Current members are:

- delayed Shrine of Hermes deliveries; and
- Supply Chain's pair of optional Pom Slices.

### Deferred biome-start replay

Gift Gift Gift records a keepsake in one biome and lets the native game replay
it at the next biome start. Deterministic replay effects remain simulated state.
Only volatile Experimental Hammer and Transcendent Embryo replay results need
an authored target and an execution transaction.

### Adjacent automatic state without a scheduler row

Some state advances at encounter end but never creates an independently
interactable object or a target-selection callback. These remain native or
modeled counter transitions, not scheduler rows:

- Experimental Hammer expiry;
- Chaos curse clocks and blessing maturation;
- Stygian Well duration and consumption state;
- Medea's sim-neutral Magick growth; and
- other declaration-owned encounter-use expiry.

Other deferred state is consumed by a later concrete event rather than a
clocked insertion. Proper Upbringing activates on the qualifying element,
Olympian keepsakes and Moon Beam apply reward pressure to a later offer, and
Yarn, Spark, and Sacrificial Hymn alter their next eligible consumer. The
simulator tracks the parts which affect future legality, but none warrants an
automatic Timeline row.

Immediate producer-created pickups such as Quick Buck, Buried Treasure,
Narcissus drops, Sea Star duplicates, and Echo Reward Reward Reward are also
outside this scheduler class. Their producer and acquisition separation is
already covered by the acquisition audit.

## Effect disposition matrix

This matrix is complete for currently modeled effects that persist a counter,
pending use, or deferred result across a lifecycle boundary, plus the immediate
producer families needed to make the exclusion boundary unambiguous. It is not
an inventory of every numeric or sim-neutral trait in the game.

### Included scheduled maturities

These are the complete current members of scheduled-maturity ownership. Their
state, transition products, and settlement policy remain with their existing
domain owners.

| Effect                        | Registration                                                                                               | Advancing or due signal                                                         | Due product                                                      | Consumer                                                                  | Why included                                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Experimental Hammer           | Keepsake equip or volatile Gift Gift Gift replay records the exact granted Hammer and remaining uses       | Qualifying encounter end                                                        | Remove the exact granted Hammer when its counter reaches zero    | Deterministic trait-state mutation; no Timeline row                       | It is a counted lifetime already advanced at the shared encounter-end seam.                                                          |
| Chaos curse                   | Selected Chaos pair records the curse, blessing, and declaration clock                                     | The declared encounter, God-Boon-screen, or location signal                     | Remove the curse and activate its paired blessing                | Deterministic trait-state mutation; no Timeline row                       | It is one source with three supported clock signals and exposes why coordination must be signal-specific rather than encounter-only. |
| Modeled timed Well effects    | Purchasing Temporary Discount or Empty Slot Damage records one stacked positive encounter-use duration     | Qualifying encounter end                                                        | Expire exactly the stacked instance that reaches zero            | Deterministic Well-state mutation; no Timeline row                        | They share the encounter-end signal while retaining independent stacked instances.                                                   |
| Extended modeled Well effects | Consuming an active Extended purchase modifier creates an eligible modeled timed effect with two boss uses | Eligible boss defeat                                                            | Expire exactly the stacked instance that reaches zero            | Deterministic Well-state mutation; no Timeline row                        | The same effect family changes from an encounter counter to a boss counter; the signal is the clock, not wall time.                  |
| Shrine delivery               | Purchase records payload, source generation, and delay; a rushed purchase is registered already due        | Immediate rushed registration, qualifying encounter end, or final Preboss flush | One required acquisition at the exact due host and phase         | Existing derived acquisition frontier and ordinary acquisition settlement | It already has stable scheduling and is the reference placement path for generated acquisitions.                                     |
| Supply Chain                  | Acquiring the exact Icarus trait records repeating producer progress                                       | Qualifying encounter end; invalid timed-drop rooms hold the threshold           | Two independently optional Pom Slice acquisition frontiers       | Existing derived acquisition frontier and ordinary Pom settlement         | It is a repeating generated acquisition whose persisted identity must survive unrelated earlier edits.                               |
| Steady Growth                 | Acquiring the exact Demeter trait records its rarity-scaled interval                                       | Qualifying encounter end                                                        | One authored rarity target at the reached threshold              | Fixed automatic outcome                                                   | It is a volatile result at the same shared encounter-end seam.                                                                       |
| Transcendent Embryo           | Keepsake equip or volatile Gift Gift Gift replay records the blessing and progress                         | Qualifying encounter end                                                        | Replace the marked blessing with one authored same-rarity result | Fixed automatic outcome                                                   | It matures after the other chamber effects and therefore participates in shared ordering.                                            |
| Judgment                      | Active Judgment Arcana exists before the boss                                                              | Eligible non-final boss defeat                                                  | One ordered authored Arcana set                                  | Fixed `bossDefeated` automatic outcome                                    | It is an event-triggered maturity sharing the boss signal already needed by Extended Well effects.                                   |
| Crystal Figurine              | Equip or volatile Gift Gift Gift replay records one pending use                                            | Eligible non-final boss defeat, after Judgment                                  | One ordered authored Arcana set, then consume the pending use    | Fixed `bossDefeated` automatic outcome                                    | It is another event-triggered maturity and its order relative to Judgment is semantic.                                               |

The boss signal has its own fixed order: boss-counted Well instances advance
first, Judgment settles second, and Crystal Figurine settles from the resulting
Arcana state. The encounter-end order remains the separate order documented
below.

### Explicitly excluded adjacent effects

| Effect                                                                    | Existing canonical owner                                        | Classification                                      | Disposition and reason                                                                                                                                                                              |
| ------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extended Well purchase modifier                                           | Stygian Well purchase settlement                                | Pending pressure on the next eligible Well purchase | Keep outside. It is consumed while constructing the purchased item's duration; only the resulting timed item enters scheduled-maturity ownership.                                                   |
| Yarn of Ariadne                                                           | Trait-offer rarity construction and settled offer consumption   | Pending pressure                                    | Keep outside. It must affect rarity before the screen exists and survive an incomplete or ineligible screen.                                                                                        |
| Sacrificial Hymn                                                          | Trait replacement construction and settled offer consumption    | Pending pressure                                    | Keep outside. It must force the replacement domain before selection and is consumed only when a replacement screen is realized.                                                                     |
| Spark of Ixion                                                            | Route Chaos reconciliation plus room-entry settlement           | Pending topology pressure                           | Keep outside. It must create or satisfy the next hostable Chaos gate before room entry; scheduled-maturity coordination must not own topology.                                                      |
| Olympian keepsakes and Moon Beam                                          | Reward-pressure and reward-generation settlement                | Pending reward pressure                             | Keep outside. They influence which later offer is generated and are resolved by that offer's canonical settlement.                                                                                  |
| Aromatic Phial                                                            | Fountain action settlement                                      | Pending action modifier                             | Keep outside. The player action is the concrete event and owns the rarity target and use consumption.                                                                                               |
| Concave Stone, Calling Card, Fig Leaf, and Gorgon Amulet                  | Trait-offer or encounter settlement                             | Pending action/encounter modifiers                  | Keep outside. Each must shape its concrete screen or encounter before its result is known; they share no maturity consumer.                                                                         |
| Proper Upbringing and Vow of Forfeit                                      | Element or incoming-reward settlement                           | Immediate deterministic settlement effects          | Keep outside. They apply inside the event that satisfies their condition rather than becoming independently due later.                                                                              |
| Travel Deal and Echo Gold Gold Gold                                       | Shop purchase and generated-acquisition settlement              | Purchase-triggered producer/refill effects          | Keep outside. Purchase dependencies and the produced acquisition are already canonical actions, not clock maturities.                                                                               |
| Gift Gift Gift biome-start replay                                         | Biome-start keepsake replay settlement                          | Bounded deferred replay                             | Keep its existing focused path. It has one fixed biome-start boundary and no scattered clock or placement logic; its volatile Hammer/Embryo products register with the included families afterward. |
| Quick Buck, Buried Treasure, Narcissus, Sea Star, and Echo reward pickups | Source trait or NPC settlement followed by ordinary acquisition | Immediate generated acquisition                     | Keep outside. The object is produced by the source action without a later clock.                                                                                                                    |
| Sim-neutral numeric encounter effects and other unmodeled passive uses    | Native game                                                     | Native-only counter                                 | Keep outside. No modeled legality, authored result, or execution conformance consumes them.                                                                                                         |

The exclusion decision is about scheduled-maturity ownership, not whether the planner
models the effect. Pending pressures remain first-class domain state and must
continue to obey these invariants:

1. the source registers the domain-owned pending instance;
2. exactly one canonical consumer reads it before constructing the affected
   event;
3. incomplete and ineligible events do not consume it;
4. a qualifying realized event consumes exactly one instance;
5. removing the source retracts any derived authored structure owned by it;
6. pure replay reproduces the same pending and consumed state; and
7. modeled pending state remains available to Run State diagnostics.

## Shared contract

### One encounter-end transition owns all clocks

For each emitted `encounterEndEffectsApplied` event, the engine currently
applies effects in this order:

1. Experimental Hammer expiry;
2. Chaos clocks;
3. Stygian Well encounter-use expiry;
4. declaration-clocked pickup producer progress, currently Supply Chain;
5. Shrine delivery countdown;
6. Steady Growth progress and resolved rarity target;
7. Transcendent Embryo progress and resolved replacement; and
8. publication of Supply Chain and Shrine acquisition frontiers from the final
   surviving branches.

The last step is important. A generated pickup cannot expose a branch which a
same-seam automatic effect has already invalidated. It also means a pickup
which materializes during native `CheckChamberTraits` cannot be acquired early
enough to change another automatic effect at that same encounter end.

Catalog flags, not biome-name branches, control advancement:

- `ignoreEncounterUses` suppresses encounter-use clocks;
- `skipRoomsPerUpgrade` suppresses Steady Growth, Embryo, and trait pickup
  producer clocks;
- `skipTimedDropResources` holds a due Supply Chain drop at the threshold until
  a valid later encounter; and
- `advancesHermesShrineDeliveryUses` is required on both the room and concrete
  encounter phase before a delayed delivery advances.

Noncombat or declaration-owned `SkipEndEncounterEffects` phases do not emit
the transition. A Fig Leaf-skipped combat still does.

### Exact semantic ownership

Every reached random result has one semantic owner independent of rendered
position:

- Steady Growth and Embryo use occurrence plus encounter phase;
- Judgment and Figurine use occurrence plus boss phase;
- Supply Chain uses the producing trait acquisition identity, pickup key,
  maturity occurrence, and phase; and
- Shrine delivery uses source occurrence plus exact Shrine generation key,
  then records its due host and phase.

Candidates are derived from the exact simulation assembly. Branches must agree
on the same reachable frontier before the application can issue a placement or
resolution command. A retained authored value may be invalid, but the picker
must never fabricate support from a different branch or later occurrence.

### Fixed effects and pickups publish differently

Fixed effects are inserted after their immutable lifecycle boundary. They are
not part of `roomActions.order` and cannot be moved. Their exact target or set
is published as an `automatic` execution transaction and is an obligation at
its native callback window.

Scheduled acquisitions are ordinary acquisition transactions after maturity.
Scheduled-maturity simulation establishes where the object exists; the existing acquisition
stack owns Mystery Boon resolution, trait offers, Pom targeting, and other
payload behavior. The executor must not re-derive which source created the
object.

At room exit, any published obligation which was not completed is a mismatch.
The executor also compares the relevant conformance delta. This lets native
game logic own the clock while the executor only steers the random result or
acquisition payload.

## End-to-end assessment

| Family                         | Trigger and simulator state                                                                                                                                    | Candidate and authored contract                                                                                                                       | Timeline and execution contract                                                                                                                  | Assessment                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| Steady Growth                  | `CheckChamberTraits`; rarity-scaled progress; target mutation applied at `encounterEndEffectsApplied`                                                          | Exact eligible target intersection and interval; missing/unavailable findings retain the reached phase                                                | Fixed `automatic` transaction; executor scopes `AddRarityToTraits` to the declared source and target; room exit catches a missing callback       | Substantively closed        |
| Transcendent Embryo            | Eight qualifying encounters; old marked blessing removed and one same-rarity result applied after other chamber traits                                         | Exact blessing identities and declaration-owned magnitude domains; retained result is assessed against every branch                                   | Fixed `automatic` transaction; executor scopes `AddRandomChaosBlessing`, rarity, and processed values                                            | Substantively closed        |
| Judgment                       | Non-final boss defeat and active Arcana capacity                                                                                                               | Exact ordered Arcana set; Fates legality is evaluated as the set advances                                                                             | Fixed `bossDefeated` automatic transaction; native `AddRandomMetaUpgrades` selection is steered and counted                                      | Closed                      |
| Crystal Figurine               | Eligible non-final boss defeat after Judgment                                                                                                                  | Exact ordered Arcana set and rarity; candidate sees Judgment's preceding state                                                                        | Fixed `bossDefeated` automatic transaction with an explicit dependency after Judgment                                                            | Closed                      |
| Shrine delivery                | Purchased source stores delay and payload; a rush is due in the source room, exact qualifying phases decrement delayed items, and final Preboss can flush them | Exact due host/phase frontier; payload and Mystery Boon source resolve at acquisition; delayed reschedule is one source edit plus one exact placement | Required acquisition transaction keyed by delivery source; native pending-item copies carry that identity; normal acquisition adapters finish it | Closed                      |
| Supply Chain                   | Seven qualifying encounters; invalid timed-drop rooms hold progress at six; maturity exposes two optional Pom Slices                                           | Exact two-entry frontier with acquisition identity and phase; each accepted Slice is placed separately and uses ordinary Pom resolution               | Only accepted optional pickups are published; ordinary acquisition and level adapters consume them                                               | Stable-identity defect open |
| Gift Gift Gift volatile replay | Captured keepsake replays once at the succeeding biome start                                                                                                   | Exact Hammer or Embryo equip-result candidate; deterministic replay families require no authored volatile result                                      | Entry occurrence receives one `keepsakeReplay` transaction; native `EquipKeepsake` and the corresponding selector complete it                    | Closed                      |

## Findings

### 1. Scheduled source cleanup is correct, but Supply identity is unstable

The required invariant is:

> If an upstream edit removes or changes the source which authorized a
> persisted scheduled acquisition, the source mutation must atomically retract
> every active later-host action. Retained payload may remain only as dormant
> repair detail.

Shrine removal and room replacement retract every active delivery action whose
encoded source occurrence disappeared. Supply Chain replacement, Concave Stone
deactivation, and encounter-selection changes likewise retract only the active
later action owned by the lost semantic source. That source-removal behavior is
correct.

Supply Chain nevertheless persists the producing trait's simulation
`acquisitionIdentity`, which currently includes the global history sequence.
Generating an unvisited earlier N side room shifts that sequence while leaving
the Icarus source and its due Q occurrence unchanged. The two retained Pom
Slice keys then cease to match the derived frontier, producing
`rewardSourceUnavailable` and hiding their target controls.

**Disposition:** open for the scheduled-acquisition identity correction.
Persisted scheduled ownership must use the stable semantic trait acquisition
plus the declaration pickup key. Global sequence remains chronology evidence
only. A focused schema migration must rekey the retained acquisition entries
and their Room Action references without changing targets, participation, or
order. The existing signal-specific maturity transitions do not require
consolidation to correct this defect.

### 2. Same-phase automatic presentation preserves native order

The simulator, Timeline, and execution transaction product all apply Steady
Growth before Transcendent Embryo, matching the native rule that Embryo's
transformation is deferred until after the `RoomsPerUpgrade` loop. Neither is
a movable Room Action.

**Disposition:** closed with one canonical fixed automatic-effect projection.

### 3. Golden execution fixture exercises the scheduled lifecycle

One checked-in full-Surface execution fixture starts with Transcendent Embryo,
acquires Epic Steady Growth in N and Supply Chain from Icarus in O, schedules
rushed and delayed deliveries from the N and O Postboss Shrines, and continues
through P and Q. It carries Steady Growth and Embryo automatic transactions
into Q, hosts the delayed O Shrine delivery and a matured Supply Chain Slice in
P, and preserves every encoded source identity through a static encode/decode
round trip. It does not exercise insertion of unrelated earlier history and
therefore did not expose the open Supply identity defect.

Judgment and Figurine remain covered by the `automatic-boss` byte fixture;
Gift Gift Gift replay remains covered by its focused compiler and Lua tests.

**Disposition:** closed by the N-through-Q scheduled-lifecycle byte product.

## Durable conclusions

- Shared scheduled-maturity ownership with signal-specific coordinators is
  appropriate, but there should be no universal signal entry point, result
  union, or "scheduler action" model. Fixed effects, scheduled acquisitions,
  and passive counters retain meaningfully different consumers.
- Pending pressures remain with their canonical pre-event settlement. Shared
  invariants do not justify a generic pending-effect registry.
- Steady Growth, Embryo, Judgment, and Figurine must never become reorderable
  room actions.
- Shrine delivery and Supply Chain must continue through the ordinary
  acquisition machinery after materialization; their sources do not own the
  later trait/Pom interaction.
- Native code owns clock advancement. The executor only binds the exact
  published result and relies on the room obligation/conformance boundary for
  completion.
- Progressive candidates must be exact-assembly products. Structural key
  decoding is appropriate for preserving authored invalid states, but it is
  not sufficient authority for creating or retaining an active scheduled
  placement.
- Cross-room scheduled-entry cleanup belongs to the upstream semantic mutation. The
  execution-plan compiler remains a parser of a validated planner product and
  must not repair stale authored state.
