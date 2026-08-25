import type { CatalogCollection } from '@run-planner/engine/catalog-schema';
import type {
  AcquisitionLifecycleBinding,
  ProducerLifecyclePointKey,
  ProducerLifecycleProfileDeclaration,
  ProducerRewardLifecycleDeclaration,
  RewardTypeDeclaration,
} from '@run-planner/engine/reward-kernel';

import { createCollection, requireNonEmpty } from '../common';
import { fail } from '../errors';
import type { RawRewardKernelInput } from '../../declarations/rewards/types';

const PRODUCER_LIFECYCLE_POINTS = [
  'afterCombat',
  'afterUnwrap',
  'beforeCombat',
  'echoReplay',
  'purchase',
  'roomRewardPickup',
  'roomExit',
] as const;
const LEVEL_RESOLUTION_EFFECT_KINDS = [
  'visibleChoice',
  'randomTarget',
  'randomTargetIfAvailable',
] as const;

function requireClosedValue<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  path: string,
): Values[number] {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    fail(path, `must be one of ${values.join(', ')}`);
  }
  return value as Values[number];
}

export function normalizeAcquisitionLifecycle(
  raw: readonly AcquisitionLifecycleBinding[] | undefined,
  rewardType: RewardTypeDeclaration,
  defaultLifecyclePoint: ProducerLifecyclePointKey,
  path: string,
): readonly AcquisitionLifecycleBinding[] {
  const rawLifecycle: readonly AcquisitionLifecycleBinding[] =
    raw ??
    rewardType.acquisitionRoles.values.map((role) => ({
      role: role.key,
      lifecyclePoint: defaultLifecyclePoint,
    }));
  const seenRoles = new Set<string>();
  const acquisitionLifecycle = rawLifecycle.map((binding, index) => {
    const bindingPath = `${path}.acquisitionLifecycle[${index}]`;
    requireNonEmpty(binding.role, `${bindingPath}.role`);
    if (seenRoles.has(binding.role)) {
      fail(`${bindingPath}.role`, `duplicates ${binding.role}`);
    }
    if (rewardType.acquisitionRoles.byKey[binding.role] === undefined) {
      fail(`${bindingPath}.role`, `unknown acquisition role ${binding.role}`);
    }
    seenRoles.add(binding.role);
    const effect = binding.levelResolutionEffect;
    if (
      binding.blocksArtificerConversion !== undefined &&
      binding.blocksArtificerConversion !== true
    ) {
      fail(`${bindingPath}.blocksArtificerConversion`, 'must be true when present');
    }
    if (effect !== undefined) {
      requireClosedValue(
        effect.kind,
        LEVEL_RESOLUTION_EFFECT_KINDS,
        `${bindingPath}.levelResolutionEffect.kind`,
      );
      if (effect.levelCount !== 1 && effect.levelCount !== 2 && effect.levelCount !== 3) {
        fail(`${bindingPath}.levelResolutionEffect.levelCount`, 'must be 1, 2, or 3');
      }
      if (effect.kind !== 'visibleChoice' && effect.levelCount !== 1) {
        fail(`${bindingPath}.levelResolutionEffect.levelCount`, 'random level effects require 1');
      }
    }
    return Object.freeze({
      role: binding.role,
      lifecyclePoint: requireClosedValue(
        binding.lifecyclePoint,
        PRODUCER_LIFECYCLE_POINTS,
        `${bindingPath}.lifecyclePoint`,
      ),
      ...(effect === undefined ? {} : { levelResolutionEffect: Object.freeze({ ...effect }) }),
      ...(binding.blocksArtificerConversion === true
        ? { blocksArtificerConversion: true as const }
        : {}),
    });
  });
  if (seenRoles.size !== rewardType.acquisitionRoles.values.length) {
    fail(`${path}.acquisitionLifecycle`, 'must bind every reward acquisition role exactly once');
  }
  return Object.freeze(acquisitionLifecycle);
}

export function normalizeProducerLifecycles(
  raw: RawRewardKernelInput['producerLifecycles'],
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
): CatalogCollection<ProducerLifecycleProfileDeclaration> {
  return createCollection(
    raw.map((profile, profileIndex): ProducerLifecycleProfileDeclaration => {
      const path = `producerLifecycles[${profileIndex}]`;
      const key = requireNonEmpty(profile.key, `${path}.key`);
      const defaultLifecyclePoint = requireClosedValue(
        profile.defaultLifecyclePoint,
        PRODUCER_LIFECYCLE_POINTS,
        `${path}.defaultLifecyclePoint`,
      );
      if (profile.rewardTypes.length === 0) {
        fail(`${path}.rewardTypes`, 'must not be empty');
      }
      const supportedRewardTypes = profile.rewardTypes.map((rewardTypeName, rewardTypeIndex) => {
        const rewardTypePath = `${path}.rewardTypes[${rewardTypeIndex}]`;
        const normalizedName = requireNonEmpty(rewardTypeName, rewardTypePath);
        const rewardType = rewardTypes.byKey[normalizedName];
        if (rewardType === undefined) {
          fail(rewardTypePath, `unknown reward type ${normalizedName}`);
        }
        return rewardType;
      });
      if (
        new Set(supportedRewardTypes.map((rewardType) => rewardType.gameName)).size !==
        supportedRewardTypes.length
      ) {
        fail(`${path}.rewardTypes`, 'must be unique');
      }
      const supportedNames = new Set(supportedRewardTypes.map((rewardType) => rewardType.gameName));
      const overrides = new Map<string, readonly AcquisitionLifecycleBinding[]>();
      for (const [overrideIndex, override] of (profile.overrides ?? []).entries()) {
        const overridePath = `${path}.overrides[${overrideIndex}]`;
        const rewardTypeName = requireNonEmpty(override.rewardType, `${overridePath}.rewardType`);
        const rewardType = rewardTypes.byKey[rewardTypeName];
        if (rewardType === undefined) {
          fail(`${overridePath}.rewardType`, `unknown reward type ${rewardTypeName}`);
        }
        if (!supportedNames.has(rewardTypeName)) {
          fail(`${overridePath}.rewardType`, `${rewardTypeName} is not supported by ${key}`);
        }
        if (overrides.has(rewardTypeName)) {
          fail(`${overridePath}.rewardType`, `duplicates ${rewardTypeName}`);
        }
        overrides.set(
          rewardTypeName,
          normalizeAcquisitionLifecycle(
            override.acquisitionLifecycle,
            rewardType,
            defaultLifecyclePoint,
            overridePath,
          ),
        );
      }
      const normalizedRewardTypes = createCollection(
        supportedRewardTypes.map((rewardType): ProducerRewardLifecycleDeclaration =>
          Object.freeze({
            rewardType: rewardType.gameName,
            acquisitionLifecycle:
              overrides.get(rewardType.gameName) ??
              normalizeAcquisitionLifecycle(
                undefined,
                rewardType,
                defaultLifecyclePoint,
                `${path}.rewardTypes.${rewardType.gameName}`,
              ),
          }),
        ),
        `${path}.rewardTypes`,
        (rewardType) => rewardType.rewardType,
        'rewardType',
      );
      return Object.freeze({ key, rewardTypes: normalizedRewardTypes });
    }),
    'producerLifecycles',
    (profile) => profile.key,
  );
}
