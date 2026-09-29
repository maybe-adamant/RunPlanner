import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  activeRoomActionReferences,
  applyProjectCommand,
  createEncounterPhaseAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createShopOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  resolveRoutePosition,
  semanticAddressKey,
  type ProjectDocument,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProject,
  simulateProjectAssembly,
  type RunStateSnapshot,
} from '@run-planner/engine/simulation';
import {
  assembleExecutionProduct,
  ExecutionCompilerError,
} from '@run-planner/engine/execution-plan';
import { loadUnderworldFGHICheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  createFreshFileRouteProject,
  freshFileBridgeId,
  freshFileFBiome,
  freshFileFMidshopId,
  freshFileGBiome,
  freshFileGFirstCombatId,
  freshFileGSecondCombatId,
  freshFileHBiome,
  freshFileIFirstCombatId,
} from '@run-planner/test-fixtures/fresh-file';
import { createRouteStartHistoryView } from '../../src/simulation/history/fold';
import { createInitialSimulationState } from '../../src/simulation/state/construction';
import { createArcanaFearState } from '../../src/simulation';
import { boonReplacementChance } from '../../src/simulation/traits/offer-domain';

let cached: ProjectDocument | undefined;
const freshRoute = () => (cached ??= createFreshFileRouteProject());

type BiomeEvaluation = ReturnType<typeof simulateProject>['route']['biomes'][number];

function biomeOf(project: ProjectDocument, biomeKey: string): BiomeEvaluation {
  const biome = simulateProject(catalog, project).route.biomes.find(
    (candidate) => candidate.biomeKey === biomeKey,
  );
  if (biome === undefined) throw new Error(`missing ${biomeKey}`);
  return biome;
}

/** Encounter identities recorded for one occurrence, in order. */
function recordedEncounters(biome: BiomeEvaluation, occurrenceId: string): readonly string[] {
  if (!('history' in biome)) throw new Error(`${biome.biomeKey} has no history`);
  return biome.history.events.flatMap((event) =>
    event.kind === 'encounterRecorded' &&
    event.origin.kind === 'occurrence' &&
    event.origin.occurrenceId === occurrenceId
      ? [event.encounterKey]
      : [],
  );
}

function allRecordedEncounters(project: ProjectDocument): readonly string[] {
  return simulateProject(catalog, project).route.biomes.flatMap((biome) =>
    'history' in biome
      ? biome.history.events.flatMap((event) =>
          event.kind === 'encounterRecorded' ? [event.encounterKey] : [],
        )
      : [],
  );
}

function snapshots(project: ProjectDocument): readonly RunStateSnapshot[] {
  return simulateProject(catalog, project).route.biomes.flatMap((biome) =>
    'rewards' in biome ? (biome.rewards?.runStateSnapshots ?? []) : [],
  );
}

function snapshotAt(project: ProjectDocument, fragment: string, checkpoint: string) {
  const snapshot = snapshots(project).find(
    (candidate) =>
      candidate.checkpoint === checkpoint && semanticAddressKey(candidate.owner).includes(fragment),
  );
  if (snapshot === undefined) throw new Error(`no ${checkpoint} snapshot at ${fragment}`);
  return snapshot;
}

function occurrenceOf(project: ProjectDocument, biomeKey: string, occurrenceId: string) {
  const occurrence = project.route.biomes
    .find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (occurrence === undefined) throw new Error(`missing ${occurrenceId}`);
  return occurrence;
}

function editOccurrence(
  project: ProjectDocument,
  occurrenceId: string,
  edit: (raw: Record<string, unknown>) => void,
): unknown {
  const raw = JSON.parse(encodeProjectDocument(project));
  for (const biome of raw.route.biomes)
    for (const occurrence of biome.topology?.occurrences ?? [])
      if (occurrence.occurrenceId === occurrenceId) edit(occurrence);
  return raw;
}

