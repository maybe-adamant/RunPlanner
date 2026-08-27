import type {
  ChaosBlessingDeclaration,
  ChaosCurseDeclaration,
  ChaosTraitCatalog,
  TraitElement,
} from '@run-planner/engine/catalog-schema';

import { createCollection, requireArray, requireNonEmpty, requireObject } from './common';
import { fail } from './errors';
import type { RawTraitCatalogInput } from '../declarations/traits';

const ELEMENTS = ['Aether', 'Earth', 'Air', 'Fire', 'Water'] as const;
const CHAOS_CLOCKS = ['encounters', 'locations', 'godBoonScreens'] as const;
const CHAOS_TAGS = ['Creation', 'Favor', 'Ordinary', 'Rejected', 'Barren'] as const;
const CHAOS_RARITIES = ['Common', 'Rare', 'Epic', 'Heroic'] as const;

function closedValue<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  path: string,
): Values[number] {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    fail(path, `must be one of ${values.join(', ')}`);
  }
  return value as Values[number];
}

function normalizeChaosOperand(raw: unknown, path: string) {
  const value = requireObject(raw, path);
  const allowed = new Set([
    'key',
    'label',
    'minimum',
    'maximum',
    'step',
    'authoringDefault',
    'integer',
    'byRarity',
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) fail(path, 'has an unknown operand key');
  const key = requireNonEmpty(value.key as string, `${path}.key`);
  const label = requireNonEmpty(value.label as string, `${path}.label`);
  const minimum = value.minimum;
  const maximum = value.maximum;
  const step = value.step;
  if (
    typeof minimum !== 'number' ||
    typeof maximum !== 'number' ||
    typeof step !== 'number' ||
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    !Number.isFinite(step) ||
    maximum < minimum ||
    step <= 0
  )
    fail(path, 'requires finite minimum, maximum, and positive step');
  const expectedDefault = Number(
    (minimum + Math.floor((maximum - minimum) / 2 / step + 0.5 + 1e-9) * step).toFixed(12),
  );
  if (
    typeof value.authoringDefault !== 'number' ||
    !Number.isFinite(value.authoringDefault) ||
    Math.abs(value.authoringDefault - expectedDefault) > 1e-8
  )
    fail(
      `${path}.authoringDefault`,
      `must be the legal midpoint snapped to step (${expectedDefault})`,
    );
  const integer = value.integer;
  if (integer !== undefined && integer !== true)
    fail(`${path}.integer`, 'must be true when present');
  const byRarity = value.byRarity;
  if (byRarity === undefined)
    return Object.freeze({
      key,
      label,
      minimum,
      maximum,
      step,
      authoringDefault: value.authoringDefault,
      ...(integer === true ? { integer: true as const } : {}),
    });
  const rawDomains = requireObject(byRarity, `${path}.byRarity`);
  if (
    Object.keys(rawDomains).length !== CHAOS_RARITIES.length ||
    CHAOS_RARITIES.some((rarity) => rawDomains[rarity] === undefined)
  )
    fail(`${path}.byRarity`, 'must declare exact Common, Rare, Epic, and Heroic domains');
  const domains = Object.fromEntries(
    CHAOS_RARITIES.map((rarity) => {
      const domain = requireObject(rawDomains[rarity], `${path}.byRarity.${rarity}`);
      if (
        Object.keys(domain).some(
          (key) => !['minimum', 'maximum', 'step', 'authoringDefault', 'integer'].includes(key),
        )
      )
        fail(`${path}.byRarity.${rarity}`, 'has an unknown domain key');
      const domainMinimum = domain.minimum;
      const domainMaximum = domain.maximum;
      const domainStep = domain.step;
      if (
        typeof domainMinimum !== 'number' ||
        typeof domainMaximum !== 'number' ||
        typeof domainStep !== 'number' ||
        !Number.isFinite(domainMinimum) ||
        !Number.isFinite(domainMaximum) ||
        !Number.isFinite(domainStep) ||
        domainMaximum < domainMinimum ||
        domainStep <= 0
      )
        fail(`${path}.byRarity.${rarity}`, 'requires finite minimum, maximum, and positive step');
      const expectedDomainDefault = Number(
        (
          domainMinimum +
          Math.floor((domainMaximum - domainMinimum) / 2 / domainStep + 0.5 + 1e-9) * domainStep
        ).toFixed(12),
      );
      if (
        typeof domain.authoringDefault !== 'number' ||
        !Number.isFinite(domain.authoringDefault) ||
        Math.abs(domain.authoringDefault - expectedDomainDefault) > 1e-8
      )
        fail(
          `${path}.byRarity.${rarity}.authoringDefault`,
          `must be the legal midpoint snapped to step (${expectedDomainDefault})`,
        );
      if (domain.integer !== undefined && domain.integer !== true)
        fail(`${path}.byRarity.${rarity}.integer`, 'must be true when present');
      return [
        rarity,
        Object.freeze({
          minimum: domainMinimum,
          maximum: domainMaximum,
          step: domainStep,
          authoringDefault: domain.authoringDefault,
          ...(domain.integer === true ? { integer: true as const } : {}),
        }),
      ];
    }),
  );
  return Object.freeze({
    key,
    label,
    minimum,
    maximum,
    step,
    authoringDefault: value.authoringDefault,
    ...(integer === true ? { integer: true as const } : {}),
    byRarity: Object.freeze(domains),
  });
}

/** Chaos pair availability is declaration-owned, but intentionally much
 * narrower than the general trait requirement language. Keep its raw input
 * closed at the catalog boundary so malformed checkpoints cannot smuggle a
 * made-up condition into the engine. */
function normalizeChaosOfferRequirements(
  raw: unknown,
  path: string,
): readonly import('@run-planner/engine/catalog-schema').ChaosOfferRequirement[] {
  const values = requireArray(raw, path);
  return Object.freeze(
    values.map((entry, index) => {
      const entryPath = `${path}[${index}]`;
      const value = requireObject(entry, entryPath);
      const kind = value.kind;
      if (kind === 'matureChaosBlessing') {
        if (Object.keys(value).length !== 1) fail(entryPath, 'must contain only kind');
        return Object.freeze({ kind: 'matureChaosBlessing' as const });
      }
      if (kind === 'elementMinimum') {
        if (
          Object.keys(value).length !== 3 ||
          !ELEMENTS.includes(value.element as (typeof ELEMENTS)[number]) ||
          !Number.isInteger(value.minimum) ||
          (value.minimum as number) < 1
        )
          fail(entryPath, 'requires one known element and a positive integer minimum');
        return Object.freeze({
          kind: 'elementMinimum' as const,
          element: value.element as TraitElement,
          minimum: value.minimum as number,
        });
      }
      if (kind === 'notKeepsake' || kind === 'notAspect') {
        const field = kind === 'notKeepsake' ? 'keepsakeKey' : 'aspectKey';
        if (
          Object.keys(value).length !== 2 ||
          typeof value[field] !== 'string' ||
          (value[field] as string).length === 0
        )
          fail(entryPath, `requires exactly kind and ${field}`);
        return Object.freeze(
          kind === 'notKeepsake'
            ? { kind: 'notKeepsake' as const, keepsakeKey: value.keepsakeKey as string }
            : { kind: 'notAspect' as const, aspectKey: value.aspectKey as string },
        );
      }
      if (kind === 'routeKey') {
        if (Object.keys(value).length !== 2 || value.routeKey !== 'Underworld')
          fail(entryPath, 'requires exactly Underworld routeKey');
        return Object.freeze({ kind: 'routeKey' as const, routeKey: 'Underworld' as const });
      }
      fail(entryPath, 'has an unknown Chaos offer requirement kind');
    }),
  );
}

function normalizeChaosDerivedOutcome(raw: unknown, path: string) {
  const value = requireObject(raw, path);
  const table = (key: string) => {
    const values = requireObject(value[key], `${path}.${key}`);
    if (
      Object.keys(values).length !== CHAOS_RARITIES.length ||
      CHAOS_RARITIES.some((rarity) => typeof values[rarity] !== 'number')
    )
      fail(`${path}.${key}`, 'requires exact Common, Rare, Epic, and Heroic numeric values');
    return Object.freeze(
      Object.fromEntries(CHAOS_RARITIES.map((rarity) => [rarity, values[rarity] as number])),
    );
  };
  switch (value.kind) {
    case 'creation':
      if (Object.keys(value).length !== 2) fail(path, 'Creation outcome has unknown keys');
      return Object.freeze({
        kind: 'creation' as const,
        elementsPerElementByRarity: table('elementsPerElementByRarity'),
      });
    case 'celerity':
      if (Object.keys(value).length !== 4) fail(path, 'Celerity outcome has unknown keys');
      return Object.freeze({
        kind: 'celerity' as const,
        moveSpeedPercentByRarity: table('moveSpeedPercentByRarity'),
        sprintVelocityByRarity: table('sprintVelocityByRarity'),
        sprintCapByRarity: table('sprintCapByRarity'),
      });
    case 'chant':
      if (Object.keys(value).length !== 2) fail(path, 'Chant outcome has unknown keys');
      return Object.freeze({
        kind: 'chant' as const,
        damagePerAetherPercentByRarity: table('damagePerAetherPercentByRarity'),
      });
    case 'defiance':
      if (
        Object.keys(value).length !== 3 ||
        value.healthPercent !== 40 ||
        value.magickPercent !== 40
      )
        fail(path, 'Defiance outcome requires exact 40 percent health and magick');
      return Object.freeze({
        kind: 'defiance' as const,
        healthPercent: 40 as const,
        magickPercent: 40 as const,
      });
    default:
      fail(`${path}.kind`, 'must be a known fixed Chaos outcome');
  }
}

export function normalizeChaos(input: RawTraitCatalogInput['chaos']): ChaosTraitCatalog {
  const curses = requireArray(input.curses, 'chaos.curses');
  const blessings = requireArray(input.blessings, 'chaos.blessings');
  if (curses.length !== 17 || blessings.length !== 16)
    fail('chaos', 'requires exactly 17 curses and 16 blessings');
  const normalizedCurses = curses.map((raw, index) => {
    const value = requireObject(raw, `chaos.curses[${index}]`);
    if (
      Object.keys(value).some(
        (key) =>
          ![
            'key',
            'label',
            'clock',
            'duration',
            'operands',
            'semanticTag',
            'offerRequirements',
          ].includes(key),
      )
    )
      fail(`chaos.curses[${index}]`, 'has an unknown declaration key');
    const key = requireNonEmpty(value.key as string, `chaos.curses[${index}].key`);
    const label = requireNonEmpty(value.label as string, `chaos.curses[${index}].label`);
    const clock = closedValue(value.clock, CHAOS_CLOCKS, `chaos.curses[${index}].clock`);
    const duration = normalizeChaosOperand(value.duration, `chaos.curses[${index}].duration`);
    if (
      duration.key !== 'duration' ||
      duration.integer !== true ||
      Object.hasOwn(duration, 'byRarity')
    )
      fail(
        `chaos.curses[${index}].duration`,
        'must be one rarity-independent integer duration operand',
      );
    const operands = requireArray(value.operands, `chaos.curses[${index}].operands`).map(
      (operand, operandIndex) =>
        normalizeChaosOperand(operand, `chaos.curses[${index}].operands[${operandIndex}]`),
    );
    if (new Set(operands.map((operand) => operand.key)).size !== operands.length)
      fail(`chaos.curses[${index}].operands`, 'contains a duplicate operand key');
    const semanticTag =
      value.semanticTag === undefined
        ? undefined
        : closedValue(value.semanticTag, CHAOS_TAGS, `chaos.curses[${index}].semanticTag`);
    return Object.freeze({
      key,
      label,
      clock,
      duration,
      operands: Object.freeze(operands),
      ...(semanticTag === undefined ? {} : { semanticTag }),
      ...(value.offerRequirements === undefined
        ? {}
        : {
            offerRequirements: normalizeChaosOfferRequirements(
              value.offerRequirements,
              `chaos.curses[${index}].offerRequirements`,
            ),
          }),
    });
  });
  const normalizedBlessings = blessings.map((raw, index) => {
    const value = requireObject(raw, `chaos.blessings[${index}]`);
    if (
      Object.keys(value).some(
        (key) =>
          ![
            'key',
            'label',
            'operands',
            'semanticTag',
            'fixedRarity',
            'offerRequirements',
            'derivedOutcome',
          ].includes(key),
      )
    )
      fail(`chaos.blessings[${index}]`, 'has an unknown declaration key');
    const key = requireNonEmpty(value.key as string, `chaos.blessings[${index}].key`);
    const label = requireNonEmpty(value.label as string, `chaos.blessings[${index}].label`);
    const operands = requireArray(value.operands, `chaos.blessings[${index}].operands`).map(
      (operand, operandIndex) =>
        normalizeChaosOperand(operand, `chaos.blessings[${index}].operands[${operandIndex}]`),
    );
    if (new Set(operands.map((operand) => operand.key)).size !== operands.length)
      fail(`chaos.blessings[${index}].operands`, 'contains a duplicate operand key');
    const semanticTag =
      value.semanticTag === undefined
        ? undefined
        : closedValue(value.semanticTag, CHAOS_TAGS, `chaos.blessings[${index}].semanticTag`);
    if (value.fixedRarity !== undefined && value.fixedRarity !== 'Legendary')
      fail(`chaos.blessings[${index}].fixedRarity`, 'must be Legendary');
    return Object.freeze({
      key,
      label,
      operands: Object.freeze(operands),
      ...(semanticTag === undefined ? {} : { semanticTag }),
      ...(value.fixedRarity === undefined ? {} : { fixedRarity: 'Legendary' as const }),
      ...(value.derivedOutcome === undefined
        ? {}
        : {
            derivedOutcome: normalizeChaosDerivedOutcome(
              value.derivedOutcome,
              `chaos.blessings[${index}].derivedOutcome`,
            ),
          }),
      ...(value.offerRequirements === undefined
        ? {}
        : {
            offerRequirements: normalizeChaosOfferRequirements(
              value.offerRequirements,
              `chaos.blessings[${index}].offerRequirements`,
            ),
          }),
    });
  });
  const expectedTags = new Map([
    ['ChaosElementalBlessing', 'Creation'],
    ['ChaosRarityBlessing', 'Favor'],
    ['ChaosCommonCurse', 'Ordinary'],
    ['ChaosRestrictBoonCurse', 'Rejected'],
    ['ChaosMetaUpgradeCurse', 'Barren'],
  ]);
  for (const entry of [...normalizedCurses, ...normalizedBlessings]) {
    const expected = expectedTags.get(entry.key);
    if (entry.semanticTag !== expected)
      fail(`chaos.${entry.key}.semanticTag`, 'must be present only on its exact semantic identity');
  }
  for (const entry of normalizedBlessings) {
    if ((entry.fixedRarity === 'Legendary') !== (entry.key === 'ChaosLastStandBlessing'))
      fail(`chaos.${entry.key}.fixedRarity`, 'is owned only by Defiance');
  }
  const expectedOutcomes = new Map<string, unknown>([
    [
      'ChaosElementalBlessing',
      { kind: 'creation', elementsPerElementByRarity: { Common: 1, Rare: 2, Epic: 3, Heroic: 4 } },
    ],
    [
      'ChaosSpeedBlessing',
      {
        kind: 'celerity',
        moveSpeedPercentByRarity: { Common: 15, Rare: 20, Epic: 25, Heroic: 30 },
        sprintVelocityByRarity: { Common: 297, Rare: 396, Epic: 495, Heroic: 594 },
        sprintCapByRarity: { Common: 133.5, Rare: 178, Epic: 222.5, Heroic: 267 },
      },
    ],
    [
      'ChaosOmegaDamageBlessing',
      {
        kind: 'chant',
        damagePerAetherPercentByRarity: { Common: 30, Rare: 36, Epic: 42, Heroic: 48 },
      },
    ],
    ['ChaosLastStandBlessing', { kind: 'defiance', healthPercent: 40, magickPercent: 40 }],
  ]);
  for (const entry of normalizedBlessings) {
    const expected = expectedOutcomes.get(entry.key);
    if (JSON.stringify(entry.derivedOutcome) !== JSON.stringify(expected))
      fail(`chaos.${entry.key}.derivedOutcome`, 'is owned only by its exact fixed Chaos identity');
    if (expected !== undefined && entry.operands.length !== 0)
      fail(`chaos.${entry.key}.operands`, 'fixed Chaos outcomes cannot own authored operands');
  }
  return Object.freeze({
    curses: createCollection(
      normalizedCurses as readonly ChaosCurseDeclaration[],
      'chaos.curses',
      (curse) => curse.key,
    ),
    blessings: createCollection(
      normalizedBlessings as readonly ChaosBlessingDeclaration[],
      'chaos.blessings',
      (blessing) => blessing.key,
    ),
  });
}
