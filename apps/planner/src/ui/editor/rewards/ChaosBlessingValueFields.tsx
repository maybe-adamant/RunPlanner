import type { ChaosNumericOperand, TraitRarity } from '@run-planner/engine/catalog-schema';
import { ChaosValueSlider } from './ChaosValueSlider';
import { effectiveChaosOperand, reconcileChaosOperandValues } from './chaos-blessing-values';

type ChaosBlessingRarity = Exclude<TraitRarity, 'Duo'>;

/** The single numeric editor for a declared Chaos blessing result. */
export function ChaosBlessingValueFields({
  operands,
  rarity,
  values,
  onChange,
}: {
  readonly operands: readonly ChaosNumericOperand[];
  readonly rarity: ChaosBlessingRarity;
  readonly values: Readonly<Record<string, number>>;
  readonly onChange: (values: Readonly<Record<string, number>>) => void;
}) {
  return operands.map((operand) => {
    const effective = effectiveChaosOperand(operand, rarity);
    const current = values[operand.key] ?? effective.authoringDefault;
    return (
      <label className="field-control" key={operand.key}>
        <span>{effective.label}</span>
        <ChaosValueSlider
          ariaLabel={effective.label}
          maximum={effective.maximum}
          minimum={effective.minimum}
          onChange={(value) =>
            onChange(
              reconcileChaosOperandValues(operands, { ...values, [operand.key]: value }, rarity),
            )
          }
          step={effective.step}
          value={current}
        />
      </label>
    );
  });
}
