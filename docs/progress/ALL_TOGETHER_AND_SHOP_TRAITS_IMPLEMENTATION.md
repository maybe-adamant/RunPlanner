# All Together and Shop Traits Implementation Plan

## Status

**Locked for execution after final adversarial review.** This plan is grounded
against clean commit `132abc9`, authored-project schema 35, the completed Echo
delivery, the live World Shop acquisition-order editor, and the installed game
scripts. The final lock removed the impossible contract-Blind-Box-to-Hermes
chronology, closed the Time Piece contract matrix, and made the exact Shop
Hermes restock exclusion behavior explicit.

The source authority is
`../audits/ALL_TOGETHER_AND_SHOP_TRAITS_GAME_DATA_AUDIT.md`. The existing
ordinary Shop declarations and requirements remain owned by
`../audits/REWARD_GAME_DATA_AUDIT.md`; the current acquisition and Shop
ownership contracts remain in `../design/REWARD_MODEL.md`,
`../design/AUTHORED_PROJECT_MODEL.md`, and
`../design/SIMULATION_AND_VALIDATION.md`.

Do not link this temporary plan from `README.md` or stable design and audit
documents while it is active. Commit the locked plan before implementation.
At final closure, absorb only durable contracts into their owning documents,
record the delivery in `IMPLEMENTATION_PROGRESS.md`, and delete this file.

## Objective

Implement the three audited run effects in two coherent vertical gates:

1. Hera's Legendary **All Together** equips its ordinary outer trait and
   directly grants one source-valid rarityless Infusion from each of four
   independent pairs; and
2. **Infernal Contract** equips as a persistent rarityless trait and adds one
   free acquisition opportunity at every reached qualifying Preboss Shop,
   while Hermes's **Travel Deal** creates one fresh replacement opportunity
   after the first normal World Shop purchase when it was already equipped.

The result must use the existing trait history, reward acquisition, Shop
inventory, occurrence-owned acquisition chronology, candidate, finding,
workspace, Redux, and Run State authorities. It must not add a trait callback
registry, a generic effect interpreter, a second Shop simulator, a private
supplemental-purchase order, React-owned eligibility, or an inferred pending
boolean beside canonical history.

## Included scope

- the exact four All Together pair declarations and direct-grant behavior;
- one strict authored result for every All Together pair;
- rarityless direct child grants with no provider or ordinary-god-pool
  history;
- a canonical rarityless `InfernalContractBoon` equipped-trait identity at the
  existing `C_Boss01` acquisition;
- the exact five-entry `ZagPedestalOptions` possibility domain;
- the exact F/G/H/I/N/O/P/Q qualifying destination declarations;
- one free, independently optional contract acquisition at each reached
  qualifying destination;
- the existing 3/5/6 ordinary World Shop inventories presented as 4/6/7 total
  opportunities when the contract pedestal is active;
- Travel Deal's four-rarity discount facts, while keeping numeric Gold outside
  simulation;
- one fresh room-owned restock opportunity derived from the exact first normal
  World Shop purchase when Travel Deal was equipped before that purchase;
- exact interaction with the already-supported Echo Gold Gold Gold duplicate;
- strict persistence, commands, candidates, findings, inspector routing,
  Run State, UI, Redux undo/redo, and project fixtures; and
- final durable-document absorption and one complete phase-closure gate.

## Excluded scope

- Gold totals, prices, affordability, or discount arithmetic in run state;
- Wells of Charon and their separate first-purchase replacement path;
- literal delayed Surface Shop delivery, expedited-delivery choices, or an
  authored delivery queue;
- Shop probability and source weights beyond declaring the exact possibility
  domains;
- Mourning Fields optional rewards or cage/acquisition ordering;
- the Narcissus conversion-surface correction;
- The Artificer, its charges, RunProgress replacement, and Lazuli promotion;
- challenge switches, Shopping NPC purchases, and live-map physical kit IDs;
- a generic direct-trait callback/effect registry; and
- compatibility decoding or migration for prior schema versions.

The successor progression remains:

1. correct Narcissus's complete Time Piece/Artificer pickup surface;
2. add Fields optional pickups and one truthful room-local acquisition
   chronology; and
3. implement Artificer against those completed producer surfaces.

## Current live-code baseline

The implementation starts from these concrete facts:

- `AllElementalBoon` already exists as a normal Hera Legendary with the
  correct ordinary offer requirements and five outer element contributions,
  but it has only the default `equip` disposition and no direct child grants;
- all eight Infusion identities already exist as trait declarations;
- `RestockBoon` already exists as an ordinary Hermes ranked trait, but its
  discount/restock effect is unmodeled;
- `C_Boss01` already carries the fixed `InfernalContractBoon` reward through
  the ordinary `RoomReward` acquisition lifecycle;
