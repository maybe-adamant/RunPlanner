import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createProjectHistory,
  createTraitOfferAddress,
  createTargetAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { candidateArtifactsForProjectEvaluationAssembly } from '../../../src/simulation/project-evaluation-assembly';

import naturalChaosRaw from '../../../../../test/fixtures/authored-project/checkpoints/natural-chaos-unresolved-trial.runplanner.json';
import type { AuthoredChaosTraitOffer } from '../../../src/authored-project/traits';

const chaosReward = createIncomingRewardAddress(
  createBiomeAddress('Underworld', 'F'),
  createOccurrenceId('fixture-chaos-room'),
);
const chaosTrait = createTraitOfferAddress(chaosReward, 'self');

function unresolvedProject() {
  return decodeProjectDocument(naturalChaosRaw, catalog);
}

/** The named checkpoint intentionally retains only the Chaos child unresolved.
 * These focused prefix repairs make that exact child reachable without changing
 * the fixture's authored Chaos frontier. */
function reachableUnresolvedProject() {
  const openingId = createOccurrenceId('fixture-chaos-opening');
  const biome = createBiomeAddress('Underworld', 'F');
  let project = applyProjectCommand(unresolvedProject(), catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, openingId),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createIncomingRewardAddress(biome, openingId), 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  const source = { kind: 'occurrence' as const, occurrenceId: openingId };
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, source),
    storeKey: 'MetaProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, source, 'exit1'),
    occurrenceId: createOccurrenceId('fixture-chaos-normal-target'),
    gameName: 'F_Combat01',
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, createOccurrenceId('fixture-chaos-normal-target')),
    value: { rewardType: 'MaxHealthDrop' },
  });
}

