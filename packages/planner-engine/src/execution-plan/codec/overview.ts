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
import type {
  ExecutionFieldsLayout,
  ExecutionHubDepartureConformance,
  ExecutionHubFountainUse,
} from '../model';
import { equippedTraits, runState } from './diagnostics';
import { generatedEncounter } from './generated-encounter';

/** A present native-roll exclusion list is non-empty and distinct. */
function excludedEnemies(value: unknown, label: string) {
  const enemies = array(value, label, 64).map((entry, index) => {
    const row = object(entry, `${label}[${index}]`);
    exact(row, ['choiceKey', 'nativeId'], [], `${label}[${index}]`);
    return Object.freeze({
      choiceKey: stringValue(row.choiceKey, `${label}[${index}].choiceKey`),
      nativeId: stringValue(row.nativeId, `${label}[${index}].nativeId`),
    });
  });
  if (enemies.length === 0) fail(`${label} must be non-empty when present`);
  if (
    new Set(enemies.map((enemy) => enemy.choiceKey)).size !== enemies.length ||
    new Set(enemies.map((enemy) => enemy.nativeId)).size !== enemies.length
  )
    fail(`${label} must be distinct`);
  return Object.freeze(enemies);
}

function encounterCustomization(value: unknown, label: string) {
  const decisions = array(value, label, 16).map((entry, index) => {
    const row = object(entry, `${label}[${index}]`);
    const decisionLabel = `${label}[${index}]`;
    const kind = stringValue(row.kind, `${decisionLabel}.kind`);
    if (kind === 'generated') return generatedEncounter(row, decisionLabel);
    if (kind === 'single') {
      exact(row, ['decisionKey', 'kind', 'choiceKey', 'nativeId'], [], decisionLabel);
      return Object.freeze({
        decisionKey: stringValue(row.decisionKey, `${decisionLabel}.decisionKey`),
        kind: 'single' as const,
        choiceKey: stringValue(row.choiceKey, `${decisionLabel}.choiceKey`),
        nativeId: stringValue(row.nativeId, `${decisionLabel}.nativeId`),
      });
    }
    if (kind === 'orderedPrefix') {
      exact(row, ['decisionKey', 'kind', 'choices'], [], decisionLabel);
      const choices = array(row.choices, `${decisionLabel}.choices`, 2).map(
        (choice, choiceIndex) => {
          const choiceLabel = `${decisionLabel}.choices[${choiceIndex}]`;
          const choiceRecord = object(choice, choiceLabel);
          exact(choiceRecord, ['choiceKey', 'nativeId'], [], choiceLabel);
          return Object.freeze({
            choiceKey: stringValue(choiceRecord.choiceKey, `${choiceLabel}.choiceKey`),
            nativeId: stringValue(choiceRecord.nativeId, `${choiceLabel}.nativeId`),
          });
        },
      );
      if (choices.length === 0) fail(`${decisionLabel}.choices must be a non-empty prefix`);
      if (new Set(choices.map((choice) => choice.choiceKey)).size !== choices.length)
        fail(`${decisionLabel}.choices must be distinct`);
      return Object.freeze({
        decisionKey: stringValue(row.decisionKey, `${decisionLabel}.decisionKey`),
        kind: 'orderedPrefix' as const,
        choices: Object.freeze(choices),
      });
    }
    if (kind === 'cocoonRewardPoint') {
      exact(row, ['decisionKey', 'kind', 'spawnPointId'], [], decisionLabel);
      return Object.freeze({
        decisionKey: stringValue(row.decisionKey, `${decisionLabel}.decisionKey`),
        kind: 'cocoonRewardPoint' as const,
        spawnPointId: integer(row.spawnPointId, `${decisionLabel}.spawnPointId`, 1),
      });
    }
    if (kind === 'cocoonCount') {
      exact(row, ['decisionKey', 'kind', 'count'], [], decisionLabel);
      return Object.freeze({
        decisionKey: stringValue(row.decisionKey, `${decisionLabel}.decisionKey`),
        kind: 'cocoonCount' as const,
        count: integer(row.count, `${decisionLabel}.count`, 1),
      });
    }
    if (kind === 'infiniteRoster') {
      exact(row, ['decisionKey', 'kind', 'types'], [], decisionLabel);
      const types = array(row.types, `${decisionLabel}.types`, 16).map((type, typeIndex) => {
        const typeLabel = `${decisionLabel}.types[${typeIndex}]`;
        const typeRecord = object(type, typeLabel);
        exact(typeRecord, ['choiceKey', 'nativeId'], [], typeLabel);
        return Object.freeze({
          choiceKey: stringValue(typeRecord.choiceKey, `${typeLabel}.choiceKey`),
          nativeId: stringValue(typeRecord.nativeId, `${typeLabel}.nativeId`),
        });
      });
      if (types.length === 0) fail(`${decisionLabel}.types must be non-empty`);
      if (
        new Set(types.map((type) => type.choiceKey)).size !== types.length ||
        new Set(types.map((type) => type.nativeId)).size !== types.length
      )
        fail(`${decisionLabel}.types must be distinct`);
      return Object.freeze({
        decisionKey: stringValue(row.decisionKey, `${decisionLabel}.decisionKey`),
        kind: 'infiniteRoster' as const,
        types: Object.freeze(types),
      });
    }
    fail(`${decisionLabel}.kind is unsupported`);
  });
  if (decisions.length === 0) fail(`${label} must be non-empty when present`);
  if (new Set(decisions.map((decision) => decision.decisionKey)).size !== decisions.length)
    fail(`${label} has duplicate decision keys`);
  return Object.freeze(decisions);
}

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

