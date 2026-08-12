# Trait Offer Exhaustion and Fear Vows Implementation Plan

## Status

**Active implementation plan.** Gate A completed at `04de8cb`; Gate B
completed at `9c19b49`. Gate C is the remaining behavior gate before closure.
The game facts are owned by
`docs/audits/TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md`; giver
membership, requirements, rarity domains, and replacement targets remain
owned by `docs/audits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md`.

The implementation starts from schema 21 at clean commit `0726af5`, after the
Arcana/Fear and Circe delivery. Do not link this temporary plan from stable
design documents while it is active. At closure, absorb accepted contracts
into their owning design documents and retire this file.

## Objective

Correct the general Olympian/Hermes offer contract and then model the two Fear
effects that exercise it:

1. retain the fixed three-position offer envelope while allowing one to three
   materialized trait choices;
2. represent Fallback Gold as the mutually exclusive exhausted-offer outcome;
3. validate ordinary/infusion, optional Duo/Legendary, and replacement
   participation from the exact pre-offer state;
4. apply Vow of Denial by banning displayed unselected traits from later
   offers; and
5. apply Vow of Forfeit by preventing the first qualifying ordinary room Boon
   or Hermes acquisition in each biome.

This is not a probability simulator. The user authors the exact offer outcome
that occurred; the engine decides whether that outcome has positive support
from the current route state.

## Scope Boundaries

### Included

- ordinary Olympian and Hermes offers from rooms, Shops, and Devotion;
- first-Olympian composition, rarity floors, room context, targeted effects,
  and existing replacement behavior composed with the corrected offer shape;
- one-to-three materialized trait choices and Fallback Gold;
- route-wide exact banned-trait history;
- Circe suppression of Denial and Forfeit;
- one ordinary-room Forfeit acquisition veto per biome; and
- progressive candidates, findings, workspace binding, dialog authoring, Run
  State, persistence, undo/redo, and profile round-trip.

### Excluded

- RNG probability, rerolls, seeded replay, or rarity-chance percentages;
- the separate `RestrictBoonChoices` acquired effect;
- Double Boon Chance and any two-selection offer lifecycle;
- Keepsake, Fated-mode, or external save-state modifiers;
- Denial on Hammer, Pom, field-NPC, or Story offers;
- Forfeit on Shops, Devotion, Hub-owned/local rewards, pickups, Hammer, Pom,
  field-NPC, or Story acquisitions;
- production modeling of the game's `RoomRewardConsolationPrize`, including
  its healing/value or acquisition history;
- a generic reward replacement or acquisition-substitution framework; and
- a generic Fear-effect interpreter or callback registry.

## Current Live Shape

### Existing authorities to extend

- `AuthoredTraitOffer` is persisted at every concrete acquisition role and
  already owns giver, options, selected option, targeted children, Circe
  children, and the source-local Death Defiance condition.
- `createDefaultTraitOffers` and encounter defaults create complete
  declaration-owned offers for every supported giver.
- `evaluateReachedTraitOffer`, `assessTraitOffer`, first-offer composition,
  replacement composition, and `recordReachedTraitOffer` share the exact
  pre-acquisition `TraitHistoryState`.
- `traitCandidates` and the opaque focused-option candidate capability already
  evaluate edits against branch-local progressive history.
- `TraitOfferEditor` keeps a local draft, progressively evaluates it, and
  commits one complete semantic `ReplaceTraitOffer` command.
- `ArcanaFearState` already carries configured/effective Fear ranks and Circe's
  route-local disabled Vows through every reward branch.
- ordinary room-reward settlement resolves a concrete acquisition before
  applying the trait offer attached to that role;
- `beginBiomeRewardHistory` and branch initialization already define the
  biome-reset boundary.
- Run State already presents equipped traits, banned traits, and
  configured/effective Fear at the exact pre-decision frontier.

### Current gaps

- Forfeit has no explicit per-biome runtime usage;
- an ordinary incoming room reward always applies its concrete Boon/Hermes
  acquisition and then evaluates its trait child; and
- Run State cannot show per-biome Forfeit usage.

