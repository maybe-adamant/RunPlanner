import {
  createRoomFeatureAddress,
  semanticAddressKey,
  type OccurrenceAddress,
  type ProjectCommand,
  type RoomFeatureAddress,
} from '@run-planner/engine/authored-project';
import type { ChallengeSwitchKind } from '@run-planner/engine/catalog-schema';
import type {
  RoomAnchorObject,
  RoomAnchorObjectKind,
  RoomAnchorSlots,
} from '@run-planner/engine/simulation';

import { challengeSwitchRuleSentence } from '@planner/projections/challengeSwitchCopy';
import {
  hermesShrineRefusalSentence,
  stygianWellRefusalSentence,
} from '@planner/projections/roomObjectPlacementCopy';
import type {
  WorkspaceAnchorObjectLock,
  WorkspaceAnchorOccupant,
  WorkspaceAnchorSpot,
  WorkspaceAnchorSpotChoice,
  WorkspaceRoomObjectSlots,
} from '../contracts/features';
import type { WorkspaceMarker } from '../contracts/navigation';
import type { WorkspaceOccurrenceInteractionRequirement } from '../interactions/interaction-requirements';

type ChoicesRequirement = Extract<
  WorkspaceOccurrenceInteractionRequirement,
  { readonly kind: 'roomChoices' }
>;

/** The owner of each object's presence findings. */
function presenceAddress(
  owner: OccurrenceAddress,
  object: RoomAnchorObjectKind,
): RoomFeatureAddress {
  switch (object) {
    case 'stygianWell':
      return createRoomFeatureAddress(owner, { kind: 'stygianWellPresence' });
    case 'purgingPool':
      return createRoomFeatureAddress(owner, { kind: 'purgingPoolInventory' });
    case 'hermesShrine':
      return createRoomFeatureAddress(owner, { kind: 'hermesShrinePresence' });
    case 'challengeSwitch':
      return createRoomFeatureAddress(owner, { kind: 'challengeSwitch' });
  }
}

const fullSentence = 'The room’s other objects take every spot.';

/** Why an absent object cannot be added now; a switch is refused per type, a fixed Pool never added. */
function ownRefusalSentences(object: RoomAnchorObject): readonly string[] {
  switch (object.kind) {
    case 'stygianWell':
      return (object.refusals ?? []).map((refusal) =>
        refusal.reason === 'noFreeAnchor' ? fullSentence : stygianWellRefusalSentence(refusal),
      );
    case 'hermesShrine':
      return (object.refusals ?? []).map((refusal) =>
        refusal.reason === 'noFreeAnchor' ? fullSentence : hermesShrineRefusalSentence(refusal),
      );
    case 'challengeSwitch':
    case 'purgingPool':
      return [];
  }
}

/**
 * A room's physical anchors, numbered by ascending id, as the engine reads
 * them: each spot's authored occupant and the choices it offers, with the
 * commands each applies, and the present objects left to the game. An empty
 * spot adds an object there or moves a present one there; an occupied spot
 * changes or replaces its object, returns it to the game or removes it. A
 * placement composes the engine's own add command with the anchor it names.
 * Absent for an unknown room or
 * one with neither anchors nor present objects.
 */
