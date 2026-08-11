# Acquisition Settlement Implementation Plan

## Status

**Lock candidate.** This isolated delivery plan is
derived from `docs/audits/ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md`. The audit
owns source-backed game facts. This document owns the planner interpretation,
delivery sequence, concrete products, migration, expected deletions, and
acceptance gates.

Do not link this temporary plan from stable design, biome, audit, or progress
indexes while implementation is active. At closure, absorb durable contracts
into their owning design documents, record the delivery in
`IMPLEMENTATION_PROGRESS.md`, and retire this file.

The committed source baseline is schema 19 at `dcee2d4`. The uncommitted
Narcissus Gate E work is a prototype, not source authority. Before
implementation:

1. commit this plan, its owning audit, and the supersession note in
   `STORY_TRAITS_AND_DEATH_DEFIANCE.md`;
2. stash every remaining tracked and untracked prototype change;
3. record the stash object ID; and
4. begin from the clean schema-19 source.

The stash is read-only evidence. Never pop it wholesale over the corrected
implementation.

## Objective

Make **acquisition settlement** the one engine authority through which every
currently modeled concrete reward acquisition enters history.

This includes ordinary room rewards. It also includes Devotion's two roles,
O reward-wheel choices, H cage rewards, N main-visit and entered-side-room
rewards, and Shop purchases. Narcissus is added only after those existing
families prove the contract.

The contract separates three facts that the current code often folds together:

```text
producer owns and resolves an offer
  -> one or more exact acquisition entries become due
      -> each entry binds one or more declared acquisition roles at one site
          -> each entry belongs to one exact lifecycle settlement site
          -> derived or authored participation/order selects chronology
              -> one settlement coordinator applies the entries
                  -> existing reward kernel writes reward/trait history
```

An offer is not an acquisition entry. A settlement site does not own the room's
reward choice. The same resolved offer may emit more than one role-specific
entry at different lifecycle sites, as Devotion already does.

The delivery must also replace the discarded incomplete-Midshop replay, remove
Shop-private chronology, and provide a correct home for Narcissus pickups
without nesting them under the outer trait choice.

This is not a complete Shrine, Well, or delivery implementation and not a
generic item/effect interpreter.

## Why ordinary room rewards are in scope

Leaving ordinary rewards outside the contract would create two acquisition
engines:

- existing room, wheel, cage, and Hub reward paths would continue to apply
  history directly; while
- Shops, Narcissus, and future deliveries would use settlement entries.

That split would fail as soon as a due delivery and an ordinary reward share a
pre-outgoing checkpoint. Their relative order can change trait support, Pom
targets, elements, and downstream reward legality. Adding ordinary rewards
later would require another foundational migration.

The correction does **not** move room or reward selection into a new card.
Producer surfaces still choose rooms and resolved rewards. It makes the chosen
reward's concrete acquisition roles canonical settlement entries at their
existing exact lifecycle points.

The key distinction is:

| Fact                                          | Ownership                           |
| --------------------------------------------- | ----------------------------------- |
| Which room/reward is offered and selected     | existing producer/occurrence leaf   |
| Which acquisition roles that offer emits      | catalog reward lifecycle            |
| Where each role settles                       | exact lifecycle site                |
| Whether an optional item participates         | one authored participation fact     |
| Relative order at an orderable site           | that site's authored order          |
| Trait/Pom/level detail applied on acquisition | exact child leaf contained by entry |

Most ordinary sites contain one mandatory entry. Their participation and order
are derived, so they require no new checkbox, order control, or persisted point
state. They still use the same engine coordinator and expose the same semantic
site/entry containment as a multi-item site.

## Why the clean-head sequence is required

The prototype discovered useful declarations and UI needs, but encoded the
result in the wrong ownership shape:

- a selected Narcissus descriptor owned `outcomeResolution` state;
- the outer trait dialog nested Pom and Mystery Boon acquisition controls;
- `ReplaceTraitOutcomeResolution` edited that nested state;
- trait candidates carried reward facts solely to assess those children;
- a Narcissus-specific synthetic producer dispatched concrete rewards; and
- those outcomes executed at `encounterCompleted`, before the room's outgoing
  batch even though `G_Story01` does not wait for optional drops.

Committing that prototype would create a schema and command migration away from
a contract that was never intended to survive. Shops and existing room rewards
must establish the shared seam first. Only verified game declarations, labels,
requirements, reward identities, element facts, presentation ideas, and
focused witnesses may be recovered from the stash.

## Scope boundary

### Included

- one canonical engine acquisition-entry and settlement-site vocabulary;
- canonical settlement participation for every currently modeled concrete
  reward acquisition;
- exact sites for standard rewards, Ephyra opening/main/side rewards, Devotion
  roles, O reward-wheel phases, H cage rewards, and current Shops;
- declaration-owned explicit post-outgoing points only where no current
  producer point already exists;
- one settlement coordinator and one complete stage result per reached site,
  published beyond simulation only where an actual consumer needs it;
- exact settlement-site and entry products that retain existing exact
  trait/Pom/level leaf addresses;
- compact singleton presentation without duplicating ordinary reward controls;
- one occurrence-owned authored point state only where current participation
  or chronology is genuinely authorable;
- migration of World and Preboss Shop purchase order to shared settlement
  chronology;
- deletion of the incomplete-Midshop discarded replay;
- a canonical **Acquisitions** workbench for multi-entry/orderable sites;
- schema 20 as the final persisted representation required by Shops and
  Narcissus;
