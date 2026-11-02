import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  fillSchema100NemesisBetOutcomes,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createCompleteFGProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenGOccurrenceId,
} from '@run-planner/test-fixtures/underworld';

const occurrenceId = goldenFOccurrenceId(5, 1);
const phase = createEncounterPhaseAddress(
  goldenFBiome,
  { kind: 'occurrence', occurrenceId },
  'Encounter',
);

interface Raw {
  readonly schemaVersion: number;
  readonly route: {
    itineraryBiomeKeys: string[];
    readonly biomes: readonly {
      readonly topology: {
        readonly occurrences: readonly {
          readonly occurrenceId: string;
          readonly encounters: Record<string, unknown>;
        }[];
      } | null;
    }[];
  };
}

function nemesisCombat(value: 'win' | 'tie' | 'loss'): ProjectDocument {
  const combat = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'SelectEncounter',
    phase,
    encounterKey: 'NemesisCombatF',
  });
  return applyProjectCommand(combat, catalog, { kind: 'ReplaceNemesisBetOutcome', phase, value });
}

/** The document as a schema 100 save stored it before the outcome was complete. */
function sparse(project: ProjectDocument): Raw {
  const raw = JSON.parse(encodeProjectDocument(project)) as Raw;
  for (const biome of raw.route.biomes)
    for (const occurrence of biome.topology?.occurrences ?? []) {
      const bets = occurrence.encounters.nemesisBetOutcomeByPhase as Record<string, string>;
      const kept = Object.entries(bets).filter(([, outcome]) => outcome !== 'win');
      if (kept.length === 0) delete occurrence.encounters.nemesisBetOutcomeByPhase;
      else occurrence.encounters.nemesisBetOutcomeByPhase = Object.fromEntries(kept);
    }
  return raw;
}

function bets(raw: Raw, owner: string = occurrenceId): unknown {
  for (const biome of raw.route.biomes)
    for (const occurrence of biome.topology?.occurrences ?? [])
      if (occurrence.occurrenceId === owner) return occurrence.encounters.nemesisBetOutcomeByPhase;
  throw new Error(`missing ${owner}`);
}

describe('schema 100 Nemesis bet outcome fill', () => {
  it('fills a win for every hosting phase an earlier schema 100 save left unstored', () => {
    const project = nemesisCombat('win');
    const raw = sparse(project);
    expect(() => decodeProjectDocument(raw, catalog)).toThrow(
      /nemesisBetOutcomeByPhase: must be an object/,
    );
    const filled = fillSchema100NemesisBetOutcomes(raw, catalog) as Raw;
    expect(bets(filled)).toEqual({ Encounter: 'win' });
    expect(decodeProjectDocument(filled, catalog)).toEqual(project);
    expect(bets(raw)).toBeUndefined();
  });

  it('keeps an authored tie or loss', () => {
    for (const value of ['tie', 'loss'] as const) {
      const project = nemesisCombat(value);
      const filled = fillSchema100NemesisBetOutcomes(sparse(project), catalog) as Raw;
      expect(bets(filled)).toEqual({ Encounter: value });
      expect(decodeProjectDocument(filled, catalog)).toEqual(project);
    }
  });

  it('returns a complete document or another schema itself', () => {
    const complete = JSON.parse(encodeProjectDocument(nemesisCombat('loss'))) as Raw;
    expect(fillSchema100NemesisBetOutcomes(complete, catalog)).toBe(complete);
    const filled = fillSchema100NemesisBetOutcomes(sparse(nemesisCombat('tie')), catalog);
    expect(fillSchema100NemesisBetOutcomes(filled, catalog)).toBe(filled);
    const older = { ...sparse(nemesisCombat('win')), schemaVersion: 99 };
    expect(fillSchema100NemesisBetOutcomes(older, catalog)).toBe(older);
    expect(fillSchema100NemesisBetOutcomes('not a document', catalog)).toBe('not a document');
  });

  it('resolves a later biome’s position from the itinerary as strict decoding does', () => {
    const gOccurrenceId = goldenGOccurrenceId(1, 1);
    const gPhase = createEncounterPhaseAddress(
      goldenGBiome,
      { kind: 'occurrence', occurrenceId: gOccurrenceId },
      'Encounter',
    );
    const project = applyProjectCommand(nemesisCombat('loss'), catalog, {
      kind: 'SelectEncounter',
      phase: gPhase,
      encounterKey: 'NemesisCombatG',
    });
    const raw = sparse(project);
    expect(bets(raw, gOccurrenceId)).toBeUndefined();
    const filled = fillSchema100NemesisBetOutcomes(raw, catalog) as Raw;
    expect(bets(filled, gOccurrenceId)).toEqual({ Encounter: 'win' });
    expect(bets(filled)).toEqual({ Encounter: 'loss' });
    expect(decodeProjectDocument(filled, catalog)).toEqual(project);

    // A biome off its itinerary position is left for strict decoding to reject.
    const reordered = sparse(project);
    reordered.route.itineraryBiomeKeys = ['G', 'F', 'H', 'I'];
    expect(fillSchema100NemesisBetOutcomes(reordered, catalog)).toBe(reordered);
    expect(() => decodeProjectDocument(reordered, catalog)).toThrow();
  });
});
