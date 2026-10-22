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
  draftAdvancedChanged,
  withDraftAdvancedDefaults,
  withDraftGodBoons,
  withDraftPerGodCap,
  withDraftPreferMidshops,
  withDraftPurchasesPerBiome,
  withDraftResourceRoomChance,
  withDraftRetriesPerBiome,
  withDraftRoomForcing,
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

  it('saves the midshop and Tartarus preferences only when on, and refuses any value but true', () => {
    const on = { ...draft, preferMidshops: true as const };
    const decoded = (value: unknown) =>
      decodeProjectDocument(withRawDraft(value), catalog).route.draft;
    expect(decoded(on)).toEqual(on);
    expect(decoded(draft)).not.toHaveProperty('preferMidshops');
    expect(() => decoded({ ...draft, preferMidshops: false })).toThrow(
      ProjectDocumentContractError,
    );
    expect(decoded({ ...draft, pursueTartarusGoal: true })).toEqual({
      ...draft,
      pursueTartarusGoal: true,
    });
    expect(() => decoded({ ...draft, pursueTartarusGoal: false })).toThrow(
      ProjectDocumentContractError,
    );
    expect(sameDraftSpec({ ...draft, pursueTartarusGoal: true }, draft)).toBe(false);
    expect(sameDraftSpec(on, draft)).toBe(false);
    expect(sameDraftSpec(on, { ...on })).toBe(true);
  });

  it("stores god boons only when they differ from their biome's default, and the per-god cap likewise, clamped", () => {
    expect(withDraftGodBoons(draft, 'Underworld', 'G', 2)).toEqual(draft);
    const raised = withDraftGodBoons(draft, 'Underworld', 'G', 12);
    expect(raised.godBoonsByBiome).toEqual({ G: 10 });
    expect(withDraftGodBoons(raised, 'Underworld', 'G', 2)).toEqual(draft);
    expect(withDraftGodBoons(draft, 'Underworld', 'F', -2).godBoonsByBiome).toEqual({ F: 0 });
    expect(withDraftPerGodCap(draft, 5)).toEqual(draft);
    // Under Denial the default is 4; a stored 5 is absolute.
    expect(withDraftPerGodCap(draft, 4, 4)).toEqual(draft);
    expect(withDraftPerGodCap(draft, 5, 4).perGodCap).toBe(5);
    expect(withDraftPerGodCap(draft, 0).perGodCap).toBe(1);
    expect(withDraftPerGodCap(draft, 99).perGodCap).toBe(10);
    const decoded = (value: unknown) =>
      decodeProjectDocument(withRawDraft(value), catalog).route.draft;
    expect(decoded({ ...draft, godBoonsByBiome: { G: 6 }, perGodCap: 7 })).toEqual({
      ...draft,
      godBoonsByBiome: { G: 6 },
      perGodCap: 7,
    });
    // A stored count equal to its biome's default decodes away.
    expect(decoded({ ...draft, godBoonsByBiome: { F: 6, G: 6 } }).godBoonsByBiome).toEqual({
      G: 6,
    });
    expect(decoded({ ...draft, godBoonsByBiome: { G: 2 } })).toEqual(draft);
    for (const bad of [
      { godBoonsByBiome: { G: 11 } },
      { godBoonsByBiome: { Z: 4 } },
      { perGodCap: 0 },
      { perGodCap: 11 },
    ])
      expect(() => decoded({ ...draft, ...bad })).toThrow(ProjectDocumentContractError);
  });

  it('stores the search options only when not default, clamped to their ranges and steps', () => {
    expect(withDraftRoomForcing(draft, 'softened')).toEqual(draft);
    expect(withDraftRoomForcing(draft, 'game').roomForcing).toBe('game');
    expect(withDraftRoomForcing(withDraftRoomForcing(draft, 'game'), 'softened')).toEqual(draft);
    expect(withDraftPurchasesPerBiome(draft, 2)).toEqual(draft);
    expect(withDraftPurchasesPerBiome(draft, 0).purchasesPerBiome).toBe(0);
    expect(withDraftPurchasesPerBiome(draft, 9).purchasesPerBiome).toBe(4);
    expect(withDraftRetriesPerBiome(draft, 3)).toEqual(draft);
    expect(withDraftRetriesPerBiome(draft, -1).retriesPerBiome).toBe(0);
    expect(withDraftRetriesPerBiome(draft, 99).retriesPerBiome).toBe(10);
    expect(withDraftResourceRoomChance(draft, 10)).toEqual(draft);
    expect(withDraftResourceRoomChance(draft, 23).resourceRoomChance).toBe(25);
    expect(withDraftResourceRoomChance(draft, 80).resourceRoomChance).toBe(50);
    expect(withDraftResourceRoomChance(draft, 0).resourceRoomChance).toBe(0);
    const decoded = (value: unknown) =>
      decodeProjectDocument(withRawDraft(value), catalog).route.draft;
    const options = {
      roomForcing: 'deadline',
      purchasesPerBiome: 0,
      retriesPerBiome: 7,
      resourceRoomChance: 35,
    } as const;
    expect(decoded({ ...draft, ...options })).toEqual({ ...draft, ...options });
    // A stored default decodes away, as the setters never store one.
    expect(
      decoded({
        ...draft,
        roomForcing: 'softened',
        purchasesPerBiome: 2,
        retriesPerBiome: 3,
        resourceRoomChance: 10,
      }),
    ).toEqual(draft);
    for (const bad of [
      { roomForcing: 'sometimes' },
      { purchasesPerBiome: 5 },
      { retriesPerBiome: 11 },
      { resourceRoomChance: 55 },
      { resourceRoomChance: 12 },
    ])
      expect(() => decoded({ ...draft, ...bad })).toThrow(ProjectDocumentContractError);
  });

  it('resets every Advanced option in one edit, keeping the world, basket and seed', () => {
    expect(draftAdvancedChanged(draft)).toBe(false);
    const advanced = withDraftPreferMidshops(
      withDraftRetriesPerBiome(
        withDraftRoomForcing(
          withDraftPerGodCap(withDraftGodBoons(draft, 'Underworld', 'F', 9), 3),
          'game',
        ),
        6,
      ),
      true,
    );
    expect(draftAdvancedChanged(advanced)).toBe(true);
    expect(withDraftAdvancedDefaults(advanced)).toEqual(draft);
    expect(
      withDraftAdvancedDefaults({
        ...draft,
        purchasesPerBiome: 0,
        resourceRoomChance: 50,
        pursueTartarusGoal: true,
      }),
    ).toEqual(draft);
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
