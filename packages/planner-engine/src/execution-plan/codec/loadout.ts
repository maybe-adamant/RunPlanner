import type { ExecutionStartingLoadout } from '../model';
import { array, exact, fail, object, stringArray, stringValue } from './primitives';

function ranks(value: unknown, label: string): Readonly<Record<string, number>> {
  const record = object(value, label);
  return Object.freeze(
    Object.fromEntries(
      Object.entries(record).map(([key, entry]) => {
        stringValue(key, `${label} key`);
        if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 0)
          fail(`${label}.${key} must be a non-negative integer`);
        return [key, entry];
      }),
    ),
  );
}

function distinct(
  keys: readonly string[],
  label: string,
  seen = new Set<string>(),
): readonly string[] {
  for (const key of keys) {
    if (seen.has(key)) fail(`${label} contains duplicate key ${key}`);
    seen.add(key);
  }
  return keys;
}

export function startingLoadout(value: unknown): ExecutionStartingLoadout {
  const record = object(value, 'execution plan.startingLoadout');
  exact(
    record,
    ['weaponKey', 'aspectKey', 'arcana', 'fear'],
    ['startingHex'],
    'execution plan.startingLoadout',
  );
  const weaponKey = stringValue(record.weaponKey, 'execution plan.startingLoadout.weaponKey');
  const aspectKey = stringValue(record.aspectKey, 'execution plan.startingLoadout.aspectKey');
  if (aspectKey === 'SuitHexAspect' && record.startingHex === undefined)
    fail('execution plan.startingHex is required for SuitHexAspect');
  const seenArcana = new Set<string>();
  const arcana = array(record.arcana, 'execution plan.startingLoadout.arcana').map(
    (entry, index) => {
      const row = object(entry, `execution plan.startingLoadout.arcana[${index}]`);
      exact(
        row,
        ['key', 'origin', 'rarity'],
        [],
        `execution plan.startingLoadout.arcana[${index}]`,
      );
      const key = stringValue(row.key, `execution plan.startingLoadout.arcana[${index}].key`);
      if (seenArcana.has(key))
        fail(`execution plan.startingLoadout.arcana contains duplicate key ${key}`);
      seenArcana.add(key);
      if (
        (row.origin !== 'manual' && row.origin !== 'automatic') ||
        !['Common', 'Rare', 'Epic', 'Heroic'].includes(String(row.rarity))
      )
        fail(`execution plan.startingLoadout.arcana[${index}] is unsupported`);
      return Object.freeze({
        key,
        origin: row.origin as 'manual' | 'automatic',
        rarity: row.rarity as 'Common' | 'Rare' | 'Epic' | 'Heroic',
      });
    },
  );
  const fear = object(record.fear, 'execution plan.startingLoadout.fear');
  exact(fear, ['configuredRanks', 'effectiveRanks'], [], 'execution plan.startingLoadout.fear');
  let startingHex: ExecutionStartingLoadout['startingHex'];
  if (record.startingHex !== undefined) {
    if (aspectKey !== 'SuitHexAspect') fail('execution plan.startingHex requires SuitHexAspect');
    const hex = object(record.startingHex, 'execution plan.startingLoadout.startingHex');
    exact(
      hex,
      ['spellTraitKey', 'layoutKey', 'rareTalentKeys', 'epicTalentKeys'],
      ['godSent'],
      'execution plan.startingLoadout.startingHex',
    );
    if (hex.spellTraitKey !== 'SpellMoonBeamTrait')
      fail('execution plan.startingLoadout.startingHex.spellTraitKey is unsupported');
    const seen = new Set<string>();
    const rareTalentKeys = Object.freeze([
      ...distinct(
        stringArray(
          hex.rareTalentKeys,
          'execution plan.startingLoadout.startingHex.rareTalentKeys',
        ),
        'execution plan.startingLoadout.startingHex.rareTalentKeys',
        seen,
      ),
    ]);
    const epicTalentKeys = Object.freeze([
      ...distinct(
        stringArray(
          hex.epicTalentKeys,
          'execution plan.startingLoadout.startingHex.epicTalentKeys',
        ),
        'execution plan.startingLoadout.startingHex.epicTalentKeys',
        seen,
      ),
    ]);
    let godSent:
      { readonly olympianTalentKey: string; readonly lineageTalentKey: string } | undefined;
    if (hex.godSent !== undefined) {
      const row = object(hex.godSent, 'execution plan.startingLoadout.startingHex.godSent');
      exact(
        row,
        ['olympianTalentKey', 'lineageTalentKey'],
        [],
        'execution plan.startingLoadout.startingHex.godSent',
      );
      const olympianTalentKey = stringValue(
        row.olympianTalentKey,
        'execution plan.startingLoadout.startingHex.godSent.olympianTalentKey',
      );
      const lineageTalentKey = stringValue(
        row.lineageTalentKey,
        'execution plan.startingLoadout.startingHex.godSent.lineageTalentKey',
      );
      if (
        olympianTalentKey === lineageTalentKey ||
        seen.has(olympianTalentKey) ||
        seen.has(lineageTalentKey)
      )
        fail('execution plan.startingLoadout.startingHex.godSent overlaps modeled nodes');
      godSent = Object.freeze({ olympianTalentKey, lineageTalentKey });
    }
    startingHex = Object.freeze({
      spellTraitKey: 'SpellMoonBeamTrait',
      layoutKey: stringValue(hex.layoutKey, 'execution plan.startingLoadout.startingHex.layoutKey'),
      rareTalentKeys,
      epicTalentKeys,
      ...(godSent === undefined ? {} : { godSent }),
    });
  }
  return Object.freeze({
    weaponKey,
    aspectKey,
    arcana: Object.freeze(arcana),
    fear: Object.freeze({
      configuredRanks: ranks(
        fear.configuredRanks,
        'execution plan.startingLoadout.fear.configuredRanks',
      ),
      effectiveRanks: ranks(
        fear.effectiveRanks,
        'execution plan.startingLoadout.fear.effectiveRanks',
      ),
    }),
    ...(startingHex === undefined ? {} : { startingHex }),
  });
}
