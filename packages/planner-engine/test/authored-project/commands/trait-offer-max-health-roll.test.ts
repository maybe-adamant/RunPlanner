import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  ProjectCommandContractError,
  resolveTraitMaxHealthRoll,
  traitMaxHealthRollDomain,
  traitMaxHealthRollWidth,
  type AuthoredTraitOfferTraits,
  type AuthoredTraitOption,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { decodeEchoLastRunBoon } from '../../../src/authored-project/room-state/decoding/echo-last-run-codec';
import { normalizeAuthoredEchoLastRunBoon } from '../../../src/authored-project/traits/state';
import { loadSurfaceNOPProject, pBiome, pOccurrenceId } from '@run-planner/test-fixtures/surface';

const occurrenceId = pOccurrenceId('P_Story01', 7, 1);
const trait = createTraitOfferAddress(
  createEncounterPhaseAddress(pBiome, { kind: 'occurrence', occurrenceId }, 'Encounter'),
  'selection',
);

function dionysusOffer(project: ProjectDocument): AuthoredTraitOfferTraits {
  const offer = project.route.biomes
    .find((biome) => biome.biomeKey === 'P')
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId)?.encounters
    .traitOffersByPhase?.Encounter?.Story_Dionysus_01;
  if (offer?.kind !== 'traits') throw new Error('missing Dionysus Story offer');
  return offer;
}

function worryFree(project: ProjectDocument): AuthoredTraitOption {
  const option = dionysusOffer(project).options[1];
  if (option?.traitKey !== 'HiddenMaxHealthBoon') throw new Error('missing Worry Free row');
  return option;
}

function withWorryFree(
  project: ProjectDocument,
  patch: Partial<AuthoredTraitOption>,
): ProjectDocument {
  const offer = dionysusOffer(project);
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait,
    value: {
      ...offer,
      options: offer.options.map((option, index) =>
        index === 1 ? { ...option, ...patch } : option,
      ) as unknown as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option2',
    },
  });
}

