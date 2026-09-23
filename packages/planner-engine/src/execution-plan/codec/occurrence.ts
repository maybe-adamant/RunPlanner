import type {
  ExecutionAnomalyReplacement,
  ExecutionBiomeKey,
  ExecutionOccurrence,
  ExecutionRoomExitConformanceFactKind,
} from '../model';
import {
  MAX_OWNER_STRING,
  array,
  booleanValue,
  exact,
  fail,
  object,
  stringValue,
} from './primitives';
import type { ExecutionFieldsLayout } from '../model';
import { runState } from './diagnostics';
import { doors } from './doors';
import { overview } from './overview';
import { timeline } from './timeline';
import { reward } from './rewards';

function validateRewardWheelProduct(
  occurrence: Pick<
    ExecutionOccurrence,
    'id' | 'owner' | 'biomeKey' | 'kind' | 'overview' | 'timeline'
  >,
  label: string,
): void {
  const wheels = occurrence.overview.rewardWheels ?? [];
  const combatPhases = occurrence.overview.encounterPhases.filter(
    (phase) => phase.slotKey !== 'Intro' && phase.kind === 'combat',
  );
  if (
    (occurrence.kind === 'ShipEncounter' && wheels.length !== combatPhases.length) ||
    (occurrence.kind !== 'ShipEncounter' && wheels.length > 0)
  )
    fail(`${label}.overview.rewardWheels must match the Ship encounter phases`);
  const wheelChoiceCount = occurrence.timeline.transactions.filter(
    (transaction) => transaction.kind === 'chooseRewardWheel',
  ).length;
  const isWheelOfferOwner = (owner: string) => {
    try {
      const parsed = JSON.parse(owner) as unknown;
      return Array.isArray(parsed) && parsed[0] === 'rewardWheelOffer';
    } catch {
      return false;
    }
  };
  const wheelAcquisitionCount = occurrence.timeline.transactions.filter(
    (transaction) =>
      transaction.kind === 'acquisition' &&
      (isWheelOfferOwner(transaction.sourceOwner) || isWheelOfferOwner(transaction.owner)),
  ).length;
  if (wheelChoiceCount !== wheels.length || wheelAcquisitionCount > wheels.length)
    fail(`${label}.overview.rewardWheels is disconnected from its timeline product`);
  if (wheels.length === 0) return;

  let routeKey: string;
  try {
    const owner = JSON.parse(occurrence.owner) as unknown;
    if (
      !Array.isArray(owner) ||
      owner.length !== 4 ||
      owner[0] !== 'occurrence' ||
      typeof owner[1] !== 'string' ||
      owner[2] !== occurrence.biomeKey ||
      owner[3] !== occurrence.id
    )
      throw new Error('mismatch');
    routeKey = owner[1];
  } catch {
    fail(`${label}.owner cannot identify its reward-wheel phases`);
  }

  const sameReward = (left: unknown, right: unknown) =>
    JSON.stringify(left) === JSON.stringify(right);
  let matchedAcquisitionCount = 0;
  for (const wheel of wheels) {
    const phase = occurrence.overview.encounterPhases.filter(
      (candidate) =>
        candidate.slotKey === wheel.phaseKey &&
        candidate.slotKey !== 'Intro' &&
        candidate.kind === 'combat',
    );
    if (phase.length !== 1)
      fail(`${label}.overview.rewardWheels.${wheel.wheelKey} must name one active combat phase`);
    const expectedPhaseOwner = JSON.stringify([
      'encounterPhase',
      routeKey,
      occurrence.biomeKey,
      { kind: 'occurrence', occurrenceId: occurrence.id },
      wheel.phaseKey,
    ]);
    if (wheel.phaseOwner !== expectedPhaseOwner)
      fail(`${label}.overview.rewardWheels.${wheel.wheelKey} has a mismatched phase owner`);

    const expectedChoiceOwner = JSON.stringify([
      'rewardWheel',
      routeKey,
      occurrence.biomeKey,
      occurrence.id,
      wheel.wheelKey,
    ]);
    const choices = occurrence.timeline.transactions.filter(
      (transaction) =>
        transaction.kind === 'chooseRewardWheel' &&
        transaction.owner === expectedChoiceOwner &&
        transaction.wheelKey === wheel.wheelKey &&
        transaction.pickedOfferKey === wheel.pickedOfferKey &&
        transaction.window.kind === 'shipPreCombat' &&
        transaction.window.wheelKey === wheel.wheelKey,
    );
    if (choices.length !== 1)
      fail(`${label}.overview.rewardWheels.${wheel.wheelKey} must match one wheel choice`);

    const picked = wheel.offers.find((offer) => offer.offerKey === wheel.pickedOfferKey)!;
    const expectedAcquisitionOwner = JSON.stringify([
      'rewardWheelOffer',
      routeKey,
      occurrence.biomeKey,
      occurrence.id,
      wheel.wheelKey,
      wheel.pickedOfferKey,
    ]);
    const acquisitions = occurrence.timeline.transactions.filter(
      (transaction) =>
        transaction.kind === 'acquisition' &&
        transaction.owner === expectedAcquisitionOwner &&
        transaction.sourceOwner === expectedAcquisitionOwner &&
        transaction.producerLifecycleKey === picked.reward.producerLifecycleKey &&
        sameReward(transaction.reward, picked.reward) &&
        transaction.window.kind === 'shipPostCombat' &&
        transaction.window.wheelKey === wheel.wheelKey,
    );
    if (acquisitions.length > 1)
      fail(`${label}.overview.rewardWheels.${wheel.wheelKey} must match one picked acquisition`);
    // A selected reward destroyed by Time Piece has no execution acquisition.
    if (acquisitions.length === 0) continue;
    matchedAcquisitionCount += acquisitions.length;
    if (
      !occurrence.timeline.dependencies.some(
        (dependency) =>
          dependency.owner === acquisitions[0]!.owner &&
          dependency.afterOwner === choices[0]!.owner,
      )
    )
      fail(`${label}.overview.rewardWheels.${wheel.wheelKey} is missing its choice dependency`);
  }
  if (matchedAcquisitionCount !== wheelAcquisitionCount)
    fail(`${label}.overview.rewardWheels has an unmatched picked acquisition`);
}

