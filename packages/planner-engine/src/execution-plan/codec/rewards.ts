import type {
  ExecutionAcquisitionRole,
  ExecutionLevelResolution,
  ExecutionReward,
  ExecutionTraitOffer,
} from '../model';
import {
  array,
  booleanValue,
  exact,
  fail,
  integer,
  numberRecord,
  object,
  stringArray,
  stringValue,
} from './primitives';

export function reward(value: unknown, label: string): ExecutionReward {
  const record = object(value, label);
  exact(
    record,
    ['rewardType', 'producerLifecycleKey'],
    ['resolvedStoreKey', 'source', 'spurnedSource', 'acquisitionEnabled'],
    label,
  );
  return Object.freeze({
    rewardType: stringValue(record.rewardType, `${label}.rewardType`),
    producerLifecycleKey: stringValue(record.producerLifecycleKey, `${label}.producerLifecycleKey`),
    ...(record.resolvedStoreKey === undefined
      ? {}
      : { resolvedStoreKey: stringValue(record.resolvedStoreKey, `${label}.resolvedStoreKey`) }),
    ...(record.source === undefined
      ? {}
      : { source: stringValue(record.source, `${label}.source`) }),
    ...(record.spurnedSource === undefined
      ? {}
      : { spurnedSource: stringValue(record.spurnedSource, `${label}.spurnedSource`) }),
    ...(record.acquisitionEnabled === undefined
      ? {}
      : {
          acquisitionEnabled: booleanValue(
            record.acquisitionEnabled,
            `${label}.acquisitionEnabled`,
          ),
        }),
  });
}

