import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  acquisitionSiteStorageKey,
  applyProjectCommand,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
  createAcquisitionRoleAddress,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createFountainRarityOutcomeAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteAddress,
  createRoomActionAddress,
  createTargetAddress,
  ProjectCommandContractError,
  roomActionKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';

import {
  fBiome,
  fProject,
  gBiome,
  gProject,
  nBiome,
  nProject,
  oBiome,
  qBiome,
  surfaceProject,
} from '../support/configured-projects';
import { nLocalOccurrenceIds } from '../support/n-local-occurrences';

function sourceDecision(project: ReturnType<typeof surfaceProject>, biome = oBiome) {
  const topology = project.route.biomes.find(
    (candidate) => candidate.biomeKey === biome.biomeKey,
  )?.topology;
  if (topology === null || topology === undefined) throw new Error('expected topology');
  return topology.decisions.find(
    (decision) =>
      decision.kind === 'exit' &&
      decision.source.kind === 'occurrence' &&
      decision.source.occurrenceId === 'o-source',
  );
}

function fRewardTarget(
  gameName: 'F_Combat02' | 'F_Reprieve01',
  suffix: string,
): {
  readonly project: ProjectDocument;
  readonly occurrenceId: ReturnType<typeof createOccurrenceId>;
} {
  const openingId = createOccurrenceId(`replacement-${suffix}-opening`);
  const occurrenceId = createOccurrenceId(`replacement-${suffix}-target`);
  let project = applyProjectCommand(fProject(), catalog, {
    kind: 'CreateStart',
    biome: fBiome,
    occurrenceId: openingId,
    gameName: 'F_Opening01',
  });
  const decision = createExitDecisionAddress(fBiome, {
    kind: 'occurrence',
    occurrenceId: openingId,
  });
  project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(fBiome, decision.source),
    storeKey: 'RunProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(fBiome, decision.source, 'exit1'),
    occurrenceId,
    gameName,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(fBiome, occurrenceId),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  return Object.freeze({ project, occurrenceId });
}

function fOccurrence(document: ProjectDocument, occurrenceId: string) {
  const occurrence = document.route.biomes[0]?.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  if (occurrence === undefined) throw new Error(`missing F occurrence ${occurrenceId}`);
  return occurrence;
}

