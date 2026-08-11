# Trait Levels and Pom Acquisition Plan

## Status

**Lock candidate.** This is a focused prerequisite for Narcissus and Echo. It
corrects already-supported Pom rewards and the existing Bridal Glow and
Olympian-replacement lifecycles; it does not implement either deferred Story
provider.

The source facts are owned by
`docs/audits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md`. Stable authored,
simulation, reward, and candidate contracts remain owned by the corresponding
documents under `docs/design/` after this delivery is accepted.

## Goal

Add one chronological equipped-trait level axis and use it to model:

1. visible Pom choices from `StackUpgrade`, `StackUpgradeBig`, and
   `StackUpgradeTriple`;
2. the exact random target of `StoreRewardRandomStack`;
3. level preservation through an Olympian replacement;
4. Bridal Glow's rarity-scaled level grant;
5. Bridal Glow's Hephaestus rarity/level cooldown restriction; and
6. Bridal Glow's later `CreditMissingStacks` adjustment when its own rarity is
   promoted.

The implementation should reuse the existing authored reward leaves,
chronological trait fold, exact semantic addresses, project-bound candidate
session, progressive blocking, contextual picker, findings routing, and run
state projection. This is not a new simulator or a generic trait-effect
language.

## Current Live Shape

The relevant seams already exist:

- `EquippedTrait` retains exact trait, provider, rarity or Hammer rank, and
  acquisition role;
- `TraitOfferEvent.sequence` gives selected trait acquisitions a chronological
  position;
- `foldTraitOfferEvents` reconstructs equipped state and all derived trait
  facts;
- targeted acquisitions already retain one exact authored target and derive a
  closed transition;
- reward acquisition roles already place loot/use and trait effects at their
  declaration-owned lifecycle point;
- Shop purchase order already controls acquisition chronology;
- selected assessments and opaque candidate capabilities already preserve
  branch-local pre-acquisition trait history;
- the application already binds exact trait interactions to a modal contextual
  editor; and
- run state already presents the equipped-trait ledger before each decision.

The missing products are level-bearing equipped state, a closed level-mutation
event, a Pom-authored child, and its exact candidate/application projection.

## Locked Modeling Decisions

### 1. Level is folded equipped state

An eligible freshly equipped trait starts at level `1`. Level is retained on
the equipped trait and changed only by chronological semantic events. It is not
persisted as a mutable final-ledger snapshot and is not reconstructed from the
number of Pom loot-history entries.

Fresh acquisitions outside the modeled Pom domain omit the level field. Normal
replacement is the one source-backed exception: when a level-bearing occupied
slot is replaced by a non-Pom-eligible trait, the replacement retains that
inherited level even though it cannot be targeted by later Poms. Hammer Rank
I/II remains independent and must not be encoded as a trait level.

### 2. One Pom-eligibility authority

The engine owns one query for the supported Pom target domain:

```text
core-god trait && !blockStacking
```

This is the existing normalized collapse used by `upgradableTraitCount` and
matches the supported source closure. Candidate enumeration, selected-target
validation, initial level assignment, and the derived count must call that same
authority. Do not add a second hand-maintained giver list, persisted counter,
or React-side predicate.

The game's final numeric “does another stack change a tooltip value?” check is
collapsed because the normalized catalog does not model every combat-value
curve. That collapse is explicit source disposition, not a reason to introduce
generic numeric trait simulation.

### 3. Visible and random Poms have different authored shapes

A visible Pom authors the actual bounded choice surface:

```ts
{
  kind: 'choice';
  offeredTraitKeys: readonly string[]; // one to three when semantically complete
  selectedTraitKey: string | null;
}
```

The required number of distinct offered keys is:

```text
min(3, eligible target count)
```

The selected key must be one of those offered keys. The acquisition declaration
supplies the level count: `+1`, `+2`, or `+3`.

`StoreRewardRandomStack` authors only its exact random outcome:

```ts
{
  kind: 'random';
  targetTraitKey: string | null;
}
```

It applies `+1` and has no fabricated three-choice surface.