- the supported Narcissus three-choice provider and modeled pickups after all
  existing acquisition families use settlement;
- undo/redo, strict codec contact, progressive candidates, findings,
  navigation, run-state effects, and representative product-loop witnesses.

### Explicitly deferred

- Shrine of Hermes inventory, purchase, countdown, rush, pending delivery,
  forced completion, and delivery materialization;
- Wells of Charon, their pools, prices, temporary traits, and expiration;
- adding a due-delivery entry to an existing pre-outgoing point;
- new between-encounter delivery sites beyond the exact O/H reward sites that
  already exist;
- new N Shrine sites beyond canonicalizing currently modeled main/side reward
  acquisitions;
- authoring a relative order for ordinary singleton sites that have no
  competing item;
- Shop affordability, gold, health cost, discounts, restocking, and inventory
  mutation after purchase;
- drag-and-drop as a prerequisite for ordering; accessible move controls are
  sufficient;
- arbitrary dropped-item families outside supported Narcissus outputs;
- Echo, Circe, and other deferred providers; and
- a generic semantic effect bag, callback registry, unrestricted lifecycle
  DSL, or speculative pending-delivery fields.

The current delivery must provide a truthful extension point for later
delivery entries. It must not pre-author dormant countdowns, Well state, or
fake settlement instances.

### Adjacent behavior that does not migrate

- A direct selected trait that equips or mutates player trait state at its
  declared encounter/choice point remains in the trait authority. Artemis,
  Athena, Icarus, Arachne, Proper Upbringing, Bridal Glow, and similar direct
  trait effects are not wrapped as fake item pickups.
- Room, reward, encounter, Shop inventory, and trait-option selection remain
  with their current producers.
- Offer generation, counted-bag consumption, and outgoing-batch generation do
  not enter settlement.
- Only a producer output that becomes a concrete reward acquisition or spawned
  pickup enters this contract.

## Locked vocabulary

**Resolved offer**
: The existing producer-owned authored choice identifying the concrete reward
that was offered. Room/reward pickers and Shop inventory edit this fact.

**Acquisition role**
: One declaration-owned concrete acquisition emitted by a resolved offer.
Ordinary rewards usually emit one role. Devotion emits chosen and spurned roles
at different points. Blind Box may expand through its declared acquisition
lifecycle without UI-authored policy.

**Acquisition point**
: One declaration-owned position in a room lifecycle at which zero or more due
entries may settle. Existing producer lifecycle points and exact phase/local
reward points remain valid point authorities. A new explicit point is declared
only for post-interaction work that has no existing producer point.

**Settlement site**
: One reached, exactly addressed instance of an acquisition point. Its owner
may be a Room Occurrence, an exact O/H phase or local reward, an entered N main
visit, or an entered N side-room occurrence. The persistent Hub itself is not a
site.

**Acquisition entry**
: One concrete item or atomic acquired action due at one exact site. It
references its producer-owned resolved offer and binds the declaration-owned
acquisition role or roles that execute there. Most entries have one role. An
atomic item such as Blind Box may expand into several ordered internal roles;
those roles do not become separately reorderable UI entries. The entry owns
the acquisition-time semantic children for its roles and does not duplicate
the offer.

**Site-owned pickup entry**
: An acquisition entry whose concrete item is itself materialized at that site,
such as a Narcissus drop. Because no earlier producer offer owns its editable
reward state, the site's authored state owns that pickup payload.

**Participation**
: Whether an optional concrete entry is acquired. A mandatory entry derives
participation. For optional current sources, membership in the site's order is
the sole persisted participation fact. Presentation may label it **Purchased**
or **Picked up**.

**Settlement order**
: The distinct participating entry keys in exact chronology at one site. It is
not a whole-room order and cannot cross lifecycle sites.

**Settlement product**
: The engine result of assessing one reached site from its exact pre-settlement
branches. It includes active entries, participation/order, findings,
candidate inputs, events, and post-settlement branches.

The result is an explicit product of the owning simulation stage, not a sidecar
or hidden registry. A derived mandatory singleton may be consumed completely
inside simulation while its existing candidate/finding products continue
outward. Do not publish an exhaustive application-wide settlement manifest
solely so tests can audit that the refactor ran.

## Ownership and data contract

### Producer state remains the offer authority

Existing room reward, local reward, wheel, and Shop offer state remains the
single persisted resolved-offer value. The settlement layer references that
value through a closed source locator; it does not copy it into every entry.

This permits one offer to produce several semantic entries without inventing
several offers. In particular, Devotion retains one `DevotionPair` offer while
its chosen and spurned acquisitions settle at their distinct declared points.

Offer-generation requirements and findings remain producer-owned. Replacing a
reward continues to use the existing producer-facing semantic command.

### Acquisition children keep one exact leaf address

Trait offers, Pom targets, and level resolutions are evaluated at acquisition
time, but most current authored leaves already have an exact stable address:
their producer-owned reward address plus acquisition role. Preserve those
addresses.

Persisted aggregation may continue to store those children beside the one
`AuthoredRewardState` that owns their values when doing so avoids duplication.
Each settlement entry carries the exact existing child addresses that execute
with it, and the workspace maps those leaves to the entry's containing row.
Moving a control from a Shop producer row into an Acquisitions card therefore
does not require renaming an already-exact `TraitOfferAddress` or
`LevelResolutionAddress`.

