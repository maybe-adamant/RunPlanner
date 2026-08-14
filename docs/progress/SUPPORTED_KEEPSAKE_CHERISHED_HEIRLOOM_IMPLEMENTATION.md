# Supported Keepsake Ranks and Cherished Heirloom Implementation Plan

## Status

**Locked.** This isolated three-gate plan is grounded in the live
production tree at `e26174e` and the source facts in:

- `docs/audits/KEEPSAKE_GAME_DATA_AUDIT.md`; and
- `docs/audits/CHERISHED_HEIRLOOM_KEEPSAKE_AUDIT.md`.

The live implementation base is clean at that commit. This planning change set
contains the keepsake audit documents and their README/audit links; it contains
no production-code change for this slice.

Commit the locked audits and this plan before implementation. Do not link this
temporary plan from `README.md`, stable design documents, biome rules, or
another progress plan. At delivery closure, absorb the durable supported-rank
and Cherished contracts into their smallest stable owners and retire this
file.

## Objective

Harden the six currently supported keepsake effects with exact rank-I,
rank-II, rank-III, and rank-IV declaration data, then implement Cherished
Heirloom against those six effects through its two separate lifecycle
contacts: later rack equips entering a succeeding biome and immediate
reconstruction of the already-active keepsake.

The user-visible result is:

- ordinary player-selected keepsakes continue to enter at the planner's fixed
  rank-III baseline;
- Cherished Heirloom immediately applies the exact rank-III-to-rank-IV
  transition to the currently equipped supported keepsake;
- supported keepsakes equipped after Cherished Heirloom use their rank-IV
  ordinary equip result;
- retained effects belonging to a previously removed keepsake are not mutated;
- the planner exposes the resulting charges, duration, level bonus, Fig Leaf
  uses, and Gorgon rarity through its existing chronological state products;
  and
- the other 27 keepsake identities remain full selection, chronology,
  no-return, Fated/Unfated, and Run State participants while owning no modeled
  inherent gameplay effect.

This plan creates a narrow extension socket: promotion of another keepsake
into effect support must later supply its ordinary effect, complete rank data,
Cherished disposition, and Gift Gift Gift disposition. It does not create
placeholder effects or callbacks for unsupported keepsakes now.

## Locked Scope

### Supported effect set

Only these six declarations own a supported effect descriptor:

| Game key                     | Label               | Effect kind          |
| ---------------------------- | ------------------- | -------------------- |
| `AthenaEncounterKeepsake`    | Gorgon Amulet       | `gorgonAmulet`       |
| `SkipEncounterKeepsake`      | Fig Leaf            | `figLeaf`            |
| `TempHammerKeepsake`         | Experimental Hammer | `experimentalHammer` |
| `HadesAndPersephoneKeepsake` | Jeweled Pom         | `jeweledPom`         |
| `RarifyKeepsake`             | Calling Card        | `callingCard`        |
| `GoldifyKeepsake`            | Time Piece          | `timePiece`          |

The catalog continues to declare all 33 ordinary keepsake identities for
selection and history. The remaining 27 declarations have no effect descriptor
and are **effect-neutral** in this slice: they own no dedicated inherent-effect
state, rank-sensitive Cherished transition, or Gift Gift Gift transition.
Effect-neutral never means absent from simulation. Their identity still enters
the current/retained/replaced keepsake chronology, removed-key and no-return
legality, derived Fated/Unfated state, and Run State. No generic `unsupported`,
`deferred`, or empty-effect value is added to production catalog data.

### Planner rank boundary

- `Common`, `Rare`, `Epic`, and `Heroic` are declaration ranks I, II, III, and
  IV respectively.
- Every ordinary player-selected keepsake still enters from `Epic`; rank is
  not authored in the loadout or at a rack.
- The catalog records all four ranks only inside each of the six supported
  effect descriptors.
- Cherished Heirloom is the only rank-changing planner input in this slice. It
  supplies the exact supported rank-III-to-rank-IV transition.
- A later produced rank-I effect, including Gift Gift Gift, is outside this
  plan and does not justify player-authored rank state.

