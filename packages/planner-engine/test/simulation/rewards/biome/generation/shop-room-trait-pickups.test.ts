import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceId,
  createRoomActionAddress,
  createShopOfferAddress,
  createTraitOfferAddress,
  roomActionKey,
  traitGeneratedPickupSiteKey,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';

const shops = [
  { label: 'Preboss Shop', biomeKey: 'F', occurrenceId: 'golden-f-preboss-shop' },
  { label: 'World Shop room', biomeKey: 'G', occurrenceId: 'golden-g-b5-e1' },
] as const;

const producers = [
  {
    trait: 'RoomRewardBonusBoon',
    offer: { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
    role: 'source',
    giverKey: 'Poseidon',
    options: ['RoomRewardBonusBoon', 'PoseidonManaBoon', 'EncounterStartOffenseBuffBoon'],
    entryKey: 'smallGold',
    goldRewardType: 'RoomMoneySmallDrop',
  },
  {
    trait: 'MoneyMultiplierBoon',
    offer: { rewardType: 'ShopHermesUpgrade' },
    role: 'hermes',
    giverKey: 'Hermes',
    options: ['MoneyMultiplierBoon', 'DodgeChanceBoon', 'SlowProjectileBoon'],
    entryKey: 'quickBuckGold',
    goldRewardType: 'RoomMoneyDrop',
  },
] as const;

type Shop = (typeof shops)[number];

function shopOccurrence(project: ProjectDocument, shop: Shop) {
  const occurrence = project.route.biomes
    .find((biome) => biome.biomeKey === shop.biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shop.occurrenceId);
  if (occurrence?.state.kind !== 'shop') throw new Error(`missing ${shop.label}`);
  return occurrence;
}

/** The Shop buys the producing boon, then its Minor item. */
function shopWithProducer(shop: Shop, producer: (typeof producers)[number]) {
  const biome = createBiomeAddress('Underworld', shop.biomeKey);
  const id = createOccurrenceId(shop.occurrenceId);
  const boon = createShopOfferAddress(biome, id, 'Boon');
  let project = createGoldenFGHIProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: boon,
    value: producer.offer as ResolvedRewardOffer,
  });
  for (const offer of [boon, createShopOfferAddress(biome, id, 'Minor')])
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer,
      purchased: true,
    });
  const trait = createTraitOfferAddress(boon, producer.role);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait,
    value: {
      kind: 'traits',
      giverKey: producer.giverKey,
      options: [
        { traitKey: producer.options[0], rarity: 'Common' },
        { traitKey: producer.options[1], rarity: 'Common' },
        { traitKey: producer.options[2], rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
      rarificationActions: [],
    },
  });
  const pickup = {
    kind: 'interactAcquisitionEntry' as const,
    siteKey: traitGeneratedPickupSiteKey(trait, 'option1'),
    entryKey: producer.entryKey,
  };
  const place = (before: RoomActionReference | undefined) => {
    const order = shopOccurrence(project, shop).roomActions.order;
    const index =
      before === undefined
        ? order.length
        : order.findIndex((reference) => roomActionKey(reference) === roomActionKey(before));
    return applyProjectCommand(project, catalog, {
      kind: 'InsertRoomAction',
      action: createRoomActionAddress(biome, id, roomActionKey(pickup)),
      reference: pickup,
      index,
    });
  };
  return { project, place };
}

/** Each branch's settled acquisitions in the Shop room, as offer or entry key and reward type. */
function shopAcquisitions(project: ProjectDocument, shop: Shop) {
  const evaluated = simulateProject(catalog, project).route.biomes.find(
    (candidate) => candidate.biomeKey === shop.biomeKey,
  );
  if (evaluated?.authoring !== 'complete' || evaluated.validity !== 'valid')
    throw new Error(`${shop.biomeKey} did not evaluate validly`);
  expect(evaluated.rewards.branches.length).toBeGreaterThan(0);
  return evaluated.rewards.branches.map((branch) =>
    branch.events.flatMap((event) => {
      if (event.kind !== 'concreteAcquisition') return [];
      const origin = event.origin;
      if (origin.kind === 'shopOffer' && origin.occurrenceId === shop.occurrenceId)
        return [[origin.offerKey, event.source.offer.rewardType]];
      if (
        origin.kind === 'acquisitionEntry' &&
        origin.site.owner.kind === 'occurrence' &&
        origin.site.owner.occurrenceId === shop.occurrenceId
      )
        return [[origin.entryKey, event.source.offer.rewardType]];
      return [];
    }),
  );
}

describe('trait-generated pickups in a Shop room', () => {
  for (const shop of shops)
    for (const producer of producers)
      it(`settles ${producer.trait}'s gold in a ${shop.label} before or after a later purchase`, () => {
        const { project, place } = shopWithProducer(shop, producer);
        const minorOffer = shopOccurrence(project, shop).state;
        if (minorOffer.kind !== 'shop') throw new Error('expected Shop state');
        const boonPurchase = ['Boon', producer.offer.rewardType];
        const minorPurchase = ['Minor', minorOffer.shop?.offers.Minor?.reward?.offer.rewardType];
        const gold = [producer.entryKey, producer.goldRewardType];
        for (const order of shopAcquisitions(project, shop))
          expect(order).toEqual([boonPurchase, minorPurchase]);
        const minor = { kind: 'interactShopOffer' as const, offerKey: 'Minor' };
        for (const [before, expected] of [
          [minor, [boonPurchase, gold, minorPurchase]],
          [undefined, [boonPurchase, minorPurchase, gold]],
        ] as const)
          for (const order of shopAcquisitions(place(before), shop))
            expect(order).toEqual(expected);
      });
});
