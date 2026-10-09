import { catalog } from '@run-planner/hades2-catalog';
import type { HexLayoutKey } from '@run-planner/engine/catalog-schema';
import { describe, expect, it } from 'vitest';

import {
  availableHexNodes,
  completeHexActivation,
  hexActivationPinDomain,
  validateHexActivation,
  type HexActivationContext,
} from '../../src/simulation/hex-activation';

function context(
  layoutKey: HexLayoutKey,
  investedNodeKeys: readonly string[] = [],
  godSentAdded = false,
): HexActivationContext {
  const layout = catalog.hexes.byKey.SpellPolymorphTrait!.layouts.byKey[layoutKey]!;
  return { layout, godSentAdded, investedNodeKeys };
}

describe('Hex node availability', () => {
  it('starts from the roots and follows links from invested or selected nodes', () => {
    expect(availableHexNodes(context('Lung'), [])).toEqual(['1:2', '1:4']);
    expect(availableHexNodes(context('Lung', ['1:2']), ['2:2'])).toEqual([
      '1:4',
      '3:1',
      '3:2',
      '3:3',
    ]);
  });

  it('opens a bidirectional Nacelle node from an invested next-depth neighbour', () => {
    const invested = context('Nacelle', ['1:2', '2:2', '3:3']);
    expect(availableHexNodes(invested, [])).toContain('2:4');
    expect(validateHexActivation(invested, ['2:4'], 1)).toEqual([]);
    expect(validateHexActivation(context('Nacelle'), ['2:4'], 1)).toEqual([
      { kind: 'unreachable', nodeKey: '2:4' },
    ]);
  });

  it('includes the God Sent pair only once inserted', () => {
    const invested = ['1:2', '2:2', '3:2', '4:3'];
    expect(availableHexNodes(context('Lung', invested), [])).not.toContain('5:3');
    expect(availableHexNodes(context('Lung', invested, true), [])).toContain('5:3');
    expect(validateHexActivation(context('Lung', invested), ['5:3'], 1)).toEqual([
      { kind: 'absentNode', nodeKey: '5:3' },
    ]);
    expect(validateHexActivation(context('Lung', invested, true), ['5:3', '6:1'], 2)).toEqual([]);
  });
});

describe('Hex activation legality', () => {
  it('accepts reachable selections in any order', () => {
    expect(validateHexActivation(context('Lung'), ['3:1', '2:2', '1:2'], 3)).toEqual([]);
    expect(validateHexActivation(context('Nacelle'), ['3:3', '2:4', '2:2', '1:2'], 4)).toEqual([]);
  });

  it('reports count, reach, invested and duplicate violations', () => {
    expect(
      validateHexActivation(context('Lung', ['1:2']), ['1:2', '3:5', '1:4', '1:4', '9:9'], 3),
    ).toEqual([
      { kind: 'selectionCount', expected: 3, actual: 5 },
      { kind: 'alreadyInvested', nodeKey: '1:2' },
      { kind: 'duplicateSelection', nodeKey: '1:4' },
      { kind: 'unknownNode', nodeKey: '9:9' },
      { kind: 'unreachable', nodeKey: '3:5' },
    ]);
  });

  it('treats an invested node outside the tree as a contract error', () => {
    expect(() => availableHexNodes(context('Lung', ['5:3']), [])).toThrow(/not in the tree/);
  });
});

describe('Hex activation completion', () => {
  it('fills breadth-first by depth then slot', () => {
    expect(completeHexActivation(context('Lung'), [], 3)).toEqual({
      ok: true,
      selection: ['1:2', '1:4', '2:2'],
    });
    expect(completeHexActivation(context('Lung', ['1:2', '1:4', '2:2']), [], 2)).toEqual({
      ok: true,
      selection: ['2:4', '3:1'],
    });
  });

  it('adds the fewest connectors a deep pin needs', () => {
    expect(completeHexActivation(context('Lung'), ['6:3'], 6)).toEqual({
      ok: true,
      selection: ['1:2', '2:2', '3:2', '4:3', '5:2', '6:3'],
    });
    expect(completeHexActivation(context('Lung'), ['6:3'], 7)).toEqual({
      ok: true,
      selection: ['1:2', '1:4', '2:2', '3:2', '4:3', '5:2', '6:3'],
    });
    expect(completeHexActivation(context('Lung'), ['6:3'], 5)).toEqual({
      ok: false,
      violations: [{ kind: 'pinsExceedSelections', count: 5 }],
    });
  });

  it('shares connectors across pins through bidirectional links', () => {
    expect(completeHexActivation(context('Nacelle'), ['3:3', '3:6'], 4)).toEqual({
      ok: true,
      selection: ['1:4', '2:4', '3:3', '3:6'],
    });
  });

  it('keeps pins and reports pins it cannot keep', () => {
    const result = completeHexActivation(context('Lung', ['1:2']), ['3:2'], 3);
    expect(result).toEqual({ ok: true, selection: ['1:4', '2:2', '3:2'] });
    expect(completeHexActivation(context('Lung', ['1:2']), ['1:2', '5:3'], 3)).toEqual({
      ok: false,
      violations: [
        { kind: 'alreadyInvested', nodeKey: '1:2' },
        { kind: 'absentNode', nodeKey: '5:3' },
      ],
    });
  });

  it('connects deep pins across branches within the budget', () => {
    expect(completeHexActivation(context('Pyramid'), ['6:3', '5:1', '5:5'], 12)).toEqual({
      ok: true,
      selection: [
        '1:1',
        '1:4',
        '2:1',
        '2:4',
        '3:2',
        '3:4',
        '4:2',
        '4:4',
        '5:1',
        '5:3',
        '5:5',
        '6:3',
      ],
    });
    const mazePins = ['7:2', '7:4', '5:1'];
    expect(completeHexActivation(context('Maze'), mazePins, 15)).toEqual({
      ok: true,
      selection: [
        '1:3',
        '2:2',
        '2:4',
        '3:2',
        '3:4',
        '4:1',
        '4:2',
        '4:4',
        '5:1',
        '5:2',
        '5:4',
        '6:2',
        '6:4',
        '7:2',
        '7:4',
      ],
    });
    expect(completeHexActivation(context('Maze'), mazePins, 14)).toEqual({
      ok: false,
      violations: [{ kind: 'pinsExceedSelections', count: 14 }],
    });
    const nacellePins = ['6:2', '6:4', '4:3'];
    expect(completeHexActivation(context('Nacelle'), nacellePins, 13)).toEqual({
      ok: true,
      selection: [
        '1:2',
        '2:2',
        '2:4',
        '3:0',
        '3:3',
        '3:5',
        '4:2',
        '4:3',
        '4:4',
        '5:2',
        '5:4',
        '6:2',
        '6:4',
      ],
    });
    expect(completeHexActivation(context('Nacelle'), nacellePins, 12)).toEqual({
      ok: false,
      violations: [{ kind: 'pinsExceedSelections', count: 12 }],
    });
  });

  it('offers each node that fits the budget on its own', () => {
    expect(hexActivationPinDomain(context('Lung'), [], 1)).toEqual(['1:2', '1:4']);
    expect(hexActivationPinDomain(context('Lung'), [], 2)).toEqual(['1:2', '1:4', '2:2', '2:4']);
    expect(hexActivationPinDomain(context('Lung', ['1:2', '2:2']), ['3:1'], 1)).toEqual([
      '1:4',
      '3:2',
      '3:3',
    ]);
    expect(hexActivationPinDomain(context('Nacelle', ['1:2', '2:2', '3:3']), [], 1)).toContain(
      '2:4',
    );
  });
});
