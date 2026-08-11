import type {
  CatalogCollection,
  EncounterEnvelope,
  RoomLifecycleEffectKind,
  RoomLifecycleOperation,
  RoomLifecycleProfile,
  RoomLifecycleProducerPolicy,
} from '@run-planner/engine/catalog-schema';
import type {
  ProducerLifecyclePointKey,
  ProducerLifecycleProfileDeclaration,
} from '@run-planner/engine/reward-kernel';

import type { RawRoomLifecycleProfileDeclaration } from '../declarations';
import { createCollection, freezeUniqueStrings, requireNonEmpty } from './common';
import { fail } from './errors';

const effectKinds = {
  advanceEncounterDepth: true,
  advanceRoomCounters: true,
  recordAppearance: true,
  recordCommit: true,
  recordEncounter: true,
  recordEncounterCompletion: true,
  recordEncounterStart: true,
  recordEnteredRewardStore: true,
  recordExit: true,
  recordOfferPoint: true,
  recordPhaseOfferAcquisition: true,
  recordPhaseOfferPoint: true,
  recordOutgoingGeneration: true,
  recordPreparation: true,
  recordProducerPoint: true,
  recordRequiredObjectCompletions: true,
  recordRequiredObjectSpawns: true,
  recordAcquisitionPoint: true,
} as const satisfies Readonly<Record<RoomLifecycleEffectKind, true>>;

const producerLifecyclePoints = {
  afterCombat: true,
  afterUnwrap: true,
  beforeCombat: true,
  purchase: true,
  roomRewardPickup: true,
} as const satisfies Readonly<Record<ProducerLifecyclePointKey, true>>;

const expectedEffects = {
  prepareRoom: ['recordPreparation', 'recordEncounter'],
  materializeOfferPoint: ['recordOfferPoint'],
  enterRoom: ['recordAppearance'],
  spawnRequiredObjects: ['recordRequiredObjectSpawns'],
  startEncounter: ['recordEncounterStart', 'advanceEncounterDepth'],
  completeEncounter: ['recordEncounterCompletion'],
  completeRequiredObjects: ['recordRequiredObjectCompletions'],
  runEncounterSequence: [
    'recordEncounterStart',
    'advanceEncounterDepth',
    'recordEncounterCompletion',
  ],
  runRewardEncounterSequence: [
    'recordPhaseOfferPoint',
    'recordEncounterStart',
    'advanceEncounterDepth',
    'recordEncounterCompletion',
    'recordPhaseOfferAcquisition',
  ],
  advanceProducer: ['recordProducerPoint'],
  generateOutgoingBatch: ['recordOutgoingGeneration'],
  settleAcquisitionPoint: ['recordAcquisitionPoint'],
  commitRoom: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
  exitRoom: ['recordExit'],
} as const satisfies Readonly<
  Record<RoomLifecycleOperation['kind'], readonly RoomLifecycleEffectKind[]>
>;

function normalizeEffects(
  raw: readonly RoomLifecycleEffectKind[],
  operationKind: RoomLifecycleOperation['kind'],
  path: string,
): readonly RoomLifecycleEffectKind[] {
  const effects = freezeUniqueStrings(raw, path) as readonly RoomLifecycleEffectKind[];
  for (const [index, effect] of effects.entries()) {
    if (!Object.hasOwn(effectKinds, effect)) {
      fail(`${path}[${index}]`, `unknown lifecycle effect ${String(effect)}`);
    }
  }
  const expected = expectedEffects[operationKind];
  if (
    effects.length !== expected.length ||
    effects.some((effect, index) => effect !== expected[index])
  ) {
    fail(path, `${operationKind} requires effects ${expected.join(', ')}`);
  }
  return effects;
}

function normalizeOnlyEncounterSelector(
  operation: Extract<
    RoomLifecycleOperation,
    { readonly kind: 'completeEncounter' | 'startEncounter' }
  >,
  path: string,
) {
  if (operation.encounter.kind !== 'only') {
    fail(
      `${path}.encounter.kind`,
      `unknown encounter selector ${String(operation.encounter.kind)}`,
    );
  }
  return Object.freeze({ kind: 'only' as const });
}

