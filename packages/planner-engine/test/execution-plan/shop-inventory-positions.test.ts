import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { catalogWithEmptyShopGroup, clearTestShopOffer } from '@run-planner/test-fixtures/shared';
import { loadUnderworldFGHICheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  createShopOfferAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '../../src/authored-project';
import type { Catalog } from '../../src/catalog-schema';
import {
  createPreparedProjectCandidateSession,
  shopOfferAssessmentForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '../../src/simulation';
import { assembleExecutionProduct } from '../../src/execution-plan/assembler';
import { compileExecutionPlan } from '../../src/execution-plan/compiler';
import {
  emptyShopGroupCatalog,
  emptyShopGroupOccurrence,
  emptyShopGroupProject,
} from './support/empty-shop-group-fixture';

const shopOffer = (slotKey: string) =>
  createShopOfferAddress(
    { kind: 'biome', routeKey: 'Underworld', biomeKey: 'I' },
    emptyShopGroupOccurrence.occurrenceId,
    slotKey,
  );

function evaluate(testCatalog: Catalog, project: ProjectDocument) {
  const assembly = simulateProjectAssembly(testCatalog, project);
  const biome = assembly.evaluation.route.biomes.find((candidate) => candidate.biomeKey === 'I');
  return {
    assembly,
    status: assembly.evaluation.status,
    findings: biome?.findings ?? [],
    assessment: (slotKey: string) =>
      shopOfferAssessmentForProjectEvaluationAssembly(assembly, shopOffer(slotKey)),
  };
}

function publishedShop(testCatalog: Catalog, project: ProjectDocument) {
  const { assembly } = evaluate(testCatalog, project);
  const plan = compileExecutionPlan({
    product: assembleExecutionProduct({ assembly, catalog: testCatalog }),
  });
  const occurrence = plan.occurrences.find(
    (candidate) => candidate.id === emptyShopGroupOccurrence.occurrenceId,
  );
  if (occurrence?.overview.shop === undefined) throw new Error('I Shop was not published');
  return { occurrence, shop: occurrence.overview.shop };
}

const rows = (shop: ReturnType<typeof publishedShop>['shop']) =>
  shop.offers.map((offer) => [offer.offerKey, offer.profileSlotIndex]);

describe('Shop inventory with validly empty groups', () => {
  it('publishes the mature five-item I Shop at its declared positions', () => {
    const { shop } = publishedShop(catalog, loadUnderworldFGHICheckpoint());
    expect(rows(shop)).toEqual([
      ['BoostedBoon', 0],
      ['MixedProgress', 1],
      ['Survival', 2],
      ['PremiumProgress', 3],
      ['MetaProgress', 4],
    ]);
  });

  it('keeps five declared slots but emits four items when the trailing group is empty', () => {
    const testCatalog = catalogWithEmptyShopGroup(catalog, 'I_PreBoss02', 'MetaProgress');
    const project = clearTestShopOffer(
      loadUnderworldFGHICheckpoint(),
      emptyShopGroupOccurrence,
      'MetaProgress',
    );
    const result = evaluate(testCatalog, project);
    expect(result.status).toBe('valid');
    expect(result.assessment('MetaProgress')).toBe('validEmpty');
    expect(result.assessment('PremiumProgress')).toBe('complete');
    const { shop } = publishedShop(testCatalog, project);
    expect(rows(shop)).toEqual([
      ['BoostedBoon', 0],
      ['MixedProgress', 1],
      ['Survival', 2],
      ['PremiumProgress', 3],
    ]);
  });

  it('binds a purchase past an empty middle group to its compact native position', () => {
    const result = evaluate(emptyShopGroupCatalog(), emptyShopGroupProject());
    expect(result.status).toBe('valid');
    expect(result.assessment('Survival')).toBe('validEmpty');
    const { occurrence, shop } = publishedShop(emptyShopGroupCatalog(), emptyShopGroupProject());
    expect(rows(shop)).toEqual([
      ['BoostedBoon', 0],
      ['MixedProgress', 1],
      ['PremiumProgress', 3],
      ['MetaProgress', 4],
    ]);
    const purchased = shop.offers.findIndex((offer) => offer.transactionOwner !== undefined);
    expect(purchased).toBe(2);
    expect(shop.offers[purchased]?.offerKey).toBe('PremiumProgress');
    expect(occurrence.timeline.transactions.map((transaction) => transaction.owner)).toContain(
      shop.offers[purchased]?.transactionOwner,
    );
  });

  it('keeps an unset slot of an eligible group incomplete beside a validly empty one', () => {
    const project = clearTestShopOffer(
      emptyShopGroupProject(),
      emptyShopGroupOccurrence,
      'MetaProgress',
    );
    const result = evaluate(emptyShopGroupCatalog(), project);
    expect(result.status).toBe('incomplete');
    expect(result.assessment('Survival')).toBe('validEmpty');
    expect(result.assessment('MetaProgress')).toBe('incomplete');
    expect(
      result.findings
        .filter((finding) => finding.code === 'rewardMissing')
        .map((finding) => semanticAddressKey(finding.origin)),
    ).toEqual([semanticAddressKey(shopOffer('MetaProgress'))]);
  });

  it('retains a selected item in an empty group as an invalid repair owner', () => {
    const result = evaluate(emptyShopGroupCatalog(), loadUnderworldFGHICheckpoint());
    expect(result.status).toBe('invalid');
    expect(result.assessment('Survival')).toBe('selectedInvalid');
    expect(
      result.findings
        .filter((finding) => finding.code === 'shopOfferUnavailable')
        .map((finding) => semanticAddressKey(finding.origin)),
    ).toEqual([semanticAddressKey(shopOffer('Survival'))]);
  });

  it('completes the empty group as absent when assessing exact alternative items', () => {
    const { assembly } = evaluate(emptyShopGroupCatalog(), emptyShopGroupProject());
    const session = createPreparedProjectCandidateSession(emptyShopGroupCatalog(), assembly);
    expect(
      session.evaluate({
        kind: 'shopOfferOption',
        offer: shopOffer('MetaProgress'),
        value: {
          optionKey: 'WeaponPointsRareDrop',
          offer: { rewardType: 'WeaponPointsRareDrop' },
        },
      }),
    ).toMatchObject({ kind: 'shopOffer', result: { supported: true } });
    expect(
      session.evaluate({
        kind: 'shopOfferOption',
        offer: shopOffer('Survival'),
        value: { optionKey: 'HealBigDrop', offer: { rewardType: 'HealBigDrop' } },
      }),
    ).toMatchObject({ kind: 'shopOffer', result: { supported: false } });
  });
});
