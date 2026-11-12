import {
  createRoomActionAddress,
  createBiomeAddress,
  rerollSurfaceKey,
  roomActionKey,
  semanticAddressKey,
  type OccurrenceAddress,
  type ProjectCommand,
  type RoomActionReference,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { LiveRoom, LiveVerb, RoomObjectInteractions } from '@run-planner/engine/simulation';

import { challengeSwitchKindLabel } from '@planner/projections/challengeSwitchCopy';
import type {
  WorkspaceLiveChoice,
  WorkspaceLiveFace,
  WorkspaceLiveItem,
  WorkspaceLiveObjectKind,
  WorkspaceLiveVerb,
  WorkspaceLiveVerbAction,
  WorkspaceRoomActionRow,
  WorkspaceRoomLive,
} from '../contracts/timeline';
import { featureRollCatalog } from './feature-roll-assembly';
import type { OccurrenceActionLabelParts } from './occurrence-action-label';

type EngineItem = LiveRoom['gaps'][number]['items'][number];

/** An object's name, said by its chip. */
const objectNames: Readonly<Record<WorkspaceLiveObjectKind, string>> = {
  worldShop: 'World Shop',
  contractPedestal: 'Pedestal',
  hermesShrine: 'Hermes Shrine',
  stygianWell: 'Stygian Well',
  purgingPool: 'Pool of Purging',
  fountain: 'Fountain',
  keepsakeRack: 'Keepsake Rack',
  eris: 'Eris',
  encounterContact: 'Talk',
  gorgon: 'Gorgon',
  fieldsCage: 'Cage',
  rewardWheel: 'Wheel',
  challengeSwitch: 'Challenge Switch',
  lockedDoors: 'Locked doors',
  doorRerolls: 'Doors',
};

const verbWords: Readonly<Record<LiveVerb['verb'], string>> = {
  pickUp: 'Pick up',
  goldify: 'Goldify',
  transform: 'Transform',
  buy: 'Buy',
  rush: 'Rush',
  sell: 'Sell',
  reroll: 'Reroll',
  choose: 'Choose',
  talkTo: 'Talk to',
  unlock: 'Unlock',
  use: 'Use',
  press: 'Press',
};

type TravelDealCommand = Extract<
  ProjectCommand,
  { readonly kind: 'PurchaseShopTravelDealRefill' | 'PurchaseHermesShrineOffer' }
>;

/**
 * What a blank Travel Deal item can stock at the gap, each a purchase with that value: a World
 * Shop refill's offered values, or a Shrine refill's candidate rewards.
 */
function travelDealChoices(
  catalog: Catalog,
  occurrence: RoomOccurrence,
  interactions: RoomObjectInteractions | undefined,
  reference: RoomActionReference,
  index: number,
): readonly WorkspaceLiveChoice[] {
  const rewardLabel = (rewardType: string): string =>
    catalog.rewards.rewardTypes.byKey[rewardType]?.label ?? rewardType;
  const choice = (key: string, label: string, rewardType: string, command: TravelDealCommand) =>
    Object.freeze({
      key,
      label,
      icon: Object.freeze({ rewardType }),
      intent: Object.freeze({ command: Object.freeze({ ...command, index }) }),
    });
  if (reference.kind === 'purchaseHermesShrineOffer') {
    const refill = interactions?.hermesShrine?.travelDealRefill;
    if (refill === undefined) return [];
    return refill.candidateRewardTypes.map((rewardType) =>
      choice(rewardType, rewardLabel(rewardType), rewardType, { ...refill.buy, rewardType }),
    );
  }
  const refill = interactions?.worldShop?.travelDealRefill;
  if (refill === undefined) return [];
  const profileKey =
    occurrence.state.kind === 'shop' ? occurrence.state.shop?.profileKey : undefined;
  const profile = profileKey === undefined ? undefined : catalog.rewards.shops.byKey[profileKey];
  const optionLabel = (optionKey: string): string =>
    profile?.groups.values.find((group) => group.options.byKey[optionKey] !== undefined)?.options
      .byKey[optionKey]?.label ?? optionKey;
  return refill.values.map((value) => {
    const source =
      value.offer.payload?.kind === 'BoonSource' ? value.offer.payload.source : undefined;
    const name = optionLabel(value.optionKey);
    return choice(
      JSON.stringify(value),
      source === undefined ? name : `${name} · ${rewardLabel(source)}`,
      source ?? value.offer.rewardType,
      { ...refill.command, value },
    );
  });
}

/**
 * Adapts the engine's live room at its frontier to the Timeline's live row: each thing live
 * there with the verbs it offers, named and pictured as the rows they act on. What is live,
 * its verbs and their commands are the engine's.
 */
export function projectRoomLive(input: {
  readonly catalog: Catalog;
  readonly owner: OccurrenceAddress;
  readonly occurrence: RoomOccurrence;
  readonly live: LiveRoom;
  readonly rows: readonly WorkspaceRoomActionRow[];
  /** Names a reference that is not a Timeline row yet, such as an unbought item. */
  readonly labelParts: (reference: RoomActionReference) => OccurrenceActionLabelParts;
  readonly interactions: RoomObjectInteractions | undefined;
}): WorkspaceRoomLive | undefined {
  const { catalog, live, owner } = input;
  const gap = live.gaps.find((candidate) => candidate.index === live.frontier);
  if (gap === undefined) return undefined;
  const rowByKey = new Map(input.rows.map((row) => [row.key, row]));
  const biome = createBiomeAddress(owner.routeKey, owner.biomeKey);
  const named = (reference: RoomActionReference) => {
    const row = rowByKey.get(roomActionKey(reference));
    const parts: Omit<OccurrenceActionLabelParts, 'label'> =
      row === undefined
        ? input.labelParts(reference)
        : // A row named only in full drops its verb: the thing is named, its verbs listed apart.
          (row.labelParts ?? Object.freeze({ name: row.label.replace(/^Collect /, '') }));
    const face: WorkspaceLiveFace = Object.freeze({
      reference,
      ...(row?.sourceFamily === undefined ? {} : { sourceFamily: row.sourceFamily }),
      ...(row?.challengeSwitchKind === undefined
        ? {}
        : { challengeSwitchKind: row.challengeSwitchKind }),
      ...(parts.reward === undefined ? {} : { reward: parts.reward }),
      ...(parts.npcKey === undefined ? {} : { npcKey: parts.npcKey }),
      ...(parts.traitKey === undefined ? {} : { traitKey: parts.traitKey }),
      ...(parts.place === undefined ? {} : { place: parts.place }),
    });
    const name = parts.name ?? row?.label ?? reference.kind;
    // A Travel Deal item reads apart from the stocked item it restocks.
    return {
      row,
      face,
      name: parts.travelDeal === true || row?.travelDeal === true ? `${name} · Travel Deal` : name,
      slot: parts.slot ?? row?.slot,
    };
  };
  const poolLabels = featureRollCatalog(catalog, 'purgingPool');
  const verbAction = (verb: LiveVerb): WorkspaceLiveVerbAction | undefined => {
    const choice = verb.choice;
    if (choice?.timing === 'before') {
      switch (choice.picker) {
        case 'travelDealItem': {
          if (verb.reference === undefined) return undefined;
          const choices = travelDealChoices(
            catalog,
            input.occurrence,
            input.interactions,
            verb.reference,
            gap.index,
          );
          return choices.length === 0
            ? undefined
            : Object.freeze({ kind: 'choose' as const, choices: Object.freeze(choices) });
        }
        case 'purgingPoolSale':
          return Object.freeze({
            kind: 'choose' as const,
            choices: Object.freeze(
              choice.traitKeys.map((traitKey) =>
                Object.freeze({
                  key: traitKey,
                  label: poolLabels.itemLabel(traitKey),
                  icon: Object.freeze({ traitKey }),
                  intent: Object.freeze({
                    command: Object.freeze({
                      kind: 'SellPurgingPoolRollSlot' as const,
                      occurrence: owner,
                      rollKey: choice.rollKey,
                      slotKey: choice.slotKey,
                      traitKey,
                      index: gap.index,
                    }),
                  }),
                }),
              ),
            ),
          });
        case 'rerollPress':
          return Object.freeze({
            kind: 'rerollPress' as const,
            interactionKey: `rerolls:${rerollSurfaceKey(choice.surface)}`,
          });
      }
    }
    if (verb.commands === undefined || verb.commands.length === 0) return undefined;
    return Object.freeze({
      kind: 'apply' as const,
      intent: Object.freeze({ commands: verb.commands }),
      ...(choice?.timing === 'after' && verb.reference !== undefined
        ? { opens: roomActionKey(verb.reference) }
        : {}),
    });
  };
  const verbsOf = (item: EngineItem, pickup: boolean): WorkspaceLiveVerb[] => {
    const verbs = item.verbs.flatMap((verb, index) => {
      if (verb.standing === true) return [];
      const action = verbAction(verb);
      if (action === undefined) return [];
      const word = verbWords[verb.verb];
      const subject = verb.reference === undefined ? undefined : named(verb.reference);
      // A pickup's menu names its verbs alone; an object's name what each acts on.
      const label =
        pickup || subject === undefined || verb.verb === 'reroll'
          ? word
          : verb.verb === 'sell' && action.kind === 'choose'
            ? word
            : // A row named in full already leads with its verb.
              subject.name.startsWith(`${word} `)
              ? subject.name
              : `${word} ${subject.name}`;
      return [
        {
          ...(subject?.face ?? {}),
          key: `${verb.verb}:${verb.reference === undefined ? index : roomActionKey(verb.reference)}`,
          label,
          action,
          slot: subject?.slot,
        },
      ];
    });
    // Like items read apart by their slot.
    return (
      verbs
        // A row the engine offers both as its object's purchase and as its insertion shows once.
        .filter((verb, index) => verbs.findIndex((other) => other.key === verb.key) === index)
        .map(({ slot, ...verb }) =>
          Object.freeze(
            slot !== undefined && verbs.filter((other) => other.label === verb.label).length > 1
              ? { ...verb, label: `${verb.label} · slot ${slot}` }
              : verb,
          ),
        )
    );
  };
  const items = gap.items.flatMap((item): WorkspaceLiveItem[] => {
    if (item.kind === 'pickup') {
      const { row, face, name } = named(item.reference);
      const verbs = verbsOf(item, true);
      const locked = item.lockedUntil !== undefined;
      // A required pickup stays shown without a verb here: its findings mark it.
      if (verbs.length === 0 && !locked && item.participation !== 'required') return [];
      return [
        Object.freeze({
          ...face,
          key: semanticAddressKey(item.owner),
          label: face.place === undefined ? name : `${name} · ${face.place.label}`,
          group: item.participation,
          ...(locked ? { locked: true as const } : {}),
          ...(row === undefined || row.rank !== null ? {} : { anchor: row.address }),
          findingOwners: Object.freeze([
            row?.address ??
              createRoomActionAddress(biome, owner.occurrenceId, roomActionKey(item.reference)),
          ]),
          verbs: Object.freeze(verbs),
        }),
      ];
    }
    const verbs = verbsOf(item, false);
    if (verbs.length === 0) return [];
    const shown = item.verbs.filter((verb) => verb.standing !== true);
    const first = shown.find((verb) => verb.reference !== undefined)?.reference;
    const face = first === undefined ? undefined : named(first);
    const label =
      item.object === 'encounterContact' || item.object === 'fieldsCage'
        ? (face?.name ?? objectNames[item.object])
        : item.object === 'challengeSwitch' && face?.row?.challengeSwitchKind !== undefined
          ? challengeSwitchKindLabel(face.row.challengeSwitchKind)
          : objectNames[item.object];
    // An object shows its own icon; a contact its portrait, a cage its slot.
    const portrait =
      face === undefined
        ? {}
        : {
            reference: first!,
            ...(face.face.npcKey === undefined ? {} : { npcKey: face.face.npcKey }),
            ...(face.face.challengeSwitchKind === undefined
              ? {}
              : { challengeSwitchKind: face.face.challengeSwitchKind }),
            ...(item.object === 'fieldsCage' && face.face.place !== undefined
              ? { place: face.face.place }
              : {}),
          };
    // A required row off the Timeline first, then any other, takes its findings' navigation.
    const unplaced = shown.flatMap((verb) => {
      const row =
        verb.reference === undefined ? undefined : rowByKey.get(roomActionKey(verb.reference));
      return row === undefined || row.rank !== null ? [] : [row];
    });
    const anchor = unplaced.find((row) => row.participation === 'required') ?? unplaced[0];
    return [
      Object.freeze({
        ...portrait,
        key: `${item.object}:${semanticAddressKey(item.owner)}`,
        label,
        group: shown.some((verb) => verb.participation === 'required')
          ? ('required' as const)
          : ('object' as const),
        object: item.object,
        ...(anchor === undefined ? {} : { anchor: anchor.address }),
        findingOwners: Object.freeze(
          shown.flatMap((verb) =>
            verb.reference === undefined
              ? []
              : [
                  rowByKey.get(roomActionKey(verb.reference))?.address ??
                    createRoomActionAddress(
                      biome,
                      owner.occurrenceId,
                      roomActionKey(verb.reference),
                    ),
                ],
          ),
        ),
        verbs: Object.freeze(verbs),
      }),
    ];
  });
  return Object.freeze({ frontier: live.frontier, items: Object.freeze(items) });
}
