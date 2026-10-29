# Execution Protocol

## Contract

The strict execution protocol carries a complete-valid configured Underworld,
Fresh File or Surface prefix, through `F/G/H/I` (both Underworld profiles) or
`N/O/P/Q`, or a public Dream prefix. The game module reads one
[plan slot](PLAN_SLOTS_AND_PUBLICATION.md) at run admission and freezes the
decoded plan for the live session; publication does not hot-swap a live
session. Every admitted run except a Fresh File route runs on the plan's
[installed starting loadout](RUN_START_INSTALLATION.md#loadout-install). One
bounded mid-run attachment exists: a plan with a
[Practice mode start](RUN_START_INSTALLATION.md#practice-mode-start) admits at
the start of a fresh run that the module installs at a later biome's Opening,
or at a biome's Preboss or Boss. No other mid-run attachment or edited-plan
repair is supported; the only recovery after a mismatch is opt-in
[snap mode](RUN_START_INSTALLATION.md#snap-mode).

The compiler consumes the exact simulation assembly that the planner already
validated. It does not rerun candidate policy or duplicate validation. The
module strictly decodes this bounded artifact, translates its closed facts
through fixed native adapters, observes the player-controlled trace, and stops
enforcement at the first mismatch. The native game continues from that point;
neither side searches, repairs or replans.

The module's ModpackLib **Enabled** toggle gates admission: a run started while
it is off admits no plan and stays native. Turning it off mid-run abandons a
session that can still steer (starting, synchronized, or a completed prefix
whose run modifiers still act) for the rest of that run, never resumed by
turning it back on; a desynchronized, faulted or completed run keeps its
outcome. While it is off the room guide, planned-choice markers and victory
summary are hidden. Effects bound to an already installed run, such as the
profile restore, installed ranks and a Practice run's history exclusion, still
follow that run.

Runtime execution state is process-local and resets explicitly at new-run
admission. Only the loadout install's backup and installed ranks are saved with
the run. A freshly loaded game never re-attaches to an existing run; for an
installed run the status reports that it continues unsteered.

## Wire Boundary

The planner engine and its complete-valid evaluation document are the sole
authority for concrete acquisition semantics. Each acquisition event carries
its resolved offer, producer lifecycle and store provenance, generated-parent
provenance when applicable, concrete roles, and settlement ownership. The
compiler is only a lossless shape translator from that engine document to the
execution-plan wire: it may select records by their semantic addresses, require
branch agreement, encode addresses, and copy the exact selected trait and level
products. It must not derive domain meaning. If the wire needs another semantic
fact, that fact must first become an explicit engine product. In particular,
the compiler must not recover Artificer, Sea Star, Echo, or other producer
meaning from encoded keys, inspect authored room internals as a fallback, or
substitute a lifecycle point for producer provenance.

The editable project and execution plan are separate schemas. An incomplete or
invalid project can be saved, but it cannot be published. The wire carries
resolved game identifiers and semantic owners, never authored commands,
candidate products, findings, UI labels, callbacks, or Lua.

The protocol preserves concrete room and reward identifiers, repeatable room
occurrences with stable IDs, physical exit identity and order, picked and
unpicked offers, lifecycle ordering, semantic owner addresses, selected
acquisitions versus mere offers, canonical Run State checkpoints, and catalog
compatibility information. The planner workspace already separates the
information the runtime consumes:

| Planner surface | Execution meaning                                                      | Runtime responsibility                                                   |
| --------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Overview        | What the occurrence contains                                           | Realize supported room objects and fixed contents, then observe contact  |
| Timeline        | Consequential occurrence actions and their sparse dependencies         | Realize enforceable facts; bind native actions to published transactions |
| Doors           | Which exits exist, what they offer, and which continuation is selected | Generate supported exits/rewards and observe the selected traversal      |

### Room content

Fields door targets carry cage rewards even when unpicked. Physical entry,
cage and optional-reward placements are entered-room facts: they are required
only for selected Fields occurrences, not for their unpicked door alternatives.
Reward wheels follow the same selection boundary: a selected Ship occurrence
publishes one wheel per active combat phase, and an unselected Ship door
target, which is never entered, publishes none.

A native room field locked by `BlockedByRequirements`, such as the H Postboss
Pool on a fresh profile, is unusable natively and counts as absent. A present
Stygian Well or Pool of Purging is emitted with its initial roll's pinned
slots only; the native adapter realizes the object, installs each pinned slot
and leaves the others to vanilla generation. It also lists its rerolls in
action order with only their pinned slots: the k-th native reroll installs the k-th entry, an unpinned slot
stays native, and a Well slot bought earlier in the room stays blank. Each
purchase and sale names its roll.

A rerolled trait, Chaos or Pom level screen lists its earlier screens, oldest
first, beside its final one. The adapter installs the first when the screen
opens and the k-th later one on the k-th native reroll; the final screen
follows the last reroll and carries the pick. Earlier trait rows carry what a
final row shows (rarity, installed level, exchange) but nothing the pick
settles; Chaos earlier screens pin only their curses.

Door destinations carry explicit `zagreusContractPresent` for both batch and
fixed navigation. This is the same canonical additional-exit presence published
in the destination Overview, copied for an earlier consumer rather than
independently inferred. Navigation applies the value after native room
initialization and before its incoming preview; the native contract spawn
later reads that same flag. The executor does not identify midshops or inspect
future Overview features to reconstruct the door's advertisement. The
additional exit and its binding remain destination-room-owned.

Fixed continuations, including Zagreus and Anomaly returns, reference the
destination occurrence rather than repeating its reward inline. Navigation
resolves that destination's published incoming reward for both realization and
exit proof; absence of an inline reward does not mean no reward. Native
required Boss drops retain their explicit preservation policy.

An occurrence's optional `suppressedNpcShopping` names only the native shopping
events that would invalidate a later planned Nemesis or Heracles encounter.
The engine derives this protection from reached encounter preparation and its
exact room-history window; execution assembly copies it without lookahead. At
a synchronized, bound occurrence the module suppresses the named
`CheckNemesisShoppingEvent` or `CheckHeraclesShoppingEvent` callback before its
history flags or shopping thread. Other callbacks, unbound rooms and
desynchronized execution remain native. Suppression is diagnostic, not a new
transaction or mismatch obligation.

The opening is realized where native creates it. Normally that is
`ChooseStartingRoom`. A brand-new game instead runs
`StartNewGame → StartNewRun(nil, { RoomName })`, which calls `CreateRoom`
directly; when that call is nested in `StartNewRun` and names the expected
opening, the `CreateRoom` contact synchronizes the run and prepares and
realizes the opening the same way, so native does not roll an unplanned
reward.

### Room guide

Each occurrence carries an ordered room-guide projection, empty for unselected
occurrences, with small resolved description operands and optional exact
transaction owners. The module presents it as read-only guidance: owner
completion can hide its associated row, while informational rows remain
visible unless native Shrine progress completes them. Guide rows neither add
transactions nor participate in Timeline dependencies, obligations, or
conformance; unavailable or desynchronized room state hides the presentation.
A Shrine purchase row is informational on the wire and carries its generation,
reward type and rush. The module shows it as `Shrine: X` and, when rushed, a
following `Rush: X`, and hides each step from the native Shrine options
(`Purchased` marks a purchase; a rush removes the option). A delivered Shrine
pickup is the ordinary acquisition row; outside its rushed purchase room it
reads `Delivery: X`.

The guide's header, each row and the footer share one 24-character budget. The
module owns that wording: a guide-owned name for every catalog reward type,
short names for the few traits and keepsakes that would not fit, and room names
without separators or zero padding. A name that still exceeds the budget is cut
with `…` only as a safety net; the module suite fails if any fixture needs it.
More than six visible rows show five and a final `+N more` row; the footer
stays the navigation line.

Planned-choice markers on a Well, Hermes Shrine or Purging Pool screen mark
only its next planned purchase, rush or sale in authored order, since a room's
first purchase can trigger a Travel Deal refill.

## Execution Ownership

### Prefer the published answer

The executor reuses the planner's completed decision work in this order:

1. **Insert the published result directly** at a supported native boundary
   when it accepts the answer cleanly: trait offers, inventory, room choices,
   targets, and resolved operands. Do not reconstruct those results through
   many RNG hooks merely to imitate the native generation path.
2. **Steer the specific native random decision** when direct insertion is not
   a clean fit. Identify the action and its exact decision, then select the
   published candidate or yes/no result while preserving native application.
3. **Recreate native behavior only as a justified last resort.** A native
   clock, eligibility calculation, payment, consumption, or effect loop must
   not be implemented again merely because the planner simulates it.

Deciding an outcome is distinct from applying it. Copying an already-resolved
trait screen is direct result insertion, not recreation of acquisition. The
native game still owns player selection and application of that selection.
Likewise, exact room-content realization may use a native generation input;
this does not authorize manufacturing unrelated gameplay preconditions.
Condition overrides must state which native branch they affect and why a
published-result input or a specific RNG contact cannot suffice. A native
eligibility function name alone neither justifies nor condemns the adapter.

Scope/binding and checkpoint coordination support these interventions; they
are not competing ways to implement the gameplay effect. For every scope
retained across a thread, yield, or deferred callback, identify the information
unavailable at a single intervention point, the exact consumer, and its
retirement boundary. Prefer fewer lifetime assumptions, not fewer hooks at the
cost of recreating native logic. Native threaded dispatch alone does not
justify a thread-spanning executor scope.

### Encounters

Encounter customization travels inside the matching `overview.encounterPhases`
record, although it is authored on the application's Timeline. Adapters consume
the existing native encounter binding and resolved operands; they do not search
for a matching Boss elsewhere in the room. Omitted decisions remain native.
Explicit decisions steer reached behavior without adding required attacks,
transactions or conformance facts, and every encounter steering outcome below
is diagnostic-only. The
[hook map](../audits/game-execution-contacts/FEATURE_HOOK_MAP.md#encounter-customization)
owns the contacts, the
[Boss decisions](../audits/game-execution-contacts/NPCS_ENCOUNTERS_AND_AUTOMATICS.md#boss-decisions)
audit the native domains and agreed progression overrides, and the
[encounter identity audit](../audits/game-execution-contacts/NPCS_ENCOUNTERS_AND_AUTOMATICS.md#native-encounter-and-phase-identity)
the native selection, introduction and lifecycle-policy facts.

- **Identity.** Encounter selection checks a forced variant through native
  eligibility. An enemy introduction, never in a room's `LegalEncounters`, is
  admitted through native's own replacement gate instead; the planner proves
  the trigger enemy admissible when authoring and the executor does not
  re-prove it. Rejection or a native check error delegates selection to the
  game with a diagnostic and without the rejected variant's customization. A
  native encounter whose name differs from its published phase (an
  introduction, or native fallback after a rejected force) binds to that phase
  only when an executor-owned comparator finds the same lifecycle policy in
  the same room and phase role: encounter depth, end and start effects,
  spawn-dependent uses, Fig Leaf and Gorgon policy, skip propagation,
  classified start contacts and envelope termination, with multiple-encounter
  assembly's later-phase overrides applied. Selection and room-entry proof use
  that comparator; a compatible substitution logs one diagnostic and never
  installs the published customization, and anything else keeps the encounter
  mismatch, naming the differing facts. Unmodeled carriers remain exact; a
  different native choice for an already carried phase is left unclaimed.
- **Arachne.** A cocoon count and reward point are independent optional
  decisions. A selected count reaches native setup as equal count bounds while
  native still draws; the reward point is a native anchor, checked against the
  actual point pool and live occupancy, placed as the first native cocoon and
  selected at the reward draw. The interception is scoped to the bound setup
  and cleaned up on return or error. An unavailable point or out-of-bounds
  count declines independently; a missing placed target falls back to native
  reward selection.
- **Olympus Aetos.** An extent containing Olympus carries one `olympusAetos`
  directive, `none` or an exact selected occurrence, phase and wave target,
  copied from reached encounter history; other extents omit it, so a published
  Olympus plan either targets Aetos or explicitly suppresses it. The executor
  neither scans future rooms nor reconstructs planner eligibility. `none`
  suppresses the native wave event. A target suppresses it before the requested
  wave and then removes only its chance roll, leaving native requirements,
  Outdoor checks, spawning, cooldown and caps. The room's spawn flag confirms
  success; a missing wave, live ineligibility or a missed target logs once and
  releases later encounters to native, never relocating to another wave.
  Native one-wave GeneratedP is a valid best-effort fallback, including when
  composition admission itself fell back. Runtime uncertainty never enters
  planner findings. The scope is session-local and retires on biome departure,
  lost binding or reset.
- **Generated composition** is native or fully owned. The export contains every
  wave's enemy identities, source provenance and counts, including fixed and
  template seeds and an introduction's declared fixed first waves, plus Fangs
  and Menace outcomes, an optional variable base roll and a required
  `expectedBudget`, the engine's exact final budget, which neither compiler nor
  runtime recomputes. The exact phase scopes synchronous native preparation,
  with a stamped destination handoff for reward-owned Devotion. A supplied base
  roll is validated against the effective native range before native consumes
  it. After native computes the final difficulty rating and before wave
  construction, the executor makes one whole-encounter decision: budget
  (float-tolerant), wave count within native bounds, role-correct composition
  eligibility in selection order, Fangs and Menace compatibility, and native
  introduction substitution. Declared pre-existing waves must match by name and
  count and are treated as installed, and any other pre-existing wave declines;
  only the generated suffix is filled.
  Acceptance configures the wave count and suppresses native highlight
  generation; native fill contacts mount the roster and counts, and later
  hooks apply Fangs and Menace from that decision. Decline records expected and
  observed evidence and leaves native generation running, keeping a valid
  supplied base roll.
- **Native-roll exclusions.** An uncustomized or declined generated phase rolls
  natively with its optional `excludedEnemies` (owned by the
  [introduction model](ENCOUNTER_PREPARATION.md#enemy-introductions)) added to
  the per-encounter generation copy's blacklist, so nothing is restored and
  run-wide state keeps only native additions.
- **Infinite rosters** own only the ordered `FillEnemyTypes` draws of an
  `InfiniteSpawns` encounter, with no budget, wave or count admission. At the
  same generation-scoped `CalculateActiveEnemyCap` contact, before mutation,
  the executor requires one native wave, an empty manual template and the
  effective type bounds and pool, and checks each type through live
  `IsEnemyEligible` against a wave holding the earlier types, which applies
  blacklists, draw-order exclusions and the elite limit as native does.
  Acceptance installs the ordered generated entries with native draw side
  effects and no total count, and native `FillEnemyCounts` marks them
  infinite; Fangs and Menace stay native. Decline, realization failure and
  diagnostics follow the finite contract.

Planner evaluation and decoding own the facts admission trusts (highlight
placement, Fangs roster membership and elite eligibility, source counts,
rounding, count limits and Menace count bounds); the game keeps
active-enemy caps, spawn pacing, groups, retries and perk application. There is
no rollback, second generator, runtime budget arithmetic or mid-combat
re-generation. Native errors propagate; a missing admission or fill contact,
or a native error after acceptance, is a realization failure, never clean
native fallback.

### Dispositions and transactions

Commands fall into three execution dispositions:

| Disposition | Examples                                                                | Contract                                                                  |
| ----------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Realize     | room/door generation, reward identity, selected trait offer, Chaos pair | Apply only through a verified fixed adapter                               |
| Observe     | entering a room, choosing an exit, or completing a required interaction | Compare only explicit structural facts and obligated transactions         |
| Verify      | Named changed traits, charges, clocks, and retained effects             | Compare only published room-exit conformance facts; never steer with them |

Some timeline steps combine these responsibilities. An acquisition adapter
claims a ready owner and inserts or steers its published outcome, but completing
that steering handle is not proof that the player chose or retained the
authored result. The plan remains conditional on player cooperation;
enforcement does not erase player agency.

Exact source correlation precedes readiness. A materialized native action must
bind to its published owner rather than to another transaction with a similar
god, reward, or item payload. If the player consumes that exact action before
its published prerequisites complete, the runtime records the generic
`transaction-prerequisite` mismatch and becomes passive while still invoking
the native action. An unbound carrier claimed at its accepted contact follows
the same rule: with no ready compatible owner, a compatible owner still
awaiting prerequisites is that mismatch rather than an unsteered native action.
This protects DAG order without turning transaction completion into semantic
result verification.

Mystery boxes are the one interchangeable carrier: native unwrap builds the
same loot for every box and the module forces the god. A bound box keeps only
its native binding to its own transaction (purchase, pickup, delivery, refill).
Its hidden god acquisition goes to the first pooled transaction in plan order:
box and hidden-god roles both `normal`, own box bound in this room, not yet
begun or complete, and whose prerequisites are complete. Each transaction
completes when its god is picked, from whichever box served it. With no ready
pooled member the box keeps its own owner, so a true misorder still records
`transaction-prerequisite`; when that owner is already begun or complete, the
next unbegun pooled member takes the box and records the same mismatch.
Conversion dispositions and unbound boxes keep their existing paths. Only the
native "From the Contract" voice line can follow the physical box rather than
the planned god.

### Trait screen dependencies

Trait screen dependencies keep only the order a misorder could not detect at a
screen (role-settled acquisitions, NPC and Gorgon trait offers, Pom level
screens):

- **Chain.** Each screen follows the latest earlier screen in its room from the
  same giver. Screens from different givers are not ordered against each other;
  the screen checks below catch a misorder that changes a screen. Chaos clocks,
  Concave Stone residuals, direct grants, resource grants, Experimental Hammer
  expiry, room decay and Echo Gold consumption never anchor the chain.
- **Fences.** A Keepsake Rack change, and a Fountain use whose Aromatic Phial
  upgrades a trait, follow the latest screen ranked before them in the room, and
  the earliest screen ranked after them follows the fence, unless published
  edges already imply it. A plain Fountain only heals and is no fence. Pool
  sales, Eris and Shrine purchases change trait outcomes but have no
  transaction, so their order against a screen is unenforced. A Well opens only
  once exits unlock, after every exit-blocking loot, so its purchases are not
  fences.
- **Native order.** An after-combat reward spawns before its encounter's end
  effects, which re-roll spawned loot, so its edge to Steady Growth or the
  Transcendent Embryo is not published; nor is Devotion's spurned boon after the
  chosen one that starts its trial.
- **Classification.** A published edge joins two transactions of the room. An
  endpoint without one is a room action the game performs or skips natively, an
  untransacted fence, the unranked Travel Deal refill Well purchase, or an owner
  in another room, on the Hub board or at the route or biome start; any other
  endpoint is an `executionCoverageMissing` compile error.
- **Screen checks.** Each published trait screen (traits, Gold fallback, and
  Echo's last-run menu) carries an `expectation` of the order-sensitive state it
  reads, each field present only where the screen reads it:
  - god screens: remaining Sacrificial Hymn and Yarn uses when it opens, and
    whether closing it spends Hymn, Yarn or an Ordinary curse use;
  - Concave Stone uses and whether this giver can proc them;
  - the rarify uses its menu reads;
  - Echo's last-run menu: whether Proper Upbringing's floor is active.

  When the screen opens, after the native roll and before rows are forced, the
  module compares live uses with the published ones and each spend with the
  loot's native close condition: `UseSwapTrait` with Hymn held, `RarityBoosted`
  without `ForceCommonWithoutCurse` with Yarn held, and `ForceCommon` without
  `ForceCommonWithoutCurse` with the Ordinary curse held (loot flags only ever
  turn on). It compares an exchange row's level and a Pom's level count with
  native, and checks every row through native helpers: `IsTraitEligible` and
  `IsGameStateEligible` without `ChanceToPlay`, `HasTraitRequirements`,
  `HeroHasTrait`, `HeroSlotFilled`, `GetUpgradedRarity`, and the Spell and Echo
  last-run filters. The first difference is a `trait-screen-*` mismatch at that
  screen and the screen stays native; a native error is a `native-api` fault.

Beyond these screen checks, the executor trusts planner eligibility and does not
apply a second offer-legality policy before forcing rows.

### Hex

A selected Spell Drop's `hexTree`, and Aspect of Selene's
`startingLoadout.startingHex`, carry the layout and `nodes`: the authored talent
on every non-Olympian node, keyed `depth:slot`, plus the God Sent pair when the
planner models it. The executor forces the layout, lets native
`CreateTalentTree` make every draw, then writes each published node's talent
over the native result with its kind's rarity (Keystone Rare, Legendary Epic,
repeatable Common); the God Sent nodes stay native. A node the native tree lacks
or does not publish is a diagnostic. `pathOfStars` keeps the God Sent pair,
closure, the point counts and whether the God Sent Olympian talent is invested,
Task Force's prerequisite. Node identity is binding through `hexNodes`: every
realised non-Olympian talent and the set of invested nodes. Each Path screen
role carries `plannedHexNodeKeys`; the executor marks those nodes on the native
talent screen, and room exit proves the investment.

## Conformance

Native hooks and conformance checkpoints are deliberately different concepts.
Encounter start/end, cleanup, screen construction, and similar callbacks may
schedule a realization or identify the lifecycle window in which a semantic
transaction occurs. Their exact callback names, duplicate contacts, and
representation-only ordering are not independent conformance requirements. The
planner models encounter completion unlocking rewards; the executor relies on
native pickup availability rather than reproducing that gate. Acquisition
discovery does not require the authored encounter window to be active. Exact
source bindings and acquisition DAG prerequisites still apply, and nested
outcomes remain attached to their producer. A pickup can occur earlier or later
than its authored placement when those dependencies permit it. Automatic effects
remain bound to their exact, transient encounter callback contact. Resulting
acquisition state is checked at room exit, not by asserting that player input
happened inside the spawning callback. Read-only encounter and composition
admission probes may reject an override with a diagnostic when eligibility
cannot be established; this does not swallow errors from actual native
generation, spawning or effect application.

The runtime may use several native calls to build one product. Conformance is
decided against the completed semantic product rather than by requiring each
construction callback to mirror an execution-plan row.

Fields layout steering publishes planned versus observed entry points, cage
rewards/points, optional rewards/points and Nemesis placement as diagnostics.
Positional differences do not themselves invalidate the remaining simulation
and are not mismatches. Record original reward inputs and actual spawned
objects without reconstructing native substitutions such as Forfeit. Existing
room-exit conformance remains responsible for the modeled resulting state.

The conformance surface is bounded to:

| Checkpoint                    | Compared product                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Room entered                  | occurrence/room identity, published Overview content, and any obligation due at `roomEntered`                                                                      |
| Semantic Timeline transaction | the exact published transaction bound to the native action when it is an explicit obligation; acquisition handles instead express steering and local DAG readiness |
| Exits ready                   | complete exit count, physical types, target room identities, reward identities, and obligations due at outgoing generation                                         |
| Room exit                     | obligations due at `exitUsable` and `roomExit`, and only the planner-published named conformance facts that changed in this occurrence, Hex node identity included |
| Hub departure                 | the full modeled trait inventory published in `hub.departures` for that completed-visit count, on every departure                                                  |

The published `exitUsable` deadline is checked at actual room closure, before
the timeline is discarded. It does not require a separate door-use callback:
native `AttemptUseDoor` rejects locked attempts and reaches `LeaveRoom` for
departure. A failed obligation check stops realization, never native traversal.

Numeric state comparisons allow only absolute floating-point roundoff of `1e-9`,
shared by room-exit conformance and starting Fear checks. They do not round
published values or native steering operands. Types, keys, identities, booleans,
and collection structure remain exact; non-finite values fail. A one-unit
counter difference or a meaningful fractional difference still desynchronizes.
Diagnostic logs retain double-precision numeric detail.

Well conformance compares aggregate remaining uses across independent Yarn,
Ixion, and Extended Shop trait instances, the single accumulated Hymn `Uses`
counter, and the individual Discount and Empty Slot durations that gate later
Well offers. Other timed Well traits, the purchase ledger and Well consumables
are planner Run State only. This applies at room exit: forced downstream offers
and Chaos gates cannot independently prove that a temporary effect was consumed.
These are checkpoint balances, not per-consumption provenance checks.

Rewards destroyed by Time Piece retain their generation and placement products,
but publish no acquisition transaction. This applies equally to incoming
rewards, Hub and side-room rewards, Fields cages, and Ship wheels. A wheel still
publishes its selection; an acquisition, when present, must match that
selection and depend on it. Keepsake charge conformance covers Time Piece
without a destruction hook.

Selected acquisition transactions remain on the wire with their exact roles,
payloads, and meaningful local dependencies, but they are not checkpoint
obligations. Their completion means that the native action reached its declared
terminal and may release a local dependent; it does not attest that steering or
the resulting state matched. A missing or different player acquisition does
not become an adapter-local semantic comparison: durable modeled results are
checked only by the sparse named room-exit conformance facts selected by the
planner. Max health, Magick and lasting armor are modeled for Run State but not
conformance-checked; other health, Magick, Gold, armor, healing, and
meta-progression results are simulation-neutral. None has a blocking
completion proof. Arachne's eight dresses and Icarus's Protective/Volatile
Coating remain in planner history but are excluded from trait presence and
absence checks at room exit: native armor depletion can remove them, and their
survival is not a prerequisite for modeled outcomes. This is not a blanket
exclusion of armor-related boons, keepsakes, or other NPC traits.

### Run State frames

Complete Run State snapshots are published at the room-entered and
before-room-exit checkpoints. Besides counters, ranged reward-bag counts and
retained effects (an absent `biomeEncounterDepth` counter is native
`BiomeEncounterDepth` unset), each frame carries every hero fact a check reads,
exactly: the traits; every held keepsake with its rank, slot and charge counters
(not the Bell, Fang or Sash values); the aspect rarity and familiar stack
multiplier; each active Arcana card with rarity, origin and whether Barren
holds it unequipped; the vows, Forfeit, the Denial ban list and Artificer
charges; Chaos curses and blessings with their values and clocks; the Hex tree
and invested nodes; and each reward store's contents where they agree across
branches, an untouched store at its initial counts. A difference in a frame
never blocks execution by itself. The planner separately publishes the sparse
named facts that changed during the room; besides trait inventory, elements,
Steady Growth, Chaos, keepsake effects, reward priorities, Path of Stars,
Forfeit and the Well, they are `keepsakes` (held keepsakes by rank and slot),
`equipment`, `arcana` (cards, Barren holding, Artificer charges), `vows` (ranks,
disabled vows, Denial bans), `chaosValues` and `hexNodes`. A Practice start
checks every family against its start room's `roomEntered` frame. Only a
mismatch in one of those named conformance facts, a required Timeline
obligation, or another explicit structural/transaction comparison stops further
planner enforcement. The native contact still completes and the executor never
chooses a substitute room, reward, or action.

## Supported Fixed-Route Surface

The supported fixed-route surface covers ordinary rooms and rewards, supported
encounters and selected trait offers, fixed Preboss/Boss/Postboss continuation,
World Shops, Stygian Wells, Purging Pools, Keepsake Racks, fountains, resources,
and their supported acquisition dispositions. It also covers the following
special topology and interaction owners:

- Narcissus, Artemis, and supported Nemesis random-event resolutions;
- Anomaly replacement and its authored return;
- Zagreus Contract as a distinct additional exit;
- natural and Ixion-generated Chaos gates;
- H Fields cage placement and cage rewards;
- N Hub doors, rewards, side-room presence, and side-room rewards;
- O ShipCombat phase count, wheel cohorts, wheel rewards, and selected pickups;
- P's native ordered PreCombat/Combat envelope and Heracles suffix termination;
- Q's ordinary depth-eligible rooms, World Shop, fixed Boss link, and terminal
  topology;
- three authored distinct Chaos curse options, the selected curse/blessing
  pair, acquisition, and the selected Chaos map's declaration-sized visible
  return batch to G.

Dream routes add the itinerary contacts in
[Biome Execution Navigation](BIOME_EXECUTION_NAVIGATION.md#dream-navigation).

The N Hub overview publishes its required room-visit count and its one
required fountain use as `hub.fountain`: a `fountainUse` interaction owned by
the Hub fountain address, the number of completed room visits and Hub returns
preceding it, and any Aromatic Phial target. It is a Hub-owned interaction,
not a next-room Timeline transaction.

Each Hub interval, from Hub entry or a visit's return to the departure into the
next visit or the final handoff, is its own conformance window. Room-exit facts
cannot observe it because they compare one occurrence's own entry and exit.
`hub.departures` publishes one frame for each completed-visit count, from zero
through the required visit count, including the final handoff. Each frame has
`facts: [{ kind: 'traitInventory' }]` and the expected `traits.equipped` rows,
in the Run State frame's shape, and may carry the complete `beforeRoomExit` Run
State frame of that departure, which
[snap mode](RUN_START_INSTALLATION.md#snap-mode) corrects against. The executor
compares the full modeled inventory on every Hub departure, independently of
whether a fountain use or trait change was planned in that interval. An early
Phial upgrade therefore fails at the immediate departure even if it matches the
upgrade planned for later. Fountain use and timing remain diagnostic: only a
resulting inventory discrepancy fails conformance.

For Chaos, the selected blessing is reserved for the selected curse before the
native screen is constructed. The other two blessings remain distinct
native-generated peers. Their omission from the engine document is deliberate:
they are neither acquired nor consumed by later planner semantics.

Ixion and natural generation are not different kinds of Chaos room. The origin
records only whether Ixion inserted the gate so removing that purchase can
remove its generated topology. A visible Chaos gate consumes one pending Ixion
regardless of how the gate originated.

A Chaos entry in `overview.additional` may publish `spawnPointIndex`, a positive
one-based index into numerically sorted native SecretPoint IDs. Omission leaves
random placement unchanged. The scoped SecretDoor spawn adapter substitutes
only its destination, preserving native gate creation, destination-room choice,
health cost and Ixion consumption. An unavailable point produces a diagnostic
and leaves the native destination unchanged, not a placement-only mismatch.

Eris is the same kind of boundary. Her talk is a guide row, not a transaction,
and the planner's observation that she spawned is not on the wire; the executor
never steers her spawn. Her gift is an ordinary direct pickup. Her curse is
proved at the intro room's exit in both directions, before any later bag that
her gift's Ashes would change is trusted. Where she is planned, the curse is in
the room's `traitInventory` frames, so its absence is a mismatch. At a route
Eris host whose curse is not held at exit, the `traitInventory` fact carries
`absentTraitKeys: ["ErisCurseTrait"]`, added to the fact when the room has no
other trait change; the executor proves those keys absent like the frames'
removed traits, so an unplanned curse is a mismatch. A route already cursed at
that room asserts nothing, and mature routes, which host no Eris, publish no
`absentTraitKeys`.

A Pool of Purging sale illustrates the boundary. The authored sale does not
become an execution Timeline transaction: Overview constrains the visible Pool
inventory and the room-exit `traitInventory` fact proves the expected trait
removal. The executor neither reimplements the sale nor requires its individual
button callback to complete an action handle.

Shop, Well, and Shrine inventory is likewise Overview content. Ordinary
payment, affordability, and purchase-counter behavior remain native and do not
publish execution transactions. A purchased row instead publishes its acquired
result, which the ordinary source-independent acquisition, transformation, or
item-effect adapter settles. Travel Deal is the sole dynamic inventory
exception: the wire names its exact refill realization and payload. World
Shop's dedicated refill callback can report an unexpected refill
diagnostically; Well and Shrine use generic native contacts and pass through
when no refill was published.

World Shop Overview rows are the emitted items in native order: a row's index
is its compact `StoreOptions` position and its `profileSlotIndex` names the
declared slot it realizes. A validly empty slot publishes no row, so later
items shift left; the executor maps rows onto native `GroupsOf` slots by that
index, omits a group with no rows, and never regenerates inventory itself. The
Travel Deal replacement's `slotIndex` is the same compact position.

## Mismatch Classification

Runtime contacts have five distinct outcomes. Adapters must not promote a
weaker outcome into a mismatch merely because they can observe it.

| Outcome             | Meaning                                                                                             | Runtime disposition                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Admission rejection | A selected slot is absent, malformed, incompatible, or not a complete execution plan.               | Do not create a synchronized session; report the admission error.                                            |
| Executor fault      | A required host function is missing or throws, or a decoded-plan/session invariant fails.           | Restore temporary forcing scope, report or propagate the fault, and do not describe it as player divergence. |
| Incidental contact  | Native code reaches a supported hook but no compatible published owner claims it.                   | Pass through unchanged without completing a transaction or desynchronizing.                                  |
| Diagnostic          | A bounded actuator could not install or apply its intended steering.                                | Record bounded evidence, log it once, and continue native behavior without changing synchronization.         |
| Execution mismatch  | A standard checkpoint or premature exact-owner action proves the remaining simulated prefix unsafe. | Preserve the first mismatch, stop later realization, and let the native game continue.                       |

Each admitted session logs its slot, plan identity, schema pair, catalog and
module version once. The first execution mismatch reports the plan/catalog
fingerprints, semantic owner, checkpoint, expected value, observed value, and
bounded event context. The executor then becomes passive: the game continues
natively, still invoking the native operation, and no hooked game function
returns early or blocks player input, room creation or traversal merely
because the session desynchronized. An ordinary steering failure remains
diagnostic until a checkpoint or premature exact-owner action proves
divergence.

- A `playerDivergence` means the player performed a different observable action
  from the published trace.
- A `conformanceDiscrepancy` means the player followed the trace but the live
  game did not match a realized or verified fact.

A non-player discrepancy is evidence that the planner under-models the game or
that a native adapter is wrong. It must be adjudicated against game data and
corrected at the planner-engine or adapter authority, never hidden by fallback
planning. A compiler correction is appropriate only when its lossless
translation omitted or misencoded an already-explicit engine fact.

Representative boundaries keep this policy concrete:

- A trait, Pom, or automatic-effect adapter completes when its native steering
  terminal returns. A local steering failure is diagnostic; the published
  room-exit trait, Arcana, keepsake, or retained-effect fact proves the durable
  outcome.
- Travel Deal binds one exact dynamic refill carrier, generation, and slot. An
  unrelated refill passes through. A refill at the wrong published slot is
  diagnostic and does not complete the declared refill; the outstanding
  obligation fails at its ordinary deadline if the exact terminal never
  occurs.
- Artificer completes only after the expected replacement is observed and the
  source is destroyed. A presentation callback or wrong replacement is useful
  diagnostic evidence, but it is not the declared terminal.
- A native encounter, pickup, purchase, or transformation with no compatible
  owner is incidental. Its existence is not itself a reason to stop a run.

Faults are executor defects: unknown Timeline handles, conflicting native
bindings, missing decoded owners, unsupported lifecycle checkpoints,
closed-session use, malformed post-admission payloads, and missing or throwing
required native functions, which are never converted into ineligibility, a
default value or a plan mismatch. Protected calls serve only as cleanup that
restores a temporary forcing scope before rethrowing the original error.

### Exit door

Wrong continuation is detected by the next room-entry identity check. The
exceptions are a door prepared for another published target or planned
additional exit of the room being left, and on Ephyra's board, any door but the
offered planned one. `LeaveRoom` reports these as an `exit-door` mismatch after
the cursor exits, so snap mode can redirect the transition. Outside the board,
only the door's destination changes and its cost and presentation stay native.
On the board, native `LeaveRoom` leaves through the planned door, including its
presentation.

## Transport

The transport is canonical data-only JSON with a strict decoder, exact schema
pair and catalog compatibility (see
[plan admission](GAME_MODULE_DISTRIBUTION.md#plan-admission)), bounded
collections, closed unions, and no silent coercion. It permits no dynamic
evaluation, executable expressions, arbitrary paths or commands, or class
reconstruction from untrusted names. Run State diagnostics remain complete in
the planner's semantic plan; on the wire, frame zero replaces every closed
top-level diagnostic section and later sequential frames replace only changed
sections. `artificer: null` is an explicit replacement that clears prior state.
Runtime identifier existence and checkpoint contact are conformance checks, not
permission to reproduce planner eligibility policy. Exact source binding and
published prerequisite readiness are execution coordination, not eligibility
inference.

### Content fingerprint

The compiler and execution decoders verify the expanded execution product with
the same FNV-1a 32-bit checksum, rendered as eight lowercase hexadecimal digits.
The fingerprint excludes itself; diagnostic transport deltas are expanded before
hashing. It detects inconsistent contents, not malicious tampering.

The canonical input is independent of JSON formatting and host locale:

- Null is `z`; booleans are `t` and `f`.
- A finite number is `n`, its 16 lowercase big-endian IEEE-754 binary64 hex
  digits, then `;`. Negative zero is normalized to positive zero. Non-finite
  values are rejected; fractional values are never rounded for hashing.
- A string is `s`, its UTF-8 bytes as lowercase hex, then `;`. Strings must
  contain Unicode scalar values; unpaired UTF-16 surrogates are rejected.
- Arrays concatenate their value tokens between `[` and `]` in array order.
- Objects concatenate key-string tokens and value tokens between `{` and `}`,
  sorted by the keys' UTF-8 byte sequence. There are no extra separators.

Canonicalization changes require a decoder change and republishing; decoders do
not try alternate fingerprints for older publications.
