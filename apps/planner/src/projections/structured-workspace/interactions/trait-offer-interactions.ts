import {
  optionIndex,
  semanticAddressKey,
  createDefaultAuthoredHexTree,
  transitionAuthoredHexTreeLayout,
  chaosOperandAuthoringValues,
  completeAuthoredEchoLastRunBoonDraft,
  discoverAuthoredEchoLastRunBoonDraftChildren,
  discoverAuthoredTraitCarrierChildren,
  prepareEchoLastRunBoonDraft,
  updateAuthoredTraitCarrierChild,
} from '@run-planner/engine/authored-project';
import type {
  AuthoredCirceResolution,
  AuthoredChaosTraitOffer,
  AuthoredEchoLastRunBoonOffer,
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
  TraitOptionKey,
  AuthoredHexTreeConfiguration,
  AuthoredEchoLastRunBoonDraftRow,
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

import { traitOfferCommandFor, derivedShopPayloadIntent } from './reward-child-command-binding';
import { StructuredWorkspaceProjectionContractError } from '../contract';
import type {
  WorkspaceConcaveStoneInteraction,
  WorkspaceRewardControl,
  WorkspaceRejectedBlockRule,
  WorkspaceTraitOfferControl,
  WorkspaceTraitOfferInteraction,
  WorkspaceChaosOfferDomain,
  WorkspaceChaosOfferInteraction,
  WorkspaceHexTreeInteraction,
  WorkspaceEchoLastRunBoonDraftRow,
  WorkspaceTraitCarrierChildInteraction,
} from '../contract';

function chaosDomainFromCandidate(
  candidate: import('@run-planner/engine/simulation').ChaosOfferDomain,
  catalog: Catalog,
  value: AuthoredChaosTraitOffer,
): WorkspaceChaosOfferDomain {
  const evaluatedPickerCandidates = (
    keys: readonly string[],
    availableKeys: readonly string[],
    selectedKey: string,
  ) =>
    keys.map((key) => ({
      value: key,
      support: availableKeys.includes(key) ? ('possible' as const) : ('impossible' as const),
      branchSupport: Object.freeze([availableKeys.includes(key)]),
      selected: key === selectedKey,
      ...(availableKeys.includes(key) ? {} : { reason: 'unavailable' as const }),
    }));
  return Object.freeze({
    curseOptions: Object.freeze(
      candidate.curseOptions.map((option, index) =>
        Object.freeze({
          optionKey: option.optionKey,
          cursePicker: projectDirectTraitOutcomePicker(
            evaluatedPickerCandidates(
              option.curseKeys,
              option.availableCurseKeys,
              value.curseOptions[index]!.curseKey,
            ),
            (key) => catalog.chaos.curses.byKey[key]?.label ?? key,
            (key) => key,
          ),
          requirements: option.requirements,
        }),
      ),
    ) as WorkspaceChaosOfferDomain['curseOptions'],
    ...(candidate.selectedCurseKey === undefined
      ? {}
      : { selectedCurseKey: candidate.selectedCurseKey }),
    selectedCurseOperands: candidate.selectedCurseOperands,
    blessingPicker: projectDirectTraitOutcomePicker(
      evaluatedPickerCandidates(
        candidate.blessingKeys,
        candidate.availableBlessingKeys,
        value.blessingKey,
      ),
      (key) => catalog.chaos.blessings.byKey[key]?.label ?? key,
      (key) => key,
    ),
    rarities: candidate.rarities as readonly Exclude<TraitRarity, 'Duo'>[],
    blessingOperands: candidate.blessingOperands,
  });
}

function echoRowsForEngine(
  rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
): readonly AuthoredEchoLastRunBoonDraftRow[] {
  return Object.freeze(
    rows.map(({ identity, ...outcome }): AuthoredEchoLastRunBoonDraftRow =>
      identity === undefined
        ? outcome
        : Object.freeze({ ...outcome, giverKey: identity.giverKey, traitKey: identity.traitKey }),
    ),
  );
}

/** Projects one complete authored Hex tree into the shared editor product. */
export function projectHexTreeDomain(
  catalog: Catalog,
  spellTraitKey: string,
  tree: AuthoredHexTreeConfiguration,
): import('../contract').WorkspaceHexTreeDomain | undefined {
  const selectedHex = catalog.hexes.byKey[spellTraitKey];
  if (selectedHex === undefined) return undefined;
  const selectedCandidates = (
    candidates: readonly { readonly key: string; readonly label: string }[],
    selectedKeys: readonly string[],
    selectedKey: string | undefined,
  ) =>
    projectDirectTraitOutcomePicker(
      candidates.map((candidate) => ({
        value: candidate.key,
        support:
          selectedKey === candidate.key || !selectedKeys.includes(candidate.key)
            ? ('possible' as const)
            : ('impossible' as const),
        branchSupport: Object.freeze([true]),
        selected: selectedKey === candidate.key,
        ...(selectedKey === candidate.key || !selectedKeys.includes(candidate.key)
          ? {}
          : { reason: 'duplicateTrait' as const }),
      })),
      (key) =>
        selectedHex.rareCandidates.byKey[key]?.label ??
        selectedHex.epicCandidates.byKey[key]?.label ??
        key,
      (key) => key,
    );
  return Object.freeze({
    value: tree,
    layoutPicker: projectDirectTraitOutcomePicker(
      selectedHex.layouts.values.map((layout) => ({
        value: layout.key,
        support: 'possible' as const,
        branchSupport: Object.freeze([true]),
        selected: layout.key === tree.layoutKey,
      })),
      (key) => selectedHex.layouts.byKey[key]?.label ?? key,
      (key) => key,
    ),
    rarePickerFor: (selectedKeys: readonly string[], selectedKey?: string) =>
      selectedCandidates(selectedHex.rareCandidates.values, selectedKeys, selectedKey),
    epicPickerFor: (selectedKeys: readonly string[], selectedKey?: string) =>
      selectedCandidates(selectedHex.epicCandidates.values, selectedKeys, selectedKey),
    godSent: selectedHex.godSent,
  });
}

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
    const chaosDomainFor = (value: AuthoredChaosTraitOffer) => {
      const candidate = candidates.chaosOfferDomain(control.address, value)[0];
      return candidate === undefined
        ? undefined
        : chaosDomainFromCandidate(candidate, catalog, value);
    };
    const chaosStartingDraft = (): AuthoredChaosTraitOffer | undefined => {
      if (control.giver.providerKind !== 'chaos') return undefined;
      const candidate = candidates.chaosOfferDomain(control.address)[0];
      const firstBlessingKey = candidate?.blessingKeys[0];
      const firstOptions:
        readonly (AuthoredChaosTraitOffer['curseOptions'][number] | undefined)[] | undefined =
        candidate?.curseOptions.map((option) => {
          const curseKey = option.curseKeys[0];
          const requirement = curseKey === undefined ? undefined : option.requirements[curseKey];
          return curseKey === undefined || requirement === undefined
            ? undefined
            : Object.freeze({ curseKey, requirementCount: requirement.authoringDefault });
        });
      const selectedCurseKey = candidate?.selectedCurseKey;
      const rarity = candidate?.rarities[0] as AuthoredChaosTraitOffer['rarity'] | undefined;
      if (
        candidate === undefined ||
        firstBlessingKey === undefined ||
        rarity === undefined ||
        selectedCurseKey === undefined ||
        firstOptions === undefined ||
        firstOptions.some((option) => option === undefined)
      )
        return undefined;
      return Object.freeze({
        kind: 'chaos' as const,
        giverKey: 'Chaos' as const,
        curseOptions: Object.freeze(firstOptions) as AuthoredChaosTraitOffer['curseOptions'],
        selectedOptionKey: 'option1' as const,
        selectedCurseValues: chaosOperandAuthoringValues(candidate.selectedCurseOperands),
        blessingKey: firstBlessingKey,
        rarity,
        blessingValues: chaosOperandAuthoringValues(
          candidate.blessingOperands[firstBlessingKey] ?? [],
          rarity,
        ),
      });
    };
    const chaosInteraction: WorkspaceChaosOfferInteraction | undefined =
      control.giver.providerKind !== 'chaos'
        ? undefined
        : Object.freeze({
            blessingLabel: (blessingKey: string) =>
              catalog.chaos.blessings.byKey[blessingKey]?.label ?? blessingKey,
            curseLabel: (curseKey: string) =>
              catalog.chaos.curses.byKey[curseKey]?.label ?? curseKey,
            domainFor: chaosDomainFor,
            startingDraft: chaosStartingDraft,
          });
    const load = (value = control.offer ?? startingDraft()) =>
      value === undefined ? Object.freeze([]) : candidates.traitOffer(control.address, value);
    const rejectedBlockDomain = (rules: readonly WorkspaceRejectedBlockRule[]) => {
      if (rules.length === 0) return undefined;
      return Object.freeze({
        // Do not select an arbitrary history branch. A row is offered only
        // when every reached branch agrees it can be blocked; clearing is
        // likewise exposed only when it is legal across the full frontier.
        required: rules.every((rule) => rule.rejectedBlockRequired),
        canClear: rules.every((rule) => !rule.rejectedBlockRequired),
        needsRepair: rules.some((rule) => rule.rejectedBlockNeedsRepair),
        optionKeys: Object.freeze(
          rules[0]!.rejectedBlockableOptionKeys.filter((key) =>
            rules.every((rule) => rule.rejectedBlockableOptionKeys.includes(key)),
          ),
        ),
      });
    };
    const optionDomains = new Map<
      string,
      ReturnType<WorkspaceTraitOfferInteraction['optionDomain']>
    >();
    const concaveStoneInteraction = (
      child:
        | Extract<
            import('../contract').WorkspaceTraitCarrierChildControl,
            { readonly kind: 'concaveStone' }
          >
        | undefined,
    ): WorkspaceConcaveStoneInteraction | undefined =>
      child === undefined
        ? undefined
        : Object.freeze({
            child,
            update: (
              offer: AuthoredTraitOfferTraits,
              value:
                import('@run-planner/engine/authored-project').AuthoredConcaveStoneResult | null,
            ) =>
              updateAuthoredTraitCarrierChild(offer, {
                kind: 'concaveStone',
                child,
                value,
              }),
            completeFor: (offer: AuthoredTraitOfferTraits) => {
              const evaluated = candidates.traitCarrierChildDomain(control.address, offer, child);
              if (evaluated.kind !== 'concaveStone') return false;
              const branches = evaluated.result.branches;
              const first = branches[0];
              if (first === undefined) return true;
              if (!branches.every((branch) => branch.required === first.required)) return false;
              return !first.required || offer.concaveStoneResult !== undefined;
            },
            forOffer: (offer: AuthoredTraitOfferTraits) =>
              Object.freeze({
                load: () => {
                  const evaluated = candidates.traitCarrierChildDomain(
                    control.address,
                    offer,
                    child,
                  );
                  if (evaluated.kind !== 'concaveStone') return undefined;
                  const branches = evaluated.result.branches;
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
    const hexTreeInteraction = (
      value: AuthoredTraitOfferTraits,
      optionKey: TraitOptionKey,
      child:
        | Extract<
            import('../contract').WorkspaceTraitCarrierChildControl,
            { readonly kind: 'hexTree' }
          >
        | undefined,
    ) => {
      if (value.selectedOptionKey !== optionKey) return undefined;
      if (child === undefined) return undefined;
      const selected = value.options[optionIndex(optionKey)];
      if (selected === undefined) return undefined;
      if (child.optionKey !== optionKey || child.traitKey !== selected.traitKey) return undefined;
      const hex = catalog.hexes.byKey[selected.traitKey];
      if (hex === undefined) return undefined;
      const interaction: WorkspaceHexTreeInteraction = {
        child,
        update: (offer, tree) =>
          updateAuthoredTraitCarrierChild(offer, { kind: 'hexTree', child, value: tree }),
        defaultFor: (offer) => {
          const selectedOption = offer.options[optionIndex(offer.selectedOptionKey)];
          if (selectedOption === undefined)
            throw new StructuredWorkspaceProjectionContractError(
              `${semanticAddressKey(control.address)} is missing its selected Spell option`,
            );
          return createDefaultAuthoredHexTree(catalog, selectedOption.traitKey);
        },
        transitionFor: (offer, layoutKey) => {
          const selectedOption = offer.options[optionIndex(offer.selectedOptionKey)];
          if (selectedOption === undefined)
            throw new StructuredWorkspaceProjectionContractError(
              `${semanticAddressKey(control.address)} is missing its selected Spell option`,
            );
          return transitionAuthoredHexTreeLayout(
            catalog,
            selectedOption.traitKey,
            offer.hexTree ?? createDefaultAuthoredHexTree(catalog, selectedOption.traitKey),
            layoutKey,
          );
        },
        forOffer: (offer) => ({
          load: () => {
            const option = offer.options[optionIndex(offer.selectedOptionKey)];
            const tree =
              offer.hexTree ??
              child.value ??
              createDefaultAuthoredHexTree(catalog, option!.traitKey);
            return projectHexTreeDomain(catalog, option!.traitKey, tree);
          },
        }),
      };
      return interaction;
    };
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
      const discoveredChildren = Object.freeze(
        discoverAuthoredTraitCarrierChildren(catalog, control.address, value).map((child) => {
          const persisted = control.children.find(
            (candidate) =>
              semanticAddressKey(candidate.address) === semanticAddressKey(child.address),
          );
          return Object.freeze({ ...child, marker: persisted?.marker ?? control.marker });
        }),
      );
      const carrierChildren = Object.freeze(
        discoveredChildren
          .filter(
            (child) =>
              (child.kind === 'traitAcquisitionTarget' ||
                child.kind === 'allTogetherSet' ||
                child.kind === 'naturalSelectionResult') &&
              (child.optionKey === optionKey ||
                (optionKey === value.selectedOptionKey &&
                  value.concaveStoneResult?.kind === 'proc' &&
                  child.optionKey === value.concaveStoneResult.optionKey)),
          )
          .map((child) => child),
      );
      const circeControl = discoveredChildren.find(
        (child): child is Extract<typeof child, { readonly kind: 'circeResolution' }> =>
          child.kind === 'circeResolution',
      );
      const echoPomControl = discoveredChildren.find(
        (child): child is Extract<typeof child, { readonly kind: 'echoPomTarget' }> =>
          child.kind === 'echoPomTarget',
      );
      const echoLastRunBoonControl = discoveredChildren.find(
        (child): child is Extract<typeof child, { readonly kind: 'echoLastRunBoon' }> =>
          child.kind === 'echoLastRunBoon',
      );
      const concaveStoneControl = discoveredChildren.find(
        (child): child is Extract<typeof child, { readonly kind: 'concaveStone' }> =>
          child.kind === 'concaveStone',
      );
      const hexTreeControl = discoveredChildren.find(
        (child): child is Extract<typeof child, { readonly kind: 'hexTree' }> =>
          child.kind === 'hexTree',
      );
      let projected: ReturnType<typeof traitDomain.project> | undefined;
      const concaveStone = concaveStoneInteraction(
        value.selectedOptionKey === optionKey ? concaveStoneControl : undefined,
      );
      const hexTree = hexTreeInteraction(value, optionKey, hexTreeControl);
      const specialChildren: WorkspaceTraitCarrierChildInteraction[] = [
        ...(circeControl === undefined
          ? []
          : [
              Object.freeze({
                child: circeControl,
                update: (offer: AuthoredTraitOfferTraits, resolution: AuthoredCirceResolution) =>
                  updateAuthoredTraitCarrierChild(offer, {
                    kind: 'circeResolution',
                    child: circeControl,
                    value: resolution,
                  }),
                forOffer: (offer: AuthoredTraitOfferTraits) =>
                  Object.freeze({
                    load: () => {
                      const evaluated = candidates.traitCarrierChildDomain(
                        control.address,
                        offer,
                        circeControl,
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
            ]),
        ...(echoPomControl === undefined
          ? []
          : [
              Object.freeze({
                child: echoPomControl,
                update: (offer: AuthoredTraitOfferTraits, targetTraitKey: string | null) =>
                  updateAuthoredTraitCarrierChild(offer, {
                    kind: 'echoPomTarget',
                    child: echoPomControl,
                    value: targetTraitKey,
                  }),
                forOffer: (offer: AuthoredTraitOfferTraits) =>
                  Object.freeze({
                    load: () => {
                      const evaluated = candidates.traitCarrierChildDomain(
                        control.address,
                        offer,
                        echoPomControl,
                      );
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
            ]),
        ...(echoLastRunBoonControl === undefined
          ? []
          : [
              Object.freeze({
                child: echoLastRunBoonControl,
                update: (offer: AuthoredTraitOfferTraits, child: AuthoredEchoLastRunBoonOffer) =>
                  updateAuthoredTraitCarrierChild(offer, {
                    kind: 'echoLastRunBoon',
                    child: echoLastRunBoonControl,
                    value: child,
                  }),
                forOffer: (offer: AuthoredTraitOfferTraits) =>
                  Object.freeze({
                    load: () => {
                      const evaluated = candidates.traitCarrierChildDomain(
                        control.address,
                        offer,
                        echoLastRunBoonControl,
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
                        completeDraft: (
                          rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
                          selectedIndex: number,
                        ) =>
                          completeAuthoredEchoLastRunBoonDraft(
                            echoRowsForEngine(rows),
                            selectedIndex,
                          ),
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
                            echoRowsForEngine(rows),
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
                          discoverAuthoredEchoLastRunBoonDraftChildren(catalog, [identity], 0)[0]
                            ?.kind === 'traitAcquisitionTarget',
                        carrierKindFor: (identity: {
                          readonly giverKey: string;
                          readonly traitKey: string;
                        }) => {
                          const child = discoverAuthoredEchoLastRunBoonDraftChildren(
                            catalog,
                            [identity],
                            0,
                          )[0];
                          return child?.kind === 'allTogetherSet'
                            ? ('allTogether' as const)
                            : child?.kind === 'naturalSelectionResult'
                              ? ('naturalSelection' as const)
                              : undefined;
                        },
                        carrierForDraft: (
                          rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
                          selectedIndex: number,
                        ) =>
                          Object.freeze({
                            load: () => {
                              const prepared = prepareEchoLastRunBoonDraft(
                                offer,
                                echoLastRunBoonControl,
                                echoRowsForEngine(rows),
                                selectedIndex,
                              );
                              if (!prepared.complete || prepared.value === undefined)
                                return undefined;
                              const evaluated = candidates.traitCarrierChildDomain(
                                control.address,
                                prepared.value,
                                echoLastRunBoonControl,
                              );
                              if (
                                evaluated.kind !== 'echoLastRunBoonDomain' ||
                                evaluated.result.selectedCarrier === undefined
                              )
                                return undefined;
                              const carrier = evaluated.result.selectedCarrier;
                              if (carrier.kind === 'allTogether')
                                return Object.freeze({
                                  kind: 'allTogether' as const,
                                  complete: carrier.complete,
                                  sets: Object.freeze(
                                    carrier.sets.map((set) =>
                                      Object.freeze({
                                        setKey: set.setKey,
                                        picker: projectDirectTraitOutcomePicker(
                                          set.candidates,
                                          (traitKey) =>
                                            traitKey === null
                                              ? 'No grant (set exhausted)'
                                              : (catalog.traits.byKey[traitKey]?.label ?? traitKey),
                                          (traitKey) => traitKey ?? '__none__',
                                        ),
                                      }),
                                    ),
                                  ),
                                });
                              return Object.freeze({
                                kind: 'naturalSelection' as const,
                                slotCount: carrier.slotCount,
                                complete: carrier.complete,
                                supported: carrier.supported,
                                picker: projectDirectTraitOutcomePicker(
                                  carrier.nextTargetCandidates,
                                  (traitKey) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
                                  (traitKey) => traitKey,
                                ),
                                traitLabel: (traitKey: string) =>
                                  catalog.traits.byKey[traitKey]?.label ?? traitKey,
                              });
                            },
                          }),
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
            ]),
      ];
      const bound = Object.freeze({
        children: Object.freeze([
          ...carrierChildren.map((child): WorkspaceTraitCarrierChildInteraction => {
            switch (child.kind) {
              case 'traitAcquisitionTarget':
                return Object.freeze({
                  child,
                  forOffer: (offer: AuthoredTraitOfferTraits) =>
                    Object.freeze({
                      load: () => {
                        const evaluated = candidates.traitCarrierChildDomain(
                          control.address,
                          offer,
                          child,
                        );
                        if (evaluated.kind !== 'traitAcquisitionTargetDomain') return undefined;
                        return Object.freeze({
                          targetPicker: projectDirectTraitOutcomePicker(
                            evaluated.result.candidates.map((candidate) =>
                              Object.freeze({
                                value: candidate.result.traitKey,
                                support: candidate.result.supported
                                  ? ('possible' as const)
                                  : ('impossible' as const),
                                branchSupport: candidate.result.branchSupport,
                                selected:
                                  candidate.result.traitKey ===
                                  offer.options[optionIndex(child.optionKey)]?.targetTraitKey,
                              }),
                            ),
                            (traitKey) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
                            (traitKey) => traitKey,
                          ),
                        });
                      },
                    }),
                  update: (offer: AuthoredTraitOfferTraits, targetTraitKey: string) =>
                    updateAuthoredTraitCarrierChild(offer, {
                      kind: 'traitAcquisitionTarget',
                      child,
                      targetTraitKey,
                    }),
                });
              case 'allTogetherSet':
                return Object.freeze({
                  child,
                  forOffer: (offer: AuthoredTraitOfferTraits) =>
                    Object.freeze({
                      load: () => {
                        const evaluated = candidates.traitCarrierChildDomain(
                          control.address,
                          offer,
                          child,
                        );
                        if (evaluated.kind !== 'allTogetherSetDomain') return undefined;
                        return Object.freeze({
                          picker: projectDirectTraitOutcomePicker(
                            evaluated.result.candidates,
                            (result) =>
                              result === null
                                ? 'No grant (set exhausted)'
                                : (catalog.traits.byKey[result]?.label ?? result),
                            (result) => result ?? '__none__',
                          ),
                        });
                      },
                    }),
                  update: (
                    offer: AuthoredTraitOfferTraits,
                    allTogetherResult: import('@run-planner/engine/authored-project').AuthoredAllTogetherResult,
                  ) =>
                    updateAuthoredTraitCarrierChild(offer, {
                      kind: 'allTogetherSet',
                      child,
                      allTogetherResult,
                    }),
                });
              case 'naturalSelectionResult':
                return Object.freeze({
                  child,
                  forOffer: (offer: AuthoredTraitOfferTraits, retainedTargetKey?: string) =>
                    Object.freeze({
                      load: () => {
                        const evaluated = candidates.traitCarrierChildDomain(
                          control.address,
                          offer,
                          child,
                        );
                        if (evaluated.kind !== 'naturalSelectionResult') return undefined;
                        const currentTargets = [
                          ...(offer.options[optionIndex(child.optionKey)]
                            ?.naturalSelectionTargets ?? []),
                          ...(retainedTargetKey === undefined ? [] : [retainedTargetKey]),
                        ];
                        const available = new Set(evaluated.result.nextTargetTraitKeys);
                        return Object.freeze({
                          complete: evaluated.result.complete,
                          picker: projectDirectTraitOutcomePicker(
                            Object.freeze(
                              [
                                ...new Set([
                                  ...evaluated.result.nextTargetTraitKeys,
                                  ...currentTargets,
                                ]),
                              ].map((traitKey) =>
                                Object.freeze({
                                  value: traitKey,
                                  support: available.has(traitKey)
                                    ? ('possible' as const)
                                    : ('impossible' as const),
                                  branchSupport: evaluated.result.branchSupport,
                                  selected: traitKey === retainedTargetKey,
                                  ...(available.has(traitKey)
                                    ? {}
                                    : { reason: 'unavailable' as const }),
                                }),
                              ),
                            ),
                            (traitKey) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
                            (traitKey) => traitKey,
                          ),
                        });
                      },
                    }),
                  update: (
                    offer: AuthoredTraitOfferTraits,
                    targets: NonNullable<
                      import('@run-planner/engine/authored-project').AuthoredTraitOption['naturalSelectionTargets']
                    >,
                  ) =>
                    updateAuthoredTraitCarrierChild(offer, {
                      kind: 'naturalSelectionResult',
                      child,
                      targets,
                    }),
                  traitLabel: (traitKey: string) =>
                    catalog.traits.byKey[traitKey]?.label ?? traitKey,
                });
              default:
                throw new StructuredWorkspaceProjectionContractError(
                  `${semanticAddressKey(control.address)} has an unsupported option carrier`,
                );
            }
          }),
          ...specialChildren,
          ...(concaveStone === undefined ? [] : [concaveStone]),
          ...(hexTree === undefined ? [] : [hexTree]),
        ]),
        load() {
          if (projected !== undefined) return projected;
          const focused = candidates.traitOfferFocusedOptions(
            control.address,
            value,
            optionKey,
            prepared.variants,
          );
          projected = traitDomain.project(control.giver, value, prepared, focused);
          return projected;
        },
      });
      const domain = Object.freeze({ children: bound.children, load: bound.load });
      optionDomains.set(domainKey, domain);
      return domain;
    };
    traitOffers.set(
      key,
      Object.freeze({
        acquisitionRoleLabel: control.acquisitionRoleLabel,
        choices: control.giver.providerKind === 'chaos' ? Object.freeze([]) : traitChoices,
        ...(chaosInteraction === undefined ? {} : { chaos: chaosInteraction }),
        giver: control.giver,
        intentFor: (value: AuthoredTraitOffer) =>
          derivedShopPayloadIntent(
            derivedShopEntryEdit,
            traitOfferCommandFor(control.address, value),
          ),
        key,
        feedbackFor: (value: AuthoredTraitOffer) => {
          const feedback = [...control.feedback];
          if (value.kind === 'traits') {
            const evaluated = candidates.ransomAssessment(control.address, value);
            if (evaluated.kind === 'ransomAssessment') {
              const first = evaluated.result.assessments[0];
              feedback.push(
                !evaluated.result.branchAgreement || first === undefined
                  ? Object.freeze({
                      kind: 'ransom' as const,
                      assessment: Object.freeze({ branchAgreement: false as const }),
                    })
                  : Object.freeze({
                      kind: 'ransom' as const,
                      assessment: Object.freeze({
                        branchAgreement: true as const,
                        buffedTraitKeys: first.buffedTraitKeys,
                        levelBonus: first.levelBonus,
                        removedCount: first.removedCount,
                        removedTraitKeys: first.removedTraitKeys,
                      }),
                    }),
              );
            }
          }
          return Object.freeze(feedback);
        },
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
        rejectedBlockDomain,
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
