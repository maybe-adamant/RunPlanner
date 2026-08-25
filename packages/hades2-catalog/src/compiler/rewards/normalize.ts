import type { RewardKernelCatalog } from '@run-planner/engine/reward-kernel';

import { fail } from '../errors';
import type { RawRewardKernelInput } from '../../declarations/rewards/types';
import {
  normalizeAcquisitions,
  normalizePayloadDomains,
  normalizeRewardTypes,
} from './declarations';
import { normalizeProducerLifecycles } from './lifecycles';
import { normalizeStores } from './requirements';
import { normalizeShops } from './shops';

/**
 * The reward compiler assembly is intentionally the only supported producer of
 * the complete immutable reward-kernel catalog. The family normalizers are
 * compiler-private and receive the products they need explicitly.
 */
export function createRewardKernelCatalog(input: RawRewardKernelInput): RewardKernelCatalog {
  const payloadDomains = normalizePayloadDomains(input.payloadDomains);
  const acquisitions = normalizeAcquisitions(input.acquisitions);
  const rewardTypes = normalizeRewardTypes(input.rewardTypes, payloadDomains, acquisitions);
  const stores = normalizeStores(input.stores, rewardTypes);
  const shops = normalizeShops(input.shops, rewardTypes);
  const producerLifecycles = normalizeProducerLifecycles(input.producerLifecycles, rewardTypes);

  const echoLastRewardProfile = producerLifecycles.byKey.EchoLastReward;
  const recreationRewardTypes = acquisitions.values.flatMap((acquisition) =>
    acquisition.lastRewardRecreation === undefined
      ? []
      : [acquisition.lastRewardRecreation.offer.rewardType],
  );
  if (
    echoLastRewardProfile === undefined ||
    echoLastRewardProfile.rewardTypes.values.length !== recreationRewardTypes.length ||
    echoLastRewardProfile.rewardTypes.values.some(
      (entry) => !recreationRewardTypes.includes(entry.rewardType),
    )
  ) {
    fail(
      'producerLifecycles.EchoLastReward',
      'must support the exact Echo last-reward recreation set',
    );
  }
  for (const entry of echoLastRewardProfile.rewardTypes.values) {
    const lifecycle = entry.acquisitionLifecycle;
    const binding = lifecycle[0];
    if (
      lifecycle.length !== 1 ||
      binding?.role !== 'self' ||
      binding.lifecyclePoint !== 'echoReplay' ||
      binding.blocksArtificerConversion !== true
    ) {
      fail(
        `producerLifecycles.EchoLastReward.${entry.rewardType}`,
        'must bind exactly self at echoReplay and block Artificer conversion',
      );
    }
    const effect = binding.levelResolutionEffect;
    if (entry.rewardType === 'GiftDrop') {
      if (effect?.kind !== 'randomTargetIfAvailable' || effect.levelCount !== 1) {
        fail(
          'producerLifecycles.EchoLastReward.GiftDrop',
          'must apply randomTargetIfAvailable levelCount 1',
        );
      }
    } else if (effect !== undefined) {
      fail(
        `producerLifecycles.EchoLastReward.${entry.rewardType}`,
        'must not apply a level-resolution effect',
      );
    }
  }
  for (const acquisition of acquisitions.values) {
    const recreation = acquisition.lastRewardRecreation;
    if (recreation === undefined) continue;
    const rewardType = rewardTypes.byKey[recreation.offer.rewardType];
    const lifecycle = producerLifecycles.byKey[recreation.producerLifecycleKey];
    if (rewardType === undefined) {
      fail(
        `acquisitions.${acquisition.gameName}.lastRewardRecreation.offer.rewardType`,
        `unknown reward type ${recreation.offer.rewardType}`,
      );
    }
    if (lifecycle?.rewardTypes.byKey[recreation.offer.rewardType] === undefined) {
      fail(
        `acquisitions.${acquisition.gameName}.lastRewardRecreation`,
        `${recreation.offer.rewardType} is not supported by ${recreation.producerLifecycleKey}`,
      );
    }
    if (
      rewardType?.gameName !== acquisition.gameName ||
      rewardType.acquisitionRoles.values.length !== 1 ||
      rewardType.acquisitionRoles.values[0]?.key !== 'self' ||
      rewardType.acquisitionRoles.values[0].resolution.kind !== 'self' ||
      rewardType.acquisitionRoles.values[0].resolution.acquisitionKind !== acquisition.kind
    ) {
      fail(
        `acquisitions.${acquisition.gameName}.lastRewardRecreation.offer`,
        'must recreate the exact self acquisition source',
      );
    }
  }
  return Object.freeze({
    payloadDomains,
    acquisitions,
    rewardTypes,
    stores,
    shops,
    producerLifecycles,
  });
}
