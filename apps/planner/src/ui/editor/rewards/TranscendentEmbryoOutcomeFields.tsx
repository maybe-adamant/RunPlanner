import type { ChaosNumericOperand, TraitRarity } from '@run-planner/engine/catalog-schema';
import { ChaosBlessingValueFields } from './ChaosBlessingValueFields';

type ChaosBlessingRarity = Exclude<TraitRarity, 'Duo'>;

/** Shared inline details for a selected Transcendent Embryo blessing. */
export function TranscendentEmbryoOutcomeFields({
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
  return (
    <>
      <span className="transcendent-embryo-rarity">
        Rarity: <strong>{rarity}</strong>
      </span>
      <ChaosBlessingValueFields
        onChange={onChange}
        operands={operands}
        rarity={rarity}
        values={values}
      />
    </>
  );
}
