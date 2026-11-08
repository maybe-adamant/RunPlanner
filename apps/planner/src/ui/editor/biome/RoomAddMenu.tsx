import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';
import { useId, useState, type ReactNode } from 'react';
import { useAppSelector } from '@planner/state/store';
import type { ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import type { FindingMarkProps } from '@planner/ui/feedback/useFindingTarget';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { TimelineRow } from './TimelineRow';
import { combinedFindingMark, roomAddActionItems } from './roomAddActions';

/** One optional action the room can add. */
export interface RoomAddAction {
  readonly key: string;
  readonly label: string;
  readonly icon?: ArtworkSource | undefined;
  /** The action's semantic owner, which finding navigation can focus. */
  readonly address: SemanticAddress;
  /** Why the action cannot be added now; the item stays listed and disabled. */
  readonly unavailable?: string;
  readonly findingMark?: FindingMarkProps;
  /** Adds the action, or starts choosing where it goes; the trigger regains focus after. */
  readonly onSelect: (trigger: HTMLButtonElement | null) => void;
}

/** The actions of one source family or room object, opened from their own entry. */
export interface RoomAddGroup {
  readonly key: string;
  readonly label: string;
  /** A room object's icon: the group then reads like the other object entries. */
  readonly icon?: ArtworkSource | undefined;
  readonly actions: readonly RoomAddAction[];
}

/**
 * The room's Add area: a line of room objects, each opening its own flow, and
 * a line of source families, each opening its short list of optional actions.
 */
export function RoomAddArea({
  footer,
  groups,
  objects,
}: {
  /** What sits under the area in its column, such as the doors' notes. */
  readonly footer?: ReactNode;
  /** Source families in display order, each with its optional actions. */
  readonly groups: readonly RoomAddGroup[];
  /** The room objects' and features' entries, each its own `li`, in display order. */
  readonly objects: readonly ReactNode[];
}) {
  const objectsId = useId();
  const actionsId = useId();
  const titleId = useId();
  // Beside a wide timeline the area is a side column that stays put even when empty;
  // below it, an empty area shows only for its notes.
  if (groups.length === 0 && objects.length === 0)
    return (
      <section
        aria-labelledby={titleId}
        className="room-add"
        data-empty={footer === undefined || footer === null ? '' : undefined}
      >
        <h4 className="room-add-title" id={titleId}>
          Optional actions
        </h4>
        <p className="room-add-empty">Nothing optional to add here</p>
        {footer}
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
          <ol aria-labelledby={objectsId} className="room-action-list room-add-entries">
            {objects}
          </ol>
        </div>
      )}
      {groups.length === 0 ? null : (
        <div className="room-add-line">
          <span className="room-add-line-label" id={actionsId}>
            Actions
          </span>
          <ol aria-labelledby={actionsId} className="room-action-list room-add-entries">
            {groups.map((group) => (
              <RoomAddEntry group={group} key={group.key} />
            ))}
          </ol>
        </div>
      )}
      {footer}
    </section>
  );
}

/**
 * One entry of the Add area: a room object's optional actions (a challenge
 * switch's use and claims, a Shrine's delivery) or a source family's pickups,
 * read like the other object entries: picking one adds it.
 */
export function RoomAddEntry({
  group,
  object,
}: {
  readonly group: RoomAddGroup;
  /** The room object the entry stands for, when it is one. */
  readonly object?: string;
}) {
  const id = `room-add-entry-${group.key}`;
  const [open, setOpen] = useState(false);
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
  // Finding navigation to an action opens its entry's list once per navigation.
  const shown = open || (navigated !== undefined && openedAt !== revision);
  const findingMark = combinedFindingMark(group.actions.map((action) => action.findingMark));
  const model: ContextualPickerModel<string> = Object.freeze({
    sections: Object.freeze([
      Object.freeze({
        collapsible: false,
        key: 'actions',
        kind: 'category' as const,
        label: group.label,
        items: Object.freeze(roomAddActionItems(group.actions)),
      }),
    ]),
  });
  return (
    <TimelineRow
      className="room-action-feature-roll"
      data-object={object}
      kind="insertion"
      label={
        <ContextualPicker<string>
          {...(findingMark === undefined ? {} : { findingMark })}
          ariaLabel={group.label}
          id={id}
          insertion
          itemTrailIcon={(item) => group.actions.find((action) => action.key === item.value)?.icon}
          label=""
          model={model}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setOpenedAt(revision);
          }}
          onSelect={(key) => {
            const action = group.actions.find((candidate) => candidate.key === key);
            if (action === undefined || action.unavailable !== undefined) return;
            setOpen(false);
            setOpenedAt(revision);
            action.onSelect(document.getElementById(id) as HTMLButtonElement | null);
          }}
          open={shown}
          placeholder={`${group.label} ▸`}
          searchable={false}
          triggerIcon={group.icon}
        />
      }
    />
  );
}
