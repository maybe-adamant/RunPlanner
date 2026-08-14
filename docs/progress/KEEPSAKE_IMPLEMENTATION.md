# Keepsake Implementation Plan

## Status

**Active implementation.** This temporary delivery plan was locked against the
live code at `7ebdb88` and the source facts in
`docs/audits/KEEPSAKE_GAME_DATA_AUDIT.md`.

Completed delivery gates:

- Gate A — keepsake selection timeline: `539d781`;
- Gate B — Jeweled Pom: `0cfd242`;
- Gate C — Experimental Hammer: `9209936`;
- Gate D — Calling Card: `df47929`; and
- Gate E — Time Piece: `b30f90f`; and
- Gate F — Fig Leaf: `d6d98ab`, with the source-fidelity miniboss correction at
  `5239e30` and the workspace-loader boundary correction at `93d4806`.

The current clean implementation base is `93d4806`. Gate G — Gorgon Amulet was
live-code preflighted against that base. Its amended contract distinguishes
room-owned and encounter-owned Athena blockers, locks the exact modeled
declaration matrix, and defines the phase-child defaults and lifecycle. Gate G
is the next delivery boundary. Gate H — product closure and absorption remains
pending.

Do not link this plan from `README.md`, stable design documents, biome rules,
or other progress plans while it is active. At final closure, absorb durable
contracts into their smallest stable owners and retire this file.

## Objective

Add the ordinary keepsake loadout and in-run swap timeline, declare all 33
selectable keepsakes, and fully model this first six-effect frontier:

1. Jeweled Pom;
2. Experimental Hammer;
3. Calling Card;
4. Time Piece;
5. Fig Leaf; and
6. Gorgon Amulet.

The user-visible result is:

- every route begins with one selected keepsake;
- each nonfinal Postboss frontier can retain it or replace it with one still
  available during the run;
- every one of the 33 declared identities is selectable at those frontiers and
  contributes its true identity to chronological keepsake history;
- removed keepsakes cannot return;
- identity-only keepsakes remain legal timeline participants without invented
  effects;
- the six supported effects are authored where their actual decisions occur;
  and
- progressive evaluation and Run State describe the same chronological
  keepsake state used by selected simulation.

This work extends the existing catalog, authored project, progressive
simulation, candidate, structured-workspace, and React boundaries. It must not
create a second route simulator, a generic keepsake-effect interpreter, a rack
interaction editor, or React-owned game policy.

## Included Scope

### Identity and chronology

- all 33 source keys and player-facing labels;
- fixed rank-III behavior with no authored rank choice;
- one mandatory starting keepsake per route;
- retain-or-replace choices after F/G/H and N/O/P;
- exact Postboss timing after boss completion and Judgment, but before later
  modeled Postboss acquisitions;
- ordered current, removed, and prior-selection facts;
- no-return legality;
- complete candidate and authoring support for selecting any of the 33
  identities at route start and each active Postboss frontier;
- the source `Unknown` / `Fated` / `Unfated` state machine;
- Gorgon Amulet's unavailability after Athena has already appeared; and
- identity-only handling for the other 27 effects.

I and Q do not publish an authoring control for a later keepsake because no
modeled biome follows them. I's physical Postboss room remains part of the
completion tail, but it does not create a meaningless final-route swap.

### First six effects

- Jeweled Pom's equip-time Hades trait and prospective +3 levels;
- Experimental Hammer's equip-time compatible Hammer and 20 qualifying
  encounter duration;
- Calling Card's six retained offer-row rarifications;
- Time Piece's four retained reward conversions;
- Fig Leaf's three persistent biome uses and exact encounter skipping; and
- Gorgon Amulet's one conditional additive Athena appearance with an Epic
  offer.

## Explicitly Excluded

- keepsake unlock, gift, relationship, ending, and rack-incantation inputs;
- per-keepsake ranks or rank progression;
- Heroic temporary keepsake-rank scaling;
- Crossroads free swaps, randomized bounty loadouts, and special rack modes;
- authored rack timing or arbitrary interaction order inside Postboss rooms;
- probability, including Fig Leaf's 37% roll and random equip-result odds;
- gold amounts, Shop prices, or a general resource-cost simulator;
- combat-stat, health, armor, fountain, prior-death, and real-time effects;
- the nine Olympian keepsakes' reward priority and source-specific rarify
  effects;
- a generic mirror of `ExpiredKeepsakes`;
- a generic duration, charge, callback, or effect registry; and
- Echo Gift Gift Gift. Keepsake history will make that later work possible,
  but Echo is not part of this plan.

## Live-Code Baseline

The implementation must use these existing seams rather than create parallel
ones:

- `Catalog` already owns Arcana, Fear, traits, encounters, rewards, rooms, and
  layouts but has no keepsake collection.
- `RouteLoadout` owns weapon/aspect, manual Arcana, and Fear. It is the correct
  owner for the mandatory starting keepsake.
