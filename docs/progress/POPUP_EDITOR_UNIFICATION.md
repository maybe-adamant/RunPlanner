# Popup editor unification

Status: locked 2026-10-07. Base: `24ef724bf`. No schema change.

## Objective

Every popup editor behaves the same way: one dialog shell, one focus and
close contract, one Reset vocabulary, one findings region, and a commit model
chosen by one rule. Policy that belongs to the engine or projection leaves
React.

## Commit rule

A dialog keeps a local draft and saves once when it edits one atomic authored
value whose intermediate states are not meaningful plans. Otherwise each
control commits immediately, and an ordered sequence inside it uses a staged
popover that commits on Finish.

| Model            | Editors                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Draft, Save once | Trait offer (Chaos, Spell, Concave Stone, All Together, Natural Selection, Echo, Circe nested), Pom, Anvil, Judgment, Crystal Figurine |
| Live per control | Encounter customization, Loadout Arcana and Fear, Hub map room popover, keepsake equip results                                         |

## Decided behavior

- Escape and Close discard an unsaved draft without confirmation.
- A nested editor saves into its parent draft; only the outer Save commits.
- Reset is two actions: "Clear" empties the draft; "Reset to unresolved"
  commits the unresolved value.
- Every draft dialog's open state lives in `editorSession`; it closes when its
  owner leaves the reached context and refreshes its draft when the authored
  value changes underneath, keeping the draft when only context changes.
- History shortcuts are disabled while a draft dialog is open.
- The footer is "Save" and "Cancel" for drafts and "Done" for live editors,
  with no explanatory text.

## Facts

- Draft editors already use complete-value intents and draft-scoped candidate
  capabilities; live editors already publish one command per control.
- The Echo Boon Boon Boon nested Save commits the outer draft
  (`TraitOfferEditorShell.tsx` `onChildCommit`, `TraitOfferEditor.tsx`).
- "Configure in Room Timeline" closes the trait dialog and drops its draft
  (`TraitOfferSelectedOutcome.tsx`).
- Five editors open modals through their own `showModal` effects; the shared
  `shell/ModalDialog.tsx` serves no editor.
- Trait, Pom, encounter and Anvil leave focus on the body after closing.
- Anvil, Circe and Judgment initialize their draft once and do not close on
  context loss.
- Circe has no findings region; Anvil and Judgment render an empty one; Pom
  copies the region and its finding text.
- React holds Pom sibling-duplicate disabling, Pom pristine autofill,
  encounter "Already chosen for another use", Anvil section building and the
  Loadout grasp assessment.

## Gate 1 — silent commits and discards

- The Echo nested Save writes into the trait draft; the outer Save commits.
- "Configure in Room Timeline" is enabled only while the draft equals the
  authored value; otherwise it is disabled with a hover hint.
- Primary tests: `TraitOfferShell`, `TraitOfferSelectedSpecialOutcomes`.
- Commit: `fix(planner): keep nested and navigation edits inside the trait draft`.

## Gate 2 — one editor dialog shell

- One `EditorDialog` primitive replaces the five modal effects and serves
  every popup editor: eyebrow, title, Close; an always-mounted findings region;
  a sticky footer per the decided behavior; Escape as Cancel.
- Initial focus lands on the exact repair control, otherwise the first
  control; focus returns to the launcher after the dialog unmounts.
- Reset splits into "Clear" and "Reset to unresolved".
- History shortcuts are disabled while a draft dialog is open.
- Primary tests: a shell contract test (focus in and out, Escape, footer per
  model, shortcut guard) plus each editor's existing suite.
- Commit: `refactor(planner): host popup editors in one dialog shell`.

## Gate 3 — draft lifecycle

- Anvil, Circe, Judgment and Crystal Figurine move their open state to
  `editorSession`, refresh by the trait rule and close on context loss.
- Arcana activation and keepsake pickers dispatch through `useCommandIntent`.
- Primary tests: `DialogContextTransitions` extended to every draft dialog.
- Commit: `fix(planner): give every draft editor the same lifecycle`.

## Gate 4 — policy out of React

- Pom sibling-duplicate legality, Pom pristine autofill, encounter "Already
  chosen for another use", Anvil sections and the Loadout grasp assessment come
  from engine capabilities or projections; React renders them.
- Engine work stays in its owning query; the planner adapts it.
- Primary tests: engine capability tests and projection tests; editor suites
  keep representative witnesses.
- Commits: engine first where needed, then planner.

## Gate 5 — findings regions

- Circe gains the shared region; Anvil and Judgment show their real entries;
  Pom uses the shared region and shared finding copy.
- Primary tests: each editor's region witness and the launcher-finding
  invariant.
- Commit: `fix(planner): show inner findings in every draft editor`.

## Gate 6 — outcome block, labels and layout

Slices, each its own commit:

1. Anvil feedback reads the engine draft assessment (`assess`); Save stays
   gated on completeness only.
2. The Echo Reward Reward Reward outcome is removed: its findings and markers
   point at the Timeline pickup row that carries the replay, then the fieldset,
   its feedback member and producer, and the Configure equality wiring go.
3. One selected-outcome block: heading "Selected outcome · {trait}", then one
   labelled row per choice; no repeated trait name, legends or explanatory
   text.
   - Target traits, Echo Pom Pom Pom, Latest Model ("Hammer 1", "Hammer 2"):
     picker rows.
   - Circe: one row whose trigger opens the card board.
   - Echo Boon Boon Boon: one row opening the nested view, which loses its
     eyebrow, explanation and Back button.
   - Concave Stone: one row with the Activated checkbox and the target picker,
     disabled until activated; the chosen option's follow-ups are rows
     beneath.
   - Chaos: Blessing and Rarity picker rows, then one slider row per value,
     curse values first.
   - Hex: rows unchanged under the shared heading.
   - Ransom: a read-only "Effect" row.
   - All Together and Natural Selection keep their staged pickers here.
4. All Together and Natural Selection per-row pickers replace the staged
   "Choose all" popovers, reviewed against slice 3 by screenshot before
   either is kept.
5. All Together grants show catalog labels, not keys.
6. Owner-reviewed minor layout adjustments per editor.

## Exclusions

- Encounter customization keeps live commits.
- No draft persistence across close, no dirty-state confirmation.
- Read-only sheets and navigation popovers (Run State, room maps, Hub
  Timeline markers) are out of scope.

## Closure

Run `npm run test` and `npm run check` after Gate 6. Promote the commit rule
and dialog contract to `docs/design/` and delete this plan.
