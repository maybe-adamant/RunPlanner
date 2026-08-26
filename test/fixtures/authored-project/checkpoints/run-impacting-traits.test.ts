import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  assembleRoomActionDomain,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createRoomActionAddress,
  createIncomingRewardAddress,
  createTraitOfferAddress,
  encodeProjectDocument,
  SEA_STAR_DUPLICATE_ENTRY_KEY,
  roomActionKey,
  seaStarDuplicateSiteKey,
  selectedPickupProducers,
} from '@run-planner/engine/authored-project';
import {
  blockedOccurrenceRoomForProjectEvaluationAssembly,
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  loadSurfaceNNaturalSelectionFrontierCheckpoint,
  loadSurfaceNBuriedTreasureCheckpoint,
  loadSurfaceNQuickBuckCheckpoint,
  loadSurfaceNQueensRansomCheckpoint,
  loadSurfaceNSteadyGrowthFrontierCheckpoint,
} from './surface';
import {
  createSurfaceNNaturalSelectionFrontier,
  createSurfaceNBuriedTreasureCheckpoint,
  createSurfaceNQuickBuckCheckpoint,
  createSurfaceNQueensRansomCheckpoint,
  createSurfaceNSteadyGrowthFrontier,
} from '../routes/run-impacting-traits';
import { nBiome } from '../routes/surface';
import { nOccurrenceIds } from '../routes/surface';

