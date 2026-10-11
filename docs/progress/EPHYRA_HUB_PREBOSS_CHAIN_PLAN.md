# Ephyra Hub Preboss Chain Plan

Status: locked. Base commit: `d979a4ddf`. Authored schema bump
95 → 96 approved by the project owner on 2026-10-11.

## Objective

Make Ephyra's completion chain a fixed part of the Hub contract. Creating the
Hub creates `N_PreBoss01`, which creates its Boss and Postboss through the
existing fixed links. The chain is removed only with the Hub. Board, visit and
fountain edits never drop it; while the Hub is incomplete the Preboss is an
unreached context whose controls are disabled.

User-visible outcome: no "open next door" step in the Hub Exit tab; reordering,
removing or resetting visits and closing doors keep all Preboss, Boss and
Postboss work.

## Source facts

- Ephyra has one Preboss reached through one fixed door (`N_PreBoss01`,
  `EphyraExitBossDoor`); `N_PreBoss01.LinkedRooms` names its Boss rooms
  (`RoomDataN.lua:2030`).
- The exit is locked until six Soul Pylons have spawned (`LockEphyraExits`,
  `RoomDataN.lua:1252`) and the fountain is a required object at that point
  (`HealthFountainNExitCheck`, `EventLogic.lua:1832`).

## Current behaviour being replaced

- The completed-Hub handoff is authored separately from the Hub Exit tab
  (`takeover.ts:313-326`) and only once the Hub is complete.
- The decoder rejects a Hub-sourced exit unless the Hub is complete
  (`topology/decoding/coordinator.ts:1055-1067`, `hubDecisionHandoffReadiness`,
  `topology/query.ts:687-711`).
- `ReplaceHubActionOrder` deletes the handoff subtree when visits drop below
  the requirement (`commands/topology/hub.ts:346-350`, `removeCompletedHubHandoff`);
  `CloseHubSlot` below the open minimum does the same
  (`topology/impact.ts:242-253`); `ResetHubBoard` removes it with the board.

## Decision

- **Contract.** Every `HubDecision` owns exactly one completed-Hub exit decision
  sourced `{ kind: 'hubDecision', decisionKey }` whose width-one batch holds the
  fixed `N_PreBoss01` occurrence, plus its fixed Boss and route-position Postboss
  occurrences. The decoder requires it; a Hub without it is a contract error
  after migration.
- **Commands.** `ReplaceWithHubDecision` creates the Hub and the chain
  atomically (occurrence IDs supplied by the command, as for takeover batches).
  `RemoveHubDecision` removes both and restores the envelope.
  `ReplaceHubActionOrder`, `CloseHubSlot`, `OpenHubSlot` and `ResetHubBoard`
  never touch the chain. The standalone completed-Hub handoff creation path is
  retired.
- **Readiness.** The six-visit and open-set predicate no longer gates the
  chain's existence. It gates reachability: materialization stops at the Hub
  frontier, the Preboss and its descendants are unreached contexts, and their
  retained state stays authored and finding-backed.
- **Editor.** The Hub Exit tab shows the Preboss as a room like any other; its
  controls follow the unreached-context policy (disabled with a hover hint, no
  dialogs). No create button.
- **Migration 95 → 96.** Every Hub lacking the chain gains it with
  declaration-owned defaults and new stable IDs; Hubs that already own it are
  unchanged. Imported IDs are never rewritten.

Planner simplification: none new; the Preboss remains assessed only once the
Hub is complete, as today.

## Ownership

- **Catalog:** none expected (the Hub declaration already names the handoff
  target `N_PreBoss01`, `layouts/n.ts:72`).
- **Engine:** authored model and codec (version 96), decoder contract, Hub
  commands, removal impact, readiness/completeness, materialization frontier,
  candidates (retire handoff creation candidate paths), fixtures and test support
  builders.
- **Planner app:** migration `project-95-to-96`, Hub Exit tab projection and
  interaction removal, persistence tests.
- **Execution plan and game module:** no change expected; published plans
  require a complete Hub and their output is unchanged.

## Gates

1. **Engine contract and migration.** Model, codec, decoder, commands,
   readiness, candidates, app migration, fixtures/checkpoints. Equivalence:
   complete routes unchanged; incomplete-Hub checkpoints move only by gaining
   the chain — verify by stripping it.
2. **Editor.** Hub Exit tab as a Preboss view, removal of the open-door action,
   unreached-context controls, UI witnesses.
3. **Closure.** `AUTHORED_PROJECT_MODEL.md` (N Hub Progression, Starts/Batches,
   empty envelopes), `N_GAME_RULES.md` authored shape, `STRUCTURED_EDITOR_WORKSPACE.md`
   Hub tabs, `CONTEXTUAL_EDITOR_UX.md` if it mentions the Exit action; plan
   retirement.

## Tests

- Engine (primary owner): Hub creation creates the chain; Hub removal removes
  it; reorder, single-visit removal, reset visits, reset board, close below
  minimum all retain chain and its room state; decoder rejects a Hub without the
  chain; incomplete Hub leaves Preboss unreached with findings, complete Hub
  reaches it.
- Migration: legacy Hub without chain gains it; Hub with chain unchanged; IDs
  stable; round trip.
- Editor: Exit tab shows the Preboss, disabled while the Hub is incomplete, no
  open-door control.
- Equivalence as in gate 1.

## Non-goals

- Hub-as-occurrence refactor, shared visit decision, fountain as room action.
- The "rewind to here" map control and the Chaos-gate walker fix (separate
  follow-ups).
- Execution-plan or game-module changes.
