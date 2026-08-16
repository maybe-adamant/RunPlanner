import {
  semanticAddressKey,
  optionIndex,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
  type AuthoredEchoLastRunBoonOffer,
  type AuthoredEchoLastRunBoonOption,
  type AuthoredEchoLastRewardAcquisition,
  type TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import type { TraitRarity } from '@run-planner/engine/catalog-schema';
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

function AllTogetherSetEditor({
  interaction,
  offer,
  optionIndex: index,
  onUpdate,
}: {
  readonly interaction: WorkspaceAllTogetherSetInteraction;
  readonly offer: AuthoredTraitOfferTraits;
  readonly optionIndex: number;
  readonly onUpdate: (value: AuthoredTraitOfferTraits) => void;
}) {
  const loadable = useMemo(() => interaction.forOffer(offer), [interaction, offer]);
  const controller = useWorkspaceInteractionController<WorkspaceAllTogetherSetDomain | undefined>();
  const loaded = controller.observe(loadable);
  useEffect(() => {
    controller.activate(loadable);
    // This exact authored-set loadable is the activation identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadable]);
  const option = offer.options[index];
  if (option === undefined) return null;
  const current = option.allTogetherResult?.[interaction.control.setKey];
  const choices = loaded.result?.choices ?? Object.freeze([]);
  const forced = choices.length === 1;
  const currentLegal = choices.some((choice) => choice.value === current);
  const label = `${interaction.control.setKey[0]!.toUpperCase()}${interaction.control.setKey.slice(1)} grant`;
  return (
    <label className="trait-circe-resolution">
      {label}
      <select
        aria-disabled={choices.length === 0 ? true : undefined}
        aria-label={label}
        disabled={loaded.pending || (forced && currentLegal)}
        id={semanticOwnerControlElementId(interaction.control.address)}
        onChange={(event) => {
          if (choices.length === 0) return;
          const next = event.target.value === '__none__' ? null : event.target.value;
          onUpdate(interaction.offerFor(offer, next));
        }}
        value={current === null ? '__none__' : (current ?? '')}
      >
        {!currentLegal ? <option value="">Choose a legal result</option> : null}
        {choices.map((choice) => (
          <option key={choice.value ?? '__none__'} value={choice.value ?? '__none__'}>
            {choice.label}
          </option>
        ))}
      </select>
      {choices.length === 0 ? <span>Unavailable across current route branches</span> : null}
    </label>
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
            const rarityPicker =
              optionDomain?.rarityPickerFor(traitOption.traitKey) ?? emptyRarityPicker;
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
                {!domain.traitRarityEditable ? null : (
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
  domain,
  option,
  onSelect,
}: {
  readonly domain: WorkspaceCirceResolutionDomain;
  readonly option: AuthoredTraitOfferTraits['options'][number];
  readonly onSelect: (resolution: AuthoredCirceResolution) => void;
}) {
  const current = option.circeResolution;
  if (!domain.outerAvailable) {
    return <p className="feedback-text">This Circe trait has no available outcome here.</p>;
  }
  if (domain.effect === 'disableFear') {
    return (
      <label className="trait-circe-resolution">
        Black Night Vow
        <select
          aria-label="Black Night Vow"
          onChange={(event) =>
            onSelect(
              Object.freeze({
                kind: 'disableFear',
                vowKey: event.target.value === '' ? null : event.target.value,
              }),
            )
          }
          value={current?.kind === 'disableFear' ? (current.vowKey ?? '') : ''}
        >
          <option value="">Choose a Vow</option>
          {domain.vowChoices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const selected =
    current?.kind === domain.effect ? current.arcanaKeys : (Object.freeze([]) as readonly string[]);
  if (domain.effect === 'activateArcana') {
    return (
      <label className="trait-circe-resolution">
        Red Citrine Arcana
        <select
          aria-label="Red Citrine Arcana"
          onChange={(event) =>
            onSelect(
              Object.freeze({
                kind: 'activateArcana',
                arcanaKeys:
                  event.target.value === ''
                    ? Object.freeze([])
                    : Object.freeze([event.target.value]),
              }),
            )
          }
          value={selected[0] ?? ''}
        >
          <option value="">
            {domain.requiredCount === 0 ? 'No activation available' : 'Choose Arcana'}
          </option>
          {domain.arcanaChoices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <fieldset className="trait-circe-resolution">
      <legend>Lapis Arcana ({domain.requiredCount})</legend>
      {domain.arcanaChoices.map((choice) => {
        const checked = selected.includes(choice.value);
        return (
          <label key={choice.value}>
            <input
              checked={checked}
              disabled={!checked && selected.length >= domain.requiredCount}
              onChange={() => {
                const next = checked
                  ? selected.filter((key) => key !== choice.value)
                  : [...selected, choice.value];
                onSelect(Object.freeze({ kind: 'promoteArcana', arcanaKeys: Object.freeze(next) }));
              }}
              type="checkbox"
            />
            {choice.label}
          </label>
        );
      })}
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
  const rarityPicker = domain?.rarityPickerFor(option.traitKey) ?? emptyRarityPicker;
  const targetPicker = domain?.targetPicker ?? emptyTargetPicker;
  const hasRarity =
    interaction.rarityEditable && interaction.giver.rarityPolicy.kind === 'selectable';
  const idPrefix = `${semanticAddressKey(interaction.owner)}-${optionKey}`;
  const selectTrait = (traitKey: string): void => {
    const preferred = domain?.preferredOptionFor(traitKey);
    if (preferred === undefined) return;
    onUpdate(replaceOption(value, index, preferred));
  };
  const selectRarity = (rarity: TraitRarity): void => {
    onUpdate(replaceOption(value, index, { ...option, rarity }));
  };
  const selectTarget = (targetTraitKey: string): void => {
    onUpdate(replaceOption(value, index, { ...option, targetTraitKey }));
  };
  const circe = loadable.circeResolution;
  const circeLoadable = useMemo(() => circe?.forOffer(value), [circe, value]);
  const circeController = useWorkspaceInteractionController<
    WorkspaceCirceResolutionDomain | undefined
  >();
  const circeLoaded = circeController.observe(circeLoadable);
  useEffect(() => {
    if (circeLoadable !== undefined) circeController.activate(circeLoadable);
  }, [circeController, circeLoadable]);
  const circeDomain = circeLoaded.result;
  const echoPom = loadable.echoPomTarget;
  const echoPomLoadable = useMemo(() => echoPom?.forOffer(value), [echoPom, value]);
  const echoPomController = useWorkspaceInteractionController<
    WorkspaceEchoPomTargetDomain | undefined
  >();
  const echoPomLoaded = echoPomController.observe(echoPomLoadable);
  useEffect(() => {
    if (echoPomLoadable !== undefined) echoPomController.activate(echoPomLoadable);
  }, [echoPomController, echoPomLoadable]);
  const echoPomDomain = echoPomLoaded.result;
  const echoLastRun = loadable.echoLastRunBoon;
  const echoLastRunLoadable = useMemo(() => echoLastRun?.forOffer(value), [echoLastRun, value]);
  const echoLastRunController = useWorkspaceInteractionController<
    WorkspaceEchoLastRunBoonDomain | undefined
  >();
  const echoLastRunLoaded = echoLastRunController.observe(echoLastRunLoadable);
  useEffect(() => {
    if (echoLastRunLoadable !== undefined) echoLastRunController.activate(echoLastRunLoadable);
  }, [echoLastRunController, echoLastRunLoadable]);
  const echoLastRunDomain = echoLastRunLoaded.result;
  const echoLastReward = loadable.echoLastReward;
  const echoLastRewardLoadable = useMemo(
    () => echoLastReward?.forOffer(value),
    [echoLastReward, value],
  );
  const echoLastRewardController = useWorkspaceInteractionController<
    WorkspaceEchoLastRewardDomain | undefined
  >();
  const echoLastRewardLoaded = echoLastRewardController.observe(echoLastRewardLoadable);
  useEffect(() => {
    if (echoLastRewardLoadable !== undefined)
      echoLastRewardController.activate(echoLastRewardLoadable);
  }, [echoLastRewardController, echoLastRewardLoadable]);
  const echoLastRewardDomain = echoLastRewardLoaded.result;
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
      {!hasRarity ? null : (
        <ContextualPicker
          ariaLabel={`${optionKey} rarity`}
          id={`${idPrefix}-rarity`}
          label="Rarity"
          loading={loaded.pending}
          model={rarityPicker}
          onOpenChange={(open) => {
            if (open) controller.activate(loadable);
          }}
          onSelect={selectRarity}
          placeholder="Choose a rarity"
          {...(option.rarity === undefined ? {} : { triggerLabel: rarityLabel(option.rarity) })}
        />
      )}
      {!loadable.hasTargetPicker ? null : (
        <ContextualPicker
          ariaLabel={`${optionKey} acquisition target`}
          id={`${idPrefix}-target`}
          label="Target"
          loading={loaded.pending}
          model={targetPicker}
          onOpenChange={(open) => {
            if (open) controller.activate(loadable);
          }}
          onSelect={selectTarget}
          placeholder="Choose an equipped trait"
          {...(option.targetTraitKey === undefined
            ? {}
            : { triggerLabel: interaction.traitLabel(option.targetTraitKey) })}
        />
      )}
      {circe === undefined || circeDomain === undefined ? null : (
        <CirceResolutionEditor
          domain={circeDomain}
          option={option}
          onSelect={(resolution) =>
            onUpdate(replaceOption(value, index, { ...option, circeResolution: resolution }))
          }
        />
      )}
      {echoPom === undefined || echoPomDomain === undefined ? null : (
        <label className="trait-circe-resolution">
          Pom Pom Pom target
          {echoPomDomain.emptyNoOpAllowed ? (
            <button
              onClick={() =>
                onUpdate(replaceOption(value, index, { ...option, echoPomTarget: null }))
              }
              type="button"
            >
              Record no eligible target
            </button>
          ) : (
            <select
              aria-label="Pom Pom Pom target"
              onChange={(event) =>
                onUpdate(
                  replaceOption(value, index, {
                    ...option,
                    echoPomTarget: event.target.value,
                  }),
                )
              }
              value={'echoPomTarget' in option ? (option.echoPomTarget ?? '') : ''}
            >
              <option value="">Choose a greatest-level trait</option>
              {echoPomDomain.choices.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          )}
        </label>
      )}
      {echoLastRun === undefined || echoLastRunDomain === undefined ? null : (
        <EchoLastRunBoonEditor
          domain={echoLastRunDomain}
          {...(option.echoLastRunBoon === undefined ? {} : { value: option.echoLastRunBoon })}
          onSelect={(child) =>
            onUpdate(replaceOption(value, index, { ...option, echoLastRunBoon: child }))
          }
        />
      )}
      {echoLastReward === undefined || echoLastRewardDomain === undefined ? null : (
        <EchoLastRewardEditor
          domain={echoLastRewardDomain}
          {...(option.echoLastReward === undefined ? {} : { value: option.echoLastReward })}
          onSelect={(child) =>
            onUpdate(replaceOption(value, index, { ...option, echoLastReward: child }))
          }
        />
      )}
      {loadable.allTogetherSets?.map((setInteraction) => (
        <AllTogetherSetEditor
          interaction={setInteraction}
          key={setInteraction.control.setKey}
          offer={value}
          optionIndex={index}
          onUpdate={onUpdate}
        />
      ))}
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
}: {
  readonly address: TraitOfferAddress;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onCommit?: (value: AuthoredTraitOffer) => void;
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
    />
  );
}

function LoadedTraitOfferEditor({
  initialValue,
  interaction,
  onCommit,
}: {
  readonly initialValue: AuthoredTraitOffer;
  readonly interaction: WorkspaceTraitOfferInteraction;
  readonly onCommit?: (value: AuthoredTraitOffer) => void;
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
    () => (value.kind === 'traits' ? interaction.nextTraitOfferDraft?.(value) : undefined),
    [interaction, value],
  );
  useEffect(() => {
    controller.activate(loadable);
    // Activation is deliberately tied to the opened dialog, not to render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadable]);
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
          {interaction.giver.providerKind !== 'olympian' &&
          interaction.giver.providerKind !== 'hermes' ? null : (
            <button
              onClick={() =>
                updateValue(Object.freeze({ kind: 'fallbackGold', giverKey: value.giverKey }))
              }
              type="button"
            >
              Select Fallback Gold
            </button>
          )}
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
            {value.options.length <= 1 ||
            (interaction.giver.providerKind !== 'olympian' &&
              interaction.giver.providerKind !== 'hermes') ? null : (
              <button
                onClick={() => {
                  const options = value.options.slice(
                    0,
                    -1,
                  ) as unknown as AuthoredTraitOfferTraits['options'];
                  const selectedIndex = OPTION_KEYS.indexOf(value.selectedOptionKey);
                  updateValue(
                    Object.freeze({
                      ...value,
                      options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
                      selectedOptionKey: OPTION_KEYS[Math.min(selectedIndex, options.length - 1)]!,
                    }),
                  );
                }}
                type="button"
              >
                Remove last option
              </button>
            )}
            {value.options.length >= OPTION_KEYS.length ? null : (
              <button
                disabled={nextTraitOfferDraft === undefined}
                onClick={() => {
                  if (nextTraitOfferDraft !== undefined) updateValue(nextTraitOfferDraft);
                }}
                type="button"
              >
                Add option
              </button>
            )}
          </div>
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
      focusedSemanticOwner?.kind === 'allTogetherSet' &&
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
        />
      </div>
    </dialog>
  );
}
