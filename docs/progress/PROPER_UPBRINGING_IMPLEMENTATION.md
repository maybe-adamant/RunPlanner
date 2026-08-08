# Proper Upbringing Implementation

## Status and Purpose

This is the temporary implementation contract for Proper Upbringing
(`ElementalRarityUpgradeBoon`). It follows the completed Olympian replacement
slice and uses that slice's exact equipped-rarity ledger as its foundation.

The feature is small in visible UI but crosses four semantic concerns:

1. a catalog-declared activation threshold;
2. a one-way mutation of already equipped trait rarities;
3. an active floor on later fresh offer rarities; and
4. chronological replay when elements change through later acquisitions or
   replacements.

The implementation must remain a focused rarity-lifecycle correction. It must
not introduce a generic trait-effect interpreter, persist derived effect
state, or add a Proper Upbringing-specific React path.

This document remains isolated while delivery is active. After acceptance,
absorb its durable model and editor contracts into the owning design documents
and retire it.

## Required Reading

Read before implementation:

- `README.md` and `AGENTS.md`;
- `docs/audits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md`;
- `docs/design/REWARD_MODEL.md`;
- `docs/design/SIMULATION_AND_VALIDATION.md`;
- `docs/design/CANDIDATE_EVALUATION_MODEL.md`; and
- `docs/design/STRUCTURED_EDITOR_WORKSPACE.md`.

Inspect the live authorities:

- `packages/hades2-catalog/src/declarations/traits/hera.ts`;
- `packages/hades2-catalog/src/compiler/traits.ts`;
- `packages/planner-engine/src/catalog-schema/traits.ts`;
- `packages/planner-engine/src/simulation/traits.ts`;
- `packages/planner-engine/src/simulation/candidates/trait-offer.ts`;
- `apps/planner/src/projections/contextualOptions.ts`;
- `apps/planner/src/projections/evaluationProjection.ts`; and
- the existing trait-offer editor and route Traits projection.

Game-source authority is recorded in the trait audit. The critical paths are
`TraitData_Elementals.lua`, `TraitLogic.lua`, `RoomLogic.lua`, and
`UpgradeChoiceLogic.lua`.

## Locked Source Facts

Proper Upbringing is offered when every base element is at least one. Its
effect activates only when every base element is at least two.

On an inactive-to-active transition, the game:

- upgrades each unique equipped Common god trait to Rare when that trait does
  not declare `BlockInRunRarify`;
- leaves Rare, Epic, Heroic, Legendary, Duo, and unrarified traits unchanged;
- installs a Rare floor for later god-loot offers; and
- keeps higher legal offer rarities possible.

On deactivation, the game removes only the future-offer floor. Earlier Common
to Rare promotions remain. Reactivation performs another upgrade pass.

The planner retains one explicit simplification: it does not rewrite Proper
Upbringing's own effective rarity to Rare on activation. Its authored rarity
remains truthful evidence of one possible offered option, while the source
self-assignment belongs to rarity-generation tabulation and presentation. The
planner models offer possibilities rather than rarity probabilities, the
effect does not scale with its own rarity, and Proper Upbringing is excluded
from rarity counts and both in-run rarification queries. Mutating it would
therefore change no modeled eligibility result. The planner must still promote
every other eligible equipped trait exactly.

## Scope

In scope:

- a normalized declaration-owned rarity-floor effect on Proper Upbringing;
- exact two-of-each activation derived from equipped element counts;
- chronological Common-to-Rare promotion on activation and reactivation;
- a derived active Rare floor in `TraitHistoryState`;
- rejection of a scalable fresh Common option while that floor applies;
- candidate and finding presentation through existing trait-offer controls;
- interaction with replacements and all current derived trait facts; and
- focused engine, catalog, application, and product-loop witnesses.

Out of scope:

- a general effect callback, effect registry, or string-key dispatch table;
- persisted activation flags, rarity floors, or rarity-mutation commands;
- sale/removal authoring and arbitrary trait deletion;
- trait levels, stacks, or preservation of their runtime values;
- RNG and exact rarity probabilities above the floor;
- temporary bonuses from keepsakes, Chaos, Arcana, or room overrides;
- sources that ignore temporary/all rarity bonuses;
- double-boon and already-generated-choice repair;
- Proper Upbringing's probability/presentation-only self-rarity reassignment;
  and
- a new panel, modal, checkbox, or manual activation control.