An active default contains the declaration-owned kind but no invented trait
target: an empty choice or `null` random target remains truthfully incomplete
and exposes its control and finding. The level count remains catalog-derived
and is not duplicated in authored state. This deliberately avoids another
arbitrary reward default that can hide the valid authoring surface.

### 4. Pom state belongs to the acquisition role

Each Pom-bearing `AuthoredRewardState` stores one optional sparse
level-resolution record keyed by concrete acquisition role, parallel to but
distinct from `traitOffersByAcquisitionRole`. The property is absent from
non-Pom rewards rather than adding an empty object to every reward in the
project. The child is addressed by a new exact semantic address containing the
existing reward owner and acquisition role.

The catalog declares the closed acquisition effect. Simulation and React must
not switch on `StackUpgrade` game names. The normalized acquisition effect is
either:

- bounded visible choice with a declared level count; or
- exact random target with a declared level count.

Reward replacement, room replacement, Shop inventory, wheels, Fields cages,
Hub rewards, side rooms, Anomaly handoff, and defaults must create or remove
the child from the resolved acquisition declaration in the same transition
that changes the parent reward.

### 5. Invalid Pom state remains authored and repairable

Structural commands validate address contact, effect kind, known trait keys,
distinctness, and the selected-key relation. Simulation validates the exact
pre-acquisition target domain and required visible-offer cardinality.

An upstream edit may make a retained target stale. The authored value remains
pinned, receives an exact finding, and does not apply a level mutation. It is
never silently retargeted or cleared.

Unpicked rooms, unentered Hub children, dormant reward-wheel results, and
unpurchased Shop offers retain their authored children but publish no reached
finding, level event, or interaction requirement beyond their existing dormant
ownership policy.

### 6. Acquisition timing remains declaration-owned

At a reached acquisition role:

1. apply its existing exact loot/use history projection;
2. evaluate its Pom resolution against the immutable pre-effect equipped
   history;
3. retain an invalid reached assessment without mutating equipped state; or
4. append the valid level mutation and continue with the updated trait ledger.

Shop Poms fold in authored purchase order. All later reward, trait, element,
rarity, and candidate checks observe the new level at the same chronological
point. The level event does not consume or rewrite a reward bag beyond the
already-modeled parent acquisition.

### 7. Replacement preserves level

Normal Olympian replacement derives the new trait's level from the displaced
trait. Under the supported neutral baseline, `ExchangeLevelBonus` is zero, so
the selected replacement preserves the exact old level. The replacement
transition remains derived and does not gain an authored transfer field.

The old trait is removed, the new trait is equipped at the existing promoted
rarity and transferred level, and all derived facts are recomputed. Transfer is
not conditioned on the new trait's Pom eligibility: for example, a
level-bearing Mana boon replaced by `HephaestusManaBoon` keeps its level while
remaining unavailable to later Poms. A future modeled source for
`ExchangeLevelBonus` would extend the derived transition; this plan does not
introduce that route input.

### 8. Bridal Glow is one closed targeted lifecycle

Extend Bridal Glow's existing targeted transition rather than adding a sibling
mutation path. Its selected source rarity grants the retained target:

| Bridal Glow rarity | Added levels |
| ------------------ | -----------: |
| Common             |            1 |
| Rare               |            2 |
| Epic               |            3 |
| Heroic             |            4 |

The same transition promotes the target to Heroic and records old/new rarity
and old/new level. The source trait remains equipped and retains its target
relation for later lifecycle replay.

The generic target tests remain next-rarity support, non-`BlockStacking`, and
the existing core-god declaration authority. The three Hephaestus targets also
consume their catalog-declared maximum eligible level by current rarity:

| Target                                       | Common | Rare | Epic |
| -------------------------------------------- | -----: | ---: | ---: |
| Hephaestus Attack — `HephaestusWeaponBoon`   |      9 |    7 |    5 |
| Hephaestus Special — `HephaestusSpecialBoon` |     11 |    9 |    7 |
| Hephaestus Sprint — `HephaestusSprintBoon`   |      8 |    7 |    6 |

