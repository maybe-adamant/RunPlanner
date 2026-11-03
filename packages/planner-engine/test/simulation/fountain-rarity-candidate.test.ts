import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createFountainRarityOutcomeAddress,
  createOccurrenceId,
  createRoomActionAddress,
  roomActionKey,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { createCompleteFGProject, goldenFBiome } from '@run-planner/test-fixtures/underworld';
import { describe, expect, it } from 'vitest';

import type { ProjectEvaluation } from '../../src/simulation/evaluation/evaluation-products';
import { createFountainRarityCandidateArtifacts } from '../../src/simulation/keepsakes/candidate-artifacts';
import { type FountainRarityCandidateCapability } from '../../src/simulation/keepsakes/candidate-artifacts';
import {
  evaluateFountainRarityOutcomeCandidate,
  type FountainRarityOutcomeCandidateQuery,
} from '../../src/simulation/candidates/fountain-rarity';

const action = createRoomActionAddress(
  goldenFBiome,
  createOccurrenceId('golden-f-preboss-shop:postboss'),
  roomActionKey({ kind: 'useFountain' }),
);
const outcome = createFountainRarityOutcomeAddress(action);

function candidateArtifacts(frontier: FountainRarityCandidateCapability) {
  return createFountainRarityCandidateArtifacts(new Map([[semanticAddressKey(outcome), frontier]]));
}

function query(targetTraitKey: string | null | undefined): FountainRarityOutcomeCandidateQuery {
  return { kind: 'fountainRarityOutcome', outcome, targetTraitKey };
}

describe('Aromatic Phial candidate frontier', () => {
  it('rejects a target outside the pending frontier', () => {
    const result = evaluateFountainRarityOutcomeCandidate(
      catalog,
      createCompleteFGProject(),
      {} as ProjectEvaluation,
      candidateArtifacts({
        status: 'pending',
        consumptionTargetKeys: ['ZeusWeaponBoon'],
        mutationTargetKeys: ['ZeusWeaponBoon'],
      }),
      query('ApolloWeaponBoon'),
    );
    if (result.kind !== 'fountainRarityOutcome') throw new Error('expected candidate result');
    expect(result.result).toMatchObject({
      mutationTargetKeys: ['ZeusWeaponBoon'],
      targetRequired: true,
      selectedPossible: false,
    });
  });

  it('retains the missing-target repair when a pending mutation frontier exists', () => {
    const result = evaluateFountainRarityOutcomeCandidate(
      catalog,
      createCompleteFGProject(),
      {} as ProjectEvaluation,
      candidateArtifacts({
        status: 'pending',
        consumptionTargetKeys: ['ApolloWeaponBoon'],
        mutationTargetKeys: ['ApolloWeaponBoon'],
      }),
      query(undefined),
    );
    if (result.kind !== 'fountainRarityOutcome') throw new Error('expected candidate result');
    expect(result.result).toMatchObject({
      targetRequired: true,
      selectedPossible: false,
    });
  });

  it('reads an authored target from a fixed Postboss occurrence', () => {
    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceFountainRarityTarget',
      outcome,
      targetTraitKey: 'ApolloWeaponBoon',
    });
    const result = evaluateFountainRarityOutcomeCandidate(
      catalog,
      project,
      {} as ProjectEvaluation,
      candidateArtifacts({
        status: 'pending',
        consumptionTargetKeys: ['ApolloWeaponBoon'],
        mutationTargetKeys: ['ApolloWeaponBoon'],
      }),
      query('ApolloWeaponBoon'),
    );
    if (result.kind !== 'fountainRarityOutcome') throw new Error('expected candidate result');
    expect(result.result).toMatchObject({
      targetRequired: true,
      selectedPossible: true,
    });
  });
});