describe('authored-project room replacement commands', () => {
  it('preserves an Artificer site and action when the compatible incoming reward survives replacement', () => {
    const target = fRewardTarget('F_Reprieve01', 'artificer');
    const source = createIncomingRewardAddress(fBiome, target.occurrenceId);
    const acquisition = createAcquisitionRoleAddress(source, 'source');
    const siteKey = acquisitionSiteStorageKey(
      artificerAcquisitionSite(createOccurrenceAddress(fBiome, target.occurrenceId), source),
    );
    const entryKey = artificerReplacementEntryKey(source, 'source');
    const artificerAction = {
      kind: 'interactAcquisitionEntry' as const,
      siteKey,
      entryKey,
    };
    const converted = applyProjectCommand(target.project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition,
      value: { kind: 'artificer' },
    });

    const replaced = applyProjectCommand(converted, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(fBiome, target.occurrenceId),
      gameName: 'F_Combat02',
    });
    const occurrence = fOccurrence(replaced, target.occurrenceId);
    expect(occurrence.state).toMatchObject({
      kind: 'counted',
      reward: {
        offer: { rewardType: 'Boon' },
        dispositionByAcquisitionRole: { source: { kind: 'artificer' } },
      },
    });
    expect(occurrence.acquisitionSites?.[siteKey]?.pickupEntries).toHaveProperty(entryKey, null);
    expect(occurrence.roomActions.order).toContainEqual(artificerAction);
    expect(occurrence.roomActions.order).not.toContainEqual({ kind: 'useFountain' });
  });

  it('removes an Artificer site and action when replacement removes its source reward', () => {
    const target = fRewardTarget('F_Reprieve01', 'artificer-removal');
    const source = createIncomingRewardAddress(fBiome, target.occurrenceId);
    const acquisition = createAcquisitionRoleAddress(source, 'source');
    const siteKey = acquisitionSiteStorageKey(
      artificerAcquisitionSite(createOccurrenceAddress(fBiome, target.occurrenceId), source),
    );
    const entryKey = artificerReplacementEntryKey(source, 'source');
    const converted = applyProjectCommand(target.project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition,
      value: { kind: 'artificer' },
    });

    const replaced = applyProjectCommand(converted, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(fBiome, target.occurrenceId),
      gameName: 'F_Shop01',
    });
    const occurrence = fOccurrence(replaced, target.occurrenceId);
    expect(occurrence.state.kind).toBe('shop');
    expect(occurrence.acquisitionSites?.[siteKey]).toBeUndefined();
    expect(occurrence.roomActions.order).not.toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey,
      entryKey,
    });
  });

  it('removes Reprieve fountain state and its action when replacement has no fountain', () => {
    const target = fRewardTarget('F_Reprieve01', 'fountain-removal');
    const fountainAction = createRoomActionAddress(
      fBiome,
      target.occurrenceId,
      roomActionKey({ kind: 'useFountain' }),
    );
    const withFountainResult = applyProjectCommand(target.project, catalog, {
      kind: 'ReplaceFountainRarityTarget',
      outcome: createFountainRarityOutcomeAddress(fountainAction),
      targetTraitKey: 'ApolloWeaponBoon',
    });

    const replaced = applyProjectCommand(withFountainResult, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(fBiome, target.occurrenceId),
      gameName: 'F_Combat02',
    });
    const occurrence = fOccurrence(replaced, target.occurrenceId);
    expect(occurrence.fountainRarityResult).toBeUndefined();
    expect(occurrence.roomActions.order).not.toContainEqual({ kind: 'useFountain' });
  });

  it('schedules the declaration-required fountain action when combat becomes a Reprieve', () => {
    const target = fRewardTarget('F_Combat02', 'fountain-creation');
    const replaced = applyProjectCommand(target.project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(fBiome, target.occurrenceId),
      gameName: 'F_Reprieve01',
    });

    expect(fOccurrence(replaced, target.occurrenceId).roomActions.order).toEqual([
      {
        kind: 'interactIncomingReward',
        producerPoint: 'roomRewardPickup',
        acquisitionRole: 'source',
      },
      { kind: 'useFountain' },
    ]);
  });

  it('cannot replace an ordinary door target with a fixed completion room', () => {
    const openingId = createOccurrenceId('fixed-completion-replacement-opening');
    const targetId = createOccurrenceId('fixed-completion-replacement-target');
    let project = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: openingId,
      gameName: 'F_Opening01',
    });
    const decision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: openingId,
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, decision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, decision.source, 'exit1'),
      occurrenceId: targetId,
      gameName: 'F_Combat02',
    });

    for (const gameName of ['F_Boss01', 'F_PostBoss01'] as const) {
      expect(() =>
        applyProjectCommand(project, catalog, {
          kind: 'ReplaceOccurrenceRoom',
          occurrence: createOccurrenceAddress(fBiome, targetId),
          gameName,
        }),
      ).toThrowError(
        expect.objectContaining({ detail: `${gameName} is not an ordinary normal-door target` }),
      );
    }
  });

  it('leaves replacement Shop inventory unresolved after a route loadout change', () => {
    const initial = fProject();
    const initialLoadout = initial.route?.loadout;
    const replacementWeapon = catalog.weapons.values.find(
      (weapon) => weapon.key !== initialLoadout?.weaponKey,
    );
    if (replacementWeapon === undefined) throw new Error('missing alternate test weapon');
    const loadout = Object.freeze({
      weaponKey: replacementWeapon.key,
      aspectKey: replacementWeapon.defaultAspectKey,
    });
    let project = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceRouteLoadout',
      route: createRouteAddress('Underworld'),
      ...loadout,
    });
    const openingId = createOccurrenceId('replacement-loadout-opening');
    const targetId = createOccurrenceId('replacement-loadout-target');
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: openingId,
      gameName: 'F_Opening01',
    });
    const decision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: openingId,
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, decision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, decision.source, 'exit1'),
      occurrenceId: targetId,
      gameName: 'F_Combat02',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(fBiome, targetId),
      gameName: 'F_Shop01',
    });

    const occurrence = project.route?.biomes[0]?.topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === targetId,
    );
    if (occurrence?.state.kind !== 'shop' || occurrence.state.shop === undefined) {
      throw new Error('replacement did not create an active Shop');
    }
    expect(occurrence.state.shop.offers.MajorNonBoon?.reward).toBeNull();
  });

  it('changes only declared start choices, retains the occurrence identity, and noops unchanged input', () => {
    const startId = createOccurrenceId('replacement-start');
    const initial = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: startId,
      gameName: 'F_Opening01',
    });
    const changed = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(fBiome, startId),
      gameName: 'F_Opening02',
    });

    expect(changed.route?.biomes[0]?.topology?.occurrences).toContainEqual(
      expect.objectContaining({ occurrenceId: 'replacement-start', gameName: 'F_Opening02' }),
    );
    expect(
      applyProjectCommand(changed, catalog, {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(fBiome, startId),
        gameName: 'F_Opening02',
      }),
    ).toBe(changed);
    expect(() =>
      applyProjectCommand(changed, catalog, {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(fBiome, startId),
        gameName: 'F_Combat01',
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceOccurrenceRoom',
        detail: 'F_Combat01 is not a declared start room',
      }),
    );
  });

  it('retains bounded PreHub-stage and Hub target identities', () => {
    const openingId = createOccurrenceId('replacement-n-opening');
    const prehubId = createOccurrenceId('replacement-n-prehub');
    let project = applyProjectCommand(nProject(), catalog, {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: openingId,
    });
    const openingDecision = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: openingId,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: openingDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(nBiome, openingDecision.source, 'prehub'),
      occurrenceId: prehubId,
      gameName: 'N_PreHub01',
    });

    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(nBiome, prehubId),
        gameName: 'N_Combat01',
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceOccurrenceRoom',
        detail: 'N_Combat01 is not available in stage entry',
      }),
    );

    const preHubDecision = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: prehubId,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: preHubDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceWithHubDecision',
      decision: preHubDecision,
      hub: createHubDecisionAddress(nBiome, 'hub'),
    });
    const slotId = createOccurrenceId('replacement-n-combat02');
    const localIds = nLocalOccurrenceIds('combat02', 'replacement');
    project = applyProjectCommand(project, catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', 'combat02'),
      occurrenceId: slotId,
      localOccurrenceIdsBySlot: localIds,
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(nBiome, slotId),
        gameName: 'N_Combat01',
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceOccurrenceRoom',
        detail: 'Hub slot identity is declaration-fixed',
      }),
    );
    const localId = localIds.sideDoor1;
    if (localId === undefined) throw new Error('combat02 local occurrence is missing');
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(nBiome, localId),
        gameName: 'N_Sub03',
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceOccurrenceRoom',
        detail: 'local visit slot identity is declaration-fixed',
      }),
    );
  });

  it('retains structurally representable takeover leaves until explicit reconciliation after replacement', () => {
    let takeover = applyProjectCommand(gProject(), catalog, {
      kind: 'CreateStart',
      biome: gBiome,
      occurrenceId: createOccurrenceId('widening-intro'),
    });
    const introDecision = createExitDecisionAddress(gBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('widening-intro'),
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'CreateBatch',
      decision: introDecision,
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(gBiome, introDecision.source),
      storeKey: 'RunProgress',
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(gBiome, introDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('widening-source'),
      gameName: 'G_MiniBoss02',
    });
    const takeoverDecision = createExitDecisionAddress(gBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('widening-source'),
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'CreateTakeoverBatch',
      decision: takeoverDecision,
      gameName: 'G_PreBoss01',
      targetOccurrenceIds: { exit1: createOccurrenceId('widening-shop') },
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(gBiome, createOccurrenceId('widening-source')),
      gameName: 'G_Combat02',
    });
    const retained = takeover.route?.biomes[1]?.topology;
    expect(
      retained?.decisions.find(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === 'widening-source',
      ),
    ).toMatchObject({
      normal: { targets: [{ exitKey: 'exit1', occurrenceId: 'widening-shop' }] },
      selection: { kind: 'derived' },
    });
    expect(retained?.occurrences).toContainEqual(
      expect.objectContaining({
        occurrenceId: 'widening-shop',
        state: expect.objectContaining({ kind: 'shop', shop: expect.any(Object) }),
      }),
    );
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'ReconcileTakeoverBatch',
      decision: takeoverDecision,
      gameName: 'G_PreBoss01',
      targetOccurrenceIds: {
        exit1: createOccurrenceId('widening-shop'),
        exit2: createOccurrenceId('widening-free-2'),
        exit3: createOccurrenceId('widening-free-3'),
      },
    });
    const widenedTopology = takeover.route?.biomes[1]?.topology;
    expect(widenedTopology?.occurrences).toContainEqual(
      expect.objectContaining({
        occurrenceId: 'widening-shop',
        state: { kind: 'shop' },
      }),
    );
    expect(widenedTopology?.occurrences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          occurrenceId: 'widening-free-2',
          state: expect.objectContaining({ kind: 'freeReward' }),
        }),
        expect.objectContaining({
          occurrenceId: 'widening-free-3',
          state: expect.objectContaining({ kind: 'freeReward' }),
        }),
      ]),
    );
  });

  it('keeps staged replacements inside the selected batch pool', () => {
    let project = applyProjectCommand(surfaceProject(4), catalog, {
      kind: 'CreateStart',
      biome: qBiome,
      occurrenceId: createOccurrenceId('q-intro'),
    });
    const introDecision = createExitDecisionAddress(qBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('q-intro'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: introDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(qBiome, introDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('q-foyer'),
      gameName: 'Q_Combat10',
    });
    const foyerDecision = createExitDecisionAddress(qBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('q-foyer'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: foyerDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(qBiome, foyerDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('q-first-fork'),
      gameName: 'Q_Combat03',
    });

    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(qBiome, createOccurrenceId('q-first-fork')),
        gameName: 'Q_Combat02',
      }),
    ).toThrow(ProjectCommandContractError);
    const replaced = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(qBiome, createOccurrenceId('q-first-fork')),
      gameName: 'Q_Combat05',
    });
    expect(replaced.route?.biomes[3]?.topology?.occurrences).toContainEqual(
      expect.objectContaining({ gameName: 'Q_Combat05' }),
    );
  });

  it('reconciles an outgoing generated batch store from the replacement source without removing targets', () => {
    let project = applyProjectCommand(surfaceProject(2), catalog, {
      kind: 'CreateStart',
      biome: oBiome,
      occurrenceId: createOccurrenceId('o-intro'),
    });
    const introDecision = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('o-intro'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: introDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(oBiome, introDecision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(oBiome, introDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('o-source'),
      gameName: 'O_MiniBoss01',
    });
    const source = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('o-source'),
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision: source });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(oBiome, source.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(oBiome, source.source, 'exit1'),
      occurrenceId: createOccurrenceId('o-target'),
      gameName: 'O_Combat02',
    });

    const shipSource = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(oBiome, createOccurrenceId('o-source')),
      gameName: 'O_Combat01',
    });
    expect(sourceDecision(shipSource)).toMatchObject({
      normal: {
        rewardStore: { kind: 'sourceOfferPoint' },
        targets: [{ occurrenceId: 'o-target', exitKey: 'exit1' }],
      },
    });

    const standardSource = applyProjectCommand(shipSource, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(oBiome, createOccurrenceId('o-source')),
      gameName: 'O_MiniBoss01',
    });
    expect(sourceDecision(standardSource)).toMatchObject({
      normal: {
        rewardStore: { kind: 'authoredBaseStore', baseRewardStoreKey: null },
        targets: [{ occurrenceId: 'o-target', exitKey: 'exit1' }],
      },
    });
  });
});
