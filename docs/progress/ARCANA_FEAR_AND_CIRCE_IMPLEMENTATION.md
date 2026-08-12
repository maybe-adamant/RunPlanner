# Arcana, Fear, and Circe Implementation Plan

## Status

**Locked for implementation.** This isolated delivery plan starts from the clean
schema-20 acquisition-settlement baseline at `758d8221d047`. Its source facts
are owned by `docs/audits/ARCANA_AND_FEAR_GAME_DATA_AUDIT.md` and the Circe
inventory in `docs/audits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md`.

Keep this plan isolated while implementation is active. At closure, absorb the
durable authored, simulation, candidate, and editor contracts into their owning
design documents and retire this file.

## Objective

Add a route-level Arcana and Fear loadout, carry their exact run-local state
through progressive simulation, model Judgment's post-boss activations, and
publish Circe as a complete nine-choice Story trait provider.

The slice must preserve the current architecture:

```text
catalog declarations
  -> authored route/loadout and exact random outcomes
  -> progressive Arcana/Fear state
  -> candidate assessment and semantic findings
  -> structured-workspace controls
  -> React presentation
```

It must not introduce a generic trait-effect interpreter, string-keyed effect
bag, React-owned Arcana rules, a second route simulator, or a service/context
object that hides the state threaded through reward evaluation.

## Locked interpretation

### Progressed Arcana baseline

- All 25 Arcana cards have permanent rank III.
- A normally or temporarily activated card therefore begins with an Epic
  run-local Arcana-trait rarity.
- Permanent rank is not authored and cannot change during this slice.
- Lapis Lazuli Insight may promote an active Epic Arcana trait to Heroic for
  the current run. It does not change permanent rank.
- A Heroic Arcana card is not eligible for another Lapis promotion.

### Route Arcana loadout

- The route persists the manually activated cards.
- The engine derives the six ordinarily automatic cards from the declared
  board layout and activation rules.
- That ordinary derivation is seeded from the manual loadout at route start.
  Later temporary activation does not rerun or rewrite the starting automatic
  set; it adds to the resolved active state directly.
- Runtime state exposes one resolved active set while retaining whether a card
  came from manual configuration, ordinary automatic activation, or temporary
  activation.
- Red Citrine and Judgment may temporarily activate an ordinarily manual or
  automatic card without satisfying its normal activation rule.
- Temporary activation persists for the rest of the route.

The slice does not model permanent progression, card unlocking, Fated mode,
Grasp capacity, or Vow of Void's Grasp reduction. The editor is authoring the
planner's progressed run input, not recreating the Arcana configuration screen.
Automatic-card legality is modeled because Circe and Judgment consume the
resolved active set; complete Grasp-loadout validation is a separate feature.

### Route Fear loadout

- Every declared Vow has a selectable integer rank from zero through its
  declaration-owned maximum.
- Rank zero means inactive.
- Total Fear is derived from the selected ranks and the declaration-owned
  incremental points.
- Black Night creates a run-local disabled-Vow fact. It does not change the
  configured rank or configured total Fear.
- A disabled Vow is treated as inactive for later runtime queries.
- Vow of Rivals is never a Black Night target.

The slice does not simulate the ordinary gameplay effects of every Vow. Fear
rank, configured total, effective active state, and Circe suppression are the
complete supported surface.

### Exact random outcomes

The planner continues to author one concrete possible result instead of
probability or seeded randomness.

- Red Citrine authors the exact inactive Arcana card it activates. If no card
  is inactive, the selected trait has a valid empty outcome.
- Lapis authors one canonical unordered set of distinct targets. Its required
  cardinality is `min(2, eligible active cards)`.
- Black Night authors exactly one eligible configured Vow. The outer trait is
  ineligible when no removable active Vow exists.
- Judgment authors one canonical unordered set of distinct inactive cards at
  every reached boss completion where the effect is active. Its required
  cardinality is the lesser of the rarity-scaled count and the number of
  inactive cards.

Canonical set storage sorts by declaration order. Authored order never implies
an effect order.

### Judgment timing

Judgment is not a Circe-offer child and is not a room occurrence. It is a
repeating run-state transition owned by the exact derived Boss completion
address for each biome.

1. The engine reaches the Boss room's `encounterCompleted` lifecycle event.
2. It reads the Arcana state immediately before the post-boss effect.
3. If Judgment is active, it derives the required count from Judgment's
   current run-local rarity: five at Epic and six at Heroic.
4. It validates and applies that Boss completion's authored inactive-card set.
5. The Postboss room and any later biome consume the evolved Arcana state.