function normalizeOperation(raw: RoomLifecycleOperation, path: string): RoomLifecycleOperation {
  const receivedKind: unknown = (raw as { readonly kind?: unknown }).kind;
  switch (raw.kind) {
    case 'prepareRoom':
    case 'enterRoom':
    case 'spawnRequiredObjects':
    case 'completeRequiredObjects':
    case 'generateOutgoingBatch':
    case 'runEncounterSequence':
    case 'runRewardEncounterSequence':
    case 'commitRoom':
    case 'exitRoom':
      return Object.freeze({
        kind: raw.kind,
        effects: normalizeEffects(raw.effects, raw.kind, `${path}.effects`),
      });
    case 'materializeOfferPoint':
      return Object.freeze({
        kind: raw.kind,
        offerPoint: requireNonEmpty(raw.offerPoint, `${path}.offerPoint`),
        effects: normalizeEffects(raw.effects, raw.kind, `${path}.effects`),
      });
    case 'settleAcquisitionPoint':
      return Object.freeze({
        kind: raw.kind,
        point: requireNonEmpty(raw.point, `${path}.point`),
        effects: normalizeEffects(raw.effects, raw.kind, `${path}.effects`),
      });
    case 'startEncounter':
    case 'completeEncounter':
      return Object.freeze({
        kind: raw.kind,
        encounter: normalizeOnlyEncounterSelector(raw, path),
        effects: normalizeEffects(raw.effects, raw.kind, `${path}.effects`),
      });
    case 'advanceProducer':
      if (!Object.hasOwn(producerLifecyclePoints, raw.point)) {
        fail(`${path}.point`, `unknown producer lifecycle point ${String(raw.point)}`);
      }
      return Object.freeze({
        kind: raw.kind,
        point: raw.point,
        effects: normalizeEffects(raw.effects, raw.kind, `${path}.effects`),
      });
    default:
      fail(`${path}.kind`, `unknown lifecycle operation ${String(receivedKind)}`);
  }
}

function normalizeProducerPolicy(
  raw: RoomLifecycleProducerPolicy,
  producerLifecycles: CatalogCollection<ProducerLifecycleProfileDeclaration>,
  path: string,
): RoomLifecycleProducerPolicy {
  const receivedKind: unknown = (raw as { readonly kind?: unknown }).kind;
  if (raw.kind === 'none') {
    return Object.freeze({ kind: 'none' });
  }
  if (raw.kind !== 'required') {
    fail(`${path}.kind`, `unknown producer policy ${String(receivedKind)}`);
  }
  const lifecycleProfileKeys = freezeUniqueStrings(
    raw.lifecycleProfileKeys,
    `${path}.lifecycleProfileKeys`,
  );
  if (lifecycleProfileKeys.length === 0) {
    fail(`${path}.lifecycleProfileKeys`, 'must not be empty');
  }
  for (const [index, key] of lifecycleProfileKeys.entries()) {
    if (producerLifecycles.byKey[key] === undefined) {
      fail(`${path}.lifecycleProfileKeys[${index}]`, `unknown producer lifecycle ${key}`);
    }
  }
  return Object.freeze({ kind: 'required', lifecycleProfileKeys });
}