- `InfernalContractBoon` currently exists only as a reward/acquisition ledger
  identity and does not enter canonical equipped-trait history;
- the supported Preboss declarations already own `WorldShop`, `I_WorldShop`,
  or `Q_WorldShop`, but they do not publish the contract-pedestal destination
  fact;
- Shop state owns declaration-complete initial offers, while
  `acquisitionSites.roomExit.order` owns selected purchase membership and
  chronology;
- the Shop table's `Purchased` checkboxes only add or remove initial-offer keys
  from that order, while the separate Acquisitions workbench renders the
  selected chronology and its adjacent `Move earlier` / `Move later` edits;
- the application currently enumerates mechanical membership and adjacent-swap
  order proposals, while the engine evaluates each complete proposed order;
- Shop `pickupEntries` already persist sparse generated children for Echo Gold
  Gold Gold, but the strict codec accepts only the reserved Echo duplicate
  vocabulary and keeps those mandatory duplicates outside the authored order;
- `settleShopAcquisitionSite` is the one production settlement path for both
  authored evaluation and acquisition-order candidates;
- Echo Gold currently settles its paid source and immediate free duplicate in
  that path and removes its exact equipped acquisition identity; and
- generic trait history and Run State already display equipped traits, so the
  new direct traits need no parallel status ledger.

## Planner interpretations

### All Together result ownership

Selecting All Together first equips the ordinary Legendary outer trait. Its
four direct grants are then resolved against the exact pre-All-Together
equipped-trait frontier.

The declaration owns four closed sets:

| Set   | First member               | Second member                 |
| ----- | -------------------------- | ----------------------------- |
| Earth | `ElementalDamageBoon`      | `ElementalOlympianDamageBoon` |
| Fire  | `ElementalBaseDamageBoon`  | `ElementalRallyBoon`          |
| Air   | `ElementalDamageFloorBoon` | `ElementalDodgeBoon`          |
| Water | `ElementalHealthBoon`      | `ElementalDamageCapBoon`      |

Persist one exact map beneath the selected All Together option. Every set key
is mandatory and its value is either one member of that set or `null`:

- neither member already equipped: either member is legal;
- exactly one already equipped: the other member is the only legal value;
- both already equipped: `null` is the only legal value; and
- `null` is invalid while any member remains grantable.

`null` records the source's exhausted-set no-op. It is not an incomplete
placeholder and does not mean “let the simulator choose.” A newly installed
All Together option receives a declaration-complete static default; candidate
feedback repairs it if earlier history makes that default unavailable.

Each set receives an exact semantic child address under the selected outer
option. The active result remains visible and repairable when earlier edits
make it invalid. Detail retained beneath an unselected option is dormant and
publishes no interaction, finding destination, or inspector.

A missing or invalid active child does not erase the legally acquired outer
All Together trait. No direct child settles unless the complete four-set map
is legal across every surviving branch. This preserves one atomic source
callback result and prevents a partially applied map from changing later set
domains.

### All Together direct acquisition semantics

The selected children enter canonical equipped-trait history without standard
rarity. They bypass ordinary offer composition, Infusion element thresholds,
Calling Card actions, Vow of Denial bans, provider loot history, and ordinary
god-pool expansion. They still contribute their declaration-owned equipped
trait facts and elements.

The eight ordinary Infusion declarations remain ranked for their normal god
offer path. Raritylessness belongs only to the direct All Together acquisition
instances; do not globally change those trait declarations to a no-rarity
domain. The source's `AresFirstPickUp` condition for
`ElementalOlympianDamageBoon` is satisfied by the planner's established fully
progressed persistent baseline and does not become a new run-history input.

The direct-grant fold must be a narrow trait-history operation shared only
where a source directly installs a fixed trait identity. It is not an
arbitrary callback table. All Together supplies four declaration-owned child
identities; Infernal Contract later uses the same history vocabulary for one
fixed source acquisition.

### Infernal Contract acquisition

The existing `C_Boss01` reward remains a real fixed acquisition with its exact
loot/use ledger. Successful acquisition additionally installs one rarityless
`InfernalContractBoon` equipped trait through the direct-grant history path.
The contract resource and Boss/automatic-return lifecycle are otherwise
unchanged.

The equipped trait is the only activation fact. Do not persist a route flag,
remaining-use count, or per-biome pending state. If the contract room was not
entered or its reward did not settle, later destinations remain dormant.

### Contract pedestal and Shop chronology

Each qualifying Preboss declaration owns one supplemental contract producer
with the exact five-entry domain:

- `BlindBoxLoot`;
- `StackUpgradeBig`;
- `StackUpgrade`;
- `TalentBigDrop`; and
- `TalentDrop`.

