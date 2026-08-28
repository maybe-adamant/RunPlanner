import type { OccurrenceAddress } from '@run-planner/engine/authored-project';
import type { ReactNode } from 'react';
import type {
  WorkspaceEncounterPhase,
  WorkspaceDoorContract,
  WorkspaceInteractionCatalog,
  WorkspaceLocalVisitDecision,
  WorkspaceRoomActions,
  WorkspaceRoomLifecycleBoundary,
  WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { RoomActionsWorkbench } from './OccurrenceRoomActions';
import { RoomFeaturesWorkbench } from './OccurrenceRoomFeatures';
import {
  EncounterPhaseControl,
  FieldsWorkbench,
  LocalVisitWorkbench,
  RewardWheelWorkbench,
  ShopWorkbench,
} from './OccurrenceEncounterWorkbench';
import { CandidateSelect } from './CandidateSelect';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
} from '@planner/projections/structured-workspace';

export function ShipCombatPhaseCountWorkbench({
  occurrence,
  interactions,
}: {
  readonly occurrence: OccurrenceAddress;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const dispatch = useAppDispatch();
  const interaction = requireWorkspaceInteraction(
    interactions.shipCombatPhaseCounts,
    workspaceInteractionKey(occurrence),
  );
  return (
    <section aria-label="Room overview" className="ship-combat-editor">
      <div className="local-reward-heading">
        <h4>Combat phases</h4>
      </div>
      <CandidateSelect
        id={`room-${occurrence.occurrenceId}-combat-phase-count`}
        interaction={interaction}
        label="Combat phases"
        onReplace={(encounterCount) =>
          dispatch(
            authoredProjectCommandDispatched({
              kind: 'ReplaceShipEncounterCount',
              occurrence,
              encounterCount,
            }),
          )
        }
      />
    </section>
  );
}

export function DirectRoomWorkbench({
  idPrefix,
  interactions,
  localVisit,
  room,
  view,
  shipPhaseKey,
  renderRoomActionRowContent,
  renderLifecycleBoundaryContent,
  renderOptionalRoomActionContent,
  renderRoomOverviewContent,
}: {
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit?: WorkspaceLocalVisitDecision;
  readonly room: WorkspaceRoomSummary;
  readonly view: 'overview' | 'actions';
  readonly shipPhaseKey?: string;
  readonly renderRoomActionRowContent?: (row: WorkspaceRoomActions['rows'][number]) => ReactNode;
  readonly renderLifecycleBoundaryContent?: (boundary: WorkspaceRoomLifecycleBoundary) => ReactNode;
  readonly renderOptionalRoomActionContent?: () => ReactNode;
  readonly renderRoomOverviewContent?: () => ReactNode;
}) {
  const workbench = room.workbench;
  const renderEncounterPhase = (phase: WorkspaceEncounterPhase): ReactNode => (
    <EncounterPhaseControl idPrefix={idPrefix} interactions={interactions} phase={phase} />
  );
  const renderRewardWheel = (
    wheel: Parameters<typeof RewardWheelWorkbench>[0]['wheel'],
  ): ReactNode => (
    <RewardWheelWorkbench interactions={interactions} occurrence={room.address} wheel={wheel} />
  );
  switch (workbench.kind) {
    case 'standard':
      return (
        <>
          {view === 'overview' ? (
            <>
              {localVisit === undefined ? null : (
                <LocalVisitWorkbench interactions={interactions} localVisit={localVisit} />
              )}
              {renderRoomOverviewContent?.()}
              <RoomFeaturesWorkbench
                features={workbench.features}
                interactions={interactions}
                {...(workbench.roomActions === undefined
                  ? {}
                  : { roomActions: workbench.roomActions })}
              />
            </>
          ) : (
            <RoomActionsWorkbench
              {...(workbench.roomActions === undefined ? {} : { actions: workbench.roomActions })}
              encounterPhases={workbench.encounterPhases}
              idPrefix={idPrefix}
              interactions={interactions}
              optionalChildren={renderOptionalRoomActionContent?.()}
              renderEncounterPhase={renderEncounterPhase}
              renderRewardWheel={renderRewardWheel}
              {...(renderRoomActionRowContent === undefined
                ? {}
                : { renderRowContent: renderRoomActionRowContent })}
              {...(renderLifecycleBoundaryContent === undefined
                ? {}
                : { renderBoundaryContent: renderLifecycleBoundaryContent })}
            />
          )}
        </>
      );
    case 'fields':
      return (
        <>
          {view === 'overview' ? (
            <>
              <FieldsWorkbench interactions={interactions} room={workbench.fields} />
              {localVisit === undefined ? null : (
                <LocalVisitWorkbench interactions={interactions} localVisit={localVisit} />
              )}
              {renderRoomOverviewContent?.()}
              <RoomFeaturesWorkbench
                features={workbench.features}
                interactions={interactions}
                {...(workbench.roomActions === undefined
                  ? {}
                  : { roomActions: workbench.roomActions })}
              />
            </>
          ) : (
            <RoomActionsWorkbench
              {...(workbench.roomActions === undefined ? {} : { actions: workbench.roomActions })}
              encounterPhases={workbench.encounterPhases}
              idPrefix={idPrefix}
              interactions={interactions}
              renderEncounterPhase={renderEncounterPhase}
              renderRewardWheel={renderRewardWheel}
              {...(renderRoomActionRowContent === undefined
                ? {}
                : { renderRowContent: renderRoomActionRowContent })}
              {...(renderLifecycleBoundaryContent === undefined
                ? {}
                : { renderBoundaryContent: renderLifecycleBoundaryContent })}
            />
          )}
        </>
      );
    case 'shop':
      return (
        <>
          {view === 'overview' ? (
            <>
              <ShopWorkbench interactions={interactions} room={workbench.shop} />
              {localVisit === undefined ? null : (
                <LocalVisitWorkbench interactions={interactions} localVisit={localVisit} />
              )}
              {renderRoomOverviewContent?.()}
              <RoomFeaturesWorkbench
                features={workbench.features}
                interactions={interactions}
                {...(workbench.roomActions === undefined
                  ? {}
                  : { roomActions: workbench.roomActions })}
              />
            </>
          ) : (
            <RoomActionsWorkbench
              {...(workbench.roomActions === undefined ? {} : { actions: workbench.roomActions })}
              idPrefix={idPrefix}
              interactions={interactions}
              renderEncounterPhase={renderEncounterPhase}
              renderRewardWheel={renderRewardWheel}
              {...(renderRoomActionRowContent === undefined
                ? {}
                : { renderRowContent: renderRoomActionRowContent })}
              {...(renderLifecycleBoundaryContent === undefined
                ? {}
                : { renderBoundaryContent: renderLifecycleBoundaryContent })}
            />
          )}
        </>
      );
    case 'ship':
      return (
        <>
          {view === 'overview' ? (
            <>
              <ShipCombatPhaseCountWorkbench
                occurrence={room.address}
                interactions={interactions}
              />
              {renderRoomOverviewContent?.()}
              <RoomFeaturesWorkbench
                features={workbench.features}
                interactions={interactions}
                {...(workbench.roomActions === undefined
                  ? {}
                  : { roomActions: workbench.roomActions })}
              />
            </>
          ) : (
            <RoomActionsWorkbench
              {...(workbench.roomActions === undefined ? {} : { actions: workbench.roomActions })}
              encounterPhases={room.encounterPhases}
              idPrefix={idPrefix}
              interactions={interactions}
              renderEncounterPhase={renderEncounterPhase}
              renderRewardWheel={renderRewardWheel}
              {...(renderRoomActionRowContent === undefined
                ? {}
                : { renderRowContent: renderRoomActionRowContent })}
              {...(renderLifecycleBoundaryContent === undefined
                ? {}
                : { renderBoundaryContent: renderLifecycleBoundaryContent })}
              ship={{
                occurrence: room.address,
                phases: workbench.phases,
                repairRows: workbench.repairRows,
                ...(shipPhaseKey === undefined ? {} : { phaseKey: shipPhaseKey }),
              }}
            />
          )}
        </>
      );
  }
}

export function IncomingRewardOverview({
  incomingDoor,
}: {
  readonly incomingDoor: WorkspaceDoorContract | undefined;
}) {
  if (incomingDoor === undefined) return null;
  const preview = incomingDoor.rewardPreview;
  const label =
    preview.kind === 'visible' && preview.rewards.length > 1
      ? 'Incoming Rewards'
      : 'Incoming Reward';
  const summary =
    preview.kind === 'hidden'
      ? 'Hidden'
      : preview.kind === 'none'
        ? 'None'
        : preview.rewards.length === 0
          ? 'None'
          : preview.rewards.map((reward) => reward.summary).join(', ');
  return (
    <section aria-label="Incoming reward" className="room-overview-incoming-reward">
      <span className="room-overview-incoming-label">{label}</span>
      <strong>{summary}</strong>
    </section>
  );
}