### Exact rank facts

| Supported keepsake  | Rank I (`Common`) | Rank II (`Rare`) | Rank III (`Epic`) | Rank IV (`Heroic`) |
| ------------------- | ----------------- | ---------------- | ----------------- | ------------------ |
| Gorgon Amulet       | rarity level 1    | rarity level 2   | rarity level 3    | rarity level 4     |
| Fig Leaf            | 1 biome use       | 2 biome uses     | 3 biome uses      | 4 biome uses       |
| Experimental Hammer | 10 encounters     | 15 encounters    | 20 encounters     | 30 encounters      |
| Jeweled Pom         | +1 level          | +2 levels        | +3 levels         | +4 levels          |
| Calling Card        | 2 uses            | 4 uses           | 6 uses            | 8 uses             |
| Time Piece          | 2 uses            | 3 uses           | 4 uses            | 5 uses             |

These are catalog facts, not six generic scalar values. Each effect descriptor
retains domain-language fields appropriate to its effect.

### Exact Cherished transitions

Cherished Heirloom first equips as an ordinary Duo trait. After that successful
acquisition is recorded, its declaration-owned acquisition effect advances
only the current keepsake.

| Current supported keepsake | Immediate rank-III-to-rank-IV transition                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Gorgon Amulet              | A pending future Athena appearance changes from Epic to Heroic. A consumed or expired appearance remains consumed or expired. |
| Fig Leaf                   | No change to the retained Fig Leaf use count or current-biome guard; its acquisition callback is not replayed.                |
| Experimental Hammer        | No new Hammer and no extension of the already-created Hammer duration.                                                        |
| Jeweled Pom                | Change only the prospective eligible-trait bonus from +3 to +4; do not grant another Hades trait or mutate earlier traits.    |
| Calling Card               | Add exactly two to remaining charges; do not reset to eight.                                                                  |
| Time Piece                 | Add exactly one to remaining charges; do not reset to five.                                                                   |

If the current keepsake is one of the other 27 identities, Cherished has no
immediate inherent-effect mutation. Its ordinary identity, history,
no-return, and Fated/Unfated consequences remain active, and Cherished still
remains equipped and therefore affects a later supported equip.

For a supported keepsake first equipped after Cherished Heirloom is active,
the ordinary equip transition uses its rank-IV declaration from the start:

- Gorgon begins with one pending Heroic Athena appearance;
- Fig Leaf creates four total biome uses;
- Experimental Hammer creates its one authored compatible Hammer with 30
  qualifying encounter uses;
- Jeweled Pom grants its one authored Hades trait and stores a prospective +4
  eligible-trait bonus;
- Calling Card creates eight charges; and
- Time Piece creates five charges.

Existing Fated/Unfated legality and invalidation continue to apply after rank
resolution. Cherished does not make an otherwise unavailable keepsake legal.

These are two related but independent engine transitions:

1. **Succeeding-biome equip:** a legal Postboss rack replacement resolves the
   incoming supported keepsake at rank IV while Cherished is already active.
   The transition occurs at the rack boundary; the resulting state enters the
   succeeding biome. It is not a generic biome-start effect.
2. **Active-keepsake advance:** successful acquisition of Cherished
   immediately reconstructs only the keepsake that is current at that
   acquisition point, using the six-row immediate matrix above.

Gate B owns the first contact. Gate C owns the second. Neither contact may
stand in for the other or derive its result by replaying the other transition.

### Gorgon appearance chronology

Gorgon rarity belongs to the appearance state resolved before its Athena child
settles:

- Cherished acquired while Gorgon is still pending changes that future
  appearance to Heroic;
- Gorgon equipped later while Cherished is active begins pending at Heroic;
- the reached encounter snapshots the pending rarity when it consumes the
  appearance; and
- Cherished acquired from a normal reward in the same encounter after Athena
  has already appeared cannot change that Athena offer from its snapped rarity.

