import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteAddress,
  createTargetAddress,
  ProjectCommandContractError,
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

function sourceDecision(project: ReturnType<typeof surfaceProject>, biome = oBiome) {
  const topology = project.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey)?.topology;
  if (topology === null || topology === undefined) throw new Error('expected topology');
  return topology.decisions.find(
    (decision) =>
      decision.kind === 'exit' &&
      decision.source.kind === 'occurrence' &&
      decision.source.occurrenceId === 'o-source',
  );
}

describe('authored-project room replacement commands', () => {
  it('leaves replacement Shop inventory unresolved after a route loadout change', () => {
    const initial = fProject();
    const initialLoadout = initial.routes.find((route) => route.routeKey === 'Underworld')?.loadout;
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

    const occurrence = project.routes[0]?.biomes[0]?.topology?.occurrences.find(
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

    expect(changed.routes[0]?.biomes[0]?.topology?.occurrences).toContainEqual(
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
    const slotId = createOccurrenceId('replacement-n-combat01');
    project = applyProjectCommand(project, catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', 'combat01'),
      occurrenceId: slotId,
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(nBiome, slotId),
        gameName: 'N_Combat02',
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceOccurrenceRoom',
        detail: 'Hub slot identity is declaration-fixed',
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
    const retained = takeover.routes[0]?.biomes[1]?.topology;
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
    const widenedTopology = takeover.routes[0]?.biomes[1]?.topology;
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
    expect(
      replaced.routes.find((route) => route.routeKey === 'Surface')?.biomes[3]?.topology
        ?.occurrences,
    ).toContainEqual(expect.objectContaining({ gameName: 'Q_Combat05' }));
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
