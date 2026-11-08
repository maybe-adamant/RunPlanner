import type { ReactNode } from 'react';
import {
  requireWorkspaceInteraction,
  type WorkspaceAnchorObject,
  type WorkspaceAnchorOccupant,
  type WorkspaceAnchorSpot,
  type WorkspaceAnchorSpotChoice,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomFeature,
  type WorkspaceRoomObjectSlots,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { useCommandsIntent } from '@planner/ui/controls/useCommandIntent';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { RoomInventoryPanel } from '../commerce/RoomInventoryPanel';
import { PlacementSpot, type PlacementSpotItem } from '../room-layout/PlacementSpot';
import { ChallengeSwitchControls } from './ChallengeSwitchControls';
import {
  heldObjectIcon as heldIcon,
  heldObjectName as heldName,
  type HeldObject as Held,
} from './roomObjectFace';

const spotName = (number: number): string => `A${number}`;

// A switch's own controls carry its other findings.
const anchorFindingCodes = new Set([
  'roomObjectAnchorUnavailable',
  'roomObjectAnchorDuplicate',
  'challengeSwitchPlacementUnavailable',
]);

/** Why an empty spot offers nothing: an unreached entry waits; otherwise the rules refusing each object. */
function spotLockHint(spot: WorkspaceAnchorSpot): string | undefined {
  if (spot.unavailable.some((entry) => entry.lock.reason === 'unreached'))
    return candidateWaitingHint;
  const sentences = spot.unavailable.flatMap((entry) =>
    entry.lock.reason === 'refused' ? entry.lock.sentences : [],
  );
  return sentences.length === 0 ? undefined : [...new Set(sentences)].join(' ');
}

/** A choice's name: on a spot, what it adds or moves here; on an object the game places, where it stands it. */
function choiceLabel(
  choice: WorkspaceAnchorSpotChoice,
  numberOf: (anchorId: number) => number | undefined,
  onSpot: boolean,
): string {
  const name = heldName(choice);
  switch (choice.action) {
    case 'place':
    case 'retype':
    case 'replace':
      return name;
    case 'move': {
      const number = choice.anchorId === undefined ? undefined : numberOf(choice.anchorId);
      return onSpot || number === undefined ? `Move ${name} here` : `Place on ${spotName(number)}`;
    }
    case 'native':
      return 'Game places it';
    case 'remove':
      return 'Remove';
  }
}

/**
 * A room's objects as one line of physical anchor spots, A1..An by ascending
 * id: each spot shows what stands there and picks what does, and each present
 * object the game places follows the spots. Then one line per object present
 * holding its settings.
 */
export function RoomObjectSlots({
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
  const executeIntent = useCommandsIntent();
  const findingTarget = useFindingTarget();
  const interaction = requireWorkspaceInteraction(
    interactions.roomChoices,
    objectSlots.interactionKey,
  );
  const select = (key: string) => executeIntent(interaction.intentFor(key));
  const numberOf = (anchorId: number) =>
    objectSlots.spots.find((spot) => spot.anchorId === anchorId)?.number;
  const occupantTarget = (occupant: WorkspaceAnchorOccupant) =>
    findingTarget(
      occupant.anchorAddress,
      semanticOwnerControlElementId(occupant.anchorAddress),
      occupant.anchorAddress,
      occupant.object === 'challengeSwitch'
        ? (finding) => anchorFindingCodes.has(finding.code)
        : undefined,
      [occupant.address],
    );
  const settings = (object: WorkspaceAnchorObject): ReactNode => {
    if (object === 'challengeSwitch')
      return room.challengeSwitch === undefined ? null : (
        <ChallengeSwitchControls interactions={interactions} observation={room.challengeSwitch} />
      );
    const feature = features.find(
      (candidate): candidate is Extract<WorkspaceRoomFeature, { readonly kind: typeof object }> =>
        candidate.kind === object,
    );
    return feature === undefined ? null : (
      <RoomInventoryPanel feature={feature} interactions={interactions} />
    );
  };
  const present: readonly WorkspaceAnchorOccupant[] = [
    ...objectSlots.spots.flatMap((spot) => (spot.occupant === undefined ? [] : [spot.occupant])),
    ...objectSlots.unplaced,
  ];
  const spotItems = (spot: WorkspaceAnchorSpot): readonly PlacementSpotItem[] => [
    ...spot.choices.map((choice) => ({
      key: choice.key,
      label: choiceLabel(choice, numberOf, true),
      icon: choice.action === 'native' || choice.action === 'remove' ? undefined : heldIcon(choice),
    })),
    ...spot.unavailable.map((entry) => ({
      key: `unavailable:${entry.object}:${entry.switchKind ?? ''}`,
      label: heldName(entry),
      icon: heldIcon(entry),
      disabled: true,
      explanation:
        entry.lock.reason === 'unreached' ? candidateWaitingHint : entry.lock.sentences.join(' '),
    })),
  ];
  return (
    <div className="room-object-slots">
      <div className="room-object-spots">
        {objectSlots.spots.map((spot) => {
          const items = spotItems(spot);
          const lockHint = items.some((item) => item.disabled !== true)
            ? undefined
            : spotLockHint(spot);
          return (
            <PlacementSpot
              ariaLabel={spot.occupant === undefined ? 'Empty spot' : heldName(spot.occupant)}
              badge={spotName(spot.number)}
              current={
                spot.occupant === undefined
                  ? { label: 'Empty' }
                  : { label: heldName(spot.occupant), icon: heldIcon(spot.occupant) }
              }
              {...(lockHint === undefined ? {} : { disabledHint: lockHint })}
              {...(spot.occupant === undefined
                ? {}
                : { findingTarget: occupantTarget(spot.occupant) })}
              id={`${objectSlots.interactionKey}-${spot.anchorId}`}
              items={items}
              key={spot.anchorId}
              onSelect={select}
              preview={{ kind: 'anchor', anchorId: spot.anchorId }}
            />
          );
        })}
        {objectSlots.unplaced.length === 0 ? null : (
          <span className="room-object-unplaced" aria-label="Placed by the game" role="group">
            <span aria-hidden="true" className="room-object-unplaced-label">
              Game places
            </span>
            {objectSlots.unplaced.map((occupant) => (
              <PlacementSpot
                ariaLabel={heldName(occupant)}
                current={{ label: heldName(occupant), icon: heldIcon(occupant) }}
                findingTarget={occupantTarget(occupant)}
                id={`${objectSlots.interactionKey}-unplaced-${occupant.object}`}
                items={occupant.choices.map((choice) => ({
                  key: choice.key,
                  label: choiceLabel(choice, numberOf, false),
                  ...(choice.anchorId === undefined
                    ? {}
                    : { preview: { kind: 'anchor' as const, anchorId: choice.anchorId } }),
                }))}
                key={occupant.object}
                onSelect={select}
              />
            ))}
          </span>
        )}
      </div>
      {present.map((occupant) => {
        const controls = settings(occupant.object);
        return controls === null ? null : (
          <div className="room-object-inventory" key={occupant.object}>
            <ObjectIcon held={occupant} />
            {controls}
          </div>
        );
      })}
    </div>
  );
}

/** The object an inventory line belongs to, named on hover; its controls carry the name for assistive tech. */
function ObjectIcon({ held }: { readonly held: Held }) {
  return (
    <span aria-hidden="true" className="room-object-fixed" data-hint={heldName(held)}>
      <ArtworkIcon className="artwork-label-icon" source={heldIcon(held)} />
    </span>
  );
}
