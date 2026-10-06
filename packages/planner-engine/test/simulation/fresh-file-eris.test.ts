import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createRoomActionAddress,
  createRoomFeatureAddress,
  roomActionKey,
  semanticAddressKey,
  type BiomeAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject, type RunStateSnapshot } from '@run-planner/engine/simulation';
import {
  createFreshFileRouteProject,
  freshFileGBiome,
  freshFileGIntroId,
  freshFileHBiome,
  freshFileHIntroId,
} from '@run-planner/test-fixtures/fresh-file';
import { erisGiftDropped } from '../../src/simulation/rewards/biome/lifecycle-transitions/eris-interacted';
import type { CanonicalAuthoredRoom } from '../../src/simulation/materialization';
import { replaceSimulationTraitHistory } from '../../src/simulation/state/transitions';
import { createTraitHistoryState } from '../../src/simulation/traits';
import { recordFixedAcquisitionTraitGrant } from '../../src/simulation/traits/offers';
import { initializeTestRewardBranches } from '../support/arcana-fear';

let cached: ProjectDocument | undefined;
const freshRoute = () => (cached ??= createFreshFileRouteProject());

function setEris(
  project: ProjectDocument,
  biome: BiomeAddress,
  occurrenceId: OccurrenceId,
  spawned: boolean,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'SetErisSpawned',
    occurrence: createOccurrenceAddress(biome, occurrenceId),
    spawned,
  });
}

function occurrenceOf(project: ProjectDocument, biomeKey: string, occurrenceId: string) {
  const occurrence = project.route.biomes
    .find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (occurrence === undefined) throw new Error(`missing ${occurrenceId}`);
  return occurrence;
}

function preExit(project: ProjectDocument, occurrenceId: string): RunStateSnapshot {
  const snapshot = simulateProject(catalog, project)
    .route.biomes.flatMap((biome) =>
      'rewards' in biome ? (biome.rewards?.runStateSnapshots ?? []) : [],
    )
    .find(
      (candidate) =>
        candidate.checkpoint === 'beforeRoomExit' &&
        semanticAddressKey(candidate.owner).includes(`"${occurrenceId}","beforeRoomExit"`),
    );
  if (snapshot === undefined) throw new Error(`no pre-exit snapshot at ${occurrenceId}`);
  return snapshot;
}

const erisAction = (biome: BiomeAddress, occurrenceId: OccurrenceId) =>
  createRoomActionAddress(biome, occurrenceId, roomActionKey({ kind: 'interactEris' }));

