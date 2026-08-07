# Trait Offer Implementation Plan

## Status

Locked implementation contract. This document remains isolated while the
work is active. Stable game evidence belongs in
`../audits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md`; completed ownership and
behavior will be absorbed into the relevant design authorities before this
file is retired.

## Purpose

Add concrete three-choice trait offers for the first complete provider slice:

- the nine ordinary Olympians;
- Hermes; and
- Daedalus Hammers for all six weapons and four aspects per weapon.

The feature records the three alternatives, the rarity carried by each ranked
alternative, and the one selected trait. Hammer alternatives carry no rarity.
It folds only the selected trait into chronological equipped-trait state,
derives the offer facts that depend on that state, and preserves the existing
exact loot and use ledgers.

This is not a generic item-effect system. The slice exists to establish one
truthful trait-offer contract and prove it through dependency-driven boons,
multi-role reward timing, Shop purchases, and loadout-dependent Hammers.

## Live-Code Baseline

The current application already owns the surrounding lifecycle:

- `ResolvedRewardOffer` identifies the reward type and any authored source;
- reward types declare exact acquisition roles;
- producer lifecycles place those roles at `beforeCombat`, `afterCombat`,
  `roomRewardPickup`, or `purchase`;
- every persisted reward leaf belongs to an exact incoming, local, wheel, or
  Shop owner;
- Shop purchase order and Devotion roles already establish acquisition order;
- structured workspace assembly publishes exact semantic owners and bound
  interactions; and
- loot/use history remains canonical across rooms and biomes.

The current `upgradableTraitCount` is intentionally approximate: every
acquired ordinary source increments it once. Concrete trait state must replace
that approximation in this work rather than coexist with it. The game also
derives element totals and god-boon rarity totals from equipped traits; those
facts do not yet exist in the planner.

The project is currently schema version 14. It has no route loadout, no trait
catalog, no persisted trait-offer child, and no equipped-trait ledger.

## Locked Scope

### Included providers and acquisition surfaces

Provider recognition is based on the concrete acquisition role resolved by
the reward kernel, not on room kind or rendered reward label.

Consequently the slice applies wherever a current authored reward resolves to
an in-scope acquisition, including:

- direct ordinary Olympian, Hermes, and `WeaponUpgrade` rewards;
- `Boon` and `RandomLoot` source payloads;
- purchased `BlindBoxLoot` hidden-source roles;
- `ShopHermesUpgrade` and `WeaponUpgradeDrop` fixed roles;
- both ordered Devotion source roles;
- ordinary room rewards, local Fields/Ephyra rewards, Ship wheel rewards, and
  purchased Shop offers.

An unpicked room, unentered local child, unselected wheel result, or
unpurchased Shop offer does not emit a trait event. Its authored descendant
may remain dormant and is restored if that same reward owner becomes active
again.

### Included legality

The first slice models:

- exact giver-pool membership;
- exactly three distinct offered trait keys;
- one selected option;
- supported fresh-offer rarity for each ranked trait;
- concrete equipped rarity for ranked traits, including `Heroic` as a
  representable in-run state but never a fresh ordinary choice;
- explicit absence of rarity for Hammer traits;
- exclusion of an already equipped copy;
- positive equipped-trait prerequisites;
- in-scope negative equipped-trait predicates found during Gate A closure;
- Devotion's no-Duo offer-context rule;
- room-declaration-owned `BlockGiftBoons` context;
- element contributions and the ten audited infusion offer thresholds;
- derived god-boon rarity counts, including
  `CommonGlobalDamageBoon`'s zero-Common condition;
- the exact cached `upgradableTraitCount` contract;
- the distinct rarifiable-target check used by `BoonGrowthBoon`;
- the distinct non-stacking, next-rarity target check used by
  `BoonDecayBoon`;
- occupied ordinary boon slots under the no-swap policy;
- selected weapon and aspect compatibility for Hammers; and
- explicit equipped-Hammer trait exclusions.

