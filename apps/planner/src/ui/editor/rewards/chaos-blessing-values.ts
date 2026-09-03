import { chaosOperandsAtRarity } from '@run-planner/engine/authored-project';
import type { ChaosNumericOperand, TraitRarity } from '@run-planner/engine/catalog-schema';

type ChaosBlessingRarity = Exclude<TraitRarity, 'Duo'>;

export function effectiveChaosOperand(
  operand: ChaosNumericOperand,
  rarity?: ChaosBlessingRarity,
): ChaosNumericOperand {
  return rarity === undefined ? operand : chaosOperandsAtRarity([operand], rarity)[0]!;
}

export function reconcileChaosOperandValues(
  operands: readonly ChaosNumericOperand[],
  values: Readonly<Record<string, number>>,
  rarity?: ChaosBlessingRarity,
): Readonly<Record<string, number>> {
  return Object.freeze(
    Object.fromEntries(
      operands.map((operand) => {
        const effective = effectiveChaosOperand(operand, rarity);
        const value = values[operand.key];
        const steps = value === undefined ? NaN : (value - effective.minimum) / effective.step;
        const legal =
          value !== undefined &&
          Number.isFinite(value) &&
          value >= effective.minimum &&
          value <= effective.maximum &&
          (effective.integer !== true || Number.isInteger(value)) &&
          Math.abs(steps - Math.round(steps)) <= 1e-8;
        return [operand.key, legal ? value : effective.authoringDefault];
      }),
    ),
  );
}
