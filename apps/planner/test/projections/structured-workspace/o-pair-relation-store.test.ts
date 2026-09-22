import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
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
      expect(node.inheritedRewardStore?.storeKey).toBeDefined();
      // Read-only throughout: the wheel owns the choice, not the door.
      expect(node.rewardStore).toBeUndefined();
      expect(storeSelector(workspace, source)).toBeUndefined();
    }
  });

  it('reports what becomes of the pool at each door', () => {
    const workspace = project(loadSurfaceNOProject());
    const outcomeAt = (source: string) => batchNode(workspace, source).effectiveRewardStore;

    // A ship combat declares no incoming reward at all, so no store survives.
    expect(outcomeAt('surface-o-combat04')).toEqual({ label: 'Discarded by this room' });

    // Devotion forces RunProgress. This ship rolled RunProgress too, so the
    // forced store changes nothing and the line says so rather than "flipped".
    expect(batchNode(workspace, 'surface-o-combat01').inheritedRewardStore?.storeKey).toBe(
      'RunProgress',
    );
    expect(catalog.rooms.byKey.O_Devotion01?.forcedRewardStoreKey).toBe('RunProgress');
    expect(outcomeAt('surface-o-combat01')).toEqual({
      label: 'Major Reward',
      storeKey: 'RunProgress',
    });

    // Story carries the pool through to a declaration-fixed reward type.
    expect(storeSelector(workspace, 'surface-o-devotion')?.selected).toBe('MetaProgress');
    expect(outcomeAt('surface-o-devotion')).toEqual({
      label: 'Minor Reward',
      storeKey: 'MetaProgress',
    });

    // A shop fixes only its visible reward: the door still stamps the carried
    // store on its entry, so the pool reaches the run ledger.
    expect(catalog.rooms.byKey.O_PreBoss01?.enteredRewardStoreHistory.kind).toBe('resolvedOffer');
    expect(outcomeAt('surface-o-combat02')).toEqual({ label: 'Counted by this room' });
  });

  it('reports the forced store when a target overrides the carried value', () => {
    // The same Devotion door with the ship rolled the other way: the forced
    // store now genuinely replaces what the decision carried.
    const flipped = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel: createRewardWheelAddress(oBiome, occurrence('surface-o-combat01'), 'wheel1'),
      storeKey: 'MetaProgress',
    });
    const workspace = project(flipped);
    const node = batchNode(workspace, 'surface-o-combat01');
    expect(node.inheritedRewardStore?.storeKey).toBe('MetaProgress');
    // The forced store replaces what the decision carried: one row, the same
    // product a forced room already produced on an evaluated batch.
    expect(node.effectiveRewardStore).toEqual({ label: 'Major Reward', storeKey: 'RunProgress' });
  });

  it('reports the ship-decided store on a Fountain and links to the deciding wheel', () => {
    const workspace = project(fountainBehind('surface-o-combat07'));
    const node = batchNode(workspace, 'surface-o-combat07');
    expect(node.targets.map((target) => target.room.gameName)).toEqual(['O_Reprieve01']);

    const inherited = node.inheritedRewardStore;
    if (inherited === undefined) throw new Error('the Fountain lost its inherited store row');
    // A two-phase ship settles on wheel1, which this fixture rolled MetaProgress.
    expect(inherited.storeKey).toBe('MetaProgress');
    expect(inherited.label).toBe('Minor Reward');
    expect(inherited.explanation.length).toBeGreaterThan(0);
    expect(inherited.wheel.address).toEqual(
      createRewardWheelAddress(oBiome, occurrence('surface-o-combat07'), 'wheel1'),
    );

    // The link is navigable: the wheel marker resolves to a real node, the ship
    // occurrence's own workbench.
    const destination = workspace.focusByOwner.get(inherited.wheel.focusKey);
    expect(destination).toBeDefined();
    const node_ = workspace.route.biomes
      .find((biome) => biome.biomeKey === destination?.biomeKey)
      ?.nodes.find((candidate) => candidate.key === destination?.nodeKey);
    expect(node_?.kind).toBe('occurrenceWorkbench');
    if (node_?.kind !== 'occurrenceWorkbench') throw new Error('unreachable');
    expect(node_.room.occurrenceId).toBe(occurrence('surface-o-combat07'));

    // It stays read-only: no selector is published where the wheel decides.
    expect(node.rewardStore).toBeUndefined();
    expect(storeSelector(workspace, 'surface-o-combat07')).toBeUndefined();

    // The Fountain is the room that actually draws from the pool.
    expect(node.effectiveRewardStore).toEqual({ label: 'Banked by this room' });
  });

  it('follows the third wheel when the ship runs three encounters', () => {
    const workspace = project(fountainBehind('surface-o-combat07', { encounterCount: 3 }));
    const inherited = batchNode(workspace, 'surface-o-combat07').inheritedRewardStore;
    if (inherited === undefined) throw new Error('the Fountain lost its inherited store row');
    // The last active wheel owns the store, so a third encounter moves both the
    // reported key and the link to wheel2.
    expect(inherited.wheel.address).toEqual(
      createRewardWheelAddress(oBiome, occurrence('surface-o-combat07'), 'wheel2'),
    );
    expect(inherited.storeKey).toBe('RunProgress');
  });

  it('keeps the ordinary selector on a Fountain behind a non-ship source', () => {
    const workspace = project(
      fountainBehind('surface-o-devotion', { baseStoreKey: 'RunProgress' }),
    );
    const node = batchNode(workspace, 'surface-o-devotion');
    expect(node.targets.map((target) => target.room.gameName)).toEqual(['O_Reprieve01']);
    // The same Fountain, reached from a non-ship source, keeps the authored
    // store: a selector rather than a read-only row.
    expect(node.inheritedRewardStore).toBeUndefined();
    expect(node.rewardStore).toBeDefined();
    // The authored value and the outcome row coexist on the same door.
    expect(node.effectiveRewardStore).toEqual({ label: 'Banked by this room' });
    expect(storeSelector(workspace, 'surface-o-devotion')?.selected).toBe('RunProgress');
  });
});
