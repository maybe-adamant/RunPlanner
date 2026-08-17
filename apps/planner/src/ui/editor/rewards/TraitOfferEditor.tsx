import {
  semanticAddressKey,
  optionIndex,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
  type AuthoredEchoLastRunBoonOffer,
  type AuthoredEchoLastRunBoonOption,
  type AuthoredEchoLastRewardAcquisition,
  type AuthoredAllTogetherResult,
  type TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import type { DirectTraitSetKey, TraitRarity } from '@run-planner/engine/catalog-schema';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { candidateSupport } from '@planner/projections/candidateProjection';
import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import type { TraitOptionDomainProjection } from '@planner/projections/traitDomainProjection';
import type { AuthoredCirceResolution } from '@run-planner/engine/authored-project';
import { projectTraitOfferFeedback } from '@planner/projections/traitProjection';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceCirceResolutionDomain,
  type WorkspaceEchoPomTargetDomain,
  type WorkspaceEchoLastRunBoonDomain,
  type WorkspaceEchoLastRewardDomain,
  type WorkspaceAllTogetherSetInteraction,
  type WorkspaceAllTogetherSetDomain,
  type WorkspaceTraitOfferInteraction,
  type WorkspaceTraitOfferControl,
} from '@planner/projections/structured-workspace';
import { traitOfferDialogClosed, traitOfferDialogOpened } from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';

const OPTION_KEYS = ['option1', 'option2', 'option3'] as const;

const emptyTraitPicker: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});

const emptyRarityPicker: ContextualPickerModel<TraitRarity> = Object.freeze({
  sections: Object.freeze([]),
});

const emptyTargetPicker: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});

function rarityLabel(rarity: TraitRarity): string {
  return rarity;
}

function pickerValueLabel<T>(model: ContextualPickerModel<T>, value: T): string | undefined {
  return model.sections
    .flatMap((section) => section.items)
    .find((item) => Object.is(item.value, value))?.label;
}

function AllTogetherSetPicker({
  interaction,
  offer,
  onCancel,
  onSelect,
}: {
  readonly interaction: WorkspaceAllTogetherSetInteraction;
  readonly offer: AuthoredTraitOfferTraits;
  readonly onCancel: () => void;
  readonly onSelect: (value: string | null, label: string) => void;
}) {
  const loadable = useMemo(() => interaction.forOffer(offer), [interaction, offer]);
  const controller = useWorkspaceInteractionController<WorkspaceAllTogetherSetDomain | undefined>();
  const loaded = controller.observe(loadable);
  useEffect(() => {
    controller.activate(loadable);
  }, [controller, loadable]);
  return (
    <ContextualPicker
      cancelLabel="Cancel"
      choiceLabel={`${interaction.control.setKey[0]!.toUpperCase()}${interaction.control.setKey.slice(1)} grant`}
      closeOnSelect={false}
      id={`${semanticOwnerControlElementId(interaction.control.address)}-picker`}
      label="Grant"
      loading={loaded.pending}
      model={loaded.result?.picker ?? { sections: Object.freeze([]) }}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      onSelect={(value) =>
        onSelect(
          value,
          loaded.result === undefined
            ? value === null
              ? 'No grant'
              : value
            : (pickerValueLabel(loaded.result.picker, value) ?? String(value)),
        )
      }
      open={true}
      placeholder="Choose a grant"
    />
  );
}

function AllTogetherOutcomeEditor({
  interactions,
  offer,
  optionIndex: index,
  onSelect,
}: {
  readonly interactions: readonly WorkspaceAllTogetherSetInteraction[];
  readonly offer: AuthoredTraitOfferTraits;
  readonly optionIndex: number;
  readonly onSelect: (result: AuthoredAllTogetherResult) => void;
}) {
  const option = offer.options[index];
  const [draft, setDraft] = useState<Partial<AuthoredAllTogetherResult>>(
    option?.allTogetherResult ?? Object.freeze({}),
  );
  const labelsForControls = () =>
    Object.freeze(
      Object.fromEntries(
        interactions.flatMap((interaction) =>
          interaction.control.valueLabel === undefined
            ? []
            : [[interaction.control.setKey, interaction.control.valueLabel]],
        ),
      ),
    ) as Partial<Record<DirectTraitSetKey, string>>;
  const [draftLabels, setDraftLabels] = useState(labelsForControls);
  const [activeIndex, setActiveIndex] = useState<number>();
  const activeInteraction = activeIndex === undefined ? undefined : interactions[activeIndex];
  const activeSetKey = activeInteraction?.control.setKey;
  const complete =
    interactions.length > 0 &&
    interactions.every((interaction) =>
      Object.prototype.hasOwnProperty.call(draft, interaction.control.setKey),
    );

  const begin = (setIndex = 0): void => {
    setDraft(option?.allTogetherResult ?? Object.freeze({}));
    setDraftLabels(labelsForControls());
    setActiveIndex(setIndex);
  };
  const cancel = (): void => {
    setDraft(option?.allTogetherResult ?? Object.freeze({}));
    setDraftLabels(labelsForControls());
    setActiveIndex(undefined);
  };
  const choose = (value: string | null, label: string): void => {
    if (activeSetKey === undefined) return;
    const next = Object.freeze({ ...draft, [activeSetKey]: value });
    setDraft(next);
    setDraftLabels((current) => Object.freeze({ ...current, [activeSetKey]: label }));
    const nextMissing = interactions.findIndex(
      (interaction) => !Object.prototype.hasOwnProperty.call(next, interaction.control.setKey),
    );
    setActiveIndex(nextMissing < 0 ? undefined : nextMissing);
  };

  return (
    <fieldset className="trait-selected-outcome-detail">
      <legend>Elemental grants</legend>
      <div className="trait-outcome-summary-list">
        {interactions.map((interaction, setIndex) => {
          const key = interaction.control.setKey;
          const value = draft[key];
          const label = Object.prototype.hasOwnProperty.call(draft, key)
            ? (draftLabels[key] ?? (value === null ? 'No grant' : 'Configured'))
            : 'Unspecified';
          return (
            <button
              className="quiet-action action-compact"
              id={semanticOwnerControlElementId(interaction.control.address)}
              key={key}
              onClick={() => begin(setIndex)}
              type="button"
            >
              {key[0]!.toUpperCase() + key.slice(1)}: {label}
            </button>
          );
        })}
      </div>
      {activeInteraction === undefined ? null : (
        <AllTogetherSetPicker
          interaction={activeInteraction}
          offer={offer}
          onCancel={cancel}
          onSelect={choose}
        />
      )}
      {complete && activeIndex === undefined ? (
        <div className="trait-outcome-actions">
          <button
            className="quiet-action action-compact"
            onClick={() => onSelect(Object.freeze(draft) as AuthoredAllTogetherResult)}
            type="button"
          >
            Apply complete outcome
          </button>
          <button className="quiet-action action-compact" onClick={cancel} type="button">
            Cancel
          </button>
        </div>
      ) : null}
      {!complete && activeIndex === undefined ? (
        <button className="quiet-action action-compact" onClick={() => begin()} type="button">
          Choose all grants
        </button>
      ) : null}
    </fieldset>
  );
}

