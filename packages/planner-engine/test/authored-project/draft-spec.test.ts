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
  DRAFT_OPTIONS,
  draftAdvancedChanged,
  withDraftAdvancedDefaults,
  withDraftGodBoons,
  withDraftOption,
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
  basketByGiver: { Zeus: ['ZeusWeaponBoon'] },
  rackKeepsakeByBiome: { F: 'BonusMoneyKeepsake' },
  seed: 424242,
};
const duo = 'ApolloSecondStageCastBoon';
const hosted: AuthoredDraftSpec = {
  ...draft,
  godKeys: ['Zeus', 'Hera', 'Apollo'],
  basketByGiver: { Zeus: ['ZeusWeaponBoon'], Apollo: ['ApolloCastBoon', duo] },
};
const withRawDraft = (value: unknown): unknown => ({
  ...project(),
  route: { ...project().route, draft: value },
});
const decoded = (value: unknown) => decodeProjectDocument(withRawDraft(value), catalog).route.draft;

describe('draft spec', () => {
  it('starts empty with the first seed on every new route', () => {
    expect(project().route.draft).toEqual(EMPTY_DRAFT_SPEC);
    expect(EMPTY_DRAFT_SPEC).toEqual({
      godKeys: [],
      storyNpcByBiome: {},
      fieldNpcsByBiome: {},
      basketByGiver: {},
      rackKeepsakeByBiome: {},
      seed: 1,
    });
  });

  it('saves the midshop and Tartarus preferences only when on; any other value is off', () => {
    const on = { ...draft, preferMidshops: true as const };
    expect(decoded(on)).toEqual(on);
    expect(decoded(draft)).not.toHaveProperty('preferMidshops');
    expect(decoded({ ...draft, preferMidshops: false })).toEqual(draft);
    expect(decoded({ ...draft, preferMidshops: 'yes' })).toEqual(draft);
    expect(decoded({ ...draft, pursueTartarusGoal: true })).toEqual({
      ...draft,
      pursueTartarusGoal: true,
    });
    expect(decoded({ ...draft, pursueTartarusGoal: 1 })).toEqual(draft);
    expect(withDraftOption(draft, 'preferMidshops', true)).toEqual(on);
    expect(withDraftOption(on, 'preferMidshops', false)).toEqual(draft);
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
    expect(withDraftOption(draft, 'perGodCap', 5)).toEqual(draft);
    // Under Denial the default is 4; a stored 5 is absolute.
    expect(withDraftOption(draft, 'perGodCap', 4, 4)).toEqual(draft);
    expect(withDraftOption(draft, 'perGodCap', 5, 4).perGodCap).toBe(5);
    expect(withDraftOption(draft, 'perGodCap', 0).perGodCap).toBe(1);
    expect(withDraftOption(draft, 'perGodCap', 99).perGodCap).toBe(10);
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
    // A stored per-god cap is absolute, so one equal to the plain default is kept.
    expect(decoded({ ...draft, perGodCap: 5 }).perGodCap).toBe(5);
  });

  it('stores the search options only when not default, clamped to their ranges and steps', () => {
    expect(withDraftOption(draft, 'roomForcing', 'softened')).toEqual(draft);
    expect(withDraftOption(draft, 'roomForcing', 'game').roomForcing).toBe('game');
    expect(
      withDraftOption(withDraftOption(draft, 'roomForcing', 'game'), 'roomForcing', 'softened'),
    ).toEqual(draft);
    expect(withDraftOption(draft, 'purchasesPerBiome', 2)).toEqual(draft);
    expect(withDraftOption(draft, 'purchasesPerBiome', 0).purchasesPerBiome).toBe(0);
    expect(withDraftOption(draft, 'purchasesPerBiome', 9).purchasesPerBiome).toBe(4);
    expect(withDraftOption(draft, 'retriesPerBiome', 3)).toEqual(draft);
    expect(withDraftOption(draft, 'retriesPerBiome', -1).retriesPerBiome).toBe(0);
    expect(withDraftOption(draft, 'retriesPerBiome', 99).retriesPerBiome).toBe(10);
    expect(withDraftOption(draft, 'resourceRoomChance', 10)).toEqual(draft);
    expect(withDraftOption(draft, 'resourceRoomChance', 23).resourceRoomChance).toBe(25);
    expect(withDraftOption(draft, 'resourceRoomChance', 80).resourceRoomChance).toBe(50);
    expect(withDraftOption(draft, 'resourceRoomChance', 0).resourceRoomChance).toBe(0);
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
  });

  it('resets every Advanced option in one edit, keeping the world, basket and seed', () => {
    expect(draftAdvancedChanged(draft)).toBe(false);
    let advanced = withDraftGodBoons(draft, 'Underworld', 'F', 9);
    advanced = withDraftOption(advanced, 'perGodCap', 3);
    advanced = withDraftOption(advanced, 'roomForcing', 'game');
    advanced = withDraftOption(advanced, 'retriesPerBiome', 6);
    advanced = withDraftOption(advanced, 'preferMidshops', true);
    expect(draftAdvancedChanged(advanced)).toBe(true);
    expect(withDraftAdvancedDefaults(advanced)).toEqual(draft);
    expect(
      withDraftAdvancedDefaults({
        ...draft,
        purchasesPerBiome: 0,
        resourceRoomChance: 50,
        pursueTartarusGoal: true,
        fillerPriority: [{ kind: 'pom' }],
      }),
    ).toEqual(draft);
  });

  it('stores a filler ranking in order with optional amounts, healing kinds and amounts', () => {
    expect(withDraftOption(draft, 'fillerPriority', [])).toEqual(draft);
    const ranked = withDraftOption(draft, 'fillerPriority', [
      { kind: 'pom', amount: 2 },
      { kind: 'maxHealth' },
      { kind: 'pom' },
    ]);
    expect(ranked.fillerPriority).toEqual([{ kind: 'pom', amount: 2 }, { kind: 'maxHealth' }]);
    expect(draftAdvancedChanged(ranked)).toBe(true);
    const same = (fillerPriority: NonNullable<AuthoredDraftSpec['fillerPriority']>) =>
      sameDraftSpec(ranked, { ...draft, fillerPriority });
    expect(same([{ kind: 'pom', amount: 2 }, { kind: 'maxHealth' }])).toBe(true);
    expect(same([{ kind: 'maxHealth' }, { kind: 'pom', amount: 2 }])).toBe(false);
    expect(same([{ kind: 'pom', amount: 3 }, { kind: 'maxHealth' }])).toBe(false);
    expect(same([{ kind: 'pom' }, { kind: 'maxHealth' }])).toBe(false);
    expect(decoded(ranked)).toEqual(ranked);
    for (const [value, expected] of [
      [
        [
          { kind: 'gold', amount: 0 },
          { kind: 'Gold' },
          { kind: 'gold', amount: 4 },
          3,
          'maxMagick',
          { kind: 'pom', amount: 99 },
          { kind: 'maxHealth', amount: 2.5 },
        ],
        {
          fillerPriority: [
            { kind: 'gold', amount: 1 },
            { kind: 'maxMagick' },
            { kind: 'pom', amount: 20 },
            { kind: 'maxHealth' },
          ],
        },
      ],
      [[{ kind: 'pom', amount: 'two' }], { fillerPriority: [{ kind: 'pom' }] }],
      [['nope'], {}],
      [[], {}],
      ['gold', {}],
    ] as const)
      expect(decoded({ ...draft, fillerPriority: value }), JSON.stringify(value)).toEqual({
        ...draft,
        ...expected,
      });
  });

  it("keeps a Duo in its host's list through the codec and Reset Advanced", () => {
    expect(
      decodeProjectDocument(
        JSON.parse(
          encodeProjectDocument({ ...project(), route: { ...project().route, draft: hosted } }),
        ),
        catalog,
      ).route.draft,
    ).toEqual(hosted);
    const zeusHosts = {
      ...hosted,
      basketByGiver: { Zeus: ['ZeusWeaponBoon', duo], Apollo: ['ApolloCastBoon'] },
    };
    expect(sameDraftSpec(zeusHosts, hosted)).toBe(false);
    expect(draftAdvancedChanged(hosted)).toBe(false);
    expect(withDraftAdvancedDefaults({ ...hosted, perGodCap: 3 })).toEqual(hosted);
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

  it('heals a spec: drops unknown keys, references and biomes, collapses duplicates, defaults bad types', () => {
    const healed = (value: unknown) => {
      const fromCommand = applyProjectCommand(project(), catalog, {
        kind: 'ReplaceDraftSpec',
        route,
        draft: value as AuthoredDraftSpec,
      }).route.draft;
      expect(fromCommand).toEqual(decoded(value));
      return fromCommand;
    };
    for (const [value, expected] of [
      [{ ...draft, extra: true }, draft],
      [{ ...draft, godKeys: ['NotAGod', 'Zeus', notAGod, 7, 'Hera', 'Zeus'] }, draft],
      [
        { ...draft, godKeys: 'Zeus' },
        { ...draft, godKeys: [] },
      ],
      [{ ...draft, storyNpcByBiome: { F: 'Arachne', G: 'Zeus', NotABiome: 'Arachne' } }, draft],
      [
        { ...draft, storyNpcByBiome: ['Arachne'] },
        { ...draft, storyNpcByBiome: {} },
      ],
      [{ ...draft, fieldNpcsByBiome: { G: [fieldNpc, 'Arachne', fieldNpc], Q: [], H: 3 } }, draft],
      [{ ...draft, fieldNpcsByBiome: { G: [fieldNpc], Q: ['NotAnNpc'] } }, draft],
      [
        { ...draft, basketByGiver: { Zeus: ['NotATrait', 'ZeusWeaponBoon', 'ZeusWeaponBoon'] } },
        draft,
      ],
      [
        { ...draft, basketByGiver: { Zeus: ['ZeusWeaponBoon'], NotAGiver: ['ZeusWeaponBoon'] } },
        draft,
      ],
      // A giver that does not offer a trait cannot list it, and an empty list drops.
      [{ ...draft, basketByGiver: { Zeus: ['ZeusWeaponBoon'], Hera: ['ZeusCastBoon'] } }, draft],
      [{ ...draft, basketByGiver: { Zeus: ['ZeusWeaponBoon', 7], Hera: [] } }, draft],
      [
        { ...draft, basketByGiver: { Zeus: 'ZeusWeaponBoon' } },
        { ...draft, basketByGiver: {} },
      ],
      [
        { ...draft, basketByGiver: ['ZeusWeaponBoon'] },
        { ...draft, basketByGiver: {} },
      ],
      // The flat basket of earlier saves is an unknown key.
      [
        { ...draft, basketByGiver: undefined, basketTraitKeys: ['ZeusWeaponBoon'] },
        { ...draft, basketByGiver: {} },
      ],
      [{ ...draft, rackKeepsakeByBiome: { F: 'BonusMoneyKeepsake', G: 'NotAKeepsake' } }, draft],
      [
        { ...draft, seed: -1 },
        { ...draft, seed: 1 },
      ],
      [
        { ...draft, seed: 1.5 },
        { ...draft, seed: 1 },
      ],
      [
        { ...draft, seed: '7' },
        { ...draft, seed: 1 },
      ],
      [
        { ...draft, seed: MAX_DRAFT_SEED + 1 },
        { ...draft, seed: 1 },
      ],
      [
        { ...draft, seed: MAX_DRAFT_SEED },
        { ...draft, seed: MAX_DRAFT_SEED },
      ],
      [{ godKeys: ['Zeus'] }, { ...EMPTY_DRAFT_SPEC, godKeys: ['Zeus'] }],
      ['not a spec', EMPTY_DRAFT_SPEC],
      [hosted, hosted],
      // A Duo listed by both its gods stays with the earlier pool god.
      [
        { ...hosted, basketByGiver: { ...hosted.basketByGiver, Zeus: ['ZeusWeaponBoon', duo] } },
        {
          ...hosted,
          basketByGiver: { Zeus: ['ZeusWeaponBoon', duo], Apollo: ['ApolloCastBoon'] },
        },
      ],
      [
        {
          ...hosted,
          godKeys: ['Apollo', 'Zeus'],
          basketByGiver: { ...hosted.basketByGiver, Zeus: ['ZeusWeaponBoon', duo] },
        },
        { ...hosted, godKeys: ['Apollo', 'Zeus'] },
      ],
      // A god outside the pool keeps its list, below the pool's gods.
      [
        {
          ...hosted,
          godKeys: ['Zeus', 'Hera'],
          basketByGiver: { Apollo: [duo], Zeus: ['ZeusWeaponBoon', duo] },
        },
        { ...hosted, godKeys: ['Zeus', 'Hera'], basketByGiver: { Zeus: ['ZeusWeaponBoon', duo] } },
      ],
      [
        { ...hosted, godKeys: ['Zeus', 'Hera'] },
        { ...hosted, godKeys: ['Zeus', 'Hera'] },
      ],
      // A Hermes trait sits under Hermes; a Duo under a non-god giver drops.
      [
        { ...draft, basketByGiver: { Zeus: ['ZeusWeaponBoon'], Hermes: ['HermesWeaponBoon'] } },
        { ...draft, basketByGiver: { Zeus: ['ZeusWeaponBoon'], Hermes: ['HermesWeaponBoon'] } },
      ],
      [{ ...draft, basketByGiver: { Zeus: ['ZeusWeaponBoon'], Hermes: [duo] } }, draft],
    ] as const)
      expect(healed(value), JSON.stringify(value)).toEqual(expected);
  });

  it('clamps options to their ranges and steps and defaults a value of the wrong type', () => {
    for (const [value, expected] of [
      [{ godBoonsByBiome: { G: 11, Z: 4, H: 'x' } }, { godBoonsByBiome: { G: 10 } }],
      [{ godBoonsByBiome: { F: -3 } }, { godBoonsByBiome: { F: 0 } }],
      [{ godBoonsByBiome: [4] }, {}],
      [{ perGodCap: 0 }, { perGodCap: 1 }],
      [{ perGodCap: 11 }, { perGodCap: 10 }],
      [{ perGodCap: 'five' }, {}],
      [{ roomForcing: 'sometimes' }, {}],
      [{ roomForcing: 3 }, {}],
      [{ purchasesPerBiome: 5 }, { purchasesPerBiome: 4 }],
      [{ retriesPerBiome: 11 }, { retriesPerBiome: 10 }],
      [{ retriesPerBiome: 3.4 }, {}],
      [{ resourceRoomChance: 55 }, { resourceRoomChance: 50 }],
      [{ resourceRoomChance: 12 }, {}],
      [{ resourceRoomChance: 13 }, { resourceRoomChance: 15 }],
      [{ resourceRoomChance: Number.NaN }, {}],
    ] as const)
      expect(decoded({ ...draft, ...value }), JSON.stringify(value)).toEqual({
        ...draft,
        ...expected,
      });
  });

  it('gives every Advanced option its own share-code tag', () => {
    const tags = Object.values(DRAFT_OPTIONS).map((declaration) => declaration.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it('decodes a route without a draft spec to the empty spec', () => {
    const { draft: _missing, ...withoutDraft } = project().route;
    void _missing;
    expect(
      decodeProjectDocument({ ...project(), route: withoutDraft }, catalog).route.draft,
    ).toEqual(EMPTY_DRAFT_SPEC);
  });
});
