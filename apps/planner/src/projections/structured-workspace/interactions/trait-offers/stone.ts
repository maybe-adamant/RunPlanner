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
          const branches = evaluated.result.branches;
          const first = branches[0];
          if (first === undefined) return true;
          if (!branches.every((branch) => branch.required === first.required)) return false;
          return !first.required || offer.concaveStoneResult !== undefined;
        },
        forOffer: (offer: AuthoredTraitOfferTraits) =>
          Object.freeze({
            load: () => {
              const evaluated = candidates.traitCarrierChildDomain(owner, offer, child);
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
}
