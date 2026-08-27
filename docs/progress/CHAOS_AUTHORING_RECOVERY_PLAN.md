# Chaos Authoring Recovery Plan

## Status

Locked amended implementation plan. Gate A completed at
`0985bbd30be25e3614d98a7f5549451336303a17` on 2026-08-27. The remaining plan
is grounded on that clean commit and was amended on the same date after source
review proved that Vow of Denial bans the two unselected Chaos curse
identities. The paused one-selected-pair Gate B prototype was discarded before
this amendment.

The historical Chaos plan at `6073f5b2` specified a specialized selected-pair
editor, but only its engine-heavy Gate A landed in `bea2e5bf` and its model did
not account for Denial's unselected-curse bans.
The later cleanup commit `3b6fa521` removed that temporary plan as if the
application gate were complete. This document recovers only the still-useful
contract and rewrites it against the current schema-65 candidate session,
structured workspace, editor components, and Transcendent Embryo lifecycle.
It does not restore the obsolete 709-line plan verbatim.

## Objective and user-visible outcome

Finish the authoring surface and correct the persisted `TrialUpgrade` Chaos
outcome around the smallest source-faithful offer envelope:

- an unresolved Trial Upgrade opens one specialized Chaos editor;
- the author chooses three ordered curse options and each option's exact rolled
  requirement, then selects one option;
- only the selected option adds its curse intensity, paired blessing, shared
  rarity, and blessing intensity inputs;
- declaration-owned legal starting values make numeric inputs immediately
  complete without requiring the author to touch every slider;
- Denial bans exactly the unselected curse identities while never banning their
  source-generated blessings;
- the launcher identifies a missing or selected Chaos outcome instead of
  presenting one mixed ordinary-trait dropdown;
- a later ordinary god offer affected by Rejected exposes and enforces its one
  exact blocked row;
- Save remains one complete `ReplaceTraitOffer` command and Undo restores the
  prior complete child;
- Transcendent Embryo remains its own direct-blessing authoring surface while
  its equipped/removed blessing correctly affects later Chaos eligibility; and
- Trial Upgrade no longer becomes an Echo Reward Reward Reward source.

A persisted schema change is required. The schema-65
`AuthoredChaosTraitOffer` stores only one selected pair and cannot express
Denial's peer-curse bans.

## Source facts and current authorities

The durable source authorities remain:

- `docs/audits/traits/CHAOS_TRAIT_GAME_DATA_AUDIT.md` for paired Trial Upgrade
  offers, pair rarity, operands, prerequisites, clocks, and the explicit fact
  that Trial Upgrade is not an Echo Reward Reward Reward source;
- `docs/audits/loadout-and-progression/KEEPSAKE_GAME_DATA_AUDIT.md` for
  Transcendent Embryo's rank-scaled direct blessing and eight-encounter
  transformation;
- `docs/audits/loadout-and-progression/CHERISHED_HEIRLOOM_KEEPSAKE_AUDIT.md`
  for the special advance that deliberately preserves Embryo's current
  blessing while an ordinary swap detaches it; and
- `docs/audits/loadout-and-progression/ECHO_GIFT_GIFT_GIFT_KEEPSAKE_AUDIT.md`
  for the unslotted Common Embryo replay.

The source game displays up to three already-paired alternatives. Each button's
processed identity is its curse; the blessing remains nested below that curse.
Denial therefore observes and bans only the two unselected curses. The planner
persists the three curse identities and requirements but only the selected
pair's blessing and intensities. The two peer blessings and their numeric rolls
remain game-generated because they never enter planner-owned run state.

## Current-code audit against the historical plan

