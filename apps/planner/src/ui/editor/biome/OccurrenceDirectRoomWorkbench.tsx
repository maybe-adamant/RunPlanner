import type { OccurrenceAddress } from '@run-planner/engine/authored-project';
import type { ReactNode } from 'react';
import type {
  WorkspaceEncounterPhase,
  WorkspaceDoorContract,
  WorkspaceInteractionCatalog,
  WorkspaceRoomActions,
  WorkspaceRoomLifecycleBoundary,
  WorkspaceRoomSummary,
  WorkspaceShipPhasePresentation,
  WorkspaceBossDoorRewardStoreControl,
} from '@planner/projections/structured-workspace';
import { RoomActionsWorkbench, type TimelineBoundaryContent } from './OccurrenceRoomActions';
import { roomFeatureSections } from './room-features/roomFeatureSections';
import { RoomOverviewSections, type RoomOverviewSectionContent } from './RoomOverviewSections';
import { RoomEncounterStructureWorkbench } from './locals/RoomEncounterStructureWorkbench';
import { EncounterPhaseControl, EncounterPhaseEvents } from './locals/EncounterPhaseControl';
import { FieldsWorkbench } from './locals/FieldsWorkbench';
import { RewardWheelWorkbench } from './locals/RewardWheelWorkbench';
import { ShopWorkbench } from './commerce/ShopWorkbench';
import { CandidatePicker } from './CandidatePicker';
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
      <CandidatePicker
        id={`room-${occurrence.occurrenceId}-combat-phase-count`}
        interaction={interaction}
        label="Combat phases"
        placeholder="Choose combat phases"
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
    <div className="door-reward-list">
      {store.kind === 'editor' ? (
        <BossDoorRewardStoreEditor idPrefix={idPrefix} interactions={interactions} store={store} />
      ) : (
        <div className="field-control field-control-inline door-fixed-reward">
          <span>Reward Pool</span>
          <span className="fixed-room-state">{store.summary}</span>
        </div>
      )}
    </div>
  );
}

