import type { ShopPurchaseAddress } from '@run-planner/engine/authored-project';
import {
  candidateSupport,
  presentCandidateLabel,
  type CandidateOptionProjection,
  type CandidateProjectionEvaluation,
} from '@planner/projections/candidateProjection';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceShopPurchaseOrderOption,
} from '@planner/projections/structured-workspace';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { candidateMayBeAuthored } from '@planner/ui/feedback/candidatePresentation';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';

interface ShopPurchaseControlProps {
  readonly address: ShopPurchaseAddress;
  readonly label: string;
  readonly purchased: boolean;
  readonly position: number | null;
  readonly positionOptions: readonly WorkspaceShopPurchaseOrderOption[];
  readonly toggleOfferKeys: readonly string[];
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onChange: (offerKeys: readonly string[]) => void;
}

function sameOfferKeys(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

function optionFor(
  options:
    | readonly CandidateOptionProjection<readonly string[], CandidateProjectionEvaluation>[]
    | undefined,
  offerKeys: readonly string[],
): CandidateOptionProjection<readonly string[], CandidateProjectionEvaluation> | undefined {
  return options?.find((option) => sameOfferKeys(option.value, offerKeys));
}

/**
 * One Shop row presents membership and ordinal as two controls over one
 * occurrence-owned purchase-order interaction. The assembler supplies all
 * complete proposals; React never repairs an array locally.
 */
export function ShopPurchaseControl({
  address,
  label,
  purchased,
  position,
  positionOptions,
  toggleOfferKeys,
  interactions,
  onChange,
}: ShopPurchaseControlProps) {
  const interaction = requireWorkspaceInteraction(
    interactions.shopPurchaseOrders,
    workspaceInteractionKey(address),
  );
  const projection = useWorkspaceInteraction(interaction);
  const current = projection.result?.find((option) =>
    sameOfferKeys(option.value, interaction.selected ?? []),
  );
  const toggle = optionFor(projection.result, toggleOfferKeys);
  const apply = (offerKeys: readonly string[]) => {
    const options = projection.result ?? projection.activate();
    const proposal = optionFor(options, offerKeys);
    if (candidateMayBeAuthored(proposal)) onChange(offerKeys);
  };
  const checkboxId = `shop-${workspaceInteractionKey(address)}-purchased`;
  const selectId = `shop-${workspaceInteractionKey(address)}-purchase-order`;

  return (
    <>
      <td
        aria-busy={projection.pending || undefined}
        className="shop-purchase-membership"
        data-candidate-support={candidateSupport(current)}
      >
        <label className="purchase-control" htmlFor={checkboxId}>
          <SemanticOwnerMarker address={address} />
          <input
            aria-label={`Purchase ${label}`}
            checked={purchased}
            disabled={projection.result !== undefined && !candidateMayBeAuthored(toggle)}
            id={checkboxId}
            onChange={() => apply(toggleOfferKeys)}
            onFocus={projection.activate}
            onPointerDown={projection.activate}
            type="checkbox"
          />
          Purchased
        </label>
      </td>
      <td aria-busy={projection.pending || undefined} className="shop-purchase-order">
        <label className="visually-hidden" htmlFor={selectId}>
          Purchase order for {label}
        </label>
        <select
          aria-label={`Purchase order for ${label}`}
          disabled={!purchased}
          id={selectId}
          onChange={(event) => {
            const option = positionOptions.find(
              (candidate) => candidate.position === Number(event.target.value),
            );
            if (option !== undefined) apply(option.offerKeys);
          }}
          onFocus={projection.activate}
          onPointerDown={projection.activate}
          value={position === null ? '' : String(position)}
        >
          {purchased ? null : <option value="">—</option>}
          {positionOptions.map((option) => {
            const candidate = optionFor(projection.result, option.offerKeys);
            return (
              <option
                data-candidate-support={candidateSupport(candidate)}
                disabled={projection.result !== undefined && !candidateMayBeAuthored(candidate)}
                key={option.position}
                value={option.position}
              >
                {presentCandidateLabel(option.label, candidate)}
              </option>
            );
          })}
        </select>
      </td>
    </>
  );
}
