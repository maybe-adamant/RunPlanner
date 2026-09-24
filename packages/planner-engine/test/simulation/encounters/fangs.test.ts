import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { assessFangs } from '../../../src/simulation/encounters/fangs';
import { assessGeneratedEncounter } from '../../../src/simulation/encounters/generation';

const generatedPolicy = (key: string) => {
  const policy = catalog.encounterDefinitions.byKey[key]!.customization![0]!.selection;
  if (policy.kind !== 'generated') throw new Error('expected generated policy');
  return policy;
};
const policy = generatedPolicy('GeneratedF');
const base = {
  kind: 'generated' as const,
  waveCount: 1,
  waves: [{ waveIndex: 1, typeKeys: ['Guard_Elite', 'Guard'] }],
};
const guard = (perkKeys: readonly string[]) => ({
  ...base,
  fangs: { typeKey: 'Guard_Elite', perkKeys },
});

describe('Fangs encounter assessment', () => {
  it('models rank zero dormant, rank-one exact length, and rank-two ordered completion', () => {
    expect(assessFangs(policy, guard(['Blink']), 0, 'F', ['Guard_Elite'])).toMatchObject({
      active: false,
      perkKeys: ['Blink'],
      next: 'unavailable',
    });
    expect(assessFangs(policy, guard(['Blink']), 1, 'F', ['Guard_Elite'])).toMatchObject({
      canFinish: true,
      next: 'finish',
    });
    expect(assessFangs(policy, guard(['Blink', 'Fog']), 1, 'F', ['Guard_Elite'])).toMatchObject({
      issue: 'perkUnavailable',
    });
    expect(assessFangs(policy, guard(['Blink', 'Fog']), 2, 'F', ['Guard_Elite'])).toMatchObject({
      canFinish: true,
    });
  });

  it('removes the selected perk and directed exclusions after each native pick', () => {
    expect(assessFangs(policy, guard(['Blink', 'Blink']), 2, 'F', ['Guard_Elite']).issue).toBe(
      'perkUnavailable',
    );
    const incompatible = [
      { typeKey: 'Guard_Elite', pair: ['Blink', 'Orbit'] as const },
      { typeKey: 'Mage_Elite', pair: ['Frenzy', 'Homing'] as const },
      { typeKey: 'Guard_Elite', pair: ['Frenzy', 'Vacuuming'] as const },
      { typeKey: 'Guard_Elite', pair: ['ExtraDamage', 'Molten'] as const },
      { typeKey: 'Brawler_Elite', pair: ['Fog', 'Metallic'] as const },
    ];
    for (const {
      typeKey,
      pair: [left, right],
    } of incompatible) {
      const options = assessFangs(
        policy,
        { kind: 'generated', fangs: { typeKey, perkKeys: [] } },
        2,
        'F',
        [typeKey],
      ).eligiblePerkKeys;
      expect(options).toEqual(expect.arrayContaining([left, right]));
      for (const pair of [
        [left, right],
        [right, left],
      ])
        expect(
          assessFangs(policy, { kind: 'generated', fangs: { typeKey, perkKeys: pair } }, 2, 'F', [
            typeKey,
          ]).issue,
        ).toBe('perkUnavailable');
    }
    const options = assessFangs(policy, guard([]), 2, 'F', ['Guard_Elite']).eligiblePerkKeys;
    const incompatiblePairs = new Set([
      'Blink|Orbit',
      'Orbit|Blink',
      'Frenzy|Homing',
      'Homing|Frenzy',
      'Frenzy|Vacuuming',
      'Vacuuming|Frenzy',
      'ExtraDamage|Molten',
      'Molten|ExtraDamage',
      'Fog|Metallic',
      'Metallic|Fog',
    ]);
    let compatibleCount = 0;
    for (const first of options)
      for (const second of options)
        if (first !== second && !incompatiblePairs.has(`${first}|${second}`)) {
          compatibleCount += 1;
          expect(
            assessFangs(policy, guard([first, second]), 2, 'F', ['Guard_Elite']).issue,
          ).toBeUndefined();
        }
    expect(compatibleCount).toBeGreaterThan(0);
  });

  it('allows native exhaustion, fixed elite seeds, and repeated composition without inventing candidates', () => {
    const despair = assessFangs(
      { ...generatedPolicy('GeneratedH_Passive'), blockFangsAttributes: false },
      { kind: 'generated', fangs: { typeKey: 'DespairElemental_Elite', perkKeys: [] } },
      2,
      'H',
      ['DespairElemental_Elite'],
    );
    expect(despair).toMatchObject({ canFinish: true, eligiblePerkKeys: [] });
    const exhausted = assessFangs(
      {
        ...policy,
        choices: policy.choices.map((choice) =>
          choice.key === 'Guard_Elite'
            ? { ...choice, fangs: { options: ['Blink', 'Orbit'], blockedOptions: [] } }
            : choice,
        ),
      },
      guard(['Blink']),
      2,
      'F',
      ['Guard_Elite'],
    );
    expect(exhausted).toMatchObject({ canFinish: true, eligiblePerkKeys: [] });
    const treant = assessFangs(
      generatedPolicy('GeneratedH_Treant2'),
      { kind: 'generated', fangs: { typeKey: 'Treant2', perkKeys: ['Blink'] } },
      1,
      'H',
      [],
    );
    expect(treant).toMatchObject({ canFinish: true });
    const repeated = assessFangs(policy, base, 1, 'F', ['Guard_Elite', 'Guard_Elite']);
    expect(repeated.eligibleTypeKeys.filter((key) => key === 'Guard_Elite')).toHaveLength(1);
  });

  it('uses only explicit resolved composition, room restrictions, IsElite, and encounter blocking', () => {
    expect(assessFangs(policy, guard(['Blink']), 1, 'F', []).issue).toBeUndefined();
    expect(assessFangs(policy, guard(['Rooting']), 1, 'N', ['Guard_Elite']).issue).toBe(
      'perkUnavailable',
    );
    const armoredPolicy = generatedPolicy('GeneratedN');
    const suffixNonElite = armoredPolicy.choices.find(
      (choice) => choice.key === 'ZombieAssassin_Elite',
    )!;
    expect(
      assessFangs(
        armoredPolicy,
        { kind: 'generated', fangs: { typeKey: suffixNonElite!.key, perkKeys: [] } },
        1,
        'N',
        [suffixNonElite.key],
      ).issue,
    ).toBeUndefined();
    expect(
      assessFangs(
        generatedPolicy('GeneratedH_Passive'),
        { kind: 'generated', fangs: { typeKey: 'DespairElemental_Elite', perkKeys: [] } },
        2,
        'H',
        ['DespairElemental_Elite'],
      ),
    ).toMatchObject({ next: 'unavailable' });
  });

  it('raises phase-owned Fangs repairs only for active invalid choices', () => {
    const invalid = assessGeneratedEncounter(
      policy,
      {
        kind: 'generated',
        waveCount: 1,
        waves: [{ waveIndex: 1, typeKeys: ['Guard_Elite', 'Brawler'] }],
        fangs: { typeKey: 'Guard_Elite', perkKeys: ['Blink', 'Orbit'] },
      },
      {
        biomeDepthCache: 3,
        biomeEncounterDepth: 0,
        knownRunBlacklist: [],
        fangsRank: 2,
        roomSetKey: 'F',
      },
    );
    expect(invalid.supported).toBe(false);
    expect(invalid.issues).toContainEqual({ reason: 'fangs', issue: 'perkUnavailable' });
    expect(invalid.operands).toBeUndefined();
    const blocked = assessGeneratedEncounter(
      generatedPolicy('GeneratedH_Passive'),
      { kind: 'generated', fangs: { typeKey: 'DespairElemental_Elite', perkKeys: [] } },
      {
        biomeDepthCache: 0,
        biomeEncounterDepth: 0,
        knownRunBlacklist: [],
        fangsRank: 2,
        roomSetKey: 'H',
      },
    );
    expect(blocked.issues.some((issue) => issue.reason === 'fangs')).toBe(false);
  });
});
