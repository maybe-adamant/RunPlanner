import {
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';
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
