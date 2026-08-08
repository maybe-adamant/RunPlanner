# Olympian Trait Replacement Implementation

## Status and Scope

This is the temporary delivery contract for the focused Olympian boon
replacement slice. It follows the completed trait-offer lifecycle and
first-Olympian composition work. The known clean base is `13b35a7`; if work
starts from a later revision, the executor must confirm that both first-offer
commits are present and the worktree is clean.

The slice models:

- ordinary offers containing zero or one replacement while the normal pool is
  sufficient;
- additional replacements only when fewer than three ordinary choices remain;
- exact rarity promotion;
- replacement of the currently equipped trait in the matching core slot; and
- engine-derived replacement presentation in the existing Trait Offer editor.

It should land as one complete vertical commit:

```text
feat(engine): support Olympian boon replacement
```

Use the repository's executor/reviewer workflow. The adversarial reviewer must
inspect the completed slice and its findings must be addressed before the work
is returned.

This progress document remains isolated while implementation is active. Once
the slice is accepted, absorb the durable contract into the owning audit and
design documents and retire this file.

## Required Reading

Read before implementation:

- `README.md` and `AGENTS.md`;
- `docs/audits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md`;
- `docs/design/REWARD_MODEL.md`;
- `docs/design/SIMULATION_AND_VALIDATION.md`;
- `docs/design/CANDIDATE_EVALUATION_MODEL.md`;
- `docs/design/EDITOR_MODEL.md`; and
- `docs/design/STRUCTURED_EDITOR_WORKSPACE.md`.

Inspect the current trait authority before designing new types:

- `packages/planner-engine/src/simulation/traits.ts`;
- `packages/planner-engine/src/simulation/candidates/trait-offer.ts`;
- `packages/planner-engine/src/authored-project/traits.ts`;
- `packages/planner-engine/src/authored-project/commands/trait-offer.ts`;
- `packages/planner-engine/src/authored-project/room-state/codec.ts`;
- `apps/planner/src/projections/traitProjection.ts`;
- `apps/planner/src/projections/structured-workspace/interactions/interaction-binding.ts`;
  and
- `apps/planner/src/ui/editor/rewards/TraitOfferEditor.tsx`.

## Source-Backed Game Contract

The installed game scripts provide the source authority:

```text
Content/Scripts/UpgradeChoiceLogic.lua
  GetUpgradedRarity:         730-737
  GetReplacementTraits:     795-822
  selection application:    940-956

Content/Scripts/TraitLogic.lua
  normal replacement seed:  1791-1813
  ordinary offer filling:   1816-1947
  shortage replacement fill: 1949-1961

Content/Scripts/HeroData.lua
  ReplaceChance = 0.1:       175-188

Content/Scripts/TraitData.lua
  RarityUpgradeOrder:        711-715
```

The semantic facts retained by the planner are:

1. Normal replacement candidates come only from the giver's
   `PriorityUpgrades`, represented by normalized `priorityTraitKeys`.
2. The proposed new trait must not already be equipped.
3. Its ordinary boon slot must be occupied by a different trait.
4. The occupying trait need not belong to the same god. A Zeus trait may
   replace an Apollo trait in the same slot.
5. The proposed trait must satisfy its ordinary eligibility requirements.
6. The occupant must have a next supported rarity.
7. Replacement rarity is fixed to the next rank: Common to Rare, Rare to Epic,
   and Epic to Heroic.
8. A Heroic occupant cannot be replaced through this mechanism.
9. Normal generation can seed at most one replacement.
10. After ordinary options are exhausted, the game attempts to fill remaining
    positions with additional replacement traits.
11. Selecting a replacement removes the old trait and equips the selected new
    trait.
12. Unselected replacement alternatives have no effect.

The planner models possibility rather than RNG. The following remain collapsed
or deferred:

- the 10 percent replacement roll;
- completed-run progression gates;
- `ForceSwaps` and `ForceCommon`;
- `onlyFromLootName`;
- replacement counters and statistics;
- level or stack transfer; and
- `ExchangeLevelBonus`.

## Authored-State Contract

Do not add replacement identity to persisted authored state. In particular, do
not add `isReplacement`, a replacement target, old rarity, slot identity,
probability, or a replacement count.

