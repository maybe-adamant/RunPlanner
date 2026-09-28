import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceChaosExitControl,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomFeature,
} from '@planner/projections/structured-workspace';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { RoomMapLauncher } from '@planner/ui/room-maps/RoomMapDialog';

export function ChaosMapWorkbench({
  control,
  interactions,
}: {
  readonly control: WorkspaceChaosExitControl;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.chaosExits,
    workspaceInteractionKey(control.owner),
  );
  return (
    <div className="additional-exit-map-control">
      <label
        className="field-control field-control-inline"
        htmlFor={`chaos-map-${control.door.room.occurrenceId}`}
      >
        <span>Map</span>
        <select
          id={`chaos-map-${control.door.room.occurrenceId}`}
          onChange={(event) => executeIntent(interaction.mapIntent(event.target.value))}
          value={control.door.room.gameName}
        >
          {control.mapChoices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
      <RoomMapLauncher
        gameName={control.door.room.gameName}
        hostId={workspaceInteractionKey(control.owner)}
        title={control.door.room.label}
      />
    </div>
  );
}

/** The selected Midshop owns only the available spawn affordance. */
export function ZagreusSpawnWorkbench({
  feature,
  interactions,
}: {
  readonly feature: Extract<WorkspaceRoomFeature, { readonly kind: 'zagreusContract' }>;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const owner = feature.action === 'add' ? feature.control.owner : feature.owner;
  return (
    <label className="room-feature-presence-row">
      <input
        {...(feature.action === 'add' ? findingTarget(owner) : {})}
        checked={feature.action === 'remove'}
        data-command={feature.action === 'add' ? 'AddZagreusContract' : 'RemoveZagreusContract'}
        disabled={feature.presence.kind === 'optionalAbsent' && !feature.presence.enabled}
        onChange={() =>
          executeIntent(
            feature.action === 'add'
              ? requireWorkspaceInteraction(
                  interactions.zagreusSpawns,
                  workspaceInteractionKey(owner),
                ).spawnIntent()
              : requireWorkspaceInteraction(
                  interactions.zagreusContracts,
                  workspaceInteractionKey(owner),
                ).removeIntent,
          )
        }
        type="checkbox"
      />
      <span>Zagreus Contract</span>
    </label>
  );
}

/** Presence and physical position belong to the source room's feature row. */
export function ChaosSpawnWorkbench({
  feature,
  interactions,
}: {
  readonly feature: Extract<WorkspaceRoomFeature, { readonly kind: 'chaos' }>;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const owner = feature.action === 'add' ? feature.control.owner : feature.owner;
  const position = feature.action === 'remove' ? feature.position : undefined;
  return (
    <div className="chaos-feature-row">
      <label className="room-feature-presence-row">
        <input
          {...(position === undefined
            ? findingTarget(owner)
            : findingTarget(
                owner,
                `chaos-presence-${workspaceInteractionKey(owner)}`,
                owner,
                () => false,
              ))}
          checked={feature.action === 'remove'}
          data-command={feature.action === 'add' ? 'AddChaos' : 'RemoveChaos'}
          disabled={
            feature.presence.kind === 'forcedPresent' ||
            (feature.presence.kind === 'optionalAbsent' && !feature.presence.enabled)
          }
          onChange={() => {
            if (feature.action === 'add') {
              executeIntent(
                requireWorkspaceInteraction(
                  interactions.chaosSpawns,
                  workspaceInteractionKey(owner),
                ).spawnIntent(),
              );
              return;
            }
            const removeIntent = requireWorkspaceInteraction(
              interactions.chaosExits,
              workspaceInteractionKey(owner),
            ).removeIntent;
            if (removeIntent !== undefined) executeIntent(removeIntent);
          }}
          type="checkbox"
        />
        <span>Chaos Gate</span>
      </label>
      {position === undefined ? null : (
        <div
          {...findingTarget(owner)}
          aria-label="Position"
          aria-invalid={position.invalid || undefined}
          className="chaos-position-control"
          role="radiogroup"
          tabIndex={-1}
        >
          <span>Position</span>
          {[null, ...position.choices].map((value) => (
            <label key={value ?? 'default'}>
              <input
                type="radio"
                name={`chaos-position-${workspaceInteractionKey(owner)}`}
                checked={position.value === value}
                onChange={() =>
                  executeIntent(
                    requireWorkspaceInteraction(
                      interactions.chaosExits,
                      workspaceInteractionKey(owner),
                    ).positionIntent(value),
                  )
                }
              />
              {value ?? 'Default'}
            </label>
          ))}
          {position.invalid ? <span>Position {position.value} unavailable</span> : null}
        </div>
      )}
    </div>
  );
}
