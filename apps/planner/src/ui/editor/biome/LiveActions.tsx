import { useRef, useState, type ReactElement } from 'react';

import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceLiveItem,
  type WorkspaceLiveVerb,
  type WorkspaceRoomLive,
} from '@planner/projections/structured-workspace';
import { ArtworkIcon, type ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { npcPortrait } from '@planner/ui/artwork/npcs/npcArtwork';
import { rerollDieArtwork } from '@planner/ui/artwork/rerolls/rerollArtwork';
import { offerIcon, rewardIcon } from '@planner/ui/artwork/rewardIcon';
import {
  challengeSwitchIcon,
  erisIcon,
  fountainIcon,
  roomActionIcon,
  roomObjectIcon,
  sourceFamilyIcon,
  wellItemIcon,
} from '@planner/ui/artwork/roomArtwork';
import { pickupSourceBadgeIcon } from '@planner/ui/artwork/sourceBadgeArtwork';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { ContextualPickerPopover } from '@planner/ui/controls/ContextualPicker';
import { hintProps } from '@planner/ui/controls/hint';
import { IconToggleLock } from '@planner/ui/controls/IconToggle';
import { useCommandIntent, useCommandsIntent } from '@planner/ui/controls/useCommandIntent';
import {
  useFindingAnchor,
  useFindingMark,
  type FindingMarkProps,
} from '@planner/ui/feedback/useFindingTarget';
import { RewardOfferPicker } from '../rewards/RewardEditors';
import { actionRowElement, openPlacedRow } from './placedRow';
import { TimelineRow } from './TimelineRow';

type Face = Omit<WorkspaceLiveVerb, 'key' | 'label' | 'action'>;

/** What a pickup or verb shows: its reward, the NPC's portrait, its trait, or its object. */
function faceIcon(face: Face, biomeKey: string): ArtworkSource | undefined {
  if (face.reward !== undefined)
    return face.reward.itemKey === undefined
      ? offerIcon(face.reward.offer)
      : wellItemIcon(face.reward.itemKey);
  const portrait = npcPortrait(face.npcKey);
  if (portrait !== undefined) return portrait;
  if (face.traitKey !== undefined) return traitIcon(face.traitKey);
  return face.reference === undefined
    ? undefined
    : (roomActionIcon(face.reference, biomeKey, face.sourceFamily, face.challengeSwitchKind) ??
        sourceFamilyIcon(face.sourceFamily));
}

/** A live thing's icon: a pickup's own, or its object's. */
function itemIcon(item: WorkspaceLiveItem, biomeKey: string): ArtworkSource | undefined {
  switch (item.object) {
    case undefined:
      return faceIcon(item, biomeKey);
    case 'worldShop':
      return rewardIcon('Shop');
    case 'contractPedestal':
      return traitIcon('InfernalContractBoon');
    case 'hermesShrine':
    case 'stygianWell':
    case 'purgingPool':
    case 'keepsakeRack':
    case 'lockedDoors':
      return roomObjectIcon(item.object);
    case 'fountain':
      return fountainIcon(biomeKey);
    case 'eris':
      return erisIcon;
    case 'challengeSwitch':
      return item.challengeSwitchKind === undefined
        ? undefined
        : challengeSwitchIcon(item.challengeSwitchKind);
    case 'doorRerolls':
      return rerollDieArtwork;
    case 'fieldsCage':
      return roomObjectIcon('doorLock');
    case 'encounterContact':
    case 'gorgon':
    case 'rewardWheel':
      return faceIcon(item, biomeKey);
  }
}

/** One mark carrying every finding of a thing's rows, the first owner focused. */
function combinedMark(marks: readonly FindingMarkProps[]): FindingMarkProps | undefined {
  const marked = marks.filter((mark) => mark['data-has-findings']);
  if (marked.length === 0) return undefined;
  return {
    'data-semantic-owner': marked[0]!['data-semantic-owner'],
    'data-has-findings': true,
    'aria-description': marked
      .map((mark) => mark['aria-description'])
      .filter((text) => text !== undefined)
      .join(' '),
  };
}

const groupNames: Readonly<Record<WorkspaceLiveItem['group'], string>> = {
  required: 'Required',
  optional: 'Optional',
  object: 'Objects',
};

const pickerItem = (key: string, label: string) =>
  Object.freeze({
    key,
    value: key,
    label,
    state: 'possible' as const,
    selected: false,
    disabled: false,
  });

/**
 * One live thing: its chip opens the list of its verbs; a verb that needs a value lists its
 * values next, and a reroll press its target, then the reward it draws.
 */
function LiveItemChip({
  announce,
  biomeKey,
  interactions,
  item,
  onPress,
}: {
  readonly announce: (message: string) => void;
  readonly biomeKey: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly item: WorkspaceLiveItem;
  /** Starts a reroll press on a target, whose reward the row then picks. */
  readonly onPress: (press: { readonly interactionKey: string; readonly target: string }) => void;
}) {
  const executeIntent = useCommandIntent();
  const executeCommands = useCommandsIntent();
  const findingMark = useFindingMark();
  const findingAnchor = useFindingAnchor();
  const [open, setOpen] = useState(false);
  const [choosing, setChoosing] = useState<WorkspaceLiveVerb>();
  const chip = useRef<HTMLButtonElement>(null);
  const mark = combinedMark(item.findingOwners.map((owner) => findingMark(owner, 'place')));
  const icon = itemIcon(item, biomeKey);
  const name = item.locked ? `${item.label}, locked` : item.label;
  const badge =
    item.object === undefined
      ? pickupSourceBadgeIcon(item.sourceFamily, item.challengeSwitchKind)
      : undefined;
  const inert = item.verbs.length === 0;
  const press =
    choosing?.action.kind === 'rerollPress'
      ? requireWorkspaceInteraction(interactions.roomRerolls, choosing.action.interactionKey)
      : undefined;
  const model: ContextualPickerModel<string> =
    choosing === undefined
      ? {
          sections: [
            {
              key: 'verbs',
              kind: 'category' as const,
              label: item.label,
              collapsible: false,
              items: item.verbs.map((verb) =>
                pickerItem(verb.key, verb.action.kind === 'apply' ? verb.label : `${verb.label}…`),
              ),
            },
          ],
        }
      : press !== undefined
        ? press.targets(undefined)
        : {
            sections: [
              {
                key: 'choices',
                kind: 'category' as const,
                label: choosing.label,
                collapsible: false,
                items:
                  choosing.action.kind === 'choose'
                    ? choosing.action.choices.map((choice) => pickerItem(choice.key, choice.label))
                    : [],
              },
            ],
          };
  const apply = (verb: WorkspaceLiveVerb) => {
    if (verb.action.kind !== 'apply') return;
    executeCommands(verb.action.intent);
    announce(`${verb.label} added to the timeline.`);
    const opens = verb.action.opens;
    const from = chip.current;
    if (opens === undefined || from === null) return;
    // The placed row's own choice opens once the Timeline shows it.
    setTimeout(() => {
      const row = actionRowElement(from, opens);
      if (row !== null) openPlacedRow(row);
    }, 0);
  };
  const face = (
    <>
      {icon === undefined ? (
        <span className="live-chip-text">{item.label}</span>
      ) : (
        <ArtworkIcon className="artwork-label-icon" source={icon} />
      )}
      {badge === undefined ? null : (
        <img alt="" aria-hidden="true" className="corner-badge timeline-source-badge" src={badge} />
      )}
      {item.place === undefined ? null : (
        <span aria-hidden="true" className="corner-badge timeline-chip-badge">
          {item.place.badge}
        </span>
      )}
      {item.locked ? <IconToggleLock /> : null}
    </>
  );
  const className =
    icon === undefined ? 'timeline-chip live-chip live-chip-text-face' : 'timeline-chip live-chip';
  // A thing standing for a row off the Timeline is where that row's findings lead.
  const anchored = (node: ReactElement) =>
    item.anchor === undefined ? (
      node
    ) : (
      <span {...findingAnchor(item.anchor)} className="live-chip-anchor">
        {node}
      </span>
    );
  if (inert)
    return anchored(
      <button
        {...mark}
        {...hintProps(
          item.locked ? 'Unlocks when its fight ends.' : undefined,
          mark?.['aria-description'],
          name,
        )}
        aria-disabled
        aria-label={name}
        className={className}
        data-live-group={item.group}
        ref={chip}
        type="button"
      >
        {face}
      </button>,
    );
  return anchored(
    <span className="live-action-menu">
      <ContextualPickerPopover<string>
        choiceLabel={choosing?.label ?? item.label}
        itemIcon={(entry) => {
          if (choosing === undefined) {
            const verb = item.verbs.find((candidate) => candidate.key === entry.value);
            return verb === undefined ? undefined : faceIcon(verb, biomeKey);
          }
          if (press !== undefined) return rerollDieArtwork;
          if (choosing.action.kind !== 'choose') return undefined;
          const choice = choosing.action.choices.find((candidate) => candidate.key === entry.value);
          return choice === undefined
            ? undefined
            : 'rewardType' in choice.icon
              ? rewardIcon(choice.icon.rewardType)
              : traitIcon(choice.icon.traitKey);
        }}
        model={model}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setChoosing(undefined);
        }}
        onSelect={(value) => {
          if (choosing === undefined) {
            const verb = item.verbs.find((candidate) => candidate.key === value);
            if (verb === undefined) return;
            if (verb.action.kind === 'apply') {
              setOpen(false);
              apply(verb);
              return;
            }
            // The list stays open on the verb's values.
            setTimeout(() => {
              setChoosing(verb);
              setOpen(true);
            }, 0);
            return;
          }
          setOpen(false);
          setChoosing(undefined);
          if (choosing.action.kind === 'rerollPress') {
            const press = { interactionKey: choosing.action.interactionKey, target: value };
            // The reward picker opens once the verb list has closed and handed back focus.
            setTimeout(() => onPress(press), 0);
            return;
          }
          if (choosing.action.kind !== 'choose') return;
          const choice = choosing.action.choices.find((candidate) => candidate.key === value);
          if (choice === undefined) return;
          executeIntent(choice.intent);
          announce(`${choosing.label} ${choice.label} added to the timeline.`);
        }}
        open={open}
        searchable={false}
        side="bottom"
      >
        <button
          {...mark}
          {...hintProps(undefined, mark?.['aria-description'], name)}
          aria-haspopup="menu"
          aria-label={name}
          className={className}
          data-live-group={item.group}
          ref={chip}
          type="button"
        >
          {face}
        </button>
      </ContextualPickerPopover>
    </span>,
  );
}