export function assembleRoomObjectSlots(input: {
  readonly address: OccurrenceAddress;
  readonly product: RoomAnchorSlots | undefined;
  /** The observed switch's type, as the switch's own rows read it. */
  readonly switchKind: ChallengeSwitchKind | undefined;
  readonly marker: (address: RoomFeatureAddress) => WorkspaceMarker;
}):
  | { readonly objectSlots: WorkspaceRoomObjectSlots; readonly requirement: ChoicesRequirement }
  | undefined {
  const { address, product, switchKind } = input;
  if (
    product === undefined ||
    (product.anchors.length === 0 && !product.objects.some((object) => object.present))
  )
    return undefined;
  const interactionKey = `roomObjects:${semanticAddressKey(address)}`;
  const bound: { key: string; commands: readonly ProjectCommand[] }[] = [];
  const occupant = (object: RoomAnchorObject): WorkspaceAnchorOccupant => {
    const anchorAddress = createRoomFeatureAddress(address, {
      kind: 'objectAnchor',
      object: object.kind,
    });
    return Object.freeze({
      object: object.kind,
      address: presenceAddress(address, object.kind),
      anchorAddress,
      anchorMarker: input.marker(anchorAddress),
      fixed: object.fixed,
      ...(object.kind === 'challengeSwitch' && switchKind !== undefined ? { switchKind } : {}),
    });
  };
  const switchObject = product.objects.find(
    (object): object is Extract<RoomAnchorObject, { readonly kind: 'challengeSwitch' }> =>
      object.kind === 'challengeSwitch',
  );
  const switchKinds = switchObject?.kinds ?? [];
  const objectOf = (kind: RoomAnchorObjectKind): RoomAnchorObject => {
    const found = product.objects.find((object) => object.kind === kind);
    if (found === undefined) throw new Error(`${kind} is not an anchor object of this room`);
    return found;
  };
  const choose = (
    scope: string,
    commands: readonly ProjectCommand[],
    choice: Omit<WorkspaceAnchorSpotChoice, 'key'>,
  ): WorkspaceAnchorSpotChoice => {
    const key = `${scope}:${choice.action}:${choice.object}${choice.switchKind === undefined ? '' : `:${choice.switchKind}`}${choice.anchorId === undefined ? '' : `@${choice.anchorId}`}`;
    bound.push({ key, commands });
    return Object.freeze({ key, ...choice });
  };
  const anchorCommand = (object: RoomAnchorObject, anchorId: number | null) =>
    object.anchorChoices?.find((choice) => choice.anchorId === anchorId)?.command;
  // The Well's pin takes only the Well, which needs no anchor of its own there.
  const pinOf = product.anchors.find((anchor) => anchor.pinned)?.anchorId;
  /** Each absent object's placement on this anchor: one per observable type for a switch. */
  const placements = (spot: number, pinned: boolean): WorkspaceAnchorSpotChoice[] =>
    product.objects.flatMap((object) => {
      if (object.present || object.place === undefined) return [];
      if (pinOf !== undefined && pinned !== (object.kind === 'stygianWell')) return [];
      const anchor = (commands: readonly ProjectCommand[]): readonly ProjectCommand[] =>
        pinned
          ? commands
          : [
              ...commands,
              Object.freeze({
                kind: 'ReplaceRoomObjectAnchor' as const,
                occurrence: address,
                object: object.kind,
                anchorId: spot,
              }),
            ];
      if (object.kind === 'challengeSwitch')
        return switchKinds.flatMap((row) =>
          row.observe === undefined
            ? []
            : [
                choose(String(spot), anchor([row.observe]), {
                  action: 'place',
                  object: object.kind,
                  switchKind: row.switchKind,
                  anchorId: spot,
                }),
              ],
        );
      return [
        choose(String(spot), anchor([object.place]), {
          action: 'place',
          object: object.kind,
          anchorId: spot,
        }),
      ];
    });
  const unavailableAt = (offered: readonly WorkspaceAnchorSpotChoice[], pinned: boolean) =>
    product.objects.flatMap((object) => {
      if (pinOf !== undefined && pinned !== (object.kind === 'stygianWell')) return [];
      if (object.kind === 'challengeSwitch' && object.refusals !== undefined) {
        if (object.present) return [];
        if (object.refusals.some((refusal) => refusal.reason === 'noFreeAnchor'))
          return [
            Object.freeze({
              object: object.kind,
              lock: Object.freeze({
                reason: 'refused' as const,
                sentences: Object.freeze([fullSentence]),
              }),
            }),
          ];
        return switchKinds.flatMap((kind) =>
          kind.lock === undefined ||
          offered.some(
            (choice) =>
              choice.object === 'challengeSwitch' && choice.switchKind === kind.switchKind,
          )
            ? []
            : [
                Object.freeze({
                  object: object.kind,
                  switchKind: kind.switchKind,
                  lock: Object.freeze({
                    reason: 'refused' as const,
                    sentences: Object.freeze([challengeSwitchRuleSentence(kind.lock)]),
                  }),
                }),
              ],
        );
      }
      if (object.present || object.fixed || offered.some((choice) => choice.object === object.kind))
        return [];
      const sentences = ownRefusalSentences(object);
      const lock: WorkspaceAnchorObjectLock | undefined =
        object.refusals === undefined
          ? { reason: 'unreached' }
          : sentences.length === 0
            ? undefined
            : { reason: 'refused', sentences: Object.freeze(sentences) };
      return lock === undefined ? [] : [Object.freeze({ object: object.kind, lock })];
    });
  /**
   * An occupied spot's own changes, as the engine offers them on the occupant's
   * native slot: a switch's other types, and each object replacing it, which
   * then stands here.
   */
  const changes = (
    anchorId: number,
    pinned: boolean,
    object: RoomAnchorObject,
  ): WorkspaceAnchorSpotChoice[] => {
    const slot = product.slots.find((candidate) => candidate.occupant === object.kind);
    if (slot === undefined) return [];
    const scope = String(anchorId);
    return slot.choices.flatMap((choice) => {
      if (choice.kind === null || choice.commands.length === 0) return [];
      const kind = choice.kind;
      if (kind === object.kind)
        return [
          choose(scope, choice.commands, {
            action: 'retype',
            object: kind,
            ...(choice.switchKind === undefined ? {} : { switchKind: choice.switchKind }),
          }),
        ];
      if (pinOf !== undefined && pinned !== (kind === 'stygianWell')) return [];
      return [
        choose(
          scope,
          pinned
            ? choice.commands
            : [
                ...choice.commands,
                Object.freeze({
                  kind: 'ReplaceRoomObjectAnchor' as const,
                  occurrence: address,
                  object: kind,
                  anchorId,
                }),
              ],
          {
            action: 'replace',
            object: kind,
            ...(choice.switchKind === undefined ? {} : { switchKind: choice.switchKind }),
            anchorId,
          },
        ),
      ];
    });
  };
  /** What leaves an occupied spot: back to the game, then removal. */
  const departures = (scope: string, object: RoomAnchorObject): WorkspaceAnchorSpotChoice[] => {
    const native = object.anchorId === undefined ? undefined : anchorCommand(object, null);
    return [
      ...(native === undefined
        ? []
        : [choose(scope, [native], { action: 'native', object: object.kind })]),
      ...(object.remove === undefined
        ? []
        : [choose(scope, [object.remove], { action: 'remove', object: object.kind })]),
    ];
  };
  const anchors = [...product.anchors].sort((left, right) => left.anchorId - right.anchorId);
  const spots = anchors.map((anchor, index): WorkspaceAnchorSpot => {
    const scope = String(anchor.anchorId);
    if (anchor.occupant !== undefined) {
      const object = objectOf(anchor.occupant);
      return Object.freeze({
        anchorId: anchor.anchorId,
        number: index + 1,
        pinned: anchor.pinned,
        occupant: occupant(object),
        choices: Object.freeze([
          ...changes(anchor.anchorId, anchor.pinned, object),
          ...departures(scope, object),
        ]),
        unavailable: Object.freeze([]),
      });
    }
    const moves = product.objects.flatMap((object) => {
      const command = object.present ? anchorCommand(object, anchor.anchorId) : undefined;
      return command === undefined
        ? []
        : [
            choose(scope, [command], {
              action: 'move',
              object: object.kind,
              anchorId: anchor.anchorId,
            }),
          ];
    });
    const offered = [...placements(anchor.anchorId, anchor.pinned), ...moves];
    return Object.freeze({
      anchorId: anchor.anchorId,
      number: index + 1,
      pinned: anchor.pinned,
      choices: Object.freeze(offered),
      unavailable: Object.freeze(unavailableAt(offered, anchor.pinned)),
    });
  });
  const held = new Set(product.anchors.flatMap((anchor) => anchor.occupant ?? []));
  const unplaced = product.objects
    .filter((object) => object.present && !held.has(object.kind))
    .map((object) => {
      const scope = `unplaced:${object.kind}`;
      const moves = (object.anchorChoices ?? []).flatMap((choice) =>
        choice.anchorId === null
          ? []
          : [
              choose(scope, [choice.command], {
                action: 'move',
                object: object.kind,
                anchorId: choice.anchorId,
              }),
            ],
      );
      return Object.freeze({
        ...occupant(object),
        choices: Object.freeze([...moves, ...departures(scope, object)]),
      });
    });
  return Object.freeze({
    objectSlots: Object.freeze({
      interactionKey,
      spots: Object.freeze(spots),
      unplaced: Object.freeze(unplaced),
    }),
    requirement: Object.freeze({
      kind: 'roomChoices' as const,
      owner: address,
      interactionKey,
      choices: Object.freeze(bound.map((choice) => Object.freeze(choice))),
    }),
  });
}
