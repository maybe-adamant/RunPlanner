import {
  createCirceResolutionAddress,
  createEchoPomTargetAddress,
  createEchoLastRunBoonAddress,
  createTraitAcquisitionTargetAddress,
  createAllTogetherSetAddress,
  optionIndex,
  semanticAddressKey,
  seaStarDuplicateSiteKey,
  SEA_STAR_DUPLICATE_ENTRY_KEY,
  type TraitOfferAddress,
  type LevelResolutionAddress,
  type JudgmentArcanaAddress,
  type KeepsakeSelectionAddress,
  type KeepsakeEquipResultAddress,
  type DerivedShopEntryEditCommand,
  type ProjectCommand,
  type AuthoredRewardState,
} from '@run-planner/engine/authored-project';
import type {
  AuthoredLevelResolution,
  AuthoredCirceResolution,
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
  AuthoredEchoLastRunBoonOffer,
  TraitOptionKey,
} from '@run-planner/engine/authored-project';
import type { Catalog, TraitRarity } from '@run-planner/engine/catalog-schema';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import {
  evaluateEchoLastRunBoonDraftSupport,
  echoLastRunBoonRarityCandidates,
  echoLastRunBoonTraitCandidatesForRow,
} from '@run-planner/engine/simulation';
import type { CandidateProjectionSession } from '@planner/projections/candidateProjection';
import type { RewardPickerProjectionService } from '@planner/projections/rewardPicker';
import {
  projectDirectTraitOutcomePicker,
  withDirectTraitOutcomeSelection,
  withoutDirectTraitOutcomeValues,
} from '@planner/projections/directTraitOutcomeProjection';

import { StructuredWorkspaceProjectionContractError, workspaceInteractionKey } from '../contract';
import type {
  WorkspaceRewardControl,
  WorkspaceRewardInteraction,
  WorkspaceTraitOfferControl,
  WorkspaceLevelResolutionControl,
  WorkspaceLevelResolutionInteraction,
  WorkspaceJudgmentArcanaInteraction,
  WorkspaceKeepsakeSelectionInteraction,
  WorkspaceKeepsakeEquipResultInteraction,
  WorkspaceTraitOfferInteraction,
  WorkspaceNaturalSelectionInteraction,
  WorkspaceSteadyGrowthControl,
  WorkspaceSteadyGrowthInteraction,
  WorkspaceCommandIntent,
  WorkspaceAcquisitionConversionInteraction,
} from '../contract';

type RewardPayloadCommand = Extract<
  ProjectCommand,
  {
    readonly kind:
      | 'ReplaceIncomingReward'
      | 'ReplaceLocalReward'
      | 'ReplaceRewardWheelOffer'
      | 'ReplaceShopOffer'
      | 'ReplaceAcquisitionEntryOffer';
  }
>;

function derivedShopPayloadIntent<Command extends ProjectCommand>(
  materialization: WorkspaceRewardControl['derivedShopEntryEdit'],
  edit: Command,
): WorkspaceCommandIntent<
  | Command
  | DerivedShopEntryEditCommand
  | Extract<ProjectCommand, { readonly kind: 'ReplaceAcquisitionDisposition' }>
> {
  if (materialization === undefined) return Object.freeze({ command: edit });
  if (
    edit.kind !== 'ReplaceAcquisitionEntryOffer' &&
    edit.kind !== 'ReplaceTraitOffer' &&
    edit.kind !== 'ReplaceGorgonAthenaOffer' &&
    edit.kind !== 'ReplaceTraitSelection' &&
    edit.kind !== 'ReplaceLevelResolution' &&
    edit.kind !== 'ReplaceAcquisitionDisposition'
  )
    throw new StructuredWorkspaceProjectionContractError(
      `${edit.kind} cannot edit a derived Shop entry`,
    );
  return Object.freeze({
    command: Object.freeze({
      kind: 'EditDerivedShopEntry' as const,
      ...materialization,
      edit: edit as DerivedShopEntryEditCommand['edit'],
    }),
  });
}

function rewardCommandFor(
  owner: WorkspaceRewardControl['owner'],
  value: Parameters<WorkspaceRewardInteraction['intentFor']>[0],
): RewardPayloadCommand {
  switch (owner.kind) {
    case 'incomingReward':
      return Object.freeze({ kind: 'ReplaceIncomingReward', reward: owner.address, value });
    case 'localReward':
      return Object.freeze({ kind: 'ReplaceLocalReward', reward: owner.address, value });
    case 'rewardWheelOffer':
      return Object.freeze({ kind: 'ReplaceRewardWheelOffer', offer: owner.address, value });
    case 'shopOffer':
      return Object.freeze({ kind: 'ReplaceShopOffer', offer: owner.address, value });
    case 'acquisitionEntry':
      return Object.freeze({
        kind: 'ReplaceAcquisitionEntryOffer',
        entry: owner.address,
        value,
      });
  }
}