describe('Fresh File F→I route', () => {
  it('validates with zero findings; only the route gate withholds publication', () => {
    const evaluation = simulateProject(catalog, freshRoute());
    expect(evaluation.status).toBe('valid');
    expect(evaluation.findings).toEqual([]);
    expect(evaluation.route.biomes.map((biome) => biome.biomeKey)).toEqual(['F', 'G', 'H', 'I']);
    let refusal: unknown;
    try {
      assembleExecutionProduct({
        assembly: simulateProjectAssembly(catalog, freshRoute()),
        catalog,
      });
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toBeInstanceOf(ExecutionCompilerError);
    expect((refusal as ExecutionCompilerError).code).toBe('unsupportedRoute');
    expect((refusal as ExecutionCompilerError).message).toMatch(
      /supports only Underworld, Surface, or Dream/,
    );
  });
});

describe('Fresh File forced biome intros', () => {
  it('forces FishmanIntro once, then resolves ordinary combat still at depth one', () => {
    const g = biomeOf(freshRoute(), 'G');
    expect(recordedEncounters(g, freshFileGFirstCombatId)).toEqual(['FishmanIntro']);
    expect(recordedEncounters(g, freshFileGSecondCombatId)).toEqual(['GeneratedG']);
    const second = snapshotAt(
      freshRoute(),
      `"${freshFileGSecondCombatId}","roomEntered"`,
      'roomEntered',
    );
    expect(second.counters.biomeEncounterDepth).toBe(1);
  });

  it('forces ClockworkIntro in I and never resolves the Chronos intro', () => {
    const i = biomeOf(freshRoute(), 'I');
    expect(recordedEncounters(i, freshFileIFirstCombatId)).toEqual(['ClockworkIntro']);
    const fresh = allRecordedEncounters(freshRoute());
    expect(fresh.filter((key) => key === 'ClockworkIntro')).toHaveLength(1);
    expect(fresh).not.toContain('GeneratedIChronosIntro');
    expect(fresh).not.toContain('GeneratedI_SmallChronosIntro');
    const mature = biomeOf(loadUnderworldFGHICheckpoint(), 'I');
    expect(recordedEncounters(mature, freshFileIFirstCombatId)).toEqual(['GeneratedIChronosIntro']);
    expect(allRecordedEncounters(loadUnderworldFGHICheckpoint())).not.toContain('ClockworkIntro');
  });

  it('reports a generated customization retained on the forced FishmanIntro phase', () => {
    const phase = createEncounterPhaseAddress(
      freshFileGBiome,
      { kind: 'occurrence', occurrenceId: freshFileGFirstCombatId },
      'Encounter',
    );
    const project = applyProjectCommand(freshRoute(), catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase,
      decisionKey: 'generatedComposition',
      value: { kind: 'generated', waveCount: 1 },
    });
    expect(simulateProject(catalog, project).findings).toContainEqual(
      expect.objectContaining({ code: 'encounterCustomizationUnavailable', origin: phase }),
    );
  });
});

