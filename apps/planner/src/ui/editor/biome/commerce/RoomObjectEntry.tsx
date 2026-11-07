import type { FindingMarkProps } from '@planner/ui/feedback/useFindingTarget';
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
import { offerIcon, rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { wellItemIcon } from '@planner/ui/artwork/roomArtwork';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import type { RoomAddAction } from '../RoomAddMenu';
import { combinedFindingMark, roomAddActionItems } from '../roomAddActions';
import { roomObjectEntryIcon } from './roomObjectEntryIcon';
import { TimelineRow } from '../TimelineRow';
import { pickSubject } from './pickSubject';

/** Marks an object's own optional pickup apart from its options. */
const extraPrefix = 'add:';

const objectName: Readonly<Record<WorkspaceRoomObject, string>> = {
  worldShop: 'World Shop',
  hermesShrine: 'Hermes Shrine',
  championItem: 'Pedestal',
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
    case 'inactive':
      return 'Needs Champion of Elysium.';
  }
}

/**
 * A World Shop, Hermes Shrine or Pedestal's entry above the optional
 * actions: what can be done where the room's actions end, each pick
 * appending one action there.
 */
export function RoomObjectEntry({
  entry,
  extraActions = [],
  findingMark: rowsMark,
  interactions,
}: {
  readonly entry: WorkspaceRoomObjectEntry;
  /** The object's own optional pickups, such as a Shrine delivery, listed after its options. */
  readonly extraActions?: readonly RoomAddAction[];
  /** Findings of this object's timeline rows (purchases, sales, rerolls). */
  readonly findingMark?: FindingMarkProps;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const findingMark = combinedFindingMark([
    rowsMark,
    ...extraActions.map((action) => action.findingMark),
  ]);
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
  const extraItems = roomAddActionItems(extraActions, extraPrefix);
  const model: ContextualPickerModel<string> = Object.freeze({
    sections: Object.freeze(
      entry.options.length === 0 && extraItems.length === 0
        ? []
        : [
            Object.freeze({
              collapsible: false,
              key: 'interact',
              kind: 'category' as const,
              label: name,
              items: Object.freeze([
                ...entry.options.map((option) =>
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
                ...extraItems,
              ]),
            }),
          ],
    ),
  });
  const icon = roomObjectEntryIcon[entry.object];
  return (
    <TimelineRow
      className="room-action-feature-roll"
      data-object={entry.object}
      kind="insertion"
      label={
        <ContextualPicker<string>
          {...(findingMark === undefined ? {} : { findingMark })}
          ariaLabel={name}
          {...(entry.locked === undefined || extraItems.length > 0
            ? {}
            : { disabledHint: roomObjectLockHint(entry.locked) })}
          id={`${idPrefix}-action`}
          itemIcon={(item) => {
            if (item.value.startsWith(extraPrefix))
              return extraActions.find((action) => extraPrefix + action.key === item.value)?.icon;
            const reward = entry.options.find((option) => option.key === item.value)?.reward;
            return reward === undefined
              ? undefined
              : reward.itemKey === undefined
                ? offerIcon(reward.offer)
                : wellItemIcon(reward.itemKey);
          }}
          label=""
          model={model}
          onSelect={(optionKey) => {
            const extra = extraActions.find((action) => extraPrefix + action.key === optionKey);
            if (extra !== undefined) {
              if (extra.unavailable === undefined)
                extra.onSelect(document.getElementById(`${idPrefix}-action`) as HTMLButtonElement);
              return;
            }
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
            ariaLabel={`Pick item for ${pickSubject(entry.options.find((option) => option.key === pending)?.label ?? pending)}`}
            id={`${idPrefix}-choice`}
            itemIcon={(item) => rewardIcon(item.value.rewardType)}
            key={pending}
            label=""
            layout="inline"
            model={interaction.choices(pending)}
            onOpenChange={(open) => {
              // Closing the list without a choice abandons the pick.
              if (!open) setChoosing(undefined);
            }}
            onSelect={(choice) => {
              setChoosing(undefined);
              executeIntent(interaction.choiceIntentFor(pending, choice.key));
            }}
            placeholder="Pick"
            triggerSize="content"
          />
        )
      }
    />
  );
}