## Locked Modeling Contract

### 1. The envelope is fixed; the materialized outcome varies

The supported offer envelope has three positions. Three remains a catalog/game
constant and is not persisted per offer or recalculated from Fear rank.

The authored result is a closed union:

```ts
type AuthoredTraitOffer =
  | {
      readonly kind: 'traits';
      readonly giverKey: string;
      readonly options: OneToThree<AuthoredTraitOption>;
      readonly selectedOptionKey: TraitOptionKey;
      readonly deathDefianceConditionMet?: boolean;
    }
  | {
      readonly kind: 'fallbackGold';
      readonly giverKey: string;
    };
```

`OneToThree<T>` is a tuple union, not an unconstrained array. Trait option keys
remain `option1`, `option2`, and `option3`, but a selected key must address a
materialized option. Fallback Gold has no selected trait key, rarity, target,
Circe child, or Death Defiance child.

Do not persist three nullable options, `closed` placeholder rows, an authored
option count, or a fake `FallbackGold` trait. The fixed envelope is implicit;
the authored union records only the concrete outcome.

### 2. Existing defaults stay complete

Catalog giver defaults remain exact three-option trait defaults. They gain no
fallback or sparse shape. Every current project created under schema 22 starts
with the same three selected/default traits as schema 21.

Room, reward, Shop, wheel, cage, encounter, Hub, side-room, pickup, and detour
replacement continues to create its trait child from the resolved declaration
in the same atomic transition. This correction must not reintroduce missing
controls or allow arbitrary reward defaults to hide an authored leaf.

### 3. One engine-owned composition domain

For an exact giver, offer context, and pre-offer trait history, the engine
derives three domains:

- `O`: legal, non-banned, fresh Common-capable ordinary and infusion traits;
- `H`: legal, non-banned Duo-only and Legendary-only traits; and
- `R`: legal, non-banned exact replacement transitions.

These are derived from normalized rarity domains, giver priority keys, current
equipped slots, current rarity floor, exact offer requirements, and existing
context. Do not add copied `ordinary`, `highTier`, or `replacement` membership
arrays to catalog declarations. Do not infer the domains from currently
rendered picker sections.

The domain product is shared by selected-offer assessment, whole-offer
candidate evaluation, focused-option candidates, findings, and tests. There
must be one authority for classification and one authority for exact option
legality.

### 4. Exact cardinality and fill rules

For a concrete trait outcome:

#### `|O| >= 3`

- exactly three options are required;
- any option may be a supported ordinary, Duo, Legendary, or replacement
  outcome; and
- at most one option may be a replacement.

#### `0 < |O| < 3`

- every member of `O` must appear exactly once;
- any subset of actually materialized `H` may occupy vacant positions;
- `R` must then fill as many remaining positions as its exact distinct domain
  permits; and
- multiple replacements are allowed in this exhaustion fill.

If `R` cannot fill every vacancy, one or two materialized trait options are
valid. Fallback Gold is not valid beside or instead of a dependable ordinary
trait.

#### `|O| == 0`

- any subset of actually materialized `H` may appear;
- `R` must fill every remaining position it can, including multiple
  replacements; and
- if no `H` materializes and `R` is empty, Fallback Gold is valid.

An eligible `H` does not prevent Fallback Gold because its rarity roll may
fail. Once any `H` is authored, the result is a trait outcome and Fallback Gold
cannot coexist with it.

Replacement alternatives are distinct trait keys assessed against the same
pre-offer equipped state. They do not sequentially replace one another while
the offer is composed.

### 5. Universal exhaustion is independent of Denial

The planner adopts the user-validated game model recorded in the audit:
reduced materialization and Fallback Gold are universal exhaustion behavior.
Denial does not enable, disable, or otherwise switch the composition
algorithm. It merely bans exact traits and therefore reaches exhaustion much
faster.

The installed script's Denial-gated final rarity-table pass remains documented
as source evidence. Do not reproduce that conditional as a second composition
path in production.

### 6. Fallback Gold has no trait transition

A reached valid Fallback Gold outcome:

- publishes a reached offer evaluation for its exact owner;
- equips no trait;
- emits no `TraitOfferEvent`;
- bans no trait;
- does not create targeted, Circe, rarity, level, or replacement children; and
- contributes no modeled currency or consumable amount.

The exact `FallbackGold` source key may be retained in evaluation/presentation
evidence, but it is not inserted into `equippedTraits` or declared as a normal
giver member.

### 7. Denial is an after-selection history effect

The catalog declares a closed Denial effect with count two and declares which
givers participate. The nine ordinary Olympians and Hermes participate;
Hammer, Pom, field-NPC, and Story providers do not.

When Denial is effectively active and a participating trait outcome is valid:

1. equip/apply the selected option through the existing transition;
2. collect every other materialized trait option, up to the declared count;
3. append those exact trait keys as banned facts at the same chronological
   acquisition; and
4. recompute the folded trait state before the next acquisition.

The selected trait is never banned. A two-option result bans one trait; a
one-option result and Fallback Gold ban none. Shops and Devotion participate
because they resolve the same eligible giver surface. Devotion's own no-Duo
context remains independent.

`TraitHistoryState` owns the folded canonical banned set because bans directly
change later trait eligibility. `TraitOfferEvent` retains the exact banned keys
as derived event evidence so folding remains deterministic. Do not add a
parallel ban set to reward history, Redux, or React.

If Circe later suppresses Denial, new offers stop adding bans. Existing event
evidence and the folded banned set remain unchanged for the rest of the route.

### 8. Forfeit vetoes one ordinary room acquisition

The catalog declares a closed Forfeit effect:

- maximum one trigger per biome;
- qualifying authored reward types `Boon` and `HermesUpgrade`; and
- behavior `preventOrdinaryRoomAcquisition`.

The engine applies this effect only at the existing ordinary Room Occurrence's
incoming room-reward settlement boundary. Room ownership is the provenance;
do not pass a Forfeit-eligibility flag into generic acquisition settlement or
infer participation from a concrete source key. This matters for `Boon`: its
concrete acquisition would be a selected source such as `ApolloUpgrade`, but
Forfeit qualifies the enclosing authored `Boon` room reward. If Forfeit is
active and unused in the biome, ordinary room settlement:

1. retains the already-authored/consumed door reward and bag outcome;
2. records Forfeit as consumed for that biome;
3. emits no concrete Boon/Hermes acquisition;
4. does not evaluate or apply the authored trait offer for that role; and
5. publishes narrow room-reward-veto evidence for evaluation and Run State.

The game creates `RoomRewardConsolationPrize`, but its value has no supported
downstream effect in the planner. Keep that fact in the audit; do not declare,
apply, or record a substitute acquisition in production merely to mirror an
otherwise inert implementation detail.

The authored trait child remains persisted under its reward owner. It is
dormant for that vetoed acquisition rather than deleted or rewritten.
This preserves undo/redo and permits the same authored reward to become a real
trait offer after an upstream Fear/Circe change.

Shop purchases and Devotion use non-qualifying acquisition paths. They neither
trigger nor consume Forfeit. Other non-qualifying acquisition owners likewise
do not participate. A later qualifying ordinary room reward in the same biome
still triggers it. The per-biome usage resets at the existing biome branch
initialization boundary. Circe suppression prevents later triggers but does
not restore a vetoed acquisition. If Forfeit was already consumed, Run State
continues to report `consumed` even after later Circe suppression.

### 9. Fear runtime usage stays with progressive Fear state

Extend `ArcanaFearState.fear` with the narrow derived per-biome usage needed by
Forfeit, and add a closed trigger event/evidence type. Reset that usage through
an explicit `beginBiomeArcanaFearState` transition when reward branches enter
the next biome.

Do not put Forfeit usage in persisted route loadout, generic counters,
`RewardHistoryState`, or a mutable simulation sidecar. Configured rank,
effective rank, Circe suppression, and run-local usage must remain one explicit
branch product.

### 10. Findings and progressive editing

Structural validation owns:

- the closed outcome kind;
- one-to-three trait tuple bounds;
- distinct trait keys;
- selected-key contact;
- known giver membership;
- rarity, target, and Circe child shape; and
- provider eligibility for sparse/fallback outcomes.

Simulation owns:

- exact `O/H/R` membership;
- required ordinary inclusion;
- optional high-tier support;
- forced replacement fill and maximum replacement count;
- Fallback Gold availability;
- banned-trait rejection; and
- Fear timing and the ordinary room-acquisition veto.

An upstream edit may leave an authored trait outcome invalid. The exact value
remains persisted and receives a finding; it is not silently refilled,
truncated, converted to fallback, or rehomed.

The dialog edits a local draft. It renders only materialized trait rows, plus
one engine-backed control for the next position when another position can be
authored. Removing a trailing option, adding the next option, selecting
Fallback Gold, or returning from fallback to traits must construct a complete
draft and immediately evaluate it through the existing opaque candidate
capability. React must not calculate `O/H/R`, mandatory rows, replacement fill,
or fallback availability.

Fallback Gold is selected as a whole-offer outcome from the first-position
surface and closes rows two and three. Returning to traits uses an
engine-projected valid starting draft or the declaration default as explicit
candidate evidence; React does not invent a trait key.

### 11. Run State and route trait history

Run State adds:

- player-facing labels for currently banned traits; and
- Forfeit's current-biome status: inactive, available, or consumed.

The route Traits tab continues showing only real equipped trait acquisitions.
Fallback Gold and a forfeited authored offer do not appear as equipped traits.
No replacement acquisition appears in technical acquisition history; no new
global reward timeline belongs to this slice.

## Catalog and Persisted Contract

### Catalog additions

Add only declaration facts that cannot be derived from existing normalized
data:

- a closed optional Fear runtime effect on `FearVowDeclaration`;
- Denial participation on `TraitGiverDeclaration` (absent/false outside the ten
  supported givers).

The Fear effect union contains only the two supported source-backed cases. It
is not a string-dispatched interpreter and does not reserve generic effect
arguments for future Vows.

### Schema 22

The authored union changes the serialized trait-offer shape and requires a
project schema bump from 21 to 22.

The repository's current policy rejects stale schemas rather than silently
inventing migrations. Keep that policy: schema-21 profiles remain rejected
with the exact version finding. Do not add a one-off application migration or
compatibility decoder unless the user separately changes the project-wide
profile migration policy.

Schema-22 encoding/decoding must cover both room-state and encounter-owned
trait offers, reject fallback for unsupported givers, reject sparse Story/NPC/
Hammer offers, and preserve every existing targeted/Circe/Death Defiance child
on trait outcomes.

## Ownership Map

### Hades II catalog

Owns source-backed Fear effect declarations, giver participation, and
normalization validation. It does not calculate current bans, offer
cardinality, or per-biome usage.

### Planner engine authored project

Owns the closed offer union, tuple/key invariants, defaults, strict codec,
schema version, semantic command validation, immutable replacement, and exact
addresses. The existing `TraitOfferAddress` remains the owner for both outcome
kinds.

### Planner engine simulation

Owns `O/H/R` derivation, offer support, fallback legality, banned-trait folding,
Fear effect timing, the ordinary room-reward acquisition veto, findings,
progressive candidate capabilities, and Run State source products.

### Planner application and React

Owns labels, contextual picker sections, add/remove/fallback controls, dialog
draft coordination, finding presentation, and Run State presentation. It must
consume engine products rather than recompute composition or Fear behavior.

## Delivery Gates

### Gate A — Universal exhausted-offer contract

Deliver one complete cross-layer correction before adding either Vow effect:

1. introduce the authored trait/fallback union and schema 22;
2. update defaults, codecs, commands, addresses' consumers, fixtures, and
   selected-option helpers without changing existing default values;
3. derive the exact `O/H/R` domain from current catalog/history/context;
4. replace the old ordinary-count replacement cap with the complete
   cardinality/fill assessment;
5. support valid one-, two-, and three-trait outcomes and Fallback Gold in
   selected simulation and candidate evaluation;