export function traitOffer(value: unknown, label: string): ExecutionTraitOffer {
  const record = object(value, label);
  if (record.kind === 'fallbackGold') {
    exact(record, ['kind', 'giver'], [], label);
    return Object.freeze({
      kind: 'fallbackGold',
      giver: stringValue(record.giver, `${label}.giver`),
    });
  }
  if (record.kind === 'chaos') {
    exact(
      record,
      [
        'kind',
        'giver',
        'curseOptions',
        'selected',
        'selectedCurseValues',
        'blessingKey',
        'rarity',
        'blessingValues',
      ],
      [],
      label,
    );
    if (record.giver !== 'Chaos') fail(`${label}.giver must be Chaos`);
    const curseOptions = array(record.curseOptions, `${label}.curseOptions`, 3).map(
      (entry, index) => {
        const option = object(entry, `${label}.curseOptions[${index}]`);
        exact(option, ['curseKey', 'requirementCount'], [], `${label}.curseOptions[${index}]`);
        return Object.freeze({
          curseKey: stringValue(option.curseKey, `${label}.curseOptions[${index}].curseKey`),
          requirementCount: integer(
            option.requirementCount,
            `${label}.curseOptions[${index}].requirementCount`,
            1,
          ),
        });
      },
    );
    if (curseOptions.length !== 3) fail(`${label}.curseOptions must contain three ordered options`);
    const selected = stringValue(record.selected, `${label}.selected`);
    if (!['option1', 'option2', 'option3'].includes(selected))
      fail(`${label}.selected is not a valid option`);
    return Object.freeze({
      kind: 'chaos',
      giver: 'Chaos',
      curseOptions: Object.freeze(curseOptions),
      selected: selected as 'option1' | 'option2' | 'option3',
      selectedCurseValues: numberRecord(record.selectedCurseValues, `${label}.selectedCurseValues`),
      blessingKey: stringValue(record.blessingKey, `${label}.blessingKey`),
      rarity: stringValue(record.rarity, `${label}.rarity`),
      blessingValues: numberRecord(record.blessingValues, `${label}.blessingValues`),
    });
  }
  if (record.kind !== 'traits') fail(`${label}.kind is unsupported`);
  exact(record, ['kind', 'giver', 'options', 'selected'], ['rejected', 'runtimeFallback'], label);
  const options = array(record.options, `${label}.options`, 3).map((entry, index) => {
    const option = object(entry, `${label}.options[${index}]`);
    exact(
      option,
      ['key'],
      ['rarity', 'effectiveLevel', 'replacement'],
      `${label}.options[${index}]`,
    );
    const replacement =
      option.replacement === undefined
        ? undefined
        : object(option.replacement, `${label}.options[${index}].replacement`);
    if (replacement !== undefined)
      exact(
        replacement,
        ['slot', 'replacedTraitKey', 'oldRarity', 'newTraitKey', 'requiredRarity'],
        ['levelBonus'],
        `${label}.options[${index}].replacement`,
      );
    return Object.freeze({
      key: stringValue(option.key, `${label}.options[${index}].key`),
      ...(option.rarity === undefined
        ? {}
        : { rarity: stringValue(option.rarity, `${label}.options[${index}].rarity`) }),
      ...(option.effectiveLevel === undefined
        ? {}
        : {
            effectiveLevel: integer(
              option.effectiveLevel,
              `${label}.options[${index}].effectiveLevel`,
            ),
          }),
      ...(replacement === undefined
        ? {}
        : {
            replacement: Object.freeze({
              slot: stringValue(replacement.slot, `${label}.options[${index}].replacement.slot`),
              replacedTraitKey: stringValue(
                replacement.replacedTraitKey,
                `${label}.options[${index}].replacement.replacedTraitKey`,
              ),
              oldRarity: stringValue(
                replacement.oldRarity,
                `${label}.options[${index}].replacement.oldRarity`,
              ),
              newTraitKey: stringValue(
                replacement.newTraitKey,
                `${label}.options[${index}].replacement.newTraitKey`,
              ),
              requiredRarity: stringValue(
                replacement.requiredRarity,
                `${label}.options[${index}].replacement.requiredRarity`,
              ),
              ...(replacement.levelBonus === undefined
                ? {}
                : {
                    levelBonus: integer(
                      replacement.levelBonus,
                      `${label}.options[${index}].replacement.levelBonus`,
                    ),
                  }),
            }),
          }),
    });
  });
  if (options.length !== 3) fail(`${label}.options must contain three ordered options`);
  const selected = stringValue(record.selected, `${label}.selected`);
  if (!['option1', 'option2', 'option3'].includes(selected))
    fail(`${label}.selected is not a valid option`);
  return Object.freeze({
    kind: 'traits',
    giver: stringValue(record.giver, `${label}.giver`),
    options: Object.freeze(options),
    selected: selected as 'option1' | 'option2' | 'option3',
    ...(record.rejected === undefined
      ? {}
      : {
          rejected: (() => {
            const rejected = stringValue(record.rejected, `${label}.rejected`);
            if (!['option1', 'option2', 'option3'].includes(rejected))
              fail(`${label}.rejected is not a valid option`);
            return rejected as 'option1' | 'option2' | 'option3';
          })(),
        }),
    ...(record.runtimeFallback === undefined
      ? {}
      : { runtimeFallback: stringValue(record.runtimeFallback, `${label}.runtimeFallback`) }),
  });
}

export function levelResolution(value: unknown, label: string): ExecutionLevelResolution {
  const record = object(value, label);
  exact(record, ['offeredTargets', 'selectedTarget', 'levelCount'], [], label);
  return Object.freeze({
    offeredTargets: Object.freeze(stringArray(record.offeredTargets, `${label}.offeredTargets`, 3)),
    selectedTarget:
      record.selectedTarget === null
        ? null
        : stringValue(record.selectedTarget, `${label}.selectedTarget`),
    levelCount: integer(record.levelCount, `${label}.levelCount`),
  });
}