Heroic targets fail the generic next-rarity rule. The table is a narrow target
eligibility fact; do not add general combat cooldown state to the planner.

Whenever Proper Upbringing promotes an equipped Common Bridal Glow to Rare,
including during the same acquisition that activates the floor, the replayed
rarity transition adds exactly one missing level to its retained target when
that target is still equipped. If the target has been removed or replaced, no
adjustment applies. This closes the currently documented `CreditMissingStacks`
behavior without introducing callbacks or mutable links.

## Persisted Contract

The authored Pom child changes the project schema. The delivery must:

- bump schema `18` to `19`;
- encode and strictly decode the closed choice/random union;
- include the new exact address and semantic command union;
- preserve immutable values through undo/redo, save/load, recovery, and project
  replacement;
- reject stale schemas according to the existing no-migration policy; and
- update fixtures mechanically without adding a compatibility reader.

The equipped level, chronological mutation, replacement transfer, effective
Hephaestus eligibility, and Bridal Glow missing-stack adjustment are derived
simulation products and do not enter persisted authored JSON.

## Candidate and Progressive Contract

The engine publishes, at the exact Pom address:

- a data-only selected assessment for the currently authored resolution; and
- an opaque branch-local capability that enumerates/evaluates eligible target
  values against the exact pre-acquisition `TraitHistoryState`.

For visible Poms, complete-draft evaluation checks every offered position,
distinctness, required count, and selected membership. A focused target query
may assess one position while retaining the other authored siblings, matching
the current trait-offer editor language.

For random Poms, the target-domain query evaluates the single exact outcome.
It must not invent visible siblings.

Branch evidence remains grouped. A target is supported only when one retained
branch supports the complete proposed resolution; the application must not
union targets from incompatible histories or infer eligibility from run-state
display data.

The first blocking Pom leaf retains its selected assessment and candidate
capability through the existing progressive frontier. Missing, stale,
wrong-count, or unselected targets block at that exact semantic owner. Duplicate
choice keys are structurally malformed and are rejected by commands and the
codec; simulation may assess a directly constructed duplicate defensively, but
it is not a persistable authored state. A valid resolution advances the same
validated prefix used by run state and later trait candidates.

## Application and UI Contract

The structured workspace publishes one Pom control beside its owning reward:

- visible Poms open one compact modal showing the required one-to-three offered
  target rows and which target was selected;
- random Poms open a single-target contextual picker labeled as the recorded
  random outcome;
- every picker uses engine candidate products and player-facing trait labels;
- invalid authored values remain visible and editable;
- findings occupy the dialog's stable feedback region; and
- keyboard focus returns to the launcher after close.

Suggested launch labels are:

```text
Edit Pom: Nova Strike +1
Edit Random Pom: Nova Strike +1
```

Use existing dialog and contextual-picker primitives. Do not add a second
global Traits workflow or encode Pom policy in React.

Run state renders a level suffix only when the equipped trait carries one:

```text
Attack: Nova Strike · Rare · Lv. 3
```

The route trait index may reuse that formatted equipped value, but no UI-only
level cache or counter is allowed.

## Delivery Gates

### Gate A — Level ledger and existing lifecycle corrections

Deliver:

- the shared Pom-eligibility query;
- level `1` on newly equipped eligible traits;
- a closed chronological level-mutation event and fold;
- replacement level preservation;
- Bridal Glow rarity-scaled level mutation;
- the three Hephaestus target-limit declarations and candidate enforcement;
- Proper Upbringing/Bridal Glow `CreditMissingStacks` replay.

Primary witnesses:

- ordinary Pom-eligible acquisition starts at level 1 while fresh Hermes, NPC,
  Hammer, and non-Pom-eligible core traits omit level;
- a replacement preserves levels and recomputes the ledger, including transfer
  into a non-Pom-eligible priority trait without making it Pom-eligible;
- Bridal Glow applies Heroic plus the correct level count for each source
  rarity;
- every Hephaestus boundary passes at its maximum level and fails one level
  above it;
