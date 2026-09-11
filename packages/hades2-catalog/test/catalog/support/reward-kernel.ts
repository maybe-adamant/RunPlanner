import { ordinarySources, rewardKernelDeclarations } from '../../../src/declarations/rewards';
import type { RawRewardKernelInput } from '../../../src/declarations/rewards';
import { createRewardKernelCatalog } from '../../../src/compiler/rewards/normalize';

export { createRewardKernelCatalog, ordinarySources, rewardKernelDeclarations };
export const rewardKernelCatalog = createRewardKernelCatalog(rewardKernelDeclarations);

export function rawInput(value: unknown): RawRewardKernelInput {
  return value as RawRewardKernelInput;
}

export function replaceRewardType(
  gameName: string,
  replace: (rewardType: (typeof rewardKernelDeclarations.rewardTypes)[number]) => unknown,
): RawRewardKernelInput {
  return rawInput({
    ...rewardKernelDeclarations,
    rewardTypes: rewardKernelDeclarations.rewardTypes.map((rewardType) =>
      rewardType.gameName === gameName ? replace(rewardType) : rewardType,
    ),
  });
}

export function replaceShopOption(
  profileKey: string,
  optionKey: string,
  replace: (option: Record<string, unknown>) => unknown,
): RawRewardKernelInput {
  return rawInput({
    ...rewardKernelDeclarations,
    shops: rewardKernelDeclarations.shops.map((shop) =>
      shop.key !== profileKey
        ? shop
        : {
            ...shop,
            groups: shop.groups.map((group) => ({
              ...group,
              options: group.options.map((option) =>
                option.key === optionKey
                  ? replace(option as unknown as Record<string, unknown>)
                  : option,
              ),
            })),
          },
    ),
  });
}