describe('Fresh File H_Bridge01', () => {
  const echo = (
    project: ProjectDocument,
    routeKey: 'FreshFile' | 'Underworld',
    occurrence: RoomOccurrence,
  ) =>
    activeRoomActionReferences(
      catalog,
      { kind: 'biome', routeKey, biomeKey: 'H' },
      occurrence,
      resolveRoutePosition(catalog, project.route, 'H'),
    ).filter((reference) => reference.kind === 'interactEncounter');

  it('is an entered WorldShop with no Echo action; mature keeps the Echo story', () => {
    const bridge = occurrenceOf(freshRoute(), 'H', freshFileBridgeId);
    expect(bridge.state).toMatchObject({ kind: 'shop', shop: { profileKey: 'WorldShop' } });
    expect(echo(freshRoute(), 'FreshFile', bridge)).toEqual([]);
    expect(recordedEncounters(biomeOf(freshRoute(), 'H'), freshFileBridgeId)).toEqual([
      'BridgeShop',
    ]);
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, freshRoute()),
    );
    expect(
      session.evaluate({
        kind: 'shopOfferOption',
        offer: createShopOfferAddress(freshFileHBiome, freshFileBridgeId, 'MajorNonBoon'),
        value: { optionKey: 'RoomRewardHealDrop', offer: { rewardType: 'RoomRewardHealDrop' } },
      }),
    ).toMatchObject({ kind: 'shopOffer', result: { supported: true } });
    const mature = loadUnderworldFGHICheckpoint();
    const matureBridge = occurrenceOf(mature, 'H', freshFileBridgeId);
    expect(matureBridge.state).toMatchObject({
      kind: 'fixed',
      reward: { offer: { rewardType: 'Story' } },
    });
    expect(echo(mature, 'Underworld', matureBridge)).toEqual([
      { kind: 'interactEncounter', phaseKey: 'Encounter' },
    ]);
  });

  it('rejects a Fresh bridge Story state at decode', () => {
    const story = occurrenceOf(loadUnderworldFGHICheckpoint(), 'H', freshFileBridgeId);
    const raw = editOccurrence(freshRoute(), freshFileBridgeId, (occurrence) => {
      occurrence.state = JSON.parse(JSON.stringify(story.state));
    });
    expect(() => decodeProjectDocument(raw, catalog)).toThrow(/state\.kind: expected shop/);
  });
});

describe('Fresh File Nectar', () => {
  const optional = createLocalRewardAddress(
    freshFileHBiome,
    createOccurrenceId('golden-h-combat09'),
    'optionalRewards',
    'optional1',
  );

  it('grants a Fields optional Nectar no level; the mature file keeps its level', () => {
    const fresh = applyProjectCommand(freshRoute(), catalog, {
      kind: 'ReplaceLocalReward',
      reward: optional,
      value: { rewardType: 'GiftDrop' },
    });
    const state = occurrenceOf(fresh, 'H', optional.occurrenceId).state;
    const nectar = state.kind === 'fieldsCombat' ? state.optionalRewards.optional1 : undefined;
    expect(nectar?.offer).toEqual({ rewardType: 'GiftDrop' });
    expect(nectar).not.toHaveProperty('levelResolutionsByAcquisitionRole');
    expect(simulateProject(catalog, fresh).findings).toEqual([]);

    const mature = applyProjectCommand(loadUnderworldFGHICheckpoint(), catalog, {
      kind: 'ReplaceLocalReward',
      reward: { ...optional, routeKey: 'Underworld' },
      value: { rewardType: 'GiftDrop' },
    });
    const matureState = occurrenceOf(mature, 'H', optional.occurrenceId).state;
    expect(
      matureState.kind === 'fieldsCombat' ? matureState.optionalRewards.optional1 : undefined,
    ).toMatchObject({
      levelResolutionsByAcquisitionRole: { self: { kind: 'random', targetTraitKey: null } },
    });
  });

  it('rejects a Fresh Nectar level resolution at decode', () => {
    const fresh = applyProjectCommand(freshRoute(), catalog, {
      kind: 'ReplaceLocalReward',
      reward: optional,
      value: { rewardType: 'GiftDrop' },
    });
    const raw = editOccurrence(fresh, optional.occurrenceId, (occurrence) => {
      const state = occurrence.state as {
        optionalRewards: Record<string, Record<string, unknown>>;
      };
      state.optionalRewards.optional1!.levelResolutionsByAcquisitionRole = {
        self: { kind: 'random', targetTraitKey: null },
      };
    });
    expect(() => decodeProjectDocument(raw, catalog)).toThrow(/Pom resolutions are not supported/);
  });
});

