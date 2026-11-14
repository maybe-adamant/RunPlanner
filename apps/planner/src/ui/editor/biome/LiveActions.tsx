import * as Popover from '@radix-ui/react-popover';
import { useRef, useState, type ReactElement } from 'react';

import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceLiveGap,
  type WorkspaceLiveItem,
  type WorkspaceLiveVerb,
  type WorkspaceRoomLive,
  type WorkspaceRowChoice,
} from '@planner/projections/structured-workspace';
import { ArtworkIcon, type ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { foughtEncounterIcon } from '@planner/ui/artwork/encounterArtwork';
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
import { ActionIcon } from '@planner/ui/controls/ActionIcon';
import { ContextualPickerPopover } from '@planner/ui/controls/ContextualPicker';
import { hintProps } from '@planner/ui/controls/hint';
import { IconToggleLock } from '@planner/ui/controls/IconToggle';
import { useCommandIntent, useCommandsIntent } from '@planner/ui/controls/useCommandIntent';
import {
  useFindingAnchor,
  useFindingMark,
  type FindingMarkProps,
} from '@planner/ui/feedback/useFindingTarget';
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
  const encounter = foughtEncounterIcon(face.encounterKey);
  if (encounter !== undefined) return encounter;
  return face.reference === undefined
    ? undefined
    : (roomActionIcon(face.reference, biomeKey, face.sourceFamily, face.challengeSwitchKind) ??
        sourceFamilyIcon(face.sourceFamily, face.challengeSwitchKind));
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
    case 'rewardWheel':
      return roomObjectIcon('rewardWheel');
    case 'encounterContact':
    case 'gorgon':
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

const pickerItem = (key: string, label: string, selected = false) =>
  Object.freeze({
    key,
    value: key,
    label,
    state: 'possible' as const,
    selected,
    disabled: false,
  });

/**
 * The shared list of a thing's verbs, opened from its trigger: a live thing's chip, or a
 * placed row's verb word, whose current verb is checked. A verb that needs a value lists its
 * values next, and a reroll press its target, placed with a drawn reward its row then opens on.
 */
export function VerbMenu({
  announce,
  applied = (label) => `${label} added to the timeline.`,
  biomeKey,
  children,
  interactions,
  label,
  onApplied,
  verbs,
}: {
  readonly announce: (message: string) => void;
  /** What applying a verb of this label announces. */
  readonly applied?: (label: string) => string;
  readonly biomeKey: string;
  /** The trigger, which keeps its own name and marks. */
  readonly children: ReactElement;
  readonly interactions: WorkspaceInteractionCatalog;
  /** The list's name: the thing or row its verbs act on. */
  readonly label: string;
  /** Called once a verb applies. */
  readonly onApplied?: () => void;
  readonly verbs: readonly WorkspaceLiveVerb[];
}) {
  const executeCommands = useCommandsIntent();
  const executeIntent = useCommandIntent();
  const [open, setOpen] = useState(false);
  const [choosing, setChoosing] = useState<WorkspaceLiveVerb>();
  const anchor = useRef<HTMLSpanElement>(null);
  // What a chosen verb opens next, once the closed list has handed back focus; earlier, the
  // returning focus would dismiss it. True when it took focus.
  const afterClose = useRef<() => boolean>(undefined);
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
              label,
              collapsible: false,
              items: verbs.map((verb) =>
                verb.action.kind === 'choose' || verb.action.kind === 'rerollPress'
                  ? pickerItem(verb.key, `${verb.label}…`)
                  : pickerItem(verb.key, verb.label, verb.action.kind === 'current'),
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
  /** The placed row's own choice opens once the Timeline shows it. */
  const openOnClose = (opens: { readonly rowKey: string; readonly choice: WorkspaceRowChoice }) => {
    const from = anchor.current;
    if (from === null) return;
    afterClose.current = () => {
      const row = actionRowElement(from, opens.rowKey);
      if (row === null) return false;
      openPlacedRow(row, opens.choice);
      return true;
    };
  };
  const apply = (verb: WorkspaceLiveVerb) => {
    if (verb.action.kind !== 'apply') return;
    executeCommands(verb.action.intent);
    announce(applied(verb.label));
    onApplied?.();
    if (verb.action.opens !== undefined) openOnClose(verb.action.opens);
  };
  return (
    <span className="live-action-menu" ref={anchor}>
      <ContextualPickerPopover<string>
        choiceLabel={choosing?.label ?? label}
        itemIcon={(entry) => {
          if (choosing === undefined) {
            const verb = verbs.find((candidate) => candidate.key === entry.value);
            if (verb === undefined) return undefined;
            return verb.action.kind === 'rerollPress' ? rerollDieArtwork : faceIcon(verb, biomeKey);
          }
          if (press !== undefined) return rerollDieArtwork;
          if (choosing.action.kind !== 'choose') return undefined;
          const choice = choosing.action.choices.find((candidate) => candidate.key === entry.value);
          return choice?.offer === undefined ? undefined : offerIcon(choice.offer);
        }}
        model={model}
        onCloseAutoFocus={(event) => {
          const next = afterClose.current;
          afterClose.current = undefined;
          if (next?.() === true) event.preventDefault();
        }}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setChoosing(undefined);
        }}
        onSelect={(value) => {
          if (choosing === undefined) {
            const verb = verbs.find((candidate) => candidate.key === value);
            if (verb === undefined) return;
            switch (verb.action.kind) {
              case 'current':
                setOpen(false);
                return;
              case 'apply':
                setOpen(false);
                apply(verb);
                return;
              case 'choose':
              case 'rerollPress':
                // The list stays open on the verb's values.
                setTimeout(() => {
                  setChoosing(verb);
                  setOpen(true);
                }, 0);
                return;
            }
          }
          setOpen(false);
          setChoosing(undefined);
          if (choosing.action.kind === 'rerollPress') {
            const intent = press?.pressIntent(value);
            if (intent === undefined) return;
            executeIntent(intent);
            announce(applied(choosing.label));
            onApplied?.();
            if (choosing.action.opens !== undefined) openOnClose(choosing.action.opens);
            return;
          }
          if (choosing.action.kind !== 'choose') return;
          const choice = choosing.action.choices.find((candidate) => candidate.key === value);
          if (choice === undefined) return;
          executeCommands(choice.intent);
          announce(applied(`${choosing.label} ${choice.label}`));
          onApplied?.();
        }}
        open={open}
        searchable={false}
        side="bottom"
      >
        {children}
      </ContextualPickerPopover>
    </span>
  );
}

