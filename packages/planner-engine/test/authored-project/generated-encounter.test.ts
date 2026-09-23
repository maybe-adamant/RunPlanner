import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createProjectHistory,
  undoProjectHistory,
  redoProjectHistory,
  createEncounterPhaseAddress,
  decodeProjectDocument,
  encodeProjectDocument,
} from '../../src/authored-project';
import { decodeGeneratedEncounterCustomization } from '../../src/authored-project/room-state/decoding/generated-encounter-codec';
import { encounterPhaseAuthoringDomainForRoom } from '../../src/simulation/encounters/authoring-domain';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';

const occurrenceId = goldenFOccurrenceId(5, 1);
const phase = createEncounterPhaseAddress(
  goldenFBiome,
  { kind: 'occurrence', occurrenceId },
  'Encounter',
);
const command = {
  kind: 'ReplaceEncounterCustomization',
  phase,
  decisionKey: 'generatedComposition',
  value: {
    kind: 'generated',
    waveCount: 3,
    highlightKey: 'Guard',
    waves: [{ waveIndex: 3, typeKeys: ['Mage', 'Brawler'] }],
  },
} as const;

describe('sparse generated encounter authorship', () => {
  it('persists complete values immutably, with semantic undo/redo and reset', () => {
    const base = createGoldenFGHIProject();
    const changed = applyProjectHistoryCommand(createProjectHistory(base), catalog, command);
    expect(
      decodeProjectDocument(JSON.parse(encodeProjectDocument(changed.present)), catalog),
    ).toEqual(changed.present);
    expect(undoProjectHistory(changed).present).toBe(base);
    expect(redoProjectHistory(undoProjectHistory(changed)).present).toBe(changed.present);
    expect(applyProjectCommand(changed.present, catalog, { ...command, value: null })).toEqual(
      base,
    );
    const value = changed.present.route.biomes[0]!.topology!.occurrences.find(
      (room) => room.occurrenceId === occurrenceId,
    )!.encounters.customizationByPhase!.Encounter!.generatedComposition;
    expect(value).toEqual(command.value);
    if (value?.kind !== 'generated') throw new Error('missing stored value');
    expect(Object.isFrozen(value.waves![0]!.typeKeys)).toBe(true);
  });

  it('retains the generic payload when concrete encounter identity changes', () => {
    const changed = applyProjectCommand(
      applyProjectCommand(createGoldenFGHIProject(), catalog, command),
      catalog,
      { kind: 'SelectEncounter', phase, encounterKey: 'ArtemisCombatF' },
    );
    const occurrence = changed.route.biomes[0]!.topology!.occurrences.find(
      (room) => room.occurrenceId === occurrenceId,
    )!;
    const domain = encounterPhaseAuthoringDomainForRoom(
      catalog,
      goldenFBiome,
      catalog.rooms.byKey[occurrence.gameName]!,
      phase.owner,
      occurrence.encounters,
      { resolutionContext: { kind: 'knownReward', rewardType: 'MetaCardPointsCommonDrop' } },
    );
    expect(domain[0]?.customization?.[0]).toMatchObject({
      value: command.value,
      selection: { waveCount: { min: 4, max: 4 } },
    });
    const trial = encounterPhaseAuthoringDomainForRoom(
      catalog,
      goldenFBiome,
      catalog.rooms.byKey[occurrence.gameName]!,
      phase.owner,
      { ...occurrence.encounters, encounterKeyByPhase: { Encounter: 'GeneratedF' } },
      { resolutionContext: { kind: 'knownReward', rewardType: 'Devotion' } },
    );
    expect(trial[0]).toMatchObject({
      selectedEncounterDefinitionKey: 'DevotionTestF',
      customization: [{ value: command.value }],
    });
  });

  it('rejects malformed shapes, unknown identities and generation outside the supported room scope', () => {
    for (const value of [
      { kind: 'generated', waveCount: 0 },
      { kind: 'generated', waveCount: 6 },
      { kind: 'generated', waves: [] },
      { ...command.value, unknown: true },
      { kind: 'generated', waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Guard'] }] },
      { kind: 'generated', waves: [{ waveIndex: 1, typeKeys: ['Guard'], weights: { Guard: 0 } }] },
      {
        kind: 'generated',
        waves: [{ waveIndex: 1, typeKeys: ['Guard'], allocations: { Guard: Infinity } }],
      },
    ])
      expect(() => decodeGeneratedEncounterCustomization(value, 'test')).toThrow();
    expect(() =>
      applyProjectCommand(createGoldenFGHIProject(), catalog, {
        ...command,
        value: { kind: 'generated', highlightKey: 'InventedEnemy' },
      }),
    ).toThrow();
    const opening = createGoldenFGHIProject().route.biomes[0]!.topology!.occurrences[0]!;
    const openingDomain = encounterPhaseAuthoringDomainForRoom(
      catalog,
      goldenFBiome,
      catalog.rooms.byKey[opening.gameName]!,
      { kind: 'occurrence', occurrenceId: opening.occurrenceId },
      opening.encounters,
      { includeFixedPhases: true, resolutionContext: { kind: 'knownReward', rewardType: 'Boon' } },
    );
    expect(
      openingDomain
        .flatMap((entry) => entry.customization ?? [])
        .some((entry) => entry.selection.kind === 'generated'),
    ).toBe(false);
  });
});
