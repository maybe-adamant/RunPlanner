import type { ChaosNumericOperand, TraitRarity } from '@run-planner/engine/catalog-schema';
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
        <input
          aria-label={effective.label}
          max={effective.maximum}
          min={effective.minimum}
          onChange={(event) =>
            onChange(
              reconcileChaosOperandValues(
                operands,
                { ...values, [operand.key]: Number(event.currentTarget.value) },
                rarity,
              ),
            )
          }
          step={effective.step}
          type="number"
          value={current}
        />
      </label>
    );
  });
}
