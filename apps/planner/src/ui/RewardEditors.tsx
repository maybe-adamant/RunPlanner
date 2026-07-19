import type { Catalog, CountedRewardBinding } from '@run-planner/core';
import type { ResolvedRewardOffer } from '@run-planner/core/reward-kernel';

interface RewardValueEditorProps {
  readonly catalog: Catalog;
  readonly idPrefix: string;
  readonly offer: ResolvedRewardOffer;
  readonly rewardTypes: readonly string[];
  readonly onReplace: (offer: ResolvedRewardOffer) => void;
}

interface CountedRewardEditorProps {
  readonly binding: CountedRewardBinding;
  readonly catalog: Catalog;
  readonly offer: ResolvedRewardOffer;
  readonly idPrefix: string;
  readonly onReplace: (offer: ResolvedRewardOffer) => void;
}

function defaultOffer(catalog: Catalog, rewardType: string): ResolvedRewardOffer {
  const declaration = catalog.rewards.rewardTypes.byKey[rewardType];
  if (declaration === undefined) {
    throw new Error(`Reward type ${rewardType} is missing`);
  }
  return {
    rewardType,
    ...(declaration.defaultPayload === undefined ? {} : { payload: declaration.defaultPayload }),
  };
}

function payloadDomainValues(catalog: Catalog, domainKey: string): readonly string[] {
  const domain = catalog.rewards.payloadDomains.byKey[domainKey];
  if (domain?.kind !== 'oneOf') {
    throw new Error(`Payload value domain ${domainKey} is missing`);
  }
  return domain.values;
}

function sourceLabel(catalog: Catalog, source: string): string {
  const declaration = catalog.rewards.rewardTypes.byKey[source];
  if (declaration === undefined) {
    throw new Error(`Payload source ${source} is missing`);
  }
  return declaration.label;
}

function RewardPayloadEditor({
  catalog,
  idPrefix,
  onReplace,
  offer,
}: Omit<RewardValueEditorProps, 'rewardTypes'>) {
  const declaration = catalog.rewards.rewardTypes.byKey[offer.rewardType];
  if (declaration === undefined) {
    throw new Error(`Reward type ${offer.rewardType} is missing`);
  }
  if (declaration.payloadDomain === undefined) {
    return null;
  }
  const domain = catalog.rewards.payloadDomains.byKey[declaration.payloadDomain];
  if (domain === undefined || offer.payload === undefined) {
    throw new Error(`${declaration.gameName} has incomplete payload state`);
  }

  if (domain.kind === 'oneOf') {
    if (offer.payload.kind !== 'BoonSource') {
      throw new Error(`${declaration.gameName} requires a single-source payload`);
    }
    return (
      <label className="field-control" htmlFor={`${idPrefix}-source`}>
        <span>Source</span>
        <select
          id={`${idPrefix}-source`}
          onChange={(event) =>
            onReplace({
              ...offer,
              payload: { kind: 'BoonSource', source: event.target.value },
            })
          }
          value={offer.payload.source}
        >
          {domain.values.map((source) => (
            <option key={source} value={source}>
              {sourceLabel(catalog, source)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (offer.payload.kind !== 'DevotionPair') {
    throw new Error(`${declaration.gameName} requires a paired payload`);
  }
  const values = payloadDomainValues(catalog, domain.valueDomain);
  const { chosenSource, spurnedSource } = offer.payload;
  return (
    <div className="paired-payload">
      <label className="field-control" htmlFor={`${idPrefix}-source-1`}>
        <span>Chosen source</span>
        <select
          id={`${idPrefix}-source-1`}
          onChange={(event) =>
            onReplace({
              ...offer,
              payload: {
                kind: 'DevotionPair',
                chosenSource: event.target.value,
                spurnedSource,
              },
            })
          }
          value={chosenSource}
        >
          {values
            .filter((source) => source !== spurnedSource)
            .map((source) => (
              <option key={source} value={source}>
                {sourceLabel(catalog, source)}
              </option>
            ))}
        </select>
      </label>
      <label className="field-control" htmlFor={`${idPrefix}-source-2`}>
        <span>Spurned source</span>
        <select
          id={`${idPrefix}-source-2`}
          onChange={(event) =>
            onReplace({
              ...offer,
              payload: {
                kind: 'DevotionPair',
                chosenSource,
                spurnedSource: event.target.value,
              },
            })
          }
          value={spurnedSource}
        >
          {values
            .filter((source) => source !== chosenSource)
            .map((source) => (
              <option key={source} value={source}>
                {sourceLabel(catalog, source)}
              </option>
            ))}
        </select>
      </label>
    </div>
  );
}

export function RewardValueEditor({
  catalog,
  idPrefix,
  offer,
  onReplace,
  rewardTypes,
}: RewardValueEditorProps) {
  return (
    <div className="reward-value-editor">
      <label className="field-control" htmlFor={`${idPrefix}-reward`}>
        <span>Reward</span>
        <select
          id={`${idPrefix}-reward`}
          onChange={(event) => onReplace(defaultOffer(catalog, event.target.value))}
          value={offer.rewardType}
        >
          {rewardTypes.map((rewardType) => {
            const declaration = catalog.rewards.rewardTypes.byKey[rewardType];
            if (declaration === undefined) {
              throw new Error(`Reward type ${rewardType} is missing`);
            }
            return (
              <option key={rewardType} value={rewardType}>
                {declaration.label}
              </option>
            );
          })}
        </select>
      </label>
      <RewardPayloadEditor
        catalog={catalog}
        idPrefix={idPrefix}
        offer={offer}
        onReplace={onReplace}
      />
    </div>
  );
}

export function CountedRewardEditor({
  binding,
  catalog,
  offer,
  idPrefix,
  onReplace,
}: CountedRewardEditorProps) {
  return (
    <RewardValueEditor
      catalog={catalog}
      idPrefix={idPrefix}
      offer={offer}
      onReplace={onReplace}
      rewardTypes={binding.allowedRewardTypes}
    />
  );
}