The authored shape remains:

```text
AuthoredTraitOffer
  giverKey
  options[3]
    traitKey
    rarity?
  selectedOptionKey
```

Replacement identity is derived from the exact pre-offer equipped state, the
giver's `priorityTraitKeys`, the proposed trait's ordinary boon slot, and the
authored proposed rarity.

No schema-version bump is expected because the persisted JSON shape does not
change. Command and codec structural validation must nevertheless correct its
current fresh-rarity boundary:

- a ranked option may structurally persist a rarity from the trait's supported
  `equippedRarities`;
- a Hammer still rejects every rarity;
- unknown or unsupported rarities still fail structurally; and
- contextual evaluation decides whether the value is a legal fresh rarity or
  the exact legal replacement rarity.

This preserves structurally valid but context-invalid authoring. It must not
make Heroic a fresh ordinary candidate or default.

## Engine Replacement Assessment

Add one explicit immutable engine product describing a derived replacement
transition. A suitable shape is:

```ts
interface TraitReplacementTransition {
  readonly slot: string;
  readonly replacedTraitKey: string;
  readonly oldRarity: TraitRarity;
  readonly newTraitKey: string;
  readonly requiredRarity: TraitRarity;
}
```

Naming may follow the established trait vocabulary, but the product must carry
the exact transition and must not rely on a sidecar map.

Each option assessment must distinguish:

- a legal ordinary option;
- a legal replacement option with its exact transition;
- an invalid occupied-slot option that cannot become a replacement; and
- a replacement-shaped option with the wrong authored rarity.

A valid replacement waives only the `occupiedBoonSlot` failure. It must not
waive:

- already equipped;
- positive or negative prerequisites;
- element thresholds;
- rarity-count requirements;
- offer-context restrictions, including Devotion's no-Duo rule; or
- any other existing trait requirement.

Semantic findings must let the editor distinguish at least:

- an occupied slot for which replacement is unavailable;
- an occupant already at maximum rarity;
- an authored rarity that does not equal the required promoted rarity; and
- an offer containing more replacements than the current ordinary pool permits.

React must not infer these states.

## Offer-Level Replacement Composition

Replacement count is an offer-level composition rule. It is separate from
individual option legality and from the first-Olympian composition rule. Do
not overload the current first-offer `composition.applies` flag with unrelated
meaning; prefer a sibling product such as `replacementComposition`.

For each exact pre-offer branch:

1. Enumerate the giver's distinct legal ordinary, non-replacement trait keys.
2. Count trait keys, not trait-and-rarity variants.
3. A trait counts as an ordinary candidate when at least one fresh rarity can
   legally be offered in the exact pre-offer state.
4. Heroic never contributes to this ordinary count.
5. Apply the existing prerequisites, occupied-slot policy, offer context, and
   already-equipped exclusion.

Let `ordinaryCandidateCount` be that count:

```ts
const maximumReplacementCount = ordinaryCandidateCount >= 2 ? 1 : 3 - ordinaryCandidateCount;
```

| Legal ordinary keys | Maximum replacements |
| ------------------: | -------------------: |
|           3 or more |                    1 |
|                   2 |                    1 |
|                   1 |                    2 |
|                   0 |                    3 |

This is an upper bound, not a requirement. Zero or one replacement remains
legal when the ordinary pool is rich. Two replacements require at most one
ordinary key, and three require none. Every authored replacement must still be
individually legal; shortage allowance does not manufacture candidates.

All three options remain alternatives evaluated against the same pre-offer
state. Never apply one option before assessing another.

Composition remains branch-local:

- calculate ordinary availability, replacement transitions, and the limit
  independently for each reached branch;
- a complete authored offer is supported only when every option and both
  composition rules succeed in at least one single branch;
- never combine option validity from different branches; and
- retain exact branch evidence for findings and presentation.

## Candidate Authority

Extend the existing engine trait-candidate authority rather than creating a
parallel implementation. Engine candidate products must be capable of
returning:

- fresh ordinary variants using only `freshOfferRarities`;
- exact replacement variants using the promoted rarity;
- replacement-transition evidence; and
- precise unavailability findings.

