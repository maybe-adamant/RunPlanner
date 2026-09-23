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
  exact(row, ['decisionKey', 'kind'], ['baseRoll', 'waveCount', 'highlight', 'waves'], label);
  if (row.kind !== 'generated') fail(`${label}.kind is unsupported`);
  const waveCount =
    row.waveCount === undefined ? undefined : ordinal(row.waveCount, `${label}.waveCount`);
  const baseRoll =
    row.baseRoll === undefined ? undefined : integer(row.baseRoll, `${label}.baseRoll`, 0);
  if (baseRoll !== undefined && baseRoll > 10000) fail(`${label}.baseRoll exceeds 10000`);
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
            exact(wave, ['waveIndex', 'types'], ['allocations'], path);
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
            const allocations =
              wave.allocations === undefined
                ? undefined
                : Object.freeze(
                    Object.fromEntries(
                      Object.entries(object(wave.allocations, `${path}.allocations`)).map(
                        ([key, value]) => {
                          const allocation = numberValue(value, `${path}.allocations.${key}`);
                          if (allocation < 0) fail(`${path}.allocations must be nonnegative`);
                          return [key, allocation];
                        },
                      ),
                    ),
                  );
            if (
              allocations !== undefined &&
              Object.keys(allocations).some((key) => !types.some((type) => type.nativeId === key))
            )
              fail(`${path}.allocations must name generated types`);
            return Object.freeze({
              waveIndex,
              types,
              ...(allocations === undefined ? {} : { allocations }),
            });
          }),
        );
  if (
    waves?.length === 0 ||
    (baseRoll === undefined &&
      waveCount === undefined &&
      highlight === undefined &&
      waves === undefined)
  )
    fail(`${label} has no active override`);
  return Object.freeze({
    decisionKey: stringValue(row.decisionKey, `${label}.decisionKey`),
    kind: 'generated',
    ...(baseRoll === undefined ? {} : { baseRoll }),
    ...(waveCount === undefined ? {} : { waveCount }),
    ...(highlight === undefined ? {} : { highlight }),
    ...(waves === undefined ? {} : { waves }),
  });
}
