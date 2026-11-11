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

/** A choice about how a fight went. */
export type EncounterOutcomeChoice =
  'aetos' | 'gorgonCondition' | 'nemesisBet' | 'nemesisEvent' | 'anomalyCleared';

/**
 * Where an outcome is observed: the encounter itself for Aetos and the Gorgon
 * condition, its Combat event for a Nemesis bet or an Anomaly capture, and
 * her talk row for a Nemesis random event, which no fight runs for.
 */
export type EncounterOutcomeHost =
  | { readonly kind: 'encounter' }
  | { readonly kind: 'combat'; readonly eventKey: string }
  | {
      readonly kind: 'interaction';
      readonly action: { readonly kind: 'interactEncounter'; readonly phaseKey: string };
    };

export interface EncounterOutcome {
  readonly phaseKey: string;
  readonly host: EncounterOutcomeHost;
  /** In the room's choice order; Aetos and the Gorgon condition may share an outcome. */
  readonly choices: readonly EncounterOutcomeChoice[];
}

const ENCOUNTER_HOST: EncounterOutcomeHost = Object.freeze({ kind: 'encounter' as const });

/**
 * The outcomes of each phase of one entered room, one per host holding an
 * eligible choice or a value the room authors for one, which never vanishes. A Fig Leaf skip short-circuits the fight, so a skipped phase's
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
  const graph = room.roomActionRoster.eventGraph;
  const authored = room.encounters;
  return Object.freeze(
    graph.phases.flatMap((point): EncounterOutcome[] => {
      // A boss fight hosts none: its outcome is its Boss defeated.
      if (point.hostsOutcome !== true) return [];
      const fightHost: EncounterOutcomeHost =
        point.endsOnInteraction === true
          ? Object.freeze({
              kind: 'interaction' as const,
              action: Object.freeze({
                kind: 'interactEncounter' as const,
                phaseKey: point.phaseKey,
              }),
            })
          : Object.freeze({
              kind: 'combat' as const,
              eventKey: `encounterStarted:${point.phaseKey}`,
            });
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
      const encounterChoices: EncounterOutcomeChoice[] = [];
      if (
        authored.aetosWaveByPhase?.[point.phaseKey] !== undefined ||
        (aetos !== undefined && aetos.waves.length > 0)
      )
        encounterChoices.push('aetos');
      if (
        authored.gorgonResultByPhase[point.phaseKey]?.athenaTriggerConditionMet === true ||
        (!skipped &&
          encounterPhaseGorgonSupportForProjectEvaluationAssembly(assembly, phase)?.supported ===
            true)
      )
        encounterChoices.push('gorgonCondition');
      const fightChoices: EncounterOutcomeChoice[] = [];
      if (!skipped) {
        if (definition?.goldBet !== undefined) fightChoices.push('nemesisBet');
        // A trade's answer or a contest's result is chosen; a free item is given, and an
        // unchosen family leaves nothing to answer yet.
        const nemesisEvent = authored.nemesisRandomEventByPhase?.[point.phaseKey];
        if (
          nemesisEvent != null &&
          nemesisEvent.kind !== 'freeItem' &&
          point.endsOnInteraction === true
        )
          fightChoices.push('nemesisEvent');
        if (room.anomalyReplacement !== undefined) fightChoices.push('anomalyCleared');
      }
      return [
        ...(encounterChoices.length === 0
          ? []
          : [
              Object.freeze({
                phaseKey: point.phaseKey,
                host: ENCOUNTER_HOST,
                choices: Object.freeze(encounterChoices),
              }),
            ]),
        ...(fightChoices.length === 0
          ? []
          : [
              Object.freeze({
                phaseKey: point.phaseKey,
                host: fightHost,
                choices: Object.freeze(fightChoices),
              }),
            ]),
      ];
    }),
  );
}
