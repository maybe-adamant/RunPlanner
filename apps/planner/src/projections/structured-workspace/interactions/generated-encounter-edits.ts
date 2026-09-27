import type {
  AuthoredEncounterCustomization,
  AuthoredGeneratedEncounterCustomization,
  ProjectCommand,
} from '@run-planner/engine/authored-project';
import type { WorkspaceCommandIntent } from '../contract';
import type {
  WorkspaceGeneratedEncounterAssessment,
  WorkspaceGeneratedEncounterEdits,
} from '../contracts/locals';

type Generated = AuthoredGeneratedEncounterCustomization;
type GeneratedWave = NonNullable<Generated['waves']>[number];

/** Replaces one wave row, dropping `waves` when no row remains. */
function withWave(
  value: Generated,
  waveIndex: number,
  change: (wave: GeneratedWave) => GeneratedWave | undefined,
): Generated {
  const current = value.waves?.find((wave) => wave.waveIndex === waveIndex) ?? {
    waveIndex,
    typeKeys: [],
  };
  const next = change(current);
  const waves = [
    ...(value.waves?.filter((wave) => wave.waveIndex !== waveIndex) ?? []),
    ...(next === undefined ? [] : [next]),
  ].sort((left, right) => left.waveIndex - right.waveIndex);
  const base = {
    kind: 'generated' as const,
    ...(value.baseRoll === undefined ? {} : { baseRoll: value.baseRoll }),
    ...(value.waveCount === undefined ? {} : { waveCount: value.waveCount }),
    ...(value.highlightKey === undefined ? {} : { highlightKey: value.highlightKey }),
    ...(value.fangs === undefined ? {} : { fangs: value.fangs }),
    ...(value.menace === undefined ? {} : { menace: value.menace }),
  };
  return waves.length === 0 ? base : { ...base, waves };
}

/** Moves only an explicit prior highlight's own allocation onto an unallocated new highlight. */
function transferHighlightAllocation(
  allocations: Readonly<Record<string, number>>,
  typeKeys: readonly string[],
  previousKey: string | undefined,
  nextKey: string,
): Readonly<Record<string, number>> {
  // A listed type owns its allocation even when it was also the highlight.
  if (
    previousKey === undefined ||
    typeKeys.includes(previousKey) ||
    !Object.hasOwn(allocations, previousKey) ||
    Object.hasOwn(allocations, nextKey)
  )
    return allocations;
  const { [previousKey]: inherited, ...rest } = allocations;
  return { ...rest, [nextKey]: inherited! };
}

/**
 * Replaces a wave's listed enemies. Allocations carry by position, highlights keep
 * their own, and members outside the sampled budget keys lose theirs.
 */
function replacementWave(
  value: Generated,
  waveIndex: number,
  typeKeys: readonly string[],
  highlightKeys: readonly string[],
  sampledBudgetKeys: readonly string[],
): GeneratedWave {
  const previous = value.waves?.find((wave) => wave.waveIndex === waveIndex);
  const previousAllocations = previous?.allocations;
  const members = [...highlightKeys, ...typeKeys];
  if (previousAllocations === undefined) return { waveIndex, typeKeys: [...typeKeys] };
  const previousTypeKeys = previous?.typeKeys ?? [];
  const allocations: Record<string, number> = {};
  for (const key of highlightKeys) {
    const allocation = previousAllocations[key];
    if (Object.hasOwn(previousAllocations, key) && allocation !== undefined)
      allocations[key] = allocation;
  }
  for (const [index, key] of typeKeys.entries()) {
    const previousKey = previousTypeKeys[index];
    const allocation = previousKey === undefined ? undefined : previousAllocations[previousKey];
    if (
      previousKey !== undefined &&
      Object.hasOwn(previousAllocations, previousKey) &&
      allocation !== undefined
    )
      allocations[key] = allocation;
  }
  for (const key of members) if (!sampledBudgetKeys.includes(key)) delete allocations[key];
  return Object.keys(allocations).length === 0
    ? { waveIndex, typeKeys: [...typeKeys] }
    : { waveIndex, typeKeys: [...typeKeys], allocations };
}

export function replaceWaveEnemies(
  value: Generated,
  waveIndex: number,
  typeKeys: readonly string[],
  highlightKeys: readonly string[],
  sampledBudgetKeys: readonly string[],
): Generated {
  return withWave(value, waveIndex, () =>
    replacementWave(value, waveIndex, typeKeys, highlightKeys, sampledBudgetKeys),
  );
}

export function setSharedEnemy(value: Generated, highlightKey: string): Generated {
  const base = {
    kind: 'generated' as const,
    ...(value.baseRoll === undefined ? {} : { baseRoll: value.baseRoll }),
    ...(value.waveCount === undefined ? {} : { waveCount: value.waveCount }),
    ...(value.fangs === undefined ? {} : { fangs: value.fangs }),
    ...(value.menace === undefined ? {} : { menace: value.menace }),
    ...(value.waves === undefined
      ? {}
      : {
          waves: value.waves.map((wave) =>
            wave.allocations === undefined
              ? wave
              : {
                  ...wave,
                  allocations: transferHighlightAllocation(
                    wave.allocations,
                    wave.typeKeys,
                    value.highlightKey,
                    highlightKey,
                  ),
                },
          ),
        }),
  };
  return { ...base, highlightKey };
}