6. publish exact offer-level findings for missing mandatory ordinary traits,
   missing forced replacements, unsupported sparse width, invalid fallback,
   and a selected key outside the materialized tuple;
7. adapt application projections, workspace interaction binding, route trait
   projection, and the trait dialog;
8. prove immediate progressive feedback for add/remove/fallback edits; and
9. retain fixed triples for all non-Olympian/non-Hermes providers.

Gate A should be one coherent feature commit. Do not land a schema-only or
nullable-slot preparatory commit for later UI work to repair.

Default commit:

```text
feat(planner): model exhausted trait offers
```

### Gate B — Vow of Denial

1. normalize the closed Denial effect and the ten participating givers;
2. add exact banned keys to trait-offer event evidence and folded
   `TraitHistoryState`;
3. reject banned traits through the ordinary trait eligibility authority;
4. derive bans only from actual materialized unselected options after a valid
   selection;
5. preserve prior bans and stop future bans when Circe suppresses Denial;
6. exercise room, Shop, Hermes, and Devotion acquisition paths through the same
   policy;
7. project player-facing banned labels in Run State; and
8. add progressive candidate witnesses showing later pool exhaustion,
   replacement pressure, and Fallback Gold without any Denial-specific
   composition branch.

Default commit:

```text
feat(engine): model Vow of Denial trait bans
```

### Gate C — Vow of Forfeit

1. normalize the closed Forfeit ordinary-room acquisition-veto effect;
2. extend progressive Fear state with explicit current-biome usage and a
   biome-reset transition;
3. intercept only the qualifying ordinary incoming room-reward boundary before
   concrete Boon/Hermes history and trait acquisition;
4. retain bag/offer history while emitting no concrete acquisition;
5. keep the persisted trait child dormant and publish no trait evaluation or
   finding for the vetoed role;
6. prove that Shop and Devotion offers do not trigger or consume Forfeit;
7. prove Circe-before-trigger, Circe-after-trigger, and next-biome reset; and
8. present available/consumed Forfeit status in Run State.

Default commit:

```text
feat(engine): model Vow of Forfeit acquisition veto
```

### Gate D — Closure and absorption

1. run the complete repository gate;
2. verify schema-22 save/load, undo/redo, autosave recovery rejection of stale
   schemas, and representative product loops;
3. absorb the accepted offer, trait-history, Fear-runtime, and UI contracts
   into their stable owning design documents;
4. update the Arcana/Fear and trait audits with final implementation
   disposition;
5. retire this progress plan; and
6. retain no temporary compatibility helper, duplicate composition query, or
   test-only production surface.

Default commit:

```text
docs: close trait exhaustion and Fear Vows delivery
```

## Primary Tests and Audit-Againsts

### Catalog

Primary owners:

- `packages/hades2-catalog/test/catalog/traits.test.ts`
- `packages/hades2-catalog/test/catalog/arcana-fear.test.ts`

Prove exact Denial participation, exact Fear effect payloads, and rejection of
malformed declarations.

### Authored contract

Primary owners:

- `packages/planner-engine/test/authored-project/codec.test.ts`
- `packages/planner-engine/test/authored-project/encounter-codec.test.ts`
- `packages/planner-engine/test/authored-project/room-state/codec.test.ts`
- focused trait-offer command tests beside their owning command authority

Prove one/two/three tuple round-trip, fallback round-trip, selected-key
contact, distinctness, provider restrictions, child restrictions, schema-21
rejection, and schema-22 defaults.

### Universal composition matrix

Primary owner:

- `packages/planner-engine/test/simulation/trait-replacement.test.ts`, renamed
  or split only if the complete offer-composition matrix has a clearer single
  owner

Required rows:

