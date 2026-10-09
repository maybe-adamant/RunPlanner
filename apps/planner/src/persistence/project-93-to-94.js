export const SOURCE_SCHEMA_VERSION = 93;
export const OUTPUT_SCHEMA_VERSION = 94;
export const CATALOG_VERSION = '0.55.0-anvil-of-fates';
// Each layout's authored nodes in layout order: R Keystone, E Legendary, C repeatable.
// prettier-ignore
const LAYOUT_NODES = Object.freeze({
  Lung: ['C1:2', 'C1:4', 'C2:2', 'C2:4', 'C3:1', 'C3:2', 'C3:3', 'C3:4', 'C3:5', 'C3:6', 'R4:1', 'C4:3', 'R4:5', 'C5:2', 'C5:4', 'E6:3'],
  Pyramid: ['C1:1', 'C1:2', 'C1:3', 'C1:4', 'C1:5', 'C2:1', 'C2:2', 'C2:3', 'C2:4', 'C3:2', 'R3:3', 'C3:4', 'C4:2', 'C4:4', 'R5:1', 'C5:3', 'R5:5', 'E6:3'],
  Maze: ['C1:3', 'C2:2', 'C2:3', 'C2:4', 'C3:2', 'C3:3', 'C3:4', 'R4:1', 'C4:2', 'R4:3', 'C4:4', 'R4:5', 'C5:1', 'C5:2', 'C5:3', 'C5:4', 'C5:5', 'C5:6', 'C6:2', 'C6:4', 'E7:2', 'E7:4'],
  Nacelle: ['C1:2', 'C1:4', 'C2:2', 'C2:4', 'C3:0', 'C3:1', 'R3:2', 'C3:3', 'R3:4', 'C3:5', 'C3:6', 'C4:2', 'R4:3', 'C4:4', 'C5:2', 'C5:4', 'E6:2', 'E6:4'],
});
// The catalog's default repeatable fill per Hex and layout, in repeatable-node order.
// prettier-ignore
const DEFAULT_REPEATABLES = Object.freeze({
  SpellPolymorphTrait: {
    Lung: ['CooldownDamageTalent', 'ChargeRegenTalent', 'PolymorphDurationTalent', 'PolymorphDamageTalent', 'CooldownDamageTalent', 'PolymorphDurationTalent', 'PolymorphDamageTalent', 'CooldownDamageTalent', 'PolymorphDurationTalent', 'PolymorphDamageTalent', 'CooldownDamageTalent', 'PolymorphDurationTalent', 'PolymorphDamageTalent'],
    Pyramid: ['CooldownDamageTalent', 'ChargeRegenTalent', 'PolymorphDurationTalent', 'PolymorphDamageTalent', 'CooldownDamageTalent', 'PolymorphDurationTalent', 'PolymorphDamageTalent', 'CooldownDamageTalent', 'PolymorphDurationTalent', 'PolymorphDamageTalent', 'CooldownDamageTalent', 'PolymorphDurationTalent', 'PolymorphDamageTalent', 'CooldownDamageTalent'],
    Maze: ['CooldownDamageTalent', 'ChargeRegenTalent', 'PolymorphDurationTalent', 'PolymorphDamageTalent', 'CooldownDamageTalent', 'PolymorphDurationTalent', 'PolymorphDamageTalent', 'CooldownDamageTalent', 'PolymorphDurationTalent', 'PolymorphDamageTalent', 'CooldownDamageTalent', 'PolymorphDurationTalent', 'PolymorphDamageTalent', 'CooldownDamageTalent', 'PolymorphDurationTalent', 'PolymorphDamageTalent', 'CooldownDamageTalent'],
    Nacelle: ['CooldownDamageTalent', 'ChargeRegenTalent', 'PolymorphDurationTalent', 'PolymorphDamageTalent', 'CooldownDamageTalent', 'PolymorphDurationTalent', 'PolymorphDamageTalent', 'CooldownDamageTalent', 'PolymorphDurationTalent', 'PolymorphDamageTalent', 'CooldownDamageTalent', 'PolymorphDurationTalent', 'PolymorphDamageTalent'],
  },
  SpellMeteorTrait: {
    Lung: ['CooldownDamageTalent', 'PreChargeTalent', 'MeteorSizeTalent', 'MeteorDamageTalent', 'CooldownDamageTalent', 'PreChargeTalent', 'MeteorSizeTalent', 'MeteorDamageTalent', 'CooldownDamageTalent', 'MeteorSizeTalent', 'MeteorDamageTalent', 'CooldownDamageTalent', 'MeteorSizeTalent'],
    Pyramid: ['CooldownDamageTalent', 'PreChargeTalent', 'MeteorSizeTalent', 'MeteorDamageTalent', 'CooldownDamageTalent', 'PreChargeTalent', 'MeteorSizeTalent', 'MeteorDamageTalent', 'CooldownDamageTalent', 'MeteorSizeTalent', 'MeteorDamageTalent', 'CooldownDamageTalent', 'MeteorSizeTalent', 'MeteorDamageTalent'],
    Maze: ['CooldownDamageTalent', 'PreChargeTalent', 'MeteorSizeTalent', 'MeteorDamageTalent', 'CooldownDamageTalent', 'PreChargeTalent', 'MeteorSizeTalent', 'MeteorDamageTalent', 'CooldownDamageTalent', 'MeteorSizeTalent', 'MeteorDamageTalent', 'CooldownDamageTalent', 'MeteorSizeTalent', 'MeteorDamageTalent', 'CooldownDamageTalent', 'MeteorSizeTalent', 'MeteorDamageTalent'],
    Nacelle: ['CooldownDamageTalent', 'PreChargeTalent', 'MeteorSizeTalent', 'MeteorDamageTalent', 'CooldownDamageTalent', 'PreChargeTalent', 'MeteorSizeTalent', 'MeteorDamageTalent', 'CooldownDamageTalent', 'MeteorSizeTalent', 'MeteorDamageTalent', 'CooldownDamageTalent', 'MeteorSizeTalent'],
  },
  SpellTransformTrait: {
    Lung: ['TransformDurationTalent', 'TransformDamageTalent', 'TransformCooldownDodgeTalent', 'ChargeRegenTalent', 'TransformDurationTalent', 'TransformDamageTalent', 'TransformCooldownDodgeTalent', 'TransformDurationTalent', 'TransformDamageTalent', 'TransformCooldownDodgeTalent', 'TransformDurationTalent', 'TransformDamageTalent', 'TransformCooldownDodgeTalent'],
    Pyramid: ['TransformDurationTalent', 'TransformDamageTalent', 'TransformCooldownDodgeTalent', 'ChargeRegenTalent', 'TransformDurationTalent', 'TransformDamageTalent', 'TransformCooldownDodgeTalent', 'TransformDurationTalent', 'TransformDamageTalent', 'TransformCooldownDodgeTalent', 'TransformDurationTalent', 'TransformDamageTalent', 'TransformCooldownDodgeTalent', 'TransformDurationTalent'],
    Maze: ['TransformDurationTalent', 'TransformDamageTalent', 'TransformCooldownDodgeTalent', 'ChargeRegenTalent', 'TransformDurationTalent', 'TransformDamageTalent', 'TransformCooldownDodgeTalent', 'TransformDurationTalent', 'TransformDamageTalent', 'TransformCooldownDodgeTalent', 'TransformDurationTalent', 'TransformDamageTalent', 'TransformCooldownDodgeTalent', 'TransformDurationTalent', 'TransformDamageTalent', 'TransformCooldownDodgeTalent', 'TransformDurationTalent'],
    Nacelle: ['TransformDurationTalent', 'TransformDamageTalent', 'TransformCooldownDodgeTalent', 'ChargeRegenTalent', 'TransformDurationTalent', 'TransformDamageTalent', 'TransformCooldownDodgeTalent', 'TransformDurationTalent', 'TransformDamageTalent', 'TransformCooldownDodgeTalent', 'TransformDurationTalent', 'TransformDamageTalent', 'TransformCooldownDodgeTalent'],
  },
  SpellLeapTrait: {
    Lung: ['ChargeRegenTalent', 'LeapDamageTalent', 'LeapArmorDamageTalent', 'LeapCooldownSpeedTalent', 'LeapDamageTalent', 'LeapArmorDamageTalent', 'LeapCooldownSpeedTalent', 'LeapDamageTalent', 'LeapArmorDamageTalent', 'LeapCooldownSpeedTalent', 'LeapDamageTalent', 'LeapArmorDamageTalent', 'LeapCooldownSpeedTalent'],
    Pyramid: ['ChargeRegenTalent', 'LeapDamageTalent', 'LeapArmorDamageTalent', 'LeapCooldownSpeedTalent', 'LeapDamageTalent', 'LeapArmorDamageTalent', 'LeapCooldownSpeedTalent', 'LeapDamageTalent', 'LeapArmorDamageTalent', 'LeapCooldownSpeedTalent', 'LeapDamageTalent', 'LeapArmorDamageTalent', 'LeapCooldownSpeedTalent', 'LeapDamageTalent'],
    Maze: ['ChargeRegenTalent', 'LeapDamageTalent', 'LeapArmorDamageTalent', 'LeapCooldownSpeedTalent', 'LeapDamageTalent', 'LeapArmorDamageTalent', 'LeapCooldownSpeedTalent', 'LeapDamageTalent', 'LeapArmorDamageTalent', 'LeapCooldownSpeedTalent', 'LeapDamageTalent', 'LeapArmorDamageTalent', 'LeapCooldownSpeedTalent', 'LeapDamageTalent', 'LeapArmorDamageTalent', 'LeapCooldownSpeedTalent', 'LeapDamageTalent'],
    Nacelle: ['ChargeRegenTalent', 'LeapDamageTalent', 'LeapArmorDamageTalent', 'LeapCooldownSpeedTalent', 'LeapDamageTalent', 'LeapArmorDamageTalent', 'LeapCooldownSpeedTalent', 'LeapDamageTalent', 'LeapArmorDamageTalent', 'LeapCooldownSpeedTalent', 'LeapDamageTalent', 'LeapArmorDamageTalent', 'LeapCooldownSpeedTalent'],
  },
  SpellLaserTrait: {
    Lung: ['CooldownDamageTalent', 'ChargeRegenTalent', 'LaserDamageTalent', 'LaserDefenseTalent', 'CooldownDamageTalent', 'LaserDamageTalent', 'LaserDefenseTalent', 'CooldownDamageTalent', 'LaserDamageTalent', 'LaserDefenseTalent', 'CooldownDamageTalent', 'LaserDamageTalent', 'LaserDefenseTalent'],
    Pyramid: ['CooldownDamageTalent', 'ChargeRegenTalent', 'LaserDamageTalent', 'LaserDefenseTalent', 'CooldownDamageTalent', 'LaserDamageTalent', 'LaserDefenseTalent', 'CooldownDamageTalent', 'LaserDamageTalent', 'LaserDefenseTalent', 'CooldownDamageTalent', 'LaserDamageTalent', 'LaserDefenseTalent', 'CooldownDamageTalent'],
    Maze: ['CooldownDamageTalent', 'ChargeRegenTalent', 'LaserDamageTalent', 'LaserDefenseTalent', 'CooldownDamageTalent', 'LaserDamageTalent', 'LaserDefenseTalent', 'CooldownDamageTalent', 'LaserDamageTalent', 'LaserDefenseTalent', 'CooldownDamageTalent', 'LaserDamageTalent', 'LaserDefenseTalent', 'CooldownDamageTalent', 'LaserDamageTalent', 'LaserDefenseTalent', 'CooldownDamageTalent'],
    Nacelle: ['CooldownDamageTalent', 'ChargeRegenTalent', 'LaserDamageTalent', 'LaserDefenseTalent', 'CooldownDamageTalent', 'LaserDamageTalent', 'LaserDefenseTalent', 'CooldownDamageTalent', 'LaserDamageTalent', 'LaserDefenseTalent', 'CooldownDamageTalent', 'LaserDamageTalent', 'LaserDefenseTalent'],
  },
  SpellSummonTrait: {
    Lung: ['CooldownDamageTalent', 'ChargeRegenTalent', 'PreChargeTalent', 'SummonDamageTalent', 'CooldownDamageTalent', 'PreChargeTalent', 'SummonDamageTalent', 'CooldownDamageTalent', 'SummonDamageTalent', 'CooldownDamageTalent', 'SummonDamageTalent', 'CooldownDamageTalent', 'SummonDamageTalent'],
    Pyramid: ['CooldownDamageTalent', 'ChargeRegenTalent', 'PreChargeTalent', 'SummonDamageTalent', 'CooldownDamageTalent', 'PreChargeTalent', 'SummonDamageTalent', 'CooldownDamageTalent', 'SummonDamageTalent', 'CooldownDamageTalent', 'SummonDamageTalent', 'CooldownDamageTalent', 'SummonDamageTalent', 'CooldownDamageTalent'],
    Maze: ['CooldownDamageTalent', 'ChargeRegenTalent', 'PreChargeTalent', 'SummonDamageTalent', 'CooldownDamageTalent', 'PreChargeTalent', 'SummonDamageTalent', 'CooldownDamageTalent', 'SummonDamageTalent', 'CooldownDamageTalent', 'SummonDamageTalent', 'CooldownDamageTalent', 'SummonDamageTalent', 'CooldownDamageTalent', 'SummonDamageTalent', 'CooldownDamageTalent', 'SummonDamageTalent'],
    Nacelle: ['CooldownDamageTalent', 'ChargeRegenTalent', 'PreChargeTalent', 'SummonDamageTalent', 'CooldownDamageTalent', 'PreChargeTalent', 'SummonDamageTalent', 'CooldownDamageTalent', 'SummonDamageTalent', 'CooldownDamageTalent', 'SummonDamageTalent', 'CooldownDamageTalent', 'SummonDamageTalent'],
  },
  SpellTimeSlowTrait: {
    Lung: ['PreChargeTalent', 'ChargeRegenTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent', 'PreChargeTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent'],
    Pyramid: ['PreChargeTalent', 'ChargeRegenTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent', 'PreChargeTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent', 'TimeSlowAmountTalent'],
    Maze: ['PreChargeTalent', 'ChargeRegenTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent', 'PreChargeTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent'],
    Nacelle: ['PreChargeTalent', 'ChargeRegenTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent', 'PreChargeTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent', 'TimeSlowAmountTalent', 'CooldownDefenseTalent'],
  },
  SpellPotionTrait: {
    Lung: ['PotionManaRestoreTalent', 'PotionUsesTalent', 'HealAmountTalent', 'CurrencyUseTalent', 'PotionManaRestoreTalent', 'PotionUsesTalent', 'HealAmountTalent', 'CurrencyUseTalent', 'PotionManaRestoreTalent', 'PotionUsesTalent', 'HealAmountTalent', 'CurrencyUseTalent', 'PotionManaRestoreTalent'],
    Pyramid: ['PotionManaRestoreTalent', 'PotionUsesTalent', 'HealAmountTalent', 'CurrencyUseTalent', 'PotionManaRestoreTalent', 'PotionUsesTalent', 'HealAmountTalent', 'CurrencyUseTalent', 'PotionManaRestoreTalent', 'PotionUsesTalent', 'HealAmountTalent', 'CurrencyUseTalent', 'PotionManaRestoreTalent', 'PotionUsesTalent'],
    Maze: ['PotionManaRestoreTalent', 'PotionUsesTalent', 'HealAmountTalent', 'CurrencyUseTalent', 'PotionManaRestoreTalent', 'PotionUsesTalent', 'HealAmountTalent', 'CurrencyUseTalent', 'PotionManaRestoreTalent', 'PotionUsesTalent', 'HealAmountTalent', 'CurrencyUseTalent', 'PotionManaRestoreTalent', 'PotionUsesTalent', 'HealAmountTalent', 'CurrencyUseTalent', 'PotionManaRestoreTalent'],
    Nacelle: ['PotionManaRestoreTalent', 'PotionUsesTalent', 'HealAmountTalent', 'CurrencyUseTalent', 'PotionManaRestoreTalent', 'PotionUsesTalent', 'HealAmountTalent', 'CurrencyUseTalent', 'PotionManaRestoreTalent', 'PotionUsesTalent', 'HealAmountTalent', 'CurrencyUseTalent', 'PotionManaRestoreTalent'],
  },
  SpellMoonBeamTrait: {
    Lung: ['ChargeRegenTalent', 'MoonBeamVulnerabilityTalent', 'MoonBeamDamageTalent', 'MoonBeamCountTalent', 'MoonBeamVulnerabilityTalent', 'MoonBeamDamageTalent', 'MoonBeamCountTalent', 'MoonBeamVulnerabilityTalent', 'MoonBeamDamageTalent', 'MoonBeamCountTalent', 'MoonBeamVulnerabilityTalent', 'MoonBeamDamageTalent', 'MoonBeamCountTalent'],
    Pyramid: ['ChargeRegenTalent', 'MoonBeamVulnerabilityTalent', 'MoonBeamDamageTalent', 'MoonBeamCountTalent', 'MoonBeamVulnerabilityTalent', 'MoonBeamDamageTalent', 'MoonBeamCountTalent', 'MoonBeamVulnerabilityTalent', 'MoonBeamDamageTalent', 'MoonBeamCountTalent', 'MoonBeamVulnerabilityTalent', 'MoonBeamDamageTalent', 'MoonBeamCountTalent', 'MoonBeamVulnerabilityTalent'],
    Maze: ['ChargeRegenTalent', 'MoonBeamVulnerabilityTalent', 'MoonBeamDamageTalent', 'MoonBeamCountTalent', 'MoonBeamVulnerabilityTalent', 'MoonBeamDamageTalent', 'MoonBeamCountTalent', 'MoonBeamVulnerabilityTalent', 'MoonBeamDamageTalent', 'MoonBeamCountTalent', 'MoonBeamVulnerabilityTalent', 'MoonBeamDamageTalent', 'MoonBeamCountTalent', 'MoonBeamVulnerabilityTalent', 'MoonBeamDamageTalent', 'MoonBeamCountTalent', 'MoonBeamVulnerabilityTalent'],
    Nacelle: ['ChargeRegenTalent', 'MoonBeamVulnerabilityTalent', 'MoonBeamDamageTalent', 'MoonBeamCountTalent', 'MoonBeamVulnerabilityTalent', 'MoonBeamDamageTalent', 'MoonBeamCountTalent', 'MoonBeamVulnerabilityTalent', 'MoonBeamDamageTalent', 'MoonBeamCountTalent', 'MoonBeamVulnerabilityTalent', 'MoonBeamDamageTalent', 'MoonBeamCountTalent'],
  },
});
const OFFER_OPTION_KEYS = ['option1', 'option2', 'option3'];

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}