This applies independently at every reached Boss completion, including later
bosses after earlier Judgment activations. A Judgment activated by Red Citrine
before a boss participates at that boss. A Judgment promoted by Lapis uses the
Heroic count. Already active cards cannot be selected again.

The existing completion-room lifecycle remains the chronological authority.
Do not create a synthetic authored room, fake reward, or special return edge.

### Circe provider

`Story_Circe_01` publishes the following fixed-Common choices:

Lapis retains the game's positive configured-Arcana-cost requirement. The
planner can derive that fact from the selected manual cards and their declared
Grasp costs even though this slice does not validate a Grasp cap. Red Citrine
has no equivalent outer requirement and may validly do nothing when every card
is already active.

| Trait key                | Label                     | Modeled result                                                                     |
| ------------------------ | ------------------------- | ---------------------------------------------------------------------------------- |
| `CirceShrinkTrait`       | Word of Smaller Stature   | equip                                                                              |
| `CirceEnlargeTrait`      | Word of Greater Girth     | equip                                                                              |
| `ArcanaRarityTrait`      | Lapis Lazuli Insight      | equip and promote up to two exact active Arcana cards                              |
| `HealAmplifyTrait`       | Old Herbal Remedy         | equip                                                                              |
| `DoubleFamiliarTrait`    | Primal Psychic Connection | equip under the progressed familiar assumption                                     |
| `RemoveShrineTrait`      | Black Night Banishment    | equip and disable one exact eligible Vow                                           |
| `RandomArcanaTrait`      | Red Citrine Divination    | equip and activate one exact inactive Arcana card, or valid no-op when none remain |
| `CirceSorceryDamageBoon` | Hymn to the Eye of Night  | equip when the existing Hex/Spell requirement is met                               |
| `ExPolymorphBoon`        | Turning to a Simple Form  | equip under the progressed save-progression baseline                               |

Numeric combat, healing, familiar, size, dodge, and Polymorph effects remain
collapsed. Their equipped identity is retained because the planner records
trait acquisition even when it does not simulate combat values.

## Ownership and product contract

### Hades II catalog

The catalog owns:

- the 5-by-5 Arcana board, labels, keys, attached trait keys, Grasp costs, and
  manual/automatic activation class;
- the six closed automatic-activation rules;
- the permanent-rank-III to Epic baseline and the supported Epic-to-Heroic
  run-local promotion;
- Judgment's post-boss count by run-local rarity;
- all Vow labels, rank maxima, incremental Fear values, and Circe-removable
  policy;
- all nine Circe declarations, fixed Common rarity, requirements,
  dispositions, and exact Arcana/Fear acquisition policy; and
- the binding from `Story_Circe_01` to the Circe provider.

Normalization rejects duplicate board cells, unknown Arcana/Fear/trait keys,
invalid ranks or Fear tables, automatic rules that reference invalid cells,
unsupported promotion rarities, and a Circe policy whose target domain is not
declared.

Use closed Arcana activation requirements rather than callbacks. The compiler
may normalize the six source forms into a small explicit vocabulary such as
adjacency, manual-card count/cost distribution, and complete row/column. It
must not embed an editor-facing option list.

### Authored project

Schema 21 adds:

- the route's manual Arcana card keys;
- one selected rank for every declared Vow; and
- one optional Boss-completion Arcana activation outcome per biome.

Circe's selected option may own one closed exact resolution:

```ts
type AuthoredCirceResolution =
  | { kind: 'activateArcana'; arcanaKeys: readonly string[] }
  | { kind: 'promoteArcana'; arcanaKeys: readonly string[] }
  | { kind: 'disableFear'; vowKey: string | null };
```

The illustrative union names the allowed semantics; implementation may place
the shared exact Arcana selection type separately. It must remain a closed
domain contract rather than a generic `effect`, arbitrary payload, or map of
trait keys to unknown values.

The existing `targetTraitKey` remains exclusively the exact target of a
single equipped-trait acquisition such as Bridal Glow or Icarus. Arcana cards
and Vows are not disguised as equipped-trait keys.

Only the selected Circe option's applicable resolution is required.
Unselected or temporarily inapplicable option detail may remain persisted and
dormant so changing the selected option does not destroy prior authorship.
Codec contact validates structural keys and bounded representation; progressive
evaluation validates contextual eligibility and exact cardinality.

The Boss-completion outcome belongs to a child semantic address beneath the
existing `completionRoom` address with role `boss`. It does not belong in
`RouteLoadout`, `RoomOccurrence`, generic biome fields, or UI-session state.
When Judgment is not active, retained detail is dormant. When Judgment becomes
active and a nonempty result is required, missing detail is incomplete rather
than silently randomized.