Weights do not enter the planner. A reached active producer persists one
complete `AuthoredRewardState` under the fixed `infernalContractReward` entry
key at the room's existing `roomExit` acquisition site. Payload, trait-offer,
level, and conversion children reuse the ordinary acquisition authorities for
the selected reward identity.

The contract entry is an independently optional free acquisition. Its entry
key may appear zero or one times in the room's one acquisition order and may
be placed before, between, or after normal purchases. It is not inserted into
the Shop profile's initial offer map.

The application may present this as the fourth, sixth, or seventh Shop
opportunity, but the engine retains exact provenance:

- normal initial and Travel-refill entries are paid Shop acquisitions even
  though Gold is collapsed;
- the contract entry is free and ignores the Shop purchase-removal path; and
- an Echo Gold duplicate is a mandatory immediate free acquisition outside
  the authored order.

That provenance continues to drive Time Piece. An eligible zero-cost contract
reward may expose the ordinary conversion choice, while `BlindBoxLoot` remains
non-convertible. Initial purchases and the Travel refill remain paid and expose
no Time Piece conversion. If Echo later duplicates a Travel refill, the
separately spawned Echo child retains its existing free-instance conversion
semantics.

The contract matrix is closed: `StackUpgrade`, `StackUpgradeBig`, `TalentDrop`,
and `TalentBigDrop` carry the free-instance Time Piece capability;
`BlindBoxLoot` does not. The engine derives actual availability from the
existing Fated/use state rather than inventing a contract-specific conversion
rule.

Consequently the contract entry does not set the room's first-normal-purchase
state, trigger Travel Deal, consume Travel Deal, or become a Travel Deal
restock target.

### Travel Deal restock

The catalog records Travel Deal's exact Common/Rare/Epic/Heroic discount rows
and one World Shop restock. Simulation ignores the numeric discount but uses
the equipped trait as the source-backed activation fact.

At a Shop acquisition site:

1. scan the single authored acquisition order chronologically;
2. ignore free supplemental entries when determining the first normal
   purchase;
3. if Travel Deal was already equipped on Shop entry and remains equipped
   immediately before that first normal purchase,
   settle the paid source and derive that initial offer's declaration-owned
   profile slot index;
4. regenerate the complete Shop profile at the post-paid frontier with the
   purchased interaction name and `Drop` alias excluded, project the option at
   that same slot index, and retry the complete profile without those
   exclusions only when the indexed option is unsupported;
5. publish one room-owned refill capability carrying the derived source offer
   key, slot index, complete default, and candidate domain;
6. persist at most one fresh refill result beneath the fixed
   `travelDealRefill` entry key; and
7. let the player include or omit that new paid entry later in the same
   acquisition order, after its generating source.

The replacement is a fresh Shop option, not a duplicate of the purchased
payload. It owns fresh source, trait-offer, level, and conversion detail. It
cannot appear before its source, cannot trigger another Travel Deal refill,
and cannot be derived from a contract or Echo supplemental entry.

The regenerated full profile is a candidate witness only. The planner keeps
the option projected at the replaced index and discards the other regenerated
slots, exactly as the game does when it spawns only `options[replacedIndex]`.
It must not overwrite the room's remaining initial offers or persist a shadow
second inventory.

The exclusion identity comes from the declaration-owned spawned interaction,
not from the normalized reward type by convention. A normal god offer passes
its concrete provider name, so excluding `ZeusUpgrade` does not remove the
`RandomLoot` profile entry. Wrapper options likewise retain their exact spawn
mapping: Hammer interacts as `WeaponUpgrade`, whose `Drop` alias removes
`WeaponUpgradeDrop`, while the Shop Hermes wrapper interacts as
`HermesUpgrade`. Its exclusion pair is therefore `{ HermesUpgrade,
HermesUpgradeDrop }`, which leaves the raw `ShopHermesUpgrade` profile option
eligible. The normalized Shop option must expose this closed resolution fact;
the engine must not invent a generic string rewrite from reward labels.

The authored document does **not** persist the trigger offer key, slot index,
or one child per possible source. Those facts are completely derivable from
the one acquisition order plus the declaration-owned Shop profile. If the
first normal purchase changes, the same singleton child is re-evaluated
against the newly derived slot domain. Its retained authored payload may then
become context-invalid and repairable; no stale source-keyed sibling remains.

If the first normal purchase occurs before Travel Deal is equipped, the room
gets no later refill. In particular, buying Travel Deal as the first normal
purchase does not retroactively activate its own replacement. A contract
acquisition before that purchase may affect ordinary trait/reward history but
cannot grant Travel Deal: contract Blind Box source resolution excludes
Hermes. It therefore neither establishes nor consumes the trigger.

The same bounded first-normal-purchase abstraction applies to supported
Underworld and Surface World Shops, including ordinary/Midshop occurrences
that do not host an Infernal Contract pedestal. Travel support is attached to
the Shop profile and reached occurrence, never inferred from the contract-room
destination matrix. No delayed-delivery state is introduced.