The current schema-29 Gorgon child persists a generic fixed-Epic
`AuthoredTraitOffer`. That representation becomes false once a prior Cherished
acquisition makes the reached appearance Heroic. Gate B must replace it with a
strict Gorgon-specific authored child that persists exactly two decisions:

- an ordered tuple of exactly three distinct Athena trait identities; and
- the selected `option1`, `option2`, or `option3` key.

The Athena provider, trait-offer kind, option rarity, empty rarification-action
state, and Death Defiance condition are not child-authored fields. Provider and
kind are derived from the Gorgon declaration, rarity is derived from the
chronological appearance snapshot, and the Death Defiance condition remains on
the parent Gorgon phase result. The schema-30 codec rejects those legacy generic
offer fields as extra child state. The reached rarity is projected read-only
into evaluation and UI; it is never user-editable.

This correction requires strict schema 30. Schema 29 is rejected rather than
silently interpreted under the new child contract. Dormant and
context-invalid Gorgon children remain structurally representable and
repairable under the same phase-local owner.

## Explicitly Excluded

- Echo as a Story provider or NPC interaction;
- Gift Gift Gift, previous-keepsake capture, rank-I replay, and biome-start
  replay schedules;
- gameplay effects, rank profiles, Cherished transitions, or Gift Gift Gift
  transitions for the other 27 keepsakes;
- Transcendent Embryo, Aromatic Phial, Concave Stone, Crystal Figurine, Moon
  Beam, or Olympian keepsake behavior, even where the source audit records
  their future disposition;
- Concave Stone's same-offer 100% chronology;
- player-authored keepsake ranks, profile progression, chamber experience, or
  permanent rank upgrades;
- a generic keepsake callback registry, effect interpreter, service table, or
  string-keyed transition map;
- replaying acquisition callbacks during Cherished's immediate reconstruction;
  and
- unrelated trait, NPC, reward-steering, or keepsake UX work.

The broader rows in `CHERISHED_HEIRLOOM_KEEPSAKE_AUDIT.md` remain durable
source evidence. They do not broaden this implementation slice.

## Live-Code Preflight

The current code supplies the required vertical seams:

- `KeepsakeDeclaration.effect` is already a closed six-kind normalized union;
- the other 27 identities already normalize without effect descriptors;
- `packages/hades2-catalog/src/compiler/keepsakes.ts` owns exact declaration
  validation for every supported effect;
- `KeepsakeState` already owns each supported retained effect and travels on
  every reward branch;
- `createKeepsakeState` and `applyKeepsakeDisposition` own initial and later
  rack equip chronology;
- `applyJeweledPomEquipResult` and `applyExperimentalHammerEquipResult` own the
  authored equip-time children whose rank-IV values must be resolved;
- `TraitHistoryState` already records `KeepsakeLevelBoon` as an equipped Duo
  trait, so no duplicate `cherishedActive` authored or simulation flag is
  needed;
- selected trait offers settle through one reward-owned acquisition path,
  which can apply a closed declaration-owned Cherished acquisition effect
  after the trait is successfully recorded;
- Gorgon already has a phase-local authored child, branch-owned lifecycle, and
  exact workspace owner; only its fixed-Epic child contract is insufficient
  for rank IV; and
- Run State already projects the six supported effect ledgers.

The change must extend these seams rather than create a second keepsake state,
trait-effect fold, Gorgon offer editor, or rank ledger.

## Ownership Contract

### Hades II catalog

The catalog owns:

- the four-rank domain and the six exact effect-specific rank profiles;
- the fixed ordinary player-equip rank of `Epic`;
- the exact six-member supported effect union;
- Cherished Heirloom's closed acquisition effect: equip the Duo trait, then
  advance the current keepsake by one supported rank; and
- the fact that Gorgon Athena rarity is supplied by the Gorgon rank profile,
  not a fixed provider-wide or user-authored value.

Normalization must reject a supported effect with a missing rank, extra rank,
wrong value, wrong effect kind, or mutable nested rank profile. It must also
reject an effect descriptor on any of the other 27 declarations until that
keepsake receives its own complete implementation slice.

### Planner engine

The engine owns:

- exhaustive rank resolution over the six supported effect kinds;
- one closed Cherished transition over those effect kinds, with explicit
  no-effect branches for current Fig Leaf and Experimental Hammer;
- application of that transition only after a legal selected Cherished
  acquisition has entered trait history;
- rank-IV initialization when a later supported keepsake crosses an actual
  legal rack boundary;
- preservation of retained state belonging to a non-current keepsake;
- Gorgon pending/spawned rarity and the encounter-start snapshot boundary;
- the schema-30 Gorgon child codec, defaults, commands, evaluation, findings,
  and history event at the existing phase-local owner; and
- branch attestation where rank-sensitive supported state can diverge.

The transition remains an exhaustive TypeScript dispatch over the supported
effect union. Adding a future effect kind must create a compile-time obligation
to supply its Cherished disposition; an `else`, default no-op, callback table,
or lookup by raw keepsake key is not an acceptable substitute.

Cherished activity is derived from canonical equipped-trait history. Do not
mirror it into authored project state or maintain a parallel mutable boolean.

### Planner application and React

The application owns only adaptation and presentation:

- project effective Gorgon rarity and the existing Gorgon child through the
  phase-local workspace owner;
- show the six updated rank-sensitive ledgers in Run State: pending Gorgon
  exposes its effective future rarity, a reached Gorgon child exposes its
  encounter-start snapshot read-only, and the acquired Athena trait records
  that rarity in canonical trait history; consumed or expired Gorgon status
  carries no mutable live rarity; and
- retain existing trait-offer selection and navigation for Cherished Heirloom.

There is no rank picker, Cherished action button, keepsake-specific React
switch, or UI-authored reconstruction result. The user selects Cherished as an
ordinary offered trait; the engine publishes the consequence.

## Delivery Gates

### Gate A — Supported keepsake rank declarations

1. Add a closed four-rank profile to each of the six supported effect
   descriptors without adding rank data to the other 27 declarations.
2. Preserve `Epic` as the ordinary selection baseline and update all ordinary
   equip consumers to resolve the rank-III value from the profile.
3. Keep the normalized union effect-specific and deeply immutable.
4. Strengthen the catalog compiler so the supported set and every exact rank
   value are declaration-owned and complete.
5. Update catalog snapshots or fixture digests only where the normalized rank
   facts truthfully change them.
6. Prove the exact six-by-four matrix, malformed/missing/extra/non-numeric rank
   rejection, fixed-Epic ordinary selection, and absence of effect descriptors
   on the other 27 identities.

This gate changes catalog declarations and normalized consumers only. It must
not implement Cherished behavior, change authored schema, or alter selected
simulation outcomes.

Default commit:

```text
feat(catalog): declare supported keepsake rank profiles
```

### Gate B — Cherished succeeding-biome equips

1. Normalize Cherished Heirloom's closed rank-bonus capability without adding
   a generic trait callback system or a parallel active boolean.
2. Derive that capability from canonical equipped-trait history at each legal
   Postboss rack replacement.
3. Resolve the incoming supported keepsake at rank IV and execute its ordinary
   rank-IV equip transition: Gorgon Heroic, Fig Leaf 4, Hammer 30, Pom +4,
   Calling Card 8, or Time Piece 5.
4. Leave incoming effect-neutral identities without a dedicated rank-IV
   inherent effect while preserving their complete rack chronology,
   Fated/Unfated state, no-return legality, findings, and Run State identity.
5. Replace the fixed-Epic Gorgon child with its schema-30 shape containing only
   three distinct ordered Athena trait identities and one selected option key;
   derive its provider, kind, and reached rarity, keep Death Defiance on the
   parent phase, and reject legacy generic-offer fields as extra child state.
6. Carry the resulting state through selected simulation, progressive
   evaluation, candidates, findings, Run State, workspace projection, and
   React without duplicating rank policy.
7. Prove all six later-equip results, an effect-neutral later equip, invalid
   rack retention, a supported retain that does not replay or reset its effect,
   Fated/Unfated interaction, strict Gorgon codec behavior, persistence,
   undo/redo, and branch agreement.