export function acquisitionRole(value: unknown, label: string): ExecutionAcquisitionRole {
  const record = object(value, label);
  exact(
    record,
    ['role', 'disposition', 'lifecyclePoint', 'kind', 'gameName'],
    ['producer', 'settlement', 'traitOffer', 'levelResolution'],
    label,
  );
  if (!['normal', 'timePiece', 'artificer'].includes(record.disposition as string))
    fail(`${label}.disposition is unsupported`);
  const producer =
    record.producer === undefined ? undefined : object(record.producer, `${label}.producer`);
  if (producer !== undefined)
    exact(producer, ['kind', 'sourceOwner', 'sourceRole'], [], `${label}.producer`);
  if (
    producer !== undefined &&
    !['seaStarDuplicate', 'artificerReplacement', 'echoLastReward'].includes(
      producer.kind as string,
    )
  )
    fail(`${label}.producer.kind is unsupported`);
  const settlement =
    record.settlement === undefined ? undefined : object(record.settlement, `${label}.settlement`);
  if (settlement !== undefined) exact(settlement, ['site', 'entry'], [], `${label}.settlement`);
  return Object.freeze({
    role: stringValue(record.role, `${label}.role`),
    disposition: record.disposition as 'normal' | 'timePiece' | 'artificer',
    ...(producer === undefined
      ? {}
      : {
          producer: Object.freeze({
            kind: stringValue(producer.kind, `${label}.producer.kind`) as
              'seaStarDuplicate' | 'artificerReplacement' | 'echoLastReward',
            sourceOwner: stringValue(producer.sourceOwner, `${label}.producer.sourceOwner`, 256),
            sourceRole: stringValue(producer.sourceRole, `${label}.producer.sourceRole`),
          }),
        }),
    lifecyclePoint: stringValue(record.lifecyclePoint, `${label}.lifecyclePoint`),
    kind: stringValue(record.kind, `${label}.kind`),
    gameName: stringValue(record.gameName, `${label}.gameName`),
    ...(settlement === undefined
      ? {}
      : {
          settlement: Object.freeze({
            site: stringValue(settlement.site, `${label}.settlement.site`),
            entry: stringValue(settlement.entry, `${label}.settlement.entry`),
          }),
        }),
    ...(record.traitOffer === undefined
      ? {}
      : { traitOffer: traitOffer(record.traitOffer, `${label}.traitOffer`) }),
    ...(record.levelResolution === undefined
      ? {}
      : { levelResolution: levelResolution(record.levelResolution, `${label}.levelResolution`) }),
  });
}

export function equipResults(value: unknown, label: string) {
  const record = object(value, label);
  exact(record, [], ['jeweledPom', 'experimentalHammer', 'transcendentEmbryo'], label);
  const jeweledPom =
    record.jeweledPom === undefined ? undefined : object(record.jeweledPom, `${label}.jeweledPom`);
  if (jeweledPom !== undefined) exact(jeweledPom, ['traitKey'], ['rarity'], `${label}.jeweledPom`);
  const experimentalHammer =
    record.experimentalHammer === undefined
      ? undefined
      : object(record.experimentalHammer, `${label}.experimentalHammer`);
  if (experimentalHammer !== undefined) {
    if (experimentalHammer.kind === 'selected')
      exact(experimentalHammer, ['kind', 'traitKey'], [], `${label}.experimentalHammer`);
    else if (experimentalHammer.kind === 'exhausted')
      exact(experimentalHammer, ['kind'], [], `${label}.experimentalHammer`);
    else fail(`${label}.experimentalHammer.kind is unsupported`);
  }
  const transcendentEmbryo =
    record.transcendentEmbryo === undefined
      ? undefined
      : object(record.transcendentEmbryo, `${label}.transcendentEmbryo`);
  if (transcendentEmbryo !== undefined)
    exact(transcendentEmbryo, ['blessingKey'], [], `${label}.transcendentEmbryo`);
  return Object.freeze({
    ...(jeweledPom === undefined
      ? {}
      : {
          jeweledPom: Object.freeze({
            traitKey: stringValue(jeweledPom.traitKey, `${label}.jeweledPom.traitKey`),
            ...(jeweledPom.rarity === undefined
              ? {}
              : { rarity: stringValue(jeweledPom.rarity, `${label}.jeweledPom.rarity`) }),
          }),
        }),
    ...(experimentalHammer === undefined
      ? {}
      : {
          experimentalHammer: Object.freeze(
            experimentalHammer.kind === 'selected'
              ? {
                  kind: 'selected' as const,
                  traitKey: stringValue(
                    experimentalHammer.traitKey,
                    `${label}.experimentalHammer.traitKey`,
                  ),
                }
              : { kind: 'exhausted' as const },
          ),
        }),
    ...(transcendentEmbryo === undefined
      ? {}
      : {
          transcendentEmbryo: Object.freeze({
            blessingKey: stringValue(
              transcendentEmbryo.blessingKey,
              `${label}.transcendentEmbryo.blessingKey`,
            ),
          }),
        }),
  });
}
