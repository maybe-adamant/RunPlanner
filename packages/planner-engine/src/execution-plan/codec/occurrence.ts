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
      transaction.window.kind === 'shipPostCombat' &&
      isWheelOfferOwner(transaction.sourceOwner),
  ).length;
  if (wheelChoiceCount !== wheels.length || wheelAcquisitionCount !== wheels.length)
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
    if (acquisitions.length !== 1)
      fail(`${label}.overview.rewardWheels.${wheel.wheelKey} must match one picked acquisition`);
    if (
      !occurrence.timeline.dependencies.some(
        (dependency) =>
          dependency.owner === acquisitions[0]!.owner &&
          dependency.afterOwner === choices[0]!.owner,
      )
    )
      fail(`${label}.overview.rewardWheels.${wheel.wheelKey} is missing its choice dependency`);
  }
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

export function occurrence(value: unknown, index: number): ExecutionOccurrence {
  const label = `occurrences[${index}]`;
  const record = object(value, label);
  exact(
    record,
    ['id', 'owner', 'biomeKey', 'gameName', 'kind', 'overview', 'timeline', 'doors'],
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
  const isFieldsEncounter = record.kind === 'FieldsEncounter';
  const hasFieldsLayout = parsedOverview.fields !== undefined;
  if (isFieldsEncounter !== hasFieldsLayout)
    fail(`${label}.overview.fields is required exactly for H Fields encounters`);
  if (hasFieldsLayout && record.biomeKey !== 'H')
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
