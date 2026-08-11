import { resolveAcquisitionRole } from './history';
import type { LevelResolutionEffect, ResolvedRewardOffer, RewardKernelCatalog } from './model';

export type LevelResolutionEffectSource =
  | { readonly kind: 'producerLifecycle'; readonly key: string }
  | { readonly kind: 'shopProfile'; readonly key: string };

/** Resolves a universal acquisition effect plus any exact producer-local override. */
export function levelResolutionEffectFor(
  catalog: RewardKernelCatalog,
  offer: ResolvedRewardOffer,
  source: LevelResolutionEffectSource,
  role: string,
): LevelResolutionEffect | undefined {
  switch (source.kind) {
    case 'producerLifecycle': {
      const producer = catalog.producerLifecycles.byKey[source.key];
      const binding = producer?.rewardTypes.byKey[offer.rewardType]?.acquisitionLifecycle.find(
        (candidate) => candidate.role === role,
      );
      return binding === undefined
        ? undefined
        : (binding.levelResolutionEffect ??
            universalEffect(catalog, offer, role, binding.lifecyclePoint));
    }
    case 'shopProfile': {
      const shop = catalog.shops.byKey[source.key];
      if (shop === undefined) return undefined;
      const bindings = shop.groups.values.flatMap((group) =>
        group.options.values
          .filter((option) => option.defaultOffer.rewardType === offer.rewardType)
          .flatMap((option) =>
            option.acquisitionLifecycle.filter((binding) => binding.role === role),
          ),
      );
      if (bindings.length === 0) return undefined;
      const effects = bindings.map(
        (binding) =>
          binding.levelResolutionEffect ??
          universalEffect(catalog, offer, role, binding.lifecyclePoint),
      );
      const first = effects[0];
      if (effects.some((effect) => JSON.stringify(effect) !== JSON.stringify(first))) {
        throw new Error(`${source.key}.${offer.rewardType}.${role} has inconsistent Shop effects`);
      }
      return first;
    }
  }
}

function universalEffect(
  catalog: RewardKernelCatalog,
  offer: ResolvedRewardOffer,
  role: string,
  lifecyclePoint: import('./model').ProducerLifecyclePointKey,
): LevelResolutionEffect | undefined {
  try {
    return catalog.acquisitions.byKey[
      resolveAcquisitionRole(catalog, offer, role, lifecyclePoint).acquisition.gameName
    ]?.levelResolutionEffect;
  } catch {
    return undefined;
  }
}
