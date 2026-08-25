import { CatalogContractError } from '@run-planner/hades2-catalog';
import {
  createRewardKernelCatalog,
  rawInput,
  replaceRewardType,
  rewardKernelCatalog,
  rewardKernelDeclarations,
} from './support/reward-kernel';
import { describe, expect, it } from 'vitest';
import type { RawRewardKernelInput } from '@run-planner/hades2-catalog/test-support';

describe('reward-kernel compiler closure', () => {
  it('keeps the assembled reward kernel as one immutable compiler product', () => {
    expect(Object.keys(rewardKernelCatalog)).toEqual([
      'payloadDomains',
      'acquisitions',
      'rewardTypes',
      'stores',
      'shops',
      'producerLifecycles',
    ]);
    for (const product of Object.values(rewardKernelCatalog)) {
      expect(Object.isFrozen(product)).toBe(true);
    }
  });

  it('rejects every malformed closed semantic family at catalog construction', () => {
    const cases: readonly [string, RawRewardKernelInput][] = [
      [
        'payload domain kind',
        rawInput({
          ...rewardKernelDeclarations,
          payloadDomains: rewardKernelDeclarations.payloadDomains.map((domain) =>
            domain.key === 'BoonSource' ? { ...domain, kind: 'unknownDomain' } : domain,
          ),
        }),
      ],
      [
        'acquisition kind',
        rawInput({
          ...rewardKernelDeclarations,
          acquisitions: rewardKernelDeclarations.acquisitions.map((acquisition) =>
            acquisition.gameName === 'ApolloUpgrade'
              ? { ...acquisition, kind: 'unknownAcquisition' }
              : acquisition,
          ),
        }),
      ],
      [
        'history projection',
        rawInput({
          ...rewardKernelDeclarations,
          acquisitions: rewardKernelDeclarations.acquisitions.map((acquisition) =>
            acquisition.gameName === 'ApolloUpgrade'
              ? { ...acquisition, historyProjection: 'unknownProjection' }
              : acquisition,
          ),
        }),
      ],
      [
        'role resolution kind',
        replaceRewardType('Boon', (rewardType) => ({
          ...rewardType,
          acquisitionRoles: [{ key: 'source', resolution: { kind: 'unknownResolution' } }],
        })),
      ],
      [
        'payload source field',
        replaceRewardType('Boon', (rewardType) => ({
          ...rewardType,
          acquisitionRoles: [
            {
              key: 'source',
              resolution: {
                kind: 'payloadSource',
                acquisitionKind: 'loot',
                field: 'unknownField',
              },
            },
          ],
        })),
      ],
      [
        'source support policy',
        replaceRewardType('Boon', (rewardType) => ({
          ...rewardType,
          sourceSupport: 'unknownSupport',
        })),
      ],
      [
        'source resolution kind',
        replaceRewardType('RandomLoot', (rewardType) => ({
          ...rewardType,
          sourceResolution: { kind: 'unknownSourceResolution' },
        })),
      ],
      [
        'offer projection',
        replaceRewardType('Boon', (rewardType) => ({
          ...rewardType,
          offerProjection: 'unknownOfferProjection',
        })),
      ],
      [
        'producer lifecycle point',
        rawInput({
          ...rewardKernelDeclarations,
          shops: rewardKernelDeclarations.shops.map((shop) =>
            shop.key === 'WorldShop'
              ? {
                  ...shop,
                  groups: shop.groups.map((group) =>
                    group.key === 'Boon'
                      ? {
                          ...group,
                          options: group.options.map((option) =>
                            option.key === 'RandomLoot'
                              ? {
                                  ...option,
                                  acquisitionLifecycle: [
                                    { role: 'source', lifecyclePoint: 'unknownPoint' },
                                  ],
                                }
                              : option,
                          ),
                        }
                      : group,
                  ),
                }
              : shop,
          ),
        }),
      ],
    ];

    for (const [name, input] of cases) {
      expect(() => createRewardKernelCatalog(input), name).toThrow(CatalogContractError);
    }
  });
});
