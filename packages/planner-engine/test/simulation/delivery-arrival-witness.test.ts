import { describe, expect, it } from 'vitest';

import type { Catalog } from '@run-planner/engine/catalog-schema';
import { simulateProject } from '@run-planner/engine/simulation';

import {
  createBiomeAddress,
  createOccurrenceAddress,
  semanticAddressKey,
} from '../../src/authored-project/addresses';
import { parseClockedTraitGeneratedPickupEntryKey } from '../../src/authored-project/acquisition/pickup-producers';
import {
  hermesShrineDeliveryEntryKey,
  isDeliveryFlushHost,
  parseHermesShrineDeliveryEntryKey,
} from '../../src/authored-project/hermes-shrine-delivery';
import type { ProjectDocument } from '../../src/authored-project/model';
import { equivalenceCorpus } from '../equivalence/corpus';

/**
 * Witness for deriving a delivery's and a clocked drop's arrival at room
 * entry: the pending countdowns and clocks the walk holds as it enters the
 * room, counted down over the room's encounters that run end effects, must
 * land on the encounter end the stored reference names.
 */

type Arrival = string | 'flush' | 'rush' | 'not derivable at entry' | 'never in this room';

interface Comparison {
  readonly project: string;
  readonly room: string;
  readonly entryKey: string;
  readonly stored: string | undefined;
  readonly derived: Arrival;
}

