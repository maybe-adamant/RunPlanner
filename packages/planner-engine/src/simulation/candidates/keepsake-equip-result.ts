import type { KeepsakeEquipResultAddress } from '../../authored-project/addresses';
import type { AuthoredKeepsakeEquipResults, ProjectDocument } from '../../authored-project/model';
import type { Catalog } from '../../catalog-schema';
import type { KeepsakeEquipResultCandidateArtifacts } from '../candidate-artifacts';
import type { ProjectEvaluation } from '../project';
import { assessJeweledPomEquipResult, keepsakeEffectByKind } from '../keepsakes';
import { unavailableForBiome, type CandidateContextUnavailable } from './availability';

export interface KeepsakeEquipResultCandidateQuery {
  readonly kind: 'keepsakeEquipResult';
  readonly result: KeepsakeEquipResultAddress & { readonly resultKind: 'jeweledPom' };
  readonly value?: AuthoredKeepsakeEquipResults['jeweledPom'];
}

export interface EvaluatedKeepsakeEquipResultCandidate {
  readonly kind: 'keepsakeEquipResult';
  readonly result: {
    readonly options: readonly {
      readonly traitKey: string;
      readonly selectedPossible: boolean;
      readonly findings: readonly string[];
    }[];
    readonly selectedPossible: boolean;
  };
}

function authoredValue(
  project: ProjectDocument,
  address: KeepsakeEquipResultAddress,
): AuthoredKeepsakeEquipResults['jeweledPom'] | undefined {
  const route = project.routes.find((candidate) => candidate.routeKey === address.routeKey);
  if (address.selection.owner === 'routeStart')
    return route?.loadout.keepsakeEquipResults?.jeweledPom;
  return route?.biomes.find((biome) => biome.biomeKey === address.biomeKey)?.keepsakeEquipResults
    ?.jeweledPom;
}

/**
 * A Jeweled Pom result is a single source-random acquisition. This evaluates
 * its one selected Hades trait at the captured pre-equip frontier; it does not
 * fabricate trait-offer composition or expose the trait history to consumers.
 */
export function evaluateKeepsakeEquipResultCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  artifacts: KeepsakeEquipResultCandidateArtifacts,
  query: KeepsakeEquipResultCandidateQuery,
): CandidateContextUnavailable | EvaluatedKeepsakeEquipResultCandidate {
  const capability = artifacts.at(query.result);
  if (capability === undefined)
    return unavailableForBiome(
      evaluation,
      query.result.routeKey,
      query.result.biomeKey,
      query.result,
      'afterRoomLifecycle',
    );
  const value = query.value ?? authoredValue(project, query.result);
  const effect = keepsakeEffectByKind(catalog, query.result.resultKind);
  if (effect === undefined) throw new Error(`missing ${query.result.resultKind} descriptor`);
  const options = Object.freeze(
    (catalog.traitGivers.byKey[effect.giverKey]?.traitKeys ?? []).map((traitKey) => {
      const assessments = capability.frontiers.map((frontier) =>
        assessJeweledPomEquipResult(
          catalog,
          { ...(value ?? {}), traitKey },
          frontier.before,
          frontier.fatedStatus,
        ),
      );
      return Object.freeze({
        traitKey,
        selectedPossible: assessments.every((assessment) => assessment.legal),
        findings: Object.freeze([
          ...new Set(assessments.flatMap((assessment) => assessment.findings)),
        ]),
      });
    }),
  );
  const selected =
    value === undefined ? undefined : options.find((option) => option.traitKey === value.traitKey);
  return Object.freeze({
    kind: 'keepsakeEquipResult',
    result: Object.freeze({ options, selectedPossible: selected?.selectedPossible ?? false }),
  });
}
