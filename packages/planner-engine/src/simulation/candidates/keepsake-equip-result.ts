import type { KeepsakeEquipResultAddress } from '../../authored-project/addresses';
import type {
  AuthoredKeepsakeEquipResultValue,
  AuthoredKeepsakeEquipResults,
  ProjectDocument,
} from '../../authored-project/model';
import type { Catalog } from '../../catalog-schema';
import {
  type KeepsakeEquipResultCandidateArtifacts,
  type KeepsakeEquipResultCandidateCapability,
  type KeepsakeSelectionCandidateArtifacts,
} from '../keepsakes/candidate-artifacts';
import type { ProjectEvaluation } from '../evaluation/evaluation-products';
import {
  assessExperimentalHammerEquipResult,
  assessJeweledPomEquipResult,
  assessTranscendentEmbryoBlessing,
  transcendentEmbryoBlessingValues,
} from '../keepsakes/trait-effects';
import { keepsakeEffectByKind, keepsakeEquipResultKind } from '../keepsakes/state';
import { unavailable, unavailableForBiome, type CandidateContextUnavailable } from './availability';

export interface KeepsakeEquipResultCandidateQuery {
  readonly kind: 'keepsakeEquipResult';
  readonly result: KeepsakeEquipResultAddress;
  readonly value?: AuthoredKeepsakeEquipResultValue;
  /**
   * A keepsake drafted at the result's selection but not yet authored: the result is judged
   * at that selection's frontier as if the keepsake were chosen, and only `value` is selected.
   */
  readonly keepsakeKey?: string;
}

export interface EvaluatedKeepsakeEquipResultCandidate {
  readonly kind: 'keepsakeEquipResult';
  readonly result: {
    readonly options: readonly {
      readonly resultKind: 'jeweledPom' | 'experimentalHammer' | 'transcendentEmbryo';
      readonly value:
        | NonNullable<AuthoredKeepsakeEquipResults['experimentalHammer']>
        | NonNullable<AuthoredKeepsakeEquipResults['transcendentEmbryo']>
        | {
            readonly traitKey: string;
            readonly rarity?: import('../../catalog-schema').TraitRarity;
          };
      readonly selectedPossible: boolean;
      readonly findings: readonly string[];
      /** Declaration-derived presentation facts for Embryo's immediate grant. */
      readonly transcendentEmbryoSummary?: {
        readonly rarity: import('../../catalog-schema').InRunTraitRarity;
        readonly operands: readonly import('../../catalog-schema').ChaosNumericOperand[];
      };
    }[];
    readonly selectedPossible: boolean;
  };
}

function authoredValue(
  project: ProjectDocument,
  address: KeepsakeEquipResultAddress,
): AuthoredKeepsakeEquipResultValue | undefined {
  const route = project.route.routeKey === address.routeKey ? project.route : undefined;
  if (address.selection.kind === 'echoKeepsakeReplay') {
    const replay = route?.biomes.find(
      (biome) => biome.biomeKey === address.biomeKey,
    )?.echoKeepsakeReplayResults;
    return address.resultKind === 'experimentalHammer'
      ? replay?.experimentalHammer
      : address.resultKind === 'transcendentEmbryo'
        ? replay?.transcendentEmbryo
        : undefined;
  }
  if (address.selection.owner === 'routeStart')
    return route?.loadout.keepsakeEquipResults?.[address.resultKind];
  const postbossOwner = address.selection.owner;
  return route?.biomes
    .find((biome) => biome.biomeKey === address.biomeKey)
    ?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === postbossOwner.occurrenceId,
    )?.keepsakeRack?.equipResults?.[address.resultKind];
}