function launcherId(address: TraitOfferAddress): string {
  return `trait-launcher-${semanticAddressKey(address)}`;
}

function traitOfferLoadable(
  interaction: WorkspaceTraitOfferInteraction,
  value: AuthoredTraitOffer,
): { readonly load: () => ReturnType<WorkspaceTraitOfferInteraction['load']> } {
  const loadInteraction = interaction.load;
  return Object.freeze({ load: () => loadInteraction(value) });
}

function traitOfferRevision(interaction: WorkspaceTraitOfferInteraction): string {
  if (interaction.value === null) return `${interaction.giver.key}|unresolved`;
  if (interaction.value.kind === 'fallbackGold') {
    return `${interaction.giver.key}|fallbackGold`;
  }
  return [
    interaction.giver.key,
    interaction.choices.map((choice) => choice.value).join(','),
    interaction.value.options
      .map(
        (option) =>
          `${option.traitKey}:${option.rarity ?? ''}:${option.targetTraitKey ?? ''}:${
            'echoPomTarget' in option ? (option.echoPomTarget ?? 'none') : ''
          }:${'echoLastRunBoon' in option ? JSON.stringify(option.echoLastRunBoon) : ''}:${
            'echoLastReward' in option ? JSON.stringify(option.echoLastReward) : ''
          }:${'allTogetherResult' in option ? JSON.stringify(option.allTogetherResult) : ''}`,
      )
      .join(','),
    interaction.value.selectedOptionKey,
    interaction.value.deathDefianceConditionMet === true ? 'dd' : 'no-dd',
  ].join('|');
}

