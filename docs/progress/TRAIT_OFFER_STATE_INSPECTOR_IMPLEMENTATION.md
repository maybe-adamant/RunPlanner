# Trait Offer State Inspector Implementation

## Status

Locked for implementation from base `66bfb0c0`.

This temporary plan is grounded in the current offer-local rarity ledger,
replacement-composition authority, trait-offer candidate capability, application
interaction projection, and React trait dialog. It is not a README authority and
must be deleted at closure.

## Objective

Add a read-only **Offer State** inspector inside reached Olympian and Hermes
trait-offer dialogs. It exposes the exact generation state already used to judge
the authored screen:

- ordered Rare, Epic, Duo, and Legendary roll-check values;
- effective ordinary replacement-roll chance;
- the number of eligible replacement traits;
- the replacement count permitted and required for the current frozen screen;
  and
- whether required replacements come from the forced roll or ordinary-trait
  shortage.

The values must update with the dialog's live draft and remain correlated by
progressive history branch.

## Source facts and presentation decisions

- Rarity checks are ordered game checks. Displaying `30%` formats the exact
  numeric value `0.30`; it is not a normalized final outcome probability.
- Common is the fallback after supported ordered checks fail. Heroic is not a
  fresh-roll check. Neither receives a fabricated numeric row.
- The base replacement roll is `0.10`. Active Ordinary resolves it to `0`.
  Pending Sacrificial Hymn resolves it to `1` before Ordinary is considered.
- A positive replacement roll permits at most one ordinary random replacement.
  A forced roll requires one only when an eligible replacement exists.
- Shortage filling is independent of the replacement roll and may require
  replacement rows even when the effective roll is zero.
- When surviving progressive branches disagree, the inspector shows each
  distinct complete state. It must not average values, union independent facts,
  or present an arbitrary branch as authoritative.

## Included scope

### Planner engine

- Extend the exact trait-offer candidate capability with one immutable,
  branch-correlated offer-generation state.
- Derive rarity values through `boonRarityFactsForOffer` and
  `deriveBoonRarityLedger` at the same resolved offer context used for legality.
- Publish effective replacement chance and exact replacement-domain/composition
  counts from the existing replacement authority.
- Keep provider, room/item override, Arcana, Proper Upbringing, Chaos, Yarn,
  Hymn, and shortage precedence in their existing owners.

### Planner application

- Adapt the engine result into a small read-only workspace presentation.
- Deduplicate only byte-for-byte equivalent complete branch states.
- Format numeric checks for presentation without recalculating policy.

### React

- Add one compact disclosure labeled `Offer State` inside the ordinary
  Olympian/Hermes trait editor.
- Render one state table or numbered possible-state tables when branches
  disagree.
- Explain that rarity rows are ordered checks rather than final outcome odds.
- Keep the disclosure absent for Chaos, NPC, Hammer, Spell, Fallback Gold, and
  unreached offers with no supported generation state.

## Excluded scope

- No authored schema, codec, migration, catalog-version, fixture, or undo/redo
  change.
- No global Run State rarity table.
- No RNG result, probability normalization, final rarity-distribution
  calculator, or replacement-target picker.
- No new rarity or replacement policy in the application or React.
- No restructuring of the trait dialog or candidate session.

## Delivery gate

One vertical implementation gate owns the complete engine-to-React product.

Acceptance:

1. An ordinary reached Olympian offer exposes its exact provider/context rarity
   checks and `10%` replacement roll.
2. Miniboss/item/Arcana/Proper/Yarn/Favor values are observed through the same
   existing ledger, with a representative non-base witness.
3. Ordinary shows `0%`; Hymn plus Ordinary shows `100%`.
4. A zero-chance screen can still disclose shortage-required replacements.
5. Multiple equivalent branches collapse to one display; distinct states remain
   distinct and labeled.
6. Changing the local offer draft refreshes replacement composition without
   saving authored state.
7. Non-Olympian/Hermes offers do not render the disclosure.

Primary tests:

- engine trait-offer candidate tests own raw rarity/replacement state and branch
  correlation;
- application interaction/projection tests own exact-state adaptation and
  deduplication;
- `TraitOfferEditor` tests own disclosure presence, values, draft refresh, and
  absence on unrelated providers;
- one complete repository gate closes the cross-package change.

## Closure

At completion:

- amend `docs/design/EDITOR_MODEL.md` so the durable editor contract describes
  the offer-local inspector and continues to reject a global ledger;
- record the delivery in `docs/progress/IMPLEMENTATION_PROGRESS.md`;
- delete this temporary plan; and
- commit the implementation and closure as
  `feat(traits): inspect offer generation state`.
