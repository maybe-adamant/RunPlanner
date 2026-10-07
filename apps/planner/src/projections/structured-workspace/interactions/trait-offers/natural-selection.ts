import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { EvaluatedNaturalSelectionResultCandidate } from '@run-planner/engine/simulation';

import { projectDirectTraitOutcomePicker } from '@planner/projections/contextual/directTraitOutcomeProjection';
import type { WorkspaceNaturalSelectionDomain } from '@planner/projections/structured-workspace/contracts/traits';

type NaturalSelectionDraftShape = Pick<
  EvaluatedNaturalSelectionResultCandidate['result'],
  'firstPassRows' | 'completedTargets' | 'levelCountsByTraitKey'
>;

/** First-pass rows for the queried targets, each keeping its own target selected. */
export function projectNaturalSelectionDomain(
  catalog: Catalog,
  complete: boolean,
  shape: NaturalSelectionDraftShape,
  targets: readonly string[],
): WorkspaceNaturalSelectionDomain {
  const label = (traitKey: string) => catalog.traits.byKey[traitKey]?.label ?? traitKey;
  const levels =
    shape.levelCountsByTraitKey === undefined
      ? undefined
      : Object.entries(shape.levelCountsByTraitKey)
          .map(([traitKey, count]) => `${label(traitKey)} ×${count}`)
          .join(' · ');
  return Object.freeze({
    complete,
    rows: Object.freeze(
      shape.firstPassRows.map((row, index) => {
        const own = targets[index];
        const values =
          own === undefined || row.availableTraitKeys.includes(own)
            ? row.availableTraitKeys
            : [...row.availableTraitKeys, own];
        return Object.freeze({
          picker: projectDirectTraitOutcomePicker(
            values.map((traitKey) =>
              Object.freeze({
                value: traitKey,
                support: row.availableTraitKeys.includes(traitKey)
                  ? ('possible' as const)
                  : ('impossible' as const),
                branchSupport: Object.freeze([]),
                selected: traitKey === own,
                ...(row.availableTraitKeys.includes(traitKey)
                  ? {}
                  : { reason: 'unavailable' as const }),
              }),
            ),
            label,
            (traitKey) => traitKey,
          ),
          requiresEarlierRow: row.requiresEarlierRow,
          ...(row.forcedTraitKey === undefined ? {} : { forcedTraitKey: row.forcedTraitKey }),
        });
      }),
    ),
    ...(shape.completedTargets === undefined ? {} : { completedTargets: shape.completedTargets }),
    ...(levels === undefined ? {} : { levelsLabel: levels }),
  });
}
