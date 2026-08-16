# Echo Gold Gold Gold Shop Chronology Correction

## Status

Locked after source, live-code, and independent adversarial review. The implementation base is
`73f9e13` (`feat: implement infernal contract and travel deal`). No production
work begins until this document is committed.

This plan supersedes only the immediate-settlement model for Echo's Gold Gold
Gold effect. Infernal Contract, Travel Deal, the other seven Echo choices, and
the ordinary Shop inventory model remain as delivered.

Completing this correction closes the All Together/Infernal Contract/Travel
Deal phase whose earlier temporary plan remains in
`ALL_TOGETHER_AND_SHOP_TRAITS_IMPLEMENTATION.md`. The correction therefore also
owns that phase's durable absorption and final complete gate; it does not leave
either temporary plan active afterward.

## Objective

Represent Gold Gold Gold as one source-derived free Shop pickup whose payload
and participation are authored separately from its position in the existing
room-exit acquisition order.

The resulting Shop must answer two different questions without mixing them:

1. **What exists and is it taken?** The Shop inventory surface owns one stable
   Gold row with its complete duplicate payload and `Picked up` participation.
2. **When is it taken?** The existing Acquisitions workbench owns the one order
   containing paid purchases, the Travel refill, the Gold pickup, and the
   Infernal Contract pickup.

The correction must remove the current assumption that the duplicate settles
immediately after its source purchase.

## Source facts

The installed source establishes three separate contacts.

### Pending trait and source purchase

- `TraitData_Echo.lua:288-294` gives `EchoDoubleShop` one remaining use and
  `DuplicateWorldShopItem = true`.
- `StoreLogic.lua:330-379` handles a purchased World Shop item in
  `RemoveStoreItem`.
- When `DuplicateWorldShopItem` is present and the purchased item is not
  `SpellDrop`, `RemoveStoreItem` calls `UseHeroTraitsWithValue` and creates a
  separate free object.
- `TraitLogic.lua:430-452` decrements/removes the one-use trait in that call.
  Gold is therefore consumed by duplicate creation at the source purchase,
  not by later pickup.
- `SpellDrop` neither creates a duplicate nor consumes Gold.

### Materialization

- A loot purchase calls `CreateLoot` for the duplicate.
- `RoomLogic.lua:2240-2292` creates that world object and calls
  `SetTraitsOnLoot` during creation.
- `InteractLogic.lua:640-676` calls `RemoveStoreItem` before
  `HandleLootPickup` opens and settles the purchased loot choice. The recreated
  loot's options are therefore fixed against the branch before the purchased
  boon is added to trait history.
- `TraitLogic.lua:1750+` generates the loot's option data at that materializing
  contact. Later room acquisitions do not regenerate the already-created loot.
- Pom loot is the exact exception. `UpgradeChoiceLogic.lua:118-133` checks
  `StackOnly` when the interaction opens; if any stored Pom option is no longer
  equipped, it calls `SetTraitsOnLoot` again and replaces the option set.
- A non-loot purchase creates a separate consumable object through
  `CreateConsumableItem`; `InteractLogic.lua:1000+` likewise calls
  `RemoveStoreItem` before applying that purchased consumable's effects.
- The created duplicate is marked `CanDuplicate = false` and cannot recursively
  consume or trigger Gold again.

### Later interaction

- Creating either object does not invoke its interaction.
- The player may interact with other Shop items or free pickups before taking
  the duplicate.
- Consumable effects occur through the ordinary later `UseConsumableItem`
  path.
- Blind Box's `ReplaceWithRandomLoot` runs on interaction in the source game,
  rather than when the box object is created.
- The planner deliberately simplifies that Blind Box timing as described
  below.

### Travel Deal ordering

- The same `RemoveStoreItem` call may also schedule `RestockWorldItem` for the
  first paid purchase when Travel Deal was already equipped.
- Gold materialization and Travel scheduling both occur at the paid
  removal/contact before the player can settle another authored room entry,
  but they do not share one history frontier. Gold creates its object
  immediately, before the purchased item's acquisition effect. Travel's
  `RestockWorldItem` may wait for the purchased screen and retains the settled
  Gate-B generation contract.
- Their later acquisitions remain independent: the player may buy the Travel
  refill before taking Gold, take Gold first, or interleave other entries.
- A `SpellDrop` source may activate Travel while leaving Gold armed. A later
  eligible initial purchase or paid Travel refill may then materialize Gold.