| Responsibility                                                                                                   | Current state at `0985bbd3`                                                                     | Amended disposition                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Complete Chaos declarations and Trial Upgrade provider binding                                                   | Landed in the catalog and compiler                                                              | Keep the pools; add catalog-owned legal numeric starting values and requirement-unit labels                           |
| Authored Chaos outcome, strict codec, command, and migration                                                     | Schema 65 stores one selected pair                                                              | Replace with three ordered curse options plus one selected complete outcome; bump and migrate schema                  |
| Selected settlement, active curse, pending blessing, clocks, maturation, Creation/Favor/Ordinary/Rejected/Barren | Landed and engine-tested                                                                        | Preserve selected settlement; add Denial's exact peer-curse bans                                                      |
| Chaos Run State                                                                                                  | Landed in the engine and current Run State sheet                                                | Keep one engine-owned projection; expose peer bans through existing banned-trait state                                |
| Pair candidate domains                                                                                           | Private `TraitOfferCandidateCapability.chaosPairDomains` covers only one curse/blessing request | Replace with one offer domain covering three independently legal curse options and the selected blessing outcome      |
| Trait Offer interaction                                                                                          | Concatenates all Chaos curses and blessings into one generic `choices` list                     | Stop projecting generic ordinary choices and expose one dedicated Chaos interaction                                   |
| Missing and migrated Chaos state                                                                                 | New offers are unresolved; old complete pairs lack peer curses                                  | Use a local complete draft; migrate old pairs to a legal triple-repeated-curse envelope that preserves prior behavior |
| Chaos Trait Offer dialog                                                                                         | `TraitOfferEditorShell` renders no `chaos` form                                                 | Add the three-column curse/requirement table and selected-outcome detail below it                                     |
| Timeline launcher                                                                                                | Authored and missing Chaos children use generic trait wording                                   | Use `Choose Chaos outcome` and `Edit Chaos outcome - <blessing>`                                                      |
| Rejected authoring                                                                                               | Engine persists and validates `rejectedOptionKey`, but React exposes no blocked-row control     | Project the existing active rule and render one exact row control                                                     |
| Finding focus, Save, and Undo                                                                                    | Address, dialog, intent, and history machinery already exist                                    | Reuse them; Save remains one complete `ReplaceTraitOffer` command                                                     |
| Echo Trial Upgrade and ordinary Embryo detach                                                                    | Corrected and tested in completed Gate A `0985bbd3`                                             | Preserve; do not reopen in later gates                                                                                |

There is no current focused Chaos editor UI test. Existing tests stop at the
engine selected-pair capability. The invalid `g-tail-chaos-timepiece-echo`
checkpoint was retired in completed Gate A and must not return as the editor
witness.

## Transcendent Embryo integration analysis

Embryo is not another `TrialUpgrade` offer. Its authored result is one direct
blessing identity:

- ordinary equip grants the declaration/rank-derived rarity;
- Gift Gift Gift grants a Common direct blessing;
- the blessing enters `maturedChaosBlessings` immediately and therefore may
  satisfy the prior-matured-blessing requirement of a later Defiance blessing
  or Barren curse;
- fixed-rarity Defiance remains excluded from Embryo's own random blessing
  pool, so Embryo does not need a shared-rarity, curse, duration, or operand
  form;
- a reached transformation removes only the marked direct blessing, selects
  the replacement against the history with that exact instance excluded, and
  installs the replacement as a new direct mature instance; and
- Cherished Heirloom preserves the current direct blessing and counter while
  changing the rarity of the later transformation.

Gate A completed the ordinary-rack correction in `0985bbd3`: a successful
ordinary replacement appends the marked `directChaosBlessingRemoval` before
later state observes history, while Cherished Heirloom and Gift Gift Gift keep
their distinct retain paths. The tests cover Creation reversal and removal of
the only mature prerequisite for later Defiance/Barren eligibility.

The Chaos editor consumes only the resulting pre-offer history. It must not
inspect keepsake state or gain an Embryo-specific condition.

## Modeling shape to preserve

### Persisted outcome

Replace the selected-pair value with this complete authored shape:

