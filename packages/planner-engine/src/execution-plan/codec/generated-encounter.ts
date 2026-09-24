import type { ExecutionGeneratedEncounterCustomization } from '../model';
import { array, exact, fail, integer, object, stringValue } from './primitives';

function ordinal(value: unknown, label: string): number {
  const result = integer(value, label, 1);
  if (result > 4) fail(`${label} exceeds four waves`);
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
  exact(
    row,
    ['decisionKey', 'kind', 'waveCount', 'waves'],
    ['baseRoll', 'highlight', 'fangs', 'menace'],
    label,
  );
  if (row.kind !== 'generated') fail(`${label}.kind is unsupported`);
  const waveCount = ordinal(row.waveCount, `${label}.waveCount`);
  const baseRoll =
    row.baseRoll === undefined ? undefined : integer(row.baseRoll, `${label}.baseRoll`, 0);
  if (baseRoll !== undefined && baseRoll > 10000) fail(`${label}.baseRoll exceeds 10000`);
  const highlight =
    row.highlight === undefined ? undefined : enemy(row.highlight, `${label}.highlight`);
  const fangs =
    row.fangs === undefined
      ? undefined
      : (() => {
          const entry = object(row.fangs, `${label}.fangs`);
          exact(entry, ['type', 'perks'], [], `${label}.fangs`);
          const perks = Object.freeze(
            array(entry.perks, `${label}.fangs.perks`, 2).map((perk, index) =>
              stringValue(perk, `${label}.fangs.perks[${index}]`),
            ),
          );
          if (new Set(perks).size !== perks.length) fail(`${label}.fangs.perks must be distinct`);
          return Object.freeze({ type: enemy(entry.type, `${label}.fangs.type`), perks });
        })();
  if (waveCount === 1 && highlight !== undefined) fail(`${label} cannot highlight a single wave`);
  const menace = Object.freeze(
    (row.menace === undefined ? [] : array(row.menace, `${label}.menace`, 4)).map(
      (value, index) => {
        const entry = object(value, `${label}.menace[${index}]`);
        exact(entry, ['waveIndex', 'conversions'], [], `${label}.menace[${index}]`);
        const conversions = Object.freeze(
          array(entry.conversions, `${label}.menace[${index}].conversions`, 5).map(
            (conversion, conversionIndex) => {
              const item = object(
                conversion,
                `${label}.menace[${index}].conversions[${conversionIndex}]`,
              );
              exact(
                item,
                ['source', 'count'],
                ['target'],
                `${label}.menace[${index}].conversions[${conversionIndex}]`,
              );
              const count = integer(
                item.count,
                `${label}.menace[${index}].conversions[${conversionIndex}].count`,
                0,
              );
              if (count > 0 && item.target === undefined)
                fail(
                  `${label}.menace[${index}].conversions[${conversionIndex}] requires target for a positive conversion`,
                );
              return Object.freeze({
                source: enemy(
                  item.source,
                  `${label}.menace[${index}].conversions[${conversionIndex}].source`,
                ),
                count,
                ...(item.target === undefined
                  ? {}
                  : {
                      target: enemy(
                        item.target,
                        `${label}.menace[${index}].conversions[${conversionIndex}].target`,
                      ),
                    }),
              });
            },
          ),
        );
        if (
          new Set(conversions.map((conversion) => conversion.source.nativeId)).size !==
          conversions.length
        )
          fail(`${label}.menace[${index}].conversions must have distinct sources`);
        return Object.freeze({
          waveIndex: ordinal(entry.waveIndex, `${label}.menace[${index}].waveIndex`),
          conversions,
        });
      },
    ),
  );
  const seen = new Set<number>();
  const waves =
    row.waves === undefined
      ? undefined
      : Object.freeze(
          array(row.waves, `${label}.waves`, 5).map((value, index) => {
            const path = `${label}.waves[${index}]`;
            const wave = object(value, path);
            exact(wave, ['waveIndex', 'types', 'counts'], [], path);
            const waveIndex = ordinal(wave.waveIndex, `${path}.waveIndex`);
            if (seen.has(waveIndex) || waveIndex !== index + 1 || waveIndex > waveCount)
              fail(`${path} has duplicate or out-of-range wave index`);
            seen.add(waveIndex);
            const types = Object.freeze(
              array(wave.types, `${path}.types`, 5).map((value, index) => {
                const entryPath = `${path}.types[${index}]`;
                const entry = object(value, entryPath);
                exact(entry, ['choiceKey', 'nativeId', 'source'], [], entryPath);
                const source = entry.source;
                if (
                  source !== 'fixed' &&
                  source !== 'template' &&
                  source !== 'highlight' &&
                  source !== 'addition'
                )
                  fail(`${entryPath}.source is invalid`);
                return Object.freeze({
                  ...enemy({ choiceKey: entry.choiceKey, nativeId: entry.nativeId }, entryPath),
                  source,
                });
              }),
            );
            if (
              types.length === 0 ||
              new Set(types.map((type) => type.choiceKey)).size !== types.length ||
              new Set(types.map((type) => type.nativeId)).size !== types.length
            )
              fail(`${path} requires distinct generated types`);
            const highlights = types.filter((entry) => entry.source === 'highlight');
            if (
              (highlight === undefined && highlights.length !== 0) ||
              (highlight !== undefined &&
                (highlights.length !== 1 ||
                  types[0]?.source !== 'highlight' ||
                  types[0]?.choiceKey !== highlight.choiceKey ||
                  types[0]?.nativeId !== highlight.nativeId))
            )
              fail(`${path} must have exactly its declared highlight first`);
            const counts = Object.freeze(
              Object.fromEntries(
                Object.entries(object(wave.counts, `${path}.counts`)).map(([key, value]) => {
                  const count = integer(value, `${path}.counts.${key}`, 1);
                  return [key, count];
                }),
              ),
            );
            if (
              Object.keys(counts).length !== types.length ||
              Object.keys(counts).some((key) => !types.some((type) => type.nativeId === key))
            )
              fail(`${path}.counts must exactly name generated types`);
            return Object.freeze({
              waveIndex,
              types,
              counts,
            });
          }),
        );
  if (waves === undefined || waves.length !== waveCount) fail(`${label} must cover all waves`);
  if (new Set(menace.map((entry) => entry.waveIndex)).size !== menace.length)
    fail(`${label}.menace must have distinct wave indices`);
  for (const menaceWave of menace) {
    const wave = waves.find((candidate) => candidate.waveIndex === menaceWave.waveIndex);
    if (wave === undefined) fail(`${label}.menace has an unknown wave`);
    for (const conversion of menaceWave.conversions) {
      const source = wave.types.find(
        (entry) =>
          entry.nativeId === conversion.source.nativeId &&
          entry.choiceKey === conversion.source.choiceKey,
      );
      if (source === undefined || conversion.count > (wave.counts[conversion.source.nativeId] ?? 0))
        fail(`${label}.menace conversion exceeds its source request`);
    }
  }
  if (
    fangs !== undefined &&
    !waves.some((wave) =>
      wave.types.some(
        (entry) =>
          entry.choiceKey === fangs.type.choiceKey && entry.nativeId === fangs.type.nativeId,
      ),
    )
  )
    fail(`${label}.fangs.type must be in the published roster`);
  return Object.freeze({
    decisionKey: stringValue(row.decisionKey, `${label}.decisionKey`),
    kind: 'generated',
    ...(baseRoll === undefined ? {} : { baseRoll }),
    waveCount,
    ...(highlight === undefined ? {} : { highlight }),
    ...(fangs === undefined ? {} : { fangs }),
    ...(row.menace === undefined ? {} : { menace }),
    waves,
  });
}
