import * as Popover from '@radix-ui/react-popover';
import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useAppSelector } from '@planner/state/store';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { hintProps } from '@planner/ui/controls/hint';
import type { FindingMarkProps } from '@planner/ui/feedback/useFindingTarget';

/** One optional action the room can add. */
export interface RoomAddAction {
  readonly key: string;
  readonly label: string;
  readonly icon?: string;
  /** The action's semantic owner, which finding navigation can focus. */
  readonly address: SemanticAddress;
  /** Why the action cannot be added now; the item stays listed and disabled. */
  readonly unavailable?: string;
  readonly findingMark?: FindingMarkProps;
  /** Adds the action, or starts choosing where it goes; the trigger regains focus after. */
  readonly onSelect: (trigger: HTMLButtonElement | null) => void;
}

/** The actions of one source family, opened from their own button. */
export interface RoomAddGroup {
  readonly key: string;
  readonly label: string;
  readonly actions: readonly RoomAddAction[];
}

/**
 * The room's Add area: a line of room objects, each opening its own flow, and
 * a line of source families, each opening its short list of optional actions.
 */
export function RoomAddArea({
  groups,
  objects,
}: {
  /** Source families in display order, each with its optional actions. */
  readonly groups: readonly RoomAddGroup[];
  /** The room objects' and features' entries, each its own `li`, in display order. */
  readonly objects: readonly ReactNode[];
}) {
  const objectsId = useId();
  const actionsId = useId();
  const titleId = useId();
  // Beside a wide timeline the area is a side column that stays put even when empty.
  if (groups.length === 0 && objects.length === 0)
    return (
      <section aria-labelledby={titleId} className="room-add" data-empty="">
        <h4 className="room-add-title" id={titleId}>
          Optional actions
        </h4>
        <p className="room-add-empty">Nothing optional to add here</p>
      </section>
    );
  return (
    <section aria-labelledby={titleId} className="room-add">
      <h4 className="room-add-title" id={titleId}>
        Optional actions
      </h4>
      {objects.length === 0 ? null : (
        <div className="room-add-line">
          <span className="room-add-line-label" id={objectsId}>
            Objects
          </span>
          <ol aria-labelledby={objectsId} className="room-action-list room-add-objects">
            {objects}
          </ol>
        </div>
      )}
      {groups.length === 0 ? null : (
        <div className="room-add-line">
          <span className="room-add-line-label" id={actionsId}>
            Actions
          </span>
          <ul aria-labelledby={actionsId} className="room-add-groups">
            {groups.map((group) => (
              <li key={group.key}>
                <RoomAddGroupMenu group={group} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function RoomAddGroupMenu({ group }: { readonly group: RoomAddGroup }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const focusedSemanticOwner = useAppSelector((state) => state.editorSession.focusedSemanticOwner);
  const revision = useAppSelector((state) => state.editorSession.semanticNavigationRevision);
  const [openedAt, setOpenedAt] = useState<number>();
  const navigated =
    focusedSemanticOwner === undefined || focusedSemanticOwner === null
      ? undefined
      : group.actions.find(
          (action) =>
            semanticAddressKey(action.address) === semanticAddressKey(focusedSemanticOwner),
        );
  // Finding navigation to an action opens its family's list once per navigation.
  const shown = open || (navigated !== undefined && openedAt !== revision);
  const findings = group.actions.filter((action) => action.findingMark?.['data-has-findings']);
  const findingText = findings
    .map((action) => action.findingMark?.['aria-description'])
    .filter((text) => text !== undefined)
    .join(' ');
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setOpenedAt(revision);
  };
  // Arrows, Home and End move through every item, unavailable ones included, so
  // their reason can be read; from the panel itself ArrowUp lands on the last item.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button.room-add-action'),
    );
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'Home'
        ? items[0]
        : event.key === 'End'
          ? items.at(-1)
          : event.key === 'ArrowDown'
            ? items[(at + 1) % items.length]
            : event.key === 'ArrowUp'
              ? items[at === -1 ? items.length - 1 : (at - 1 + items.length) % items.length]
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    next.focus();
  };
  return (
    <Popover.Root onOpenChange={onOpenChange} open={shown}>
      <Popover.Trigger asChild>
        <button
          aria-description={findingText === '' ? undefined : findingText}
          className="secondary-action action-compact room-add-group"
          data-has-findings={findings.length > 0 || undefined}
          data-semantic-owner={findings[0]?.findingMark?.['data-semantic-owner']}
          ref={trigger}
          type="button"
        >
          {group.label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          aria-label={`Add from ${group.label}`}
          className="room-add-menu"
          collisionPadding={12}
          onKeyDown={onKeyDown}
          onOpenAutoFocus={(event) => {
            if (navigated === undefined) return;
            event.preventDefault();
            document
              .querySelector<HTMLButtonElement>(
                `[data-room-add-action="${CSS.escape(navigated.key)}"]`,
              )
              ?.focus();
          }}
          sideOffset={6}
        >
          <ul className="room-add-actions">
            {group.actions.map((action) => (
              <li key={action.key}>
                <button
                  {...action.findingMark}
                  {...hintProps(action.unavailable, action.findingMark?.['aria-description'])}
                  aria-disabled={action.unavailable === undefined ? undefined : true}
                  className="room-add-action"
                  data-room-add-action={action.key}
                  onClick={() => {
                    if (action.unavailable !== undefined) return;
                    onOpenChange(false);
                    action.onSelect(trigger.current);
                  }}
                  type="button"
                >
                  {action.icon === undefined ? null : (
                    <ArtworkIcon className="artwork-label-icon" source={action.icon} />
                  )}
                  <span>{action.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