describe('run-impacting trait checkpoint recipes', () => {
  it('attests each saved checkpoint to its semantic-command recipe', () => {
    for (const [saved, built] of [
      [loadSurfaceNNaturalSelectionFrontierCheckpoint(), createSurfaceNNaturalSelectionFrontier()],
      [loadSurfaceNQuickBuckCheckpoint(), createSurfaceNQuickBuckCheckpoint()],
      [loadSurfaceNBuriedTreasureCheckpoint(), createSurfaceNBuriedTreasureCheckpoint()],
      [loadSurfaceNQueensRansomCheckpoint(), createSurfaceNQueensRansomCheckpoint()],
      [loadSurfaceNSteadyGrowthFrontierCheckpoint(), createSurfaceNSteadyGrowthFrontier()],
    ] as const) {
      expect(encodeProjectDocument(saved)).toBe(encodeProjectDocument(built));
    }
  });

  it('retains compact N Quick Buck and Buried Treasure pickup workflows at their source owners', () => {
    const generatedEntries = (project: ReturnType<typeof createSurfaceNQuickBuckCheckpoint>) =>
      project.routes
        .find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'N')
        ?.topology?.occurrences.flatMap((occurrence) =>
          Object.entries(occurrence.acquisitionSites ?? {}).flatMap(([siteKey, site]) =>
            siteKey.startsWith('traitGenerated:')
              ? [[occurrence.occurrenceId, Object.keys(site.pickupEntries ?? {})] as const]
              : [],
          ),
        ) ?? [];
    expect(generatedEntries(createSurfaceNQuickBuckCheckpoint())).toEqual([
      ['surface-n-opening', ['quickBuckGold']],
    ]);
    expect(generatedEntries(createSurfaceNBuriedTreasureCheckpoint())).toEqual([
      [
        'surface-n-prehub',
        ['smallGold', 'tinyGold1', 'tinyGold2', 'minorHeal1', 'minorHeal2', 'bones'],
      ],
    ]);
    const producerPlacement = (project: ReturnType<typeof createSurfaceNQuickBuckCheckpoint>) => {
      const occurrence = project.routes
        .find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'N')
        ?.topology?.occurrences.find((candidate) => candidate.acquisitionSites !== undefined);
      if (occurrence === undefined) throw new Error('Generated-pickup source owner is missing');
      return selectedPickupProducers(catalog, nBiome, occurrence)[0]?.placement;
    };
    expect(producerPlacement(createSurfaceNQuickBuckCheckpoint())).toBe('afterSource');
    expect(producerPlacement(createSurfaceNBuriedTreasureCheckpoint())).toBe('afterSource');
  });

  it("keeps Sea Star's retained Buried Treasure resource in the source action window", () => {
    const opening = createIncomingRewardAddress(nBiome, nOccurrenceIds.opening);
    let project = applyProjectCommand(createSurfaceNBuriedTreasureCheckpoint(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: opening,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(opening, 'source'),
      value: {
        kind: 'traits',
        giverKey: 'Poseidon',
        options: [
          { traitKey: 'DoubleRewardBoon', rarity: 'Common' },
          { traitKey: 'PoseidonWeaponBoon', rarity: 'Common' },
          { traitKey: 'PoseidonSpecialBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const occurrence = () =>
      project.routes
        .find((route) => route.routeKey === 'Surface')!
        .biomes.find((biome) => biome.biomeKey === 'N')!
        .topology!.occurrences.find(
          (candidate) => candidate.occurrenceId === nOccurrenceIds.preHub,
        )!;
    const [siteKey] =
      Object.entries(occurrence().acquisitionSites ?? {}).find(([, site]) =>
        Object.hasOwn(site.pickupEntries ?? {}, 'smallGold'),
      ) ?? [];
    if (siteKey === undefined) throw new Error('Buried Treasure small Gold entry is missing');
    const source = createAcquisitionRoleAddress(
      createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(
          createOccurrenceAddress(nBiome, nOccurrenceIds.preHub),
          siteKey,
        ),
        'smallGold',
      ),
      'self',
    );
    const sourceReference = Object.freeze({
      kind: 'interactAcquisitionEntry' as const,
      siteKey,
      entryKey: 'smallGold',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'InsertRoomAction',
      action: createRoomActionAddress(
        nBiome,
        nOccurrenceIds.preHub,
        roomActionKey(sourceReference),
      ),
      reference: sourceReference,
      index: occurrence().roomActions.order.length,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSeaStarResult',
      acquisition: source,
      procced: true,
    });
    const duplicateSite = seaStarDuplicateSiteKey(source);
    expect(occurrence().acquisitionSites?.[duplicateSite]?.pickupEntries).toHaveProperty(
      SEA_STAR_DUPLICATE_ENTRY_KEY,
    );
    const domain = assembleRoomActionDomain({ catalog, biome: nBiome, occurrence: occurrence() });
    const sourceAction = domain.contributions.find(
      (entry) =>
        entry.kind === 'action' &&
        entry.reference.kind === 'interactAcquisitionEntry' &&
        entry.reference.siteKey === siteKey &&
        entry.reference.entryKey === 'smallGold',
    );
    const childAction = domain.contributions.find(
      (entry) =>
        entry.kind === 'action' &&
        entry.reference.kind === 'interactAcquisitionEntry' &&
        entry.reference.siteKey === duplicateSite,
    );
    expect(childAction).toMatchObject({
      kind: 'action',
      participation: sourceAction?.kind === 'action' ? sourceAction.participation : undefined,
      window: sourceAction?.kind === 'action' ? sourceAction.window : undefined,
      dependencies: [
        {
          kind: 'afterAction',
          action: sourceAction?.kind === 'action' ? sourceAction.reference : undefined,
        },
      ],
    });
  });

  it('reaches a selected Natural Selection child as the exact repair frontier', () => {
    const assembly = simulateProjectAssembly(catalog, createSurfaceNNaturalSelectionFrontier());
    const finding = assembly.evaluation.findings.find(
      (candidate) => candidate.code === 'naturalSelectionResultMissing',
    );
    expect(finding?.origin).toMatchObject({
      kind: 'naturalSelectionResult',
      optionKey: 'option1',
      trait: { owner: { occurrenceId: 'surface-n-miniBoss01' } },
    });
  });

  it("settles Queen's Ransom and continues through the complete N route", () => {
    const assembly = simulateProjectAssembly(catalog, createSurfaceNQueensRansomCheckpoint());
    expect(assembly.evaluation.findings).toEqual([]);
    const histories = assembly.evaluation.routes.flatMap((route) =>
      route.biomes.flatMap((biome) =>
        'rewards' in biome
          ? biome.rewards.branches.flatMap((branch) => branch.traitHistory ?? [])
          : [],
      ),
    );
    expect(
      histories.some((history) => {
        const removals = history.events.filter((event) => event.kind === 'traitRemoval');
        const mutations = history.events.filter((event) => event.kind === 'levelMutation');
        return (
          removals.some((event) => event.traitKey === 'ZeusWeaponBoon') &&
          removals.some((event) => event.traitKey === 'ZeusCastBoon') &&
          mutations.some(
            (event) =>
              event.targetTraitKey === 'HeraSpecialBoon' &&
              event.oldLevel === 1 &&
              event.newLevel === 9,
          )
        );
      }),
    ).toBe(true);
  });

  it('reaches the first Epic Steady Growth threshold at its next real N owner', () => {
    const assembly = simulateProjectAssembly(catalog, createSurfaceNSteadyGrowthFrontier());
    const findings = assembly.evaluation.findings.filter(
      (candidate) => candidate.code === 'steadyGrowthOutcomeMissing',
    );
    const histories = assembly.evaluation.routes.flatMap((route) =>
      route.biomes.flatMap((biome) =>
        'rewards' in biome
          ? biome.rewards.branches.flatMap((branch) => branch.traitHistory ?? [])
          : [],
      ),
    );
    expect(histories).toHaveLength(1);
    expect(findings).toHaveLength(1);
    const outcome = findings[0]?.origin;
    expect(outcome).toMatchObject({
      kind: 'steadyGrowthOutcome',
      owner: { kind: 'occurrence', occurrenceId: 'surface-n-combat11' },
      phaseKey: 'Encounter',
    });
    if (outcome?.kind !== 'steadyGrowthOutcome') throw new Error('Steady outcome is missing');
    expect(
      createPreparedProjectCandidateSession(catalog, assembly).evaluate({
        kind: 'steadyGrowthOutcome',
        outcome,
        targetTraitKey: undefined,
      }),
    ).toMatchObject({ kind: 'steadyGrowthOutcome' });
    expect(
      blockedOccurrenceRoomForProjectEvaluationAssembly(
        assembly,
        createOccurrenceAddress(
          { kind: 'biome', routeKey: 'Surface', biomeKey: 'N' },
          createOccurrenceId('surface-n-combat11'),
        ),
      )?.origin,
    ).toMatchObject({ kind: 'occurrence', occurrenceId: 'surface-n-combat11' });
  });
});