- `AuthoredBiomePlan.bossCompletionArcanaKeys` demonstrates how an authored
  child can belong to a derived completion room without turning that room into
  an occurrence.
- `CompletionRoomAddress` already identifies an exact Postboss owner.
- `RewardBranch` is the chronological cross-biome state product carrying
  reward bags, reward history, trait history, and Arcana/Fear. Keepsake state
  must travel through this same branch.
- the reward walker already processes completion-room lifecycle events in
  order and carries valid branches into the next biome.
- `AuthoredTraitOffer`, its progressive candidates, and its contextual dialog
  already own trait options and selected acquisitions.
- exact acquisition settlement already covers ordinary rewards, Devotion's
  two roles, Shops, pickups, Poms, and trait acquisition timing.
- `EncounterPhaseAddress` already owns ordinary occurrence phases, H cage
  phases, O/P multi-encounter phases, and N side-room phases.
- Run State already presents the branch state immediately before a decision.

The implementation must delete or replace any superseded local predicate it
introduces during a gate. It must not leave a second keepsake history,
rarification fold, acquisition-conversion path, or encounter eligibility path.

## Locked Authored Contract

### Selection owners

Add one exact `KeepsakeSelectionAddress` with two owner forms:

```text
route start
postboss completion of F/G/H or N/O/P
```

The route loadout persists one mandatory starting selection. Each relevant
`AuthoredBiomePlan` persists one complete Postboss disposition:

```ts
type PostbossKeepsakeDisposition =
  { readonly kind: 'retain' } | { readonly kind: 'replace'; readonly keepsakeKey: string };
```

`retain` means the same current identity crosses the rack frontier. `replace`
means the selected identity after the rack closes. It does not persist the old
identity because the chronological engine state already knows it.

The starting declaration-owned default is Silver Wheel
(`ManaOverTimeRefundKeepsake`). Every created relevant Postboss disposition
defaults to `retain`. These defaults are complete authored values, not claims
that the game randomly selected them.

All 33 identities participate in the same authored selection, candidate,
command, history, and no-return contract from Gate A onward. An identity whose
effect is not implemented still appends its real selection/retention history
and applies any declared Fated role, but otherwise produces no gameplay event,
finding, hidden placeholder state, or simulated effect. Later effect slices
activate behavior on that existing identity; they do not introduce a second
kind of selectable keepsake.

Every authored F/G/H/N/O/P plan retains that complete disposition even while
it is the last configured biome. The disposition becomes reached and publishes
an inspector/control only when a successor biome is configured. This preserves
the user's authored rack choice across route truncation and later expansion
without inventing a final-route action. I and Q never own this disposition.

Context-invalid selections remain persisted and repairable. Upstream changes
must not silently reroute a replacement, turn it into retention, or delete an
effect child. Undo/redo, save/load, recovery, and project replacement preserve
the exact authored sequence.

### Effect children

Do not predeclare unused generic effect fields in the foundation gate. Each
effect gate adds only its concrete authored child and bumps the strict project
schema when that persisted contract changes.

Jeweled Pom and Experimental Hammer share one narrow immediate-result boundary
without pretending to be ordinary three-option offers. Add an exact
`KeepsakeEquipResultAddress` whose owner is a `KeepsakeSelectionAddress` and
whose closed result kind is `jeweledPom` or `experimentalHammer`. The persisted
selection record ultimately owns this concrete product:

```ts
interface AuthoredKeepsakeEquipResults {
  readonly jeweledPom?: {
    readonly traitKey: string;
    readonly rarity?: TraitRarity;
    readonly deathDefianceConditionMet?: boolean;
  };
  readonly experimentalHammer?: {
    readonly traitKey: string;
  };
}
```

Gate B introduces the address and first field; Gate C extends the closed
product with the Hammer field. The exact child is reached only when its owning
start/replacement selection equips the matching keepsake. Retention does not
reach an equip child. A mismatched child remains dormant and restorable after
later authoring changes; it emits no event or finding. Each reached child owns
one contextual picker, complete replacement command, candidate capability,
finding destination, and direct trait-acquisition result. It is not added to
`TraitOfferOwnerAddress` and does not acquire offer composition or fallback
behavior.

Immediate equip outcomes belong beneath their exact starting or Postboss
selection. Acquisition conversion belongs to the exact reward acquisition
role. Rarification belongs to the exact trait offer and option row. Fig Leaf
and Gorgon facts belong to the exact encounter phase, including N local-child
phases.

Dormant effect detail is retained when its owning selection, reward, option,
or phase becomes inactive. It publishes no reached event or finding until its
owner is reached and applicable.

## Catalog Ownership

Add one normalized keepsake collection. Every declaration owns:

- stable game key;
- player-facing label;
- fixed planner rank `Epic` / rank III;
- Fated disposition: `neutral`, `enabling`, or `opposing`; and
- an optional closed effect descriptor for one of the six supported effects.

