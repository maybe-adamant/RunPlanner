# Embryo responsive layout

Status: locked under the user's authorized follow-up loop after independent
scope review. Baseline: `07c161a8`.

## Outcome and authority

Keep the Embryo target, read-only rarity and magnitude controls legible and
operable without overlap. Keep one line when it fits; let complete controls
wrap when their container cannot accommodate them.

Source evidence: `docs/investigations/APPLICATION_CLOSURE_REASSESSMENT.md`.
Authorities: `docs/design/EDITOR_MODEL.md` (drafts and bound interactions) and
`docs/design/STRUCTURED_EDITOR_WORKSPACE.md` (presentation/component foundation).
This is application CSS work only: no catalog, engine, schema, new command,
candidate, persistence or executor changes.

## One bounded implementation gate

Start at `ui/styles/{biome-layout,project-route-shell,responsive,trait-feedback}.css`:
`.transcendent-embryo-outcome-row`, its operand fields, `.route-keepsake-controls`,
and the shared `.chaos-value-slider`. Change the narrowest owning rules. Prefer
intrinsic sizing and wrapping; do not scatter viewport-specific magic offsets
or add another wrapper/component abstraction. Remove superseded conflicting
declarations in those owners rather than adding a late override pile.

Consumers are `KeepsakePickers.tsx`, `TranscendentEmbryoEffectRow.tsx`, and
`TranscendentEmbryoOutcomeFields.tsx`. Preserve their semantic and keyboard
behavior; changing React is justified only if CSS cannot express the layout.
Do not alter ordinary Chaos trait editor layout without demonstrated need.

Acceptance:

- Real browser: loadout Revelation at 1440/1000/800/600/390 widths; every operand
  label, slider and output fits its own field and the visible containing panel.
  Check descendant bounds/scroll width, not merely document overflow.
- Inspect the same shared fields in rack and automatic timeline contexts, plus
  a single-operand blessing. Slider edits remain usable and reflected in values;
  contextual picker, finding styling and keyboard behavior remain intact.
- Existing KeepsakePickers and scheduled-effect/editor witnesses own binding
  coverage. Add no jsdom geometry assertions or historical absence tests.
- Independent diff/visual review, focused tests, lint/format, then one full
  `RUN_PLANNER_PERFORMANCE_BASE_REF=07c161a8 npm run check`. Its `test` stage
  includes correctness and performance comparison; do not run those twice.

## Closure

Commit the reviewed plan before implementation. One focused production commit
may include closure after verification. Record truthful verification in its
message, promote only a concise durable responsive-layout invariant, and retire
both temporary documents. Reassess for diminishing returns; preserve the
unrelated postboss plan and do not start speculative structural cleanup.
