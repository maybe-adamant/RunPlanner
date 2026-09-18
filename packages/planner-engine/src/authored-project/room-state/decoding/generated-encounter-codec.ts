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
    ['kind', ...['waveCount', 'highlightKey', 'waves'].filter((key) => row[key] !== undefined)],
    path,
  );
  if (row.kind !== 'generated') failProjectDocument(path, 'must be generated customization');
  const index = (value: unknown, label: string) => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5)
      failProjectDocument(label, 'must be an integer in 1..5');
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
            ['waveIndex', 'typeKeys', ...(wave.weights === undefined ? [] : ['weights'])],
            label,
          );
          const typeKeys = expectArray(wave.typeKeys, `${label}.typeKeys`).map((key) =>
            expectNonBlankString(key, `${label}.typeKeys`),
          );
          if (typeKeys.length > 5 || new Set(typeKeys).size !== typeKeys.length)
            failProjectDocument(label, 'must contain distinct bounded types');
          const weights: Record<string, number> = {};
          if (wave.weights !== undefined) {
            for (const [key, weight] of Object.entries(
              expectRecord(wave.weights, `${label}.weights`),
            )) {
              expectNonBlankString(key, `${label}.weights`);
              if (
                typeof weight !== 'number' ||
                !Number.isFinite(weight) ||
                weight <= 0 ||
                weight > 1000
              )
                failProjectDocument(`${label}.weights.${key}`, 'must be finite in (0,1000]');
              weights[key] = weight;
            }
            if (Object.keys(weights).length < 1 || Object.keys(weights).length > 5)
              failProjectDocument(`${label}.weights`, 'requires one to five entries');
          }
          return Object.freeze({
            waveIndex: index(wave.waveIndex, `${label}.waveIndex`),
            typeKeys: Object.freeze(typeKeys),
            ...(wave.weights === undefined ? {} : { weights: Object.freeze(weights) }),
          });
        });
  if (
    waves !== undefined &&
    (waves.length < 1 ||
      waves.length > 5 ||
      new Set(waves.map((wave) => wave.waveIndex)).size !== waves.length)
  )
    failProjectDocument(`${path}.waves`, 'requires distinct sparse wave indices');
  return Object.freeze({
    kind: 'generated',
    ...(row.waveCount === undefined
      ? {}
      : { waveCount: index(row.waveCount, `${path}.waveCount`) }),
    ...(row.highlightKey === undefined
      ? {}
      : { highlightKey: expectNonBlankString(row.highlightKey, `${path}.highlightKey`) }),
    ...(waves === undefined ? {} : { waves: Object.freeze(waves) }),
  });
}
