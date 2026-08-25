import type {
  WorkspaceFieldsCageSlotControl,
  WorkspaceRoomLifecycleBoundary,
} from '@planner/projections/structured-workspace';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';

/** Render-only boundary row; timeline placement remains the projection's authority. */
export function LifecycleBoundaryRow({
  boundary,
  label,
  dropIndex,
  dropState,
  fieldsCageSlot,
  onSelectFieldsCage,
}: {
  readonly boundary: WorkspaceRoomLifecycleBoundary;
  readonly label: string;
  readonly dropIndex: number;
  readonly dropState?: 'available' | 'unavailable';
  readonly fieldsCageSlot?: WorkspaceFieldsCageSlotControl;
  readonly onSelectFieldsCage?: (proposalKey: string) => void;
}) {
  return (
    <li
      aria-label={label}
      className="room-action-lifecycle-boundary"
      data-drop-position={dropState}
      data-fields-cage-slot={fieldsCageSlot === undefined ? undefined : 'true'}
      data-lifecycle-boundary={boundary.key}
      data-room-action-drop-index={dropIndex}
      {...(fieldsCageSlot === undefined
        ? {}
        : { id: semanticOwnerControlElementId(fieldsCageSlot.owner), tabIndex: -1 })}
    >
      <span aria-hidden="true" className="hub-roster-rank">
        ·
      </span>
      <strong>{label}</strong>
      {fieldsCageSlot === undefined ? null : (
        <label className="fields-cage-slot-control">
          <span className="visually-hidden">Cage for encounter {fieldsCageSlot.slotOrdinal}</span>
          <select
            aria-label={`Cage for encounter ${fieldsCageSlot.slotOrdinal}`}
            onChange={(event) => {
              const choice = fieldsCageSlot.choices.find(
                (candidate) => candidate.value === event.target.value,
              );
              if (choice?.proposalKey !== undefined) onSelectFieldsCage?.(choice.proposalKey);
            }}
            value={fieldsCageSlot.selected}
          >
            {fieldsCageSlot.choices.map((choice) => (
              <option
                disabled={choice.proposalKey === undefined}
                key={choice.value}
                value={choice.value}
              >
                {choice.label}
              </option>
            ))}
          </select>
          <SemanticOwnerMarker address={fieldsCageSlot.marker.address} />
        </label>
      )}
    </li>
  );
}
