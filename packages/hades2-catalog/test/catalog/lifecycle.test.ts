import { catalog, CatalogContractError, createCatalog } from '@run-planner/hades2-catalog';
import { declarations, type RawCatalogInput } from '../../src/declarations';
import { describe, expect, it } from 'vitest';

function malformedCatalog(value: unknown): RawCatalogInput {
  return value as RawCatalogInput;
}

describe('room lifecycle catalog', () => {
  it.each([
    ['unknown profile', 'MissingLifecycle', /unknown room lifecycle profile/],
    ['incompatible envelope', 'PCombatRoom', /does not support the room encounter envelope/],
  ])('rejects Narcissus room lifecycle with %s', (_name, lifecycleProfileKey, message) => {
    expect(() =>
      createCatalog(
        malformedCatalog({
          ...declarations,
          rooms: declarations.rooms.map((room) =>
            room.gameName === 'G_Story01' ? { ...room, lifecycleProfileKey } : room,
          ),
        }),
      ),
    ).toThrow(message);
  });

  it('normalizes reusable lifecycle profiles as immutable catalog data', () => {
    expect(catalog.roomLifecycleProfiles.values.map((profile) => profile.key)).toEqual([
      'StandardRewardRoom',
      'OpeningRewardRoom',
      'OpeningRewardNoEncounterRoom',
      'RewardlessCombatRoom',
      'PCombatRoom',
      'EphyraMainRoom',
      'EphyraSideRoom',
      'EphyraHubRoom',
      'ClockworkGoalRoom',
      'StoryPickupRoom',
      'RewardlessRoom',
      'DevotionRoom',
      'FieldsCombatRoom',
      'ShipCombatRoom',
      'WorldShopRoom',
      'PrebossFreeRewardRoom',
      'PrebossShopRoom',
      'BossRoom',
      'PostBossRoom',
    ]);
    expect(catalog.roomLifecycleProfiles.byKey.StandardRewardRoom?.producer).toEqual({
      kind: 'required',
      lifecycleProfileKeys: ['RoomReward'],
      points: ['beforeCombat', 'afterCombat', 'roomRewardPickup'],
    });
    expect(catalog.rooms.byKey.F_Opening01?.lifecycleProfileKey).toBeUndefined();
    expect(catalog.rooms.byKey.N_Opening01?.lifecycleProfileKey).toBeUndefined();
    expect(catalog.roomLifecycleProfiles.byKey.ClockworkGoalRoom?.producer).toEqual({
      kind: 'none',
    });
    expect(Object.isFrozen(catalog.roomLifecycleProfiles.values)).toBe(true);
    expect(Object.isFrozen(catalog.roomLifecycleProfiles.byKey.StandardRewardRoom?.steps)).toBe(
      true,
    );
  });

  it('declares how each envelope runs its encounters', () => {
    expect(
      Object.fromEntries(
        catalog.encounterEnvelopes.values.map((envelope) => [envelope.key, envelope.kind]),
      ),
    ).toEqual({
      EmptyEncounter: 'none',
      SingleEncounter: 'single',
      ShipEncounter: 'wheelPhases',
      PEncounter: 'sequential',
      FieldsEncounter: 'playerActivatedCages',
    });
  });

  it('rejects an envelope kind its slots do not support', () => {
    expect(() =>
      createCatalog(
        malformedCatalog({
          ...declarations,
          encounterEnvelopes: declarations.encounterEnvelopes.map((envelope) =>
            envelope.key === 'PEncounter' ? { ...envelope, kind: 'wheelPhases' } : envelope,
          ),
        }),
      ),
    ).toThrow(/wheelPhases does not fit the envelope's slots/);
  });

  it('rejects an encounter whose gate does not fit its slot', () => {
    expect(() =>
      createCatalog(
        malformedCatalog({
          ...declarations,
          encounterDefinitions: declarations.encounterDefinitions.map((definition) =>
            definition.key === 'GeneratedF'
              ? { ...definition, script: { gate: { kind: 'wheelUse' } } }
              : definition,
          ),
        }),
      ),
    ).toThrow(/GeneratedF gate wheelUse does not fit the slot/);
  });

  it('rejects unknown step, effect and producer references', () => {
    const base = declarations.roomLifecycleProfiles[0];
    if (base === undefined) {
      throw new Error('standard lifecycle declaration is missing');
    }
    const cases = [
      {
        profile: { ...base, steps: [{ kind: 'mystery', effects: [] }, ...base.steps.slice(1)] },
        error: new CatalogContractError(
          'roomLifecycleProfiles[0].steps[0].kind',
          'unknown lifecycle step mystery',
        ),
      },
      {
        profile: {
          ...base,
          steps: [{ kind: 'prepareRoom', effects: ['mystery'] }, ...base.steps.slice(1)],
        },
        error: new CatalogContractError(
          'roomLifecycleProfiles[0].steps[0].effects[0]',
          'unknown lifecycle effect mystery',
        ),
      },
      {
        profile: {
          ...base,
          steps: [{ kind: 'prepareRoom', effects: ['recordAppearance'] }, ...base.steps.slice(1)],
        },
        error: new CatalogContractError(
          'roomLifecycleProfiles[0].steps[0].effects',
          'prepareRoom requires effects recordPreparation, recordEncounter',
        ),
      },
      {
        profile: {
          ...base,
          producer: { ...base.producer, points: ['beforeCombat', 'mystery'] },
        },
        error: new CatalogContractError(
          'roomLifecycleProfiles[0].producer.points[1]',
          'unknown producer lifecycle point mystery',
        ),
      },
      {
        profile: { ...base, encounterEnvelopeKeys: ['MissingEncounter'] },
        error: new CatalogContractError(
          'roomLifecycleProfiles[0].encounterEnvelopeKeys[0]',
          'unknown encounter envelope MissingEncounter',
        ),
      },
      {
        profile: {
          ...base,
          producer: { kind: 'required', lifecycleProfileKeys: ['MissingProducer'], points: [] },
        },
        error: new CatalogContractError(
          'roomLifecycleProfiles[0].producer.lifecycleProfileKeys[0]',
          'unknown producer lifecycle MissingProducer',
        ),
      },
      {
        profile: {
          ...base,
          steps: base.steps.filter((step) => step.kind !== 'runEncounterScripts'),
        },
        error: new CatalogContractError(
          'roomLifecycleProfiles[0].steps',
          'producer points require the encounter scripts step',
        ),
      },
    ] as const;

    for (const fixture of cases) {
      expect(() =>
        createCatalog(
          malformedCatalog({
            ...declarations,
            roomLifecycleProfiles: [
              fixture.profile,
              ...declarations.roomLifecycleProfiles.slice(1),
            ],
          }),
        ),
      ).toThrowError(fixture.error);
    }
  });

  it('rejects outgoing generation before the encounter scripts', () => {
    const base = declarations.roomLifecycleProfiles[0];
    const outgoing = base?.steps.find((step) => step.kind === 'generateOutgoingBatch');
    if (base === undefined || outgoing === undefined) {
      throw new Error('standard lifecycle declaration is incomplete');
    }
    const steps = base.steps.filter((step) => step !== outgoing);
    const scripts = steps.findIndex((step) => step.kind === 'runEncounterScripts');

    expect(() =>
      createCatalog(
        malformedCatalog({
          ...declarations,
          roomLifecycleProfiles: [
            { ...base, steps: [...steps.slice(0, scripts), outgoing, ...steps.slice(scripts)] },
            ...declarations.roomLifecycleProfiles.slice(1),
          ],
        }),
      ),
    ).toThrowError(
      new CatalogContractError(
        `roomLifecycleProfiles[0].steps[${scripts}].kind`,
        'generateOutgoingBatch follows the encounter scripts',
      ),
    );
  });

  it('rejects duplicate explicit acquisition-point settlement', () => {
    const shopProfile = declarations.roomLifecycleProfiles.find(
      (profile) => profile.key === 'WorldShopRoom',
    );
    if (shopProfile === undefined) {
      throw new Error('World Shop lifecycle declaration is missing');
    }
    const profileIndex = declarations.roomLifecycleProfiles.indexOf(shopProfile);
    const settlementIndex = shopProfile.steps.findIndex(
      (step) => step.kind === 'settleAcquisitionPoint',
    );
    const settlement = shopProfile.steps[settlementIndex];
    if (settlement?.kind !== 'settleAcquisitionPoint') {
      throw new Error('World Shop lifecycle settlement is malformed');
    }
    const steps = [...shopProfile.steps];
    steps.splice(settlementIndex + 1, 0, settlement);

    expect(() =>
      createCatalog(
        malformedCatalog({
          ...declarations,
          roomLifecycleProfiles: declarations.roomLifecycleProfiles.map((profile) =>
            profile.key === shopProfile.key ? { ...profile, steps } : profile,
          ),
        }),
      ),
    ).toThrowError(
      new CatalogContractError(
        `roomLifecycleProfiles[${profileIndex}].steps[${settlementIndex + 1}].point`,
        'duplicates acquisition point roomExit',
      ),
    );
  });

  it('rejects required-object timing outside the room-entry and encounter boundary', () => {
    const base = declarations.roomLifecycleProfiles.find(
      (profile) => profile.key === 'EphyraMainRoom',
    );
    if (base === undefined) {
      throw new Error('Ephyra main lifecycle declaration is missing');
    }
    const profileIndex = declarations.roomLifecycleProfiles.indexOf(base);
    const indexOf = (kind: string) => base.steps.findIndex((step) => step.kind === kind);
    const spawnIndex = indexOf('spawnRequiredObjects');
    const scriptsIndex = indexOf('runEncounterScripts');
    const completionIndex = indexOf('completeRequiredObjects');
    const outgoingIndex = indexOf('generateOutgoingBatch');
    if (spawnIndex < 0 || scriptsIndex < 0 || completionIndex < 0 || outgoingIndex < 0) {
      throw new Error('Ephyra main lifecycle declaration is incomplete');
    }
    const swapped = (left: number, right: number) => {
      const steps = [...base.steps];
      [steps[left], steps[right]] = [steps[right]!, steps[left]!];
      return steps;
    };

    const cases = [
      {
        steps: swapped(spawnIndex, scriptsIndex),
        error: new CatalogContractError(
          `roomLifecycleProfiles[${profileIndex}].steps[${scriptsIndex}].kind`,
          'required objects must spawn once immediately after room entry',
        ),
      },
      {
        steps: swapped(completionIndex, outgoingIndex),
        error: new CatalogContractError(
          `roomLifecycleProfiles[${profileIndex}].steps[${completionIndex}].kind`,
          'generateOutgoingBatch requires completed required objects',
        ),
      },
    ];

    for (const fixture of cases) {
      expect(() =>
        createCatalog(
          malformedCatalog({
            ...declarations,
            roomLifecycleProfiles: declarations.roomLifecycleProfiles.map((profile) =>
              profile.key === base.key ? { ...base, steps: fixture.steps } : profile,
            ),
          }),
        ),
      ).toThrowError(fixture.error);
    }
  });
});