function sameEchoLastRunOption(
  left: AuthoredEchoLastRunBoonOption,
  right: AuthoredEchoLastRunBoonOption,
): boolean {
  return (
    left.giverKey === right.giverKey &&
    left.traitKey === right.traitKey &&
    left.rarity === right.rarity
  );
}
function EchoLastRunBoonEditor({
  domain,
  value,
  onSelect,
}: {
  readonly domain: WorkspaceEchoLastRunBoonDomain;
  readonly value?: AuthoredEchoLastRunBoonOffer;
  readonly onSelect: (value: AuthoredEchoLastRunBoonOffer) => void;
}) {
  const firstUnused = domain.appendCandidate;
  if (value === undefined) {
    return (
      <fieldset className="trait-circe-resolution">
        <legend>Boon Boon Boon outcomes</legend>
        <button
          disabled={firstUnused === undefined}
          onClick={() => {
            if (firstUnused === undefined) return;
            onSelect(
              Object.freeze({
                options: Object.freeze([firstUnused.value] as const),
                selectedOptionKey: 'option1',
              }),
            );
          }}
          type="button"
        >
          Choose previous-run outcome
        </button>
      </fieldset>
    );
  }
  return (
    <fieldset className="trait-circe-resolution">
      <legend>Boon Boon Boon outcomes</legend>
      {value.options.map((entry, index) => {
        const optionKey = OPTION_KEYS[index]!;
        const selectedCandidate = domain.candidates.find((candidate) =>
          sameEchoLastRunOption(candidate.value, entry),
        );
        return (
          <fieldset key={optionKey}>
            <legend>{optionKey.replace('option', 'Outcome ')}</legend>
            <select
              aria-label={`Boon Boon Boon ${optionKey}`}
              onChange={(event) => {
                const candidate = domain.candidates[Number(event.target.value)];
                if (candidate === undefined || !candidate.supported) return;
                const options = [...value.options];
                options[index] = candidate.value;
                onSelect(
                  Object.freeze({
                    ...value,
                    options: Object.freeze(options) as AuthoredEchoLastRunBoonOffer['options'],
                  }),
                );
              }}
              value={domain.candidates.findIndex((candidate) =>
                sameEchoLastRunOption(candidate.value, entry),
              )}
            >
              {(domain.candidatesByOption[index] ?? []).map((candidate) => {
                const candidateIndex = domain.candidates.indexOf(candidate);
                return (
                  <option
                    disabled={!candidate.supported}
                    key={`${candidate.value.giverKey}:${candidate.value.traitKey}:${candidate.value.rarity}`}
                    value={candidateIndex}
                  >
                    {candidate.label}
                    {candidate.effectiveRarity === candidate.value.rarity
                      ? ''
                      : ` → ${candidate.effectiveRarity}`}
                  </option>
                );
              })}
            </select>
            {selectedCandidate?.targetChoices.length ? (
              <select
                aria-label={`Boon Boon Boon ${optionKey} acquisition target`}
                onChange={(event) => {
                  const options = [...value.options];
                  options[index] = Object.freeze(
                    event.target.value === ''
                      ? {
                          giverKey: entry.giverKey,
                          traitKey: entry.traitKey,
                          rarity: entry.rarity,
                        }
                      : { ...entry, targetTraitKey: event.target.value },
                  );
                  onSelect(
                    Object.freeze({
                      ...value,
                      options: Object.freeze(options) as AuthoredEchoLastRunBoonOffer['options'],
                    }),
                  );
                }}
                value={entry.targetTraitKey ?? ''}
              >
                <option value="">Choose acquisition target</option>
                {selectedCandidate.targetChoices.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            ) : null}
            <label>
              <input
                checked={value.selectedOptionKey === optionKey}
                name="echo-last-run-selected"
                onChange={() => onSelect(Object.freeze({ ...value, selectedOptionKey: optionKey }))}
                type="radio"
              />
              Selected
            </label>
            {value.options.length === 1 ? null : (
              <button
                onClick={() => {
                  const options = value.options.filter(
                    (_, candidateIndex) => candidateIndex !== index,
                  );
                  const selectedIndex = optionIndex(value.selectedOptionKey);
                  const nextSelectedIndex =
                    selectedIndex === index
                      ? 0
                      : selectedIndex > index
                        ? selectedIndex - 1
                        : selectedIndex;
                  onSelect(
                    Object.freeze({
                      options: Object.freeze(options) as AuthoredEchoLastRunBoonOffer['options'],
                      selectedOptionKey: OPTION_KEYS[nextSelectedIndex]!,
                    }),
                  );
                }}
                type="button"
              >
                Remove outcome
              </button>
            )}
          </fieldset>
        );
      })}
      {value.options.length >= 3 || firstUnused === undefined ? null : (
        <button
          onClick={() =>
            onSelect(
              Object.freeze({
                ...value,
                options: Object.freeze([
                  ...value.options,
                  firstUnused.value,
                ]) as AuthoredEchoLastRunBoonOffer['options'],
              }),
            )
          }
          type="button"
        >
          Add outcome
        </button>
      )}
    </fieldset>
  );
}

function EchoLastRewardEditor({
  domain,
  value,
  onSelect,
}: {
  readonly domain: WorkspaceEchoLastRewardDomain;
  readonly value?: AuthoredEchoLastRewardAcquisition;
  readonly onSelect: (value: AuthoredEchoLastRewardAcquisition) => void;
}) {
  if (value === undefined) {
    return (
      <fieldset className="trait-circe-resolution">
        <legend>Reward Reward Reward replay</legend>
        <p>Latest replayable source: {domain.rewardLabel}</p>
        <button onClick={() => onSelect(domain.initialValue)} type="button">
          Create replay decisions
        </button>
      </fieldset>
    );
  }
  const presentedTraitOffer = value.traitOffer ?? domain.traitOfferDraft;
  const traitOffer = presentedTraitOffer?.kind === 'traits' ? presentedTraitOffer : undefined;
  const level = value.levelResolution ?? domain.levelResolutionDraft;
  const updateTraitOffer = (next: AuthoredTraitOfferTraits): void =>
    onSelect(Object.freeze({ ...value, traitOffer: next }));
  return (
    <fieldset className="trait-circe-resolution">
      <legend>Reward Reward Reward replay</legend>
      <p>Recreated source: {domain.rewardLabel}</p>
      <label>
        Disposition
        <select
          aria-label="Reward Reward Reward conversion"
          onChange={(event) =>
            onSelect(
              Object.freeze({
                ...value,
                disposition: Object.freeze({
                  kind: event.target.value as 'normal' | 'timePiece',
                }),
              }),
            )
          }
          value={value.disposition.kind}
        >
          <option value="normal">Acquire reward</option>
          {domain.goldSupported || value.disposition.kind === 'timePiece' ? (
            <option disabled={!domain.goldSupported} value="timePiece">
              Convert to Gold
            </option>
          ) : null}
        </select>
      </label>
      {traitOffer === undefined ? null : (
        <fieldset>
          <legend>Fresh reward offer</legend>
          {traitOffer.options.map((traitOption, index) => {
            const optionKey = OPTION_KEYS[index]!;
            const optionDomain = domain.traitOptionDomains[index];
            const traitPicker = optionDomain?.traitPicker ?? emptyTraitPicker;
            const rarityPicker = optionDomain?.rarityPickerFor(traitOption.traitKey);
            const targetPicker = optionDomain?.targetPicker ?? emptyTargetPicker;
            return (
              <div key={optionKey}>
                <ContextualPicker
                  ariaLabel={`Replayed ${optionKey} trait`}
                  id={`echo-replay-${domain.rewardType}-${optionKey}-trait`}
                  label="Trait"
                  model={traitPicker}
                  onSelect={(traitKey) => {
                    const preferred = optionDomain?.preferredOptionFor(traitKey);
                    if (preferred !== undefined)
                      updateTraitOffer(replaceOption(traitOffer, index, preferred));
                  }}
                  placeholder="Choose a trait"
                  triggerLabel={traitOption.traitKey}
                />
                {!domain.traitRarityEditable || rarityPicker === undefined ? (
                  traitOption.rarity === undefined ? null : (
                    <p className="trait-offer-fixed-rarity">
                      Rarity: {rarityLabel(traitOption.rarity)}
                    </p>
                  )
                ) : (
                  <ContextualPicker
                    ariaLabel={`Replayed ${optionKey} rarity`}
                    id={`echo-replay-${domain.rewardType}-${optionKey}-rarity`}
                    label="Rarity"
                    model={rarityPicker}
                    onSelect={(rarity) =>
                      updateTraitOffer(replaceOption(traitOffer, index, { ...traitOption, rarity }))
                    }
                    placeholder="Choose a rarity"
                    {...(traitOption.rarity === undefined
                      ? {}
                      : { triggerLabel: rarityLabel(traitOption.rarity) })}
                  />
                )}
                {optionDomain?.targetPicker === undefined ? null : (
                  <ContextualPicker
                    ariaLabel={`Replayed ${optionKey} acquisition target`}
                    id={`echo-replay-${domain.rewardType}-${optionKey}-target`}
                    label="Target"
                    model={targetPicker}
                    onSelect={(targetTraitKey) =>
                      updateTraitOffer(
                        replaceOption(traitOffer, index, { ...traitOption, targetTraitKey }),
                      )
                    }
                    placeholder="Choose an equipped trait"
                    {...(traitOption.targetTraitKey === undefined
                      ? {}
                      : { triggerLabel: traitOption.targetTraitKey })}
                  />
                )}
                <label>
                  <input
                    checked={traitOffer.selectedOptionKey === optionKey}
                    name={`echo-replay-${domain.rewardType}-selected`}
                    onChange={() =>
                      updateTraitOffer(
                        Object.freeze({ ...traitOffer, selectedOptionKey: optionKey }),
                      )
                    }
                    type="radio"
                  />
                  Selected
                </label>
              </div>
            );
          })}
          {domain.nextTraitOffer === undefined ? null : (
            <button onClick={() => updateTraitOffer(domain.nextTraitOffer!)} type="button">
              Next fresh offer
            </button>
          )}
        </fieldset>
      )}
      {level?.kind === 'choice' ? (
        <fieldset>
          <legend>Pom choices</legend>
          {domain.levelTargetChoices.map((choice) => {
            const checked = level.offeredTraitKeys.includes(choice.value);
            return (
              <label key={choice.value}>
                <input
                  checked={checked}
                  onChange={() => {
                    const offeredTraitKeys = checked
                      ? level.offeredTraitKeys.filter((key) => key !== choice.value)
                      : [...level.offeredTraitKeys, choice.value].slice(0, 3);
                    onSelect(
                      Object.freeze({
                        ...value,
                        levelResolution: Object.freeze({
                          kind: 'choice' as const,
                          offeredTraitKeys: Object.freeze(offeredTraitKeys),
                          selectedTraitKey: offeredTraitKeys.includes(level.selectedTraitKey ?? '')
                            ? level.selectedTraitKey
                            : (offeredTraitKeys[0] ?? null),
                        }),
                      }),
                    );
                  }}
                  type="checkbox"
                />
                {choice.label}
              </label>
            );
          })}
          <select
            aria-label="Reward Reward Reward Pom selection"
            onChange={(event) =>
              onSelect(
                Object.freeze({
                  ...value,
                  levelResolution: Object.freeze({
                    ...level,
                    selectedTraitKey: event.target.value === '' ? null : event.target.value,
                  }),
                }),
              )
            }
            value={level.selectedTraitKey ?? ''}
          >
            <option value="">Choose a Pom target</option>
            {level.offeredTraitKeys.map((traitKey) => (
              <option key={traitKey} value={traitKey}>
                {domain.levelTargetChoices.find((choice) => choice.value === traitKey)?.label ??
                  traitKey}
              </option>
            ))}
          </select>
        </fieldset>
      ) : level?.kind === 'random' ? (
        <label>
          Random Pom target
          <select
            aria-label="Reward Reward Reward random Pom target"
            onChange={(event) =>
              onSelect(
                Object.freeze({
                  ...value,
                  levelResolution: Object.freeze({
                    kind: 'random' as const,
                    targetTraitKey: event.target.value === '' ? null : event.target.value,
                  }),
                }),
              )
            }
            value={level.targetTraitKey ?? ''}
          >
            {domain.emptyLevelTargetAllowed ? <option value="">No eligible target</option> : null}
            {!domain.emptyLevelTargetAllowed ? <option value="">Choose a target</option> : null}
            {domain.levelTargetChoices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button onClick={() => onSelect(domain.initialValue)} type="button">
        Reset replay decisions
      </button>
    </fieldset>
  );
}

function replaceOption(
  value: AuthoredTraitOfferTraits,
  index: number,
  next: AuthoredTraitOfferTraits['options'][number],
): AuthoredTraitOfferTraits {
  const options = [...value.options] as AuthoredTraitOfferTraits['options'][number][];
  options[index] = Object.freeze({ ...next });
  return Object.freeze({
    ...value,
    options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
  });
}

function CirceResolutionEditor({
  controlId,
  domain,
  option,
  onSelect,
}: {
  readonly controlId: string;
  readonly domain: WorkspaceCirceResolutionDomain;
  readonly option: AuthoredTraitOfferTraits['options'][number];
  readonly onSelect: (resolution: AuthoredCirceResolution) => void;
}) {
  const current = option.circeResolution;
  const [lapisDraft, setLapisDraft] = useState<readonly string[]>(
    current?.kind === 'promoteArcana' ? current.arcanaKeys : Object.freeze([]),
  );
  const [lapisOpen, setLapisOpen] = useState(false);
  const unavailableMessage = !domain.outerAvailable
    ? 'This Circe trait has no available outcome here.'
    : !domain.branchAgreement
      ? 'No outcome is supported across every route branch.'
      : undefined;
  if (domain.effect === 'disableFear') {
    return (
      <>
        {unavailableMessage === undefined ? null : (
          <p className="feedback-text">{unavailableMessage}</p>
        )}
        <ContextualPicker
          ariaLabel="Black Night Vow"
          id={controlId}
          label="Vow to suppress"
          model={domain.vowPicker}
          onSelect={(vowKey) => onSelect(Object.freeze({ kind: 'disableFear', vowKey }))}
          placeholder="Choose a Vow"
          {...(current?.kind === 'disableFear' && current.vowKey !== null
            ? { triggerLabel: pickerValueLabel(domain.vowPicker, current.vowKey) ?? current.vowKey }
            : {})}
        />
      </>
    );
  }
  const selected =
    current?.kind === domain.effect ? current.arcanaKeys : (Object.freeze([]) as readonly string[]);
  if (domain.effect === 'activateArcana') {
    if (domain.requiredCount === 0) {
      return (
        <>
          {unavailableMessage === undefined ? null : (
            <p className="feedback-text">{unavailableMessage}</p>
          )}
          {selected[0] === undefined ? null : (
            <ContextualPicker
              ariaLabel="Red Citrine Arcana"
              id={controlId}
              label="Authored Arcana"
              model={domain.arcanaPicker}
              onSelect={(arcanaKey) =>
                onSelect(
                  Object.freeze({
                    kind: 'activateArcana',
                    arcanaKeys: Object.freeze([arcanaKey]),
                  }),
                )
              }
              placeholder="No authored Arcana"
              triggerLabel={pickerValueLabel(domain.arcanaPicker, selected[0]) ?? selected[0]}
            />
          )}
          {!domain.outerAvailable || !domain.branchAgreement ? null : (
            <button
              className="quiet-action action-compact"
              onClick={() =>
                onSelect(Object.freeze({ kind: 'activateArcana', arcanaKeys: Object.freeze([]) }))
              }
              type="button"
            >
              Record no Arcana activation
            </button>
          )}
        </>
      );
    }
    return (
      <>
        {unavailableMessage === undefined ? null : (
          <p className="feedback-text">{unavailableMessage}</p>
        )}
        <ContextualPicker
          ariaLabel="Red Citrine Arcana"
          id={controlId}
          label="Arcana to activate"
          model={domain.arcanaPicker}
          onSelect={(arcanaKey) =>
            onSelect(
              Object.freeze({ kind: 'activateArcana', arcanaKeys: Object.freeze([arcanaKey]) }),
            )
          }
          placeholder="Choose Arcana"
          {...(selected[0] === undefined
            ? {}
            : { triggerLabel: pickerValueLabel(domain.arcanaPicker, selected[0]) ?? selected[0] })}
        />
      </>
    );
  }
  const lapisComplete = lapisDraft.length === domain.requiredCount;
  return (
    <fieldset className="trait-circe-resolution">
      <legend>Lapis Arcana ({domain.requiredCount})</legend>
      {unavailableMessage === undefined ? null : (
        <p className="feedback-text">{unavailableMessage}</p>
      )}
      <p className="trait-outcome-draft">
        {lapisDraft.length === 0
          ? 'No Arcana chosen.'
          : lapisDraft.map((key) => pickerValueLabel(domain.arcanaPicker, key) ?? key).join(' · ')}
      </p>
      <ContextualPicker
        cancelLabel="Cancel"
        choiceLabel={`Arcana ${lapisDraft.length + 1} of ${domain.requiredCount}`}
        closeOnSelect={false}
        id={controlId}
        label="Promoted Arcana"
        model={domain.arcanaPickerFor(lapisDraft)}
        onOpenChange={(open) => {
          setLapisOpen(open);
          if (open && lapisComplete) setLapisDraft(Object.freeze([]));
          if (!open && !lapisComplete)
            setLapisDraft(
              current?.kind === 'promoteArcana' ? current.arcanaKeys : Object.freeze([]),
            );
        }}
        onSelect={(arcanaKey) => {
          const next = Object.freeze([...lapisDraft, arcanaKey]);
          setLapisDraft(next);
          if (next.length === domain.requiredCount) setLapisOpen(false);
        }}
        open={lapisOpen}
        placeholder="Choose distinct Arcana"
      />
      <div className="trait-outcome-actions">
        <button
          className="quiet-action action-compact"
          disabled={!lapisComplete || !domain.outerAvailable || !domain.branchAgreement}
          onClick={() => onSelect(Object.freeze({ kind: 'promoteArcana', arcanaKeys: lapisDraft }))}
          type="button"
        >
          Apply Lapis outcome
        </button>
        <button
          className="quiet-action action-compact"
          onClick={() => {
            setLapisOpen(false);
            setLapisDraft(
              current?.kind === 'promoteArcana' ? current.arcanaKeys : Object.freeze([]),
            );
          }}
          type="button"
        >
          Cancel
        </button>
      </div>
    </fieldset>
  );
}

function TraitOfferOptionEditor({
  index,
  interaction,
  optionKey,
  effectiveRarity,
  rarifySupported,
  value,
  onUpdate,
}: {
  readonly index: number;
  readonly interaction: WorkspaceTraitOfferInteraction;
  readonly optionKey: AuthoredTraitOfferTraits['selectedOptionKey'];
  readonly effectiveRarity?: TraitRarity;
  readonly rarifySupported: boolean;
  readonly value: AuthoredTraitOfferTraits;
  readonly onUpdate: (value: AuthoredTraitOfferTraits) => void;
}) {
  const option = value.options[index];
  if (option === undefined) throw new Error(`Trait offer is missing ${optionKey}`);
  const loadable = useMemo(
    () => interaction.optionDomain(value, optionKey),
    [interaction, optionKey, value],
  );
  const controller = useWorkspaceInteractionController<TraitOptionDomainProjection>();
  const loaded = controller.observe(loadable);
  const domain = loaded.result;
  const traitPicker = domain?.traitPicker ?? emptyTraitPicker;
  const rarityPicker = domain?.rarityPickerFor(option.traitKey);
  const hasEditableRarity =
    interaction.rarityEditable &&
    interaction.giver.rarityPolicy.kind === 'selectable' &&
    interaction.rarityEditableFor(option.traitKey);
  const idPrefix = `${semanticAddressKey(interaction.owner)}-${optionKey}`;
  const selectTrait = (traitKey: string): void => {
    const preferred = domain?.preferredOptionFor(traitKey);
    if (preferred === undefined) return;
    onUpdate(
      replaceOption(
        value,
        index,
        preferred.traitKey === option.traitKey
          ? Object.freeze({ ...option, ...preferred })
          : preferred,
      ),
    );
  };
  const selectRarity = (rarity: TraitRarity): void => {
    onUpdate(replaceOption(value, index, { ...option, rarity }));
  };
  return (
    <fieldset className="trait-offer-option" key={optionKey}>
      <legend>{optionKey.replace('option', 'Option ')}</legend>
      <ContextualPicker
        ariaLabel={`${optionKey} trait`}
        id={`${idPrefix}-trait`}
        label="Trait"
        loading={loaded.pending}
        model={traitPicker}
        onOpenChange={(open) => {
          if (open) controller.activate(loadable);
        }}
        onSelect={selectTrait}
        placeholder="Choose a trait"
        triggerLabel={interaction.traitLabel(option.traitKey)}
      />
      {!hasEditableRarity ? (
        option.rarity === undefined ? null : (
          <p className="trait-offer-fixed-rarity">Rarity: {rarityLabel(option.rarity)}</p>
        )
      ) : (
        <ContextualPicker
          ariaLabel={`${optionKey} rarity`}
          id={`${idPrefix}-rarity`}
          label="Rarity"
          loading={loaded.pending}
          model={rarityPicker ?? emptyRarityPicker}
          onOpenChange={(open) => {
            if (open) controller.activate(loadable);
          }}
          onSelect={selectRarity}
          placeholder="Choose a rarity"
          {...(option.rarity === undefined ? {} : { triggerLabel: rarityLabel(option.rarity) })}
        />
      )}
      <button
        disabled={!rarifySupported}
        onClick={() =>
          onUpdate(
            Object.freeze({
              ...value,
              rarificationActions: Object.freeze([...(value.rarificationActions ?? []), optionKey]),
            }),
          )
        }
        type="button"
      >
        Rarify
      </button>
      {effectiveRarity === undefined ? null : <p>Effective rarity: {effectiveRarity}</p>}
      <label className="trait-option-selected">
        <input
          checked={value.selectedOptionKey === optionKey}
          name={`${semanticAddressKey(interaction.owner)}-selected`}
          onChange={() => onUpdate(Object.freeze({ ...value, selectedOptionKey: optionKey }))}
          type="radio"
        />
        Selected
      </label>
    </fieldset>
  );
}

function TraitOfferSelectedOutcomeEditor({
  interaction,
  value,
  onUpdate,
}: {
  readonly interaction: WorkspaceTraitOfferInteraction;
  readonly value: AuthoredTraitOfferTraits;
  readonly onUpdate: (value: AuthoredTraitOfferTraits) => void;
}) {
  const selectedIndex = optionIndex(value.selectedOptionKey);
  const option = value.options[selectedIndex];
  if (option === undefined) throw new Error(`Trait offer is missing ${value.selectedOptionKey}`);
  const loadable = useMemo(
    () => interaction.optionDomain(value, value.selectedOptionKey),
    [interaction, value],
  );
  const optionController = useWorkspaceInteractionController<TraitOptionDomainProjection>();
  const optionDomain = optionController.observe(loadable);
  const circeLoadable = useMemo(
    () => loadable.circeResolution?.forOffer(value),
    [loadable.circeResolution, value],
  );
  const circeController = useWorkspaceInteractionController<
    WorkspaceCirceResolutionDomain | undefined
  >();
  const circeDomain = circeController.observe(circeLoadable);
  const echoPomLoadable = useMemo(
    () => loadable.echoPomTarget?.forOffer(value),
    [loadable.echoPomTarget, value],
  );
  const echoPomController = useWorkspaceInteractionController<
    WorkspaceEchoPomTargetDomain | undefined
  >();
  const echoPomDomain = echoPomController.observe(echoPomLoadable);
  const echoLastRunLoadable = useMemo(
    () => loadable.echoLastRunBoon?.forOffer(value),
    [loadable.echoLastRunBoon, value],
  );
  const echoLastRunController = useWorkspaceInteractionController<
    WorkspaceEchoLastRunBoonDomain | undefined
  >();
  const echoLastRunDomain = echoLastRunController.observe(echoLastRunLoadable);
  const echoLastRewardLoadable = useMemo(
    () => loadable.echoLastReward?.forOffer(value),
    [loadable.echoLastReward, value],
  );
  const echoLastRewardController = useWorkspaceInteractionController<
    WorkspaceEchoLastRewardDomain | undefined
  >();
  const echoLastRewardDomain = echoLastRewardController.observe(echoLastRewardLoadable);
  useEffect(() => {
    if (loadable.hasTargetPicker) optionController.activate(loadable);
    if (circeLoadable !== undefined) circeController.activate(circeLoadable);
    if (echoPomLoadable !== undefined) echoPomController.activate(echoPomLoadable);
    if (echoLastRunLoadable !== undefined) echoLastRunController.activate(echoLastRunLoadable);
    if (echoLastRewardLoadable !== undefined)
      echoLastRewardController.activate(echoLastRewardLoadable);
  }, [
    circeController,
    circeLoadable,
    echoLastRewardController,
    echoLastRewardLoadable,
    echoLastRunController,
    echoLastRunLoadable,
    echoPomController,
    echoPomLoadable,
    loadable,
    optionController,
  ]);

  const targetDomain = optionDomain.result;
  const hasOutcome =
    loadable.hasTargetPicker ||
    loadable.circeResolution !== undefined ||
    loadable.echoPomTarget !== undefined ||
    loadable.echoLastRunBoon !== undefined ||
    loadable.echoLastReward !== undefined ||
    loadable.allTogetherSets !== undefined;
  if (!hasOutcome) return null;
  return (
    <section aria-label="Selected trait outcome" className="trait-selected-outcome">
      <h3>Selected trait outcome</h3>
      <p className="trait-selected-outcome-name">{interaction.traitLabel(option.traitKey)}</p>
      {loadable.traitAcquisitionTarget === undefined ? null : (
        <ContextualPicker
          ariaLabel={`${value.selectedOptionKey} acquisition target`}
          id={semanticOwnerControlElementId(loadable.traitAcquisitionTarget.address)}
          label="Target"
          loading={optionDomain.pending}
          model={targetDomain?.targetPicker ?? emptyTargetPicker}
          onSelect={(targetTraitKey) =>
            onUpdate(replaceOption(value, selectedIndex, { ...option, targetTraitKey }))
          }
          placeholder="Choose an equipped trait"
          {...(option.targetTraitKey === undefined
            ? {}
            : { triggerLabel: interaction.traitLabel(option.targetTraitKey) })}
        />
      )}
      {loadable.circeResolution === undefined || circeDomain.result === undefined ? null : (
        <CirceResolutionEditor
          controlId={semanticOwnerControlElementId(loadable.circeResolution.control.address)}
          domain={circeDomain.result}
          option={option}
          onSelect={(resolution) =>
            onUpdate(
              replaceOption(value, selectedIndex, { ...option, circeResolution: resolution }),
            )
          }
        />
      )}
      {loadable.echoPomTarget === undefined || echoPomDomain.result === undefined ? null : (
        <ContextualPicker
          ariaLabel="Pom Pom Pom target"
          id={semanticOwnerControlElementId(loadable.echoPomTarget.control.address)}
          label="Greatest-level target"
          model={echoPomDomain.result.picker}
          onSelect={(echoPomTarget) =>
            onUpdate(replaceOption(value, selectedIndex, { ...option, echoPomTarget }))
          }
          placeholder={
            echoPomDomain.result.emptyNoOpAllowed
              ? 'Choose target or no target'
              : 'Choose a greatest-level trait'
          }
          {...('echoPomTarget' in option && option.echoPomTarget !== undefined
            ? {
                triggerLabel:
                  pickerValueLabel(echoPomDomain.result.picker, option.echoPomTarget) ??
                  String(option.echoPomTarget),
              }
            : {})}
        />
      )}
      {loadable.echoLastRunBoon === undefined || echoLastRunDomain.result === undefined ? null : (
        <EchoLastRunBoonEditor
          domain={echoLastRunDomain.result}
          {...(option.echoLastRunBoon === undefined ? {} : { value: option.echoLastRunBoon })}
          onSelect={(child) =>
            onUpdate(replaceOption(value, selectedIndex, { ...option, echoLastRunBoon: child }))
          }
        />
      )}
      {loadable.echoLastReward === undefined || echoLastRewardDomain.result === undefined ? null : (
        <EchoLastRewardEditor
          domain={echoLastRewardDomain.result}
          {...(option.echoLastReward === undefined ? {} : { value: option.echoLastReward })}
          onSelect={(child) =>
            onUpdate(replaceOption(value, selectedIndex, { ...option, echoLastReward: child }))
          }
        />
      )}
      {loadable.allTogetherSets === undefined ? null : (
        <AllTogetherOutcomeEditor
          interactions={loadable.allTogetherSets}
          offer={value}
          optionIndex={selectedIndex}
          onSelect={(allTogetherResult) =>
            onUpdate(replaceOption(value, selectedIndex, { ...option, allTogetherResult }))
          }
        />
      )}
    </section>
  );
}

export function TraitOfferLauncher({
  control,
  interactions,
}: {
  readonly control: WorkspaceTraitOfferControl;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const dispatch = useAppDispatch();
  const interaction = requireWorkspaceInteraction(
    interactions.traitOffers,
    workspaceInteractionKey(control.address),
  );
  const selected =
    control.offer?.kind === 'traits'
      ? control.offer.options[OPTION_KEYS.indexOf(control.offer.selectedOptionKey)]
      : undefined;
  const label =
    control.offer === null
      ? 'Choose trait'
      : control.offer.kind === 'fallbackGold'
        ? 'Fallback Gold'
        : selected === undefined
          ? 'Choose trait'
          : (interaction.choices.find((choice) => choice.value === selected.traitKey)?.label ??
            selected.traitKey);
  const rarity = selected?.rarity === undefined ? '' : ` · ${selected.rarity}`;
  return (
    <button
      className="trait-offer-launcher quiet-action action-compact"
      id={launcherId(control.address)}
      onClick={() => dispatch(traitOfferDialogOpened(control.address))}
      type="button"
    >
      Edit Trait: {label}
      {rarity}
    </button>
  );
}

export function TraitOfferEditor({
  address,
  interactions,
  onCommit,
  onReset,
}: {
  readonly address: TraitOfferAddress;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onCommit?: (value: AuthoredTraitOffer) => void;
  readonly onReset?: () => void;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.traitOffers,
    workspaceInteractionKey(address),
  );
  const initialValue = interaction.value ?? interaction.traitsStartingDraft?.();
  if (initialValue === undefined) {
    return (
      <div className="trait-offer-editor" role="status">
        This trait offer is not available at the current route frontier.
      </div>
    );
  }
  return (
    <LoadedTraitOfferEditor
      initialValue={initialValue}
      interaction={interaction}
      key={traitOfferRevision(interaction)}
      {...(onCommit === undefined ? {} : { onCommit })}
      {...(onReset === undefined ? {} : { onReset })}
    />
  );
}

function LoadedTraitOfferEditor({
  initialValue,
  interaction,
  onCommit,
  onReset,
}: {
  readonly initialValue: AuthoredTraitOffer;
  readonly interaction: WorkspaceTraitOfferInteraction;
  readonly onCommit?: (value: AuthoredTraitOffer) => void;
  readonly onReset?: () => void;
}) {
  const [value, setValue] = useState<AuthoredTraitOffer>(initialValue);
  type TraitOfferCandidates = ReturnType<WorkspaceTraitOfferInteraction['load']>;
  const controller = useWorkspaceInteractionController<TraitOfferCandidates>();
  const [loadable, setLoadable] = useState(() => traitOfferLoadable(interaction, initialValue));
  const loaded = controller.observe(loadable);
  const candidate = loaded.result?.[0];
  const support = candidateSupport(candidate);
  const feedback = projectTraitOfferFeedback(value, candidate, interaction.traitLabel);
  const offerMessage =
    feedback.contextMessage ??
    (support === 'impossible'
      ? 'This offer is unavailable in the current route context.'
      : undefined);
  const hasOptionFeedback = feedback.options.some(
    (option) => option.reasons.length > 0 || option.replacement !== undefined,
  );
  const rarifySupported = (optionKey: AuthoredTraitOfferTraits['selectedOptionKey']): boolean => {
    if (candidate?.evaluation.kind !== 'traitOffer') return false;
    const branches = candidate.evaluation.result.callingCard ?? [];
    return (
      branches.length > 0 &&
      branches.every((branch) => branch.rarifiableOptionKeys.includes(optionKey))
    );
  };
  const effectiveRarity = (
    optionKey: AuthoredTraitOfferTraits['selectedOptionKey'],
  ): TraitRarity | undefined => {
    if (candidate?.evaluation.kind !== 'traitOffer') return undefined;
    const values = (candidate.evaluation.result.callingCard ?? [])
      .map((branch) => branch.effectiveRarities[OPTION_KEYS.indexOf(optionKey)])
      .filter((value): value is TraitRarity => value !== undefined);
    return values.length > 0 && values.every((value) => value === values[0])
      ? values[0]
      : undefined;
  };
  const deathDefianceCondition =
    value.kind === 'traits' ? interaction.deathDefianceCondition : undefined;
  const traitsStartingDraft = useMemo(
    () => (value.kind === 'fallbackGold' ? interaction.traitsStartingDraft?.() : undefined),
    [interaction, value],
  );
  const nextTraitOfferDraft = useMemo(
    () => (value.kind === 'traits' ? interaction.nextOptionalHighTierDraft?.(value) : undefined),
    [interaction, value],
  );
  const previousTraitOfferDraft = useMemo(
    () =>
      value.kind === 'traits' ? interaction.previousOptionalHighTierDraft?.(value) : undefined,
    [interaction, value],
  );
  const previousTraitOfferLoadable = useMemo(
    () =>
      previousTraitOfferDraft === undefined
        ? undefined
        : traitOfferLoadable(interaction, previousTraitOfferDraft),
    [interaction, previousTraitOfferDraft],
  );
  const previousTraitOfferController = useWorkspaceInteractionController<TraitOfferCandidates>();
  const previousTraitOfferLoaded = previousTraitOfferController.observe(previousTraitOfferLoadable);
  const previousTraitOfferSupport = candidateSupport(previousTraitOfferLoaded.result?.[0]);
  const canRemoveOption =
    previousTraitOfferDraft !== undefined &&
    (previousTraitOfferSupport === 'possible' || previousTraitOfferSupport === 'forced');
  const fallbackGoldValue = useMemo(
    () =>
      value.kind !== 'traits' ||
      (interaction.giver.providerKind !== 'olympian' && interaction.giver.providerKind !== 'hermes')
        ? undefined
        : (Object.freeze({
            kind: 'fallbackGold' as const,
            giverKey: value.giverKey,
          }) satisfies AuthoredTraitOffer),
    [interaction.giver.providerKind, value],
  );
  const fallbackGoldLoadable = useMemo(
    () =>
      fallbackGoldValue === undefined
        ? undefined
        : traitOfferLoadable(interaction, fallbackGoldValue),
    [fallbackGoldValue, interaction],
  );
  const fallbackGoldController = useWorkspaceInteractionController<TraitOfferCandidates>();
  const fallbackGoldLoaded = fallbackGoldController.observe(fallbackGoldLoadable);
  const fallbackGoldSupport = candidateSupport(fallbackGoldLoaded.result?.[0]);
  useEffect(() => {
    controller.activate(loadable);
    // Activation is deliberately tied to the opened dialog, not to render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadable]);
  useEffect(() => {
    if (fallbackGoldLoadable !== undefined) fallbackGoldController.activate(fallbackGoldLoadable);
  }, [fallbackGoldController, fallbackGoldLoadable]);
  useEffect(() => {
    if (previousTraitOfferLoadable !== undefined)
      previousTraitOfferController.activate(previousTraitOfferLoadable);
  }, [previousTraitOfferController, previousTraitOfferLoadable]);
  const updateValue = (nextValue: AuthoredTraitOffer): void => {
    const nextLoadable = traitOfferLoadable(interaction, nextValue);
    setValue(nextValue);
    setLoadable(nextLoadable);
    controller.activate(nextLoadable);
  };
  return (
    <div className="trait-offer-editor">
      {value.kind === 'traits' && deathDefianceCondition !== undefined ? (
        <label className="trait-offer-condition">
          <input
            checked={value.deathDefianceConditionMet === true}
            onChange={(event) =>
              updateValue(
                Object.freeze({
                  ...value,
                  deathDefianceConditionMet: event.target.checked,
                }),
              )
            }
            type="checkbox"
          />
          Death Defiance condition met
        </label>
      ) : null}
      {value.kind === 'fallbackGold' ? (
        <section className="trait-offer-fallback">
          <p>Fallback Gold</p>
          <button
            disabled={traitsStartingDraft === undefined}
            onClick={() => {
              if (traitsStartingDraft !== undefined) updateValue(traitsStartingDraft);
            }}
            type="button"
          >
            Return to traits
          </button>
        </section>
      ) : (
        <>
          <div className="trait-offer-options">
            {value.options.map((_, index) => {
              const optionKey = OPTION_KEYS[index]!;
              const optionFeedback = feedback.options[index];
              const rowEffectiveRarity = effectiveRarity(optionKey);
              return (
                <div data-has-findings={(optionFeedback?.reasons.length ?? 0) > 0} key={optionKey}>
                  {rowEffectiveRarity === undefined ? (
                    <TraitOfferOptionEditor
                      index={index}
                      interaction={interaction}
                      onUpdate={updateValue}
                      optionKey={optionKey}
                      rarifySupported={rarifySupported(optionKey)}
                      value={value}
                    />
                  ) : (
                    <TraitOfferOptionEditor
                      effectiveRarity={rowEffectiveRarity}
                      index={index}
                      interaction={interaction}
                      onUpdate={updateValue}
                      optionKey={optionKey}
                      rarifySupported={rarifySupported(optionKey)}
                      value={value}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <TraitOfferSelectedOutcomeEditor
            interaction={interaction}
            onUpdate={updateValue}
            value={value}
          />
          {nextTraitOfferDraft === undefined &&
          !canRemoveOption &&
          (fallbackGoldValue === undefined ||
            (fallbackGoldSupport !== 'possible' && fallbackGoldSupport !== 'forced')) ? null : (
            <div
              aria-label="Offer shape actions"
              className="trait-offer-shape-actions"
              role="group"
            >
              {nextTraitOfferDraft === undefined ? null : (
                <button
                  className="quiet-action action-compact"
                  onClick={() => updateValue(nextTraitOfferDraft)}
                  type="button"
                >
                  Add option
                </button>
              )}
              {!canRemoveOption || previousTraitOfferDraft === undefined ? null : (
                <button
                  className="quiet-action action-compact"
                  onClick={() => updateValue(previousTraitOfferDraft)}
                  type="button"
                >
                  Remove last option
                </button>
              )}
              {fallbackGoldValue === undefined ||
              (fallbackGoldSupport !== 'possible' && fallbackGoldSupport !== 'forced') ? null : (
                <button
                  className="quiet-action action-compact"
                  onClick={() => updateValue(fallbackGoldValue)}
                  type="button"
                >
                  Select Fallback Gold
                </button>
              )}
            </div>
          )}
        </>
      )}
      <section aria-label="Offer feedback" className="trait-offer-feedback" role="status">
        <h3>Offer feedback</h3>
        {!hasOptionFeedback && offerMessage === undefined ? (
          <p className="trait-offer-feedback-empty">No current findings.</p>
        ) : null}
        {feedback.options.map((option, index) =>
          option.reasons.length === 0 && option.replacement === undefined ? null : (
            <div className="trait-offer-feedback-item" key={OPTION_KEYS[index]}>
              <strong>Option {index + 1}</strong>
              {option.reasons.length === 0 ? null : (
                <ul className="trait-option-feedback" aria-label={`${OPTION_KEYS[index]} feedback`}>
                  {option.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
              {option.replacement === undefined ? null : (
                <p className="trait-option-replacement">
                  Replaces {option.replacement.replacedTraitLabel} · {option.replacement.oldRarity}{' '}
                  to {option.replacement.requiredRarity}
                </p>
              )}
            </div>
          ),
        )}
        {offerMessage === undefined ? null : <p className="feedback-text">{offerMessage}</p>}
      </section>
      <button
        className="primary-action"
        disabled={support === 'impossible'}
        onClick={() => {
          onCommit?.(value);
        }}
        type="button"
      >
        Save trait offer
      </button>
      {onReset === undefined ? null : (
        <button className="quiet-action" onClick={onReset} type="button">
          Reset to unresolved
        </button>
      )}
    </div>
  );
}

export function TraitOfferDialog({
  interactions,
  target,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly target: TraitOfferAddress;
}) {
  const dispatch = useAppDispatch();
  const executeIntent = useCommandIntent();
  const focusedSemanticOwner = useAppSelector((state) => state.editorSession.focusedSemanticOwner);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const interaction = requireWorkspaceInteraction(
    interactions.traitOffers,
    workspaceInteractionKey(target),
  );
  const close = useCallback((): void => {
    dispatch(traitOfferDialogClosed());
    const launcher = document.getElementById(launcherId(target));
    (launcher ?? previousFocusRef.current)?.focus();
  }, [dispatch, target]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const inertSiblings: HTMLElement[] = [];
    const parent = dialog.parentElement;
    const supportsModal = typeof dialog.showModal === 'function';
    if (!supportsModal && parent !== null) {
      for (const sibling of Array.from(parent.children)) {
        if (sibling === dialog || !(sibling instanceof HTMLElement)) continue;
        inertSiblings.push(sibling);
        (sibling as HTMLElement & { inert: boolean }).inert = true;
      }
    }

    if (supportsModal && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        // A test DOM may expose showModal without implementing the top layer.
        dialog.setAttribute('open', '');
      }
    } else if (!dialog.open) {
      dialog.setAttribute('open', '');
    }

    const exactControl =
      (focusedSemanticOwner?.kind === 'allTogetherSet' ||
        focusedSemanticOwner?.kind === 'traitAcquisitionTarget' ||
        focusedSemanticOwner?.kind === 'circeResolution' ||
        focusedSemanticOwner?.kind === 'echoPomTarget') &&
      semanticAddressKey(focusedSemanticOwner.trait) === semanticAddressKey(target)
        ? document.getElementById(semanticOwnerControlElementId(focusedSemanticOwner))
        : null;
    const first = dialog.querySelector<HTMLElement>('select, input, button');
    (exactControl instanceof HTMLElement && dialog.contains(exactControl)
      ? exactControl
      : first
    )?.focus();
    const onCancel = (event: Event): void => {
      event.preventDefault();
      close();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      // Native modal dialogs emit `cancel`; this local fallback only covers
      // DOMs that cannot implement the dialog top layer (for example jsdom).
      // A nested picker handles its own Escape first and prevents the default;
      // preserve the in-progress local draft until a later Escape reaches us.
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      close();
    };
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('keydown', onKeyDown);
      for (const sibling of inertSiblings) {
        (sibling as HTMLElement & { inert: boolean }).inert = false;
      }
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
    };
  }, [close, focusedSemanticOwner, target]);
  return (
    <dialog
      aria-labelledby={`trait-offer-dialog-title-${semanticAddressKey(target)}`}
      aria-modal="true"
      className="trait-offer-dialog-backdrop"
      ref={dialogRef}
    >
      <div className="trait-offer-dialog">
        <header className="panel-heading">
          <div>
            <p className="eyebrow">Trait offer</p>
            <h2 id={`trait-offer-dialog-title-${semanticAddressKey(target)}`}>
              {interaction.giver.label}
            </h2>
          </div>
          <div className="panel-heading-actions">
            <SemanticOwnerMarker address={target} />
            <button
              aria-label="Close trait offer"
              className="quiet-action"
              onClick={close}
              type="button"
            >
              Close
            </button>
          </div>
        </header>
        <TraitOfferEditor
          address={target}
          interactions={interactions}
          key={`${semanticAddressKey(target)}:${traitOfferRevision(interaction)}`}
          onCommit={(value) => {
            executeIntent(interaction.intentFor(value));
            close();
          }}
          {...(interaction.resetIntent === undefined
            ? {}
            : {
                onReset: () => {
                  executeIntent(interaction.resetIntent!);
                  close();
                },
              })}
        />
      </div>
    </dialog>
  );
}
