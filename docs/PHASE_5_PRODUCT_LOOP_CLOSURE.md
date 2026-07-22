# Phase 5 Product-Loop Closure

## Purpose

This progress record maps the Phase 5 acceptance contract to concrete evidence.
It is not a new design authority. Candidate semantics remain owned by
`SIMULATION_AND_VALIDATION.md`, editor behavior by `EDITOR_MODEL.md`, and
delivery scope by `IMPLEMENTATION_PLAN.md`.

## Automated Acceptance Matrix

| Acceptance surface                                                                                 | Named evidence                                                                                                                      |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Complete F browser authoring and validation                                                        | `authors, validates, labels, saves, and reloads the representative F project through the browser UI`                                |
| G editing after a valid F prefix                                                                   | `navigates, authors, undoes, and redoes G after a validated F prefix`                                                               |
| Blocked G remains editable without invented validity                                               | `keeps G authoring available while incomplete F blocks its simulation`                                                              |
| Complete F/G simulation, labels, profiles, recovery, navigation, accessibility, and responsiveness | `closes the complete F/G browser loop with profiles, recovery, accessibility, and responsive projections`                           |
| G-specific Crawler exclusion and non-counting timing                                               | `preserves biome encounter depth when the picked G miniboss is Crawler`                                                             |
| G maximum-width preboss simulation and editing                                                     | `materializes the maximum G preboss fork from a three-exit predecessor` and its shared-editor interaction fixture                   |
| Candidate and selected-plan parity                                                                 | candidate fixtures in `packages/hades2-catalog/src/fGeneration.test.ts` and `packages/hades2-catalog/src/projectSimulation.test.ts` |
| Profile save/load and exact derived-state replacement                                              | profile application, adapter, and browser interaction fixtures                                                                      |
| Dirty, clean, unsaved, recovered, corrupt-recovery, and autosave failure behavior                  | profile-session and autosave-recovery application fixtures                                                                          |
| Semantic keyboard history                                                                          | `supports Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl+Y`                                                                                 |
| Keyboard section and biome navigation                                                              | `activates route and configured-biome navigation from the keyboard`                                                                 |
| Text-edit protection                                                                               | `leaves native text and content-editable undo behavior untouched`                                                                   |

The complete F/G fixture audits unique control IDs, explicit labels for every
visible input and select, accessible names for buttons, current-panel
announcement, profile-status announcement, declaration-owned room/reward
labels, and absence of game names and occurrence IDs in player-facing copy.

## Responsiveness Evidence

The representative project contains complete valid F and G topology, reward
state, shops, terminal entries, bosses, and postboss rooms. A local Vitest/jsdom
measurement on 2026-07-20 produced:

- full cold `simulateProject` rebuild: about 349 ms;
- cold G room-candidate projection: about 253 ms;
- representative G occurrence replacement and publication: about 21 ms;
- identity-cached undo publication: below 1 ms.

The automated guard ceilings are deliberately wider than one workstation's
point measurement: 750 ms for a cold rebuild, cold room-candidate projection,
and representative edit publication, and 50 ms for cached undo publication.
These are regression tripwires, not public frame-time promises.

The measured hot paths justified four contained changes:

- application evaluation and candidate preparation share one immutable-project
  evaluation rather than rebuilding the same baseline;
- reward and shop candidates replay only their addressed biome through the
  existing linear simulation authority while reusing the evaluated upstream
  biome;
- branch-invariant history-view facts are cached by immutable history-view
  identity during reward replay;
- reward-option and shop-purchase candidate projections are prepared when the
  control receives keyboard focus or pointer intent, because closed native
  selectors do not expose their option decoration.

Redux's generic recursive immutable/serializable development scans are disabled
for the normalized project/evaluation workspace. Catalog parsing, project
commands/codecs, simulation contacts, and profile adapters remain the explicit
validation boundaries; the application does not replace them with repeated
whole-tree scans after every trusted semantic command.

## Browser Smoke Procedure

Run `npm run dev`, then use a browser to perform the following host-specific
checks that jsdom cannot faithfully own:

1. Build or load a complete F/G profile and move through Underworld, Route,
   Erebus, and Oceanus using only Tab, Shift+Tab, Enter, Space, arrow keys, and
   native select interaction.
2. Focus several room, reward, source, and purchase controls. Confirm contextual
   candidate decoration appears without changing the authored value and that an
   unavailable option remains selectable.
3. Save a profile and confirm a `.runplanner.json` download with the normalized
   project name. Cancel one Load Profile chooser, then load the saved file and
   confirm equal F/G state and Clean status.
4. Make an edit, confirm Dirty, undo to the saved snapshot, and confirm Clean.
   Reload after a later edit and confirm the autosaved project is recovered as
   Recovered rather than Clean.
5. Confirm focus remains visible, control labels remain aligned with their
   controls, and no internal room/reward identifiers appear in the editor.

## Closed Scope

At Phase 5 closure, F and G were the only active biomes and H/I/N/O/P/Q were
declaration-complete but dormant. The phase added no Tauri packaging,
execution-plan compiler, game-module integration, Chaos/NPC detours, or later
contextual-selection UX work.
