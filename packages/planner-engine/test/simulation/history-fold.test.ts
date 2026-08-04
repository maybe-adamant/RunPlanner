import { describe, expect, it } from 'vitest';

import {
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import {
  foldHistoryEvents,
  HistoryFoldContractError,
  type HistoryEvent,
} from '@run-planner/engine/simulation';

import { foldBiomeHistoryPrefixEvents } from '../../src/simulation/history/fold';

const biome = createBiomeAddress('Underworld', 'F');
const origin = createOccurrenceAddress(biome, createOccurrenceId('history-fold-combat'));
const secondOrigin = createOccurrenceAddress(biome, createOccurrenceId('history-fold-second'));

type UnsequencedHistoryEvent = HistoryEvent extends infer Event
  ? Event extends HistoryEvent
    ? Omit<Event, 'sequence'>
    : never
  : never;

function numbered(events: readonly UnsequencedHistoryEvent[]): readonly HistoryEvent[] {
  return Object.freeze(
    events.map((event, index) => Object.freeze({ ...event, sequence: index + 1 }) as HistoryEvent),
  );
}

function canonicalEvents(): readonly HistoryEvent[] {
  return numbered([
    {
      kind: 'biomeStarted',
      origin: biome,
      counters: {
        biomeDepthCache: 0,
        biomeEncounterDepth: 0,
        routeEncounterDepth: 0,
        roomHistoryOrdinal: 0,
      },
    },
    {
      kind: 'roomCreated',
      origin,
      gameName: 'F_Combat02',
      encounterEnvelopeKey: 'SingleEncounter',
      source: 'biomeEntry',
      picked: true,
    },
    { kind: 'roomPrepared', origin, operationIndex: 1 },
    {
      kind: 'encounterRecorded',
      origin,
      operationIndex: 1,
      phaseKey: 'Encounter',
      encounterEnvelopeKey: 'SingleEncounter',
      encounterKey: 'GeneratedF',
      phaseKind: 'combat',
    },
    { kind: 'roomEntered', origin, operationIndex: 2 },
    {
      kind: 'encounterStarted',
      origin,
      operationIndex: 3,
      phaseKey: 'Encounter',
      encounterEnvelopeKey: 'SingleEncounter',
      encounterKey: 'GeneratedF',
      phaseKind: 'combat',
    },
    {
      kind: 'encounterDepthAdvanced',
      origin,
      operationIndex: 3,
      phaseKey: 'Encounter',
      roomEncounterDepthDelta: 1,
      biomeEncounterDepthDelta: 1,
      routeEncounterDepthDelta: 1,
    },
    { kind: 'encounterCompleted', origin, operationIndex: 4, phaseKey: 'Encounter' },
    { kind: 'outgoingGenerationCheckpoint', origin, operationIndex: 5 },
    { kind: 'emptyOutgoingGenerationCompleted', origin },
    { kind: 'roomCommitted', origin, operationIndex: 6 },
    {
      kind: 'roomCountersAdvanced',
      origin,
      operationIndex: 7,
      biomeDepthCacheDelta: 1,
      roomHistoryOrdinalDelta: 1,
    },
    { kind: 'roomExited', origin, operationIndex: 8 },
    { kind: 'biomeCompleted', origin: biome },
    { kind: 'biomeCounterReset', origin: biome, axis: 'biomeDepthCache', value: 0 },
    { kind: 'biomeCounterReset', origin: biome, axis: 'biomeEncounterDepth', value: 0 },
  ]);
}

describe('history fold encounter checkpoint closure', () => {
  it('folds a fully ordered record, start, depth, and completion sequence', () => {
    const history = foldHistoryEvents(canonicalEvents());

    expect(history.ledgers.encounterRecords).toHaveLength(1);
    expect(history.ledgers.encounterStarts).toHaveLength(1);
    expect(history.ledgers.encounterCompletions).toHaveLength(1);
  });

  it('rejects an encounter record before room preparation', () => {
    const events = canonicalEvents();
    const malformed = numbered([
      events[0]!,
      events[1]!,
      events[3]!,
      ...events.slice(2, 3),
      ...events.slice(4),
    ]);

    expect(() => foldHistoryEvents(malformed)).toThrow(
      'encounterRecorded references unprepared room',
    );
  });

  it('rejects an encounter record after room entry and a start before entry', () => {
    const events = canonicalEvents();
    const recordAfterEntry = numbered([
      ...events.slice(0, 3),
      events[4]!,
      events[3]!,
      ...events.slice(5),
    ]);
    const startBeforeEntry = numbered([
      ...events.slice(0, 4),
      events[5]!,
      events[4]!,
      ...events.slice(6),
    ]);

    expect(() => foldHistoryEvents(recordAfterEntry)).toThrow(
      new HistoryFoldContractError(
        'Encounter was recorded outside its room preparation checkpoint',
      ),
    );
    expect(() => foldHistoryEvents(startBeforeEntry)).toThrow(
      new HistoryFoldContractError('Encounter started outside its room entry checkpoint'),
    );
  });

  it('rejects mismatched record envelopes and unmatched or duplicate encounter-depth advances', () => {
    const events = canonicalEvents();
    const mismatchedEnvelope = numbered(
      events.map((event) =>
        event.kind === 'encounterRecorded'
          ? { ...event, encounterEnvelopeKey: 'FieldsEncounter' }
          : event,
      ),
    );
    const unmatchedAdvance = numbered(
      events.map((event) =>
        event.kind === 'encounterDepthAdvanced' ? { ...event, phaseKey: 'Missing' } : event,
      ),
    );
    const duplicateAdvance = numbered([...events.slice(0, 7), events[6]!, ...events.slice(7)]);

    expect(() => foldHistoryEvents(mismatchedEnvelope)).toThrow(
      new HistoryFoldContractError('Encounter does not match its room encounter envelope'),
    );
    expect(() => foldHistoryEvents(unmatchedAdvance)).toThrow(
      new HistoryFoldContractError(
        'Missing advanced encounter depth without one active matching encounter',
      ),
    );
    expect(() => foldHistoryEvents(duplicateAdvance)).toThrow(
      new HistoryFoldContractError(
        'Encounter advanced encounter depth without one active matching encounter',
      ),
    );
  });

  it('rejects an interior prepared-only room instead of silently omitting it from a prefix', () => {
    const events = canonicalEvents();
    const malformed = numbered([
      ...events.slice(0, 3),
      {
        kind: 'roomCreated',
        origin: secondOrigin,
        gameName: 'F_Combat03',
        encounterEnvelopeKey: 'SingleEncounter',
        source: 'biomeEntry',
        picked: true,
      },
      { kind: 'roomPrepared', origin: secondOrigin, operationIndex: 1 },
    ]);

    expect(() => foldBiomeHistoryPrefixEvents(malformed)).toThrow(
      new HistoryFoldContractError('prefix history has more than one unentered prepared room'),
    );
  });
});