A site-owned pickup has no earlier producer reward address. Its trait/Pom/level
children use its `AcquisitionEntryAddress` as the owner. Extend the closed
trait-owner union for that genuine new case; do not reparent every existing
leaf merely to make the address tree mirror presentation containment.

There must be one value and one command path, not mirrored producer and entry
copies.

### Authored point state is a narrow overlay, not a second topology model

Schema 20 adds `acquisitionPoints` to `RoomOccurrence` for the exact explicit
`roomExit` sites that currently own genuine participation, order, or site-owned
pickup payloads: World Shop, Preboss Shop, and later Narcissus. The locked
conceptual shape is:

```ts
interface AuthoredSettlementPointState {
  readonly order: readonly string[];
  readonly pickupEntries?: Readonly<Record<string, AuthoredRewardState>>;
}

interface RoomOccurrence {
  // existing occurrence facts...
  readonly acquisitionPoints?: Readonly<Record<string, AuthoredSettlementPointState>>;
}
```

The exact production names and enclosing keyed collection may differ, but the
invariants cannot:

- the occurrence and point key resolve one exact declaration-selected site;
- `order` references active entry keys at that site;
- Shop offers are referenced, not copied into `pickupEntries`;
- only site-materialized pickups own payload state there;
- optional membership in `order` is the sole acquired/not-acquired fact; and
- a mandatory singleton site with no authored chronology requires no persisted
  overlay.

All authored entries in schema 20 are optional because Shops and supported
Narcissus drops are optional. Do not add mandatory-order validation or fixture
matrices until a real mixed mandatory/optional site, such as due Shrine
delivery beside a room reward, is implemented. The engine's derived singleton
path still supports mandatory current acquisitions without persisted state.

O/H phase, H cage, and N visit/side-room sites in this delivery have derived
mandatory participation and order, so they gain semantic site products and
addresses but no speculative persisted overlay. A later due-delivery feature
may extend authored settlement state to those already-defined semantic owner
kinds in the same schema change that adds pending delivery. That is an additive
feature extension, not permission to reintroduce direct acquisition paths.

### Semantic addresses

Add exact addresses equivalent to:

```text
AcquisitionSiteAddress
  = exact entered room/local/visit origin + point instance key

AcquisitionEntryAddress
  = AcquisitionSiteAddress + stable entry key
```

The source origin is a closed engine union, not a generic string path. Existing
occurrence, encounter-phase, local-reward, Hub-main-visit, and side-room
identities should be reused where they already provide exact contact.

An entry key identifies the user-orderable atomic item at that site. Its
declaration-selected internal acquisition roles remain nested semantic
children. This preserves Shop order by offered item and prevents Blind Box or
other multi-role rewards from exposing an invented internal order.

Stable entry keys come from declaration/authored structure, never reward value,
rendered index, or chronology. Current derived singleton sites use their stable
producer/role or phase-local slot identity; a wheel's one acquired entry remains
the stable picked-entry role while its referenced offer may change. Shops use
`offerKey`. Narcissus uses its declared output-entry key.

The entry address identifies settlement chronology, row containment, and any
site-owned pickup payload. Existing source-owned child addresses remain exact
and are referenced by the entry product. Site-owned pickup children use the
entry as their owner. Producer addresses continue to own offer selection and
generation findings.

## Point and entry mapping for current behavior

The first implementation must inventory every active acquisition path and map
it explicitly. The minimum supported matrix is:

| Current family                    | Canonical site                                 | Canonical entry behavior                                      |
| --------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| Standard reward room              | existing `roomRewardPickup` point              | one mandatory role derived from incoming offer                |
| Ephyra Opening                    | its existing pre-encounter reward pickup point | one mandatory incoming-reward role                            |
| Ephyra main target                | declared before/after/reward points            | exact roles, including Devotion when present                  |
| Ephyra entered side room          | side-room reward pickup point                  | one mandatory local reward entry                              |
| Devotion room                     | `beforeCombat` and `afterCombat`               | chosen and spurned entries at separate sites                  |
| O active reward-wheel phase       | exact active phase pickup point                | selected wheel entry only; dormant phases publish nothing     |
| H active cage                     | exact cage/local-reward pickup point           | selected cage reward entry; inactive suffix publishes nothing |
| N entered main visit              | exact visit reward point                       | selected main reward entry once per entered visit             |
| World Shop                        | explicit post-outgoing `roomExit` point        | optional purchased entries in authored order                  |
| Preboss Shop                      | explicit `roomExit` point without outgoing     | optional purchased entries in authored order                  |
| Current fixed/free Preboss reward | its existing declared producer point           | mandatory entry through the same coordinator                  |

The source audit and current lifecycle declarations determine any additional
existing producer roles found during the required pre-implementation inventory.
No direct acquisition path may be silently left outside because it was absent
from this summary table.

Story and empty producers that emit no concrete acquisition publish no fake
entry. A structurally reached point may produce an empty settlement product
only when a real supported point exists there.

## Lifecycle and timing contract

### Preserve exact existing timing

Canonicalization does not move acquisitions. It replaces the implementation at
their current declared lifecycle point:

```text
existing acquisition operation reaches exact point
  -> materialize due entries for that site
  -> settle them once
  -> continue lifecycle from the post-settlement branches
```

Examples:

