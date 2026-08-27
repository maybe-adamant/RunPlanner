# Persephone, Premium Service, and Effective Trait Levels Plan

## Status

**Drafted for lock on 2026-08-26.** The plan is grounded against clean base
commit `5a16b05b` (`fix(rewards): materialize Vow of Forfeit Red Onion`). It
must be committed as the execution contract before implementation begins.

This is one focused cross-lane feature set. It adds one authored random
contribution, one chronological upgrade condition, and one derived per-option
level product. It is not a general aspect-effects project.

## Objective and user-visible outcome

After delivery, a route using Aspect of Persephone can author the Aspect's
random level contribution on every eligible frozen trait row. Premium Service
expands the legal contribution for later screens. Every level-bearing trait
row presents its final effective level so the author does not have to combine
Jeweled Pom, Persephone, replacement inheritance, or Sacrificial Hymn mentally.

Concretely:

- an eligible fresh option with Aspect of Persephone owns an explicit `+0` to
  `+5` authored result;
- after Premium Service has been selected, later eligible options allow `+0`
  to `+8`;
- fresh effective level is `1 + active Jeweled Pom bonus + authored
Persephone bonus`;
- a replacement reports the replaced trait's level, plus Sacrificial Hymn's
  `+2` when that row owns the Hymn replacement;
- Calling Card changes effective rarity without changing a frozen level roll;
- Concave Stone's secondary acquisition retains the original residual row's
  authored contribution; and
- React displays the engine-derived `Effective level: N` beside the existing
  effective-rarity evidence whenever the surviving branches agree.

## Authority and audit

The durable game-data authority is
[`PERSEPHONE_PREMIUM_EFFECTIVE_LEVEL_AUDIT.md`](../audits/traits/PERSEPHONE_PREMIUM_EFFECTIVE_LEVEL_AUDIT.md).
The implementation must also preserve the existing contracts in:

- [`KEEPSAKE_GAME_DATA_AUDIT.md`](../audits/loadout-and-progression/KEEPSAKE_GAME_DATA_AUDIT.md)
  for Jeweled Pom's retained prospective contribution;
- [`ROOM_FEATURES_GAME_DATA_AUDIT.md`](../audits/room-features/ROOM_FEATURES_GAME_DATA_AUDIT.md)
  for Sacrificial Hymn's one forced replacement and `+2` levels;
- [`AUTHORED_PROJECT_MODEL.md`](../design/AUTHORED_PROJECT_MODEL.md) for strict,
  repairable option-owned authored state; and
- [`SIMULATION_AND_VALIDATION.md`](../design/SIMULATION_AND_VALIDATION.md) for
  chronological history, branch agreement, and candidate ownership.

The settled Planner simplification is deliberate: source probabilities and
Persephone's gapped internal `StackNum` interaction with Jeweled Pom are not
reproduced. Persephone contributes a continuous additive `0..5`, or `0..8`
after Premium Service.

## Current-code audit

### Catalog

`AspectDeclaration` currently carries only identity, weapon ownership, and an
optional Selene starting trait. `LobImpulseAspect` has no normalized reward-side
effect. Premium Service is a normal equipped Legendary declaration with its
offer requirements, but the catalog does not connect its selected acquisition
to Persephone's later range.

Add exactly one narrow optional declaration effect:

```ts
traitOfferLevelBonus: {
  maximumBonus: 5;
  upgradedMaximumBonus: 8;
  upgradeTraitKey: 'WeaponUpgradeBoon';
}
```

Eligibility continues to use the engine's existing stackable core-god
predicate. Do not add trait-key lists, callbacks, a generic effect expression,
or a general aspect-rank model. The compiler must close the effect shape,
validate the referenced trait, and reject widened or malformed bounds.

### Authored project

`AuthoredTraitOption` has no acquisition-time level result. Add exactly one
optional `persephoneLevelBonus` field for Persephone's additive row result.
The field is a non-negative integer with a structural maximum of eight. Its
contextual requirement and active range belong to simulation candidates rather
than the codec.

The strict schema advances from 63 to 64. The production decoder accepts only
schema 64; no compatibility shim or implicit migration is added. Existing
development fixtures advance in the same gate. Migration-tool metadata may be
updated where its current-output contract requires it, but this plan does not
add a 63-to-64 migration.

Zero must be represented explicitly on an active Persephone row. Missing is an
incomplete authored random result, not an implicit zero. A value retained on a
currently ineligible row is dormant repairable state and has no simulation
effect. Existing whole-offer replacement commands are sufficient; no new
semantic address or one-field command is needed.

### Engine chronology and settlement

Trait history already retains `previouslyPickedTraitKeys`, including selected
traits later removed. With the route's weapon/aspect fixed for the full run,
that history is sufficient to tell whether Premium Service upgraded
Persephone. Do not add a second persisted or derived aspect-rank ledger.

Introduce one engine-owned option-level resolver with explicit inputs:

- normalized catalog;
- the exact pre-offer trait history and offer context;
- retained keepsake state;
- authored option and its assessment-derived replacement transition; and
- whether the source screen suppresses stack boosts.

