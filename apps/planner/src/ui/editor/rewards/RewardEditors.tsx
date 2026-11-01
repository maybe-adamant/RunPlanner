import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { useEffect, useMemo, useState } from 'react';

import type {
  CountedRewardCandidateOwner,
  RewardCandidateOwner,
} from '@planner/projections/candidates/candidateProjection';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type { RewardPickerStep } from '@planner/projections/rewards/rewardPicker';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceRewardOfferResolver,
} from '@planner/projections/structured-workspace';
import { offerIcon, rewardIcon } from '@planner/ui/artwork/rewardIcon';
import type { ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { useFindingTarget, type FindingTargetProps } from '@planner/ui/feedback/useFindingTarget';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';

interface RewardValueEditorProps {
  readonly ariaLabel?: string;
  readonly candidateOwner: RewardCandidateOwner;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label?: string;
  readonly labelIcon?: ArtworkSource | undefined;
  readonly offer: ResolvedRewardOffer | null;
  readonly onReplace: (offer: ResolvedRewardOffer) => void;
  readonly initialStep?: RewardPickerStep;
  /** Vow of Forfeit realization named after the authored offer in the trigger text. */
  readonly realizedLabel?: string;
  /** A fixed-type inline editor may present only its selected Boon source. */
  readonly summaryMode?: 'offer' | 'source';
  readonly unresolvedSeed?: ResolvedRewardOffer;
}

interface CountedRewardEditorProps extends Omit<RewardValueEditorProps, 'candidateOwner'> {
  readonly candidateOwner: CountedRewardCandidateOwner;
}

interface RewardInteraction {
  readonly context: object;
  readonly seed?: ResolvedRewardOffer;
  readonly step: RewardPickerStep;
}

const emptyModel: ContextualPickerModel<ResolvedRewardOffer> = Object.freeze({
  sections: Object.freeze([]),
});

/** A picker row shows its reward type, or the Boon or Trial god the row picks. */
function pickerRowIcon(
  offer: ResolvedRewardOffer,
  step: RewardPickerStep | undefined,
): string | undefined {
  const payload = offer.payload;
  if (payload === undefined || step === 'type') return rewardIcon(offer.rewardType);
  if (payload.kind === 'BoonSource') return rewardIcon(payload.source);
  return rewardIcon(step === 'spurned' ? payload.spurnedSource : payload.chosenSource);
}

/** While picking a Trial, the trigger fills its gods in as each is picked. */
function triggerIcon(
  offer: ResolvedRewardOffer,
  step: RewardPickerStep | undefined,
): ArtworkSource | undefined {
  if (step === undefined || offer.payload?.kind !== 'DevotionPair') return offerIcon(offer);
  return [step === 'spurned' ? rewardIcon(offer.payload.chosenSource) : undefined, undefined];
}

function offerKey(offer: ResolvedRewardOffer): string {
  return JSON.stringify(offer);
}

export function RewardValueEditor({
  ariaLabel,
  candidateOwner,
  interactions,
  label = 'Reward',
  labelIcon,
  offer,
  onReplace,
  initialStep = 'type',
  realizedLabel,
  summaryMode = 'offer',
  unresolvedSeed,
}: RewardValueEditorProps) {
  const findingTarget = useFindingTarget();
  const resolver = requireWorkspaceInteraction(
    interactions.rewards,
    workspaceInteractionKey(candidateOwner.address),
  );
  return (
    <RewardOfferPicker
      {...(ariaLabel === undefined ? {} : { ariaLabel })}
      findingTarget={findingTarget(candidateOwner.address)}
      id={semanticOwnerControlElementId(candidateOwner.address)}
      initialStep={initialStep}
      label={label}
      {...(labelIcon === undefined ? {} : { labelIcon })}
      offer={offer}
      onReplace={onReplace}
      {...(realizedLabel === undefined ? {} : { realizedLabel })}
      resolver={resolver}
      resolvesShopItem={candidateOwner.address.kind === 'shopOffer'}
      summaryMode={summaryMode}
      {...(unresolvedSeed === undefined ? {} : { unresolvedSeed })}
    />
  );
}

/** A staged reward picker over one resolver: type first, then a Boon or Trial god. */
export function RewardOfferPicker({
  ariaLabel,
  defaultOpen = false,
  findingTarget,
  id,
  label,
  labelIcon,
  offer,
  onDismiss,
  onReplace,
  initialStep = 'type',
  placeholder = 'Choose reward',
  realizedLabel,
  resolver,
  resolvesShopItem = false,
  summaryMode = 'offer',
  unresolvedSeed,
}: {
  readonly ariaLabel?: string;
  /** Opens on mount, continuing a pick that started in another picker. */
  readonly defaultOpen?: boolean;
  readonly findingTarget?: FindingTargetProps;
  readonly id: string;
  readonly label: string;
  readonly labelIcon?: ArtworkSource | undefined;
  readonly offer: ResolvedRewardOffer | null;
  /** Called when the planner closes the picker without choosing. */
  readonly onDismiss?: () => void;
  readonly onReplace: (offer: ResolvedRewardOffer) => void;
  readonly initialStep?: RewardPickerStep;
  readonly placeholder?: string;
  readonly realizedLabel?: string;
  readonly resolver: WorkspaceRewardOfferResolver;
  /** A Shop slot's type step commits an item resolved at acquisition. */
  readonly resolvesShopItem?: boolean;
  readonly summaryMode?: 'offer' | 'source';
  readonly unresolvedSeed?: ResolvedRewardOffer;
}) {
  const authoredOfferKey = offer === null ? '__unresolved__' : offerKey(offer);
  const domain = useWorkspaceInteraction(resolver);
  const context = useMemo(
    () => Object.freeze({ authoredOfferKey, resolver }),
    [authoredOfferKey, resolver],
  );
  const [interaction, setInteraction] = useState<RewardInteraction | undefined>(() => {
    const seed = offer ?? unresolvedSeed;
    return defaultOpen
      ? Object.freeze({ context, ...(seed === undefined ? {} : { seed }), step: initialStep })
      : undefined;
  });
  const interactionMatchesContext = interaction === undefined || interaction.context === context;
  const active = interactionMatchesContext ? interaction : undefined;

  const begin = (seed: ResolvedRewardOffer | undefined, step: RewardPickerStep): void => {
    domain.activate();
    setInteraction(
      Object.freeze({
        context,
        ...(seed === undefined ? {} : { seed }),
        step,
      }),
    );
  };

  const startInteraction = (): void => {
    begin(offer ?? unresolvedSeed, initialStep);
  };

  useEffect(() => {
    if (defaultOpen) domain.activate();
    // A picker that opens on mount loads its choices once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelInteraction = (): void => {
    setInteraction(undefined);
  };

  const advance = (seed: ResolvedRewardOffer, step: RewardPickerStep): void => {
    begin(seed, step);
  };

  const commit = (value: ResolvedRewardOffer): void => {
    onReplace(value);
    cancelInteraction();
  };

  const select = (value: ResolvedRewardOffer): void => {
    if (active === undefined) {
      return;
    }
    switch (active.step) {
      case 'type':
        if (resolvesShopItem && resolver.resolvesAtAcquisition(value)) {
          commit(Object.freeze({ rewardType: value.rewardType }));
        } else if (value.payload === undefined) {
          commit(value);
        } else if (value.payload.kind === 'BoonSource') {
          advance(value, 'source');
        } else {
          advance(value, 'chosen');
        }
        break;
      case 'source':
      case 'spurned':
        commit(value);
        break;
      case 'chosen':
        advance(value, 'spurned');
        break;
    }
  };

  const model =
    active === undefined || domain.result === undefined
      ? emptyModel
      : resolver.model(domain.result, active.step, active.seed);
  const activeOffer = active?.seed ?? offer ?? undefined;
  const summary =
    summaryMode === 'source'
      ? activeOffer?.payload?.kind === 'BoonSource'
        ? resolver.summary({ rewardType: activeOffer.payload.source })
        : 'Choose God'
      : activeOffer === undefined
        ? placeholder
        : resolver.summary(activeOffer);
  const triggerLabel = realizedLabel === undefined ? summary : `${summary} (${realizedLabel})`;

  return (
    <div className="reward-value-editor">
      <ContextualPicker
        {...(findingTarget === undefined ? {} : { findingTarget })}
        {...(ariaLabel === undefined ? {} : { ariaLabel })}
        cancelLabel="Cancel"
        choiceLabel={resolver.choiceLabel(active?.step ?? 'type', activeOffer)}
        closeOnSelect={false}
        id={id}
        label={label}
        labelIcon={labelIcon}
        layout="inline"
        loading={active !== undefined && domain.result === undefined}
        model={model}
        onOpenChange={(open) => {
          if (open) {
            startInteraction();
          } else {
            cancelInteraction();
            onDismiss?.();
          }
        }}
        onSelect={select}
        open={active !== undefined}
        placeholder={summary}
        triggerLabel={triggerLabel}
        triggerIcon={activeOffer === undefined ? undefined : triggerIcon(activeOffer, active?.step)}
        itemIcon={(item) => pickerRowIcon(item.value, active?.step)}
        {...(realizedLabel === undefined
          ? {}
          : { triggerHint: 'Converted by the Vow of Forfeit.' })}
      />
    </div>
  );
}

export function CountedRewardEditor({
  ariaLabel,
  candidateOwner,
  offer,
  idPrefix,
  interactions,
  label,
  labelIcon,
  onReplace,
  initialStep,
  realizedLabel,
  summaryMode,
  unresolvedSeed,
}: CountedRewardEditorProps) {
  return (
    <RewardValueEditor
      {...(ariaLabel === undefined ? {} : { ariaLabel })}
      candidateOwner={candidateOwner}
      idPrefix={idPrefix}
      interactions={interactions}
      {...(label === undefined ? {} : { label })}
      {...(labelIcon === undefined ? {} : { labelIcon })}
      offer={offer}
      onReplace={onReplace}
      {...(initialStep === undefined ? {} : { initialStep })}
      {...(realizedLabel === undefined ? {} : { realizedLabel })}
      {...(summaryMode === undefined ? {} : { summaryMode })}
      {...(unresolvedSeed === undefined ? {} : { unresolvedSeed })}
    />
  );
}