export function DirectRoomWorkbench({
  idPrefix,
  interactions,
  room,
  view,
  renderRoomActionRowContent,
  renderRoomActionRowRemoval,
  renderLifecycleBoundaryContent,
  renderOptionalRoomActionContent,
}: {
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: WorkspaceRoomSummary;
  readonly view:
    | 'overview'
    | 'actions'
    | { readonly kind: 'shipPhase'; readonly phase: WorkspaceShipPhasePresentation };
  readonly renderRoomActionRowContent?: (row: WorkspaceRoomActions['rows'][number]) => ReactNode;
  readonly renderRoomActionRowRemoval?: (row: WorkspaceRoomActions['rows'][number]) => ReactNode;
  readonly renderLifecycleBoundaryContent?: (
    boundary: WorkspaceRoomLifecycleBoundary,
  ) => TimelineBoundaryContent | undefined;
  readonly renderOptionalRoomActionContent?: () => ReactNode;
}) {
  const workbench = room.workbench;
  const renderEncounterPhase = (phase: WorkspaceEncounterPhase): ReactNode => (
    <EncounterPhaseEvents interactions={interactions} phase={phase} />
  );
  // Every phase's identity and customization are fixed on entry: the room Overview.
  const renderOverviewEncounterPhases = (): ReactNode =>
    room.encounterPhases.length === 0
      ? undefined
      : room.encounterPhases.map((phase) => (
          <EncounterPhaseControl
            idPrefix={idPrefix}
            key={phase.address.phaseKey}
            interactions={interactions}
            phase={phase}
          />
        ));
  const renderRewardWheel = (
    wheel: Parameters<typeof RewardWheelWorkbench>[0]['wheel'],
  ): ReactNode => (
    <RewardWheelWorkbench interactions={interactions} occurrence={room.address} wheel={wheel} />
  );
  // Each room kind contributes its sections; RoomOverviewSections owns their order.
  const renderOverview = (
    sections: Pick<RoomOverviewSectionContent, 'encounters' | 'contents'>,
  ): ReactNode => (
    <RoomOverviewSections
      sections={{
        ...sections,
        ...roomFeatureSections({
          features: workbench.features,
          interactions,
          room,
          ...(workbench.roomActions === undefined ? {} : { roomActions: workbench.roomActions }),
        }),
      }}
    />
  );
  const renderEncounterStructure = (children?: ReactNode): ReactNode => (
    <RoomEncounterStructureWorkbench features={workbench.features} interactions={interactions}>
      {children}
    </RoomEncounterStructureWorkbench>
  );
  switch (workbench.kind) {
    case 'standard':
      if (view === 'overview') {
        return renderOverview({
          encounters: renderEncounterStructure(renderOverviewEncounterPhases()),
        });
      }
      return (
        <RoomActionsWorkbench
          mode={{ kind: 'roomTimeline' }}
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
          {...(renderRoomActionRowRemoval === undefined
            ? {}
            : { renderRowRemoval: renderRoomActionRowRemoval })}
          {...(renderLifecycleBoundaryContent === undefined
            ? {}
            : { renderBoundaryContent: renderLifecycleBoundaryContent })}
        />
      );
    case 'fields':
      if (view === 'overview') {
        return renderOverview({
          encounters: renderEncounterStructure(renderOverviewEncounterPhases()),
          contents: <FieldsWorkbench interactions={interactions} room={workbench.fields} />,
        });
      }
      return (
        <RoomActionsWorkbench
          mode={{ kind: 'roomTimeline' }}
          {...(workbench.roomActions === undefined ? {} : { actions: workbench.roomActions })}
          encounterPhases={workbench.encounterPhases}
          idPrefix={idPrefix}
          interactions={interactions}
          renderEncounterPhase={renderEncounterPhase}
          renderRewardWheel={renderRewardWheel}
          {...(renderRoomActionRowContent === undefined
            ? {}
            : { renderRowContent: renderRoomActionRowContent })}
          {...(renderRoomActionRowRemoval === undefined
            ? {}
            : { renderRowRemoval: renderRoomActionRowRemoval })}
          {...(renderLifecycleBoundaryContent === undefined
            ? {}
            : { renderBoundaryContent: renderLifecycleBoundaryContent })}
        />
      );
    case 'shop':
      if (view === 'overview') {
        return renderOverview({
          encounters: renderEncounterStructure(renderOverviewEncounterPhases()),
          contents: <ShopWorkbench interactions={interactions} room={workbench.shop} />,
        });
      }
      return (
        <RoomActionsWorkbench
          mode={{ kind: 'roomTimeline' }}
          {...(workbench.roomActions === undefined ? {} : { actions: workbench.roomActions })}
          idPrefix={idPrefix}
          interactions={interactions}
          renderEncounterPhase={renderEncounterPhase}
          renderRewardWheel={renderRewardWheel}
          {...(renderRoomActionRowContent === undefined
            ? {}
            : { renderRowContent: renderRoomActionRowContent })}
          {...(renderRoomActionRowRemoval === undefined
            ? {}
            : { renderRowRemoval: renderRoomActionRowRemoval })}
          {...(renderLifecycleBoundaryContent === undefined
            ? {}
            : { renderBoundaryContent: renderLifecycleBoundaryContent })}
        />
      );
    case 'ship':
      if (view === 'overview') {
        return renderOverview({
          encounters: renderEncounterStructure(
            <>
              <ShipCombatPhaseCountWorkbench
                occurrence={room.address}
                interactions={interactions}
                nested
              />
              {renderOverviewEncounterPhases()}
            </>,
          ),
        });
      }
      if (typeof view === 'string') throw new Error('Ship timeline requires an explicit phase');
      return (
        <RoomActionsWorkbench
          mode={view}
          {...(workbench.roomActions === undefined ? {} : { actions: workbench.roomActions })}
          encounterPhases={room.encounterPhases}
          idPrefix={idPrefix}
          interactions={interactions}
          renderEncounterPhase={renderEncounterPhase}
          renderRewardWheel={renderRewardWheel}
          {...(renderRoomActionRowContent === undefined
            ? {}
            : { renderRowContent: renderRoomActionRowContent })}
          {...(renderRoomActionRowRemoval === undefined
            ? {}
            : { renderRowRemoval: renderRoomActionRowRemoval })}
          {...(renderLifecycleBoundaryContent === undefined
            ? {}
            : { renderBoundaryContent: renderLifecycleBoundaryContent })}
        />
      );
  }
}

export function IncomingRewardSummary({
  incomingDoor,
}: {
  readonly incomingDoor: WorkspaceDoorContract | undefined;
}) {
  if (incomingDoor === undefined) return null;
  const preview = incomingDoor.offerRewardSurface;
  if (preview.visibility === 'visible' && preview.rewards.length === 0) return null;
  const summary =
    preview.visibility === 'hidden'
      ? 'Hidden'
      : preview.rewards.map((reward) => reward.summary).join(', ');
  return (
    <section aria-label="Incoming reward" className="room-heading-incoming-reward">
      <span aria-hidden="true">·</span>
      <span>{summary}</span>
    </section>
  );
}
