# Vow of Forfeit Red Onion Correction Plan

## Status

**Locked on 2026-08-26.** Execution is grounded against clean production base
commit `102c3822` (`docs(keepsakes): close remaining effects plan`) and begins
from the plan-lock commit containing this document and its corrected source
audit.

This is one focused correctness gate. It replaces one obsolete simulation
simplification and closes the same source-backed transition when reached from
Artificer. It is not a general reward-transformation project.

## Objective and User-Visible Outcome

Model Vow of Forfeit as the game's concrete Red Onion substitution rather than
as the absence of an acquisition.

After delivery:

- a qualifying ordinary Boon or Hermes reward still consumes its authored
  reward-store entry but materializes a required Red Onion;
- an Artificer-selected `RunProgress` Boon or Hermes replacement consumes both
  the Artificer use and the biome's available Forfeit use, then materializes a
  required Red Onion;
- no trait screen, trait acquisition, provider history, or Denial result is
  produced for the replaced Boon/Hermes reward;
- the Red Onion participates in its real normal-pickup, Time Piece, and Sea
  Star interactions; and
- the timeline presents the realized outcome as a substitution rather than
  implying that a Boon remains available.

The authored room or Artificer replacement remains Boon/Hermes because that is
the truthful door, reward-store, and generation identity. Red Onion is a
derived materialization result, never an authorable door reward.

## Settled Source Facts and Planner Boundary

The durable source audit is
[`TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md`](../audits/traits/TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md).
The implementation is audited directly against these installed-script
contacts:

- `RewardLogic.lua:303-405`: `SpawnRoomReward` invokes
  `CheckBoonSkipShrineUpgrade` only for the outer `Boon` and `HermesUpgrade`
  cases;
- `ShrineLogic.lua:918-928`: a successful check consumes one biome use, creates
  `RoomRewardConsolationPrize`, and registers it as a required object;
- `GiftLogic.lua:12-39`: Artificer consumes the source and one use, chooses a
  `RunProgress` replacement excluding Devotion and Spell Drop, and calls
  `SpawnRoomReward` with that exact replacement as `RewardOverride`;
- `EncounterLogic.lua:1682-1727` and `RewardLogic.lua:395-398`: Devotion's two
  contacts call `GiveLoot` directly and never enter the Forfeit check; and
- `ConsumableData.lua:199-235` plus English `TraitText.en.sjson`: the result is
  the localized **Red Onion**, inherits ordinary consumable duplication, is
  Time Piece eligible, is not Artificer eligible, and is not an Echo
  last-reward source.

The exact normalized predicate is:

1. the materialization uses the `RoomReward` spawn lane;
2. its outer offer type is `Boon` or `HermesUpgrade`;
3. Vow of Forfeit is currently effective; and
4. its one use for the current biome has not been consumed.

This predicate covers ordinary incoming rewards and Artificer-generated
replacements. It deliberately does not inspect the resolved giver or trait
provider, which keeps Devotion, Shop purchases, NPC loot, and other direct
`GiveLoot` paths outside the rule.

## Required Ordering and State

### Ordinary qualifying reward

```text
resolve authored Boon/Hermes offer and reward-store use
-> consume biome Forfeit use
-> record fixed Red Onion substitution
-> settle required Red Onion interaction
```

The original offer remains in offer and bag history. The Red Onion, not the
Boon/Hermes role, reaches concrete acquisition settlement. The first later
qualifying reward in the same biome is normal. Beginning the next biome resets
only the per-biome Forfeit use as it does today.

### Artificer qualifying replacement

```text
destroy eligible minor source and consume Artificer use
-> select and consume RunProgress Boon/Hermes replacement
-> consume biome Forfeit use
-> record Artificer generation and fixed Red Onion substitution
-> settle required Red Onion interaction
```

The Artificer output is required even when its destroyed source was optional;
`SpawnRoomReward` owns replacement requiredness. If the replacement supports
duplication, the game overwrites that capability with the destroyed source's
`CanDuplicate` value. The planner must retain its existing source-capability
gate for Sea Star while evaluating Time Piece against the realized Red Onion.

If Forfeit was already consumed or is suppressed, Artificer's Boon/Hermes
replacement settles normally. Conversely, an Artificer replacement that
consumes Forfeit makes a later ordinary Boon/Hermes reward normal.

### Red Onion interaction

The resulting object has exactly these supported outcomes:

- normal required pickup;
- Time Piece conversion instead of pickup when a charge is available; and
- Sea Star duplication after normal pickup only when the source-capability
  gate permits it.

It cannot be converted by Artificer, cannot start a trait offer, and cannot
replace Echo's last-reward recreation source. Time Piece conversion prevents
normal pickup and therefore prevents Sea Star, following the existing shared
acquisition ordering.

## Current-Code Audit

### Catalog

`packages/hades2-catalog` already declares the exact
`RoomRewardConsolationPrize` acquisition with `canDuplicate`,
`goldConversionEligible`, no Artificer capability, and no last-reward
descriptor. The reward label is currently the generic `Consolation Prize`
rather than the source-localized `Red Onion`.

The normalized Forfeit effect is currently named
`preventOrdinaryRoomAcquisition`. That contract encodes both obsolete parts of
the simplification: ordinary-authored provenance and no replacement
acquisition. Replace it with one narrow RoomReward substitution effect carrying
the qualifying outer reward types and fixed replacement identity. Do not add a
callback, registry, or general rewrite language.

`RoomRewardConsolationPrize` is already supported by the Nemesis generated
pickup lifecycle. The correction must reuse the same acquisition declaration
facts while adding only the truthful RoomReward materialization contact; it
must not reuse a Nemesis producer merely because the object identity matches.

### Planner engine

`consumeOrdinaryRoomForfeit` and the early branch in
`acquisition-settlement.ts` currently:

- require an enclosing authored room;
- append `rewardForfeited` with a comment that no concrete acquisition exists;
- discard every acquisition and trait-child settlement for the branch; and
- never run for the separately settled Artificer replacement.

Move the transition to the shared point at which a RoomReward outer offer is
about to materialize. Keep the event narrow: existing Forfeit evidence may add
the fixed replacement identity, but the implementation must not create a
generic substitution-event protocol. After recording that evidence, settle
the catalog-declared Red Onion through the canonical acquisition path.

The deterministic replacement does not require a new authored result. Its
interaction uses the stable acquisition entry already owned by the ordinary
reward or Artificer replacement. Existing authored disposition and Room Action
machinery remains the authority for Time Piece and Sea Star choices.

### Planner application and React

The structured-workspace source index currently reconstructs a set of owners
with `rewardForfeited` events, projects `acquisitionOutcome:
'forfeitedByVow'`, and React renders `Removed by Vow of Forfeit` while hiding
the acquisition children. That parallel presentation path is the source of
the misleading timeline.

Replace it with the engine's concrete realized acquisition product. The room
reward editor continues to show the authored Boon/Hermes identity where the
user authors the door or replacement. The timeline outcome presents a compact
transformation such as `Boon -> Red Onion (Vow of Forfeit)` and exposes only
the Red Onion's legal interactions. The Artificer row preserves its selected
replacement evidence and presents the nested realized Onion without a Boon
trait launcher.

Delete the Forfeit-only workspace source-index query, contract discriminant,
and React status branch once no consumer remains. Do not move the substitution
predicate into projections or components.

## Included Scope

- correction of the durable Forfeit source audit and design disposition;
- source-localized Red Onion catalog label and narrow Forfeit substitution
  declaration;
- ordinary Boon/Hermes substitution and concrete Red Onion settlement;
- Artificer-generated Boon/Hermes substitution at the same engine authority;
- biome use, original offer/bag evidence, Artificer-use, requiredness, and
  duplication-capability chronology;
- Time Piece and Sea Star contacts on the realized Onion;
- timeline and editor projection of the concrete outcome; and
- retirement of the old acquisition-veto presentation path.

## Excluded Scope

- making Red Onion an authorable door, reward-store entry, or random
  replacement choice;
- changing Artificer's `RunProgress` replacement pool or reward-bag policy;
- changing Devotion, Shop, NPC, Story, or direct `GiveLoot` behavior;
- modeling the Onion's one-health numeric effect, Gold value, voice lines, or
  presentation animation;
- probabilistic Forfeit, Artificer, Time Piece, or Sea Star resolution;
- a generic reward transformation framework, callback registry, or persisted
  derived-output model; and
- compatibility shims for development schemas.

No authored-project schema bump is expected because the substitution is
deterministic and existing semantic owners hold every player choice. If live
code demonstrates that a new persisted field is required, execution stops for
plan review rather than adding it implicitly. The catalog semantic version
advances with the corrected normalized effect contract.

## Single Delivery Gate

