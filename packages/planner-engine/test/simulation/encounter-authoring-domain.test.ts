import { ordinaryPositionFor } from '../support/route-position';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteStartKeepsakeSelectionAddress,
  type ProjectDocument,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import {
  encounterPhaseAuthoringDomainForRoom,
  encounterPhaseFigLeafSupportForProjectEvaluationAssembly,
  encounterPhaseGorgonSupportForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { prepareRoomEncounterPhases } from '../../src/simulation/encounters/preparation';
import {
  attestEffectiveShadowRank,
  createArcanaFearState,
  suppressFearVows,
} from '../../src/simulation/arcana-fear';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import {
  encounterResolutionContext,
  materializeEncounterPhases,
  resolveEncounterAuthoringProfile,
  resolveMaterializedEncounterPhase,
} from '../../src/simulation/encounters/resolve';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  goldenFOccurrenceId,
  goldenHBiome,
  goldenIBiome,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPQProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';

describe('encounter choice identity context', () => {
  it('prepares Erebus fixed identities from effective Shadow after prior Black Night suppression', () => {
    const project = createGoldenFGHIProject();
    const biome = simulateProjectAssembly(catalog, project).evaluation.route.biomes[0];
    if (biome?.authoring !== 'complete' || biome.validity !== 'valid')
      throw new Error('F fixture invalid');
    const loadout = {
      ...createDefaultRouteLoadout(catalog),
      fearRanks: { ...createDefaultRouteLoadout(catalog).fearRanks, MinibossCountShrineUpgrade: 1 },
    };
    const active = createArcanaFearState(catalog, loadout);
    const suppressed = suppressFearVows(catalog, active, ['MinibossCountShrineUpgrade'], {
      owner: createBiomeAddress('Underworld', 'F'),
      sequence: 1,
    });
    if (!suppressed.legal) throw new Error('Shadow suppression is unavailable');
    expect(suppressed.state.fear.configuredRanks.MinibossCountShrineUpgrade).toBe(1);
    expect(() =>
      attestEffectiveShadowRank(loadout, [
        { state: { arcanaFear: active } },
        { state: { arcanaFear: suppressed.state } },
      ]),
    ).toThrow(/divergent/);
    expect(() => attestEffectiveShadowRank(loadout, [])).toThrow(/empty/);
    for (const [gameName, encounterKey] of [['F_MiniBoss01', 'MiniBossTreant']]) {
      const room = biome.snapshot.decisions
        .flatMap((decision) =>
          decision.kind === 'batch' ? decision.targets.map((target) => target.room) : [],
        )
        .find((value) => value.gameName === gameName);
      const preparation = biome.history.rooms.find(
        (value) =>
          value.origin.kind === 'occurrence' && value.origin.occurrenceId === room?.occurrenceId,
      )?.preparation;
      if (room === undefined || preparation === undefined)
        throw new Error('Missing miniboss preparation');
      for (const state of [active, suppressed.state]) {
        const rank = attestEffectiveShadowRank(loadout, [
          { state: { arcanaFear: state } },
          { state: { arcanaFear: state } },
        ]);
        const prepared = prepareRoomEncounterPhases(
          catalog,
          room,
          ordinaryPositionFor(catalog, room.origin),
          preparation,
          { effectiveShadowRank: rank },
        );
        expect(prepared.validPrefix[0]?.encounterKey).toBe(
          rank > 0 ? `${encounterKey}_Shrine` : encounterKey,
        );
      }
    }
  });
  it('distinguishes known reward, explicit no reward, and unavailable authorship', () => {
    const fCombat = catalog.encounterSets.byKey.FEncountersDefault!.authoringProfiles.find(
      (profile) => profile.key === 'GeneratedF',
    );
    const iCombat = catalog.encounterSets.byKey.IEncountersDefault!.authoringProfiles.find(
      (profile) => profile.key === 'GeneratedI',
    );
    if (fCombat === undefined || iCombat === undefined)
      throw new Error('Combat choices are missing');
    expect(
      resolveEncounterAuthoringProfile(fCombat, { kind: 'knownReward', rewardType: 'Devotion' }),
    ).toBe('DevotionTestF');
    expect(resolveEncounterAuthoringProfile(fCombat, { kind: 'noReward' })).toBe('GeneratedF');
    expect(resolveEncounterAuthoringProfile(fCombat, { kind: 'unavailable' })).toBeUndefined();
    expect(
      resolveEncounterAuthoringProfile(iCombat, {
        biomeEncounterDepth: 2,
        kind: 'knownReward',
        rewardType: 'ClockworkGoal',
      }),
    ).toBe('GeneratedI_GoalReward');
  });

  it('retains a contextual choice while incoming reward authorship is unavailable', () => {
    const project = createGoldenFGHIProject();
    const value = occurrence(project, 'Underworld', 'F', goldenFOccurrenceId(5, 1));
    const room = roomFor(value);
    const retained = materializeEncounterPhases(
      catalog,
      room,
      value.encounters,
      ['Encounter'],
      room.gameName,
    );
    const context = encounterResolutionContext({ unresolvedIncomingReward: {} }, room);
    expect(context).toEqual({ kind: 'unavailable' });
    expect(retained).toMatchObject([{ authoredChoiceKey: 'GeneratedF' }]);
    expect(resolveMaterializedEncounterPhase(catalog, room, retained[0]!, context)).toBeUndefined();
  });
});

function occurrence(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  occurrenceId: string,
): RoomOccurrence {
  const result = project.route.biomes
    .find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (result === undefined) throw new Error(`${routeKey}/${biomeKey}/${occurrenceId} is missing`);
  return result;
}

function roomFor(value: RoomOccurrence) {
  const room = catalog.rooms.byKey[value.gameName];
  if (room === undefined) throw new Error(`${value.gameName} declaration is missing`);
  return room;
}

describe('encounter phase authored domains', () => {
  it.each([
    ['SkipEncounterKeepsake', encounterPhaseFigLeafSupportForProjectEvaluationAssembly],
    ['AthenaEncounterKeepsake', encounterPhaseGorgonSupportForProjectEvaluationAssembly],
  ] as const)('uses resolved Trial restrictions for %s', (keepsakeKey, supportFor) => {
    const biome = createBiomeAddress('Underworld', 'F');
    const occurrenceId = createOccurrenceId('golden-f-b8-e1');
    const phase = createEncounterPhaseAddress(
      biome,
      { kind: 'occurrence', occurrenceId },
      'Encounter',
    );
    const full = createGoldenFGHIProject();
    let project = applyProjectCommand(
      { ...full, route: { ...full.route, biomes: full.route.biomes.slice(0, 1) } },
      catalog,
      {
        kind: 'ReplaceStartingKeepsake',
        selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
        keepsakeKey,
      },
    );
    expect(supportFor(simulateProjectAssembly(catalog, project), phase)).toMatchObject({
      supported: true,
    });
    project = authorLegalTraitOffers(
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(biome, occurrenceId),
        value: {
          rewardType: 'Devotion',
          payload: {
            kind: 'DevotionPair',
            chosenSource: 'ApolloUpgrade',
            spurnedSource: 'ZeusUpgrade',
          },
        },
      }),
    );
    const assembly = simulateProjectAssembly(catalog, project);
    expect(assembly.evaluation.status).toBe('valid');
    expect(supportFor(assembly, phase)?.supported ?? false).toBe(false);
  });

  it.each([
    ['I_Combat02', 'GeneratedI_Small'],
    ['I_Combat08', 'GeneratedI'],
  ] as const)(
    'resolves the %s Combat profile to the same native Trial definition',
    (gameName, authoredKey) => {
      const occurrenceId = createOccurrenceId('golden-i-combat02');
      let project = createGoldenFGHIProject();
      if (gameName !== 'I_Combat02')
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceOccurrenceRoom',
          occurrence: createOccurrenceAddress(goldenIBiome, occurrenceId),
          gameName,
        });
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(goldenIBiome, occurrenceId),
        value: {
          rewardType: 'Devotion',
          payload: {
            kind: 'DevotionPair',
            chosenSource: 'ApolloUpgrade',
            spurnedSource: 'ZeusUpgrade',
          },
        },
      });
      const biome = simulateProjectAssembly(catalog, project).evaluation.route.biomes[3];
      if (biome?.authoring !== 'complete' || biome.validity !== 'valid')
        throw new Error('I preparation fixture is not valid');
      const room = biome.snapshot.decisions
        .flatMap((decision) =>
          decision.kind === 'batch' ? decision.targets.map((target) => target.room) : [],
        )
        .find((value) => value.occurrenceId === occurrenceId);
      // The alternate Trial shares its predecessor with the entered goal room.
      const preparation = biome.history.rooms.find(
        (value) =>
          value.origin.kind === 'occurrence' && value.origin.occurrenceId === 'golden-i-combat05',
      )?.preparation;
      if (room === undefined || preparation === undefined)
        throw new Error('I preparation contact is missing');
      const resolved = prepareRoomEncounterPhases(
        catalog,
        room,
        ordinaryPositionFor(catalog, room.origin),
        preparation,
      );
      expect(resolved.valid).toBe(true);
      expect(resolved.candidates[0]).toMatchObject({
        selectedEncounterKey: authoredKey,
        candidateEncounterKeys: [authoredKey],
        selectedPossible: true,
      });
      expect(resolved.validPrefix[0]).toMatchObject({
        encounterKey: 'DevotionTestI',
        countsEncounterDepth: true,
        canEncounterSkip: false,
        blocksGorgon: true,
      });
    },
  );

  it('uses the authored Ship encounter count to withhold Combat2', () => {
    const value = occurrence(loadSurfaceNOPQProject(), 'Surface', 'O', oOccurrenceIds.combat04);
    const phases = encounterPhaseAuthoringDomainForRoom(
      catalog,
      oBiome,
      roomFor(value),
      { kind: 'occurrence', occurrenceId: value.occurrenceId },
      value.encounters,
      { shipEncounterCount: 2 },
    );

    expect(phases.map((phase) => phase.slotKey)).toEqual(['Intro', 'Combat1']);
  });

  it('uses authored Fields decision facts to withhold inactive cages', () => {
    const value = occurrence(
      createGoldenFGHIProject(),
      'Underworld',
      'H',
      createOccurrenceId('golden-h-combat02'),
    );
    const phases = encounterPhaseAuthoringDomainForRoom(
      catalog,
      goldenHBiome,
      roomFor(value),
      { kind: 'occurrence', occurrenceId: value.occurrenceId },
      value.encounters,
      { fieldsCageRewardCount: 2 },
    );

    expect(phases.map((phase) => phase.slotKey)).toEqual(['Passive', 'Cage01', 'Cage02']);
  });
});