function validateOperationSequence(
  operations: readonly RoomLifecycleOperation[],
  producer: RoomLifecycleProducerPolicy,
  path: string,
): void {
  if (operations.length === 0) {
    fail(path, 'must not be empty');
  }
  if (operations[0]?.kind !== 'prepareRoom') {
    fail(`${path}[0].kind`, 'lifecycle must begin with prepareRoom');
  }
  if (operations.at(-1)?.kind !== 'exitRoom') {
    fail(`${path}[${operations.length - 1}].kind`, 'lifecycle must end with exitRoom');
  }
  for (const required of ['prepareRoom', 'enterRoom', 'commitRoom', 'exitRoom'] as const) {
    if (operations.filter((operation) => operation.kind === required).length !== 1) {
      fail(path, `lifecycle requires exactly one ${required}`);
    }
  }
  const indexOf = (kind: RoomLifecycleOperation['kind']) =>
    operations.findIndex((operation) => operation.kind === kind);
  const enterIndex = indexOf('enterRoom');
  const commitIndex = indexOf('commitRoom');
  if (!(
    indexOf('prepareRoom') < enterIndex &&
    enterIndex < commitIndex &&
    commitIndex < indexOf('exitRoom')
  )) {
    fail(path, 'prepareRoom, enterRoom, commitRoom, and exitRoom are out of order');
  }

  const materializedOfferPoints = new Map<string, number>();
  const settledAcquisitionPoints = new Set<string>();
  let encounterActive = false;
  let encounterCompleted = false;
  let requiredObjectsSpawned = false;
  let requiredObjectsCompleted = false;
  let outgoingGenerationCount = 0;
  for (const [index, operation] of operations.entries()) {
    if (index > commitIndex && operation.kind !== 'exitRoom') {
      fail(`${path}[${index}].kind`, 'only exitRoom may follow commitRoom');
    }
    if (
      index < enterIndex &&
      operation.kind !== 'prepareRoom' &&
      operation.kind !== 'materializeOfferPoint'
    ) {
      fail(`${path}[${index}].kind`, `${operation.kind} cannot precede enterRoom`);
    }

    if (operation.kind === 'materializeOfferPoint') {
      if (materializedOfferPoints.has(operation.offerPoint)) {
        fail(`${path}[${index}].offerPoint`, `duplicates offer point ${operation.offerPoint}`);
      }
      materializedOfferPoints.set(operation.offerPoint, index);
    } else if (operation.kind === 'settleAcquisitionPoint') {
      if (settledAcquisitionPoints.has(operation.point)) {
        fail(`${path}[${index}].point`, `duplicates acquisition point ${operation.point}`);
      }
      settledAcquisitionPoints.add(operation.point);
    } else if (operation.kind === 'advanceProducer' && producer.kind === 'none') {
      fail(`${path}[${index}].kind`, 'producer advancement requires a producer policy');
    } else if (operation.kind === 'startEncounter') {
      if (encounterActive) {
        fail(`${path}[${index}].kind`, 'encounter phases cannot overlap');
      }
      encounterActive = true;
    } else if (operation.kind === 'completeEncounter') {
      if (!encounterActive) {
        fail(`${path}[${index}].kind`, 'encounter completion requires an active phase');
      }
      encounterActive = false;
      encounterCompleted = true;
    } else if (
      operation.kind === 'runEncounterSequence' ||
      operation.kind === 'runRewardEncounterSequence'
    ) {
      encounterCompleted = true;
    } else if (operation.kind === 'spawnRequiredObjects') {
      if (requiredObjectsSpawned || index !== enterIndex + 1) {
        fail(
          `${path}[${index}].kind`,
          'required objects must spawn once immediately after room entry',
        );
      }
      requiredObjectsSpawned = true;
    } else if (operation.kind === 'completeRequiredObjects') {
      if (
        !requiredObjectsSpawned ||
        requiredObjectsCompleted ||
        encounterActive ||
        !encounterCompleted
      ) {
        fail(
          `${path}[${index}].kind`,
          'required objects must complete once after encounter completion',
        );
      }
      requiredObjectsCompleted = true;
    } else if (operation.kind === 'generateOutgoingBatch') {
      if (encounterActive) {
        fail(
          `${path}[${index}].kind`,
          'generateOutgoingBatch cannot interrupt an active encounter phase',
        );
      }
      if (requiredObjectsSpawned && !requiredObjectsCompleted) {
        fail(`${path}[${index}].kind`, 'generateOutgoingBatch requires completed required objects');
      }
      outgoingGenerationCount += 1;
      if (outgoingGenerationCount > 1) {
        fail(`${path}[${index}].kind`, 'lifecycle may generate at most one outgoing batch');
      }
    } else if (operation.kind === 'commitRoom' && encounterActive) {
      fail(`${path}[${index}].kind`, 'commitRoom cannot interrupt an active encounter phase');
    }
  }
  if (encounterActive) {
    fail(path, 'every started encounter requires one completion');
  }
  if (requiredObjectsSpawned !== requiredObjectsCompleted) {
    fail(path, 'required-object spawn and completion operations must be paired');
  }
}