```text
Standard Reward
  encounter -> roomRewardPickup settlement -> outgoing generation

Devotion
  chosen settlement -> combat -> spurned settlement -> outgoing generation

O/H composite room
  active phase/cage -> its exact settlement -> next active phase/cage

World Shop
  inventory -> entry -> outgoing generation -> roomExit settlement

Preboss Shop
  inventory -> entry -> roomExit settlement -> commit
```

The engine must not introduce a universal `lastPoint`, `postEncounter`, or
`endOfRoom` fallback. Existing producer points and resolved structural
envelopes own ordinary/composite placement. Only World Shop, Preboss Shop, and
later Narcissus require the new explicit `roomExit` declaration in this plan.

For those explicit points, replace the Shop-specific lifecycle operation with
one closed generic operation equivalent to:

```ts
{
  kind: 'settleAcquisitionPoint';
  pointKey: 'roomExit';
}
```

It emits one exact `acquisitionPointReached` lifecycle event consumed by the
settlement coordinator. Existing `advanceProducer`, active wheel-acquisition,
and exact local-reward/encounter events remain the triggers for their current
sites; do not insert a second generic operation beside them. Catalog
normalization validates nonblank point keys and rejects duplicate explicit
point operations in one lifecycle profile.

### One execution, necessary before/after views

The settlement product retains the exact pre- and post-site branch views.
Lifecycle consumers use the view appropriate to their declared position.

For World Shop and later Narcissus:

```text
pre-settlement history
  -> outgoing batch is generated and frozen
  -> roomExit site settles exactly once
  -> selected target prepares from post-settlement history
```

An incomplete outgoing decision may stop topology traversal, but it does not
erase room work already reached after outgoing generation. The same returned
settlement product must support progressive authoring before and after a
continuation is selected. No discarded replay or second simulation call is
permitted.

Run State for the already-generated decision continues to show its existing
pre-offer snapshot. Current-site acquisition effects appear in later decision
snapshots.

## Settlement coordinator contract

Simulation owns one chronological coordinator used by every current
acquisition site:

1. resolve the exact site and active entry domain;
2. validate authored overlay contact where an overlay exists;
3. derive mandatory participation and singleton order where no author choice
   exists;
4. retain exact pre-settlement branches;
5. process participating entries sequentially;
6. resolve the entry's closed producer/acquisition role;
7. invoke the existing reward kernel for concrete history effects;
8. apply the entry's exact trait, level, and targeted children;
9. append exact site/entry-addressed acquisition events and findings;
10. merge only equivalent post-entry branches; and
11. freeze and return the complete site product.

The coordinator does not implement offer generation, Shop inventory policy,
room eligibility, reward bags, encounter topology, or provider-specific trait
switches. Those authorities supply its explicit inputs.

`processProducerRole`, `processOwnedRewardAcquisition`, wheel/cage direct folds,
and Shop purchase processing must converge on this coordinator or be replaced
by narrow entry resolvers called only from it. None may remain an independent
history-writing acquisition path.

The coordinator result crosses a stage boundary only with fields consumed by
later simulation, candidates, findings, or a projected orderable workbench. Do
not add a production closure manifest, duplicate event ledger, or exhaustive
site registry whose only consumer is testing.

Reuse `concreteAcquisition` as the one reward-history event for acquired roles,
with exact entry/site provenance added to that event or supplied by its origin.
Do not append a second `settlementApplied` event describing the same mutation.
The Shop-only `shopPurchasesSupported` event and its private order witness have
no surviving semantic role once the returned settlement product owns that
assessment and should be removed with Shop-private chronology.

### Progressive evaluation

Candidate evaluation replaces one proposed complete site order or one exact
child leaf referenced by an entry against branch contexts returned by the
canonical settlement product. It does not retraverse room history, rerun a
Shop, or reconstruct a site from React state.

Evaluation may find that:

- a purchase requirement fails at its chronological position;
- a reward source is unavailable at acquisition time;
- a Pom target is absent;
- a hidden Blind Box source or trait offer is unavailable; or
- an earlier entry changes the support of a later one.

The first blocked atomic region exposes every co-owned finding and exact repair
interaction. Later entries must not publish a false valid post-state.

### Dormancy

- A mandatory active entry always participates.
- An available but nonparticipating optional entry publishes its participation
  control but no acquisition-child finding.
- Dormant persisted children restore when compatible participation resumes.
- An entry absent from the active producer set publishes nothing.
- An inactive O/H phase, unvisited N room, unentered side room, or Hub restore
  publishes no settlement site or event.
- The persistent Hub itself publishes no site.

## Shop contract correction

Shop inventory remains the authority for generated slots, option requirements,
labels, offer values, and producer-local conditions. It keeps the visible
**Purchased** control, but that control edits membership in the canonical
site order.

`ShopState` retains producer-local facts such as profile and applicable Death
Defiance state. It does not retain a second purchase chronology.

The migration must:

- replace `ShopState.purchaseOrder` with the exact site's `order`;
- replace `ReplaceShopPurchaseOrder` with a generic site-order command;
- retain `ReplaceShopOffer` as the producer-facing offer edit;
- preserve a purchased entry's order position when its offer changes;
- preserve invalid authored offers and surface findings rather than silently
  unpurchase or replace them;
- associate Shop trait/Pom/level children with their settlement entries while
  retaining their existing exact leaf addresses;
- replace `applyShopPurchases` and `shopPurchasesApplied` with the shared
  settlement operation/product; and
