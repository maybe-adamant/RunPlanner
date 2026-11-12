import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomFeatureAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { loadUnderworldFStygianWellCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  projectStructuredWorkspaceFixture,
  requireWorkspaceBiome,
} from '@planner-test/fixtures/structuredWorkspace';

const f = createBiomeAddress('Underworld', 'F');
const postbossId = createOccurrenceId('golden-f-preboss-shop:postboss');
const room = createOccurrenceAddress(f, postbossId);
type Projected = ReturnType<typeof projectStructuredWorkspaceFixture>;

function withArcana(project: ProjectDocument, arcanaKeys: readonly string[]): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: { kind: 'route', routeKey: project.route.routeKey },
    arcanaKeys,
  });
}

/** The F Boss Judgment draw; by default it holds the screen-reroll card. */
function withScreenRerolls(
  project: ProjectDocument,
  arcanaKeys: readonly string[] = [
    'ScreenReroll',
    'StartingGold',
    'HealthRegen',
    'BonusDodge',
    'TradeOff',
  ],
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceJudgmentArcana',
    judgment: {
      kind: 'judgmentArcana',
      routeKey: 'Underworld',
      biomeKey: 'F',
      occurrenceId: createOccurrenceId('golden-f-preboss-shop:boss'),
      phaseKey: 'Encounter',
    },
    arcanaKeys,
  });
}

function postboss(projected: Projected) {
  for (const node of requireWorkspaceBiome(projected.workspace, 'F').nodes)
    if (node.kind === 'occurrenceWorkbench' && node.room.address.occurrenceId === postbossId)
      return node;
  throw new Error('F has no projected Postboss');
}

function apply(project: ProjectDocument, command: Parameters<typeof applyProjectCommand>[2]) {
  return applyProjectCommand(project, catalog, command);
}

const order = (project: ProjectDocument) =>
  project.route.biomes[0]!.topology!.occurrences.find(
    (occurrence) => occurrence.occurrenceId === postbossId,
  )!.roomActions.order;

describe('Stygian Well rerolls', () => {
  const base = withScreenRerolls(
    withArcana(loadUnderworldFStygianWellCheckpoint(), ['DoorReroll']),
  );

  it('pins slots on the reroll row, and buys a rerolled slot with its item', () => {
    const rerolled = apply(base, {
      kind: 'InsertStygianWellReroll',
      occurrence: room,
      index: order(base).length,
    });
    const projected = projectStructuredWorkspaceFixture(rerolled);
    const node = postboss(projected);
    const purchase = {
      kind: 'SetStygianWellPurchase' as const,
      occurrence: room,
      generationKey: 'r1:healing' as const,
      purchased: true,
      itemKey: 'HealDropRange',
    };
    // The reroll's row pins what it restocks; an unpinned slot stays native.
    const row = node.room.roomActions!.rows.find(
      (candidate) => candidate.reference.kind === 'rerollStygianWell',
    )!;
    expect(row).toMatchObject({ label: 'Reroll Well', roll: 2 });
    expect(row.featureRoll?.slots.map((slot) => [slot.slotKey, slot.value])).toEqual([
      ['healing', null],
    ]);
    const slot = projected.workspace.interactions.featureRollSlots.get(
      row.featureRoll!.slots[0]!.interactionKey,
    )!;
    expect(slot.intentFor('HealDropRange').command).toEqual({
      kind: 'ReplaceStygianWellRollOffer',
      action: row.address,
      slotKey: 'healing',
      itemKey: 'HealDropRange',
    });
    const bought = projectStructuredWorkspaceFixture(apply(rerolled, purchase));
    const purchased = postboss(bought).room.roomActions!.rows.find(
      (candidate) =>
        candidate.reference.kind === 'purchaseStygianWellOffer' &&
        candidate.reference.generationKey === 'r1:healing',
    );
    expect(purchased?.label).toMatch(/^Buy .+$/);
    expect(purchased?.roll).toBe(2);
    expect(purchased?.purchaseRemoval?.command).toEqual({
      kind: 'SetStygianWellPurchase',
      occurrence: room,
      generationKey: 'r1:healing',
      purchased: false,
    });
  });

  it('routes a pin the roll does not restock to its slot on the reroll row', () => {
    const rerolled = apply(base, {
      kind: 'InsertStygianWellReroll',
      occurrence: room,
      index: order(base).length,
    });
    const row = postboss(projectStructuredWorkspaceFixture(rerolled)).room.roomActions!.rows.find(
      (candidate) => candidate.reference.kind === 'rerollStygianWell',
    )!;
    const pinned = apply(rerolled, {
      kind: 'ReplaceStygianWellRollOffer',
      action: row.address,
      slotKey: 'secondRight',
      itemKey: 'TemporaryBoonRarityTrait',
    });
    const projected = projectStructuredWorkspaceFixture(pinned);
    const owner = createRoomFeatureAddress(room, {
      kind: 'stygianWellOffer',
      generationKey: 'r1:secondRight',
    });
    expect(
      postboss(projected)
        .room.roomActions!.rows.find((candidate) => candidate.key === row.key)
        ?.featureRoll?.slots.map((slot) => slot.slotKey),
    ).toEqual(['healing', 'secondRight']);
    expect(projected.workspace.focusByOwner.get(semanticAddressKey(owner))).toMatchObject({
      roomTab: 'actions',
      markAddress: owner,
    });
    expect(projected.workspace.findingsByRepairTarget.get(semanticAddressKey(owner))).toEqual([
      expect.objectContaining({ code: 'rollOfferUnavailable' }),
    ]);
  });
});
