import type { ReactNode } from 'react';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomAnchorObject,
  type WorkspaceRoomFeature,
  type WorkspaceRoomObjectSlots,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { challengeSwitchKindLabel } from '@planner/projections/challengeSwitchCopy';
import { challengeSwitchIcon } from '@planner/ui/artwork/roomArtwork';
import { ArtworkChip } from '@planner/ui/editor/rewards/TimelineChip';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
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

function lockHint(object: WorkspaceRoomAnchorObject): string | undefined {
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

/** Each present object's contents: Well and Pool stock, Shrine offers, the switch's type and reward. */
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
        <>
          <SwitchKindPicker interactions={interactions} object={object} objectSlots={objectSlots} />
          <ChallengeSwitchControls interactions={interactions} observation={room.challengeSwitch} />
        </>
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
            icon={object.object === 'challengeSwitch' ? undefined : heldObjectIcon(object)}
            key={object.object}
            label={heldObjectShortName(object.object)}
          >
            <div className="room-object-inventory">{controls}</div>
          </OverviewRow>,
        ];
  });
  return lines.length === 0 ? null : <div className="room-layout-controls">{lines}</div>;
}

/** A present switch's type, changed in place among the types the room can roll. */
function SwitchKindPicker({
  interactions,
  object,
  objectSlots,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly object: WorkspaceRoomAnchorObject;
  readonly objectSlots: WorkspaceRoomObjectSlots;
}) {
  const executeIntent = useCommandsIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.roomChoices,
    objectSlots.interactionKey,
  );
  const current = object.switchKind;
  const kinds = object.kinds ?? [];
  if (current === undefined) return null;
  const icon = challengeSwitchIcon(current);
  return (
    <ContextualPicker<string>
      ariaLabel="Challenge Switch type"
      id={`${objectSlots.interactionKey}-switch-kind`}
      itemIcon={(item) =>
        item.value === 'current'
          ? icon
          : challengeSwitchIcon(kinds.find((kind) => kind.key === item.value)!.switchKind)
      }
      label=""
      layout="inline"
      locked={kinds.length === 0}
      model={declaredChoicesPicker(
        [
          { key: 'current', value: 'current', label: challengeSwitchKindLabel(current) },
          ...kinds.map((kind) => ({
            key: kind.key,
            value: kind.key,
            label: challengeSwitchKindLabel(kind.switchKind),
          })),
        ],
        'current',
      )}
      onSelect={(key) => {
        if (key !== 'current') executeIntent(interaction.intentFor(key));
      }}
      placeholder={challengeSwitchKindLabel(current)}
      searchable={false}
      triggerIcon={icon}
      triggerLabel={challengeSwitchKindLabel(current)}
      triggerSize="icon"
    />
  );
}