- delete `frontierShopPurchaseBranches` and its discarded replay.

The World Shop outgoing batch must be byte-for-byte invariant under purchase
membership, order, trait, and Pom edits. A Preboss Shop must settle without a
fabricated outgoing operation.

## Narcissus contract

Narcissus layers onto the delivered seam only after every current acquisition
family and Shop pass their gates.

The outer story interaction remains an ordinary fixed-Common three-choice
trait-provider surface. Its selected descriptor has one closed disposition:

```text
equip direct trait
produce declared pickups
supported no-op
```

A pickup-producing descriptor materializes zero or more site-owned optional
entries at the G Story room's explicit post-outgoing `roomExit` site. The
descriptor does not enter equipped-trait history and does not own nested Pom,
reward, or trait details.

Supported output mapping:

| Descriptor   | Active pickup entries                 | Supported behavior                                         |
| ------------ | ------------------------------------- | ---------------------------------------------------------- |
| `NarcissusA` | one `StoreRewardRandomStack`          | optional pickup with exact random-Pom target               |
| `NarcissusB` | none                                  | supported no-op                                            |
| `NarcissusC` | none                                  | supported no-op                                            |
| `NarcissusD` | one `MaxManaDrop`                     | optional concrete pickup                                   |
| `NarcissusE` | one `MaxHealthDrop`                   | optional concrete pickup                                   |
| `NarcissusF` | none                                  | supported no-op                                            |
| `NarcissusG` | two distinct `ElementalBoost` entries | independently optional; each adds all four base elements   |
| `NarcissusH` | one `LastStandDrop`                   | optional; source-local Death Defiance condition remains    |
| `NarcissusI` | one `BlindBoxLoot`                    | optional pickup owning hidden source and fresh trait offer |

Unsupported money, resource quantity, healing, reroll, and story-progression
effects create no placeholder entries.

Changing the descriptor reconciles active site-owned pickup payloads
atomically:

1. retain only declaration-compatible entries with the same stable key and
   concrete contract;
2. install complete defaults for newly active entries;
3. remove entries no longer produced;
4. filter removed keys from the order without reordering survivors; and
5. let Undo restore the exact prior document.

Selecting the descriptor alone changes neither loot nor equipped-trait
history. Only picked entries in the authored `roomExit` order settle. Because
the room's exits are already generated, those acquisitions affect later rooms
but never the current outgoing batch.

## Commands, codec, and schema contact

Add a semantic order replacement command equivalent to:

```ts
{
  kind: 'ReplaceAcquisitionOrder';
  site: AcquisitionSiteAddress;
  entryKeys: readonly string[];
}
```

It validates structural authorship only:

- exact site contact;
- each key belongs to the site's active entry domain;
- keys are distinct.

It does not consume evaluation or reject a context-invalid sequence. Selected
simulation and candidates own contextual legality.

The default optional order is empty. Enabling an optional entry appends it;
disabling it removes it while preserving compatible payload/detail; reordering
changes only position. One visible action is one undo step.

The schema-20 decoder derives expected occurrence-owned authored site and entry
domains from the catalog plus authored topology/producer state. It rejects:

- a missing Shop site, or a missing Narcissus site when its selected descriptor
  owns active pickup entries;
- a Narcissus point persisted for a selected no-output descriptor;
- site state for an unreachable or unsupported occurrence point;
- missing or unknown active site-owned pickup keys;
- order keys outside the exact site;
- duplicate order members;
- unsupported trait/level children; and
- source references that do not resolve to the exact producer offer.

Schema 19 remains a deliberate contact break under the current exact-schema
policy. Fixtures update once. Narcissus reuses schema 20 and causes no second
schema bump.

## Findings and interaction ownership

Finding ownership follows the repair control:

- producer offer generation/selection findings remain at the producer;
- participation findings route to the source-visible Purchased/Picked up
  control;
- chronology findings route to the exact settlement site;
- concrete acquisition chronology routes to the exact entry, while
  trait/Pom/level findings retain their exact child addresses and containing
  entry destination;
- no finding is addressed by slot index, rendered order, provider name, or
  inferred containing card.

The workspace closure validator proves semantic-owner reachability. One entry
may be referenced from its producer summary and containing Acquisitions card,
but its exact address resolves to one canonical interaction package.

## Workspace and UI contract

### Ordinary singleton sites

Room and reward selection stays exactly where it is. A one-entry mandatory
site does not gain a bulky empty card or order controls.

Its acquisition-time children render as a compact canonical acquisition row
adjacent to the existing reward surface. Visually this may preserve the current
Edit Trait placement. The existing exact child address remains the interaction
owner, and the existing reward workbench remains its containing navigation.
Do not add a second entry destination merely to expose the internal settlement
identity.

When a later delivery adds a competing item, that same site can expand into an
ordered Acquisitions section without changing its semantic owner.

### Composite current sites

O phases, H cages, N main visits, and N side rooms expose acquisition children
at the nearest existing exact phase/local/visit workbench. They do not create
one room-flat order or duplicate dormant/unvisited controls.

This delivery canonicalizes their semantic sites and entries. It does not add
future Shrine delivery controls.

### Multi-entry/orderable sites

The structured workspace projects one data-only **Acquisitions** workbench for
an orderable or multi-entry site. React renders supported rows and bound
interactions without inspecting room names, reward types, Shop profiles,
descriptor keys, or history.