function picks(value, count, label) {
  if (!Array.isArray(value) || value.length !== count)
    throw new Error(`${label} must hold ${count} talents`);
  return value;
}

// The default tree with the Rare and Epic picks in the Keystone and Legendary nodes.
function migrateTree(value, spellTraitKey, label) {
  const tree = record(value, label);
  const order = LAYOUT_NODES[tree.layoutKey];
  if (order === undefined) throw new Error(`${label}.layoutKey is not a Hex layout`);
  const repeatables = DEFAULT_REPEATABLES[spellTraitKey]?.[tree.layoutKey];
  if (repeatables === undefined) throw new Error(`${label} has no Hex for ${spellTraitKey}`);
  const queues = {
    R: [
      ...picks(
        tree.rareTalentKeys,
        order.filter((node) => node[0] === 'R').length,
        `${label}.rareTalentKeys`,
      ),
    ],
    E: [
      ...picks(
        tree.epicTalentKeys,
        order.filter((node) => node[0] === 'E').length,
        `${label}.epicTalentKeys`,
      ),
    ],
    C: [...repeatables],
  };
  return {
    layoutKey: tree.layoutKey,
    nodes: Object.fromEntries(order.map((node) => [node.slice(1), queues[node[0]].shift()])),
  };
}

function selectedSpell(offer, label) {
  const option = Array.isArray(offer.options)
    ? offer.options[OFFER_OPTION_KEYS.indexOf(offer.selectedOptionKey)]
    : undefined;
  if (typeof option?.traitKey !== 'string') throw new Error(`${label} has no selected Spell`);
  return option.traitKey;
}

function migrateTrees(value, label) {
  if (Array.isArray(value))
    return value.map((entry, index) => migrateTrees(entry, `${label}[${index}]`));
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      key === 'hexTree'
        ? migrateTree(entry, selectedSpell(value, label), `${label}.${key}`)
        : key === 'aspectHexTree'
          ? migrateTree(entry, 'SpellMoonBeamTrait', `${label}.${key}`)
          : migrateTrees(entry, `${label}.${key}`),
    ]),
  );
}

/** Browser-safe schema transform; the CLI supplies only file I/O. */
export function migrateProjectDocument(value) {
  const source = record(value, 'project document');
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION)
    throw new Error(
      `schema 93 -> 94 migration expects schema 93, received ${String(source.schemaVersion)}`,
    );
  if (source.catalogVersion !== CATALOG_VERSION)
    throw new Error(
      `schema 93 -> 94 migration expects catalog ${CATALOG_VERSION}, received ${String(source.catalogVersion)}`,
    );
  const migrated = migrateTrees(JSON.parse(JSON.stringify(source)), 'project');
  migrated.schemaVersion = OUTPUT_SCHEMA_VERSION;
  return migrated;
}
