import type {
  AuthoredLevelResolution,
  JudgmentArcanaAddress,
  KeepsakeEquipResultAddress,
  KeepsakeSelectionAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { CandidateProjectionSession } from '@planner/projections/candidateProjection';
import { projectDirectTraitOutcomePicker } from '@planner/projections/directTraitOutcomeProjection';

import {
  derivedShopPayloadIntent,
  levelResolutionCommandFor,
} from './reward-child-command-binding';
import type {
  WorkspaceJudgmentArcanaInteraction,
  WorkspaceKeepsakeEquipResultInteraction,
  WorkspaceKeepsakeSelectionInteraction,
  WorkspaceLevelResolutionControl,
  WorkspaceLevelResolutionInteraction,
  WorkspaceRewardControl,
  WorkspaceSteadyGrowthControl,
  WorkspaceSteadyGrowthInteraction,
} from '../contract';
import { semanticAddressKey } from '@run-planner/engine/authored-project';

/** Binds level, target-resolution, and route-state child interactions. */
export function bindResolutionInteractions(input: {
  readonly catalog: Catalog;
  readonly candidates: CandidateProjectionSession;
  readonly levelResolutionControls: ReadonlyMap<string, WorkspaceLevelResolutionControl>;
  readonly steadyGrowthControls: ReadonlyMap<string, WorkspaceSteadyGrowthControl>;
  readonly derivedShopEntryEdits: ReadonlyMap<
    string,
    NonNullable<WorkspaceRewardControl['derivedShopEntryEdit']>
  >;
  readonly judgmentArcanaControls?: ReadonlyMap<
    string,
    { readonly address: JudgmentArcanaAddress; readonly value: readonly string[] }
  >;
  readonly keepsakeSelectionControls?: ReadonlyMap<
    string,
    {
      readonly address: KeepsakeSelectionAddress;
      readonly value:
        | { readonly kind: 'retain' }
        | { readonly kind: 'replace'; readonly keepsakeKey: string }
        | string;
    }
  >;
  readonly keepsakeEquipResultControls?: ReadonlyMap<
    string,
    {
      readonly address: KeepsakeEquipResultAddress;
      readonly value?: import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults[keyof import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults];
    }
  >;
}): Readonly<{
  readonly levelResolutions: ReadonlyMap<string, WorkspaceLevelResolutionInteraction>;
  readonly steadyGrowth: ReadonlyMap<string, WorkspaceSteadyGrowthInteraction>;
  readonly judgmentArcana: ReadonlyMap<string, WorkspaceJudgmentArcanaInteraction>;
  readonly keepsakeSelections: ReadonlyMap<string, WorkspaceKeepsakeSelectionInteraction>;
  readonly keepsakeEquipResults: ReadonlyMap<string, WorkspaceKeepsakeEquipResultInteraction>;
}> {
  const {
    catalog,
    candidates,
    levelResolutionControls: effectiveLevelResolutionControls,
    steadyGrowthControls: effectiveSteadyGrowthControls,
    derivedShopEntryEdits,
    judgmentArcanaControls,
    keepsakeSelectionControls,
    keepsakeEquipResultControls,
  } = input;
  const levelResolutions = new Map<string, WorkspaceLevelResolutionInteraction>();
  for (const [key, control] of effectiveLevelResolutionControls) {
    levelResolutions.set(
      key,
      Object.freeze({
        acquisitionRoleLabel: control.acquisitionRoleLabel,
        intentFor: (value: AuthoredLevelResolution) =>
          derivedShopPayloadIntent(
            derivedShopEntryEdits.get(semanticAddressKey(control.rewardOwner)),
            levelResolutionCommandFor(control.address, value),
          ),
        key,
        levelCount: control.levelCount,
        load: (value = control.value) => candidates.levelResolution(control.address, value),
        owner: control.address,
        traitLabel: (traitKey: string) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
        value: control.value,
      }),
    );
  }
  const steadyGrowth = new Map<string, WorkspaceSteadyGrowthInteraction>();
  for (const [key, control] of effectiveSteadyGrowthControls) {
    steadyGrowth.set(
      key,
      Object.freeze({
        key,
        owner: control.address,
        intentFor: (targetTraitKey: string | null) =>
          Object.freeze({
            command: Object.freeze({
              kind: 'ReplaceSteadyGrowthTarget' as const,
              outcome: control.address,
              targetTraitKey,
            }),
          }),
        forTarget: (targetTraitKey: string | null | undefined = control.targetTraitKey) =>
          Object.freeze({
            load: () => {
              const evaluated = candidates.steadyGrowthOutcome(control.address, targetTraitKey);
              if (evaluated.kind !== 'steadyGrowthOutcome') return undefined;
              return Object.freeze({
                emptyNoOp: evaluated.result.emptyNoOp,
                picker: projectDirectTraitOutcomePicker(
                  [
                    ...new Set([
                      ...evaluated.result.eligibleTargetKeys,
                      ...(targetTraitKey === null || targetTraitKey === undefined
                        ? []
                        : [targetTraitKey]),
                    ]),
                  ].map((traitKey) =>
                    Object.freeze({
                      value: traitKey,
                      support: evaluated.result.eligibleTargetKeys.includes(traitKey)
                        ? ('possible' as const)
                        : ('impossible' as const),
                      branchSupport: evaluated.result.branchSupport,
                      selected: traitKey === (targetTraitKey ?? undefined),
                      ...(evaluated.result.eligibleTargetKeys.includes(traitKey)
                        ? {}
                        : { reason: 'unavailable' as const }),
                    }),
                  ),
                  (traitKey) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
                  (traitKey) => traitKey,
                ),
                selectedPossible: evaluated.result.selectedPossible,
              });
            },
          }),
        traitLabel: (traitKey: string) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
      }),
    );
  }
  const judgmentArcana = new Map<string, WorkspaceJudgmentArcanaInteraction>();
  for (const [key, control] of judgmentArcanaControls ?? []) {
    judgmentArcana.set(
      key,
      Object.freeze({
        choices: Object.freeze(
          catalog.arcanaCards.values.map((card) =>
            Object.freeze({ label: card.label, value: card.key }),
          ),
        ),
        intentFor: (arcanaKeys: readonly string[]) =>
          Object.freeze({
            command: Object.freeze({
              kind: 'ReplaceJudgmentArcana' as const,
              judgment: control.address,
              arcanaKeys: Object.freeze([...arcanaKeys]),
            }),
          }),
        key,
        load: (arcanaKeys = control.value) =>
          candidates.judgmentArcana(control.address, arcanaKeys),
        owner: control.address,
        value: control.value,
      }),
    );
  }
  const keepsakeSelections = new Map<string, WorkspaceKeepsakeSelectionInteraction>();
  for (const [key, control] of keepsakeSelectionControls ?? []) {
    const postboss = control.address.owner !== 'routeStart';
    keepsakeSelections.set(
      key,
      Object.freeze({
        choices: Object.freeze(
          catalog.keepsakes.values.map((keepsake) =>
            Object.freeze({ label: keepsake.label, value: keepsake.key }),
          ),
        ),
        key,
        load: () => candidates.keepsakeSelections(control.address),
        owner: control.address,
        value: control.value,
        replaceIntent: (keepsakeKey: string) =>
          Object.freeze({
            command: postboss
              ? Object.freeze({
                  kind: 'ReplacePostbossKeepsake' as const,
                  selection: control.address as Extract<
                    KeepsakeSelectionAddress,
                    {
                      readonly owner: import('@run-planner/engine/authored-project').OccurrenceAddress;
                    }
                  >,
                  value: Object.freeze({ kind: 'replace' as const, keepsakeKey }),
                })
              : Object.freeze({
                  kind: 'ReplaceStartingKeepsake' as const,
                  selection: control.address as Extract<
                    KeepsakeSelectionAddress,
                    { readonly owner: 'routeStart' }
                  >,
                  keepsakeKey,
                }),
          }),
        ...(postboss
          ? {
              retainIntent: () =>
                Object.freeze({
                  command: Object.freeze({
                    kind: 'ReplacePostbossKeepsake' as const,
                    selection: control.address as Extract<
                      KeepsakeSelectionAddress,
                      {
                        readonly owner: import('@run-planner/engine/authored-project').OccurrenceAddress;
                      }
                    >,
                    value: Object.freeze({ kind: 'retain' as const }),
                  }),
                }),
            }
          : {}),
      }),
    );
  }
  const keepsakeEquipResults = new Map<string, WorkspaceKeepsakeEquipResultInteraction>();
  for (const [key, control] of keepsakeEquipResultControls ?? []) {
    const effect = catalog.keepsakes.values.find(
      (keepsake) => keepsake.effect?.kind === control.address.resultKind,
    )?.effect;
    if (effect === undefined)
      throw new Error(`Missing ${control.address.resultKind} keepsake descriptor`);
    if (effect.kind === 'experimentalHammer') {
      keepsakeEquipResults.set(
        key,
        Object.freeze({
          choices: Object.freeze(
            catalog.traits.values
              .filter((trait) => trait.hammerCompatibility !== undefined)
              .map((trait) => Object.freeze({ label: trait.label, value: trait.key }))
              .concat([Object.freeze({ label: 'No compatible Hammer', value: '__exhausted' })]),
          ),
          key,
          owner: control.address as KeepsakeEquipResultAddress & {
            readonly resultKind: 'experimentalHammer';
          },
          ...(control.value === undefined
            ? {}
            : {
                value:
                  control.value as import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['experimentalHammer'],
              }),
          load: (
            value = control.value as import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['experimentalHammer'],
          ) => candidates.keepsakeEquipResult(control.address, value),
          intentFor: (
            value: NonNullable<
              import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['experimentalHammer']
            >,
          ) =>
            Object.freeze({
              command: Object.freeze({
                kind: 'ReplaceExperimentalHammerEquipResult' as const,
                result: control.address as KeepsakeEquipResultAddress & {
                  readonly resultKind: 'experimentalHammer';
                },
                value,
              }),
            }),
        }),
      );
      continue;
    }
    if (effect.kind !== 'jeweledPom') continue;
    keepsakeEquipResults.set(
      key,
      Object.freeze({
        choices: Object.freeze(
          (catalog.traitGivers.byKey[effect.giverKey]?.traitKeys ?? []).map((traitKey) =>
            Object.freeze({
              label: catalog.traits.byKey[traitKey]?.label ?? traitKey,
              value: traitKey,
            }),
          ),
        ),
        key,
        owner: control.address as KeepsakeEquipResultAddress & {
          readonly resultKind: 'jeweledPom';
        },
        ...(control.value === undefined
          ? {}
          : {
              value:
                control.value as import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['jeweledPom'],
            }),
        load: (
          value = control.value as import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['jeweledPom'],
        ) => candidates.keepsakeEquipResult(control.address, value),
        intentFor: (
          value: NonNullable<
            import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['jeweledPom']
          >,
        ) =>
          Object.freeze({
            command: Object.freeze({
              kind: 'ReplaceJeweledPomEquipResult' as const,
              result: control.address as KeepsakeEquipResultAddress & {
                readonly resultKind: 'jeweledPom';
              },
              value,
            }),
          }),
      }),
    );
  }
  return Object.freeze({
    levelResolutions,
    steadyGrowth,
    judgmentArcana,
    keepsakeSelections,
    keepsakeEquipResults,
  });
}