```text
kind = chaos
giverKey = Chaos
curseOptions = [
  { curseKey, requirementCount },
  { curseKey, requirementCount },
  { curseKey, requirementCount },
]
selectedOptionKey = option1 | option2 | option3
selectedCurseValues by the selected curse declaration's keys
blessingKey
shared rarity
blessingValues by the selected blessing declaration's keys
```

`requirementCount` is one integer whose presentation unit comes from the curse
declaration: qualifying encounters, locations/departures, or god-offer
resolutions. Curse identities may repeat in any columns. Only the selected
curse owns independent intensity values and one paired blessing; the two peer
blessings and all peer intensities remain game-generated.

The schema-65 migration repeats the old selected curse and duration across all
three curse options, selects `option1`, and preserves the old curse values,
blessing, rarity, and blessing values. Triple repeated curses and equal rolled
requirements are source-legal. Because Denial skips peer buttons whose curse
name equals the selected curse, this migration preserves the old plan's
no-peer-ban behavior without inventing a new restriction or losing the
selected outcome.

The project does not store the two unselected blessings, a random seed, a
maturation coordinate, or a separate Embryo/Chaos link.

### Candidate and application boundary

Expose one typed Chaos-offer domain at the existing exact `TraitOfferAddress`.
It accepts a partial local draft and returns the branch-local support required
to project:

- the legal curse identity domain independently for each of three columns;
- each chosen curse's requirement range, unit, and legal starting value;
- the selected curse's independent intensity descriptors and starting values;
- the blessing domain for the selected curse/context;
- shared rarity after the selected curse and blessing are known; and
- the selected blessing's rarity-shaped independent intensity descriptors and
  starting values.

Every numeric domain publishes a catalog-owned authoring default: the midpoint
of its legal minimum/maximum snapped to the nearest declared step, with an
exact half-step rounded upward. This is a planner convenience, not a game-data
probability claim. The catalog/compiler owns and validates the default; React
does not calculate it.

The application adapts those facts into contextual picker models and scalar
field descriptors. Retained invalid authored identities remain pinned for
repair. React does not read the catalog, inspect trait history, recognize
`Barren`, `Defiance`, or Embryo by key, or calculate rarity/operand legality.

An unresolved Chaos child uses a transient UI draft with optional fields, as
the current Echo last-run compound editor already does. Incomplete values stay
inside the open dialog. Save requires all three curse options, their
requirements, one selected option, and one complete selected outcome. It
rejects an exact reached candidate assessed as impossible; unavailable
upstream coverage does not erase an otherwise structurally authorable outcome.

Choosing a curse initializes its requirement from the published default.
Changing an unselected curse changes only that column. Changing the selected
curse or selected option resets only incompatible selected-curse intensity and
pair-dependent rarity/blessing intensity fields to their published defaults;
it retains the blessing identity when that identity remains legal. No local
edit dispatches an intermediate project command.

Do not create a generic form engine or numeric-slider DSL. A focused
Chaos-domain query, one workspace interaction product, and one nearby React
editor are the complete required surface.

### Editor form

The specialized form first renders the symmetric source envelope:

|             | Option 1                                | Option 2                                | Option 3                                |
| ----------- | --------------------------------------- | --------------------------------------- | --------------------------------------- |
| Selected    | radio                                   | radio                                   | radio                                   |
| Curse       | contextual picker                       | contextual picker                       | contextual picker                       |
| Requirement | exact count plus declaration-owned unit | exact count plus declaration-owned unit | exact count plus declaration-owned unit |

Below that table, one selected-outcome section renders:

1. only the selected curse's independent intensity fields;
2. the selected blessing picker;
3. shared rarity;
4. only the selected blessing's independent intensity fields;
5. complete-offer feedback and Save.

Fixed or derived results such as Creation element count, Celerity movement,
Chant's per-Aether result, and Defiance's fixed effect may be summarized but
must not receive fabricated inputs. Numeric controls use the declaration's
exact minimum, maximum, step, default, and rarity-specific range. The UI may
label one independent operand as “Intensity” or “Amount”; multiple operands
retain their declaration labels instead of being collapsed into one slider.

