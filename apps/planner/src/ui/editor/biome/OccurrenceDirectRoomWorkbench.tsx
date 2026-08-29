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
import { RoomEncounterStructureWorkbench, RoomFeaturesWorkbench } from './OccurrenceRoomFeatures';
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
  nested = false,
}: {
  readonly occurrence: OccurrenceAddress;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly nested?: boolean;
}) {
  const dispatch = useAppDispatch();
  const interaction = requireWorkspaceInteraction(
    interactions.shipCombatPhaseCounts,
    workspaceInteractionKey(occurrence),
  );
  return (
    <section aria-label="Room overview" className="ship-combat-editor">
      {nested ? null : (
        <div className="local-reward-heading">
          <h4>Combat phases</h4>
        </div>
      )}
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
}: {
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit?: WorkspaceLocalVisitDecision;
  readonly room: WorkspaceRoomSummary;
  readonly view: 'overview' | 'features' | 'sideRooms' | 'minorRewards' | 'encounters' | 'actions';
  readonly shipPhaseKey?: string;
  readonly renderRoomActionRowContent?: (row: WorkspaceRoomActions['rows'][number]) => ReactNode;
  readonly renderLifecycleBoundaryContent?: (boundary: WorkspaceRoomLifecycleBoundary) => ReactNode;
  readonly renderOptionalRoomActionContent?: () => ReactNode;
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
  const renderFeatures = (): ReactNode => (
    <RoomFeaturesWorkbench
      features={workbench.features}
      interactions={interactions}
      room={room}
      {...(workbench.roomActions === undefined ? {} : { roomActions: workbench.roomActions })}
    />
  );
  const renderSideRooms = (): ReactNode =>
    localVisit === undefined ? null : (
      <LocalVisitWorkbench interactions={interactions} localVisit={localVisit} />
    );
  const renderEncounterStructure = (children?: ReactNode): ReactNode => (
    <RoomEncounterStructureWorkbench features={workbench.features} interactions={interactions}>
      {children}
    </RoomEncounterStructureWorkbench>
  );
  switch (workbench.kind) {
    case 'standard':
      if (view === 'overview' || view === 'minorRewards') return null;
      if (view === 'features') return renderFeatures();
      if (view === 'sideRooms') return renderSideRooms();
      if (view === 'encounters') return renderEncounterStructure();
      return (
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
      );
    case 'fields':
      if (view === 'overview') return null;
      if (view === 'features') return renderFeatures();
      if (view === 'sideRooms') return renderSideRooms();
      if (view === 'minorRewards') {
        return <FieldsWorkbench interactions={interactions} room={workbench.fields} />;
      }
      if (view === 'encounters') return renderEncounterStructure();
      return (
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
      );
    case 'shop':
      if (view === 'overview') {
        return <ShopWorkbench interactions={interactions} room={workbench.shop} />;
      }
      if (view === 'features') return renderFeatures();
      if (view === 'sideRooms') return renderSideRooms();
      if (view === 'minorRewards') return null;
      if (view === 'encounters') return renderEncounterStructure();
      return (
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
      );
    case 'ship':
      if (view === 'overview' || view === 'sideRooms' || view === 'minorRewards') return null;
      if (view === 'features') return renderFeatures();
      if (view === 'encounters') {
        return renderEncounterStructure(
          <ShipCombatPhaseCountWorkbench
            occurrence={room.address}
            interactions={interactions}
            nested
          />,
        );
      }
      return (
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
      );
  }
}

export function IncomingRewardOverview({
  incomingDoor,
}: {
  readonly incomingDoor: WorkspaceDoorContract | undefined;
}) {
  if (incomingDoor === undefined) return null;
  const preview = incomingDoor.offerRewardSurface;
  const label =
    preview.visibility === 'visible' && preview.rewards.length > 1
      ? 'Incoming Rewards'
      : 'Incoming Reward';
  const summary =
    preview.visibility === 'hidden'
      ? 'Hidden'
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