### Travel Deal authoring loop

The existing separation between purchase membership and chronology remains:

1. checking an ordinary Shop row appends that initial offer to the one room
   acquisition order, exactly as today;
2. when Travel Deal was already equipped before the reached Shop, the Shop
   inventory surface publishes one stable disabled `Travel Deal refill` placeholder
   beneath the declaration-owned initial slots; the placeholder explains that a
   paid Shop purchase must be selected and ordered before the refill can be
   edited, but it is not itself authored state and publishes no semantic child,
   command, marker, or finding destination;
3. the engine evaluates the complete order and derives the first normal
   purchase at whose pre-entry frontier Travel Deal is already equipped;
4. when such a trigger exists, the same placeholder activates as
   `Travel Deal refill after <offer>` with its generated offer editor and its
   own `Purchased` checkbox;
5. selecting the refill inserts its singleton key immediately after the
   trigger by default, adds it to the separate Acquisitions chronology, and
   exposes acquisition-time children there; the existing chronology controls
   may move it later but never before the trigger; and
6. unselecting the triggering ordinary purchase while the refill is selected
   removes that entry and the refill key in one engine-owned complete proposal,
   while retaining the refill payload as dormant authored detail. The stable
   placeholder returns to its disabled explanatory state. If another normal
   purchase remains, it becomes the newly derived first trigger and the refill
   reactivates unselected for explicit review.

The placeholder and refill capability are published only from Travel Deal in
the Shop-entry trait frontier. No acquisition inside that Shop can
retroactively activate them.

This is the planner's flex-extra-spot simplification. It preserves every
modeled consequence of the physical replacement slot—its source, profile
index, eligibility domain, generation frontier, and later purchase chronology—
without persisting layout coordinates or asking the user to select a trigger
already determined by the acquisition order.

Like an initial Shop option, the generated refill identity must be complete
even when it is not purchased. Its Shop row therefore exposes the offer/payload
editor but hides trait-offer, level, conversion, and other acquisition-time
children until the refill key participates in the order. The contract pedestal
remains a separately produced free pickup and uses the supplemental
Acquisitions participation surface instead of pretending to be Shop inventory.

A refill child is structurally legal when retained under a supported Shop even
if its trigger is currently absent or changed. Trigger reachability, ordering,
and exact current slot-domain membership are contextual simulation findings,
not codec rejection. The payload remains decodable, but its editor is disabled
until the acquisition order establishes a valid trigger; the upstream order is
the repair surface. An already-selected context-invalid child remains visible
as an exact disabled repair state rather than making the project undecodable.

### Rejected Shop models

The following superficially simpler shapes are not accepted:

- one Travel child per possible source duplicates a fact already owned by the
  order and leaves stale sibling state when the first purchase changes;
- a room-wide refill domain formed from every Shop slot is too broad because
  the physical index selects one declaration-owned slot in `WorldShop`,
  `I_WorldShop`, or `Q_WorldShop`;
- a separate trigger selector can disagree with the first normal purchase in
  the authored chronology;
- automatically acquiring the refill erases the player's ability to skip it
  or buy other entries first; and
- a second supplemental order can disagree with the existing room-exit order.

The singleton derived refill is therefore the smallest state shape that keeps
the current planner's exact modeled outcomes.

### Travel Deal and Echo Gold ordering

Both effects may react to the same first normal purchase. The source-relevant
planner chronology for a non-`SpellDrop` source is:

1. settle the paid source acquisition;
2. derive and freeze the Travel Deal replacement domain at the post-paid,
   pre-Echo-duplicate frontier;
3. settle the existing immediate Echo Gold duplicate when its own declaration
   permits it;
4. remove Echo Gold's exact one-use trait as today; and
5. later settle the authored Travel replacement only if its derived entry is
   included in the remaining acquisition chronology.

This preserves the game's restock-generation frontier: the paid result is
known, but the separately spawned Echo duplicate has not been acquired when
the replacement option is chosen. The current planner's immediate Echo
duplicate abstraction remains intact after the replacement identity is
frozen.

`SpellDrop` remains excluded only from Echo duplication. It is a normal paid
Shop purchase and can trigger Travel Deal without consuming Echo Gold. Echo
then remains armed for the next paid non-Spell Shop acquisition in the same
authored chronology. That later source may be another initial offer or the
Travel refill itself. A refill can therefore own the existing mandatory
`echoDoubleShop:travelDealRefill` child when it is the first later eligible
Echo source, even though `wasFirstPurchase` is already false and it cannot
generate a second Travel refill. The contract pedestal remains ineligible for
both World Shop removal and Echo Shop duplication.

## Ownership contract

### Catalog

The Hades II catalog owns:

- All Together's exact four named pairs and fixed no-rarity direct-grant
  disposition;
