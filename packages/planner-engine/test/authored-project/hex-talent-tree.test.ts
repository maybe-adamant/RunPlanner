import { catalog } from '@run-planner/hades2-catalog';
import type { HexDeclaration, HexLayoutKey } from '@run-planner/engine/catalog-schema';
import { describe, expect, it } from 'vitest';

import {
  completeHexTalentTree,
  hexNodeTalentDomain,
  hexRepeatableCycles,
  validateHexTalentTree,
  type HexTalentTree,
} from '../../src/authored-project/traits/hex-talent-tree';

const LAYOUTS: readonly HexLayoutKey[] = ['Lung', 'Pyramid', 'Maze', 'Nacelle'];
const NO_FINDINGS = { nodes: [], tree: [] };

const CD = 'CooldownDamageTalent';
const GROWTH = 'ChargeRegenTalent';
const PREP = 'PreChargeTalent';
const HUMILITY = 'PolymorphDurationTalent';
const EXPOSURE = 'PolymorphDamageTalent';
const VASTNESS = 'MeteorSizeTalent';
const MAGNITUDE = 'MeteorDamageTalent';

function hex(spellTraitKey: string): HexDeclaration {
  const declaration = catalog.hexes.byKey[spellTraitKey];
  if (declaration === undefined) throw new Error(`missing Hex ${spellTraitKey}`);
  return declaration;
}

function complete(
  declaration: HexDeclaration,
  layoutKey: HexLayoutKey,
  pins: Record<string, string> = {},
): HexTalentTree {
  const result = completeHexTalentTree(declaration, layoutKey, pins);
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.tree;
}

function pinAll(nodeKeys: readonly string[], talentKey: string): Record<string, string> {
  return Object.fromEntries(nodeKeys.map((key) => [key, talentKey]));
}

const polymorph = hex('SpellPolymorphTrait');
const meteor = hex('SpellMeteorTrait');

describe('Hex repeatable draw cycles', () => {
  it('refills with talents below MaxCount; only the last cycle is partial', () => {
    const unbounded = { talentKeys: [CD, HUMILITY, EXPOSURE], draws: 3 };
    expect(hexRepeatableCycles(polymorph, 'Lung')).toEqual([
      { talentKeys: [CD, GROWTH, HUMILITY, EXPOSURE], draws: 4 },
      unbounded,
      unbounded,
      unbounded,
    ]);
    expect(hexRepeatableCycles(polymorph, 'Pyramid').at(-1)).toEqual({ ...unbounded, draws: 1 });
    expect(hexRepeatableCycles(meteor, 'Lung')).toEqual([
      { talentKeys: [CD, PREP, VASTNESS, MAGNITUDE], draws: 4 },
      { talentKeys: [CD, PREP, VASTNESS, MAGNITUDE], draws: 4 },
      { talentKeys: [CD, VASTNESS, MAGNITUDE], draws: 3 },
      { talentKeys: [CD, VASTNESS, MAGNITUDE], draws: 2 },
    ]);
  });
});

describe('Hex node talent domain', () => {
  it('limits repeatable nodes to the talents their depth can draw', () => {
    expect(hexNodeTalentDomain(polymorph, 'Lung', '1:4')).toEqual([CD, GROWTH, HUMILITY, EXPOSURE]);
    expect(hexNodeTalentDomain(polymorph, 'Lung', '3:6')).toEqual([CD, HUMILITY, EXPOSURE]);
    expect(hexNodeTalentDomain(polymorph, 'Pyramid', '1:5')).toEqual([
      CD,
      GROWTH,
      HUMILITY,
      EXPOSURE,
    ]);
    expect(hexNodeTalentDomain(polymorph, 'Pyramid', '2:1')).toEqual([CD, HUMILITY, EXPOSURE]);
    expect(hexNodeTalentDomain(meteor, 'Lung', '3:4')).toEqual([CD, PREP, VASTNESS, MAGNITUDE]);
    expect(hexNodeTalentDomain(meteor, 'Lung', '5:2')).toEqual([CD, VASTNESS, MAGNITUDE]);
  });

  it('gives unique and Olympian nodes their whole pool regardless of other nodes', () => {
    expect(hexNodeTalentDomain(polymorph, 'Lung', '4:5')).toEqual(
      polymorph.rareCandidates.values.map((candidate) => candidate.key),
    );
    expect(hexNodeTalentDomain(polymorph, 'Lung', '6:3')).toEqual([
      'PolymorphSandwichTalent',
      'PolymorphCurseTalent',
    ]);
    expect(hexNodeTalentDomain(polymorph, 'Lung', '5:3')).toEqual(['PolymorphZeusTalent']);
  });
});

