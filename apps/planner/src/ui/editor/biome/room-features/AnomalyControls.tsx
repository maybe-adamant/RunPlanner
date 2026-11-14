import type { WorkspaceRoomSummary } from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { useFindingMark } from '@planner/ui/feedback/useFindingTarget';
import { roomChoiceIcon } from '../roomIcon';
import { WordOutcomePicker } from '../NemesisEventEditor';
import { semanticAddressKey } from '@run-planner/engine/authored-project';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { anomalyIcon } from '@planner/ui/artwork/doors/doorArtwork';
import { exitDoorIcon } from '@planner/ui/artwork/roomArtwork';
import { hintProps } from '@planner/ui/controls/hint';
import type { FindingMarkProps } from '@planner/ui/feedback/useFindingTarget';
import type { ButtonHTMLAttributes } from 'react';

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

/**
 * A door's one-press change as an icon: what the door becomes, with an arrow
 * badge saying it is an action. The icon alone does not say what it does, so
 * its name is also its hint.
 */
export function DoorChangeAction({
  badge,
  icon,
  name,
  target,
  ...button
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  readonly badge: '→' | '↺';
  readonly icon: string | undefined;
  readonly name: string;
  readonly target?: FindingMarkProps;
}) {
  return (
    <button
      {...target}
      {...hintProps(name, target?.['aria-description'], name)}
      {...button}
      aria-label={name}
      className="door-change-action"
      type="button"
    >
      <ArtworkIcon className="artwork-label-icon" source={icon} />
      <span aria-hidden="true" className="corner-badge timeline-chip-badge">
        {badge}
      </span>
    </button>
  );
}

/** Turns a picked door's room into an Anomaly. */
export function MakeAnomalyAction({ onMake }: { readonly onMake: () => void }) {
  return (
    <DoorChangeAction
      badge="→"
      data-command="SwitchTargetToAnomaly"
      icon={anomalyIcon}
      name="Make Anomaly"
      onClick={onMake}
    />
  );
}

/** Restores the room an Anomaly replaced, shown as the biome's ordinary door. */
export function RevertAnomalyAction({ room }: { readonly room: WorkspaceRoomSummary }) {
  const dispatch = useAppDispatch();
  const findingMark = useFindingMark();
  const anomaly = room.anomaly;
  if (anomaly === undefined) return null;
  return (
    <DoorChangeAction
      badge="↺"
      data-command="RevertAnomaly"
      icon={exitDoorIcon(room.address.biomeKey)}
      name="Restore door"
      onClick={() =>
        dispatch(
          authoredProjectCommandDispatched({
            kind: 'RevertAnomaly',
            occurrence: room.address,
          }),
        )
      }
      target={findingMark(room.address, 'revertAnomaly')}
    />
  );
}
