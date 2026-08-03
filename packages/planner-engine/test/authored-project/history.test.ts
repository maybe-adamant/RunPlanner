import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectHistoryCommand,
  canRedoProjectHistory,
  canUndoProjectHistory,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectHistory,
  redoProjectHistory,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';

import { createCompleteNProject } from './support/complete-n-project';
import { fProject, nBiome } from './support/configured-projects';

describe('authored project history', () => {
  it('records effective semantic edits, preserves no-op identity, and restores exact snapshots', () => {
    const initial = createProjectHistory(fProject());
    const renamed = applyProjectHistoryCommand(initial, catalog, {
      kind: 'RenameProject',
      name: 'Renamed project',
    });

    expect(renamed.past).toEqual([initial.present]);
    expect(renamed.future).toEqual([]);
    expect(canUndoProjectHistory(renamed)).toBe(true);
    expect(canRedoProjectHistory(renamed)).toBe(false);
    expect(
      applyProjectHistoryCommand(renamed, catalog, {
        kind: 'RenameProject',
        name: 'Renamed project',
      }),
    ).toBe(renamed);

    const undone = undoProjectHistory(renamed);
    expect(undone.present).toBe(initial.present);
    expect(canRedoProjectHistory(undone)).toBe(true);
    expect(redoProjectHistory(undone).present).toBe(renamed.present);
  });

  it('clears redo after a new edit and preserves identity at history boundaries', () => {
    const initial = createProjectHistory(fProject());
    const renamed = applyProjectHistoryCommand(initial, catalog, {
      kind: 'RenameProject',
      name: 'First name',
    });
    const undone = undoProjectHistory(renamed);
    const replacement = applyProjectHistoryCommand(undone, catalog, {
      kind: 'RenameProject',
      name: 'Replacement name',
    });

    expect(replacement.future).toEqual([]);
    expect(canRedoProjectHistory(replacement)).toBe(false);
    expect(undoProjectHistory(initial)).toBe(initial);
    expect(redoProjectHistory(initial)).toBe(initial);
  });

  it('records a room-leaf edit as one atomic undoable snapshot', () => {
    const initial = createProjectHistory(createCompleteNProject());
    const ordered = applyProjectHistoryCommand(initial, catalog, {
      kind: 'ReplaceShopPurchaseOrder',
      shop: createOccurrenceAddress(nBiome, createOccurrenceId('round-trip-n-preboss')),
      offerKeys: ['Minor', 'MajorNonBoon'],
    });

    expect(ordered.past).toEqual([initial.present]);
    const undone = undoProjectHistory(ordered);
    expect(undone.present).toBe(initial.present);
    expect(redoProjectHistory(undone).present).toBe(ordered.present);
  });
});
