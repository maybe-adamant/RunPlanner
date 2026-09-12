import type { ReactNode } from 'react';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomSummary,
  type WorkspaceFieldsSpatialControl,
} from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';
import { CandidateSelect } from '../CandidateSelect';

export function FieldsWorkbench({
  interactions,
  nested = false,
  room,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly nested?: boolean;
  readonly room: Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'fields' }>;
}) {
  const findingTarget = useFindingTarget();
  const dispatch = useAppDispatch();
  return (
    <section aria-label="Fields setup" className="fields-room-editor">
      {nested ? null : (
        <div className="local-reward-heading">
          <h4>Fields setup</h4>
        </div>
      )}
      <label className="field-control field-control-inline">
        <span>Optional pickups</span>
        <select
          {...findingTarget(room.optionalRewardCountAddress)}
          aria-label="Optional pickups"
          onChange={(event) =>
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'ReplaceFieldsOptionalRewardCount',
                occurrence: room.owner,
                optionalRewardCount: Number(event.target.value),
              }),
            )
          }
          value={room.optionalRewardCount}
        >
          {room.optionalRewardCountValues.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <div className="fields-reward-identities">
        <div className="local-reward-heading">
          <h5>Optional reward identities</h5>
        </div>
        {room.optionalRewards.map((reward) => (
          <div className="fields-reward-identity" key={reward.key}>
            <RewardControlEditor
              control={reward.control}
              idPrefix={`fields-${room.owner.occurrenceId}-optional-${reward.key}`}
              interactions={interactions}
              label={reward.label}
              showAcquisitionChildren={false}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function FieldsSpatialRow({
  control,
  context,
  interactions,
}: {
  readonly control: WorkspaceFieldsSpatialControl;
  readonly context?: string;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.fieldsSpatialPoints,
    control.interactionKey,
  );
  return (
    <div className="fields-layout-row">
      <div className="fields-layout-context">
        <span>{control.label}</span>
        {context === undefined ? null : (
          <span className="fields-layout-context-detail">{context}</span>
        )}
      </div>
      <CandidateSelect
        id={semanticOwnerControlElementId(control.address)}
        interaction={interaction}
        label="Point"
        onReplace={(pointId) => executeIntent(interaction.intentFor(pointId))}
      />
    </div>
  );
}

/** Physical H Fields placement only; reward and feature authoring stays in its owning tabs. */
export function FieldsLayoutWorkbench({
  interactions,
  room,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'fields' }>;
}) {
  const contextFor = (control: WorkspaceFieldsSpatialControl): string | undefined => {
    const target = control.target;
    if (target.kind === 'cage') {
      return room.cages.find((cage) => cage.key === target.slotKey)?.summary;
    }
    if (target.kind === 'optional') {
      return room.optionalRewards.find((reward) => reward.key === target.slotKey)?.summary;
    }
    return undefined;
  };
  const entry = room.spatial.find((control) => control.target.kind === 'entry');
  const cages = room.spatial.filter((control) => control.target.kind === 'cage');
  const optional = room.spatial.filter((control) => control.target.kind === 'optional');
  const nemesis = room.spatial.find((control) => control.target.kind === 'nemesis');
  const renderSpatialRow = (control: WorkspaceFieldsSpatialControl): ReactNode => {
    const context = contextFor(control);
    return (
      <FieldsSpatialRow
        control={control}
        {...(context === undefined ? {} : { context })}
        interactions={interactions}
        key={control.interactionKey}
      />
    );
  };
  return (
    <section aria-label="Fields Layout" className="fields-layout-editor">
      <div className="local-reward-heading">
        <h4>Fields Layout</h4>
      </div>
      {entry === undefined ? null : (
        <div className="fields-layout-group">
          <h5>Entry</h5>
          <FieldsSpatialRow control={entry} interactions={interactions} />
        </div>
      )}
      {cages.length === 0 ? null : (
        <div className="fields-layout-group">
          <h5>Cage placements</h5>
          {cages.map(renderSpatialRow)}
        </div>
      )}
      {optional.length === 0 ? null : (
        <div className="fields-layout-group">
          <h5>Optional pickups</h5>
          {optional.map(renderSpatialRow)}
        </div>
      )}
      {nemesis === undefined ? null : (
        <div className="fields-layout-group">
          <h5>Nemesis</h5>
          <FieldsSpatialRow control={nemesis} interactions={interactions} />
        </div>
      )}
    </section>
  );
}
