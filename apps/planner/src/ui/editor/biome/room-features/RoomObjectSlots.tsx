import type { ReactNode } from 'react';
import {
  requireWorkspaceInteraction,
  type WorkspaceAnchorObject,
  type WorkspaceAnchorOccupant,
  type WorkspaceAnchorSlot,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomFeature,
  type WorkspaceRoomObjectSlots,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import type { ChallengeSwitchKind } from '@run-planner/engine/catalog-schema';
import { challengeSwitchKindLabel } from '@planner/projections/challengeSwitchCopy';
import { challengeSwitchIcon, roomObjectIcon } from '@planner/ui/artwork/roomArtwork';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandsIntent } from '@planner/ui/controls/useCommandIntent';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { FixedObjectChip, RoomInventoryPanel } from '../commerce/RoomInventoryPanel';
import { ChallengeSwitchControls } from './ChallengeSwitchControls';

const objectNames: Readonly<Record<WorkspaceAnchorObject, string>> = Object.freeze({
  stygianWell: 'Stygian Well',
  purgingPool: 'Pool of Purging',
  hermesShrine: 'Hermes Shrine',
  challengeSwitch: 'Challenge Switch',
});

/** What a slot holds: an object, a switch of one type, or nothing. */
interface Held {
  readonly object: WorkspaceAnchorObject | null;
  readonly switchKind?: ChallengeSwitchKind | undefined;
}

const heldName = (held: Held): string =>
  held.object === null
    ? 'None'
    : held.switchKind === undefined
      ? objectNames[held.object]
      : challengeSwitchKindLabel(held.switchKind);

const heldIcon = (held: Held | undefined) =>
  held?.object == null
    ? undefined
    : held.switchKind === undefined
      ? roomObjectIcon(held.object)
      : challengeSwitchIcon(held.switchKind);

const currentKey = 'current';

const isPlacementFinding = (finding: { readonly code: string }) =>
  finding.code === 'challengeSwitchPlacementUnavailable';

/** Why a slot offers nothing else: an unreached entry waits; otherwise the rules refusing each object. */
function slotLockHint(slot: WorkspaceAnchorSlot): string | undefined {
  if (slot.unavailable.some((entry) => entry.lock.reason === 'unreached'))
    return candidateWaitingHint;
  const sentences = slot.unavailable.flatMap((entry) =>
    entry.lock.reason === 'refused' ? entry.lock.sentences : [],
  );
  return sentences.length === 0 ? undefined : [...new Set(sentences)].join(' ');
}