- the canonical rarityless `InfernalContractBoon` trait declaration and its
  fixed acquisition-to-trait relationship;
- the exact five-member contract pedestal domain;
- the exact four-positive/one-negative contract Time Piece capability matrix;
- the exact destination capability on F/G/H/I/N/O/P/Q Preboss declarations;
- Travel Deal's four discount values and one-restock World Shop effect;
- each Shop option's exact purchase-interaction-name resolution needed by the
  source exclusion pair;
- the exact indexed-profile restock exclusions/fallback rule; and
- the distinction between ordinary Shop, contract-free, and Echo-free
  acquisition provenance.

Normalization validates exact keys, pair membership and distinctness, fixed
assignments to the three owning traits, destination/profile compatibility,
the five-member pedestal set, and immutable nested products. It must reject a
contract producer on a nonqualifying room and a Travel effect on another
trait. It must not expose probability or a generic callable effect registry.

### Authored project

The authored model owns only player choices and explicit possibility results:

- the exact four-set All Together result beneath its selected outer option;
- the resolved contract pedestal reward and its ordinary nested acquisition
  decisions;
- one singleton fresh Travel Deal replacement and its ordinary nested
  acquisition decisions; and
- one occurrence-owned acquisition order spanning normal initial purchases,
  the optional contract acquisition, and the optional Travel replacement.

Use fixed collision-safe entry keys for the contract and singleton Travel
children, while retaining Echo's existing collision-safe derived vocabulary.
The codec validates exact structural applicability, locally valid child shape,
known order membership, and uniqueness. It does not reconstruct history to
reject a retained Travel trigger or current slot-domain mismatch; those are
contextual simulation findings. Echo duplicates remain outside the order.
Dormant structurally valid children are retained; unknown, misplaced, or
structurally malformed children are rejected.

Gate A advances schema 35 to schema 36 for the All Together option child.
Gate B advances schema 36 to schema 37 for the generalized Shop acquisition
site and derived contract/Travel entry contract. Older schemas reject
outright; no compatibility decoder or migration shim is added.

Semantic commands replace one All Together set result, one derived acquisition
entry value, or the complete acquisition order. Commands validate the same
structural contract as the codec and participate in ordinary Redux undo/redo.
The engine-owned order-authoring product supplies complete source-dependent
toggle proposals, including atomic removal of a selected refill when its
triggering initial purchase is removed. The application does not recreate that
dependency.

### Simulation and history

Canonical trait history owns:

- the ordinary outer All Together acquisition;
- zero to four rarityless direct child grants;
- the fixed rarityless Infernal Contract acquisition; and
- the ordinary ranked Travel Deal acquisition.

The existing Shop settlement orchestrator remains the single chronology for
initial purchases, the contract entry, Echo duplicate settlement, and Travel
replacement generation/acquisition. It consumes engine-owned provenance and
catalog descriptors; it must not switch on rendered labels or UI entry kinds.

All derived capabilities are branch-attested. A child or candidate publishes
only when every surviving branch agrees on its owner, source relationship,
and complete default/domain. Divergence is withheld or reported as a
simulation contract error at the owning boundary; maps must not silently keep
the last branch.

Findings remain at exact semantic owners. Missing or unavailable All Together
sets route to that trait editor. Missing, unavailable, premature, or stale
contract/Travel entries route to the containing Shop acquisition editor. A
blocked child preserves all earlier legal history without applying later
acquisitions.

### Application and React

Application composition adapts engine products into:

- four All Together set controls;
- one supplemental contract opportunity;
- one singleton Travel replacement opportunity labeled with its currently
  derived source; and
- one unified acquisition-order control over currently supported optional
  entries.

React renders labels, grouping, read-only forced/exhausted states, and ordinary
reward editors. It does not compute pair eligibility, contract reachability,
first-purchase state, refill domains, derived-key relationships, or
provenance. No trait-key, room-name, or reward-name policy switch belongs in
React.

The initial Shop table keeps its existing per-offer `Purchased` checkboxes.
When Travel Deal was already equipped, it also shows one stable refill section
beneath those initial offers, without appending it to the declaration-owned
initial-offer array. Before a first normal purchase is derivable, this section
is a disabled presentation placeholder with the text `Select and order at least
one paid Shop purchase to generate the Travel Deal refill.` Once the engine
publishes a trigger, that same section becomes one editable flex refill row with
the ordinary membership surface. The Acquisitions workbench keeps the one
chronological list and adjacent move controls, adds the optional contract
participation row, and displays the refill there only after its purchase
checkbox is selected. The refill remains independently unpurchased until
selected and uses an engine-provided complete order proposal rather than a
second order or an application-inferred trigger.

