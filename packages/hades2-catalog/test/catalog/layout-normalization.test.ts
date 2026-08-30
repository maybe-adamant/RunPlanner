import { describe, expect, it } from 'vitest';

import { CatalogContractError, createCatalog } from '@run-planner/hades2-catalog';
import { declarations, type RawCatalogInput } from '@run-planner/hades2-catalog/test-support';

function input(): RawCatalogInput {
  return JSON.parse(JSON.stringify(declarations)) as RawCatalogInput;
}

describe('biome layout declaration normalization', () => {
  it('normalizes local start, progression, batch, Hub, completion, and store declarations', () => {
    const catalog = createCatalog(declarations);
    expect(catalog.biomeLayouts.byKey.F).toMatchObject({
      start: {
        kind: 'authoredChoice',
        roomGameNames: ['F_Opening01', 'F_Opening02', 'F_Opening03'],
      },
      progression: {
        kind: 'generated',
        progressionPolicy: { kind: 'eligibilityDriven' },
        batchPolicy: { kind: 'standard' },
      },
      completion: {
        bossRoomGameName: 'F_Boss01',
        transitionEffects: [
          { kind: 'resetCounter', axis: 'biomeDepthCache' },
          { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
        ],
      },
    });
    expect(catalog.biomeLayouts.byKey.F?.progression).not.toHaveProperty('bounds');
    expect(catalog.biomeLayouts.byKey.N).toMatchObject({
      progression: {
        kind: 'hub',
        entry: { bounds: { maxBatches: 1, maxTargets: 1 }, rewardStorePolicy: { kind: 'none' } },
        terminal: {
          roomGameName: 'N_Hub',
          eligibility: { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 2, max: 2 } },
        },
      },
    });
  });

  it('rejects structural bounds on eligibility-driven progression', () => {
    const bounded = input();
    const f = bounded.biomeLayouts.find((layout) => layout.biomeKey === 'F');
    if (f === undefined || f.progression.kind !== 'generated') {
      throw new Error('missing F generated fixture');
    }
    (f.progression as unknown as { bounds: unknown }).bounds = {
      maxBatches: 10,
      maxTargets: 20,
    };
    expect(() => createCatalog(bounded)).toThrow(CatalogContractError);
  });

  it('rejects Hub entry, terminal, and fixed-start declarations outside the local contract', () => {
    const widened = input();
    const n = widened.biomeLayouts.find((layout) => layout.biomeKey === 'N');
    if (n === undefined || n.progression.kind !== 'hub') throw new Error('missing N Hub fixture');
    (
      n.progression as unknown as { entry: { bounds: { maxTargets: number } } }
    ).entry.bounds.maxTargets = 2;
    expect(() => createCatalog(widened)).toThrow(CatalogContractError);

    const incorrectTerminal = input();
    const terminalLayout = incorrectTerminal.biomeLayouts.find((layout) => layout.biomeKey === 'N');
    if (terminalLayout === undefined || terminalLayout.progression.kind !== 'hub') {
      throw new Error('missing N Hub fixture');
    }
    (
      terminalLayout.progression as unknown as {
        terminal: { eligibility: unknown };
      }
    ).terminal.eligibility = {
      kind: 'counterRange',
      axis: 'biomeDepthCache',
      range: { min: 2, max: 3 },
    };
    expect(() => createCatalog(incorrectTerminal)).toThrow(CatalogContractError);

    const incorrectStart = input();
    const layout = incorrectStart.biomeLayouts.find((candidate) => candidate.biomeKey === 'N');
    if (layout === undefined) throw new Error('missing N layout fixture');
    (layout as { start: unknown }).start = { kind: 'fixedAuthored', roomGameName: 'N_Combat01' };
    expect(() => createCatalog(incorrectStart)).toThrow(CatalogContractError);
  });
});