### Planner engine state

Introduce explicit Arcana and Fear state products beside trait history:

- Arcana state contains the resolved active cards, activation origin, current
  run-local rarity, and chronological activation/promotion evidence.
- Fear state contains configured ranks, configured total, the disabled set,
  effective ranks, and chronological suppression evidence.

Seed both products once from the route loadout. Fold Red Citrine, Lapis, Black
Night, and Judgment through the same progressive chronology that already
applies selected trait acquisitions and completion lifecycle events. Every
later decision sees the evolved products.

These products may be explicit members of reward branches because that is the
current progressive acquisition carrier. They must participate in branch
equivalence and public branch products. Do not hide them in module state,
attach them through a sidecar map, or combine unrelated reward/trait/history
inputs into a catch-all simulation context merely to shorten calls.

Selected simulation and candidate evaluation consume the same pre-effect
state. Candidate evaluation must not replay a second route walk or derive
Arcana/Fear state from rendered history.

### Requirements, candidates, and findings

The engine publishes typed exact-outcome candidate capabilities:

- inactive Arcana at a Circe or Judgment activation frontier;
- promotable active Arcana at Lapis's pre-acquisition frontier; and
- configured, positive-rank, effectively active, Circe-removable Vows at
  Black Night's frontier.

Lapis and Judgment assess a complete unordered selection as one atomic value.
They do not validate two or six independent scalar dropdowns that can disagree
about distinctness. The capability may expose per-card membership to support a
multi-select UI, but the engine assesses the final set and cardinality.

Findings distinguish:

- missing required exact outcome;
- unknown or duplicate target;
- target not in the pre-effect domain;
- wrong required cardinality; and
- unavailable outer Circe option.

Every finding uses the exact resolution/completion semantic owner. Do not
attach a Judgment finding to the preceding Preboss occurrence or a Circe
resolution finding to the generic Story-room card.

Progressive coverage stops at the first blocking Arcana/Fear owner under the
same first-blocking contract as reward and trait authoring. The owner itself
retains its repair candidates; later effects and route state remain
unassessed.

### Application and React

Route settings add:

- a five-by-five Arcana board showing manual controls and derived automatic
  activation; and
- a Fear list with one bounded rank control per Vow and a derived total.

Automatic cards are read-only derived indicators. React dispatches complete
semantic loadout commands and does not calculate automatic activation, Fear
totals, target eligibility, or post-boss counts.

The Circe trait dialog reuses the current contextual trait editor. Only the
selected special option shows its secondary control:

- one Arcana picker for Red Citrine;
- one unordered bounded multi-select for Lapis; and
- one Vow picker for Black Night.

The Boss completion workbench exposes a compact Judgment activation control
only when the structured workspace publishes it. Missing/invalid Judgment
outcomes navigate to that exact completion control.

Run State exposes Arcana and Fear as separate sections:

- active Arcana with Epic/Heroic rarity and activation origin;
- configured Fear total; and
- active and Circe-disabled Vows with selected ranks.

This is verification of progressive state, not a second editor. Route settings
remain the only place to edit the starting loadout.

## Delivery gates

### Gate A — Catalog and route loadout

1. Add normalized Arcana and Fear catalog collections and compiler validation.
2. Declare the complete Arcana board, automatic rules, and Vow rank/Fear data.
3. Bump the authored document to schema 21 and add the manual Arcana and Fear
   rank loadout fields with declaration-owned defaults.
4. Add atomic semantic commands for replacing the manual Arcana selection and
   one Vow rank without resetting weapon/aspect or downstream authored state.
5. Add route-settings Arcana and Fear controls backed by engine-owned derived
   loadout queries.
6. Prove codec strictness, undo/redo, profile round-trip, automatic activation,
   rank bounds, and derived Fear total.

Default commit:

```text
feat(planner): add Arcana and Fear route loadouts
```

### Gate B — Progressive Arcana and Fear state

1. Seed explicit Arcana and Fear states from the selected route loadout.
2. Add closed exact transitions for temporary Arcana activation, Arcana rarity
   promotion, and Vow suppression.
3. Carry the states through reward branches, branch equivalence, route seeds,
   incomplete progressive evaluation, and public evaluation products.
4. Publish Arcana/Fear Run State sections from the exact pre-decision state.
5. Prove manual, automatic, and temporary origins; Epic-to-Heroic promotion;
   disabled/effective Fear separation; cross-biome persistence; branch
   identity; and first-blocking suppression of later snapshots.

This gate establishes the state authority without adding Circe or Judgment
authoring. Tests may call the closed transitions directly; production must not
gain a shadow audit surface solely for those tests.

