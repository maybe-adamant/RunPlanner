import { catalog } from '@run-planner/hades2-catalog';
import type { TraitRarity } from '@run-planner/engine/catalog-schema';
import {
  applyProjectCommand,
  createTraitOfferAddress,
  semanticAddressKey,
  type ProjectDocument,
  type SemanticAddress,
  type TraitOfferOwnerAddress,
} from '@run-planner/engine/authored-project';
import {
  simulateProject,
  traitCandidates,
  type ReachedTraitOfferEvaluation,
} from '@run-planner/engine/simulation';

function traitOwner(address: SemanticAddress): TraitOfferOwnerAddress | undefined {
  switch (address.kind) {
    case 'incomingReward':
    case 'localReward':
    case 'rewardWheelOffer':
    case 'shopOffer':
      return address;
    default:
      return undefined;
  }
}

function reachedOffers(project: ProjectDocument): readonly ReachedTraitOfferEvaluation[] {
  const evaluation = simulateProject(catalog, project);
  const seen = new Set<string>();
  const result: ReachedTraitOfferEvaluation[] = [];
  for (const route of evaluation.routes) {
    for (const biome of route.biomes) {
      if (!('rewards' in biome)) continue;
      for (const branch of biome.rewards.branches) {
        for (const trace of branch.traitEvaluations ?? []) {
          const key = `${semanticAddressKey(trace.address)}:${trace.acquisitionRole}`;
          if (seen.has(key)) continue;
          seen.add(key);
          result.push(trace);
        }
      }
    }
  }
  return result;
}

/**
 * Test fixtures use the engine's candidate authority to author legal defaults
 * for every reached trait offer. This keeps unrelated route/workspace fixtures
 * valid while exercising the same three-option command and legality contract
 * as an editor user.
 */
export function authorLegalTraitOffers(project: ProjectDocument): ProjectDocument {
  let current = project;
  for (let pass = 0; pass < 32; pass += 1) {
    const invalids = reachedOffers(current).filter((trace) =>
      trace.assessments.some((assessment) => !assessment.legal),
    );
    if (invalids.length === 0) return current;
    let changed = false;
    for (const invalid of invalids) {
      const owner = traitOwner(invalid.address);
      if (owner === undefined) continue;
      const optionsByTrait = new Map<
        string,
        {
          readonly traitKey: string;
          readonly rarity?: TraitRarity;
        }
      >();
      const candidates = traitCandidates(
        catalog,
        invalid.offer.giverKey,
        invalid.before,
        invalid.context,
      );
      // Keep fixture repair on ordinary variants whenever the engine reports
      // a rich ordinary pool. Replacement alternatives are still exercised
      // by focused replacement fixtures and are chosen only when ordinary
      // candidates cannot complete the three-option surface.
      const orderedCandidates = [
        ...candidates.filter(
          (candidate) => candidate.assessment.replacementTransition === undefined,
        ),
        ...candidates.filter(
          (candidate) => candidate.assessment.replacementTransition !== undefined,
        ),
      ];
      for (const candidate of orderedCandidates) {
        if (!candidate.available || optionsByTrait.has(candidate.traitKey)) continue;
        optionsByTrait.set(candidate.traitKey, {
          traitKey: candidate.traitKey,
          ...(candidate.rarity === undefined ? {} : { rarity: candidate.rarity }),
        });
        if (optionsByTrait.size === 3) break;
      }
      if (optionsByTrait.size < 3) continue;
      const optionValues = [...optionsByTrait.values()];
      if (optionValues.length !== 3) continue;
      const options = [optionValues[0]!, optionValues[1]!, optionValues[2]!] as const;
      current = applyProjectCommand(current, catalog, {
        kind: 'ReplaceTraitOffer',
        trait: createTraitOfferAddress(owner, invalid.acquisitionRole),
        value: Object.freeze({
          giverKey: invalid.offer.giverKey,
          options: Object.freeze(options),
          selectedOptionKey: 'option1',
        }),
      });
      changed = true;
    }
    if (!changed) return current;
  }
  throw new Error('trait fixture normalization exceeded its bounded edit budget');
}