Deliver the correction as one complete vertical slice and one Conventional
Commit, tentatively:

`fix(rewards): materialize Vow of Forfeit Red Onion`

The gate owns, in order:

1. correct the catalog label and replace the obsolete Forfeit effect contract;
2. move Forfeit consumption to the shared RoomReward Boon/Hermes
   materialization boundary;
3. settle the fixed Red Onion through canonical acquisition machinery for both
   ordinary and Artificer-generated offers;
4. expose the realized substitution and interaction product to the structured
   workspace;
5. remove the old veto-only projection and React branch;
6. update stable reward, simulation, architecture, editor, and audit
   authorities to the delivered model; and
7. close focused tests, perform independent review, run one final repository
   gate, record the durable progress milestone, and delete this temporary plan
   in the same closure commit.

The executor must stop if either source path requires a second simulation
pipeline, a new authored result, or a general transformation abstraction.

## Primary Tests and Acceptance Matrix

### Catalog owner

- `RoomRewardConsolationPrize` is labeled `Red Onion` and retains exact
  duplication, Time Piece, Artificer, and last-reward facts.
- Forfeit declares only the two qualifying outer reward types and its fixed Red
  Onion replacement.
- Compiler mutation tests reject missing, widened, or mismatched substitution
  facts.

### Engine owner

- ordinary Boon and Hermes rewards each consume Forfeit once, retain their
  offer/bag evidence, emit a concrete Red Onion, and produce no trait child;
- a second qualifying reward in the same biome is normal, and the next biome
  resets availability;
- Devotion's chosen and spurned offers neither consume Forfeit nor become Red
  Onions;
- Artificer spends its use and consumes its selected Boon/Hermes store entry
  before Forfeit creates the Red Onion;
- both chronology orders are witnessed: Artificer consumes Forfeit before a
  later ordinary Boon, and an ordinary Boon consumes it before a later
  Artificer replacement;
- an Artificer output remains required even when its source pickup was
  optional, while Sea Star support still follows the destroyed source's
  duplication capability;
- Time Piece conversion of the Onion prevents normal pickup and Sea Star;
- a normal Onion pickup may create the existing one-generation Sea Star
  duplicate and never records Echo last reward; and
- Circe suppression retains the normal Boon/Hermes result without consuming
  Forfeit.

The complete Forfeit/Artificer ordering matrix belongs to focused engine tests.
Facade and product tests retain representative witnesses only.

### Application and UI owner

- an ordinary replaced Boon timeline shows the Red Onion transformation, no
  Boon trait launcher, and the legal Onion interaction;
- an Artificer-generated replaced Boon shows Artificer generation followed by
  the same Red Onion outcome without duplicating policy in the projection;
- Run State moves Forfeit from available to consumed at the substitution; and
- no `forfeitedByVow` or `ordinaryRewardForfeited` presentation path remains.

No new large checkpoint fixture is required unless the existing focused
project builders cannot witness one complete ordinary and one Artificer path.
If a fixture is needed, add one short named checkpoint rather than extending a
route-spanning fixture corpus.

## Validation and Review

During implementation, run only the narrow owning lanes:

- focused catalog declaration/compiler tests;
- `forfeit-room-rewards.test.ts`, focused Artificer tests, and directly affected
  acquisition/timeline tests;
- focused structured-workspace and React interaction tests;
- lane typechecks plus formatting and `git diff --check`.

After the slice is stable and independently reviewed, run `npm run check` once
at closure because the change alters shared catalog and acquisition semantics.
Do not repeatedly run the complete repository gate during remediation.

The final bird's-eye review must verify:

- one source-backed substitution authority serves both entry paths;
- original offer and bag history are retained while concrete acquisition is
  Red Onion;
- Devotion remains excluded by outer producer semantics;
- the obsolete no-acquisition and UI sidecar paths are deleted;
- no persisted schema or generic transformation machinery was added; and
- production growth is offset by deletion of the old special-case path.

## Closure

At completion, absorb the stable result into the smallest owning sections of:

- `docs/design/REWARD_MODEL.md`;
- `docs/design/SIMULATION_AND_VALIDATION.md`;
- `docs/design/ARCHITECTURE.md` and editor/workspace docs only where their
  current Forfeit wording changes; and
- the durable source audit and `IMPLEMENTATION_PROGRESS.md`.

Then delete this temporary plan in the same closure commit. Do not link it from
`README.md` or any stable authority.