function validateFieldsCageSlots(
  layout: ExecutionFieldsLayout,
  encounterPhases: readonly { readonly slotKey: string }[],
  label: string,
): void {
  const activeCagePhases = encounterPhases.filter((phase) => /^Cage\d+$/.test(phase.slotKey));
  if (activeCagePhases.length !== layout.cagePoints.length)
    fail(`${label}.cagePoints must match the active cage encounter phases`);
  activeCagePhases.forEach((phase, index) => {
    const expectedPhase = `Cage${String(index + 1).padStart(2, '0')}`;
    const expectedSlot = `cage${index + 1}`;
    if (phase.slotKey !== expectedPhase || layout.cagePoints[index]?.slotKey !== expectedSlot)
      fail(`${label}.cagePoints must use canonical ordered cage slots`);
  });
}

function validateShopTransactionOwners(
  occurrence: Pick<ExecutionOccurrence, 'overview' | 'timeline'>,
  label: string,
): void {
  const owners =
    occurrence.overview.shop?.offers.flatMap((offer) =>
      offer.transactionOwner === undefined ? [] : [offer.transactionOwner],
    ) ?? [];
  if (new Set(owners).size !== owners.length)
    fail(`${label}.overview.shop.offers has duplicate transaction owners`);
  for (const owner of owners) {
    if (
      occurrence.timeline.transactions.filter((transaction) => transaction.owner === owner)
        .length !== 1
    )
      fail(`${label}.overview.shop transaction owner must name one occurrence transaction`);
  }
}

