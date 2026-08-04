import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createOccurrenceAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createOccurrenceId,
  createProjectHistory,
  redoProjectHistory,
  undoProjectHistory,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createEncounterCommandAuthorization,
  encounterPhaseCandidateSupportForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import {
  createRepresentativeNOProject,
  createRepresentativeNOPProject,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
} from '@run-planner/test-fixtures';

import { createCompleteNProject } from '../support/complete-n-project';
import { nBiome } from '../support/configured-projects';

const nCombatId = createOccurrenceId('round-trip-n-combat02');
const nLocalPhase = createEncounterPhaseAddress(
  nBiome,
  {
    kind: 'localChild',
    occurrenceId: nCombatId,
    groupKey: 'sideRooms',
    slotKey: 'sideDoor1',
  },
  'Encounter',
);
const pCombatId = pOccurrenceId('P_Combat03', 1, 1);
const pIntroPhase = createEncounterPhaseAddress(
  pBiome,
  { kind: 'occurrence', occurrenceId: pCombatId },
  'Intro',
);
const pCombatPhase = createEncounterPhaseAddress(
  pBiome,
  { kind: 'occurrence', occurrenceId: pCombatId },
  'Combat',
);

function withAuthorization(project: ProjectDocument) {
  const assembly = simulateProjectAssembly(catalog, project);
  return Object.freeze({
    assembly,
    encounterAuthorization: createEncounterCommandAuthorization(catalog, assembly),
  });
}

function occurrence(project: ProjectDocument, biomeKey: string, occurrenceId: string) {
  const value = project.routes
    .flatMap((route) => route.biomes)
    .find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (value === undefined) throw new Error(`missing ${biomeKey} occurrence ${occurrenceId}`);
  return value;
}

function localSideRoom(project: ProjectDocument) {
  const state = occurrence(project, 'N', nCombatId).state;
  if (state.kind !== 'ephyraCombat') throw new Error('expected Ephyra combat state');
  const sideRoom = state.sideRooms.sideDoor1;
  if (sideRoom === undefined) throw new Error('missing sideDoor1');
  return sideRoom;
}

function enteredNLocalProject(): ProjectDocument {
  let project = createCompleteNProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceSideRoomGeneration',
    sideRoom: createLocalChildAddress(nBiome, nCombatId, 'sideRooms', 'sideDoor1'),
    generation: 'generated',
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceSideRoomEntryOrder',
    group: createLocalChildGroupAddress(nBiome, nCombatId, 'sideRooms'),
    enteredSlotKeys: ['sideDoor1'],
  });
}