describe('Hex talent tree legality', () => {
  it('reports a talent its depth cannot draw on the node itself', () => {
    const tree = { ...complete(polymorph, 'Lung'), '1:4': CD, '3:6': GROWTH };
    expect(validateHexTalentTree(polymorph, 'Lung', tree)).toEqual({
      nodes: [{ kind: 'talentNotAtDepth', nodeKey: '3:6', talentKey: GROWTH }],
      tree: [],
    });
  });

  it('rejects a depth whose talents no draw sequence produces', () => {
    const tree = {
      ...complete(polymorph, 'Pyramid'),
      ...pinAll(['1:1', '1:2', '1:3', '1:4', '1:5'], EXPOSURE),
    };
    expect(validateHexTalentTree(polymorph, 'Pyramid', tree)).toEqual({
      nodes: [],
      tree: [
        {
          kind: 'repeatableSequence',
          depth: 1,
          nodeKeys: ['1:1', '1:2', '1:3', '1:4', '1:5'],
        },
      ],
    });
  });

  it('tracks a refill cycle that straddles depths', () => {
    // Meteor Lung depth 3 draws a whole cycle plus two of the next; 4:3 draws the third.
    const legal = complete(meteor, 'Lung');
    expect(legal['4:3']).toBe(MAGNITUDE);
    expect(validateHexTalentTree(meteor, 'Lung', legal)).toEqual(NO_FINDINGS);
    expect(validateHexTalentTree(meteor, 'Lung', { ...legal, '4:3': CD })).toEqual({
      nodes: [],
      tree: [{ kind: 'repeatableSequence', depth: 4, nodeKeys: ['4:3'] }],
    });
    expect(validateHexTalentTree(meteor, 'Lung', { ...legal, '3:3': PREP })).toEqual({
      nodes: [],
      tree: [
        {
          kind: 'repeatableSequence',
          depth: 3,
          nodeKeys: ['3:1', '3:2', '3:3', '3:4', '3:5', '3:6'],
        },
      ],
    });
  });

  it('reports repeated unique talents and missing nodes', () => {
    const tree = { ...complete(polymorph, 'Lung'), '4:5': 'PolymorphBossDamageTalent' };
    expect(validateHexTalentTree(polymorph, 'Lung', tree)).toEqual({
      nodes: [],
      tree: [
        {
          kind: 'repeatedTalent',
          talentKey: 'PolymorphBossDamageTalent',
          nodeKeys: ['4:1', '4:5'],
        },
      ],
    });
    const missing = Object.fromEntries(
      Object.entries(complete(polymorph, 'Lung')).filter(([key]) => key !== '6:3'),
    );
    expect(validateHexTalentTree(polymorph, 'Lung', missing)).toEqual({
      nodes: [{ kind: 'missingNode', nodeKey: '6:3' }],
      tree: [],
    });
  });
});

