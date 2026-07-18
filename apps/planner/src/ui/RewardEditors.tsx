import type {
  Catalog,
  ConcreteReward,
  CountedRewardBinding,
  CountedRewardChoice,
} from '@run-planner/core';

interface RewardValueEditorProps {
  readonly catalog: Catalog;
  readonly idPrefix: string;
  readonly reward: ConcreteReward;
  readonly rewardTypes: readonly string[];
  readonly onReplace: (reward: ConcreteReward) => void;
}

interface CountedRewardEditorProps {
  readonly binding: CountedRewardBinding;
  readonly catalog: Catalog;
  readonly choice: CountedRewardChoice;
  readonly idPrefix: string;
  readonly onReplace: (choice: CountedRewardChoice) => void;
}

function defaultReward(catalog: Catalog, rewardType: string): ConcreteReward {
  const primitive = catalog.rewardPrimitives.byKey[rewardType];
  if (primitive === undefined) {
    throw new Error(`Reward primitive ${rewardType} is missing`);
  }
  return {
    rewardType,
    ...(primitive.defaultPayload === undefined ? {} : { payload: primitive.defaultPayload }),
  };
}

function payloadDomainValues(catalog: Catalog, domainKey: string): readonly string[] {
  const domain = catalog.rewardPayloadDomains.byKey[domainKey];
  if (domain?.kind !== 'oneOf') {
    throw new Error(`Payload value domain ${domainKey} is missing`);
  }
  return domain.values;
}

function sourceLabel(catalog: Catalog, source: string): string {
  const primitive = catalog.rewardPrimitives.byKey[source];
  if (primitive === undefined) {
    throw new Error(`Payload source ${source} is missing`);
  }
  return primitive.label;
}

function storeLabel(storeKey: string): string {
  switch (storeKey) {
    case 'RunProgress':
      return 'Run Progress';
    case 'MetaProgress':
      return 'Meta Progress';
    default:
      throw new Error(`Reward store ${storeKey} has no editor label`);
  }
}

function replaceSource(reward: ConcreteReward, source: string): ConcreteReward {
  return { ...reward, payload: { source } };
}

function replacePairSource(
  reward: ConcreteReward,
  sources: readonly [string, string],
): ConcreteReward {
  return { ...reward, payload: { sources } };
}

function RewardPayloadEditor({
  catalog,
  idPrefix,
  onReplace,
  reward,
}: Omit<RewardValueEditorProps, 'rewardTypes'>) {
  const primitive = catalog.rewardPrimitives.byKey[reward.rewardType];
  if (primitive === undefined) {
    throw new Error(`Reward primitive ${reward.rewardType} is missing`);
  }
  if (primitive.payloadDomain === undefined) {
    return null;
  }
  const domain = catalog.rewardPayloadDomains.byKey[primitive.payloadDomain];
  if (domain === undefined || reward.payload === undefined) {
    throw new Error(`${primitive.gameName} has incomplete payload state`);
  }

  if (domain.kind === 'oneOf') {
    if (!('source' in reward.payload)) {
      throw new Error(`${primitive.gameName} requires a single-source payload`);
    }
    return (
      <label className="field-control" htmlFor={`${idPrefix}-source`}>
        <span>Source</span>
        <select
          id={`${idPrefix}-source`}
          onChange={(event) => onReplace(replaceSource(reward, event.target.value))}
          value={reward.payload.source}
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

  if (!('sources' in reward.payload)) {
    throw new Error(`${primitive.gameName} requires a paired payload`);
  }
  const values = payloadDomainValues(catalog, domain.valueDomain);
  const [first, second] = reward.payload.sources;
  return (
    <div className="paired-payload">
      <label className="field-control" htmlFor={`${idPrefix}-source-1`}>
        <span>Source 1</span>
        <select
          id={`${idPrefix}-source-1`}
          onChange={(event) => onReplace(replacePairSource(reward, [event.target.value, second]))}
          value={first}
        >
          {values
            .filter((source) => source !== second)
            .map((source) => (
              <option key={source} value={source}>
                {sourceLabel(catalog, source)}
              </option>
            ))}
        </select>
      </label>
      <label className="field-control" htmlFor={`${idPrefix}-source-2`}>
        <span>Source 2</span>
        <select
          id={`${idPrefix}-source-2`}
          onChange={(event) => onReplace(replacePairSource(reward, [first, event.target.value]))}
          value={second}
        >
          {values
            .filter((source) => source !== first)
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
  onReplace,
  reward,
  rewardTypes,
}: RewardValueEditorProps) {
  return (
    <div className="reward-value-editor">
      <label className="field-control" htmlFor={`${idPrefix}-reward`}>
        <span>Reward</span>
        <select
          id={`${idPrefix}-reward`}
          onChange={(event) => onReplace(defaultReward(catalog, event.target.value))}
          value={reward.rewardType}
        >
          {rewardTypes.map((rewardType) => {
            const primitive = catalog.rewardPrimitives.byKey[rewardType];
            if (primitive === undefined) {
              throw new Error(`Reward primitive ${rewardType} is missing`);
            }
            return (
              <option key={rewardType} value={rewardType}>
                {primitive.label}
              </option>
            );
          })}
        </select>
      </label>
      <RewardPayloadEditor
        catalog={catalog}
        idPrefix={idPrefix}
        onReplace={onReplace}
        reward={reward}
      />
    </div>
  );
}

function storeRewardTypes(
  catalog: Catalog,
  binding: CountedRewardBinding,
  storeKey: string,
): readonly string[] {
  const store = catalog.rewardStores.byKey[storeKey];
  if (store === undefined) {
    throw new Error(`Reward store ${storeKey} is missing`);
  }
  return store.rewardTypes.filter((rewardType) => binding.allowedRewardTypes.includes(rewardType));
}

function defaultStoreChoice(
  catalog: Catalog,
  binding: CountedRewardBinding,
  storeKey: string,
): CountedRewardChoice {
  const store = catalog.rewardStores.byKey[storeKey];
  if (store === undefined) {
    throw new Error(`Reward store ${storeKey} is missing`);
  }
  const rewardTypes = storeRewardTypes(catalog, binding, storeKey);
  const rewardType = rewardTypes.includes(store.defaultRewardType)
    ? store.defaultRewardType
    : rewardTypes[0];
  if (rewardType === undefined) {
    throw new Error(`${storeKey} has no reward allowed by this producer`);
  }
  return { storeKey, reward: defaultReward(catalog, rewardType) };
}

export function CountedRewardEditor({
  binding,
  catalog,
  choice,
  idPrefix,
  onReplace,
}: CountedRewardEditorProps) {
  const rewardTypes = storeRewardTypes(catalog, binding, choice.storeKey);
  return (
    <div className="counted-reward-editor">
      {binding.storeKeys.length > 1 && (
        <label className="field-control" htmlFor={`${idPrefix}-store`}>
          <span>Reward pool</span>
          <select
            id={`${idPrefix}-store`}
            onChange={(event) =>
              onReplace(defaultStoreChoice(catalog, binding, event.target.value))
            }
            value={choice.storeKey}
          >
            {binding.storeKeys.map((storeKey) => (
              <option key={storeKey} value={storeKey}>
                {storeLabel(storeKey)}
              </option>
            ))}
          </select>
        </label>
      )}
      <RewardValueEditor
        catalog={catalog}
        idPrefix={idPrefix}
        onReplace={(reward) => onReplace({ ...choice, reward })}
        reward={choice.reward}
        rewardTypes={rewardTypes}
      />
    </div>
  );
}
