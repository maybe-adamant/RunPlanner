import type { KeepsakeSelectionAddress } from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import type { Catalog } from '../../catalog-schema';
import type { KeepsakeSelectionCandidateArtifacts } from '../candidate-artifacts';
import type { ProjectEvaluation } from '../project';
import {
  keepsakeSelectionUnavailableReason,
  type KeepsakeSelectionUnavailableReason,
} from '../keepsakes';
import { unavailableForBiome, type CandidateContextUnavailable } from './availability';

export type { KeepsakeSelectionUnavailableReason } from '../keepsakes';

export interface KeepsakeSelectionCandidateQuery {
  readonly kind: 'keepsakeSelection';
  readonly selection: KeepsakeSelectionAddress;
}

export interface KeepsakeSelectionCandidateOption {
  readonly key: string;
  readonly label: string;
  readonly selectedPossible: boolean;
  readonly unavailableReason?: KeepsakeSelectionUnavailableReason;
}

export interface EvaluatedKeepsakeSelectionCandidate {
  readonly kind: 'keepsakeSelection';
  readonly result: {
    readonly currentKey: string;
    readonly options: readonly KeepsakeSelectionCandidateOption[];
    /** The selected authored value remains assessable even when invalid. */
    readonly selectedPossible: boolean;
  };
}

export function evaluateKeepsakeSelectionCandidate(
  catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  artifacts: KeepsakeSelectionCandidateArtifacts,
  query: KeepsakeSelectionCandidateQuery,
): CandidateContextUnavailable | EvaluatedKeepsakeSelectionCandidate {
  const capability = artifacts.at(query.selection);
  if (capability === undefined)
    return unavailableForBiome(
      evaluation,
      query.selection.routeKey,
      query.selection.biomeKey,
      query.selection,
      'afterRoomLifecycle',
    );
  const options = Object.freeze(
    catalog.keepsakes.values.map((declaration) => {
      // Route start replaces the entire initial history, so it is deliberately
      // unconstrained by the selected baseline's derived Fated state.
      const reason =
        query.selection.owner === 'routeStart'
          ? undefined
          : keepsakeSelectionUnavailableReason(
              catalog,
              capability.state,
              declaration.key,
              capability.encounterBlockedKeepsakeKeys,
            );
      return Object.freeze({
        key: declaration.key,
        label: declaration.label,
        selectedPossible: reason === undefined,
        ...(reason === undefined ? {} : { unavailableReason: reason }),
      });
    }),
  );
  const route = _project.routes.find(
    (candidate) => candidate.routeKey === query.selection.routeKey,
  );
  const disposition =
    query.selection.owner === 'routeStart'
      ? undefined
      : route?.biomes.find((biome) => biome.biomeKey === query.selection.biomeKey)
          ?.postbossKeepsakeDisposition;
  const authoredKey =
    query.selection.owner === 'routeStart'
      ? route?.loadout.startingKeepsakeKey
      : disposition?.kind === 'replace'
        ? disposition.keepsakeKey
        : capability.state.currentKey;
  const authoredOption = options.find((option) => option.key === authoredKey);
  return Object.freeze({
    kind: 'keepsakeSelection',
    result: Object.freeze({
      currentKey: capability.state.currentKey,
      options,
      selectedPossible: authoredOption?.selectedPossible ?? false,
    }),
  });
}
