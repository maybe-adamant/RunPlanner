import type {
  WorkspaceRejectedBlockRule,
  WorkspaceTraitOfferControl,
  WorkspaceTraitOfferInteraction,
} from '@planner/projections/structured-workspace/contracts/traits';
import { semanticAddressKey } from '@run-planner/engine/authored-project';
import type {
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { CandidateProjectionSession } from '@planner/projections/candidates/candidateProjection';

import { derivedShopPayloadIntent, traitOfferCommandFor } from '../reward-child-command-binding';
import { StructuredWorkspaceProjectionContractError } from '@planner/projections/structured-workspace/contract';
import type { WorkspaceRewardControl } from '@planner/projections/structured-workspace/contracts/rewards';
import { bindChaosOfferInteraction } from './chaos';
import { bindTraitOfferOptionDomain } from './option-domain';

/** Binds the trait-offer aggregate; focused domain and typed child families stay separate. */
export function bindTraitOfferInteractions(input: {
  readonly catalog: Catalog;
  readonly candidates: CandidateProjectionSession;
  readonly traitControls: ReadonlyMap<string, WorkspaceTraitOfferControl>;
  readonly derivedShopEntryEdits: ReadonlyMap<
    string,
    NonNullable<WorkspaceRewardControl['derivedShopEntryEdit']>
  >;
  readonly traitDomain: import('@planner/projections/structured-workspace/contract').StructuredWorkspaceContextualServices['traitDomain'];
}): ReadonlyMap<string, WorkspaceTraitOfferInteraction> {
  const { catalog, candidates, traitControls, derivedShopEntryEdits, traitDomain } = input;
  const traitOffers = new Map<string, WorkspaceTraitOfferInteraction>();
  for (const [key, control] of traitControls) {
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
    const chaosInteraction = bindChaosOfferInteraction({ catalog, candidates, control });
    const load = (value = control.offer ?? startingDraft()) =>
      value === undefined ? Object.freeze([]) : candidates.traitOffer(control.address, value);
    const rejectedBlockDomain = (rules: readonly WorkspaceRejectedBlockRule[]) => {
      if (rules.length === 0) return undefined;
      return Object.freeze({
        required: rules.every((rule) => rule.rejectedBlockRequired),
        canClear: rules.every((rule) => !rule.rejectedBlockRequired),
        needsRepair: rules.some((rule) => rule.rejectedBlockNeedsRepair),
        optionKeys: Object.freeze(
          rules[0]!.rejectedBlockableOptionKeys.filter((optionKey) =>
            rules.every((rule) => rule.rejectedBlockableOptionKeys.includes(optionKey)),
          ),
        ),
      });
    };
    const optionDomain = bindTraitOfferOptionDomain({ catalog, candidates, control, traitDomain });
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
