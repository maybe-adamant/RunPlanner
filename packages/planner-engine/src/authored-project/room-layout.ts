import type { RoomDeclaration } from '../catalog-schema';
import type { RoomAnchorObjectKind } from './addresses';
import type { RoomLayout, RoomOccurrence } from './model';
import {
  expectExactKeys,
  expectPositiveInteger,
  expectRecord,
  failProjectDocument,
} from './validation';

/** The `HeroStart` ids a room can be entered at; empty for a room without map points. */
export function roomHeroStartIds(room: RoomDeclaration): readonly number[] {
  return room.mapPoints?.heroStarts.map((start) => start.id) ?? [];
}

/** The room's `ChallengeSwitchBase` anchor ids. */
export function roomObjectAnchorIds(room: RoomDeclaration): readonly number[] {
  return room.mapPoints?.challengeSwitchAnchors.map((anchor) => anchor.id) ?? [];
}

/**
 * The room layout's static domain: an entry must be one of the room's
 * `HeroStart`s. Whether it is possible where the room is entered is a finding.
 */
export function roomLayoutIssue(room: RoomDeclaration, layout: RoomLayout): string | undefined {
  if (layout.flipped === undefined && layout.entryStartPointId === undefined)
    return 'must set flipped or entryStartPointId; absence is the unset layout';
  if (
    layout.entryStartPointId !== undefined &&
    !roomHeroStartIds(room).includes(layout.entryStartPointId)
  )
    return `entry ${layout.entryStartPointId} is not a HeroStart of ${room.gameName}`;
  return undefined;
}

export function decodeRoomLayout(value: unknown, room: RoomDeclaration, path: string): RoomLayout {
  const raw = expectRecord(value, path);
  const hasFlipped = Object.hasOwn(raw, 'flipped');
  const hasEntry = Object.hasOwn(raw, 'entryStartPointId');
  expectExactKeys(
    raw,
    [...(hasFlipped ? ['flipped'] : []), ...(hasEntry ? ['entryStartPointId'] : [])],
    path,
  );
  if (hasFlipped && typeof raw.flipped !== 'boolean')
    failProjectDocument(`${path}.flipped`, 'must be boolean');
  const layout: RoomLayout = Object.freeze({
    ...(hasFlipped ? { flipped: raw.flipped as boolean } : {}),
    ...(hasEntry
      ? {
          entryStartPointId: expectPositiveInteger(
            raw.entryStartPointId,
            `${path}.entryStartPointId`,
          ),
        }
      : {}),
  });
  const issue = roomLayoutIssue(room, layout);
  if (issue !== undefined) failProjectDocument(path, issue);
  return layout;
}

/** The occurrence with its layout replaced; an empty layout removes the field. */
export function withRoomLayout(
  occurrence: RoomOccurrence,
  layout: RoomLayout | undefined,
): RoomOccurrence {
  const { layout: _previous, ...rest } = occurrence;
  void _previous;
  return Object.freeze(
    layout === undefined || (layout.flipped === undefined && layout.entryStartPointId === undefined)
      ? rest
      : { ...rest, layout: Object.freeze({ ...layout }) },
  );
}

type AnchoredLeaf = { readonly anchorId?: number };

/** The present room object's leaf, which owns its optional anchor. */
export function roomAnchorObjectLeaf(
  occurrence: RoomOccurrence,
  object: RoomAnchorObjectKind,
): AnchoredLeaf | undefined {
  return occurrence[object];
}

/** The occurrence with one present object's anchor replaced; undefined clears it. */
export function withRoomObjectAnchor(
  occurrence: RoomOccurrence,
  object: RoomAnchorObjectKind,
  anchorId: number | undefined,
): RoomOccurrence {
  const leaf = occurrence[object];
  if (leaf === undefined) throw new Error(`${occurrence.gameName} has no ${object}`);
  const { anchorId: _previous, ...rest } = leaf as AnchoredLeaf;
  void _previous;
  return Object.freeze({
    ...occurrence,
    [object]: Object.freeze(anchorId === undefined ? rest : { ...rest, anchorId }),
  });
}

/**
 * Splits a stored object leaf's `anchorId` from the rest, which its own codec
 * decodes; the anchor must be one of the room's anchors.
 */
export function decodeObjectAnchor(
  value: unknown,
  room: RoomDeclaration,
  path: string,
): { readonly leaf: unknown; readonly anchorId?: number } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return { leaf: value };
  const record = value as Record<string, unknown>;
  if (!Object.hasOwn(record, 'anchorId')) return { leaf: value };
  const { anchorId: raw, ...leaf } = record;
  const anchorId = expectPositiveInteger(raw, `${path}.anchorId`);
  if (!roomObjectAnchorIds(room).includes(anchorId))
    failProjectDocument(`${path}.anchorId`, `is not a ChallengeSwitchBase of ${room.gameName}`);
  return { leaf, anchorId };
}

/** A decoded leaf with its anchor restored, last like every later edit appends it. */
export function attachObjectAnchor<T extends object>(leaf: T, anchorId: number | undefined): T {
  return anchorId === undefined ? leaf : (Object.freeze({ ...leaf, anchorId }) as T);
}