| `O` |              Authored `H` | `R` capacity | Required result                              |
| --: | ------------------------: | -----------: | -------------------------------------------- |
|  3+ |             any supported |          any | exactly 3; at most 1 replacement             |
|   2 |                         0 |            0 | 2 ordinary traits                            |
|   2 |                         0 |           1+ | 2 ordinary + 1 replacement                   |
|   1 |                         1 |           1+ | ordinary + high-tier + 1 replacement         |
|   1 |                         0 |           2+ | ordinary + 2 replacements                    |
|   1 |                         0 |            0 | 1 ordinary trait                             |
|   0 |                       1–3 |    remaining | authored high-tier + forced replacement fill |
|   0 |                         0 |          1–3 | 1–3 forced replacements                      |
|   0 |                         0 |            0 | Fallback Gold                                |
|   0 | eligible but unrolled `H` |            0 | Fallback Gold remains supported              |

Also retain first-Olympian, Devotion no-Duo, Proper Upbringing floor,
Heroic-no-replacement, targeted acquisition, and option-independence witnesses.
Do not replicate this complete matrix in UI or product-loop suites.

### Denial

Primary owner:

- a focused engine simulation test file for Fear/trait interaction

Required witnesses:

- three choices ban the two unselected exact keys;
- two choices ban one and one choice bans none;
- fallback bans none;
- later candidates exclude banned keys;
- the selected/equipped key remains legal;
- bans cross giver acquisition sites but remain exact trait keys;
- Shop and Devotion participate;
- NPC, Story, Hammer, and Pom do not;
- Circe preserves old bans and prevents new bans; and
- the same exhausted offer is legal without checking whether Denial is active.

### Forfeit

Primary owner:

- a focused engine reward-processing test file for the Forfeit room-reward
  veto

Required witnesses:

- first qualifying ordinary room Boon and first qualifying ordinary room
  Hermes each qualify;
- a preceding non-qualifying room reward does not consume Forfeit;
- only the first qualifying reward in a biome is vetoed;
- authored offer/bag consumption remains while Boon/Hermes acquisition and
  trait history do not advance;
- no replacement/consolation acquisition is recorded;
- the dormant authored trait child publishes no trait evaluation or finding;
- Shop and Devotion neither trigger nor consume the effect;
- Circe before the qualifying reward prevents the veto;
- Circe after the veto does not restore it and status remains consumed; and
- entering the next biome resets usage.

### Application and product contact

Primary owners:

- `apps/planner/src/projections/traitDomainProjection.test.ts`
- `apps/planner/src/projections/traitProjection.test.ts`
- `apps/planner/src/ui/editor/rewards/TraitOfferEditor.test.tsx`
- `apps/planner/src/projections/structured-workspace/presentation/run-state.test.ts`
- one representative workspace/product-loop witness

Prove one complete add/remove/fallback interaction, immediate progressive
feedback, exact finding navigation, banned labels, Forfeit status, and no
horizontal/hidden-control regression. Do not copy the engine composition
matrix into React tests.

## Verification Strategy

During implementation, use the narrowest truthful lane:

- catalog declaration work: `npm run test:catalog`;
- authored/simulation work: focused Vitest files, then `npm run test:engine`;
- dialog/projection work: focused UI files, then `npm run test:ui`;
- workspace capability changes: `npm run test:contract`;
- uncommitted mixed changes: `npm run test:changed`.

Run `npm run check` once at each completed cross-layer gate when shared package
types changed, and once at final closure. Do not run the full suite after every
single focused test adjustment.

## Completion Criteria

The delivery is complete only when:

1. one engine authority validates the universal `O/H/R` composition contract;
2. the authored model represents one-to-three traits or Fallback Gold without
   placeholder slots;
3. all non-Olympian/non-Hermes providers retain their current exact shape;
4. Denial only adds bans and never selects a separate composition algorithm;
5. Circe preserves existing bans while stopping future ones;
6. Forfeit vetoes exactly one qualifying ordinary room acquisition per biome,
   records no substitute acquisition, and never consumes on Shop or Devotion;
7. progressive candidates, selected simulation, findings, Run State, and React
   agree on the same exact frontier;
8. schema-22 persistence and all current product loops pass;
9. superseded fixed-triple assumptions and replacement-count queries are
   removed rather than retained in parallel; and
10. production growth consists only of the new domain behavior and its narrow
    products, with no shadow simulator or generic effect framework.
