import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createProjectDocument,
  createProjectHistory,
  createRouteAddress,
  decodeProjectDocument,
  EMPTY_DRAFT_SPEC,
  encodeProjectDocument,
  MAX_DRAFT_SEED,
  sameDraftSpec,
  ProjectCommandContractError,
  ProjectDocumentContractError,
  undoProjectHistory,
  type AuthoredDraftSpec,
} from '@run-planner/engine/authored-project';

const route = createRouteAddress('Underworld');
const project = () =>
  createProjectDocument(catalog, {
    projectId: 'draft',
    routeKey: 'Underworld',
    configuredBiomeCount: 0,
  });
const fieldNpc = catalog.encounterDefinitions.values.find(
  (definition) =>
    definition.kind === 'combat' &&
    definition.npcPresentationKey !== undefined &&
    catalog.fieldNpcEncounterKeys.includes(definition.key),
)!.npcPresentationKey!;
const notAGod = catalog.traitGivers.values.find((giver) => giver.providerKind !== 'olympian')!.key;
const draft: AuthoredDraftSpec = {
  godKeys: ['Zeus', 'Hera'],
  storyNpcByBiome: { F: 'Arachne' },
  fieldNpcsByBiome: { G: [fieldNpc], Q: [] },
  basketTraitKeys: ['ZeusWeaponBoon'],
  rackKeepsakeByBiome: { F: 'BonusMoneyKeepsake' },
  seed: 424242,
};
const withRawDraft = (value: unknown): unknown => ({
  ...project(),
  route: { ...project().route, draft: value },
});

describe('draft spec', () => {
  it('starts empty with the first seed on every new route', () => {
    expect(project().route.draft).toEqual(EMPTY_DRAFT_SPEC);
    expect(EMPTY_DRAFT_SPEC).toEqual({
      godKeys: [],
      storyNpcByBiome: {},
      fieldNpcsByBiome: {},
      basketTraitKeys: [],
      rackKeepsakeByBiome: {},
      seed: 1,
    });
  });

  it('round-trips through ReplaceDraftSpec as one undoable edit, keeping off-itinerary biomes', () => {
    const history = applyProjectHistoryCommand(createProjectHistory(project()), catalog, {
      kind: 'ReplaceDraftSpec',
      route,
      draft,
    });
    expect(history.past).toHaveLength(1);
    expect(history.present.route.draft).toEqual(draft);
    expect(
      decodeProjectDocument(JSON.parse(encodeProjectDocument(history.present)), catalog),
    ).toEqual(history.present);
    expect(undoProjectHistory(history).present.route.draft).toEqual(EMPTY_DRAFT_SPEC);
    expect(
      applyProjectCommand(history.present, catalog, {
        kind: 'ReplaceDraftSpec',
        route,
        draft: { ...draft },
      }),
    ).toBe(history.present);
  });

  it('treats reordered record keys as the same spec and saves them in catalog biome order', () => {
    const set = applyProjectCommand(project(), catalog, { kind: 'ReplaceDraftSpec', route, draft });
    const reordered: AuthoredDraftSpec = {
      ...draft,
      fieldNpcsByBiome: { Q: [], G: [fieldNpc] },
      storyNpcByBiome: { ...draft.storyNpcByBiome },
    };
    expect(Object.keys(reordered.fieldNpcsByBiome)).toEqual(['Q', 'G']);
    expect(
      applyProjectCommand(set, catalog, { kind: 'ReplaceDraftSpec', route, draft: reordered }),
    ).toBe(set);
    const fromReordered = applyProjectCommand(project(), catalog, {
      kind: 'ReplaceDraftSpec',
      route,
      draft: reordered,
    });
    expect(encodeProjectDocument(fromReordered)).toBe(encodeProjectDocument(set));
    expect(sameDraftSpec(draft, { ...draft, godKeys: ['Hera', 'Zeus'] })).toBe(false);
  });

  it('rejects unknown keys, unknown catalog references, duplicates and a bad seed', () => {
    for (const value of [
      { ...draft, extra: true },
      { ...draft, godKeys: ['NotAGod'] },
      { ...draft, godKeys: [notAGod] },
      { ...draft, storyNpcByBiome: { F: 'Zeus' } },
      { ...draft, fieldNpcsByBiome: { G: ['Arachne'] } },
      { ...draft, godKeys: ['Zeus', 'Zeus'] },
      { ...draft, storyNpcByBiome: { NotABiome: 'Arachne' } },
      { ...draft, fieldNpcsByBiome: { G: ['NotAnNpc'] } },
      { ...draft, basketTraitKeys: ['NotATrait'] },
      { ...draft, rackKeepsakeByBiome: { F: 'NotAKeepsake' } },
      { ...draft, seed: -1 },
      { ...draft, seed: 1.5 },
      { ...draft, seed: MAX_DRAFT_SEED + 1 },
    ]) {
      expect(() => decodeProjectDocument(withRawDraft(value), catalog)).toThrow(
        ProjectDocumentContractError,
      );
      expect(() =>
        applyProjectCommand(project(), catalog, {
          kind: 'ReplaceDraftSpec',
          route,
          draft: value as AuthoredDraftSpec,
        }),
      ).toThrow(ProjectCommandContractError);
    }
    const { draft: _missing, ...withoutDraft } = project().route;
    void _missing;
    expect(() => decodeProjectDocument({ ...project(), route: withoutDraft }, catalog)).toThrow(
      ProjectDocumentContractError,
    );
  });
});