For post-outgoing sites, the card renders below the source's exit cards in the
containing decision inspector. For a no-outgoing Preboss Shop, it renders after
the room's producer surface.

The Shop inventory keeps:

- offered item/reward controls;
- **Purchased** checkbox; and
- producer conditions/findings.

It loses:

- per-row Purchase Order selectors;
- acquisition-time Edit Trait controls;
- Pom target controls; and
- any second acquisition chronology.

The Acquisitions card shows participating entries in exact order with move
earlier/later actions, reward summary, acquisition-child controls, and exact
findings. Narcissus also lists active nonparticipating pickups with **Picked
up** controls. Unpurchased Shop rows are not duplicated in that available list;
their existing Purchased control edits the same order membership.

Drag reordering may be added later as a second input over the same command.
Accessible move buttons are required now.

### Navigation

The workspace publishes:

- one destination per projected orderable/multi-entry site;
- one containing destination and interaction package per entry rendered in
  that workbench;
- exact nested destinations for trait, Pom, and level children;
- order/participation interactions; and
- marker aggregation that never hides repair controls.

Derived singleton sites continue to use their existing reward and exact child
destinations. Workspace closure must not require a UI node for every internal
settlement result.

Selecting a child finding navigates to the containing canonical acquisition
row and opens the trait dialog only when the exact child requires it.

## Delivery gates

Each gate is a complete vertical slice for its named acquisition families. It
must move authority, consumers, and primary tests and delete the superseded
history-writing path in the same commit. Interface-only, compatibility, and
forwarding commits are not acceptable gate boundaries.

### Gate A — Canonical settlement authority for ordinary producers

Establish the shared engine product and migrate standard, Ephyra Opening and
PreHub, Devotion, fixed/free Preboss, and other non-composite
`advanceProducer` paths. N Hub main visits and side rooms belong exclusively to
Gate B.

Required delivery:

1. Inventory all current acquisition-history writers and lock the full mapping
   in a focused engine test fixture.
2. Add exact site/entry addresses and derived singleton site products without
   reparenting existing exact child leaves.
3. Add the settlement coordinator and route ordinary acquisition roles through
   it at their existing timing.
4. Make trait/Pom/level candidates and findings consume the entry's exact
   branch context while retaining their existing child addresses.
5. Preserve compact workspace rows and room/reward selection; change
   application projection only if an existing visible control needs a real new
   engine product.
6. Delete the migrated direct history-writing paths.

Acceptance:

- standard and Ephyra Opening rewards still affect the same outgoing batch;
- Anomaly success acquires its retained reward while failure remains a genuine
  non-acquisition; neither path creates a second offer;
- ordinary rewards reached through Chaos/Zagreus continuations retain their
  existing timing without detour-specific settlement policy;
- Devotion chosen/spurned roles remain on opposite sides of combat;
- one resolved Devotion offer produces two distinct entry products without
  duplicating its offer or renaming its role-specific child leaves;
- singleton sites require no new persisted order or checkbox;
- progressive trait/Pom/level editing observes the exact pre-acquisition
  history;
- run-state and event history are behaviorally equivalent at every migrated
  checkpoint; and
- no migrated producer can bypass settlement to write acquisition history.

Default commit:

```text
refactor(engine): canonicalize ordinary acquisition settlement
```

### Gate B — Composite and nested current acquisition sites

Migrate O reward wheels, H cage rewards, N entered main visits, and N entered
side-room rewards.

Required delivery:

1. Derive exact site instances from active structural envelopes and existing
   phase/local/visit identities.
2. Route each active selected reward through the shared coordinator.
3. Preserve active-prefix, visited, and entered-once semantics.
4. Preserve existing exact acquisition-child workspace destinations while
   making their candidates consume the canonical site result.
5. Delete composite-family direct history folds superseded by settlement.

Acceptance:

- every selected active O wheel settles at its own phase point before the next
  phase;
- dormant O phases publish no site or acquisition;
- every active H cage settles at its own local point and inactive suffix cages
  publish nothing;
- a visited N main room settles once at the exact visit, not on Hub restore;
- an entered N side room settles its local reward once and an unentered room
  publishes no site;
- the persistent Hub itself owns no acquisition site; and
- no room-flat order is invented for composite families.

Default commit:

```text
refactor(engine): canonicalize composite acquisition sites
```

### Gate C — Shared authored order and Shop migration

Introduce schema 20, migrate Shop chronology, add explicit `roomExit` sites,
and remove the incomplete-Midshop replay.

Required delivery:

1. Add authored point overlays and the generic order command.
2. Add explicit World/Preboss Shop `roomExit` lifecycle declarations.
3. Materialize Shop entries as references to the existing Shop offers.
4. Move purchase membership/order into the exact site state.
5. Settle World and Preboss purchases through the shared coordinator.
6. Publish the same first-class settlement product at incomplete and complete
   Midshop topology.
7. Associate existing acquisition-child addresses with Shop entries, add
   entry-owned addresses only for site-owned pickups, and project the
   multi-entry workbench.
8. Delete Shop-private order, purchase execution, discarded replay, and old UI
   chronology.
9. Update persisted fixtures once to schema 20.

Acceptance:

- World Shop exits are byte-for-byte unchanged by all purchase edits;
- selected later rooms observe post-purchase history;
- Preboss Shop settles without an outgoing batch;
- incomplete and completed Midshop topology publish equivalent site
  assessment, child candidates, findings, and post-settlement state;
