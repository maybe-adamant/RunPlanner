import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createExitSelectionAddress,
  createInfernalContractPedestalAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  semanticAddressKey,
  type BiomeAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { loadUnderworldZagreusContractCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { goldenFBiome, goldenGBiome } from '@run-planner/test-fixtures/underworld';
import { presentFinding } from '@planner/projections/evaluationProjection';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';

const shopId = createOccurrenceId('zagreus-contract-preboss-shop');
const peerId = createOccurrenceId('zagreus-contract-preboss-peer');
const shopPedestal = createInfernalContractPedestalAddress(goldenGBiome, shopId);
const peerPedestal = createInfernalContractPedestalAddress(goldenGBiome, peerId);

function pedestalEntry(biome: BiomeAddress, occurrenceId: OccurrenceId) {
  return createAcquisitionEntryAddress(
    createAcquisitionSiteAddress(
      createOccurrenceAddress(biome, occurrenceId),
      'infernalContractPedestal',
    ),
    'infernalContractReward',
  );
}

/** The checkpoint with its boon-form Preboss door entered instead of the Shop form. */
function boonForm(): ProjectDocument {
  return applyProjectCommand(loadUnderworldZagreusContractCheckpoint(), catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenGBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('zagreus-contract-return'),
    }),
    value: { kind: 'normal', exitKey: 'exit2' },
  });
}

function room(projected: ReturnType<typeof projectStructuredWorkspaceFixture>, id: OccurrenceId) {
  const node = projected.workspace.route.biomes
    .flatMap((biome) => biome.nodes)
    .find(
      (candidate) => candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === id,
    );
  if (node?.kind !== 'occurrenceWorkbench') throw new Error(`missing occurrence ${id}`);
  return node.room;
}

function pedestalFeature(summary: ReturnType<typeof room>) {
  return summary.workbench.features.find((feature) => feature.kind === 'infernalContractPedestal');
}

function collectRow(summary: ReturnType<typeof room>) {
  return summary.roomActions?.rows.find(
    (row) => row.reference.kind === 'interactInfernalContractPedestal',
  );
}

