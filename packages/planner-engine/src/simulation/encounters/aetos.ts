import type { ResolvedEncounterPhase } from './model';

export interface AetosPhaseSupport {
  readonly waves: readonly number[];
  readonly selectedWave?: number;
  readonly reason?: 'encounter' | 'indoor' | 'skipped' | 'alreadyPlaced' | 'wave';
}

/** Assesses the event at its reached start, using the folded earlier start history. */
export function assessAetosAppearance(
  phase: ResolvedEncounterPhase,
  outdoor: boolean,
  skipped: boolean,
  alreadyPlaced: boolean,
): AetosPhaseSupport {
  const generated = phase.customization?.find(
    (decision) => decision.selection.kind === 'generated',
  );
  const value = generated?.value;
  const count = value?.kind === 'generated' ? value.waveCount : undefined;
  const nativeWaves = phase.aetosWaves ?? [];
  const waves = Object.freeze(nativeWaves.filter((wave) => count === undefined || wave <= count));
  const reason =
    phase.aetosWaves === undefined
      ? 'encounter'
      : !outdoor
        ? 'indoor'
        : skipped
          ? 'skipped'
          : alreadyPlaced
            ? 'alreadyPlaced'
            : waves.length === 0 ||
                (phase.aetosWave !== undefined && !waves.includes(phase.aetosWave))
              ? 'wave'
              : undefined;
  return Object.freeze({
    waves: reason === undefined || reason === 'wave' ? waves : Object.freeze([]),
    ...(phase.aetosWave === undefined ? {} : { selectedWave: phase.aetosWave }),
    ...(reason === undefined ? {} : { reason }),
  });
}