All three alternatives must be legal against the same state immediately
before the offer. One alternative never satisfies another alternative's
prerequisite. Only the selected alternative changes later state.

### Explicitly deferred

- NPC and Story choice providers, including effect-backed wrapper entries;
- Artemis, Icarus, Athena, Arachne, Narcissus, Echo, Hades, Medea, Circe, and
  Dionysus trait effects;
- Chaos blessings/curses and `ChaosWeaponUpgrade`;
- Selene Hex and Talent progression;
- Pom level selection, trait stacks, and concrete Stack effects;
- boon replacement/swap offers, fresh `Heroic` offers, and all rarity-mutating
  trait effects;
- Boon Decay target selection, rarity mutation, and stack/level changes;
- Boon Decay's Hephaestus cooldown/level exception; until equipped levels
  exist, those traits use the same non-`BlockStacking`, next-rarity rule as
  other god traits;
- rerolls, ban-unpicked effects, `RestrictBoonChoices`, keepsake forcing, and
  probability;
- weapon/aspect levels and mechanical damage simulation; and
- mechanical effects and activation thresholds of elemental and other traits;
  element contributions and offer thresholds remain included because they are
  offer-legality facts.

Occupied ordinary boon slots therefore make another trait for that slot
ineligible in this slice; they do not synthesize a replacement offer. Every
source predicate discovered in Gate A must receive an explicit modeled or
deferred disposition. Nothing may disappear behind a permissive fallback.

## Core Model

### Catalog authority

The normalized catalog gains three deliberate products:

1. weapon and aspect declarations;
2. trait declarations; and
3. trait-giver declarations bound to concrete acquisition game names.

A weapon owns its key, label, ordered aspects, and default aspect. An aspect
owns its key and label and belongs to exactly one weapon.

A trait declaration owns only facts consumed by this slice:

- exact game key and label;
- a supported fresh/equipped rarity domain, or an explicit no-rarity domain for
  Hammers;
- typed offer requirements: positive and negative equipped keys, element
  thresholds, rarity-count thresholds, upgradeability predicates, and
  offer-context facts;
- optional ordinary boon slot;
- exact element contributions;
- persistent god-trait classification plus `BlockStacking`,
  `BlockInRunRarify`, `ExcludeFromRarityCount`, and the self-exclusion fact
  needed by the audited derived queries;
- for a Hammer, its weapon and accepted aspect keys.

These are explicit declaration fields and a closed requirement expression,
not an opaque `conditions` bag or callable source predicate. The normalized
catalog also owns the in-run rarity order
`Common -> Rare -> Epic -> Heroic`; each trait's supported equipped levels
determine whether that next step actually exists. `Heroic` is therefore in the
engine rarity vocabulary without entering any fresh-offer domain.

Trait declarations are giver-neutral. A shared Legendary or Duo trait may be
present in more than one giver pool without being duplicated or assigned a
false single owner. The giver-to-trait memberships are the authority for which
provider can offer it.

Equipped-trait requirement operands remain exact game keys. They may name a
trait from a deferred NPC, Story, Spell, or Talent provider without forcing a
placeholder offerable trait declaration into this slice. Such an operand is
truthfully unsatisfied because no included lifecycle can equip it yet; when a
later provider records that exact key, the existing predicate becomes
satisfiable without translation. Gate A source-closure tests verify these
operands against game data, while normalized catalog construction validates
the declaration, pool, default, rarity, weapon, and aspect references it owns.

A giver declaration owns:

- exact acquisition game name;
- label and provider kind (`olympian`, `hermes`, or `hammer`);
- unique ordered trait pool;
- exact three-trait authored defaults: one provider default for
  Olympian/Hermes givers and loadout-keyed defaults for Hammers; and
- rarity authorship: selectable for Olympian/Hermes scalable traits, with
  trait-local sole-rarity domains for Legendary and Duo traits, and absent for
  Hammers.

