# Editor Control System Cleanup Plan

## Status and base

- Status: locked for implementation
- Base commit: `7c242463fd1d06d0ed9c60d33fa40c9f971f5ffc`
- Ownership: planner application projections and React presentation only
- Intended delivery: three focused Conventional Commits plus closure absorption

## Objective

Give the current planner one coherent command-button hierarchy and one explicit
rule for choosing between the shared contextual picker and a native scalar
select. The finished editor should look intentional without making unrelated
controls visually identical or moving candidate policy into React.

This is presentation and application-product cleanup. It does not change game
rules, authored commands, persisted state, simulation, candidate semantics, or
which outcomes may be authored.

## Grounded inventory

At the base commit, production React contains:

- 90 `<button>` sites across 37 UI files;
- 34 native `<select>` implementations across 11 UI files;
- 21 `ContextualPicker` uses across 10 UI files; and
- 10 buttons with no explicit control class.

The existing action vocabulary is `primary-action`, `secondary-action`,
`success-action`, `danger-action`, and `quiet-action`. Navigation tabs, panel
navigation, semantic focus links, findings, rail nodes, picker triggers, and
timeline launchers already have specialized interaction treatments.

## Locked control policy

### Command buttons

Command buttons use four semantic treatments:

| Treatment | Meaning                                                                      | Representative controls                                     |
| --------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Primary   | The one commit or forward action in a local scope                            | Save, Start biome, Open next room                           |
| Secondary | A reversible supporting mutation that is not the primary action              | Add feature, Restore, Rarify                                |
| Quiet     | Dismissal, navigation, history, ordering, or low-emphasis local draft repair | Cancel, Close, Undo/Redo, move, inspect, clear local result |
| Danger    | Remove authored structure or replace/discard a project or recovery snapshot  | Remove feature, New, Load, Discard autosave                 |

`success-action` is retired. Its two `Open next room` uses become primary; green
remains status language rather than a second forward-action hierarchy.

Specialized navigation and selection surfaces keep their own treatment:
route and workbench tabs, panel navigation, rail/completion nodes, semantic
focus links, findings, contextual-picker triggers/disclosures, trait/timeline
launchers, and icon-only ordering/removal controls. They share the existing
focus and disabled conventions but do not receive a command tone merely
because their HTML element is a button.

Every production `<button>` must therefore carry either one command treatment
or one named specialized-surface class. Styling through an unnamed ancestor
selector alone is not sufficient.

### Contextual picker

Use `ContextualPicker` when the user is selecting a domain identity and at
least one of the following is true:

- the values need search or semantic grouping;
- run context can make values required, impossible, or unassessed;
- per-value explanations or unavailable inspection matter;
- a retained invalid selection needs an explicit repair path; or
- the choice is a staged or compound interaction.

The application projection owns the complete picker model, grouping, labels,
candidate status, and explanations. React owns only accessible opening,
search, traversal, disclosure, draft progress, and dispatch of the selected
intent.

Rarity remains contextual despite its small cardinality because it carries
candidate evidence and retained-invalid repair.

### Native scalar select

Use a native select only when the domain is small, flat, and closed; the value
is a scalar parameter of an already identified object; and no search,
grouping, per-value explanation, or rich retained-invalid repair is needed.

The existing `CandidateSelect` remains the focused exception for compact
candidate-backed parameters. Its current uses stay native: reward pool/store,
Fields roll, Ephyra generation state, reward-wheel store/count/picked index,
and Ship combat phase count. Candidate backing alone does not require a
popover.

Other native controls that remain native include counts, ranks, delivery
delays, insertion/visit order, route extent, weapon/aspect, map choice,
Nemesis family/response/contest result/reward enum, pickup-conversion mode,
and independent boolean checkboxes.

## Included migrations

The following identity controls move from native selects to the shared
contextual-picker presentation:

- starting and postboss keepsakes;
- Experimental Hammer result;
- Jeweled Pom Hades trait;
- Transcendent Embryo Chaos blessing;
- Pool of Purging trait;
- Stygian Well item and Twist result;
- Hermes Shrine reward identity; and
- Nemesis trait-trade target.

These changes reuse the existing interaction domains and candidate sessions.
Where React currently joins choices and candidate results itself, the nearest
application interaction/presentation owner must return the complete picker
model. Stable room-feature lists receive a narrow application-owned picker
projection; they do not gain fabricated simulation queries.

Persephone level bonus moves in the opposite direction. Its `+0` through the
active maximum domain is a flat scalar select. Selecting `+0` continues to
remove `persephoneLevelBonus`; nonzero values remain frozen on the authored
offer. The React-local `persephoneBonusPicker` model is deleted.

## Explicit exclusions

- no generic `Button`, universal form-field wrapper, design-system package, or
  dependency-injection surface;
