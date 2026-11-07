import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomFeature,
} from '@planner/projections/structured-workspace';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { IconToggle } from '@planner/ui/controls/IconToggle';
import { ArtworkChip } from '@planner/ui/editor/rewards/TimelineChip';
import { doorArtwork } from '@planner/ui/artwork/doors/doorArtwork';
import { useRoomMapHighlightActions } from '../room-map/roomMapHighlight';

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
  // The open position list shows the room's Chaos points on its map, previewing the highlighted one.
  const mapPreview = useRoomMapHighlightActions();
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
        <ContextualPicker<number | null>
          ariaLabel="Chaos Gate position"
          findingTarget={positionTarget}
          id={`chaos-position-${workspaceInteractionKey(owner)}`}
          invalid={position.invalid}
          label=""
          layout="inline"
          model={declaredChoicesPicker(
            [
              { key: 'any', value: null, label: 'Any position' },
              ...(position.invalid && position.value !== null
                ? [
                    {
                      key: String(position.value),
                      value: position.value,
                      label: `Position ${position.value}`,
                      disabled: true,
                    },
                  ]
                : []),
              ...position.choices.map((value) => ({
                key: String(value),
                value,
                label: `Position ${value}`,
              })),
            ],
            position.value,
            'Gate position',
          )}
          onActiveChange={(item) =>
            mapPreview?.show({ kind: 'chaosPoints', position: item?.value ?? undefined })
          }
          onOpenChange={(open) =>
            open
              ? mapPreview?.show({ kind: 'chaosPoints' })
              : mapPreview?.release({ kind: 'chaosPoints' })
          }
          onSelect={(value) => {
            if (value === position.value) return;
            executeIntent(
              requireWorkspaceInteraction(
                interactions.chaosExits,
                workspaceInteractionKey(owner),
              ).positionIntent(value),
            );
          }}
          placeholder="Any"
          searchable={false}
          triggerHint={
            position.invalid
              ? `Position ${position.value} isn’t available in this room`
              : 'Gate position'
          }
          triggerLabel={position.value === null ? 'Any' : String(position.value)}
          triggerSize="content"
        />
      )}
    </div>
  );
}
