import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createNaturalSelectionResultAddress,
  createOccurrenceId,
  createSteadyGrowthOutcomeAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type AuthoredTraitOffer,
  type AuthoredTraitOption,
} from '@run-planner/engine/authored-project';
import {
  foldTraitHistoryEvents,
  type NaturalSelectionResultCandidateQuery,
  type TraitOfferEvent,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createTraitOfferCandidateArtifacts } from '../../src/simulation/candidates/trait-offer/capability';
import { createSteadyGrowthCandidateArtifacts } from '../../src/simulation/candidates/steady-growth';
import { evaluateSteadyGrowthOutcomeCandidate } from '../../src/simulation/candidates/steady-growth';
import { evaluateNaturalSelectionResultCandidate } from '../../src/simulation/candidates/trait-offer/query';
import { nBiome, nOccurrenceId } from '@run-planner/test-fixtures/surface';
import { loadSurfaceNNaturalSelectionCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import {
  createFGenerationProject,
  fGenerationBiome,
  fGenerationOccurrenceId,
} from './support/f-generation-project';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { traitFrontierState, openTimeTraitOfferContexts } from '../support/simulation-state';

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
      openTimeTraitOfferContexts(
        new Map([
          [
            semanticAddressKey(trait),
            Object.freeze([
              {
                state: traitFrontierState(historyWithCoreTrait('ApolloWeaponBoon')),
                source: Object.freeze({}),
              },
            ]),
          ],
        ]),
      ),
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

  it('re-edits a saved Natural Selection result after the route continues past it', () => {
    const saved = loadSurfaceNNaturalSelectionCheckpoint();
    const assembly = simulateProjectAssembly(catalog, saved);
    expect(assembly.evaluation.findings).toEqual([]);
    const trait = createTraitOfferAddress(
      createIncomingRewardAddress(nBiome, nOccurrenceId('miniBoss01')),
      'source',
    );
    const state = saved.route.biomes
      .find((biome) => biome.biomeKey === 'N')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === nOccurrenceId('miniBoss01'),
      )?.state;
    const value: AuthoredTraitOffer | undefined =
      state !== undefined && 'reward' in state
        ? (state.reward?.traitOffersByAcquisitionRole.source ?? undefined)
        : undefined;
    const option = value?.kind === 'traits' ? value.options[0] : undefined;
    if (value === undefined || option?.naturalSelectionTargets === undefined)
      throw new Error('saved Natural Selection result is missing');
    const session = createPreparedProjectCandidateSession(catalog, assembly);
    const evaluate = (targets: readonly string[] | undefined) => {
      const query: NaturalSelectionResultCandidateQuery = {
        kind: 'naturalSelectionResult',
        result: createNaturalSelectionResultAddress(trait, 'option1'),
        value,
        targets,
      };
      return session.evaluate(query);
    };

    const empty = evaluate(undefined);
    expect(empty).toMatchObject({
      kind: 'naturalSelectionResult',
      result: { firstPassRows: [{ requiresEarlierRow: false }, { requiresEarlierRow: true }] },
    });
    expect(
      empty.kind === 'naturalSelectionResult' ? empty.result.completedTargets : 'unavailable',
    ).toBeUndefined();
    expect(evaluate(option.naturalSelectionTargets)).toMatchObject({
      kind: 'naturalSelectionResult',
      result: {
        supported: true,
        complete: true,
        completedTargets: option.naturalSelectionTargets,
      },
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

  it('assesses a reached threshold from its exact frontier: missing, then the chosen target', () => {
    const biome = createBiomeAddress('Surface', 'N');
    const source = createTraitOfferAddress(
      createIncomingRewardAddress(biome, createOccurrenceId('steady-source')),
      'source',
    );
    const outcome = createSteadyGrowthOutcomeAddress(source, 1);
    const threshold = Object.freeze({
      traitKey: 'BoonGrowthBoon',
      acquisitionIdentity: 'steady-occurrence',
      source,
      cycle: 1,
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
  });

  it('keeps each threshold under its own source cycle and rejects branch-divergent Natural results', () => {
    const biome = createBiomeAddress('Surface', 'N');
    const source = createTraitOfferAddress(
      createIncomingRewardAddress(biome, createOccurrenceId('steady-source')),
      'source',
    );
    const boss = createSteadyGrowthOutcomeAddress(source, 2);
    const threshold = Object.freeze({
      traitKey: 'BoonGrowthBoon',
      acquisitionIdentity: 'steady-boss',
      source,
      cycle: 2,
      requiredInterval: 6,
      before: historyWithCoreTrait('ApolloWeaponBoon'),
      eligibleTargetKeys: Object.freeze(['ApolloWeaponBoon']),
    });
    const bossArtifacts = createSteadyGrowthCandidateArtifacts(
      catalog,
      new Map([[semanticAddressKey(boss), Object.freeze([threshold])]]),
    );
    expect(bossArtifacts.at(boss)?.thresholds[0]?.requiredInterval).toBe(6);
    expect(bossArtifacts.at(createSteadyGrowthOutcomeAddress(source, 1))).toBeUndefined();

    const trait = createTraitOfferAddress(
      createIncomingRewardAddress(
        createBiomeAddress('Underworld', 'F'),
        createOccurrenceId('natural-branches'),
      ),
      'source',
    );
    const artifacts = createTraitOfferCandidateArtifacts(
      catalog,
      openTimeTraitOfferContexts(
        new Map([
          [
            semanticAddressKey(trait),
            Object.freeze([
              {
                state: traitFrontierState(historyWithCoreTrait('ApolloWeaponBoon')),
                source: Object.freeze({}),
              },
              {
                state: traitFrontierState(historyWithCoreTrait('HestiaWeaponBoon')),
                source: Object.freeze({}),
              },
            ]),
          ],
        ]),
      ),
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
