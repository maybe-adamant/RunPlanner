import type { ReactNode } from 'react';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomAnchorObject,
  type WorkspaceRoomFeature,
  type WorkspaceRoomObjectSlots,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { ArtworkChip } from '@planner/ui/editor/rewards/TimelineChip';
import { IconToggle } from '@planner/ui/controls/IconToggle';
import { useCommandsIntent } from '@planner/ui/controls/useCommandIntent';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { RoomInventoryPanel } from '../commerce/RoomInventoryPanel';
import { ChallengeSwitchControls } from './ChallengeSwitchControls';
import { OverviewRow } from '../RoomOverviewSections';
import { heldObjectIcon, heldObjectName, heldObjectShortName } from './roomObjectFace';

// A switch's own settings carry its other findings.
const isSwitchPlacementFinding = (finding: { readonly code: string }) =>
  finding.code === 'challengeSwitchPlacementUnavailable';

function lockHint(object: {
  readonly lock?: WorkspaceRoomAnchorObject['lock'];
}): string | undefined {
  const lock = object.lock;
  if (lock === undefined) return undefined;
  return lock.reason === 'unreached' ? candidateWaitingHint : lock.sentences.join(' ');
}

/** Whether each anchor object stands in the room: a toggle where it can change, else its icon. */
export function RoomObjectPresence({
  interactions,
  objectSlots,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly objectSlots: WorkspaceRoomObjectSlots;
}) {
  const executeIntent = useCommandsIntent();
  const findingTarget = useFindingTarget();
  const interaction = requireWorkspaceInteraction(
    interactions.roomChoices,
    objectSlots.interactionKey,
  );
  if (objectSlots.objects.length === 0) return null;
  return (
    <div className="icon-toggle-row">
      {objectSlots.objects.map((object) => {
        const target = findingTarget(
          object.address,
          `${semanticOwnerControlElementId(object.address)}-presence`,
          object.address,
          object.object === 'challengeSwitch' ? isSwitchPlacementFinding : undefined,
        );
        if (object.switchKinds !== undefined) {
          // One toggle per kind; the observed one, else the first, carries the switch's findings.
          const owner =
            object.switchKinds.find((kind) => kind.switchKind === object.switchKind) ??
            object.switchKinds[0];
          return object.switchKinds.map((kind) => {
            const toggleKey = kind.toggleKey;
            const held = { object: object.object, switchKind: kind.switchKind };
            return (
              <IconToggle
                disabled={toggleKey === undefined}
                disabledHint={lockHint(kind)}
                icon={heldObjectIcon(held)}
                key={`${object.object}:${kind.switchKind}`}
                name={heldObjectName(held)}
                onToggle={() => {
                  if (toggleKey !== undefined) executeIntent(interaction.intentFor(toggleKey));
                }}
                pressed={object.present && object.switchKind === kind.switchKind}
                {...(kind === owner ? { target } : {})}
              />
            );
          });
        }
        if (object.fixed || (object.present && object.toggleKey === undefined))
          return (
            <span key={object.object} {...target}>
              <ArtworkChip icon={heldObjectIcon(object)} label={heldObjectName(object)} />
            </span>
          );
        const toggleKey = object.toggleKey;
        return (
          <IconToggle
            disabled={toggleKey === undefined}
            disabledHint={lockHint(object)}
            icon={heldObjectIcon(object)}
            key={object.object}
            name={heldObjectName(object)}
            onToggle={() => {
              if (toggleKey !== undefined) executeIntent(interaction.intentFor(toggleKey));
            }}
            pressed={object.present}
            target={target}
          />
        );
      })}
    </div>
  );
}

/** Each present object's contents: Well and Pool stock, Shrine offers, the switch's reward. */
export function RoomObjectContents({
  features,
  interactions,
  objectSlots,
  room,
}: {
  readonly features: readonly WorkspaceRoomFeature[];
  readonly interactions: WorkspaceInteractionCatalog;
  readonly objectSlots: WorkspaceRoomObjectSlots;
  readonly room: WorkspaceRoomSummary;
}) {
  const settings = (object: WorkspaceRoomAnchorObject): ReactNode => {
    if (object.object === 'challengeSwitch')
      return room.challengeSwitch === undefined ? null : (
        <ChallengeSwitchControls interactions={interactions} observation={room.challengeSwitch} />
      );
    const kind = object.object;
    const feature = features.find(
      (candidate): candidate is Extract<WorkspaceRoomFeature, { readonly kind: typeof kind }> =>
        candidate.kind === kind,
    );
    return feature === undefined ? null : (
      <RoomInventoryPanel feature={feature} interactions={interactions} />
    );
  };
  const lines = objectSlots.objects.flatMap((object) => {
    if (!object.present) return [];
    const controls = settings(object);
    return controls === null
      ? []
      : [
          <OverviewRow
            icon={heldObjectIcon(object)}
            key={object.object}
            label={heldObjectShortName(object.object)}
          >
            <div className="room-object-inventory">{controls}</div>
          </OverviewRow>,
        ];
  });
  return lines.length === 0 ? null : <div className="room-layout-controls">{lines}</div>;
}
