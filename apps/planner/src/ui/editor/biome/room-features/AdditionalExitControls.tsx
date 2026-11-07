import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomFeature,
} from '@planner/projections/structured-workspace';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { hintProps } from '@planner/ui/controls/hint';
import { IconToggle } from '@planner/ui/controls/IconToggle';
import { ArtworkChip } from '@planner/ui/editor/rewards/TimelineChip';
import { doorArtwork } from '@planner/ui/artwork/doors/doorArtwork';

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
    <div className="room-feature-presence-row additional-exit-row">
      <IconToggle
        disabled={feature.presence.kind === 'optionalAbsent' && !feature.presence.enabled}
        icon={doorArtwork.ZagContract ?? undefined}
        name="Zagreus Contract"
        onToggle={() =>
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
        pressed={feature.action === 'remove'}
        {...(feature.action === 'add' ? { target: findingTarget(owner) } : {})}
      />
    </div>
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
  const positionTarget = findingTarget(owner);
  return (
    <div className="room-feature-presence-row additional-exit-row">
      {/* A Chaos Gate the room always has is shown, with nothing to toggle. */}
      {feature.presence.kind === 'forcedPresent' ? (
        <ArtworkChip icon={doorArtwork.ChaosExitDoor ?? undefined} label="Chaos Gate" />
      ) : (
        <IconToggle
          disabled={feature.presence.kind === 'optionalAbsent' && !feature.presence.enabled}
          icon={doorArtwork.ChaosExitDoor ?? undefined}
          name="Chaos Gate"
          onToggle={() => {
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
          pressed={feature.action === 'remove'}
          target={
            position === undefined
              ? findingTarget(owner)
              : findingTarget(
                  owner,
                  `chaos-presence-${workspaceInteractionKey(owner)}`,
                  owner,
                  () => false,
                )
          }
        />
      )}
      {position === undefined ? null : (
        <div
          {...positionTarget}
          aria-label="Position"
          aria-invalid={position.invalid || undefined}
          className="chaos-position-control"
          role="radiogroup"
          tabIndex={-1}
          {...hintProps(
            position.invalid
              ? `Position ${position.value} isn’t available in this room.`
              : undefined,
            positionTarget['aria-description'],
          )}
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
              {value ?? 'Any'}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