Default commit:

```text
feat(engine): establish progressive Arcana and Fear state
```

### Gate C — Judgment completion outcomes

1. Add the Boss-completion Arcana outcome, semantic address, codec, and command.
2. Publish a candidate capability from the exact pre-Judgment state at each
   reached Boss completion.
3. Apply the validated exact set immediately after Boss encounter completion
   and before Postboss/later-biome state.
4. Add the completion workbench control, interaction, finding navigation, and
   workspace closure ownership.
5. Prove the Epic count of five, Heroic count of six, inactive-set clamping,
   distinctness, repeated bosses, no redrawing prior activations, Red-activated
   Judgment, Lapis-promoted Judgment, missing/invalid repair coverage, and
   downstream Run State visibility.

Default commit:

```text
feat(engine): model Judgment post-boss Arcana draws
```

### Gate D — Complete Circe provider

1. Add all nine fixed-Common Circe declarations and bind
   `Story_Circe_01` to the provider.
2. Reuse ordinary equip behavior for the six direct choices and the existing
   Hex/Spell requirement authority for Hymn.
3. Add the selected-option resolution union, commands, codec rules, selected
   simulation, candidates, findings, and branch transitions for Red Citrine,
   Lapis, and Black Night.
4. Extend the trait dialog and structured workspace with the single,
   multi-select, and Vow target controls.
5. Prove three-distinct-option composition, fixed rarity, progressed familiar
   and save predicates, Red's empty-set no-op, Lapis cardinality and Heroic
   exclusion, Black Night's Rivals exclusion, dormant resolution restoration,
   progressive repair, persistence, undo/redo, and later Run State effects.

Default commit:

```text
feat(planner): model Circe trait choices
```

### Gate E — Closure and absorption

1. Run the complete repository gate.
2. Validate semantic-owner reachability for route loadout controls, Circe
   resolutions, and every reached Judgment completion outcome.
3. Search for duplicated automatic-Arcana, Fear-total, target-domain,
   Judgment-count, and Circe requirement policy outside their authorities.
4. Confirm one primary policy matrix per catalog/engine authority and retain
   only representative application/product witnesses.
5. Absorb stable authored, simulation, candidate, Run State, and editor
   contracts into the owning design/progress documents, update the trait audit
   disposition, and retire this plan.

Default commit:

```text
docs: close Arcana Fear and Circe delivery
```

## Audit-against matrix

| Contract                                        | Primary owner                    | Required witness                                                    |
| ----------------------------------------------- | -------------------------------- | ------------------------------------------------------------------- |
| 25-card board and six automatic rules           | catalog declarations/compiler    | complete declaration and activation matrix                          |
| rank-III baseline                               | catalog plus Arcana state seed   | every initial active card is Epic                                   |
| manual versus automatic versus temporary origin | Arcana state fold                | origin survives route progression and is visible in Run State       |
| Vow rank limits and Fear totals                 | catalog plus loadout query       | every rank boundary and cumulative total                            |
| Black Night suppression                         | Fear state fold                  | configured rank/total retained while effective rank becomes zero    |
| Lapis target set                                | Circe acquisition evaluator      | distinct `min(2, eligible)` set and no Heroic target                |
| Judgment timing                                 | completion lifecycle integration | state changes after Boss completion and before Postboss/later biome |
| Judgment count                                  | Arcana declaration/evaluator     | Epic five, Heroic six, clamped to inactive cards                    |
| progressive repair                              | candidate session                | blocking owner keeps exact repair domain without later state claims |
| persistence                                     | schema-21 codec/commands         | round-trip, dormant detail, undo/redo                               |
| UI ownership                                    | structured workspace             | one reachable control and interaction per exact semantic owner      |

## Scope exclusions

- permanent Arcana progression, unlocks, or ranks below III;
- Grasp capacity and Vow of Void's Grasp reduction;
- Fated mode and random weighting;
- arbitrary Arcana/Fear effect scripting;
- ordinary gameplay effects of Arcana cards or Vows;
- Circe combat-value calculations;
- familiar selection or familiar lifecycle;
- save/profile progression inputs;
- seeded random replay; and
- probability displays.

Any one of those needs its own source audit and focused follow-up. None is a
reason to weaken the exact Arcana/Fear state or target contracts in this slice.

## Completion definition

The delivery is complete when a user can configure manual Arcana and Fear
ranks, see truthful derived starting and progressive state, author every
reached Judgment draw, select any legal Circe offer and its exact secondary
outcome, repair invalid choices contextually, persist/undo those decisions, and
observe their effects at later decisions without React or a parallel simulator
recreating engine policy.
