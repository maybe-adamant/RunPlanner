import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectHistoryCommands,
  createProjectDocument,
  createProjectHistory,
  decodeDraftShareCode,
  draftShareCommands,
  encodeDraftShareCode,
  MAX_DRAFT_SEED,
  ProjectCommandContractError,
  projectDraftShareInputs,
  undoProjectHistory,
  type DraftShareInputs,
} from '@run-planner/engine/authored-project';
import { draftProject, type DraftSpec } from '@run-planner/engine/simulation';
import { createDefaultAuthoredHexTree } from '../../src/authored-project/traits/hex-tree';
import { hexNodeTalentDomain } from '../../src/authored-project/traits/hex-talent-tree';

const project = (routeKey: string, itineraryBiomeKeys?: readonly string[]) =>
  createProjectDocument(catalog, {
    projectId: 'share',
    routeKey,
    ...(itineraryBiomeKeys === undefined ? {} : { itineraryBiomeKeys }),
    configuredBiomeCount: 0,
  });

const seleneAspect = catalog.aspects.values.find(
  (aspect) => aspect.startingTrait?.traitKey === 'SpellMoonBeamTrait',
)!.key;
const seleneWeapon = catalog.weapons.values.find((weapon) =>
  weapon.aspectKeys.includes(seleneAspect),
)!.key;
const fearRanks = (ranks: Readonly<Record<string, number>>) =>
  Object.fromEntries(catalog.fearVows.values.map((vow) => [vow.key, ranks[vow.key] ?? 0]));

const underworld: DraftShareInputs = {
  ...projectDraftShareInputs(project('Underworld')),
  configuredBiomeCount: 4,
  draft: {
    godKeys: ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'],
    storyNpcByBiome: { F: 'Arachne', G: 'Narcissus', H: 'Echo', I: 'Hades' },
    fieldNpcsByBiome: { F: ['Artemis'], I: ['Nemesis'], Q: [] },
    basketTraitKeys: ['ZeusWeaponBoon', 'ApolloCastBoon', 'AphroditeSprintBoon', 'HestiaManaBoon'],
    rackKeepsakeByBiome: { F: 'DoorHealReserveKeepsake', H: 'BossPreDamageKeepsake' },
    seed: 3_141_592_653,
    godBoonsByBiome: { F: 8, I: 1 },
    perGodCap: 3,
    preferMidshops: true,
    pursueTartarusGoal: true,
    roomForcing: 'game',
    purchasesPerBiome: 0,
    retriesPerBiome: 10,
    resourceRoomChance: 50,
  },
};

const surface: DraftShareInputs = {
  ...projectDraftShareInputs(project('Surface')),
  configuredBiomeCount: 2,
  loadout: {
    weaponKey: seleneWeapon,
    aspectKey: seleneAspect,
    startingKeepsakeKey: 'DoorHealReserveKeepsake',
    familiarKey: catalog.familiars.values.at(-1)!.key,
    manualArcanaKeys: catalog.arcanaCards.values
      .filter((card) => card.activation.kind === 'manual')
      .slice(0, 3)
      .map((card) => card.key),
    fearRanks: fearRanks({ [catalog.fearVows.values[0]!.key]: 2 }),
    aspectHexTree: createDefaultAuthoredHexTree(catalog, 'SpellMoonBeamTrait', 'Maze'),
  },
  draft: {
    godKeys: ['Zeus', 'Hera'],
    storyNpcByBiome: { N: 'Medea' },
    fieldNpcsByBiome: {},
    basketTraitKeys: ['HeraCastBoon'],
    rackKeepsakeByBiome: {},
    seed: 7,
  },
};

const dream: DraftShareInputs = {
  ...projectDraftShareInputs(project('Dream', ['H', 'F', 'N', 'I'])),
  configuredBiomeCount: 3,
  draft: { ...surface.draft, storyNpcByBiome: { H: 'Echo' }, seed: 1 },
};

const freshFile: DraftShareInputs = {
  ...projectDraftShareInputs(project('FreshFile')),
  configuredBiomeCount: 2,
  draft: {
    godKeys: ['Apollo', 'Poseidon'],
    storyNpcByBiome: {},
    fieldNpcsByBiome: {},
    basketTraitKeys: ['ApolloWeaponBoon', 'PoseidonCastBoon'],
    rackKeepsakeByBiome: {},
    seed: 1,
  },
};

const decoded = (code: string, route?: { routeKey: string; itineraryBiomeKeys: string[] }) => {
  const result = decodeDraftShareCode(catalog, code, route);
  if (!result.ok) throw new Error(`refused ${result.refusal}`);
  return result.inputs;
};