function roomGuideDescription(value: unknown, label: string) {
  const record = object(value, label);
  const kind = stringValue(record.kind, `${label}.kind`);
  const optionalReward = () =>
    record.reward === undefined ? undefined : reward(record.reward, `${label}.reward`);
  switch (kind) {
    case 'collectRequiredReward':
      exact(record, ['kind'], [], label);
      return Object.freeze({ kind });
    case 'completeFieldsCage': {
      exact(record, ['kind', 'phaseKey'], ['reward'], label);
      const parsedReward = optionalReward();
      return Object.freeze({
        kind,
        phaseKey: stringValue(record.phaseKey, `${label}.phaseKey`),
        ...(parsedReward === undefined ? {} : { reward: parsedReward }),
      });
    }
    case 'interactIncomingReward':
    case 'interactLocalReward': {
      exact(record, ['kind'], ['reward', 'conversion'], label);
      const parsedReward = optionalReward();
      if (record.conversion !== undefined && record.conversion !== 'timePiece')
        fail(`${label}.conversion is unsupported`);
      return Object.freeze({
        kind,
        ...(parsedReward === undefined ? {} : { reward: parsedReward }),
        ...(record.conversion === undefined ? {} : { conversion: 'timePiece' as const }),
      });
    }
    case 'chooseRewardWheel':
      exact(record, ['kind', 'wheelKey'], [], label);
      return Object.freeze({ kind, wheelKey: stringValue(record.wheelKey, `${label}.wheelKey`) });
    case 'interactWheelReward': {
      exact(record, ['kind', 'wheelKey'], ['reward', 'conversion'], label);
      const parsedReward = optionalReward();
      if (record.conversion !== undefined && record.conversion !== 'timePiece')
        fail(`${label}.conversion is unsupported`);
      return Object.freeze({
        kind,
        wheelKey: stringValue(record.wheelKey, `${label}.wheelKey`),
        ...(parsedReward === undefined ? {} : { reward: parsedReward }),
        ...(record.conversion === undefined ? {} : { conversion: 'timePiece' as const }),
      });
    }
    case 'interactShopOffer': {
      exact(record, ['kind', 'offerKey'], ['rewardType', 'conversion'], label);
      const conversion =
        record.conversion === undefined
          ? undefined
          : stringValue(record.conversion, `${label}.conversion`);
      if (conversion !== undefined && conversion !== 'timePiece' && conversion !== 'anvilOfFates')
        fail(`${label}.conversion is unsupported`);
      return Object.freeze({
        kind,
        offerKey: stringValue(record.offerKey, `${label}.offerKey`),
        ...(record.rewardType === undefined
          ? {}
          : { rewardType: stringValue(record.rewardType, `${label}.rewardType`) }),
        ...(conversion === undefined
          ? {}
          : { conversion: conversion as 'timePiece' | 'anvilOfFates' }),
      });
    }
    case 'purchaseStygianWellOffer': {
      exact(record, ['kind', 'generationKey'], ['itemKey', 'effect', 'twistResultKey'], label);
      const generationKey = stringValue(record.generationKey, `${label}.generationKey`);
      if (
        ![
          'initial:healing',
          'initial:secondLeft',
          'initial:secondRight',
          'travelDealRefill',
        ].includes(generationKey)
      )
        fail(`${label}.generationKey is unsupported`);
      const effect =
        record.effect === undefined ? undefined : stringValue(record.effect, `${label}.effect`);
      if (
        effect !== undefined &&
        ![
          'neutral',
          'spark',
          'yarn',
          'hymn',
          'discount',
          'emptySlot',
          'extended',
          'twist',
          'lastStand',
        ].includes(effect)
      )
        fail(`${label}.effect is unsupported`);
      return Object.freeze({
        kind,
        generationKey: generationKey as import('../model').ExecutionWellGenerationKey,
        ...(record.itemKey === undefined
          ? {}
          : { itemKey: stringValue(record.itemKey, `${label}.itemKey`) }),
        ...(effect === undefined
          ? {}
          : { effect: effect as import('../model').ExecutionWellEffect }),
        ...(record.twistResultKey === undefined
          ? {}
          : { twistResultKey: stringValue(record.twistResultKey, `${label}.twistResultKey`) }),
      });
    }
    case 'sellPurgingPoolTrait': {
      exact(record, ['kind', 'slotKey', 'traitKey'], [], label);
      const slotKey = stringValue(record.slotKey, `${label}.slotKey`);
      if (slotKey !== 'left' && slotKey !== 'middle' && slotKey !== 'right')
        fail(`${label}.slotKey is unsupported`);
      return Object.freeze({
        kind,
        slotKey,
        traitKey: stringValue(record.traitKey, `${label}.traitKey`),
      });
    }
    case 'interactEncounter':
    case 'interactGorgon':
      exact(record, ['kind', 'phaseKey'], ['encounterKey'], label);
      return Object.freeze({
        kind,
        phaseKey: stringValue(record.phaseKey, `${label}.phaseKey`),
        ...(record.encounterKey === undefined
          ? {}
          : { encounterKey: stringValue(record.encounterKey, `${label}.encounterKey`) }),
      });
    case 'interactAcquisitionEntry': {
      exact(record, ['kind'], ['reward', 'conversion'], label);
      const parsedReward = optionalReward();
      const conversion =
        record.conversion === undefined
          ? undefined
          : stringValue(record.conversion, `${label}.conversion`);
      if (conversion !== undefined && conversion !== 'timePiece' && conversion !== 'anvilOfFates')
        fail(`${label}.conversion is unsupported`);
      return Object.freeze({
        kind,
        ...(parsedReward === undefined ? {} : { reward: parsedReward }),
        ...(conversion === undefined
          ? {}
          : { conversion: conversion as 'timePiece' | 'anvilOfFates' }),
      });
    }
    case 'useFountain':
      exact(record, ['kind'], ['aromaticPhialTarget'], label);
      return Object.freeze({
        kind,
        ...(record.aromaticPhialTarget === undefined
          ? {}
          : {
              aromaticPhialTarget: stringValue(
                record.aromaticPhialTarget,
                `${label}.aromaticPhialTarget`,
              ),
            }),
      });
    case 'interactKeepsakeRack':
      exact(record, ['kind'], ['keepsakeKey'], label);
      return Object.freeze({
        kind,
        ...(record.keepsakeKey === undefined
          ? {}
          : { keepsakeKey: stringValue(record.keepsakeKey, `${label}.keepsakeKey`) }),
      });
    default:
      fail(`${label}.kind is unsupported`);
  }
}

