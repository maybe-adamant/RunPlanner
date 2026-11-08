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
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { useRoomMapHighlightActions, useRoomMapLinks } from '../room-map/roomMapHighlight';

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

/** Whether the room holds a Chaos gate: a toggle, or the gate a room always has. */
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
              : // The gate's point row carries its findings.
                findingTarget(
                  owner,
                  `chaos-presence-${workspaceInteractionKey(owner)}`,
                  owner,
                  () => false,
                )
          }
        />
      )}
    </div>
  );
}

/** The Chaos gate's point among the room's SecretPoints, `?` leaving it to the game. */
export function ChaosGatePosition({
  feature,
  interactions,
}: {
  readonly feature: Extract<WorkspaceRoomFeature, { readonly kind: 'chaos' }>;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  // The open position list shows the room's Chaos points on its map, previewing the highlighted one.
  const mapPreview = useRoomMapHighlightActions();
  const mapLinks = useRoomMapLinks();
  if (feature.action !== 'remove' || feature.position === undefined) return null;
  const owner = feature.owner;
  const position = feature.position;
  return (
    <div className="room-layout-row" {...mapLinks({ kind: 'chaosGate' })}>
      <span className="room-layout-label">
        <ArtworkIcon
          className="artwork-label-icon"
          source={doorArtwork.ChaosExitDoor ?? undefined}
        />
        Chaos Gate
      </span>
      <ContextualPicker<number | null>
        ariaLabel="Chaos Gate position"
        findingTarget={findingTarget(owner)}
        id={`chaos-position-${workspaceInteractionKey(owner)}`}
        invalid={position.invalid}
        label=""
        layout="inline"
        model={declaredChoicesPicker(
          [
            { key: 'any', value: null, label: '?' },
            ...(position.invalid && position.value !== null
              ? [
                  {
                    key: String(position.value),
                    value: position.value,
                    label: `P${position.value}`,
                    disabled: true,
                  },
                ]
              : []),
            ...position.choices.map((value) => ({
              key: String(value),
              value,
              label: `P${value}`,
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
        placeholder="?"
        searchable={false}
        {...(position.invalid
          ? { triggerHint: `P${position.value} isn’t available in this room` }
          : {})}
        triggerLabel={position.value === null ? '?' : `P${position.value}`}
        triggerSize="content"
      />
    </div>
  );
}
