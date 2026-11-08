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
  WorkspaceRoomAnchorObject,
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

/** The switch kinds in the order their toggles stand. */
const switchKindOrder: readonly ChallengeSwitchKind[] = ['time', 'perfectClear', 'elite'];

type SwitchObject = Extract<RoomAnchorObject, { readonly kind: 'challengeSwitch' }>;

/**
 * One toggle per switch kind: the observed kind's removes the switch, another
 * observable kind's observes it in place of the current one, and a kind the
 * engine locks carries its rule. While the entry is unreached, only the
 * observed kind can change.
 */
function switchKindToggles(
  object: SwitchObject,
  observed: ChallengeSwitchKind | undefined,
  bind: (key: string, commands: readonly ProjectCommand[]) => string,
  objectLock: WorkspaceAnchorObjectLock | undefined,
  /** The present switch's removal. */
  removeKey: string | undefined,
): NonNullable<WorkspaceRoomAnchorObject['switchKinds']> {
  const unreached: WorkspaceAnchorObjectLock = { reason: 'unreached' };
  return switchKindOrder.map((switchKind) => {
    const row = object.kinds.find((candidate) => candidate.switchKind === switchKind);
    if (object.present && switchKind === observed)
      return Object.freeze({
        switchKind,
        ...(removeKey === undefined ? {} : { toggleKey: removeKey }),
      });
    // An absent switch with no spot left is refused whatever its kind.
    const lock: WorkspaceAnchorObjectLock | undefined =
      row === undefined || object.refusals === undefined
        ? unreached
        : !object.present && object.refusals.some((refusal) => refusal.reason === 'noFreeAnchor')
          ? (objectLock ?? unreached)
          : row.lock === undefined
            ? undefined
            : {
                reason: 'refused',
                sentences: Object.freeze([challengeSwitchRuleSentence(row.lock)]),
              };
    if (lock === undefined && row?.observe !== undefined)
      return Object.freeze({
        switchKind,
        toggleKey: bind(`kind:${switchKind}`, [row.observe]),
      });
    return Object.freeze({ switchKind, lock: Object.freeze(lock ?? unreached) });
  });
}

/** Why an absent object cannot be added now, each rule as one sentence; undefined while unreached. */
function refusalLock(object: RoomAnchorObject): WorkspaceAnchorObjectLock | undefined {
  if (object.refusals === undefined) return { reason: 'unreached' };
  const sentences = (() => {
    switch (object.kind) {
      case 'stygianWell':
        return object.refusals.map((refusal) =>
          refusal.reason === 'noFreeAnchor' ? fullSentence : stygianWellRefusalSentence(refusal),
        );
      case 'hermesShrine':
        return object.refusals.map((refusal) =>
          refusal.reason === 'noFreeAnchor' ? fullSentence : hermesShrineRefusalSentence(refusal),
        );
      case 'challengeSwitch':
        if (object.refusals.some((refusal) => refusal.reason === 'noFreeAnchor'))
          return [fullSentence];
        return object.kinds.flatMap((kind) =>
          kind.lock === undefined ? [] : [challengeSwitchRuleSentence(kind.lock)],
        );
      case 'purgingPool':
        return [];
    }
  })();
  return sentences.length === 0
    ? undefined
    : { reason: 'refused', sentences: Object.freeze([...new Set(sentences)]) };
}

/**
 * A room's anchor objects as the engine reads them: whether each stands here
 * with the command adding or removing it, a present object's anchor with the
 * free anchors it can move to, and a present switch's other types. The
 * physical anchors carry what stands on each, for the map. Absent for an
 * unknown room or one with neither anchors nor present objects.
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
  const bind = (key: string, commands: readonly ProjectCommand[]): string => {
    bound.push({ key, commands: Object.freeze([...commands]) });
    return key;
  };
  const kindOf = (kind: RoomAnchorObjectKind) =>
    kind === 'challengeSwitch' && switchKind !== undefined ? { switchKind } : {};
  const pin = product.anchors.find((anchor) => anchor.pinned)?.anchorId;
  const objects = product.objects
    // An object the route never hosts here and the plan does not hold has nothing to show.
    .filter((object) => object.present || object.hosted)
    .map((object): WorkspaceRoomAnchorObject => {
      const anchorAddress = createRoomFeatureAddress(address, {
        kind: 'objectAnchor',
        object: object.kind,
      });
      const toggle = object.fixed ? undefined : object.present ? object.remove : object.place;
      const lock = object.present || object.fixed ? undefined : refusalLock(object);
      const pinned = object.kind === 'stygianWell' && pin !== undefined ? pin : undefined;
      const toggleKey =
        toggle === undefined
          ? undefined
          : bind(`${object.present ? 'remove' : 'add'}:${object.kind}`, [toggle]);
      const switchKinds =
        object.kind === 'challengeSwitch'
          ? switchKindToggles(object, switchKind, bind, lock, toggleKey)
          : [];
      return Object.freeze({
        object: object.kind,
        ...kindOf(object.kind),
        address: presenceAddress(address, object.kind),
        anchorAddress,
        anchorMarker: input.marker(anchorAddress),
        present: object.present,
        fixed: object.fixed,
        ...(toggleKey === undefined ? {} : { toggleKey }),
        ...(lock === undefined ? {} : { lock: Object.freeze(lock) }),
        ...(object.present
          ? {
              anchor: Object.freeze({
                ...(object.anchorId === undefined ? {} : { anchorId: object.anchorId }),
                ...(pinned === undefined ? {} : { pinned }),
                ...(object.derivedAnchorId === undefined
                  ? {}
                  : { derivedAnchorId: object.derivedAnchorId }),
                choices: Object.freeze(
                  (object.anchorChoices ?? [])
                    .filter((choice) => choice.anchorId !== (object.anchorId ?? null))
                    .map((choice) =>
                      Object.freeze({
                        key: bind(`anchor:${object.kind}@${choice.anchorId ?? 'game'}`, [
                          choice.command,
                        ]),
                        anchorId: choice.anchorId,
                      }),
                    ),
                ),
              }),
            }
          : {}),
        ...(switchKinds.length === 0 ? {} : { switchKinds: Object.freeze(switchKinds) }),
      });
    });
  const anchors = [...product.anchors]
    .sort((left, right) => left.anchorId - right.anchorId)
    .map((anchor, index) =>
      Object.freeze({
        anchorId: anchor.anchorId,
        number: index + 1,
        ...(anchor.occupant === undefined
          ? {}
          : { occupant: Object.freeze({ object: anchor.occupant, ...kindOf(anchor.occupant) }) }),
        ...(anchor.derived === true ? { derived: true as const } : {}),
      }),
    );
  return Object.freeze({
    objectSlots: Object.freeze({
      interactionKey,
      anchors: Object.freeze(anchors),
      objects: Object.freeze(objects),
    }),
    requirement: Object.freeze({
      kind: 'roomChoices' as const,
      owner: address,
      interactionKey,
      choices: Object.freeze(bound.map((choice) => Object.freeze(choice))),
    }),
  });
}
