import {
  MAX_OWNER_STRING,
  array,
  booleanValue,
  exact,
  fail,
  integer,
  numberRecord,
  object,
  stringArray,
  stringValue,
} from './primitives';
import { reward } from './rewards';
import { roomReference } from './room';

export function overview(value: unknown, label: string) {
  const record = object(value, label);
  exact(
    record,
    ['encounterPhases', 'requiredObjects'],
    [
      'incomingReward',
      'effectNeutralRequiredReward',
      'shop',
      'stygianWell',
      'purgingPool',
      'keepsakeRack',
      'fountain',
      'resources',
      'additional',
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
  const shop = record.shop === undefined ? undefined : object(record.shop, `${label}.shop`);
  if (
    record.effectNeutralRequiredReward !== undefined &&
    booleanValue(record.effectNeutralRequiredReward, `${label}.effectNeutralRequiredReward`) !==
      true
  )
    fail(`${label}.effectNeutralRequiredReward must be true when present`);
  if (shop !== undefined)
    exact(shop, ['profileKey', 'offers'], ['travelDealRefill'], `${label}.shop`);
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
                ['source', 'spurnedSource'],
                `${label}.shop.offers[${index}]`,
              );
              return Object.freeze({
                offerKey: stringValue(row.offerKey, `${label}.shop.offers[${index}].offerKey`),
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
          ...(shop.travelDealRefill === undefined
            ? {}
            : {
                travelDealRefill: (() => {
                  const row = object(shop.travelDealRefill, `${label}.shop.travelDealRefill`);
                  exact(
                    row,
                    ['sourceOfferKey', 'slotIndex', 'optionKey', 'reward'],
                    [],
                    `${label}.shop.travelDealRefill`,
                  );
                  return Object.freeze({
                    sourceOfferKey: stringValue(
                      row.sourceOfferKey,
                      `${label}.shop.travelDealRefill.sourceOfferKey`,
                    ),
                    slotIndex: integer(row.slotIndex, `${label}.shop.travelDealRefill.slotIndex`),
                    optionKey: stringValue(
                      row.optionKey,
                      `${label}.shop.travelDealRefill.optionKey`,
                    ),
                    reward: reward(row.reward, `${label}.shop.travelDealRefill.reward`),
                  });
                })(),
              }),
        });
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
                      ![
                        'initial:healing',
                        'initial:secondLeft',
                        'initial:secondRight',
                        'travelDealRefill',
                      ].includes(row.generationKey as string)
                    )
                      fail(`${label}.stygianWell.offers[${index}].generationKey is unsupported`);
                    return Object.freeze({
                      generationKey: row.generationKey as
                        | 'initial:healing'
                        | 'initial:secondLeft'
                        | 'initial:secondRight'
                        | 'travelDealRefill',
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
  const resources =
    record.resources === undefined
      ? undefined
      : array(record.resources, `${label}.resources`).map((entry, index) => {
          const row = object(entry, `${label}.resources[${index}]`);
          exact(
            row,
            ['acquisitionRole', 'grantedTraitKey', 'contributions'],
            [],
            `${label}.resources[${index}]`,
          );
          return Object.freeze({
            acquisitionRole: stringValue(
              row.acquisitionRole,
              `${label}.resources[${index}].acquisitionRole`,
            ),
            grantedTraitKey: stringValue(
              row.grantedTraitKey,
              `${label}.resources[${index}].grantedTraitKey`,
            ),
            contributions: numberRecord(
              row.contributions,
              `${label}.resources[${index}].contributions`,
            ),
          });
        });
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
  return Object.freeze({
    ...(record.incomingReward === undefined
      ? {}
      : { incomingReward: reward(record.incomingReward, `${label}.incomingReward`) }),
    ...(record.effectNeutralRequiredReward === undefined
      ? {}
      : { effectNeutralRequiredReward: true as const }),
    encounterPhases: Object.freeze(encounterPhases),
    requiredObjects: Object.freeze(stringArray(record.requiredObjects, `${label}.requiredObjects`)),
    ...(parsedShop === undefined ? {} : { shop: parsedShop }),
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
    ...(resources === undefined ? {} : { resources: Object.freeze(resources) }),
    ...(additional === undefined ? {} : { additional: Object.freeze(additional) }),
  });
}