The effect descriptors contain only source-backed values consumed by their
own domain transitions. They do not contain callbacks and must not be
interpreted by one generic effect loop.

Normalization must enforce:

- the exact 33-key inventory with no duplicate or unknown identity;
- exactly Jeweled Pom, Time Piece, and Calling Card as Fated-enabling;
- exactly the nine Olympian keepsakes and Gorgon Amulet as Fated-opposing;
- all other keepsakes as neutral;
- exact rank-III constants for the six effects;
- one complete descriptor on each supported source identity and nowhere else;
- declaration-owned Time Piece conversion capability on exact concrete
  acquisitions;
- declaration-owned Calling Card source participation on trait givers;
- declaration-owned Fig Leaf and Gorgon capabilities on rooms/encounters; and
- a room-level encounter-use policy for Experimental Hammer. This policy is
  separate from encounter-depth counting; N side rooms explicitly ignore
  encounter uses.

Raw declarations should retain game vocabulary where it makes auditing
easier, but normalized products should answer the engine's exact questions
without importing Hades catalog implementation code.

## Chronological Keepsake State

Add a pure branch-owned keepsake state alongside reward, trait, and Arcana/Fear
state. Its complete product contains at least:

- current keepsake key;
- ordered selection/retention history;
- removed keys that cannot be re-equipped;
- effective Fated status;
- exact retained state for active supported effects; and
- effect evidence needed by Run State and branch equivalence.

The state is initialized from the starting selection before the first biome's
opening lifecycle. A Postboss disposition is applied when the reward/lifecycle
walker reaches that derived Postboss room's fixed first-action boundary:

```text
Boss completion
Judgment, if active
Postboss room entry with old keepsake
fixed keepsake retain/replace action
Postboss primary encounter completion and encounter-use effects
Postboss acquisitions and later state with resulting keepsake
next biome
```

Do not delay replacement until `beginBiome`; that would make Postboss
acquisitions observe the wrong state. Do not insert a fabricated rack room or
general interaction-order list. The fixed action is also the planner's first
modeled Postboss action: any primary `Empty` encounter-use effect is folded
after the retain/replace transition.

Branch equivalence and public carry-forward seeds must include every effective
keepsake fact that can change later candidates or settlement. A memoization key
may summarize an explicit state product; it must not be the sole carrier of
effect facts.

### Fated derivation

Fated is derived, never authored. At each selection frontier:

1. an incompatible currently active Arcana card or any opposing keepsake in
   the ordered history yields `Unfated`;
2. otherwise, any enabling keepsake in history yields `Fated`; and
3. otherwise the result is `Unknown`.

Once `Unfated`, enabling keepsakes are unavailable for the remainder of the
route. Once `Fated`, temporary Arcana candidate domains exclude The
Enchantress, The Champions, and The Fates. This exclusion must be applied by
the Arcana authority to Circe/Judgment candidate construction; keepsake code
must not copy or reinterpret Arcana rules.

The first transition to `Unfated` closes all remaining Jeweled Pom, Time Piece,
and Calling Card effects together. Prior trait levels, conversions, and
rarifications remain historical facts.

## Effect Contracts

### Jeweled Pom

At each reached Jeweled Pom equip frontier, author one exact eligible Hades
trait result. This is a source-random single result, not a fabricated
three-option menu. Reuse Hades trait declarations, prerequisites, rarity, and
the existing local Death Defiance condition where required.

The direct result appends an ordinary equipped-trait acquisition at the equip
frontier. While the retained Jeweled Pom effect remains Fated, each later
fresh Pom-eligible trait acquisition receives +3 levels. It does not alter
traits already equipped before activation.

Replacing Jeweled Pom with a neutral keepsake retains its granted Hades trait
and future +3 effect. The first Fated-to-Unfated transition removes only the
Hades trait granted by this keepsake and stops future bonuses. Previously
granted levels remain.

The trait fold may gain closed direct-acquisition and exact-removal events.
They are semantic chronological events, not a generic keepsake callback
mechanism.

### Experimental Hammer

At each reached Experimental Hammer equip frontier, author one exact Hammer
from the current weapon/aspect-compatible, not-already-equipped domain. Reuse
the direct trait-acquisition path established for Jeweled Pom. The acquired
Hammer remains rarityless and begins with 20 qualifying encounter uses.

Each completed modeled primary or override encounter decrements the duration
once, regardless of combat kind or `countsEncounterDepth`. This includes
combat, miniboss, boss, Story, Fountain/Reprieve, Shop, primary `Empty` intro,
hub and Postboss encounters, each successive ordered room phase, and H cage
overrides. N side rooms do not advance it because their declaration ignores
encounter uses. Challenge switches remain outside the modeled route. At zero,
append an exact trait-expiry/removal event.

At the fixed Postboss boundary, apply the retain/replace action before the
primary `Empty` completion. A Hammer granted by Experimental Hammer at that
rack is created with 20 uses and then decremented to 19 before the next biome.
An already-retained temporary Hammer also decrements once. The preceding boss
completion independently consumes one use before the rack.