describe('authored encounter occurrence commands', () => {
  it('authorizes a valid top-level selection, resets it, and records one atomic history edit', () => {
    const initial = createRepresentativeNOPProject();
    const { assembly, encounterAuthorization } = withAuthorization(initial);
    const support = encounterPhaseCandidateSupportForProjectEvaluationAssembly(
      assembly,
      pIntroPhase,
    );

    expect(support).toMatchObject({
      active: true,
      selectedEncounterKey: 'GeneratedP_PreCombat',
      selectedPossible: true,
    });
    expect(support?.candidateEncounterKeys).toContain('P_Combat03_PreCombat01');

    const history = createProjectHistory(initial);
    const selected = applyProjectHistoryCommand(
      history,
      catalog,
      {
        kind: 'SelectEncounter',
        phase: pIntroPhase,
        encounterKey: 'P_Combat03_PreCombat01',
      },
      { encounterAuthorization },
    );

    expect(selected.past).toEqual([initial]);
    expect(
      occurrence(selected.present, 'P', pCombatId).encounters.encounterKeyByPhase,
    ).toMatchObject({
      Intro: 'P_Combat03_PreCombat01',
    });
    const undone = undoProjectHistory(selected);
    expect(undone.present).toBe(initial);
    expect(redoProjectHistory(undone).present).toBe(selected.present);

    const reset = applyProjectHistoryCommand(
      selected,
      catalog,
      { kind: 'ResetEncounter', phase: pIntroPhase },
      withAuthorization(selected.present),
    );
    expect(occurrence(reset.present, 'P', pCombatId).encounters.encounterKeyByPhase).toMatchObject({
      Intro: 'GeneratedP_PreCombat',
    });
    expect(undoProjectHistory(reset).present).toBe(selected.present);
    expect(redoProjectHistory(undoProjectHistory(reset)).present).toBe(reset.present);
  });

  it('retains a top-level selected encounter while its room is unpicked, then republishes it on repick', () => {
    const initial = createRepresentativeNOPProject();
    const selected = applyProjectCommand(
      initial,
      catalog,
      {
        kind: 'SelectEncounter',
        phase: pIntroPhase,
        encounterKey: 'P_Combat03_PreCombat01',
      },
      withAuthorization(initial),
    );
    const openingSelection = createExitSelectionAddress(pBiome, {
      kind: 'occurrence',
      occurrenceId: pOccurrenceIds.intro,
    });
    const downstreamDecision = createExitDecisionAddress(pBiome, {
      kind: 'occurrence',
      occurrenceId: pCombatId,
    });
    const withoutDownstream = applyProjectCommand(selected, catalog, {
      kind: 'RemoveExitDecision',
      decision: downstreamDecision,
    });
    const unpicked = applyProjectCommand(withoutDownstream, catalog, {
      kind: 'SetExitSelection',
      selection: openingSelection,
      value: { kind: 'normal', exitKey: 'exit2' },
    });

    expect(occurrence(unpicked, 'P', pCombatId).encounters.encounterKeyByPhase).toMatchObject({
      Intro: 'P_Combat03_PreCombat01',
    });
    expect(
      encounterPhaseCandidateSupportForProjectEvaluationAssembly(
        withAuthorization(unpicked).assembly,
        pIntroPhase,
      ),
    ).toBeUndefined();

    const repicked = applyProjectCommand(unpicked, catalog, {
      kind: 'SetExitSelection',
      selection: openingSelection,
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    const reauthored = applyProjectCommand(repicked, catalog, {
      kind: 'CreateBatch',
      decision: downstreamDecision,
    });
    expect(occurrence(reauthored, 'P', pCombatId).encounters.encounterKeyByPhase).toMatchObject({
      Intro: 'P_Combat03_PreCombat01',
    });
    expect(
      encounterPhaseCandidateSupportForProjectEvaluationAssembly(
        withAuthorization(reauthored).assembly,
        pIntroPhase,
      ),
    ).toMatchObject({
      active: true,
      selectedEncounterKey: 'P_Combat03_PreCombat01',
      selectedPossible: true,
    });
  });

  it('authorizes a selected, entered N local child and retains its selection across removal and re-entry', () => {
    const entered = enteredNLocalProject();
    const { assembly, encounterAuthorization } = withAuthorization(entered);
    const support = encounterPhaseCandidateSupportForProjectEvaluationAssembly(
      assembly,
      nLocalPhase,
    );

    expect(support).toMatchObject({
      active: true,
      selectedEncounterKey: 'GeneratedNSubRoom',
      selectedPossible: true,
    });
    expect(support?.candidateEncounterKeys).toContain('GeneratedNSubRoom_Bigger');

    const selected = applyProjectCommand(
      entered,
      catalog,
      {
        kind: 'SelectEncounter',
        phase: nLocalPhase,
        encounterKey: 'GeneratedNSubRoom_Bigger',
      },
      { encounterAuthorization },
    );
    expect(localSideRoom(selected).encounters.encounterKeyByPhase).toEqual({
      Encounter: 'GeneratedNSubRoom_Bigger',
    });

    const unentered = applyProjectCommand(selected, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(nBiome, nCombatId, 'sideRooms'),
      enteredSlotKeys: [],
    });
    const removed = applyProjectCommand(unentered, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: createLocalChildAddress(nBiome, nCombatId, 'sideRooms', 'sideDoor1'),
      generation: 'notGenerated',
    });
    expect(localSideRoom(removed).encounters.encounterKeyByPhase).toEqual({
      Encounter: 'GeneratedNSubRoom_Bigger',
    });

    const regenerated = applyProjectCommand(removed, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: createLocalChildAddress(nBiome, nCombatId, 'sideRooms', 'sideDoor1'),
      generation: 'generated',
    });
    const reentered = applyProjectCommand(regenerated, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(nBiome, nCombatId, 'sideRooms'),
      enteredSlotKeys: ['sideDoor1'],
    });
    expect(localSideRoom(reentered).encounters.encounterKeyByPhase).toEqual({
      Encounter: 'GeneratedNSubRoom_Bigger',
    });
    expect(
      encounterPhaseCandidateSupportForProjectEvaluationAssembly(
        withAuthorization(reentered).assembly,
        nLocalPhase,
      ),
    ).toMatchObject({ selectedPossible: true, selectedEncounterKey: 'GeneratedNSubRoom_Bigger' });

    const reset = applyProjectCommand(
      reentered,
      catalog,
      { kind: 'ResetEncounter', phase: nLocalPhase },
      withAuthorization(reentered),
    );
    expect(localSideRoom(reset).encounters.encounterKeyByPhase).toEqual({
      Encounter: 'GeneratedNSubRoom',
    });
  });

  it('restores a deleted parent-local encounter selection through authored history undo', () => {
    const entered = enteredNLocalProject();
    const selected = applyProjectCommand(
      entered,
      catalog,
      {
        kind: 'SelectEncounter',
        phase: nLocalPhase,
        encounterKey: 'GeneratedNSubRoom_Bigger',
      },
      withAuthorization(entered),
    );
    const initial = createProjectHistory(selected);
    const withoutVisit = applyProjectHistoryCommand(initial, catalog, {
      kind: 'ReplaceHubVisitOrder',
      hub: createHubDecisionAddress(nBiome, 'hub'),
      hubSlotKeys: ['combat01', 'combat03', 'combat04', 'combat05', 'combat06'],
    });
    const closed = applyProjectHistoryCommand(withoutVisit, catalog, {
      kind: 'CloseHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', 'combat02'),
    });

    expect(
      closed.present.routes
        .flatMap((route) => route.biomes)
        .find((biome) => biome.biomeKey === 'N')
        ?.topology?.occurrences.some((candidate) => candidate.occurrenceId === nCombatId),
    ).toBe(false);
    const restored = undoProjectHistory(closed);
    expect(localSideRoom(restored.present).encounters.encounterKeyByPhase).toEqual({
      Encounter: 'GeneratedNSubRoom_Bigger',
    });
    expect(redoProjectHistory(restored).present).toBe(closed.present);
  });

  it('retains the dormant O Combat2 selection across a 3 → 2 → 3 Ship count edit', () => {
    const ship = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const withThree = applyProjectCommand(createRepresentativeNOProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: ship,
      encounterCount: 3,
    });
    const withTwo = applyProjectCommand(withThree, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: ship,
      encounterCount: 2,
    });
    const restored = applyProjectCommand(withTwo, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: ship,
      encounterCount: 3,
    });

    for (const project of [withThree, withTwo, restored]) {
      expect(
        occurrence(project, 'O', oOccurrenceIds.combat07).encounters.encounterKeyByPhase,
      ).toMatchObject({
        Combat2: 'GeneratedO',
      });
    }
  });

  it('rejects missing, stale, wrong-catalog, noncandidate, fixed, and dormant encounter edits', () => {
    const topLevel = createRepresentativeNOPProject();
    const command = {
      kind: 'SelectEncounter' as const,
      phase: pIntroPhase,
      encounterKey: 'P_Combat03_PreCombat01',
    };
    const authorization = withAuthorization(topLevel).encounterAuthorization;

    expect(() => applyProjectCommand(topLevel, catalog, command)).toThrow(
      'encounter selection requires an exact candidate authorization',
    );
    const stale = applyProjectCommand(topLevel, catalog, { kind: 'RenameProject', name: 'Stale' });
    expect(() =>
      applyProjectCommand(stale, catalog, command, { encounterAuthorization: authorization }),
    ).toThrow('encounter authorization requires the exact current evaluation assembly');

    const catalogClone = Object.freeze({ ...catalog }) as typeof catalog;
    expect(() =>
      applyProjectCommand(topLevel, catalogClone, command, {
        encounterAuthorization: authorization,
      }),
    ).toThrow('encounter authorization was created for a different catalog');

    expect(() =>
      applyProjectCommand(
        topLevel,
        catalog,
        { kind: 'SelectEncounter', phase: pCombatPhase, encounterKey: 'GeneratedP_Large' },
        { encounterAuthorization: authorization },
      ),
    ).toThrow('GeneratedP_Large is not an eligible encounter candidate');

    const permissiveAuthorization = Object.freeze({ assertAuthorized: () => undefined });
    const unknownPhase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pCombatId },
      'NotADeclaredPhase',
    );
    expect(() =>
      applyProjectCommand(
        topLevel,
        catalog,
        {
          kind: 'SelectEncounter',
          phase: unknownPhase,
          encounterKey: 'P_Combat03_PreCombat01',
        },
        { encounterAuthorization: permissiveAuthorization },
      ),
    ).toThrow('P_Combat03 has no encounter phase NotADeclaredPhase');

    const fixed = createEncounterPhaseAddress(
      nBiome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('round-trip-n-prehub') },
      'Encounter',
    );
    expect(() =>
      applyProjectCommand(
        createCompleteNProject(),
        catalog,
        { kind: 'ResetEncounter', phase: fixed },
        { encounterAuthorization: permissiveAuthorization },
      ),
    ).toThrow('N_PreHub01.Encounter is a fixed encounter phase');

    const dormant = createCompleteNProject();
    expect(() =>
      applyProjectCommand(
        dormant,
        catalog,
        { kind: 'SelectEncounter', phase: nLocalPhase, encounterKey: 'GeneratedNSubRoom_Bigger' },
        { encounterAuthorization: withAuthorization(dormant).encounterAuthorization },
      ),
    ).toThrow('encounter phase is not structurally active in the current evaluation');
  });
});