/** The keepsake authored at a result's selection, or null when it leaves the held one. */
function authoredKeepsakeKey(
  project: ProjectDocument,
  address: KeepsakeEquipResultAddress,
): string | null | undefined {
  const { selection } = address;
  if (selection.kind === 'echoKeepsakeReplay') return undefined;
  const route = project.route.routeKey === address.routeKey ? project.route : undefined;
  if (selection.owner === 'routeStart') return route?.loadout.startingKeepsakeKey;
  const postbossOwner = selection.owner;
  return route?.biomes
    .find((biome) => biome.biomeKey === address.biomeKey)
    ?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === postbossOwner.occurrenceId,
    )?.keepsakeRack?.keepsakeKey;
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
  selections: KeepsakeSelectionCandidateArtifacts,
  query: KeepsakeEquipResultCandidateQuery,
): CandidateContextUnavailable | EvaluatedKeepsakeEquipResultCandidate {
  const drafted =
    query.keepsakeKey !== undefined &&
    query.keepsakeKey !== authoredKeepsakeKey(project, query.result);
  let capability: KeepsakeEquipResultCandidateCapability | undefined;
  if (drafted) {
    const { selection } = query.result;
    if (selection.kind === 'echoKeepsakeReplay')
      throw new Error('an Echo keepsake replay has no drafted keepsake');
    if (keepsakeEquipResultKind(catalog, query.keepsakeKey!) !== query.result.resultKind)
      throw new Error(`${query.keepsakeKey} does not open a ${query.result.resultKind} result`);
    const site = selections.at(selection);
    capability = site?.equipResultFor(query.keepsakeKey!)?.capability;
    // A reached selection that cannot equip the drafted keepsake opens no result.
    if (site !== undefined && capability === undefined)
      return unavailable({ kind: 'targetNotReachable', target: query.result });
  } else capability = artifacts.at(query.result);
  if (capability === undefined)
    return unavailableForBiome(
      evaluation,
      query.result.routeKey,
      query.result.biomeKey,
      query.result,
      'afterRoomLifecycle',
    );
  // A drafted keepsake has no authored result yet; the saved one belongs to another keepsake.
  const value = drafted ? query.value : (query.value ?? authoredValue(project, query.result));
  const effect = keepsakeEffectByKind(catalog, query.result.resultKind);
  if (effect === undefined) throw new Error(`missing ${query.result.resultKind} descriptor`);
  const { state } = capability;
  if (effect.kind === 'transcendentEmbryo') {
    const rarity = capability.transcendentEmbryoRarity ?? 'Epic';
    const assessEmbryo = (
      candidate: NonNullable<AuthoredKeepsakeEquipResults['transcendentEmbryo']>,
    ) =>
      assessTranscendentEmbryoBlessing(catalog, candidate, state.traitHistory, rarity, {
        aspectKey: state.equipment.aspectKey,
        routeKey: state.reached.routePosition.routeKey,
      });
    const options = Object.freeze(
      catalog.chaos.blessings.values
        .filter((blessing) => blessing.fixedRarity === undefined)
        .map((blessing) => {
          const values = transcendentEmbryoBlessingValues(catalog, blessing.key, rarity);
          const candidateValue = Object.freeze({
            blessingKey: blessing.key,
            blessingValues: values,
          });
          const assessment = assessEmbryo(candidateValue);
          return Object.freeze({
            resultKind: 'transcendentEmbryo' as const,
            value: candidateValue,
            selectedPossible: assessment.legal,
            findings: Object.freeze([...new Set(assessment.findings)]),
            transcendentEmbryoSummary: Object.freeze({
              rarity,
              operands: blessing.operands,
            }),
          });
        }),
    );
    const selected =
      value === undefined
        ? undefined
        : options.find((option) => JSON.stringify(option.value) === JSON.stringify(value));
    // The option list intentionally exposes declaration defaults as a compact
    // authoring surface. A persisted Embryo result may contain a different,
    // still legal roll, so selectedPossible must assess the authored value
    // itself rather than require byte equality with the default option.
    const authoredSelectedPossible =
      value !== undefined && 'blessingKey' in value
        ? assessEmbryo(value as NonNullable<AuthoredKeepsakeEquipResults['transcendentEmbryo']>)
            .legal
        : undefined;
    return Object.freeze({
      kind: 'keepsakeEquipResult',
      result: Object.freeze({
        options,
        selectedPossible: authoredSelectedPossible ?? selected?.selectedPossible ?? false,
      }),
    });
  }
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
      const assessment =
        effect.kind === 'jeweledPom'
          ? assessJeweledPomEquipResult(
              catalog,
              candidateValue as NonNullable<AuthoredKeepsakeEquipResults['jeweledPom']>,
              state,
              state.keepsakes.fatedStatus,
            )
          : assessExperimentalHammerEquipResult(
              catalog,
              candidateValue as NonNullable<AuthoredKeepsakeEquipResults['experimentalHammer']>,
              state,
            );
      return Object.freeze({
        resultKind: effect.kind,
        value: candidateValue,
        selectedPossible: assessment.legal,
        findings: Object.freeze([...new Set(assessment.findings)]),
      });
    }),
  );
  const exhaustedPossible =
    effect.kind === 'experimentalHammer' &&
    assessExperimentalHammerEquipResult(catalog, { kind: 'exhausted' }, state).legal;
  const completedOptions =
    effect.kind !== 'experimentalHammer'
      ? options
      : Object.freeze([
          ...options,
          Object.freeze({
            resultKind: 'experimentalHammer' as const,
            value: Object.freeze({ kind: 'exhausted' as const }),
            selectedPossible: exhaustedPossible,
            findings: Object.freeze(exhaustedPossible ? [] : ['keepsakeEquipResultUnavailable']),
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