Retaining the keepsake does not grant or refresh another Hammer. Replacing it
does not remove the granted Hammer. Only duration expiry removes it. Normal
Hammer acquisition may offer the same Hammer again after expiry if ordinary
eligibility allows it.

### Calling Card

Calling Card owns six retained charges at rank III. Its authored history must
distinguish the rolled option rarity from each explicit rarification action.

Persist an ordered list of option keys on the exact trait offer:

```ts
readonly rarificationActions: readonly TraitOptionKey[];
```

The option's existing authored rarity remains its rolled/base rarity. Effective
rarity is derived by replaying the ordered actions. The same option key may
appear repeatedly. An action consumes one charge immediately even if that
option is never selected.

An action is legal only when:

- Fated remains valid and a charge remains;
- the giver declares Calling Card menu participation;
- the option does not block in-run rarification;
- the option has a supported next rarity; and
- the next rarity does not exceed Heroic.

The exact admitted provider set is the nine core Olympians, Hermes, Artemis,
Athena, and Dionysus. Hades is excluded. Hammer, Pom, Icarus, Circe, Medea,
Narcissus, and Arachne do not participate.

Offer composition and base-rarity validation happen before rarification. The
selected acquisition uses effective rarity. Progressive candidates evaluate
each ordered action against the same pre-offer keepsake state and prior
actions. Invalid actions remain authored, receive exact findings, and do not
consume a charge or mutate effective rarity.

### Time Piece

Time Piece owns four retained charges at rank III. Persist one conversion
disposition per exact concrete acquisition role on `AuthoredRewardState`.
Devotion exposes independent chosen- and spurned-god roles, so either or both
can be converted in lifecycle order.

Conversion is legal only when:

- Fated remains valid and a charge remains;
- the exact normalized acquisition declares gold-conversion capability; and
- the concrete instance is free rather than a paid Shop purchase.

A legal conversion consumes one charge and suppresses that role's concrete
acquisition, trait evaluation/acquisition, Pom resolution, level mutation,
element contribution, and ordinary loot-history projection. The authored
reward offer, reward-bag consumption, room/encounter lifecycle, and conversion
evidence remain. This is not reward replacement and does not produce a Gold
acquisition because the planner does not simulate gold.

Optional pickups retain three semantic outcomes through existing membership
plus conversion:

```text
not picked up
picked up normally
picked up as gold
```

All currently modeled World Shop purchases are paid and expose no conversion
control. Do not add prices merely to prove this exclusion. The catalog owns
the closed acquisition-capability matrix; the settlement site supplies the
free/paid instance fact.

### Fig Leaf

Fig Leaf creates three persistent total uses and a one-success-per-biome guard.
The authored fact is `combat skipped by Fig Leaf` on an exact encounter phase.
It is an optional positive-possibility choice: no authored skip consumes
nothing, while a legal authored skip consumes one total use and the current
biome opportunity. It is a separate phase-local disposition beside the selected
encounter identity, not another Encounter Definition or a member of the
encounter picker.

Legality uses normalized source facts, not generic combat kind:

- the exact phase is skippable;
- the room is not a biome-start room;
- no member of the ordered encounter envelope blocks Fig Leaf;
- no prior phase succeeded in the same biome; and
- at least one total use remains.

A skip preserves room and encounter identity, encounter completion, counters,
reward acquisition, exits, and route topology. It suppresses combat execution
only.

The implementation must preserve the audited shapes:

- ordinary F/G/I/N/Q and each generated H cage are independent phase
  opportunities;
- O intro and later ship combat are independent opportunities, but only one
  can succeed in the biome;
- one P pre-combat skip suppresses enemy spawns across the room's ordered
  envelope without requiring one authored flag per phase;
- H passive combat is not eligible;
- Devotion, bosses, and field-NPC combat remain excluded; minibosses use the
  declaration-owned matrix rather than a generic kind rule: Treant, Fog
  Emitter, Assassin, Water Unit, Jellyfish, Vampire, Lamia, Rat Catcher, Gold
  Elemental, Satyr Crossbow, and Boar inherit positive unblocked support;
  Captain, Dragon, Brute, Stalker, and Typhon Tail inherit positive support but
  explicitly block the whole room; Crawler, Charybdis, and Typhon Eye are
  blocker-only; and Talos has no `CanEncounterSkip` declaration and no
  Dionysus-keepsake blocker; and
- N main-room opportunities share the biome-local success guard, while
  `GeneratedNSubRoom` and its inherited larger variant explicitly block Fig
  Leaf and expose no legal skip.

### Gorgon Amulet

Gorgon Amulet owns one pending Athena appearance while it remains equipped.
The pending effect is lost when the keepsake is replaced. It is not permanent.