Reward types continue to own acquisition-role resolution. Room declarations
own room facts such as `BlockGiftBoons`; reward context owns facts such as
Devotion's no-Duo policy. Trait declarations reference the normalized fact
they require but must not copy room names, producer, Shop, or reward timing.
Catalog construction rejects unknown declaration, pool, default, weapon, and
aspect references;
defaults outside the giver pool; duplicate members within a pool; incomplete
three-option defaults; incompatible rarity domains; cross-weapon aspects;
unknown element or requirement operands; missing Hammer defaults for any of
the 24 loadouts; and malformed Hammer compatibility.

### Route loadout

Each `AuthoredRoutePlan` owns one complete loadout:

```text
weaponKey + aspectKey
```

The aspect must belong to the selected weapon. Project creation installs the
catalog-owned default loadout. One atomic semantic command replaces the pair;
changing weapons cannot leave a transient cross-weapon aspect.

Changing the loadout does not rewrite existing Hammer choices. Structurally
valid stale choices remain persisted and receive contextual findings until the
user corrects them. Undo restores the exact prior pair and choices.

### Reward-owned trait offers

`ResolvedRewardOffer` remains the reward-kernel value and does not absorb
authoring state. Persisted reward leaves instead use one authored wrapper:

```text
AuthoredRewardState
  offer: ResolvedRewardOffer
  traitOffersByAcquisitionRole: role key -> AuthoredTraitOffer
```

Every current incoming, local, wheel, and Shop reward leaf moves to that one
wrapper in the schema authority switch, including declaration-fixed incoming
rewards. For a fixed room, the wrapper's resolved offer remains non-editable
and the codec validates it against the room declaration; the wrapper exists so
a fixed Devotion room can own its two real trait children, not to manufacture a
fake reward picker. A trait child exists only for an acquisition role that
resolves to an in-scope giver. Devotion therefore owns two children, while
Blind Box owns a child only for `hiddenSource`, not for the box-consumption
role.

An authored trait offer contains three stable slots and one selected slot:

```text
option1 -> trait key + rarity when ranked
option2 -> trait key + rarity when ranked
option3 -> trait key + rarity when ranked
selectedOptionKey -> option1 | option2 | option3
```

Rarity is a concrete game fact on every ranked option. Hammer options have no
rarity field and React presents no Hammer rarity control. Legendary and Duo
traits expose their sole legal rarity rather than a meaningless picker.

Replacing a parent reward or source atomically installs the new role-complete
trait defaults and discards incompatible descendants. Hammer default
installation receives the route loadout and uses its exact catalog default;
it does not start every weapon from one arbitrary Hammer triple. Undo restores
the previous complete subtree. Merely picking or unpicking a room, local
child, wheel result, or Shop purchase preserves its descendant authoring.

### Semantic ownership and commands

Add one `TraitOfferAddress` beneath an exact reward-owner address and
acquisition role. Stable option keys address the three alternatives when a
finding needs finer ownership. Addresses never use rendered order, labels, or
the route-wide Traits panel position.

Commands remain structural:

- replace the route loadout atomically;
- replace one complete three-option offer atomically; and
- replace the selected option key.

Command handlers verify address contact, giver membership, exact cardinality,
distinct keys, and trait-local rarity domains. They do not reject a
structurally valid option because current history, slots, or loadout makes it
context-invalid; simulation and candidate evaluation own those findings.
Candidate assessment nevertheless exposes sibling-option duplication as an
unavailable edit so the UI does not invite a command the structural handler
must reject.

Schema version 15 is one authority switch. Version 14 is rejected clearly;
there is no parallel legacy reward-leaf representation or compatibility
adapter.

## Simulation Contract

### Trait history

Add an explicit trait history product beside existing reward history:

- chronological trait-offer events with exact semantic owner, giver, three
  options, selected option, and acquisition point;
- folded equipped traits keyed by exact trait key, retaining concrete rarity
  for ranked traits and no rarity for Hammers;
