import {
  requireWorkspaceInteraction,
  type WorkspaceChallengeSwitch,
  type WorkspaceChallengeSwitchElite,
  type WorkspaceChallengeSwitchInteraction,
  type WorkspaceChallengeSwitchKindRow,
  type WorkspaceChallengeSwitchLock,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { challengeSwitchRuleSentence } from '@planner/projections/challengeSwitchCopy';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { hintProps } from '@planner/ui/controls/hint';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { EncounterCustomizationLauncher } from '../locals/EncounterPhaseControl';

const isPlacementFinding = (finding: { readonly code: string }) =>
  finding.code === 'challengeSwitchPlacementUnavailable';
const isCustomizationFinding = (finding: { readonly code: string }) =>
  finding.code === 'challengeSwitchCustomizationUnavailable';
const isEliteFinding = (finding: { readonly code: string }) =>
  finding.code === 'challengeSwitchEliteUnavailable';

function lockHint(lock: WorkspaceChallengeSwitchLock): string {
  return lock.reason === 'unreached' ? candidateWaitingHint : challengeSwitchRuleSentence(lock);
}

/**
 * A host's switch rows: ticking one observes that kind (clearing any other),
 * then its reward and encounter are chosen beneath it.
 */
export function ChallengeSwitchControls({
  interactions,
  observation,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly observation: WorkspaceChallengeSwitch;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.challengeSwitches,
    observation.interactionKey,
  );
  return (
    <>
      {observation.kinds.map((row) => (
        <ChallengeSwitchKindControl
          interaction={interaction}
          key={row.kind}
          observation={observation}
          row={row}
        />
      ))}
    </>
  );
}

function ChallengeSwitchKindControl({
  interaction,
  observation,
  row,
}: {
  readonly interaction: WorkspaceChallengeSwitchInteraction;
  readonly observation: WorkspaceChallengeSwitch;
  readonly row: WorkspaceChallengeSwitchKindRow;
}) {
  const executeIntent = useCommandIntent();
  const findingTarget = useFindingTarget();
  // An observed switch stays clearable whatever its rules say.
  const unavailable = row.selected || row.observeVariantKey !== undefined ? undefined : row.lock;
  const target = row.selected
    ? findingTarget(
        observation.address,
        semanticOwnerControlElementId(observation.address),
        observation.address,
        isPlacementFinding,
      )
    : {};
  const selectedVariant = row.variants.find((variant) => variant.selected);
  return (
    <fieldset className="room-purging-pool challenge-switch" data-switch-kind={row.kind}>
      <legend className="visually-hidden">{row.label}</legend>
      <label
        className="room-feature-presence-row"
        {...hintProps(unavailable === undefined ? undefined : lockHint(unavailable))}
      >
        <input
          {...target}
          aria-label={row.label}
          checked={row.selected}
          disabled={unavailable !== undefined}
          onChange={(event) => {
            if (!event.target.checked) executeIntent(interaction.observeIntentFor(null));
            else if (row.observeVariantKey !== undefined)
              executeIntent(interaction.observeIntentFor(row.observeVariantKey));
          }}
          type="checkbox"
        />
        <span>{row.label}</span>
      </label>
      {!row.selected ? null : (
        <>
          {row.variants.length < 2 ? null : (
            <div className="shop-family-offer-row">
              <ContextualPicker<string>
                ariaLabel={`${row.label} Item`}
                id={`challenge-switch-${row.kind}-item`}
                label="Item"
                layout="inline"
                model={declaredChoicesPicker(
                  row.variants.map((variant) => ({
                    key: variant.variantKey,
                    value: variant.variantKey,
                    label: variant.label,
                    ...(variant.lock === undefined || variant.selected
                      ? {}
                      : { disabled: true, explanation: lockHint(variant.lock) }),
                  })),
                  selectedVariant?.variantKey,
                )}
                itemIcon={(item) =>
                  rewardIcon(
                    row.variants.find((variant) => variant.variantKey === item.value)?.rewardType ??
                      '',
                  )
                }
                onSelect={(variantKey) => {
                  if (variantKey !== selectedVariant?.variantKey)
                    executeIntent(interaction.observeIntentFor(variantKey));
                }}
                placeholder="Item"
                searchable={false}
                {...(selectedVariant === undefined
                  ? {}
                  : {
                      triggerIcon: rewardIcon(selectedVariant.rewardType),
                      triggerLabel: selectedVariant.label,
                    })}
              />
            </div>
          )}
          {observation.encounter === undefined ? null : (
            <div className="shop-family-offer-row">
              <div className="field-control field-control-inline">
                <span>Combat</span>
                <EncounterCustomizationLauncher
                  interaction={interaction.customization}
                  subject={{
                    address: observation.address,
                    controlId: `challenge-switch-customization-${semanticOwnerControlElementId(observation.address)}`,
                    definitionKey: observation.encounter.definitionKey,
                    label: observation.encounter.label,
                    identityLabel: `${row.label} encounter`,
                    ...(observation.encounter.customization === undefined
                      ? {}
                      : { customization: observation.encounter.customization }),
                    ...(observation.encounter.composition === undefined
                      ? {}
                      : { composition: observation.encounter.composition }),
                    findingFilter: isCustomizationFinding,
                  }}
                />
              </div>
            </div>
          )}
          {observation.elite === undefined ? null : (
            <ChallengeSwitchEliteControl
              elite={observation.elite}
              interaction={interaction}
              observation={observation}
            />
          )}
        </>
      )}
    </fieldset>
  );
}

/** The Elite switch's elite and its forced attributes; each Default leaves the draw native. */
function ChallengeSwitchEliteControl({
  elite,
  interaction,
  observation,
}: {
  readonly elite: WorkspaceChallengeSwitchElite;
  readonly interaction: WorkspaceChallengeSwitchInteraction;
  readonly observation: WorkspaceChallengeSwitch;
}) {
  const executeIntent = useCommandIntent();
  const findingTarget = useFindingTarget();
  const pinned = elite.attributes.flatMap((attribute) =>
    attribute.key === undefined ? [] : [attribute.key],
  );
  const id = `challenge-switch-elite-${semanticOwnerControlElementId(observation.address)}`;
  return (
    <>
      <div className="shop-family-offer-row">
        <ContextualPicker<string>
          ariaLabel="Elite enemy"
          findingTarget={findingTarget(
            observation.address,
            id,
            observation.address,
            isEliteFinding,
          )}
          id={id}
          label="Elite"
          layout="inline"
          model={declaredChoicesPicker(
            [
              { key: 'default', value: '', label: 'Default' },
              ...elite.enemies.map((enemy) => ({
                key: enemy.key,
                value: enemy.key,
                label: enemy.label,
              })),
            ],
            elite.enemyKey ?? '',
          )}
          onSelect={(enemyKey) => {
            if (enemyKey === (elite.enemyKey ?? '')) return;
            executeIntent(
              interaction.eliteIntentFor(enemyKey === '' ? null : { enemyKey, attributeKeys: [] }),
            );
          }}
          placeholder="Default"
          triggerLabel={elite.enemyLabel ?? elite.enemyKey ?? 'Default'}
        />
      </div>
      {elite.enemyKey === undefined
        ? null
        : elite.attributes.map((attribute, index) => {
            const enemyKey = elite.enemyKey!;
            // A later draw follows the earlier ones, so it waits for them to be pinned.
            const waiting = index > pinned.length;
            return (
              <div className="shop-family-offer-row" key={index}>
                <ContextualPicker<string>
                  ariaLabel={`Elite attribute ${index + 1}`}
                  id={`${id}-attribute-${index}`}
                  label={`Attribute ${index + 1}`}
                  layout="inline"
                  {...(waiting ? { locked: true } : {})}
                  model={declaredChoicesPicker(
                    [
                      { key: 'default', value: '', label: 'Default' },
                      ...(attribute.key !== undefined &&
                      !attribute.choices.some((choice) => choice.key === attribute.key)
                        ? [
                            {
                              key: attribute.key,
                              value: attribute.key,
                              label: `${attribute.label ?? attribute.key} (unavailable)`,
                              disabled: true,
                            },
                          ]
                        : []),
                      ...attribute.choices.map((choice) => ({
                        key: choice.key,
                        value: choice.key,
                        label: choice.label,
                      })),
                    ],
                    attribute.key ?? '',
                  )}
                  onSelect={(attributeKey) => {
                    if (attributeKey === (attribute.key ?? '')) return;
                    const prefix = pinned.slice(0, index);
                    executeIntent(
                      interaction.eliteIntentFor({
                        enemyKey,
                        attributeKeys: attributeKey === '' ? prefix : [...prefix, attributeKey],
                      }),
                    );
                  }}
                  placeholder="Default"
                  triggerLabel={attribute.label ?? 'Default'}
                />
              </div>
            );
          })}
    </>
  );
}
