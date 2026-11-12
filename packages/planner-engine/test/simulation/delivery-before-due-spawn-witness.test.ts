import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  roomActionKey,
} from '@run-planner/engine/authored-project';
import { createAuthoringSession } from '@run-planner/engine/authoring';
import {
  derivedAcquisitionEntriesForProjectEvaluationAssembly,
  simulateProjectAssembly,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import { surfaceShrineTravelDealProject } from '@run-planner/test-fixtures/surface';

import { corpusRooms } from '../support/lifecycle-snapshots';

/**
 * A Shrine delivery due at a Ship room's Combat1 end effects, ranked between
 * the wheel1 choice and the wheel1 reward pickup. It stands after the Intro's
 * end effects, so it meets the structural bound "after an end-effects event of
 * this room", yet before its due spawn: Combat1's end effects wait on the
 * wheel reward pickup ranked after it.
 */
const biome = createBiomeAddress('Surface', 'O');
const shipId = createOccurrenceId('surface-o-combat04');
const choice = roomActionKey({ kind: 'chooseRewardWheel', wheelKey: 'wheel1' });
const pickup = roomActionKey({ kind: 'interactWheelReward', wheelKey: 'wheel1' });

function shipRoom(assembly: ProjectEvaluationAssembly) {
  const room = corpusRooms(assembly).find((candidate) => candidate.occurrenceId === shipId);
  if (room === undefined) throw new Error(`${shipId} is not evaluated`);
  return room;
}

function shipEvents(assembly: ProjectEvaluationAssembly) {
  const evaluated = assembly.evaluation.route.biomes.find(
    (candidate) => candidate.biomeKey === 'O',
  );
  const events = evaluated !== undefined && 'history' in evaluated ? evaluated.history.events : [];
  return events.filter(
    (event) =>
      'origin' in event &&
      event.origin.kind === 'occurrence' &&
      event.origin.occurrenceId === shipId,
  );
}

describe('a Ship delivery ranked between the wheel choice and its phase pickup', () => {
  const start = simulateProjectAssembly(catalog, surfaceShrineTravelDealProject());
  const delivery = shipRoom(start).roomActionRoster.rows.find(
    (row) =>
      row.reference.kind === 'interactAcquisitionEntry' &&
      row.reference.siteKey === 'hermesShrineDelivery',
  );
  if (delivery === undefined) throw new Error(`${shipId} has no Shrine delivery`);
  const session = createAuthoringSession(catalog, start);
  const outcome = session.apply({
    kind: 'MoveRoomAction',
    action: createRoomActionAddress(biome, shipId, delivery.key),
    toIndex: 1,
  });
  const moved = session.current();

  it('is authored after the choice, before the pickup, and past the Intro end effects', () => {
    const before = shipRoom(start);
    expect(before.roomActionRoster.rows.map((row) => row.key)).toEqual([
      choice,
      pickup,
      delivery.key,
    ]);
    expect(delivery.reference).toMatchObject({ encounterPhaseKey: 'Combat1' });
    expect(outcome.kind).toBe('applied');
    expect(
      shipRoom(moved)
        .roomActionRoster.rows.filter((row) => row.rank !== null)
        .sort((left, right) => left.rank! - right.rank!)
        .map((row) => row.key),
    ).toEqual([choice, delivery.key, pickup]);
    // The structural bound is met: the Intro's end effects precede the wheel's opening.
    const kinds = shipEvents(moved).map((event) =>
      event.kind === 'encounterEndEffectsApplied' ? `${event.kind} ${event.phaseKey}` : event.kind,
    );
    expect(kinds.indexOf('encounterEndEffectsApplied Intro')).toBeGreaterThanOrEqual(0);
    expect(kinds.indexOf('encounterEndEffectsApplied Intro')).toBeLessThan(
      kinds.indexOf('offerPointMaterialized'),
    );
  });

  it('publishes its due contact, the one its placed row has', () => {
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(biome, shipId),
      'hermesShrineDelivery',
    );
    const capability = derivedAcquisitionEntriesForProjectEvaluationAssembly(start, site).find(
      (entry) => entry.address.entryKey === (delivery.reference as { entryKey: string }).entryKey,
    );
    const placed = shipRoom(start).roomActionRoster.rows.find((row) => row.key === delivery.key)!;
    expect(capability).toMatchObject({
      phaseKey: 'Combat1',
      contact: { kind: 'afterEncounterEnd', endedPhaseKey: 'Combat1', phaseKey: 'Combat1' },
      label: { kind: 'afterEncounterEnd', phaseKey: 'Combat1' },
    });
    expect([capability?.contact, capability?.label]).toEqual([placed.contact, placed.label]);
  });

  it('is flagged by its stored phase today, and Combat1 never ends', () => {
    expect(
      moved.evaluation.findings
        .filter(
          (finding) =>
            finding.origin.kind === 'roomAction' && finding.origin.actionKey === delivery.key,
        )
        .map((finding) => finding.code),
    ).toEqual(['roomActionOrderUnavailable']);
    expect(
      shipEvents(moved).some(
        (event) => event.kind === 'encounterEndEffectsApplied' && event.phaseKey === 'Combat1',
      ),
    ).toBe(false);
  });

  // Step 3b: the walk judges position, not the stored phase.
  it.todo(
    'the walk flags it before its due spawn (Combat1 end effects), and the live product does not offer that position',
  );
});
