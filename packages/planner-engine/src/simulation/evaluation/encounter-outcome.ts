import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  semanticAddressKey,
  type OccurrenceAddress,
} from '../../authored-project/addresses';
import type { Catalog } from '../../catalog-schema';
import { candidateBiome, candidateBiomeRooms } from '../candidates/evaluated-biome';
import type { ProjectEvaluationAssembly } from './evaluation-products';
import {
  encounterPhaseGorgonSupportForProjectEvaluationAssembly,
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
} from './project-evaluation-assembly';

/** A choice about how a fight ended, hosted by its Encounter outcome. */
export type EncounterOutcomeChoice =
  'aetos' | 'gorgonCondition' | 'nemesisBet' | 'nemesisEvent' | 'anomalyCleared';

export interface EncounterOutcome {
  readonly phaseKey: string;
  /** In the room's choice order; Aetos and the Gorgon condition may share an outcome. */
  readonly choices: readonly EncounterOutcomeChoice[];
}

/**
 * The Encounter outcome of each phase of one entered room whose outcome hosts
 * an eligible choice, or a value the room authors for one, which never
 * vanishes. A Fig Leaf skip short-circuits the fight, so a skipped phase's
 * outcome hosts only such authored values, left for repair. Only what the walk
 * reached is eligible: an outcome it did not reach hosts its authored values
 * and fixed choices. Undefined for a room the evaluated biome does not enter.
 */
export function encounterOutcomesForProjectEvaluationAssembly(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  occurrence: OccurrenceAddress,
): readonly EncounterOutcome[] | undefined {
  const biome = candidateBiome(assembly.evaluation, occurrence.routeKey, occurrence.biomeKey);
  if (biome === undefined) return undefined;
  const key = semanticAddressKey(occurrence);
  const room = candidateBiomeRooms(biome).find(
    (candidate) => semanticAddressKey(candidate.origin) === key,
  );
  if (room === undefined || !room.entered) return undefined;
  const structure = room.roomActionRoster.lifecycleStructure;
  const authored = room.encounters;
  return Object.freeze(
    structure.points.flatMap((point): EncounterOutcome[] => {
      if (point.kind !== 'encounterOutcome') return [];
      const phase = createEncounterPhaseAddress(
        createBiomeAddress(occurrence.routeKey, occurrence.biomeKey),
        { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
        point.phaseKey,
      );
      const status = encounterPhaseSequenceStatusForProjectEvaluationAssembly(assembly, phase);
      if (status?.kind !== 'active') return [];
      const skipped = status.execution === 'skippedByFigLeaf';
      const definition =
        status.encounterDefinitionKey === undefined
          ? undefined
          : catalog.encounterDefinitions.byKey[status.encounterDefinitionKey];
      const aetos = skipped ? undefined : status.aetos;
      const choices: EncounterOutcomeChoice[] = [];
      if (
        authored.aetosWaveByPhase?.[point.phaseKey] !== undefined ||
        (aetos !== undefined && aetos.waves.length > 0)
      )
        choices.push('aetos');
      if (
        authored.gorgonResultByPhase[point.phaseKey]?.athenaTriggerConditionMet === true ||
        (!skipped &&
          encounterPhaseGorgonSupportForProjectEvaluationAssembly(assembly, phase)?.supported ===
            true)
      )
        choices.push('gorgonCondition');
      if (skipped)
        return choices.length === 0
          ? []
          : [Object.freeze({ phaseKey: point.phaseKey, choices: Object.freeze(choices) })];
      if (definition?.goldBet !== undefined) choices.push('nemesisBet');
      if (
        structure.phases.some(
          (candidate) =>
            candidate.phaseKey === point.phaseKey && candidate.endsOnInteraction === true,
        )
      )
        choices.push('nemesisEvent');
      if (room.anomalyReplacement !== undefined) choices.push('anomalyCleared');
      return choices.length === 0
        ? []
        : [Object.freeze({ phaseKey: point.phaseKey, choices: Object.freeze(choices) })];
    }),
  );
}
