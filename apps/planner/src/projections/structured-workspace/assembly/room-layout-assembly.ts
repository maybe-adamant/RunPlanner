import {
  createRoomFeatureAddress,
  semanticAddressKey,
  type OccurrenceAddress,
  type ProjectCommand,
  type RoomFeatureAddress,
  type RoomLayout,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';
import {
  layoutWithEntry,
  layoutWithFlip,
  roomEntryOptions,
  type RoomLayoutAuthoring,
} from '@run-planner/engine/simulation';

import type {
  WorkspaceRoomEntryPair,
  WorkspaceRoomEntryState,
  WorkspaceRoomLayout,
} from '../contracts/features';
import type { WorkspaceMarker } from '../contracts/navigation';
import type { WorkspaceOccurrenceInteractionRequirement } from '../interactions/interaction-requirements';

type ChoicesRequirement = Extract<
  WorkspaceOccurrenceInteractionRequirement,
  { readonly kind: 'roomChoices' }
>;

const pairKey = (pair: WorkspaceRoomEntryPair): string =>
  `entry:${pair.pointId}:${pair.flipped ? 'flipped' : 'unflipped'}`;

/**
 * The room's entry and orientation as one choice of (entry, flip) pairs, as
 * its entry settles them: an entry that needs one flip is one pair, an entry
 * either flip of a roll allows is two, and a settled flip gives one pair per
 * entry. Each pair's command composes the engine's own entry and flip
 * layouts. Absent for a room without map points.
 */
export function assembleRoomLayout(input: {
  readonly address: OccurrenceAddress;
  readonly room: RoomDeclaration;
  readonly occurrence: RoomOccurrence;
  /** Undefined while the room's entry is unreached. */
  readonly authoring: RoomLayoutAuthoring | undefined;
  readonly marker: (address: RoomFeatureAddress) => WorkspaceMarker;
}): { readonly layout: WorkspaceRoomLayout; readonly requirement: ChoicesRequirement } | undefined {
  const { address, authoring } = input;
  const starts = input.room.mapPoints?.heroStarts;
  if (starts === undefined) return undefined;
  const interactionKey = `roomLayout:${semanticAddressKey(address)}`;
  const bound: { key: string; commands: readonly ProjectCommand[] }[] = [];
  const bind = (key: string, layout: RoomLayout): string => {
    bound.push({
      key,
      commands: Object.freeze([
        Object.freeze({
          kind: 'ReplaceRoomLayout' as const,
          occurrence: address,
          layout: Object.freeze(layout),
        }),
      ]),
    });
    return key;
  };
  const entryAddress = createRoomFeatureAddress(address, { kind: 'roomLayoutEntry' });
  const flipAddress = createRoomFeatureAddress(address, { kind: 'roomLayoutFlip' });

  const settled = (): {
    readonly state: WorkspaceRoomEntryState;
    readonly eligible: readonly number[];
    readonly entryId?: number;
    readonly flipped?: boolean;
  } => {
    if (authoring === undefined) return { state: { kind: 'unreached' }, eligible: [] };
    const { settlement } = authoring;
    const authored = authoring.authored;
    const flip = settlement.flip;
    const entry = settlement.entry;
    if (entry.kind === 'unknown')
      return {
        state: { kind: 'unknown' },
        eligible: [],
        ...(flip.value === undefined ? {} : { flipped: flip.value }),
      };
    const roll = flip.kind === 'roll';
    // A derived entry under an authored rolled flip keeps no list across the other flip: its one pair is all that is known.
    const narrowed = roll && entry.kind === 'derived' && authored?.flipped !== undefined;
    const pairs: WorkspaceRoomEntryPair[] = roomEntryOptions(settlement).flatMap((option) =>
      option.flipped !== undefined
        ? [{ pointId: option.startPointId, flipped: option.flipped }]
        : !roll
          ? [{ pointId: option.startPointId, flipped: flip.value === true }]
          : narrowed
            ? [{ pointId: option.startPointId, flipped: authored.flipped === true }]
            : [
                { pointId: option.startPointId, flipped: false },
                { pointId: option.startPointId, flipped: true },
              ],
    );
    const pointId = entry.kind === 'choice' ? entry.point?.startPointId : entry.point.startPointId;
    const value =
      pointId === undefined || flip.value === undefined
        ? undefined
        : pairs.find((pair) => pair.pointId === pointId && pair.flipped === flip.value);
    const stale = settlement.flipUnavailable === true || settlement.entryUnavailable !== undefined;
    const clear = (): RoomLayout => ({});
    const eligible = [...new Set(pairs.map((pair) => pair.pointId))];
    const shownFlip = value?.flipped ?? flip.value;
    const held = {
      ...(authored?.entryStartPointId === undefined ? {} : { pointId: authored.entryStartPointId }),
      ...(authored?.flipped === undefined ? {} : { flipped: authored.flipped }),
    };
    if (pairs.length === 1 && entry.kind !== 'choice') {
      const only = pairs[0]!;
      return {
        state: {
          kind: 'settled',
          by: entry.kind === 'fixed' ? 'fixed' : 'door',
          value: only,
          ...(stale ? { stale: { clearKey: bind('entry:clear', clear()), ...held } } : {}),
        },
        eligible,
        entryId: only.pointId,
        flipped: only.flipped,
      };
    }
    // The entry is authored only where the game picks among entries; a fixed entry keeps its own.
    const pickEntry = entry.kind !== 'fixed';
    const layoutFor = (pair: WorkspaceRoomEntryPair): RoomLayout => {
      const withEntry = pickEntry
        ? layoutWithEntry(settlement, authored, pair.pointId)
        : (authored ?? {});
      return roll ? layoutWithFlip(settlement, withEntry, pair.flipped) : withEntry;
    };
    return {
      state: {
        kind: 'choice',
        ...(value === undefined ? {} : { value }),
        ...(stale ? { stale: held } : {}),
        choices: Object.freeze([
          ...(authoring.clear === undefined
            ? []
            : [{ key: bind('entry:game', clear()), pair: null }]),
          ...pairs
            .filter((pair) => stale || pair !== value)
            .map((pair) => ({ key: bind(pairKey(pair), layoutFor(pair)), pair })),
        ]),
      },
      eligible,
      ...(pointId === undefined ? {} : { entryId: pointId }),
      ...(shownFlip === undefined ? {} : { flipped: shownFlip }),
    };
  };

  const { state, eligible, entryId, flipped } = settled();
  return Object.freeze({
    layout: Object.freeze({
      interactionKey,
      entries: Object.freeze(
        starts
          .map((start) => start.id)
          .sort((left, right) => left - right)
          .map((pointId, index) => Object.freeze({ pointId, number: index + 1 })),
      ),
      eligible: Object.freeze(eligible),
      ...(entryId === undefined ? {} : { entryId }),
      ...(flipped === undefined ? {} : { flipped }),
      address: entryAddress,
      flipAddress,
      marker: input.marker(entryAddress),
      flipMarker: input.marker(flipAddress),
      state: Object.freeze(state),
    }),
    requirement: Object.freeze({
      kind: 'roomChoices' as const,
      owner: address,
      interactionKey,
      choices: Object.freeze(bound.map((choice) => Object.freeze(choice))),
    }),
  });
}
