import type { KeepsakeEquipResultAddress } from '../../authored-project/addresses';
import type { AuthoredKeepsakeEquipResults, ProjectDocument } from '../../authored-project/model';
import type { Catalog } from '../../catalog-schema';
import type { KeepsakeEquipResultCandidateArtifacts } from '../candidate-artifacts';
import type { ProjectEvaluation } from '../project';
import {
  assessExperimentalHammerEquipResult,
  assessJeweledPomEquipResult,
  keepsakeEffectByKind,
} from '../keepsakes';
import { unavailableForBiome, type CandidateContextUnavailable } from './availability';

export interface KeepsakeEquipResultCandidateQuery {
  readonly kind: 'keepsakeEquipResult';
  readonly result: KeepsakeEquipResultAddress;
  readonly value?: AuthoredKeepsakeEquipResults[keyof AuthoredKeepsakeEquipResults];
}

export interface EvaluatedKeepsakeEquipResultCandidate {
  readonly kind: 'keepsakeEquipResult';
  readonly result: {
    readonly options: readonly {
      readonly resultKind: 'jeweledPom' | 'experimentalHammer';
      readonly value:
        | NonNullable<AuthoredKeepsakeEquipResults['experimentalHammer']>
        | {
            readonly traitKey: string;
            readonly rarity?: import('../../catalog-schema').TraitRarity;
          };
      readonly selectedPossible: boolean;
      readonly findings: readonly string[];
    }[];
    readonly selectedPossible: boolean;
  };
}

function authoredValue(
  project: ProjectDocument,
  address: KeepsakeEquipResultAddress,
): AuthoredKeepsakeEquipResults[keyof AuthoredKeepsakeEquipResults] | undefined {
  const route = project.routes.find((candidate) => candidate.routeKey === address.routeKey);
  if (address.selection.kind === 'echoKeepsakeReplay')
    return route?.biomes.find((biome) => biome.biomeKey === address.biomeKey)
      ?.echoKeepsakeReplayResults?.experimentalHammer;
  if (address.selection.owner === 'routeStart')
    return route?.loadout.keepsakeEquipResults?.[address.resultKind];
  return route?.biomes.find((biome) => biome.biomeKey === address.biomeKey)?.keepsakeEquipResults?.[
    address.resultKind
  ];
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
  const traitKeys =
    effect.kind === 'jeweledPom'
      ? (catalog.traitGivers.byKey[effect.giverKey]?.traitKeys ?? [])
      : catalog.traits.values
          .filter((trait) => trait.hammerCompatibility !== undefined)
          .map((trait) => trait.key);
  const options = Object.freeze(
    traitKeys.map((traitKey) => {
      const candidateValue =
        effect.kind === 'experimentalHammer'
          ? ({ kind: 'selected' as const, traitKey } as const)
          : ({ ...(value ?? {}), traitKey } as const);
      const assessments = capability.frontiers.map((frontier) =>
        effect.kind === 'jeweledPom'
          ? assessJeweledPomEquipResult(
              catalog,
              candidateValue as NonNullable<AuthoredKeepsakeEquipResults['jeweledPom']>,
              frontier.before,
              frontier.fatedStatus,
            )
          : assessExperimentalHammerEquipResult(
              catalog,
              candidateValue as NonNullable<AuthoredKeepsakeEquipResults['experimentalHammer']>,
              frontier.before,
              frontier.loadout ?? { weaponKey: '', aspectKey: '' },
            ),
      );
      return Object.freeze({
        resultKind: effect.kind,
        value: candidateValue,
        selectedPossible: assessments.every((assessment) => assessment.legal),
        findings: Object.freeze([
          ...new Set(assessments.flatMap((assessment) => assessment.findings)),
        ]),
      });
    }),
  );
  const completedOptions =
    effect.kind !== 'experimentalHammer'
      ? options
      : Object.freeze([
          ...options,
          Object.freeze({
            resultKind: 'experimentalHammer' as const,
            value: Object.freeze({ kind: 'exhausted' as const }),
            selectedPossible: capability.frontiers.every(
              (frontier) =>
                assessExperimentalHammerEquipResult(
                  catalog,
                  { kind: 'exhausted' },
                  frontier.before,
                  frontier.loadout ?? { weaponKey: '', aspectKey: '' },
                ).legal,
            ),
            findings: Object.freeze(
              capability.frontiers.every(
                (frontier) =>
                  assessExperimentalHammerEquipResult(
                    catalog,
                    { kind: 'exhausted' },
                    frontier.before,
                    frontier.loadout ?? { weaponKey: '', aspectKey: '' },
                  ).legal,
              )
                ? []
                : ['keepsakeEquipResultUnavailable'],
            ),
          }),
        ]);
  const selected =
    value === undefined
      ? undefined
      : completedOptions.find((option) => JSON.stringify(option.value) === JSON.stringify(value));
  return Object.freeze({
    kind: 'keepsakeEquipResult',
    result: Object.freeze({
      options: completedOptions,
      selectedPossible: selected?.selectedPossible ?? false,
    }),
  });
}
