import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRewardWheelAddress,
  createTargetAddress,
  semanticAddressKey,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { loadSurfaceNOProject } from '@run-planner/test-fixtures/surface';
import { createCandidateSessionFactory } from '@planner/projections/candidates/candidateProjection';
import { createContextualOptionResolver } from '@planner/projections/contextual/contextualOptions';
import { createContextualPickerProjection } from '@planner/projections/contextual/contextualPicker';
import { createRewardPickerProjection } from '@planner/projections/rewards/rewardPicker';
import { createTraitDomainProjection } from '@planner/projections/rewards/traitDomainProjection';
import {
  createStructuredWorkspaceProjection,
  type StructuredWorkspaceProjection,
  type WorkspaceMixedBatchNode,
  type WorkspaceOrdinaryBatchNode,
  type WorkspaceTakeoverBatchNode,
} from '@planner/projections/structured-workspace';

const contextualPicker = createContextualPickerProjection(createContextualOptionResolver(catalog));
const projection = createStructuredWorkspaceProjection(
  catalog,
  {
    candidateSessions: createCandidateSessionFactory(catalog),
    contextualPicker,
    rewardPicker: createRewardPickerProjection(catalog, contextualPicker),
    traitDomain: createTraitDomainProjection(catalog, contextualPicker),
  },
  () => createOccurrenceId('o-pair-relation-start'),
);

const oBiome = createBiomeAddress('Surface', 'O');
const fountainId = createOccurrenceId('o-pair-relation-fountain');

type BatchNode = WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode;

function project(document: ProjectDocument): StructuredWorkspaceProjection {
  return projection.project(simulateProjectAssembly(catalog, document));
}

function occurrence(occurrenceId: string): OccurrenceId {
  return createOccurrenceId(occurrenceId);
}

function decisionAddress(sourceOccurrenceId: string) {
  return createExitDecisionAddress(oBiome, {
    kind: 'occurrence',
    occurrenceId: occurrence(sourceOccurrenceId),
  });
}

/** The one batch node a given source occurrence's exit decision publishes. */
function batchNode(
  workspace: StructuredWorkspaceProjection,
  sourceOccurrenceId: string,
): BatchNode {
  const key = `batch:${semanticAddressKey(decisionAddress(sourceOccurrenceId))}`;
  const node = workspace.route.biomes
    .flatMap((biome) => biome.nodes)
    .find((candidate) => candidate.key === key);
  if (
    node?.kind !== 'ordinaryBatch' &&
    node?.kind !== 'mixedBatch' &&
    node?.kind !== 'takeoverBatch'
  ) {
    throw new Error(`${sourceOccurrenceId} has no batch node`);
  }
  return node;
}

/** The ordinary store selector, if this decision publishes one at all. */
function storeSelector(workspace: StructuredWorkspaceProjection, sourceOccurrenceId: string) {
  return workspace.interactions.batchRewardStores.get(
    semanticAddressKey(
      createBatchRewardStoreAddress(oBiome, decisionAddress(sourceOccurrenceId).source),
    ),
  );
}

/**
 * Rebuilds the exit decision at one source so a Fountain can be authored behind
 * it. The Fountain is the only O room whose door store is neither forced nor
 * individually declared, so it is the only target that takes what the decision
 * hands it.
 */
function fountainBehind(
  sourceOccurrenceId: string,
  options: { readonly baseStoreKey?: string; readonly encounterCount?: 3 } = {},
): ProjectDocument {
  const decision = decisionAddress(sourceOccurrenceId);
  let document = applyProjectCommand(loadSurfaceNOProject(), catalog, {
    kind: 'RemoveExitDecision',
    decision,
  });
  document = applyProjectCommand(document, catalog, { kind: 'CreateBatch', decision });
  if (options.baseStoreKey !== undefined) {
    document = applyProjectCommand(document, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(oBiome, decision.source),
      storeKey: options.baseStoreKey,
    });
  }
  if (options.encounterCount !== undefined) {
    document = applyProjectCommand(document, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: createOccurrenceAddress(oBiome, occurrence(sourceOccurrenceId)),
      encounterCount: options.encounterCount,
    });
  }
  return applyProjectCommand(document, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(oBiome, decision.source, 'exit1'),
    occurrenceId: fountainId,
    gameName: 'O_Reprieve01',
  });
}

/** The same rebuilt decision, stopped before any room is picked. */
function emptyBatchAt(sourceOccurrenceId: string): ProjectDocument {
  const decision = decisionAddress(sourceOccurrenceId);
  const document = applyProjectCommand(loadSurfaceNOProject(), catalog, {
    kind: 'RemoveExitDecision',
    decision,
  });
  return applyProjectCommand(document, catalog, { kind: 'CreateBatch', decision });
}

