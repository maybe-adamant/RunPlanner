# Hermes delivery position picker

Status: locked for implementation after adversarial review.
Base: 8c9d12d8. Worktree contains only the unrelated untracked boss-opening investigation.

## Outcome and scope
Required delayed Hermes delivery rows offer Place… with the same position picker and descriptions as Move…. Selecting an available position materializes and ranks the delivery atomically, preserving payload semantics and one Undo step. Ordinary rooms, Ship phase contacts, and final Preboss phase-less contacts are included.
No authored schema migration, game-module changes, automatic placement, or changes to optional clocked pickups, Echo Gold, generic required restores, and purchase rescheduling defaults.

## Authorities and design
Engine owns commands and legal positions; app binds complete intents and labels; React reuses RoomActionPlacementPicker.
Extend PlaceHermesShrineDelivery with an optional insertion index. Omission preserves existing canonical placement and rescheduling behavior. Validate explicit index structurally and preserve existing source, phase, payload, relocation and reconciliation semantics.
An engine-owned query derives position choices for a due unplaced Hermes delivery by provisionally applying canonical placement and reusing the existing structural action domain and roster proposal assessment. Include the canonical slot and other insertion slots without duplicate positions. Reuse typed blocker evidence and existing policy; do not simulate every position, reconstruct order legality in the app, or introduce a parallel timeline.
The query consumes exact reached delivery capability context. Expose narrow choices with indices, authorability, blockers and complete placement commands. Carry this explicit product through the existing derived acquisition/projection path; do not introduce hidden registration.
UI shows Place… and retains accessible delivery naming. Opening/canceling does not edit state; selecting dispatches one semantic command. Existing Move, findings target, Ship tab and delete behavior remain intact.

Governing sections: SIMULATION_AND_VALIDATION.md (full engine entry; Findings and Repair, Authoring readiness); ROOM_LIFECYCLE_MODEL.md (Room Action roster boundary); AUTHORED_PROJECT_MODEL.md (acquisition commands and required action defaults); EDITOR_MODEL.md (Findings and Navigation); AGENTS.md ownership and testing.

## One delivery gate
Implement the complete engine-to-UI slice, then fresh independent review and bounded remediation.
Starting files: authored-project/commands/types.ts and commands/acquisition/acquisition-site.ts; simulation/room-actions/assemble.ts and simulation/evaluation/project-evaluation-assembly.ts; planner source-index.ts, occurrence-reward-assembly.ts, occurrence-action-row-projection.ts, contracts/timeline.ts, OccurrenceRoomActions.tsx, RoomActionPlacementPicker.tsx.
Retire the immediate Place button path for Hermes only. No broad movement or generic framework.

## Verification and closure
Engine primary tests: explicit position, omitted default, invalid index, retained payload/relocation, one Undo, legal/blocked positions for ordinary, Ship and final Preboss. Reuse existing order tests rather than duplicate their policy matrix.
Application/UI witnesses: Place opens picker without mutation, cancellation unchanged, chosen nondefault position in one edit, Move appears afterward, Undo restores unplaced row, finding/Ship navigation retained. Update old direct-Place click tests to choose a position.
Run narrow owning tests, equivalence before/after (no baseline rewrite expected), independent review, then npm run check once stable. Promote only the supported command/presentation contract to owning docs and delete this plan at closure. Leave implementation uncommitted unless user asks; repository-required locked plan commit is separate.
