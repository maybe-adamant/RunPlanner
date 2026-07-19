import type { RawCatalogInput } from './declarations';
import { describe, expect, it } from 'vitest';

import { CatalogContractError, createCatalog } from './catalog';
import { declarations } from './declarations';

function raw(value: unknown): RawCatalogInput {
  return value as RawCatalogInput;
}

function roomIndex(gameName: string): number {
  const index = declarations.rooms.findIndex((room) => room.gameName === gameName);
  if (index < 0) {
    throw new Error(`missing room fixture ${gameName}`);
  }
  return index;
}

function encounterIndex(key: string): number {
  const index = declarations.encounterProfiles.findIndex((profile) => profile.key === key);
  if (index < 0) {
    throw new Error(`missing encounter fixture ${key}`);
  }
  return index;
}

describe('shared structural catalog vocabulary', () => {
  it('normalizes typed physical exits through one compatibility authority', () => {
    const catalog = createCatalog(declarations);

    expect(catalog.exitTypes.byKey.OlympusOutdoorExitDoor).toEqual({
      key: 'OlympusOutdoorExitDoor',
      compatibilityPolicyKey: 'TargetOutdoor',
    });
    expect(catalog.exitCompatibilityPolicies.byKey.OutdoorSourceTargetsIndoor).toEqual({
      key: 'OutdoorSourceTargetsIndoor',
      kind: 'sourceTagRequiresTargetTag',
      sourceTag: 'Outdoor',
      targetTag: 'Indoor',
    });
  });

  it('normalizes the shared HubBiome and fixed-entry descriptor vocabulary', () => {
    const opening = declarations.rooms.find((room) => room.gameName === 'F_Opening01');
    const combat = declarations.rooms.find((room) => room.gameName === 'F_Combat01');
    const preboss = declarations.rooms.find((room) => room.gameName === 'F_PreBoss01');
    const boss = declarations.rooms.find((room) => room.gameName === 'F_Boss01');
    const postboss = declarations.rooms.find((room) => room.gameName === 'F_PostBoss01');
    if (
      opening === undefined ||
      combat === undefined ||
      preboss === undefined ||
      boss === undefined ||
      postboss === undefined
    ) {
      throw new Error('shared structural room fixtures are missing');
    }
    const nOpening = { ...opening, gameName: 'N_OpeningFixture', biomeKey: 'N' };
    const nEntry = {
      ...boss,
      gameName: 'N_EntryFixture',
      biomeKey: 'N',
      kind: 'Intro',
      mode: { kind: 'derived', classification: 'fixedEntry' },
      encounterProfileKey: 'FixedIntro',
    };
    const nHub = {
      ...boss,
      gameName: 'N_HubFixture',
      biomeKey: 'N',
      kind: 'Hub',
      mode: { kind: 'derived', classification: 'hub' },
      encounterProfileKey: 'FixedIntro',
    };
    const nCombat = { ...combat, gameName: 'N_CombatFixture', biomeKey: 'N' };
    const nPreboss = {
      ...preboss,
      gameName: 'N_PreBossFixture',
      biomeKey: 'N',
      mode: { kind: 'authored', templateKey: 'ShopPreboss' },
      entryOfferPolicy: undefined,
    };
    const nBoss = { ...boss, gameName: 'N_BossFixture', biomeKey: 'N' };
    const nPostboss = { ...postboss, gameName: 'N_PostBossFixture', biomeKey: 'N' };
    const nLayout = {
      biomeKey: 'N',
      kind: 'HubBiome',
      entries: [
        { kind: 'fixedAuthoredSlot', slotKey: 'opening', roomGameName: nOpening.gameName },
        { kind: 'fixedEntry', role: 'hubEntry', roomGameName: nEntry.gameName },
      ],
      hub: {
        roomGameName: nHub.gameName,
        slots: [
          {
            slotKey: 'combat01',
            roomGameName: nCombat.gameName,
          },
        ],
        openCount: { min: 1, max: 1 },
        requiredVisits: 1,
        restoreRoomGameName: nHub.gameName,
        rewardStorePolicy: { kind: 'none' },
        fields: [],
      },
      terminal: {
        kind: 'fixedAuthoredSlot',
        slotKey: 'preboss',
        roomGameName: nPreboss.gameName,
      },
      completion: {
        rooms: [
          { role: 'boss', roomGameName: nBoss.gameName },
          { role: 'postboss', roomGameName: nPostboss.gameName },
        ],
      },
      fields: [],
    };
    const nRooms = [nOpening, nEntry, nHub, nCombat, nPreboss, nBoss, nPostboss];

    const catalog = createCatalog(
      raw({
        ...declarations,
        rooms: [...declarations.rooms, ...nRooms],
        biomeLayouts: [...declarations.biomeLayouts, nLayout],
      }),
    );

    expect(catalog.biomeLayouts.byKey.N).toMatchObject({
      kind: 'HubBiome',
      entries: [
        { kind: 'fixedAuthoredSlot', slotKey: 'opening', roomGameName: 'N_OpeningFixture' },
        { kind: 'fixedEntry', role: 'hubEntry', roomGameName: 'N_EntryFixture' },
      ],
      hub: {
        roomGameName: 'N_HubFixture',
        slots: [{ slotKey: 'combat01', roomGameName: 'N_CombatFixture' }],
        rewardStorePolicy: { kind: 'none' },
        fields: [],
      },
    });

    expect(() =>
      createCatalog(
        raw({
          ...declarations,
          rooms: [...declarations.rooms, ...nRooms],
          biomeLayouts: [
            ...declarations.biomeLayouts,
            {
              ...nLayout,
              terminal: { ...nLayout.terminal, slotKey: 'opening' },
            },
          ],
        }),
      ),
    ).toThrowError(
      new CatalogContractError(
        `biomeLayouts[${declarations.biomeLayouts.length}].terminal.slotKey`,
        'duplicates fixed authored slot opening',
      ),
    );
  });

  it('normalizes a stateless fixed entry as a linear biome start', () => {
    const catalog = createCatalog(
      raw({
        ...declarations,
        rooms: declarations.rooms.map((room) =>
          room.gameName === 'G_Intro'
            ? { ...room, mode: { kind: 'derived', classification: 'fixedEntry' } }
            : room,
        ),
        biomeLayouts: declarations.biomeLayouts.map((layout) =>
          layout.biomeKey === 'G'
            ? {
                ...layout,
                start: { kind: 'fixedEntry', role: 'intro', roomGameName: 'G_Intro' },
              }
            : layout,
        ),
      }),
    );

    expect(catalog.biomeLayouts.byKey.G).toMatchObject({
      kind: 'LinearBiome',
      start: { kind: 'fixedEntry', role: 'intro', roomGameName: 'G_Intro' },
    });
  });

  it('normalizes direct and conditional generated terminal policies', () => {
    const rooms = declarations.rooms.map((room) =>
      room.gameName === 'G_PreBoss01'
        ? {
            ...room,
            mode: { kind: 'authored', templateKey: 'ShopPreboss' },
            entryOfferPolicy: undefined,
          }
        : room,
    );
    const withTerminal = (terminal: unknown, batchPolicy: unknown) =>
      raw({
        ...declarations,
        rooms,
        biomeLayouts: declarations.biomeLayouts.map((layout) =>
          layout.biomeKey === 'G'
            ? {
                ...layout,
                continuation: { ...layout.continuation, batchPolicy },
                terminal,
              }
            : layout,
        ),
      });

    const direct = createCatalog(
      withTerminal(
        { kind: 'directTransition', roomGameName: 'G_PreBoss01' },
        { kind: 'standard', fields: [] },
      ),
    );
    expect(direct.biomeLayouts.byKey.G).toMatchObject({
      terminal: { kind: 'directTransition', roomGameName: 'G_PreBoss01' },
    });

    const conditional = createCatalog(
      withTerminal(
        {
          kind: 'generatedTarget',
          roomGameName: 'G_PreBoss01',
          closesBiomeWhenPicked: true,
        },
        { kind: 'clockwork', fields: [] },
      ),
    );
    expect(conditional.biomeLayouts.byKey.G).toMatchObject({
      terminal: {
        kind: 'generatedTarget',
        roomGameName: 'G_PreBoss01',
        closesBiomeWhenPicked: true,
      },
    });
  });

  it('normalizes fixed-count, staged, and Fields continuation policies', () => {
    const catalog = createCatalog(
      raw({
        ...declarations,
        biomeLayouts: declarations.biomeLayouts.map((layout) =>
          layout.biomeKey === 'F'
            ? {
                ...layout,
                continuation: {
                  ...layout.continuation,
                  progressionPolicy: { kind: 'fixedCount', continuationCount: 4 },
                  batchPolicy: {
                    kind: 'fields',
                    fields: [
                      {
                        key: 'cageOutcome',
                        kind: 'enum',
                        values: ['min', 'max'],
                        defaultValue: 'min',
                      },
                    ],
                  },
                },
              }
            : layout.biomeKey === 'G'
              ? {
                  ...layout,
                  continuation: {
                    ...layout.continuation,
                    progressionPolicy: {
                      kind: 'staged',
                      stages: [
                        {
                          key: 'openingCombat',
                          roomGameNames: ['G_Combat01', 'G_Combat02'],
                        },
                      ],
                    },
                  },
                }
              : layout,
        ),
      }),
    );

    expect(catalog.biomeLayouts.byKey.F).toMatchObject({
      continuation: {
        progressionPolicy: { kind: 'fixedCount', continuationCount: 4 },
        batchPolicy: {
          kind: 'fields',
          fields: [
            {
              key: 'cageOutcome',
              kind: 'enum',
              values: ['min', 'max'],
              defaultValue: 'min',
            },
          ],
        },
      },
    });
    expect(catalog.biomeLayouts.byKey.G).toMatchObject({
      continuation: {
        progressionPolicy: {
          kind: 'staged',
          stages: [{ key: 'openingCombat', roomGameNames: ['G_Combat01', 'G_Combat02'] }],
        },
      },
    });
  });

  it.each([
    {
      name: 'exit compatibility policy',
      input: {
        ...declarations,
        exitCompatibilityPolicies: [{ key: 'Broken', kind: 'mystery' }],
      },
      error: new CatalogContractError(
        'exitCompatibilityPolicies[0].kind',
        'unknown exit compatibility policy mystery',
      ),
    },
    {
      name: 'room mode',
      input: {
        ...declarations,
        rooms: [{ ...declarations.rooms[0], mode: { kind: 'mystery' } }],
      },
      error: new CatalogContractError('rooms[0].mode.kind', 'unknown room mode mystery'),
    },
    {
      name: 'room force',
      input: {
        ...declarations,
        rooms: [{ ...declarations.rooms[0], force: { kind: 'mystery' } }],
      },
      error: new CatalogContractError('rooms[0].force.kind', 'unknown room force mystery'),
    },
    {
      name: 'physical exit compatibility reference',
      input: {
        ...declarations,
        exitTypes: [
          ...declarations.exitTypes,
          { key: 'BrokenExitDoor', compatibilityPolicyKey: 'MissingPolicy' },
        ],
      },
      error: new CatalogContractError(
        `exitTypes[${declarations.exitTypes.length}].compatibilityPolicyKey`,
        'unknown exit compatibility policy MissingPolicy',
      ),
    },
    {
      name: 'derived room classification',
      input: {
        ...declarations,
        rooms: declarations.rooms.map((room) =>
          room.gameName === 'F_Boss01'
            ? { ...room, mode: { kind: 'derived', classification: 'mystery' } }
            : room,
        ),
      },
      error: new CatalogContractError(
        `rooms[${roomIndex('F_Boss01')}].mode.classification`,
        'unknown derived classification mystery',
      ),
    },
    {
      name: 'room structural tag',
      input: {
        ...declarations,
        rooms: [{ ...declarations.rooms[0], structuralTags: ['Ceiling'] }],
      },
      error: new CatalogContractError(
        'rooms[0].structuralTags[0]',
        'unknown structural tag Ceiling',
      ),
    },
    {
      name: 'missing room structural tags',
      input: {
        ...declarations,
        rooms: [{ ...declarations.rooms[0], structuralTags: undefined }],
      },
      error: new CatalogContractError('rooms[0].structuralTags', 'is required'),
    },
    {
      name: 'encounter phase kind',
      input: {
        ...declarations,
        encounterProfiles: declarations.encounterProfiles.map((profile, index) =>
          index === 0
            ? {
                ...profile,
                phases: profile.phases.map((phase) => ({ ...phase, kind: 'mystery' })),
              }
            : profile,
        ),
      },
      error: new CatalogContractError(
        'encounterProfiles[0].phases[0].kind',
        'unknown encounter phase kind mystery',
      ),
    },
    {
      name: 'encounter depth flag',
      input: {
        ...declarations,
        encounterProfiles: declarations.encounterProfiles.map((profile, index) =>
          index === 0
            ? {
                ...profile,
                phases: profile.phases.map((phase) => ({
                  ...phase,
                  countsEncounterDepth: 'yes',
                })),
              }
            : profile,
        ),
      },
      error: new CatalogContractError(
        'encounterProfiles[0].phases[0].countsEncounterDepth',
        'must be boolean',
      ),
    },
    {
      name: 'physical exit type reference',
      input: {
        ...declarations,
        rooms: [
          {
            ...declarations.rooms[0],
            exits: [{ index: 1, type: 'MissingExitDoor' }],
          },
        ],
      },
      error: new CatalogContractError(
        'rooms[0].exits[0].type',
        'unknown physical exit type MissingExitDoor',
      ),
    },
    {
      name: 'local-child descriptor',
      input: {
        ...declarations,
        rooms: [
          {
            ...declarations.rooms[0],
            localChildren: [{ key: 'children', kind: 'mystery', fields: [] }],
          },
        ],
      },
      error: new CatalogContractError(
        'rooms[0].localChildren[0].kind',
        'unknown local-child kind mystery',
      ),
    },
    {
      name: 'layout discriminant',
      input: {
        ...declarations,
        biomeLayouts: [{ ...declarations.biomeLayouts[0], kind: 'MysteryBiome' }],
      },
      error: new CatalogContractError('biomeLayouts[0].kind', 'unknown biome layout MysteryBiome'),
    },
    {
      name: 'entry descriptor',
      input: {
        ...declarations,
        biomeLayouts: [
          { ...declarations.biomeLayouts[0], entries: [{ kind: 'mystery', role: 'entry' }] },
        ],
      },
      error: new CatalogContractError(
        'biomeLayouts[0].entries[0].kind',
        'unknown entry descriptor mystery',
      ),
    },
    {
      name: 'linear start descriptor',
      input: {
        ...declarations,
        biomeLayouts: [{ ...declarations.biomeLayouts[0], start: { kind: 'mystery' } }],
      },
      error: new CatalogContractError(
        'biomeLayouts[0].start.kind',
        'unknown linear start descriptor mystery',
      ),
    },
    {
      name: 'progression policy',
      input: {
        ...declarations,
        biomeLayouts: [
          {
            ...declarations.biomeLayouts[0],
            continuation: {
              ...declarations.biomeLayouts[0].continuation,
              progressionPolicy: { kind: 'mystery' },
            },
          },
        ],
      },
      error: new CatalogContractError(
        'biomeLayouts[0].continuation.progressionPolicy.kind',
        'unknown progression policy mystery',
      ),
    },
    {
      name: 'generated-batch policy',
      input: {
        ...declarations,
        biomeLayouts: [
          {
            ...declarations.biomeLayouts[0],
            continuation: {
              ...declarations.biomeLayouts[0].continuation,
              batchPolicy: { kind: 'mystery', fields: [] },
            },
          },
        ],
      },
      error: new CatalogContractError(
        'biomeLayouts[0].continuation.batchPolicy.kind',
        'unknown generated-batch policy mystery',
      ),
    },
    {
      name: 'generated terminal template',
      input: {
        ...declarations,
        biomeLayouts: declarations.biomeLayouts.map((layout, index) =>
          index === 0
            ? {
                ...layout,
                continuation: {
                  ...layout.continuation,
                  batchPolicy: { kind: 'clockwork', fields: [] },
                },
                terminal: {
                  kind: 'generatedTarget',
                  roomGameName: 'F_PreBoss01',
                  closesBiomeWhenPicked: true,
                },
              }
            : layout,
        ),
      },
      error: new CatalogContractError(
        'biomeLayouts[0].terminal.roomGameName',
        'F_PreBoss01 must be an authored shop Preboss',
      ),
    },
    {
      name: 'biome field descriptor',
      input: {
        ...declarations,
        biomeLayouts: [
          {
            ...declarations.biomeLayouts[0],
            fields: [{ key: 'field', kind: 'mystery', defaultValue: false }],
          },
        ],
      },
      error: new CatalogContractError(
        'biomeLayouts[0].fields[0].kind',
        'unknown authored field kind mystery',
      ),
    },
    {
      name: 'batch field descriptor',
      input: {
        ...declarations,
        biomeLayouts: [
          {
            ...declarations.biomeLayouts[0],
            continuation: {
              ...declarations.biomeLayouts[0].continuation,
              batchPolicy: {
                kind: 'fields',
                fields: [{ key: 'field', kind: 'mystery', defaultValue: false }],
              },
            },
          },
        ],
      },
      error: new CatalogContractError(
        'biomeLayouts[0].continuation.batchPolicy.fields[0].kind',
        'unknown authored field kind mystery',
      ),
    },
    {
      name: 'reward-store policy',
      input: {
        ...declarations,
        biomeLayouts: [
          {
            ...declarations.biomeLayouts[0],
            continuation: {
              ...declarations.biomeLayouts[0].continuation,
              rewardStorePolicy: { kind: 'mystery' },
            },
          },
        ],
      },
      error: new CatalogContractError(
        'biomeLayouts[0].continuation.rewardStorePolicy.kind',
        'unknown reward-store policy mystery',
      ),
    },
    {
      name: 'source offer-point selector',
      input: {
        ...declarations,
        biomeLayouts: [
          {
            ...declarations.biomeLayouts[0],
            continuation: {
              ...declarations.biomeLayouts[0].continuation,
              rewardStorePolicy: { kind: 'sourceOfferPoint', selector: 'mystery' },
            },
          },
        ],
      },
      error: new CatalogContractError(
        'biomeLayouts[0].continuation.rewardStorePolicy.selector',
        'unknown source offer-point selector mystery',
      ),
    },
    {
      name: 'source reward-store override',
      input: {
        ...declarations,
        biomeLayouts: [
          {
            ...declarations.biomeLayouts[0],
            continuation: {
              ...declarations.biomeLayouts[0].continuation,
              rewardStoreOverrides: [
                {
                  sourceEncounterProfileKey: 'ShipCombat',
                  policy: { kind: 'sourceOfferPoint', selector: 'lastActiveWheel' },
                },
              ],
            },
          },
        ],
      },
      error: new CatalogContractError(
        'biomeLayouts[0].continuation.rewardStoreOverrides[0].sourceEncounterProfileKey',
        'ShipCombat is not used by a room in F',
      ),
    },
    {
      name: 'terminal policy',
      input: {
        ...declarations,
        biomeLayouts: [
          {
            ...declarations.biomeLayouts[0],
            terminal: { kind: 'mystery', roomGameName: 'F_PreBoss01' },
          },
        ],
      },
      error: new CatalogContractError(
        'biomeLayouts[0].terminal.kind',
        'unknown terminal policy mystery',
      ),
    },
    {
      name: 'terminal exit policy',
      input: {
        ...declarations,
        biomeLayouts: [
          {
            ...declarations.biomeLayouts[0],
            terminal: {
              ...declarations.biomeLayouts[0].terminal,
              exitPolicy: { kind: 'mystery' },
            },
          },
        ],
      },
      error: new CatalogContractError(
        'biomeLayouts[0].terminal.exitPolicy.kind',
        'unknown terminal exit policy mystery',
      ),
    },
    {
      name: 'generated terminal closure',
      input: {
        ...declarations,
        rooms: declarations.rooms.map((room) =>
          room.gameName === 'F_PreBoss01'
            ? {
                ...room,
                mode: { kind: 'authored', templateKey: 'ShopPreboss' },
                entryOfferPolicy: undefined,
              }
            : room,
        ),
        biomeLayouts: [
          {
            ...declarations.biomeLayouts[0],
            continuation: {
              ...declarations.biomeLayouts[0].continuation,
              batchPolicy: { kind: 'clockwork', fields: [] },
            },
            terminal: {
              kind: 'generatedTarget',
              roomGameName: 'F_PreBoss01',
              closesBiomeWhenPicked: false,
            },
          },
        ],
      },
      error: new CatalogContractError(
        'biomeLayouts[0].terminal.closesBiomeWhenPicked',
        'must be true',
      ),
    },
    {
      name: 'completion role',
      input: {
        ...declarations,
        biomeLayouts: [
          {
            ...declarations.biomeLayouts[0],
            completion: {
              ...declarations.biomeLayouts[0].completion,
              rooms: [{ role: 'postboss', roomGameName: 'F_PostBoss01' }],
            },
          },
        ],
      },
      error: new CatalogContractError(
        'biomeLayouts[0].completion.rooms[0].role',
        'completion role boss is required at index 0',
      ),
    },
    {
      name: 'orphaned derived room',
      input: {
        ...declarations,
        rooms: [
          ...declarations.rooms,
          {
            ...declarations.rooms[roomIndex('F_Boss01')],
            gameName: 'F_OrphanCompletion',
          },
        ],
      },
      error: new CatalogContractError(
        `rooms[${declarations.rooms.length}].mode`,
        'F_OrphanCompletion has no layout owner',
      ),
    },
  ])('rejects an unknown $name kind at construction', ({ input, error }) => {
    expect(() => createCatalog(raw(input))).toThrowError(error);
  });

  it('rejects malformed FieldsCombat cage ownership at construction', () => {
    const index = roomIndex('H_Combat01');
    const room = declarations.rooms[index];
    if (room?.gameName !== 'H_Combat01') {
      throw new Error('H_Combat01 fixture is missing');
    }
    const invalidCapacityChildren = room.localChildren.map((child) => ({
      ...child,
      maxActiveSlots: 2,
    }));

    expect(() =>
      createCatalog(
        raw({
          ...declarations,
          rooms: declarations.rooms.map((candidate, roomIndex) =>
            roomIndex === index
              ? {
                  ...candidate,
                  localChildren: invalidCapacityChildren,
                }
              : candidate,
          ),
        }),
      ),
    ).toThrowError(
      new CatalogContractError(
        `rooms[${index}].localChildren[0].maxActiveSlots`,
        'must equal raw capacity clamped to the physical slot count',
      ),
    );

    expect(() =>
      createCatalog(
        raw({
          ...declarations,
          rooms: declarations.rooms.map((candidate, roomIndex) =>
            roomIndex === index ? { ...candidate, individualRewardStoreKey: undefined } : candidate,
          ),
        }),
      ),
    ).toThrowError(
      new CatalogContractError(
        `rooms[${index}].individualRewardStoreKey`,
        'is required by FieldsCombat',
      ),
    );

    const cages = room.localChildren[0];
    if (cages?.kind !== 'boundedRewardSlots') {
      throw new Error('H_Combat01 cages fixture is missing');
    }
    expect(() =>
      createCatalog(
        raw({
          ...declarations,
          rooms: declarations.rooms.map((candidate, roomIndex) =>
            roomIndex === index
              ? {
                  ...candidate,
                  localChildren: [
                    {
                      ...cages,
                      reward: {
                        ...cages.reward,
                        storeKeys: ['RunProgress', 'MetaProgress'],
                      },
                    },
                  ],
                }
              : candidate,
          ),
        }),
      ),
    ).toThrowError(
      new CatalogContractError(
        `rooms[${index}].localChildren[0].reward.storeKeys`,
        'must contain only the FieldsCombat individual store RunProgress',
      ),
    );

    expect(() =>
      createCatalog(
        raw({
          ...declarations,
          rooms: declarations.rooms.map((candidate, roomIndex) =>
            roomIndex === index
              ? {
                  ...candidate,
                  localChildren: [
                    {
                      ...cages,
                      fields: [{ key: 'entered', kind: 'boolean', defaultValue: false }],
                    },
                  ],
                }
              : candidate,
          ),
        }),
      ),
    ).toThrowError(
      new CatalogContractError(
        `rooms[${index}].localChildren[0].fields`,
        'FieldsCombat cages do not own authored fields',
      ),
    );
  });

  it('rejects malformed ShipCombat offer-point and history contracts at construction', () => {
    const shipIndex = encounterIndex('ShipCombat');
    const room = declarations.rooms[roomIndex('O_Combat01')];
    const profile = declarations.encounterProfiles[shipIndex];
    if (room?.gameName !== 'O_Combat01' || profile?.key !== 'ShipCombat') {
      throw new Error('ShipCombat fixtures are missing');
    }

    expect(() =>
      createCatalog(
        raw({
          ...declarations,
          encounterProfiles: declarations.encounterProfiles.map((candidate, index) =>
            index === shipIndex
              ? {
                  ...candidate,
                  phases: candidate.phases.map((phase) =>
                    phase.key === 'Combat1' && phase.offerPoint !== undefined
                      ? {
                          ...phase,
                          offerPoint: { ...phase.offerPoint, defaultStoreKey: 'TyphonBossRewards' },
                        }
                      : phase,
                  ),
                }
              : candidate,
          ),
        }),
      ),
    ).toThrowError(
      new CatalogContractError(
        `encounterProfiles[${shipIndex}].phases[1].offerPoint.defaultStoreKey`,
        'must belong to the wheel reward store domain',
      ),
    );

    expect(() =>
      createCatalog(
        raw({
          ...declarations,
          encounterProfiles: declarations.encounterProfiles.map((candidate, index) =>
            index === shipIndex
              ? {
                  ...candidate,
                  phases: candidate.phases.map((phase) =>
                    phase.key === 'Intro' ? { ...phase, kind: 'story' } : phase,
                  ),
                }
              : candidate,
          ),
        }),
      ),
    ).toThrowError(
      new CatalogContractError(
        `rooms[${roomIndex('O_Combat01')}].encounterProfileKey`,
        'ShipCombat must define canonical combat Intro, Combat1/wheel1, and optional Combat2/wheel2 phases with two offer slots',
      ),
    );

    expect(() =>
      createCatalog(
        raw({
          ...declarations,
          rooms: declarations.rooms.map((candidate) =>
            candidate.gameName === room.gameName
              ? { ...candidate, enteredRewardStoreHistory: { kind: 'resolvedOffer' } }
              : candidate,
          ),
        }),
      ),
    ).toThrowError(
      new CatalogContractError(
        `rooms[${roomIndex('O_Combat01')}].enteredRewardStoreHistory`,
        'ShipCombat history is emitted by its active wheel offer points',
      ),
    );
  });

  it('normalizes every closed authored field kind and both dormant store policies', () => {
    const catalog = createCatalog(
      raw({
        ...declarations,
        rooms: declarations.rooms.map((room) =>
          room.gameName === 'F_Opening01'
            ? {
                ...room,
                localChildren: [
                  {
                    key: 'cages',
                    kind: 'boundedRewardSlots',
                    slotKeys: ['cage1', 'cage2', 'cage3'],
                    rawCapacity: 3,
                    maxActiveSlots: 3,
                    reward: {
                      kind: 'countedChoice',
                      storeKeys: ['RunProgress'],
                      eligibleRewardTypes: [],
                      ineligibleRewardTypes: [],
                      producerLifecycleKey: 'RoomReward',
                    },
                    fields: [{ key: 'entered', kind: 'boolean', defaultValue: false }],
                  },
                  {
                    key: 'sideRooms',
                    kind: 'fixedRoomSlots',
                    slots: [
                      {
                        slotKey: 'side1',
                        roomGameName: 'F_Combat01',
                        availabilityRank: 1,
                      },
                    ],
                    fields: [{ key: 'entered', kind: 'boolean', defaultValue: false }],
                  },
                ],
              }
            : room,
        ),
        biomeLayouts: declarations.biomeLayouts.map((layout, index) => ({
          ...layout,
          fields:
            index === 0
              ? [
                  { key: 'enabled', kind: 'boolean', defaultValue: false },
                  { key: 'count', kind: 'boundedInteger', min: 1, max: 3, defaultValue: 2 },
                  { key: 'mode', kind: 'enum', values: ['A', 'B'], defaultValue: 'A' },
                ]
              : [],
          continuation: {
            ...layout.continuation,
            rewardStorePolicy:
              index === 0
                ? { kind: 'sourceOfferPoint', selector: 'lastActiveWheel' }
                : { kind: 'none' },
            rewardStoreOverrides:
              index === 0
                ? [
                    {
                      sourceEncounterProfileKey: 'F_Opening',
                      policy: { kind: 'none' },
                    },
                  ]
                : [],
          },
        })),
      }),
    );

    expect(catalog.biomeLayouts.byKey.F).toMatchObject({
      fields: [
        { key: 'enabled', kind: 'boolean', defaultValue: false },
        { key: 'count', kind: 'boundedInteger', min: 1, max: 3, defaultValue: 2 },
        { key: 'mode', kind: 'enum', values: ['A', 'B'], defaultValue: 'A' },
      ],
      continuation: {
        rewardStorePolicy: { kind: 'sourceOfferPoint', selector: 'lastActiveWheel' },
        rewardStoreOverrides: [
          { sourceEncounterProfileKey: 'F_Opening', policy: { kind: 'none' } },
        ],
      },
    });
    expect(catalog.biomeLayouts.byKey.G).toMatchObject({
      continuation: { rewardStorePolicy: { kind: 'none' } },
    });
    expect(catalog.rooms.byKey.F_Opening01?.localChildren).toMatchObject([
      {
        key: 'cages',
        kind: 'boundedRewardSlots',
        slotKeys: ['cage1', 'cage2', 'cage3'],
        rawCapacity: 3,
        maxActiveSlots: 3,
        reward: { kind: 'countedChoice', storeKeys: ['RunProgress'] },
        fields: [{ key: 'entered', kind: 'boolean', defaultValue: false }],
      },
      {
        key: 'sideRooms',
        kind: 'fixedRoomSlots',
        slots: [{ slotKey: 'side1', roomGameName: 'F_Combat01', availabilityRank: 1 }],
        fields: [{ key: 'entered', kind: 'boolean', defaultValue: false }],
      },
    ]);
  });
});