function rewardIntentFor(
  owner: WorkspaceRewardControl['owner'],
  value: Parameters<WorkspaceRewardInteraction['intentFor']>[0],
  materialization: WorkspaceRewardControl['derivedShopEntryEdit'],
): WorkspaceCommandIntent<
  | RewardPayloadCommand
  | DerivedShopEntryEditCommand
  | Extract<ProjectCommand, { readonly kind: 'ReplaceAcquisitionDisposition' }>
> {
  const command = rewardCommandFor(owner, value);
  if (materialization === undefined) return Object.freeze({ command });
  if (command.kind !== 'ReplaceAcquisitionEntryOffer') {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(owner.address)} cannot own a derived Shop payload edit`,
    );
  }
  return derivedShopPayloadIntent(materialization, command);
}

function traitOfferCommandFor(
  owner: TraitOfferAddress,
  value: AuthoredTraitOffer,
): Extract<ProjectCommand, { readonly kind: 'ReplaceTraitOffer' | 'ReplaceGorgonAthenaOffer' }> {
  if (owner.owner.kind === 'gorgonPhase') {
    if (value.kind !== 'traits' || value.options.length !== 3) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner)} requires exactly three Gorgon Athena traits`,
      );
    }
    return Object.freeze({
      kind: 'ReplaceGorgonAthenaOffer' as const,
      trait: owner,
      value: Object.freeze({
        traitKeys: Object.freeze(value.options.map((option) => option.traitKey)) as readonly [
          string,
          string,
          string,
        ],
        selectedOptionKey: value.selectedOptionKey,
      }),
    });
  }
  return Object.freeze({ kind: 'ReplaceTraitOffer' as const, trait: owner, value });
}

function ordinaryTraitOfferCommandFor(
  owner: TraitOfferAddress,
  value: AuthoredTraitOffer,
): Extract<ProjectCommand, { readonly kind: 'ReplaceTraitOffer' }> {
  return Object.freeze({ kind: 'ReplaceTraitOffer' as const, trait: owner, value });
}

function levelResolutionCommandFor(
  owner: LevelResolutionAddress,
  value: AuthoredLevelResolution,
): Extract<ProjectCommand, { readonly kind: 'ReplaceLevelResolution' }> {
  return Object.freeze({
    kind: 'ReplaceLevelResolution' as const,
    levelResolution: owner,
    value,
  });
}

export interface WorkspaceRewardChildInteractionCatalog {
  readonly rewards: ReadonlyMap<string, WorkspaceRewardInteraction>;
  readonly acquisitionConversions: ReadonlyMap<string, WorkspaceAcquisitionConversionInteraction>;
  readonly traitOffers: ReadonlyMap<string, WorkspaceTraitOfferInteraction>;
  readonly levelResolutions: ReadonlyMap<string, WorkspaceLevelResolutionInteraction>;
  readonly steadyGrowth: ReadonlyMap<string, WorkspaceSteadyGrowthInteraction>;
  readonly judgmentArcana: ReadonlyMap<string, WorkspaceJudgmentArcanaInteraction>;
  readonly keepsakeSelections: ReadonlyMap<string, WorkspaceKeepsakeSelectionInteraction>;
  readonly keepsakeEquipResults: ReadonlyMap<string, WorkspaceKeepsakeEquipResultInteraction>;
}

