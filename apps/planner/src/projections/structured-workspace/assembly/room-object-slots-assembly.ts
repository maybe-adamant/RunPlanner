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
  WorkspaceAnchorSlot,
  WorkspaceAnchorSlotChoice,
  WorkspaceRoomObjectSlots,
} from '../contracts/features';
import type { WorkspaceOccurrenceInteractionRequirement } from '../interactions/interaction-requirements';

type SlotsRequirement = Extract<
  WorkspaceOccurrenceInteractionRequirement,
  { readonly kind: 'roomObjectSlots' }
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

/**
 * Why an absent object cannot be added now, its own rules only: a slot
 * replacing its occupant frees the anchor, and an empty slot is a free one.
 */
function ownRefusalSentences(object: RoomAnchorObject): readonly string[] {
  switch (object.kind) {
    case 'stygianWell':
      return (object.refusals ?? []).flatMap((refusal) =>
        refusal.reason === 'noFreeAnchor' ? [] : [stygianWellRefusalSentence(refusal)],
      );
    case 'hermesShrine':
      return (object.refusals ?? []).flatMap((refusal) =>
        refusal.reason === 'noFreeAnchor' ? [] : [hermesShrineRefusalSentence(refusal)],
      );
    // A switch is refused per type; a fixed Pool is never added.
    case 'challengeSwitch':
    case 'purgingPool':
      return [];
  }
}

/**
 * A room's challenge switch anchors as the engine fills them: each slot's
 * occupant, the choices it offers with the commands each applies, and the
 * present objects left without an anchor. Absent for an unknown room or one
 * with neither anchors nor stranded objects.
 */
export function assembleRoomObjectSlots(input: {
  readonly address: OccurrenceAddress;
  readonly product: RoomAnchorSlots | undefined;
  /** The observed switch's type, as the switch's own rows read it. */
  readonly switchKind: ChallengeSwitchKind | undefined;
}):
  | { readonly objectSlots: WorkspaceRoomObjectSlots; readonly requirement: SlotsRequirement }
  | undefined {
  const { address, product, switchKind } = input;
  if (product === undefined || (product.anchorCount === 0 && product.unanchored.length === 0))
    return undefined;
  const interactionKey = `roomObjectSlots:${semanticAddressKey(address)}`;
  const bound: { key: string; commands: readonly ProjectCommand[] }[] = [];
  const occupant = (object: RoomAnchorObject): WorkspaceAnchorOccupant =>
    Object.freeze({
      object: object.kind,
      address: presenceAddress(address, object.kind),
      fixed: object.fixed,
      ...(object.kind === 'challengeSwitch' && switchKind !== undefined ? { switchKind } : {}),
    });
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
  const slots = product.slots.map((slot): WorkspaceAnchorSlot => {
    const choices: WorkspaceAnchorSlotChoice[] = [];
    const choose = (
      commands: readonly ProjectCommand[],
      object: RoomAnchorObjectKind | null,
      kind?: ChallengeSwitchKind,
    ) => {
      const key = `${slot.index}:${object ?? 'none'}${kind === undefined ? '' : `:${kind}`}`;
      bound.push({ key, commands });
      choices.push(
        Object.freeze({ key, object, ...(kind === undefined ? {} : { switchKind: kind }) }),
      );
    };
    // The first choice is the slot's current state; a switch choice names its type.
    for (const choice of slot.choices)
      if (choice.commands.length > 0) choose(choice.commands, choice.kind, choice.switchKind);
    const offered = new Set(
      choices.map((choice) => `${choice.object ?? 'none'}:${choice.switchKind ?? ''}`),
    );
    const unavailable = slot.fixed
      ? []
      : product.objects.flatMap((object) => {
          if (object.kind === 'challengeSwitch' && object.refusals !== undefined) {
            if (object.present && slot.occupant !== 'challengeSwitch') return [];
            return switchKinds.flatMap((kind) =>
              kind.lock === undefined ||
              kind.switchKind === switchKind ||
              offered.has(`challengeSwitch:${kind.switchKind}`)
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
          if (object.present || object.fixed || offered.has(`${object.kind}:`)) return [];
          const sentences = ownRefusalSentences(object);
          const lock: WorkspaceAnchorObjectLock | undefined =
            object.refusals === undefined
              ? { reason: 'unreached' }
              : sentences.length === 0
                ? undefined
                : { reason: 'refused', sentences: Object.freeze(sentences) };
          return lock === undefined ? [] : [Object.freeze({ object: object.kind, lock })];
        });
    return Object.freeze({
      index: slot.index,
      ...(slot.occupant === undefined ? {} : { occupant: occupant(objectOf(slot.occupant)) }),
      choices: Object.freeze(choices),
      unavailable: Object.freeze(unavailable),
    });
  });
  const unanchored = product.unanchored.map((kind) => {
    const object = objectOf(kind);
    if (object.remove === undefined) return occupant(object);
    const removeKey = `unanchored:${kind}`;
    bound.push({ key: removeKey, commands: Object.freeze([object.remove]) });
    return Object.freeze({ ...occupant(object), removeKey });
  });
  return Object.freeze({
    objectSlots: Object.freeze({
      interactionKey,
      slots: Object.freeze(slots),
      unanchored: Object.freeze(unanchored),
    }),
    requirement: Object.freeze({
      kind: 'roomObjectSlots' as const,
      owner: address,
      interactionKey,
      choices: Object.freeze(bound.map((choice) => Object.freeze(choice))),
    }),
  });
}