/** Changing the wave count keeps every other authored field, including retained waves. */
export function setWaveCount(value: Generated, waveCount: number): Generated {
  const base = {
    kind: 'generated' as const,
    ...(value.baseRoll === undefined ? {} : { baseRoll: value.baseRoll }),
    ...(value.highlightKey === undefined ? {} : { highlightKey: value.highlightKey }),
    ...(value.fangs === undefined ? {} : { fangs: value.fangs }),
    ...(value.menace === undefined ? {} : { menace: value.menace }),
    ...(value.waves === undefined ? {} : { waves: value.waves }),
  };
  return { ...base, waveCount };
}

export function setBaseRoll(value: Generated, baseRoll: number): Generated {
  return { ...value, baseRoll };
}

export function setAllocation(
  value: Generated,
  waveIndex: number,
  key: string,
  allocation: number,
): Generated {
  return withWave(value, waveIndex, (row) => ({
    ...row,
    allocations: { ...row.allocations, [key]: allocation },
  }));
}

/** Drops the last listed enemy and its allocation, omitting an emptied allocation map. */
export function removeLastEnemy(value: Generated, waveIndex: number): Generated {
  return withWave(value, waveIndex, (row) => {
    const typeKeys = row.typeKeys.slice(0, -1);
    const next = { ...row, typeKeys };
    if (row.allocations !== undefined) {
      const allocations = { ...row.allocations };
      const removedKey = row.typeKeys.at(-1);
      if (removedKey !== undefined) delete allocations[removedKey];
      if (Object.keys(allocations).length) next.allocations = allocations;
      else delete next.allocations;
    }
    return next;
  });
}

/** A new Fangs target keeps the authored perks. */
export function setFangsTarget(value: Generated, typeKey: string): Generated {
  return { ...value, fangs: { typeKey, perkKeys: value.fangs?.perkKeys ?? [] } };
}

/** Perks belong to an authored target; without one the value is unchanged. */
export function setFangsPerks(value: Generated, perkKeys: readonly string[]): Generated {
  if (value.fangs === undefined) return value;
  return { ...value, fangs: { typeKey: value.fangs.typeKey, perkKeys } };
}

/** Upserts one Menace conversion keyed to its source enemy. */
function setMenaceConversion(
  value: Generated,
  waveIndex: number,
  sourceKey: string,
  change: { readonly count: number; readonly targetKey?: string },
): Generated {
  const prior = value.menace?.find((wave) => wave.waveIndex === waveIndex);
  const conversions = { ...(prior?.conversions ?? {}), [sourceKey]: change };
  const menace = [
    ...(value.menace?.filter((wave) => wave.waveIndex !== waveIndex) ?? []),
    { waveIndex, conversions },
  ].sort((left, right) => left.waveIndex - right.waveIndex);
  return { ...value, menace };
}

function menaceConversion(value: Generated, waveIndex: number, sourceKey: string) {
  return value.menace?.find((entry) => entry.waveIndex === waveIndex)?.conversions[sourceKey];
}

/** A replacement choice keeps the authored count, defaulting to none converted. */
export function setMenaceTarget(
  value: Generated,
  waveIndex: number,
  sourceKey: string,
  targetKey: string,
): Generated {
  return setMenaceConversion(value, waveIndex, sourceKey, {
    count: menaceConversion(value, waveIndex, sourceKey)?.count ?? 0,
    targetKey,
  });
}

/** A count edit keeps any authored replacement choice. */
export function setMenaceCount(
  value: Generated,
  waveIndex: number,
  sourceKey: string,
  count: number,
): Generated {
  const prior = menaceConversion(value, waveIndex, sourceKey);
  return setMenaceConversion(value, waveIndex, sourceKey, {
    count,
    ...(prior?.targetKey === undefined ? {} : { targetKey: prior.targetKey }),
  });
}

/** Binds every edit to the current authored value; highlight seeds come from the assessment. */
export function bindGeneratedEncounterEdits(
  value: Generated,
  assessment: WorkspaceGeneratedEncounterAssessment | undefined,
  intentFor: (
    value: AuthoredEncounterCustomization,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceEncounterCustomization' }>
  >,
): WorkspaceGeneratedEncounterEdits {
  const highlightKeys = (waveIndex: number) =>
    (assessment?.waves.find((wave) => wave.waveIndex === waveIndex)?.seeds ?? [])
      .filter((seed) => seed.kind === 'highlight')
      .map((seed) => seed.key);
  return Object.freeze({
    replaceWaveEnemies: (
      waveIndex: number,
      typeKeys: readonly string[],
      sampledBudgetKeys: readonly string[],
    ) =>
      intentFor(
        replaceWaveEnemies(value, waveIndex, typeKeys, highlightKeys(waveIndex), sampledBudgetKeys),
      ),
    setSharedEnemy: (highlightKey: string) => intentFor(setSharedEnemy(value, highlightKey)),
    setWaveCount: (waveCount: number) => intentFor(setWaveCount(value, waveCount)),
    setBaseRoll: (baseRoll: number) => intentFor(setBaseRoll(value, baseRoll)),
    setAllocation: (waveIndex: number, key: string, allocation: number) =>
      intentFor(setAllocation(value, waveIndex, key, allocation)),
    removeLastEnemy: (waveIndex: number) => intentFor(removeLastEnemy(value, waveIndex)),
    setFangsTarget: (typeKey: string) => intentFor(setFangsTarget(value, typeKey)),
    setFangsPerks: (perkKeys: readonly string[]) => intentFor(setFangsPerks(value, perkKeys)),
    setMenaceTarget: (waveIndex: number, sourceKey: string, targetKey: string) =>
      intentFor(setMenaceTarget(value, waveIndex, sourceKey, targetKey)),
    setMenaceCount: (waveIndex: number, sourceKey: string, count: number) =>
      intentFor(setMenaceCount(value, waveIndex, sourceKey, count)),
  });
}