/**
 * The live row at the walk's frontier: the things the room has live there, by group. A
 * thing's chip lists its verbs; choosing one adds its row here.
 */
export function LiveRow({
  announce,
  biomeKey,
  interactions,
  live,
}: {
  readonly announce: (message: string) => void;
  readonly biomeKey: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly live: WorkspaceRoomLive;
}) {
  const executeIntent = useCommandIntent();
  const [press, setPress] = useState<{
    readonly interactionKey: string;
    readonly target: string;
  }>();
  if (live.items.length === 0) return null;
  const groups = (['required', 'optional', 'object'] as const)
    .map((group) => ({ group, items: live.items.filter((item) => item.group === group) }))
    .filter((entry) => entry.items.length > 0);
  const pressInteraction =
    press === undefined ? undefined : interactions.roomRerolls.get(press.interactionKey);
  return (
    <TimelineRow
      className="timeline-live-row"
      data-live-gap={live.frontier}
      editors={
        press === undefined || pressInteraction === undefined ? null : (
          <RewardOfferPicker
            ariaLabel="New reroll reward"
            defaultOpen
            id={`live-press-${press.interactionKey}`}
            key={`${press.interactionKey} ${press.target}`}
            label=""
            offer={null}
            onDismiss={() => setPress(undefined)}
            onReplace={(reward) => {
              setPress(undefined);
              executeIntent(pressInteraction.appendIntent(press.target, reward));
            }}
            resolver={pressInteraction.pendingReward(press.target)}
            triggerSize="icon"
          />
        )
      }
      kind="insertion"
      label={
        <span aria-label="Next" className="live-row-groups" role="group">
          {groups.map(({ group, items }) => (
            <span
              aria-label={groupNames[group]}
              className="live-row-group"
              data-live-group={group}
              key={group}
              role="group"
            >
              <span aria-hidden="true" className="live-row-group-label">
                {groupNames[group]}
              </span>
              {items.map((item) => (
                <LiveItemChip
                  announce={announce}
                  biomeKey={biomeKey}
                  interactions={interactions}
                  item={item}
                  key={item.key}
                  onPress={setPress}
                />
              ))}
            </span>
          ))}
        </span>
      }
    />
  );
}
