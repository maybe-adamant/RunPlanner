import {
  completeAuthoredEchoLastRunBoonDraft,
  discoverAuthoredEchoLastRunBoonDraftChildren,
  optionIndex,
  prepareEchoLastRunBoonDraft,
  updateAuthoredTraitCarrierChild,
} from '@run-planner/engine/authored-project';
import type {
  AuthoredEchoLastRunBoonDraftRow,
  AuthoredEchoLastRunBoonOffer,
  AuthoredTraitOfferTraits,
  TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog, TraitRarity } from '@run-planner/engine/catalog-schema';
import {
  echoLastRunBoonRarityCandidates,
  echoLastRunBoonTraitCandidatesForRow,
  evaluateEchoLastRunBoonDraftSupport,
  nextEchoLastRunBoonDraft,
  previousEchoLastRunBoonDraft,
} from '@run-planner/engine/simulation';
import type { CandidateProjectionSession } from '@planner/projections/candidates/candidateProjection';
import { projectDirectTraitOutcomePicker } from '@planner/projections/contextual/directTraitOutcomeProjection';
import type {
  WorkspaceEchoLastRunBoonDraftRow,
  WorkspaceEchoLastRunBoonInteraction,
  WorkspaceTraitCarrierChildControl,
} from '@planner/projections/structured-workspace/contracts/traits';

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
function echoRowsForWorkspace(
  rows: readonly AuthoredEchoLastRunBoonDraftRow[],
): readonly WorkspaceEchoLastRunBoonDraftRow[] {
  return Object.freeze(
    rows.map(({ giverKey, traitKey, ...outcome }) =>
      giverKey === undefined || traitKey === undefined
        ? Object.freeze(outcome)
        : Object.freeze({ ...outcome, identity: Object.freeze({ giverKey, traitKey }) }),
    ),
  );
}

/** Binds Echo's complete transient draft and selected typed carrier. */
export function bindEchoLastRunBoonInteraction(input: {
  readonly catalog: Catalog;
  readonly candidates: CandidateProjectionSession;
  readonly owner: TraitOfferAddress;
  readonly echoControl: Extract<
    WorkspaceTraitCarrierChildControl,
    { readonly kind: 'echoLastRunBoon' }
  >;
}): WorkspaceEchoLastRunBoonInteraction {
  const { catalog, candidates, owner, echoControl } = input;
  return Object.freeze({
    child: echoControl,
    update: (offer: AuthoredTraitOfferTraits, child: AuthoredEchoLastRunBoonOffer) =>
      updateAuthoredTraitCarrierChild(offer, {
        kind: 'echoLastRunBoon',
        child: echoControl,
        value: child,
      }),
    forOffer: (offer: AuthoredTraitOfferTraits) =>
      Object.freeze({
        load: () => {
          const evaluated = candidates.traitCarrierChildDomain(owner, offer, echoControl);
          if (evaluated.kind !== 'echoLastRunBoonDomain') return undefined;
          const domainCandidates = evaluated.result.candidates;
          const identityKey = (identity: {
            readonly giverKey: string;
            readonly traitKey: string;
          }) => `${identity.giverKey}:${identity.traitKey}`;
          const identityLabel = (identity: {
            readonly giverKey: string;
            readonly traitKey: string;
          }) => catalog.traits.byKey[identity.traitKey]?.label ?? identity.traitKey;
          const carrierForDraft = (
            rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
            selectedIndex: number,
            retainedTargetKey?: string,
          ) =>
            Object.freeze({
              load: () => {
                const prepared = prepareEchoLastRunBoonDraft(
                  offer,
                  echoControl,
                  echoRowsForEngine(rows),
                  selectedIndex,
                );
                if (!prepared.complete || prepared.value === undefined) return undefined;
                const evaluated = candidates.traitCarrierChildDomain(
                  owner,
                  prepared.value,
                  echoControl,
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
                    retainedTargetKey === undefined
                      ? carrier.nextTargetCandidates
                      : [
                          ...carrier.nextTargetCandidates.map((candidate) => ({
                            ...candidate,
                            selected: candidate.value === retainedTargetKey,
                          })),
                          ...(carrier.nextTargetCandidates.some(
                            (candidate) => candidate.value === retainedTargetKey,
                          )
                            ? []
                            : [
                                {
                                  value: retainedTargetKey,
                                  support: 'impossible' as const,
                                  branchSupport: Object.freeze([]),
                                  selected: true,
                                  reason: 'unavailable' as const,
                                },
                              ]),
                        ],
                    (traitKey) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
                    (traitKey) => traitKey,
                  ),
                  traitLabel: (traitKey: string) =>
                    catalog.traits.byKey[traitKey]?.label ?? traitKey,
                });
              },
            });
          return Object.freeze({
            completeDraft: (
              rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
              selectedIndex: number,
            ) => completeAuthoredEchoLastRunBoonDraft(echoRowsForEngine(rows), selectedIndex),
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
            nextDraft: (
              rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
              selectedIndex: number,
            ) => {
              const next = nextEchoLastRunBoonDraft(
                domainCandidates,
                echoRowsForEngine(rows),
                selectedIndex,
              );
              return next === undefined
                ? undefined
                : Object.freeze({
                    rows: echoRowsForWorkspace(next.rows),
                    selectedIndex: next.selectedIndex,
                  });
            },
            previousDraft: (
              rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
              selectedIndex: number,
            ) => {
              const previous = previousEchoLastRunBoonDraft(echoRowsForEngine(rows), selectedIndex);
              return previous === undefined
                ? undefined
                : Object.freeze({
                    rows: echoRowsForWorkspace(previous.rows),
                    selectedIndex: previous.selectedIndex,
                  });
            },
            effectiveLevelFor: (identity: {
              readonly giverKey: string;
              readonly traitKey: string;
            }) =>
              domainCandidates.find(
                (candidate) =>
                  candidate.option.giverKey === identity.giverKey &&
                  candidate.option.traitKey === identity.traitKey,
              )?.effectiveLevel,
            effectiveRarityFor: (option: AuthoredEchoLastRunBoonOffer['options'][number]) =>
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
            targetPickerFor: (option: AuthoredEchoLastRunBoonOffer['options'][number]) => {
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
              discoverAuthoredEchoLastRunBoonDraftChildren(catalog, [identity], 0)[0]?.kind ===
              'traitAcquisitionTarget',
            carrierKindFor: (identity: {
              readonly giverKey: string;
              readonly traitKey: string;
            }) => {
              const child = discoverAuthoredEchoLastRunBoonDraftChildren(catalog, [identity], 0)[0];
              return child?.kind === 'allTogetherSet'
                ? ('allTogether' as const)
                : child?.kind === 'naturalSelectionResult'
                  ? ('naturalSelection' as const)
                  : undefined;
            },
            carrierForDraft,
            naturalSelectionForDraft: (
              rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
              selectedIndex: number,
              retainedTargetKey?: string,
            ) =>
              Object.freeze({
                load: () => {
                  const carrier = carrierForDraft(rows, selectedIndex, retainedTargetKey).load();
                  return carrier?.kind === 'naturalSelection' ? carrier : undefined;
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
                echoLastRunBoonTraitCandidatesForRow(domainCandidates, occupiedTraitKeys, selected),
                identityLabel,
                identityKey,
              ),
          });
        },
      }),
  });
}
