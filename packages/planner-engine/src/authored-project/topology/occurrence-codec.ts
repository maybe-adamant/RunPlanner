import type { BiomeLayout, Catalog } from '../../catalog-schema';
import type {
  AuthoredRewardState,
  HermesShrineState,
  RoomActionState,
  RoomOccurrence,
} from '../model';
import { activeRoomActionReferences, roomActionKey } from '../room-actions';
import { decodeRoomActionState } from './room-action-codec';
import { assertStygianWellPurchaseActionClosure, decodeStygianWellState } from './well-codec';
import { decodeNullableRewardState } from '../room-state/reward-acquisition-codec';
import { decodeRoomState } from '../room-state/codec';
import { decodeRoomEncounterState } from '../room-state/encounters';
import { createBiomeAddress, semanticAddressKey } from '../addresses';
import { authoredAcquisitionSources } from '../acquisition-sources';
import { resolveAcquisitionRole } from '../../reward-kernel/history';
import {
  createSeaStarDuplicateRewardState,
  SEA_STAR_DUPLICATE_ENTRY_KEY,
  parseSeaStarDuplicateSiteKey,
} from '../sea-star';
import {
  echoLastRewardPickupEntryKeys,
  parseEchoLastRewardPickupEntryKey,
  parseTraitGeneratedPickupSiteKey,
  parseNemesisGeneratedPickupSiteKey,
  nemesisGeneratedPickupSiteKey,
  selectedPickupProducers,
} from '../pickup-producers';
import { parseArtificerReplacementEntryKey } from '../artificer';
import { parseHermesShrineDeliveryEntryKey } from '../hermes-shrine-delivery';
import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  INFERNAL_CONTRACT_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
} from '../shop';
import { expectExactKeys, expectRecord, failProjectDocument } from '../validation';
import type { DecodedTopologyStructure } from './structure-codec';
import { decodeAcquisitionSites } from './acquisition-site-codec';
import { decodeFountainRarityResult } from '../fountain-rarity-codec';