function compareProject(name: string, catalog: Catalog, project: ProjectDocument): Comparison[] {
  const result = simulateProject(catalog, project);
  const comparisons: Comparison[] = [];
  for (const evaluation of result.route.biomes) {
    if (!('rewards' in evaluation) || !('history' in evaluation)) continue;
    const plan = project.route.biomes.find((biome) => biome.biomeKey === evaluation.biomeKey);
    if (plan?.topology == null) continue;
    const biome = createBiomeAddress(project.route.routeKey, evaluation.biomeKey);
    const routePosition = {
      ordinal: project.route.itineraryBiomeKeys.indexOf(evaluation.biomeKey) + 1,
    };
    const events = evaluation.history.events;
    for (const occurrence of plan.topology.occurrences) {
      const references = occurrence.roomActions.order.filter(
        (reference) =>
          reference.kind === 'interactAcquisitionEntry' &&
          (reference.siteKey === 'hermesShrineDelivery' ||
            parseClockedTraitGeneratedPickupEntryKey(reference.entryKey) !== undefined),
      );
      if (references.length === 0) continue;
      const origin = createOccurrenceAddress(biome, occurrence.occurrenceId);
      const originKey = semanticAddressKey(origin);
      // A Ship room publishes its state before each phase instead of at entry;
      // nothing ends between its entry and its first phase's start.
      const entry = evaluation.rewards.runStateSnapshots.find(
        (snapshot) =>
          (snapshot.checkpoint === 'roomEntered' ||
            snapshot.checkpoint === 'beforeEncounterStart') &&
          snapshot.owner.kind === 'roomRunStateCheckpoint' &&
          snapshot.owner.biomeKey === biome.biomeKey &&
          snapshot.owner.occurrenceId === occurrence.occurrenceId,
      );
      // An unreached room has no walk at its entry to derive from.
      if (entry === undefined) continue;
      const declaration = catalog.rooms.byKey[occurrence.gameName];
      const roomEvents = events.filter(
        (event) => 'origin' in event && semanticAddressKey(event.origin) === originKey,
      );
      const encounterKeyByPhase = new Map<string, string>();
      for (const event of roomEvents)
        if (event.kind === 'encounterStarted')
          encounterKeyByPhase.set(event.phaseKey, event.encounterKey);
      const endEffects = roomEvents.flatMap((event) =>
        event.kind === 'encounterEndEffectsApplied' ? [event.phaseKey] : [],
      );
      const deliveryEnds = endEffects.filter(
        (phaseKey) =>
          declaration?.advancesHermesShrineDeliveryUses === true &&
          declaration.ignoreEncounterUses !== true &&
          catalog.encounterDefinitions.byKey[encounterKeyByPhase.get(phaseKey) ?? '']
            ?.advancesHermesShrineDeliveryUses === true,
      );
      const clockEnds = declaration?.skipRoomsPerUpgrade === true ? [] : endEffects;
      const deferredClock =
        declaration?.skipTimedDropResources === true ||
        (biome.routeKey === 'Dream' && declaration?.skipTimedDropResourcesInDream === true);
      for (const reference of references) {
        if (reference.kind !== 'interactAcquisitionEntry') continue;
        let derived: Arrival;
        const source =
          reference.siteKey === 'hermesShrineDelivery'
            ? parseHermesShrineDeliveryEntryKey(reference.entryKey)
            : undefined;
        if (
          source !== undefined &&
          source.sourceOccurrenceId === occurrence.occurrenceId &&
          source.biomeKey === biome.biomeKey
        )
          // A rushed item arrives at its rush in the Shrine room, not at an encounter end.
          derived = 'rush';
        else if (reference.siteKey === 'hermesShrineDelivery') {
          const pending = Object.values(entry.pendingHermesShrineDeliveries).find(
            (delivery) =>
              hermesShrineDeliveryEntryKey(delivery.source, delivery.generationKey) ===
              reference.entryKey,
          );
          if (pending === undefined) derived = 'not derivable at entry';
          else if (
            pending.due?.cause === 'flush' ||
            (pending.due === undefined && isDeliveryFlushHost(declaration, routePosition))
          )
            derived = 'flush';
          else if (pending.due !== undefined) derived = 'not derivable at entry';
          else derived = deliveryEnds[pending.remainingUses - 1] ?? 'never in this room';
        } else {
          const clocked = parseClockedTraitGeneratedPickupEntryKey(reference.entryKey)!;
          const trait = Object.values(entry.traits.equippedTraits).find(
            (candidate) => candidate.acquisitionIdentity === clocked.acquisitionIdentity,
          );
          if (trait?.pickupProducerInterval === undefined) derived = 'not derivable at entry';
          else {
            const progress = trait.pickupProducerProgress ?? 0;
            const interval = trait.pickupProducerInterval;
            const index = Math.max(0, interval - progress - 1);
            // A deferring room never matures a clock; it waits at its threshold.
            derived = deferredClock
              ? 'never in this room'
              : (clockEnds[index] ?? 'never in this room');
          }
        }
        comparisons.push({
          project: name,
          room: `${evaluation.biomeKey}/${occurrence.occurrenceId}/${occurrence.gameName}`,
          entryKey: reference.entryKey,
          stored: reference.encounterPhaseKey,
          derived,
        });
      }
    }
  }
  return comparisons;
}

describe('delivery and clocked-drop arrival derived at room entry', () => {
  const comparisons = equivalenceCorpus().flatMap((entry) =>
    compareProject(entry.name, entry.catalog, entry.project()),
  );

  it('reaches stored delivery and clocked-drop references across the corpus', () => {
    expect(comparisons.some((comparison) => comparison.stored !== undefined)).toBe(true);
    expect(comparisons.some((comparison) => comparison.derived === 'flush')).toBe(true);
    expect(comparisons.some((comparison) => comparison.derived === 'rush')).toBe(true);
    expect(
      comparisons.some(
        (comparison) =>
          comparison.stored !== undefined &&
          comparison.entryKey.startsWith('clockedTraitGenerated:'),
      ),
    ).toBe(true);
  });

  it('equals the stored encounter phase wherever one is stored', () => {
    const disagreements = comparisons.filter(
      (comparison) =>
        (comparison.stored ?? (comparison.derived === 'rush' ? 'rush' : 'flush')) !==
        comparison.derived,
    );
    expect(disagreements).toEqual([]);
  });
});