- ordinary boon-slot occupancy;
- element counts and `highestBaseElementCount`;
- god-boon rarity counts; and
- the exact derived `upgradableTraitCount`.

Existing `offerHistory`, `useRecord`, `lootTypeHistory`, biome records, and
other reward ledgers remain unchanged. Trait state is additive; it does not
replace loot identity.

The equipped ledger is canonical. The independent ordinary-source increment
of `upgradableTraitCount` is deleted, and every listed fact is rebuilt from the
ledger plus normalized trait declarations. Boon Growth's rarifiable-target
predicate and Boon Decay's superchargeable-target predicate are evaluated from
that same product; they are not aliases for `upgradableTraitCount` and are not
persisted shadow counters. There is one authority for all of these facts after
Gate B.

### Lifecycle timing

Trait offer evaluation and selected-trait acquisition occur at the same
producer lifecycle point as their concrete acquisition role, immediately
after the existing exact loot/use projection for that role.

This preserves current chronological distinctions:

- an ordinary room reward equips its selected trait at reward pickup;
- a purchased Shop option equips in authored purchase order;
- an unpurchased option equips nothing;
- Devotion's chosen-source selection happens before combat;
- Devotion's spurned-source selection happens after combat and sees the
  already equipped chosen trait; and
- later room generation sees every earlier selected trait but never an
  unselected alternative.

The engine must not infer trait timing from reward names or room kinds.

### Candidate and finding semantics

The engine exposes an address-aware trait candidate query over:

```text
catalog
+ authored project and exact trait-offer address
+ matching pre-acquisition trait history
+ route loadout
+ resolved offer context: acquisition role, reward type, and declaration-owned
  room facts
-> trait and applicable-rarity candidate assessments
```

Presentation and interaction binding consume this product as sibling
application stages. React and Redux do not inspect prerequisite graphs,
elements, rarity counters, room-context rules, occupied slots, aspect
matrices, or history order.

Evaluation checks all three authored alternatives against the same
pre-selection snapshot. It emits exact-owner findings for already-equipped
traits, missing or violated equipped requirements, Devotion Duo choices,
`BlockGiftBoons` conflicts, unmet element or rarity-count thresholds, missing
rarifiable/superchargeable targets, occupied slots, wrong weapon/aspect, and
explicit Hammer exclusions. Provider membership and trait-local fresh rarity
domains remain structural command/codec checks rather than impossible runtime
findings. The selected option is not a waiver for invalid unselected
alternatives: the game must have been able to generate the complete authored
offer.

Simulation publishes one explicit, address-indexed reached-offer evaluation
trace. Each reached entry carries its pre-acquisition trait state, authored
offer, assessment, and chronological position. A valid acquisition additionally
emits the canonical trait event and folds the selected trait. An invalid reached
offer remains in the evaluation trace for findings and repair but does not
enter canonical equipped state. A role whose parent lifecycle point is not
reached emits neither a finding nor an event; its candidate query reports
context unavailable rather than inventing empty history.

The candidate session and chronological application projection consume that
same explicit trace. Neither may independently replay the route to recover a
pre-acquisition checkpoint.

## Application and UI Contract

### Route settings

The existing Route overview adds Weapon and Aspect controls. Their options and
labels come from the normalized catalog. A weapon change dispatches one
complete loadout command using that weapon's default aspect; an aspect change
dispatches the same command with the retained weapon.

### Room-local editing

When an exact trait-bearing acquisition is active for an entered/picked room,
its reward presentation exposes a compact selected-trait summary and a
`Edit offer` action. The action opens a modal dialog for that exact
`TraitOfferAddress`; the three-choice form does not expand inside the room
workbench. Dormant descendants remain withheld from the room UI and do not
produce findings until their parent acquisition becomes active.

One reusable `TraitOfferDialog` hosts one reusable `TraitOfferEditor`. The
editor renders:

- three stable option rows;
- a trait selector per row;
- rarity only when the giver/trait exposes a meaningful authored domain;
- the one selected option; and
- exact semantic markers and contextual feedback.

