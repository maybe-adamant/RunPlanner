import {
  MAX_OWNER_STRING,
  array,
  booleanValue,
  exact,
  fail,
  integer,
  object,
  stringArray,
  stringValue,
} from './primitives';
import { reward } from './rewards';
import { roomReference } from './room';
import type { ExecutionFieldsLayout } from '../model';

function fields(value: unknown, label: string): ExecutionFieldsLayout {
  const record = object(value, label);
  exact(record, ['entryPair', 'cagePoints', 'optionalRewards'], ['nemesisPointId'], label);

  const entryPair = object(record.entryPair, `${label}.entryPair`);
  exact(entryPair, ['startPointId', 'endPointId'], [], `${label}.entryPair`);
  const parsedEntryPair = Object.freeze({
    startPointId: integer(entryPair.startPointId, `${label}.entryPair.startPointId`, 1),
    endPointId: integer(entryPair.endPointId, `${label}.entryPair.endPointId`, 1),
  });

  const cagePoints = Object.freeze(
    array(record.cagePoints, `${label}.cagePoints`).map((entry, index) => {
      const row = object(entry, `${label}.cagePoints[${index}]`);
      exact(row, ['slotKey', 'pointId'], [], `${label}.cagePoints[${index}]`);
      return Object.freeze({
        slotKey: stringValue(row.slotKey, `${label}.cagePoints[${index}].slotKey`),
        pointId: integer(row.pointId, `${label}.cagePoints[${index}].pointId`, 1),
      });
    }),
  );
  if (cagePoints.length < 2 || cagePoints.length > 3)
    fail(`${label}.cagePoints must contain two or three active cages`);
  if (new Set(cagePoints.map((point) => point.slotKey)).size !== cagePoints.length)
    fail(`${label}.cagePoints has duplicate slot keys`);
  const pointIds = new Set(cagePoints.map((point) => point.pointId));

  const optionalRewards = Object.freeze(
    array(record.optionalRewards, `${label}.optionalRewards`).map((entry, index) => {
      const row = object(entry, `${label}.optionalRewards[${index}]`);
      exact(row, ['slotKey', 'pointId', 'reward'], [], `${label}.optionalRewards[${index}]`);
      return Object.freeze({
        slotKey: stringValue(row.slotKey, `${label}.optionalRewards[${index}].slotKey`),
        pointId: integer(row.pointId, `${label}.optionalRewards[${index}].pointId`, 1),
        reward: reward(row.reward, `${label}.optionalRewards[${index}].reward`),
      });
    }),
  );
  if (new Set(optionalRewards.map((entry) => entry.slotKey)).size !== optionalRewards.length)
    fail(`${label}.optionalRewards has duplicate slot keys`);
  for (const entry of optionalRewards) {
    if (pointIds.has(entry.pointId)) fail(`${label} reuses a Fields point ID`);
    pointIds.add(entry.pointId);
  }

  const parsedNemesisPointId =
    record.nemesisPointId === undefined
      ? undefined
      : integer(record.nemesisPointId, `${label}.nemesisPointId`, 1);
  if (parsedNemesisPointId !== undefined && pointIds.has(parsedNemesisPointId))
    fail(`${label} reuses a Fields point ID`);

  return Object.freeze({
    entryPair: parsedEntryPair,
    cagePoints,
    optionalRewards,
    ...(parsedNemesisPointId === undefined ? {} : { nemesisPointId: parsedNemesisPointId }),
  });
}