function pair(values: Partial<AuthoredChaosTraitOffer> = {}): AuthoredChaosTraitOffer {
  return {
    kind: 'chaos',
    giverKey: 'Chaos',
    curseOptions: [
      { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
      { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
      { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
    ],
    selectedOptionKey: 'option1',
    selectedCurseValues: {},
    blessingKey: 'ChaosWeaponBlessing',
    rarity: 'Common',
    blessingValues: { damageBonus: 0.2 },
    ...values,
  };
}

describe('Chaos TrialUpgrade authored child', () => {
  it('round-trips its unresolved default and atomically replaces the whole selected pair', () => {
    const unresolved = unresolvedProject();
    const serializedUnresolved = JSON.parse(encodeProjectDocument(unresolved)) as {
      route: {
        biomes: readonly {
          topology: {
            occurrences: readonly { occurrenceId: string; state: unknown }[];
          };
        }[];
      };
    };
    const chaosOccurrence = serializedUnresolved.route.biomes[0]?.topology.occurrences.find(
      (occurrence) => occurrence.occurrenceId === 'fixture-chaos-room',
    );
    expect(chaosOccurrence).toMatchObject({
      state: {
        reward: {
          offer: { rewardType: 'TrialUpgrade' },
          traitOffersByAcquisitionRole: { self: null },
        },
      },
    });

    const changed = applyProjectCommand(unresolved, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: chaosTrait,
      value: pair(),
    });
    const decoded = decodeProjectDocument(JSON.parse(encodeProjectDocument(changed)), catalog);
    expect(decoded).toEqual(changed);
    expect(JSON.parse(encodeProjectDocument(changed))).toMatchObject({
      schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    });

    const history = applyProjectHistoryCommand(createProjectHistory(unresolved), catalog, {
      kind: 'ReplaceTraitOffer',
      trait: chaosTrait,
      value: pair(),
    });
    expect(history.past).toEqual([unresolved]);
    expect(undoProjectHistory(history).present).toBe(unresolved);
  });

  it('rejects incomplete, cross-rarity, and extra numeric payloads while retaining invalid context pairs through decode', () => {
    expect(() =>
      applyProjectCommand(unresolvedProject(), catalog, {
        kind: 'ReplaceTraitOffer',
        trait: chaosTrait,
        value: pair({ blessingValues: { damageBonus: 0.75 } }),
      }),
    ).toThrow(/outside its declared domain/);
    expect(() =>
      applyProjectCommand(unresolvedProject(), catalog, {
        kind: 'ReplaceTraitOffer',
        trait: chaosTrait,
        value: pair({ selectedCurseValues: { invented: 1 } }),
      }),
    ).toThrow(/exactly the declaration operands/);

    const contextInvalid = applyProjectCommand(unresolvedProject(), catalog, {
      kind: 'ReplaceTraitOffer',
      trait: chaosTrait,
      value: pair({
        blessingKey: 'ChaosLastStandBlessing',
        rarity: 'Legendary',
        blessingValues: {},
      }),
    });
    expect(
      decodeProjectDocument(JSON.parse(encodeProjectDocument(contextInvalid)), catalog),
    ).toEqual(contextInvalid);
  });

  it('uses the explicit TrialUpgrade provider binding instead of a source-name fallback', () => {
    expect(
      catalog.rewards.rewardTypes.byKey.TrialUpgrade?.acquisitionRoles.byKey.self?.traitGiverKey,
    ).toBe('Chaos');
    expect(catalog.traitGiverByAcquisitionGameName.TrialUpgrade).toBeUndefined();
    expect(() =>
      applyProjectCommand(unresolvedProject(), catalog, {
        kind: 'ReplaceTraitOffer',
        trait: chaosTrait,
        value: { ...pair(), giverKey: 'Zeus' } as unknown as AuthoredChaosTraitOffer,
      }),
    ).toThrow(/Chaos provider/);
  });

  it('publishes the retained missing Chaos child finding and complete pair capability', () => {
    const assembly = simulateProjectAssembly(catalog, reachableUnresolvedProject());
    expect(assembly.evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'traitOfferMissing', origin: chaosTrait }),
    );

    const capability = candidateArtifactsForProjectEvaluationAssembly(assembly)
      .biomeAt(createBiomeAddress('Underworld', 'F'))
      ?.traitOffers.at(chaosTrait);
    expect(capability).toBeDefined();
    const domain = capability?.chaosOfferDomain(pair())[0];
    expect(domain?.blessingKeys).toEqual(
      expect.arrayContaining(['ChaosWeaponBlessing', 'ChaosHealthBlessing']),
    );
    expect(domain?.rarities).toEqual(['Common', 'Rare', 'Epic']);
    const firstOption = domain?.curseOptions[0];
    expect(firstOption?.optionKey).toBe('option1');
    expect(firstOption?.curseKeys).toEqual(
      expect.arrayContaining(['ChaosNoMoneyCurse', 'ChaosHealthCurse']),
    );
    expect(firstOption?.requirements.ChaosNoMoneyCurse).toMatchObject({
      minimum: 3,
      maximum: 5,
      step: 1,
      unit: 'encounters',
    });
    expect(domain?.selectedCurseOperands).toEqual([]);
    expect(domain?.blessingOperands.ChaosWeaponBlessing).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'damageBonus',
          byRarity: expect.objectContaining({ Common: expect.any(Object) }),
        }),
      ]),
    );
    const defaultDomain = capability?.chaosOfferDomain()[0];
    expect(defaultDomain?.selectedCurseKey).toBe(defaultDomain?.curseOptions[0]?.curseKeys[0]);
    expect(defaultDomain?.blessingKeys[0]).toBeDefined();
    expect(defaultDomain?.rarities).toEqual(['Common', 'Rare', 'Epic']);
    const retainedUnavailablePeer = capability?.chaosOfferDomain(
      pair({
        curseOptions: [
          { curseKey: 'ChaosMetaUpgradeCurse', requirementCount: 3 },
          { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
          { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
        ],
      }),
    )[0];
    expect(retainedUnavailablePeer?.curseOptions[0]?.curseKeys).toContain('ChaosMetaUpgradeCurse');
    expect(retainedUnavailablePeer?.curseOptions[0]?.availableCurseKeys).not.toContain(
      'ChaosMetaUpgradeCurse',
    );
    expect(retainedUnavailablePeer?.curseOptions[1]?.curseKeys).not.toContain(
      'ChaosMetaUpgradeCurse',
    );
    expect(retainedUnavailablePeer?.curseOptions[2]?.curseKeys).not.toContain(
      'ChaosMetaUpgradeCurse',
    );
    expect(
      capability?.chaosOfferDomain(
        pair({
          curseOptions: [
            { curseKey: 'ChaosCommonCurse', requirementCount: 2 },
            { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
            { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
          ],
        }),
      )[0]?.rarities,
    ).toEqual(['Common', 'Rare', 'Epic']);
    expect(
      capability?.chaosOfferDomain(
        pair({
          curseOptions: [
            { curseKey: 'ChaosMetaUpgradeCurse', requirementCount: 3 },
            { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
            { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
          ],
        }),
      )[0]?.rarities,
    ).toEqual(['Heroic']);
    expect(
      capability?.chaosOfferDomain(
        pair({
          curseOptions: [
            { curseKey: 'ChaosMetaUpgradeCurse', requirementCount: 3 },
            { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
            { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
          ],
          blessingKey: 'ChaosLastStandBlessing',
          rarity: 'Legendary',
          blessingValues: {},
        }),
      )[0]?.rarities,
    ).toEqual(['Legendary']);
  });
});