/**
 * A room's object anchors as one capacity line: the occupied spots in native
 * order, then the empty ones, each picking what it holds, with objects native
 * order leaves without an anchor after them; then one line per object present
 * holding its settings. Native spawns each object on a random free anchor, so
 * a spot names no physical place.
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
    ...objectSlots.slots.flatMap((slot) => (slot.occupant === undefined ? [] : [slot.occupant])),
    ...objectSlots.unanchored,
  ];
  const unanchored = objectSlots.unanchored.map((occupant) => (
    <UnanchoredObjectChip
      interactions={interactions}
      key={occupant.object}
      objectSlots={objectSlots}
      occupant={occupant}
    />
  ));
  return (
    <div className="room-object-slots">
      <div className="room-object-spots">
        {objectSlots.slots.map((slot) => (
          <AnchorSlotChip
            interactions={interactions}
            key={slot.index}
            objectSlots={objectSlots}
            slot={slot}
          />
        ))}
        {unanchored}
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

function useOccupantTarget() {
  const findingTarget = useFindingTarget();
  return (occupant: WorkspaceAnchorOccupant) =>
    occupant.object === 'challengeSwitch'
      ? findingTarget(
          occupant.address,
          semanticOwnerControlElementId(occupant.address),
          occupant.address,
          isPlacementFinding,
        )
      : findingTarget(occupant.address);
}

/** One anchor's object chip: a fixed object shows alone; otherwise it picks what the anchor holds. */
function AnchorSlotChip({
  interactions,
  objectSlots,
  slot,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly objectSlots: WorkspaceRoomObjectSlots;
  readonly slot: WorkspaceAnchorSlot;
}) {
  const executeIntent = useCommandsIntent();
  const occupantTarget = useOccupantTarget();
  const interaction = requireWorkspaceInteraction(
    interactions.roomObjectSlots,
    objectSlots.interactionKey,
  );
  const occupant = slot.occupant;
  if (occupant?.fixed === true)
    return (
      <FixedObjectChip
        object={occupant.object}
        target={occupantTarget(occupant)}
        title={heldName(occupant)}
      />
    );
  const current: Held = occupant ?? { object: null };
  const unavailableKey = (entry: WorkspaceAnchorSlot['unavailable'][number]) =>
    `unavailable:${entry.object}:${entry.switchKind ?? ''}`;
  const heldOf = new Map<string, Held>([
    [currentKey, current],
    ...slot.choices.map((choice) => [choice.key, choice] as const),
    ...slot.unavailable.map((entry) => [unavailableKey(entry), entry] as const),
  ]);
  const disabledHint = slot.choices.length === 0 ? slotLockHint(slot) : undefined;
  return (
    <ContextualPicker<string>
      ariaLabel={occupant === undefined ? 'Empty spot' : heldName(occupant)}
      {...(occupant === undefined ? {} : { findingTarget: occupantTarget(occupant) })}
      id={`${objectSlots.interactionKey}-${slot.index}`}
      itemIcon={(item) => heldIcon(heldOf.get(item.value))}
      label=""
      layout="inline"
      {...(disabledHint === undefined ? {} : { disabledHint })}
      locked={slot.choices.length === 0 && disabledHint === undefined}
      model={declaredChoicesPicker(
        [
          { key: currentKey, value: currentKey, label: heldName(current) },
          ...slot.choices.map((choice) => ({
            key: choice.key,
            value: choice.key,
            label: heldName(choice),
          })),
          ...slot.unavailable.map((entry) => ({
            key: unavailableKey(entry),
            value: unavailableKey(entry),
            label: heldName(entry),
            disabled: true,
            explanation:
              entry.lock.reason === 'unreached'
                ? candidateWaitingHint
                : entry.lock.sentences.join(' '),
          })),
        ],
        currentKey,
      )}
      onSelect={(key) => {
        if (key !== currentKey) executeIntent(interaction.intentFor(key));
      }}
      placeholder="None"
      searchable={false}
      triggerIcon={heldIcon(current)}
      triggerLabel={heldName(current)}
      triggerSize="icon"
    />
  );
}

/** A present object no anchor holds: its chip carries its finding and offers its removal. */
function UnanchoredObjectChip({
  interactions,
  objectSlots,
  occupant,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly objectSlots: WorkspaceRoomObjectSlots;
  readonly occupant: WorkspaceRoomObjectSlots['unanchored'][number];
}) {
  const executeIntent = useCommandsIntent();
  const occupantTarget = useOccupantTarget();
  const interaction = requireWorkspaceInteraction(
    interactions.roomObjectSlots,
    objectSlots.interactionKey,
  );
  const removeKey = occupant.removeKey;
  if (removeKey === undefined)
    return (
      <FixedObjectChip
        object={occupant.object}
        target={occupantTarget(occupant)}
        title={heldName(occupant)}
      />
    );
  return (
    <ContextualPicker<string>
      ariaLabel={heldName(occupant)}
      findingTarget={occupantTarget(occupant)}
      id={`${objectSlots.interactionKey}-unanchored-${occupant.object}`}
      itemIcon={(item) => (item.value === currentKey ? heldIcon(occupant) : undefined)}
      label=""
      layout="inline"
      model={declaredChoicesPicker(
        [
          { key: currentKey, value: currentKey, label: heldName(occupant) },
          { key: removeKey, value: removeKey, label: heldName({ object: null }) },
        ],
        currentKey,
      )}
      onSelect={(key) => {
        if (key !== currentKey) executeIntent(interaction.intentFor(key));
      }}
      placeholder="None"
      searchable={false}
      triggerIcon={heldIcon(occupant)}
      triggerLabel={heldName(occupant)}
      triggerSize="icon"
    />
  );
}
