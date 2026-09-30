import type { Catalog, EncounterEnemyChoice } from '../../catalog-schema';
import type {
  AuthoredEncounterCustomization,
  AuthoredGeneratedEncounterCustomization,
} from '../../authored-project/model';
import type { GeneratedEncounterAssessment } from './generation';

/**
 * The resolved identity and authored decisions of one phase; an
 * `EncounterPhaseAuthoringDomain` satisfies it.
 */
export interface EncounterCompositionPhase {
  readonly selectedEncounterDefinitionKey?: string;
  readonly customization?: readonly {
    readonly key: string;
    readonly selection: { readonly kind: string };
    readonly value?: AuthoredEncounterCustomization;
    readonly retainedChoiceLabels?: readonly { readonly key: string; readonly label: string }[];
  }[];
}

/**
 * How the resolved identity composes its waves: an all-fixed roster, a fixed
 * leading prefix before a generated suffix, an authored generated composition,
 * or native generation without an authored composition.
 */
export type EncounterCompositionDisposition =
  | { readonly key: 'fixed' }
  | { readonly key: 'fixedWavePrefix'; readonly fixedWaveCount: number }
  | { readonly key: 'generated' }
  | { readonly key: 'nativeGenerated' };

export interface EncounterCompositionSpawn {
  readonly enemyKey: string;
  readonly label: string;
  /** Declared fixed count, or the assessed native count of an authored member. */
  readonly count?: number;
}

export interface EncounterCompositionWave {
  readonly waveIndex: number;
  /** This wave's enemies are authorable here. */
  readonly editable: boolean;
  readonly source: 'fixed' | 'authored' | 'native';
  /** Fixed spawns or authored members in native order; a native wave has none. */
  readonly spawns: readonly EncounterCompositionSpawn[];
}

/** The complete per-wave composition of one resolved combat phase. */
export interface EncounterCompositionView {
  readonly encounterDefinitionKey: string;
  readonly label: string;
  readonly disposition: EncounterCompositionDisposition;
  /** The generated decision that authors editable waves. */
  readonly decisionKey?: string;
  /** Declared wave bounds and the known wave count, authored or declared exact. */
  readonly waveCount: { readonly min: number; readonly max: number; readonly value?: number };
  readonly waves: readonly EncounterCompositionWave[];
  /** Some wave is authored or authorable here. */
  readonly editable: boolean;
  /** The assessed shared-enemy decision applies to this composition. */
  readonly sharedEnemy: boolean;
  /** Effective Fear controls active at the assessed checkpoint. */
  readonly fangs: boolean;
  readonly menace: boolean;
}

function spawnLabel(
  choices: readonly EncounterEnemyChoice[],
  key: string,
  retained: readonly { readonly key: string; readonly label: string }[],
): string {
  return (
    choices.find((choice) => choice.key === key)?.label ??
    retained.find((choice) => choice.key === key)?.label ??
    key
  );
}

/**
 * Projects one resolved combat phase into its per-wave composition. Fixed
 * content is declaration-owned; authored and native rows follow the generated
 * decision and, when supplied, its exact assessment. Non-combat identities and
 * combat identities without a wave composition have none.
 */