The dialog title and compact launcher summary identify the giver, selected
trait, and rarity where applicable. Devotion presents one role-labeled
launcher per acquisition role; it does not combine two semantic owners into
one form. Purchased Shop options use their existing main Shop reward surface
as the containing inspector; trait details do not move Shop reward selection
into a generic room-customization bucket.

Dialog visibility is transient UI-session state and never enters authored
history. The dialog uses an accessible modal primitive with focus containment,
Escape dismissal, a scrollable responsive body, and focus restoration to the
launcher that opened it. Closing the dialog changes no authored state.

This slice establishes the reusable dialog shell for future picked-room
customization, but it does not migrate existing encounter, NPC, detour, or
other room-local Customize disclosures. That broader presentation change
requires its own UX decision and regression scope.

### Chronological Traits panel

Each route gains a `Traits` panel beside Route and NPCs. It projects reached
trait-offer evaluations in lifecycle order, including the currently invalid
reached offers that were omitted from canonical equipped state. Each compact
row shows biome/room, giver, selected trait, and rarity where applicable, then
opens the same `TraitOfferDialog` used by the room launcher. The full
three-option form is not duplicated inline in the route panel.

The route panel and room inspector reference the same `TraitOfferAddress`,
workspace control package, candidate query, and bound commands. They are two
projections, never two models. Navigation from a route row resolves through
the existing exact `focusByOwner` destination to the containing room
inspector. No route-wide array is persisted merely to support this view.

Finding navigation to an active trait-offer owner must make its editor
immediately reachable. The application resolves the exact owner to its
containing inspector and a trait-dialog handoff in the existing focus
destination. The navigation coordinator records the exact dialog owner in
transient editor-session state, and React opens that dialog. Manual room and
Traits-panel launchers use the same session action. Closing the dialog clears
only that transient target and restores launcher focus; a still-selected
finding does not continuously force the dialog back open. A finding must never
land on a control hidden behind a closed disclosure or require a second click
to reveal its editor.

### Workspace closure

Every active trait-offer owner must have:

- one exact source address;
- one reachable containing inspector;
- one bound interaction package;
- one exact finding destination; and
- zero or more presentation references, including the room summary and Traits
  panel.

Closure validates semantic-owner reachability, not rendered node count.

## Delivery Gates

### Gate A — Source closure and normalized catalog

Deliver:

- extend the audit only with fields consumed by this slice: trait labels,
  fresh and equipped rarity domains, ordinary slot, element contributions,
  god-trait and rarity-count classification, `BlockStacking`,
  `BlockInRunRarify`, `ExcludeFromRarityCount`, self-exclusion, and supported
  positive/negative or derived-fact predicates;
- normalize the closed offer-context vocabulary for Devotion's no-Duo policy
  and room-owned `BlockGiftBoons` without copying room names into traits;
- normalize the element vocabulary, base-element classification, and in-run
  rarity order through `Heroic`;
- give every other encountered source predicate an explicit modeled or
  deferred disposition;
- stop Gate A and reopen this contract if source closure discovers an unlisted
  offer-affecting predicate; the executor must not choose a new modeled or
  deferred policy while implementing the locked gate;
- retain exact deferred-provider keys used as operands by an included
  equipped-trait requirement without creating placeholder declarations;
- add weapon, aspect, trait, and giver normalized contracts;
- declare all nine Olympian pools, Hermes, and all 92 Hammers;
- encode the audited 48-trait aspect restriction matrix;
- declare a complete valid Hammer default triple for every loadout; and
- add catalog construction and source-closure tests.

Audit against:

- 10 boon givers and one Hammer giver family;
- 211 Olympian/Hermes giver memberships and 92 Hammer memberships;
- all 24 weapon/aspect pairs;
- the 75 in-scope Olympian/Hermes traits with positive prerequisites;
- all included trait element contributions and all 10 infusion offer
  thresholds;
