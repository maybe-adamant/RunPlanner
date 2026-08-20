import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectHistoryCommand,
  canRedoProjectHistory,
  canUndoProjectHistory,
  createHubDecisionAddress,
  createRouteAddress,
  createOccurrenceId,
  createProjectHistory,
  createShopOfferAddress,
  redoProjectHistory,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';

import { createCompleteNProject } from './support/complete-n-project';
import { fProject, nBiome } from './support/configured-projects';

describe('authored project history', () => {
  it('records effective semantic edits, preserves no-op identity, and restores exact snapshots', () => {
    const initial = createProjectHistory(fProject());
    const route = createRouteAddress('Underworld');
    const grown = applyProjectHistoryCommand(initial, catalog, {
      kind: 'ConfigureRoutePrefix',
      route,
      configuredBiomeCount: 2,
    });

    expect(grown.past).toEqual([initial.present]);
    expect(grown.future).toEqual([]);
    expect(canUndoProjectHistory(grown)).toBe(true);
    expect(canRedoProjectHistory(grown)).toBe(false);
    expect(
      applyProjectHistoryCommand(grown, catalog, {
        kind: 'ConfigureRoutePrefix',
        route,
        configuredBiomeCount: 2,
      }),
    ).toBe(grown);

    const undone = undoProjectHistory(grown);
    expect(undone.present).toBe(initial.present);
    expect(canRedoProjectHistory(undone)).toBe(true);
    expect(redoProjectHistory(undone).present).toBe(grown.present);
  });

  it('clears redo after a new edit and preserves identity at history boundaries', () => {
    const initial = createProjectHistory(fProject());
    const route = createRouteAddress('Underworld');
    const grown = applyProjectHistoryCommand(initial, catalog, {
      kind: 'ConfigureRoutePrefix',
      route,
      configuredBiomeCount: 2,
    });
    const undone = undoProjectHistory(grown);
    const replacement = applyProjectHistoryCommand(undone, catalog, {
      kind: 'ConfigureRoutePrefix',
      route,
      configuredBiomeCount: 3,
    });

    expect(replacement.future).toEqual([]);
    expect(canRedoProjectHistory(replacement)).toBe(false);
    expect(undoProjectHistory(initial)).toBe(initial);
    expect(redoProjectHistory(initial)).toBe(initial);
  });

  it('records a room-leaf edit as one atomic undoable snapshot', () => {
    const initial = createProjectHistory(createCompleteNProject());
    const ordered = applyProjectHistoryCommand(initial, catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer: createShopOfferAddress(nBiome, createOccurrenceId('round-trip-n-preboss'), 'Minor'),
      purchased: true,
    });

    expect(ordered.past).toEqual([initial.present]);
    const undone = undoProjectHistory(ordered);
    expect(undone.present).toBe(initial.present);
    expect(redoProjectHistory(undone).present).toBe(ordered.present);
  });

  it('records one aggregate Hub order replacement as one undoable topology edit', () => {
    const initial = createProjectHistory(createCompleteNProject());
    const ordered = applyProjectHistoryCommand(initial, catalog, {
      kind: 'ReplaceHubVisitOrder',
      hub: createHubDecisionAddress(nBiome, 'hub'),
      hubSlotKeys: ['combat06', 'combat05', 'combat04', 'combat03', 'combat02', 'combat01'],
    });

    expect(ordered.past).toEqual([initial.present]);
    expect(undoProjectHistory(ordered).present).toBe(initial.present);
    expect(redoProjectHistory(undoProjectHistory(ordered)).present).toBe(ordered.present);
  });
});