export function bindRewardChildInteractions(input: {
  readonly catalog: Catalog;
  readonly candidates: CandidateProjectionSession;
  readonly project: import('@run-planner/engine/simulation').ProjectEvaluationAssembly['project'];
  readonly rewardControls: ReadonlyMap<string, WorkspaceRewardControl>;
  readonly traitControls?: ReadonlyMap<string, WorkspaceTraitOfferControl>;
  readonly levelResolutionControls?: ReadonlyMap<string, WorkspaceLevelResolutionControl>;
  readonly steadyGrowthControls?: ReadonlyMap<string, WorkspaceSteadyGrowthControl>;
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
  readonly rewardPicker: RewardPickerProjectionService;
  readonly traitDomain: import('../contract').StructuredWorkspaceContextualServices['traitDomain'];
}): WorkspaceRewardChildInteractionCatalog {
  const {
    catalog,
    candidates,
    project,
    rewardControls,
    traitControls,
    levelResolutionControls,
    steadyGrowthControls,
    judgmentArcanaControls,
    keepsakeSelectionControls,
    keepsakeEquipResultControls,
    rewardPicker,
    traitDomain,
  } = input;
  const evaluatedConversions = new Map<
    string,
    ReturnType<CandidateProjectionSession['acquisitionConversion']>
  >();
  const artificerOptionsByReplacement = new Map<string, readonly AuthoredRewardState[]>();
  for (const control of rewardControls.values()) {
    for (const conversion of control.conversions ?? []) {
      const key = workspaceInteractionKey(conversion.address);
      const evaluated = candidates.acquisitionConversion(conversion.address);
      evaluatedConversions.set(key, evaluated);
      if (
        evaluated.kind !== 'acquisitionConversion' ||
        evaluated.result.artificerReplacementAddress === undefined
      )
        continue;
      artificerOptionsByReplacement.set(
        semanticAddressKey(evaluated.result.artificerReplacementAddress),
        evaluated.result.artificerReplacementOptions ?? Object.freeze([]),
      );
    }
  }

  const effectiveTraitControls = new Map(traitControls ?? []);
  const effectiveLevelResolutionControls = new Map(levelResolutionControls ?? []);
  const effectiveSteadyGrowthControls = new Map(steadyGrowthControls ?? []);
  for (const control of rewardControls.values()) {
    for (const trait of control.traitOffers ?? [])
      effectiveTraitControls.set(workspaceInteractionKey(trait.address), trait);
    for (const level of control.levelResolutions ?? [])
      effectiveLevelResolutionControls.set(workspaceInteractionKey(level.address), level);
  }

  const derivedShopEntryEdits = new Map<
    string,
    NonNullable<WorkspaceRewardControl['derivedShopEntryEdit']>
  >();
  for (const control of rewardControls.values()) {
    if (control.derivedShopEntryEdit !== undefined) {
      derivedShopEntryEdits.set(
        semanticAddressKey(control.owner.address),
        control.derivedShopEntryEdit,
      );
    }
  }

  const rewards = new Map<string, WorkspaceRewardInteraction>();
  for (const [key, control] of rewardControls) {
    const artificerOptions = artificerOptionsByReplacement.get(
      semanticAddressKey(control.owner.address),
    );
    const rewardTypes =
      control.kind === 'countedReward'
        ? candidates.countedRewardTypes(control.owner, control.binding, control.offer?.rewardType)
        : Object.freeze([
            ...new Set([
              ...control.rewardTypes,
              ...(artificerOptions ?? []).map((option) => option.offer.rewardType),
            ]),
          ]);
    rewards.set(
      key,
      Object.freeze({
        authoredRewardTypes: rewardTypes,
        choiceLabel: rewardPicker.choiceLabel,
        intentFor: (offer: ResolvedRewardOffer) =>
          rewardIntentFor(control.owner, offer, control.derivedShopEntryEdit),
        key,
        load: () => candidates.rewardDomain(control.owner, rewardTypes, control.offer ?? undefined),
        model: rewardPicker.project,
        owner: control.owner.address,
        selected: control.offer,
        summary: rewardPicker.summary,
      }),
    );
  }

  const acquisitionConversions = new Map();
  for (const control of rewardControls.values()) {
    for (const conversion of control.conversions ?? []) {
      const key = workspaceInteractionKey(conversion.address);
      const evaluated =
        evaluatedConversions.get(key) ?? candidates.acquisitionConversion(conversion.address);
      const owner = conversion.address.owner;
      const occurrenceId =
        owner.kind === 'acquisitionEntry'
          ? owner.site.owner.kind === 'occurrence'
            ? owner.site.owner.occurrenceId
            : undefined
          : owner.kind === 'encounterPhase'
            ? owner.owner.occurrenceId
            : owner.kind === 'gorgonPhase'
              ? owner.encounter.owner.occurrenceId
              : owner.occurrenceId;
      const occurrence =
        occurrenceId === undefined
          ? undefined
          : project.routes
              .find((route) => route.routeKey === conversion.address.routeKey)
              ?.biomes.find((biome) => biome.biomeKey === conversion.address.biomeKey)
              ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
      const seaStarProcced =
        occurrence?.acquisitionSites?.[seaStarDuplicateSiteKey(conversion.address)]
          ?.pickupEntries?.[SEA_STAR_DUPLICATE_ENTRY_KEY] !== undefined;
      acquisitionConversions.set(
        key,
        Object.freeze({
          ...(() => {
            return evaluated.kind === 'acquisitionConversion'
              ? {
                  timePieceSupported: evaluated.result.timePieceSupported,
                  artificerSupported: evaluated.result.artificerSupported,
                  seaStarSupported: evaluated.result.seaStarSupported,
                  visible:
                    evaluated.result.timePieceSupported ||
                    evaluated.result.artificerSupported ||
                    evaluated.result.seaStarSupported ||
                    seaStarProcced ||
                    conversion.value.kind !== 'normal',
                }
              : {
                  timePieceSupported: false,
                  artificerSupported: false,
                  seaStarSupported: false,
                  visible: seaStarProcced || conversion.value.kind !== 'normal',
                };
          })(),
          intentFor: (
            value: import('@run-planner/engine/authored-project').AcquisitionDisposition,
          ) =>
            derivedShopPayloadIntent(
              control.derivedShopEntryEdit,
              Object.freeze({
                kind: 'ReplaceAcquisitionDisposition' as const,
                acquisition: conversion.address,
                value,
              }),
            ),
          seaStarIntentFor: (procced: boolean) =>
            Object.freeze({
              command: Object.freeze({
                kind: 'ReplaceSeaStarResult' as const,
                acquisition: conversion.address,
                procced,
              }),
              focus: Object.freeze({ owner: conversion.address, timing: 'after' as const }),
            }),
          key,
          owner: conversion.address,
          seaStarProcced,
          value: conversion.value,
        }),
      );
    }
  }

  const traitOffers = new Map<string, WorkspaceTraitOfferInteraction>();
  for (const [key, control] of effectiveTraitControls) {
    const derivedShopEntryEdit = derivedShopEntryEdits.get(semanticAddressKey(control.rewardOwner));
    const traitChoices = Object.freeze(
      control.giver.traitKeys.map((traitKey) => {
        const trait = catalog.traits.byKey[traitKey];
        if (trait === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${key} references unknown trait ${traitKey}`,
          );
        }
        return Object.freeze({ label: trait.label, value: trait.key });
      }),
    );
    const startingDraft = () =>
      candidates.traitOfferStartingDraft(control.address, control.giver.key);
    const load = (value = control.offer ?? startingDraft()) =>
      value === undefined ? Object.freeze([]) : candidates.traitOffer(control.address, value);
    const optionDomains = new Map<
      string,
      ReturnType<WorkspaceTraitOfferInteraction['optionDomain']>
    >();
    const optionDomain = (value: AuthoredTraitOffer, optionKey: TraitOptionKey) => {
      if (value.kind !== 'traits') {
        throw new StructuredWorkspaceProjectionContractError(
          `${semanticAddressKey(control.address)} Fallback Gold has no trait option domain`,
        );
      }
      const prepared = traitDomain.prepare(control.giver, value, optionKey);
      const domainKey = `${optionKey}:${JSON.stringify(value)}:${prepared.variants
        .map((option) => `${option.traitKey}:${option.rarity ?? ''}:${option.targetTraitKey ?? ''}`)
        .join(',')}`;
      const existing = optionDomains.get(domainKey);
      if (existing !== undefined) return existing;
      const option = value.options[optionIndex(optionKey)];
      const declaration = option === undefined ? undefined : catalog.traits.byKey[option.traitKey];
      const hasTargetPicker =
        option !== undefined &&
        value.selectedOptionKey === optionKey &&
        declaration?.targetedAcquisition !== undefined;
      const traitAcquisitionTargetControl = hasTargetPicker
        ? Object.freeze({
            address: createTraitAcquisitionTargetAddress(control.address, optionKey),
            marker: control.traitAcquisitionTarget?.marker ?? control.marker,
            optionKey,
            ...(option?.targetTraitKey === undefined ? {} : { value: option.targetTraitKey }),
          })
        : undefined;
      const circeControl =
        value.selectedOptionKey === optionKey && declaration?.selectedDisposition.kind === 'circe'
          ? Object.freeze({
              // The draft selection owns this exact child even before a save
              // republishes workspace controls. Retain the persisted marker
              // only as presentation fallback; the semantic address is exact.
              address: createCirceResolutionAddress(control.address, optionKey),
              marker: control.circeResolution?.marker ?? control.marker,
              optionKey,
              ...(option?.circeResolution === undefined ? {} : { value: option.circeResolution }),
            })
          : undefined;
      const echoPomControl =
        value.selectedOptionKey === optionKey &&
        declaration?.selectedDisposition.kind === 'echo' &&
        declaration.selectedDisposition.effect === 'doubleLevel'
          ? Object.freeze({
              address: createEchoPomTargetAddress(control.address, optionKey),
              marker: control.echoPomTarget?.marker ?? control.marker,
              optionKey,
              ...(option === undefined || !('echoPomTarget' in option)
                ? {}
                : { value: option.echoPomTarget }),
            })
          : undefined;
      const echoLastRunBoonControl =
        value.selectedOptionKey === optionKey &&
        declaration?.selectedDisposition.kind === 'echo' &&
        declaration.selectedDisposition.effect === 'lastRunBoon'
          ? Object.freeze({
              address: createEchoLastRunBoonAddress(control.address, optionKey),
              marker: control.echoLastRunBoon?.marker ?? control.marker,
              optionKey,
              ...(option?.echoLastRunBoon === undefined ? {} : { value: option.echoLastRunBoon }),
            })
          : undefined;
      const allTogetherSetControls =
        value.selectedOptionKey === optionKey &&
        declaration?.selectedDisposition.kind === 'directTraitSets'
          ? Object.freeze(
              declaration.selectedDisposition.sets.map((set) => {
                const address = createAllTogetherSetAddress(control.address, optionKey, set.key);
                const persisted = control.allTogetherSets?.find(
                  (candidate) => candidate.setKey === set.key,
                );
                return Object.freeze({
                  address,
                  marker: persisted?.marker ?? control.marker,
                  optionKey,
                  setKey: set.key,
                  ...(option?.allTogetherResult === undefined
                    ? {}
                    : {
                        value: option.allTogetherResult[set.key],
                        valueLabel:
                          option.allTogetherResult[set.key] === null
                            ? 'No grant (set exhausted)'
                            : (catalog.traits.byKey[option.allTogetherResult[set.key]!]?.label ??
                              option.allTogetherResult[set.key]!),
                      }),
                });
              }),
            )
          : undefined;
      const naturalSelectionControl =
        value.selectedOptionKey === optionKey && control.naturalSelection?.optionKey === optionKey
          ? control.naturalSelection
          : undefined;
      let projected: ReturnType<typeof traitDomain.project> | undefined;
      const bound = Object.freeze({
        hasTargetPicker,
        ...(traitAcquisitionTargetControl === undefined
          ? {}
          : { traitAcquisitionTarget: traitAcquisitionTargetControl }),
        ...(circeControl === undefined
          ? {}
          : {
              circeResolution: Object.freeze({
                control: circeControl,
                intentFor: (
                  offer: AuthoredTraitOfferTraits,
                  resolution: AuthoredCirceResolution,
                ) => {
                  const index = optionIndex(optionKey);
                  const existing = offer.options[index];
                  if (existing === undefined)
                    throw new StructuredWorkspaceProjectionContractError(
                      `${semanticAddressKey(control.address)} is missing ${optionKey}`,
                    );
                  const options = [...offer.options];
                  options[index] = Object.freeze({ ...existing, circeResolution: resolution });
                  return derivedShopPayloadIntent(
                    derivedShopEntryEdit,
                    ordinaryTraitOfferCommandFor(
                      control.address,
                      Object.freeze({
                        ...offer,
                        options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
                      }),
                    ),
                  );
                },
                forOffer: (offer: AuthoredTraitOfferTraits) =>
                  Object.freeze({
                    load: () => {
                      const evaluated = candidates.circeResolution(
                        control.address,
                        offer,
                        optionKey,
                      );
                      if (evaluated.kind !== 'circeResolutionDomain') return undefined;
                      const result = evaluated.result;
                      const arcanaLabel = (key: string) =>
                        catalog.arcanaCards.byKey[key]?.label ?? key;
                      const vowLabel = (key: string) => catalog.fearVows.byKey[key]?.label ?? key;
                      return Object.freeze({
                        arcanaPicker: projectDirectTraitOutcomePicker(
                          result.arcanaCandidates,
                          arcanaLabel,
                          (key) => key,
                        ),
                        arcanaPickerFor: (selectedKeys: readonly string[]) =>
                          projectDirectTraitOutcomePicker(
                            withDirectTraitOutcomeSelection(
                              withoutDirectTraitOutcomeValues(
                                result.arcanaCandidates,
                                selectedKeys,
                              ),
                              Object.freeze([]),
                            ),
                            arcanaLabel,
                            (key) => key,
                          ),
                        branchAgreement: result.branchAgreement,
                        effect: result.effect,
                        outerAvailable: result.outerAvailable,
                        requiredCount: result.requiredCount,
                        vowPicker: projectDirectTraitOutcomePicker(
                          result.vowCandidates,
                          vowLabel,
                          (key) => key,
                        ),
                      });
                    },
                  }),
              }),
            }),
        ...(echoPomControl === undefined
          ? {}
          : {
              echoPomTarget: Object.freeze({
                control: echoPomControl,
                intentFor: (offer: AuthoredTraitOfferTraits, targetTraitKey: string | null) => {
                  const index = optionIndex(optionKey);
                  const existing = offer.options[index];
                  if (existing === undefined)
                    throw new StructuredWorkspaceProjectionContractError(
                      `${semanticAddressKey(control.address)} is missing ${optionKey}`,
                    );
                  const options = [...offer.options];
                  options[index] = Object.freeze({ ...existing, echoPomTarget: targetTraitKey });
                  return derivedShopPayloadIntent(
                    derivedShopEntryEdit,
                    ordinaryTraitOfferCommandFor(
                      control.address,
                      Object.freeze({
                        ...offer,
                        options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
                      }),
                    ),
                  );
                },
                forOffer: (offer: AuthoredTraitOfferTraits) =>
                  Object.freeze({
                    load: () => {
                      const evaluated = candidates.echoPomTarget(control.address, offer, optionKey);
                      if (evaluated.kind !== 'echoPomTargetDomain') return undefined;
                      return Object.freeze({
                        picker: projectDirectTraitOutcomePicker(
                          evaluated.result.candidates,
                          (key) =>
                            key === null
                              ? 'No eligible target'
                              : (catalog.traits.byKey[key]?.label ?? key),
                          (key) => key ?? '__none__',
                        ),
                        emptyNoOpAllowed: evaluated.result.emptyNoOpAllowed,
                      });
                    },
                  }),
              }),
            }),
        ...(echoLastRunBoonControl === undefined
          ? {}
          : {
              echoLastRunBoon: Object.freeze({
                control: echoLastRunBoonControl,
                intentFor: (
                  offer: AuthoredTraitOfferTraits,
                  child: AuthoredEchoLastRunBoonOffer,
                ) => {
                  const index = optionIndex(optionKey);
                  const existing = offer.options[index];
                  if (existing === undefined)
                    throw new StructuredWorkspaceProjectionContractError(
                      `${semanticAddressKey(control.address)} is missing ${optionKey}`,
                    );
                  const options = [...offer.options];
                  options[index] = Object.freeze({ ...existing, echoLastRunBoon: child });
                  return derivedShopPayloadIntent(
                    derivedShopEntryEdit,
                    ordinaryTraitOfferCommandFor(
                      control.address,
                      Object.freeze({
                        ...offer,
                        options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
                      }),
                    ),
                  );
                },
                forOffer: (offer: AuthoredTraitOfferTraits) =>
                  Object.freeze({
                    load: () => {
                      const evaluated = candidates.echoLastRunBoon(
                        control.address,
                        offer,
                        optionKey,
                      );
                      if (evaluated.kind !== 'echoLastRunBoonDomain') return undefined;
                      const domainCandidates = evaluated.result.candidates;
                      const identityKey = (identity: {
                        readonly giverKey: string;
                        readonly traitKey: string;
                      }) => `${identity.giverKey}:${identity.traitKey}`;
                      const identityLabel = (identity: {
                        readonly giverKey: string;
                        readonly traitKey: string;
                      }) =>
                        `${catalog.traitGivers.byKey[identity.giverKey]?.label ?? identity.giverKey} · ${catalog.traits.byKey[identity.traitKey]?.label ?? identity.traitKey}`;
                      return Object.freeze({
                        draftSupportFor: (
                          rows: readonly {
                            readonly identity?: {
                              readonly giverKey: string;
                              readonly traitKey: string;
                            };
                            readonly rarity?: TraitRarity;
                            readonly targetTraitKey?: string;
                          }[],
                          selectedIndex: number,
                        ) =>
                          evaluateEchoLastRunBoonDraftSupport(
                            domainCandidates,
                            rows.map((row) =>
                              Object.freeze({
                                ...(row.identity === undefined
                                  ? {}
                                  : {
                                      giverKey: row.identity.giverKey,
                                      traitKey: row.identity.traitKey,
                                    }),
                                ...(row.rarity === undefined ? {} : { rarity: row.rarity }),
                                ...(row.targetTraitKey === undefined
                                  ? {}
                                  : { targetTraitKey: row.targetTraitKey }),
                              }),
                            ),
                            selectedIndex,
                          ),
                        effectiveRarityFor: (
                          option: AuthoredEchoLastRunBoonOffer['options'][number],
                        ) =>
                          domainCandidates.find(
                            (candidate) =>
                              candidate.option.giverKey === option.giverKey &&
                              candidate.option.traitKey === option.traitKey &&
                              candidate.option.rarity === option.rarity,
                          )?.effectiveRarity,
                        labelFor: identityLabel,
                        summaryFor: (child: AuthoredEchoLastRunBoonOffer) => {
                          const selected = child.options[optionIndex(child.selectedOptionKey)];
                          if (selected === undefined) return 'Choice required';
                          const candidate = domainCandidates.find(
                            (entry) =>
                              entry.option.giverKey === selected.giverKey &&
                              entry.option.traitKey === selected.traitKey &&
                              entry.option.rarity === selected.rarity,
                          );
                          const rarity =
                            candidate?.effectiveRarity === undefined ||
                            candidate.effectiveRarity === selected.rarity
                              ? selected.rarity
                              : `${selected.rarity} → ${candidate.effectiveRarity}`;
                          return `${identityLabel(selected)} · ${rarity}`;
                        },
                        rarityPickerFor: (
                          identity: {
                            readonly giverKey: string;
                            readonly traitKey: string;
                          },
                          selected?: TraitRarity,
                        ) =>
                          projectDirectTraitOutcomePicker(
                            echoLastRunBoonRarityCandidates(domainCandidates, identity, selected),
                            (rarity) => rarity,
                            (rarity) => rarity,
                          ),
                        targetPickerFor: (
                          option: AuthoredEchoLastRunBoonOffer['options'][number],
                        ) => {
                          const candidate = domainCandidates.find(
                            (entry) =>
                              entry.option.giverKey === option.giverKey &&
                              entry.option.traitKey === option.traitKey &&
                              entry.option.rarity === option.rarity,
                          );
                          return projectDirectTraitOutcomePicker(
                            candidate?.targetCandidates ?? Object.freeze([]),
                            (traitKey) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
                            (traitKey) => traitKey,
                          );
                        },
                        targetRequiredFor: (identity: {
                          readonly giverKey: string;
                          readonly traitKey: string;
                        }) =>
                          catalog.traits.byKey[identity.traitKey]?.targetedAcquisition !==
                          undefined,
                        traitPickerFor: (
                          occupiedTraitKeys: readonly string[],
                          selected?: {
                            readonly giverKey: string;
                            readonly traitKey: string;
                          },
                        ) =>
                          projectDirectTraitOutcomePicker(
                            echoLastRunBoonTraitCandidatesForRow(
                              domainCandidates,
                              occupiedTraitKeys,
                              selected,
                            ),
                            identityLabel,
                            identityKey,
                          ),
                      });
                    },
                  }),
              }),
            }),
        ...(allTogetherSetControls === undefined
          ? {}
          : {
              allTogetherSets: Object.freeze(
                allTogetherSetControls.map((setControl) =>
                  Object.freeze({
                    control: setControl,
                    forOffer: (offer: AuthoredTraitOfferTraits) =>
                      Object.freeze({
                        load: () => {
                          const evaluated = candidates.allTogetherSet(
                            control.address,
                            offer,
                            optionKey,
                            setControl.setKey,
                          );
                          if (evaluated.kind !== 'allTogetherSetDomain') return undefined;
                          return Object.freeze({
                            picker: projectDirectTraitOutcomePicker(
                              evaluated.result.candidates,
                              (value) =>
                                value === null
                                  ? 'No grant (set exhausted)'
                                  : (catalog.traits.byKey[value]?.label ?? value),
                              (value) => value ?? '__none__',
                            ),
                          });
                        },
                      }),
                  }),
                ),
              ),
            }),
        ...(naturalSelectionControl === undefined
          ? {}
          : {
              naturalSelection: Object.freeze({
                control: naturalSelectionControl,
                forOffer: (offer: AuthoredTraitOfferTraits, retainedTargetKey?: string) =>
                  Object.freeze({
                    load: () => {
                      const evaluated = candidates.naturalSelectionResult(
                        naturalSelectionControl.address,
                        offer,
                        offer.options[optionIndex(optionKey)]?.naturalSelectionTargets,
                      );
                      if (evaluated.kind !== 'naturalSelectionResult') return undefined;
                      const currentTargets: readonly string[] = [
                        ...(offer.options[optionIndex(optionKey)]?.naturalSelectionTargets ?? []),
                        ...(retainedTargetKey === undefined ? [] : [retainedTargetKey]),
                      ];
                      const available = new Set(evaluated.result.nextTargetTraitKeys);
                      const targetCandidates = Object.freeze(
                        [
                          ...new Set([...evaluated.result.nextTargetTraitKeys, ...currentTargets]),
                        ].map((traitKey) =>
                          Object.freeze({
                            value: traitKey,
                            support: available.has(traitKey)
                              ? ('possible' as const)
                              : ('impossible' as const),
                            branchSupport: evaluated.result.branchSupport,
                            selected: traitKey === retainedTargetKey,
                            ...(available.has(traitKey) ? {} : { reason: 'unavailable' as const }),
                          }),
                        ),
                      );
                      return Object.freeze({
                        complete: evaluated.result.complete,
                        picker: projectDirectTraitOutcomePicker(
                          targetCandidates,
                          (traitKey) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
                          (traitKey) => traitKey,
                        ),
                      });
                    },
                  }),
                traitLabel: (traitKey: string) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
              } satisfies WorkspaceNaturalSelectionInteraction),
            }),
        load() {
          if (projected !== undefined) return projected;
          const focused = candidates.traitOfferFocusedOptions(
            control.address,
            value,
            optionKey,
            prepared.variants,
          );
          const targets =
            hasTargetPicker && option !== undefined
              ? candidates.traitAcquisitionTargets(
                  control.address,
                  value,
                  optionKey,
                  option.targetTraitKey,
                )
              : undefined;
          projected = traitDomain.project(control.giver, value, prepared, focused, targets);
          return projected;
        },
      });
      optionDomains.set(domainKey, bound);
      return bound;
    };
    traitOffers.set(
      key,
      Object.freeze({
        acquisitionRoleLabel: control.acquisitionRoleLabel,
        choices: traitChoices,
        giver: control.giver,
        intentFor: (value: AuthoredTraitOffer) =>
          derivedShopPayloadIntent(
            derivedShopEntryEdit,
            traitOfferCommandFor(control.address, value),
          ),
        key,
        ...(control.echoLastReward === undefined ? {} : { echoLastReward: control.echoLastReward }),
        load,
        owner: control.address,
        rarityEditable: control.rarityEditable !== false,
        rarityEditableFor: (traitKey: string) => {
          const declaration = catalog.traits.byKey[traitKey];
          return (
            declaration?.rarityDomain.kind === 'ranked' &&
            declaration.rarityDomain.equippedRarities.length > 1
          );
        },
        ...(control.offer !== null &&
        (control.address.owner.kind === 'encounterPhase' ||
          control.address.owner.kind === 'gorgonPhase')
          ? {
              resetIntent: Object.freeze({
                command: Object.freeze({
                  kind: 'ResetEncounterTraitOffer' as const,
                  trait: control.address,
                }),
              }),
            }
          : {}),
        optionDomain,
        ransomAssessment: (value: AuthoredTraitOffer) => {
          if (value.kind !== 'traits') return undefined;
          const evaluated = candidates.ransomAssessment(control.address, value);
          if (evaluated.kind !== 'ransomAssessment') return undefined;
          const first = evaluated.result.assessments[0];
          if (!evaluated.result.branchAgreement || first === undefined)
            return Object.freeze({ branchAgreement: false });
          return Object.freeze({
            branchAgreement: evaluated.result.branchAgreement,
            buffedTraitKeys: first.buffedTraitKeys,
            levelBonus: first.levelBonus,
            removedCount: first.removedCount,
            removedTraitKeys: first.removedTraitKeys,
          });
        },
        traitLabel: (traitKey: string) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
        selectedIntent: (selectedOptionKey: AuthoredTraitOfferTraits['selectedOptionKey']) =>
          derivedShopPayloadIntent(
            derivedShopEntryEdit,
            Object.freeze({
              kind: 'ReplaceTraitSelection' as const,
              selectedOptionKey,
              trait: control.address,
            }),
          ),
        value: control.offer,
        traitsStartingDraft: startingDraft,
        nextOptionalHighTierDraft: (value: AuthoredTraitOfferTraits) =>
          candidates.nextOptionalHighTierTraitOfferDraft(control.address, value),
        previousOptionalHighTierDraft: (value: AuthoredTraitOfferTraits) =>
          candidates.previousOptionalHighTierTraitOfferDraft(control.address, value),
      }),
    );
  }

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
    rewards,
    acquisitionConversions,
    traitOffers,
    levelResolutions,
    steadyGrowth,
    judgmentArcana,
    keepsakeSelections,
    keepsakeEquipResults,
  });
}
