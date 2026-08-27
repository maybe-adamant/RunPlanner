import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../traits';
import type {
  ChaosBlessingDeclaration,
  ChaosCurseDeclaration,
} from '@run-planner/engine/catalog-schema';

const duration = (
  minimum: number,
  maximum: number,
  clock: ChaosCurseDeclaration['clock'],
  labelOverride?: string,
) => ({
  key: 'duration',
  label:
    labelOverride ??
    (clock === 'locations'
      ? 'locations / departures'
      : clock === 'godBoonScreens'
        ? 'god-offer resolutions'
        : 'encounters'),
  minimum,
  maximum,
  step: 1,
  authoringDefault: minimum + Math.floor((maximum - minimum) / 2 + 0.5),
  integer: true as const,
});
function authoringDefault(minimum: number, maximum: number, step: number): number {
  const midpoint = minimum + (maximum - minimum) / 2;
  const snapped = minimum + Math.floor((midpoint - minimum) / step + 0.5 + 1e-9) * step;
  return Number(snapped.toFixed(12));
}
const operand = (
  key: string,
  label: string,
  minimum: number,
  maximum: number,
  step: number,
  integer = false,
) => ({
  key,
  label,
  minimum,
  maximum,
  step,
  authoringDefault: authoringDefault(minimum, maximum, step),
  ...(integer ? { integer: true as const } : {}),
});
type ChaosRarity = 'Common' | 'Rare' | 'Epic' | 'Heroic';
type NumericDomain = readonly [minimum: number, maximum: number, step: number, integer?: true];
/** Exact post-processing domains; no Common payload may borrow a Heroic value. */
const rarityOperand = (
  key: string,
  label: string,
  domains: Readonly<Record<ChaosRarity, NumericDomain>>,
) => {
  const common = domains.Common;
  return Object.freeze({
    ...operand(key, label, common[0], common[1], common[2], common[3] === true),
    byRarity: Object.freeze(
      Object.fromEntries(
        (Object.entries(domains) as readonly [ChaosRarity, NumericDomain][]).map(
          ([rarity, domain]) => [
            rarity,
            Object.freeze({
              minimum: domain[0],
              maximum: domain[1],
              step: domain[2],
              authoringDefault: authoringDefault(domain[0], domain[1], domain[2]),
              ...(domain[3] === true ? { integer: true as const } : {}),
            }),
          ],
        ),
      ),
    ),
  });
};