## Chosen planner simplifications

### Reuse the Travel Deal derived-slot mechanism

Gate B already introduced the complete structural machinery this correction
needs:

- one optional supplemental child under the Shop's existing `roomExit`
  acquisition site;
- one stable disabled-placeholder/active-row capability;
- one branch-attested derived source, default payload, reward-type domain, and
  offer evaluator;
- one semantic materialization/participation path;
- dependency-aware complete proposals for the existing acquisition order;
- one application `supplementalOffers` collection and reward-control adapter;
  and
- one React supplemental-row renderer plus the existing Acquisitions
  workbench.

The correction generalizes that Travel-specific mechanism just enough to carry
two declaration-owned policies. Travel supplies paid-purchase participation and
its first-purchase restock producer; Gold supplies free-pickup participation and
its first-non-Spell duplicate producer. They share the structural product,
candidate frontier, semantic command family, order proposal service,
application adapter, and React renderer.

Do not add a Gold-only candidate map, command family, order, pending state,
workspace assembly path, or React component. Any currently Travel-named
structural API that both effects need should become one derived-Shop-entry API,
with closed Travel/Gold policy tags at the catalog or engine authority. This is
not a generic callback/effect registry.

### One stable Gold row

Each supported reached World Shop owns at most one structural Gold child with
the fixed entry key `echoDoubleShopReward`.

The project does not persist one child per possible source. The engine derives
and publishes the current `sourceOfferKey` from canonical Shop-entry trait
history and the authored acquisition order.

The derived source is the first reached paid entry that:

- is an initial Shop offer or the Travel Deal refill;
- is encountered while the exact `EchoDoubleShop` acquisition remains
  equipped; and
- is not `SpellDrop`.

Infernal Contract, Gold itself, other free pickups, and Echo duplicates are not
paid sources.

### Complete payload before chronology

Once a valid source is derived, the Gold row owns the complete duplicate
payload through the existing reward editor and nested acquisition controls.

For Blind Box, the planner intentionally resolves and authors the duplicate's
hidden loot source on this row. It does not delay that choice to the row's later
position as the game does. This keeps payload authorship separate from order:
the order stores only the stable Gold entry key.

The source-time candidate product owns the allowed duplicate payload domain.
It is computed from the exact pre-source-acquisition branch plus the already
authored paid source identity. The newly purchased boon or consumable effect is
not present in that generation history. The source's own nested acquisition
then settles after Gold materialization.

Later order entries do not regenerate that domain for ordinary loot or
consumables. Settlement at the authored pickup position may still reject a
selected acquisition whose then-current run state makes it impossible; that
rejection belongs to the Gold row and does not silently reroll the materialized
payload.

Pom duplicates retain the source game's one closed exception. The planner
persists only the final player-visible Pom offer, not a discarded hidden option
set. If every source-time Pom option remains equipped, the authored final offer
must be supported by the frozen source-time frontier. If at least one trait
that was Pom-eligible at source time disappeared before pickup, the game could
have included that trait and triggered `StackOnly` regeneration; under the
planner's possibility model, the authored final offer may instead come from
the pickup-time Pom frontier. This is an existential source-to-pickup check in
the shared Gold evaluator, not hidden authored state, probability, or a generic
reroll timeline.

### Participation is separate from materialization

Materializing the Gold row consumes the Echo trait even when the row's
`Picked up` checkbox is false. Selecting `Picked up` adds the stable Gold key to
the existing acquisition order; clearing it removes only the later pickup, not
the already-attested source-time consumption.

This is the planner's explicit possibility model for leaving a spawned free
object behind. It applies uniformly rather than branching authored shape by
whether a particular source object blocks the game-room exit.

### One chronology

The Gold entry participates in the existing Shop `roomExit` acquisition order.
It has no private order and no nested position under its source.

Its legal positions are strictly after the derived source. It may otherwise be
interleaved with:

- later initial paid purchases;
- the paid Travel Deal refill;
- the free Infernal Contract pickup; and
- other supported entries at that same site.

The default complete proposal inserts a newly selected Gold entry immediately
after its source. That default is convenience, not forced chronology.