No authored-project schema version changes in this slice.

## Catalog Contract

Add one narrow optional normalized product to `TraitDeclaration`. A suitable
shape is:

```ts
interface ScalableGodTraitRarityFloorEffect {
  readonly activationElementMinimums: Readonly<Partial<Record<TraitElement, number>>>;
  readonly fromRarity: 'Common';
  readonly minimumRarity: 'Rare';
}
```

The final name may follow the local catalog vocabulary, but the product must
remain this narrow. Do not create `effects: unknown[]`, callable declarations,
or a broad event/action language.

Proper Upbringing declares:

```text
activationElementMinimums = {
  Fire: 2,
  Earth: 2,
  Air: 2,
  Water: 2,
}
fromRarity = Common
minimumRarity = Rare
```

The compiler must validate and freeze the product. At minimum it rejects:

- an empty activation map;
- unknown elements;
- non-positive or non-integer minimums;
- a source rarity absent from the global in-run rarity order;
- a floor that does not follow the source rarity; and
- the effect on an unrarified Hammer declaration.

Do not infer the effect from the trait key, label, element offer requirements,
or the existing `blockInRunRarify` flag. Those facts have different meanings.

## Progressive Engine Contract

### One authored chronology, one effective ledger

`TraitOfferEvent` continues to record the authored selected option and rarity.
It does not receive a persisted or authored mutation list. Replaying the event
sequence must deterministically reconstruct the effective equipped ledger.

For each event in chronological order:

1. apply the selected acquisition or exact replacement using existing rules;
2. derive the post-acquisition equipped facts, including elements;
3. evaluate every equipped declaration that owns the rarity-floor effect;
4. detect inactive-to-active and active-to-inactive transitions from the
   immediately prior replay state;
5. on activation, promote every eligible equipped Common trait to Rare;
6. recompute all derived facts from the promoted ledger; and
7. publish whether the floor is active for the next offer.

The internal replay may keep a private set of active effect-source keys. That
set must not enter authored state or become a sidecar authority. The complete
returned `TraitHistoryState` remains the only product consumed by later
evaluation.

### Promotion target

An equipped trait is promoted only when all are true:

- its declaration is a persistent god trait;
- it is not the effect source itself;
- it does not declare `blockInRunRarify`;
- its effective current rarity is Common; and
- the activating effect declares Common to Rare.

Promotion creates a replacement immutable `EquippedTrait` value while
preserving trait key, giver, provider kind, and acquisition role. It does not
edit the earlier `TraitOfferEvent`.

Promotions are idempotent. Replaying the same event list yields the same
ledger, and remaining active across an event is not a second activation.

### Derived floor

Expose the current floor as an explicit immutable derived fact on
`TraitHistoryState`, for example:

```ts
readonly minimumScalableGodTraitRarity?: 'Rare';
```

Absence means no active modeled floor. It is derived from the current equipped
ledger and activation thresholds, never written independently.

The future room-state inspection surface may read this fact directly. It must
not need to rediscover Proper Upbringing or recount elements in the
application.

## Offer and Candidate Contract

While the floor is active, a fresh Common option for a persistent god trait is
context-invalid only when that declaration also supports Rare as a fresh
rarity. Rare and Epic remain valid when the declaration otherwise allows them.
Fixed-Common infusion traits, fixed Legendary and Duo domains, and Hammer's
no-rarity domain are unchanged. This mirrors the source rarity tables: a
guaranteed Rare roll cannot select Rare for a trait that has no Rare level.

Add a distinct finding such as `rarityBelowActiveFloor`. Do not reuse
`freshRarityUnavailable`:

- `freshRarityUnavailable` means the rarity is outside the declaration's
  fresh domain, such as ungrounded Heroic; while
- the new finding means the rarity is normally fresh but blocked by the exact
  reached history.

Replacement remains authoritative:

- an upgraded Rare slot occupant requires an Epic replacement;
- an Epic occupant still requires Heroic;
- a Heroic occupant still cannot be replaced;
- the floor does not manufacture replacement eligibility; and
- replacement shortage counting uses the same floor-aware ordinary candidate
  assessments.

The existing candidate session and trait editor consume the finding. React
must not inspect `ElementalRarityUpgradeBoon`, count elements, promote
rarities, or filter Common through local policy. A persisted Common selection
must remain visible and repairable after an upstream edit activates the floor.