The catalog owns one exact Gorgon descriptor: one pending use, minimum biome
depth two, Athena as the additive provider, and a fixed Epic fresh-offer rarity.
Room declarations and encounter declarations expose separate
Gorgon-Athena-blocking facts. Do not reuse `blocksKeepsakeSelectionKeys`: that
fact governs later rack selection after an encounter has entered route history,
not whether the current room and encounter can trigger Gorgon.

The complete modeled declaration policy is:

- positive encounter declarations: ordinary generated F/G/H/I/N/O/P/Q and
  their modeled generated variants, including both H passive declarations, H
  cage declarations, N Opening and PreHub, O's later `GeneratedO`, and P's
  later `GeneratedP` and `GeneratedP_Large`;
- encounter blockers: F opening, O intro, every P opening and pre-combat
  declaration, every modeled field-NPC combat, Devotion, miniboss, boss, and
  Anomaly declaration;
- room blockers: all fifteen N side rooms through their inherited
  `BaseN_SubRooms` fact, even though `GeneratedNSubRoom` and
  `GeneratedNSubRoom_Bigger` are independently encounter-unblocked; and
- empty, story, shop, and other non-hosted noncombat phases do not
  structurally host the result.

Eligibility follows these declaration-owned facts, not encounter `kind`, phase
label, biome, or Fig Leaf support. The catalog's exact matrix test owns the full
list; engine and product tests retain representative H-passive, N-side-room,
O, and P witnesses.

Persist one exact `AuthoredGorgonPhaseResult` beneath each encounter phase that
can structurally host this effect:

```ts
interface AuthoredGorgonPhaseResult {
  readonly deathDefianceConditionMet: boolean;
  readonly athenaOffer?: AuthoredTraitOffer;
}
```

Its semantic `GorgonPhaseAddress` owns the local condition and is itself owned
by the exact `EncounterPhaseAddress`. Extend `TraitOfferOwnerAddress` with that
Gorgon address so the conditional Athena offer uses the ordinary
`TraitOfferAddress` with acquisition role `gorgonAthena`. This establishes the
condition before the offer exists. Although ordinary Athena offers may carry
their own authored Death Defiance context, a `gorgonAthena` offer must not
persist a duplicate `deathDefianceConditionMet` field. Its owner supplies that
fact to the ordinary Athena trait evaluator, and the Gorgon-specific codec and
commands enforce its absence from the child.

Every structurally hosting phase defaults to
`deathDefianceConditionMet: false` with no Athena child. The semantic command
that changes the condition to true atomically creates the declaration-owned
three-option Athena default when the child is absent and fixes all three rows
to Epic. A decoded or otherwise structurally representable true result may
still lack the optional child; that state is retained as incomplete rather
than repaired silently. Changing the condition back to false preserves an
existing authored offer dormant for restoration.

The result may remain persisted while dormant. It is reached only while a
pending Gorgon effect is assessing that structural phase. When the condition
is false, `athenaOffer` is dormant and publishes no trait finding. When the
condition is true at the first otherwise-eligible phase, the offer becomes a
required child. An absent or invalid required offer makes that phase
incomplete, does not consume the pending use, and prevents the selected
evaluation from advancing the pending effect to a later phase. It must not
silently activate twice or skip ahead to find a valid child.

Room or encounter replacement retains a phase-local Gorgon result only for the
same stable slot in a replacement room whose declaration and active envelope
still structurally support a Gorgon child. Drop the child when that structural
surface disappears. Retain it when the surface remains but current depth,
selected encounter, room blocker, Fig Leaf execution, condition, or shared
Athena budget makes it context-invalid; the retained result remains authored
and repairable under the ordinary replacement-retention contract.

At an exact structurally eligible encounter phase:

- biome depth must be at least two;
- the room-owned blocker must be false;
- the selected encounter declaration's blocker must be false;
- Fig Leaf must not have skipped the combat; and
- the existing phase-local `deathDefianceConditionMet` fact must be true,
  meaning no Death Defiance remains at that frontier.

False leaves the pending appearance unconsumed for a later eligible phase.
True at the first eligible non-skipped phase creates one additive Athena child
and consumes the pending use. Reuse the same local fact for Athena traits that
inspect the missing-Death-Defiance condition.

Eligibility is assessed at `encounterStarted`, after Fig Leaf has resolved,
using the lifecycle event's actual execution state and the predecessor/pre-room
`biomeDepthCache`. It must not use the depth after the current encounter has
incremented it. A required Gorgon Athena offer settles at
`encounterCompleted`; only a valid required child consumes the pending use.

The additive child does not replace the selected encounter, room reward, or
room occurrence. It owns an exact Athena trait offer beneath the existing
phase address, uses Athena's normal prerequisites and three-option lifecycle,
and fixes every offered rarity to Epic.

Natural `AthenaCombatP` and Gorgon Athena share one route appearance budget.
Whichever occurs first excludes the other. If a natural Athena encounter is
reached while Gorgon remains pending because all earlier phases blocked it,
that natural encounter expires the pending keepsake effect and still produces
only one Athena appearance.