This gate does not yet reconstruct the keepsake that was already active when
Cherished was acquired. Its complete vertical outcome is the legal rack
transition and exact state entering the succeeding biome.

Default commit:

```text
feat(planner): apply Cherished to later keepsake equips
```

### Gate C — Cherished active-keepsake advance

1. Apply the declaration-owned advance effect only after a legal selected
   Cherished acquisition has entered canonical trait history.
2. Implement the exact six-row immediate transition: pending Gorgon becomes
   Heroic; Fig Leaf and Experimental Hammer remain unchanged; Jeweled Pom
   becomes prospectively +4; Calling Card gains two; and Time Piece gains one.
3. Preserve every effect owned by a previously removed supported keepsake. An
   effect-neutral current identity receives no dedicated Cherished mutation,
   while its ordinary history, no-return, and Fated/Unfated consequences remain
   active.
4. Prove the encounter-start Gorgon rarity snapshot: prior Cherished produces
   Heroic, while Athena already spawned before same-encounter Cherished remains
   at its snapped Epic rarity.
5. Publish the immediate result through existing history, Run State,
   workspace, and finding owners without a Cherished action control or
   React-owned keepsake switch.
6. Prove current-effect zero/partial/full-use cases, no callback replay, no
   duplicate Pom/Hammer product, retained-state isolation, exactly-once
   application under progressive recomposition and later-biome evaluation,
   equivalent settlement through real canonical Demeter and Hera offers, and
   branch agreement.
7. Run the complete repository gate, perform final cross-lane review, absorb
   the durable rank/Cherished contract, record truthful verification, and
   retire this temporary plan.

Default commit:

```text
feat(engine): advance the active keepsake with Cherished
```

## Primary Test Ownership

### Catalog matrix

`packages/hades2-catalog/test/catalog/keepsakes.test.ts` owns the complete
rank-profile and supported-set matrix. Consumer tests must not reproduce all
24 rank cells.

Required witnesses:

- exact Gorgon, Fig Leaf, Hammer, Pom, Calling Card, and Time Piece profiles;
- normalized deep immutability;
- missing, extra, malformed, and wrong-value rank rejection;
- ordinary `Epic` selection remains fixed; and
- exactly six effect descriptors exist.

### Engine succeeding-biome equip matrix

A focused later-equip suite owns Gate B's complete six-result matrix.

Required witnesses:

- Gorgon Heroic, Fig Leaf 4, Hammer 30, Pom +4, Calling Card 8, and Time Piece
  5 all originate from the declaration profile;
- the transition occurs at the legal rack boundary and its result enters the
  succeeding biome without a second biome-start mutation;
- retaining the current supported keepsake does not replay its rank-IV equip
  transition, reset its charges or duration, or create another immediate
  product;
- existing Fated/Unfated legality still controls whether an equip succeeds;
- an effect-neutral incoming keepsake gains no dedicated rank-IV inherent
  effect but still updates chronology, no-return, Fated/Unfated, and Run State;
- invalid authored replacement remains repairable and produces no false
  rank-IV effect; and
- acquiring Cherished after replacing a supported keepsake does not mutate
  that removed keepsake's retained ledger.

### Engine active-keepsake transition matrix

A focused Cherished simulation suite owns the complete immediate-transition
matrix for Gate C.

Required immediate witnesses:

- pending Gorgon becomes Heroic; consumed/expired Gorgon does not reset;
- Fig Leaf remaining uses and biome guard are unchanged;
- Experimental Hammer trait identity and remaining duration are unchanged;
- current Jeweled Pom changes prospective +3 to +4 without another Hades
  acquisition;
- Calling Card maps zero/partial/full remaining charges to old plus two;
- Time Piece maps zero/partial/full remaining charges to old plus one; and
- an effect-neutral current keepsake receives no dedicated Cherished mutation,
  retains its ordinary identity-system consequences, and does not block a later
  supported rank-IV equip.

