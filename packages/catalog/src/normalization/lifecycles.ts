import type {
  CatalogCollection,
  EncounterProfile,
  RoomLifecycleEffectKind,
  RoomLifecycleOperation,
  RoomLifecycleProfile,
  RoomLifecycleProducerPolicy,
} from '@run-planner/core';
import type {
  ProducerLifecyclePointKey,
  ProducerLifecycleProfileDeclaration,
} from '@run-planner/core/reward-kernel';

import type { RawRoomLifecycleProfileDeclaration } from '../declarations';
import { createCollection, freezeUniqueStrings, requireNonEmpty } from './common';
import { fail } from './errors';

const effectKinds = {
  advanceEncounterDepth: true,
  advanceRoomCounters: true,
  recordAppearance: true,
  recordCommit: true,
  recordEncounterCompletion: true,
  recordEncounterStart: true,
  recordExit: true,
  recordOfferPoint: true,
  recordOutgoingGeneration: true,
  recordPreparation: true,
  recordProducerPoint: true,
  recordShopPurchases: true,
} as const satisfies Readonly<Record<RoomLifecycleEffectKind, true>>;

const producerLifecyclePoints = {
  afterCombat: true,
  afterUnwrap: true,
  beforeCombat: true,
  purchase: true,
  roomRewardPickup: true,
} as const satisfies Readonly<Record<ProducerLifecyclePointKey, true>>;

const expectedEffects = {
  prepareRoom: ['recordPreparation'],
  materializeOfferPoint: ['recordOfferPoint'],
  enterRoom: ['recordAppearance'],
  startEncounter: ['recordEncounterStart', 'advanceEncounterDepth'],
  completeEncounter: ['recordEncounterCompletion'],
  advanceProducer: ['recordProducerPoint'],
  generateOutgoingBatch: ['recordOutgoingGeneration'],
  applyShopPurchases: ['recordShopPurchases'],
  commitRoom: ['recordCommit', 'advanceRoomCounters'],
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
    case 'generateOutgoingBatch':
    case 'commitRoom':
    case 'exitRoom':
      return Object.freeze({
        kind: raw.kind,
        effects: normalizeEffects(raw.effects, raw.kind, `${path}.effects`),
      });
    case 'materializeOfferPoint':
    case 'applyShopPurchases':
      return Object.freeze({
        kind: raw.kind,
        offerPoint: requireNonEmpty(raw.offerPoint, `${path}.offerPoint`),
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
  const appliedOfferPoints = new Set<string>();
  let encounterActive = false;
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
    } else if (operation.kind === 'applyShopPurchases') {
      const materializedAt = materializedOfferPoints.get(operation.offerPoint);
      if (materializedAt === undefined || materializedAt >= index) {
        fail(`${path}[${index}].offerPoint`, `${operation.offerPoint} is not materialized earlier`);
      }
      if (appliedOfferPoints.has(operation.offerPoint)) {
        fail(
          `${path}[${index}].offerPoint`,
          `duplicates purchase application ${operation.offerPoint}`,
        );
      }
      appliedOfferPoints.add(operation.offerPoint);
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
    } else if (operation.kind === 'generateOutgoingBatch') {
      if (encounterActive) {
        fail(
          `${path}[${index}].kind`,
          'generateOutgoingBatch cannot interrupt an active encounter phase',
        );
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
}

function validateEncounterCompatibility(
  profile: RoomLifecycleProfile,
  encounterProfiles: CatalogCollection<EncounterProfile>,
  path: string,
): void {
  const usesOnlyEncounter = profile.operations.some(
    (operation) => operation.kind === 'startEncounter' || operation.kind === 'completeEncounter',
  );
  if (!usesOnlyEncounter) {
    return;
  }
  for (const [index, key] of profile.encounterProfileKeys.entries()) {
    const encounter = encounterProfiles.byKey[key];
    if (encounter?.phases.length !== 1) {
      fail(
        `${path}.encounterProfileKeys[${index}]`,
        `${key} must expose exactly one phase for the only selector`,
      );
    }
  }
}

export function normalizeRoomLifecycleProfiles(
  rawProfiles: readonly RawRoomLifecycleProfileDeclaration[],
  encounterProfiles: CatalogCollection<EncounterProfile>,
  producerLifecycles: CatalogCollection<ProducerLifecycleProfileDeclaration>,
): CatalogCollection<RoomLifecycleProfile> {
  return createCollection(
    rawProfiles.map((raw, profileIndex): RoomLifecycleProfile => {
      const path = `roomLifecycleProfiles[${profileIndex}]`;
      const key = requireNonEmpty(raw.key, `${path}.key`);
      const encounterProfileKeys = freezeUniqueStrings(
        raw.encounterProfileKeys,
        `${path}.encounterProfileKeys`,
      );
      if (encounterProfileKeys.length === 0) {
        fail(`${path}.encounterProfileKeys`, 'must not be empty');
      }
      for (const [index, encounterKey] of encounterProfileKeys.entries()) {
        if (encounterProfiles.byKey[encounterKey] === undefined) {
          fail(
            `${path}.encounterProfileKeys[${index}]`,
            `unknown encounter profile ${encounterKey}`,
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
      const profile = Object.freeze({ key, encounterProfileKeys, producer, operations });
      validateEncounterCompatibility(profile, encounterProfiles, path);
      return profile;
    }),
    'roomLifecycleProfiles',
    (profile) => profile.key,
  );
}