export function overview(value: unknown, label: string) {
  const record = object(value, label);
  exact(
    record,
    ['encounterPhases', 'requiredObjects'],
    [
      'incomingReward',
      'effectNeutralRequiredReward',
      'unmodeledEncounterKeys',
      'rewardWheels',
      'shop',
      'hermesShrine',
      'stygianWell',
      'purgingPool',
      'keepsakeRack',
      'fountain',
      'fields',
      'additional',
      'hub',
      'localSlots',
    ],
    label,
  );
  const encounterPhases = array(record.encounterPhases, `${label}.encounterPhases`).map(
    (entry, index) => {
      const row = object(entry, `${label}.encounterPhases[${index}]`);
      exact(
        row,
        ['slotKey', 'encounterKey', 'kind'],
        ['figLeafSkip'],
        `${label}.encounterPhases[${index}]`,
      );
      return Object.freeze({
        slotKey: stringValue(row.slotKey, `${label}.encounterPhases[${index}].slotKey`),
        encounterKey: stringValue(
          row.encounterKey,
          `${label}.encounterPhases[${index}].encounterKey`,
        ),
        kind: stringValue(row.kind, `${label}.encounterPhases[${index}].kind`),
        ...(row.figLeafSkip === undefined
          ? {}
          : {
              figLeafSkip: booleanValue(
                row.figLeafSkip,
                `${label}.encounterPhases[${index}].figLeafSkip`,
              ),
            }),
      });
    },
  );
  const unmodeledEncounterKeys =
    record.unmodeledEncounterKeys === undefined
      ? undefined
      : stringArray(record.unmodeledEncounterKeys, `${label}.unmodeledEncounterKeys`);
  if (unmodeledEncounterKeys !== undefined && unmodeledEncounterKeys.length === 0) {
    fail(`${label}.unmodeledEncounterKeys must be non-empty when present`);
  }
  if (unmodeledEncounterKeys !== undefined && encounterPhases.length > 0) {
    fail(`${label}.unmodeledEncounterKeys cannot coexist with modeled encounter phases`);
  }
  const rewardWheels =
    record.rewardWheels === undefined
      ? undefined
      : Object.freeze(
          array(record.rewardWheels, `${label}.rewardWheels`).map((entry, index) => {
            const wheel = object(entry, `${label}.rewardWheels[${index}]`);
            exact(
              wheel,
              [
                'wheelKey',
                'phaseKey',
                'phaseOwner',
                'offerCount',
                'storeKey',
                'offers',
                'pickedOfferKey',
              ],
              [],
              `${label}.rewardWheels[${index}]`,
            );
            const wheelLabel = `${label}.rewardWheels[${index}]`;
            const offers = Object.freeze(
              array(wheel.offers, `${wheelLabel}.offers`).map((offerEntry, offerIndex) => {
                const offer = object(offerEntry, `${wheelLabel}.offers[${offerIndex}]`);
                exact(offer, ['offerKey', 'reward'], [], `${wheelLabel}.offers[${offerIndex}]`);
                return Object.freeze({
                  offerKey: stringValue(
                    offer.offerKey,
                    `${wheelLabel}.offers[${offerIndex}].offerKey`,
                  ),
                  reward: reward(offer.reward, `${wheelLabel}.offers[${offerIndex}].reward`),
                });
              }),
            );
            const offerCount = integer(wheel.offerCount, `${wheelLabel}.offerCount`, 1);
            if (offerCount > 2) fail(`${wheelLabel}.offerCount must be one or two`);
            if (offerCount !== offers.length)
              fail(`${wheelLabel}.offerCount must match its active offers`);
            const pickedOfferKey = stringValue(
              wheel.pickedOfferKey,
              `${wheelLabel}.pickedOfferKey`,
            );
            if (offers.filter((offer) => offer.offerKey === pickedOfferKey).length !== 1)
              fail(`${wheelLabel}.pickedOfferKey must identify one active offer`);
            const storeKey = stringValue(wheel.storeKey, `${wheelLabel}.storeKey`);
            if (storeKey !== 'RunProgress' && storeKey !== 'MetaProgress')
              fail(`${wheelLabel}.storeKey must be RunProgress or MetaProgress`);
            return Object.freeze({
              wheelKey: stringValue(wheel.wheelKey, `${wheelLabel}.wheelKey`),
              phaseKey: stringValue(wheel.phaseKey, `${wheelLabel}.phaseKey`),
              phaseOwner: stringValue(
                wheel.phaseOwner,
                `${wheelLabel}.phaseOwner`,
                MAX_OWNER_STRING,
              ),
              offerCount,
              storeKey,
              offers,
              pickedOfferKey,
            });
          }),
        );
  if (rewardWheels !== undefined) {
    const wheelKeys = rewardWheels.map((wheel) => wheel.wheelKey);
    const phaseKeys = rewardWheels.map((wheel) => wheel.phaseKey);
    if (new Set(wheelKeys).size !== wheelKeys.length)
      fail(`${label}.rewardWheels has duplicate wheel keys`);
    if (new Set(phaseKeys).size !== phaseKeys.length)
      fail(`${label}.rewardWheels has duplicate phase keys`);
  }
  const shop = record.shop === undefined ? undefined : object(record.shop, `${label}.shop`);
  if (
    record.effectNeutralRequiredReward !== undefined &&
    booleanValue(record.effectNeutralRequiredReward, `${label}.effectNeutralRequiredReward`) !==
      true
  )
    fail(`${label}.effectNeutralRequiredReward must be true when present`);
  if (shop !== undefined)
    exact(shop, ['profileKey', 'offers'], ['infernalContract'], `${label}.shop`);
  const contract =
    shop?.infernalContract === undefined
      ? undefined
      : object(shop.infernalContract, `${label}.shop.infernalContract`);
  if (contract !== undefined)
    exact(contract, ['sourceOwner', 'rewardType'], [], `${label}.shop.infernalContract`);
  const parsedShop =
    shop === undefined
      ? undefined
      : Object.freeze({
          profileKey: stringValue(shop.profileKey, `${label}.shop.profileKey`),
          offers: Object.freeze(
            array(shop.offers, `${label}.shop.offers`).map((entry, index) => {
              const row = object(entry, `${label}.shop.offers[${index}]`);
              exact(
                row,
                ['offerKey', 'optionKey', 'rewardType'],
                ['transactionOwner', 'source', 'spurnedSource'],
                `${label}.shop.offers[${index}]`,
              );
              return Object.freeze({
                offerKey: stringValue(row.offerKey, `${label}.shop.offers[${index}].offerKey`),
                ...(row.transactionOwner === undefined
                  ? {}
                  : {
                      transactionOwner: stringValue(
                        row.transactionOwner,
                        `${label}.shop.offers[${index}].transactionOwner`,
                        MAX_OWNER_STRING,
                      ),
                    }),
                optionKey: stringValue(row.optionKey, `${label}.shop.offers[${index}].optionKey`),
                rewardType: stringValue(
                  row.rewardType,
                  `${label}.shop.offers[${index}].rewardType`,
                ),
                ...(row.source === undefined
                  ? {}
                  : { source: stringValue(row.source, `${label}.shop.offers[${index}].source`) }),
                ...(row.spurnedSource === undefined
                  ? {}
                  : {
                      spurnedSource: stringValue(
                        row.spurnedSource,
                        `${label}.shop.offers[${index}].spurnedSource`,
                      ),
                    }),
              });
            }),
          ),
          ...(contract === undefined
            ? {}
            : {
                infernalContract: Object.freeze({
                  sourceOwner: stringValue(
                    contract.sourceOwner,
                    `${label}.shop.infernalContract.sourceOwner`,
                  ),
                  rewardType: stringValue(
                    contract.rewardType,
                    `${label}.shop.infernalContract.rewardType`,
                  ),
                }),
              }),
        });
  if (
    parsedShop !== undefined &&
    new Set(
      parsedShop.offers.flatMap((offer) =>
        offer.transactionOwner === undefined ? [] : [offer.transactionOwner],
      ),
    ).size !== parsedShop.offers.filter((offer) => offer.transactionOwner !== undefined).length
  )
    fail(`${label}.shop.offers has duplicate transaction owners`);
  const shrine =
    record.hermesShrine === undefined
      ? undefined
      : object(record.hermesShrine, `${label}.hermesShrine`);
  const shrineGenerationKeys = [
    'initial:first',
    'initial:secondLeft',
    'initial:secondRight',
  ] as const;
  const shrinePurchase = (value: unknown, purchaseLabel: string) => {
    const row = object(value, purchaseLabel);
    exact(row, ['roomDelay', 'rushed'], [], purchaseLabel);
    const roomDelay = integer(row.roomDelay, `${purchaseLabel}.roomDelay`);
    if (roomDelay < 2 || roomDelay > 8) fail(`${purchaseLabel}.roomDelay must be 2-8`);
    return Object.freeze({
      roomDelay: roomDelay as 2 | 3 | 4 | 5 | 6 | 7 | 8,
      rushed: booleanValue(row.rushed, `${purchaseLabel}.rushed`),
    });
  };
  const parsedShrine =
    shrine === undefined
      ? undefined
      : (() => {
          exact(shrine, ['offers'], [], `${label}.hermesShrine`);
          const offers = Object.freeze(
            array(shrine.offers, `${label}.hermesShrine.offers`, 3).map((entry, index) => {
              const row = object(entry, `${label}.hermesShrine.offers[${index}]`);
              exact(
                row,
                ['generationKey', 'optionKey', 'rewardType', 'slotIndex'],
                ['purchase', 'deliverySourceKey'],
                `${label}.hermesShrine.offers[${index}]`,
              );
              if (
                !shrineGenerationKeys.includes(
                  row.generationKey as (typeof shrineGenerationKeys)[number],
                )
              )
                fail(`${label}.hermesShrine.offers[${index}].generationKey is unsupported`);
              if (row.generationKey !== shrineGenerationKeys[index])
                fail(`${label}.hermesShrine.offers[${index}].generationKey is not native order`);
              if (row.slotIndex !== index + 1)
                fail(`${label}.hermesShrine.offers[${index}].slotIndex is not native order`);
              if ((row.purchase === undefined) !== (row.deliverySourceKey === undefined))
                fail(
                  `${label}.hermesShrine.offers[${index}].purchase and deliverySourceKey must be paired`,
                );
              return Object.freeze({
                generationKey: row.generationKey as (typeof shrineGenerationKeys)[number],
                optionKey: stringValue(
                  row.optionKey,
                  `${label}.hermesShrine.offers[${index}].optionKey`,
                ),
                rewardType: stringValue(
                  row.rewardType,
                  `${label}.hermesShrine.offers[${index}].rewardType`,
                ),
                slotIndex: row.slotIndex as 1 | 2 | 3,
                ...(row.deliverySourceKey === undefined
                  ? {}
                  : {
                      deliverySourceKey: stringValue(
                        row.deliverySourceKey,
                        'deliverySourceKey',
                        MAX_OWNER_STRING,
                      ),
                    }),
                ...(row.purchase === undefined
                  ? {}
                  : {
                      purchase: shrinePurchase(
                        row.purchase,
                        `${label}.hermesShrine.offers[${index}].purchase`,
                      ),
                    }),
              });
            }),
          );
          if (offers.length !== 3) fail(`${label}.hermesShrine.offers must contain three offers`);
          return Object.freeze({
            offers,
          });
        })();
  const well =
    record.stygianWell === undefined
      ? undefined
      : object(record.stygianWell, `${label}.stygianWell`);
  if (well !== undefined) exact(well, ['interacted'], ['offers'], `${label}.stygianWell`);
  if (well !== undefined) {
    const interacted = booleanValue(well.interacted, `${label}.stygianWell.interacted`);
    if (interacted !== (well.offers !== undefined))
      fail(`${label}.stygianWell.offers must be present iff interacted`);
  }
  const parsedWell =
    well === undefined
      ? undefined
      : Object.freeze({
          interacted: booleanValue(well.interacted, `${label}.stygianWell.interacted`),
          ...(well.offers === undefined
            ? {}
            : {
                offers: Object.freeze(
                  array(well.offers, `${label}.stygianWell.offers`).map((entry, index) => {
                    const row = object(entry, `${label}.stygianWell.offers[${index}]`);
                    exact(
                      row,
                      ['generationKey', 'offerKey'],
                      ['twistResultKey'],
                      `${label}.stygianWell.offers[${index}]`,
                    );
                    if (
                      !['initial:healing', 'initial:secondLeft', 'initial:secondRight'].includes(
                        row.generationKey as string,
                      )
                    )
                      fail(`${label}.stygianWell.offers[${index}].generationKey is unsupported`);
                    return Object.freeze({
                      generationKey: row.generationKey as
                        'initial:healing' | 'initial:secondLeft' | 'initial:secondRight',
                      offerKey: stringValue(
                        row.offerKey,
                        `${label}.stygianWell.offers[${index}].offerKey`,
                      ),
                      ...(row.twistResultKey === undefined
                        ? {}
                        : {
                            twistResultKey: stringValue(
                              row.twistResultKey,
                              `${label}.stygianWell.offers[${index}].twistResultKey`,
                            ),
                          }),
                    });
                  }),
                ),
              }),
        });
  if (parsedWell?.offers !== undefined) {
    const keys = parsedWell.offers.map((offer) => offer.generationKey);
    if (new Set(keys).size !== keys.length)
      fail(`${label}.stygianWell.offers has duplicate generation keys`);
  }
  const pool =
    record.purgingPool === undefined
      ? undefined
      : object(record.purgingPool, `${label}.purgingPool`);
  if (pool !== undefined) exact(pool, ['interacted'], ['traits'], `${label}.purgingPool`);
  if (pool !== undefined) {
    const interacted = booleanValue(pool.interacted, `${label}.purgingPool.interacted`);
    if (interacted !== (pool.traits !== undefined))
      fail(`${label}.purgingPool.traits must be present iff interacted`);
  }
  const parsedPool =
    pool === undefined
      ? undefined
      : Object.freeze({
          interacted: booleanValue(pool.interacted, `${label}.purgingPool.interacted`),
          ...(pool.traits === undefined
            ? {}
            : {
                traits: Object.freeze(
                  array(pool.traits, `${label}.purgingPool.traits`, 3).map((entry, index) => {
                    const row = object(entry, `${label}.purgingPool.traits[${index}]`);
                    exact(
                      row,
                      ['slotKey', 'traitKey'],
                      [],
                      `${label}.purgingPool.traits[${index}]`,
                    );
                    if (!['left', 'middle', 'right'].includes(row.slotKey as string))
                      fail(`${label}.purgingPool.traits[${index}].slotKey is unsupported`);
                    return Object.freeze({
                      slotKey: row.slotKey as 'left' | 'middle' | 'right',
                      traitKey:
                        row.traitKey === null
                          ? null
                          : stringValue(
                              row.traitKey,
                              `${label}.purgingPool.traits[${index}].traitKey`,
                            ),
                    });
                  }),
                ),
              }),
        });
  if (parsedPool?.traits !== undefined) {
    const keys = parsedPool.traits.map((trait) => trait.slotKey);
    if (new Set(keys).size !== keys.length)
      fail(`${label}.purgingPool.traits has duplicate slot keys`);
  }
  const rack =
    record.keepsakeRack === undefined
      ? undefined
      : object(record.keepsakeRack, `${label}.keepsakeRack`);
  if (rack !== undefined) exact(rack, [], ['keepsakeKey'], `${label}.keepsakeRack`);
  const fountain =
    record.fountain === undefined ? undefined : object(record.fountain, `${label}.fountain`);
  if (fountain !== undefined) exact(fountain, [], ['aromaticPhialTarget'], `${label}.fountain`);
  const additional =
    record.additional === undefined
      ? undefined
      : array(record.additional, `${label}.additional`).map((entry, index) => {
          const row = object(entry, `${label}.additional[${index}]`);
          exact(row, ['kind', 'owner', 'room'], ['ixionOrigin'], `${label}.additional[${index}]`);
          if (row.kind !== 'chaos' && row.kind !== 'zagreusContract')
            fail(`${label}.additional[${index}].kind is unsupported`);
          const ixion =
            row.ixionOrigin === undefined
              ? undefined
              : object(row.ixionOrigin, `${label}.additional[${index}].ixionOrigin`);
          if (ixion !== undefined)
            exact(
              ixion,
              ['sourceBiomeKey', 'sourceOccurrenceId', 'generationKey'],
              [],
              `${label}.additional[${index}].ixionOrigin`,
            );
          return Object.freeze({
            kind: row.kind,
            owner: stringValue(row.owner, `${label}.additional[${index}].owner`, MAX_OWNER_STRING),
            room: roomReference(row.room, `${label}.additional[${index}].room`),
            ...(ixion === undefined
              ? {}
              : {
                  ixionOrigin: Object.freeze({
                    sourceBiomeKey: stringValue(
                      ixion.sourceBiomeKey,
                      `${label}.additional[${index}].ixionOrigin.sourceBiomeKey`,
                    ),
                    sourceOccurrenceId: stringValue(
                      ixion.sourceOccurrenceId,
                      `${label}.additional[${index}].ixionOrigin.sourceOccurrenceId`,
                      256,
                    ),
                    generationKey: stringValue(
                      ixion.generationKey,
                      `${label}.additional[${index}].ixionOrigin.generationKey`,
                    ),
                  }),
                }),
          });
        });
  const parsedFields =
    record.fields === undefined ? undefined : fields(record.fields, `${label}.fields`);
  const hub = record.hub === undefined ? undefined : object(record.hub, `${label}.hub`);
  if (hub !== undefined) exact(hub, ['room', 'slots', 'finalHandoff'], [], `${label}.hub`);
  const parsedHub =
    hub === undefined
      ? undefined
      : (() => {
          const room = object(hub.room, `${label}.hub.room`);
          exact(room, ['gameName'], [], `${label}.hub.room`);
          return Object.freeze({
            room: Object.freeze({
              gameName: stringValue(room.gameName, `${label}.hub.room.gameName`),
            }),
            slots: Object.freeze(
              array(hub.slots, `${label}.hub.slots`).map((entry, index) => {
                const row = object(entry, `${label}.hub.slots[${index}]`);
                exact(
                  row,
                  ['slotKey', 'physicalDoorId', 'room', 'reward'],
                  [],
                  `${label}.hub.slots[${index}]`,
                );
                return Object.freeze({
                  slotKey: stringValue(row.slotKey, `${label}.hub.slots[${index}].slotKey`),
                  physicalDoorId: integer(
                    row.physicalDoorId,
                    `${label}.hub.slots[${index}].physicalDoorId`,
                    1,
                  ),
                  room: roomReference(row.room, `${label}.hub.slots[${index}].room`),
                  reward: reward(row.reward, `${label}.hub.slots[${index}].reward`),
                });
              }),
            ),
            finalHandoff: roomReference(hub.finalHandoff, `${label}.hub.finalHandoff`),
          });
        })();
  const localSlots =
    record.localSlots === undefined
      ? undefined
      : Object.freeze(
          array(record.localSlots, `${label}.localSlots`).map((entry, index) => {
            const row = object(entry, `${label}.localSlots[${index}]`);
            exact(
              row,
              ['slotKey', 'physicalDoorId', 'generation'],
              ['room', 'reward'],
              `${label}.localSlots[${index}]`,
            );
            const generation = stringValue(
              row.generation,
              `${label}.localSlots[${index}].generation`,
            );
            if (generation !== 'generated' && generation !== 'notGenerated')
              fail(`${label}.localSlots[${index}].generation is unsupported`);
            if (
              (row.room === undefined) !== (row.reward === undefined) ||
              (generation === 'generated') !== (row.room !== undefined)
            )
              fail(
                `${label}.localSlots[${index}] must carry room and reward exactly when generated`,
              );
            return Object.freeze({
              slotKey: stringValue(row.slotKey, `${label}.localSlots[${index}].slotKey`),
              physicalDoorId: integer(
                row.physicalDoorId,
                `${label}.localSlots[${index}].physicalDoorId`,
                1,
              ),
              generation: generation as 'generated' | 'notGenerated',
              ...(row.room === undefined
                ? {}
                : {
                    room: roomReference(row.room, `${label}.localSlots[${index}].room`),
                    reward: reward(row.reward, `${label}.localSlots[${index}].reward`),
                  }),
            });
          }),
        );
  return Object.freeze({
    ...(record.incomingReward === undefined
      ? {}
      : { incomingReward: reward(record.incomingReward, `${label}.incomingReward`) }),
    ...(record.effectNeutralRequiredReward === undefined
      ? {}
      : { effectNeutralRequiredReward: true as const }),
    ...(unmodeledEncounterKeys === undefined
      ? {}
      : { unmodeledEncounterKeys: Object.freeze(unmodeledEncounterKeys) }),
    ...(rewardWheels === undefined ? {} : { rewardWheels }),
    encounterPhases: Object.freeze(encounterPhases),
    requiredObjects: Object.freeze(stringArray(record.requiredObjects, `${label}.requiredObjects`)),
    ...(parsedShop === undefined ? {} : { shop: parsedShop }),
    ...(parsedShrine === undefined ? {} : { hermesShrine: parsedShrine }),
    ...(parsedWell === undefined ? {} : { stygianWell: parsedWell }),
    ...(parsedPool === undefined ? {} : { purgingPool: parsedPool }),
    ...(rack === undefined
      ? {}
      : {
          keepsakeRack: Object.freeze(
            rack.keepsakeKey === undefined
              ? {}
              : {
                  keepsakeKey: stringValue(rack.keepsakeKey, `${label}.keepsakeRack.keepsakeKey`),
                },
          ),
        }),
    ...(fountain === undefined
      ? {}
      : {
          fountain: Object.freeze(
            fountain.aromaticPhialTarget === undefined
              ? {}
              : {
                  aromaticPhialTarget: stringValue(
                    fountain.aromaticPhialTarget,
                    `${label}.fountain.aromaticPhialTarget`,
                  ),
                },
          ),
        }),
    ...(additional === undefined ? {} : { additional: Object.freeze(additional) }),
    ...(parsedFields === undefined ? {} : { fields: parsedFields }),
    ...(parsedHub === undefined ? {} : { hub: parsedHub }),
    ...(localSlots === undefined ? {} : { localSlots }),
  });
}