function decodeOrdinaryHermesShrineState(
  value: unknown,
  catalog: Catalog,
  path: string,
): HermesShrineState {
  const raw = expectRecord(value, path);
  const hasPurchases = Object.hasOwn(raw, 'purchaseBySlot');
  const hasRefill = Object.hasOwn(raw, 'travelDealRefill');
  expectExactKeys(
    raw,
    [
      'offerBySlot',
      ...(hasPurchases ? ['purchaseBySlot'] : []),
      ...(hasRefill ? ['travelDealRefill'] : []),
    ],
    path,
  );
  const offers = expectRecord(raw.offerBySlot, `${path}.offerBySlot`);
  const slots = ['first', 'secondLeft', 'secondRight'] as const;
  expectExactKeys(offers, slots, `${path}.offerBySlot`);
  const offerBySlot = Object.freeze(
    Object.fromEntries(
      slots.map((slot) => [
        slot,
        decodeNullableRewardState(offers[slot], catalog, `${path}.offerBySlot.${slot}`, {
          kind: 'producerLifecycle',
          key: 'HermesShrineDelivery',
        }),
      ]),
    ) as Record<import('../model').HermesShrineSlotKey, AuthoredRewardState | null>,
  );
  const purchases = hasPurchases ? expectRecord(raw.purchaseBySlot, `${path}.purchaseBySlot`) : {};
  const purchaseBySlot = Object.freeze(
    Object.fromEntries(
      Object.entries(purchases).map(([slot, value]) => {
        if (!slots.includes(slot as (typeof slots)[number]))
          failProjectDocument(`${path}.purchaseBySlot.${slot}`, 'is not a Shrine slot');
        const purchase = expectRecord(value, `${path}.purchaseBySlot.${slot}`);
        expectExactKeys(purchase, ['delay', 'rushed'], `${path}.purchaseBySlot.${slot}`);
        if (
          ![2, 3, 4, 5, 6, 7, 8].includes(purchase.delay as number) ||
          typeof purchase.rushed !== 'boolean'
        )
          failProjectDocument(
            `${path}.purchaseBySlot.${slot}`,
            'must have delay 2 through 8 and boolean rushed',
          );
        if (offerBySlot[slot as (typeof slots)[number]] === null)
          failProjectDocument(`${path}.purchaseBySlot.${slot}`, 'requires a resolved source offer');
        return [
          slot,
          Object.freeze({
            delay: purchase.delay as 2 | 3 | 4 | 5 | 6 | 7 | 8,
            rushed: purchase.rushed,
          }),
        ];
      }),
    ) as import('../model').HermesShrineState['purchaseBySlot'],
  );
  const travelDealRefill = !hasRefill
    ? undefined
    : (() => {
        const refill = expectRecord(raw.travelDealRefill, `${path}.travelDealRefill`);
        expectExactKeys(
          refill,
          ['offer', ...(refill.purchase === undefined ? [] : ['purchase'])],
          `${path}.travelDealRefill`,
        );
        const purchase =
          refill.purchase === undefined
            ? undefined
            : (() => {
                const value = expectRecord(refill.purchase, `${path}.travelDealRefill.purchase`);
                expectExactKeys(value, ['delay', 'rushed'], `${path}.travelDealRefill.purchase`);
                if (
                  ![2, 3, 4, 5, 6, 7, 8].includes(value.delay as number) ||
                  value.rushed !== false
                )
                  failProjectDocument(
                    `${path}.travelDealRefill.purchase`,
                    'must have delay 2 through 8 and rushed false',
                  );
                return Object.freeze({
                  delay: value.delay as 2 | 3 | 4 | 5 | 6 | 7 | 8,
                  rushed: false,
                });
              })();
        const offer = decodeNullableRewardState(
          refill.offer,
          catalog,
          `${path}.travelDealRefill.offer`,
          { kind: 'producerLifecycle', key: 'HermesShrineDelivery' },
        );
        if (purchase !== undefined && offer === null)
          failProjectDocument(
            `${path}.travelDealRefill.purchase`,
            'requires a resolved source offer',
          );
        return Object.freeze({
          offer,
          ...(purchase === undefined ? {} : { purchase }),
        });
      })();
  return Object.freeze({
    offerBySlot,
    ...(hasPurchases ? { purchaseBySlot } : {}),
    ...(travelDealRefill === undefined ? {} : { travelDealRefill }),
  }) as HermesShrineState;
}

function assertHermesShrinePurchaseActionClosure(
  shrine: HermesShrineState | undefined,
  roomActions: RoomActionState,
  path: string,
): void {
  const purchases = new Set<import('../model').HermesShrineGenerationKey>([
    ...Object.keys(shrine?.purchaseBySlot ?? {}).map(
      (slotKey) => `initial:${slotKey}` as import('../model').HermesShrineGenerationKey,
    ),
    ...(shrine?.travelDealRefill?.purchase === undefined ? [] : ['travelDealRefill' as const]),
  ]);
  const actions = new Set(
    roomActions.order.flatMap((reference) =>
      reference.kind === 'purchaseHermesShrineOffer' ? [reference.generationKey] : [],
    ),
  );
  if (purchases.size !== actions.size || [...purchases].some((key) => !actions.has(key)))
    failProjectDocument(
      path,
      'Shrine purchase details must have exactly one matching purchase action',
    );
}

function sameStructuredValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null)
    return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => sameStructuredValue(value, right[index]));
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && sameStructuredValue(leftRecord[key], rightRecord[key]),
    )
  );
}

