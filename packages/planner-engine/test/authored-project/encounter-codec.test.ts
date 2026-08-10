import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createCompleteFGProject,
  createRepresentativeNOPProject,
  goldenFBiome,
  goldenFOccurrenceId,
  nOccurrenceIds,
  oOccurrenceIds,
  pOccurrenceId,
} from '@run-planner/test-fixtures';

import { createCompleteNProject } from './support/complete-n-project';

type JsonRecord = Record<string, unknown>;

function encoded(project: ProjectDocument): JsonRecord {
  return JSON.parse(encodeProjectDocument(project)) as JsonRecord;
}

function biome(document: JsonRecord, routeKey: string, biomeKey: string): JsonRecord {
  const routes = document.routes as JsonRecord[];
  const route = routes.find((candidate) => candidate.routeKey === routeKey);
  const plan = (route?.biomes as JsonRecord[] | undefined)?.find(
    (candidate) => candidate.biomeKey === biomeKey,
  );
  if (plan === undefined) throw new Error(`missing ${routeKey}/${biomeKey}`);
  return plan;
}

function occurrence(document: JsonRecord, biomeKey: string, occurrenceId: string): JsonRecord {
  const topology = biome(
    document,
    biomeKey === 'F' || biomeKey === 'G' || biomeKey === 'H' || biomeKey === 'I'
      ? 'Underworld'
      : 'Surface',
    biomeKey,
  ).topology as JsonRecord;
  const value = (topology.occurrences as JsonRecord[]).find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  if (value === undefined) throw new Error(`missing ${biomeKey} occurrence ${occurrenceId}`);
  return value;
}

function selections(owner: JsonRecord): JsonRecord {
  return ((owner.encounters as JsonRecord).encounterKeyByPhase ?? {}) as JsonRecord;
}

function sideRoom(document: JsonRecord, occurrenceId: string, slotKey: string): JsonRecord {
  const state = occurrence(document, 'N', occurrenceId).state as JsonRecord;
  const sideRooms = state.sideRooms as JsonRecord;
  const value = sideRooms[slotKey] as JsonRecord | undefined;
  if (value === undefined) throw new Error(`missing ${slotKey}`);
  return value;
}

function arachneStoryProject(): ProjectDocument {
  const occurrenceId = goldenFOccurrenceId(7, 1);
  const occurrence = createOccurrenceAddress(goldenFBiome, occurrenceId);
  const phase = createTraitOfferAddress(
    createEncounterPhaseAddress(goldenFBiome, { kind: 'occurrence', occurrenceId }, 'Encounter'),
    'selection',
  );
  const story = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence,
    gameName: 'F_Story01',
  });
  return applyProjectCommand(story, catalog, {
    kind: 'ReplaceTraitSelection',
    trait: phase,
    selectedOptionKey: 'option2',
  });
}