For an occupied core slot, do not expose Common, Rare, Epic, and Heroic as
arbitrary equivalent choices. Expose the exact promoted rarity when
replacement is legal. Heroic may appear only for an exact Epic-to-Heroic
replacement and never as a fresh candidate.

Keep ordinary-candidate enumeration and authored-offer assessment on shared
pure helpers so their policy cannot drift.

## Recording and Folding Selection

A valid reached offer may emit an event. An invalid offer continues to emit no
trait-acquisition event. The derived event should carry the selected
replacement transition when its selected option is a replacement. This is a
simulation product, not persisted authored state.

Fold events chronologically:

1. Inspect only the selected option.
2. Preserve current behavior for an ordinary selection.
3. For a replacement, remove the exact prior occupant from `equippedTraits`,
   add the selected new trait at its authored promoted rarity, retain the old
   acquisition event in chronological history, and attach the new trait to the
   current acquisition role.
4. Recompute every derived trait fact from the resulting equipped ledger.

After replacement, the removed trait must no longer contribute to:

- ordinary boon-slot occupancy;
- elements;
- rarity counts;
- `upgradableTraitCount`;
- positive or negative prerequisites; or
- rarifiable and superchargeable target queries.

The new trait contributes normally. The old and new trait must not coexist in
equipped state. Do not mutate an earlier event, and do not change state for an
unselected replacement alternative.

## First-Offer Interaction

The existing first-Olympian rule remains intact:

- with no occupied ordinary slots, replacement cannot apply;
- the first offer still requires three distinct priority traits;
- it still requires Attack or Special; and
- an invalid first offer does not fold and therefore does not consume
  first-offer status.

First-offer and replacement composition should be sibling assessments over the
same pre-offer history.

## Application and UI

Use the existing Trait Offer modal. Do not add a separate replacement editor or
replacement checkbox.

The editor should present a replacement as part of an option, for example:

```text
Wave Strike - Rare
Replaces Flutter Strike - Common to Rare
```

Required behavior:

- application projection adapts engine-derived replacement evidence;
- React never reconstructs the target, slot, or rarity promotion;
- selecting a legal replacement candidate selects or clearly offers its exact
  promoted rarity;
- Heroic appears only for an engine-exposed Epic-to-Heroic replacement;
- context-invalid persisted values remain visible and repairable;
- findings do not hide trait or rarity controls; and
- selected replacement evidence appears in the existing compact launcher or
  chronological Traits row where practical, without redesigning either
  surface.

The current `rarityChoicesFor` implementation uses only static
`freshOfferRarities` and cannot remain the replacement authority. Adapt an
engine-derived, address-bound candidate domain through the workspace
interaction. A context-unavailable fallback may expose structurally supported
rarities without claiming legality, but reached legality must come from the
engine.

Do not pass raw trait history into React or recreate slot and promotion rules in
application code.

## Delivery Gates

### Gate A - Structural and engine authority

Deliver:

- structural support for context-valid Heroic replacement values without fresh
  Heroic leakage;
- derived replacement transition assessment;
- sibling replacement composition assessment;
- exact ordinary-pool shortage calculation;
- branch-local candidate and validation support; and
- selected replacement folding with complete derived-fact recomputation.

Gate:

- replacement identity is never persisted;
- candidates and validation share one authority;
- exact rarity promotion and maximum-rarity rejection work;
- the selected old trait is removed and the new trait is equipped; and
- first-offer behavior remains unchanged.

### Gate B - Application contact and closure

Deliver:

- address-bound replacement candidates in the workspace interaction;
- replacement evidence in the existing editor and appropriate selected
  summary;
- exact semantic findings and navigation; and
- representative cross-layer product-loop coverage.

Gate:

- React contains no replacement policy;
- findings never conceal repair controls;
- Heroic is visible only for a valid replacement transition; and
- room and route presentations edit the same semantic owner.

### Gate C - Documentation and completion

Deliver:

- source facts absorbed into the trait audit;
- durable contracts absorbed into the owning design authorities;
- genuinely deferred probability, force-swap, and level behavior kept
  explicit; and
- retirement of this progress document after acceptance.

Gate:

- no stale statement still says the implemented replacement behavior is
  deferred;
- no unrelated document links to this temporary tracker; and
- the complete repository check passes.

## Required Tests

### Authored model and codec

Cover:

- Heroic round-trips for a ranked trait whose equipped domain includes Heroic;
- Heroic remains context-invalid as a normal fresh offer;
- unsupported rarities fail structurally;
- Hammer options still reject rarity;
- no replacement target or flag appears in persisted state;
- commands preserve a structurally valid but context-invalid replacement; and
- defaults remain fresh and never default to Heroic.

### Engine option assessment

Cover:

- Common-to-Rare, Rare-to-Epic, and Epic-to-Heroic replacement;
- a Heroic occupant cannot be replaced;
- cross-god replacement in the same slot;
- the new trait must belong to the giver's `priorityTraitKeys`;
- an already-equipped new trait remains invalid;
- a correct replacement waives only occupied-slot failure;
- other failed prerequisites remain failed;
- wrong authored rarity receives an exact finding; and
- Hermes and Hammer cannot produce ordinary boon replacements.

### Replacement composition

Use focused engine fixtures rather than changing production declarations.
Cover:

- rich ordinary pool: zero and one replacement valid, two invalid;
- exactly one ordinary key: two replacements valid and three invalid;
- zero ordinary keys: three replacements valid;
- ordinary availability counts distinct trait keys rather than rarity variants;
  and
- the replacement limit uses the exact pre-offer branch.

Do not mutate completed simulation traces to invent a natural divergent branch.
If the live simulator cannot naturally retain divergent trait histories at one
owner, test the pure engine grouping or composition boundary with constructed
engine products.

### History and lifecycle

Cover:

- selected replacement removes the old trait and adds the new trait;
- selecting an ordinary alternative leaves a potential target untouched;
- unselected replacement alternatives have no effect;
- invalid replacement offers do not fold;
- later offers observe the new trait and no longer observe the old trait;
- elements, rarity counts, ordinary slots, and `upgradableTraitCount` are
  recomputed;
- positive and negative prerequisites observe the replaced state;
- Devotion chosen/spurned timing remains chronological;
- Shop purchase order applies replacement only to purchased offers; and
- unpurchased and dormant offers have no effect.

### Candidate and application

Cover:

- ordinary candidates never expose Heroic;
- an Epic occupant exposes exactly the Heroic replacement variant;
- replacement evidence reaches the application candidate projection;
- the modal displays the replaced trait and rarity transition;
- the modal does not independently infer that transition;
- room and route launchers edit the same semantic owner;
- findings resolve to the exact Trait Offer owner; and
- one representative product-loop replacement succeeds.

Keep exhaustive policy tests in the engine. Application and product-loop tests
retain representative contact witnesses only.

## Non-Goals and Guardrails

Do not:

- add probability or RNG;
- add a persisted replacement marker, target link, or counter;
- add trait levels or stacks;
- implement Boon Decay mutation;
- implement NPC, Story, Chaos, Hex, or Talent traits;
- implement sale or removal outside selected replacement;
- widen Heroic into ordinary fresh offers;
- create a generic context or service container;
- duplicate eligibility in application code;
- add a production audit or shadow ledger for testing; or
- redesign the Trait Offer modal or route panel.

Keep the work a focused vertical correction through the existing trait
lifecycle.

## Verification and Adversarial Review

Run narrow owning tests during implementation. Before returning the slice, run:

```bash
npm run test:engine
npm run test:planner
npm run test:ui
npm run test:product
npm run check
```

The adversarial reviewer must explicitly check:

- replacement identity is derived rather than persisted;
- Heroic cannot leak into fresh candidates;
- promotion is exact;
- cross-god replacement works;
- only priority traits can replace;
- replacement waives only slot occupancy;
- shortage counts distinct ordinary trait keys;
- the maximum-replacement formula is correct;
- the selected old trait is actually removed;
- all derived facts lose the old trait's contribution;
- branch support does not mix evidence across branches;
- first-offer behavior is unchanged;
- React contains no replacement policy; and
- test helpers do not reproduce production rules.

Address reviewer findings, rerun `npm run check`, and commit only the complete
vertical slice.