describe('Hex talent tree completion', () => {
  it('fills an unpinned tree from declared candidates and the source draw order', () => {
    expect(complete(polymorph, 'Lung')).toEqual({
      '1:2': CD,
      '1:4': GROWTH,
      '2:2': HUMILITY,
      '2:4': EXPOSURE,
      '3:1': CD,
      '3:2': HUMILITY,
      '3:3': EXPOSURE,
      '3:4': CD,
      '3:5': HUMILITY,
      '3:6': EXPOSURE,
      '4:1': 'PolymorphBossDamageTalent',
      '4:3': CD,
      '4:5': 'PolymorphDeathExplodeTalent',
      '5:2': HUMILITY,
      '5:3': 'PolymorphZeusTalent',
      '5:4': EXPOSURE,
      '6:1': 'OlympianSpellCountTalent',
      '6:3': 'PolymorphSandwichTalent',
    });
  });

  it('completes every spell and layout, alone and around any one locally valid pin', () => {
    for (const declaration of catalog.hexes.values)
      for (const layoutKey of LAYOUTS) {
        const layout = declaration.layouts.byKey[layoutKey]!;
        const tree = complete(declaration, layoutKey);
        expect(Object.keys(tree)).toEqual(layout.nodes.values.map((node) => node.key));
        expect(validateHexTalentTree(declaration, layoutKey, tree)).toEqual(NO_FINDINGS);
        for (const node of layout.nodes.values)
          for (const talentKey of hexNodeTalentDomain(declaration, layoutKey, node.key)) {
            const pinned = complete(declaration, layoutKey, { [node.key]: talentKey });
            expect(pinned[node.key]).toBe(talentKey);
            expect(validateHexTalentTree(declaration, layoutKey, pinned)).toEqual(NO_FINDINGS);
          }
      }
  });

  it('keeps pins, is deterministic, and leaves other nodes alone when a default is pinned', () => {
    const unpinned = complete(polymorph, 'Lung');
    const pinned = complete(polymorph, 'Lung', { '4:5': 'PolymorphBossDamageTalent' });
    expect(pinned).toEqual(complete(polymorph, 'Lung', { '4:5': 'PolymorphBossDamageTalent' }));
    expect(pinned['4:1']).toBe('PolymorphDeathExplodeTalent');
    expect(
      complete(polymorph, 'Lung', { '3:3': unpinned['3:3']!, '4:1': unpinned['4:1']! }),
    ).toEqual(unpinned);
  });

  it('chooses each depth draw so later pins still fit', () => {
    const tree = complete(meteor, 'Lung', { '4:3': CD });
    expect(tree['4:3']).toBe(CD);
    expect(
      ['3:1', '3:2', '3:3', '3:4', '3:5', '3:6'].map((key) => tree[key]).filter((k) => k === CD),
    ).toHaveLength(1);
    expect(validateHexTalentTree(meteor, 'Lung', tree)).toEqual(NO_FINDINGS);

    const growthLate = complete(polymorph, 'Lung', { '2:4': GROWTH });
    expect([growthLate['1:2'], growthLate['1:4'], growthLate['2:2']]).not.toContain(GROWTH);
    expect(validateHexTalentTree(polymorph, 'Lung', growthLate)).toEqual(NO_FINDINGS);
  });

  it('reports pins that no source tree can keep', () => {
    expect(
      completeHexTalentTree(polymorph, 'Lung', {
        '9:9': 'PolymorphTauntTalent',
        '3:1': 'PolymorphCurseTalent',
        '5:2': GROWTH,
        '5:3': 'OlympianSpellCountTalent',
      }),
    ).toEqual({
      ok: false,
      nodes: [
        { kind: 'unknownNode', nodeKey: '9:9' },
        { kind: 'talentNotInPool', nodeKey: '3:1', talentKey: 'PolymorphCurseTalent' },
        { kind: 'talentNotAtDepth', nodeKey: '5:2', talentKey: GROWTH },
        { kind: 'talentNotInPool', nodeKey: '5:3', talentKey: 'OlympianSpellCountTalent' },
      ],
      tree: [],
    });
    expect(
      completeHexTalentTree(polymorph, 'Lung', {
        '4:1': 'PolymorphTauntTalent',
        '4:5': 'PolymorphTauntTalent',
        '1:2': GROWTH,
        '2:2': GROWTH,
      }),
    ).toEqual({
      ok: false,
      nodes: [],
      tree: [
        { kind: 'repeatedTalent', talentKey: 'PolymorphTauntTalent', nodeKeys: ['4:1', '4:5'] },
        { kind: 'repeatableSequence', depth: 2, nodeKeys: ['1:2', '2:2'] },
      ],
    });
    expect(
      completeHexTalentTree(
        polymorph,
        'Pyramid',
        pinAll(['1:1', '1:2', '1:3', '1:4', '1:5'], EXPOSURE),
      ),
    ).toMatchObject({
      ok: false,
      tree: [{ kind: 'repeatableSequence', depth: 1 }],
    });
  });
});
