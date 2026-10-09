import type { ExecutionStartingLoadout } from '../model';
import { array, exact, fail, object, stringValue } from './primitives';
import { hexGodSent, hexTreeNodes } from './rewards';

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

export function startingLoadout(value: unknown): ExecutionStartingLoadout {
  const record = object(value, 'execution plan.startingLoadout');
  exact(
    record,
    ['weaponKey', 'arcana', 'fear'],
    ['aspectKey', 'startingHex'],
    'execution plan.startingLoadout',
  );
  const weaponKey = stringValue(record.weaponKey, 'execution plan.startingLoadout.weaponKey');
  const aspectKey =
    record.aspectKey === undefined
      ? undefined
      : stringValue(record.aspectKey, 'execution plan.startingLoadout.aspectKey');
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
      ['spellTraitKey', 'layoutKey', 'nodes'],
      ['godSent'],
      'execution plan.startingLoadout.startingHex',
    );
    if (hex.spellTraitKey !== 'SpellMoonBeamTrait')
      fail('execution plan.startingLoadout.startingHex.spellTraitKey is unsupported');
    const nodes = hexTreeNodes(hex.nodes, 'execution plan.startingLoadout.startingHex.nodes');
    const godSent = hexGodSent(
      hex.godSent,
      nodes,
      'execution plan.startingLoadout.startingHex.godSent',
    );
    startingHex = Object.freeze({
      spellTraitKey: 'SpellMoonBeamTrait',
      layoutKey: stringValue(hex.layoutKey, 'execution plan.startingLoadout.startingHex.layoutKey'),
      nodes,
      ...(godSent === undefined ? {} : { godSent }),
    });
  }
  return Object.freeze({
    weaponKey,
    ...(aspectKey === undefined ? {} : { aspectKey }),
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