function hubFountainUse(
  value: unknown,
  requiredVisitCount: number,
  label: string,
): ExecutionHubFountainUse {
  const record = object(value, label);
  exact(
    record,
    ['kind', 'owner', 'interactionKey', 'precedingVisitCount'],
    ['aromaticPhialTarget'],
    label,
  );
  if (record.kind !== 'fountainUse') fail(`${label}.kind is unsupported`);
  if (record.interactionKey !== 'fountain') fail(`${label}.interactionKey is unsupported`);
  const precedingVisitCount = integer(record.precedingVisitCount, `${label}.precedingVisitCount`);
  if (precedingVisitCount > requiredVisitCount)
    fail(`${label}.precedingVisitCount exceeds the required Hub visits`);
  return Object.freeze({
    kind: 'fountainUse',
    owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
    interactionKey: 'fountain',
    precedingVisitCount,
    ...(record.aromaticPhialTarget === undefined
      ? {}
      : {
          aromaticPhialTarget: stringValue(
            record.aromaticPhialTarget,
            `${label}.aromaticPhialTarget`,
          ),
        }),
  });
}

/** Board rerolls pressed across Hub stays, in order; each names a Hub slot. */
function hubRerolls(value: unknown, slotKeys: ReadonlySet<string>, label: string) {
  const rows = array(value, label);
  if (rows.length === 0) fail(`${label} must be absent when empty`);
  const owners = new Set<string>();
  return Object.freeze(
    rows.map((entry, index) => {
      const rowLabel = `${label}[${index}]`;
      const row = object(entry, rowLabel);
      exact(row, ['owner', 'slotKey', 'reward'], [], rowLabel);
      const owner = stringValue(row.owner, `${rowLabel}.owner`, MAX_OWNER_STRING);
      if (owners.has(owner)) fail(`${label} has duplicate reroll owner`);
      owners.add(owner);
      const slotKey = stringValue(row.slotKey, `${rowLabel}.slotKey`);
      if (!slotKeys.has(slotKey)) fail(`${rowLabel}.slotKey must name a Hub slot`);
      return Object.freeze({
        owner,
        slotKey,
        reward: reward(row.reward, `${rowLabel}.reward`),
      });
    }),
  );
}

function hubDepartures(
  value: unknown,
  requiredVisitCount: number,
  label: string,
): readonly ExecutionHubDepartureConformance[] {
  const departures = array(value, label).map((entry, index) =>
    hubDepartureConformance(entry, `${label}[${index}]`),
  );
  if (departures.length !== requiredVisitCount + 1)
    fail(`${label} must publish one entry per Hub departure`);
  departures.forEach((departure, index) => {
    if (departure.precedingVisitCount !== index)
      fail(`${label}[${index}].precedingVisitCount must be ${index}`);
  });
  return Object.freeze(departures);
}