Candidate evaluation preserves the selected/counterfactual distinction.
`AthenaCombatP` is excluded after an earlier Gorgon appearance has consumed the
shared budget. At the same still-pending phase, however, natural Athena remains
a valid alternative candidate when its own requirements pass: its declaration
blocks Gorgon for that alternative, and selecting it expires the pending
effect. The candidate domain must not be derived only from the currently
selected encounter's positive Gorgon support.

Gorgon support must be resolved by the engine before final encounter candidate
publication. Do not encode the additive appearance as `AthenaCombatP`, insert
a synthetic room, or make React arbitrate the shared budget.

The branch-owned Gorgon lifecycle is exact:

- equipping Gorgon creates `pending`;
- completing one valid required additive Athena child changes it to
  `consumed`;
- replacing Gorgon before activation changes pending to `expired`;
- a natural Athena appearance while Gorgon is pending changes it to `expired`;
  and
- consumed history remains consumed after later keepsake replacement.

Run State presents those engine-owned states without reconstructing them from
the current keepsake key or encounter history.

## Application and UI Contract

### Route and completion controls

Route Settings adds one starting-keepsake selector using all catalog labels.
Each reached nonfinal Postboss completion inspector adds one retain-or-replace
selector. Candidate feedback explains removed, Fated-incompatible, or
Athena-blocked identities; React receives those options and bound commands.

Immediate Jeweled Pom and Experimental Hammer outcomes use a contextual
single-result picker attached to the exact selection. They do not appear as
room rewards or ordinary three-option offers.

### Existing workbench extensions

- Calling Card adds engine-backed Rarify actions to exact rows in the trait
  dialog. The dialog presents effective rarity and remaining action support.
- Time Piece adds Convert to Gold beside exact eligible acquisition roles.
- Fig Leaf adds one phase-local `Skip combat with Fig Leaf` control beside the
  encounter presentation only where the engine publishes support. It is not an
  encounter-picker option. A retained authored skip that becomes invalid stays
  visible with candidate feedback for explicit repair.
- Gorgon adds the local Death Defiance condition and Athena offer beneath the
  exact eligible phase when reached.

React must not switch on keepsake keys, trait provider keys, reward names,
room names, or biome names to decide legality. Structured workspace products
carry labels, current values, candidate feedback, commands, and placement.

### Run State

Run State adds a collapsed Keepsakes section containing only engine-derived
facts available at that frontier:

- current keepsake;
- removed/unavailable identities;
- Fated status;
- Jeweled Pom active/inactive state;
- Experimental Hammer result and remaining duration;
- Calling Card remaining charges;
- Time Piece remaining charges;
- Fig Leaf total uses and current-biome availability; and
- Gorgon pending/consumed/expired state.

If branch-equivalent state cannot be truthfully aggregated, Run State uses its
existing unavailable contract. Presentation must not select one branch or
recompute effect state.

## Delivery Gates

### Gate A — Complete identity timeline and Fated authority

1. Declare and normalize all 33 identities, labels, fixed rank III, exact
   Fated dispositions, and Silver Wheel starting default.
2. Add the mandatory route start and complete relevant Postboss dispositions;
   bump the strict schema and update defaults, codec, commands, fixtures, and
   persistence witnesses.
3. Make all 33 identities selectable through the exact start/Postboss
   addresses, semantic commands, progressive candidates, and UI controls;
   preserve context-invalid authored choices and enforce no-return legality.
4. Fold ordered keepsake state into `RewardBranch` and its carry-forward and
   equivalence products.
5. Apply Postboss choices at the fixed first-action boundary.
6. Derive Fated status, enforce enabling/opposing rules, and route Fated Arcana
   exclusions through existing Arcana candidates.
7. Render route and Postboss controls plus baseline Run State.
8. Prove Gorgon cannot be newly selected after natural Athena history.
9. Prove an effect-deferred neutral identity and an effect-deferred opposing
   identity both enter exact history: the neutral selection is otherwise a
   no-op, while the opposing selection still changes Fated state.

Default commit:

```text
feat(planner): model keepsake selection timeline
```

### Gate B — Jeweled Pom

1. Add the closed declaration and equip-owned Hades result.
2. Add `KeepsakeEquipResultAddress`, the exact Jeweled Pom field, its complete
   semantic command/candidate/finding boundary, and bump the schema.
3. Reuse Hades eligibility and the local Death Defiance condition.
4. Append direct acquisition/removal events and the prospective +3 fold.
5. Implement retention and Fated invalidation without rolling back levels.
6. Publish contextual candidates, findings, UI, and Run State.

Default commit:

```text
feat(engine): model Jeweled Pom
```

### Gate C — Experimental Hammer

1. Add the closed declaration and room-level encounter-use facts.
2. Extend the closed equip-result product with the exact Hammer field and bump
   the strict schema; reuse the Gate B semantic boundary without offer
   semantics.