function validateEncounterCompatibility(
  profile: RoomLifecycleProfile,
  encounterEnvelopes: CatalogCollection<EncounterEnvelope>,
  path: string,
): void {
  const usesOnlyEncounter = profile.operations.some(
    (operation) => operation.kind === 'startEncounter' || operation.kind === 'completeEncounter',
  );
  const usesEncounterSequence = profile.operations.some(
    (operation) =>
      operation.kind === 'runEncounterSequence' || operation.kind === 'runRewardEncounterSequence',
  );
  const usesRewardEncounterSequence = profile.operations.some(
    (operation) => operation.kind === 'runRewardEncounterSequence',
  );
  if (usesOnlyEncounter && usesEncounterSequence) {
    fail(path, 'cannot combine only-encounter operations with an encounter sequence');
  }
  if (
    profile.operations.filter(
      (operation) =>
        operation.kind === 'runEncounterSequence' ||
        operation.kind === 'runRewardEncounterSequence',
    ).length > 1
  ) {
    fail(path, 'lifecycle may run at most one encounter sequence');
  }
  for (const [index, key] of profile.encounterEnvelopeKeys.entries()) {
    const encounter = encounterEnvelopes.byKey[key];
    if (usesOnlyEncounter && encounter?.slots.length !== 1) {
      fail(
        `${path}.encounterEnvelopeKeys[${index}]`,
        `${key} must expose exactly one slot for the only selector`,
      );
    }
    if (usesEncounterSequence && (encounter?.slots.length ?? 0) === 0) {
      fail(`${path}.encounterEnvelopeKeys[${index}]`, `${key} must expose encounter slots`);
    }
    if (
      usesRewardEncounterSequence &&
      !encounter?.slots.some((slot) => slot.rewardAttachment?.kind === 'rewardWheel')
    ) {
      fail(
        `${path}.encounterEnvelopeKeys[${index}]`,
        `${key} must expose a reward-wheel slot for runRewardEncounterSequence`,
      );
    }
  }
}

export function normalizeRoomLifecycleProfiles(
  rawProfiles: readonly RawRoomLifecycleProfileDeclaration[],
  encounterEnvelopes: CatalogCollection<EncounterEnvelope>,
  producerLifecycles: CatalogCollection<ProducerLifecycleProfileDeclaration>,
): CatalogCollection<RoomLifecycleProfile> {
  return createCollection(
    rawProfiles.map((raw, profileIndex): RoomLifecycleProfile => {
      const path = `roomLifecycleProfiles[${profileIndex}]`;
      const key = requireNonEmpty(raw.key, `${path}.key`);
      const encounterEnvelopeKeys = freezeUniqueStrings(
        raw.encounterEnvelopeKeys,
        `${path}.encounterEnvelopeKeys`,
      );
      if (encounterEnvelopeKeys.length === 0) {
        fail(`${path}.encounterEnvelopeKeys`, 'must not be empty');
      }
      for (const [index, encounterKey] of encounterEnvelopeKeys.entries()) {
        if (encounterEnvelopes.byKey[encounterKey] === undefined) {
          fail(
            `${path}.encounterEnvelopeKeys[${index}]`,
            `unknown encounter envelope ${encounterKey}`,
          );
        }
      }
      const producer = normalizeProducerPolicy(
        raw.producer,
        producerLifecycles,
        `${path}.producer`,
      );
      const operations = Object.freeze(
        raw.operations.map((operation, operationIndex) =>
          normalizeOperation(operation, `${path}.operations[${operationIndex}]`),
        ),
      );
      validateOperationSequence(operations, producer, `${path}.operations`);
      const profile = Object.freeze({ key, encounterEnvelopeKeys, producer, operations });
      validateEncounterCompatibility(profile, encounterEnvelopes, path);
      return profile;
    }),
    'roomLifecycleProfiles',
    (profile) => profile.key,
  );
}
