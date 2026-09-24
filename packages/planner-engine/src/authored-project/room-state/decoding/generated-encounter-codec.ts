import type { AuthoredGeneratedEncounterCustomization } from '../../model';
import {
  expectArray,
  expectExactKeys,
  expectNonBlankString,
  expectRecord,
  failProjectDocument,
} from '../../validation';

export function decodeGeneratedEncounterCustomization(
  value: unknown,
  path: string,
): AuthoredGeneratedEncounterCustomization {
  const row = expectRecord(value, path);
  expectExactKeys(
    row,
    [
      'kind',
      ...['baseRoll', 'waveCount', 'highlightKey', 'fangs', 'waves']
        .filter((key) => row[key] !== undefined)
        .concat(row.menace === undefined ? [] : ['menace']),
    ],
    path,
  );
  if (row.kind !== 'generated') failProjectDocument(path, 'must be generated customization');
  const index = (value: unknown, label: string) => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5)
      failProjectDocument(label, 'must be an integer in 1..5');
    return value;
  };
  const baseRoll = (value: unknown, label: string) => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 10000)
      failProjectDocument(label, 'must be a bounded nonnegative integer');
    return value;
  };
  const waves =
    row.waves === undefined
      ? undefined
      : expectArray(row.waves, `${path}.waves`).map((entry, ordinal) => {
          const label = `${path}.waves[${ordinal}]`;
          const wave = expectRecord(entry, label);
          expectExactKeys(
            wave,
            ['waveIndex', 'typeKeys', ...(wave.allocations === undefined ? [] : ['allocations'])],
            label,
          );
          const typeKeys = expectArray(wave.typeKeys, `${label}.typeKeys`).map((key) =>
            expectNonBlankString(key, `${label}.typeKeys`),
          );
          if (typeKeys.length > 5 || new Set(typeKeys).size !== typeKeys.length)
            failProjectDocument(label, 'must contain distinct bounded types');
          const allocations: Record<string, number> = {};
          if (wave.allocations !== undefined) {
            for (const [key, allocation] of Object.entries(
              expectRecord(wave.allocations, `${label}.allocations`),
            )) {
              expectNonBlankString(key, `${label}.allocations`);
              if (typeof allocation !== 'number' || !Number.isFinite(allocation) || allocation < 0)
                failProjectDocument(
                  `${label}.allocations.${key}`,
                  'must be finite and nonnegative',
                );
              allocations[key] = allocation;
            }
            if (Object.keys(allocations).length < 1 || Object.keys(allocations).length > 5)
              failProjectDocument(`${label}.allocations`, 'requires one to five entries');
          }
          return Object.freeze({
            waveIndex: index(wave.waveIndex, `${label}.waveIndex`),
            typeKeys: Object.freeze(typeKeys),
            ...(wave.allocations === undefined ? {} : { allocations: Object.freeze(allocations) }),
          });
        });
  const fangs =
    row.fangs === undefined
      ? undefined
      : (() => {
          const entry = expectRecord(row.fangs, `${path}.fangs`);
          expectExactKeys(entry, ['typeKey', 'perkKeys'], `${path}.fangs`);
          const perkKeys = expectArray(entry.perkKeys, `${path}.fangs.perkKeys`).map((key) =>
            expectNonBlankString(key, `${path}.fangs.perkKeys`),
          );
          if (perkKeys.length > 2 || new Set(perkKeys).size !== perkKeys.length)
            failProjectDocument(`${path}.fangs.perkKeys`, 'requires zero to two distinct perks');
          return Object.freeze({
            typeKey: expectNonBlankString(entry.typeKey, `${path}.fangs.typeKey`),
            perkKeys: Object.freeze(perkKeys),
          });
        })();
  const menace =
    row.menace === undefined
      ? undefined
      : expectArray(row.menace, `${path}.menace`).map((entry, ordinal) => {
          const label = `${path}.menace[${ordinal}]`,
            wave = expectRecord(entry, label);
          expectExactKeys(wave, ['waveIndex', 'conversions'], label);
          const conversions: Record<
            string,
            { readonly count: number; readonly targetKey?: string }
          > = {};
          for (const [key, raw] of Object.entries(
            expectRecord(wave.conversions, `${label}.conversions`),
          )) {
            const value = expectRecord(raw, `${label}.conversions.${key}`);
            expectExactKeys(
              value,
              ['count', ...(value.targetKey === undefined ? [] : ['targetKey'])],
              `${label}.conversions.${key}`,
            );
            if (
              typeof value.count !== 'number' ||
              !Number.isInteger(value.count) ||
              value.count < 0
            )
              failProjectDocument(
                `${label}.conversions.${key}.count`,
                'must be a nonnegative integer',
              );
            conversions[expectNonBlankString(key, `${label}.conversions`)] = Object.freeze({
              count: value.count,
              ...(value.targetKey === undefined
                ? {}
                : {
                    targetKey: expectNonBlankString(
                      value.targetKey,
                      `${label}.conversions.${key}.targetKey`,
                    ),
                  }),
            });
          }
          return Object.freeze({
            waveIndex: index(wave.waveIndex, `${label}.waveIndex`),
            conversions: Object.freeze(conversions),
          });
        });
  if (
    menace !== undefined &&
    (menace.length > 5 || new Set(menace.map((wave) => wave.waveIndex)).size !== menace.length)
  )
    failProjectDocument(`${path}.menace`, 'requires distinct bounded wave indices');
  if (
    waves !== undefined &&
    (waves.length < 1 ||
      waves.length > 5 ||
      new Set(waves.map((wave) => wave.waveIndex)).size !== waves.length)
  )
    failProjectDocument(`${path}.waves`, 'requires distinct sparse wave indices');
  return Object.freeze({
    kind: 'generated',
    ...(row.baseRoll === undefined ? {} : { baseRoll: baseRoll(row.baseRoll, `${path}.baseRoll`) }),
    ...(row.waveCount === undefined
      ? {}
      : { waveCount: index(row.waveCount, `${path}.waveCount`) }),
    ...(row.highlightKey === undefined
      ? {}
      : { highlightKey: expectNonBlankString(row.highlightKey, `${path}.highlightKey`) }),
    ...(fangs === undefined ? {} : { fangs }),
    ...(menace === undefined ? {} : { menace: Object.freeze(menace) }),
    ...(waves === undefined ? {} : { waves: Object.freeze(waves) }),
  });
}
