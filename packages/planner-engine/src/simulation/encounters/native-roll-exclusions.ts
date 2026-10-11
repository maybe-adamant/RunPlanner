import { semanticAddressKey } from '../../authored-project/addresses';
import type { ResolvedGeneratedPhase } from './model';

/**
 * The enemies each reached generated phase's native roll must not draw, keyed
 * by phase address. `phases` is every reached generated phase of the run in
 * generation order. A phase excludes its trigger set, then each once-per-run
 * enemy it could draw that a later authored composition draws through native
 * eligibility. An authored phase keeps its own members in the list: it applies
 * only when that composition is declined.
 */
export function nativeRollExclusions(
  phases: readonly ResolvedGeneratedPhase[],
): ReadonlyMap<string, readonly string[]> {
  const exclusions = new Map<string, readonly string[]>();
  let laterUses: readonly string[] = [];
  for (let index = phases.length - 1; index >= 0; index -= 1) {
    const phase = phases[index]!;
    const reserved = laterUses.filter(
      (key) =>
        phase.oncePerRunEnemyKeys.includes(key) && !phase.triggerExcludedEnemyKeys.includes(key),
    );
    exclusions.set(
      semanticAddressKey(phase.origin),
      Object.freeze([...phase.triggerExcludedEnemyKeys, ...reserved]),
    );
    const uses = phase.authoredOncePerRunUses ?? [];
    laterUses = [...uses, ...laterUses.filter((key) => !uses.includes(key))];
  }
  return exclusions;
}
