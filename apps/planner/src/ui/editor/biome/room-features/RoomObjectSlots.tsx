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
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandsIntent } from '@planner/ui/controls/useCommandIntent';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { NumberedSlot, NumberedSlots } from '@planner/ui/editor/rewards/NumberedSlots';
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
 * A room's challenge switch anchors on one line: each anchor's object as an
 * icon chip that picks what the anchor holds, then that object's settings.
 * Objects native order leaves without an anchor follow, each removable.
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
  const numbered = objectSlots.slots.length >= 2;
  return (
    <div className="room-object-slots">
      {numbered ? (
        <NumberedSlots label="Object spots">
          {objectSlots.slots.map((slot) => (
            <NumberedSlot
              hint={`Spot ${slot.index + 1}`}
              key={slot.index}
              number={slot.index + 1}
              trailing={slot.occupant === undefined ? undefined : settings(slot.occupant.object)}
            >
              <AnchorSlotChip
                interactions={interactions}
                label={`Spot ${slot.index + 1}`}
                objectSlots={objectSlots}
                slot={slot}
              />
            </NumberedSlot>
          ))}
        </NumberedSlots>
      ) : (
        objectSlots.slots.map((slot) => (
          <span className="room-object-slot" key={slot.index}>
            <AnchorSlotChip
              interactions={interactions}
              label="Spot"
              objectSlots={objectSlots}
              slot={slot}
            />
            {slot.occupant === undefined ? null : settings(slot.occupant.object)}
          </span>
        ))
      )}
      {objectSlots.unanchored.map((occupant) => (
        <span className="room-object-slot" key={occupant.object}>
          <UnanchoredObjectChip
            interactions={interactions}
            objectSlots={objectSlots}
            occupant={occupant}
          />
          {settings(occupant.object)}
        </span>
      ))}
    </div>
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
  label,
  objectSlots,
  slot,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label: string;
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
      ariaLabel={label}
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