Travel and Gold dependencies are evaluated together by the existing complete
Shop-order proposal authority. The generalized product owns the full set of
derived-entry dependencies for the site rather than accepting one hard-coded
Travel source plus a second Gold-specific check. A proposal must recompute
Gold's first eligible source after a purchase is added, removed, or moved. It
must also handle dependent changes atomically: removing Travel's source removes
the selected refill. Gold deterministically rebinds to the first reached
eligible paid entry in the resulting order. A selected Gold key keeps its
existing later position when that remains legal; otherwise the one complete
proposal moves it immediately after the rebound source. If no eligible source
remains, the proposal removes only Gold's order membership and retains its
dormant singleton payload. React never performs this transitive repair.

## User-visible Shop model

The Shop inventory surface preserves declaration-owned initial slots and then
renders the supplemental rows in this order:

```text
<N declaration-owned Shop slots>
---------------------------------
Travel Deal refill after <its source>
Gold Gold Gold duplicate of <its source>
---------------------------------
Infernal Contract reward
```

Travel and Gold label their own sources because those sources may differ. They
also retain their own declaration-owned generation frontiers; sharing the
derived-entry structure does not make Gold use Travel's post-purchase history.

### Dormant and active states

- Without Travel Deal at Shop entry, no Travel row is published.
- With Travel Deal but no reached paid source, one disabled Travel placeholder
  explains how to activate it.
- Without an armed Gold trait at Shop entry, no Gold row is published.
- With armed Gold but no reached eligible source, one disabled Gold placeholder
  explains that a non-Spell paid purchase must be selected and ordered.
- Once a source is derived, the Gold row becomes an editable complete reward
  row with a `Picked up` checkbox.
- A disabled Gold placeholder does not increase the opportunity count. A
  source-derived Gold row is one real free opportunity and increases that count
  whether or not `Picked up` is selected.
- A retained selected Gold child whose source or payload becomes context-invalid
  remains visible as the exact repair surface.
- The disabled placeholders are presentation products, not authored children,
  semantic markers, or finding destinations.

### Acquisitions workbench

Only participating entries appear in the chronological workbench. Gold appears
as a peer row labeled `Gold Gold Gold duplicate of <source>`, with ordinary
move controls constrained by engine-owned complete proposals.

It does not display a `Purchased` label, cost, or Shop-removal semantics.
React does not infer the source, allowed payload, consumption timing, or legal
positions.

## Authored model and schema

Advance schema 37 to schema 38.

Schema 38:

- reserves `echoDoubleShopReward` as the sole Gold supplemental key;
- rejects source-keyed `echoDoubleShop:<offerKey>` children;
- permits the stable Gold key in the Shop `roomExit` order;
- keeps the complete payload under `pickupEntries.echoDoubleShopReward`;
- requires that complete child whenever the Gold key participates in the order,
  while permitting the child to remain dormant when the key is absent;
- persists no source selector, pending flag, consumed flag, UI placement, or
  second order;
- retains structurally valid dormant Gold payload under a supported Shop;
- rejects the Gold key as an initial declaration-owned Shop slot; and
- rejects schema 37 outright rather than carrying compatibility decoding.

These are extensions to the generalized supplemental-entry vocabulary already
used by Travel and Contract. Schema 38 does not introduce a separate Gold state
object or another acquisition-site shape.

The decoder can enforce structural ownership, exact keys, payload shape,
uniqueness, and order membership. Whether the Gold entry currently has a
reached eligible source and occurs after that exact source is contextual
simulation/candidate policy, not a reason to make retained authored state
undecodable.

## Simulation chronology

For each branch, the canonical Shop fold performs these contacts:

1. materialize the declaration-owned Shop and supplemental structural defaults;
2. record whether Gold and Travel were equipped at Shop entry;
3. settle acquisition-order entries in authored order;
4. after the shared Shop kernel accepts a paid purchase, but before that
   entry's acquisition roles settle, test Gold's first non-Spell rule against
   the pre-entry branch and retain whether this is Travel's first purchase;
5. before the paid entry's acquisition roles settle, consume the exact Echo
   trait and freeze the singleton Gold materialization product from that
   pre-acquisition branch, whether or not its pickup key is selected;
6. settle the paid entry's ordinary acquisition roles;
7. derive Travel's refill at its already-settled Gate-B frontier when this was
   its triggering first purchase;
8. at the later Gold key, settle the already-authored duplicate through the
   shared concrete-acquisition path; and
9. attest source, payload domain, consumption, and candidate products across
   every surviving branch before publication.

The source/materialization checkpoint is earlier than any nested child owned by
the paid entry. If a purchased boon has a retained-invalid trait choice, or a
purchased consumable has invalid acquisition detail, Gold remains consumed and
the active singleton Gold row remains the repairable materialized product. The
invalid later source acquisition must not roll that checkpoint back.