### Rejected ordinary-offer control

Add the already-computed `chaosOfferRules` facts to the existing complete
trait-offer candidate result instead of introducing another replay/query path.
The workspace exposes whether a block is required and the exact blockable
option keys. React shows a compact mutually exclusive Rejected selector only
when the current frontier requires it or a retained `rejectedOptionKey` needs
repair.

The blocked option stays visible, contributes to seen/Denial history, cannot be
selected, and cannot receive Rarify. A missing, selected-equals-blocked, or
stale retained key remains visible and finding-backed until the author changes
the exact selection or block. React does not infer Rejected from a finding or
Run State label.

## Delivery gates and intended commits

### Gate A - correct recovered Chaos interaction facts (completed)

Deliver the two source-authority corrections found by this audit:

- remove Trial Upgrade's `lastRewardRecreation` declaration and update the
  catalog's exact Echo-eligible acquisition closure;
- replace the invalid Echo Trial Upgrade engine witness with a focused test
  that Trial Upgrade does not replace the prior eligible last-reward source;
- retire the `g-tail-chaos-timepiece-echo` checkpoint and its manifest/loaders
  unless a shorter truthful scenario gives it a distinct remaining purpose;
- on an ordinary rack replacement of Transcendent Embryo, append the exact
  marked `directChaosBlessingRemoval` before later state observes history;
- preserve Cherished Heirloom's special retain path and Gift Gift Gift's
  unslotted lifecycle; and
- prove removal reverses direct Creation elements and removes the only mature
  prerequisite for a later Defiance/Barren pair.

Intended commit:

```text
fix(chaos): align replay and Embryo lifecycle
```

Primary owners are the catalog reward-lifecycle test, the keepsake rack
transition suite, the Transcendent Embryo simulation suite, and one focused
later-Chaos candidate witness. This gate landed as `0985bbd3` after independent
review with no actionable findings.

### Gate B - author the Chaos offer envelope and selected outcome

Deliver one complete engine-to-React vertical slice:

- add and normalize legal catalog-owned midpoint defaults plus the requirement
  unit for every Chaos numeric domain;
- bump the authored schema and replace the selected-pair value with three
  ordered curse/requirement options, one selected option, and one complete
  selected curse/blessing outcome;
- migrate schema 65 by repeating the old curse/requirement into all three legal
  options while preserving the selected values and no-peer-ban behavior;
- keep one complete `ReplaceTraitOffer` command and strict normalization for
  new authored values;
- settle only the selected pair, but when Denial is active fold the exact
  unselected curse identities into later eligibility; never ban an unselected
  blessing;
- cover repeated-curse behavior: a peer matching the selected curse is skipped,
  while repeated unselected curses collapse to one distinct banned identity;
- expose the complete Chaos-offer domains through the prepared candidate
  session;
- project a dedicated workspace Chaos interaction with three contextual curse
  pickers/requirements and the selected curse, blessing, rarity, and intensity
  descriptors;
- stop giving Chaos the combined generic ordinary-trait choice list;
- add the symmetric three-column local-draft editor and selected-outcome detail
  section under the existing Trait Offer dialog;
- correct missing/authored launcher labels and exact finding focus;
- initialize numeric fields from the catalog-owned legal defaults, reset only
  declaration-incompatible values, and require one complete offer for Save;
- use reached candidate support without treating unavailable upstream coverage
  as an impossible offer;
- dispatch one `ReplaceTraitOffer` and prove one-step Undo; and
- prove an equipped Embryo blessing makes Barren available in the curse picker,
  while a pending Trial Upgrade blessing and an ordinarily removed Embryo
  blessing do not.

Intended commit:

```text
feat(planner): author Chaos offer outcomes
```