/** One live thing: its chip opens the list of its verbs. */
function LiveItemChip({
  announce,
  biomeKey,
  interactions,
  item,
  onApplied,
}: {
  readonly announce: (message: string) => void;
  readonly biomeKey: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly item: WorkspaceLiveItem;
  /** Called once a verb's rows are added. */
  readonly onApplied?: () => void;
}) {
  const findingMark = useFindingMark();
  const findingAnchor = useFindingAnchor();
  const mark = combinedMark(item.findingOwners.map((owner) => findingMark(owner, 'place')));
  const icon = itemIcon(item, biomeKey);
  const name = item.locked ? `${item.label}, locked` : item.label;
  const badge =
    item.object === undefined
      ? pickupSourceBadgeIcon(item.sourceFamily, item.challengeSwitchKind)
      : undefined;
  const inert = item.verbs.length === 0;
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
        type="button"
      >
        {face}
      </button>,
    );
  return anchored(
    <VerbMenu
      announce={announce}
      biomeKey={biomeKey}
      interactions={interactions}
      label={item.label}
      verbs={item.verbs}
      {...(onApplied === undefined ? {} : { onApplied })}
    >
      <button
        {...mark}
        {...hintProps(undefined, mark?.['aria-description'], name)}
        aria-haspopup="menu"
        aria-label={name}
        className={className}
        type="button"
      >
        {face}
      </button>
    </VerbMenu>,
  );
}