describe('Worry Free max-health roll', () => {
  it('resolves the offset above the acquired rarity minimum, including a rarified acquisition', () => {
    expect(traitMaxHealthRollWidth(catalog, 'HiddenMaxHealthBoon')).toBe(30);
    expect(traitMaxHealthRollDomain(catalog, 'HiddenMaxHealthBoon', 'Epic')).toEqual({
      minimum: 90,
      maximum: 120,
    });
    expect(traitMaxHealthRollDomain(catalog, 'CastLobBoon', 'Epic')).toBeUndefined();
    expect(resolveTraitMaxHealthRoll(catalog, 'HiddenMaxHealthBoon', 'Rare', undefined)).toBe(70);
    expect(resolveTraitMaxHealthRoll(catalog, 'HiddenMaxHealthBoon', 'Rare', 30)).toBe(100);
    // Offered at Epic, rarified to Heroic before acquisition: the same offset rides along.
    expect(resolveTraitMaxHealthRoll(catalog, 'HiddenMaxHealthBoon', 'Epic', 12)).toBe(102);
    expect(resolveTraitMaxHealthRoll(catalog, 'HiddenMaxHealthBoon', 'Heroic', 12)).toBe(122);
  });

  it('defaults to no stored offset and persists a set offset through the codec', () => {
    const project = loadSurfaceNOPProject();
    expect(worryFree(project)).not.toHaveProperty('maxHealthRoll');

    const rolled = withWorryFree(project, { maxHealthRoll: 14 });
    expect(worryFree(rolled).maxHealthRoll).toBe(14);
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(rolled)), catalog)).toEqual(
      rolled,
    );

    const minimum = withWorryFree(rolled, { maxHealthRoll: 0 });
    expect(worryFree(minimum)).not.toHaveProperty('maxHealthRoll');
  });

  it('keeps the offset unchanged when the offered rarity changes', () => {
    const project = withWorryFree(loadSurfaceNOPProject(), { maxHealthRoll: 14 });
    const epic = withWorryFree(project, { rarity: 'Epic' });
    expect(worryFree(epic)).toMatchObject({ rarity: 'Epic', maxHealthRoll: 14 });
  });

  it.each([0, 30] as const)('decodes the boundary offset %s', (offset) => {
    const raw = JSON.parse(encodeProjectDocument(loadSurfaceNOPProject())) as unknown;
    rawWorryFree(raw).maxHealthRoll = offset;
    const option = worryFree(decodeProjectDocument(raw, catalog));
    if (offset === 0) expect(option).not.toHaveProperty('maxHealthRoll');
    else expect(option.maxHealthRoll).toBe(offset);
  });

  it.each([-1, 31, 4.5, '14'] as const)('rejects the unrepresentable offset %s', (offset) => {
    const project = loadSurfaceNOPProject();
    expect(() => withWorryFree(project, { maxHealthRoll: offset as number })).toThrow(
      ProjectCommandContractError,
    );
    const raw = JSON.parse(encodeProjectDocument(project)) as unknown;
    rawWorryFree(raw).maxHealthRoll = offset;
    expect(() => decodeProjectDocument(raw, catalog)).toThrow(/maxHealthRoll/);
  });

  it('carries an offset on an Echo Boon Boon Boon Worry Free row', () => {
    const row = {
      giverKey: 'Dionysus',
      traitKey: 'HiddenMaxHealthBoon',
      rarity: 'Heroic',
    } as const;
    const normalized = normalizeAuthoredEchoLastRunBoon(catalog, {
      options: [{ ...row, maxHealthRoll: 9 }],
      selectedOptionKey: 'option1',
    });
    expect(normalized.options[0]).toEqual({ ...row, maxHealthRoll: 9 });
    expect(
      normalizeAuthoredEchoLastRunBoon(catalog, {
        options: [{ ...row, maxHealthRoll: 0 }],
        selectedOptionKey: 'option1',
      }).options[0],
    ).toEqual(row);
    expect(() =>
      normalizeAuthoredEchoLastRunBoon(catalog, {
        options: [{ ...row, maxHealthRoll: 31 }],
        selectedOptionKey: 'option1',
      }),
    ).toThrow('max-health roll');
    expect(
      decodeEchoLastRunBoon(
        { options: [{ ...row, maxHealthRoll: 9 }], selectedOptionKey: 'option1' },
        catalog,
        '$.echo',
      ),
    ).toEqual(normalized);
    expect(() =>
      decodeEchoLastRunBoon(
        { options: [{ ...row, maxHealthRoll: -1 }], selectedOptionKey: 'option1' },
        catalog,
        '$.echo',
      ),
    ).toThrow('$.echo.options.option1.maxHealthRoll');
  });

  it('rejects a roll on a trait without one', () => {
    const project = loadSurfaceNOPProject();
    const offer = dionysusOffer(project);
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceTraitOffer',
        trait,
        value: {
          ...offer,
          options: offer.options.map((option, index) =>
            index === 0 ? { ...option, maxHealthRoll: 10 } : option,
          ) as unknown as AuthoredTraitOfferTraits['options'],
        },
      }),
    ).toThrow('CastLobBoon max-health roll');
    const raw = JSON.parse(encodeProjectDocument(project)) as unknown;
    rawOptions(raw)[0]!.maxHealthRoll = 10;
    expect(() => decodeProjectDocument(raw, catalog)).toThrow('has no max-health roll');
  });
});

type JsonRecord = Record<string, unknown>;

function rawOptions(raw: unknown): JsonRecord[] {
  const biome = ((raw as JsonRecord).route as { biomes: JsonRecord[] }).biomes.find(
    (candidate) => candidate.biomeKey === 'P',
  );
  const occurrence = ((biome?.topology as JsonRecord).occurrences as JsonRecord[]).find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  const encounters = occurrence?.encounters as JsonRecord;
  const offer = ((encounters.traitOffersByPhase as JsonRecord).Encounter as JsonRecord)
    .Story_Dionysus_01 as JsonRecord;
  return offer.options as JsonRecord[];
}

function rawWorryFree(raw: unknown): JsonRecord {
  return rawOptions(raw)[1]!;
}