- Devotion Duo blocking and the three `BlockGiftBoons` traits;
- `CommonGlobalDamageBoon`, `BoonGrowthBoon`, and `BoonDecayBoon` source
  predicates as three distinct contracts;
- every explicit negative in-scope predicate found by closure; and
- no NPC/Story wrapper imported into persistent trait semantics.

Gate:

- catalog normalization is exhaustive and immutable;
- all referenced keys and defaults resolve;
- every source predicate has a named disposition;
- every included trait's element, rarity-count, stacking, and in-run-rarify
  facts match source inheritance after normalization;
- every exact prerequisite operand matches source evidence even when its
  provider is deferred;
- shared traits have one declaration and every valid giver membership;
- all 24 Hammer loadouts resolve a complete compatible default triple;
- no simulation, authored state, Redux, or React policy enters the catalog.

### Gate B — Schema-15 engine authority switch

Deliver:

- route-owned weapon/aspect state and atomic loadout command;
- the universal authored reward wrapper, including non-editable fixed state;
- role-addressed three-option trait children and semantic addresses;
- defaults, codec, validation, replacement reconciliation, and commands;
- trait-offer events and folded equipped state at acquisition-role timing;
- the equipped-trait derived-facts fold for elements, base-element maximum,
  god-boon rarity counts, slots, and exact `upgradableTraitCount`;
- the explicit reached-offer evaluation trace and context-unavailable
  boundary;
- pure trait and applicable-rarity candidate assessment for every included
  provider;
- three-alternative validation against one pre-selection history snapshot;
- already-equipped, prerequisite, supported negative predicate, ordinary
  slot, offer-context, element, rarity-count, rarifiable target,
  superchargeable target, Hammer loadout, and Hammer exclusion findings;
- `Heroic` in the equipped rarity vocabulary but absent from every fresh-offer
  candidate domain;
- exact derived `upgradableTraitCount`, distinct Boon Growth and Boon Decay
  eligibility, and no shadow eligibility counter; and
- removal of the ordinary-source counting approximation.

Audit against:

- every persisted incoming, local, wheel, and Shop reward surface, including a
  fixed Devotion room without exposing a fixed-parent reward picker;
- direct, payload-source, fixed-role, Devotion two-role, and Blind Box delayed
  acquisition resolution;
- picked/unpicked and purchased/unpurchased activation;
- reward replacement versus dormant retention;
- route/biome history carry and reset boundaries;
- every giver pool, prerequisite row, and supported rarity;
- all element thresholds, zero-Common history, a Heroic-only history boundary,
  Devotion Duo blocking, and Anomaly `BlockGiftBoons`;
- ordinary non-stacking Boon Decay targets, blocked targets, and Hephaestus
  targets following the generic first-slice rule without a level/cooldown
  branch;
- a prerequisite satisfied before the offer versus only by another option;
- all six weapons and all 24 weapon/aspect pairs; and
- all 48 restricted and 44 unrestricted Hammer traits.

Gate:

- equal schema-15 JSON decodes to equal complete state;
- schema 14 fails clearly;
- no active trait-bearing role lacks a complete child;
- no inactive role emits a trait event;
- an invalid reached offer remains repairable but never enters equipped state;
- exact loot/use ledgers remain unchanged;
- all derived trait facts equal a fresh fold of the canonical equipped ledger;
- one selected trait, and only that trait, enters equipped state;
- candidates and validation share one legality authority;
- commands preserve structurally valid context-invalid authoring; and
- React-facing labels, sections, and focus destinations stay out of engine
  products.

### Gate C — Workspace and UI

Deliver:

- workspace trait control and interaction contracts;
- occurrence assembly and expected-owner closure;
- the exact transient trait-dialog target and navigation handoff;
- the shared Trait Offer editor;
- the accessible Trait Offer modal and compact room/reward launchers;
- the chronological route Traits panel with exact navigation;
- Route overview loadout controls;
- rarity-aware Olympian/Hermes editing; and
- no-rarity Hammer editing with no fake rarity field or selector.