Primary owners are the catalog Chaos declaration/default test, authored codec
and migration tests, Chaos settlement/Denial tests, a focused engine
candidate-session test, the structured-workspace interaction test, and one
React editor test. The Denial owner must prove the exact selected/peer-duplicate
matrix; application tests retain only one representative contact. The existing
`natural-chaos-unresolved-trial` checkpoint is the real product witness; do not
add another long route fixture.

### Gate C - expose Rejected row locking

Deliver the ordinary-offer consequence at its existing owner:

- include the active Chaos offer rules in complete trait-offer candidate
  evaluation;
- project the exact required/repair block domain through the existing ordinary
  trait-offer interaction;
- render the blocked-row selector and disable selected/Rarify actions for that
  row; and
- prove missing, repaired, retained-invalid, Save, and Undo behavior without
  copying the engine's full Rejected/Denial matrix into React tests.

Intended commit:

```text
feat(planner): expose Rejected option locking
```

The complete semantic matrix remains owned by
`packages/planner-engine/test/simulation/chaos-traits.test.ts`; application
tests retain only representative interaction and UI witnesses.

### Gate D - durable absorption and closure

After implementation and independent review are stable:

- update the Chaos audit's planner disposition to name the completed editor
  and corrected Echo/Embryo contacts;
- update the keepsake audit only with the implemented ordinary-detach
  disposition, preserving source evidence;
- update `docs/design/CANDIDATE_EVALUATION_MODEL.md` with the narrow Chaos offer
  domain and Rejected projection boundary;
- record truthful gate and validation results in
  `docs/progress/IMPLEMENTATION_PROGRESS.md`;
- delete this temporary plan; and
- run the one complete repository closure gate required by repository policy.

Intended commit:

```text
docs(chaos): close authoring recovery
```

## Verification and review

Use narrow lanes during implementation:

- Gate A completed its focused catalog reward-lifecycle, reward-kernel/Echo,
  Embryo, rack, fixture-integrity, and Chaos candidate lanes before commit;
- Gate B: focused catalog default, codec/migration/command, Chaos
  settlement/Denial, candidate-session, interaction, and Chaos editor tests,
  then `npm run test:catalog`, `npm run test:engine`, `npm run test:planner`,
  `npm run test:contract`, and `npm run test:ui` once after review remediation;
- Gate C: focused Chaos semantic and ordinary trait-editor tests, then the same
  affected planner/UI lanes; and
- Gate D: one `npm run check` at phase closure.

Each implementation gate receives a fresh executor and a fresh independent
reviewer under the repository's gate routine. The main session retains final
review ownership for dependency direction, schema-migration fidelity, exact
curse-only Denial bans, absence of UI-side game rules, one-command history,
test ownership, and production growth.

## Explicit non-goals and retirement requirements

Excluded from this recovery:

- authoring the two unselected blessings, their rarities, or their intensity
  values;
- probabilities, RNG seeds, or curse-repeat odds;
- implementing the later game-module hook that reserves the authored selected
  blessing while vanilla fills the two peer blessings;
- natural-Chaos topology, map, or continuation changes;
- a generic trait-effect form language;
- a shared Chaos/Embryo editor;
- manual Embryo rarity or operand authoring;
- Expiring's timer/damage branch or other simulation-neutral effects; and
- reconstructing Run State or eligibility in the application.

The completed implementation must retire:

- the mixed Chaos curse/blessing `choices` projection;
- the empty `chaos` fallthrough in `TraitOfferEditorShell`;
- generic `Choose Trait` launcher wording for Trial Upgrade;
- the schema-65 selected-pair-only Chaos value and its single-pair candidate
  surface.

Gate A already retired Trial Upgrade's Echo last-reward declaration, invalid
replay fixture/test ownership, and the ordinary Embryo swap path that failed to
detach its marked direct blessing.

No parallel command, address, candidate session, trait history, or picker
framework is permitted.