This uses the existing Shop execution cohort, ordinary `traitRemoval` history
event, derived-entry frontier, and progressive blocked-child checkpoint. It does
not introduce a Gold event stream or another progressive retention mechanism;
the only correction is where the existing one-use removal and derived frontier
are emitted relative to the paid entry's nested acquisition.

The fold must not:

- settle Gold at source time;
- regenerate ordinary Gold payloads at pickup time, or regenerate Pom without
  the exact `StackOnly` disappearance trigger;
- let Gold trigger Travel;
- let Contract trigger Gold or Travel;
- let Gold duplicate itself;
- let buying Travel inside the Shop retroactively activate Travel for that same
  Shop; or
- create a second reward/acquisition walker.

## Shared commands and candidate products

The Gate-B derived supplemental-entry product is generalized to expose, for
either Travel or Gold:

- its dormant or active singleton row;
- its exact derived `sourceOfferKey`;
- its complete reward/payload domain;
- policy-owned `Purchased` or `Picked up` participation proposals; and
- complete acquisition-order proposals that preserve its source dependency.

Those order proposals are one attested site-level product over all active
derived entries. Per-row proposal arrays must agree with that product; Travel
and Gold do not independently publish locally plausible orders that conflict
when combined.

The existing acquisition-entry reward and acquisition-order commands continue
to own payload and chronology. Gate B's Travel-only materialization intent is
generalized into one derived-Shop-entry intent used by both rows; no parallel
Gold intent is added. Commands validate structural completeness, while the
shared candidate product owns contextual possibility.

When the source changes:

- the stable authored Gold payload is retained;
- the engine republishes the new derived source and domain;
- a still-valid payload remains usable;
- an invalid payload produces an exact Gold-row finding; and
- no eligible source returns the disabled placeholder and removes the Gold key
  from engine-proposed active orders while retaining dormant payload.

## Ownership

### Catalog

The catalog continues to own:

- `EchoDoubleShop` as the one-use effect declaration;
- `SpellDrop` as the exact source exclusion;
- the supported Shop reward and acquisition profiles; and
- source-resolution rules for duplicated reward families.

No generic callback registry or per-Shop Gold declaration is introduced.

### Planner engine

The engine owns:

- schema-38 persistence and semantic commands;
- source derivation and branch attestation;
- source-time duplicate payload candidates;
- Echo consumption at materialization;
- later ordered acquisition settlement;
- complete participation/order proposals;
- exact findings and candidate artifacts; and
- Run State history.

Those facts extend the one Shop fold and the one Gate-B derived-entry product;
they are not a second Gold subsystem.

### Application and React

Application composition adds Gold to the same `supplementalOffers` adaptation
used by Travel and Contract, binds the shared semantic commands, and routes
findings to the containing Shop inspector. React renders Gold through the same
supplemental-row branch and the same chronological workbench. Neither layer
owns eligibility, source choice, payload legality, ordering constraints, or
trait consumption.

## Implementation gate

Deliver this correction as one vertical feature commit after the plan commit.

1. Generalize the existing Travel derived-entry frontier, materialization
   intent, source dependency, and supplemental workspace row without changing
   Travel behavior.
2. Replace source-keyed Gold persistence with the schema-38 singleton child and
   feed its closed policy into that shared mechanism.
3. Separate source-time Gold consumption/materialization from later acquisition
   settlement in the one Shop fold, using the pre-source-acquisition history
   and retaining that checkpoint across invalid source acquisition detail.
4. Admit Gold into the shared acquisition order through the same complete
   dependency-aware proposal service.
5. Render `initial slots -> Travel -> Gold -> Contract` through the existing
   supplemental-row and Acquisitions components.
6. Remove the superseded immediate-settlement path and all source-keyed child
   vocabulary in the same commit.
7. Perform the combined All Together/Shop phase closure: absorb the settled
   contracts into durable authorities, delete both temporary plans, and run the
   one complete repository gate.

Intended commit:

```text
fix: make gold gold gold an orderable shop pickup
```

## Primary tests

### Catalog/source matrix

- Gold retains exactly one use and excludes only `SpellDrop` among supported
  paid World Shop sources.
- Contract and free pickups are not Gold sources.

### Codec and commands