The disabled placeholder is not a phantom domain child. It has no authored
value, semantic interaction, marker, finding destination, or acquisition-order
membership. Dormant retained payload also remains non-editable while no trigger
exists. A selected context-invalid refill may keep one disabled exact repair
row after an upstream history edit, directing repair to the acquisition order.

The 4/6/7 presentation is a count of possible acquisitions, not a rewrite of
the declaration-owned Shop slot count. Findings navigate to the containing
trait or Shop inspector and focus the exact child. Dormant retained children
publish no phantom marker, interaction, or destination.

Travel Deal does not make those counts permanently 5/7/8 at Shop entry. Its
stable placeholder communicates the possible fifth, seventh, or eighth
opportunity, but only an authored first normal purchase activates the row and
creates an editable generated identity. This preserves the current
checkbox-then-order workflow without pretending that an ungenerated refill is
already Shop inventory.

### Run State

Run State continues to derive equipped traits from canonical trait history:

- All Together appears as Legendary;
- its granted Infusions appear without standard rarity;
- Infernal Contract appears without standard rarity; and
- Travel Deal appears with its acquired rarity.

No special `allTogetherActive`, `infernalContractActive`,
`travelDealAvailable`, or `firstPurchaseUsed` run-state flag is persisted or
projected. The active Shop's authored and evaluated child rows communicate the
room-local opportunity state.

## Gate A — All Together

### Deliverables

1. Add the exact declaration-owned four-pair direct-grant descriptor and
   compiler invariants.
2. Advance to schema 36 with one strict complete result map under the selected
   All Together option and exact per-set semantic addresses.
3. Add defaults, codec validation, semantic commands, replacement retention,
   and undo/redo.
4. Add the narrow direct-trait history operation and settle All Together only
   after the outer offer is acquired and the complete child is legal.
5. Publish per-set candidates against the exact pre-outer frontier, including
   forced and exhausted `null` domains.
6. Project the four controls, exact findings, containing inspector,
   navigation, and rarityless Run State children.
7. Keep all ordinary offer, provider-pool, rarity, Calling Card, and Vow
   behavior out of the child path.

### Primary test owners

- `packages/hades2-catalog/test/catalog/traits.test.ts` owns the exact pair
  matrix, fixed assignment, compiler mutations, and immutability.
- `packages/planner-engine/test/authored-project/encounter-codec.test.ts` owns
  schema-36 strict shape, missing/extra/wrong/null cases, and schema-35
  rejection.
- A focused `packages/planner-engine/test/simulation/all-together.test.ts`
  owns acquisition chronology and the complete behavior matrix.
- Existing interaction-binding, occurrence-assembly, finding-routing, Run
  State, and trait-editor suites retain representative application contacts.

### Required witnesses

- no prior pair member: both candidates, selected rarityless child;
- one prior member: exact other member forced;
- both prior members: `null` forced and no child event;
- all four exhausted: outer Legendary still acquired, no grants;
- direct grant bypasses an ordinary Infusion threshold;
- direct grants add no provider loot history or ordinary god-pool source;
- child rarity is absent while the outer remains Legendary;
- missing, invalid, and branch-divergent results preserve outer acquisition
  and apply no partial map;
- retained dormant detail disappears from active interactions and reappears
  after reselection;
- exact finding click opens the containing trait inspector and focuses the
  affected set; and
- command plus Redux undo/redo round-trip the complete map.

### Validation and commit boundary

Run the catalog, engine, and planner typechecks; catalog and engine lanes; the
focused planner/UI/contract contacts; lint; formatting; and `git diff --check`.
Do not run the complete repository gate.

After a fresh executor handoff, independent read-only review, one bounded
remediation pass, and orchestrator final review, commit as one coherent Gate A
feature commit when authorized.

## Gate B — Infernal Contract and Travel Deal

### Deliverables

1. Add the rarityless Infernal Contract trait and fixed direct-grant
   acquisition behavior without changing the existing C Boss route lifecycle.
2. Add the exact pedestal domain and exact qualifying Preboss destination
   declarations.
3. Advance to schema 37 with fixed contract and singleton Travel entry keys and
   a unified Shop acquisition order that can contain normal, contract, and
   Travel entries while excluding Echo duplicates.
4. Generalize the one Shop settlement path and its order-candidate evaluator
   together; remove or replace assumptions that every ordered key is an
   initial Shop offer.
5. Add contract default/candidate/settlement behavior with free provenance and
   ordinary nested acquisition decisions, including the exact
   four-positive/one-negative Time Piece capability matrix.
6. Add Travel Deal's declaration-owned first-normal-purchase restock,
   full-profile exclusion/fallback generation, singleton fresh child, optional
   later acquisition, and derived indexed-slot/source relationship.
7. Preserve the post-paid/pre-Echo replacement-generation frontier and the
   existing immediate Echo duplicate settlement.