/** The live things of one point, by group: Required, Optional, then Objects, named but unlabelled. */
function LiveGroups({
  announce,
  biomeKey,
  interactions,
  items,
  label,
  onApplied,
}: {
  readonly announce: (message: string) => void;
  readonly biomeKey: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly items: readonly WorkspaceLiveItem[];
  readonly label: string;
  readonly onApplied?: () => void;
}) {
  const groups = (['required', 'optional', 'object'] as const)
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((entry) => entry.items.length > 0);
  return (
    <span aria-label={label} className="live-row-groups" role="group">
      {groups.map(({ group, items: grouped }) => (
        <span
          aria-label={groupNames[group]}
          className="live-row-group"
          data-live-group={group}
          key={group}
          role="group"
        >
          {grouped.map((item) => (
            <LiveItemChip
              announce={announce}
              biomeKey={biomeKey}
              interactions={interactions}
              item={item}
              key={item.key}
              {...(onApplied === undefined ? {} : { onApplied })}
            />
          ))}
        </span>
      ))}
    </span>
  );
}

// A preview switch between candidate live row looks; unset keeps the default.
const liveRowStyles = ['card', 'card2', 'card3', 'divider'] as const;
const liveRowStyle = liveRowStyles.find((style) => style === import.meta.env.VITE_LIVE_ROW_STYLE);

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
  if (live.items.length === 0) return null;
  const groups = (
    <LiveGroups
      announce={announce}
      biomeKey={biomeKey}
      interactions={interactions}
      items={live.items}
      label="Next"
    />
  );
  return (
    <TimelineRow
      className="timeline-live-row"
      data-live-gap={live.frontier}
      {...(liveRowStyle === undefined ? {} : { 'data-live-style': liveRowStyle })}
      kind="insertion"
      label={
        liveRowStyle === undefined ? (
          groups
        ) : (
          <>
            <span
              aria-hidden="true"
              className={liveRowStyle === 'divider' ? 'live-row-divider' : 'live-row-lead'}
            >
              Next
            </span>
            {groups}
          </>
        )
      }
    />
  );
}

/**
 * The `+` on the spine above a row: the things that can be inserted at the gap before it, as
 * the live row shows them, then Reset from here. Absent where the gap offers nothing.
 */
export function TimelineGapControl({
  announce,
  biomeKey,
  gap,
  interactions,
}: {
  readonly announce: (message: string) => void;
  readonly biomeKey: string;
  readonly gap: WorkspaceLiveGap | undefined;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const [open, setOpen] = useState(false);
  if (gap === undefined || (gap.items.length === 0 && gap.reset === undefined)) return null;
  const reset = gap.reset;
  return (
    <Popover.Root onOpenChange={setOpen} open={open}>
      <Popover.Trigger asChild>
        <button
          aria-label="Insert here"
          className="timeline-gap-control"
          data-live-gap={gap.index}
          type="button"
        >
          <span aria-hidden="true">+</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          aria-label="Insert here"
          className="timeline-gap-menu"
          collisionPadding={12}
          side="right"
          sideOffset={8}
        >
          {gap.items.length === 0 ? null : (
            <LiveGroups
              announce={announce}
              biomeKey={biomeKey}
              interactions={interactions}
              items={gap.items}
              label="Insert here"
              onApplied={() => setOpen(false)}
            />
          )}
          {reset === undefined ? null : (
            <button
              aria-label="Reset from here"
              className="timeline-gap-reset"
              onClick={() => {
                setOpen(false);
                executeIntent(reset);
                announce('Rows after this point removed.');
              }}
              type="button"
            >
              <ActionIcon name="resetAfter" />
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
