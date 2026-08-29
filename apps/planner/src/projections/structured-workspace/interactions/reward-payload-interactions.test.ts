import { describe, expect, it } from 'vitest';
import { decodeProjectDocument, encodeProjectDocument } from '@run-planner/engine/authored-project';

import * as support from '@planner-test/support/structured-workspace/interaction-binding.test-support';

const {
  bind,
  catalog,
  applyProjectCommand,
  createEncounterPhaseAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  createCompleteFGProject,
  loadSurfaceNOPQProject,
  nBiome,
  nLocalOccurrenceId,
  nOccurrenceId,
  oBiome,
  oOccurrenceIds,
  goldenGBiome,
  pBiome,
  pOccurrenceIds,
} = support;

describe('reward-payload-interactions', () => {
  it('binds all four reward owners to their exact no-focus replacement intents', () => {
    const project = loadSurfaceNOPQProject();
    const surfaceInteractions = {
      N: bind(project, 'Surface', 'N').interactions,
      O: bind(project, 'Surface', 'O').interactions,
      P: bind(project, 'Surface', 'P').interactions,
    };
    const replacement = { rewardType: 'MaxHealthDrop' } as const;
    const incoming = createIncomingRewardAddress(nBiome, nOccurrenceId('combat05'));
    const local = createIncomingRewardAddress(nBiome, nLocalOccurrenceId('combat05', 'sideDoor1'));
    const wheel = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat04,
      'wheel1',
      'offer1',
    );
    const shop = createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'Boon');

    expect(
      surfaceInteractions.N.rewards.get(semanticAddressKey(incoming))?.intentFor(replacement),
    ).toEqual({
      command: { kind: 'ReplaceIncomingReward', reward: incoming, value: replacement },
    });
    expect(
      surfaceInteractions.N.rewards.get(semanticAddressKey(local))?.intentFor(replacement),
    ).toEqual({
      command: { kind: 'ReplaceIncomingReward', reward: local, value: replacement },
    });
    expect(
      surfaceInteractions.O.rewards.get(semanticAddressKey(wheel))?.intentFor(replacement),
    ).toEqual({
      command: { kind: 'ReplaceRewardWheelOffer', offer: wheel, value: replacement },
    });
    expect(
      surfaceInteractions.P.rewards.get(semanticAddressKey(shop))?.intentFor(replacement),
    ).toEqual({
      command: { kind: 'ReplaceShopOffer', offer: shop, value: replacement },
    });
  });

  it('binds a picked Narcissus pickup payload to its entry replacement command', () => {
    let project = createCompleteFGProject();
    const occurrence = project.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find((candidate) => candidate.gameName === 'G_Story01');
    if (occurrence === undefined) throw new Error('Golden G has no Narcissus story');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createEncounterPhaseAddress(
          goldenGBiome,
          { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
          'Encounter',
        ),
        'selection',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Narcissus',
        options: [
          { traitKey: 'NarcissusI' },
          { traitKey: 'NarcissusB' },
          { traitKey: 'NarcissusC' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const current = project.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
      );
    const siteKey = Object.entries(current?.acquisitionSites ?? {}).find(([, state]) =>
      Object.hasOwn(state.pickupEntries ?? {}, 'mysteryBoon'),
    )?.[0];
    if (siteKey === undefined) throw new Error('Narcissus has no source-scoped mystery pickup');
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
      siteKey,
    );
    const entry = createAcquisitionEntryAddress(site, 'mysteryBoon');
    const interaction = bind(project, 'Underworld', 'G').interactions.rewards.get(
      semanticAddressKey(entry),
    );
    expect(
      interaction?.intentFor({
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      }),
    ).toEqual({
      command: {
        kind: 'ReplaceAcquisitionEntryOffer',
        entry,
        value: {
          rewardType: 'BlindBoxLoot',
          payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
        },
      },
    });
  });

  it('seeds an unresolved fixed Trial reward from its declaration-owned Devotion type', async () => {
    const raw = JSON.parse(encodeProjectDocument(loadSurfaceNOPQProject())) as {
      routes: Array<{
        routeKey: string;
        biomes: Array<{
          biomeKey: string;
          topology: {
            occurrences: Array<{
              occurrenceId: string;
              state: { kind: string; reward: unknown };
            }>;
          } | null;
        }>;
      }>;
    };
    const devotion = raw.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'O')
      ?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === oOccurrenceIds.devotion,
      );
    if (devotion?.state.kind !== 'fixed') throw new Error('O Trial fixture is missing');
    devotion.state.reward = null;
    const project = decodeProjectDocument(raw, catalog);
    const owner = createIncomingRewardAddress(oBiome, oOccurrenceIds.devotion);
    const interaction = bind(project, 'Surface', 'O').interactions.rewards.get(
      semanticAddressKey(owner),
    );
    if (interaction === undefined) throw new Error('O Trial reward interaction is missing');

    expect(interaction.authoredRewardTypes).toEqual(['Devotion']);
    const domain = await interaction.load();
    expect(domain.types).toContainEqual(expect.objectContaining({ key: 'Devotion' }));
    expect(
      interaction
        .model(domain, 'chosen', { rewardType: 'Devotion' })
        .sections.flatMap((section) => section.items),
    ).not.toHaveLength(0);
  });
});
