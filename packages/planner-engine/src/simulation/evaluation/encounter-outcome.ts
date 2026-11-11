import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  semanticAddressKey,
  type OccurrenceAddress,
} from '../../authored-project/addresses';
import type { Catalog } from '../../catalog-schema';
import { candidateBiome, candidateBiomeRooms } from '../candidates/evaluated-biome';
import type { ProjectEvaluationAssembly } from './evaluation-products';
import type { RoomLifecycleTimeline } from '../room-actions';
import {
  encounterPhaseGorgonSupportForProjectEvaluationAssembly,
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
} from './project-evaluation-assembly';

/** A choice about how a fight went, observed at its Combat. */
export type EncounterOutcomeChoice =
  'aetos' | 'gorgonCondition' | 'nemesisBet' | 'nemesisEvent' | 'anomalyCleared';

/**
 * Where an outcome is observed: its phase's Combat event, or, for a Nemesis
 * random event no encounter runs for, her talk row.
 */
export type EncounterOutcomeHost =
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

/**
 * The outcome of each phase of one entered room whose Combat (or Nemesis talk row) hosts
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
  const graph = room.roomActionRoster.eventGraph;
  const authored = room.encounters;
  return Object.freeze(
    graph.phases.flatMap((point): EncounterOutcome[] => {
      if (point.hostsOutcome !== true || graph.profileKey === 'BossRoom') return [];
      const host: EncounterOutcomeHost =
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
          : [Object.freeze({ phaseKey: point.phaseKey, host, choices: Object.freeze(choices) })];
      if (definition?.goldBet !== undefined) choices.push('nemesisBet');
      // A trade's answer or a contest's result is chosen; a free item is given, and an
      // unchosen family leaves nothing to answer yet.
      const nemesisEvent = authored.nemesisRandomEventByPhase?.[point.phaseKey];
      if (
        nemesisEvent != null &&
        nemesisEvent.kind !== 'freeItem' &&
        point.endsOnInteraction === true
      )
        choices.push('nemesisEvent');
      if (room.anomalyReplacement !== undefined) choices.push('anomalyCleared');
      return choices.length === 0
        ? []
        : [Object.freeze({ phaseKey: point.phaseKey, host, choices: Object.freeze(choices) })];
    }),
  );
}

/**
 * The room's Timeline as the walk evaluated it: an encounter with no gate shows
 * its begin and Combat as one marker unless an outcome is observed at that
 * Combat, when they show apart. Undefined for a room the evaluated biome does
 * not hold.
 */
export function roomLifecycleTimelineForProjectEvaluationAssembly(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  occurrence: OccurrenceAddress,
): RoomLifecycleTimeline | undefined {
  const biome = candidateBiome(assembly.evaluation, occurrence.routeKey, occurrence.biomeKey);
  if (biome === undefined) return undefined;
  const key = semanticAddressKey(occurrence);
  const room = candidateBiomeRooms(biome).find(
    (candidate) => semanticAddressKey(candidate.origin) === key,
  );
  if (room === undefined) return undefined;
  const timeline = room.roomLifecycleTimeline;
  const observed = new Set(
    (encounterOutcomesForProjectEvaluationAssembly(catalog, assembly, occurrence) ?? []).flatMap(
      (outcome) => (outcome.host.kind === 'combat' ? [outcome.phaseKey] : []),
    ),
  );
  if (observed.size === 0) return timeline;
  return Object.freeze({
    ...timeline,
    entries: Object.freeze(
      timeline.entries.map((entry) =>
        entry.kind === 'boundary' &&
        entry.boundary.kind === 'encounterBegun' &&
        entry.markers === 'merged' &&
        observed.has(entry.boundary.phaseKey)
          ? Object.freeze({ ...entry, markers: 'split' as const })
          : entry,
      ),
    ),
  });
}
