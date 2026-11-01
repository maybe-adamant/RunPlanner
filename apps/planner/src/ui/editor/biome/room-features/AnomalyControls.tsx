import type { WorkspaceRoomSummary } from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { useFindingMark } from '@planner/ui/feedback/useFindingTarget';

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

export function AnomalyClearedControl({ room }: { readonly room: WorkspaceRoomSummary }) {
  const dispatch = useAppDispatch();
  const anomaly = room.anomaly;
  if (anomaly === undefined) return null;
  return (
    <label className="timeline-checkbox">
      <input
        checked={anomaly.success}
        onChange={(event) =>
          dispatch(
            authoredProjectCommandDispatched({
              kind: 'ReplaceAnomalySuccess',
              occurrence: room.address,
              success: event.target.checked,
            }),
          )
        }
        type="checkbox"
      />
      <span>Cleared</span>
    </label>
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
      Restore {anomaly.rememberedRoomLabel}
    </button>
  );
}
