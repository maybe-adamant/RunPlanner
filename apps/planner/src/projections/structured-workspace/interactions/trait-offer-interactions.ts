import {
  createAllTogetherSetAddress,
  createCirceResolutionAddress,
  createEchoLastRunBoonAddress,
  createEchoPomTargetAddress,
  createTraitAcquisitionTargetAddress,
  optionIndex,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import type {
  AuthoredCirceResolution,
  AuthoredEchoLastRunBoonOffer,
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
  TraitOptionKey,
} from '@run-planner/engine/authored-project';
import type { Catalog, TraitRarity } from '@run-planner/engine/catalog-schema';
import {
  evaluateEchoLastRunBoonDraftSupport,
  echoLastRunBoonRarityCandidates,
  echoLastRunBoonTraitCandidatesForRow,
} from '@run-planner/engine/simulation';
import type { CandidateProjectionSession } from '@planner/projections/candidateProjection';
import {
  projectDirectTraitOutcomePicker,
  withDirectTraitOutcomeSelection,
  withoutDirectTraitOutcomeValues,
} from '@planner/projections/directTraitOutcomeProjection';

import {
  ordinaryTraitOfferCommandFor,
  traitOfferCommandFor,
  derivedShopPayloadIntent,
} from './reward-child-command-binding';
import { StructuredWorkspaceProjectionContractError } from '../contract';
import type {
  WorkspaceConcaveStoneInteraction,
  WorkspaceNaturalSelectionInteraction,
  WorkspaceRewardControl,
  WorkspaceTraitOfferControl,
  WorkspaceTraitOfferInteraction,
} from '../contract';

/** Binds ordinary trait offers and their selected Echo, Natural Selection, Ransom, All Together, and Circe outcomes. */
export function bindTraitOfferInteractions(input: {
  readonly catalog: Catalog;
  readonly candidates: CandidateProjectionSession;
  readonly traitControls: ReadonlyMap<string, WorkspaceTraitOfferControl>;
  readonly derivedShopEntryEdits: ReadonlyMap<
    string,
    NonNullable<WorkspaceRewardControl['derivedShopEntryEdit']>
  >;
  readonly traitDomain: import('../contract').StructuredWorkspaceContextualServices['traitDomain'];
}): ReadonlyMap<string, WorkspaceTraitOfferInteraction> {
  const {
    catalog,
    candidates,
    traitControls: effectiveTraitControls,
    derivedShopEntryEdits,
    traitDomain,
  } = input;
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
    const concaveStoneInteraction: WorkspaceConcaveStoneInteraction | undefined =
      control.concaveStone === undefined
        ? undefined
        : Object.freeze({
            control: control.concaveStone,
            intentFor: (
              _offer: AuthoredTraitOfferTraits,
              result:
                import('@run-planner/engine/authored-project').AuthoredConcaveStoneResult | null,
            ) =>
              derivedShopPayloadIntent(
                derivedShopEntryEdit,
                Object.freeze({
                  kind: 'ReplaceConcaveStoneResult' as const,
                  trait: control.address,
                  value: result,
                }),
              ),
            forOffer: (offer: AuthoredTraitOfferTraits) =>
              Object.freeze({
                load: () => {
                  const branches = candidates.concaveStone(control.address, offer);
                  const first = branches[0];
                  if (first === undefined) return undefined;
                  const sameDomain = branches.every(
                    (branch) =>
                      branch.procSupport === first.procSupport &&
                      branch.required === first.required &&
                      branch.resultSupport === first.resultSupport &&
                      JSON.stringify(branch.residualOptionKeys) ===
                        JSON.stringify(first.residualOptionKeys),
                  );
                  if (!sameDomain) return undefined;
                  return Object.freeze({
                    procSupport: first.procSupport,
                    required: first.required,
                    residualOptionKeys: first.residualOptionKeys,
                    resultSupport: first.resultSupport,
                  });
                },
              }),
          });
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
        ...(concaveStoneInteraction === undefined ? {} : { concaveStone: concaveStoneInteraction }),
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

  return traitOffers;
}
