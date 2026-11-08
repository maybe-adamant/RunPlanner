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
import type { RoomLayoutAuthoring } from '@run-planner/engine/simulation';

import type { WorkspaceRoomLayout, WorkspaceRoomLayoutControl } from '../contracts/features';
import type { WorkspaceMarker } from '../contracts/navigation';
import type { WorkspaceOccurrenceInteractionRequirement } from '../interactions/interaction-requirements';

type ChoicesRequirement = Extract<
  WorkspaceOccurrenceInteractionRequirement,
  { readonly kind: 'roomChoices' }
>;

/**
 * The room's flip and entry as its entry settles them, with the choices the
 * engine leaves open and the commands it names for each. Returning one value
 * to the game keeps the rest of the authored layout. Absent for a room
 * without map points.
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
  const bind = (key: string, command: ProjectCommand): string => {
    bound.push({ key, commands: Object.freeze([command]) });
    return key;
  };
  const replace = (layout: RoomLayout): ProjectCommand =>
    Object.freeze({
      kind: 'ReplaceRoomLayout',
      occurrence: address,
      layout: Object.freeze(layout),
    });
  const authored = input.occurrence.layout;
  const withoutFlip = (): RoomLayout =>
    authored?.entryStartPointId === undefined
      ? {}
      : { entryStartPointId: authored.entryStartPointId };
  const withoutEntry = (): RoomLayout =>
    authored?.flipped === undefined ? {} : { flipped: authored.flipped };
  const flipAddress = createRoomFeatureAddress(address, { kind: 'roomLayoutFlip' });
  const entryAddress = createRoomFeatureAddress(address, { kind: 'roomLayoutEntry' });
  const control = <T>(
    owner: RoomFeatureAddress,
    state: WorkspaceRoomLayoutControl<T>['state'],
  ): WorkspaceRoomLayoutControl<T> =>
    Object.freeze({ address: owner, marker: input.marker(owner), state: Object.freeze(state) });

  const flipState = (): WorkspaceRoomLayoutControl<boolean>['state'] => {
    if (authoring === undefined) return { kind: 'unreached' };
    const flip = authoring.settlement.flip;
    if (flip.kind !== 'roll')
      return {
        kind: flip.kind,
        value: flip.value,
        ...(authored?.flipped === undefined || authoring.settlement.flipUnavailable !== true
          ? {}
          : {
              stale: {
                value: authored.flipped,
                clearKey: bind('flip:clear', replace(withoutFlip())),
              },
            }),
      };
    return {
      kind: 'choice',
      ...(flip.value === undefined ? {} : { value: flip.value }),
      choices: Object.freeze([
        ...(authored?.flipped === undefined
          ? []
          : [{ key: bind('flip:game', replace(withoutFlip())), value: null }]),
        ...authoring.flips.map((choice) => ({
          key: bind(`flip:${choice.flipped}`, choice.command),
          value: choice.flipped,
        })),
      ]),
    };
  };

  const entryState = (): WorkspaceRoomLayoutControl<number>['state'] => {
    if (authoring === undefined) return { kind: 'unreached' };
    const entry = authoring.settlement.entry;
    const staleEntry =
      authoring.settlement.entryUnavailable === undefined ? undefined : authored?.entryStartPointId;
    switch (entry.kind) {
      case 'unknown':
        return { kind: 'unknown' };
      case 'fixed':
      case 'derived':
        return {
          kind: entry.kind,
          value: entry.point.startPointId,
          ...(staleEntry === undefined
            ? {}
            : {
                stale: {
                  value: staleEntry,
                  clearKey: bind('entry:clear', replace(withoutEntry())),
                },
              }),
        };
      case 'choice':
        return {
          kind: 'choice',
          ...(entry.point === undefined ? {} : { value: entry.point.startPointId }),
          ...(staleEntry === undefined ? {} : { stale: staleEntry }),
          choices: Object.freeze([
            ...(authored?.entryStartPointId === undefined
              ? []
              : [{ key: bind('entry:game', replace(withoutEntry())), value: null }]),
            ...authoring.entries.map((choice) => ({
              key: bind(`entry:${choice.option.startPointId}`, choice.command),
              value: choice.option.startPointId,
              ...(choice.option.flipped === undefined ? {} : { flipped: choice.option.flipped }),
            })),
          ]),
        };
    }
  };

  const flip = control<boolean>(flipAddress, flipState());
  const entry = control<number>(entryAddress, entryState());
  return Object.freeze({
    layout: Object.freeze({
      interactionKey,
      entries: Object.freeze(
        starts
          .map((start) => start.id)
          .sort((left, right) => left - right)
          .map((pointId, index) => Object.freeze({ pointId, number: index + 1 })),
      ),
      flip,
      entry,
    }),
    requirement: Object.freeze({
      kind: 'roomChoices' as const,
      owner: address,
      interactionKey,
      choices: Object.freeze(bound.map((choice) => Object.freeze(choice))),
    }),
  });
}