3. Reuse weapon/aspect compatibility and direct acquisition.
4. Fold every modeled primary/override completion, independent of combat kind
   and encounter depth, from 20 uses through exact expiry.
5. Prove boss, Story, Fountain/Reprieve, Shop, primary `Empty`, ordered-phase,
   H-cage, Fig Leaf-preserved completion, and N side-room rows; prove the fixed
   rack-before-Postboss-`Empty` transition, retain, replace, and ordinary
   reacquisition after expiry.
   The Gate C preflight tests expose one implementation correction before this
   matrix is complete: `WorldShopRoom` and `RewardlessRoom` must start and
   complete their already-declared fixed encounter envelope instead of only
   recording it. Do not synthesize Experimental Hammer use at room commit.
6. Publish contextual candidates, findings, UI, and Run State.

Default commit:

```text
feat(engine): model Experimental Hammer keepsake
```

### Gate D — Calling Card

1. Normalize the exact giver capability and rank-III charge count.
2. Persist ordered offer-row rarification actions and bump the strict schema.
3. Derive effective rarity and fold charge use before selected acquisition.
4. Reuse the same evaluator for candidates, findings, selected simulation, and
   Run State.
5. Extend the trait dialog without provider-key policy in React.
6. Prove unselected-row use, repeated same-row use, Heroic ceiling, exhaustion,
   neutral-swap retention, and Fated invalidation.

Default commit:

```text
feat(planner): model Calling Card rarification
```

### Gate E — Time Piece

1. Normalize the exact acquisition conversion-capability matrix and four-use
   declaration.
2. Persist role-local conversion dispositions and bump the strict schema.
3. Intercept legal conversions inside existing acquisition settlement before
   concrete acquisition and child trait/Pom evaluation.
4. Preserve offer and bag evidence while suppressing only the converted
   acquisition effects.
5. Publish exact role controls, progressive feedback, findings, and Run State.
6. Prove ordinary, pickup, Devotion, paid-Shop, exhaustion, neutral-swap, and
   Fated-invalidation behavior.

Default commit:

```text
feat(engine): model Time Piece conversions
```

### Gate F — Fig Leaf