function hubDepartureConformance(value: unknown, label: string): ExecutionHubDepartureConformance {
  const record = object(value, label);
  exact(record, ['precedingVisitCount', 'facts', 'traits'], ['beforeRoomExit'], label);
  const precedingVisitCount = integer(record.precedingVisitCount, `${label}.precedingVisitCount`);
  const facts = array(record.facts, `${label}.facts`).map((entry, index) => {
    const fact = object(entry, `${label}.facts[${index}]`);
    exact(fact, ['kind'], [], `${label}.facts[${index}]`);
    if (fact.kind !== 'traitInventory') fail(`${label}.facts[${index}].kind is unsupported`);
    return Object.freeze({ kind: 'traitInventory' as const });
  });
  if (facts.length !== 1) fail(`${label}.facts must name the trait inventory once`);
  const traits = object(record.traits, `${label}.traits`);
  exact(traits, ['equipped'], [], `${label}.traits`);
  const equipped = equippedTraits(traits.equipped, `${label}.traits.equipped`);
  if (new Set(equipped.map((trait) => trait.traitKey)).size !== equipped.length)
    fail(`${label}.traits.equipped has duplicate traits`);
  return Object.freeze({
    precedingVisitCount,
    facts: Object.freeze(facts),
    traits: Object.freeze({ equipped: Object.freeze(equipped) }),
    ...(record.beforeRoomExit === undefined
      ? {}
      : { beforeRoomExit: runState(record.beforeRoomExit, `${label}.beforeRoomExit`) }),
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
      'infernalContractPedestal',
      'phantomExit',
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
        ['figLeafSkip', 'customization', 'excludedEnemies'],
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
        ...(row.customization === undefined
          ? {}
          : {
              customization: encounterCustomization(
                row.customization,
                `${label}.encounterPhases[${index}].customization`,
              ),
            }),
        ...(row.excludedEnemies === undefined
          ? {}
          : {
              excludedEnemies: excludedEnemies(
                row.excludedEnemies,
                `${label}.encounterPhases[${index}].excludedEnemies`,
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
  if (shop !== undefined) exact(shop, ['profileKey', 'offers'], [], `${label}.shop`);
  const contract =
    record.infernalContractPedestal === undefined
      ? undefined
      : object(record.infernalContractPedestal, `${label}.infernalContractPedestal`);
  if (contract !== undefined)
    exact(contract, ['sourceOwner', 'rewardType'], [], `${label}.infernalContractPedestal`);
  const parsedPedestal =
    contract === undefined
      ? undefined
      : Object.freeze({
          sourceOwner: stringValue(
            contract.sourceOwner,
            `${label}.infernalContractPedestal.sourceOwner`,
            MAX_OWNER_STRING,
          ),
          rewardType: stringValue(
            contract.rewardType,
            `${label}.infernalContractPedestal.rewardType`,
          ),
        });
  const phantom =
    record.phantomExit === undefined
      ? undefined
      : object(record.phantomExit, `${label}.phantomExit`);
  if (phantom !== undefined)
    exact(phantom, ['placeholderRoomGameName'], ['reward'], `${label}.phantomExit`);
  const phantomReward =
    phantom?.reward === undefined
      ? undefined
      : object(phantom.reward, `${label}.phantomExit.reward`);
  if (phantomReward !== undefined)
    exact(
      phantomReward,
      ['rewardType', 'storeKey'],
      ['source', 'spurnedSource'],
      `${label}.phantomExit.reward`,
    );
  if (phantomReward?.spurnedSource !== undefined && phantomReward.source === undefined)
    fail(`${label}.phantomExit.reward.spurnedSource requires source`);
  const parsedPhantom =
    phantom === undefined
      ? undefined
      : Object.freeze({
          placeholderRoomGameName: stringValue(
            phantom.placeholderRoomGameName,
            `${label}.phantomExit.placeholderRoomGameName`,
          ),
          ...(phantomReward === undefined
            ? {}
            : {
                reward: Object.freeze({
                  rewardType: stringValue(
                    phantomReward.rewardType,
                    `${label}.phantomExit.reward.rewardType`,
                  ),
                  storeKey: stringValue(
                    phantomReward.storeKey,
                    `${label}.phantomExit.reward.storeKey`,
                  ),
                  ...(phantomReward.source === undefined
                    ? {}
                    : {
                        source: stringValue(
                          phantomReward.source,
                          `${label}.phantomExit.reward.source`,
                        ),
                      }),
                  ...(phantomReward.spurnedSource === undefined
                    ? {}
                    : {
                        spurnedSource: stringValue(
                          phantomReward.spurnedSource,
                          `${label}.phantomExit.reward.spurnedSource`,
                        ),
                      }),
                }),
              }),
        });
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
                ['offerKey', 'profileSlotIndex', 'optionKey', 'rewardType'],
                ['transactionOwner', 'source', 'spurnedSource'],
                `${label}.shop.offers[${index}]`,
              );
              return Object.freeze({
                offerKey: stringValue(row.offerKey, `${label}.shop.offers[${index}].offerKey`),
                profileSlotIndex: integer(
                  row.profileSlotIndex,
                  `${label}.shop.offers[${index}].profileSlotIndex`,
                ),
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
  // Native emission preserves declared order; empty slots only leave gaps.
  if (
    parsedShop !== undefined &&
    parsedShop.offers.some(
      (offer, index) =>
        index > 0 && offer.profileSlotIndex <= parsedShop.offers[index - 1]!.profileSlotIndex,
    )
  )
    fail(`${label}.shop.offers profileSlotIndex values must strictly increase`);
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
    exact(row, ['rushed'], [], purchaseLabel);
    return Object.freeze({ rushed: booleanValue(row.rushed, `${purchaseLabel}.rushed`) });
  };
  const shrineRoomDelay = (value: unknown, delayLabel: string) => {
    const roomDelay = integer(value, delayLabel);
    if (roomDelay < 2 || roomDelay > 8) fail(`${delayLabel} must be 2-8`);
    return roomDelay as 2 | 3 | 4 | 5 | 6 | 7 | 8;
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
                ['generationKey', 'optionKey', 'rewardType', 'slotIndex', 'roomDelay'],
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
                roomDelay: shrineRoomDelay(
                  row.roomDelay,
                  `${label}.hermesShrine.offers[${index}].roomDelay`,
                ),
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
  if (well !== undefined) exact(well, ['offers'], ['rerolls'], `${label}.stygianWell`);
  const parsedWell =
    well === undefined
      ? undefined
      : Object.freeze({
          offers: wellOffers(well.offers, 'initial', `${label}.stygianWell.offers`),
          ...(well.rerolls === undefined
            ? {}
            : {
                rerolls: rolls(
                  well.rerolls,
                  `${label}.stygianWell.rerolls`,
                  (row, rollKey, path) => {
                    exact(row, ['rollKey', 'offers'], [], path);
                    return Object.freeze({
                      rollKey,
                      offers: wellOffers(row.offers, rollKey, `${path}.offers`),
                    });
                  },
                ),
              }),
        });
  const pool =
    record.purgingPool === undefined
      ? undefined
      : object(record.purgingPool, `${label}.purgingPool`);
  if (pool !== undefined) exact(pool, ['traits'], ['rerolls'], `${label}.purgingPool`);
  const parsedPool =
    pool === undefined
      ? undefined
      : Object.freeze({
          traits: poolTraits(pool.traits, `${label}.purgingPool.traits`),
          ...(pool.rerolls === undefined
            ? {}
            : {
                rerolls: rolls(
                  pool.rerolls,
                  `${label}.purgingPool.rerolls`,
                  (row, rollKey, path) => {
                    exact(row, ['rollKey', 'traits'], [], path);
                    return Object.freeze({
                      rollKey,
                      traits: poolTraits(row.traits, `${path}.traits`),
                    });
                  },
                ),
              }),
        });
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
          exact(
            row,
            ['kind', 'owner', 'room'],
            ['ixionOrigin', 'spawnPointIndex'],
            `${label}.additional[${index}]`,
          );
          if (row.kind !== 'chaos' && row.kind !== 'zagreusContract')
            fail(`${label}.additional[${index}].kind is unsupported`);
          if (row.spawnPointIndex !== undefined && row.kind !== 'chaos')
            fail(`${label}.additional[${index}].spawnPointIndex is Chaos-only`);
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
            ...(row.spawnPointIndex === undefined
              ? {}
              : {
                  spawnPointIndex: integer(
                    row.spawnPointIndex,
                    `${label}.additional[${index}].spawnPointIndex`,
                    1,
                  ),
                }),
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
  if (hub !== undefined)
    exact(
      hub,
      ['room', 'slots', 'finalHandoff', 'requiredVisitCount', 'fountain', 'departures'],
      ['rerolls'],
      `${label}.hub`,
    );
  const parsedHub =
    hub === undefined
      ? undefined
      : (() => {
          const room = object(hub.room, `${label}.hub.room`);
          exact(room, ['gameName'], [], `${label}.hub.room`);
          const slotCount = array(hub.slots, `${label}.hub.slots`).length;
          const requiredVisitCount = integer(
            hub.requiredVisitCount,
            `${label}.hub.requiredVisitCount`,
            1,
          );
          if (requiredVisitCount > slotCount)
            fail(`${label}.hub.requiredVisitCount exceeds the open Hub slots`);
          const slots = Object.freeze(
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
          );
          return Object.freeze({
            room: Object.freeze({
              gameName: stringValue(room.gameName, `${label}.hub.room.gameName`),
            }),
            slots,
            finalHandoff: roomReference(hub.finalHandoff, `${label}.hub.finalHandoff`),
            requiredVisitCount,
            fountain: hubFountainUse(hub.fountain, requiredVisitCount, `${label}.hub.fountain`),
            departures: hubDepartures(
              hub.departures,
              requiredVisitCount,
              `${label}.hub.departures`,
            ),
            ...(hub.rerolls === undefined
              ? {}
              : {
                  rerolls: hubRerolls(
                    hub.rerolls,
                    new Set(slots.map((slot) => slot.slotKey)),
                    `${label}.hub.rerolls`,
                  ),
                }),
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
    ...(parsedPedestal === undefined ? {} : { infernalContractPedestal: parsedPedestal }),
    ...(parsedPhantom === undefined ? {} : { phantomExit: parsedPhantom }),
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

const WELL_SLOT_KEYS = ['healing', 'secondLeft', 'secondRight'];

/** One Well roll's authored offers, each at a slot of that roll. */
function wellOffers(
  value: unknown,
  rollKey: string,
  label: string,
): readonly import('../model').ExecutionWellOffer[] {
  const offers = Object.freeze(
    array(value, label).map((entry, index) => {
      const row = object(entry, `${label}[${index}]`);
      exact(row, ['generationKey', 'offerKey'], ['twistResultKey'], `${label}[${index}]`);
      const generationKey = stringValue(row.generationKey, `${label}[${index}].generationKey`);
      if (!WELL_SLOT_KEYS.some((slotKey) => generationKey === `${rollKey}:${slotKey}`))
        fail(`${label}[${index}].generationKey is unsupported`);
      return Object.freeze({
        generationKey: generationKey as `${string}:${'healing' | 'secondLeft' | 'secondRight'}`,
        offerKey: stringValue(row.offerKey, `${label}[${index}].offerKey`),
        ...(row.twistResultKey === undefined
          ? {}
          : {
              twistResultKey: stringValue(row.twistResultKey, `${label}[${index}].twistResultKey`),
            }),
      });
    }),
  );
  if (new Set(offers.map((offer) => offer.generationKey)).size !== offers.length)
    fail(`${label} has duplicate generation keys`);
  return offers;
}

/** A Well's or Pool's rerolls in action order, each named by a distinct reroll id. */
function rolls<T>(
  value: unknown,
  label: string,
  decode: (row: Readonly<Record<string, unknown>>, rollKey: string, path: string) => T,
): readonly T[] {
  const entries = array(value, label);
  if (entries.length === 0) fail(`${label} must not be empty`);
  const seen = new Set<string>();
  return Object.freeze(
    entries.map((entry, index) => {
      const path = `${label}[${index}]`;
      const row = object(entry, path);
      const rollKey = stringValue(row.rollKey, `${path}.rollKey`);
      if (!/^r[1-9][0-9]*$/.test(rollKey)) fail(`${path}.rollKey must be a reroll id`);
      if (seen.has(rollKey)) fail(`${label} has duplicate roll keys`);
      seen.add(rollKey);
      return decode(row, rollKey, path);
    }),
  );
}

/** One Pool list's pinned slots, each named once. */
function poolTraits(value: unknown, label: string) {
  const traits = Object.freeze(
    array(value, label, 3).map((entry, index) => {
      const trait = object(entry, `${label}[${index}]`);
      exact(trait, ['slotKey', 'traitKey'], [], `${label}[${index}]`);
      if (!['left', 'middle', 'right'].includes(trait.slotKey as string))
        fail(`${label}[${index}].slotKey is unsupported`);
      return Object.freeze({
        slotKey: trait.slotKey as 'left' | 'middle' | 'right',
        traitKey: stringValue(trait.traitKey, `${label}[${index}].traitKey`),
      });
    }),
  );
  if (new Set(traits.map((trait) => trait.slotKey)).size !== traits.length)
    fail(`${label} has duplicate slot keys`);
  return traits;
}