const curse = (
  key: string,
  label: string,
  clock: ChaosCurseDeclaration['clock'],
  min: number,
  max: number,
  operands: readonly import('@run-planner/engine/catalog-schema').ChaosNumericOperand[] = [],
  semanticTag?: ChaosCurseDeclaration['semanticTag'],
  offerRequirements?: ChaosCurseDeclaration['offerRequirements'],
  durationLabel?: string,
): ChaosCurseDeclaration => ({
  key,
  label,
  clock,
  duration: duration(min, max, clock, durationLabel),
  operands,
  ...(semanticTag === undefined ? {} : { semanticTag }),
  ...(offerRequirements === undefined ? {} : { offerRequirements }),
});
export const chaosCurses = [
  curse('ChaosNoMoneyCurse', "Pauper's", 'encounters', 3, 5),
  curse(
    'ChaosHealthCurse',
    'Atrophic',
    'encounters',
    3,
    5,
    [operand('healthPenalty', 'Max Health', -29, -20, 1, true)],
    undefined,
    [{ kind: 'notKeepsake', keepsakeKey: 'LowHealthCritKeepsake' }],
  ),
  curse('ChaosDamageCurse', 'Excruciating', 'encounters', 3, 5, [
    operand('damageTaken', 'Damage taken', 0.2, 0.5, 0.01),
  ]),
  curse(
    'ChaosPrimaryAttackCurse',
    'Maimed',
    'encounters',
    3,
    5,
    [operand('selfDamage', 'Self damage', 3, 6, 1, true)],
    undefined,
    [{ kind: 'notAspect', aspectKey: 'TorchAutofireAspect' }],
  ),
  curse(
    'ChaosSecondaryAttackCurse',
    'Flayed',
    'encounters',
    3,
    5,
    [operand('selfDamage', 'Self damage', 3, 6, 1, true)],
    undefined,
    [{ kind: 'notAspect', aspectKey: 'TorchAutofireAspect' }],
  ),
  curse('ChaosDeathWeaponCurse', 'Caustic', 'encounters', 3, 5),
  curse('ChaosSpeedCurse', 'Slothful', 'encounters', 3, 5, [
    operand('speedMultiplier', 'Movement multiplier', 0.4, 0.6, 0.01),
  ]),
  curse('ChaosExAttackCurse', 'Gagged', 'encounters', 3, 5, [
    operand('selfDamage', 'Self damage', 5, 8, 1, true),
  ]),
  curse('ChaosCastCurse', 'Addled', 'encounters', 3, 5, [
    operand('selfDamage', 'Self damage', 3, 6, 1, true),
  ]),
  curse('ChaosDashCurse', 'Neurotic', 'encounters', 3, 5, [
    operand('magickLoss', 'Magick loss', 10, 20, 1, true),
  ]),
  curse('ChaosManaFocusCurse', 'Fixated', 'encounters', 3, 5),
  curse('ChaosStunCurse', 'Paralyzing', 'encounters', 3, 5, [
    operand('stunDuration', 'Stun duration', 0.5, 1.4, 0.01),
  ]),
  curse('ChaosTimeCurse', 'Expiring', 'encounters', 2, 3),
  curse('ChaosMetaUpgradeCurse', 'Barren', 'encounters', 3, 6, [], 'Barren', [
    { kind: 'matureChaosBlessing' },
  ]),
  curse('ChaosHiddenRoomRewardCurse', 'Enshrouded', 'locations', 4, 6, [], undefined, [
    { kind: 'routeKey', routeKey: 'Underworld' },
  ]),
  curse(
    'ChaosCommonCurse',
    'Ordinary',
    'godBoonScreens',
    2,
    3,
    [],
    'Ordinary',
    undefined,
    'Forced common boons',
  ),
  curse(
    'ChaosRestrictBoonCurse',
    'Rejected',
    'godBoonScreens',
    2,
    4,
    [],
    'Rejected',
    undefined,
    'Fewer offer boons',
  ),
] as const;
const blessing = (
  key: string,
  label: string,
  operands: readonly import('@run-planner/engine/catalog-schema').ChaosNumericOperand[] = [],
  semanticTag?: ChaosBlessingDeclaration['semanticTag'],
  fixedRarity?: 'Legendary',
  offerRequirements?: ChaosBlessingDeclaration['offerRequirements'],
  derivedOutcome?: ChaosBlessingDeclaration['derivedOutcome'],
): ChaosBlessingDeclaration => ({
  key,
  label,
  operands,
  ...(semanticTag === undefined ? {} : { semanticTag }),
  ...(fixedRarity === undefined ? {} : { fixedRarity }),
  ...(offerRequirements === undefined ? {} : { offerRequirements }),
  ...(derivedOutcome === undefined ? {} : { derivedOutcome }),
});
export const chaosBlessings = [
  blessing('ChaosWeaponBlessing', 'Strike', [
    rarityOperand('damageBonus', 'Damage bonus', {
      Common: [0.2, 0.5, 0.01],
      Rare: [0.3, 0.75, 0.01],
      Epic: [0.4, 1, 0.01],
      Heroic: [0.5, 1.25, 0.01],
    }),
  ]),
  blessing('ChaosSpecialBlessing', 'Flourish', [
    rarityOperand('damageBonus', 'Damage bonus', {
      Common: [0.3, 0.6, 0.01],
      Rare: [0.45, 0.9, 0.01],
      Epic: [0.6, 1.2, 0.01],
      Heroic: [0.75, 1.5, 0.01],
    }),
  ]),
  blessing('ChaosCastBlessing', 'Chasm', [
    rarityOperand('damageBonus', 'Damage bonus', {
      Common: [0.2, 0.5, 0.01],
      Rare: [0.3, 0.75, 0.01],
      Epic: [0.4, 1, 0.01],
      Heroic: [0.5, 1.25, 0.01],
    }),
  ]),
  blessing('ChaosHealthBlessing', 'Soul', [
    rarityOperand('health', 'Max Health', {
      Common: [26, 35, 1, true],
      Rare: [52, 70, 1, true],
      Epic: [78, 105, 1, true],
      Heroic: [104, 140, 1, true],
    }),
  ]),
  blessing('ChaosManaBlessing', 'Mind', [
    rarityOperand('magick', 'Max Magick', {
      Common: [30, 40, 1, true],
      Rare: [45, 60, 1, true],
      Epic: [60, 80, 1, true],
      Heroic: [75, 100, 1, true],
    }),
  ]),
  blessing('ChaosManaOverTimeBlessing', 'Will', [
    rarityOperand('magickPerSecond', 'Magick restored', {
      Common: [4, 6, 1, true],
      Rare: [8, 12, 1, true],
      Epic: [12, 18, 1, true],
      Heroic: [16, 24, 1, true],
    }),
  ]),
  blessing('ChaosExSpeedBlessing', 'Revelation', [
    rarityOperand('weaponSpeed', 'Weapon speed', {
      Common: [0.85, 0.9, 0.01],
      Rare: [0.78, 0.85, 0.01],
      Epic: [0.7, 0.8, 0.01],
      Heroic: [0.63, 0.75, 0.01],
    }),
    rarityOperand('propertySpeed', 'Property speed', {
      Common: [0.85, 0.9, 0.01],
      Rare: [0.78, 0.85, 0.01],
      Epic: [0.7, 0.8, 0.01],
      Heroic: [0.63, 0.75, 0.01],
    }),
  ]),
  blessing(
    'ChaosRarityBlessing',
    'Favor',
    [
      rarityOperand('rareBonus', 'Rare chance', {
        Common: [0.4, 0.5, 0.01],
        Rare: [0.54, 0.67, 0.01],
        Epic: [0.67, 0.84, 0.01],
        Heroic: [0.8, 1, 0.01],
      }),
    ],
    'Favor',
  ),
  blessing('ChaosMoneyBlessing', 'Affluence', [
    rarityOperand('moneyBonus', 'Money bonus', {
      Common: [0.4, 0.6, 0.05],
      Rare: [0.8, 1.2, 0.05],
      Epic: [1.2, 1.8, 0.05],
      Heroic: [1.6, 2.4, 0.05],
    }),
  ]),
  blessing('ChaosElementalBlessing', 'Creation', [], 'Creation', undefined, undefined, {
    kind: 'creation',
    elementsPerElementByRarity: { Common: 1, Rare: 2, Epic: 3, Heroic: 4 },
  }),
  blessing('ChaosManaCostBlessing', 'Talent', [
    rarityOperand('costReduction', 'Cost reduction', {
      Common: [0.2, 0.3, 0.05],
      Rare: [0.3, 0.45, 0.05],
      Epic: [0.4, 0.6, 0.05],
      Heroic: [0.5, 0.75, 0.05],
    }),
  ]),
  blessing('ChaosSpeedBlessing', 'Celerity', [], undefined, undefined, undefined, {
    kind: 'celerity',
    moveSpeedPercentByRarity: { Common: 15, Rare: 20, Epic: 25, Heroic: 30 },
    sprintVelocityByRarity: { Common: 297, Rare: 396, Epic: 495, Heroic: 594 },
    sprintCapByRarity: { Common: 133.5, Rare: 178, Epic: 222.5, Heroic: 267 },
  }),
  blessing('ChaosDoorHealBlessing', 'Revival', [
    rarityOperand('heal', 'Health restored', {
      Common: [3, 4, 1, true],
      Rare: [9, 12, 1, true],
      Epic: [15, 20, 1, true],
      Heroic: [21, 28, 1, true],
    }),
  ]),
  blessing('ChaosHarvestBlessing', 'Discovery', [
    rarityOperand('doubleChance', 'Double-resource chance', {
      Common: [0.56, 0.7, 0.01],
      Rare: [0.64, 0.8, 0.01],
      Epic: [0.72, 0.9, 0.01],
      Heroic: [0.8, 1, 0.01],
    }),
  ]),
  blessing(
    'ChaosOmegaDamageBlessing',
    'Chant',
    [],
    undefined,
    undefined,
    [{ kind: 'elementMinimum', element: 'Aether', minimum: 1 }],
    {
      kind: 'chant',
      damagePerAetherPercentByRarity: { Common: 30, Rare: 36, Epic: 42, Heroic: 48 },
    },
  ),
  blessing(
    'ChaosLastStandBlessing',
    'Defiance',
    [],
    undefined,
    'Legendary',
    [{ kind: 'matureChaosBlessing' }],
    {
      kind: 'defiance',
      healthPercent: 40,
      magickPercent: 40,
    },
  ),
] as const;
export const chaosTraits: readonly RawTraitDeclaration[] = [...chaosCurses, ...chaosBlessings].map(
  (entry) => ({
    key: entry.key,
    label: entry.label,
    rarityDomain: 'none',
    offerRequirements: [],
    elementContributions: {},
    usesBoonRarity: false,
    blockStacking: false,
    blockInRunRarify: true,
    excludeFromRarityCount: true,
    selectedDisposition: { kind: 'noOp' },
  }),
);
export const chaosGiver: RawTraitGiverDeclaration = {
  key: 'Chaos',
  label: 'Chaos',
  providerKind: 'chaos',
  traitKeys: [...chaosCurses, ...chaosBlessings].map((entry) => entry.key),
  priorityTraitKeys: [],
  rarityPolicy: { kind: 'none' },
};