function roomGuide(value: unknown, timelineValue: ExecutionOccurrence['timeline'], label: string) {
  const rows = array(value, label);
  const keys = new Set<string>();
  const transactionOwners = new Set(
    timelineValue.transactions.map((transaction) => transaction.owner),
  );
  return Object.freeze(
    rows.map((value, index) => {
      const rowLabel = `${label}[${index}]`;
      const record = object(value, rowLabel);
      exact(record, ['key', 'description'], ['transactionOwner'], rowLabel);
      const key = stringValue(record.key, `${rowLabel}.key`, MAX_OWNER_STRING);
      if (keys.has(key)) fail(`${label} has duplicate action key`);
      keys.add(key);
      const transactionOwner =
        record.transactionOwner === undefined
          ? undefined
          : stringValue(record.transactionOwner, `${rowLabel}.transactionOwner`, MAX_OWNER_STRING);
      if (transactionOwner !== undefined && !transactionOwners.has(transactionOwner))
        fail(`${rowLabel}.transactionOwner must name one occurrence transaction`);
      return Object.freeze({
        key,
        description: roomGuideDescription(record.description, `${rowLabel}.description`),
        ...(transactionOwner === undefined ? {} : { transactionOwner }),
      });
    }),
  );
}

export function occurrence(value: unknown, index: number): ExecutionOccurrence {
  const label = `occurrences[${index}]`;
  const record = object(value, label);
  exact(
    record,
    ['id', 'owner', 'biomeKey', 'gameName', 'kind', 'overview', 'timeline', 'roomGuide', 'doors'],
    ['anomaly', 'resumeBoundary', 'roomExitConformance', 'diagnostics'],
    label,
  );
  const resumeBoundary =
    record.resumeBoundary === undefined
      ? undefined
      : stringValue(record.resumeBoundary, `${label}.resumeBoundary`);
  if (resumeBoundary !== undefined && resumeBoundary !== 'postbossEntry')
    fail(`${label}.resumeBoundary is unsupported`);
  const anomaly =
    record.anomaly === undefined ? undefined : object(record.anomaly, `${label}.anomaly`);
  if (anomaly !== undefined)
    exact(anomaly, ['replacedRoomGameName', 'success'], [], `${label}.anomaly`);
  const parsedAnomaly: ExecutionAnomalyReplacement | undefined =
    anomaly === undefined
      ? undefined
      : Object.freeze({
          replacedRoomGameName: stringValue(
            anomaly.replacedRoomGameName,
            `${label}.anomaly.replacedRoomGameName`,
          ),
          success: booleanValue(anomaly.success, `${label}.anomaly.success`),
        });
  const diagnostics =
    record.diagnostics === undefined
      ? undefined
      : object(record.diagnostics, `${label}.diagnostics`);
  if (diagnostics !== undefined)
    exact(diagnostics, [], ['roomEntered', 'beforeRoomExit'], `${label}.diagnostics`);
  const conformance =
    record.roomExitConformance === undefined
      ? undefined
      : object(record.roomExitConformance, `${label}.roomExitConformance`);
  if (conformance !== undefined) exact(conformance, ['facts'], [], `${label}.roomExitConformance`);
  const allowedConformanceKinds = new Set<ExecutionRoomExitConformanceFactKind>([
    'traitInventory',
    'elementCounts',
    'steadyGrowth',
    'chaos',
    'keepsakeEffects',
    'rewardPriorities',
    'pathOfStars',
    'forfeit',
    'stygianWell',
  ]);
  const conformanceFacts =
    conformance === undefined
      ? undefined
      : array(conformance.facts, `${label}.roomExitConformance.facts`).map((value, factIndex) => {
          const fact = object(value, `${label}.roomExitConformance.facts[${factIndex}]`);
          exact(fact, ['kind'], [], `${label}.roomExitConformance.facts[${factIndex}]`);
          const kind = stringValue(
            fact.kind,
            `${label}.roomExitConformance.facts[${factIndex}].kind`,
          ) as ExecutionRoomExitConformanceFactKind;
          if (!allowedConformanceKinds.has(kind))
            fail(`${label}.roomExitConformance.facts[${factIndex}].kind is unsupported`);
          return Object.freeze({ kind });
        });
  const parsedOverview = overview(record.overview, `${label}.overview`);
  const hasFieldsLayout = parsedOverview.fields !== undefined;
  if (
    (record.kind === 'FieldsEncounter' && record.biomeKey !== 'H') ||
    (hasFieldsLayout && record.kind !== 'FieldsEncounter')
  )
    fail(`${label}.overview.fields is only valid for H Fields encounters`);
  if (parsedOverview.fields !== undefined)
    validateFieldsCageSlots(
      parsedOverview.fields,
      parsedOverview.encounterPhases,
      `${label}.overview.fields`,
    );
  const biomeKey = stringValue(record.biomeKey, `${label}.biomeKey`);
  if (!['F', 'G', 'H', 'I', 'N', 'O', 'P', 'Q'].includes(biomeKey))
    fail(`${label}.biomeKey is unsupported`);
  const parsedTimeline = timeline(record.timeline, `${label}.timeline`);
  const parsedRoomGuide = roomGuide(record.roomGuide, parsedTimeline, `${label}.roomGuide`);
  const parsed = Object.freeze({
    id: stringValue(record.id, `${label}.id`, 256),
    owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
    biomeKey: biomeKey as ExecutionBiomeKey,
    gameName: stringValue(record.gameName, `${label}.gameName`),
    kind: stringValue(record.kind, `${label}.kind`),
    ...(resumeBoundary === undefined ? {} : { resumeBoundary }),
    ...(parsedAnomaly === undefined ? {} : { anomaly: parsedAnomaly }),
    overview: parsedOverview,
    timeline: parsedTimeline,
    roomGuide: parsedRoomGuide,
    doors: doors(record.doors, `${label}.doors`),
    ...(conformanceFacts === undefined
      ? {}
      : { roomExitConformance: Object.freeze({ facts: Object.freeze(conformanceFacts) }) }),
    ...(diagnostics === undefined
      ? {}
      : {
          diagnostics: Object.freeze({
            ...(diagnostics.roomEntered === undefined
              ? {}
              : {
                  roomEntered: runState(
                    diagnostics.roomEntered,
                    `${label}.diagnostics.roomEntered`,
                  ),
                }),
            ...(diagnostics.beforeRoomExit === undefined
              ? {}
              : {
                  beforeRoomExit: runState(
                    diagnostics.beforeRoomExit,
                    `${label}.diagnostics.beforeRoomExit`,
                  ),
                }),
          }),
        }),
  });
  validateShopTransactionOwners(parsed, label);
  validateRewardWheelProduct(parsed, label);
  return parsed;
}
