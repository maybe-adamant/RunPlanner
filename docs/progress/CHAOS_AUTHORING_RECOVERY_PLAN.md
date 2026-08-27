# Chaos Authoring Recovery Plan

## Status

Locked implementation plan, grounded on clean base
`2d91d21a87ed1a2c9b96eed46de47a2892437296` on 2026-08-27 and authorized for
execution on the same date.

The historical Chaos plan at `6073f5b2` correctly specified a specialized
selected-pair editor, but only its engine-heavy Gate A landed in `bea2e5bf`.
The later cleanup commit `3b6fa521` removed that temporary plan as if the
application gate were complete. This document recovers only the still-useful
contract and rewrites it against the current schema-65 candidate session,
structured workspace, editor components, and Transcendent Embryo lifecycle.
It does not restore the obsolete 709-line plan verbatim.

## Objective and user-visible outcome

Finish the authoring surface for the already-persisted `TrialUpgrade` Chaos
outcome without changing the selected-pair model:

- an unresolved Trial Upgrade opens one specialized Chaos editor;
- the author chooses one curse, one blessing, their shared rarity, the rolled
  curse duration, and only the numeric values declared by those two identities;
- the launcher identifies a missing or selected Chaos outcome instead of
  presenting one mixed ordinary-trait dropdown;
- a later ordinary god offer affected by Rejected exposes and enforces its one
  exact blocked row;
- Save remains one complete `ReplaceTraitOffer` command and Undo restores the
  prior complete child;
- Transcendent Embryo remains its own direct-blessing authoring surface while
  its equipped/removed blessing correctly affects later Chaos eligibility; and
- Trial Upgrade no longer becomes an Echo Reward Reward Reward source.

No persisted schema change is required. The existing `AuthoredChaosTraitOffer`
is the intended durable shape.

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

The source game displays up to three already-paired alternatives. The planner
continues to persist only the one selected outcome. Separate curse and blessing
controls are an authoring projection of that selected pair, not a claim that
the game grants two independent sequential choices.

## Current-code audit against the historical plan

| Historical responsibility                                                                                            | Current state                                                                                                            | Recovery disposition                                                                                |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Complete Chaos declarations and Trial Upgrade provider binding                                                       | Landed in the catalog and compiler                                                                                       | Keep; no catalog-pool redesign                                                                      |
| Closed authored pair, strict codec, whole-pair command, and schema migration                                         | Landed; current schema is 65                                                                                             | Keep; no schema bump or compatibility layer                                                         |
| Pair settlement, active curse, pending blessing, clocks, maturation, Creation/Favor/Ordinary/Rejected/Barren effects | Landed and engine-tested                                                                                                 | Keep; do not reopen the consequence matrix                                                          |
| Chaos Run State                                                                                                      | Landed in the engine and current Run State sheet                                                                         | Keep; add no second app-owned history projection                                                    |
| Pair candidate domains                                                                                               | Landed only as private `TraitOfferCandidateCapability.chaosPairDomains`                                                  | Expose through the prepared candidate session and workspace interaction                             |
| Trait Offer interaction                                                                                              | Still concatenates all Chaos curse and blessing keys into one generic `choices` list                                     | Stop projecting generic ordinary choices for a Chaos giver                                          |
| Missing Chaos starting state                                                                                         | Generic starting-draft API returns only ordinary `traits` drafts                                                         | Let the specialized editor hold an incomplete local pair draft; do not persist a fabricated default |
| Chaos Trait Offer dialog                                                                                             | `TraitOfferEditorShell` renders `fallbackGold` and `traits`; `chaos` renders no form                                     | Add one nearby specialized editor under the existing dialog/command owner                           |
| Timeline launcher                                                                                                    | Authored and missing Chaos children both fall through to `Choose Trait`-style wording                                    | Use `Choose Chaos outcome` and `Edit Chaos outcome - <blessing>`                                    |
| Rejected authoring                                                                                                   | Engine persists and validates `rejectedOptionKey`, but React exposes no blocked-row control and does not disable the row | Project the existing active rule and render one exact row control                                   |
| Finding focus, Save, and Undo                                                                                        | Address, dialog, intent, and history machinery already exist                                                             | Reuse them; no new navigation or command framework                                                  |
| Echo Trial Upgrade witness                                                                                           | Historical plan required it, and the current catalog/test fixture still models it                                        | Remove it: this contradicts the later source correction and durable Chaos audit                     |
| Transcendent Embryo                                                                                                  | Added after the historical plan with separate equip/transformation pickers                                               | Keep separate, correct ordinary detach, and add later-Chaos eligibility contact tests               |

There is no current focused Chaos editor UI test. Existing tests stop at the
engine pair capability. The current `g-tail-chaos-timepiece-echo` checkpoint
and engine test instead preserve an invalid historical assumption and must not
serve as the recovered editor witness.

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

The current direct grant and transformation fold are sound. The missing
integration is ordinary rack replacement: `applyKeepsakeDisposition` clears
the Embryo keepsake state, but `keepsake-rack-used.ts` does not append the
matching `directChaosBlessingRemoval` event before installing the replacement
keepsake. That can leave the old blessing in `maturedChaosBlessings`, retain
Creation elements, and keep later Defiance/Barren eligibility after the source
was ordinarily removed. The existing test named as an unequip case observes
only the keepsake state and does not exercise the full rack chronology.

