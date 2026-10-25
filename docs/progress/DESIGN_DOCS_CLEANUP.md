# Design Docs Cleanup

Status: locked 2026-10-25. Base commit: `66cac5282`.

## Objective

Make `docs/design/` read as the current model: one owner per fact, topics in
the doc that owns them, no history, no code mirrors. About 10,700 lines today;
target about 6,500 with roughly 1,500 lines moved to biome docs and audits.
The engine entry guide (`SIMULATION_AND_VALIDATION.md`) drops from 888 to
about 400 lines. Inventory notes behind this plan were taken per doc group on
the base commit.

## Rules

- **No fact lost.** Every removed statement is a duplicate, history, a code
  mirror, or moves to a named home in the same commit. Biome detail goes to
  `docs/biomes/`, native game detail to the existing audits, process
  checklists to `CONTRIBUTING.md`.
- **Delete:** history and migration chronicles, fix stories, deferred/TODO
  notes, gate language, restatements of `AGENTS.md`, TypeScript and
  file/function-name mirrors, CSS, pixel and UI-copy detail, pointer-only
  sections, literal versions and tuning numbers the code owns (`DRAFT_OPTIONS`,
  steering weights, layout version).
- **Implementation mechanics** (reconciliation order, cache keying, settlement
  rules) are deleted where tests own the behaviour, with at most a one-line
  code comment. Where a design genuinely needs them, a short focused companion
  doc or appendix that the main doc links to — not an essay.
- **Rewrite, don't annotate.** Revise sections in place; no "previously/now".
- Update every inbound link (design docs, audits, `CONTRIBUTING.md`,
  `README.md`, `AGENTS.md`, `game-module/CONTRIBUTING.md`) in the same commit
  as the move.

## Target document set

- **New:** `DRAFT_MODE.md` (from Simulation and validation and the authored
  model), `APPLICATION_SHELL.md` (home screens, Library, save and startup,
  Route/Draft/Loadout panels, run-modifier UI, Run State sheet, fault
  recovery), `ENCOUNTER_PREPARATION.md` (from Room lifecycle and the authored
  model), `TRAIT_OFFERS.md` (from the reward and authored models).
- **Game integration boundary splits into four:** distribution; plan slots,
  publication and signed feeds; execution protocol and conformance; run-start
  installation (loadout, run modifiers, Practice, Snap). Its UI parts move to
  the editor docs; Dream navigation to biome execution navigation.
- **Release and installer details** (NSIS, updater, signing) leave
  `ARCHITECTURE.md` for a short `docs/RELEASING.md`, outside `docs/design/`.
- **Single owners** for duplicated rules: rack and fountain order, Shop /
  Travel Deal (reward owns inventory, lifecycle owns timing),
  `roomActions.order`, findings and feedback (editor model), popup shell
  (contextual editor UX), selected cut and horizons (simulation and
  validation).
- `README.md` is trimmed to a product overview with install, getting started
  and pointers; detailed usage that the app already shows goes.

## Gates (one commit each)

0. **Stale fixes:** migration transitions claim in the authored model; Room
   lifecycle operation vocabulary (`spawnRequiredObjects`,
   `completeRequiredObjects`, `applyEncounterEndEffects`); editor docs' Draft
   panel, Fields Layout tab and fault panel.
1. **Engine entry:** Simulation and validation, `DRAFT_MODE.md`, Candidate
   evaluation, Biome execution navigation.
2. **Game integration:** the four-way split, `docs/RELEASING.md`.
3. **Reward and lifecycle:** Reward model, Room lifecycle, `TRAIT_OFFERS.md`,
   `ENCOUNTER_PREPARATION.md`, biome-doc and audit absorption.
4. **Authored and catalog:** Authored project model, Catalog model, Game
   generation rules, Architecture.
5. **Editor:** Structured editor workspace, Contextual editor UX, Editor model,
   `APPLICATION_SHELL.md`.
6. **Entry points and closure:** `README.md`, `CONTRIBUTING.md` documentation
   map, `AGENTS.md` references (the engine mandatory read), a link sweep;
   delete this plan.

Each gate: the executor reports line counts before and after and the moved
sections with their new homes; an independent reviewer compares the old and
new text for lost facts and broken links before the commit lands. Lane:
`npm run format:check`.

## Non-goals

- `AGENTS.md` restructuring beyond link updates, the memory pruning, the
  testing checklists and investigations — later passes.
- Rewriting biome docs or audits beyond absorbing moved content.
- Any code change other than one-line comments replacing deleted mechanics.
