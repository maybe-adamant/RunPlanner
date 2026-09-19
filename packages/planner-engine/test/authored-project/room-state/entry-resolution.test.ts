import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createStartingRewardAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  resolveRoutePosition,
  resolveEntryDeclaration,
  resolveEntryRoom,
  routeStartIncomingReward,
} from '@run-planner/engine/authored-project';
import { selectedPickupProducers } from '../../../src/authored-project/acquisition/pickup-producers';

function room(gameName: string) {
  const declaration = catalog.rooms.byKey[gameName];
  if (declaration === undefined) throw new Error(`missing ${gameName}`);
  return declaration;
}

function dreamPosition(biomeKey: string, isFirst: boolean) {
  const otherBiome = biomeKey === 'F' ? 'G' : 'F';
  return resolveRoutePosition(
    catalog,
    {
      routeKey: 'Dream',
      itineraryBiomeKeys: isFirst ? [biomeKey, otherBiome] : [otherBiome, biomeKey],
    },
    biomeKey,
  );
}

describe('contextual entry resolution', () => {
  it('retains ordinary F encounter declarations outside their declared contextual rule', () => {
    const declaration = room('F_Opening01');
    const resolved = resolveEntryDeclaration(
      declaration,
      resolveRoutePosition(
        catalog,
        {
          routeKey: 'Underworld',
          itineraryBiomeKeys: ['F', 'G', 'H', 'I'],
        },
        'F',
      ),
    );

    expect(resolved).toEqual(declaration);
    expect(resolved.encounterSlotBindings[0]).toMatchObject({
      kind: 'fixed',
      encounterDefinitionKey: 'OpeningGeneratedF',
    });
  });

  it.each(['Underworld', 'Surface'])(
    'resolves every %s starting reward by route position',
    (routeKey) => {
      const route = catalog.routes.byKey[routeKey]!;
      for (const biomeKey of route.biomeKeys) {
        const gameName =
          biomeKey === 'F' ? 'F_Opening01' : biomeKey === 'N' ? 'N_Opening01' : `${biomeKey}_Intro`;
        const declaration = room(gameName);
        const resolved = resolveEntryDeclaration(
          declaration,
          resolveRoutePosition(
            catalog,
            {
              routeKey,
              itineraryBiomeKeys: route.biomeKeys,
            },
            biomeKey,
          ),
        );
        expect(resolved.incomingReward.kind).toBe('none');
        expect(resolved.encounterSlotBindings).toEqual(declaration.encounterSlotBindings);
        expect(catalog.runStartReward.incomingReward.kind).toBe('countedChoice');
      }
    },
  );

  it('applies the declarative Dream F/N encounter rule without restoring room profiles', () => {
    expect(resolveEntryDeclaration(room('F_Opening01'), dreamPosition('F', true))).toMatchObject({
      mode: { templateKey: 'FixedOpening' },
      incomingReward: { kind: 'none' },
      encounterSlotBindings: [{ encounterDefinitionKey: 'OpeningEmpty' }],
    });
    expect(resolveEntryDeclaration(room('F_Opening01'), dreamPosition('F', false))).toMatchObject({
      mode: { templateKey: 'FixedOpening' },
      incomingReward: { kind: 'none' },
      encounterSlotBindings: [{ encounterDefinitionKey: 'OpeningEmpty' }],
    });
    expect(resolveEntryDeclaration(room('N_Opening01'), dreamPosition('N', true))).toMatchObject({
      incomingReward: { kind: 'none' },
      enteredRewardStoreHistory: { kind: 'none' },
      encounterSlotBindings: [{ encounterDefinitionKey: 'OpeningEmpty' }],
    });
    expect(resolveEntryDeclaration(room('N_PreHub01'), dreamPosition('N', true))).toBe(
      room('N_PreHub01'),
    );
  });

  it('binds opening lifecycle/store authority only at a route-first entry', () => {
    expect(resolveEntryDeclaration(room('G_Intro'), dreamPosition('G', true))).toMatchObject({
      incomingReward: { kind: 'none' },
      enteredRewardStoreHistory: { kind: 'resolvedOffer' },
    });
    expect(
      resolveEntryRoom(catalog, room('G_Intro'), dreamPosition('G', true), true),
    ).toMatchObject({
      lifecycleProfileKey: 'OpeningRewardNoEncounterRoom',
      incomingRewardBinding: { kind: 'countedChoice' },
      incomingRewardStoreKey: 'RunProgress',
      enteredRewardStoreKey: 'RunProgress',
    });
    expect(resolveEntryDeclaration(room('P_Intro'), dreamPosition('P', true))).toMatchObject({
      encounterSlotBindings: [{ encounterDefinitionKey: 'PIntroDreamRunEmpty' }],
      enteredRewardStoreHistory: { kind: 'resolvedOffer' },
    });
    expect(
      resolveEntryRoom(catalog, room('N_Opening01'), dreamPosition('N', true), true),
    ).not.toHaveProperty('enteredRewardStoreKey');
    expect(
      resolveEntryRoom(catalog, room('G_Intro'), dreamPosition('G', false), true),
    ).toMatchObject({
      declaration: { enteredRewardStoreHistory: { kind: 'none' } },
    });
  });

  it('preserves the rewardless Dream-later profile when replacing F opening variants', () => {
    const biome = createBiomeAddress('Dream', 'F');
    const occurrenceId = createOccurrenceId('dream-later-f');
    let project = applyProjectCommand(
      createProjectDocument(catalog, {
        projectId: 'dream-later-f',
        routeKey: 'Dream',
        itineraryBiomeKeys: ['G', 'F'],
        configuredBiomeCount: 2,
      }),
      catalog,
      { kind: 'CreateStart', biome, occurrenceId, gameName: 'F_Opening01' },
    );
    for (const gameName of ['F_Opening02', 'F_Opening03', 'F_Opening01']) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(biome, occurrenceId),
        gameName,
      });
      expect(project.route.biomes[1]?.topology?.occurrences[0]).toMatchObject({
        occurrenceId,
        gameName,
        state: { kind: 'none' },
      });
      expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
        project,
      );
    }
  });

  it('reconciles and decodes Buried Treasure pickups from a Dream-first G reward', () => {
    const biome = createBiomeAddress('Dream', 'G');
    const occurrenceId = createOccurrenceId('G:start');
    const reward = createIncomingRewardAddress(biome, occurrenceId);
    let project = createProjectDocument(catalog, {
      projectId: 'dream-g-pickups',
      routeKey: 'Dream',
      itineraryBiomeKeys: ['G', 'F'],
      configuredBiomeCount: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Dream'),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(reward, 'source'),
      value: {
        kind: 'traits',
        giverKey: 'Poseidon',
        options: [
          { traitKey: 'RoomRewardBonusBoon', rarity: 'Common' },
          { traitKey: 'PoseidonWeaponBoon', rarity: 'Common' },
          { traitKey: 'PoseidonSpecialBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const occurrence = project.route.biomes[0]?.topology?.occurrences[0];
    if (occurrence === undefined) throw new Error('missing G start');
    const declaration = resolveEntryDeclaration(room('G_Intro'), dreamPosition('G', true));
    const producer = selectedPickupProducers(
      catalog,
      biome,
      occurrence,
      declaration,
      1,
      routeStartIncomingReward(project, dreamPosition('G', true), occurrence) ?? undefined,
    ).find((candidate) => candidate.traitKey === 'RoomRewardBonusBoon');
    if (producer === undefined) throw new Error('missing Buried Treasure producer');
    expect(producer.sourceAction).toMatchObject({
      kind: 'interactIncomingReward',
      producerPoint: 'roomRewardPickup',
      acquisitionRole: 'source',
    });
    expect(occurrence.roomActions.order).toContainEqual(producer.sourceAction);
    expect(occurrence.acquisitionSites?.[producer.siteKey]?.pickupEntries).toHaveProperty(
      'smallGold',
    );
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
  });
});