8. Extend the engine-owned order-authoring product with the active supplemental
   entry inventory and complete source-dependent toggle/move proposals; keep
   initial and Travel-refill purchase membership in the Shop inventory surface
   and the one chronology in the Acquisitions workbench.
9. Project total opportunities, derived rows, unified chronology, exact
   findings, navigation, UI editing, and Redux undo/redo without React policy.
10. Prove all supported route profiles and alternative I Preboss declarations.

### Primary test owners

- Catalog trait/reward/room suites own the exact effect, pedestal, and
  destination matrices plus compiler mutations.
- Authored topology/codec and occurrence-Shop command suites own schema 37,
  key reservation, structural child placement, known-entry order membership,
  uniqueness, persistence, and undo/redo. The simulation suite owns
  source/trigger chronology and current slot-domain validity.
- A focused
  `packages/planner-engine/test/simulation/infernal-contract-travel-deal.test.ts`
  owns the complete Shop chronology and interaction matrix.
- Existing route-detour tests retain the C Boss acquisition/automatic-return
  contact.
- Existing Shop-trait-purchase tests retain ordinary and Echo acquisition
  behavior, with representative overlap witnesses moved only when the new
  focused authority subsumes them.
- Occurrence assembly, interaction binding, finding routing, Run State, UI,
  contract, and product-loop suites retain representative cross-layer
  contacts rather than copying the engine matrix.

### Required witnesses

- C Boss acquisition records the existing exact reward ledger and equips one
  rarityless Infernal Contract;
- no entered contract means no later pedestal despite retained authored child
  state;
- each reached F/G/H/N/O/P destination exposes 3+1, I exposes 5+1, and Q
  exposes 6+1 opportunities; both I Preboss declarations use one alternative
  opportunity, not two;
- each exact pedestal reward identity can be authored and settled through its
  existing nested acquisition semantics;
- contract skip/acquire before/acquire after normal purchases preserve one
  truthful chronology;
- contract acquisition neither triggers nor receives Travel Deal;
- Travel already equipped + first normal purchase publishes one singleton
  refill whose derived source key, slot index, default, and domain match that
  indexed position in a freshly generated same-profile inventory;
- Travel acquired by the first normal purchase produces no refill;
- a contract Blind Box cannot resolve to Hermes or grant Travel Deal, and no
  in-Shop acquisition retroactively publishes the refill;
- no normal purchase produces no refill;
- `SpellDrop` triggers Travel but remains excluded from Echo duplication;
- after a Spell trigger, Echo remains armed: the first later non-Spell paid
  entry—another initial offer or the Travel refill—owns the one immediate Echo
  duplicate and consumes Echo, while producing no second Travel refill;
- source exclusion and unrestricted fallback each have a real candidate
  witness;
- exclusion witnesses cover a concrete god source, Hammer's `Drop` alias, and
  the Shop Hermes wrapper; the wrapper's `HermesUpgrade` interaction exclusion
  leaves raw `ShopHermesUpgrade` eligible, so reward-type, raw-option, and
  interaction-name identities cannot be conflated;
- `WorldShop` ordinary/Midshop and Preboss occurrences share the Travel rule,
  while only declaration-marked Preboss destinations publish the contract;
- Q's two-slot `MixedProgress` group proves that the refill projects the exact
  regenerated profile index and preserves the regenerated group's
  without-replacement witness rather than using a room-wide union;
- with Travel already equipped, the reached Shop shows one stable disabled
  refill placeholder before a trigger, with no authored child, interaction,
  marker, or finding destination; after checking and ordering the trigger
  source, that same section activates as one flex unpurchased Shop row whose
  generated offer editor is visible while acquisition-time children remain
  dormant;
- selecting the refill inserts it immediately after its source by default; it
  then appears in the Acquisitions chronology, may be moved later, skipped, or
  acquired, but cannot occur before its source or trigger a second refill;
- removing the triggering source while its refill is selected removes both
  dependent order memberships atomically, retains the child payload dormant,
  and lets any remaining normal purchase publish a newly derived unselected
  refill;
- reordering a different normal purchase first changes the singleton's derived
  slot domain rather than creating a second source-keyed child; stale retained
  payload remains an exact repairable finding;
- paid refill retains paid provenance while contract and Echo children retain
  free provenance;
- Time Piece can act only on a capability-bearing free contract or Echo child,
  never on the paid initial/refill instance, and a contract Blind Box remains
  non-convertible;
- Travel + Echo on the same non-Spell purchase freezes the refill before
  duplicate acquisition, settles the duplicate once, and leaves the refill
  optional;
- branch agreement publishes one derived capability and disagreement withholds
  it rather than overwriting a frontier;
- stale/missing/premature children remain exact, navigable findings without
  corrupting prior acquisitions;
