# Editor feedback layers

Status: locked 2026-10-04. Base: `eb158b7c`. Closes the timeline and workbench
text layout audit in full; its investigation is deleted at closure.

## Objective

Every editing surface follows one feedback policy, so text never moves a
control while the user edits:

- Outer layer: the findings panel and timeline badges carry one finding per
  dialog owner, worded as attention plus navigation to the control that opens
  the editor. Inner detail is not published outward as separate findings.
- Inner layer: every inner editor (trait offer, Pom, Circe, Echo, Chaos, Anvil,
  encounter composition and customization, Arcana activation) has exactly one
  feedback region at its bottom, always mounted with a minimum height and an
  empty state. Controls inside carry only an invalid marker and hover title;
  explanations and draft feedback live in the region; entries navigate to the
  control they correct (the existing inner-owner focusing already does this).
- Row stability: a control whose declaration exists is always mounted and only
  enabled by evaluation. New rows or sections created by an authored decision
  are expected. Text standing where a control would be uses `control-placeholder`.
  Action rows render fixed slots, disabled with hover when no proposal applies.
- Accepted as policy: status badges change text width inside a pill; shell
  surfaces (game panel, release notices, bug report, fault boundary) are out of
  scope; the resource placement disclosure stays beside its checkbox.
- The biome feedback-context banner moves into the findings panel as the
  blocked-view entry; the workbench no longer shifts.

## Ownership

Engine: no finding-policy change. `finding-regions.ts` already groups inner
trait owners under their offer; the projection collapses on those regions.

Application projection (`apps/planner/src/projections`): `evaluationProjection.ts`
publishes one outer entry per dialog owner region and the blocked-view entry;
inner findings are exposed only to the owning dialog's feedback model
(`traitProjection`, `generated-encounter-projection`, Pom feedback). The
`presentBiomeFeedbackContext` banner product is retired.

UI (`apps/planner/src/ui/editor`, `ui/shell`):

- Dialogs: `TraitOfferEditorShell` (feedback region always rendered incl. spell
  offers; "Rejected blocked row" fieldset always mounted when its domain exists;
  Ransom and Natural Selection messages via `onFeedback`; effective rarity and
  level list mounted with placeholders), `TraitOfferEchoLastRunBoon` (nested
  form gets a feedback region), `TraitOfferSelectedSpecialOutcomes` and
  `ArcanaActivationEditor` and `TraitOfferCirceResolution` (loaders hold height),
  `PomResolutionEditor` ("Route state" picker always mounted),
  `EncounterCompositionControl` (Findings section always mounted),
  `EncounterPhaseControl`, `CocoonCountControl`, `CocoonRewardPointControl`,
  `InfiniteRosterControl` (inline "Needs repair" removed).
- Rows: `RoomActionInlineEditors` (Sea Star checkbox always mounted),
  `HubFountainControls` (Phial row always mounted; needs a projected pending
  control from `hub-assembly.ts` when the rarity assessment is absent),
  `BiomeInspectorControls` (Keepsake Rack picker disabled instead of span),
  `AdditionalExitControls` (position span removed), `RouteOverview` (slider
  error on hover and `aria-description`), `RouteResourcesPanel` (repair reasons
  dropped), `HubMembershipBoard` and `HubRoomCards` (reward slot shell),
  `NemesisEventEditor` (fixed reward span and row hint take the shell).
- Action rows: `RoomActionOrderingControls` and the Door Exit action row in
  `DecisionWorkbench` render fixed slots.
- `RouteWorkspace` banner removed.

Docs: `STRUCTURED_EDITOR_WORKSPACE.md` gains one "Feedback layers" paragraph
replacing the scattered sentences; `EDITOR_MODEL.md` finding navigation
paragraph updated; `docs/testing/EDITOR_LAYOUT_LIVE_ACCEPTANCE.md` gains the
dialog and action-row checks; `docs/investigations/TIMELINE_AND_WORKBENCH_TEXT_LAYOUT_AUDIT.md`
deleted.

## Gates

1. `fix(planner): publish one outer finding per editor and move the blocked
banner into findings` (projection + findings panel + RouteWorkspace, with
   `launcher-finding-invariant.test.ts` and finding navigation tests).
2. `fix(planner): keep dialog feedback in one always-mounted region` (dialog
   files above).
3. `fix(planner): keep row controls mounted and action slots fixed` (row and
   action-row files; Phial pending control).
4. Closure: docs, checklist, delete the investigation and this plan.

## Tests

Primary owners: `test/ui/editor/rewards/*` for dialog regions and loaders,
`test/ui/editor/biome/*` for rows and action slots, `test/projections/evaluationProjection*`
and `launcher-finding-invariant.test.ts` for the outer collapse, layout contract
tests for min-heights and fixed slots. Each gate runs `npm run test:planner`;
closure runs the full gate.

## Non-goals

Engine finding codes, new finding kinds, shell surfaces, badge styling,
Nemesis sentence layout beyond the shell.