1. Normalize the exact skip, blocker, and envelope-cascade matrix, including
   Q's inherited positive support, N side rooms' explicit blocker, H passive
   combat's exclusion, and the declaration-owned NPC/miniboss/boss matrix
   (including Talos's missing `CanEncounterSkip` fact).
2. Add the exact phase-owned skip result for occurrence and local-child phases;
   bump the strict schema.
3. Fold three total uses and the biome-local success guard through route
   branches.
4. Apply the audited F/G/H/I/N/O/P/Q phase behavior without topology mutation;
   N side-room phases remain exact local-child owners but reject the skip.
5. Publish candidate support, findings, Run State, and a separate phase-local
   skip control beside encounter presentation rather than inside the encounter
   candidate domain.
6. Prove that one biome with no skip preserves a use, one successful skip blocks
   only later successes in that biome, a retained use can be spent in Q, and N
   side rooms never admit a skip.

Default commit:

```text
feat(engine): model Fig Leaf encounter skips
```

### Gate G — Gorgon Amulet

1. Normalize the exact one-use, depth-two, Athena-provider, fixed-Epic,
   room-blocker, encounter-blocker, and shared-Athena-budget facts. The catalog
   matrix must cover every modeled declaration plus all fifteen N side rooms;
   it must prove H passive positive and N's room-blocked/encounter-unblocked
   distinction.
2. Add `gorgonResultByPhase`, the exact phase-owned Gorgon result/address,
   condition command, and conditional `gorgonAthena` trait-offer child; bump
   the strict authored schema from 28 to 29. Default false without a child;
   changing true creates the complete Epic default atomically; malformed true
   without a child remains representable and incomplete.
3. Resolve pending, consumed, and expired state chronologically from
   branch-owned keepsake state. Assess at `encounterStarted` after Fig Leaf,
   using actual execution and predecessor/pre-room depth; settle the required
   child at `encounterCompleted`. Fig Leaf, false condition, insufficient
   depth, and either blocker defer without consuming; an invalid required child
   blocks downstream activation in that evaluation.
4. Reuse the ordinary Athena trait evaluator with parent-supplied Death
   Defiance context and fixed Epic rarity. Do not persist the condition twice
   or add a parallel Gorgon-only trait evaluator.
5. Intersect the shared Athena appearance budget with natural encounter
   candidates before final publication. Exclude natural Athena after an earlier
   Gorgon appearance, but retain it as a counterfactual at the same pending
   phase where selecting its blocking declaration would expire Gorgon. Preserve
   both precedence directions without a synthetic encounter.
6. Retain Gorgon phase results only for the same stable replacement slot while
   its declaration/envelope still structurally hosts the child; drop them when
   that surface disappears and retain context-invalid results otherwise.
   Project the separate additive child, repair findings, and exact Run State
   lifecycle through the application without key-based React policy.
7. Prove depth and false-condition deferral, Fig Leaf deferral, room and
   encounter blockers, H passive support, N side-room exclusion, O/P phase
   timing, swap loss, fixed-Epic three-option Athena lifecycle, invalid-child
   blocking, both shared-budget precedence directions, once-per-route closure,
   UI/finding navigation, and Run State.

Default commit:

```text
feat(planner): model Gorgon Amulet Athena encounters
```

### Gate H — Product closure and absorption

1. Run the complete repository gate once after all narrow lanes are stable.
2. Verify every active selection, effect child, conversion, rarification, and
   encounter result has one reachable semantic owner, interaction, finding
   destination, and inspector.
3. Search for React key switches, duplicate state folds, generic effect
   registries, parallel route history, and production-only audit scaffolding.
4. Retain one primary policy matrix per authority and only representative
   downstream/product witnesses.
5. Absorb durable contracts into catalog, authored-project, lifecycle,
   simulation, contextual-editor, Run State, and audit authorities.
6. Record delivery in the durable progress history and delete this plan.

Default commit:

```text
docs: absorb keepsake delivery
```

## Primary Test Ownership

### Catalog

- exact 33-key/label/rank/Fated inventory;
- malformed, duplicate, missing, misplaced, and mutable nested declarations;
- exact Calling Card provider matrix;
- exact Time Piece acquisition-capability matrix;
- exact Fig Leaf encounter capabilities, including positive Q inheritance and
  the N side-room Fig Leaf blocker;
- exact Gorgon descriptor and declaration matrix, including separate room and
  encounter blockers, H passive support, and all fifteen N side-room blockers;
  and
- exact Experimental Hammer encounter-use exclusions.

### Authored project

- schema/default/codec/command coverage for starting and Postboss selections;
- retain, replace, no-return, and context-invalid persistence;
- one primary codec/command owner for each effect child;
- dormant preservation across parent changes; and
- save/load, recovery, undo/redo, and project replacement contact.

### Simulation and candidates

- one primary timeline suite for start, Postboss timing, carry-forward,
  no-return, Fated transitions, Arcana interaction, and branch equivalence;
- one focused primary suite per supported effect;
- candidate/selected equivalence at each exact owner;
- invalid authored values produce findings without state mutation;
- cross-biome seeds preserve retained effects and removed identities; and
- Run State uses the same branch product as progressive validation.

### Application and React

- route starting-control workflow;
- Postboss retain/replace workflow;
- one structured-workspace ownership/interaction witness per new child family;
- focused trait-dialog rarification, acquisition conversion, and encounter
  phase tests, including a fixed Q phase and an N local-child exclusion; and
- finding navigation to the exact owner.

### Product-loop witnesses

Retain only representative cross-layer workflows:

1. start, replace at Postboss, and observe the next-biome state;
2. retain a Fated effect after a neutral swap, then invalidate it;
3. convert one Devotion role without converting the other;
4. rarify an unselected option and consume a charge; and
5. skip one combat with Fig Leaf, then resolve pending Gorgon Athena later.

Use `test:catalog`, `test:engine`, and the narrow planner/UI/product lanes while
implementing. Do not run the complete repository suite after every adjustment.
Run `npm run check` once at Gate H closure, after review fixes are stable.

## Audit-Againsts

Each gate review must explicitly reject:

- one keepsake key per biome instead of the true Postboss transition;
- a final I/Q swap with no modeled consumer;
- automatic rehoming or deletion of an invalid authored selection;
- a second route-history walker outside the existing chronological branch;
- Fated as authored state or as a React-derived flag;
- temporary Arcana invalidating an already-Fated route instead of becoming
  unavailable;
- a current-slot-only model that loses retained effects;
- a generic effect bag, callback registry, or service locator;
- inferred Calling Card use from final rarity alone;
- Time Piece modeled as reward replacement, fallback Gold, or Shop price
  simulation;
- Fig Leaf inferred from combat kind or encounter-depth counting;
- Fig Leaf represented as another Encounter Definition or encounter-picker
  option;
- Q Fig Leaf support omitted or N side-room combat treated as skippable;
- Experimental Hammer duration inferred from encounter-depth counting;
- Gorgon Athena represented as `AthenaCombatP`, a synthetic room, or reward
  replacement;
- React switches on game keys to recreate domain policy;
- exhaustive policy matrices duplicated across catalog, engine, projection,
  and UI suites; and
- temporary plan links added to stable documentation.

## Completion Criteria

The phase is complete only when:

- all 33 identities participate in the exact legal timeline;
- the six effects produce the settled source-backed behavior;
- every authored child is persisted, reachable, progressively assessed, and
  navigable;
- selected simulation and candidate evaluation agree at the same frontier;
- Run State reports the same effective keepsake state;
- no superseded or parallel implementation remains;
- the complete repository gate passes; and
- durable knowledge is absorbed and this temporary plan is removed.
