import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createTraitOfferAddress,
  type AuthoredTraitOfferTraits,
  type OccurrenceId,
} from '../../../src/authored-project';
import type { RunRecord, RunRecordTraitChanges } from '../../../src/run-record';
import {
  latestModelHammerRows,
  type TraitCarrierChildDomainQuery,
} from '../../../src/simulation/candidates/trait-offer/query';
import { completeRecordedCarrierChildren } from '../../../src/simulation/run-import/carrier-children';
import type { RunImportContext } from '../../../src/simulation/run-import/import';

const HAMMERS = ['StaffDashAttackTrait', 'StaffOneWayAttackTrait', 'StaffExAoETrait'] as const;
const giverKey = catalog.traitGivers.values.find((giver) =>
  giver.traitKeys.includes('UpgradeHammerBoon'),
)!.key;
const trait = createTraitOfferAddress(
  createIncomingRewardAddress(createBiomeAddress('Surface', 'O'), 'O-r1' as OccurrenceId),
  'source',
);
const offer: AuthoredTraitOfferTraits = {
  kind: 'traits',
  giverKey,
  options: [{ traitKey: 'UpgradeHammerBoon' }],
  selectedOptionKey: 'option1',
};

/**
 * An import context whose engine admits every Hammer and requires two, so the
 * record's answer is judged alone; no other engine product is read.
 */
function contextFor(traits: RunRecordTraitChanges): RunImportContext {
  const evaluate = (query: TraitCarrierChildDomainQuery | { readonly kind: string }) => {
    if (query.kind === 'traitOffer')
      return { kind: 'traitOffer', result: { supported: true, findings: [] } };
    const { value, child } = query as TraitCarrierChildDomainQuery;
    if (child.kind !== 'latestModelTargets' || value.kind !== 'traits')
      return { kind: 'unavailable' };
    const targets = value.options[0]?.icarusHammerTargets ?? [];
    return {
      kind: 'latestModelTargetsDomain',
      result: {
        sourceTraitKey: 'UpgradeHammerBoon',
        requiredCount: 2,
        branchAgreement: true,
        candidates: HAMMERS.map((traitKey) => ({
          kind: 'traitAcquisitionTarget',
          result: { traitKey, supported: true, branchSupport: [true], findings: [] },
        })),
        rows: latestModelHammerRows(HAMMERS, 2, targets),
      },
    };
  };
  const record = { rooms: [{ traitScreens: [], traits }] } as unknown as RunRecord;
  return { catalog, record, candidates: () => ({ evaluate }) } as unknown as RunImportContext;
}

describe("run import of Latest Model's Hammers", () => {
  it('takes the Hammers its room upgraded at the pick, in record order', () => {
    const context = contextFor({
      acquired: [{ name: 'UpgradeHammerBoon', worldTime: 10 }],
      removed: [],
      upgraded: [
        { name: 'StaffOneWayAttackTrait', from: {}, to: { rarity: 'Legendary' }, worldTime: 3 },
        { name: 'StaffExAoETrait', from: {}, to: { rarity: 'Legendary' }, worldTime: 10 },
        { name: 'StaffDashAttackTrait', from: {}, to: { rarity: 'Legendary' }, worldTime: 10 },
      ],
    });
    const completed = completeRecordedCarrierChildren(context, trait, offer, 0);
    expect(completed.value.kind === 'traits' && completed.value.options[0]).toEqual({
      traitKey: 'UpgradeHammerBoon',
      icarusHammerTargets: ['StaffExAoETrait', 'StaffDashAttackTrait'],
    });
    expect(completed.reports).toEqual([]);
  });

  it("takes the engine's first Hammers, reported, when no Hammer rose at the pick", () => {
    const context = contextFor({
      acquired: [{ name: 'UpgradeHammerBoon', worldTime: 10 }],
      removed: [],
      upgraded: [],
    });
    const completed = completeRecordedCarrierChildren(context, trait, offer, 0);
    expect(completed.value.kind === 'traits' && completed.value.options[0]).toEqual({
      traitKey: 'UpgradeHammerBoon',
      icarusHammerTargets: ['StaffDashAttackTrait', 'StaffOneWayAttackTrait'],
    });
    expect(completed.reports).toEqual([
      expect.objectContaining({
        reason: 'notInRecord',
        address: expect.objectContaining({ kind: 'traitAcquisitionTarget' }),
      }),
    ]);
  });
});

describe("run import of Pom Pom Pom's target", () => {
  const echo: AuthoredTraitOfferTraits = {
    kind: 'traits',
    giverKey: catalog.traitGivers.values.find((giver) =>
      giver.traitKeys.includes('EchoDoubleLevelBoon'),
    )!.key,
    options: [{ traitKey: 'EchoDoubleLevelBoon' }],
    selectedOptionKey: 'option1',
  };

  /** An import context whose engine finds no boon to double, so only no target is possible. */
  function contextWithNoTarget(traits: RunRecordTraitChanges): RunImportContext {
    const evaluate = (query: { readonly kind: string }) =>
      query.kind === 'traitOffer'
        ? { kind: 'traitOffer', result: { supported: true, findings: [] } }
        : {
            kind: 'echoPomTargetDomain',
            result: {
              candidates: [
                { value: null, support: 'forced', branchSupport: [true], selected: false },
              ],
              emptyNoOpAllowed: true,
            },
          };
    const record = { rooms: [{ traitScreens: [], traits }] } as unknown as RunRecord;
    return { catalog, record, candidates: () => ({ evaluate }) } as unknown as RunImportContext;
  }

  it('takes no target when its room doubled no level and the engine allows none', () => {
    const context = contextWithNoTarget({
      acquired: [{ name: 'EchoDoubleLevelBoon', worldTime: 10 }],
      removed: [],
      upgraded: [],
    });
    const completed = completeRecordedCarrierChildren(context, trait, echo, 0);
    expect(completed.value.kind === 'traits' && completed.value.options[0]).toEqual({
      traitKey: 'EchoDoubleLevelBoon',
      echoPomTarget: null,
    });
    expect(completed.reports).toEqual([]);
  });
});
