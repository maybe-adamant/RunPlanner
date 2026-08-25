import {
  createOccurrenceAddress,
  semanticAddressKey,
  type OccurrenceId,
  type TargetAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import type { ProjectEvaluationAssembly } from '@run-planner/engine/simulation';
import {
  candidateSupport,
  type CandidateOptionProjection,
  type CandidateProjectionSession,
} from '@planner/projections/candidateProjection';
import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import {
  roomCategoryForKind,
  roomSelectorCategories,
  selectRoomsForTargetCategory,
} from '@planner/projections/roomSelectorProjection';
import { createTakeoverBatchCommand } from '@planner/workspace/takeoverBatchInteraction';
import type { OccurrenceIdFactory } from '@planner/workspace/occurrenceIds';

import { requireWorkspaceRoom } from '../assembly/catalog-room';
import { StructuredWorkspaceProjectionContractError } from '../contract';
import type {
  StructuredWorkspaceContextualServices,
  WorkspaceRoomInteraction,
  WorkspaceRoomPickerControl,
  WorkspaceStartInteraction,
  WorkspaceTakeoverBatchInteraction,
  WorkspaceTopologyRemovalInteraction,
} from '../contract';
import type {
  WorkspaceStartInteractionRequirement,
  WorkspaceTakeoverInteractionRequirement,
  WorkspaceTopologyRemovalInteractionRequirement,
} from './interaction-requirements';

function bindTopologyRemovalInteractions(
  requirements: Iterable<WorkspaceTopologyRemovalInteractionRequirement>,
): ReadonlyMap<string, WorkspaceTopologyRemovalInteraction> {
  const topologyRemovals = new Map<string, WorkspaceTopologyRemovalInteraction>();
  for (const requirement of requirements) {
    for (const removal of requirement.removals) {
      if (topologyRemovals.has(removal.key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${removal.key} has multiple bound topology-removal interactions`,
        );
      }
      topologyRemovals.set(
        removal.key,
        Object.freeze({
          intent: Object.freeze({
            command: removal.command,
            focus: Object.freeze({ owner: removal.owner, timing: 'before' as const }),
          }),
          key: removal.key,
          owner: removal.owner,
        }),
      );
    }
  }
  return topologyRemovals;
}

function bindStartInteractions(
  allocateOccurrenceId: OccurrenceIdFactory,
  catalog: Catalog,
  candidates: CandidateProjectionSession,
  contextualPicker: StructuredWorkspaceContextualServices['contextualPicker'],
  requirements: Iterable<WorkspaceStartInteractionRequirement>,
): ReadonlyMap<string, WorkspaceStartInteraction> {
  const starts = new Map<string, WorkspaceStartInteraction>();
  for (const requirement of requirements) {
    const key = semanticAddressKey(requirement.owner);
    if (starts.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple bound start interactions`,
      );
    }
    const gameNames =
      requirement.start.kind === 'fixed'
        ? Object.freeze([requirement.start.gameName])
        : requirement.start.gameNames;
    const rooms = Object.freeze(
      gameNames.map((gameName) => requireWorkspaceRoom(catalog, gameName)),
    );
    let model: ContextualPickerModel<RoomDeclaration> | undefined;
    const load = (): ContextualPickerModel<RoomDeclaration> => {
      if (model !== undefined) return model;
      model = contextualPicker.project(
        candidates.startRooms(requirement.owner, rooms),
        (option) =>
          Object.freeze({
            category: roomCategoryForKind(option.value.kind) ?? option.value.kind,
            label: option.value.label,
            selected: false,
          }),
        (room) => room.gameName,
      );
      return model;
    };
    const intentFor = (gameName?: string) => {
      const occurrenceId = allocateOccurrenceId();
      return Object.freeze({
        command: Object.freeze({
          biome: requirement.owner,
          ...(gameName === undefined ? {} : { gameName }),
          kind: 'CreateStart' as const,
          occurrenceId,
        }),
        focus: Object.freeze({
          owner: createOccurrenceAddress(requirement.owner, occurrenceId),
          timing: 'after' as const,
        }),
      });
    };
    if (requirement.start.kind === 'fixed') {
      starts.set(
        key,
        Object.freeze({
          fixedLabel: requireWorkspaceRoom(catalog, requirement.start.gameName).label,
          intent: () => intentFor(),
          key,
          kind: 'fixed' as const,
          load,
          owner: requirement.owner,
        }),
      );
    } else {
      starts.set(
        key,
        Object.freeze({
          intentFor: (room: RoomDeclaration) => {
            if (!gameNames.includes(room.gameName)) {
              throw new StructuredWorkspaceProjectionContractError(
                `${room.gameName} is outside the declared start domain for ${key}`,
              );
            }
            return intentFor(room.gameName);
          },
          key,
          kind: 'choice' as const,
          load,
          owner: requirement.owner,
        }),
      );
    }
  }
  return starts;
}

function bindTakeoverBatchInteractions(
  allocateOccurrenceId: OccurrenceIdFactory,
  catalog: Catalog,
  requirements: Iterable<WorkspaceTakeoverInteractionRequirement>,
): ReadonlyMap<string, WorkspaceTakeoverBatchInteraction> {
  const targetOccurrences = (
    targets: readonly { readonly exitKey: string; readonly occurrenceId: OccurrenceId }[],
  ): ReadonlyMap<string, OccurrenceId> =>
    new Map(targets.map((target) => [target.exitKey, target.occurrenceId] as const));
  const takeoverBatches = new Map<string, WorkspaceTakeoverBatchInteraction>();
  for (const requirement of requirements) {
    const key = semanticAddressKey(requirement.owner);
    if (takeoverBatches.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple bound takeover batch interactions`,
      );
    }
    switch (requirement.presentation) {
      case 'repair': {
        const existingTargetOccurrenceIds = targetOccurrences(requirement.existingTargets);
        takeoverBatches.set(
          key,
          Object.freeze({
            action: 'reconcile' as const,
            intent: () =>
              Object.freeze({
                command: createTakeoverBatchCommand({
                  action: 'reconcile',
                  allocateOccurrenceId,
                  decision: requirement.owner,
                  existingTargetOccurrenceIds,
                  gameName: requirement.gameName,
                  requiredExitKeys: requirement.requiredExitKeys,
                }),
                focus: Object.freeze({ owner: requirement.owner, timing: 'before' as const }),
              }),
            key,
            label: requireWorkspaceRoom(catalog, requirement.gameName).label,
            owner: requirement.owner,
            presentation: 'repair' as const,
          }),
        );
        break;
      }
      case 'completedHubHandoff':
        takeoverBatches.set(
          key,
          Object.freeze({
            action: 'create' as const,
            intent: () =>
              Object.freeze({
                command: createTakeoverBatchCommand({
                  action: 'create',
                  allocateOccurrenceId,
                  decision: requirement.owner,
                  existingTargetOccurrenceIds: new Map(),
                  gameName: requirement.gameName,
                  requiredExitKeys: requirement.requiredExitKeys,
                }),
                focus: Object.freeze({ owner: requirement.owner, timing: 'before' as const }),
              }),
            key,
            label: requireWorkspaceRoom(catalog, requirement.gameName).label,
            owner: requirement.owner,
            presentation: 'completedHubHandoff' as const,
          }),
        );
        break;
    }
  }
  return takeoverBatches;
}

function candidateHasExecutableSupport(candidate: CandidateOptionProjection<unknown>): boolean {
  const support = candidateSupport(candidate);
  return support === 'forced' || support === 'possible';
}

function distinctRooms(rooms: readonly RoomDeclaration[]): readonly RoomDeclaration[] {
  return Object.freeze([...new Map(rooms.map((room) => [room.gameName, room])).values()]);
}

function targetCandidateRooms(
  catalog: Catalog,
  project: ProjectEvaluationAssembly['project'],
  target: TargetAddress,
): readonly RoomDeclaration[] {
  return distinctRooms(
    roomSelectorCategories(catalog, target.biomeKey).flatMap((category) =>
      selectRoomsForTargetCategory(catalog, project, target, category),
    ),
  );
}

type WorkspaceDecisionEntryCandidate =
  | {
      readonly candidate: CandidateOptionProjection<RoomDeclaration>;
      readonly kind: 'ordinary';
      readonly room: RoomDeclaration;
    }
  | {
      readonly candidate: CandidateOptionProjection<string>;
      readonly kind: 'takeover';
      readonly room: RoomDeclaration;
    }
  | {
      readonly candidate: CandidateOptionProjection<RoomDeclaration>;
      readonly kind: 'hub';
      readonly room: RoomDeclaration;
    };

type WorkspaceDecisionEntryRoomControl = Extract<
  WorkspaceRoomPickerControl,
  { readonly kind: 'decisionEntryRoomPicker' }
>;

/**
 * Candidate availability and authored mutation readiness answer different
 * questions. An ordinary Door 1 choice remains authorable behind a retained
 * or incomplete prefix just like any other target picker when the engine's
 * exact static command domain admits it. Setup owned by this exact decision
 * can still block ordinary mutation. A takeover requires evaluated whole-batch
 * support because it needs the engine's required-exit product. The structurally
 * forced Hub is also authorable from an uncommitted decision when candidate
 * coverage has not reached that exact checkpoint yet; its projected control
 * and atomic engine command still validate the closed terminal. A persisted
 * Hub envelope continues to require evaluated support.
 */
function decisionEntryCandidateMayBeAuthored(
  entry: WorkspaceDecisionEntryCandidate,
  ordinaryTargetAuthoring: WorkspaceDecisionEntryRoomControl['ordinaryTargetAuthoring'],
  ordinaryTargetGameNames: WorkspaceDecisionEntryRoomControl['ordinaryTargetGameNames'],
  persistence: WorkspaceDecisionEntryRoomControl['persistence'],
): boolean {
  if (entry.kind === 'hub') {
    return (
      candidateHasExecutableSupport(entry.candidate) ||
      (persistence === 'uncommitted' && entry.candidate.evaluation.kind === 'unavailable')
    );
  }
  if (entry.kind === 'takeover') return candidateHasExecutableSupport(entry.candidate);
  if (ordinaryTargetAuthoring.kind !== 'ready') return false;
  if (!ordinaryTargetGameNames.includes(entry.room.gameName)) return false;
  return candidateSupport(entry.candidate) !== 'impossible';
}

function disableUnavailableDecisionEntryCandidates(
  model: ContextualPickerModel<RoomDeclaration>,
  candidates: readonly WorkspaceDecisionEntryCandidate[],
  ordinaryTargetAuthoring: WorkspaceDecisionEntryRoomControl['ordinaryTargetAuthoring'],
  ordinaryTargetGameNames: WorkspaceDecisionEntryRoomControl['ordinaryTargetGameNames'],
  persistence: WorkspaceDecisionEntryRoomControl['persistence'],
): ContextualPickerModel<RoomDeclaration> {
  const candidatesByGameName = new Map(
    candidates.map((candidate) => [candidate.room.gameName, candidate] as const),
  );
  let changed = false;
  const sections = model.sections.map((section) => {
    let sectionChanged = false;
    const items = section.items.map((item) => {
      const candidate = candidatesByGameName.get(item.value.gameName);
      if (
        item.disabled ||
        candidate === undefined ||
        decisionEntryCandidateMayBeAuthored(
          candidate,
          ordinaryTargetAuthoring,
          ordinaryTargetGameNames,
          persistence,
        )
      ) {
        return item;
      }
      changed = true;
      sectionChanged = true;
      return Object.freeze({ ...item, disabled: true });
    });
    return sectionChanged ? Object.freeze({ ...section, items: Object.freeze(items) }) : section;
  });
  return changed ? Object.freeze({ ...model, sections: Object.freeze(sections) }) : model;
}

export interface WorkspaceTopologyInteractionCatalog {
  readonly rooms: ReadonlyMap<string, WorkspaceRoomInteraction>;
  readonly starts: ReadonlyMap<string, WorkspaceStartInteraction>;
  readonly takeoverBatches: ReadonlyMap<string, WorkspaceTakeoverBatchInteraction>;
  readonly topologyRemovals: ReadonlyMap<string, WorkspaceTopologyRemovalInteraction>;
}

export function bindTopologyInteractions(input: {
  readonly allocateOccurrenceId: OccurrenceIdFactory;
  readonly catalog: Catalog;
  readonly candidates: CandidateProjectionSession;
  readonly contextualPicker: StructuredWorkspaceContextualServices['contextualPicker'];
  readonly project: ProjectEvaluationAssembly['project'];
  readonly roomControls: ReadonlyMap<string, WorkspaceRoomPickerControl>;
  readonly startInteractionRequirements: Iterable<WorkspaceStartInteractionRequirement>;
  readonly takeoverInteractionRequirements: Iterable<WorkspaceTakeoverInteractionRequirement>;
  readonly topologyRemovalInteractionRequirements: Iterable<WorkspaceTopologyRemovalInteractionRequirement>;
}): WorkspaceTopologyInteractionCatalog {
  const {
    allocateOccurrenceId,
    catalog,
    candidates,
    contextualPicker,
    project,
    roomControls,
    startInteractionRequirements,
    takeoverInteractionRequirements,
    topologyRemovalInteractionRequirements,
  } = input;
  const rooms = new Map<string, WorkspaceRoomInteraction>();
  for (const [key, control] of roomControls) {
    if (control.kind === 'startRoomPicker') {
      const candidateRooms = Object.freeze(
        control.candidateGameNames.map((gameName) => requireWorkspaceRoom(catalog, gameName)),
      );
      let model: ContextualPickerModel<RoomDeclaration> | undefined;
      rooms.set(
        key,
        Object.freeze({
          choices: Object.freeze(
            candidateRooms.map((room) =>
              Object.freeze({
                category: roomCategoryForKind(room.kind) ?? room.kind,
                gameName: room.gameName,
                label: room.label,
              }),
            ),
          ),
          kind: 'startRoom' as const,
          key,
          load(): ContextualPickerModel<RoomDeclaration> {
            if (model !== undefined) return model;
            model = contextualPicker.project(
              candidates.startRooms(control.address, candidateRooms),
              (option) =>
                Object.freeze({
                  category: roomCategoryForKind(option.value.kind) ?? option.value.kind,
                  label: option.value.label,
                  selected: option.value.gameName === control.selectedGameName,
                }),
              (room) => room.gameName,
            );
            return model;
          },
          owner: control.address,
          selected: requireWorkspaceRoom(catalog, control.selectedGameName),
        }),
      );
      continue;
    }

    const ordinaryRooms =
      control.kind === 'decisionEntryRoomPicker'
        ? Object.freeze(
            control.ordinaryTargetGameNames.map((gameName) =>
              requireWorkspaceRoom(catalog, gameName),
            ),
          )
        : targetCandidateRooms(catalog, project, control.address);
    if (control.kind === 'decisionEntryRoomPicker') {
      const takeoverRooms = Object.freeze(
        control.takeoverGameNames.map((gameName) => requireWorkspaceRoom(catalog, gameName)),
      );
      const takeoverGameNames = new Set(takeoverRooms.map((room) => room.gameName));
      const ordinaryGameNames = new Set(ordinaryRooms.map((room) => room.gameName));
      const overlappingGameName = [...ordinaryGameNames].find((gameName) =>
        takeoverGameNames.has(gameName),
      );
      if (overlappingGameName !== undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${overlappingGameName} has ambiguous ordinary and takeover decision-entry semantics for ${key}`,
        );
      }
      const candidateRooms = Object.freeze([...ordinaryRooms, ...takeoverRooms]);
      let loadedCandidates: readonly WorkspaceDecisionEntryCandidate[] | undefined;
      let model: ContextualPickerModel<RoomDeclaration> | undefined;
      const loadCandidates = (): readonly WorkspaceDecisionEntryCandidate[] =>
        (loadedCandidates ??= Object.freeze([
          ...candidates
            .roomTargets(control.address, ordinaryRooms)
            .map((candidate) =>
              Object.freeze({ candidate, kind: 'ordinary' as const, room: candidate.value }),
            ),
          ...candidates
            .takeoverPrebossBatches(control.decisionOwner, control.takeoverGameNames)
            .map((candidate) =>
              Object.freeze({
                candidate,
                kind: 'takeover' as const,
                room: requireWorkspaceRoom(catalog, candidate.value),
              }),
            ),
          ...(control.hub === undefined
            ? []
            : [
                (() => {
                  const candidate = candidates.hubTerminalTakeover(control.decisionOwner);
                  const room = requireWorkspaceRoom(catalog, control.hub.gameName);
                  return Object.freeze({
                    candidate: Object.freeze({
                      evaluation: candidate.evaluation,
                      value: room,
                    }),
                    kind: 'hub' as const,
                    room,
                  });
                })(),
              ]),
        ]));
      rooms.set(
        key,
        Object.freeze({
          choices: Object.freeze(
            candidateRooms.map((room) =>
              Object.freeze({
                category: roomCategoryForKind(room.kind) ?? room.kind,
                gameName: room.gameName,
                label: room.label,
              }),
            ),
          ),
          decisionOwner: control.decisionOwner,
          intentFor(gameName: string) {
            const entry = loadCandidates().find(
              (candidate) => candidate.room.gameName === gameName,
            );
            if (entry === undefined) {
              throw new StructuredWorkspaceProjectionContractError(
                `${gameName} is outside the decision-entry room domain for ${key}`,
              );
            }
            if (
              !decisionEntryCandidateMayBeAuthored(
                entry,
                control.ordinaryTargetAuthoring,
                control.ordinaryTargetGameNames,
                control.persistence,
              )
            ) {
              throw new StructuredWorkspaceProjectionContractError(
                `${gameName} is not currently authorable for ${key}`,
              );
            }
            if (entry.kind === 'ordinary') {
              const occurrenceId = allocateOccurrenceId();
              return Object.freeze({
                command:
                  control.persistence === 'authored'
                    ? Object.freeze({
                        gameName,
                        kind: 'CreateTarget' as const,
                        occurrenceId,
                        target: control.address,
                      })
                    : Object.freeze({
                        decision: control.decisionOwner,
                        edit: Object.freeze({
                          gameName,
                          kind: 'target' as const,
                          occurrenceId,
                          target: control.address,
                        }),
                        kind: 'InitializeExitDecision' as const,
                      }),
                focus: Object.freeze({ owner: control.address, timing: 'after' as const }),
              });
            }
            if (entry.kind === 'hub') {
              const hub = control.hub;
              if (hub === undefined) {
                throw new StructuredWorkspaceProjectionContractError(
                  `${gameName} has no structural Hub terminal for ${key}`,
                );
              }
              if (
                entry.candidate.evaluation.kind !== 'hubTerminalTakeover' &&
                !(
                  control.persistence === 'uncommitted' &&
                  entry.candidate.evaluation.kind === 'unavailable'
                )
              ) {
                throw new StructuredWorkspaceProjectionContractError(
                  `${gameName} has no evaluated Hub terminal evidence for ${key}`,
                );
              }
              const result =
                entry.candidate.evaluation.kind === 'hubTerminalTakeover'
                  ? entry.candidate.evaluation.result
                  : undefined;
              if (
                result !== undefined &&
                (result.gameName !== gameName || result.hubKey !== hub.decision.hubKey)
              ) {
                throw new StructuredWorkspaceProjectionContractError(
                  `${gameName} Hub candidate disagrees with its declared terminal for ${key}`,
                );
              }
              const command =
                control.persistence === 'authored'
                  ? Object.freeze({
                      decision: control.decisionOwner,
                      hub: hub.decision,
                      kind: 'ReplaceWithHubDecision' as const,
                    })
                  : Object.freeze({
                      decision: control.decisionOwner,
                      edit: Object.freeze({
                        hub: hub.decision,
                        kind: 'hub' as const,
                      }),
                      kind: 'InitializeExitDecision' as const,
                    });
              return Object.freeze({
                command,
                focus: Object.freeze({ owner: hub.decision, timing: 'after' as const }),
              });
            }
            if (entry.candidate.evaluation.kind !== 'takeoverPrebossBatch') {
              throw new StructuredWorkspaceProjectionContractError(
                `${gameName} has no evaluated takeover evidence for ${key}`,
              );
            }
            const sharedTakeoverInput = {
              allocateOccurrenceId,
              decision: control.decisionOwner,
              existingTargetOccurrenceIds: new Map<string, OccurrenceId>(),
              gameName,
              requiredExitKeys: entry.candidate.evaluation.result.requiredExitKeys,
            };
            const command =
              control.persistence === 'authored'
                ? createTakeoverBatchCommand({ action: 'replace', ...sharedTakeoverInput })
                : createTakeoverBatchCommand({ action: 'create', ...sharedTakeoverInput });
            return Object.freeze({
              command,
              focus: Object.freeze({ owner: control.decisionOwner, timing: 'before' as const }),
            });
          },
          key,
          kind: 'decisionEntryRoom' as const,
          load(): ContextualPickerModel<RoomDeclaration> {
            if (model !== undefined) return model;
            const projected = contextualPicker.project(
              loadCandidates().map((entry) =>
                Object.freeze({ evaluation: entry.candidate.evaluation, value: entry.room }),
              ),
              (option) =>
                Object.freeze({
                  category: roomCategoryForKind(option.value.kind) ?? option.value.kind,
                  label: option.value.label,
                  selected: false,
                }),
              (room) => room.gameName,
            );
            model = disableUnavailableDecisionEntryCandidates(
              projected,
              loadCandidates(),
              control.ordinaryTargetAuthoring,
              control.ordinaryTargetGameNames,
              control.persistence,
            );
            return model;
          },
          owner: control.address,
        }),
      );
      continue;
    }

    const selectedGameName =
      control.target.kind === 'existing' ? control.target.selectedGameName : undefined;
    const targetGameNames = new Set(ordinaryRooms.map((room) => room.gameName));
    let model: ContextualPickerModel<RoomDeclaration> | undefined;
    rooms.set(
      key,
      Object.freeze({
        choices: Object.freeze(
          ordinaryRooms.map((room) =>
            Object.freeze({
              category: roomCategoryForKind(room.kind) ?? room.kind,
              gameName: room.gameName,
              label: room.label,
            }),
          ),
        ),
        intentFor(gameName: string) {
          if (!targetGameNames.has(gameName)) {
            throw new StructuredWorkspaceProjectionContractError(
              `${gameName} is outside the target-room domain for ${key}`,
            );
          }
          if (control.target.kind === 'existing') {
            return Object.freeze({
              command: Object.freeze({
                gameName,
                kind: 'ReplaceOccurrenceRoom' as const,
                occurrence: control.target.occurrence,
              }),
              focus: Object.freeze({ owner: control.address, timing: 'after' as const }),
            });
          }
          const occurrenceId = allocateOccurrenceId();
          return Object.freeze({
            command: Object.freeze({
              gameName,
              kind: 'CreateTarget' as const,
              occurrenceId,
              target: control.address,
            }),
            focus: Object.freeze({ owner: control.address, timing: 'after' as const }),
          });
        },
        kind: 'targetRoom' as const,
        key,
        load(): ContextualPickerModel<RoomDeclaration> {
          if (model !== undefined) return model;
          model = contextualPicker.project(
            candidates.roomTargets(control.address, ordinaryRooms),
            (option) =>
              Object.freeze({
                category: roomCategoryForKind(option.value.kind) ?? option.value.kind,
                label: option.value.label,
                selected: option.value.gameName === selectedGameName,
              }),
            (room) => room.gameName,
          );
          return model;
        },
        owner: control.address,
        ...(selectedGameName === undefined
          ? {}
          : { selected: requireWorkspaceRoom(catalog, selectedGameName) }),
      }),
    );
  }
  return Object.freeze({
    rooms,
    starts: bindStartInteractions(
      allocateOccurrenceId,
      catalog,
      candidates,
      contextualPicker,
      startInteractionRequirements,
    ),
    takeoverBatches: bindTakeoverBatchInteractions(
      allocateOccurrenceId,
      catalog,
      takeoverInteractionRequirements,
    ),
    topologyRemovals: bindTopologyRemovalInteractions(topologyRemovalInteractionRequirements),
  });
}