It returns the active Persephone contribution domain and the effective level
for that row. It is the sole arithmetic authority used by candidate projection
and selected settlement.

The resolver has two closed paths:

1. **Fresh stackable core-god row:** start at Level 1 and add the active
   Jeweled Pom contribution and authored Persephone contribution. Prospective
   acquisition bonuses use fresh stackability, not the post-acquisition Pom
   saturation predicate; one bonus must not suppress the other.
2. **Replacement row:** inherit the replaced trait's current level and add the
   transition's `levelBonus`, if present. Ignore Jeweled Pom and Persephone.

Non-level-bearing rows return no effective level. Echo last-run recreation and
any other source-equivalent `IgnoreStackBoost` path suppress both fresh stack
boosts. Ordinary god Shop purchases remain eligible.

Premium Service becomes effective only after its selected trait event has
folded. It must not change sibling rows on the same frozen screen. Later
screens retain the upgraded range even if Premium Service is removed.

The current post-selection Jeweled Pom mutation may remain as chronological
evidence, but its amount and the row's installed starting level must come from
the shared resolver components. Delete any superseded local arithmetic. In
particular, correct the current path that can add Jeweled Pom after a
Sacrificial Hymn replacement.

### Candidate product

Extend each reached trait-offer branch with parallel
`persephoneLevelBonusMaximums` and `effectiveLevels` entries, one per option.
Candidate evaluation, not the application, determines:

- whether the Persephone result is active, missing, out of range, or dormant;
- the exact maximum (`5` or `8`) at that pre-offer frontier;
- replacement precedence; and
- the final effective level.

The public candidate result may expose a row level only when all surviving
branches agree on the number. A real branch difference remains explicit and
must not be collapsed to an arbitrary first value. This parallels the existing
effective-rarity presentation rule without forcing the two products into a
new generic option-outcome abstraction.

Missing or invalid active Persephone detail must block that exact focused row
with a repairable candidate finding. Dormant detail must neither block nor
affect the row.

### Application and React

The structured-workspace trait-offer interaction adapts the engine product
into two row facts:

- an optional bounded Persephone-bonus editor when the row has a universally
  active domain; and
- an optional read-only effective level when branches agree.

The editor writes the complete trait offer through the existing
`ReplaceTraitOffer` intent. It must preserve all sibling options, Calling Card
actions, selected identity, Concave Stone result, and dormant option detail.

Place `Effective level: N` beside `Effective rarity: ...` in the ordinary trait
option row. Do not calculate levels, inspect keepsake state, search history, or
recognize Premium Service in React. When an active contribution is unresolved,
show the bounded choice and the focused incomplete feedback rather than
inventing `+0`.

## Included scope

- durable source audit and explicit normalized Planner simplification;
- declaration-owned Persephone bounds and Premium Service link;
- schema-64 optional option-owned Persephone contribution;
- strict codec, command normalization, drafts, and repairable candidate
  handling;
- Premium Service's chronological effect on later Persephone ranges;
- additive Jeweled Pom and Persephone settlement for qualifying fresh rows;
- replacement inheritance and Sacrificial Hymn effective levels;
- correction of Jeweled Pom incorrectly reaching a replacement path;
- frozen Calling Card and Concave Stone row behavior;
- branch-aware effective-level candidate projection; and
- structured-workspace and React authoring/presentation.

## Excluded scope

- non-maximum weapon-aspect rank authoring;
- combat-side Aspect of Persephone behavior;
- effects of Premium Service on any other aspect;
- a general aspect-effect, aspect-rank, random-effect, or numeric-modifier
  framework;
- source probability weighting or exact reproduction of the gapped
  Persephone/Jeweled Pom `StackNum` distribution;
- changing boon rarity, Pom target selection, Natural Selection, or existing
  Hephaestus cooldown-cap policy;
- adding offer-level controls to Chaos, Hammers, Hermes, NPC, Story, Hades,
  Echo-recreated, or other nonqualifying traits;
- React-owned eligibility or level arithmetic; and
- compatibility decoding for schema 63.

## Delivery gates and commit boundaries

### Gate A — Catalog and engine authority

Implement the complete semantic product through the planner-engine candidate
surface:

1. add and compile the narrow Aspect declaration effect;
2. add the schema-64 option contribution and strict codec/command support;
3. implement the shared option-level resolver;
4. make Premium Service chronology expand later ranges;
5. settle selected fresh and replacement rows through the same arithmetic;
6. publish branch effective levels and focused contribution findings; and
7. cover catalog, codec, candidate, history, and settlement matrices.

Gate A is one Conventional Commit, tentatively:

`feat(traits): model Persephone effective offer levels`

The executor must stop if the live code requires a general aspect-rank state,
a second trait-history fold, or duplicated candidate/settlement formulas.

### Gate B — Workspace and editor product

Consume the Gate A engine product without reinterpreting it:

1. expose the bounded row control and agreed effective level through the
   structured workspace;
2. author the contribution through the existing whole-offer intent;
3. render effective level beside effective rarity;
4. retain dormant detail across trait, selection, and loadout edits; and
5. add focused projection, React interaction, and one representative product
   witness.

