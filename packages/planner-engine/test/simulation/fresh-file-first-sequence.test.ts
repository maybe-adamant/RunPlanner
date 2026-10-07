import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createIncomingRewardAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceId,
  createProjectDocument,
  createStartingRewardAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  semanticAddressKey,
  type AuthoredTraitOfferTraits,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { simulateProject, type RunStateSnapshot } from '@run-planner/engine/simulation';
import { loadUnderworldGeneratedCompositionCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  withRetainedFreshFileIntroCustomization,
  createFreshFileFirstSequence,
  createMatureCombat01Sequence,
  freshFileFBiome,
  freshFileIntroId,
  matureCombat01Biome as matureBiome,
  matureCombat01Id as matureIntroId,
  matureCombat01StartId as matureStartId,
} from '@run-planner/test-fixtures/fresh-file';
import { authorLegalTraitOffers, traitCandidateSession } from '@run-planner/test-fixtures/shared';

const apolloBoon: ResolvedRewardOffer = {
  rewardType: 'Boon',
  payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
};

const introTrait = (biome = freshFileFBiome, occurrenceId = freshFileIntroId) =>
  createTraitOfferAddress(createIncomingRewardAddress(biome, occurrenceId), 'source');

const apolloOffer = (
  options: readonly (readonly [string, 'Common' | 'Rare'])[],
): AuthoredTraitOfferTraits =>
  Object.freeze({
    kind: 'traits',
    giverKey: 'Apollo',
    options: options.map(([traitKey, rarity]) => ({
      traitKey,
      rarity,
    })) as unknown as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: 'option1',
  });

const trio = apolloOffer([
  ['ApolloWeaponBoon', 'Common'],
  ['ApolloSprintBoon', 'Common'],
  ['ApolloManaBoon', 'Common'],
]);

function freshSequence(): ProjectDocument {
  return authorLegalTraitOffers(createFreshFileFirstSequence());
}

function withIncomingReward(project: ProjectDocument, value: ResolvedRewardOffer) {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(freshFileFBiome, freshFileIntroId),
    value,
  });
}

function combat01(project: ProjectDocument, occurrenceId = freshFileIntroId) {
  return project.route.biomes[0]!.topology!.occurrences.find(
    (occurrence) => occurrence.occurrenceId === occurrenceId,
  )!;
}

function introEncounterKey(project: ProjectDocument): string | undefined {
  const biome = simulateProject(catalog, project).route.biomes[0]!;
  if (!('materializedPrefix' in biome)) throw new Error('F retains no materialized prefix');
  const decision = biome.materializedPrefix.decisions[0];
  if (decision?.kind !== 'batch') throw new Error('the opening batch is missing');
  const room = decision.targets[0]?.room;
  return room?.kind === 'authored' ? room.encounterPhases?.[0]?.authoredChoiceKey : undefined;
}

function runProgressRemaining(project: ProjectDocument, owner: string): number | undefined {
  const biome = simulateProject(catalog, project).route.biomes[0]!;
  const snapshots: readonly RunStateSnapshot[] =
    'rewards' in biome ? (biome.rewards?.runStateSnapshots ?? []) : [];
  const snapshot = snapshots.find((candidate) =>
    semanticAddressKey(candidate.owner).includes(owner),
  );
  const remaining = snapshot?.bags.find((bag) => bag.storeKey === 'RunProgress')?.remaining;
  return remaining?.kind === 'exact' ? remaining.count : undefined;
}

function offerSupported(
  project: ProjectDocument,
  value: AuthoredTraitOfferTraits,
  trait = introTrait(),
) {
  const evaluation = traitCandidateSession(project).evaluate({ kind: 'traitOffer', trait, value });
  if (evaluation.kind !== 'traitOffer') throw new Error('trait offer candidate is unavailable');
  return evaluation.result;
}

