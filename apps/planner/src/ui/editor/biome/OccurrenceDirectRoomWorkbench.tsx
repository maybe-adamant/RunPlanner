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
  WorkspaceBossDoorRewardStoreControl,
} from '@planner/projections/structured-workspace';
import { RoomActionsWorkbench } from './OccurrenceRoomActions';
import { RoomFeaturesWorkbench } from './room-features/RoomFeaturesWorkbench';
import { RoomEncounterStructureWorkbench } from './locals/RoomEncounterStructureWorkbench';
import { EncounterPhaseControl } from './locals/EncounterPhaseControl';
import { FieldsWorkbench } from './locals/FieldsWorkbench';
import { LocalVisitWorkbench } from './locals/LocalVisitWorkbench';
import { RewardWheelWorkbench } from './locals/RewardWheelWorkbench';
import { ShopWorkbench } from './commerce/ShopWorkbench';
import { CandidatePicker } from './CandidatePicker';
import { CandidateSelect } from './CandidateSelect';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
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

/**
 * The authored variant. Its interaction is an ordinary batch reward-store
 * interaction — same catalog map, same candidate model, same picker — so this
 * renders exactly like the batch control and carries no boss-door logic.
 */
function BossDoorRewardStoreEditor({
  idPrefix,
  interactions,
  store,
}: {
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly store: Extract<WorkspaceBossDoorRewardStoreControl, { readonly kind: 'editor' }>;
}) {
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.batchRewardStores,
    workspaceInteractionKey(store.address),
  );
  return (
    <CandidatePicker
      id={`${idPrefix}-boss-door-reward-store`}
      interaction={interaction}
      label={store.label}
      onReplace={(storeKey) => executeIntent(interaction.intentFor(storeKey))}
      placeholder="Select pool"
    />
  );
}

/**
 * The pool row of a boss door, carried in the ordinary outgoing-door section
 * and wearing the ordinary door batch's control layout: a boss door is a door
 * whose destination happens to be fixed. The target boss's declaration selects
 * the variant — a boss that resolves its entered store from the chosen offer is
 * authored here, while a pinned or store-ignoring boss reports its declared
 * outcome with nothing to author.
 */
export function BossDoorRewardPoolRow({
  idPrefix,
  interactions,
  store,
}: {
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly store: WorkspaceBossDoorRewardStoreControl;
}) {
  return (
    <div className="batch-controls">
      {store.kind === 'editor' ? (
        <BossDoorRewardStoreEditor idPrefix={idPrefix} interactions={interactions} store={store} />
      ) : (
        <p className="boss-door-store-declared">{store.summary}</p>
      )}
    </div>
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
  renderRoomActionRowTrailingContent,
  renderLifecycleBoundaryContent,
  renderOptionalRoomActionContent,
}: {
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit?: WorkspaceLocalVisitDecision;
  readonly room: WorkspaceRoomSummary;
  readonly view: 'overview' | 'actions';
  readonly shipPhaseKey?: string;
  readonly renderRoomActionRowContent?: (row: WorkspaceRoomActions['rows'][number]) => ReactNode;
  readonly renderRoomActionRowTrailingContent?: (
    row: WorkspaceRoomActions['rows'][number],
  ) => ReactNode;
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
      if (view === 'overview') {
        return (
          <>
            {renderFeatures()}
            {renderSideRooms()}
            {renderEncounterStructure()}
          </>
        );
      }
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
          {...(renderRoomActionRowTrailingContent === undefined
            ? {}
            : { renderRowTrailingContent: renderRoomActionRowTrailingContent })}
          {...(renderLifecycleBoundaryContent === undefined
            ? {}
            : { renderBoundaryContent: renderLifecycleBoundaryContent })}
        />
      );
    case 'fields':
      if (view === 'overview') {
        return (
          <>
            {renderFeatures()}
            {renderSideRooms()}
            <FieldsWorkbench interactions={interactions} room={workbench.fields} />
            {renderEncounterStructure()}
          </>
        );
      }
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
          {...(renderRoomActionRowTrailingContent === undefined
            ? {}
            : { renderRowTrailingContent: renderRoomActionRowTrailingContent })}
          {...(renderLifecycleBoundaryContent === undefined
            ? {}
            : { renderBoundaryContent: renderLifecycleBoundaryContent })}
        />
      );
    case 'shop':
      if (view === 'overview') {
        return (
          <>
            <ShopWorkbench
              {...(workbench.roomActions === undefined ? {} : { actions: workbench.roomActions })}
              interactions={interactions}
              room={workbench.shop}
            />
            {renderFeatures()}
            {renderSideRooms()}
            {renderEncounterStructure()}
          </>
        );
      }
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
          {...(renderRoomActionRowTrailingContent === undefined
            ? {}
            : { renderRowTrailingContent: renderRoomActionRowTrailingContent })}
          {...(renderLifecycleBoundaryContent === undefined
            ? {}
            : { renderBoundaryContent: renderLifecycleBoundaryContent })}
        />
      );
    case 'ship':
      if (view === 'overview') {
        return (
          <>
            {renderFeatures()}
            {renderEncounterStructure(
              <ShipCombatPhaseCountWorkbench
                occurrence={room.address}
                interactions={interactions}
                nested
              />,
            )}
          </>
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
          {...(renderRoomActionRowTrailingContent === undefined
            ? {}
            : { renderRowTrailingContent: renderRoomActionRowTrailingContent })}
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