describe('schema-18 occurrence-owned additional-exit persistence', () => {
  it('round-trips the exact top-level and parent-local selections', () => {
    const project = createRepresentativeNOPProject();
    const decoded = decodeProjectDocument(encoded(project), catalog);

    expect(decoded).toEqual(project);
    expect(decoded.schemaVersion).toBe(18);
  });

  it('round-trips a fixed Arachne Story offer through the encounter codec', () => {
    const project = arachneStoryProject();
    const decoded = decodeProjectDocument(encoded(project), catalog);
    const fixed = decoded.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((plan) => plan.biomeKey === 'F')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === goldenFOccurrenceId(7, 1),
      );

    expect(fixed?.encounters.traitOffersByPhase?.Encounter?.Story_Arachne_01).toMatchObject({
      giverKey: 'Arachne',
      selectedOptionKey: 'option2',
    });
    expect(decoded).toEqual(project);
  });

  it('rejects a fixed Story offer moved to a different encounter owner', () => {
    const document = encoded(arachneStoryProject());
    const state = occurrence(document, 'F', goldenFOccurrenceId(7, 1));
    const encounters = state.encounters as JsonRecord;
    const offersByPhase = encounters.traitOffersByPhase as JsonRecord;
    const encounterOffers = offersByPhase.Encounter as JsonRecord;
    encounterOffers.Story_Medea_01 = encounterOffers.Story_Arachne_01;
    delete encounterOffers.Story_Arachne_01;

    expect(() => decodeProjectDocument(document, catalog)).toThrow(
      'is not available from this encounter set',
    );
  });

  it('rejects schema 12 rather than inventing an encounter migration', () => {
    const document = encoded(createRepresentativeNOPProject());
    document.schemaVersion = 12;

    expect(() => decodeProjectDocument(document, catalog)).toThrow('expected 18, received 12');
  });

  it.each([
    {
      label: 'a missing top-level encounter state',
      mutate: (document: JsonRecord) => {
        delete occurrence(document, 'P', pOccurrenceId('P_Combat03', 1, 1)).encounters;
      },
      message: 'encounters: must be an object',
    },
    {
      label: 'a missing pooled phase selection',
      mutate: (document: JsonRecord) => {
        delete selections(occurrence(document, 'P', pOccurrenceId('P_Combat03', 1, 1))).Intro;
      },
      message: 'encounterKeyByPhase.Intro: must be a string',
    },
    {
      label: 'an extra pooled phase selection',
      mutate: (document: JsonRecord) => {
        selections(occurrence(document, 'P', pOccurrenceId('P_Combat03', 1, 1))).unexpected =
          'GeneratedP_PreCombat';
      },
      message: 'encounterKeyByPhase.unexpected: is not a project document field',
    },
    {
      label: 'an unknown concrete encounter key',
      mutate: (document: JsonRecord) => {
        selections(occurrence(document, 'P', pOccurrenceId('P_Combat03', 1, 1))).Intro =
          'UnknownEncounter';
      },
      message: 'UnknownEncounter is not a member of PCombat03IntroEncounters',
    },
    {
      label: 'a known encounter outside the declared set',
      mutate: (document: JsonRecord) => {
        selections(occurrence(document, 'P', pOccurrenceId('P_Combat03', 1, 1))).Intro =
          'GeneratedP';
      },
      message: 'GeneratedP is not a member of PCombat03IntroEncounters',
    },
    {
      label: 'a redundant fixed-phase selection',
      mutate: (document: JsonRecord) => {
        selections(occurrence(document, 'N', nOccurrenceIds.preHub)).Encounter = 'PreHubGeneratedN';
      },
      message: 'encounterKeyByPhase.Encounter: is not a project document field',
    },
    {
      label: 'a redundant empty-envelope selection',
      mutate: (document: JsonRecord) => {
        selections(occurrence(document, 'O', oOccurrenceIds.intro)).Intro = 'GeneratedO_Intro01';
      },
      message: 'encounterKeyByPhase.Intro: is not a project document field',
    },
  ])('rejects $label', ({ mutate, message }) => {
    const document = encoded(createRepresentativeNOPProject());
    mutate(document);

    expect(() => decodeProjectDocument(document, catalog)).toThrow(message);
  });

  it.each([
    {
      label: 'a missing local encounter state',
      mutate: (document: JsonRecord) => {
        delete sideRoom(document, 'round-trip-n-combat02', 'sideDoor1').encounters;
      },
      message: 'sideRooms.sideDoor1.encounters: must be an object',
    },
    {
      label: 'a missing local pooled selection',
      mutate: (document: JsonRecord) => {
        delete selections(sideRoom(document, 'round-trip-n-combat02', 'sideDoor1')).Encounter;
      },
      message: 'encounterKeyByPhase.Encounter: must be a string',
    },
    {
      label: 'an extra local pooled selection',
      mutate: (document: JsonRecord) => {
        selections(sideRoom(document, 'round-trip-n-combat02', 'sideDoor1')).unexpected =
          'GeneratedNSubRoom';
      },
      message: 'encounterKeyByPhase.unexpected: is not a project document field',
    },
    {
      label: 'an unknown local encounter key',
      mutate: (document: JsonRecord) => {
        selections(sideRoom(document, 'round-trip-n-combat02', 'sideDoor1')).Encounter =
          'UnknownEncounter';
      },
      message: 'UnknownEncounter is not a member of NEncountersSubRoom',
    },
    {
      label: 'a known local encounter outside the declared set',
      mutate: (document: JsonRecord) => {
        selections(sideRoom(document, 'round-trip-n-combat02', 'sideDoor1')).Encounter =
          'GeneratedN';
      },
      message: 'GeneratedN is not a member of NEncountersSubRoom',
    },
  ])('rejects $label', ({ mutate, message }) => {
    const document = encoded(createCompleteNProject());
    mutate(document);

    expect(() => decodeProjectDocument(document, catalog)).toThrow(message);
  });

  it('requires every local child encounter selection to stay under its parent occurrence', () => {
    const document = encoded(createCompleteNProject());
    const parent = occurrence(document, 'N', 'round-trip-n-combat02');
    const local = sideRoom(document, 'round-trip-n-combat02', 'sideDoor1');

    expect(parent.occurrenceId).toBe(createOccurrenceId('round-trip-n-combat02'));
    expect(selections(local)).toEqual({ Encounter: 'GeneratedNSubRoom' });
  });
});