Gate B is one Conventional Commit, tentatively:

`feat(planner): author Persephone offer bonuses`

### Gate C — Closure

After independent review and accepted remediation:

1. run one complete repository gate;
2. update the stable catalog, authored-project, simulation, and editor
   authorities;
3. record schema 64, the new catalog version, and the delivery milestone in
   `IMPLEMENTATION_PROGRESS.md`;
4. confirm the durable audit's Planner disposition against the shipped code;
   and
5. delete this temporary plan in the closure commit.

Gate C is a documentation/closure commit unless a review correction belongs
with Gate A or B. Do not leave implementation gate language in production
comments.

## Primary tests and acceptance matrix

### Catalog owner

- only `LobImpulseAspect` declares the `5 -> 8` offer-level effect and exact
  `WeaponUpgradeBoon` link;
- mutation tests reject a missing upgrade trait, negative/widened bounds, and
  extra effect fields; and
- existing Selene starting-trait normalization remains unchanged.

### Authored-project owner

- schema 64 round-trips absent, zero, five, and eight contributions exactly;
- malformed numbers, fractions, negatives, and values above eight are rejected;
- replacing a complete offer preserves each option's contribution and other
  dormant children; and
- no implicit schema-63 compatibility path is introduced.

### Engine owner

- Persephone with no Jeweled Pom yields effective Levels 1 through 6 from
  authored contributions 0 through 5;
- a prior Premium Service selection expands the domain to 0 through 8 and
  yields Levels 1 through 9;
- merely offering Premium Service, or selecting it on the current frozen
  screen, does not upgrade sibling rows; a later screen does;
- removing Premium Service after acquisition does not collapse the later
  domain;
- Epic Jeweled Pom composes additively, including Level 9 from standard `+5`
  and Level 12 from upgraded `+8`; Cherished Heirloom's `+4` path has one
  representative witness;
- one maximum-bonus Hephaestus cooldown-capped row proves that prospective
  Jeweled Pom is not suppressed by applying Persephone first;
- another aspect, a non-core trait, a `BlockStacking` trait, and an
  Echo-suppressed recreated row do not activate the contribution;
- an ordinary god Shop purchase remains eligible;
- an ordinary replacement inherits the old level, while the Hymn-owned row
  reports old level plus two; neither receives Jeweled Pom or Persephone;
- Calling Card rerarity preserves the contribution and effective level;
- Concave Stone selection uses the residual row's original contribution and
  does not reroll;
- selected settlement produces the same level published for that row by the
  candidate product; and
- differing branch levels remain uncollapsed rather than publishing a false
  single effective level.

The complete arithmetic and eligibility matrix belongs to focused engine
tests. Facade and product suites retain representative contacts only.

### Application and UI owner

- an eligible standard Persephone row offers every integer `+0` through `+5`;
- a later post-Premium row offers every integer `+0` through `+8`;
- missing active detail is visibly incomplete and is never silently authored
  as zero;
- changing the contribution updates `Effective level` without changing rarity
  or selection;
- Jeweled Pom and Hymn examples display the engine-derived final values;
- replacement and ineligible rows expose no active Persephone control;
- effective rarity and effective level can appear together without React
  recomputing either; and
- one interaction test proves the complete authored intent survives a save
  and reload projection.

No long checkpoint fixture is required. If the existing focused builders
cannot witness Premium-before-later-offer chronology, add one short named
checkpoint fixture containing exactly those two screens rather than extending
a route-spanning fixture.

## Validation and review

During Gate A, run focused catalog tests, authored codec/command tests, trait
offer/candidate tests, Jeweled Pom tests, and Stygian Well Hymn tests, followed
by the owning `test:catalog` and `test:engine` lanes once stable.

During Gate B, run focused structured-workspace and TraitOfferEditor tests,
then `test:planner` and `test:ui` as warranted by the touched boundary. Use
`test:changed`, lane typechecks, formatting, and `git diff --check` during
remediation. Do not repeatedly run the complete repository suite.

At closure, run `npm run check` once because this feature changes the strict
authored schema and shared catalog/engine/application contracts.

The final bird's-eye review must verify:

- exactly one option-level arithmetic authority serves candidates and
  settlement;
- only the random Persephone delta is persisted;
- Premium Service is chronological and affects later screens only;
- replacement precedence is source-correct;
- all effective-level presentation comes from engine branch agreement;
- no generic effect framework, duplicate history state, or React policy was
  added; and
- superseded local Jeweled Pom/replacement arithmetic is removed.

## Closure disposition

At completion, absorb stable outcomes into the smallest owning sections of:

- `docs/design/CATALOG_MODEL.md`;
- `docs/design/AUTHORED_PROJECT_MODEL.md`;
- `docs/design/SIMULATION_AND_VALIDATION.md`;
- the structured-workspace/editor authority only where its public row product
  changes;
- the durable audit named above; and
- `docs/progress/IMPLEMENTATION_PROGRESS.md`.

Then delete this temporary plan. Do not link it from `README.md` or the durable
roadmap.
