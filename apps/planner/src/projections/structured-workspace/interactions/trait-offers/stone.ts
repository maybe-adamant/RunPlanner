import type {
  WorkspaceConcaveStoneInteraction,
  WorkspaceTraitCarrierChildControl,
} from '@planner/projections/structured-workspace/contracts/traits';
import { updateAuthoredTraitCarrierChild } from '@run-planner/engine/authored-project';
import type {
  AuthoredTraitOfferTraits,
  TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import type { CandidateProjectionSession } from '@planner/projections/candidates/candidateProjection';

/** Binds the candidate-backed Concave Stone child for one ordinary offer. */
export function bindConcaveStoneInteraction(input: {
  readonly candidates: CandidateProjectionSession;
  readonly child:
    Extract<WorkspaceTraitCarrierChildControl, { readonly kind: 'concaveStone' }> | undefined;
  readonly owner: TraitOfferAddress;
}): WorkspaceConcaveStoneInteraction | undefined {
  const { candidates, child, owner } = input;
  return child === undefined
    ? undefined
    : Object.freeze({
        child,
        update: (
          offer: AuthoredTraitOfferTraits,
          value: import('@run-planner/engine/authored-project').AuthoredConcaveStoneResult | null,
        ) =>
          updateAuthoredTraitCarrierChild(offer, {
            kind: 'concaveStone',
            child,
            value,
          }),
        completeFor: (offer: AuthoredTraitOfferTraits) => {
          const evaluated = candidates.traitCarrierChildDomain(owner, offer, child);
          if (evaluated.kind !== 'concaveStone') return false;
          const stone = evaluated.result.stone;
          return stone?.required !== true || offer.concaveStoneResult !== undefined;
        },
        forOffer: (offer: AuthoredTraitOfferTraits) =>
          Object.freeze({
            load: () => {
              const evaluated = candidates.traitCarrierChildDomain(owner, offer, child);
              if (evaluated.kind !== 'concaveStone') return undefined;
              const stone = evaluated.result.stone;
              if (stone === undefined) return undefined;
              return Object.freeze({
                procSupport: stone.procSupport,
                required: stone.required,
                residualOptionKeys: stone.residualOptionKeys,
                resultSupport: stone.resultSupport,
              });
            },
          }),
      });
}
