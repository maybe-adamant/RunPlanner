import {
  semanticAddressKey,
  type OccurrenceAddress,
  type RoomActionReference,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { RoomObjectInteractions } from '@run-planner/engine/simulation';

import type {
  WorkspaceRoomFeature,
  WorkspaceRoomObject,
  WorkspaceRoomObjectEntry,
  WorkspaceRoomObjectOption,
} from '../contracts/features';
import type { WorkspaceEncounterPhase, WorkspaceRoomLocal } from '../contracts/locals';
import type {
  WorkspaceOccurrenceInteractionRequirement,
  WorkspaceRoomObjectActionRequirement,
} from '../interactions/interaction-requirements';
import { occurrenceActionLabel } from './occurrence-action-label';

type EntryRequirement = Extract<
  WorkspaceOccurrenceInteractionRequirement,
  { readonly kind: 'roomObjectActions' }
>;

interface EntryParts {
  readonly options: WorkspaceRoomObjectOption[];
  readonly bound: WorkspaceRoomObjectActionRequirement[];
}

/**
 * Each present World Shop, Hermes Shrine and Champion item's entry: what can
 * be done where the room's actions end, each pick appending one action there.
 * Options read as the row they append.
 */
export function assembleRoomObjectEntries(input: {
  readonly catalog: Catalog;
  readonly owner: OccurrenceAddress;
  readonly occurrence: RoomOccurrence;
  readonly roomLocal: WorkspaceRoomLocal;
  readonly features: readonly WorkspaceRoomFeature[];
  readonly encounterPhases: readonly WorkspaceEncounterPhase[];
  readonly interactions: RoomObjectInteractions | undefined;
}): {
  readonly entries: readonly WorkspaceRoomObjectEntry[];
  readonly requirements: readonly EntryRequirement[];
} {
  const { catalog, occurrence, roomLocal, encounterPhases } = input;
  const pedestal = input.features.find(
    (
      feature,
    ): feature is Extract<WorkspaceRoomFeature, { readonly kind: 'infernalContractPedestal' }> =>
      feature.kind === 'infernalContractPedestal',
  );
  const label = (reference: RoomActionReference): string =>
    occurrenceActionLabel(
      catalog,
      reference,
      roomLocal,
      encounterPhases,
      reference.kind === 'interactInfernalContractPedestal' ? pedestal?.rewardControl : undefined,
      occurrence,
    );
  const rewardLabel = (rewardType: string): string =>
    catalog.rewards.rewardTypes.byKey[rewardType]?.label ?? rewardType;
  const entries: WorkspaceRoomObjectEntry[] = [];
  const requirements: EntryRequirement[] = [];
  const add = (
    object: WorkspaceRoomObject,
    parts: EntryParts | undefined,
    lockWhenEmpty: WorkspaceRoomObjectEntry['locked'],
  ): void => {
    const interactionKey = `roomObject:${object}:${semanticAddressKey(input.owner)}`;
    const options = parts?.options ?? [];
    const locked =
      parts === undefined
        ? ('unreached' as const)
        : options.every((option) => option.locked !== undefined)
          ? (options[0]?.locked ?? lockWhenEmpty)
          : undefined;
    entries.push(
      Object.freeze({
        interactionKey,
        object,
        options: Object.freeze(options),
        ...(locked === undefined ? {} : { locked }),
      }),
    );
    requirements.push(
      Object.freeze({
        kind: 'roomObjectActions' as const,
        owner: input.owner,
        interactionKey,
        options: Object.freeze(parts?.bound ?? []),
      }),
    );
  };

  if (roomLocal.kind === 'shop' && roomLocal.materialized) {
    const shop = input.interactions?.worldShop;
    const parts: EntryParts | undefined =
      shop === undefined ? undefined : { options: [], bound: [] };
    for (const offer of shop?.offers ?? []) {
      const key = `buy:${offer.offerKey}`;
      parts!.options.push(
        Object.freeze({
          key,
          label: label({ kind: 'interactShopOffer', offerKey: offer.offerKey }),
        }),
      );
      parts!.bound.push(Object.freeze({ key, command: offer.command }));
    }
    const refill = shop?.travelDealRefill;
    if (refill !== undefined) {
      const key = 'buy:travelDealRefill';
      // A blank Travel Deal item is chosen on its line under the purchase that triggers it.
      parts!.options.push(
        Object.freeze({
          key,
          label: 'Buy Travel Deal item',
          ...(refill.rewardType === null ? { locked: 'travelDealItemUnchosen' as const } : {}),
        }),
      );
      if (refill.rewardType !== null)
        parts!.bound.push(Object.freeze({ key, command: refill.command }));
    }
    add('worldShop', parts, 'allBought');
  }

  const shrineFeature = input.features.find(
    (feature): feature is Extract<WorkspaceRoomFeature, { readonly kind: 'hermesShrine' }> =>
      feature.kind === 'hermesShrine',
  );
  if (shrineFeature !== undefined && shrineFeature.presence.kind !== 'optionalAbsent') {
    const shrine = input.interactions?.hermesShrine;
    const parts: EntryParts | undefined =
      shrine === undefined ? undefined : { options: [], bound: [] };
    const refill = shrine?.travelDealRefill;
    const offers = [
      ...(shrine?.offers ?? []).map((offer) => ({ offer, candidates: undefined })),
      ...(refill === undefined ? [] : [{ offer: refill, candidates: refill.candidateRewardTypes }]),
    ];
    for (const { offer, candidates } of offers) {
      const blank = offer.rewardType === null;
      const choices =
        blank && candidates !== undefined
          ? Object.freeze(
              candidates.map((rewardType) =>
                Object.freeze({ key: rewardType, label: rewardLabel(rewardType) }),
              ),
            )
          : undefined;
      for (const rushed of [false, true]) {
        const key = `${rushed ? 'rush' : 'buy'}:${offer.generationKey}`;
        const rowLabel = label({
          kind: 'purchaseHermesShrineOffer',
          generationKey: offer.generationKey,
          rushed,
        });
        parts!.options.push(
          Object.freeze({
            key,
            label: blank ? `${rowLabel}…` : rowLabel,
            ...(blank ? { needsChoice: true as const } : {}),
          }),
        );
        parts!.bound.push(
          Object.freeze({
            key,
            command: rushed ? offer.rush : offer.buy,
            ...(choices === undefined ? {} : { rewardTypeChoices: choices }),
          }),
        );
      }
    }
    add('hermesShrine', parts, 'allBought');
  }

  if (pedestal !== undefined) {
    const champion = input.interactions?.championItem;
    const collect = champion?.collect;
    const parts: EntryParts | undefined =
      champion === undefined ? undefined : { options: [], bound: [] };
    if (collect !== undefined) {
      const key = 'collect';
      parts!.options.push(
        Object.freeze({
          key,
          label: label({ kind: 'interactInfernalContractPedestal' }),
          ...('locked' in collect ? { locked: collect.locked } : {}),
        }),
      );
      if ('command' in collect) parts!.bound.push(Object.freeze({ key, command: collect.command }));
    }
    add('championItem', parts, 'collected');
  }

  return Object.freeze({
    entries: Object.freeze(entries),
    requirements: Object.freeze(requirements),
  });
}