- no replacement of every native select;
- no changes to contextual-picker candidate semantics or engine queries;
- no authored schema, codec, migration, catalog, simulation, or command change;
- no broad accessibility, typography, spacing, color-palette, or responsive
  redesign;
- no confirmation dialogs or command-specific deletion-scope computation; and
- no conversion of checkboxes, radio groups, tabs, findings, or navigation
  controls merely for visual uniformity.

## Gate A — Command hierarchy and button closure

Normalize the command-button vocabulary in React and CSS.

Deliverables:

- replace both `success-action` call sites with `primary-action` and delete the
  retired CSS treatment;
- classify all ten unclassified buttons, including Save Nemesis event,
  add/remove Nemesis, resource add/move/remove, Restore required action,
  Rarify, Return to traits, popup/sheet close controls, and Findings;
- use Secondary for additive/restorative actions, Danger for actual removal,
  Primary for the scoped commit/advance action, and Quiet for dismiss/navigation;
- give Findings its own explicit specialized navigation class instead of
  relying only on `.findings-list button`; and
- add a planner architecture test that fails when a production button has no
  explicit class. The test enforces classification presence, not semantic
  correctness inferred from button text.

Primary test owners:

- focused React interaction tests beside the changed controls;
- the planner architecture suite for unclassified-button prevention; and
- `npm run test:ui` plus `npm run lint` for the gate.

Intended commit: `refactor(planner): unify editor button hierarchy`

## Gate B — Keepsake and route identity pickers

Move the duplicated route/room keepsake-effect identity controls onto the
shared contextual-picker seam.

Deliverables:

- contextual starting and postboss keepsake selectors;
- contextual Experimental Hammer, Jeweled Pom, and Transcendent Embryo result
  selectors in every route and room location where they appear;
- application-owned models preserve lazy candidate activation, selected-invalid
  retention, labels, explanations, and the existing semantic intents;
- duplicate React-side candidate joining is removed rather than wrapped; and
- no `CandidateSelect` parameter control is migrated in this gate.

Primary test owners:

- route overview/workspace interaction tests for starting equipment;
- biome inspector/workspace tests for postboss equipment;
- contextual-picker tests retain one representative lazy-loading and
  selected-invalid witness; and
- `npm run test:planner` for the gate.

Intended commit: `refactor(planner): contextualize keepsake identity choices`

## Gate C — Room-feature identities and scalar correction

Finish the policy at the remaining misclassified room-feature and trait-offer
surfaces.

Deliverables:

- contextual Pool of Purging trait, Stygian Well item/Twist, Hermes Shrine
  reward, and Nemesis trait-trade selectors;
- native Persephone bonus select with an absent-property `+0` witness;
- declaration-stable room-feature domains use application-owned searchable
  models without new simulator work;
- selected stale room-feature identities remain visible for explicit repair;
- simple Nemesis family/response/result/reward selectors and Hermes delivery
  delay remain native; and
- delete superseded React-local picker-model and direct option-joining code.

Primary test owners:

- `OccurrenceRoomFeatures`, Hermes Shrine, Stygian Well, Nemesis editor, and
  trait-offer UI tests own their exact interaction matrices;
- one App interaction witness proves a contextual room-feature identity still
  dispatches the existing semantic command; and
- `npm run test:planner`, `npm run test:contract`, and `npm run lint` for the
  gate.

Intended commit: `refactor(planner): align identity and scalar selectors`

## Closure

After all three gates:

- absorb the four-button hierarchy and picker/select decision rule into
  `docs/design/EDITOR_MODEL.md` and the contextual identity boundary into
  `docs/design/CONTEXTUAL_EDITOR_UX.md`;
- remove this temporary plan;
- update the durable progress record only with the completed product outcome,
  not a list of individual control migrations;
- perform the final bird's-eye diff review for application ownership,
  superseded-path deletion, semantic-class accuracy, focus restoration,
  selected-invalid repair, and production growth; and
- run one complete `npm run check` closure gate after narrow lanes and review
  fixes are stable.

Intended commit: `chore(planner): close editor control cleanup`

## Acceptance

- every production button has one explicit semantic or specialized-surface
  class;
- each visible action has one hierarchy role, with no `success-action` left;
- all identity migrations listed above use the shared contextual picker and
  preserve their existing authored commands;
- the listed scalar/parameter controls remain native rather than being
  mechanically converted;
- Persephone `+0` remains semantically absent and requires no React-local
  contextual model;
- impossible or stale selected identities remain visible and repairable;
- opening contextual selectors remains the deliberate lazy-evaluation boundary;
- React does not calculate candidate support or synthesize game eligibility;
- no schema, catalog, engine, simulation, or persistence files change; and
- the complete closure check passes once, after focused gate validation.