The correction belongs to the rack lifecycle transition and shared trait
history fold. The Chaos editor consumes only the resulting pre-offer history;
it must not inspect keepsake state or gain an Embryo-specific condition.

## Modeling shape to preserve

### Persisted outcome

Keep the current complete authored value:

```text
kind = chaos
giverKey = Chaos
curseKey
duration
curseValues by declaration-owned key
blessingKey
shared rarity
blessingValues by declaration-owned key
```

The project never stores the two unselected alternatives, a picker step, a
random seed, a maturation coordinate, or a separate Embryo/Chaos link.

### Candidate and application boundary

Expose one typed Chaos-pair domain at the existing exact `TraitOfferAddress`.
It accepts the current optional curse/blessing identities and returns the
branch-local support required to project:

- curse identities;
- blessing identities;
- shared rarity after the selected identities are known;
- the selected curse's duration range;
- the selected curse's independent operand descriptors; and
- the selected blessing's rarity-shaped independent operand descriptors.

The application adapts those facts into contextual picker models and scalar
field descriptors. Retained invalid authored identities remain pinned for
repair. React does not read the catalog, inspect trait history, recognize
`Barren`, `Defiance`, or Embryo by key, or calculate rarity/operand legality.

An unresolved Chaos child uses a transient UI draft with optional fields, as
the current Echo last-run compound editor already does. Incomplete values stay
inside the open dialog. Save requires a structurally complete pair and rejects
an exact reached candidate assessed as impossible; unavailable upstream
coverage does not erase an otherwise structurally authorable outcome.
Selecting a different identity clears only values owned by the replaced
declaration; it does not silently reroll unrelated retained fields or dispatch
an intermediate project edit.

Do not create a generic form engine or numeric-slider DSL. A focused
Chaos-domain query, one workspace interaction product, and one nearby React
editor are the complete required surface.

### Editor form

The specialized form follows this order:

1. curse identity;
2. curse duration;
3. only that curse's independently rolled values;
4. blessing identity;
5. shared rarity;
6. only that blessing's independently rolled values; and
7. complete-pair feedback and Save.

Fixed or derived results such as Creation element count, Celerity movement,
Chant's per-Aether result, and Defiance's fixed effect may be summarized but
must not receive fabricated inputs. Numeric controls use the declaration's
exact minimum, maximum, step, and rarity-specific range.

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

### Gate A - correct recovered Chaos interaction facts

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
later-Chaos candidate witness.

### Gate B - author selected Chaos outcomes

Deliver one complete engine-to-React vertical slice:

- expose the private pair domains through the prepared candidate session;
- project a dedicated workspace Chaos interaction with contextual identity and
  rarity pickers plus selected declaration scalar descriptors;
- stop giving Chaos the combined generic ordinary-trait choice list;
- add the specialized local-draft editor under the existing Trait Offer dialog;
- correct missing/authored launcher labels and exact finding focus;
- require a complete local pair for Save and use reached candidate support
  without treating unavailable upstream coverage as an impossible pair;
- dispatch one `ReplaceTraitOffer` and prove one-step Undo; and
- prove an equipped Embryo blessing makes Barren available in the curse picker,
  while a pending Trial Upgrade blessing and an ordinarily removed Embryo
  blessing do not.

Intended commit:

```text
feat(planner): author selected Chaos outcomes
```

Primary owners are a focused engine candidate-session test, the structured
workspace interaction test, and one React editor test. The existing
`natural-chaos-unresolved-trial` checkpoint is the representative real product
witness; do not add another long route fixture.

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
- update `docs/design/CANDIDATE_EVALUATION_MODEL.md` with the narrow Chaos pair
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

- Gate A: focused catalog reward-lifecycle, reward-kernel/Echo, Embryo, rack,
  and Chaos candidate tests, then `npm run test:catalog` and
  `npm run test:engine` once after review remediation because shared catalog
  and engine behavior changes;
- Gate B: focused candidate-session, interaction, and Chaos editor tests, then
  `npm run test:planner`, `npm run test:contract`, and `npm run test:ui`;
- Gate C: focused Chaos semantic and ordinary trait-editor tests, then the same
  affected planner/UI lanes; and
- Gate D: one `npm run check` at phase closure.

Each implementation gate receives a fresh executor and a fresh independent
reviewer under the repository's gate routine. The main session retains final
review ownership for dependency direction, deletion of the invalid Echo path,
absence of UI-side game rules, one-command history, test ownership, and
production growth.

## Explicit non-goals and retirement requirements

Excluded from this recovery:

- changing the selected-pair persisted schema;
- authoring all three generated Chaos alternatives;
- probabilities, RNG seeds, or curse-repeat odds;
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
- Trial Upgrade's Echo last-reward declaration, invalid replay test, and stale
  fixture ownership; and
- any ordinary Embryo swap path that clears keepsake state without detaching
  its marked direct blessing.

No parallel command, address, candidate session, trait history, or picker
framework is permitted.