describe('Fresh File first sequence', () => {
  it('reaches FIntroFight and the Common Apollo trio after the empty opening', () => {
    const project = freshSequence();
    expect(simulateProject(catalog, project).findings.map((finding) => finding.code)).toEqual([
      'batchRewardStoreMissing',
    ]);
    expect(introEncounterKey(project)).toBe('FIntroFight');
    const state = combat01(project).state;
    expect(state).toMatchObject({ kind: 'counted', reward: { offer: apolloBoon } });
    expect(
      state.kind === 'counted' ? state.reward?.traitOffersByAcquisitionRole.source : undefined,
    ).toMatchObject(trio);
    expect(offerSupported(project, trio).supported).toBe(true);
    expect(
      offerSupported(
        project,
        apolloOffer([
          ['ApolloWeaponBoon', 'Rare'],
          ['ApolloSprintBoon', 'Common'],
          ['ApolloManaBoon', 'Common'],
        ]),
      ).supported,
    ).toBe(false);
  });

  it('settles the forced Apollo boon without drawing the RunProgress bag', () => {
    const project = freshSequence();
    const before = runProgressRemaining(project, '"F:start","roomEntered"');
    expect(before).toBeGreaterThan(0);
    expect(runProgressRemaining(project, `"${freshFileIntroId}","roomEntered"`)).toBe(before);
  });

  it('reports a Special, Cast or non-core pick on the first Apollo screen and retains it', () => {
    // Light Smite has no prerequisite, so only the forced loot table excludes it.
    for (const excluded of ['ApolloSpecialBoon', 'ApolloCastBoon', 'ApolloRetaliateBoon']) {
      const value = apolloOffer([
        [excluded, 'Common'],
        ['ApolloSprintBoon', 'Common'],
        ['ApolloManaBoon', 'Common'],
      ]);
      const project = applyProjectCommand(freshSequence(), catalog, {
        kind: 'ReplaceTraitOffer',
        trait: introTrait(),
        value,
      });
      const result = offerSupported(project, value);
      expect(result.supported).toBe(false);
      expect(result.branches.flatMap((branch) => branch.assessments[0]!.findings)).toContainEqual(
        expect.objectContaining({
          code: 'offerContext',
          traitKey: excluded,
          detail: 'firstRunOffer',
        }),
      );
      expect(simulateProject(catalog, project).findings).toContainEqual(
        expect.objectContaining({
          code: 'offerContext',
          origin: introTrait(),
          evidence: expect.objectContaining({ traitKey: excluded, detail: 'firstRunOffer' }),
        }),
      );
      const state = combat01(project).state;
      expect(
        state.kind === 'counted' ? state.reward?.traitOffersByAcquisitionRole.source : undefined,
      ).toMatchObject(value);
    }
  });

  it('reports a non-Apollo reward on Fresh F_Combat01 and retains it', () => {
    for (const [value, code] of [
      [{ rewardType: 'MaxHealthDrop' }, 'rewardBagEntryUnavailable'],
      [
        { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
        'rewardSourceUnavailable',
      ],
    ] as const) {
      const project = withIncomingReward(freshSequence(), value);
      expect(simulateProject(catalog, project).findings).toContainEqual(
        expect.objectContaining({
          code,
          origin: createIncomingRewardAddress(freshFileFBiome, freshFileIntroId),
        }),
      );
      expect(combat01(project).state).toMatchObject({ kind: 'counted', reward: { offer: value } });
    }
  });

  it('retains, reports and removes a GeneratedF customization saved on Fresh F_Combat01', () => {
    const customized =
      loadUnderworldGeneratedCompositionCheckpoint().route.biomes[0]!.topology!.occurrences.find(
        (occurrence) => occurrence.encounters.customizationByPhase?.Encounter !== undefined,
      )!.encounters.customizationByPhase!.Encounter!;
    const [decisionKey, value] = Object.entries(customized)[0]!;
    const raw = JSON.parse(encodeProjectDocument(freshSequence()));
    raw.route.biomes[0].topology.occurrences.find(
      (occurrence: { occurrenceId: string }) => occurrence.occurrenceId === freshFileIntroId,
    ).encounters.customizationByPhase = { Encounter: { [decisionKey]: value } };
    const project = decodeProjectDocument(raw, catalog);
    expect(combat01(project).encounters.customizationByPhase).toEqual({
      Encounter: { [decisionKey]: value },
    });
    const phase = createEncounterPhaseAddress(
      freshFileFBiome,
      { kind: 'occurrence', occurrenceId: freshFileIntroId },
      'Encounter',
    );
    expect(simulateProject(catalog, project).findings).toContainEqual(
      expect.objectContaining({
        code: 'encounterCustomizationUnavailable',
        origin: phase,
        evidence: expect.objectContaining({ decisionKey }),
      }),
    );
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceEncounterCustomization',
        phase,
        decisionKey,
        value,
      }),
    ).toThrow(/not declared on this route/);
    const cleared = applyProjectCommand(project, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase,
      decisionKey,
      value: null,
    });
    expect(combat01(cleared).encounters.customizationByPhase).toBeUndefined();
    expect(simulateProject(catalog, cleared).findings.map((finding) => finding.code)).toEqual([
      'batchRewardStoreMissing',
    ]);
  });

  it('keeps strict decoding where no contextual rule replaced the binding', () => {
    const cocoon = { cocoonCount: { kind: 'cocoonCount', count: 10 } };
    const withCustomization = (project: ProjectDocument, occurrenceId: string) => {
      const raw = JSON.parse(encodeProjectDocument(project));
      raw.route.biomes[0].topology.occurrences.find(
        (occurrence: { occurrenceId: string }) => occurrence.occurrenceId === occurrenceId,
      ).encounters.customizationByPhase = { Encounter: cocoon };
      return () => decodeProjectDocument(raw, catalog);
    };
    // Mature F_Combat01 has no contextual rule; its GeneratedF owns no cocoon count.
    expect(withCustomization(createMatureCombat01Sequence(), matureIntroId)).toThrow(
      /is not declared for this encounter phase/,
    );
    // The replaced GeneratedF binding never owned a cocoon count either.
    expect(withCustomization(freshSequence(), freshFileIntroId)).toThrow(
      /is not declared for this encounter phase/,
    );
  });

  it('retains an OpeningGeneratedF customization under the Dream opening rule', () => {
    const dreamF = createBiomeAddress('Dream', 'F');
    const startId = createOccurrenceId('dream-opening');
    let dream = createProjectDocument(catalog, {
      projectId: 'dream-opening',
      routeKey: 'Dream',
      itineraryBiomeKeys: ['F', 'G'],
      configuredBiomeCount: 1,
    });
    dream = applyProjectCommand(dream, catalog, {
      kind: 'CreateStart',
      biome: dreamF,
      occurrenceId: startId,
      gameName: 'F_Opening01',
    });
    dream = applyProjectCommand(dream, catalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Dream'),
      value: apolloBoon,
    });
    dream = authorLegalTraitOffers(dream);
    const retained = combat01(withRetainedFreshFileIntroCustomization(freshSequence())).encounters
      .customizationByPhase!.Encounter!;
    const [decisionKey, value] = Object.entries(retained)[0]!;
    const raw = JSON.parse(encodeProjectDocument(dream));
    raw.route.biomes[0].topology.occurrences.find(
      (occurrence: { occurrenceId: string }) => occurrence.occurrenceId === startId,
    ).encounters.customizationByPhase = { Encounter: { [decisionKey]: value } };
    const project = decodeProjectDocument(raw, catalog);
    const phase = createEncounterPhaseAddress(
      dreamF,
      { kind: 'occurrence', occurrenceId: startId },
      'Encounter',
    );
    expect(simulateProject(catalog, project).findings).toContainEqual(
      expect.objectContaining({ code: 'encounterCustomizationUnavailable', origin: phase }),
    );
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceEncounterCustomization',
        phase,
        decisionKey,
        value,
      }),
    ).toThrow(/not declared on this route/);
    const cleared = applyProjectCommand(project, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase,
      decisionKey,
      value: null,
    });
    expect(combat01(cleared, startId).encounters.customizationByPhase).toBeUndefined();
    expect(simulateProject(catalog, cleared).findings.map((finding) => finding.code)).not.toContain(
      'encounterCustomizationUnavailable',
    );
  });

  it('keeps mature F_Combat01 on GeneratedF with a counted draw and the ordinary offer', () => {
    const project = createMatureCombat01Sequence();
    expect(simulateProject(catalog, project).findings.map((finding) => finding.code)).toEqual([
      'batchRewardStoreMissing',
    ]);
    expect(introEncounterKey(project)).toBe('GeneratedF');
    const before = runProgressRemaining(project, `"${matureStartId}","roomEntered"`);
    const after = runProgressRemaining(project, `"${matureIntroId}","roomEntered"`);
    expect(before).toBeDefined();
    expect(after).toBe(before! - 1);
    const trait = introTrait(matureBiome, matureIntroId);
    expect(
      offerSupported(
        project,
        apolloOffer([
          ['ApolloSpecialBoon', 'Rare'],
          ['ApolloCastBoon', 'Common'],
          ['ApolloManaBoon', 'Common'],
        ]),
        trait,
      ).supported,
    ).toBe(true);
    const mature = createMatureCombat01Sequence();
    expect(
      simulateProject(
        catalog,
        applyProjectCommand(mature, catalog, {
          kind: 'ReplaceIncomingReward',
          reward: createIncomingRewardAddress(matureBiome, matureIntroId),
          value: { rewardType: 'MaxHealthDrop' },
        }),
      ).findings.map((finding) => finding.code),
    ).toEqual(['batchRewardStoreMissing']);
  });
});
