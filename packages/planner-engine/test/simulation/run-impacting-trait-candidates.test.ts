import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createNaturalSelectionResultAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectHistory,
  createSteadyGrowthOutcomeAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type AuthoredTraitOffer,
  type AuthoredTraitOption,
  type BiomeAddress,
  type SteadyGrowthOutcomeAddress,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';
import {
  foldTraitHistoryEvents,
  type NaturalSelectionResultCandidateQuery,
  type TraitOfferEvent,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createTraitOfferCandidateArtifacts } from '../../src/simulation/candidates/trait-offer-capability';
import { createSteadyGrowthCandidateArtifacts } from '../../src/simulation/candidate-artifacts';
import { evaluateSteadyGrowthOutcomeCandidate } from '../../src/simulation/candidates/steady-growth';
import { evaluateNaturalSelectionResultCandidate } from '../../src/simulation/candidates/trait-offer';
import { loadSurfaceNOProject } from '@run-planner/test-fixtures/surface';
import {
  createFGenerationProject,
  fGenerationBiome,
  fGenerationOccurrenceId,
} from './support/f-generation-project';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';

const owner = { kind: 'project' } as const;

function historyWithCoreTrait(traitKey: 'ApolloWeaponBoon' | 'HestiaWeaponBoon') {
  const giverKey = traitKey.startsWith('Apollo') ? 'Apollo' : 'Hestia';
  return foldTraitHistoryEvents(catalog, [
    {
      kind: 'traitOffer',
      owner,
      acquisitionRole: 'seed',
      sequence: 1,
      giverKey,
      options: Object.freeze([
        { traitKey, rarity: 'Common' },
        {
          traitKey: giverKey === 'Apollo' ? 'ApolloSpecialBoon' : 'HestiaSpecialBoon',
          rarity: 'Common',
        },
        { traitKey: giverKey === 'Apollo' ? 'ApolloCastBoon' : 'HestiaCastBoon', rarity: 'Common' },
      ]) as TraitOfferEvent['options'],
      selectedOptionKey: 'option1',
      acquisitionPoint: 'seed',
    },
  ]);
}

function selectedNaturalOffer(): Extract<AuthoredTraitOffer, { readonly kind: 'traits' }> {
  const options = Object.freeze([
    { traitKey: 'GoodStuffBoon', rarity: 'Duo' },
    { traitKey: 'DemeterSpecialBoon', rarity: 'Epic' },
    { traitKey: 'ReserveManaHitShieldBoon', rarity: 'Epic' },
  ] satisfies Extract<AuthoredTraitOffer, { readonly kind: 'traits' }>['options']);
  return Object.freeze({
    kind: 'traits',
    giverKey: 'Demeter',
    options,
    selectedOptionKey: 'option1',
  });
}

function bossCompletionOwner(biome: BiomeAddress): SteadyGrowthOutcomeAddress['owner'] {
  return createOccurrenceAddress(
    biome,
    createOccurrenceId(`surface-${biome.biomeKey.toLowerCase()}-preboss:boss`),
  );
}

function cycleEight(
  traitKeys: readonly string[],
): NonNullable<AuthoredTraitOption['naturalSelectionTargets']> {
  const first = traitKeys[0];
  if (first === undefined) throw new Error('Natural Selection requires a nonempty target domain');
  return Object.freeze([
    first,
    traitKeys[1 % traitKeys.length]!,
    traitKeys[2 % traitKeys.length]!,
    traitKeys[3 % traitKeys.length]!,
    traitKeys[4 % traitKeys.length]!,
    traitKeys[5 % traitKeys.length]!,
    traitKeys[6 % traitKeys.length]!,
    traitKeys[7 % traitKeys.length]!,
  ]);
}