export function decodeRoomOccurrence(input: {
  readonly occurrence: DecodedTopologyStructure['occurrences'][number];
  readonly catalog: Catalog;
  readonly layout: BiomeLayout;
  readonly routeKey: string;
}): RoomOccurrence {
  const { raw: rawOccurrence, owner, additionalExits } = input.occurrence;
  const { catalog, layout, routeKey } = input;
  const room = catalog.rooms.byKey[rawOccurrence.gameName];
  if (room === undefined || room.mode.kind !== 'authored')
    failProjectDocument(`${rawOccurrence.path}.gameName`, `unknown room ${rawOccurrence.gameName}`);
  if (owner.gameName !== rawOccurrence.gameName)
    failProjectDocument(`${rawOccurrence.path}.gameName`, `owner requires ${owner.gameName}`);
  const state = decodeRoomState(
    rawOccurrence.state,
    catalog,
    room,
    owner,
    `${rawOccurrence.path}.state`,
  );
  const encounters = decodeRoomEncounterState(
    rawOccurrence.encounters,
    catalog,
    room,
    `${rawOccurrence.path}.encounters`,
  );
  const hermesShrine = rawOccurrence.hasHermesShrine
    ? decodeOrdinaryHermesShrineState(
        rawOccurrence.hermesShrine,
        catalog,
        `${rawOccurrence.path}.hermesShrine`,
      )
    : undefined;
  const stygianWell = rawOccurrence.hasStygianWell
    ? decodeStygianWellState(
        rawOccurrence.stygianWell,
        `${rawOccurrence.path}.stygianWell`,
        catalog,
      )
    : undefined;
  const fountainRarityResult = rawOccurrence.hasFountainRarityResult
    ? decodeFountainRarityResult(
        rawOccurrence.fountainRarityResult,
        catalog,
        `${rawOccurrence.path}.fountainRarityResult`,
      )
    : undefined;
  assertStygianWellPurchaseActionClosure(
    stygianWell,
    decodeRoomActionState(rawOccurrence.roomActions, `${rawOccurrence.path}.roomActions`),
    `${rawOccurrence.path}.roomActions.order`,
  );
  if (
    hermesShrine !== undefined &&
    (room.surfaceShop === undefined ||
      room.surfaceShop.forced ||
      room.surfaceShop.spawnChance <= 0 ||
      (room.challengeSwitchAnchorCount ?? 0) <= 0)
  )
    failProjectDocument(
      `${rawOccurrence.path}.hermesShrine`,
      'requires an eligible ordinary Surface Shop host',
    );
  if (
    stygianWell !== undefined &&
    (room.roomShop === undefined ||
      room.roomShop.forced ||
      room.roomShop.spawnChance <= 0 ||
      (room.challengeSwitchAnchorCount ?? 0) <= 0)
  )
    failProjectDocument(
      `${rawOccurrence.path}.stygianWell`,
      'requires an eligible ordinary RoomShop Well host',
    );
  const occurrenceWithoutAcquisitionSites: RoomOccurrence = Object.freeze({
    occurrenceId: rawOccurrence.occurrenceId,
    gameName: room.gameName,
    ...(owner.anomalyReplacement === undefined
      ? {}
      : { anomalyReplacement: owner.anomalyReplacement }),
    state,
    encounters,
    ...(hermesShrine === undefined ? {} : { hermesShrine }),
    ...(stygianWell === undefined ? {} : { stygianWell }),
    ...(fountainRarityResult === undefined ? {} : { fountainRarityResult }),
    roomActions: Object.freeze({ order: Object.freeze([]) }),
    additionalExits: Object.freeze([]),
  });
  const echoEntryKeys = new Set(echoLastRewardPickupEntryKeys(catalog, encounters));
  const biomeAddress = createBiomeAddress(routeKey, layout.biomeKey);
  // Decode structural sites and then their declaration-owned generated children
  // to a bounded fixed point. A generated source may itself contain a selected
  // producer (for example a Narcissus BlindBox source), so one preliminary
  // pass is not sufficient to establish nested ownership on reload.
  let occurrenceWithPreliminarySites = occurrenceWithoutAcquisitionSites;
  if (rawOccurrence.hasAcquisitionSites) {
    const rawSites = expectRecord(
      rawOccurrence.acquisitionSites,
      `${rawOccurrence.path}.acquisitionSites`,
    );
    let previousIncludedKeys: readonly string[] = Object.freeze([]);
    for (let round = 0; round <= Object.keys(rawSites).length; round += 1) {
      const preliminaryPickupProducers = selectedPickupProducers(
        catalog,
        biomeAddress,
        occurrenceWithPreliminarySites,
      );
      const ownedGeneratedSiteKeys = new Set(
        preliminaryPickupProducers
          .filter(
            (producer) =>
              producer.siteKey.startsWith('traitGenerated:') ||
              producer.siteKey.startsWith('nemesisGenerated:'),
          )
          .map((producer) => producer.siteKey),
      );
      const includedEntries = Object.entries(rawSites).filter(
        ([siteKey]) =>
          (!siteKey.startsWith('traitGenerated:') && !siteKey.startsWith('nemesisGenerated:')) ||
          ownedGeneratedSiteKeys.has(siteKey),
      );
      const includedKeys = includedEntries.map(([siteKey]) => siteKey).sort();
      if (
        includedKeys.length === previousIncludedKeys.length &&
        includedKeys.every((siteKey, index) => siteKey === previousIncludedKeys[index])
      )
        break;
      previousIncludedKeys = Object.freeze(includedKeys);
      const preliminaryAcquisitionSites =
        includedEntries.length === 0
          ? undefined
          : decodeAcquisitionSites(
              Object.fromEntries(includedEntries),
              rawOccurrence,
              catalog,
              preliminaryPickupProducers,
              echoEntryKeys,
              state.kind === 'shop' ? state.shop?.profileKey : undefined,
            );
      occurrenceWithPreliminarySites = Object.freeze({
        ...occurrenceWithoutAcquisitionSites,
        ...(preliminaryAcquisitionSites === undefined
          ? {}
          : { acquisitionSites: preliminaryAcquisitionSites }),
      });
    }
  }
  const pickupProducers = selectedPickupProducers(
    catalog,
    biomeAddress,
    occurrenceWithPreliminarySites,
  );
  const acquisitionSites = rawOccurrence.hasAcquisitionSites
    ? decodeAcquisitionSites(
        rawOccurrence.acquisitionSites,
        rawOccurrence,
        catalog,
        pickupProducers,
        echoEntryKeys,
        state.kind === 'shop' ? state.shop?.profileKey : undefined,
      )
    : undefined;
  const producerSiteKeys = new Set(
    pickupProducers
      .filter(
        (producer) =>
          producer.siteKey.startsWith('traitGenerated:') ||
          producer.siteKey.startsWith('nemesisGenerated:'),
      )
      .map((producer) => producer.siteKey),
  );
  const nemesisPolicy = catalog.encounterDefinitions.byKey.NemesisRandomEvent?.nemesisRandomEvent;
  for (const [phaseKey, outcome] of Object.entries(encounters.nemesisRandomEventByPhase ?? {})) {
    const sitePath = `${rawOccurrence.path}.acquisitionSites.${nemesisGeneratedPickupSiteKey(phaseKey)}.pickupEntries.result`;
    const result =
      acquisitionSites?.[nemesisGeneratedPickupSiteKey(phaseKey)]?.pickupEntries?.result;
    if (outcome === null) {
      if (result !== undefined && result !== null)
        failProjectDocument(sitePath, 'an unresolved Nemesis event must not own a result reward');
      continue;
    }
    if (nemesisPolicy === undefined)
      failProjectDocument(sitePath, 'catalog has no Nemesis event policy');
    if (result === undefined || result === null)
      failProjectDocument(
        sitePath,
        'a concrete Nemesis outcome must own exactly one concrete result reward',
      );
    const rewardType = result.offer.rewardType;
    const valid =
      outcome.kind === 'freeItem'
        ? (nemesisPolicy.freeItem.resultRewardTypes as readonly string[]).includes(rewardType)
        : outcome.kind === 'goldTrade'
          ? nemesisPolicy.goldTrade.variants.some((variant) => variant.rewardType === rewardType)
          : outcome.kind === 'damageTrade'
            ? nemesisPolicy.damageTrade.variants.some(
                (variant) => variant.rewardType === rewardType,
              )
            : outcome.kind === 'traitTrade'
              ? rewardType === nemesisPolicy.traitTrade.fixedResultRewardType
              : outcome.result === 'failure'
                ? rewardType === nemesisPolicy.damageContest.failureResultRewardType
                : (
                    nemesisPolicy.damageContest.successResultRewardTypes as readonly string[]
                  ).includes(rewardType);
    if (!valid)
      failProjectDocument(
        sitePath,
        'does not match its declared Nemesis family and result relation',
      );
  }
  for (const [siteKey, site] of Object.entries(acquisitionSites ?? {})) {
    if (
      siteKey === 'hermesShrineDelivery' &&
      Object.keys(site.pickupEntries ?? {}).some(
        (entryKey) =>
          parseHermesShrineDeliveryEntryKey(entryKey) === undefined &&
          parseArtificerReplacementEntryKey(entryKey) === undefined,
      )
    )
      failProjectDocument(
        `${rawOccurrence.path}.acquisitionSites.${siteKey}.pickupEntries`,
        'must contain only exact Shrine delivery or Artificer replacement entry keys',
      );
    if (parseTraitGeneratedPickupSiteKey(siteKey) !== undefined && !producerSiteKeys.has(siteKey))
      failProjectDocument(
        `${rawOccurrence.path}.acquisitionSites.${siteKey}`,
        'does not name a selected generated-pickup source',
      );
    if (parseNemesisGeneratedPickupSiteKey(siteKey) !== undefined && !producerSiteKeys.has(siteKey))
      failProjectDocument(
        `${rawOccurrence.path}.acquisitionSites.${siteKey}`,
        'does not name a selected Nemesis event source',
      );
    if (
      parseSeaStarDuplicateSiteKey(siteKey) !== undefined &&
      (Object.keys(site.pickupEntries ?? {}).length !== 1 ||
        site.pickupEntries?.[SEA_STAR_DUPLICATE_ENTRY_KEY] === undefined)
    )
      failProjectDocument(
        `${rawOccurrence.path}.acquisitionSites.${siteKey}.pickupEntries`,
        'must contain exactly the closed Sea Star duplicate entry',
      );
    for (const entryKey of Object.keys(site.pickupEntries ?? {}))
      if (parseEchoLastRewardPickupEntryKey(entryKey) !== undefined && !echoEntryKeys.has(entryKey))
        failProjectDocument(
          `${rawOccurrence.path}.acquisitionSites.${siteKey}.pickupEntries.${entryKey}`,
          'does not name a declaration-owned Echo Last Reward entry',
        );
  }
  const invalidArtificerSite = Object.entries(acquisitionSites ?? {}).some(
    ([siteKey, site]) =>
      siteKey !== 'roomExit' &&
      parseTraitGeneratedPickupSiteKey(siteKey) === undefined &&
      parseNemesisGeneratedPickupSiteKey(siteKey) === undefined &&
      parseSeaStarDuplicateSiteKey(siteKey) === undefined &&
      siteKey !== 'hermesShrineDelivery' &&
      Object.keys(site.pickupEntries ?? {}).some(
        (entryKey) => parseArtificerReplacementEntryKey(entryKey) === undefined,
      ),
  );
  if (invalidArtificerSite) {
    failProjectDocument(
      `${rawOccurrence.path}.acquisitionSites`,
      'source-local sites may contain only Artificer replacement entries',
    );
  }
  if (state.kind === 'shop' && state.shop !== undefined) {
    if (acquisitionSites === undefined || acquisitionSites.roomExit === undefined) {
      failProjectDocument(
        `${rawOccurrence.path}.acquisitionSites`,
        'materialized Shop requires roomExit state',
      );
    }
    for (const [entryKey, entry] of Object.entries(acquisitionSites.roomExit.pickupEntries ?? {})) {
      if (entryKey === INFERNAL_CONTRACT_ENTRY_KEY) {
        const descriptor = room.infernalContractReward;
        if (
          descriptor === undefined ||
          (entry !== null && !descriptor.rewardTypes.includes(entry.offer.rewardType))
        )
          failProjectDocument(
            `${rawOccurrence.path}.acquisitionSites.roomExit.pickupEntries.${entryKey}`,
            'must be a declared Infernal Contract pedestal reward',
          );
        continue;
      }
      if (entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY) continue;
      if (entryKey === ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY) continue;
      if (entryKey.startsWith('echoDoubleShop:'))
        failProjectDocument(
          `${rawOccurrence.path}.acquisitionSites.roomExit.pickupEntries.${entryKey}`,
          'source-keyed Echo Shop duplicates are not supported',
        );
      else
        failProjectDocument(
          `${rawOccurrence.path}.acquisitionSites.roomExit.pickupEntries.${entryKey}`,
          'must be a supported supplemental Shop entry',
        );
    }
    const contractEntry = acquisitionSites.roomExit.pickupEntries?.[INFERNAL_CONTRACT_ENTRY_KEY];
    if ((room.infernalContractReward !== undefined) !== (contractEntry !== undefined))
      failProjectDocument(
        `${rawOccurrence.path}.acquisitionSites.roomExit.pickupEntries`,
        'must contain exactly the declaration-owned Infernal Contract entry',
      );
  } else {
    const expected = pickupProducers
      .filter((producer) => producer.siteKey === 'roomExit')
      .flatMap((producer) => producer.pickups);
    const retainedEchoEntryKeys = Object.keys(
      acquisitionSites?.roomExit?.pickupEntries ?? {},
    ).filter((key) => parseEchoLastRewardPickupEntryKey(key) !== undefined);
    const structurallyOwnedKeys = new Set([
      ...expected.map((pickup) => pickup.key),
      ...echoEntryKeys,
      ...retainedEchoEntryKeys,
    ]);
    if (structurallyOwnedKeys.size === 0 && acquisitionSites?.roomExit !== undefined) {
      failProjectDocument(
        `${rawOccurrence.path}.acquisitionSites`,
        'has no authorable acquisition site',
      );
    }
    if (expected.length > 0 && acquisitionSites?.roomExit?.pickupEntries === undefined)
      failProjectDocument(
        `${rawOccurrence.path}.acquisitionSites.roomExit`,
        'selected pickup producer requires pickupEntries',
      );
    if (structurallyOwnedKeys.size > 0) {
      const entries = acquisitionSites?.roomExit?.pickupEntries ?? {};
      if (
        Object.keys(entries).some((key) => !structurallyOwnedKeys.has(key)) ||
        expected.some((pickup) => {
          const entry = entries[pickup.key];
          return (
            entry === undefined ||
            (pickup.rewardType === undefined
              ? false
              : entry === null
                ? catalog.rewards.rewardTypes.byKey[pickup.rewardType]?.payloadDomain === undefined
                : entry.offer.rewardType !== pickup.rewardType)
          );
        })
      )
        failProjectDocument(
          `${rawOccurrence.path}.acquisitionSites.roomExit.pickupEntries`,
          'does not match selected descriptor pickups',
        );
    }
    for (const producer of pickupProducers.filter(
      (candidate) => candidate.siteKey !== 'roomExit',
    )) {
      const entries = acquisitionSites?.[producer.siteKey]?.pickupEntries;
      if (
        entries === undefined ||
        Object.keys(entries).some(
          (key) => !producer.pickups.some((pickup) => pickup.key === key),
        ) ||
        producer.pickups.some((pickup) => {
          const entry = entries[pickup.key];
          return (
            entry === undefined ||
            (pickup.rewardType !== undefined &&
              entry !== null &&
              entry.offer.rewardType !== pickup.rewardType)
          );
        })
      )
        failProjectDocument(
          `${rawOccurrence.path}.acquisitionSites.${producer.siteKey}.pickupEntries`,
          'does not match selected descriptor pickups',
        );
    }
  }
  const decodedRoomActions = decodeRoomActionState(
    rawOccurrence.roomActions,
    `${rawOccurrence.path}.roomActions`,
  );
  assertHermesShrinePurchaseActionClosure(
    hermesShrine,
    decodedRoomActions,
    `${rawOccurrence.path}.roomActions.order`,
  );
  const decodedOccurrence = Object.freeze({
    occurrenceId: rawOccurrence.occurrenceId,
    gameName: room.gameName,
    ...(owner.anomalyReplacement === undefined
      ? {}
      : { anomalyReplacement: owner.anomalyReplacement }),
    state,
    encounters,
    roomActions: decodedRoomActions,
    ...(hermesShrine === undefined ? {} : { hermesShrine }),
    ...(stygianWell === undefined ? {} : { stygianWell }),
    ...(fountainRarityResult === undefined ? {} : { fountainRarityResult }),
    ...(acquisitionSites === undefined ? {} : { acquisitionSites }),
    additionalExits,
  });
  if (
    fountainRarityResult !== undefined &&
    !activeRoomActionReferences(catalog, biomeAddress, decodedOccurrence).some(
      (reference) => reference.kind === 'useFountain',
    )
  )
    failProjectDocument(
      `${rawOccurrence.path}.fountainRarityResult`,
      'requires the declaration-owned fountain action',
    );
  for (const [siteKey, site] of Object.entries(acquisitionSites ?? {})) {
    const seaStar = parseSeaStarDuplicateSiteKey(siteKey);
    if (seaStar === undefined) continue;
    const source = authoredAcquisitionSources(biomeAddress, decodedOccurrence).find(
      (source) =>
        semanticAddressKey(source.acquisition.owner) === seaStar.sourceKey &&
        source.acquisition.acquisitionRole === seaStar.acquisitionRole,
    );
    if (source === undefined)
      failProjectDocument(
        `${rawOccurrence.path}.acquisitionSites.${siteKey}`,
        'does not name an authored acquisition source',
      );
    if (
      source.acquisition.owner.kind === 'acquisitionEntry' &&
      source.acquisition.owner.site.pointKey.startsWith('seaStarDuplicate:')
    )
      failProjectDocument(
        `${rawOccurrence.path}.acquisitionSites.${siteKey}`,
        'cannot duplicate a Sea Star duplicate',
      );
    const resolved = resolveAcquisitionRole(
      catalog.rewards,
      source.reward.offer,
      seaStar.acquisitionRole,
      'roomRewardPickup',
    );
    if (catalog.rewards.acquisitions.byKey[resolved.acquisition.gameName]?.canDuplicate !== true)
      failProjectDocument(
        `${rawOccurrence.path}.acquisitionSites.${siteKey}`,
        'source declaration cannot duplicate',
      );
    const duplicate = site.pickupEntries?.[SEA_STAR_DUPLICATE_ENTRY_KEY];
    if (duplicate === undefined || duplicate === null)
      failProjectDocument(
        `${rawOccurrence.path}.acquisitionSites.${siteKey}.pickupEntries`,
        'must contain a concrete Sea Star duplicate',
      );
    const expectedDuplicate = createSeaStarDuplicateRewardState(
      catalog,
      source.reward,
      seaStar.acquisitionRole,
    );
    // The generated identity is closed, but a fresh full Pom is its own
    // acquisition: its disposition and unresolved level child can be edited
    // exactly as any other reached Pom. Retained objects keep their offer.
    if (!sameStructuredValue(duplicate.offer, expectedDuplicate.offer))
      failProjectDocument(
        `${rawOccurrence.path}.acquisitionSites.${siteKey}.pickupEntries.${SEA_STAR_DUPLICATE_ENTRY_KEY}`,
        'does not match the Sea Star retained-or-fresh duplicate shape',
      );
    const expectedAction = Object.freeze({
      kind: 'interactAcquisitionEntry' as const,
      siteKey,
      entryKey: SEA_STAR_DUPLICATE_ENTRY_KEY,
    });
    if (
      decodedRoomActions.order.filter(
        (reference) => roomActionKey(reference) === roomActionKey(expectedAction),
      ).length !== 1
    )
      failProjectDocument(
        `${rawOccurrence.path}.roomActions.order`,
        'must retain the exact Sea Star duplicate action',
      );
  }
  return decodedOccurrence;
}
