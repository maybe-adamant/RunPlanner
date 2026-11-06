import type { WorkspaceRoomSummary } from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { useFindingMark } from '@planner/ui/feedback/useFindingTarget';
import { roomChoiceIcon } from '../roomIcon';
import { WordOutcomePicker } from '../NemesisEventEditor';
import { semanticAddressKey } from '@run-planner/engine/authored-project';

/**
 * The workspace has already established this is an authored Anomaly and has
 * supplied its closed declaration map domain. These controls intentionally do
 * not ask React to re-evaluate replacement eligibility or reward legality.
 */
export function AnomalyRoomControl({
  ariaLabel,
  room,
}: {
  readonly ariaLabel: string;
  readonly room: WorkspaceRoomSummary;
}) {
  const dispatch = useAppDispatch();
  const anomaly = room.anomaly;
  if (anomaly === undefined) return null;
  return (
    <ContextualPicker
      ariaLabel={ariaLabel}
      label=""
      layout="inline"
      placeholder="Choose a room"
      model={declaredChoicesPicker(
        anomaly.mapChoices.map((choice) => ({ ...choice, key: choice.value })),
        room.gameName,
      )}
      id={`anomaly-map-${room.occurrenceId}`}
      itemIcon={(item) => roomChoiceIcon(anomaly.mapChoices, item.value)}
      triggerIcon={roomChoiceIcon(anomaly.mapChoices, room.gameName)}
      onSelect={(gameName) =>
        dispatch(
          authoredProjectCommandDispatched({
            gameName,
            kind: 'ReplaceAnomalyMap',
            occurrence: room.address,
          }),
        )
      }
    />
  );
}

const anomalyOutcomes = [
  { value: 'cleared', label: 'Cleared' },
  { value: 'notCleared', label: 'Not cleared' },
] as const;

export function AnomalyClearedControl({ room }: { readonly room: WorkspaceRoomSummary }) {
  const dispatch = useAppDispatch();
  const anomaly = room.anomaly;
  if (anomaly === undefined) return null;
  return (
    <WordOutcomePicker
      choices={anomalyOutcomes}
      id={`anomaly-cleared-${semanticAddressKey(room.address)}`}
      name="Anomaly outcome"
      onSelect={(value) =>
        dispatch(
          authoredProjectCommandDispatched({
            kind: 'ReplaceAnomalySuccess',
            occurrence: room.address,
            success: value === 'cleared',
          }),
        )
      }
      selected={anomaly.success ? 'cleared' : 'notCleared'}
    />
  );
}

export function RevertAnomalyAction({
  doorIndex,
  room,
}: {
  /** The door the restored room stands behind, which names the action. */
  readonly doorIndex: number;
  readonly room: WorkspaceRoomSummary;
}) {
  const dispatch = useAppDispatch();
  const findingMark = useFindingMark();
  const anomaly = room.anomaly;
  if (anomaly === undefined) return null;
  return (
    <button
      {...findingMark(room.address, 'revertAnomaly')}
      aria-label={`Restore ${anomaly.rememberedRoomLabel} on Door ${doorIndex}`}
      className="danger-action action-compact"
      data-command="RevertAnomaly"
      onClick={() =>
        dispatch(
          authoredProjectCommandDispatched({
            kind: 'RevertAnomaly',
            occurrence: room.address,
          }),
        )
      }
      type="button"
    >
      Restore
    </button>
  );
}