describe('run-impacting trait candidate contacts', () => {
  it('keeps a missing Natural Selection child repairable, then accepts one complete sequence', () => {
    const biome = createBiomeAddress('Underworld', 'F');
    const trait = createTraitOfferAddress(
      createIncomingRewardAddress(biome, createOccurrenceId('natural-candidate')),
      'source',
    );
    const result = createNaturalSelectionResultAddress(trait, 'option1');
    const artifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(result),
          Object.freeze([
            { before: historyWithCoreTrait('ApolloWeaponBoon'), context: Object.freeze({}) },
          ]),
        ],
      ]),
    );
    const missing = evaluateNaturalSelectionResultCandidate(
      catalog,
      {} as never,
      {} as never,
      artifacts,
      { kind: 'naturalSelectionResult', result, value: selectedNaturalOffer(), targets: undefined },
    );
    expect(missing).toMatchObject({
      kind: 'naturalSelectionResult',
      result: {
        supported: false,
        complete: false,
        findings: [{ code: 'naturalSelectionResultMissing' }],
      },
    });

    const complete = evaluateNaturalSelectionResultCandidate(
      catalog,
      {} as never,
      {} as never,
      artifacts,
      {
        kind: 'naturalSelectionResult',
        result,
        value: selectedNaturalOffer(),
        targets: cycleEight(['ApolloWeaponBoon']),
      },
    );
    expect(complete).toMatchObject({
      kind: 'naturalSelectionResult',
      result: { supported: true, complete: true, findings: [] },
    });
  });

  it('retains a real selected Natural child at its progressive frontier and continues after whole-offer repair', () => {
    const poseidonReward = createIncomingRewardAddress(
      fGenerationBiome,
      fGenerationOccurrenceId(2, 1),
    );
    const demeterReward = createIncomingRewardAddress(
      fGenerationBiome,
      fGenerationOccurrenceId(3, 1),
    );
    const growthReward = createIncomingRewardAddress(
      fGenerationBiome,
      fGenerationOccurrenceId(4, 1),
    );
    const naturalReward = createIncomingRewardAddress(
      fGenerationBiome,
      fGenerationOccurrenceId(6, 1),
    );
    const naturalTrait = createTraitOfferAddress(naturalReward, 'source');
    const result = createNaturalSelectionResultAddress(naturalTrait, 'option1');
    let project = createFGenerationProject(
      [
        {
          targets: ['F_Combat02'],
          pickedExitIndex: 1,
          storeKey: 'MetaProgress',
          offers: [{ rewardType: 'MetaCurrencyDrop' }],
        },
        {
          targets: ['F_Combat03', 'F_Combat03'],
          pickedExitIndex: 1,
          storeKey: 'RunProgress',
          offers: [
            { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
            { rewardType: 'MaxHealthDrop' },
          ],
        },
        {
          targets: ['F_Combat04', 'F_Combat04'],
          pickedExitIndex: 1,
          storeKey: 'RunProgress',
          offers: [
            { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
            { rewardType: 'MaxManaDrop' },
          ],
        },
        {
          targets: ['F_Combat05', 'F_Combat05'],
          pickedExitIndex: 1,
          storeKey: 'RunProgress',
          offers: [
            { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
            { rewardType: 'RoomMoneyDrop' },
          ],
        },
        {
          targets: ['F_Combat06', 'F_Combat06'],
          pickedExitIndex: 1,
          storeKey: 'MetaProgress',
          offers: [{ rewardType: 'MetaCurrencyDrop' }, { rewardType: 'MetaCardPointsCommonDrop' }],
        },
        {
          targets: ['F_MiniBoss01', 'F_MiniBoss02'],
          pickedExitIndex: 1,
          storeKey: 'RunProgress',
          offers: [
            { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
            { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
          ],
        },
      ],
      { includeTakeover: true },
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(poseidonReward, 'source'),
      value: {
        kind: 'traits',
        giverKey: 'Poseidon',
        options: [
          { traitKey: 'PoseidonSpecialBoon', rarity: 'Rare' },
          { traitKey: 'PoseidonWeaponBoon', rarity: 'Rare' },
          { traitKey: 'PoseidonCastBoon', rarity: 'Rare' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(demeterReward, 'source'),
      value: {
        kind: 'traits',
        giverKey: 'Demeter',
        options: [
          { traitKey: 'DemeterManaBoon', rarity: 'Epic' },
          { traitKey: 'DemeterSpecialBoon', rarity: 'Epic' },
          { traitKey: 'DemeterCastBoon', rarity: 'Epic' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(growthReward, 'source'),
      value: {
        kind: 'traits',
        giverKey: 'Demeter',
        options: [
          { traitKey: 'BoonGrowthBoon', rarity: 'Epic' },
          { traitKey: 'DemeterSpecialBoon', rarity: 'Epic' },
          { traitKey: 'DemeterCastBoon', rarity: 'Epic' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: naturalTrait,
      value: selectedNaturalOffer(),
    });
    const missing = simulateProjectAssembly(catalog, project);
    const f = missing.evaluation.route.biomes.find((candidate) => candidate.biomeKey === 'F')!;
    expect(f).toMatchObject({
      authoring: 'complete',
      validity: 'invalid',
      coverage: { kind: 'prefix', blockedAt: result },
    });
    expect(f.findings).toContainEqual(
      expect.objectContaining({ code: 'naturalSelectionResultMissing', origin: result }),
    );
    const missingQuery: NaturalSelectionResultCandidateQuery = {
      kind: 'naturalSelectionResult',
      result,
      value: selectedNaturalOffer(),
      targets: undefined,
    };
    const missingCandidate = createPreparedProjectCandidateSession(catalog, missing).evaluate(
      missingQuery,
    );
    expect(missingCandidate).toMatchObject({
      kind: 'naturalSelectionResult',
      result: { supported: false },
    });
    if (missingCandidate.kind !== 'naturalSelectionResult')
      throw new Error('Natural Selection candidate was not retained at its blocking child');
    const targets = missingCandidate.result.nextTargetTraitKeys;
    if (targets.length === 0)
      throw new Error('Natural Selection child has no initial candidate domain');

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: naturalTrait,
      value: {
        ...selectedNaturalOffer(),
        options: [
          {
            traitKey: 'GoodStuffBoon',
            rarity: 'Duo',
            naturalSelectionTargets: cycleEight(targets),
          },
          { traitKey: 'DemeterSpecialBoon', rarity: 'Epic' },
          { traitKey: 'ReserveManaHitShieldBoon', rarity: 'Epic' },
        ],
      },
    });
    const repaired = simulateProjectAssembly(catalog, project).evaluation.route!.biomes.find(
      (candidate) => candidate.biomeKey === 'F',
    )!;
    expect(
      repaired.findings.some(
        (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(result),
      ),
    ).toBe(false);
    expect(repaired.coverage.kind).toBe('prefix');
    if (repaired.coverage.kind !== 'prefix')
      throw new Error('Natural repair did not retain a prefix');
    if (repaired.coverage.blockedAt === undefined)
      throw new Error('Natural repair did not retain its later blocking frontier');
    expect(semanticAddressKey(repaired.coverage.blockedAt)).not.toBe(semanticAddressKey(result));
  });

  it('publishes an ordinary threshold as a missing repair, and the exact command stores its selected continuation target', () => {
    const biome = createBiomeAddress('Surface', 'N');
    const occurrence = createOccurrenceAddress(biome, createOccurrenceId('steady-occurrence'));
    const outcome = createSteadyGrowthOutcomeAddress(occurrence, 'Encounter');
    const threshold = Object.freeze({
      traitKey: 'BoonGrowthBoon',
      acquisitionIdentity: 'steady-occurrence',
      requiredInterval: 6,
      before: historyWithCoreTrait('ApolloWeaponBoon'),
      eligibleTargetKeys: Object.freeze(['ApolloWeaponBoon']),
    });
    const artifacts = createSteadyGrowthCandidateArtifacts(
      catalog,
      new Map([[semanticAddressKey(outcome), Object.freeze([threshold])]]),
    );
    expect(
      evaluateSteadyGrowthOutcomeCandidate(catalog, {} as never, {} as never, artifacts, {
        kind: 'steadyGrowthOutcome',
        outcome,
        targetTraitKey: undefined,
      }),
    ).toMatchObject({
      kind: 'steadyGrowthOutcome',
      result: {
        eligibleTargetKeys: ['ApolloWeaponBoon'],
        branchSupport: [false],
        selectedPossible: false,
      },
    });
    expect(
      evaluateSteadyGrowthOutcomeCandidate(catalog, {} as never, {} as never, artifacts, {
        kind: 'steadyGrowthOutcome',
        outcome,
        targetTraitKey: 'ApolloWeaponBoon',
      }),
    ).toMatchObject({
      kind: 'steadyGrowthOutcome',
      result: { branchSupport: [true], selectedPossible: true },
    });

    const project = loadSurfaceNOProject();
    const actualOccurrence = project.route.biomes.find((candidate) => candidate.biomeKey === 'N')!
      .topology!.startOccurrenceId;
    const actualOutcome = createSteadyGrowthOutcomeAddress(
      createOccurrenceAddress(biome, actualOccurrence),
      'Encounter',
    );
    const repaired = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSteadyGrowthTarget',
      outcome: actualOutcome,
      targetTraitKey: 'ApolloWeaponBoon',
    });
    const repairedOccurrence = repaired.route.biomes
      .find((candidate) => candidate.biomeKey === 'N')!
      .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === actualOccurrence)!;
    expect(repairedOccurrence.encounters.steadyGrowthTargetByPhase).toMatchObject({
      Encounter: 'ApolloWeaponBoon',
    });
  });

  it('sets and clears the exact Boss threshold target as one undoable semantic edit', () => {
    const project = loadSurfaceNOProject();
    const biome = createBiomeAddress('Surface', 'N');
    const bossOwner = bossCompletionOwner(biome);
    const outcome = createSteadyGrowthOutcomeAddress(bossOwner, 'Encounter');
    const selected = applyProjectHistoryCommand(createProjectHistory(project), catalog, {
      kind: 'ReplaceSteadyGrowthTarget',
      outcome,
      targetTraitKey: 'ApolloWeaponBoon',
    });
    expect(
      selected.present.route.biomes
        .find((candidate) => candidate.biomeKey === 'N')
        ?.topology?.occurrences.find(
          (occurrence) => occurrence.occurrenceId === bossOwner.occurrenceId,
        )?.encounters.steadyGrowthTargetByPhase?.Encounter,
    ).toBe('ApolloWeaponBoon');
    expect(() =>
      applyProjectCommand(selected.present, catalog, {
        kind: 'ReplaceSteadyGrowthTarget',
        outcome: createSteadyGrowthOutcomeAddress(bossOwner, 'NotBoss'),
        targetTraitKey: 'ApolloWeaponBoon',
      }),
    ).toThrow(/has no encounter phase NotBoss/);

    const cleared = applyProjectHistoryCommand(selected, catalog, {
      kind: 'ReplaceSteadyGrowthTarget',
      outcome,
      targetTraitKey: null,
    });
    expect(
      cleared.present.route.biomes.find((candidate) => candidate.biomeKey === 'N'),
    ).not.toHaveProperty('bossCompletionSteadyGrowthTarget');
    expect(undoProjectHistory(cleared).present).toBe(selected.present);
  });

  it('keeps the Boss threshold on its completion-room owner and rejects branch-divergent Natural results', () => {
    const biome = createBiomeAddress('Surface', 'N');
    const bossOwner = bossCompletionOwner(biome);
    const boss = createSteadyGrowthOutcomeAddress(bossOwner, 'Boss');
    const threshold = Object.freeze({
      traitKey: 'BoonGrowthBoon',
      acquisitionIdentity: 'steady-boss',
      requiredInterval: 6,
      before: historyWithCoreTrait('ApolloWeaponBoon'),
      eligibleTargetKeys: Object.freeze(['ApolloWeaponBoon']),
    });
    const bossArtifacts = createSteadyGrowthCandidateArtifacts(
      catalog,
      new Map([[semanticAddressKey(boss), Object.freeze([threshold])]]),
    );
    expect(bossArtifacts.at(boss)?.thresholds[0]?.requiredInterval).toBe(6);

    const trait = createTraitOfferAddress(
      createIncomingRewardAddress(
        createBiomeAddress('Underworld', 'F'),
        createOccurrenceId('natural-branches'),
      ),
      'source',
    );
    const artifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(createNaturalSelectionResultAddress(trait, 'option1')),
          Object.freeze([
            { before: historyWithCoreTrait('ApolloWeaponBoon'), context: Object.freeze({}) },
            { before: historyWithCoreTrait('HestiaWeaponBoon'), context: Object.freeze({}) },
          ]),
        ],
      ]),
    );
    const divergent = evaluateNaturalSelectionResultCandidate(
      catalog,
      {} as never,
      {} as never,
      artifacts,
      {
        kind: 'naturalSelectionResult',
        result: createNaturalSelectionResultAddress(trait, 'option1'),
        value: selectedNaturalOffer(),
        targets: cycleEight(['ApolloWeaponBoon']),
      },
    );
    expect(divergent).toMatchObject({
      kind: 'naturalSelectionResult',
      result: { supported: false, branchSupport: [true, false] },
    });
  });
});
