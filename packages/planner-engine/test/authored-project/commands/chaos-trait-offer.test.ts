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
  undoProjectHistory,
} from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { candidateArtifactsForProjectEvaluationAssembly } from '../../../src/simulation/project-evaluation-assembly';

import naturalChaosRaw from '../../../../../test/fixtures/authored-project/checkpoints/natural-chaos-unresolved-trial.runplanner.json';
import type { AuthoredChaosTraitOffer } from '../../../src/authored-project/traits';
// The standalone JSON migration CLI deliberately has no production package surface.
// @ts-expect-error test contact imports that engine-consumed CLI output directly.
import { migrateProjectDocument } from '../../../../../schema/migrate-project.js';

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
    curseKey: 'ChaosNoMoneyCurse',
    duration: 3,
    curseValues: {},
    blessingKey: 'ChaosWeaponBlessing',
    rarity: 'Common',
    blessingValues: { damageBonus: 0.2 },
    ...values,
  };
}

describe('schema-51 Chaos TrialUpgrade authored child', () => {
  it('round-trips its unresolved default and atomically replaces the whole selected pair', () => {
    const unresolved = unresolvedProject();
    const serializedUnresolved = JSON.parse(encodeProjectDocument(unresolved)) as {
      routes: readonly {
        readonly biomes: readonly {
          readonly topology: {
            readonly occurrences: readonly {
              readonly occurrenceId: string;
              readonly state: unknown;
            }[];
          };
        }[];
      }[];
    };
    const chaosOccurrence = serializedUnresolved.routes[0]?.biomes[0]?.topology.occurrences.find(
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
    expect(JSON.parse(encodeProjectDocument(changed))).toMatchObject({ schemaVersion: 60 });

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
        value: pair({ curseValues: { invented: 1 } }),
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
    const domain = capability?.chaosPairDomains({
      curseKey: 'ChaosNoMoneyCurse',
      blessingKey: 'ChaosWeaponBlessing',
    })[0];
    expect(domain).toMatchObject({
      curseKeys: expect.arrayContaining(['ChaosNoMoneyCurse', 'ChaosHealthCurse']),
      blessingKeys: expect.arrayContaining(['ChaosWeaponBlessing', 'ChaosHealthBlessing']),
      rarities: ['Common', 'Rare', 'Epic'],
      curseDurations: {
        ChaosNoMoneyCurse: { minimum: 3, maximum: 5, step: 1 },
      },
    });
    expect(domain?.curseOperands.ChaosHealthCurse).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: expect.any(String) })]),
    );
    expect(domain?.blessingOperands.ChaosWeaponBlessing).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'damageBonus',
          byRarity: expect.objectContaining({ Common: expect.any(Object) }),
        }),
      ]),
    );
    expect(
      capability?.chaosPairDomains({
        curseKey: 'ChaosCommonCurse',
        blessingKey: 'ChaosWeaponBlessing',
      })[0]?.rarities,
    ).toEqual(['Common', 'Rare', 'Epic']);
    expect(
      capability?.chaosPairDomains({
        curseKey: 'ChaosMetaUpgradeCurse',
        blessingKey: 'ChaosWeaponBlessing',
      })[0]?.rarities,
    ).toEqual(['Heroic']);
    expect(
      capability?.chaosPairDomains({
        curseKey: 'ChaosMetaUpgradeCurse',
        blessingKey: 'ChaosLastStandBlessing',
      })[0]?.rarities,
    ).toEqual(['Legendary']);
  });

  it('strictly decodes and canonically re-encodes the engine-consumed 50-to-51 migration output', () => {
    const legacy = JSON.parse(JSON.stringify(naturalChaosRaw)) as {
      schemaVersion: number;
      catalogVersion: string;
      routes: {
        biomes: {
          topology?: {
            occurrences: {
              occurrenceId: string;
              state: { reward?: { traitOffersByAcquisitionRole: Record<string, unknown> } };
            }[];
          };
        }[];
      }[];
    };
    legacy.schemaVersion = 50;
    legacy.catalogVersion = '0.30.0-boon-rarity-ledger';
    const reward = legacy.routes[0]!.biomes[0]!.topology!.occurrences.find(
      (occurrence) => occurrence.occurrenceId === 'fixture-chaos-room',
    )?.state.reward;
    if (reward === undefined)
      throw new Error('legacy migration witness has no TrialUpgrade reward');
    reward.traitOffersByAcquisitionRole = {};
    const migrated = migrateProjectDocument(legacy).document;
    const decoded = decodeProjectDocument(migrated, catalog);
    expect(decoded).toEqual(unresolvedProject());
    expect(JSON.parse(encodeProjectDocument(decoded))).toEqual(migrated);
  });
});