export function encounterCompositionView(
  catalog: Catalog,
  phase: EncounterCompositionPhase,
  assessment?: GeneratedEncounterAssessment,
): EncounterCompositionView | undefined {
  const definition =
    phase.selectedEncounterDefinitionKey === undefined
      ? undefined
      : catalog.encounterDefinitions.byKey[phase.selectedEncounterDefinitionKey];
  if (definition === undefined || definition.kind !== 'combat') return undefined;
  const identity = { encounterDefinitionKey: definition.key, label: definition.label };
  const fixedRow = (
    waveIndex: number,
    spawns: readonly {
      readonly enemyKey: string;
      readonly label: string;
      readonly count: number;
    }[],
  ): EncounterCompositionWave =>
    Object.freeze({
      waveIndex,
      editable: false,
      source: 'fixed' as const,
      spawns: Object.freeze(spawns.map((spawn) => Object.freeze({ ...spawn }))),
    });
  if (definition.fixedRoster !== undefined) {
    const count = definition.fixedRoster.length;
    return Object.freeze({
      ...identity,
      disposition: Object.freeze({ key: 'fixed' as const }),
      waveCount: Object.freeze({ min: count, max: count, value: count }),
      waves: Object.freeze(definition.fixedRoster.map((wave, index) => fixedRow(index + 1, wave))),
      editable: false,
      sharedEnemy: false,
      fangs: false,
      menace: false,
    });
  }
  const declared = definition.customization?.find(
    (decision) => decision.selection.kind === 'generated',
  );
  if (declared?.selection.kind !== 'generated') return undefined;
  const policy = declared.selection;
  const decision = phase.customization?.find(
    (entry) => entry.key === declared.key && entry.selection.kind === 'generated',
  );
  const value: AuthoredGeneratedEncounterCustomization | undefined =
    decision?.value?.kind === 'generated' ? decision.value : undefined;
  const fixedWaves = policy.fixedWaves ?? [];
  const exact = policy.waveCount.min === policy.waveCount.max ? policy.waveCount.min : undefined;
  const waveCountValue = value?.waveCount ?? exact;
  const members = [...policy.choices, ...policy.fixedEnemies, ...(policy.generatedSeeds ?? [])];
  const retained = decision?.retainedChoiceLabels ?? [];
  const suffixCount = Math.max(0, (waveCountValue ?? fixedWaves.length) - fixedWaves.length);
  const suffix = Array.from({ length: suffixCount }, (_, index): EncounterCompositionWave => {
    const waveIndex = fixedWaves.length + index + 1;
    if (value === undefined)
      return Object.freeze({
        waveIndex,
        editable: decision !== undefined,
        source: 'native' as const,
        spawns: Object.freeze([]),
      });
    const assessed = assessment?.waves.find((wave) => wave.waveIndex === waveIndex);
    const authored = value.waves?.find((wave) => wave.waveIndex === waveIndex);
    const keys = [
      ...(assessed?.seeds.map((seed) => seed.key) ?? []),
      ...(authored?.typeKeys ?? []),
    ];
    return Object.freeze({
      waveIndex,
      editable: true,
      source: 'authored' as const,
      spawns: Object.freeze(
        keys.map((key) => {
          const count = assessed?.countPreview?.find((entry) => entry.key === key)?.count;
          return Object.freeze({
            enemyKey: key,
            label: spawnLabel(members, key, retained),
            ...(count === undefined ? {} : { count }),
          });
        }),
      ),
    });
  });
  const waves = Object.freeze([
    ...fixedWaves.map((spawns, index) =>
      fixedRow(
        index + 1,
        spawns.map((spawn) => ({
          enemyKey: spawn.key,
          label: spawn.label,
          count: spawn.fixedCount!,
        })),
      ),
    ),
    ...suffix,
  ]);
  return Object.freeze({
    ...identity,
    disposition: Object.freeze(
      fixedWaves.length > 0
        ? { key: 'fixedWavePrefix' as const, fixedWaveCount: fixedWaves.length }
        : value === undefined
          ? { key: 'nativeGenerated' as const }
          : { key: 'generated' as const },
    ),
    ...(decision === undefined ? {} : { decisionKey: decision.key }),
    waveCount: Object.freeze({
      min: policy.waveCount.min,
      max: policy.waveCount.max,
      ...(waveCountValue === undefined ? {} : { value: waveCountValue }),
    }),
    waves,
    editable: decision !== undefined,
    // Pre-existing waves suppress the shared highlight (RunLogic GenerateEncounter).
    sharedEnemy:
      value !== undefined &&
      (waveCountValue ?? 0) > 1 &&
      (assessment === undefined
        ? fixedWaves.length === 0
        : assessment.eligibleHighlightKeys.length > 0 ||
          (assessment.introductions?.excludedHighlightKeys.length ?? 0) > 0 ||
          value.highlightKey !== undefined),
    fangs: value !== undefined && assessment?.fangs?.active === true,
    menace: value !== undefined && assessment?.menace?.active === true,
  });
}
