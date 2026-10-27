import type { Catalog, ChaosNumericOperand } from '../catalog-schema';

/** The saved trait-table paths a recorder keeps, by trait name. */
export type RunRecordSavedValuePaths = ReadonlyMap<string, readonly string[]>;

const operandPaths = (operands: readonly ChaosNumericOperand[]) =>
  operands.flatMap((operand) => (operand.saveField === undefined ? [] : [operand.saveField.path]));

/**
 * Every Chaos curse keeps its rolled operands and, under its pending blessing,
 * any blessing's, since a curse pairs with any blessing; a blessing keeps its
 * own for the Transcendent Embryo's standalone grant.
 */
export function runRecordSavedValuePaths(catalog: Catalog): RunRecordSavedValuePaths {
  const { curses, blessings, pendingBlessingSavePath } = catalog.chaos;
  const pending = [
    ...new Set(
      blessings.values.flatMap((blessing) =>
        operandPaths(blessing.operands).map((path) => `${pendingBlessingSavePath}.${path}`),
      ),
    ),
  ];
  const paths = new Map<string, readonly string[]>();
  for (const curse of curses.values)
    paths.set(curse.key, Object.freeze([...operandPaths(curse.operands), ...pending]));
  for (const blessing of blessings.values) {
    const own = operandPaths(blessing.operands);
    if (own.length > 0) paths.set(blessing.key, Object.freeze(own));
  }
  return paths;
}
