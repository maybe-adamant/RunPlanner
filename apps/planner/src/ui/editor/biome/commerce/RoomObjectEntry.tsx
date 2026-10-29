import { useState } from 'react';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomObject,
  type WorkspaceRoomObjectChoice,
  type WorkspaceRoomObjectEntry,
  type WorkspaceRoomObjectLock,
} from '@planner/projections/structured-workspace';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { roomObjectIcon } from '@planner/ui/artwork/roomArtwork';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { TimelineRow } from '../TimelineRow';

const objectName: Readonly<Record<WorkspaceRoomObject, string>> = {
  worldShop: 'World Shop',
  hermesShrine: 'Hermes Shrine',
  championItem: 'Champion Item',
};

/** Why an entry, or one of its options, cannot be picked here. */
function roomObjectLockHint(lock: WorkspaceRoomObjectLock): string {
  switch (lock) {
    case 'unreached':
      return candidateWaitingHint;
    case 'allBought':
      return 'Everything here is bought.';
    case 'collected':
      return 'Already collected.';
    case 'itemUnchosen':
      return 'Choose the Champion item first.';
    case 'inactive':
      return 'Needs Champion of Elysium.';
  }
}

/**
 * A World Shop, Hermes Shrine or Champion item's entry above the optional
 * actions: what can be done where the room's actions end, each pick
 * appending one action there.
 */
export function RoomObjectEntry({
  entry,
  interactions,
}: {
  readonly entry: WorkspaceRoomObjectEntry;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.roomObjectEntries,
    entry.interactionKey,
  );
  const executeIntent = useCommandIntent();
  const [choosing, setChoosing] = useState<string>();
  const name = objectName[entry.object];
  const idPrefix = `object-${entry.interactionKey}`;
  const pending =
    choosing !== undefined &&
    entry.options.some((option) => option.key === choosing && option.needsChoice === true)
      ? choosing
      : undefined;
  const model: ContextualPickerModel<string> = Object.freeze({
    sections: Object.freeze(
      entry.options.length === 0
        ? []
        : [
            Object.freeze({
              collapsible: false,
              key: 'interact',
              kind: 'category' as const,
              label: name,
              items: Object.freeze(
                entry.options.map((option) =>
                  Object.freeze({
                    disabled: option.locked !== undefined,
                    key: option.key,
                    label: option.label,
                    selected: false,
                    state:
                      option.locked === undefined ? ('possible' as const) : ('impossible' as const),
                    value: option.key,
                    ...(option.locked === undefined
                      ? {}
                      : { explanations: Object.freeze([roomObjectLockHint(option.locked)]) }),
                  }),
                ),
              ),
            }),
          ],
    ),
  });
  const icon = entry.object === 'hermesShrine' ? roomObjectIcon('hermesShrine') : undefined;
  return (
    <TimelineRow
      className="room-action-feature-roll"
      data-object={entry.object}
      kind="insertion"
      label={
        <ContextualPicker<string>
          ariaLabel={name}
          {...(entry.locked === undefined
            ? {}
            : { disabledHint: roomObjectLockHint(entry.locked) })}
          id={`${idPrefix}-action`}
          label=""
          model={model}
          onSelect={(optionKey) => {
            const option = entry.options.find((candidate) => candidate.key === optionKey);
            if (option === undefined || option.locked !== undefined) return;
            if (option.needsChoice === true) {
              setChoosing(optionKey);
              return;
            }
            setChoosing(undefined);
            executeIntent(interaction.intentFor(optionKey));
          }}
          placeholder={`${name} ▸`}
          triggerIcon={icon}
          {...(pending === undefined
            ? {}
            : {
                triggerLabel:
                  entry.options.find((option) => option.key === pending)?.label ?? pending,
              })}
        />
      }
      editors={
        pending === undefined ? null : (
          <ContextualPicker<WorkspaceRoomObjectChoice>
            ariaLabel="Travel Deal item"
            id={`${idPrefix}-choice`}
            itemIcon={(item) => rewardIcon(item.value.rewardType)}
            key={pending}
            label=""
            model={interaction.choices(pending)}
            onOpenChange={(open) => {
              // Closing the list without a choice abandons the pick.
              if (!open) setChoosing(undefined);
            }}
            onSelect={(choice) => {
              setChoosing(undefined);
              executeIntent(interaction.choiceIntentFor(pending, choice.key));
            }}
            placeholder="Choose item"
          />
        )
      }
    />
  );
}
