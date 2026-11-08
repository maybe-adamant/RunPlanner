import { useRef } from 'react';

import { ArtworkIcon, type ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import type { FindingTargetProps } from '@planner/ui/feedback/useFindingTarget';
import {
  useRoomMapHighlightActions,
  useRoomMapLinks,
  type RoomMapHighlight,
} from '../room-map/roomMapHighlight';

/** One choice a spot offers; `preview` is the map point it shows while highlighted. */
export interface PlacementSpotItem {
  readonly key: string;
  readonly label: string;
  readonly icon?: ArtworkSource | undefined;
  readonly disabled?: boolean;
  readonly explanation?: string;
  readonly preview?: RoomMapHighlight;
}

const currentKey = 'current';

/**
 * One spot of a placement line as an icon chip: what stands there, its mark
 * on the corner, and the choices it offers. Hovering it, or one of its
 * choices, previews the point on the room's map.
 */
export function PlacementSpot({
  ariaLabel,
  badge,
  current,
  disabledHint,
  findingTarget,
  id,
  items,
  onOpen,
  onSelect,
  preview,
}: {
  readonly ariaLabel: string;
  readonly badge?: string | undefined;
  /** What stands on the spot; an empty spot shows a dashed chip. */
  readonly current: { readonly label: string; readonly icon?: ArtworkSource | undefined };
  /** Disables the spot with this hint, as for an unreached room. */
  readonly disabledHint?: string | undefined;
  readonly findingTarget?: FindingTargetProps | undefined;
  readonly id: string;
  readonly items: readonly PlacementSpotItem[];
  /** Opening the list, such as to assess its choices. */
  readonly onOpen?: (() => void) | undefined;
  readonly onSelect: (key: string) => void;
  /** The spot's own point on the map. */
  readonly preview?: RoomMapHighlight | undefined;
}) {
  const mapPreview = useRoomMapHighlightActions();
  const mapLinks = useRoomMapLinks();
  // The open list previews its highlighted choice; closing it clears whichever it showed last.
  const shownRef = useRef<RoomMapHighlight | undefined>(undefined);
  const show = (highlight: RoomMapHighlight | undefined): void => {
    if (highlight === undefined) return;
    shownRef.current = highlight;
    mapPreview?.show(highlight);
  };
  const byKey = new Map(items.map((item) => [item.key, item]));
  const enabled = items.some((item) => item.disabled !== true);
  // A spot nothing can change, such as the Well on its pin, shows what stands there.
  if (!enabled && disabledHint === undefined && current.icon !== undefined)
    return (
      <span className="placement-spot" {...mapLinks(preview)}>
        <span
          id={id}
          {...findingTarget}
          aria-label={ariaLabel}
          className="room-object-fixed placement-spot-fixed"
          role="img"
        >
          <ArtworkIcon className="artwork-label-icon" source={current.icon} />
          {badge === undefined ? null : (
            <span aria-hidden="true" className="timeline-chip-badge">
              {badge}
            </span>
          )}
        </span>
      </span>
    );
  return (
    <span className="placement-spot" {...mapLinks(preview)}>
      <ContextualPicker<string>
        ariaLabel={ariaLabel}
        {...(findingTarget === undefined ? {} : { findingTarget })}
        id={id}
        itemIcon={(item) =>
          item.value === currentKey ? current.icon : byKey.get(item.value)?.icon
        }
        label=""
        layout="inline"
        {...(disabledHint === undefined ? {} : { disabledHint })}
        locked={disabledHint === undefined && !enabled}
        model={declaredChoicesPicker(
          [
            { key: currentKey, value: currentKey, label: current.label },
            ...items.map((item) => ({
              key: item.key,
              value: item.key,
              label: item.label,
              ...(item.disabled === true ? { disabled: true } : {}),
              ...(item.explanation === undefined ? {} : { explanation: item.explanation }),
            })),
          ],
          currentKey,
        )}
        onActiveChange={(item) =>
          show(item === undefined ? preview : (byKey.get(item.value)?.preview ?? preview))
        }
        onOpenChange={(open) => {
          if (open) {
            onOpen?.();
            show(preview);
            return;
          }
          const shown = shownRef.current;
          shownRef.current = undefined;
          if (shown !== undefined) mapPreview?.release(shown);
        }}
        onSelect={(key) => {
          if (key !== currentKey) onSelect(key);
        }}
        placeholder={current.label}
        searchable={false}
        {...(badge === undefined ? {} : { triggerBadge: badge })}
        triggerIcon={current.icon}
        triggerLabel={current.label}
        triggerSize="icon"
      />
    </span>
  );
}