/** O_Combat01 -> O_Shop01 with one normal door and the Zagreus contract behind the shop. */
function contractShop(baseStoreKey: string): ProjectDocument {
  const combat01 = decisionAddress('surface-o-combat01');
  const shopId = occurrence('o-pair-relation-shop');
  const shop = decisionAddress('o-pair-relation-shop');
  let document = applyProjectCommand(loadSurfaceNOProject(), catalog, {
    kind: 'RemoveExitDecision',
    decision: combat01,
  });
  document = applyProjectCommand(document, catalog, { kind: 'CreateBatch', decision: combat01 });
  document = applyProjectCommand(document, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(oBiome, combat01.source, 'exit1'),
    occurrenceId: shopId,
    gameName: 'O_Shop01',
  });
  document = applyProjectCommand(document, catalog, { kind: 'CreateBatch', decision: shop });
  document = applyProjectCommand(document, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(oBiome, shop.source),
    storeKey: baseStoreKey,
  });
  document = applyProjectCommand(document, catalog, {
    kind: 'AddZagreusContract',
    additional: createAdditionalExitAddress(oBiome, shopId, 'zagreusContract'),
    occurrenceId: occurrence('o-pair-relation-contract'),
  });
  return applyProjectCommand(document, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(oBiome, shop.source, 'exit1'),
    occurrenceId: occurrence('o-pair-relation-shop-door'),
    gameName: 'O_Combat02',
  });
}

function selectAt(
  document: ProjectDocument,
  sourceOccurrenceId: string,
  value:
    | { readonly kind: 'normal'; readonly exitKey: string }
    | {
        readonly kind: 'additional';
        readonly additionalExitKey: string;
      },
): ProjectDocument {
  return applyProjectCommand(document, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(oBiome, decisionAddress(sourceOccurrenceId).source),
    value,
  });
}