- Heroic targets remain unavailable;
- a later Common-to-Rare Bridal Glow promotion adds one missing level only
  while its target remains equipped; and
- existing rarity, element, slot, first-offer, replacement, and targeted-Hammer
  behavior remains unchanged.

Expected commit: one engine/catalog vertical slice.

### Gate B — Authored Pom products and simulation

Deliver:

- declaration-owned level effects for the four Pom acquisitions;
- the schema-19 authored union, exact address, codec, defaults, and commands;
- reward-role materialization across every existing reward owner;
- selected assessments, findings, and chronological mutations;
- Shop purchase-order and dormant-owner behavior; and
- branch-local candidate artifacts plus progressive blocking.

Primary witnesses:

- visible Pom choice counts are exactly `min(3, eligibleCount)`;
- offered keys are distinct, eligible, and contain the selected key;
- Big and Triple Poms add two and three levels respectively;
- random Pom records one eligible exact target and never exposes three options;
- no-target, missing, stale, and wrong-cardinality values remain authored but
  block without mutating levels, while duplicate choice keys are rejected at
  the structural command/codec boundary;
- an upstream acquisition can make a later Pom valid, while an upstream
  replacement can make a retained target stale;
- purchased Shop Poms fold in purchase order and unpurchased Poms do not; and
- schema-18 documents are rejected without migration.

Expected commit: one authored/simulation vertical slice.

### Gate C — Workspace, contextual authoring, and closure

Deliver:

- exact workspace markers, interactions, inspector destinations, and finding
  routing for every active Pom owner;
- the visible-choice and random-target modal surfaces;
- progressive contextual target options;
- run-state level projection;
- player-facing labels and stable feedback layout;
- undo/redo, save/load, focus restoration, and editor-session reconciliation;
  and
- representative product-loop coverage for a room Pom and a purchased random
  Shop Pom.

Primary witnesses:

- incomplete defaults expose usable controls instead of hiding the parent
  reward;
- editing and saving a Pom immediately updates downstream progressive options
  and run state;
- a stale target remains shown with its exact finding;
- dormant and unpurchased children do not leak controls or findings;
- every active authored Pom leaf has one reachable containing inspector and
  exact interaction; and
- React performs no independent level, eligibility, cardinality, or timing
  calculation.

Expected commit: one application/UI vertical slice.

## Required Audits Against the Final Diff

Before closing the plan, verify all of the following:

- no production switch on Pom game names outside catalog construction;
- one shared Pom-target predicate drives count, candidates, validation, and
  folding;
- no persisted final level ledger, effective cooldown, replacement transfer,
  or Bridal Glow callback state;
- no arbitrary valid-looking Pom target default;
- no second trait simulation or application-side reconstruction;
- no test helper reproduces target eligibility or offer cardinality;
- no generic combat-stat or arbitrary trait-effect language was introduced;
- no Narcissus, Echo, Arcana, reroll, probability, tooltip-value, or
  `ExchangeLevelBonus` feature scope entered this delivery;
- the exact loot/use histories remain unchanged and additive to levels; and
- superseded “levels/Bridal Glow cooldown deferred” statements are removed
  from the owning design documents when the implementation lands.

## Validation

Use the narrowest truthful lanes while implementing:

- Gate A: focused trait-fold/candidate tests, then `npm run test:engine` and
  `npm run test:catalog`;
- Gate B: focused authored codec/command/simulation/progressive tests, then
  `npm run test:engine`;
- Gate C: focused projection/interaction/UI tests, then
  `npm run test:planner`, `npm run test:contract`, and
  `npm run test:product` as applicable.

Because Gate B changes the shared project schema and Gate C closes a
cross-layer product loop, finish the delivery with:

```bash
npm run check
```

## Completion Condition

The plan is complete when every reached Pom acquisition has one exact authored
and progressively evaluable level-resolution owner; valid resolutions mutate
the chronological equipped ledger at their real acquisition point; replacement
and Bridal Glow preserve the now-observable level semantics; run state renders
the result; stale/incomplete values remain repairable; and Narcissus can later
reuse the random-Pom capability without reopening the level model.