describe('draft share codes', () => {
  for (const [name, inputs] of Object.entries({ underworld, surface, dream, freshFile }))
    it(`round-trips ${name} inputs`, () => {
      const code = encodeDraftShareCode(catalog, inputs);
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]+$/);
      expect(decoded(code)).toEqual(inputs);
      expect(decoded(code.toLowerCase().replace(/1/g, 'l'))).toEqual(inputs);
    });

  it('carries and installs the starting keepsake result of each keepsake that has one', () => {
    const keepsakeOf = (kind: string) =>
      catalog.keepsakes.values.find((keepsake) => keepsake.effect?.kind === kind)!.key;
    const pomTrait = catalog.traitGivers.byKey.Hades!.traitKeys[0]!;
    const pomRarity = catalog.traitGivers.byKey.Hades!.rarityPolicy;
    const pom =
      catalog.traits.byKey[pomTrait]!.rarityDomain.kind === 'none' || pomRarity?.kind !== 'fixed'
        ? { traitKey: pomTrait }
        : { traitKey: pomTrait, rarity: pomRarity.rarity };
    const hammerTrait = catalog.traits.values.find(
      (trait) =>
        trait.hammerCompatibility?.weaponKey === underworld.loadout.weaponKey &&
        trait.hammerCompatibility.aspectKeys.includes(underworld.loadout.aspectKey!),
    )!.key;
    const blessing = catalog.chaos.blessings.values.find(
      (candidate) => candidate.fixedRarity === undefined && candidate.operands.length > 0,
    )!;
    const cases = [
      ['jeweledPom', { jeweledPom: pom }],
      ['experimentalHammer', { experimentalHammer: { kind: 'selected', traitKey: hammerTrait } }],
      [
        'transcendentEmbryo',
        {
          transcendentEmbryo: {
            blessingKey: blessing.key,
            blessingValues: Object.fromEntries(
              blessing.operands.map((operand) => [operand.key, operand.authoringDefault]),
            ),
          },
        },
      ],
    ] as const;
    for (const [kind, keepsakeEquipResults] of cases) {
      const inputs: DraftShareInputs = {
        ...underworld,
        loadout: {
          ...underworld.loadout,
          startingKeepsakeKey: keepsakeOf(kind),
          keepsakeEquipResults,
        },
      };
      const back = decoded(encodeDraftShareCode(catalog, inputs));
      expect(back, kind).toEqual(inputs);
      const base = project('Underworld');
      const installed = applyProjectHistoryCommands(
        createProjectHistory(base),
        catalog,
        draftShareCommands(catalog, base, back),
      ).present;
      expect(projectDraftShareInputs(installed).loadout.keepsakeEquipResults, kind).toEqual(
        keepsakeEquipResults,
      );
    }
  });

  it('round-trips an edited Hex tree, the seed range and a Vow at its top rank', () => {
    const hex = catalog.hexes.byKey.SpellMoonBeamTrait!;
    const tree = createDefaultAuthoredHexTree(catalog, 'SpellMoonBeamTrait', 'Pyramid');
    const edited = Object.fromEntries(
      Object.entries(tree.nodes).map(([nodeKey, talentKey]) => {
        const domain = hexNodeTalentDomain(hex, 'Pyramid', nodeKey);
        return [nodeKey, domain.find((key) => key !== talentKey) ?? talentKey];
      }),
    );
    expect(edited).not.toEqual(tree.nodes);
    const topVow = catalog.fearVows.values.find((vow) => vow.key !== 'LimitGraspShrineUpgrade')!;
    for (const seed of [0, MAX_DRAFT_SEED]) {
      const inputs: DraftShareInputs = {
        ...surface,
        loadout: {
          ...surface.loadout,
          manualArcanaKeys: [],
          fearRanks: fearRanks({ [topVow.key]: topVow.incrementalFear.length }),
          aspectHexTree: { layoutKey: 'Pyramid', nodes: edited },
        },
        draft: { ...surface.draft, seed },
      };
      expect(decoded(encodeDraftShareCode(catalog, inputs))).toEqual(inputs);
    }
  });

  it('refuses set padding bits and an index past its list', () => {
    // A Fresh File code packed by hand: route, prefix, one god, empty basket and records, no
    // options, seed 2.
    const header = encodeDraftShareCode(catalog, freshFile).slice(0, 4);
    const code = (godIndex: number, padding: string) => {
      const bits = `11${'010'}${'0001'}${godIndex.toString(2).padStart(4, '0')}${'0'.repeat(9)}0000${'0000000'}00001010${padding}`;
      let text = header;
      for (let index = 0; index < bits.length; index += 5)
        text += '0123456789ABCDEFGHJKMNPQRSTVWXYZ'[parseInt(bits.slice(index, index + 5), 2)];
      return text;
    };
    const godKeys = catalog.traitGivers.values.filter((g) => g.providerKind === 'olympian');
    expect(decoded(code(0, '0000')).draft).toMatchObject({ godKeys: [godKeys[0]!.key], seed: 2 });
    const refusal = (text: string) => {
      const result = decodeDraftShareCode(catalog, text);
      return result.ok ? 'decoded' : result.refusal;
    };
    expect(refusal(code(0, '0001'))).toBe('malformed');
    expect(refusal(code(godKeys.length, '0000'))).toBe('malformed');
  });

  it('installs inputs only on a project of their own route', () => {
    expect(() => draftShareCommands(catalog, project('Surface'), underworld)).toThrow(
      ProjectCommandContractError,
    );
    expect(() =>
      draftShareCommands(catalog, project('Dream', ['G', 'F', 'N', 'I']), dream),
    ).toThrow(ProjectCommandContractError);
  });

  it('keeps a light spec short', () => {
    expect(encodeDraftShareCode(catalog, freshFile).length).toBeLessThanOrEqual(17);
    expect(encodeDraftShareCode(catalog, underworld).length).toBeLessThanOrEqual(52);
  });

  it('refuses other layouts, catalogs, routes and garbage', () => {
    const code = encodeDraftShareCode(catalog, underworld);
    const refusal = (text: string, route?: Parameters<typeof decodeDraftShareCode>[2]) => {
      const result = decodeDraftShareCode(catalog, text, route);
      return result.ok ? 'decoded' : result.refusal;
    };
    expect(refusal('')).toBe('badLayout');
    expect(refusal('hello world!')).toBe('badLayout');
    expect(refusal(`3${code.slice(1)}`)).toBe('otherVersion');
    // A layout 1 code, from before the Advanced draft options.
    expect(refusal(`1${code.slice(1)}`)).toBe('olderVersion');
    const otherFingerprint = code[1] === '0' ? 'Z' : '0';
    expect(refusal(`${code[0]}${otherFingerprint}${code.slice(2)}`)).toBe('otherFingerprint');
    expect(refusal(code.slice(0, 4))).toBe('badLayout');
    expect(refusal(code.slice(0, 6))).toBe('malformed');
    expect(refusal(`${code}ZZ`)).toBe('malformed');
    expect(refusal(code, { routeKey: 'Surface', itineraryBiomeKeys: ['N', 'O', 'P', 'Q'] })).toBe(
      'otherRoute',
    );
    const dreamCode = encodeDraftShareCode(catalog, dream);
    expect(
      refusal(dreamCode, { routeKey: 'Dream', itineraryBiomeKeys: ['G', 'F', 'N', 'I'] }),
    ).toBe('otherRoute');
  });

  it('installs decoded inputs as one undoable edit', () => {
    const base = project('Surface');
    const history = applyProjectHistoryCommands(
      createProjectHistory(base),
      catalog,
      draftShareCommands(catalog, base, decoded(encodeDraftShareCode(catalog, surface))),
    );
    expect(projectDraftShareInputs(history.present)).toEqual(surface);
    expect(undoProjectHistory(history).present).toBe(base);
  });

  it('drafts the same plan from a decoded code', () => {
    const inputs: DraftShareInputs = {
      ...underworld,
      configuredBiomeCount: 1,
      draft: {
        ...freshFile.draft,
        godKeys: ['Zeus', 'Apollo', 'Hestia'],
        basketTraitKeys: ['ZeusWeaponBoon'],
      },
    };
    const draftOf = (source: DraftShareInputs) => {
      const history = applyProjectHistoryCommands(
        createProjectHistory(project(source.routeKey)),
        catalog,
        draftShareCommands(catalog, project(source.routeKey), source),
      );
      const { aspectHexTree: _hex, ...loadout } = source.loadout;
      void _hex;
      const spec: DraftSpec = {
        loadout,
        world: {
          godKeys: source.draft.godKeys,
          storyNpcByBiome: source.draft.storyNpcByBiome,
          fieldNpcsByBiome: source.draft.fieldNpcsByBiome,
        },
        basketTraitKeys: source.draft.basketTraitKeys,
        rackKeepsakeKeys: [null, null, null],
      };
      const result = draftProject(catalog, history.present, spec, source.draft.seed);
      if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
      return result.project;
    };
    const code = encodeDraftShareCode(catalog, inputs);
    expect(draftOf(decoded(code))).toEqual(draftOf(inputs));
  });
});