The suite must also prove that one selected Cherished acquisition advances the
current keepsake exactly once even when progressive evaluation recomposes that
selection or later biomes consume its active rank bonus. A canonical Demeter
offer and a canonical Hera offer must settle the same transition through the
ordinary selected-trait path; a synthetic trait insertion is not an acceptable
source-independence witness.

### Gorgon chronology and authored child

The existing Gorgon lifecycle/codec suites own the schema correction and
contact behavior:

- strict schema-30 round trip and schema-29 rejection;
- Gorgon child persists exactly three distinct ordered Athena trait identities
  plus one valid selected option key;
- provider, offer kind, rarity, rarification actions, and Death Defiance cannot
  be persisted on the child, with legacy generic-offer fields rejected as
  extras;
- Epic appearance without prior Cherished;
- Heroic appearance after prior Cherished or later rank-IV Gorgon equip;
- Athena already spawned before same-encounter Cherished remains Epic;
- selected trait history records the resolved appearance rarity;
- pending Run State exposes the effective future rarity, the reached workspace
  child exposes the snapped rarity read-only, and consumed or expired status
  exposes no mutable live rarity;
- a missing or structurally valid but context-invalid active child remains an
  exact phase-local finding, while malformed child shapes fail strict decoding;
  and
- dormant retained children remain repairable without affecting simulation.

### Application witnesses

Representative application tests prove:

- Run State presents the updated effect values and Gorgon rarity;
- the existing trait dialog can select Cherished without a special interaction;
- the existing Gorgon child editor presents the engine-resolved rarity and
  dispatches only author decisions; and
- findings still navigate to the exact trait offer or Gorgon phase owner.

Application tests must not duplicate the six-by-four catalog matrix or the
complete Cherished transition matrix.

## Gate Verification

During implementation, use the narrow owning lanes:

```text
npm run typecheck --workspace packages/hades2-catalog
npm run test:catalog
npm run typecheck --workspace packages/planner-engine
npm run test:engine
npm run typecheck --workspace apps/planner
npm run test:planner
npm run test:ui
npm run test:contract
```

Gate A requires the catalog lane plus the engine typecheck and focused
ordinary-equip regressions. Gate B requires focused engine/application lanes
for the succeeding-biome equip contact and schema-30 Gorgon child. Gate C
requires the active-keepsake transition and representative application lanes.
Run `npm run check` once after Gate C and review remediation are stable, before
phase closure.

## Review and Audit-Against

Use the repository executor/reviewer routine independently for each gate.
Record the exact clean or inventoried base and prohibit unrelated cleanup.

The adversarial reviewer must audit against:

- the fixed rank-III planner boundary;
- the exact six-member supported effect set;
- all 24 source-backed rank facts;
- the separate succeeding-biome equip and active-keepsake matrices;
- retained-state isolation;
- Gorgon encounter-start rarity snapshot chronology;
- the absence of production placeholders for the other 27 keepsakes;
- one authoritative transition per effect rather than catalog, engine, and UI
  copies; and
- the explicit Echo and Gift Gift Gift exclusion.

The executor must stop if live code requires a new author decision, if a
rank-IV effect contradicts the audit, or if Gorgon rarity cannot remain derived
without weakening strict authored-state ownership. The main session decides
whether to amend the plan.

## Echo Handoff

Echo is a separate slice after this plan closes. Preflight
`docs/progress/ECHO_TRAIT_IMPLEMENTATION.md` against the new live base rather
than executing its stale schema-20/base assumptions.

That later slice may:

1. implement Echo's Story provider and currently planned seven choices; and
2. add Gift Gift Gift as the conditionally available eighth choice over the
   completed six-keepsake rank/effect foundation.

Gift Gift Gift must consume the audit in
`docs/audits/ECHO_GIFT_GIFT_GIFT_KEEPSAKE_AUDIT.md`, add its own exact replay
transition and replay schedule over the six supported effect kinds, and leave
the other keepsakes effect-neutral until their individual implementation turn.
Those identities continue to participate in ordinary keepsake history,
no-return legality, Fated/Unfated state, and Run State throughout that deferral.
