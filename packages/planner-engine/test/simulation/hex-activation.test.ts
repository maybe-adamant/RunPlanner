import { catalog } from '@run-planner/hades2-catalog';
import type { HexLayoutKey } from '@run-planner/engine/catalog-schema';
import { describe, expect, it } from 'vitest';

import {
  availableHexNodes,
  createHexActivationCandidateCapability,
  validateHexActivation,
  type HexActivationContext,
} from '../../src/simulation/hex-activation';

function context(
  layoutKey: HexLayoutKey,
  investedNodeKeys: readonly string[] = [],
  godSentAdded = false,
  count = 1,
): HexActivationContext {
  const layout = catalog.hexes.byKey.SpellPolymorphTrait!.layouts.byKey[layoutKey]!;
  const tree = { layoutKey, nodes: {} };
  return {
    spellTraitKey: 'SpellPolymorphTrait',
    tree,
    layout,
    godSentAdded,
    investedNodeKeys,
    count,
  };
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
    expect(validateHexActivation({ ...invested, count: 1 }, ['2:4'])).toEqual([]);
    expect(validateHexActivation({ ...context('Nacelle'), count: 1 }, ['2:4'])).toEqual([
      { kind: 'unreachable', nodeKey: '2:4' },
    ]);
  });

  it('includes the God Sent pair only once inserted', () => {
    const invested = ['1:2', '2:2', '3:2', '4:3'];
    expect(availableHexNodes(context('Lung', invested), [])).not.toContain('5:3');
    expect(availableHexNodes(context('Lung', invested, true), [])).toContain('5:3');
    expect(validateHexActivation({ ...context('Lung', invested), count: 1 }, ['5:3'])).toEqual([
      { kind: 'absentNode', nodeKey: '5:3' },
    ]);
    expect(
      validateHexActivation({ ...context('Lung', invested, true), count: 2 }, ['5:3', '6:1']),
    ).toEqual([]);
  });
});

describe('Hex activation legality', () => {
  it('accepts reachable selections in any order', () => {
    expect(validateHexActivation({ ...context('Lung'), count: 3 }, ['3:1', '2:2', '1:2'])).toEqual(
      [],
    );
    expect(
      validateHexActivation({ ...context('Nacelle'), count: 4 }, ['3:3', '2:4', '2:2', '1:2']),
    ).toEqual([]);
  });

  it('reports count, reach and invested violations', () => {
    expect(
      validateHexActivation({ ...context('Lung', ['1:2']), count: 3 }, [
        '1:2',
        '3:5',
        '1:4',
        '9:9',
      ]),
    ).toEqual([
      { kind: 'selectionCount', expected: 3, actual: 4 },
      { kind: 'alreadyInvested', nodeKey: '1:2' },
      { kind: 'unknownNode', nodeKey: '9:9' },
      { kind: 'unreachable', nodeKey: '3:5' },
    ]);
  });

  it('treats an invested node outside the tree as a contract error', () => {
    expect(() => availableHexNodes(context('Lung', ['5:3']), [])).toThrow(/not in the tree/);
  });
});

describe('Hex activation candidate capability', () => {
  it('draws the board from the first branch and reports every branch a selection does not fit', () => {
    const capability = createHexActivationCandidateCapability([
      context('Lung', [], false, 2),
      context('Lung', ['1:2'], false, 2),
    ])!;
    expect(capability).toMatchObject({ count: 2, investedNodeKeys: [] });
    expect(capability.availableNodeKeys(['1:2'])).toEqual(['1:4', '2:2']);
    expect(capability.assess(['1:2', '1:4'])).toEqual([
      { kind: 'alreadyInvested', nodeKey: '1:2' },
    ]);
    expect(createHexActivationCandidateCapability([])).toBeUndefined();
  });

  it('offers no additions once the selection spends the screen, keeping it removable', () => {
    const capability = createHexActivationCandidateCapability([context('Lung', [], false, 2)])!;
    expect(capability.availableNodeKeys(['1:2'])).toEqual(['1:4', '2:2']);
    expect(capability.availableNodeKeys(['1:2', '2:2'])).toEqual([]);
    // A saved selection over a shrunken budget is kept and reported, never trimmed.
    expect(capability.availableNodeKeys(['1:2', '2:2', '1:4'])).toEqual([]);
    expect(capability.assess(['1:2', '2:2', '1:4'])).toEqual([
      { kind: 'selectionCount', expected: 2, actual: 3 },
    ]);
  });
});
