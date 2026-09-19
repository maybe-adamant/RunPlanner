import {
  discoverAuthoredTraitCarrierChildren,
  optionIndex,
  semanticAddressKey,
  updateAuthoredTraitCarrierChild,
} from '@run-planner/engine/authored-project';
import type {
  AuthoredCirceResolution,
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
  TraitOptionKey,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {} from '@run-planner/engine/simulation';
import type { CandidateProjectionSession } from '@planner/projections/candidates/candidateProjection';
import {
  projectDirectTraitOutcomePicker,
  withDirectTraitOutcomeSelection,
  withoutDirectTraitOutcomeValues,
} from '@planner/projections/contextual/directTraitOutcomeProjection';
import { StructuredWorkspaceProjectionContractError } from '@planner/projections/structured-workspace/contract';
import type {
  WorkspaceTraitCarrierChildInteraction,
  WorkspaceTraitOfferControl,
  WorkspaceTraitOfferInteraction,
} from '@planner/projections/structured-workspace/contracts/traits';
import { bindEchoLastRunBoonInteraction } from './echo';
import { bindHexTreeInteraction } from './hex';
import { bindConcaveStoneInteraction } from './stone';

/** Binds one ordinary offer's focused option cache and exact typed children. */
export function bindTraitOfferOptionDomain(input: {
  readonly catalog: Catalog;
  readonly candidates: CandidateProjectionSession;
  readonly control: WorkspaceTraitOfferControl;
  readonly traitDomain: import('@planner/projections/structured-workspace/contract').StructuredWorkspaceContextualServices['traitDomain'];
}): WorkspaceTraitOfferInteraction['optionDomain'] {
  const { catalog, candidates, control, traitDomain } = input;
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
    const concaveStone = bindConcaveStoneInteraction({
      candidates,
      child: value.selectedOptionKey === optionKey ? concaveStoneControl : undefined,
      owner: control.address,
    });
    const hexTree = bindHexTreeInteraction({
      catalog,
      child: hexTreeControl,
      owner: control.address,
      optionKey,
      value,
    });
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
                      arcanaPickerFor: (selectedKeys: readonly string[]) => {
                        const staged = updateAuthoredTraitCarrierChild(offer, {
                          kind: 'circeResolution',
                          child: circeControl,
                          value: Object.freeze({
                            kind: result.effect as 'activateArcana' | 'promoteArcana',
                            arcanaKeys: Object.freeze(selectedKeys),
                          }),
                        });
                        const stagedEvaluation = candidates.traitCarrierChildDomain(
                          control.address,
                          staged,
                          circeControl,
                        );
                        const stagedCandidates =
                          stagedEvaluation.kind === 'circeResolutionDomain'
                            ? stagedEvaluation.result.arcanaCandidates
                            : result.arcanaCandidates;
                        return projectDirectTraitOutcomePicker(
                          withDirectTraitOutcomeSelection(
                            withoutDirectTraitOutcomeValues(stagedCandidates, selectedKeys),
                            Object.freeze([]),
                          ),
                          arcanaLabel,
                          (key) => key,
                        );
                      },
                      branchAgreement: result.branchAgreement,
                      effect: result.effect,
                      outerAvailable: result.outerAvailable,
                      requiredCount: result.requiredCount,
                      vowPicker: projectDirectTraitOutcomePicker(
                        result.vowCandidates,
                        vowLabel,
                        (key) => key,
                      ),
                      vowPickerFor: (selectedKeys: readonly string[]) =>
                        projectDirectTraitOutcomePicker(
                          withDirectTraitOutcomeSelection(
                            withoutDirectTraitOutcomeValues(result.vowCandidates, selectedKeys),
                            Object.freeze([]),
                          ),
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
            bindEchoLastRunBoonInteraction({
              catalog,
              candidates,
              owner: control.address,
              echoControl: echoLastRunBoonControl,
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
                        ...(offer.options[optionIndex(child.optionKey)]?.naturalSelectionTargets ??
                          []),
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
                traitLabel: (traitKey: string) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
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
  return optionDomain;
}
