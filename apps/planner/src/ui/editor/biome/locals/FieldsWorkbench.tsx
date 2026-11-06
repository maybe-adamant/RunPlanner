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
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import {
  candidateMayBeAuthored,
  candidateWaitingHint,
  candidateWaits,
} from '@planner/ui/feedback/candidatePresentation';
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';
import { RoomMapReferencePane } from '@planner/ui/room-maps/RoomMapReferencePane';
import { hintProps } from '@planner/ui/controls/hint';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { NumberedSlot, NumberedSlots } from '@planner/ui/editor/rewards/NumberedSlots';

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
  const countId = semanticOwnerControlElementId(room.optionalRewardCountAddress);
  return (
    <section aria-label="Optional Rewards" className="fields-room-editor">
      {nested ? null : <h5 className="room-feature-category-heading">Optional Rewards</h5>}
      <div className="room-overview-panel">
        <div className="field-control field-control-inline fields-optional-line">
          <span aria-hidden="true">Rewards</span>
          <span className="fields-optional-rewards">
            <ContextualPicker
              ariaLabel="Optional pickups"
              choiceLabel="Optional pickups"
              findingTarget={findingTarget(room.optionalRewardCountAddress, countId)}
              id={countId}
              label=""
              layout="inline"
              model={declaredChoicesPicker(
                room.optionalRewardCountValues.map((value) => ({
                  key: String(value),
                  value,
                  label: String(value),
                })),
                room.optionalRewardCount,
              )}
              onSelect={(value) =>
                dispatch(
                  authoredProjectCommandDispatched({
                    kind: 'ReplaceFieldsOptionalRewardCount',
                    occurrence: room.owner,
                    optionalRewardCount: value,
                  }),
                )
              }
              placeholder="Count"
              searchable={false}
              triggerLabel={String(room.optionalRewardCount)}
            />
            {room.optionalRewards.length === 0 ? null : (
              <NumberedSlots label="Optional rewards">
                {room.optionalRewards.map((reward, index) => (
                  <NumberedSlot hint={`Reward ${index + 1}`} key={reward.key} number={index + 1}>
                    <RewardControlEditor
                      ariaLabel={`${reward.label} reward`}
                      control={reward.control}
                      idPrefix={`fields-${room.owner.occurrenceId}-optional-${reward.key}`}
                      interactions={interactions}
                      label=""
                      triggerSize="icon"
                    />
                  </NumberedSlot>
                ))}
              </NumberedSlots>
            )}
          </span>
        </div>
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
  const findingTarget = useFindingTarget();
  const interaction = requireWorkspaceInteraction(
    interactions.fieldsSpatialPoints,
    control.interactionKey,
  );
  const candidates = useWorkspaceInteraction(interaction);
  const id = semanticOwnerControlElementId(control.address);
  return (
    <div className="fields-layout-row">
      <div className="fields-layout-context">
        <span>{control.label}</span>
        {context === undefined ? null : (
          <span className="fields-layout-context-detail">{context}</span>
        )}
      </div>
      <div
        {...findingTarget(control.address)}
        aria-label={`${control.label} position`}
        aria-busy={candidates.pending || undefined}
        className="fields-layout-positions"
        onFocus={candidates.activate}
        onPointerDown={candidates.activate}
        role="radiogroup"
        tabIndex={-1}
      >
        {interaction.choices
          .filter((choice) => choice.value !== null)
          .map((choice, index) => {
            const option = candidates.result?.find((candidate) => candidate.value === choice.value);
            return (
              <label className="fields-layout-position" key={choice.value}>
                <input
                  aria-label={choice.label}
                  checked={interaction.selected === choice.value}
                  disabled={
                    !interaction.contextReached ||
                    (option !== undefined && !candidateMayBeAuthored(option))
                  }
                  {...hintProps(
                    !interaction.contextReached || candidateWaits(option)
                      ? candidateWaitingHint
                      : undefined,
                  )}
                  name={id}
                  onChange={() => {
                    const assessed = candidates
                      .activate()
                      ?.find((candidate) => candidate.value === choice.value);
                    if (candidateMayBeAuthored(assessed))
                      executeIntent(interaction.intentFor(choice.value));
                  }}
                  type="radio"
                  value={choice.value ?? ''}
                />
                <span>{index + 1}</span>
              </label>
            );
          })}
      </div>
    </div>
  );
}

/** Physical H Fields placement only; reward and feature authoring stays in its owning tabs. */
export function FieldsLayoutWorkbench({
  gameName,
  hostId,
  interactions,
  room,
  title,
}: {
  readonly gameName: string;
  readonly hostId: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'fields' }>;
  readonly title: string;
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
      <div className="fields-layout-reference-layout">
        <div className="fields-layout-controls">
          <div className="local-reward-heading fields-layout-heading">
            <h4>Fields Layout</h4>
            <h4>Position</h4>
          </div>
          {entry === undefined ? null : (
            <FieldsSpatialRow control={entry} interactions={interactions} />
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
        </div>
        <RoomMapReferencePane gameName={gameName} hostId={hostId} title={title} />
      </div>
    </section>
  );
}
