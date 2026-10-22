import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import { LOADABLE_PROJECT_SCHEMAS } from '@planner/persistence/projectDocumentLoader';
import {
  catalogPlanSupport,
  projectCatalogView,
  type CatalogViewQuery,
} from '@planner/projections/catalogHome';
import type { LibraryItem } from '@planner/workspace/projectLibrary';
import { CATEGORIES, catalogEntry } from '@planner-test/fixtures/catalogFeedHost';

const entries = [
  catalogEntry({ id: 'wr', title: 'Underworld WR', tags: ['skull', 'zeus'] }),
  catalogEntry({
    id: 'surface',
    title: 'Sub 3m Surface',
    routeKey: 'Surface',
    biomeCount: 1,
    description: 'Opening on Apollo, built on Hera.',
    tags: ['skull', 'hera'],
  }),
  catalogEntry({
    id: 'chronos',
    title: 'Chronos practice',
    category: 'practice',
    tags: ['boss'],
    author: 'Mel',
  }),
  catalogEntry({ id: 'future', title: 'Future run', planSchemaVersion: 999, tags: [] }),
];
const feed = { categories: CATEGORIES, entries };
const QUERY: CatalogViewQuery = {
  category: null,
  filter: '',
  routeKey: null,
  tag: null,
  sort: 'name',
};

function item(key: string, projectId: string): LibraryItem {
  return {
    kind: 'ready',
    key,
    folder: 'Speedrun',
    modifiedMs: 0,
    projectId,
    name: 'Renamed by the player',
    routeKey: 'Underworld',
    weaponKey: null,
    aspectKey: null,
    biomeCount: 4,
  };
}

const view = (
  query: Partial<CatalogViewQuery> = {},
  items: readonly LibraryItem[] = [],
  copies = {},
) => projectCatalogView(catalog, feed, { items, copies }, { ...QUERY, ...query });
const titles = (query: Partial<CatalogViewQuery> = {}) =>
  view(query).rows.map((row) => row.entry.title);

describe('catalog view', () => {
  it('tabs each category with entries in the index order with its count', () => {
    expect(view().tabs).toEqual([
      { category: null, label: 'All', count: 4 },
      { category: 'speedrun', label: 'Speedrun', count: 3 },
      { category: 'practice', label: 'Practice', count: 1 },
    ]);
    expect(view({ category: 'practice' })).toMatchObject({ total: 1, tags: ['boss'] });
    expect(view({ category: 'full-run' })).toMatchObject({ total: 0, rows: [] });
  });

  it('searches text and tags, filters by route and tag, and sorts by name or route', () => {
    expect(titles()).toEqual(['Chronos practice', 'Future run', 'Sub 3m Surface', 'Underworld WR']);
    expect(titles({ sort: 'route' })).toEqual([
      'Sub 3m Surface',
      'Chronos practice',
      'Future run',
      'Underworld WR',
    ]);
    expect(titles({ filter: 'OPENING' })).toEqual(['Sub 3m Surface']);
    expect(titles({ filter: 'mel' })).toEqual(['Chronos practice']);
    expect(titles({ filter: 'zeus' })).toEqual(['Underworld WR']);
    expect(titles({ routeKey: 'Surface' })).toEqual(['Sub 3m Surface']);
    expect(titles({ tag: 'skull' })).toEqual(['Sub 3m Surface', 'Underworld WR']);
    expect(titles({ category: 'speedrun', tag: 'skull', filter: 'built' })).toEqual([
      'Sub 3m Surface',
    ]);
    expect(view().tags).toEqual(['boss', 'hera', 'skull', 'zeus']);
  });

  it('describes the route and biomes, and offers adding, opening the added copy or why not', () => {
    const rows = view({}, [item('Speedrun/wr.runplanner.json', 'copy-1')], {
      wr: 'copy-1',
      surface: 'deleted-copy',
    }).rows;
    const byId = Object.fromEntries(rows.map((row) => [row.entry.id, row]));
    expect(byId.wr).toMatchObject({
      route: catalog.routes.byKey.Underworld!.label,
      biomes: { count: '4 biomes', trail: `to ${catalog.biomes.byKey.I!.label}` },
      action: { kind: 'inLibrary', key: 'Speedrun/wr.runplanner.json' },
    });
    // A copy no longer in the library can be added again.
    expect(byId.surface).toMatchObject({
      biomes: { count: '1 biome', trail: catalog.biomes.byKey.N!.label },
      action: { kind: 'add' },
    });
    expect(byId.future!.action).toEqual({ kind: 'unsupported', support: 'tooNew' });
  });

  it('admits the schemas the loader opens', () => {
    const { oldest, newest, newestRevision } = LOADABLE_PROJECT_SCHEMAS;
    const support = (planSchemaVersion: number, planSchemaRevision = 0) =>
      catalogPlanSupport({ planSchemaVersion, planSchemaRevision });
    expect(support(oldest)).toBe('supported');
    expect(support(oldest - 1)).toBe('tooOld');
    expect(support(newest, newestRevision)).toBe('supported');
    expect(support(newest, newestRevision + 1)).toBe('tooNew');
    expect(support(newest + 1)).toBe('tooNew');
  });
});
