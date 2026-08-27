import type {
  AuthoredLevelResolution,
  JudgmentArcanaAddress,
  FigurineArcanaAddress,
  KeepsakeEquipResultAddress,
  KeepsakeSelectionAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { CandidateProjectionSession } from '@planner/projections/candidateProjection';
import { projectDirectTraitOutcomePicker } from '@planner/projections/directTraitOutcomeProjection';
import type {
  CandidateOptionProjection,
  KeepsakeEquipResultOptionProjection,
} from '@planner/projections/candidateProjection';
import type {
  ContextualPickerModel,
  ContextualPickerProjectionService,
} from '@planner/projections/contextualPicker';

import {
  derivedShopPayloadIntent,
  levelResolutionCommandFor,
} from './reward-child-command-binding';
import type {
  WorkspaceJudgmentArcanaInteraction,
  WorkspaceFigurineArcanaInteraction,
  WorkspaceKeepsakeEquipResultInteraction,
  WorkspaceKeepsakeEquipResultDomain,
  WorkspaceKeepsakeSelectionInteraction,
  WorkspaceLevelResolutionControl,
  WorkspaceLevelResolutionInteraction,
  WorkspaceRewardControl,
  WorkspaceSteadyGrowthControl,
  WorkspaceSteadyGrowthInteraction,
  WorkspaceTranscendentEmbryoControl,
  WorkspaceTranscendentEmbryoInteraction,
  WorkspaceFountainRarityControl,
  WorkspaceFountainRarityInteraction,
} from '../contract';
import { semanticAddressKey } from '@run-planner/engine/authored-project';

function projectKeepsakeSelectionPicker(
  contextualPicker: ContextualPickerProjectionService,
  catalog: Catalog,
  options: readonly CandidateOptionProjection<string>[],
  selectedKey: string | undefined,
  postboss: boolean,
): ContextualPickerModel<string> {
  const projected = contextualPicker.project(
    options,
    (option) =>
      Object.freeze({
        label: catalog.keepsakes.byKey[option.value]?.label ?? option.value,
        selected: option.value === selectedKey,
      }),
    (value) => value,
  );
  if (!postboss) return projected;
  const retain = Object.freeze({
    key: 'retain-current-keepsake',
    value: '',
    label: 'Retain current keepsake',
    state: 'possible' as const,
    selected: selectedKey === undefined,
    disabled: false,
  });
  const retainSection = Object.freeze({
    key: 'current',
    kind: 'category' as const,
    label: 'Current',
    collapsible: false,
    items: Object.freeze([retain]),
  });
  return Object.freeze({
    ...(selectedKey === undefined
      ? { selected: retain }
      : projected.selected === undefined
        ? {}
        : { selected: projected.selected }),
    sections: Object.freeze([retainSection, ...projected.sections]),
  });
}

function equipResultLabel(
  catalog: Catalog,
  resultKind: 'jeweledPom' | 'experimentalHammer' | 'transcendentEmbryo',
  value: string,
): string {
  if (resultKind === 'experimentalHammer' && value === '__exhausted') return 'No compatible Hammer';
  if (resultKind === 'transcendentEmbryo')
    return catalog.chaos.blessings.byKey[value]?.label ?? value;
  return catalog.traits.byKey[value]?.label ?? value;
}

function projectKeepsakeEquipResultDomain(
  contextualPicker: ContextualPickerProjectionService,
  catalog: Catalog,
  resultKind: 'jeweledPom' | 'experimentalHammer' | 'transcendentEmbryo',
  options: readonly KeepsakeEquipResultOptionProjection[],
  selectedValue: string | undefined,
): WorkspaceKeepsakeEquipResultDomain {
  const picker = contextualPicker.project(
    options,
    (option) =>
      Object.freeze({
        label: equipResultLabel(catalog, resultKind, option.value),
        selected: option.value === selectedValue,
      }),
    (value) => value,
  );
  const selected = options.find((option) => option.value === selectedValue);
  return Object.freeze({
    picker,
    ...(selected?.transcendentEmbryoSummary === undefined
      ? {}
      : { transcendentEmbryoSummary: selected.transcendentEmbryoSummary }),
  });
}

/** Binds level, target-resolution, and route-state child interactions. */
export function bindResolutionInteractions(input: {
  readonly catalog: Catalog;
  readonly candidates: CandidateProjectionSession;
  readonly contextualPicker: ContextualPickerProjectionService;
  readonly levelResolutionControls: ReadonlyMap<string, WorkspaceLevelResolutionControl>;
  readonly steadyGrowthControls: ReadonlyMap<string, WorkspaceSteadyGrowthControl>;
  readonly transcendentEmbryoControls: ReadonlyMap<string, WorkspaceTranscendentEmbryoControl>;
  readonly fountainRarityControls: ReadonlyMap<string, WorkspaceFountainRarityControl>;
  readonly derivedShopEntryEdits: ReadonlyMap<
    string,
    NonNullable<WorkspaceRewardControl['derivedShopEntryEdit']>
  >;
  readonly judgmentArcanaControls?: ReadonlyMap<
    string,
    { readonly address: JudgmentArcanaAddress; readonly value: readonly string[] }
  >;
  readonly figurineArcanaControls?: ReadonlyMap<
    string,
    { readonly address: FigurineArcanaAddress; readonly value: readonly string[] }
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
  readonly transcendentEmbryo: ReadonlyMap<string, WorkspaceTranscendentEmbryoInteraction>;
  readonly fountainRarity: ReadonlyMap<string, WorkspaceFountainRarityInteraction>;
  readonly judgmentArcana: ReadonlyMap<string, WorkspaceJudgmentArcanaInteraction>;
  readonly figurineArcana: ReadonlyMap<string, WorkspaceFigurineArcanaInteraction>;
  readonly keepsakeSelections: ReadonlyMap<string, WorkspaceKeepsakeSelectionInteraction>;
  readonly keepsakeEquipResults: ReadonlyMap<string, WorkspaceKeepsakeEquipResultInteraction>;
}> {
  const {
    catalog,
    candidates,
    contextualPicker,
    levelResolutionControls: effectiveLevelResolutionControls,
    steadyGrowthControls: effectiveSteadyGrowthControls,
    transcendentEmbryoControls,
    fountainRarityControls,
    derivedShopEntryEdits,
    judgmentArcanaControls,
    figurineArcanaControls,
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
  const transcendentEmbryo = new Map<string, WorkspaceTranscendentEmbryoInteraction>();
  for (const [key, control] of transcendentEmbryoControls) {
    transcendentEmbryo.set(
      key,
      Object.freeze({
        key,
        owner: control.address,
        intentFor: (blessingKey: string | null) =>
          Object.freeze({
            command: Object.freeze({
              kind: 'ReplaceTranscendentEmbryoTransformation' as const,
              outcome: control.address,
              blessingKey,
            }),
          }),
        forBlessing: (blessingKey: string | null | undefined = control.blessingKey) =>
          Object.freeze({
            load: () => {
              const evaluated = candidates.transcendentEmbryoOutcome(control.address, blessingKey);
              if (evaluated.kind !== 'transcendentEmbryoOutcome') return undefined;
              return Object.freeze({
                emptyNoOp: evaluated.result.emptyNoOp,
                picker: projectDirectTraitOutcomePicker(
                  [
                    ...new Set([
                      ...evaluated.result.eligibleBlessingKeys,
                      ...(blessingKey === null || blessingKey === undefined ? [] : [blessingKey]),
                    ]),
                  ].map((candidate) =>
                    Object.freeze({
                      value: candidate,
                      support: evaluated.result.eligibleBlessingKeys.includes(candidate)
                        ? ('possible' as const)
                        : ('impossible' as const),
                      branchSupport: evaluated.result.branchSupport,
                      selected: candidate === (blessingKey ?? undefined),
                      ...(evaluated.result.eligibleBlessingKeys.includes(candidate)
                        ? {}
                        : { reason: 'unavailable' as const }),
                    }),
                  ),
                  (candidate) => catalog.chaos.blessings.byKey[candidate]?.label ?? candidate,
                  (candidate) => candidate,
                ),
                selectedPossible: evaluated.result.selectedPossible,
              });
            },
          }),
        blessingLabel: (blessingKey: string) =>
          catalog.chaos.blessings.byKey[blessingKey]?.label ?? blessingKey,
      }),
    );
  }
  const fountainRarity = new Map<string, WorkspaceFountainRarityInteraction>();
  for (const [key, control] of fountainRarityControls) {
    fountainRarity.set(
      key,
      Object.freeze({
        key,
        owner: control.address,
        intentFor: (targetTraitKey: string | null) =>
          Object.freeze({
            command: Object.freeze({
              kind: 'ReplaceFountainRarityTarget' as const,
              outcome: control.address,
              targetTraitKey,
            }),
          }),
        forTarget: (targetTraitKey: string | null | undefined = control.targetTraitKey) =>
          Object.freeze({
            load: () => {
              const evaluated = candidates.fountainRarityOutcome(control.address, targetTraitKey);
              if (evaluated.kind !== 'fountainRarityOutcome') return undefined;
              return Object.freeze({
                picker: projectDirectTraitOutcomePicker(
                  [
                    ...new Set([
                      ...evaluated.result.mutationTargetKeys,
                      ...(targetTraitKey === null || targetTraitKey === undefined
                        ? []
                        : [targetTraitKey]),
                    ]),
                  ].map((traitKey) =>
                    (() => {
                      const targetIndex = evaluated.result.mutationTargetKeys.indexOf(traitKey);
                      const available = targetIndex >= 0;
                      const branchSupported =
                        available && evaluated.result.branchSupport[targetIndex] === true;
                      return Object.freeze({
                        value: traitKey,
                        support: branchSupported ? ('possible' as const) : ('impossible' as const),
                        branchSupport: evaluated.result.branchSupport,
                        selected: traitKey === (targetTraitKey ?? undefined),
                        ...(available
                          ? branchSupported
                            ? {}
                            : { reason: 'branchDivergence' as const }
                          : { reason: 'unavailable' as const }),
                      });
                    })(),
                  ),
                  (traitKey) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
                  (traitKey) => traitKey,
                ),
                selectedPossible: evaluated.result.selectedPossible,
                targetRequired: evaluated.result.targetRequired,
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
  const figurineArcana = new Map<string, WorkspaceFigurineArcanaInteraction>();
  for (const [key, control] of figurineArcanaControls ?? []) {
    figurineArcana.set(
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
              kind: 'ReplaceFigurineArcana' as const,
              figurine: control.address,
              arcanaKeys: Object.freeze([...arcanaKeys]),
            }),
          }),
        key,
        load: (arcanaKeys = control.value) =>
          candidates.figurineArcana(control.address, arcanaKeys),
        owner: control.address,
        value: control.value,
      }),
    );
  }
  const keepsakeSelections = new Map<string, WorkspaceKeepsakeSelectionInteraction>();
  for (const [key, control] of keepsakeSelectionControls ?? []) {
    const postboss = control.address.owner !== 'routeStart';
    const selectedKey =
      typeof control.value === 'string'
        ? control.value
        : control.value.kind === 'replace'
          ? control.value.keepsakeKey
          : undefined;
    keepsakeSelections.set(
      key,
      Object.freeze({
        key,
        load: () =>
          projectKeepsakeSelectionPicker(
            contextualPicker,
            catalog,
            candidates.keepsakeSelections(control.address),
            selectedKey,
            postboss,
          ),
        owner: control.address,
        selectedLabel:
          postboss && selectedKey === undefined
            ? 'Retain current keepsake'
            : (catalog.keepsakes.byKey[selectedKey ?? '']?.label ??
              selectedKey ??
              'Choose keepsake'),
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
      const value =
        control.value as import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['experimentalHammer'];
      keepsakeEquipResults.set(
        key,
        Object.freeze({
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
          load: (nextValue = value) =>
            projectKeepsakeEquipResultDomain(
              contextualPicker,
              catalog,
              'experimentalHammer',
              candidates.keepsakeEquipResult(control.address, nextValue),
              nextValue?.kind === 'selected'
                ? nextValue.traitKey
                : nextValue?.kind === 'exhausted'
                  ? '__exhausted'
                  : undefined,
            ),
          selectedLabel:
            value?.kind === 'selected'
              ? equipResultLabel(catalog, 'experimentalHammer', value.traitKey)
              : value?.kind === 'exhausted'
                ? 'No compatible Hammer'
                : 'Choose compatible Hammer',
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
    if (effect.kind === 'transcendentEmbryo') {
      const value =
        control.value as import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['transcendentEmbryo'];
      keepsakeEquipResults.set(
        key,
        Object.freeze({
          key,
          owner: control.address as KeepsakeEquipResultAddress & {
            readonly resultKind: 'transcendentEmbryo';
          },
          ...(control.value === undefined
            ? {}
            : {
                value:
                  control.value as import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['transcendentEmbryo'],
              }),
          load: (nextValue = value) =>
            projectKeepsakeEquipResultDomain(
              contextualPicker,
              catalog,
              'transcendentEmbryo',
              candidates.keepsakeEquipResult(control.address, nextValue),
              nextValue?.blessingKey,
            ),
          selectedLabel:
            value?.blessingKey === undefined
              ? 'Choose Chaos blessing'
              : equipResultLabel(catalog, 'transcendentEmbryo', value.blessingKey),
          intentFor: (
            value: NonNullable<
              import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['transcendentEmbryo']
            >,
          ) =>
            Object.freeze({
              command: Object.freeze({
                kind: 'ReplaceTranscendentEmbryoEquipResult' as const,
                result: control.address as KeepsakeEquipResultAddress & {
                  readonly resultKind: 'transcendentEmbryo';
                },
                value,
              }),
            }),
        }),
      );
      continue;
    }
    if (effect.kind !== 'jeweledPom') continue;
    const value =
      control.value as import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['jeweledPom'];
    keepsakeEquipResults.set(
      key,
      Object.freeze({
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
        load: (nextValue = value) =>
          projectKeepsakeEquipResultDomain(
            contextualPicker,
            catalog,
            'jeweledPom',
            candidates.keepsakeEquipResult(control.address, nextValue),
            nextValue?.traitKey,
          ),
        selectedLabel:
          value?.traitKey === undefined
            ? 'Choose Hades trait'
            : equipResultLabel(catalog, 'jeweledPom', value.traitKey),
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
    transcendentEmbryo,
    fountainRarity,
    judgmentArcana,
    figurineArcana,
    keepsakeSelections,
    keepsakeEquipResults,
  });
}