- empty order is complete and acquires nothing;
- purchase membership and order are one authored fact;
- reordering can change later purchase support/results;
- unpurchased children are dormant and finding-free;
- Shop inventory has no order or acquisition-child controls; and
- `ShopState.purchaseOrder`, `ReplaceShopPurchaseOrder`,
  `applyShopPurchases`, `shopPurchasesApplied`, and
  `frontierShopPurchaseBranches` are absent.

Default commit:

```text
refactor(planner): establish authored acquisition order
```

### Gate D — Narcissus as an ordinary pickup producer

Layer Narcissus onto the delivered contract without changing the persisted
shape again.

Required delivery:

1. Add fixed-Common Narcissus giver, labels, exact pool, requirements, and
   `Story_Narcissus_01` binding.
2. Add the closed equip/produce/no-op descriptor disposition.
3. Declare exact pickup outputs and defaults.
4. Add the G Story post-outgoing `roomExit` point.
5. Reconcile site-owned pickup payloads when the selected descriptor changes.
6. Keep the outer offer on the story room's primary surface.
7. Project optional pickups into the existing Acquisitions workbench.
8. Settle picked entries through the same coordinator and reward kernel.
9. Put random-Pom and Mystery Boon editing on concrete entry rows.
10. Record Elemental Boost through concrete acquisition semantics.

Acceptance:

- descriptor selection alone changes no reward or equipped-trait history;
- each descriptor produces exactly its declared active entries;
- unpicked drops produce no mutation or active child finding;
- picked drops apply in authored `roomExit` order;
- current G outgoing offers remain unchanged;
- an incomplete G outgoing decision publishes the same Narcissus pickup,
  child-candidate, finding, and post-settlement product as the completed
  topology;
- later decisions observe every supported picked effect;
- random Pom targets exactly one eligible trait;
- two distinct Elemental Boost pickups each add all four base elements;
- Last Stand reuses the source-local Death Defiance condition;
- Blind Box owns its source and fresh trait offer at the acquisition entry;
- descriptor changes reconcile active payloads and Undo restores prior state;
  and
- no provider-specific candidate query or nested option outcome model exists.

Default commit:

```text
feat(planner): model Narcissus room-exit pickups
```

### Gate E — Closure and documentation absorption

1. Run the complete repository gate.
2. Compare production growth with deleted direct folds, Shop replay/order, and
   prototype-only machinery.
3. Search for every rejected or superseded symbol.
4. Verify one primary test owner per policy matrix.
5. Reassess Echo only against the delivered contract; do not implement it.
6. Absorb durable rules into `REWARD_MODEL.md`,
   `ROOM_LIFECYCLE_MODEL.md`, `AUTHORED_PROJECT_MODEL.md`,
   `SIMULATION_AND_VALIDATION.md`, `STRUCTURED_EDITOR_WORKSPACE.md`, and
   `EDITOR_MODEL.md`.
7. Update the audit only if implementation discovers a source fact.
8. Record completion in `IMPLEMENTATION_PROGRESS.md`.
9. Retire this plan and the superseded Story-traits plan.

Default commit:

```text
docs: absorb acquisition settlement delivery
```

## Primary test ownership

### Hades II catalog

- exact reward role-to-point bindings for current producers;
- explicit World Shop, Preboss Shop, and G Story `roomExit` point order;
- exact O/H structural point compatibility and active-prefix declarations;
- exact Shop inventory declarations remain unchanged;
- exact Narcissus pool, labels, rarity, requirements, descriptor disposition,
  output keys, offers, participation, and defaults;
- `ElementalBoost` concrete effect; and
- normalization rejects unknown point/effect/output references.

### Authored project

- schema-20 exact-key decoding and contact failure;
- no authored state for derived mandatory singleton sites;
- Shop authored point defaults and empty order;
- optional order subset and uniqueness validation;
- generic order command no-op/replacement behavior;
- offer replacement preserves one canonical value and compatible child state;
- existing exact trait/level commands plus entry-owned children for site-owned
  pickups;
- occurrence/local replacement and retention rules;
- Narcissus descriptor-to-pickup reconciliation;
- JSON round trip, Undo, and Redo; and
- malformed/source-incompatible state rejection.

### Lifecycle, reward, trait, and candidates

- one primary full mapping fixture for every current acquisition writer;
- exact standard, Opening, Devotion, O, H, N, Shop, and Narcissus chronology;
- behavior equivalence at each migrated current checkpoint;
- frozen World Shop and Narcissus outgoing batches;
- incomplete/complete Midshop settlement equivalence;
- exact entry chronology and first-blocking behavior;
- dormant/nonparticipating suppression;
- candidate replacement of complete order and entry leaves;
- concrete Narcissus effects; and
- absence of descriptor keys from equipped state.

The full policy matrices live here, not in React.

### Planner application and UI

- closure reaches every projected orderable site and entry plus every existing
  exact child semantic owner;
- producer and acquisition findings route to their distinct repair surfaces;
- ordinary singleton controls remain compact and nonduplicated;
- O/H/N controls resolve to exact phase/local/visit entries;
- Shop inventory retains offer/Purchased but loses order/Edit Trait/Pom;
- Acquisitions renders in the correct containing inspector;
- move, purchase, pickup, trait, and Pom intents dispatch complete commands;
- invalid current values remain visible and repairable; and
- one focused witness per materially distinct presentation family.