describe('Contract pedestal editor', () => {
  it('edits the boon-form pedestal item through its engine candidates and collects it', async () => {
    let project = boonForm();
    const missing = projectStructuredWorkspaceFixture(project);
    const finding = missing.evaluation.findings.find(
      (candidate) =>
        candidate.code === 'rewardMissing' &&
        semanticAddressKey(candidate.origin) === semanticAddressKey(peerPedestal),
    );
    expect(finding).toBeDefined();
    expect(presentFinding(finding!).title).toBe('Choose the Champion item');
    expect(missing.workspace.focusByOwner.get(semanticAddressKey(peerPedestal))).toMatchObject({
      roomTab: 'overview',
    });
    const feature = pedestalFeature(room(missing, peerId));
    if (feature?.kind !== 'infernalContractPedestal') throw new Error('pedestal missing');
    expect(feature.collect.collected).toBe(false);
    expect(feature.rewardControl.offer).toBeNull();

    const picker = missing.workspace.interactions.shopOffers.get(semanticAddressKey(peerPedestal));
    if (picker === undefined) throw new Error('pedestal item picker missing');
    const model = await picker.load();
    const items = model.sections.flatMap((section) => section.items);
    const doublePom = items.find(
      (item) => item.value?.optionKey === 'StackUpgradeBig' && item.state === 'possible',
    );
    if (doublePom?.value == null) throw new Error('Double Pom is not offered');
    const choose = picker.intentFor(doublePom.value);
    expect(choose.command).toEqual({
      kind: 'ReplaceInfernalContractPedestalOption',
      pedestal: peerPedestal,
      value: doublePom.value,
    });
    project = applyProjectCommand(project, catalog, choose.command);

    const chosen = projectStructuredWorkspaceFixture(project);
    const collect = chosen.workspace.interactions.infernalContractPedestalCollects.get(
      semanticAddressKey(peerPedestal),
    );
    if (collect === undefined) throw new Error('pedestal collect missing');
    expect(collect.collected).toBe(false);
    project = applyProjectCommand(project, catalog, collect.intentFor(true).command);

    const collected = projectStructuredWorkspaceFixture(project);
    expect(
      collected.evaluation.findings.filter(
        (candidate) =>
          semanticAddressKey(candidate.origin) === semanticAddressKey(peerPedestal) ||
          semanticAddressKey(candidate.origin) ===
            semanticAddressKey(pedestalEntry(goldenGBiome, peerId)),
      ),
    ).toEqual([]);
    const row = collectRow(room(collected, peerId));
    expect(row?.label).toBe('Collect Double Pom · Champion Item');
    expect(row?.participationOwnedByOverview).toBe(true);
  });

  it('edits the Shop-form pedestal beside, not inside, the Shop inventory', () => {
    const projected = projectStructuredWorkspaceFixture(loadUnderworldZagreusContractCheckpoint());
    const summary = room(projected, shopId);
    if (summary.roomLocal.kind !== 'shop') throw new Error('expected the Shop form');
    expect(summary.roomLocal.offers.map((offer) => offer.key)).not.toContain(
      'infernalContractReward',
    );
    const feature = pedestalFeature(summary);
    if (feature?.kind !== 'infernalContractPedestal') throw new Error('pedestal missing');
    expect(feature.rewardControl.offer).toEqual({ rewardType: 'StackUpgrade' });
    expect(feature.collect.collected).toBe(true);
    expect(collectRow(summary)?.label).toBe('Collect Pom · Champion Item');
    const collect = projected.workspace.interactions.infernalContractPedestalCollects.get(
      semanticAddressKey(shopPedestal),
    );
    expect(collect?.intentFor(false).command).toEqual({
      kind: 'SetInfernalContractPedestalCollected',
      pedestal: shopPedestal,
      collected: false,
    });
  });

  it('resolves a collected Mystery item on the Timeline', () => {
    let project = applyProjectCommand(loadUnderworldZagreusContractCheckpoint(), catalog, {
      kind: 'ReplaceInfernalContractPedestalOffer',
      pedestal: shopPedestal,
      value: { rewardType: 'BlindBoxLoot' },
    });
    const entry = pedestalEntry(goldenGBiome, shopId);
    const resolving = projectStructuredWorkspaceFixture(project);
    expect(resolving.evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'rewardMissing', origin: entry }),
    );
    expect(resolving.workspace.focusByOwner.get(semanticAddressKey(entry))).toMatchObject({
      roomTab: 'actions',
    });
    const row = collectRow(room(resolving, shopId));
    expect(row?.label).toBe('Collect Mystery Boon · Champion Item');
    expect(row?.rewardPayload?.showOffer).toBe(true);
    expect(row?.rewardPayload?.control.owner).toEqual({ kind: 'acquisitionEntry', address: entry });
    const source = resolving.workspace.interactions.rewards.get(semanticAddressKey(entry));
    if (source === undefined) throw new Error('Mystery source picker missing');
    project = applyProjectCommand(
      project,
      catalog,
      source.intentFor({
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
      }).command,
    );
    const resolved = projectStructuredWorkspaceFixture(project);
    expect(resolved.evaluation.findings).not.toContainEqual(
      expect.objectContaining({ origin: entry }),
    );
  });

  it('hides a dormant pedestal and keeps one collected without the Contract repairable', () => {
    const fPreboss = createOccurrenceId('golden-f-preboss-shop');
    const pedestal = createInfernalContractPedestalAddress(goldenFBiome, fPreboss);
    let project = applyProjectCommand(loadUnderworldZagreusContractCheckpoint(), catalog, {
      kind: 'ReplaceInfernalContractPedestalOffer',
      pedestal,
      value: { rewardType: 'StackUpgrade' },
    });
    const dormant = projectStructuredWorkspaceFixture(project);
    expect(pedestalFeature(room(dormant, fPreboss))).toBeUndefined();
    expect(dormant.workspace.interactions.shopOffers.has(semanticAddressKey(pedestal))).toBe(false);

    project = applyProjectCommand(project, catalog, {
      kind: 'SetInfernalContractPedestalCollected',
      pedestal,
      collected: true,
    });
    const stale = projectStructuredWorkspaceFixture(project);
    const entry = pedestalEntry(goldenFBiome, fPreboss);
    const finding = stale.evaluation.findings.find(
      (candidate) =>
        candidate.code === 'rewardSourceUnavailable' &&
        semanticAddressKey(candidate.origin) === semanticAddressKey(entry),
    );
    expect(finding).toBeDefined();
    expect(presentFinding(finding!).title).toBe('No Champion item without Champion of Elysium');
    const feature = pedestalFeature(room(stale, fPreboss));
    if (feature?.kind !== 'infernalContractPedestal') throw new Error('stale pedestal missing');
    expect(feature.collect.address).toEqual(entry);
    expect(stale.workspace.focusByOwner.get(semanticAddressKey(entry))).toMatchObject({
      roomTab: 'overview',
    });
    const collect = stale.workspace.interactions.infernalContractPedestalCollects.get(
      semanticAddressKey(pedestal),
    );
    if (collect === undefined) throw new Error('stale collect missing');
    project = applyProjectCommand(project, catalog, collect.intentFor(false).command);
    const repaired = projectStructuredWorkspaceFixture(project);
    expect(repaired.evaluation.findings).not.toContainEqual(
      expect.objectContaining({ origin: entry }),
    );
    expect(pedestalFeature(room(repaired, fPreboss))).toBeUndefined();
  });
});