describe('Fresh File closed rules along the route', () => {
  it('gates Hestia and Aphrodite on a Poseidon pick, not its offer', () => {
    const sources = (fragment: string, checkpoint: string) =>
      snapshotAt(freshRoute(), fragment, checkpoint).godPool.effectiveSourceKeys;
    const start = sources(
      '"F",{"kind":"occurrence","occurrenceId":"F:start"}',
      'beforeTargetGeneration',
    );
    expect([...start].sort()).toEqual(['ApolloUpgrade', 'DemeterUpgrade', 'PoseidonUpgrade']);
    // F offers Poseidon at fresh-3-1 but enters the Apollo door beside it.
    const afterOffer = sources('"fresh-4-0","roomEntered"', 'roomEntered');
    expect(afterOffer).not.toContain('HestiaUpgrade');
    expect(afterOffer).not.toContain('AphroditeUpgrade');
    // G_MiniBoss01's Poseidon boon is the first Poseidon use.
    const afterPick = sources('"golden-g-b6-e1","beforeRoomExit"', 'beforeRoomExit');
    expect(afterPick).toEqual(expect.arrayContaining(['HestiaUpgrade', 'AphroditeUpgrade']));
  });

  it('limits a reached Fresh shop Boon to gods already picked up', () => {
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, freshRoute()),
    );
    const boon = (source: string) =>
      session.evaluate({
        kind: 'shopOfferOption',
        offer: createShopOfferAddress(freshFileFBiome, freshFileFMidshopId, 'Boon'),
        value: {
          optionKey: 'RandomLoot',
          offer: { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source } },
        },
      });
    // Only Apollo has been picked up before the F midshop.
    expect(boon('ApolloUpgrade')).toMatchObject({ result: { supported: true } });
    expect(boon('PoseidonUpgrade')).toMatchObject({ result: { supported: false } });
    expect(boon('DemeterUpgrade')).toMatchObject({ result: { supported: false } });
  });

  it('offers no element or Death Defiance from any reached Fresh door store or shop', () => {
    const excluded = new Set([
      'AirBoost',
      'EarthBoost',
      'FireBoost',
      'WaterBoost',
      'ElementalBoost',
      'LastStandDrop',
    ]);
    for (const snapshot of snapshots(freshRoute()))
      for (const bag of snapshot.bags)
        if (
          ['RunProgress', 'MetaProgress', 'TartarusRewards', 'FieldsOptionalRewards'].includes(
            bag.storeKey,
          )
        )
          expect(
            bag.entries.filter(
              (entry) => excluded.has(entry.rewardType) && entry.eligibility === 'eligible',
            ),
          ).toEqual([]);
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, freshRoute()),
    );
    let assessed = 0;
    for (const biome of freshRoute().route.biomes)
      for (const occurrence of biome.topology?.occurrences ?? []) {
        if (occurrence.state.kind !== 'shop' || occurrence.state.shop === undefined) continue;
        const profile = catalog.rewards.shops.byKey[occurrence.state.shop.profileKey]!;
        for (const slot of profile.slots.values)
          for (const option of profile.groups.byKey[slot.groupKey]!.options.values) {
            if (!excluded.has(option.rewardType)) continue;
            assessed += 1;
            expect(
              session.evaluate({
                kind: 'shopOfferOption',
                offer: createShopOfferAddress(
                  { kind: 'biome', routeKey: 'FreshFile', biomeKey: biome.biomeKey },
                  occurrence.occurrenceId,
                  slot.key,
                ),
                value: { optionKey: option.key, offer: { rewardType: option.rewardType } },
              }),
              `${occurrence.occurrenceId}.${slot.key}.${option.key}`,
            ).toMatchObject({ result: { supported: false } });
          }
      }
    expect(assessed).toBeGreaterThan(0);
  });

  it('keeps the random boon exchange off along the Fresh route', () => {
    const { route } = freshRoute();
    for (const biomeKey of route.itineraryBiomeKeys) {
      const state = createInitialSimulationState(
        catalog,
        route.loadout,
        route.loadout.startingKeepsakeKey,
        createArcanaFearState(catalog, route.loadout),
        {
          routePosition: resolveRoutePosition(catalog, route, biomeKey),
          historyView: createRouteStartHistoryView(),
        },
      );
      expect(boonReplacementChance(catalog, state)).toBe(0);
    }
  });
});
