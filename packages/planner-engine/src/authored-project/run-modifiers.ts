import type { RouteLoadout, RunModifiers } from './model';
import { expectRecord, expectExactKeys, expectBoolean, failProjectDocument } from './validation';

export const NATIVE_RUN_MODIFIERS: RunModifiers = Object.freeze({
  guaranteeEligibleCrits: false,
  guaranteeEligibleDoubleDamage: false,
  enemyGoldDropChanceMultiplier: 1,
});

/** Read native defaults without inserting persisted fields. */
export function routeRunModifiers(loadout: Pick<RouteLoadout, 'runModifiers'>): RunModifiers {
  return loadout.runModifiers ?? NATIVE_RUN_MODIFIERS;
}

export function isNativeRunModifiers(value: RunModifiers): boolean {
  return (
    !value.guaranteeEligibleCrits &&
    !value.guaranteeEligibleDoubleDamage &&
    value.enemyGoldDropChanceMultiplier === 1
  );
}

/** The authored settings' complete structural domain, also consumed by export. */
export function decodeRunModifiers(value: unknown, path: string): RunModifiers {
  const record = expectRecord(value, path);
  expectExactKeys(
    record,
    ['guaranteeEligibleCrits', 'guaranteeEligibleDoubleDamage', 'enemyGoldDropChanceMultiplier'],
    path,
  );
  const guaranteeEligibleCrits = expectBoolean(
    record.guaranteeEligibleCrits,
    `${path}.guaranteeEligibleCrits`,
  );
  const guaranteeEligibleDoubleDamage = expectBoolean(
    record.guaranteeEligibleDoubleDamage,
    `${path}.guaranteeEligibleDoubleDamage`,
  );
  const multiplier = record.enemyGoldDropChanceMultiplier;
  if (typeof multiplier !== 'number' || !Number.isFinite(multiplier) || multiplier < 1) {
    failProjectDocument(
      `${path}.enemyGoldDropChanceMultiplier`,
      'must be a finite number at least 1',
    );
  }
  return Object.freeze({
    guaranteeEligibleCrits,
    guaranteeEligibleDoubleDamage,
    enemyGoldDropChanceMultiplier: multiplier,
  });
}
