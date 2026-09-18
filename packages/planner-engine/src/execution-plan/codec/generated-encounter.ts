import type { ExecutionGeneratedEncounterCustomization } from '../model';
import { array, exact, fail, integer, numberValue, object, stringValue } from './primitives';

function ordinal(value: unknown, label: string): number {
  const result = integer(value, label, 1);
  if (result > 5) fail(`${label} exceeds five waves`);
  return result;
}

function enemy(value: unknown, label: string) {
  const row = object(value, label);
  exact(row, ['choiceKey', 'nativeId'], [], label);
  return Object.freeze({
    choiceKey: stringValue(row.choiceKey, `${label}.choiceKey`),
    nativeId: stringValue(row.nativeId, `${label}.nativeId`),
  });
}

export function generatedEncounter(
  value: unknown,
  label: string,
): ExecutionGeneratedEncounterCustomization {
  const row = object(value, label);
  exact(row, ['decisionKey', 'kind'], ['waveCount', 'highlight', 'waves'], label);
  if (row.kind !== 'generated') fail(`${label}.kind is unsupported`);
  const waveCount =
    row.waveCount === undefined ? undefined : ordinal(row.waveCount, `${label}.waveCount`);
  const highlight =
    row.highlight === undefined ? undefined : enemy(row.highlight, `${label}.highlight`);
  if (waveCount === 1 && highlight !== undefined) fail(`${label} cannot highlight a single wave`);
  const seen = new Set<number>();
  const waves =
    row.waves === undefined
      ? undefined
      : Object.freeze(
          array(row.waves, `${label}.waves`, 5).map((value, index) => {
            const path = `${label}.waves[${index}]`;
            const wave = object(value, path);
            exact(wave, ['waveIndex', 'types'], ['shares'], path);
            const waveIndex = ordinal(wave.waveIndex, `${path}.waveIndex`);
            if (seen.has(waveIndex) || (waveCount !== undefined && waveIndex > waveCount))
              fail(`${path} has duplicate or out-of-range wave index`);
            seen.add(waveIndex);
            const types = Object.freeze(
              array(wave.types, `${path}.types`, 5).map((value, index) =>
                enemy(value, `${path}.types[${index}]`),
              ),
            );
            if (
              types.length === 0 ||
              new Set(types.map((type) => type.choiceKey)).size !== types.length ||
              new Set(types.map((type) => type.nativeId)).size !== types.length
            )
              fail(`${path} requires distinct generated types`);
            if (
              highlight !== undefined &&
              (types[0]?.choiceKey !== highlight.choiceKey ||
                types[0]?.nativeId !== highlight.nativeId)
            )
              fail(`${path} must seed its declared highlight first`);
            const shares =
              wave.shares === undefined
                ? undefined
                : Object.freeze(
                    array(wave.shares, `${path}.shares`, 5).map((value) => {
                      const share = numberValue(value, `${path}.shares`);
                      if (share <= 0 || share > 1)
                        fail(`${path}.shares must be positive fractions`);
                      return share;
                    }),
                  );
            if (
              shares !== undefined &&
              (types.length < 2 ||
                shares.length !== types.length ||
                Math.abs(shares.reduce((sum, share) => sum + share, 0) - 1) > 1e-9)
            )
              fail(`${path}.shares must match types and sum to one`);
            return Object.freeze({ waveIndex, types, ...(shares === undefined ? {} : { shares }) });
          }),
        );
  if (
    waves?.length === 0 ||
    (waveCount === undefined && highlight === undefined && waves === undefined)
  )
    fail(`${label} has no active override`);
  return Object.freeze({
    decisionKey: stringValue(row.decisionKey, `${label}.decisionKey`),
    kind: 'generated',
    ...(waveCount === undefined ? {} : { waveCount }),
    ...(highlight === undefined ? {} : { highlight }),
    ...(waves === undefined ? {} : { waves }),
  });
}