No new Proper Upbringing control is required. The selected acquisition remains
the ordinary trait choice that caused the effect.

## Derived-Fact Closure

After every activation promotion, recompute rather than patch:

- `equippedTraits`;
- `ordinaryBoonSlots`;
- `elementCounts` and `highestBaseElementCount`;
- `godBoonRarityCounts`;
- `upgradableTraitCount`;
- rarifiable and superchargeable predicates; and
- later positive/negative trait prerequisites.

The recomputed rarity counts must drive `CommonGlobalDamageBoon`. Do not assume
the Common count always becomes zero: a Common persistent god trait that is
excluded from this activation by `blockInRunRarify` may still remain relevant
if it is not separately excluded from rarity counts.

Every simulation branch owns its own replay and effect state. Never combine
an active floor from one reward-bag branch with the equipped ledger of another.
Invalid, dormant, unpicked, unpurchased, or otherwise unreached trait offers
must neither activate the effect nor promote anything.

## Delivery Gates

### Gate A — normalized declaration

Deliver:

- the narrow normalized rarity-floor effect type;
- the Proper Upbringing declaration;
- compiler validation and immutability checks; and
- source-closure regression tests.

Gate:

- no engine key dispatch exists;
- malformed effects fail at catalog construction; and
- ordinary traits without the optional effect normalize unchanged.

Suggested commit:

```text
feat(catalog): declare Proper Upbringing rarity floor
```

### Gate B — progressive rarity lifecycle

Deliver:

- activation/deactivation/reactivation replay;
- immutable Common-to-Rare promotion;
- the derived active floor;
- floor-aware assessment and replacement composition;
- semantic finding projection and player copy; and
- representative cross-layer interaction coverage.

Gate:

- the complete repository check passes;
- no authored schema or React policy is added; and
- all audit-against scenarios below pass from natural engine histories.

Suggested commit:

```text
feat(engine): simulate Proper Upbringing rarity lifecycle
```

Gate A is an owning catalog product with direct validation and tests, not a
forwarding interface. Gate B must consume that exact normalized product and
must not introduce a parallel Proper Upbringing table.

## Required Audit-Against Matrix

The primary engine suite must cover:

1. Proper Upbringing is offerable at one of each element but inactive there.
2. Acquiring it while already at two of each activates immediately.
3. A later acquisition supplies the final element and activates the equipped
   effect.
4. Activation upgrades multiple eligible Common Olympian traits.
5. Activation upgrades an eligible Common Hermes trait.
6. Rare, Epic, Heroic, fixed-Common, Legendary, Duo, Hammer, and
   `blockInRunRarify` traits are not bulk-promoted.
7. An inactive-to-active transition runs once; remaining active is idempotent.
8. Deactivation removes the floor without downgrading promoted traits.
9. Reactivation upgrades an eligible Common trait acquired while inactive.
10. An active floor rejects fresh Common and accepts otherwise-legal Rare and
    Epic options.
11. Fixed Common/Legendary/Duo and Hammer offers remain unaffected.
12. An upstream change that activates the floor leaves an authored stale
    Common option present but invalid with the new finding.
13. A Common core occupant promoted to Rare subsequently requires an Epic
    replacement.
14. Replacement that changes element totals can activate or deactivate the
    effect at the correct post-selection boundary.
15. `godBoonRarityCounts`, ordinary slots, elements, and upgradeability are
    recomputed from promoted equipped values.
16. Invalid and unselected offers create no promotions or floor.
17. Two independently folded event histories can carry different
    activation/floor states without shared mutable state. Do not require a
    fabricated natural simulation divergence that the current authored trait
    chronology cannot produce.
18. Replay of the same event sequence is deterministic and immutable.

Catalog tests own the complete malformed-declaration matrix. Engine tests own
the complete lifecycle matrix. Application and product-loop tests retain only
representative witnesses for finding copy, repairable stale Common authorship,
and a valid downstream Rare/Epic choice; they must not reproduce activation
policy.

## Completion Criteria

The slice is complete when:

- Proper Upbringing's activation facts are catalog-owned;
- chronological replay produces the correct effective equipped rarities;
- future offer assessment consumes one explicit active floor;
- replacements and all derived trait facts observe promoted rarities;
- context-invalid Common authorship remains repairable;
- no authored migration, UI-specific effect logic, or generic effect framework
  was introduced; and
- `npm run check` passes on the final tree.