- schema 38 exact round-trip;
- schema 37 rejection;
- stable key allowed only as one supplemental child;
- Gold order membership without its complete child rejected;
- source-keyed legacy children rejected;
- Gold key rejected as an initial slot;
- complete payload/default and nested child validation;
- participation/order undo and redo; and
- retained dormant/context-invalid payload remains decodable.

### Engine chronology

- eligible paid source consumes Gold even when `Picked up` is false;
- a paid entry rejected by the Shop purchase kernel does not consume Gold or
  publish an active Gold row;
- `SpellDrop` leaves Gold armed;
- a paid boon source freezes Gold's option domain before the source boon enters
  trait history;
- on that same paid boon, Travel retains its settled Gate-B generation frontier
  while Gold uses the pre-source-acquisition frontier;
- a retained-invalid paid boon/consumable child still consumes Gold and
  publishes the materialized Gold repair row;
- source -> later paid purchase -> Gold pickup settles at the later position;
- source -> Contract -> Travel -> Gold and source -> Gold -> Travel both remain
  legal when their independent constraints permit;
- a paid Travel refill can become Gold's first eligible source;
- Contract never becomes a source;
- ordinary loot/consumable payload domains remain unchanged by intervening
  acquisitions;
- a Pom duplicate keeps its frozen offer when all stored targets remain and
  accepts a pickup-frontier regenerated offer only after a source-time eligible
  target disappears;
- ordinary pickup settlement observes then-current history and reports exact
  invalidity without regeneration;
- the later free Gold pickup preserves ordinary Time Piece capability and tests
  conversion against the pickup frontier, never the paid source frontier;
- Blind Box authors its full resolved source on the Gold row and the order stores
  only `echoDoubleShopReward`;
- branch disagreement withholds the active capability;
- source removal/rebinding retains one child and one exact repair path;
- Travel-source removal and Gold-source rebinding are emitted as one complete
  site-order proposal rather than independent partial edits; and
- no later Shop observes the consumed Echo acquisition.

### Application and product

- a real reached Shop renders initial slots, Travel, Gold, Contract in order;
- Travel and Gold may display different derived sources;
- the Gold reward editor changes its complete payload independently of order;
- `Picked up` adds the stable key immediately after the source by default;
- move controls weave Gold later but never before its source;
- removing/rebinding a source uses one complete engine proposal;
- exact findings focus the Gold row in the containing Shop inspector; and
- Redux undo/redo covers payload, participation, and chronology separately.

The application witness must exercise Travel and Gold through the same
supplemental-row renderer and shared interaction catalogs. It must not introduce
a Gold-only fixture callback or leaf control that bypasses the real derived
entry product.

## Required adversarial review

The independent reviewer must specifically challenge:

- accidental consumption at Gold pickup rather than source materialization;
- accidental settlement at source time;
- accidental ordinary source/payload regeneration after intervening
  acquisitions;
- either suppressing Pom's exact `StackOnly` regeneration or generalizing that
  exception into unconditional pickup-time rerolls;
- one child per possible source;
- a Gold-only capability map, semantic command family, application assembly
  path, or React editor beside the Travel-derived mechanism;
- a second Shop or supplemental order;
- application-derived source or order repair;
- independently generated Travel and Gold order proposals that disagree when
  combined;
- Contract or Gold entering paid-purchase logic;
- Travel and Gold being forced to share one source;
- blind-box resolution leaking into the order model; and
- dormant placeholders publishing phantom children or destinations.

## Exclusions

This correction does not implement:

- Wells;
- Surface delayed-delivery timing;
- Fields minor rewards;
- Artificer;
- numeric Shop costs or discounts;
- an actual input/randomness timeline; or
- changes to other Echo choices.

## Closure

After implementation and remediation:

- update `README.md`, `CATALOG_MODEL.md`, `REWARD_MODEL.md`, `AUTHORED_PROJECT_MODEL.md`,
  `SIMULATION_AND_VALIDATION.md`, and `STRUCTURED_EDITOR_WORKSPACE.md` with the
  settled All Together, Contract, Travel, and schema-38 Gold contracts;
- record the Gate A, Gate B, correction-plan, and correction-implementation
  commits in `IMPLEMENTATION_PROGRESS.md`;
- ensure every source audit states materialization and later pickup separately;
- delete both `ALL_TOGETHER_AND_SHOP_TRAITS_IMPLEMENTATION.md` and this
  temporary plan; and
- run `npm run check` exactly once after review remediation and closure docs are
  stable, then record its truthful totals without rerunning it after the
  factual progress append.