- an upstream edit that bypasses the normal atomic toggle and leaves a selected
  refill without a trigger keeps one disabled invalid repair row directed at
  the acquisition order; an unreachable unselected retained child stays
  dormant behind the same disabled placeholder;
- 4/6/7 UI counts do not mutate the initial Shop slot declarations;
- exact finding click opens the containing Shop inspector and the derived
  reward editor; and
- semantic commands plus Redux undo/redo preserve initial offers, singleton
  supplemental children, and one acquisition order; and
- the complete checkbox-then-order product loop is witnessed in React: check a
  normal offer, repair the generated refill, purchase it, move it later, and
  undo/redo without a separate trigger selector.

### Validation and commit boundary

Run all workspace typechecks; catalog, engine, planner, UI, contract, and
product lanes; lint; formatting; production build; and `git diff --check`.
Do not run `npm run check`; reserve the single complete gate for phase closure.

After a fresh executor handoff, independent read-only review, one bounded
remediation pass, and orchestrator final review, commit as one coherent Gate B
feature commit when authorized.

## Gate C — Phase closure

### Closure audit

Perform a final static audit across catalog, authored state, simulation,
candidates, application composition, and React. Confirm:

- catalog -> pure engine <- application/React dependency direction;
- one direct-trait history vocabulary and no callback registry;
- one Shop acquisition chronology and no contract/Travel side order;
- one Shop settlement/evaluation path shared by selected state and candidates;
- no React trait, room, reward, provenance, or first-purchase policy switch;
- exact active/reached-only markers, interactions, inspectors, and findings;
- no phantom dormant child destinations;
- no superseded derived-entry or purchase-order path remains; and
- schema 37 is the sole authored contract.

### Durable absorption

Update only the smallest stable owners:

- `README.md` current product/evidence map if the new product boundary merits
  a durable entry;
- `CATALOG_MODEL.md` for the three declaration-owned effects;
- `AUTHORED_PROJECT_MODEL.md` for All Together and generalized Shop child
  persistence/order;
- `REWARD_MODEL.md` for supplemental/free versus initial/restock acquisition
  provenance;
- `SIMULATION_AND_VALIDATION.md` for direct grants and first-purchase
  chronology;
- `STRUCTURED_EDITOR_WORKSPACE.md` for reached derived child ownership;
- the source audit's implemented planner disposition; and
- `IMPLEMENTATION_PROGRESS.md` with exact gate commits and final validation.

Delete this temporary plan in the same closure change. Preserve the Artificer
and Fields audit as durable successor evidence.

### Final gate and commit boundary

Run `npm run check` exactly once after all review remediation and closure docs
are stable. Record the truthful typecheck, test, lint, format, and build result
in `IMPLEMENTATION_PROGRESS.md`; after that factual append, format only the
touched document and run `git diff --check` rather than repeating the full
gate.

Commit the closure only after independent review and orchestrator final
review, when authorized.

## Cross-gate invariants

- A legally acquired outer trait remains in history when an active child is
  incomplete or unavailable.
- Direct fixed grants never fabricate ordinary offers, rarity, provider loot
  history, or god-pool membership.
- Structural support and contextual validity remain distinct; retained
  authored state is repairable rather than silently deleted.
- Every generated or supplemental acquisition has one exact semantic owner,
  provenance, candidate product, finding destination, and containing
  inspector.
- One occurrence-owned acquisition order is the only player-authored Shop
  chronology.
- Contract and Travel entries never alter declaration-owned initial slot
  counts.
- Contract free acquisition never becomes a normal first purchase or restock
  source.
- Travel Deal performs at most one refill per Shop and only when equipped
  on Shop entry and before the first normal purchase.
- No acquisition inside a Shop can retroactively activate its Travel Deal
  placeholder or refill capability.
- Travel Deal owns one stable room-local refill child; its source offer and
  indexed slot are derived from the one order and never duplicated in authored
  state.
- Echo duplicate behavior remains one-use, immediate, and outside the authored
  order.
- Candidate evaluation and selected simulation invoke the same semantic
  settlement/generation authorities.
- Branch divergence is attested, never hidden by last-write map behavior.
- No production code imports upward across catalog -> engine <- application.
- No generic effect registry, callback table, service locator, or UI-owned
  semantic switch is introduced.

## Final acceptance

The phase is complete only when:

- all Gate A and Gate B required witnesses pass;
- schema 37 strictly round-trips the new state and rejects schema 36 and
  structurally malformed state;
- full supported routes publish truthful All Together, contract, Travel,
  Echo-overlap, Run State, finding, and editor products;
- the independent reviewer has no unresolved actionable finding;
- the orchestrator confirms contract fidelity, ownership, deletion of
  superseded paths, test ownership, and bounded production growth;
- the single phase-closing `npm run check` passes;
- durable authorities record the final product without temporary gate
  mechanics; and
- this temporary plan is deleted.