Audit against:

- ordinary decisions, Fields/Ephyra local rewards, Ship wheels, Devotion, and
  purchased Shop offers;
- dormant offer withholding and reached-invalid finding reachability;
- the same semantic owner edited from room and route projections;
- editor-session reconciliation after parent reward/topology replacement;
- modal focus containment, Escape dismissal, launcher-focus restoration, and
  finding-driven opening/handoff;
- representative ordinary, Hermes, room Hammer, and Shop Hammer workflows;
- loadout changes retaining now-invalid authored Hammer choices; and
- unpurchased Shop trait offers contributing no equipped state.

Gate:

- no React component evaluates trait eligibility or reconstructs lifecycle
  order;
- one bound interaction package serves every presentation reference;
- dialog visibility remains outside authored state and undo/redo;
- finding navigation opens the exact trait editor without hiding its controls;
- keyboard and semantic focus reach the exact containing inspector;
- focused UI and product-loop witnesses pass.

### Gate D — Cross-layer closure and absorption

Deliver:

- exhaustive source-to-catalog closure checks for every included giver,
  prerequisite, offer-context rule, element contribution, derived-fact
  predicate, ranked rarity level or no-rarity classification,
  stacking/in-run-rarify flag, aspect restriction, and equipped-trait
  exclusion;
- representative full-route chronology through ordinary, Hermes, Devotion,
  Shop, and Hammer acquisitions;
- cross-layer product-loop closure; and
- absorption into design authorities followed by retirement of this progress
  plan.

Audit against:

- all 92 Hammer traits;
- all six weapons and 24 weapon/aspect pairs;
- all 48 explicitly aspect-restricted traits and the 44 unrestricted traits;
- two acquired Hammers with compatible and explicitly excluded pairings; and
- one complete Underworld and Surface route carrying trait state across every
  configured biome.

Gate:

- every legal Hammer option is admitted for the correct loadout;
- every wrong-aspect or conflicting option has an exact finding;
- no room, Shop, or UI code switches on Hammer trait names;
- no trait-free `upgradableTraitCount` approximation, persisted element
  counter, persisted rarity counter, or other shadow eligibility model remains;
  and
- `npm run check` passes.

## Primary Test Ownership

- Catalog declaration and normalization matrices:
  `packages/hades2-catalog/test/`.
- Authored schema, defaults, addresses, commands, and round trips:
  `packages/planner-engine/test/authored-project/`.
- Trait candidate, lifecycle, history, derived-fact, offer-context, and finding
  policy:
  `packages/planner-engine/test/` beside the new trait authority and simulator
  consumers.
- Workspace assembly, interaction binding, navigation, and closure:
  `apps/planner/src/projections/structured-workspace/` tests.
- React control behavior:
  focused editor and shell interaction tests.
- Representative end-to-end chronology only:
  `apps/planner/test/product-loops/`.

The complete prerequisite and aspect matrices have one catalog/engine primary
owner. Workspace and browser tests retain representative contact witnesses
rather than reproducing those matrices.

## Completion Definition

The slice is complete when:

1. every acquired in-scope provider role owns an exact authored three-choice
   offer;
2. only its selected option changes equipped state at the correct lifecycle
   point;
3. loot/use history remains intact and element, applicable rarity, slot, and
   upgradeability facts derive only from concrete equipped traits;
4. Olympian/Hermes prerequisites, Devotion/room context, infusion and
   rarity-derived requirements, and Hammer loadout/exclusion rules drive engine
   candidates and findings;
5. room and chronological route views edit the same semantic owner;
6. NPC/Story/effect-backed choices remain explicitly outside the persistent
   trait lifecycle; and
7. `Heroic` is a valid equipped rarity but not a fresh authored offer, while
   rarity-mutating effects and the Hephaestus level/cooldown exception remain
   explicitly deferred; and
8. the complete repository gate passes with no legacy reward-leaf path,
   production shadow model, or UI-owned eligibility policy.