### Product loop

Retain representative workflows only:

1. acquire an ordinary trait-bearing room reward and observe its effect at the
   same outgoing-generation and later-state timing as the baseline;
2. process one composite O/H/N reward through the same entry contract;
3. enter a Midshop, author purchases before selecting the next room, repair an
   acquisition child, then observe unchanged exits and changed later state;
4. select a Narcissus benefit, pick/order its output, edit its child, and
   observe the next decision; and
5. save/reload schema 20 with identical acquisition order and results.

## Verification commands

Use targeted files or the narrowest truthful lane while iterating:

```text
Catalog declarations/normalization: npm run test:catalog
Engine authored/simulation/candidates: npm run test:engine
Planner projection/workspace: npm run test:planner
Leaf UI: npm run test:ui
Representative cross-layer workflow: npm run test:product
Closure: npm run check
```

Do not run the complete suite after each focused adjustment. Run `npm run
check` once after Gate E integration and before push/phase closure, and earlier
only when a broad shared/configuration change truthfully requires it.

## Expected deletion and no-parallel-path audit

### Before Gate A

From the clean baseline, record:

- every production caller that writes concrete reward/trait history;
- every caller of `processProducerRole`,
  `processOwnedRewardAcquisition`, and `processShopPurchases`;
- O/H/N direct acquisition loops;
- every use of `frontierShopPurchaseBranches`;
- authored/codec/command references to `purchaseOrder`;
- workspace/UI references to producer-owned acquisition children; and
- focused test counts for each affected authority.

### Required removals

Gates A-B must remove independent direct history folds for their migrated
families. Narrow source-specific entry resolvers may remain only when invoked
by the settlement coordinator and unable to commit history independently.

Gate C must remove or supersede:

- `ShopState.purchaseOrder`;
- `ReplaceShopPurchaseOrder`;
- Shop-private purchase-order candidate/query naming;
- `applyShopPurchases` and `shopPurchasesApplied`;
- `shopPurchasesSupported`;
- `frontierShopPurchaseBranches` and synthetic appended products;
- Shop-row rendering of acquisition-time children;
- Shop-row order selectors; and
- any second order reconstructed in the application or React.

Gate D must not reintroduce the prototype's:

- provider-named `TraitSelectedOutcome` effect cases;
- `AuthoredTraitOption.outcomeResolution`;
- `ReplaceTraitOutcomeResolution`;
- option-local reward/Pom/trait nesting;
- reward facts threaded through ordinary trait candidates for later pickups;
- synthetic `NarcissusOutcome` lifecycle;
- immediate `encounterCompleted` pickup acquisition; or
- provider-key switches in simulation, projection, or React.

Use behavior tests for semantic absence. Source-token architecture tests are
appropriate only for statically observable dependency/ownership boundaries.

## Growth discipline

The acceptance question is not whether the repository has fewer lines. It is
whether every concrete acquisition now changes through one narrow path:

```text
resolved producer offer or site-owned pickup
  -> exact atomic acquisition entry
      -> declaration-owned role or roles at that site
          -> exact lifecycle site
              -> one settlement coordinator/product
                  -> existing reward kernel
                      -> exact workspace interaction
```

Any net production growth must correspond to a real catalog contract,
persisted authored choice, returned simulation product, semantic address or
command, or visible interaction. Test-only audit manifests, shadow runtime
models, compatibility wrappers, and producer-specific copies fail closure.

The implementation should reduce the future change neighborhood: adding a new
concrete pickup producer must not require a new history fold, candidate engine,
finding policy, or React-specific provider switch.

## Final closure checklist

- [ ] The audit, corrected plan, and supersession note were committed first.
- [ ] The prototype stash includes untracked files and its object ID is
      recorded.
- [ ] Implementation began from clean schema-19 source.
- [ ] Every current concrete acquisition writer was inventoried.
- [ ] Ordinary, Devotion, O, H, N, and Shop acquisitions use one coordinator.
- [ ] Every reached site is declaration/structure-owned and exactly addressed.
- [ ] A resolved offer is never duplicated into a settlement entry.
- [ ] Every acquisition role appears once at its exact lifecycle site.
- [ ] Mandatory singleton sites require no speculative persisted state.
- [ ] Every optional participant has one acquired/not-acquired fact.
- [ ] Every authored order is checkpoint-local and contains exact entries.
- [ ] Current outgoing offers use the correct pre-settlement history.
- [ ] Later lifecycle work uses post-settlement history.
- [ ] Incomplete Midshop authoring uses the same authority as traversal.
- [ ] Preboss Shops settle without a fabricated outgoing checkpoint.
- [ ] Acquisition entries reference exact child addresses and one persisted
      value; only site-owned pickups use the entry as child owner.
- [ ] Compact singleton UI does not duplicate producer controls.
- [ ] Findings remain adjacent to exact repair controls.
- [ ] React contains no settlement or provider policy.
- [ ] Narcissus descriptors do not equip or own pickup detail.
- [ ] Narcissus pickups are ordinary site-owned entries.
- [ ] Schema bumps once and Narcissus needs no second shape change.
- [ ] Superseded direct, Shop, replay, and prototype paths are deleted.
- [ ] Narrow lane tests and final complete repository gate pass.
- [ ] Durable rules are absorbed and temporary progress documents retired.