describe('Fresh File Eris', () => {
  it('derives the talk and its required gift on a spawned intro', () => {
    const intro = occurrenceOf(freshRoute(), 'G', freshFileGIntroId);
    expect(intro.eris).toEqual({ spawned: true });
    expect(intro.roomActions.order).toEqual([
      { kind: 'interactEris' },
      { kind: 'interactAcquisitionEntry', siteKey: 'erisGift', entryKey: 'gift' },
    ]);
    expect(intro.acquisitionSites?.erisGift?.pickupEntries?.gift?.offer).toEqual({
      rewardType: 'MetaCardPointsCommonDrop',
    });
    const evaluation = simulateProject(catalog, freshRoute());
    expect(evaluation.status).toBe('valid');
    expect(evaluation.findings).toEqual([]);
  });

  it('settles the talk and the gift before G_Intro generates its doors', () => {
    const g = simulateProject(catalog, freshRoute()).route.biomes.find(
      (biome) => biome.biomeKey === 'G',
    );
    if (g === undefined || !('history' in g)) throw new Error('G has no history');
    expect(
      g.history.events.flatMap((event) =>
        'origin' in event &&
        event.origin.kind === 'occurrence' &&
        event.origin.occurrenceId === freshFileGIntroId &&
        ['erisInteracted', 'acquisitionPointReached', 'outgoingGenerationCheckpoint'].includes(
          event.kind,
        )
          ? [event.kind]
          : [],
      ),
    ).toEqual(['erisInteracted', 'acquisitionPointReached', 'outgoingGenerationCheckpoint']);
  });

  it('credits the gift and applies the curse; an unspawned intro derives nothing', () => {
    const spawned = preExit(freshRoute(), freshFileGIntroId);
    const unspawned = setEris(freshRoute(), freshFileGBiome, freshFileGIntroId, false);
    const intro = occurrenceOf(unspawned, 'G', freshFileGIntroId);
    expect(intro.eris).toBeUndefined();
    expect(intro.roomActions.order).toEqual([]);
    expect(intro.acquisitionSites).toBeUndefined();
    const plain = preExit(unspawned, freshFileGIntroId);
    expect(spawned.resourceGains.MetaCardPointsCommon).toBe(
      (plain.resourceGains.MetaCardPointsCommon ?? 0) + 20,
    );
    expect(Object.keys(spawned.traits.equippedTraits)).toContain('ErisCurseTrait');
    expect(Object.keys(plain.traits.equippedTraits)).not.toContain('ErisCurseTrait');
    expect(simulateProject(catalog, unspawned).findings).toEqual([]);
  });

  it('reports a later spawn once cursed, retaining the observation', () => {
    const repeated = setEris(freshRoute(), freshFileHBiome, freshFileHIntroId, true);
    expect(occurrenceOf(repeated, 'H', freshFileHIntroId).eris).toEqual({ spawned: true });
    const evaluation = simulateProject(catalog, repeated);
    const owner = createRoomFeatureAddress(
      createOccurrenceAddress(freshFileHBiome, freshFileHIntroId),
      {
        kind: 'erisSpawn',
      },
    );
    expect(
      evaluation.findings.map((finding) => [finding.code, semanticAddressKey(finding.origin)]),
    ).toEqual([['erisSpawnUnavailable', semanticAddressKey(owner)]]);
    // Eris spawns on entry: the observation blocks at the room's Overview, before her talk.
    const h = evaluation.route.biomes.find((biome) => biome.biomeKey === 'H');
    if (h === undefined || !('history' in h) || !('coverage' in h) || h.coverage.kind !== 'prefix')
      throw new Error('H has no blocked evaluation');
    expect(h.coverage.blockedAt).toEqual(owner);
    expect(h.coverage.roomTimeline).toBeUndefined();
    expect(
      h.history.events.some(
        (event) =>
          event.kind === 'erisInteracted' &&
          event.origin.kind === 'occurrence' &&
          event.origin.occurrenceId === freshFileHIntroId,
      ),
    ).toBe(false);
    expect(evaluation.findings[0]?.evidence).toEqual({
      reason: 'alreadyCursed',
      curseTraitKey: 'ErisCurseTrait',
    });
  });

  it('settles the required H Psyche gift without tracking Psyche', () => {
    const hOnly = setEris(
      setEris(freshRoute(), freshFileGBiome, freshFileGIntroId, false),
      freshFileHBiome,
      freshFileHIntroId,
      true,
    );
    const evaluation = simulateProject(catalog, hOnly);
    expect(evaluation.findings).toEqual([]);
    const snapshot = preExit(hOnly, freshFileHIntroId);
    expect(Object.keys(snapshot.traits.equippedTraits)).toContain('ErisCurseTrait');
    expect('MemPointsCommon' in snapshot.resourceGains).toBe(false);
    const h = evaluation.route.biomes.find((biome) => biome.biomeKey === 'H');
    if (h === undefined || !('history' in h)) throw new Error('H has no history');
    expect(
      h.history.events.some(
        (event) =>
          event.kind === 'acquisitionPointReached' &&
          event.origin.kind === 'occurrence' &&
          event.origin.occurrenceId === freshFileHIntroId &&
          event.siteKey === 'erisGift',
      ),
    ).toBe(true);
    if (!('rewards' in h) || h.rewards === undefined) throw new Error('H has no rewards');
    for (const branch of h.rewards.branches) {
      expect(branch.state.rewardHistory.consumableRecord.MemPointsCommonDrop).toBeGreaterThan(0);
      expect('MemPointsCommon' in branch.state.rewardHistory.resourceGains).toBe(false);
    }
  });

  it('drops the gift only where that exact talk applied the curse', () => {
    const gTalk = erisAction(freshFileGBiome, freshFileGIntroId);
    const hTalk = erisAction(freshFileHBiome, freshFileHIntroId);
    const branch = initializeTestRewardBranches()[0]!;
    const cursedAt = Object.freeze({
      ...branch,
      state: replaceSimulationTraitHistory(
        branch.state,
        recordFixedAcquisitionTraitGrant(
          catalog,
          createTraitHistoryState(),
          gTalk,
          1,
          'erisInteraction',
          'ErisCurseTrait',
        ),
      ),
    });
    const hIntro = {
      gameName: 'H_Intro',
      origin: createOccurrenceAddress(freshFileHBiome, freshFileHIntroId),
    } as CanonicalAuthoredRoom;
    const gIntro = {
      gameName: 'G_Intro',
      origin: createOccurrenceAddress(freshFileGBiome, freshFileGIntroId),
    } as CanonicalAuthoredRoom;
    expect(erisGiftDropped(catalog, gIntro, gTalk, [cursedAt])).toBe(true);
    expect(erisGiftDropped(catalog, hIntro, hTalk, [cursedAt])).toBe(false);
    expect(erisGiftDropped(catalog, hIntro, hTalk, [branch])).toBe(false);
  });
});