describe('O door-store pair relation', () => {
  it('reports the ship-decided value on every ship-source door, whatever the target', () => {
    const workspace = project(loadSurfaceNOProject());
    // The value is the batch's: the wheel decided it before any door existed,
    // so it is reported even where the room behind the door discards it.
    const shipSourceTargets = {
      'surface-o-combat04': 'O_Combat07',
      'surface-o-combat02': 'O_PreBoss01',
      'surface-o-combat01': 'O_Devotion01',
    } as const;
    for (const [source, targetGameName] of Object.entries(shipSourceTargets)) {
      const node = batchNode(workspace, source);
      // Pin the target so a re-authored fixture cannot turn this vacuous.
      expect(node.targets.map((target) => target.room.gameName)).toEqual([targetGameName]);
      expect(node.rewardPool?.inherited?.storeKey).toBeDefined();
      // Read-only throughout: the wheel owns the choice, not the door.
      expect(node.rewardStore).toBeUndefined();
      expect(storeSelector(workspace, source)).toBeUndefined();
    }
  });

  it('shows what the selected door counts only where it differs from the pool', () => {
    const workspace = project(loadSurfaceNOProject());
    const effectiveAt = (source: string) => batchNode(workspace, source).rewardPool?.effective;

    // A ship combat records no entered store, so the carried pool is discarded.
    expect(effectiveAt('surface-o-combat04')).toBe('Discarded by Combat 07');

    // Devotion forces RunProgress, which this ship also rolled: nothing differs.
    expect(batchNode(workspace, 'surface-o-combat01').rewardPool?.inherited?.storeKey).toBe(
      'RunProgress',
    );
    expect(effectiveAt('surface-o-combat01')).toBeUndefined();

    // Story and the Preboss bank the carried pool.
    expect(storeSelector(workspace, 'surface-o-devotion')?.selected).toBe('MetaProgress');
    expect(effectiveAt('surface-o-devotion')).toBeUndefined();
    expect(effectiveAt('surface-o-combat02')).toBeUndefined();
  });

  it('reports the forced store when a target overrides the carried value', () => {
    const flipped = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel: createRewardWheelAddress(oBiome, occurrence('surface-o-combat01'), 'wheel1'),
      storeKey: 'MetaProgress',
    });
    const node = batchNode(project(flipped), 'surface-o-combat01');
    expect(node.rewardPool?.inherited?.storeKey).toBe('MetaProgress');
    expect(node.rewardPool?.effective).toBe('Major Reward');
  });

  it('reads the selected exit of O_Combat01 -> O_Shop01, contract included', () => {
    const unselected = batchNode(project(contractShop('RunProgress')), 'o-pair-relation-shop');
    expect(unselected.rewardPool).toBeDefined();
    expect(unselected.rewardPool?.effective).toBeUndefined();

    // The contract counts Major Reward, the same pool the batch carries.
    const contract = selectAt(contractShop('RunProgress'), 'o-pair-relation-shop', {
      kind: 'additional',
      additionalExitKey: 'zagreusContract',
    });
    expect(batchNode(project(contract), 'o-pair-relation-shop').rewardPool?.effective).toBe(
      undefined,
    );

    // Against a Minor Reward pool the contract's own store differs, named with its room.
    const differing = selectAt(contractShop('MetaProgress'), 'o-pair-relation-shop', {
      kind: 'additional',
      additionalExitKey: 'zagreusContract',
    });
    expect(batchNode(project(differing), 'o-pair-relation-shop').rewardPool?.effective).toBe(
      'Major Reward · Infernal Contract',
    );

    const door = selectAt(contractShop('RunProgress'), 'o-pair-relation-shop', {
      kind: 'normal',
      exitKey: 'exit1',
    });
    expect(batchNode(project(door), 'o-pair-relation-shop').rewardPool?.effective).toBe(
      'Discarded by Combat 02',
    );
  });

  it('reports the ship-decided store on a Fountain and links to the deciding wheel', () => {
    const workspace = project(fountainBehind('surface-o-combat07'));
    const node = batchNode(workspace, 'surface-o-combat07');
    expect(node.targets.map((target) => target.room.gameName)).toEqual(['O_Reprieve01']);

    const inherited = node.rewardPool?.inherited;
    if (inherited === undefined) throw new Error('the Fountain lost its inherited store');
    // A two-phase ship settles on wheel1, which this fixture rolled MetaProgress.
    expect(inherited.storeKey).toBe('MetaProgress');
    expect(inherited.label).toBe('Minor Reward');
    expect(inherited.wheel.address).toEqual(
      createRewardWheelAddress(oBiome, occurrence('surface-o-combat07'), 'wheel1'),
    );

    // The link is navigable: the wheel marker resolves to the ship's own workbench.
    const destination = workspace.focusByOwner.get(inherited.wheel.focusKey);
    expect(destination).toBeDefined();
    const ship = workspace.route.biomes
      .find((biome) => biome.biomeKey === destination?.biomeKey)
      ?.nodes.find((candidate) => candidate.key === destination?.nodeKey);
    if (ship?.kind !== 'occurrenceWorkbench') throw new Error('the wheel link is not a ship');
    expect(ship.room.occurrenceId).toBe(occurrence('surface-o-combat07'));

    expect(node.rewardStore).toBeUndefined();
    expect(storeSelector(workspace, 'surface-o-combat07')).toBeUndefined();
    // The Fountain banks the inherited pool.
    expect(node.rewardPool?.effective).toBeUndefined();
  });

  it('follows the third wheel when the ship runs three encounters', () => {
    const workspace = project(fountainBehind('surface-o-combat07', { encounterCount: 3 }));
    const inherited = batchNode(workspace, 'surface-o-combat07').rewardPool?.inherited;
    if (inherited === undefined) throw new Error('the Fountain lost its inherited store');
    expect(inherited.wheel.address).toEqual(
      createRewardWheelAddress(oBiome, occurrence('surface-o-combat07'), 'wheel2'),
    );
    expect(inherited.storeKey).toBe('RunProgress');
  });

  it('states the batch pool before any room is picked, on both kinds of source', () => {
    const shipNode = batchNode(project(emptyBatchAt('surface-o-combat07')), 'surface-o-combat07');
    expect(shipNode.targets).toEqual([]);
    expect(shipNode.rewardPool).toEqual({
      inherited: expect.objectContaining({ storeKey: 'MetaProgress' }),
    });
    expect(shipNode.rewardStore).toBeUndefined();

    const ordinaryWorkspace = project(emptyBatchAt('surface-o-devotion'));
    const ordinaryNode = batchNode(ordinaryWorkspace, 'surface-o-devotion');
    expect(ordinaryNode.targets).toEqual([]);
    expect(ordinaryNode.rewardStore).toBeDefined();
    expect(storeSelector(ordinaryWorkspace, 'surface-o-devotion')).toBeDefined();
    expect(ordinaryNode.rewardPool).toEqual({});
  });

  it('keeps the ordinary selector on a Fountain behind a non-ship source', () => {
    const workspace = project(
      fountainBehind('surface-o-devotion', { baseStoreKey: 'RunProgress' }),
    );
    const node = batchNode(workspace, 'surface-o-devotion');
    expect(node.targets.map((target) => target.room.gameName)).toEqual(['O_Reprieve01']);
    expect(node.rewardPool?.inherited).toBeUndefined();
    expect(node.rewardStore).toBeDefined();
    expect(node.rewardPool?.effective).toBeUndefined();
    expect(storeSelector(workspace, 'surface-o-devotion')?.selected).toBe('RunProgress');
  });
});
